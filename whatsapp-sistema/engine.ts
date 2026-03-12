import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { buildWhatsAppInstanceName } from "./instance-name";
import { getWhatsAppInstanceBinding, registerWhatsAppInstanceBinding } from "./instance-registry";
import {
  hasProcessedMessage,
  markProcessedMessage,
  readContactState,
  writeContactState,
} from "./runtime-store";
import type {
  BotSystemRuntimeConfig,
  ContactField,
  ContactRuntimeState,
  DaySchedule,
  InboundWhatsAppMessage,
  InstanceBinding,
} from "./types";

const BOT_SYSTEM_TABLE = "wz_bot_systems";
const DEFAULT_TIME_ZONE = process.env.WHATSAPP_SYSTEM_TIME_ZONE || "America/Sao_Paulo";
const OUT_OF_HOURS_COOLDOWN_MS = 1000 * 60 * 30;
const STALE_CONVERSATION_MS = 1000 * 60 * 60 * 12;

const SYSTEM_COLUMNS = [
  "id",
  "user_id",
  "onboarding_id",
  "company_onboarding_id",
  "company_name",
  "whatsapp_connected",
  "status",
  "welcome_message",
  "closing_message",
  "out_of_hours_message",
  "weekly_schedule",
  "ai_collect_name",
  "ai_collect_email",
  "ai_collect_phone",
  "updated_at",
].join(",");

function nowIso() {
  return new Date().toISOString();
}

function parseIsoMs(value?: string | null) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown, maxLength = 2000) {
  const clean = String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (!clean) return "";
  return clean.slice(0, maxLength);
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

function normalizeTime(value: unknown) {
  const clean = String(value || "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clean)) return "";
  return clean;
}

function normalizeSchedule(input: unknown): DaySchedule[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const record = row as Record<string, unknown>;
      const day = String(record.day || "").trim().toLowerCase();
      if (
        day !== "mon" &&
        day !== "tue" &&
        day !== "wed" &&
        day !== "thu" &&
        day !== "fri" &&
        day !== "sat" &&
        day !== "sun"
      ) {
        return null;
      }

      return {
        day,
        enabled: normalizeBoolean(record.enabled),
        start: normalizeTime(record.start),
        end: normalizeTime(record.end),
      } satisfies DaySchedule;
    })
    .filter((row): row is DaySchedule => Boolean(row));
}

function mapRuntimeSystem(row: Record<string, unknown>): BotSystemRuntimeConfig | null {
  const id = normalizeText(row.id, 120);
  const userId = normalizeText(row.user_id, 200);
  if (!id || !userId) return null;

  return {
    id,
    userId,
    onboardingId: normalizeText(row.onboarding_id, 120) || null,
    companyOnboardingId: normalizeText(row.company_onboarding_id, 120) || null,
    companyName: normalizeText(row.company_name, 160) || null,
    whatsappConnected: normalizeBoolean(row.whatsapp_connected),
    status: normalizeText(row.status, 40) || "active",
    welcomeMessage:
      normalizeText(row.welcome_message, 1200) ||
      "Ola! Recebemos sua mensagem e iniciaremos seu atendimento em instantes.",
    closingMessage:
      normalizeText(row.closing_message, 1200) ||
      "Atendimento registrado com sucesso. Nossa equipe seguira com o suporte em breve.",
    outOfHoursMessage:
      normalizeText(row.out_of_hours_message, 1200) ||
      "No momento estamos fora do horario de atendimento. Deixe sua mensagem e retornaremos no proximo periodo util.",
    weeklySchedule: normalizeSchedule(row.weekly_schedule),
    aiCollectName: normalizeBoolean(row.ai_collect_name),
    aiCollectEmail: normalizeBoolean(row.ai_collect_email),
    aiCollectPhone: normalizeBoolean(row.ai_collect_phone),
    updatedAt: normalizeText(row.updated_at, 80) || nowIso(),
  };
}

