"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Home,
  CheckCircle2,
  BookOpen,
  Sparkles,
  UserRound,
  Shield,
  Ban,
  MessageCircle,
  CreditCard,
  RotateCcw,
  Database,
  Lock,
  Plug,
  LifeBuoy,
  Copyright,
  BadgeCheck,
  Scale,
  Gavel,
  FileEdit,
  Landmark,
  Mail,
  Search,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

type Section = {
  id: string;
  title: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function TermsPage() {
  const prefersReducedMotion = useReducedMotion();

  const EASE = useMemo(() => [0.2, 0.8, 0.2, 1] as const, []);
  const DUR = useMemo(
    () => ({
      sm: 0.18,
      md: 0.28,
      lg: 0.55,
      xl: 0.9,
    }),
    []
  );

  // ✅ Aparece mais "blocos" por vez (não frase por frase)
  const VIEWPORT = useMemo(
    () => ({ once: true, amount: 0.12, margin: "0px 0px -12% 0px" as any }),
    []
  );

  const quote = useMemo(
    () =>
      `O negócio que depende da sua presença constante para funcionar não é uma empresa, é uma prisão de luxo. A verdadeira maestria não está em fazer tudo, mas em construir o que faz por você.`,
    []
  );

  const sections: Section[] = useMemo(
    () => [
      { id: "top", title: "Visão geral" },
      { id: "aceite", title: "1. Aceite e elegibilidade" },
      { id: "definicoes", title: "2. Definições" },
      { id: "servico", title: "3. O serviço Wyzer" },
      { id: "conta", title: "4. Conta, acesso e segurança" },
      { id: "uso", title: "5. Uso aceitável e condutas proibidas" },
      { id: "whatsapp", title: "6. WhatsApp e políticas de terceiros" },
      { id: "planos", title: "7. Planos, teste, faturamento e impostos" },
      { id: "cancelamento", title: "8. Cancelamento, reembolso e estornos" },
      { id: "conteudo", title: "9. Conteúdo, dados e responsabilidades" },
      { id: "privacidade", title: "10. Privacidade e LGPD" },
      { id: "integracoes", title: "11. Integrações e serviços de terceiros" },
      { id: "disponibilidade", title: "12. Disponibilidade, suporte e manutenção" },
      { id: "propriedade", title: "13. Propriedade intelectual" },
      { id: "garantias", title: "14. Isenções e garantias" },
      { id: "limitacao", title: "15. Limitação de responsabilidade" },
      { id: "indenizacao", title: "16. Indenização" },
      { id: "suspensao", title: "17. Suspensão e rescisão" },
      { id: "alteracoes", title: "18. Alterações destes termos" },
      { id: "lei", title: "19. Lei aplicável e foro" },
      { id: "contato", title: "20. Contato" },
    ],
    []
  );

  // ✅ Ícones + “bolinhas coloridas” igual o exemplo (sem seta)
  const iconMap = useMemo(() => {
    const common = { size: 18, strokeWidth: 2.2 as const };
    return {
      top: { Icon: Home, bubble: "bg-blue-200 text-blue-700" },
      aceite: { Icon: CheckCircle2, bubble: "bg-emerald-200 text-emerald-700" },
      definicoes: { Icon: BookOpen, bubble: "bg-sky-200 text-sky-700" },
      servico: { Icon: Sparkles, bubble: "bg-lime-200 text-lime-800" },
      conta: { Icon: UserRound, bubble: "bg-green-200 text-green-800" },
      uso: { Icon: Ban, bubble: "bg-red-200 text-red-700" },
      whatsapp: { Icon: MessageCircle, bubble: "bg-emerald-200 text-emerald-700" },
      planos: { Icon: CreditCard, bubble: "bg-indigo-200 text-indigo-700" },
      cancelamento: { Icon: RotateCcw, bubble: "bg-amber-200 text-amber-800" },
      conteudo: { Icon: Database, bubble: "bg-cyan-200 text-cyan-800" },
      privacidade: { Icon: Lock, bubble: "bg-purple-200 text-purple-800" },
      integracoes: { Icon: Plug, bubble: "bg-sky-200 text-sky-800" },
      disponibilidade: { Icon: LifeBuoy, bubble: "bg-blue-200 text-blue-800" },
      propriedade: { Icon: Copyright, bubble: "bg-slate-200 text-slate-800" },
      garantias: { Icon: BadgeCheck, bubble: "bg-zinc-200 text-zinc-800" },
      limitacao: { Icon: Scale, bubble: "bg-stone-200 text-stone-800" },
      indenizacao: { Icon: Shield, bubble: "bg-teal-200 text-teal-800" },
      suspensao: { Icon: Gavel, bubble: "bg-rose-200 text-rose-800" },
      alteracoes: { Icon: FileEdit, bubble: "bg-orange-200 text-orange-800" },
      lei: { Icon: Landmark, bubble: "bg-neutral-200 text-neutral-800" },
      contato: { Icon: Mail, bubble: "bg-violet-200 text-violet-800" },
      __common: common,
    } as const;
  }, []);

  const [activeId, setActiveId] = useState<string>("top");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.title.toLowerCase().includes(q));
  }, [sections, query]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      const p = scrollHeight <= 0 ? 0 : Math.min(1, Math.max(0, scrollTop / scrollHeight));
      setProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ✅ “Active em tempo real” (scrollspy) mais estável
  useEffect(() => {
    const ids = sections.map((s) => s.id);
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (!targets.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

        if (visible?.target?.id) {
          setActiveId(visible.target.id);
          return;
        }

        const topEl = document.getElementById("top");
        const topRect = topEl?.getBoundingClientRect();
        if (topRect && topRect.top >= -10 && topRect.top < 160) setActiveId("top");
      },
      {
        root: null,
        threshold: [0.06, 0.12, 0.2, 0.32, 0.45],
        rootMargin: "-22% 0px -58% 0px",
      }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [sections]);

  // ✅ Atalhos “inteligentes”: / para buscar; Esc limpa; g volta topo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
      const isTypingContext = tag === "input" || tag === "textarea";
      if (e.key === "/" && !isTypingContext) {
        e.preventDefault();
        const el = document.getElementById("terms-nav-search") as HTMLInputElement | null;
        el?.focus();
      }
      if (e.key === "Escape") {
        setQuery("");
        if (isTypingContext) (document.activeElement as HTMLElement | null)?.blur?.();
      }
      if ((e.key === "g" || e.key === "G") && !isTypingContext) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const scrollTo = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      if (id === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    []
  );

  const RevealBlock = ({
    children,
    delay = 0,
    y = 12,
  }: {
    children: React.ReactNode;
    delay?: number;
    y?: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={VIEWPORT}
      transition={{
        duration: prefersReducedMotion ? 0 : DUR.lg,
        ease: EASE,
        delay,
      }}
      style={{ willChange: "transform, opacity, filter" }}
    >
      {children}
    </motion.div>
  );

  // ✅ Header/H2 animado; textos como bloco por seção (mais rápido/fluido)
  const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <motion.h2
      id={id}
      initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={VIEWPORT}
      transition={{ duration: prefersReducedMotion ? 0 : DUR.md, ease: EASE }}
      className="scroll-mt-28 text-[24px] sm:text-[28px] md:text-[30px] font-semibold tracking-tight text-black"
      style={{ willChange: "transform, opacity, filter" }}
    >
      {children}
    </motion.h2>
  );

  const P = ({ children }: { children: React.ReactNode }) => (
    <p className="mt-4 text-[16px] sm:text-[17px] md:text-[17.5px] leading-[1.85] text-black/60">
      {children}
    </p>
  );

  const Li = ({ children }: { children: React.ReactNode }) => (
    <li className="text-[16px] sm:text-[17px] md:text-[17.5px] leading-[1.85] text-black/60">
      {children}
    </li>
  );

  // ✅ Sidebar visual igual exemplo (sem background, com “bolinha” + label; sem seta)
  const SidebarItem = ({ id, title }: { id: string; title: string }) => {
    const isActive = activeId === id;
    const meta = (iconMap as any)[id] ?? (iconMap as any).top;
    const Icon = meta.Icon;
    const bubble = meta.bubble;

    return (
      <motion.a
        href={`#${id}`}
        onClick={scrollTo(id)}
        initial={false}
        whileHover={prefersReducedMotion ? undefined : { y: -1 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
        className={cx(
          "group flex items-center gap-3 rounded-full px-2.5 py-2 transition-all duration-300 ease-out select-none",
          isActive
            ? "bg-white shadow-[0_20px_30px_rgba(0,0,0,0.02)] ring-1 ring-black/5"
            : "bg-transparent hover:bg-black/[0.03]"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <span
          className={cx(
            "grid h-11 w-11 place-items-center rounded-full",
            bubble,
            isActive ? "shadow-[0_10px_28px_rgba(0,0,0,0.10)]" : "shadow-none"
          )}
        >
          <Icon {...(iconMap as any).__common} />
        </span>

        <span
          className={cx(
            "truncate text-[15px] font-semibold tracking-tight",
            isActive ? "text-black" : "text-black/80 group-hover:text-black"
          )}
        >
          {title}
        </span>
      </motion.a>
    );
  };

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="mt-7 rounded-[28px] bg-[#f4f4f4] ring-1 ring-black/5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
      <div className="p-6 sm:p-8">{children}</div>
    </div>
  );

  return (
    <div id="top" className="min-h-screen bg-white" ref={contentRef}>
      {/* ✅ Scrollbar invisível (sidebar) */}
      <style jsx global>{`
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
      `}</style>

      {/* Soft background accents */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : DUR.xl, ease: EASE }}
          className="absolute inset-0"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 1.25, ease: EASE }}
            className="absolute -top-40 -left-48 h-[520px] w-[520px] rounded-full bg-[#99e600]/10 blur-[140px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 1.35, ease: EASE, delay: 0.05 }}
            className="absolute -top-56 right-0 h-[560px] w-[560px] rounded-full bg-black/5 blur-[160px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 1.45, ease: EASE, delay: 0.08 }}
            className="absolute bottom-[-220px] left-[25%] h-[520px] w-[520px] rounded-full bg-black/5 blur-[170px]"
          />
        </motion.div>
      </div>

      {/* ✅ Progress “premium” no topo */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent">
        <motion.div
          style={{ scaleX: progress, transformOrigin: "0% 50%" }}
          className="h-full bg-black/70"
          initial={false}
          animate={{}}
          transition={{ duration: prefersReducedMotion ? 0 : 0.12, ease: EASE }}
        />
      </div>

      {/* ✅ SIDEBAR FULL ESQUERDA (visual igual screenshot, sem card background, sem seta) */}
      <aside className="hidden lg:block fixed left-0 top-0 z-50 h-screen w-[360px] px-6 pt-10 pb-6">
        <div className="h-full">
          <div className="mb-4 flex items-center gap-2 px-2">
            <div className="text-[12px] font-semibold tracking-wide text-black/45">NAVEGAÇÃO</div>
            <div className="ml-auto text-[11px] text-black/35">/ buscar • g topo</div>
          </div>

          {/* Search (mínimo, sem “card”) */}
          <div className="px-2">
            <div className="flex items-center gap-2 rounded-full bg-black/[0.03] ring-1 ring-black/5 px-3 py-2">
              <Search className="h-[16px] w-[16px] text-black/50" />
              <input
                id="terms-nav-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar seção…"
                className="w-full bg-transparent outline-none text-[14px] text-black/80 placeholder:text-black/35"
              />
            </div>
          </div>

          {/* Items */}
          <div className="mt-5 h-[calc(100%-84px)] no-scrollbar px-2 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {filteredSections.map((s) => (
                <SidebarItem key={s.id} id={s.id} title={s.title} />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ✅ Conteúdo central (padding-left pra não ficar embaixo da sidebar) */}
      <main className="relative z-10 mx-auto w-full max-w-[1100px] px-4 sm:px-6 pt-10 pb-16 lg:pl-[390px]">
        {/* Header */}
        <RevealBlock>
          <div className="flex flex-col gap-3">
            <h1 className="text-black/90 tracking-tight font-semibold leading-[1.04] text-[2.25rem] sm:text-[2.9rem] md:text-[3.25rem]">
              Termos de Serviço — Wyzer
            </h1>

            <p className="max-w-3xl text-black/55 text-[16px] sm:text-[17px] leading-relaxed">
              Estes termos definem as regras de uso do Wyzer (automação de atendimento, fluxos e integrações) e as
              responsabilidades entre você e a Wyzer.
            </p>
          </div>
        </RevealBlock>

        {/* Mobile/Tablet nav (mantém funcional) */}
        <div className="lg:hidden mt-8">
          <div className="text-[12px] font-semibold tracking-wide text-black/45 mb-3">NAVEGAÇÃO</div>
          <div className="flex flex-col gap-2">
            {filteredSections.map((s) => (
              <SidebarItem key={s.id} id={s.id} title={s.title} />
            ))}
          </div>
        </div>

        {/* Quote card */}
        <Card>
          <RevealBlock delay={prefersReducedMotion ? 0 : 0.03} y={14}>
            <div className="max-w-4xl">
              <div className="text-[13px] font-semibold text-black/55">Uma ideia que guia nossos princípios</div>
              <div className="mt-4 text-[22px] sm:text-[26px] md:text-[30px] leading-[1.18] tracking-tight font-medium text-black">
                <span className="select-none">“</span>
                {quote}
                <span className="select-none">”</span>
              </div>

              <div className="mt-5 text-[13px] text-black/55">
                Última atualização:{" "}
                <span className="text-black/70 font-semibold">{new Date().toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          </RevealBlock>
        </Card>

        {/* Top note */}
        <RevealBlock delay={prefersReducedMotion ? 0 : 0.02} y={14}>
          <div className="mt-10 rounded-[22px] bg-[#f4f4f4] ring-1 ring-black/5 p-5 sm:p-6 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
            <div className="text-[12px] font-semibold tracking-wide text-black/45">IMPORTANTE</div>
            <div className="mt-2 text-[14px] sm:text-[14.5px] leading-relaxed text-black/60">
              Estes termos foram escritos para proteger a Wyzer e orientar o uso responsável do serviço. Se você precisa
              de cláusulas específicas (ex.: aditivo de tratamento de dados, SLAs formais, políticas internas), consulte
              um advogado para adequação ao seu caso.
            </div>
          </div>
        </RevealBlock>

        {/* Terms (animação por BLOCO/SEÇÃO) */}
        <div className="mt-10 space-y-14">
          <section id="aceite">
            <RevealBlock>
              <H2 id="aceite">1. Aceite e elegibilidade</H2>
              <P>
                Ao acessar, criar conta, contratar um plano ou usar qualquer funcionalidade do Wyzer (“Serviço”), você
                concorda com estes Termos de Serviço (“Termos”). Se você utilizar o Serviço em nome de uma empresa, você
                declara possuir poderes para vincular essa empresa a estes Termos.
              </P>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>Você deve ter capacidade legal para contratar e usar o Serviço.</Li>
                <Li>Você se compromete a fornecer informações verdadeiras, completas e atualizadas quando solicitado.</Li>
                <Li>Se você não concorda com estes Termos, não utilize o Serviço.</Li>
              </ul>
            </RevealBlock>
          </section>

          <section id="definicoes">
            <RevealBlock>
              <H2 id="definicoes">2. Definições</H2>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>
                  <b className="text-black/75">“Wyzer”</b>: plataforma de automação de atendimento, fluxos, integrações,
                  dashboards e recursos correlatos.
                </Li>
                <Li>
                  <b className="text-black/75">“Cliente”</b>: pessoa física ou jurídica titular da conta e/ou contratante
                  do Plano.
                </Li>
                <Li>
                  <b className="text-black/75">“Usuários”</b>: pessoas autorizadas pelo Cliente a acessar e operar a conta
                  (ex.: atendentes, gestores).
                </Li>
                <Li>
                  <b className="text-black/75">“Conteúdo do Cliente”</b>: mensagens, contatos, mídias, templates,
                  configurações, dados e informações inseridas no Serviço.
                </Li>
                <Li>
                  <b className="text-black/75">“Dados Pessoais”</b>: dados relacionados a pessoa natural identificada ou
                  identificável, conforme legislação aplicável.
                </Li>
              </ul>
            </RevealBlock>
          </section>

          <section id="servico">
            <RevealBlock>
              <H2 id="servico">3. O serviço Wyzer</H2>
              <P>
                O Wyzer fornece recursos para automação e gestão de atendimento, incluindo (sem limitação) fluxos,
                respostas automáticas, organização de conversas, dashboards, relatórios e integrações com ferramentas de
                terceiros.
              </P>
              <P>
                A Wyzer pode atualizar, melhorar, modificar ou descontinuar funcionalidades para manter segurança,
                estabilidade e evolução do produto. Algumas funcionalidades podem depender de integrações externas e
                condições impostas por terceiros.
              </P>
            </RevealBlock>
          </section>

          <section id="conta">
            <RevealBlock>
              <H2 id="conta">4. Conta, acesso e segurança</H2>
              <P>
                Você é responsável por manter credenciais confidenciais, gerenciar acessos e proteger a conta. Atos
                praticados com suas credenciais serão considerados de sua responsabilidade.
              </P>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>Utilize senhas fortes e, quando disponível, autenticação de múltiplos fatores.</Li>
                <Li>Revogue acessos de Usuários desligados ou sem necessidade operacional.</Li>
                <Li>Proteja chaves/tokens/webhooks e rotacione credenciais em caso de suspeita de vazamento.</Li>
                <Li>Comunique incidentes de segurança assim que tomar conhecimento.</Li>
              </ul>
            </RevealBlock>
          </section>

          <section id="uso">
            <RevealBlock>
              <H2 id="uso">5. Uso aceitável e condutas proibidas</H2>
              <P>Você concorda em usar o Serviço apenas para fins lícitos e compatíveis com estes Termos. É proibido:</P>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>Praticar fraude, golpes, phishing, engenharia social ou coleta indevida de dados.</Li>
                <Li>Enviar spam, comunicações não solicitadas em massa ou violar políticas antiabuso.</Li>
                <Li>Distribuir malware, explorar vulnerabilidades, ou realizar testes/varreduras não autorizadas.</Li>
                <Li>Violar direitos autorais, marcas, segredos comerciais ou quaisquer direitos de terceiros.</Li>
                <Li>Publicar ou disparar conteúdo ilegal, discriminatório, violento ou que viole direitos humanos.</Li>
                <Li>Contornar limites do sistema, rate limits, mecanismos de segurança ou acessar dados de terceiros.</Li>
              </ul>
              <P>
                A Wyzer poderá adotar medidas de mitigação, incluindo limitação, bloqueio temporário, suspensão ou
                encerramento, quando identificar abuso, fraude, risco técnico, risco jurídico ou violação destes Termos.
              </P>
            </RevealBlock>
          </section>

          <section id="whatsapp">
            <RevealBlock>
              <H2 id="whatsapp">6. WhatsApp e políticas de terceiros</H2>
              <P>
                O Serviço pode operar em conjunto com plataformas e APIs de terceiros (ex.: WhatsApp/Meta, provedores de
                mensagens, gateways). Você deve cumprir integralmente os termos e políticas desses terceiros.
              </P>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>Você é responsável por obter consentimento/base legal para contatar usuários finais.</Li>
                <Li>Opt-out, listas de bloqueio e preferências de comunicação devem ser respeitados.</Li>
                <Li>Sanções, bloqueios ou restrições aplicadas por terceiros podem impactar o Serviço.</Li>
              </ul>
            </RevealBlock>
          </section>

          <section id="planos">
            <RevealBlock>
              <H2 id="planos">7. Planos, faturamento, renovação e tributos</H2>
              <P>
                O Wyzer pode ser oferecido por Planos com limites e recursos específicos. O preço, periodicidade e
                condições do Plano aparecem no momento da contratação e/ou na área de cobrança.
              </P>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>
                  <b className="text-black/75">Renovação automática</b>: Planos recorrentes renovam automaticamente no fim
                  do ciclo, salvo cancelamento antes da data de renovação.
                </Li>
                <Li>
                  <b className="text-black/75">Falha de pagamento</b>: em caso de inadimplência, a conta pode ser
                  limitada, suspensa ou rebaixada.
                </Li>
                <Li>
                  <b className="text-black/75">Impostos</b>: tributos podem ser incluídos conforme legislação e emissão
                  fiscal aplicável.
                </Li>
                <Li>
                  <b className="text-black/75">Mudança de plano</b>: upgrades podem ter cobrança proporcional; downgrades
                  podem aplicar no próximo ciclo.
                </Li>
              </ul>
            </RevealBlock>
          </section>

          <section id="cancelamento">
            <RevealBlock>
              <H2 id="cancelamento">8. Cancelamento, reembolso, chargeback e disputas</H2>
              <P>
                Você pode solicitar cancelamento a qualquer momento. O cancelamento encerra renovações futuras, e o acesso
                pode permanecer até o término do ciclo pago, salvo suspensão por abuso/fraude.
              </P>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>
                  <b className="text-black/75">Reembolsos</b>: quando aplicáveis, podem ser analisados caso a caso,
                  considerando uso do serviço, custos operacionais, taxas e benefícios já consumidos.
                </Li>
                <Li>
                  <b className="text-black/75">Serviços de terceiros</b>: taxas de mensagens, processamento e integrações
                  podem não ser reembolsáveis.
                </Li>
                <Li>
                  <b className="text-black/75">Chargeback</b>: disputas abertas diretamente com o banco podem resultar em
                  suspensão por risco de fraude. Recomendamos contatar o suporte antes para resolução.
                </Li>
                <Li>
                  <b className="text-black/75">Abuso/fraude</b>: não há reembolso em casos de fraude, violação de termos,
                  conteúdo ilegal ou chargebacks abusivos.
                </Li>
              </ul>
              <P>
                Quando o Cliente for consumidor, direitos previstos em lei podem ser aplicáveis conforme o caso concreto e
                limites legais.
              </P>
            </RevealBlock>
          </section>

          <section id="conteudo">
            <RevealBlock>
              <H2 id="conteudo">9. Conteúdo, dados e responsabilidades</H2>
              <P>
                Você mantém a titularidade do Conteúdo do Cliente. Você concede à Wyzer uma licença limitada para hospedar,
                processar e exibir o Conteúdo do Cliente exclusivamente para operar, manter e melhorar o Serviço, conforme
                estes Termos e a Política de Privacidade.
              </P>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>Você declara ter direito de usar e inserir o Conteúdo do Cliente, incluindo listas de contatos e templates.</Li>
                <Li>Você é responsável por fluxos, mensagens, respostas automáticas e conformidade legal do seu uso.</Li>
                <Li>O Wyzer é uma ferramenta; não garantimos resultados comerciais (vendas, conversão, lucro).</Li>
              </ul>
            </RevealBlock>
          </section>

          <section id="privacidade">
            <RevealBlock>
              <H2 id="privacidade">10. Privacidade, segurança e LGPD</H2>
              <P>
                A Wyzer trata Dados Pessoais conforme a legislação aplicável e sua Política de Privacidade. Em cenários
                típicos, você atua como Controlador dos dados dos seus clientes/usuários finais, e a Wyzer atua como
                Operadora ao processar dados em seu nome, quando aplicável.
              </P>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>Você deve possuir base legal para tratamento e para envio de comunicações.</Li>
                <Li>Você deve responder solicitações de titulares conforme a lei e o contexto do seu negócio.</Li>
                <Li>Adotamos medidas de segurança proporcionais, mas nenhum sistema é 100% invune a incidentes.</Li>
                <Li>
                  Em caso de incidente relevante, a Wyzer poderá notificar conforme exigências legais e melhores práticas,
                  considerando risco aos titulares.
                </Li>
              </ul>
            </RevealBlock>
          </section>

          <section id="integracoes">
            <RevealBlock>
              <H2 id="integracoes">11. Integrações e serviços de terceiros</H2>
              <P>
                Integrações podem ser disponibilizadas para facilitar sua operação. A Wyzer não controla serviços de
                terceiros e não se responsabiliza por suas mudanças, falhas, indisponibilidade, preços ou políticas.
              </P>
              <P>
                Você é responsável por contratar, configurar e manter suas credenciais de integrações (tokens, chaves e
                webhooks).
              </P>
            </RevealBlock>
          </section>

          <section id="disponibilidade">
            <RevealBlock>
              <H2 id="disponibilidade">12. Disponibilidade, manutenção e suporte</H2>
              <P>
                A Wyzer busca alta disponibilidade, porém podem ocorrer interrupções por manutenção, atualizações,
                incidentes, eventos de força maior e dependências de terceiros.
              </P>
              <ul className="mt-5 list-disc pl-6 space-y-2.5">
                <Li>Manutenções programadas podem ocorrer com aviso quando viável.</Li>
                <Li>O suporte pode variar conforme Plano, horários e canais definidos pela Wyzer.</Li>
                <Li>Podemos aplicar limites de uso e medidas antiabuso para proteger a plataforma.</Li>
              </ul>
            </RevealBlock>
          </section>

          <section id="propriedade">
            <RevealBlock>
              <H2 id="propriedade">13. Propriedade intelectual</H2>
              <P>
                O Wyzer, sua marca, interface, design, código e materiais são protegidos por direitos de propriedade
                intelectual. Exceto onde permitido, é proibido copiar, modificar, redistribuir, realizar engenharia reversa
                ou criar obras derivadas do Serviço.
              </P>
            </RevealBlock>
          </section>

          <section id="garantias">
            <RevealBlock>
              <H2 id="garantias">14. Isenções e garantias</H2>
              <P>
                O Serviço é fornecido “no estado em que se encontra” e “conforme disponibilidade”. A Wyzer não garante
                operação ininterrupta, livre de erros ou adequação a um propósito específico.
              </P>
              <P>
                Recomendamos manter backups, rotinas de auditoria e planos de contingência compatíveis com a criticidade da
                sua operação.
              </P>
            </RevealBlock>
          </section>

          <section id="limitacao">
            <RevealBlock>
              <H2 id="limitacao">15. Limitação de responsabilidade</H2>
              <P>
                Na máxima extensão permitida pela lei, a Wyzer não será responsável por lucros cessantes, perda de receita,
                perda de dados, perda reputacional, interrupção de negócios, danos indiretos, incidentais, punitivos ou
                consequenciais, nem por atos/omissões de terceiros.
              </P>
              <P>
                Quando a responsabilidade não puder ser excluída, ela será limitada ao valor efetivamente pago por você à
                Wyzer nos 3 (três) meses anteriores ao evento que deu causa ao pedido, salvo disposição legal imperativa em
                sentido diverso.
              </P>
            </RevealBlock>
          </section>

          <section id="indenizacao">
            <RevealBlock>
              <H2 id="indenizacao">16. Indenização</H2>
              <P>
                Você concorda em indenizar e manter a Wyzer, seus sócios, administradores e colaboradores indenes de
                reivindicações, perdas, danos e despesas (incluindo honorários advocatícios) decorrentes de: (i) violação
                destes Termos; (ii) uso ilícito do Serviço; (iii) Conteúdo do Cliente; (iv) violação de direitos de terceiros;
                (v) descumprimento de leis aplicáveis.
              </P>
            </RevealBlock>
          </section>

          <section id="suspensao">
            <RevealBlock>
              <H2 id="suspensao">17. Suspensão e rescisão</H2>
              <P>
                A Wyzer pode suspender ou encerrar o acesso total/parcial ao Serviço se houver suspeita de fraude, abuso,
                risco de segurança, inadimplência relevante, exigência legal ou necessidade de proteger a integridade da
                plataforma.
              </P>
              <P>
                Você pode encerrar sua conta conforme opções disponíveis. Após o encerramento, dados poderão ser excluídos
                após prazos razoáveis e conforme obrigações legais, técnicas e de segurança.
              </P>
            </RevealBlock>
          </section>

          <section id="alteracoes">
            <RevealBlock>
              <H2 id="alteracoes">18. Alterações destes termos</H2>
              <P>
                A Wyzer pode atualizar estes Termos periodicamente. Quando a alteração for relevante, poderemos avisar por
                meios razoáveis (ex.: e-mail ou aviso no painel). O uso continuado após a atualização configura aceite dos
                termos revisados.
              </P>
            </RevealBlock>
          </section>

          <section id="lei">
            <RevealBlock>
              <H2 id="lei">19. Lei aplicável e foro</H2>
              <P>
                Estes Termos são regidos pelas leis da República Federativa do Brasil. Quando aplicável por lei, fica eleito
                o foro do domicílio do Cliente; caso contrário, fica eleito o foro competente conforme documentos
                societários/operacionais da Wyzer, respeitadas normas legais imperativas.
              </P>
            </RevealBlock>
          </section>

          <section id="contato">
            <RevealBlock>
              <H2 id="contato">20. Contato</H2>
              <P>
                Para dúvidas, solicitações ou assuntos legais, entre em contato pelos canais oficiais informados no site e/ou
                no painel do Wyzer.
              </P>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <motion.a
                  href="/contato"
                  whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                  className="group relative inline-flex items-center justify-center bg-white border border-black/10 rounded-full px-5 py-3 text-black/80 hover:text-black hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-lime-400/60 transition-all duration-300 ease-out text-[13px] font-semibold shadow-sm"
                >
                  Falar com a Wyzer
                </motion.a>

                <motion.a
                  href="#top"
                  onClick={scrollTo("top")}
                  whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                  className="group relative inline-flex items-center justify-center bg-[#171717] border border-[#454545] border-2 rounded-full px-5 py-3 text-white hover:border-[#6a6a6a] focus:outline-none focus:ring-2 focus:ring-lime-400/60 transition-all duration-300 ease-out text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)]"
                  style={{ willChange: "transform" }}
                >
                  Voltar ao topo
                </motion.a>
              </div>
            </RevealBlock>
          </section>
        </div>

        <div className="h-14" />
      </main>
    </div>
  );
}
