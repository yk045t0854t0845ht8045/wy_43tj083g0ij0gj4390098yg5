function must(name: string, value?: string) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function normalizeE164(v: string) {
  return String(v || "").trim().replace(/\s+/g, "");
}

function isLikelyE164(v: string) {
  // E.164 básico: +[10..15 dígitos]
  return /^\+\d{10,15}$/.test(normalizeE164(v));
}

function normalizeBaseUrl(raw: string) {
  let v = String(raw || "").trim().replace(/\/+$/g, "");
  if (!v) return v;

  // garante protocolo
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;

  // TextBee geralmente é /api/v1
  // Se o cara passar só "https://api.textbee.dev", a gente completa
  const u = new URL(v);
  const p = u.pathname.replace(/\/+$/g, "");
  if (!p || p === "/") u.pathname = "/api/v1";
  return u.toString().replace(/\/+$/g, "");
}

function maskPhone(phoneE164: string) {
  const d = phoneE164.replace(/\D+/g, "");
  if (d.length < 6) return phoneE164;
  return `+${d.slice(0, 2)}${"*".repeat(Math.max(0, d.length - 4))}${d.slice(-2)}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function safeJsonParse(raw: string) {
  try {
    return { ok: true as const, json: JSON.parse(raw) };
  } catch {
    return { ok: false as const, json: null as any };
  }
}

function extractTextBeeError(resStatus: number, rawBody: string, parsed: any) {
  // TextBee pode retornar 200 com um payload contendo erro (dependendo do gateway/estado).
  // A gente tenta normalizar alguns formatos comuns:
  const msg =
    String(
      parsed?.error?.message ||
        parsed?.error ||
        parsed?.message ||
        parsed?.msg ||
        "",
    ).trim() || "";

  const statusCode = Number(parsed?.statusCode || parsed?.code || 0);

  // Heurística: se o body tem statusCode >= 400 ou campo error, é falha
  const hasExplicitError =
    !!parsed?.error ||
    (Number.isFinite(statusCode) && statusCode >= 400) ||
    /unauthorized|forbidden|invalid|error|failed/i.test(msg);

  // Se veio HTML, geralmente URL/base errada (ex: bateu no site e não na API)
  const looksLikeHtml = /<html[\s>]/i.test(rawBody) || /<!doctype html>/i.test(rawBody);

  if (looksLikeHtml) {
    return `Resposta inesperada (HTML). Verifique TEXTBEE_BASE_URL (deve apontar para https://api.textbee.dev/api/v1).`;
  }

  if (resStatus >= 400) {
    return msg || `HTTP ${resStatus} ao chamar gateway SMS (TextBee).`;
  }

  if (hasExplicitError) {
    return msg || `Falha reportada pelo TextBee (payload com erro).`;
  }

  return "";
}

/**
 * ✅ NOVO: TextBee (substitui InfoBip)
 *
 * ENV necessários:
 * - TEXTBEE_API_KEY
 * - TEXTBEE_DEVICE_ID
 *
 * Opcional:
 * - TEXTBEE_BASE_URL (default: https://api.textbee.dev/api/v1)
 * - TEXTBEE_TIMEOUT_MS (default: 15000)
 * - TEXTBEE_DEBUG=1 (loga detalhes)
 */
export async function sendSmsCode(phoneE164: string, code: string) {
  const baseUrl = normalizeBaseUrl(process.env.TEXTBEE_BASE_URL || "https://api.textbee.dev/api/v1");
  const apiKey = must("TEXTBEE_API_KEY", process.env.TEXTBEE_API_KEY);
  const deviceId = must("TEXTBEE_DEVICE_ID", process.env.TEXTBEE_DEVICE_ID);

  const to = normalizeE164(phoneE164);

  if (!to || !isLikelyE164(to)) {
    throw new Error("Telefone inválido para SMS. Informe um número válido (E.164).");
  }

  const timeoutMs = Number(process.env.TEXTBEE_TIMEOUT_MS || 15000);
  const debug = process.env.TEXTBEE_DEBUG === "1";

  const url = `${baseUrl}/gateway/devices/${encodeURIComponent(deviceId)}/send-sms`;

  const payload = {
    recipients: [to],
    message: `Wyzer - Seu código de verificação: ${code}`,
  };

  let res: Response;
  let raw = "";

  try {
    res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
      timeoutMs,
    );

    raw = await res.text().catch(() => "");
  } catch (err: any) {
    const msg = String(err?.name || "").includes("AbortError")
      ? "Timeout ao enviar SMS (TextBee). Verifique se o device está online e se a API está acessível."
      : (err?.message || "Falha ao chamar TextBee.");
    console.error("[TEXTBEE] fetch exception:", msg);
    throw new Error("Falha ao enviar SMS. Tente novamente em instantes.");
  }

  const parsedTry = safeJsonParse(raw);
  const parsed = parsedTry.ok ? parsedTry.json : null;

  // Logs úteis (não vaza número completo)
  if (debug) {
    console.log("[TEXTBEE] send-sms response:", {
      httpStatus: res.status,
      to: maskPhone(to),
      bodyPreview: raw ? raw.slice(0, 400) : "",
    });
  }

  // Se HTTP != 2xx -> erro
  if (!res.ok) {
    const errMsg = extractTextBeeError(res.status, raw, parsed);
    console.error("[TEXTBEE] send-sms http error:", { status: res.status, errMsg, raw: raw?.slice(0, 600) });
    throw new Error(errMsg || "Falha ao enviar SMS. Verifique sua configuração no TextBee.");
  }

  // Mesmo em 2xx, pode haver erro no payload
  const errMsg = extractTextBeeError(res.status, raw, parsed);
  if (errMsg) {
    console.error("[TEXTBEE] send-sms payload error:", { errMsg, raw: raw?.slice(0, 600) });
    throw new Error(errMsg);
  }

  // Heurística de status (se existir)
  const status = String(parsed?.status || parsed?.data?.status || parsed?.data?.state || "").trim().toLowerCase();
  if (status && /fail|error|rejected|denied/.test(status)) {
    console.error("[TEXTBEE] send-sms status indicates failure:", { status, raw: raw?.slice(0, 600) });
    throw new Error("Falha ao enviar SMS (status retornado pelo gateway).");
  }

  // Se chegou aqui, a API aceitou o envio.
  // OBS: O envio real depende do Android gateway estar online, com permissões e SIM correto.
  return true;
}

/**
 * ------------------------------------------------------------
 * (Opcional) LEGACY InfoBip — mantido apenas para referência.
 * Se você não usa mais, pode remover depois.
 * ------------------------------------------------------------
 *
 * function normalizeBaseUrlInfobip(raw: string) { ... }
 * export async function sendSmsCodeInfobip(...) { ... }
 */
