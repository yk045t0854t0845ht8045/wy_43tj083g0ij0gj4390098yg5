import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  ensureOnboardingRecord,
  normalizeEmail,
  normalizeOptionalText,
} from "@/app/api/wz_users/_onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const BOT_SYSTEM_TABLE = "wz_bot_systems";
const BOT_SYSTEM_SQL_HINT =
  "Estrutura do sistema de WhatsApp nao encontrada. Execute o SQL /sql/wz_bot_systems_create.sql no Supabase.";

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

function getErrorMessage(error: unknown, fallback: string) {
  const message = String((error as { message?: unknown } | null)?.message || "").trim();
  return message || fallback;
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
  return (
    message.includes(BOT_SYSTEM_TABLE) ||
    details.includes(BOT_SYSTEM_TABLE) ||
    hint.includes(BOT_SYSTEM_TABLE)
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
    aiInstructions: normalizeLongText(row.ai_instructions, 2400),
    aiFallbackMessage: normalizeLongText(row.ai_fallback_message, 1200),
    aiResponseTone: normalizeTone(row.ai_response_tone),
    aiResponseSize: normalizeResponseSize(row.ai_response_size),
    aiCollectName: normalizeBoolean(row.ai_collect_name),
    aiCollectEmail: normalizeBoolean(row.ai_collect_email),
    aiCollectPhone: normalizeBoolean(row.ai_collect_phone),
    aiTransferToHumanWhenUncertain: normalizeBoolean(row.ai_transfer_to_human_when_uncertain),
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

export async function GET(req: NextRequest) {
  try {
    const ctx = await withContext(req);
    if (!ctx.ok) return ctx.response;

    const lookup = await ctx.sb
      .from(BOT_SYSTEM_TABLE)
      .select(
        "id,welcome_message,closing_message,out_of_hours_message,weekly_schedule,ai_instructions,ai_fallback_message,ai_response_tone,ai_response_size,ai_collect_name,ai_collect_email,ai_collect_phone,ai_transfer_to_human_when_uncertain,created_at,updated_at",
      )
      .eq("user_id", ctx.onboarding.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
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

    const row = (lookup.data || null) as Record<string, unknown> | null;
    const systemConfig = row ? mapDbRowToConfig(row) : null;

    return NextResponse.json(
      {
        ok: true,
        whatsappConnected: Boolean(ctx.onboarding.whatsappConnected),
        hasSystem: Boolean(systemConfig),
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "").trim().toLowerCase();
    if (action !== "save-system-config") {
      return NextResponse.json(
        { ok: false, error: "Acao invalida." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!ctx.onboarding.whatsappConnected) {
      return NextResponse.json(
        { ok: false, error: "Conecte seu WhatsApp no onboarding antes de criar o sistema." },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const parsed = parseIncomingConfig(body.config);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const payload = {
      onboarding_id: ctx.onboarding.id,
      user_id: ctx.onboarding.userId,
      auth_user_id: ctx.onboarding.authUserId || ctx.sessionUserId,
      email: ctx.onboarding.email || ctx.sessionEmail,
      company_name: ctx.onboarding.companyName || null,
      whatsapp_connected: true,
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

    const save = await ctx.sb
      .from(BOT_SYSTEM_TABLE)
      .upsert(payload, { onConflict: "user_id" })
      .select(
        "id,welcome_message,closing_message,out_of_hours_message,weekly_schedule,ai_instructions,ai_fallback_message,ai_response_tone,ai_response_size,ai_collect_name,ai_collect_email,ai_collect_phone,ai_transfer_to_human_when_uncertain,created_at,updated_at",
      )
      .single();

    if (save.error) {
      if (isMissingBotSystemSchema(save.error)) {
        return NextResponse.json(
          { ok: false, error: BOT_SYSTEM_SQL_HINT },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }
      return NextResponse.json(
        { ok: false, error: getErrorMessage(save.error, "Nao foi possivel salvar sistema.") },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const row = (save.data || {}) as Record<string, unknown>;
    return NextResponse.json(
      {
        ok: true,
        hasSystem: true,
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
