import crypto from "crypto";
import { onlyDigits } from "@/app/api/wz_AuthLogin/_codes";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_TOTP_DIGITS = 6;
const DEFAULT_TOTP_PERIOD_SECONDS = 30;

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
