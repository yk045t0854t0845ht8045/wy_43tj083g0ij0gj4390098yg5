import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "../../_active_session";
import { supabaseAdmin } from "../../_supabase";
import {
  findLinkedUserByProviderIdentity,
  upsertLoginProviderRecord,
} from "../../_login_providers";
import { gen7, newSalt, onlyDigits, sha, toE164BRMobile } from "../../_codes";
import { sendLoginCodeEmail } from "../../_email";
import { setSessionCookie } from "../../_session";
import { registerIssuedSession } from "../../_session_devices";
import {
  hashTrustedLoginToken,
  readTrustedLoginTokenFromCookieHeader,
  setTrustedLoginCookie,
} from "../../_trusted_login";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};
const DISCORD_STATE_COOKIE_NAME = "wz_discord_oauth_state_v1";

type DiscordStatePayload = {
  typ: "wz-discord-oauth-state";
  next: string;
  intent?: "login" | "connect";
  connect_user_id?: string;
  iat: number;
  exp: number;
  nonce: string;
  cv?: string;
};

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  full_name?: string | null;
  phone_e164?: string | null;
  auth_user_id?: string | null;
  auth_provider?: string | null;
  must_create_password?: boolean | string | number | null;
};

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToString(input: string) {
  const b64 =
    input.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((input.length + 3) % 4);
  return Buffer.from(b64, "base64").toString("utf8");
}

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest(),
  );
}

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeEmail(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  return clean || null;
}

function normalizePkceVerifier(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  if (clean.length < 43 || clean.length > 128) return null;
  if (!/^[A-Za-z0-9\-._~]+$/.test(clean)) return null;
  return clean;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "1" || clean === "true" || clean === "t";
  }
  return false;
}

function sanitizeFullName(value?: string | null) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.slice(0, 120);
}