function normalizeContactKey(remoteJid: string) {
  const clean = String(remoteJid || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) return "";
  const base = clean.split("@")[0] || "";
  const withoutDevice = base.split(":")[0] || "";
  const digits = withoutDevice.replace(/\D+/g, "");
  return digits || withoutDevice;
}

function shouldIgnoreRemoteJid(remoteJid: string) {
  const clean = String(remoteJid || "").trim().toLowerCase();
  return (
    !clean ||
    clean === "status@broadcast" ||
    clean.endsWith("@g.us") ||
    clean.endsWith("@newsletter")
  );
}

function createDefaultContactState(contactKey: string, remoteJid: string, pushName?: string | null) {
  return {
    contactKey,
    remoteJid,
    displayName: normalizeText(pushName, 80) || null,
    collectedName: null,
    collectedEmail: null,
    collectedPhone: null,
    pendingField: null,
    lastInboundText: null,
    lastInboundAt: null,
    lastAutoReplyAt: null,
    lastAutoReplyKind: null,
    lastCompletedAt: null,
    updatedAt: nowIso(),
  } satisfies ContactRuntimeState;
}

function buildBrandHeader(companyName: string) {
  return `*${companyName}*`;
}

function joinMessageSections(sections: Array<string | null | undefined>) {
  return sections
    .map((value) => normalizeText(value, 4000))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function buildFieldPrompt(field: ContactField, companyName: string) {
  if (field === "name") {
    return `Para continuar o atendimento da ${companyName}, por favor informe seu nome completo.`;
  }
  if (field === "email") {
    return `Para continuar o atendimento da ${companyName}, por favor informe seu melhor e-mail.`;
  }
  return `Para continuar o atendimento da ${companyName}, por favor informe seu telefone com DDD.`;
}

function buildInvalidFieldPrompt(field: ContactField, companyName: string) {
  if (field === "name") {
    return `Nao consegui identificar seu nome. Envie apenas seu nome completo para seguirmos com o atendimento da ${companyName}.`;
  }
  if (field === "email") {
    return `Nao consegui validar o e-mail informado. Envie um e-mail valido para seguirmos com o atendimento da ${companyName}.`;
  }
  return `Nao consegui validar o telefone informado. Envie o numero com DDD para seguirmos com o atendimento da ${companyName}.`;
}

function buildFieldConfirmedText(field: ContactField, state: ContactRuntimeState) {
  if (field === "name" && state.collectedName) {
    return `Perfeito, ${state.collectedName}.`;
  }
  if (field === "email") {
    return "E-mail registrado com sucesso.";
  }
  return "Telefone registrado com sucesso.";
}

function buildCompletionMessage(system: BotSystemRuntimeConfig, state: ContactRuntimeState) {
  const companyName = system.companyName || "Sua empresa";
  const intro = state.collectedName
    ? `Perfeito, ${state.collectedName}. Seus dados foram registrados para o atendimento da ${companyName}.`
    : `Perfeito. Seus dados foram registrados para o atendimento da ${companyName}.`;

  return joinMessageSections([
    buildBrandHeader(companyName),
    intro,
    system.closingMessage,
  ]);
}

function buildWelcomeMessage(system: BotSystemRuntimeConfig, nextField: ContactField | null) {
  const companyName = system.companyName || "Sua empresa";
  return joinMessageSections([
    buildBrandHeader(companyName),
    system.welcomeMessage,
    nextField ? buildFieldPrompt(nextField, companyName) : null,
  ]);
}

function buildOutOfHoursMessage(system: BotSystemRuntimeConfig) {
  const companyName = system.companyName || "Sua empresa";
  return joinMessageSections([
    buildBrandHeader(companyName),
    system.outOfHoursMessage,
  ]);
}

function resolveRequiredFields(system: BotSystemRuntimeConfig): ContactField[] {
  const required: ContactField[] = [];
  if (system.aiCollectName) required.push("name");
  if (system.aiCollectEmail) required.push("email");
  if (system.aiCollectPhone) required.push("phone");
  return required;
}

function resolveNextMissingField(
  requiredFields: ContactField[],
  state: ContactRuntimeState,
): ContactField | null {
  for (const field of requiredFields) {
    if (field === "name" && !state.collectedName) return field;
    if (field === "email" && !state.collectedEmail) return field;
    if (field === "phone" && !state.collectedPhone) return field;
  }
  return null;
}

function extractEmailCandidate(text: string) {
  const match = normalizeText(text, 320).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim().toLowerCase() || null;
}

function extractPhoneCandidate(text: string) {
  const digits = String(text || "").replace(/\D+/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

function extractNameCandidate(text: string) {
  const withoutPrefix = normalizeText(text, 120)
    .replace(/^(meu nome e|me chamo|sou|nome[:\-]?)\s+/i, "")
    .trim();
  if (!withoutPrefix) return null;
  if (withoutPrefix.length < 2 || withoutPrefix.length > 60) return null;
  if (withoutPrefix.includes("@")) return null;
  if (!/^[\p{L}][\p{L}\s'.-]+$/u.test(withoutPrefix)) return null;

  const words = withoutPrefix.split(/\s+/).filter(Boolean);
  if (words.length > 4) return null;
  return withoutPrefix;
}

function parseFieldValue(field: ContactField, text: string) {
  if (field === "name") return extractNameCandidate(text);
  if (field === "email") return extractEmailCandidate(text);
  return extractPhoneCandidate(text);
}

function resolveScheduleSnapshot(schedule: DaySchedule[], referenceIso: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(referenceIso))
      .map((part) => [part.type, part.value]),
  );

  const weekday = String(parts.weekday || "").toLowerCase();
  const hour = String(parts.hour || "00").padStart(2, "0");
  const minute = String(parts.minute || "00").padStart(2, "0");
  const currentTime = `${hour}:${minute}`;
  const weekdayMap: Record<string, DaySchedule["day"]> = {
    mon: "mon",
    tue: "tue",
    wed: "wed",
    thu: "thu",
    fri: "fri",
    sat: "sat",
    sun: "sun",
  };

  const day = weekdayMap[weekday];
  if (!day) return { isOpen: false };

  const row = schedule.find((item) => item.day === day && item.enabled) || null;
  if (!row || !row.start || !row.end) return { isOpen: false };

  return {
    isOpen: currentTime >= row.start && currentTime < row.end,
  };
}

function cloneState(state: ContactRuntimeState) {
  return {
    ...state,
  };
}

async function resolveBindingFromActiveSystems(instanceName: string) {
  const sb = supabaseAdmin();
  const lookup = await sb
    .from(BOT_SYSTEM_TABLE)
    .select("user_id,onboarding_id,company_onboarding_id,company_name,status,whatsapp_connected,updated_at")
    .eq("status", "active")
    .eq("whatsapp_connected", true)
    .order("updated_at", { ascending: false })
    .limit(250);

  if (lookup.error) {
    console.error("[whatsapp-sistema] failed to resolve binding from systems:", lookup.error);
    return null;
  }

  for (const row of (lookup.data || []) as Array<Record<string, unknown>>) {
    const userId = normalizeText(row.user_id, 200);
    if (!userId) continue;
    const companyOnboardingId = normalizeText(row.company_onboarding_id, 120) || null;
    const expectedInstanceName = buildWhatsAppInstanceName(userId, companyOnboardingId);
    if (expectedInstanceName !== instanceName) continue;

    const binding: InstanceBinding = {
      instanceName,
      userId,
      onboardingId: normalizeText(row.onboarding_id, 120) || null,
      companyOnboardingId,
      companyName: normalizeText(row.company_name, 160) || null,
    };
    registerWhatsAppInstanceBinding(binding);
    return binding;
  }

  return null;
}

async function resolveBinding(instanceName: string) {
  const cached = getWhatsAppInstanceBinding(instanceName);
  if (cached) return cached;
  return await resolveBindingFromActiveSystems(instanceName);
}

async function loadSystemConfig(binding: InstanceBinding) {
  const sb = supabaseAdmin();
  let query = sb
    .from(BOT_SYSTEM_TABLE)
    .select(SYSTEM_COLUMNS)
    .eq("user_id", binding.userId)
    .eq("status", "active")
    .eq("whatsapp_connected", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (binding.companyOnboardingId) {
    query = query.eq("company_onboarding_id", binding.companyOnboardingId);
  } else if (binding.onboardingId) {
    query = query.eq("onboarding_id", binding.onboardingId).is("company_onboarding_id", null);
  } else {
    query = query.is("company_onboarding_id", null);
  }

  const lookup = await query.maybeSingle();
  if (lookup.error) {
    console.error("[whatsapp-sistema] failed to load system config:", lookup.error);
    return null;
  }

  const row = (lookup.data || null) as Record<string, unknown> | null;
  if (!row) return null;
  return mapRuntimeSystem(row);
}

function canRepeatKind(state: ContactRuntimeState, kind: string, nowMs: number, cooldownMs: number) {
  if (state.lastAutoReplyKind !== kind) return true;
  const lastReplyMs = parseIsoMs(state.lastAutoReplyAt);
  if (!lastReplyMs) return true;
  return nowMs - lastReplyMs >= cooldownMs;
}

function buildReplyDecision(params: {
  system: BotSystemRuntimeConfig;
  previousState: ContactRuntimeState;
  remoteJid: string;
  text: string;
  pushName?: string | null;
  receivedAt: string;
}) {
  const nextState = cloneState(params.previousState);
  const nowMs = parseIsoMs(params.receivedAt);
  const lastInboundMs = parseIsoMs(nextState.lastInboundAt);
  const isNewConversation = !lastInboundMs || nowMs - lastInboundMs >= STALE_CONVERSATION_MS;

  nextState.remoteJid = params.remoteJid;
  if (params.pushName) {
    nextState.displayName = normalizeText(params.pushName, 80) || nextState.displayName;
  }
  if (isNewConversation) {
    nextState.pendingField = null;
  }
  nextState.lastInboundText = params.text;
  nextState.lastInboundAt = params.receivedAt;
  nextState.updatedAt = params.receivedAt;

  const schedule = resolveScheduleSnapshot(params.system.weeklySchedule, params.receivedAt);
  if (!schedule.isOpen) {
    const outboundText = canRepeatKind(nextState, "out_of_hours", nowMs, OUT_OF_HOURS_COOLDOWN_MS)
      ? buildOutOfHoursMessage(params.system)
      : null;
    if (outboundText) {
      nextState.lastAutoReplyAt = params.receivedAt;
      nextState.lastAutoReplyKind = "out_of_hours";
    }
    return { nextState, outboundText };
  }

  const companyName = params.system.companyName || "Sua empresa";
  const requiredFields = resolveRequiredFields(params.system);

  if (nextState.pendingField) {
    const capturedValue = parseFieldValue(nextState.pendingField, params.text);
    if (!capturedValue) {
      const outboundText = joinMessageSections([
        buildBrandHeader(companyName),
        buildInvalidFieldPrompt(nextState.pendingField, companyName),
      ]);
      nextState.lastAutoReplyAt = params.receivedAt;
      nextState.lastAutoReplyKind = `ask_${nextState.pendingField}`;
      return { nextState, outboundText };
    }

    if (nextState.pendingField === "name") {
      nextState.collectedName = capturedValue;
    } else if (nextState.pendingField === "email") {
      nextState.collectedEmail = capturedValue;
    } else {
      nextState.collectedPhone = capturedValue;
    }

    const handledField = nextState.pendingField;
    nextState.pendingField = null;

    const nextMissingField = resolveNextMissingField(requiredFields, nextState);
    if (nextMissingField) {
      nextState.pendingField = nextMissingField;
      const outboundText = joinMessageSections([
        buildBrandHeader(companyName),
        buildFieldConfirmedText(handledField, nextState),
        buildFieldPrompt(nextMissingField, companyName),
      ]);
      nextState.lastAutoReplyAt = params.receivedAt;
      nextState.lastAutoReplyKind = `ask_${nextMissingField}`;
      return { nextState, outboundText };
    }

    nextState.lastCompletedAt = params.receivedAt;
    nextState.lastAutoReplyAt = params.receivedAt;
    nextState.lastAutoReplyKind = "completed";
    return { nextState, outboundText: buildCompletionMessage(params.system, nextState) };
  }

  const nextMissingField = resolveNextMissingField(requiredFields, nextState);
  if (isNewConversation) {
    if (nextMissingField) {
      nextState.pendingField = nextMissingField;
      nextState.lastAutoReplyAt = params.receivedAt;
      nextState.lastAutoReplyKind = `ask_${nextMissingField}`;
      return { nextState, outboundText: buildWelcomeMessage(params.system, nextMissingField) };
    }

    nextState.lastAutoReplyAt = params.receivedAt;
    nextState.lastAutoReplyKind = "welcome";
    return { nextState, outboundText: buildWelcomeMessage(params.system, null) };
  }

  if (nextMissingField) {
    nextState.pendingField = nextMissingField;
    nextState.lastAutoReplyAt = params.receivedAt;
    nextState.lastAutoReplyKind = `ask_${nextMissingField}`;
    return {
      nextState,
      outboundText: joinMessageSections([
        buildBrandHeader(companyName),
        buildFieldPrompt(nextMissingField, companyName),
      ]),
    };
  }

  return { nextState, outboundText: null };
}

export async function handleInboundWhatsAppMessage(params: InboundWhatsAppMessage) {
  const instanceName = normalizeText(params.instanceName, 120);
  const remoteJid = normalizeText(params.remoteJid, 160).toLowerCase();
  const messageId = normalizeText(params.messageId, 200);
  const inboundText = normalizeText(params.text, 2000);
  if (!instanceName || !remoteJid || !messageId || !inboundText) return;
  if (shouldIgnoreRemoteJid(remoteJid)) return;

  const processedKey = `${remoteJid}:${messageId}`;
  if (await hasProcessedMessage(instanceName, processedKey)) return;

  const binding = await resolveBinding(instanceName);
  if (!binding) {
    await markProcessedMessage(instanceName, processedKey);
    return;
  }

  const system = await loadSystemConfig(binding);
  if (!system || !system.whatsappConnected || system.status !== "active") {
    await markProcessedMessage(instanceName, processedKey);
    return;
  }

  const contactKey = normalizeContactKey(remoteJid);
  if (!contactKey) {
    await markProcessedMessage(instanceName, processedKey);
    return;
  }

  const previousState =
    (await readContactState(instanceName, contactKey)) ||
    createDefaultContactState(contactKey, remoteJid, params.pushName || null);
  const receivedAt = normalizeText(params.receivedAt, 80) || nowIso();
  const decision = buildReplyDecision({
    system,
    previousState,
    remoteJid,
    text: inboundText,
    pushName: params.pushName || null,
    receivedAt,
  });

  if (decision.outboundText) {
    const sendResult = await params.sendText(remoteJid, decision.outboundText);
    if (!sendResult.ok) {
      console.error(
        "[whatsapp-sistema] failed to send outbound message:",
        sendResult.error || "unknown error",
      );
      return;
    }
  }

  await writeContactState(instanceName, contactKey, decision.nextState);
  await markProcessedMessage(instanceName, processedKey, receivedAt);
}
