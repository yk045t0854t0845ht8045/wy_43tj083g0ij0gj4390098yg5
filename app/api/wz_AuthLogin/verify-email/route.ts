import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAnon } from "../_supabase";
import {
  sha,
  gen7,
  newSalt,
  maskPhoneE164,
  onlyDigits,
  isValidE164BRMobile,
} from "../_codes";
import { sendSmsCode } from "../_sms";
import { setSessionCookie } from "../_session";
import crypto from "crypto";

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

function getEnvBool(name: string, def: boolean) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return def;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return def;
}

function isHostOnlyMode() {
  const isProd = process.env.NODE_ENV === "production";
  return isProd && getEnvBool("SESSION_COOKIE_HOST_ONLY", true);
}

function getDashboardOrigin() {
  const env = String(process.env.DASHBOARD_ORIGIN || "").trim();
  if (env) return env.replace(/\/+$/g, "");
  return "https://dashboard.wyzer.com.br";
}

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest(),
  );
}

function makeDashboardTicket(params: { userId: string; email: string; ttlMs?: number }) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET não configurado.");

  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 5); // 5 min
  const payload = {
    userId: String(params.userId),
    email: String(params.email).trim().toLowerCase(),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function sanitizeNext(nextRaw: string) {
  const s = String(nextRaw || "").trim();
  if (!s) return "/";

  if (s.startsWith("/")) return s;

  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();

    const ok =
      host === "wyzer.com.br" ||
      host.endsWith(".wyzer.com.br") ||
      host === "localhost" ||
      host.endsWith(".localhost");

    if (!ok) return "/";

    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
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

    // ✅ onde voltar após login (página original do usuário)
    const nextFromBody = String(body?.next || body?.returnTo || "").trim();
    const nextSafe = sanitizeNext(nextFromBody || "/");

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (code.length !== 7) {
      return NextResponse.json({ ok: false, error: "Código inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ ok: false, error: "Senha inválida." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const sb = supabaseAdmin();

    const pend = await sb.from("wz_pending_auth").select("*").eq("email", email).maybeSingle();
    if (pend.error || !pend.data) {
      return NextResponse.json({ ok: false, error: "Sessão inválida. Reinicie." }, { status: 400, headers: NO_STORE_HEADERS });
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
      return NextResponse.json({ ok: false, error: "Código expirado. Reenvie." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (new Date(ch.expires_at).getTime() < Date.now()) {
      await sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", ch.id);
      return NextResponse.json({ ok: false, error: "Código expirado. Reenvie." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (Number(ch.attempts_left) <= 0) {
      return NextResponse.json({ ok: false, error: "Muitas tentativas. Reenvie o código." }, { status: 429, headers: NO_STORE_HEADERS });
    }

    const hash = sha(code, ch.salt);

    if (hash !== ch.code_hash) {
      await sb
        .from("wz_auth_challenges")
        .update({ attempts_left: Math.max(0, Number(ch.attempts_left) - 1) })
        .eq("id", ch.id);

      return NextResponse.json({ ok: false, error: "Código inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    await sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", ch.id);

    // ✅ LOGIN: valida senha e finaliza
    if (flow === "login") {
      const anon = supabaseAnon();
      const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });

      if (signErr || !signIn?.user?.id) {
        return NextResponse.json({ ok: false, error: "Senha incorreta." }, { status: 401, headers: NO_STORE_HEADERS });
      }

      const { data: userRow, error: uErr } = await sb
        .from("wz_users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (uErr || !userRow?.id) {
        return NextResponse.json({ ok: false, error: "Conta não encontrada." }, { status: 404, headers: NO_STORE_HEADERS });
      }

      try {
        await sb.from("wz_pending_auth").delete().eq("email", email);
      } catch {}

      const dashboard = getDashboardOrigin();

      // ✅ host-only => NÃO seta cookie aqui (login host). Usa ticket + exchange no dashboard.
      if (isHostOnlyMode()) {
        const ticket = makeDashboardTicket({ userId: String(userRow.id), email });
        const nextUrl =
          `${dashboard}/api/wz_AuthLogin/exchange` +
          `?ticket=${encodeURIComponent(ticket)}` +
          `&next=${encodeURIComponent(nextSafe)}`;

        const res = NextResponse.json(
          { ok: true, nextUrl },
          { status: 200, headers: NO_STORE_HEADERS },
        );
        setSessionCookie(res, { userId: String(userRow.id), email }, req.headers);
        return res;
      }

      // ✅ Legacy/domain-cookie mode: pode setar cookie direto e ir pro dashboard
      const nextUrl = `${dashboard}${nextSafe.startsWith("/") ? nextSafe : "/"}`;
      const res = NextResponse.json({ ok: true, nextUrl }, { status: 200, headers: NO_STORE_HEADERS });
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
      return NextResponse.json({ ok: false, error: "Telefone não encontrado para SMS." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (!isValidE164BRMobile(phoneE164)) {
      return NextResponse.json(
        { ok: false, error: "Telefone inválido para SMS. Use um celular BR válido com DDD." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await sb.from("wz_pending_auth").update({ stage: "sms" }).eq("email", email);

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
      return NextResponse.json({ ok: false, error: "Falha ao gerar SMS." }, { status: 500, headers: NO_STORE_HEADERS });
    }

    await sendSmsCode(phoneE164, smsCode);

    return NextResponse.json(
      { ok: true, next: "sms", phoneMask: maskPhoneE164(phoneE164) },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (e: any) {
    console.error("[verify-email] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro inesperado." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
