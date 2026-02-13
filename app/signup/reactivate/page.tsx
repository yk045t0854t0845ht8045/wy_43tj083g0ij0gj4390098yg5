"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Undo2, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AuthMethod = "choose" | "totp" | "passkey" | "confirm";

type StatusPayload = {
  ok?: boolean;
  state?: string | null;
  emailMask?: string;
  restoreDeadlineAt?: string | null;
  canReactivate?: boolean;
  authMethods?: { totp?: boolean; passkey?: boolean };
  error?: string;
};

type PasskeyRequestOptionsPayload = {
  challenge: string;
  rpId: string;
  timeout?: number;
  userVerification?: "required" | "preferred" | "discouraged";
  allowCredentials?: Array<{ type: "public-key"; id: string; transports?: string[] }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D+/g, "");
}

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
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function formatDeadline(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPasskeySupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.PublicKeyCredential && navigator.credentials?.get);
}

function CodeBoxes({
  length,
  value,
  onChange,
  onComplete,
  disabled,
  variant = "light",
}: {
  length: number;
  value: string;
  onChange: (next: string) => void;
  onComplete?: (next: string) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const lastCompletedRef = useRef("");
  const dark = variant === "dark";

  const digits = useMemo(() => {
    const clean = onlyDigits(value).slice(0, length);
    return Array.from({ length }, (_, i) => clean[i] || "");
  }, [length, value]);

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

  const setAt = (index: number, char: string) => {
    const clean = onlyDigits(value).slice(0, length).split("");
    while (clean.length < length) clean.push("");
    clean[index] = char;
    onChange(clean.join(""));
  };

  const focusAt = (index: number) => refs.current[index]?.focus();

  return (
    <div className="mt-5 flex items-center justify-center gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => {
            if (disabled) return;
            const char = onlyDigits(e.target.value).slice(-1);
            setAt(i, char);
            if (char && i < length - 1) focusAt(i + 1);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Backspace") {
              if (digits[i]) {
                setAt(i, "");
              } else if (i > 0) {
                focusAt(i - 1);
                setAt(i - 1, "");
              }
            }
            if (e.key === "ArrowLeft" && i > 0) focusAt(i - 1);
            if (e.key === "ArrowRight" && i < length - 1) focusAt(i + 1);
          }}
          className={cx(
            dark
              ? "h-11 w-9 rounded-[10px] border border-white/14 bg-black/[0.58] text-center text-[16px] font-semibold text-white/94"
              : "h-11 w-9 rounded-[10px] border border-black/12 bg-[#ececef] text-center text-[16px] font-semibold text-black/85",
            dark ? "focus:outline-none focus:ring-2 focus:ring-white/18" : "focus:outline-none focus:ring-2 focus:ring-black/20",
            disabled ? "cursor-not-allowed opacity-70" : "",
          )}
        />
      ))}
    </div>
  );
}

