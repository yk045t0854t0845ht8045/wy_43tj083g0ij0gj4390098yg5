"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ScheduleDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type WizardTopic = "messages" | "schedule" | "ai" | "confirm";

type DaySchedule = {
  day: ScheduleDay;
  enabled: boolean;
  start: string;
  end: string;
};

type SystemConfigForm = {
  welcomeMessage: string;
  closingMessage: string;
  outOfHoursMessage: string;
  weeklySchedule: DaySchedule[];
  aiInstructions: string;
  aiFallbackMessage: string;
  aiResponseTone: "professional" | "friendly" | "consultative" | "objective";
  aiResponseSize: "concise" | "balanced" | "detailed";
  aiCollectName: boolean;
  aiCollectEmail: boolean;
  aiCollectPhone: boolean;
  aiTransferToHumanWhenUncertain: boolean;
};

type SystemSummary = {
  id: string;
  companyName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  whatsappConnected: boolean;
};

type SystemConfigApiPayload = {
  ok?: boolean;
  error?: string;
  whatsappConnected?: boolean;
  hasSystem?: boolean;
  companyName?: string | null;
  activeSystemId?: string;
  systems?: SystemSummary[];
  systemConfig?: Partial<SystemConfigForm> | null;
  createdAt?: string;
  updatedAt?: string;
};

type StepMeta = {
  id: WizardTopic;
  title: string;
  description: string;
};

type SelectOption = {
  value: string;
  label: string;
  search?: string;
};

const DAY_OPTIONS: Array<{
  value: ScheduleDay;
  label: string;
  fullLabel: string;
  defaultStart: string;
  defaultEnd: string;
  defaultEnabled: boolean;
}> = [
  {
    value: "mon",
    label: "Seg",
    fullLabel: "Segunda-feira",
    defaultStart: "08:00",
    defaultEnd: "18:00",
    defaultEnabled: true,
  },
  {
    value: "tue",
    label: "Ter",
    fullLabel: "Terca-feira",
    defaultStart: "08:00",
    defaultEnd: "18:00",
    defaultEnabled: true,
  },
  {
    value: "wed",
    label: "Qua",
    fullLabel: "Quarta-feira",
    defaultStart: "08:00",
    defaultEnd: "18:00",
    defaultEnabled: true,
  },
  {
    value: "thu",
    label: "Qui",
    fullLabel: "Quinta-feira",
    defaultStart: "08:00",
    defaultEnd: "18:00",
    defaultEnabled: true,
  },
  {
    value: "fri",
    label: "Sex",
    fullLabel: "Sexta-feira",
    defaultStart: "08:00",
    defaultEnd: "18:00",
    defaultEnabled: true,
  },
  {
    value: "sat",
    label: "Sab",
    fullLabel: "Sabado",
    defaultStart: "09:00",
    defaultEnd: "13:00",
    defaultEnabled: false,
  },
  {
    value: "sun",
    label: "Dom",
    fullLabel: "Domingo",
    defaultStart: "09:00",
    defaultEnd: "12:00",
    defaultEnabled: false,
  },
];

const WIZARD_STEPS: StepMeta[] = [
  {
    id: "messages",
    title: "Mensagens",
    description: "Boas-vindas, encerramento e fora do horario.",
  },
  {
    id: "schedule",
    title: "Dias de atendimento",
    description: "Defina inicio e fim por dia com precisao.",
  },
  {
    id: "ai",
    title: "Configurando IA",
    description: "Fallback, coleta de dados e estilo de resposta.",
  },
  {
    id: "confirm",
    title: "Confirmar",
    description: "Revise e confirme para criar o sistema.",
  },
];

const SKELETON_CARD_COUNT = 7;

const INPUT_CLASS =
  "mt-2 h-12 w-full rounded-xl border border-black/12 bg-white px-3 text-[15px] text-black/84 outline-none transition-[border-color,box-shadow,background-color] focus:border-black/24 focus:ring-2 focus:ring-black/10";
const TEXTAREA_CLASS =
  "mt-2 min-h-[130px] w-full rounded-xl border border-black/12 bg-white px-3 py-3 text-[14px] text-black/84 outline-none transition-[border-color,box-shadow,background-color] focus:border-black/24 focus:ring-2 focus:ring-black/10 resize-y";
const DARK_BUTTON_GRADIENT_CLASS =
  "bg-[#0b0b0b] [background-image:radial-gradient(130%_120%_at_50%_-18%,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_52%),linear-gradient(180deg,#171717_0%,#0f0f0f_58%,#080808_100%)]";

const AI_TONE_OPTIONS: SelectOption[] = [
  { value: "professional", label: "Profissional", search: "formal empresa corporativo" },
  { value: "friendly", label: "Amigavel", search: "leve acolhedor simpatico" },
  { value: "consultative", label: "Consultivo", search: "especialista orientar recomendacoes" },
  { value: "objective", label: "Objetivo", search: "direto curto rapido" },
];

const AI_RESPONSE_SIZE_OPTIONS: SelectOption[] = [
  { value: "concise", label: "Curtas e diretas", search: "curto rapido resumo" },
  { value: "balanced", label: "Equilibradas", search: "medio natural padrao" },
  { value: "detailed", label: "Detalhadas", search: "longo completo explicativo" },
];

function createDefaultSchedule(): DaySchedule[] {
  return DAY_OPTIONS.map((day) => ({
    day: day.value,
    enabled: day.defaultEnabled,
    start: day.defaultStart,
    end: day.defaultEnd,
  }));
}