function normalizeOptionalPhone(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeAuthProviderName(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function hasPasswordProviderInAuthUser(user: Record<string, unknown>) {
  const appMetadata =
    user.app_metadata && typeof user.app_metadata === "object"
      ? (user.app_metadata as Record<string, unknown>)
      : null;

  const appProvider = normalizeAuthProviderName(appMetadata?.provider);
  if (appProvider === "email" || appProvider === "password") {
    return true;
  }

  const appProvidersRaw = appMetadata?.providers;
  if (Array.isArray(appProvidersRaw)) {
    for (const provider of appProvidersRaw) {
      const normalized = normalizeAuthProviderName(provider);
      if (normalized === "email" || normalized === "password") {
        return true;
      }
    }
  }

  const identities = Array.isArray(user.identities)
    ? (user.identities as Array<Record<string, unknown>>)
    : [];
  return identities.some((identity) => {
    const provider = normalizeAuthProviderName(identity?.provider);
    return provider === "email" || provider === "password";
  });
}

function normalizeDiscordPhoneToE164Br(value?: string | null) {
  const digits = onlyDigits(String(value || ""));
  if (!digits) return null;

  if (digits.length === 11) {
    return toE164BRMobile(digits);
  }

  if (digits.length === 13 && digits.startsWith("55")) {
    return toE164BRMobile(digits.slice(2));
  }

  if (digits.length === 12 && digits.startsWith("55")) {
    return toE164BRMobile(`9${digits.slice(2)}`);
  }

  if (digits.length > 13 && digits.startsWith("55")) {
    return toE164BRMobile(digits.slice(2, 13));
  }

  return null;
}

function extractDiscordPhoneCandidate(user: Record<string, unknown>) {
  const candidates: Array<string> = [];

  const pushCandidate = (raw: unknown) => {
    const value = String(raw || "").trim();
    if (!value) return;
    candidates.push(value);
  };

  pushCandidate(user.phone);
  pushCandidate(user.phone_number);

  const metadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : null;

  if (metadata) {
    pushCandidate(metadata.phone);
    pushCandidate(metadata.phone_number);
    pushCandidate(metadata.phoneNumber);
    pushCandidate(metadata.mobile);
    pushCandidate(metadata.mobile_phone);
  }

  const identities = Array.isArray(user.identities)
    ? (user.identities as Array<Record<string, unknown>>)
    : [];
  for (const identity of identities) {
    const identityData =
      identity.identity_data && typeof identity.identity_data === "object"
        ? (identity.identity_data as Record<string, unknown>)
        : null;
    if (!identityData) continue;

    pushCandidate(identityData.phone);
    pushCandidate(identityData.phone_number);
    pushCandidate(identityData.phoneNumber);
    pushCandidate(identityData.mobile);
  }

  for (const candidate of candidates) {
    const normalized = normalizeDiscordPhoneToE164Br(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function isSafeNextPath(path: string) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\n") || path.includes("\r")) return false;
  return true;
}

function isAllowedReturnToAbsolute(u: URL) {
  const host = u.hostname.toLowerCase();
  const allowed =
    host === "wyzer.com.br" ||
    host === "www.wyzer.com.br" ||
    host.endsWith(".wyzer.com.br") ||
    host === "localhost" ||
    host.endsWith(".localhost");

  const protoOk = u.protocol === "https:" || u.protocol === "http:";
  return protoOk && allowed;
}

function sanitizeNext(raw: string) {
  const clean = String(raw || "").trim();
  if (!clean) return "/";
  if (isSafeNextPath(clean)) return clean;
  try {
    const u = new URL(clean);
    if (isAllowedReturnToAbsolute(u)) return u.toString();
  } catch {}
  return "/";
}

function getEnvBool(name: string, def: boolean) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return def;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
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
    userId: String(params.userId),
    email: String(params.email).trim().toLowerCase(),
    ...(safeFullName ? { fullName: safeFullName } : {}),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function toDashboardRedirectTarget(next: string, dashboardOrigin: string) {
  const clean = String(next || "").trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  return `${dashboardOrigin}${clean.startsWith("/") ? clean : "/"}`;
}

function getConfiguredAuthOrigin() {
  const raw = String(
    process.env.AUTH_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "",
  ).trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

function getRequestOrigin(req: NextRequest) {
  const configured = getConfiguredAuthOrigin();
  if (configured) return configured;

  const hostHeader =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const protoHeader =
    req.headers.get("x-forwarded-proto") ||
    req.nextUrl.protocol.replace(":", "") ||
    "https";
  const proto = protoHeader === "http" ? "http" : "https";
  return `${proto}://${hostHeader}`;
}

function resolveDiscordStateCookieDomain(req: NextRequest) {
  const host = String(
    req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || "",
  )
    .split(":")[0]
    .trim()
    .toLowerCase();

  if (!host) return undefined;
  if (host === "wyzer.com.br" || host.endsWith(".wyzer.com.br")) {
    return ".wyzer.com.br";
  }
  return undefined;
}

function applyNoStore(res: NextResponse) {
  res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  res.headers.set("Pragma", NO_STORE_HEADERS.Pragma);
  res.headers.set("Expires", NO_STORE_HEADERS.Expires);
}

function clearDiscordStateCookie(res: NextResponse, req: NextRequest) {
  res.cookies.set({
    name: DISCORD_STATE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  const domain = resolveDiscordStateCookieDomain(req);
  if (domain) {
    res.cookies.set({
      name: DISCORD_STATE_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      domain,
      maxAge: 0,
    });
  }
}

function readDiscordStateTicket(ticket: string) {
  const secret = getTicketSecret();
  if (!secret) {
    return { ok: false as const, error: "SESSION_SECRET/WZ_AUTH_SECRET nao configurado." };
  }

  const token = String(ticket || "").trim();
  if (!token.includes(".")) {
    return { ok: false as const, error: "State OAuth invalido." };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return { ok: false as const, error: "State OAuth invalido." };
  }

  const expected = signTicket(payloadB64, secret);
  if (expected !== sig) {
    return { ok: false as const, error: "State OAuth invalido." };
  }

  try {
    const parsed = JSON.parse(base64UrlDecodeToString(payloadB64)) as DiscordStatePayload;
    if (parsed?.typ !== "wz-discord-oauth-state") {
      return { ok: false as const, error: "State OAuth invalido." };
    }
    if (!parsed.exp || parsed.exp < Date.now()) {
      return { ok: false as const, error: "State OAuth expirado." };
    }
    return { ok: true as const, payload: parsed };
  } catch {
    return { ok: false as const, error: "State OAuth invalido." };
  }
}

function readCookieValuesFromHeader(cookieHeader: string | null | undefined, name: string) {
  const target = String(name || "").trim();
  if (!target) return [] as string[];
  const raw = String(cookieHeader || "");
  if (!raw) return [] as string[];

  const values: string[] = [];
  for (const part of raw.split(";")) {
    const clean = String(part || "").trim();
    if (!clean) continue;
    const eqIdx = clean.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = clean.slice(0, eqIdx).trim();
    if (key !== target) continue;
    const value = clean.slice(eqIdx + 1).trim();
    if (!value) continue;
    values.push(value);
  }
  return values;
}

function buildLoginErrorRedirect(params: {
  origin: string;
  next: string;
  error: string;
}) {
  const url = new URL("/", params.origin);
  const safeNext = sanitizeNext(params.next);
  if (safeNext && safeNext !== "/") {
    url.searchParams.set("returnTo", safeNext);
  }
  url.searchParams.set("oauthError", params.error.slice(0, 220));
  return url.toString();
}

function buildDiscordOnboardingRedirect(params: {
  origin: string;
  next: string;
  email: string;
}) {
  const url = new URL("/", params.origin);
  const safeNext = sanitizeNext(params.next);
  if (safeNext && safeNext !== "/") {
    url.searchParams.set("returnTo", safeNext);
  }
  url.searchParams.set("oauthProvider", "discord");
  url.searchParams.set("oauthEmail", params.email);
  url.searchParams.set("oauthStep", "email");
  return url.toString();
}

function readDiscordIntent(payload?: DiscordStatePayload | null) {
  return payload?.intent === "connect" ? "connect" : "login";
}

function buildDiscordConnectRedirect(params: {
  origin: string;
  next: string;
  ok: boolean;
  error?: string;
}) {
  const safeNext = sanitizeNext(params.next);
  const url = /^https?:\/\//i.test(safeNext)
    ? new URL(safeNext)
    : new URL(safeNext || "/", params.origin);

  if (params.ok) {
    url.searchParams.set("oauthConnect", "ok");
    url.searchParams.set("oauthProvider", "discord");
  } else {
    url.searchParams.set("oauthConnect", "error");
    url.searchParams.set("oauthProvider", "discord");
    url.searchParams.set(
      "oauthError",
      String(params.error || "Falha ao conectar Discord.").slice(0, 220),
    );
  }

  return url.toString();
}

function isMissingColumnError(error: unknown, column: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const needle = String(column || "").trim().toLowerCase();
  if (!needle) return false;
  if (code === "42703" || code === "PGRST204") return true;
  return (
    (message.includes(needle) || details.includes(needle)) &&
    (message.includes("column") || details.includes("column"))
  );
}

function isUniqueViolation(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key");
}

function isCheckViolation(error: unknown, contains: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const needle = String(contains || "").trim().toLowerCase();
  if (!needle) return false;
  return code === "23514" && (message.includes(needle) || details.includes(needle));
}

function isPhoneConstraintViolation(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  return (
    code === "23514" &&
    (message.includes("wz_users_phone_e164_br_chk") ||
      details.includes("wz_users_phone_e164_br_chk") ||
      message.includes("phone_e164") ||
      details.includes("phone_e164"))
  );
}

function isAuthProviderConstraintViolation(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  return (
    code === "23514" &&
    (message.includes("wz_users_auth_provider_chk") ||
      details.includes("wz_users_auth_provider_chk") ||
      message.includes("auth_provider") ||
      details.includes("auth_provider"))
  );
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const columnsToTry = [
    "id,email,full_name,phone_e164,auth_user_id,auth_provider,must_create_password",
    "id,email,full_name,phone_e164,auth_user_id,must_create_password",
    "id,email,full_name,phone_e164,auth_user_id",
    "id,email,full_name,phone_e164",
    "id,email,full_name,auth_user_id",
    "id,email,full_name",
    "id,email",
  ];

  for (const columns of columnsToTry) {
    const base = params.sb.from("wz_users").select(columns).limit(10);
    const res =
      params.mode === "ilike"
        ? await base.ilike(params.column, params.value)
        : await base.eq(params.column, params.value);

    if (!res.error) {
      const rows = (res.data || []) as WzUserRow[];
      return rows.map((row) => ({
        id: normalizeText(row.id),
        email: normalizeEmail(row.email),
        full_name: sanitizeFullName(row.full_name),
        phone_e164: normalizeOptionalPhone(row.phone_e164),
        auth_user_id: normalizeText(row.auth_user_id),
        auth_provider: normalizeText(row.auth_provider),
        must_create_password:
          typeof row.must_create_password === "undefined"
            ? null
            : normalizeBoolean(row.must_create_password),
      }));
    }
  }

  return [] as Array<{
    id: string | null;
    email: string | null;
    full_name: string | null;
    phone_e164: string | null;
    auth_user_id: string | null;
    auth_provider: string | null;
    must_create_password: boolean | null;
  }>;
}

async function findWzUserById(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) return null;

  const columnsToTry = [
    "id,email,full_name",
    "id,email",
    "id",
  ];

  for (const columns of columnsToTry) {
    const res = await params.sb
      .from("wz_users")
      .select(columns)
      .eq("id", userId)
      .maybeSingle();

    if (!res.error) {
      const row = (res.data || {}) as {
        id?: string | null;
        email?: string | null;
        full_name?: string | null;
      };
      const id = normalizeText(row.id);
      if (!id) return null;
      return {
        id,
        email: normalizeEmail(row.email),
        fullName: sanitizeFullName(row.full_name),
      };
    }

    const hasMissingColumn = ["id", "email", "full_name"].some((column) =>
      isMissingColumnError(res.error, column),
    );
    if (!hasMissingColumn) {
      console.error("[discord-callback] find wz_user by id error:", res.error);
      break;
    }
  }

  return null;
}

function pickBestWzUserRow(
  rows: Array<{
    id: string | null;
    email: string | null;
    full_name: string | null;
    phone_e164: string | null;
    auth_user_id: string | null;
    auth_provider: string | null;
    must_create_password: boolean | null;
  }>,
  email?: string | null,
) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    const byEmail = rows.find((row) => normalizeEmail(row.email) === normalizedEmail && row.id);
    if (byEmail) return byEmail;
  }
  return rows.find((row) => row.id) || null;
}

async function updateWzUserBestEffort(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  patch: Record<string, unknown>;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) return;

  const patch = { ...params.patch };
  if (!Object.keys(patch).length) return;

  while (Object.keys(patch).length) {
    const updateRes = await params.sb.from("wz_users").update(patch).eq("id", userId);
    if (!updateRes.error) return;

    if (isPhoneConstraintViolation(updateRes.error)) {
      if (!Object.prototype.hasOwnProperty.call(patch, "phone_e164")) {
        patch.phone_e164 = null;
        continue;
      }
    }
    if (isAuthProviderConstraintViolation(updateRes.error)) {
      if (patch.auth_provider && patch.auth_provider !== "unknown") {
        patch.auth_provider = "unknown";
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "auth_provider")) {
        delete patch.auth_provider;
        continue;
      }
    }

    let removedAny = false;
    for (const key of Object.keys(patch)) {
      if (isMissingColumnError(updateRes.error, key)) {
        delete patch[key];
        removedAny = true;
      }
    }

    if (!removedAny) {
      throw updateRes.error;
    }
  }
}

async function insertDiscordWzUser(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  fullName: string | null;
  authUserId: string;
  nowIso: string;
  mustCreatePassword: boolean;
}) {
  const attempts: Array<Record<string, unknown>> = [
    {
      email: params.email,
      full_name: params.fullName,
      phone_e164: null,
      phone_verified: false,
      auth_user_id: params.authUserId,
      email_verified: true,
      auth_provider: "discord",
      must_create_password: params.mustCreatePassword,
      created_at: params.nowIso,
    },
    {
      email: params.email,
      full_name: params.fullName,
      phone_e164: null,
      auth_user_id: params.authUserId,
      email_verified: true,
      created_at: params.nowIso,
    },
    {
      email: params.email,
      full_name: params.fullName,
      phone_e164: null,
      auth_user_id: params.authUserId,
      created_at: params.nowIso,
    },
    {
      email: params.email,
      full_name: params.fullName,
      phone_e164: null,
      auth_user_id: params.authUserId,
    },
    {
      email: params.email,
      full_name: params.fullName,
      auth_user_id: params.authUserId,
    },
  ];

  let lastError: unknown = null;

  for (const payload of attempts) {
    const insertRes = await params.sb
      .from("wz_users")
      .insert(payload)
      .select("id")
      .single();

    if (!insertRes.error && insertRes.data?.id) {
      return String(insertRes.data.id);
    }

    if (insertRes.error) {
      lastError = insertRes.error;
      if (isAuthProviderConstraintViolation(insertRes.error)) {
        continue;
      }
      const keys = Object.keys(payload);
      const hasMissingColumn = keys.some((key) =>
        isMissingColumnError(insertRes.error, key),
      );
      if (hasMissingColumn) continue;
      throw insertRes.error;
    }
  }

  if (lastError) throw lastError;
  throw new Error("Nao foi possivel inserir usuario wz_users.");
}

async function findOrCreateDiscordWzUser(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  fullName: string | null;
  authUserId: string;
  linkedUserId?: string | null;
  nowIso: string;
  hasPasswordProvider: boolean;
}) {
  const linkedUserId = normalizeText(params.linkedUserId || null);
  const hasPasswordProvider = Boolean(params.hasPasswordProvider);
  let existing: ReturnType<typeof pickBestWzUserRow> = null;

  if (linkedUserId) {
    const rowsByLinkedIdentity = await queryWzUsersRows({
      sb: params.sb,
      column: "id",
      value: linkedUserId,
      mode: "eq",
    });
    existing = pickBestWzUserRow(rowsByLinkedIdentity, params.email);
    if (!existing?.id) {
      const err = new Error("Linked OAuth user not found");
      (err as Error & { code?: string }).code = "WZ_OAUTH_LINKED_USER_NOT_FOUND";
      throw err;
    }
  } else {
    const rowsByAuth = await queryWzUsersRows({
      sb: params.sb,
      column: "auth_user_id",
      value: params.authUserId,
      mode: "eq",
    });
    existing = pickBestWzUserRow(rowsByAuth, params.email);

    if (!existing) {
      const rowsByEmail = await queryWzUsersRows({
        sb: params.sb,
        column: "email",
        value: params.email,
        mode: "ilike",
      });
      existing = pickBestWzUserRow(rowsByEmail, params.email);
    }
  }

  if (existing?.id) {
    const patch: Record<string, unknown> = {};
    if (!existing.auth_user_id) patch.auth_user_id = params.authUserId;
    if (!existing.full_name && params.fullName) patch.full_name = params.fullName;
    if (!normalizeOptionalPhone(existing.phone_e164)) patch.phone_e164 = null;
    const existingMustCreatePassword =
      typeof existing.must_create_password === "boolean"
        ? existing.must_create_password
        : null;
    const resolvedMustCreatePassword = hasPasswordProvider
      ? false
      : existingMustCreatePassword ?? true;
    if (existingMustCreatePassword !== resolvedMustCreatePassword) {
      patch.must_create_password = resolvedMustCreatePassword;
    }

    await updateWzUserBestEffort({
      sb: params.sb,
      userId: existing.id,
      patch,
    });

    return {
      userId: existing.id,
      isNew: false as const,
      mustCreatePassword: resolvedMustCreatePassword,
      phoneE164: normalizeOptionalPhone(existing.phone_e164),
      fullName: existing.full_name || params.fullName || null,
      email: normalizeEmail(existing.email) || params.email,
    };
  }

  try {
    const mustCreatePassword = hasPasswordProvider ? false : true;
    const createdId = await insertDiscordWzUser({
      sb: params.sb,
      email: params.email,
      fullName: params.fullName,
      authUserId: params.authUserId,
      nowIso: params.nowIso,
      mustCreatePassword,
    });
    return {
      userId: createdId,
      isNew: true as const,
      mustCreatePassword,
      phoneE164: null,
      fullName: params.fullName || null,
      email: params.email,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const rowsByEmail = await queryWzUsersRows({
        sb: params.sb,
        column: "email",
        value: params.email,
        mode: "ilike",
      });
      const recovered = pickBestWzUserRow(rowsByEmail, params.email);
      if (recovered?.id) {
        const recoveredMustCreatePassword =
          hasPasswordProvider
            ? false
            : typeof recovered.must_create_password === "boolean"
              ? recovered.must_create_password
              : true;
        await updateWzUserBestEffort({
          sb: params.sb,
          userId: recovered.id,
          patch: {
            ...(recovered.auth_user_id ? {} : { auth_user_id: params.authUserId }),
            ...(typeof recovered.must_create_password === "boolean" &&
            recovered.must_create_password === recoveredMustCreatePassword
              ? {}
              : { must_create_password: recoveredMustCreatePassword }),
          },
        });
        return {
          userId: recovered.id,
          isNew: false as const,
          mustCreatePassword: recoveredMustCreatePassword,
          phoneE164: normalizeOptionalPhone(recovered.phone_e164),
          fullName: recovered.full_name || params.fullName || null,
          email: normalizeEmail(recovered.email) || params.email,
        };
      }
    }

    throw error;
  }
}

