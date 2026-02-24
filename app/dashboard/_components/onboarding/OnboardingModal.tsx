"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  MessageCircle,
  QrCode,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type WizardStep = "company" | "team" | "whatsapp" | "final";

export type OnboardingState = {
  id: string;
  userId: string;
  authUserId: string | null;
  email: string;
  companyName: string | null;
  companyLogoUrl: string | null;
  companyCnpj: string | null;
  industry: string | null;
  welcomeConfirmed: boolean;
  teamAgentsCount: number | null;
  whatsappConnected: boolean;
  whatsappConnectedAt: string | null;
  whatsappPairingCode: string | null;
  whatsappPairingExpiresAt: string | null;
  uiStep: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type OnboardingApiPayload = {
  ok?: boolean;
  error?: string;
  onboarding?: OnboardingState;
  qrCodeDataUrl?: string;
  pairingCode?: string;
  pairingExpiresAt?: string;
  pairingUrl?: string;
  companyLogoUrl?: string;
};

type OnboardingModalProps = {
  open: boolean;
  required?: boolean;
  userEmail: string;
  initialData?: OnboardingState | null;
  onClose: () => void;
  onUpdated?: (next: OnboardingState) => void;
  onCompleted?: (next: OnboardingState) => void;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeCnpjDigits(value?: string | null) {
  const digits = String(value || "").replace(/\D+/g, "");
  return digits || "";
}

function formatCnpj(value?: string | null) {
  const digits = normalizeCnpjDigits(value).slice(0, 14);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function normalizeStepFromOnboarding(onboarding?: OnboardingState | null): WizardStep {
  if (!onboarding) return "company";
  if (onboarding.completed || onboarding.uiStep === "final") return "final";
  if (onboarding.uiStep === "whatsapp") return "whatsapp";
  if (onboarding.uiStep === "team") return "team";
  return "company";
}

function toLocalStepIndex(step: WizardStep) {
  if (step === "company") return 0;
  if (step === "team") return 1;
  if (step === "whatsapp") return 2;
  return 3;
}

function isValidCompanyForm(params: {
  companyName: string;
  industry: string;
  companyLogoUrl: string;
  companyCnpj: string;
}) {
  const companyName = String(params.companyName || "").trim();
  const industry = String(params.industry || "").trim();
  const logoUrl = String(params.companyLogoUrl || "").trim();
  const cnpjDigits = normalizeCnpjDigits(params.companyCnpj);

  if (!companyName) return "Informe o nome da empresa.";
  if (!industry) return "Informe a area de atuacao da empresa.";
  if (!logoUrl) return "Envie a logo da empresa para continuar.";
  if (cnpjDigits && cnpjDigits.length !== 14) return "CNPJ invalido. Use 14 digitos.";
  return null;
}

function isValidTeamCount(value: string) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed)) return false;
  return parsed >= 1 && parsed <= 5000;
}

