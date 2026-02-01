// app/(dashboard)/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";

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

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-[520px] text-center">
        <div className="text-black font-semibold tracking-tight text-[26px]">
          Dashboard (teste de sessão)
        </div>

        <div className="mt-2 text-black/60 text-[14px]">
          Se você está vendo isso, a sessão foi validada corretamente.
        </div>

        <div className="mt-8 rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/10 p-6 text-left">
          <div className="text-[12px] font-semibold text-black/45">Email</div>
          <div className="mt-1 text-[15px] font-semibold text-black break-all">
            {session.email}
          </div>

          <div className="mt-5 text-[12px] font-semibold text-black/45">
            User ID
          </div>
          <div className="mt-1 text-[15px] font-semibold text-black break-all">
            {session.userId}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/create-account"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-white ring-1 ring-black/10 text-black/70 text-[14px] font-semibold hover:text-black hover:bg-[#f7f7f7] transition-colors"
          >
            Voltar para onboarding
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-black text-white text-[14px] font-semibold"
          >
            Recarregar /
          </Link>
        </div>
      </div>
    </div>
  );
}