function parseDiscordProviderUserId(user: Record<string, unknown>) {
  const identities = Array.isArray(user?.identities)
    ? (user.identities as Array<Record<string, unknown>>)
    : [];
  const discordIdentity = identities.find(
    (identity) => String(identity?.provider || "").trim().toLowerCase() === "discord",
  );
  if (!discordIdentity) return null;

  const directId = normalizeText(String(discordIdentity.id || ""));
  if (directId) return directId;

  const identityData =
    discordIdentity.identity_data && typeof discordIdentity.identity_data === "object"
      ? (discordIdentity.identity_data as Record<string, unknown>)
      : null;
  const bySub = normalizeText(String(identityData?.sub || ""));
  if (bySub) return bySub;
  const byUserId = normalizeText(String(identityData?.user_id || ""));
  if (byUserId) return byUserId;
  return null;
}

async function upsertPendingDiscordOnboarding(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  authUserId: string;
  fullName: string | null;
  phoneE164: string | null;
  nowIso: string;
}) {
  const attempts: Array<Record<string, unknown>> = [
    {
      email: params.email,
      flow: "discord",
      stage: "email",
      auth_user_id: params.authUserId,
      full_name: params.fullName,
      phone_e164: params.phoneE164,
      updated_at: params.nowIso,
    },
    {
      email: params.email,
      flow: "register",
      stage: "email",
      auth_user_id: params.authUserId,
      full_name: params.fullName,
      phone_e164: params.phoneE164,
      updated_at: params.nowIso,
    },
    {
      email: params.email,
      flow: "register",
      stage: "email",
      auth_user_id: params.authUserId,
      full_name: params.fullName,
      updated_at: params.nowIso,
    },
    {
      email: params.email,
      flow: "register",
      stage: "email",
      auth_user_id: params.authUserId,
      updated_at: params.nowIso,
    },
    {
      email: params.email,
      stage: "email",
      auth_user_id: params.authUserId,
      updated_at: params.nowIso,
    },
    {
      email: params.email,
      updated_at: params.nowIso,
    },
  ];

  let lastError: unknown = null;

  for (const payload of attempts) {
    const res = await params.sb
      .from("wz_pending_auth")
      .upsert(payload, { onConflict: "email" });

    if (!res.error) return;

    lastError = res.error;

    const keys = Object.keys(payload);
    const hasMissingColumn = keys.some((key) => isMissingColumnError(res.error, key));
    if (hasMissingColumn) continue;

    const flowCheckViolation =
      isCheckViolation(res.error, "wz_pending_auth") &&
      (String((res.error as { message?: unknown } | null)?.message || "")
        .toLowerCase()
        .includes("flow") ||
        String((res.error as { details?: unknown } | null)?.details || "")
          .toLowerCase()
          .includes("flow"));
    if (flowCheckViolation) continue;

    throw res.error;
  }

  if (lastError) throw lastError;
}

