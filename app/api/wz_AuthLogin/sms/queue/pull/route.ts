import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function clampInt(raw: unknown, fallback: number, min: number, max: number) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  const int = Math.floor(num);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}

function normalizeWorkerId(raw: unknown) {
  const clean = String(raw || "").trim().slice(0, 120);
  if (!clean) return "sms-gateway";
  return clean.replace(/\s+/g, "-");
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
  phone_e164: string;
  message: string;
  context: string | null;
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
      limit?: number;
      workerId?: string;
    };

    const nowIso = new Date().toISOString();
    const limit = clampInt(body?.limit, 5, 1, 20);
    const workerId = normalizeWorkerId(body?.workerId);
    const sb = supabaseAdmin();

    const { data: candidates, error: listError } = await sb
      .from("wz_auth_sms_outbox")
      .select("id,phone_e164,message,context,attempt_count,max_attempts")
      .eq("status", "pending")
      .lte("next_attempt_at", nowIso)
      .order("created_at", { ascending: true })
      .limit(Math.max(limit * 3, limit));

    if (listError) {
      return NextResponse.json(
        { ok: false, error: `Falha ao buscar fila: ${String(listError.message || "queue_list_failed")}` },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const jobs: Array<{
      id: string;
      phoneE164: string;
      message: string;
      context: string;
      attempt: number;
      maxAttempts: number;
    }> = [];

    for (const candidate of (candidates || []) as QueueRow[]) {
      if (jobs.length >= limit) break;

      const nextAttemptCount = Math.max(0, Number(candidate.attempt_count || 0)) + 1;
      const { data: claimed, error: claimError } = await sb
        .from("wz_auth_sms_outbox")
        .update({
          status: "processing",
          claimed_at: nowIso,
          claimed_by: workerId,
          updated_at: nowIso,
          attempt_count: nextAttemptCount,
        })
        .eq("id", candidate.id)
        .eq("status", "pending")
        .select("id,phone_e164,message,context,attempt_count,max_attempts")
        .maybeSingle();

      if (claimError || !claimed) {
        continue;
      }

      jobs.push({
        id: String(claimed.id),
        phoneE164: String(claimed.phone_e164 || ""),
        message: String(claimed.message || ""),
        context: String(claimed.context || "auth"),
        attempt: Number(claimed.attempt_count || 1),
        maxAttempts: Number(claimed.max_attempts || 8),
      });
    }

    return NextResponse.json(
      {
        ok: true,
        jobs,
        pulled: jobs.length,
        workerId,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
