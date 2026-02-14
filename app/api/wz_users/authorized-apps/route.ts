import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import {
  listLoginProvidersForUser,
  normalizeLoginProvider,
  type LoginProvider,
} from "@/app/api/wz_AuthLogin/_login_providers";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const CONNECTABLE_PROVIDER_ORDER: LoginProvider[] = ["google", "discord"];

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
  auth_provider?: string | null;
  must_create_password?: boolean | string | number | null;
};

type ProviderPayload = {
  id: string;
  provider: "password" | "google" | "discord" | "apple" | "github" | "microsoft" | "unknown";
  providerLabel: string;
  linkedAt: string | null;
  lastLoginAt: string | null;
  linkedEmail: string | null;
  linkedUsername: string | null;
  isPassword: boolean;
  isExternal: boolean;
  isPrimary: boolean;
  canRemove: boolean;
  removeBlockedReason: string | null;
};

type ConnectableProviderPayload = {
  provider: "password" | "google" | "discord" | "apple" | "github" | "microsoft" | "unknown";
  providerLabel: string;
};

type AuthorizedAppsPayload = {
  schemaReady: boolean;
  primaryProvider: LoginProvider;
  creationProvider: LoginProvider;
  mustCreatePassword: boolean;
  providers: ProviderPayload[];
  connectableProviders: ConnectableProviderPayload[];
  summary: {
    linkedProviders: number;
    externalProviders: number;
    hasPasswordProvider: boolean;
    allSupportedConnected: boolean;
    generatedAt: string;
  };
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

function normalizeAuthProviderName(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function readAuthUserHasPasswordProvider(user: unknown) {
  const candidate =
    user && typeof user === "object"
      ? (user as {
          app_metadata?: Record<string, unknown> | null;
          identities?: Array<Record<string, unknown>> | null;
        })
      : null;
  if (!candidate) return false;

  const appProvider = normalizeAuthProviderName(candidate.app_metadata?.provider);
  if (appProvider === "email" || appProvider === "password") {
    return true;
  }

  const appProvidersRaw = candidate.app_metadata?.providers;
  if (Array.isArray(appProvidersRaw)) {
    for (const provider of appProvidersRaw) {
      const normalized = normalizeAuthProviderName(provider);
      if (normalized === "email" || normalized === "password") {
        return true;
      }
    }
  }

  const identities = Array.isArray(candidate.identities) ? candidate.identities : [];
  for (const identity of identities) {
    const provider = normalizeAuthProviderName(identity?.provider);
    if (provider === "email" || provider === "password") {
      return true;
    }
  }

  return false;
}

async function findAuthUserIdByEmail(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string | null;
}) {
  const email = normalizeEmail(params.email);
  if (!email) {
    return {
      lookupOk: false as const,
      authUserId: null as string | null,
    };
  }

  const PER_PAGE = 200;
  const MAX_PAGES = 20;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await params.sb.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) {
      console.error("[authorized-apps] listUsers error:", error);
      return {
        lookupOk: false as const,
        authUserId: null as string | null,
      };
    }

    const users = (data?.users || []) as Array<{
      id?: string | null;
      email?: string | null;
    }>;
    const found = users.find((user) => normalizeEmail(user.email) === email);
    if (found?.id) {
      return {
        lookupOk: true as const,
        authUserId: normalizeText(found.id),
      };
    }
    if (users.length < PER_PAGE) break;
  }

  return {
    lookupOk: true as const,
    authUserId: null as string | null,
  };
}

async function getAuthUserProviderSignals(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  authUserId: string | null;
  email: string | null;
}) {
  let authUserId = normalizeText(params.authUserId);
  if (!authUserId) {
    const byEmail = await findAuthUserIdByEmail({
      sb: params.sb,
      email: params.email,
    });
    if (!byEmail.lookupOk) {
      return {
        lookupOk: false as const,
        authUserId: null as string | null,
        hasPasswordProvider: false,
      };
    }
    authUserId = byEmail.authUserId;
    if (!authUserId) {
      return {
        lookupOk: true as const,
        authUserId: null as string | null,
        hasPasswordProvider: false,
      };
    }
  }

  try {
    const { data, error } = await params.sb.auth.admin.getUserById(authUserId);
    if (error) {
      console.error("[authorized-apps] getUserById error:", error);
      return {
        lookupOk: false as const,
        authUserId: null as string | null,
        hasPasswordProvider: false,
      };
    }

    return {
      lookupOk: true as const,
      authUserId,
      hasPasswordProvider: readAuthUserHasPasswordProvider(data?.user || null),
    };
  } catch (error) {
    console.error("[authorized-apps] getAuthUserProviderSignals error:", error);
    return {
      lookupOk: false as const,
      authUserId: null as string | null,
      hasPasswordProvider: false,
    };
  }
}

