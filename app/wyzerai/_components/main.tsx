"use client"

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"

type RichTextNode = React.ReactNode

type AssistantBlock =
  | { kind: "text"; text: string }
  | { kind: "code"; code: string; lang?: string }

const INLINE_DELIMS = [
  { open: "`", close: "`", kind: "code" as const },
  { open: "***", close: "***", kind: "boldItalic" as const },
  { open: "___", close: "___", kind: "boldItalic" as const },
  { open: "**", close: "**", kind: "bold" as const },
  { open: "__", close: "__", kind: "bold" as const },
  { open: "*", close: "*", kind: "italic" as const },
  { open: "_", close: "_", kind: "italic" as const },
]

function renderInlineRichText(input: string, depth = 0, keyPrefix = "rt"): RichTextNode[] {
  if (!input) return []
  if (depth > 12) return [input]

  const out: RichTextNode[] = []
  let cursor = 0
  let keyIndex = 0

  const findNext = (text: string) => {
    let best: { idx: number; openLen: number; delim: (typeof INLINE_DELIMS)[number] } | null = null
    for (const delim of INLINE_DELIMS) {
      const idx = text.indexOf(delim.open)
      if (idx < 0) continue
      if (!best || idx < best.idx || (idx === best.idx && delim.open.length > best.openLen)) {
        best = { idx, openLen: delim.open.length, delim }
      }
    }
    return best
  }

  while (cursor < input.length) {
    const slice = input.slice(cursor)
    const next = findNext(slice)
    if (!next) {
      out.push(slice)
      break
    }

    if (next.idx > 0) {
      out.push(slice.slice(0, next.idx))
    }

    const openAt = next.idx
    const afterOpen = openAt + next.delim.open.length
    const closeAt = slice.indexOf(next.delim.close, afterOpen)

    // Se não tem fechamento ainda (streaming), manter texto normal
    if (closeAt < 0) {
      out.push(next.delim.open)
      cursor += afterOpen
      continue
    }

    const inner = slice.slice(afterOpen, closeAt)
    const restStart = closeAt + next.delim.close.length

    const key = `${keyPrefix}_${depth}_${cursor}_${keyIndex}`
    keyIndex++

    if (next.delim.kind === "code") {
      out.push(
        <code
          key={key}
          className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[0.85em]"
        >
          {inner}
        </code>
      )
      cursor += restStart
      continue
    }

    const children = renderInlineRichText(inner, depth + 1, key)
    if (next.delim.kind === "boldItalic") {
      out.push(
        <strong key={key} className="font-semibold">
          <em className="italic">{children}</em>
        </strong>
      )
    } else if (next.delim.kind === "bold") {
      out.push(
        <strong key={key} className="font-semibold">
          {children}
        </strong>
      )
    } else {
      out.push(
        <em key={key} className="italic">
          {children}
        </em>
      )
    }

    cursor += restStart
  }

  return out
}

