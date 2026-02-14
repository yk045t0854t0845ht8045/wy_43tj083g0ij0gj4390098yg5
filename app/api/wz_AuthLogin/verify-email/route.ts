import crypto from "crypto";
import { NextResponse } from "next/server";
import { resolveTwoFactorState } from "@/app/api/_twoFactor";
import { supabaseAdmin, supabaseAnon } from "../_supabase";
import {
  gen7,
  isValidE164BRMobile,
  maskPhoneE164,
  newSalt,
  onlyDigits,
  sha,
} from "../_codes";
import { sendAuthSmsCode } from "../_sms";
import { setSessionCookie } from "../_session";
import { registerIssuedSession } from "../_session_devices";
import {
  createTrustedLoginToken,
  getTrustedLoginTtlSeconds,
  hashTrustedLoginToken,
  setTrustedLoginCookie,
} from "../_trusted_login";
import { createLoginTwoFactorTicket } from "../_login_two_factor_ticket";

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

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeProvider(value?: string | null) {
  return String(value || "").trim().toLowerCase();
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
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 5);
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

function isMissingColumnError(error: unknown, column: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const needle = String(column || "").trim().toLowerCase();
  if (!needle) return false;
  if (code === "42703" || code === "PGRST204") return true;
  return (
    (message.includes(needle) || details.includes(needle)) &&
    (message.includes("column") || details.includes("column"))
  );
}

type WzUserSnapshot = {
  id: string | null;
  authUserId: string | null;
  authProvider: string | null;
  phoneE164: string | null;
};

async function getWzUserSnapshotByEmail(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
) {
  const columnsToTry = [
    "id,auth_user_id,auth_provider,phone_e164",
    "id,auth_user_id,phone_e164",
    "id,auth_user_id",
    "id,phone_e164",
    "id",
  ];

  for (const columns of columnsToTry) {
    const res = await sb
      .from("wz_users")
      .select(columns)
      .ilike("email", email)
      .maybeSingle();

    if (!res.error) {
      const row = (res.data || {}) as {
        id?: string | null;
        auth_user_id?: string | null;
        auth_provider?: string | null;
        phone_e164?: string | null;
      };

      return {
        id: normalizeText(row.id),
        authUserId: normalizeText(row.auth_user_id),
        authProvider: normalizeProvider(row.auth_provider),
        phoneE164: normalizeText(row.phone_e164),
      } as WzUserSnapshot;
    }

    const hasMissingColumn = ["id", "auth_user_id", "auth_provider", "phone_e164"].some(
      (column) => isMissingColumnError(res.error, column),
    );
    if (!hasMissingColumn) {
      console.error("[verify-email] wz_users snapshot error:", res.error);
      break;
    }
  }

  return {
    id: null,
    authUserId: null,
    authProvider: null,
    phoneE164: null,
  } as WzUserSnapshot;
}

function hasGoogleIdentity(user: unknown) {
  const candidate =
    user && typeof user === "object"
      ? (user as {
          app_metadata?: Record<string, unknown> | null;
          identities?: Array<Record<string, unknown>> | null;
        })
      : null;
  if (!candidate) return false;

  const appProvider = String(candidate.app_metadata?.provider || "")
    .trim()
    .toLowerCase();
  if (appProvider === "google") return true;

  const identities = Array.isArray(candidate.identities)
    ? candidate.identities
    : [];
  return identities.some(
    (identity) => String(identity?.provider || "").trim().toLowerCase() === "google",
  );
}

