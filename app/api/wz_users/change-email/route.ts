import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { gen7, newSalt, sha } from "@/app/api/wz_AuthLogin/_codes";
import { sendLoginCodeEmail } from "@/app/api/wz_AuthLogin/_email";
import { readSessionFromRequest, setSessionCookie } from "@/app/api/wz_AuthLogin/_session";
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

type EmailChangePhase = "verify-current" | "set-new" | "verify-new";

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  full_name?: string | null;
  auth_user_id?: string | null;
  user_id?: string | null;
};

type EmailChangeTicketPayload = {
  typ: "wz-change-email";
  uid: string;
  currentEmail: string;
  phase: EmailChangePhase;
  nextEmail?: string;
  iat: number;
  exp: number;
  nonce: string;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
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

function onlyDigits(value: string) {
  return String(value || "").replace(/\D+/g, "");
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

  if (!error) {
    return Array.isArray(data) && data.length > 0;
  }

  if (!isPasskeySchemaMissing(error)) {
    console.error("[change-email] passkey lookup error:", error);
  }
  return false;
}

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const padded = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + "=".repeat(padLen);
  return Buffer.from(withPad, "base64").toString("utf8");
}

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

function createEmailChangeTicket(params: {
  userId: string;
  currentEmail: string;
  phase: EmailChangePhase;
  nextEmail?: string | null;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const now = Date.now();
  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 10);
  const normalizedNextEmail = normalizeEmail(params.nextEmail);

  const payload: EmailChangeTicketPayload = {
    typ: "wz-change-email",
    uid: String(params.userId || "").trim(),
    currentEmail: normalizeEmail(params.currentEmail),
    phase: params.phase,
    ...(params.phase === "verify-new" && normalizedNextEmail
      ? { nextEmail: normalizedNextEmail }
      : {}),
    iat: now,
    exp: now + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function readEmailChangeTicket(params: {
  ticket: string;
  sessionUserId: string;
  sessionEmail: string;
}) {
  const secret = getTicketSecret();
  if (!secret) {
    return {
      ok: false as const,
      error: "Configuracao de sessao ausente no servidor.",
    };
  }

  const token = String(params.ticket || "").trim();
  if (!token.includes(".")) {
    return {
      ok: false as const,
      error: "Sessao de alteracao invalida. Reabra o modal.",
    };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return {
      ok: false as const,
      error: "Sessao de alteracao invalida. Reabra o modal.",
    };
  }

  const expectedSig = signTicket(payloadB64, secret);
  if (expectedSig !== sig) {
    return {
      ok: false as const,
      error: "Sessao de alteracao invalida. Reabra o modal.",
    };
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as EmailChangeTicketPayload;
    if (parsed?.typ !== "wz-change-email") {
      return {
        ok: false as const,
        error: "Sessao de alteracao invalida. Reabra o modal.",
      };
    }

    if (!parsed?.uid || parsed.exp < Date.now()) {
      return {
        ok: false as const,
        error: "Sessao de alteracao expirada. Reabra o fluxo e tente novamente.",
      };
    }

    if (
      parsed.phase !== "verify-current" &&
      parsed.phase !== "set-new" &&
      parsed.phase !== "verify-new"
    ) {
      return {
        ok: false as const,
        error: "Etapa de alteracao invalida. Reabra o modal.",
      };
    }

    if (String(parsed.uid) !== String(params.sessionUserId)) {
      return {
        ok: false as const,
        error: "Sessao de alteracao invalida para este usuario.",
      };
    }

    if (normalizeEmail(parsed.currentEmail) !== normalizeEmail(params.sessionEmail)) {
      return {
        ok: false as const,
        error: "Sessao desatualizada. Reabra o modal para continuar.",
      };
    }

    if (parsed.phase === "verify-new") {
      const nextEmail = normalizeEmail(parsed.nextEmail);
      if (!isValidEmail(nextEmail)) {
        return {
          ok: false as const,
          error: "E-mail de destino invalido.",
        };
      }
      parsed.nextEmail = nextEmail;
    }

    return { ok: true as const, payload: parsed };
  } catch {
    return {
      ok: false as const,
      error: "Sessao de alteracao invalida. Reabra o modal.",
    };
  }
}

function isUniqueViolation(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key") || message.includes("already registered");
}

function isMissingColumnError(error: unknown, column: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  const needle = String(column || "").trim().toLowerCase();

  if (!needle) return false;
  if (code === "42703") return true;
  if (code === "PGRST204") return true;
  return (
    (message.includes(needle) || details.includes(needle) || hint.includes(needle)) &&
    (message.includes("column") || details.includes("column") || hint.includes("column"))
  );
}

async function updateWzUserEmailRecord(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  nextEmail: string;
}) {
  const emailChangedAt = new Date().toISOString();
  const primaryUpdate = await params.sb
    .from("wz_users")
    .update({ email: params.nextEmail, email_changed_at: emailChangedAt })
    .eq("id", params.userId);

  if (!primaryUpdate.error) {
    return { error: null as unknown, emailChangedAt };
  }

  if (!isMissingColumnError(primaryUpdate.error, "email_changed_at")) {
    return { error: primaryUpdate.error, emailChangedAt: null as string | null };
  }

  const fallbackUpdate = await params.sb
    .from("wz_users")
    .update({ email: params.nextEmail })
    .eq("id", params.userId);

  return {
    error: fallbackUpdate.error,
    emailChangedAt: fallbackUpdate.error ? null : emailChangedAt,
  };
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const columnsToTry = [
    "id,email,full_name,auth_user_id,user_id",
    "id,email,full_name,auth_user_id",
    "id,email,full_name,user_id",
    "id,email,full_name",
    "id,email",
  ];

  for (const columns of columnsToTry) {
    const base = params.sb.from("wz_users").select(columns).limit(5);
    const res =
      params.mode === "ilike"
        ? await base.ilike(params.column, params.value)
        : await base.eq(params.column, params.value);

    if (!res.error) {
      const rows = (res.data || []) as unknown as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: normalizeOptionalText(String(row.id || "")),
        email: normalizeOptionalText(String(row.email || "")),
        full_name: normalizeOptionalText(String(row.full_name || "")),
        auth_user_id: normalizeOptionalText(String(row.auth_user_id || "")),
        user_id: normalizeOptionalText(String(row.user_id || "")),
      })) as WzUserRow[];
    }
  }

  return [] as WzUserRow[];
}

