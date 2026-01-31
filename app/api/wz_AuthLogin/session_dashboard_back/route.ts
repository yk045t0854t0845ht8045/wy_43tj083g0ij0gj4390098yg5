import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");

  // ✅ "HeaderLike" compatível com teu _session (só precisa de .get)
  const headerLike: { get(name: string): string | null } = {
    get: (name: string) => req.headers.get(name),
  };

  // ✅ valida bind UA/IP quando ligado por ENV (mesma lógica de antes)
  const session = readSessionFromCookieHeader(cookieHeader, headerLike);

  // ✅ sempre no-store (não cachear sessão)
  if (!session) {
    return NextResponse.json(
      { ok: false },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      session: {
        userId: session.userId,
        email: session.email,
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    }
  );
}
