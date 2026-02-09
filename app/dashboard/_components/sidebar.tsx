"use client";

import Image from "next/image";
import Script from "next/script";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BellOff, LogOut, Moon, Settings, User } from "lucide-react";
import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type MainItemId =
  | "overview"
  | "catalog"
  | "categories"
  | "customers"
  | "transactions";

type SubItemId = "orders" | "drafts";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useIsMobileSm() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");

    const apply = () => setIsMobile(mq.matches);
    apply();

    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return isMobile;
}

type LordIconProps = React.HTMLAttributes<HTMLElement> & {
  src: string;
  trigger?: string;
  target?: string;
  state?: string;
};

function IOverview({ target }: { target?: string }) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/ewtxwele.json",
        trigger: "hover",
        target,
        style: { width: "18px", height: "18px" },
      })}
    </span>
  );
}

function ITransactions({ target }: { target?: string }) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/ynsswhvj.json",
        trigger: "hover",
        target,
        style: { width: "18px", height: "18px" },
      })}
    </span>
  );
}

function ICatalog({ target }: { target?: string }) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/awjeikyj.json",
        trigger: "hover",
        target,
        style: { width: "18px", height: "18px" },
      })}
    </span>
  );
}

function ICustomers({ target }: { target?: string }) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/fmsilsqx.json",
        trigger: "hover",
        target,
        style: { width: "18px", height: "18px" },
      })}
    </span>
  );
}

function ICategories({ target }: { target?: string }) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/iwlihxdl.json",
        trigger: "hover",
        target,
        style: { width: "18px", height: "18px" },
      })}
    </span>
  );
}

function IHelp({ target }: { target?: string }) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/etrhcwgm.json",
        trigger: "hover",
        target,
        style: { width: "18px", height: "18px" },
      })}
    </span>
  );
}

function ISettings({ target }: { target?: string }) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/umuwriak.json",
        state: "hover-cog-4",
        trigger: "hover",
        target,
        style: { width: "18px", height: "18px" },
      })}
    </span>
  );
}

function IInvoiceInfo({ target }: { target?: string }) {
  return (
    <span className="w-[16px] h-[16px] inline-flex items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/tnapqovl.json",
        trigger: "hover",
        target,
        style: { width: "16px", height: "16px" },
      })}
    </span>
  );
}

function SidebarCollapseIcon() {
  return (
    <span className="inline-flex items-center justify-center" aria-hidden="true">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/ntjwyxgv.json",
        trigger: "hover",
        style: { width: "22px", height: "22px" },
      })}
    </span>
  );
}

function SidebarMobileCloseIcon() {
  return (
    <span className="inline-flex items-center justify-center" aria-hidden="true">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://media.lordicon.com/assets/icons/editor/close.json",
        trigger: "hover",
        style: { width: "20px", height: "20px" },
      })}
    </span>
  );
}

function CaretDown({ open }: { open: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex h-[18px] w-[18px] items-center justify-center text-black/55 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        open && "rotate-180"
      )}
      aria-hidden="true"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

function ProfileChevron({ open }: { open: boolean }) {
  return (
    <motion.span
      className="inline-flex h-[18px] w-[18px] items-center justify-center text-black/45"
      animate={{ rotate: open ? 180 : 0, y: open ? -0.4 : 0.4 }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 27,
        mass: 0.5,
      }}
      aria-hidden="true"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </motion.span>
  );
}

