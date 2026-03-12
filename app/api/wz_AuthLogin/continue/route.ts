import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "../_active_session";
import { clearSessionCookie } from "../_session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type ExchangeTicketPayload = {
  userId: string;
  email: string;
  fullName?: string;
  iat: number;
  exp: number;
  nonce: string;
};

function applyNoStore(res: NextResponse) {
  res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  res.headers.set("Pragma", NO_STORE_HEADERS.Pragma);
  res.headers.set("Expires", NO_STORE_HEADERS.Expires);
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

function getEnvBool(name: string, def: boolean) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return def;
  if (value === "1" || value === "true" || value === "yes" || value === "on") {
    return true;
  }
  if (value === "0" || value === "false" || value === "no" || value === "off") {
    return false;
  }
  return def;
}

function isHostOnlyMode() {
  const isProd = process.env.NODE_ENV === "production";
  return isProd && getEnvBool("SESSION_COOKIE_HOST_ONLY", true);
}

function sanitizeFullName(value?: string | null) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.slice(0, 120);
}

function isSafeRelativePath(path: string) {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\n") || path.includes("\r")) return false;
  return true;
}

function isAllowedAbsolute(url: URL) {
  const host = url.hostname.toLowerCase();
  const protoOk = url.protocol === "https:" || url.protocol === "http:";
  const hostOk =
    host === "wyzer.com.br" ||
    host === "www.wyzer.com.br" ||
    host.endsWith(".wyzer.com.br") ||
    host === "localhost" ||
    host.endsWith(".localhost");

  return protoOk && hostOk;
}

function sanitizeNext(raw: string) {
  const value = String(raw || "").trim();
  if (!value) return "/";

  if (isSafeRelativePath(value)) return value;

  try {
    const url = new URL(value);
    if (!isAllowedAbsolute(url)) return "/";
    return url.toString();
  } catch {
    return "/";
  }
}

function pickRequestHost(req: NextRequest) {
  return String(
    req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      req.nextUrl.host ||
      "",
  )
    .split(",")[0]
    .trim();
}

function getRequestHostName(req: NextRequest) {
  return pickRequestHost(req).split(":")[0].trim().toLowerCase();
}

function isLocalHost(host: string) {
  return host.endsWith(".localhost") || host === "localhost";
}

function isDashboardHost(host: string) {
  return (
    host === "dashboard.wyzer.com.br" ||
    host === "dashboard.localhost" ||
    host === "dashboard.vercel.app" ||
    host.startsWith("dashboard.") ||
    (host.startsWith("dashboard-") && host.endsWith(".vercel.app"))
  );
}

function getDashboardOriginForHost(host: string) {
  if (isLocalHost(host)) {
    return "http://dashboard.localhost:3000";
  }
  return "https://dashboard.wyzer.com.br";
}

function getLoginOriginForHost(host: string) {
  if (isLocalHost(host)) {
    return "http://login.localhost:3000";
  }
  return "https://login.wyzer.com.br";
}

function toRedirectTarget(nextSafe: string, fallbackOrigin: string) {
  if (/^https?:\/\//i.test(nextSafe)) return nextSafe;
  return new URL(nextSafe, `${fallbackOrigin}/`).toString();
}

function resolveExchangeOrigin(currentHost: string, nextSafe: string) {
  if (/^https?:\/\//i.test(nextSafe)) {
    try {
      const target = new URL(nextSafe);
      if (isDashboardHost(target.hostname.toLowerCase())) {
        return `${target.protocol}//${target.host}`;
      }
    } catch {}
  }

  return getDashboardOriginForHost(currentHost);
}

function createExchangeTicket(params: {
  userId: string;
  email: string;
  fullName?: string | null;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");
  }

  const normalizedFullName = sanitizeFullName(params.fullName);
  const ttlMs = Math.max(30_000, Number(params.ttlMs || 1000 * 60 * 5));
  const payload: ExchangeTicketPayload = {
    userId: String(params.userId),
    email: String(params.email).trim().toLowerCase(),
    ...(normalizedFullName ? { fullName: normalizedFullName } : {}),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export async function GET(req: NextRequest) {
  const currentHost = getRequestHostName(req);
  const dashboardOrigin = getDashboardOriginForHost(currentHost);
  const nextSafe = sanitizeNext(
    String(
      req.nextUrl.searchParams.get("next") ||
        req.nextUrl.searchParams.get("returnTo") ||
        "/",
    ),
  );
  const fallbackTarget = toRedirectTarget(nextSafe, dashboardOrigin);

  try {
    const session = await readActiveSessionFromRequest(req, {
      seedIfMissing: false,
    });

    if (!session) {
      const loginUrl = new URL("/", `${getLoginOriginForHost(currentHost)}/`);
      if (fallbackTarget !== `${dashboardOrigin}/`) {
        loginUrl.searchParams.set("returnTo", fallbackTarget);
      }
      loginUrl.searchParams.set("forceLogin", "1");

      const res = NextResponse.redirect(loginUrl, 303);
      clearSessionCookie(res);
      applyNoStore(res);
      return res;
    }

    const exchangeOrigin = resolveExchangeOrigin(currentHost, nextSafe);
    const exchangeHost = new URL(exchangeOrigin).hostname.toLowerCase();
    const needsCrossHostExchange = isHostOnlyMode() && exchangeHost !== currentHost;

    if (!needsCrossHostExchange) {
      const directTarget = /^https?:\/\//i.test(nextSafe) ? nextSafe : fallbackTarget;
      const res = NextResponse.redirect(directTarget, 303);
      applyNoStore(res);
      return res;
    }

    const ticket = createExchangeTicket({
      userId: String(session.userId),
      email: String(session.email),
      fullName: session.fullName,
    });

    const exchangeUrl = new URL("/api/wz_AuthLogin/exchange", `${exchangeOrigin}/`);
    exchangeUrl.searchParams.set("ticket", ticket);
    exchangeUrl.searchParams.set("next", nextSafe);
    exchangeUrl.searchParams.set("lm", "exchange");
    exchangeUrl.searchParams.set("lf", "login");

    const res = NextResponse.redirect(exchangeUrl, 303);
    applyNoStore(res);
    return res;
  } catch (error) {
    console.error("[continue] error:", error);
    const loginUrl = new URL("/", `${getLoginOriginForHost(currentHost)}/`);
    if (fallbackTarget !== `${dashboardOrigin}/`) {
      loginUrl.searchParams.set("returnTo", fallbackTarget);
    }
    loginUrl.searchParams.set("forceLogin", "1");

    const res = NextResponse.redirect(loginUrl, 303);
    clearSessionCookie(res);
    applyNoStore(res);
    return res;
  }
}
