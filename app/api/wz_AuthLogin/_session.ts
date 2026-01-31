import crypto from "crypto";
import type { NextRequest } from "next/server";

const LEGACY_COOKIE_NAME = "wz_session_v1";
const LEGACY_DEVICE_COOKIE_NAME = "wz_device_v1";

// ✅ modo seguro: host-only + __Host- (não compartilha em .wyzer.com.br)
const HOST_SESSION_COOKIE_NAME = "__Host-wz_session_v1";
const HOST_DEVICE_COOKIE_NAME = "__Host-wz_device_v1";

// bump de versão do payload
const SESSION_PAYLOAD_VER = 2;

export type SessionPayload = {
  userId: string;
  email: string;
  iat: number;
  exp: number;

  // v2
  ver?: number;
  sid?: string;

  // binds (hashes)
  did?: string; // hash do device cookie
  ua?: string;  // hash do user-agent
  ip?: string;  // hash do prefixo do IP
};

function must(name: string, v?: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * ✅ HeaderLike: resolve tipagens (ReadonlyHeaders, NextRequest.headers, etc)
 * Aqui só precisamos de .get().
 */
type HeaderLike = { get(name: string): string | null } | null;

function headerGet(h: HeaderLike, name: string) {
  return (h ? h.get(name) : null) ?? "";
}

function getEnvBool(name: string, def: boolean) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return def;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return def;
}

function getSecurityConfig() {
  /**
   * ✅ SESSION_COOKIE_HOST_ONLY=1
   * - em prod: usa __Host- e SEM domain (host-only)
   * - isso impede cookie ser compartilhado em subdomínios e reduz ataque por subdomain takeover.
   *
   * ⚠️ IMPORTANTE:
   * - host-only cookie precisa ser setado NO MESMO HOST que vai ler (ex: dashboard.wyzer.com.br)
   * - se você seta no login.wyzer.com.br, o dashboard NÃO vai receber.
   */
  const isProd = process.env.NODE_ENV === "production";

  return {
    isProd,
    hostOnly: getEnvBool("SESSION_COOKIE_HOST_ONLY", isProd), // default true em prod
    sameSite: (String(process.env.SESSION_SAMESITE || "lax").toLowerCase() as
      | "lax"
      | "strict"
      | "none"),
  };
}

function pickCookieNames() {
  const cfg = getSecurityConfig();
  if (cfg.isProd && cfg.hostOnly) {
    return {
      sessionName: HOST_SESSION_COOKIE_NAME,
      deviceName: HOST_DEVICE_COOKIE_NAME,
      // host-only: NÃO pode setar Domain
      domain: undefined as string | undefined,
    };
  }

  // legacy (compartilhado por domain)
  const envDomain = (process.env.SESSION_COOKIE_DOMAIN || "").trim();
  const domain =
    envDomain ||
    (process.env.NODE_ENV === "production" ? ".wyzer.com.br" : ".localhost");

  return {
    sessionName: LEGACY_COOKIE_NAME,
    deviceName: LEGACY_DEVICE_COOKIE_NAME,
    domain,
  };
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

// ------------------------------
// ✅ bind helpers
// ------------------------------

function sha256Short(input: string) {
  const h = crypto
    .createHash("sha256")
    .update(String(input || ""), "utf8")
    .digest();
  return b64url(h).slice(0, 22);
}

function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

function getBindConfig() {
  /**
   * ✅ Ajuste fino por ENV:
   * - SESSION_BIND_DEVICE (default: true)
   * - SESSION_BIND_UA     (default: false)
   * - SESSION_BIND_IP     (default: true)
   * - SESSION_ALLOW_LEGACY(default: true)
   */
  return {
    bindDevice: getEnvBool("SESSION_BIND_DEVICE", true),
    bindUA: getEnvBool("SESSION_BIND_UA", false),
    bindIP: getEnvBool("SESSION_BIND_IP", true),
    allowLegacy: getEnvBool("SESSION_ALLOW_LEGACY", true),
  };
}

function getUserAgentFromHeaders(h: HeaderLike) {
  return String(headerGet(h, "user-agent")).trim();
}

function firstIpFromXff(xff: string) {
  return String(xff || "").split(",")[0]?.trim() || "";
}

function normalizeIp(raw: string) {
  let ip = String(raw || "").trim();

  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(":")[0];

  if (ip.startsWith("[") && ip.includes("]")) {
    const inside = ip.slice(1, ip.indexOf("]"));
    ip = inside || ip;
  }

  return ip;
}

function ipPrefix(ip: string) {
  const v = normalizeIp(ip);

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    const parts = v.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    return v;
  }

  if (v.includes(":")) {
    const parts = v.split(":").filter(Boolean);
    const head = parts.slice(0, 4).join(":");
    return head || v;
  }

  return v;
}

function getClientIpFromHeaders(h: HeaderLike) {
  // ✅ prioridade pra provedores/CDNs comuns
  const cf = String(headerGet(h, "cf-connecting-ip")).trim();
  if (cf) return normalizeIp(cf);

  const real = String(headerGet(h, "x-real-ip")).trim();
  const xff = String(headerGet(h, "x-forwarded-for")).trim();
  const ip = normalizeIp(firstIpFromXff(xff) || real);
  return ip;
}

