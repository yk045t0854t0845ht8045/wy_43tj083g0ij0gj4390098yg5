// app/(dashboard)/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { readActiveSessionFromCookie } from "@/app/api/wz_AuthLogin/_active_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import DashboardShell from "./_components/DashboardShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SidebarProfile = {
  firstName: string | null;
  fullName: string | null;
  photoLink: string | null;
  phoneE164: string | null;
  emailChangedAt: string | null;
  phoneChangedAt: string | null;
  passwordChangedAt: string | null;
  supportAccess: boolean;
  twoFactorEnabled: boolean;
  twoFactorEnabledAt: string | null;
  twoFactorDisabledAt: string | null;
};

type WzUserLookupMode = "eq" | "ilike";

type WzUserLookupParams = {
  column: string;
  value: string;
  mode: WzUserLookupMode;
};

type WzUserLookupRow = {
  full_name?: string | null;
  photo_link?: string | null;
  phone_e164?: string | null;
  email_changed_at?: string | null;
  phone_changed_at?: string | null;
  password_changed_at?: string | null;
  support_access?: boolean | string | number | null;
  two_factor_enabled?: boolean | string | number | null;
  two_factor_secret?: string | null;
  two_factor_enabled_at?: string | null;
  two_factor_disabled_at?: string | null;
};

type WzAuth2faLookupRow = {
  enabled?: boolean | string | number | null;
  secret?: string | null;
  enabled_at?: string | null;
  disabled_at?: string | null;
};

type TwoFactorLookupState = {
  enabled: boolean;
  enabledAt: string | null;
  disabledAt: string | null;
};

function buildLoginUrl(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();

  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://login.localhost:3000/";
  }

  if (host.endsWith(".wyzer.com.br")) {
    return "https://login.wyzer.com.br/";
  }

  return "https://login.wyzer.com.br/";
}

function pickHostHeader(h: { get(name: string): string | null }) {
  return h.get("x-forwarded-host") || h.get("host");
}

function isLocalDevHost(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();
  return host.endsWith(".localhost") || host === "localhost";
}

function pickFirstName(fullName?: string | null) {
  const clean = String(fullName || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;

  const first = clean.split(" ")[0] || "";
  return first ? first.slice(0, 24) : null;
}

function sanitizeFullName(fullName?: string | null) {
  const clean = String(fullName || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.slice(0, 120);
}

function sanitizePhotoLink(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  return clean.slice(0, 2048);
}

function sanitizePhoneE164(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  if (!/^\+55\d{11}$/.test(clean)) return null;
  return clean;
}

function sanitizeIsoDatetime(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

async function getAuthUserCreatedAt(userId?: string | null) {
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) return null;

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.auth.admin.getUserById(cleanUserId);
    if (error) {
      console.error("[dashboard] failed to load auth user created_at:", error);
      return null;
    }
    return sanitizeIsoDatetime(
      typeof data?.user?.created_at === "string" ? data.user.created_at : null,
    );
  } catch (error) {
    console.error("[dashboard] unexpected error loading auth user created_at:", error);
    return null;
  }
}

function sanitizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "true" || clean === "t" || clean === "1";
  }
  return false;
}

function sanitizeSupportAccessValue(value: unknown) {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    if (!clean) return null;
    return clean === "1" || clean === "true" || clean === "t";
  }
  return null;
}

function resolveTwoFactorEnabled(
  rawEnabled: unknown,
  rawSecret?: string | null,
) {
  const enabled = sanitizeBoolean(rawEnabled);
  const hasSecret = Boolean(String(rawSecret || "").trim());
  return enabled && hasSecret;
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
  if (code === "42703" || code === "PGRST204") return true;
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
  return (
    isMissingTableError(error, "wz_auth_2fa") ||
    isMissingColumnError(error, "user_id") ||
    isMissingColumnError(error, "enabled") ||
    isMissingColumnError(error, "secret") ||
    isMissingColumnError(error, "enabled_at") ||
    isMissingColumnError(error, "disabled_at")
  );
}

