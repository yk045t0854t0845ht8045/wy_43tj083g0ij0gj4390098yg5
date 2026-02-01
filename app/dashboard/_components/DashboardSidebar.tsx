"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  MessageSquare,
  Workflow,
  StickyNote,
  Mail,
  PhoneCall,
  Image as ImageIcon,
  BarChart3,
  Store,
  PlusCircle,
  Settings,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type NavItem = {
  href?: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export default function DashboardSidebar({
  email,
  userId,
  logoutHref = "/api/wz_AuthLogin/logout",
}: {
  email: string;
  userId: string;
  logoutHref?: string;
}) {
  // Base (sem front-end). Você vai implementar o layout depois.
  void email;
  void userId;
  void logoutHref;

  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  const EASE = useMemo(() => [0.2, 0.8, 0.2, 1] as const, []);
  const DUR = useMemo(
    () => ({
      xs: 0.16,
      sm: 0.2,
      md: 0.28,
    }),
    [],
  );

  const normalize = useCallback((p: string) => {
    if (!p) return "/";
    const s = p.split("?")[0].split("#")[0];
    if (s.length > 1 && s.endsWith("/")) return s.slice(0, -1);
    return s || "/";
  }, []);

  const isActive = useCallback(
    (href: string) => {
      const a = normalize(pathname || "/");
      const b = normalize(href);
      if (b === "/") return a === "/";
      return a === b || a.startsWith(b + "/");
    },
    [pathname, normalize],
  );

  const primary: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Dashboard", icon: BarChart3 },
      { href: "/inbox", label: "Inbox", icon: MessageSquare },
      { href: "/inbox?tab=tasks", label: "Tarefas", icon: Workflow },
      {
        href: "/base-de-conhecimento?tab=notes",
        label: "Conhecimentos",
        icon: StickyNote,
      },
      { href: "/mail", label: "Emails", icon: Mail },
      { href: "/analytics", label: "Relatórios", icon: BarChart3 },
      { href: "/automacoes", label: "Automações", icon: Workflow },
      { href: "/automacoes?tab=workflows", label: "Workflows", icon: Workflow },
      { href: "/analises", label: "Análises", icon: BarChart3 },
    ],
    [],
  );

  const salesChannels: NavItem[] = useMemo(
    () => [
      { href: "/canais", label: "Canais WhatsApp", icon: PhoneCall },
      { href: "/integracoes", label: "Integrações", icon: Store },
      { href: "/wyzerai", label: "WyzerAI", icon: Store },
      { href: "/wyzerai", label: "WyzerAI", icon: Store },
    ],
    [],
  );

  const apps: NavItem[] = useMemo(
    () => [
      {
        href: "/apps/adicionar",
        label: "Adicionar",
        icon: PlusCircle,
        disabled: true,
      },
    ],
    [],
  );

  const anySalesActive = useMemo(
    () => salesChannels.some((i) => (i.href ? isActive(i.href) : false)),
    [salesChannels, isActive],
  );

  const anyAppsActive = useMemo(
    () => apps.some((i) => (i.href ? isActive(i.href) : false)),
    [apps, isActive],
  );

  const [openSales, setOpenSales] = useState(true);
  const [openApps, setOpenApps] = useState(true);

  useEffect(() => {
    if (anySalesActive) setOpenSales(true);
    if (anyAppsActive) setOpenApps(true);
  }, [anySalesActive, anyAppsActive]);

  const Row = ({ item, dense }: { item: NavItem; dense?: boolean }) => {
    const active = item.href ? isActive(item.href) : false;
    const Icon = item.icon;

    const inner = (
      <motion.div
        className={cx(
          "relative w-full flex items-center gap-3",
          dense ? "py-2 pl-4 pr-3" : "py-2.5 pl-4 pr-3",
          "rounded-xl",
          item.disabled ? "opacity-40" : "opacity-100",
        )}
        whileHover={
          item.disabled || prefersReducedMotion ? undefined : { scale: 1.01 }
        }
        whileTap={
          item.disabled || prefersReducedMotion ? undefined : { scale: 0.995 }
        }
        transition={{ duration: prefersReducedMotion ? 0 : DUR.xs, ease: EASE }}
      >
        {/* Active pill (igual da imagem) */}
        <AnimatePresence initial={false}>
          {active && (
            <motion.div
              layoutId="sidebar-active-pill"
              className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)] ring-1 ring-black/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : DUR.sm,
                ease: EASE,
              }}
            />
          )}
        </AnimatePresence>

        <div className="relative flex items-center justify-center w-6">
          <Icon className="h-[18px] w-[18px] text-black/75" />
        </div>

        <div className="relative flex-1 text-[15px] leading-none text-black/80">
          {item.label}
        </div>
      </motion.div>
    );

    if (!item.href || item.disabled) {
      return <div className="px-2">{inner}</div>;
    }

    return (
      <div className="px-2">
        <Link href={item.href} className="block">
          {inner}
        </Link>
      </div>
    );
  };

  const GroupHeader = ({
    label,
    open,
    setOpen,
  }: {
    label: string;
    open: boolean;
    setOpen: (v: boolean) => void;
  }) => {
    return (
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cx(
          "w-full flex items-center justify-between",
          "px-4 py-2 mt-3",
          "text-[14px] text-black/70",
          "select-none",
        )}
        whileHover={prefersReducedMotion ? undefined : { opacity: 0.9 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
        transition={{ duration: prefersReducedMotion ? 0 : DUR.xs, ease: EASE }}
      >
        <span className="flex items-center gap-2">{label}</span>

        {/* setinha do lado direito */}
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : DUR.sm,
            ease: EASE,
          }}
          className="text-black/50"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.span>
      </motion.button>
    );
  };

  const collapseTransition = useMemo(
    () => ({
      duration: prefersReducedMotion ? 0 : DUR.md,
      ease: EASE,
    }),
    [prefersReducedMotion, DUR.md, EASE],
  );

  return (
    <aside
      className={cx(
        "h-screen w-[280px] shrink-0",
        "bg-[#f4f4f5]",
        "border-r border-black/10",
        "flex flex-col",
      )}
    >
      <div className="pt-3 flex-1 overflow-y-auto">
        <LayoutGroup id="sidebar">
          <nav className="flex flex-col">
            {primary.map((item) => (
              <Row key={item.label} item={item} />
            ))}

            <div className="my-3 h-px bg-black/10 mx-4" />

            <GroupHeader
              label="Canais de vendas"
              open={openSales}
              setOpen={setOpenSales}
            />

            <AnimatePresence initial={false}>
              {openSales && (
                <motion.div
                  className="mt-1"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={collapseTransition}
                  style={{ overflow: "hidden" }}
                >
                  <div className="mt-1">
                    {salesChannels.map((item) => (
                      <Row key={item.label} item={item} dense />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <GroupHeader label="Apps" open={openApps} setOpen={setOpenApps} />

            <AnimatePresence initial={false}>
              {openApps && (
                <motion.div
                  className="mt-1"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={collapseTransition}
                  style={{ overflow: "hidden" }}
                >
                  <div className="mt-1">
                    {apps.map((item) => (
                      <Row key={item.label} item={item} dense />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        </LayoutGroup>
      </div>

      {/* Rodapé igual da imagem */}
      <div className="pb-4 pt-3">
        <div className="px-2">
          <Link href="/configuracoes" className="block">
            <motion.div
              className="relative w-full flex items-center gap-3 py-2.5 pl-4 pr-3 rounded-xl"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
              transition={{
                duration: prefersReducedMotion ? 0 : DUR.xs,
                ease: EASE,
              }}
            >
              <div className="relative flex items-center justify-center w-6">
                <Settings className="h-[18px] w-[18px] text-black/75" />
              </div>
              <div className="relative flex-1 text-[15px] leading-none text-black/80">
                Configurações
              </div>
            </motion.div>
          </Link>
        </div>

        {/* Mantém o sistema sem “aparecer” na UI */}
        <div className="sr-only">
          <div>{email}</div>
          <div>{userId}</div>
          <Link href={logoutHref}>Sair</Link>
        </div>
      </div>
    </aside>
  );
}
