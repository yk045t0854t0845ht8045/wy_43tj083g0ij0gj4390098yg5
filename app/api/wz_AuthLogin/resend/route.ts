import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_supabase";
import { sha, gen7, newSalt } from "../_codes";
import { sendLoginCodeEmail } from "../_email";

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

function normalizeStep(step: string) {
  const s = String(step || "").trim();
  if (s === "emailCode") return "email";
  if (s === "smsCode") return "sms";
  return s;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const step = normalizeStep(String(body?.step || ""));

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "E-mail invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (step !== "email") {
      return NextResponse.json(
        { ok: false, error: "No momento apenas reenvio por e-mail esta ativo." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const sb = supabaseAdmin();

    const pend = await sb.from("wz_pending_auth").select("*").eq("email", email).maybeSingle();
    if (!pend.data) {
      return NextResponse.json(
        { ok: false, error: "Sessao invalida. Reinicie." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    await sb
      .from("wz_auth_challenges")
      .update({ consumed: true })
      .eq("email", email)
      .eq("channel", "email")
      .eq("consumed", false);

    const code = gen7();
    const salt = newSalt();
    const hash = sha(code, salt);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

    const { error } = await sb.from("wz_auth_challenges").insert({
      email,
      channel: "email",
      code_hash: hash,
      salt,
      expires_at: expiresAt,
      attempts_left: 7,
      consumed: false,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Falha ao gerar e-mail." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    await sendLoginCodeEmail(email, code);
    return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("[resend] error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
