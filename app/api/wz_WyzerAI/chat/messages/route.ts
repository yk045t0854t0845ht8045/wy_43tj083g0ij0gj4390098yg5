// app/api/wz_WyzerAI/chat/messages/route.ts
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

export async function GET(req: Request) {
  const h = await headers()
  const cookieHeader = h.get("cookie")
  const headerLike: { get(name: string): string | null } = { get: (n) => h.get(n) }

  const session = readSessionFromCookieHeader(cookieHeader, headerLike)
  if (!session) return json({ error: "unauthorized" }, 401)

  const url = new URL(req.url)
  const code = String(url.searchParams.get("code") || "").trim()
  if (!code) return json({ error: "missing_code" }, 400)

  const sb = supabaseAdmin()

  const { data: chat, error: chatErr } = await sb
    .from("wz_chats")
    .select("chat_code, user_id")
    .eq("chat_code", code)
    .maybeSingle()

  if (chatErr) return json({ error: "db_error", detail: chatErr.message }, 500)
  if (!chat || chat.user_id !== session.userId) return json({ error: "not_found" }, 404)

  const { data, error } = await sb
    .from("wz_chat_messages")
    .select("id, chat_code, sender, message, created_at, liked, disliked, has_image")
    .eq("chat_code", code)
    .order("created_at", { ascending: true })
    .limit(300)

  if (error) return json({ error: "db_error", detail: error.message }, 500)

  return json({ ok: true, messages: data || [] }, 200)
}
