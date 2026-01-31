// app/api/wz_AuthLogin/logout/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "../_session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const target = new URL("https://login.wyzer.com.br/");

  const res = NextResponse.redirect(target, 302);

  // ✅ limpa cookie (domain + host-only)
  clearSessionCookie(res, req);

  // ✅ evita qualquer cache de redirect
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");

  return res;
}
