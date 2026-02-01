"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  HelpCircle,
  Keyboard,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquare,
  MoreHorizontal,
  PhoneCall,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
  Users2,
  Workflow,
  X,
} from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function titleFromEmail(email: string) {
  const base = String(email || "").split("@")[0] || "Usuário";
  const cleaned = base.replace(/[._-]+/g, " ").trim();
  return cleaned
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function stripQuery(href: string) {
  return String(href || "").split("?")[0] || "/";
}

function isMatch(text: string, q: string) {
  const a = String(text || "").toLowerCase();
  const b = String(q || "").toLowerCase().trim();
  if (!b) return true;
  return a.includes(b);
}

function highlight(text: string, q: string) {
  const query = String(q || "").trim();
  if (!query) return <>{text}</>;

  const lower = text.toLowerCase();
  const ql = query.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx < 0) return <>{text}</>;

  const before = text.slice(0, idx);
  const mid = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <>
      {before}
      <span className="rounded-[6px] bg-black/[0.06] px-1 py-0.5 ring-1 ring-black/10">{mid}</span>
      {after}
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center rounded-[8px] bg-white ring-1 ring-black/10 px-2 py-1 text-[11px] font-bold text-black/60">
      {children}
    </span>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "violet";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold ring-1",
        tone === "violet"
          ? "bg-violet-600/10 text-violet-700 ring-violet-600/20"
          : "bg-black/[0.04] text-black/60 ring-black/10",
      )}
    >
      {children}
    </span>
  );
}

function useFloatingMenuPosition(open: boolean, anchorRef: React.RefObject<HTMLElement>) {
  const [pos, setPos] = useState<{ top: number; left: number; placement: "right" | "top" } | null>(
    null,
  );

  const compute = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const desiredLeft = r.left + r.width + 12;
    const desiredTop = r.top;

    const placeRight = desiredLeft + 360 < vw; // menu width approx
    const left = placeRight ? desiredLeft : Math.max(16, vw - 16 - 360);

    const placement: "right" | "top" = placeRight ? "right" : "top";

    const topForRight = Math.min(Math.max(16, desiredTop), vh - 16 - 360);
    const topForTop = Math.max(16, r.bottom + 10);

    setPos({ left, top: placement === "right" ? topForRight : topForTop, placement });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    compute();

    const onResize = () => compute();
    const onScroll = () => compute();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, compute]);

  return pos;
}

