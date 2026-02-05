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

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS })
}

export async function GET() {
  const h = await headers()
  const cookieHeader = h.get("cookie")
  const headerLike: { get(name: string): string | null } = { get: (n) => h.get(n) }

  const session = readSessionFromCookieHeader(cookieHeader, headerLike)
  if (!session) return json({ error: "unauthorized" }, 401)

  const sb = supabaseAdmin()

  const { data, error } = await sb
    .from("wz_chats")
    .select("chat_code, motivo, assigned_to, created_at, updated_at")
    .eq("user_id", session.userId)
    .order("updated_at", { ascending: false })
    .limit(50)

  if (error) return json({ error: "db_error", detail: error.message }, 500)

  return json({ ok: true, chats: data || [] }, 200)
}
