"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type OverviewMainProps = {
  onCreateChatbot?: () => void;
};

type OperationDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type SystemConfigForm = {
  systemName: string;
  companyContext: string;
  assistantRole: string;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  operationDays: OperationDay[];
  operationStart: string;
  operationEnd: string;
  outOfHoursMessage: string;
  fallbackMessage: string;
  humanHandoffEnabled: boolean;
  humanHandoffMessage: string;
};

type SystemConfigApiPayload = {
  ok?: boolean;
  error?: string;
  whatsappConnected?: boolean;
  hasSystem?: boolean;
  systemConfig?: Partial<SystemConfigForm> | null;
  savedAt?: string;
};

const SKELETON_CARD_COUNT = 7;

const OPERATION_DAYS: Array<{ value: OperationDay; label: string }> = [
  { value: "mon", label: "Seg" },
  { value: "tue", label: "Ter" },
  { value: "wed", label: "Qua" },
  { value: "thu", label: "Qui" },
  { value: "fri", label: "Sex" },
  { value: "sat", label: "Sab" },
  { value: "sun", label: "Dom" },
];

const FIELD_INPUT_CLASS =
  "mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8";
const FIELD_TEXTAREA_CLASS =
  "mt-2 w-full rounded-xl border border-black/12 bg-white/90 px-3 py-2.5 text-[14px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8";

const DEFAULT_FORM: SystemConfigForm = {
  systemName: "",
  companyContext: "",
  assistantRole: "",
  welcomeEnabled: true,
  welcomeMessage:
    "Ola! Seja bem-vindo(a). Obrigado por entrar em contato com a nossa equipe. Em instantes vamos te ajudar.",
  operationDays: ["mon", "tue", "wed", "thu", "fri"],
  operationStart: "08:00",
  operationEnd: "18:00",
  outOfHoursMessage:
    "Nosso atendimento esta fora do horario neste momento. Deixe sua mensagem e retornaremos no proximo periodo util.",
  fallbackMessage:
    "Desculpe, nao consegui entender totalmente sua mensagem. Pode me explicar de outra forma ou escolher uma opcao do atendimento?",
  humanHandoffEnabled: false,
  humanHandoffMessage: "Vou encaminhar seu atendimento para um especialista humano agora.",
};