function FloatingMenu({
  open,
  anchorRef,
  onClose,
  children,
  width = 360,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pos = useFloatingMenuPosition(open, anchorRef);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;

      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (anchor && anchor.contains(t)) return;
      if (menu && menu.contains(t)) return;

      onClose();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return (
    <div
      ref={menuRef}
      className={cx(
        "fixed z-[90]",
        "rounded-[18px] bg-white/95 backdrop-blur-xl",
        "ring-1 ring-black/10 shadow-[0_18px_60px_rgba(0,0,0,0.12)]",
        "overflow-hidden",
      )}
      style={{ width, left: pos.left, top: pos.top }}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}

function NavRow({
  href,
  label,
  icon: Icon,
  active,
  badge,
  shortcut,
  rightSparkle,
  indent = false,
  onNavigate,
  q,
}: {
  href: string;
  label: string;
  icon: IconType;
  active?: boolean;
  badge?: string;
  shortcut?: string;
  rightSparkle?: boolean;
  indent?: boolean;
  onNavigate?: () => void;
  q: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cx(
        "group flex items-center gap-3 rounded-[12px] px-2.5 py-2 transition-colors",
        indent ? "pl-9" : "",
        active ? "bg-black/[0.06] text-black" : "text-black/65 hover:text-black hover:bg-black/[0.04]",
      )}
    >
      <span
        className={cx(
          "inline-flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors",
          active ? "bg-white ring-1 ring-black/10" : "bg-transparent",
        )}
      >
        <Icon
          className={cx(
            "h-[18px] w-[18px] transition-colors",
            active ? "text-black" : "text-black/55 group-hover:text-black/75",
          )}
        />
      </span>

      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
        {highlight(label, q)}
      </span>

      {badge ? (
        <span className="ml-2 inline-flex min-w-[28px] justify-center rounded-full bg-black/[0.06] px-2 py-1 text-[11px] font-extrabold text-black/70 ring-1 ring-black/10">
          {badge}
        </span>
      ) : null}

      {rightSparkle ? (
        <span className="ml-1 inline-flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-violet-600" />
        </span>
      ) : null}

      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </Link>
  );
}

function SectionHeader({
  label,
  icon: Icon,
  open,
  onToggle,
  onPlus,
  q,
}: {
  label: string;
  icon: IconType;
  open: boolean;
  onToggle: () => void;
  onPlus?: () => void;
  q: string;
}) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className={cx(
          "w-full flex items-center gap-2 rounded-[12px] px-2.5 py-2",
          "text-black/55 hover:text-black hover:bg-black/[0.03] transition-colors",
        )}
        aria-expanded={open}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-black/[0.03] ring-1 ring-black/10">
          <Icon className="h-[16px] w-[16px] text-black/60" />
        </span>

        <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold uppercase tracking-wide">
          {highlight(label, q)}
        </span>

        <span className="inline-flex items-center gap-2">
          {onPlus ? (
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPlus();
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-white ring-1 ring-black/10 text-black/60 hover:text-black hover:bg-black/[0.03]"
              role="button"
              aria-label={`Adicionar em ${label}`}
              tabIndex={0}
            >
              <Plus className="h-4 w-4" />
            </span>
          ) : null}

          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-white ring-1 ring-black/10 text-black/60">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </span>
      </button>
    </div>
  );
}

