import crypto from "crypto";
import { newSalt, onlyDigits, sha } from "@/app/api/wz_AuthLogin/_codes";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_TOTP_DIGITS = 6;
const DEFAULT_TOTP_PERIOD_SECONDS = 30;
const DEFAULT_RECOVERY_CODE_COUNT = 9;

export const TWO_FACTOR_RECOVERY_SCHEMA_HINT =
  "Schema de codigos de recuperacao ausente. Execute sql/wz_auth_2fa_recovery_codes_create.sql.";

type WzAuth2faRow = {
  enabled?: boolean | string | number | null;
  secret?: string | null;
  enabled_at?: string | null;
  disabled_at?: string | null;
};

type WzUsersLegacy2faRow = {
  two_factor_enabled?: boolean | string | number | null;
  two_factor_secret?: string | null;
  two_factor_enabled_at?: string | null;
  two_factor_disabled_at?: string | null;
};

type WzAuth2faRecoveryRow = {
  id?: string | number | null;
  code_hash?: string | null;
  salt?: string | null;
};

export type TwoFactorState = {
  enabled: boolean;
  secret: string | null;
  enabledAt: string | null;
  disabledAt: string | null;
  source: "wz_auth_2fa" | "wz_users" | "none";
};

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

function normalizeIsoDatetime(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
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

function isWzUsersLegacySchemaError(error: unknown) {
  return (
    isMissingTableError(error, "wz_users") ||
    isMissingColumnError(error, "two_factor_enabled") ||
    isMissingColumnError(error, "two_factor_secret") ||
    isMissingColumnError(error, "two_factor_enabled_at") ||
    isMissingColumnError(error, "two_factor_disabled_at")
  );
}

function isWzAuth2faRecoverySchemaError(error: unknown) {
  return (
    isMissingTableError(error, "wz_auth_2fa_recovery_codes") ||
    isMissingColumnError(error, "user_id") ||
    isMissingColumnError(error, "code_hash") ||
    isMissingColumnError(error, "salt") ||
    isMissingColumnError(error, "used_at")
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
  } satisfies TwoFactorState;
}

async function readAuthTableState(params: {
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
    .select("enabled,secret,enabled_at,disabled_at")
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

  throw error;
}

async function readLegacyStateByWzUserId(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  wzUserId?: string | null;
}) {
  const wzUserId = String(params.wzUserId || "").trim();
  if (!wzUserId) {
    return null as TwoFactorState | null;
  }

  const { data, error } = await params.sb
    .from("wz_users")
    .select("two_factor_enabled,two_factor_secret,two_factor_enabled_at,two_factor_disabled_at")
    .eq("id", wzUserId)
    .maybeSingle();

  if (error) {
    if (isWzUsersLegacySchemaError(error)) {
      return null as TwoFactorState | null;
    }
    throw error;
  }

  if (!data) return null as TwoFactorState | null;
  const row = data as unknown as WzUsersLegacy2faRow;
  return toTwoFactorState({
    rawEnabled: row.two_factor_enabled,
    rawSecret: row.two_factor_secret,
    rawEnabledAt: row.two_factor_enabled_at,
    rawDisabledAt: row.two_factor_disabled_at,
    source: "wz_users",
  });
}

export async function resolveTwoFactorState(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId?: string | null;
  wzUserId?: string | null;
}) {
  const sessionUserId = String(params.sessionUserId || "").trim();
  const wzUserId = String(params.wzUserId || "").trim();

  if (sessionUserId) {
    const authStateResult = await readAuthTableState({
      sb: params.sb,
      sessionUserId,
    });

    if (authStateResult.schemaAvailable) {
      if (authStateResult.state) {
        return authStateResult.state;
      }

      const legacyState = await readLegacyStateByWzUserId({
        sb: params.sb,
        wzUserId,
      });
      if (legacyState) return legacyState;

      return {
        enabled: false,
        secret: null,
        enabledAt: null,
        disabledAt: null,
        source: "wz_auth_2fa",
      } satisfies TwoFactorState;
    }
  }

  const legacyState = await readLegacyStateByWzUserId({
    sb: params.sb,
    wzUserId,
  });
  if (legacyState) return legacyState;

  return {
    enabled: false,
    secret: null,
    enabledAt: null,
    disabledAt: null,
    source: "none",
  } satisfies TwoFactorState;
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

function generateTotpCode(params: {
  secret: string;
  atMs?: number;
  digits?: number;
  periodSeconds?: number;
}) {
  const secret = normalizeBase32Secret(params.secret);
  if (!secret) return "";

  const digits = Number(params.digits ?? DEFAULT_TOTP_DIGITS);
  const periodSeconds = Number(params.periodSeconds ?? DEFAULT_TOTP_PERIOD_SECONDS);
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

export function normalizeTotpCode(value: unknown, digits = DEFAULT_TOTP_DIGITS) {
  return onlyDigits(String(value || "")).slice(0, digits);
}

export function verifyTotpCode(params: {
  secret: string;
  code: string;
  nowMs?: number;
  digits?: number;
  periodSeconds?: number;
  stepWindow?: number;
}) {
  const digits = Number(params.digits ?? DEFAULT_TOTP_DIGITS);
  const periodSeconds = Number(params.periodSeconds ?? DEFAULT_TOTP_PERIOD_SECONDS);
  const stepWindow = Number(params.stepWindow ?? 1);
  const providedCode = normalizeTotpCode(params.code, digits);
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

function normalizeRecoveryCode(code: unknown, digits = DEFAULT_TOTP_DIGITS) {
  return onlyDigits(String(code || "")).slice(0, digits);
}

export function generateTwoFactorRecoveryCodes(params?: {
  count?: number;
  digits?: number;
}) {
  const digits = Math.max(4, Math.min(12, Number(params?.digits ?? DEFAULT_TOTP_DIGITS)));
  const count = Math.max(1, Math.min(20, Number(params?.count ?? DEFAULT_RECOVERY_CODE_COUNT)));
  const max = 10 ** digits;
  const codes = new Set<string>();

  while (codes.size < count) {
    const value = crypto.randomInt(0, max);
    codes.add(String(value).padStart(digits, "0"));
  }

  return Array.from(codes.values());
}

export async function replaceTwoFactorRecoveryCodes(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  codes: string[];
}) {
  const cleanUserId = String(params.userId || "").trim();
  if (!cleanUserId) {
    return {
      ok: false as const,
      status: 400,
      error: "Usuario invalido para gerar codigos de recuperacao.",
      schemaAvailable: true,
    };
  }

  const normalizedCodes = Array.from(
    new Set((params.codes || []).map((item) => normalizeRecoveryCode(item)).filter(Boolean)),
  );

  const { error: deleteError } = await params.sb
    .from("wz_auth_2fa_recovery_codes")
    .delete()
    .eq("user_id", cleanUserId);

  if (deleteError) {
    if (isWzAuth2faRecoverySchemaError(deleteError)) {
      return {
        ok: false as const,
        status: 500,
        error: TWO_FACTOR_RECOVERY_SCHEMA_HINT,
        schemaAvailable: false,
      };
    }
    return {
      ok: false as const,
      status: 500,
      error: "Nao foi possivel preparar os codigos de recuperacao.",
      schemaAvailable: true,
    };
  }

  if (!normalizedCodes.length) {
    return { ok: true as const, schemaAvailable: true };
  }

  const nowIso = new Date().toISOString();
  const rows = normalizedCodes.map((code) => {
    const salt = newSalt();
    return {
      user_id: cleanUserId,
      code_hash: sha(code, salt),
      salt,
      used_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  const { error: insertError } = await params.sb
    .from("wz_auth_2fa_recovery_codes")
    .insert(rows);

  if (insertError) {
    if (isWzAuth2faRecoverySchemaError(insertError)) {
      return {
        ok: false as const,
        status: 500,
        error: TWO_FACTOR_RECOVERY_SCHEMA_HINT,
        schemaAvailable: false,
      };
    }
    return {
      ok: false as const,
      status: 500,
      error: "Nao foi possivel salvar os codigos de recuperacao.",
      schemaAvailable: true,
    };
  }

  return { ok: true as const, schemaAvailable: true };
}

export async function clearTwoFactorRecoveryCodes(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
}) {
  const cleanUserId = String(params.userId || "").trim();
  if (!cleanUserId) return { ok: true as const, schemaAvailable: true };

  const { error } = await params.sb
    .from("wz_auth_2fa_recovery_codes")
    .delete()
    .eq("user_id", cleanUserId);

  if (!error) {
    return { ok: true as const, schemaAvailable: true };
  }

  if (isWzAuth2faRecoverySchemaError(error)) {
    return {
      ok: false as const,
      status: 500,
      error: TWO_FACTOR_RECOVERY_SCHEMA_HINT,
      schemaAvailable: false,
    };
  }

  return {
    ok: false as const,
    status: 500,
    error: "Nao foi possivel limpar os codigos de recuperacao.",
    schemaAvailable: true,
  };
}

async function consumeTwoFactorRecoveryCode(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  code: string;
}) {
  const cleanUserId = String(params.userId || "").trim();
  const normalizedCode = normalizeRecoveryCode(params.code);
  if (!cleanUserId || normalizedCode.length !== DEFAULT_TOTP_DIGITS) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const { data, error } = await params.sb
    .from("wz_auth_2fa_recovery_codes")
    .select("id,code_hash,salt")
    .eq("user_id", cleanUserId)
    .is("used_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    if (isWzAuth2faRecoverySchemaError(error)) {
      return {
        ok: false as const,
        reason: "schema" as const,
        error: TWO_FACTOR_RECOVERY_SCHEMA_HINT,
      };
    }
    return {
      ok: false as const,
      reason: "invalid" as const,
    };
  }

  const rows = (data || []) as WzAuth2faRecoveryRow[];
  const matched = rows.find((row) => {
    const hash = String(row.code_hash || "");
    const salt = String(row.salt || "");
    if (!hash || !salt) return false;
    return safeCodeEquals(hash, sha(normalizedCode, salt));
  });

  if (!matched?.id) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const nowIso = new Date().toISOString();
  const { data: consumeData, error: consumeError } = await params.sb
    .from("wz_auth_2fa_recovery_codes")
    .update({ used_at: nowIso, updated_at: nowIso })
    .eq("id", matched.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (consumeError) {
    if (isWzAuth2faRecoverySchemaError(consumeError)) {
      return {
        ok: false as const,
        reason: "schema" as const,
        error: TWO_FACTOR_RECOVERY_SCHEMA_HINT,
      };
    }
    return { ok: false as const, reason: "invalid" as const };
  }

  if (!consumeData) {
    return { ok: false as const, reason: "invalid" as const };
  }

  return {
    ok: true as const,
    method: "recovery" as const,
    remaining: Math.max(0, rows.length - 1),
  };
}

export async function verifyTwoFactorCodeWithRecovery(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  secret: string;
  code: string;
}) {
  const normalizedCode = normalizeRecoveryCode(params.code);
  if (normalizedCode.length !== DEFAULT_TOTP_DIGITS) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const totpValid = verifyTotpCode({
    secret: params.secret,
    code: normalizedCode,
  });
  if (totpValid) {
    return { ok: true as const, method: "totp" as const };
  }

  return consumeTwoFactorRecoveryCode({
    sb: params.sb,
    userId: params.userId,
    code: normalizedCode,
  });
}
