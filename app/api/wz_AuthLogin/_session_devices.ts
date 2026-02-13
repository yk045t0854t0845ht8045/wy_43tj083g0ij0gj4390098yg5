import { supabaseAdmin } from "./_supabase";
import { resolveDeviceIdentity, type HeaderLike } from "./_device_identity";
import type { SessionPayload } from "./_session";

export type SessionLoginMethod =
  | "password"
  | "email_code"
  | "sms_code"
  | "totp"
  | "passkey"
  | "trusted"
  | "exchange"
  | "sync"
  | "unknown";

export type SessionLoginFlow = "login" | "register" | "unknown";

type RegisterIssuedSessionParams = {
  headers: HeaderLike;
  userId: string;
  authUserId?: string | null;
  email: string;
  session: SessionPayload;
  loginMethod?: SessionLoginMethod | string;
  loginFlow?: SessionLoginFlow | string;
  isAccountCreationSession?: boolean;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLoginMethod(value?: string | null): SessionLoginMethod {
  const clean = String(value || "").trim().toLowerCase();
  if (
    clean === "password" ||
    clean === "email_code" ||
    clean === "sms_code" ||
    clean === "totp" ||
    clean === "passkey" ||
    clean === "trusted" ||
    clean === "exchange" ||
    clean === "sync"
  ) {
    return clean;
  }
  return "unknown";
}

function normalizeLoginFlow(value?: string | null): SessionLoginFlow {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "login" || clean === "register") return clean;
  return "unknown";
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

function isMissingTableError(error: unknown, table: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const needle = String(table || "").trim().toLowerCase();
  if (!needle) return false;
  if (code === "42P01" || code === "PGRST205") return true;
  return (
    (message.includes(needle) || details.includes(needle)) &&
    (message.includes("does not exist") ||
      details.includes("does not exist") ||
      message.includes("relation") ||
      details.includes("relation") ||
      message.includes("table") ||
      details.includes("table"))
  );
}

function isSessionDevicesSchemaMissing(error: unknown) {
  return (
    isMissingTableError(error, "wz_auth_user_devices") ||
    isMissingTableError(error, "wz_auth_sessions") ||
    isMissingColumnError(error, "device_fingerprint") ||
    isMissingColumnError(error, "sid") ||
    isMissingColumnError(error, "login_method")
  );
}

function parseMs(value?: string | null) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : 0;
}

