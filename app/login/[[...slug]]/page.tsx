"use client";

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, X, Undo2, Mail, Phone, Eye, EyeOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

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
}: {
  length: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
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
    <div className="mt-6 flex items-center justify-center gap-3">
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
            const ch = onlyDigits(e.target.value).slice(-1);
            setAt(i, ch);
            if (ch && i < length - 1) focus(i + 1);
          }}
          onKeyDown={(e) => {
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
          )}
        />
      ))}
    </div>
  );
}

export default function LinkLoginPage() {
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
    // Se cookie de sessão existir (httpOnly não dá pra ler),
    // então criamos um endpoint "me" se quiser. Como não temos, fazemos o check via fetch.
    (async () => {
      try {
        const r = await fetch("/api/wz_AuthLogin/me", { method: "GET" });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
         if (j?.ok) {
  if (typeof window !== "undefined") {
    const isLocal = window.location.hostname.endsWith("wyzer.com.br");
    const target = isLocal
      ? "http://dashboard.wyzer.com.br/create-account"
      : "https://dashboard.wyzer.com.br/create-account";
    window.location.href = target;
  }
}
        }
      } catch {}
    })();
  }, [router]);

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

          {/* {s === "exists" && (
            <motion.div
              key="exists"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.18,
                ease: EASE,
              }}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/[0.06]"
            >
              <motion.div
                animate={
                  prefersReducedMotion ? undefined : { scale: [1, 1.06, 1] }
                }
                transition={
                  prefersReducedMotion
                    ? undefined
                    : { duration: 0.35, ease: EASE }
                }
              >
                <Check className="h-5 w-5 text-black/70" />
              </motion.div>
            </motion.div>
          )} */}

          {/* {s === "new" && (
            <motion.div
              key="new"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: EASE }}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/[0.06]"
            >
              <motion.div
                animate={prefersReducedMotion ? undefined : { rotate: [0, 6, -6, 0] }}
                transition={prefersReducedMotion ? undefined : { duration: 0.35, ease: EASE }}
              >
                <ArrowRight className="h-5 w-5 text-black/60" />
              </motion.div>
            </motion.div>
          )} */}

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
              className="ml-2 inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/[0.06] hover:bg-black/[0.08] transition-colors cursor-pointer"
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

  const verifyEmailCode = useCallback(
    async (code?: string) => {
      const c = onlyDigits(code ?? emailCode).slice(0, 7);
      if (c.length !== 7 || busy) return;

      setBusy(true);
      setMsgError(null);

      try {
        const res = await fetch("/api/wz_AuthLogin/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), code: c, password }),
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
            prefersReducedMotion ? 0 : 900,
          );

          return;
        }

        // sem sms
        const nextUrl = String(j?.nextUrl || "/app");
        router.push(nextUrl);
      } catch (err: any) {
        setMsgError(err?.message || "Erro inesperado.");
      } finally {
        setBusy(false);
      }
    },
    [email, emailCode, busy, router, prefersReducedMotion],
  );

  const verifySmsCode = useCallback(
    async (code?: string) => {
      const c = onlyDigits(code ?? smsCode).slice(0, 7);
      if (c.length !== 7 || busy) return;

      setBusy(true);
      setMsgError(null);

      try {
        const res = await fetch("/api/wz_AuthLogin/verify-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ email: email.trim().toLowerCase(), code: c, password }),
        });

        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Código inválido.");

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
      }
    },
    [email, smsCode, busy, router],
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
      document.cookie = `${COOKIE_KEY}=1; Path=/; Max-Age=31536000; SameSite=Lax${isHttps ? "; Secure" : ""}`;
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
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: DUR.lg, ease: EASE }
          }
          className="w-full max-w-[640px]"
          style={{ willChange: "transform, opacity, filter" }}
        >
          <div className="mx-auto w-full max-w-[560px] transform-gpu scale-[1.06] sm:scale-[1.10] md:scale-[1.14] origin-center">
            <div className="text-center">
              <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04] ring-1 ring-black/5">
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
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
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
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
                        : "hover:border-[#6a6a6a] focus:border-lime-400"
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
                    disabled={busy}
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
                      className="text-[13px] font-semibold text-black/55 hover:text-black/75 transition-colors inline-flex items-center gap-2"
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
                    {/* GIF / Lottie (troque a URL pelo seu gif) */}
                    <motion.img
                      src="https://media.giphy.com/media/111ebonMs90YLu/giphy.gif"
                      alt="Sucesso"
                      className="h-28 w-28 rounded-2xl object-cover ring-1 ring-black/10 bg-white"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.25,
                        ease: EASE,
                      }}
                    />

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
                    disabled={busy}
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
                      className="text-[13px] font-semibold text-black/55 hover:text-black/75 transition-colors inline-flex items-center gap-2"
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
