import { after, NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  ensureOnboardingRecord,
  normalizeEmail,
  normalizeOptionalText,
} from "@/app/api/wz_users/_onboarding";
import { runOnboardingMaintenanceSweep } from "@/app/api/wz_users/_onboarding_maintenance";
import { ensurePersistedWhatsAppInstancesBootstrapped } from "@/app/api/wz_users/_whatsapp_provider";
import {
  COMPANY_ONBOARDING_SCHEMA_HINT,
  ensureCompanyOnboardingRecord,
} from "@/app/api/wz_users/_company_onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const BOT_SYSTEM_TABLE = "wz_bot_systems";
const COMPANY_ONBOARDING_TABLE = "wz_company_onboarding";
const BOT_SYSTEM_SQL_HINT =
  "Estrutura do sistema de WhatsApp nao encontrada. Execute os SQL /sql/wz_company_onboarding_create.sql e /sql/wz_bot_systems_create.sql no Supabase.";

const DAY_VALUES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type ScheduleDay = (typeof DAY_VALUES)[number];

type DaySchedule = {
  day: ScheduleDay;
  enabled: boolean;
  start: string;
  end: string;
};

type SystemConfig = {
  welcomeMessage: string;
  closingMessage: string;
  outOfHoursMessage: string;
  weeklySchedule: DaySchedule[];
  aiInstructions: string;
  aiFallbackMessage: string;
  aiResponseTone: "professional" | "friendly" | "consultative" | "objective";
  aiResponseSize: "concise" | "balanced" | "detailed";
  aiCollectName: boolean;
  aiCollectEmail: boolean;
  aiCollectPhone: boolean;
  aiTransferToHumanWhenUncertain: boolean;
};

type SystemSummary = {
  id: string;
  companyName: string | null;
  companyOnboardingId: string | null;
  status: string;
  whatsappConnected: boolean;
  createdAt: string;
  updatedAt: string;
};

const BOT_SYSTEM_CONFIG_COLUMNS =
  "id,onboarding_id,company_onboarding_id,company_name,status,whatsapp_connected,welcome_message,closing_message,out_of_hours_message,weekly_schedule,ai_instructions,ai_fallback_message,ai_response_tone,ai_response_size,ai_collect_name,ai_collect_email,ai_collect_phone,ai_transfer_to_human_when_uncertain,created_at,updated_at";

const BOT_SYSTEM_SUMMARY_COLUMNS =
  "id,company_onboarding_id,company_name,status,whatsapp_connected,created_at,updated_at";
const DEFAULT_AI_INSTRUCTIONS =
  "Seja objetivo, educado e profissional. Entenda o contexto do cliente, confirme o que foi compreendido e proponha o proximo passo mais adequado.";
const DEFAULT_AI_FALLBACK_MESSAGE =
  "Desculpe, nao entendi completamente sua mensagem. Pode explicar de outra forma ou enviar mais detalhes?";

function getErrorMessage(error: unknown, fallback: string) {
  const message = String((error as { message?: unknown } | null)?.message || "").trim();
  return message || fallback;
}

