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
        <div className="w-full max-w-[520px] rounded-[26px] bg-white ring-1 ring-black/10 p-7 sm:p-9 shadow-[0_18px_60px_rgba(0,0,0,0.10)]">
          <div className="text-black font-extrabold tracking-tight text-[22px]">
            Sessão expirada
          </div>
          <div className="mt-2 text-black/60 text-[14px] font-semibold">
            Faça login novamente para continuar.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={loginUrl}
              className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-black text-white text-[14px] font-extrabold shadow-[0_14px_40px_rgba(0,0,0,0.18)]"
            >
              Ir para Login
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-black/[0.04] ring-1 ring-black/10 text-black/80 text-[14px] font-extrabold hover:bg-black/[0.06] transition-colors"
            >
              Recarregar
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
        {/* Sidebar */}
        <DashboardSidebar
          email={session.email}
          userId={session.userId}
          logoutHref="/api/wz_AuthLogin/logout"
        />

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* top bar minimal (não briga com a estética da imagem) */}
          <div className="sticky top-0 z-[50] bg-white/85 backdrop-blur-xl border-b border-black/10">
            <div className="h-14 flex items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-3 min-w-0">
                {/* open mobile */}
                <label
                  htmlFor="wzSidebarToggle"
                  className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-black/[0.03] ring-1 ring-black/10 text-black/70 hover:text-black hover:bg-black/[0.05] transition-colors cursor-pointer"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </label>

                <div className="min-w-0">
                  <div className="text-[15px] sm:text-[16px] font-extrabold tracking-tight text-black truncate">
                    Dashboard
                  </div>
                  <div className="text-[12px] font-semibold text-black/45 truncate">
                    Visão geral do atendimento e IA
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/inbox"
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 bg-white ring-1 ring-black/10 text-black/70 text-[13px] font-extrabold hover:text-black hover:bg-black/[0.03] transition-colors"
                >
                  Abrir Conversas
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 bg-black text-white text-[13px] font-extrabold shadow-[0_12px_35px_rgba(0,0,0,0.18)]"
                >
                  Configurações
                </Link>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-8">
            <div className="mx-auto w-full max-w-[1050px]">
              <div className="rounded-[28px] bg-white ring-1 ring-black/10 p-7 sm:p-9 shadow-[0_18px_60px_rgba(0,0,0,0.08)]">
                <div className="text-black font-extrabold tracking-tight text-[24px] sm:text-[28px]">
                  Bem-vindo 👋
                </div>

                <div className="mt-2 text-black/60 text-[14px] sm:text-[15px] font-semibold">
                  Se você está vendo isso, a sessão foi validada corretamente.
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-[22px] bg-white ring-1 ring-black/10 p-5">
                    <div className="text-[13px] font-extrabold text-black">Conversas</div>
                    <div className="mt-1 text-[12px] font-semibold text-black/45">
                      Central do atendimento WhatsApp
                    </div>
                    <div className="mt-4">
                      <Link
                        href="/inbox"
                        className="inline-flex items-center justify-center rounded-full px-4 py-2 bg-black text-white text-[12px] font-extrabold"
                      >
                        Abrir
                      </Link>
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-white ring-1 ring-black/10 p-5">
                    <div className="text-[13px] font-extrabold text-black">Automações IA</div>
                    <div className="mt-1 text-[12px] font-semibold text-black/45">
                      Fluxos, regras e respostas automáticas
                    </div>
                    <div className="mt-4">
                      <Link
                        href="/automacoes"
                        className="inline-flex items-center justify-center rounded-full px-4 py-2 bg-black text-white text-[12px] font-extrabold"
                      >
                        Abrir
                      </Link>
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-white ring-1 ring-black/10 p-5">
                    <div className="text-[13px] font-extrabold text-black">Analytics</div>
                    <div className="mt-1 text-[12px] font-semibold text-black/45">
                      Métricas, SLA, performance e insights
                    </div>
                    <div className="mt-4">
                      <Link
                        href="/analytics"
                        className="inline-flex items-center justify-center rounded-full px-4 py-2 bg-black text-white text-[12px] font-extrabold"
                      >
                        Abrir
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="mt-7 rounded-[18px] bg-black/[0.03] ring-1 ring-black/10 p-6">
                  <div className="text-[12px] font-extrabold text-black/45">Sessão</div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-[16px] bg-white ring-1 ring-black/10 p-4">
                      <div className="text-[11px] font-extrabold text-black/45">Email</div>
                      <div className="mt-1 text-[14px] font-extrabold text-black break-all">
                        {session.email}
                      </div>
                    </div>
                    <div className="rounded-[16px] bg-white ring-1 ring-black/10 p-4">
                      <div className="text-[11px] font-extrabold text-black/45">User ID</div>
                      <div className="mt-1 text-[14px] font-extrabold text-black break-all">
                        {session.userId}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/getting-started"
                      className="inline-flex items-center justify-center rounded-full px-5 py-2.5 bg-white ring-1 ring-black/10 text-black/75 text-[13px] font-extrabold hover:bg-black/[0.03] transition-colors"
                    >
                      Começar setup
                    </Link>

                    <Link
                      href="/settings"
                      className="inline-flex items-center justify-center rounded-full px-5 py-2.5 bg-black text-white text-[13px] font-extrabold shadow-[0_12px_35px_rgba(0,0,0,0.18)]"
                    >
                      Configurações
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-[12px] font-semibold text-black/35">
                Dica: aperte <span className="font-extrabold text-black/60">⌘K</span> para buscar na sidebar.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
