// app/api/wz_WyzerAI/route.ts
import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { headers } from "next/headers"
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session"
import { supabaseAdmin } from "@/app/api/_supabaseAdmin"

// ═══════════════════════════════════════════════════════════════════════════════
// WYZER AI - ENTERPRISE BACKEND v5.0 - OTIMIZADO TPM
// - Usa APENAS a última mensagem (sem histórico) para economizar tokens
// - Fallback automático quando projeto não tem acesso ao modelo
// - Sempre responde text/plain no chat
// - Salva chat + mensagens por chatCode
// - Gera "motivo" após 2 primeiras mensagens do usuário
// ═══════════════════════════════════════════════════════════════════════════════

export const maxDuration = 60

const openai = createOpenAI({})

const CONFIG = {
  MAX_INPUT_CHARS: 300, // ✅ Reduzido de 500 para 300
  MAX_HISTORY_MESSAGES: 1, // ✅ Reduzido de 4 para 1 (usa só a última)
  MAX_OUTPUT_TOKENS: 120, // ✅ Reduzido de 150 para 120

  CACHE_TTL_MS: 10 * 60 * 1000, // Cache por 10 minutos
  MAX_CACHE_SIZE: 200,
} as const

const MODEL_FALLBACKS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-5-mini",
  "gpt-5-nano",
] as const

// ✅ MELHORADO: System prompt mais inteligente e conciso
const SYSTEM_PROMPT = `Você é Flow, assistente virtual da Wyzer.

REGRAS IMPORTANTES:
1. Responda em português brasileiro
2. Seja MUITO conciso (máximo 2 frases)
3. Seja útil, amigável e direto
4. Se não souber, diga que vai verificar
5. NUNCA gere código ou scripts
6. Para perguntas fora do escopo, diga que não pode ajudar com isso

SOBRE A WYZER:
- Plataforma de automação para WhatsApp
- Planos: Starter R$89/mês, PRO R$149/mês, Enterprise sob consulta
- Suporte: seg-sex 9h-18h
- Funcionalidades: chatbots, atendimento múltiplo, integração API
- Teste grátis por 7 dias disponível

TEMAS QUE VOCÊ DOMINA:
- Planos e preços
- Como conectar WhatsApp
- Problemas de conexão
- Configuração de chatbots
- Dúvidas sobre pagamentos e reembolsos
- Suporte técnico básico`

// ─────────────────────────────────────────────────────────────────────────────
// CACHE INTELIGENTE
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  response: string
  timestamp: number
  hits: number
}

const responseCache = new Map<string, CacheEntry>()

function normalizeForCache(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) // Reduzido para cache mais eficiente
}

function getCachedResponse(text: string): string | null {
  const key = normalizeForCache(text)
  const entry = responseCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CONFIG.CACHE_TTL_MS) {
    responseCache.delete(key)
    return null
  }
  entry.hits++
  return entry.response
}

function setCachedResponse(text: string, response: string) {
  const key = normalizeForCache(text)
  if (responseCache.size >= CONFIG.MAX_CACHE_SIZE) {
    // Remove entrada mais antiga com menos hits
    let oldestKey = ""
    let lowestScore = Infinity
    for (const [k, v] of responseCache.entries()) {
      const score = v.hits / (Date.now() - v.timestamp)
      if (score < lowestScore) {
        lowestScore = score
        oldestKey = k
      }
    }
    if (oldestKey) responseCache.delete(oldestKey)
  }
  responseCache.set(key, { response, timestamp: Date.now(), hits: 1 })
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPOSTAS RÁPIDAS EXPANDIDAS
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_RESPONSES: Record<string, string> = {
  oi: "Oi! Sou o Flow, assistente da Wyzer. Como posso te ajudar?",
  ola: "Olá! Sou o Flow, assistente da Wyzer. Como posso te ajudar?",
  "olá": "Olá! Sou o Flow, assistente da Wyzer. Como posso te ajudar?",
  hey: "Hey! Sou o Flow da Wyzer. Em que posso ajudar?",
  opa: "Opa! Sou o Flow, assistente da Wyzer. O que precisa?",
  "bom dia": "Bom dia! Sou o Flow da Wyzer. Como posso ajudar?",
  "boa tarde": "Boa tarde! Sou o Flow da Wyzer. Como posso ajudar?",
  "boa noite": "Boa noite! Sou o Flow da Wyzer. Como posso ajudar?",
  obrigado: "Por nada! Se precisar de mais alguma coisa, estou aqui.",
  obrigada: "Por nada! Se precisar de mais alguma coisa, estou aqui.",
  valeu: "Valeu! Qualquer coisa, é só chamar.",
  ok: "Perfeito! Se tiver mais dúvidas, estou por aqui.",
  entendi: "Ótimo! Se precisar de mais ajuda, me avisa.",
  tchau: "Tchau! Volte sempre que precisar. Bom dia!",
  bye: "Até mais! Estou sempre por aqui se precisar.",
}

function getQuickResponse(text: string): string | null {
  const normalized = text.toLowerCase().trim()
  return QUICK_RESPONSES[normalized] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeText(input: unknown, maxChars: number): string {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars)
}

function extractContent(message: unknown): string {
  if (!message || typeof message !== "object") return ""
  const m = message as Record<string, unknown>
  if (typeof m.content === "string") return m.content
  if (Array.isArray((m as Record<string, unknown>).parts)) {
    return ((m as Record<string, unknown>).parts as Array<{ type?: string; text?: string }>)
      .filter((p) => p && typeof p === "object" && p.type === "text")
      .map((p) => p.text || "")
      .join(" ")
  }
  return ""
}

function isModelAccessError(msg: string) {
  const lower = msg.toLowerCase()
  return (
    lower.includes("model_not_found") ||
    lower.includes("does not have access to model") ||
    lower.includes("not have access to model")
  )
}

function isRateLimitError(msg: string) {
  const lower = msg.toLowerCase()
  return (
    lower.includes("rate_limit") ||
    lower.includes("tpm") ||
    lower.includes("quota") ||
    lower.includes("too many") ||
    lower.includes("429")
  )
}

function compactText(v: string, maxChars = 150) {
  return String(v || "")
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, maxChars)
}

