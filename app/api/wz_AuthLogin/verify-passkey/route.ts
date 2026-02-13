import crypto from "crypto";
import { NextResponse } from "next/server";
import { setSessionCookie } from "../_session";
import { supabaseAdmin } from "../_supabase";
import {
  createTrustedLoginToken,
  getTrustedLoginTtlSeconds,
  hashTrustedLoginToken,
  setTrustedLoginCookie,
} from "../_trusted_login";
import { readLoginTwoFactorTicket } from "../_login_two_factor_ticket";
import {
  ACCOUNT_STATE_DEACTIVATED,
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

const LOGIN_PASSKEY_TICKET_TYP = "wz-login-passkey";

type LoginPasskeyTicketPayload = {
  typ: "wz-login-passkey";
  uid: string;
  email: string;
  fullName?: string;
  challenge: string;
  expectedOrigin?: string;
  rpId: string;
  iat: number;
  exp: number;
  nonce: string;
};

type PasskeyRequestOptionsPayload = {
  challenge: string;
  rpId: string;
  timeout: number;
  userVerification: "required";
  allowCredentials: Array<{
    type: "public-key";
    id: string;
    transports: string[];
  }>;
};

type PasskeyAssertionCredentialInput = {
  id?: string;
  rawId?: string;
  type?: string;
  response?: {
    clientDataJSON?: string;
    authenticatorData?: string;
    signature?: string;
    userHandle?: string | null;
  };
};

type StoredPasskeyRow = {
  id: string;
  credentialId: string;
  signCount: number;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeFullName(value?: string | null) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.slice(0, 120);
}

function isValidEmail(value: string) {
  const clean = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(clean);
}

function getEnvBool(name: string, def: boolean) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return def;
  if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  return def;
}

function isHostOnlyMode() {
  const isProd = process.env.NODE_ENV === "production";
  return isProd && getEnvBool("SESSION_COOKIE_HOST_ONLY", true);
}

function getDashboardOrigin() {
  const env = String(process.env.DASHBOARD_ORIGIN || "").trim();
  if (env) return env.replace(/\/+$/g, "");
  return "https://dashboard.wyzer.com.br";
}

