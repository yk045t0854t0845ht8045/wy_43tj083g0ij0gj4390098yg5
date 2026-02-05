"use client";

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  X,
  Undo2,
  Mail,
  Phone,
  Eye,
  EyeOff,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function decodeEmailFromUrlToken(token: string) {
  const b64 =
    token.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((token.length + 3) % 4);

  const raw = typeof window !== "undefined" ? window.atob(b64) : "";
  return decodeURIComponent(raw);
}

function isValidEmail(v: string) {
  const s = v.trim();
  if (s.length < 6) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

function onlyDigits(v: string) {
  return v.replace(/\D+/g, "");
}

function formatCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  if (d.length <= 3) return p1;
  if (d.length <= 6) return `${p1}.${p2}`;
  if (d.length <= 9) return `${p1}.${p2}.${p3}`;
  return `${p1}.${p2}.${p3}-${p4}`;
}

function formatPhoneBR(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const a = d.slice(0, 2);
  const b = d.slice(2, 7);
  const c = d.slice(7, 11);
  if (d.length <= 2) return a ? `(${a}` : "";
  if (d.length <= 7) return `(${a}) ${d.slice(2)}`;
  return `(${a}) ${b}-${c}`;
}

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  if (!d) return email;
  const user =
    u.length <= 2 ? `${u[0] || ""}*` : `${u.slice(0, 2)}***${u.slice(-1)}`;
  const domParts = d.split(".");
  const dom = domParts[0] || d;
  const tld = domParts.slice(1).join(".");
  const domMasked =
    dom.length <= 2
      ? `${dom[0] || ""}*`
      : `${dom.slice(0, 2)}***${dom.slice(-1)}`;
  return `${user}@${domMasked}${tld ? "." + tld : ""}`;
}

function maskPhone(phone: string) {
  const d = onlyDigits(phone);
  if (d.length < 10) return phone;
  const a = d.slice(0, 2);
  const last = d.slice(-2);
  return `(${a}) *****-${last}`;
}

function SpinnerMini({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="inline-flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    >
      <span className="relative h-5 w-5">
        <span className="absolute inset-0 rounded-full border-2 border-black/15" />
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-black/50 border-t-transparent"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={
            reduced
              ? undefined
              : { repeat: Infinity, duration: 0.8, ease: "linear" }
          }
        />
      </span>
    </motion.span>
  );
}

type EmailCheckState =
  | { state: "idle" }
  | { state: "typing" }
  | { state: "checking" }
  | { state: "invalid" }
  | { state: "exists" }
  | { state: "new" }
  | { state: "error"; message: string };

type Step = "collect" | "emailCode" | "emailSuccess" | "smsCode";

