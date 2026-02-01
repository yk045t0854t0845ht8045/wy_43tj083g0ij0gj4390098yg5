// app/api/wz_OnboardSystem/me/route.ts
import { NextResponse, type NextRequest } from "next/server";
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
        "company_name,cnpj,trade_name,website_or_instagram,segment,company_size,completed,updated_at",
      )
      .eq("user_id", s.userId)
      .maybeSingle();

    if (error) {
      return jsonNoStore(
        { ok: false, error: error.message || "Falha ao buscar onboarding." },
        500,
      );
    }

    const payload: OnboardData = {
      companyName: data?.company_name ?? null,
      cnpj: data?.cnpj ?? null,
      tradeName: data?.trade_name ?? null,
      websiteOrInstagram: data?.website_or_instagram ?? null,
      segment: data?.segment ?? null,
      companySize: (data?.company_size ?? null) as any,
      completed: !!data?.completed,
      updatedAt: data?.updated_at ?? null,
    };

    return jsonNoStore({ ok: true, data: payload }, 200);
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: e?.message || "Erro inesperado." },
      500,
    );
  }
}
