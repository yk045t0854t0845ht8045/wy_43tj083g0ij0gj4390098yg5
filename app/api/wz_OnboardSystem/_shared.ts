// app/api/wz_OnboardSystem/_shared.ts
import { NextResponse } from "next/server";

export type CompanySize = "1-5" | "6-20" | "21-100" | "100+";
export type AiAutoMode = "all" | "common" | "assistant";
export type BrandTone = "formal" | "neutral" | "casual";

export type OnboardData = {
  companyName: string | null;
  cnpj: string | null;
  tradeName: string | null;
  websiteOrInstagram: string | null;
  segment: string | null;
  companySize: CompanySize | null;

  // step-2
  mainUse: string | null;
  priorityNow: string | null;
  hasSupervisor: boolean | null;
  serviceHours: string | null;
  targetResponseTime: string | null;
  languages: string[] | null;

  // step-3
  aiAutoMode: AiAutoMode | null;
  handoffHumanRequest: boolean | null;
  handoffAngerUrgency: boolean | null;
  handoffAfterMessages: number | null;
  handoffPricePayment: boolean | null;
  brandTone: BrandTone | null;
  msgSignature: string | null;

  // extras p/ IA
  aiCatalogSummary: string | null;
  aiKnowledgeLinks: string | null;
  aiGuardrails: string | null;

  completed: boolean;
  updatedAt: string | null;
};

export function jsonNoStore(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export function normText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export function clampText(v: string | null, max: number) {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export function onlyDigits(v: any) {
  return String(v ?? "").replace(/\D+/g, "");
}

export function normalizeCompanySize(v: any): CompanySize | null {
  const s = String(v ?? "").trim();
  if (s === "1-5" || s === "6-20" || s === "21-100" || s === "100+") return s;
  return null;
}

export function normalizeAiAutoMode(v: any): AiAutoMode | null {
  const s = String(v ?? "").trim().toLowerCase();

  // aceita códigos
  if (s === "all" || s === "common" || s === "assistant") return s;

  // aceita labels (se algum dia vier do front assim)
  if (s.includes("sim") && s.includes("tudo")) return "all";
  if (s.includes("perguntas") || s.includes("comuns")) return "common";
  if (s.includes("assistente")) return "assistant";

  return null;
}

export function normalizeBrandTone(v: any): BrandTone | null {
  const s = String(v ?? "").trim().toLowerCase();

  if (s === "formal" || s === "neutral" || s === "casual") return s;

  if (s.includes("neutro")) return "neutral";
  if (s.includes("descontra")) return "casual";
  if (s.includes("formal")) return "formal";

  return null;
}

export function normalizeBoolNullable(v: any): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  return null;
}

export function normalizeIntNullable(v: any, min: number, max: number): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s.length) return null;
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

export function normalizeLanguages(v: any): string[] | null {
  if (!Array.isArray(v)) return null;
  const allow = new Set(["PT", "EN", "ES"]);

  const out = v
    .map((x) => String(x ?? "").trim().toUpperCase())
    .filter((x) => allow.has(x));

  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const x of out) {
    if (!seen.has(x)) {
      seen.add(x);
      uniq.push(x);
    }
  }

  return uniq.length ? uniq : null;
}

// ===== CNPJ: DV real =====
function isAllSameDigits(s: string) {
  return /^(\d)\1+$/.test(s);
}