function pickBestRow(rows: WzUserRow[], expectedEmail?: string | null) {
  if (!rows.length) return null;

  const normalizedExpected = normalizeEmail(expectedEmail);
  if (normalizedExpected) {
    const exact = rows.find((row) => normalizeEmail(row.email) === normalizedExpected);
    if (exact?.id) return exact;
  }

  const firstWithId = rows.find((row) => normalizeOptionalText(row.id));
  return firstWithId || null;
}

async function findWzUserRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  email: string;
}) {
  if (params.email) {
    const byEmail = await queryWzUsersRows({
      sb: params.sb,
      column: "email",
      value: params.email,
      mode: "ilike",
    });
    const best = pickBestRow(byEmail, params.email);
    if (best?.id) return best;
  }

  if (params.userId) {
    const byAuthUserId = await queryWzUsersRows({
      sb: params.sb,
      column: "auth_user_id",
      value: params.userId,
      mode: "eq",
    });
    const bestByAuthUserId = pickBestRow(byAuthUserId, params.email);
    if (bestByAuthUserId?.id) return bestByAuthUserId;

    const byUserId = await queryWzUsersRows({
      sb: params.sb,
      column: "user_id",
      value: params.userId,
      mode: "eq",
    });
    const bestByUserId = pickBestRow(byUserId, params.email);
    if (bestByUserId?.id) return bestByUserId;

    const byId = await queryWzUsersRows({
      sb: params.sb,
      column: "id",
      value: params.userId,
      mode: "eq",
    });
    const bestById = pickBestRow(byId, params.email);
    if (bestById?.id) return bestById;
  }

  return null;
}

async function findAuthUserIdByEmail(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
) {
  const target = normalizeEmail(email);
  if (!target) return null;

  const PER_PAGE = 200;
  const MAX_PAGES = 20;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });

    if (error) {
      console.error("[change-email] listUsers error:", error);
      return null;
    }

    const users = (data?.users || []) as Array<{ id?: string | null; email?: string | null }>;
    const found = users.find((u) => normalizeEmail(u.email) === target);
    if (found?.id) return String(found.id);
    if (users.length < PER_PAGE) break;
  }

  return null;
}

