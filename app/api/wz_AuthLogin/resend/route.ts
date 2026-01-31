import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_supabase";
import { sha, gen7, newSalt, maskPhoneE164, isValidE164BRMobile } from "../_codes";
import { sendSmsCode } from "../_sms";
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

    if (!isValidEmail(email))
      return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400, headers: NO_STORE_HEADERS });

    if (step !== "email" && step !== "sms") {
      return NextResponse.json({ ok: false, error: "Etapa inválida para reenvio." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const sb = supabaseAdmin();

    const pend = await sb.from("wz_pending_auth").select("*").eq("email", email).maybeSingle();
    const pendRow = pend.data;

    if (!pendRow) {
      return NextResponse.json({ ok: false, error: "Sessão inválida. Reinicie." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (step === "email") {
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

      if (error) return NextResponse.json({ ok: false, error: "Falha ao gerar e-mail." }, { status: 500, headers: NO_STORE_HEADERS });

      await sendLoginCodeEmail(email, code);
      return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE_HEADERS });
    }

    // step === sms
    const phoneE164 = String(pendRow?.phone_e164 || "");
    if (!phoneE164) {
      return NextResponse.json({ ok: false, error: "Nenhum telefone encontrado para SMS." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    // ✅ valida antes de reenviar
    if (!isValidE164BRMobile(phoneE164)) {
      return NextResponse.json(
        { ok: false, error: "Telefone inválido para SMS. Use um celular BR válido com DDD." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await sb
      .from("wz_auth_challenges")
      .update({ consumed: true })
      .eq("email", email)
      .eq("channel", "sms")
      .eq("consumed", false);

    const smsCode = gen7();
    const smsSalt = newSalt();
    const smsHash = sha(smsCode, smsSalt);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

    const { error: smsErr } = await sb.from("wz_auth_challenges").insert({
      email,
      channel: "sms",
      code_hash: smsHash,
      salt: smsSalt,
      expires_at: expiresAt,
      attempts_left: 7,
      consumed: false,
    });

    if (smsErr) return NextResponse.json({ ok: false, error: "Falha ao gerar SMS." }, { status: 500, headers: NO_STORE_HEADERS });

    await sendSmsCode(phoneE164, smsCode);

    return NextResponse.json({ ok: true, phoneMask: maskPhoneE164(phoneE164) }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (e: any) {
    console.error("[resend] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro inesperado." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