async function updateMustCreatePasswordBestEffort(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  mustCreatePassword: boolean;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) return;

  const updateRes = await params.sb
    .from("wz_users")
    .update({ must_create_password: params.mustCreatePassword })
    .eq("id", userId);

  if (!updateRes.error) return;
  if (isMissingColumnError(updateRes.error, "must_create_password")) return;
  console.error("[authorized-apps] must_create_password update error:", updateRes.error);
}

async function cleanupStalePasswordProviderRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) return;

  const deleteRes = await params.sb
    .from("wz_auth_login_providers")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "password");

  if (!deleteRes.error) return;
  if (isLoginProvidersSchemaMissing(deleteRes.error)) return;
  console.error("[authorized-apps] stale password provider cleanup error:", deleteRes.error);
}

function providerLabel(provider: string) {
  const p = normalizeLoginProvider(provider);
  if (p === "password") return "Wyzer Login";
  if (p === "google") return "Google";
  if (p === "discord") return "Discord";
  if (p === "apple") return "Apple";
  if (p === "github") return "GitHub";
  if (p === "microsoft") return "Microsoft";
  return "Desconhecido";
}

function pickProviderUsername(provider: LoginProvider, metadata?: Record<string, unknown> | null) {
  if (!metadata || typeof metadata !== "object") return null;

  const keysByProvider: Record<LoginProvider, string[]> = {
    password: [],
    google: ["fullName", "name", "displayName", "given_name", "username"],
    discord: ["username", "global_name", "display_name", "fullName", "name", "nick", "nickname"],
    apple: ["fullName", "name", "displayName"],
    github: ["username", "login", "name", "fullName"],
    microsoft: ["fullName", "name", "displayName", "username"],
    unknown: ["fullName", "name", "displayName", "username"],
  };

  const keys = keysByProvider[provider] || keysByProvider.unknown;
  for (const key of keys) {
    const raw = metadata[key];
    if (typeof raw !== "string" && typeof raw !== "number") continue;
    const value = normalizeText(String(raw));
    if (value) return value;
  }

  return null;
}

function providerId(provider: string, index: number) {
  return `${normalizeLoginProvider(provider)}-${index + 1}`;
}

function isMissingColumnError(error: unknown, column: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const needle = String(column || "").trim().toLowerCase();
  if (!needle) return false;
  if (code === "42703" || code === "PGRST204") return true;
  return (
    (message.includes(needle) || details.includes(needle)) &&
    (message.includes("column") || details.includes("column"))
  );
}

function isMissingTableError(error: unknown, table: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const needle = String(table || "").trim().toLowerCase();
  if (!needle) return false;
  if (code === "42P01" || code === "PGRST205") return true;
  return (
    (message.includes(needle) || details.includes(needle)) &&
    (message.includes("does not exist") ||
      details.includes("does not exist") ||
      message.includes("relation") ||
      details.includes("relation") ||
      message.includes("table") ||
      details.includes("table"))
  );
}

function isLoginProvidersSchemaMissing(error: unknown) {
  return (
    isMissingTableError(error, "wz_auth_login_providers") ||
    isMissingColumnError(error, "provider") ||
    isMissingColumnError(error, "user_id")
  );
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
        auth_user_id: normalizeText(row.auth_user_id),
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
    auth_user_id: string | null;
    auth_provider: string | null;
    must_create_password: boolean | null;
  }>;
}

