import { NextResponse } from "next/server";
import { setSessionCookie } from "../_session";
import crypto from "crypto";

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

function getSessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.WZ_AUTH_SECRET ||
    ""
  );
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
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

    if (!ticket || !ticket.includes(".")) {
      const res = NextResponse.redirect(new URL(safeNext, url.origin));
      return res;
    }

    const secret = getSessionSecret();
    if (!secret) {
      return NextResponse.json({ ok: false, error: "SESSION_SECRET/WZ_AUTH_SECRET não configurado." }, { status: 500 });
    }

    const [payloadB64, sig] = ticket.split(".");
    const expected = signTicket(payloadB64, secret);

    if (sig !== expected) {
      // inválido
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }

    const raw = base64UrlDecodeToString(payloadB64);
    const payload = JSON.parse(raw || "{}") as any;

    const exp = Number(payload?.exp || 0);
    const userId = String(payload?.userId || "");
    const email = String(payload?.email || "");

    if (!userId || !email || !exp || exp < Date.now()) {
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }

    // ✅ aqui sim salva cookie no host do dashboard
    const res = NextResponse.redirect(new URL(safeNext, url.origin));
    setSessionCookie(res, { userId, email }, req.headers); // ✅ passa req
    return res;
  } catch (e: any) {
    console.error("[exchange] error:", e);
    // fallback: só redireciona
    const url = new URL(req.url);
    return NextResponse.redirect(new URL("/create-account", url.origin));
  }
}
