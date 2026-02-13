import crypto from "crypto";
import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { gen7, maskEmail, newSalt, onlyDigits, sha } from "@/app/api/wz_AuthLogin/_codes";
import { sendLoginCodeEmail } from "@/app/api/wz_AuthLogin/_email";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  clearTwoFactorRecoveryCodes,
  generateTwoFactorRecoveryCodes,
  replaceTwoFactorRecoveryCodes,
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

const TOTP_ISSUER = "Wyzer";
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TWO_FACTOR_SCHEMA_HINT =
  "Estrutura de banco para 2FA incompleta. Execute os SQLs de /sql e tente novamente.";

type TwoFactorPhase = "enable-verify-app" | "disable-verify-email" | "disable-verify-app";

type TwoFactorTicketPayload = {
  typ: "wz-two-factor";
  uid: string;
  currentEmail: string;
  phase: TwoFactorPhase;
  pendingSecret?: string;
  iat: number;
  exp: number;
  nonce: string;
};

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
  user_id?: string | null;
  two_factor_enabled?: boolean | string | number | null;
  two_factor_secret?: string | null;
  two_factor_enabled_at?: string | null;
  two_factor_disabled_at?: string | null;
};

type WzAuth2faRow = {
  user_id?: string | null;
  enabled?: boolean | string | number | null;
  secret?: string | null;
  enabled_at?: string | null;
  disabled_at?: string | null;
};

type TwoFactorState = {
  enabled: boolean;
  secret: string | null;
  enabledAt: string | null;
  disabledAt: string | null;
  source: "wz_auth_2fa" | "wz_users";
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeIsoDatetime(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "true" || clean === "t" || clean === "1";
  }
  return false;
}

