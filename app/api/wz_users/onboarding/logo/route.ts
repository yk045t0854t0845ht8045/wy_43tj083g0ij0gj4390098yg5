import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  cleanupPrimaryOnboardingLogoFolder,
  extractObjectPathFromPublicUrl,
  ONBOARDING_LOGO_BUCKET,
} from "@/app/api/wz_users/_managed_storage";
import {
  ensureOnboardingRecord,
  normalizeEmail,
  ONBOARDING_SCHEMA_HINT,
  patchOnboardingRecord,
} from "@/app/api/wz_users/_onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

function pickFileExtension(file: File) {
  const mime = String(file.type || "").toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";

  const fileName = String(file.name || "").toLowerCase();
  const ext = fileName.includes(".") ? fileName.split(".").pop() || "" : "";
  const cleanExt = ext.replace(/[^a-z0-9]/g, "").slice(0, 8);
  return cleanExt || "png";
}

async function ensureLogoBucket(sb: ReturnType<typeof supabaseAdmin>) {
  const { data: buckets, error: listError } = await sb.storage.listBuckets();
  if (!listError && (buckets || []).some((bucket) => bucket.name === ONBOARDING_LOGO_BUCKET)) {
    return true;
  }

  const { error: createError } = await sb.storage.createBucket(ONBOARDING_LOGO_BUCKET, {
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

export async function POST(req: NextRequest) {
  try {
    const session = await readActiveSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Nao autenticado." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const sessionUserId = String(session.userId || "").trim();
    const sessionEmail = normalizeEmail(session.email);
    if (!sessionUserId || !sessionEmail) {
      return NextResponse.json(
        { ok: false, error: "Sessao invalida." },
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
        { ok: false, error: "Formato invalido. Use PNG, JPG, WEBP ou SVG." },
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
        { ok: false, error: "A logo deve ter no maximo 1MB." },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }

    const sb = supabaseAdmin();
    const onboarding = await ensureOnboardingRecord({
      sb,
      sessionUserId,
      sessionEmail,
    });

    if (!onboarding.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            onboarding.schemaReady === false
              ? ONBOARDING_SCHEMA_HINT
              : "Nao foi possivel localizar onboarding para salvar a logo.",
        },
        { status: onboarding.schemaReady === false ? 500 : 400, headers: NO_STORE_HEADERS },
      );
    }

    const bucketReady = await ensureLogoBucket(sb);
    if (!bucketReady) {
      return NextResponse.json(
        { ok: false, error: "Falha ao preparar o armazenamento da logo." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const extension = pickFileExtension(uploaded);
    const objectPath = `${onboarding.record.userId}/logo-${Date.now()}.${extension}`;
    const bytes = Buffer.from(await uploaded.arrayBuffer());

    const { error: uploadError } = await sb.storage
      .from(ONBOARDING_LOGO_BUCKET)
      .upload(objectPath, bytes, {
        upsert: true,
        contentType: mimeType || "application/octet-stream",
        cacheControl: "31536000",
      });

    if (uploadError) {
      console.error("[onboarding-logo] upload error:", uploadError);
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel enviar a logo." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const publicUrl = sb.storage
      .from(ONBOARDING_LOGO_BUCKET)
      .getPublicUrl(objectPath).data.publicUrl;
    if (!publicUrl) {
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel gerar o link da logo." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const previousObjectPath = extractObjectPathFromPublicUrl(
      ONBOARDING_LOGO_BUCKET,
      onboarding.record.companyLogoUrl,
    );

    const updated = await patchOnboardingRecord({
      sb,
      recordId: onboarding.record.id,
      patch: {
        company_logo_url: publicUrl,
      },
    });

    if (!updated.ok) {
      console.error("[onboarding-logo] update onboarding error:", updated.error);
      await sb.storage.from(ONBOARDING_LOGO_BUCKET).remove([objectPath]);
      return NextResponse.json(
        {
          ok: false,
          error:
            updated.schemaReady === false
              ? ONBOARDING_SCHEMA_HINT
              : "Nao foi possivel salvar a logo no onboarding.",
        },
        { status: updated.schemaReady === false ? 500 : 400, headers: NO_STORE_HEADERS },
      );
    }

    if (previousObjectPath && previousObjectPath !== objectPath) {
      await sb.storage.from(ONBOARDING_LOGO_BUCKET).remove([previousObjectPath]);
    }

    try {
      await cleanupPrimaryOnboardingLogoFolder({
        sb,
        userId: onboarding.record.userId,
        keepObjectPath: objectPath,
      });
    } catch (cleanupError) {
      console.error("[onboarding-logo] cleanup stale logos error:", cleanupError);
    }

    const refreshed = await ensureOnboardingRecord({
      sb,
      sessionUserId,
      sessionEmail,
    });

    return NextResponse.json(
      {
        ok: true,
        companyLogoUrl: publicUrl,
        onboarding: refreshed.ok ? refreshed.record : onboarding.record,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[onboarding-logo] unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao enviar logo de onboarding." },
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

    const sessionUserId = String(session.userId || "").trim();
    const sessionEmail = normalizeEmail(session.email);
    if (!sessionUserId || !sessionEmail) {
      return NextResponse.json(
        { ok: false, error: "Sessao invalida." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const sb = supabaseAdmin();
    const onboarding = await ensureOnboardingRecord({
      sb,
      sessionUserId,
      sessionEmail,
    });

    if (!onboarding.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            onboarding.schemaReady === false
              ? ONBOARDING_SCHEMA_HINT
              : "Nao foi possivel localizar onboarding para remover a logo.",
        },
        { status: onboarding.schemaReady === false ? 500 : 400, headers: NO_STORE_HEADERS },
      );
    }

    const previousObjectPath = extractObjectPathFromPublicUrl(
      ONBOARDING_LOGO_BUCKET,
      onboarding.record.companyLogoUrl,
    );

    const updated = await patchOnboardingRecord({
      sb,
      recordId: onboarding.record.id,
      patch: {
        company_logo_url: null,
      },
    });

    if (!updated.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            updated.schemaReady === false
              ? ONBOARDING_SCHEMA_HINT
              : "Nao foi possivel remover a logo do onboarding.",
        },
        { status: updated.schemaReady === false ? 500 : 400, headers: NO_STORE_HEADERS },
      );
    }

    if (previousObjectPath) {
      await sb.storage.from(ONBOARDING_LOGO_BUCKET).remove([previousObjectPath]);
    }

    try {
      await cleanupPrimaryOnboardingLogoFolder({
        sb,
        userId: onboarding.record.userId,
      });
    } catch (cleanupError) {
      console.error("[onboarding-logo] cleanup folder on delete error:", cleanupError);
    }

    const refreshed = await ensureOnboardingRecord({
      sb,
      sessionUserId,
      sessionEmail,
    });

    return NextResponse.json(
      {
        ok: true,
        companyLogoUrl: null,
        onboarding: refreshed.ok ? refreshed.record : onboarding.record,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[onboarding-logo] unexpected delete error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao remover logo de onboarding." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