async function createEmailChallenge(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
}) {
  await params.sb
    .from("wz_auth_challenges")
    .update({ consumed: true })
    .eq("email", params.email)
    .eq("channel", "email")
    .eq("consumed", false);

  const emailCode = gen7();
  const salt = newSalt();
  const hash = sha(emailCode, salt);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  const { error } = await params.sb.from("wz_auth_challenges").insert({
    email: params.email,
    channel: "email",
    code_hash: hash,
    salt,
    expires_at: expiresAt,
    attempts_left: 7,
    consumed: false,
  });

  if (error) throw error;
  await sendLoginCodeEmail(params.email, emailCode);
}

async function tryTrustedDiscordBypass(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  req: NextRequest;
  email: string;
  userId: string;
  authUserId: string;
  fullName: string | null;
  nextSafe: string;
}) {
  const trustedToken = readTrustedLoginTokenFromCookieHeader(
    params.req.headers.get("cookie"),
  );
  if (!trustedToken) return null;

  const tokenHash = hashTrustedLoginToken(trustedToken);
  const nowIso = new Date().toISOString();

  const { data: trustedRow, error: trustedErr } = await params.sb
    .from("wz_auth_trusted_devices")
    .select("id")
    .eq("email", params.email)
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (trustedErr) {
    console.error("[discord-callback] trusted device lookup error:", trustedErr);
    return null;
  }

  if (!trustedRow?.id) return null;

  await params.sb
    .from("wz_auth_trusted_devices")
    .update({ last_used_at: nowIso })
    .eq("id", trustedRow.id);

  await params.sb.from("wz_pending_auth").delete().eq("email", params.email);

  const dashboard = getDashboardOrigin();
  const normalizedFullName = sanitizeFullName(params.fullName);

  if (isHostOnlyMode()) {
    const ticket = makeDashboardTicket({
      userId: params.userId,
      email: params.email,
      fullName: normalizedFullName,
    });
    const nextUrl =
      `${dashboard}/api/wz_AuthLogin/exchange` +
      `?ticket=${encodeURIComponent(ticket)}` +
      `&next=${encodeURIComponent(params.nextSafe)}` +
      `&lm=discord` +
      `&lf=login`;

    const res = NextResponse.redirect(nextUrl, 303);
    setSessionCookie(
      res,
      {
        userId: params.userId,
        email: params.email,
        fullName: normalizedFullName || undefined,
      },
      params.req.headers,
    );
    setTrustedLoginCookie(res, trustedToken);
    return res;
  }

  const nextUrl = toDashboardRedirectTarget(params.nextSafe, dashboard);
  const res = NextResponse.redirect(nextUrl, 303);
  const sessionPayload = setSessionCookie(
    res,
    {
      userId: params.userId,
      email: params.email,
      fullName: normalizedFullName || undefined,
    },
    params.req.headers,
  );
  await registerIssuedSession({
    headers: params.req.headers,
    userId: params.userId,
    authUserId: params.authUserId || null,
    email: params.email,
    session: sessionPayload,
    loginMethod: "discord",
    loginFlow: "login",
    isAccountCreationSession: false,
  });
  setTrustedLoginCookie(res, trustedToken);
  return res;
}