function createDefaultForm(): SystemConfigForm {
  return {
    welcomeMessage:
      "Ola! Seja bem-vindo(a). Recebemos sua mensagem e em instantes iniciamos seu atendimento.",
    closingMessage:
      "Atendimento finalizado por agora. Se precisar de algo mais, envie nova mensagem e seguimos com voce.",
    outOfHoursMessage:
      "Nosso atendimento esta fora do horario no momento. Deixe sua mensagem que retornamos no proximo periodo util.",
    weeklySchedule: createDefaultSchedule(),
    aiInstructions:
      "Seja objetivo, educado e profissional. Entenda o contexto do cliente, confirme o que foi compreendido e proponha o proximo passo mais adequado.",
    aiFallbackMessage:
      "Desculpe, nao entendi completamente sua mensagem. Pode explicar de outra forma ou enviar mais detalhes?",
    aiResponseTone: "professional",
    aiResponseSize: "balanced",
    aiCollectName: true,
    aiCollectEmail: false,
    aiCollectPhone: true,
    aiTransferToHumanWhenUncertain: true,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeLongText(value: unknown, maxLength = 1800) {
  const clean = String(value || "")
    .replace(/\r/g, "")
    .replace(/[ ]{2,}/g, " ")
    .trim();
  if (!clean) return "";
  return clean.slice(0, maxLength);
}

function normalizeTime(value: unknown) {
  const clean = String(value || "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clean)) return "";
  return clean;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "1" || clean === "true" || clean === "t" || clean === "yes" || clean === "sim";
  }
  return false;
}

function normalizeTone(value: unknown): SystemConfigForm["aiResponseTone"] {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "friendly" || clean === "consultative" || clean === "objective") return clean;
  return "professional";
}

function normalizeResponseSize(value: unknown): SystemConfigForm["aiResponseSize"] {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "concise" || clean === "detailed") return clean;
  return "balanced";
}

function normalizeSchedule(value: unknown): DaySchedule[] {
  const defaults = createDefaultSchedule();
  if (!Array.isArray(value)) return defaults;

  const map = new Map<ScheduleDay, DaySchedule>();
  for (const item of value) {
    const row = asRecord(item);
    if (!row) continue;

    const day = String(row.day || "").trim().toLowerCase() as ScheduleDay;
    if (!DAY_OPTIONS.some((candidate) => candidate.value === day)) continue;

    map.set(day, {
      day,
      enabled: normalizeBoolean(row.enabled),
      start:
        normalizeTime(row.start) ||
        defaults.find((candidate) => candidate.day === day)?.start ||
        "08:00",
      end:
        normalizeTime(row.end) ||
        defaults.find((candidate) => candidate.day === day)?.end ||
        "18:00",
    });
  }

  return DAY_OPTIONS.map(
    (item) =>
      map.get(item.value) ||
      defaults.find((candidate) => candidate.day === item.value) || {
        day: item.value,
        enabled: false,
        start: item.defaultStart,
        end: item.defaultEnd,
      },
  );
}

function normalizeIncomingConfig(payload?: Partial<SystemConfigForm> | null): SystemConfigForm {
  const defaults = createDefaultForm();
  if (!payload) return defaults;

  return {
    welcomeMessage: normalizeLongText(payload.welcomeMessage, 1200) || defaults.welcomeMessage,
    closingMessage: normalizeLongText(payload.closingMessage, 1200) || defaults.closingMessage,
    outOfHoursMessage:
      normalizeLongText(payload.outOfHoursMessage, 1200) || defaults.outOfHoursMessage,
    weeklySchedule: normalizeSchedule(payload.weeklySchedule),
    aiInstructions: normalizeLongText(payload.aiInstructions, 2400) || defaults.aiInstructions,
    aiFallbackMessage:
      normalizeLongText(payload.aiFallbackMessage, 1200) || defaults.aiFallbackMessage,
    aiResponseTone: normalizeTone(payload.aiResponseTone),
    aiResponseSize: normalizeResponseSize(payload.aiResponseSize),
    aiCollectName: normalizeBoolean(payload.aiCollectName),
    aiCollectEmail: normalizeBoolean(payload.aiCollectEmail),
    aiCollectPhone: normalizeBoolean(payload.aiCollectPhone),
    aiTransferToHumanWhenUncertain: normalizeBoolean(payload.aiTransferToHumanWhenUncertain),
  };
}

function getDayLabel(day: ScheduleDay) {
  return DAY_OPTIONS.find((item) => item.value === day)?.fullLabel || day;
}

