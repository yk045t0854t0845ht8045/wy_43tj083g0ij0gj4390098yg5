import crypto from "crypto";

const LEGACY_TRUST_COOKIE_NAME = "wz_login_trust_v1";
const HOST_TRUST_COOKIE_NAME = "__Host-wz_login_trust_v1";
const TRUST_DAYS_DEFAULT = 15;

type CookiesSetOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
  domain?: string;
};

type ResponseWithCookies = {
  cookies: {
    set: (name: string, value: string, options: CookiesSetOptions) => void;
  };
};

function getEnvBool(name: string, def: boolean) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return def;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return def;
}

function getSecurityConfig() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    isProd,
    hostOnly: getEnvBool("SESSION_COOKIE_HOST_ONLY", isProd),
    sameSite: (String(process.env.SESSION_SAMESITE || "lax").toLowerCase() as
      | "lax"
      | "strict"
      | "none"),
  };
}

function getLegacyCookieDomain() {
  const envDomain = (process.env.SESSION_COOKIE_DOMAIN || "").trim();
  return (
    envDomain ||
    (process.env.NODE_ENV === "production" ? ".wyzer.com.br" : ".localhost")
  );
}

function pickTrustCookieConfig() {
  const sec = getSecurityConfig();
  if (sec.isProd && sec.hostOnly) {
    return {
      cookieName: HOST_TRUST_COOKIE_NAME,
      domain: undefined as string | undefined,
    };
  }

  return {
    cookieName: LEGACY_TRUST_COOKIE_NAME,
    domain: getLegacyCookieDomain(),
  };
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
    const key = p.slice(0, eq).trim();
    const val = p.slice(eq + 1).trim();
    if (!key) return;
    out[key] = val;
  });

  return out;
}

export function getTrustedLoginTtlSeconds() {
  const envDays = Number(process.env.LOGIN_TRUST_DAYS || TRUST_DAYS_DEFAULT);
  const days =
    Number.isFinite(envDays) && envDays > 0
      ? Math.min(Math.max(Math.floor(envDays), 1), 60)
      : TRUST_DAYS_DEFAULT;
  return days * 24 * 60 * 60;
}

export function createTrustedLoginToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashTrustedLoginToken(token: string) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

export function readTrustedLoginTokenFromCookieHeader(
  cookieHeader: string | null | undefined,
) {
  const parsed = parseCookieHeader(cookieHeader);
  const cfg = pickTrustCookieConfig();
  return String(
    parsed[cfg.cookieName] ||
      parsed[HOST_TRUST_COOKIE_NAME] ||
      parsed[LEGACY_TRUST_COOKIE_NAME] ||
      "",
  ).trim();
}

export function setTrustedLoginCookie(
  res: ResponseWithCookies,
  token: string,
  ttlSeconds = getTrustedLoginTtlSeconds(),
) {
  const sec = getSecurityConfig();
  const cfg = pickTrustCookieConfig();

  res.cookies.set(cfg.cookieName, String(token || "").trim(), {
    httpOnly: true,
    secure: sec.isProd,
    sameSite: sec.sameSite,
    path: "/",
    maxAge: Math.max(60, Number(ttlSeconds || 0)),
    ...(cfg.domain ? { domain: cfg.domain } : {}),
  });
}

