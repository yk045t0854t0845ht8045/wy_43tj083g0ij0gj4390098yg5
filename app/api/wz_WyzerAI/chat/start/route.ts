// app/api/wz_WyzerAI/chat/start/route.ts
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session"
import { supabaseAdmin } from "@/app/api/_supabaseAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS })
}

function genChatCode(len = 20) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ""
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out.slice(0, 20)
}

async function createUniqueChatCode(sb: ReturnType<typeof supabaseAdmin>) {
  for (let i = 0; i < 12; i++) {
    const code = genChatCode(20)
    const { data } = await sb.from("wz_chats").select("chat_code").eq("chat_code", code).maybeSingle()
    if (!data) return code
  }
  return genChatCode(20)
}

export async function POST() {
  const h = await headers()
  const cookieHeader = h.get("cookie")
  const headerLike: { get(name: string): string | null } = { get: (n) => h.get(n) }

  const session = readSessionFromCookieHeader(cookieHeader, headerLike)
  if (!session) return json({ error: "unauthorized" }, 401)

  const sb = supabaseAdmin()
  const chatCode = await createUniqueChatCode(sb)

  const { error } = await sb.from("wz_chats").insert({
    chat_code: chatCode,
    user_id: session.userId,
    user_email: session.email,
    assigned_to: "FlowAI",
    motivo: null,
  })

  if (error) return json({ error: "db_error", detail: error.message }, 500)

  return json({ ok: true, chatCode, assignedTo: "FlowAI" }, 200)
}