function pickBestWzUserRow(
  rows: Array<{
    id: string | null;
    email: string | null;
    auth_user_id: string | null;
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

function mapCreationProviderFromSession(loginMethod: unknown, loginFlow: unknown) {
  const method = String(loginMethod || "").trim().toLowerCase();
  const flow = String(loginFlow || "").trim().toLowerCase();

  if (
    method === "google" ||
    method === "discord" ||
    method === "apple" ||
    method === "github" ||
    method === "microsoft"
  ) {
    return method as LoginProvider;
  }

  if (flow === "register") return "password" as LoginProvider;

  if (
    method === "password" ||
    method === "email_code" ||
    method === "sms_code" ||
    method === "totp" ||
    method === "passkey" ||
    method === "trusted" ||
    method === "exchange" ||
    method === "sync" ||
    method === "unknown"
  ) {
    return "password" as LoginProvider;
  }

  return null;
}

async function resolveCreationProviderFromSessions(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) return null;

  const pickFromRows = (
    rows: Array<{ login_method?: string | null; login_flow?: string | null }>,
  ) => {
    for (const row of rows) {
      const mapped = mapCreationProviderFromSession(row.login_method, row.login_flow);
      if (mapped) return mapped;
    }
    return null;
  };

  const byCreationFlag = await params.sb
    .from("wz_auth_sessions")
    .select("login_method,login_flow,issued_at")
    .eq("user_id", userId)
    .eq("is_account_creation_session", true)
    .order("issued_at", { ascending: true })
    .limit(10);

  if (!byCreationFlag.error) {
    const mapped = pickFromRows(
      (byCreationFlag.data || []) as Array<{ login_method?: string | null; login_flow?: string | null }>,
    );
    if (mapped) return mapped;
  } else if (
    !isMissingTableError(byCreationFlag.error, "wz_auth_sessions") &&
    !isMissingColumnError(byCreationFlag.error, "is_account_creation_session")
  ) {
    console.error("[authorized-apps] creation-session lookup error:", byCreationFlag.error);
  }

  const byEarliestSession = await params.sb
    .from("wz_auth_sessions")
    .select("login_method,login_flow,issued_at")
    .eq("user_id", userId)
    .order("issued_at", { ascending: true })
    .limit(10);

  if (!byEarliestSession.error) {
    return pickFromRows(
      (byEarliestSession.data || []) as Array<{ login_method?: string | null; login_flow?: string | null }>,
    );
  }

  if (!isMissingTableError(byEarliestSession.error, "wz_auth_sessions")) {
    console.error("[authorized-apps] earliest-session lookup error:", byEarliestSession.error);
  }
  return null;
}

function resolveRemoveBlockedReason(params: {
  provider: LoginProvider;
  creationProvider: LoginProvider;
  passwordPinned: boolean;
  isPersistedProvider: boolean;
}) {
  if (params.provider === "password") {
    return "Wyzer Login faz parte do acesso base e nao pode ser removido.";
  }
  if (!params.isPersistedProvider) {
    return "Metodo base da conta e nao pode ser removido.";
  }
  if (params.provider === "unknown") {
    return "Provedor invalido.";
  }
  if (params.provider === params.creationProvider) {
    return "Criado com este provedor e nao pode ser removido.";
  }
  return null;
}

async function buildAuthorizedAppsPayload(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userRow: {
    id: string;
    email: string | null;
    auth_user_id: string | null;
    auth_provider: string | null;
    must_create_password: boolean | null;
  };
}): Promise<AuthorizedAppsPayload> {
  const userId = String(params.userRow.id || "").trim();
  let mustCreatePassword = Boolean(params.userRow.must_create_password);

  const providerRows = await listLoginProvidersForUser({
    sb: params.sb,
    userId,
  });
  const hasPersistedPasswordProvider = providerRows.rows.some(
    (item) => normalizeLoginProvider(item.provider) === "password",
  );
  const authSignals = await getAuthUserProviderSignals({
    sb: params.sb,
    authUserId: params.userRow.auth_user_id,
    email: params.userRow.email,
  });
  if (authSignals.lookupOk) {
    if (authSignals.hasPasswordProvider && mustCreatePassword) {
      mustCreatePassword = false;
      await updateMustCreatePasswordBestEffort({
        sb: params.sb,
        userId,
        mustCreatePassword: false,
      });
    } else if (!authSignals.hasPasswordProvider && !mustCreatePassword) {
      mustCreatePassword = true;
      await updateMustCreatePasswordBestEffort({
        sb: params.sb,
        userId,
        mustCreatePassword: true,
      });
    }
    if (!authSignals.hasPasswordProvider && hasPersistedPasswordProvider) {
      await cleanupStalePasswordProviderRows({
        sb: params.sb,
        userId,
      });
    }
  }
  const creationProviderFromSessions = await resolveCreationProviderFromSessions({
    sb: params.sb,
    userId,
  });

  const authProviderNormalized = normalizeLoginProvider(params.userRow.auth_provider || "unknown");
  let creationProvider: LoginProvider =
    authProviderNormalized !== "unknown"
      ? authProviderNormalized
      : creationProviderFromSessions || "unknown";

  if (creationProvider === "unknown") {
    const firstLinkedProvider = [...providerRows.rows]
      .map((row) => ({
        provider: normalizeLoginProvider(row.provider),
        linkedAtMs: Date.parse(String(row.linkedAt || "")) || Number.MAX_SAFE_INTEGER,
      }))
      .filter((row) => row.provider !== "unknown")
      .sort((a, b) => a.linkedAtMs - b.linkedAtMs)[0];

    if (firstLinkedProvider?.provider) {
      creationProvider = firstLinkedProvider.provider;
    }
  }

  if (creationProvider === "unknown") {
    creationProvider = "password";
  }

  const primaryProvider: LoginProvider = creationProvider;
  const passwordPinned = !mustCreatePassword;

  const providers: ProviderPayload[] = [];
  const seen = new Set<string>();

  for (const row of providerRows.rows) {
    const provider = normalizeLoginProvider(row.provider);
    if (provider === "password" && authSignals.lookupOk && !authSignals.hasPasswordProvider) {
      // Evita exibir "Wyzer Login" stale quando a senha local nao existe no Auth.
      continue;
    }
    const key = `${provider}:${row.providerUserId || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const removeBlockedReason = resolveRemoveBlockedReason({
      provider,
      creationProvider,
      passwordPinned,
      isPersistedProvider: true,
    });

    providers.push({
      id: row.id,
      provider,
      providerLabel: providerLabel(provider),
      linkedAt: normalizeIso(row.linkedAt),
      lastLoginAt: normalizeIso(row.lastLoginAt),
      linkedEmail: normalizeEmail(row.email),
      linkedUsername: pickProviderUsername(provider, row.metadata),
      isPassword: provider === "password",
      isExternal: provider !== "password",
      isPrimary: provider === primaryProvider,
      canRemove: !removeBlockedReason,
      removeBlockedReason,
    });
  }

  if (!providers.some((item) => item.provider === primaryProvider)) {
    const removeBlockedReason = resolveRemoveBlockedReason({
      provider: primaryProvider,
      creationProvider,
      passwordPinned,
      isPersistedProvider: false,
    });
    providers.push({
      id: providerId(primaryProvider, providers.length),
      provider: primaryProvider,
      providerLabel: providerLabel(primaryProvider),
      linkedAt: null,
      lastLoginAt: null,
      linkedEmail: null,
      linkedUsername: null,
      isPassword: primaryProvider === "password",
      isExternal: primaryProvider !== "password",
      isPrimary: true,
      canRemove: false,
      removeBlockedReason,
    });
  }

  if (!mustCreatePassword && !providers.some((item) => item.provider === "password")) {
    const removeBlockedReason = resolveRemoveBlockedReason({
      provider: "password",
      creationProvider,
      passwordPinned,
      isPersistedProvider: false,
    });
    providers.push({
      id: providerId("password", providers.length),
      provider: "password",
      providerLabel: "Wyzer Login",
      linkedAt: null,
      lastLoginAt: null,
      linkedEmail: null,
      linkedUsername: null,
      isPassword: true,
      isExternal: false,
      isPrimary: primaryProvider === "password",
      canRemove: false,
      removeBlockedReason,
    });
  }

  providers.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    const aMs = Date.parse(String(a.lastLoginAt || a.linkedAt || "")) || 0;
    const bMs = Date.parse(String(b.lastLoginAt || b.linkedAt || "")) || 0;
    if (aMs !== bMs) return bMs - aMs;
    return a.provider.localeCompare(b.provider);
  });

  const connectedProviderSet = new Set<LoginProvider>(
    providers.map((provider) => normalizeLoginProvider(provider.provider)),
  );
  const connectableProviders: ConnectableProviderPayload[] = CONNECTABLE_PROVIDER_ORDER.filter(
    (provider) => !connectedProviderSet.has(provider),
  ).map((provider) => ({
    provider,
    providerLabel: providerLabel(provider),
  }));

  return {
    schemaReady: providerRows.schemaReady,
    primaryProvider,
    creationProvider,
    mustCreatePassword,
    providers,
    connectableProviders,
    summary: {
      linkedProviders: providers.length,
      externalProviders: providers.filter((item) => item.isExternal).length,
      hasPasswordProvider: providers.some((item) => item.provider === "password"),
      allSupportedConnected: connectableProviders.length === 0,
      generatedAt: new Date().toISOString(),
    },
  };
}

function okJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

async function getSessionAndUserRow(req: NextRequest) {
  const session = await readActiveSessionFromRequest(req, { seedIfMissing: false });
  if (!session) {
    return { error: okJson({ ok: false, error: "Nao autenticado." }, 401) };
  }

  const userId = String(session.userId || "").trim();
  const email = normalizeEmail(session.email);
  if (!userId || !email) {
    return { error: okJson({ ok: false, error: "Sessao invalida." }, 401) };
  }

  const sb = supabaseAdmin();
  const userRow = await findWzUserRow({
    sb,
    userId,
    email,
  });
  if (!userRow?.id) {
    return { error: okJson({ ok: false, error: "Usuario nao encontrado." }, 404) };
  }

  return {
    sb,
    userRow: {
      id: String(userRow.id),
      email: userRow.email || null,
      auth_user_id: userRow.auth_user_id || null,
      auth_provider: userRow.auth_provider || null,
      must_create_password: userRow.must_create_password ?? null,
    },
  };
}

export async function GET(req: NextRequest) {
  const context = await getSessionAndUserRow(req);
  if ("error" in context) return context.error;

  const payload = await buildAuthorizedAppsPayload({
    sb: context.sb,
    userRow: context.userRow,
  });

  return okJson({
    ok: true,
    ...payload,
  });
}

export async function POST(req: NextRequest) {
  const context = await getSessionAndUserRow(req);
  if ("error" in context) return context.error;

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    provider?: string;
  };
  const action = String(body?.action || "").trim().toLowerCase();
  if (action !== "remove-provider") {
    return okJson({ ok: false, error: "Acao invalida." }, 400);
  }

  const provider = normalizeLoginProvider(body?.provider);
  if (provider === "unknown") {
    return okJson({ ok: false, error: "Provedor invalido." }, 400);
  }
  if (provider === "password") {
    return okJson(
      { ok: false, error: "Wyzer Login faz parte do acesso base e nao pode ser removido." },
      400,
    );
  }

  const current = await buildAuthorizedAppsPayload({
    sb: context.sb,
    userRow: context.userRow,
  });
  const currentProvider = current.providers.find((item) => item.provider === provider);
  if (!currentProvider) {
    return okJson({ ok: false, error: "Provedor nao encontrado." }, 404);
  }
  if (!currentProvider.canRemove) {
    return okJson(
      {
        ok: false,
        error: currentProvider.removeBlockedReason || "Este provedor nao pode ser removido.",
      },
      400,
    );
  }
  if (!current.schemaReady) {
    return okJson(
      { ok: false, error: "Schema de provedores nao disponivel para remocao." },
      409,
    );
  }

  const deleteRes = await context.sb
    .from("wz_auth_login_providers")
    .delete()
    .eq("user_id", context.userRow.id)
    .eq("provider", provider);

  if (deleteRes.error) {
    if (isLoginProvidersSchemaMissing(deleteRes.error)) {
      return okJson(
        { ok: false, error: "Schema de provedores nao disponivel para remocao." },
        409,
      );
    }
    console.error("[authorized-apps] remove provider error:", deleteRes.error);
    return okJson({ ok: false, error: "Nao foi possivel remover o provedor." }, 500);
  }

  const updated = await buildAuthorizedAppsPayload({
    sb: context.sb,
    userRow: context.userRow,
  });

  return okJson({
    ok: true,
    removedProvider: provider,
    ...updated,
  });
}