function createTextStream(text: string, extraHeaders?: Record<string, string>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...(extraHeaders || {}),
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TENTA STREAM COM FALLBACK DE MODELO
// ─────────────────────────────────────────────────────────────────────────────

async function streamWithModelFallback(args: {
  system: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  temperature: number
  maxOutputTokens: number
  abortSignal: AbortSignal
}): Promise<{ response: Response; usedModel: string }> {
  let lastErr: unknown = null

  for (const modelId of MODEL_FALLBACKS) {
    try {
      const result = streamText({
        model: openai(modelId),
        system: args.system,
        messages: args.messages,
        temperature: args.temperature,
        maxOutputTokens: args.maxOutputTokens,
        abortSignal: args.abortSignal,
      })

      const res = result.toTextStreamResponse()
      res.headers.set("Cache-Control", "no-store")
      res.headers.set("X-Wyzer-Source", "ai")
      res.headers.set("X-Wyzer-Model", modelId)
      return { response: res, usedModel: modelId }
    } catch (e: unknown) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)

      if (isModelAccessError(msg)) continue
      throw e
    }
  }

  throw lastErr ?? new Error("No models available for this project/key.")
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTIVO: gera após 2 primeiras mensagens do usuário
// ─────────────────────────────────────────────────────────────────────────────

