"use client";

import Image from "next/image";
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

function SidebarCollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center text-black/70",
        "transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        collapsed && "rotate-180"
      )}
      aria-hidden="true"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m10 6-5 6 5 6" />
        <path d="M19 4v16" />
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

type Props = {
  activeMain?: MainItemId;
  activeSub?: SubItemId | null;
};

const SIDEBAR_COLLAPSE_STORAGE_KEY = "dashboard-sidebar-collapsed-v1";

export default function Sidebar({
  activeMain = "overview",
  activeSub = null,
}: Props) {
  const [transactionsOpen, setTransactionsOpen] = useState(
    () => activeMain === "transactions"
  );
  const isMobile = useIsMobileSm();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [collapseLoaded, setCollapseLoaded] = useState(false);

  const [activeMainState, setActiveMainState] = useState<MainItemId>(activeMain);
  const [activeSubState, setActiveSubState] = useState<SubItemId | null>(activeSub);
  const isCollapsed = !isMobile && desktopCollapsed;

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
          "flex flex-col",
          "shadow-[0_20px_50px_rgba(0,0,0,0.18)] sm:shadow-none",
          "transform-gpu transition-[transform,width,min-width,max-width] duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        )}
      >
        <div
          className={cx(
            "pt-4",
            "transition-[padding] duration-[300ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            isCollapsed ? "px-3" : "px-4"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div
              className={cx(
                "h-[44px] rounded-xl bg-white",
                "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
                "flex items-center overflow-hidden",
                "transition-[width,padding] duration-[320ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                isCollapsed ? "w-[44px] px-0 justify-center" : "flex-1 px-3"
              )}
              aria-label="Wyzer"
            >
              <Image
                src="/lg/topj4390tjg83gh43g.svg"
                alt="Wyzer"
                width={24}
                height={24}
                className="h-6 w-6 object-contain shrink-0"
                priority
              />
              <span
                className={cx(
                  "ml-2 font-semibold text-[16px] tracking-[-0.01em]",
                  "overflow-hidden whitespace-nowrap",
                  "transition-[max-width,opacity,transform] duration-[280ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  isCollapsed
                    ? "max-w-0 opacity-0 -translate-x-1"
                    : "max-w-[120px] opacity-100 translate-x-0"
                )}
              >
              </span>
            </div>

            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className={cx(
                "hidden sm:flex",
                "h-[44px] w-[44px] rounded-xl bg-white",
                "border border-black/10",
                "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
                "items-center justify-center",
                "transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                "active:scale-[0.98] hover:bg-black/[0.03]"
              )}
              aria-label={isCollapsed ? "Expandir sidebar" : "Minimizar sidebar"}
              title={isCollapsed ? "Expandir sidebar" : "Minimizar sidebar"}
            >
              <SidebarCollapseIcon collapsed={isCollapsed} />
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

        <nav
          className={cx(
            "mt-2 flex-1 overflow-y-auto overscroll-contain",
            isCollapsed ? "px-3" : "px-2"
          )}
        >
          <LayoutGroup id="sidebar-active-pills">
            <ul className="space-y-[2px]">
              <li>
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
                  title={isCollapsed ? "Visao Geral" : undefined}
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
              </li>

              <li>
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
                  title={isCollapsed ? "Atendimentos" : undefined}
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
              </li>

              <li>
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
                  title={isCollapsed ? "Categorias" : undefined}
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
              </li>

              <li>
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
                  title={isCollapsed ? "Produtos" : undefined}
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
              </li>

              <li>
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
                    isCollapsed ? "justify-center px-0" : "justify-between px-3",
                    "text-[15px] font-medium",
                    "text-black/90",
                    "transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                    !isOnTransactions && "hover:bg-black/[0.04]"
                  )}
                  aria-expanded={transactionsOpen}
                  aria-label="Pagamentos"
                  title={isCollapsed ? "Pagamentos" : undefined}
                >
                  {isOnTransactions && (
                    <motion.span
                      layoutId="sidebar-active-main-pill"
                      className="pointer-events-none absolute inset-0 rounded-xl bg-black/[0.06] will-change-transform"
                      transition={activePillTransition}
                    />
                  )}
                  <span className={itemContentBase}>
                    <ITransactions target={`#${transactionsHoverTargetId}`} />
                    <span className={itemLabelBase}>Pagamentos</span>
                  </span>
                  {!isCollapsed && (
                    <span className="relative z-[1]">
                      <CaretDown open={transactionsOpen} />
                    </span>
                  )}
                </motion.button>

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
                          <span className="relative z-[1]">Metodos de Pagamento</span>
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
                          <span className="relative z-[1]">Historico</span>
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
      </aside>
    </>
  );
}
