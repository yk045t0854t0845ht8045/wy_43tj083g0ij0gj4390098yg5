"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FolderKanban,
  HelpCircle,
  Layers,
  LayoutGrid,
  LogOut,
  Mail,
  Megaphone,
  MessageSquareText,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardNavKey =
  | "dashboard"
  | "analytics"
  | "projects"
  | "calendar"
  | "messages_all"
  | "messages_unread"
  | "messages_updates"
  | "messages_archived"
  | "notifications"
  | "account_store"
  | "account_billing"
  | "account_orders"
  | "account_subscriptions"
  | "settings"
  | "support";

type NavItem = {
  key: DashboardNavKey;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type NavGroup = {
  key: "messages";
  label: string;
  icon: LucideIcon;
  children: NavItem[];
};

function useIsLgUp() {
  const [isLgUp, setIsLgUp] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(mq.matches);

    update();
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    // Safari legacy
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  return isLgUp;
}

function getInitials(email: string) {
  const base = String(email || "").split("@")[0] || "U";
  const parts = base
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] || base[0] || "U";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function getDisplayName(email: string) {
  const base = String(email || "").split("@")[0] || "Usuário";
  const cleaned = base.replace(/[^a-z0-9]+/gi, " ").trim();
  if (!cleaned) return "Usuário";
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(" ");
}

function BrandMark() {
  return (
    <div
      className="grid h-9 w-9 grid-cols-2 gap-1 rounded-2xl bg-gradient-to-b from-orange-500 to-orange-600 p-2 shadow-sm"
      aria-hidden="true"
    >
      <span className="h-full w-full rounded-full bg-white/95" />
      <span className="h-full w-full rounded-full bg-white/85" />
      <span className="h-full w-full rounded-full bg-white/85" />
      <span className="h-full w-full rounded-full bg-white/95" />
    </div>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  trailing,
  onClick,
}: {
  item: { label: string; icon: LucideIcon; badge?: number };
  active: boolean;
  collapsed: boolean;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm",
        "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active &&
          "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_1px_0_rgba(0,0,0,0.06)] ring-1 ring-sidebar-border",
        collapsed && "justify-center px-2",
      )}
      title={collapsed ? item.label : undefined}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar/70">
        <Icon className="h-[18px] w-[18px]" />
      </span>

      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>

          {typeof item.badge === "number" && (
            <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {item.badge}
            </span>
          )}

          {trailing}
        </>
      )}

      {collapsed && typeof item.badge === "number" && (
        <span className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {item.badge}
        </span>
      )}
    </button>
  );
}

