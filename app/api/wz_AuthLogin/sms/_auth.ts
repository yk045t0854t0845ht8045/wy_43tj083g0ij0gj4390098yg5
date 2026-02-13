import { timingSafeEqual } from "crypto";

function normalizeApiKey(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  // Accept accidental wrapping quotes from env panels/exports.
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function getAllowedSmsInternalApiKeys() {
  const primary = normalizeApiKey(String(process.env.SMS_INTERNAL_API_KEY || ""));
  const rotated = String(process.env.SMS_INTERNAL_API_KEYS || "")
    .split(",")
    .map((part) => normalizeApiKey(part))
    .filter(Boolean);

  const keys = [primary, ...rotated].filter(Boolean);
  return Array.from(new Set(keys));
}

export function resolveProvidedSmsInternalApiKey(req: Request) {
  const xKey = normalizeApiKey(String(req.headers.get("x-sms-api-key") || ""));
  if (xKey) return xKey;

  const authHeader = String(req.headers.get("authorization") || "").trim();
  if (/^bearer\s+/i.test(authHeader)) {
    return normalizeApiKey(authHeader.replace(/^bearer\s+/i, ""));
  }

  return "";
}

export function isSmsInternalApiKeyAuthorized(req: Request) {
  const allowed = getAllowedSmsInternalApiKeys();
  if (!allowed.length) return false;

  const provided = resolveProvidedSmsInternalApiKey(req);
  if (!provided) return false;

  return allowed.some((key) => safeEquals(key, provided));
}

