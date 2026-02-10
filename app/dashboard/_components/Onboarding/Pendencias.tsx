"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronLeft, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type SelectOption = { value: string; label: string; keywords?: string[] };

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

const SEGMENT_OPTIONS: SelectOption[] = [
  { value: "E-commerce", label: "E-commerce", keywords: ["loja online", "comercio digital", "internet", "marketplace", "shop", "merce"] },
  { value: "Varejo", label: "Varejo", keywords: ["loja", "pdv", "balcao", "comercio"] },
  { value: "Atacado", label: "Atacado", keywords: ["distribuidor", "revenda", "grande volume"] },
  { value: "Clinica e Saude", label: "Clinica e Saude", keywords: ["consultorio", "medicina", "atendimento"] },
  { value: "Odontologia", label: "Odontologia", keywords: ["dentista", "clinica odontologica"] },
  { value: "Educacao", label: "Educacao", keywords: ["escola", "curso", "aluno"] },
  { value: "Restaurante e Delivery", label: "Restaurante e Delivery", keywords: ["comida", "lanche", "ifood", "entrega"] },
  { value: "Turismo e Hotelaria", label: "Turismo e Hotelaria", keywords: ["viagem", "reserva", "hospedagem"] },
  { value: "Imobiliaria", label: "Imobiliaria", keywords: ["imovel", "corretor", "aluguel"] },
  { value: "Construcao Civil", label: "Construcao Civil", keywords: ["obra", "engenharia", "materiais"] },
  { value: "Servicos Financeiros", label: "Servicos Financeiros", keywords: ["credito", "financiamento", "banco"] },
  { value: "Seguros", label: "Seguros", keywords: ["apolice", "corretora"] },
  { value: "Escritorio de Advocacia", label: "Escritorio de Advocacia", keywords: ["juridico", "advogado"] },
  { value: "Marketing e Agencia", label: "Marketing e Agencia", keywords: ["trafego", "midia", "publicidade"] },
  { value: "Tecnologia e SaaS", label: "Tecnologia e SaaS", keywords: ["software", "plataforma", "assinatura"] },
  { value: "Assistencia Tecnica", label: "Assistencia Tecnica", keywords: ["manutencao", "conserto", "suporte"] },
  { value: "Industria", label: "Industria", keywords: ["fabrica", "producao"] },
  { value: "Distribuicao", label: "Distribuicao", keywords: ["centro de distribuicao", "entregas"] },
  { value: "Logistica", label: "Logistica", keywords: ["frete", "transporte", "rota"] },
  { value: "Recursos Humanos", label: "Recursos Humanos", keywords: ["rh", "recrutamento"] },
  { value: "Beleza e Estetica", label: "Beleza e Estetica", keywords: ["salao", "estetica"] },
  { value: "Academia e Esportes", label: "Academia e Esportes", keywords: ["treino", "personal"] },
  { value: "Eventos", label: "Eventos", keywords: ["ingresso", "cerimonial"] },
  { value: "ONG e Instituicao", label: "ONG e Instituicao", keywords: ["terceiro setor", "social"] },
  { value: "Supermercado e Mercearia", label: "Supermercado e Mercearia", keywords: ["mercado", "merce", "mercearia"] },
  { value: "Farmacia e Drogaria", label: "Farmacia e Drogaria", keywords: ["medicamento", "farmacia"] },
  { value: "Pet Shop e Veterinaria", label: "Pet Shop e Veterinaria", keywords: ["pet", "animal", "veterinario"] },
  { value: "Moda e Vestuario", label: "Moda e Vestuario", keywords: ["roupa", "vestuario"] },
  { value: "Calcados e Acessorios", label: "Calcados e Acessorios", keywords: ["sapato", "tenis", "acessorio"] },
  { value: "Moveis e Decoracao", label: "Moveis e Decoracao", keywords: ["mobilia", "decoracao"] },
  { value: "Casa e Utilidades", label: "Casa e Utilidades", keywords: ["utilidades domesticas"] },
  { value: "Papelaria e Livraria", label: "Papelaria e Livraria", keywords: ["livro", "material escolar"] },
  { value: "Auto Pecas", label: "Auto Pecas", keywords: ["peca", "automotivo"] },
  { value: "Oficina Mecanica", label: "Oficina Mecanica", keywords: ["mecanico", "revisao"] },
  { value: "Concessionaria", label: "Concessionaria", keywords: ["veiculo", "carro", "moto"] },
  { value: "Transporte e Mobilidade", label: "Transporte e Mobilidade", keywords: ["mobilidade", "corrida"] },
  { value: "Agronegocio", label: "Agronegocio", keywords: ["agro", "fazenda", "campo"] },
  { value: "Cooperativa", label: "Cooperativa" },
  { value: "Energia e Utilidades", label: "Energia e Utilidades" },
  { value: "Telecomunicacoes", label: "Telecomunicacoes", keywords: ["internet", "telefonia"] },
  { value: "Contabilidade", label: "Contabilidade", keywords: ["contador", "fiscal"] },
  { value: "Consultoria Empresarial", label: "Consultoria Empresarial" },
  { value: "Franquia", label: "Franquia" },
  { value: "Comercio Exterior", label: "Comercio Exterior" },
  { value: "Importacao e Exportacao", label: "Importacao e Exportacao" },
  { value: "Marketplace", label: "Marketplace", keywords: ["seller", "loja digital"] },
  { value: "Infoprodutos", label: "Infoprodutos" },
  { value: "Cursos Online", label: "Cursos Online" },
  { value: "Escola de Idiomas", label: "Escola de Idiomas" },
  { value: "Universidade", label: "Universidade" },
  { value: "Clinica de Estetica", label: "Clinica de Estetica" },
  { value: "Laboratorio", label: "Laboratorio" },
  { value: "Hospital", label: "Hospital" },
  { value: "Casa de Repouso", label: "Casa de Repouso" },
  { value: "Construtora", label: "Construtora" },
  { value: "Arquitetura e Engenharia", label: "Arquitetura e Engenharia" },
  { value: "Seguranca Eletronica", label: "Seguranca Eletronica" },
  { value: "Facilities e Limpeza", label: "Facilities e Limpeza" },
  { value: "BPO e Terceirizacao", label: "BPO e Terceirizacao" },
  { value: "Coworking", label: "Coworking" },
  { value: "Hotel", label: "Hotel" },
  { value: "Pousada", label: "Pousada" },
  { value: "Agencia de Viagens", label: "Agencia de Viagens" },
  { value: "Locacao de Veiculos", label: "Locacao de Veiculos" },
  { value: "Locacao de Equipamentos", label: "Locacao de Equipamentos" },
  { value: "Buffet e Alimentacao", label: "Buffet e Alimentacao" },
  { value: "Panificadora", label: "Panificadora", keywords: ["padaria"] },
  { value: "Confeitaria", label: "Confeitaria", keywords: ["doces", "bolo"] },
  { value: "Bebidas e Distribuidor", label: "Bebidas e Distribuidor" },
  { value: "Produtora de Conteudo", label: "Produtora de Conteudo" },
  { value: "Midia e Comunicacao", label: "Midia e Comunicacao" },
  { value: "Design e Criacao", label: "Design e Criacao" },
  { value: "Fotografia e Video", label: "Fotografia e Video" },
  { value: "Software House", label: "Software House" },
  { value: "Suporte de TI", label: "Suporte de TI" },
  { value: "Infraestrutura de TI", label: "Infraestrutura de TI" },
  { value: "Cyberseguranca", label: "Cyberseguranca" },
  { value: "Data e Analytics", label: "Data e Analytics", keywords: ["dados", "bi"] },
  { value: "Gaming e Entretenimento", label: "Gaming e Entretenimento" },
  { value: "Cassino e Apostas", label: "Cassino e Apostas" },
  { value: "Religioso", label: "Religioso" },
  { value: "Setor Publico", label: "Setor Publico" },
  { value: "Associacao de Classe", label: "Associacao de Classe" },
  { value: "Outro", label: "Outro" },
] as const;