function scheduleOnboardingMaintenance(params: {
  reason: string;
  onboardingId?: string | null;
}) {
  const onboardingId = normalizeOptionalText(params.onboardingId || "");
  after(async () => {
    try {
      await runOnboardingMaintenanceSweep({
        reason: params.reason,
        suppressPrimaryIds: onboardingId ? [onboardingId] : [],
      });
    } catch (error) {
      console.error("[system-config] background maintenance error:", error);
    }
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isMissingBotSystemSchema(error: unknown) {
  const code = String((error as { code?: unknown } | null)?.code || "").trim().toUpperCase();
  if (code === "42P01" || code === "PGRST205") return true;

  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  if (code === "42703" || code === "PGRST204") {
    return (
      message.includes("company_onboarding_id") ||
      details.includes("company_onboarding_id") ||
      hint.includes("company_onboarding_id")
    );
  }
  return (
    message.includes(BOT_SYSTEM_TABLE) ||
    details.includes(BOT_SYSTEM_TABLE) ||
    hint.includes(BOT_SYSTEM_TABLE) ||
    message.includes(COMPANY_ONBOARDING_TABLE) ||
    details.includes(COMPANY_ONBOARDING_TABLE) ||
    hint.includes(COMPANY_ONBOARDING_TABLE)
  );
}

function isLegacySingleSystemConstraint(error: unknown) {
  const code = String((error as { code?: unknown } | null)?.code || "").trim().toUpperCase();
  if (code !== "23505") return false;

  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  return (
    message.includes("wz_bot_systems_user_id_key") ||
    details.includes("wz_bot_systems_user_id_key") ||
    (message.includes("duplicate key") && message.includes("user_id"))
  );
}

function normalizeLongText(value: unknown, maxLength = 1800) {
  const clean = String(value || "")
    .replace(/\r/g, "")
    .replace(/[ ]{2,}/g, " ")
    .trim();
  if (!clean) return "";
  return clean.slice(0, maxLength);
}

function normalizeTime(value: unknown) {
  const clean = String(value || "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clean)) return "";
  return clean;
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

function isUuidLike(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(clean);
}

function isCompanyOnboardingNotFoundError(error: unknown) {
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  return (
    message.includes("onboarding da empresa nao encontrado") ||
    message.includes("nenhum onboarding adicional encontrado")
  );
}

function normalizeDay(value: unknown): ScheduleDay | null {
  const clean = String(value || "").trim().toLowerCase();
  return DAY_VALUES.includes(clean as ScheduleDay) ? (clean as ScheduleDay) : null;
}

function normalizeSchedule(input: unknown): DaySchedule[] {
  if (!Array.isArray(input)) return [];

  const map = new Map<ScheduleDay, DaySchedule>();
  for (const item of input) {
    const record = asRecord(item);
    if (!record) continue;

    const day = normalizeDay(record.day);
    if (!day) continue;
    map.set(day, {
      day,
      enabled: normalizeBoolean(record.enabled),
      start: normalizeTime(record.start),
      end: normalizeTime(record.end),
    });
  }

  return DAY_VALUES.map((day) => {
    const row = map.get(day);
    return (
      row || {
        day,
        enabled: false,
        start: "",
        end: "",
      }
    );
  });
}

function normalizeTone(value: unknown): SystemConfig["aiResponseTone"] {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "friendly" || clean === "consultative" || clean === "objective") return clean;
  return "professional";
}

function normalizeResponseSize(value: unknown): SystemConfig["aiResponseSize"] {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "concise" || clean === "detailed") return clean;
  return "balanced";
}

function parseIncomingConfig(value: unknown) {
  const raw = asRecord(value);
  if (!raw) {
    return { ok: false as const, error: "Configuracao do sistema invalida." };
  }

  const config: SystemConfig = {
    welcomeMessage: normalizeLongText(raw.welcomeMessage, 1200),
    closingMessage: normalizeLongText(raw.closingMessage, 1200),
    outOfHoursMessage: normalizeLongText(raw.outOfHoursMessage, 1200),
    weeklySchedule: normalizeSchedule(raw.weeklySchedule),
    aiInstructions: normalizeLongText(raw.aiInstructions, 2400),
    aiFallbackMessage: normalizeLongText(raw.aiFallbackMessage, 1200),
    aiResponseTone: normalizeTone(raw.aiResponseTone),
    aiResponseSize: normalizeResponseSize(raw.aiResponseSize),
    aiCollectName: normalizeBoolean(raw.aiCollectName),
    aiCollectEmail: normalizeBoolean(raw.aiCollectEmail),
    aiCollectPhone: normalizeBoolean(raw.aiCollectPhone),
    aiTransferToHumanWhenUncertain: normalizeBoolean(raw.aiTransferToHumanWhenUncertain),
  };

  if (!config.welcomeMessage) {
    return { ok: false as const, error: "Informe a mensagem de boas-vindas." };
  }
  if (!config.closingMessage) {
    return { ok: false as const, error: "Informe a mensagem de encerramento do atendimento." };
  }
  if (!config.outOfHoursMessage) {
    return { ok: false as const, error: "Informe a mensagem fora do horario." };
  }

  const enabledDays = config.weeklySchedule.filter((item) => item.enabled);
  if (!enabledDays.length) {
    return { ok: false as const, error: "Selecione pelo menos um dia de atendimento." };
  }
  for (const day of enabledDays) {
    if (!day.start || !day.end) {
      return { ok: false as const, error: "Preencha horario inicial e final para todos os dias ativos." };
    }
    if (day.start >= day.end) {
      return { ok: false as const, error: "O horario final deve ser maior que o inicial em cada dia ativo." };
    }
  }

  if (!config.aiInstructions) {
    return { ok: false as const, error: "Informe as instrucoes principais para a IA." };
  }
  if (!config.aiFallbackMessage) {
    return { ok: false as const, error: "Informe a mensagem quando a IA nao entender o cliente." };
  }

  return { ok: true as const, config };
}

function mapDbRowToConfig(row: Record<string, unknown>): SystemConfig {
  return {
    welcomeMessage: normalizeLongText(row.welcome_message, 1200),
    closingMessage: normalizeLongText(row.closing_message, 1200),
    outOfHoursMessage: normalizeLongText(row.out_of_hours_message, 1200),
    weeklySchedule: normalizeSchedule(row.weekly_schedule),
    aiInstructions: normalizeLongText(row.ai_instructions, 2400) || DEFAULT_AI_INSTRUCTIONS,
    aiFallbackMessage:
      normalizeLongText(row.ai_fallback_message, 1200) || DEFAULT_AI_FALLBACK_MESSAGE,
    aiResponseTone: normalizeTone(row.ai_response_tone),
    aiResponseSize: normalizeResponseSize(row.ai_response_size),
    aiCollectName: normalizeBoolean(row.ai_collect_name),
    aiCollectEmail: normalizeBoolean(row.ai_collect_email),
    aiCollectPhone: normalizeBoolean(row.ai_collect_phone),
    aiTransferToHumanWhenUncertain: normalizeBoolean(row.ai_transfer_to_human_when_uncertain),
  };
}

type RealtimeSetupState = {
  requiresPrimarySystemSetup: boolean;
  primaryOnboardingCompleted: boolean;
  primaryWhatsappConnected: boolean;
  primaryCompanyName: string | null;
  systemCount: number;
  statusRevision: string;
};

function mapDbRowToSummary(row: Record<string, unknown>): SystemSummary | null {
  const id = normalizeOptionalText(String(row.id || ""));
  if (!id) return null;

  return {
    id,
    companyName: normalizeOptionalText(String(row.company_name || "")),
    companyOnboardingId: normalizeOptionalText(String(row.company_onboarding_id || "")),
    status: normalizeOptionalText(String(row.status || "")) || "active",
    whatsappConnected: normalizeBoolean(row.whatsapp_connected),
    createdAt: String((row.created_at as string | undefined) || ""),
    updatedAt: String((row.updated_at as string | undefined) || ""),
  };
}

function normalizeIsoCandidate(value: unknown) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString();
}

function resolveLatestStatusRevision(candidates: unknown[]) {
  let latestIso = "";
  let latestMs = 0;

  for (const candidate of candidates) {
    const normalized = normalizeIsoCandidate(candidate);
    if (!normalized) continue;
    const parsed = Date.parse(normalized);
    if (!Number.isFinite(parsed)) continue;
    if (!latestIso || parsed > latestMs) {
      latestIso = normalized;
      latestMs = parsed;
    }
  }

  return latestIso;
}

function buildRealtimeSetupState(params: {
  onboarding: {
    completed?: boolean | null;
    whatsappConnected?: boolean | null;
    companyName?: string | null;
    updatedAt?: string | null;
    completedAt?: string | null;
    createdAt?: string | null;
  };
  systems: SystemSummary[];
  activeSummary?: SystemSummary | null;
}): RealtimeSetupState {
  const primaryOnboardingCompleted = Boolean(params.onboarding.completed);
  const primaryWhatsappConnected = Boolean(params.onboarding.whatsappConnected);
  const systemCount = params.systems.length;

  return {
    requiresPrimarySystemSetup:
      primaryOnboardingCompleted && primaryWhatsappConnected && systemCount === 0,
    primaryOnboardingCompleted,
    primaryWhatsappConnected,
    primaryCompanyName: normalizeOptionalText(String(params.onboarding.companyName || "")),
    systemCount,
    statusRevision:
      resolveLatestStatusRevision([
        params.activeSummary?.updatedAt,
        params.systems[0]?.updatedAt,
        params.onboarding.updatedAt,
        params.onboarding.completedAt,
        params.onboarding.createdAt,
      ]) || new Date(0).toISOString(),
  };
}

async function withContext(req: NextRequest) {
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

  const sessionUserId = normalizeOptionalText(String(session.userId || ""));
  const sessionEmail = normalizeEmail(session.email);
  if (!sessionUserId || !sessionEmail) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Sessao invalida." },
        { status: 401, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const sb = supabaseAdmin();
  const onboarding = await ensureOnboardingRecord({
    sb,
    sessionUserId,
    sessionEmail,
  });

  if (!onboarding.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error: onboarding.schemaReady === false ? BOT_SYSTEM_SQL_HINT : getErrorMessage(onboarding.error, "Nao foi possivel carregar onboarding."),
        },
        { status: onboarding.schemaReady === false ? 500 : 400, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    sb,
    onboarding: onboarding.record,
    sessionUserId,
    sessionEmail,
  };
}

async function listSystemSummaries(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
}) {
  const lookup = await params.sb
    .from(BOT_SYSTEM_TABLE)
    .select(BOT_SYSTEM_SUMMARY_COLUMNS)
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (lookup.error) {
    return {
      ok: false as const,
      error: lookup.error,
      systems: [] as SystemSummary[],
    };
  }

  const systems = ((lookup.data || []) as Record<string, unknown>[])
    .map((row) => mapDbRowToSummary(row))
    .filter((row): row is SystemSummary => Boolean(row));

  return {
    ok: true as const,
    systems,
  };
}

type ResolvedSaveSource = {
  onboardingId: string | null;
  companyOnboardingId: string | null;
  userId: string;
  authUserId: string | null;
  email: string;
  companyName: string | null;
  whatsappConnected: boolean;
  completed?: boolean;
  recoveredFromStaleCompanyContext?: boolean;
};

function buildPrimarySaveSource(
  ctx: Extract<Awaited<ReturnType<typeof withContext>>, { ok: true }>,
): ResolvedSaveSource {
  return {
    onboardingId: ctx.onboarding.id,
    companyOnboardingId: null,
    userId: ctx.onboarding.userId,
    authUserId: ctx.onboarding.authUserId || ctx.sessionUserId,
    email: ctx.onboarding.email || ctx.sessionEmail,
    companyName: ctx.onboarding.companyName || null,
    whatsappConnected: Boolean(ctx.onboarding.whatsappConnected),
  };
}

async function resolveSaveSource(params: {
  ctx: Extract<Awaited<ReturnType<typeof withContext>>, { ok: true }>;
  companyOnboardingId?: string | null;
  existingSystemRow?: Record<string, unknown> | null;
  allowPrimaryFallbackIfMissingCompanyContext?: boolean;
}) {
  const requestedCompanyOnboardingId = normalizeOptionalText(
    String(params.companyOnboardingId || ""),
  );

  if (!requestedCompanyOnboardingId) {
    return {
      ok: true as const,
      source: buildPrimarySaveSource(params.ctx),
    };
  }

  const additional = await ensureCompanyOnboardingRecord({
    sb: params.ctx.sb,
    sessionUserId: params.ctx.sessionUserId,
    sessionEmail: params.ctx.sessionEmail,
    companyOnboardingId: requestedCompanyOnboardingId,
    createIfMissing: false,
  });

  if (!additional.ok) {
    if (additional.schemaReady !== false && isCompanyOnboardingNotFoundError(additional.error)) {
      if (params.existingSystemRow) {
        const existingUserId =
          normalizeOptionalText(String(params.existingSystemRow.user_id || "")) ||
          params.ctx.onboarding.userId;
        const existingAuthUserId =
          normalizeOptionalText(String(params.existingSystemRow.auth_user_id || "")) ||
          params.ctx.onboarding.authUserId ||
          params.ctx.sessionUserId;
        const existingEmail =
          normalizeEmail(String(params.existingSystemRow.email || "")) ||
          params.ctx.onboarding.email ||
          params.ctx.sessionEmail;
        const existingCompanyName =
          normalizeOptionalText(String(params.existingSystemRow.company_name || "")) ||
          params.ctx.onboarding.companyName ||
          null;
        const existingWhatsappConnected =
          normalizeBoolean(params.existingSystemRow.whatsapp_connected) ||
          Boolean(params.ctx.onboarding.whatsappConnected);

        return {
          ok: true as const,
          source: {
            onboardingId: params.ctx.onboarding.id,
            companyOnboardingId: null,
            userId: existingUserId,
            authUserId: existingAuthUserId,
            email: existingEmail,
            companyName: existingCompanyName,
            whatsappConnected: existingWhatsappConnected,
            recoveredFromStaleCompanyContext: true,
          } satisfies ResolvedSaveSource,
        };
      }

      if (params.allowPrimaryFallbackIfMissingCompanyContext) {
        return {
          ok: true as const,
          source: {
            ...buildPrimarySaveSource(params.ctx),
            recoveredFromStaleCompanyContext: true,
          } satisfies ResolvedSaveSource,
        };
      }

      return {
        ok: false as const,
        response: NextResponse.json(
          {
            ok: false,
            errorCode: "STALE_COMPANY_ONBOARDING_CONTEXT",
            error:
              "Onboarding da empresa selecionada nao foi encontrado. Reabra o fluxo de adicionar empresa para continuar.",
          },
          { status: 409, headers: NO_STORE_HEADERS },
        ),
      };
    }

    const errorMessage =
      additional.schemaReady === false
        ? COMPANY_ONBOARDING_SCHEMA_HINT
        : getErrorMessage(additional.error, "Nao foi possivel carregar a empresa selecionada.");
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: errorMessage },
        { status: additional.schemaReady === false ? 500 : 400, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    source: {
      onboardingId: params.ctx.onboarding.id,
      companyOnboardingId: additional.record.id,
      userId: additional.record.userId,
      authUserId: additional.record.authUserId || params.ctx.sessionUserId,
      email: additional.record.email || params.ctx.sessionEmail,
      companyName: additional.record.companyName || null,
      whatsappConnected: Boolean(additional.record.whatsappConnected),
      completed: Boolean(additional.record.completed),
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await withContext(req);
    if (!ctx.ok) return ctx.response;
    scheduleOnboardingMaintenance({
      reason: "system-config-get",
      onboardingId: ctx.onboarding.id,
    });
    void ensurePersistedWhatsAppInstancesBootstrapped();

    const requestedSystemId = normalizeOptionalText(req.nextUrl.searchParams.get("systemId"));
    if (requestedSystemId && !isUuidLike(requestedSystemId)) {
      return NextResponse.json(
        { ok: false, error: "systemId invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const list = await listSystemSummaries({
      sb: ctx.sb,
      userId: ctx.onboarding.userId,
    });

    if (!list.ok) {
      if (isMissingBotSystemSchema(list.error)) {
        return NextResponse.json(
          { ok: false, error: BOT_SYSTEM_SQL_HINT },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }
      return NextResponse.json(
        { ok: false, error: getErrorMessage(list.error, "Nao foi possivel carregar sistemas.") },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const fallbackSystemId = list.systems[0]?.id || null;
    const targetSystemId = requestedSystemId || fallbackSystemId;
    if (!targetSystemId) {
      const realtimeState = buildRealtimeSetupState({
        onboarding: ctx.onboarding,
        systems: list.systems,
        activeSummary: null,
      });
      return NextResponse.json(
        {
          ok: true,
          whatsappConnected: Boolean(ctx.onboarding.whatsappConnected),
          hasSystem: false,
          companyName: ctx.onboarding.companyName || null,
          primaryCompanyName: realtimeState.primaryCompanyName,
          requiresPrimarySystemSetup: realtimeState.requiresPrimarySystemSetup,
          primaryOnboardingCompleted: realtimeState.primaryOnboardingCompleted,
          primaryWhatsappConnected: realtimeState.primaryWhatsappConnected,
          systemCount: realtimeState.systemCount,
          statusRevision: realtimeState.statusRevision,
          activeSystemId: null,
          activeCompanyOnboardingId: null,
          systems: [],
          systemConfig: null,
          createdAt: "",
          updatedAt: "",
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const lookup = await ctx.sb
      .from(BOT_SYSTEM_TABLE)
      .select(BOT_SYSTEM_CONFIG_COLUMNS)
      .eq("user_id", ctx.onboarding.userId)
      .eq("id", targetSystemId)
      .maybeSingle();

    if (lookup.error) {
      if (isMissingBotSystemSchema(lookup.error)) {
        return NextResponse.json(
          { ok: false, error: BOT_SYSTEM_SQL_HINT },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }
      return NextResponse.json(
        { ok: false, error: getErrorMessage(lookup.error, "Nao foi possivel carregar sistema.") },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    let row = (lookup.data || null) as Record<string, unknown> | null;
    if (!row && list.systems.length && requestedSystemId && requestedSystemId !== list.systems[0].id) {
      const fallbackLookup = await ctx.sb
        .from(BOT_SYSTEM_TABLE)
        .select(BOT_SYSTEM_CONFIG_COLUMNS)
        .eq("user_id", ctx.onboarding.userId)
        .eq("id", list.systems[0].id)
        .maybeSingle();
      if (!fallbackLookup.error) {
        row = (fallbackLookup.data || null) as Record<string, unknown> | null;
      }
    }

    const summary = row ? mapDbRowToSummary(row) : null;
    const systemConfig = row ? mapDbRowToConfig(row) : null;
    const activeSystemId = summary?.id || list.systems[0]?.id || null;
    const resolvedWhatsappConnected = summary
      ? Boolean(summary.whatsappConnected)
      : Boolean(ctx.onboarding.whatsappConnected);
    const resolvedCompanyName = summary?.companyName ?? ctx.onboarding.companyName ?? null;
    const realtimeState = buildRealtimeSetupState({
      onboarding: ctx.onboarding,
      systems: list.systems,
      activeSummary: summary,
    });

    return NextResponse.json(
      {
        ok: true,
        whatsappConnected: resolvedWhatsappConnected,
        hasSystem: Boolean(list.systems.length),
        companyName: resolvedCompanyName,
        primaryCompanyName: realtimeState.primaryCompanyName,
        requiresPrimarySystemSetup: realtimeState.requiresPrimarySystemSetup,
        primaryOnboardingCompleted: realtimeState.primaryOnboardingCompleted,
        primaryWhatsappConnected: realtimeState.primaryWhatsappConnected,
        systemCount: realtimeState.systemCount,
        statusRevision: realtimeState.statusRevision,
        activeSystemId,
        activeCompanyOnboardingId: summary?.companyOnboardingId || null,
        systems: list.systems,
        systemConfig,
        createdAt: String((row?.created_at as string | undefined) || ""),
        updatedAt: String((row?.updated_at as string | undefined) || ""),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Erro inesperado ao carregar sistema.") },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await withContext(req);
    if (!ctx.ok) return ctx.response;
    scheduleOnboardingMaintenance({
      reason: "system-config-post",
      onboardingId: ctx.onboarding.id,
    });
    void ensurePersistedWhatsAppInstancesBootstrapped();

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "").trim().toLowerCase();
    if (action !== "save-system-config") {
      return NextResponse.json(
        { ok: false, error: "Acao invalida." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const parsed = parseIncomingConfig(body.config);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const systemId = normalizeOptionalText(String(body.systemId || ""));
    if (systemId && !isUuidLike(systemId)) {
      return NextResponse.json(
        { ok: false, error: "systemId invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const requestedCompanyOnboardingId = normalizeOptionalText(
      String(body.companyOnboardingId || ""),
    );
    if (requestedCompanyOnboardingId && !isUuidLike(requestedCompanyOnboardingId)) {
      return NextResponse.json(
        { ok: false, error: "companyOnboardingId invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    let existingSystemRow: Record<string, unknown> | null = null;
    if (systemId) {
      const existingLookup = await ctx.sb
        .from(BOT_SYSTEM_TABLE)
        .select(BOT_SYSTEM_CONFIG_COLUMNS)
        .eq("id", systemId)
        .eq("user_id", ctx.onboarding.userId)
        .maybeSingle();

      if (existingLookup.error) {
        if (isMissingBotSystemSchema(existingLookup.error)) {
          return NextResponse.json(
            { ok: false, error: BOT_SYSTEM_SQL_HINT },
            { status: 500, headers: NO_STORE_HEADERS },
          );
        }
        return NextResponse.json(
          {
            ok: false,
            error: getErrorMessage(existingLookup.error, "Nao foi possivel carregar sistema atual."),
          },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      existingSystemRow = (existingLookup.data || null) as Record<string, unknown> | null;
      if (!existingSystemRow) {
        return NextResponse.json(
          { ok: false, error: "Sistema nao encontrado para atualizar." },
          { status: 404, headers: NO_STORE_HEADERS },
        );
      }
    }

    let allowPrimaryFallbackIfMissingCompanyContext = false;
    if (!systemId && requestedCompanyOnboardingId) {
      const anySystemLookup = await ctx.sb
        .from(BOT_SYSTEM_TABLE)
        .select("id")
        .eq("user_id", ctx.onboarding.userId)
        .limit(1);

      if (anySystemLookup.error) {
        if (isMissingBotSystemSchema(anySystemLookup.error)) {
          return NextResponse.json(
            { ok: false, error: BOT_SYSTEM_SQL_HINT },
            { status: 500, headers: NO_STORE_HEADERS },
          );
        }
        return NextResponse.json(
          {
            ok: false,
            error: getErrorMessage(
              anySystemLookup.error,
              "Nao foi possivel validar o contexto da empresa para criar o sistema.",
            ),
          },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      allowPrimaryFallbackIfMissingCompanyContext =
        !Array.isArray(anySystemLookup.data) || anySystemLookup.data.length === 0;
    }

    const source = await resolveSaveSource({
      ctx,
      companyOnboardingId:
        requestedCompanyOnboardingId ||
        normalizeOptionalText(String(existingSystemRow?.company_onboarding_id || "")) ||
        null,
      existingSystemRow,
      allowPrimaryFallbackIfMissingCompanyContext,
    });
    if (!source.ok) return source.response;

    const sourceCompanyOnboardingId = normalizeOptionalText(source.source.companyOnboardingId);
    if (sourceCompanyOnboardingId && !source.source.completed) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "ADDITIONAL_ONBOARDING_INCOMPLETE",
          error:
            "Finalize o onboarding da nova empresa antes de criar o sistema (incluindo conexao do WhatsApp).",
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    if (!source.source.whatsappConnected) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "WHATSAPP_NOT_CONNECTED",
          error:
            sourceCompanyOnboardingId
              ? "Conecte o WhatsApp da nova empresa no onboarding antes de criar o sistema."
              : "Conecte seu WhatsApp no onboarding antes de criar o sistema.",
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    if (!normalizeOptionalText(source.source.companyName)) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: sourceCompanyOnboardingId
            ? "ADDITIONAL_COMPANY_NAME_MISSING"
            : "PRIMARY_COMPANY_NAME_MISSING",
          error:
            sourceCompanyOnboardingId
              ? "Informe o nome da empresa no onboarding adicional antes de continuar."
              : "Nome da empresa nao encontrado no onboarding principal.",
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const payload = {
      onboarding_id: source.source.onboardingId,
      company_onboarding_id: source.source.companyOnboardingId,
      user_id: source.source.userId,
      auth_user_id: source.source.authUserId || ctx.sessionUserId,
      email: source.source.email || ctx.sessionEmail,
      company_name: source.source.companyName || null,
      whatsapp_connected: source.source.whatsappConnected,
      welcome_message: parsed.config.welcomeMessage,
      closing_message: parsed.config.closingMessage,
      out_of_hours_message: parsed.config.outOfHoursMessage,
      weekly_schedule: parsed.config.weeklySchedule,
      ai_instructions: parsed.config.aiInstructions,
      ai_fallback_message: parsed.config.aiFallbackMessage,
      ai_response_tone: parsed.config.aiResponseTone,
      ai_response_size: parsed.config.aiResponseSize,
      ai_collect_name: parsed.config.aiCollectName,
      ai_collect_email: parsed.config.aiCollectEmail,
      ai_collect_phone: parsed.config.aiCollectPhone,
      ai_transfer_to_human_when_uncertain: parsed.config.aiTransferToHumanWhenUncertain,
      status: "active",
    };

    const save = systemId
      ? await ctx.sb
          .from(BOT_SYSTEM_TABLE)
          .update(payload)
          .eq("id", systemId)
          .eq("user_id", source.source.userId)
          .select(BOT_SYSTEM_CONFIG_COLUMNS)
          .maybeSingle()
      : await ctx.sb
          .from(BOT_SYSTEM_TABLE)
          .insert(payload)
          .select(BOT_SYSTEM_CONFIG_COLUMNS)
          .single();

    if (save.error) {
      if (isMissingBotSystemSchema(save.error)) {
        return NextResponse.json(
          { ok: false, error: BOT_SYSTEM_SQL_HINT },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }
      if (isLegacySingleSystemConstraint(save.error)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Sua base ainda esta no modo de sistema unico. Reexecute o SQL /sql/wz_bot_systems_create.sql para habilitar varios sistemas por conta.",
          },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
      return NextResponse.json(
        { ok: false, error: getErrorMessage(save.error, "Nao foi possivel salvar sistema.") },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const row = (save.data || null) as Record<string, unknown> | null;
    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Sistema nao encontrado para salvar." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const list = await listSystemSummaries({
      sb: ctx.sb,
      userId: ctx.onboarding.userId,
    });

    if (!list.ok) {
      if (isMissingBotSystemSchema(list.error)) {
        return NextResponse.json(
          { ok: false, error: BOT_SYSTEM_SQL_HINT },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }
      return NextResponse.json(
        { ok: false, error: getErrorMessage(list.error, "Nao foi possivel carregar sistemas.") },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const savedSummary = mapDbRowToSummary(row);
    const realtimeState = buildRealtimeSetupState({
      onboarding: ctx.onboarding,
      systems: list.systems,
      activeSummary: savedSummary,
    });
    return NextResponse.json(
      {
        ok: true,
        hasSystem: true,
        companyName: savedSummary?.companyName || source.source.companyName || null,
        primaryCompanyName: realtimeState.primaryCompanyName,
        requiresPrimarySystemSetup: realtimeState.requiresPrimarySystemSetup,
        primaryOnboardingCompleted: realtimeState.primaryOnboardingCompleted,
        primaryWhatsappConnected: realtimeState.primaryWhatsappConnected,
        systemCount: realtimeState.systemCount,
        statusRevision: realtimeState.statusRevision,
        activeSystemId: savedSummary?.id || null,
        activeCompanyOnboardingId:
          savedSummary?.companyOnboardingId || source.source.companyOnboardingId || null,
        recoveredCompanyContext: Boolean(source.source.recoveredFromStaleCompanyContext),
        systems: list.systems,
        systemConfig: mapDbRowToConfig(row),
        createdAt: String((row.created_at as string | undefined) || ""),
        updatedAt: String((row.updated_at as string | undefined) || ""),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Erro inesperado ao salvar sistema.") },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
