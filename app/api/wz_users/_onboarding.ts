import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

export type OnboardingUiStep =
  | "welcome"
  | "company"
  | "goal"
  | "team"
  | "ai"
  | "whatsapp"
  | "improve"
  | "final";

export type OnboardingRecord = {
  id: string;
  userId: string;
  authUserId: string | null;
  email: string;
  companyName: string | null;
  companyLogoUrl: string | null;
  companyCnpj: string | null;
  industry: string | null;
  welcomeConfirmed: boolean;
  teamAgentsCount: number | null;
  whatsappConnected: boolean;
  whatsappConnectedAt: string | null;
  whatsappPairingCode: string | null;
  whatsappPairingExpiresAt: string | null;
  uiStep: OnboardingUiStep;
  completed: boolean;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
  user_id?: string | null;
};

type WzOnboardingRow = {
  id?: string | null;
  user_id?: string | null;
  auth_user_id?: string | null;
  email?: string | null;
  company_name?: string | null;
  company_logo_url?: string | null;
  company_cnpj?: string | null;
  industry?: string | null;
  welcome_confirmed?: boolean | string | number | null;
  team_agents_count?: number | string | null;
  whatsapp_connected?: boolean | string | number | null;
  whatsapp_connected_at?: string | null;
  whatsapp_pairing_code?: string | null;
  whatsapp_pairing_expires_at?: string | null;
  ui_step?: string | null;
  completed?: boolean | string | number | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const ONBOARDING_SCHEMA_HINT =
  "Estrutura de onboarding nao encontrada. Execute o SQL de onboarding em /sql e tente novamente.";

const ONBOARDING_ALLOWED_STEPS = new Set<OnboardingUiStep>([
  "welcome",
  "company",
  "goal",
  "team",
  "ai",
  "whatsapp",
  "improve",
  "final",
]);

export function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeOptionalText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

export function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "true" || clean === "t" || clean === "1";
  }
  return false;
}

export function normalizeIsoDatetime(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.trunc(value);
    return rounded >= 0 ? rounded : null;
  }
  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return null;
    const parsed = Number.parseInt(clean, 10);
    if (!Number.isFinite(parsed)) return null;
    return parsed >= 0 ? parsed : null;
  }
  return null;
}

function normalizeOnboardingUiStep(value?: string | null): OnboardingUiStep {
  const clean = String(value || "").trim().toLowerCase();
  if (ONBOARDING_ALLOWED_STEPS.has(clean as OnboardingUiStep)) {
    return clean as OnboardingUiStep;
  }
  return "company";
}

export function normalizeCnpjDigits(value?: string | null) {
  const digits = String(value || "").replace(/\D+/g, "");
  return digits || null;
}

function isMissingColumnError(error: unknown, column: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  const needle = String(column || "").trim().toLowerCase();
  if (!needle) return false;
  if (code === "42703" || code === "PGRST204") return true;
  return (
    (message.includes(needle) || details.includes(needle) || hint.includes(needle)) &&
    (message.includes("column") || details.includes("column") || hint.includes("column"))
  );
}

function isMissingTableError(error: unknown, table: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  const needle = String(table || "").trim().toLowerCase();
  if (!needle) return false;
  if (code === "42P01" || code === "PGRST205") return true;
  return (
    (message.includes(needle) || details.includes(needle) || hint.includes(needle)) &&
    (message.includes("does not exist") ||
      details.includes("does not exist") ||
      hint.includes("does not exist") ||
      message.includes("relation") ||
      details.includes("relation") ||
      hint.includes("relation") ||
      message.includes("table") ||
      details.includes("table") ||
      hint.includes("table"))
  );
}

function isUniqueViolation(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key");
}

export function isOnboardingSchemaError(error: unknown) {
  return (
    isMissingTableError(error, "wz_onboarding") ||
    isMissingColumnError(error, "user_id") ||
    isMissingColumnError(error, "auth_user_id") ||
    isMissingColumnError(error, "email")
  );
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const columnsToTry = [
    "id,email,auth_user_id,user_id",
    "id,email,auth_user_id",
    "id,email,user_id",
    "id,email",
    "id",
  ];

  for (const columns of columnsToTry) {
    const base = params.sb.from("wz_users").select(columns).limit(8);
    const res =
      params.mode === "ilike"
        ? await base.ilike(params.column, params.value)
        : await base.eq(params.column, params.value);

    if (!res.error) {
      return (res.data || []) as WzUserRow[];
    }
  }

  return [] as WzUserRow[];
}

function pickBestWzUserRow(rows: WzUserRow[], expectedEmail?: string | null) {
  if (!rows.length) return null;
  const normalizedExpected = normalizeEmail(expectedEmail);
  if (normalizedExpected) {
    const exactByEmail = rows.find((row) => normalizeEmail(row.email) === normalizedExpected);
    if (exactByEmail?.id) return exactByEmail;
  }

  const byAuth = rows.find((row) => normalizeOptionalText(row.auth_user_id) && row.id);
  if (byAuth) return byAuth;

  const firstWithId = rows.find((row) => normalizeOptionalText(row.id));
  return firstWithId || null;
}

