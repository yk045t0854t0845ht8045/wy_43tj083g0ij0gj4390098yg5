import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
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
  return loginUrl.toString();
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
  }

  return <>{children}</>;
}