type CollapsedTooltipProps = {
  label: string;
  open?: boolean;
  interactive?: boolean;
  actions?: Array<{
    id: string;
    label: string;
    onSelect: () => void;
  }>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

function CollapsedTooltip({
  label,
  open = false,
  interactive = false,
  actions,
  onMouseEnter,
  onMouseLeave,
}: CollapsedTooltipProps) {
  const isInteractive = interactive || Boolean(actions && actions.length > 0);

  return (
    <div
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cx(
        "absolute left-[calc(100%+4px)] top-1/2 z-[120] -translate-y-1/2",
        "origin-left",
        isInteractive
          ? open
            ? "pointer-events-auto opacity-100 translate-x-0 scale-100"
            : "pointer-events-none opacity-0 translate-x-1 scale-[0.98]"
          : "pointer-events-none opacity-0 translate-x-1 scale-[0.98] group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100",
        "transition-[opacity,transform] duration-180 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        "will-change-transform"
      )}
    >
      <div
        className={cx(
          "relative w-max rounded-xl border border-black/10",
          isInteractive ? "min-w-[130px] max-w-[240px] px-3 py-2" : "max-w-[220px] px-4 py-2",
          "bg-white/98 backdrop-blur-[2px]",
          "shadow-[0_10px_24px_rgba(0,0,0,0.14)]"
        )}
      >
        <span
          aria-hidden="true"
          className="absolute -left-[5px] top-1/2 h-[10px] w-[10px] -translate-y-1/2 rotate-45 border-b border-l border-black/10 bg-white/98"
        />
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-black/90">
          {label}
        </p>
        {actions && actions.length > 0 && (
          <ul className="mt-2 space-y-1.5 border-t border-dashed border-black/15 pt-2">
            {actions.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={action.onSelect}
                  tabIndex={open ? 0 : -1}
                  className={cx(
                    "w-full rounded-lg px-2.5 py-1.5 text-left",
                    "text-[12px] font-medium text-black/75",
                    "transition-colors duration-150 ease-out",
                    "hover:bg-black/[0.05] hover:text-black/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
                  )}
                >
                  {action.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type Props = {
  activeMain?: MainItemId;
  activeSub?: SubItemId | null;
  userNickname?: string;
  userEmail?: string;
};

const SIDEBAR_COLLAPSE_STORAGE_KEY = "dashboard-sidebar-collapsed-v1";

export default function Sidebar({
  activeMain = "overview",
  activeSub = null,
  userNickname = "Usuario",
  userEmail = "conta@wyzer.com.br",
}: Props) {
  const [transactionsOpen, setTransactionsOpen] = useState(
    () => activeMain === "transactions"
  );
  const isMobile = useIsMobileSm();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [collapseLoaded, setCollapseLoaded] = useState(false);
  const [sidebarLogoFallback, setSidebarLogoFallback] = useState(false);
  const [paymentsTooltipOpen, setPaymentsTooltipOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuWrapRef = useRef<HTMLDivElement | null>(null);
  const paymentsTooltipCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [activeMainState, setActiveMainState] = useState<MainItemId>(activeMain);
  const [activeSubState, setActiveSubState] = useState<SubItemId | null>(activeSub);
  const isCollapsed = !isMobile && desktopCollapsed;
  const showCollapsedTooltips = isCollapsed && !isMobile;
  const expandedSidebarLogoSrc = "/lg/topj4390tjg83gh43g.svg";
  const collapsedSidebarLogoSrc = "/logo-m.svg";
  const preferredSidebarLogoSrc = isCollapsed
    ? collapsedSidebarLogoSrc
    : expandedSidebarLogoSrc;
  const sidebarLogoSrc = sidebarLogoFallback
    ? expandedSidebarLogoSrc
    : preferredSidebarLogoSrc;
  const resolvedUserEmail = useMemo(() => {
    const value = String(userEmail || "").trim().toLowerCase();
    return value || "conta@wyzer.com.br";
  }, [userEmail]);
  const resolvedUserNickname = useMemo(() => {
    const direct = String(userNickname || "").trim();
    if (direct) return direct.slice(0, 24);

    if (!resolvedUserEmail.includes("@")) return "Usuario";
    const local = resolvedUserEmail.split("@")[0] || "";
    const clean = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return "Usuario";

    return clean
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
      .slice(0, 24);
  }, [userNickname, resolvedUserEmail]);
  const profileInitial = useMemo(() => {
    const first = resolvedUserNickname.trim().charAt(0);
    return first ? first.toUpperCase() : "U";
  }, [resolvedUserNickname]);

  useEffect(() => setActiveMainState(activeMain), [activeMain]);
  useEffect(() => setActiveSubState(activeSub), [activeSub]);
  useEffect(() => {
    setTransactionsOpen(activeMain === "transactions");
  }, [activeMain]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
      setDesktopCollapsed(saved === "1");
    } catch {
      setDesktopCollapsed(false);
    } finally {
      setCollapseLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!collapseLoaded) return;
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSE_STORAGE_KEY,
        desktopCollapsed ? "1" : "0"
      );
    } catch {
      // no-op: storage can fail in restricted browser contexts
    }
  }, [collapseLoaded, desktopCollapsed]);

  useEffect(() => {
    setSidebarLogoFallback(false);
  }, [preferredSidebarLogoSrc]);

  useEffect(() => {
    if (showCollapsedTooltips) return;
    setPaymentsTooltipOpen(false);
  }, [showCollapsedTooltips]);

  useEffect(() => {
    if (!isCollapsed) return;
    setProfileMenuOpen(false);
  }, [isCollapsed]);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const root = profileMenuWrapRef.current;
      const target = e.target as Node | null;
      if (!root || !target) return;
      if (!root.contains(target)) setProfileMenuOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    return () => {
      if (paymentsTooltipCloseTimerRef.current) {
        clearTimeout(paymentsTooltipCloseTimerRef.current);
      }
    };
  }, []);

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !mobileMenuOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobile, mobileMenuOpen]);

  const idBase = useId();
  const cleanIdBase = useMemo(
    () => idBase.replace(/[^a-zA-Z0-9_-]/g, ""),
    [idBase]
  );
  const overviewHoverClass = `sidebar-overview-${cleanIdBase}`;
  const catalogHoverTargetId = `sidebar-atendimentos-${cleanIdBase}`;
  const categoriesHoverTargetId = `sidebar-categorias-${cleanIdBase}`;
  const productsHoverTargetId = `sidebar-produtos-${cleanIdBase}`;
  const transactionsHoverTargetId = `sidebar-pagamentos-${cleanIdBase}`;
  const helpHoverTargetId = `sidebar-ajuda-${cleanIdBase}`;
  const settingsHoverTargetId = `sidebar-configuracoes-${cleanIdBase}`;
  const invoicesInfoTargetId = `sidebar-invoices-info-${cleanIdBase}`;

  const submenuWrapRef = useRef<HTMLDivElement | null>(null);
  const subBtnRefs = useRef<Record<SubItemId, HTMLButtonElement | null>>({
    orders: null,
    drafts: null,
  });

  const indicatorHeightPx = 26;
  const [indicatorY, setIndicatorY] = useState<number>(8);

  const isOnTransactions = activeMainState === "transactions";
  const indicatorVisible =
    !isCollapsed && isOnTransactions && transactionsOpen && activeSubState !== null;

  const prefersReducedMotion = useReducedMotion();
  const activePillTransition = useMemo(
    () =>
      prefersReducedMotion
        ? { duration: 0.12 }
        : {
            type: "spring" as const,
            stiffness: 980,
            damping: 54,
            mass: 0.46,
            restDelta: 0.25,
            restSpeed: 0.25,
          },
    [prefersReducedMotion]
  );

  const tapFeedback = useMemo(
    () => (prefersReducedMotion ? undefined : { scale: 0.992, y: 0.6 }),
    [prefersReducedMotion]
  );

  const tapFeedbackTransition = useMemo(
    () =>
      prefersReducedMotion
        ? { duration: 0.08 }
        : { type: "spring" as const, stiffness: 1200, damping: 52, mass: 0.24 },
    [prefersReducedMotion]
  );

  const measureIndicator = () => {
    const wrap = submenuWrapRef.current;
    if (!wrap || !activeSubState) return;

    const btn = subBtnRefs.current[activeSubState];
    if (!btn) return;

    const wrapRect = wrap.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const y = btnRect.top - wrapRect.top + (btnRect.height - indicatorHeightPx) / 2;

    setIndicatorY(y);
  };

  useLayoutEffect(() => {
    if (!indicatorVisible) return;
    measureIndicator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubState, indicatorVisible]);

  useEffect(() => {
    const wrap = submenuWrapRef.current;
    if (!wrap) return;

    const ro = new ResizeObserver(() => {
      if (indicatorVisible) measureIndicator();
    });
    ro.observe(wrap);

    const onResize = () => {
      if (indicatorVisible) measureIndicator();
    };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorVisible]);

  const pickMain = (id: MainItemId) => {
    setActiveMainState(id);

    if (id !== "transactions") {
      setTransactionsOpen(false);
      setMobileMenuOpen(false);
    } else {
      setTransactionsOpen(true);
    }
  };

  const toggleTransactions = () => {
    if (isCollapsed) {
      setDesktopCollapsed(false);
      setActiveMainState("transactions");
      setTransactionsOpen(true);
      return;
    }

    setActiveMainState("transactions");
    setTransactionsOpen((v) => !v);
  };

  const pickSub = (id: SubItemId) => {
    if (isCollapsed) setDesktopCollapsed(false);
    setActiveMainState("transactions");
    if (!transactionsOpen) setTransactionsOpen(true);
    setActiveSubState(id);
    setMobileMenuOpen(false);
  };

  const mainBtnBase = cx(
    "w-full h-[40px] rounded-xl",
    "flex items-center",
    isCollapsed ? "justify-center px-0" : "gap-3 px-3",
    "relative overflow-hidden transform-gpu will-change-transform",
    "text-[15px] font-medium",
    "text-black/90",
    "transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
  );

  const subBtnBase = cx(
    "w-full h-[35px] rounded-xl",
    "flex items-center",
    "relative overflow-hidden transform-gpu will-change-transform active:scale-[0.992] active:translate-y-[0.5px]",
    "px-3 text-[15px] font-semibold tracking-[-0.01em]",
    "text-black/90",
    "transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
  );

  const itemContentBase = cx(
    "relative z-[1] flex items-center min-w-0",
    isCollapsed ? "justify-center" : "gap-3"
  );

  const itemLabelBase = cx(
    "overflow-hidden whitespace-nowrap",
    "transition-[max-width,opacity,transform] duration-[280ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
    isCollapsed ? "max-w-0 opacity-0 -translate-x-1" : "max-w-[190px] opacity-100 translate-x-0"
  );

  const toggleSidebarCollapse = () => {
    if (isMobile) return;
    setDesktopCollapsed((v) => !v);
  };

  const handleCollapsedLogoExpand = () => {
    if (!showCollapsedTooltips) return;
    setDesktopCollapsed(false);
  };

  const clearPaymentsTooltipCloseTimer = () => {
    if (!paymentsTooltipCloseTimerRef.current) return;
    clearTimeout(paymentsTooltipCloseTimerRef.current);
    paymentsTooltipCloseTimerRef.current = null;
  };

  const openPaymentsTooltip = () => {
    if (!showCollapsedTooltips) return;
    clearPaymentsTooltipCloseTimer();
    setPaymentsTooltipOpen(true);
  };

  const schedulePaymentsTooltipClose = () => {
    if (!showCollapsedTooltips) return;
    clearPaymentsTooltipCloseTimer();
    paymentsTooltipCloseTimerRef.current = setTimeout(() => {
      setPaymentsTooltipOpen(false);
      paymentsTooltipCloseTimerRef.current = null;
    }, 180);
  };

  const handlePaymentsTooltipBlur = (e: React.FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    schedulePaymentsTooltipClose();
  };

  return (
    <>
      <Script src="https://cdn.lordicon.com/lordicon.js" strategy="afterInteractive" />

      {!mobileMenuOpen && (
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={cx(
            "sm:hidden",
            "fixed left-3 top-3 z-[60]",
            "h-[44px] w-[44px] rounded-full bg-white",
            "border border-black/10",
            "shadow-[0_10px_24px_rgba(0,0,0,0.14)]",
            "flex items-center justify-center",
            "transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98]"
          )}
          aria-label="Open menu"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-black/80"
            aria-hidden="true"
          >
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
      )}

      {mobileMenuOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cx(
          "fixed sm:static",
          "inset-y-0 left-0 sm:inset-auto sm:left-auto",
          "z-50 sm:z-auto",
          "w-[308px]",
          "max-w-[calc(100vw-24px)]",
          isCollapsed
            ? "sm:w-[92px] sm:min-w-[92px] sm:max-w-[92px]"
            : "sm:w-[308px] sm:min-w-[308px] sm:max-w-[308px]",
          "min-h-svh bg-[#f6f6f7] text-black",
          "flex flex-col overflow-visible",
          "shadow-[0_20px_50px_rgba(0,0,0,0.18)] sm:shadow-none",
          "transform-gpu transition-[transform,width,min-width,max-width] duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        )}
      >
        <div
          className={cx(
            "pt-2.5",
            "transition-[padding] duration-[300ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            isCollapsed ? "px-3" : "px-2"
          )}
        >
          <div
            className={cx(
              "flex items-center gap-2",
              showCollapsedTooltips ? "justify-center" : "justify-between"
            )}
          >
            <div
              className={cx(
                "h-[44px]",
                "flex items-center overflow-hidden",
                "transition-[width,padding] duration-[320ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                isCollapsed ? "w-[44px] px-0 justify-center" : "flex-1 px-3",
                showCollapsedTooltips && "cursor-pointer"
              )}
              aria-label="Wyzer"
              role={showCollapsedTooltips ? "button" : undefined}
              tabIndex={showCollapsedTooltips ? 0 : undefined}
              onClick={handleCollapsedLogoExpand}
              onKeyDown={(e) => {
                if (!showCollapsedTooltips) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDesktopCollapsed(false);
                }
              }}
            >
              <Image
                src={sidebarLogoSrc}
                alt="Wyzer"
                width={isCollapsed ? 28 : 156}
                height={isCollapsed ? 28 : 40}
                className={cx(
                  "object-contain shrink-0",
                  "transition-[width,height,transform] duration-[320ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  isCollapsed ? "h-7 w-7" : "h-10 w-auto max-w-[100px]"
                )}
                onError={() => setSidebarLogoFallback(true)}
                priority
              />
            </div>

            {!showCollapsedTooltips && (
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                className={cx(
                  "hidden sm:flex",
                  "h-[36px] w-[36px]",
                  "items-center justify-center",
                  "transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  "active:scale-[0.98]"
                )}
                aria-label={isCollapsed ? "Expandir sidebar" : "Minimizar sidebar"}
                title={isCollapsed ? "Expandir sidebar" : "Minimizar sidebar"}
              >
                <SidebarCollapseIcon />
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className={cx(
                "sm:hidden",
                "h-[44px] w-[44px] rounded-xl",
                "flex items-center justify-center",
                "transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98]"
              )}
              aria-label="Close menu"
            >
              <SidebarMobileCloseIcon />
            </button>
          </div>

          <div className="mt-2 border-t border-dashed border-black/15" />
        </div>

        <nav
          className={cx(
            "mt-3 flex-1 overscroll-contain",
            showCollapsedTooltips ? "overflow-visible" : "overflow-y-auto",
            isCollapsed ? "px-3" : "px-2"
          )}
        >
          <LayoutGroup id="sidebar-active-pills">
            <ul className="space-y-[2px]">
              <li className={cx("relative", showCollapsedTooltips && "group")}>
                <motion.button
                  type="button"
                  onClick={() => pickMain("overview")}
                  whileTap={tapFeedback}
                  transition={tapFeedbackTransition}
                  className={cx(
                    mainBtnBase,
                    overviewHoverClass,
                    activeMainState !== "overview" && "hover:bg-black/[0.04]"
                  )}
                  aria-label="Visao Geral"
                >
                  {activeMainState === "overview" && (
                    <motion.span
                      layoutId="sidebar-active-main-pill"
                      className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                      transition={activePillTransition}
                    />
                  )}
                  <span className={itemContentBase}>
                    <IOverview target={`.${overviewHoverClass}`} />
                    <span className={itemLabelBase}>Visao Geral</span>
                  </span>
                </motion.button>
                {showCollapsedTooltips && (
                  <CollapsedTooltip
                    label="Visao Geral"
                    interactive={false}
                  />
                )}
              </li>

              <li className={cx("relative", showCollapsedTooltips && "group")}>
                <motion.button
                  id={catalogHoverTargetId}
                  type="button"
                  onClick={() => pickMain("catalog")}
                  whileTap={tapFeedback}
                  transition={tapFeedbackTransition}
                  className={cx(
                    mainBtnBase,
                    activeMainState !== "catalog" && "hover:bg-black/[0.04]"
                  )}
                  aria-label="Atendimentos"
                >
                  {activeMainState === "catalog" && (
                    <motion.span
                      layoutId="sidebar-active-main-pill"
                      className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                      transition={activePillTransition}
                    />
                  )}
                  <span className={itemContentBase}>
                    <ICatalog target={`#${catalogHoverTargetId}`} />
                    <span className={itemLabelBase}>Atendimentos</span>
                  </span>
                </motion.button>
                {showCollapsedTooltips && (
                  <CollapsedTooltip
                    label="Atendimentos"
                    interactive={false}
                  />
                )}
              </li>

              <li className={cx("relative", showCollapsedTooltips && "group")}>
                <motion.button
                  id={categoriesHoverTargetId}
                  type="button"
                  onClick={() => pickMain("categories")}
                  whileTap={tapFeedback}
                  transition={tapFeedbackTransition}
                  className={cx(
                    mainBtnBase,
                    activeMainState !== "categories" && "hover:bg-black/[0.04]"
                  )}
                  aria-label="Categorias"
                >
                  {activeMainState === "categories" && (
                    <motion.span
                      layoutId="sidebar-active-main-pill"
                      className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                      transition={activePillTransition}
                    />
                  )}
                  <span className={itemContentBase}>
                    <ICategories target={`#${categoriesHoverTargetId}`} />
                    <span className={itemLabelBase}>Categorias</span>
                  </span>
                </motion.button>
                {showCollapsedTooltips && (
                  <CollapsedTooltip
                    label="Categorias"
                    interactive={false}
                  />
                )}
              </li>

              <li className={cx("relative", showCollapsedTooltips && "group")}>
                <motion.button
                  id={productsHoverTargetId}
                  type="button"
                  onClick={() => pickMain("customers")}
                  whileTap={tapFeedback}
                  transition={tapFeedbackTransition}
                  className={cx(
                    mainBtnBase,
                    activeMainState !== "customers" && "hover:bg-black/[0.04]"
                  )}
                  aria-label="Produtos"
                >
                  {activeMainState === "customers" && (
                    <motion.span
                      layoutId="sidebar-active-main-pill"
                      className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                      transition={activePillTransition}
                    />
                  )}
                  <span className={itemContentBase}>
                    <ICustomers target={`#${productsHoverTargetId}`} />
                    <span className={itemLabelBase}>Produtos</span>
                  </span>
                </motion.button>
                {showCollapsedTooltips && (
                  <CollapsedTooltip
                    label="Produtos"
                    interactive={false}
                  />
                )}
              </li>

              <li
                className="relative"
                onMouseEnter={openPaymentsTooltip}
                onMouseLeave={schedulePaymentsTooltipClose}
                onFocusCapture={openPaymentsTooltip}
                onBlurCapture={handlePaymentsTooltipBlur}
              >
                <motion.button
                  id={transactionsHoverTargetId}
                  type="button"
                  onClick={toggleTransactions}
                  whileTap={tapFeedback}
                  transition={tapFeedbackTransition}
                  className={cx(
                    "w-full h-[40px] rounded-xl",
                    "relative overflow-hidden transform-gpu will-change-transform",
                    "flex items-center",
                    isCollapsed ? "justify-center px-0" : "px-3",
                    "text-[15px] font-medium",
                    "text-black/90",
                    "transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                    !isOnTransactions && "hover:bg-black/[0.04]"
                  )}
                  aria-expanded={transactionsOpen}
                  aria-label="Pagamentos"
                >
                  {isOnTransactions && (
                    <motion.span
                      layoutId="sidebar-active-main-pill"
                      className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                      transition={activePillTransition}
                    />
                  )}
                  <span className={cx(itemContentBase, !isCollapsed && "flex-1")}>
                    <ITransactions target={`#${transactionsHoverTargetId}`} />
                    <span className={itemLabelBase}>Pagamentos</span>
                  </span>
                  {!isCollapsed && (
                    <span className="relative z-[1] ml-auto inline-flex h-[20px] w-[20px] items-center justify-center self-center">
                      <CaretDown open={transactionsOpen} />
                    </span>
                  )}
                </motion.button>
                {showCollapsedTooltips && (
                  <CollapsedTooltip
                    label="Pagamentos"
                    open={paymentsTooltipOpen}
                    interactive
                    onMouseEnter={openPaymentsTooltip}
                    onMouseLeave={schedulePaymentsTooltipClose}
                    actions={[
                      {
                        id: "orders",
                        label: "Métodos de Pagamento",
                        onSelect: () => pickSub("orders"),
                      },
                      {
                        id: "drafts",
                        label: "Historico",
                        onSelect: () => pickSub("drafts"),
                      },
                    ]}
                  />
                )}

                {!isCollapsed && (
                  <div
                    className={cx(
                      "overflow-hidden",
                      "transition-[max-height,opacity,transform] duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                      transactionsOpen
                        ? "max-h-[320px] opacity-100 translate-y-0"
                        : "max-h-0 opacity-0 -translate-y-[4px]"
                    )}
                  >
                    <div ref={submenuWrapRef} className="relative pl-[46px] pr-2 py-1">
                    <div
                      className={cx(
                        "absolute left-[24px] top-[8px] bottom-[8px]",
                        "border-l border-dashed border-black/20",
                        transactionsOpen ? "opacity-100" : "opacity-0"
                      )}
                    />

                    <span
                      aria-hidden="true"
                      className={cx(
                        "absolute",
                        "top-0",
                        "left-[23px] w-[3px] h-[26px] rounded-full bg-black",
                        "transition-[transform,opacity] duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                        indicatorVisible ? "opacity-100" : "opacity-0"
                      )}
                      style={{
                        transform: `translateY(${Math.round(indicatorY)}px)`,
                      }}
                    />

                      <ul className="space-y-[2px]">
                      <li className="relative">
                        <button
                          type="button"
                          ref={(el) => {
                            subBtnRefs.current.orders = el;
                          }}
                          onClick={() => pickSub("orders")}
                          className={cx(
                            subBtnBase,
                            !(isOnTransactions && activeSubState === "orders") &&
                              "hover:bg-black/[0.04]"
                          )}
                        >
                          {isOnTransactions && activeSubState === "orders" && (
                            <motion.span
                              layoutId="sidebar-active-sub-pill"
                              className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                              transition={activePillTransition}
                            />
                          )}
                          <span className="relative z-[1] font-medium">Métodos de Pagamento</span>
                        </button>
                      </li>

                      <li className="relative">
                        <button
                          type="button"
                          ref={(el) => {
                            subBtnRefs.current.drafts = el;
                          }}
                          onClick={() => pickSub("drafts")}
                          className={cx(
                            subBtnBase,
                            !(isOnTransactions && activeSubState === "drafts") &&
                              "hover:bg-black/[0.04]"
                          )}
                        >
                          {isOnTransactions && activeSubState === "drafts" && (
                            <motion.span
                              layoutId="sidebar-active-sub-pill"
                              className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                              transition={activePillTransition}
                            />
                          )}
                          <span className="relative z-[1] font-medium">Historico</span>
                        </button>
                      </li>
                      </ul>
                    </div>
                  </div>
                )}
              </li>
            </ul>
          </LayoutGroup>
        </nav>

        <div className={cx("shrink-0 px-2 pb-3 pt-2", isCollapsed ? "sm:px-3" : "sm:px-2")}>
          <ul className="mb-2 space-y-[2px]">
            <li className={cx("relative", showCollapsedTooltips && "group")}>
              <motion.button
                id={helpHoverTargetId}
                type="button"
                whileTap={tapFeedback}
                transition={tapFeedbackTransition}
                className={cx(mainBtnBase, "hover:bg-black/[0.04]")}
                aria-label="Ajuda"
              >
                <span className={itemContentBase}>
                  <IHelp target={`#${helpHoverTargetId}`} />
                  <span className={itemLabelBase}>Ajuda</span>
                </span>
              </motion.button>
              {showCollapsedTooltips && (
                <CollapsedTooltip
                  label="Ajuda"
                  interactive={false}
                />
              )}
            </li>

            <li className={cx("relative", showCollapsedTooltips && "group")}>
              <motion.button
                id={settingsHoverTargetId}
                type="button"
                whileTap={tapFeedback}
                transition={tapFeedbackTransition}
                className={cx(mainBtnBase, "hover:bg-black/[0.04]")}
                aria-label="Configurações"
              >
                <span className={itemContentBase}>
                  <ISettings target={`#${settingsHoverTargetId}`} />
                  <span className={itemLabelBase}>Configurações</span>
                </span>
              </motion.button>
              {showCollapsedTooltips && (
                <CollapsedTooltip
                  label="Configurações"
                  interactive={false}
                />
              )}
            </li>
          </ul>

          {!isCollapsed && (
            <div
              className={cx(
                "mb-2 rounded-2xl border border-black/10 bg-white/[0.98] p-2.5",
                "shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-black/85">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="text-[14px] font-semibold tracking-[-0.01em]">
                    Você possui pendências
                  </span>
                </div>
                <span className="text-[13px] font-semibold text-black/70">79%</span>
              </div>

              <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-black/[0.08]">
                <span className="block h-full w-[69%] rounded-full bg-lime-400" />
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-black/70">
                <span className="truncate">36 of 50 Invoices created</span>
                <span className="group/info relative inline-flex shrink-0 items-center">
                  <button
                    id={invoicesInfoTargetId}
                    type="button"
                    className={cx(
                      "inline-flex h-[20px] w-[20px] items-center justify-center rounded-full",
                      "transition-colors duration-200 ease-out hover:bg-black/[0.06]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                    )}
                    aria-label="Detalhes das pendências do plano"
                  >
                    <IInvoiceInfo target={`#${invoicesInfoTargetId}`} />
                  </button>

                  <div
                    role="tooltip"
                    className={cx(
                      "pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-[130] w-[230px] -translate-y-1/2",
                      "rounded-xl border border-black/10 bg-white/98 px-3 py-2 backdrop-blur-[2px]",
                      "shadow-[0_10px_24px_rgba(0,0,0,0.14)]",
                      "opacity-0 translate-x-1 scale-[0.98]",
                      "transition-[opacity,transform] duration-180 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                      "group-hover/info:opacity-100 group-hover/info:translate-x-0 group-hover/info:scale-100",
                      "group-focus-within/info:opacity-100 group-focus-within/info:translate-x-0 group-focus-within/info:scale-100"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -left-[5px] top-1/2 h-[10px] w-[10px] -translate-y-1/2 rotate-45 border-b border-l border-black/10 bg-white/98"
                    />
                    <p className="text-[12px] font-semibold tracking-[-0.01em] text-black/90">
                      Pendências do plano
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-black/70">
                      Você já criou 36 de 50 invoices. Restam 14 antes do limite;
                      ao atingir 100%, novos envios podem ficar indisponíveis.
                    </p>
                  </div>
                </span>
              </div>

              <motion.button
                type="button"
                whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                className={cx(
                  "group relative mt-2.5 w-full rounded-full bg-[#171717] px-5 py-3 text-left text-white",
                  "border-2 border-[#454545] pr-14",
                  "text-[13px] font-semibold",
                  "transition-all duration-300 ease-out",
                  "hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400",
                  "shadow-[0_16px_35px_rgba(0,0,0,0.16)] hover:shadow-[0_22px_45px_rgba(0,0,0,0.22)]",
                  "transform-gpu"
                )}
                style={{ willChange: "transform" }}
              >
                <span className="relative z-10">Realizar Pendências</span>
                <motion.span
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                  transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                  className={cx(
                    "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2.5",
                    "bg-transparent transition-all duration-300 ease-out",
                    "group-hover:translate-x-0.5 group-hover:bg-white/10"
                  )}
                >
                  <ArrowRight className="h-5 w-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                </motion.span>
              </motion.button>
            </div>
          )}

          <div className="mb-3 border-t border-dashed border-black/15" />

          {isCollapsed ? (
            <button
              type="button"
              onClick={() => setDesktopCollapsed(false)}
              className={cx(
                "mx-auto hidden sm:flex h-[42px] w-[42px] rounded-xl",
                "items-center justify-center",
                "transition-colors duration-200 ease-out hover:bg-white"
              )}
              aria-label={`Expandir perfil ${resolvedUserNickname}`}
              title={resolvedUserNickname}
            >
              <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-white text-[12px] font-semibold text-white">
                {profileInitial}
              </span>
            </button>
          ) : (
            <div ref={profileMenuWrapRef} className="relative">
              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.12 }
                        : { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }
                    }
                    className="absolute bottom-[calc(100%+10px)] left-0 right-0 z-[140]"
                  >
                    <div className="max-h-[65vh] overflow-y-auto rounded-2xl border border-black/10 bg-white/98 p-2 shadow-[0_18px_38px_rgba(0,0,0,0.18)] backdrop-blur-[2px]">
                      <div className="flex items-center gap-3 px-2 pb-2 pt-1">
                        <span className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#121330] text-[14px] font-semibold text-white">
                          {profileInitial}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-black/90">
                            {resolvedUserNickname}
                          </span>
                          <span className="block truncate text-[12px] font-medium text-black/55">
                            {resolvedUserEmail}
                          </span>
                        </span>
                      </div>

                      <div className="mx-2 mb-1 border-t border-black/10" />

                      <div className="space-y-1.5 px-1 py-1">
                        <button
                          type="button"
                          onClick={() => setProfileMenuOpen(false)}
                          className={cx(
                            "flex h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left",
                            "text-[14px] font-medium text-black/80",
                            "transition-colors duration-200 ease-out hover:bg-black/[0.06]"
                          )}
                        >
                          <User className="h-[18px] w-[18px] text-black/55" />
                          <span>Account Settings</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setProfileMenuOpen(false)}
                          className={cx(
                            "flex h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left",
                            "text-[14px] font-medium text-black/80",
                            "transition-colors duration-200 ease-out hover:bg-black/[0.06]"
                          )}
                        >
                          <Settings className="h-[18px] w-[18px] text-black/55" />
                          <span>Settings</span>
                        </button>
                      </div>

                      <div className="mx-2 mb-1 mt-1 border-t border-black/10" />

                      <form method="post" action="/api/wz_AuthLogin/logout" className="px-1 pb-1 pt-0.5">
                        <button
                          type="submit"
                          className={cx(
                            "flex h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left",
                            "text-[14px] font-medium text-black/80",
                            "transition-colors duration-200 ease-out hover:bg-black/[0.06]"
                          )}
                        >
                          <LogOut className="h-[18px] w-[18px] text-black/60" />
                          <span>Sign Out</span>
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className={cx(
                  "w-full rounded-2xl",
                  profileMenuOpen ? "bg-black/[0.10]" : "bg-black/[0.06]",
                  "px-2 py-2",
                  "flex items-center justify-between gap-3",
                  "transition-all duration-200 ease-out hover:bg-black/[0.10] active:scale-[0.99]"
                )}
                aria-label={`${resolvedUserNickname} - ${resolvedUserEmail}`}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
              >
                <span className="min-w-0 flex items-center gap-3 text-left">
                  <span className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-[#121330] text-[14px] font-semibold text-white">
                    {profileInitial}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-black/90">
                      {resolvedUserNickname}
                    </span>
                    <span className="block truncate text-[12px] font-medium text-black/55">
                      {resolvedUserEmail}
                    </span>
                  </span>
                </span>
                <ProfileChevron open={profileMenuOpen} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}