export default function DashboardSidebar({
  email,
  userId,
  logoutHref = "/api/wz_AuthLogin/logout",
  collapsed,
  mobileOpen,
  onMobileOpenChange,
  onToggleCollapsed,
  activeKey,
  onSelect,
}: {
  email: string;
  userId: string;
  logoutHref?: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onToggleCollapsed: () => void;
  activeKey: DashboardNavKey;
  onSelect: (key: DashboardNavKey) => void;
}) {
  const isLgUp = useIsLgUp();
  const effectiveCollapsed = isLgUp && collapsed;

  const [query, setQuery] = useState("");
  const [openMessages, setOpenMessages] = useState(true);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen, onMobileOpenChange]);

  const primaryItems: NavItem[] = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
      { key: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
      { key: "projects", label: "Projects", icon: FolderKanban },
      { key: "calendar", label: "Calendar", icon: CalendarDays },
    ],
    [],
  );

  const messagesGroup: NavGroup = useMemo(
    () => ({
      key: "messages",
      label: "Messages",
      icon: MessageSquareText,
      children: [
        { key: "messages_all", label: "All", icon: Layers },
        { key: "messages_unread", label: "Unread", icon: Mail, badge: 12 },
        { key: "messages_updates", label: "Updates", icon: Megaphone },
        { key: "messages_archived", label: "Archived", icon: Archive },
      ],
    }),
    [],
  );

  const notifications: NavItem = useMemo(
    () => ({
      key: "notifications",
      label: "Notifications",
      icon: Bell,
      badge: 4,
    }),
    [],
  );

  const accountItems: NavItem[] = useMemo(
    () => [
      { key: "account_store", label: "My Store", icon: Store },
      { key: "account_billing", label: "Billing", icon: CreditCard },
      { key: "account_orders", label: "Orders", icon: Package },
      { key: "account_subscriptions", label: "Subscriptions", icon: LayoutGrid },
    ],
    [],
  );

  const bottomItems: NavItem[] = useMemo(
    () => [
      { key: "settings", label: "Settings", icon: Wrench },
      { key: "support", label: "Support", icon: HelpCircle },
    ],
    [],
  );

  const q = query.trim().toLowerCase();
  const match = (label: string) => !q || label.toLowerCase().includes(q);

  const filteredPrimary = primaryItems.filter((i) => match(i.label));
  const filteredAccount = accountItems.filter((i) => match(i.label));
  const filteredBottom = bottomItems.filter((i) => match(i.label));
  const messagesMatches =
    match(messagesGroup.label) ||
    messagesGroup.children.some((c) => match(c.label));

  const isMessagesActive =
    activeKey === "messages_all" ||
    activeKey === "messages_unread" ||
    activeKey === "messages_updates" ||
    activeKey === "messages_archived";

  const showMessagesChildren =
    openMessages && !effectiveCollapsed && (q ? messagesMatches : true);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          aria-label="Fechar menu"
          onClick={() => onMobileOpenChange(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(88vw,340px)] shrink-0 flex-col",
          "border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl",
          "transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-auto lg:translate-x-0 lg:shadow-none lg:transition-[width] lg:duration-200 lg:ease-out",
          effectiveCollapsed ? "lg:w-[88px]" : "lg:w-[280px]",
        )}
      >
        <div className="flex items-center gap-3 px-4 pt-4">
          <BrandMark />
          {!effectiveCollapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Wyzer</div>
              <div className="truncate text-xs text-muted-foreground">
                Dashboard
              </div>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className={cn(
                "hidden items-center justify-center rounded-xl border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground/80 shadow-sm",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                "lg:inline-flex",
              )}
              aria-label={
                effectiveCollapsed ? "Expandir sidebar" : "Minimizar sidebar"
              }
            >
              {effectiveCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onMobileOpenChange(false)}
              className={cn(
                "inline-flex items-center justify-center rounded-xl border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground/80 shadow-sm",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                "lg:hidden",
              )}
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!effectiveCollapsed && (
          <div className="px-4 pb-3 pt-4">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 21l-4.3-4.3" />
                <circle cx="11" cy="11" r="7" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="Search"
                className={cn(
                  "w-full rounded-2xl border border-sidebar-border bg-background px-9 py-2 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                )}
              />
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <nav className="space-y-1">
            {filteredPrimary.map((item) => (
              <NavRow
                key={item.key}
                item={item}
                collapsed={effectiveCollapsed}
                active={activeKey === item.key}
                onClick={() => onSelect(item.key)}
              />
            ))}

            {(messagesMatches || !q) && (
              <div className="mt-1">
                <NavRow
                  item={{ label: messagesGroup.label, icon: messagesGroup.icon }}
                  collapsed={effectiveCollapsed}
                  active={isMessagesActive}
                  trailing={
                    <span
                      className={cn(
                        "inline-flex items-center text-sidebar-foreground/60 transition-transform",
                        openMessages ? "rotate-0" : "-rotate-90",
                      )}
                      aria-hidden="true"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  }
                  onClick={() => setOpenMessages((v) => !v)}
                />

                {showMessagesChildren && (
                  <div className="ml-6 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                    {messagesGroup.children
                      .filter((c) => match(c.label))
                      .map((child) => (
                        <button
                          key={child.key}
                          type="button"
                          onClick={() => onSelect(child.key)}
                          className={cn(
                            "group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm",
                            "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                            activeKey === child.key &&
                              "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border",
                          )}
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar/70">
                            <child.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-left">
                            {child.label}
                          </span>
                          {typeof child.badge === "number" && (
                            <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                              {child.badge}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-sidebar-foreground/40" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {match(notifications.label) && (
              <NavRow
                item={notifications}
                collapsed={effectiveCollapsed}
                active={activeKey === notifications.key}
                onClick={() => onSelect(notifications.key)}
              />
            )}

            <div className="my-3 h-px bg-sidebar-border/80" />

            {!effectiveCollapsed && (
              <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground">
                ACCOUNT
              </div>
            )}

            {filteredAccount.map((item) => (
              <NavRow
                key={item.key}
                item={item}
                collapsed={effectiveCollapsed}
                active={activeKey === item.key}
                onClick={() => onSelect(item.key)}
              />
            ))}

            <div className="mt-3 space-y-1">
              {filteredBottom.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  collapsed={effectiveCollapsed}
                  active={activeKey === item.key}
                  onClick={() => onSelect(item.key)}
                />
              ))}
            </div>
          </nav>
        </div>

        <div className="border-t border-sidebar-border px-3 py-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-sidebar-border bg-background p-3 shadow-sm",
              effectiveCollapsed && "justify-center p-2",
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-700 text-sm font-semibold text-white">
              {getInitials(email)}
            </div>

            {!effectiveCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {getDisplayName(email)}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {email}
                </div>
              </div>
            )}

            <Link
              href={logoutHref}
              className={cn(
                "inline-flex items-center justify-center rounded-xl border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground/80 shadow-sm",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              )}
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>

          <div className="sr-only">
            <div>{email}</div>
            <div>{userId}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
