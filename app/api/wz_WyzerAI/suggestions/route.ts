// app/api/wz_WyzerAI/suggestions/route.ts
// ✅ v6.0 - ULTRA OTIMIZADO: Sugestões baseadas em keywords SEM usar API

export const maxDuration = 5

// ✅ Sugestões pré-definidas por contexto (NÃO USA API = economiza tokens)
const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  // Saudações
  "oi": ["Quais são os planos?", "Como conectar WhatsApp?", "Preciso de ajuda"],
  "olá": ["Quais são os planos?", "Como conectar WhatsApp?", "Preciso de ajuda"],
  "ajudar": ["Ver planos e preços", "Suporte técnico", "Falar com atendente"],
  
  // Preços e planos
  "plano": ["Qual a diferença dos planos?", "Posso fazer teste grátis?", "Como assinar?"],
  "preço": ["Ver todos os planos", "Tem desconto anual?", "Posso testar grátis?"],
  "valor": ["Quais formas de pagamento?", "Tem desconto?", "Posso parcelar?"],
  "starter": ["O que inclui o PRO?", "Posso fazer upgrade?", "Teste grátis"],
  "pro": ["Como fazer upgrade?", "Posso cancelar?", "Ver funcionalidades"],
  
  // WhatsApp
  "whatsapp": ["Como conectar?", "WhatsApp desconectou", "Posso usar meu número?"],
  "conectar": ["Onde fica o QR code?", "Não consigo conectar", "Suporte técnico"],
  "qr": ["QR não aparece", "Como escanear?", "Preciso de ajuda"],
  "desconect": ["Como reconectar?", "Por que desconectou?", "Falar com suporte"],
  
  // Problemas
  "erro": ["Qual o erro exatamente?", "Falar com suporte", "Ver documentação"],
  "problema": ["Me conta mais detalhes", "Falar com atendente", "Suporte técnico"],
  "não funciona": ["O que não funciona?", "Falar com suporte", "Reiniciar sistema"],
  
  // Pagamento
  "pagamento": ["Formas de pagamento?", "Histórico de pagamentos", "Atualizar cartão"],
  "cartão": ["Como atualizar cartão?", "Pagamento não passou", "Usar outro cartão"],
  "reembolso": ["Política de reembolso", "Solicitar reembolso", "Falar com financeiro"],
  "cobrança": ["Ver minha fatura", "Contestar cobrança", "Falar com financeiro"],
  
  // Conta
  "senha": ["Esqueci minha senha", "Alterar senha", "Problemas com login"],
  "login": ["Esqueci a senha", "Não consigo entrar", "Criar nova conta"],
  "conta": ["Atualizar dados", "Cancelar conta", "Alterar plano"],
  
  // Suporte
  "atendente": ["Horário de atendimento?", "Chat ao vivo", "Enviar email"],
  "humano": ["Aguardando atendente", "Horário de suporte", "Contato urgente"],
  "suporte": ["Horário de atendimento", "Abrir chamado", "Chat ao vivo"],
  
  // Documentação
  "documentação": ["Ver tutoriais", "API documentation", "Guia de início"],
  "tutorial": ["Primeiros passos", "Configurar chatbot", "Integrar API"],
}

// ✅ Sugestões padrão por categoria de resposta
const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  greeting: ["Quais são os planos?", "Como conectar WhatsApp?", "Preciso de suporte"],
  pricing: ["Como assinar?", "Tem teste grátis?", "Falar com atendente"],
  whatsapp: ["Como conectar?", "WhatsApp desconectou", "Preciso de ajuda"],
  support: ["Abrir chamado", "Ver documentação", "Falar com atendente"],
  general: ["Saber mais", "Pode explicar melhor?", "Falar com atendente"],
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
}

function getSuggestionsForContext(botResponse: string): string[] {
  const normalized = normalizeText(botResponse)
  
  // ✅ Procurar por keywords no texto
  for (const [keyword, suggestions] of Object.entries(CONTEXT_SUGGESTIONS)) {
    if (normalized.includes(keyword)) {
      return suggestions
    }
  }
  
  // ✅ Detectar categoria pela resposta
  if (normalized.includes("plano") || normalized.includes("preco") || normalized.includes("r$")) {
    return DEFAULT_SUGGESTIONS.pricing
  }
  if (normalized.includes("whatsapp") || normalized.includes("conectar") || normalized.includes("qr")) {
    return DEFAULT_SUGGESTIONS.whatsapp
  }
  if (normalized.includes("ajuda") || normalized.includes("suporte") || normalized.includes("atendente")) {
    return DEFAULT_SUGGESTIONS.support
  }
  if (normalized.includes("oi") || normalized.includes("ola") || normalized.includes("bem vindo")) {
    return DEFAULT_SUGGESTIONS.greeting
  }
  
  return DEFAULT_SUGGESTIONS.general
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const lastBotResponse = body?.lastBotResponse

    if (!lastBotResponse || typeof lastBotResponse !== "string") {
      return Response.json(
        { suggestions: DEFAULT_SUGGESTIONS.general },
        { headers: { "Cache-Control": "public, max-age=60" } }
      )
    }

    // ✅ ULTRA OTIMIZADO: Sugestões baseadas em keywords, SEM chamar API
    const suggestions = getSuggestionsForContext(lastBotResponse)

    return Response.json(
      { suggestions },
      {
        headers: {
          "Cache-Control": "public, max-age=30",
          "X-Wyzer-Source": "keywords",
        },
      }
    )
  } catch (error) {
    console.error("Erro ao gerar sugestoes:", error)

    return Response.json(
      { suggestions: DEFAULT_SUGGESTIONS.general },
      { headers: { "Cache-Control": "no-store", "X-Wyzer-Source": "fallback" } }
    )
  }
}
