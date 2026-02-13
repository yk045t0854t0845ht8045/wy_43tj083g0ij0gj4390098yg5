import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { gen7, maskEmail, maskPhoneE164, newSalt, onlyDigits, sha, isValidE164BRMobile } from "@/app/api/wz_AuthLogin/_codes";
import { sendLoginCodeEmail } from "@/app/api/wz_AuthLogin/_email";
import { sendSmsCode } from "@/app/api/wz_AuthLogin/_sms";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  ACCOUNT_STATE_DEACTIVATED,
  ACCOUNT_STATE_PENDING_DELETION,
  markAccountPendingDeletion,
  resolveAccountLifecycleBySession,
  syncAccountLifecycleIfNeeded,
} from "@/app/api/wz_users/_account_lifecycle";
import {
  normalizeTotpCode,
  resolveTwoFactorState,
  verifyTwoFactorCodeWithRecovery,
} from "@/app/api/_twoFactor";
import { readPasskeyAuthProof } from "@/app/api/wz_users/_passkey_auth_proof";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const ACCOUNT_DELETE_TICKET_TYP = "wz-account-delete";

type AccountDeleteTicketPhase = "verify-email" | "verify-sms" | "verify-auth";

type AccountDeleteTicketPayload = {
  typ: "wz-account-delete";
  uid: string;
  sessionUid: string;
  email: string;
  phoneE164: string;
  phase: AccountDeleteTicketPhase;
  iat: number;
  exp: number;
  nonce: string;
};

