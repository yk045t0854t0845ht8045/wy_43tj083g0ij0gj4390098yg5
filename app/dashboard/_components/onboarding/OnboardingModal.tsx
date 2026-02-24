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
  whatsappState?: string;
  whatsappProvider?: string;
  providerConfigured?: boolean;
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
  const clean = String(value || "").trim();
  if (!clean) return false;
  return TEAM_SIZE_OPTIONS.some((option) => option.value === clean);
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
                    onClick={() => {
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
  const [teamAgentsCount, setTeamAgentsCount] = useState(normalizeTeamBucketFromCount(initialData?.teamAgentsCount));
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [pairingCode, setPairingCode] = useState<string>("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string>("");
  const [whatsappState, setWhatsappState] = useState<string>("");
  const [providerConfigured, setProviderConfigured] = useState(true);
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
      { id: "whatsapp" as WizardStep, title: "Conectar WhatsApp", subtitle: "Conexao automatica em tempo real", icon: MessageCircle },
      { id: "final" as WizardStep, title: "Tudo pronto", subtitle: "Revisar e concluir", icon: CheckCircle2 },
    ];
  }, []);

  const industryOptions = useMemo(() => {
    const current = String(industry || "").trim();
    if (!current) return INDUSTRY_OPTIONS;
    const exists = INDUSTRY_OPTIONS.some((option) => option.value.toLowerCase() === current.toLowerCase());
    if (exists) return INDUSTRY_OPTIONS;
    return [{ value: current, label: `${current} (atual)` }, ...INDUSTRY_OPTIONS];
  }, [industry]);

  const applyOnboardingUpdate = useCallback(
    (next: OnboardingState) => {
      setOnboarding(next);
      setCompanyName(String(next.companyName || ""));
      setCompanyLogoUrl(String(next.companyLogoUrl || ""));
      setCompanyCnpj(formatCnpj(next.companyCnpj || ""));
      setIndustry(String(next.industry || ""));
      setTeamAgentsCount(normalizeTeamBucketFromCount(next.teamAgentsCount));
      setActiveStep(normalizeStepFromOnboarding(next));
      setPairingCode(String(next.whatsappPairingCode || ""));
      setPairingExpiresAt(next.whatsappPairingExpiresAt || null);
      setWhatsappState(next.whatsappConnected ? "open" : "close");
      onUpdated?.(next);
    },
    [onUpdated],
  );

  const fetchOnboarding = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (!silent) {
        setLoading(true);
        setError(null);
      }
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
        setWhatsappState(String(payload.whatsappState || (payload.onboarding.whatsappConnected ? "open" : "close")));
        setProviderConfigured(payload.providerConfigured !== false);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar onboarding.");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [applyOnboardingUpdate],
  );

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
    if (activeStep !== "whatsapp") return;
    if (onboarding?.completed) return;

    let stopped = false;
    const syncRealtime = async () => {
      if (stopped) return;
      await fetchOnboarding({ silent: true });
    };

    void syncRealtime();
    const timer = window.setInterval(() => {
      void syncRealtime();
    }, 4500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeStep, fetchOnboarding, onboarding?.completed, open]);

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
      if (payload.whatsappState) setWhatsappState(String(payload.whatsappState));
      if (typeof payload.providerConfigured === "boolean") {
        setProviderConfigured(payload.providerConfigured);
      }
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
      const payload = await postAction({
        action: "save-company",
        companyName,
        industry,
        companyLogoUrl,
        companyCnpj: normalizeCnpjDigits(companyCnpj),
      });
      setActiveStep(normalizeStepFromOnboarding(payload.onboarding));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar dados da empresa.");
    } finally {
      setSaving(false);
    }
  }, [companyCnpj, companyLogoUrl, companyName, industry, postAction]);

  const handleTeamContinue = useCallback(async () => {
    setError(null);
    if (!isValidTeamCount(teamAgentsCount)) {
      setError("Selecione uma faixa valida de quantidade de funcionarios.");
      return;
    }

    try {
      setSaving(true);
      const teamCountValue = Number.parseInt(teamAgentsCount, 10);
      const payload = await postAction({
        action: "save-team",
        teamAgentsCount: teamCountValue,
      });
      setActiveStep(normalizeStepFromOnboarding(payload.onboarding));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar os dados do time.");
    } finally {
      setSaving(false);
    }
  }, [postAction, teamAgentsCount]);

  const handleRefreshWhatsApp = useCallback(async () => {
    setError(null);
    await fetchOnboarding({ silent: false });
  }, [fetchOnboarding]);

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
          className="relative z-[1] h-[min(88vh,920px)] w-[min(96vw,980px)] max-h-[88vh] overflow-hidden rounded-[24px] bg-[#ececef] shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
        >
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr]">
            <aside className="relative overflow-hidden bg-[#151618] px-5 py-6 text-white sm:px-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(66,153,225,0.16),transparent_48%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.14),transparent_45%)]" />
              <div className="relative">
                <h2 className="text-[34px] font-semibold leading-[1.04]">Vamos comecar</h2>
                <p className="mt-2 text-[13px] text-white/72">
                  Complete as etapas para ativar sua operacao no WhatsApp.
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
                    {activeStep === "team" && "Estrutura da operacao"}
                    {activeStep === "whatsapp" && "Conectar WhatsApp Business"}
                    {activeStep === "final" && "Onboarding concluido"}
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
                            <span className="mt-1 text-[12px] text-black/52">PNG, JPG, WEBP ou SVG - maximo 1MB</span>
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
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
                              <div className="rounded-2xl border border-black/10 bg-white p-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={qrCodeDataUrl} alt="QR Code de conexao WhatsApp" className="aspect-square w-full max-w-[220px] rounded-xl border border-black/8 object-contain" />
                              </div>
                              <div>
                                <p className="text-[13px] text-black/58">
                                  Escaneie com o aplicativo do WhatsApp Business no seu celular. A confirmacao e automatica.
                                </p>
                                <div className="mt-3 rounded-xl border border-black/10 bg-[#f6f6f7] px-3 py-2">
                                  <p className="text-[12px] text-black/55">Codigo de pareamento</p>
                                  <p className="mt-1 text-[18px] font-semibold tracking-[0.08em] text-black/82">
                                    {pairingCode || "------"}
                                  </p>
                                </div>
                                <div className="mt-2 text-[12px] text-black/55">
                                  {pairingExpiresAt ? `Expira em: ${new Date(pairingExpiresAt).toLocaleString("pt-BR")}` : "Aguardando novo QR em tempo real."}
                                </div>
                                {!providerConfigured && (
                                  <div className="mt-2 text-[11px] text-[#b2433e]">
                                    Provider proprio desativado no servidor. Defina WHATSAPP_SELF_HOSTED_ENABLED=true.
                                  </div>
                                )}
                                {pairingUrl && <div className="mt-2 break-all text-[11px] text-black/48">Ref tecnica: {pairingUrl}</div>}
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-black/16 bg-white/80">
                              <div className="text-center">
                                <Loader2 className="mx-auto h-7 w-7 animate-spin text-black/46" />
                                <p className="mt-3 text-[14px] font-medium text-black/72">
                                  Gerando QR Code valido no provider...
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
                          <p className="text-[16px] font-semibold text-emerald-800">Onboarding concluido com sucesso</p>
                          <p className="mt-1 text-[13px] text-emerald-900/80">
                            Sua empresa esta pronta para iniciar os atendimentos no painel.
                          </p>
                        </div>
                        <div className="mt-4 space-y-2 rounded-2xl border border-black/10 bg-white/86 p-4 text-[13px] text-black/70">
                          <p><span className="font-semibold text-black/82">Empresa:</span> {onboarding?.companyName || "nao informada"}</p>
                          <p><span className="font-semibold text-black/82">Atuacao:</span> {onboarding?.industry || "nao informada"}</p>
                          <p><span className="font-semibold text-black/82">Funcionarios:</span> {resolveTeamLabelFromCount(onboarding?.teamAgentsCount)}</p>
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


