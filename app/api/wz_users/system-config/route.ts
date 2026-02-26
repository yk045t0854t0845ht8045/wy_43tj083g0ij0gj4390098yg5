import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  ensureOnboardingRecord,
  normalizeBoolean,
  normalizeEmail,
  normalizeOptionalText,
  ONBOARDING_SCHEMA_HINT,
} from "@/app/api/wz_users/_onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const BOT_SYSTEM_METADATA_KEY = "bot_system_mvp";
const BOT_SYSTEM_CONFIG_VERSION = 1;

const OPERATION_DAY_VALUES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type OperationDay = (typeof OPERATION_DAY_VALUES)[number];

type BotSystemConfig = {
  version: number;
  systemName: string;
  companyContext: string;
  assistantRole: string;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  operationDays: OperationDay[];
  operationStart: string;
  operationEnd: string;
  outOfHoursMessage: string;
  fallbackMessage: string;
  humanHandoffEnabled: boolean;
  humanHandoffMessage: string;
  createdAt: string;
  updatedAt: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  const message = String((error as { message?: unknown } | null)?.message || "").trim();
  return message || fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeShortText(value: unknown, maxLength = 120) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.slice(0, maxLength);
}

function normalizeLongText(value: unknown, maxLength = 1200) {
  const clean = String(value || "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
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

function normalizeOperationDays(value: unknown): OperationDay[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<OperationDay>();
  for (const item of value) {
    const clean = String(item || "").trim().toLowerCase();
    if ((OPERATION_DAY_VALUES as readonly string[]).includes(clean)) {
      seen.add(clean as OperationDay);
    }
  }
  return OPERATION_DAY_VALUES.filter((day) => seen.has(day));
}

function normalizeBooleanInput(value: unknown) {
  return normalizeBoolean(value);
}

function normalizeStoredConfig(value: unknown): BotSystemConfig | null {
  const record = asRecord(value);
  if (!record) return null;

  const operationDays = normalizeOperationDays(record.operationDays);
  const operationStart = normalizeTime(record.operationStart);
  const operationEnd = normalizeTime(record.operationEnd);
  const systemName = normalizeShortText(record.systemName, 90);
  const companyContext = normalizeLongText(record.companyContext, 1800);
  const assistantRole = normalizeLongText(record.assistantRole, 1800);
  const welcomeEnabled = normalizeBooleanInput(record.welcomeEnabled);
  const welcomeMessage = normalizeLongText(record.welcomeMessage, 1200);
  const outOfHoursMessage = normalizeLongText(record.outOfHoursMessage, 1200);
  const fallbackMessage = normalizeLongText(record.fallbackMessage, 1200);
  const humanHandoffEnabled = normalizeBooleanInput(record.humanHandoffEnabled);
  const humanHandoffMessage = normalizeLongText(record.humanHandoffMessage, 1200);
  const createdAt = String(record.createdAt || "").trim();
  const updatedAt = String(record.updatedAt || "").trim();
  const versionRaw = Number(record.version);
  const version = Number.isFinite(versionRaw) && versionRaw > 0 ? Math.trunc(versionRaw) : BOT_SYSTEM_CONFIG_VERSION;

  if (
    !systemName ||
    !companyContext ||
    !assistantRole ||
    !operationDays.length ||
    !operationStart ||
    !operationEnd ||
    !outOfHoursMessage ||
    !fallbackMessage
  ) {
    return null;
  }
  if (welcomeEnabled && !welcomeMessage) return null;
  if (humanHandoffEnabled && !humanHandoffMessage) return null;

  return {
    version,
    systemName,
    companyContext,
    assistantRole,
    welcomeEnabled,
    welcomeMessage,
    operationDays,
    operationStart,
    operationEnd,
    outOfHoursMessage,
    fallbackMessage,
    humanHandoffEnabled,
    humanHandoffMessage,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
  };
}

function parseIncomingConfig(value: unknown) {
  const raw = asRecord(value);
  if (!raw) {
    return { ok: false as const, error: "Configuracao do sistema invalida." };
  }

  const systemName = normalizeShortText(raw.systemName, 90);
  const companyContext = normalizeLongText(raw.companyContext, 1800);
  const assistantRole = normalizeLongText(raw.assistantRole, 1800);
  const welcomeEnabled = normalizeBooleanInput(raw.welcomeEnabled);
  const welcomeMessage = normalizeLongText(raw.welcomeMessage, 1200);
  const operationDays = normalizeOperationDays(raw.operationDays);
  const operationStart = normalizeTime(raw.operationStart);
  const operationEnd = normalizeTime(raw.operationEnd);
  const outOfHoursMessage = normalizeLongText(raw.outOfHoursMessage, 1200);
  const fallbackMessage = normalizeLongText(raw.fallbackMessage, 1200);
  const humanHandoffEnabled = normalizeBooleanInput(raw.humanHandoffEnabled);
  const humanHandoffMessage = normalizeLongText(raw.humanHandoffMessage, 1200);

  if (!systemName) return { ok: false as const, error: "Informe o nome do sistema." };
  if (!companyContext) {
    return { ok: false as const, error: "Descreva brevemente sua empresa e servicos." };
  }
  if (!assistantRole) {
    return { ok: false as const, error: "Explique como o bot deve agir no atendimento." };
  }
  if (welcomeEnabled && !welcomeMessage) {
    return { ok: false as const, error: "Informe a mensagem de boas-vindas." };
  }
  if (!operationDays.length) {
    return { ok: false as const, error: "Selecione pelo menos um dia de atendimento." };
  }
  if (!operationStart || !operationEnd) {
    return { ok: false as const, error: "Informe o horario inicial e final de atendimento." };
  }
  if (operationStart === operationEnd) {
    return { ok: false as const, error: "O horario inicial deve ser diferente do horario final." };
  }
  if (!outOfHoursMessage) {
    return { ok: false as const, error: "Informe a mensagem para fora do horario de atendimento." };
  }
  if (!fallbackMessage) {
    return { ok: false as const, error: "Informe a mensagem para quando o bot nao entender." };
  }
  if (humanHandoffEnabled && !humanHandoffMessage) {
    return { ok: false as const, error: "Informe a mensagem de encaminhamento para atendimento humano." };
  }

  return {
    ok: true as const,
    config: {
      systemName,
      companyContext,
      assistantRole,
      welcomeEnabled,
      welcomeMessage,
      operationDays,
      operationStart,
      operationEnd,
      outOfHoursMessage,
      fallbackMessage,
      humanHandoffEnabled,
      humanHandoffMessage,
    },
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
          error:
            onboarding.schemaReady === false
              ? ONBOARDING_SCHEMA_HINT
              : getErrorMessage(onboarding.error, "Nao foi possivel carregar onboarding."),
        },
        { status: onboarding.schemaReady === false ? 500 : 400, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    sb,
    onboarding: onboarding.record,
  };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await withContext(req);
    if (!ctx.ok) return ctx.response;

    const rowRes = await ctx.sb
      .from("wz_onboarding")
      .select("whatsapp_connected,metadata,updated_at")
      .eq("id", ctx.onboarding.id)
      .single();

    if (rowRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: getErrorMessage(rowRes.error, "Nao foi possivel carregar configuracao do sistema."),
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const row = (rowRes.data || {}) as {
      whatsapp_connected?: unknown;
      metadata?: unknown;
      updated_at?: string | null;
    };

    const metadata = asRecord(row.metadata) || {};
    const savedConfig = normalizeStoredConfig(metadata[BOT_SYSTEM_METADATA_KEY]);

    return NextResponse.json(
      {
        ok: true,
        whatsappConnected: normalizeBoolean(row.whatsapp_connected) || ctx.onboarding.whatsappConnected,
        hasSystem: Boolean(savedConfig),
        systemConfig: savedConfig || null,
        onboardingUpdatedAt: String(row.updated_at || ctx.onboarding.updatedAt || "") || null,
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

    const rowRes = await ctx.sb
      .from("wz_onboarding")
      .select("whatsapp_connected,metadata")
      .eq("id", ctx.onboarding.id)
      .single();

    if (rowRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: getErrorMessage(rowRes.error, "Nao foi possivel carregar dados do onboarding."),
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const row = (rowRes.data || {}) as {
      whatsapp_connected?: unknown;
      metadata?: unknown;
    };

    const whatsappConnected = normalizeBoolean(row.whatsapp_connected) || ctx.onboarding.whatsappConnected;
    if (!whatsappConnected) {
      return NextResponse.json(
        {
          ok: false,
          error: "Conecte seu WhatsApp no onboarding antes de criar o sistema.",
        },
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

    const nowIso = new Date().toISOString();
    const metadata = asRecord(row.metadata) || {};
    const existingSaved = normalizeStoredConfig(metadata[BOT_SYSTEM_METADATA_KEY]);

    const nextConfig: BotSystemConfig = {
      version: BOT_SYSTEM_CONFIG_VERSION,
      ...parsed.config,
      createdAt: existingSaved?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const nextMetadata = {
      ...metadata,
      [BOT_SYSTEM_METADATA_KEY]: nextConfig,
    };

    const updateRes = await ctx.sb
      .from("wz_onboarding")
      .update({ metadata: nextMetadata })
      .eq("id", ctx.onboarding.id)
      .select("updated_at")
      .single();

    if (updateRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: getErrorMessage(updateRes.error, "Nao foi possivel salvar configuracao do sistema."),
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        hasSystem: true,
        systemConfig: nextConfig,
        savedAt: String((updateRes.data as { updated_at?: string | null } | null)?.updated_at || nowIso),
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

