import crypto from "crypto";

type SmsProvider = "twilio" | "webhook" | "selfhost" | "console";

type SmsSendResult = {
  provider: SmsProvider;
  messageId: string | null;
  rawStatus: string | null;
};

function parseBool(raw: string | undefined, fallback: boolean) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return fallback;
  if (value === "1" || value === "true" || value === "yes" || value === "on") {
    return true;
  }
  if (value === "0" || value === "false" || value === "no" || value === "off") {
    return false;
  }
  return fallback;
}

function parseIntSafe(raw: string | undefined, fallback: number, min: number, max: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const int = Math.floor(value);
  if (int < min || int > max) return fallback;
  return int;
}

function normalizeE164(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[()-]/g, "");
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
  if (digits.length >= 10 && digits.length <= 15) {
    if (digits.startsWith("55") && digits.length >= 12) {
      return `+${digits}`;
    }
    if (digits.length === 11) {
      return `+55${digits}`;
    }
    return `+${digits}`;
  }

  return null;
}

function isLikelyE164(value: string) {
  return /^\+\d{10,15}$/.test(normalizeE164(value));
}

function maskPhone(phoneE164: string) {
  const digits = onlyDigits(phoneE164);
  if (digits.length < 6) return phoneE164;
  const visiblePrefix = digits.slice(0, 2);
  const visibleSuffix = digits.slice(-2);
  return `+${visiblePrefix}${"*".repeat(Math.max(0, digits.length - 4))}${visibleSuffix}`;
}

function splitCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function buildCodeMessage(code: string) {
  const brand = String(process.env.SMS_BRAND_NAME || "Wyzer").trim() || "Wyzer";
  const template =
    String(process.env.SMS_CODE_TEMPLATE || "{{brand}} - Seu codigo de verificacao: {{code}}") ||
    "{{brand}} - Seu codigo de verificacao: {{code}}";

  return template
    .replace(/\{\{\s*brand\s*\}\}/gi, brand)
    .replace(/\{\{\s*code\s*\}\}/gi, code)
    .replace(/\s+/g, " ")
    .trim();
}

function getSmsTimeoutMs() {
  return parseIntSafe(process.env.SMS_TIMEOUT_MS, 15000, 2000, 60000);
}

function isSmsDebugEnabled() {
  return parseBool(process.env.SMS_DEBUG, false);
}

function isDryRunEnabled() {
  return parseBool(process.env.SMS_DRY_RUN, false);
}

function normalizeProviderToken(token: string): SmsProvider | null {
  const clean = String(token || "").trim().toLowerCase();
  if (!clean) return null;

  if (clean === "twilio") return "twilio";
  if (clean === "webhook") return "webhook";
  if (clean === "selfhost" || clean === "self-host" || clean === "self_host") {
    return "selfhost";
  }
  if (clean === "console") return "console";
  return null;
}

