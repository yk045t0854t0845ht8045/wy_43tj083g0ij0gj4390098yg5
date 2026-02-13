import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { gen7, maskEmail, newSalt, onlyDigits, sha } from "@/app/api/wz_AuthLogin/_codes";
import { sendLoginCodeEmail } from "@/app/api/wz_AuthLogin/_email";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  ACCOUNT_STATE_ACTIVE,
  ACCOUNT_STATE_DEACTIVATED,
  ACCOUNT_STATE_PENDING_DELETION,
  canReactivateWithinWindow,
  markAccountRestored,
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

const ACCOUNT_REACTIVATE_TICKET_TYP = "wz-account-reactivate";

type AccountReactivateTicketPhase = "verify-email" | "verify-auth";

type AccountReactivateTicketPayload = {
  typ: "wz-account-reactivate";
  uid: string;
  sessionUid: string;
  email: string;
  phase: AccountReactivateTicketPhase;
  iat: number;
  exp: number;
  nonce: string;
};

type SessionContext = {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  sessionEmail: string;
  lifecycle: Awaited<ReturnType<typeof resolveAccountLifecycleBySession>>;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
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

function createAccountReactivateTicket(params: {
  userId: string;
  sessionUserId: string;
  email: string;
  phase: AccountReactivateTicketPhase;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const now = Date.now();
  const payload: AccountReactivateTicketPayload = {
    typ: ACCOUNT_REACTIVATE_TICKET_TYP,
    uid: String(params.userId || "").trim(),
    sessionUid: String(params.sessionUserId || "").trim(),
    email: normalizeEmail(params.email),
    phase: params.phase,
    iat: now,
    exp: now + Number(params.ttlMs ?? 1000 * 60 * 12),
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = normalizeBase64Url(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function readAccountReactivateTicket(params: {
  ticket: string;
  sessionUserId: string;
  sessionEmail: string;
  allowedPhases: AccountReactivateTicketPhase[];
}) {
  const secret = getTicketSecret();
  if (!secret) {
    return { ok: false as const, error: "Configuracao de sessao ausente no servidor." };
  }

  const token = String(params.ticket || "").trim();
  if (!token.includes(".")) {
    return { ok: false as const, error: "Sessao de reativacao invalida. Reabra o fluxo." };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return { ok: false as const, error: "Sessao de reativacao invalida. Reabra o fluxo." };
  }
  if (signTicket(payloadB64, secret) !== sig) {
    return { ok: false as const, error: "Sessao de reativacao invalida. Reabra o fluxo." };
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadB64)) as AccountReactivateTicketPayload;
    if (payload?.typ !== ACCOUNT_REACTIVATE_TICKET_TYP) {
      return { ok: false as const, error: "Sessao de reativacao invalida. Reabra o fluxo." };
    }
    if (!payload?.uid || !payload?.sessionUid || !payload?.email) {
      return { ok: false as const, error: "Sessao de reativacao invalida. Reabra o fluxo." };
    }
    if (payload.exp < Date.now()) {
      return { ok: false as const, error: "Sessao de reativacao expirada. Inicie novamente." };
    }
    if (!params.allowedPhases.includes(payload.phase)) {
      return { ok: false as const, error: "Etapa invalida para reativacao da conta." };
    }
    if (String(payload.sessionUid) !== String(params.sessionUserId || "").trim()) {
      return { ok: false as const, error: "Sessao de reativacao invalida para este usuario." };
    }
    if (normalizeEmail(payload.email) !== normalizeEmail(params.sessionEmail)) {
      return { ok: false as const, error: "Sessao desatualizada. Inicie novamente." };
    }
    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, error: "Sessao de reativacao invalida. Reabra o fluxo." };
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
    console.error("[account-reactivate] passkey lookup error:", error);
  }
  return false;
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

  if (error) throw new Error("Nao foi possivel gerar codigo de validacao.");
  return code;
}

async function verifyEmailChallengeCode(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  code: string;
  consumeOnSuccess?: boolean;
}) {
  const { data: challenge, error: challengeErr } = await params.sb
    .from("wz_auth_challenges")
    .select("*")
    .eq("email", params.email)
    .eq("channel", "email")
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

function lifecycleBlockedResponse(ctx: SessionContext) {
  if (ctx.lifecycle?.state === ACCOUNT_STATE_ACTIVE) {
    return NextResponse.json(
      { ok: false, state: ACCOUNT_STATE_ACTIVE, error: "Esta conta ja esta ativa." },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }

  if (ctx.lifecycle?.state === ACCOUNT_STATE_DEACTIVATED) {
    return NextResponse.json(
      {
        ok: false,
        state: ACCOUNT_STATE_DEACTIVATED,
        deactivatedAt: ctx.lifecycle.deactivatedAt,
        error: "O prazo de reativacao terminou. Esta conta nao pode mais ser restaurada.",
      },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }

  if (!canReactivateWithinWindow(ctx.lifecycle!, Date.now())) {
    return NextResponse.json(
      {
        ok: false,
        state: ctx.lifecycle?.state,
        restoreDeadlineAt: ctx.lifecycle?.restoreDeadlineAt || null,
        error: "O prazo de 14 dias para reativacao expirou.",
      },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }

  return null;
}

async function resolveAuthMethods(ctx: SessionContext) {
  const twoFactorState = await resolveTwoFactorState({
    sb: ctx.sb,
    sessionUserId: ctx.sessionUserId,
    wzUserId: ctx.lifecycle?.id || "",
  });
  const hasTotp = Boolean(twoFactorState.enabled && twoFactorState.secret);
  const hasPasskey = await hasWindowsHelloPasskey(ctx.sb, ctx.sessionUserId);
  return {
    hasTotp,
    hasPasskey,
    authMethods: { totp: hasTotp, passkey: hasPasskey },
    twoFactorState,
  };
}

export async function GET(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;

    const lifecycle = base.ctx.lifecycle;
    const canReactivate = lifecycle ? canReactivateWithinWindow(lifecycle) : false;
    const methods = canReactivate ? await resolveAuthMethods(base.ctx) : null;

    return NextResponse.json(
      {
        ok: true,
        state: lifecycle?.state || null,
        emailMask: maskEmail(base.ctx.sessionEmail),
        restoreDeadlineAt: lifecycle?.restoreDeadlineAt || null,
        deactivatedAt: lifecycle?.deactivatedAt || null,
        canReactivate,
        authMethods: methods?.authMethods || { totp: false, passkey: false },
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[account-reactivate] status error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao consultar status de reativacao." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;

    const blocked = lifecycleBlockedResponse(base.ctx);
    if (blocked) return blocked;

    const code = await createEmailChallenge(base.ctx.sb, base.ctx.sessionEmail);
    await sendLoginCodeEmail(base.ctx.sessionEmail, code, { heading: "Reativando sua conta" });

    const ticket = createAccountReactivateTicket({
      userId: base.ctx.lifecycle?.id || "",
      sessionUserId: base.ctx.sessionUserId,
      email: base.ctx.sessionEmail,
      phase: "verify-email",
    });

    return NextResponse.json(
      {
        ok: true,
        phase: "verify-email",
        ticket,
        emailMask: maskEmail(base.ctx.sessionEmail),
        restoreDeadlineAt: base.ctx.lifecycle?.restoreDeadlineAt || null,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[account-reactivate] start error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao iniciar reativacao da conta." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;

    const blocked = lifecycleBlockedResponse(base.ctx);
    if (blocked) return blocked;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ticketRes = readAccountReactivateTicket({
      ticket: String(body.ticket || ""),
      sessionUserId: base.ctx.sessionUserId,
      sessionEmail: base.ctx.sessionEmail,
      allowedPhases: ["verify-email"],
    });
    if (!ticketRes.ok) {
      return NextResponse.json(
        { ok: false, error: ticketRes.error },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const code = await createEmailChallenge(base.ctx.sb, base.ctx.sessionEmail);
    await sendLoginCodeEmail(base.ctx.sessionEmail, code, { heading: "Reativando sua conta" });

    const refreshedTicket = createAccountReactivateTicket({
      userId: ticketRes.payload.uid,
      sessionUserId: base.ctx.sessionUserId,
      email: base.ctx.sessionEmail,
      phase: "verify-email",
    });

    return NextResponse.json(
      {
        ok: true,
        phase: "verify-email",
        ticket: refreshedTicket,
        emailMask: maskEmail(base.ctx.sessionEmail),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[account-reactivate] resend error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao reenviar codigo de reativacao." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const base = await getSessionContext(req);
    if (!base.ok) return base.response;

    const blocked = lifecycleBlockedResponse(base.ctx);
    if (blocked) return blocked;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ticketRes = readAccountReactivateTicket({
      ticket: String(body.ticket || ""),
      sessionUserId: base.ctx.sessionUserId,
      sessionEmail: base.ctx.sessionEmail,
      allowedPhases: ["verify-email", "verify-auth"],
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

      const verifyCode = await verifyEmailChallengeCode({
        sb: base.ctx.sb,
        email: base.ctx.sessionEmail,
        code: emailCode,
        consumeOnSuccess: false,
      });
      if (!verifyCode.ok) {
        return NextResponse.json(
          { ok: false, error: verifyCode.error },
          { status: verifyCode.status, headers: NO_STORE_HEADERS },
        );
      }

      const { error: consumeError } = await base.ctx.sb
        .from("wz_auth_challenges")
        .update({ consumed: true })
        .eq("id", verifyCode.challengeId);
      if (consumeError) {
        console.error("[account-reactivate] consume email challenge error:", consumeError);
        return NextResponse.json(
          { ok: false, error: "Nao foi possivel confirmar o codigo. Tente novamente." },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      const methods = await resolveAuthMethods(base.ctx);
      if (!methods.hasTotp && !methods.hasPasskey) {
        const restored = await markAccountRestored({
          sb: base.ctx.sb,
          userId: base.ctx.lifecycle?.id || "",
        });
        return NextResponse.json(
          {
            ok: true,
            restored: true,
            state: ACCOUNT_STATE_ACTIVE,
            restoredAt: restored.restoredAt,
          },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }

      const authTicket = createAccountReactivateTicket({
        userId: ticketRes.payload.uid,
        sessionUserId: base.ctx.sessionUserId,
        email: base.ctx.sessionEmail,
        phase: "verify-auth",
      });

      return NextResponse.json(
        {
          ok: true,
          next: "verify-auth",
          phase: "verify-auth",
          ticket: authTicket,
          authMethods: methods.authMethods,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const methods = await resolveAuthMethods(base.ctx);
    const twoFactorCode = normalizeTotpCode(body.twoFactorCode ?? body.totpCode ?? body.code, 6);
    const passkeyProofRaw = String(body.passkeyProof ?? body.authProof ?? "").trim();
    const passkeyProofRes = passkeyProofRaw
      ? readPasskeyAuthProof({
          proof: passkeyProofRaw,
          userId: base.ctx.sessionUserId,
          email: base.ctx.sessionEmail,
        })
      : null;

    const hasValidPasskeyProof = Boolean(passkeyProofRes?.ok);
    const canUseTotpCode = methods.hasTotp && twoFactorCode.length === 6;

    if (!hasValidPasskeyProof && !canUseTotpCode) {
      const fallbackMessage =
        passkeyProofRaw && passkeyProofRes && !passkeyProofRes.ok
          ? passkeyProofRes.error
          : methods.hasTotp
            ? "Confirme com codigo de 2 etapas ou Windows Hello."
            : "Confirme com Windows Hello para continuar.";
      return NextResponse.json(
        {
          ok: false,
          requiresTwoFactor: true,
          requiresPasskey: methods.hasPasskey,
          authMethods: methods.authMethods,
          error: fallbackMessage,
        },
        { status: 428, headers: NO_STORE_HEADERS },
      );
    }

    if (canUseTotpCode && methods.twoFactorState.secret) {
      const validTwoFactorCode = await verifyTwoFactorCodeWithRecovery({
        sb: base.ctx.sb,
        userId: base.ctx.sessionUserId,
        secret: methods.twoFactorState.secret,
        code: twoFactorCode,
      });
      if (!validTwoFactorCode.ok) {
        return NextResponse.json(
          {
            ok: false,
            requiresTwoFactor: true,
            requiresPasskey: methods.hasPasskey,
            authMethods: methods.authMethods,
            error: "Codigo de 2 etapas invalido. Tente novamente.",
          },
          { status: 401, headers: NO_STORE_HEADERS },
        );
      }
    }

    const restored = await markAccountRestored({
      sb: base.ctx.sb,
      userId: base.ctx.lifecycle?.id || "",
    });
    return NextResponse.json(
      {
        ok: true,
        restored: true,
        state: ACCOUNT_STATE_ACTIVE,
        restoredAt: restored.restoredAt,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[account-reactivate] verify error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao confirmar reativacao da conta." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
