// app/(dashboard)/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import DashboardShell from "./_components/DashboardShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SidebarProfile = {
  firstName: string | null;
  fullName: string | null;
  photoLink: string | null;
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

async function queryWzUsersRows(
  sb: ReturnType<typeof supabaseAdmin>,
  params: WzUserLookupParams,
) {
  const runSelect = async (columns: string) => {
    const base = sb.from("wz_users").select(columns).limit(5);
    if (params.mode === "ilike") {
      return base.ilike(params.column, params.value);
    }
    return base.eq(params.column, params.value);
  };

  const withPhoto = await runSelect("full_name,photo_link");
  if (!withPhoto.error) {
    return (withPhoto.data || []) as WzUserLookupRow[];
  }

  const withoutPhoto = await runSelect("full_name");
  if (!withoutPhoto.error) {
    return ((withoutPhoto.data || []) as WzUserLookupRow[]).map((row) => ({
      ...row,
      photo_link: null,
    }));
  }

  return [] as WzUserLookupRow[];
}

function pickProfileFromRows(rows: WzUserLookupRow[], fallbackPhotoLink: string | null) {
  let nextFallbackPhoto = fallbackPhotoLink;

  for (const row of rows) {
    const rowPhoto = sanitizePhotoLink(row.photo_link);
    if (!nextFallbackPhoto && rowPhoto) nextFallbackPhoto = rowPhoto;

    const fullName = sanitizeFullName(row.full_name);
    const firstName = pickFirstName(row.full_name);
    if (firstName || fullName) {
      return {
        profile: {
          firstName: firstName || null,
          fullName: fullName || null,
          photoLink: rowPhoto || nextFallbackPhoto,
        } as SidebarProfile,
        fallbackPhotoLink: nextFallbackPhoto,
      };
    }
  }

  return { profile: null as SidebarProfile | null, fallbackPhotoLink: nextFallbackPhoto };
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
    } as SidebarProfile;
  }

  try {
    const sb = supabaseAdmin();
    let fallbackPhotoLink: string | null = null;

    if (email) {
      const rowsByEmail = await queryWzUsersRows(sb, {
        column: "email",
        value: email,
        mode: "ilike",
      });
      const result = pickProfileFromRows(rowsByEmail, fallbackPhotoLink);
      fallbackPhotoLink = result.fallbackPhotoLink;
      if (result.profile) return result.profile;
    }

    if (userId) {
      const rowsByAuthId = await queryWzUsersRows(sb, {
        column: "auth_user_id",
        value: userId,
        mode: "eq",
      });
      const result = pickProfileFromRows(rowsByAuthId, fallbackPhotoLink);
      fallbackPhotoLink = result.fallbackPhotoLink;
      if (result.profile) return result.profile;
    }

    if (userId) {
      const rowsByUserId = await queryWzUsersRows(sb, {
        column: "user_id",
        value: userId,
        mode: "eq",
      });
      const result = pickProfileFromRows(rowsByUserId, fallbackPhotoLink);
      fallbackPhotoLink = result.fallbackPhotoLink;
      if (result.profile) return result.profile;
    }

    if (userId) {
      const rowsById = await queryWzUsersRows(sb, {
        column: "id",
        value: userId,
        mode: "eq",
      });
      const result = pickProfileFromRows(rowsById, fallbackPhotoLink);
      fallbackPhotoLink = result.fallbackPhotoLink;
      if (result.profile) return result.profile;
    }

    return {
      firstName: null,
      fullName: null,
      photoLink: fallbackPhotoLink,
    } as SidebarProfile;
  } catch (error) {
    console.error("[dashboard] failed to load wz_users profile:", error);
  }

  return {
    firstName: null,
    fullName: null,
    photoLink: null,
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
  const session = readSessionFromCookieHeader(cookieHeader, headerLike);
  const sidebarEmail = session?.email || (shouldBypassAuth ? "local@localhost" : "");
  let sidebarNickname = shouldBypassAuth ? "Local User" : "Usuario";
  let accountFullName = shouldBypassAuth ? "Local User" : "Usuario";
  let sidebarPhotoLink: string | null = null;

  if (session) {
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
    />
  );
}
