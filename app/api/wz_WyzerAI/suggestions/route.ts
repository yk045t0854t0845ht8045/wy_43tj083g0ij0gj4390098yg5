import { createOpenAI } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

export const maxDuration = 10

const openai = createOpenAI({})

// ✅ OTIMIZADO: Apenas 3 sugestões curtas
const suggestionsSchema = z.object({
  suggestions: z
    .array(z.string())
    .length(3)
    .describe("3 perguntas de follow-up curtas"),
})

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
  const clean = String(s || "").replace(/\s+/g, " ").trim()
  return clean.length > 35 ? clean.slice(0, 35).trim() : clean
}

function fallbackSuggestions() {
  return [
    "Pode explicar melhor?",
    "Ver planos e preços",
    "Falar com atendente",
  ]
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const lastBotResponse = body?.lastBotResponse

    if (!lastBotResponse || typeof lastBotResponse !== "string") {
      return Response.json(
        { suggestions: fallbackSuggestions() },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    // ✅ OTIMIZADO: Contexto menor
    const context = String(lastBotResponse).slice(0, 200)

    const prompt = `Baseado nesta resposta, gere 3 perguntas curtas (max 35 caracteres) relacionadas.
Português BR, sem emojis.

Resposta: "${context}"

Gere 3 perguntas úteis e diretas.`

    let lastErr: unknown = null

    for (const modelId of MODEL_FALLBACKS) {
      try {
        const result = await generateObject({
          model: openai(modelId),
          schema: suggestionsSchema,
          prompt,
          temperature: 0.5,
          maxOutputTokens: 80, // ✅ Reduzido
        })

        const suggestions = result.object.suggestions
          .map(sanitizeSuggestion)
          .filter((s) => s.length > 0)

        const fixed = [
          suggestions[0] || "Pode explicar melhor?",
          suggestions[1] || "Como resolvo isso?",
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

        if (isModelAccessError(msg)) continue
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
