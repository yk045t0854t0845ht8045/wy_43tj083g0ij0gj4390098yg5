// app/api/wz_OnboardSystem/me/route.ts
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import { jsonNoStore, type OnboardData } from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return jsonNoStore({ ok: false }, 401);

  try {
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("wz_onboarding")
      .select(
        [
          "company_name",
          "cnpj",
          "trade_name",
          "website_or_instagram",
          "segment",
          "company_size",

          "main_use",
          "priority_now",
          "has_supervisor",
          "service_hours",
          "target_response_time",
          "languages",

          "ai_auto_mode",
          "ai_handoff_human_request",
          "ai_handoff_anger_urgency",
          "ai_handoff_after_messages",
          "ai_handoff_price_payment",
          "brand_tone",
          "msg_signature",

          "ai_catalog_summary",
          "ai_knowledge_links",
          "ai_guardrails",
          "welcome_confirmed",
          "team_agents_count",
          "operation_days",
          "operation_start_time",
          "operation_end_time",
          "whatsapp_connected",
          "whatsapp_connected_at",
          "updated_at",
        ].join(","),
      )
      .eq("user_id", s.userId)
      .maybeSingle();

    if (error) {
      return jsonNoStore({ ok: false, error: error.message || "Falha ao buscar onboarding." }, 500);
    }

    const row: any = data || null;

    const payload: OnboardData = {
      companyName: row?.company_name ?? null,
      cnpj: row?.cnpj ?? null,
      tradeName: row?.trade_name ?? null,
      websiteOrInstagram: row?.website_or_instagram ?? null,
      segment: row?.segment ?? null,
      companySize: (row?.company_size ?? null) as any,

      mainUse: row?.main_use ?? null,
      priorityNow: row?.priority_now ?? null,
      hasSupervisor: typeof row?.has_supervisor === "boolean" ? row.has_supervisor : null,
      serviceHours: row?.service_hours ?? null,
      targetResponseTime: row?.target_response_time ?? null,
      languages: Array.isArray(row?.languages) ? row.languages : null,

      aiAutoMode: (row?.ai_auto_mode ?? null) as any,
      handoffHumanRequest: typeof row?.ai_handoff_human_request === "boolean" ? row.ai_handoff_human_request : null,
      handoffAngerUrgency: typeof row?.ai_handoff_anger_urgency === "boolean" ? row.ai_handoff_anger_urgency : null,
      handoffAfterMessages: typeof row?.ai_handoff_after_messages === "number" ? row.ai_handoff_after_messages : null,
      handoffPricePayment: typeof row?.ai_handoff_price_payment === "boolean" ? row.ai_handoff_price_payment : null,
      brandTone: (row?.brand_tone ?? null) as any,
      msgSignature: row?.msg_signature ?? null,

      aiCatalogSummary: row?.ai_catalog_summary ?? null,
      aiKnowledgeLinks: row?.ai_knowledge_links ?? null,
      aiGuardrails: row?.ai_guardrails ?? null,
      welcomeConfirmed: row?.welcome_confirmed === true,
      teamAgentsCount: typeof row?.team_agents_count === "number" ? row.team_agents_count : null,
      operationDays: Array.isArray(row?.operation_days) ? row.operation_days : null,
      operationStartTime: row?.operation_start_time ?? null,
      operationEndTime: row?.operation_end_time ?? null,
      whatsappConnected: row?.whatsapp_connected === true,
      whatsappConnectedAt: row?.whatsapp_connected_at ?? null,
      completed: false,
      updatedAt: row?.updated_at ?? null,
    };

    return jsonNoStore({ ok: true, data: payload }, 200);
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: e?.message || "Erro inesperado." }, 500);
  }
}
