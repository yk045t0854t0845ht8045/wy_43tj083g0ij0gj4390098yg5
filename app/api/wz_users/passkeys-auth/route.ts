import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { createPasskeyAuthProof } from "@/app/api/wz_users/_passkey_auth_proof";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const PASSKEY_AUTH_TICKET_TYP = "wz-passkey-auth";

type PasskeyAuthTicketPayload = {
  typ: "wz-passkey-auth";
  uid: string;
  email: string;
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

type SessionContext = {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  sessionEmail: string;
};

type StoredPasskeyRow = {
  id: string;
  credentialId: string;
  signCount: number;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
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

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
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

function createPasskeyAuthTicket(params: {
  userId: string;
  email: string;
  challenge: string;
  expectedOrigin?: string | null;
  rpId: string;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const payload: PasskeyAuthTicketPayload = {
    typ: PASSKEY_AUTH_TICKET_TYP,
    uid: String(params.userId || "").trim(),
    email: normalizeEmail(params.email),
    challenge: normalizeBase64Url(params.challenge),
    ...(params.expectedOrigin
      ? { expectedOrigin: normalizeOrigin(params.expectedOrigin) || undefined }
      : {}),
    rpId: String(params.rpId || "").trim().toLowerCase(),
    iat: Date.now(),
    exp: Date.now() + Number(params.ttlMs ?? 1000 * 60 * 5),
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function readPasskeyAuthTicket(params: {
  ticket: string;
  sessionUserId: string;
  sessionEmail: string;
}) {
  const secret = getTicketSecret();
  if (!secret) {
    return { ok: false as const, error: "Configuracao de sessao ausente no servidor." };
  }

  const token = String(params.ticket || "").trim();
  if (!token.includes(".")) {
    return {
      ok: false as const,
      error: "Sessao do Windows Hello invalida. Tente novamente.",
    };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return {
      ok: false as const,
      error: "Sessao do Windows Hello invalida. Tente novamente.",
    };
  }

  if (signTicket(payloadB64, secret) !== sig) {
    return {
      ok: false as const,
      error: "Sessao do Windows Hello invalida. Tente novamente.",
    };
  }

  const parsed = safeJsonParse<PasskeyAuthTicketPayload>(
    base64UrlToBuffer(payloadB64).toString("utf8"),
  );
  if (!parsed || parsed.typ !== PASSKEY_AUTH_TICKET_TYP) {
    return {
      ok: false as const,
      error: "Sessao do Windows Hello invalida. Tente novamente.",
    };
  }

  if (!parsed.uid || !parsed.email || !parsed.challenge || !parsed.rpId || parsed.exp < Date.now()) {
    return {
      ok: false as const,
      error: "Sessao do Windows Hello expirada. Tente novamente.",
    };
  }

  const expectedUserId = String(params.sessionUserId || "").trim();
  const expectedEmail = normalizeEmail(params.sessionEmail);
  const payloadUserId = String(parsed.uid || "").trim();
  const payloadEmail = normalizeEmail(parsed.email);

  if (expectedUserId && expectedUserId !== payloadUserId) {
    return {
      ok: false as const,
      error: "Sessao do Windows Hello invalida para esta conta.",
    };
  }

  if (expectedEmail && expectedEmail !== payloadEmail) {
    return {
      ok: false as const,
      error: "Sessao do Windows Hello invalida para esta conta.",
    };
  }

  return {
    ok: true as const,
    payload: {
      ...parsed,
      uid: payloadUserId,
      email: payloadEmail,
      challenge: normalizeBase64Url(parsed.challenge),
      expectedOrigin: normalizeOrigin(parsed.expectedOrigin) || undefined,
      rpId: String(parsed.rpId || "").trim().toLowerCase(),
    } satisfies PasskeyAuthTicketPayload,
  };
}

function randomChallenge(bytes = 32) {
  return base64UrlEncode(crypto.randomBytes(Math.max(16, bytes)));
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

function resolveExpectedOrigin(req: NextRequest) {
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

function resolveRpId(hostOrOrigin: string | null) {
  if (!hostOrOrigin) return "";

  const normalizedOrigin = normalizeOrigin(hostOrOrigin);
  const host = (() => {
    if (normalizedOrigin) {
      try {
        return new URL(normalizedOrigin).hostname.toLowerCase();
      } catch {
        return "";
      }
    }
    return String(hostOrOrigin || "").toLowerCase().split(":")[0];
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

async function listPasskeysForUser(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
}) {
  const cleanUserId = String(params.userId || "").trim();
  if (!cleanUserId) return { schemaReady: true, rows: [] as StoredPasskeyRow[] };

  const { data, error } = await params.sb
    .from("wz_auth_passkeys")
    .select("id,credential_id,sign_count")
    .eq("user_id", cleanUserId)
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

async function getSessionContext(req: NextRequest) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Nao autenticado." },
        { status: 401, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const sessionUserId = String(session.userId || "").trim();
  const sessionEmail = normalizeEmail(session.email);
  if (!sessionUserId || !sessionEmail) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Sessao invalida." },
        { status: 401, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    ctx: {
      sb: supabaseAdmin(),
      sessionUserId,
      sessionEmail,
    } satisfies SessionContext,
  };
}

async function handleStart(req: NextRequest, ctx: SessionContext) {
  const passkeys = await listPasskeysForUser({ sb: ctx.sb, userId: ctx.sessionUserId });
  if (!passkeys.schemaReady) {
    return NextResponse.json(
      {
        ok: false,
        error: "Schema de passkeys ausente. Execute sql/wz_auth_passkeys_create.sql.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  if (passkeys.rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Windows Hello nao esta ativo nesta conta." },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }

  const expectedOrigin = resolveExpectedOrigin(req);
  const rpId = resolveRpId(expectedOrigin);
  if (!rpId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Nao foi possivel resolver o dominio para validar com Windows Hello.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  const request = buildPasskeyRequestOptions({
    rpId,
    credentialIds: passkeys.rows.map((row) => row.credentialId),
  });

  const ticket = createPasskeyAuthTicket({
    userId: ctx.sessionUserId,
    email: ctx.sessionEmail,
    challenge: request.challenge,
    expectedOrigin,
    rpId,
  });

  return NextResponse.json(
    {
      ok: true,
      ticket,
      options: request.options,
      credentialCount: passkeys.rows.length,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

async function handleFinish(ctx: SessionContext, body: Record<string, unknown>) {
  const ticketRes = readPasskeyAuthTicket({
    ticket: String(body.ticket || "").trim(),
    sessionUserId: ctx.sessionUserId,
    sessionEmail: ctx.sessionEmail,
  });
  if (!ticketRes.ok) {
    return NextResponse.json(
      { ok: false, error: ticketRes.error },
      { status: 400, headers: NO_STORE_HEADERS },
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

  const passkeys = await listPasskeysForUser({ sb: ctx.sb, userId: ctx.sessionUserId });
  if (!passkeys.schemaReady) {
    return NextResponse.json(
      {
        ok: false,
        error: "Schema de passkeys ausente. Execute sql/wz_auth_passkeys_create.sql.",
      },
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
    await ctx.sb
      .from("wz_auth_passkeys")
      .update({
        sign_count: nextSignCount,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", matched.id);
  } catch (error) {
    console.error("[passkeys-auth] update passkey metadata error:", error);
  }

  const passkeyProof = createPasskeyAuthProof({
    userId: ctx.sessionUserId,
    email: ctx.sessionEmail,
  });

  return NextResponse.json(
    { ok: true, passkeyProof },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const mode = String(body.mode || "").trim().toLowerCase();

    if (!mode || mode === "start") {
      return handleStart(req, base.ctx);
    }
    if (mode === "finish") {
      return handleFinish(base.ctx, body);
    }

    return NextResponse.json(
      { ok: false, error: "Modo invalido para validacao de Windows Hello." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[passkeys-auth] error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao validar Windows Hello." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
