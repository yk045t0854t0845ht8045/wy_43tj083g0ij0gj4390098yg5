// app/api/wz_OnboardSystem/me/route.ts
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import {
  jsonNoStore,
  type OnboardData,
  normalizeCompanySize,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function asText(v: any): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function asBool(v: any): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function asStringArray(v: any): string[] | null {
  if (!Array.isArray(v)) return null;

  const out = v
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);

  return out.length ? out : null;
}

export async function GET(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return jsonNoStore({ ok: false }, 401);

  try {
    const sb = supabaseAdmin();

    // ✅ IMPORTANTE:
    // Se seus tipos do Supabase ainda não foram regenerados com as colunas novas,
    // o TS pode quebrar no .select(). Então a gente "afrouxa" aqui com `as any`.
    const q = (sb.from("wz_onboarding") as any)
      .select(
        [
          "company_name",
          "cnpj",
          "trade_name",
          "website_or_instagram",
          "segment",
          "company_size",

          // step-2
          "main_use",
          "priority_now",
          "has_supervisor",
          "service_hours",
          "target_response_time",
          "languages",

          "completed",
          "updated_at",
        ].join(","),
      )
      .eq("user_id", s.userId)
      .maybeSingle();

    const { data, error } = (await q) as {
      data: Record<string, any> | null;
      error: { message?: string } | null;
    };

    if (error) {
      return jsonNoStore(
        { ok: false, error: error.message || "Falha ao buscar onboarding." },
        500,
      );
    }

    // ✅ evita qualquer erro de "property does not exist"
    const row: Record<string, any> = data ?? {};

    const payload: OnboardData = {
      // step-1
      companyName: asText(row.company_name),
      cnpj: asText(row.cnpj),
      tradeName: asText(row.trade_name),
      websiteOrInstagram: asText(row.website_or_instagram),
      segment: asText(row.segment),
      companySize: normalizeCompanySize(row.company_size),

      // step-2
      mainUse: asText(row.main_use),
      priorityNow: asText(row.priority_now),
      hasSupervisor: asBool(row.has_supervisor),
      serviceHours: asText(row.service_hours),
      targetResponseTime: asText(row.target_response_time),
      languages: asStringArray(row.languages),

      completed: !!row.completed,
      updatedAt: asText(row.updated_at),
    };

    return jsonNoStore({ ok: true, data: payload }, 200);
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: e?.message || "Erro inesperado." },
      500,
    );
  }
}