function CodeBoxes({
  length,
  value,
  onChange,
  onComplete,
  disabled,
  loading,
  reduced,
}: {
  length: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  loading?: boolean; // ✅ novo
  reduced?: boolean; // ✅ novo (pra girar suave ou não)
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const digits = useMemo(() => {
    const clean = onlyDigits(value).slice(0, length);
    return Array.from({ length }, (_, i) => clean[i] || "");
  }, [value, length]);

  useEffect(() => {
    if (onlyDigits(value).length === length)
      onComplete?.(onlyDigits(value).slice(0, length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  const setAt = (idx: number, ch: string) => {
    const clean = onlyDigits(value).slice(0, length).split("");
    while (clean.length < length) clean.push("");
    clean[idx] = ch;
    const next = clean.join("");
    onChange(next);
  };

  const focus = (idx: number) => refs.current[idx]?.focus();

  return (
    <div className="relative mt-6 flex items-center justify-center gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={d}
          onChange={(e) => {
            if (disabled) return; // ✅ trava também o handler
            const ch = onlyDigits(e.target.value).slice(-1);
            setAt(i, ch);
            if (ch && i < length - 1) focus(i + 1);
          }}
          onKeyDown={(e) => {
            if (disabled) return; // ✅ trava
            if (e.key === "Backspace") {
              if (digits[i]) {
                setAt(i, "");
              } else if (i > 0) {
                focus(i - 1);
                setAt(i - 1, "");
              }
            }
            if (e.key === "ArrowLeft" && i > 0) focus(i - 1);
            if (e.key === "ArrowRight" && i < length - 1) focus(i + 1);
          }}
          onPaste={(e) => {
            if (disabled) return; // ✅ trava
            e.preventDefault();
            const pasted = onlyDigits(
              e.clipboardData.getData("text") || "",
            ).slice(0, length);
            if (!pasted) return;
            onChange(pasted);
            const nextIndex = Math.min(pasted.length, length - 1);
            focus(nextIndex);
          }}
          className={cx(
            "h-14 w-14 rounded-[14px] bg-[#f3f3f3] ring-1 ring-black/5 text-center text-[18px] font-semibold text-black",
            "focus:outline-none focus:ring-2 focus:ring-black/20",
            "transition-all duration-200",
            disabled ? "opacity-70 cursor-not-allowed" : "",
          )}
        />
      ))}

      {/* ✅ Overlay de validação (spinner central) */}
      <AnimatePresence initial={false}>
        {!!loading && (
          <motion.div
            key="codebox-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ pointerEvents: "none" }}
          >
            <div className="absolute inset-0 rounded-[18px] bg-white/55 backdrop-blur-[2px]" />
            <div className="relative z-10">
              <SpinnerMini reduced={!!reduced} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LinkLoginPage() {
  const RETURN_TO_KEY = "wyzer_return_to_v1";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const returnTo = url.searchParams.get("returnTo");

    if (returnTo) {
      try {
        sessionStorage.setItem(RETURN_TO_KEY, returnTo);
      } catch {}
    }
  }, []);

  function consumeReturnTo(): string | null {
    try {
      const v = sessionStorage.getItem(RETURN_TO_KEY);
      if (!v) return null;
      sessionStorage.removeItem(RETURN_TO_KEY);
      return v;
    } catch {
      return null;
    }
  }

  const prefersReducedMotion = useReducedMotion();
  const pathname = usePathname();
  const router = useRouter();

  const EASE = useMemo(() => [0.2, 0.8, 0.2, 1] as const, []);
  const DUR = useMemo(
    () => ({
      xs: 0.18,
      sm: 0.22,
      md: 0.35,
      lg: 0.7,
      xl: 0.9,
    }),
    [],
  );

  // ---------- URL token -> email ----------
  const tokenConsumedRef = useRef(false);

  const tokenFromRoute = useMemo(() => {
    const path = (pathname || "/").trim();
    const parts = path.split("/").filter(Boolean);

    if (parts.length >= 2) {
      if (parts[0] === "mail" && parts[1]) return parts[1];
      if (parts[0] === "login" && parts[1] === "mail" && parts[2])
        return parts[2];
    }
    return null;
  }, [pathname]);

  // ---------- states ----------
  const [step, setStep] = useState<Step>("collect");

  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);

  const [check, setCheck] = useState<EmailCheckState>({ state: "idle" });

  // cadastro (novo)
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");

  // ✅ senha (serve pro login e pro registro)
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // codes
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");

  const [emailSuccessOpen, setEmailSuccessOpen] = useState(false);
  const emailSuccessTimerRef = useRef<number | null>(null);

  // ui states
  const [busy, setBusy] = useState(false);
  const [verifyingEmailCodeBusy, setVerifyingEmailCodeBusy] = useState(false); // ✅ novo (só validação do email code)
  const [verifyingSmsCodeBusy, setVerifyingSmsCodeBusy] = useState(false); // ✅ novo (só validação do sms code)
  const [msgError, setMsgError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const lastCheckedRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  // prefill email from token -> lock + cleanup URL
  useEffect(() => {
    if (!tokenFromRoute) return;
    if (tokenConsumedRef.current) return;

    try {
      if (email.trim().length === 0) {
        const decoded = decodeEmailFromUrlToken(tokenFromRoute);
        if (decoded && decoded.includes("@")) {
          setEmail(decoded);
          setEmailLocked(true); // ✅ veio da URL, já trava o input
          setCheck({ state: "typing" });
        }
      }

      tokenConsumedRef.current = true;

      // remove /mail/<token> da barra (não re-preenche no F5)
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const host = window.location.hostname.toLowerCase();

    const isLoginHost =
      host === "login.wyzer.com.br" ||
      host === "login.localhost" ||
      host === "localhost";

    const isLinkHost = host.startsWith("link.");

    if (isLoginHost || isLinkHost) return;

    (async () => {
      try {
        const r = await fetch("/api/wz_AuthLogin/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!r.ok) return;

        const j = await r.json().catch(() => ({}));
        if (!j?.ok) return;

        const url = new URL(window.location.href);
        const returnTo = url.searchParams.get("returnTo");

        if (returnTo) {
          window.location.assign(returnTo);
          return;
        }

        window.location.assign("/jyj76?create-account");
      } catch {}
    })();
  }, []);

  // cooldown resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(
      () => setResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    return () => {
      if (emailSuccessTimerRef.current) {
        window.clearTimeout(emailSuccessTimerRef.current);
        emailSuccessTimerRef.current = null;
      }
    };
  }, []);

  // email check debounce
  useEffect(() => {
    const value = email.trim().toLowerCase();

    // se estiver locked, ainda assim queremos checar (ex: veio da URL)
    if (value.length === 0) {
      setCheck({ state: "idle" });
      lastCheckedRef.current = "";
      return;
    }

    setCheck({ state: "typing" });

    const t = window.setTimeout(async () => {
      if (!isValidEmail(value)) {
        setCheck({ state: "invalid" });
        return;
      }

      if (lastCheckedRef.current === value) return;

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setCheck({ state: "checking" });

      try {
        const res = await fetch("/api/wz_AuthLogin/email-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({ email: value }),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || "Falha ao verificar e-mail.");
        }

        const data = (await res.json()) as { exists: boolean };

        lastCheckedRef.current = value;

        if (data.exists) {
          setCheck({ state: "exists" });
        } else {
          setCheck({ state: "new" });
        }

        // ✅ animação + trava o email quando válido (modelo Google)
        setEmailLocked(true);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setCheck({
          state: "error",
          message: err?.message || "Erro inesperado.",
        });
      }
    }, 520);

    return () => window.clearTimeout(t);
  }, [email]);

  // reset flow
  const resetAll = useCallback(() => {
    setStep("collect");
    setBusy(false);
    setMsgError(null);
    setResendCooldown(0);

    setEmail("");
    setEmailLocked(false);

    setCheck({ state: "idle" });
    lastCheckedRef.current = "";

    setFullName("");
    setPhone("");
    setCpf("");

    setEmailCode("");
    setSmsCode("");

    // garante URL limpa
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
  }, []);

  // adornment (alinhado perfeito)
  const EmailAdornment = useMemo(() => {
    const s = check.state;

    // ✅ se email locked, mostra botão reset (seta voltar)
    const showReset =
      emailLocked &&
      (s === "exists" || s === "new" || s === "invalid" || s === "error");

    return (
      <div className="h-10 flex items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {s === "checking" && (
            <motion.div
              key="checking"
              initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.18,
                ease: EASE,
              }}
              className="flex items-center justify-center"
            >
              <SpinnerMini reduced={!!prefersReducedMotion} />
            </motion.div>
          )}

          {s === "invalid" && email.trim().length > 0 && (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.18,
                ease: EASE,
              }}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/[0.06]"
            >
              <X className="h-5 w-5 text-black/55" />
            </motion.div>
          )}

          {showReset && (
            <motion.button
              key="reset"
              type="button"
              onClick={resetAll}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.18,
                ease: EASE,
              }}
              className="-mr-[7px] inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/[0.06] hover:bg-black/[0.08] transition-colors cursor-pointer"
              aria-label="Trocar e-mail"
            >
              <Undo2 className="h-5 w-5 text-black/60" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  }, [check.state, emailLocked, email, prefersReducedMotion, EASE, resetAll]);

  const helperText = useMemo(() => {
    if (step === "emailCode") return "Insira o código enviado para seu e-mail.";
    if (step === "smsCode") return "Insira o código enviado por SMS.";
    if (check.state === "checking") return "Verificando seu e-mail…";
    if (check.state === "exists")
      return "Conta encontrada. Vamos confirmar com código.";
    if (check.state === "new")
      return "Novo por aqui? Complete seus dados e confirme o e-mail.";
    if (check.state === "invalid")
      return "Digite um e-mail válido para continuar.";
    if (check.state === "error")
      return "Não conseguimos validar agora. Tente novamente.";
    return "Faça login ou registre-se para começar.";
  }, [check.state, step]);

  const canStart = useMemo(() => {
    const eok = isValidEmail(email.trim());
    if (!eok) return false;
    if (check.state === "checking" || check.state === "typing") return false;

    const okPass = String(password || "").length >= 6; // ajuste se quiser

    if (check.state === "exists") {
      return okPass;
    }

    if (check.state === "new") {
      const okName = fullName.trim().length >= 4;
      const okPhone = onlyDigits(phone).length >= 10;
      const okCpf = onlyDigits(cpf).length === 11;
      return okName && okPhone && okCpf && okPass;
    }

    return false;
  }, [email, check.state, fullName, phone, cpf, password]);

  const startFlow = useCallback(
    async (e?: React.FormEvent | React.MouseEvent) => {
      e?.preventDefault?.();
      if (!canStart || busy) return;

      setBusy(true);
      setMsgError(null);

      try {
        const payload: any = { email: email.trim().toLowerCase() };

        // ✅ sempre manda senha (login e register)
        payload.password = String(password || "");

        if (check.state === "new") {
          payload.fullName = fullName.trim();
          payload.phone = onlyDigits(phone);
          payload.cpf = onlyDigits(cpf);
        }

        const res = await fetch("/api/wz_AuthLogin/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Falha ao iniciar validação.");

        setStep("emailCode");
        setEmailCode("");
        setResendCooldown(35);
      } catch (err: any) {
        setMsgError(err?.message || "Erro inesperado.");
      } finally {
        setBusy(false);
      }
    },
    [canStart, busy, email, check.state, fullName, phone, cpf, password],
  );

  const [phoneMaskFromServer, setPhoneMaskFromServer] = useState<string>("");

  // ✅ Declare returnTo at component level
  const url =
    typeof window !== "undefined" ? new URL(window.location.href) : null;
  const returnTo = url?.searchParams.get("returnTo") || "";

  const verifyEmailCode = useCallback(
    async (code?: string) => {
      const c = onlyDigits(code ?? emailCode).slice(0, 7);
      if (c.length !== 7 || busy || verifyingEmailCodeBusy) return;

      setVerifyingEmailCodeBusy(true); // ✅ trava e mostra loader no code
      setBusy(true);
      setMsgError(null);

      try {
        const res = await fetch("/api/wz_AuthLogin/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            code: c,
            password,
            next: returnTo,
          }),
        });

        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Código inválido.");

        if (j?.next === "sms") {
          setPhoneMaskFromServer(String(j?.phoneMask || ""));
          setEmailSuccessOpen(true);
          setStep("emailSuccess");

          if (emailSuccessTimerRef.current) {
            window.clearTimeout(emailSuccessTimerRef.current);
            emailSuccessTimerRef.current = null;
          }

          emailSuccessTimerRef.current = window.setTimeout(
            () => {
              setEmailSuccessOpen(false);
              setStep("smsCode");
              setSmsCode("");
              setResendCooldown(35);
              emailSuccessTimerRef.current = null;
            },
            prefersReducedMotion ? 0 : 1500, // ✅ dura mais
          );

          return;
        }

        const nextUrl = String(j?.nextUrl || "/app");

        if (/^https?:\/\//i.test(nextUrl)) {
          window.location.assign(nextUrl);
        } else {
          router.push(nextUrl);
        }
      } catch (err: any) {
        setMsgError(err?.message || "Erro inesperado.");
      } finally {
        setBusy(false);
        setVerifyingEmailCodeBusy(false); // ✅ destrava
      }
    },
    [
      email,
      emailCode,
      busy,
      verifyingEmailCodeBusy,
      router,
      prefersReducedMotion,
      password,
    ],
  );

  const verifySmsCode = useCallback(
    async (code?: string) => {
      const c = onlyDigits(code ?? smsCode).slice(0, 7);
      if (c.length !== 7 || busy || verifyingSmsCodeBusy) return;

      setVerifyingSmsCodeBusy(true); // ✅ trava e mostra loader no code
      setBusy(true);
      setMsgError(null);

      try {
        const res = await fetch("/api/wz_AuthLogin/verify-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            code: c,
            password,
            next: returnTo || "", // ✅ manda o returnTo (se tiver)
          }),
        });

        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Código inválido.");

        const consumedReturnTo = consumeReturnTo();
        const nextUrl = String(consumedReturnTo || j?.nextUrl || "/app");

        if (/^https?:\/\//i.test(nextUrl)) {
          window.location.assign(nextUrl);
        } else {
          router.push(nextUrl);
        }
      } catch (err: any) {
        setMsgError(err?.message || "Erro inesperado.");
      } finally {
        setBusy(false);
        setVerifyingSmsCodeBusy(false); // ✅ destrava
      }
    },
    [email, smsCode, busy, verifyingSmsCodeBusy, router, password],
  );

  const resend = useCallback(async () => {
    if (busy || resendCooldown > 0) return;
    setBusy(true);
    setMsgError(null);

    try {
      const res = await fetch("/api/wz_AuthLogin/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), step }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Falha ao reenviar.");

      setResendCooldown(35);
    } catch (err: any) {
      setMsgError(err?.message || "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }, [busy, resendCooldown, email, step]);

  // ---------- COOKIES (mantive seu sistema) ----------

  // ---------- COOKIES (mantive seu sistema) ----------
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
      const isHttps =
        typeof location !== "undefined" && location.protocol === "https:";
      document.cookie = `${COOKIE_KEY}=1; Path=/; Max-Age=31536000; SameSite=Lax${
        isHttps ? "; Secure" : ""
      }`;
    } catch {}

    if (cookieCloseTimerRef.current) {
      window.clearTimeout(cookieCloseTimerRef.current);
      cookieCloseTimerRef.current = null;
    }

    cookieCloseTimerRef.current = window.setTimeout(
      () => {
        setShowCookieConsent(false);
        setCookieAccepting(false);
        cookieCloseTimerRef.current = null;
      },
      prefersReducedMotion ? 0 : 220,
    );
  }, [COOKIE_KEY, cookieAccepting, prefersReducedMotion]);

  // ---------- BOTTOM LINKS: esconder quando o "Continuar" encostar (zoom rápido / sem flicker) ----------
  const continueBtnRef = useRef<HTMLButtonElement | null>(null);
  const bottomLinksRef = useRef<HTMLDivElement | null>(null);

  // ✅ novo: ref do painel onde estão os inputs/steps
  const centerPanelRef = useRef<HTMLDivElement | null>(null);

  const [hideBottomLinks, setHideBottomLinks] = useState(false);

  const rafRef = useRef<number | null>(null);
  const settleFramesRef = useRef(0);
  const holdUntilRef = useRef(0);
  const lastDecisionRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null); // ✅ acorda sozinho após HOLD

  const computeBottomLinksHide = useCallback(() => {
    if (typeof window === "undefined") return;

    const clearHoldTimer = () => {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };

    const isMobile = window.matchMedia("(max-width: 640px)").matches;

    const btn = continueBtnRef.current; // pode ser null em outros steps
    const bottom = bottomLinksRef.current;
    const root = centerPanelRef.current;

    // bottom precisa existir; sem ele não tem o que calcular
    if (!bottom) {
      clearHoldTimer();
      holdUntilRef.current = 0;
      lastDecisionRef.current = false;
      setHideBottomLinks(false);
      return;
    }

    const bottomRect = bottom.getBoundingClientRect();

    // viewport height mais fiel no mobile
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const vh = (vv?.height ?? window.innerHeight) || 0;

    // ✅ NOVO: se BottomLinks encostar em QUALQUER parte do painel (ícone/título/textos/inputs), esconde
    const overlapWithPanel = (() => {
      if (!root) return false;

      const r = root.getBoundingClientRect();

      // se painel fora da viewport, ignora
      if (r.bottom <= 0 || r.top >= vh) return false;

      const xOverlap =
        Math.min(bottomRect.right, r.right) - Math.max(bottomRect.left, r.left);
      const yOverlap =
        Math.min(bottomRect.bottom, r.bottom) - Math.max(bottomRect.top, r.top);

      return xOverlap > 8 && yOverlap > 8;
    })();

    // ✅ mantém também a proteção específica de interativos (caso queira)
    const overlapWithInteractive = (() => {
      if (!root) return false;

      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'input, textarea, select, button, [role="button"], a[href]',
        ),
      );

      for (const el of nodes) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.bottom <= 0 || r.top >= vh) continue;

        const xOverlap =
          Math.min(bottomRect.right, r.right) -
          Math.max(bottomRect.left, r.left);
        const yOverlap =
          Math.min(bottomRect.bottom, r.bottom) -
          Math.max(bottomRect.top, r.top);

        if (xOverlap > 8 && yOverlap > 8) return true;
      }
      return false;
    })();

    // thresholds (mobile mais forte)
    const HARD_HIDE_PX = isMobile ? 18 : 10;
    const SHOW_PX = isMobile ? 82 : 56;
    const FAR_SHOW_PX = isMobile ? 170 : 120;
    const HOLD_MS = isMobile ? 520 : 420;

    // lógica do botão só se ele existir
    let btnVisible = false;
    let gap = Number.POSITIVE_INFINITY;

    if (btn) {
      const btnRect = btn.getBoundingClientRect();
      btnVisible =
        btnRect.width > 0 &&
        btnRect.height > 0 &&
        btnRect.bottom > 0 &&
        btnRect.top < vh;

      if (btnVisible) {
        gap = bottomRect.top - btnRect.bottom;
      }
    }

    const now = performance.now();

    // ✅ hardHide agora considera:
    // (1) encostou no painel (texto/ícone/etc) OU
    // (2) encostou em inputs/botões OU
    // (3) encostou no botão continuar
    const hardHide =
      overlapWithPanel ||
      overlapWithInteractive ||
      (btnVisible && gap < HARD_HIDE_PX);

    let next = lastDecisionRef.current;

    if (hardHide) {
      next = true;
      holdUntilRef.current = now + HOLD_MS;

      clearHoldTimer();
      const wait = Math.max(0, holdUntilRef.current - now + 20);
      holdTimerRef.current = window.setTimeout(() => {
        computeBottomLinksHide();
      }, wait);
    } else {
      const inHold = now < holdUntilRef.current;

      // ✅ só libera quando NÃO estiver encostando em nada do painel
      if (!btnVisible && !overlapWithPanel && !overlapWithInteractive) {
        clearHoldTimer();
        holdUntilRef.current = 0;
        next = false;
      } else if (btnVisible) {
        // regra antiga por proximidade do botão (com histerese)
        if (gap > FAR_SHOW_PX) {
          clearHoldTimer();
          holdUntilRef.current = 0;
          next = false;
        } else if (inHold) {
          next = true;
        } else if (gap > SHOW_PX) {
          clearHoldTimer();
          next = false;
        } else {
          next = lastDecisionRef.current;
        }
      } else {
        // sem botão visível e sem overlap: mostra
        if (!inHold) {
          clearHoldTimer();
          holdUntilRef.current = 0;
          next = false;
        } else {
          next = lastDecisionRef.current;
        }
      }
    }

    lastDecisionRef.current = next;
    setHideBottomLinks(next);
  }, []);

  const scheduleBottomLinksCheck = useCallback(
    (boostFrames = 10) => {
      // roda várias vezes após zoom/resize pra pegar o layout final
      settleFramesRef.current = Math.max(settleFramesRef.current, boostFrames);

      if (rafRef.current) return;

      const loop = () => {
        rafRef.current = null;
        computeBottomLinksHide();

        if (settleFramesRef.current > 0) {
          settleFramesRef.current -= 1;
          rafRef.current = requestAnimationFrame(loop);
        }
      };

      rafRef.current = requestAnimationFrame(loop);
    },
    [computeBottomLinksHide],
  );

  // useLayoutEffect evita “piscar” no primeiro paint após F5
  useLayoutEffect(() => {
    scheduleBottomLinksCheck(14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onAnyChange = () => scheduleBottomLinksCheck(10);

    window.addEventListener("resize", onAnyChange, { passive: true });
    window.addEventListener("scroll", onAnyChange, { passive: true });

    // ✅ Zoom do browser / mobile pinch-zoom (quando suportado)
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    vv?.addEventListener("resize", onAnyChange, { passive: true } as any);
    vv?.addEventListener("scroll", onAnyChange, { passive: true } as any);

    // ✅ Observa mudanças reais de layout (inclusive após fontes)
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => scheduleBottomLinksCheck(12));
      ro.observe(document.documentElement);
      if (continueBtnRef.current) ro.observe(continueBtnRef.current);
      if (bottomLinksRef.current) ro.observe(bottomLinksRef.current);

      // ✅ novo
      if (centerPanelRef.current) ro.observe(centerPanelRef.current);
    } catch {}

    // ✅ Quando fontes carregam, o layout muda (evita pisca pós F5)
    const fontsAny: any = (document as any).fonts;
    if (fontsAny?.ready?.then) {
      fontsAny.ready.then(() => scheduleBottomLinksCheck(12)).catch(() => {});
    }

    // roda quando estados principais mudarem
    scheduleBottomLinksCheck(10);

    return () => {
      window.removeEventListener("resize", onAnyChange);
      window.removeEventListener("scroll", onAnyChange);
      vv?.removeEventListener("resize", onAnyChange as any);
      vv?.removeEventListener("scroll", onAnyChange as any);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;

      ro?.disconnect();
    };
  }, [
    scheduleBottomLinksCheck,
    step,
    check.state,
    busy,
    verifyingEmailCodeBusy,
    msgError,
    cookieReady,
    showCookieConsent,
  ]);

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
    [prefersReducedMotion, EASE],
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
    [prefersReducedMotion, EASE],
  );

  const TitleIcon = useMemo(() => {
    if (step === "emailCode") return <Mail className="h-6 w-6 text-black/80" />;
    if (step === "emailSuccess")
      return <Check className="h-6 w-6 text-black/80" />;
    if (step === "smsCode") return <Phone className="h-6 w-6 text-black/80" />;
    return <Mail className="h-6 w-6 text-black/80" />;
  }, [step]);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Centro */}
      <div className="relative z-10 min-h-screen flex items-start sm:items-center justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+44px)] sm:pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+260px)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+240px)]">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: DUR.lg, ease: EASE }
          }
          className="w-full max-w-[640px]"
          style={{ willChange: "transform, opacity, filter" }}
        >
          <div
            ref={centerPanelRef}
            className="mx-auto w-full max-w-[560px] transform-gpu scale-[0.98] sm:scale-[1.0] md:scale-[1.02] origin-center"
          >
            <div className="text-center">
              <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04] ring-1 ring-black/5 shrink-0">
                {TitleIcon}
              </div>

              <div className="text-black font-semibold tracking-tight text-[28px] sm:text-[32px] md:text-[36px]">
                {step === "collect"
                  ? "Bem Vindo de volta a Wyzer!"
                  : step === "emailCode"
                    ? "Confirme seu endereço de e-mail"
                    : step === "emailSuccess"
                      ? "Código validado com sucesso"
                      : "Confirme seu número por SMS"}
              </div>

              <div className="mt-2 text-black/55 text-[14px] sm:text-[15px] md:text-[16px]">
                {step === "emailCode" ? (
                  <>
                    Insira o código enviado para{" "}
                    <span className="text-black/75">
                      {maskEmail(email.trim())}
                    </span>
                  </>
                ) : step === "emailSuccess" ? (
                  <>
                    Verificação concluída. Vamos confirmar seu número por SMS.
                  </>
                ) : step === "smsCode" ? (
                  <>
                    <span className="text-black/75">
                      {phoneMaskFromServer || maskPhone(phone)}
                    </span>
                  </>
                ) : (
                  helperText
                )}
              </div>
            </div>

            {/* STEP: COLLECT */}
            <AnimatePresence mode="sync" initial={false}>
              {step === "collect" && (
                <motion.form
                  key="collect"
                  onSubmit={startFlow}
                  initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : DUR.md,
                    ease: EASE,
                  }}
                  className="mt-10"
                >
                  {/* EMAIL input */}
                  <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden relative">
                    <input
                      type="email"
                      value={email}
                      disabled={emailLocked}
                      onChange={(e) => {
                        if (emailLocked) return;
                        const next = e.target.value;

                        if (
                          typeof window !== "undefined" &&
                          window.location.pathname.startsWith("/mail/")
                        ) {
                          window.history.replaceState({}, "", "/");
                        }

                        setMsgError(null);
                        setEmail(next);
                      }}
                      placeholder="E-mail"
                      className={cx(
                        "w-full bg-transparent px-6 py-5 pr-24 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none",
                        emailLocked ? "opacity-70 cursor-not-allowed" : "",
                      )}
                      autoComplete="email"
                      inputMode="email"
                    />

                    {/* ✅ loader / checks / reset 100% centralizados */}
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center">
                      {EmailAdornment}
                    </div>
                  </div>

                  <AnimatePresence mode="sync" initial={false}>
                    {check.state === "exists" && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : DUR.md,
                          ease: EASE,
                        }}
                        className="mt-4"
                      >
                        <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden">
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Senha"
                            className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                            autoComplete="current-password"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cadastro fields (quando NEW) */}
                  <AnimatePresence mode="sync" initial={false}>
                    {check.state === "new" && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : DUR.md,
                          ease: EASE,
                        }}
                        className="mt-4 space-y-3"
                      >
                        <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden">
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Nome completo"
                            className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                            autoComplete="name"
                          />
                        </div>

                        <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden">
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) =>
                              setPhone(formatPhoneBR(e.target.value))
                            }
                            placeholder="Número de telefone"
                            className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                            autoComplete="tel"
                            inputMode="tel"
                          />
                        </div>

                        <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden">
                          <input
                            type="text"
                            value={cpf}
                            onChange={(e) => setCpf(formatCpf(e.target.value))}
                            placeholder="CPF"
                            className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                            inputMode="numeric"
                          />
                        </div>

                        <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Crie uma senha"
                            className="w-full bg-transparent px-6 py-5 pr-16 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                            autoComplete="new-password"
                          />

                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-10 w-10 rounded-full bg-black/[0.06] hover:bg-black/[0.08] transition-colors"
                            aria-label={
                              showPassword ? "Ocultar senha" : "Mostrar senha"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5 text-black/60" />
                            ) : (
                              <Eye className="h-5 w-5 text-black/60" />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Error */}
                  <AnimatePresence initial={false}>
                    {!!msgError && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : 0.22,
                          ease: EASE,
                        }}
                        className="mt-3 rounded-[16px] bg-black/5 ring-1 ring-black/10 px-4 py-3 text-[13px] text-black/70"
                      >
                        {msgError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Continue */}
                  <motion.button
                    ref={continueBtnRef}
                    type="submit"
                    onClick={startFlow}
                    disabled={!canStart || busy}
                    whileHover={
                      prefersReducedMotion || !canStart || busy
                        ? undefined
                        : { y: -2, scale: 1.01 }
                    }
                    whileTap={
                      prefersReducedMotion || !canStart || busy
                        ? undefined
                        : { scale: 0.98 }
                    }
                    transition={{
                      duration: prefersReducedMotion ? 0 : DUR.sm,
                      ease: EASE,
                    }}
                    className={cx(
                      "group relative w-full mt-7 bg-[#171717] border border-[#454545] border-2 rounded-full px-15 py-5 text-white",
                      "focus:outline-none transition-all duration-300 ease-out",
                      "text-[16px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu",
                      !canStart || busy
                        ? "opacity-60 cursor-not-allowed select-none pointer-events-none"
                        : "hover:border-[#6a6a6a] focus:border-lime-400",
                    )}
                    style={{ willChange: "transform" }}
                  >
                    <span className="relative z-10">
                      {busy ? "Aguarde..." : "Continuar"}
                    </span>

                    <motion.span
                      whileHover={
                        prefersReducedMotion || !canStart || busy
                          ? undefined
                          : { scale: 1.06 }
                      }
                      whileTap={
                        prefersReducedMotion || !canStart || busy
                          ? undefined
                          : { scale: 0.96 }
                      }
                      transition={{
                        duration: prefersReducedMotion ? 0 : DUR.sm,
                        ease: EASE,
                      }}
                      className={cx(
                        "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-3 transition-all duration-300 ease-out",
                        !canStart || busy
                          ? "bg-transparent"
                          : "bg-transparent group-hover:bg-white/10 group-hover:translate-x-0.5",
                      )}
                    >
                      {busy ? (
                        <SpinnerMini reduced={!!prefersReducedMotion} />
                      ) : (
                        <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                      )}
                    </motion.span>
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* STEP: EMAIL CODE */}
            <AnimatePresence mode="sync" initial={false}>
              {step === "emailCode" && (
                <motion.div
                  key="emailCode"
                  initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : DUR.md,
                    ease: EASE,
                  }}
                  className="mt-10"
                >
                  <CodeBoxes
                    length={7}
                    value={emailCode}
                    onChange={setEmailCode}
                    onComplete={(v) => verifyEmailCode(v)}
                    disabled={busy || verifyingEmailCodeBusy} // ✅ trava inputs
                    loading={verifyingEmailCodeBusy} // ✅ loader central
                    reduced={!!prefersReducedMotion}
                  />

                  <AnimatePresence initial={false}>
                    {!!msgError && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : 0.22,
                          ease: EASE,
                        }}
                        className="mt-4 rounded-[16px] bg-black/5 ring-1 ring-black/10 px-4 py-3 text-[13px] text-black/70 text-center"
                      >
                        {msgError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-8 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={resend}
                      disabled={busy || resendCooldown > 0}
                      className={cx(
                        "text-[14px] font-semibold text-black/80 hover:text-black transition-colors",
                        busy || resendCooldown > 0
                          ? "opacity-50 cursor-not-allowed"
                          : "",
                      )}
                    >
                      {resendCooldown > 0
                        ? `Reenviar código (${resendCooldown}s)`
                        : "Reenviar código"}
                    </button>
                  </div>

                  <div className="mt-6 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={resetAll}
                      disabled={busy || verifyingEmailCodeBusy} // ✅ não deixa “remover o código” no meio
                      className={cx(
                        "text-[13px] font-semibold transition-colors inline-flex items-center gap-2",
                        busy || verifyingEmailCodeBusy
                          ? "text-black/35 cursor-not-allowed"
                          : "text-black/55 hover:text-black/75",
                      )}
                    >
                      <Undo2 className="h-4 w-4" />
                      Trocar e-mail
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* STEP: EMAIL SUCCESS */}
            <AnimatePresence mode="sync" initial={false}>
              {step === "emailSuccess" && (
                <motion.div
                  key="emailSuccess"
                  initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : DUR.md,
                    ease: EASE,
                  }}
                  className="mt-10"
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    {/* GIF / Lottie (DotLottie) */}
                    <motion.div
                      className="h-40 w-40 rounded-2xl overflow-hidden"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.25,
                        ease: EASE,
                      }}
                    >
                      <DotLottieReact
                        src="https://lottie.host/486672b2-c90e-4b34-bf26-62286504b54d/cmJkEq0miI.lottie"
                        loop
                        autoplay
                        className="h-full w-full"
                      />
                      <span className="sr-only">Sucesso</span>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.35,
                        ease: EASE,
                        delay: 0.05,
                      }}
                      className="mt-5 text-black/70 text-[14px] sm:text-[15px]"
                    >
                      Você será direcionado para a validação por SMS.
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.35,
                        ease: EASE,
                        delay: 0.1,
                      }}
                      className="mt-4"
                    >
                      <SpinnerMini reduced={!!prefersReducedMotion} />
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* STEP: SMS CODE */}
            <AnimatePresence mode="sync" initial={false}>
              {step === "smsCode" && (
                <motion.div
                  key="smsCode"
                  initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : DUR.md,
                    ease: EASE,
                  }}
                  className="mt-10"
                >
                  <CodeBoxes
                    length={7}
                    value={smsCode}
                    onChange={setSmsCode}
                    onComplete={(v) => verifySmsCode(v)}
                    disabled={busy || verifyingSmsCodeBusy} // ✅ trava inputs
                    loading={verifyingSmsCodeBusy} // ✅ loader central
                    reduced={!!prefersReducedMotion}
                  />

                  <AnimatePresence initial={false}>
                    {!!msgError && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : 0.22,
                          ease: EASE,
                        }}
                        className="mt-4 rounded-[16px] bg-black/5 ring-1 ring-black/10 px-4 py-3 text-[13px] text-black/70 text-center"
                      >
                        {msgError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-8 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={resend}
                      disabled={
                        busy || verifyingSmsCodeBusy || resendCooldown > 0
                      }
                      className={cx(
                        "text-[14px] font-semibold text-black/80 hover:text-black transition-colors",
                        busy || verifyingSmsCodeBusy || resendCooldown > 0
                          ? "opacity-50 cursor-not-allowed"
                          : "",
                      )}
                    >
                      {resendCooldown > 0
                        ? `Reenviar código (${resendCooldown}s)`
                        : "Reenviar código"}
                    </button>
                  </div>

                  <div className="mt-6 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={resetAll}
                      disabled={busy || verifyingSmsCodeBusy} // ✅ não deixa resetar no meio
                      className={cx(
                        "text-[13px] font-semibold transition-colors inline-flex items-center gap-2",
                        busy || verifyingSmsCodeBusy
                          ? "text-black/35 cursor-not-allowed"
                          : "text-black/55 hover:text-black/75",
                      )}
                    >
                      <Undo2 className="h-4 w-4" />
                      Trocar e-mail
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Bottom links (igual imagem) */}
      <motion.div
        initial={false}
        animate={
          hideBottomLinks
            ? { opacity: 0, y: 10, filter: "blur(8px)" }
            : { opacity: 1, y: 0, filter: "blur(0px)" }
        }
        transition={{
          duration: prefersReducedMotion ? 0 : hideBottomLinks ? 0.08 : 0.22,
          ease: EASE,
        }}
        className="fixed inset-x-0 bottom-0 z-[30] pointer-events-none"
        style={{ willChange: "transform, opacity, filter" }}
      >
        <div
          ref={bottomLinksRef}
          className={cx(
            "mx-auto w-full max-w-[560px] px-4",
            hideBottomLinks ? "pointer-events-none" : "pointer-events-auto",
          )}
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)",
          }}
        >
          <div className="flex flex-col items-center justify-center gap-4">
            <a
              href="/ajuda"
              className={cx(
                "inline-flex items-center justify-center rounded-[14px] px-7 py-3",
                "bg-[#f3f3f3] ring-1 ring-black/5",
                "text-[15px] font-semibold text-black/80 hover:text-black",
                "hover:bg-[#ededed] transition-colors",
              )}
            >
              Ajuda
            </a>

            <div className="flex items-center justify-center gap-10 text-[15px] text-black/55">
              <a
                href="https://terms.wyzer.com.br"
                className="hover:text-black transition-colors"
              >
                Termos
              </a>
              <a
                href="https://privacy.wyzer.com.br"
                className="hover:text-black transition-colors"
              >
                Privacidade
              </a>
              <a href="/cookies" className="hover:text-black transition-colors">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Cookies (mantido) */}
      <AnimatePresence
        initial={false}
        mode="sync"
        presenceAffectsLayout={false}
      >
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
                  whileHover={
                    prefersReducedMotion || cookieAccepting
                      ? undefined
                      : { y: -1, scale: 1.003 }
                  }
                  whileTap={
                    prefersReducedMotion || cookieAccepting
                      ? undefined
                      : { scale: 0.997 }
                  }
                  transition={{
                    duration: prefersReducedMotion ? 0 : DUR.md,
                    ease: EASE,
                  }}
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
                    transition={{
                      duration: prefersReducedMotion ? 0 : DUR.lg,
                      ease: EASE,
                    }}
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
                      Usamos cookies para melhorar sua experiência, segurança e
                      desempenho.
                    </p>

                    <p className="text-white/70 text-[12px] sm:text-[13px] leading-relaxed">
                      Ao continuar navegando, você concorda com o uso de cookies
                      conforme nossa política. Você pode ajustar suas
                      preferências no navegador a qualquer momento.
                    </p>

                    <div className="mt-4">
                      <motion.button
                        type="button"
                        onClick={acceptCookies}
                        disabled={cookieAccepting}
                        whileHover={
                          prefersReducedMotion || cookieAccepting
                            ? undefined
                            : { y: -2, scale: 1.01 }
                        }
                        whileTap={
                          prefersReducedMotion || cookieAccepting
                            ? undefined
                            : { scale: 0.98 }
                        }
                        transition={{
                          duration: prefersReducedMotion ? 0 : DUR.sm,
                          ease: EASE,
                        }}
                        className={cx(
                          "group relative w-full bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white",
                          "hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out",
                          "text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu",
                          cookieAccepting
                            ? "opacity-80 cursor-not-allowed"
                            : "",
                        )}
                        style={{ willChange: "transform" }}
                      >
                        <span className="relative z-10">
                          Entendi e continuar
                        </span>

                        <motion.span
                          whileHover={
                            prefersReducedMotion || cookieAccepting
                              ? undefined
                              : { scale: 1.06 }
                          }
                          whileTap={
                            prefersReducedMotion || cookieAccepting
                              ? undefined
                              : { scale: 0.96 }
                          }
                          transition={{
                            duration: prefersReducedMotion ? 0 : DUR.sm,
                            ease: EASE,
                          }}
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
