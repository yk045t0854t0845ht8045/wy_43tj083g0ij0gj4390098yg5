"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Header } from "./_components/header"
import { Main } from "./_components/main"
import { History } from "./_components/history"
import { Input } from "./_components/input"

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

function decodeMsgParam(v: string) {
  const raw = String(v || "")
  const plusFixed = raw.replace(/\+/g, " ")
  let dec = plusFixed
  try {
    dec = decodeURIComponent(plusFixed)
  } catch {
    // ignore
  }
  if (dec.includes("-") && !dec.includes(" - ")) {
    dec = dec.replace(/-/g, " ")
  }
  return dec.trim()
}

function clampText(v: string, max = 2000) {
  const s = String(v || "").trim()
  if (!s) return ""
  return s.length > max ? s.slice(0, max) : s
}

function compactText(v: string, maxChars = 220) {
  return String(v || "")
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, maxChars)
}

const cssAnimations = `
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

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
`

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
}

function TranscriptModal({
  isOpen,
  onClose,
  messages,
}: {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
}) {
  const [copied, setCopied] = useState(false)
  const transcriptId = useMemo(() => uid().slice(0, 8), [])
  const shareUrl = `https://wyzer.com.br/transcript/${transcriptId}`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <>
      <style>{cssAnimations}</style>
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "fadeIn 0.2s ease-out forwards" }}
      />

      <div
        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
          onClick={(e) => e.stopPropagation()}
          style={{ animation: "scaleIn 0.3s ease-out forwards" }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Salvar Transcript
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 active:scale-90"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Compartilhe este link para visualizar a conversa:
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 truncate ring-1 ring-gray-200">
                {shareUrl}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={[
                  "p-3 rounded-xl transition-all duration-300 ease-out active:scale-90",
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-gray-900 text-white hover:bg-gray-800",
                ].join(" ")}
              >
                {copied ? (
                  <svg
                    width="20"
                    height="20"
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
                    width="20"
                    height="20"
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

            <p className="text-xs text-gray-400">
              {messages.length} mensagens nesta conversa
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function ImageViewerModal({
  image,
  onClose,
}: {
  image: AttachedFile | null
  onClose: () => void
}) {
  if (!image) return null

  return (
    <>
      <style>{cssAnimations}</style>
      <div
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "fadeIn 0.2s ease-out forwards" }}
      />

      <div
        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <img
          src={image.preview || "/placeholder.svg"}
          alt={image.file.name}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          style={{ animation: "scaleIn 0.3s ease-out forwards" }}
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all duration-200 active:scale-90"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </>
  )
}

export function WyzerAIWidget() {
  const SESSION_KEY = "wyzerai.session.v1"
  const EDGE = 0

  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState("")
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat")
  const [animPhase, setAnimPhase] = useState<"closed" | "opening" | "open">(
    "closed"
  )
  const [isMobile, setIsMobile] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [showTranscriptModal, setShowTranscriptModal] = useState(false)
  const [viewingImage, setViewingImage] = useState<AttachedFile | null>(null)
  const [streamingContent, setStreamingContent] = useState("")

  // ✅ só vira true depois que o servidor confirmou 401
  const [needsLogin, setNeedsLogin] = useState(false)

  const cardRef = useRef<HTMLDivElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const CHAT_RESTORE_KEY = "wyzer_chat_restore_v1"

  function getLoginBaseUrl() {
    if (typeof window === "undefined") return "/"

    const host = window.location.hostname.toLowerCase()

    if (host.endsWith(".localhost") || host === "localhost") {
      return "http://login.localhost:3000/"
    }

    return "https://login.wyzer.com.br/"
  }

  function saveChatRestoreState(payload: any) {
    try {
      sessionStorage.setItem(CHAT_RESTORE_KEY, JSON.stringify(payload))
    } catch {}
  }

  function readChatRestoreState(): any | null {
    try {
      const raw = sessionStorage.getItem(CHAT_RESTORE_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function clearChatRestoreState() {
    try {
      sessionStorage.removeItem(CHAT_RESTORE_KEY)
    } catch {}
  }

  const apiFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const merged: RequestInit = {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(init?.headers || {}),
      },
    }
    return fetch(input, merged)
  }, [])

  const [chatCode, setChatCode] = useState<string>("")
  const [historyItems, setHistoryItems] = useState<
    Array<{ id: string; preview: string; timestamp: string; isOnline?: boolean }>
  >([])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const goToLogin = useCallback(() => {
    if (typeof window === "undefined") return

    const returnTo = window.location.href
    const scrollY = window.scrollY || 0

    saveChatRestoreState({
      returnTo,
      scrollY,
      open: true,
      activeTab,
      chatCode,
    })

    const loginBase = getLoginBaseUrl()
    const url = new URL(loginBase)
    url.searchParams.set("returnTo", returnTo)

    window.location.assign(url.toString())
  }, [activeTab, chatCode])

  // ✅ injeta “login required” só quando realmente precisar (401)
  const ensureLoginMessage = useCallback(() => {
    setMessages((prev) => {
      const already = prev.some((m) => m.kind === "login_required")
      if (already) return prev
      return [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          kind: "login_required",
          content: "Para continuar, faça login na sua conta.",
        },
      ]
    })
  }, [])

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "server"
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const s = `wz_${uid()}`
    window.localStorage.setItem(SESSION_KEY, s)
    return s
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const restore = readChatRestoreState()
    if (!restore?.returnTo) return

    const current = window.location.href

    if (
      !current.startsWith(
        String(restore.returnTo).split("#")[0].split("?")[0]
      )
    ) {
      return
    }

    setOpen(true)
    if (restore.activeTab) setActiveTab(restore.activeTab)
    if (restore.chatCode) setChatCode(String(restore.chatCode))

    const y = Number(restore.scrollY || 0)
    requestAnimationFrame(() => window.scrollTo(0, y))

    clearChatRestoreState()
  }, [])

  // ✅ importante: NÃO setar needsLogin e nem travar UI aqui
  //    só inicia chat quando possível; se 401, só marca pra depois do user tentar usar
  const startChat = useCallback(async () => {
    const r = await apiFetch("/api/wz_WyzerAI/chat/start", { method: "POST" })

    if (r.status === 401) {
      // ✅ não mostra nada na UI ao abrir
      return null
    }

    if (!r.ok) return null
    const data = await r.json().catch(() => ({}))
    if (!data?.chatCode) return null
    return String(data.chatCode)
  }, [apiFetch])

  const loadHistory = useCallback(async () => {
    const r = await apiFetch("/api/wz_WyzerAI/chat/list")
    if (r.status === 401) {
      // ✅ não trava nem mostra nada — histórico é opcional
      return
    }
    if (!r.ok) return

    const data = await r.json().catch(() => ({}))
    const chats = Array.isArray(data?.chats) ? data.chats : []

    setHistoryItems(
      chats.map((c: any) => ({
        id: String(c.chat_code),
        preview: String(c.motivo || "Atendimento sem motivo ainda"),
        timestamp: new Date(c.updated_at || c.created_at).toLocaleString(
          "pt-BR"
        ),
        isOnline: false,
      }))
    )
  }, [apiFetch])

  const loadChatMessages = useCallback(async (code: string) => {
    const r = await apiFetch(
      `/api/wz_WyzerAI/chat/messages?code=${encodeURIComponent(code)}`
    )

    if (r.status === 401) {
      // ✅ não trava UI; só impede envio quando confirmar 401 no POST
      return
    }
    if (!r.ok) return

    const data = await r.json().catch(() => ({}))
    const rows = Array.isArray(data?.messages) ? data.messages : []

    const mapped = rows.map((m: any) => ({
      id: String(m.id),
      role: m.sender === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.message || ""),
      images: undefined,
      kind: undefined,
    }))

    setMessages(mapped)
  }, [apiFetch])

  const openWithMessage = useCallback(
    async (message?: string) => {
      setOpen(true)
      setActiveTab("chat")

      // tenta iniciar, mas se deslogado, segue “normal”
      const code = await startChat()

      if (code) {
        setChatCode(code)
        loadHistory()
      }

      const m = clampText(message || "")
      if (m) setInput(m)
    },
    [startChat, loadHistory]
  )

  const applyUrlTriggers = useCallback(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const shouldOpen =
      url.searchParams.get("wyzerai") === "1" ||
      url.searchParams.get("openwyzerai") === "1" ||
      url.searchParams.get("wyzer") === "1"

    const msg_s = url.searchParams.get("msg_s") || url.searchParams.get("msg") || ""
    const decoded = msg_s ? decodeMsgParam(msg_s) : ""

    if (shouldOpen) {
      openWithMessage(decoded || "")
    }
  }, [openWithMessage])

  useEffect(() => {
    applyUrlTriggers()
    const onPop = () => applyUrlTriggers()
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [applyUrlTriggers])

  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ message?: string }>
      const message = ce?.detail?.message || ""
      openWithMessage(message)
    }
    window.addEventListener("wyzerai:open", handler)
    return () => window.removeEventListener("wyzerai:open", handler)
  }, [openWithMessage])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const el = target.closest<HTMLElement>("[data-wyzerai-open]")
      if (!el) return
      const isLink = el.tagName.toLowerCase() === "a"
      if (isLink) e.preventDefault()
      const msgAttr = el.getAttribute("data-wyzerai-msg") || ""
      const msgDecoded = msgAttr ? decodeMsgParam(msgAttr) : ""
      openWithMessage(msgDecoded)
    }
    document.addEventListener("click", onClick, { capture: true })
    return () =>
      document.removeEventListener("click", onClick, { capture: true })
  }, [openWithMessage])

  useEffect(() => {
    if (!open) {
      setAnimPhase("closed")
      return
    }
    setAnimPhase("opening")
    const t1 = window.setTimeout(() => setAnimPhase("open"), 520)
    return () => window.clearTimeout(t1)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewingImage) {
          setViewingImage(null)
        } else if (showTranscriptModal) {
          setShowTranscriptModal(false)
        } else {
          setOpen(false)
        }
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      if (isMobile) return
      if (showTranscriptModal || viewingImage) return

      const card = cardRef.current
      if (!card) return
      const target = e.target as Node | null
      if (!target) return
      if (card.contains(target)) return
      setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onPointerDown, { capture: true })
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      })
    }
  }, [open, isMobile, showTranscriptModal, viewingImage])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const callWyzerAI = useCallback(
    async (nextMessages: Message[]) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        const lastTwo = nextMessages.slice(-2)

        const payload = {
          sessionId,
          chatCode,
          messages: lastTwo.map((m) => ({
            role: m.role,
            content: compactText(m.content, 220),
            images: m.images ? m.images : undefined,
          })),
        }

        const resp = await apiFetch("/api/wz_WyzerAI", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        })

        if (resp.status === 401) {
          // ✅ só aqui confirmamos que precisa login
          setNeedsLogin(true)
          ensureLoginMessage()
          return { ok: false as const, message: null }
        }

        if (!resp.ok) {
          return {
            ok: false as const,
            message: "Erro ao processar sua mensagem. Tente novamente.",
          }
        }

        const reader = resp.body?.getReader()
        if (!reader) {
          return {
            ok: false as const,
            message: "Erro ao ler resposta do servidor.",
          }
        }

        const decoder = new TextDecoder()
        let fullContent = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          fullContent += chunk
          setStreamingContent(fullContent)
        }

        const trimmed = fullContent.trim()

        if (!trimmed) {
          return {
            ok: false as const,
            message: "Desculpe, não consegui gerar uma resposta.",
          }
        }

        return {
          ok: true as const,
          message: trimmed,
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return {
            ok: false as const,
            message: null,
          }
        }
        return {
          ok: false as const,
          message: "Erro de conexão. Por favor, tente novamente.",
        }
      }
    },
    [apiFetch, sessionId, chatCode, ensureLoginMessage]
  )

  const handleSubmit = useCallback(
    async (files?: AttachedFile[]) => {
      // ✅ se já confirmou 401 antes, não envia mais; só garante a msg no chat
      if (needsLogin) {
        ensureLoginMessage()
        return
      }

      if ((!input.trim() && (!files || files.length === 0)) || sending || isLoading)
        return

      const userMessage: Message = {
        id: uid(),
        role: "user",
        content: input.trim() || (files && files.length > 0 ? "[Imagem]" : ""),
        images: files && files.length > 0 ? [...files] : undefined,
      }

      setSending(true)
      setIsLoading(true)
      setStreamingContent("")
      setInput("")
      setAttachedFiles([])

      const nextMessages = [...messages, userMessage]
      setMessages(nextMessages)

      const result = await callWyzerAI(nextMessages)

      if (result.message) {
        const botMessage: Message = {
          id: uid(),
          role: "assistant",
          content: result.message,
        }
        setMessages((prev) => [...prev, botMessage])
      }

      setStreamingContent("")
      setIsLoading(false)
      setSending(false)
    },
    [needsLogin, input, sending, isLoading, messages, callWyzerAI, ensureLoginMessage]
  )

  const handleQuickAction = useCallback((action: string) => {
    setInput(action)
  }, [])

  const handleGoBack = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    // ✅ voltar “limpo”, não força login na UI
    setNeedsLogin(false)
    setInput("")
    setMessages([])
    setIsLoading(false)
    setSending(false)
    setStreamingContent("")
    setAttachedFiles([])
    setActiveTab("chat")
  }, [])

  const handleNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setNeedsLogin(false)
    setInput("")
    setMessages([])
    setIsLoading(false)
    setSending(false)
    setStreamingContent("")
    setAttachedFiles([])
  }, [])

  const handleHistoryItemClick = useCallback(
    async (item?: { id: string }) => {
      const code = item?.id
      if (!code) return
      setChatCode(code)
      await loadChatMessages(code)
      setActiveTab("chat")
    },
    [loadChatMessages]
  )

  return (
    <div className="fixed bottom-4 right-4 z-[90]">
      <style>{cssAnimations}</style>

      {!open && (
        <button
          type="button"
          onClick={() => openWithMessage("")}
          className="group relative inline-flex rounded-full p-[2px] select-none
      focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20
      transition-transform duration-500 ease-out
      hover:scale-[1.03] active:scale-[0.985]"
          style={{ animation: "slideInFromRight 0.5s ease-out forwards" }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              padding: "2px",
              background:
                "conic-gradient(from var(--a), transparent 0 18%, #3b82f6 18% 36%, #a855f7 36% 54%, #f97316 54% 72%, #22c55e 72% 90%, #06b6d4 90% 100%)",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />

          <span
            className="relative inline-flex items-center gap-3 rounded-full bg-white px-5 py-3
        shadow-[0_10px_30px_rgba(0,0,0,0.12)]
        ring-1 ring-black/5
        transition-shadow duration-500 ease-out
        group-hover:shadow-[0_16px_52px_rgba(0,0,0,0.16)]"
          >
            <img
              src="/flow-icon.png"
              alt="Flow"
              className="h-6 w-6 object-contain transition-transform duration-500 ease-out group-hover:scale-110"
              loading="lazy"
              draggable={false}
            />
            <span className="text-sm font-medium text-neutral-900">
              Pergunte ao Flow
            </span>
          </span>
        </button>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-[94] bg-black/20 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none"
            style={{ animation: "fadeIn 0.3s ease-out forwards" }}
            aria-hidden="true"
          />

          <div
            ref={cardRef}
            className={[
              "fixed z-[95] flex flex-col overflow-hidden",
              "bg-white shadow-[0_18px_70px_rgba(0,0,0,0.28)] ring-1 ring-black/10",
              "origin-bottom-right will-change-transform",
              "inset-0 w-full h-full rounded-none",
              "sm:inset-auto sm:rounded-[28px] sm:w-[min(460px,calc(100vw-28px))] sm:h-[calc(100vh-28px)]",
            ].join(" ")}
            style={{
              WebkitTapHighlightColor: "transparent",
              ...(typeof window !== "undefined" && !isMobile
                ? {
                    right: `max(${EDGE + 14}px, env(safe-area-inset-right))`,
                    bottom: `max(${EDGE + 14}px, env(safe-area-inset-bottom))`,
                    top: `max(${EDGE + 14}px, env(safe-area-inset-top))`,
                  }
                : {}),
              transform:
                animPhase === "closed"
                  ? "translate3d(0,0,0) scale(0.35)"
                  : animPhase === "opening"
                    ? "translate3d(0,0,0) scale(1.02)"
                    : "translate3d(0,0,0) scale(1)",
              borderRadius: isMobile ? 0 : animPhase === "opening" ? 40 : 28,
              transition:
                "transform 560ms cubic-bezier(.2,.9,.2,1), border-radius 560ms cubic-bezier(.2,.9,.2,1)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(140px 90px at 85% 14%, rgba(0,0,0,0.05), transparent 62%), radial-gradient(220px 160px at 18% -6%, rgba(0,0,0,0.04), transparent 58%)",
                opacity: animPhase === "open" ? 1 : 0.98,
                transition: "opacity 420ms ease",
              }}
            />

            <Header
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onGoBack={handleGoBack}
              onNewChat={handleNewChat}
              onClose={() => setOpen(false)}
              onSaveTranscript={() => setShowTranscriptModal(true)}
              hasMessages={messages.length > 0}
            />

            <div className="flex-1 flex flex-col overflow-hidden relative">
              {activeTab === "chat" ? (
                <Main
                  userName="Usuario"
                  onQuickAction={handleQuickAction}
                  logoSrc="/logo.png"
                  botAvatarSrc="/flow-icon.png"
                  messages={messages}
                  isLoading={isLoading}
                  streamingContent={streamingContent}
                  onImageClick={setViewingImage}
                  onLoginClick={goToLogin}
                />
              ) : (
                <History items={historyItems} onItemClick={handleHistoryItemClick} />
              )}
            </div>

            <Input
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              // ✅ input NÃO trava ao abrir deslogado
              //    só trava depois do 401 confirmado (needsLogin = true)
              disabled={sending || isLoading || needsLogin}
              placeholder={needsLogin ? "Faça login para continuar" : "Ask anything"}
              attachedFiles={attachedFiles}
              onFilesChange={setAttachedFiles}
            />
          </div>

          <TranscriptModal
            isOpen={showTranscriptModal}
            onClose={() => setShowTranscriptModal(false)}
            messages={messages}
          />

          <ImageViewerModal
            image={viewingImage}
            onClose={() => setViewingImage(null)}
          />
        </>
      )}
    </div>
  )
}

export default function WyzerAIPage() {
  return <WyzerAIWidget />
}