async function queryWzAuth2faState(
  sb: ReturnType<typeof supabaseAdmin>,
  userId: string,
) {
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) {
    return {
      schemaAvailable: false,
      state: null as TwoFactorLookupState | null,
    };
  }

  const { data, error } = await sb
    .from("wz_auth_2fa")
    .select("enabled,secret,enabled_at,disabled_at")
    .eq("user_id", cleanUserId)
    .maybeSingle();

  if (!error) {
    if (!data) {
      return {
        schemaAvailable: true,
        state: null as TwoFactorLookupState | null,
      };
    }

    const row = data as unknown as WzAuth2faLookupRow;
    const enabled = resolveTwoFactorEnabled(row.enabled, row.secret);
    const enabledAt = sanitizeIsoDatetime(row.enabled_at);
    const disabledAt = enabled ? null : sanitizeIsoDatetime(row.disabled_at);

    return {
      schemaAvailable: true,
      state: {
        enabled,
        enabledAt,
        disabledAt,
      } as TwoFactorLookupState,
    };
  }

  if (isWzAuth2faSchemaError(error)) {
    return {
      schemaAvailable: false,
      state: null as TwoFactorLookupState | null,
    };
  }

  console.error("[dashboard] failed to query wz_auth_2fa:", error);
  return {
    schemaAvailable: false,
    state: null as TwoFactorLookupState | null,
  };
}

async function queryWzUsersRows(
  sb: ReturnType<typeof supabaseAdmin>,
  params: WzUserLookupParams,
) {
  const columnsToTry = [
    "full_name,photo_link,phone_e164,email_changed_at,phone_changed_at,password_changed_at,support_access,two_factor_enabled,two_factor_secret,two_factor_enabled_at,two_factor_disabled_at",
    "full_name,photo_link,phone_e164,email_changed_at,phone_changed_at,password_changed_at,support_access",
    "full_name,photo_link,phone_e164,email_changed_at,phone_changed_at,password_changed_at,two_factor_enabled,two_factor_secret,two_factor_enabled_at,two_factor_disabled_at",
    "full_name,photo_link,phone_e164,email_changed_at,phone_changed_at,password_changed_at,two_factor_enabled,two_factor_secret,two_factor_enabled_at",
    "full_name,photo_link,phone_e164,email_changed_at,phone_changed_at,password_changed_at,two_factor_enabled,two_factor_secret",
    "full_name,photo_link,phone_e164,email_changed_at,phone_changed_at,password_changed_at,two_factor_enabled",
    "full_name,photo_link,phone_e164,email_changed_at,phone_changed_at,password_changed_at",
    "full_name,photo_link,phone_e164,email_changed_at,phone_changed_at",
    "full_name,photo_link,phone_e164,email_changed_at,password_changed_at",
    "full_name,photo_link,phone_e164,phone_changed_at,password_changed_at",
    "full_name,photo_link,phone_e164,password_changed_at",
    "full_name,photo_link,phone_e164,two_factor_enabled,two_factor_secret",
    "full_name,photo_link,phone_e164,two_factor_enabled",
    "full_name,photo_link,phone_e164",
    "full_name,photo_link",
    "full_name,phone_e164",
    "full_name",
  ];

  for (const columns of columnsToTry) {
    const base = sb.from("wz_users").select(columns).limit(5);
    const res =
      params.mode === "ilike"
        ? await base.ilike(params.column, params.value)
        : await base.eq(params.column, params.value);

    if (!res.error) {
      const rows = (res.data || []) as WzUserLookupRow[];
      return rows.map((row) => ({
        full_name: row.full_name || null,
        photo_link: row.photo_link || null,
        phone_e164: row.phone_e164 || null,
        email_changed_at: row.email_changed_at || null,
        phone_changed_at: row.phone_changed_at || null,
        password_changed_at: row.password_changed_at || null,
        support_access:
          typeof row.support_access === "undefined" ? null : row.support_access,
        two_factor_enabled:
          typeof row.two_factor_enabled === "undefined" ? null : row.two_factor_enabled,
        two_factor_secret: row.two_factor_secret || null,
        two_factor_enabled_at: row.two_factor_enabled_at || null,
        two_factor_disabled_at: row.two_factor_disabled_at || null,
      }));
    }
  }

  return [] as WzUserLookupRow[];
}

