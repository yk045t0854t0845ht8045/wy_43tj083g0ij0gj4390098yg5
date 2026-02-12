import crypto from "crypto";

export type LoginTwoFactorTicketPayload = {
  typ: "wz-login-2fa";
  uid: string;
  email: string;
  fullName?: string;
  iat: number;
  exp: number;
  nonce: string;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeFullName(value?: string | null) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.slice(0, 120);
}

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const padded = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + "=".repeat(padLen);
  return Buffer.from(withPad, "base64").toString("utf8");
}

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest(),
  );
}

export function createLoginTwoFactorTicket(params: {
  userId: string;
  email: string;
  fullName?: string | null;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 8);
  const safeFullName = sanitizeFullName(params.fullName);
  const payload: LoginTwoFactorTicketPayload = {
    typ: "wz-login-2fa",
    uid: String(params.userId || "").trim(),
    email: normalizeEmail(params.email),
    ...(safeFullName ? { fullName: safeFullName } : {}),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function readLoginTwoFactorTicket(params: { ticket: string; email?: string }) {
  const secret = getTicketSecret();
  if (!secret) {
    return {
      ok: false as const,
      error: "Configuracao de sessao ausente no servidor.",
    };
  }

  const token = String(params.ticket || "").trim();
  if (!token.includes(".")) {
    return {
      ok: false as const,
      error: "Sessao de autenticacao em 2 etapas invalida. Reinicie o login.",
    };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return {
      ok: false as const,
      error: "Sessao de autenticacao em 2 etapas invalida. Reinicie o login.",
    };
  }

  const expectedSig = signTicket(payloadB64, secret);
  if (expectedSig !== sig) {
    return {
      ok: false as const,
      error: "Sessao de autenticacao em 2 etapas invalida. Reinicie o login.",
    };
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as LoginTwoFactorTicketPayload;
    if (parsed?.typ !== "wz-login-2fa") {
      return {
        ok: false as const,
        error: "Sessao de autenticacao em 2 etapas invalida. Reinicie o login.",
      };
    }

    if (!parsed.uid || !parsed.email || parsed.exp < Date.now()) {
      return {
        ok: false as const,
        error: "Sessao de autenticacao em 2 etapas expirada. Reinicie o login.",
      };
    }

    const expectedEmail = normalizeEmail(params.email);
    const payloadEmail = normalizeEmail(parsed.email);
    if (expectedEmail && expectedEmail !== payloadEmail) {
      return {
        ok: false as const,
        error: "Sessao de autenticacao em 2 etapas invalida para este e-mail.",
      };
    }

    return {
      ok: true as const,
      payload: {
        ...parsed,
        email: payloadEmail,
        fullName: sanitizeFullName(parsed.fullName),
      } satisfies LoginTwoFactorTicketPayload,
    };
  } catch {
    return {
      ok: false as const,
      error: "Sessao de autenticacao em 2 etapas invalida. Reinicie o login.",
    };
  }
}
