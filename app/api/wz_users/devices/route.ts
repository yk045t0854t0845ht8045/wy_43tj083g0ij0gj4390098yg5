import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { resolveDeviceIdentity } from "@/app/api/wz_AuthLogin/_device_identity";
import {
  isSessionDevicesSchemaMissingError,
  type SessionLoginFlow,
  type SessionLoginMethod,
} from "@/app/api/wz_AuthLogin/_session_devices";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type SessionRow = {
  id?: string | null;
  sid?: string | null;
  device_id?: string | null;
  login_method?: string | null;
  login_flow?: string | null;
  is_account_creation_session?: boolean | number | string | null;
  issued_at?: string | null;
  last_seen_at?: string | null;
  revoked_at?: string | null;
  host?: string | null;
  ip?: string | null;
  location?: string | null;
  user_agent?: string | null;
};

type DeviceRow = {
  id?: string | null;
  device_kind?: string | null;
  platform?: string | null;
  os_family?: string | null;
  os_version?: string | null;
  browser_family?: string | null;
  browser_version?: string | null;
  device_brand?: string | null;
  device_model?: string | null;
  device_label?: string | null;
  last_ip?: string | null;
  last_location?: string | null;
};

type DeviceSessionPayload = {
  id: string;
  sid: string;
  deviceId: string | null;
  label: string;
  kind: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  platform: string | null;
  location: string | null;
  host: string | null;
  loginMethod: SessionLoginMethod | "unknown";
  loginFlow: SessionLoginFlow | "unknown";
  isAccountCreationSession: boolean;
  issuedAt: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function decodeUriComponentSafe(value: string) {
  let out = String(value || "");
  for (let i = 0; i < 2; i += 1) {
    if (!/%[0-9a-f]{2}/i.test(out)) break;
    try {
      const decoded = decodeURIComponent(out);
      if (!decoded || decoded === out) break;
      out = decoded;
    } catch {
      break;
    }
  }
  return out;
}

function normalizeLocationText(value?: string | null) {
  const clean = normalizeText(value);
  if (!clean) return null;
  const spaced = clean.replace(/\+/g, " ");
  const decoded = decodeUriComponentSafe(spaced).trim();
  return decoded || clean;
}

function normalizeKind(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  if (
    clean === "desktop" ||
    clean === "mobile" ||
    clean === "tablet" ||
    clean === "bot"
  ) {
    return clean;
  }
  return "unknown";
}

function normalizeLoginMethod(value?: string | null): SessionLoginMethod | "unknown" {
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

function normalizeLoginFlow(value?: string | null): SessionLoginFlow | "unknown" {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "login" || clean === "register") return clean;
  return "unknown";
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

function normalizeIso(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parseIsoMs(value?: string | null) {
  const iso = normalizeIso(value);
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferKindFromUserAgent(userAgent?: string | null) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return "unknown" as const;
  if (/bot|crawler|spider|headless|phantom/i.test(ua)) return "bot" as const;
  if (/ipad|tablet|kindle|silk|sm-t|tab\s/i.test(ua)) return "tablet" as const;
  if (/mobi|iphone|android|mobile|windows phone|opera mini/i.test(ua)) {
    return "mobile" as const;
  }
  return "desktop" as const;
}

function buildDeviceLabel(device: DeviceRow | null) {
  const explicit = normalizeText(device?.device_label);
  if (explicit) return explicit.toUpperCase();

  const brand = normalizeText(device?.device_brand);
  const model = normalizeText(device?.device_model);
  if (brand || model) {
    const modelStartsWithBrand =
      Boolean(brand) &&
      Boolean(model) &&
      String(model).toLowerCase().startsWith(String(brand).toLowerCase());
    const mobileLabel = model
      ? brand && !modelStartsWithBrand
        ? `${brand} ${model}`
        : model
      : brand;

    if (mobileLabel) return mobileLabel.toUpperCase();
  }

  const os = normalizeText(device?.os_family) || "DESCONHECIDO";
  const browser = normalizeText(device?.browser_family) || "NAVEGADOR";
  return `${os} - ${browser}`.toUpperCase();
}

function buildLocation(device: DeviceRow | null, session: SessionRow) {
  const location =
    normalizeLocationText(device?.last_location) ||
    normalizeLocationText(session.location) ||
    null;
  const host = normalizeText(session.host);
  if (!location && !host) return null;
  if (location && host) return `${location} (${host})`;
  return location || host;
}

function compareByActivityDesc(a: DeviceSessionPayload, b: DeviceSessionPayload) {
  const aMs = parseIsoMs(a.lastSeenAt || a.issuedAt);
  const bMs = parseIsoMs(b.lastSeenAt || b.issuedAt);
  if (aMs !== bMs) return bMs - aMs;
  return b.id.localeCompare(a.id);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const clean = String(value || "").trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

function okJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function fallbackPayloadForMissingSchema(req: NextRequest) {
  const identity = resolveDeviceIdentity(req.headers, {
    sessionDid: null,
  });

  const current: DeviceSessionPayload = {
    id: "current",
    sid: "",
    deviceId: null,
    label: String(identity.label || "DISPOSITIVO ATUAL").toUpperCase(),
    kind: identity.kind,
    platform: identity.platform,
    location: identity.location,
    host: identity.host,
    loginMethod: "unknown",
    loginFlow: "unknown",
    isAccountCreationSession: false,
    issuedAt: null,
    lastSeenAt: new Date().toISOString(),
    revokedAt: null,
    userAgent: identity.userAgent || null,
    isCurrent: true,
  };

  return {
    ok: true,
    schemaReady: false,
    current,
    others: [] as DeviceSessionPayload[],
    history: [] as DeviceSessionPayload[],
    summary: {
      totalSessions: 1,
      activeSessions: 1,
      currentSessionKind: current.kind,
      accountCreationSession: null,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function GET(req: NextRequest) {
  const activeSession = await readActiveSessionFromRequest(req);
  if (!activeSession) {
    return okJson({ ok: false, error: "Nao autenticado." }, 401);
  }

  const userId = String(activeSession.userId || "").trim();
  const currentSid = String(activeSession.sid || "").trim();
  if (!userId) {
    return okJson({ ok: false, error: "Sessao invalida." }, 401);
  }

  const sb = supabaseAdmin();

  const sessionsRes = await sb
    .from("wz_auth_sessions")
    .select(
      "id,sid,device_id,login_method,login_flow,is_account_creation_session,issued_at,last_seen_at,revoked_at,host,ip,location,user_agent",
    )
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .order("issued_at", { ascending: false })
    .limit(250);

  if (sessionsRes.error) {
    if (isSessionDevicesSchemaMissingError(sessionsRes.error)) {
      return okJson(fallbackPayloadForMissingSchema(req));
    }
    console.error("[devices] list sessions error:", sessionsRes.error);
    return okJson({ ok: false, error: "Falha ao carregar dispositivos." }, 500);
  }

  const sessionRows = (sessionsRes.data || []) as SessionRow[];

  const deviceIds = uniqueStrings(sessionRows.map((row) => normalizeText(row.device_id)));
  let deviceMap = new Map<string, DeviceRow>();

  if (deviceIds.length > 0) {
    const devicesRes = await sb
      .from("wz_auth_user_devices")
      .select(
        "id,device_kind,platform,os_family,os_version,browser_family,browser_version,device_brand,device_model,device_label,last_ip,last_location",
      )
      .in("id", deviceIds);

    if (devicesRes.error) {
      if (!isSessionDevicesSchemaMissingError(devicesRes.error)) {
        console.error("[devices] list user devices error:", devicesRes.error);
      }
    } else {
      const rows = (devicesRes.data || []) as DeviceRow[];
      deviceMap = new Map(
        rows
          .map((row) => {
            const id = normalizeText(row.id);
            if (!id) return null;
            return [id, row] as const;
          })
          .filter((entry): entry is readonly [string, DeviceRow] => Boolean(entry)),
      );
    }
  }

  const allSessions = sessionRows
    .map((row) => {
      const id = normalizeText(row.id);
      const sid = normalizeText(row.sid);
      if (!id || !sid) return null;

      const device = deviceMap.get(String(row.device_id || "").trim()) || null;
      const issuedAt = normalizeIso(row.issued_at);
      const lastSeenAt = normalizeIso(row.last_seen_at) || issuedAt;
      const revokedAt = normalizeIso(row.revoked_at);
      const kindFromDevice = normalizeKind(device?.device_kind);
      const kind =
        kindFromDevice === "unknown"
          ? inferKindFromUserAgent(row.user_agent)
          : kindFromDevice;

      const payload: DeviceSessionPayload = {
        id,
        sid,
        deviceId: normalizeText(row.device_id),
        label: buildDeviceLabel(device),
        kind,
        platform: normalizeText(device?.platform),
        location: buildLocation(device, row),
        host: normalizeText(row.host),
        loginMethod: normalizeLoginMethod(row.login_method),
        loginFlow: normalizeLoginFlow(row.login_flow),
        isAccountCreationSession: normalizeBoolean(row.is_account_creation_session),
        issuedAt,
        lastSeenAt,
        revokedAt,
        userAgent: normalizeText(row.user_agent),
        isCurrent: sid === currentSid,
      };

      return payload;
    })
    .filter((item): item is DeviceSessionPayload => Boolean(item))
    .sort(compareByActivityDesc);

  const current =
    allSessions.find((item) => item.isCurrent && !item.revokedAt) ||
    allSessions.find((item) => item.isCurrent) ||
    null;

  const others = allSessions.filter((item) => !item.isCurrent && !item.revokedAt);
  const history = allSessions.filter((item) => Boolean(item.revokedAt));

  const accountCreationSession =
    [...allSessions]
      .filter(
        (item) => item.isAccountCreationSession || item.loginFlow === "register",
      )
      .sort((a, b) => parseIsoMs(a.issuedAt) - parseIsoMs(b.issuedAt))[0] || null;

  return okJson({
    ok: true,
    schemaReady: true,
    current,
    others,
    history,
    summary: {
      totalSessions: allSessions.length,
      activeSessions: allSessions.filter((item) => !item.revokedAt).length,
      currentSessionKind: current?.kind || null,
      accountCreationSession,
      generatedAt: new Date().toISOString(),
    },
  });
}

export async function DELETE(req: NextRequest) {
  const activeSession = await readActiveSessionFromRequest(req);
  if (!activeSession) {
    return okJson({ ok: false, error: "Nao autenticado." }, 401);
  }

  const userId = String(activeSession.userId || "").trim();
  const currentSid = String(activeSession.sid || "").trim();
  if (!userId) {
    return okJson({ ok: false, error: "Sessao invalida." }, 401);
  }

  const body = (await req.json().catch(() => ({}))) as {
    allOthers?: boolean;
    sessionId?: string;
    sid?: string;
    id?: string;
  };

  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();

  if (Boolean(body?.allOthers)) {
    const updateRes = await sb
      .from("wz_auth_sessions")
      .update({
        revoked_at: nowIso,
        revoked_reason: "manual_signout_all_others",
        updated_at: nowIso,
      })
      .eq("user_id", userId)
      .neq("sid", currentSid)
      .is("revoked_at", null)
      .select("id");

    if (updateRes.error) {
      if (isSessionDevicesSchemaMissingError(updateRes.error)) {
        return okJson({ ok: true, schemaReady: false, revokedCount: 0 });
      }
      console.error("[devices] revoke all others error:", updateRes.error);
      return okJson({ ok: false, error: "Falha ao revogar dispositivos." }, 500);
    }

    return okJson({
      ok: true,
      schemaReady: true,
      revokedCount: Array.isArray(updateRes.data) ? updateRes.data.length : 0,
    });
  }

  const targetSessionId = String(body?.sessionId || body?.id || "").trim();
  const targetSid = String(body?.sid || "").trim();

  if (!targetSessionId && !targetSid) {
    return okJson({ ok: false, error: "Informe o dispositivo para deslogar." }, 400);
  }

  const lookup = targetSessionId
    ? await sb
        .from("wz_auth_sessions")
        .select("id,sid")
        .eq("user_id", userId)
        .eq("id", targetSessionId)
        .maybeSingle()
    : await sb
        .from("wz_auth_sessions")
        .select("id,sid")
        .eq("user_id", userId)
        .eq("sid", targetSid)
        .maybeSingle();

  if (lookup.error) {
    if (isSessionDevicesSchemaMissingError(lookup.error)) {
      return okJson({ ok: true, schemaReady: false, revoked: false });
    }
    console.error("[devices] lookup session error:", lookup.error);
    return okJson({ ok: false, error: "Falha ao localizar dispositivo." }, 500);
  }

  if (!lookup.data?.id) {
    return okJson({ ok: false, error: "Dispositivo nao encontrado." }, 404);
  }

  const targetResolvedSid = String((lookup.data as { sid?: unknown }).sid || "").trim();
  if (targetResolvedSid && targetResolvedSid === currentSid) {
    return okJson(
      { ok: false, error: "Nao e permitido deslogar a sessao atual por este endpoint." },
      400,
    );
  }

  const revokeRes = await sb
    .from("wz_auth_sessions")
    .update({
      revoked_at: nowIso,
      revoked_reason: "manual_signout_single",
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .eq("id", String(lookup.data.id))
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (revokeRes.error) {
    if (isSessionDevicesSchemaMissingError(revokeRes.error)) {
      return okJson({ ok: true, schemaReady: false, revoked: false });
    }
    console.error("[devices] revoke session error:", revokeRes.error);
    return okJson({ ok: false, error: "Falha ao deslogar dispositivo." }, 500);
  }

  return okJson({ ok: true, schemaReady: true, revoked: Boolean(revokeRes.data?.id) });
}
