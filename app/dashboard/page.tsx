// app/(dashboard)/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import DashboardSidebar from "./_components/DashboardSidebar";
import { Menu } from "lucide-react";

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
    <div className="min-h-screen bg-white">
      {/* toggle mobile (sem JS) */}
      <input id="wzSidebarToggle" type="checkbox" className="peer hidden" />

      {/* overlay mobile */}
      <label
        htmlFor="wzSidebarToggle"
        className={[
          "fixed inset-0 z-[60] bg-black/25 opacity-0 pointer-events-none transition-opacity",
          "peer-checked:opacity-100 peer-checked:pointer-events-auto",
          "md:hidden",
        ].join(" ")}
        aria-label="Fechar menu"
      />

      <div className="flex min-h-screen">
        {/* Sidebar (client => calcula active corretamente) */}
        <DashboardSidebar email={session.email} userId={session.userId} />

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* Topbar */}
          <div className="sticky top-0 z-[50] bg-white/85 backdrop-blur-xl border-b border-black/10">
            <div className="h-16 flex items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-3 min-w-0">
                {/* open mobile */}
                <label
                  htmlFor="wzSidebarToggle"
                  className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-black/[0.04] ring-1 ring-black/10 text-black/70 hover:text-black hover:bg-black/[0.06] transition-colors cursor-pointer"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </label>

                <div className="min-w-0">
                  <div className="text-[15px] sm:text-[16px] font-extrabold tracking-tight text-black truncate">
                    Home
                  </div>
                  <div className="text-[12px] font-semibold text-black/45 truncate">
                    Visão geral do atendimento e IA
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/inbox"
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 bg-white ring-1 ring-black/10 text-black/70 text-[13px] font-bold hover:text-black hover:bg-[#f7f7f7] transition-colors"
                >
                  Abrir Conversas
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 bg-black text-white text-[13px] font-bold"
                >
                  Configurações
                </Link>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-8">
            <div className="mx-auto w-full max-w-[980px]">
              <div className="rounded-[28px] bg-white ring-1 ring-black/10 p-7 sm:p-9 md:p-10">
                <div className="text-black font-semibold tracking-tight text-[26px] sm:text-[30px]">
                  Dashboard (teste de sessão)
                </div>

                <div className="mt-2 text-black/60 text-[14px] sm:text-[15px]">
                  Se você está vendo isso, a sessão foi validada corretamente.
                </div>

                <div className="mt-8 rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/10 p-6 text-left">
                  <div className="text-[12px] font-semibold text-black/45">
                    Email
                  </div>
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

                <div className="mt-8 flex flex-wrap items-center gap-3">
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

                  <Link
                    href="/getting-started"
                    className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-black/[0.04] ring-1 ring-black/10 text-black/80 text-[14px] font-semibold hover:bg-black/[0.06] transition-colors"
                  >
                    Começar setup
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-[24px] bg-white ring-1 ring-black/10 p-6">
                  <div className="text-[13px] font-bold text-black">
                    Conversas
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-black/45">
                    Central do atendimento
                  </div>
                </div>

                <div className="rounded-[24px] bg-white ring-1 ring-black/10 p-6">
                  <div className="text-[13px] font-bold text-black">
                    Automações IA
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-black/45">
                    Fluxos e regras do bot
                  </div>
                </div>

                <div className="rounded-[24px] bg-white ring-1 ring-black/10 p-6">
                  <div className="text-[13px] font-bold text-black">
                    Analytics
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-black/45">
                    Métricas e performance
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