function parseAssistantBlocks(input: string): AssistantBlock[] {
  const text = String(input || "")
  if (!text) return []

  const blocks: AssistantBlock[] = []
  let cursor = 0

  const findCloseFence = (from: number) => {
    for (let idx = text.indexOf("```", from); idx !== -1; idx = text.indexOf("```", idx + 3)) {
      const before = idx === 0 ? "\n" : text[idx - 1]
      if (before !== "\n") continue
      return idx
    }
    // Fallback: aceita fence fora do inÃ­cio da linha (casos raros)
    return text.indexOf("```", from)
  }

  while (cursor < text.length) {
    const openIdx = text.indexOf("```", cursor)
    if (openIdx === -1) {
      const rest = text.slice(cursor)
      if (rest) blocks.push({ kind: "text", text: rest })
      break
    }

    const before = text.slice(cursor, openIdx)
    if (before) blocks.push({ kind: "text", text: before })

    const afterOpen = openIdx + 3
    const openLineEnd = text.indexOf("\n", afterOpen)
    if (openLineEnd === -1) {
      // Streaming/incompleto: manter como texto normal para evitar flicker
      blocks.push({ kind: "text", text: text.slice(openIdx) })
      break
    }

    const langLine = text.slice(afterOpen, openLineEnd).trim()
    const codeStart = openLineEnd + 1
    const closeIdx = findCloseFence(codeStart)
    if (closeIdx === -1) {
      // Streaming/incompleto: manter como texto normal para evitar flicker
      blocks.push({ kind: "text", text: text.slice(openIdx) })
      break
    }

    let code = text.slice(codeStart, closeIdx)
    if (code.endsWith("\n")) code = code.slice(0, -1)

    blocks.push({ kind: "code", code, lang: langLine || undefined })

    cursor = closeIdx + 3
    if (text[cursor] === "\n") cursor += 1
  }

  return blocks
}

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
  kind?: "login_required"
  dbId?: number
  liked?: boolean
  disliked?: boolean
  isStreaming?: boolean
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
  isConversationLoading?: boolean
  streamingContent?: string
  onImageClick?: (image: AttachedFile) => void
  onLoginClick?: () => void
  onReactMessage?: (dbId: number, liked: boolean, disliked: boolean) => void
  isRedirectingToHuman?: boolean
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = String(code || "").replace(/\n+$/, "")
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="relative bg-gray-100 rounded-xl p-3 my-2">
      <button
        type="button"
        onClick={handleCopy}
        className={[
          "absolute top-2 right-2 p-2 rounded-lg transition-all duration-300 ease-out active:scale-90",
          copied ? "text-green-600 bg-white/70" : "text-gray-500 hover:text-gray-700 bg-white/50 hover:bg-white/70",
        ].join(" ")}
        title={copied ? "Copiado!" : "Copiar código"}
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
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>

      <pre className="font-mono text-[12px] leading-relaxed whitespace-pre overflow-x-auto pr-10 text-gray-900">
        <code>{code}</code>
      </pre>
    </div>
  )
}

const categoriesData: Category[] = [
  {
    id: "Ajuda",
    label: "Ajuda",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-2 2-2 4" />
        <path d="M12 17h.01" />
      </svg>
    ),
    actions: [
      { id: "help-support", label: "Preciso de ajuda com urgencia." },
      { id: "site-ssl", label: "Falar com um atendente Wyzer." },
      { id: "site-backup", label: "Onde posso acessar a documentacao?" },
      { id: "site-performance", label: "Verificar Termos e Politica de Privacidade" },
    ],
  },
  {
    id: "Duvidas",
    label: "Duvidas",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      { id: "email-smtp", label: "Como verificar se ha instabilidade no sistema?" },
      { id: "email-encaminhamento", label: "Relatar um problema em nosso sistema." },
    ],
  },
  {
    id: "Seguranca",
    label: "Seguranca",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="11" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        <path d="M12 16v2" />
      </svg>
    ),
    actions: [
      { id: "wz_att_dados_c", label: "Como atualizar dados cadastrais?" },
      { id: "wz_mudar_email_conta", label: "Posso mudar o email da minha conta?" },
      { id: "wz_ativar_2fa", label: "Como ativar verificacao de 2 etapas?" },
      { id: "wz_alterar_senha", label: "Alterar minha senha" },
    ],
  },
  {
    id: "Reembolsos",
    label: "Reembolsos",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
    actions: [
      { id: "wz_realizar_reembolso", label: "Consigo realizar um reembolso?" },
      { id: "wz_historico_de_pagamentos", label: "Solicitar historico de pagamentos" },
      { id: "wz_verficar_uma_cobranca", label: "Verificar uma cobranca" },
      { id: "wz_atualzar_cartao_de_credito", label: "Como atualizar meu cartao de credito?" },
    ],
  },
]

const cssAnimations = `
@keyframes dotBounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}
@keyframes shimmerSlide { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes sparkleRotate { 0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; } 50% { transform: scale(1.2) rotate(180deg); opacity: 0.8; } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes slideInFromBottom { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
`