function normalizeBase32Secret(value?: string | null) {
  const clean = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
  return clean || null;
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

  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const schemaMissing =
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("wz_auth_passkeys") ||
    message.includes("credential_id");
  if (!schemaMissing) {
    console.error("[two-factor] passkey lookup error:", error);
  }
  return false;
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

function isTwoFactorSchemaError(error: unknown) {
  return (
    isMissingColumnError(error, "two_factor_enabled") ||
    isMissingColumnError(error, "two_factor_secret") ||
    isMissingColumnError(error, "two_factor_enabled_at") ||
    isMissingColumnError(error, "two_factor_disabled_at")
  );
}

function isMissingTableError(error: unknown, table: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  const needle = String(table || "").trim().toLowerCase();

  if (!needle) return false;
  if (code === "42P01" || code === "PGRST205") return true;
  return (
    (message.includes(needle) || details.includes(needle) || hint.includes(needle)) &&
    (message.includes("does not exist") ||
      details.includes("does not exist") ||
      hint.includes("does not exist") ||
      message.includes("relation") ||
      details.includes("relation") ||
      hint.includes("relation") ||
      message.includes("table") ||
      details.includes("table") ||
      hint.includes("table"))
  );
}

function isWzAuth2faSchemaError(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();

  return (
    code === "42P10" ||
    message.includes("no unique or exclusion constraint matching the on conflict specification") ||
    isMissingTableError(error, "wz_auth_2fa") ||
    isMissingColumnError(error, "user_id") ||
    isMissingColumnError(error, "enabled") ||
    isMissingColumnError(error, "secret") ||
    isMissingColumnError(error, "enabled_at") ||
    isMissingColumnError(error, "disabled_at")
  );
}

function toTwoFactorState(params: {
  rawEnabled: unknown;
  rawSecret?: string | null;
  rawEnabledAt?: string | null;
  rawDisabledAt?: string | null;
  source: TwoFactorState["source"];
}) {
  const secret = normalizeBase32Secret(params.rawSecret);
  const enabled = normalizeBoolean(params.rawEnabled) && Boolean(secret);
  const enabledAt = normalizeIsoDatetime(params.rawEnabledAt);
  const disabledAt = enabled ? null : normalizeIsoDatetime(params.rawDisabledAt);
  return {
    enabled,
    secret,
    enabledAt,
    disabledAt,
    source: params.source,
  } as TwoFactorState;
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

function createTwoFactorTicket(params: {
  userId: string;
  currentEmail: string;
  phase: TwoFactorPhase;
  pendingSecret?: string | null;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const now = Date.now();
  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 10);
  const normalizedPendingSecret = normalizeBase32Secret(params.pendingSecret);

  const payload: TwoFactorTicketPayload = {
    typ: "wz-two-factor",
    uid: String(params.userId || "").trim(),
    currentEmail: normalizeEmail(params.currentEmail),
    phase: params.phase,
    ...(params.phase === "enable-verify-app" && normalizedPendingSecret
      ? { pendingSecret: normalizedPendingSecret }
      : {}),
    iat: now,
    exp: now + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function readTwoFactorTicket(params: {
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
      error: "Sessao de autenticacao em duas etapas invalida. Reabra o modal.",
    };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return {
      ok: false as const,
      error: "Sessao de autenticacao em duas etapas invalida. Reabra o modal.",
    };
  }

  const expectedSig = signTicket(payloadB64, secret);
  if (expectedSig !== sig) {
    return {
      ok: false as const,
      error: "Sessao de autenticacao em duas etapas invalida. Reabra o modal.",
    };
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as TwoFactorTicketPayload;
    if (parsed?.typ !== "wz-two-factor") {
      return {
        ok: false as const,
        error: "Sessao de autenticacao em duas etapas invalida. Reabra o modal.",
      };
    }

    if (!parsed?.uid || parsed.exp < Date.now()) {
      return {
        ok: false as const,
        error: "Sessao de autenticacao em duas etapas expirada. Reabra o fluxo e tente novamente.",
      };
    }

    if (
      parsed.phase !== "enable-verify-app" &&
      parsed.phase !== "disable-verify-email" &&
      parsed.phase !== "disable-verify-app"
    ) {
      return {
        ok: false as const,
        error: "Etapa da autenticacao em duas etapas invalida.",
      };
    }

    if (String(parsed.uid) !== String(params.sessionUserId)) {
      return {
        ok: false as const,
        error: "Sessao de autenticacao em duas etapas invalida para este usuario.",
      };
    }

    if (normalizeEmail(parsed.currentEmail) !== normalizeEmail(params.sessionEmail)) {
      return {
        ok: false as const,
        error: "Sessao desatualizada. Reabra o modal para continuar.",
      };
    }

    if (parsed.phase === "enable-verify-app") {
      const pendingSecret = normalizeBase32Secret(parsed.pendingSecret);
      if (!pendingSecret) {
        return {
          ok: false as const,
          error: "Segredo de autenticacao invalido na sessao.",
        };
      }
      parsed.pendingSecret = pendingSecret;
    }

    return { ok: true as const, payload: parsed };
  } catch {
    return {
      ok: false as const,
      error: "Sessao de autenticacao em duas etapas invalida. Reabra o modal.",
    };
  }
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const columnsToTry = [
    "id,email,auth_user_id,user_id,two_factor_enabled,two_factor_secret,two_factor_enabled_at,two_factor_disabled_at",
    "id,email,auth_user_id,user_id,two_factor_enabled,two_factor_secret,two_factor_enabled_at",
    "id,email,auth_user_id,user_id,two_factor_enabled,two_factor_secret",
    "id,email,auth_user_id,user_id,two_factor_enabled",
    "id,email,auth_user_id,user_id",
    "id,email,user_id",
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
        auth_user_id: normalizeOptionalText(String(row.auth_user_id || "")),
        user_id: normalizeOptionalText(String(row.user_id || "")),
        two_factor_enabled:
          typeof row.two_factor_enabled === "undefined" ? null : row.two_factor_enabled,
        two_factor_secret: normalizeOptionalText(String(row.two_factor_secret || "")),
        two_factor_enabled_at: normalizeOptionalText(String(row.two_factor_enabled_at || "")),
        two_factor_disabled_at: normalizeOptionalText(String(row.two_factor_disabled_at || "")),
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

  return null;
}

function readTwoFactorStateFromLegacyRow(userRow: WzUserRow) {
  return toTwoFactorState({
    rawEnabled: userRow.two_factor_enabled,
    rawSecret: userRow.two_factor_secret,
    rawEnabledAt: userRow.two_factor_enabled_at,
    rawDisabledAt: userRow.two_factor_disabled_at,
    source: "wz_users",
  });
}

async function readTwoFactorStateFromAuthTable(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
}) {
  const userId = String(params.sessionUserId || "").trim();
  if (!userId) {
    return {
      schemaAvailable: false,
      state: null as TwoFactorState | null,
    };
  }

  const { data, error } = await params.sb
    .from("wz_auth_2fa")
    .select("user_id,enabled,secret,enabled_at,disabled_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) {
    if (!data) {
      return {
        schemaAvailable: true,
        state: null as TwoFactorState | null,
      };
    }

    const row = data as unknown as WzAuth2faRow;
    return {
      schemaAvailable: true,
      state: toTwoFactorState({
        rawEnabled: row.enabled,
        rawSecret: row.secret,
        rawEnabledAt: row.enabled_at,
        rawDisabledAt: row.disabled_at,
        source: "wz_auth_2fa",
      }),
    };
  }

  if (isWzAuth2faSchemaError(error)) {
    return {
      schemaAvailable: false,
      state: null as TwoFactorState | null,
    };
  }

  console.error("[two-factor] read wz_auth_2fa error:", error);
  throw new Error("Nao foi possivel carregar a configuracao da autenticacao de 2 etapas.");
}

async function persistTwoFactorStateOnAuthTable(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  enabled: boolean;
  secret: string | null;
  enabledAt: string | null;
  disabledAt: string | null;
}) {
  const userId = String(params.sessionUserId || "").trim();
  if (!userId) {
    return {
      ok: false as const,
      schemaAvailable: true,
      status: 400,
      error: "Sessao de usuario invalida para salvar autenticacao de 2 etapas.",
    };
  }

  const { error } = await params.sb.from("wz_auth_2fa").upsert(
    {
      user_id: userId,
      enabled: params.enabled,
      secret: params.secret,
      enabled_at: params.enabledAt,
      disabled_at: params.disabledAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (!error) {
    return {
      ok: true as const,
      schemaAvailable: true,
    };
  }

  if (isWzAuth2faSchemaError(error)) {
    return {
      ok: false as const,
      schemaAvailable: false,
      status: 500,
      error: TWO_FACTOR_SCHEMA_HINT,
    };
  }

  console.error("[two-factor] upsert wz_auth_2fa error:", error);
  return {
    ok: false as const,
    schemaAvailable: true,
    status: 500,
    error: "Nao foi possivel salvar a autenticacao de 2 etapas.",
  };
}

async function persistTwoFactorStateOnLegacyColumns(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  wzUserId: string;
  enabled: boolean;
  secret: string | null;
  enabledAt: string | null;
  disabledAt: string | null;
}) {
  const userId = String(params.wzUserId || "").trim();
  if (!userId) {
    return {
      ok: false as const,
      status: 404,
      error: "Usuario nao encontrado para atualizar autenticacao de 2 etapas.",
    };
  }

  const { error } = await params.sb
    .from("wz_users")
    .update({
      two_factor_enabled: params.enabled,
      two_factor_secret: params.secret,
      two_factor_enabled_at: params.enabledAt,
      two_factor_disabled_at: params.disabledAt,
    })
    .eq("id", userId);

  if (!error) {
    return { ok: true as const };
  }

  if (isTwoFactorSchemaError(error)) {
    return {
      ok: false as const,
      status: 500,
      error: TWO_FACTOR_SCHEMA_HINT,
    };
  }

  console.error("[two-factor] legacy wz_users update error:", error);
  return {
    ok: false as const,
    status: 500,
    error: "Nao foi possivel atualizar autenticacao de 2 etapas no perfil.",
  };
}

async function syncLegacyTwoFactorState(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  wzUserId?: string | null;
  state: TwoFactorState;
}) {
  const wzUserId = String(params.wzUserId || "").trim();
  if (!wzUserId) return;

  const result = await persistTwoFactorStateOnLegacyColumns({
    sb: params.sb,
    wzUserId,
    enabled: params.state.enabled,
    secret: params.state.secret,
    enabledAt: params.state.enabledAt,
    disabledAt: params.state.disabledAt,
  });

  if (!result.ok && result.error !== TWO_FACTOR_SCHEMA_HINT) {
    console.error("[two-factor] legacy sync warning:", result.error);
  }
}

async function resolveCurrentTwoFactorState(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  userRow: WzUserRow;
}) {
  const authStateResult = await readTwoFactorStateFromAuthTable({
    sb: params.sb,
    sessionUserId: params.sessionUserId,
  });

  if (authStateResult.schemaAvailable) {
    if (authStateResult.state) {
      await syncLegacyTwoFactorState({
        sb: params.sb,
        wzUserId: params.userRow.id,
        state: authStateResult.state,
      });
      return authStateResult.state;
    }

    const legacyState = readTwoFactorStateFromLegacyRow(params.userRow);
    if (legacyState.enabled && legacyState.secret) {
      await persistTwoFactorStateOnAuthTable({
        sb: params.sb,
        sessionUserId: params.sessionUserId,
        enabled: legacyState.enabled,
        secret: legacyState.secret,
        enabledAt: legacyState.enabledAt,
        disabledAt: legacyState.disabledAt,
      });
      return {
        ...legacyState,
        source: "wz_auth_2fa",
      } as TwoFactorState;
    }

    return {
      enabled: false,
      secret: null,
      enabledAt: null,
      disabledAt: legacyState.disabledAt,
      source: "wz_auth_2fa",
    } as TwoFactorState;
  }

  return readTwoFactorStateFromLegacyRow(params.userRow);
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
    throw new Error("Nao foi possivel gerar o codigo de verificacao por e-mail.");
  }

  return code;
}

