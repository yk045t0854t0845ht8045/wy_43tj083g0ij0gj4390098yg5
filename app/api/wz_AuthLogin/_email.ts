import nodemailer, { type Transporter } from "nodemailer";

type SendLoginCodeEmailOptions = {
  heading?: string;
  subject?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

let cachedTransporter: Transporter | null = null;
let cachedTransportKey = "";

function must(name: string, value?: string) {
  const clean = String(value || "").trim();
  if (!clean) throw new Error(`Missing env: ${name}`);
  return clean;
}

function parseBool(name: string, raw: string | undefined, fallback: boolean) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return fallback;
  if (value === "1" || value === "true" || value === "yes" || value === "on")
    return true;
  if (value === "0" || value === "false" || value === "no" || value === "off")
    return false;
  throw new Error(`Invalid env boolean: ${name}=${raw}`);
}

function parsePort(raw: string) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`Invalid SMTP_PORT: ${raw}`);
  }
  return value;
}

function getSmtpConfig(): SmtpConfig {
  const host = must("SMTP_HOST", process.env.SMTP_HOST);
  const port = parsePort(must("SMTP_PORT", process.env.SMTP_PORT));
  const secure = parseBool("SMTP_SECURE", process.env.SMTP_SECURE, port === 465);
  const user = must("SMTP_USER", process.env.SMTP_USER);
  const pass = must("SMTP_PASS", process.env.SMTP_PASS);
  const from = must("WZ_EMAIL_FROM", process.env.WZ_EMAIL_FROM);
  return { host, port, secure, user, pass, from };
}

function getTransporter(config: SmtpConfig) {
  const key = `${config.host}:${config.port}:${config.secure ? "secure" : "starttls"}:${config.user}`;
  if (cachedTransporter && cachedTransportKey === key) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });
  cachedTransportKey = key;
  return cachedTransporter;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPublicOrigin() {
  const raw = String(process.env.DASHBOARD_ORIGIN || "").trim();
  if (raw) return raw.replace(/\/+$/g, "");
  return "https://dashboard.wyzer.com.br";
}

function buildHtml(heading: string, code: string) {
  const safeHeading = escapeHtml(heading);
  const safeCode = escapeHtml(code);
  const origin = getPublicOrigin();
  const logoUrl = "https://www.wyzer.com.br/lg/Lg_Black.svg";
  const helpUrl = escapeHtml(`${origin}/ajuda`);
  const termsUrl = "https://terms.wyzer.com.br";
  const privacyUrl = "https://privacy.wyzer.com.br";
  const cookiesUrl = escapeHtml(`${origin}/cookies`);
  return `
    <div style="font-family: ui-sans-serif, system-ui; line-height: 1.45; color: #111; background:#f6f6f7; padding:28px 16px;">
      <div style="max-width:560px;margin:0 auto;text-align:center;">
        <img src="${logoUrl}" alt="Wyzer" width="132" style="display:block;margin:0 auto 16px;height:auto;" />

        <div style="max-width:520px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:16px;background:#fff;text-align:left;">
          <h2 style="margin:0 0 10px">${safeHeading}</h2>
          <p style="margin:0 0 18px;color:#555">Use o codigo abaixo para continuar:</p>

          <div style="display:inline-block;padding:14px 16px;border-radius:14px;background:#111;color:#fff;font-size:26px;letter-spacing:6px;font-weight:700">
            ${safeCode}
          </div>

          <p style="margin:18px 0 0;color:#777;font-size:12px">
            Se voce nao solicitou, ignore este e-mail.
          </p>
        </div>

        <div style="margin:16px auto 0;text-align:center;">
          <div style="display:inline-block;padding:10px 22px;border-radius:14px;background:#f3f3f3;">
            <a href="${helpUrl}" target="_blank" rel="noopener noreferrer" style="font-size:14px;font-weight:700;color:#111;text-decoration:none;letter-spacing:0.2px;">AJUDA</a>
          </div>
          <p style="margin:12px 0 0;font-size:12px;color:#666;line-height:1.6;">
            <a href="${termsUrl}" target="_blank" rel="noopener noreferrer" style="color:#666;text-decoration:none;">TERMOS</a>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <a href="${privacyUrl}" target="_blank" rel="noopener noreferrer" style="color:#666;text-decoration:none;">POLITICA DE PRIVACIDADE</a>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <a href="${cookiesUrl}" target="_blank" rel="noopener noreferrer" style="color:#666;text-decoration:none;">COOKIES</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildText(heading: string, code: string) {
  const origin = getPublicOrigin();
  return [
    heading,
    "",
    "Use o codigo abaixo para continuar:",
    code,
    "",
    "Se voce nao solicitou, ignore este e-mail.",
    "",
    "AJUDA: " + `${origin}/ajuda`,
    "TERMOS: https://terms.wyzer.com.br",
    "POLITICA DE PRIVACIDADE: https://privacy.wyzer.com.br",
    "COOKIES: " + `${origin}/cookies`,
  ].join("\n");
}

function recipientAccepted(accepted: unknown[], target: string) {
  const targetLower = target.toLowerCase();
  return accepted.some((item) => {
    const normalized = String(item || "").trim().toLowerCase();
    return (
      normalized === targetLower ||
      normalized.includes(`<${targetLower}>`) ||
      normalized.includes(targetLower)
    );
  });
}

export async function sendLoginCodeEmail(
  to: string,
  code: string,
  options?: SendLoginCodeEmailOptions,
) {
  const target = must("to", to).toLowerCase();
  const cleanCode = String(code || "").trim();
  if (!/^\d{7}$/.test(cleanCode)) {
    throw new Error("Codigo invalido para envio de e-mail.");
  }

  const config = getSmtpConfig();
  const transporter = getTransporter(config);
  const subject = String(options?.subject || "").trim() || "Seu codigo de acesso Wyzer";
  const heading = String(options?.heading || "").trim() || "Confirme seu e-mail";

  const info = await transporter.sendMail({
    from: config.from,
    to: target,
    subject,
    text: buildText(heading, cleanCode),
    html: buildHtml(heading, cleanCode),
    headers: {
      "X-Mailer": "Wyzer SMTP Mailer",
    },
  });

  const accepted = Array.isArray(info.accepted) ? info.accepted : [];
  if (!recipientAccepted(accepted, target)) {
    console.error("[SMTP] send rejected:", {
      to: target,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
    throw new Error("SMTP nao confirmou o destinatario do e-mail.");
  }

  console.log("[SMTP] sent:", info.messageId, "to:", target);
  return info;
}
