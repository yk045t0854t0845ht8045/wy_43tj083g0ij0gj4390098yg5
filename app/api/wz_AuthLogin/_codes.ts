import crypto from "crypto";

export function gen7() {
  const n = crypto.randomInt(1000000, 9999999);
  return String(n);
}

export function newSalt() {
  return crypto.randomBytes(16).toString("hex");
}

export function sha(code: string, salt: string) {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${code}`)
    .digest("hex");
}

export function onlyDigits(v: string) {
  return String(v || "").replace(/\D+/g, "");
}

/**
 * ✅ Normaliza telefone BR para DDD+Número (10 ou 11 dígitos).
 * - Se vier com "55" na frente, remove.
 * - Se vier maior que 11, mantém os últimos 11 (protege casos tipo +55...).
 */
export function normalizePhoneDigitsBR(raw: string) {
  let d = onlyDigits(raw);

  if (d.startsWith("55") && d.length >= 12) {
    d = d.slice(2);
  }

  if (d.length > 11) d = d.slice(-11);

  // aceita 10 ou 11 (DDD+8 ou DDD+9)
  if (d.length < 10) return "";
  if (d.length > 11) return d.slice(0, 11);
  return d;
}

export function toE164BR(rawDigits: string) {
  const d = normalizePhoneDigitsBR(rawDigits);
  if (!d || d.length < 10) return null;
  return `+55${d}`;
}

export function maskPhoneE164(phoneE164: string) {
  const d = onlyDigits(phoneE164);
  if (d.length < 12) return phoneE164;
  const a = d.slice(2, 4); // DDD
  const last = d.slice(-2);
  return `(${a}) *****-${last}`;
}

export function maskEmail(email: string) {
  const [u, d] = String(email || "").split("@");
  if (!d) return email;
  const user =
    u.length <= 2 ? `${u[0] || ""}*` : `${u.slice(0, 2)}***${u.slice(-1)}`;
  const domParts = d.split(".");
  const dom = domParts[0] || d;
  const tld = domParts.slice(1).join(".");
  const domMasked =
    dom.length <= 2
      ? `${dom[0] || ""}*`
      : `${dom.slice(0, 2)}***${dom.slice(-1)}`;
  return `${user}@${domMasked}${tld ? "." + tld : ""}`;
}
