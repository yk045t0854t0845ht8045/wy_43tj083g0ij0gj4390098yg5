import { NextResponse } from "next/server";
import { setSessionCookie } from "../_session";
import { registerIssuedSession } from "../_session_devices";
import crypto from "crypto";

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

function applyNoStore(res: NextResponse) {
  res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  res.headers.set("Pragma", NO_STORE_HEADERS.Pragma);
  res.headers.set("Expires", NO_STORE_HEADERS.Expires);
}

function isSafeNextPath(path: string) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\n") || path.includes("\r")) return false;
  return true;
}

function isAllowedReturnToAbsolute(u: URL) {
  const host = u.hostname.toLowerCase();
  const allowed =
    host === "wyzer.com.br" ||
    host === "www.wyzer.com.br" ||
    host.endsWith(".wyzer.com.br") ||
    host === "localhost" ||
    host.endsWith(".localhost");

  const protoOk = u.protocol === "https:" || u.protocol === "http:";
  return protoOk && allowed;
}

function sanitizeNext(raw: string) {
  if (!raw) return "/";

  if (isSafeNextPath(raw)) return raw;

  try {
    const u = new URL(raw);
    if (isAllowedReturnToAbsolute(u)) return u.toString();
  } catch {}

  return "/";
}

function toRedirectTarget(next: string, origin: string) {
  if (/^https?:\/\//i.test(next)) return next;
  return new URL(next, origin).toString();
}

function sanitizeFullName(v?: string | null) {
  const clean = String(v || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.slice(0, 120);
}

function normalizeLoginMethod(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  if (
    clean === "password" ||
    clean === "email_code" ||
    clean === "sms_code" ||
    clean === "totp" ||
    clean === "passkey" ||
    clean === "trusted" ||
    clean === "exchange" ||
    clean === "sync" ||
    clean === "google" ||
    clean === "discord" ||
    clean === "microsoft"
  ) {
    return clean;
  }
  return "exchange";
}

function normalizeLoginFlow(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "login" || clean === "register") return clean;
  return "unknown";
}

function parseBooleanFlag(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return false;
  return clean === "1" || clean === "true" || clean === "yes";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const ticket = String(url.searchParams.get("ticket") || "");
    const safeNext = sanitizeNext(String(url.searchParams.get("next") || "").trim());
    const loginMethod = normalizeLoginMethod(url.searchParams.get("lm"));
    const loginFlow = normalizeLoginFlow(url.searchParams.get("lf"));
    const isAccountCreationSession =
      parseBooleanFlag(url.searchParams.get("acs")) || loginFlow === "register";

    const redirectTarget = toRedirectTarget(safeNext, url.origin);

    if (!ticket || !ticket.includes(".")) {
      const res = NextResponse.redirect(redirectTarget, 303);
      applyNoStore(res);
      return res;
    }

    const secret = getTicketSecret();
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "SESSION_SECRET/WZ_AUTH_SECRET nao configurado." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const [payloadB64, sig] = ticket.split(".");
    if (!payloadB64 || !sig || signTicket(payloadB64, secret) !== sig) {
      const res = NextResponse.redirect(redirectTarget, 303);
      applyNoStore(res);
      return res;
    }

    const raw = base64UrlDecodeToString(payloadB64);
    const payload = JSON.parse(raw || "{}") as ExchangeTicketPayload;

    const exp = Number(payload?.exp || 0);
    const userId = String(payload?.userId || "").trim();
    const email = String(payload?.email || "").trim().toLowerCase();
    const fullName = sanitizeFullName(payload?.fullName);

    if (!userId || !email || !exp || exp < Date.now()) {
      const res = NextResponse.redirect(redirectTarget, 303);
      applyNoStore(res);
      return res;
    }

    const res = NextResponse.redirect(redirectTarget, 303);
    const sessionPayload = setSessionCookie(res, { userId, email, fullName }, req.headers);

    await registerIssuedSession({
      headers: req.headers,
      userId,
      email,
      session: sessionPayload,
      loginMethod,
      loginFlow,
      isAccountCreationSession,
    });

    applyNoStore(res);
    return res;
  } catch (error) {
    console.error("[exchange] error:", error);
    const url = new URL(req.url);
    const res = NextResponse.redirect(new URL("/", url.origin), 303);
    applyNoStore(res);
    return res;
  }
}
