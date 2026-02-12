import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  gen7,
  isValidE164BRMobile,
  maskPhoneE164,
  newSalt,
  onlyDigits,
  sha,
  toE164BRMobile,
} from "@/app/api/wz_AuthLogin/_codes";
import { sendSmsCode } from "@/app/api/wz_AuthLogin/_sms";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
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

type PhoneChangePhase = "verify-current" | "set-new" | "verify-new";

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  auth_user_id?: string | null;
  user_id?: string | null;
};

type PhoneChangeTicketPayload = {
  typ: "wz-change-phone";
  uid: string;
  currentEmail: string;
  currentPhone: string;
  phase: PhoneChangePhase;
  nextPhone?: string;
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

function normalizeE164Phone(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    return `+${onlyDigits(raw)}`;
  }

  const digits = onlyDigits(raw);
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  if (digits.length === 11) return `+55${digits}`;
  return "";
}

function parsePhoneInputToE164(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const normalized = `+${onlyDigits(raw)}`;
    return isValidE164BRMobile(normalized) ? normalized : "";
  }

  const digits = onlyDigits(raw);
  if (digits.length === 13 && digits.startsWith("55")) {
    const normalized = `+${digits}`;
    return isValidE164BRMobile(normalized) ? normalized : "";
  }

  const converted = toE164BRMobile(digits);
  return converted || "";
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
    console.error("[change-phone] passkey lookup error:", error);
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

