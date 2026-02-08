import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function pickHostHeader(h: { get(name: string): string | null }) {
  return h.get("x-forwarded-host") || h.get("host");
}

function buildDashboardUrl(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();

  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://dashboard.localhost:3000/";
  }

  return "https://dashboard.wyzer.com.br/";
}

function buildLoginSyncRedirect(hostHeader: string | null) {
  const next = encodeURIComponent(buildDashboardUrl(hostHeader));
  return `/api/wz_AuthLogin/sync-host?next=${next}`;
}

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const headerLike: { get(name: string): string | null } = {
    get: (name: string) => h.get(name),
  };

  const cookieHeader = h.get("cookie");
  const session = readSessionFromCookieHeader(cookieHeader, headerLike);

  if (session) {
    redirect(buildLoginSyncRedirect(pickHostHeader(headerLike)));
  }

  return <>{children}</>;
}
