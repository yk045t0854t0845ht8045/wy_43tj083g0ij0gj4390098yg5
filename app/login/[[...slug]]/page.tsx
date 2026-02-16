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
  Eye,
  EyeOff,
} from "lucide-react";
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

function getDashboardOriginForLoginHost(host: string) {
  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://dashboard.localhost:3000";
  }
  return "https://dashboard.wyzer.com.br";
}

const GOOGLE_PROVIDER_ICON_URL =
  "https://cdn.brandfetch.io/id6O2oGzv-/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1755835725776";

function isAllowedReturnToAbsolute(url: URL) {
  const host = url.hostname.toLowerCase();
  const protoOk = url.protocol === "https:" || url.protocol === "http:";
  const hostOk =
    host === "wyzer.com.br" ||
    host === "www.wyzer.com.br" ||
    host.endsWith(".wyzer.com.br") ||
    host === "localhost" ||
    host.endsWith(".localhost");
  return protoOk && hostOk;
}

function resolveSafeReturnTo(raw: string, loginHost: string) {
  const value = String(raw || "").trim();
  if (!value) return "";

  if (value.startsWith("/")) {
    return new URL(value, `${getDashboardOriginForLoginHost(loginHost)}/`).toString();
  }

  try {
    const url = new URL(value);
    if (!isAllowedReturnToAbsolute(url)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function SpinnerMini({
  reduced,
  tone = "dark",
}: {
  reduced: boolean;
  tone?: "dark" | "light";
}) {
  const trackClass = tone === "light" ? "border-white/16" : "border-black/15";
  const spinnerClass =
    tone === "light"
      ? "border-white/70 border-t-transparent"
      : "border-black/50 border-t-transparent";

  return (
    <motion.span
      aria-hidden
      className="inline-flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    >
      <span className="relative h-5 w-5">
        <span className={cx("absolute inset-0 rounded-full border-2", trackClass)} />
        <motion.span
          className={cx("absolute inset-0 rounded-full border-2", spinnerClass)}
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

function LoginSessionLoader({
  reduced = false,
  label = "Verificando sessao...",
}: {
  reduced?: boolean;
  label?: string;
}) {
  return (
    <div
      aria-label="Loading..."
      role="status"
      className="inline-flex items-center gap-3 rounded-full bg-[#f3f3f3] px-5 py-3 ring-1 ring-black/6"
    >
      <svg
        className={cx("h-6 w-6 stroke-black/55", reduced ? "" : "animate-spin")}
        viewBox="0 0 256 256"
        fill="none"
      >
        <line
          x1="128"
          y1="32"
          x2="128"
          y2="64"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />
        <line
          x1="195.9"
          y1="60.1"
          x2="173.3"
          y2="82.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />
        <line
          x1="224"
          y1="128"
          x2="192"
          y2="128"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />
        <line
          x1="195.9"
          y1="195.9"
          x2="173.3"
          y2="173.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />
        <line
          x1="128"
          y1="224"
          x2="128"
          y2="192"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />
        <line
          x1="60.1"
          y1="195.9"
          x2="82.7"
          y2="173.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />
        <line
          x1="32"
          y1="128"
          x2="64"
          y2="128"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />
        <line
          x1="60.1"
          y1="60.1"
          x2="82.7"
          y2="82.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />
      </svg>
      <span className="text-[13px] font-semibold text-black/58">{label}</span>
    </div>
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

type Step =
  | "collect"
  | "emailCode"
  | "twoFactorCode";
type OAuthProvider = "google";
type LoginAuthMethod = "choose" | "totp" | "passkey";
type LoginAuthMethodsPayload = { totp?: boolean; passkey?: boolean };
type PasskeyLoginOptionsPayload = {
  challenge: string;
  rpId: string;
  timeout?: number;
  userVerification?: "required" | "preferred" | "discouraged";
  allowCredentials?: Array<{
    type: "public-key";
    id: string;
    transports?: string[];
  }>;
};

type PasswordSetupRequiredPrompt = {
  message: string;
  provider: OAuthProvider;
  providerLabel: string;
  ctaLabel: string;
};

type StartFlowResponsePayload = {
  ok?: boolean;
  next?: string;
  nextUrl?: string;
  error?: string;
  code?: string;
  provider?: string;
  providerLabel?: string;
  ctaLabel?: string;
};

type EmailCheckResponsePayload = {
  exists?: boolean;
  hasPhone?: boolean;
  passwordSetupRequired?: boolean;
  provider?: string | null;
  providerLabel?: string | null;
  ctaLabel?: string | null;
  notice?: string | null;
  error?: string;
};

function normalizeBase64Url(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToUint8Array(value: string) {
  const normalized = normalizeBase64Url(value);
  if (!normalized || typeof window === "undefined") return new Uint8Array();
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isPasskeyLoginSupportedInBrowser() {
  if (typeof window === "undefined") return false;
  return Boolean(window.PublicKeyCredential && navigator.credentials?.get);
}

function CodeBoxes({
  length,
  value,
  onChange,
  onComplete,
  disabled,
  loading,
  reduced,
  variant = "light",
}: {
  length: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  loading?: boolean; // novo
  reduced?: boolean;
  variant?: "light" | "dark";
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const lastCompletedRef = useRef<string>("");
  const dark = variant === "dark";
  const showLoadingOverlay = Boolean(loading) && !dark;

  const digits = useMemo(() => {
    const clean = onlyDigits(value).slice(0, length);
    return Array.from({ length }, (_, i) => clean[i] || "");
  }, [value, length]);

  useEffect(() => {
    const clean = onlyDigits(value).slice(0, length);
    if (clean.length !== length) {
      lastCompletedRef.current = "";
      return;
    }
    if (clean === lastCompletedRef.current) return;
    lastCompletedRef.current = clean;
    onComplete?.(clean);
  }, [length, onComplete, value]);

  const setAt = (idx: number, ch: string) => {
    const clean = onlyDigits(value).slice(0, length).split("");
    while (clean.length < length) clean.push("");
    clean[idx] = ch;
    const next = clean.join("");
    onChange(next);
  };

  const focus = (idx: number) => refs.current[idx]?.focus();

  return (
    <div
      className={cx(
        "relative flex-nowrap",
        dark
          ? "mt-5 flex w-full items-center justify-center gap-1 sm:gap-2"
          : "mt-6 flex w-full items-center justify-center gap-1.5 px-2 sm:gap-3 sm:px-0"
      )}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={d}
          onChange={(e) => {
            if (disabled) return; // trava também o handler
            const ch = onlyDigits(e.target.value).slice(-1);
            setAt(i, ch);
            if (ch && i < length - 1) focus(i + 1);
          }}
          onKeyDown={(e) => {
            if (disabled) return; // trava
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
            if (disabled) return; // trava
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
              dark
                ? "h-11 w-8 rounded-[10px] border border-white/14 bg-black/[0.58] text-center text-[16px] font-semibold text-white/94 sm:h-12 sm:w-10 sm:rounded-[12px] sm:text-[18px]"
                : "h-11 w-9 rounded-[11px] bg-[#f3f3f3] ring-1 ring-black/5 text-center text-[15px] font-semibold text-black sm:h-14 sm:w-14 sm:rounded-[14px] sm:text-[18px]",
              dark
                ? "focus:outline-none focus:ring-2 focus:ring-white/18"
                : "focus:outline-none focus:ring-2 focus:ring-black/20",
            "transition-all duration-200",
            disabled ? "opacity-70 cursor-not-allowed" : "",
          )}
        />
      ))}

      {/* Overlay de validacao (spinner central) */}
      <AnimatePresence initial={false}>
        {showLoadingOverlay && (
          <motion.div
            key="codebox-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ pointerEvents: "none" }}
          >
            <div
              className={cx(
                "absolute inset-0 rounded-[18px] backdrop-blur-[2px]",
                dark ? "bg-black/48" : "bg-white/55"
              )}
            />
            <div className="relative z-10">
              <SpinnerMini reduced={!!reduced} tone={dark ? "light" : "dark"} />
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
  const collectModeVariants = useMemo(
    () => ({
      initial: {
        opacity: 0,
        y: 12,
        scale: 0.992,
        filter: "blur(8px)",
      },
      animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: {
          duration: prefersReducedMotion ? 0 : 0.32,
          ease: EASE,
          when: "beforeChildren" as const,
          staggerChildren: prefersReducedMotion ? 0 : 0.045,
        },
      },
      exit: {
        opacity: 0,
        y: -10,
        scale: 0.992,
        filter: "blur(8px)",
        transition: {
          duration: prefersReducedMotion ? 0 : 0.22,
          ease: EASE,
        },
      },
    }),
    [EASE, prefersReducedMotion],
  );
  const collectModeItemVariants = useMemo(
    () => ({
      initial: {
        opacity: 0,
        y: 7,
      },
      animate: {
        opacity: 1,
        y: 0,
        transition: {
          duration: prefersReducedMotion ? 0 : 0.22,
          ease: EASE,
        },
      },
      exit: {
        opacity: 0,
        y: -6,
        transition: {
          duration: prefersReducedMotion ? 0 : 0.16,
          ease: EASE,
        },
      },
    }),
    [EASE, prefersReducedMotion],
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

  // senha (serve pro login e pro registro)
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // codes
  const [emailCode, setEmailCode] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorTicket, setTwoFactorTicket] = useState("");
  const [, setPasskeyLoginTicket] = useState("");
  const [twoFactorAllowsTotp, setTwoFactorAllowsTotp] = useState(true);
  const [twoFactorAllowsPasskey, setTwoFactorAllowsPasskey] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<LoginAuthMethod>("totp");
  const [oauthOnboardingProvider, setOauthOnboardingProvider] =
    useState<OAuthProvider | null>(null);
  const [showMoreProviders, setShowMoreProviders] = useState(false);

  // ui states
  const [busy, setBusy] = useState(false);
  const [verifyingEmailCodeBusy, setVerifyingEmailCodeBusy] = useState(false); // novo (só validação do email code)
  const [verifyingTwoFactorCodeBusy, setVerifyingTwoFactorCodeBusy] =
    useState(false);
  const [verifyingPasskeyLoginBusy, setVerifyingPasskeyLoginBusy] =
    useState(false);
  const [checkingExistingSession, setCheckingExistingSession] = useState(true);
  const [sessionCheckLabel, setSessionCheckLabel] =
    useState("Verificando sessao...");
  const [twoFactorIslandLoading, setTwoFactorIslandLoading] = useState(false);
  const [twoFactorShakeTick, setTwoFactorShakeTick] = useState(0);
  const [startingGoogleLogin, setStartingGoogleLogin] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [passwordSetupPrompt, setPasswordSetupPrompt] =
    useState<PasswordSetupRequiredPrompt | null>(null);
  const [passwordSetupModalOpen, setPasswordSetupModalOpen] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const lastCheckedRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const passkeyAutoStartTicketRef = useRef<string>("");

  // prefill email from token -> lock + cleanup URL
  useEffect(() => {
    if (!tokenFromRoute) return;
    if (tokenConsumedRef.current) return;

    try {
      if (email.trim().length === 0) {
        const decoded = decodeEmailFromUrlToken(tokenFromRoute);
        if (decoded && decoded.includes("@")) {
          setEmail(decoded);
          setEmailLocked(true); // veio da URL, já trava o input
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

    const url = new URL(window.location.href);
    let cancelled = false;
    const startedAt = Date.now();
    const hasOAuthReturn = Boolean(
      url.searchParams.get("code") ||
        url.searchParams.get("error") ||
        url.searchParams.get("error_description"),
    );
    setSessionCheckLabel(
      hasOAuthReturn
        ? "Finalizando login com provedor..."
        : "Verificando sessao...",
    );

    const minLoaderMs = hasOAuthReturn ? 1800 : 0;
    const finishCheck = async () => {
      const elapsed = Date.now() - startedAt;
      const waitMs = Math.max(0, minLoaderMs - elapsed);
      if (waitMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, waitMs));
      }
      if (!cancelled) setCheckingExistingSession(false);
    };

    if (url.searchParams.get("forceLogin") === "1") {
      void finishCheck();
      return () => {
        cancelled = true;
      };
    }

    const host = window.location.hostname.toLowerCase();
    const isLoginHost =
      host === "login.wyzer.com.br" ||
      host === "login.localhost" ||
      host === "localhost";
    const isLinkHost = host.startsWith("link.");
    if (!isLoginHost && !isLinkHost) {
      void finishCheck();
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      let redirected = false;
      const maxAttempts = hasOAuthReturn ? 20 : 3;

      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          let responseStatus = 0;
          try {
            const response = await fetch("/api/wz_AuthLogin/me", {
              method: "GET",
              cache: "no-store",
              credentials: "include",
            });
            responseStatus = response.status;
            if (cancelled) return;

            if (response.ok) {
              const payload = await response.json().catch(() => ({}));
              if (payload?.ok && !cancelled) {
                const returnToRaw = url.searchParams.get("returnTo") || "";
                const safeReturnTo = resolveSafeReturnTo(returnToRaw, host);
                const target = safeReturnTo || `${getDashboardOriginForLoginHost(host)}/`;
                redirected = true;
                window.location.replace(target);
                return;
              }
            }

            if (
              (response.status === 401 || response.status === 403) &&
              !hasOAuthReturn
            ) {
              break;
            }
          } catch {
            // retry for transient network/browser races
          }

          if (
            (responseStatus === 401 || responseStatus === 403) &&
            !hasOAuthReturn
          ) {
            break;
          }

          if (attempt < maxAttempts) {
            const retryDelay = hasOAuthReturn
              ? Math.min(1200, 220 + attempt * 110)
              : 120 * attempt;
            await new Promise((resolve) =>
              window.setTimeout(resolve, retryDelay),
            );
          }
        }
      } finally {
        if (!redirected) await finishCheck();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const oauthError = String(url.searchParams.get("oauthError") || "").trim();
    if (!oauthError) return;

    setMsgError(oauthError);
    url.searchParams.delete("oauthError");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const oauthProvider = String(url.searchParams.get("oauthProvider") || "")
      .trim()
      .toLowerCase();
    const oauthEmail = String(url.searchParams.get("oauthEmail") || "")
      .trim()
      .toLowerCase();
    const oauthStep = String(url.searchParams.get("oauthStep") || "")
      .trim()
      .toLowerCase();

    const provider = oauthProvider === "google" ? (oauthProvider as OAuthProvider) : null;
    if (!provider || !isValidEmail(oauthEmail)) {
      return;
    }

    setOauthOnboardingProvider(provider);
    setShowMoreProviders(false);
    setEmail(oauthEmail);
    setEmailLocked(true);
    setCheck({ state: "exists" });
    setPassword("");
    setMsgError(null);
    setPasswordSetupPrompt(null);
    setPasswordSetupModalOpen(false);
    setEmailCode("");

    if (oauthStep === "email") {
      setStep("emailCode");
      setResendCooldown(35);
    }

    url.searchParams.delete("oauthProvider");
    url.searchParams.delete("oauthEmail");
    url.searchParams.delete("oauthStep");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
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

  // email check debounce
  useEffect(() => {
    const value = email.trim().toLowerCase();
    const shouldHandlePasswordSetupPrompt =
      step === "collect" && !oauthOnboardingProvider;

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

        const data = (await res.json()) as EmailCheckResponsePayload;
        const exists = Boolean(data?.exists);
        const provider = String(data?.provider || "")
          .trim()
          .toLowerCase();
        const requiresPasswordSetup =
          exists &&
          Boolean(data?.passwordSetupRequired) &&
          provider === "google";

        lastCheckedRef.current = value;

        if (exists) {
          setCheck({ state: "exists" });
          if (requiresPasswordSetup && shouldHandlePasswordSetupPrompt) {
            const message =
              String(data?.notice || "Voce nao cumpriu os requisitos de senha da conta.")
                .trim() || "Voce nao cumpriu os requisitos de senha da conta.";
            setPassword("");
            setMsgError(message);
            setPasswordSetupPrompt({
              message,
              provider: "google",
              providerLabel: String(data?.providerLabel || "Google").trim() || "Google",
              ctaLabel: String(data?.ctaLabel || "Criar agora").trim() || "Criar agora",
            });
            setPasswordSetupModalOpen(false);
          } else {
            setPasswordSetupPrompt(null);
            setPasswordSetupModalOpen(false);
            setMsgError((prev) => {
              const normalized = String(prev || "").trim().toLowerCase();
              if (
                normalized === "voce nao cumpriu os requisitos de senha da conta." ||
                normalized === "voce nao cumpriu os requisitos de senha da conta"
              ) {
                return null;
              }
              return prev;
            });
          }
        } else {
          setCheck({ state: "new" });
          setPasswordSetupPrompt(null);
          setPasswordSetupModalOpen(false);
        }

        // animação + trava o email quando válido (modelo Google)
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
  }, [email, oauthOnboardingProvider, step]);

  // reset flow
  const resetAll = useCallback(() => {
    setStep("collect");
    setBusy(false);
    setVerifyingEmailCodeBusy(false);
    setVerifyingTwoFactorCodeBusy(false);
    setVerifyingPasskeyLoginBusy(false);
    setMsgError(null);
    setPasswordSetupPrompt(null);
    setPasswordSetupModalOpen(false);
    setResendCooldown(0);
    setTwoFactorIslandLoading(false);
    setTwoFactorShakeTick(0);

    setEmail("");
    setEmailLocked(false);

    setCheck({ state: "idle" });
    lastCheckedRef.current = "";

    setFullName("");
    setPhone("");
    setCpf("");

    setEmailCode("");
    setTwoFactorCode("");
    setTwoFactorTicket("");
    setPasskeyLoginTicket("");
    setTwoFactorAllowsTotp(true);
    setTwoFactorAllowsPasskey(false);
    setTwoFactorMethod("totp");
    passkeyAutoStartTicketRef.current = "";
    setOauthOnboardingProvider(null);
    setShowMoreProviders(false);

    // garante URL limpa
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
  }, []);

  const twoFactorInvalidError = useMemo(() => {
    if (step !== "twoFactorCode") return null;
    const message = String(msgError || "").trim();
    if (!message) return null;
    return /(invalido|inv\u00e1lido)/i.test(message) ? message : null;
  }, [msgError, step]);

  const clearTwoFactorFeedback = useCallback(() => {
    if (step !== "twoFactorCode") return;
    setMsgError(null);
  }, [step]);

  const setTwoFactorFeedback = useCallback((message?: string | null) => {
    const nextMessage = String(message || "").trim();
    if (!nextMessage) {
      setMsgError(null);
      return;
    }
    setMsgError(nextMessage);
    if (/(invalido|inv\u00e1lido)/i.test(nextMessage)) {
      setTwoFactorShakeTick((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    if (step !== "twoFactorCode") {
      setTwoFactorIslandLoading(false);
      return;
    }
    setTwoFactorIslandLoading(true);
    const timer = window.setTimeout(() => {
      setTwoFactorIslandLoading(false);
    }, prefersReducedMotion ? 0 : 1500);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion, step]);
  // adornment (alinhado perfeito)
  const EmailAdornment = useMemo(() => {
    const s = check.state;

    // se email locked, mostra botão reset (seta voltar)
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
    if (step === "twoFactorCode") {
      if (twoFactorAllowsTotp && twoFactorAllowsPasskey) {
        return "Escolha como deseja validar o login.";
      }
      if (twoFactorAllowsPasskey) {
        return "Continue com Windows Hello para validar o login.";
      }
      return "Abra seu aplicativo autenticador para continuar.";
    }
    if (check.state === "checking") return "Verificando seu e-mail...";
    if (check.state === "exists" && passwordSetupPrompt)
      return `Conta criada com ${passwordSetupPrompt.providerLabel}. Continue com ${passwordSetupPrompt.providerLabel} para criar sua senha.`;
    if (check.state === "exists")
      return oauthOnboardingProvider
        ? "Conta Google conectada. Vamos confirmar com codigo."
        : "Conta encontrada. Vamos confirmar com codigo.";
    if (check.state === "new")
      return "Novo por aqui? Complete seus dados e confirme o e-mail.";
    if (check.state === "invalid")
      return "Digite um e-mail válido para continuar.";
    if (check.state === "error")
      return "Não conseguimos validar agora. Tente novamente.";
    return "Faça login ou registre-se para começar.";
  }, [
    check.state,
    step,
    twoFactorAllowsTotp,
    twoFactorAllowsPasskey,
    oauthOnboardingProvider,
    passwordSetupPrompt,
  ]);

  const canStart = useMemo(() => {
    const eok = isValidEmail(email.trim());
    if (!eok) return false;
    if (check.state === "checking" || check.state === "typing") return false;

    const okPass = String(password || "").length >= 6; // ajuste se quiser

    if (check.state === "exists") {
      if (passwordSetupPrompt) return false;
      return okPass;
    }

    if (check.state === "new") {
      const okName = fullName.trim().length >= 4;
      const okPhone = onlyDigits(phone).length >= 10;
      const okCpf = onlyDigits(cpf).length === 11;
      return okName && okPhone && okCpf && okPass;
    }

    return false;
  }, [email, check.state, fullName, phone, cpf, password, passwordSetupPrompt]);

  const startFlow = useCallback(
    async (e?: React.FormEvent | React.MouseEvent) => {
      e?.preventDefault?.();
      if (!canStart || busy) return;

      setBusy(true);
      setMsgError(null);
      setPasswordSetupPrompt(null);
      setPasswordSetupModalOpen(false);

      try {
        const payload: any = { email: email.trim().toLowerCase() };

        // sempre manda senha (login e register)
        payload.password = String(password || "");
        if (typeof window !== "undefined") {
          const currentUrl = new URL(window.location.href);
          payload.next = currentUrl.searchParams.get("returnTo") || "";
        }

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

        const j = (await res.json().catch(() => ({}))) as StartFlowResponsePayload;
        if (!res.ok) {
          const code = String(j?.code || "").trim().toLowerCase();
          const provider = String(j?.provider || "").trim().toLowerCase();
          if (code === "password_setup_required" && provider === "google") {
            const message =
              String(j?.error || "Voce nao cumpriu os requisitos de senha da conta.").trim() ||
              "Voce nao cumpriu os requisitos de senha da conta.";
            setMsgError(message);
            setPasswordSetupPrompt({
              message,
              provider: "google",
              providerLabel: String(j?.providerLabel || "Google").trim() || "Google",
              ctaLabel: String(j?.ctaLabel || "Criar agora").trim() || "Criar agora",
            });
            setPasswordSetupModalOpen(false);
            return;
          }
          throw new Error(j?.error || "Falha ao iniciar validacao.");
        }

        setPasswordSetupPrompt(null);
        setPasswordSetupModalOpen(false);

        if (j?.nextUrl) {
          const nextUrl = String(j.nextUrl);
          if (/^https?:\/\//i.test(nextUrl)) {
            window.location.assign(nextUrl);
          } else {
            router.push(nextUrl);
          }
          return;
        }

        if (j?.next !== "email") {
          throw new Error("Fluxo de autenticacao invalido.");
        }

        setStep("emailCode");
        setEmailCode("");
        setTwoFactorCode("");
        setTwoFactorTicket("");
        setPasskeyLoginTicket("");
        setTwoFactorAllowsTotp(true);
        setTwoFactorAllowsPasskey(false);
        setTwoFactorMethod("totp");
        passkeyAutoStartTicketRef.current = "";
        setResendCooldown(35);
      } catch (err: any) {
        setMsgError(err?.message || "Erro inesperado.");
      } finally {
        setBusy(false);
      }
    },
    [canStart, busy, email, check.state, fullName, phone, cpf, password, router],
  );

  const startGoogleLogin = useCallback(
    async (
      e?: React.MouseEvent | React.FormEvent,
      options?: { nextOverride?: string },
    ) => {
      e?.preventDefault?.();
      if (startingGoogleLogin || busy) {
        return;
      }

      try {
        setStartingGoogleLogin(true);
        setMsgError(null);
        setPasswordSetupModalOpen(false);
        const returnToValue =
          String(options?.nextOverride || "").trim() ||
          (typeof window !== "undefined"
            ? new URL(window.location.href).searchParams.get("returnTo") || ""
            : "");

        const res = await fetch("/api/wz_AuthLogin/google/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ next: returnToValue }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          authUrl?: string;
          error?: string;
        };

        if (!res.ok || !payload.ok || !payload.authUrl) {
          throw new Error(
            payload.error || "Nao foi possivel iniciar o login com Google.",
          );
        }

        window.location.assign(String(payload.authUrl));
      } catch (error) {
        setMsgError(
          error instanceof Error
            ? error.message
            : "Erro inesperado ao iniciar login com Google.",
        );
      } finally {
        setStartingGoogleLogin(false);
      }
    },
    [busy, startingGoogleLogin],
  );

  const openPasswordSetupModal = useCallback(() => {
    if (!passwordSetupPrompt) return;
    setPasswordSetupModalOpen(true);
  }, [passwordSetupPrompt]);

  const continuePasswordSetupWithProvider = useCallback(async () => {
    if (!passwordSetupPrompt) return;
    if (passwordSetupPrompt.provider !== "google") return;

    const host =
      typeof window !== "undefined"
        ? window.location.hostname.toLowerCase()
        : "login.wyzer.com.br";
    const next = new URL("/dashboard", `${getDashboardOriginForLoginHost(host)}/`);
    next.searchParams.set("openConfig", "my-account");
    next.searchParams.set("openPasswordModal", "1");
    next.searchParams.set("passwordSetupFlow", "1");
    next.searchParams.set("passwordSetupProvider", passwordSetupPrompt.provider);
    await startGoogleLogin(undefined, { nextOverride: next.toString() });
  }, [passwordSetupPrompt, startGoogleLogin]);

  // Declare returnTo at component level
  const url =
    typeof window !== "undefined" ? new URL(window.location.href) : null;
  const returnTo = url?.searchParams.get("returnTo") || "";

  const openSecondStepChallenge = useCallback(
    (payload: Record<string, unknown>, message?: string | null) => {
      const ticket = String(payload?.twoFactorTicket || payload?.ticket || "").trim();
      if (!ticket) return false;

      const methods = (payload?.authMethods || {}) as LoginAuthMethodsPayload;
      const hasTotpRaw =
        typeof methods?.totp === "boolean"
          ? methods.totp
          : Boolean(payload?.requiresTwoFactor);
      const hasPasskeyRaw =
        typeof methods?.passkey === "boolean"
          ? methods.passkey
          : Boolean(payload?.requiresPasskey);

      const hasTotp = hasTotpRaw || !hasPasskeyRaw;
      const hasPasskey = hasPasskeyRaw;
      const defaultMethod: LoginAuthMethod =
        hasTotp && hasPasskey ? "choose" : hasPasskey ? "passkey" : "totp";

      setTwoFactorTicket(ticket);
      setPasskeyLoginTicket("");
      setTwoFactorCode("");
      setTwoFactorAllowsTotp(hasTotp);
      setTwoFactorAllowsPasskey(hasPasskey);
      setTwoFactorMethod(defaultMethod);
      setTwoFactorShakeTick(0);
      passkeyAutoStartTicketRef.current = "";
      setStep("twoFactorCode");

      const finalMessage = String(message || "").trim();
      setMsgError(finalMessage || null);
      return true;
    },
    [],
  );

  const verifyEmailCode = useCallback(
    async (code?: string) => {
      const c = onlyDigits(code ?? emailCode).slice(0, 7);
      if (c.length !== 7 || busy || verifyingEmailCodeBusy) return;

      setVerifyingEmailCodeBusy(true); // trava e mostra loader no code
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

        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok || !j?.ok) {
          if (
            openSecondStepChallenge(
              j,
              String(j?.error || "Codigo da autenticacao adicional invalido. Tente novamente."),
            )
          ) {
            return;
          }

          const fallbackError =
            res.status === 429
              ? "Voce atingiu o limite de 7 tentativas. Reenvie o codigo."
              : "Codigo invalido. Tente novamente.";
          setMsgError(String(j?.error || fallbackError));
          setEmailCode("");
          if (res.status === 429) {
            setResendCooldown(0);
          }
          return;
        }

        if (j?.next === "two-factor") {
          if (!openSecondStepChallenge(j, null)) {
            throw new Error("Fluxo de autenticacao em 2 etapas invalido.");
          }
          return;
        }

        const nextUrl = String(j?.nextUrl || "/app");

        if (/^https?:\/\//i.test(nextUrl)) {
          window.location.assign(nextUrl);
        } else {
          router.push(nextUrl);
        }
      } catch (err: any) {
        setMsgError(err?.message || "Erro inesperado. Tente novamente.");
      } finally {
        setBusy(false);
        setVerifyingEmailCodeBusy(false); // destrava
      }
    },
    [
      email,
      emailCode,
      busy,
      verifyingEmailCodeBusy,
      router,
      password,
      returnTo,
      openSecondStepChallenge,
    ],
  );

  const verifyTwoFactorCode = useCallback(
    async (code?: string) => {
      const c = onlyDigits(code ?? twoFactorCode).slice(0, 6);
      if (twoFactorMethod !== "totp" || !twoFactorAllowsTotp) return;
      if (c.length !== 6 || busy || verifyingTwoFactorCodeBusy) return;
      if (!twoFactorTicket) return;

      setVerifyingTwoFactorCodeBusy(true);
      setBusy(true);
      setTwoFactorFeedback(null);

      try {
        const res = await fetch("/api/wz_AuthLogin/verify-two-factor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            twoFactorCode: c,
            twoFactorTicket,
            next: returnTo,
          }),
        });

        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.ok) {
          if (j?.twoFactorTicket) {
            setTwoFactorTicket(String(j.twoFactorTicket || ""));
          }
          setTwoFactorFeedback(
            String(j?.error || "Codigo de 2 etapas invalido. Tente novamente."),
          );
          setTwoFactorCode("");
          return;
        }

        const nextUrl = String(j?.nextUrl || "/app");

        if (/^https?:\/\//i.test(nextUrl)) {
          window.location.assign(nextUrl);
        } else {
          router.push(nextUrl);
        }
      } catch (err: any) {
        setTwoFactorFeedback(err?.message || "Erro inesperado. Tente novamente.");
      } finally {
        setBusy(false);
        setVerifyingTwoFactorCodeBusy(false);
      }
    },
    [
      busy,
      email,
      returnTo,
      router,
      twoFactorCode,
      twoFactorMethod,
      twoFactorAllowsTotp,
      twoFactorTicket,
      verifyingTwoFactorCodeBusy,
      setTwoFactorFeedback,
    ],
  );

  const verifyPasskeyLogin = useCallback(async () => {
    if (!twoFactorAllowsPasskey || !twoFactorTicket) return;
    if (busy || verifyingPasskeyLoginBusy) return;

    if (!isPasskeyLoginSupportedInBrowser()) {
      setTwoFactorFeedback(
        "Seu navegador/dispositivo nao suporta Windows Hello com passkey neste ambiente.",
      );
      return;
    }

    setVerifyingPasskeyLoginBusy(true);
    setBusy(true);
    setTwoFactorFeedback(null);

    try {
      const startRes = await fetch("/api/wz_AuthLogin/verify-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "start",
          email: email.trim().toLowerCase(),
          twoFactorTicket,
        }),
      });

      const startPayload = (await startRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!startRes.ok || !startPayload?.ok) {
        if (startPayload?.twoFactorTicket) {
          setTwoFactorTicket(String(startPayload.twoFactorTicket || ""));
        }
        throw new Error(
          String(startPayload?.error || "Nao foi possivel iniciar a validacao do Windows Hello."),
        );
      }

      const startOptions = (startPayload?.options || null) as PasskeyLoginOptionsPayload | null;
      const nextPasskeyTicket = String(startPayload?.ticket || "").trim();

      if (!nextPasskeyTicket || !startOptions?.challenge) {
        throw new Error("Resposta invalida do servidor para iniciar o Windows Hello.");
      }

      setPasskeyLoginTicket(nextPasskeyTicket);

      const transportsAllowed = new Set([
        "usb",
        "nfc",
        "ble",
        "internal",
        "hybrid",
        "smart-card",
      ]);

      const allowCredentials: PublicKeyCredentialDescriptor[] = [];
      if (Array.isArray(startOptions.allowCredentials)) {
        for (const item of startOptions.allowCredentials) {
          const id = base64UrlToUint8Array(item?.id || "");
          if (!id.length) continue;

          const transports = Array.isArray(item?.transports)
            ? item.transports
                .map((value) => String(value || "").trim().toLowerCase())
                .filter(
                  (value): value is AuthenticatorTransport =>
                    transportsAllowed.has(value),
                )
            : [];

          allowCredentials.push({
            type: "public-key",
            id: id as BufferSource,
            ...(transports.length ? { transports } : {}),
          });
        }
      }

      const userVerification = (() => {
        const raw = String(startOptions.userVerification || "").trim().toLowerCase();
        if (raw === "required" || raw === "preferred" || raw === "discouraged") {
          return raw as UserVerificationRequirement;
        }
        return "required";
      })();

      const rpId = String(startOptions.rpId || "").trim();
      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: base64UrlToUint8Array(startOptions.challenge),
        timeout: Math.max(15000, Number(startOptions.timeout || 60000)),
        userVerification,
        ...(rpId ? { rpId } : {}),
        ...(allowCredentials.length ? { allowCredentials } : {}),
      };

      const assertion = (await navigator.credentials.get({
        publicKey,
      })) as PublicKeyCredential | null;

      if (!assertion) {
        throw new Error("Nao foi possivel validar com o Windows Hello.");
      }

      const response = assertion.response as AuthenticatorAssertionResponse | null;
      if (!response?.clientDataJSON || !response?.authenticatorData || !response?.signature) {
        throw new Error("Resposta invalida do dispositivo ao validar o Windows Hello.");
      }

      const finishRes = await fetch("/api/wz_AuthLogin/verify-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "finish",
          email: email.trim().toLowerCase(),
          ticket: nextPasskeyTicket,
          next: returnTo,
          credential: {
            id: assertion.id,
            rawId: arrayBufferToBase64Url(assertion.rawId),
            type: assertion.type,
            response: {
              clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
              authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
              signature: arrayBufferToBase64Url(response.signature),
              ...(response.userHandle
                ? { userHandle: arrayBufferToBase64Url(response.userHandle) }
                : {}),
            },
          },
        }),
      });

      const finishPayload = (await finishRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!finishRes.ok || !finishPayload?.ok) {
        throw new Error(
          String(finishPayload?.error || "Nao foi possivel concluir a validacao com Windows Hello."),
        );
      }

      const nextUrl = String(finishPayload?.nextUrl || "/app");
      if (/^https?:\/\//i.test(nextUrl)) {
        window.location.assign(nextUrl);
      } else {
        router.push(nextUrl);
      }
    } catch (error: unknown) {
      if ((error as { name?: string } | null)?.name === "NotAllowedError") {
        setTwoFactorFeedback("Solicitacao do Windows Hello cancelada.");
      } else {
        setTwoFactorFeedback(
          error instanceof Error
            ? error.message
            : "Erro inesperado ao validar com Windows Hello.",
        );
      }
    } finally {
      setBusy(false);
      setVerifyingPasskeyLoginBusy(false);
    }
  }, [
    busy,
    email,
    returnTo,
    router,
    twoFactorAllowsPasskey,
    twoFactorTicket,
    verifyingPasskeyLoginBusy,
    setTwoFactorFeedback,
  ]);

  const chooseTwoFactorMethod = useCallback(
    (method: Exclude<LoginAuthMethod, "choose">) => {
      if (method === "totp") {
        if (!twoFactorAllowsTotp) return;
        setTwoFactorMethod("totp");
        setTwoFactorFeedback(null);
        return;
      }
      if (!twoFactorAllowsPasskey) return;
      setTwoFactorMethod("passkey");
      setTwoFactorFeedback(null);
      void verifyPasskeyLogin();
    },
    [
      twoFactorAllowsPasskey,
      twoFactorAllowsTotp,
      verifyPasskeyLogin,
      setTwoFactorFeedback,
    ],
  );

  const backToTwoFactorMethodChoice = useCallback(() => {
    const actionBusy = busy || verifyingTwoFactorCodeBusy || verifyingPasskeyLoginBusy;
    if (actionBusy || !(twoFactorAllowsTotp && twoFactorAllowsPasskey)) return;
    setTwoFactorMethod("choose");
    setTwoFactorCode("");
    setTwoFactorFeedback(null);
  }, [
    busy,
    verifyingTwoFactorCodeBusy,
    verifyingPasskeyLoginBusy,
    twoFactorAllowsTotp,
    twoFactorAllowsPasskey,
    setTwoFactorFeedback,
  ]);

  useEffect(() => {
    if (step !== "twoFactorCode") {
      passkeyAutoStartTicketRef.current = "";
      return;
    }
    if (!twoFactorAllowsPasskey || twoFactorAllowsTotp) return;
    if (!twoFactorTicket || twoFactorIslandLoading) return;
    if (passkeyAutoStartTicketRef.current === twoFactorTicket) return;

    passkeyAutoStartTicketRef.current = twoFactorTicket;
    setTwoFactorMethod("passkey");
    void verifyPasskeyLogin();
  }, [
    step,
    twoFactorAllowsPasskey,
    twoFactorAllowsTotp,
    twoFactorTicket,
    twoFactorIslandLoading,
    verifyPasskeyLogin,
  ]);

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

  // novo: ref do painel onde estão os inputs/steps
  const centerPanelRef = useRef<HTMLDivElement | null>(null);

  const [hideBottomLinks, setHideBottomLinks] = useState(false);

  const rafRef = useRef<number | null>(null);
  const settleFramesRef = useRef(0);
  const holdUntilRef = useRef(0);
  const lastDecisionRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null); // acorda sozinho após HOLD

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

    // NOVO: se BottomLinks encostar em QUALQUER parte do painel (ícone/título/textos/inputs), esconde
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

    // mantém também a proteção específica de interativos (caso queira)
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

    // hardHide agora considera:
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

      // so libera quando nao estiver encostando em nada do painel
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

  // useLayoutEffect evita "piscar" no primeiro paint apos F5
  useLayoutEffect(() => {
    scheduleBottomLinksCheck(14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onAnyChange = () => scheduleBottomLinksCheck(10);

    window.addEventListener("resize", onAnyChange, { passive: true });
    window.addEventListener("scroll", onAnyChange, { passive: true });

    // Zoom do browser / mobile pinch-zoom (quando suportado)
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    vv?.addEventListener("resize", onAnyChange, { passive: true } as any);
    vv?.addEventListener("scroll", onAnyChange, { passive: true } as any);

    // Observa mudanças reais de layout (inclusive após fontes)
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => scheduleBottomLinksCheck(12));
      ro.observe(document.documentElement);
      if (continueBtnRef.current) ro.observe(continueBtnRef.current);
      if (bottomLinksRef.current) ro.observe(bottomLinksRef.current);

      // novo
      if (centerPanelRef.current) ro.observe(centerPanelRef.current);
    } catch {}

    // Quando fontes carregam, o layout muda (evita pisca pós F5)
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
    if (step === "twoFactorCode")
      return <Check className="h-6 w-6 text-black/80" />;
    return <Mail className="h-6 w-6 text-black/80" />;
  }, [step]);

  const twoFactorCanChooseMethod = twoFactorAllowsTotp && twoFactorAllowsPasskey;
  const showTotpInputInIsland =
    twoFactorMethod === "totp" || (twoFactorAllowsTotp && !twoFactorAllowsPasskey);
  const showPasskeyPanelInIsland =
    twoFactorMethod === "passkey" || (!twoFactorAllowsTotp && twoFactorAllowsPasskey);
  const twoFactorActionBusy =
    busy || verifyingTwoFactorCodeBusy || verifyingPasskeyLoginBusy;

  if (checkingExistingSession) {
    return (
      <div className="min-h-screen bg-white relative overflow-hidden">
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <LoginSessionLoader
            reduced={!!prefersReducedMotion}
            label={sessionCheckLabel}
          />
        </div>
      </div>
    );
  }

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
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`login-title:${step}:${showMoreProviders ? "providers" : "default"}:${twoFactorAllowsTotp ? "totp" : "no-totp"}:${twoFactorAllowsPasskey ? "passkey" : "no-passkey"}`}
                    initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.24,
                      ease: EASE,
                    }}
                  >
                    {step === "collect"
                      ? showMoreProviders
                        ? "Outras formas de login"
                        : "Bem Vindo de volta a Wyzer!"
                      : step === "emailCode"
                        ? "Confirme seu endereco de e-mail"
                        : step === "twoFactorCode"
                          ? twoFactorAllowsTotp && twoFactorAllowsPasskey
                            ? "Escolha como validar o login"
                            : twoFactorAllowsPasskey
                              ? "Continue com Windows Hello"
                              : "Confirme a autenticacao de 2 etapas"
                        : "Entrar na Wyzer"}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-2 text-black/55 text-[14px] sm:text-[15px] md:text-[16px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`login-desc:${step}:${showMoreProviders ? "providers" : "default"}:${twoFactorAllowsTotp ? "totp" : "no-totp"}:${twoFactorAllowsPasskey ? "passkey" : "no-passkey"}`}
                    initial={{ opacity: 0, y: 5, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -5, filter: "blur(6px)" }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.22,
                      ease: EASE,
                    }}
                  >
                    {step === "emailCode" ? (
                      <>
                        Insira o codigo enviado para{" "}
                        <span className="text-black/75">
                          {maskEmail(email.trim())}
                        </span>
                      </>
                    ) : step === "twoFactorCode" ? (
                      <>
                        {twoFactorAllowsTotp && twoFactorAllowsPasskey
                          ? "Escolha entre codigo autenticador ou Windows Hello."
                          : twoFactorAllowsPasskey
                            ? "Use o PIN ou biometria do dispositivo para continuar."
                            : "Abra seu aplicativo autenticador para continuar."}
                      </>
                    ) : step === "collect" && showMoreProviders ? (
                      <>Escolha um provedor para continuar.</>
                    ) : (
                      helperText
                    )}
                  </motion.div>
                </AnimatePresence>
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
                    layout: prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 36, mass: 0.9 },
                  }}
                  layout
                  className="mt-10"
                  style={{ willChange: "transform, opacity, filter, height" }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {showMoreProviders ? (
                    <motion.div
                      key="collect-more-providers"
                      variants={collectModeVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      layout
                      className="origin-top"
                    >
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
                            className="mb-3 rounded-[16px] bg-black/5 ring-1 ring-black/10 px-4 py-3 text-[13px] text-black/70"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>{msgError}</span>
                              {passwordSetupPrompt ? (
                                <button
                                  type="button"
                                  onClick={openPasswordSetupModal}
                                  disabled={busy || startingGoogleLogin}
                                  className={cx(
                                    "inline-flex items-center rounded-full border border-black/20 bg-black/[0.04] px-3 py-1 text-[12px] font-semibold text-black/72 transition-colors",
                                    busy || startingGoogleLogin
                                      ? "cursor-not-allowed opacity-60"
                                      : "hover:bg-black/[0.08]",
                                  )}
                                >
                                  {passwordSetupPrompt.ctaLabel}
                                </button>
                              ) : null}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.div variants={collectModeItemVariants}>
                        <button
                          type="button"
                          onClick={startGoogleLogin}
                          disabled={
                            busy ||
                            startingGoogleLogin
                          }
                          className={cx(
                            "group inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[15px] border border-black/10 bg-white text-[15px] font-semibold text-black/82",
                            "transition-[transform,background-color,border-color,box-shadow] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            "hover:border-black/20 hover:bg-black/[0.02] active:translate-y-[0.6px] active:scale-[0.992]",
                            "shadow-[0_10px_28px_rgba(0,0,0,0.08)]",
                            (busy ||
                              startingGoogleLogin) &&
                              "cursor-not-allowed opacity-70",
                          )}
                        >
                          {startingGoogleLogin ? (
                            <SpinnerMini reduced={!!prefersReducedMotion} />
                          ) : (
                            <span
                              aria-hidden
                              className="h-5 w-5 bg-contain bg-center bg-no-repeat"
                              style={{ backgroundImage: `url('${GOOGLE_PROVIDER_ICON_URL}')` }}
                            />
                          )}
                          <span>
                            {startingGoogleLogin ? "Conectando..." : "Continuar com Google"}
                          </span>
                        </button>
                      </motion.div>

                      <motion.div
                        variants={collectModeItemVariants}
                        className="mt-6 flex items-center justify-center"
                      >
                        <button
                          type="button"
                          onClick={resetAll}
                          disabled={
                            busy || startingGoogleLogin
                          }
                          className={cx(
                            "text-[13px] font-semibold transition-colors inline-flex items-center gap-2",
                            busy || startingGoogleLogin
                              ? "text-black/35 cursor-not-allowed"
                              : "text-black/55 hover:text-black/75",
                          )}
                        >
                          <Undo2 className="h-4 w-4" />
                          Voltar ao inicio
                        </button>
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="collect-default-auth"
                      variants={collectModeVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      layout
                      className="origin-top"
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
                        setPasswordSetupPrompt(null);
                        setPasswordSetupModalOpen(false);
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

                    {/* loader / checks / reset 100% centralizados */}
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center">
                      {EmailAdornment}
                    </div>
                  </div>

                  <AnimatePresence mode="sync" initial={false}>
                    {check.state === "exists" && !passwordSetupPrompt && (
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
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>{msgError}</span>
                          {passwordSetupPrompt ? (
                            <button
                              type="button"
                              onClick={openPasswordSetupModal}
                              disabled={busy || startingGoogleLogin}
                              className={cx(
                                "inline-flex items-center rounded-full border border-black/20 bg-black/[0.04] px-3 py-1 text-[12px] font-semibold text-black/72 transition-colors",
                                busy || startingGoogleLogin
                                  ? "cursor-not-allowed opacity-60"
                                  : "hover:bg-black/[0.08]",
                              )}
                            >
                              {passwordSetupPrompt.ctaLabel}
                            </button>
                          ) : null}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Continue */}
                  <motion.button
                    ref={continueBtnRef}
                    type="submit"
                    onClick={startFlow}
                    disabled={
                      !canStart ||
                      busy ||
                      startingGoogleLogin
                    }
                    whileHover={
                      prefersReducedMotion ||
                      !canStart ||
                      busy ||
                      startingGoogleLogin
                        ? undefined
                        : { y: -2, scale: 1.01 }
                    }
                    whileTap={
                      prefersReducedMotion ||
                      !canStart ||
                      busy ||
                      startingGoogleLogin
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
                      !canStart ||
                      busy ||
                      startingGoogleLogin
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
                        prefersReducedMotion ||
                        !canStart ||
                        busy ||
                        startingGoogleLogin
                          ? undefined
                          : { scale: 1.06 }
                      }
                      whileTap={
                        prefersReducedMotion ||
                        !canStart ||
                        busy ||
                        startingGoogleLogin
                          ? undefined
                          : { scale: 0.96 }
                      }
                      transition={{
                        duration: prefersReducedMotion ? 0 : DUR.sm,
                        ease: EASE,
                      }}
                      className={cx(
                        "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-3 transition-all duration-300 ease-out",
                        !canStart ||
                        busy ||
                        startingGoogleLogin
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

                  <div className="mt-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-black/12" />
                    <span className="text-[12px] font-semibold tracking-[0.16em] text-black/42">
                      OU
                    </span>
                    <span className="h-px flex-1 bg-black/12" />
                  </div>

                  <button
                    type="button"
                    onClick={startGoogleLogin}
                    disabled={
                      busy ||
                      startingGoogleLogin
                    }
                    className={cx(
                      "group mt-4 inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[15px] border border-black/10 bg-white text-[15px] font-semibold text-black/82",
                      "transition-[transform,background-color,border-color,box-shadow] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      "hover:border-black/20 hover:bg-black/[0.02] active:translate-y-[0.6px] active:scale-[0.992]",
                      "shadow-[0_10px_28px_rgba(0,0,0,0.08)]",
                      (busy ||
                        startingGoogleLogin) &&
                        "cursor-not-allowed opacity-70",
                    )}
                  >
                    {startingGoogleLogin ? (
                      <SpinnerMini reduced={!!prefersReducedMotion} />
                    ) : (
                      <span
                        aria-hidden
                        className="h-5 w-5 bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url('${GOOGLE_PROVIDER_ICON_URL}')` }}
                      />
                    )}
                    <span>
                      {startingGoogleLogin ? "Conectando..." : "Continuar com Google"}
                    </span>
                  </button>

                    </motion.div>
                  )}
                  </AnimatePresence>
                </motion.form>
              )}
            </AnimatePresence>

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
                    disabled={busy || verifyingEmailCodeBusy} // trava inputs
                    loading={verifyingEmailCodeBusy} // loader central
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
                      disabled={busy || verifyingEmailCodeBusy} // nao deixa remover o codigo no meio
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

          </div>
        </motion.div>
      </div>

      <AnimatePresence mode="sync" initial={false}>
        {step === "collect" && passwordSetupPrompt && passwordSetupModalOpen && (
          <motion.div
            key="password-setup-required-modal"
            className="fixed inset-0 z-[236] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Fechar aviso de criacao de senha"
              className="absolute inset-0 bg-black/62 backdrop-blur-[4px]"
              onClick={() => setPasswordSetupModalOpen(false)}
            />

            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Criar senha para continuar"
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 16, scale: 0.98, filter: "blur(6px)" }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
              }
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 10, scale: 0.98, filter: "blur(6px)" }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0.1 }
                  : { type: "spring", stiffness: 360, damping: 34, mass: 0.82 }
              }
              className="relative z-[1] w-[min(94vw,560px)] rounded-[24px] border border-white/14 bg-white px-6 py-6 shadow-[0_30px_90px_rgba(0,0,0,0.4)] sm:px-7 sm:py-7"
            >
              <button
                type="button"
                onClick={() => setPasswordSetupModalOpen(false)}
                disabled={startingGoogleLogin}
                className={cx(
                  "absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-black/52 transition-colors",
                  startingGoogleLogin
                    ? "cursor-not-allowed opacity-55"
                    : "hover:bg-black/6 hover:text-black/75",
                )}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>

              <h3 className="pr-10 text-[24px] font-semibold leading-[1.15] text-black/85">
                Criar senha para continuar
              </h3>
              <p className="mt-3 text-[15px] leading-[1.45] text-black/62">
                Voce precisa criar senha para continuar o login por aqui. Entre com{" "}
                {passwordSetupPrompt.providerLabel} para abrir as configuracoes e definir sua senha.
              </p>

              <button
                type="button"
                onClick={() => void continuePasswordSetupWithProvider()}
                disabled={busy || startingGoogleLogin}
                className={cx(
                  "group mt-6 inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[15px] border border-black/12 bg-white text-[15px] font-semibold text-black/82",
                  "transition-[transform,background-color,border-color,box-shadow] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "hover:border-black/22 hover:bg-black/[0.02] active:translate-y-[0.6px] active:scale-[0.992]",
                  "shadow-[0_10px_28px_rgba(0,0,0,0.08)]",
                  (busy || startingGoogleLogin) && "cursor-not-allowed opacity-70",
                )}
              >
                {startingGoogleLogin ? (
                  <SpinnerMini reduced={!!prefersReducedMotion} />
                ) : (
                  <span
                    aria-hidden
                    className="h-5 w-5 bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: `url('${GOOGLE_PROVIDER_ICON_URL}')` }}
                  />
                )}
                <span>
                  {startingGoogleLogin
                    ? "Conectando..."
                    : `Continuar com ${passwordSetupPrompt.providerLabel}`}
                </span>
              </button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STEP: TWO FACTOR CODE */}
      <AnimatePresence mode="sync" initial={false}>
        {step === "twoFactorCode" && (
          <motion.div
            key="twoFactorCode"
            className="fixed inset-0 z-[238] px-4 pt-4 sm:px-6 sm:pt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/72 backdrop-blur-[14px]" />

            <div className="relative z-[1] flex flex-col items-center">
              <motion.section
                layout
                role="dialog"
                aria-modal="true"
                className={cx(
                  "relative overflow-hidden border border-white/12 [background:linear-gradient(180deg,#121212_0%,#090909_28%,#000000_100%)] shadow-[0_30px_98px_rgba(0,0,0,0.66)]",
                  twoFactorIslandLoading
                    ? "h-11 w-11 rounded-full p-0"
                    : "w-[min(96vw,560px)] rounded-[30px] px-4 pb-5 pt-3 sm:w-[min(92vw,580px)] sm:px-5 sm:pb-6"
                )}
                initial={{ opacity: 0, y: -58, scale: 0.78, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -74, scale: 0.86, filter: "blur(3px)" }}
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 34,
                  mass: 0.8,
                  layout: { type: "spring", stiffness: 360, damping: 30, mass: 0.9 },
                }}
              >
                <span
                  aria-hidden="true"
                  className="twofactor-island-border pointer-events-none absolute inset-0 rounded-[inherit]"
                  style={{
                    padding: "1.2px",
                    background:
                      "conic-gradient(from var(--a), rgba(255,255,255,0) 0 76%, rgba(255,255,255,0.86) 84%, rgba(255,255,255,0.22) 91%, rgba(255,255,255,0) 100%)",
                    WebkitMask:
                      "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                  }}
                />

                <div className="relative z-[1]">
                  {twoFactorIslandLoading ? (
                    <div className="h-full w-full" />
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-[14px] font-semibold tracking-[0.02em] text-white/92 sm:text-[15px]">
                            {showPasskeyPanelInIsland
                              ? "Continue com Windows Hello"
                              : twoFactorCanChooseMethod
                                ? "Escolha a forma de validacao"
                                : "Confirme a autenticacao de 2 etapas"}
                          </h3>
                          <p className="mt-0.5 text-[12px] text-white/58">
                            {showPasskeyPanelInIsland
                              ? "Confirme com PIN ou biometria do dispositivo."
                              : twoFactorCanChooseMethod
                                ? twoFactorMethod === "choose"
                                  ? "Escolha entre codigo autenticador e Windows Hello."
                                  : "Valide para continuar."
                                : "Abra seu aplicativo autenticador para continuar."}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {twoFactorCanChooseMethod && twoFactorMethod !== "choose" && (
                            <button
                              type="button"
                              onClick={backToTwoFactorMethodChoice}
                              disabled={twoFactorActionBusy}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Voltar para opcoes de validacao"
                            >
                              <Undo2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={resetAll}
                            disabled={twoFactorActionBusy}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Cancelar autenticacao"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {twoFactorCanChooseMethod && twoFactorMethod === "choose" && (
                        <div className="mt-4 flex w-full flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => chooseTwoFactorMethod("totp")}
                            disabled={twoFactorActionBusy}
                            className="h-11 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 text-[12px] font-semibold text-white/78 transition-colors hover:bg-white/[0.1] sm:h-12 sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Codigo de Autenticacao
                          </button>
                          <button
                            type="button"
                            onClick={() => chooseTwoFactorMethod("passkey")}
                            disabled={twoFactorActionBusy}
                            className="h-11 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 text-[12px] font-semibold text-white/78 transition-colors hover:bg-white/[0.1] sm:h-12 sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Windows Hello
                          </button>
                        </div>
                      )}

                      {showTotpInputInIsland && (
                        <motion.div
                          animate={
                            twoFactorShakeTick > 0
                              ? { x: [0, -3, 3, -2, 2, 0] }
                              : { x: 0 }
                          }
                          transition={{ duration: 0.23, ease: "easeOut" }}
                          onMouseDownCapture={clearTwoFactorFeedback}
                          onTouchStartCapture={clearTwoFactorFeedback}
                          onFocusCapture={clearTwoFactorFeedback}
                        >
                          <CodeBoxes
                            length={6}
                            value={twoFactorCode}
                            onChange={setTwoFactorCode}
                            onComplete={(v) => verifyTwoFactorCode(v)}
                            disabled={twoFactorActionBusy}
                            loading={false}
                            reduced={!!prefersReducedMotion}
                            variant="dark"
                          />
                        </motion.div>
                      )}

                    </motion.div>
                  )}
                </div>
              </motion.section>

              <div className="relative z-[1] mt-2 flex w-full justify-center">
                <AnimatePresence initial={false}>
                  {twoFactorInvalidError ? (
                    <motion.div
                      key="login-twofactor-error"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="relative inline-flex overflow-hidden rounded-full"
                    >
                      <span
                        aria-hidden="true"
                        className="twofactor-error-border pointer-events-none absolute inset-0 rounded-[inherit]"
                        style={{
                          padding: "1px",
                          background:
                            "conic-gradient(from var(--a), rgba(227,82,75,0) 0 74%, rgba(227,82,75,0.86) 84%, rgba(227,82,75,0.28) 92%, rgba(227,82,75,0) 100%)",
                          WebkitMask:
                            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                          WebkitMaskComposite: "xor",
                          maskComposite: "exclude",
                        }}
                      />
                      <span className="relative inline-flex rounded-full bg-[#e3524b]/14 px-3 py-1 text-[11px] font-medium text-[#ff8b86]">
                        {twoFactorInvalidError}
                      </span>
                    </motion.div>
                  ) : verifyingPasskeyLoginBusy ? (
                    <motion.div
                      key="login-twofactor-passkey-loading"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="relative inline-flex overflow-hidden rounded-full"
                    >
                      <span
                        aria-hidden="true"
                        className="twofactor-island-border pointer-events-none absolute inset-0 rounded-[inherit]"
                        style={{
                          padding: "1px",
                          background:
                            "conic-gradient(from var(--a), rgba(255,255,255,0) 0 76%, rgba(255,255,255,0.9) 84%, rgba(255,255,255,0.24) 92%, rgba(255,255,255,0) 100%)",
                          WebkitMask:
                            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                          WebkitMaskComposite: "xor",
                          maskComposite: "exclude",
                        }}
                      />
                      <span className="relative inline-flex items-center gap-2 rounded-full bg-black/28 px-3 py-1 text-[11px] font-medium text-white/88">
                        <SpinnerMini reduced={!!prefersReducedMotion} tone="light" />
                        Abrindo o Windows Hello...
                      </span>
                    </motion.div>
                  ) : msgError ? (
                    <motion.div
                      key="login-twofactor-generic-error"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="inline-flex rounded-full bg-[#e3524b]/14 px-3 py-1 text-[11px] font-medium text-[#ffb2ae]"
                    >
                      {msgError}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

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


