import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  ONBOARDING_ABANDONMENT_TTL_MS,
  pruneAbandonedOnboarding,
} from "@/app/api/wz_users/_onboarding_maintenance";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "1" || clean === "true" || clean === "t" || clean === "yes" || clean === "sim";
  }
  return false;
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function readProvidedSecret(req: NextRequest) {
  const headerToken = normalizeText(req.headers.get("x-wz-storage-cleanup-secret"));
  if (headerToken) return headerToken;

  const authHeader = normalizeText(req.headers.get("authorization"));
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return normalizeText(match?.[1] || "");
}

function readExpectedSecret() {
  return (
    normalizeText(process.env.CRON_SECRET) ||
    normalizeText(process.env.WZ_STORAGE_CLEANUP_SECRET) ||
    normalizeText(process.env.SMS_INTERNAL_API_KEY) ||
    null
  );
}

async function parseRequestOptions(req: NextRequest) {
  const body =
    req.method === "POST"
      ? ((await req.json().catch(() => ({}))) as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  return {
    dryRun: normalizeBoolean(body.dryRun ?? req.nextUrl.searchParams.get("dryRun")),
    limit: normalizePositiveInteger(body.limit || req.nextUrl.searchParams.get("limit"), 100),
    ttlMinutes: normalizePositiveInteger(
      body.ttlMinutes || req.nextUrl.searchParams.get("ttlMinutes"),
      Math.round(ONBOARDING_ABANDONMENT_TTL_MS / 60000),
    ),
  };
}

async function handleMaintenance(req: NextRequest) {
  const expectedSecret = readExpectedSecret();
  if (!expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Secret do maintenance nao configurado. Defina WZ_STORAGE_CLEANUP_SECRET, CRON_SECRET ou SMS_INTERNAL_API_KEY.",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const providedSecret = readProvidedSecret(req);
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "Nao autorizado." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const options = await parseRequestOptions(req);
  const sb = supabaseAdmin();
  const ttlMs = options.ttlMinutes * 60 * 1000;
  const prune = await pruneAbandonedOnboarding({
    sb,
    dryRun: options.dryRun,
    ttlMs,
    limit: options.limit,
  });

  return NextResponse.json(
    {
      ok: true,
      executedAt: new Date().toISOString(),
      dryRun: options.dryRun,
      ttlMinutes: options.ttlMinutes,
      limit: options.limit,
      prune,
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}

export async function GET(req: NextRequest) {
  try {
    return await handleMaintenance(req);
  } catch (error) {
    console.error("[onboarding-maintenance] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao executar limpeza de onboarding abandonado." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handleMaintenance(req);
  } catch (error) {
    console.error("[onboarding-maintenance] POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao executar limpeza de onboarding abandonado." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
