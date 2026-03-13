import { sendOnboardingReminderEmail } from "@/app/api/wz_AuthLogin/_email";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  cleanupCompanyOnboardingLogoFolder,
  cleanupPrimaryOnboardingLogoFolder,
} from "@/app/api/wz_users/_managed_storage";

export const ONBOARDING_REMINDER_TTL_MS = 10 * 60 * 1000;
export const ONBOARDING_ABANDONMENT_TTL_MS = 20 * 60 * 1000;

const DEFAULT_PRUNE_LIMIT = 100;
const DEFAULT_REMINDER_LIMIT = 40;
const REMINDER_RETRY_COOLDOWN_MS = 15 * 60 * 1000;
const MAINTENANCE_SWEEP_MIN_INTERVAL_MS = 60 * 1000;
const REMINDER_TABLE = "wz_onboarding_reminders";
const REMINDER_TYPE = "abandonment_nudge";

type ReminderKind = "primary" | "company";

type PrimaryOnboardingRow = {
  id?: string | null;
  user_id?: string | null;
  email?: string | null;
  company_name?: string | null;
  updated_at?: string | null;
  completed?: boolean | string | number | null;
};

type CompanyOnboardingRow = {
  id?: string | null;
  user_id?: string | null;
  email?: string | null;
  company_name?: string | null;
  updated_at?: string | null;
  completed?: boolean | string | number | null;
};

type ReminderRow = {
  onboarding_kind?: string | null;
  onboarding_id?: string | null;
  user_id?: string | null;
  email?: string | null;
  reminder_type?: string | null;
  sent_for_updated_at?: string | null;
  sent_at?: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
};

type ReminderCandidate = {
  id: string;
  userId: string;
  email: string | null;
  companyName: string | null;
  updatedAt: string | null;
  completed: boolean;
};

type ReminderStats = {
  found: number;
  eligible: number;
  sent: number;
  failed: number;
  skippedAlreadySent: number;
  skippedSuppressed: number;
  skippedMissingEmail: number;
  skippedCooldown: number;
  sentIds: string[];
  failures: Array<{ id: string; error: string }>;
};

type ReminderSummary = {
  schemaReady: boolean;
  dryRun: boolean;
  reminderMinutes: number;
  retryCooldownMinutes: number;
  primary: ReminderStats;
  company: ReminderStats;
};

type ReminderSweepParams = {
  sb: ReturnType<typeof supabaseAdmin>;
  dryRun?: boolean;
  reminderTtlMs?: number;
  abandonmentTtlMs?: number;
  reminderLimit?: number;
  suppressPrimaryIds?: string[];
  suppressCompanyIds?: string[];
};

type ReminderStateMap = Map<string, ReminderRow>;

let lastMaintenanceSweepStartedAt = 0;
let inFlightMaintenanceSweep: Promise<MaintenanceSweepResult> | null = null;

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
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parseIsoMs(value?: string | null) {
  const normalized = normalizeIso(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "1" || clean === "true" || clean === "t" || clean === "yes" || clean === "sim";
  }
  return false;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function coercePrimaryOnboardingRows(data: unknown): PrimaryOnboardingRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isRecordLike).map((row) => ({
    id: typeof row.id === "string" ? row.id : null,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    email: typeof row.email === "string" ? row.email : null,
    company_name: typeof row.company_name === "string" ? row.company_name : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    completed:
      typeof row.completed === "boolean" || typeof row.completed === "string" || typeof row.completed === "number"
        ? row.completed
        : null,
  }));
}

function coerceCompanyOnboardingRows(data: unknown): CompanyOnboardingRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isRecordLike).map((row) => ({
    id: typeof row.id === "string" ? row.id : null,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    email: typeof row.email === "string" ? row.email : null,
    company_name: typeof row.company_name === "string" ? row.company_name : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    completed:
      typeof row.completed === "boolean" || typeof row.completed === "string" || typeof row.completed === "number"
        ? row.completed
        : null,
  }));
}

function coerceReminderRows(data: unknown): ReminderRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isRecordLike).map((row) => ({
    onboarding_kind: typeof row.onboarding_kind === "string" ? row.onboarding_kind : null,
    onboarding_id: typeof row.onboarding_id === "string" ? row.onboarding_id : null,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    email: typeof row.email === "string" ? row.email : null,
    reminder_type: typeof row.reminder_type === "string" ? row.reminder_type : null,
    sent_for_updated_at: typeof row.sent_for_updated_at === "string" ? row.sent_for_updated_at : null,
    sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
    last_attempt_at: typeof row.last_attempt_at === "string" ? row.last_attempt_at : null,
    last_error: typeof row.last_error === "string" ? row.last_error : null,
  }));
}

