"use client";

import Image from "next/image";
import Script from "next/script";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { ConfigSectionId } from "./config/ConfigMain";

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

type UserAvatarProps = {
  photoLink?: string | null;
  initial: string;
  sizeClass: string;
  roundedClass: string;
  textClass: string;
  backgroundClass: string;
};

function UserAvatar({
  photoLink,
  initial,
  sizeClass,
  roundedClass,
  textClass,
  backgroundClass,
}: UserAvatarProps) {
  const cleanPhotoLink = String(photoLink || "").trim();

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        sizeClass,
        roundedClass,
        cleanPhotoLink ? "bg-black/[0.08]" : backgroundClass,
        textClass,
        "font-semibold text-white"
      )}
    >
      {cleanPhotoLink ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cleanPhotoLink}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          referrerPolicy="no-referrer"
        />
      ) : (
        initial
      )}
    </span>
  );
}

const COMPACT_SIDEBAR_MEDIA_QUERY = "(max-width: 900.98px)";

function useIsCompactSidebarViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY).matches;
  });

  useLayoutEffect(() => {
    const mq = window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY);
    const apply = () => {
      const byQuery = mq.matches;
      const byWidth =
        typeof window !== "undefined" && Number.isFinite(window.innerWidth)
          ? window.innerWidth <= 900.98
          : false;
      setIsCompactViewport(byQuery || byWidth);
    };
    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
    } else {
      mq.addListener(apply);
    }
    window.addEventListener("resize", apply);

    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", apply);
      } else {
        mq.removeListener(apply);
      }
      window.removeEventListener("resize", apply);
    };
  }, []);

  return isCompactViewport;
}

type LordIconProps = React.HTMLAttributes<HTMLElement> & {
  src: string;
  trigger?: string;
  target?: string;
  state?: string;
  delay?: string | number;
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

function IMyAccount({ target }: { target?: string }) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: "https://cdn.lordicon.com/spzqjmbt.json",
        trigger: "hover",
        target,
        style: { width: "18px", height: "18px" },
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
      <X className="h-[20px] w-[20px] text-black/80" strokeWidth={2} />
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
  userPhotoLink?: string | null;
  onOpenConfig?: (section?: ConfigSectionId) => void;
  locked?: boolean;
  lockMessage?: string;
  lockVariant?: "overlay" | "dim";
};

const SIDEBAR_COLLAPSE_STORAGE_KEY = "dashboard-sidebar-collapsed-v1";

function buildHelpDocumentationUrlClient() {
  if (typeof window === "undefined") return "/";
  const host = String(window.location.hostname || "").toLowerCase();
  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://login.localhost:3000/ajuda";
  }
  return "https://help.wyzer.com.br";
}

function buildHelpSupportUrlClient() {
  if (typeof window === "undefined") return "/";
  const host = String(window.location.hostname || "").toLowerCase();
  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://login.localhost:3000/ajuda";
  }
  return "https://login.wyzer.com.br/ajuda";
}