async function findWzUserRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  sessionEmail: string;
}) {
  if (params.sessionEmail) {
    const rowsByEmail = await queryWzUsersRows({
      sb: params.sb,
      column: "email",
      value: params.sessionEmail,
      mode: "ilike",
    });
    const byEmail = pickBestWzUserRow(rowsByEmail, params.sessionEmail);
    if (byEmail?.id) return byEmail;
  }

  if (params.sessionUserId) {
    const rowsByAuth = await queryWzUsersRows({
      sb: params.sb,
      column: "auth_user_id",
      value: params.sessionUserId,
      mode: "eq",
    });
    const byAuth = pickBestWzUserRow(rowsByAuth, params.sessionEmail);
    if (byAuth?.id) return byAuth;

    const rowsByUser = await queryWzUsersRows({
      sb: params.sb,
      column: "user_id",
      value: params.sessionUserId,
      mode: "eq",
    });
    const byUser = pickBestWzUserRow(rowsByUser, params.sessionEmail);
    if (byUser?.id) return byUser;

    const rowsById = await queryWzUsersRows({
      sb: params.sb,
      column: "id",
      value: params.sessionUserId,
      mode: "eq",
    });
    const byId = pickBestWzUserRow(rowsById, params.sessionEmail);
    if (byId?.id) return byId;
  }

  return null;
}

const ONBOARDING_COLUMNS_TO_TRY = [
  "id,user_id,auth_user_id,email,company_name,company_logo_url,company_cnpj,industry,welcome_confirmed,team_agents_count,whatsapp_connected,whatsapp_connected_at,whatsapp_pairing_code,whatsapp_pairing_expires_at,ui_step,completed,completed_at,created_at,updated_at",
  "id,user_id,auth_user_id,email,welcome_confirmed,team_agents_count,whatsapp_connected,whatsapp_connected_at,ui_step,created_at,updated_at",
  "id,user_id,auth_user_id,email,whatsapp_connected,ui_step,created_at,updated_at",
];

async function queryOnboardingBy(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: "user_id" | "auth_user_id" | "email";
  value: string;
}) {
  const value = String(params.value || "").trim();
  if (!value) return { ok: true as const, row: null as WzOnboardingRow | null };

  for (const columns of ONBOARDING_COLUMNS_TO_TRY) {
    const base = params.sb.from("wz_onboarding").select(columns).limit(1);
    const res =
      params.column === "email"
        ? await base.ilike(params.column, value).maybeSingle()
        : await base.eq(params.column, value).maybeSingle();

    if (!res.error) {
      return {
        ok: true as const,
        row: (res.data || null) as WzOnboardingRow | null,
      };
    }

    if (!isMissingColumnError(res.error, "company_name")) {
      if (isOnboardingSchemaError(res.error)) {
        return {
          ok: false as const,
          schemaReady: false,
          error: res.error,
        };
      }
    }
  }

  return {
    ok: false as const,
    schemaReady: false,
    error: new Error(ONBOARDING_SCHEMA_HINT),
  };
}

function mapOnboardingRow(
  row: WzOnboardingRow,
  defaults: {
    userId: string;
    authUserId: string | null;
    email: string;
  },
): OnboardingRecord {
  const id = normalizeOptionalText(row.id) || cryptoRandomId();
  const userId = normalizeOptionalText(row.user_id) || defaults.userId;
  const authUserId = normalizeOptionalText(row.auth_user_id) || defaults.authUserId;
  const email = normalizeEmail(row.email) || defaults.email;

  return {
    id,
    userId,
    authUserId,
    email,
    companyName: normalizeOptionalText(row.company_name),
    companyLogoUrl: normalizeOptionalText(row.company_logo_url),
    companyCnpj: normalizeCnpjDigits(row.company_cnpj),
    industry: normalizeOptionalText(row.industry),
    welcomeConfirmed: normalizeBoolean(row.welcome_confirmed),
    teamAgentsCount: normalizeInteger(row.team_agents_count),
    whatsappConnected: normalizeBoolean(row.whatsapp_connected),
    whatsappConnectedAt: normalizeIsoDatetime(row.whatsapp_connected_at),
    whatsappPairingCode: normalizeOptionalText(row.whatsapp_pairing_code),
    whatsappPairingExpiresAt: normalizeIsoDatetime(row.whatsapp_pairing_expires_at),
    uiStep: normalizeOnboardingUiStep(row.ui_step),
    completed: normalizeBoolean(row.completed),
    completedAt: normalizeIsoDatetime(row.completed_at),
    createdAt: normalizeIsoDatetime(row.created_at),
    updatedAt: normalizeIsoDatetime(row.updated_at),
  };
}