function pickProfileFromRows(
  rows: WzUserLookupRow[],
  fallbackPhotoLink: string | null,
  fallbackPhoneE164: string | null,
  fallbackEmailChangedAt: string | null,
  fallbackPhoneChangedAt: string | null,
  fallbackPasswordChangedAt: string | null,
  fallbackSupportAccess: boolean,
  fallbackTwoFactorEnabled: boolean,
  fallbackTwoFactorEnabledAt: string | null,
  fallbackTwoFactorDisabledAt: string | null,
  allowLegacyTwoFactorColumns: boolean,
) {
  let nextFallbackPhoto = fallbackPhotoLink;
  let nextFallbackPhone = fallbackPhoneE164;
  let nextFallbackEmailChangedAt = fallbackEmailChangedAt;
  let nextFallbackPhoneChangedAt = fallbackPhoneChangedAt;
  let nextFallbackPasswordChangedAt = fallbackPasswordChangedAt;
  let nextFallbackSupportAccess = fallbackSupportAccess;
  let nextFallbackTwoFactorEnabled = fallbackTwoFactorEnabled;
  let nextFallbackTwoFactorEnabledAt = fallbackTwoFactorEnabledAt;
  let nextFallbackTwoFactorDisabledAt = fallbackTwoFactorDisabledAt;

  for (const row of rows) {
    const rowPhoto = sanitizePhotoLink(row.photo_link);
    const rowPhone = sanitizePhoneE164(row.phone_e164);
    const rowEmailChangedAt = sanitizeIsoDatetime(row.email_changed_at);
    const rowPhoneChangedAt = sanitizeIsoDatetime(row.phone_changed_at);
    const rowPasswordChangedAt = sanitizeIsoDatetime(row.password_changed_at);
    const rowSupportAccess = sanitizeSupportAccessValue(row.support_access);
    const rowTwoFactorEnabledAt = sanitizeIsoDatetime(row.two_factor_enabled_at);
    const rowTwoFactorDisabledAt = sanitizeIsoDatetime(row.two_factor_disabled_at);
    const hasTwoFactorInfo =
      allowLegacyTwoFactorColumns &&
      (typeof row.two_factor_enabled !== "undefined" ||
        typeof row.two_factor_secret !== "undefined" ||
        typeof row.two_factor_enabled_at !== "undefined" ||
        typeof row.two_factor_disabled_at !== "undefined");
    const rowTwoFactorEnabled = hasTwoFactorInfo
      ? resolveTwoFactorEnabled(row.two_factor_enabled, row.two_factor_secret)
      : nextFallbackTwoFactorEnabled;

    if (!nextFallbackPhoto && rowPhoto) nextFallbackPhoto = rowPhoto;
    if (!nextFallbackPhone && rowPhone) nextFallbackPhone = rowPhone;
    if (!nextFallbackEmailChangedAt && rowEmailChangedAt) {
      nextFallbackEmailChangedAt = rowEmailChangedAt;
    }
    if (!nextFallbackPhoneChangedAt && rowPhoneChangedAt) {
      nextFallbackPhoneChangedAt = rowPhoneChangedAt;
    }
    if (!nextFallbackPasswordChangedAt && rowPasswordChangedAt) {
      nextFallbackPasswordChangedAt = rowPasswordChangedAt;
    }
    if (rowSupportAccess !== null) {
      nextFallbackSupportAccess = rowSupportAccess;
    }
    if (hasTwoFactorInfo) {
      nextFallbackTwoFactorEnabled = rowTwoFactorEnabled;
      if (rowTwoFactorEnabledAt) nextFallbackTwoFactorEnabledAt = rowTwoFactorEnabledAt;
      if (rowTwoFactorDisabledAt) nextFallbackTwoFactorDisabledAt = rowTwoFactorDisabledAt;
      if (rowTwoFactorEnabled) {
        nextFallbackTwoFactorDisabledAt = null;
      }
    }

    const fullName = sanitizeFullName(row.full_name);
    const firstName = pickFirstName(row.full_name);
    if (
      firstName ||
      fullName ||
      rowPhone ||
      rowEmailChangedAt ||
      rowPhoneChangedAt ||
      rowPasswordChangedAt ||
      rowSupportAccess !== null ||
      hasTwoFactorInfo
    ) {
      return {
        profile: {
          firstName: firstName || null,
          fullName: fullName || null,
          photoLink: rowPhoto || nextFallbackPhoto,
          phoneE164: rowPhone || nextFallbackPhone,
          emailChangedAt: rowEmailChangedAt || nextFallbackEmailChangedAt,
          phoneChangedAt: rowPhoneChangedAt || nextFallbackPhoneChangedAt,
          passwordChangedAt: rowPasswordChangedAt || nextFallbackPasswordChangedAt,
          supportAccess:
            rowSupportAccess !== null ? rowSupportAccess : nextFallbackSupportAccess,
          twoFactorEnabled: hasTwoFactorInfo
            ? rowTwoFactorEnabled
            : nextFallbackTwoFactorEnabled,
          twoFactorEnabledAt: rowTwoFactorEnabledAt || nextFallbackTwoFactorEnabledAt,
          twoFactorDisabledAt:
            (rowTwoFactorEnabled ? null : rowTwoFactorDisabledAt) ||
            (nextFallbackTwoFactorEnabled ? null : nextFallbackTwoFactorDisabledAt),
        } as SidebarProfile,
        fallbackPhotoLink: nextFallbackPhoto,
        fallbackPhoneE164: nextFallbackPhone,
        fallbackEmailChangedAt: nextFallbackEmailChangedAt,
        fallbackPhoneChangedAt: nextFallbackPhoneChangedAt,
        fallbackPasswordChangedAt: nextFallbackPasswordChangedAt,
        fallbackSupportAccess: nextFallbackSupportAccess,
        fallbackTwoFactorEnabled: nextFallbackTwoFactorEnabled,
        fallbackTwoFactorEnabledAt: nextFallbackTwoFactorEnabledAt,
        fallbackTwoFactorDisabledAt: nextFallbackTwoFactorDisabledAt,
      };
    }
  }

  return {
    profile: null as SidebarProfile | null,
    fallbackPhotoLink: nextFallbackPhoto,
    fallbackPhoneE164: nextFallbackPhone,
    fallbackEmailChangedAt: nextFallbackEmailChangedAt,
    fallbackPhoneChangedAt: nextFallbackPhoneChangedAt,
    fallbackPasswordChangedAt: nextFallbackPasswordChangedAt,
    fallbackSupportAccess: nextFallbackSupportAccess,
    fallbackTwoFactorEnabled: nextFallbackTwoFactorEnabled,
    fallbackTwoFactorEnabledAt: nextFallbackTwoFactorEnabledAt,
    fallbackTwoFactorDisabledAt: nextFallbackTwoFactorDisabledAt,
  };
}

