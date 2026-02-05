// app/api/wz_WyzerAI/route.ts
import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { headers } from "next/headers"
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session"
import { supabaseAdmin } from "@/app/api/_supabaseAdmin"

// ═══════════════════════════════════════════════════════════════════════════════
// WYZER AI - ENTERPRISE BACKEND v6.0 - ULTRA OTIMIZADO TPM (1000 TPM)
// - System prompt MÍNIMO para economizar tokens
// - Respostas curtas (máx 80 tokens output)
// - Cache agressivo + respostas rápidas expandidas
// - Fallback para atendente humano quando limite atingido
// - Identifica motivo na PRIMEIRA mensagem
// ═══════════════════════════════════════════════════════════════════════════════

export const maxDuration = 60

const openai = createOpenAI({})

// ✅ ULTRA OTIMIZADO PARA 1000 TPM
const CONFIG = {
  MAX_INPUT_CHARS: 150,      // Máximo de caracteres da mensagem do usuário
  MAX_OUTPUT_TOKENS: 80,     // Reduzido para ~80 tokens de output
  CACHE_TTL_MS: 15 * 60 * 1000, // Cache por 15 minutos
  MAX_CACHE_SIZE: 500,       // Mais cache = menos chamadas API
  RATE_LIMIT_COOLDOWN_MS: 30_000, // 30s de cooldown após rate limit
} as const

const MODEL_FALLBACKS = [
  "gpt-4o-mini",
  "gpt-4.1-mini", 
  "gpt-5-nano",
] as const

// ✅ System prompt ULTRA COMPACTO para economizar tokens (~100 tokens)
const SYSTEM_PROMPT = `Flow, assistente Wyzer. Responda em PT-BR, curto (1-2 frases). Wyzer: automação WhatsApp. Planos: Starter R$89, PRO R$149. Suporte: seg-sex 9h-18h. Teste grátis 7 dias.`

// Rate limit tracking
let lastRateLimitTime = 0
let rateLimitCount = 0

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

