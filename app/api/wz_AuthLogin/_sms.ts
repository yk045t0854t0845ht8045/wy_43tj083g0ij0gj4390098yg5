// _sms.ts

function must(name: string, value?: string) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function normalizeE164(v: string) {
  return String(v || "").trim().replace(/\s+/g, "");
}

function isLikelyE164(v: string) {
  return /^\+\d{10,15}$/.test(normalizeE164(v));
}

function normalizeBaseUrl(raw: string) {
  let v = String(raw || "").trim().replace(/\/+$/g, "");
  if (!v) return v;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

export async function sendSmsCode(phoneE164: string, code: string) {
  // ✅ textbee.dev (Android SMS Gateway)
  // Base padrão da API: https://api.textbee.dev/api/v1
  const baseUrl = normalizeBaseUrl(
    process.env.TEXTBEE_BASE_URL || "https://api.textbee.dev/api/v1",
  );

  const apiKey = must("TEXTBEE_API_KEY", process.env.TEXTBEE_API_KEY);
  const deviceId = must("TEXTBEE_DEVICE_ID", process.env.TEXTBEE_DEVICE_ID);

  const to = normalizeE164(phoneE164);

  if (!to || !isLikelyE164(to)) {
    throw new Error("Telefone inválido para SMS. Informe um número válido (E.164).");
  }

  const url = `${baseUrl}/gateway/devices/${deviceId}/send-sms`;

  const payload = {
    recipients: [to],
    message: `Wyzer - Seu código de verificação: ${code}`,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[TEXTBEE] sendSmsCode error:", { status: res.status, text });
      throw new Error("Falha ao enviar SMS. Verifique sua configuração na textbee.dev.");
    }
  } catch (err: any) {
    console.error("[TEXTBEE] sendSmsCode exception:", err?.message || err);
    throw new Error("Falha ao enviar SMS. Tente novamente em instantes.");
  }
}
