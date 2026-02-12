import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { gen7, newSalt, sha } from "@/app/api/wz_AuthLogin/_codes";
import { sendLoginCodeEmail } from "@/app/api/wz_AuthLogin/_email";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { normalizeTotpCode, resolveTwoFactorState, verifyTotpCode } from "@/app/api/_twoFactor";
import { readPasskeyAuthProof } from "@/app/api/wz_users/_passkey_auth_proof";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const PASSKEY_TICKET_TYP = "wz-passkey";
const PASSKEY_RP_NAME = "Wyzer";

type PasskeyTicketPhase = "verify-email" | "verify-two-factor" | "register";

type PasskeyTicketPayload = {
  typ: "wz-passkey";
  uid: string;
  email: string;
  phase: PasskeyTicketPhase;
  challenge?: string;
  expectedOrigin?: string;
  rpId?: string;
  iat: number;
  exp: number;
  nonce: string;
};

type PasskeyCreationOptionsPayload = {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  timeout: number;
  attestation: "none";
  authenticatorSelection: {
    authenticatorAttachment: "platform";
    residentKey: "required";
    userVerification: "required";
  };
  pubKeyCredParams: Array<{ type: "public-key"; alg: number }>;
  excludeCredentials: Array<{ type: "public-key"; id: string; transports?: string[] }>;
};

type SessionContext = {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  sessionEmail: string;
};

type PasskeyCredentialFinishInput = {
  id?: string;
  rawId?: string;
  type?: string;
  response?: {
    clientDataJSON?: string;
    attestationObject?: string;
    authenticatorData?: string | null;
    transports?: unknown;
  };
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D+/g, "");
}

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

