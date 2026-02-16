import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import {
  listLoginProvidersForUser,
  normalizeLoginProvider,
  upsertLoginProviderRecord,
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

type ExternalProvider = "google" | "apple" | "github";

type WzUserCandidateRow = {
  id: string | null;
  email: string | null;
  auth_user_id: string | null;
  auth_provider: string | null;
  must_create_password: boolean | null;
  password_created: boolean | null;
  updated_at: string | null;
  created_at: string | null;
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

function parseIsoMs(value?: string | null) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeExternalProvider(value: unknown): ExternalProvider | null {
  const provider = normalizeLoginProvider(String(value || ""));
  if (provider === "google" || provider === "apple" || provider === "github") {
    return provider;
  }
  return null;
}

function providerLabel(provider?: ExternalProvider | null) {
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  if (provider === "github") return "GitHub";
  return null;
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
  if (!email) return null;

  const PER_PAGE = 200;
  const MAX_PAGES = 20;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await params.sb.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) {
      console.error("[password-state] listUsers error:", error);
      return null;
    }

    const users = (data?.users || []) as Array<{
      id?: string | null;
      email?: string | null;
    }>;
    const found = users.find((user) => normalizeEmail(user.email) === email);
    if (found?.id) {
      return normalizeText(found.id);
    }
    if (users.length < PER_PAGE) break;
  }

  return null;
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: "id" | "auth_user_id" | "email";
  value: string;
  mode: "eq" | "ilike";
}) {
  const columnsToTry = [
    "id,email,auth_user_id,auth_provider,must_create_password,password_created,updated_at,created_at",
    "id,email,auth_user_id,auth_provider,must_create_password,password_created,created_at",
    "id,email,auth_user_id,auth_provider,must_create_password,password_created",
    "id,email,auth_user_id,auth_provider,must_create_password",
    "id,email,auth_user_id,auth_provider",
    "id,email,auth_user_id,must_create_password",
    "id,email,auth_provider,must_create_password",
    "id,email,must_create_password",
    "id,email",
  ];

  for (const columns of columnsToTry) {
    const base = params.sb.from("wz_users").select(columns).limit(20);
    const res =
      params.mode === "ilike"
        ? await base.ilike(params.column, params.value)
        : await base.eq(params.column, params.value);

    if (!res.error) {
      const rows = (res.data || []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: normalizeText(String(row.id || "")),
        email: normalizeEmail(String(row.email || "")),
        auth_user_id: normalizeText(String(row.auth_user_id || "")),
        auth_provider: normalizeText(String(row.auth_provider || "")),
        must_create_password:
          typeof row.must_create_password === "undefined"
            ? null
            : normalizeBoolean(row.must_create_password),
        password_created:
          typeof row.password_created === "undefined"
            ? null
            : normalizeBoolean(row.password_created),
        updated_at: normalizeIso(String(row.updated_at || "")),
        created_at: normalizeIso(String(row.created_at || "")),
      })) as WzUserCandidateRow[];
    }

    const knownMissingColumns = [
      "auth_user_id",
      "auth_provider",
      "must_create_password",
      "password_created",
      "updated_at",
      "created_at",
      "email",
      "id",
    ].some((column) => isMissingColumnError(res.error, column));
    if (!knownMissingColumns) {
      console.error("[password-state] query wz_users error:", res.error);
      break;
    }
  }

  return [] as WzUserCandidateRow[];
}

function dedupeRows(rows: WzUserCandidateRow[]) {
  const byId = new Map<string, WzUserCandidateRow>();
  const anonymous: WzUserCandidateRow[] = [];

  for (const row of rows) {
    const id = normalizeText(row.id);
    if (!id) {
      anonymous.push(row);
      continue;
    }

    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, row);
      continue;
    }

    const prevRank = parseIsoMs(prev.updated_at || prev.created_at);
    const nextRank = parseIsoMs(row.updated_at || row.created_at);
    if (nextRank >= prevRank) {
      byId.set(id, row);
    }
  }

  return [...byId.values(), ...anonymous];
}

function scoreCandidateRow(params: {
  row: WzUserCandidateRow;
  sessionUserId: string;
  sessionEmail: string;
  resolvedAuthUserId: string | null;
}) {
  const rowId = normalizeText(params.row.id);
  const rowAuthUserId = normalizeText(params.row.auth_user_id);
  const rowEmail = normalizeEmail(params.row.email);

  let score = 0;
  if (rowId && rowId === params.sessionUserId) score += 1200;
  if (rowAuthUserId && rowAuthUserId === params.sessionUserId) score += 1000;
  if (rowAuthUserId && params.resolvedAuthUserId && rowAuthUserId === params.resolvedAuthUserId) {
    score += 900;
  }
  if (rowEmail && rowEmail === params.sessionEmail) score += 800;
  if (params.row.password_created === true) score += 80;
  if (params.row.must_create_password === false) score += 60;

  const updatedRank = parseIsoMs(params.row.updated_at);
  const createdRank = parseIsoMs(params.row.created_at);
  return { score, updatedRank, createdRank };
}

