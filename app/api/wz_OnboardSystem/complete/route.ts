// app/api/wz_OnboardSystem/complete/route.ts
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import {
  jsonNoStore,
  validateCompletePayload,
  verifyCnpjExists,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return jsonNoStore({ ok: false }, 401);

  try {
    const body = await req.json().catch(() => ({}));

    const sb = supabaseAdmin();
    const fullSelect = [
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
      "ui_step",
    ].join(",");
    const baseSelect = fullSelect.replace(",ui_step", "");

    // pega linha atual
    let { data: row, error: rerr } = await sb
      .from("wz_onboarding")
      .select(fullSelect)
      .eq("user_id", s.userId)
      .maybeSingle();

    if (rerr && /ui_step/i.test(String(rerr.message || ""))) {
      const fallback = await sb
        .from("wz_onboarding")
        .select(baseSelect)
        .eq("user_id", s.userId)
        .maybeSingle();
      row = fallback.data;
      rerr = fallback.error;
    }

    if (rerr) return jsonNoStore({ ok: false, error: rerr.message }, 500);

    const base = row || ({} as any);

    // mapeia snake_case -> camelCase e aplica body por cima (se vier algo)
    const merged = {
      companyName: base.company_name ?? null,
      cnpj: base.cnpj ?? null,
      tradeName: base.trade_name ?? null,
      websiteOrInstagram: base.website_or_instagram ?? null,
      segment: base.segment ?? null,
      companySize: base.company_size ?? null,

      mainUse: base.main_use ?? null,
      priorityNow: base.priority_now ?? null,
      hasSupervisor: typeof base.has_supervisor === "boolean" ? base.has_supervisor : null,
      serviceHours: base.service_hours ?? null,
      targetResponseTime: base.target_response_time ?? null,
      languages: Array.isArray(base.languages) ? base.languages : null,

      aiAutoMode: base.ai_auto_mode ?? null,
      handoffHumanRequest: typeof base.ai_handoff_human_request === "boolean" ? base.ai_handoff_human_request : null,
      handoffAngerUrgency: typeof base.ai_handoff_anger_urgency === "boolean" ? base.ai_handoff_anger_urgency : null,
      handoffAfterMessages: typeof base.ai_handoff_after_messages === "number" ? base.ai_handoff_after_messages : null,
      handoffPricePayment: typeof base.ai_handoff_price_payment === "boolean" ? base.ai_handoff_price_payment : null,
      brandTone: base.brand_tone ?? null,
      msgSignature: base.msg_signature ?? null,

      aiCatalogSummary: base.ai_catalog_summary ?? null,
      aiKnowledgeLinks: base.ai_knowledge_links ?? null,
      aiGuardrails: base.ai_guardrails ?? null,
      welcomeConfirmed: base.welcome_confirmed === true,
      teamAgentsCount:
        typeof base.team_agents_count === "number" ? base.team_agents_count : null,
      operationDays: Array.isArray(base.operation_days) ? base.operation_days : null,
      operationStartTime: base.operation_start_time ?? null,
      operationEndTime: base.operation_end_time ?? null,
      whatsappConnected: base.whatsapp_connected === true,
      whatsappConnectedAt: base.whatsapp_connected_at ?? null,
      uiStep: base.ui_step ?? null,

      ...(body && typeof body === "object" && !Array.isArray(body) ? body : {}),
    };

    const checked = validateCompletePayload(merged);
    if (!checked.ok) return jsonNoStore({ ok: false, error: checked.error }, 400);

    // se tiver CNPJ, tenta validar existência novamente no complete
    const warnings: Record<string, string> = {};
    if (checked.data.cnpj) {
      const exists = await verifyCnpjExists(checked.data.cnpj);

      if (exists.ok && !exists.found) {
        return jsonNoStore({ ok: false, error: "CNPJ não encontrado." }, 400);
      }

      if (!exists.ok) {
        warnings.cnpj =
          "Não foi possível verificar o CNPJ agora (rede/limite). Finalizamos mesmo assim.";
      }
    }

    const now = new Date().toISOString();

    const payload: Record<string, unknown> = {
      user_id: s.userId,
      email: s.email,

      company_name: checked.data.companyName,
      cnpj: checked.data.cnpj,
      trade_name: checked.data.tradeName,
      website_or_instagram: checked.data.websiteOrInstagram,
      segment: checked.data.segment,
      company_size: checked.data.companySize,

      main_use: checked.data.mainUse,
      priority_now: checked.data.priorityNow,
      has_supervisor: checked.data.hasSupervisor,
      service_hours: checked.data.serviceHours,
      target_response_time: checked.data.targetResponseTime,
      languages: checked.data.languages,

      ai_auto_mode: checked.data.aiAutoMode,
      ai_handoff_human_request: checked.data.handoffHumanRequest,
      ai_handoff_anger_urgency: checked.data.handoffAngerUrgency,
      ai_handoff_after_messages: checked.data.handoffAfterMessages,
      ai_handoff_price_payment: checked.data.handoffPricePayment,
      brand_tone: checked.data.brandTone,
      msg_signature: checked.data.msgSignature,

      ai_catalog_summary: checked.data.aiCatalogSummary,
      ai_knowledge_links: checked.data.aiKnowledgeLinks,
      ai_guardrails: checked.data.aiGuardrails,
      welcome_confirmed: checked.data.welcomeConfirmed,
      team_agents_count: checked.data.teamAgentsCount,
      operation_days: checked.data.operationDays,
      operation_start_time: checked.data.operationStartTime,
      operation_end_time: checked.data.operationEndTime,
      whatsapp_connected: checked.data.whatsappConnected,
      whatsapp_connected_at: checked.data.whatsappConnectedAt,
      ui_step: "final",
      updated_at: now,
      created_at: now,
    };

    let { error } = await sb.from("wz_onboarding").upsert(payload, { onConflict: "user_id" });
    if (error && /ui_step/i.test(String(error.message || ""))) {
      const fallbackPayload: Record<string, unknown> = { ...payload };
      delete fallbackPayload.ui_step;
      const retry = await sb
        .from("wz_onboarding")
        .upsert(fallbackPayload, { onConflict: "user_id" });
      error = retry.error;
    }

    if (error && /on conflict/i.test(String(error.message || ""))) {
      const updatePayload: Record<string, unknown> = {
        ...payload,
        updated_at: now,
      };
      delete updatePayload.user_id;
      delete updatePayload.created_at;

      const updated = await sb
        .from("wz_onboarding")
        .update(updatePayload)
        .eq("user_id", s.userId)
        .select("user_id")
        .maybeSingle();

      if (!updated.error && updated.data) {
        error = null;
      } else {
        const inserted = await sb.from("wz_onboarding").insert(payload);
        error = inserted.error;
      }
    }
    if (error) return jsonNoStore({ ok: false, error: error.message }, 500);

    return jsonNoStore(
      {
        ok: true,
        nextUrl: "/",
        warnings: Object.keys(warnings).length ? warnings : undefined,
      },
      200,
    );
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: e?.message || "Erro inesperado." }, 500);
  }
}
