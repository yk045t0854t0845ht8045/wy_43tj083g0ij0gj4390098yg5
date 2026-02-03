"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Home,
  Shield,
  Database,
  Lock,
  Mail,
  Search,
  ArrowRight,
  Menu,
  X,
  FileText,
  CheckCircle2,
  Scale,
  Plug,
  LifeBuoy,
  RotateCcw,
  Cookie,
  Share2,
  Globe,
  UserRound,
  Gavel,
  BadgeCheck,
  Ban,
} from "lucide-react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

type Section = {
  id: string;
  title: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function privacyPage() {
  const prefersReducedMotion = useReducedMotion();

  const EASE = useMemo(() => [0.2, 0.8, 0.2, 1] as const, []);
  const DUR = useMemo(
    () => ({
      sm: 0.18,
      md: 0.28,
      lg: 0.55,
      xl: 0.9,
    }),
    []
  );

  const quote = useMemo(
    () =>
      `Privacidade não é um diferencial. É um compromisso. Dados existem para servir pessoas — com transparência, segurança e controle.`,
    []
  );

  const sections: Section[] = useMemo(
    () => [
      { id: "top", title: "Visão geral" },
      { id: "escopo", title: "1. Escopo e aplicação" },
      { id: "dados_coletados", title: "2. Quais dados coletamos" },
      { id: "finalidades", title: "3. Como usamos os dados" },
      { id: "base_legal", title: "4. Bases legais (LGPD)" },
      { id: "compartilhamento", title: "5. Compartilhamento com terceiros" },
      { id: "whatsapp_terceiros", title: "6. WhatsApp/Meta e provedores" },
      { id: "cookies", title: "7. Cookies e tecnologias similares" },
      { id: "armazenamento", title: "8. Retenção e armazenamento" },
      { id: "seguranca", title: "9. Segurança da informação" },
      { id: "direitos", title: "10. Direitos do titular" },
      { id: "transferencia", title: "11. Transferência internacional" },
      { id: "criancas", title: "12. Crianças e adolescentes" },
      { id: "incidentes", title: "13. Incidentes e comunicações" },
      { id: "alteracoes", title: "14. Alterações desta política" },
      { id: "contato", title: "15. Contato" },
    ],
    []
  );

  // ✅ Ícones + bolinhas coloridas (100% redondinho)
  const iconMap = useMemo(() => {
    const common = { size: 18, strokeWidth: 2.2 as const };
    return {
      top: { Icon: Home, bubble: "bg-blue-200 text-blue-700" },
      escopo: { Icon: FileText, bubble: "bg-slate-200 text-slate-800" },
      dados_coletados: { Icon: Database, bubble: "bg-cyan-200 text-cyan-800" },
      finalidades: { Icon: CheckCircle2, bubble: "bg-emerald-200 text-emerald-700" },
      base_legal: { Icon: Scale, bubble: "bg-stone-200 text-stone-800" },
      compartilhamento: { Icon: Share2, bubble: "bg-indigo-200 text-indigo-700" },
      whatsapp_terceiros: { Icon: Plug, bubble: "bg-sky-200 text-sky-800" },
      cookies: { Icon: Cookie, bubble: "bg-amber-200 text-amber-800" },
      armazenamento: { Icon: RotateCcw, bubble: "bg-zinc-200 text-zinc-800" },
      seguranca: { Icon: Lock, bubble: "bg-purple-200 text-purple-800" },
      direitos: { Icon: UserRound, bubble: "bg-green-200 text-green-800" },
      transferencia: { Icon: Globe, bubble: "bg-neutral-200 text-neutral-800" },
      criancas: { Icon: Ban, bubble: "bg-rose-200 text-rose-800" },
      incidentes: { Icon: LifeBuoy, bubble: "bg-blue-200 text-blue-800" },
      alteracoes: { Icon: BadgeCheck, bubble: "bg-lime-200 text-lime-800" },
      contato: { Icon: Mail, bubble: "bg-violet-200 text-violet-800" },
      __common: common,
    } as const;
  }, []);

  const [activeId, setActiveId] = useState<string>("top");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(0);

  const [mounted, setMounted] = useState(false);
  const userClickRef = useRef<{ id: string; until: number } | null>(null);

  const sectionTopsRef = useRef<Record<string, number>>({});
  const rafRef = useRef<number | null>(null);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.title.toLowerCase().includes(q));
  }, [sections, query]);

  // ✅ Mobile menu state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ✅ Fecha menu em ESC + trava scroll quando aberto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);

    if (mobileNavOpen) {
      const prev = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.documentElement.style.overflow = prev;
        window.removeEventListener("keydown", onKey);
      };
    }

    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  // ✅ Intro suave geral
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // ✅ Progresso topo
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      const p = scrollHeight <= 0 ? 0 : Math.min(1, Math.max(0, scrollTop / scrollHeight));
      setProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ✅ Calcula posições das seções
  const computeSectionTops = useCallback(() => {
    const map: Record<string, number> = {};
    map["top"] = 0;

    for (const s of sections) {
      if (s.id === "top") continue;
      const el = document.getElementById(s.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      map[s.id] = rect.top + window.scrollY;
    }

    sectionTopsRef.current = map;
  }, [sections]);

  useEffect(() => {
    computeSectionTops();

    const onResize = () => computeSectionTops();
    window.addEventListener("resize", onResize);

    const t1 = window.setTimeout(() => computeSectionTops(), 80);
    const t2 = window.setTimeout(() => computeSectionTops(), 350);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [computeSectionTops]);

  useEffect(() => {
    // força estética: ".../privacy/#/top" (e não ".../privacy#/top")
    const ensurePrettyHash = () => {
      const h = window.location.hash || "";
      if (!h.startsWith("#/")) return;

      const path = window.location.pathname.replace(/\/+$/, "");
      const desired = `${path}/${h}`;

      const current = `${window.location.pathname}${window.location.hash}`;
      if (current === desired) return;

      history.replaceState(null, "", desired);
    };

    ensurePrettyHash();
    window.addEventListener("hashchange", ensurePrettyHash);
    return () => window.removeEventListener("hashchange", ensurePrettyHash);
  }, []);

  // ✅ Scrollspy estável
  useEffect(() => {
    const OFFSET = 140;
    const handle = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const now = Date.now();
        const hold = userClickRef.current;
        if (hold && now < hold.until) return;

        const y = window.scrollY + OFFSET;

        if (window.scrollY < 120) {
          if (activeId !== "top") setActiveId("top");
          if (location.hash !== toHashRoute("top")) history.replaceState(null, "", toHashRoute("top"));
          return;
        }

        const tops = sectionTopsRef.current;
        let bestId = "top";
        let bestTop = -Infinity;

        for (const s of sections) {
          const t = tops[s.id];
          if (typeof t !== "number") continue;
          if (t <= y && t > bestTop) {
            bestTop = t;
            bestId = s.id;
          }
        }

        if (bestId && bestId !== activeId) {
          setActiveId(bestId);
          history.replaceState(null, "", toHashRoute(bestId));
        }
      });
    };

    handle();
    window.addEventListener("scroll", handle, { passive: true });
    return () => {
      window.removeEventListener("scroll", handle);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, activeId]);

  // ✅ Atalhos
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
      const isTypingContext = tag === "input" || tag === "textarea";

      if (e.key === "/" && !isTypingContext) {
        e.preventDefault();
        const el = document.getElementById("privacy-nav-search") as HTMLInputElement | null;
        el?.focus();
      }
      if (e.key === "Escape") {
        setQuery("");
        setMobileNavOpen(false);
        if (isTypingContext) (document.activeElement as HTMLElement | null)?.blur?.();
      }
      if ((e.key === "g" || e.key === "G") && !isTypingContext) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setActiveId("top");
        history.replaceState(null, "", toHashRoute("top"));
      }
      if (e.key === "Enter" && (document.activeElement as HTMLElement | null)?.id === "privacy-nav-search") {
        const first = filteredSections[0]?.id;
        if (first) {
          const el = document.getElementById(first);
          setActiveId(first);
          userClickRef.current = { id: first, until: Date.now() + 700 };
          history.replaceState(null, "", toHashRoute(first));
          if (first === "top") window.scrollTo({ top: 0, behavior: "smooth" });
          else el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredSections]);

  // ✅ Ao carregar: respeita hash
  useEffect(() => {
    const hashId = parseHashRoute();
    const valid = sections.some((s) => s.id === hashId);
    const targetId = valid ? hashId : "top";

    setActiveId(targetId);
    history.replaceState(null, "", toHashRoute(targetId));

    if (targetId === "top") {
      window.scrollTo({ top: 0, behavior: "auto" });
    } else {
      const el = document.getElementById(targetId);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: y, behavior: "auto" });
      }
    }

    const t = window.setTimeout(() => computeSectionTops(), 60);
    return () => window.clearTimeout(t);
  }, [sections, computeSectionTops]);

  // ✅ Clique: ativa + scroll + fecha menu mobile
  const scrollTo = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();

      setActiveId(id);
      userClickRef.current = { id, until: Date.now() + 750 };
      history.replaceState(null, "", toHashRoute(id));

      setMobileNavOpen(false);

      if (id === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const el = document.getElementById(id);
      if (!el) return;

      const y = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: "smooth" });
    },
    []
  );

  // ✅ Textos
  const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <h2
      id={id}
      className="scroll-mt-28 text-[24px] sm:text-[28px] md:text-[30px] font-semibold tracking-tight text-black"
    >
      {children}
    </h2>
  );

  const P = ({ children }: { children: React.ReactNode }) => (
    <p className="mt-4 text-[16px] sm:text-[17px] md:text-[17.5px] leading-[1.85] text-black/60">{children}</p>
  );

  const Li = ({ children }: { children: React.ReactNode }) => (
    <li className="text-[16px] sm:text-[17px] md:text-[17.5px] leading-[1.85] text-black/60">{children}</li>
  );

  function toHashRoute(id: string) {
    return `#/${id}`;
  }

  function parseHashRoute() {
    const h = (window.location.hash || "").trim();
    if (h.startsWith("#/")) return h.slice(2);
    if (h.startsWith("#")) return h.slice(1);

    const full = `${window.location.pathname}${window.location.hash}`;
    const m = full.match(/\/#\/([^/?#]+)/);
    return m?.[1] ?? "";
  }

  // ✅ Sidebar item
  const SidebarItem = ({ id, title }: { id: string; title: string }) => {
    const isActive = activeId === id;
    const meta = (iconMap as any)[id] ?? (iconMap as any).top;
    const Icon = meta.Icon;
    const bubble = meta.bubble;

    return (
      <motion.a
        href={toHashRoute(id)}
        onClick={scrollTo(id)}
        initial={false}
        whileHover={prefersReducedMotion ? undefined : { y: -1 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
        className={cx(
          "group flex items-center gap-3 rounded-full px-2.5 py-2 transition-all duration-300 ease-out select-none",
          isActive
            ? "bg-white shadow-[0_20px_30px_rgba(0,0,0,0.02)] ring-1 ring-black/5"
            : "bg-transparent hover:bg-black/[0.03]"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <span
          className={cx(
            "grid h-11 w-11 min-h-11 min-w-11 aspect-square shrink-0 place-items-center rounded-full overflow-hidden",
            bubble,
            isActive ? "shadow-[0_10px_28px_rgba(0,0,0,0.10)]" : "shadow-none"
          )}
        >
          <Icon {...(iconMap as any).__common} />
        </span>

        <span
          className={cx(
            "truncate text-[15px] font-semibold tracking-tight",
            isActive ? "text-black" : "text-black/80 group-hover:text-black"
          )}
        >
          {title}
        </span>
      </motion.a>
    );
  };

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="mt-7 rounded-[28px] bg-[#f4f4f4] ring-1 ring-black/5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
      <div className="p-6 sm:p-8">{children}</div>
    </div>
  );

  // ✅ Cookie consent (mesmo padrão)
  const COOKIE_KEY = "wyzer_cookie_consent_v1";
  const [cookieReady, setCookieReady] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(false);

  const [cookieAccepting, setCookieAccepting] = useState(false);
  const [cookieProgress, setCookieProgress] = useState(0);
  const cookieTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cookieTimerRef.current) window.clearInterval(cookieTimerRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(COOKIE_KEY);
      setShowCookieConsent(v !== "1");
    } catch {
      setShowCookieConsent(true);
    } finally {
      setCookieReady(true);
    }
  }, []);

  const acceptCookies = useCallback(() => {
    try {
      localStorage.setItem(COOKIE_KEY, "1");
    } catch {}
    setShowCookieConsent(false);
  }, [COOKIE_KEY]);

  const cookieWrapVariants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 40 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: prefersReducedMotion ? 0 : 0.55, ease: EASE },
      },
      exit: {
        opacity: 0,
        y: 56,
        transition: { duration: prefersReducedMotion ? 0 : 0.45, ease: EASE },
      },
    }),
    [EASE, prefersReducedMotion]
  );

  const cookieCardVariants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 22, scale: 0.985, filter: "blur(10px)" },
      show: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: { duration: prefersReducedMotion ? 0 : 0.6, ease: EASE },
      },
      exit: {
        opacity: 0,
        y: 36,
        scale: 0.992,
        filter: "blur(10px)",
        transition: { duration: prefersReducedMotion ? 0 : 0.5, ease: EASE },
      },
    }),
    [EASE, prefersReducedMotion]
  );

  // ✅ Mobile sheet variants (Apple)
  const mobileBackdrop = useMemo(
    () => ({
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: prefersReducedMotion ? 0 : 0.25, ease: EASE } },
      exit: { opacity: 0, transition: { duration: prefersReducedMotion ? 0 : 0.2, ease: EASE } },
    }),
    [EASE, prefersReducedMotion]
  );

  const mobileSheet = useMemo(
    () => ({
      hidden: { y: 26, opacity: 0, scale: 0.995, filter: "blur(10px)" },
      show: {
        y: 0,
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        transition: { duration: prefersReducedMotion ? 0 : 0.42, ease: EASE },
      },
      exit: {
        y: 34,
        opacity: 0,
        scale: 0.995,
        filter: "blur(10px)",
        transition: { duration: prefersReducedMotion ? 0 : 0.34, ease: EASE },
      },
    }),
    [EASE, prefersReducedMotion]
  );

  return (
    <div id="top" className="min-h-screen bg-white">
      {/* ✅ Scrollbar invisível */}
      <style jsx global>{`
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
      `}</style>

      {/* Soft background accents */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : DUR.xl, ease: EASE }}
          className="absolute inset-0"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 1.25, ease: EASE }}
            className="absolute -top-40 -left-48 h-[520px] w-[520px] rounded-full bg-[#99e600]/10 blur-[140px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 1.35, ease: EASE, delay: 0.05 }}
            className="absolute -top-56 right-0 h-[560px] w-[560px] rounded-full bg-black/5 blur-[160px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 1.45, ease: EASE, delay: 0.08 }}
            className="absolute bottom-[-220px] left-[25%] h-[520px] w-[520px] rounded-full bg-black/5 blur-[170px]"
          />
        </motion.div>
      </div>

      {/* Progress topo */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent">
        <div className="h-full bg-black/10">
          <div className="h-full bg-black/70" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      {/* ✅ Mobile hamburger (direita) */}
      <div className="lg:hidden fixed top-3 right-3 z-[65]">
        <motion.button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
          className={cx(
            "relative grid place-items-center",
            "h-12 w-12 rounded-full",
            "bg-white/70 backdrop-blur-xl",
            "ring-1 ring-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.10)]",
            "text-black/55 hover:text-black/80",
            "transition-all duration-300 ease-out"
          )}
          aria-label="Abrir navegação"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Menu className="h-[20px] w-[20px]" />
        </motion.button>
      </div>

      {/* SIDEBAR ESQUERDA (desktop) */}
      <aside className="hidden lg:block fixed left-0 top-0 z-50 h-screen w-[360px] px-6 pt-10 pb-6">
        <div className="h-full">
          <div className="mb-4 flex items-center gap-2 px-2">
            <div className="text-[12px] font-semibold tracking-wide text-black/45">NAVEGAÇÃO</div>
            <div className="ml-auto text-[11px] text-black/35">/ buscar • g topo</div>
          </div>

          <div className="px-2">
            <div className="flex items-center gap-2 rounded-full bg-black/[0.03] ring-1 ring-black/5 px-3 py-2">
              <Search className="h-[16px] w-[16px] text-black/50" />
              <input
                id="privacy-nav-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar tópico…"
                className="w-full bg-transparent outline-none text-[14px] text-black/80 placeholder:text-black/35"
              />
            </div>

            {query.trim() && (
              <div className="mt-2 px-1 text-[11px] text-black/35">
                {filteredSections.length ? `${filteredSections.length} resultado(s)` : "Nenhum resultado"}
              </div>
            )}
          </div>

          <div className="mt-5 h-[calc(100%-104px)] no-scrollbar px-2 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {filteredSections.map((s) => (
                <SidebarItem key={s.id} id={s.id} title={s.title} />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ✅ Mobile bottom sheet nav (Apple) */}
      <AnimatePresence initial={false} mode="sync">
        {mobileNavOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[80] bg-black/20 backdrop-blur-[6px]"
              variants={mobileBackdrop}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => setMobileNavOpen(false)}
              style={{ willChange: "opacity" }}
              aria-hidden
            />

            <motion.div
              className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-3"
              initial="hidden"
              animate="show"
              exit="exit"
              variants={mobileSheet}
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
                willChange: "transform, opacity, filter",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Navegação"
            >
              <div
                className={cx(
                  "mx-auto w-full max-w-[720px]",
                  "rounded-[28px] bg-white",
                  "ring-1 ring-black/10",
                  "shadow-[0_28px_90px_rgba(0,0,0,0.18)]",
                  "overflow-hidden"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {/* handle */}
                <div className="pt-3 pb-1 flex items-center justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-black/10" />
                </div>

                {/* header */}
                <div className="px-4 pb-3 pt-2 flex items-center gap-3">
                  <div className="text-[12px] font-semibold tracking-wide text-black/45">NAVEGAÇÃO</div>
                  <div className="ml-auto">
                    <motion.button
                      type="button"
                      onClick={() => setMobileNavOpen(false)}
                      whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                      transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                      className={cx(
                        "grid place-items-center h-10 w-10 rounded-full",
                        "bg-black/[0.03] ring-1 ring-black/5",
                        "text-black/55 hover:text-black/80",
                        "transition-all duration-300 ease-out"
                      )}
                      aria-label="Fechar navegação"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <X className="h-[18px] w-[18px]" />
                    </motion.button>
                  </div>
                </div>

                {/* search */}
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-2 rounded-full bg-black/[0.03] ring-1 ring-black/5 px-3 py-2">
                    <Search className="h-[16px] w-[16px] text-black/50" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar tópico…"
                      className="w-full bg-transparent outline-none text-[14px] text-black/80 placeholder:text-black/35"
                    />
                  </div>

                  {query.trim() && (
                    <div className="mt-2 px-1 text-[11px] text-black/35">
                      {filteredSections.length ? `${filteredSections.length} resultado(s)` : "Nenhum resultado"}
                    </div>
                  )}
                </div>

                {/* list */}
                <div className="max-h-[62vh] overflow-y-auto no-scrollbar px-3 pb-3">
                  <div className="flex flex-col gap-2">
                    {filteredSections.map((s) => (
                      <SidebarItem key={s.id} id={s.id} title={s.title} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Conteúdo central */}
      <main
        className={cx(
          "relative z-10 mx-auto w-full max-w-[1100px] px-4 sm:px-6 pt-10 pb-16 lg:pl-[390px]",
          prefersReducedMotion
            ? "opacity-100"
            : mounted
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-1",
          prefersReducedMotion ? "" : "transition-all duration-500 ease-out"
        )}
      >
        {/* Header */}
        <div className="flex flex-col gap-3">
          <h1 className="text-black/90 tracking-tight font-semibold leading-[1.04] text-[2.25rem] sm:text-[2.9rem] md:text-[3.25rem]">
            Política de Privacidade — Wyzer
          </h1>

          <p className="max-w-3xl text-black/55 text-[16px] sm:text-[17px] leading-relaxed">
            Esta Política explica como a Wyzer coleta, usa, compartilha e protege dados pessoais no contexto da plataforma
            (automação de atendimento, fluxos, integrações, dashboards e suporte).
          </p>
        </div>

        {/* Quote card */}
        <Card>
          <div className="max-w-4xl">
            <div className="text-[13px] font-semibold text-black/55">Nosso compromisso</div>
            <div className="mt-4 text-[22px] sm:text-[26px] md:text-[30px] leading-[1.18] tracking-tight font-medium text-black">
              <span className="select-none">“</span>
              {quote}
              <span className="select-none">”</span>
            </div>

            <div className="mt-5 text-[13px] text-black/55">
              Última atualização:{" "}
              <span className="text-black/70 font-semibold">{new Date().toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
        </Card>

        {/* Top note */}
        <div className="mt-10 rounded-[22px] bg-[#f4f4f4] ring-1 ring-black/5 p-5 sm:p-6 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          <div className="text-[12px] font-semibold tracking-wide text-black/45">TRANSPARÊNCIA</div>
          <div className="mt-2 text-[14px] sm:text-[14.5px] leading-relaxed text-black/60">
            Esta Política foi escrita para ser clara e prática. Se você precisar de termos específicos (ex.: DPA, anexos de
            segurança, SLA formal, cláusulas internas), recomendamos validação com advogado e/ou time de compliance.
          </div>
        </div>

        {/* privacy */}
        <div className="mt-10 space-y-14">
          <section id="escopo">
            <H2 id="escopo">1. Escopo e aplicação</H2>
            <P>
              Esta Política se aplica ao uso do site, painéis, integrações, APIs, suporte e qualquer funcionalidade da
              plataforma Wyzer (“Serviço”).
            </P>
            <ul className="mt-5 list-disc pl-6 space-y-2.5">
              <Li>
                Em cenários típicos, o Cliente atua como <b className="text-black/75">Controlador</b> dos dados de seus
                usuários finais, e a Wyzer atua como <b className="text-black/75">Operadora</b> ao processar dados em nome
                do Cliente.
              </Li>
              <Li>
                Em contextos como cobrança, cadastro direto e suporte, a Wyzer pode atuar como <b className="text-black/75">Controladora</b>{" "}
                dos dados necessários para cumprir obrigações legais e contratuais.
              </Li>
            </ul>
          </section>

          <section id="dados_coletados">
            <H2 id="dados_coletados">2. Quais dados coletamos</H2>
            <P>Coletamos o mínimo necessário para operar o Serviço com segurança, qualidade e conformidade. Exemplos:</P>
            <ul className="mt-5 list-disc pl-6 space-y-2.5">
              <Li>
                <b className="text-black/75">Dados de conta</b>: nome, e-mail, empresa, credenciais, logs de acesso,
                preferências.
              </Li>
              <Li>
                <b className="text-black/75">Dados de operação</b>: conversas, mensagens, contatos, tags, fluxos, templates,
                configurações e métricas do painel inseridos pelo Cliente.
              </Li>
              <Li>
                <b className="text-black/75">Dados técnicos</b>: IP, dispositivo, navegador, eventos de uso, diagnósticos,
                antifraude, auditoria e segurança.
              </Li>
              <Li>
                <b className="text-black/75">Dados de cobrança</b>: status de assinatura, histórico de faturas e tokens de
                pagamento (quando aplicável via provedores).
              </Li>
            </ul>
          </section>

          <section id="finalidades">
            <H2 id="finalidades">3. Como usamos os dados</H2>
            <P>Usamos dados para:</P>
            <ul className="mt-5 list-disc pl-6 space-y-2.5">
              <Li>Prestar o Serviço (automação, fluxos, integrações, dashboards e suporte).</Li>
              <Li>Melhorar desempenho, estabilidade, experiência e qualidade do produto.</Li>
              <Li>Garantir segurança, prevenção a fraude, abuso e incidentes.</Li>
              <Li>Cumprir obrigações legais, fiscais e contratuais.</Li>
              <Li>Comunicar mudanças relevantes, avisos técnicos e informações administrativas.</Li>
            </ul>
          </section>

          <section id="base_legal">
            <H2 id="base_legal">4. Bases legais (LGPD)</H2>
            <P>
              O tratamento pode ocorrer com base em: execução de contrato, cumprimento de obrigação legal/regulatória,
              legítimo interesse (com avaliação e salvaguardas), e consentimento quando exigido.
            </P>
            <P>
              Quando o Cliente usa a Wyzer para contactar usuários finais, ele deve garantir base legal adequada (ex.:
              consentimento, execução de contrato, legítimo interesse com opt-out, etc.) conforme o caso.
            </P>
          </section>

          <section id="compartilhamento">
            <H2 id="compartilhamento">5. Compartilhamento com terceiros</H2>
            <P>
              Podemos compartilhar dados com provedores essenciais para operar o Serviço, sempre dentro do necessário e com
              medidas contratuais e técnicas de proteção.
            </P>
            <ul className="mt-5 list-disc pl-6 space-y-2.5">
              <Li>Hospedagem, banco de dados, armazenamento e monitoramento (infraestrutura).</Li>
              <Li>Processadores de pagamento, emissão fiscal e prevenção à fraude (quando aplicável).</Li>
              <Li>Ferramentas de suporte, atendimento e comunicação (helpdesk/e-mail), quando usadas.</Li>
            </ul>
            <P>
              Não vendemos dados pessoais. Se houver exigência legal/ordem judicial, poderemos divulgar informações conforme
              a lei.
            </P>
          </section>

          <section id="whatsapp_terceiros">
            <H2 id="whatsapp_terceiros">6. WhatsApp/Meta e provedores</H2>
            <P>
              O Serviço pode depender de APIs e políticas de terceiros (ex.: WhatsApp/Meta, gateways, provedores de mensagens).
              Esses terceiros possuem seus próprios termos e políticas, e podem impor limitações técnicas e de compliance.
            </P>
            <ul className="mt-5 list-disc pl-6 space-y-2.5">
              <Li>O Cliente deve respeitar opt-out, bloqueios e preferências do usuário final.</Li>
              <Li>Mensagens e templates devem seguir as regras do provedor.</Li>
              <Li>Bloqueios e restrições por terceiros podem impactar o Serviço.</Li>
            </ul>
          </section>

          <section id="cookies">
            <H2 id="cookies">7. Cookies e tecnologias similares</H2>
            <P>
              Usamos cookies e tecnologias similares para autenticação, segurança, preferências, analytics e melhoria de
              desempenho.
            </P>
            <ul className="mt-5 list-disc pl-6 space-y-2.5">
              <Li>Cookies essenciais: login, sessão e proteção.</Li>
              <Li>Preferências: idioma, UI e customizações.</Li>
              <Li>Métricas: diagnóstico e melhoria do produto (quando aplicável).</Li>
            </ul>
            <P>
              Você pode gerenciar cookies pelo navegador. Algumas funções podem não operar corretamente sem cookies
              essenciais.
            </P>
          </section>

          <section id="armazenamento">
            <H2 id="armazenamento">8. Retenção e armazenamento</H2>
            <P>
              Mantemos dados pelo tempo necessário para cumprir finalidades desta Política, obrigações legais e/ou exercício
              regular de direitos.
            </P>
            <ul className="mt-5 list-disc pl-6 space-y-2.5">
              <Li>Logs e auditoria podem ter retenção mínima para segurança e conformidade.</Li>
              <Li>Dados operacionais podem ser removidos após encerramento conforme prazos razoáveis e limites técnicos.</Li>
              <Li>Backups podem existir por período limitado até rotação completa.</Li>
            </ul>
          </section>

          <section id="seguranca">
            <H2 id="seguranca">9. Segurança da informação</H2>
            <P>
              Adotamos medidas proporcionais ao risco: controle de acesso, segregação, criptografia quando aplicável,
              monitoramento, auditoria e hardening. Nenhum sistema é 100% invulnerável.
            </P>
            <P>
              O Cliente também é responsável por segurança do seu ambiente (senhas, 2FA quando disponível, gestão de acessos,
              tokens, webhooks e permissões).
            </P>
          </section>

          <section id="direitos">
            <H2 id="direitos">10. Direitos do titular</H2>
            <P>
              Conforme a LGPD, titulares podem solicitar confirmação, acesso, correção, anonimização, portabilidade, exclusão,
              informação sobre compartilhamento e revogação de consentimento, quando aplicável.
            </P>
            <ul className="mt-5 list-disc pl-6 space-y-2.5">
              <Li>Se você é usuário final de um Cliente, sua solicitação pode precisar ser direcionada ao Cliente (Controlador).</Li>
              <Li>Quando aplicável, a Wyzer auxiliará o Cliente como Operadora dentro das possibilidades técnicas.</Li>
            </ul>
          </section>

          <section id="transferencia">
            <H2 id="transferencia">11. Transferência internacional</H2>
            <P>
              Dependendo da infraestrutura e provedores, dados podem ser tratados fora do Brasil. Quando isso ocorrer,
              buscamos bases legais e salvaguardas adequadas (contratos, medidas técnicas e padrões de proteção).
            </P>
          </section>

          <section id="criancas">
            <H2 id="criancas">12. Crianças e adolescentes</H2>
            <P>
              O Serviço não é direcionado a crianças. Se houver tratamento de dados de menores, o Cliente deve garantir base
              legal e consentimentos exigidos, conforme legislação aplicável.
            </P>
          </section>

          <section id="incidentes">
            <H2 id="incidentes">13. Incidentes e comunicações</H2>
            <P>
              Em caso de incidente relevante, a Wyzer pode comunicar Clientes afetados conforme boas práticas e obrigações
              legais, considerando impacto e risco aos titulares.
            </P>
            <P>
              Também podemos enviar comunicações administrativas e avisos técnicos importantes para segurança e continuidade
              do Serviço.
            </P>
          </section>

          <section id="alteracoes">
            <H2 id="alteracoes">14. Alterações desta política</H2>
            <P>
              Podemos atualizar esta Política periodicamente. Quando a alteração for relevante, poderemos avisar por meios
              razoáveis (ex.: aviso no painel ou e-mail). O uso continuado após atualização indica ciência das mudanças.
            </P>
          </section>

          <section id="contato">
            <H2 id="contato">15. Contato</H2>
            <P>
              Para dúvidas, solicitações de privacidade, ou assuntos legais, utilize os canais oficiais informados no site e/ou
              no painel da Wyzer.
            </P>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <motion.a
                href="/contato"
                whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                className="group relative inline-flex items-center justify-center bg-white border border-black/10 rounded-full px-5 py-3 text-black/80 hover:text-black hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-lime-400/60 transition-all duration-300 ease-out text-[13px] font-semibold shadow-sm"
              >
                Falar com a Wyzer
              </motion.a>

              <motion.a
                href={toHashRoute("top")}
                onClick={scrollTo("top")}
                whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                className="group relative inline-flex items-center justify-center bg-[#171717] border border-[#454545] border-2 rounded-full px-5 py-3 text-white hover:border-[#6a6a6a] focus:outline-none focus:ring-2 focus:ring-lime-400/60 transition-all duration-300 ease-out text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)]"
                style={{ willChange: "transform" }}
              >
                Voltar ao topo
              </motion.a>
            </div>
          </section>
        </div>

        <div className="h-14" />
      </main>

      {/* ✅ CONSENTIMENTO DE COOKIES (Dinâmica Apple / sobe de baixo) */}
      <AnimatePresence initial={false} mode="sync" presenceAffectsLayout={false}>
        {cookieReady && showCookieConsent && (
          <motion.div
            variants={cookieWrapVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-x-0 bottom-0 z-[70] pointer-events-none"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
              willChange: "transform, opacity",
              contain: "layout paint",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            {/* ✅ alinhado com o conteúdo da privacy (mesmo max + mesmo padding + mesmo offset de sidebar) */}
            <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 lg:pl-[390px]">
              <div className="w-full flex justify-center">
                <motion.div
                  whileHover={prefersReducedMotion || cookieAccepting ? undefined : { y: -1, scale: 1.003 }}
                  whileTap={prefersReducedMotion || cookieAccepting ? undefined : { scale: 0.997 }}
                  transition={{ duration: prefersReducedMotion ? 0 : DUR.md, ease: EASE }}
                  className="pointer-events-auto relative transform-gpu w-full max-w-[640px]"
                  style={{ willChange: "transform", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                >
                  <motion.div
                    variants={cookieCardVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    transition={{ duration: prefersReducedMotion ? 0 : DUR.lg, ease: EASE }}
                    className="bg-black rounded-[40px] px-6 sm:px-10 md:px-10 pt-6 pb-5 w-full mt-2 relative z-10 transition-all duration-500 ease-out flex flex-col ring-1 ring-white/10 shadow-[0_18px_55px_rgba(0,0,0,0.18)] transform-gpu"
                    style={{
                      willChange: "transform, opacity, filter",
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <h2 className="text-white mb-1.5 text-[1.35rem] sm:text-[1.65rem] md:text-[1.5rem] font-medium tracking-tight">
                      Consentimento de Cookies
                    </h2>

                    <p className="text-[#8a8a8a] text-[12px] sm:text-[13px] font-medium mb-3">
                      Usamos cookies para melhorar sua experiência, segurança e desempenho.
                    </p>

                    <p className="text-white/70 text-[12px] sm:text-[13px] leading-relaxed">
                      Ao continuar navegando, você concorda com o uso de cookies conforme nossa política. Você pode ajustar
                      suas preferências no navegador a qualquer momento.
                    </p>

                    <div className="mt-4">
                      <motion.button
                        type="button"
                        onClick={acceptCookies}
                        whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                        className={cx(
                          "group relative w-full bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white",
                          "hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out",
                          "text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu"
                        )}
                        style={{ willChange: "transform" }}
                      >
                        <span className="relative z-10">Entendi e continuar</span>

                        <motion.span
                          whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                          whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                          transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-white/10 rounded-full p-3 transition-all duration-300 ease-out group-hover:translate-x-0.5"
                        >
                          <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                        </motion.span>
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