// ✅ EXPANDIDO: Respostas rápidas para cobrir 60%+ das interações (sem usar API)
const QUICK_RESPONSES: Record<string, string> = {
  // Saudações
  oi: "Oi! Sou o Flow da Wyzer. Como posso ajudar?",
  ola: "Olá! Sou o Flow da Wyzer. Como posso ajudar?",
  "olá": "Olá! Sou o Flow da Wyzer. Como posso ajudar?",
  hey: "Hey! Sou o Flow da Wyzer. Em que posso ajudar?",
  opa: "Opa! Sou o Flow da Wyzer. O que precisa?",
  "e ai": "E aí! Sou o Flow. Como posso te ajudar?",
  "bom dia": "Bom dia! Sou o Flow da Wyzer. Como posso ajudar?",
  "boa tarde": "Boa tarde! Sou o Flow da Wyzer. Como posso ajudar?",
  "boa noite": "Boa noite! Sou o Flow da Wyzer. Como posso ajudar?",
  
  // Agradecimentos
  obrigado: "Por nada! Qualquer coisa, estou aqui.",
  obrigada: "Por nada! Qualquer coisa, estou aqui.",
  valeu: "Valeu! Qualquer coisa, é só chamar.",
  "muito obrigado": "Por nada! Fico feliz em ajudar.",
  "muito obrigada": "Por nada! Fico feliz em ajudar.",
  thanks: "De nada! Estou por aqui se precisar.",
  
  // Confirmações
  ok: "Perfeito! Se tiver mais dúvidas, estou por aqui.",
  entendi: "Ótimo! Se precisar de mais ajuda, me avisa.",
  certo: "Certo! Qualquer dúvida, é só chamar.",
  beleza: "Beleza! Estou por aqui se precisar.",
  "tudo bem": "Tudo ótimo! Em que posso te ajudar hoje?",
  
  // Despedidas
  tchau: "Tchau! Volte sempre que precisar.",
  bye: "Até mais! Estou sempre por aqui.",
  "até mais": "Até mais! Qualquer coisa, é só chamar.",
  "ate logo": "Até logo! Volte sempre.",
  
  // Preços e planos (frequentes)
  preco: "Nossos planos: Starter R$89/mês, PRO R$149/mês. Teste grátis por 7 dias!",
  precos: "Nossos planos: Starter R$89/mês, PRO R$149/mês. Teste grátis por 7 dias!",
  "quanto custa": "Nossos planos: Starter R$89/mês, PRO R$149/mês. Teste grátis por 7 dias!",
  plano: "Temos Starter R$89/mês e PRO R$149/mês. Quer saber as diferenças?",
  planos: "Temos Starter R$89/mês e PRO R$149/mês. Quer saber as diferenças?",
  valor: "Starter R$89/mês, PRO R$149/mês. Teste grátis disponível!",
  "teste gratis": "Sim! Oferecemos 7 dias de teste grátis. Quer começar?",
  "teste gratuito": "Sim! Oferecemos 7 dias de teste grátis. Quer começar?",
  
  // Suporte
  ajuda: "Claro! Me conta o que você precisa e vou te ajudar.",
  "preciso de ajuda": "Estou aqui para ajudar! Me conta o que está acontecendo.",
  suporte: "Nosso suporte funciona seg-sex, 9h-18h. Em que posso ajudar agora?",
  atendente: "Vou transferir você para um atendente humano. Aguarde um momento.",
  humano: "Entendi! Vou solicitar um atendente humano para você. Aguarde.",
  
  // WhatsApp
  whatsapp: "Para conectar seu WhatsApp, acesse Configurações > WhatsApp no painel.",
  conectar: "Para conectar, vá em Configurações > WhatsApp e escaneie o QR code.",
  desconectou: "Se desconectou, tente reconectar pelo painel ou reinicie o navegador.",
  qrcode: "O QR code aparece em Configurações > WhatsApp. Escaneie com seu celular.",
  "qr code": "O QR code aparece em Configurações > WhatsApp. Escaneie com seu celular.",
  
  // Problemas comuns
  erro: "Pode me contar mais sobre o erro? Assim consigo te ajudar melhor.",
  problema: "Me conta o que está acontecendo e vou te ajudar a resolver.",
  "nao funciona": "Entendo! Me conta o que exatamente não está funcionando.",
  "não funciona": "Entendo! Me conta o que exatamente não está funcionando.",
  bug: "Pode descrever o problema? Vou te ajudar a resolver.",
  
  // Outros
  sim: "Ótimo! Como posso continuar te ajudando?",
  nao: "Tudo bem! Se precisar de algo, estou por aqui.",
  "não": "Tudo bem! Se precisar de algo, estou por aqui.",
  "?": "Me conta sua dúvida que vou te ajudar!",
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
    lower.includes("rate limit") ||
    lower.includes("tpm") ||
    lower.includes("rpm") ||
    lower.includes("quota") ||
    lower.includes("too many") ||
    lower.includes("exceeded") ||
    lower.includes("429") ||
    lower.includes("limit exceeded") ||
    lower.includes("tokens per minute")
  )
}

// ✅ NOVO: Verificar se está em cooldown de rate limit
function isInRateLimitCooldown(): boolean {
  if (rateLimitCount >= 3) {
    const elapsed = Date.now() - lastRateLimitTime
    if (elapsed < CONFIG.RATE_LIMIT_COOLDOWN_MS) {
      return true
    }
    // Reset após cooldown
    rateLimitCount = 0
  }
  return false
}

