// app/(dashboard)/create-account/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import OnboardCreateAccountClient from "./OnboardCreateAccountClient";

export const dynamic = "force-dynamic";

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

export default async function CreateAccountPage() {
  const h = await headers();

  const cookieHeader = h.get("cookie");
  const headerLike: { get(name: string): string | null } = {
    get: (name: string) => h.get(name),
  };

  const session = readSessionFromCookieHeader(cookieHeader, headerLike);

  if (!session) {
    const hostHeader = pickHostHeader(headerLike);
    const loginUrl = buildLoginUrl(hostHeader);

    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-black font-semibold text-[22px]">
            Sessão expirada
          </div>
          <div className="mt-2 text-black/60 text-[14px]">
            Faça login novamente.
          </div>

          <div className="mt-6">
            <Link
              href={loginUrl}
              className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-black text-white text-[14px] font-semibold"
            >
              Ir para Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hostHeader = pickHostHeader(headerLike);
  const loginUrl = buildLoginUrl(hostHeader);

  return (
    <OnboardCreateAccountClient
      email={session.email}
      userId={session.userId}
      loginUrl={loginUrl}
    />
  );
}