export default function Sidebar({
  activeMain = "overview",
  activeSub = null,
  userNickname = "Usuario",
  userEmail = "conta@wyzer.com.br",
  userPhotoLink = null,
  onOpenConfig,
  locked = false,
  lockMessage = "Conclua o onboarding para liberar a navegacao",
  lockVariant = "overlay",
}: Props) {
  const [transactionsOpen, setTransactionsOpen] = useState(
    () => activeMain === "transactions"
  );
  const isCompactViewport = useIsCompactSidebarViewport();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [collapseLoaded, setCollapseLoaded] = useState(false);
  const [sidebarLogoFallback, setSidebarLogoFallback] = useState(false);
  const [paymentsTooltipOpen, setPaymentsTooltipOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const profileMenuWrapRef = useRef<HTMLDivElement | null>(null);
  const paymentsTooltipCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [activeMainState, setActiveMainState] = useState<MainItemId>(activeMain);
  const [activeSubState, setActiveSubState] = useState<SubItemId | null>(activeSub);
  const interactionsLocked = Boolean(locked);
  const usesOverlayLock = interactionsLocked && lockVariant === "overlay";
  const usesDimLock = interactionsLocked && lockVariant === "dim";
  const isCollapsed = !isCompactViewport && desktopCollapsed;
  const showCollapsedTooltips = isCollapsed && !isCompactViewport;
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
  const resolvedUserPhotoLink = useMemo(() => {
    const value = String(userPhotoLink || "").trim();
    return value || null;
  }, [userPhotoLink]);

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
    if (!interactionsLocked) return;
    setProfileMenuOpen(false);
    setHelpModalOpen(false);
    setPaymentsTooltipOpen(false);
    setMobileMenuOpen(false);
  }, [interactionsLocked]);

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
    if (!isCompactViewport) setMobileMenuOpen(false);
  }, [isCompactViewport]);

  useEffect(() => {
    if (!isCompactViewport || !mobileMenuOpen) return;

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
  }, [isCompactViewport, mobileMenuOpen]);

  useEffect(() => {
    if (!helpModalOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [helpModalOpen]);

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
  const profileMyAccountHoverTargetId = `profile-minha-conta-${cleanIdBase}`;
  const profileSettingsHoverTargetId = `profile-configuracoes-${cleanIdBase}`;

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
    if (interactionsLocked) return;
    setActiveMainState(id);

    if (id !== "transactions") {
      setTransactionsOpen(false);
      setMobileMenuOpen(false);
    } else {
      setTransactionsOpen(true);
    }
  };

  const toggleTransactions = () => {
    if (interactionsLocked) return;
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
    if (interactionsLocked) return;
    if (isCollapsed) setDesktopCollapsed(false);
    setActiveMainState("transactions");
    if (!transactionsOpen) setTransactionsOpen(true);
    setActiveSubState(id);
    setMobileMenuOpen(false);
  };

  const openConfigModal = (section: ConfigSectionId = "my-account") => {
    if (interactionsLocked) return;
    onOpenConfig?.(section);
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  };

  const openHelpModal = () => {
    if (interactionsLocked) return;
    setProfileMenuOpen(false);
    if (isCompactViewport) {
      setMobileMenuOpen(false);
    }
    setHelpModalOpen(true);
  };

  const closeHelpModal = () => {
    if (interactionsLocked) return;
    setHelpModalOpen(false);
  };

  const redirectFromHelpModal = (target: "documentation" | "support") => {
    if (interactionsLocked) return;
    const url =
      target === "documentation"
        ? buildHelpDocumentationUrlClient()
        : buildHelpSupportUrlClient();
    window.location.assign(url);
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
    if (interactionsLocked) return;
    if (isCompactViewport) return;
    setDesktopCollapsed((v) => !v);
  };

  const handleCollapsedLogoExpand = () => {
    if (interactionsLocked) return;
    if (!showCollapsedTooltips) return;
    setDesktopCollapsed(false);
  };

  const clearPaymentsTooltipCloseTimer = () => {
    if (!paymentsTooltipCloseTimerRef.current) return;
    clearTimeout(paymentsTooltipCloseTimerRef.current);
    paymentsTooltipCloseTimerRef.current = null;
  };

  const openPaymentsTooltip = () => {
    if (interactionsLocked) return;
    if (!showCollapsedTooltips) return;
    clearPaymentsTooltipCloseTimer();
    setPaymentsTooltipOpen(true);
  };

  const schedulePaymentsTooltipClose = () => {
    if (interactionsLocked) return;
    if (!showCollapsedTooltips) return;
    clearPaymentsTooltipCloseTimer();
    paymentsTooltipCloseTimerRef.current = setTimeout(() => {
      setPaymentsTooltipOpen(false);
      paymentsTooltipCloseTimerRef.current = null;
    }, 180);
  };

  const handlePaymentsTooltipBlur = (e: React.FocusEvent<HTMLElement>) => {
    if (interactionsLocked) return;
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    schedulePaymentsTooltipClose();
  };

  return (
    <>
      <style>{`
        @keyframes sidebarLockPulse {
          0%, 100% { opacity: 0.78; }
          50% { opacity: 1; }
        }

        @keyframes sidebarLockSheen {
          0% { transform: translateX(-62%); opacity: 0; }
          18% { opacity: 0.06; }
          50% { opacity: 0.16; }
          82% { opacity: 0.06; }
          100% { transform: translateX(62%); opacity: 0; }
        }

        .sidebar-lock-shell {
          background:
            radial-gradient(circle at 16% 12%, rgba(255,255,255,0.72), transparent 34%),
            linear-gradient(180deg, rgba(245,245,246,0.995) 0%, rgba(243,243,244,0.998) 100%);
        }

        .sidebar-lock-block {
          position: relative;
          overflow: hidden;
          background: rgba(16, 20, 26, 0.085);
          animation: sidebarLockPulse 3s ease-in-out infinite;
        }

        .sidebar-lock-block::after {
          content: "";
          position: absolute;
          inset: -36%;
          border-radius: inherit;
          background: linear-gradient(
            120deg,
            rgba(255,255,255,0) 28%,
            rgba(255,255,255,0.14) 45%,
            rgba(255,255,255,0.24) 50%,
            rgba(255,255,255,0.14) 55%,
            rgba(255,255,255,0) 72%
          );
          animation: sidebarLockSheen 5s ease-in-out infinite;
        }
      `}</style>
      <Script src="https://cdn.lordicon.com/lordicon.js" strategy="afterInteractive" />

      <div
        className={cx(
          "relative z-[90] w-full shrink-0 min-[901px]:hidden",
          usesDimLock && "pointer-events-none select-none opacity-[0.52] saturate-[0.72]"
        )}
      >
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,#1a1b1f_0%,#0f1013_58%,#050608_100%)] text-white shadow-[0_18px_44px_rgba(0,0,0,0.26)]">
            <div
              className="mx-auto flex items-center justify-between gap-3 px-3 pb-2.5 sm:px-4"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
            >
              <button
                type="button"
                onClick={() => setMobileMenuOpen((current) => !current)}
                className={cx(
                  "inline-flex h-[42px] w-[42px] items-center justify-center text-white/90",
                  "transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  "active:scale-[0.98]",
                )}
                aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="dashboard-mobile-sidebar"
              >
                <span className="relative h-[18px] w-[18px]" aria-hidden="true">
                  <span
                    className={cx(
                      "absolute left-0 h-[2px] w-full rounded-full bg-white transition-[transform,top,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      mobileMenuOpen ? "top-[8px] rotate-45" : "top-[2px]",
                    )}
                  />
                  <span
                    className={cx(
                      "absolute left-0 top-[8px] h-[2px] w-full rounded-full bg-white transition-opacity duration-200 ease-out",
                      mobileMenuOpen ? "opacity-0" : "opacity-100",
                    )}
                  />
                  <span
                    className={cx(
                      "absolute left-0 h-[2px] w-full rounded-full bg-white transition-[transform,top,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      mobileMenuOpen ? "top-[8px] -rotate-45" : "top-[14px]",
                    )}
                  />
                </span>
              </button>

              <div className="flex min-w-0 flex-1 items-center justify-center">
                <span className="inline-flex items-center">
                  <Image
                    src={expandedSidebarLogoSrc}
                    alt="Wyzer"
                    width={92}
                    height={24}
                    className="h-5 w-auto brightness-0 invert"
                    priority
                  />
                </span>
              </div>

              <span className="inline-flex h-[42px] w-[42px] items-center justify-center">
                <UserAvatar
                  photoLink={resolvedUserPhotoLink}
                  initial={profileInitial}
                  sizeClass="h-[30px] w-[30px]"
                  roundedClass="rounded-xl"
                  textClass="text-[11px]"
                  backgroundClass="bg-white/16"
                />
              </span>
            </div>
          </div>
      </div>

      {isCompactViewport && mobileMenuOpen && typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className={cx(
                "fixed inset-0 z-[940] bg-[#050608]/36 backdrop-blur-[10px] transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              )}
              aria-hidden="true"
              tabIndex={0}
            />,
            document.body,
          )
        : null}

      {(() => {
        const sidebarPanelLayer = (
          <AnimatePresence initial={false}>
        {(!isCompactViewport || mobileMenuOpen) && (
          <motion.aside
            id={isCompactViewport ? "dashboard-mobile-sidebar" : undefined}
            role={isCompactViewport ? "dialog" : undefined}
            aria-modal={isCompactViewport ? true : undefined}
            aria-label={isCompactViewport ? "Menu principal" : undefined}
            initial={isCompactViewport ? { y: "100%", opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            exit={isCompactViewport ? { y: "100%", opacity: 0 } : undefined}
            transition={
              isCompactViewport
                ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0.01 }
            }
            className={cx(
              "relative flex flex-col overflow-visible text-black",
              usesDimLock && "pointer-events-none select-none opacity-[0.52] saturate-[0.74]",
              isCompactViewport
                ? cx(
                    "fixed inset-x-0 bottom-0 z-[950] max-h-[min(78dvh,720px)] w-full pointer-events-auto",
                    "rounded-t-[28px] border-t border-white/14 bg-[#f6f6f7]/98 backdrop-blur-[18px]",
                    "shadow-[0_-24px_60px_rgba(0,0,0,0.28)]",
                    "will-change-transform"
                  )
                : cx(
                    "static z-0 shrink-0 self-stretch",
                    isCollapsed
                      ? "w-[92px] min-w-[92px] max-w-[92px]"
                      : "w-[308px] min-w-[308px] max-w-[308px]",
                    "max-[900.98px]:hidden",
                    "min-h-screen bg-[#f6f6f7]",
                    "shadow-none",
                    "transform-gpu transition-[width,min-width,max-width] duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  ),
            )}
          >
        <div
          className={cx(
            isCompactViewport ? "px-4 pb-0 pt-3" : "pt-2.5",
            "transition-[padding] duration-[300ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            !isCompactViewport && (isCollapsed ? "px-3" : "px-2"),
          )}
        >
          {isCompactViewport && (
            <div className="mb-3 flex justify-center">
              <span className="h-1.5 w-12 rounded-full bg-black/14" aria-hidden="true" />
            </div>
          )}
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
                isCompactViewport
                  ? "flex-1 justify-start px-2"
                  : isCollapsed
                    ? "w-[44px] px-0 justify-center"
                    : "flex-1 px-3",
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
                  isCompactViewport
                    ? "h-9 w-auto max-w-[132px]"
                    : isCollapsed
                      ? "h-7 w-7"
                      : "h-10 w-auto max-w-[100px]"
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
                  isCompactViewport ? "hidden" : "flex",
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
                isCompactViewport ? "flex" : "hidden",
                "h-[44px] w-[44px] rounded-xl",
                "items-center justify-center",
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
            isCompactViewport ? "px-4 pb-2" : isCollapsed ? "px-3" : "px-2"
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
                        label: "Histórico",
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
                          <span className="relative z-[1] font-medium">Histórico</span>
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

        <div
          className={cx(
            "shrink-0 px-2 pb-3 pt-2",
            isCompactViewport ? "px-4 pb-[max(16px,env(safe-area-inset-bottom))]" : isCollapsed ? "px-3" : "px-2",
          )}
        >
          <ul className="mb-2 space-y-[2px]">
            <li className={cx("relative", showCollapsedTooltips && "group")}>
              <motion.button
                id={helpHoverTargetId}
                type="button"
                onClick={openHelpModal}
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
                onClick={() => openConfigModal("my-account")}
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


          <div className="mb-3 border-t border-dashed border-black/15" />

          {isCollapsed ? (
            <button
              type="button"
              onClick={() => setDesktopCollapsed(false)}
              className={cx(
                isCompactViewport ? "hidden" : "mx-auto flex",
                "h-[42px] w-[42px] rounded-xl",
                "items-center justify-center",
                "transition-colors duration-200 ease-out hover:bg-white"
              )}
              aria-label={`Expandir perfil ${resolvedUserNickname}`}
              title={resolvedUserNickname}
            >
              <UserAvatar
                photoLink={resolvedUserPhotoLink}
                initial={profileInitial}
                sizeClass="h-[30px] w-[30px]"
                roundedClass="rounded-lg"
                textClass="text-[12px]"
                backgroundClass="bg-[#121330]"
              />
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
                        <UserAvatar
                          photoLink={resolvedUserPhotoLink}
                          initial={profileInitial}
                          sizeClass="h-[42px] w-[42px]"
                          roundedClass="rounded-xl"
                          textClass="text-[14px]"
                          backgroundClass="bg-[#171717]"
                        />
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
                        <motion.button
                          id={profileMyAccountHoverTargetId}
                          type="button"
                          onClick={() => openConfigModal("my-account")}
                          whileTap={tapFeedback}
                          transition={tapFeedbackTransition}
                          className={cx(
                            "flex h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left",
                            "text-[14px] font-medium text-black/80",
                            "transition-colors duration-200 ease-out hover:bg-black/[0.06]"
                          )}
                        >
                          <IMyAccount target={`#${profileMyAccountHoverTargetId}`} />
                          <span>Minha conta</span>
                        </motion.button>

                        <motion.button
                          id={profileSettingsHoverTargetId}
                          type="button"
                          onClick={() => openConfigModal("my-account")}
                          whileTap={tapFeedback}
                          transition={tapFeedbackTransition}
                          className={cx(
                            "flex h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left",
                            "text-[14px] font-medium text-black/80",
                            "transition-colors duration-200 ease-out hover:bg-black/[0.06]"
                          )}
                        >
                          <ISettings target={`#${profileSettingsHoverTargetId}`} />
                          <span>Configurações</span>
                        </motion.button>
                      </div>

                      <div className="mx-2 mb-1 mt-1 border-t border-black/10" />

                      <form method="post" action="/api/wz_AuthLogin/logout" className="px-1 pb-1 pt-0.5">
                        <motion.button
                          type="submit"
                          whileTap={tapFeedback}
                          transition={tapFeedbackTransition}
                          className={cx(
                            "flex h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left",
                            "text-[14px] font-medium text-black/80",
                            "transition-colors duration-200 ease-out hover:bg-black/[0.06]"
                          )}
                        >
                          <span className="inline-flex h-[18px] w-[18px] items-center justify-center overflow-hidden">
                            <Image
                              src="/f9dc89e1-e5a9-4eae-b48e-955160b064fe.svg"
                              alt=""
                              width={18}
                              height={18}
                              className="h-[18px] w-[18px]"
                              aria-hidden="true"
                            />
                          </span>
                          <span>Logout</span>
                        </motion.button>
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
                  <UserAvatar
                    photoLink={resolvedUserPhotoLink}
                    initial={profileInitial}
                    sizeClass="h-[42px] w-[42px]"
                    roundedClass="rounded-xl"
                    textClass="text-[14px]"
                    backgroundClass="bg-[#171717]"
                  />
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

        {usesOverlayLock && (
          <div
            className="sidebar-lock-shell pointer-events-auto absolute inset-0 z-[180] flex flex-col backdrop-blur-[6px]"
            title={lockMessage}
          >
            <div
              className={cx(
                "pt-2.5",
                "transition-[padding] duration-[300ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                isCollapsed ? "px-3" : "px-2"
              )}
            >
              <div className="sidebar-lock-block h-[44px] rounded-xl" />
              <div className="mt-2 border-t border-dashed border-black/15" />
            </div>

            <div
              className={cx(
                "mt-3 flex-1 overscroll-contain",
                isCollapsed ? "px-3" : "px-2"
              )}
            >
              <div className="space-y-2.5">
                {Array.from({ length: isCollapsed ? 7 : 9 }).map((_, index) => (
                  <div
                    key={`sidebar-lock-skeleton-${index}`}
                    className={cx(
                      "sidebar-lock-block h-[40px] rounded-xl",
                      isCollapsed ? "mx-auto w-[42px]" : index % 3 === 2 ? "w-[84%]" : "w-full"
                    )}
                  />
                ))}
              </div>
            </div>

            <div
              className={cx(
                "shrink-0 pb-3 pt-2",
                isCollapsed ? "px-3" : "px-2"
              )}
            >
              <div className={cx("sidebar-lock-block h-[44px] rounded-2xl", isCollapsed && "mx-auto w-[42px]")} aria-hidden="true" />
            </div>
          </div>
        )}
          </motion.aside>
        )}
          </AnimatePresence>
        );

        if (isCompactViewport && typeof document !== "undefined") {
          return createPortal(sidebarPanelLayer, document.body);
        }

        return sidebarPanelLayer;
      })()}

      <AnimatePresence>
        {helpModalOpen && (
          <motion.div
            className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
              onClick={closeHelpModal}
              aria-label="Fechar modal de ajuda"
            />

            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Ajuda"
              className="relative z-[1] w-[min(96vw,520px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.35)] sm:p-6"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.1 }
                  : { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }
              }
            >
              <button
                type="button"
                onClick={closeHelpModal}
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="pr-10 text-[21px] font-semibold text-black/82">Ajuda</h3>
              <p className="mt-2 text-[14px] text-black/58">Selecione uma opção para continuar.</p>

              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => redirectFromHelpModal("documentation")}
                  className="w-full rounded-xl border border-black/12 bg-white/92 px-4 py-3 text-[15px] font-semibold text-black/82 transition-colors hover:bg-white"
                >
                  Documentação
                </button>
                <button
                  type="button"
                  onClick={() => redirectFromHelpModal("support")}
                  className="w-full rounded-xl border border-black/12 bg-white/92 px-4 py-3 text-[15px] font-semibold text-black/82 transition-colors hover:bg-white"
                >
                  Preciso de Ajuda
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
