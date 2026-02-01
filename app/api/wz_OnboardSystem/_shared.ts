import { NextResponse } from "next/server";

export type CompanySize = "1-5" | "6-20" | "21-100" | "100+";

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

export function normalizeCompanySize(v: any): CompanySize | null {
  const s = String(v ?? "").trim();
  if (s === "1-5" || s === "6-20" || s === "21-100" || s === "100+") return s;
  return null;
}

export function onlyDigits(v: any) {
  return String(v ?? "").replace(/\D+/g, "");
}

// ===== CNPJ: dígitos verificadores (validação real de formato) =====
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

/**
 * Mantido: valida CNPJ opcional de forma "estrita" (vazio ou 14 dígitos válidos).
 * Uso recomendado: /complete (finalização).
 */
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

export function normalizeLanguages(v: any): string[] | null {
  if (!Array.isArray(v)) return null;
  const allow = new Set(["PT", "EN", "ES"]);

  const out = v
    .map((x) => String(x ?? "").trim().toUpperCase())
    .filter((x) => allow.has(x));

  // remove duplicados preservando ordem
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

// ===== Verificação de existência do CNPJ (consulta externa) =====
// BrasilAPI: https://brasilapi.com.br/api/cnpj/v1/{cnpj}  (docs/exemplos) :contentReference[oaicite:1]{index=1}
const BRASILAPI_CNPJ = (d: string) => `https://brasilapi.com.br/api/cnpj/v1/${d}`;

// CNPJ.ws pública: https://publica.cnpj.ws/cnpj/{cnpj} :contentReference[oaicite:2]{index=2}
const CNPJWS_PUBLIC = (d: string) => `https://publica.cnpj.ws/cnpj/${d}`;

type CnpjExistResult =
  | { ok: true; found: true; provider: "brasilapi" | "cnpjws" }
  | { ok: true; found: false; provider: "brasilapi" | "cnpjws" | "all" }
  | { ok: false; temporary: true; provider: "brasilapi" | "cnpjws" | "all" };

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Verifica se o CNPJ "existe" em base pública.
 * - found: true => algum provedor confirmou
 * - found: false => todos consultados retornaram 404
 * - ok:false temporary:true => indisponível/rate-limit/timeout (não dá pra concluir)
 */
export async function verifyCnpjExists(digits14: string): Promise<CnpjExistResult> {
  if (!/^\d{14}$/.test(digits14)) {
    return { ok: true, found: false, provider: "all" };
  }

  const providers: Array<{ name: "brasilapi" | "cnpjws"; url: string }> = [
    { name: "brasilapi", url: BRASILAPI_CNPJ(digits14) },
    { name: "cnpjws", url: CNPJWS_PUBLIC(digits14) },
  ];

  let notFound = 0;
  let temporary = 0;

  for (const p of providers) {
    try {
      const res = await fetchWithTimeout(p.url, 4500);

      if (res.status === 200) return { ok: true, found: true, provider: p.name };

      // 404 => não encontrado nesse provedor
      if (res.status === 404) {
        notFound += 1;
        continue;
      }

      // rate limit / indisponível / erro
      if (res.status === 429 || res.status >= 500) {
        temporary += 1;
        continue;
      }

      // outros status: trata como temporário (não conclui)
      temporary += 1;
    } catch {
      // timeout/abort/rede
      temporary += 1;
    }
  }

  if (notFound === providers.length) {
    return { ok: true, found: false, provider: "all" };
  }

  // não dá pra afirmar (um provedor pode ter falhado)
  if (temporary > 0) {
    return { ok: false, temporary: true, provider: "all" };
  }

  // fallback conservador
  return { ok: false, temporary: true, provider: "all" };
}

// ===== Validação do /complete (pra seu import não ficar vermelho) =====
export type CompletePayload = {
  companyName: string;
  cnpj: string | null;
  tradeName: string | null;
  websiteOrInstagram: string | null;
  segment: string;
  companySize: CompanySize;

  // step-2 (opcional no complete — você pode endurecer depois)
  mainUse: string | null;
  priorityNow: string | null;
  hasSupervisor: boolean | null;
  serviceHours: string | null;
  targetResponseTime: string | null;
  languages: string[] | null;
};

export function validateCompletePayload(body: any): { ok: true; data: CompletePayload } | { ok: false; error: string } {
  const companyName = normText(body?.companyName);
  const segment = normText(body?.segment);
  const companySize = normalizeCompanySize(body?.companySize);

  if (!companyName || companyName.length < 2) return { ok: false, error: "Nome da empresa inválido." };
  if (!segment || segment.length < 2) return { ok: false, error: "Segmento inválido." };
  if (!companySize) return { ok: false, error: "Tamanho da empresa inválido." };

  const cnpjCheck = validateCnpjOptional(body?.cnpj);
  if (!cnpjCheck.ok) return { ok: false, error: cnpjCheck.message || "CNPJ inválido." };

  const out: CompletePayload = {
    companyName,
    cnpj: cnpjCheck.value,
    tradeName: normText(body?.tradeName),
    websiteOrInstagram: normText(body?.websiteOrInstagram),
    segment,
    companySize,

    mainUse: normText(body?.mainUse),
    priorityNow: normText(body?.priorityNow),
    hasSupervisor:
      typeof body?.hasSupervisor === "boolean" ? body.hasSupervisor : null,
    serviceHours: normText(body?.serviceHours),
    targetResponseTime: normText(body?.targetResponseTime),
    languages: normalizeLanguages(body?.languages),
  };

  return { ok: true, data: out };
}