async function authUserHasGoogleProvider(
  sb: ReturnType<typeof supabaseAdmin>,
  authUserId: string,
) {
  const cleanAuthUserId = String(authUserId || "").trim();
  if (!cleanAuthUserId) return false;

  try {
    const { data, error } = await sb.auth.admin.getUserById(cleanAuthUserId);
    if (error) {
      console.error("[verify-email] getUserById error:", error);
      return false;
    }
    return hasGoogleIdentity(data?.user || null);
  } catch (error) {
    console.error("[verify-email] authUserHasGoogleProvider error:", error);
    return false;
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
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
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
    const nextFromBody = String(body?.next || body?.returnTo || "").trim();
    const nextSafe = sanitizeNext(nextFromBody || "/");

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "E-mail invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (code.length !== 7) {
      return NextResponse.json(
        { ok: false, error: "Codigo invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const sb = supabaseAdmin();

    const pend = await sb.from("wz_pending_auth").select("*").eq("email", email).maybeSingle();
    if (pend.error || !pend.data) {
      return NextResponse.json(
        { ok: false, error: "Sessao invalida. Reinicie." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const flowRaw = String(pend.data.flow || "").trim().toLowerCase();
    let authUserId = pend.data.auth_user_id ? String(pend.data.auth_user_id).trim() : "";
    if (!authUserId) {
      const recovered = await findAuthUserIdByEmail(sb, email);
      if (recovered) authUserId = recovered;
    }

    const wzUser = await getWzUserSnapshotByEmail(sb, email);
    if (!authUserId && wzUser.authUserId) {
      authUserId = wzUser.authUserId;
    }

    const googleByProviderColumn = wzUser.authProvider === "google";
    const googleByAuthUser = authUserId
      ? await authUserHasGoogleProvider(sb, authUserId)
      : false;
    const isGoogleOnboarding =
      flowRaw === "google" ||
      ((flowRaw === "register" || !flowRaw) &&
        (googleByProviderColumn || googleByAuthUser));
    const flow = flowRaw || (isGoogleOnboarding ? "google" : "login");
    const requiresPassword = flow === "login" || !isGoogleOnboarding;

    if (requiresPassword && (!password || password.length < 6)) {
      return NextResponse.json(
        { ok: false, error: "Senha invalida." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

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
      return NextResponse.json(
        { ok: false, error: "Codigo expirado. Reenvie." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (new Date(ch.expires_at).getTime() < Date.now()) {
      await sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", ch.id);
      return NextResponse.json(
        { ok: false, error: "Codigo expirado. Reenvie." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (Number(ch.attempts_left) <= 0) {
      return NextResponse.json(
        { ok: false, error: "Muitas tentativas. Reenvie o codigo." },
        { status: 429, headers: NO_STORE_HEADERS },
      );
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

    if (flow === "login") {
      const anon = supabaseAnon();
      const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });

      if (signErr || !signIn?.user?.id) {
        return NextResponse.json(
          { ok: false, error: "Senha incorreta." },
          { status: 401, headers: NO_STORE_HEADERS },
        );
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
        return NextResponse.json(
          { ok: false, error: "Conta nao encontrada." },
          { status: 404, headers: NO_STORE_HEADERS },
        );
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

      if (isHostOnlyMode()) {
        const ticket = makeDashboardTicket({
          userId: resolvedUserId,
          email,
          fullName: resolvedFullName,
        });
        const nextUrl =
          `${dashboard}/api/wz_AuthLogin/exchange` +
          `?ticket=${encodeURIComponent(ticket)}` +
          `&next=${encodeURIComponent(nextSafe)}` +
          `&lm=email_code` +
          `&lf=login`;

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

      const nextUrl = `${dashboard}${nextSafe.startsWith("/") ? nextSafe : "/"}`;
      const res = NextResponse.json(
        { ok: true, nextUrl },
        { status: 200, headers: NO_STORE_HEADERS },
      );
      const sessionPayload = setSessionCookie(
        res,
        { userId: resolvedUserId, email, fullName: resolvedFullName },
        req.headers,
      );
      await registerIssuedSession({
        headers: req.headers,
        userId: resolvedUserId,
        authUserId: signIn?.user?.id ? String(signIn.user.id) : null,
        email,
        session: sessionPayload,
        loginMethod: "email_code",
        loginFlow: "login",
        isAccountCreationSession: false,
      });
      await issueTrustedLogin(sb, email, res);
      return res;
    }

    if (authUserId) {
      try {
        if (isGoogleOnboarding) {
          await sb.auth.admin.updateUserById(authUserId, {
            email_confirm: true,
          });
        } else {
          await sb.auth.admin.updateUserById(authUserId, {
            email_confirm: true,
            password,
          });
        }
      } catch (err) {
        console.error("[verify-email] auth confirm/update failed:", err);
      }

      try {
        await sb
          .from("wz_pending_auth")
          .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
          .eq("email", email);
      } catch {}
    }

    const pendingPhone = String(pend.data.phone_e164 || "").trim();
    const profilePhone = String(wzUser.phoneE164 || "").trim();
    const phoneE164 = pendingPhone || profilePhone;

    if (!phoneE164 || !isValidE164BRMobile(phoneE164)) {
      if (isGoogleOnboarding) {
        const patch: Record<string, unknown> = {
          stage: "phone",
          updated_at: new Date().toISOString(),
        };
        if (authUserId) patch.auth_user_id = authUserId;
        await sb.from("wz_pending_auth").update(patch).eq("email", email);

        return NextResponse.json(
          { ok: true, next: "collect-phone" },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }

      const missingPhoneMessage = !phoneE164
        ? "Telefone nao encontrado para SMS."
        : "Telefone invalido para SMS. Use um celular BR valido com DDD.";
      return NextResponse.json(
        { ok: false, error: missingPhoneMessage },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const pendingPatch: Record<string, unknown> = {
      stage: "sms",
      updated_at: new Date().toISOString(),
    };
    if (authUserId) pendingPatch.auth_user_id = authUserId;
    if (!pendingPhone || pendingPhone !== phoneE164) {
      pendingPatch.phone_e164 = phoneE164;
    }
    await sb.from("wz_pending_auth").update(pendingPatch).eq("email", email);

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
      return NextResponse.json(
        { ok: false, error: "Falha ao gerar SMS." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    await sendAuthSmsCode(phoneE164, smsCode);

    return NextResponse.json(
      { ok: true, next: "sms", phoneMask: maskPhoneE164(phoneE164) },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (e: unknown) {
    console.error("[verify-email] error:", e);
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