function createPhoneChangeTicket(params: {
  userId: string;
  currentEmail: string;
  currentPhone: string;
  phase: PhoneChangePhase;
  nextPhone?: string | null;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const now = Date.now();
  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 10);
  const normalizedCurrentPhone = normalizeE164Phone(params.currentPhone);
  const normalizedNextPhone = normalizeE164Phone(params.nextPhone);

  const payload: PhoneChangeTicketPayload = {
    typ: "wz-change-phone",
    uid: String(params.userId || "").trim(),
    currentEmail: normalizeEmail(params.currentEmail),
    currentPhone: normalizedCurrentPhone,
    phase: params.phase,
    ...(params.phase === "verify-new" && normalizedNextPhone
      ? { nextPhone: normalizedNextPhone }
      : {}),
    iat: now,
    exp: now + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function readPhoneChangeTicket(params: {
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
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as PhoneChangeTicketPayload;
    if (parsed?.typ !== "wz-change-phone") {
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

    parsed.currentPhone = normalizeE164Phone(parsed.currentPhone);
    if (!isValidE164BRMobile(parsed.currentPhone)) {
      return {
        ok: false as const,
        error: "Telefone atual invalido na sessao.",
      };
    }

    if (parsed.phase === "verify-new") {
      const nextPhone = normalizeE164Phone(parsed.nextPhone);
      if (!isValidE164BRMobile(nextPhone)) {
        return {
          ok: false as const,
          error: "Telefone de destino invalido.",
        };
      }
      parsed.nextPhone = nextPhone;
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

async function updateWzUserPhoneRecord(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  nextPhone: string;
}) {
  const phoneChangedAt = new Date().toISOString();
  const primaryUpdate = await params.sb
    .from("wz_users")
    .update({
      phone_e164: params.nextPhone,
      phone_verified: true,
      phone_changed_at: phoneChangedAt,
    })
    .eq("id", params.userId);

  if (!primaryUpdate.error) {
    return { error: null as unknown, phoneChangedAt };
  }

  if (!isMissingColumnError(primaryUpdate.error, "phone_changed_at")) {
    return { error: primaryUpdate.error, phoneChangedAt: null as string | null };
  }

  const fallbackUpdate = await params.sb
    .from("wz_users")
    .update({ phone_e164: params.nextPhone, phone_verified: true })
    .eq("id", params.userId);

  return {
    error: fallbackUpdate.error,
    phoneChangedAt: fallbackUpdate.error ? null : phoneChangedAt,
  };
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const columnsToTry = [
    "id,email,phone_e164,auth_user_id,user_id",
    "id,email,phone_e164,auth_user_id",
    "id,email,phone_e164,user_id",
    "id,email,phone_e164",
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
        phone_e164: normalizeOptionalText(String(row.phone_e164 || "")),
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

async function ensurePhoneAvailable(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  nextPhone: string;
}) {
  const { data, error } = await params.sb
    .from("wz_users")
    .select("id")
    .eq("phone_e164", params.nextPhone)
    .neq("id", params.userId)
    .limit(1);

  if (error) {
    return { ok: false as const, error: "Falha ao validar disponibilidade do celular." };
  }

  if ((data || []).length > 0) {
    return { ok: false as const, error: "Este celular ja esta em uso por outra conta." };
  }

  return { ok: true as const };
}

async function createSmsChallenge(sb: ReturnType<typeof supabaseAdmin>, email: string) {
  await sb
    .from("wz_auth_challenges")
    .update({ consumed: true })
    .eq("email", email)
    .eq("channel", "sms")
    .eq("consumed", false);

  const code = gen7();
  const salt = newSalt();
  const hash = sha(code, salt);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  const { error } = await sb.from("wz_auth_challenges").insert({
    email,
    channel: "sms",
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

async function verifySmsChallengeCode(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  code: string;
  consumeOnSuccess?: boolean;
}) {
  const { data: challenge, error: challengeErr } = await params.sb
    .from("wz_auth_challenges")
    .select("*")
    .eq("email", params.email)
    .eq("channel", "sms")
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

  const currentPhone = normalizeE164Phone(userRow.phone_e164);
  if (!isValidE164BRMobile(currentPhone)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Nao foi possivel localizar um celular valido na conta." },
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    sb,
    sessionUserId,
    sessionEmail,
    userRow,
    currentPhone,
  };
}

export async function POST(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const code = await createSmsChallenge(base.sb, base.sessionEmail);
    await sendSmsCode(base.currentPhone, code);

    const ticket = createPhoneChangeTicket({
      userId: String(base.userRow.id),
      currentEmail: base.sessionEmail,
      currentPhone: base.currentPhone,
      phase: "verify-current",
    });

    return NextResponse.json(
      {
        ok: true,
        ticket,
        phase: "verify-current",
        currentPhoneMask: maskPhoneE164(base.currentPhone),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[change-phone] start error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao iniciar alteracao de celular." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const body = await req.json().catch(() => ({}));
    const ticketRes = readPhoneChangeTicket({
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

    const requestedNewPhone = parsePhoneInputToE164(body?.newPhone);
    if (requestedNewPhone) {
      if (ticketRes.payload.phase !== "set-new") {
        return NextResponse.json(
          { ok: false, error: "Valide primeiro o celular atual." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      if (!isValidE164BRMobile(requestedNewPhone)) {
        return NextResponse.json(
          { ok: false, error: "Celular invalido. Informe um numero BR valido com DDD." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      if (requestedNewPhone === ticketRes.payload.currentPhone) {
        return NextResponse.json(
          { ok: false, error: "Informe um celular diferente do atual." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const available = await ensurePhoneAvailable({
        sb: base.sb,
        userId: String(base.userRow.id),
        nextPhone: requestedNewPhone,
      });
      if (!available.ok) {
        return NextResponse.json(
          { ok: false, error: available.error },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const code = await createSmsChallenge(base.sb, base.sessionEmail);
      await sendSmsCode(requestedNewPhone, code);

      const ticket = createPhoneChangeTicket({
        userId: String(base.userRow.id),
        currentEmail: base.sessionEmail,
        currentPhone: ticketRes.payload.currentPhone,
        phase: "verify-new",
        nextPhone: requestedNewPhone,
      });

      return NextResponse.json(
        {
          ok: true,
          ticket,
          phase: "verify-new",
          nextPhoneMask: maskPhoneE164(requestedNewPhone),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (ticketRes.payload.phase === "set-new") {
      return NextResponse.json(
        { ok: false, error: "Informe o novo celular antes de reenviar codigo." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const resendToPhone =
      ticketRes.payload.phase === "verify-current"
        ? ticketRes.payload.currentPhone
        : normalizeE164Phone(ticketRes.payload.nextPhone);

    if (!isValidE164BRMobile(resendToPhone)) {
      return NextResponse.json(
        { ok: false, error: "Celular de destino invalido para reenvio." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (ticketRes.payload.phase === "verify-new") {
      const available = await ensurePhoneAvailable({
        sb: base.sb,
        userId: String(base.userRow.id),
        nextPhone: resendToPhone,
      });
      if (!available.ok) {
        return NextResponse.json(
          { ok: false, error: available.error },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
    }

    const code = await createSmsChallenge(base.sb, base.sessionEmail);
    await sendSmsCode(resendToPhone, code);

    const refreshedTicket = createPhoneChangeTicket({
      userId: String(base.userRow.id),
      currentEmail: base.sessionEmail,
      currentPhone: ticketRes.payload.currentPhone,
      phase: ticketRes.payload.phase,
      nextPhone: ticketRes.payload.nextPhone,
    });

    return NextResponse.json(
      {
        ok: true,
        ticket: refreshedTicket,
        phase: ticketRes.payload.phase,
        ...(ticketRes.payload.phase === "verify-new"
          ? { nextPhoneMask: maskPhoneE164(resendToPhone) }
          : { currentPhoneMask: maskPhoneE164(resendToPhone) }),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[change-phone] patch error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao processar alteracao de celular." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const body = await req.json().catch(() => ({}));
    const ticketRes = readPhoneChangeTicket({
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

    if (ticketRes.payload.phase === "set-new") {
      return NextResponse.json(
        { ok: false, error: "Etapa invalida para validacao de codigo." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const verifyCurrent = await verifySmsChallengeCode({
      sb: base.sb,
      email: base.sessionEmail,
      code,
      consumeOnSuccess: ticketRes.payload.phase !== "verify-new",
    });
    if (!verifyCurrent.ok) {
      return NextResponse.json(
        { ok: false, error: verifyCurrent.error },
        { status: verifyCurrent.status, headers: NO_STORE_HEADERS },
      );
    }

    if (ticketRes.payload.phase === "verify-current") {
      const nextTicket = createPhoneChangeTicket({
        userId: String(base.userRow.id),
        currentEmail: base.sessionEmail,
        currentPhone: ticketRes.payload.currentPhone,
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

    const nextPhone = normalizeE164Phone(ticketRes.payload.nextPhone);
    if (!isValidE164BRMobile(nextPhone)) {
      return NextResponse.json(
        { ok: false, error: "Celular de destino invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const twoFactorState = await resolveTwoFactorState({
      sb: base.sb,
      sessionUserId: base.sessionUserId,
      wzUserId: String(base.userRow.id || ""),
    });
    const hasTotp = Boolean(twoFactorState.enabled && twoFactorState.secret);
    const hasPasskey = await hasWindowsHelloPasskey(base.sb, base.sessionUserId);

    if (hasTotp || hasPasskey) {
      const twoFactorCode = normalizeTotpCode(body?.twoFactorCode ?? body?.totpCode, 6);
      const passkeyProofRaw = String(body?.passkeyProof ?? body?.authProof ?? "").trim();
      const passkeyProofRes = passkeyProofRaw
        ? readPasskeyAuthProof({
            proof: passkeyProofRaw,
            userId: base.sessionUserId,
            email: base.sessionEmail,
          })
        : null;
      const hasValidPasskeyProof = Boolean(passkeyProofRes?.ok);
      const canUseTotp = hasTotp && twoFactorCode.length === 6;

      if (!canUseTotp && !hasValidPasskeyProof) {
        const fallbackMessage =
          passkeyProofRaw && passkeyProofRes && !passkeyProofRes.ok
            ? passkeyProofRes.error
            : hasTotp
              ? "Digite o codigo de 6 digitos do aplicativo autenticador."
              : "Confirme com Windows Hello para continuar.";
        return NextResponse.json(
          {
            ok: false,
            requiresTwoFactor: true,
            requiresPasskey: hasPasskey,
            authMethods: { totp: hasTotp, passkey: hasPasskey },
            error: fallbackMessage,
          },
          { status: 428, headers: NO_STORE_HEADERS },
        );
      }
      if (canUseTotp && twoFactorState.secret) {
        const validTwoFactorCode = await verifyTwoFactorCodeWithRecovery({
          sb: base.sb,
          userId: base.sessionUserId,
          secret: twoFactorState.secret,
          code: twoFactorCode,
        });
        if (!validTwoFactorCode.ok) {
          return NextResponse.json(
            {
              ok: false,
              requiresTwoFactor: true,
              requiresPasskey: hasPasskey,
              authMethods: { totp: hasTotp, passkey: hasPasskey },
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
      .eq("id", verifyCurrent.challengeId);
    if (consumeChallengeError) {
      console.error("[change-phone] consume challenge error:", consumeChallengeError);
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel confirmar o codigo. Tente novamente." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const currentRowPhone = normalizeE164Phone(base.userRow.phone_e164);
    if (currentRowPhone === nextPhone) {
      return NextResponse.json(
        {
          ok: true,
          phone: nextPhone,
          phoneMask: maskPhoneE164(nextPhone),
          phoneChangedAt: null,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (currentRowPhone && currentRowPhone !== ticketRes.payload.currentPhone) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este celular ja foi alterado em outra sessao. Reabra o modal.",
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const available = await ensurePhoneAvailable({
      sb: base.sb,
      userId: String(base.userRow.id),
      nextPhone,
    });
    if (!available.ok) {
      return NextResponse.json(
        { ok: false, error: available.error },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const { error: userUpdateError, phoneChangedAt } = await updateWzUserPhoneRecord({
      sb: base.sb,
      userId: String(base.userRow.id),
      nextPhone,
    });

    if (userUpdateError) {
      const status = isUniqueViolation(userUpdateError) ? 409 : 500;
      const msg =
        status === 409
          ? "Este celular ja esta em uso por outra conta."
          : "Nao foi possivel salvar o novo celular na conta.";
      return NextResponse.json(
        { ok: false, error: msg },
        { status, headers: NO_STORE_HEADERS },
      );
    }

    await Promise.allSettled([
      base.sb
        .from("wz_pending_auth")
        .update({ phone_e164: nextPhone, updated_at: new Date().toISOString() })
        .eq("email", base.sessionEmail),
    ]);

    return NextResponse.json(
      {
        ok: true,
        phone: nextPhone,
        phoneMask: maskPhoneE164(nextPhone),
        phoneChangedAt,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[change-phone] verify error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao validar codigo de alteracao de celular." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
