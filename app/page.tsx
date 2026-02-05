"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "framer-motion";

export default function ShopifyLandingPage() {
   const [email, setEmail] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ✅ controla o card flutuante quando sair do HERO
  const heroRef = useRef<HTMLElement | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  // ✅ Tooltips (Pricing)
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  // ✅ Cookies (ilha dinâmica: o mesmo card se transforma)
  const COOKIE_KEY = "wyzer_cookie_consent_v1";
  const [cookieReady, setCookieReady] = useState(false);
  const [cookiesAccepted, setCookiesAccepted] = useState(false);
  const [cookieAccepting, setCookieAccepting] = useState(false);

  // ✅ controla a animação: cookies descem -> troca estado -> signup sobe
  const [cookieExiting, setCookieExiting] = useState(false);

  // ✅ trava altura do card preto no tamanho do "Criar conta"
  const signupMeasureRef = useRef<HTMLDivElement | null>(null);
  const [stickyIslandHeight, setStickyIslandHeight] = useState<number | null>(null);

  // Se quiser forçar o "modo cookies" só quando o sticky estiver visível:
  const shouldShowCookiesInSticky = cookieReady && !cookiesAccepted;

    // ✅ Modal de Tutoriais (YouTube)
  const [tutorialsOpen, setTutorialsOpen] = useState(false);

  const openTutorials = () => setTutorialsOpen(true);
  const closeTutorials = () => setTutorialsOpen(false);

  // troque aqui pelo seu vídeo
  const TUTORIALS_YT_URL =
    "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=0&rel=0&modestbranding=1";

  // ✅ Animações alinhadas (premium / consistentes)
  const prefersReducedMotion = useReducedMotion();
  const EASE = useMemo(() => [0.2, 0.8, 0.2, 1] as const, []);
  const DUR = useMemo(
    () => ({
      xs: 0.18,
      sm: 0.22,
      md: 0.35,
      lg: 0.7,
      xl: 0.9,
    }),
    []
  );

  function encodeEmailToUrlToken(email: string) {
  // base64url(utf8(email))
  const utf8 = encodeURIComponent(email.trim());
  const b64 = typeof window !== "undefined" ? window.btoa(utf8) : "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getLoginOrigin() {

  return process.env.NEXT_PUBLIC_LOGIN_ORIGIN || "http://login.wyzer.com.br";
}

function goToLoginWithEmail(email: string) {
  const clean = email.trim();
  if (!clean) return;

  const token = encodeEmailToUrlToken(clean);
  const target = `${getLoginOrigin()}/mail/${token}`;

  window.location.assign(target);
}

  const VIEWPORT = useMemo(() => ({ once: true, amount: 0.25 }), []);

   const SPRING_SOFT = useMemo(
    () =>
      prefersReducedMotion
        ? ({ duration: 0 } as const)
        : ({
            type: "spring",
            stiffness: 430,
            damping: 42,
            mass: 1.05,
            restDelta: 0.2,
            restSpeed: 0.2,
          } as const),
    [prefersReducedMotion]
  );

  const SPRING_SNAP = useMemo(
    () =>
      prefersReducedMotion
        ? ({ duration: 0 } as const)
        : ({
            type: "spring",
            stiffness: 520,
            damping: 48,
            mass: 0.95,
            restDelta: 0.2,
            restSpeed: 0.2,
          } as const),
    [prefersReducedMotion]
  );

  // ✅ Sticky CTA: variações com “histerese via delay” (animação), evitando micro-toggle que dá “piscada”
  const stickyWrapVariants = useMemo(
    () => ({
      hidden: {
        opacity: 0,
        y: 22,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.14, ease: "linear" },
              y: { ...SPRING_SNAP },
            },
      },
      show: {
        opacity: 1,
        y: 0,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              // ✅ pequeno delay só na ENTRADA reduz flicker perto do threshold
              delay: 0.11,
              opacity: { duration: 0.18, ease: "linear" },
              y: { ...SPRING_SOFT },
            },
      },
      exit: {
        opacity: 0,
        y: 16,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.14, ease: "linear" },
              y: { ...SPRING_SNAP },
            },
      },
    }),
    [prefersReducedMotion, SPRING_SOFT, SPRING_SNAP]
  );

  const stickyCardVariants = useMemo(
    () => ({
      hidden: {
        opacity: 0,
        y: 10,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.12, ease: "linear" },
              y: { ...SPRING_SOFT },
            },
      },
      show: {
        opacity: 1,
        y: 0,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              delay: 0.02,
              opacity: { duration: 0.16, ease: "linear" },
              y: { ...SPRING_SOFT },
            },
      },
      exit: {
        opacity: 0,
        y: 8,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.12, ease: "linear" },
              y: { ...SPRING_SNAP },
            },
      },
    }),
    [prefersReducedMotion, SPRING_SOFT, SPRING_SNAP]
  );

    const cookiePanelVariants = useMemo(
    () => ({
      initial: { opacity: 0, y: 10, filter: "blur(10px)" },
      show: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.18, ease: "linear" },
              y: { ...SPRING_SOFT },
              filter: { duration: 0.22, ease: "easeOut" },
            },
      },
      // ✅ saída padrão (quando troca normal)
      exit: {
        opacity: 0,
        y: 14,
        filter: "blur(10px)",
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.12, ease: "linear" },
              y: { ...SPRING_SNAP },
              filter: { duration: 0.14, ease: "easeIn" },
            },
      },
      // ✅ saída premium: desce mais e suaviza (usado no clique)
      drop: {
        opacity: 0,
        y: 60,
        filter: "blur(12px)",
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.14, ease: "linear" },
              y: { duration: 0.42, ease: [0.2, 0.85, 0.2, 1] },
              filter: { duration: 0.22, ease: "easeIn" },
            },
      },
    }),
    [prefersReducedMotion, SPRING_SOFT, SPRING_SNAP]
  );

  const signupPanelVariants = useMemo(
    () => ({
      initial: { opacity: 0, y: -18, filter: "blur(10px)" }, // ✅ começa de cima
      show: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.18, ease: "linear" },
              y: { ...SPRING_SOFT },
              filter: { duration: 0.22, ease: "easeOut" },
            },
      },
      exit: {
        opacity: 0,
        y: 10,
        filter: "blur(10px)",
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.12, ease: "linear" },
              y: { ...SPRING_SNAP },
              filter: { duration: 0.14, ease: "easeIn" },
            },
      },
    }),
    [prefersReducedMotion, SPRING_SOFT, SPRING_SNAP]
  );

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        // se o HERO não está mais visível -> mostra o card flutuante
        setShowStickyCta(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.12,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

    // ✅ Fecha modal no ESC
  useEffect(() => {
    if (!tutorialsOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTutorials();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tutorialsOpen]);

  // ✅ trava scroll quando modal está aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (tutorialsOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [tutorialsOpen]);

    // ✅ Lê consentimento (localStorage + cookie fallback)
  useEffect(() => {
    try {
      const ls = localStorage.getItem(COOKIE_KEY);
      const cookieHit =
        typeof document !== "undefined" &&
        document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE_KEY}=1`));

      const accepted = ls === "1" || cookieHit;
      setCookiesAccepted(accepted);
      setCookieReady(true);
    } catch {
      // Se der erro (ex: privacy mode), ainda libera render
      setCookieReady(true);
      setCookiesAccepted(false);
    }
  }, []);

    useEffect(() => {
    if (!signupMeasureRef.current) return;

    const el = signupMeasureRef.current;

    const update = () => {
      const h = el.getBoundingClientRect().height;
      if (!Number.isFinite(h) || h <= 0) return;
      setStickyIslandHeight(Math.round(h));
    };

    update();

    // ✅ mantém perfeito se fonte/viewport mudar
    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

    const acceptCookies = async () => {
    if (cookieAccepting || cookieExiting) return;
    setCookieAccepting(true);

    try {
      // ✅ localStorage
      localStorage.setItem(COOKIE_KEY, "1");

      // ✅ cookie (1 ano)
      const isHttps = typeof location !== "undefined" && location.protocol === "https:";
      document.cookie = `${COOKIE_KEY}=1; Path=/; Max-Age=31536000; SameSite=Lax${isHttps ? "; Secure" : ""}`;
    } catch {}

    // ✅ 1) inicia saída do card de cookies (desce)
    setCookieExiting(true);

    // ✅ 2) quando a animação terminar, troca para signup
    window.setTimeout(() => {
      setCookiesAccepted(true);      // agora shouldShowCookiesInSticky vira false
      setCookieAccepting(false);
      setCookieExiting(false);       // limpa pro futuro
    }, prefersReducedMotion ? 0 : 420);
  };


  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  // ✅ trava scroll quando o menu mobile (bottom sheet) está aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (mobileNavOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const scrollToId = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileNavOpen(false);

    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const fadeUp = useMemo(
    () => ({
      // ✅ remove scale pra evitar raster/repintura e “piscadas” quando overlays entram/saem
      hidden: { opacity: 0, y: 14 },
      show: { opacity: 1, y: 0 },
    }),
    []
  );

  const faqs = useMemo(
    () => [
      {
        q: "O que é e como funciona a Wyzer?",
        a: "A Wyzer é um sistema de automação para WhatsApp que organiza conversas, envia respostas automáticas, integra pagamentos e melhora seu atendimento 24/7 sem complicação.",
      },
      {
        q: "Quanto custa a Wyzer?",
        a: "Você pode começar com um plano mensal simples e evoluir conforme sua demanda. O valor final depende do volume de mensagens, recursos e integrações que você ativar.",
      },
      {
        q: "Posso usar meu próprio número e identidade no WhatsApp?",
        a: "Sim. Você pode operar com o seu número (WhatsApp Business) e personalizar mensagens, perfil, fluxos e respostas para ficar com a cara da sua empresa.",
      },
      {
        q: "Preciso saber design ou programação para usar?",
        a: "Não. Você consegue começar com templates prontos e personalizar por etapas. Se quiser, pode avançar com integrações e automações mais completas depois.",
      },
    ],
    []
  );

  const logos = useMemo(
    () => [
      {
        src: "/lg/interprises/Digital_Inline_Black.svg",
        alt: "WhatsApp",
        className: "h-7 md:h-8 w-auto",
      },
      { src: "/lg/interprises/stripe.svg", alt: "Stripe", className: "h-7 md:h-9 w-auto" },
      {
        src: "/lg/interprises/id9q7Wa4Ba_1769647839747.svg",
        alt: "Supabase",
        className: "h-7 md:h-6 w-auto",
      },
      { src: "/lg/interprises/vercel.svg", alt: "Vercel", className: "h-7 md:h-4 w-auto" },
      {
        src: "/lg/interprises/OpenAI-black-wordmark.svg",
        alt: "OpenAI ChatGPT",
        className: "h-7 md:h-12 w-auto",
      },
      { src: "/lg/interprises/idwdgcJw5c_logos.svg", alt: "Meta", className: "h-7 md:h-12 w-auto" },
    ],
    []
  );

  const footerColumns = useMemo(
    () => [
      {
        title: "Produto",
        items: ["Visão geral", "Recursos", "Soluções", "Tutoriais", "Planos", "Novidades"],
      },
      {
        title: "Empresa",
        items: ["Sobre nós", "Carreiras", "Imprensa", "Notícias", "Kit de mídia", "Contato"],
      },
      {
        title: "Recursos",
        items: ["Blog", "Newsletter", "Eventos", "Central de ajuda", "Tutoriais", "Suporte"],
      },
      {
        title: "Social",
        items: ["X (Twitter)", "LinkedIn", "Facebook", "GitHub", "Instagram", "Dribbble"],
      },
      {
        title: "Legal",
        items: ["Termos", "Privacidade", "Cookies", "Licenças", "Configurações", "Contato"],
      },
    ],
    []
  );

  const footerHref = (colTitle: string, item: string) => {
    const col = colTitle.toLowerCase();

    if (col === "produto") {
      if (item === "Visão geral") return "#top";
      if (item === "Recursos") return "#features";
      if (item === "Soluções") return "#features";
      if (item === "Tutoriais") return "#features";
      if (item === "Planos") return "#pricing";
      if (item === "Novidades") return "#how-it-works";
      return "#top";
    }

    if (col === "empresa") {
      if (item === "Sobre nós") return "#how-it-works";
      if (item === "Carreiras") return "/carreiras";
      if (item === "Imprensa") return "/imprensa";
      if (item === "Notícias") return "/blog";
      if (item === "Kit de mídia") return "/media-kit";
      if (item === "Contato") return "/contato";
      return "#top";
    }

    if (col === "recursos") {
      if (item === "Blog") return "/blog";
      if (item === "Newsletter") return "/newsletter";
      if (item === "Eventos") return "/eventos";
      if (item === "Central de ajuda") return "#faq";
      if (item === "Tutoriais") return "#features";
      if (item === "Suporte") return "#faq";
      return "#top";
    }

    if (col === "social") {
      if (item === "X (Twitter)") return "https://x.com/WyzerBot";
      if (item === "TikTok") return "https://www.tiktok.com/@wyzerbot?is_from_webapp=1&sender_device=pc";
      if (item === "Youtube") return "https://youtube.com/@wyzerbot?si=0OXV-AlyQYnuVZ6t";
      if (item === "GitHub") return "https://github.com/WyzerBot";
      if (item === "Instagram") return "https://www.instagram.com/wyzerbot/";
      if (item === "Dribbble") return "https://dribbble.com/social-wyzer";
      return "#top";
    }

    if (col === "legal") {
      if (item === "Termos") return "https://terms.wyzer.com.br";
      if (item === "Privacidade") return "https://privacy.wyzer.com.br";
      if (item === "Cookies") return "/cookies";
      if (item === "Licenças") return "/licenses";
      if (item === "Configurações") return "/settings";
      if (item === "Contato") return "/contato";
      return "#top";
    }

    return "#top";
  };

  const isExternal = (href: string) => /^https?:\/\//i.test(href);

  const TooltipIcon = ({ className }: { className?: string }) => (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        opacity=".55"
      />
      <path
        d="M12 10.9v5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity=".75"
      />
      <path
        d="M12 7.3h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".75"
      />
    </svg>
  );

  const CheckIcon = ({ className }: { className?: string }) => (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 7L10 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

    const Tooltip = ({
    id,
    text,
    tone = "light",
  }: {
    id: string;
    text: string;
    tone?: "light" | "dark";
  }) => {
    const isOpen = openTooltip === id;

    const base =
      tone === "dark"
        ? "bg-black text-white/90 ring-1 ring-white/10"
        : "bg-white text-black/80 ring-1 ring-black/10";

    const btn =
      tone === "dark"
        ? "hover:bg-white/10 focus:ring-lime-400/60"
        : "hover:bg-black/5 focus:ring-lime-400/60";

    const iconTone = tone === "dark" ? "text-white/55" : "text-black/60";

    return (
      <span
        className="relative inline-flex"
        onMouseEnter={() => setOpenTooltip(id)}
        onMouseLeave={() => setOpenTooltip(null)}
        onFocus={() => setOpenTooltip(id)}
        onBlur={() => setOpenTooltip(null)}
      >
        <span
          role="button"
          tabIndex={0}
          aria-label="Info"
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-transparent ${btn} focus:outline-none focus:ring-2 transition transform-gpu`}
          style={{ willChange: "transform" }}
        >
          <TooltipIcon className={iconTone} />
        </span>

        <AnimatePresence initial={false} mode="sync" presenceAffectsLayout={false}>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.sm, ease: EASE }}
              className={`absolute left-1/2 top-full mt-2 w-[240px] -translate-x-1/2 rounded-2xl px-3 py-2 text-[12px] leading-relaxed shadow-[0_18px_60px_rgba(0,0,0,0.10)] ${base} z-[40]`}
              style={{
                willChange: "transform, opacity",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <div className="pointer-events-none absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[3px] bg-inherit ring-1 ring-inherit" />
              {text}
            </motion.div>
          )}
        </AnimatePresence>
      </span>
    );
  };

  const PricingButton = ({
    label = "Criar Conta",
    variant = "dark",
    disabled = false,
    className,
  }: {
    label?: string;
    variant?: "dark" | "light" | "lime" | "outline";
    disabled?: boolean;
    className?: string;
  }) => {
    const base =
      "group relative inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-[13px] font-semibold transition-all duration-300 ease-out transform-gpu";

    const variants =
      variant === "lime"
        ? "bg-lime-400 text-black border border-lime-400 hover:brightness-[0.98] shadow-[0_18px_55px_rgba(0,0,0,0.14)]"
        : variant === "light"
        ? "bg-white text-black border border-black/15 hover:border-black/25 shadow-[0_12px_30px_rgba(0,0,0,0.06)]"
        : variant === "outline"
        ? "bg-white text-black/70 border border-black/15 hover:border-black/20 shadow-[0_10px_26px_rgba(0,0,0,0.05)]"
        : "bg-[#171717] text-white border border-[#454545] border-2 hover:border-[#6a6a6a] shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)]";

    const arrowWrap =
      variant === "lime"
        ? "group-hover:bg-black/10"
        : variant === "light" || variant === "outline"
        ? "group-hover:bg-black/5"
        : "group-hover:bg-white/10";

    const arrowColor = variant === "lime" || variant === "light" || variant === "outline" ? "text-black" : "text-white";

    return (
      <motion.a
        href="#pricing"
        onClick={scrollToId("pricing")}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        whileHover={disabled || prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
        whileTap={disabled || prefersReducedMotion ? undefined : { scale: 0.98 }}
        transition={{ duration: DUR.sm, ease: EASE }}
        className={`${base} ${variants} ${disabled ? "opacity-70 pointer-events-none" : ""} ${className ?? ""} pr-12`}
        style={{ willChange: "transform" }}
      >
        <span className="relative z-10">{label}</span>

        <motion.span
          whileHover={disabled || prefersReducedMotion ? undefined : { scale: 1.06 }}
          whileTap={disabled || prefersReducedMotion ? undefined : { scale: 0.96 }}
          transition={{ duration: DUR.sm, ease: EASE }}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2.5 transition-all duration-300 ease-out ${arrowWrap} group-hover:translate-x-0.5`}
        >
          <ArrowRight className={`w-[18px] h-[18px] ${arrowColor} transition-transform duration-300 group-hover:translate-x-0.5`} />
        </motion.span>
      </motion.a>
    );
  };


  const FeatureCard = ({
    tag,
    title,
    desc,
    visual,
    delay = 0,
  }: {
    tag: string;
    title: string;
    desc: string;
    visual: "themes" | "checkout" | "ai" | "support";
    delay?: number;
  }) => {
    return (
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: DUR.lg, ease: EASE, delay }}
        className="w-full"
      >
        <motion.div
          whileHover={prefersReducedMotion ? undefined : { y: -3, scale: 1.01 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
          transition={{ duration: DUR.md, ease: EASE }}
          className="group relative w-full overflow-hidden rounded-[28px] bg-[#f4f4f4] p-6 md:p-8 shadow-[0_18px_55px_rgba(0,0,0,0.08)] ring-1 ring-black/5 transform-gpu"
          style={{ willChange: "transform" }}
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-black/5 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-wide text-black/70 ring-1 ring-black/5">
            {tag}
          </div>

          <div className="relative mt-6 h-[220px] md:h-[260px] w-full">
            {visual === "themes" && (
              <div className="relative h-full w-full">
                <div className="absolute inset-0 rounded-[22px] bg-white/35" />
                <div
                  className="absolute left-4 top-6 h-[86%] w-[92%] -skew-x-6 rounded-[20px] shadow-[0_18px_60px_rgba(0,0,0,0.10)] ring-1 ring-black/5 opacity-95 bg-cover bg-center transform-gpu"
                  style={{ backgroundImage: "url(https://imgur.com/Du05Q4W.png)", willChange: "transform" }}
                />
              </div>
            )}

            {visual === "checkout" && (
              <div className="relative mx-auto h-full w-full max-w-[420px]">
                <div className="absolute inset-0 rounded-[26px] bg-white/35" />
                <div className="absolute left-1/2 top-1/2 h-[110%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[34px] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.12)] ring-1 ring-black/10" />
                <div className="absolute left-1/2 top-7 h-6 w-24 -translate-x-1/2 rounded-full bg-black/90" />

                <div className="absolute left-1/2 top-16 w-[68%] -translate-x-1/2">
                  <div className="h-5 w-24 rounded-md bg-black/10" />
                  <div className="mt-4 h-3 w-40 rounded bg-black/10" />
                  <div className="mt-2 h-3 w-32 rounded bg-black/10" />

                  <div className="mt-6 space-y-2">
                    {[
                      {
                        title: "PIX recebido",
                        time: "12:47",
                        desc: "Pagamento de R$ 89,00 confirmado • Stripe",
                        icon: "/lg/interprises/icns/stripe.jpeg",
                      },
                      {
                        title: "PIX recebido",
                        time: "09:18",
                        desc: "Pagamento de R$ 149,90 confirmado • Pix",
                        icon: "/lg/interprises/icns/idw7RhPKKl_1769649951601.jpeg",
                      },
                      {
                        title: "PIX recebido",
                        time: "08:02",
                        desc: "Pagamento de R$ 39,90 confirmado • Boleto",
                        icon: "/lg/interprises/icns/idKifnM5RK_1769650012298.png",
                      },
                    ].map((n, i) => (
                      <div
                        key={i}
                        className="h-12 rounded-xl bg-white ring-1 ring-black/10 shadow-sm px-3 flex items-center gap-2"
                      >
                        <div className="h-8 w-8 rounded-full bg-black/5 ring-1 ring-black/10 overflow-hidden grid place-items-center">
                          <img
                            src={n.icon}
                            alt={n.title}
                            className="h-full w-full object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="text-[11px] font-semibold text-black truncate">{n.title}</div>
                            <div className="text-[10px] text-black/40 shrink-0">{n.time}</div>
                          </div>
                          <div className="text-[10px] text-black/55 truncate">{n.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <div className="h-6 w-10 rounded-md bg-black/10" />
                    <div className="h-6 w-10 rounded-md bg-black/10" />
                    <div className="h-6 w-10 rounded-md bg-black/10" />
                  </div>
                </div>
              </div>
            )}

            {visual === "ai" && (
              <div className="relative mx-auto h-full w-full max-w-[520px]">
                <div className="absolute inset-0 rounded-[26px] bg-white/35" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#99e600]/20 blur-[60px]" />

                <div className="absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[18px] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.10)] ring-1 ring-black/10 p-5">
                  <div className="h-10 w-10 rounded-full overflow-hidden ring-1 ring-black/10 shadow-sm">
                    <img
                      src="https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=96&q=60"
                      alt="Assistente"
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>

                  <div className="mt-4 text-[15px] font-semibold text-black">Olá! Como posso ajudar?</div>

                  <div className="mt-0 rounded-2xl px-0 py-3">
                    <div className="text-[12px] text-black/70 leading-relaxed">
                      Quero automatizar meu WhatsApp para realizar atendimentos aos meus clientes 24/7.
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <div className="h-9 px-4 rounded-full bg-lime-400 text-[12px] font-semibold text-black/70 flex items-center">
                      Ver planos
                    </div>
                    <div className="h-9 px-4 rounded-full bg-lime-400 text-[12px] font-semibold text-black/70 flex items-center">
                      Falar com suporte
                    </div>
                  </div>
                </div>
              </div>
            )}

            {visual === "support" && (
              <div className="relative mx-auto h-full w-full max-w-[520px]">
                <div className="absolute inset-0 rounded-[26px] bg-white/35" />

                <div className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-black/10" />
                <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-black/10" />
                <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-black/10" />

                <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_18px_60px_rgba(0,0,0,0.10)] ring-1 ring-black/10" />
                <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full" />
                <div className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full">
                  <img
                    src="/lg/interprises/icns/Digital_Glyph_Green.svg"
                    alt="WhatsApp"
                    className="h-full w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                {[
                  { left: "18%", top: "34%", alt: "WhatsApp", src: "/lg/interprises/icns/idsfIhEopt_logos.png" },
                  { left: "74%", top: "24%", alt: "ChatGPT", src: "https://chatgpt.com/favicon.ico" },
                  { left: "82%", top: "58%", alt: "Meta", src: "/lg/interprises/icns/id3TxmQZUx_1769649484659.png" },
                  { left: "24%", top: "68%", alt: "Stripe", src: "https://stripe.com/favicon.ico" },
                  { left: "52%", top: "18%", alt: "Vercel", src: "https://vercel.com/favicon.ico" },
                ].map((p, i) => (
                  <div
                    key={i}
                    className="absolute h-11 w-11 rounded-full bg-white shadow-[0_18px_60px_rgba(0,0,0,0.10)] ring-1 ring-black/10 transform-gpu"
                    style={{ left: p.left, top: p.top, willChange: "transform" }}
                  >
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="h-6 w-6 rounded-full overflow-hidden">
                        <img
                          src={p.src}
                          alt={p.alt}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        <div className="mt-6">
          <h3 className="text-[22px] md:text-[26px] font-medium tracking-tight text-black">{title}</h3>
          <p className="mt-2 text-[15px] md:text-[16px] leading-relaxed text-black/55 max-w-[540px]">{desc}</p>
        </div>
      </motion.div>
    );
  };

  return (
    <div id="top" className="min-h-screen bg-white">
      {/* ✅ HERO + HEADER */}
      <section
        ref={heroRef}
        // ✅ FIX: remove altura fixa/viewport-only pra não “separar” do resto no zoom.
        // Agora o HERO acompanha o conteúdo e o restante do site emenda como um fluxo único.
        className="relative overflow-hidden"
      >
        {/* Fundo limpo (estilo atual) */}
        <div className="absolute inset-0 bg-white" />
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.xl, ease: EASE }}
          className="pointer-events-none absolute inset-0"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.3, ease: EASE }}
            className="absolute -top-40 -left-48 h-[520px] w-[520px] rounded-full bg-[#99e600]/12 blur-[140px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.4, ease: EASE, delay: 0.05 }}
            className="absolute -top-48 right-0 h-[560px] w-[560px] rounded-full bg-black/6 blur-[160px]"
          />
        </motion.div>

        <div className="relative z-10 mx-auto w-full max-w-[1300px] px-4 sm:px-4 pt-6 pb-6">
          {/* HEADER */}
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.lg, ease: EASE }}
            className="flex items-center justify-between px-14"
          >
            {/* Logo left (imagem link) */}
            <a href="#top" onClick={scrollToId("top")} className="flex items-center gap-3 cursor-pointer select-none">
              <div className="h-20 w-20 grid place-items-center">
                <img
                  src="https://imgur.com/z8a0w1p.png"
                  alt="Wyzer"
                  className="h-20 w-20 object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </a>

            <nav className="hidden lg:flex items-center gap-10 text-[13px] font-medium text-black/60">
              <a href="#features" onClick={scrollToId("features")} className="hover:text-black/85 transition">
                Recursos
              </a>
              <a href="#how-it-works" onClick={scrollToId("how-it-works")} className="hover:text-black/85 transition">
                Saiba Mais
              </a>
              <a href="#pricing" onClick={scrollToId("pricing")} className="hover:text-black/85 transition">
                Planos
              </a>
              <a href="#faq" onClick={scrollToId("faq")} className="hover:text-black/85 transition">
                Dúvidas
              </a>
              <a href="" onClick={scrollToId("top")} className="hover:text-black/85 transition">
                Suporte
              </a>
            </nav>

            <div className="hidden sm:flex items-center gap-4">
              <a href="https://login.wyzer.com.br/" className="text-[13px] font-medium text-black/60 hover:text-black/85 transition">
                Fazer Login
              </a>

              <motion.a
                href="#pricing"
                onClick={scrollToId("pricing")}
                whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: DUR.sm, ease: EASE }}
                className="group relative inline-flex items-center justify-center bg-[#171717] border border-[#454545] border-2 rounded-full px-5 py-2.5 text-white hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-12 transform-gpu"
                style={{ willChange: "transform" }}
              >
                <span className="relative z-10">Criar conta</span>
                <motion.span
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                  transition={{ duration: DUR.sm, ease: EASE }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-white/10 rounded-full p-2.5 transition-all duration-300 ease-out group-hover:translate-x-0.5"
                >
                  <ArrowRight className="w-[18px] h-[18px] text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                </motion.span>
              </motion.a>
            </div>

            <motion.button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              transition={{ duration: DUR.sm, ease: EASE }}
              className="sm:hidden h-11 w-11 rounded-full bg-white shadow-sm ring-1 ring-black/10 grid place-items-center transform-gpu"
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-bottomsheet"
              style={{ willChange: "transform" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </motion.button>
          </motion.header>

          <AnimatePresence initial={false} mode="sync">
            {mobileNavOpen && (
              <motion.div
                className="sm:hidden fixed inset-0 z-[90]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.md, ease: EASE }}
              >

                <motion.button
                  type="button"
                  aria-label="Close menu"
                  className="absolute inset-0 w-full h-full bg-black/30 backdrop-blur-[2px]"
                  onClick={() => setMobileNavOpen(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DUR.md, ease: EASE }}
                />

                <motion.div
                  id="mobile-bottomsheet"
                  role="dialog"
                  aria-modal="true"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: DUR.md, ease: EASE }}
                  className="absolute inset-x-0 bottom-0"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto w-full max-w-[720px] px-3">
                    <div className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.16)] ring-1 ring-black/10">
                      <div className="pt-3 pb-2">
                        <div className="mx-auto h-1.5 w-12 rounded-full bg-black/15" />
                      </div>

                      <div className="px-5 pb-4">
                        <div className="flex flex-col">
                          {[
                            { label: "Recursos", id: "features" },
                            { label: "Saiba Mais", id: "how-it-works" },
                            { label: "Planos", id: "pricing" },
                            { label: "Termos", id: "faq" },
                          ].map((item) => (
                            <a
                              key={item.id}
                              href={`#${item.id}`}
                              onClick={scrollToId(item.id)}
                              className="py-3 text-[15px] font-medium text-black/80 hover:text-black transition"
                            >
                              {item.label}
                            </a>
                          ))}

                          <div className="h-px w-full bg-black/10 my-2" />

                          <a
                            href="https://login.wyzer.com.br/"
                            onClick={() => setMobileNavOpen(false)}
                            className="py-3 text-[15px] font-medium text-black/65 hover:text-black transition"
                          >
                            Fazer login
                          </a>

                          <motion.a
                            href="#pricing"
                            onClick={scrollToId("pricing")}
                            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                            transition={{ duration: DUR.sm, ease: EASE }}
                            className="group relative mt-2 inline-flex items-center justify-center bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu"
                            style={{ willChange: "transform" }}
                          >
                            <span className="relative z-10">Criar conta</span>
                            <motion.span
                              whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                              transition={{ duration: DUR.sm, ease: EASE }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-white/10 rounded-full p-3 transition-all duration-300 ease-out group-hover:translate-x-0.5"
                            >
                              <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                            </motion.span>
                          </motion.a>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: DUR.lg, ease: EASE, delay: 0.08 }}
            className="mt-0 sm:mt-0"
          >
            <div className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0" />

              {/* Top copy */}
              <div className="relative px-5 sm:px-8 md:px-12 pt-10 sm:pt-12 md:pt-14 pb-8 sm:pb-30 text-center">
                {/* ✅ TAG: mesmo estilo das tags dos cards */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DUR.lg, ease: EASE }}
                  className="inline-flex items-center rounded-full bg-white px-2 py-1 text-[11px] font-semibold tracking-wide text-black/70 ring-1 ring-black/5 transform-gpu"
                  style={{ willChange: "transform" }}
                >
                  <span className="mr-2 h-5 w-5 rounded-full grid place-items-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M12 2l1.2 5.1L18 8.3l-4.4 2.8L14.8 16 12 13.4 9.2 16l1.2-4.9L6 8.3l4.8-1.2L12 2Z"
                        fill="currentColor"
                        opacity=".85"
                      />
                      <path
                        d="M12 2l1.2 5.1L18 8.3l-4.4 2.8L14.8 16 12 13.4 9.2 16l1.2-4.9L6 8.3l4.8-1.2L12 2Z"
                        stroke="currentColor"
                        strokeWidth="1.1"
                      />
                    </svg>
                  </span>
                  Reduza o tempo de resposta em <span className="text-black/90">&nbsp;85%</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DUR.xl, ease: EASE, delay: 0.05 }}
                  className="mt-6 text-black/90 tracking-tight font-semibold leading-[1.04] text-[2.15rem] sm:text-[2.7rem] md:text-[3.35rem]"
                >
                  Gere atendimentos envolventes
                  <br />
                  prontos para vender.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DUR.lg, ease: EASE, delay: 0.12 }}
                  className="mx-auto mt-4 max-w-2xl text-black/55 text-[14.5px] sm:text-[15.5px] leading-relaxed"
                >
                  Automatize conversas, capture leads, organize o funil e colabore com facilidade — com IA de nível
                  enterprise que entende contexto e entrega respostas consistentes.
                </motion.p>

                {/* ✅ BOTÕES: padrão do input preto (mesmo hover/arrow) */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DUR.lg, ease: EASE, delay: 0.18 }}
                  className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
                >
                  <motion.a
                    href="#pricing"
                    onClick={scrollToId("pricing")}
                    whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                    transition={{ duration: DUR.sm, ease: EASE }}
                    className="group relative w-full sm:w-auto bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu"
                    style={{ willChange: "transform" }}
                  >
                    <span className="relative z-10">Começar teste grátis</span>
                    <motion.span
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                      transition={{ duration: DUR.sm, ease: EASE }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-white/10 rounded-full p-3 transition-all duration-300 ease-out group-hover:translate-x-0.5"
                    >
                      <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                    </motion.span>
                  </motion.a>

                  <motion.a
                    href="#how-it-works"
                    onClick={scrollToId("how-it-works")}
                    whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                    transition={{ duration: DUR.sm, ease: EASE }}
                    className="group relative w-full sm:w-auto bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu"
                    style={{ willChange: "transform" }}
                  >
                    <span className="relative z-10">Ver Demo</span>
                    <motion.span
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                      transition={{ duration: DUR.sm, ease: EASE }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-white/10 rounded-full p-3 transition-all duration-300 ease-out group-hover:translate-x-0.5"
                    >
                      <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                    </motion.span>
                  </motion.a>
                </motion.div>
              </div>

             
            </div>
          </motion.div>
        </div>
      </section>

      {/* ✅ CARD FLUTUANTE: aparece ao sair do HERO e segue a pessoa */}
      <AnimatePresence initial={false} mode="sync" presenceAffectsLayout={false}>
        {showStickyCta && (
          <motion.div
            variants={stickyWrapVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
              willChange: "transform, opacity",
              contain: "layout paint",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <div className="mx-auto w-full max-w-[640px] px-4">
              <motion.div
                whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.003 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.997 }}
                transition={{ duration: DUR.md, ease: EASE }}
                className="pointer-events-auto relative transform-gpu"
                style={{ willChange: "transform", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
              >
                <motion.div
                  variants={stickyCardVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="bg-black rounded-[40px] px-6 sm:px-10 md:px-10 pt-6 pb-0 w-full max-w-[600px] mt-2 relative z-10 transition-all duration-500 ease-out flex flex-col ring-1 ring-white/10 transform-gpu"
                  style={{
                    willChange: "transform, opacity",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                >
  {/* ✅ ILHA DINÂMICA: o mesmo card se transforma (Cookies ↔ Signup) */}
                  <motion.div
    className="flex flex-col "
    style={{
      // ✅ trava no tamanho do "Criar conta" (evita o card crescer antes da troca)
      height: stickyIslandHeight ? `${stickyIslandHeight}px` : undefined,
      willChange: "height",
      backfaceVisibility: "hidden",
      WebkitBackfaceVisibility: "hidden",
    }}
                  >
                   <AnimatePresence initial={false} mode="wait">
                       {shouldShowCookiesInSticky ? (
   <motion.div
  key="cookie"
  variants={cookiePanelVariants}
  initial="initial"
  animate={cookieExiting ? "drop" : "show"}
  exit="exit"
  style={{
    willChange: "transform, opacity, filter",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  }}
>
  {/* ✅ não deixa o conteúdo empurrar a altura do card */}
  <div className="h-full pr-1" style={{ scrollbarGutter: "stable" }}>
    <h2 className="text-white mb-1.5 text-[1.35rem] sm:text-[1.65rem] md:text-[1.5rem] font-medium tracking-tight">
      Consentimento de Cookies
    </h2>

    <p className="text-[#8a8a8a] text-[12px] sm:text-[13px] font-medium mb-3">
      Usamos cookies para melhorar sua experiência, segurança e desempenho.
    </p>

    <p className="text-white/70 text-[12px] sm:text-[13px] leading-relaxed">
      Ao continuar navegando, você concorda com o uso de cookies conforme nossa política.
      Você pode ajustar suas preferências no navegador a qualquer momento.
    </p>

    <div className="mt-4 pb-4">
      <motion.button
        type="button"
        onClick={acceptCookies}
        disabled={cookieAccepting}
        whileHover={prefersReducedMotion || cookieAccepting ? undefined : { y: -2, scale: 1.01 }}
        whileTap={prefersReducedMotion || cookieAccepting ? undefined : { scale: 0.98 }}
        transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
        className={[
          "group relative w-full bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white",
          "hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out",
          "text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu",
          cookieAccepting ? "opacity-80" : "",
        ].join(" ")}
        style={{ willChange: "transform" }}
      >
        <span className="relative z-10">{cookieAccepting ? "Confirmando..." : "Entendi e continuar"}</span>

        <motion.span
          whileHover={prefersReducedMotion || cookieAccepting ? undefined : { scale: 1.06 }}
          whileTap={prefersReducedMotion || cookieAccepting ? undefined : { scale: 0.96 }}
          transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-white/10 rounded-full p-3 transition-all duration-300 ease-out group-hover:translate-x-0.5"
        >
          <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
        </motion.span>
      </motion.button>
    </div>
  </div>
</motion.div>
                      ) : (
<motion.div
  key="signup"
  variants={signupPanelVariants}
  initial="initial"
  animate="show"
  exit="exit"
  style={{
    willChange: "transform, opacity, filter",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  }}
>
  {/* ✅ mede a altura real do signup pra travar o card */}
  <div ref={signupMeasureRef}>
    <h2 className="text-white mb-1.5 text-[1.6rem] sm:text-[2rem] md:text-[1.7rem] font-medium t43g">
      Crie sua conta gratuitamente
    </h2>

    <p className="text-[#8a8a8a] text-[12px] sm:text-[13px] md:text-[0.7rem] font-medium t43g mb-5">
      Você concorda em receber e-mails de marketing.
    </p>

<div className="mt-auto pb-3">
  <form
    onSubmit={(e) => {
      e.preventDefault();
      goToLoginWithEmail(email);
    }}
    className="relative group w-full sm:w-[calc(100%+60px)] sm:-mx-[30px]"
  >
    <input
      type="email"
      inputMode="email"
      autoComplete="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Digite seu e-mail"
      className="w-full bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white placeholder-[#6a6a6a] focus:outline-none hover:border-[#6a6a6a] focus:border-lime-400 pr-16 transition-all duration-300 ease-out text-base"
    />

    <motion.button
      type="submit"
      whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: DUR.sm, ease: EASE }}
      className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent hover:bg-white/10 rounded-full p-3 transition-all duration-300 ease-out group-hover:translate-x-0.5"
      aria-label="Continuar"
    >
      <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
    </motion.button>
  </form>
</div>
  </div>
</motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brand Logos Section */}
      <section className="bg-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            variants={fadeUp}
            transition={{ duration: DUR.lg, ease: EASE }}
            className="hidden md:flex flex-wrap items-center justify-center gap-8 md:gap-12 lg:gap-16"
          >
            {logos.map((l, i) => (
              <motion.img
                key={i}
                src={l.src}
                alt={l.alt}
                className={`${l.className} opacity-90 hover:opacity-100 transition`}
                loading="lazy"
                decoding="async"
                whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.015 }}
                transition={{ duration: DUR.sm, ease: EASE }}
              />
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: DUR.lg, ease: EASE }}
            className="md:hidden relative"
          >
            <div className="relative overflow-hidden">
              <motion.div
                className="flex items-center gap-10 pr-10 transform-gpu"
                style={{ width: "max-content", willChange: "transform" }}
                animate={prefersReducedMotion ? undefined : { x: ["0%", "-50%"] }}
                transition={prefersReducedMotion ? undefined : { duration: 18, ease: "linear", repeat: Infinity }}
              >
                {[...logos, ...logos].map((l, i) => (
                  <motion.div
                    key={i}
                    className="shrink-0"
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -1 }}
                    transition={{ duration: DUR.md, ease: EASE }}
                  >
                    <img
                      src={l.src}
                      alt={l.alt}
                      className={`${l.className} opacity-80`}
                      loading="lazy"
                      decoding="async"
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ✅ 4 Cards Section */}
      <section id="features" className="bg-white pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-14">
            <FeatureCard
              tag="FLUXOS PERSONALIZÁVEIS"
              title="Crie um fluxo incrível em segundos"
              desc="Com os modelos já prontos, é fácil e rápido dar o pontapé inicial no seu atendimento."
              visual="themes"
              delay={0.05}
            />
            <FeatureCard
              tag="ATENDIMENTO OTIMIZADO"
              title="Venda mais com o melhor atendimento do mundo"
              desc="Uma conversão 15% maior significa que você pode vender mais no WhatsApp do que em outros canais."
              visual="checkout"
              delay={0.12}
            />
            <FeatureCard
              tag="CONHEÇA O WYZEAI"
              title="Turbine seus negócios com um atendente de IA"
              desc="Atender é fácil com um parceiro de negócios integrado que pode ajudar a ampliar sua visão."
              visual="ai"
              delay={0.18}
            />
            <FeatureCard
              tag="SEMPRE DISPONÍVEL"
              title="Resposta sempre que você precisar"
              desc="A Wyzer oferece assistência 24 horas por dia, todos os dias. Assim, sua empresa está sempre operando de modo ideal."
              visual="support"
              delay={0.25}
            />
          </div>

          {/* ✅ QUOTE + CTA + FAQ */}
          <motion.div
            id="how-it-works"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: DUR.lg, ease: EASE, delay: 0.06 }}
            className="mt-16 md:mt-40"
          >
            <div className="h-px w-full bg-black/10" />

            <div className="pt-12 md:pt-14">
              <motion.blockquote
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: DUR.lg, ease: EASE, delay: 0.08 }}
                className="text-[30px] sm:text-[34px] md:text-[44px] leading-[1.05] tracking-tight font-medium text-black max-w-5xl"
              >
                <span className="select-none">“</span>
                O negócio que depende da sua presença constante para funcionar não é uma empresa, é uma prisão de luxo. A
                verdadeira maestria não está em fazer tudo, mas em construir o que faz por você.
                <span className="select-none">”</span>
              </motion.blockquote>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: DUR.lg, ease: EASE, delay: 0.12 }}
                className="mt-6 text-[16px] text-black/55"
              >
                Murilo Giroldo, CEO e Owner
              </motion.div>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: DUR.lg, ease: EASE, delay: 0.16 }}
                className="mt-12 md:mt-16"
              >
                <motion.div
                  id="pricing"
                  whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.004 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
                  transition={{ duration: DUR.md, ease: EASE }}
                  className="relative overflow-hidden rounded-[28px] px-6 md:px-10 py-12 md:py-14 bg-[#99e600] text-center shadow-[0_22px_70px_rgba(0,0,0,0.10)] transform-gpu"
                  style={{ willChange: "transform" }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-white/0 to-black/50" />
                  <div className="pointer-events-none absolute -top-28 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-white/10 blur-[120px]" />
                  <div className="pointer-events-none absolute -bottom-40 right-10 h-[520px] w-[520px] rounded-full bg-lime-400/40 blur-[140px]" />

                  <div className="relative z-10 mx-auto max-w-[860px] text-white">
                    <div className="text-[24px] sm:text-[26px] md:text-[40px] leading-tight font-medium tracking-tight">
                      Sem riscos, só resultados.
                      <br />
                      Experimente a Wyzer hoje.
                    </div>

                    <div className="mt-8 flex justify-center">
                     <form
  onSubmit={(e) => {
    e.preventDefault();
    goToLoginWithEmail(email);
  }}
  className="relative w-full max-w-[520px]"
>
  <input
    type="email"
    inputMode="email"
    autoComplete="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="Digite seu e-mail"
    className="w-full bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white placeholder-[#6a6a6a] focus:outline-none hover:border-[#6a6a6a] focus:border-lime-400 pr-16 transition-all duration-300 ease-out text-base"
  />

  <motion.button
    type="submit"
    whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
    transition={{ duration: DUR.sm, ease: EASE }}
    className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent hover:bg-white/10 rounded-full p-3 transition-all duration-300 ease-out"
    aria-label="Continuar"
  >
    <ArrowRight className="w-5 h-5 text-white" />
  </motion.button>
</form>
                    </div>

                    <div className="mt-4 text-[12px] text-white/60">Você concorda em receber e-mails de marketing.</div>
                  </div>
                </motion.div>
              </motion.div>

              {/* ✅ PRICING (igual da imagem) — acima do "Alguma dúvida?" */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: DUR.lg, ease: EASE, delay: 0.18 }}
                className="mt-14 md:mt-20"
              >
                <div className="max-w-full">
                  <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] gap-10 items-start">
                    <div>
                      <div className="text-[34px] sm:text-[40px] md:text-[52px] leading-[1.04] tracking-tight font-semibold text-black">
                        Nós temos planos perfeitos
                        <br />
                        para sua equipe.
                      </div>
                      <div className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-black/55 max-w-[600px]">
                        Potencialize seus atendimentos com planos feitos para equipes de todos os tamanhos.
                        Adiquira seu plano com a 1° mensalidade grátis!
                      </div>
                    </div>

                    <div className="hidden lg:block" />
                  </div>

