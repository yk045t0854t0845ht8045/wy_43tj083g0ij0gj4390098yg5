import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  ACCOUNT_STATE_DEACTIVATED,
  ACCOUNT_STATE_PENDING_DELETION,
  resolveAccountLifecycleBySession,
  syncAccountLifecycleIfNeeded,
} from "@/app/api/wz_users/_account_lifecycle";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function pickHostHeader(h: { get(name: string): string | null }) {
  return h.get("x-forwarded-host") || h.get("host");
}

function isLocalDevHost(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();
  return host.endsWith(".localhost") || host === "localhost";
}

function buildDashboardUrl(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();

  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://dashboard.localhost:3000/";
  }

  return "https://dashboard.wyzer.com.br/";
}

function buildLoginUrl(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();

  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://login.localhost:3000/";
  }

  return "https://login.wyzer.com.br/";
}

function buildLoginRedirectUrl(hostHeader: string | null) {
  const loginUrl = new URL(buildLoginUrl(hostHeader));
  loginUrl.searchParams.set("returnTo", buildDashboardUrl(hostHeader));
  loginUrl.searchParams.set("forceLogin", "1");
  return loginUrl.toString();
}

function buildReactivateUrl(hostHeader: string | null) {
  const base = new URL(buildDashboardUrl(hostHeader));
  base.pathname = "/signup/reactivate";
  base.search = "";
  return base.toString();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const headerLike: { get(name: string): string | null } = {
    get: (name: string) => h.get(name),
  };

  const hostHeader = pickHostHeader(headerLike);
  const shouldBypassAuth = isLocalDevHost(hostHeader);

  if (!shouldBypassAuth) {
    const cookieHeader = h.get("cookie");
    const session = readSessionFromCookieHeader(cookieHeader, headerLike);

    if (!session) {
      redirect(buildLoginRedirectUrl(hostHeader));
    }

    const sb = supabaseAdmin();
    const lifecycle = await resolveAccountLifecycleBySession({
      sb,
      sessionUserId: session.userId,
      sessionEmail: session.email,
    });

    if (!lifecycle) {
      redirect(buildLoginRedirectUrl(hostHeader));
    }

    const synced = await syncAccountLifecycleIfNeeded({ sb, record: lifecycle });
    if (
      synced.state === ACCOUNT_STATE_PENDING_DELETION ||
      synced.state === ACCOUNT_STATE_DEACTIVATED
    ) {
      redirect(buildReactivateUrl(hostHeader));
    }
  }

  return <>{children}</>;
}