type SessionContext = {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  sessionEmail: string;
  lifecycle: NonNullable<Awaited<ReturnType<typeof resolveAccountLifecycleBySession>>>;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhoneE164(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || "";
}

function normalizeBase64Url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = String(value || "").trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return normalizeBase64Url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

function createAccountDeleteTicket(params: {
  userId: string;
  sessionUserId: string;
  email: string;
  phoneE164: string;
  phase: AccountDeleteTicketPhase;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const now = Date.now();
  const payload: AccountDeleteTicketPayload = {
    typ: ACCOUNT_DELETE_TICKET_TYP,
    uid: String(params.userId || "").trim(),
    sessionUid: String(params.sessionUserId || "").trim(),
    email: normalizeEmail(params.email),
    phoneE164: normalizePhoneE164(params.phoneE164),
    phase: params.phase,
    iat: now,
    exp: now + Number(params.ttlMs ?? 1000 * 60 * 12),
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = normalizeBase64Url(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function readAccountDeleteTicket(params: {
  ticket: string;
  sessionUserId: string;
  sessionEmail: string;
  allowedPhases: AccountDeleteTicketPhase[];
}) {
  const secret = getTicketSecret();
  if (!secret) {
    return { ok: false as const, error: "Configuracao de sessao ausente no servidor." };
  }

  const token = String(params.ticket || "").trim();
  if (!token.includes(".")) {
    return { ok: false as const, error: "Sessao de exclusao invalida. Reabra o modal." };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return { ok: false as const, error: "Sessao de exclusao invalida. Reabra o modal." };
  }

  if (signTicket(payloadB64, secret) !== sig) {
    return { ok: false as const, error: "Sessao de exclusao invalida. Reabra o modal." };
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadB64)) as AccountDeleteTicketPayload;
    if (payload?.typ !== ACCOUNT_DELETE_TICKET_TYP) {
      return { ok: false as const, error: "Sessao de exclusao invalida. Reabra o modal." };
    }
    if (!payload?.uid || !payload?.sessionUid || !payload?.email || !payload?.phoneE164) {
      return { ok: false as const, error: "Sessao de exclusao invalida. Reabra o modal." };
    }
    if (payload.exp < Date.now()) {
      return { ok: false as const, error: "Sessao de exclusao expirada. Reabra o fluxo." };
    }
    if (!params.allowedPhases.includes(payload.phase)) {
      return { ok: false as const, error: "Etapa invalida para exclusao da conta." };
    }
    if (String(payload.sessionUid) !== String(params.sessionUserId || "").trim()) {
      return { ok: false as const, error: "Sessao de exclusao invalida para este usuario." };
    }
    if (normalizeEmail(payload.email) !== normalizeEmail(params.sessionEmail)) {
      return { ok: false as const, error: "Sessao desatualizada. Reabra o modal." };
    }
    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, error: "Sessao de exclusao invalida. Reabra o modal." };
  }
}

function isPasskeySchemaMissing(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
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

async function hasWindowsHelloPasskey(
  sb: ReturnType<typeof supabaseAdmin>,
  userId: string,
) {
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) return false;

  const { data, error } = await sb
    .from("wz_auth_passkeys")
    .select("credential_id")
    .eq("user_id", cleanUserId)
    .limit(1);

  if (!error) return Array.isArray(data) && data.length > 0;
  if (!isPasskeySchemaMissing(error)) {
    console.error("[account-delete] passkey lookup error:", error);
  }
  return false;
}

async function createChallenge(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  channel: "email" | "sms";
}) {
  await params.sb
    .from("wz_auth_challenges")
    .update({ consumed: true })
    .eq("email", params.email)
    .eq("channel", params.channel)
    .eq("consumed", false);

  const code = gen7();
  const salt = newSalt();
  const hash = sha(code, salt);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  const { error } = await params.sb.from("wz_auth_challenges").insert({
    email: params.email,
    channel: params.channel,
    code_hash: hash,
    salt,
    expires_at: expiresAt,
    attempts_left: 7,
    consumed: false,
  });

  if (error) throw new Error("Nao foi possivel gerar codigo de validacao.");
  return code;
}

async function verifyChallengeCode(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  channel: "email" | "sms";
  code: string;
  consumeOnSuccess?: boolean;
}) {
  const { data: challenge, error: challengeErr } = await params.sb
    .from("wz_auth_challenges")
    .select("*")
    .eq("email", params.email)
    .eq("channel", params.channel)
    .eq("consumed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (challengeErr || !challenge) {
    return { ok: false as const, status: 400, error: "Codigo expirado. Reenvie o codigo." };
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await params.sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", challenge.id);
    return { ok: false as const, status: 400, error: "Codigo expirado. Reenvie o codigo." };
  }

  if (Number(challenge.attempts_left) <= 0) {
    return { ok: false as const, status: 429, error: "Muitas tentativas. Reenvie o codigo." };
  }

  const providedHash = sha(params.code, challenge.salt);
  if (providedHash !== challenge.code_hash) {
    const nextAttempts = Math.max(0, Number(challenge.attempts_left) - 1);
    await params.sb
      .from("wz_auth_challenges")
      .update({
        attempts_left: nextAttempts,
        ...(nextAttempts <= 0 ? { consumed: true } : {}),
      })
      .eq("id", challenge.id);

    if (nextAttempts <= 0) {
      return {
        ok: false as const,
        status: 429,
        error:
          "Voce atingiu o limite de 7 tentativas. Reenvie o codigo, pois este nao e mais valido.",
      };
    }

    return {
      ok: false as const,
      status: 400,
      error: `Codigo invalido. Tente novamente. Restam ${nextAttempts} tentativa${nextAttempts === 1 ? "" : "s"}.`,
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

  const sb = supabaseAdmin();
  const lifecycle = await resolveAccountLifecycleBySession({
    sb,
    sessionUserId,
    sessionEmail,
  });
  if (!lifecycle) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Usuario nao encontrado." },
        { status: 404, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const syncedLifecycle = await syncAccountLifecycleIfNeeded({ sb, record: lifecycle });

  return {
    ok: true as const,
    ctx: {
      sb,
      sessionUserId,
      sessionEmail,
      lifecycle: syncedLifecycle,
    } satisfies SessionContext,
  };
}

function blockedLifecycleResponse(ctx: SessionContext) {
  const lifecycle = ctx.lifecycle;

  if (lifecycle.state === ACCOUNT_STATE_PENDING_DELETION) {
    return NextResponse.json(
      {
        ok: false,
        state: lifecycle.state,
        restoreDeadlineAt: lifecycle.restoreDeadlineAt,
        error: "Esta conta ja esta em exclusao. Reative em ate 14 dias, se desejar.",
      },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }

  if (lifecycle.state === ACCOUNT_STATE_DEACTIVATED) {
    return NextResponse.json(
      {
        ok: false,
        state: lifecycle.state,
        deactivatedAt: lifecycle.deactivatedAt,
        error: "Esta conta ja foi desativada e nao pode mais ser reativada.",
      },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }

  return null;
}

async function startDeleteFlow(ctx: SessionContext) {
  const blocked = blockedLifecycleResponse(ctx);
  if (blocked) return blocked;

  const email = ctx.sessionEmail;
  const phoneE164 = normalizePhoneE164(ctx.lifecycle?.phoneE164);
  if (!isValidE164BRMobile(phoneE164)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Para excluir a conta, cadastre um celular valido primeiro. Atualize seu numero e tente novamente.",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const emailCode = await createChallenge({
    sb: ctx.sb,
    email,
    channel: "email",
  });
  await sendLoginCodeEmail(email, emailCode, { heading: "Excluindo sua conta" });

  const ticket = createAccountDeleteTicket({
    userId: ctx.lifecycle?.id || "",
    sessionUserId: ctx.sessionUserId,
    email,
    phoneE164,
    phase: "verify-email",
  });

  return NextResponse.json(
    {
      ok: true,
      phase: "verify-email",
      ticket,
      emailMask: maskEmail(email),
      phoneMask: maskPhoneE164(phoneE164),
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

async function resendDeleteFlow(req: NextRequest, ctx: SessionContext) {
  const blocked = blockedLifecycleResponse(ctx);
  if (blocked) return blocked;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ticketRes = readAccountDeleteTicket({
    ticket: String(body.ticket || ""),
    sessionUserId: ctx.sessionUserId,
    sessionEmail: ctx.sessionEmail,
    allowedPhases: ["verify-email", "verify-sms"],
  });
  if (!ticketRes.ok) {
    return NextResponse.json(
      { ok: false, error: ticketRes.error },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const resendChannelRaw = String(body.channel || "").trim().toLowerCase();
  const phase = ticketRes.payload.phase;
  const resendChannel =
    resendChannelRaw === "sms" || resendChannelRaw === "email"
      ? resendChannelRaw
      : phase === "verify-email"
        ? "email"
        : "sms";

  if (phase === "verify-email" && resendChannel !== "email") {
    return NextResponse.json(
      { ok: false, error: "Reenvio de SMS disponivel somente apos validar o e-mail." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (phase === "verify-sms" && resendChannel !== "sms") {
    return NextResponse.json(
      { ok: false, error: "Reenvio de e-mail disponivel apenas na etapa inicial." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (resendChannel === "email") {
    const emailCode = await createChallenge({
      sb: ctx.sb,
      email: ctx.sessionEmail,
      channel: "email",
    });
    await sendLoginCodeEmail(ctx.sessionEmail, emailCode, { heading: "Excluindo sua conta" });
  } else {
    const phoneE164 = normalizePhoneE164(ticketRes.payload.phoneE164);
    if (!isValidE164BRMobile(phoneE164)) {
      return NextResponse.json(
        { ok: false, error: "Telefone invalido para reenvio de SMS." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    const smsCode = await createChallenge({
      sb: ctx.sb,
      email: ctx.sessionEmail,
      channel: "sms",
    });
    await sendSmsCode(phoneE164, smsCode);
  }

  const refreshedTicket = createAccountDeleteTicket({
    userId: ticketRes.payload.uid,
    sessionUserId: ctx.sessionUserId,
    email: ctx.sessionEmail,
    phoneE164: ticketRes.payload.phoneE164,
    phase,
  });

  return NextResponse.json(
    {
      ok: true,
      phase,
      ticket: refreshedTicket,
      emailMask: maskEmail(ctx.sessionEmail),
      phoneMask: maskPhoneE164(ticketRes.payload.phoneE164),
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

async function verifyDeleteFlow(req: NextRequest, ctx: SessionContext) {
  const blocked = blockedLifecycleResponse(ctx);
  if (blocked) return blocked;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ticketRes = readAccountDeleteTicket({
    ticket: String(body.ticket || ""),
    sessionUserId: ctx.sessionUserId,
    sessionEmail: ctx.sessionEmail,
    allowedPhases: ["verify-email", "verify-sms", "verify-auth"],
  });
  if (!ticketRes.ok) {
    return NextResponse.json(
      { ok: false, error: ticketRes.error },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (ticketRes.payload.phase === "verify-email") {
    const emailCode = onlyDigits(String(body.emailCode || body.code || "")).slice(0, 7);
    if (emailCode.length !== 7) {
      return NextResponse.json(
        { ok: false, error: "Digite o codigo de 7 digitos enviado para seu e-mail." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const verifyCode = await verifyChallengeCode({
      sb: ctx.sb,
      email: ctx.sessionEmail,
      channel: "email",
      code: emailCode,
      consumeOnSuccess: false,
    });
    if (!verifyCode.ok) {
      return NextResponse.json(
        { ok: false, error: verifyCode.error },
        { status: verifyCode.status, headers: NO_STORE_HEADERS },
      );
    }

    const { error: consumeError } = await ctx.sb
      .from("wz_auth_challenges")
      .update({ consumed: true })
      .eq("id", verifyCode.challengeId);
    if (consumeError) {
      console.error("[account-delete] consume email challenge error:", consumeError);
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel confirmar o codigo. Tente novamente." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const smsCode = await createChallenge({
      sb: ctx.sb,
      email: ctx.sessionEmail,
      channel: "sms",
    });
    await sendSmsCode(ticketRes.payload.phoneE164, smsCode);

    const smsTicket = createAccountDeleteTicket({
      userId: ticketRes.payload.uid,
      sessionUserId: ctx.sessionUserId,
      email: ctx.sessionEmail,
      phoneE164: ticketRes.payload.phoneE164,
      phase: "verify-sms",
    });

    return NextResponse.json(
      {
        ok: true,
        next: "verify-sms",
        phase: "verify-sms",
        ticket: smsTicket,
        phoneMask: maskPhoneE164(ticketRes.payload.phoneE164),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  }

  if (ticketRes.payload.phase === "verify-sms") {
    const smsCode = onlyDigits(String(body.smsCode || body.code || "")).slice(0, 7);
    if (smsCode.length !== 7) {
      return NextResponse.json(
        { ok: false, error: "Digite o codigo de 7 digitos enviado por SMS." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const verifyCode = await verifyChallengeCode({
      sb: ctx.sb,
      email: ctx.sessionEmail,
      channel: "sms",
      code: smsCode,
      consumeOnSuccess: false,
    });
    if (!verifyCode.ok) {
      return NextResponse.json(
        { ok: false, error: verifyCode.error },
        { status: verifyCode.status, headers: NO_STORE_HEADERS },
      );
    }

    const { error: consumeError } = await ctx.sb
      .from("wz_auth_challenges")
      .update({ consumed: true })
      .eq("id", verifyCode.challengeId);
    if (consumeError) {
      console.error("[account-delete] consume sms challenge error:", consumeError);
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel confirmar o codigo SMS. Tente novamente." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const twoFactorState = await resolveTwoFactorState({
      sb: ctx.sb,
      sessionUserId: ctx.sessionUserId,
      wzUserId: ctx.lifecycle?.id || "",
    });
    const hasTotp = Boolean(twoFactorState.enabled && twoFactorState.secret);
    const hasPasskey = await hasWindowsHelloPasskey(ctx.sb, ctx.sessionUserId);

    if (!hasTotp && !hasPasskey) {
      const marked = await markAccountPendingDeletion({
        sb: ctx.sb,
        userId: ctx.lifecycle?.id || "",
      });
      return NextResponse.json(
        {
          ok: true,
          deleted: true,
          state: ACCOUNT_STATE_PENDING_DELETION,
          restoreDeadlineAt: marked.restoreDeadlineAt,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const verifyAuthTicket = createAccountDeleteTicket({
      userId: ticketRes.payload.uid,
      sessionUserId: ctx.sessionUserId,
      email: ctx.sessionEmail,
      phoneE164: ticketRes.payload.phoneE164,
      phase: "verify-auth",
    });

    return NextResponse.json(
      {
        ok: true,
        next: "verify-auth",
        phase: "verify-auth",
        ticket: verifyAuthTicket,
        authMethods: { totp: hasTotp, passkey: hasPasskey },
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  }

  const twoFactorState = await resolveTwoFactorState({
    sb: ctx.sb,
    sessionUserId: ctx.sessionUserId,
    wzUserId: ctx.lifecycle?.id || "",
  });
  const hasTotp = Boolean(twoFactorState.enabled && twoFactorState.secret);
  const hasPasskey = await hasWindowsHelloPasskey(ctx.sb, ctx.sessionUserId);
  const authMethods = { totp: hasTotp, passkey: hasPasskey };

  const twoFactorCode = normalizeTotpCode(body.twoFactorCode ?? body.totpCode ?? body.code, 6);
  const passkeyProofRaw = String(body.passkeyProof ?? body.authProof ?? "").trim();
  const passkeyProofRes = passkeyProofRaw
    ? readPasskeyAuthProof({
        proof: passkeyProofRaw,
        userId: ctx.sessionUserId,
        email: ctx.sessionEmail,
      })
    : null;

  const hasValidPasskeyProof = Boolean(passkeyProofRes?.ok);
  const canUseTotpCode = hasTotp && twoFactorCode.length === 6;

  if (!hasValidPasskeyProof && !canUseTotpCode) {
    const fallbackMessage =
      passkeyProofRaw && passkeyProofRes && !passkeyProofRes.ok
        ? passkeyProofRes.error
        : hasTotp
          ? "Confirme com codigo de 2 etapas ou Windows Hello."
          : "Confirme com Windows Hello para continuar.";
    return NextResponse.json(
      {
        ok: false,
        requiresTwoFactor: true,
        requiresPasskey: hasPasskey,
        authMethods,
        error: fallbackMessage,
      },
      { status: 428, headers: NO_STORE_HEADERS },
    );
  }

  if (canUseTotpCode && twoFactorState.secret) {
    const validTwoFactorCode = await verifyTwoFactorCodeWithRecovery({
      sb: ctx.sb,
      userId: ctx.sessionUserId,
      secret: twoFactorState.secret,
      code: twoFactorCode,
    });
    if (!validTwoFactorCode.ok) {
      return NextResponse.json(
        {
          ok: false,
          requiresTwoFactor: true,
          requiresPasskey: hasPasskey,
          authMethods,
          error: "Codigo de 2 etapas invalido. Tente novamente.",
        },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }
  }

  const marked = await markAccountPendingDeletion({
    sb: ctx.sb,
    userId: ctx.lifecycle?.id || "",
  });

  return NextResponse.json(
    {
      ok: true,
      deleted: true,
      state: ACCOUNT_STATE_PENDING_DELETION,
      restoreDeadlineAt: marked.restoreDeadlineAt,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;
    return await startDeleteFlow(base.ctx);
  } catch (error) {
    console.error("[account-delete] start error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao iniciar exclusao da conta." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;
    return await resendDeleteFlow(req, base.ctx);
  } catch (error) {
    console.error("[account-delete] resend error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao reenviar codigo da exclusao." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;
    return await verifyDeleteFlow(req, base.ctx);
  } catch (error) {
    console.error("[account-delete] verify error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao confirmar exclusao da conta." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
