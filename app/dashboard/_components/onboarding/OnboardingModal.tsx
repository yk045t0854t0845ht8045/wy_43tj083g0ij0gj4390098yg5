"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Loader2,
  MessageCircle,
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
  isOnlineBusiness: boolean;
  companyAddress: string | null;
  companyCity: string | null;
  companyState: string | null;
  companyPostalCode: string | null;
  welcomeConfirmed: boolean;
  teamAgentsCount: number | null;
  onboardingGoal: string | null;
  monthlyConversationsTier: string | null;
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
  whatsappState?: string;
  whatsappProvider?: string;
  providerConfigured?: boolean;
  companyLogoUrl?: string;
};

type OnboardingApiSuccessPayload = Omit<OnboardingApiPayload, "ok" | "onboarding"> & {
  ok: true;
  onboarding: OnboardingState;
};

type OnboardingModalProps = {
  open: boolean;
  required?: boolean;
  userEmail: string;
  initialData?: OnboardingState | null;
  apiBasePath?: string;
  logoApiBasePath?: string;
  contextId?: string | null;
  contextParamName?: string;
  flowMode?: "primary" | "additional-company";
  onClose: () => void;
  onUpdated?: (next: OnboardingState) => void;
  onCompleted?: (next: OnboardingState) => void;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function appendContextToPath(path: string, key: string, value?: string | null) {
  const cleanPath = String(path || "").trim();
  const cleanKey = String(key || "").trim();
  const cleanValue = String(value || "").trim();
  if (!cleanPath || !cleanKey || !cleanValue) return cleanPath;

  const base = "http://localhost";
  const url = new URL(cleanPath, base);
  url.searchParams.set(cleanKey, cleanValue);
  return `${url.pathname}${url.search}`;
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

function isValidCnpjDigits(value?: string | null) {
  const digits = normalizeCnpjDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const numbers = digits.split("").map((digit) => Number.parseInt(digit, 10));
  const calcDigit = (sliceLength: number) => {
    let factor = sliceLength - 7;
    const total = numbers.slice(0, sliceLength).reduce((acc, num) => {
      const next = acc + num * factor;
      factor -= 1;
      if (factor < 2) factor = 9;
      return next;
    }, 0);
    const mod = total % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const digit1 = calcDigit(12);
  const digit2 = calcDigit(13);
  return numbers[12] === digit1 && numbers[13] === digit2;
}

type PostalCodeLookupResult = {
  street: string;
  city: string;
  state: string;
  neighborhood: string;
};

function normalizeAddressNumber(value?: string | null) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}

function splitAddressAndNumber(value?: string | null) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) {
    return { street: "", number: "" };
  }

  const matched = clean.match(/^(.*?)[,\-]\s*([0-9A-Za-z/-]{1,20})$/);
  if (!matched) {
    return { street: clean, number: "" };
  }

  return {
    street: String(matched[1] || "").trim(),
    number: normalizeAddressNumber(matched[2] || ""),
  };
}

function composeAddressWithNumber(address: string, number: string) {
  const street = String(address || "")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedNumber = normalizeAddressNumber(number);
  if (!street) return "";
  if (!normalizedNumber) return street;
  return `${street}, ${normalizedNumber}`;
}

function normalizeComparableText(value?: string | null) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function toDraftStep(step: string): WizardStep {
  if (step === "team" || step === "whatsapp" || step === "final") return step;
  return "company";
}

type OnboardingDraft = {
  companyName: string;
  companyCnpj: string;
  industry: string;
  isOnlineBusiness: boolean;
  companyAddress: string;
  companyAddressNumber: string;
  companyCity: string;
  companyState: string;
  companyPostalCode: string;
  teamAgentsCount: string;
  onboardingGoal: string;
  monthlyConversationsTier: string;
  activeStep: WizardStep;
  updatedAt: string;
};

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
  isOnlineBusiness: boolean;
  companyAddress: string;
  companyAddressNumber: string;
  companyCity: string;
  companyState: string;
  companyPostalCode: string;
}) {
  const companyName = String(params.companyName || "").trim();
  const industry = String(params.industry || "").trim();
  const logoUrl = String(params.companyLogoUrl || "").trim();
  const cnpjDigits = normalizeCnpjDigits(params.companyCnpj);
  const address = String(params.companyAddress || "").trim();
  const addressNumber = normalizeAddressNumber(params.companyAddressNumber);
  const city = String(params.companyCity || "").trim();
  const state = String(params.companyState || "")
    .replace(/[^a-zA-Z]/g, "")
    .trim()
    .toUpperCase();
  const postalCode = String(params.companyPostalCode || "").replace(/\D+/g, "");

  if (!companyName) return "Informe o nome da empresa.";
  if (!industry) return "Informe a area de atuacao da empresa.";
  if (!logoUrl) return "Envie a logo da empresa para continuar.";
  if (cnpjDigits && !isValidCnpjDigits(cnpjDigits)) return "CNPJ invalido. Verifique os digitos.";
  if (!params.isOnlineBusiness) {
    if (!address) return "Informe o endereco da empresa.";
    if (!addressNumber) return "Informe o numero do endereco.";
    if (!city) return "Informe a cidade da empresa.";
    if (state.length !== 2) return "Informe o estado (UF) com 2 letras.";
    if (postalCode.length !== 8) return "Informe um CEP valido com 8 digitos.";
  }
  return null;
}

function isValidTeamCount(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  return TEAM_SIZE_OPTIONS.some((option) => option.value === clean);
}

function isValidOnboardingGoal(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  return ONBOARDING_GOAL_OPTIONS.some((option) => option.value === clean);
}

function isValidMonthlyConversationTier(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  return MONTHLY_CONVERSATION_TIER_OPTIONS.some((option) => option.value === clean);
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

function isAbortError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      String((error as { name?: unknown }).name || "") === "AbortError",
  );
}

