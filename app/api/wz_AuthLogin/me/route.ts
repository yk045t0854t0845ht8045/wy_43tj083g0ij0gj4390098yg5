import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromRequest } from "../_session";

export async function GET(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, session: s }, { status: 200 });
}
