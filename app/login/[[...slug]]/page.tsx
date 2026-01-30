"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function decodeEmailFromUrlToken(token: string) {
  // base64url -> base64
  const b64 =
    token.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((token.length + 3) % 4);

  const raw = typeof window !== "undefined" ? window.atob(b64) : "";
  // no encoder eu recomendo: btoa(encodeURIComponent(email))
  return decodeURIComponent(raw);
}

export default function LinkLoginPage() {
  const prefersReducedMotion = useReducedMotion();
  const pathname = usePathname();

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

  // ✅ LOGIN
  const [email, setEmail] = useState("");

  // ✅ evita re-preencher em loop
  const tokenConsumedRef = useRef(false);

  // ✅ pega token diretamente do path (sem params)
  const tokenFromRoute = useMemo(() => {
    // no login subdomain, a URL fica /mail/<token> ou /
    // internamente, também pode ficar /login/mail/<token> dependendo do rewrite
    const path = (pathname || "/").trim();

    const parts = path.split("/").filter(Boolean);

    // casos aceitos:
    // /mail/<token>
    // /login/mail/<token> (se alguém cair nessa rota interna)
    if (parts.length >= 2) {
      if (parts[0] === "mail" && parts[1]) return parts[1];
      if (parts[0] === "login" && parts[1] === "mail" && parts[2]) return parts[2];
    }

    return null;
  }, [pathname]);

  useEffect(() => {
    if (!tokenFromRoute) return;
    if (tokenConsumedRef.current) return;

    try {
      // ✅ só preenche se input estiver vazio (não briga com o user)
      if (email.trim().length === 0) {
        const decoded = decodeEmailFromUrlToken(tokenFromRoute);

        if (decoded && decoded.includes("@")) {
          setEmail(decoded);
        }
      }

      tokenConsumedRef.current = true;

      // ✅ remove /mail/<token> da barra
      // assim F5 depois não repõe email automaticamente
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
      }
    } catch {
      tokenConsumedRef.current = true;
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromRoute]);

  const onContinue = useCallback(
    (e?: React.FormEvent | React.MouseEvent) => {
      e?.preventDefault?.();
      // ✅ sua ação aqui
      // console.log("Continuar com:", email);
    },
    [email]
  );

  // ✅ COOKIES
  const COOKIE_KEY = "wyzer_cookie_consent_v1";

  const [cookieReady, setCookieReady] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(false);
  const [cookieAccepting, setCookieAccepting] = useState(false);

  const cookieCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cookieCloseTimerRef.current) {
        window.clearTimeout(cookieCloseTimerRef.current);
        cookieCloseTimerRef.current = null;
      }
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
  }, [COOKIE_KEY]);

  const acceptCookies = useCallback(() => {
    if (cookieAccepting) return;

    setCookieAccepting(true);

    try {
      localStorage.setItem(COOKIE_KEY, "1");
    } catch {}

    try {
      const isHttps = typeof location !== "undefined" && location.protocol === "https:";
      document.cookie = `${COOKIE_KEY}=1; Path=/; Max-Age=31536000; SameSite=Lax${isHttps ? "; Secure" : ""}`;
    } catch {}

    if (cookieCloseTimerRef.current) {
      window.clearTimeout(cookieCloseTimerRef.current);
      cookieCloseTimerRef.current = null;
    }

    cookieCloseTimerRef.current = window.setTimeout(() => {
      setShowCookieConsent(false);
      setCookieAccepting(false);
      cookieCloseTimerRef.current = null;
    }, prefersReducedMotion ? 0 : 220);
  }, [COOKIE_KEY, cookieAccepting, prefersReducedMotion]);

  const cookieWrapVariants = useMemo(
    () => ({
      hidden: {
        opacity: 0,
        y: 22,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.14, ease: "linear" },
              y: { duration: 0.35, ease: EASE },
            },
      },
      show: {
        opacity: 1,
        y: 0,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              delay: 0.06,
              opacity: { duration: 0.18, ease: "linear" },
              y: { duration: 0.55, ease: EASE },
            },
      },
      exit: {
        opacity: 0,
        y: 16,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.14, ease: "linear" },
              y: { duration: 0.35, ease: EASE },
            },
      },
    }),
    [prefersReducedMotion, EASE]
  );

  const cookieCardVariants = useMemo(
    () => ({
      hidden: {
        opacity: 0,
        y: 10,
        filter: "blur(10px)",
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.12, ease: "linear" },
              y: { duration: 0.45, ease: EASE },
              filter: { duration: 0.2, ease: "easeOut" },
            },
      },
      show: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.16, ease: "linear" },
              y: { duration: 0.65, ease: EASE },
              filter: { duration: 0.22, ease: "easeOut" },
            },
      },
      exit: {
        opacity: 0,
        y: 8,
        filter: "blur(10px)",
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.12, ease: "linear" },
              y: { duration: 0.45, ease: EASE },
              filter: { duration: 0.16, ease: "easeIn" },
            },
      },
    }),
    [prefersReducedMotion, EASE]
  );

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Glow discreto */}
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
          transition={{ duration: 1.25, ease: EASE }}
          className="absolute -top-48 -left-56 h-[560px] w-[560px] rounded-full bg-[#99e600]/12 blur-[160px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.35, ease: EASE, delay: 0.05 }}
          className="absolute -top-56 right-[-140px] h-[620px] w-[620px] rounded-full bg-black/6 blur-[170px]"
        />
      </motion.div>

      {/* Centro */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE }}
          className="w-full max-w-[640px]"
          style={{ willChange: "transform, opacity, filter" }}
        >
          <div className="mx-auto w-full max-w-[560px] transform-gpu scale-[1.06] sm:scale-[1.10] md:scale-[1.14] origin-center">
            <div className="text-center">
              <div className="text-black font-semibold tracking-tight text-[28px] sm:text-[32px] md:text-[36px]">
                Bem Vindo de volta a Wyzer!
              </div>
              <div className="mt-2 text-black/55 text-[14px] sm:text-[15px] md:text-[16px]">
                Faça login ou registre-se para começar.
              </div>
            </div>

            <form onSubmit={onContinue} className="mt-10">
              <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    // ✅ se por algum motivo ainda estiver em /mail/<token>, limpa no 1º input
                    if (typeof window !== "undefined" && window.location.pathname.startsWith("/mail/")) {
                      window.history.replaceState({}, "", "/");
                    }
                    setEmail(e.target.value);
                  }}
                  placeholder="E-mail"
                  className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                />
              </div>

              {/* botão continua travado como você queria */}
              <motion.button
                type="submit"
                onClick={onContinue}
                whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                className={cx(
                  "group relative w-full mt-7 bg-[#171717] border border-[#454545] border-2 rounded-full px-15 py-5 text-white",
                  "hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out",
                  "text-[16px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu",
                  "opacity-80 cursor-not-allowed select-none pointer-events-none",
                  "hover:border-[#454545] hover:shadow-[0_18px_55px_rgba(0,0,0,0.12)]"
                )}
                style={{ willChange: "transform" }}
              >
                <span className="relative z-10">Continuar</span>

                <motion.span
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                  transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-white/10 rounded-full p-3 transition-all duration-300 ease-out group-hover:translate-x-0.5"
                >
                  <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                </motion.span>
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>

      {/* Cookies */}
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
            <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
              <div className="w-full flex justify-center">
                <motion.div
                  whileHover={prefersReducedMotion || cookieAccepting ? undefined : { y: -1, scale: 1.003 }}
                  whileTap={prefersReducedMotion || cookieAccepting ? undefined : { scale: 0.997 }}
                  transition={{ duration: prefersReducedMotion ? 0 : DUR.md, ease: EASE }}
                  className="pointer-events-auto relative transform-gpu w-full max-w-[640px]"
                  style={{
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
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
                        disabled={cookieAccepting}
                        whileHover={prefersReducedMotion || cookieAccepting ? undefined : { y: -2, scale: 1.01 }}
                        whileTap={prefersReducedMotion || cookieAccepting ? undefined : { scale: 0.98 }}
                        transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                        className={cx(
                          "group relative w-full bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white",
                          "hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out",
                          "text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu",
                          cookieAccepting ? "opacity-80 cursor-not-allowed" : ""
                        )}
                        style={{ willChange: "transform" }}
                      >
                        <span className="relative z-10">Entendi e continuar</span>

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