async function maybeGenerateMotivo(sb: ReturnType<typeof supabaseAdmin>, chatCode: string) {
  const { data: chat } = await sb
    .from("wz_chats")
    .select("motivo")
    .eq("chat_code", chatCode)
    .maybeSingle()

  if (!chat || chat.motivo) return

  const { data: msgs } = await sb
    .from("wz_chat_messages")
    .select("sender, message, created_at")
    .eq("chat_code", chatCode)
    .eq("sender", "user")
    .order("created_at", { ascending: true })
    .limit(2)

  if (!msgs || msgs.length < 2) return

  const joined = msgs.map((m) => m.message).join(" / ")

  const sys = `Crie um motivo de atendimento em 1 frase curta (max 50 caracteres). Sem aspas, sem emojis. Português BR.`

  try {
    const { response } = await streamWithModelFallback({
      system: sys,
      messages: [{ role: "user", content: `Motivo: ${joined}` }],
      temperature: 0.2,
      maxOutputTokens: 30,
      abortSignal: new AbortController().signal,
    })

    const motivoText = await response.text()
    const motivo = sanitizeText(motivoText, 100)

    if (!motivo) return

    await sb
      .from("wz_chats")
      .update({ motivo, updated_at: new Date().toISOString() })
      .eq("chat_code", chatCode)
  } catch {
    // Ignora erro de motivo - não é crítico
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST HANDLER (persistente por chatCode)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  try {
    const h = await headers()
    const cookieHeader = h.get("cookie")
    const headerLike: { get(name: string): string | null } = { get: (n) => h.get(n) }

    const session = readSessionFromCookieHeader(cookieHeader, headerLike)
    if (!session) {
      return new Response("", {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
          "X-Wyzer-Source": "unauthorized",
        },
      })
    }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return createTextStream("Por favor, digite sua mensagem.", {
        "X-Wyzer-Source": "bad_request",
      })
    }

    const chatCode = String((body as Record<string, unknown>).chatCode || "").trim()
    if (!chatCode) {
      return createTextStream("Chat inválido. Reabra o atendimento.", {
        "X-Wyzer-Source": "missing_chat",
      })
    }

    const rawMessages = Array.isArray((body as Record<string, unknown>).messages) ? (body as Record<string, unknown>).messages as unknown[] : []
    const lastMessage = rawMessages[rawMessages.length - 1]
    const userText = sanitizeText(extractContent(lastMessage), CONFIG.MAX_INPUT_CHARS)

    const hasImage =
      !!(lastMessage && typeof lastMessage === "object" && Array.isArray((lastMessage as Record<string, unknown>).images) && ((lastMessage as Record<string, unknown>).images as unknown[]).length > 0) ||
      String((lastMessage as Record<string, unknown>)?.content || "").includes("[Imagem]")

    if (!userText) {
      return createTextStream("Por favor, digite sua mensagem.", {
        "X-Wyzer-Source": "empty",
      })
    }

    const sb = supabaseAdmin()

    // valida se chat pertence ao user logado
    const { data: chat, error: chatErr } = await sb
      .from("wz_chats")
      .select("chat_code, user_id")
      .eq("chat_code", chatCode)
      .maybeSingle()

    if (chatErr) {
      return createTextStream("Erro ao acessar chat.", { "X-Wyzer-Source": "db_error" })
    }

    if (!chat || chat.user_id !== session.userId) {
      return createTextStream("Chat não encontrado.", { "X-Wyzer-Source": "not_found" })
    }

    // quick response
    const quick = getQuickResponse(userText)
    if (quick) {
      await sb.from("wz_chat_messages").insert([
        { chat_code: chatCode, sender: "user", message: userText, has_image: !!hasImage },
        { chat_code: chatCode, sender: "assistant", message: quick, has_image: false },
      ])
      await sb.from("wz_chats").update({ updated_at: new Date().toISOString() }).eq("chat_code", chatCode)

      void maybeGenerateMotivo(sb, chatCode)

      return createTextStream(quick, { "X-Wyzer-Source": "quick" })
    }

    // cache
    const cached = getCachedResponse(userText)
    if (cached) {
      await sb.from("wz_chat_messages").insert([
        { chat_code: chatCode, sender: "user", message: userText, has_image: !!hasImage },
        { chat_code: chatCode, sender: "assistant", message: cached, has_image: false },
      ])
      await sb.from("wz_chats").update({ updated_at: new Date().toISOString() }).eq("chat_code", chatCode)

      void maybeGenerateMotivo(sb, chatCode)

      return createTextStream(cached, { "X-Wyzer-Source": "cache" })
    }

    // salva mensagem do usuário
    await sb.from("wz_chat_messages").insert({
      chat_code: chatCode,
      sender: "user",
      message: userText,
      has_image: !!hasImage,
    })

    // ✅ OTIMIZADO: Usa APENAS a última mensagem para economizar tokens
    const messages = [{ role: "user" as const, content: compactText(userText, 150) }]

    const { response, usedModel } = await streamWithModelFallback({
      system: SYSTEM_PROMPT,
      messages,
      temperature: 0.6, // Reduzido para respostas mais consistentes
      maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS,
      abortSignal: req.signal,
    })

    // clona para ler e salvar o texto completo sem quebrar streaming pro cliente
    const cloned = response.clone()
    const fullTextPromise = cloned.text().then((t) => sanitizeText(t, 2000)).catch(() => "")

    // ao finalizar, salva no banco
    fullTextPromise.then(async (assistantText) => {
      if (!assistantText) return
      await sb.from("wz_chat_messages").insert({
        chat_code: chatCode,
        sender: "assistant",
        message: assistantText,
        has_image: false,
      })
      await sb.from("wz_chats").update({ updated_at: new Date().toISOString() }).eq("chat_code", chatCode)

      setCachedResponse(userText, assistantText)

      await maybeGenerateMotivo(sb, chatCode)
    }).catch(() => {})

    response.headers.set("X-Wyzer-Model", usedModel)
    response.headers.set("X-Wyzer-Chat", chatCode)
    return response
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[WyzerAI Error]:", errorMessage)

    if (isRateLimitError(errorMessage)) {
      return createTextStream(
        "Muitas mensagens no momento. Aguarde alguns segundos e tente novamente.",
        { "X-Wyzer-Source": "rate_limit" }
      )
    }

    if (isModelAccessError(errorMessage)) {
      return createTextStream(
        "Modelo não disponível. Tente novamente em instantes.",
        { "X-Wyzer-Source": "model_access" }
      )
    }

    return createTextStream("Desculpe, ocorreu um erro. Tente novamente.", {
      "X-Wyzer-Source": "error",
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "WyzerAI",
      version: "5.0.0-optimized",
      modelsTried: MODEL_FALLBACKS,
      cache: { entries: responseCache.size, maxEntries: CONFIG.MAX_CACHE_SIZE },
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}
