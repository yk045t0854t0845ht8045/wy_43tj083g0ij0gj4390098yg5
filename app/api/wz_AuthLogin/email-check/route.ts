import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function isValidEmail(v: string) {
  const s = (v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("wz_users")
      .select("id,email,phone_e164")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Falha ao consultar cadastro." }, { status: 500, headers: NO_STORE_HEADERS });
    }

    return NextResponse.json(
      { exists: !!data, hasPhone: !!data?.phone_e164 },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
