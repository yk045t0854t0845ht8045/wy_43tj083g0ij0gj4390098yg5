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
  const baseUrl = normalizeBaseUrl(
    must("INFOBIP_BASE_URL", process.env.INFOBIP_BASE_URL),
  );
  const apiKey = must("INFOBIP_API_KEY", process.env.INFOBIP_API_KEY);
  const sender = must("INFOBIP_SENDER", process.env.INFOBIP_SENDER);

  const to = normalizeE164(phoneE164);

  if (!to || !isLikelyE164(to)) {
    throw new Error("Telefone inválido para SMS. Informe um número válido (E.164).");
  }

  const url = `${baseUrl}/sms/2/text/advanced`;

  const payload = {
    messages: [
      {
        from: sender,
        destinations: [{ to }],
        text: `Wyzer - Seu código de verificação: ${code}`,
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[INFOBIP] sendSmsCode error:", { status: res.status, text });
      throw new Error("Falha ao enviar SMS. Verifique sua configuração na Infobip.");
    }
  } catch (err: any) {
    console.error("[INFOBIP] sendSmsCode exception:", err?.message || err);
    throw new Error("Falha ao enviar SMS. Tente novamente em instantes.");
  }
}
