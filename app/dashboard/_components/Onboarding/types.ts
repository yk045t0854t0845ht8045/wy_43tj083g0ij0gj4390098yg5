export type CompanySize = "1-5" | "6-20" | "21-100" | "100+";
export type AiAutoMode = "all" | "common" | "assistant";
export type BrandTone = "formal" | "neutral" | "casual";

export type OnboardingData = {
  companyName: string | null;
  cnpj: string | null;
  tradeName: string | null;
  websiteOrInstagram: string | null;
  segment: string | null;
  companySize: CompanySize | null;

  mainUse: string | null;
  priorityNow: string | null;
  hasSupervisor: boolean | null;
  serviceHours: string | null;
  targetResponseTime: string | null;
  languages: string[] | null;

  aiAutoMode: AiAutoMode | null;
  handoffHumanRequest: boolean | null;
  handoffAngerUrgency: boolean | null;
  handoffAfterMessages: number | null;
  handoffPricePayment: boolean | null;
  brandTone: BrandTone | null;
  msgSignature: string | null;

  aiCatalogSummary: string | null;
  aiKnowledgeLinks: string | null;
  aiGuardrails: string | null;

  welcomeConfirmed: boolean;
  teamAgentsCount: number | null;
  operationDays: string[] | null;
  operationStartTime: string | null;
  operationEndTime: string | null;
  whatsappConnected: boolean;
  whatsappConnectedAt: string | null;

  completed: boolean;
  updatedAt: string | null;
};

export type OnboardingTaskId =
  | "welcome"
  | "company"
  | "goal"
  | "team"
  | "ai"
  | "whatsapp"
  | "finish";

export type OnboardingTask = {
  id: OnboardingTaskId;
  label: string;
  done: boolean;
};

export type OnboardingProgress = {
  tasks: OnboardingTask[];
  completedRequired: number;
  totalRequired: number;
  percent: number;
  remaining: number;
  isCompleted: boolean;
};

function normalizeText(v: unknown, max = 1024) {
  const clean = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > max ? clean.slice(0, max) : clean;
}

function normalizeBool(v: unknown) {
  return typeof v === "boolean" ? v : null;
}

function normalizeInt(v: unknown, min: number, max: number) {
  if (v == null) return null;
  const raw = String(v).trim();
  if (!/^\d+$/.test(raw)) return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

function normalizeAllowedStringArray(
  v: unknown,
  allow: Set<string>,
  mode: "upper" | "lower",
) {
  if (!Array.isArray(v)) return null;
  const values = v
    .map((item) => normalizeText(item, 16))
    .filter((item): item is string => Boolean(item))
    .map((item) => (mode === "upper" ? item.toUpperCase() : item.toLowerCase()))
    .filter((item) => allow.has(item));

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique.length ? unique : null;
}

export function normalizeOnboardingData(
  input: Partial<OnboardingData> | null | undefined,
): OnboardingData {
  const source = input || {};

  const companySizeRaw = String(source.companySize || "").trim();
  const companySize: CompanySize | null =
    companySizeRaw === "1-5" ||
    companySizeRaw === "6-20" ||
    companySizeRaw === "21-100" ||
    companySizeRaw === "100+"
      ? (companySizeRaw as CompanySize)
      : null;

  const aiModeRaw = String(source.aiAutoMode || "").trim().toLowerCase();
  const aiAutoMode: AiAutoMode | null =
    aiModeRaw === "all" || aiModeRaw === "common" || aiModeRaw === "assistant"
      ? (aiModeRaw as AiAutoMode)
      : null;

  const toneRaw = String(source.brandTone || "").trim().toLowerCase();
  const brandTone: BrandTone | null =
    toneRaw === "formal" || toneRaw === "neutral" || toneRaw === "casual"
      ? (toneRaw as BrandTone)
      : null;

  const updatedAt = normalizeText(source.updatedAt, 64);
  const whatsappConnectedAt = normalizeText(source.whatsappConnectedAt, 64);

  return {
    companyName: normalizeText(source.companyName, 120),
    cnpj: normalizeText(source.cnpj, 18),
    tradeName: normalizeText(source.tradeName, 120),
    websiteOrInstagram: normalizeText(source.websiteOrInstagram, 180),
    segment: normalizeText(source.segment, 90),
    companySize,

    mainUse: normalizeText(source.mainUse, 70),
    priorityNow: normalizeText(source.priorityNow, 80),
    hasSupervisor: normalizeBool(source.hasSupervisor),
    serviceHours: normalizeText(source.serviceHours, 80),
    targetResponseTime: normalizeText(source.targetResponseTime, 30),
    languages: normalizeAllowedStringArray(
      source.languages,
      new Set(["PT", "EN", "ES"]),
      "upper",
    ),

    aiAutoMode,
    handoffHumanRequest: normalizeBool(source.handoffHumanRequest),
    handoffAngerUrgency: normalizeBool(source.handoffAngerUrgency),
    handoffAfterMessages: normalizeInt(source.handoffAfterMessages, 1, 200),
    handoffPricePayment: normalizeBool(source.handoffPricePayment),
    brandTone,
    msgSignature: normalizeText(source.msgSignature, 80),

    aiCatalogSummary: normalizeText(source.aiCatalogSummary, 4000),
    aiKnowledgeLinks: normalizeText(source.aiKnowledgeLinks, 4000),
    aiGuardrails: normalizeText(source.aiGuardrails, 4000),

    welcomeConfirmed: source.welcomeConfirmed === true,
    teamAgentsCount: normalizeInt(source.teamAgentsCount, 1, 5000),
    operationDays: normalizeAllowedStringArray(
      source.operationDays,
      new Set(["seg", "ter", "qua", "qui", "sex", "sab", "dom"]),
      "lower",
    ),
    operationStartTime: normalizeText(source.operationStartTime, 8),
    operationEndTime: normalizeText(source.operationEndTime, 8),
    whatsappConnected: source.whatsappConnected === true,
    whatsappConnectedAt,

    completed: source.completed === true,
    updatedAt,
  };
}

export function createEmptyOnboardingData(): OnboardingData {
  return normalizeOnboardingData(null);
}
