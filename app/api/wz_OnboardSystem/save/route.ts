// app/api/wz_OnboardSystem/save/route.ts
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import {
  jsonNoStore,
  normText,
  clampText,
  normalizeCompanySize,
  validateCnpjOptional,
  normalizeLanguages,
  onlyDigits,
  verifyCnpjExists,
  normalizeAiAutoMode,
  normalizeBrandTone,
  normalizeBoolNullable,
  normalizeIntNullable,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_KEYS = new Set([
  // step-1
  "companyName",
  "cnpj",
  "tradeName",
  "websiteOrInstagram",
  "segment",
  "companySize",

  // step-2
  "mainUse",
  "priorityNow",
  "hasSupervisor",
  "serviceHours",
  "targetResponseTime",
  "languages",

  // step-3
  "aiAutoMode",
  "handoffHumanRequest",
  "handoffAngerUrgency",
  "handoffAfterMessages",
  "handoffPricePayment",
  "brandTone",
  "msgSignature",

  // extras IA
  "aiCatalogSummary",
  "aiKnowledgeLinks",
  "aiGuardrails",
]);

export async function POST(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return jsonNoStore({ ok: false }, 401);

  try {
    const body = await req.json().catch(() => ({}));

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonNoStore({ ok: false, error: "Payload inválido." }, 400);
    }

    for (const k of Object.keys(body)) {
      if (!ALLOWED_KEYS.has(k)) {
        return jsonNoStore({ ok: false, error: `Campo não permitido: ${k}` }, 400);
      }
    }

    const patch: Record<string, any> = {};
    const fieldErrors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    const now = new Date().toISOString();

    // step-1
    if ("companyName" in body) patch.company_name = clampText(normText(body.companyName), 120);
    if ("tradeName" in body) patch.trade_name = clampText(normText(body.tradeName), 120);
    if ("websiteOrInstagram" in body)
      patch.website_or_instagram = clampText(normText(body.websiteOrInstagram), 140);
    if ("segment" in body) patch.segment = clampText(normText(body.segment), 80);

    if ("companySize" in body) {
      const cs = normalizeCompanySize(body.companySize);
      if (body.companySize != null && cs == null) {
        fieldErrors.companySize = "Tamanho da empresa inválido.";
      } else {
        patch.company_size = cs;
      }
    }

    // CNPJ “inteligente” (não trava enquanto digita)
    if ("cnpj" in body) {
      const digits = onlyDigits(body.cnpj);

      if (digits.length === 0) {
        patch.cnpj = null;
      } else if (digits.length < 14) {
        // ignora durante digitação (sem erro, sem salvar parcial)
      } else if (digits.length > 14) {
        fieldErrors.cnpj = "CNPJ inválido.";
      } else {
        const cnpjCheck = validateCnpjOptional(digits);
        if (!cnpjCheck.ok || !cnpjCheck.value) {
          fieldErrors.cnpj = cnpjCheck.message || "CNPJ inválido.";
        } else {
          const sb = supabaseAdmin();

          const { data: existingRow } = await sb
            .from("wz_onboarding")
            .select("user_id,cnpj")
            .eq("user_id", s.userId)
            .maybeSingle();

          const existingCnpj = existingRow?.cnpj ? String(existingRow.cnpj) : null;
          const incoming = cnpjCheck.value;

          if (existingCnpj && existingCnpj === incoming) {
            patch.cnpj = incoming;
          } else {
            const exists = await verifyCnpjExists(incoming);

            if (exists.ok && exists.found) {
              patch.cnpj = incoming;
            } else if (exists.ok && !exists.found) {
              fieldErrors.cnpj = "CNPJ não encontrado.";
            } else {
              patch.cnpj = incoming;
              warnings.cnpj = "Não foi possível verificar agora (rede/limite). Vamos aceitar e seguir.";
            }
          }
        }
      }
    }

    // step-2
    if ("mainUse" in body) patch.main_use = clampText(normText(body.mainUse), 60);
    if ("priorityNow" in body) patch.priority_now = clampText(normText(body.priorityNow), 60);

    if ("hasSupervisor" in body) {
      patch.has_supervisor = normalizeBoolNullable(body.hasSupervisor);
    }

    if ("serviceHours" in body) patch.service_hours = clampText(normText(body.serviceHours), 60);

    if ("targetResponseTime" in body) {
      patch.target_response_time = clampText(normText(body.targetResponseTime), 30);
    }

    if ("languages" in body) {
      patch.languages = normalizeLanguages(body.languages);
    }

    // step-3
    if ("aiAutoMode" in body) patch.ai_auto_mode = normalizeAiAutoMode(body.aiAutoMode);

    if ("handoffHumanRequest" in body)
      patch.ai_handoff_human_request = normalizeBoolNullable(body.handoffHumanRequest);

    if ("handoffAngerUrgency" in body)
      patch.ai_handoff_anger_urgency = normalizeBoolNullable(body.handoffAngerUrgency);

    if ("handoffAfterMessages" in body) {
      const n = normalizeIntNullable(body.handoffAfterMessages, 1, 50);
      // se vier algo inválido durante digitação, ignora (não salva, não trava)
      if (String(body.handoffAfterMessages ?? "").trim().length === 0) {
        patch.ai_handoff_after_messages = null;
      } else if (n != null) {
        patch.ai_handoff_after_messages = n;
      }
    }

    if ("handoffPricePayment" in body)
      patch.ai_handoff_price_payment = normalizeBoolNullable(body.handoffPricePayment);

    if ("brandTone" in body) patch.brand_tone = normalizeBrandTone(body.brandTone);
    if ("msgSignature" in body) patch.msg_signature = clampText(normText(body.msgSignature), 80);

    // extras IA
    if ("aiCatalogSummary" in body) patch.ai_catalog_summary = clampText(normText(body.aiCatalogSummary), 260);
    if ("aiKnowledgeLinks" in body) patch.ai_knowledge_links = clampText(normText(body.aiKnowledgeLinks), 520);
    if ("aiGuardrails" in body) patch.ai_guardrails = clampText(normText(body.aiGuardrails), 520);

    // Se nada válido sobrou (ex.: só cnpj parcial), não grava
    if (Object.keys(patch).length === 0) {
      return jsonNoStore(
        {
          ok: true,
          fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
          warnings: Object.keys(warnings).length ? warnings : undefined,
        },
        200,
      );
    }

    patch.updated_at = now;
    patch.completed = false;

    const sb = supabaseAdmin();

    const { error } = await sb
      .from("wz_onboarding")
      .upsert(
        {
          user_id: s.userId,
          email: s.email,
          ...patch,
          created_at: now,
        },
        { onConflict: "user_id" },
      );

    if (error) return jsonNoStore({ ok: false, error: error.message }, 500);

    return jsonNoStore(
      {
        ok: true,
        fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
        warnings: Object.keys(warnings).length ? warnings : undefined,
      },
      200,
    );
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: e?.message || "Erro inesperado." }, 500);
  }
}
