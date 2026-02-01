"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bolt,
  Home,
  MessageSquare,
  Bot,
  Workflow,
  BookOpen,
  BarChart3,
  Users2,
  PhoneCall,
  Plug,
  CreditCard,
  Settings,
  X,
  ArrowRight,
} from "lucide-react";

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: any;
  active?: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "group flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-all",
        active
          ? "bg-black/[0.06] ring-1 ring-black/10 text-black"
          : "text-black/60 hover:text-black hover:bg-black/[0.04]",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-9 w-9 items-center justify-center rounded-[12px] transition-all",
          active ? "bg-white ring-1 ring-black/10" : "bg-transparent",
        ].join(" ")}
      >
        <Icon
          className={[
            "h-[18px] w-[18px] transition-all",
            active ? "text-black" : "text-black/55 group-hover:text-black/75",
          ].join(" ")}
        />
      </span>

      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
        {label}
      </span>

      {badge ? (
        <span className="ml-2 rounded-full bg-violet-600/90 px-2.5 py-1 text-[11px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export default function DashboardSidebar({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const pathname = usePathname() || "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={[
        "fixed md:sticky top-0 left-0 z-[70] h-screen w-[290px] shrink-0",
        "bg-white/90 backdrop-blur-xl",
        "border-r border-black/10",
        "px-4 py-4",
        "transition-transform duration-300 ease-out",
        "-translate-x-full peer-checked:translate-x-0",
        "md:translate-x-0",
      ].join(" ")}
    >
      {/* Top brand */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-[14px] bg-black ring-1 ring-black/10 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
            <div className="h-5 w-5 rounded-[7px] bg-white/90" />
          </div>

          <div className="min-w-0">
            <div className="text-[16px] font-extrabold tracking-tight text-black truncate">
              wyzer
            </div>
            <div className="text-[12px] font-semibold text-black/45 truncate">
              Dashboard
            </div>
          </div>
        </div>

        {/* close mobile */}
        <label
          htmlFor="wzSidebarToggle"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-black/[0.04] ring-1 ring-black/10 text-black/70 hover:text-black hover:bg-black/[0.06] transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </label>
      </div>

      {/* Getting started card */}
      <div className="mt-4">
        <Link
          href="/getting-started"
          className="group flex items-center justify-between gap-3 rounded-[16px] bg-white ring-1 ring-black/10 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] bg-black/[0.04] ring-1 ring-black/10">
              <Bolt className="h-5 w-5 text-black/75" />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-black truncate">
                Getting started
              </div>
              <div className="text-[12px] font-semibold text-black/45 truncate">
                Configure rápido o Wyzer
              </div>
            </div>
          </div>

          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white shadow-[0_12px_35px_rgba(0,0,0,0.22)] transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-5 w-5" />
          </span>
        </Link>
      </div>

      {/* Nav */}
      <div className="mt-4 space-y-1">
        <NavItem href="/" label="Home" icon={Home} active={isActive("/")} />
        <NavItem
          href="/inbox"
          label="Conversas"
          icon={MessageSquare}
          active={isActive("/inbox")}
        />
        <NavItem
          href="/copiloto"
          label="Copiloto IA"
          icon={Bot}
          active={isActive("/copiloto")}
        />
        <NavItem
          href="/automacoes"
          label="Automações"
          icon={Workflow}
          active={isActive("/automacoes")}
        />
        <NavItem
          href="/base-de-conhecimento"
          label="Base de conhecimento"
          icon={BookOpen}
          active={isActive("/base-de-conhecimento")}
        />
        <NavItem
          href="/analytics"
          label="Analytics"
          icon={BarChart3}
          active={isActive("/analytics")}
        />

        <div className="my-3 h-px bg-black/10" />

        <NavItem
          href="/equipe"
          label="Atendentes"
          icon={Users2}
          active={isActive("/equipe")}
        />
        <NavItem
          href="/canais"
          label="Canais WhatsApp"
          icon={PhoneCall}
          active={isActive("/canais")}
        />
        <NavItem
          href="/integracoes"
          label="Integrações"
          icon={Plug}
          active={isActive("/integracoes")}
        />
        <NavItem
          href="/billing"
          label="Planos & cobrança"
          icon={CreditCard}
          active={isActive("/billing")}
          badge="NEW"
        />
        <NavItem
          href="/settings"
          label="Configurações"
          icon={Settings}
          active={isActive("/settings")}
        />
      </div>

      {/* Footer user */}
      <div className="mt-auto pt-4">
        <div className="rounded-[18px] bg-black/[0.03] ring-1 ring-black/10 p-3">
          <div className="text-[11px] font-semibold text-black/45">
            Logado como
          </div>
          <div className="mt-1 text-[13px] font-bold text-black truncate">
            {email}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-black/45 truncate">
            ID: {userId}
          </div>

          <div className="mt-3 flex gap-2">
            <Link
              href="/create-account"
              className="flex-1 inline-flex items-center justify-center rounded-full px-3 py-2 bg-white ring-1 ring-black/10 text-black/70 text-[12px] font-bold hover:text-black hover:bg-[#f7f7f7] transition-colors"
            >
              Onboarding
            </Link>
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center rounded-full px-3 py-2 bg-black text-white text-[12px] font-bold"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