function createPasskeyTicket(params: {
  userId: string;
  email: string;
  phase: PasskeyTicketPhase;
  ttlMs?: number;
  challenge?: string;
  expectedOrigin?: string | null;
  rpId?: string;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");
  const now = Date.now();
  const payload: PasskeyTicketPayload = {
    typ: PASSKEY_TICKET_TYP,
    uid: String(params.userId || "").trim(),
    email: normalizeEmail(params.email),
    phase: params.phase,
    ...(params.challenge ? { challenge: normalizeBase64Url(params.challenge) } : {}),
    ...(params.expectedOrigin ? { expectedOrigin: normalizeOrigin(params.expectedOrigin) || undefined } : {}),
    ...(params.rpId ? { rpId: String(params.rpId || "").trim().toLowerCase() } : {}),
    iat: now,
    exp: now + Number(params.ttlMs ?? (params.phase === "register" ? 1000 * 60 * 5 : 1000 * 60 * 10)),
    nonce: crypto.randomBytes(8).toString("hex"),
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function readPasskeyTicket(params: {
  ticket: string;
  sessionUserId: string;
  sessionEmail: string;
  allowedPhases: PasskeyTicketPhase[];
}) {
  const secret = getTicketSecret();
  if (!secret) return { ok: false as const, error: "Configuracao de sessao ausente no servidor." };

  const token = String(params.ticket || "").trim();
  if (!token.includes(".")) {
    return { ok: false as const, error: "Sessao de chave de acesso invalida. Reabra o modal." };
  }
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return { ok: false as const, error: "Sessao de chave de acesso invalida. Reabra o modal." };
  }
  if (signTicket(payloadB64, secret) !== sig) {
    return { ok: false as const, error: "Sessao de chave de acesso invalida. Reabra o modal." };
  }

  const parsed = safeJsonParse<PasskeyTicketPayload>(base64UrlToBuffer(payloadB64).toString("utf8"));
  if (!parsed || parsed.typ !== PASSKEY_TICKET_TYP) {
    return { ok: false as const, error: "Sessao de chave de acesso invalida. Reabra o modal." };
  }
  if (!parsed.uid || parsed.exp < Date.now()) {
    return { ok: false as const, error: "Sessao expirada. Reabra o fluxo e tente novamente." };
  }
  if (!params.allowedPhases.includes(parsed.phase)) {
    return { ok: false as const, error: "Etapa invalida para ativacao da chave de acesso." };
  }
  if (String(parsed.uid) !== String(params.sessionUserId)) {
    return { ok: false as const, error: "Sessao invalida para este usuario." };
  }
  if (normalizeEmail(parsed.email) !== normalizeEmail(params.sessionEmail)) {
    return { ok: false as const, error: "Sessao desatualizada. Reabra o modal para continuar." };
  }
  return { ok: true as const, payload: parsed };
}

function maskSecureEmail(value: string) {
  const [rawUser, rawDomain] = normalizeEmail(value).split("@");
  if (!rawUser || !rawDomain) return value;
  const visible = rawUser.slice(0, 3) || rawUser.slice(0, 1);
  return `${visible}${"*".repeat(9)}@${rawDomain}`;
}

function isSchemaMissing(error: unknown) {
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

async function createEmailChallenge(sb: ReturnType<typeof supabaseAdmin>, email: string) {
  await sb
    .from("wz_auth_challenges")
    .update({ consumed: true })
    .eq("email", email)
    .eq("channel", "email")
    .eq("consumed", false);

  const code = gen7();
  const salt = newSalt();
  const hash = sha(code, salt);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  const { error } = await sb.from("wz_auth_challenges").insert({
    email,
    channel: "email",
    code_hash: hash,
    salt,
    expires_at: expiresAt,
    attempts_left: 7,
    consumed: false,
  });

  if (error) throw new Error("Nao foi possivel gerar o codigo de verificacao.");
  return code;
}

async function verifyEmailChallengeCode(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  code: string;
  consumeOnSuccess?: boolean;
}) {
  const { data: challenge, error } = await params.sb
    .from("wz_auth_challenges")
    .select("*")
    .eq("email", params.email)
    .eq("channel", "email")
    .eq("consumed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !challenge) return { ok: false as const, status: 400, error: "Codigo expirado. Reenvie o codigo." };

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await params.sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", challenge.id);
    return { ok: false as const, status: 400, error: "Codigo expirado. Reenvie o codigo." };
  }

  if (Number(challenge.attempts_left) <= 0) {
    return { ok: false as const, status: 429, error: "Muitas tentativas. Reenvie o codigo." };
  }

  if (sha(params.code, challenge.salt) !== challenge.code_hash) {
    const nextAttempts = Math.max(0, Number(challenge.attempts_left) - 1);
    await params.sb
      .from("wz_auth_challenges")
      .update({ attempts_left: nextAttempts, ...(nextAttempts <= 0 ? { consumed: true } : {}) })
      .eq("id", challenge.id);
    return {
      ok: false as const,
      status: nextAttempts <= 0 ? 429 : 400,
      error: nextAttempts <= 0
        ? "Voce atingiu o limite de tentativas. Reenvie o codigo."
        : `Codigo invalido. Restam ${nextAttempts} tentativa${nextAttempts === 1 ? "" : "s"}.`,
    };
  }

  if (params.consumeOnSuccess !== false) {
    await params.sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", challenge.id);
  }
  return { ok: true as const, challengeId: String(challenge.id) };
}

async function getSessionContext(req: NextRequest) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401, headers: NO_STORE_HEADERS }),
    };
  }
  const sessionUserId = String(session.userId || "").trim();
  const sessionEmail = normalizeEmail(session.email);
  if (!sessionUserId || !sessionEmail) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sessao invalida." }, { status: 401, headers: NO_STORE_HEADERS }),
    };
  }
  return {
    ok: true as const,
    ctx: { sb: supabaseAdmin(), sessionUserId, sessionEmail } satisfies SessionContext,
  };
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE_HEADERS });
}

