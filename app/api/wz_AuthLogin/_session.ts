import crypto from "crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "wz_session_v1";

export type SessionPayload = {
  userId: string;
  email: string;
  iat: number;
  exp: number;
};

function must(name: string, v?: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlToBuf(input: string) {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function sign(data: string, secret: string) {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

function parseCookieHeader(cookieHeader: string | null | undefined) {
  const out: Record<string, string> = {};
  const raw = String(cookieHeader || "");
  if (!raw) return out;

  raw.split(";").forEach((part) => {
    const p = part.trim();
    if (!p) return;
    const eq = p.indexOf("=");
    if (eq === -1) return;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    if (!k) return;
    out[k] = v;
  });

  return out;
}

function getCookieDomain() {
  const env = (process.env.SESSION_COOKIE_DOMAIN || "").trim();
  if (env) return env;

  if (process.env.NODE_ENV === "production") return ".wyzer.com.br";
  return ".localhost";
}

export function setSessionCookie(
  res: any,
  params: { userId: string; email: string; ttlDays?: number },
) {
  const secret = must("SESSION_SECRET", process.env.SESSION_SECRET);

  const ttlDays = Number(params.ttlDays ?? 7);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlDays * 24 * 60 * 60;

  const payload: SessionPayload = {
    userId: String(params.userId),
    email: String(params.email).trim().toLowerCase(),
    iat: now,
    exp,
  };

  const body = b64url(JSON.stringify(payload));
  const sig = sign(body, secret);
  const token = `${body}.${sig}`;

  const isProd = process.env.NODE_ENV === "production";
  const domain = getCookieDomain();

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: exp - now,
    ...(domain ? { domain } : {}),
  });
}

export function clearSessionCookie(res: any) {
  const isProd = process.env.NODE_ENV === "production";
  const domain = getCookieDomain();

  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
}

export function readSessionFromCookieHeader(
  cookieHeader: string | null | undefined,
): SessionPayload | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const parsed = parseCookieHeader(cookieHeader);
  const token = parsed[COOKIE_NAME] || "";
  if (!token.includes(".")) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body, secret);
  if (expected !== sig) return null;

  try {
    const payload = JSON.parse(b64urlToBuf(body).toString("utf8")) as SessionPayload;
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload?.userId || !payload?.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * ✅ NOVO: compatível com teu /me
 * Lê cookie do request (NextRequest) e valida.
 */
export function readSessionFromRequest(req: NextRequest): SessionPayload | null {
  // preferir header "cookie" (mais universal)
  const cookieHeader = req.headers.get("cookie");
  return readSessionFromCookieHeader(cookieHeader);
}
