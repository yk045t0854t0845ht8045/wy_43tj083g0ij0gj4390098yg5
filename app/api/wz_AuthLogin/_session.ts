import crypto from "crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "wz_session_v1";

/**
 * ✅ Cookie de device para “amarrar” sessão ao navegador/dispositivo
 * - httpOnly (não dá pra JS ler)
 * - estável por bastante tempo
 */
const DEVICE_COOKIE_NAME = "wz_device_v1";

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
  ua?: string; // hash do user-agent
  ip?: string; // hash do prefixo do IP
};

function must(name: string, v?: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * ✅ HeaderLike: funciona com:
 * - headers() do Next (ReadonlyHeaders)
 * - req.headers (NextRequest / Request)
 * - qualquer objeto com .get()
 */
type HeaderLike = { get(name: string): string | null } | null;

function headerGet(h: HeaderLike, name: string) {
  return (h ? h.get(name) : null) ?? "";
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

  /**
   * ✅ Dica: em localhost, domain costuma dar dor de cabeça.
   * Se você estiver usando subdomínios locais (dashboard.localhost etc),
   * mantenha como ".localhost". Caso contrário, prefira setar SESSION_COOKIE_DOMAIN="" e ajustar.
   */
  return ".localhost";
}

// ------------------------------
// ✅ helpers de bind
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

function getUserAgentFromHeaders(h: HeaderLike) {
  return String(headerGet(h, "user-agent")).trim();
}

function firstIpFromXff(xff: string) {
  const first = String(xff || "").split(",")[0]?.trim() || "";
  return first;
}

function normalizeIp(raw: string) {
  let ip = String(raw || "").trim();

  // ipv4:port
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(":")[0];

  // [ipv6]:port
  if (ip.startsWith("[") && ip.includes("]")) {
    const inside = ip.slice(1, ip.indexOf("]"));
    ip = inside || ip;
  }

  return ip;
}

function ipPrefix(ip: string) {
  const v = normalizeIp(ip);

  // ipv4 /24
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    const parts = v.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    return v;
  }

  // ipv6 /64 aproximado
  if (v.includes(":")) {
    const parts = v.split(":").filter(Boolean);
    const head = parts.slice(0, 4).join(":");
    return head || v;
  }

  return v;
}

function getClientIpFromHeaders(h: HeaderLike) {
  const xff = String(headerGet(h, "x-forwarded-for")).trim();
  const xrip = String(headerGet(h, "x-real-ip")).trim();
  const ip = normalizeIp(firstIpFromXff(xff) || xrip);
  return ip;
}

function getEnvBool(name: string, def: boolean) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return def;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return def;
}

function getBindConfig() {
  /**
   * ✅ Defaults seguros e que NÃO quebram login:
   * - bindDevice: true  -> evita “trocar só o wz_session_v1” no mesmo navegador
   * - bindUA: false     -> opcional
   * - bindIP: false     -> opcional (rede móvel/proxy muda muito e quebra fácil)
   *
   * Se você quiser ligar IP/UA depois:
   * - ative ENV e PASSE req/headers no setSessionCookie (terceiro parâmetro).
   */
  return {
    bindDevice: getEnvBool("SESSION_BIND_DEVICE", true),
    bindUA: getEnvBool("SESSION_BIND_UA", false),
    bindIP: getEnvBool("SESSION_BIND_IP", false),
    allowLegacy: getEnvBool("SESSION_ALLOW_LEGACY", true),
  };
}

// ------------------------------
// ✅ Exported API (mantida)
// ------------------------------

/**
 * ✅ Mantém assinatura original e adiciona 3º parâmetro opcional
 * (não quebra seus calls atuais).
 */