function AnimatedDots() {
  return (
    <span className="inline-flex items-end ml-0.5 h-4">
      <span className="inline-block w-1 h-1 bg-gray-500 rounded-full mx-[1px]" style={{ animation: "dotBounce 1.4s ease-in-out infinite", animationDelay: "0ms" }} />
      <span className="inline-block w-1 h-1 bg-gray-500 rounded-full mx-[1px]" style={{ animation: "dotBounce 1.4s ease-in-out infinite", animationDelay: "200ms" }} />
      <span className="inline-block w-1 h-1 bg-gray-500 rounded-full mx-[1px]" style={{ animation: "dotBounce 1.4s ease-in-out infinite", animationDelay: "400ms" }} />
    </span>
  )
}

function ShimmerText({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-gray-500"
      style={{
        background: "linear-gradient(90deg, #6b7280 0%, #6b7280 40%, #d1d5db 50%, #6b7280 60%, #6b7280 100%)",
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

// LoadingMessage com texto dinamico
function LoadingMessage({ isRedirectingToHuman = false }: { isRedirectingToHuman?: boolean }) {
  const loadingText = isRedirectingToHuman 
    ? "Redirecionando para um atendente" 
    : "Analisando sua solicitacao"

  return (
    <div className="flex items-start gap-3" style={{ animation: "fadeInUp 0.5s ease-out forwards" }}>
      <div className="flex-shrink-0 w-8 h-8 overflow-hidden flex items-center justify-center">
        <img src="/flow-icon.png" alt="Flow" className="w-full h-full object-cover" loading="lazy" draggable={false} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-900">Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={isRedirectingToHuman ? "text-orange-500" : "text-black"} style={{ animation: "sparkleRotate 2s ease-in-out infinite" }}>
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
          </svg>
          <span className="text-sm flex items-end">
            <ShimmerText>{loadingText}</ShimmerText>
            <div className="mt-1">
              <AnimatedDots />
            </div>
          </span>
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
    <div className={`mt-2 flex gap-2 ${images.length === 1 ? "justify-end" : ""}`}>
      {images.map((img) => (
        <button
          key={img.id}
          type="button"
          onClick={() => onImageClick?.(img)}
          className={[
            "rounded-xl overflow-hidden transition-all duration-300 ease-out",
            "hover:ring-2 hover:ring-black hover:scale-[1.02] active:scale-[0.98]",
            images.length === 1 ? "max-w-[200px]" : "w-[calc(50%-4px)] max-w-[150px]",
          ].join(" ")}
        >
          <img src={img.preview || "/placeholder.svg"} alt={img.file.name} className="w-full h-auto object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  )
}

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
      <div className="mt-6 -ml-11" style={{ animation: "fadeInUp 0.6s ease-out forwards" }}>
        <p className="text-xs text-gray-500 mb-3 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-black" style={{ animation: "sparkleRotate 1.5s ease-in-out infinite" }}>
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
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
    <div className="mt-6 -ml-11" style={{ animation: "fadeInUp 0.6s ease-out forwards" }}>
      <p className="text-xs text-gray-500 mb-3">Sugestoes</p>
      <div className="space-y-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            type="button"
            onClick={() => onSuggestionClick?.(suggestion.text)}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-all duration-300 ease-out hover:translate-x-1 active:scale-[0.98]"
            style={{ animation: "slideInFromBottom 0.5s ease-out forwards", animationDelay: `${index * 100}ms`, opacity: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-500 flex-shrink-0">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
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
  lastBotMessage,
  onSuggestionClick,
  onEnsureBottom,
  isLoginRequired,
  onLoginClick,
  dbId,
  liked,
  disliked,
  onReactMessage,
  isStreaming,
}: {
  content: string
  showSuggestions: boolean
  lastBotMessage: string
  onSuggestionClick?: (text: string) => void
  onEnsureBottom?: (behavior?: ScrollBehavior) => void
  isLoginRequired?: boolean
  onLoginClick?: () => void
  dbId?: number
  liked?: boolean
  disliked?: boolean
  onReactMessage?: (dbId: number, liked: boolean, disliked: boolean) => void
  isStreaming?: boolean
}) {
  const [suggestionsVisible, setSuggestionsVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const hasGeneratedRef = useRef(false)

  const generateAISuggestions = useCallback(async (botResponse: string) => {
    if (hasGeneratedRef.current) return
    hasGeneratedRef.current = true
    setIsLoadingAI(true)

    try {
      const tryOnce = async () => {
        const response = await fetch("/api/wz_WyzerAI/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastBotResponse: botResponse }),
        })
        return response
      }

      let response = await tryOnce()
      if (!response.ok) {
        await new Promise((r) => setTimeout(r, 350))
        response = await tryOnce()
      }

      if (response.ok) {
        const data = await response.json()
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(
            data.suggestions.map((text: string, i: number) => ({ id: `ai-${i}`, text }))
          )
        }
      }
    } catch {
      setSuggestions([])
    } finally {
      setIsLoadingAI(false)
    }
  }, [])

  useEffect(() => {
    if (!showSuggestions) return
    if (isLoginRequired) return
    if (isStreaming) return

    const timer = setTimeout(() => {
      setSuggestionsVisible(true)
      generateAISuggestions(lastBotMessage)
      requestAnimationFrame(() => onEnsureBottom?.("smooth"))
    }, 1400)

    return () => clearTimeout(timer)
  }, [
    showSuggestions,
    lastBotMessage,
    generateAISuggestions,
    isLoginRequired,
    isStreaming,
    onEnsureBottom,
  ])

  useEffect(() => {
    if (!showSuggestions) return
    if (!suggestionsVisible) return
    if (isLoginRequired) return
    if (isStreaming) return

    const raf = requestAnimationFrame(() => onEnsureBottom?.("smooth"))
    return () => cancelAnimationFrame(raf)
  }, [
    showSuggestions,
    suggestionsVisible,
    suggestions.length,
    isLoadingAI,
    isLoginRequired,
    isStreaming,
    onEnsureBottom,
  ])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canReact = typeof dbId === "number" && !!onReactMessage && !isLoginRequired && !isStreaming

  const richBlocks = useMemo(() => parseAssistantBlocks(content || ""), [content])
  const richContent = useMemo(
    () =>
      richBlocks.map((b, i) => {
        if (b.kind === "code") {
          return <CodeBlock key={`cb_${i}`} code={b.code} />
        }
        return <React.Fragment key={`ct_${i}`}>{renderInlineRichText(b.text || "", 0, `rt_${i}`)}</React.Fragment>
      }),
    [richBlocks]
  )

  const handleLike = () => {
    if (!canReact) return
    const nextLiked = !(!!liked)
    const nextDisliked = nextLiked ? false : !!disliked
    onReactMessage!(dbId!, nextLiked, nextDisliked)
  }

  const handleDislike = () => {
    if (!canReact) return
    const nextDisliked = !(!!disliked)
    const nextLiked = nextDisliked ? false : !!liked
    onReactMessage!(dbId!, nextLiked, nextDisliked)
  }

  // ✅ CORRIGIDO: Não mostrar "Analisando" dentro de BotMessage - apenas mostrar o conteúdo ou cursor
  const showContent = content && content.length > 0

  return (
    <div className="flex items-start gap-3" style={{ animation: "fadeInUp 0.5s ease-out forwards" }}>
      <div className="flex-shrink-0 w-8 h-8 overflow-hidden flex items-center justify-center">
        <img src="/flow-icon.png" alt="Flow" className="w-full h-full object-cover" loading="lazy" draggable={false} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-900">Flow</span>
        </div>

        {showContent ? (
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" style={{ animation: "fadeIn 0.3s ease-out forwards" }}>
            {richContent}
            {isStreaming && <span className="inline-block w-2 h-4 bg-gray-400 ml-0.5 animate-pulse" />}
          </div>
        ) : isStreaming ? (
          // Cursor piscando enquanto aguarda conteúdo
          <div className="flex items-center">
            <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse" />
          </div>
        ) : null}

        {isLoginRequired && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onLoginClick}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-black/80 hover:bg-black/[0.02] transition-colors"
            >
              Realizar login
            </button>
          </div>
        )}

        {!isLoginRequired && showContent && !isStreaming && (
          <div className="flex items-center gap-1 mt-3">
            <button
              type="button"
              onClick={handleLike}
              disabled={!canReact}
              className={[
                "p-1.5 rounded-full transition-all duration-300 ease-out active:scale-90",
                !canReact ? "opacity-40 cursor-not-allowed" : "",
                liked ? "text-black bg-black/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
              ].join(" ")}
              title={!canReact ? "Sincronizando..." : "Gostei"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleDislike}
              disabled={!canReact}
              className={[
                "p-1.5 rounded-full transition-all duration-300 ease-out active:scale-90",
                !canReact ? "opacity-40 cursor-not-allowed" : "",
                disliked ? "text-red-500 bg-red-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
              ].join(" ")}
              title={!canReact ? "Sincronizando..." : "Não gostei"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={disliked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={[
                "p-1.5 rounded-full transition-all duration-300 ease-out active:scale-90",
                copied ? "text-green-500 bg-green-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
              ].join(" ")}
              title={copied ? "Copiado!" : "Copiar mensagem"}
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
          </div>
        )}

        {!isLoginRequired && showSuggestions && suggestionsVisible && !isStreaming && (
          <SuggestionsPanel suggestions={suggestions} isLoadingAI={isLoadingAI} onSuggestionClick={onSuggestionClick} />
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
    <div className="flex flex-col items-end" style={{ animation: "fadeInUp 0.3s ease-out forwards" }}>
      <div className="max-w-[80%] px-4 py-2.5 bg-gray-100 rounded-2xl rounded-br-md transition-all duration-300">
        <p className="text-sm text-gray-900">{content}</p>
      </div>
      {images && images.length > 0 && <MessageImages images={images} onImageClick={onImageClick} />}
    </div>
  )
}

function ConversationSkeleton() {
  const rows = [
    { side: "left", lines: ["w-16", "w-[78%]", "w-[56%]"] },
    { side: "right", lines: ["w-[62%]", "w-[40%]"] },
    { side: "left", lines: ["w-16", "w-[72%]", "w-[48%]"] },
    { side: "right", lines: ["w-[58%]", "w-[36%]"] },
  ] as const

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <style>{cssAnimations}</style>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 py-4 space-y-6 animate-pulse">
          {rows.map((row, idx) => (
            <div
              key={`skeleton-row-${idx}`}
              className={row.side === "right" ? "flex justify-end" : "flex items-start gap-3"}
            >
              {row.side === "left" ? (
                <>
                  <span className="h-8 w-8 shrink-0 rounded-full bg-gray-200" />
                  <div className="min-w-0 flex-1 space-y-2">
                    {row.lines.map((line, lineIdx) => (
                      <div
                        key={`skeleton-line-${idx}-${lineIdx}`}
                        className={`h-3 rounded-md bg-gray-200 ${line}`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gray-100 px-4 py-3">
                  <div className="space-y-2">
                    {row.lines.map((line, lineIdx) => (
                      <div
                        key={`skeleton-line-${idx}-${lineIdx}`}
                        className={`ml-auto h-3 rounded-md bg-gray-200 ${line}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
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
          <div className="mb-6" style={{ animation: "scaleIn 0.6s ease-out forwards" }}>
            <img
              src="/flow-icon.png"
              alt="Logo"
              className="h-20 w-auto object-contain drop-shadow-lg transition-transform duration-500 hover:scale-105"
              loading="lazy"
              draggable={false}
            />
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-2 text-center" style={{ animation: "fadeInUp 0.5s ease-out 0.1s forwards", opacity: 0 }}>
            {"Olá! " + "Bem Vindo"}
          </h1>
          <p className="text-gray-500 text-base text-center" style={{ animation: "fadeInUp 0.5s ease-out 0.2s forwards", opacity: 0 }}>
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
                  hoveredAction === action.id ? "bg-gray-50 translate-x-1" : "bg-transparent",
                ].join(" ")}
                style={{ animation: "fadeInUp 0.5s ease-out forwards", animationDelay: `${300 + index * 80}ms`, opacity: 0 }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={[
                    "flex-shrink-0 transition-colors duration-300",
                    hoveredAction === action.id ? "text-black" : "text-gray-400",
                  ].join(" ")}
                >
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
                </svg>
                <span className="text-sm text-gray-700 flex-1">{action.label}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={["flex-shrink-0 transition-all duration-300", hoveredAction === action.id ? "text-gray-600 translate-x-0.5" : "text-gray-300"].join(" ")}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4" style={{ animation: "fadeInUp 0.5s ease-out 0.6s forwards", opacity: 0 }}>
          <div className="flex flex-wrap gap-2">
            {categoriesData.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium",
                  "transition-all duration-300 ease-out active:scale-95",
                  activeCategory === category.id ? "bg-gray-900 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
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
  messages = [],
  isLoading = false,
  isConversationLoading = false,
  streamingContent = "",
  onImageClick,
  onLoginClick,
  onReactMessage,
  isRedirectingToHuman = false,
}: MainProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasMessages = messages.length > 0
  const prevMessagesLengthRef = useRef(0)
  const prevStreamingContentRef = useRef(streamingContent)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  const lastBotMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant" && !messages[i]?.isStreaming) return messages[i].content || ""
    }
    return ""
  }, [messages])

  // Auto-scroll melhorado: sempre rola para baixo quando:
  // 1. Nova mensagem foi adicionada
  // 2. Conteudo streaming mudou
  // 3. isLoading mudou para true
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const messagesChanged = messages.length !== prevMessagesLengthRef.current
    const streamingChanged = streamingContent !== prevStreamingContentRef.current

    // Atualizar refs
    prevMessagesLengthRef.current = messages.length
    prevStreamingContentRef.current = streamingContent

    // Se houve mudanca, rolar para baixo suavemente
    if (messagesChanged || streamingChanged || isLoading) {
      // Usar requestAnimationFrame para garantir que o DOM foi atualizado
      requestAnimationFrame(() => {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: streamingChanged ? "auto" : "smooth"
        })
      })
    }
  }, [messages, isLoading, streamingContent])

  if (isConversationLoading) {
    return <ConversationSkeleton />
  }

  if (!hasMessages && !isLoading) {
    return <WelcomeScreen userName={userName} logoSrc={logoSrc} onQuickAction={onQuickAction} />
  }

  // ✅ CORRIGIDO: Verificar se existe mensagem streaming COM conteúdo
  const streamingMessageWithContent = messages.find(m => m.isStreaming && m.content && m.content.length > 0)
  const hasStreamingContent = !!streamingMessageWithContent

  // ✅ Mostrar LoadingMessage quando:
  // 1. isLoading = true (está enviando)
  // 2. NÃO tem mensagem streaming COM conteúdo (ainda não começou a receber texto)
  const shouldShowLoading = isLoading && !hasStreamingContent

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <style>{cssAnimations}</style>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 py-4 space-y-6">
          {messages.map((message, index) => {
            const isLastAssistant =
              message.role === "assistant" &&
              index === messages.length - 1 &&
              !message.isStreaming &&
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

            // ✅ Não renderizar BotMessage streaming sem conteúdo (o LoadingMessage cobre isso)
            if (message.isStreaming && (!message.content || message.content.length === 0)) {
              return null
            }

            return (
              <BotMessage
                key={message.id}
                content={message.content}
                showSuggestions={isLastAssistant}
                lastBotMessage={lastBotMessage}
                onSuggestionClick={onQuickAction}
                onEnsureBottom={scrollToBottom}
                isLoginRequired={message.kind === "login_required"}
                onLoginClick={onLoginClick}
                dbId={message.dbId}
                liked={message.liked}
                disliked={message.disliked}
                onReactMessage={onReactMessage}
                isStreaming={!!message.isStreaming}
              />
            )
          })}

          {/* ✅ CORRIGIDO: Mostra "Analisando sua solicitação" enquanto aguarda resposta */}
          {shouldShowLoading && (
            <LoadingMessage isRedirectingToHuman={isRedirectingToHuman} />
          )}
        </div>
      </div>
    </div>
  )
}