{/* Cards */}
                  <div className="mt-10 md:mt-12">
                    {/* ✅ Mesma grid da tabela: 1 coluna (features) + 3 colunas (plans)
                        ✅ No desktop fica perfeitamente alinhado “em cima de cada coisa” */}
                    <div className="">
                      <div className="mx-auto w-full max-w-[1120px] md:min-w-[1100px]">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-[minmax(284px,1.2fr)_minmax(260px,1fr)_minmax(260px,1fr)_minmax(260px,1fr)] md:gap-x-6 items-stretch md:items-start">
                          {/* placeholder da coluna de features (só no desktop) */}
                          <div className="hidden md:block" />

                          {/* Core */}
                          <motion.div
                            whileHover={prefersReducedMotion ? undefined : { y: -3, scale: 1.01 }}
                            whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
                            transition={{ duration: DUR.md, ease: EASE }}
                            className="relative rounded-[18px] bg-white ring-1 ring-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.06)] transform-gpu"
                            style={{ willChange: "transform" }}
                          >
                            <div className="p-6 flex flex-col h-full">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="text-[14px] font-semibold text-black/85">Core Plan</div>
                                    <Tooltip
                                      id="tip-plan-core"
                                      text="Plano ideal para começar com seu time e operar o básico com consistência."
                                    />
                                  </div>
                                  <div className="text-[12px] text-black/45 mt-0.5">1° Mensalidade Gratuita</div>
                                </div>
                              </div>

                              <div className="mt-7">
                                <div className="flex items-end gap-2">
                                  <div className="text-[36px] font-semibold tracking-tight text-black">R$89,90</div>
                                  <div className="pb-1 text-[13px] text-black/50">/mensal</div>
                                </div>
                              </div>

                              <div className="mt-auto pt-4">
                                <PricingButton label="Selecionar Plano" variant="light" />
                              </div>
                            </div>
                          </motion.div>

                          {/* Growth (Popular) */}
                          <motion.div
                            whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.015 }}
                            whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
                            transition={{ duration: DUR.md, ease: EASE }}
                            className="relative rounded-[20px] bg-black ring-1 ring-white/10 transform-gpu"
                            style={{ willChange: "transform" }}
                          >

                            <div className="relative p-6 flex flex-col h-full">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="text-[14px] font-semibold text-white/90">Growth Plan</div>
                                    <Tooltip
                                      id="tip-plan-growth"
                                      tone="dark"
                                      text="Mais automações e integrações para times em crescimento e operação avançada."
                                    />
                                  </div>
                                  <div className="text-[12px] text-white/45 mt-0.5">Empresas Medias</div>
                                </div>

                                <div className="inline-flex items-center rounded-full bg-lime-400 px-3 py-1 text-[11px] font-semibold text-black/80 shadow-sm">
                                  POPULAR
                                </div>
                              </div>

                              <div className="mt-7">
                                <div className="mt-1 flex items-end gap-2">
                                  <div className="text-[38px] font-semibold tracking-tight text-white">R$119,90</div>
                                  <div className="pb-1 text-[13px] text-white/45">/mensal</div>
                                </div>
                              </div>

                              <div className="mt-auto pt-4">
                                <PricingButton label="Selecionar Plano" variant="lime" />
                              </div>
                            </div>
                          </motion.div>

                          {/* Unlimited */}
                          <motion.div
                            whileHover={prefersReducedMotion ? undefined : { y: -3, scale: 1.01 }}
                            whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
                            transition={{ duration: DUR.md, ease: EASE }}
                            className="relative rounded-[18px] bg-white ring-1 ring-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.06)] transform-gpu"
                            style={{ willChange: "transform" }}
                          >
                            <div className="p-6 flex flex-col h-full">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="text-[14px] font-semibold text-black/85">Pro Plan</div>
                                    <Tooltip
                                      id="tip-plan-unlimited"
                                      text="Para operações maiores: limites amplos e tudo liberado."
                                    />
                                  </div>
                                  <div className="text-[12px] text-black/45 mt-0.5">Empresas Grandes</div>
                                </div>
                              </div>

                              <div className="mt-7">
                                <div className="mt-1 flex items-end gap-2">
                                  <div className="text-[36px] font-semibold tracking-tight text-black">199,99</div>
                                  <div className="pb-1 text-[13px] text-black/50">/mensal</div>
                                </div>
                              </div>

                              <div className="mt-auto pt-4">
                                <PricingButton label="Selecionar Plano" variant="light" />
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Overview + table */}
                  <div className="mt-0 md:mt-0">
                    <div className="h-px w-full  " />

                    <div className="mt-8 text-[12px] font-semibold tracking-wide text-black/45">VISÃO GERAL</div>

                    <div className="mt-5">
                      <div className="mx-auto w-full max-w-[1200px] md:min-w-[500px] rounded-[20px] bg-white">
                        <div className="grid grid-cols-[minmax(320px,1.2fr)_minmax(270px,1fr)_minmax(280px,1fr)_minmax(280px,1fr)] border-t border-black/10">


                          {/* Row: Users */}
                          <div className="py-5 pr-6 text-[14px] font-semibold text-black/80 flex items-center gap-2 border-b border-black/10">
                            Números de Telefone
                            <Tooltip id="tip-row-users" text="Quantidade de usuários/assentos incluídos no plano." />
                          </div>
                          <div className="py-5 flex items-center justify-center text-[14px] text-black/60 border-b border-black/10">1</div>
                          <div className="py-5 flex items-center justify-center text-[14px] text-black/60 border-b border-black/10">3</div>
                          <div className="py-5 flex items-center justify-center text-[14px] text-black/60 border-b border-black/10">Unlimited</div>

                          {/* Row: Individual data */}
                          <div className="py-5 pr-6 text-[14px] font-semibold text-black/80 flex items-center gap-2 border-b border-black/10">
                            Atendentes
                            <Tooltip id="tip-row-data" text="Armazenamento por usuário (referência do plano)." />
                          </div>
                          <div className="py-5 flex items-center justify-center text-[14px] text-black/60 border-b border-black/10">2</div>
                          <div className="py-5 flex items-center justify-center text-[14px] text-black/60 border-b border-black/10">10</div>
                          <div className="py-5 flex items-center justify-center text-[14px] text-black/60 border-b border-black/10">Unlimited</div>

                


                          {/* ✅ Rows extras (igual a imagem 2) */}
                          {/* Row: SSO/SAML */}
                          <div className="py-5 pr-6 text-[14px] font-semibold text-black/80 flex items-center gap-2 border-b border-black/10">
                            SSO/SAML authentication
                            <Tooltip id="tip-row-sso" text="Autenticação corporativa (SSO/SAML)." />
                          </div>
                          {[0, 1, 2].map((i) => (
                            <div key={`sso-${i}`} className="py-5 flex items-center justify-center border-b border-black/10">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/5 ring-1 ring-black/10">
                                <CheckIcon className="text-black/80" />
                              </span>
                            </div>
                          ))}

                          {/* Row: Advanced permissions */}
                          <div className="py-5 pr-6 text-[14px] font-semibold text-black/80 flex items-center gap-2 border-b border-black/10">
                            Advanced permissions
                            <Tooltip id="tip-row-perms" text="Permissões avançadas e controles por função." />
                          </div>
                          <div className="py-5 flex items-center justify-center text-[16px] text-black/30 border-b border-black/10">—</div>
                          {[0, 1].map((i) => (
                            <div key={`perm-${i}`} className="py-5 flex items-center justify-center border-b border-black/10">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/5 ring-1 ring-black/10">
                                <CheckIcon className="text-black/80" />
                              </span>
                            </div>
                          ))}


                        </div>
                      </div>
                    </div>

                    {/* ✅ Bottom buttons (Current plan / Upgrade / Upgrade) — alinhados nas colunas */}
                    <div className="mt-8">
                      <div className="mx-auto w-full max-w-[1120px] md:min-w-[1100px]">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6 md:grid-cols-[minmax(284.5px,1.2fr)_minmax(260px,1fr)_minmax(260px,1fr)_minmax(260px,1fr)] md:gap-x-6 items-stretch">
                          <div className="hidden md:block" />

                          <div className="w-full">
                            <PricingButton label="Plano Atual" variant="outline" disabled />
                          </div>

                          <div className="w-full">
                            <PricingButton label="Aprimorar" variant="dark" />
                          </div>

                          <div className="w-full">
                            <PricingButton label="Aprimorar" variant="dark" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                id="faq"
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: DUR.lg, ease: EASE, delay: 0.18 }}
                className="mt-18 md:mt-30"
              >
                <div className="max-w-full">
                  <div className="text-[36px] md:text-[44px] font-medium tracking-tight text-black">Alguma dúvida?</div>

                  <div className="mt-8 border-t border-black/10">
                    {faqs.map((item, idx) => {
                      const isOpen = openFaq === idx;
                      return (
                        <div key={idx} className="border-b border-black/10">
                          <button
                            type="button"
                            onClick={() => setOpenFaq(isOpen ? null : idx)}
                            className="w-full py-6 flex items-center justify-between gap-6 text-left"
                          >
                            <div className="text-[18px] md:text-[20px] text-black">{item.q}</div>

                            <motion.div
                              animate={{ rotate: isOpen ? 45 : 0 }}
                              transition={prefersReducedMotion ? { duration: 0 } : { ...SPRING_SOFT }}
                              className="shrink-0 h-11 w-11 rounded-full bg-black text-white grid place-items-center transform-gpu"
                              aria-hidden
                              style={{ willChange: "transform" }}
                            >
                              <span className="text-[22px] leading-none -mt-[1px]">+</span>
                            </motion.div>
                          </button>

                          <AnimatePresence initial={false} mode="sync" presenceAffectsLayout={false}>
                            {isOpen && (
                              <motion.div
                                key="content"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                  duration: prefersReducedMotion ? 0 : DUR.md,
                                  ease: EASE,
                                  opacity: { duration: prefersReducedMotion ? 0 : 0.14, ease: "linear" },
                                }}
                                className=""
                              >
                                <div className="pb-6 pr-14 md:pr-16 text-[14.5px] md:text-[15.5px] leading-relaxed text-black/60">
                                  {item.a}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ✅ FOOTER igual à imagem (botões no estilo do site) */}
      <footer className="bg-white px-4 pb-10 pt-10 mb-30">
        <div className="mx-auto max-w-[1230px]">
          <div className="px-6 md:px-10 py-12 md:py-16">
            {/* Top CTA row */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT}
              transition={{ duration: DUR.lg, ease: EASE }}
              className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
            >
              <div className="max-w-2xl">
                <div className="text-[34px] md:text-[42px] font-semibold tracking-tight text-black leading-[1.08]">
                  Comece seu teste grátis de 30 dias
                </div>
                <div className="mt-2 text-[16px] md:text-[17px] text-black/55">
                  Junte-se a mais de 4.000 empresas que já crescem com a Wyzer.
                </div>
              </div>

              {/* Buttons (estilo do site) */}
              <div className="flex items-center gap-3 md:pt-1">
                <motion.a
                  href="/contato"
                  whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  transition={{ duration: DUR.sm, ease: EASE }}
                  className="group relative inline-flex items-center justify-center bg-white border border-black/10 rounded-full px-5 py-3 text-black/80 hover:text-black hover:border-black/20 focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out text-[13px] font-semibold shadow-sm"
                >
                  Fale com a gente
                </motion.a>

                <motion.a
                  href="#pricing"
                  onClick={scrollToId("pricing")}
                  whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  transition={{ duration: DUR.sm, ease: EASE }}
                  className="group relative inline-flex items-center justify-center bg-[#171717] border border-[#454545] border-2 rounded-full px-5 py-3 text-white hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out text-[12px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] pr-12 transform-gpu"
                  style={{ willChange: "transform" }}
                >
                  <span className="relative z-10">Começar agora</span>
                  <motion.span
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                    transition={{ duration: DUR.sm, ease: EASE }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-white/10 rounded-full p-2.5 transition-all duration-300 ease-out group-hover:translate-x-0.5"
                  >
                    <ArrowRight className="w-[18px] h-[18px] text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                  </motion.span>
                </motion.a>
              </div>
            </motion.div>

            {/* Middle links */}
            <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-6">
              {/* Brand */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={VIEWPORT}
                transition={{ duration: DUR.lg, ease: EASE, delay: 0.04 }}
                className="lg:col-span-2"
              >
                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 grid place-items-center">
                    <img
                      src="https://imgur.com/z8a0w1p.png"
                      alt="Wyzer"
                      className="h-20 w-20 object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>

                <div className="mt-4 max-w-[320px] text-[14px] leading-relaxed text-black/55">
                  Automatize experiências inteligentes no WhatsApp e crie momentos melhores para seus clientes.
                </div>
              </motion.div>

              {/* Columns */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={VIEWPORT}
                transition={{ duration: DUR.lg, ease: EASE, delay: 0.08 }}
                className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8"
              >
                {footerColumns.map((col) => (
                  <div key={col.title}>
                    <div className="text-[13px] font-semibold text-black/70">{col.title}</div>
                    <div className="mt-4 space-y-3">
                     {col.items.map((it) => {
  // ✅ Tutoriais abre modal (somente ele)
  if (it === "Tutoriais") {
    return (
      <a
        key={it}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          openTutorials();
        }}
        className="block text-[14px] text-black/55 hover:text-black transition"
      >
        {it}
      </a>
    );
  }

  const href = footerHref(col.title, it);
  const isHash = href.startsWith("#");
  const handle = isHash ? scrollToId(href.replace("#", "")) : undefined;
  const external = isExternal(href);

  return (
    <a
      key={it}
      href={href}
      onClick={handle}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="block text-[14px] text-black/55 hover:text-black transition"
    >
      {it}
    </a>
  );
})}
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={VIEWPORT}
              transition={{ duration: DUR.lg, ease: EASE, delay: 0.1 }}
              className="mt-16 h-px w-full bg-black/10"
            />

            {/* Bottom row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: DUR.lg, ease: EASE, delay: 0.12 }}
              className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-[12px] text-black/45">© 2025-{new Date().getFullYear()} Wyzer. Todos os direitos reservados.</div>

              <div className="flex items-center gap-4 text-black/45">

<a
  href="https://instagram.com"
  target="_blank"
  rel="noreferrer"
  aria-label="Instagram"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="https://cdn.brandfetch.io/ido5G85nya/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1724650641044" 
    alt="Instagram Logo" 
    className="w-[18px] h-[18px]" 
  />
</a>

<a
  href="https://facebook.com"
  target="_blank"
  rel="noreferrer"
  aria-label="Facebook"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="/lg/socials/facebook-fill-svgrepo-com.svg" 
    alt="Facebook Logo" 
    className="w-[19px] h-[19px]" 
  />
</a>


<a
  href="https://tiktok.com"
  target="_blank"
  rel="noreferrer"
  aria-label="TikTok"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="/lg/socials/1946552.png" 
    alt="TikTok Logo" 
    className="w-[18px] h-[18px]" 
  />
</a>


<a
  href="https://x.com"
  target="_blank"
  rel="noreferrer"
  aria-label="X"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="https://cdn.brandfetch.io/idS5WhqBbM/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1692089092800" 
    alt="X Logo" 
    className="w-[18px] h-[18px]" 
  />
</a>


<a
  href="https://yt.be"
  target="_blank"
  rel="noreferrer"
  aria-label="YouTube"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="https://cdn.brandfetch.io/idVfYwcuQz/theme/dark/idNobVnGbv.svg?c=1bxid64Mup7aczewSAYMX&t=1728452971949" 
    alt="YouTube Logo" 
    className="w-[18px] h-[18px]" 
  />
</a>

<a
  href="https://github.com"
  target="_blank"
  rel="noreferrer"
  aria-label="GitHub"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="https://cdn.brandfetch.io/idZAyF9rlg/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1719469980739" 
    alt="GitHub Logo" 
    className="w-[18px] h-[18px]" 
  />
</a>

<a
  href="https://linkedin.com"
  target="_blank"
  rel="noreferrer"
  aria-label="LinkedIn"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="https://cdn.brandfetch.io/idJFz6sAsl/theme/dark/idtEseDv1X.svg?c=1bxid64Mup7aczewSAYMX&t=1740370996685" 
    alt="LinkedIn Logo" 
    className="w-[18px] h-[18px]" 
  />
</a>

<a
  href="https://figma.com"
  target="_blank"
  rel="noreferrer"
  aria-label="Figma"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="https://cdn.brandfetch.io/idZHcZ_i7F/theme/dark/idBr_UC1yQ.svg?c=1bxid64Mup7aczewSAYMX&t=1729268225036" 
    alt="Figma Logo" 
    className="w-[18px] h-[18px]" 
  />
</a>

<a
  href="https://dribble.com"
  target="_blank"
  rel="noreferrer"
  aria-label="Dribbble"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="https://cdn.brandfetch.io/idARbzjU7f/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1720436984659" 
    alt="Dribbble Logo" 
    className="w-[18px] h-[18px]" 
  />
</a>

<a
  href="https://behance.net"
  target="_blank"
  rel="noreferrer"
  aria-label="Behance"
  className="hover:opacity-70 transition flex items-center justify-center"
>
  <img 
    src="https://cdn.brandfetch.io/idxhowbknc/theme/dark/idUxYZKb0h.svg?c=1bxid64Mup7aczewSAYMX&t=1758076755301" 
    alt="Behance Logo" 
    className="w-[18px] h-[18px]" 
  />
</a>
              </div>
            </motion.div>
          </div>
        </div>
      </footer>

{/* ✅ MODAL TUTORIAIS (Apple-like) */}
<AnimatePresence initial={false} mode="sync">
  {tutorialsOpen && (
    <motion.div
      className="fixed inset-0 z-[95]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "linear" }}
    >
      {/* overlay + blur (clicar fora fecha) */}
      <motion.button
        type="button"
        aria-label="Fechar tutoriais"
        className="absolute inset-0 h-full w-full bg-black/55 backdrop-blur-[10px]"
        onClick={closeTutorials}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "linear" }}
      />

      {/* ✅ X fora do modal (canto superior direito) */}
      <motion.button
        type="button"
        onClick={closeTutorials}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
        transition={{ duration: DUR.sm, ease: EASE }}
        className="absolute right-4 top-4 sm:right-6 sm:top-6 z-[96] h-11 w-11 rounded-full bg-white/10 hover:bg-white/14 ring-1 ring-white/10 grid place-items-center text-white/90 transform-gpu"
        aria-label="Fechar"
        style={{
          willChange: "transform",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </motion.button>

      {/* painel */}
      <div
        className="absolute inset-0 flex items-center justify-center px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 14, scale: 0.99, filter: "blur(10px)" }}
          transition={prefersReducedMotion ? { duration: 0 } : { ...SPRING_SOFT }}
          className="w-full max-w-[980px] rounded-[40px] bg-black ring-1 ring-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.40)] overflow-hidden transform-gpu"
          style={{
            willChange: "transform, opacity, filter",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {/* ✅ apenas o vídeo */}
          <div className="p-1 sm:p-5">
            <div className="relative w-full overflow-hidden rounded-[28px] bg-black">
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={TUTORIALS_YT_URL}
                  title="Tutoriais Wyzer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )}
</AnimatePresence>
    </div>
  );
}
