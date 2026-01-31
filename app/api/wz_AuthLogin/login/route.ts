import { NextResponse } from "next/server";
import { supabaseAnon } from "../_supabase";

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
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Senha inválida." }, { status: 400 });
    }

    const sb = supabaseAnon();

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    return NextResponse.json(
      { ok: true, user: data.user, session: data.session },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}
