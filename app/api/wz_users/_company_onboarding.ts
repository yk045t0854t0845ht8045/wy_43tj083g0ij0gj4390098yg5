import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  ensureOnboardingRecord,
  normalizeBoolean,
  normalizeCnpjDigits,
  normalizeEmail,
  normalizeIsoDatetime,
  normalizeOptionalText,
  type OnboardingUiStep,
} from "@/app/api/wz_users/_onboarding";

export type CompanyOnboardingRecord = {
  id: string;
  primaryOnboardingId: string | null;
  userId: string;
  authUserId: string | null;
  email: string;
  companyName: string | null;
  companyLogoUrl: string | null;
  companyCnpj: string | null;
  industry: string | null;
  isOnlineBusiness: boolean;
  companyAddress: string | null;
  companyCity: string | null;
  companyState: string | null;
  companyPostalCode: string | null;
  welcomeConfirmed: boolean;
  teamAgentsCount: number | null;
  onboardingGoal: string | null;
  monthlyConversationsTier: string | null;
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

type WzCompanyOnboardingRow = {
  id?: string | null;
  primary_onboarding_id?: string | null;
  user_id?: string | null;
  auth_user_id?: string | null;
  email?: string | null;
  company_name?: string | null;
  company_logo_url?: string | null;
  company_cnpj?: string | null;
  industry?: string | null;
  is_online_business?: boolean | string | number | null;
  company_address?: string | null;
  company_city?: string | null;
  company_state?: string | null;
  company_postal_code?: string | null;
  welcome_confirmed?: boolean | string | number | null;
  team_agents_count?: number | string | null;
  onboarding_goal?: string | null;
  monthly_conversations_tier?: string | null;
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

const COMPANY_ONBOARDING_TABLE = "wz_company_onboarding";
const COMPANY_ONBOARDING_COLUMNS =
  "id,primary_onboarding_id,user_id,auth_user_id,email,company_name,company_logo_url,company_cnpj,industry,is_online_business,company_address,company_city,company_state,company_postal_code,welcome_confirmed,team_agents_count,onboarding_goal,monthly_conversations_tier,whatsapp_connected,whatsapp_connected_at,whatsapp_pairing_code,whatsapp_pairing_expires_at,ui_step,completed,completed_at,created_at,updated_at";

export const COMPANY_ONBOARDING_SCHEMA_HINT =
  "Estrutura de onboarding adicional nao encontrada. Execute o SQL /sql/wz_company_onboarding_create.sql no Supabase e tente novamente.";

const COMPANY_ONBOARDING_ALLOWED_STEPS = new Set<OnboardingUiStep>([
  "welcome",
  "company",
  "goal",
  "team",
  "ai",
  "whatsapp",
  "improve",
  "final",
]);

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

function normalizeOnboardingUiStep(value?: string | null): OnboardingUiStep {
  const clean = String(value || "").trim().toLowerCase();
  if (COMPANY_ONBOARDING_ALLOWED_STEPS.has(clean as OnboardingUiStep)) {
    return clean as OnboardingUiStep;
  }
  return "company";
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

function mapCompanyOnboardingRow(
  row: WzCompanyOnboardingRow,
  defaults: {
    userId: string;
    authUserId: string | null;
    email: string;
    primaryOnboardingId: string | null;
  },
): CompanyOnboardingRecord {
  const id = normalizeOptionalText(row.id) || cryptoRandomId();
  const userId = normalizeOptionalText(row.user_id) || defaults.userId;
  const authUserId = normalizeOptionalText(row.auth_user_id) || defaults.authUserId;
  const email = normalizeEmail(row.email) || defaults.email;

  return {
    id,
    primaryOnboardingId:
      normalizeOptionalText(row.primary_onboarding_id) || defaults.primaryOnboardingId,
    userId,
    authUserId,
    email,
    companyName: normalizeOptionalText(row.company_name),
    companyLogoUrl: normalizeOptionalText(row.company_logo_url),
    companyCnpj: normalizeCnpjDigits(row.company_cnpj),
    industry: normalizeOptionalText(row.industry),
    isOnlineBusiness: normalizeBoolean(row.is_online_business),
    companyAddress: normalizeOptionalText(row.company_address),
    companyCity: normalizeOptionalText(row.company_city),
    companyState: normalizeOptionalText(row.company_state),
    companyPostalCode: normalizeOptionalText(row.company_postal_code),
    welcomeConfirmed: normalizeBoolean(row.welcome_confirmed),
    teamAgentsCount: normalizeInteger(row.team_agents_count),
    onboardingGoal: normalizeOptionalText(row.onboarding_goal),
    monthlyConversationsTier: normalizeOptionalText(row.monthly_conversations_tier),
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

async function queryCompanyOnboardingById(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  companyOnboardingId: string;
  userId: string;
}) {
  const lookup = await params.sb
    .from(COMPANY_ONBOARDING_TABLE)
    .select(COMPANY_ONBOARDING_COLUMNS)
    .eq("id", params.companyOnboardingId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (lookup.error) {
    return {
      ok: false as const,
      schemaReady: !isCompanyOnboardingSchemaError(lookup.error),
      error: lookup.error,
      row: null as WzCompanyOnboardingRow | null,
    };
  }

  return {
    ok: true as const,
    schemaReady: true,
    row: (lookup.data || null) as WzCompanyOnboardingRow | null,
  };
}

async function queryLatestCompanyOnboarding(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  completed?: boolean;
}) {
  const base = params.sb
    .from(COMPANY_ONBOARDING_TABLE)
    .select(COMPANY_ONBOARDING_COLUMNS)
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const lookup =
    typeof params.completed === "boolean"
      ? await base.eq("completed", params.completed).maybeSingle()
      : await base.maybeSingle();

  if (lookup.error) {
    return {
      ok: false as const,
      schemaReady: !isCompanyOnboardingSchemaError(lookup.error),
      error: lookup.error,
      row: null as WzCompanyOnboardingRow | null,
    };
  }

  return {
    ok: true as const,
    schemaReady: true,
    row: (lookup.data || null) as WzCompanyOnboardingRow | null,
  };
}

async function createCompanyOnboardingRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  authUserId: string;
  email: string;
  primaryOnboardingId: string | null;
}) {
  const payload = {
    primary_onboarding_id: params.primaryOnboardingId,
    user_id: params.userId,
    auth_user_id: params.authUserId,
    email: params.email,
    ui_step: "company",
    welcome_confirmed: true,
    whatsapp_connected: false,
    completed: false,
  };

  const { data, error } = await params.sb
    .from(COMPANY_ONBOARDING_TABLE)
    .insert(payload)
    .select(COMPANY_ONBOARDING_COLUMNS)
    .single();

  if (!error) {
    return {
      ok: true as const,
      schemaReady: true,
      row: data as WzCompanyOnboardingRow,
    };
  }

  if (isUniqueViolation(error)) {
    const latest = await queryLatestCompanyOnboarding({
      sb: params.sb,
      userId: params.userId,
      completed: false,
    });
    if (latest.ok && latest.row) {
      return {
        ok: true as const,
        schemaReady: true,
        row: latest.row,
      };
    }
  }

  return {
    ok: false as const,
    schemaReady: !isCompanyOnboardingSchemaError(error),
    error,
    row: null as WzCompanyOnboardingRow | null,
  };
}

export function isCompanyOnboardingSchemaError(error: unknown) {
  return (
    isMissingTableError(error, COMPANY_ONBOARDING_TABLE) ||
    isMissingColumnError(error, "user_id") ||
    isMissingColumnError(error, "auth_user_id") ||
    isMissingColumnError(error, "email")
  );
}

export async function ensureCompanyOnboardingRecord(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  sessionEmail: string;
  companyOnboardingId?: string | null;
  createIfMissing?: boolean;
}) {
  const sessionUserId = normalizeOptionalText(params.sessionUserId);
  const sessionEmail = normalizeEmail(params.sessionEmail);

  if (!sessionUserId || !sessionEmail) {
    return {
      ok: false as const,
      schemaReady: true,
      error: new Error("Sessao invalida para onboarding de empresa."),
    };
  }

  const base = await ensureOnboardingRecord({
    sb: params.sb,
    sessionUserId,
    sessionEmail,
  });
  if (!base.ok) return base;

  const userId = base.record.userId;
  const authUserId = base.record.authUserId || sessionUserId;
  const email = base.record.email || sessionEmail;
  const primaryOnboardingId = base.record.id;

  const requestedId = normalizeOptionalText(params.companyOnboardingId);
  if (requestedId) {
    const byId = await queryCompanyOnboardingById({
      sb: params.sb,
      companyOnboardingId: requestedId,
      userId,
    });
    if (!byId.ok) return byId;
    if (byId.row) {
      return {
        ok: true as const,
        record: mapCompanyOnboardingRow(byId.row, {
          userId,
          authUserId,
          email,
          primaryOnboardingId,
        }),
      };
    }
    if (!params.createIfMissing) {
      return {
        ok: false as const,
        schemaReady: true,
        error: new Error("Onboarding da empresa nao encontrado."),
      };
    }
  }

  const incomplete = await queryLatestCompanyOnboarding({
    sb: params.sb,
    userId,
    completed: false,
  });
  if (!incomplete.ok) return incomplete;
  if (incomplete.row) {
    return {
      ok: true as const,
      record: mapCompanyOnboardingRow(incomplete.row, {
        userId,
        authUserId,
        email,
        primaryOnboardingId,
      }),
    };
  }

  if (!params.createIfMissing) {
    const latest = await queryLatestCompanyOnboarding({
      sb: params.sb,
      userId,
    });
    if (!latest.ok) return latest;
    if (!latest.row) {
      return {
        ok: false as const,
        schemaReady: true,
        error: new Error("Nenhum onboarding adicional encontrado."),
      };
    }
    return {
      ok: true as const,
      record: mapCompanyOnboardingRow(latest.row, {
        userId,
        authUserId,
        email,
        primaryOnboardingId,
      }),
    };
  }

  const created = await createCompanyOnboardingRow({
    sb: params.sb,
    userId,
    authUserId,
    email,
    primaryOnboardingId,
  });
  if (!created.ok) return created;

  return {
    ok: true as const,
    record: mapCompanyOnboardingRow(created.row, {
      userId,
      authUserId,
      email,
      primaryOnboardingId,
    }),
  };
}

export async function patchCompanyOnboardingRecord(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  recordId: string;
  patch: Record<string, unknown>;
}) {
  const recordId = normalizeOptionalText(params.recordId);
  if (!recordId) {
    return {
      ok: false as const,
      schemaReady: true,
      error: new Error("Registro de onboarding adicional invalido."),
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
    .from(COMPANY_ONBOARDING_TABLE)
    .update(patch)
    .eq("id", recordId)
    .select(COMPANY_ONBOARDING_COLUMNS)
    .single();

  if (!error) {
    return {
      ok: true as const,
      row: data as WzCompanyOnboardingRow,
    };
  }

  if (isCompanyOnboardingSchemaError(error)) {
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
