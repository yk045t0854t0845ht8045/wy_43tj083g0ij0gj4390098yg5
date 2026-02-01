// app/api/wz_OnboardSystem/save/route.ts
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import {
  jsonNoStore,
  normText,
  normalizeCompanySize,
  validateCnpjOptional,
  normalizeLanguages,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function onlyDigits(v: any) {
  return String(v ?? "").replace(/\D+/g, "");
}

function capText(v: any, max: number) {
  const t = normText(v);
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export async function POST(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return jsonNoStore({ ok: false }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    if (!isPlainObject(body)) {
      return jsonNoStore({ ok: false, error: "Payload inválido." }, 400);
    }

    // Patch: só atualiza o que vier no body (não apaga o resto)
    const patch: Record<string, any> = {};
    const now = new Date().toISOString();

    // -------------------------
    // step-1 (tolerante, sem 400 por digitação)
    // -------------------------
    if ("companyName" in body) patch.company_name = capText(body.companyName, 120);
    if ("tradeName" in body) patch.trade_name = capText(body.tradeName, 120);
    if ("websiteOrInstagram" in body)
      patch.website_or_instagram = capText(body.websiteOrInstagram, 180);
    if ("segment" in body) patch.segment = capText(body.segment, 80);

    if ("companySize" in body) {
      const raw = String(body.companySize ?? "").trim();
      if (!raw) {
        patch.company_size = null; // permite limpar
      } else {
        const v = normalizeCompanySize(raw);
        if (v) patch.company_size = v; // inválido -> ignora (não zera)
      }
    }

    // ✅ CNPJ: NUNCA dá 400 por “incompleto” durante digitação
    if ("cnpj" in body) {
      const d = onlyDigits(body.cnpj);

      if (!d.length) {
        patch.cnpj = null; // limpou
      } else if (d.length < 14) {
        // incompleto: ignora (não salva e não dá erro)
      } else if (d.length === 14) {
        const cnpjCheck = validateCnpjOptional(d);
        if (!cnpjCheck.ok) {
          return jsonNoStore({ ok: false, error: cnpjCheck.message }, 400);
        }
        patch.cnpj = cnpjCheck.value;
      } else {
        // maior que 14 -> abuso/payload ruim
        return jsonNoStore({ ok: false, error: "CNPJ inválido." }, 400);
      }
    }

    // -------------------------
    // step-2
    // -------------------------
    if ("mainUse" in body) patch.main_use = capText(body.mainUse, 120);
    if ("priorityNow" in body) patch.priority_now = capText(body.priorityNow, 120);

    if ("hasSupervisor" in body) {
      if (body.hasSupervisor === true) patch.has_supervisor = true;
      else if (body.hasSupervisor === false) patch.has_supervisor = false;
      else if (body.hasSupervisor == null) patch.has_supervisor = null;
      // valor inválido -> ignora (não dá 400)
    }

    if ("serviceHours" in body) patch.service_hours = capText(body.serviceHours, 80);
    if ("targetResponseTime" in body)
      patch.target_response_time = capText(body.targetResponseTime, 80);

    if ("languages" in body) {
      if (Array.isArray(body.languages)) {
        patch.languages = normalizeLanguages(body.languages);
      } else if (body.languages == null) {
        patch.languages = null;
      }
      // inválido -> ignora
    }

    // remove undefined (não manda pro DB)
    for (const k of Object.keys(patch)) {
      if (patch[k] === undefined) delete patch[k];
    }

    // se não tem nada pra salvar (ex.: cnpj incompleto sozinho), responde OK sem escrever no DB
    const hasRealFields = Object.keys(patch).length > 0;
    if (!hasRealFields) {
      return jsonNoStore({ ok: true }, 200);
    }

    // updated_at só quando realmente vai persistir algo
    patch.updated_at = now;

    const sb = supabaseAdmin();

    // garante linha criada sem “zerar” campos não enviados
    const { data: exists, error: exErr } = await sb
      .from("wz_onboarding")
      .select("user_id,completed")
      .eq("user_id", s.userId)
      .maybeSingle();

    if (exErr) {
      return jsonNoStore({ ok: false, error: exErr.message }, 500);
    }

    // se já completou, bloqueia update por save (evita abuso e evita “descompletar”)
    if (exists?.completed === true) {
      return jsonNoStore({ ok: false, error: "Onboarding já foi finalizado." }, 409);
    }

    if (exists?.user_id) {
      const { error } = await sb
        .from("wz_onboarding")
        .update(patch)
        .eq("user_id", s.userId);

      if (error) return jsonNoStore({ ok: false, error: error.message }, 500);
    } else {
      const { error } = await sb.from("wz_onboarding").insert({
        user_id: s.userId,
        email: s.email,
        created_at: now,
        completed: false,
        ...patch,
      });

      if (error) return jsonNoStore({ ok: false, error: error.message }, 500);
    }

    return jsonNoStore({ ok: true }, 200);
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: e?.message || "Erro inesperado." },
      500,
    );
  }
}