type SupabasePkceExchangePayload = {
  user?: Record<string, unknown> | null;
  error?: string;
  error_description?: string;
  message?: string;
  msg?: string;
};

async function exchangeDiscordPkceCode(params: {
  code: string;
  codeVerifier: string;
}) {
  const supabaseUrl = normalizeText(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnon = normalizeText(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !supabaseAnon) {
    return {
      ok: false as const,
      error:
        "Variaveis NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY nao configuradas.",
    };
  }

  const tokenUrl = new URL("/auth/v1/token", `${supabaseUrl}/`);
  tokenUrl.searchParams.set("grant_type", "pkce");

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("apikey", supabaseAnon);
  headers.set("Authorization", `Bearer ${supabaseAnon}`);

  const response = await fetch(tokenUrl.toString(), {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      auth_code: params.code,
      code_verifier: params.codeVerifier,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as SupabasePkceExchangePayload;
  if (!response.ok) {
    const reason = normalizeText(
      payload.error_description || payload.message || payload.msg || payload.error || "",
    );
    return {
      ok: false as const,
      error: reason || "Nao foi possivel validar o codigo OAuth no Supabase.",
    };
  }

  const user =
    payload.user && typeof payload.user === "object"
      ? (payload.user as Record<string, unknown>)
      : null;
  if (!user) {
    return {
      ok: false as const,
      error: "Resposta de autenticacao invalida recebida do Supabase.",
    };
  }

  return { ok: true as const, user };
}

export async function GET(req: NextRequest) {
  const requestOrigin = getRequestOrigin(req);
  const cookieHeader = req.headers.get("cookie");
  const hintedIntentRaw = String(req.nextUrl.searchParams.get("oi") || "").trim().toLowerCase();
  const hintedIntent = hintedIntentRaw === "connect" ? "connect" : "login";

  const stFromQuery = String(req.nextUrl.searchParams.get("st") || "").trim();
  const cookieStateValues = readCookieValuesFromHeader(cookieHeader, DISCORD_STATE_COOKIE_NAME);
  const cookieStateFromApi = String(req.cookies.get(DISCORD_STATE_COOKIE_NAME)?.value || "").trim();
  const stateCandidates = [
    stFromQuery,
    ...cookieStateValues,
    cookieStateFromApi,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  const validStates = stateCandidates
    .map((candidate) => readDiscordStateTicket(candidate))
    .filter(
      (parsed): parsed is Extract<ReturnType<typeof readDiscordStateTicket>, { ok: true }> =>
        parsed.ok,
    )
    .sort((a, b) => Number(b.payload.iat || 0) - Number(a.payload.iat || 0));

  let stateRes: ReturnType<typeof readDiscordStateTicket> = readDiscordStateTicket("");
  if (validStates.length > 0) {
    const preferred =
      hintedIntent === "connect"
        ? validStates.find((parsed) => readDiscordIntent(parsed.payload) === "connect") ||
          validStates[0]
        : validStates[0];
    stateRes = preferred;
  }

  const hintedNext = sanitizeNext(String(req.nextUrl.searchParams.get("rt") || "").trim() || "/");
  const hintedConnectUserId = normalizeText(
    String(req.nextUrl.searchParams.get("cu") || ""),
  );
  const safeNext = stateRes.ok ? sanitizeNext(stateRes.payload.next) : hintedNext;
  let oauthIntent: "login" | "connect" = stateRes.ok
    ? readDiscordIntent(stateRes.payload)
    : hintedIntent;
  const activeSession = await readActiveSessionFromRequest(req, {
    seedIfMissing: false,
  });
  const activeSessionUserId = normalizeText(String(activeSession?.userId || ""));
  if (
    !stateRes.ok &&
    oauthIntent !== "connect" &&
    hintedConnectUserId &&
    activeSessionUserId &&
    activeSessionUserId === hintedConnectUserId
  ) {
    oauthIntent = "connect";
  }

  const fail = (message: string) => {
    const target =
      oauthIntent === "connect"
        ? buildDiscordConnectRedirect({
            origin: requestOrigin,
            next: safeNext,
            ok: false,
            error: message,
          })
        : buildLoginErrorRedirect({
            origin: requestOrigin,
            next: safeNext,
            error: message,
          });
    const res = NextResponse.redirect(
      target,
      303,
    );
    clearDiscordStateCookie(res, req);
    applyNoStore(res);
    return res;
  };

  if (!stateRes.ok) {
    return fail("Sessao OAuth invalida. Tente novamente.");
  }

  const oauthError = normalizeText(
    req.nextUrl.searchParams.get("error_description") ||
      req.nextUrl.searchParams.get("error") ||
      "",
  );
  if (oauthError) {
    return fail(oauthError);
  }

  const code = String(req.nextUrl.searchParams.get("code") || "").trim();
  if (!code) {
    return fail("Codigo OAuth ausente. Reinicie o login com Discord.");
  }

  try {
    const codeVerifier = normalizePkceVerifier(
      stateRes.ok ? String(stateRes.payload.cv || "") : "",
    );
    if (!codeVerifier) {
      return fail("Sessao OAuth invalida. Reinicie o login com Discord.");
    }

    const exchange = await exchangeDiscordPkceCode({
      code,
      codeVerifier,
    });
    if (!exchange.ok) {
      console.error("[discord-callback] PKCE exchange error:", exchange.error);
      return fail(
        "Nao foi possivel validar o retorno do Discord. Confira as URLs de redirecionamento.",
      );
    }

    const user = exchange.user;
    const authUserId = normalizeText(String(user.id || ""));
    const email = normalizeEmail(String(user.email || ""));
    const userMetadata =
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : null;
    const fullName =
      sanitizeFullName(
        String(userMetadata?.full_name || userMetadata?.name || "").trim(),
      ) || null;
    const discordUsername =
      sanitizeFullName(
        String(
          userMetadata?.preferred_username ||
            userMetadata?.username ||
            userMetadata?.user_name ||
            userMetadata?.global_name ||
            "",
        ).trim(),
      ) || null;

    if (!authUserId || !email) {
      return fail("Conta Discord sem e-mail valido. Tente outra conta.");
    }
    const hasPasswordProvider = hasPasswordProviderInAuthUser(user);

    const sb = supabaseAdmin();
    const nowIso = new Date().toISOString();
    const providerUserId = parseDiscordProviderUserId(user);
    const identityLookup = await findLinkedUserByProviderIdentity({
      sb,
      provider: "discord",
      authUserId,
      providerUserId,
    });
    if (identityLookup.conflict) {
      return fail("Conflito de vinculo do Discord detectado. Contate o suporte.");
    }
    if (!identityLookup.lookupOk && identityLookup.schemaReady) {
      return fail(
        "Nao foi possivel validar o vinculo da conta Discord agora. Tente novamente em instantes.",
      );
    }
    const linkedUserId = identityLookup.lookupOk ? identityLookup.userId : null;

    if (oauthIntent === "connect") {
      const expectedUserId = normalizeText(
        stateRes.ok
          ? String(stateRes.payload.connect_user_id || "")
          : String(hintedConnectUserId || ""),
      );
      if (!expectedUserId) {
        return fail("Sessao invalida para conectar Discord.");
      }
      if (activeSessionUserId && activeSessionUserId !== expectedUserId) {
        return fail("Sessao invalida para conectar Discord.");
      }

      const targetUser = await findWzUserById({
        sb,
        userId: expectedUserId,
      });
      if (!targetUser?.id) {
        return fail("Conta local nao encontrada para conectar Discord.");
      }

      if (linkedUserId && linkedUserId !== targetUser.id) {
        return fail("Esta conta Discord ja esta conectada a outra conta.");
      }

      const connectUpsert = await upsertLoginProviderRecord({
        sb,
        userId: targetUser.id,
        authUserId,
        email,
        provider: "discord",
        providerUserId,
        metadata: {
          fullName,
          username: discordUsername,
          avatarUrl: normalizeText(String(userMetadata?.avatar_url || userMetadata?.picture || "")),
        },
        nowIso,
      });
      if (!connectUpsert.ok) {
        if (!connectUpsert.schemaReady) {
          return fail("Schema de provedores nao disponivel para conectar Discord.");
        }
        return fail("Nao foi possivel conectar Discord nesta conta.");
      }

      const successUrl = buildDiscordConnectRedirect({
        origin: requestOrigin,
        next: safeNext,
        ok: true,
      });
      const res = NextResponse.redirect(successUrl, 303);
      clearDiscordStateCookie(res, req);
      applyNoStore(res);
      return res;
    }

    const wzUser = await findOrCreateDiscordWzUser({
      sb,
      email,
      fullName,
      authUserId,
      linkedUserId,
      nowIso,
      hasPasswordProvider,
    });
    const accountEmail = normalizeEmail(wzUser.email) || email;

    const loginUpsert = await upsertLoginProviderRecord({
      sb,
      userId: wzUser.userId,
      authUserId,
      email,
      provider: "discord",
      providerUserId,
      metadata: {
        fullName,
        username: discordUsername,
        avatarUrl: normalizeText(String(userMetadata?.avatar_url || userMetadata?.picture || "")),
      },
      nowIso,
    });
    if (!loginUpsert.ok) {
      if (!loginUpsert.schemaReady) {
        console.warn("[discord-callback] login provider schema not ready; continuing without provider link");
      } else {
        console.error("[discord-callback] failed to persist Discord login provider link");
      }
    }

    const discordPhoneCandidate = extractDiscordPhoneCandidate(user);
    const currentPhone = normalizeOptionalPhone(wzUser.phoneE164);
    const effectivePhone = currentPhone || discordPhoneCandidate || null;

    if (!currentPhone && discordPhoneCandidate) {
      await updateWzUserBestEffort({
        sb,
        userId: wzUser.userId,
        patch: {
          phone_e164: discordPhoneCandidate,
        },
      });
    }

    if (!wzUser.isNew) {
      const trustedRedirect = await tryTrustedDiscordBypass({
        sb,
        req,
        email: accountEmail,
        userId: wzUser.userId,
        authUserId,
        fullName: wzUser.fullName || fullName,
        nextSafe: safeNext,
      });
      if (trustedRedirect) {
        clearDiscordStateCookie(trustedRedirect, req);
        applyNoStore(trustedRedirect);
        return trustedRedirect;
      }
    }

    await upsertPendingDiscordOnboarding({
      sb,
      email: accountEmail,
      authUserId,
      fullName: wzUser.fullName || fullName,
      phoneE164: effectivePhone,
      nowIso,
    });

    await createEmailChallenge({
      sb,
      email: accountEmail,
    });

    const successUrl = buildDiscordOnboardingRedirect({
      origin: requestOrigin,
      next: safeNext,
      email: accountEmail,
    });
    const res = NextResponse.redirect(successUrl, 303);
    clearDiscordStateCookie(res, req);
    applyNoStore(res);
    return res;
  } catch (error) {
    console.error("[discord-callback] error:", error);
    const errCode =
      typeof (error as { code?: unknown } | null)?.code === "string"
        ? String((error as { code?: string }).code)
        : "";
    if (errCode === "WZ_OAUTH_LINKED_USER_NOT_FOUND") {
      return fail(
        "Conta Discord vinculada com referencia invalida. Contate o suporte para corrigir o vinculo.",
      );
    }
    if (isPhoneConstraintViolation(error)) {
      return fail(
        "Nao foi possivel concluir seu cadastro Discord por regra de telefone da conta. Tente novamente em instantes.",
      );
    }
    return fail("Erro inesperado no login Discord. Tente novamente.");
  }
}