function formatSavedAt(value: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeSystemSummaries(value: unknown): SystemSummary[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: SystemSummary[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    result.push({
      id,
      companyName: String(row.companyName || "").trim() || null,
      status: String(row.status || "").trim().toLowerCase() || "active",
      createdAt: String(row.createdAt || "").trim(),
      updatedAt: String(row.updatedAt || "").trim(),
      whatsappConnected: normalizeBoolean(row.whatsappConnected),
    });
  }

  return result;
}
function validateMessages(form: SystemConfigForm) {
  if (!normalizeLongText(form.welcomeMessage, 1200)) {
    return "Informe a mensagem de boas-vindas.";
  }
  if (!normalizeLongText(form.closingMessage, 1200)) {
    return "Informe a mensagem de encerramento de atendimento.";
  }
  if (!normalizeLongText(form.outOfHoursMessage, 1200)) {
    return "Informe a mensagem fora do horario de atendimento.";
  }
  return null;
}

function validateSchedule(form: SystemConfigForm) {
  const activeDays = form.weeklySchedule.filter((day) => day.enabled);
  if (!activeDays.length) {
    return "Selecione pelo menos um dia de atendimento ativo.";
  }

  for (const day of activeDays) {
    if (!normalizeTime(day.start) || !normalizeTime(day.end)) {
      return "Preencha horario inicial e final para todos os dias ativos.";
    }
    if (day.start >= day.end) {
      return `No dia ${getDayLabel(day.day)}, o horario final deve ser maior que o inicial.`;
    }
  }

  return null;
}

function validateAi(form: SystemConfigForm) {
  if (!normalizeLongText(form.aiInstructions, 2400)) {
    return "Descreva as instrucoes principais para a IA do WhatsApp.";
  }
  if (!normalizeLongText(form.aiFallbackMessage, 1200)) {
    return "Informe a mensagem para quando a IA nao entender o cliente.";
  }
  return null;
}

function validateByTopic(topic: WizardTopic, form: SystemConfigForm) {
  if (topic === "messages") return validateMessages(form);
  if (topic === "schedule") return validateSchedule(form);
  if (topic === "ai") return validateAi(form);

  const messagesError = validateMessages(form);
  if (messagesError) return messagesError;

  const scheduleError = validateSchedule(form);
  if (scheduleError) return scheduleError;

  return validateAi(form);
}

function stepIndex(topic: WizardTopic) {
  return WIZARD_STEPS.findIndex((step) => step.id === topic);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type SelectMenuProps = {
  value: string;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  onChange: (next: string) => void;
};

function SelectMenu({
  value,
  options,
  placeholder,
  searchPlaceholder = "Buscar...",
  emptyLabel = "Nenhuma opcao encontrada.",
  disabled = false,
  onChange,
}: SelectMenuProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => options.find((item) => item.value === value) || null, [options, value]);

  const filtered = useMemo(() => {
    const clean = String(query || "").trim().toLowerCase();
    if (!clean) return options;
    return options.filter((item) => {
      const search = `${item.label} ${item.search || ""}`.toLowerCase();
      return search.includes(clean);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !wrapRef.current) return;
      if (!wrapRef.current.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={cx(
          "mt-2 inline-flex h-11 w-full items-center justify-between rounded-xl border border-black/12 bg-white/90 px-3 text-left text-[15px] text-black/82",
          "transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/8",
          disabled ? "cursor-not-allowed opacity-65" : "hover:border-black/22",
        )}
      >
        <span className={cx("truncate", !selected && "text-black/46")}>{selected?.label || placeholder}</span>
        <ChevronDown className={cx("h-4 w-4 shrink-0 text-black/52 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-[55] mt-2 w-full overflow-hidden rounded-xl border border-black/15 bg-white shadow-[0_16px_34px_rgba(0,0,0,0.16)]">
          <div className="border-b border-black/8 p-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-lg border border-black/12 bg-[#f7f7f8] px-2.5 text-[13px] text-black/78 outline-none focus:border-black/24"
            />
          </div>

          <div className="max-h-[250px] overflow-y-auto p-1.5">
            {filtered.length > 0 ? (
              filtered.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onChange(option.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cx(
                      "flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-left text-[13px] text-black/82 transition-colors",
                      active ? "bg-black/[0.08] font-semibold" : "hover:bg-black/[0.05]",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {active && <Check className="h-4 w-4 shrink-0 text-black/70" />}
                  </button>
                );
              })
            ) : (
              <p className="px-2.5 py-3 text-[12px] text-black/52">{emptyLabel}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OverviewMain() {
  const reduceMotion = useReducedMotion();
  const skeletonOpacities = useMemo(
    () =>
      Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => Math.max(0.22, 0.84 - index * 0.09)),
    [],
  );

  const [mode, setMode] = useState<"cards" | "wizard" | "success">("cards");
  const [activeTopic, setActiveTopic] = useState<WizardTopic>("messages");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [hasSystem, setHasSystem] = useState(false);
  const [systems, setSystems] = useState<SystemSummary[]>([]);
  const [activeSystemId, setActiveSystemId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SystemConfigForm>(createDefaultForm());

  const loadConfig = useCallback(async (systemId?: string | null) => {
    setLoadingConfig(true);
    setError(null);

    try {
      const endpoint = systemId
        ? `/api/wz_users/system-config?systemId=${encodeURIComponent(systemId)}`
        : "/api/wz_users/system-config";
      const res = await fetch(endpoint, {
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
      setCompanyName(String(payload.companyName || "").trim());
      setSystems(normalizeSystemSummaries(payload.systems));
      setActiveSystemId(String(payload.activeSystemId || "").trim() || null);
      setSavedAt(String(payload.updatedAt || payload.createdAt || "") || null);

      if (payload.systemConfig) {
        setForm(normalizeIncomingConfig(payload.systemConfig));
      } else if (!payload.hasSystem) {
        setForm(createDefaultForm());
      }
      return true;
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Falha ao carregar configuracao do sistema.",
      );
      return false;
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const currentStepIndex = stepIndex(activeTopic);
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  const enabledSchedule = useMemo(
    () => form.weeklySchedule.filter((row) => row.enabled),
    [form.weeklySchedule],
  );

  const handleCreateClick = () => {
    if (loadingConfig) return;
    if (!whatsappConnected) {
      setError("Conecte seu WhatsApp no onboarding antes de criar o sistema.");
      return;
    }

    setError(null);
    setActiveSystemId(null);
    setForm(createDefaultForm());
    setActiveTopic("messages");
    setMode("wizard");
  };

  const handleOpenExistingSystem = useCallback(
    async (systemId: string) => {
      if (loadingConfig || saving) return;
      if (!systemId) return;
      if (!whatsappConnected) {
        setError("Conecte seu WhatsApp no onboarding antes de abrir o sistema.");
        return;
      }

      const ok = await loadConfig(systemId);
      if (!ok) return;
      setError(null);
      setActiveTopic("messages");
      setMode("wizard");
    },
    [loadingConfig, loadConfig, saving, whatsappConnected],
  );

  const updateDaySchedule = (day: ScheduleDay, patch: Partial<DaySchedule>) => {
    setForm((current) => ({
      ...current,
      weeklySchedule: current.weeklySchedule.map((row) => {
        if (row.day !== day) return row;
        return {
          ...row,
          ...patch,
        };
      }),
    }));
  };

  const handleSaveSystem = useCallback(async () => {
    setError(null);

    const validationError = validateByTopic("confirm", form);
    if (validationError) {
      setError(validationError);
      if (
        validationError.includes("boas-vindas") ||
        validationError.includes("encerramento") ||
        validationError.includes("fora do horario")
      ) {
        setActiveTopic("messages");
      } else if (validationError.includes("dia") || validationError.includes("horario")) {
        setActiveTopic("schedule");
      } else {
        setActiveTopic("ai");
      }
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
          systemId: activeSystemId || undefined,
          config: form,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as SystemConfigApiPayload;
      if (!res.ok || !payload?.ok || !payload.systemConfig) {
        throw new Error(String(payload?.error || "Nao foi possivel salvar o sistema."));
      }

      setHasSystem(true);
      setForm(normalizeIncomingConfig(payload.systemConfig));
      setCompanyName(String(payload.companyName || "").trim());
      setSystems(normalizeSystemSummaries(payload.systems));
      setActiveSystemId(String(payload.activeSystemId || "").trim() || activeSystemId || null);
      setSavedAt(String(payload.updatedAt || payload.createdAt || "") || null);
      setMode("success");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar sistema.");
    } finally {
      setSaving(false);
    }
  }, [activeSystemId, form]);

  const handlePrimaryAction = async () => {
    if (saving) return;

    setError(null);

    if (!isLastStep) {
      const validationError = validateByTopic(activeTopic, form);
      if (validationError) {
        setError(validationError);
        return;
      }
      setActiveTopic(WIZARD_STEPS[currentStepIndex + 1].id);
      return;
    }

    await handleSaveSystem();
  };

  const handleBackAction = () => {
    if (saving) return;
    setError(null);

    if (activeTopic === "messages") {
      setMode("cards");
      return;
    }

    setActiveTopic(WIZARD_STEPS[currentStepIndex - 1].id);
  };

  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const };

  const savedAtLabel = formatSavedAt(savedAt);
  const resolvedSystems = useMemo(() => {
    if (systems.length) return systems;
    if (!hasSystem) return [];
    return [
      {
        id: activeSystemId || "current-system",
        companyName: companyName || "Minha empresa",
        status: "active",
        createdAt: "",
        updatedAt: savedAt || "",
        whatsappConnected: true,
      } as SystemSummary,
    ];
  }, [activeSystemId, companyName, hasSystem, savedAt, systems]);

  return (
    <section className="w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
      <style>{`
        @keyframes overviewSkeletonPulse {
          0%, 100% { background-color: rgba(20, 24, 30, 0.07); }
          50% { background-color: rgba(20, 24, 30, 0.12); }
        }

        @keyframes overviewSkeletonSheen {
          0%, 100% { transform: translateX(-10%); opacity: 0.07; }
          50% { transform: translateX(10%); opacity: 0.16; }
        }

        .overview-skeleton-card {
          background: rgba(20, 24, 30, 0.08);
          animation: overviewSkeletonPulse 3.6s ease-in-out infinite;
        }

        .overview-skeleton-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 22%, rgba(255, 255, 255, 0.2) 50%, transparent 78%);
          animation: overviewSkeletonSheen 5.4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes overviewSuccessPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(111, 215, 102, 0.32); }
          55% { transform: scale(1.03); box-shadow: 0 0 0 24px rgba(111, 215, 102, 0); }
        }

        @keyframes overviewSuccessGlow {
          0%, 100% { opacity: 0.5; transform: translateY(0px); }
          50% { opacity: 0.9; transform: translateY(-4px); }
        }

        .overview-success-badge {
          animation: overviewSuccessPulse 2.3s ease-in-out infinite;
        }

        .overview-success-glow {
          animation: overviewSuccessGlow 3.4s ease-in-out infinite;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1380px]">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "cards" ? (
            <motion.div
              key="overview-cards"
              initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={panelTransition}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {hasSystem ? (
                  <>
                    {resolvedSystems.map((system, index) => {
                      const systemUpdatedAtLabel = formatSavedAt(system.updatedAt || null);
                      return (
                        <button
                          key={system.id || `system-card-${index}`}
                          type="button"
                          onClick={() => void handleOpenExistingSystem(system.id)}
                          disabled={loadingConfig}
                          className={cx(
                            "relative min-h-[172px] overflow-hidden rounded-[22px] px-5 py-4 text-left",
                            DARK_BUTTON_GRADIENT_CLASS,
                            "shadow-[0_16px_34px_rgba(0,0,0,0.25)] transition-[box-shadow,filter] duration-200 ease-out",
                            "hover:brightness-[1.04] hover:shadow-[0_20px_38px_rgba(0,0,0,0.28)]",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff0f2]",
                            loadingConfig ? "cursor-wait opacity-85" : "cursor-pointer",
                          )}
                          aria-label={`Abrir sistema ${system.companyName || companyName || "Minha empresa"}`}
                        >
                          <span className="relative z-[1] flex h-full flex-col justify-between gap-3">
                            <span className="inline-flex w-fit rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.03em] text-white/90">
                              {system.status === "active" ? "Sistema ativo" : "Sistema"}
                            </span>
                            <span>
                              <strong className="line-clamp-2 block text-[17px] font-semibold text-white/96">
                                {system.companyName || companyName || "Minha empresa"}
                              </strong>
                              <span className="mt-1 block text-[12px] text-white/68">
                                {systemUpdatedAtLabel
                                  ? `Atualizado em ${systemUpdatedAtLabel}`
                                  : "Configuracao pronta para uso"}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/76">
                              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                              {system.whatsappConnected ? "WhatsApp conectado" : "WhatsApp pendente"}
                            </span>
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleCreateClick}
                      disabled={loadingConfig}
                      className={cx(
                        "relative min-h-[172px] overflow-hidden rounded-[22px] border border-black/[0.06] bg-black/[0.08] px-5 py-4 text-left",
                        "shadow-[0_6px_14px_rgba(0,0,0,0.03)] transition-[background-color,box-shadow] duration-200 ease-out",
                        "hover:bg-black/[0.11] hover:shadow-[0_10px_20px_rgba(0,0,0,0.06)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff0f2]",
                        loadingConfig ? "cursor-wait opacity-85" : "cursor-pointer",
                      )}
                      aria-label="Adicionar novo sistema"
                    >
                      <span className="relative z-[1] flex h-full flex-col items-center justify-center gap-3.5">
                        <span className="inline-flex h-[76px] w-[76px] items-center justify-center rounded-full border border-black/14 bg-white/45">
                          <Plus className="h-[44px] w-[44px] text-black/72" strokeWidth={2.1} />
                        </span>
                        <span className="text-[13px] font-semibold tracking-[0.01em] text-black/78">
                          Adicionar novo sistema
                        </span>
                        {!loadingConfig && !whatsappConnected && (
                          <span className="max-w-[220px] text-center text-[11px] font-medium text-[#b2433e]">
                            Conecte o WhatsApp no onboarding para ativar.
                          </span>
                        )}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCreateClick}
                      disabled={loadingConfig}
                      className={cx(
                        "relative min-h-[172px] overflow-hidden rounded-[22px] px-5 py-4 text-left",
                        DARK_BUTTON_GRADIENT_CLASS,
                        "shadow-[0_16px_34px_rgba(0,0,0,0.25)] transition-[box-shadow,filter] duration-200 ease-out",
                        "hover:brightness-[1.04] hover:shadow-[0_20px_38px_rgba(0,0,0,0.28)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff0f2]",
                        loadingConfig ? "cursor-wait opacity-85" : "cursor-pointer",
                      )}
                      aria-label="Criar meu sistema"
                    >
                      <span className="relative z-[1] flex h-full flex-col items-center justify-center gap-3.5">
                        <span className="inline-flex h-[76px] w-[76px] items-center justify-center rounded-full border border-white/18">
                          <Plus className="h-[44px] w-[44px] text-white" strokeWidth={2.1} />
                        </span>
                        <span className="text-[13px] font-semibold tracking-[0.01em] text-white/96">
                          Criar meu sistema
                        </span>
                        {!loadingConfig && !whatsappConnected && (
                          <span className="max-w-[220px] text-center text-[11px] font-medium text-[#ffb0b0]">
                            Conecte o WhatsApp no onboarding para ativar.
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="hidden sm:contents" aria-hidden="true">
                      {skeletonOpacities.map((opacity, index) => (
                        <article
                          key={`overview-skeleton-${index}`}
                          className="overview-skeleton-card relative min-h-[172px] overflow-hidden rounded-[22px]"
                          style={{ opacity }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {error && (
                <p className="rounded-xl border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                  {error}
                </p>
              )}
            </motion.div>
          ) : mode === "wizard" ? (
            <motion.div
              key="overview-wizard"
              initial={reduceMotion ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={panelTransition}
              className="w-full"
            >
              <header className="mb-5">
                <h2 className="text-[29px] font-semibold tracking-[-0.02em] text-black/86">
                  Configurar Sistema WhatsApp
                </h2>
                <p className="mt-1 text-[14px] text-black/62">
                  Defina como seu bot vai atender clientes, responder fora do horario e conduzir
                  conversas no dia a dia.
                </p>
              </header>

              <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {WIZARD_STEPS.map((step, index) => {
                  const isActive = step.id === activeTopic;
                  const isDone = index < currentStepIndex;
                  return (
                    <div
                      key={`mobile-step-${step.id}`}
                      aria-current={isActive ? "step" : undefined}
                      className={cx(
                        "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[12px] font-semibold",
                        isActive
                          ? "bg-black text-white"
                          : isDone
                            ? "bg-black/85 text-white"
                            : "bg-black/[0.07] text-black/65",
                      )}
                    >
                      <span
                        className={cx(
                          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                          isActive || isDone
                            ? "bg-white/16 text-white"
                            : "bg-black/[0.08] text-black/68",
                        )}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : index + 1}
                      </span>
                      <span>{step.title}</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-5 lg:items-start lg:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
                <aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
                  <div className="max-h-[calc(100dvh-1.5rem)] space-y-2 overflow-y-auto pr-1">
                    {WIZARD_STEPS.map((step, index) => {
                      const isActive = step.id === activeTopic;
                      const isDone = index < currentStepIndex;

                      return (
                        <div
                          key={`desktop-step-${step.id}`}
                          aria-current={isActive ? "step" : undefined}
                          className={cx(
                            "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-[box-shadow,filter]",
                            isActive
                              ? `${DARK_BUTTON_GRADIENT_CLASS} border-white/18 text-white shadow-[0_12px_24px_rgba(0,0,0,0.28)]`
                              : isDone
                                ? `${DARK_BUTTON_GRADIENT_CLASS} border-white/12 text-white shadow-[0_8px_16px_rgba(0,0,0,0.2)]`
                                : "border-black/[0.06] bg-black/[0.06] text-black/72",
                          )}
                        >
                          <span
                            className={cx(
                              "mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                              isActive || isDone
                                ? "bg-white/16 text-white"
                                : "bg-black/[0.08] text-black/68",
                            )}
                          >
                            {isDone ? <Check className="h-4 w-4" strokeWidth={2.2} /> : index + 1}
                          </span>
                          <span>
                            <strong className="block text-[13px] font-semibold">{step.title}</strong>
                            <span
                              className={cx(
                                "mt-0.5 block text-[12px] leading-relaxed",
                                isActive || isDone ? "text-white/72" : "text-black/58",
                              )}
                            >
                              {step.description}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </aside>

                <div className="w-full">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`topic-${activeTopic}`}
                      initial={reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(3px)" }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(3px)" }}
                      transition={panelTransition}
                      className="space-y-4"
                    >
                      {activeTopic === "messages" && (
                        <>
                          <div className="rounded-2xl bg-white/75 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.05)] sm:p-5">
                            <h3 className="text-[18px] font-semibold text-black/84">
                              Mensagens de atendimento
                            </h3>
                            <p className="mt-1 text-[13px] text-black/60">
                              Defina as respostas base para iniciar, encerrar e atender contatos
                              fora do horario.
                            </p>
                          </div>

                          <div className="space-y-4">
                            <label className="block rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                              <span className="text-[13px] font-semibold text-black/70">
                                Mensagem de boas-vindas
                              </span>
                              <textarea
                                value={form.welcomeMessage}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    welcomeMessage: normalizeLongText(event.target.value, 1200),
                                  }))
                                }
                                placeholder="Ex.: Ola! Obrigado por entrar em contato. Vou te ajudar em poucos segundos."
                                className={TEXTAREA_CLASS}
                              />
                            </label>

                            <label className="block rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                              <span className="text-[13px] font-semibold text-black/70">
                                Encerramento do atendimento
                              </span>
                              <textarea
                                value={form.closingMessage}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    closingMessage: normalizeLongText(event.target.value, 1200),
                                  }))
                                }
                                placeholder="Ex.: Atendimento encerrado. Se precisar de algo mais, estou a disposicao."
                                className={TEXTAREA_CLASS}
                              />
                            </label>

                            <label className="block rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                              <span className="text-[13px] font-semibold text-black/70">
                                Mensagem fora do horario de atendimento
                              </span>
                              <textarea
                                value={form.outOfHoursMessage}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    outOfHoursMessage: normalizeLongText(event.target.value, 1200),
                                  }))
                                }
                                placeholder="Ex.: No momento estamos fora do horario. Deixe sua mensagem para retorno no proximo periodo."
                                className={TEXTAREA_CLASS}
                              />
                            </label>
                          </div>
                        </>
                      )}

                      {activeTopic === "schedule" && (
                        <>
                          <div className="rounded-2xl bg-white/75 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.05)] sm:p-5">
                            <h3 className="text-[18px] font-semibold text-black/84">
                              Dias de atendimento
                            </h3>
                            <p className="mt-1 text-[13px] text-black/60">
                              Ative os dias necessarios e ajuste inicio e fim de cada dia com
                              horario proprio.
                            </p>
                          </div>

                          <div className="space-y-3">
                            {form.weeklySchedule.map((day) => {
                              const dayMeta = DAY_OPTIONS.find((item) => item.value === day.day);
                              const label = dayMeta?.fullLabel || day.day;

                              return (
                                <article
                                  key={`schedule-${day.day}`}
                                  className="rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5"
                                >
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_170px_170px] sm:items-end">
                                    <label className="inline-flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-black/78">
                                      <input
                                        type="checkbox"
                                        checked={day.enabled}
                                        onChange={(event) =>
                                          updateDaySchedule(day.day, {
                                            enabled: Boolean(event.target.checked),
                                          })
                                        }
                                        className="h-4 w-4 rounded border-black/25 text-black focus:ring-black/20"
                                      />
                                      <span>{label}</span>
                                    </label>

                                    <label className={cx("block", !day.enabled && "opacity-60")}>
                                      <span className="text-[12px] font-medium text-black/60">
                                        Inicio
                                      </span>
                                      <input
                                        type="time"
                                        value={day.start}
                                        disabled={!day.enabled}
                                        onChange={(event) =>
                                          updateDaySchedule(day.day, {
                                            start: normalizeTime(event.target.value),
                                          })
                                        }
                                        className={INPUT_CLASS}
                                      />
                                    </label>

                                    <label className={cx("block", !day.enabled && "opacity-60")}>
                                      <span className="text-[12px] font-medium text-black/60">Fim</span>
                                      <input
                                        type="time"
                                        value={day.end}
                                        disabled={!day.enabled}
                                        onChange={(event) =>
                                          updateDaySchedule(day.day, {
                                            end: normalizeTime(event.target.value),
                                          })
                                        }
                                        className={INPUT_CLASS}
                                      />
                                    </label>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {activeTopic === "ai" && (
                        <>
                          <div className="rounded-2xl bg-white/75 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.05)] sm:p-5">
                            <h3 className="text-[18px] font-semibold text-black/84">
                              Configurando IA
                            </h3>
                            <p className="mt-1 text-[13px] text-black/60">
                              Ajuste comportamento, resposta quando nao entender o cliente e dados
                              que devem ser coletados.
                            </p>
                          </div>

                          <label className="block rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                            <span className="text-[13px] font-semibold text-black/70">
                              Instrucoes principais da IA
                            </span>
                            <textarea
                              value={form.aiInstructions}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  aiInstructions: normalizeLongText(event.target.value, 2400),
                                }))
                              }
                              placeholder="Ex.: seja consultivo, confirme entendimento, ofereca opcoes e finalize com proximo passo objetivo."
                              className="mt-2 min-h-[170px] w-full rounded-xl border border-black/12 bg-white px-3 py-3 text-[14px] text-black/84 outline-none transition-[border-color,box-shadow,background-color] focus:border-black/24 focus:ring-2 focus:ring-black/10 resize-y"
                            />
                          </label>

                          <label className="block rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                            <span className="text-[13px] font-semibold text-black/70">
                              Mensagem quando nao entender o cliente
                            </span>
                            <textarea
                              value={form.aiFallbackMessage}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  aiFallbackMessage: normalizeLongText(event.target.value, 1200),
                                }))
                              }
                              placeholder="Ex.: nao entendi totalmente, pode reformular ou enviar mais detalhes?"
                              className={TEXTAREA_CLASS}
                            />
                          </label>

                          <div className="rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                            <span className="text-[13px] font-semibold text-black/70">
                              Quando nao entender a mensagem do cliente
                            </span>
                            <p className="mt-1 text-[12px] text-black/58">
                              Escolha como o bot deve agir nesse momento.
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((current) => ({
                                    ...current,
                                    aiTransferToHumanWhenUncertain: false,
                                  }))
                                }
                                className={cx(
                                  "rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                                  !form.aiTransferToHumanWhenUncertain
                                    ? "border-black bg-black text-white"
                                    : "border-black/12 bg-white text-black/76 hover:bg-black/[0.04]",
                                )}
                              >
                                Responder com fallback
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((current) => ({
                                    ...current,
                                    aiTransferToHumanWhenUncertain: true,
                                  }))
                                }
                                className={cx(
                                  "rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                                  form.aiTransferToHumanWhenUncertain
                                    ? "border-black bg-black text-white"
                                    : "border-black/12 bg-white text-black/76 hover:bg-black/[0.04]",
                                )}
                              >
                                Redirecionar para atendente
                              </button>
                            </div>
                            <p className="mt-2 text-[12px] text-black/58">
                              {form.aiTransferToHumanWhenUncertain
                                ? "Sempre que houver duvida, o cliente sera encaminhado para atendimento humano."
                                : "Quando houver duvida, o bot envia a mensagem de fallback pedindo mais contexto."}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <label className="block rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                              <span className="text-[13px] font-semibold text-black/70">
                                Tom das respostas
                              </span>
                              <SelectMenu
                                value={form.aiResponseTone}
                                options={AI_TONE_OPTIONS}
                                placeholder="Selecione o tom"
                                searchPlaceholder="Buscar tom..."
                                onChange={(next) =>
                                  setForm((current) => ({
                                    ...current,
                                    aiResponseTone: normalizeTone(next),
                                  }))
                                }
                              />
                            </label>

                            <label className="block rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                              <span className="text-[13px] font-semibold text-black/70">
                                Tamanho das respostas
                              </span>
                              <SelectMenu
                                value={form.aiResponseSize}
                                options={AI_RESPONSE_SIZE_OPTIONS}
                                placeholder="Selecione o tamanho"
                                searchPlaceholder="Buscar formato..."
                                onChange={(next) =>
                                  setForm((current) => ({
                                    ...current,
                                    aiResponseSize: normalizeResponseSize(next),
                                  }))
                                }
                              />
                            </label>
                          </div>

                          <div className="rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                            <span className="text-[13px] font-semibold text-black/70">
                              Opcoes de atendimento inteligente
                            </span>
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <label className="inline-flex items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2 text-[13px] font-medium text-black/74">
                                <input
                                  type="checkbox"
                                  checked={form.aiCollectName}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      aiCollectName: Boolean(event.target.checked),
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-black/25 text-black focus:ring-black/20"
                                />
                                Coletar nome do cliente
                              </label>

                              <label className="inline-flex items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2 text-[13px] font-medium text-black/74">
                                <input
                                  type="checkbox"
                                  checked={form.aiCollectEmail}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      aiCollectEmail: Boolean(event.target.checked),
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-black/25 text-black focus:ring-black/20"
                                />
                                Coletar e-mail
                              </label>

                              <label className="inline-flex items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2 text-[13px] font-medium text-black/74">
                                <input
                                  type="checkbox"
                                  checked={form.aiCollectPhone}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      aiCollectPhone: Boolean(event.target.checked),
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-black/25 text-black focus:ring-black/20"
                                />
                                Coletar telefone
                              </label>
                            </div>
                          </div>
                        </>
                      )}

                      {activeTopic === "confirm" && (
                        <>
                          <div className="rounded-2xl bg-white/75 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.05)] sm:p-5">
                            <h3 className="text-[18px] font-semibold text-black/84">
                              Confirmar configuracao
                            </h3>
                            <p className="mt-1 text-[13px] text-black/60">
                              Revise os pontos principais antes de criar seu sistema no WhatsApp.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <article className="rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                              <h4 className="text-[14px] font-semibold text-black/80">
                                Resumo de mensagens
                              </h4>
                              <ul className="mt-3 space-y-2 text-[13px] text-black/70">
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-[1px] h-4 w-4 text-black/70" />
                                  <span>Boas-vindas configurada</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-[1px] h-4 w-4 text-black/70" />
                                  <span>Encerramento configurado</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-[1px] h-4 w-4 text-black/70" />
                                  <span>Mensagem fora do horario configurada</span>
                                </li>
                              </ul>
                            </article>

                            <article className="rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                              <h4 className="text-[14px] font-semibold text-black/80">Dias ativos</h4>
                              <ul className="mt-3 space-y-2 text-[13px] text-black/70">
                                {enabledSchedule.length ? (
                                  enabledSchedule.map((row) => (
                                    <li key={`confirm-day-${row.day}`} className="flex items-start gap-2">
                                      <CheckCircle2 className="mt-[1px] h-4 w-4 text-black/70" />
                                      <span>
                                        {getDayLabel(row.day)}: {row.start} as {row.end}
                                      </span>
                                    </li>
                                  ))
                                ) : (
                                  <li className="text-[13px] text-black/58">Nenhum dia ativo.</li>
                                )}
                              </ul>
                            </article>

                            <article className="rounded-2xl bg-white/78 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.045)] sm:p-5">
                              <h4 className="text-[14px] font-semibold text-black/80">
                                Comportamento da IA
                              </h4>
                              <ul className="mt-3 space-y-2 text-[13px] text-black/70">
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-[1px] h-4 w-4 text-black/70" />
                                  <span>Tom: {form.aiResponseTone}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-[1px] h-4 w-4 text-black/70" />
                                  <span>Tamanho das respostas: {form.aiResponseSize}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-[1px] h-4 w-4 text-black/70" />
                                  <span>
                                    Coleta ativa:{" "}
                                    {[
                                      form.aiCollectName ? "Nome" : null,
                                      form.aiCollectEmail ? "E-mail" : null,
                                      form.aiCollectPhone ? "Telefone" : null,
                                    ]
                                      .filter(Boolean)
                                      .join(", ") || "Nenhuma"}
                                  </span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-[1px] h-4 w-4 text-black/70" />
                                  <span>
                                    Encaminhar humano em duvida:{" "}
                                    {form.aiTransferToHumanWhenUncertain ? "Sim" : "Nao"}
                                  </span>
                                </li>
                              </ul>
                            </article>

                            <article className="rounded-2xl bg-[#0f1013] p-4 text-white shadow-[0_14px_28px_rgba(0,0,0,0.18)] sm:p-5">
                              <h4 className="text-[14px] font-semibold text-white">Pronto para criar</h4>
                              <p className="mt-2 text-[13px] text-white/74">
                                Ao confirmar, o sistema fica salvo e pronto para evoluir com novos
                                fluxos e automacoes.
                              </p>
                              {savedAtLabel && (
                                <p className="mt-4 text-[12px] text-white/62">
                                  Ultima atualizacao: {savedAtLabel}
                                </p>
                              )}
                            </article>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {error && (
                    <p className="mt-4 rounded-xl border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                      {error}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
                    <button
                      type="button"
                      onClick={handleBackAction}
                      disabled={saving}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-black/12 bg-white px-4 text-[13px] font-semibold text-black/76 transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {activeTopic === "messages" ? "Voltar para visao geral" : "Voltar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handlePrimaryAction()}
                      disabled={saving || !whatsappConnected}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#131417] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d2129] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Salvando..."
                        : isLastStep
                          ? activeSystemId
                            ? "Confirmar alteracoes"
                            : "Confirmar e criar sistema"
                          : "Proximo"}
                      {!saving && <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="overview-success"
              initial={reduceMotion ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={panelTransition}
              className="w-full"
            >
              <div className="mx-auto flex w-full max-w-[860px] items-center justify-center py-6 sm:py-10">
                <div className="w-full overflow-hidden rounded-[28px] bg-[#0f1013] p-6 text-white shadow-[0_26px_52px_rgba(0,0,0,0.28)] sm:p-8">
                  <div className="relative mx-auto flex h-[132px] w-[132px] items-center justify-center">
                    <span className="overview-success-glow absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(111,215,102,0.5),rgba(111,215,102,0.05)_62%,transparent_74%)]" />
                    <span className="overview-success-badge relative inline-flex h-[78px] w-[78px] items-center justify-center rounded-full bg-[#6fd766] text-[#0e160c]">
                      <Check className="h-10 w-10" strokeWidth={2.8} />
                    </span>
                  </div>

                  <h3 className="mt-2 text-center text-[28px] font-semibold tracking-[-0.02em] text-white">
                    Sistema criado com sucesso
                  </h3>
                  <p className="mx-auto mt-3 max-w-[620px] text-center text-[14px] text-white/74">
                    Seu sistema de atendimento WhatsApp ja esta salvo e pronto para evoluir com as
                    proximas automacoes que voce adicionar.
                  </p>
                  {savedAtLabel && (
                    <p className="mt-4 text-center text-[12px] text-white/58">
                      Ultima atualizacao: {savedAtLabel}
                    </p>
                  )}

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMode("cards")}
                      className="inline-flex h-11 items-center rounded-xl border border-white/18 bg-white/10 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-white/16"
                    >
                      Voltar para visao geral
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setActiveTopic("messages");
                        setMode("wizard");
                      }}
                      className="inline-flex h-11 items-center rounded-xl bg-white px-4 text-[13px] font-semibold text-[#121418] transition-colors hover:bg-white/92"
                    >
                      Editar configuracoes
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
