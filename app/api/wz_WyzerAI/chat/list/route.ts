// app/api/wz_WyzerAI/chat/list/route.ts
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

type ChatListRow = {
  chat_code: string | null
  motivo: string | null
  created_at: string | null
  updated_at: string | null
}

function normalizeEmail(v: unknown) {
  return String(v || "").trim().toLowerCase()
}

function parseDateMs(v: unknown) {
  const ms = Date.parse(String(v || ""))
  return Number.isFinite(ms) ? ms : 0
}

function sortAndDedupeChats(rows: ChatListRow[]) {
  const byCode = new Map<string, ChatListRow>()

  for (const row of rows) {
    const code = String(row?.chat_code || "").trim()
    if (!code) continue

    const prev = byCode.get(code)
    if (!prev) {
      byCode.set(code, row)
      continue
    }

    const prevMs = Math.max(parseDateMs(prev.updated_at), parseDateMs(prev.created_at))
    const nextMs = Math.max(parseDateMs(row.updated_at), parseDateMs(row.created_at))
    if (nextMs >= prevMs) byCode.set(code, row)
  }

  return Array.from(byCode.values()).sort((a, b) => {
    const aMs = Math.max(parseDateMs(a.updated_at), parseDateMs(a.created_at))
    const bMs = Math.max(parseDateMs(b.updated_at), parseDateMs(b.created_at))
    return bMs - aMs
  })
}

export async function GET() {
  const h = await headers()
  const cookieHeader = h.get("cookie")
  const headerLike: { get(name: string): string | null } = { get: (n) => h.get(n) }

  const session = readSessionFromCookieHeader(cookieHeader, headerLike)
  if (!session) return json({ error: "unauthorized" }, 401)

  const sb = supabaseAdmin()
  const sessionUserId = String(session.userId || "").trim()
  const sessionEmail = normalizeEmail(session.email)
  const rows: ChatListRow[] = []

  let successCount = 0
  let lastErrorMessage = ""

  if (sessionUserId) {
    const { data, error } = await sb
      .from("wz_chats")
      .select("chat_code, motivo, created_at, updated_at")
      .eq("user_id", sessionUserId)
      .order("updated_at", { ascending: false })
      .limit(80)

    if (error) {
      lastErrorMessage = error.message
    } else {
      successCount += 1
      if (Array.isArray(data)) rows.push(...(data as ChatListRow[]))
    }
  }

  if (sessionEmail) {
    const { data, error } = await sb
      .from("wz_chats")
      .select("chat_code, motivo, created_at, updated_at")
      .eq("user_email", sessionEmail)
      .order("updated_at", { ascending: false })
      .limit(80)

    if (error) {
      if (!lastErrorMessage) lastErrorMessage = error.message
    } else {
      successCount += 1
      if (Array.isArray(data)) rows.push(...(data as ChatListRow[]))
    }
  }

  if (!sessionUserId && !sessionEmail) {
    return json({ ok: true, chats: [] }, 200)
  }

  if (successCount === 0) {
    return json({ error: "db_error", detail: lastErrorMessage || "failed_to_load_chats" }, 500)
  }

  const chats = sortAndDedupeChats(rows).slice(0, 50)
  return json({ ok: true, chats }, 200)
}