function normalizeShortText(value: unknown, maxLength = 90) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeLongText(value: unknown, maxLength = 1800) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ ]{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeTime(value: unknown) {
  const clean = String(value || "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clean)) return "";
  return clean;
}

function normalizeDays(value: unknown): OperationDay[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<OperationDay>();
  for (const item of value) {
    const clean = String(item || "").trim().toLowerCase();
    if (OPERATION_DAYS.some((day) => day.value === clean)) {
      seen.add(clean as OperationDay);
    }
  }
  return OPERATION_DAYS.map((day) => day.value).filter((day) => seen.has(day));
}

function normalizeIncomingConfig(payload?: Partial<SystemConfigForm> | null): SystemConfigForm {
  if (!payload) return { ...DEFAULT_FORM };
  return {
    systemName: normalizeShortText(payload.systemName, 90),
    companyContext: normalizeLongText(payload.companyContext, 1800),
    assistantRole: normalizeLongText(payload.assistantRole, 1800),
    welcomeEnabled: Boolean(payload.welcomeEnabled),
    welcomeMessage: normalizeLongText(payload.welcomeMessage, 1200) || DEFAULT_FORM.welcomeMessage,
    operationDays: normalizeDays(payload.operationDays) || DEFAULT_FORM.operationDays,
    operationStart: normalizeTime(payload.operationStart) || DEFAULT_FORM.operationStart,
    operationEnd: normalizeTime(payload.operationEnd) || DEFAULT_FORM.operationEnd,
    outOfHoursMessage:
      normalizeLongText(payload.outOfHoursMessage, 1200) || DEFAULT_FORM.outOfHoursMessage,
    fallbackMessage: normalizeLongText(payload.fallbackMessage, 1200) || DEFAULT_FORM.fallbackMessage,
    humanHandoffEnabled: Boolean(payload.humanHandoffEnabled),
    humanHandoffMessage:
      normalizeLongText(payload.humanHandoffMessage, 1200) || DEFAULT_FORM.humanHandoffMessage,
  };
}

function validateForm(form: SystemConfigForm) {
  if (!normalizeShortText(form.systemName, 90)) return "Informe o nome do sistema.";
  if (!normalizeLongText(form.companyContext, 1800)) {
    return "Descreva sua empresa para orientar o bot.";
  }
  if (!normalizeLongText(form.assistantRole, 1800)) {
    return "Explique como o bot deve agir com os clientes.";
  }
  if (form.welcomeEnabled && !normalizeLongText(form.welcomeMessage, 1200)) {
    return "Informe a mensagem de boas-vindas.";
  }
  if (!normalizeDays(form.operationDays).length) {
    return "Selecione pelo menos um dia de atendimento.";
  }
  if (!normalizeTime(form.operationStart) || !normalizeTime(form.operationEnd)) {
    return "Preencha o horario inicial e final de atendimento.";
  }
  if (normalizeTime(form.operationStart) === normalizeTime(form.operationEnd)) {
    return "Horario inicial e final nao podem ser iguais.";
  }
  if (!normalizeLongText(form.outOfHoursMessage, 1200)) {
    return "Informe a mensagem de fora do horario.";
  }
  if (!normalizeLongText(form.fallbackMessage, 1200)) {
    return "Informe a mensagem para quando o bot nao entender.";
  }
  if (form.humanHandoffEnabled && !normalizeLongText(form.humanHandoffMessage, 1200)) {
    return "Informe a mensagem de encaminhamento humano.";
  }
  return null;
}

export default function OverviewMain({ onCreateChatbot }: OverviewMainProps) {
  const skeletonOpacities = useMemo(
    () => Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => Math.max(0.18, 0.88 - index * 0.1)),
    [],
  );

  const [mode, setMode] = useState<"cards" | "form">("cards");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [hasSystem, setHasSystem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<SystemConfigForm>(DEFAULT_FORM);

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setError(null);
    try {
      const res = await fetch("/api/wz_users/system-config", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as SystemConfigApiPayload;
      if (!res.ok || !payload?.ok) {
        throw new Error(String(payload?.error || "Nao foi possivel carregar configuracao do sistema."));
      }

      setWhatsappConnected(Boolean(payload.whatsappConnected));
      setHasSystem(Boolean(payload.hasSystem));
      if (payload.systemConfig) {
        setForm(normalizeIncomingConfig(payload.systemConfig));
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar sistema.");
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const toggleOperationDay = (day: OperationDay) => {
    setForm((current) => {
      const hasDay = current.operationDays.includes(day);
      const nextDays = hasDay
        ? current.operationDays.filter((item) => item !== day)
        : [...current.operationDays, day];
      return {
        ...current,
        operationDays: OPERATION_DAYS.map((item) => item.value).filter((item) => nextDays.includes(item)),
      };
    });
  };

  const handleCreateClick = () => {
    if (loadingConfig) return;
    if (!whatsappConnected) {
      setError("Conecte seu WhatsApp no onboarding antes de criar o sistema.");
      return;
    }
    setError(null);
    setSuccess(null);
    setMode("form");
    onCreateChatbot?.();
  };

  const handleSaveSystem = async () => {
    setError(null);
    setSuccess(null);

    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/wz_users/system-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          action: "save-system-config",
          config: form,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as SystemConfigApiPayload;
      if (!res.ok || !payload?.ok || !payload.systemConfig) {
        throw new Error(String(payload?.error || "Nao foi possivel criar o sistema."));
      }

      setHasSystem(true);
      setForm(normalizeIncomingConfig(payload.systemConfig));
      setSuccess("Sistema criado com sucesso. Voce pode editar essas configuracoes quando quiser.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar o sistema.");
    } finally {
      setSaving(false);
    }
  };

  if (mode === "form") {
    return (
      <section className="w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
        <div className="mx-auto flex min-h-[calc(100dvh-120px)] w-full max-w-[1380px] items-center justify-center">
          <div className="w-full max-w-[920px] rounded-[24px] border border-black/10 bg-[#efeff1] p-4 shadow-[0_22px_50px_rgba(0,0,0,0.1)] sm:p-5">
            <div className="mb-4">
              <h2 className="text-[26px] font-semibold tracking-[-0.01em] text-black/84">Configurar Sistema WhatsApp</h2>
              <p className="mt-1 text-[14px] text-black/62">
                Defina como seu bot vai atender clientes, responder fora do horario e conduzir conversas no dia a dia.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-[13px] font-medium text-black/62">Nome do sistema</span>
                <input
                  type="text"
                  value={form.systemName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      systemName: normalizeShortText(event.target.value, 90),
                    }))
                  }
                  placeholder="Ex.: Atendimento Wyzer"
                  className={FIELD_INPUT_CLASS}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-[13px] font-medium text-black/62">Contexto da empresa</span>
                <textarea
                  value={form.companyContext}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      companyContext: normalizeLongText(event.target.value, 1800),
                    }))
                  }
                  placeholder="Explique produtos, servicos, publico e tom da marca."
                  rows={4}
                  className={FIELD_TEXTAREA_CLASS}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-[13px] font-medium text-black/62">Como o bot deve atuar</span>
                <textarea
                  value={form.assistantRole}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      assistantRole: normalizeLongText(event.target.value, 1800),
                    }))
                  }
                  placeholder="Ex.: cumprimentar, fazer triagem, coletar dados e oferecer proximos passos."
                  rows={4}
                  className={FIELD_TEXTAREA_CLASS}
                />
              </label>

              <div className="rounded-2xl border border-black/10 bg-white/82 p-3 md:col-span-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.welcomeEnabled}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, welcomeEnabled: Boolean(event.target.checked) }))
                    }
                    className="h-4 w-4 rounded border-black/30 text-black focus:ring-black/20"
                  />
                  <span className="text-[13px] font-medium text-black/72">Ativar mensagem de boas-vindas</span>
                </label>
                {form.welcomeEnabled && (
                  <label className="mt-3 block">
                    <span className="text-[13px] font-medium text-black/62">Mensagem de boas-vindas</span>
                    <textarea
                      value={form.welcomeMessage}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          welcomeMessage: normalizeLongText(event.target.value, 1200),
                        }))
                      }
                      rows={3}
                      className={FIELD_TEXTAREA_CLASS}
                    />
                  </label>
                )}
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/82 p-3 md:col-span-2">
                <p className="text-[13px] font-medium text-black/62">Dias de atendimento</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OPERATION_DAYS.map((day) => {
                    const active = form.operationDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleOperationDay(day.value)}
                        className={[
                          "h-9 rounded-full px-3 text-[12px] font-semibold transition-colors",
                          active
                            ? "bg-black text-white"
                            : "border border-black/14 bg-white text-black/72 hover:bg-black/[0.04]",
                        ].join(" ")}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="text-[13px] font-medium text-black/62">Horario inicial</span>
                <input
                  type="time"
                  value={form.operationStart}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      operationStart: normalizeTime(event.target.value) || current.operationStart,
                    }))
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="text-[13px] font-medium text-black/62">Horario final</span>
                <input
                  type="time"
                  value={form.operationEnd}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      operationEnd: normalizeTime(event.target.value) || current.operationEnd,
                    }))
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-[13px] font-medium text-black/62">Mensagem fora do horario</span>
                <textarea
                  value={form.outOfHoursMessage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      outOfHoursMessage: normalizeLongText(event.target.value, 1200),
                    }))
                  }
                  rows={3}
                  className={FIELD_TEXTAREA_CLASS}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-[13px] font-medium text-black/62">
                  Mensagem quando nao entender o cliente
                </span>
                <textarea
                  value={form.fallbackMessage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fallbackMessage: normalizeLongText(event.target.value, 1200),
                    }))
                  }
                  rows={3}
                  className={FIELD_TEXTAREA_CLASS}
                />
              </label>

              <div className="rounded-2xl border border-black/10 bg-white/82 p-3 md:col-span-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.humanHandoffEnabled}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        humanHandoffEnabled: Boolean(event.target.checked),
                      }))
                    }
                    className="h-4 w-4 rounded border-black/30 text-black focus:ring-black/20"
                  />
                  <span className="text-[13px] font-medium text-black/72">
                    Encaminhar para atendimento humano quando necessario
                  </span>
                </label>
                {form.humanHandoffEnabled && (
                  <label className="mt-3 block">
                    <span className="text-[13px] font-medium text-black/62">Mensagem de encaminhamento</span>
                    <textarea
                      value={form.humanHandoffMessage}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          humanHandoffMessage: normalizeLongText(event.target.value, 1200),
                        }))
                      }
                      rows={3}
                      className={FIELD_TEXTAREA_CLASS}
                    />
                  </label>
                )}
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-4 rounded-xl border border-emerald-600/18 bg-emerald-500/10 px-3 py-2 text-[13px] font-medium text-emerald-700">
                {success}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("cards");
                  setError(null);
                  setSuccess(null);
                }}
                disabled={saving}
                className="inline-flex h-10 items-center rounded-xl border border-black/12 bg-white px-4 text-[13px] font-semibold text-black/74 transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-55"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => void handleSaveSystem()}
                disabled={saving || !whatsappConnected}
                className="inline-flex h-10 items-center rounded-xl bg-[#171717] px-4 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Criando sistema..." : hasSystem ? "Salvar alteracoes" : "Criar sistema"}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
      <style>{`
        @keyframes overviewSkeletonShimmer {
          0% { background-position: 140% 0; }
          100% { background-position: -40% 0; }
        }

        .overview-skeleton-shimmer {
          background: linear-gradient(
            104deg,
            #dfe2e6 36%,
            #eceff2 50%,
            #dfe2e6 64%
          );
          background-size: 220% 100%;
          animation: overviewSkeletonShimmer 2.8s linear infinite;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1380px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <button
            type="button"
            onClick={handleCreateClick}
            disabled={loadingConfig}
            className={[
              "group relative min-h-[152px] overflow-hidden rounded-[20px] bg-[#0f1115] px-5 py-4 text-left",
              "shadow-[0_14px_30px_rgba(0,0,0,0.18)] transition-[background-color,box-shadow] duration-180 ease-out",
              "hover:bg-[#141822] hover:shadow-[0_18px_34px_rgba(0,0,0,0.22)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff0f2]",
              "active:bg-[#11141b]",
              loadingConfig ? "cursor-wait opacity-90" : "cursor-pointer",
            ].join(" ")}
            aria-label="Criar meu sistema"
          >
            <span className="relative z-[1] flex h-full flex-col items-center justify-center gap-2.5">
              <span className="inline-flex h-[66px] w-[66px] items-center justify-center rounded-full border border-white/18 bg-white/[0.02] sm:h-[70px] sm:w-[70px]">
                <Plus className="h-[38px] w-[38px] text-white sm:h-[40px] sm:w-[40px]" strokeWidth={2.25} />
              </span>
              <span className="text-[12px] font-semibold tracking-[0.01em] text-white/95 sm:text-[13px]">
                Criar meu sistema
              </span>
              {!loadingConfig && !whatsappConnected && (
                <span className="text-center text-[11px] font-medium text-[#ffb0b0]">
                  Conecte o WhatsApp no onboarding antes de criar.
                </span>
              )}
            </span>
          </button>

          <div className="hidden sm:contents" aria-hidden="true">
            {skeletonOpacities.map((opacity, index) => (
              <article
                key={`overview-skeleton-${index}`}
                className="overview-skeleton-shimmer relative min-h-[152px] overflow-hidden rounded-[20px] shadow-[0_6px_14px_rgba(0,0,0,0.025)]"
                style={{ opacity }}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

