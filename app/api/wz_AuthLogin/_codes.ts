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
 * Mantido (legacy): converte para E.164 BR com validação mínima.
 * OBS: Para SMS (celular), prefira toE164BRMobile + isValidBRMobilePhoneDigits.
 */
export function toE164BR(rawDigits: string) {
  const d = onlyDigits(rawDigits);
  if (d.length < 10) return null;
  return `+55${d}`;
}

/** ✅ Lista oficial/prática de DDDs válidos no Brasil */
const BR_DDD_SET = new Set<string>([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46",
  "47","48","49",
  "51","53","54","55",
  "61","62","63","64","65","66","67",
  "68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
]);

/**
 * ✅ Validação forte de telefone BR (celular) para SMS:
 * - 11 dígitos (DD + 9xxxxxxxx)
 * - DDD válido
 * - 3º dígito = 9 (padrão celular BR)
 * - rejeita sequências óbvias (todos iguais / zeros, etc.)
 */
export function isValidBRMobilePhoneDigits(raw: string) {
  const d = onlyDigits(raw);

  if (d.length !== 11) return false;

  // rejeita repetição tipo 11111111111
  if (/^(\d)\1{10}$/.test(d)) return false;

  const ddd = d.slice(0, 2);
  if (!BR_DDD_SET.has(ddd)) return false;

  // celular BR: após DDD normalmente começa com 9
  if (d[2] !== "9") return false;

  const subscriber = d.slice(2); // 9xxxxxxxx
  if (/^0+$/.test(subscriber)) return false;

  return true;
}

/** ✅ Valida E.164 BR especificamente para celular (+55 + 11 dígitos) */
export function isValidE164BRMobile(phoneE164: string) {
  const d = onlyDigits(phoneE164);
  // +55 + 11 dígitos => 13 no total
  if (d.length !== 13) return false;
  if (!d.startsWith("55")) return false;
  const national = d.slice(2);
  return isValidBRMobilePhoneDigits(national);
}

/** ✅ Converte para E.164 BR (celular) com validação forte */
export function toE164BRMobile(rawDigits: string) {
  const d = onlyDigits(rawDigits);
  if (!isValidBRMobilePhoneDigits(d)) return null;
  return `+55${d}`;
}

/**
 * ✅ Validação REAL de CPF:
 * - 11 dígitos
 * - rejeita sequências repetidas
 * - valida dígitos verificadores
 * - rejeita alguns CPFs conhecidos inválidos de exemplo
 */
export function isValidCPF(rawCpf: string) {
  const cpf = onlyDigits(rawCpf);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // muito usado como "fake"
  if (cpf === "12345678909") return false;

  const calcCheck = (baseLen: number) => {
    let sum = 0;
    for (let i = 0; i < baseLen; i++) {
      sum += Number(cpf[i]) * (baseLen + 1 - i);
    }
    let mod = (sum * 10) % 11;
    if (mod === 10) mod = 0;
    return mod;
  };

  const d1 = calcCheck(9);
  if (d1 !== Number(cpf[9])) return false;

  const d2 = calcCheck(10);
  if (d2 !== Number(cpf[10])) return false;

  return true;
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
