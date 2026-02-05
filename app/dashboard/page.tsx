// app/(dashboard)/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import LoadingBase from "./_components/LoadingBase";
import { WyzerAIWidget } from "@/app/wyzerai/page";
import DashboardShell from "./_components/DashboardShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SIDEBAR_COLLAPSE_COOKIE = "wz_dash_sidebar_collapsed";

function buildLoginUrl(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();

  // local/dev
  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://login.localhost:3000/";
  }

  // prod
  if (host.endsWith(".wyzer.com.br")) {
    return "https://login.wyzer.com.br/";
  }

  // fallback
  return "https://login.wyzer.com.br/";
}

function pickHostHeader(h: { get(name: string): string | null }) {
  return h.get("x-forwarded-host") || h.get("host");
}

function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  const raw = String(cookieHeader || "");
  if (!raw) return null;

  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p) continue;
    if (!p.startsWith(name + "=")) continue;
    return p.slice(name.length + 1);
  }

  return null;
}

export default async function DashboardHomePage() {
  const h = await headers();

  const cookieHeader = h.get("cookie");
  const headerLike: { get(name: string): string | null } = {
    get: (name: string) => h.get(name),
  };

  const session = readSessionFromCookieHeader(cookieHeader, headerLike);

  const hostHeader = pickHostHeader(headerLike);
  const loginUrl = buildLoginUrl(hostHeader);

  if (!session) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <LoadingBase />
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="text-lg font-semibold">Sessão expirada</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Entre novamente para acessar o painel.
          </div>
          <Link
            href={loginUrl}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-95"
          >
            Ir para Login
          </Link>
        </div>
      </div>
    );
  }

  const initialCollapsed =
    readCookieValue(cookieHeader, SIDEBAR_COLLAPSE_COOKIE) === "1";

  return (
    <div className="min-h-dvh bg-background">
      <WyzerAIWidget />
      <LoadingBase />
      <DashboardShell
        email={session.email}
        userId={session.userId}
        logoutHref="/api/wz_AuthLogin/logout"
        initialCollapsed={initialCollapsed}
      />
    </div>
  );
}
