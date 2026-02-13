import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function parseBool(raw: string | undefined, fallback: boolean) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return fallback;
  if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  return fallback;
}

function parseIntSafe(raw: string | undefined, fallback: number, min: number, max: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const int = Math.floor(value);
  if (int < min || int > max) return fallback;
  return int;
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D+/g, "");
}

function normalizeOwnGatewayNumber(raw: string) {
  const clean = String(raw || "").trim();
  if (!clean) return null;

  if (clean.startsWith("+")) {
    const normalized = `+${onlyDigits(clean)}`;
    return /^\+\d{10,15}$/.test(normalized) ? normalized : null;
  }

  const digits = onlyDigits(clean);
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function splitCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeProviderToken(token: string) {
  const clean = String(token || "").trim().toLowerCase();
  if (!clean) return null;
  if (clean === "selfhost" || clean === "self-host" || clean === "self_host") return "selfhost";
  if (clean === "webhook") return "webhook";
  if (clean === "twilio") return "twilio";
  if (clean === "console") return "console";
  return null;
}

function resolveProviderOrder() {
  const listed = splitCsv(String(process.env.SMS_PROVIDER || ""))
    .map((token) => normalizeProviderToken(token))
    .filter((token): token is "selfhost" | "webhook" | "twilio" | "console" => Boolean(token));

  if (listed.length) return Array.from(new Set(listed));
  return ["selfhost", "webhook", "console"];
}

function resolveTwilioConfigured() {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = String(process.env.TWILIO_FROM_NUMBER || "").trim();
  const service = String(process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  return Boolean(sid && token && (from || service));
}

function resolveWebhookConfigured() {
  return Boolean(String(process.env.SMS_WEBHOOK_URL || "").trim());
}

function requireInternalKey() {
  const expected = String(process.env.SMS_INTERNAL_API_KEY || "").trim();
  if (!expected) return false;
  return true;
}

export async function GET(req: Request) {
  const expectedKey = String(process.env.SMS_INTERNAL_API_KEY || "").trim();
  if (!expectedKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "SMS_INTERNAL_API_KEY nao configurado.",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const providedKey = String(req.headers.get("x-sms-api-key") || "").trim();
  if (!providedKey || providedKey !== expectedKey) {
    return NextResponse.json(
      { ok: false, error: "Nao autorizado." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const ownNumber = normalizeOwnGatewayNumber(String(process.env.SMS_OWN_NUMBER || ""));

  return NextResponse.json(
    {
      ok: true,
      sms: {
        providerOrder: resolveProviderOrder(),
        ownGatewayNumber: ownNumber,
        dryRun: parseBool(process.env.SMS_DRY_RUN, false),
        debug: parseBool(process.env.SMS_DEBUG, false),
        consoleFallback: parseBool(process.env.SMS_DEV_CONSOLE_FALLBACK, process.env.NODE_ENV !== "production"),
        authConsoleFallback: parseBool(process.env.SMS_AUTH_ALLOW_CONSOLE_FALLBACK, false),
        blockSelfSend: parseBool(process.env.SMS_BLOCK_SELF_SEND, false),
        timeoutMs: parseIntSafe(process.env.SMS_TIMEOUT_MS, 15000, 1000, 60000),
        authTimeoutMs: parseIntSafe(process.env.SMS_AUTH_TIMEOUT_MS, 6000, 1000, 30000),
        webhookMaxRetries: parseIntSafe(process.env.SMS_WEBHOOK_MAX_RETRIES, 2, 0, 5),
        authWebhookMaxRetries: parseIntSafe(process.env.SMS_AUTH_WEBHOOK_MAX_RETRIES, 1, 0, 5),
        webhookConfigured: resolveWebhookConfigured(),
        twilioConfigured: resolveTwilioConfigured(),
        hasInternalApiKey: requireInternalKey(),
      },
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}