function emptyReminderStats(): ReminderStats {
  return {
    found: 0,
    eligible: 0,
    sent: 0,
    failed: 0,
    skippedAlreadySent: 0,
    skippedSuppressed: 0,
    skippedMissingEmail: 0,
    skippedCooldown: 0,
    sentIds: [],
    failures: [],
  };
}

function normalizeReminderSummary(params: {
  dryRun: boolean;
  reminderTtlMs: number;
  primary?: Partial<ReminderStats>;
  company?: Partial<ReminderStats>;
  schemaReady?: boolean;
}): ReminderSummary {
  return {
    schemaReady: params.schemaReady !== false,
    dryRun: params.dryRun,
    reminderMinutes: Math.round(params.reminderTtlMs / 60000),
    retryCooldownMinutes: Math.round(REMINDER_RETRY_COOLDOWN_MS / 60000),
    primary: { ...emptyReminderStats(), ...(params.primary || {}) },
    company: { ...emptyReminderStats(), ...(params.company || {}) },
  };
}

function buildReminderStateMap(rows: ReminderRow[]) {
  const map: ReminderStateMap = new Map();
  for (const row of rows) {
    const onboardingId = normalizeText(row.onboarding_id);
    if (onboardingId) map.set(onboardingId, row);
  }
  return map;
}

function normalizeReminderCandidate<T extends PrimaryOnboardingRow | CompanyOnboardingRow>(row: T) {
  const id = normalizeText(row.id);
  const userId = normalizeText(row.user_id);
  if (!id || !userId) return null;
  return {
    id,
    userId,
    email: normalizeEmail(row.email),
    companyName: normalizeText(row.company_name),
    updatedAt: normalizeIso(row.updated_at),
    completed: normalizeBoolean(row.completed),
  } satisfies ReminderCandidate;
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

function shouldSendReminder(params: {
  candidate: ReminderCandidate;
  reminderState?: ReminderRow | null;
  nowMs: number;
  reminderTtlMs: number;
  abandonmentTtlMs: number;
}) {
  if (params.candidate.completed) return false;
  const updatedAt = normalizeIso(params.candidate.updatedAt);
  const updatedAtMs = parseIsoMs(updatedAt);
  if (!updatedAt || !updatedAtMs) return false;

  const ageMs = params.nowMs - updatedAtMs;
  if (ageMs < params.reminderTtlMs) return false;
  if (ageMs >= params.abandonmentTtlMs) return false;

  const sentForUpdatedAt = normalizeIso(params.reminderState?.sent_for_updated_at);
  if (sentForUpdatedAt && sentForUpdatedAt === updatedAt) return false;

  const lastAttemptAtMs = parseIsoMs(params.reminderState?.last_attempt_at);
  if (lastAttemptAtMs && params.nowMs - lastAttemptAtMs < REMINDER_RETRY_COOLDOWN_MS) {
    return false;
  }

  return true;
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

async function deleteReminderState(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  kind: ReminderKind;
  recordId: string;
}) {
  const recordId = normalizeText(params.recordId);
  if (!recordId) return;

  const { error } = await params.sb
    .from(REMINDER_TABLE)
    .delete()
    .eq("onboarding_kind", params.kind)
    .eq("onboarding_id", recordId)
    .eq("reminder_type", REMINDER_TYPE);

  if (error && !isMissingTableError(error, REMINDER_TABLE)) {
    throw error;
  }
}

async function upsertReminderState(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  kind: ReminderKind;
  recordId: string;
  userId: string;
  email: string | null;
  updatedAt: string | null;
  lastAttemptAt: string;
  sentAt?: string | null;
  lastError?: string | null;
}) {
  const payload: Record<string, unknown> = {
    onboarding_kind: params.kind,
    onboarding_id: params.recordId,
    user_id: params.userId,
    email: params.email,
    reminder_type: REMINDER_TYPE,
    last_attempt_at: params.lastAttemptAt,
    last_error: params.lastError || null,
  };

  if (params.sentAt) {
    payload.sent_at = params.sentAt;
    payload.sent_for_updated_at = params.updatedAt;
  }

  const { error } = await params.sb
    .from(REMINDER_TABLE)
    .upsert(payload, { onConflict: "onboarding_kind,onboarding_id,reminder_type" });
  if (error) throw error;
}

