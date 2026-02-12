import crypto from "crypto";
import { NextResponse } from "next/server";
import { onlyDigits } from "../_codes";
import { setSessionCookie } from "../_session";
import { supabaseAdmin } from "../_supabase";
import {
  createTrustedLoginToken,
  getTrustedLoginTtlSeconds,
  hashTrustedLoginToken,
  setTrustedLoginCookie,
} from "../_trusted_login";
import { readLoginTwoFactorTicket } from "../_login_two_factor_ticket";
import { resolveTwoFactorState, verifyTotpCode } from "@/app/api/_twoFactor";

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
      console.error("[verify-two-factor] trusted login insert error:", error);
      return;
    }

    setTrustedLoginCookie(res, token);
  } catch (error) {
    console.error("[verify-two-factor] issueTrustedLogin error:", error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const ticket = String(body?.twoFactorTicket || body?.ticket || "").trim();
    const code = onlyDigits(String(body?.twoFactorCode || body?.code || "")).slice(0, 6);
    const nextSafe = sanitizeNext(String(body?.next || body?.returnTo || "").trim() || "/");

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "E-mail invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (!ticket) {
      return NextResponse.json(
        { ok: false, error: "Sessao de autenticacao em 2 etapas invalida. Reinicie o login." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (code.length !== 6) {
      return NextResponse.json(
        {
          ok: false,
          requiresTwoFactor: true,
          error: "Digite o codigo de 6 digitos do aplicativo autenticador.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const ticketRes = readLoginTwoFactorTicket({ ticket, email });
    if (!ticketRes.ok) {
      return NextResponse.json(
        { ok: false, error: ticketRes.error },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const payload = ticketRes.payload;
    const sb = supabaseAdmin();
    const twoFactorState = await resolveTwoFactorState({
      sb,
      sessionUserId: payload.uid,
      wzUserId: payload.uid,
    });
    if (!twoFactorState.enabled || !twoFactorState.secret) {
      return NextResponse.json(
        { ok: false, error: "A autenticacao em 2 etapas nao esta ativa para esta conta." },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const valid = verifyTotpCode({
      secret: twoFactorState.secret,
      code,
    });
    if (!valid) {
      return NextResponse.json(
        {
          ok: false,
          requiresTwoFactor: true,
          twoFactorTicket: ticket,
          error: "Codigo de 2 etapas invalido. Tente novamente.",
        },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    try {
      await sb.from("wz_pending_auth").delete().eq("email", payload.email);
    } catch {}

    const dashboard = getDashboardOrigin();
    const resolvedFullName = sanitizeFullName(payload.fullName);

    if (isHostOnlyMode()) {
      const dashboardTicket = makeDashboardTicket({
        userId: String(payload.uid),
        email: payload.email,
        fullName: resolvedFullName,
      });
      const nextUrl =
        `${dashboard}/api/wz_AuthLogin/exchange` +
        `?ticket=${encodeURIComponent(dashboardTicket)}` +
        `&next=${encodeURIComponent(nextSafe)}`;

      const res = NextResponse.json(
        { ok: true, nextUrl },
        { status: 200, headers: NO_STORE_HEADERS },
      );
      setSessionCookie(
        res,
        { userId: String(payload.uid), email: payload.email, fullName: resolvedFullName },
        req.headers,
      );
      await issueTrustedLogin(sb, payload.email, res);
      return res;
    }

    const nextUrl = `${dashboard}${nextSafe.startsWith("/") ? nextSafe : "/"}`;
    const res = NextResponse.json({ ok: true, nextUrl }, { status: 200, headers: NO_STORE_HEADERS });
    setSessionCookie(
      res,
      { userId: String(payload.uid), email: payload.email, fullName: resolvedFullName },
      req.headers,
    );
    await issueTrustedLogin(sb, payload.email, res);
    return res;
  } catch (error) {
    console.error("[verify-two-factor] error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao validar autenticacao em 2 etapas." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
