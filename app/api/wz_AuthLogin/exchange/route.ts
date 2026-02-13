import crypto from "crypto";
import { NextResponse } from "next/server";
import { setSessionCookie } from "../_session";
import { supabaseAdmin } from "../_supabase";
import {
  ACCOUNT_STATE_DEACTIVATED,
  ACCOUNT_STATE_PENDING_DELETION,
  resolveAccountLifecycleBySession,
  syncAccountLifecycleIfNeeded,
} from "@/app/api/wz_users/_account_lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type ExchangeTicketPayload = {
  exp?: number;
  userId?: string;
  email?: string;
  fullName?: string;
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
  const b64 =
    input.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((input.length + 3) % 4);
  return Buffer.from(b64, "base64").toString("utf8");
}

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest(),
  );
}

function isSafeNextPath(path: string) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\n") || path.includes("\r")) return false;
  return true;
}

function isAllowedReturnToAbsolute(url: URL) {
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

  if (isSafeNextPath(value)) return value;

  try {
    const url = new URL(value);
    if (!isAllowedReturnToAbsolute(url)) return "/";
    return url.toString();
  } catch {
    return "/";
  }
}

function sanitizeFullName(value?: string | null) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.slice(0, 120);
}

function buildRedirectTarget(baseUrl: URL, safeNext: string) {
  if (/^https?:\/\//i.test(safeNext)) return safeNext;
  return new URL(safeNext, baseUrl.origin).toString();
}

function buildReactivateUrl(baseUrl: URL) {
  const reactivate = new URL("/signup/reactivate", baseUrl.origin);
  return reactivate.toString();
}

function setNoStoreHeaders(res: NextResponse) {
  res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  res.headers.set("Pragma", NO_STORE_HEADERS.Pragma);
  res.headers.set("Expires", NO_STORE_HEADERS.Expires);
}

function redirectWithNoStore(target: string) {
  const res = NextResponse.redirect(target);
  setNoStoreHeaders(res);
  return res;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ticket = String(url.searchParams.get("ticket") || "");
    const next = String(url.searchParams.get("next") || "").trim();
    const safeNext = sanitizeNext(next);

    if (!ticket || !ticket.includes(".")) {
      return redirectWithNoStore(buildRedirectTarget(url, safeNext));
    }

    const secret = getTicketSecret();
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "SESSION_SECRET/WZ_AUTH_SECRET nao configurado." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const [payloadB64, sig] = ticket.split(".");
    const expected = signTicket(payloadB64, secret);
    if (!payloadB64 || !sig || sig !== expected) {
      return redirectWithNoStore(buildRedirectTarget(url, safeNext));
    }

    const rawPayload = base64UrlDecodeToString(payloadB64);
    const payload = JSON.parse(rawPayload || "{}") as ExchangeTicketPayload;

    const exp = Number(payload?.exp || 0);
    const userId = String(payload?.userId || "").trim();
    const email = String(payload?.email || "").trim().toLowerCase();
    const fullName = sanitizeFullName(payload?.fullName);

    if (!userId || !email || !exp || exp < Date.now()) {
      return redirectWithNoStore(buildRedirectTarget(url, safeNext));
    }

    const sb = supabaseAdmin();
    const lifecycle = await resolveAccountLifecycleBySession({
      sb,
      sessionUserId: userId,
      sessionEmail: email,
    });
    const syncedLifecycle = lifecycle
      ? await syncAccountLifecycleIfNeeded({ sb, record: lifecycle })
      : null;

    if (
      syncedLifecycle &&
      (syncedLifecycle.state === ACCOUNT_STATE_PENDING_DELETION ||
        syncedLifecycle.state === ACCOUNT_STATE_DEACTIVATED)
    ) {
      const res = NextResponse.redirect(buildReactivateUrl(url));
      setSessionCookie(res, { userId, email, fullName }, req.headers);
      setNoStoreHeaders(res);
      return res;
    }

    if (!syncedLifecycle) {
      return redirectWithNoStore(buildRedirectTarget(url, safeNext));
    }

    const res = NextResponse.redirect(buildRedirectTarget(url, safeNext));
    setSessionCookie(res, { userId, email, fullName }, req.headers);
    setNoStoreHeaders(res);
    return res;
  } catch (error: unknown) {
    console.error("[exchange] error:", error);
    const url = new URL(req.url);
    return redirectWithNoStore(new URL("/", url.origin).toString());
  }
}
