import { NextResponse } from "next/server";
import { setSessionCookie } from "../_session";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
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
  // ✅ usa o mesmo padrão que você já tinha, mas prioriza SESSION_SECRET
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest(),
  );
}

function isSafeNextPath(p: string) {
  if (!p) return false;
  if (!p.startsWith("/")) return false;
  if (p.startsWith("//")) return false;
  if (p.includes("\n") || p.includes("\r")) return false;
  return true;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const ticket = String(url.searchParams.get("ticket") || "");
    const next = String(url.searchParams.get("next") || "/create-account");
    const safeNext = isSafeNextPath(next) ? next : "/create-account";

    // sem ticket -> só vai pro next (sem cookie)
    if (!ticket || !ticket.includes(".")) {
      const res = NextResponse.redirect(new URL(safeNext, url.origin));
      res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
      res.headers.set("Pragma", NO_STORE_HEADERS["Pragma"]);
      res.headers.set("Expires", NO_STORE_HEADERS["Expires"]);
      return res;
    }

    const secret = getTicketSecret();
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "SESSION_SECRET/WZ_AUTH_SECRET não configurado." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const [payloadB64, sig] = ticket.split(".");
    const expected = signTicket(payloadB64, secret);

    if (sig !== expected) {
      const res = NextResponse.redirect(new URL(safeNext, url.origin));
      res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
      res.headers.set("Pragma", NO_STORE_HEADERS["Pragma"]);
      res.headers.set("Expires", NO_STORE_HEADERS["Expires"]);
      return res;
    }

    const raw = base64UrlDecodeToString(payloadB64);
    const payload = JSON.parse(raw || "{}") as any;

    const exp = Number(payload?.exp || 0); // exp em ms
    const userId = String(payload?.userId || "");
    const email = String(payload?.email || "");

    if (!userId || !email || !exp || exp < Date.now()) {
      const res = NextResponse.redirect(new URL(safeNext, url.origin));
      res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
      res.headers.set("Pragma", NO_STORE_HEADERS["Pragma"]);
      res.headers.set("Expires", NO_STORE_HEADERS["Expires"]);
      return res;
    }

    // ✅ aqui SIM seta cookie no host atual (dashboard.wyzer.com.br)
    const res = NextResponse.redirect(new URL(safeNext, url.origin));
    setSessionCookie(res, { userId, email }, req.headers);

    res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    res.headers.set("Pragma", NO_STORE_HEADERS["Pragma"]);
    res.headers.set("Expires", NO_STORE_HEADERS["Expires"]);

    return res;
  } catch (e: any) {
    console.error("[exchange] error:", e);
    const url = new URL(req.url);
    const res = NextResponse.redirect(new URL("/create-account", url.origin));
    res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    res.headers.set("Pragma", NO_STORE_HEADERS["Pragma"]);
    res.headers.set("Expires", NO_STORE_HEADERS["Expires"]);
    return res;
  }
}