export function setSessionCookie(
  res: any,
  params: { userId: string; email: string; ttlDays?: number },
  reqOrHeaders?: any,
) {
  const secret = must("SESSION_SECRET", process.env.SESSION_SECRET);

  const ttlDays = Number(params.ttlDays ?? 7);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlDays * 24 * 60 * 60;

  const isProd = process.env.NODE_ENV === "production";
  const domain = getCookieDomain();

  const cfg = getBindConfig();

  // ✅ pega headers com segurança (NextRequest / Request / ReadonlyHeaders / etc)
  const h: HeaderLike =
    (reqOrHeaders && reqOrHeaders.headers && typeof reqOrHeaders.headers.get === "function"
      ? (reqOrHeaders.headers as HeaderLike)
      : (reqOrHeaders && typeof reqOrHeaders.get === "function"
        ? (reqOrHeaders as HeaderLike)
        : null)) || null;

  const cookieHeader = headerGet(h, "cookie");
  const parsed = parseCookieHeader(cookieHeader);

  // ✅ device cookie (estável)
  let deviceId = String(parsed[DEVICE_COOKIE_NAME] || "").trim();
  if (!deviceId) deviceId = randomHex(20);

  // sempre setamos o device cookie (para existir também no dashboard)
  res.cookies.set(DEVICE_COOKIE_NAME, deviceId, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
    ...(domain ? { domain } : {}),
  });

  // ✅ binds (opcionais)
  const ua = getUserAgentFromHeaders(h);
  const ip = getClientIpFromHeaders(h);

  const payload: SessionPayload = {
    userId: String(params.userId),
    email: String(params.email).trim().toLowerCase(),
    iat: now,
    exp,

    ver: SESSION_PAYLOAD_VER,
    sid: randomHex(16),

    ...(cfg.bindDevice ? { did: sha256Short(deviceId) } : {}),
    ...(cfg.bindUA && ua ? { ua: sha256Short(ua) } : {}),
    ...(cfg.bindIP && ip ? { ip: sha256Short(ipPrefix(ip)) } : {}),
  };

  const body = b64url(JSON.stringify(payload));
  const sig = sign(body, secret);
  const token = `${body}.${sig}`;

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

  // ❗️não removo o device cookie por padrão
}

function validateBinds(payload: SessionPayload, cookieHeader: string, h: HeaderLike) {
  const cfg = getBindConfig();

  // legacy: tokens antigos sem binds/ver
  const hasAnyBind = !!payload?.did || !!payload?.ua || !!payload?.ip;
  const isLegacy = !payload?.ver || payload.ver < 2 || !hasAnyBind;

  if (isLegacy) return cfg.allowLegacy;

  const parsed = parseCookieHeader(cookieHeader);

  // ✅ device bind (principal)
  if (cfg.bindDevice) {
    const deviceId = String(parsed[DEVICE_COOKIE_NAME] || "").trim();
    if (!deviceId) return false;
    const expectDid = sha256Short(deviceId);
    if (!payload.did || payload.did !== expectDid) return false;
  }

  // ✅ UA bind (opcional)
  if (cfg.bindUA) {
    const ua = getUserAgentFromHeaders(h);
    if (!ua) return false;
    const expectUa = sha256Short(ua);
    if (!payload.ua || payload.ua !== expectUa) return false;
  }

  // ✅ IP bind (opcional)
  if (cfg.bindIP) {
    const ip = getClientIpFromHeaders(h);
    if (!ip) return false;
    const expectIp = sha256Short(ipPrefix(ip));
    if (!payload.ip || payload.ip !== expectIp) return false;
  }

  return true;
}

export function readSessionFromCookieHeader(
  cookieHeader: string | null | undefined,
  headersForBind?: any,
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

  // headers para UA/IP bind (opcional)
  const h: HeaderLike =
    (headersForBind && headersForBind.headers && typeof headersForBind.headers.get === "function"
      ? (headersForBind.headers as HeaderLike)
      : (headersForBind && typeof headersForBind.get === "function"
        ? (headersForBind as HeaderLike)
        : null)) || null;

  try {
    const payload = JSON.parse(b64urlToBuf(body).toString("utf8")) as SessionPayload;

    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload?.userId || !payload?.email) return null;

    const okBinds = validateBinds(payload, String(cookieHeader || ""), h);
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