async function resolveOrCreateDevice(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  identity: ReturnType<typeof resolveDeviceIdentity>;
  userId: string;
  authUserId?: string | null;
  email: string;
  nowIso: string;
}) {
  const { sb, identity, userId, authUserId, email, nowIso } = params;

  const lookup = await sb
    .from("wz_auth_user_devices")
    .select("id,login_count")
    .eq("user_id", userId)
    .eq("device_fingerprint", identity.fingerprint)
    .maybeSingle();

  if (lookup.error) throw lookup.error;

  if (lookup.data?.id) {
    const nextCount = Math.max(1, Number((lookup.data as { login_count?: unknown }).login_count || 0) + 1);
    const updateRes = await sb
      .from("wz_auth_user_devices")
      .update({
        email,
        auth_user_id: authUserId || null,
        device_kind: identity.kind,
        platform: identity.platform,
        os_family: identity.osFamily,
        os_version: identity.osVersion,
        browser_family: identity.browserFamily,
        browser_version: identity.browserVersion,
        device_label: identity.label,
        user_agent: identity.userAgent || null,
        last_ip: identity.ip,
        last_location: identity.location,
        last_seen_at: nowIso,
        login_count: nextCount,
        updated_at: nowIso,
      })
      .eq("id", String(lookup.data.id))
      .select("id")
      .single();

    if (updateRes.error) throw updateRes.error;
    return String(updateRes.data.id);
  }

  const insertRes = await sb
    .from("wz_auth_user_devices")
    .insert({
      user_id: userId,
      auth_user_id: authUserId || null,
      email,
      device_fingerprint: identity.fingerprint,
      device_kind: identity.kind,
      platform: identity.platform,
      os_family: identity.osFamily,
      os_version: identity.osVersion,
      browser_family: identity.browserFamily,
      browser_version: identity.browserVersion,
      device_label: identity.label,
      user_agent: identity.userAgent || null,
      first_ip: identity.ip,
      last_ip: identity.ip,
      first_location: identity.location,
      last_location: identity.location,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      login_count: 1,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();

  if (insertRes.error) throw insertRes.error;
  return String(insertRes.data.id);
}

async function findLatestSessionByDevice(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  deviceId: string;
}) {
  const { sb, userId, deviceId } = params;
  const lookup = await sb
    .from("wz_auth_sessions")
    .select("id,sid,revoked_at,last_seen_at,issued_at")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .order("last_seen_at", { ascending: false })
    .order("issued_at", { ascending: false })
    .limit(1);

  if (lookup.error) throw lookup.error;

  const row = Array.isArray(lookup.data) ? lookup.data[0] : null;
  const id = String((row as { id?: unknown } | null)?.id || "").trim();
  if (!id) return null;
  return id;
}

export async function registerIssuedSession(params: RegisterIssuedSessionParams) {
  const sid = String(params.session?.sid || "").trim();
  const userId = String(params.userId || "").trim();
  const email = normalizeEmail(params.email);

  if (!sid || !userId || !email) return;

  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const identity = resolveDeviceIdentity(params.headers, {
    sessionDid: params.session?.did || null,
  });

  try {
    const deviceId = await resolveOrCreateDevice({
      sb,
      identity,
      userId,
      authUserId: params.authUserId,
      email,
      nowIso,
    });

    const sessionPayload = {
      user_id: userId,
      auth_user_id: String(params.authUserId || "").trim() || null,
      email,
      sid,
      did_hash: String(params.session?.did || "").trim() || null,
      device_id: deviceId,
      login_method: normalizeLoginMethod(params.loginMethod),
      login_flow: normalizeLoginFlow(params.loginFlow),
      is_account_creation_session: Boolean(params.isAccountCreationSession),
      issued_at: nowIso,
      last_seen_at: nowIso,
      revoked_at: null as string | null,
      host: identity.host,
      ip: identity.ip,
      location: identity.location,
      user_agent: identity.userAgent || null,
      updated_at: nowIso,
    };

    const reusableSessionId = await findLatestSessionByDevice({
      sb,
      userId,
      deviceId,
    });

    const sessionUpsert = reusableSessionId
      ? await sb
          .from("wz_auth_sessions")
          .update(sessionPayload)
          .eq("id", reusableSessionId)
          .select("id")
          .single()
      : await sb
          .from("wz_auth_sessions")
          .upsert(sessionPayload, {
            onConflict: "user_id,sid",
            ignoreDuplicates: false,
          })
          .select("id")
          .single();

    if (sessionUpsert.error) throw sessionUpsert.error;
  } catch (error) {
    if (isSessionDevicesSchemaMissing(error)) return;
    console.error("[session-devices] registerIssuedSession error:", error);
  }
}

export async function validateAndTouchSession(params: {
  session: SessionPayload;
  headers: HeaderLike;
  touchWindowMs?: number;
  seedIfMissing?: boolean;
}) {
  const sid = String(params.session?.sid || "").trim();
  const userId = String(params.session?.userId || "").trim();
  const email = normalizeEmail(params.session?.email);
  if (!sid || !userId || !email) {
    return { active: true as const, reason: "legacy" as const };
  }

  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();

  try {
    const lookup = await sb
      .from("wz_auth_sessions")
      .select("id,revoked_at,last_seen_at")
      .eq("user_id", userId)
      .eq("sid", sid)
      .maybeSingle();

    if (lookup.error) throw lookup.error;

    if (!lookup.data) {
      if (params.seedIfMissing === false) {
        return { active: true as const, reason: "missing" as const };
      }

      await registerIssuedSession({
        headers: params.headers,
        userId,
        email,
        session: params.session,
        loginMethod: "unknown",
        loginFlow: "unknown",
      });
      return { active: true as const, reason: "seeded" as const };
    }

    const revokedAt = String((lookup.data as { revoked_at?: unknown }).revoked_at || "").trim();
    if (revokedAt) {
      return { active: false as const, reason: "revoked" as const };
    }

    const touchWindowMs = Math.max(30000, Number(params.touchWindowMs || 120000));
    const lastSeen = String((lookup.data as { last_seen_at?: unknown }).last_seen_at || "");
    const ageMs = Date.now() - parseMs(lastSeen);

    if (!Number.isFinite(ageMs) || ageMs > touchWindowMs) {
      await sb
        .from("wz_auth_sessions")
        .update({
          last_seen_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", String((lookup.data as { id?: unknown }).id || ""));
    }

    return { active: true as const, reason: "ok" as const };
  } catch (error) {
    if (isSessionDevicesSchemaMissing(error)) {
      return { active: true as const, reason: "schema-missing" as const };
    }
    console.error("[session-devices] validateAndTouchSession error:", error);
    return { active: true as const, reason: "soft-fail" as const };
  }
}

export function isSessionDevicesSchemaMissingError(error: unknown) {
  return isSessionDevicesSchemaMissing(error);
}
