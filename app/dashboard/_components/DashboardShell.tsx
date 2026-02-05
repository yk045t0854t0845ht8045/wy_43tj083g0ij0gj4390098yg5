"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  LogOut,
  MessageSquareText,
  Plus,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardSidebar, { type DashboardNavKey } from "./DashboardSidebar";

function titleFromKey(key: DashboardNavKey) {
  switch (key) {
    case "dashboard":
      return "Dashboard";
    case "analytics":
      return "Analytics";
    case "projects":
      return "Projects";
    case "calendar":
      return "Calendar";
    case "messages_all":
      return "Messages - All";
    case "messages_unread":
      return "Messages - Unread";
    case "messages_updates":
      return "Messages - Updates";
    case "messages_archived":
      return "Messages - Archived";
    case "notifications":
      return "Notifications";
    case "account_store":
      return "My Store";
    case "account_billing":
      return "Billing";
    case "account_orders":
      return "Orders";
    case "account_subscriptions":
      return "Subscriptions";
    case "settings":
      return "Settings";
    case "support":
      return "Support";
    default: {
      const exhaustiveCheck: never = key;
      return exhaustiveCheck;
    }
  }
}

export default function DashboardShell({
  email,
  userId,
  logoutHref = "/api/wz_AuthLogin/logout",
  initialCollapsed = false,
}: {
  email: string;
  userId: string;
  logoutHref?: string;
  initialCollapsed?: boolean;
}) {
  const [activeKey, setActiveKey] = useState<DashboardNavKey>("analytics");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  useEffect(() => {
    try {
      document.cookie = [
        `wz_dash_sidebar_collapsed=${collapsed ? "1" : "0"}`,
        "Path=/",
        "Max-Age=31536000",
        "SameSite=Lax",
      ].join("; ");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const onSelect = useCallback((key: DashboardNavKey) => {
    setActiveKey(key);
    setMobileOpen(false);
  }, []);

  const pageTitle = useMemo(() => titleFromKey(activeKey), [activeKey]);

  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      <div className="flex min-h-dvh w-full">
        <DashboardSidebar
          email={email}
          userId={userId}
          logoutHref={logoutHref}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          activeKey={activeKey}
          onSelect={onSelect}
        />

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl border border-border bg-card p-2 text-foreground shadow-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "lg:hidden",
                )}
                aria-label="Abrir menu"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
              </button>

              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Painel
                </div>
                <div className="truncate text-lg font-semibold">{pageTitle}</div>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/wyzerai"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <MessageSquareText className="h-4 w-4" />
                  WyzerAI
                </Link>

                <Link
                  href={logoutHref}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm",
                    "hover:opacity-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </Link>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6">
            <section className="mx-auto w-full max-w-6xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">
                    Logado como
                  </div>
                  <div className="truncate text-base font-semibold">{email}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    Nova automação
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <Smartphone className="h-4 w-4" />
                    Conectar WhatsApp
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Conversas hoje"
                  value="128"
                  trend="+12%"
                  icon={MessageSquareText}
                />
                <StatCard
                  title="Automações ativas"
                  value="7"
                  trend="Estável"
                  icon={Activity}
                />
                <StatCard
                  title="Resposta média"
                  value="38s"
                  trend="-6%"
                  icon={ChartNoAxesCombined}
                />
                <StatCard
                  title="Agenda"
                  value="3"
                  trend="Eventos"
                  icon={CalendarDays}
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        Atividade recente
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Um resumo do que aconteceu por aqui.
                      </div>
                    </div>
                    <button
                      type="button"
                      className={cn(
                        "rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      Ver tudo
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <ActivityRow
                      title="Canal WhatsApp conectado"
                      meta="Agora mesmo"
                      dotClassName="bg-emerald-500"
                    />
                    <ActivityRow
                      title="Nova automação criada"
                      meta="Há 12 min"
                      dotClassName="bg-indigo-500"
                    />
                    <ActivityRow
                      title="12 mensagens não lidas"
                      meta="Hoje"
                      dotClassName="bg-amber-500"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="text-sm font-semibold">Sessão</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Informações básicas da sua sessão atual.
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">Email</div>
                      <div className="truncate font-medium">{email}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">User ID</div>
                      <div className="truncate font-medium">{userId}</div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2">
                    <Link
                      href={logoutHref}
                      className={cn(
                        "inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm",
                        "hover:opacity-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      Sair da conta
                    </Link>
                    <Link
                      href="/wyzerai"
                      className={cn(
                        "inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      Abrir WyzerAI
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  trend,
  icon: Icon,
}: {
  title: string;
  value: string;
  trend: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">
            {title}
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {value}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background p-2 text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{trend}</div>
    </div>
  );
}

function ActivityRow({
  title,
  meta,
  dotClassName,
}: {
  title: string;
  meta: string;
  dotClassName: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3">
      <div className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", dotClassName)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{meta}</div>
      </div>
    </div>
  );
}
