// app/api/wz_OnboardSystem/complete/route.ts
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import { jsonNoStore, validateCompletePayload } from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return jsonNoStore({ ok: false }, 401);

  try {
    const body = await req.json().catch(() => ({}));

    const checked = validateCompletePayload(body);
    if (!checked.ok) {
      return jsonNoStore({ ok: false, error: checked.error }, 400);
    }

    const now = new Date().toISOString();
    const sb = supabaseAdmin();

    const payload = {
      user_id: s.userId,
      email: s.email,

      // step-1
      company_name: checked.data.companyName,
      cnpj: checked.data.cnpj,
      trade_name: checked.data.tradeName,
      website_or_instagram: checked.data.websiteOrInstagram,
      segment: checked.data.segment,
      company_size: checked.data.companySize,

      // step-2
      main_use: checked.data.mainUse,
      priority_now: checked.data.priorityNow,
      has_supervisor: checked.data.hasSupervisor,
      service_hours: checked.data.serviceHours,
      target_response_time: checked.data.targetResponseTime,
      languages: checked.data.languages,

      completed: true,
      updated_at: now,
    };

    // ✅ evita erro de types se suas colunas ainda não estão no Database types
    const { error } = await (sb.from("wz_onboarding") as any).upsert(payload, {
      onConflict: "user_id",
    });

    if (error) return jsonNoStore({ ok: false, error: error.message }, 500);

    return jsonNoStore({ ok: true, nextUrl: "/" }, 200);
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: e?.message || "Erro inesperado." },
      500,
    );
  }
}
