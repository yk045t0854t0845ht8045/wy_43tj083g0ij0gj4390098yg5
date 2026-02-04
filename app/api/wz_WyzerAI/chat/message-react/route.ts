import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/_supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function POST(req: Request) {
  const h = await headers();
  const cookieHeader = h.get("cookie");
  const headerLike: { get(name: string): string | null } = { get: (n) => h.get(n) };

  const session = readSessionFromCookieHeader(cookieHeader, headerLike);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });

  const body = await req.json().catch(() => null);
  const messageId = Number(body?.messageId || 0);
  const liked = !!body?.liked;
  const disliked = !!body?.disliked;

  if (!messageId) return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE_HEADERS });

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("wz_chat_messages")
    .update({ liked, disliked })
    .eq("id", messageId);

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500, headers: NO_STORE_HEADERS });

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE_HEADERS });
}
