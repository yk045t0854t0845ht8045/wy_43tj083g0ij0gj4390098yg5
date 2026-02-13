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
import {
  createTrustedLoginToken,
  getTrustedLoginTtlSeconds,
  hashTrustedLoginToken,
  setTrustedLoginCookie,
} from "../_trusted_login";
import crypto from "crypto";
import { createLoginTwoFactorTicket } from "../_login_two_factor_ticket";
import { resolveTwoFactorState } from "@/app/api/_twoFactor";

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
function sanitizeFullName(v?: string | null) {
  const clean = String(v || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.slice(0, 120);
}

function makeDashboardTicket(params: {
  userId: string;
  email: string;
  fullName?: string | null;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET não configurado.");

  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 5); // 5 min
  const safeFullName = sanitizeFullName(params.fullName);
  const payload = {
    userId: String(params.userId),
    email: String(params.email).trim().toLowerCase(),
    ...(safeFullName ? { fullName: safeFullName } : {}),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

async function issueTrustedLogin(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
  res: NextResponse,
) {
  try {
    const token = createTrustedLoginToken();
    const tokenHash = hashTrustedLoginToken(token);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expIso = new Date(
      now + getTrustedLoginTtlSeconds() * 1000,
    ).toISOString();

    const { error } = await sb.from("wz_auth_trusted_devices").insert({
      email,
      token_hash: tokenHash,
      created_at: nowIso,
      last_used_at: nowIso,
      expires_at: expIso,
    });

    if (error) {
      console.error("[verify-email] trusted login insert error:", error);
      return;
    }

    setTrustedLoginCookie(res, token);
  } catch (error) {
    console.error("[verify-email] issueTrustedLogin error:", error);
  }
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

    const users = (data?.users || []) as Array<{ id?: string | null; email?: string | null }>;
    const found = users.find((u) => String(u?.email || "").trim().toLowerCase() === target);

    if (found?.id) return String(found.id);
    if (users.length < PER_PAGE) break;
  }

  return null;
}

function isPasskeySchemaMissing(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string"
    ? String((error as { code?: string }).code)
    : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("wz_auth_passkeys");
}

async function hasWindowsHelloPasskey(
  sb: ReturnType<typeof supabaseAdmin>,
  userId: string,
) {
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) return false;

  const { data, error } = await sb
    .from("wz_auth_passkeys")
    .select("credential_id")
    .eq("user_id", cleanUserId)
    .limit(1);

  if (!error) {
    return Array.isArray(data) && data.length > 0;
  }

  if (!isPasskeySchemaMissing(error)) {
    console.error("[verify-email] passkey lookup error:", error);
  }
  return false;
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
      const nextAttempts = Math.max(0, Number(ch.attempts_left) - 1);
      await sb
        .from("wz_auth_challenges")
        .update({
          attempts_left: nextAttempts,
          ...(nextAttempts <= 0 ? { consumed: true } : {}),
        })
        .eq("id", ch.id);

      if (nextAttempts <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Voce atingiu o limite de 7 tentativas. Reenvie o codigo, pois este nao e mais valido.",
          },
          { status: 429, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: `Codigo invalido. Tente novamente. Restam ${nextAttempts} tentativa${nextAttempts === 1 ? "" : "s"}.`,
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
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
        .select("id,full_name")
        .ilike("email", email)
        .maybeSingle();

      const authMeta = (signIn?.user?.user_metadata ?? null) as { full_name?: string | null } | null;
      const authMetaFullName = String(authMeta?.full_name || "").trim();
      const resolvedFullName = sanitizeFullName(userRow?.full_name || authMetaFullName);

      if (uErr || !userRow?.id) {
        return NextResponse.json({ ok: false, error: "Conta não encontrada." }, { status: 404, headers: NO_STORE_HEADERS });
      }

      const resolvedUserId = String(userRow.id || "").trim();
      const twoFactorState = await resolveTwoFactorState({
        sb,
        sessionUserId: resolvedUserId,
        wzUserId: resolvedUserId,
      });
      const hasTotp = Boolean(twoFactorState.enabled && twoFactorState.secret);
      const hasPasskey = await hasWindowsHelloPasskey(sb, resolvedUserId);

      if (hasTotp || hasPasskey) {
        const twoFactorTicket = createLoginTwoFactorTicket({
          userId: resolvedUserId,
          email,
          fullName: resolvedFullName,
        });
        return NextResponse.json(
          {
            ok: true,
            next: "two-factor",
            requiresTwoFactor: hasTotp,
            requiresPasskey: hasPasskey,
            authMethods: {
              totp: hasTotp,
              passkey: hasPasskey,
            },
            preferredAuthMethod: !hasTotp && hasPasskey ? "passkey" : "totp",
            twoFactorTicket,
          },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }

      try {
        await sb.from("wz_pending_auth").delete().eq("email", email);
      } catch {}

      const dashboard = getDashboardOrigin();

      // ✅ host-only => seta no login host e usa ticket + exchange no dashboard.
      if (isHostOnlyMode()) {
        const ticket = makeDashboardTicket({
          userId: resolvedUserId,
          email,
          fullName: resolvedFullName,
        });
        const nextUrl =
          `${dashboard}/api/wz_AuthLogin/exchange` +
          `?ticket=${encodeURIComponent(ticket)}` +
          `&next=${encodeURIComponent(nextSafe)}`;

        const res = NextResponse.json(
          { ok: true, nextUrl },
          { status: 200, headers: NO_STORE_HEADERS },
        );
        setSessionCookie(
          res,
          { userId: resolvedUserId, email, fullName: resolvedFullName },
          req.headers,
        );
        await issueTrustedLogin(sb, email, res);
        return res;
      }

      // ✅ Legacy/domain-cookie mode: pode setar cookie direto e ir pro dashboard
      const nextUrl = `${dashboard}${nextSafe.startsWith("/") ? nextSafe : "/"}`;
      const res = NextResponse.json({ ok: true, nextUrl }, { status: 200, headers: NO_STORE_HEADERS });
      setSessionCookie(
        res,
        { userId: resolvedUserId, email, fullName: resolvedFullName },
        req.headers,
      );
      await issueTrustedLogin(sb, email, res);
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
  } catch (e: unknown) {
    console.error("[verify-email] error:", e);
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