const COMPANY_SIZE_OPTIONS = [
  { value: "1-5", label: "1 a 5 pessoas" },
  { value: "6-20", label: "6 a 20 pessoas" },
  { value: "21-100", label: "21 a 100 pessoas" },
  { value: "100+", label: "100+ pessoas" },
] as const;

const PRIORITY_OPTIONS = [
  "Responder mais rapido",
  "Converter mais",
  "Organizar equipe",
  "Automatizar respostas",
  "Nao perder leads",
] as const;

const INPUT =
  "w-full bg-white border border-black/15 border-2 rounded-full px-6 py-4 text-black placeholder-black/45 focus:outline-none hover:border-black/25 focus:border-lime-400 transition-all duration-300 ease-out text-base";
const TEXTAREA_CLASS =
  "w-full min-h-[120px] resize-y bg-white border border-black/15 border-2 rounded-3xl px-6 py-4 text-black placeholder-black/45 focus:outline-none hover:border-black/25 focus:border-lime-400 transition-all duration-300 ease-out text-base";
const EASE = [0.2, 0.8, 0.2, 1] as const;
const TYPEAHEAD_DEBOUNCE_MS = 180;
const TYPEAHEAD_RESET_MS = 1000;

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

function normalizeForSearch(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSubsequence(query: string, target: string) {
  let queryIndex = 0;
  let targetIndex = 0;

  while (queryIndex < query.length && targetIndex < target.length) {
    if (query[queryIndex] === target[targetIndex]) {
      queryIndex += 1;
    }
    targetIndex += 1;
  }

  return queryIndex === query.length;
}

function getOptionScore(option: SelectOption, normalizedQuery: string) {
  if (!normalizedQuery) return 0;

  const searchPool = [option.label, ...(option.keywords || [])]
    .map(normalizeForSearch)
    .filter(Boolean);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  let bestScore = 0;

  for (const candidate of searchPool) {
    const compactCandidate = candidate.replace(/\s+/g, "");
    const candidateTokens = candidate.split(/\s+/).filter(Boolean);
    const firstToken = candidateTokens[0] || "";

    if (candidate === normalizedQuery) bestScore = Math.max(bestScore, 200);
    if (candidate.startsWith(normalizedQuery)) bestScore = Math.max(bestScore, 180);
    if (candidate.includes(normalizedQuery)) bestScore = Math.max(bestScore, 155);
    if (firstToken.startsWith(normalizedQuery)) bestScore = Math.max(bestScore, 145);
    if (compactCandidate.includes(compactQuery)) bestScore = Math.max(bestScore, 135);

    if (compactQuery.length >= 3 && isSubsequence(compactQuery, compactCandidate)) {
      bestScore = Math.max(bestScore, 120);
    }

    const tokenMatches = queryTokens.reduce((count, token) => {
      const hasTokenMatch = candidateTokens.some(
        (candidateToken) =>
          candidateToken.startsWith(token) || candidateToken.includes(token),
      );
      return count + (hasTokenMatch ? 1 : 0);
    }, 0);

    if (tokenMatches > 0) {
      bestScore = Math.max(bestScore, 100 + tokenMatches * 15);
    }
  }

  return bestScore;
}

function SelectMenu({
  value,
  onChange,
  placeholder,
  options,
  enableTypeahead = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: SelectOption[];
  enableTypeahead?: boolean;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lastTypeAtRef = useRef(0);
  const [openDirection, setOpenDirection] = useState<"down" | "up">("down");
  const [typedBuffer, setTypedBuffer] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const selected = options.find((option) => option.value === value) || null;
  const normalizedSearchTerm = normalizeForSearch(searchTerm);
  const filteredOptions = useMemo(() => {
    if (!enableTypeahead || !normalizedSearchTerm) return options;
    return options
      .map((option, index) => ({
        option,
        index,
        score: getOptionScore(option, normalizedSearchTerm),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      })
      .map((item) => item.option);
  }, [enableTypeahead, normalizedSearchTerm, options]);

  const resetTypeahead = useCallback(() => {
    if (!enableTypeahead) return;
    setTypedBuffer("");
    setSearchTerm("");
    lastTypeAtRef.current = 0;
  }, [enableTypeahead]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    resetTypeahead();
  }, [resetTypeahead]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = wrapRef.current;
      const target = event.target as Node | null;
      if (!root || !target) return;
      if (!root.contains(target)) closeMenu();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  useEffect(() => {
    if (!open || !enableTypeahead) return;

    const timeout = window.setTimeout(() => {
      setSearchTerm(typedBuffer);
    }, TYPEAHEAD_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [typedBuffer, open, enableTypeahead]);

  useEffect(() => {
    if (!open) return;

    const measureDirection = () => {
      const wrap = wrapRef.current;
      const menu = menuRef.current;
      if (!wrap || !menu) return;

      const rect = wrap.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 0;
      const spaceBelow = viewportHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const menuHeight = Math.min(menu.scrollHeight, 230) + 12;

      const shouldOpenDown =
        spaceBelow >= menuHeight || spaceBelow >= spaceAbove;

      setOpenDirection(shouldOpenDown ? "down" : "up");
    };

    measureDirection();
    const raf = window.requestAnimationFrame(measureDirection);
    window.addEventListener("resize", measureDirection);
    window.addEventListener("scroll", measureDirection, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measureDirection);
      window.removeEventListener("scroll", measureDirection, true);
    };
  }, [open, filteredOptions.length]);

  const handleTypeaheadKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!enableTypeahead || !open) return;
    if (event.nativeEvent.isComposing) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const now = Date.now();
    const timedOut = now - lastTypeAtRef.current > TYPEAHEAD_RESET_MS;
    lastTypeAtRef.current = now;

    if (event.key === "Backspace") {
      event.preventDefault();
      setTypedBuffer((previous) => (timedOut ? "" : previous.slice(0, -1)));
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      setTypedBuffer((previous) => (timedOut ? event.key : `${previous}${event.key}`));
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <motion.button
        type="button"
        onClick={() => {
          if (open) {
            closeMenu();
            return;
          }
          setOpen(true);
        }}
        onKeyDown={handleTypeaheadKeyDown}
        whileTap={reduced ? undefined : { scale: 0.996 }}
        transition={reduced ? { duration: 0.1 } : { duration: 0.2, ease: EASE }}
        className={cx(
          INPUT,
          "flex items-center justify-between text-left pr-5",
          open && "border-black/25",
        )}
      >
        <span className={cx("truncate", selected ? "text-black" : "text-black/45")}>
          {selected ? selected.label : placeholder}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0, x: open ? -1 : 0 }}
          transition={
            reduced
              ? { duration: 0.1 }
              : { type: "spring", stiffness: 430, damping: 28, mass: 0.5 }
          }
          className="ml-3 mr-1.5 inline-flex shrink-0 items-center justify-center text-black/55"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            initial={
              reduced
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: openDirection === "down" ? -8 : 8,
                    scale: 0.985,
                  }
            }
            animate={
              reduced
                ? { opacity: 1 }
                : {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }
            }
            exit={
              reduced
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: openDirection === "down" ? -4 : 4,
                    scale: 0.985,
                  }
            }
            transition={reduced ? { duration: 0.1 } : { duration: 0.22, ease: EASE }}
            className={cx(
              "absolute left-0 right-0 z-[90] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_36px_rgba(0,0,0,0.14)]",
              openDirection === "down"
                ? "top-[calc(100%+8px)] origin-top"
                : "bottom-[calc(100%+8px)] origin-bottom",
            )}
          >
            <ul className="max-h-[230px] overflow-y-auto p-1.5">
              {filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        closeMenu();
                      }}
                      className={cx(
                        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                        isSelected
                          ? "bg-black/[0.07] text-black/90"
                          : "text-black/75 hover:bg-black/[0.04]",
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-black/45">
                          selecionado
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {filteredOptions.length === 0 && (
                <li className="px-3 py-2.5 text-[12px] font-medium text-black/50">
                  {`Nenhum resultado para "${searchTerm}"`}
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
                <Action label={saving ? "Salvando..." : "Iniciar configuracao"} className="w-auto ml-auto" disabled={saving} onClick={async () => {
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
                    <SelectMenu
                      value={data.segment || ""}
                      onChange={(value) => commit({ segment: value })}
                      placeholder="Segmento de atuacao"
                      enableTypeahead
                      options={SEGMENT_OPTIONS.map((segment) => ({
                        value: segment.value,
                        label: segment.label,
                        keywords: segment.keywords,
                      }))}
                    />
                    <SelectMenu
                      value={data.companySize || ""}
                      onChange={(value) =>
                        commit({ companySize: value as OnboardingData["companySize"] })
                      }
                      placeholder="Tamanho da empresa"
                      options={COMPANY_SIZE_OPTIONS.map((size) => ({
                        value: size.value,
                        label: size.label,
                      }))}
                    />
                    <input
                      className={INPUT}
                      placeholder="https://wyzer.com.br"
                      value={data.websiteOrInstagram || ""}
                      onChange={(e) => commit({ websiteOrInstagram: e.target.value })}
                    />
                    <Err text={errors.companyName || errors.segment || errors.companySize} />
                  </>
                )}
                {step === "goal" && (
                  <>
                    <input className={INPUT} placeholder="Uso principal: vendas | suporte | agendamento | cobranca | hibrido" value={data.mainUse || ""} onChange={(e) => commit({ mainUse: e.target.value })} />
                    <SelectMenu
                      value={data.priorityNow || ""}
                      onChange={(value) => commit({ priorityNow: value })}
                      placeholder="Prioridade atual"
                      options={PRIORITY_OPTIONS.map((priority) => ({
                        value: priority,
                        label: priority,
                      }))}
                    />
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
                  <div className="ml-auto">
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
