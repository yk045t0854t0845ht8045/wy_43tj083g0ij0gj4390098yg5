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
  completed: boolean;
  updatedAt: string | null;
};

export function onlyDigits(v: any) {
  return String(v ?? "").replace(/\D+/g, "");
}

export function normText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export function normOptionalDigits(v: any) {
  const d = onlyDigits(v);
  return d.length ? d : null;
}

export function normalizeCompanySize(v: any): CompanySize | null {
  const s = String(v ?? "").trim();
  if (s === "1-5" || s === "6-20" || s === "21-100" || s === "100+") return s;
  return null;
}

export function validateCnpjOptional(raw: any) {
  const d = onlyDigits(raw);
  if (!d.length) return { ok: true, value: null as string | null };

  // CNPJ tem 14 dígitos (não valida dígito verificador aqui — só formato)
  if (d.length !== 14) {
    return { ok: false, message: "CNPJ inválido (precisa ter 14 dígitos)." };
  }
  return { ok: true, value: d };
}

export function validateCompletePayload(body: any) {
  const companyName = normText(body?.companyName);
  const segment = normText(body?.segment);
  const companySize = normalizeCompanySize(body?.companySize);

  const cnpjCheck = validateCnpjOptional(body?.cnpj);
  if (!cnpjCheck.ok) return { ok: false as const, error: cnpjCheck.message };

  const tradeName = normText(body?.tradeName);
  const websiteOrInstagram = normText(body?.websiteOrInstagram);

  if (!companyName || companyName.length < 2) {
    return { ok: false as const, error: "Informe o nome da empresa." };
  }

  if (!segment || segment.length < 2) {
    return { ok: false as const, error: "Informe o segmento da empresa." };
  }

  if (!companySize) {
    return { ok: false as const, error: "Selecione o tamanho da empresa." };
  }

  return {
    ok: true as const,
    data: {
      companyName,
      cnpj: cnpjCheck.value,
      tradeName,
      websiteOrInstagram,
      segment,
      companySize,
    },
  };
}

export function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