function resolveRequestErrorMessage(error: unknown, fallback: string, timeoutFallback: string) {
  if (isAbortError(error)) return timeoutFallback;
  const message = error instanceof Error ? error.message : "";
  return String(message || "").trim() || fallback;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

type SelectOption = {
  value: string;
  label: string;
  search?: string;
};

const INDUSTRY_OPTIONS: SelectOption[] = [
  { value: "Administracao publica", label: "Administracao publica" },
  { value: "Advocacia e consultoria juridica", label: "Advocacia e consultoria juridica" },
  { value: "Agencia de marketing e publicidade", label: "Agencia de marketing e publicidade" },
  { value: "Agricultura e pecuaria", label: "Agricultura e pecuaria" },
  { value: "Agronegocio", label: "Agronegocio" },
  { value: "Alimentacao e bebidas", label: "Alimentacao e bebidas" },
  { value: "Aluguel e locacao de equipamentos", label: "Aluguel e locacao de equipamentos" },
  { value: "Arquitetura e urbanismo", label: "Arquitetura e urbanismo" },
  { value: "Artes, cultura e entretenimento", label: "Artes, cultura e entretenimento" },
  { value: "Assistencia tecnica e manutencao", label: "Assistencia tecnica e manutencao" },
  { value: "Atacado e distribuicao", label: "Atacado e distribuicao" },
  { value: "Atividades financeiras", label: "Atividades financeiras" },
  { value: "Auditoria e compliance", label: "Auditoria e compliance" },
  { value: "Automacao industrial", label: "Automacao industrial" },
  { value: "Automotivo e mobilidade", label: "Automotivo e mobilidade" },
  { value: "Bares e restaurantes", label: "Bares e restaurantes" },
  { value: "Beleza e estetica", label: "Beleza e estetica" },
  { value: "Biotecnologia", label: "Biotecnologia" },
  { value: "Call center e contact center", label: "Call center e contact center" },
  { value: "Capacitacao e treinamentos corporativos", label: "Capacitacao e treinamentos corporativos" },
  { value: "Comercio exterior", label: "Comercio exterior" },
  { value: "Comercio varejista", label: "Comercio varejista" },
  { value: "Construcao civil", label: "Construcao civil" },
  { value: "Construcao pesada e infraestrutura", label: "Construcao pesada e infraestrutura" },
  { value: "Contabilidade", label: "Contabilidade" },
  { value: "Cooperativas e associacoes", label: "Cooperativas e associacoes" },
  { value: "Corretagem de seguros", label: "Corretagem de seguros" },
  { value: "Cosmeticos e higiene pessoal", label: "Cosmeticos e higiene pessoal" },
  { value: "Defesa e seguranca", label: "Defesa e seguranca" },
  { value: "Design grafico e comunicacao visual", label: "Design grafico e comunicacao visual" },
  { value: "Distribuicao de energia", label: "Distribuicao de energia" },
  { value: "E-commerce e marketplace", label: "E-commerce e marketplace" },
  { value: "Educacao e ensino", label: "Educacao e ensino" },
  { value: "Eletronica e eletrodomesticos", label: "Eletronica e eletrodomesticos" },
  { value: "Embalagens", label: "Embalagens" },
  { value: "Energia renovavel", label: "Energia renovavel" },
  { value: "Engenharia civil", label: "Engenharia civil" },
  { value: "Engenharia eletrica", label: "Engenharia eletrica" },
  { value: "Engenharia mecanica", label: "Engenharia mecanica" },
  { value: "Engenharia quimica", label: "Engenharia quimica" },
  { value: "Esportes e atividades fisicas", label: "Esportes e atividades fisicas" },
  { value: "Eventos e cerimonial", label: "Eventos e cerimonial" },
  { value: "Farmaceutico e drogarias", label: "Farmaceutico e drogarias" },
  { value: "Fintech", label: "Fintech" },
  { value: "Franquias", label: "Franquias" },
  { value: "Gestao ambiental", label: "Gestao ambiental" },
  { value: "Gestao de residuos", label: "Gestao de residuos" },
  { value: "GovTech e servicos publicos", label: "GovTech e servicos publicos" },
  { value: "Hotelaria e hospedagem", label: "Hotelaria e hospedagem" },
  { value: "Imobiliario e incorporacao", label: "Imobiliario e incorporacao" },
  { value: "Importacao e exportacao", label: "Importacao e exportacao" },
  { value: "Industria alimenticia", label: "Industria alimenticia" },
  { value: "Industria automobilistica", label: "Industria automobilistica" },
  { value: "Industria de bebidas", label: "Industria de bebidas" },
  { value: "Industria de calcados", label: "Industria de calcados" },
  { value: "Industria de maquinas e equipamentos", label: "Industria de maquinas e equipamentos" },
  { value: "Industria de plastico e borracha", label: "Industria de plastico e borracha" },
  { value: "Industria de tecidos e confeccao", label: "Industria de tecidos e confeccao" },
  { value: "Industria farmaceutica", label: "Industria farmaceutica" },
  { value: "Industria metalurgica", label: "Industria metalurgica" },
  { value: "Industria moveleira", label: "Industria moveleira" },
  { value: "Industria quimica", label: "Industria quimica" },
  { value: "Industria siderurgica", label: "Industria siderurgica" },
  { value: "Informatica e suporte tecnico", label: "Informatica e suporte tecnico" },
  { value: "Instituicoes financeiras", label: "Instituicoes financeiras" },
  { value: "Internet e telecom", label: "Internet e telecom" },
  { value: "Jogos e esports", label: "Jogos e esports" },
  { value: "Laboratorios e diagnosticos", label: "Laboratorios e diagnosticos" },
  { value: "Limpeza e conservacao", label: "Limpeza e conservacao" },
  { value: "Logistica e transporte", label: "Logistica e transporte" },
  { value: "Marketing digital", label: "Marketing digital" },
  { value: "Materiais de construcao", label: "Materiais de construcao" },
  { value: "Medicina e clinicas", label: "Medicina e clinicas" },
  { value: "Mineracao", label: "Mineracao" },
  { value: "Moda e vestuario", label: "Moda e vestuario" },
  { value: "Moveis e decoracao", label: "Moveis e decoracao" },
  { value: "Negocios internacionais", label: "Negocios internacionais" },
  { value: "ONG e terceiro setor", label: "ONG e terceiro setor" },
  { value: "Odontologia", label: "Odontologia" },
  { value: "Papel e celulose", label: "Papel e celulose" },
  { value: "Pet shop e servicos veterinarios", label: "Pet shop e servicos veterinarios" },
  { value: "Pesquisa e desenvolvimento", label: "Pesquisa e desenvolvimento" },
  { value: "Planejamento financeiro", label: "Planejamento financeiro" },
  { value: "Portos e aeroportos", label: "Portos e aeroportos" },
  { value: "Producao audiovisual", label: "Producao audiovisual" },
  { value: "Producao rural", label: "Producao rural" },
  { value: "Produtos hospitalares", label: "Produtos hospitalares" },
  { value: "Recursos humanos e recrutamento", label: "Recursos humanos e recrutamento" },
  { value: "Relacoes publicas", label: "Relacoes publicas" },
  { value: "Representacao comercial", label: "Representacao comercial" },
  { value: "Saneamento", label: "Saneamento" },
  { value: "Saude suplementar", label: "Saude suplementar" },
  { value: "Seguranca eletronica", label: "Seguranca eletronica" },
  { value: "Seguranca patrimonial", label: "Seguranca patrimonial" },
  { value: "Seguros", label: "Seguros" },
  { value: "Servicos administrativos", label: "Servicos administrativos" },
  { value: "Servicos de apoio empresarial", label: "Servicos de apoio empresarial" },
  { value: "Servicos de traducao", label: "Servicos de traducao" },
  { value: "Servicos domesticos", label: "Servicos domesticos" },
  { value: "Servicos funerarios", label: "Servicos funerarios" },
  { value: "Servicos graficos", label: "Servicos graficos" },
  { value: "Servicos medicos especializados", label: "Servicos medicos especializados" },
  { value: "Software e tecnologia", label: "Software e tecnologia" },
  { value: "Startups", label: "Startups" },
  { value: "Supermercados e atacarejo", label: "Supermercados e atacarejo" },
  { value: "Telecomunicacoes", label: "Telecomunicacoes" },
  { value: "Terceirizacao de processos (BPO)", label: "Terceirizacao de processos (BPO)" },
  { value: "Tintas e revestimentos", label: "Tintas e revestimentos" },
  { value: "Turismo e agencias de viagem", label: "Turismo e agencias de viagem" },
  { value: "Universidades e pesquisa academica", label: "Universidades e pesquisa academica" },
  { value: "Varejo alimentar", label: "Varejo alimentar" },
  { value: "Varejo de eletronicos", label: "Varejo de eletronicos" },
  { value: "Varejo de moda", label: "Varejo de moda" },
  { value: "Varejo de saude", label: "Varejo de saude" },
  { value: "Varejo multissetorial", label: "Varejo multissetorial" },
  { value: "Veiculos e concessionarias", label: "Veiculos e concessionarias" },
  { value: "Video monitoramento", label: "Video monitoramento" },
  { value: "Outros servicos", label: "Outros servicos" },
];

const TEAM_SIZE_OPTIONS: SelectOption[] = [
  { value: "1", label: "0 a 1 funcionario (MEI)" },
  { value: "5", label: "2 a 5 funcionarios" },
  { value: "10", label: "6 a 10 funcionarios" },
  { value: "20", label: "11 a 20 funcionarios" },
  { value: "50", label: "21 a 50 funcionarios" },
  { value: "100", label: "51 a 100 funcionarios" },
  { value: "250", label: "101 a 250 funcionarios" },
  { value: "500", label: "251 a 500 funcionarios" },
  { value: "1000", label: "501 a 1000 funcionarios" },
  { value: "2000", label: "1001 a 2000 funcionarios" },
  { value: "5000", label: "2001 a 5000 funcionarios" },
];

const ONBOARDING_GOAL_OPTIONS: SelectOption[] = [
  { value: "support", label: "Suporte e atendimento" },
  { value: "sales", label: "Vendas e conversao" },
  { value: "scheduling", label: "Agendamentos" },
  { value: "billing", label: "Cobranca e financeiro" },
  { value: "mixed", label: "Uso misto" },
];

const MONTHLY_CONVERSATION_TIER_OPTIONS: SelectOption[] = [
  { value: "up_to_300", label: "Ate 300 conversas/mes" },
  { value: "301_1000", label: "301 a 1.000 conversas/mes" },
  { value: "1001_3000", label: "1.001 a 3.000 conversas/mes" },
  { value: "3001_10000", label: "3.001 a 10.000 conversas/mes" },
  { value: "10001_plus", label: "Mais de 10.000 conversas/mes" },
];
const MAX_COMPANY_LOGO_FILE_SIZE_BYTES = 1 * 1024 * 1024;
const COMPANY_LOGO_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);
const CLIENT_REQUEST_TIMEOUT_MS = 15000;
const ONBOARDING_HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
const WHATSAPP_QR_REGENERATE_COOLDOWN_MS = 4500;
const WHATSAPP_REALTIME_SYNC_INTERVAL_MS = 1800;