async function resolveCurrentAuthUserId(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userRow: WzUserRow;
  sessionEmail: string;
}) {
  const byRow = normalizeOptionalText(params.userRow.auth_user_id);
  if (byRow) return byRow;

  const bySessionEmail = await findAuthUserIdByEmail(params.sb, params.sessionEmail);
  if (bySessionEmail) return bySessionEmail;

  const byRowEmail = await findAuthUserIdByEmail(params.sb, normalizeEmail(params.userRow.email));
  if (byRowEmail) return byRowEmail;

  return null;
}

async function ensureEmailAvailable(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  nextEmail: string;
}) {
  const { data, error } = await params.sb
    .from("wz_users")
    .select("id")
    .ilike("email", params.nextEmail)
    .neq("id", params.userId)
    .limit(1);

  if (error) {
    return { ok: false as const, error: "Falha ao validar disponibilidade do e-mail." };
  }

  if ((data || []).length > 0) {
    return { ok: false as const, error: "Este e-mail ja esta em uso por outra conta." };
  }

  return { ok: true as const };
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

  if (error) {
    throw new Error("Nao foi possivel gerar o codigo de verificacao.");
  }

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
    return {
      ok: false as const,
      status: 400,
      error: "Codigo expirado. Reenvie o codigo.",
    };
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await params.sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", challenge.id);
    return {
      ok: false as const,
      status: 400,
      error: "Codigo expirado. Reenvie o codigo.",
    };
  }

  if (Number(challenge.attempts_left) <= 0) {
    return {
      ok: false as const,
      status: 429,
      error: "Muitas tentativas. Reenvie o codigo.",
    };
  }

  const hash = sha(params.code, challenge.salt);
  if (hash !== challenge.code_hash) {
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

async function getSessionAndUser(req: NextRequest) {
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
  const userRow = await findWzUserRow({
    sb,
    userId: sessionUserId,
    email: sessionEmail,
  });

  if (!userRow?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Usuario nao encontrado." },
        { status: 404, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    sb,
    session,
    sessionUserId,
    sessionEmail,
    userRow,
  };
}

export async function POST(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const code = await createEmailChallenge(base.sb, base.sessionEmail);
    await sendLoginCodeEmail(base.sessionEmail, code, { heading: "Alterando seu e-mail" });

    const ticket = createEmailChangeTicket({
      userId: String(base.userRow.id),
      currentEmail: base.sessionEmail,
      phase: "verify-current",
    });

    return NextResponse.json(
      { ok: true, ticket, phase: "verify-current", currentEmail: base.sessionEmail },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[change-email] start error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao iniciar alteracao de e-mail." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const body = await req.json().catch(() => ({}));
    const ticketRes = readEmailChangeTicket({
      ticket: String(body?.ticket || ""),
      sessionUserId: base.sessionUserId,
      sessionEmail: base.sessionEmail,
    });
    if (!ticketRes.ok) {
      return NextResponse.json(
        { ok: false, error: ticketRes.error },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const requestedNewEmail = normalizeEmail(body?.newEmail);

    if (requestedNewEmail) {
      if (ticketRes.payload.phase !== "set-new") {
        return NextResponse.json(
          { ok: false, error: "Valide primeiro o e-mail atual." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      if (!isValidEmail(requestedNewEmail)) {
        return NextResponse.json(
          { ok: false, error: "E-mail invalido." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      if (requestedNewEmail === base.sessionEmail) {
        return NextResponse.json(
          { ok: false, error: "Informe um e-mail diferente do atual." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const available = await ensureEmailAvailable({
        sb: base.sb,
        userId: String(base.userRow.id),
        nextEmail: requestedNewEmail,
      });
      if (!available.ok) {
        return NextResponse.json(
          { ok: false, error: available.error },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const currentAuthUserId = await resolveCurrentAuthUserId({
        sb: base.sb,
        userRow: base.userRow,
        sessionEmail: base.sessionEmail,
      });
      if (!currentAuthUserId) {
        return NextResponse.json(
          { ok: false, error: "Nao foi possivel localizar seu acesso de autenticacao." },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      const nextAuthUserId = await findAuthUserIdByEmail(base.sb, requestedNewEmail);
      if (nextAuthUserId && nextAuthUserId !== currentAuthUserId) {
        return NextResponse.json(
          { ok: false, error: "Este e-mail ja esta vinculado a outro acesso." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const code = await createEmailChallenge(base.sb, requestedNewEmail);
      await sendLoginCodeEmail(requestedNewEmail, code, { heading: "Alterando seu e-mail" });

      const ticket = createEmailChangeTicket({
        userId: String(base.userRow.id),
        currentEmail: base.sessionEmail,
        phase: "verify-new",
        nextEmail: requestedNewEmail,
      });

      return NextResponse.json(
        { ok: true, ticket, phase: "verify-new", nextEmail: requestedNewEmail },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (ticketRes.payload.phase === "set-new") {
      return NextResponse.json(
        { ok: false, error: "Informe o novo e-mail antes de reenviar codigo." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const resendToEmail =
      ticketRes.payload.phase === "verify-current"
        ? base.sessionEmail
        : normalizeEmail(ticketRes.payload.nextEmail);

    if (!isValidEmail(resendToEmail)) {
      return NextResponse.json(
        { ok: false, error: "E-mail de destino invalido para reenvio." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (ticketRes.payload.phase === "verify-new") {
      const available = await ensureEmailAvailable({
        sb: base.sb,
        userId: String(base.userRow.id),
        nextEmail: resendToEmail,
      });
      if (!available.ok) {
        return NextResponse.json(
          { ok: false, error: available.error },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
    }

    const code = await createEmailChallenge(base.sb, resendToEmail);
    await sendLoginCodeEmail(resendToEmail, code, { heading: "Alterando seu e-mail" });

    const refreshedTicket = createEmailChangeTicket({
      userId: String(base.userRow.id),
      currentEmail: base.sessionEmail,
      phase: ticketRes.payload.phase,
      nextEmail: ticketRes.payload.nextEmail,
    });

    return NextResponse.json(
      {
        ok: true,
        ticket: refreshedTicket,
        phase: ticketRes.payload.phase,
        ...(ticketRes.payload.phase === "verify-new"
          ? { nextEmail: ticketRes.payload.nextEmail }
          : {}),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[change-email] patch error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao processar alteracao de e-mail." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const body = await req.json().catch(() => ({}));
    const ticketRes = readEmailChangeTicket({
      ticket: String(body?.ticket || ""),
      sessionUserId: base.sessionUserId,
      sessionEmail: base.sessionEmail,
    });
    if (!ticketRes.ok) {
      return NextResponse.json(
        { ok: false, error: ticketRes.error },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const code = onlyDigits(String(body?.code || "")).slice(0, 7);
    if (code.length !== 7) {
      return NextResponse.json(
        { ok: false, error: "Codigo invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (ticketRes.payload.phase === "verify-current") {
      const verifyCurrent = await verifyEmailChallengeCode({
        sb: base.sb,
        email: base.sessionEmail,
        code,
      });
      if (!verifyCurrent.ok) {
        return NextResponse.json(
          { ok: false, error: verifyCurrent.error },
          { status: verifyCurrent.status, headers: NO_STORE_HEADERS },
        );
      }

      const nextTicket = createEmailChangeTicket({
        userId: String(base.userRow.id),
        currentEmail: base.sessionEmail,
        phase: "set-new",
      });

      return NextResponse.json(
        { ok: true, next: "set-new", phase: "set-new", ticket: nextTicket },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (ticketRes.payload.phase !== "verify-new") {
      return NextResponse.json(
        { ok: false, error: "Etapa invalida para validacao de codigo." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const nextEmail = normalizeEmail(ticketRes.payload.nextEmail);
    if (!isValidEmail(nextEmail)) {
      return NextResponse.json(
        { ok: false, error: "E-mail de destino invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const verifyNew = await verifyEmailChallengeCode({
      sb: base.sb,
      email: nextEmail,
      code,
      consumeOnSuccess: false,
    });
    if (!verifyNew.ok) {
      return NextResponse.json(
        { ok: false, error: verifyNew.error },
        { status: verifyNew.status, headers: NO_STORE_HEADERS },
      );
    }

    const twoFactorState = await resolveTwoFactorState({
      sb: base.sb,
      sessionUserId: base.sessionUserId,
      wzUserId: String(base.userRow.id || ""),
    });
    if (twoFactorState.enabled && twoFactorState.secret) {
      const twoFactorCode = normalizeTotpCode(body?.twoFactorCode ?? body?.totpCode, 6);
      const hasPasskey = await hasWindowsHelloPasskey(base.sb, String(base.userRow.id || ""));
      const passkeyProofRaw = String(body?.passkeyProof ?? body?.authProof ?? "").trim();
      const passkeyProofRes = passkeyProofRaw
        ? readPasskeyAuthProof({
            proof: passkeyProofRaw,
            userId: base.sessionUserId,
            email: base.sessionEmail,
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
        const validTwoFactorCode = verifyTotpCode({
          secret: twoFactorState.secret,
          code: twoFactorCode,
        });
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

    const { error: consumeChallengeError } = await base.sb
      .from("wz_auth_challenges")
      .update({ consumed: true })
      .eq("id", verifyNew.challengeId);
    if (consumeChallengeError) {
      console.error("[change-email] consume challenge error:", consumeChallengeError);
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel confirmar o codigo. Tente novamente." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const currentRowEmail = normalizeEmail(base.userRow.email);
    if (currentRowEmail === nextEmail) {
      const okRes = NextResponse.json(
        { ok: true, email: nextEmail, emailChangedAt: null },
        { status: 200, headers: NO_STORE_HEADERS },
      );
      setSessionCookie(
        okRes,
        {
          userId: String(base.userRow.id),
          email: nextEmail,
          fullName: sanitizeFullName(base.userRow.full_name || base.session.fullName),
        },
        req.headers,
      );
      return okRes;
    }

    if (currentRowEmail && currentRowEmail !== ticketRes.payload.currentEmail) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este e-mail ja foi alterado em outra sessao. Reabra o modal.",
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const available = await ensureEmailAvailable({
      sb: base.sb,
      userId: String(base.userRow.id),
      nextEmail,
    });
    if (!available.ok) {
      return NextResponse.json(
        { ok: false, error: available.error },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const currentAuthUserId = await resolveCurrentAuthUserId({
      sb: base.sb,
      userRow: base.userRow,
      sessionEmail: base.sessionEmail,
    });
    if (!currentAuthUserId) {
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel localizar seu usuario de autenticacao." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const nextAuthUserId = await findAuthUserIdByEmail(base.sb, nextEmail);
    if (nextAuthUserId && nextAuthUserId !== currentAuthUserId) {
      return NextResponse.json(
        { ok: false, error: "Este e-mail ja esta em uso em outro acesso." },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const { error: authUpdateError } = await base.sb.auth.admin.updateUserById(
      currentAuthUserId,
      { email: nextEmail, email_confirm: true },
    );
    if (authUpdateError) {
      const status = isUniqueViolation(authUpdateError) ? 409 : 500;
      const msg =
        status === 409
          ? "Este e-mail ja esta em uso em outro acesso."
          : "Nao foi possivel atualizar o e-mail de autenticacao.";
      console.error("[change-email] auth update error:", authUpdateError);
      return NextResponse.json(
        { ok: false, error: msg },
        { status, headers: NO_STORE_HEADERS },
      );
    }

    const { error: userUpdateError, emailChangedAt } = await updateWzUserEmailRecord({
      sb: base.sb,
      userId: String(base.userRow.id),
      nextEmail,
    });

    if (userUpdateError) {
      console.error("[change-email] wz_users update error:", userUpdateError);

      const { error: rollbackAuthError } = await base.sb.auth.admin.updateUserById(
        currentAuthUserId,
        { email: ticketRes.payload.currentEmail, email_confirm: true },
      );
      if (rollbackAuthError) {
        console.error("[change-email] auth rollback error:", rollbackAuthError);
      }

      const status = isUniqueViolation(userUpdateError) ? 409 : 500;
      const msg =
        status === 409
          ? "Este e-mail ja esta em uso por outra conta."
          : "Nao foi possivel salvar o novo e-mail na conta.";
      return NextResponse.json(
        { ok: false, error: msg },
        { status, headers: NO_STORE_HEADERS },
      );
    }

    await Promise.allSettled([
      base.sb.from("wz_pending_auth").delete().eq("email", ticketRes.payload.currentEmail),
      base.sb.from("wz_pending_auth").delete().eq("email", nextEmail),
      base.sb
        .from("wz_auth_trusted_devices")
        .update({ email: nextEmail })
        .eq("email", ticketRes.payload.currentEmail),
    ]);

    const res = NextResponse.json(
      { ok: true, email: nextEmail, emailChangedAt },
      { status: 200, headers: NO_STORE_HEADERS },
    );
    setSessionCookie(
      res,
      {
        userId: String(base.userRow.id),
        email: nextEmail,
        fullName: sanitizeFullName(base.userRow.full_name || base.session.fullName),
      },
      req.headers,
    );
    return res;
  } catch (error) {
    console.error("[change-email] verify error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao validar codigo de alteracao." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
