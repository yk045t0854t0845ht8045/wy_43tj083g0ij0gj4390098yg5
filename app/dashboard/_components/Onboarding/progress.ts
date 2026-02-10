import type { OnboardingData, OnboardingProgress, OnboardingTask } from "./types";

function hasText(value: string | null | undefined, min = 2) {
  const clean = String(value || "").trim();
  return clean.length >= min;
}

function hasAnyArrayValue(values: string[] | null | undefined) {
  if (!Array.isArray(values)) return false;
  return values.some((value) => hasText(value, 1));
}

function isOperationDefined(data: OnboardingData) {
  return (
    hasText(data.serviceHours, 5) ||
    (hasText(data.operationStartTime, 3) && hasText(data.operationEndTime, 3))
  );
}

function hasAiHandoffRule(data: OnboardingData) {
  return (
    data.handoffHumanRequest === true ||
    data.handoffAngerUrgency === true ||
    data.handoffPricePayment === true ||
    (typeof data.handoffAfterMessages === "number" && data.handoffAfterMessages > 0)
  );
}

export function getOnboardingTasks(data: OnboardingData): OnboardingTask[] {
  const welcomeDone = data.welcomeConfirmed === true;

  const companyDone =
    hasText(data.companyName, 2) &&
    hasText(data.segment, 2) &&
    Boolean(data.companySize);

  const goalDone = hasText(data.mainUse, 2) && hasText(data.priorityNow, 2);

  const teamDone =
    typeof data.teamAgentsCount === "number" &&
    data.teamAgentsCount > 0 &&
    typeof data.hasSupervisor === "boolean" &&
    isOperationDefined(data) &&
    hasAnyArrayValue(data.languages);

  const aiDone =
    Boolean(data.aiAutoMode) &&
    Boolean(data.brandTone) &&
    (data.aiAutoMode !== "all" || hasAiHandoffRule(data));

  const whatsappDone = data.whatsappConnected === true;
  const finishDone =
    welcomeDone &&
    companyDone &&
    goalDone &&
    teamDone &&
    aiDone &&
    whatsappDone;

  return [
    { id: "welcome", label: "Boas-vindas", done: welcomeDone },
    { id: "company", label: "Dados da empresa", done: companyDone },
    { id: "goal", label: "Objetivo no WhatsApp", done: goalDone },
    { id: "team", label: "Equipe e operacao", done: teamDone },
    { id: "ai", label: "Configuracao de IA", done: aiDone },
    { id: "whatsapp", label: "Conexao do WhatsApp", done: whatsappDone },
    { id: "finish", label: "Finalizar cadastro", done: finishDone },
  ];
}

export function calculateOnboardingProgress(data: OnboardingData): OnboardingProgress {
  const tasks = getOnboardingTasks(data);
  const totalRequired = tasks.length;
  const completedRequired = tasks.filter((task) => task.done).length;
  const remaining = Math.max(totalRequired - completedRequired, 0);
  const percent =
    totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;

  return {
    tasks,
    completedRequired,
    totalRequired,
    percent: Math.max(0, Math.min(100, percent)),
    remaining,
    isCompleted: remaining === 0,
  };
}

export type OnboardingUiStep =
  | "welcome"
  | "company"
  | "goal"
  | "team"
  | "ai"
  | "whatsapp"
  | "improve"
  | "final";

export function getInitialOnboardingStep(data: OnboardingData): OnboardingUiStep {
  const tasks = getOnboardingTasks(data);
  const firstPendingTask = tasks.find((task) => !task.done);
  if (!firstPendingTask) return "final";

  if (firstPendingTask.id === "finish") {
    return "improve";
  }

  if (firstPendingTask.id === "welcome") return "welcome";
  if (firstPendingTask.id === "company") return "company";
  if (firstPendingTask.id === "goal") return "goal";
  if (firstPendingTask.id === "team") return "team";
  if (firstPendingTask.id === "ai") return "ai";
  return "whatsapp";
}
