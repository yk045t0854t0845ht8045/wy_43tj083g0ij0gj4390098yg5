import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromCookieHeader } from "../_session";

export const dynamic = "force-dynamic";

/**
 * ✅ /me
 * - Sem cache (browser/CDN)
 * - Valida igual ao dashboard (cookie + binds UA/IP quando ligados)
 * - Retorna 401 quando inválido
 */
export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");

  // ✅ HeaderLike: só precisa de .get() (NextRequest.headers já serve)
  const headerLike = {
    get: (name: string) => req.headers.get(name),
  };

  const s = readSessionFromCookieHeader(cookieHeader, headerLike);

  if (!s) {
    const res = NextResponse.json({ ok: false }, { status: 401 });
    res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("pragma", "no-cache");
    res.headers.set("expires", "0");
    res.headers.set("surrogate-control", "no-store");
    return res;
  }

  const res = NextResponse.json({ ok: true, session: s }, { status: 200 });
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  res.headers.set("surrogate-control", "no-store");
  return res;
}
