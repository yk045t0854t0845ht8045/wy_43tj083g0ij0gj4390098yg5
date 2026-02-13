import { NextResponse, type NextRequest } from "next/server";
import { setSessionCookie } from "../_session";
import { readActiveSessionFromRequest } from "../_active_session";
import { registerIssuedSession } from "../_session_devices";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function isSafeRelativePath(path: string) {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\n") || path.includes("\r")) return false;
  return true;
}

function isAllowedAbsolute(url: URL) {
  const host = url.hostname.toLowerCase();
  const protocolOk = url.protocol === "https:" || url.protocol === "http:";

  const hostOk =
    host === "wyzer.com.br" ||
    host === "www.wyzer.com.br" ||
    host.endsWith(".wyzer.com.br") ||
    host === "localhost" ||
    host.endsWith(".localhost");

  return protocolOk && hostOk;
}

function sanitizeNext(raw: string) {
  const value = String(raw || "").trim();
  if (!value) return "/";

  if (isSafeRelativePath(value)) return value;

  try {
    const u = new URL(value);
    if (!isAllowedAbsolute(u)) return "/";
    return u.toString();
  } catch {
    return "/";
  }
}

function redirectTargetFrom(req: NextRequest, nextSafe: string) {
  if (/^https?:\/\//i.test(nextSafe)) return nextSafe;
  return new URL(nextSafe, req.nextUrl.origin).toString();
}

export async function GET(req: NextRequest) {
  const nextRaw = String(req.nextUrl.searchParams.get("next") || "/");
  const nextSafe = sanitizeNext(nextRaw);
  const target = redirectTargetFrom(req, nextSafe);

  const res = NextResponse.redirect(target, 303);
  res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  res.headers.set("Pragma", NO_STORE_HEADERS.Pragma);
  res.headers.set("Expires", NO_STORE_HEADERS.Expires);

  const session = await readActiveSessionFromRequest(req, {
    seedIfMissing: false,
  });
  if (!session) return res;

  const now = Math.floor(Date.now() / 1000);
  const remainingSec = Math.max(60, Number(session.exp) - now);
  const ttlDays = remainingSec / (24 * 60 * 60);

  const sessionPayload = setSessionCookie(
    res,
    {
      userId: String(session.userId),
      email: String(session.email),
      fullName: session.fullName,
      ttlDays,
    },
    req,
  );
  await registerIssuedSession({
    headers: req.headers,
    userId: String(session.userId),
    email: String(session.email),
    session: sessionPayload,
    loginMethod: "sync",
    loginFlow: "unknown",
    isAccountCreationSession: false,
  });

  return res;
}
