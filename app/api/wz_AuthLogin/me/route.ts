import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromRequest } from "../_session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  const s = readSessionFromRequest(req);

  if (!s) {
    return NextResponse.json(
      { ok: false },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  return NextResponse.json(
    { ok: true, session: s },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}
