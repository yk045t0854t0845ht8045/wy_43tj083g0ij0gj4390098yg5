// app/api/wz_OnboardSystem/save/route.ts
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import {
  jsonNoStore,
  normText,
  normalizeCompanySize,
  validateCnpjOptional,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return jsonNoStore({ ok: false }, 401);

  try {
    const body = await req.json().catch(() => ({}));

    // Patch: só atualiza o que vier no body (não apaga o resto)
    const patch: Record<string, any> = {};
    const now = new Date().toISOString();

    if ("companyName" in body) patch.company_name = normText(body.companyName);
    if ("tradeName" in body) patch.trade_name = normText(body.tradeName);
    if ("websiteOrInstagram" in body)
      patch.website_or_instagram = normText(body.websiteOrInstagram);
    if ("segment" in body) patch.segment = normText(body.segment);

    if ("companySize" in body) {
      patch.company_size = normalizeCompanySize(body.companySize);
    }

    if ("cnpj" in body) {
      const cnpjCheck = validateCnpjOptional(body.cnpj);
      if (!cnpjCheck.ok) return jsonNoStore({ ok: false, error: cnpjCheck.message }, 400);
      patch.cnpj = cnpjCheck.value;
    }

    patch.updated_at = now;
    patch.completed = false;

    const sb = supabaseAdmin();

    // garante linha criada sem “zerar” campos não enviados
    const { data: exists } = await sb
      .from("wz_onboarding")
      .select("user_id")
      .eq("user_id", s.userId)
      .maybeSingle();

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
        ...patch,
        created_at: now,
      });

      if (error) return jsonNoStore({ ok: false, error: error.message }, 500);
    }

    return jsonNoStore({ ok: true }, 200);
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: e?.message || "Erro inesperado." }, 500);
  }
}