function sanitizeNext(nextRaw: string) {
  const clean = String(nextRaw || "").trim();
  if (!clean) return "/";

  if (clean.startsWith("/")) return clean;

  try {
    const url = new URL(clean);
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "wyzer.com.br" ||
      host.endsWith(".wyzer.com.br") ||
      host === "localhost" ||
      host.endsWith(".localhost");

    if (!allowed) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function base64UrlEncode(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeBase64Url(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBuffer(value: unknown) {
  const normalized = normalizeBase64Url(value);
  if (!normalized) return Buffer.alloc(0);
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function randomChallenge(bytes = 32) {
  return base64UrlEncode(crypto.randomBytes(Math.max(16, bytes)));
}

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

function createLoginPasskeyTicket(params: {
  userId: string;
  email: string;
  fullName?: string | null;
  challenge: string;
  expectedOrigin?: string | null;
  rpId: string;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const safeFullName = sanitizeFullName(params.fullName);
  const payload: LoginPasskeyTicketPayload = {
    typ: LOGIN_PASSKEY_TICKET_TYP,
    uid: String(params.userId || "").trim(),
    email: normalizeEmail(params.email),
    ...(safeFullName ? { fullName: safeFullName } : {}),
    challenge: normalizeBase64Url(params.challenge),
    ...(params.expectedOrigin ? { expectedOrigin: normalizeOrigin(params.expectedOrigin) || undefined } : {}),
    rpId: String(params.rpId || "").trim().toLowerCase(),
    iat: Date.now(),
    exp: Date.now() + Number(params.ttlMs ?? 1000 * 60 * 5),
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function readLoginPasskeyTicket(params: { ticket: string; email?: string }) {
  const secret = getTicketSecret();
  if (!secret) {
    return { ok: false as const, error: "Configuracao de sessao ausente no servidor." };
  }

  const token = String(params.ticket || "").trim();
  if (!token.includes(".")) {
    return { ok: false as const, error: "Sessao do Windows Hello invalida. Recarregue e tente novamente." };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return { ok: false as const, error: "Sessao do Windows Hello invalida. Recarregue e tente novamente." };
  }

  if (signTicket(payloadB64, secret) !== sig) {
    return { ok: false as const, error: "Sessao do Windows Hello invalida. Recarregue e tente novamente." };
  }

  const parsed = safeJsonParse<LoginPasskeyTicketPayload>(
    base64UrlToBuffer(payloadB64).toString("utf8"),
  );
  if (!parsed || parsed.typ !== LOGIN_PASSKEY_TICKET_TYP) {
    return { ok: false as const, error: "Sessao do Windows Hello invalida. Recarregue e tente novamente." };
  }
  if (!parsed.uid || !parsed.email || !parsed.challenge || !parsed.rpId || parsed.exp < Date.now()) {
    return { ok: false as const, error: "Sessao do Windows Hello expirada. Inicie novamente." };
  }

  const expectedEmail = normalizeEmail(params.email);
  if (expectedEmail && expectedEmail !== normalizeEmail(parsed.email)) {
    return { ok: false as const, error: "Sessao do Windows Hello invalida para este e-mail." };
  }

  return {
    ok: true as const,
    payload: {
      ...parsed,
      email: normalizeEmail(parsed.email),
      fullName: sanitizeFullName(parsed.fullName),
      challenge: normalizeBase64Url(parsed.challenge),
      expectedOrigin: normalizeOrigin(parsed.expectedOrigin) || undefined,
      rpId: String(parsed.rpId || "").trim().toLowerCase(),
    } satisfies LoginPasskeyTicketPayload,
  };
}

function normalizeOrigin(value: unknown) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  try {
    const url = new URL(clean);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function resolveExpectedOrigin(req: Request) {
  const byHeader = normalizeOrigin(req.headers.get("origin"));
  if (byHeader) return byHeader;

  const host = String(req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!host) return null;

  const protoHeader = String(req.headers.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  const hostname = host.split(":")[0] || host;
  const proto =
    protoHeader === "http" || protoHeader === "https"
      ? protoHeader
      : hostname === "localhost" || hostname.endsWith(".localhost")
        ? "http"
        : "https";

  return normalizeOrigin(`${proto}://${host}`);
}

function resolveRpId(originOrHost: string | null) {
  if (!originOrHost) return "";

  const origin = normalizeOrigin(originOrHost);
  const host = (() => {
    if (!origin) return String(originOrHost || "").toLowerCase().split(":")[0];
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (!host) return "";
  if (host === "localhost" || host.endsWith(".localhost")) return "localhost";
  if (host.endsWith(".wyzer.com.br")) return "wyzer.com.br";
  return host;
}

function originMatchesRpId(origin: string, rpId: string) {
  const normalizedOrigin = normalizeOrigin(origin);
  const cleanRpId = String(rpId || "").trim().toLowerCase();
  if (!normalizedOrigin || !cleanRpId) return false;

  try {
    const host = new URL(normalizedOrigin).hostname.toLowerCase();
    return host === cleanRpId || host.endsWith(`.${cleanRpId}`);
  } catch {
    return false;
  }
}

function isPasskeySchemaMissing(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string"
    ? String((error as { code?: string }).code)
    : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("wz_auth_passkeys") ||
    message.includes("credential_id")
  );
}

async function listPasskeysForUser(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) return { schemaReady: true, rows: [] as StoredPasskeyRow[] };

  const { data, error } = await params.sb
    .from("wz_auth_passkeys")
    .select("id,credential_id,sign_count")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!error) {
    const rows: StoredPasskeyRow[] = (data || []).map((row) => {
      const typed = row as { id?: unknown; credential_id?: unknown; sign_count?: unknown };
      return {
        id: String(typed.id || "").trim(),
        credentialId: normalizeBase64Url(typed.credential_id),
        signCount: Math.max(0, Number(typed.sign_count || 0) || 0),
      };
    });
    return { schemaReady: true, rows };
  }

  if (isPasskeySchemaMissing(error)) {
    return { schemaReady: false, rows: [] as StoredPasskeyRow[] };
  }

  throw error;
}

function dedupeStrings(values: string[]) {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const clean = String(value || "").trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    output.push(clean);
  }

  return output;
}

function buildPasskeyRequestOptions(params: {
  rpId: string;
  credentialIds: string[];
}) {
  const challenge = randomChallenge(32);
  const allowCredentials = dedupeStrings(
    params.credentialIds.map((value) => normalizeBase64Url(value)),
  ).map((id) => ({
    type: "public-key" as const,
    id,
    transports: ["internal"],
  }));

  const options: PasskeyRequestOptionsPayload = {
    challenge,
    rpId: params.rpId,
    timeout: 60000,
    userVerification: "required",
    allowCredentials,
  };

  return { challenge, options };
}

function parseClientData(clientDataJSON: string) {
  return safeJsonParse<{ type?: string; challenge?: string; origin?: string }>(
    base64UrlToBuffer(clientDataJSON).toString("utf8"),
  );
}

function parseSignCount(authenticatorData: string) {
  const bytes = base64UrlToBuffer(authenticatorData);
  if (bytes.length < 37) return null;
  return bytes.readUInt32BE(33);
}

function makeDashboardTicket(params: {
  userId: string;
  email: string;
  fullName?: string | null;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 5);
  const safeFullName = sanitizeFullName(params.fullName);
  const payload = {
    userId: String(params.userId || "").trim(),
    email: normalizeEmail(params.email),
    ...(safeFullName ? { fullName: safeFullName } : {}),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

async function issueTrustedLogin(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
  res: NextResponse,
) {
  try {
    const token = createTrustedLoginToken();
    const tokenHash = hashTrustedLoginToken(token);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expIso = new Date(now + getTrustedLoginTtlSeconds() * 1000).toISOString();

    const { error } = await sb.from("wz_auth_trusted_devices").insert({
      email,
      token_hash: tokenHash,
      created_at: nowIso,
      last_used_at: nowIso,
      expires_at: expIso,
    });

    if (error) {
      console.error("[verify-passkey] trusted login insert error:", error);
      return;
    }

    setTrustedLoginCookie(res, token);
  } catch (error) {
    console.error("[verify-passkey] issueTrustedLogin error:", error);
  }
}

async function finalizeLogin(params: {
  req: Request;
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  email: string;
  fullName?: string | null;
  nextSafe: string;
}) {
  const dashboard = getDashboardOrigin();
  const safeFullName = sanitizeFullName(params.fullName);

  if (isHostOnlyMode()) {
    const dashboardTicket = makeDashboardTicket({
      userId: params.userId,
      email: params.email,
      fullName: safeFullName,
    });

    const nextUrl =
      `${dashboard}/api/wz_AuthLogin/exchange` +
      `?ticket=${encodeURIComponent(dashboardTicket)}` +
      `&next=${encodeURIComponent(params.nextSafe)}`;

    const res = NextResponse.json(
      { ok: true, nextUrl },
      { status: 200, headers: NO_STORE_HEADERS },
    );

    setSessionCookie(
      res,
      {
        userId: params.userId,
        email: params.email,
        fullName: safeFullName,
      },
      params.req.headers,
    );
    await issueTrustedLogin(params.sb, params.email, res);
    return res;
  }

  const nextUrl = `${dashboard}${params.nextSafe.startsWith("/") ? params.nextSafe : "/"}`;
  const res = NextResponse.json(
    { ok: true, nextUrl },
    { status: 200, headers: NO_STORE_HEADERS },
  );

  setSessionCookie(
    res,
    {
      userId: params.userId,
      email: params.email,
      fullName: safeFullName,
    },
    params.req.headers,
  );
  await issueTrustedLogin(params.sb, params.email, res);
  return res;
}

async function handleStart(req: Request, body: Record<string, unknown>) {
  const email = normalizeEmail(String(body.email || ""));
  const twoFactorTicket = String(body.twoFactorTicket || body.ticket || "").trim();

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "E-mail invalido." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  if (!twoFactorTicket) {
    return NextResponse.json(
      { ok: false, error: "Sessao de autenticacao invalida. Reinicie o login." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const ticketRes = readLoginTwoFactorTicket({ ticket: twoFactorTicket, email });
  if (!ticketRes.ok) {
    return NextResponse.json(
      { ok: false, error: ticketRes.error },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const sb = supabaseAdmin();
  const lifecycle = await resolveAccountLifecycleBySession({
    sb,
    sessionUserId: ticketRes.payload.uid,
    sessionEmail: ticketRes.payload.email,
  });
  const syncedLifecycle = lifecycle
    ? await syncAccountLifecycleIfNeeded({ sb, record: lifecycle })
    : null;
  if (syncedLifecycle?.state === ACCOUNT_STATE_DEACTIVATED) {
    return NextResponse.json(
      {
        ok: false,
        accountState: syncedLifecycle.state,
        emailReuseAt: syncedLifecycle.emailReuseAt,
        error:
          "Esta conta foi desativada e nao pode mais acessar o painel. Crie uma nova conta quando o prazo de reutilizacao do e-mail for liberado.",
      },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const passkeys = await listPasskeysForUser({ sb, userId: ticketRes.payload.uid });
  if (!passkeys.schemaReady) {
    return NextResponse.json(
      { ok: false, error: "Schema de passkeys ausente. Execute sql/wz_auth_passkeys_create.sql." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  if (passkeys.rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Windows Hello nao esta ativo nesta conta.",
        requiresTwoFactor: true,
        twoFactorTicket,
      },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }

  const expectedOrigin = resolveExpectedOrigin(req);
  const rpId = resolveRpId(expectedOrigin);
  if (!rpId) {
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel resolver o dominio para autenticar a passkey." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  const request = buildPasskeyRequestOptions({
    rpId,
    credentialIds: passkeys.rows.map((row) => row.credentialId),
  });

  const passkeyTicket = createLoginPasskeyTicket({
    userId: ticketRes.payload.uid,
    email: ticketRes.payload.email,
    fullName: ticketRes.payload.fullName,
    challenge: request.challenge,
    expectedOrigin,
    rpId,
  });

  return NextResponse.json(
    {
      ok: true,
      ticket: passkeyTicket,
      options: request.options,
      credentialCount: passkeys.rows.length,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

async function handleFinish(req: Request, body: Record<string, unknown>) {
  const email = normalizeEmail(String(body.email || ""));
  const passkeyTicket = String(body.ticket || "").trim();
  const nextSafe = sanitizeNext(String(body.next || body.returnTo || "").trim() || "/");

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "E-mail invalido." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  if (!passkeyTicket) {
    return NextResponse.json(
      { ok: false, error: "Sessao do Windows Hello invalida. Inicie novamente." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const ticketRes = readLoginPasskeyTicket({ ticket: passkeyTicket, email });
  if (!ticketRes.ok) {
    return NextResponse.json(
      { ok: false, error: ticketRes.error },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const sb = supabaseAdmin();
  const lifecycle = await resolveAccountLifecycleBySession({
    sb,
    sessionUserId: ticketRes.payload.uid,
    sessionEmail: ticketRes.payload.email,
  });
  const syncedLifecycle = lifecycle
    ? await syncAccountLifecycleIfNeeded({ sb, record: lifecycle })
    : null;
  if (syncedLifecycle?.state === ACCOUNT_STATE_DEACTIVATED) {
    return NextResponse.json(
      {
        ok: false,
        accountState: syncedLifecycle.state,
        emailReuseAt: syncedLifecycle.emailReuseAt,
        error:
          "Esta conta foi desativada e nao pode mais acessar o painel. Crie uma nova conta quando o prazo de reutilizacao do e-mail for liberado.",
      },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const credential = (body.credential || null) as PasskeyAssertionCredentialInput | null;
  if (!credential) {
    return NextResponse.json(
      { ok: false, error: "Resposta do Windows Hello ausente." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const credentialType = String(credential.type || "").trim().toLowerCase();
  if (credentialType !== "public-key") {
    return NextResponse.json(
      { ok: false, error: "Tipo de credencial invalido." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const rawId = normalizeBase64Url(credential.rawId || credential.id);
  const clientDataJSON = normalizeBase64Url(credential.response?.clientDataJSON);
  const authenticatorData = normalizeBase64Url(credential.response?.authenticatorData);
  const signature = normalizeBase64Url(credential.response?.signature);

  if (!rawId || !clientDataJSON || !authenticatorData || !signature) {
    return NextResponse.json(
      { ok: false, error: "Dados da credencial incompletos." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const clientData = parseClientData(clientDataJSON);
  if (!clientData) {
    return NextResponse.json(
      { ok: false, error: "Falha ao validar dados da credencial." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (String(clientData.type || "") !== "webauthn.get") {
    return NextResponse.json(
      { ok: false, error: "Tipo de operacao WebAuthn invalido." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const challengeFromClient = normalizeBase64Url(clientData.challenge);
  if (!challengeFromClient || challengeFromClient !== ticketRes.payload.challenge) {
    return NextResponse.json(
      { ok: false, error: "Challenge do Windows Hello invalido ou expirado." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const originFromClient = normalizeOrigin(clientData.origin);
  if (!originFromClient) {
    return NextResponse.json(
      { ok: false, error: "Origem da credencial invalida." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (ticketRes.payload.expectedOrigin && ticketRes.payload.expectedOrigin !== originFromClient) {
    return NextResponse.json(
      { ok: false, error: "A origem da credencial nao confere com esta sessao." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (!originMatchesRpId(originFromClient, ticketRes.payload.rpId)) {
    return NextResponse.json(
      { ok: false, error: "O dominio da passkey nao confere com esta sessao." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const passkeys = await listPasskeysForUser({ sb, userId: ticketRes.payload.uid });
  if (!passkeys.schemaReady) {
    return NextResponse.json(
      { ok: false, error: "Schema de passkeys ausente. Execute sql/wz_auth_passkeys_create.sql." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  const matched = passkeys.rows.find((row) => row.credentialId === rawId);
  if (!matched) {
    return NextResponse.json(
      { ok: false, error: "Credencial do Windows Hello nao reconhecida para esta conta." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const nextSignCount = (() => {
    const parsed = parseSignCount(authenticatorData);
    if (parsed === null) return Math.max(0, Number(matched.signCount || 0));
    return Math.max(Number(matched.signCount || 0), parsed);
  })();

  try {
    await sb
      .from("wz_auth_passkeys")
      .update({
        sign_count: nextSignCount,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", matched.id);
  } catch (error) {
    console.error("[verify-passkey] update passkey metadata error:", error);
  }

  try {
    await sb.from("wz_pending_auth").delete().eq("email", ticketRes.payload.email);
  } catch {
    // ignore pending cleanup errors
  }

  return finalizeLogin({
    req,
    sb,
    userId: ticketRes.payload.uid,
    email: ticketRes.payload.email,
    fullName: ticketRes.payload.fullName,
    nextSafe,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const mode = String(body.mode || "").trim().toLowerCase();

    if (!mode || mode === "start") {
      return await handleStart(req, body);
    }
    if (mode === "finish") {
      return await handleFinish(req, body);
    }

    return NextResponse.json(
      { ok: false, error: "Modo de validacao do Windows Hello invalido." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[verify-passkey] error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao validar Windows Hello." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
