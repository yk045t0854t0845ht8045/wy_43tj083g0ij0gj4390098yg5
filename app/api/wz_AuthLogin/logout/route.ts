import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie, readSessionFromRequest } from "../_session";
import { supabaseAdmin } from "../_supabase";
import { isSessionDevicesSchemaMissingError } from "../_session_devices";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function pickHostHeader(req: NextRequest) {
  return req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
}

function hostNameFromHeader(hostHeader: string) {
  return String(hostHeader || "").split(":")[0].toLowerCase();
}

function isLocalHost(hostHeader: string) {
  const host = hostNameFromHeader(hostHeader);
  return host.endsWith(".localhost") || host === "localhost";
}

function buildLoginOrigin(hostHeader: string) {
  return isLocalHost(hostHeader)
    ? "http://login.localhost:3000"
    : "https://login.wyzer.com.br";
}

function sanitizeNext(raw: string) {
  const value = String(raw || "").trim();
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (value.includes("\n") || value.includes("\r")) return "/";
  return value;
}

function applyNoStore(res: NextResponse) {
  res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  res.headers.set("Pragma", NO_STORE_HEADERS.Pragma);
  res.headers.set("Expires", NO_STORE_HEADERS.Expires);
}

async function revokeCurrentSession(req: NextRequest) {
  const session = readSessionFromRequest(req);
  const userId = String(session?.userId || "").trim();
  const sid = String(session?.sid || "").trim();
  if (!userId || !sid) return;

  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const { error } = await sb
    .from("wz_auth_sessions")
    .update({
      revoked_at: nowIso,
      revoked_reason: "logout",
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .eq("sid", sid)
    .is("revoked_at", null);

  if (!error) return;
  if (isSessionDevicesSchemaMissingError(error)) return;
  console.error("[logout] revokeCurrentSession error:", error);
}

async function handleLogout(req: NextRequest) {
  await revokeCurrentSession(req);

  const hostHeader = pickHostHeader(req);
  const currentHost = hostNameFromHeader(hostHeader);
  const loginOrigin = buildLoginOrigin(hostHeader);
  const loginHost = new URL(loginOrigin).hostname.toLowerCase();
  const next = sanitizeNext(String(req.nextUrl.searchParams.get("next") || "/"));

  const redirectTo =
    currentHost === loginHost
      ? new URL(next, `${loginOrigin}/`).toString()
      : `${loginOrigin}/api/wz_AuthLogin/logout?next=${encodeURIComponent(next)}`;

  const res = NextResponse.redirect(new URL(redirectTo), 303);
  clearSessionCookie(res);
  applyNoStore(res);
  return res;
}

export async function GET(req: NextRequest) {
  return handleLogout(req);
}

export async function POST(req: NextRequest) {
  return handleLogout(req);
}
