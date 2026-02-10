"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateOnboardingProgress,
  getInitialOnboardingStep,
  type OnboardingUiStep,
} from "./progress";
import {
  normalizeOnboardingData,
  type OnboardingData,
  type OnboardingProgress,
} from "./types";

type Props = {
  initialData: OnboardingData;
  onDataChange?: (nextData: OnboardingData) => void;
  onProgressChange?: (progress: OnboardingProgress) => void;
  onFinished?: (nextData: OnboardingData) => void;
};

type Errors = Record<string, string>;

const STEPS: OnboardingUiStep[] = [
  "welcome",
  "company",
  "goal",
  "team",
  "ai",
  "whatsapp",
  "improve",
  "final",
];

const INPUT =
  "w-full bg-white border border-black/15 border-2 rounded-full px-6 py-4 text-black placeholder-black/45 focus:outline-none hover:border-black/25 focus:border-lime-400 transition-all duration-300 ease-out text-base";
const TEXTAREA_CLASS =
  "w-full min-h-[120px] resize-y bg-white border border-black/15 border-2 rounded-3xl px-6 py-4 text-black placeholder-black/45 focus:outline-none hover:border-black/25 focus:border-lime-400 transition-all duration-300 ease-out text-base";
const EASE = [0.2, 0.8, 0.2, 1] as const;

const cx = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");
const has = (v: string | null | undefined, n = 2) => String(v || "").trim().length >= n;
const prev = (s: OnboardingUiStep) => STEPS[Math.max(0, STEPS.indexOf(s) - 1)] || s;
const next = (s: OnboardingUiStep) => STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(s) + 1)] || s;

