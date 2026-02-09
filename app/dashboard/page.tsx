// app/(dashboard)/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
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

function pickFirstName(fullName?: string | null) {
  const clean = String(fullName || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;

  const first = clean.split(" ")[0] || "";
  return first ? first.slice(0, 24) : null;
}

async function getSidebarFirstName(params: {
  userId?: string | null;
  email?: string | null;
}) {
  const userId = String(params.userId || "").trim();
  const email = String(params.email || "")
    .trim()
    .toLowerCase();

  if (!userId && !email) return null;

  try {
    const sb = supabaseAdmin();

    // 1) Igual ao fluxo do e-mail da sessão: prioriza lookup por email (case-insensitive).
    if (email) {
      const { data, error } = await sb
        .from("wz_users")
        .select("full_name")
        .ilike("email", email)
        .limit(5);

      if (!error) {
        for (const row of data || []) {
          const firstByEmail = pickFirstName((row as { full_name?: string | null }).full_name);
          if (firstByEmail) return firstByEmail;
        }
      }
    }

    // 2) Fallback para sessões antigas ou migrações: auth_user_id.
    if (userId) {
      const { data, error } = await sb
        .from("wz_users")
        .select("full_name")
        .eq("auth_user_id", userId)
        .limit(5);

      if (!error) {
        for (const row of data || []) {
          const firstByAuthId = pickFirstName((row as { full_name?: string | null }).full_name);
          if (firstByAuthId) return firstByAuthId;
        }
      }
    }

    // 3) Fallback final: id da tabela wz_users.
    if (userId) {
      const { data, error } = await sb
        .from("wz_users")
        .select("full_name")
        .eq("id", userId)
        .limit(5);

      if (!error) {
        for (const row of data || []) {
          const firstById = pickFirstName((row as { full_name?: string | null }).full_name);
          if (firstById) return firstById;
        }
      }
    }
  } catch (error) {
    console.error("[dashboard] failed to load wz_users full_name:", error);
  }

  return null;
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

  if (session) {
    const dbFirstName = await getSidebarFirstName({
      userId: session.userId,
      email: session.email,
    });
    if (dbFirstName) sidebarNickname = dbFirstName;
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