function chooseCanonicalRow(params: {
  rows: WzUserCandidateRow[];
  sessionUserId: string;
  sessionEmail: string;
  resolvedAuthUserId: string | null;
}) {
  if (!params.rows.length) return null;

  const sorted = [...params.rows].sort((a, b) => {
    const aRank = scoreCandidateRow({
      row: a,
      sessionUserId: params.sessionUserId,
      sessionEmail: params.sessionEmail,
      resolvedAuthUserId: params.resolvedAuthUserId,
    });
    const bRank = scoreCandidateRow({
      row: b,
      sessionUserId: params.sessionUserId,
      sessionEmail: params.sessionEmail,
      resolvedAuthUserId: params.resolvedAuthUserId,
    });
    if (aRank.score !== bRank.score) return bRank.score - aRank.score;
    if (aRank.updatedRank !== bRank.updatedRank) return bRank.updatedRank - aRank.updatedRank;
    if (aRank.createdRank !== bRank.createdRank) return bRank.createdRank - aRank.createdRank;
    return 0;
  });

  return sorted[0] || null;
}

async function resolveAuthPasswordSignals(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  possibleAuthUserIds: string[];
  email: string | null;
}) {
  const uniqueCandidateIds = Array.from(
    new Set(
      params.possibleAuthUserIds
        .map((value) => normalizeText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  for (const candidateId of uniqueCandidateIds) {
    try {
      const { data, error } = await params.sb.auth.admin.getUserById(candidateId);
      if (error) continue;
      return {
        lookupOk: true as const,
        authUserId: candidateId,
        hasPasswordProvider: readAuthUserHasPasswordProvider(data?.user || null),
      };
    } catch {
      continue;
    }
  }

  const byEmail = await findAuthUserIdByEmail({
    sb: params.sb,
    email: params.email,
  });
  if (!byEmail) {
    return {
      lookupOk: true as const,
      authUserId: null as string | null,
      hasPasswordProvider: false,
    };
  }

  try {
    const { data, error } = await params.sb.auth.admin.getUserById(byEmail);
    if (error) {
      return {
        lookupOk: false as const,
        authUserId: byEmail,
        hasPasswordProvider: false,
      };
    }
    return {
      lookupOk: true as const,
      authUserId: byEmail,
      hasPasswordProvider: readAuthUserHasPasswordProvider(data?.user || null),
    };
  } catch {
    return {
      lookupOk: false as const,
      authUserId: byEmail,
      hasPasswordProvider: false,
    };
  }
}

async function updateWzUsersFlagsBestEffort(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userIds: string[];
  patch: Record<string, unknown>;
}) {
  const userIds = Array.from(
    new Set(
      params.userIds
        .map((value) => normalizeText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  if (!userIds.length) return;

  for (const userId of userIds) {
    const patch = { ...params.patch };
    if (!Object.keys(patch).length) continue;

    while (Object.keys(patch).length) {
      const updateRes = await params.sb.from("wz_users").update(patch).eq("id", userId);
      if (!updateRes.error) break;

      let removedAny = false;
      for (const key of Object.keys(patch)) {
        if (isMissingColumnError(updateRes.error, key)) {
          delete patch[key];
          removedAny = true;
        }
      }
      if (removedAny) continue;

      console.error("[password-state] wz_users patch error:", updateRes.error);
      break;
    }
  }
}

function pickPrimaryProvider(params: {
  authProvider: string | null;
  hasPasswordFingerprint: boolean;
  firstExternalProvider: ExternalProvider | null;
}) {
  const byColumn = normalizeLoginProvider(params.authProvider || "unknown");
  if (byColumn !== "unknown") {
    if (byColumn === "password" && !params.hasPasswordFingerprint && params.firstExternalProvider) {
      return params.firstExternalProvider;
    }
    return byColumn;
  }
  if (params.firstExternalProvider) return params.firstExternalProvider;
  return params.hasPasswordFingerprint ? ("password" as LoginProvider) : ("unknown" as LoginProvider);
}

export async function GET(req: NextRequest) {
  try {
    const session = await readActiveSessionFromRequest(req, { seedIfMissing: false });
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Nao autenticado." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const sessionUserId = normalizeText(String(session.userId || ""));
    const sessionEmail = normalizeEmail(session.email);
    if (!sessionUserId || !sessionEmail) {
      return NextResponse.json(
        { ok: false, error: "Sessao invalida." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const sb = supabaseAdmin();

    const byId = await queryWzUsersRows({
      sb,
      column: "id",
      value: sessionUserId,
      mode: "eq",
    });
    const byAuthUserId = await queryWzUsersRows({
      sb,
      column: "auth_user_id",
      value: sessionUserId,
      mode: "eq",
    });
    const byEmail = await queryWzUsersRows({
      sb,
      column: "email",
      value: sessionEmail,
      mode: "ilike",
    });

    const allRows = dedupeRows([...byId, ...byAuthUserId, ...byEmail]);
    if (!allRows.length) {
      return NextResponse.json(
        {
          ok: true,
          resolvedUserId: null,
          primaryProvider: "password",
          providerForSetup: null,
          providerLabel: null,
          mustCreatePassword: false,
          passwordCreated: true,
          checkedAt: new Date().toISOString(),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const authUserIdsFromRows = Array.from(
      new Set(
        allRows
          .map((row) => normalizeText(row.auth_user_id))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const earlyAuthSignals = await resolveAuthPasswordSignals({
      sb,
      possibleAuthUserIds: [sessionUserId, ...authUserIdsFromRows],
      email: sessionEmail,
    });
    const resolvedAuthUserId = normalizeText(earlyAuthSignals.authUserId);

    const canonicalRow = chooseCanonicalRow({
      rows: allRows,
      sessionUserId,
      sessionEmail,
      resolvedAuthUserId,
    });
    if (!canonicalRow?.id) {
      return NextResponse.json(
        {
          ok: true,
          resolvedUserId: null,
          primaryProvider: "password",
          providerForSetup: null,
          providerLabel: null,
          mustCreatePassword: false,
          passwordCreated: true,
          checkedAt: new Date().toISOString(),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const candidateUserIds = Array.from(
      new Set(
        allRows
          .map((row) => normalizeText(row.id))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const providerRows: Array<{
      provider: LoginProvider;
      linkedAt: string | null;
      lastLoginAt: string | null;
    }> = [];
    let providerSchemaReady = true;
    for (const userId of candidateUserIds) {
      const listed = await listLoginProvidersForUser({ sb, userId });
      if (!listed.schemaReady) {
        providerSchemaReady = false;
        continue;
      }
      for (const row of listed.rows) {
        providerRows.push({
          provider: normalizeLoginProvider(row.provider),
          linkedAt: normalizeIso(row.linkedAt),
          lastLoginAt: normalizeIso(row.lastLoginAt),
        });
      }
    }

    const hasPersistedPasswordProvider = providerRows.some(
      (row) => row.provider === "password",
    );
    const firstExternalProvider = [...providerRows]
      .map((row) => ({
        provider: normalizeExternalProvider(row.provider),
        rank: parseIsoMs(row.lastLoginAt || row.linkedAt),
      }))
      .filter((row): row is { provider: ExternalProvider; rank: number } => Boolean(row.provider))
      .sort((a, b) => b.rank - a.rank)[0]?.provider || null;

    const hasAuthPasswordProvider = Boolean(earlyAuthSignals.hasPasswordProvider);
    const hasPasswordByProfileFlags =
      canonicalRow.password_created === true || canonicalRow.must_create_password === false;
    const hasPasswordFingerprint =
      hasPasswordByProfileFlags || hasPersistedPasswordProvider || hasAuthPasswordProvider;

    if (hasPasswordFingerprint) {
      await updateWzUsersFlagsBestEffort({
        sb,
        userIds: candidateUserIds,
        patch: {
          must_create_password: false,
          password_created: true,
        },
      });

      if (
        providerSchemaReady &&
        !hasPersistedPasswordProvider &&
        canonicalRow.id &&
        canonicalRow.email
      ) {
        await upsertLoginProviderRecord({
          sb,
          userId: canonicalRow.id,
          authUserId: resolvedAuthUserId || canonicalRow.auth_user_id || null,
          email: canonicalRow.email,
          provider: "password",
          metadata: {
            source: "password_state_sync",
          },
        });
      }
    }

    const providerForSetup =
      normalizeExternalProvider(canonicalRow.auth_provider) || firstExternalProvider;
    const shouldRequireSetup =
      !hasPasswordFingerprint &&
      (canonicalRow.must_create_password === true || canonicalRow.password_created === false) &&
      Boolean(providerForSetup);

    const primaryProvider = pickPrimaryProvider({
      authProvider: canonicalRow.auth_provider,
      hasPasswordFingerprint,
      firstExternalProvider,
    });

    return NextResponse.json(
      {
        ok: true,
        resolvedUserId: canonicalRow.id,
        primaryProvider,
        providerForSetup,
        providerLabel: providerLabel(providerForSetup),
        mustCreatePassword: shouldRequireSetup,
        passwordCreated: hasPasswordFingerprint,
        checkedAt: new Date().toISOString(),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (isMissingTableError(error, "wz_users")) {
      return NextResponse.json(
        {
          ok: true,
          resolvedUserId: null,
          primaryProvider: "password",
          providerForSetup: null,
          providerLabel: null,
          mustCreatePassword: false,
          passwordCreated: true,
          checkedAt: new Date().toISOString(),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    console.error("[password-state] error:", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao carregar estado de senha." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
