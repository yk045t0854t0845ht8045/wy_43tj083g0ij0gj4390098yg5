// app/api/wz_AuthLogin/me/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromRequest } from "../_session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const s = readSessionFromRequest(req);

  if (!s) {
    return NextResponse.json(
      { ok: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  }

  // ✅ opção recomendada: garante que só retorna ok se tiver userId (evita redirect falso no front)
  const userId = String((s as any)?.userId || "").trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  }

  return NextResponse.json(
    { ok: true, session: s },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
