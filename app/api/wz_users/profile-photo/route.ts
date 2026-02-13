import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const USER_PHOTO_BUCKET = "wz-user-photos";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  photo_link?: string | null;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const runSelect = async (columns: string) => {
    const base = params.sb.from("wz_users").select(columns).limit(5);
    if (params.mode === "ilike") {
      return base.ilike(params.column, params.value);
    }
    return base.eq(params.column, params.value);
  };

  const withPhoto = await runSelect("id,email,photo_link");
  if (!withPhoto.error) {
    return (withPhoto.data || []) as WzUserRow[];
  }

  const withoutPhoto = await runSelect("id,email");
  if (!withoutPhoto.error) {
    return ((withoutPhoto.data || []) as WzUserRow[]).map((row) => ({
      ...row,
      photo_link: null,
    }));
  }

  return [] as WzUserRow[];
}

function pickBestRow(rows: WzUserRow[], expectedEmail?: string | null) {
  if (!rows.length) return null;

  const normalizedExpected = normalizeEmail(expectedEmail);
  if (normalizedExpected) {
    const exact = rows.find(
      (row) => normalizeEmail(row.email) === normalizedExpected
    );
    if (exact?.id) return exact;
  }

  const firstWithId = rows.find((row) => normalizeOptionalText(row.id));
  return firstWithId || null;
}

async function findWzUserRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  email: string;
}) {
  if (params.email) {
    const byEmail = await queryWzUsersRows({
      sb: params.sb,
      column: "email",
      value: params.email,
      mode: "ilike",
    });
    const bestByEmail = pickBestRow(byEmail, params.email);
    if (bestByEmail?.id) return bestByEmail;
  }

  if (params.userId) {
    const byAuthUserId = await queryWzUsersRows({
      sb: params.sb,
      column: "auth_user_id",
      value: params.userId,
      mode: "eq",
    });
    const bestByAuthUserId = pickBestRow(byAuthUserId, params.email);
    if (bestByAuthUserId?.id) return bestByAuthUserId;

    const byUserId = await queryWzUsersRows({
      sb: params.sb,
      column: "user_id",
      value: params.userId,
      mode: "eq",
    });
    const bestByUserId = pickBestRow(byUserId, params.email);
    if (bestByUserId?.id) return bestByUserId;

    const byId = await queryWzUsersRows({
      sb: params.sb,
      column: "id",
      value: params.userId,
      mode: "eq",
    });
    const bestById = pickBestRow(byId, params.email);
    if (bestById?.id) return bestById;
  }

  return null;
}

async function ensurePhotoBucket(sb: ReturnType<typeof supabaseAdmin>) {
  const { data: buckets, error: listError } = await sb.storage.listBuckets();
  if (!listError && (buckets || []).some((bucket) => bucket.name === USER_PHOTO_BUCKET)) {
    return true;
  }

  const { error: createError } = await sb.storage.createBucket(USER_PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  });

  if (!createError) return true;

  const message = String(createError.message || "").toLowerCase();
  if (message.includes("already") && message.includes("exist")) {
    return true;
  }

  return false;
}

function pickFileExtension(file: File) {
  const mime = String(file.type || "").toLowerCase();

  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";

  const fileName = String(file.name || "").toLowerCase();
  const ext = fileName.includes(".") ? fileName.split(".").pop() || "" : "";
  const cleanExt = ext.replace(/[^a-z0-9]/g, "").slice(0, 8);
  return cleanExt || "png";
}

function extractObjectPathFromPublicUrl(photoLink?: string | null) {
  const raw = String(photoLink || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const marker = `/storage/v1/object/public/${USER_PHOTO_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;

    const objectPath = parsed.pathname.slice(idx + marker.length);
    if (!objectPath) return null;

    return decodeURIComponent(objectPath);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await readActiveSessionFromRequest(req);

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Nao autenticado." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const formData = await req.formData();
    const uploaded = formData.get("file");

    if (!(uploaded instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Arquivo nao enviado." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const mimeType = String(uploaded.type || "").toLowerCase();

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { ok: false, error: "Formato invalido. Use PNG, JPG, JPEG, WEBP, GIF ou SVG." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (uploaded.size <= 0) {
      return NextResponse.json(
        { ok: false, error: "Arquivo vazio." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (uploaded.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "A imagem deve ter no maximo 5MB." },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }

    const sb = supabaseAdmin();
    const userRow = await findWzUserRow({
      sb,
      userId: String(session.userId || "").trim(),
      email: normalizeEmail(session.email),
    });

    if (!userRow?.id) {
      return NextResponse.json(
        { ok: false, error: "Usuario nao encontrado." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const bucketReady = await ensurePhotoBucket(sb);
    if (!bucketReady) {
      return NextResponse.json(
        { ok: false, error: "Falha ao preparar o armazenamento de fotos." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const extension = pickFileExtension(uploaded);
    const objectPath = `${userRow.id}/avatar-${Date.now()}.${extension}`;
    const bytes = Buffer.from(await uploaded.arrayBuffer());

    const { error: uploadError } = await sb.storage
      .from(USER_PHOTO_BUCKET)
      .upload(objectPath, bytes, {
        cacheControl: "31536000",
        upsert: true,
        contentType: mimeType || "application/octet-stream",
      });

    if (uploadError) {
      console.error("[profile-photo] upload error:", uploadError);
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel enviar a imagem." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const publicUrl = sb.storage.from(USER_PHOTO_BUCKET).getPublicUrl(objectPath).data.publicUrl;

    if (!publicUrl) {
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel gerar o link da imagem." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const { error: updateError } = await sb
      .from("wz_users")
      .update({ photo_link: publicUrl })
      .eq("id", userRow.id);

    if (updateError) {
      console.error("[profile-photo] wz_users update error:", updateError);
      await sb.storage.from(USER_PHOTO_BUCKET).remove([objectPath]);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nao foi possivel salvar o avatar no usuario. Verifique se a coluna photo_link existe em wz_users.",
        },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const previousObjectPath = extractObjectPathFromPublicUrl(userRow.photo_link);
    if (previousObjectPath && previousObjectPath !== objectPath) {
      await sb.storage.from(USER_PHOTO_BUCKET).remove([previousObjectPath]);
    }

    return NextResponse.json(
      {
        ok: true,
        photoLink: publicUrl,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[profile-photo] unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao atualizar a foto de perfil." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await readActiveSessionFromRequest(req);

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Nao autenticado." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const sb = supabaseAdmin();
    const userRow = await findWzUserRow({
      sb,
      userId: String(session.userId || "").trim(),
      email: normalizeEmail(session.email),
    });

    if (!userRow?.id) {
      return NextResponse.json(
        { ok: false, error: "Usuario nao encontrado." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const previousObjectPath = extractObjectPathFromPublicUrl(userRow.photo_link);

    const { error: updateError } = await sb
      .from("wz_users")
      .update({ photo_link: null })
      .eq("id", userRow.id);

    if (updateError) {
      console.error("[profile-photo] remove wz_users photo_link error:", updateError);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nao foi possivel remover o avatar do usuario. Verifique se a coluna photo_link existe em wz_users.",
        },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    if (previousObjectPath) {
      await sb.storage.from(USER_PHOTO_BUCKET).remove([previousObjectPath]);
    }

    return NextResponse.json(
      {
        ok: true,
        photoLink: null,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[profile-photo] unexpected delete error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao remover a foto de perfil." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
