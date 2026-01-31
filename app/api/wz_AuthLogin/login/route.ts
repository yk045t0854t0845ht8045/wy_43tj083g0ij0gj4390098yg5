import { NextResponse } from "next/server";
import { supabaseAnon } from "../_supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Mantido por compatibilidade.
 * Recomendado: use o fluxo /start + /verify-email no front.
 */
function isValidEmail(v: string) {
  const s = (v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "").trim();

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Senha inválida." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const sb = supabaseAnon();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401, headers: NO_STORE_HEADERS });
    }

    return NextResponse.json(
      { ok: true, user: data.user, session: data.session },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
