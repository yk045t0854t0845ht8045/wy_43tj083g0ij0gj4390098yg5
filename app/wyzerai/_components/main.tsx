"use client"

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"

interface AttachedFile {
  id: string
  file: File
  preview: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  images?: AttachedFile[]
}

interface Suggestion {
  id: string
  text: string
}

interface QuickAction {
  id: string
  label: string
}

interface Category {
  id: string
  label: string
  icon: React.ReactNode
  actions: QuickAction[]
}

interface MainProps {
  userName?: string
  onQuickAction?: (action: string) => void
  onCategorySelect?: (category: string) => void
  logoSrc?: string
  botAvatarSrc?: string
  messages?: Message[]
  isLoading?: boolean
  streamingContent?: string
  onImageClick?: (image: AttachedFile) => void
}

const categoriesData: Category[] = [
  {
    id: "Ajuda",
    label: "Ajuda",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-2 2-2 4" />
        <path d="M12 17h.01" />
      </svg>
    ),
    actions: [
      { id: "help-support", label: "Preciso de ajuda com urgencia." },
      { id: "site-ssl", label: "Falar com um atendente Wyzer." },
      { id: "site-backup", label: "Onde posso acessar a documentacao?" },
      {
        id: "site-performance",
        label: "Verificar Termos e Politica de Privacidade",
      },
    ],
  },
  {
    id: "Duvidas",
    label: "Duvidas",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    actions: [
      { id: "renovacao", label: "Posso usar meu numero proprio?" },
      { id: "verificacao", label: "Como conecto meu WhatsApp na Wyzer?" },
      { id: "subdominio", label: "WhatsApp desconectou — o que fazer?" },
      { id: "transferencia", label: "Da pra atender com mais de um numero?" },
    ],
  },
  {
    id: "Planos",
    label: "Planos",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M2 8h20" />
        <path d="M6 14h4" />
        <path d="M14 14h4" />
      </svg>
    ),
    actions: [
      { id: "vps-upgrade", label: "Assinar um plano Wyzer PRO" },
      { id: "vps-status", label: "Consigo migrar meu plano para outro?" },
      { id: "vps-reiniciar", label: "Posso realizar um teste gratuitamente?" },
      { id: "vps-recursos", label: "Realizar um upgrade em meu plano" },
    ],
  },
  {
    id: "Sistema",
    label: "Sistema",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M2 7h20" />
        <path d="M6 5h.01" />
        <path d="M9 5h.01" />
        <path d="M12 5h.01" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    ),
    actions: [
      { id: "email-criar", label: "Verificar status de servico" },
      { id: "email-configurar", label: "O sistema da Wyzer esta funcionando?" },
      {
        id: "email-smtp",
        label: "Como verificar se ha instabilidade no sistema?",
      },
      {
        id: "email-encaminhamento",
        label: "Relatar um problema em nosso sistema.",
      },
    ],
  },
  {
    id: "Seguranca",
    label: "Seguranca",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="11" width="14" height="11" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        <path d="M12 16v2" />
      </svg>
    ),
    actions: [
      { id: "wz_att_dados_c", label: "Como atualizar dados cadastrais?" },
      {
        id: "wz_mudar_email_conta",
        label: "Posso mudar o email da minha conta?",
      },
      { id: "wz_ativar_2fa", label: "Como ativar verificacao de 2 etapas?" },
      { id: "wz_alterar_senha", label: "Alterar minha senha" },
    ],
  },
  {
    id: "Reembolsos",
    label: "Reembolsos",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
    actions: [
      { id: "wz_realizar_reembolso", label: "Consigo realizar um reembolso?" },
      {
        id: "wz_historico_de_pagamentos",
        label: "Solicitar historico de pagamentos",
      },
      { id: "wz_verficar_uma_cobranca", label: "Verificar uma cobranca" },
      {
        id: "wz_atualzar_cartao_de_credito",
        label: "Como atualizar meu cartao de credito?",
      },
    ],
  },
]