async function verifyEmailChallengeCode(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  code: string;
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

  await params.sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", challenge.id);
  return { ok: true as const };
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function toBase32(bytes: Buffer) {
  let value = 0;
  let bits = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function fromBase32(input: string) {
  const clean = String(input || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/\s+/g, "");

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return toBase32(crypto.randomBytes(20));
}

function generateTotpCode(params: {
  secret: string;
  atMs?: number;
  digits?: number;
  periodSeconds?: number;
}) {
  const secret = normalizeBase32Secret(params.secret);
  if (!secret) return "";

  const digits = Number(params.digits ?? TOTP_DIGITS);
  const periodSeconds = Number(params.periodSeconds ?? TOTP_PERIOD_SECONDS);
  const nowMs = Number(params.atMs ?? Date.now());
  const counter = Math.floor(nowMs / 1000 / periodSeconds);
  const key = fromBase32(secret);

  const counterBytes = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  counterBytes.writeUInt32BE(high, 0);
  counterBytes.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac("sha1", key).update(counterBytes).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) +
    ((hmac[offset + 1] & 0xff) << 16) +
    ((hmac[offset + 2] & 0xff) << 8) +
    (hmac[offset + 3] & 0xff);

  const modulo = 10 ** digits;
  return String(binary % modulo).padStart(digits, "0");
}

function safeCodeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verifyTotpCode(params: {
  secret: string;
  code: string;
  nowMs?: number;
  digits?: number;
  periodSeconds?: number;
  stepWindow?: number;
}) {
  const digits = Number(params.digits ?? TOTP_DIGITS);
  const periodSeconds = Number(params.periodSeconds ?? TOTP_PERIOD_SECONDS);
  const stepWindow = Number(params.stepWindow ?? 1);
  const providedCode = onlyDigits(String(params.code || "")).slice(0, digits);
  if (providedCode.length !== digits) return false;

  const nowMs = Number(params.nowMs ?? Date.now());
  for (let step = -stepWindow; step <= stepWindow; step++) {
    const expected = generateTotpCode({
      secret: params.secret,
      digits,
      periodSeconds,
      atMs: nowMs + step * periodSeconds * 1000,
    });
    if (expected && safeCodeEquals(expected, providedCode)) {
      return true;
    }
  }
  return false;
}

function buildOtpAuthUri(params: { secret: string; email: string }) {
  const secret = normalizeBase32Secret(params.secret) || "";
  const email = normalizeEmail(params.email) || "usuario";
  const label = `${TOTP_ISSUER}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(TOTP_ISSUER)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
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

  const currentState = await resolveCurrentTwoFactorState({
    sb,
    sessionUserId,
    userRow,
  });

  return {
    ok: true as const,
    sb,
    sessionUserId,
    sessionEmail,
    userRow,
    twoFactorEnabled: currentState.enabled,
    twoFactorSecret: currentState.secret,
    twoFactorEnabledAt: currentState.enabledAt,
    twoFactorDisabledAt: currentState.disabledAt,
    twoFactorSource: currentState.source,
  };
}

async function enableTwoFactor(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  wzUserId: string;
  secret: string;
}) {
  const normalizedSecret = normalizeBase32Secret(params.secret);
  if (!normalizedSecret) {
    return {
      ok: false as const,
      status: 400,
      error: "Segredo da autenticacao de 2 etapas invalido.",
    };
  }

  const enabledAt = new Date().toISOString();
  const authPersist = await persistTwoFactorStateOnAuthTable({
    sb: params.sb,
    sessionUserId: params.sessionUserId,
    enabled: true,
    secret: normalizedSecret,
    enabledAt,
    disabledAt: null,
  });

  if (authPersist.ok) {
    await syncLegacyTwoFactorState({
      sb: params.sb,
      wzUserId: params.wzUserId,
      state: {
        enabled: true,
        secret: normalizedSecret,
        enabledAt,
        disabledAt: null,
        source: "wz_auth_2fa",
      },
    });
    return { ok: true as const, enabledAt };
  }

  if (!authPersist.schemaAvailable) {
    const legacyPersist = await persistTwoFactorStateOnLegacyColumns({
      sb: params.sb,
      wzUserId: params.wzUserId,
      enabled: true,
      secret: normalizedSecret,
      enabledAt,
      disabledAt: null,
    });
    if (legacyPersist.ok) {
      return { ok: true as const, enabledAt };
    }
    return legacyPersist;
  }

  return authPersist;
}

async function disableTwoFactor(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  wzUserId: string;
}) {
  const disabledAt = new Date().toISOString();
  const authPersist = await persistTwoFactorStateOnAuthTable({
    sb: params.sb,
    sessionUserId: params.sessionUserId,
    enabled: false,
    secret: null,
    enabledAt: null,
    disabledAt,
  });

  if (authPersist.ok) {
    await syncLegacyTwoFactorState({
      sb: params.sb,
      wzUserId: params.wzUserId,
      state: {
        enabled: false,
        secret: null,
        enabledAt: null,
        disabledAt,
        source: "wz_auth_2fa",
      },
    });
    return { ok: true as const, disabledAt };
  }

  if (!authPersist.schemaAvailable) {
    const legacyPersist = await persistTwoFactorStateOnLegacyColumns({
      sb: params.sb,
      wzUserId: params.wzUserId,
      enabled: false,
      secret: null,
      enabledAt: null,
      disabledAt,
    });
    if (legacyPersist.ok) {
      return { ok: true as const, disabledAt };
    }
    return legacyPersist;
  }

  return authPersist;
}

export async function GET(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    return NextResponse.json(
      {
        ok: true,
        enabled: base.twoFactorEnabled,
        twoFactorEnabledAt: base.twoFactorEnabledAt,
        twoFactorDisabledAt: base.twoFactorDisabledAt,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[two-factor] status error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao carregar status da autenticacao em duas etapas." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "enable-start").trim();

    if (mode === "verify-app-code") {
      if (!base.twoFactorEnabled || !base.twoFactorSecret) {
        return NextResponse.json(
          { ok: false, error: "A autenticacao em 2 etapas nao esta ativa." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const code = onlyDigits(String(body?.code || "")).slice(0, TOTP_DIGITS);
      if (code.length !== TOTP_DIGITS) {
        return NextResponse.json(
          { ok: false, error: "Codigo do aplicativo invalido." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const valid = await verifyTwoFactorCodeWithRecovery({
        sb: base.sb,
        userId: base.sessionUserId,
        secret: base.twoFactorSecret,
        code,
      });
      if (!valid.ok) {
        return NextResponse.json(
          { ok: false, error: "Codigo do aplicativo invalido. Tente novamente." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        { ok: true, verified: true },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (mode === "disable-start-after-app-code") {
      if (!base.twoFactorEnabled || !base.twoFactorSecret) {
        return NextResponse.json(
          { ok: false, error: "A autenticacao em 2 etapas ja esta desativada." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const code = onlyDigits(String(body?.code || "")).slice(0, TOTP_DIGITS);
      if (code.length !== TOTP_DIGITS) {
        return NextResponse.json(
          { ok: false, error: "Codigo do aplicativo invalido." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const valid = await verifyTwoFactorCodeWithRecovery({
        sb: base.sb,
        userId: base.sessionUserId,
        secret: base.twoFactorSecret,
        code,
      });
      if (!valid.ok) {
        return NextResponse.json(
          { ok: false, error: "Codigo do aplicativo invalido. Tente novamente." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const emailCode = await createEmailChallenge(base.sb, base.sessionEmail);
      await sendLoginCodeEmail(base.sessionEmail, emailCode, {
        heading: "Desativando autenticacao em 2 etapas",
      });

      const ticket = createTwoFactorTicket({
        userId: base.sessionUserId,
        currentEmail: base.sessionEmail,
        phase: "disable-verify-email",
      });

      return NextResponse.json(
        {
          ok: true,
          mode: "disable",
          phase: "disable-verify-email",
          ticket,
          emailMask: maskEmail(base.sessionEmail),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (mode === "disable-start") {
      if (!base.twoFactorEnabled || !base.twoFactorSecret) {
        return NextResponse.json(
          { ok: false, error: "A autenticacao em 2 etapas ja esta desativada." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const emailCode = await createEmailChallenge(base.sb, base.sessionEmail);
      await sendLoginCodeEmail(base.sessionEmail, emailCode, {
        heading: "Desativando autenticacao em 2 etapas",
      });

      const ticket = createTwoFactorTicket({
        userId: base.sessionUserId,
        currentEmail: base.sessionEmail,
        phase: "disable-verify-email",
      });

      return NextResponse.json(
        {
          ok: true,
          mode: "disable",
          phase: "disable-verify-email",
          ticket,
          emailMask: maskEmail(base.sessionEmail),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (base.twoFactorEnabled) {
      return NextResponse.json(
        { ok: false, error: "A autenticacao em 2 etapas ja esta ativa." },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const pendingSecret = generateTotpSecret();
    const otpAuthUri = buildOtpAuthUri({ secret: pendingSecret, email: base.sessionEmail });
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUri, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    const ticket = createTwoFactorTicket({
      userId: base.sessionUserId,
      currentEmail: base.sessionEmail,
      phase: "enable-verify-app",
      pendingSecret,
    });

    return NextResponse.json(
      {
        ok: true,
        mode: "enable",
        phase: "enable-verify-app",
        ticket,
        manualCode: pendingSecret,
        otpAuthUri,
        qrCodeDataUrl,
        issuer: TOTP_ISSUER,
        digits: TOTP_DIGITS,
        periodSeconds: TOTP_PERIOD_SECONDS,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[two-factor] start error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao iniciar configuracao de 2 etapas." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const body = await req.json().catch(() => ({}));
    const ticketRes = readTwoFactorTicket({
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

    if (ticketRes.payload.phase !== "disable-verify-email") {
      return NextResponse.json(
        { ok: false, error: "Reenvio de codigo disponivel apenas na etapa de e-mail." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!base.twoFactorEnabled || !base.twoFactorSecret) {
      return NextResponse.json(
        { ok: false, error: "A autenticacao em 2 etapas ja foi desativada." },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const code = await createEmailChallenge(base.sb, base.sessionEmail);
    await sendLoginCodeEmail(base.sessionEmail, code, {
      heading: "Desativando autenticacao em 2 etapas",
    });

    const refreshedTicket = createTwoFactorTicket({
      userId: base.sessionUserId,
      currentEmail: base.sessionEmail,
      phase: "disable-verify-email",
    });

    return NextResponse.json(
      { ok: true, phase: "disable-verify-email", ticket: refreshedTicket },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[two-factor] resend email code error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao reenviar codigo de e-mail da desativacao." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const base = await getSessionAndUser(req);
    if (!base.ok) return base.response;

    const body = await req.json().catch(() => ({}));
    const ticketRes = readTwoFactorTicket({
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

    if (ticketRes.payload.phase === "enable-verify-app") {
      if (base.twoFactorEnabled) {
        return NextResponse.json(
          { ok: false, error: "A autenticacao em 2 etapas ja esta ativa." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const code = onlyDigits(String(body?.code || "")).slice(0, TOTP_DIGITS);
      if (code.length !== TOTP_DIGITS) {
        return NextResponse.json(
          { ok: false, error: "Codigo do aplicativo invalido." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const valid = verifyTotpCode({
        secret: ticketRes.payload.pendingSecret || "",
        code,
      });
      if (!valid) {
        return NextResponse.json(
          { ok: false, error: "Codigo do aplicativo invalido. Tente novamente." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const recoveryCodes = generateTwoFactorRecoveryCodes({
        count: 9,
        digits: TOTP_DIGITS,
      });
      const saveRecoveryCodes = await replaceTwoFactorRecoveryCodes({
        sb: base.sb,
        userId: base.sessionUserId,
        codes: recoveryCodes,
      });
      if (!saveRecoveryCodes.ok) {
        return NextResponse.json(
          { ok: false, error: saveRecoveryCodes.error },
          { status: saveRecoveryCodes.status, headers: NO_STORE_HEADERS },
        );
      }

      const enabled = await enableTwoFactor({
        sb: base.sb,
        sessionUserId: base.sessionUserId,
        wzUserId: String(base.userRow.id),
        secret: ticketRes.payload.pendingSecret || "",
      });
      if (!enabled.ok) {
        await clearTwoFactorRecoveryCodes({
          sb: base.sb,
          userId: base.sessionUserId,
        });
        return NextResponse.json(
          { ok: false, error: enabled.error },
          { status: enabled.status, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          enabled: true,
          twoFactorEnabledAt: enabled.enabledAt,
          recoveryCodes,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (ticketRes.payload.phase === "disable-verify-app") {
      if (!base.twoFactorEnabled || !base.twoFactorSecret) {
        return NextResponse.json(
          { ok: false, error: "A autenticacao em 2 etapas ja foi desativada." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const code = onlyDigits(String(body?.code || "")).slice(0, TOTP_DIGITS);
      const hasPasskey = await hasWindowsHelloPasskey(base.sb, base.sessionUserId);
      const passkeyProofRaw = String(body?.passkeyProof ?? body?.authProof ?? "").trim();
      const passkeyProofRes = passkeyProofRaw
        ? readPasskeyAuthProof({
            proof: passkeyProofRaw,
            userId: base.sessionUserId,
            email: base.sessionEmail,
          })
        : null;

      if (code.length !== TOTP_DIGITS && !passkeyProofRes?.ok) {
        const fallbackMessage = passkeyProofRaw && passkeyProofRes && !passkeyProofRes.ok
          ? passkeyProofRes.error
          : "Codigo do aplicativo invalido.";
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

      if (code.length === TOTP_DIGITS) {
        const valid = await verifyTwoFactorCodeWithRecovery({
          sb: base.sb,
          userId: base.sessionUserId,
          secret: base.twoFactorSecret,
          code,
        });
        if (!valid.ok) {
          return NextResponse.json(
            {
              ok: false,
              requiresTwoFactor: true,
              requiresPasskey: hasPasskey,
              authMethods: { totp: true, passkey: hasPasskey },
              error: "Codigo do aplicativo invalido. Tente novamente.",
            },
            { status: 401, headers: NO_STORE_HEADERS },
          );
        }
      }

      const disabled = await disableTwoFactor({
        sb: base.sb,
        sessionUserId: base.sessionUserId,
        wzUserId: String(base.userRow.id),
      });
      if (!disabled.ok) {
        return NextResponse.json(
          { ok: false, error: disabled.error },
          { status: disabled.status, headers: NO_STORE_HEADERS },
        );
      }

      const clearedRecoveryCodes = await clearTwoFactorRecoveryCodes({
        sb: base.sb,
        userId: base.sessionUserId,
      });
      if (!clearedRecoveryCodes.ok && clearedRecoveryCodes.schemaAvailable) {
        console.error("[two-factor] clear recovery codes warning:", clearedRecoveryCodes.error);
      }

      return NextResponse.json(
        {
          ok: true,
          enabled: false,
          twoFactorDisabledAt: disabled.disabledAt,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (ticketRes.payload.phase === "disable-verify-email") {
      if (!base.twoFactorEnabled || !base.twoFactorSecret) {
        return NextResponse.json(
          { ok: false, error: "A autenticacao em 2 etapas ja foi desativada." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const emailCode = onlyDigits(String(body?.emailCode || "")).slice(0, 7);
      if (emailCode.length !== 7) {
        return NextResponse.json(
          { ok: false, error: "Codigo de e-mail invalido." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const verifyEmail = await verifyEmailChallengeCode({
        sb: base.sb,
        email: base.sessionEmail,
        code: emailCode,
      });
      if (!verifyEmail.ok) {
        return NextResponse.json(
          { ok: false, error: verifyEmail.error },
          { status: verifyEmail.status, headers: NO_STORE_HEADERS },
        );
      }

      const hasPasskey = await hasWindowsHelloPasskey(base.sb, base.sessionUserId);
      const nextTicket = createTwoFactorTicket({
        userId: base.sessionUserId,
        currentEmail: base.sessionEmail,
        phase: "disable-verify-app",
      });

      return NextResponse.json(
        {
          ok: true,
          next: "verify-auth",
          phase: "disable-verify-app",
          ticket: nextTicket,
          authMethods: { totp: true, passkey: hasPasskey },
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Etapa invalida para confirmacao do fluxo de 2 etapas." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[two-factor] verify error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao confirmar autenticacao em 2 etapas." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
