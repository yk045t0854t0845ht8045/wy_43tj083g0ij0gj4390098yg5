// app/api/wz_AuthLogin/_session.ts
import crypto from "crypto";
import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "wz_session_v1";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

type HeadersLike = { get(name: string): string | null | undefined };

export type Session = {
  userId: string;
  email: string;
  iat: number; // seconds
  exp: number; // seconds
};

type SessionPayloadV2 = {
  v: 2;
  userId: string;
  email: string;
  iat: number;
  exp: number;

  // binds (hashes)
  ua?: string;  // hash(User-Agent)
  ip?: string;  // hash(IP prefix)
  geo?: string; // hash(country|region|city)
};

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToString(input: string) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(b64, "base64").toString("utf8");
}

function timingSafeEq(a: string, b: string) {
  try {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function sign(payloadB64: string, secret: string) {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

function sha256B64(v: string) {
  return base64UrlEncode(crypto.createHash("sha256").update(v, "utf8").digest());
}

function firstNonEmpty(...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return "";
}

function getHostFromReq(req?: Request) {
  if (!req) return "";
  const xfHost = firstNonEmpty(req.headers.get("x-forwarded-host"));
  const host = firstNonEmpty(xfHost, req.headers.get("host"));
  return host.split(",")[0].trim().toLowerCase();
}

function getProtoFromReq(req?: Request) {
  if (!req) return "";
  const xfProto = firstNonEmpty(req.headers.get("x-forwarded-proto")).toLowerCase();
  return xfProto;
}

function isHttpsFromReq(req?: Request) {
  const p = getProtoFromReq(req);
  if (p === "https") return true;
  if (p === "http") return false;
  // fallback
  try {
    const u = new URL(req?.url || "http://localhost");
    return u.protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function cookieDomainFromReq(req?: Request) {
  // ✅ Em produção sempre compartilhado entre login.* e dashboard.*
  if (process.env.NODE_ENV === "production") return "wyzer.com.br";

  // ✅ Em dev (localhost), não forçar domain (browsers não gostam de .localhost)
  // deixe host-only
  const host = getHostFromReq(req);
  if (!host) return undefined;

  // se for algo tipo *.wyzer.com.br mesmo em dev/stage:
  if (host === "wyzer.com.br" || host.endsWith(".wyzer.com.br")) return "wyzer.com.br";

  return undefined;
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function buildToken(payload: SessionPayloadV2) {
  const secret = getSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET não configurado.");

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function parseAndVerifyToken(token: string): SessionPayloadV2 | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const [payloadB64, sig] = String(token || "").split(".");
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64, secret);
  if (!timingSafeEq(expected, sig)) return null;

  try {
    const raw = base64UrlDecodeToString(payloadB64);
    const parsed = JSON.parse(raw) as SessionPayloadV2;
    if (!parsed?.userId || !parsed?.email || !parsed?.iat || !parsed?.exp) return null;
    if (parsed.v !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getClientIp(headers: HeadersLike) {
  const xff = firstNonEmpty(headers.get("x-forwarded-for"));
  if (xff) return xff.split(",")[0].trim();

  const realIp = firstNonEmpty(headers.get("x-real-ip"), headers.get("cf-connecting-ip"));
  return realIp.trim();
}

function normalizeIp(ipRaw: string) {
  const ip = String(ipRaw || "").trim();

  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) return ip.split(":")[0];
  if (ip.startsWith("[") && ip.includes("]:")) return ip.slice(1).split("]:")[0];

  return ip;
}

function ipPrefix(ipRaw: string) {
  const ip = normalizeIp(ipRaw);

  // IPv4 => /24
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split(".");
    return parts.slice(0, 3).join(".");
  }

  // IPv6 => /64
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.slice(0, 4).join(":");
  }

  return "";
}

function getGeo(headers: HeadersLike) {
  const country = firstNonEmpty(headers.get("x-vercel-ip-country"), headers.get("cf-ipcountry")).toUpperCase();
  const region = firstNonEmpty(headers.get("x-vercel-ip-country-region")).toUpperCase();
  const city = firstNonEmpty(headers.get("x-vercel-ip-city")).toUpperCase();

  // fallback genérico (caso tenha outro proxy)
  const altCountry = firstNonEmpty(headers.get("x-geo-country"), headers.get("x-country")).toUpperCase();
  const altRegion = firstNonEmpty(headers.get("x-geo-region"), headers.get("x-region")).toUpperCase();
  const altCity = firstNonEmpty(headers.get("x-geo-city"), headers.get("x-city")).toUpperCase();

  return {
    country: country || altCountry,
    region: region || altRegion,
    city: city || altCity,
  };
}

function fingerprintFromHeaders(headers: HeadersLike) {
  const ua = firstNonEmpty(headers.get("user-agent"));
  const ip = getClientIp(headers);
  const ipPfx = ipPrefix(ip);

  const geo = getGeo(headers);
  const geoStr = `${geo.country || ""}|${geo.region || ""}|${geo.city || ""}`;

  const uaHash = ua ? sha256B64(ua) : "";
  const ipHash = ipPfx ? sha256B64(ipPfx) : "";
  const geoHash = geoStr !== "||" ? sha256B64(geoStr) : "";

  return { uaHash, ipHash, geoHash };
}

function validateBinding(payload: SessionPayloadV2, headers?: HeadersLike) {
  // ✅ Compat: se o dev não passou headers, NÃO derruba tudo.
  // (Pra segurança máxima: sempre passe headers nas páginas/rotas que importam.)
  if (!headers) return true;

  const fp = fingerprintFromHeaders(headers);

  // se token tem bind, precisa bater
  if (payload.ua && fp.uaHash && payload.ua !== fp.uaHash) return false;
  if (payload.ip && fp.ipHash && payload.ip !== fp.ipHash) return false;
  if (payload.geo && fp.geoHash && payload.geo !== fp.geoHash) return false;

  // se token exige UA e request não tem UA -> invalida
  if (payload.ua && !fp.uaHash) return false;

  return true;
}

export function readSessionFromCookieHeader(
  cookieHeader: string | null,
  ctx?: { headers?: HeadersLike },
): Session | null {
  const token = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  if (!token) return null;

  const payload = parseAndVerifyToken(token);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) <= now) return null;

  if (!validateBinding(payload, ctx?.headers)) return null;

  return {
    userId: String(payload.userId),
    email: String(payload.email),
    iat: Number(payload.iat),
    exp: Number(payload.exp),
  };
}

export function readSessionFromRequest(req: Request): Session | null {
  return readSessionFromCookieHeader(req.headers.get("cookie"), { headers: req.headers });
}

export function setSessionCookie(
  res: NextResponse,
  session: { userId: string; email: string },
  req?: Request,
) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_TTL_SECONDS;

  const headers = req?.headers;
  const fp = headers ? fingerprintFromHeaders(headers) : { uaHash: "", ipHash: "", geoHash: "" };

  const payload: SessionPayloadV2 = {
    v: 2,
    userId: String(session.userId),
    email: String(session.email),
    iat: now,
    exp,
    // ✅ UA sempre que possível
    ua: fp.uaHash || undefined,
    // ✅ IP/GEO só se existirem (Vercel normalmente fornece)
    ip: fp.ipHash || undefined,
    geo: fp.geoHash || undefined,
  };

  const token = buildToken(payload);

  const domain = cookieDomainFromReq(req);
  const secure = isHttpsFromReq(req) || process.env.NODE_ENV === "production";

  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    ...(domain ? { domain } : {}),
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse, req?: Request) {
  const domain = cookieDomainFromReq(req);
  const secure = isHttpsFromReq(req) || process.env.NODE_ENV === "production";

  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    ...(domain ? { domain } : {}),
    maxAge: 0,
  });
}
