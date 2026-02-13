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

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
  user_id?: string | null;
  support_access?: boolean | string | number | null;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function isMissingSupportAccessColumn(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("support_access") ||
    details.includes("support_access") ||
    hint.includes("support_access")
  );
}

function parseSupportAccess(value: unknown) {
  if (value === null || typeof value === "undefined") return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "1" || clean === "true" || clean === "t";
  }
  return false;
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

  const columnsToTry = [
    "id,email,auth_user_id,user_id,support_access",
    "id,email,auth_user_id,user_id",
    "id,email,auth_user_id",
    "id,email,user_id",
    "id,email",
  ];

  for (const columns of columnsToTry) {
    const res = await runSelect(columns);
    if (!res.error) {
      return (res.data || []) as WzUserRow[];
    }
    if (!isMissingSupportAccessColumn(res.error)) {
      console.error("[support-access] query wz_users error:", res.error);
    }
  }

  return [] as WzUserRow[];
}

function pickBestRow(rows: WzUserRow[], expectedEmail?: string | null) {
  if (!rows.length) return null;

  const normalizedExpected = normalizeEmail(expectedEmail);
  if (normalizedExpected) {
    const exact = rows.find((row) => normalizeEmail(row.email) === normalizedExpected);
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

async function getSessionAndUser(req: NextRequest) {
  const session = await readActiveSessionFromRequest(req);
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Nao autenticado." },
        { status: 401, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const sb = supabaseAdmin();
  const userRow = await findWzUserRow({
    sb,
    userId: String(session.userId || "").trim(),
    email: normalizeEmail(session.email),
  });

  if (!userRow?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Usuario nao encontrado." },
        { status: 404, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return { ok: true as const, sb, userRow };
}

export async function GET(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    return NextResponse.json(
      {
        ok: true,
        active: parseSupportAccess(base.userRow.support_access),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[support-access] get error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao consultar acesso para suporte." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const nextActive = (() => {
      const raw = body.active;
      if (typeof raw === "boolean") return raw;
      if (typeof raw === "number") return raw === 1;
      if (typeof raw === "string") {
        const clean = raw.trim().toLowerCase();
        return clean === "1" || clean === "true" || clean === "t";
      }
      return false;
    })();

    const supportAccessValue = nextActive ? 1 : 0;

    const { error } = await base.sb
      .from("wz_users")
      .update({ support_access: supportAccessValue })
      .eq("id", String(base.userRow.id));

    if (error) {
      if (isMissingSupportAccessColumn(error)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Campo support_access ausente em wz_users. Execute o ALTER TABLE para criar a coluna.",
          },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      console.error("[support-access] update error:", error);
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel atualizar o acesso para suporte." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { ok: true, active: nextActive },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[support-access] put error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao atualizar acesso para suporte." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