// Sugestoes pre-definidas por keyword
const keywordSuggestions: Record<string, Suggestion[]> = {
  reembolso: [
    { id: "r1", text: "Qual o prazo para reembolso?" },
    { id: "r2", text: "Como acompanhar meu reembolso?" },
    { id: "r3", text: "Reembolso parcial e possivel?" },
  ],
  pagamento: [
    { id: "p1", text: "Quais formas de pagamento aceitas?" },
    { id: "p2", text: "Como atualizar meu cartao?" },
    { id: "p3", text: "Meu pagamento foi recusado" },
  ],
  plano: [
    { id: "pl1", text: "Quais planos estao disponiveis?" },
    { id: "pl2", text: "Posso fazer upgrade do meu plano?" },
    { id: "pl3", text: "Como cancelar meu plano?" },
  ],
  senha: [
    { id: "s1", text: "Esqueci minha senha" },
    { id: "s2", text: "Como criar uma senha segura?" },
    { id: "s3", text: "Ativar autenticacao em 2 etapas" },
  ],
  whatsapp: [
    { id: "w1", text: "Como conectar meu WhatsApp?" },
    { id: "w2", text: "WhatsApp desconectou, o que fazer?" },
    { id: "w3", text: "Posso usar mais de um numero?" },
  ],
  email: [
    { id: "e1", text: "Como alterar meu email?" },
    { id: "e2", text: "Nao recebi o email de confirmacao" },
    { id: "e3", text: "Configurar email corporativo" },
  ],
  cancelar: [
    { id: "c1", text: "Como cancelar minha assinatura?" },
    { id: "c2", text: "Perco meus dados ao cancelar?" },
    { id: "c3", text: "Posso pausar em vez de cancelar?" },
  ],
  erro: [
    { id: "er1", text: "Reportar um bug no sistema" },
    { id: "er2", text: "O sistema esta fora do ar?" },
    { id: "er3", text: "Limpar cache e tentar novamente" },
  ],
  ajuda: [
    { id: "a1", text: "Falar com um atendente humano" },
    { id: "a2", text: "Onde encontro a documentacao?" },
    { id: "a3", text: "Horario de atendimento" },
  ],
  cobranca: [
    { id: "cb1", text: "Contestar uma cobranca" },
    { id: "cb2", text: "Historico de pagamentos" },
    { id: "cb3", text: "Segunda via do boleto" },
  ],
  conta: [
    { id: "ct1", text: "Como excluir minha conta?" },
    { id: "ct2", text: "Atualizar dados cadastrais" },
    { id: "ct3", text: "Transferir conta para outra pessoa" },
  ],
  integracao: [
    { id: "i1", text: "Quais integracoes estao disponiveis?" },
    { id: "i2", text: "Como configurar webhook?" },
    { id: "i3", text: "API esta funcionando?" },
  ],
  dominio: [
    { id: "d1", text: "Como apontar meu dominio?" },
    { id: "d2", text: "Configurar DNS corretamente" },
    { id: "d3", text: "Transferir dominio para Wyzer" },
  ],
  mx: [
    { id: "mx1", text: "O que sao registros MX?" },
    { id: "mx2", text: "Como verificar se MX esta correto?" },
    { id: "mx3", text: "Problemas com recebimento de email" },
  ],
}

const KEYWORDS = Object.keys(keywordSuggestions)

// Verifica se a mensagem contem alguma keyword
function findKeywordMatch(text: string): string | null {
  const lower = text.toLowerCase()
  for (const keyword of KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword
    }
  }
  return null
}

const cssAnimations = `
@keyframes dotBounce {
  0%, 80%, 100% { 
    transform: translateY(0);
    opacity: 0.4;
  }
  40% { 
    transform: translateY(-4px);
    opacity: 1;
  }
}

@keyframes shimmerSlide {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes sparkleRotate {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
  50% { transform: scale(1.2) rotate(180deg); opacity: 0.8; }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slideInFromBottom {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
`

function AnimatedDots() {
  return (
    <span className="inline-flex items-end ml-0.5 h-4">
      <span
        className="inline-block w-1 h-1 bg-gray-500 rounded-full mx-[1px]"
        style={{
          animation: "dotBounce 1.4s ease-in-out infinite",
          animationDelay: "0ms",
        }}
      />
      <span
        className="inline-block w-1 h-1 bg-gray-500 rounded-full mx-[1px]"
        style={{
          animation: "dotBounce 1.4s ease-in-out infinite",
          animationDelay: "200ms",
        }}
      />
      <span
        className="inline-block w-1 h-1 bg-gray-500 rounded-full mx-[1px]"
        style={{
          animation: "dotBounce 1.4s ease-in-out infinite",
          animationDelay: "400ms",
        }}
      />
    </span>
  )
}

function ShimmerText({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-gray-500"
      style={{
        background:
          "linear-gradient(90deg, #6b7280 0%, #6b7280 40%, #d1d5db 50%, #6b7280 60%, #6b7280 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        animation: "shimmerSlide 2s ease-in-out infinite",
      }}
    >
      {children}
    </span>
  )
}