function recordRateLimit() {
  lastRateLimitTime = Date.now()
  rateLimitCount++
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
// MOTIVO: Identificar na PRIMEIRA mensagem, atualizar na segunda se melhorar
// ─────────────────────────────────────────────────────────────────────────────

// ✅ NOVO: Keywords para identificar motivo SEM usar API
const MOTIVO_KEYWORDS: Record<string, string> = {
  // Planos e preços
  "preco": "Dúvida sobre preços",
  "precos": "Dúvida sobre preços", 
  "plano": "Informações sobre planos",
  "planos": "Informações sobre planos",
  "valor": "Consulta de valores",
  "quanto custa": "Dúvida sobre preços",
  "assinar": "Interesse em assinatura",
  "upgrade": "Upgrade de plano",
  "teste": "Teste gratuito",
  "gratuito": "Teste gratuito",
  "gratis": "Teste gratuito",
  
  // WhatsApp
  "whatsapp": "Suporte WhatsApp",
  "conectar": "Conexão WhatsApp",
  "desconect": "WhatsApp desconectou",
  "qr code": "Problema com QR Code",
  "qrcode": "Problema com QR Code",
  "numero": "Dúvida sobre número",
  
  // Problemas
  "erro": "Relato de erro",
  "problema": "Relato de problema",
  "bug": "Relato de bug",
  "nao funciona": "Problema técnico",
  "não funciona": "Problema técnico",
  "instabilidade": "Instabilidade no sistema",
  
  // Pagamento
  "pagamento": "Dúvida sobre pagamento",
  "cobranca": "Verificar cobrança",
  "cobrança": "Verificar cobrança",
  "reembolso": "Solicitação de reembolso",
  "cartao": "Atualização de cartão",
  "cartão": "Atualização de cartão",
  "fatura": "Dúvida sobre fatura",
  
  // Conta
  "senha": "Alteração de senha",
  "login": "Problema com login",
  "email": "Alteração de email",
  "conta": "Dúvida sobre conta",
  "cadastro": "Atualização cadastral",
  "2fa": "Verificação em 2 etapas",
  
  // Suporte
  "ajuda": "Solicitação de ajuda",
  "atendente": "Falar com atendente",
  "humano": "Atendimento humano",
  "urgente": "Atendimento urgente",
  "urgencia": "Atendimento urgente",
  "suporte": "Suporte técnico",
  
  // Documentação
  "documentacao": "Acesso à documentação",
  "documentação": "Acesso à documentação",
  "termos": "Termos e políticas",
  "politica": "Políticas de privacidade",
}

function extractMotivoFromText(text: string): string | null {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  
  for (const [keyword, motivo] of Object.entries(MOTIVO_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return motivo
    }
  }
  return null
}

async function maybeGenerateMotivo(
  sb: ReturnType<typeof supabaseAdmin>, 
  chatCode: string,
  currentUserMessage?: string
) {
  const { data: chat } = await sb
    .from("wz_chats")
    .select("motivo")
    .eq("chat_code", chatCode)
    .maybeSingle()

  if (!chat) return

  // ✅ NOVO: Se já tem motivo que não é genérico, não atualizar
  const currentMotivo = chat.motivo || ""
  const isGenericMotivo = !currentMotivo || 
    currentMotivo.includes("Atendimento") || 
    currentMotivo.includes("Novo chat") ||
    currentMotivo.includes("SEM MOTIVO")

  // Se tem motivo bom, não atualizar
  if (!isGenericMotivo) return

  // ✅ Tentar extrair motivo da mensagem atual SEM usar API
  if (currentUserMessage) {
    const extractedMotivo = extractMotivoFromText(currentUserMessage)
    if (extractedMotivo) {
      await sb
        .from("wz_chats")
        .update({ motivo: extractedMotivo, updated_at: new Date().toISOString() })
        .eq("chat_code", chatCode)
      return
    }
  }

  // ✅ Se não extraiu, buscar mensagens do chat para tentar extrair
  const { data: msgs } = await sb
    .from("wz_chat_messages")
    .select("sender, message")
    .eq("chat_code", chatCode)
    .eq("sender", "user")
    .order("created_at", { ascending: true })
    .limit(3)

  if (!msgs || msgs.length === 0) return

  // Tentar extrair de qualquer mensagem
  for (const msg of msgs) {
    const extracted = extractMotivoFromText(msg.message || "")
    if (extracted) {
      await sb
        .from("wz_chats")
        .update({ motivo: extracted, updated_at: new Date().toISOString() })
        .eq("chat_code", chatCode)
      return
    }
  }

  // ✅ Se ainda não tem motivo e tem pelo menos 1 mensagem, definir genérico
  if (msgs.length >= 1 && isGenericMotivo) {
    // Usar primeira mensagem truncada como motivo genérico
    const firstMsg = (msgs[0].message || "").slice(0, 40)
    const genericMotivo = firstMsg.length > 35 ? firstMsg + "..." : firstMsg || "Atendimento geral"
    
    await sb
      .from("wz_chats")
      .update({ motivo: genericMotivo, updated_at: new Date().toISOString() })
      .eq("chat_code", chatCode)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST HANDLER (persistente por chatCode)
// ─────────────────────────────────────────────────────────────────────────────

// ✅ NOVO: Mensagem de fallback para atendente humano
const TRANSFER_TO_HUMAN_MSG = "Estamos com muitas solicitações no momento. Vou transferir você para um atendente humano. Por favor, aguarde alguns instantes que entraremos em contato."

export async function POST(req: Request): Promise<Response> {
  try {
    // ✅ NOVO: Verificar cooldown de rate limit ANTES de processar
    if (isInRateLimitCooldown()) {
      return createTextStream(TRANSFER_TO_HUMAN_MSG, {
        "X-Wyzer-Source": "transfer_human",
      })
    }

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

    // ✅ quick response (NÃO USA API)
    const quick = getQuickResponse(userText)
    if (quick) {
      await sb.from("wz_chat_messages").insert([
        { chat_code: chatCode, sender: "user", message: userText, has_image: !!hasImage },
        { chat_code: chatCode, sender: "assistant", message: quick, has_image: false },
      ])
      await sb.from("wz_chats").update({ updated_at: new Date().toISOString() }).eq("chat_code", chatCode)

      // ✅ Tentar extrair motivo da mensagem
      void maybeGenerateMotivo(sb, chatCode, userText)

      return createTextStream(quick, { "X-Wyzer-Source": "quick" })
    }

    // ✅ cache (NÃO USA API)
    const cached = getCachedResponse(userText)
    if (cached) {
      await sb.from("wz_chat_messages").insert([
        { chat_code: chatCode, sender: "user", message: userText, has_image: !!hasImage },
        { chat_code: chatCode, sender: "assistant", message: cached, has_image: false },
      ])
      await sb.from("wz_chats").update({ updated_at: new Date().toISOString() }).eq("chat_code", chatCode)

      void maybeGenerateMotivo(sb, chatCode, userText)

      return createTextStream(cached, { "X-Wyzer-Source": "cache" })
    }

    // salva mensagem do usuário
    await sb.from("wz_chat_messages").insert({
      chat_code: chatCode,
      sender: "user",
      message: userText,
      has_image: !!hasImage,
    })

    // ✅ Atualizar motivo antes de chamar API
    void maybeGenerateMotivo(sb, chatCode, userText)

    // ✅ ULTRA OTIMIZADO: Mensagem ainda mais compacta
    const messages = [{ role: "user" as const, content: compactText(userText, 100) }]

    const { response, usedModel } = await streamWithModelFallback({
      system: SYSTEM_PROMPT,
      messages,
      temperature: 0.5, // Ainda mais baixo para economizar tokens
      maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS,
      abortSignal: req.signal,
    })

    // clona para ler e salvar o texto completo sem quebrar streaming pro cliente
    const cloned = response.clone()
    const fullTextPromise = cloned.text().then((t) => sanitizeText(t, 500)).catch(() => "")

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
    }).catch(() => {})

    response.headers.set("X-Wyzer-Model", usedModel)
    response.headers.set("X-Wyzer-Chat", chatCode)
    return response
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[WyzerAI Error]:", errorMessage)

    if (isRateLimitError(errorMessage)) {
      // ✅ Registrar rate limit
      recordRateLimit()
      
      // ✅ Se atingiu limite de rate limits, transferir para humano
      if (rateLimitCount >= 3) {
        return createTextStream(TRANSFER_TO_HUMAN_MSG, {
          "X-Wyzer-Source": "transfer_human",
        })
      }
      
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
      version: "6.0.0-ultra-tpm",
      modelsTried: MODEL_FALLBACKS,
      cache: { entries: responseCache.size, maxEntries: CONFIG.MAX_CACHE_SIZE },
      rateLimitCooldown: isInRateLimitCooldown(),
      rateLimitCount,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}
