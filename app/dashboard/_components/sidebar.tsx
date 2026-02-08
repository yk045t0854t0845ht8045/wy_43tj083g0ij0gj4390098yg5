// app/(dashboard)/_components/sidebar.tsx
"use client";

import Link from "next/link";
import Script from "next/script";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
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
  | "transactions"
  | "catalog"
  | "customers"
  | "content"
  | "analytics"
  | "campaigns"
  | "discounts";

type SubItemId = "orders" | "drafts" | "shipping" | "abandoned";
type ChannelId = "online-store" | "retail-pos" | "shop";

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

/* ─────────────────────────────────────────────────────────────────────────────
   Icons (leve, fino, estilo igual do print)
   ───────────────────────────────────────────────────────────────────────────── */

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center text-black/70">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-[18px] h-[18px]"
      >
        {children}
      </svg>
    </span>
  );
}

type LordIconProps = React.HTMLAttributes<HTMLElement> & {
  src: string;
  trigger?: string;
  target?: string;
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

function ITransactions() {
  return (
    <Icon>
      <rect x="4.5" y="6.5" width="15" height="13" rx="2" />
      <path d="M7.5 10h9" />
      <path d="M7.5 14h6.5" />
    </Icon>
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

function IContent() {
  return (
    <Icon>
      <rect x="4.5" y="5.5" width="15" height="13" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 12.5h6" />
    </Icon>
  );
}

function IAnalytics() {
  return (
    <Icon>
      <path d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="8" />
    </Icon>
  );
}

function ICampaigns() {
  return (
    <Icon>
      <path d="M4.5 12h4l10-5v10l-10-5h-4Z" />
      <path d="M8.5 14.5v3" />
    </Icon>
  );
}

function IDiscounts() {
  return (
    <Icon>
      <path d="M20 12 12 20 4 12V4h8l8 8Z" />
      <path d="M7.5 7.5h.01" />
    </Icon>
  );
}

function IStore() {
  return (
    <Icon>
      <path d="M4.5 9 6.2 5.5h11.6L19.5 9" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M9 19.5V13h6v6.5" />
    </Icon>
  );
}

function IPOS() {
  return (
    <Icon>
      <rect x="5" y="6.5" width="14" height="12.5" rx="2" />
      <path d="M8 10h8" />
      <path d="M8 13.5h4.5" />
      <path d="M8 17h8" />
    </Icon>
  );
}

function IShop() {
  return (
    <Icon>
      <rect x="6" y="7" width="12" height="13" rx="2" />
      <path d="M9 7V5.5A3 3 0 0 1 12 3a3 3 0 0 1 3 2.5V7" />
    </Icon>
  );
}

function ProjectIcon() {
  return (
    <span className="inline-flex w-[22px] h-[22px] items-center justify-center rounded-md bg-black/90 text-white">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 7h10v10H7z" />
      </svg>
    </span>
  );
}

function ChevronsUpDown() {
  return (
    <span className="inline-flex items-center justify-center text-black/55">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m7 10 5-5 5 5" />
        <path d="m7 14 5 5 5-5" />
      </svg>
    </span>
  );
}

function CaretDown({ open }: { open: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center text-black/55 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
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

/* ───────────────────────────────────────────────────────────────────────────── */

type Props = {
  activeMain?: MainItemId;
  activeSub?: SubItemId | null;
  activeChannel?: ChannelId | null;
};

export default function Sidebar({
  activeMain = "overview",
  activeSub = null,
  activeChannel = null,
}: Props) {
  const [transactionsOpen, setTransactionsOpen] = useState(
    () => activeMain === "transactions" && activeChannel === null
  );
  const isMobile = useIsMobileSm();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // active “inteligente”
  const [activeMainState, setActiveMainState] = useState<MainItemId>(activeMain);
  const [activeSubState, setActiveSubState] = useState<SubItemId | null>(
    activeSub
  );
  const [activeChannelState, setActiveChannelState] = useState<ChannelId | null>(
    activeChannel
  );

  // sincroniza caso props mudem
  useEffect(() => setActiveMainState(activeMain), [activeMain]);
  useEffect(() => setActiveSubState(activeSub), [activeSub]);
  useEffect(() => setActiveChannelState(activeChannel), [activeChannel]);
  useEffect(() => {
    setTransactionsOpen(activeMain === "transactions" && activeChannel === null);
  }, [activeMain, activeChannel]);

  // mobile: sidebar vira drawer (minimizado por padrao)
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

  const channels = useMemo(
    () => [
      { id: "online-store" as const, label: "Online Store", icon: <IStore /> },
      { id: "retail-pos" as const, label: "Retail POS", icon: <IPOS /> },
      { id: "shop" as const, label: "Shop", icon: <IShop /> },
    ],
    []
  );
  const overviewHoverId = useId();
  const overviewHoverClass = useMemo(
    () =>
      `sidebar-overview-${overviewHoverId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [overviewHoverId]
  );
  const catalogHoverTargetId = "sidebar-atendimentos-btn";
  const productsHoverTargetId = "sidebar-produtos-btn";

  // indicador preto “rastando” somente no submenu
  const submenuWrapRef = useRef<HTMLDivElement | null>(null);
  const submenuUlRef = useRef<HTMLUListElement | null>(null);
  const subBtnRefs = useRef<Record<SubItemId, HTMLAnchorElement | null>>({
    orders: null,
    drafts: null,
    shipping: null,
    abandoned: null,
  });

  const indicatorHeightPx = 26;
  const [indicatorY, setIndicatorY] = useState<number>(8);

  const isMainSelected = activeChannelState === null;
  const isOnTransactions = isMainSelected && activeMainState === "transactions";
  const indicatorVisible =
    isOnTransactions && transactionsOpen && activeSubState !== null;
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
    if (!wrap) return;

    if (!activeSubState) return;
    const btn = subBtnRefs.current[activeSubState];
    if (!btn) return;

    // offsetTop não é confiável aqui porque cada <li> é `relative` (vira offsetParent).
    // Usando getBoundingClientRect garante a posição correta (e o indicador “desce”).
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

  // helpers: clicar em main fecha o submenu e aplica active
  const pickMain = (id: MainItemId) => {
    setActiveMainState(id);
    setActiveChannelState(null);

    if (id !== "transactions") {
      // fecha o accordion ao sair
      setTransactionsOpen(false);
      setMobileMenuOpen(false);
    } else {
      // se entrou em transactions, abre
      setTransactionsOpen(true);
    }
  };

  const toggleTransactions = () => {
    setActiveMainState("transactions");
    setActiveChannelState(null);
    setTransactionsOpen((v) => !v);
  };

  const pickSub = (id: SubItemId) => {
    setActiveMainState("transactions");
    setActiveChannelState(null);
    if (!transactionsOpen) setTransactionsOpen(true);
    setActiveSubState(id);
    setMobileMenuOpen(false);
  };

  const pickChannel = (id: ChannelId) => {
    setActiveChannelState(id);
    setTransactionsOpen(false);
    setMobileMenuOpen(false);
  };

  const mainBtnBase = cx(
    "w-full h-[40px] rounded-xl",
    "flex items-center gap-3 px-3",
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

  return (
    <>
      <Script src="https://cdn.lordicon.com/lordicon.js" strategy="afterInteractive" />

      {/* botao flutuante (mobile) */}
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

      {/* backdrop (mobile) */}
      {mobileMenuOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cx(
          // desktop: sidebar normal. mobile: drawer minimizado
          "fixed sm:static",
          "inset-y-0 left-0 sm:inset-auto sm:left-auto",
          "z-50 sm:z-auto",
          "w-[308px] sm:w-[308px] sm:min-w-[308px]",
          "max-w-[calc(100vw-24px)] sm:max-w-[308px]",
          "min-h-svh bg-[#f6f6f7] text-black",
          "flex flex-col",
          "shadow-[0_20px_50px_rgba(0,0,0,0.18)] sm:shadow-none",
          "transform-gpu transition-transform duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        )}
      >
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cx(
                "flex-1 h-[44px] rounded-xl bg-white",
                "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
                "flex items-center justify-between px-3",
                "transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.995]"
              )}
            >
              <span className="flex items-center gap-3">
                <ProjectIcon />
                <span className="font-semibold text-[16px] tracking-[-0.01em]">
                  My Project
                </span>
              </span>
              <ChevronsUpDown />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className={cx(
                "sm:hidden",
                "h-[44px] w-[44px] rounded-xl bg-white",
                "border border-black/10",
                "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
                "flex items-center justify-center",
                "transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98]"
              )}
              aria-label="Close menu"
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
                className="text-black/75"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 border-t border-dashed border-black/15" />
        </div>

        <nav className="mt-2 px-2 flex-1 overflow-y-auto overscroll-contain">
        <LayoutGroup id="sidebar-active-pills">
        <ul className="space-y-[2px]">
          {/* Visao Geral */}
          <li>
            <motion.button
              type="button"
              onClick={() => pickMain("overview")}
              whileTap={tapFeedback}
              transition={tapFeedbackTransition}
              className={cx(
                mainBtnBase,
                overviewHoverClass,
                !(isMainSelected && activeMainState === "overview") &&
                  "hover:bg-black/[0.04]"
              )}
            >
              {isMainSelected && activeMainState === "overview" && (
                <motion.span
                  layoutId="sidebar-active-main-pill"
                  className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                  transition={activePillTransition}
                />
              )}
              <span className="relative z-[1] flex items-center gap-3">
                <IOverview target={`.${overviewHoverClass}`} />
                <span>Visão Geral</span>
              </span>
            </motion.button>
          </li>


          {/* Catalog */}
          <li>
            <motion.button
              id={catalogHoverTargetId}
              type="button"
              onClick={() => pickMain("catalog")}
              whileTap={tapFeedback}
              transition={tapFeedbackTransition}
              className={cx(
                mainBtnBase,
                !(isMainSelected && activeMainState === "catalog") &&
                  "hover:bg-black/[0.04]"
              )}
            >
              {isMainSelected && activeMainState === "catalog" && (
                <motion.span
                  layoutId="sidebar-active-main-pill"
                  className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                  transition={activePillTransition}
                />
              )}
              <span className="relative z-[1] flex items-center gap-3">
                <ICatalog target={`#${catalogHoverTargetId}`} />
                <span>Atendimentos</span>
              </span>
            </motion.button>
          </li>

          {/* Customers */}
          <li>
            <motion.button
              id={productsHoverTargetId}
              type="button"
              onClick={() => pickMain("customers")}
              whileTap={tapFeedback}
              transition={tapFeedbackTransition}
              className={cx(
                mainBtnBase,
                !(isMainSelected && activeMainState === "customers") &&
                  "hover:bg-black/[0.04]"
              )}
            >
              {isMainSelected && activeMainState === "customers" && (
                <motion.span
                  layoutId="sidebar-active-main-pill"
                  className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                  transition={activePillTransition}
                />
              )}
              <span className="relative z-[1] flex items-center gap-3">
                <ICustomers target={`#${productsHoverTargetId}`} />
                <span>Produtos</span>
              </span>
            </motion.button>
          </li>

          <li>
            <motion.button
              type="button"
              onClick={toggleTransactions}
              whileTap={tapFeedback}
              transition={tapFeedbackTransition}
              className={cx(
                "w-full h-[40px] rounded-xl",
                "relative overflow-hidden transform-gpu will-change-transform",
                "flex items-center justify-between px-3",
                "text-[15px] font-medium",
                "text-black/90",
                "transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                !isOnTransactions && "hover:bg-black/[0.04]"
              )}
              aria-expanded={transactionsOpen}
            >
              {isOnTransactions && (
                <motion.span
                  layoutId="sidebar-active-main-pill"
                  className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                  transition={activePillTransition}
                />
              )}
              <span className="relative z-[1] flex items-center gap-3">
                <ITransactions />
                <span>Pagamentos</span>
              </span>
              <span className="relative z-[1]">
                <CaretDown open={transactionsOpen} />
              </span>
            </motion.button>

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

                <ul ref={submenuUlRef} className="space-y-[2px]">
                  <li className="relative">
                    <Link
                      href=""
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
                      <span className="relative z-[1]">Orders</span>
                    </Link>
                  </li>

                  <li className="relative">
                    <Link
                      href=""
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
                      <span className="relative z-[1]">Drafts</span>
                    </Link>
                  </li>

                  <li className="relative">
                    <Link
                      href=""
                      ref={(el) => {
                        subBtnRefs.current.shipping = el;
                      }}
                      onClick={() => pickSub("shipping")}
                      className={cx(
                        subBtnBase,
                        !(isOnTransactions && activeSubState === "shipping") &&
                          "hover:bg-black/[0.04]"
                      )}
                    >
                      {isOnTransactions && activeSubState === "shipping" && (
                        <motion.span
                          layoutId="sidebar-active-sub-pill"
                          className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                          transition={activePillTransition}
                        />
                      )}
                      <span className="relative z-[1]">Shipping labels</span>
                    </Link>
                  </li>

                  <li className="relative">
                    <Link
                      href=""
                      ref={(el) => {
                        subBtnRefs.current.abandoned = el;
                      }}
                      onClick={() => pickSub("abandoned")}
                      className={cx(
                        subBtnBase,
                        !(isOnTransactions && activeSubState === "abandoned") &&
                          "hover:bg-black/[0.04]"
                      )}
                    >
                      {isOnTransactions && activeSubState === "abandoned" && (
                        <motion.span
                          layoutId="sidebar-active-sub-pill"
                          className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                          transition={activePillTransition}
                        />
                      )}
                      <span className="relative z-[1]">Abandoned checkouts</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </li>
        </ul>

      
        </LayoutGroup>
      </nav>
      </aside>
    </>
  );
}
