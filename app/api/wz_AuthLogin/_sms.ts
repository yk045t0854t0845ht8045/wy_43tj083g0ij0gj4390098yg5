import crypto from "crypto";

type SmsProvider = "twilio" | "webhook" | "selfhost" | "console";

type SmsSendResult = {
  provider: SmsProvider;
  messageId: string | null;
  rawStatus: string | null;
};

type SendSmsContext = "default" | "auth" | "diagnostic";

type SendSmsOptions = {
  context?: SendSmsContext;
  timeoutMs?: number;
  webhookMaxRetries?: number;
  webhookRetryBaseMs?: number;
  allowConsoleFallback?: boolean;
  acceptUncertainDelivery?: boolean;
  providerOrder?: SmsProvider[];
};

type ResolvedSendSmsOptions = {
  context: SendSmsContext;
  timeoutMs: number;
  webhookMaxRetries: number;
  webhookRetryBaseMs: number;
  allowConsoleFallback: boolean;
  acceptUncertainDelivery: boolean;
  providerOrder: SmsProvider[];
};

class SmsDeliveryUncertainError extends Error {
  provider: SmsProvider;

  constructor(provider: SmsProvider, message: string) {
    super(message);
    this.name = "SmsDeliveryUncertainError";
    this.provider = provider;
  }
}

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