export function isValidCnpjDigits(d: string) {
  if (!/^\d{14}$/.test(d)) return false;
  if (isAllSameDigits(d)) return false;

  const nums = d.split("").map((x) => Number(x));
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calcDv = (base: number[], weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += base[i] * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const dv1 = calcDv(nums.slice(0, 12), w1);
  const dv2 = calcDv(nums.slice(0, 13), w2);
  return dv1 === nums[12] && dv2 === nums[13];
}

export function validateCnpjOptional(v: any): {
  ok: boolean;
  value: string | null;
  message?: string;
} {
  const raw = String(v ?? "").trim();
  const d = onlyDigits(raw);

  if (!d.length) return { ok: true, value: null };
  if (d.length !== 14) return { ok: false, value: null, message: "CNPJ incompleto." };
  if (!isValidCnpjDigits(d)) return { ok: false, value: null, message: "CNPJ inválido." };
  return { ok: true, value: d };
}

// ===== existência do CNPJ (consulta externa) =====
const BRASILAPI_CNPJ = (d: string) => `https://brasilapi.com.br/api/cnpj/v1/${d}`;
const CNPJWS_PUBLIC = (d: string) => `https://publica.cnpj.ws/cnpj/${d}`;

type CnpjExistResult =
  | { ok: true; found: true; provider: "brasilapi" | "cnpjws" }
  | { ok: true; found: false; provider: "all" }
  | { ok: false; temporary: true; provider: "all" };

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

export async function verifyCnpjExists(digits14: string): Promise<CnpjExistResult> {
  if (!/^\d{14}$/.test(digits14)) {
    return { ok: true, found: false, provider: "all" };
  }

  const urls: Array<{ name: "brasilapi" | "cnpjws"; url: string }> = [
    { name: "brasilapi", url: BRASILAPI_CNPJ(digits14) },
    { name: "cnpjws", url: CNPJWS_PUBLIC(digits14) },
  ];

  let notFound = 0;
  let temporary = 0;

  for (const p of urls) {
    try {
      const res = await fetchWithTimeout(p.url, 4500);

      if (res.status === 200) return { ok: true, found: true, provider: p.name };
      if (res.status === 404) {
        notFound += 1;
        continue;
      }

      if (res.status === 429 || res.status >= 500) {
        temporary += 1;
        continue;
      }

      temporary += 1;
    } catch {
      temporary += 1;
    }
  }

  if (notFound === urls.length) return { ok: true, found: false, provider: "all" };
  return { ok: false, temporary: true, provider: "all" };
}

// ===== validateCompletePayload (pra /complete) =====
export type CompletePayload = {
  companyName: string;
  cnpj: string | null;
  tradeName: string | null;
  websiteOrInstagram: string | null;
  segment: string;
  companySize: CompanySize;

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
};

export function validateCompletePayload(body: any): { ok: true; data: CompletePayload } | { ok: false; error: string } {
  const companyName = clampText(normText(body?.companyName), 120);
  const segment = clampText(normText(body?.segment), 80);
  const companySize = normalizeCompanySize(body?.companySize);

  if (!companyName || companyName.length < 2) return { ok: false, error: "Nome da empresa inválido." };
  if (!segment || segment.length < 2) return { ok: false, error: "Segmento inválido." };
  if (!companySize) return { ok: false, error: "Tamanho da empresa inválido." };

  const cnpjCheck = validateCnpjOptional(body?.cnpj);
  if (!cnpjCheck.ok) return { ok: false, error: cnpjCheck.message || "CNPJ inválido." };

  const out: CompletePayload = {
    companyName,
    cnpj: cnpjCheck.value,
    tradeName: clampText(normText(body?.tradeName), 120),
    websiteOrInstagram: clampText(normText(body?.websiteOrInstagram), 140),
    segment,
    companySize,

    mainUse: clampText(normText(body?.mainUse), 60),
    priorityNow: clampText(normText(body?.priorityNow), 60),
    hasSupervisor: normalizeBoolNullable(body?.hasSupervisor),
    serviceHours: clampText(normText(body?.serviceHours), 60),
    targetResponseTime: clampText(normText(body?.targetResponseTime), 30),
    languages: normalizeLanguages(body?.languages),

    aiAutoMode: normalizeAiAutoMode(body?.aiAutoMode),
    handoffHumanRequest: normalizeBoolNullable(body?.handoffHumanRequest),
    handoffAngerUrgency: normalizeBoolNullable(body?.handoffAngerUrgency),
    handoffAfterMessages: normalizeIntNullable(body?.handoffAfterMessages, 1, 50),
    handoffPricePayment: normalizeBoolNullable(body?.handoffPricePayment),
    brandTone: normalizeBrandTone(body?.brandTone),
    msgSignature: clampText(normText(body?.msgSignature), 80),

    aiCatalogSummary: clampText(normText(body?.aiCatalogSummary), 260),
    aiKnowledgeLinks: clampText(normText(body?.aiKnowledgeLinks), 520),
    aiGuardrails: clampText(normText(body?.aiGuardrails), 520),
  };

  return { ok: true, data: out };
}