function maskEmail(value?: string | null) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "indisponivel";
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`;
}

function pickFileExtension(file: File) {
  const name = String(file.name || "").toLowerCase();
  if (name.includes(".")) return name.split(".").pop() || "";
  return "";
}

export default function OnboardingModal({
  open,
  required = false,
  userEmail,
  initialData = null,
  onClose,
  onUpdated,
  onCompleted,
}: OnboardingModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(initialData);
  const [activeStep, setActiveStep] = useState<WizardStep>(normalizeStepFromOnboarding(initialData));
  const [companyName, setCompanyName] = useState(String(initialData?.companyName || ""));
  const [companyLogoUrl, setCompanyLogoUrl] = useState(String(initialData?.companyLogoUrl || ""));
  const [companyCnpj, setCompanyCnpj] = useState(formatCnpj(initialData?.companyCnpj || ""));
  const [industry, setIndustry] = useState(String(initialData?.industry || ""));
  const [teamAgentsCount, setTeamAgentsCount] = useState(
    initialData?.teamAgentsCount ? String(initialData.teamAgentsCount) : "",
  );
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [pairingCode, setPairingCode] = useState<string>("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string>("");
  const canDismiss = !required || Boolean(onboarding?.completed);

  const handleDismiss = useCallback(() => {
    if (!canDismiss) return;
    onClose();
  }, [canDismiss, onClose]);

  const progressPercent = useMemo(() => {
    const idx = toLocalStepIndex(activeStep);
    return Math.round(((idx + 1) / 4) * 100);
  }, [activeStep]);

  const canGoBack = activeStep !== "company";

  const leftSteps = useMemo(() => {
    return [
      { id: "company" as WizardStep, title: "Dados da empresa", subtitle: "Logo, nome, CNPJ e atuacao", icon: Building2 },
      { id: "team" as WizardStep, title: "Estrutura de atendimento", subtitle: "Quantidade de funcionarios", icon: Users },
      { id: "whatsapp" as WizardStep, title: "Conectar WhatsApp", subtitle: "Gerar e confirmar QR Code", icon: MessageCircle },
      { id: "final" as WizardStep, title: "Tudo pronto", subtitle: "Revisar e concluir", icon: CheckCircle2 },
    ];
  }, []);

  const applyOnboardingUpdate = useCallback(
    (next: OnboardingState) => {
      setOnboarding(next);
      setCompanyName(String(next.companyName || ""));
      setCompanyLogoUrl(String(next.companyLogoUrl || ""));
      setCompanyCnpj(formatCnpj(next.companyCnpj || ""));
      setIndustry(String(next.industry || ""));
      setTeamAgentsCount(next.teamAgentsCount ? String(next.teamAgentsCount) : "");
      setActiveStep(normalizeStepFromOnboarding(next));
      setPairingCode(String(next.whatsappPairingCode || ""));
      setPairingExpiresAt(next.whatsappPairingExpiresAt || null);
      onUpdated?.(next);
    },
    [onUpdated],
  );

  const fetchOnboarding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wz_users/onboarding", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as OnboardingApiPayload;
      if (!res.ok || !payload?.ok || !payload.onboarding) {
        throw new Error(String(payload?.error || "Nao foi possivel carregar onboarding."));
      }
      applyOnboardingUpdate(payload.onboarding);
      setQrCodeDataUrl(String(payload.qrCodeDataUrl || ""));
      setPairingCode(String(payload.pairingCode || payload.onboarding.whatsappPairingCode || ""));
      setPairingExpiresAt(String(payload.pairingExpiresAt || payload.onboarding.whatsappPairingExpiresAt || "") || null);
      setPairingUrl(String(payload.pairingUrl || ""));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar onboarding.");
    } finally {
      setLoading(false);
    }
  }, [applyOnboardingUpdate]);

  useEffect(() => {
    if (!initialData) return;
    applyOnboardingUpdate(initialData);
  }, [applyOnboardingUpdate, initialData]);

  useEffect(() => {
    if (!open) return;
    void fetchOnboarding();
  }, [fetchOnboarding, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!canDismiss) {
        event.preventDefault();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [canDismiss, onClose, open]);

  const postAction = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch("/api/wz_users/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as OnboardingApiPayload;
      if (!res.ok || !payload?.ok || !payload.onboarding) {
        throw new Error(String(payload?.error || "Falha ao salvar onboarding."));
      }

      applyOnboardingUpdate(payload.onboarding);
      if (payload.qrCodeDataUrl) setQrCodeDataUrl(String(payload.qrCodeDataUrl));
      if (payload.pairingCode) setPairingCode(String(payload.pairingCode));
      if (payload.pairingExpiresAt) setPairingExpiresAt(String(payload.pairingExpiresAt));
      if (payload.pairingUrl) setPairingUrl(String(payload.pairingUrl));
      if (payload.onboarding.completed) onCompleted?.(payload.onboarding);
      return payload;
    },
    [applyOnboardingUpdate, onCompleted],
  );

  const handleCompanyContinue = useCallback(async () => {
    setError(null);
    const validationError = isValidCompanyForm({
      companyName,
      industry,
      companyLogoUrl,
      companyCnpj,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      await postAction({
        action: "save-company",
        companyName,
        industry,
        companyLogoUrl,
        companyCnpj: normalizeCnpjDigits(companyCnpj),
      });
      setActiveStep("team");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar dados da empresa.");
    } finally {
      setSaving(false);
    }
  }, [companyCnpj, companyLogoUrl, companyName, industry, postAction]);

  const handleTeamContinue = useCallback(async () => {
    setError(null);
    if (!isValidTeamCount(teamAgentsCount)) {
      setError("Informe a quantidade de funcionarios entre 1 e 5000.");
      return;
    }

    try {
      setSaving(true);
      await postAction({
        action: "save-team",
        teamAgentsCount: Number.parseInt(teamAgentsCount, 10),
      });
      setActiveStep("whatsapp");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar os dados do time.");
    } finally {
      setSaving(false);
    }
  }, [postAction, teamAgentsCount]);

  const handleGenerateQr = useCallback(async () => {
    setError(null);
    try {
      setSaving(true);
      await postAction({ action: "generate-whatsapp-qr" });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel gerar QR Code.");
    } finally {
      setSaving(false);
    }
  }, [postAction]);

  const handleConfirmWhatsApp = useCallback(async () => {
    setError(null);
    try {
      setSaving(true);
      await postAction({
        action: "confirm-whatsapp",
        pairingCode: pairingCode || undefined,
      });
      setActiveStep("final");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel confirmar conexao do WhatsApp.");
    } finally {
      setSaving(false);
    }
  }, [pairingCode, postAction]);

  const handleFinish = useCallback(async () => {
    setError(null);
    try {
      setSaving(true);
      await postAction({ action: "finish" });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel concluir onboarding.");
    } finally {
      setSaving(false);
    }
  }, [postAction]);

  const handleBackStep = useCallback(() => {
    setError(null);
    if (activeStep === "final") {
      setActiveStep("whatsapp");
      return;
    }
    if (activeStep === "whatsapp") {
      setActiveStep("team");
      return;
    }
    if (activeStep === "team") {
      setActiveStep("company");
    }
  }, [activeStep]);

  const handleLogoUpload = useCallback(async (file: File) => {
    setError(null);
    const ext = pickFileExtension(file);
    if (!ext) {
      setError("Arquivo de logo invalido.");
      return;
    }
    try {
      setUploadingLogo(true);
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/wz_users/onboarding/logo", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as OnboardingApiPayload;
      if (!res.ok || !payload?.ok || !payload.companyLogoUrl) {
        throw new Error(String(payload?.error || "Nao foi possivel enviar a logo."));
      }
      setCompanyLogoUrl(String(payload.companyLogoUrl));
      if (payload.onboarding) {
        applyOnboardingUpdate(payload.onboarding);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Falha ao enviar logo.");
    } finally {
      setUploadingLogo(false);
    }
  }, [applyOnboardingUpdate]);

  const openLogoPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onLogoChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await handleLogoUpload(file);
      event.target.value = "";
    },
    [handleLogoUpload],
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[240] flex items-center justify-center p-3 sm:p-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Fechar onboarding"
          className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
          onClick={handleDismiss}
        />

        <motion.section
          role="dialog"
          aria-modal="true"
          aria-label="Onboarding inicial da empresa"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
          transition={prefersReducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 300, damping: 34, mass: 0.78 }}
          className="relative z-[1] h-[min(94vh,1030px)] w-[min(96vw,980px)] max-h-[94vh] overflow-hidden rounded-[24px] bg-[#ececef] shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
        >
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr]">
            <aside className="relative overflow-hidden bg-[#151618] px-5 py-6 text-white sm:px-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(66,153,225,0.16),transparent_48%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.14),transparent_45%)]" />
              <div className="relative">
                <h2 className="text-[34px] font-semibold leading-[1.04]">Vamos começar</h2>
                <p className="mt-2 text-[13px] text-white/72">
                  Complete as etapas para ativar sua operação no WhatsApp.
                </p>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-[12px] text-white/65">
                    <span>Progresso</span>
                    <span>{toLocalStepIndex(activeStep) + 1}/4</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-emerald-400 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>

                <div className="mt-6 space-y-2.5">
                  {leftSteps.map((step) => {
                    const Icon = step.icon;
                    const active = activeStep === step.id;
                    const done = toLocalStepIndex(activeStep) > toLocalStepIndex(step.id);
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => {
                          if (done) setActiveStep(step.id);
                        }}
                        className={cx(
                          "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                          active ? "border-white/35 bg-white/10" : "border-white/10 bg-white/[0.04]",
                          done && "hover:border-white/25 hover:bg-white/[0.08]",
                        )}
                      >
                        <span className={cx("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", active ? "bg-white text-[#111214]" : "bg-white/12 text-white")}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold leading-tight">{step.title}</span>
                          <span className="mt-0.5 block truncate text-[12px] text-white/65">{step.subtitle}</span>
                        </span>
                        <span className="ml-1 inline-flex h-5 w-5 items-center justify-center">
                          {done ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : active ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 flex-col bg-[#ececef]">
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                <div className="min-w-0">
                  <h3 className="truncate text-[20px] font-semibold text-black/84">
                    {activeStep === "company" && "Dados da empresa"}
                    {activeStep === "team" && "Estrutura da operação"}
                    {activeStep === "whatsapp" && "Conectar WhatsApp Business"}
                    {activeStep === "final" && "Onboarding concluído"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[12px] text-black/58">Conta: {maskEmail(onboarding?.email || userEmail)}</p>
                    {required && !onboarding?.completed && (
                      <span className="inline-flex shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-amber-700">
                        Obrigatorio
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={!canDismiss}
                  className={cx(
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors",
                    canDismiss
                      ? "hover:bg-black/5 hover:text-black/78"
                      : "cursor-not-allowed opacity-45",
                  )}
                  aria-label="Fechar onboarding"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="h-1.5 w-full bg-black/6">
                <div className="h-full bg-[#171717] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                {loading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-[14px] text-black/70">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando onboarding...
                    </div>
                  </div>
                ) : (
                  <>
                    {activeStep === "company" && (
                      <div>
                        <p className="text-[14px] text-black/62">
                          Preencha os dados da empresa para iniciarmos seu fluxo de atendimento.
                        </p>

                        <div className="mt-4">
                          <p className="text-[13px] font-medium text-black/62">
                            Logo da empresa <span className="text-[#d54f4f]">*</span>
                          </p>
                          <button
                            type="button"
                            onClick={openLogoPicker}
                            disabled={uploadingLogo}
                            className={cx(
                              "mt-2 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-black/20 bg-white/75 px-4 py-8 text-center transition-colors",
                              uploadingLogo ? "cursor-not-allowed opacity-70" : "hover:bg-white",
                            )}
                          >
                            {uploadingLogo ? (
                              <Loader2 className="h-5 w-5 animate-spin text-black/60" />
                            ) : companyLogoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={companyLogoUrl} alt="Logo da empresa" className="h-16 w-16 rounded-xl border border-black/10 bg-white object-cover" />
                            ) : (
                              <UploadCloud className="h-6 w-6 text-black/55" />
                            )}
                            <span className="mt-2 text-[14px] font-semibold text-black/78">
                              {companyLogoUrl ? "Trocar logo" : "Clique para enviar sua logo"}
                            </span>
                            <span className="mt-1 text-[12px] text-black/52">PNG, JPG, WEBP ou SVG - máximo 1MB</span>
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                            onChange={onLogoChange}
                            className="hidden"
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <label className="block md:col-span-2">
                            <span className="text-[13px] font-medium text-black/62">
                              Nome da empresa <span className="text-[#d54f4f]">*</span>
                            </span>
                            <input
                              type="text"
                              value={companyName}
                              onChange={(event) => setCompanyName(event.target.value)}
                              placeholder="Ex.: Wyzer Tecnologia LTDA"
                              className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8"
                            />
                          </label>

                          <label className="block">
                            <span className="text-[13px] font-medium text-black/62">CNPJ (opcional)</span>
                            <input
                              type="text"
                              value={companyCnpj}
                              onChange={(event) => setCompanyCnpj(formatCnpj(event.target.value))}
                              placeholder="00.000.000/0000-00"
                              inputMode="numeric"
                              className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8"
                            />
                          </label>

                          <label className="block">
                            <span className="text-[13px] font-medium text-black/62">
                              Atuação <span className="text-[#d54f4f]">*</span>
                            </span>
                            <input
                              type="text"
                              value={industry}
                              onChange={(event) => setIndustry(event.target.value)}
                              placeholder="Ex.: Clinica, E-commerce, Imobiliaria"
                              className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {activeStep === "team" && (
                      <div>
                        <p className="text-[14px] text-black/62">
                          Isso ajuda a configurar o volume inicial e o fluxo de fila dos atendimentos.
                        </p>
                        <div className="mt-4 rounded-2xl border border-black/10 bg-white/80 p-4">
                          <label className="block">
                            <span className="text-[13px] font-medium text-black/62">
                              Quantidade de funcionários <span className="text-[#d54f4f]">*</span>
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={5000}
                              value={teamAgentsCount}
                              onChange={(event) => setTeamAgentsCount(event.target.value)}
                              placeholder="Ex.: 12"
                              className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-[#f6f6f7] px-3 text-[15px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {activeStep === "whatsapp" && (
                      <div>
                        <p className="text-[14px] text-black/62">
                          Gere o QR Code para iniciar a vinculação do WhatsApp Business da empresa.
                        </p>
                        <div className="mt-4 rounded-2xl border border-black/12 bg-white/82 p-4">
                          {qrCodeDataUrl ? (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
                              <div className="rounded-2xl border border-black/10 bg-white p-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={qrCodeDataUrl} alt="QR Code de conexão WhatsApp" className="aspect-square w-full max-w-[220px] rounded-xl border border-black/8 object-contain" />
                              </div>
                              <div>
                                <p className="text-[13px] text-black/58">
                                  Escaneie com o aplicativo do WhatsApp Business e confirme a conexão abaixo.
                                </p>
                                <div className="mt-3 rounded-xl border border-black/10 bg-[#f6f6f7] px-3 py-2">
                                  <p className="text-[12px] text-black/55">Código de pareamento</p>
                                  <p className="mt-1 text-[18px] font-semibold tracking-[0.08em] text-black/82">
                                    {pairingCode || "------"}
                                  </p>
                                </div>
                                <div className="mt-2 text-[12px] text-black/55">
                                  {pairingExpiresAt ? `Expira em: ${new Date(pairingExpiresAt).toLocaleString("pt-BR")}` : "Sem expiração ativa."}
                                </div>
                                {pairingUrl && <div className="mt-2 break-all text-[11px] text-black/48">URL técnica: {pairingUrl}</div>}
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-black/16 bg-white/80">
                              <div className="text-center">
                                <QrCode className="mx-auto h-7 w-7 text-black/46" />
                                <p className="mt-3 text-[14px] font-medium text-black/72">
                                  Gere o QR Code para conectar seu WhatsApp
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeStep === "final" && (
                      <div>
                        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-4">
                          <p className="text-[16px] font-semibold text-emerald-800">Onboarding concluído com sucesso</p>
                          <p className="mt-1 text-[13px] text-emerald-900/80">
                            Sua empresa está pronta para iniciar os atendimentos no painel.
                          </p>
                        </div>
                        <div className="mt-4 space-y-2 rounded-2xl border border-black/10 bg-white/86 p-4 text-[13px] text-black/70">
                          <p><span className="font-semibold text-black/82">Empresa:</span> {onboarding?.companyName || "não informada"}</p>
                          <p><span className="font-semibold text-black/82">Atuação:</span> {onboarding?.industry || "não informada"}</p>
                          <p><span className="font-semibold text-black/82">Funcionários:</span> {onboarding?.teamAgentsCount || "não informado"}</p>
                          <p><span className="font-semibold text-black/82">WhatsApp:</span> {onboarding?.whatsappConnected ? "Conectado" : "Pendente"}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {error && (
                  <p className="mt-4 rounded-xl border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 bg-white/75 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={handleBackStep}
                  disabled={!canGoBack || saving || loading}
                  className={cx(
                    "inline-flex h-10 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 text-[13px] font-semibold text-black/72 transition-colors",
                    !canGoBack || saving || loading ? "cursor-not-allowed opacity-55" : "hover:bg-black/[0.03]",
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </button>

                <div className="flex items-center gap-2">
                  {activeStep === "company" && (
                    <button
                      type="button"
                      onClick={() => void handleCompanyContinue()}
                      disabled={saving || loading || uploadingLogo}
                      className={cx(
                        "inline-flex h-10 items-center rounded-xl bg-[#171717] px-4 text-[13px] font-semibold text-white transition-all duration-220",
                        saving || loading || uploadingLogo ? "cursor-not-allowed opacity-70" : "hover:bg-[#242424] active:translate-y-[0.6px] active:scale-[0.992]",
                      )}
                    >
                      {saving ? "Salvando..." : "Salvar e continuar"}
                    </button>
                  )}

                  {activeStep === "team" && (
                    <button
                      type="button"
                      onClick={() => void handleTeamContinue()}
                      disabled={saving || loading}
                      className={cx(
                        "inline-flex h-10 items-center rounded-xl bg-[#171717] px-4 text-[13px] font-semibold text-white transition-all duration-220",
                        saving || loading ? "cursor-not-allowed opacity-70" : "hover:bg-[#242424] active:translate-y-[0.6px] active:scale-[0.992]",
                      )}
                    >
                      {saving ? "Salvando..." : "Continuar"}
                    </button>
                  )}

                  {activeStep === "whatsapp" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleGenerateQr()}
                        disabled={saving || loading}
                        className={cx(
                          "inline-flex h-10 items-center rounded-xl border border-black/12 bg-white px-3 text-[13px] font-semibold text-black/75 transition-colors",
                          saving || loading ? "cursor-not-allowed opacity-65" : "hover:bg-black/[0.03]",
                        )}
                      >
                        {saving ? "Aguarde..." : qrCodeDataUrl ? "Gerar novo QR" : "Gerar QR Code"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleConfirmWhatsApp()}
                        disabled={saving || loading || (!qrCodeDataUrl && !onboarding?.whatsappConnected)}
                        className={cx(
                          "inline-flex h-10 items-center rounded-xl bg-[#171717] px-4 text-[13px] font-semibold text-white transition-all duration-220",
                          saving || loading || (!qrCodeDataUrl && !onboarding?.whatsappConnected)
                            ? "cursor-not-allowed opacity-70"
                            : "hover:bg-[#242424] active:translate-y-[0.6px] active:scale-[0.992]",
                        )}
                      >
                        Confirmar conexão
                      </button>
                    </>
                  )}

                  {activeStep === "final" && (
                    <button
                      type="button"
                      onClick={() => void handleFinish()}
                      disabled={saving || loading}
                      className={cx(
                        "inline-flex h-10 items-center rounded-xl bg-[#171717] px-4 text-[13px] font-semibold text-white transition-all duration-220",
                        saving || loading ? "cursor-not-allowed opacity-70" : "hover:bg-[#242424] active:translate-y-[0.6px] active:scale-[0.992]",
                      )}
                    >
                      {saving ? "Finalizando..." : "Entrar no dashboard"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
