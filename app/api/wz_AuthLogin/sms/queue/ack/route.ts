import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function clampInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const int = Math.floor(value);
  if (int < min || int > max) return fallback;
  return int;
}

function parseAckStatus(raw: unknown) {
  const clean = String(raw || "").trim().toLowerCase();
  if (clean === "sent") return "sent";
  if (clean === "failed") return "failed";
  return null;
}

function computeBackoffMs(attemptCount: number) {
  const base = clampInt(process.env.SMS_QUEUE_BACKOFF_BASE_MS, 5000, 1000, 60000);
  const max = clampInt(process.env.SMS_QUEUE_BACKOFF_MAX_MS, 300000, 10000, 3600000);
  const exp = Math.max(0, Math.min(10, attemptCount - 1));
  return Math.min(max, base * Math.pow(2, exp));
}

function isAuthorized(req: Request) {
  const expected = String(process.env.SMS_INTERNAL_API_KEY || "").trim();
  if (!expected) return { ok: false as const, status: 503, error: "SMS_INTERNAL_API_KEY nao configurado." };

  const provided = String(req.headers.get("x-sms-api-key") || "").trim();
  if (!provided || provided !== expected) {
    return { ok: false as const, status: 401, error: "Nao autorizado." };
  }

  return { ok: true as const };
}

type QueueRow = {
  id: string;
  status: string;
  attempt_count: number | null;
  max_attempts: number | null;
};

export async function POST(req: Request) {
  const auth = isAuthorized(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      error?: string;
    };

    const id = String(body?.id || "").trim();
    const status = parseAckStatus(body?.status);
    const errorText = String(body?.error || "").trim().slice(0, 4000);
    if (!id) {
      return NextResponse.json({ ok: false, error: "Informe id." }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (!status) {
      return NextResponse.json({ ok: false, error: "Status invalido. Use sent|failed." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const sb = supabaseAdmin();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const { data: row, error: rowError } = await sb
      .from("wz_auth_sms_outbox")
      .select("id,status,attempt_count,max_attempts")
      .eq("id", id)
      .maybeSingle();

    if (rowError || !row) {
      return NextResponse.json({ ok: false, error: "Registro da fila nao encontrado." }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const current = row as QueueRow;

    if (status === "sent") {
      const { error: sentError } = await sb
        .from("wz_auth_sms_outbox")
        .update({
          status: "sent",
          sent_at: nowIso,
          updated_at: nowIso,
          last_error: null,
        })
        .eq("id", id);

      if (sentError) {
        return NextResponse.json(
          { ok: false, error: `Falha ao confirmar envio: ${String(sentError.message || "ack_sent_failed")}` },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json({ ok: true, status: "sent" }, { status: 200, headers: NO_STORE_HEADERS });
    }

    const attemptCount = Math.max(0, Number(current.attempt_count || 0));
    const maxAttempts = Math.max(1, Number(current.max_attempts || 8));
    const exhausted = attemptCount >= maxAttempts;

    if (exhausted) {
      const { error: failError } = await sb
        .from("wz_auth_sms_outbox")
        .update({
          status: "failed",
          updated_at: nowIso,
          last_error: errorText || "max_attempts_reached",
        })
        .eq("id", id);

      if (failError) {
        return NextResponse.json(
          { ok: false, error: `Falha ao finalizar tentativa: ${String(failError.message || "ack_failed_final")}` },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        { ok: true, status: "failed", exhausted: true },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const retryInMs = computeBackoffMs(attemptCount);
    const retryAtIso = new Date(now + retryInMs).toISOString();
    const { error: retryError } = await sb
      .from("wz_auth_sms_outbox")
      .update({
        status: "pending",
        updated_at: nowIso,
        next_attempt_at: retryAtIso,
        last_error: errorText || "delivery_failed",
      })
      .eq("id", id);

    if (retryError) {
      return NextResponse.json(
        { ok: false, error: `Falha ao reagendar envio: ${String(retryError.message || "ack_retry_failed")}` },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { ok: true, status: "pending", retryInMs, retryAt: retryAtIso },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