async function loadReminderStateMap(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  kind: ReminderKind;
  onboardingIds: string[];
}) {
  const onboardingIds = params.onboardingIds
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));

  if (!onboardingIds.length) {
    return new Map() as ReminderStateMap;
  }

  const lookup = await params.sb
    .from(REMINDER_TABLE)
    .select(
      "onboarding_kind,onboarding_id,user_id,email,reminder_type,sent_for_updated_at,sent_at,last_attempt_at,last_error",
    )
    .eq("onboarding_kind", params.kind)
    .eq("reminder_type", REMINDER_TYPE)
    .in("onboarding_id", onboardingIds);

  if (lookup.error) throw lookup.error;
  return buildReminderStateMap(coerceReminderRows(lookup.data));
}

async function loadAbandonedPrimaryOnboardingRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  cutoffIso: string;
  limit: number;
}) {
  const lookup = await params.sb
    .from("wz_onboarding")
    .select("id,user_id,email,company_name,updated_at,completed")
    .eq("completed", false)
    .lt("updated_at", params.cutoffIso)
    .order("updated_at", { ascending: true })
    .limit(params.limit);

  if (lookup.error) throw lookup.error;
  return coercePrimaryOnboardingRows(lookup.data);
}

async function loadAbandonedCompanyOnboardingRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  cutoffIso: string;
  limit: number;
}) {
  const lookup = await params.sb
    .from("wz_company_onboarding")
    .select("id,user_id,email,company_name,updated_at,completed")
    .eq("completed", false)
    .lt("updated_at", params.cutoffIso)
    .order("updated_at", { ascending: true })
    .limit(params.limit);

  if (lookup.error) {
    if (isMissingTableError(lookup.error, "wz_company_onboarding")) return [];
    throw lookup.error;
  }

  return coerceCompanyOnboardingRows(lookup.data);
}

async function loadReminderPrimaryCandidates(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  reminderCutoffIso: string;
  abandonmentCutoffIso: string;
  limit: number;
}) {
  const lookup = await params.sb
    .from("wz_onboarding")
    .select("id,user_id,email,company_name,updated_at,completed")
    .eq("completed", false)
    .lt("updated_at", params.reminderCutoffIso)
    .gt("updated_at", params.abandonmentCutoffIso)
    .order("updated_at", { ascending: true })
    .limit(params.limit);

  if (lookup.error) throw lookup.error;

  return coercePrimaryOnboardingRows(lookup.data)
    .map((row) => normalizeReminderCandidate(row))
    .filter((row): row is ReminderCandidate => Boolean(row));
}

async function loadReminderCompanyCandidates(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  reminderCutoffIso: string;
  abandonmentCutoffIso: string;
  limit: number;
}) {
  const lookup = await params.sb
    .from("wz_company_onboarding")
    .select("id,user_id,email,company_name,updated_at,completed")
    .eq("completed", false)
    .lt("updated_at", params.reminderCutoffIso)
    .gt("updated_at", params.abandonmentCutoffIso)
    .order("updated_at", { ascending: true })
    .limit(params.limit);

  if (lookup.error) {
    if (isMissingTableError(lookup.error, "wz_company_onboarding")) return [];
    throw lookup.error;
  }

  return coerceCompanyOnboardingRows(lookup.data)
    .map((row) => normalizeReminderCandidate(row))
    .filter((row): row is ReminderCandidate => Boolean(row));
}

