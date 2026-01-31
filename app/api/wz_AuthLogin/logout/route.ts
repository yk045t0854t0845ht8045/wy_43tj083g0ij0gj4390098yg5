import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "../_session";

export async function POST(req: NextRequest) {
  const url = new URL("/", req.url);
  const res = NextResponse.redirect(url);
  clearSessionCookie(res);
  return res;
}
