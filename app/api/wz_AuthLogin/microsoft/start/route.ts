import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "../../_active_session";
import { supabaseAnon } from "../../_supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};
const MICROSOFT_STATE_COOKIE_NAME = "wz_microsoft_oauth_state_v1";

type MicrosoftStatePayload = {
  typ: "wz-microsoft-oauth-state";
  next: string;
  intent?: "login" | "connect";
  connect_user_id?: string;
  iat: number;
  exp: number;
  nonce: string;
  cv?: string;
};

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

function createPkceCodeVerifier() {
  // 43+ chars (base64url) to satisfy PKCE verifier requirements.
  return base64UrlEncode(crypto.randomBytes(32));
}

function createPkceCodeChallenge(verifier: string) {
  return base64UrlEncode(
    crypto.createHash("sha256").update(String(verifier || "")).digest(),
  );
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

function getConfiguredAuthOrigin() {
  const raw = String(
    process.env.AUTH_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "",
  ).trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
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

function pickRequestHost(req: NextRequest) {
  return String(
    req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || "",
  )
    .split(",")[0]
    .trim();
}

function normalizeAuthHost(host: string, opts?: { preferRequestHost?: boolean }) {
  const clean = String(host || "").trim();
  if (!clean) return "";

  if (opts?.preferRequestHost) return clean;

  const hostOnly = clean.split(":")[0].toLowerCase();
  if (hostOnly === "wyzer.com.br") {
    return clean.replace(/^wyzer\.com\.br(?::\d+)?$/i, "www.wyzer.com.br");
  }

  return clean;
}

function getRequestOrigin(req: NextRequest, opts?: { preferRequestHost?: boolean }) {
  const configured = opts?.preferRequestHost ? "" : getConfiguredAuthOrigin();
  if (configured) return configured;

  const hostHeader = normalizeAuthHost(pickRequestHost(req), opts) || req.nextUrl.host;
  const protoHeader =
    req.headers.get("x-forwarded-proto") ||
    req.nextUrl.protocol.replace(":", "") ||
    "https";
  const proto = protoHeader === "http" ? "http" : "https";
  return `${proto}://${hostHeader}`;
}

function resolveMicrosoftStateCookieDomain(req: NextRequest) {
  const host = String(
    req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || "",
  )
    .split(":")[0]
    .trim()
    .toLowerCase();

  if (!host) return undefined;
  if (host === "wyzer.com.br" || host.endsWith(".wyzer.com.br")) {
    return ".wyzer.com.br";
  }
  return undefined;
}

function createMicrosoftStateTicket(params: {
  next: string;
  intent?: "login" | "connect";
  connectUserId?: string;
  codeVerifier?: string;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const now = Date.now();
  const ttlMs = Math.max(30000, Number(params.ttlMs || 1000 * 60 * 10));
  const payload: MicrosoftStatePayload = {
    typ: "wz-microsoft-oauth-state",
    next: sanitizeNext(params.next),
    intent: params.intent === "connect" ? "connect" : "login",
    connect_user_id: String(params.connectUserId || "").trim() || undefined,
    iat: now,
    exp: now + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
    cv: String(params.codeVerifier || "").trim() || undefined,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      next?: string;
      returnTo?: string;
      intent?: string;
    };
    const intentRaw = String(body?.intent || "").trim().toLowerCase();
    const intent = intentRaw === "connect" ? "connect" : "login";
    const nextRaw = String(body?.next || body?.returnTo || "").trim();
    const nextSafe = sanitizeNext(nextRaw || "/");
    let connectUserId = "";
    if (intent === "connect") {
      const activeSession = await readActiveSessionFromRequest(req, {
        seedIfMissing: false,
      });
      if (!activeSession?.userId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Sessao invalida para conectar provedor.",
          },
          { status: 401, headers: NO_STORE_HEADERS },
        );
      }
      connectUserId = String(activeSession.userId).trim();
      if (!connectUserId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Sessao invalida para conectar provedor.",
          },
          { status: 401, headers: NO_STORE_HEADERS },
        );
      }
    }
    const codeVerifier = createPkceCodeVerifier();
    const codeChallenge = createPkceCodeChallenge(codeVerifier);
    const oauthScopes =
      String(process.env.MICROSOFT_OAUTH_SCOPES || "openid profile email").trim() ||
      "openid profile email";

    const stateTicket = createMicrosoftStateTicket({
      next: nextSafe,
      intent,
      connectUserId,
      codeVerifier,
    });

    const callback = new URL(
      "/api/wz_AuthLogin/microsoft/callback",
      getRequestOrigin(req, { preferRequestHost: intent === "connect" }),
    );
    callback.searchParams.set("st", stateTicket);

    const sb = supabaseAnon();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: callback.toString(),
        scopes: oauthScopes,
        queryParams: {
          code_challenge: codeChallenge,
          code_challenge_method: "s256",
          include_granted_scopes: "true",
        },
      },
    });

    if (error || !data?.url) {
      console.error("[microsoft-start] signInWithOAuth error:", error);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nao foi possivel iniciar login com Microsoft. Verifique as chaves OAuth no Supabase.",
        },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        authUrl: String(data.url),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
    const cookieDomain = resolveMicrosoftStateCookieDomain(req);
    response.cookies.set({
      name: MICROSOFT_STATE_COOKIE_NAME,
      value: stateTicket,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return response;
  } catch (error) {
    console.error("[microsoft-start] error:", error);
    const message =
      error instanceof Error && String(error.message || "").trim()
        ? String(error.message)
        : "Erro inesperado ao iniciar login com Microsoft.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
