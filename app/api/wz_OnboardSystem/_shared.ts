// app/api/wz_OnboardSystem/_shared.ts
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

function onlyDigits(v: string) {
  return String(v || "").replace(/\D+/g, "");
}

export function validateCnpjOptional(v: any): {
  ok: boolean;
  value: string | null;
  message?: string;
} {
  const raw = String(v ?? "").trim();
  const d = onlyDigits(raw);

  if (!d.length) return { ok: true, value: null };
  if (d.length !== 14) return { ok: false, value: null, message: "CNPJ inválido." };

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

// =======================
// ✅ COMPLETE VALIDATION
// =======================

export type CompletePayload = {
  // step-1
  companyName: string;
  cnpj: string | null;
  tradeName: string | null;
  websiteOrInstagram: string | null;
  segment: string;
  companySize: CompanySize;

  // step-2
  mainUse: string;
  priorityNow: string;
  hasSupervisor: boolean;
  serviceHours: string;
  targetResponseTime: string;
  languages: string[]; // PT/EN/ES
};

export function validateCompletePayload(body: any):
  | { ok: true; data: CompletePayload }
  | { ok: false; error: string } {
  const companyName = normText(body?.companyName);
  if (!companyName || companyName.length < 2) {
    return { ok: false, error: "Nome da empresa é obrigatório." };
  }

  const segment = normText(body?.segment);
  if (!segment || segment.length < 2) {
    return { ok: false, error: "Segmento é obrigatório." };
  }

  const companySize = normalizeCompanySize(body?.companySize);
  if (!companySize) {
    return { ok: false, error: "Tamanho da empresa é obrigatório." };
  }

  const cnpjCheck = validateCnpjOptional(body?.cnpj);
  if (!cnpjCheck.ok) {
    return { ok: false, error: cnpjCheck.message || "CNPJ inválido." };
  }

  const tradeName = normText(body?.tradeName);
  const websiteOrInstagram = normText(body?.websiteOrInstagram);

  // step-2 (como é "complete", aqui eu valido forte)
  const mainUse = normText(body?.mainUse);
  if (!mainUse) return { ok: false, error: "Selecione o uso principal." };

  const priorityNow = normText(body?.priorityNow);
  if (!priorityNow) return { ok: false, error: "Selecione a prioridade agora." };

  const hasSupervisor = body?.hasSupervisor;
  if (typeof hasSupervisor !== "boolean") {
    return { ok: false, error: "Informe se haverá supervisor/gestor (sim/não)." };
  }

  const serviceHours = normText(body?.serviceHours);
  if (!serviceHours) {
    return { ok: false, error: "Informe o horário de atendimento." };
  }

  const targetResponseTime = normText(body?.targetResponseTime);
  if (!targetResponseTime) {
    return { ok: false, error: "Informe o tempo alvo de resposta." };
  }

  const langs = normalizeLanguages(body?.languages);
  if (!langs) {
    return { ok: false, error: "Selecione pelo menos 1 idioma (PT/EN/ES)." };
  }

  return {
    ok: true,
    data: {
      companyName,
      cnpj: cnpjCheck.value,
      tradeName,
      websiteOrInstagram,
      segment,
      companySize,
      mainUse,
      priorityNow,
      hasSupervisor,
      serviceHours,
      targetResponseTime,
      languages: langs,
    },
  };
}