function parseIntFromUnknown(raw: unknown, fallback: number, min: number, max: number) {
  if (raw === null || raw === undefined) return fallback;
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

function samePhoneNumber(a: string, b: string) {
  const da = onlyDigits(a);
  const db = onlyDigits(b);
  if (!da || !db) return false;
  return da === db;
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

function getDefaultSmsTimeoutMs() {
  return parseIntSafe(process.env.SMS_TIMEOUT_MS, 15000, 2000, 60000);
}

function getAuthSmsTimeoutMs() {
  return parseIntSafe(process.env.SMS_AUTH_TIMEOUT_MS, 18000, 1000, 30000);
}

function getAuthMinSmsTimeoutMs() {
  return parseIntSafe(process.env.SMS_AUTH_MIN_TIMEOUT_MS, 18000, 5000, 30000);
}

function getDefaultWebhookMaxRetries() {
  return parseIntSafe(process.env.SMS_WEBHOOK_MAX_RETRIES, 2, 0, 5);
}

function getAuthWebhookMaxRetries() {
  return parseIntSafe(process.env.SMS_AUTH_WEBHOOK_MAX_RETRIES, 1, 0, 3);
}

function getDefaultWebhookRetryBaseMs() {
  return parseIntSafe(process.env.SMS_WEBHOOK_RETRY_BASE_MS, 350, 100, 5000);
}

function getAuthWebhookRetryBaseMs() {
  return parseIntSafe(process.env.SMS_AUTH_WEBHOOK_RETRY_BASE_MS, 250, 50, 2500);
}

function shouldPreferAcceptedAck() {
  return parseBool(process.env.SMS_WEBHOOK_PREFER_ACCEPTED_ACK, true);
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

function resolveProviderOrder(override?: SmsProvider[]) {
  if (Array.isArray(override) && override.length > 0) {
    return dedupeProviders(override);
  }

  const listed = splitCsv(String(process.env.SMS_PROVIDER || ""))
    .map((token) => normalizeProviderToken(token))
    .filter((token): token is SmsProvider => Boolean(token));

  if (listed.length > 0) {
    return dedupeProviders(listed);
  }

  return dedupeProviders(["selfhost", "webhook", "console"]);
}

function shouldAllowConsoleFallback(context: SendSmsContext, explicit?: boolean) {
  if (typeof explicit === "boolean") return explicit;
  if (context === "auth") {
    return parseBool(process.env.SMS_AUTH_ALLOW_CONSOLE_FALLBACK, false);
  }

  const isProd = process.env.NODE_ENV === "production";
  return parseBool(process.env.SMS_DEV_CONSOLE_FALLBACK, !isProd);
}

function resolveSendSmsOptions(options?: SendSmsOptions): ResolvedSendSmsOptions {
  const context: SendSmsContext = options?.context || "default";

  const timeoutBase = context === "auth" ? getAuthSmsTimeoutMs() : getDefaultSmsTimeoutMs();
  let timeoutMs = parseIntFromUnknown(options?.timeoutMs, timeoutBase, 1000, 60000);

  const retryBase =
    context === "auth" ? getAuthWebhookMaxRetries() : getDefaultWebhookMaxRetries();
  const webhookMaxRetries = parseIntFromUnknown(
    options?.webhookMaxRetries,
    retryBase,
    0,
    5,
  );

  const retryDelayBase =
    context === "auth" ? getAuthWebhookRetryBaseMs() : getDefaultWebhookRetryBaseMs();
  const webhookRetryBaseMs = parseIntFromUnknown(
    options?.webhookRetryBaseMs,
    retryDelayBase,
    50,
    5000,
  );

  const allowConsoleFallback = shouldAllowConsoleFallback(
    context,
    options?.allowConsoleFallback,
  );

  let providerOrder = resolveProviderOrder(options?.providerOrder);
  if (!allowConsoleFallback) {
    providerOrder = providerOrder.filter((provider) => provider !== "console");
  }

  if (context === "auth" && providerOrder.some((provider) => provider === "webhook" || provider === "selfhost")) {
    timeoutMs = Math.max(timeoutMs, getAuthMinSmsTimeoutMs());
  }

  const acceptUncertainDelivery =
    typeof options?.acceptUncertainDelivery === "boolean"
      ? options.acceptUncertainDelivery
      : context === "auth"
        ? parseBool(process.env.SMS_AUTH_ACCEPT_UNCERTAIN_DELIVERY, true)
        : false;

  return {
    context,
    timeoutMs,
    webhookMaxRetries,
    webhookRetryBaseMs,
    allowConsoleFallback,
    acceptUncertainDelivery,
    providerOrder,
  };
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

function resolveWebhookConfig(params?: {
  maxRetries?: number;
  retryBaseMs?: number;
}) {
  const url = String(process.env.SMS_WEBHOOK_URL || "").trim();
  const token = String(process.env.SMS_WEBHOOK_TOKEN || "").trim();
  const signingSecret = String(process.env.SMS_WEBHOOK_SIGNING_SECRET || "").trim();
  const maxRetries = parseIntFromUnknown(params?.maxRetries, getDefaultWebhookMaxRetries(), 0, 5);
  const retryBaseMs = parseIntFromUnknown(
    params?.retryBaseMs,
    getDefaultWebhookRetryBaseMs(),
    50,
    5000,
  );

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

function isAbortLikeError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const msg = String(error.message || "").toLowerCase();
  const name = String((error as { name?: unknown }).name || "").toLowerCase();
  return (
    name.includes("abort") ||
    msg.includes("aborted") ||
    msg.includes("aborterror") ||
    msg.includes("operation was aborted")
  );
}

async function sendViaWebhook(params: {
  provider: "webhook" | "selfhost";
  to: string;
  code: string;
  message: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
  preferAcceptedAck?: boolean;
}) {
  const cfg = resolveWebhookConfig({
    maxRetries: params.maxRetries,
    retryBaseMs: params.retryBaseMs,
  });
  if (!cfg.configured) {
    throw new Error("SMS webhook nao configurado. Defina SMS_WEBHOOK_URL.");
  }

  const ownGatewayNumber = normalizeOwnGatewayNumber(String(process.env.SMS_OWN_NUMBER || ""));
  const blockSelfSend = parseBool(process.env.SMS_BLOCK_SELF_SEND, false);

  if (blockSelfSend && ownGatewayNumber && samePhoneNumber(params.to, ownGatewayNumber)) {
    throw new Error(
      "Destino igual ao numero do gateway. Defina SMS_BLOCK_SELF_SEND=0 para permitir autoenvio.",
    );
  }

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
      dispatchMode: params.preferAcceptedAck ? "accepted" : "wait",
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
            ...(params.preferAcceptedAck ? { "X-Wyzer-Prefer-Ack": "accepted" } : {}),
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
      if (isAbortLikeError(error)) {
        throw new SmsDeliveryUncertainError(
          params.provider,
          "Requisicao ao gateway excedeu o tempo limite e foi abortada.",
        );
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

function shouldExposeProviderErrors() {
  const isProd = process.env.NODE_ENV === "production";
  return parseBool(process.env.SMS_EXPOSE_PROVIDER_ERRORS, !isProd);
}

async function sendViaConsole(params: { to: string; code: string; message: string }) {
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

export async function sendSmsCode(phoneE164: string, code: string, options?: SendSmsOptions) {
  const to = normalizeE164(phoneE164);
  const cleanCode = String(code || "").trim();

  if (!isLikelyE164(to)) {
    throw new Error("Telefone invalido para SMS. Informe um numero no formato E.164.");
  }

  if (!/^\d{7}$/.test(cleanCode)) {
    throw new Error("Codigo invalido para envio de SMS.");
  }

  const sendOptions = resolveSendSmsOptions(options);
  const message = buildCodeMessage(cleanCode);
  const debug = isSmsDebugEnabled();

  if (isDryRunEnabled()) {
    console.log("[SMS][dry-run] send skipped", {
      to: maskPhone(to),
      code: cleanCode,
      message,
      context: sendOptions.context,
      timeoutMs: sendOptions.timeoutMs,
      providerOrder: sendOptions.providerOrder,
      webhookMaxRetries: sendOptions.webhookMaxRetries,
      webhookRetryBaseMs: sendOptions.webhookRetryBaseMs,
      allowConsoleFallback: sendOptions.allowConsoleFallback,
      gatewayNumber: normalizeOwnGatewayNumber(String(process.env.SMS_OWN_NUMBER || "")),
    });
    return true;
  }

  const providerOrder = sendOptions.providerOrder;
  if (!providerOrder.length) {
    throw new Error(
      "Nenhum provedor de SMS habilitado. Configure SMS_PROVIDER e/ou habilite fallback de console.",
    );
  }

  const errors: string[] = [];
  const uncertainErrors: string[] = [];

  for (const provider of providerOrder) {
    try {
      let result: SmsSendResult | null = null;

      if (provider === "twilio") {
        result = await sendViaTwilio({
          to,
          message,
          timeoutMs: sendOptions.timeoutMs,
        });
      } else if (provider === "webhook" || provider === "selfhost") {
        result = await sendViaWebhook({
          provider,
          to,
          code: cleanCode,
          message,
          timeoutMs: sendOptions.timeoutMs,
          maxRetries: sendOptions.webhookMaxRetries,
          retryBaseMs: sendOptions.webhookRetryBaseMs,
          preferAcceptedAck: shouldPreferAcceptedAck(),
        });
      } else if (provider === "console") {
        if (!sendOptions.allowConsoleFallback) {
          errors.push("console: fallback desativado para este contexto");
          continue;
        }

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
          context: sendOptions.context,
        });
      }

      return true;
    } catch (error) {
      if (error instanceof SmsDeliveryUncertainError) {
        uncertainErrors.push(`${provider}: ${error.message}`);
        continue;
      }

      const msg = error instanceof Error ? error.message : "unknown_error";
      errors.push(`${provider}: ${msg}`);
    }
  }

  if (!errors.length && uncertainErrors.length > 0 && sendOptions.acceptUncertainDelivery) {
    console.warn("[SMS] uncertain delivery accepted", {
      to: maskPhone(to),
      context: sendOptions.context,
      providerOrder,
      uncertainErrors,
      gatewayNumber: normalizeOwnGatewayNumber(String(process.env.SMS_OWN_NUMBER || "")),
    });
    return true;
  }

  console.error("[SMS] all providers failed", {
    to: maskPhone(to),
    context: sendOptions.context,
    timeoutMs: sendOptions.timeoutMs,
    providerOrder,
    errors,
    uncertainErrors,
    gatewayNumber: normalizeOwnGatewayNumber(String(process.env.SMS_OWN_NUMBER || "")),
  });

  const joinedErrors = [...errors, ...uncertainErrors].join(" | ");
  if (joinedErrors.includes("Destino igual ao numero do gateway")) {
    throw new Error(
      "O telefone de destino e o mesmo numero do aparelho gateway. Troque o numero de destino ou permita autoenvio em SMS_BLOCK_SELF_SEND=0.",
    );
  }

  if (shouldExposeProviderErrors()) {
    throw new Error(`Falha ao enviar SMS. Detalhes: ${joinedErrors}`);
  }

  throw new Error("Falha ao enviar SMS no momento. Tente novamente em instantes.");
}

export async function sendAuthSmsCode(phoneE164: string, code: string) {
  return sendSmsCode(phoneE164, code, { context: "auth" });
}
