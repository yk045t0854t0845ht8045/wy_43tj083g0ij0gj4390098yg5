import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { listLoginProvidersForUser, normalizeLoginProvider } from "@/app/api/wz_AuthLogin/_login_providers";
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
  auth_provider?: string | null;
  must_create_password?: boolean | string | number | null;
};

type ProviderPayload = {
  id: string;
  provider: "password" | "google" | "apple" | "github" | "microsoft" | "unknown";
  providerLabel: string;
  linkedAt: string | null;
  lastLoginAt: string | null;
  isPassword: boolean;
  isExternal: boolean;
  isPrimary: boolean;
};

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeEmail(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  return clean || null;
}

function normalizeIso(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const ms = Date.parse(clean);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "1" || clean === "true" || clean === "t";
  }
  return false;
}

function providerLabel(provider: string) {
  const p = normalizeLoginProvider(provider);
  if (p === "password") return "Senha";
  if (p === "google") return "Google";
  if (p === "apple") return "Apple";
  if (p === "github") return "GitHub";
  if (p === "microsoft") return "Microsoft";
  return "Desconhecido";
}

function providerId(provider: string, index: number) {
  return `${normalizeLoginProvider(provider)}-${index + 1}`;
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const columnsToTry = [
    "id,email,auth_user_id,auth_provider,must_create_password",
    "id,email,auth_user_id,auth_provider",
    "id,email,auth_user_id,must_create_password",
    "id,email,auth_provider,must_create_password",
    "id,email,auth_provider",
    "id,email,must_create_password",
    "id,email",
  ];

  for (const columns of columnsToTry) {
    const base = params.sb.from("wz_users").select(columns).limit(5);
    const res =
      params.mode === "ilike"
        ? await base.ilike(params.column, params.value)
        : await base.eq(params.column, params.value);

    if (!res.error) {
      const rows = (res.data || []) as WzUserRow[];
      return rows.map((row) => ({
        id: normalizeText(row.id),
        email: normalizeEmail(row.email),
        auth_provider: normalizeText(row.auth_provider),
        must_create_password:
          typeof row.must_create_password === "undefined"
            ? null
            : normalizeBoolean(row.must_create_password),
      }));
    }
  }

  return [] as Array<{
    id: string | null;
    email: string | null;
    auth_provider: string | null;
    must_create_password: boolean | null;
  }>;
}

function pickBestWzUserRow(
  rows: Array<{
    id: string | null;
    email: string | null;
    auth_provider: string | null;
    must_create_password: boolean | null;
  }>,
  email?: string | null,
) {
  const normalizedExpected = normalizeEmail(email);
  if (normalizedExpected) {
    const byEmail = rows.find(
      (row) => normalizeEmail(row.email) === normalizedExpected && row.id,
    );
    if (byEmail) return byEmail;
  }
  return rows.find((row) => row.id) || null;
}

async function findWzUserRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  email: string;
}) {
  if (params.userId) {
    const byId = await queryWzUsersRows({
      sb: params.sb,
      column: "id",
      value: params.userId,
      mode: "eq",
    });
    const bestById = pickBestWzUserRow(byId, params.email);
    if (bestById?.id) return bestById;
  }

  if (params.userId) {
    const byAuthUserId = await queryWzUsersRows({
      sb: params.sb,
      column: "auth_user_id",
      value: params.userId,
      mode: "eq",
    });
    const bestByAuth = pickBestWzUserRow(byAuthUserId, params.email);
    if (bestByAuth?.id) return bestByAuth;
  }

  if (params.email) {
    const byEmail = await queryWzUsersRows({
      sb: params.sb,
      column: "email",
      value: params.email,
      mode: "ilike",
    });
    const bestByEmail = pickBestWzUserRow(byEmail, params.email);
    if (bestByEmail?.id) return bestByEmail;
  }

  return null;
}

function okJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  const session = await readActiveSessionFromRequest(req);
  if (!session) {
    return okJson({ ok: false, error: "Nao autenticado." }, 401);
  }

  const userId = String(session.userId || "").trim();
  const email = normalizeEmail(session.email);
  if (!userId || !email) {
    return okJson({ ok: false, error: "Sessao invalida." }, 401);
  }

  const sb = supabaseAdmin();
  const userRow = await findWzUserRow({
    sb,
    userId,
    email,
  });
  if (!userRow?.id) {
    return okJson({ ok: false, error: "Usuario nao encontrado." }, 404);
  }

  const primaryProvider = normalizeLoginProvider(userRow.auth_provider || "password");
  const mustCreatePassword = Boolean(userRow.must_create_password);

  const providerRows = await listLoginProvidersForUser({
    sb,
    userId: String(userRow.id),
  });

  const providers: ProviderPayload[] = [];
  const seen = new Set<string>();

  for (const row of providerRows.rows) {
    const provider = normalizeLoginProvider(row.provider);
    const key = `${provider}:${row.providerUserId || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    providers.push({
      id: row.id,
      provider,
      providerLabel: providerLabel(provider),
      linkedAt: normalizeIso(row.linkedAt),
      lastLoginAt: normalizeIso(row.lastLoginAt),
      isPassword: provider === "password",
      isExternal: provider !== "password",
      isPrimary: provider === primaryProvider,
    });
  }

  if (!providers.some((item) => item.provider === primaryProvider)) {
    providers.push({
      id: providerId(primaryProvider, providers.length),
      provider: primaryProvider,
      providerLabel: providerLabel(primaryProvider),
      linkedAt: null,
      lastLoginAt: null,
      isPassword: primaryProvider === "password",
      isExternal: primaryProvider !== "password",
      isPrimary: true,
    });
  }

  if (!mustCreatePassword && !providers.some((item) => item.provider === "password")) {
    providers.push({
      id: providerId("password", providers.length),
      provider: "password",
      providerLabel: "Senha",
      linkedAt: null,
      lastLoginAt: null,
      isPassword: true,
      isExternal: false,
      isPrimary: primaryProvider === "password",
    });
  }

  providers.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    const aMs = Date.parse(String(a.lastLoginAt || a.linkedAt || "")) || 0;
    const bMs = Date.parse(String(b.lastLoginAt || b.linkedAt || "")) || 0;
    if (aMs !== bMs) return bMs - aMs;
    return a.provider.localeCompare(b.provider);
  });

  return okJson({
    ok: true,
    schemaReady: providerRows.schemaReady,
    primaryProvider,
    mustCreatePassword,
    providers,
    summary: {
      linkedProviders: providers.length,
      externalProviders: providers.filter((item) => item.isExternal).length,
      hasPasswordProvider: providers.some((item) => item.provider === "password"),
      generatedAt: new Date().toISOString(),
    },
  });
}
