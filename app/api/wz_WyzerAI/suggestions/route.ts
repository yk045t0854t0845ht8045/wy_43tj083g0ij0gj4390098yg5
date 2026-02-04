import { createOpenAI } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

export const maxDuration = 10

const openai = createOpenAI({
  // apiKey: process.env.OPENAI_API_KEY, // opcional
})

// 3 perguntas curtas e úteis
const suggestionsSchema = z.object({
  suggestions: z
    .array(z.string())
    .length(3)
    .describe("3 perguntas de follow-up curtas e uteis"),
})

// Mesma lógica do teu chat: tenta outro modelo se não tiver acesso
const MODEL_FALLBACKS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-5-mini",
  "gpt-5-nano",
] as const

function isModelAccessError(msg: string) {
  const lower = msg.toLowerCase()
  return (
    lower.includes("model_not_found") ||
    lower.includes("does not have access to model") ||
    lower.includes("not have access to model")
  )
}

function sanitizeSuggestion(s: string) {
  // garante curto e limpinho
  const clean = String(s || "").replace(/\s+/g, " ").trim()
  // limite real de 40 caracteres
  return clean.length > 40 ? clean.slice(0, 40).trim() : clean
}

function fallbackSuggestions() {
  return [
    "Pode explicar melhor?",
    "Quero ver planos e preços",
    "Falar com atendente",
  ]
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const lastBotResponse = body?.lastBotResponse

    if (!lastBotResponse || typeof lastBotResponse !== "string") {
      return Response.json(
        { suggestions: fallbackSuggestions() },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    const context = String(lastBotResponse).slice(0, 300)

    const prompt = `Baseado nesta resposta de suporte ao cliente, gere 3 perguntas de follow-up curtas (max 40 caracteres cada) que o usuario poderia fazer.
Responda em portugues brasileiro.
Nao use emojis.
Evite perguntas genéricas demais (tipo "ok").

Resposta do suporte:
"${context}"

Gere 3 perguntas relacionadas e úteis.`

    let lastErr: unknown = null

    for (const modelId of MODEL_FALLBACKS) {
      try {
        const result = await generateObject({
          model: openai(modelId),
          schema: suggestionsSchema,
          prompt,
          temperature: 0.6,
          maxOutputTokens: 120,
        })

        const suggestions = result.object.suggestions
          .map(sanitizeSuggestion)
          .filter((s) => s.length > 0)

        // garante exatamente 3
        const fixed = [
          suggestions[0] || "Pode explicar melhor?",
          suggestions[1] || "Como resolvo isso agora?",
          suggestions[2] || "Falar com atendente",
        ].map(sanitizeSuggestion)

        return Response.json(
          { suggestions: fixed },
          {
            headers: {
              "Cache-Control": "no-store",
              "X-Wyzer-Model": modelId,
            },
          }
        )
      } catch (e: unknown) {
        lastErr = e
        const msg = e instanceof Error ? e.message : String(e)

        // se não tem acesso a esse modelo, tenta o próximo
        if (isModelAccessError(msg)) continue

        // se deu outro erro, sai pro fallback
        break
      }
    }

    console.error("Erro ao gerar sugestoes:", lastErr)

    return Response.json(
      { suggestions: fallbackSuggestions() },
      { headers: { "Cache-Control": "no-store", "X-Wyzer-Source": "fallback" } }
    )
  } catch (error) {
    console.error("Erro ao gerar sugestoes:", error)

    return Response.json(
      { suggestions: fallbackSuggestions() },
      { headers: { "Cache-Control": "no-store", "X-Wyzer-Source": "fallback" } }
    )
  }
}
