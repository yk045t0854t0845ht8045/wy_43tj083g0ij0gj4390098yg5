import crypto from "crypto";

type PasskeyAuthProofPayload = {
  typ: "wz-passkey-auth-proof";
  uid: string;
  email: string;
  iat: number;
  exp: number;
  nonce: string;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
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
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

export function createPasskeyAuthProof(params: {
  userId: string;
  email: string;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const payload: PasskeyAuthProofPayload = {
    typ: "wz-passkey-auth-proof",
    uid: String(params.userId || "").trim(),
    email: normalizeEmail(params.email),
    iat: Date.now(),
    exp: Date.now() + Number(params.ttlMs ?? 1000 * 60 * 3),
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function readPasskeyAuthProof(params: {
  proof: string;
  userId: string;
  email: string;
}) {
  const secret = getTicketSecret();
  if (!secret) {
    return {
      ok: false as const,
      error: "Configuracao de sessao ausente no servidor.",
    };
  }

  const token = String(params.proof || "").trim();
  if (!token.includes(".")) {
    return {
      ok: false as const,
      error: "Validacao do Windows Hello invalida. Tente novamente.",
    };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return {
      ok: false as const,
      error: "Validacao do Windows Hello invalida. Tente novamente.",
    };
  }

  if (signTicket(payloadB64, secret) !== sig) {
    return {
      ok: false as const,
      error: "Validacao do Windows Hello invalida. Tente novamente.",
    };
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as PasskeyAuthProofPayload;
    if (parsed?.typ !== "wz-passkey-auth-proof") {
      return {
        ok: false as const,
        error: "Validacao do Windows Hello invalida. Tente novamente.",
      };
    }

    const expectedUserId = String(params.userId || "").trim();
    const expectedEmail = normalizeEmail(params.email);
    const payloadUserId = String(parsed.uid || "").trim();
    const payloadEmail = normalizeEmail(parsed.email);

    if (!payloadUserId || !payloadEmail || parsed.exp < Date.now()) {
      return {
        ok: false as const,
        error: "Validacao do Windows Hello expirada. Tente novamente.",
      };
    }

    if (expectedUserId && expectedUserId !== payloadUserId) {
      return {
        ok: false as const,
        error: "Validacao do Windows Hello invalida para esta conta.",
      };
    }

    if (expectedEmail && expectedEmail !== payloadEmail) {
      return {
        ok: false as const,
        error: "Validacao do Windows Hello invalida para esta conta.",
      };
    }

    return {
      ok: true as const,
      payload: {
        ...parsed,
        uid: payloadUserId,
        email: payloadEmail,
      },
    };
  } catch {
    return {
      ok: false as const,
      error: "Validacao do Windows Hello invalida. Tente novamente.",
    };
  }
}
