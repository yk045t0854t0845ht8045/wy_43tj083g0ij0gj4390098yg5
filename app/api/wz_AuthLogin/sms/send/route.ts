import { NextResponse } from "next/server";
import { sendSmsCode } from "../../_sms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function normalizeHeaderToken(value: string | null) {
  return String(value || "").trim();
}

function parseDigits(value: unknown) {
  return String(value || "").replace(/\D+/g, "");
}

export async function POST(req: Request) {
  const internalKey = String(process.env.SMS_INTERNAL_API_KEY || "").trim();
  if (!internalKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "SMS API interna nao configurada. Defina SMS_INTERNAL_API_KEY.",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const providedKey = normalizeHeaderToken(req.headers.get("x-sms-api-key"));
  if (!providedKey || providedKey !== internalKey) {
    return NextResponse.json(
      { ok: false, error: "Nao autorizado." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      phoneE164?: string;
      code?: string;
    };

    const phoneE164 = String(body?.phoneE164 || "").trim();
    const code = parseDigits(body?.code).slice(0, 7);

    if (!phoneE164) {
      return NextResponse.json(
        { ok: false, error: "Informe phoneE164." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (code.length !== 7) {
      return NextResponse.json(
        { ok: false, error: "Informe um codigo de 7 digitos." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    await sendSmsCode(phoneE164, code);

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error: unknown) {
    console.error("[sms-send] error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