async function getSidebarProfile(params: {
  userId?: string | null;
  email?: string | null;
}) {
  const userId = String(params.userId || "").trim();
  const email = String(params.email || "")
    .trim()
    .toLowerCase();

  if (!userId && !email) {
    return {
      firstName: null,
      fullName: null,
      photoLink: null,
      phoneE164: null,
      emailChangedAt: null,
      phoneChangedAt: null,
      passwordChangedAt: null,
      supportAccess: false,
      twoFactorEnabled: false,
      twoFactorEnabledAt: null,
      twoFactorDisabledAt: null,
    } as SidebarProfile;
  }

  try {
    const sb = supabaseAdmin();
    let fallbackPhotoLink: string | null = null;
    let fallbackPhoneE164: string | null = null;
    let fallbackEmailChangedAt: string | null = null;
    let fallbackPhoneChangedAt: string | null = null;
    let fallbackPasswordChangedAt: string | null = null;
    let fallbackSupportAccess = false;
    let fallbackTwoFactorEnabled = false;
    let fallbackTwoFactorEnabledAt: string | null = null;
    let fallbackTwoFactorDisabledAt: string | null = null;
    let allowLegacyTwoFactorColumns = true;

    if (userId) {
      const auth2faState = await queryWzAuth2faState(sb, userId);
      if (auth2faState.schemaAvailable) {
        allowLegacyTwoFactorColumns = false;
        fallbackTwoFactorEnabled = Boolean(auth2faState.state?.enabled);
        fallbackTwoFactorEnabledAt = auth2faState.state?.enabledAt || null;
        fallbackTwoFactorDisabledAt = auth2faState.state?.disabledAt || null;
      }
    }

    if (userId) {
      const rowsByAuthId = await queryWzUsersRows(sb, {
        column: "auth_user_id",
        value: userId,
        mode: "eq",
      });
      const result = pickProfileFromRows(
        rowsByAuthId,
        fallbackPhotoLink,
        fallbackPhoneE164,
        fallbackEmailChangedAt,
        fallbackPhoneChangedAt,
        fallbackPasswordChangedAt,
        fallbackSupportAccess,
        fallbackTwoFactorEnabled,
        fallbackTwoFactorEnabledAt,
        fallbackTwoFactorDisabledAt,
        allowLegacyTwoFactorColumns,
      );
      fallbackPhotoLink = result.fallbackPhotoLink;
      fallbackPhoneE164 = result.fallbackPhoneE164;
      fallbackEmailChangedAt = result.fallbackEmailChangedAt;
      fallbackPhoneChangedAt = result.fallbackPhoneChangedAt;
      fallbackPasswordChangedAt = result.fallbackPasswordChangedAt;
      fallbackSupportAccess = result.fallbackSupportAccess;
      fallbackTwoFactorEnabled = result.fallbackTwoFactorEnabled;
      fallbackTwoFactorEnabledAt = result.fallbackTwoFactorEnabledAt;
      fallbackTwoFactorDisabledAt = result.fallbackTwoFactorDisabledAt;
      if (result.profile) return result.profile;
    }

    if (userId) {
      const rowsByUserId = await queryWzUsersRows(sb, {
        column: "user_id",
        value: userId,
        mode: "eq",
      });
      const result = pickProfileFromRows(
        rowsByUserId,
        fallbackPhotoLink,
        fallbackPhoneE164,
        fallbackEmailChangedAt,
        fallbackPhoneChangedAt,
        fallbackPasswordChangedAt,
        fallbackSupportAccess,
        fallbackTwoFactorEnabled,
        fallbackTwoFactorEnabledAt,
        fallbackTwoFactorDisabledAt,
        allowLegacyTwoFactorColumns,
      );
      fallbackPhotoLink = result.fallbackPhotoLink;
      fallbackPhoneE164 = result.fallbackPhoneE164;
      fallbackEmailChangedAt = result.fallbackEmailChangedAt;
      fallbackPhoneChangedAt = result.fallbackPhoneChangedAt;
      fallbackPasswordChangedAt = result.fallbackPasswordChangedAt;
      fallbackSupportAccess = result.fallbackSupportAccess;
      fallbackTwoFactorEnabled = result.fallbackTwoFactorEnabled;
      fallbackTwoFactorEnabledAt = result.fallbackTwoFactorEnabledAt;
      fallbackTwoFactorDisabledAt = result.fallbackTwoFactorDisabledAt;
      if (result.profile) return result.profile;
    }

    if (userId) {
      const rowsById = await queryWzUsersRows(sb, {
        column: "id",
        value: userId,
        mode: "eq",
      });
      const result = pickProfileFromRows(
        rowsById,
        fallbackPhotoLink,
        fallbackPhoneE164,
        fallbackEmailChangedAt,
        fallbackPhoneChangedAt,
        fallbackPasswordChangedAt,
        fallbackSupportAccess,
        fallbackTwoFactorEnabled,
        fallbackTwoFactorEnabledAt,
        fallbackTwoFactorDisabledAt,
        allowLegacyTwoFactorColumns,
      );
      fallbackPhotoLink = result.fallbackPhotoLink;
      fallbackPhoneE164 = result.fallbackPhoneE164;
      fallbackEmailChangedAt = result.fallbackEmailChangedAt;
      fallbackPhoneChangedAt = result.fallbackPhoneChangedAt;
      fallbackPasswordChangedAt = result.fallbackPasswordChangedAt;
      fallbackSupportAccess = result.fallbackSupportAccess;
      fallbackTwoFactorEnabled = result.fallbackTwoFactorEnabled;
      fallbackTwoFactorEnabledAt = result.fallbackTwoFactorEnabledAt;
      fallbackTwoFactorDisabledAt = result.fallbackTwoFactorDisabledAt;
      if (result.profile) return result.profile;
    }

    if (email) {
      const rowsByEmail = await queryWzUsersRows(sb, {
        column: "email",
        value: email,
        mode: "ilike",
      });
      const result = pickProfileFromRows(
        rowsByEmail,
        fallbackPhotoLink,
        fallbackPhoneE164,
        fallbackEmailChangedAt,
        fallbackPhoneChangedAt,
        fallbackPasswordChangedAt,
        fallbackSupportAccess,
        fallbackTwoFactorEnabled,
        fallbackTwoFactorEnabledAt,
        fallbackTwoFactorDisabledAt,
        allowLegacyTwoFactorColumns,
      );
      fallbackPhotoLink = result.fallbackPhotoLink;
      fallbackPhoneE164 = result.fallbackPhoneE164;
      fallbackEmailChangedAt = result.fallbackEmailChangedAt;
      fallbackPhoneChangedAt = result.fallbackPhoneChangedAt;
      fallbackPasswordChangedAt = result.fallbackPasswordChangedAt;
      fallbackSupportAccess = result.fallbackSupportAccess;
      fallbackTwoFactorEnabled = result.fallbackTwoFactorEnabled;
      fallbackTwoFactorEnabledAt = result.fallbackTwoFactorEnabledAt;
      fallbackTwoFactorDisabledAt = result.fallbackTwoFactorDisabledAt;
      if (result.profile) return result.profile;
    }

    return {
      firstName: null,
      fullName: null,
      photoLink: fallbackPhotoLink,
      phoneE164: fallbackPhoneE164,
      emailChangedAt: fallbackEmailChangedAt,
      phoneChangedAt: fallbackPhoneChangedAt,
      passwordChangedAt: fallbackPasswordChangedAt,
      supportAccess: fallbackSupportAccess,
      twoFactorEnabled: fallbackTwoFactorEnabled,
      twoFactorEnabledAt: fallbackTwoFactorEnabledAt,
      twoFactorDisabledAt: fallbackTwoFactorDisabledAt,
    } as SidebarProfile;
  } catch (error) {
    console.error("[dashboard] failed to load wz_users profile:", error);
  }

  return {
    firstName: null,
    fullName: null,
    photoLink: null,
    phoneE164: null,
    emailChangedAt: null,
    phoneChangedAt: null,
    passwordChangedAt: null,
    supportAccess: false,
    twoFactorEnabled: false,
    twoFactorEnabledAt: null,
    twoFactorDisabledAt: null,
  } as SidebarProfile;
}

