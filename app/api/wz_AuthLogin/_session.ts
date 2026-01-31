// app/api/wz_AuthLogin/_session.ts
import crypto from "crypto";
import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "wz_session_v1";

// 7 dias (igual seu exemplo)
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

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

  // binds (hashes) — não expõem IP/UA/cidade em texto
  ua?: string;   // hash(User-Agent)
  ip?: string;   // hash(IP prefix)
  geo?: string;  // hash(country|region|city)
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

function getClientIp(headers: HeadersLike) {
  // Vercel/Proxies comuns
  const xff = firstNonEmpty(headers.get("x-forwarded-for"));
  if (xff) return xff.split(",")[0].trim();

  const realIp = firstNonEmpty(headers.get("x-real-ip"), headers.get("cf-connecting-ip"));
  return realIp.trim();
}

function normalizeIp(ipRaw: string) {
  const ip = String(ipRaw || "").trim();

  // remove porta se vier "1.2.3.4:1234"
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) return ip.split(":")[0];

  // ipv6 pode vir com porta tipo "[::1]:1234"
  if (ip.startsWith("[") && ip.includes("]:")) return ip.slice(1).split("]:")[0];

  return ip;
}

function ipPrefix(ipRaw: string) {
  const ip = normalizeIp(ipRaw);

  // IPv4 => /24
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split(".");
    return parts.slice(0, 3).join("."); // a.b.c
  }

  // IPv6 => /64 (primeiros 4 hextetos)
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.slice(0, 4).join(":");
  }

  return "";
}

function getGeo(headers: HeadersLike) {
  // Vercel Edge headers (quando em produção na Vercel)
  const country = firstNonEmpty(headers.get("x-vercel-ip-country"), headers.get("cf-ipcountry")).toUpperCase();
  const region = firstNonEmpty(headers.get("x-vercel-ip-country-region")).toUpperCase();
  const city = firstNonEmpty(headers.get("x-vercel-ip-city")).toUpperCase();

  // alguns provedores setam variações
  const altCity = firstNonEmpty(headers.get("x-geo-city"), headers.get("x-city")).toUpperCase();
  const altRegion = firstNonEmpty(headers.get("x-geo-region"), headers.get("x-region")).toUpperCase();
  const altCountry = firstNonEmpty(headers.get("x-geo-country"), headers.get("x-country")).toUpperCase();

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

  // hashes (não expõe valores reais no cookie)
  const uaHash = ua ? sha256B64(ua) : "";
  const ipHash = ipPfx ? sha256B64(ipPfx) : "";
  const geoHash = geoStr !== "||" ? sha256B64(geoStr) : "";

  return { uaHash, ipHash, geoHash };
}

function cookieDomainFromHost(hostname: string) {
  const h = (hostname || "").toLowerCase();

  // Produção: compartilha entre login.* e dashboard.*
  if (h === "wyzer.com.br" || h.endsWith(".wyzer.com.br")) return ".wyzer.com.br";

  // Em localhost: NÃO depende de Domain (muitos browsers não respeitam .localhost)
  // então deixa host-only e use seu flow de exchange quando precisar.
  return undefined;
}

function isProdUrl(urlStr: string) {
  try {
    const u = new URL(urlStr);
    return u.protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
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

function validateBinding(payload: SessionPayloadV2, headers?: HeadersLike) {
  // Se o token tem bind e não tenho headers para validar => invalida
  if ((payload.ua || payload.ip || payload.geo) && !headers) return false;

  if (!headers) return true;

  const fp = fingerprintFromHeaders(headers);

  // Se o bind existe no token, ele precisa bater.
  if (payload.ua && fp.uaHash && payload.ua !== fp.uaHash) return false;
  if (payload.ip && fp.ipHash && payload.ip !== fp.ipHash) return false;
  if (payload.geo && fp.geoHash && payload.geo !== fp.geoHash) return false;

  // Se token exige bind mas a request não tem info nenhuma (raro), invalida
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
    // binds: se existirem, entram no token
    ua: fp.uaHash || undefined,
    ip: fp.ipHash || undefined,
    geo: fp.geoHash || undefined,
  };

  const token = buildToken(payload);

  const host = (() => {
    try {
      return new URL(req?.url || "http://localhost").hostname;
    } catch {
      return "localhost";
    }
  })();

  const domain = cookieDomainFromHost(host);
  const secure = req ? isProdUrl(req.url) : process.env.NODE_ENV === "production";

  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    ...(domain ? { domain } : {}),
    // expira junto do payload
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse, req?: Request) {
  const host = (() => {
    try {
      return new URL(req?.url || "http://localhost").hostname;
    } catch {
      return "localhost";
    }
  })();

  const domain = cookieDomainFromHost(host);
  const secure = req ? isProdUrl(req.url) : process.env.NODE_ENV === "production";

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
