"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export default function LoginPage() {
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

  const SPRING_SOFT = useMemo(
    () =>
      prefersReducedMotion
        ? ({ duration: 0 } as const)
        : ({
            type: "spring",
            stiffness: 520,
            damping: 46,
            mass: 0.9,
          } as const),
    [prefersReducedMotion]
  );

  const SPRING_SNAP = useMemo(
    () =>
      prefersReducedMotion
        ? ({ duration: 0 } as const)
        : ({
            type: "spring",
            stiffness: 620,
            damping: 54,
            mass: 0.85,
          } as const),
    [prefersReducedMotion]
  );

  const fadeUp = useMemo(
    () => ({
      hidden: { opacity: 0, y: 14 },
      show: { opacity: 1, y: 0 },
    }),
    []
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Seu handler de login aqui
    // ex.: await signIn("credentials", { email, password })
  };

const ProviderMark = ({ type }: { type: "google" | "microsoft" }) => {
  if (type === "google") {
    return (
      <img
        src="https://cdn.brandfetch.io/id6O2oGzv-/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1755835725776"
        alt="Google"
        width={18}
        height={18}
        className="h-[18px] w-[18px] object-contain"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <img
      src="https://cdn.brandfetch.io/idchmboHEZ/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1727706673120"
      alt="Microsoft"
      width={18}
      height={18}
      className="h-[18px] w-[18px] object-contain"
      loading="lazy"
      decoding="async"
    />
  );
};


  const EyeIcon = ({ open }: { open: boolean }) => {
    return open ? (
      // Eye open (clean / pro)
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="text-black/70">
        <path
          d="M2.25 12s3.75-7.5 9.75-7.5S21.75 12 21.75 12s-3.75 7.5-9.75 7.5S2.25 12 2.25 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      // Eye closed (mesmo olho + traço)
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="text-black/70">
        <path
          d="M2.25 12s3.75-7.5 9.75-7.5S21.75 12 21.75 12s-3.75 7.5-9.75 7.5S2.25 12 2.25 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
        <path
          d="M4 20L20 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  const AuthButton = ({
    label,
    variant = "light",
    icon,
    onClick,
    className,
    type = "button",
    disabled = false,
    noArrow = false,
    iconLeft = false,
    centerLabel = false,
    rounded = "full",
  }: {
    label: string;
    variant?: "light" | "outline";
    icon?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    type?: "button" | "submit";
    disabled?: boolean;
    noArrow?: boolean;
    iconLeft?: boolean;
    centerLabel?: boolean;
    rounded?: "full" | "xl";
  }) => {
    const base =
      "group relative inline-flex w-full items-center justify-center px-5 py-4 text-[13px] font-semibold transition-all duration-300 ease-out transform-gpu select-none";

    const rounding = rounded === "xl" ? "rounded-2xl" : "rounded-full";

    const variants =
      variant === "outline"
        ? "bg-white text-black/75 border border-black/10 hover:border-black/20 shadow-[0_10px_26px_rgba(0,0,0,0.05)]"
        : "bg-white text-black border border-black/10 hover:border-black/20 shadow-[0_12px_30px_rgba(0,0,0,0.06)]";

    return (
      <motion.button
        type={type}
        onClick={onClick}
        disabled={disabled}
        whileHover={disabled || prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
        whileTap={disabled || prefersReducedMotion ? undefined : { scale: 0.985 }}
        transition={prefersReducedMotion ? { duration: 0 } : { ...SPRING_SOFT }}
        className={[
          base,
          rounding,
          variants,
          disabled ? "opacity-70 pointer-events-none" : "",
          noArrow ? "pr-5" : "pr-16",
          className ?? "",
        ].join(" ")}
        style={{
          willChange: "transform",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        {iconLeft && icon ? (
          <motion.span
            whileHover={disabled || prefersReducedMotion ? undefined : { scale: 1.06 }}
            whileTap={disabled || prefersReducedMotion ? undefined : { scale: 0.96 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.sm, ease: EASE }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-3 transition-all duration-300 ease-out bg-transparent group-hover:bg-black/5"
          >
            <span className="grid place-items-center text-black">{icon}</span>
          </motion.span>
        ) : null}

        <span
          className={[
            "relative z-10 inline-flex items-center gap-2",
            centerLabel ? "w-full justify-center text-center" : "",
          ].join(" ")}
        >
          <span>{label}</span>
        </span>

        {!noArrow ? (
          <motion.span
            whileHover={disabled || prefersReducedMotion ? undefined : { scale: 1.06 }}
            whileTap={disabled || prefersReducedMotion ? undefined : { scale: 0.96 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.sm, ease: EASE }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-3 transition-all duration-300 ease-out bg-transparent group-hover:bg-black/5 group-hover:translate-x-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="text-black">
              <path
                d="M13.5 5.5L20 12l-6.5 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 12h15.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </motion.span>
        ) : null}
      </motion.button>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-white overflow-hidden">
      {/* Background soft blobs */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DUR.xl, ease: EASE }}
        className="pointer-events-none fixed inset-0"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.35, ease: EASE }}
          className="absolute -top-56 -left-64 h-[620px] w-[620px] rounded-full bg-[#99e600]/12 blur-[160px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.45, ease: EASE, delay: 0.05 }}
          className="absolute -top-64 right-[-120px] h-[680px] w-[680px] rounded-full bg-black/5 blur-[180px]"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 0 } : { opacity: [0.08, 0.14, 0.08] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 6.5, ease: "linear", repeat: Infinity }}
          className="absolute inset-x-0 top-[10%] mx-auto h-[220px] w-[680px] rounded-full bg-black/5 blur-[120px]"
        />
      </motion.div>

      {/* Full split screen */}
      <div className="relative z-10 min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT: video (✅ cortado/contido pra nunca gerar scroll) */}
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE }}
          className="relative overflow-hidden lg:min-h-[100dvh] lg:h-[100dvh]"
        >
          {/* ✅ força container a não estourar altura */}
          <div className="relative h-[210px] sm:h-[260px] lg:h-full overflow-hidden">
            {/* ✅ “corte” do vídeo: usamos absolute + inset + object-cover + scale levinho */}
            <motion.video
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              initial={{ scale: 1.06 }}
              animate={prefersReducedMotion ? { scale: 1.02 } : { scale: 1.03 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.2, ease: EASE }}
              style={{ willChange: "transform" }}
            >
              <source src="/videos/buttons/pifg490304m09fg439gh4390yt.mp4" type="video/mp4" />
            </motion.video>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-black/5 to-black/20 lg:bg-gradient-to-r lg:from-black/15 lg:via-black/10 lg:to-transparent" />
          </div>
        </motion.aside>

        {/* RIGHT */}
        <main className="relative flex items-center justify-center px-4 sm:px-6 lg:px-12 lg:py-0 py-7">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-black/5 blur-[140px]" />
          </div>

          {/* ✅ mantém tudo dentro do viewport no desktop */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE }}
            className="relative w-full max-w-[520px] lg:max-h-[100dvh] "
          >
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.xl, ease: EASE, delay: 0.08 }}
              className="text-black/90 tracking-tight font-semibold leading-[1.05] text-[2rem] sm:text-[2.35rem] mt-4 lg:mt-0"
            >
              Entrar
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE, delay: 0.12 }}
              className="mt-2 text-black/55 text-[14.5px] sm:text-[15.5px] leading-relaxed"
            >
              Use seu e-mail e senha ou continue com uma conta corporativa.
            </motion.p>

            {/* Social (✅ não 100% arredondado apenas aqui) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE, delay: 0.16 }}
              className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <AuthButton
                label="Google"
                variant="light"
                icon={<ProviderMark type="google" />}
                iconLeft
                noArrow
                centerLabel
                rounded="xl"
                onClick={() => {}}
              />
              <AuthButton
                label="Microsoft"
                variant="light"
                icon={<ProviderMark type="microsoft" />}
                iconLeft
                noArrow
                centerLabel
                rounded="xl"
                onClick={() => {}}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE, delay: 0.2 }}
              className="mt-7 flex items-center gap-4"
            >
              <div className="h-px flex-1 bg-black/10" />
              <div className="text-[12px] text-black/45">ou</div>
              <div className="h-px flex-1 bg-black/10" />
            </motion.div>

            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE, delay: 0.24 }}
              className="mt-5"
            >
              <div className="space-y-3">
                <div className="relative group">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Digite seu e-mail"
                    className="w-full bg-white border border-black/10 rounded-full px-6 py-4 text-black placeholder-black/35 focus:outline-none hover:border-black/20 focus:border-lime-400 transition-all duration-300 ease-out text-base shadow-[0_12px_30px_rgba(0,0,0,0.05)]"
                    autoComplete="email"
                  />
                </div>

                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full bg-white border border-black/10 rounded-full px-6 py-4 text-black placeholder-black/35 focus:outline-none hover:border-black/20 focus:border-lime-400 pr-14 transition-all duration-300 ease-out text-base shadow-[0_12px_30px_rgba(0,0,0,0.05)]"
                    autoComplete="current-password"
                  />

                  <motion.button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.sm, ease: EASE }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-3 bg-transparent hover:bg-black/5 transition-all duration-300 ease-out"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    <EyeIcon open={showPassword} />
                  </motion.button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="inline-flex items-center gap-2 text-[13px] text-black/55 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-black/20 bg-white text-lime-500 accent-lime-500"
                      onChange={() => {}}
                    />
                    Lembrar de mim
                  </label>

                  <a href="/forgot" className="text-[13px] font-medium text-black/60 hover:text-black/85 transition">
                    Esqueci minha senha
                  </a>
                </div>
              </div>

              <div className="mt-6">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT }}>
                  <AuthButton label="Entrar" variant="light" type="submit" />
                </motion.div>

                <div className="mt-4 text-[12px] text-black/45 leading-relaxed">
                  Ao continuar, você concorda com nossos{" "}
                  <a className="text-black/70 hover:text-black transition" href="/terms">
                    Termos
                  </a>{" "}
                  e{" "}
                  <a className="text-black/70 hover:text-black transition" href="/privacy">
                    Privacidade
                  </a>
                  .
                </div>
              </div>
            </motion.form>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE, delay: 0.28 }}
              className="mt-8"
            >
              <div className="rounded-[22px] bg-[#f4f4f4] ring-1 ring-black/5 px-5 py-4">
                <div className="text-[13px] font-semibold text-black/80">Ainda não tem uma conta?</div>
                <div className="mt-1 text-[13px] text-black/55 leading-relaxed">
                  Crie uma conta em poucos segundos e comece seu teste.
                </div>

                <div className="mt-4">
                  <motion.a
                    href="/signup"
                    whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.sm, ease: EASE }}
                    className="group relative inline-flex w-full items-center justify-center bg-white border border-black/10 rounded-full px-5 py-3 text-black/80 hover:text-black hover:border-black/20 focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out text-[13px] font-semibold shadow-sm pr-12 transform-gpu"
                    style={{ willChange: "transform" }}
                  >
                    <span className="relative z-10">Criar conta</span>
                    <motion.span
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.sm, ease: EASE }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-black/5 rounded-full p-2.5 transition-all duration-300 ease-out group-hover:translate-x-0.5"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="text-black">
                        <path
                          d="M13.5 5.5L20 12l-6.5 6.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4 12h15.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </motion.span>
                  </motion.a>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE, delay: 0.32 }}
              className="mt-8 text-center text-[12px] text-black/45"
            >
              © 2025-{new Date().getFullYear()} Wyzer. Todos os direitos reservados.
            </motion.div>
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        <motion.div
          aria-hidden
          className="hidden lg:block pointer-events-none fixed inset-y-0 left-1/2 w-px bg-black/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.lg, ease: EASE }}
        />
      </AnimatePresence>
    </div>
  );
}