export default async function DashboardHomePage() {
  const h = await headers();

  const headerLike: { get(name: string): string | null } = {
    get: (name: string) => h.get(name),
  };
  const hostHeader = pickHostHeader(headerLike);
  const shouldBypassAuth = isLocalDevHost(hostHeader);

  const cookieHeader = h.get("cookie");
  const session = await readActiveSessionFromCookie({
    cookieHeader,
    headers: headerLike,
    seedIfMissing: true,
  });
  const sidebarEmail = session?.email || (shouldBypassAuth ? "local@localhost" : "");
  let sidebarNickname = shouldBypassAuth ? "Local User" : "Usuario";
  let accountFullName = shouldBypassAuth ? "Local User" : "Usuario";
  let sidebarPhotoLink: string | null = null;
  let sidebarPhoneE164: string | null = null;
  let sidebarEmailChangedAt: string | null = null;
  let sidebarPhoneChangedAt: string | null = null;
  let sidebarPasswordChangedAt: string | null = null;
  let sidebarSupportAccess = false;
  let sidebarTwoFactorEnabled = false;
  let sidebarTwoFactorEnabledAt: string | null = null;
  let sidebarTwoFactorDisabledAt: string | null = null;
  let sidebarAccountCreatedAt: string | null = null;

  if (session) {
    sidebarAccountCreatedAt = await getAuthUserCreatedAt(session.userId);
    const profile = await getSidebarProfile({
      userId: session.userId,
      email: session.email,
    });
    const fullNameFromSession = sanitizeFullName(session.fullName);
    const firstNameFromSession = pickFirstName(session.fullName);

    if (fullNameFromSession) {
      accountFullName = fullNameFromSession;
    } else if (profile.fullName) {
      accountFullName = profile.fullName;
    }

    if (firstNameFromSession) {
      sidebarNickname = firstNameFromSession;
    } else if (profile.firstName) {
      sidebarNickname = profile.firstName;
    } else if (accountFullName) {
      sidebarNickname = pickFirstName(accountFullName) || sidebarNickname;
    }

    if (profile.photoLink) {
      sidebarPhotoLink = profile.photoLink;
    }

    if (profile.phoneE164) {
      sidebarPhoneE164 = profile.phoneE164;
    }
    if (profile.emailChangedAt) {
      sidebarEmailChangedAt = profile.emailChangedAt;
    }
    if (profile.phoneChangedAt) {
      sidebarPhoneChangedAt = profile.phoneChangedAt;
    }
    if (profile.passwordChangedAt) {
      sidebarPasswordChangedAt = profile.passwordChangedAt;
    }
    sidebarSupportAccess = profile.supportAccess;
    sidebarTwoFactorEnabled = profile.twoFactorEnabled;
    if (profile.twoFactorEnabledAt) {
      sidebarTwoFactorEnabledAt = profile.twoFactorEnabledAt;
    }
    if (profile.twoFactorDisabledAt) {
      sidebarTwoFactorDisabledAt = profile.twoFactorDisabledAt;
    }
  }

  const loginUrl = buildLoginUrl(hostHeader);

  if (!shouldBypassAuth && !session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Link href={loginUrl}>Ir para Login</Link>
      </div>
    );
  }

  return (
    <DashboardShell
      userNickname={sidebarNickname}
      userFullName={accountFullName}
      userEmail={sidebarEmail}
      userPhotoLink={sidebarPhotoLink}
      userPhoneE164={sidebarPhoneE164}
      userEmailChangedAt={sidebarEmailChangedAt}
      userPhoneChangedAt={sidebarPhoneChangedAt}
      userPasswordChangedAt={sidebarPasswordChangedAt}
      userSupportAccess={sidebarSupportAccess}
      userTwoFactorEnabled={sidebarTwoFactorEnabled}
      userTwoFactorEnabledAt={sidebarTwoFactorEnabledAt}
      userTwoFactorDisabledAt={sidebarTwoFactorDisabledAt}
      userAccountCreatedAt={sidebarAccountCreatedAt}
    />
  );
}