function cryptoRandomId() {
  return `tmp_${Math.random().toString(36).slice(2, 12)}`;
}

async function createOnboardingRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  authUserId: string;
  email: string;
}) {
  const payload = {
    user_id: params.userId,
    auth_user_id: params.authUserId,
    email: params.email,
    ui_step: "company",
    welcome_confirmed: true,
    whatsapp_connected: false,
    completed: false,
  };

  const { data, error } = await params.sb
    .from("wz_onboarding")
    .insert(payload)
    .select(ONBOARDING_COLUMNS_TO_TRY[0])
    .single();

  if (!error) {
    return {
      ok: true as const,
      row: data as WzOnboardingRow,
    };
  }

  if (isUniqueViolation(error)) {
    const byUser = await queryOnboardingBy({
      sb: params.sb,
      column: "user_id",
      value: params.userId,
    });
    if (byUser.ok && byUser.row) {
      return {
        ok: true as const,
        row: byUser.row,
      };
    }
  }

  if (isOnboardingSchemaError(error)) {
    return {
      ok: false as const,
      schemaReady: false,
      error,
    };
  }

  return {
    ok: false as const,
    schemaReady: true,
    error,
  };
}

export async function ensureOnboardingRecord(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  sessionEmail: string;
}) {
  const sessionUserId = normalizeOptionalText(params.sessionUserId);
  const sessionEmail = normalizeEmail(params.sessionEmail);

  if (!sessionUserId || !sessionEmail) {
    return {
      ok: false as const,
      schemaReady: true,
      error: new Error("Sessao invalida para onboarding."),
    };
  }

  const wzUser = await findWzUserRow({
    sb: params.sb,
    sessionUserId,
    sessionEmail,
  });

  const resolvedUserId = normalizeOptionalText(wzUser?.id) || sessionUserId;
  const resolvedAuthUserId = sessionUserId;
  const resolvedEmail = sessionEmail;

  const byUser = await queryOnboardingBy({
    sb: params.sb,
    column: "user_id",
    value: resolvedUserId,
  });
  if (!byUser.ok) return byUser;
  if (byUser.row) {
    return {
      ok: true as const,
      record: mapOnboardingRow(byUser.row, {
        userId: resolvedUserId,
        authUserId: resolvedAuthUserId,
        email: resolvedEmail,
      }),
    };
  }

  const byAuth = await queryOnboardingBy({
    sb: params.sb,
    column: "auth_user_id",
    value: resolvedAuthUserId,
  });
  if (!byAuth.ok) return byAuth;
  if (byAuth.row) {
    return {
      ok: true as const,
      record: mapOnboardingRow(byAuth.row, {
        userId: resolvedUserId,
        authUserId: resolvedAuthUserId,
        email: resolvedEmail,
      }),
    };
  }

  const byEmail = await queryOnboardingBy({
    sb: params.sb,
    column: "email",
    value: resolvedEmail,
  });
  if (!byEmail.ok) return byEmail;
  if (byEmail.row) {
    return {
      ok: true as const,
      record: mapOnboardingRow(byEmail.row, {
        userId: resolvedUserId,
        authUserId: resolvedAuthUserId,
        email: resolvedEmail,
      }),
    };
  }

  const created = await createOnboardingRow({
    sb: params.sb,
    userId: resolvedUserId,
    authUserId: resolvedAuthUserId,
    email: resolvedEmail,
  });
  if (!created.ok) return created;

  return {
    ok: true as const,
    record: mapOnboardingRow(created.row, {
      userId: resolvedUserId,
      authUserId: resolvedAuthUserId,
      email: resolvedEmail,
    }),
  };
}

export async function patchOnboardingRecord(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  recordId: string;
  patch: Record<string, unknown>;
}) {
  const recordId = normalizeOptionalText(params.recordId);
  if (!recordId) {
    return {
      ok: false as const,
      schemaReady: true,
      error: new Error("Registro de onboarding invalido."),
    };
  }

  const patch = { ...params.patch };
  if (!Object.keys(patch).length) {
    return {
      ok: false as const,
      schemaReady: true,
      error: new Error("Nenhuma alteracao informada."),
    };
  }

  const { data, error } = await params.sb
    .from("wz_onboarding")
    .update(patch)
    .eq("id", recordId)
    .select(ONBOARDING_COLUMNS_TO_TRY[0])
    .single();

  if (!error) {
    return {
      ok: true as const,
      row: data as WzOnboardingRow,
    };
  }

  if (isOnboardingSchemaError(error)) {
    return {
      ok: false as const,
      schemaReady: false,
      error,
    };
  }

  return {
    ok: false as const,
    schemaReady: true,
    error,
  };
}