async function processReminderKind(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  kind: ReminderKind;
  isAdditionalCompany: boolean;
  candidates: ReminderCandidate[];
  dryRun: boolean;
  nowIso: string;
  nowMs: number;
  reminderTtlMs: number;
  abandonmentTtlMs: number;
  suppressedIds: Set<string>;
}) {
  const stats = emptyReminderStats();
  stats.found = params.candidates.length;
  if (!params.candidates.length) return stats;

  const reminderStates = await loadReminderStateMap({
    sb: params.sb,
    kind: params.kind,
    onboardingIds: params.candidates.map((candidate) => candidate.id),
  });

  for (const candidate of params.candidates) {
    if (params.suppressedIds.has(candidate.id)) {
      stats.skippedSuppressed += 1;
      continue;
    }

    const reminderState = reminderStates.get(candidate.id);
    const alreadySentForCurrentState =
      normalizeIso(reminderState?.sent_for_updated_at) === normalizeIso(candidate.updatedAt);
    const recentAttemptAtMs = parseIsoMs(reminderState?.last_attempt_at);
    const hasRecentAttempt =
      Boolean(recentAttemptAtMs) && params.nowMs - Number(recentAttemptAtMs) < REMINDER_RETRY_COOLDOWN_MS;

    if (
      !shouldSendReminder({
        candidate,
        reminderState,
        nowMs: params.nowMs,
        reminderTtlMs: params.reminderTtlMs,
        abandonmentTtlMs: params.abandonmentTtlMs,
      })
    ) {
      if (alreadySentForCurrentState) {
        stats.skippedAlreadySent += 1;
      } else if (hasRecentAttempt) {
        stats.skippedCooldown += 1;
      }
      continue;
    }

    stats.eligible += 1;
    if (!candidate.email) {
      stats.skippedMissingEmail += 1;
      continue;
    }

    if (params.dryRun) {
      stats.sent += 1;
      stats.sentIds.push(candidate.id);
      continue;
    }

    try {
      await sendOnboardingReminderEmail(candidate.email, {
        companyName: candidate.companyName,
        isAdditionalCompany: params.isAdditionalCompany,
      });
      await upsertReminderState({
        sb: params.sb,
        kind: params.kind,
        recordId: candidate.id,
        userId: candidate.userId,
        email: candidate.email,
        updatedAt: candidate.updatedAt,
        lastAttemptAt: params.nowIso,
        sentAt: params.nowIso,
        lastError: null,
      });
      stats.sent += 1;
      stats.sentIds.push(candidate.id);
    } catch (error) {
      const message = String((error as { message?: unknown } | null)?.message || error || "Falha ao enviar lembrete de onboarding.");
      stats.failed += 1;
      stats.failures.push({ id: candidate.id, error: message });

      try {
        await upsertReminderState({
          sb: params.sb,
          kind: params.kind,
          recordId: candidate.id,
          userId: candidate.userId,
          email: candidate.email,
          updatedAt: candidate.updatedAt,
          lastAttemptAt: params.nowIso,
          lastError: message,
        });
      } catch (persistError) {
        console.error("[onboarding-maintenance] reminder state persist error:", persistError);
      }
    }
  }

  return stats;
}