export default function DashboardSidebar({
  email,
  userId,
  logoutHref = "/api/wz_AuthLogin/logout",
}: {
  email: string;
  userId: string;
  logoutHref?: string;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // dropdowns
  const orgBtnRef = useRef<HTMLButtonElement | null>(null);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  const [orgOpen, setOrgOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  // collapsibles
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [recordsOpen, setRecordsOpen] = useState(true);

  const displayName = useMemo(() => titleFromEmail(email), [email]);

  const isActive = useCallback(
    (href: string) => {
      const base = stripQuery(href);
      if (base === "/") return pathname === "/";
      return pathname === base || pathname.startsWith(`${base}/`);
    },
    [pathname],
  );

  const closeAllMenus = useCallback(() => {
    setOrgOpen(false);
    setUserOpen(false);
  }, []);

  // ⌘K focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      const meta = e.metaKey || e.ctrlKey;
      if (meta && isK) {
        e.preventDefault();
        closeAllMenus();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        closeAllMenus();
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeAllMenus]);

  const orgs = useMemo(
    () => [
      { id: "wyzer", name: "Wyzer", shortcut: "⌘1", selected: true },
      { id: "suporte", name: "Operação Suporte", shortcut: "⌘2", selected: false },
      { id: "growth", name: "Growth & Vendas", shortcut: "⌘3", selected: false },
      { id: "labs", name: "Wyzer Labs", shortcut: "⌘4", selected: false },
    ],
    [],
  );

  // Estrutura “parecida com a imagem”, mantendo suas rotas e adicionando opções (com query) sem quebrar
  const mainItems = useMemo(
    () => [
      {
        href: "/",
        label: "Dashboard",
        icon: BarChart3,
        badge: "",
        shortcut: "",
        rightSparkle: false,
      },
      {
        href: "/inbox",
        label: "Conversas",
        icon: MessageSquare,
        badge: "16",
        shortcut: "",
        rightSparkle: false,
      },
      {
        href: "/inbox?tab=tasks",
        label: "Tarefas",
        icon: Workflow,
        badge: "",
        shortcut: "",
        rightSparkle: false,
      },
      {
        href: "/base-de-conhecimento?tab=notes",
        label: "Notas",
        icon: StickyNote,
        badge: "",
        shortcut: "",
        rightSparkle: false,
      },
      {
        href: "/settings?tab=email",
        label: "Emails",
        icon: Mail,
        badge: "",
        shortcut: "",
        rightSparkle: false,
      },
      {
        href: "/analytics?tab=reports",
        label: "Relatórios",
        icon: BarChart3,
        badge: "",
        shortcut: "",
        rightSparkle: false,
      },
      {
        href: "/automacoes",
        label: "Automações",
        icon: Workflow,
        badge: "",
        shortcut: "",
        rightSparkle: true,
      },
      {
        href: "/automacoes?tab=workflows",
        label: "Workflows",
        icon: Workflow,
        badge: "",
        shortcut: "",
        rightSparkle: true,
      },
    ],
    [],
  );

  const companyItems = useMemo(
    () => [
      {
        href: "/canais",
        label: "Canais WhatsApp",
        icon: PhoneCall,
        badge: "",
        shortcut: "",
        rightSparkle: false,
      },
      {
        href: "/integracoes",
        label: "Integrações",
        icon: Settings,
        badge: "",
        shortcut: "",
        rightSparkle: false,
      },
      {
        href: "/copiloto",
        label: "Copiloto IA",
        icon: Bot,
        badge: "",
        shortcut: "",
        rightSparkle: true,
      },
      {
        href: "/base-de-conhecimento",
        label: "Base de conhecimento",
        icon: BookOpen,
        badge: "",
        shortcut: "",
        rightSparkle: false,
      },
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        badge: "",
        shortcut: "",
        rightSparkle: false,
      },
    ],
    [],
  );

  const bottomItems = useMemo(
    () => [
      { href: "/equipe", label: "Atendentes", icon: Users2 },
      { href: "/billing", label: "Planos & cobrança", icon: CreditCard },
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
    [],
  );

  const favoritesItems = useMemo(
    () => [
      { href: "/analytics?tab=key-accounts", label: "Key Accounts", icon: Star },
      { href: "/automacoes?tab=campaigns", label: "Campanhas IA", icon: Sparkles },
      { href: "/inbox?tab=starred", label: "Itens marcados", icon: Star },
    ],
    [],
  );

  const recordsItems = useMemo(
    () => [
      { href: "/analytics?tab=companies", label: "Empresas", icon: Building2 },
      { href: "/analytics?tab=people", label: "Pessoas", icon: Users2 },
    ],
    [],
  );

  const filteredMain = useMemo(() => mainItems.filter((i) => isMatch(i.label, q)), [mainItems, q]);
  const filteredCompany = useMemo(
    () => companyItems.filter((i) => isMatch(i.label, q)),
    [companyItems, q],
  );
  const filteredBottom = useMemo(
    () => bottomItems.filter((i) => isMatch(i.label, q)),
    [bottomItems, q],
  );

  const filteredFavorites = useMemo(
    () => favoritesItems.filter((i) => isMatch(i.label, q)),
    [favoritesItems, q],
  );
  const filteredRecords = useMemo(
    () => recordsItems.filter((i) => isMatch(i.label, q)),
    [recordsItems, q],
  );

  const anySearch = Boolean(String(q || "").trim());
  const favOpen = anySearch ? true : favoritesOpen;
  const recOpen = anySearch ? true : recordsOpen;

  return (
    <aside
      className={cx(
        "fixed md:sticky top-0 left-0 z-[70] h-screen w-[288px] shrink-0",
        "bg-white/90 backdrop-blur-xl",
        "border-r border-black/10",
        "px-3 py-3",
        "transition-transform duration-300 ease-out",
        "-translate-x-full peer-checked:translate-x-0",
        "md:translate-x-0",
      )}
    >
      <div className="h-full flex flex-col">
        {/* Top: workspace */}
        <div className="relative">
          <div className="flex items-start justify-between gap-2 px-1">
            <button
              ref={orgBtnRef}
              type="button"
              onClick={() => {
                setUserOpen(false);
                setOrgOpen((v) => !v);
              }}
              className={cx(
                "flex items-start gap-3 min-w-0 text-left",
                "rounded-[14px] px-2 py-2",
                "hover:bg-black/[0.03] transition-colors",
              )}
              aria-haspopup="dialog"
              aria-expanded={orgOpen}
            >
              <div className="h-10 w-10 rounded-[14px] bg-black flex items-center justify-center ring-1 ring-black/10 shadow-[0_12px_35px_rgba(0,0,0,0.14)]">
                <div className="h-5 w-5 rounded-[7px] bg-white/90 ring-1 ring-white/20" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="truncate text-[15px] font-extrabold tracking-tight text-black">
                    Wyzer
                  </div>
                  <ChevronDown className="h-4 w-4 text-black/50" />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] font-semibold text-black/45">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-black/30" />
                  <span className="truncate">21 members</span>
                </div>
              </div>
            </button>

            {/* close mobile */}
            <label
              htmlFor="wzSidebarToggle"
              className={cx(
                "md:hidden inline-flex h-10 w-10 items-center justify-center",
                "rounded-[14px] bg-black/[0.03] ring-1 ring-black/10",
                "text-black/70 hover:text-black hover:bg-black/[0.05] transition-colors cursor-pointer",
              )}
              aria-label="Fechar"
              onClick={() => closeAllMenus()}
            >
              <X className="h-5 w-5" />
            </label>
          </div>

          <FloatingMenu
            open={orgOpen}
            anchorRef={orgBtnRef as unknown as React.RefObject<HTMLElement>}
            onClose={() => setOrgOpen(false)}
          >
            <div className="p-2">
              <div className="px-2 pt-2 pb-1 text-[12px] font-bold text-black/45">smith@example.com</div>

              <div className="mt-2 space-y-1">
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      // aqui você pode plugar o switch real depois (store / cookie / api)
                      setOrgOpen(false);
                    }}
                    className={cx(
                      "w-full flex items-center gap-3 rounded-[14px] px-3 py-2",
                      "hover:bg-black/[0.03] transition-colors text-left",
                    )}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                      <Building2 className="h-5 w-5 text-black/65" />
                    </span>

                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-black/85">
                      {o.name}
                    </span>

                    {o.selected ? (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] bg-white ring-1 ring-black/10">
                        <Check className="h-5 w-5 text-black" />
                      </span>
                    ) : (
                      <Kbd>{o.shortcut}</Kbd>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-2 border-t border-black/10" />

              <button
                type="button"
                onClick={() => setOrgOpen(false)}
                className="w-full flex items-center gap-3 rounded-[14px] px-3 py-2 mt-2 hover:bg-black/[0.03] transition-colors"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                  <Plus className="h-5 w-5 text-black/65" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-black/80">
                  New account
                </span>
                <Kbd>⌘A</Kbd>
              </button>
            </div>
          </FloatingMenu>
        </div>

        {/* Search */}
        <div className="mt-2 px-1">
          <div
            className={cx(
              "flex items-center gap-2 rounded-[14px]",
              "bg-black/[0.03] ring-1 ring-black/10",
              "px-3 py-2",
            )}
          >
            <Search className="h-4 w-4 text-black/45" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent outline-none text-[13px] font-semibold text-black/80 placeholder:text-black/35"
            />
            <Kbd>⌘K</Kbd>
          </div>
        </div>

        {/* Scroll area */}
        <div className="mt-2 flex-1 overflow-y-auto pr-1">
          {/* Main list */}
          <div className="px-1 mt-1 space-y-0.5">
            {filteredMain.map((it) => (
              <NavRow
                key={it.href}
                href={it.href}
                label={it.label}
                icon={it.icon}
                active={isActive(it.href)}
                badge={it.badge || undefined}
                shortcut={it.shortcut || undefined}
                rightSparkle={it.rightSparkle}
                q={q}
                onNavigate={() => closeAllMenus()}
              />
            ))}
          </div>

          {/* Company-like section with your existing options */}
          <div className="mt-2 px-1">
            <div className="my-2 h-px bg-black/10" />
            {filteredCompany.map((it) => (
              <NavRow
                key={it.href}
                href={it.href}
                label={it.label}
                icon={it.icon}
                active={isActive(it.href)}
                rightSparkle={it.rightSparkle}
                q={q}
                onNavigate={() => closeAllMenus()}
              />
            ))}
          </div>

          {/* Favorites */}
          <div className="px-1">
            <SectionHeader
              label="Favorites"
              icon={Star}
              open={favOpen}
              onToggle={() => setFavoritesOpen((v) => !v)}
              onPlus={() => {
                // você pode plugar criar favorito aqui
              }}
              q={q}
            />
            {favOpen ? (
              <div className="mt-1 space-y-0.5">
                {filteredFavorites.map((it) => (
                  <NavRow
                    key={it.href}
                    href={it.href}
                    label={it.label}
                    icon={it.icon}
                    active={isActive(it.href)}
                    indent
                    q={q}
                    onNavigate={() => closeAllMenus()}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Records */}
          <div className="px-1">
            <SectionHeader
              label="Records"
              icon={Building2}
              open={recOpen}
              onToggle={() => setRecordsOpen((v) => !v)}
              onPlus={() => {
                // você pode plugar criar registro aqui
              }}
              q={q}
            />
            {recOpen ? (
              <div className="mt-1 space-y-0.5">
                {filteredRecords.map((it) => (
                  <NavRow
                    key={it.href}
                    href={it.href}
                    label={it.label}
                    icon={it.icon}
                    active={isActive(it.href)}
                    indent
                    q={q}
                    onNavigate={() => closeAllMenus()}
                  />
                ))}

                {/* mantém suas rotas reais bem visíveis aqui também */}
                {filteredBottom.map((it) => (
                  <NavRow
                    key={it.href}
                    href={it.href}
                    label={it.label}
                    icon={it.icon}
                    active={isActive(it.href)}
                    indent
                    q={q}
                    onNavigate={() => closeAllMenus()}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* New version card (igual vibe da imagem) */}
          <div className="px-1 mt-3">
            <div className="rounded-[16px] bg-white ring-1 ring-black/10 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold text-black">New version available</div>
                  <div className="mt-1 text-[12px] font-semibold text-black/45">
                    Uma versão melhorada do app está disponível.
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10 text-black/60 hover:text-black hover:bg-black/[0.05]"
                  aria-label="Fechar aviso"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-[12px] bg-black text-white px-3 py-2 text-[12px] font-extrabold shadow-[0_12px_35px_rgba(0,0,0,0.18)]"
                >
                  Update <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom user */}
        <div className="mt-2 px-1">
          <button
            ref={userBtnRef}
            type="button"
            onClick={() => {
              setOrgOpen(false);
              setUserOpen((v) => !v);
            }}
            className={cx(
              "w-full flex items-center gap-3 rounded-[16px] px-3 py-2.5",
              "bg-black/[0.02] ring-1 ring-black/10",
              "hover:bg-black/[0.04] transition-colors",
            )}
            aria-haspopup="dialog"
            aria-expanded={userOpen}
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-[14px] bg-white ring-1 ring-black/10 flex items-center justify-center overflow-hidden">
                <span className="text-[13px] font-extrabold text-black/70">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>

            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-[13px] font-extrabold text-black">{displayName}</div>
              <div className="truncate text-[12px] font-semibold text-black/45">Online</div>
            </div>

            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] bg-white ring-1 ring-black/10 text-black/55">
              <MoreHorizontal className="h-5 w-5" />
            </span>
          </button>

          <FloatingMenu
            open={userOpen}
            anchorRef={userBtnRef as unknown as React.RefObject<HTMLElement>}
            onClose={() => setUserOpen(false)}
            width={340}
          >
            <div className="p-2">
              <div className="px-2 pt-2 pb-2">
                <div className="text-[13px] font-extrabold text-black">{displayName}</div>
                <div className="mt-0.5 text-[12px] font-semibold text-black/45 truncate">{email}</div>
                <div className="mt-1 text-[11px] font-semibold text-black/35 truncate">ID: {userId}</div>
              </div>

              <div className="mt-1 space-y-1">
                <Link
                  href="/settings?tab=theme"
                  className="flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors"
                  onClick={() => setUserOpen(false)}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                      <Sparkles className="h-5 w-5 text-black/65" />
                    </span>
                    <span className="text-[13px] font-bold text-black/80">Themes</span>
                  </span>
                  <Kbd>⌘T</Kbd>
                </Link>

                <Link
                  href="/settings"
                  className="flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors"
                  onClick={() => setUserOpen(false)}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                      <Settings className="h-5 w-5 text-black/65" />
                    </span>
                    <span className="text-[13px] font-bold text-black/80">Settings</span>
                  </span>
                  <Kbd>⌘S</Kbd>
                </Link>

                <Link
                  href="/settings?tab=notifications"
                  className="flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors"
                  onClick={() => setUserOpen(false)}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                      <Bell className="h-5 w-5 text-black/65" />
                    </span>
                    <span className="text-[13px] font-bold text-black/80">Notification</span>
                  </span>
                  <Kbd>⌘N</Kbd>
                </Link>

                <div className="my-2 h-px bg-black/10" />

                <button
                  type="button"
                  onClick={() => setUserOpen(false)}
                  className="w-full flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                      <Keyboard className="h-5 w-5 text-black/65" />
                    </span>
                    <span className="text-[13px] font-bold text-black/80">Hotkeys</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-black/45" />
                </button>

                <button
                  type="button"
                  onClick={() => setUserOpen(false)}
                  className="w-full flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                      <Download className="h-5 w-5 text-black/65" />
                    </span>
                    <span className="text-[13px] font-bold text-black/80">Download apps</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-black/45" />
                </button>

                <div className="flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                      <Star className="h-5 w-5 text-black/65" />
                    </span>
                    <span className="text-[13px] font-bold text-black/80">Referrals</span>
                  </span>
                  <Pill tone="violet">New</Pill>
                </div>

                <Link
                  href="/billing"
                  className="flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors"
                  onClick={() => setUserOpen(false)}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                      <CreditCard className="h-5 w-5 text-black/65" />
                    </span>
                    <span className="text-[13px] font-bold text-black/80">Plans</span>
                  </span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] bg-white ring-1 ring-black/10">
                    <ChevronRight className="h-4 w-4 text-black/45" />
                  </span>
                </Link>

                <Link
                  href="/base-de-conhecimento"
                  className="flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors"
                  onClick={() => setUserOpen(false)}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                      <HelpCircle className="h-5 w-5 text-black/65" />
                    </span>
                    <span className="text-[13px] font-bold text-black/80">Help</span>
                  </span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] bg-white ring-1 ring-black/10">
                    <ChevronRight className="h-4 w-4 text-black/45" />
                  </span>
                </Link>

                <div className="my-2 h-px bg-black/10" />

                <button
                  type="button"
                  onClick={() => {
                    setUserOpen(false);
                    router.push("/inbox?tab=trash");
                  }}
                  className="w-full flex items-center gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                    <Trash2 className="h-5 w-5 text-black/65" />
                  </span>
                  <span className="text-[13px] font-bold text-black/80">Trash</span>
                </button>

                <Link
                  href={logoutHref}
                  className="flex items-center gap-3 rounded-[14px] px-3 py-2 hover:bg-black/[0.03] transition-colors"
                  onClick={() => setUserOpen(false)}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-black/[0.03] ring-1 ring-black/10">
                    <LogOut className="h-5 w-5 text-black/65" />
                  </span>
                  <span className="text-[13px] font-extrabold text-black">Log out</span>
                </Link>
              </div>
            </div>
          </FloatingMenu>
        </div>
      </div>
    </aside>
  );
}