function formatPostalCode(value?: string | null) {
  const digits = String(value || "").replace(/\D+/g, "").slice(0, 8);
  if (!digits) return "";
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizePostalCodeDigits(value?: string | null) {
  return String(value || "").replace(/\D+/g, "").slice(0, 8);
}

function normalizeStateCode(value?: string | null) {
  return String(value || "")
    .replace(/[^a-zA-Z]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

async function lookupPostalCode(cepDigits: string): Promise<PostalCodeLookupResult | null> {
  const normalizedCep = normalizePostalCodeDigits(cepDigits);
  if (normalizedCep.length !== 8) return null;

  try {
    const viaCepRes = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`, {
      method: "GET",
      cache: "no-store",
    });
    if (viaCepRes.ok) {
      const viaCep = (await viaCepRes.json().catch(() => ({}))) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (!viaCep.erro) {
        return {
          street: String(viaCep.logradouro || "").trim(),
          neighborhood: String(viaCep.bairro || "").trim(),
          city: String(viaCep.localidade || "").trim(),
          state: normalizeStateCode(viaCep.uf || ""),
        };
      }
    }
  } catch {
    // Fallback below.
  }

  try {
    const brasilApiRes = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!brasilApiRes.ok) return null;
    const brasilApi = (await brasilApiRes.json().catch(() => ({}))) as {
      street?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
    };
    return {
      street: String(brasilApi.street || "").trim(),
      neighborhood: String(brasilApi.neighborhood || "").trim(),
      city: String(brasilApi.city || "").trim(),
      state: normalizeStateCode(brasilApi.state || ""),
    };
  } catch {
    return null;
  }
}

function normalizeTeamBucketFromCount(count?: number | null) {
  const parsed = typeof count === "number" ? count : Number.parseInt(String(count || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return "";

  for (const option of TEAM_SIZE_OPTIONS) {
    const optionValue = Number.parseInt(option.value, 10);
    if (parsed <= optionValue) return option.value;
  }
  return TEAM_SIZE_OPTIONS[TEAM_SIZE_OPTIONS.length - 1]?.value || "";
}

function resolveTeamLabelFromCount(count?: number | null) {
  const bucket = normalizeTeamBucketFromCount(count);
  const option = TEAM_SIZE_OPTIONS.find((item) => item.value === bucket);
  return option?.label || "nao informado";
}

function resolveOnboardingGoalLabel(value?: string | null) {
  const clean = String(value || "").trim();
  const option = ONBOARDING_GOAL_OPTIONS.find((item) => item.value === clean);
  return option?.label || "nao informado";
}

function resolveMonthlyConversationsLabel(value?: string | null) {
  const clean = String(value || "").trim();
  const option = MONTHLY_CONVERSATION_TIER_OPTIONS.find((item) => item.value === clean);
  return option?.label || "nao informado";
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
                      // Prevent label click forwarding from reopening the menu.
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

export default function OnboardingModal({
  open,
  required = false,
  userEmail,
  initialData = null,
  apiBasePath = "/api/wz_users/onboarding",
  logoApiBasePath = "/api/wz_users/onboarding/logo",
  contextId = null,
  contextParamName = "companyOnboardingId",
  flowMode = "primary",
  onClose,
  onUpdated,
  onCompleted,
}: OnboardingModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const companyLogoFieldRef = useRef<HTMLDivElement | null>(null);
  const lastResolvedPostalCodeRef = useRef("");
  const loadedDraftKeyRef = useRef<string | null>(null);
  const latestFetchRequestIdRef = useRef(0);
  const silentFetchInFlightRef = useRef(false);
  const companyFormDirtyRef = useRef(false);
  const teamFormDirtyRef = useRef(false);
  const hasLoadedOnboardingRef = useRef(Boolean(initialData));
  const qrGenerationInFlightRef = useRef(false);
  const lastQrGenerationAtRef = useRef(0);
  const onboardingHeartbeatInFlightRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [postalLookupLoading, setPostalLookupLoading] = useState(false);
  const [postalLookupMessage, setPostalLookupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyLogoError, setCompanyLogoError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(initialData);
  const [activeStep, setActiveStep] = useState<WizardStep>(normalizeStepFromOnboarding(initialData));
  const [companyName, setCompanyName] = useState(String(initialData?.companyName || ""));
  const [companyLogoUrl, setCompanyLogoUrl] = useState(String(initialData?.companyLogoUrl || ""));
  const [companyCnpj, setCompanyCnpj] = useState(formatCnpj(initialData?.companyCnpj || ""));
  const [industry, setIndustry] = useState(String(initialData?.industry || ""));
  const [isOnlineBusiness, setIsOnlineBusiness] = useState(Boolean(initialData?.isOnlineBusiness));
  const initialAddressParts = useMemo(
    () => splitAddressAndNumber(initialData?.companyAddress || ""),
    [initialData?.companyAddress],
  );
  const [companyAddress, setCompanyAddress] = useState(String(initialAddressParts.street || ""));
  const [companyAddressNumber, setCompanyAddressNumber] = useState(String(initialAddressParts.number || ""));
  const [companyCity, setCompanyCity] = useState(String(initialData?.companyCity || ""));
  const [companyState, setCompanyState] = useState(String(initialData?.companyState || ""));
  const [companyPostalCode, setCompanyPostalCode] = useState(formatPostalCode(initialData?.companyPostalCode || ""));
  const [teamAgentsCount, setTeamAgentsCount] = useState(normalizeTeamBucketFromCount(initialData?.teamAgentsCount));
  const [onboardingGoal, setOnboardingGoal] = useState(String(initialData?.onboardingGoal || ""));
  const [monthlyConversationsTier, setMonthlyConversationsTier] = useState(
    String(initialData?.monthlyConversationsTier || ""),
  );
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string>("");
  const [whatsappState, setWhatsappState] = useState<string>("");
  const [providerConfigured, setProviderConfigured] = useState(true);
  const whatsappConnectedRef = useRef(Boolean(initialData?.whatsappConnected));
  const qrCodeDataUrlRef = useRef("");
  const whatsappStateRef = useRef("");
  const canDismiss = !required || Boolean(onboarding?.completed);
  const isAdditionalCompanyFlow = flowMode === "additional-company";
  const resolvedApiPath = useMemo(
    () => appendContextToPath(apiBasePath, contextParamName, contextId),
    [apiBasePath, contextId, contextParamName],
  );
  const resolvedLogoApiPath = useMemo(
    () => appendContextToPath(logoApiBasePath, contextParamName, contextId),
    [contextId, contextParamName, logoApiBasePath],
  );

  const handleDismiss = useCallback(() => {
    if (!canDismiss) return;
    onClose();
  }, [canDismiss, onClose]);

  const progressPercent = useMemo(() => {
    const idx = toLocalStepIndex(activeStep);
    return Math.round(((idx + 1) / 4) * 100);
  }, [activeStep]);

  const canGoBack = activeStep !== "company";

  const clearCompanyLogoError = useCallback(() => {
    setCompanyLogoError(null);
  }, []);

  const showCompanyLogoError = useCallback((message: string) => {
    const nextMessage = String(message || "").trim() || "Nao foi possivel enviar a logo.";
    setCompanyLogoError(nextMessage);
    requestAnimationFrame(() => {
      companyLogoFieldRef.current?.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    });
  }, [prefersReducedMotion]);

  const restoreCompanyFormFromOnboarding = useCallback((source?: OnboardingState | null) => {
    const next = source || onboarding;
    if (!next) return;
    const addressParts = splitAddressAndNumber(next.companyAddress || "");
    setCompanyName(String(next.companyName || ""));
    setCompanyLogoUrl(String(next.companyLogoUrl || ""));
    setCompanyCnpj(formatCnpj(next.companyCnpj || ""));
    setIndustry(String(next.industry || ""));
    setIsOnlineBusiness(Boolean(next.isOnlineBusiness));
    setCompanyAddress(String(addressParts.street || ""));
    setCompanyAddressNumber(String(addressParts.number || ""));
    setCompanyCity(String(next.companyCity || ""));
    setCompanyState(String(next.companyState || ""));
    setCompanyPostalCode(formatPostalCode(next.companyPostalCode || ""));
    lastResolvedPostalCodeRef.current = normalizePostalCodeDigits(next.companyPostalCode || "");
    if (String(next.companyLogoUrl || "").trim()) {
      setCompanyLogoError(null);
    }
  }, [onboarding]);

  const restoreTeamFormFromOnboarding = useCallback((source?: OnboardingState | null) => {
    const next = source || onboarding;
    if (!next) return;
    setTeamAgentsCount(normalizeTeamBucketFromCount(next.teamAgentsCount));
    setOnboardingGoal(String(next.onboardingGoal || ""));
    setMonthlyConversationsTier(String(next.monthlyConversationsTier || ""));
  }, [onboarding]);

  const navigateToStep = useCallback((nextStep: WizardStep) => {
    if (nextStep === "company") {
      restoreCompanyFormFromOnboarding();
    }
    if (nextStep === "team") {
      restoreTeamFormFromOnboarding();
    }
    setActiveStep(nextStep);
  }, [restoreCompanyFormFromOnboarding, restoreTeamFormFromOnboarding]);

  const leftSteps = useMemo(() => {
    return [
      {
        id: "company" as WizardStep,
        title: "Dados da empresa",
        subtitle: "Logo, nome, CNPJ e atuacao",
        icon: Building2,
      },
      {
        id: "team" as WizardStep,
        title: "Estrutura de atendimento",
        subtitle: "Equipe, objetivo e volume",
        icon: Users,
      },
      {
        id: "whatsapp" as WizardStep,
        title: "Conectar WhatsApp",
        subtitle: "Conexao automatica em tempo real",
        icon: MessageCircle,
      },
      {
        id: "final" as WizardStep,
        title: isAdditionalCompanyFlow ? "Empresa vinculada" : "Tudo pronto",
        subtitle: isAdditionalCompanyFlow ? "Concluir e criar sistema" : "Revisar e concluir",
        icon: CheckCircle2,
      },
    ];
  }, [isAdditionalCompanyFlow]);

  const industryOptions = useMemo(() => {
    const current = String(industry || "").trim();
    if (!current) return INDUSTRY_OPTIONS;
    const exists = INDUSTRY_OPTIONS.some((option) => option.value.toLowerCase() === current.toLowerCase());
    if (exists) return INDUSTRY_OPTIONS;
    return [{ value: current, label: `${current} (atual)` }, ...INDUSTRY_OPTIONS];
  }, [industry]);

  const draftStorageKey = useMemo(() => {
    const base = String(onboarding?.userId || onboarding?.email || userEmail || "")
      .trim()
      .toLowerCase();
    if (!base) return null;
    const flowToken = isAdditionalCompanyFlow
      ? `company:${String(contextId || "").trim() || "new"}`
      : "primary";
    return `wz:onboarding:draft:${flowToken}:${base}`;
  }, [contextId, isAdditionalCompanyFlow, onboarding?.email, onboarding?.userId, userEmail]);

  const companyFormDirty = useMemo(() => {
    const baseAddressParts = splitAddressAndNumber(onboarding?.companyAddress || "");
    const basePostalCode = normalizePostalCodeDigits(onboarding?.companyPostalCode || "");
    const currentPostalCode = normalizePostalCodeDigits(companyPostalCode);
    const baseState = normalizeStateCode(onboarding?.companyState || "");
    const currentState = normalizeStateCode(companyState);
    const baseCnpj = normalizeCnpjDigits(onboarding?.companyCnpj || "");
    const currentCnpj = normalizeCnpjDigits(companyCnpj);

    return (
      normalizeComparableText(companyName) !== normalizeComparableText(onboarding?.companyName || "") ||
      normalizeComparableText(industry) !== normalizeComparableText(onboarding?.industry || "") ||
      currentCnpj !== baseCnpj ||
      Boolean(isOnlineBusiness) !== Boolean(onboarding?.isOnlineBusiness) ||
      normalizeComparableText(companyAddress) !== normalizeComparableText(baseAddressParts.street) ||
      normalizeComparableText(companyAddressNumber) !== normalizeComparableText(baseAddressParts.number) ||
      normalizeComparableText(companyCity) !== normalizeComparableText(onboarding?.companyCity || "") ||
      currentState !== baseState ||
      currentPostalCode !== basePostalCode
    );
  }, [
    companyAddress,
    companyAddressNumber,
    companyCity,
    companyCnpj,
    companyName,
    companyPostalCode,
    companyState,
    industry,
    isOnlineBusiness,
    onboarding?.companyAddress,
    onboarding?.companyCity,
    onboarding?.companyCnpj,
    onboarding?.companyName,
    onboarding?.companyPostalCode,
    onboarding?.companyState,
    onboarding?.industry,
    onboarding?.isOnlineBusiness,
  ]);

  const teamFormDirty = useMemo(() => {
    const baseTeam = normalizeTeamBucketFromCount(onboarding?.teamAgentsCount);
    return (
      String(teamAgentsCount || "") !== String(baseTeam || "") ||
      normalizeComparableText(onboardingGoal) !== normalizeComparableText(onboarding?.onboardingGoal || "") ||
      normalizeComparableText(monthlyConversationsTier) !==
        normalizeComparableText(onboarding?.monthlyConversationsTier || "")
    );
  }, [
    monthlyConversationsTier,
    onboarding?.monthlyConversationsTier,
    onboarding?.onboardingGoal,
    onboarding?.teamAgentsCount,
    onboardingGoal,
    teamAgentsCount,
  ]);

  const hasUnsavedChanges = companyFormDirty || teamFormDirty;

  useEffect(() => {
    companyFormDirtyRef.current = companyFormDirty;
    teamFormDirtyRef.current = teamFormDirty;
  }, [companyFormDirty, teamFormDirty]);

  const applyOnboardingUpdate = useCallback(
    (next: OnboardingState, opts?: { respectDirty?: boolean }) => {
      const respectDirty = opts?.respectDirty !== false;
      const allowCompanySync = !respectDirty || !companyFormDirtyRef.current;
      const allowTeamSync = !respectDirty || !teamFormDirtyRef.current;
      const addressParts = splitAddressAndNumber(next.companyAddress || "");
      setOnboarding(next);
      setCompanyLogoUrl(String(next.companyLogoUrl || ""));
      if (String(next.companyLogoUrl || "").trim()) {
        setCompanyLogoError(null);
      }
      if (allowCompanySync) {
        setCompanyName(String(next.companyName || ""));
        setCompanyCnpj(formatCnpj(next.companyCnpj || ""));
        setIndustry(String(next.industry || ""));
        setIsOnlineBusiness(Boolean(next.isOnlineBusiness));
        setCompanyAddress(String(addressParts.street || ""));
        setCompanyAddressNumber(String(addressParts.number || ""));
        setCompanyCity(String(next.companyCity || ""));
        setCompanyState(String(next.companyState || ""));
        setCompanyPostalCode(formatPostalCode(next.companyPostalCode || ""));
        lastResolvedPostalCodeRef.current = normalizePostalCodeDigits(next.companyPostalCode || "");
      }
      if (allowTeamSync) {
        setTeamAgentsCount(normalizeTeamBucketFromCount(next.teamAgentsCount));
        setOnboardingGoal(String(next.onboardingGoal || ""));
        setMonthlyConversationsTier(String(next.monthlyConversationsTier || ""));
      }
      setActiveStep(normalizeStepFromOnboarding(next));
      setPairingExpiresAt(next.whatsappPairingExpiresAt || null);
      const nextWhatsappState = next.whatsappConnected ? "open" : "close";
      setWhatsappState(nextWhatsappState);
      whatsappConnectedRef.current = Boolean(next.whatsappConnected);
      whatsappStateRef.current = nextWhatsappState;
      onUpdated?.(next);
    },
    [onUpdated],
  );

  const fetchOnboarding = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (silent && silentFetchInFlightRef.current) {
        return null;
      }

      const requestId = ++latestFetchRequestIdRef.current;
      if (silent) {
        silentFetchInFlightRef.current = true;
      }
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetchWithTimeout(resolvedApiPath, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        }, CLIENT_REQUEST_TIMEOUT_MS);
        const payload = (await res.json().catch(() => ({}))) as OnboardingApiPayload;
        if (!res.ok || !payload?.ok || !payload.onboarding) {
          throw new Error(String(payload?.error || "Nao foi possivel carregar onboarding."));
        }
        if (requestId !== latestFetchRequestIdRef.current) {
          return null;
        }
        hasLoadedOnboardingRef.current = true;
        applyOnboardingUpdate(payload.onboarding);
        if (payload.qrCodeDataUrl) {
          setQrCodeDataUrl(String(payload.qrCodeDataUrl));
        } else if (payload.onboarding.whatsappConnected || payload.onboarding.uiStep !== "whatsapp") {
          setQrCodeDataUrl("");
        }
        setPairingExpiresAt(String(payload.pairingExpiresAt || payload.onboarding.whatsappPairingExpiresAt || "") || null);
        setPairingUrl(String(payload.pairingUrl || ""));
        const resolvedWhatsappState = String(
          payload.whatsappState || (payload.onboarding.whatsappConnected ? "open" : "close"),
        );
        setWhatsappState(resolvedWhatsappState);
        whatsappConnectedRef.current = Boolean(payload.onboarding.whatsappConnected);
        whatsappStateRef.current = resolvedWhatsappState;
        setProviderConfigured(payload.providerConfigured !== false);
        if (payload.qrCodeDataUrl) {
          qrCodeDataUrlRef.current = String(payload.qrCodeDataUrl);
        } else if (payload.onboarding.whatsappConnected || payload.onboarding.uiStep !== "whatsapp") {
          qrCodeDataUrlRef.current = "";
        }
        return payload;
      } catch (fetchError) {
        if (requestId === latestFetchRequestIdRef.current) {
          setError(
            resolveRequestErrorMessage(
              fetchError,
              "Falha ao carregar onboarding.",
              "O onboarding demorou demais para responder. Tente novamente.",
            ),
          );
        }
        return null;
      } finally {
        if (silent) {
          silentFetchInFlightRef.current = false;
        }
        if (!silent) {
          if (requestId === latestFetchRequestIdRef.current) {
            setLoading(false);
          }
        }
      }
    },
    [applyOnboardingUpdate, resolvedApiPath],
  );

  const generateWhatsAppQr = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (qrGenerationInFlightRef.current) return null;
      qrGenerationInFlightRef.current = true;
      lastQrGenerationAtRef.current = Date.now();

      try {
        const res = await fetchWithTimeout(resolvedApiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ action: "generate-whatsapp-qr" }),
        }, CLIENT_REQUEST_TIMEOUT_MS);
        const payload = (await res.json().catch(() => ({}))) as OnboardingApiPayload;
        if (!res.ok || !payload?.ok || !payload.onboarding) {
          throw new Error(String(payload?.error || "Nao foi possivel gerar QR Code do WhatsApp."));
        }

        applyOnboardingUpdate(payload.onboarding);
        if (payload.qrCodeDataUrl) {
          setQrCodeDataUrl(String(payload.qrCodeDataUrl));
          qrCodeDataUrlRef.current = String(payload.qrCodeDataUrl);
        } else if (payload.onboarding.whatsappConnected || payload.onboarding.uiStep !== "whatsapp") {
          setQrCodeDataUrl("");
          qrCodeDataUrlRef.current = "";
        }
        setPairingExpiresAt(String(payload.pairingExpiresAt || payload.onboarding.whatsappPairingExpiresAt || "") || null);
        setPairingUrl(String(payload.pairingUrl || ""));
        const resolvedWhatsappState = String(
          payload.whatsappState || (payload.onboarding.whatsappConnected ? "open" : "close"),
        );
        setWhatsappState(resolvedWhatsappState);
        whatsappConnectedRef.current = Boolean(payload.onboarding.whatsappConnected);
        whatsappStateRef.current = resolvedWhatsappState;
        if (typeof payload.providerConfigured === "boolean") {
          setProviderConfigured(payload.providerConfigured);
        }
        return payload;
      } catch (generateError) {
        if (!opts?.silent) {
          setError(
            resolveRequestErrorMessage(
              generateError,
              "Falha ao gerar QR Code.",
              "A geracao do QR Code demorou demais. Tente novamente.",
            ),
          );
        }
        return null;
      } finally {
        qrGenerationInFlightRef.current = false;
      }
    },
    [applyOnboardingUpdate, resolvedApiPath],
  );

  useEffect(() => {
    whatsappConnectedRef.current = Boolean(onboarding?.whatsappConnected);
  }, [onboarding?.whatsappConnected]);

  useEffect(() => {
    qrCodeDataUrlRef.current = String(qrCodeDataUrl || "");
  }, [qrCodeDataUrl]);

  useEffect(() => {
    whatsappStateRef.current = String(whatsappState || "");
  }, [whatsappState]);

  useEffect(() => {
    if (!initialData) return;
    hasLoadedOnboardingRef.current = true;
  }, [initialData]);

  useEffect(() => {
    if (!initialData) return;
    applyOnboardingUpdate(initialData);
  }, [applyOnboardingUpdate, initialData]);

  useEffect(() => {
    if (!open) return;
    void fetchOnboarding({ silent: hasLoadedOnboardingRef.current });
  }, [fetchOnboarding, open]);

  useEffect(() => {
    if (open) return;
    loadedDraftKeyRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!draftStorageKey) return;
    if (loadedDraftKeyRef.current === draftStorageKey) return;
    if (typeof window === "undefined") return;

    loadedDraftKeyRef.current = draftStorageKey;
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;

      setCompanyName(String(parsed.companyName || ""));
      setCompanyCnpj(formatCnpj(parsed.companyCnpj || ""));
      setIndustry(String(parsed.industry || ""));
      setIsOnlineBusiness(Boolean(parsed.isOnlineBusiness));
      setCompanyAddress(String(parsed.companyAddress || ""));
      setCompanyAddressNumber(String(parsed.companyAddressNumber || ""));
      setCompanyCity(String(parsed.companyCity || ""));
      setCompanyState(normalizeStateCode(parsed.companyState || ""));
      setCompanyPostalCode(formatPostalCode(parsed.companyPostalCode || ""));
      setTeamAgentsCount(String(parsed.teamAgentsCount || ""));
      setOnboardingGoal(String(parsed.onboardingGoal || ""));
      setMonthlyConversationsTier(String(parsed.monthlyConversationsTier || ""));

      const nextStep = toDraftStep(String(parsed.activeStep || "company"));
      if (nextStep === "company" || nextStep === "team") {
        setActiveStep(nextStep);
      }
    } catch {
      // Ignore corrupted draft.
    }
  }, [draftStorageKey, open]);

  useEffect(() => {
    if (!open) return;
    if (!onboarding) return;
    if (activeStep === "company") {
      const savedCompanyExists =
        Boolean(normalizeComparableText(onboarding.companyName)) ||
        Boolean(normalizeComparableText(onboarding.industry)) ||
        Boolean(normalizeComparableText(onboarding.companyLogoUrl));
      const companyFormLooksEmpty =
        !normalizeComparableText(companyName) &&
        !normalizeComparableText(industry) &&
        !normalizeComparableText(companyLogoUrl) &&
        !normalizeComparableText(companyCnpj) &&
        !normalizeComparableText(companyAddress) &&
        !normalizeComparableText(companyAddressNumber) &&
        !normalizeComparableText(companyCity) &&
        !normalizeComparableText(companyState) &&
        !normalizePostalCodeDigits(companyPostalCode);

      if (savedCompanyExists && companyFormLooksEmpty) {
        restoreCompanyFormFromOnboarding(onboarding);
      }
      return;
    }

    if (activeStep !== "team") return;
    const savedTeamExists = Boolean(
      onboarding.teamAgentsCount && onboarding.onboardingGoal && onboarding.monthlyConversationsTier,
    );
    const teamFormLooksEmpty =
      !String(teamAgentsCount || "").trim() &&
      !String(onboardingGoal || "").trim() &&
      !String(monthlyConversationsTier || "").trim();

    if (savedTeamExists && teamFormLooksEmpty) {
      restoreTeamFormFromOnboarding(onboarding);
    }
  }, [
    activeStep,
    companyAddress,
    companyAddressNumber,
    companyCity,
    companyCnpj,
    companyLogoUrl,
    companyName,
    companyPostalCode,
    companyState,
    industry,
    monthlyConversationsTier,
    onboarding,
    onboardingGoal,
    open,
    restoreCompanyFormFromOnboarding,
    restoreTeamFormFromOnboarding,
    teamAgentsCount,
  ]);

  useEffect(() => {
    if (!open) return;
    if (!draftStorageKey) return;
    if (typeof window === "undefined") return;

    try {
      if (!hasUnsavedChanges) {
        window.localStorage.removeItem(draftStorageKey);
        return;
      }

      const draft: OnboardingDraft = {
        companyName: String(companyName || ""),
        companyCnpj: normalizeCnpjDigits(companyCnpj),
        industry: String(industry || ""),
        isOnlineBusiness: Boolean(isOnlineBusiness),
        companyAddress: String(companyAddress || ""),
        companyAddressNumber: String(companyAddressNumber || ""),
        companyCity: String(companyCity || ""),
        companyState: normalizeStateCode(companyState || ""),
        companyPostalCode: normalizePostalCodeDigits(companyPostalCode),
        teamAgentsCount: String(teamAgentsCount || ""),
        onboardingGoal: String(onboardingGoal || ""),
        monthlyConversationsTier: String(monthlyConversationsTier || ""),
        activeStep,
        updatedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Ignore storage failures.
    }
  }, [
    activeStep,
    companyAddress,
    companyAddressNumber,
    companyCity,
    companyCnpj,
    companyName,
    companyPostalCode,
    companyState,
    draftStorageKey,
    hasUnsavedChanges,
    industry,
    isOnlineBusiness,
    monthlyConversationsTier,
    onboardingGoal,
    open,
    teamAgentsCount,
  ]);

  useEffect(() => {
    if (!open) return;
    if (activeStep !== "company") return;
    if (isOnlineBusiness) {
      setPostalLookupLoading(false);
      setPostalLookupMessage(null);
      return;
    }

    const cepDigits = normalizePostalCodeDigits(companyPostalCode);
    if (cepDigits.length !== 8) {
      setPostalLookupLoading(false);
      setPostalLookupMessage(null);
      if (cepDigits.length === 0) {
        lastResolvedPostalCodeRef.current = "";
      }
      return;
    }
    if (lastResolvedPostalCodeRef.current === cepDigits) return;

    let cancelled = false;
    setPostalLookupLoading(true);
    setPostalLookupMessage(null);

    void (async () => {
      const lookedUp = await lookupPostalCode(cepDigits);
      if (cancelled) return;

      setPostalLookupLoading(false);
      lastResolvedPostalCodeRef.current = cepDigits;

      if (!lookedUp) {
        setPostalLookupMessage("Nao foi possivel completar esse CEP automaticamente.");
        return;
      }

      const addressParts = [lookedUp.street, lookedUp.neighborhood].filter(Boolean);
      if (addressParts.length > 0) {
        setCompanyAddress((current) => {
          const cleanCurrent = String(current || "").trim();
          return cleanCurrent || addressParts.join(" - ");
        });
      }
      if (lookedUp.city) {
        setCompanyCity((current) => String(current || "").trim() || lookedUp.city);
      }
      if (lookedUp.state) {
        setCompanyState((current) => normalizeStateCode(current || "") || lookedUp.state);
      }
      setPostalLookupMessage("Endereco preenchido automaticamente pelo CEP.");
    })();

    return () => {
      cancelled = true;
    };
  }, [activeStep, companyPostalCode, isOnlineBusiness, open]);

  useEffect(() => {
    if (!open) return;
    if (activeStep !== "whatsapp") return;
    if (onboarding?.completed) return;

    let stopped = false;
    const syncRealtime = async () => {
      if (stopped) return;
      const payload = await fetchOnboarding({ silent: true });
      if (stopped) return;

      const connectedNow = Boolean(payload?.onboarding?.whatsappConnected || whatsappConnectedRef.current);
      const hasQrNow = Boolean(payload?.qrCodeDataUrl || qrCodeDataUrlRef.current);
      if (connectedNow || hasQrNow) return;

      const currentProviderState = String(payload?.whatsappState || whatsappStateRef.current || "").toLowerCase();
      const providerNeedsRecovery =
        currentProviderState === "error" ||
        currentProviderState === "logged_out" ||
        currentProviderState === "close";
      const cooldownElapsed = Date.now() - lastQrGenerationAtRef.current > WHATSAPP_QR_REGENERATE_COOLDOWN_MS;
      if (providerNeedsRecovery || cooldownElapsed) {
        await generateWhatsAppQr({ silent: true });
      }
    };

    void syncRealtime();
    const timer = window.setInterval(() => {
      void syncRealtime();
    }, WHATSAPP_REALTIME_SYNC_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [
    activeStep,
    fetchOnboarding,
    generateWhatsAppQr,
    onboarding?.completed,
    open,
  ]);

  useEffect(() => {
    if (!open) return;
    if (activeStep !== "whatsapp") return;
    if (whatsappConnectedRef.current) return;
    if (qrCodeDataUrlRef.current) return;

    const cooldownElapsed = Date.now() - lastQrGenerationAtRef.current > 2000;
    if (!cooldownElapsed) return;
    void generateWhatsAppQr({ silent: true });
  }, [activeStep, generateWhatsAppQr, open]);

  const sendPresenceHeartbeat = useCallback(async () => {
    if (onboardingHeartbeatInFlightRef.current) return null;
    if (!onboarding?.id || onboarding.completed) return null;

    onboardingHeartbeatInFlightRef.current = true;
    try {
      const res = await fetchWithTimeout(resolvedApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ action: "heartbeat" }),
      }, CLIENT_REQUEST_TIMEOUT_MS);
      const payload = (await res.json().catch(() => ({}))) as OnboardingApiPayload;
      if (!res.ok || !payload?.ok || !payload.onboarding) {
        return null;
      }
      setOnboarding((current) => {
        if (!current) return payload.onboarding || null;
        return {
          ...current,
          updatedAt: payload.onboarding?.updatedAt || current.updatedAt,
          completed: Boolean(payload.onboarding?.completed),
          completedAt: payload.onboarding?.completedAt || current.completedAt,
        };
      });
      return payload.onboarding;
    } catch {
      return null;
    } finally {
      onboardingHeartbeatInFlightRef.current = false;
    }
  }, [onboarding?.completed, onboarding?.id, resolvedApiPath]);

  useEffect(() => {
    if (!open) return;
    if (!onboarding || onboarding.completed) return;

    const triggerHeartbeat = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void sendPresenceHeartbeat();
    };

    triggerHeartbeat();
    const intervalId = window.setInterval(triggerHeartbeat, ONBOARDING_HEARTBEAT_INTERVAL_MS);
    const onFocus = () => triggerHeartbeat();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerHeartbeat();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [onboarding?.completed, onboarding?.id, open, sendPresenceHeartbeat]);

  useEffect(() => {
    if (!open) return;
    if (activeStep !== "whatsapp") return;
    if (!onboarding?.whatsappConnected) return;
    setActiveStep("final");
  }, [activeStep, onboarding?.whatsappConnected, open]);

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

  useEffect(() => {
    if (!open) return;
    if (!hasUnsavedChanges) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges, open]);

  const postAction = useCallback(
    async (
      body: Record<string, unknown>,
      opts?: { respectDirty?: boolean },
    ): Promise<OnboardingApiSuccessPayload> => {
      let res: Response;
      try {
        res = await fetchWithTimeout(resolvedApiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify(body),
        }, CLIENT_REQUEST_TIMEOUT_MS);
      } catch (actionError) {
        throw new Error(
          resolveRequestErrorMessage(
            actionError,
            "Falha ao salvar onboarding.",
            "A operacao demorou demais para responder. Tente novamente.",
          ),
        );
      }
      const payload = (await res.json().catch(() => ({}))) as OnboardingApiPayload;
      if (!res.ok || !payload?.ok || !payload.onboarding) {
        throw new Error(String(payload?.error || "Falha ao salvar onboarding."));
      }

      const successPayload = payload as OnboardingApiSuccessPayload;

      applyOnboardingUpdate(successPayload.onboarding, { respectDirty: opts?.respectDirty });
      if (successPayload.qrCodeDataUrl) {
        setQrCodeDataUrl(String(successPayload.qrCodeDataUrl));
        qrCodeDataUrlRef.current = String(successPayload.qrCodeDataUrl);
      } else if (successPayload.onboarding.whatsappConnected || successPayload.onboarding.uiStep !== "whatsapp") {
        setQrCodeDataUrl("");
        qrCodeDataUrlRef.current = "";
      }
      setPairingExpiresAt(
        String(successPayload.pairingExpiresAt || successPayload.onboarding.whatsappPairingExpiresAt || "") || null,
      );
      setPairingUrl(String(successPayload.pairingUrl || ""));
      const resolvedWhatsappState = String(
        successPayload.whatsappState || (successPayload.onboarding.whatsappConnected ? "open" : "close"),
      );
      setWhatsappState(resolvedWhatsappState);
      whatsappStateRef.current = resolvedWhatsappState;
      whatsappConnectedRef.current = Boolean(successPayload.onboarding.whatsappConnected);
      if (typeof successPayload.providerConfigured === "boolean") {
        setProviderConfigured(successPayload.providerConfigured);
      }
      if (successPayload.onboarding.completed) onCompleted?.(successPayload.onboarding);
      return successPayload;
    },
    [applyOnboardingUpdate, onCompleted, resolvedApiPath],
  );

  const handleCompanyContinue = useCallback(async () => {
    setError(null);
    clearCompanyLogoError();
    const validationError = isValidCompanyForm({
      companyName,
      industry,
      companyLogoUrl,
      companyCnpj,
      isOnlineBusiness,
      companyAddress,
      companyAddressNumber,
      companyCity,
      companyState,
      companyPostalCode,
    });
    if (validationError) {
      if (validationError === "Envie a logo da empresa para continuar.") {
        showCompanyLogoError(validationError);
      } else {
        setError(validationError);
      }
      return;
    }

    try {
      setSaving(true);
      const payload = await postAction({
        action: "save-company",
        companyName,
        industry,
        companyLogoUrl,
        companyCnpj: normalizeCnpjDigits(companyCnpj),
        isOnlineBusiness,
        companyAddress: isOnlineBusiness
          ? null
          : composeAddressWithNumber(String(companyAddress || ""), String(companyAddressNumber || "")),
        companyCity: isOnlineBusiness ? null : String(companyCity || "").trim(),
        companyState: isOnlineBusiness ? null : String(companyState || "").trim().toUpperCase(),
        companyPostalCode: isOnlineBusiness ? null : String(companyPostalCode || "").replace(/\D+/g, ""),
      }, { respectDirty: false });
      setActiveStep(normalizeStepFromOnboarding(payload.onboarding));
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Nao foi possivel salvar dados da empresa.";
      if (message.toLowerCase().includes("logo")) {
        showCompanyLogoError(message);
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }, [
    clearCompanyLogoError,
    companyAddress,
    companyAddressNumber,
    companyCity,
    companyCnpj,
    companyLogoUrl,
    companyName,
    companyPostalCode,
    companyState,
    industry,
    isOnlineBusiness,
    postAction,
    showCompanyLogoError,
  ]);

  const handleTeamContinue = useCallback(async () => {
    setError(null);
    if (!isValidTeamCount(teamAgentsCount)) {
      setError("Selecione uma faixa valida de quantidade de funcionarios.");
      return;
    }
    if (!isValidOnboardingGoal(onboardingGoal)) {
      setError("Selecione o principal objetivo da sua operacao.");
      return;
    }
    if (!isValidMonthlyConversationTier(monthlyConversationsTier)) {
      setError("Selecione uma estimativa de conversas por mes.");
      return;
    }

    try {
      setSaving(true);
      const teamCountValue = Number.parseInt(teamAgentsCount, 10);
      const payload = await postAction({
        action: "save-team",
        teamAgentsCount: teamCountValue,
        onboardingGoal,
        monthlyConversationsTier,
      }, { respectDirty: false });
      setActiveStep(normalizeStepFromOnboarding(payload.onboarding));
      if (!payload.onboarding.whatsappConnected && !payload.qrCodeDataUrl) {
        void generateWhatsAppQr({ silent: true });
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar os dados do time.");
    } finally {
      setSaving(false);
    }
  }, [generateWhatsAppQr, monthlyConversationsTier, onboardingGoal, postAction, teamAgentsCount]);

  const handleRefreshWhatsApp = useCallback(async () => {
    setError(null);
    await generateWhatsAppQr();
  }, [generateWhatsAppQr]);

  const handleFinish = useCallback(async () => {
    setError(null);
    try {
      setSaving(true);
      await postAction({ action: "finish" }, { respectDirty: false });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel concluir onboarding.");
    } finally {
      setSaving(false);
    }
  }, [postAction]);

  const handleBackStep = useCallback(() => {
    setError(null);
    if (activeStep === "final") {
      navigateToStep("team");
      return;
    }
    if (activeStep === "whatsapp") {
      navigateToStep("team");
      return;
    }
    if (activeStep === "team") {
      navigateToStep("company");
    }
  }, [activeStep, navigateToStep]);

  const handleLogoUpload = useCallback(async (file: File) => {
    setError(null);
    clearCompanyLogoError();
    if (file.size <= 0) {
      showCompanyLogoError("Arquivo de logo vazio.");
      return;
    }
    if (file.size > MAX_COMPANY_LOGO_FILE_SIZE_BYTES) {
      showCompanyLogoError("A logo deve ter no maximo 1MB.");
      return;
    }
    if (!COMPANY_LOGO_ALLOWED_MIME_TYPES.has(String(file.type || "").toLowerCase())) {
      showCompanyLogoError("Formato invalido. Use PNG, JPG, WEBP ou SVG.");
      return;
    }
    const ext = pickFileExtension(file);
    if (!ext) {
      showCompanyLogoError("Arquivo de logo invalido.");
      return;
    }
    try {
      setUploadingLogo(true);
      const form = new FormData();
      form.append("file", file);
      const res = await fetchWithTimeout(resolvedLogoApiPath, {
        method: "POST",
        body: form,
        credentials: "include",
      }, CLIENT_REQUEST_TIMEOUT_MS);
      const payload = (await res.json().catch(() => ({}))) as OnboardingApiPayload;
      if (!res.ok || !payload?.ok || !payload.companyLogoUrl) {
        throw new Error(String(payload?.error || "Nao foi possivel enviar a logo."));
      }
      setCompanyLogoUrl(String(payload.companyLogoUrl));
      setOnboarding((current) => {
        const fallback = payload.onboarding || null;
        const next = current
          ? {
              ...current,
              companyLogoUrl: String(payload.companyLogoUrl),
              updatedAt: payload.onboarding?.updatedAt || current.updatedAt,
            }
          : fallback
            ? {
                ...fallback,
                companyLogoUrl: String(payload.companyLogoUrl),
              }
            : null;
        if (next) {
          onUpdated?.(next);
        }
        return next;
      });
    } catch (uploadError) {
      showCompanyLogoError(
        resolveRequestErrorMessage(
          uploadError,
          "Falha ao enviar logo.",
          "O upload da logo demorou demais. Tente novamente.",
        ),
      );
    } finally {
      setUploadingLogo(false);
    }
  }, [clearCompanyLogoError, onUpdated, resolvedLogoApiPath, showCompanyLogoError]);

  const openLogoPicker = useCallback(() => {
    clearCompanyLogoError();
    setError(null);
    fileInputRef.current?.click();
  }, [clearCompanyLogoError]);

  const onLogoChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      clearCompanyLogoError();
      await handleLogoUpload(file);
      event.target.value = "";
    },
    [clearCompanyLogoError, handleLogoUpload],
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
          aria-label={
            isAdditionalCompanyFlow
              ? "Onboarding para adicionar nova empresa"
              : "Onboarding inicial da empresa"
          }
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
          transition={prefersReducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 300, damping: 34, mass: 0.78 }}
          className="relative z-[1] h-[min(84vh,860px)] w-[min(96vw,980px)] max-h-[84vh] overflow-hidden rounded-[24px] bg-[#ececef] shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
        >
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr]">
            <aside className="relative overflow-hidden bg-[#151618] px-5 py-6 text-white sm:px-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(66,153,225,0.16),transparent_48%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.14),transparent_45%)]" />
              <div className="relative">
                <h2 className="text-[34px] font-semibold leading-[1.04]">
                  {isAdditionalCompanyFlow ? "Adicionar empresa" : "Vamos comecar"}
                </h2>
                <p className="mt-2 text-[13px] text-white/72">
                  {isAdditionalCompanyFlow
                    ? "Complete as etapas para vincular mais uma empresa e conectar outro WhatsApp."
                    : "Complete as etapas para ativar sua operacao no WhatsApp."}
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
                          if (done) navigateToStep(step.id);
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
                    {activeStep === "team" && "Estrutura da operacao"}
                    {activeStep === "whatsapp" && "Conectar WhatsApp Business"}
                    {activeStep === "final" &&
                      (isAdditionalCompanyFlow
                        ? "Empresa pronta para criar sistema"
                        : "Onboarding concluido")}
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
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeStep}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.996 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.996 }}
                      transition={prefersReducedMotion ? { duration: 0.1 } : { duration: 0.22, ease: "easeOut" }}
                    >
                    {activeStep === "company" && (
                      <div>
                        <p className="text-[14px] text-black/62">
                          {isAdditionalCompanyFlow
                            ? "Preencha os dados da nova empresa para iniciar um novo sistema de atendimento."
                            : "Preencha os dados da empresa para iniciarmos seu fluxo de atendimento."}
                        </p>

                        <div className="mt-4" ref={companyLogoFieldRef}>
                          <p className="text-[13px] font-medium text-black/62">
                            Logo da empresa <span className="text-[#d54f4f]">*</span>
                          </p>
                          <button
                            type="button"
                            onClick={openLogoPicker}
                            disabled={uploadingLogo}
                            className={cx(
                              "mt-2 flex w-full items-center gap-3 rounded-2xl border border-dashed bg-white/75 px-3 py-3 text-left transition-colors",
                              companyLogoError ? "border-[#d54f4f]/45" : "border-black/20",
                              uploadingLogo ? "cursor-not-allowed opacity-70" : "hover:bg-white",
                            )}
                            aria-invalid={companyLogoError ? "true" : "false"}
                            aria-describedby={companyLogoError ? "company-logo-error" : "company-logo-help"}
                          >
                            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white">
                              {uploadingLogo ? (
                                <Loader2 className="h-5 w-5 animate-spin text-black/60" />
                              ) : companyLogoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={companyLogoUrl}
                                  alt="Logo da empresa"
                                  className="h-12 w-12 rounded-lg border border-black/10 bg-white object-cover"
                                />
                              ) : (
                                <UploadCloud className="h-6 w-6 text-black/55" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold text-black/78">
                                {companyLogoUrl ? "Trocar logo" : "Enviar logo da empresa"}
                              </span>
                              <span className="mt-1 block text-[12px] text-black/52">
                                PNG, JPG, WEBP ou SVG - maximo 1MB
                              </span>
                            </span>
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                            onChange={onLogoChange}
                            className="hidden"
                          />
                          <div className="mt-2 min-h-[18px]">
                            {companyLogoError ? (
                              <p
                                id="company-logo-error"
                                role="alert"
                                aria-live="polite"
                                className="text-[12px] font-medium text-[#c8453d]"
                              >
                                {companyLogoError}
                              </p>
                            ) : (
                              <p id="company-logo-help" className="text-[12px] text-black/50">
                                Se o upload falhar, o motivo aparece aqui no proprio campo da logo.
                              </p>
                            )}
                          </div>
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
                              Atuacao <span className="text-[#d54f4f]">*</span>
                            </span>
                            <SelectMenu
                              value={industry}
                              options={industryOptions}
                              placeholder="Selecione a atuacao da empresa"
                              searchPlaceholder="Buscar atuacao..."
                              onChange={setIndustry}
                            />
                          </label>

                          <div className="block md:col-span-2">
                            <span className="text-[13px] font-medium text-black/62">
                              Modelo da empresa <span className="text-[#d54f4f]">*</span>
                            </span>
                            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOnlineBusiness(false);
                                }}
                                className={cx(
                                  "rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors",
                                  !isOnlineBusiness
                                    ? "border-black/25 bg-white text-black/84"
                                    : "border-black/12 bg-white/70 text-black/62 hover:bg-white",
                                )}
                              >
                                <p className="font-semibold">Possui endereco fisico</p>
                                <p className="mt-0.5 text-[12px] text-black/58">
                                  Loja, escritorio, clinica ou unidade presencial.
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOnlineBusiness(true);
                                  setCompanyAddress("");
                                  setCompanyAddressNumber("");
                                  setCompanyCity("");
                                  setCompanyState("");
                                  setCompanyPostalCode("");
                                }}
                                className={cx(
                                  "rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors",
                                  isOnlineBusiness
                                    ? "border-black/25 bg-white text-black/84"
                                    : "border-black/12 bg-white/70 text-black/62 hover:bg-white",
                                )}
                              >
                                <p className="font-semibold">100% online</p>
                                <p className="mt-0.5 text-[12px] text-black/58">
                                  Opera sem endereco fisico para atendimento.
                                </p>
                              </button>
                            </div>
                          </div>

                          {!isOnlineBusiness && (
                            <>
                              <label className="block">
                                <span className="text-[13px] font-medium text-black/62">
                                  CEP <span className="text-[#d54f4f]">*</span>
                                </span>
                                <input
                                  type="text"
                                  value={companyPostalCode}
                                  onChange={(event) => {
                                    const formatted = formatPostalCode(event.target.value);
                                    setCompanyPostalCode(formatted);
                                    if (normalizePostalCodeDigits(formatted).length < 8) {
                                      lastResolvedPostalCodeRef.current = "";
                                      setPostalLookupMessage(null);
                                    }
                                  }}
                                  placeholder="00000-000"
                                  inputMode="numeric"
                                  className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8"
                                />
                                <div className="mt-1 text-[11px] text-black/52">
                                  {postalLookupLoading
                                    ? "Consultando CEP para preencher endereco..."
                                    : postalLookupMessage || "Digite o CEP para completar os campos automaticamente."}
                                </div>
                              </label>

                              <label className="block">
                                <span className="text-[13px] font-medium text-black/62">
                                  Estado (UF) <span className="text-[#d54f4f]">*</span>
                                </span>
                                <input
                                  type="text"
                                  value={companyState}
                                  onChange={(event) =>
                                    setCompanyState(
                                      String(event.target.value || "")
                                        .replace(/[^a-zA-Z]/g, "")
                                        .slice(0, 2)
                                        .toUpperCase(),
                                    )
                                  }
                                  placeholder="SP"
                                  className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/82 uppercase outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8"
                                />
                              </label>

                              <label className="block md:col-span-2">
                                <span className="text-[13px] font-medium text-black/62">
                                  Endereco da empresa <span className="text-[#d54f4f]">*</span>
                                </span>
                                <input
                                  type="text"
                                  value={companyAddress}
                                  onChange={(event) => setCompanyAddress(event.target.value)}
                                  placeholder="Rua, avenida, numero e complemento"
                                  className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8"
                                />
                              </label>

                              <label className="block">
                                <span className="text-[13px] font-medium text-black/62">
                                  Cidade <span className="text-[#d54f4f]">*</span>
                                </span>
                                <input
                                  type="text"
                                  value={companyCity}
                                  onChange={(event) => setCompanyCity(event.target.value)}
                                  placeholder="Ex.: Sao Paulo"
                                  className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8"
                                />
                              </label>

                              <label className="block">
                                <span className="text-[13px] font-medium text-black/62">
                                  Numero <span className="text-[#d54f4f]">*</span>
                                </span>
                                <input
                                  type="text"
                                  value={companyAddressNumber}
                                  onChange={(event) => setCompanyAddressNumber(normalizeAddressNumber(event.target.value))}
                                  placeholder="Ex.: 120A"
                                  className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/82 outline-none transition-[border-color,box-shadow] focus:border-black/25 focus:ring-2 focus:ring-black/8"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {activeStep === "team" && (
                      <div>
                        <p className="text-[14px] text-black/62">
                          Isso ajuda a configurar volume inicial, automacoes e fila de atendimento sem te pedir dados demais.
                        </p>
                        <div className="mt-4 space-y-3 rounded-2xl border border-black/10 bg-white/80 p-4">
                          <label className="block">
                            <span className="text-[13px] font-medium text-black/62">
                              Quantidade de funcionarios <span className="text-[#d54f4f]">*</span>
                            </span>
                            <SelectMenu
                              value={teamAgentsCount}
                              options={TEAM_SIZE_OPTIONS}
                              placeholder="Selecione a faixa"
                              searchPlaceholder="Buscar faixa..."
                              onChange={setTeamAgentsCount}
                            />
                          </label>

                          <label className="block">
                            <span className="text-[13px] font-medium text-black/62">
                              Principal objetivo no WhatsApp <span className="text-[#d54f4f]">*</span>
                            </span>
                            <SelectMenu
                              value={onboardingGoal}
                              options={ONBOARDING_GOAL_OPTIONS}
                              placeholder="Selecione o objetivo principal"
                              searchPlaceholder="Buscar objetivo..."
                              onChange={setOnboardingGoal}
                            />
                          </label>

                          <label className="block">
                            <span className="text-[13px] font-medium text-black/62">
                              Volume esperado de conversas/mes <span className="text-[#d54f4f]">*</span>
                            </span>
                            <SelectMenu
                              value={monthlyConversationsTier}
                              options={MONTHLY_CONVERSATION_TIER_OPTIONS}
                              placeholder="Selecione uma estimativa"
                              searchPlaceholder="Buscar volume..."
                              onChange={setMonthlyConversationsTier}
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {activeStep === "whatsapp" && (
                      <div>
                        <p className="text-[14px] text-black/62">
                          O QR Code e gerado automaticamente em tempo real. Escaneie no WhatsApp Business e aguarde a confirmacao.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <span
                            className={cx(
                              "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              onboarding?.whatsappConnected
                                ? "bg-emerald-500/15 text-emerald-700"
                                : "bg-amber-500/15 text-amber-700",
                            )}
                          >
                            {onboarding?.whatsappConnected ? "Conectado" : "Aguardando leitura do QR"}
                          </span>
                          <span className="text-[11px] text-black/55">
                            Estado provider: {whatsappState || "sincronizando"}
                          </span>
                        </div>
                        <div className="mt-4 rounded-2xl border border-black/12 bg-white/82 p-4">
                          {qrCodeDataUrl ? (
                            <div className="flex flex-col items-center">
                              <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-[0_10px_26px_rgba(0,0,0,0.09)]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={qrCodeDataUrl}
                                  alt="QR Code de conexao WhatsApp"
                                  className="h-[280px] w-[280px] rounded-xl border border-black/8 object-contain sm:h-[320px] sm:w-[320px]"
                                />
                              </div>
                              <div className="mt-3 rounded-full bg-black/[0.04] px-3 py-1 text-[12px] font-medium text-black/62">
                                {pairingExpiresAt
                                  ? `Expira em: ${new Date(pairingExpiresAt).toLocaleString("pt-BR")}`
                                  : "Atualizando validade do QR em tempo real..."}
                              </div>
                              {!providerConfigured && (
                                <div className="mt-2 text-[11px] text-[#b2433e]">
                                  Provider proprio desativado no servidor. Defina WHATSAPP_SELF_HOSTED_ENABLED=true.
                                </div>
                              )}
                              {pairingUrl && <div className="mt-2 break-all text-[11px] text-black/48">Ref tecnica: {pairingUrl}</div>}
                            </div>
                          ) : (
                            <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-black/16 bg-white/80">
                              <div className="text-center">
                                <Loader2
                                  className={cx(
                                    "mx-auto h-7 w-7 text-black/46",
                                    whatsappState === "error" ? "" : "animate-spin",
                                  )}
                                />
                                <p className="mt-3 text-[14px] font-medium text-black/72">
                                  {whatsappState === "error"
                                    ? "Falha no provider ao gerar QR. Atualize o status para tentar novamente."
                                    : whatsappState === "logged_out"
                                      ? "Sessao desconectada. Aguarde a regeneracao automatica do QR."
                                      : "Gerando QR Code valido no provider..."}
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
                          <p className="text-[16px] font-semibold text-emerald-800">
                            {isAdditionalCompanyFlow
                              ? "Nova empresa adicionada com sucesso"
                              : "Onboarding concluido com sucesso"}
                          </p>
                          <p className="mt-1 text-[13px] text-emerald-900/80">
                            {isAdditionalCompanyFlow
                              ? "Empresa vinculada e WhatsApp conectado. Agora voce pode criar o sistema dela."
                              : "Sua empresa esta pronta para iniciar os atendimentos no painel."}
                          </p>
                        </div>
                        <div className="mt-4 space-y-2 rounded-2xl border border-black/10 bg-white/86 p-4 text-[13px] text-black/70">
                          <p><span className="font-semibold text-black/82">Empresa:</span> {onboarding?.companyName || "nao informada"}</p>
                          <p><span className="font-semibold text-black/82">Atuacao:</span> {onboarding?.industry || "nao informada"}</p>
                          <p>
                            <span className="font-semibold text-black/82">Modelo:</span>{" "}
                            {onboarding?.isOnlineBusiness ? "100% online" : "Com endereco fisico"}
                          </p>
                          {!onboarding?.isOnlineBusiness && (
                            <p>
                              <span className="font-semibold text-black/82">Endereco:</span>{" "}
                              {onboarding?.companyAddress
                                ? `${onboarding.companyAddress}, ${onboarding.companyCity || "-"} - ${onboarding.companyState || "-"}, ${formatPostalCode(onboarding.companyPostalCode || "") || "-"}`
                                : "nao informado"}
                            </p>
                          )}
                          <p><span className="font-semibold text-black/82">Funcionarios:</span> {resolveTeamLabelFromCount(onboarding?.teamAgentsCount)}</p>
                          <p><span className="font-semibold text-black/82">Objetivo:</span> {resolveOnboardingGoalLabel(onboarding?.onboardingGoal)}</p>
                          <p>
                            <span className="font-semibold text-black/82">Volume mensal:</span>{" "}
                            {resolveMonthlyConversationsLabel(onboarding?.monthlyConversationsTier)}
                          </p>
                          <p><span className="font-semibold text-black/82">WhatsApp:</span> {onboarding?.whatsappConnected ? "Conectado" : "Pendente"}</p>
                        </div>
                      </div>
                    )}
                    </motion.div>
                  </AnimatePresence>
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
                    <button
                      type="button"
                      onClick={() => void handleRefreshWhatsApp()}
                      disabled={saving || loading}
                      className={cx(
                        "inline-flex h-10 items-center rounded-xl border border-black/12 bg-white px-3 text-[13px] font-semibold text-black/75 transition-colors",
                        saving || loading ? "cursor-not-allowed opacity-65" : "hover:bg-black/[0.03]",
                      )}
                    >
                      {saving || loading ? "Sincronizando..." : "Atualizar status agora"}
                    </button>
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
                      {saving
                        ? "Finalizando..."
                        : isAdditionalCompanyFlow
                          ? "Ir para criar sistema"
                          : "Entrar no dashboard"}
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