async function processDueOnboardingReminders(params: ReminderSweepParams): Promise<ReminderSummary> {
  const reminderTtlMs =
    typeof params.reminderTtlMs === "number" && Number.isFinite(params.reminderTtlMs) && params.reminderTtlMs > 0
      ? Math.trunc(params.reminderTtlMs)
      : ONBOARDING_REMINDER_TTL_MS;
  const abandonmentTtlMs =
    typeof params.abandonmentTtlMs === "number" && Number.isFinite(params.abandonmentTtlMs) && params.abandonmentTtlMs > 0
      ? Math.trunc(params.abandonmentTtlMs)
      : ONBOARDING_ABANDONMENT_TTL_MS;
  const limit =
    typeof params.reminderLimit === "number" && Number.isFinite(params.reminderLimit) && params.reminderLimit > 0
      ? Math.trunc(params.reminderLimit)
      : DEFAULT_REMINDER_LIMIT;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const reminderCutoffIso = new Date(nowMs - reminderTtlMs).toISOString();
  const abandonmentCutoffIso = new Date(nowMs - abandonmentTtlMs).toISOString();

  try {
    const [primaryCandidates, companyCandidates] = await Promise.all([
      loadReminderPrimaryCandidates({ sb: params.sb, reminderCutoffIso, abandonmentCutoffIso, limit }),
      loadReminderCompanyCandidates({ sb: params.sb, reminderCutoffIso, abandonmentCutoffIso, limit }),
    ]);

    const [primary, company] = await Promise.all([
      processReminderKind({
        sb: params.sb,
        kind: "primary",
        isAdditionalCompany: false,
        candidates: primaryCandidates,
        dryRun: Boolean(params.dryRun),
        nowIso,
        nowMs,
        reminderTtlMs,
        abandonmentTtlMs,
        suppressedIds: new Set(params.suppressPrimaryIds || []),
      }),
      processReminderKind({
        sb: params.sb,
        kind: "company",
        isAdditionalCompany: true,
        candidates: companyCandidates,
        dryRun: Boolean(params.dryRun),
        nowIso,
        nowMs,
        reminderTtlMs,
        abandonmentTtlMs,
        suppressedIds: new Set(params.suppressCompanyIds || []),
      }),
    ]);

    return normalizeReminderSummary({
      dryRun: Boolean(params.dryRun),
      reminderTtlMs,
      primary,
      company,
    });
  } catch (error) {
    if (isMissingTableError(error, REMINDER_TABLE)) {
      return normalizeReminderSummary({
        dryRun: Boolean(params.dryRun),
        reminderTtlMs,
        schemaReady: false,
      });
    }
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
    return { removed: false, recordId, userId, dryRun: Boolean(params.dryRun) };
  }

  if (params.dryRun) {
    return { removed: true, recordId, userId, dryRun: true };
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

  try {
    await deleteReminderState({ sb: params.sb, kind: "primary", recordId });
  } catch (error) {
    console.error("[onboarding-maintenance] primary reminder cleanup error:", error);
  }

  await cleanupLinkedBotSystems({ sb: params.sb, column: "onboarding_id", recordId });

  const { error } = await params.sb.from("wz_onboarding").delete().eq("id", recordId);
  if (error) throw error;

  return { removed: true, recordId, userId, dryRun: false };
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
    return { removed: false, recordId, userId, dryRun: Boolean(params.dryRun) };
  }

  if (params.dryRun) {
    return { removed: true, recordId, userId, dryRun: true };
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

  try {
    await deleteReminderState({ sb: params.sb, kind: "company", recordId });
  } catch (error) {
    console.error("[onboarding-maintenance] company reminder cleanup error:", error);
  }

  await cleanupLinkedBotSystems({
    sb: params.sb,
    column: "company_onboarding_id",
    recordId,
  });

  const { error } = await params.sb.from("wz_company_onboarding").delete().eq("id", recordId);
  if (error) throw error;

  return { removed: true, recordId, userId, dryRun: false };
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

type MaintenanceSweepResult = {
  triggeredAt: string;
  skipped: boolean;
  reason: string;
  dryRun: boolean;
  reminder: ReminderSummary;
  prune: Awaited<ReturnType<typeof pruneAbandonedOnboarding>>;
};

export async function runOnboardingMaintenanceSweep(params?: {
  sb?: ReturnType<typeof supabaseAdmin>;
  force?: boolean;
  dryRun?: boolean;
  reason?: string;
  reminderTtlMs?: number;
  abandonmentTtlMs?: number;
  reminderLimit?: number;
  pruneLimit?: number;
  suppressPrimaryIds?: string[];
  suppressCompanyIds?: string[];
}) {
  const force = Boolean(params?.force);
  const nowMs = Date.now();
  const reason = normalizeText(params?.reason) || "request";
  const reminderTtlMs =
    typeof params?.reminderTtlMs === "number" && Number.isFinite(params.reminderTtlMs) && params.reminderTtlMs > 0
      ? Math.trunc(params.reminderTtlMs)
      : ONBOARDING_REMINDER_TTL_MS;
  const abandonmentTtlMs =
    typeof params?.abandonmentTtlMs === "number" &&
    Number.isFinite(params.abandonmentTtlMs) &&
    params.abandonmentTtlMs > 0
      ? Math.trunc(params.abandonmentTtlMs)
      : ONBOARDING_ABANDONMENT_TTL_MS;

  if (!force) {
    if (inFlightMaintenanceSweep) {
      return inFlightMaintenanceSweep;
    }

    if (nowMs - lastMaintenanceSweepStartedAt < MAINTENANCE_SWEEP_MIN_INTERVAL_MS) {
      return {
        triggeredAt: new Date(nowMs).toISOString(),
        skipped: true,
        reason,
        dryRun: Boolean(params?.dryRun),
        reminder: normalizeReminderSummary({
          dryRun: Boolean(params?.dryRun),
          reminderTtlMs,
        }),
        prune: {
          dryRun: Boolean(params?.dryRun),
          ttlMinutes: Math.round(abandonmentTtlMs / 60000),
          cutoffIso: new Date(nowMs - abandonmentTtlMs).toISOString(),
          primary: { found: 0, removed: 0, failed: 0, removedIds: [], failures: [] },
          company: { found: 0, removed: 0, failed: 0, removedIds: [], failures: [] },
        },
      } satisfies MaintenanceSweepResult;
    }
  }

  lastMaintenanceSweepStartedAt = nowMs;
  const run = (async () => {
    const sb = params?.sb || supabaseAdmin();
    const reminder = await processDueOnboardingReminders({
      sb,
      dryRun: params?.dryRun,
      reminderTtlMs,
      abandonmentTtlMs,
      reminderLimit: params?.reminderLimit,
      suppressPrimaryIds: params?.suppressPrimaryIds,
      suppressCompanyIds: params?.suppressCompanyIds,
    });
    const prune = await pruneAbandonedOnboarding({
      sb,
      dryRun: params?.dryRun,
      ttlMs: abandonmentTtlMs,
      limit: params?.pruneLimit,
    });

    return {
      triggeredAt: new Date().toISOString(),
      skipped: false,
      reason,
      dryRun: Boolean(params?.dryRun),
      reminder,
      prune,
    } satisfies MaintenanceSweepResult;
  })();

  inFlightMaintenanceSweep = run;
  try {
    return await run;
  } finally {
    if (inFlightMaintenanceSweep === run) {
      inFlightMaintenanceSweep = null;
    }
  }
}
