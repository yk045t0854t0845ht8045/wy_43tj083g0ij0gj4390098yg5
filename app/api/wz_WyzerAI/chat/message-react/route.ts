// app/api/wz_WyzerAI/chat/message-react/route.ts
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

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS })
}

export async function POST(req: Request) {
  const h = await headers()
  const cookieHeader = h.get("cookie")
  const headerLike: { get(name: string): string | null } = { get: (n) => h.get(n) }

  const session = readSessionFromCookieHeader(cookieHeader, headerLike)
  if (!session) return json({ error: "unauthorized" }, 401)

  const body = await req.json().catch(() => null)
  const messageId = Number(body?.messageId || 0)
  const liked = !!body?.liked
  const disliked = !!body?.disliked

  if (!messageId) return json({ error: "bad_request" }, 400)
  if (liked && disliked) return json({ error: "invalid_state" }, 400)

  const sb = supabaseAdmin()

  const { data: msg, error: msgErr } = await sb
    .from("wz_chat_messages")
    .select("id, chat_code")
    .eq("id", messageId)
    .maybeSingle()

  if (msgErr) return json({ error: "db_error", detail: msgErr.message }, 500)
  if (!msg?.chat_code) return json({ error: "not_found" }, 404)

  const { data: chat, error: chatErr } = await sb
    .from("wz_chats")
    .select("chat_code, user_id")
    .eq("chat_code", msg.chat_code)
    .maybeSingle()

  if (chatErr) return json({ error: "db_error", detail: chatErr.message }, 500)
  if (!chat || chat.user_id !== session.userId) return json({ error: "not_allowed" }, 403)

  const { error } = await sb
    .from("wz_chat_messages")
    .update({ liked, disliked })
    .eq("id", messageId)

  if (error) return json({ error: "db_error", detail: error.message }, 500)

  // ✅ “touch” no chat pra histórico ficar mais “real time”
  await sb
    .from("wz_chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("chat_code", msg.chat_code)

  return json({ ok: true }, 200)
}
