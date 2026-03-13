import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  cleanupCompanyOnboardingLogoFolder,
  cleanupPrimaryOnboardingLogoFolder,
} from "@/app/api/wz_users/_managed_storage";

export const ONBOARDING_ABANDONMENT_TTL_MS = 20 * 60 * 1000;

const DEFAULT_PRUNE_LIMIT = 100;

type PrimaryOnboardingRow = {
  id?: string | null;
  user_id?: string | null;
  updated_at?: string | null;
  completed?: boolean | string | number | null;
};

type CompanyOnboardingRow = {
  id?: string | null;
  user_id?: string | null;
  updated_at?: string | null;
  completed?: boolean | string | number | null;
};

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeIso(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
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

function parseIsoMs(value?: string | null) {
  const normalized = normalizeIso(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function coercePrimaryOnboardingRows(data: unknown): PrimaryOnboardingRow[] {
  if (!Array.isArray(data)) return [];

  return data.filter(isRecordLike).map((row) => ({
    id: typeof row.id === "string" ? row.id : null,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    completed:
      typeof row.completed === "boolean" ||
      typeof row.completed === "string" ||
      typeof row.completed === "number"
        ? row.completed
        : null,
  }));
}

function coerceCompanyOnboardingRows(data: unknown): CompanyOnboardingRow[] {
  if (!Array.isArray(data)) return [];

  return data.filter(isRecordLike).map((row) => ({
    id: typeof row.id === "string" ? row.id : null,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    completed:
      typeof row.completed === "boolean" ||
      typeof row.completed === "string" ||
      typeof row.completed === "number"
        ? row.completed
        : null,
  }));
}

export function isOnboardingRecordAbandoned(params: {
  updatedAt?: string | null;
  completed?: boolean | null;
  ttlMs?: number;
  nowMs?: number;
}) {
  if (Boolean(params.completed)) return false;
  const updatedAtMs = parseIsoMs(params.updatedAt);
  if (!updatedAtMs) return false;
  const ttlMs =
    typeof params.ttlMs === "number" && Number.isFinite(params.ttlMs) && params.ttlMs > 0
      ? Math.trunc(params.ttlMs)
      : ONBOARDING_ABANDONMENT_TTL_MS;
  const nowMs =
    typeof params.nowMs === "number" && Number.isFinite(params.nowMs) ? params.nowMs : Date.now();
  return nowMs - updatedAtMs >= ttlMs;
}

async function cleanupLinkedBotSystems(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: "onboarding_id" | "company_onboarding_id";
  recordId: string;
}) {
  const recordId = normalizeText(params.recordId);
  if (!recordId) return;

  const { error } = await params.sb.from("wz_bot_systems").delete().eq(params.column, recordId);
  if (
    error &&
    !isMissingTableError(error, "wz_bot_systems") &&
    !isMissingColumnError(error, params.column)
  ) {
    throw error;
  }
}

export async function removePrimaryOnboardingRecord(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  recordId: string;
  userId: string;
  dryRun?: boolean;
}) {
  const recordId = normalizeText(params.recordId);
  const userId = normalizeText(params.userId);
  if (!recordId || !userId) {
    return {
      removed: false,
      recordId,
      userId,
      dryRun: Boolean(params.dryRun),
    };
  }

  if (params.dryRun) {
    return {
      removed: true,
      recordId,
      userId,
      dryRun: true,
    };
  }

  try {
    await cleanupPrimaryOnboardingLogoFolder({
      sb: params.sb,
      userId,
      keepObjectPath: null,
    });
  } catch (error) {
    console.error("[onboarding-maintenance] primary logo cleanup error:", error);
  }

  await cleanupLinkedBotSystems({
    sb: params.sb,
    column: "onboarding_id",
    recordId,
  });

  const { error } = await params.sb.from("wz_onboarding").delete().eq("id", recordId);
  if (error) {
    throw error;
  }

  return {
    removed: true,
    recordId,
    userId,
    dryRun: false,
  };
}

export async function removeCompanyOnboardingRecord(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  recordId: string;
  userId: string;
  dryRun?: boolean;
}) {
  const recordId = normalizeText(params.recordId);
  const userId = normalizeText(params.userId);
  if (!recordId || !userId) {
    return {
      removed: false,
      recordId,
      userId,
      dryRun: Boolean(params.dryRun),
    };
  }

  if (params.dryRun) {
    return {
      removed: true,
      recordId,
      userId,
      dryRun: true,
    };
  }

  try {
    await cleanupCompanyOnboardingLogoFolder({
      sb: params.sb,
      userId,
      companyOnboardingId: recordId,
      keepObjectPath: null,
    });
  } catch (error) {
    console.error("[onboarding-maintenance] company logo cleanup error:", error);
  }

  await cleanupLinkedBotSystems({
    sb: params.sb,
    column: "company_onboarding_id",
    recordId,
  });

  const { error } = await params.sb.from("wz_company_onboarding").delete().eq("id", recordId);
  if (error) {
    throw error;
  }

  return {
    removed: true,
    recordId,
    userId,
    dryRun: false,
  };
}

async function loadAbandonedPrimaryOnboardingRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  cutoffIso: string;
  limit: number;
}) {
  const lookup = await params.sb
    .from("wz_onboarding")
    .select("id,user_id,updated_at,completed")
    .eq("completed", false)
    .lt("updated_at", params.cutoffIso)
    .order("updated_at", { ascending: true })
    .limit(params.limit);

  if (lookup.error) {
    throw lookup.error;
  }

  return coercePrimaryOnboardingRows(lookup.data);
}

async function loadAbandonedCompanyOnboardingRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  cutoffIso: string;
  limit: number;
}) {
  const lookup = await params.sb
    .from("wz_company_onboarding")
    .select("id,user_id,updated_at,completed")
    .eq("completed", false)
    .lt("updated_at", params.cutoffIso)
    .order("updated_at", { ascending: true })
    .limit(params.limit);

  if (lookup.error) {
    if (isMissingTableError(lookup.error, "wz_company_onboarding")) {
      return [];
    }
    throw lookup.error;
  }

  return coerceCompanyOnboardingRows(lookup.data);
}

export async function pruneAbandonedOnboarding(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  dryRun?: boolean;
  ttlMs?: number;
  limit?: number;
}) {
  const ttlMs =
    typeof params.ttlMs === "number" && Number.isFinite(params.ttlMs) && params.ttlMs > 0
      ? Math.trunc(params.ttlMs)
      : ONBOARDING_ABANDONMENT_TTL_MS;
  const limit =
    typeof params.limit === "number" && Number.isFinite(params.limit) && params.limit > 0
      ? Math.trunc(params.limit)
      : DEFAULT_PRUNE_LIMIT;
  const cutoffIso = new Date(Date.now() - ttlMs).toISOString();

  const primaryRows = await loadAbandonedPrimaryOnboardingRows({
    sb: params.sb,
    cutoffIso,
    limit,
  });
  const companyRows = await loadAbandonedCompanyOnboardingRows({
    sb: params.sb,
    cutoffIso,
    limit,
  });

  const primaryRemovedIds: string[] = [];
  const primaryFailures: Array<{ id: string; error: string }> = [];
  for (const row of primaryRows) {
    const recordId = normalizeText(row.id) || "unknown";
    const userId = normalizeText(row.user_id);
    if (!userId) {
      primaryFailures.push({
        id: recordId,
        error: "user_id ausente para onboarding primario abandonado.",
      });
      continue;
    }

    try {
      await removePrimaryOnboardingRecord({
        sb: params.sb,
        recordId,
        userId,
        dryRun: params.dryRun,
      });
      primaryRemovedIds.push(recordId);
    } catch (error) {
      primaryFailures.push({
        id: recordId,
        error: String((error as { message?: unknown } | null)?.message || error || "Falha ao remover onboarding primario."),
      });
    }
  }

  const companyRemovedIds: string[] = [];
  const companyFailures: Array<{ id: string; error: string }> = [];
  for (const row of companyRows) {
    const recordId = normalizeText(row.id) || "unknown";
    const userId = normalizeText(row.user_id);
    if (!userId) {
      companyFailures.push({
        id: recordId,
        error: "user_id ausente para onboarding adicional abandonado.",
      });
      continue;
    }

    try {
      await removeCompanyOnboardingRecord({
        sb: params.sb,
        recordId,
        userId,
        dryRun: params.dryRun,
      });
      companyRemovedIds.push(recordId);
    } catch (error) {
      companyFailures.push({
        id: recordId,
        error: String((error as { message?: unknown } | null)?.message || error || "Falha ao remover onboarding adicional."),
      });
    }
  }

  return {
    dryRun: Boolean(params.dryRun),
    ttlMinutes: Math.round(ttlMs / 60000),
    cutoffIso,
    primary: {
      found: primaryRows.length,
      removed: primaryRemovedIds.length,
      failed: primaryFailures.length,
      removedIds: primaryRemovedIds,
      failures: primaryFailures,
    },
    company: {
      found: companyRows.length,
      removed: companyRemovedIds.length,
      failed: companyFailures.length,
      removedIds: companyRemovedIds,
      failures: companyFailures,
    },
  };
}