function dedupeProviders(values: Array<SmsProvider | null>) {
  const out: SmsProvider[] = [];
  const seen = new Set<SmsProvider>();

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

function resolveTwilioConfig() {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const fromNumber = String(process.env.TWILIO_FROM_NUMBER || "").trim();
  const messagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  const statusCallbackUrl = String(process.env.TWILIO_STATUS_CALLBACK_URL || "").trim();

  const configured =
    Boolean(accountSid) &&
    Boolean(authToken) &&
    (Boolean(fromNumber) || Boolean(messagingServiceSid));

  return {
    configured,
    accountSid,
    authToken,
    fromNumber,
    messagingServiceSid,
    statusCallbackUrl,
  };
}

function defaultProviderOrder() {
  const listed = splitCsv(String(process.env.SMS_PROVIDER || ""))
    .map((token) => normalizeProviderToken(token))
    .filter((token): token is SmsProvider => Boolean(token));

  if (listed.length > 0) {
    return dedupeProviders(listed);
  }

  return dedupeProviders(["selfhost", "webhook", "console"]);
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

function safeJsonParse(raw: string) {
  try {
    return { ok: true as const, value: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    return { ok: false as const, value: null };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomIdempotencyKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return crypto.randomBytes(16).toString("hex");
  }
}

async function sendViaTwilio(params: { to: string; message: string; timeoutMs: number }) {
  const cfg = resolveTwilioConfig();
  if (!cfg.configured) {
    throw new Error(
      "Twilio nao configurado. Defina TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_FROM_NUMBER ou TWILIO_MESSAGING_SERVICE_SID.",
    );
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`;
  const body = new URLSearchParams();
  body.set("To", params.to);
  body.set("Body", params.message);

  if (cfg.messagingServiceSid) {
    body.set("MessagingServiceSid", cfg.messagingServiceSid);
  } else {
    body.set("From", cfg.fromNumber);
  }

  if (cfg.statusCallbackUrl) {
    body.set("StatusCallback", cfg.statusCallbackUrl);
  }

  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");

  const res = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    },
    params.timeoutMs,
  );

  const raw = await res.text().catch(() => "");
  const parsed = safeJsonParse(raw);

  if (!res.ok) {
    const message =
      String(parsed.value?.message || "").trim() ||
      `Twilio retornou HTTP ${res.status}.`;
    throw new Error(message);
  }

  const sid = String(parsed.value?.sid || "").trim();
  const errorCode = String(parsed.value?.error_code || "").trim();
  const errorMessage = String(parsed.value?.error_message || "").trim();

  if (errorCode || errorMessage) {
    throw new Error(errorMessage || `Twilio reportou erro (${errorCode}).`);
  }

  if (!sid) {
    throw new Error("Twilio nao retornou SID da mensagem.");
  }

  return {
    provider: "twilio" as const,
    messageId: sid,
    rawStatus: String(parsed.value?.status || "").trim() || null,
  };
}

function resolveWebhookConfig() {
  const url = String(process.env.SMS_WEBHOOK_URL || "").trim();
  const token = String(process.env.SMS_WEBHOOK_TOKEN || "").trim();
  const signingSecret = String(process.env.SMS_WEBHOOK_SIGNING_SECRET || "").trim();
  const maxRetries = parseIntSafe(process.env.SMS_WEBHOOK_MAX_RETRIES, 2, 0, 5);
  const retryBaseMs = parseIntSafe(process.env.SMS_WEBHOOK_RETRY_BASE_MS, 350, 100, 5000);

  return {
    configured: Boolean(url),
    url,
    token,
    signingSecret,
    maxRetries,
    retryBaseMs,
  };
}

function buildWebhookSignature(params: {
  signingSecret: string;
  timestamp: string;
  body: string;
}) {
  if (!params.signingSecret) return null;
  const digest = crypto
    .createHmac("sha256", params.signingSecret)
    .update(`${params.timestamp}.${params.body}`, "utf8")
    .digest("hex");
  return `sha256=${digest}`;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function sendViaWebhook(params: {
  provider: "webhook" | "selfhost";
  to: string;
  code: string;
  message: string;
  timeoutMs: number;
}) {
  const cfg = resolveWebhookConfig();
  if (!cfg.configured) {
    throw new Error("SMS webhook nao configurado. Defina SMS_WEBHOOK_URL.");
  }

  const ownGatewayNumber = normalizeOwnGatewayNumber(String(process.env.SMS_OWN_NUMBER || ""));

  let lastError = "Webhook SMS falhou.";

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt += 1) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const idempotencyKey = randomIdempotencyKey();

    const payload = {
      to: params.to,
      code: params.code,
      message: params.message,
      channel: "auth",
      provider: "wyzer-sms",
      timestamp: new Date().toISOString(),
      attempt: attempt + 1,
      maxAttempts: cfg.maxRetries + 1,
      idempotencyKey,
      ...(ownGatewayNumber ? { gatewayNumber: ownGatewayNumber } : {}),
    };

    const body = JSON.stringify(payload);
    const signature = buildWebhookSignature({
      signingSecret: cfg.signingSecret,
      timestamp,
      body,
    });

    let res: Response;
    let raw = "";

    try {
      res = await fetchWithTimeout(
        cfg.url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
            "X-Wyzer-Timestamp": timestamp,
            "X-Wyzer-Idempotency-Key": idempotencyKey,
            ...(signature ? { "X-Wyzer-Signature": signature } : {}),
          },
          body,
        },
        params.timeoutMs,
      );

      raw = await res.text().catch(() => "");
    } catch (error) {
      lastError = error instanceof Error ? error.message : "network_error";
      if (attempt < cfg.maxRetries) {
        const waitMs = cfg.retryBaseMs * Math.max(1, attempt + 1);
        await sleep(waitMs);
        continue;
      }
      throw new Error(lastError);
    }

    const parsed = safeJsonParse(raw);

    if (!res.ok) {
      const message =
        String(parsed.value?.message || "").trim() ||
        String(parsed.value?.error || "").trim() ||
        `Webhook SMS retornou HTTP ${res.status}.`;
      lastError = message;

      if (attempt < cfg.maxRetries && isRetryableStatus(res.status)) {
        const waitMs = cfg.retryBaseMs * Math.max(1, attempt + 1);
        await sleep(waitMs);
        continue;
      }

      throw new Error(message);
    }

    const okField = parsed.ok ? parsed.value?.ok : undefined;
    if (typeof okField === "boolean" && !okField) {
      const message =
        String(parsed.value?.message || "").trim() ||
        String(parsed.value?.error || "").trim() ||
        "Webhook SMS reportou falha.";
      throw new Error(message);
    }

    const messageId =
      String(parsed.value?.messageId || "").trim() ||
      String(parsed.value?.id || "").trim() ||
      null;

    return {
      provider: params.provider,
      messageId,
      rawStatus: String(parsed.value?.status || "").trim() || null,
    };
  }

  throw new Error(lastError);
}

function isConsoleFallbackEnabled() {
  const isProd = process.env.NODE_ENV === "production";
  return parseBool(process.env.SMS_DEV_CONSOLE_FALLBACK, !isProd);
}

async function sendViaConsole(params: { to: string; code: string; message: string }) {
  if (!isConsoleFallbackEnabled()) {
    throw new Error("Console fallback de SMS desativado.");
  }

  console.log("[SMS][console] simulated send", {
    to: maskPhone(params.to),
    code: params.code,
    message: params.message,
    gatewayNumber: normalizeOwnGatewayNumber(String(process.env.SMS_OWN_NUMBER || "")),
  });

  return {
    provider: "console" as const,
    messageId: null,
    rawStatus: "simulated",
  };
}

export async function sendSmsCode(phoneE164: string, code: string) {
  const to = normalizeE164(phoneE164);
  const cleanCode = String(code || "").trim();

  if (!isLikelyE164(to)) {
    throw new Error("Telefone invalido para SMS. Informe um numero no formato E.164.");
  }

  if (!/^\d{7}$/.test(cleanCode)) {
    throw new Error("Codigo invalido para envio de SMS.");
  }

  const message = buildCodeMessage(cleanCode);
  const timeoutMs = getSmsTimeoutMs();
  const debug = isSmsDebugEnabled();

  if (isDryRunEnabled()) {
    console.log("[SMS][dry-run] send skipped", {
      to: maskPhone(to),
      code: cleanCode,
      message,
      providerOrder: defaultProviderOrder(),
      gatewayNumber: normalizeOwnGatewayNumber(String(process.env.SMS_OWN_NUMBER || "")),
    });
    return true;
  }

  const providerOrder = defaultProviderOrder();
  const errors: string[] = [];

  for (const provider of providerOrder) {
    try {
      let result: SmsSendResult | null = null;

      if (provider === "twilio") {
        result = await sendViaTwilio({
          to,
          message,
          timeoutMs,
        });
      } else if (provider === "webhook" || provider === "selfhost") {
        result = await sendViaWebhook({
          provider,
          to,
          code: cleanCode,
          message,
          timeoutMs,
        });
      } else if (provider === "console") {
        result = await sendViaConsole({
          to,
          code: cleanCode,
          message,
        });
      }

      if (!result) continue;

      if (debug) {
        console.log("[SMS] sent", {
          provider: result.provider,
          to: maskPhone(to),
          messageId: result.messageId,
          status: result.rawStatus,
        });
      }

      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown_error";
      errors.push(`${provider}: ${msg}`);
    }
  }

  console.error("[SMS] all providers failed", {
    to: maskPhone(to),
    providerOrder,
    errors,
    gatewayNumber: normalizeOwnGatewayNumber(String(process.env.SMS_OWN_NUMBER || "")),
  });

  throw new Error("Falha ao enviar SMS no momento. Tente novamente em instantes.");
}
