import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

function must(name: string, value?: string) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function pickFrom() {
  return must("WZ_EMAIL_FROM", process.env.WZ_EMAIL_FROM);
}

export async function sendLoginCodeEmail(to: string, code: string) {
  must("RESEND_API_KEY", process.env.RESEND_API_KEY);

  const from = pickFrom();
  const subject = "Seu código de acesso Wyzer";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui; line-height: 1.45; color: #111">
      <div style="max-width:520px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:16px">
        <h2 style="margin:0 0 10px">Confirme seu e-mail</h2>
        <p style="margin:0 0 18px;color:#555">Use o código abaixo para continuar:</p>

        <div style="display:inline-block;padding:14px 16px;border-radius:14px;background:#111;color:#fff;font-size:26px;letter-spacing:6px;font-weight:700">
          ${code}
        </div>

        <p style="margin:18px 0 0;color:#777;font-size:12px">
          Se você não solicitou, ignore este e-mail.
        </p>
      </div>
    </div>
  `;

  const result = await resend.emails.send({ from, to, subject, html });

  const anyRes = result as any;
  if (anyRes?.error) {
    console.error("[RESEND] error:", anyRes.error);
    throw new Error(anyRes.error?.message || "Resend falhou ao enviar o e-mail");
  }

  console.log("[RESEND] sent:", anyRes?.data?.id);
  return result;
}