function Action({
  label,
  disabled,
  onClick,
  className,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={reduced || disabled ? undefined : { y: -2, scale: 1.01 }}
      whileTap={reduced || disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.24, ease: EASE }}
      className={cx(
        "group relative inline-flex rounded-full bg-[#171717] px-5 py-3 text-left text-white border-2 border-[#454545] pr-14 text-[13px] font-semibold transition-all duration-300",
        "hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400",
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
    >
      <span>{label}</span>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2.5">
        <ArrowRight className="h-5 w-5 text-white" />
      </span>
    </motion.button>
  );
}

function Err({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-[12px] font-medium text-red-600">{text}</p> : null;
}

export default function Pendencias({
  initialData,
  onDataChange,
  onProgressChange,
  onFinished,
}: Props) {
  const reduced = useReducedMotion();
  const [data, setData] = useState(() => normalizeOnboardingData(initialData));
  const [step, setStep] = useState<OnboardingUiStep>(() =>
    getInitialOnboardingStep(normalizeOnboardingData(initialData)),
  );
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);

  const progress = useMemo(() => calculateOnboardingProgress(data), [data]);
  const canFinish = useMemo(
    () => progress.tasks.filter((t) => t.id !== "finish").every((t) => t.done),
    [progress.tasks],
  );

  useEffect(() => onProgressChange?.(progress), [onProgressChange, progress]);

  const commit = useCallback(
    (patch: Partial<OnboardingData>) => {
      setData((prevState) => {
        const nextState = normalizeOnboardingData({ ...prevState, ...patch });
        onDataChange?.(nextState);
        return nextState;
      });
    },
    [onDataChange],
  );

  const save = useCallback(async (patch: Partial<OnboardingData>) => {
    setSaving(true);
    setBanner(null);
    try {
      const r = await fetch("/api/wz_OnboardSystem/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(patch),
      });
      const j = await r.json().catch(() => ({} as Record<string, unknown>));
      if (!r.ok || j.ok === false) throw new Error(String(j.error || "Falha ao salvar etapa."));
      setErrors((j.fieldErrors as Errors) || {});
      commit({ ...patch, updatedAt: new Date().toISOString() });
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Erro inesperado");
      throw e;
    } finally {
      setSaving(false);
    }
  }, [commit]);

  const finish = async () => {
    if (!canFinish) return setBanner("Complete as etapas obrigatorias antes de finalizar.");
    setCompleting(true);
    setBanner(null);
    try {
      const r = await fetch("/api/wz_OnboardSystem/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(data),
      });
      const j = await r.json().catch(() => ({} as Record<string, unknown>));
      if (!r.ok || j.ok === false) throw new Error(String(j.error || "Falha ao concluir."));
      const nextState = normalizeOnboardingData({
        ...data,
        completed: true,
        updatedAt: new Date().toISOString(),
      });
      setData(nextState);
      onDataChange?.(nextState);
      onFinished?.(nextState);
      setBanner("Cadastro finalizado com sucesso.");
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Falha ao finalizar");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <section id="onboarding-pendencias" className="mx-auto w-full max-w-[980px] px-4 pb-8 pt-6 sm:px-8">
      <div className="rounded-3xl border border-black/10 bg-[#f8f8f8] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.08)] sm:p-6">
        <div className="mb-4 rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/55">Finalizacao de cadastro</p>
              <h2 className="text-[20px] font-semibold text-black/90">Voce possui pendencias</h2>
            </div>
            <span className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 text-[13px] font-semibold text-black/70">{progress.percent}%</span>
          </div>
          <div className="mt-3 h-[8px] overflow-hidden rounded-full bg-black/[0.08]">
            <motion.span
              className="block h-full rounded-full bg-lime-400"
              animate={{ width: `${progress.percent}%` }}
              transition={reduced ? { duration: 0 } : { duration: 0.3, ease: EASE }}
            />
          </div>
          <p className="mt-2 text-[13px] text-black/70">{progress.completedRequired} de {progress.totalRequired} etapas concluidas.</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reduced ? { duration: 0.1 } : { duration: 0.24, ease: EASE }}
            className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6"
          >
            {step === "welcome" && (
              <div className="space-y-4">
                <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-semibold text-black/75"><Sparkles className="h-4 w-4" />Boas-vindas</p>
                <p className="text-[14px] text-black/70">Voce esta a poucos minutos de ativar seu WhatsApp. Confirme para iniciar.</p>
                <Action label={saving ? "Salvando..." : "Iniciar configuracao"} className="w-auto" disabled={saving} onClick={async () => {
                  setErrors({});
                  await save({ welcomeConfirmed: true });
                  setStep("company");
                }} />
              </div>
            )}

            {step !== "welcome" && step !== "final" && (
              <div className="space-y-3">
                {step === "company" && (
                  <>
                    <input className={INPUT} placeholder="Nome da empresa" value={data.companyName || ""} onChange={(e) => commit({ companyName: e.target.value })} />
                    <input className={INPUT} placeholder="Segmento de atuacao" list="segments" value={data.segment || ""} onChange={(e) => commit({ segment: e.target.value })} />
                    <datalist id="segments">{["E-commerce", "Clinica", "Restaurante", "Educacao"].map((s) => <option key={s} value={s} />)}</datalist>
                    <input className={INPUT} placeholder="Tamanho: 1-5 | 6-20 | 21-100 | 100+" value={data.companySize || ""} onChange={(e) => commit({ companySize: e.target.value as OnboardingData["companySize"] })} />
                    <input className={INPUT} placeholder="Site ou Instagram (opcional)" value={data.websiteOrInstagram || ""} onChange={(e) => commit({ websiteOrInstagram: e.target.value })} />
                    <Err text={errors.companyName || errors.segment || errors.companySize} />
                  </>
                )}
                {step === "goal" && (
                  <>
                    <input className={INPUT} placeholder="Uso principal: vendas | suporte | agendamento | cobranca | hibrido" value={data.mainUse || ""} onChange={(e) => commit({ mainUse: e.target.value })} />
                    <select className={INPUT} value={data.priorityNow || ""} onChange={(e) => commit({ priorityNow: e.target.value })}>
                      <option value="">Prioridade atual</option>
                      {["Responder mais rapido", "Converter mais", "Organizar equipe", "Automatizar respostas", "Nao perder leads"].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <Err text={errors.mainUse || errors.priorityNow} />
                  </>
                )}
                {step === "team" && (
                  <>
                    <input className={INPUT} type="number" min={1} placeholder="Quantidade de atendentes" value={data.teamAgentsCount ?? ""} onChange={(e) => commit({ teamAgentsCount: e.target.value ? Number(e.target.value) : null })} />
                    <input className={INPUT} placeholder="Tem supervisor? sim/nao" value={data.hasSupervisor === null ? "" : data.hasSupervisor ? "sim" : "nao"} onChange={(e) => commit({ hasSupervisor: /sim/i.test(e.target.value) ? true : /nao/i.test(e.target.value) ? false : null })} />
                    <input className={INPUT} placeholder="Dias de operacao (ex: seg,ter,qua)" value={(data.operationDays || []).join(",")} onChange={(e) => commit({ operationDays: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} />
                    <input className={INPUT} placeholder="Inicio (HH:MM)" value={data.operationStartTime || ""} onChange={(e) => commit({ operationStartTime: e.target.value })} />
                    <input className={INPUT} placeholder="Fim (HH:MM)" value={data.operationEndTime || ""} onChange={(e) => commit({ operationEndTime: e.target.value })} />
                    <input className={INPUT} placeholder="Idiomas (PT,EN,ES)" value={(data.languages || []).join(",")} onChange={(e) => commit({ languages: e.target.value.split(",").map((v) => v.trim().toUpperCase()).filter(Boolean) })} />
                    <Err text={errors.team} />
                  </>
                )}
                {step === "ai" && (
                  <>
                    <input className={INPUT} placeholder="Modo IA: all | common | assistant" value={data.aiAutoMode || ""} onChange={(e) => commit({ aiAutoMode: e.target.value as OnboardingData["aiAutoMode"] })} />
                    <input className={INPUT} placeholder="Tom: formal | neutral | casual" value={data.brandTone || ""} onChange={(e) => commit({ brandTone: e.target.value as OnboardingData["brandTone"] })} />
                    <input className={INPUT} type="number" min={1} max={50} placeholder="Transferir apos X mensagens" value={data.handoffAfterMessages ?? ""} onChange={(e) => commit({ handoffAfterMessages: e.target.value ? Number(e.target.value) : null })} />
                    <Err text={errors.ai} />
                  </>
                )}
                {step === "whatsapp" && (
                  <>
                    <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                      <p className="text-[13px] font-medium text-black/70">Status: {data.whatsappConnected ? "Conectado" : "Nao conectado"}</p>
                      <button type="button" onClick={() => commit({ whatsappConnected: !data.whatsappConnected, whatsappConnectedAt: !data.whatsappConnected ? new Date().toISOString() : null })} className="mt-2 rounded-full border border-black/15 bg-white px-4 py-2 text-[12px] font-semibold text-black/70">
                        {data.whatsappConnected ? "Desconectar" : "Marcar conectado"}
                      </button>
                    </div>
                    <Err text={errors.whatsappConnected} />
                  </>
                )}
                {step === "improve" && (
                  <>
                    <textarea className={INPUT.replace("rounded-full", "rounded-3xl")} placeholder="FAQ e informacoes para IA (opcional)" value={data.aiCatalogSummary || ""} onChange={(e) => commit({ aiCatalogSummary: e.target.value })} />
                    <textarea className={TEXTAREA_CLASS} placeholder="Links uteis separados por virgula ou linha (opcional)" value={data.aiKnowledgeLinks || ""} onChange={(e) => commit({ aiKnowledgeLinks: e.target.value })} />
                    <textarea className={TEXTAREA_CLASS} placeholder="Produtos/servicos principais (opcional)" value={data.aiGuardrails || ""} onChange={(e) => commit({ aiGuardrails: e.target.value })} />
                  </>
                )}

                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => setStep(prev(step))} className="inline-flex h-[46px] items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-black/75">
                    <ChevronLeft className="h-4 w-4" />Voltar
                  </button>
                  {step === "improve" && (
                    <button type="button" onClick={() => setStep("final")} className="inline-flex h-[46px] items-center justify-center rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-black/75">
                      Pular por agora
                    </button>
                  )}
                  <div>
                    <Action
                      label={saving ? "Salvando..." : "Confirmar e continuar"}
                      className="w-auto"
                      disabled={saving}
                      onClick={async () => {
                        setErrors({});
                        if (step === "company" && (!has(data.companyName) || !has(data.segment) || !has(data.companySize))) return setErrors({ companyName: "Preencha nome, segmento e tamanho." });
                        if (step === "goal" && (!has(data.mainUse) || !has(data.priorityNow))) return setErrors({ mainUse: "Defina uso e prioridade." });
                        if (step === "team" && (!(data.teamAgentsCount && data.teamAgentsCount > 0) || data.hasSupervisor === null || !has(data.operationStartTime, 3) || !has(data.operationEndTime, 3) || (data.operationDays || []).length === 0 || (data.languages || []).length === 0)) return setErrors({ team: "Preencha equipe, horario, dias e idiomas." });
                        if (step === "ai" && (!has(data.aiAutoMode) || !has(data.brandTone))) return setErrors({ ai: "Defina modo e tom da IA." });
                        if (step === "whatsapp" && !data.whatsappConnected) return setErrors({ whatsappConnected: "Conecte o WhatsApp para continuar." });
                        const patch: Partial<OnboardingData> =
                          step === "company" ? { companyName: data.companyName, segment: data.segment, companySize: data.companySize, websiteOrInstagram: data.websiteOrInstagram } :
                          step === "goal" ? { mainUse: data.mainUse, priorityNow: data.priorityNow } :
                          step === "team" ? { teamAgentsCount: data.teamAgentsCount, hasSupervisor: data.hasSupervisor, operationDays: data.operationDays, operationStartTime: data.operationStartTime, operationEndTime: data.operationEndTime, serviceHours: `${(data.operationDays || []).join(",")} ${data.operationStartTime}-${data.operationEndTime}`, languages: data.languages } :
                          step === "ai" ? { aiAutoMode: data.aiAutoMode, brandTone: data.brandTone, handoffAfterMessages: data.handoffAfterMessages } :
                          step === "whatsapp" ? { whatsappConnected: true, whatsappConnectedAt: data.whatsappConnectedAt || new Date().toISOString() } :
                          { aiCatalogSummary: data.aiCatalogSummary, aiKnowledgeLinks: data.aiKnowledgeLinks, aiGuardrails: data.aiGuardrails };
                        await save(patch);
                        setStep(next(step));
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === "final" && (
              <div className="space-y-4">
                <p className="text-[14px] text-black/70">Checklist final:</p>
                <ul className="space-y-2">
                  {progress.tasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px]">
                      <span className="text-black/75">{t.label}</span>
                      <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", t.done ? "bg-lime-500/15 text-lime-800" : "bg-amber-500/15 text-amber-800")}>{t.done ? "Concluido" : "Pendente"}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => setStep("welcome")} className="inline-flex h-[46px] items-center justify-center rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-black/75">Revisar etapas</button>
                  <div className="flex-1">
                    <Action label={completing ? "Finalizando..." : "Concluir e ir para dashboard"} disabled={completing || !canFinish} onClick={finish} />
                  </div>
                </div>
              </div>
            )}

            {banner && <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2 text-[13px] font-medium text-black/75">{banner}</div>}
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 flex items-center justify-between px-1 text-[12px] font-medium text-black/45">
          <span>Etapa {Math.max(STEPS.indexOf(step) + 1, 1)} de {STEPS.length}</span>
          <button type="button" onClick={() => setStep(next(step))} className="underline decoration-black/30 underline-offset-4">avancar rapido</button>
        </div>
      </div>
    </section>
  );
}
