import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAnon } from "../_supabase";
import { sha, gen7, newSalt, maskPhoneE164, onlyDigits, isValidE164BRMobile } from "../_codes";
import { sendSmsCode } from "../_sms";
import { setSessionCookie } from "../_session";

function isValidEmail(v: string) {
  const s = (v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

async function findAuthUserIdByEmail(sb: ReturnType<typeof supabaseAdmin>, email: string) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  const PER_PAGE = 200;
  const MAX_PAGES = 20;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PER_PAGE });

    if (error) {
      console.error("[verify-email] listUsers error:", error);
      return null;
    }

    const users = (data?.users || []) as Array<any>;
    const found = users.find((u) => String(u?.email || "").trim().toLowerCase() === target);

    if (found?.id) return String(found.id);
    if (users.length < PER_PAGE) break;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const code = onlyDigits(String(body?.code || "")).slice(0, 7);
    const password = String(body?.password || "");

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400 });
    }
    if (code.length !== 7) {
      return NextResponse.json({ ok: false, error: "Código inválido." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ ok: false, error: "Senha inválida." }, { status: 400 });
    }

    const sb = supabaseAdmin();

    const pend = await sb.from("wz_pending_auth").select("*").eq("email", email).maybeSingle();
    if (pend.error || !pend.data) {
      return NextResponse.json({ ok: false, error: "Sessão inválida. Reinicie." }, { status: 400 });
    }

    const flow = String(pend.data.flow || "login");

    const { data: ch, error: chErr } = await sb
      .from("wz_auth_challenges")
      .select("*")
      .eq("email", email)
      .eq("channel", "email")
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chErr || !ch) {
      return NextResponse.json({ ok: false, error: "Código expirado. Reenvie." }, { status: 400 });
    }

    if (new Date(ch.expires_at).getTime() < Date.now()) {
      await sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", ch.id);
      return NextResponse.json({ ok: false, error: "Código expirado. Reenvie." }, { status: 400 });
    }

    if (Number(ch.attempts_left) <= 0) {
      return NextResponse.json({ ok: false, error: "Muitas tentativas. Reenvie o código." }, { status: 429 });
    }

    const hash = sha(code, ch.salt);

    if (hash !== ch.code_hash) {
      await sb
        .from("wz_auth_challenges")
        .update({ attempts_left: Math.max(0, Number(ch.attempts_left) - 1) })
        .eq("id", ch.id);

      return NextResponse.json({ ok: false, error: "Código inválido." }, { status: 400 });
    }

    await sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", ch.id);

    // ✅ LOGIN: valida senha e finaliza
    if (flow === "login") {
      const anon = supabaseAnon();
      const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });

      if (signErr || !signIn?.user?.id) {
        return NextResponse.json({ ok: false, error: "Senha incorreta." }, { status: 401 });
      }

      const { data: userRow, error: uErr } = await sb
        .from("wz_users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (uErr || !userRow?.id) {
        return NextResponse.json({ ok: false, error: "Conta não encontrada." }, { status: 404 });
      }

      try {
        await sb.from("wz_pending_auth").delete().eq("email", email);
      } catch {}

      const nextUrl = "https://dashboard.wyzer.com.br/create-account";

      const res = NextResponse.json({ ok: true, nextUrl }, { status: 200 });
    setSessionCookie(res, { userId: String(userRow.id), email }, req.headers);
      return res;
    }

    // ✅ REGISTER: confirma Auth + garante senha no Auth + gera SMS
    let authUserId = pend.data.auth_user_id ? String(pend.data.auth_user_id) : "";

    if (!authUserId) {
      const recovered = await findAuthUserIdByEmail(sb, email);
      if (recovered) authUserId = recovered;
    }

    if (authUserId) {
      try {
        await sb.auth.admin.updateUserById(authUserId, {
          email_confirm: true,
          password,
        });
      } catch (err) {
        console.error("[verify-email] auth confirm/update password failed:", err);
      }

      try {
        await sb
          .from("wz_pending_auth")
          .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
          .eq("email", email);
      } catch {}
    }

    const phoneE164 = String(pend.data.phone_e164 || "");
    if (!phoneE164) {
      return NextResponse.json({ ok: false, error: "Telefone não encontrado para SMS." }, { status: 400 });
    }

    // ✅ valida E.164 BR celular antes de tentar enviar
    if (!isValidE164BRMobile(phoneE164)) {
      return NextResponse.json(
        { ok: false, error: "Telefone inválido para SMS. Use um celular BR válido com DDD." },
        { status: 400 }
      );
    }

    await sb.from("wz_pending_auth").update({ stage: "sms" }).eq("email", email);

    // invalida sms antigos
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

    if (smsErr) {
      return NextResponse.json({ ok: false, error: "Falha ao gerar SMS." }, { status: 500 });
    }

    await sendSmsCode(phoneE164, smsCode);

    return NextResponse.json(
      { ok: true, next: "sms", phoneMask: maskPhoneE164(phoneE164) },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[verify-email] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro inesperado." }, { status: 500 });
  }
}