function validateBinds(payload: SessionPayload, cookieHeader: string, h: HeaderLike) {
  const cfg = getBindConfig();
  const names = pickCookieNames();

  // legacy
  const hasAnyBind = !!payload?.did || !!payload?.ua || !!payload?.ip;
  const isLegacy = !payload?.ver || payload.ver < 2 || !hasAnyBind;
  if (isLegacy) return cfg.allowLegacy;

  const parsed = parseCookieHeader(cookieHeader);

  // device
  if (cfg.bindDevice) {
    const deviceId = String(parsed[names.deviceName] || parsed[LEGACY_DEVICE_COOKIE_NAME] || "").trim();
    if (!deviceId) return false;
    const expectDid = sha256Short(deviceId);
    if (!payload.did || payload.did !== expectDid) return false;
  }

  // UA
  if (cfg.bindUA) {
    const ua = getUserAgentFromHeaders(h);
    if (!ua) return false;
    const expectUa = sha256Short(ua);
    if (!payload.ua || payload.ua !== expectUa) return false;
  }

  // IP
  if (cfg.bindIP) {
    const ip = getClientIpFromHeaders(h);
    if (!ip) return false;
    const expectIp = sha256Short(ipPrefix(ip));
    if (!payload.ip || payload.ip !== expectIp) return false;
  }

  return true;
}

// ------------------------------
// ✅ Exported API (mantida)
// ------------------------------

export function setSessionCookie(
  res: any,
  params: { userId: string; email: string; ttlDays?: number },
  reqOrHeaders?: NextRequest | HeaderLike,
) {
  const secret = must("SESSION_SECRET", process.env.SESSION_SECRET);

  const ttlDays = Number(params.ttlDays ?? 7);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlDays * 24 * 60 * 60;

  const sec = getSecurityConfig();
  const names = pickCookieNames();
  const bindCfg = getBindConfig();

  const h: HeaderLike =
    (reqOrHeaders && (reqOrHeaders as NextRequest).headers
      ? (reqOrHeaders as NextRequest).headers
      : (reqOrHeaders as HeaderLike)) || null;

  const cookieHeader = headerGet(h, "cookie");
  const parsed = parseCookieHeader(cookieHeader);

  // ✅ device cookie (estável)
  let deviceId = String(parsed[names.deviceName] || parsed[LEGACY_DEVICE_COOKIE_NAME] || "").trim();
  if (!deviceId) deviceId = randomHex(20);

  // Sempre seta o device cookie no response
  res.cookies.set(names.deviceName, deviceId, {
    httpOnly: true,
    secure: sec.isProd, // em prod sempre secure
    sameSite: sec.sameSite,
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
    ...(names.domain ? { domain: names.domain } : {}),
  });

  const ua = getUserAgentFromHeaders(h);
  const ip = getClientIpFromHeaders(h);

  const payload: SessionPayload = {
    userId: String(params.userId),
    email: String(params.email).trim().toLowerCase(),
    iat: now,
    exp,

    ver: SESSION_PAYLOAD_VER,
    sid: randomHex(16),

    ...(bindCfg.bindDevice ? { did: sha256Short(deviceId) } : {}),
    ...(bindCfg.bindUA && ua ? { ua: sha256Short(ua) } : {}),
    ...(bindCfg.bindIP && ip ? { ip: sha256Short(ipPrefix(ip)) } : {}),
  };

  const body = b64url(JSON.stringify(payload));
  const sig = sign(body, secret);
  const token = `${body}.${sig}`;

  res.cookies.set(names.sessionName, token, {
    httpOnly: true,
    secure: sec.isProd,
    sameSite: sec.sameSite,
    path: "/",
    maxAge: exp - now,
    ...(names.domain ? { domain: names.domain } : {}),
  });
}

export function clearSessionCookie(res: any) {
  const sec = getSecurityConfig();
  const names = pickCookieNames();

  // remove session (host e/ou legacy)
  res.cookies.set(names.sessionName, "", {
    httpOnly: true,
    secure: sec.isProd,
    sameSite: sec.sameSite,
    path: "/",
    maxAge: 0,
    ...(names.domain ? { domain: names.domain } : {}),
  });

  res.cookies.set(LEGACY_COOKIE_NAME, "", {
    httpOnly: true,
    secure: sec.isProd,
    sameSite: sec.sameSite,
    path: "/",
    maxAge: 0,
    ...(names.domain ? { domain: names.domain } : {}),
  });

  // ❗️device cookie eu não removo por padrão
}

export function readSessionFromCookieHeader(
  cookieHeader: string | null | undefined,
  headersForBind?: HeaderLike,
): SessionPayload | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const parsed = parseCookieHeader(cookieHeader);
  const names = pickCookieNames();

  // aceita host cookie ou legacy
  const token =
    parsed[names.sessionName] ||
    parsed[LEGACY_COOKIE_NAME] ||
    "";

  if (!token.includes(".")) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body, secret);
  if (expected !== sig) return null;

  try {
    const payload = JSON.parse(b64urlToBuf(body).toString("utf8")) as SessionPayload;

    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload?.userId || !payload?.email) return null;

    const okBinds = validateBinds(payload, String(cookieHeader || ""), headersForBind || null);
    if (!okBinds) return null;

    return payload;
  } catch {
    return null;
  }
}

export function readSessionFromRequest(req: NextRequest): SessionPayload | null {
  const cookieHeader = req.headers.get("cookie");
  return readSessionFromCookieHeader(cookieHeader, req.headers);
}