export default function ReactivatePage() {
  const router = useRouter();

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<"confirm-intent" | "verify-email" | "verify-auth">("confirm-intent");
  const [ticket, setTicket] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [allowTotp, setAllowTotp] = useState(true);
  const [allowPasskey, setAllowPasskey] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("totp");

  const [startingFlow, setStartingFlow] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [verifyingStep, setVerifyingStep] = useState(false);
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);
  const [restoringAccount, setRestoringAccount] = useState(false);

  const actionBusy = startingFlow || resendingCode || verifyingStep || verifyingPasskey || restoringAccount;
  const statusState = String(status?.state || "").trim().toLowerCase();
  const isAlreadyActive = statusState === "active";
  const canReactivate = Boolean(status?.canReactivate);
  const requiresExplicitConfirm = !allowTotp && !allowPasskey;
  const canChooseMethod = allowTotp && allowPasskey;
  const showTotpInput =
    !requiresExplicitConfirm && (authMethod === "totp" || (allowTotp && !allowPasskey));
  const showPasskeyFlow =
    !requiresExplicitConfirm && (authMethod === "passkey" || (!allowTotp && allowPasskey));

  const deadlineLabel = useMemo(() => formatDeadline(status?.restoreDeadlineAt), [status?.restoreDeadlineAt]);

  const refreshStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      setStatusError(null);
      const res = await fetch("/api/wz_users/account-reactivate", { method: "GET", cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as StatusPayload;
      setStatusCode(res.status);
      if (!res.ok || !payload?.ok) {
        throw new Error(String(payload?.error || "Nao foi possivel carregar o status da conta."));
      }
      setStatus(payload);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const resetFlowState = useCallback(() => {
    setStep("confirm-intent");
    setTicket("");
    setEmailCode("");
    setTotpCode("");
    setModalError(null);
    setAuthError(null);
    setResendCooldown(0);
    setAllowTotp(true);
    setAllowPasskey(false);
    setAuthMethod("totp");
    setRestoringAccount(false);
  }, []);

  const applyAuthMethods = useCallback((methods?: { totp?: boolean; passkey?: boolean }) => {
    const hasTotp = Boolean(methods?.totp);
    const hasPasskey = Boolean(methods?.passkey);

    setAllowTotp(hasTotp);
    setAllowPasskey(hasPasskey);
    setAuthMethod(
      hasTotp && hasPasskey ? "choose" : hasPasskey ? "passkey" : hasTotp ? "totp" : "confirm",
    );
    setTotpCode("");
    setAuthError(null);
  }, []);

  const closeModal = useCallback(() => {
    if (actionBusy) return;
    setModalOpen(false);
    resetFlowState();
  }, [actionBusy, resetFlowState]);

  const handleRestored = useCallback(async () => {
    setRestoringAccount(true);
    setModalError(null);
    setAuthError(null);
    await refreshStatus().catch(() => undefined);
    await new Promise((resolve) => window.setTimeout(resolve, 5000));
    setRestoringAccount(false);
    setModalOpen(false);
    resetFlowState();
    router.replace("/");
  }, [refreshStatus, resetFlowState, router]);

  const openConfirmModal = useCallback(() => {
    if (actionBusy || !canReactivate) return;
    setStatusError(null);
    resetFlowState();
    setStep("confirm-intent");
    setModalOpen(true);
  }, [actionBusy, canReactivate, resetFlowState]);

  const startFlow = useCallback(async () => {
    if (actionBusy || !canReactivate) return;

    try {
      setStartingFlow(true);
      setStatusError(null);
      const res = await fetch("/api/wz_users/account-reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmReactivate: true }),
      });
      const payload = (await res.json().catch(() => ({}))) as StatusPayload & { ticket?: string };
      if (!res.ok || !payload?.ok || !payload.ticket) {
        throw new Error(String(payload?.error || "Nao foi possivel iniciar a reativacao."));
      }
      setTicket(String(payload.ticket));
      setStep("verify-email");
      setEmailCode("");
      setModalError(null);
      setResendCooldown(60);
      setModalOpen(true);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Erro inesperado ao iniciar reativacao.");
    } finally {
      setStartingFlow(false);
    }
  }, [actionBusy, canReactivate]);

  const resendEmailCode = useCallback(async () => {
    if (!ticket || actionBusy || resendCooldown > 0 || step !== "verify-email") return;

    try {
      setResendingCode(true);
      setModalError(null);
      const res = await fetch("/api/wz_users/account-reactivate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; ticket?: string; error?: string };
      if (!res.ok || !payload?.ok) {
        throw new Error(String(payload?.error || "Nao foi possivel reenviar o codigo."));
      }
      if (payload.ticket) setTicket(String(payload.ticket));
      setResendCooldown(60);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Erro ao reenviar codigo.");
    } finally {
      setResendingCode(false);
    }
  }, [actionBusy, resendCooldown, step, ticket]);

  const verifyAuth = useCallback(
    async (providedTotpCode?: string, providedPasskeyProof?: string) => {
      if (!ticket || actionBusy) return;

      const explicitConfirmOnly = !allowTotp && !allowPasskey;
      const twoFactorCode = onlyDigits(String(providedTotpCode || totpCode || "")).slice(0, 6);
      const passkeyProof = String(providedPasskeyProof || "").trim();
      if (!explicitConfirmOnly && twoFactorCode.length !== 6 && !passkeyProof) return;

      try {
        setVerifyingStep(true);
        setAuthError(null);

        const res = await fetch("/api/wz_users/account-reactivate", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticket,
            ...(explicitConfirmOnly ? { confirmReactivate: true } : {}),
            ...(twoFactorCode.length === 6 ? { twoFactorCode } : {}),
            ...(passkeyProof ? { passkeyProof } : {}),
          }),
        });

        const payload = (await res.json().catch(() => ({}))) as StatusPayload & {
          restored?: boolean;
          authMethods?: { totp?: boolean; passkey?: boolean };
        };

        if (!res.ok || !payload?.ok) {
          if (payload?.authMethods) applyAuthMethods(payload.authMethods);
          setAuthError(String(payload?.error || "Nao foi possivel confirmar a reativacao."));
          setTotpCode("");
          return;
        }

        if (payload.restored) await handleRestored();
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Erro inesperado ao confirmar reativacao.");
      } finally {
        setVerifyingStep(false);
      }
    },
    [actionBusy, allowPasskey, allowTotp, applyAuthMethods, handleRestored, ticket, totpCode],
  );

  const verifyEmail = useCallback(
    async (value?: string) => {
      if (!ticket || actionBusy || step !== "verify-email") return;
      const code = onlyDigits(String(value || emailCode || "")).slice(0, 7);
      if (code.length !== 7) return;

      try {
        setVerifyingStep(true);
        setModalError(null);

        const res = await fetch("/api/wz_users/account-reactivate", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket, emailCode: code }),
        });

        const payload = (await res.json().catch(() => ({}))) as StatusPayload & {
          next?: "verify-auth";
          ticket?: string;
          restored?: boolean;
          authMethods?: { totp?: boolean; passkey?: boolean };
        };

        if (!res.ok || !payload?.ok) {
          const fallback =
            res.status === 429
              ? "Voce atingiu o limite de 7 tentativas. Reenvie o codigo."
              : "Codigo invalido. Tente novamente.";
          setModalError(String(payload?.error || fallback));
          setEmailCode("");
          if (res.status === 429) setResendCooldown(0);
          return;
        }

        if (payload.restored) {
          await handleRestored();
          return;
        }

        if (payload.next === "verify-auth") {
          if (!payload.ticket) throw new Error("Resposta invalida do servidor.");
          setTicket(String(payload.ticket));
          setStep("verify-auth");
          applyAuthMethods(payload.authMethods);
          setEmailCode("");
          return;
        }

        throw new Error("Fluxo de reativacao invalido.");
      } catch (error) {
        setModalError(error instanceof Error ? error.message : "Erro inesperado ao validar codigo.");
      } finally {
        setVerifyingStep(false);
      }
    },
    [actionBusy, applyAuthMethods, emailCode, handleRestored, step, ticket],
  );

  const verifyWithWindowsHello = useCallback(async () => {
    if (!ticket || actionBusy || !allowPasskey) return;
    if (!isPasskeySupported()) {
      setAuthError("Seu navegador/dispositivo nao suporta Windows Hello neste ambiente.");
      return;
    }

    try {
      setVerifyingPasskey(true);
      setAuthError(null);

      const startRes = await fetch("/api/wz_users/passkeys-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "start" }),
      });
      const startPayload = (await startRes.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        options?: PasskeyRequestOptionsPayload;
        error?: string;
      };
      if (!startRes.ok || !startPayload?.ok || !startPayload.ticket || !startPayload.options) {
        throw new Error(String(startPayload?.error || "Nao foi possivel iniciar o Windows Hello."));
      }

      const options = startPayload.options;
      const passkeyAuthTicket = String(startPayload.ticket);
      const allowCredentials: PublicKeyCredentialDescriptor[] = (options.allowCredentials || [])
        .map((item) => ({
          type: "public-key" as const,
          id: base64UrlToUint8Array(item.id),
        }))
        .filter((item) => item.id.length > 0)
        .map((item) => ({ type: item.type, id: item.id as BufferSource }));

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: base64UrlToUint8Array(options.challenge),
          timeout: Math.max(15000, Number(options.timeout || 60000)),
          userVerification: "required",
          ...(String(options.rpId || "").trim() ? { rpId: String(options.rpId) } : {}),
          ...(allowCredentials.length ? { allowCredentials } : {}),
        },
      })) as PublicKeyCredential | null;

      if (!assertion) throw new Error("Nao foi possivel validar com o Windows Hello.");
      const response = assertion.response as AuthenticatorAssertionResponse | null;
      if (!response?.clientDataJSON || !response?.authenticatorData || !response?.signature) {
        throw new Error("Resposta invalida do dispositivo ao validar o Windows Hello.");
      }

      const finishRes = await fetch("/api/wz_users/passkeys-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "finish",
          ticket: passkeyAuthTicket,
          credential: {
            id: assertion.id,
            rawId: arrayBufferToBase64Url(assertion.rawId),
            type: assertion.type,
            response: {
              clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
              authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
              signature: arrayBufferToBase64Url(response.signature),
            },
          },
        }),
      });
      const finishPayload = (await finishRes.json().catch(() => ({}))) as {
        ok?: boolean;
        passkeyProof?: string;
        error?: string;
      };
      if (!finishRes.ok || !finishPayload?.ok || !finishPayload.passkeyProof) {
        throw new Error(String(finishPayload?.error || "Nao foi possivel concluir o Windows Hello."));
      }

      await verifyAuth(undefined, String(finishPayload.passkeyProof));
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "NotAllowedError") {
        if (canChooseMethod) {
          setAuthMethod("choose");
          setTotpCode("");
          setAuthError(null);
          return;
        }
        setAuthError("Solicitacao do Windows Hello cancelada.");
        return;
      }
      setAuthError(error instanceof Error ? error.message : "Erro inesperado ao validar com Windows Hello.");
    } finally {
      setVerifyingPasskey(false);
    }
  }, [actionBusy, allowPasskey, canChooseMethod, ticket, verifyAuth]);

  const loginUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://login.wyzer.com.br/";
    const host = window.location.hostname.toLowerCase();
    const origin = host.endsWith(".localhost") || host === "localhost" ? "http://login.localhost:3000" : "https://login.wyzer.com.br";
    const target = new URL(origin);
    target.searchParams.set("returnTo", `${window.location.origin}/signup/reactivate`);
    target.searchParams.set("forceLogin", "1");
    return target.toString();
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_25%_10%,rgba(0,0,0,0.08),transparent_34%),radial-gradient(circle_at_85%_12%,rgba(0,0,0,0.05),transparent_28%),linear-gradient(180deg,#f6f6f7_0%,#ececef_46%,#f4f4f5_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[86vh] w-full max-w-[920px] items-center justify-center">
        <section className="w-full max-w-[760px] overflow-hidden rounded-3xl border border-black/10 bg-white/92 shadow-[0_32px_84px_rgba(0,0,0,0.24)]">
          <div className="px-6 pb-7 pt-8 sm:px-8 sm:pb-8 sm:pt-9 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/flow-icon.png" alt="Conta em reativacao" className="mx-auto h-24 w-24 rounded-2xl border border-black/10 bg-black/[0.04] object-contain p-3" />

            <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.02em] text-black/82 sm:text-[33px]">Conta em exclusao temporaria</h1>

            <p className="mt-3 text-[15px] leading-[1.55] text-black/62">
              Sua conta foi bloqueada por seguranca. Durante 14 dias voce ainda pode restaurar com validacao de e-mail e autenticacao adicional.
              {" "}
              <Link href="https://privacy.wyzer.com.br" className="font-semibold text-black/75 underline-offset-2 hover:underline">Politica de Privacidade</Link>
            </p>

            <p className="mt-3 text-[13px] leading-[1.5] text-black/50">
              Depois do prazo, os dados permanecem arquivados e a reativacao fica indisponivel.
            </p>

            {deadlineLabel && (
              <p className="mt-4 rounded-xl border border-black/10 bg-black/[0.04] px-3 py-2 text-[13px] font-medium text-black/68">
                Prazo final para restaurar: <span className="font-semibold text-black/78">{deadlineLabel}</span>
              </p>
            )}

            {loadingStatus && <p className="mt-4 text-[14px] text-black/52">Carregando status da conta...</p>}

            {!loadingStatus && statusError && (
              <div className="mt-4 rounded-2xl border border-[#e3524b]/22 bg-[#e3524b]/9 px-4 py-3 text-left text-[13px] font-medium text-[#b2433e]">
                {statusError}
                {statusCode === 401 && (
                  <div className="mt-3">
                    <a href={loginUrl} className="inline-flex rounded-xl border border-[#b2433e]/30 bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#9f3c37]">
                      Fazer login para reativar
                    </a>
                  </div>
                )}
              </div>
            )}

            {!loadingStatus && !statusError && isAlreadyActive && (
              <div className="mt-4 rounded-2xl border border-black/12 bg-black/[0.05] px-4 py-3 text-left text-[13px] font-medium text-black/62">
                <p className="text-black/72">Esta conta ja esta ativa.</p>
                <button
                  type="button"
                  onClick={() => router.replace("/")}
                  className="mt-3 rounded-xl bg-[#171717] px-4 py-2 text-[12px] font-semibold text-white transition-all duration-220 hover:bg-[#222222]"
                >
                  Ir para o dashboard
                </button>
              </div>
            )}

            {!loadingStatus && !statusError && !canReactivate && !isAlreadyActive && (
              <p className="mt-4 rounded-xl border border-black/12 bg-black/[0.05] px-3 py-2 text-[13px] font-medium text-black/62">
                O prazo de reativacao terminou para esta conta.
              </p>
            )}

            {!loadingStatus && !statusError && canReactivate && (
              <button
                type="button"
                onClick={openConfirmModal}
                disabled={actionBusy}
                className="mt-6 rounded-xl bg-[#171717] px-6 py-3 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-65"
              >
                Reativar conta
              </button>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div className="fixed inset-0 z-[220] flex items-center justify-center p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/46 backdrop-blur-[5px]" onClick={closeModal} />

            <motion.section
              role="dialog"
              aria-modal="true"
              className="relative z-[1] w-[min(96vw,680px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_26px_70px_rgba(0,0,0,0.35)] sm:w-[min(92vw,700px)]"
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                <h3 className="text-[18px] font-semibold text-black/80">Reativar conta</h3>
                <button type="button" onClick={closeModal} disabled={actionBusy} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-60">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                {restoringAccount ? (
                  <div className="rounded-2xl border border-black/12 bg-black/[0.04] px-4 py-5 text-center">
                    <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-black/80 px-3 py-1 text-[11px] font-medium text-white/92">
                      <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border border-white/45 border-t-white" />
                      Reativando a conta, aguarde...
                    </span>
                    <p className="mt-3 text-[12px] text-black/56">
                      Estamos finalizando a reativacao com seguranca.
                    </p>
                  </div>
                ) : (
                  <>
                    {step === "confirm-intent" && (
                      <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-4 text-left">
                        <h4 className="text-[14px] font-semibold text-black/78">Confirmar reativacao da conta</h4>
                        <p className="mt-2 text-[13px] leading-[1.5] text-black/62">
                          Para reativar, voce vai confirmar em duas etapas:
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-black/62">
                          <li>Codigo de 7 digitos enviado para o e-mail da conta.</li>
                          <li>Validacao final na ilha dinamica (autenticador, Windows Hello ou confirmacao final).</li>
                        </ul>
                        <p className="mt-2 text-[13px] text-black/62">
                          E-mail para confirmacao: <span className="font-semibold text-black/78">{String(status?.emailMask || "seu e-mail")}</span>
                        </p>

                        <div className="mt-4 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={closeModal}
                            disabled={actionBusy}
                            className="rounded-xl border border-black/12 bg-white px-3 py-2 text-[12px] font-semibold text-black/65 transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-65"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void startFlow()}
                            disabled={actionBusy}
                            className="rounded-xl bg-[#171717] px-4 py-2 text-[12px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {startingFlow ? "Iniciando..." : "Confirmar e continuar"}
                          </button>
                        </div>
                      </div>
                    )}

                    {step === "verify-email" && (
                      <>
                        <p className="text-[14px] leading-[1.45] text-black/62">
                          Digite o codigo de 7 digitos enviado para <span className="font-semibold text-black/78">{String(status?.emailMask || "seu e-mail")}</span>.
                        </p>

                        <CodeBoxes length={7} value={emailCode} onChange={setEmailCode} onComplete={(value) => { void verifyEmail(value); }} disabled={actionBusy} />

                        <div className="mt-4 flex items-center justify-between">
                          <button type="button" onClick={() => void resendEmailCode()} disabled={actionBusy || resendCooldown > 0} className="text-[12px] font-semibold text-black/56 hover:text-black/78 disabled:cursor-not-allowed disabled:opacity-58">
                            {resendCooldown > 0 ? `Reenviar codigo (${resendCooldown}s)` : "Reenviar codigo"}
                          </button>

                          <button type="button" onClick={() => void verifyEmail()} disabled={actionBusy || onlyDigits(emailCode).length !== 7} className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70">
                            {verifyingStep ? "Validando..." : "Validar e continuar"}
                          </button>
                        </div>
                      </>
                    )}

                    {step === "verify-auth" && (
                      <div>
                        <section className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,#121212_0%,#090909_28%,#000000_100%)] px-4 pb-5 pt-3 shadow-[0_24px_66px_rgba(0,0,0,0.58)] sm:px-5 sm:pb-6">
                          <div className="relative z-[1]">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-[14px] font-semibold tracking-[0.02em] text-white/92 sm:text-[15px]">
                                  {canChooseMethod && authMethod === "choose" ? "Escolha a forma de validacao" : "Confirmar reativacao"}
                                </h4>
                                <p className="mt-0.5 text-[12px] text-white/58">
                                  {canChooseMethod && authMethod === "choose"
                                    ? "Escolha entre codigo autenticador e Windows Hello."
                                    : requiresExplicitConfirm
                                      ? "Confirme a reativacao final para concluir o processo."
                                      : showPasskeyFlow
                                        ? "Confirme no prompt do Windows Hello."
                                        : "Digite o codigo de 6 digitos do aplicativo autenticador."}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {canChooseMethod && authMethod !== "choose" && (
                                  <button type="button" onClick={() => { if (actionBusy) return; setAuthMethod("choose"); setTotpCode(""); setAuthError(null); }} disabled={actionBusy} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60" aria-label="Voltar para opcoes de validacao">
                                    <Undo2 className="h-4 w-4" />
                                  </button>
                                )}
                                <button type="button" onClick={closeModal} disabled={actionBusy} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {canChooseMethod && authMethod === "choose" && (
                              <div className="mt-4 flex w-full flex-col gap-2">
                                <button type="button" onClick={() => { if (actionBusy || !allowTotp) return; setAuthMethod("totp"); setTotpCode(""); setAuthError(null); }} disabled={actionBusy} className="h-11 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 text-[12px] font-semibold text-white/78 transition-colors hover:bg-white/[0.1] sm:h-12 sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-60">
                                  Codigo de Autenticacao
                                </button>
                                <button type="button" onClick={() => { if (actionBusy || !allowPasskey) return; setAuthMethod("passkey"); setTotpCode(""); setAuthError(null); void verifyWithWindowsHello(); }} disabled={actionBusy} className="h-11 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 text-[12px] font-semibold text-white/78 transition-colors hover:bg-white/[0.1] sm:h-12 sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-60">
                                  Windows Hello
                                </button>
                              </div>
                            )}

                            {showTotpInput && (
                              <CodeBoxes length={6} value={totpCode} onChange={setTotpCode} onComplete={(value) => { void verifyAuth(value); }} disabled={actionBusy} variant="dark" />
                            )}

                            {showPasskeyFlow && !canChooseMethod && (
                              <div className="mt-4">
                                <button
                                  type="button"
                                  onClick={() => { if (actionBusy) return; void verifyWithWindowsHello(); }}
                                  disabled={actionBusy}
                                  className="h-11 w-full rounded-xl border border-white/24 bg-white/[0.08] px-4 text-[12px] font-semibold text-white/90 transition-colors hover:bg-white/[0.14] sm:h-12 sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {verifyingPasskey ? "Abrindo Windows Hello..." : "Continuar com Windows Hello"}
                                </button>
                              </div>
                            )}

                            {requiresExplicitConfirm && (
                              <div className="mt-4">
                                <button
                                  type="button"
                                  onClick={() => void verifyAuth()}
                                  disabled={actionBusy}
                                  className="h-11 w-full rounded-xl border border-white/24 bg-white/[0.08] px-4 text-[12px] font-semibold text-white/90 transition-colors hover:bg-white/[0.14] sm:h-12 sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {verifyingStep ? "Confirmando..." : "Confirmar reativacao"}
                                </button>
                              </div>
                            )}
                          </div>
                        </section>

                        <div className="mt-2 flex justify-center">
                          {verifyingPasskey ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-black/28 px-3 py-1 text-[11px] font-medium text-white/88">
                              <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border border-white/45 border-t-white" />
                              Autenticando Windows Hello, aguarde...
                            </span>
                          ) : authError ? (
                            <span className="inline-flex rounded-full bg-[#e3524b]/14 px-3 py-1 text-[11px] font-medium text-[#ffb2ae]">
                              {authError}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {modalError && (
                      <p className="mt-4 rounded-xl border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">{modalError}</p>
                    )}
                  </>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
