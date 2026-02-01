import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import {
  jsonNoStore,
  normText,
  normalizeCompanySize,
  validateCnpjOptional,
  normalizeLanguages,
  onlyDigits,
  verifyCnpjExists,
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
]);

function clampText(v: string | null, max: number) {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return jsonNoStore({ ok: false }, 401);

  try {
    const body = await req.json().catch(() => ({}));

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonNoStore({ ok: false, error: "Payload inválido." }, 400);
    }

    // bloqueia abuso por chaves inesperadas
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
      patch.company_size = normalizeCompanySize(body.companySize);
      // se veio inválido, não trava tudo — só não salva o campo
      if (body.companySize != null && patch.company_size == null) {
        fieldErrors.companySize = "Tamanho da empresa inválido.";
        delete patch.company_size;
      }
    }

    // ===== CNPJ “inteligente” =====
    // - 0 dígitos: salva null
    // - 1..13: ignora (não salva, não erra, não trava autosave)
    // - 14: valida dígitos + verifica existência (sem travar o resto)
    if ("cnpj" in body) {
      const digits = onlyDigits(body.cnpj);

      if (digits.length === 0) {
        patch.cnpj = null;
      } else if (digits.length < 14) {
        // ignora enquanto está digitando (evita 400 e evita sobrescrever valor anterior)
      } else if (digits.length > 14) {
        fieldErrors.cnpj = "CNPJ inválido.";
      } else {
        // 14 dígitos: valida DV
        const cnpjCheck = validateCnpjOptional(digits);
        if (!cnpjCheck.ok || !cnpjCheck.value) {
          fieldErrors.cnpj = cnpjCheck.message || "CNPJ inválido.";
        } else {
          // evita bater em API externa se não mudou
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
              // confirmado “não encontrado” (nenhum provedor achou)
              fieldErrors.cnpj = "CNPJ não encontrado.";
            } else {
              // indisponível/rate limit/timeout: não trava
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
      if (body.hasSupervisor === true) patch.has_supervisor = true;
      else if (body.hasSupervisor === false) patch.has_supervisor = false;
      else patch.has_supervisor = null;
    }

    if ("serviceHours" in body) patch.service_hours = clampText(normText(body.serviceHours), 60);

    if ("targetResponseTime" in body) {
      patch.target_response_time = clampText(normText(body.targetResponseTime), 30);
    }

    if ("languages" in body) {
      patch.languages = normalizeLanguages(body.languages);
    }

    // se não sobrou nada pra salvar (ex.: só CNPJ parcial), não grava no banco
    const hasAnyFieldToPersist = Object.keys(patch).length > 0;

    if (!hasAnyFieldToPersist) {
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

    // upsert: cria/atualiza sem “zerar” campos não enviados
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

    if (error) {
      return jsonNoStore({ ok: false, error: error.message }, 500);
    }

    return jsonNoStore(
      {
        ok: true,
        fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
        warnings: Object.keys(warnings).length ? warnings : undefined,
      },
      200,
    );
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: e?.message || "Erro inesperado." },
      500,
    );
  }
}
