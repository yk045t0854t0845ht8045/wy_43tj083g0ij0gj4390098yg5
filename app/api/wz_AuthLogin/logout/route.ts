import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "../_session";

export async function POST(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";

  const redirectTo = isProd
    ? "https://login.wyzer.com.br/"
    : "http://login.localhost:3000/";

  const res = NextResponse.redirect(redirectTo);
  clearSessionCookie(res);
  return res;
}