function resolveExpectedOrigin(req: NextRequest) {
  const byHeader = normalizeOrigin(req.headers.get("origin"));
  if (byHeader) return byHeader;
  const host = String(req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const hostname = host.split(":")[0] || host;
  if (!hostname) return null;
  const protoHeader = String(req.headers.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
  const proto = protoHeader === "http" || protoHeader === "https"
    ? protoHeader
    : (hostname === "localhost" || hostname.endsWith(".localhost") ? "http" : "https");
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

async function listPasskeysForUser(params: { sb: ReturnType<typeof supabaseAdmin>; userId: string }) {
  const cleanUserId = String(params.userId || "").trim();
  if (!cleanUserId) {
    return { schemaReady: true, rows: [] as Array<{ credential_id: string; created_at: string | null }> };
  }

  const { data, error } = await params.sb
    .from("wz_auth_passkeys")
    .select("credential_id,created_at")
    .eq("user_id", cleanUserId)
    .order("created_at", { ascending: false });

  if (!error) {
    return {
      schemaReady: true,
      rows: (data || []).map((row) => ({
        credential_id: normalizeBase64Url((row as { credential_id?: unknown }).credential_id),
        created_at: String((row as { created_at?: unknown }).created_at || "") || null,
      })),
    };
  }
  if (isSchemaMissing(error)) {
    return { schemaReady: false, rows: [] as Array<{ credential_id: string; created_at: string | null }> };
  }
  throw error;
}

async function savePasskey(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  email: string;
  credentialId: string;
  attestationObject: string;
  clientDataJSON: string;
  authenticatorData?: string | null;
  transports: string[];
}) {
  const nowIso = new Date().toISOString();
  const { error } = await params.sb
    .from("wz_auth_passkeys")
    .upsert(
      {
        user_id: String(params.userId || "").trim(),
        email: normalizeEmail(params.email),
        credential_id: normalizeBase64Url(params.credentialId),
        label: "Windows Hello",
        transports: params.transports,
        sign_count: 0,
        attestation_object: normalizeBase64Url(params.attestationObject),
        client_data_json: normalizeBase64Url(params.clientDataJSON),
        authenticator_data: normalizeBase64Url(params.authenticatorData),
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "credential_id" },
    );

  if (!error) return { ok: true as const, createdAt: nowIso };
  if (isSchemaMissing(error)) {
    return { ok: false as const, error: "Schema de passkeys ausente. Execute sql/wz_auth_passkeys_create.sql." };
  }
  throw error;
}

function randomChallenge(bytes = 32) {
  return base64UrlEncode(crypto.randomBytes(Math.max(16, bytes)));
}

function dedupeStrings(values: string[]) {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const clean = String(value || "").trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    unique.push(clean);
  }
  return unique;
}

function buildPasskeyCreationOptions(params: {
  rpId: string;
  userId: string;
  email: string;
  existingCredentialIds: string[];
}) {
  const challenge = randomChallenge(32);
  const userHandle = base64UrlEncode(Buffer.from(String(params.userId || ""), "utf8"));
  const excludeCredentials = dedupeStrings(params.existingCredentialIds.map((id) => normalizeBase64Url(id))).map((id) => ({
    type: "public-key" as const,
    id,
    transports: ["internal"],
  }));

  const options: PasskeyCreationOptionsPayload = {
    challenge,
    rp: { id: params.rpId, name: PASSKEY_RP_NAME },
    user: {
      id: userHandle,
      name: normalizeEmail(params.email),
      displayName: normalizeEmail(params.email),
    },
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      userVerification: "required",
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    excludeCredentials,
  };

  return { challenge, options };
}

function parseValidTransports(value: unknown) {
  const allowed = new Set(["usb", "nfc", "ble", "internal", "hybrid", "smart-card"]);
  if (!Array.isArray(value)) return [] as string[];
  return dedupeStrings(
    value
      .map((item) => String(item || "").trim().toLowerCase())
      .filter((item) => allowed.has(item)),
  );
}

function parseClientData(clientDataJSON: string) {
  const parsed = safeJsonParse<{ type?: string; challenge?: string; origin?: string }>(
    base64UrlToBuffer(clientDataJSON).toString("utf8"),
  );
  return parsed;
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

async function handleStart(ctx: SessionContext) {
  const twoFactorState = await resolveTwoFactorState({
    sb: ctx.sb,
    sessionUserId: ctx.sessionUserId,
    wzUserId: ctx.sessionUserId,
  });

  if (twoFactorState.enabled && twoFactorState.secret) {
    const ticket = createPasskeyTicket({
      userId: ctx.sessionUserId,
      email: ctx.sessionEmail,
      phase: "verify-two-factor",
    });
    return NextResponse.json(
      {
        ok: true,
        ticket,
        verification: "two-factor",
        error: "Digite o codigo de 6 digitos do aplicativo autenticador.",
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  }

  const code = await createEmailChallenge(ctx.sb, ctx.sessionEmail);
  await sendLoginCodeEmail(ctx.sessionEmail, code, { heading: "Ativando Windows Hello" });

  const ticket = createPasskeyTicket({
    userId: ctx.sessionUserId,
    email: ctx.sessionEmail,
    phase: "verify-email",
  });
  return NextResponse.json(
    {
      ok: true,
      ticket,
      verification: "email",
      emailMask: maskSecureEmail(ctx.sessionEmail),
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

async function handleResend(req: NextRequest, ctx: SessionContext) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ticketRes = readPasskeyTicket({
    ticket: String(body.ticket || ""),
    sessionUserId: ctx.sessionUserId,
    sessionEmail: ctx.sessionEmail,
    allowedPhases: ["verify-email"],
  });
  if (!ticketRes.ok) return errorResponse(ticketRes.error, 400);

  const code = await createEmailChallenge(ctx.sb, ctx.sessionEmail);
  await sendLoginCodeEmail(ctx.sessionEmail, code, { heading: "Ativando Windows Hello" });

  const refreshedTicket = createPasskeyTicket({
    userId: ctx.sessionUserId,
    email: ctx.sessionEmail,
    phase: "verify-email",
  });
  return NextResponse.json(
    {
      ok: true,
      ticket: refreshedTicket,
      verification: "email",
      emailMask: maskSecureEmail(ctx.sessionEmail),
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

async function handleVerify(req: NextRequest, ctx: SessionContext, body: Record<string, unknown>) {
  const ticketRes = readPasskeyTicket({
    ticket: String(body.ticket || ""),
    sessionUserId: ctx.sessionUserId,
    sessionEmail: ctx.sessionEmail,
    allowedPhases: ["verify-email", "verify-two-factor"],
  });
  if (!ticketRes.ok) return errorResponse(ticketRes.error, 400);

  const passkeysRes = await listPasskeysForUser({ sb: ctx.sb, userId: ctx.sessionUserId });
  if (!passkeysRes.schemaReady) {
    return errorResponse("Schema de passkeys ausente. Execute sql/wz_auth_passkeys_create.sql.", 500);
  }
  const hasPasskey = passkeysRes.rows.length > 0;

  if (ticketRes.payload.phase === "verify-email") {
    const emailCode = onlyDigits(String(body.emailCode || body.code || "")).slice(0, 7);
    if (emailCode.length !== 7) {
      return errorResponse("Digite o codigo de 7 digitos enviado para seu e-mail.", 400);
    }
    const verifyCode = await verifyEmailChallengeCode({
      sb: ctx.sb,
      email: ctx.sessionEmail,
      code: emailCode,
      consumeOnSuccess: false,
    });
    if (!verifyCode.ok) return errorResponse(verifyCode.error, verifyCode.status);
    const { error: consumeError } = await ctx.sb
      .from("wz_auth_challenges")
      .update({ consumed: true })
      .eq("id", verifyCode.challengeId);
    if (consumeError) {
      console.error("[passkeys] consume challenge error:", consumeError);
      return errorResponse("Nao foi possivel confirmar o codigo. Tente novamente.", 500);
    }
  } else {
    const twoFactorState = await resolveTwoFactorState({
      sb: ctx.sb,
      sessionUserId: ctx.sessionUserId,
      wzUserId: ctx.sessionUserId,
    });
    if (!twoFactorState.enabled || !twoFactorState.secret) {
      return errorResponse("Autenticacao em 2 etapas nao esta ativa nesta conta.", 400);
    }

    const twoFactorCode = normalizeTotpCode(
      body.twoFactorCode ?? body.totpCode ?? body.code,
      6,
    );
    const passkeyProofRaw = String(body.passkeyProof ?? body.authProof ?? "").trim();
    const passkeyProofRes = passkeyProofRaw
      ? readPasskeyAuthProof({
          proof: passkeyProofRaw,
          userId: ctx.sessionUserId,
          email: ctx.sessionEmail,
        })
      : null;
    if (twoFactorCode.length !== 6 && !passkeyProofRes?.ok) {
      const fallbackMessage = passkeyProofRaw && passkeyProofRes && !passkeyProofRes.ok
        ? passkeyProofRes.error
        : "Digite o codigo de 6 digitos do aplicativo autenticador.";
      return NextResponse.json(
        {
          ok: false,
          requiresTwoFactor: true,
          requiresPasskey: hasPasskey,
          authMethods: { totp: true, passkey: hasPasskey },
          error: fallbackMessage,
        },
        { status: 428, headers: NO_STORE_HEADERS },
      );
    }
    if (twoFactorCode.length === 6) {
      const validTwoFactorCode = verifyTotpCode({ secret: twoFactorState.secret, code: twoFactorCode });
      if (!validTwoFactorCode) {
        return NextResponse.json(
          {
            ok: false,
            requiresTwoFactor: true,
            requiresPasskey: hasPasskey,
            authMethods: { totp: true, passkey: hasPasskey },
            error: "Codigo de 2 etapas invalido. Tente novamente.",
          },
          { status: 401, headers: NO_STORE_HEADERS },
        );
      }
    }
  }

  const expectedOrigin = resolveExpectedOrigin(req);
  const rpId = resolveRpId(expectedOrigin);
  if (!rpId) {
    return errorResponse("Nao foi possivel resolver o dominio para criar a passkey.", 500);
  }

  const creation = buildPasskeyCreationOptions({
    rpId,
    userId: ctx.sessionUserId,
    email: ctx.sessionEmail,
    existingCredentialIds: passkeysRes.rows.map((row) => row.credential_id),
  });

  const registerTicket = createPasskeyTicket({
    userId: ctx.sessionUserId,
    email: ctx.sessionEmail,
    phase: "register",
    challenge: creation.challenge,
    expectedOrigin,
    rpId,
  });

  return NextResponse.json(
    { ok: true, ticket: registerTicket, options: creation.options },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

async function handleFinish(ctx: SessionContext, body: Record<string, unknown>) {
  const ticketRes = readPasskeyTicket({
    ticket: String(body.ticket || ""),
    sessionUserId: ctx.sessionUserId,
    sessionEmail: ctx.sessionEmail,
    allowedPhases: ["register"],
  });
  if (!ticketRes.ok) return errorResponse(ticketRes.error, 400);

  const credential = (body.credential || null) as PasskeyCredentialFinishInput | null;
  if (!credential) return errorResponse("Credencial de passkey ausente.", 400);

  const credentialType = String(credential.type || "").trim().toLowerCase();
  if (credentialType !== "public-key") return errorResponse("Tipo de credencial invalido.", 400);

  const rawId = normalizeBase64Url(credential.rawId || credential.id);
  const clientDataJSON = normalizeBase64Url(credential.response?.clientDataJSON);
  const attestationObject = normalizeBase64Url(credential.response?.attestationObject);
  const authenticatorData = normalizeBase64Url(credential.response?.authenticatorData);
  const transports = parseValidTransports(credential.response?.transports);

  if (!rawId || !clientDataJSON || !attestationObject) {
    return errorResponse("Dados da credencial incompletos.", 400);
  }

  const clientData = parseClientData(clientDataJSON);
  if (!clientData) return errorResponse("Falha ao validar dados da credencial.", 400);
  if (String(clientData.type || "") !== "webauthn.create") {
    return errorResponse("Tipo de operacao WebAuthn invalido.", 400);
  }

  const challengeFromClient = normalizeBase64Url(clientData.challenge);
  const challengeFromTicket = normalizeBase64Url(ticketRes.payload.challenge);
  if (!challengeFromTicket || challengeFromClient !== challengeFromTicket) {
    return errorResponse("Challenge de passkey invalido ou expirado.", 400);
  }

  const originFromClient = normalizeOrigin(clientData.origin);
  const expectedOrigin = normalizeOrigin(ticketRes.payload.expectedOrigin);
  if (!originFromClient) return errorResponse("Origem da credencial invalida.", 400);
  if (expectedOrigin && expectedOrigin !== originFromClient) {
    return errorResponse("A origem da credencial nao confere com esta sessao.", 400);
  }

  const rpId = String(ticketRes.payload.rpId || "").trim().toLowerCase();
  if (rpId && !originMatchesRpId(originFromClient, rpId)) {
    return errorResponse("O dominio da passkey nao confere com esta sessao.", 400);
  }

  const saveResult = await savePasskey({
    sb: ctx.sb,
    userId: ctx.sessionUserId,
    email: ctx.sessionEmail,
    credentialId: rawId,
    attestationObject,
    clientDataJSON,
    authenticatorData: authenticatorData || null,
    transports,
  });
  if (!saveResult.ok) return errorResponse(saveResult.error, 500);

  const refreshed = await listPasskeysForUser({ sb: ctx.sb, userId: ctx.sessionUserId });
  const credentialCount = refreshed.schemaReady ? refreshed.rows.length : 1;

  return NextResponse.json(
    {
      ok: true,
      enabled: true,
      credentialCount,
      createdAt: saveResult.createdAt,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export async function GET(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;

    const passkeysRes = await listPasskeysForUser({
      sb: base.ctx.sb,
      userId: base.ctx.sessionUserId,
    });

    if (!passkeysRes.schemaReady) {
      return NextResponse.json(
        {
          ok: true,
          schemaReady: false,
          enabled: false,
          credentialCount: 0,
          lastCreatedAt: null,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        schemaReady: true,
        enabled: passkeysRes.rows.length > 0,
        credentialCount: passkeysRes.rows.length,
        lastCreatedAt: passkeysRes.rows[0]?.created_at || null,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[passkeys] status error:", error);
    return errorResponse("Erro inesperado ao consultar passkeys.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;
    return await handleStart(base.ctx);
  } catch (error) {
    console.error("[passkeys] start error:", error);
    return errorResponse("Erro inesperado ao iniciar ativacao do Windows Hello.", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;
    return await handleResend(req, base.ctx);
  } catch (error) {
    console.error("[passkeys] resend error:", error);
    return errorResponse("Erro inesperado ao reenviar codigo.", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const mode = String(body.mode || "").trim().toLowerCase();
    if (mode === "verify") return await handleVerify(req, base.ctx, body);
    if (mode === "finish") return await handleFinish(base.ctx, body);

    return errorResponse("Modo invalido para passkeys.", 400);
  } catch (error) {
    console.error("[passkeys] verify/finish error:", error);
    return errorResponse("Erro inesperado ao confirmar ativacao da passkey.", 500);
  }
}
