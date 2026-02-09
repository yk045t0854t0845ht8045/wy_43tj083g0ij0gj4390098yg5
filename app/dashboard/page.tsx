// app/(dashboard)/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import { WyzerAIWidget } from "@/app/wyzerai/page";
import Sidebar from "./_components/sidebar";
import LoadingBase from "./_components/LoadingBase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function isLocalDevHost(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();
  return host.endsWith(".localhost") || host === "localhost";
}

function toDisplayNickname(email?: string | null, userId?: string | null) {
  const direct = String(userId || "").trim();
  if (direct && direct.length <= 24 && !direct.includes("@")) return direct;

  const fromEmail = String(email || "").trim().toLowerCase();
  if (!fromEmail.includes("@")) return "Usuario";

  const local = fromEmail.split("@")[0] || "";
  const clean = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return "Usuario";

  return clean
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 24);
}

export default async function DashboardHomePage() {
  const h = await headers();

  const headerLike: { get(name: string): string | null } = {
    get: (name: string) => h.get(name),
  };
  const hostHeader = pickHostHeader(headerLike);
  const shouldBypassAuth = isLocalDevHost(hostHeader);

  const cookieHeader = h.get("cookie");
  const session = shouldBypassAuth
    ? null
    : readSessionFromCookieHeader(cookieHeader, headerLike);
  const sidebarEmail = session?.email || (shouldBypassAuth ? "local@localhost" : "");
  const sidebarNickname = shouldBypassAuth
    ? "Local User"
    : toDisplayNickname(session?.email, session?.userId);

  const loginUrl = buildLoginUrl(hostHeader);

  if (!shouldBypassAuth && !session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Link href={loginUrl}>Ir para Login</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      <LoadingBase />
      <Sidebar
        activeMain="overview"
        userNickname={sidebarNickname}
        userEmail={sidebarEmail}
      />

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {/* <div>{session.email}</div>
          <div>{session.userId}</div> */}
        </div>

        <WyzerAIWidget />
      </div>
    </div>
  );
}