function LoadingMessage({ botAvatarSrc }: { botAvatarSrc?: string }) {
  return (
    <div
      className="flex items-start gap-3"
      style={{ animation: "fadeInUp 0.5s ease-out forwards" }}
    >
      <div className="flex-shrink-0 w-8 h-8 overflow-hidden flex items-center justify-center">
        {botAvatarSrc ? (
          <img
            src="/flow-icon.png"
            alt="Flow"
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white"
          >
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="currentColor"
            />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-900">Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-black flex-shrink-0"
            style={{ animation: "sparkleRotate 2s ease-in-out infinite" }}
          >
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-sm flex items-end">
            <ShimmerText>Analisando sua solicitacao</ShimmerText>
            <div className="mt-1">
              <AnimatedDots />
            </div>
          </span>
        </div>
      </div>
    </div>
  )
}

function StreamingMessage({
  content,
  botAvatarSrc,
}: {
  content: string
  botAvatarSrc?: string
}) {
  return (
    <div
      className="flex items-start gap-3"
      style={{ animation: "fadeInUp 0.5s ease-out forwards" }}
    >
      <div className="flex-shrink-0 w-8 h-8 overflow-hidden flex items-center justify-center">
        {botAvatarSrc ? (
          <img
            src="/flow-icon.png"
            alt="Flow"
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white"
          >
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="currentColor"
            />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-900">Flow</span>
        </div>
        <div
          className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
          style={{ animation: "fadeIn 0.3s ease-out forwards" }}
        >
          {content}
          <span className="inline-block w-2 h-4 bg-gray-400 ml-0.5 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

function MessageImages({
  images,
  onImageClick,
}: {
  images: AttachedFile[]
  onImageClick?: (image: AttachedFile) => void
}) {
  if (!images || images.length === 0) return null

  return (
    <div
      className={`mt-2 flex gap-2 ${images.length === 1 ? "justify-end" : ""}`}
    >
      {images.map((img) => (
        <button
          key={img.id}
          type="button"
          onClick={() => onImageClick?.(img)}
          className={[
            "rounded-xl overflow-hidden transition-all duration-300 ease-out",
            "hover:ring-2 hover:ring-violet-400 hover:scale-[1.02] active:scale-[0.98]",
            images.length === 1
              ? "max-w-[200px]"
              : "w-[calc(50%-4px)] max-w-[150px]",
          ].join(" ")}
        >
          <img
            src={img.preview || "/placeholder.svg"}
            alt={img.file.name}
            className="w-full h-auto object-cover"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  )
}

// Componente de sugestoes com loading para IA
function SuggestionsPanel({
  suggestions,
  isLoadingAI,
  onSuggestionClick,
}: {
  suggestions: Suggestion[]
  isLoadingAI: boolean
  onSuggestionClick?: (text: string) => void
}) {
  if (isLoadingAI) {
    return (
      <div
        className="mt-6 -ml-11"
        style={{ animation: "fadeInUp 0.6s ease-out forwards" }}
      >
        <p className="text-xs text-gray-500 mb-3 flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            className="text-violet-500"
            style={{ animation: "sparkleRotate 1.5s ease-in-out infinite" }}
          >
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="currentColor"
            />
          </svg>
          Gerando sugestoes...
        </p>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 bg-gray-100 rounded-xl"
              style={{ animation: `pulse 1.5s ease-in-out infinite`, animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (suggestions.length === 0) return null

  return (
    <div
      className="mt-6 -ml-11"
      style={{ animation: "fadeInUp 0.6s ease-out forwards" }}
    >
      <p className="text-xs text-gray-500 mb-3">Sugestoes</p>
      <div className="space-y-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            type="button"
            onClick={() => onSuggestionClick?.(suggestion.text)}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-all duration-300 ease-out hover:translate-x-1 active:scale-[0.98]"
            style={{
              animation: "slideInFromBottom 0.5s ease-out forwards",
              animationDelay: `${index * 100}ms`,
              opacity: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="text-violet-500 flex-shrink-0"
            >
              <path
                d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                fill="currentColor"
              />
            </svg>
            <span>{suggestion.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BotMessage({
  content,
  showSuggestions,
  lastUserMessage,
  lastBotMessage,
  onSuggestionClick,
  botAvatarSrc,
}: {
  content: string
  showSuggestions: boolean
  lastUserMessage: string
  lastBotMessage: string
  onSuggestionClick?: (text: string) => void
  botAvatarSrc?: string
}) {
  const [suggestionsVisible, setSuggestionsVisible] = useState(false)
  const [likeState, setLikeState] = useState<"none" | "liked" | "disliked">("none")
  const [copied, setCopied] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const hasGeneratedRef = useRef(false)

  // Gera sugestoes com IA
  const generateAISuggestions = useCallback(async (botResponse: string) => {
    if (hasGeneratedRef.current) return
    hasGeneratedRef.current = true
    
    setIsLoadingAI(true)
    
    try {
      const response = await fetch("/api/wz_WyzerAI/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastBotResponse: botResponse }),
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(
            data.suggestions.map((text: string, i: number) => ({
              id: `ai-${i}`,
              text,
            }))
          )
        }
      }
    } catch {
      // Fallback: sugestoes genericas
      setSuggestions([
        { id: "fb1", text: "Pode explicar melhor?" },
        { id: "fb2", text: "Preciso de mais ajuda" },
        { id: "fb3", text: "Falar com atendente" },
      ])
    } finally {
      setIsLoadingAI(false)
    }
  }, [])

  useEffect(() => {
    if (!showSuggestions) return

    const timer = setTimeout(() => {
      setSuggestionsVisible(true)

      // Verifica se tem keyword no user message OU no bot message
      const userKeyword = findKeywordMatch(lastUserMessage)
      const botKeyword = findKeywordMatch(lastBotMessage)
      const keyword = userKeyword || botKeyword

      if (keyword) {
        // Usa sugestoes pre-definidas
        setSuggestions(keywordSuggestions[keyword])
      } else {
        // Gera com IA baseado na resposta do bot
        generateAISuggestions(lastBotMessage)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [showSuggestions, lastUserMessage, lastBotMessage, generateAISuggestions])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="flex items-start gap-3"
      style={{ animation: "fadeInUp 0.5s ease-out forwards" }}
    >
      <div className="flex-shrink-0 w-8 h-8 overflow-hidden flex items-center justify-center">
        {botAvatarSrc ? (
          <img
            src="/flow-icon.png"
            alt="Flow"
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white"
          >
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="currentColor"
            />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-900">Flow</span>
        </div>

        <div
          className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
          style={{ animation: "fadeIn 0.3s ease-out forwards" }}
        >
          {content}
        </div>

        <div className="flex items-center gap-1 mt-3">
          <button
            type="button"
            onClick={() =>
              setLikeState(likeState === "liked" ? "none" : "liked")
            }
            className={[
              "p-1.5 rounded-full transition-all duration-300 ease-out active:scale-90",
              likeState === "liked"
                ? "text-violet-600 bg-violet-50"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
            ].join(" ")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={likeState === "liked" ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() =>
              setLikeState(likeState === "disliked" ? "none" : "disliked")
            }
            className={[
              "p-1.5 rounded-full transition-all duration-300 ease-out active:scale-90",
              likeState === "disliked"
                ? "text-red-500 bg-red-50"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
            ].join(" ")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={likeState === "disliked" ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={[
              "p-1.5 rounded-full transition-all duration-300 ease-out active:scale-90",
              copied
                ? "text-green-500 bg-green-50"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
            ].join(" ")}
            title={copied ? "Copiado!" : "Copiar mensagem"}
          >
            {copied ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>

        {showSuggestions && suggestionsVisible && (
          <SuggestionsPanel
            suggestions={suggestions}
            isLoadingAI={isLoadingAI}
            onSuggestionClick={onSuggestionClick}
          />
        )}
      </div>
    </div>
  )
}

function UserMessage({
  content,
  images,
  onImageClick,
}: {
  content: string
  images?: AttachedFile[]
  onImageClick?: (image: AttachedFile) => void
}) {
  return (
    <div
      className="flex flex-col items-end"
      style={{ animation: "fadeInUp 0.3s ease-out forwards" }}
    >
      <div className="max-w-[80%] px-4 py-2.5 bg-gray-100 rounded-2xl rounded-br-md transition-all duration-300">
        <p className="text-sm text-gray-900">{content}</p>
      </div>
      {images && images.length > 0 && (
        <MessageImages images={images} onImageClick={onImageClick} />
      )}
    </div>
  )
}

function WelcomeScreen({
  userName,
  logoSrc,
  onQuickAction,
}: {
  userName: string
  logoSrc: string
  onQuickAction?: (action: string) => void
}) {
  const [activeCategory, setActiveCategory] = useState("Ajuda")
  const [hoveredAction, setHoveredAction] = useState<string | null>(null)

  const currentActions = useMemo(() => {
    const category = categoriesData.find((c) => c.id === activeCategory)
    return category?.actions || []
  }, [activeCategory])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <style>{cssAnimations}</style>

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 min-h-[280px]">
          <div
            className="mb-6"
            style={{ animation: "scaleIn 0.6s ease-out forwards" }}
          >
            <img
              src="/flow-icon.png"
              alt="Logo"
              className="h-20 w-auto object-contain drop-shadow-lg transition-transform duration-500 hover:scale-105"
              loading="lazy"
              draggable={false}
            />
          </div>

          <h1
            className="text-2xl font-semibold text-gray-900 mb-2 text-center"
            style={{
              animation: "fadeInUp 0.5s ease-out 0.1s forwards",
              opacity: 0,
            }}
          >
            {"Olá! " + "Bem Vindo"}
          </h1>
          <p
            className="text-gray-500 text-base text-center"
            style={{
              animation: "fadeInUp 0.5s ease-out 0.2s forwards",
              opacity: 0,
            }}
          >
            Como posso te ajudar hoje?
          </p>
        </div>

        <div className="px-4 pb-2">
          <div className="space-y-0.5">
            {currentActions.map((action, index) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onQuickAction?.(action.label)}
                onMouseEnter={() => setHoveredAction(action.id)}
                onMouseLeave={() => setHoveredAction(null)}
                className={[
                  "flex items-center gap-3 w-full px-4 py-3.5 text-left rounded-2xl",
                  "transition-all duration-300 ease-out",
                  hoveredAction === action.id
                    ? "bg-gray-50 translate-x-1"
                    : "bg-transparent",
                ].join(" ")}
                style={{
                  animation: "fadeInUp 0.5s ease-out forwards",
                  animationDelay: `${300 + index * 80}ms`,
                  opacity: 0,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={[
                    "flex-shrink-0 transition-colors duration-300",
                    hoveredAction === action.id
                      ? "text-violet-500"
                      : "text-gray-400",
                  ].join(" ")}
                >
                  <path
                    d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                    fill="currentColor"
                  />
                </svg>
                <span className="text-sm text-gray-700 flex-1">
                  {action.label}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={[
                    "flex-shrink-0 transition-all duration-300",
                    hoveredAction === action.id
                      ? "text-gray-600 translate-x-0.5"
                      : "text-gray-300",
                  ].join(" ")}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <div
          className="px-4 py-4"
          style={{
            animation: "fadeInUp 0.5s ease-out 0.6s forwards",
            opacity: 0,
          }}
        >
          <div className="flex flex-wrap gap-2">
            {categoriesData.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium",
                  "transition-all duration-300 ease-out active:scale-95",
                  activeCategory === category.id
                    ? "bg-gray-900 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                ].join(" ")}
              >
                {category.icon}
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Main({
  userName = "Usuario",
  onQuickAction,
  logoSrc = "/logo.png",
  botAvatarSrc,
  messages = [],
  isLoading = false,
  streamingContent = "",
  onImageClick,
}: MainProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasMessages = messages.length > 0

  // Pega a ultima mensagem do usuario
  const lastUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") return messages[i].content || ""
    }
    return ""
  }, [messages])

  // Pega a ultima mensagem do bot
  const lastBotMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant") return messages[i].content || ""
    }
    return ""
  }, [messages])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const threshold = 120
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const shouldStickToBottom = distanceFromBottom <= threshold

    if (shouldStickToBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, isLoading, streamingContent])

  if (!hasMessages && !isLoading) {
    return (
      <WelcomeScreen
        userName={userName}
        logoSrc={logoSrc}
        onQuickAction={onQuickAction}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <style>{cssAnimations}</style>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 py-4 space-y-6">
          {messages.map((message, index) => {
            const isLastAssistant =
              message.role === "assistant" &&
              index === messages.length - 1 &&
              !isLoading

            if (message.role === "user") {
              return (
                <UserMessage
                  key={message.id}
                  content={message.content}
                  images={message.images}
                  onImageClick={onImageClick}
                />
              )
            }

            return (
              <BotMessage
                key={message.id}
                content={message.content}
                showSuggestions={isLastAssistant}
                lastUserMessage={lastUserMessage}
                lastBotMessage={message.content}
                onSuggestionClick={onQuickAction}
                botAvatarSrc={botAvatarSrc}
              />
            )
          })}

          {isLoading && streamingContent && (
            <StreamingMessage
              content={streamingContent}
              botAvatarSrc={botAvatarSrc}
            />
          )}

          {isLoading && !streamingContent && (
            <LoadingMessage botAvatarSrc={botAvatarSrc} />
          )}
        </div>
      </div>
    </div>
  )
}
