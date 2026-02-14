"use client";

import Script from "next/script";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  Copy,
  ChevronRight,
  Monitor,
  Search,
  Smartphone,
  Undo2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ConfigSectionGroupId = "user" | "billing" | "app";

export type ConfigSectionId =
  | "my-account"
  | "content-social"
  | "privacy-data"
  | "family-center"
  | "authorized-apps"
  | "devices"
  | "connections"
  | "notifications"
  | "clips"
  | "nitro"
  | "server-boost"
  | "subscriptions"
  | "gift-inventory"
  | "billing"
  | "appearance"
  | "accessibility"
  | "voice-video";

type MenuItem = {
  id: ConfigSectionId;
  label: string;
  iconSrc: string;
  group: ConfigSectionGroupId;
};

type ConfigMainProps = {
  open: boolean;
  onClose: () => void;
  activeSection: ConfigSectionId;
  onSectionChange: (section: ConfigSectionId) => void;
  userNickname?: string;
  userFullName?: string;
  userEmail?: string;
  userPhoneE164?: string | null;
  userEmailChangedAt?: string | null;
  userPhoneChangedAt?: string | null;
  userPasswordChangedAt?: string | null;
  userSupportAccess?: boolean;
  userTwoFactorEnabled?: boolean;
  userTwoFactorEnabledAt?: string | null;
  userTwoFactorDisabledAt?: string | null;
  userAccountCreatedAt?: string | null;
  userPhotoLink?: string | null;
  onUserPhotoChange?: (photoLink: string | null) => void;
  onUserEmailChange?: (email: string, changedAt?: string | null) => void;
  onUserPhoneChange?: (phoneE164: string | null, changedAt?: string | null) => void;
  onUserPasswordChange?: (changedAt?: string | null) => void;
  onUserSupportAccessChange?: (enabled: boolean) => void;
  onUserTwoFactorChange?: (enabled: boolean, changedAt?: string | null) => void;
};

type AccountActionTwoFactorContext =
  | "email"
  | "phone"
  | "password"
  | "two-factor-disable"
  | "two-factor-enable"
  | "passkey"
  | "passkey-disable";

type PasskeyVerificationMethod = "none" | "email" | "two-factor";
type PasskeyFlowMode = "activate" | "disable";
type AccountActionAuthMethod = "choose" | "totp" | "passkey";
type AccountActionAuthMethodsPayload = { totp?: boolean; passkey?: boolean };
type AccountActionAuthResponsePayload = {
  requiresTwoFactor?: boolean;
  requiresPasskey?: boolean;
  authMethods?: AccountActionAuthMethodsPayload;
  error?: string;
};

type PasskeyCreateOptionsPayload = {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  excludeCredentials?: Array<{
    type: "public-key";
    id: string;
    transports?: string[];
  }>;
};

type PasskeyRequestOptionsPayload = {
  challenge: string;
  rpId: string;
  timeout?: number;
  userVerification?: "required" | "preferred" | "discouraged";
  allowCredentials?: Array<{
    type: "public-key";
    id: string;
    transports?: string[];
  }>;
};

type LordIconProps = React.HTMLAttributes<HTMLElement> & {
  src: string;
  trigger?: string;
  target?: string;
  state?: string;
  delay?: string | number;
  colors?: string;
};

// LINKS DOS ICONES (PNG) DA SIDEBAR DE CONFIGURAÇÕES
// Edite apenas estes caminhos/URLs para trocar os icones.
const CONFIG_SIDEBAR_ICON_LINKS = {
  "my-account": "/cdn/dashboard/sidebar-icons/conta.svg",
  "privacy-data": "/cdn/dashboard/sidebar-icons/privacidade.svg",
  "authorized-apps": "/cdn/dashboard/sidebar-icons/autorizados.svg",
  devices: "/cdn/dashboard/sidebar-icons/celular.svg",
  notifications: "/cdn/dashboard/sidebar-icons/sino.svg",
  subscriptions: "/cdn/dashboard/sidebar-icons/cartao.svg",
  billing: "/cdn/dashboard/sidebar-icons/dinheiro.svg",
  appearance: "/cdn/dashboard/sidebar-icons/customizacao.svg",
  accessibility: "/cdn/dashboard/sidebar-icons/social.svg",
  "voice-video": "/cdn/dashboard/sidebar-icons/video.svg",
} as const;

const AUTHORIZED_APPS_WYZER_ICON_URL = "https://www.wyzer.com.br/logo.svg";
const AUTHORIZED_APPS_GOOGLE_ICON_URL =
  "https://cdn.brandfetch.io/id6O2oGzv-/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1755835725776";
const AUTHORIZED_APPS_DISCORD_ICON_URL =
  "https://cdn.brandfetch.io/idM8Hlme1a/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1668075051777";
const AUTHORIZED_APPS_TOOLTIP_ICON_URL = "https://cdn.lordicon.com/tnapqovl.json";

const menuItems: MenuItem[] = [
  { id: "my-account", label: "Minha Conta", iconSrc: CONFIG_SIDEBAR_ICON_LINKS["my-account"], group: "user" },
  { id: "privacy-data", label: "Dados e Privacidade", iconSrc: CONFIG_SIDEBAR_ICON_LINKS["privacy-data"], group: "user" },
  { id: "authorized-apps", label: "Aplicativos Autorizados", iconSrc: CONFIG_SIDEBAR_ICON_LINKS["authorized-apps"], group: "user" },
  { id: "devices", label: "Dispositivos", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.devices, group: "user" },
  { id: "notifications", label: "Notificações", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.notifications, group: "user" },
  { id: "subscriptions", label: "Assinaturas", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.subscriptions, group: "billing" },
  { id: "billing", label: "Cobrança", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.billing, group: "billing" },
  { id: "appearance", label: "Aparência", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.appearance, group: "app" },
  { id: "accessibility", label: "Acessibilidade", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.accessibility, group: "app" },
  { id: "voice-video", label: "Voz e Vídeo", iconSrc: CONFIG_SIDEBAR_ICON_LINKS["voice-video"], group: "app" },
];

const sectionTitles: Record<ConfigSectionId, string> = {
  "my-account": "Minha Conta",
  "content-social": "Conteúdo e Social",
  "privacy-data": "Dados e Privacidade",
  "family-center": "Central da Familia",
  "authorized-apps": "Aplicativos Autorizados",
  devices: "Dispositivos",
  connections: "Conexões",
  notifications: "Notificações",
  clips: "Clipes",
  nitro: "Nitro",
  "server-boost": "Impulso de servidor",
  subscriptions: "Assinaturas",
  "gift-inventory": "Inventário de presentes",
  billing: "Cobrança",
  appearance: "Aparência",
  accessibility: "Acessibilidade",
  "voice-video": "Voz e Vídeo",
};

const AVATAR_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml";
const AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const CROP_SIZE = 320;
const EXPORT_SIZE = 512;
const AVATAR_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeForSearch(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isValidEmail(value: string) {
  const clean = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(clean);
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D+/g, "");
}

function resolveExternalAuthProviderName(provider?: string | null) {
  const clean = String(provider || "").trim().toLowerCase();
  if (clean === "google") return "Google";
  if (clean === "discord") return "Discord";
  if (clean === "github") return "GitHub";
  if (clean === "apple") return "Apple";
  if (clean === "microsoft") return "Microsoft";
  return null;
}

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

function isValidBRMobilePhoneDigits(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  if (!BR_DDD_SET.has(d.slice(0, 2))) return false;
  if (d[2] !== "9") return false;
  return true;
}

function normalizeE164Phone(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (clean.startsWith("+")) return `+${onlyDigits(clean)}`;
  const digits = onlyDigits(clean);
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  if (digits.length === 11) return `+55${digits}`;
  return "";
}

function parsePhoneInputToE164(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return "";

  if (clean.startsWith("+")) {
    const normalized = `+${onlyDigits(clean)}`;
    return /^\+55\d{11}$/.test(normalized) ? normalized : "";
  }

  const digits = onlyDigits(clean);
  if (digits.length === 13 && digits.startsWith("55")) {
    const normalized = `+${digits}`;
    return /^\+55\d{11}$/.test(normalized) ? normalized : "";
  }

  if (!isValidBRMobilePhoneDigits(digits)) return "";
  return `+55${digits}`;
}

function formatPhoneBR(value: string) {
  const digits = onlyDigits(value).replace(/^55/, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const left = digits.slice(2, 7);
  const right = digits.slice(7, 11);
  if (digits.length <= 2) return ddd;
  if (digits.length <= 7) return `(${ddd}) ${digits.slice(2)}`;
  return `(${ddd}) ${left}-${right}`;
}

function maskSecureEmail(value: string) {
  const [rawUser, rawDomain] = String(value || "").trim().toLowerCase().split("@");
  if (!rawUser || !rawDomain) return value;
  const visible = rawUser.slice(0, 3) || rawUser.slice(0, 1);
  return `${visible}${"*".repeat(9)}@${rawDomain}`;
}

function maskSecurePhone(value?: string | null) {
  const normalized = normalizeE164Phone(value);
  const national = onlyDigits(normalized).replace(/^55/, "");
  if (national.length !== 11) return "Não Alterado";
  return `${national.slice(0, 4)}${"*".repeat(7)}`;
}

function normalizeBase64Url(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToUint8Array(value: string) {
  const normalized = normalizeBase64Url(value);
  if (!normalized) return new Uint8Array();
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = typeof window !== "undefined" ? window.atob(padded.replace(/-/g, "+").replace(/_/g, "/")) : "";
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isPasskeySupportedInBrowser() {
  if (typeof window === "undefined") return false;
  return Boolean(window.PublicKeyCredential && navigator.credentials?.create);
}

function isPasskeyAssertionSupportedInBrowser() {
  if (typeof window === "undefined") return false;
  return Boolean(window.PublicKeyCredential && navigator.credentials?.get);
}

function normalizeIsoDatetime(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function formatElapsedTimeLabel(value?: string | null, nowMs = Date.now()) {
  const normalized = normalizeIsoDatetime(value);
  if (!normalized) return "agora";

  const diffMs = Math.max(0, nowMs - Date.parse(normalized));
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMinutes <= 0) return "agora";
  if (diffMinutes < 60) {
    return `${diffMinutes} minuto${diffMinutes === 1 ? "" : "s"}`;
  }
  if (diffHours < 24) {
    return `${diffHours} hora${diffHours === 1 ? "" : "s"}`;
  }
  if (diffDays < 30) {
    return `${diffDays} dia${diffDays === 1 ? "" : "s"}`;
  }
  if (diffMonths < 12) {
    return `${diffMonths} mes${diffMonths === 1 ? "" : "es"}`;
  }
  return `${diffYears} ano${diffYears === 1 ? "" : "s"}`;
}

function normalizePhotoLink(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function resolveFileType(file: File) {
  const fromMime = String(file.type || "").toLowerCase();
  if (fromMime) return fromMime;

  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".svg")) return "image/svg+xml";
  return "";
}

async function cropToBlob(params: {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    next.src = params.src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Falhá ao iniciar canvas.");

  const displayW = params.naturalWidth * params.scale;
  const displayH = params.naturalHeight * params.scale;
  const topLeftX = CROP_SIZE / 2 - displayW / 2 + params.offsetX;
  const topLeftY = CROP_SIZE / 2 - displayH / 2 + params.offsetY;
  const sx = (0 - topLeftX) / params.scale;
  const sy = (0 - topLeftY) / params.scale;
  const sw = CROP_SIZE / params.scale;
  const sh = CROP_SIZE / params.scale;

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, EXPORT_SIZE, EXPORT_SIZE);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível exportar o avatar."))),
      "image/png",
      0.95
    );
  });
}

function CodeBoxes({
  length,
  value,
  onChange,
  onComplete,
  disabled,
  variant = "default",
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  variant?: "default" | "dark";
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const lastCompletedRef = useRef<string>("");

  const digits = useMemo(() => {
    const clean = onlyDigits(value).slice(0, length);
    return Array.from({ length }, (_, i) => clean[i] || "");
  }, [value, length]);

  useEffect(() => {
    const clean = onlyDigits(value).slice(0, length);
    if (clean.length !== length) {
      lastCompletedRef.current = "";
      return;
    }
    if (clean === lastCompletedRef.current) return;
    lastCompletedRef.current = clean;
    onComplete?.(clean);
  }, [length, onComplete, value]);

  const focusAt = (index: number) => {
    refs.current[index]?.focus();
  };

  const setAt = (index: number, char: string) => {
    const clean = onlyDigits(value).slice(0, length).split("");
    while (clean.length < length) clean.push("");
    clean[index] = char;
    onChange(clean.join(""));
  };

  return (
    <div className="mt-5 flex w-full items-center justify-center gap-1 sm:gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => {
            if (disabled) return;
            const char = onlyDigits(e.target.value).slice(-1);
            setAt(i, char);
            if (char && i < length - 1) focusAt(i + 1);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Backspace") {
              if (digits[i]) {
                setAt(i, "");
              } else if (i > 0) {
                focusAt(i - 1);
                setAt(i - 1, "");
              }
            }
            if (e.key === "ArrowLeft" && i > 0) focusAt(i - 1);
            if (e.key === "ArrowRight" && i < length - 1) focusAt(i + 1);
          }}
          onPaste={(e) => {
            if (disabled) return;
            e.preventDefault();
            const pasted = onlyDigits(e.clipboardData.getData("text") || "").slice(0, length);
            if (!pasted) return;
            onChange(pasted);
            focusAt(Math.min(pasted.length, length - 1));
          }}
          className={cx(
            variant === "dark"
              ? "h-11 w-8 rounded-[10px] border border-white/14 bg-black/[0.58] text-center text-[16px] font-semibold text-white/94 sm:h-12 sm:w-10 sm:rounded-[12px] sm:text-[18px]"
              : "h-11 w-8 rounded-[10px] border border-black/12 bg-[#ececef] text-center text-[16px] font-semibold text-black/85 sm:h-12 sm:w-10 sm:rounded-[12px] sm:text-[18px]",
            variant === "dark"
              ? "focus:outline-none focus:ring-2 focus:ring-white/18"
              : "focus:outline-none focus:ring-2 focus:ring-black/20",
            disabled ? "cursor-not-allowed opacity-70" : ""
          )}
        />
      ))}
    </div>
  );
}

function AccountContent({
  nickname,
  email,
  phoneE164,
  emailChangedAt,
  phoneChangedAt,
  passwordChangedAt,
  accountCreatedAt,
  supportAccess: initialSupportAccess = false,
  twoFactorEnabled: initialTwoFactorEnabled,
  twoFactorEnabledAt: initialTwoFactorEnabledAt,
  twoFactorDisabledAt: initialTwoFactorDisabledAt,
  userPhotoLink,
  onUserPhotoChange,
  onUserEmailChange,
  onUserPhoneChange,
  onUserPasswordChange,
  onUserSupportAccessChange,
  onUserTwoFactorChange,
}: {
  nickname: string;
  email: string;
  phoneE164?: string | null;
  emailChangedAt?: string | null;
  phoneChangedAt?: string | null;
  passwordChangedAt?: string | null;
  accountCreatedAt?: string | null;
  supportAccess?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorEnabledAt?: string | null;
  twoFactorDisabledAt?: string | null;
  userPhotoLink?: string | null;
  onUserPhotoChange?: (photoLink: string | null) => void;
  onUserEmailChange?: (email: string, changedAt?: string | null) => void;
  onUserPhoneChange?: (phoneE164: string | null, changedAt?: string | null) => void;
  onUserPasswordChange?: (changedAt?: string | null) => void;
  onUserSupportAccessChange?: (enabled: boolean) => void;
  onUserTwoFactorChange?: (enabled: boolean, changedAt?: string | null) => void;
}) {
  const [supportAccess, setSupportAccess] = useState(() => Boolean(initialSupportAccess));
  const [savingSupportAccess, setSavingSupportAccess] = useState(false);
  const [supportAccessError, setSupportAccessError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localEmail, setLocalEmail] = useState(() => String(email || "").trim().toLowerCase());
  const [localPhoneE164, setLocalPhoneE164] = useState(() => normalizeE164Phone(phoneE164));
  const [localEmailChangedAt, setLocalEmailChangedAt] = useState<string | null>(() =>
    normalizeIsoDatetime(emailChangedAt)
  );
  const [localPhoneChangedAt, setLocalPhoneChangedAt] = useState<string | null>(() =>
    normalizeIsoDatetime(phoneChangedAt)
  );
  const [localPasswordChangedAt, setLocalPasswordChangedAt] = useState<string | null>(() =>
    normalizeIsoDatetime(passwordChangedAt)
  );
  const [localPrimaryAuthProvider, setLocalPrimaryAuthProvider] = useState<
    "password" | "google" | "discord" | "apple" | "github" | "microsoft" | "unknown"
  >("password");
  const [localMustCreatePassword, setLocalMustCreatePassword] = useState(false);
  const normalizedAccountCreatedAt = useMemo(
    () => normalizeIsoDatetime(accountCreatedAt),
    [accountCreatedAt]
  );
  const [relativeFallbackBaseAt] = useState(() => new Date().toISOString());
  const [relativeNowMs, setRelativeNowMs] = useState(() => Date.now());
  const [localPhoto, setLocalPhoto] = useState<string | null>(normalizePhotoLink(userPhotoLink));
  const [editorOpen, setEditorOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<
    "confirm-current-intro" | "confirm-current-code" | "new-email-input" | "confirm-new-code"
  >("confirm-current-intro");
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailChangeTicket, setEmailChangeTicket] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailForceTwoFactor, setEmailForceTwoFactor] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);
  const [source, setSource] = useState("");
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [resendingEmailCode, setResendingEmailCode] = useState(false);
  const [verifyingEmailCode, setVerifyingEmailCode] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneStep, setPhoneStep] = useState<
    "confirm-current-intro" | "confirm-current-code" | "new-phone-input" | "confirm-new-code"
  >("confirm-current-intro");
  const [pendingPhone, setPendingPhone] = useState("");
  const [phoneChangeTicket, setPhoneChangeTicket] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneForceTwoFactor, setPhoneForceTwoFactor] = useState(false);
  const [phoneChangeError, setPhoneChangeError] = useState<string | null>(null);
  const [phoneResendCooldown, setPhoneResendCooldown] = useState(0);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [resendingPhoneCode, setResendingPhoneCode] = useState(false);
  const [verifyingPhoneCode, setVerifyingPhoneCode] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordStep, setPasswordStep] = useState<"form" | "confirm-code">("form");
  const [passwordChangeTicket, setPasswordChangeTicket] = useState("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState("");
  const [passwordCode, setPasswordCode] = useState("");
  const [passwordCodePhoneMask, setPasswordCodePhoneMask] = useState<string | null>(null);
  const [passwordForceTwoFactor, setPasswordForceTwoFactor] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordResendCooldown, setPasswordResendCooldown] = useState(0);
  const [sendingPasswordCode, setSendingPasswordCode] = useState(false);
  const [resendingPasswordCode, setResendingPasswordCode] = useState(false);
  const [verifyingPasswordCode, setVerifyingPasswordCode] = useState(false);
  const [accountActionTwoFactorModalOpen, setAccountActionTwoFactorModalOpen] = useState(false);
  const [accountActionTwoFactorContext, setAccountActionTwoFactorContext] =
    useState<AccountActionTwoFactorContext | null>(null);
  const [accountActionTwoFactorCode, setAccountActionTwoFactorCode] = useState("");
  const [accountActionTwoFactorError, setAccountActionTwoFactorError] = useState<string | null>(
    null
  );
  const [accountActionTwoFactorShakeTick, setAccountActionTwoFactorShakeTick] = useState(0);
  const [accountActionTwoFactorUiLoading, setAccountActionTwoFactorUiLoading] = useState(false);
  const [accountActionAuthMethod, setAccountActionAuthMethod] =
    useState<AccountActionAuthMethod>("totp");
  const [accountActionAllowTotp, setAccountActionAllowTotp] = useState(true);
  const [accountActionAllowPasskey, setAccountActionAllowPasskey] = useState(false);
  const [verifyingAccountActionPasskey, setVerifyingAccountActionPasskey] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(() =>
    Boolean(initialTwoFactorEnabled)
  );
  const [, setTwoFactorEnabledAt] = useState<string | null>(() =>
    normalizeIsoDatetime(initialTwoFactorEnabledAt)
  );
  const [, setTwoFactorDisabledAt] = useState<string | null>(() =>
    normalizeIsoDatetime(initialTwoFactorDisabledAt)
  );
  const [twoFactorStatusLoaded, setTwoFactorStatusLoaded] = useState(false);
  const [loadingTwoFactorStatus, setLoadingTwoFactorStatus] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState<
    "enable-verify-app" | "disable-intro" | "disable-verify-email" | "disable-verify-app"
  >("enable-verify-app");
  const [twoFactorEnableSubStep, setTwoFactorEnableSubStep] = useState<"setup" | "verify">("setup");
  const [twoFactorTicket, setTwoFactorTicket] = useState("");
  const [twoFactorManualCode, setTwoFactorManualCode] = useState("");
  const [twoFactorQrCodeDataUrl, setTwoFactorQrCodeDataUrl] = useState("");
  const [twoFactorEmailMask, setTwoFactorEmailMask] = useState("");
  const [twoFactorAppCode, setTwoFactorAppCode] = useState("");
  const [twoFactorEmailCode, setTwoFactorEmailCode] = useState("");
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorResendCooldown, setTwoFactorResendCooldown] = useState(0);
  const [startingTwoFactorFlow, setStartingTwoFactorFlow] = useState(false);
  const [resendingTwoFactorCode, setResendingTwoFactorCode] = useState(false);
  const [verifyingTwoFactorStep, setVerifyingTwoFactorStep] = useState(false);
  const [twoFactorRecoveryModalOpen, setTwoFactorRecoveryModalOpen] = useState(false);
  const [twoFactorRecoveryCodes, setTwoFactorRecoveryCodes] = useState<string[]>([]);
  const [twoFactorRecoveryDownloaded, setTwoFactorRecoveryDownloaded] = useState(false);
  const [copiedRecoveryCode, setCopiedRecoveryCode] = useState<string | null>(null);
  const [copyingTwoFactorCode, setCopyingTwoFactorCode] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const [passkeyModalOpen, setPasskeyModalOpen] = useState(false);
  const [passkeyDisableIntroModalOpen, setPasskeyDisableIntroModalOpen] = useState(false);
  const [passkeyStatusLoaded, setPasskeyStatusLoaded] = useState(false);
  const [loadingPasskeyStatus, setLoadingPasskeyStatus] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [passkeyCredentialCount, setPasskeyCredentialCount] = useState(0);
  const [passkeyFlowMode, setPasskeyFlowMode] = useState<PasskeyFlowMode>("activate");
  const [passkeyVerificationMethod, setPasskeyVerificationMethod] =
    useState<PasskeyVerificationMethod>("none");
  const [passkeyAwaitingDisableAuth, setPasskeyAwaitingDisableAuth] = useState(false);
  const [passkeyTicket, setPasskeyTicket] = useState("");
  const [passkeyEmailMask, setPasskeyEmailMask] = useState("");
  const [passkeyEmailCode, setPasskeyEmailCode] = useState("");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyResendCooldown, setPasskeyResendCooldown] = useState(0);
  const [startingPasskeyFlow, setStartingPasskeyFlow] = useState(false);
  const [resendingPasskeyCode, setResendingPasskeyCode] = useState(false);
  const [verifyingPasskeyCode, setVerifyingPasskeyCode] = useState(false);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  const accountActionPasskeyAutoStartRef = useRef("");

  useEffect(() => setLocalPhoto(normalizePhotoLink(userPhotoLink)), [userPhotoLink]);
  useEffect(() => setLocalEmail(String(email || "").trim().toLowerCase()), [email]);
  useEffect(() => setLocalPhoneE164(normalizeE164Phone(phoneE164)), [phoneE164]);
  useEffect(() => setLocalEmailChangedAt(normalizeIsoDatetime(emailChangedAt)), [emailChangedAt]);
  useEffect(() => setLocalPhoneChangedAt(normalizeIsoDatetime(phoneChangedAt)), [phoneChangedAt]);
  useEffect(() => setLocalPasswordChangedAt(normalizeIsoDatetime(passwordChangedAt)), [passwordChangedAt]);
  useEffect(() => setSupportAccess(Boolean(initialSupportAccess)), [initialSupportAccess]);

  useEffect(() => {
    let cancelled = false;

    const loadAuthorizedProviders = async () => {
      try {
        const res = await fetch("/api/wz_users/authorized-apps", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          primaryProvider?: string;
          mustCreatePassword?: boolean;
        };
        if (!res.ok || !payload?.ok || cancelled) return;

        const provider = String(payload.primaryProvider || "").trim().toLowerCase();
        if (
          provider === "password" ||
          provider === "google" ||
          provider === "discord" ||
          provider === "apple" ||
          provider === "github" ||
          provider === "microsoft" ||
          provider === "unknown"
        ) {
          setLocalPrimaryAuthProvider(provider);
        }
        setLocalMustCreatePassword(Boolean(payload.mustCreatePassword));
      } catch {
        if (!cancelled) {
          setLocalPrimaryAuthProvider("password");
          setLocalMustCreatePassword(false);
        }
      }
    };

    void loadAuthorizedProviders();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (twoFactorModalOpen) return;
    setTwoFactorEnabled(Boolean(initialTwoFactorEnabled));
    setTwoFactorEnabledAt(normalizeIsoDatetime(initialTwoFactorEnabledAt));
    setTwoFactorDisabledAt(normalizeIsoDatetime(initialTwoFactorDisabledAt));
  }, [
    initialTwoFactorDisabledAt,
    initialTwoFactorEnabled,
    initialTwoFactorEnabledAt,
    twoFactorModalOpen,
  ]);

  useEffect(() => {
    const refresh = () => setRelativeNowMs(Date.now());
    const timer = window.setInterval(refresh, 60000);

    // Atualiza imediatamente ao voltar para a aba/app.
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPageShow = () => refresh();

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (emailModalOpen) return;
    setPendingEmail("");
  }, [emailModalOpen, localEmail]);

  useEffect(() => {
    if (phoneModalOpen) return;
    setPendingPhone("");
  }, [phoneModalOpen, localPhoneE164]);

  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setEmailResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailResendCooldown]);

  useEffect(() => {
    if (phoneResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setPhoneResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phoneResendCooldown]);

  useEffect(() => {
    if (passwordResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setPasswordResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [passwordResendCooldown]);

  useEffect(() => {
    if (twoFactorResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setTwoFactorResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [twoFactorResendCooldown]);

  useEffect(() => {
    if (passkeyResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setPasskeyResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [passkeyResendCooldown]);

  const baseScale = useMemo(() => {
    if (!natural.width || !natural.height) return 1;
    return Math.max(CROP_SIZE / natural.width, CROP_SIZE / natural.height);
  }, [natural.height, natural.width]);
  const scale = baseScale * zoom;

  const clampOffset = useCallback(
    (candidate: { x: number; y: number }, nextScale: number) => {
      if (!natural.width || !natural.height || !Number.isFinite(nextScale) || nextScale <= 0) {
        return { x: 0, y: 0 };
      }
      const displayW = natural.width * nextScale;
      const displayH = natural.height * nextScale;
      const limitX = Math.max((displayW - CROP_SIZE) / 2, 0);
      const limitY = Math.max((displayH - CROP_SIZE) / 2, 0);
      return { x: clamp(candidate.x, -limitX, limitX), y: clamp(candidate.y, -limitY, limitY) };
    },
    [natural.height, natural.width]
  );

  useEffect(() => setOffset((prev) => clampOffset(prev, scale)), [clampOffset, scale]);

  const openPicker = () => !saving && fileInputRef.current?.click();

  const onFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0] || null;
      event.target.value = "";
      if (!file) return;
      const resolvedType = resolveFileType(file);
      if (!AVATAR_ALLOWED_TYPES.has(resolvedType)) {
        setError("Formato inválido. Use PNG, JPG, JPEG, WEBP, GIF ou SVG.");
        return;
      }
      if (file.size > AVATAR_MAX_SIZE) {
        setError("A imagem deve ter no maximo 5MB.");
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      setError(null);
      setSource(dataUrl);
      setNatural({ width: 0, height: 0 });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setEditorOpen(true);
    } catch (err) {
      console.error("[config-account] file pick failed:", err);
      setError("Não foi possível abrir a imagem.");
    }
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setSource("");
    setNatural({ width: 0, height: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    pointerIdRef.current = null;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (saving) return;
    pointerIdRef.current = event.pointerId;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    offsetStartRef.current = offset;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    const candidate = {
      x: offsetStartRef.current.x + (event.clientX - pointerStartRef.current.x),
      y: offsetStartRef.current.y + (event.clientY - pointerStartRef.current.y),
    };
    setOffset(clampOffset(candidate, scale));
  };

  const stopDrag = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && pointerIdRef.current === event.pointerId) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // no-op
      }
    }
    pointerIdRef.current = null;
    setDragging(false);
  };

  const saveAvatar = async () => {
    if (!source || !natural.width || !natural.height) return;

    try {
      setSaving(true);
      setError(null);
      const blob = await cropToBlob({
        src: source,
        naturalWidth: natural.width,
        naturalHeight: natural.height,
        scale,
        offsetX: offset.x,
        offsetY: offset.y,
      });

      if (blob.size > AVATAR_MAX_SIZE) {
        throw new Error("A imagem final ficou acima de 5MB.");
      }

      const form = new FormData();
      form.append("file", new File([blob], "avatar.png", { type: "image/png" }));
      const res = await fetch("/api/wz_users/profile-photo", { method: "POST", body: form });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        photoLink?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.photoLink) {
        throw new Error(payload.error || "Não foi possível salvar a foto de perfil.");
      }

      const next = normalizePhotoLink(payload.photoLink);
      if (!next) throw new Error("Resposta inválida do servidor.");
      setLocalPhoto(next);
      onUserPhotoChange?.(next);
      closeEditor();
    } catch (err) {
      console.error("[config-account] save avatar failed:", err);
      setError(err instanceof Error ? err.message : "Erro ao salvar foto de perfil.");
    } finally {
      setSaving(false);
    }
  };

  const removeAvatar = async () => {
    if (!localPhoto || saving || removing) return;

    try {
      setRemoving(true);
      setError(null);

      const res = await fetch("/api/wz_users/profile-photo", { method: "DELETE" });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível remover a foto de perfil.");
      }

      setLocalPhoto(null);
      onUserPhotoChange?.(null);
      closeEditor();
    } catch (err) {
      console.error("[config-account] remove avatar failed:", err);
      setError(err instanceof Error ? err.message : "Erro ao remover foto de perfil.");
    } finally {
      setRemoving(false);
    }
  };

  const toggleSupportAccess = async () => {
    if (savingSupportAccess) return;
    const nextValue = !supportAccess;

    try {
      setSavingSupportAccess(true);
      setSupportAccessError(null);

      const res = await fetch("/api/wz_users/support-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextValue }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        active?: boolean;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível atualizar o acesso para suporte.");
      }

      const normalizedActive = Boolean(payload.active);
      setSupportAccess(normalizedActive);
      onUserSupportAccessChange?.(normalizedActive);
    } catch (err) {
      console.error("[config-account] toggle support access failed:", err);
      setSupportAccessError(
        err instanceof Error ? err.message : "Erro ao atualizar acesso para suporte."
      );
    } finally {
      setSavingSupportAccess(false);
    }
  };

  const emailRequiresTwoFactor =
    emailStep === "confirm-new-code" && (twoFactorEnabled || emailForceTwoFactor);
  const phoneRequiresTwoFactor =
    phoneStep === "confirm-new-code" && (twoFactorEnabled || phoneForceTwoFactor);
  const passwordRequiresTwoFactor =
    passwordStep === "confirm-code" && (twoFactorEnabled || passwordForceTwoFactor);
  const isPasskeyBusy =
    startingPasskeyFlow ||
    resendingPasskeyCode ||
    verifyingPasskeyCode ||
    registeringPasskey;
  const accountActionTwoFactorBusy =
    (accountActionTwoFactorContext === "email" && verifyingEmailCode) ||
    (accountActionTwoFactorContext === "phone" && verifyingPhoneCode) ||
    (accountActionTwoFactorContext === "password" && verifyingPasswordCode) ||
    ((accountActionTwoFactorContext === "passkey" ||
      accountActionTwoFactorContext === "passkey-disable") &&
      verifyingPasskeyCode) ||
    ((accountActionTwoFactorContext === "two-factor-disable" ||
      accountActionTwoFactorContext === "two-factor-enable") &&
      verifyingTwoFactorStep) ||
    verifyingAccountActionPasskey;
  const accountActionTwoFactorInvalidError = useMemo(() => {
    const message = String(accountActionTwoFactorError || "").trim();
    if (!message) return null;
    return /(inválido|inv\u00e1lido)/i.test(message) ? message : null;
  }, [accountActionTwoFactorError]);

  const setAccountActionTwoFactorFeedback = useCallback((message?: string | null) => {
    const nextMessage = String(message || "").trim();
    if (!nextMessage) {
      setAccountActionTwoFactorError(null);
      return;
    }
    setAccountActionTwoFactorError(nextMessage);
    if (/(inválido|inv\u00e1lido)/i.test(nextMessage)) {
      setAccountActionTwoFactorShakeTick((value) => value + 1);
    }
  }, []);

  const clearAccountActionTwoFactorFeedback = useCallback(() => {
    setAccountActionTwoFactorError(null);
  }, []);

  const resetAccountActionTwoFactorModal = useCallback(() => {
    accountActionPasskeyAutoStartRef.current = "";
    setAccountActionTwoFactorModalOpen(false);
    setAccountActionTwoFactorContext(null);
    setAccountActionTwoFactorCode("");
    setAccountActionTwoFactorError(null);
    setAccountActionTwoFactorShakeTick(0);
    setAccountActionTwoFactorUiLoading(false);
    setAccountActionAuthMethod("totp");
    setAccountActionAllowTotp(true);
    setAccountActionAllowPasskey(false);
    setVerifyingAccountActionPasskey(false);
  }, []);

  const closeAccountActionTwoFactorModal = useCallback(() => {
    const context = accountActionTwoFactorContext;
    resetAccountActionTwoFactorModal();
    if (context === "two-factor-disable") {
      setTwoFactorAppCode("");
      if (twoFactorStep === "disable-verify-app") {
        setTwoFactorError("Confirmação final da desativação cancelada.");
        return;
      }
      setTwoFactorStep("disable-intro");
      setTwoFactorError(null);
      return;
    }
    if (context === "two-factor-enable") {
      setTwoFactorEnableSubStep("setup");
      setTwoFactorAppCode("");
      setTwoFactorError(null);
      return;
    }
    if (context === "passkey") {
      setPasskeyError("Validação em 2 etapas cancelada.");
      return;
    }
    if (context === "passkey-disable") {
      setPasskeyError("Confirmação da desativação do Windows Hello cancelada.");
    }
  }, [accountActionTwoFactorContext, resetAccountActionTwoFactorModal, twoFactorStep]);

  const openAccountActionTwoFactorModal = useCallback(
    (
      context: AccountActionTwoFactorContext,
      errorMessage?: string | null,
      methods?: AccountActionAuthMethodsPayload | null
    ) => {
      const fallbackPasskeyAvailable =
        context === "passkey-disable"
          ? passkeyEnabled
          : context !== "two-factor-enable" && twoFactorEnabled && passkeyEnabled;
      const allowTotp =
        typeof methods?.totp === "boolean" ? methods.totp : true;
      const allowPasskey =
        typeof methods?.passkey === "boolean"
          ? methods.passkey
          : fallbackPasskeyAvailable;
      const defaultMethod: AccountActionAuthMethod =
        allowTotp && allowPasskey ? "choose" : allowPasskey ? "passkey" : "totp";
      const preservingCurrentMethod =
        accountActionTwoFactorModalOpen &&
        accountActionTwoFactorContext === context &&
        accountActionAuthMethod !== "choose" &&
        (
          (accountActionAuthMethod === "totp" && allowTotp) ||
          (accountActionAuthMethod === "passkey" && allowPasskey)
        );
      const nextMethod = preservingCurrentMethod ? accountActionAuthMethod : defaultMethod;

      accountActionPasskeyAutoStartRef.current = "";
      setAccountActionTwoFactorContext(context);
      setAccountActionTwoFactorModalOpen(true);
      setAccountActionTwoFactorCode("");
      setAccountActionAllowTotp(allowTotp);
      setAccountActionAllowPasskey(allowPasskey);
      setAccountActionAuthMethod(nextMethod);
      setVerifyingAccountActionPasskey(false);
      setAccountActionTwoFactorFeedback(errorMessage ? String(errorMessage) : null);
    },
    [
      accountActionAuthMethod,
      accountActionTwoFactorContext,
      accountActionTwoFactorModalOpen,
      passkeyEnabled,
      setAccountActionTwoFactorFeedback,
      twoFactorEnabled,
    ]
  );

  useEffect(() => {
    if (!accountActionTwoFactorModalOpen) {
      setAccountActionTwoFactorUiLoading(false);
      return;
    }
    setAccountActionTwoFactorUiLoading(true);
    const timer = window.setTimeout(() => {
      setAccountActionTwoFactorUiLoading(false);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [accountActionTwoFactorContext, accountActionTwoFactorModalOpen]);

  const resetEmailChangeFlow = useCallback(
    () => {
      setEmailStep("confirm-current-intro");
      setPendingEmail("");
      setEmailCode("");
      setEmailForceTwoFactor(false);
      setEmailChangeTicket("");
      setEmailChangeError(null);
      setEmailResendCooldown(0);
      resetAccountActionTwoFactorModal();
    },
    [resetAccountActionTwoFactorModal]
  );

  const closeEmailModal = () => {
    if (sendingEmailCode || resendingEmailCode || verifyingEmailCode) return;
    setEmailModalOpen(false);
    resetEmailChangeFlow();
  };

  const openEmailModal = () => {
    if (sendingEmailCode || resendingEmailCode || verifyingEmailCode) return;
    resetEmailChangeFlow();
    setEmailModalOpen(true);
  };

  const startCurrentEmailConfirmation = async () => {
    if (sendingEmailCode || resendingEmailCode || verifyingEmailCode) return;

    try {
      setSendingEmailCode(true);
      setEmailChangeError(null);

      const res = await fetch("/api/wz_users/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.ticket) {
        throw new Error(payload.error || "Não foi possível enviar o código de verificação.");
      }

      setEmailChangeTicket(payload.ticket);
      setEmailCode("");
      setEmailStep("confirm-current-code");
      setEmailResendCooldown(60);
    } catch (err) {
      console.error("[config-account] start current email confirmation failed:", err);
      setEmailChangeError(
        err instanceof Error ? err.message : "Erro ao iniciar confirmação do e-mail atual."
      );
    } finally {
      setSendingEmailCode(false);
    }
  };

  const sendNewEmailCode = async () => {
    if (!emailChangeTicket) {
      setEmailChangeError("Sessão de alteração inválida. Reabra o modal.");
      return;
    }
    if (sendingEmailCode || resendingEmailCode || verifyingEmailCode) return;

    const nextEmail = String(pendingEmail || "").trim().toLowerCase();
    if (!isValidEmail(nextEmail)) {
      setEmailChangeError("Digite um e-mail valido.");
      return;
    }
    if (nextEmail === localEmail) {
      setEmailChangeError("Informe um e-mail diferente do atual.");
      return;
    }

    try {
      setSendingEmailCode(true);
      setEmailChangeError(null);

      const res = await fetch("/api/wz_users/change-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: emailChangeTicket, newEmail: nextEmail }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        nextEmail?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.ticket) {
        throw new Error(payload.error || "Não foi possível enviar o código para o novo e-mail.");
      }

      setEmailChangeTicket(payload.ticket);
      setPendingEmail(String(payload.nextEmail || nextEmail).trim().toLowerCase());
      setEmailCode("");
      setEmailForceTwoFactor(false);
      setEmailStep("confirm-new-code");
      setEmailResendCooldown(60);
    } catch (err) {
      console.error("[config-account] send new email code failed:", err);
      setEmailChangeError(
        err instanceof Error ? err.message : "Erro ao enviar código para o novo e-mail."
      );
    } finally {
      setSendingEmailCode(false);
    }
  };

  const resendEmailChangeCode = async () => {
    if (!emailChangeTicket || emailResendCooldown > 0) return;
    if (sendingEmailCode || resendingEmailCode || verifyingEmailCode) return;

    try {
      setResendingEmailCode(true);
      setEmailChangeError(null);

      const res = await fetch("/api/wz_users/change-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: emailChangeTicket }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível reenviar o código.");
      }

      if (payload.ticket) {
        setEmailChangeTicket(payload.ticket);
      }
      setEmailResendCooldown(60);
    } catch (err) {
      console.error("[config-account] resend email change code failed:", err);
      setEmailChangeError(err instanceof Error ? err.message : "Erro ao reenviar código.");
    } finally {
      setResendingEmailCode(false);
    }
  };

  const verifyEmailChangeCode = async (
    nextValue?: string,
    providedTwoFactorCode?: string,
    providedPasskeyProof?: string
  ) => {
    if (!emailChangeTicket) {
      setEmailChangeError("Sessão de alteração inválida. Reabra o modal.");
      return;
    }
    if (sendingEmailCode || resendingEmailCode || verifyingEmailCode) return;

    const code = onlyDigits(String(nextValue || emailCode || "")).slice(0, 7);
    if (code.length !== 7) return;
    const twoFactorCode = onlyDigits(String(providedTwoFactorCode || "")).slice(0, 6);
    const passkeyProof = String(providedPasskeyProof || "").trim();
    const usedAccountActionAuth = twoFactorCode.length === 6 || Boolean(passkeyProof);

    try {
      setVerifyingEmailCode(true);
      setEmailChangeError(null);

      const res = await fetch("/api/wz_users/change-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: emailChangeTicket,
          code,
          ...(twoFactorCode.length === 6 ? { twoFactorCode } : {}),
          ...(passkeyProof ? { passkeyProof } : {}),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: "set-new";
        ticket?: string;
        email?: string;
        emailChangedAt?: string | null;
      } & AccountActionAuthResponsePayload;

      if (!res.ok || !payload.ok) {
        if (payload.requiresTwoFactor) {
          setEmailForceTwoFactor(true);
          setEmailCode(code);
          setEmailChangeError(null);
          const twoFactorMessage = String(
            payload.error || "Digite o código de 6 dígitos do aplicativo autenticador.",
          );
          openAccountActionTwoFactorModal(
            "email",
            usedAccountActionAuth ? twoFactorMessage : null,
            payload.authMethods,
          );
          return;
        }
        const fallback =
          res.status === 429
            ? "Você atingiu o limite de 7 tentativas. Reenvie o código."
            : "Código inválido. Tente novamente.";
        setEmailChangeError(String(payload.error || fallback));
        setEmailCode("");
        if (res.status === 429) {
          setEmailResendCooldown(0);
        }
        if (usedAccountActionAuth) {
          resetAccountActionTwoFactorModal();
        }
        return;
      }

      if (usedAccountActionAuth) {
        resetAccountActionTwoFactorModal();
      }

      if (payload.next === "set-new") {
        if (!payload.ticket) {
          throw new Error("Resposta inválida do servidor.");
        }
        setEmailChangeTicket(payload.ticket);
        setEmailCode("");
        setEmailForceTwoFactor(false);
        setEmailChangeError(null);
        setEmailStep("new-email-input");
        setEmailResendCooldown(0);
        return;
      }

      if (!payload.email) {
        throw new Error("Resposta inválida do servidor.");
      }

      const updatedEmail = String(payload.email || "").trim().toLowerCase();
      const nextEmailChangedAt =
        normalizeIsoDatetime(payload.emailChangedAt) || new Date().toISOString();
      setLocalEmail(updatedEmail);
      setLocalEmailChangedAt(nextEmailChangedAt);
      onUserEmailChange?.(updatedEmail, nextEmailChangedAt);
      setEmailModalOpen(false);
      resetEmailChangeFlow();
    } catch (err) {
      console.error("[config-account] verify email change code failed:", err);
      const message =
        err instanceof Error ? err.message : "Erro ao validar código de e-mail. Tente novamente.";
      if (usedAccountActionAuth) {
        setAccountActionTwoFactorFeedback(message);
      } else {
        setEmailChangeError(message);
      }
    } finally {
      setVerifyingEmailCode(false);
    }
  };

  const resetPhoneChangeFlow = useCallback(
    () => {
      setPhoneStep("confirm-current-intro");
      setPendingPhone("");
      setPhoneCode("");
      setPhoneForceTwoFactor(false);
      setPhoneChangeTicket("");
      setPhoneChangeError(null);
      setPhoneResendCooldown(0);
      resetAccountActionTwoFactorModal();
    },
    [resetAccountActionTwoFactorModal]
  );

  const closePhoneModal = () => {
    if (sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode) return;
    setPhoneModalOpen(false);
    resetPhoneChangeFlow();
  };

  const openPhoneModal = () => {
    if (sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode) return;
    resetPhoneChangeFlow();
    setPhoneModalOpen(true);
  };

  const startCurrentPhoneConfirmation = async () => {
    if (sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode) return;

    try {
      setSendingPhoneCode(true);
      setPhoneChangeError(null);

      const res = await fetch("/api/wz_users/change-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.ticket) {
        throw new Error(payload.error || "Não foi possível enviar o código de verificação por SMS.");
      }

      setPhoneChangeTicket(payload.ticket);
      setPhoneCode("");
      setPhoneStep("confirm-current-code");
      setPhoneResendCooldown(60);
    } catch (err) {
      console.error("[config-account] start current phone confirmation failed:", err);
      setPhoneChangeError(
        err instanceof Error ? err.message : "Erro ao iniciar confirmação do celular atual."
      );
    } finally {
      setSendingPhoneCode(false);
    }
  };

  const sendNewPhoneCode = async () => {
    if (!phoneChangeTicket) {
      setPhoneChangeError("Sessão de alteração inválida. Reabra o modal.");
      return;
    }
    if (sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode) return;

    const nextPhoneE164 = parsePhoneInputToE164(pendingPhone);
    if (!nextPhoneE164) {
      setPhoneChangeError("Digite um celular BR valido com DDD.");
      return;
    }
    if (nextPhoneE164 === localPhoneE164) {
      setPhoneChangeError("Informe um celular diferente do atual.");
      return;
    }

    try {
      setSendingPhoneCode(true);
      setPhoneChangeError(null);

      const res = await fetch("/api/wz_users/change-phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: phoneChangeTicket, newPhone: nextPhoneE164 }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.ticket) {
        throw new Error(payload.error || "Não foi possível enviar o código para o novo celular.");
      }

      setPhoneChangeTicket(payload.ticket);
      setPendingPhone(nextPhoneE164);
      setPhoneCode("");
      setPhoneForceTwoFactor(false);
      setPhoneStep("confirm-new-code");
      setPhoneResendCooldown(60);
    } catch (err) {
      console.error("[config-account] send new phone code failed:", err);
      setPhoneChangeError(
        err instanceof Error ? err.message : "Erro ao enviar código para o novo celular."
      );
    } finally {
      setSendingPhoneCode(false);
    }
  };

  const resendPhoneChangeCode = async () => {
    if (!phoneChangeTicket || phoneResendCooldown > 0) return;
    if (sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode) return;

    try {
      setResendingPhoneCode(true);
      setPhoneChangeError(null);

      const res = await fetch("/api/wz_users/change-phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: phoneChangeTicket }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível reenviar o código.");
      }

      if (payload.ticket) {
        setPhoneChangeTicket(payload.ticket);
      }
      setPhoneResendCooldown(60);
    } catch (err) {
      console.error("[config-account] resend phone change code failed:", err);
      setPhoneChangeError(err instanceof Error ? err.message : "Erro ao reenviar código.");
    } finally {
      setResendingPhoneCode(false);
    }
  };

  const verifyPhoneChangeCode = async (
    nextValue?: string,
    providedTwoFactorCode?: string,
    providedPasskeyProof?: string
  ) => {
    if (!phoneChangeTicket) {
      setPhoneChangeError("Sessão de alteração inválida. Reabra o modal.");
      return;
    }
    if (sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode) return;

    const code = onlyDigits(String(nextValue || phoneCode || "")).slice(0, 7);
    if (code.length !== 7) return;
    const twoFactorCode = onlyDigits(String(providedTwoFactorCode || "")).slice(0, 6);
    const passkeyProof = String(providedPasskeyProof || "").trim();
    const usedAccountActionAuth = twoFactorCode.length === 6 || Boolean(passkeyProof);

    try {
      setVerifyingPhoneCode(true);
      setPhoneChangeError(null);

      const res = await fetch("/api/wz_users/change-phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: phoneChangeTicket,
          code,
          ...(twoFactorCode.length === 6 ? { twoFactorCode } : {}),
          ...(passkeyProof ? { passkeyProof } : {}),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: "set-new";
        ticket?: string;
        phone?: string;
        phoneChangedAt?: string | null;
      } & AccountActionAuthResponsePayload;

      if (!res.ok || !payload.ok) {
        if (payload.requiresTwoFactor) {
          setPhoneForceTwoFactor(true);
          setPhoneCode(code);
          setPhoneChangeError(null);
          const twoFactorMessage = String(
            payload.error || "Digite o código de 6 dígitos do aplicativo autenticador.",
          );
          openAccountActionTwoFactorModal(
            "phone",
            usedAccountActionAuth ? twoFactorMessage : null,
            payload.authMethods,
          );
          return;
        }
        const fallback =
          res.status === 429
            ? "Você atingiu o limite de 7 tentativas. Reenvie o código."
            : "Código inválido. Tente novamente.";
        setPhoneChangeError(String(payload.error || fallback));
        setPhoneCode("");
        if (res.status === 429) {
          setPhoneResendCooldown(0);
        }
        if (usedAccountActionAuth) {
          resetAccountActionTwoFactorModal();
        }
        return;
      }

      if (usedAccountActionAuth) {
        resetAccountActionTwoFactorModal();
      }

      if (payload.next === "set-new") {
        if (!payload.ticket) {
          throw new Error("Resposta inválida do servidor.");
        }
        setPhoneChangeTicket(payload.ticket);
        setPhoneCode("");
        setPhoneForceTwoFactor(false);
        setPhoneChangeError(null);
        setPhoneStep("new-phone-input");
        setPhoneResendCooldown(0);
        return;
      }

      const updatedPhone = normalizeE164Phone(payload.phone);
      if (!updatedPhone) {
        throw new Error("Resposta inválida do servidor.");
      }

      const nextPhoneChangedAt =
        normalizeIsoDatetime(payload.phoneChangedAt) || new Date().toISOString();
      setLocalPhoneE164(updatedPhone);
      setLocalPhoneChangedAt(nextPhoneChangedAt);
      onUserPhoneChange?.(updatedPhone, nextPhoneChangedAt);
      setPhoneModalOpen(false);
      resetPhoneChangeFlow();
    } catch (err) {
      console.error("[config-account] verify phone change code failed:", err);
      const message =
        err instanceof Error ? err.message : "Erro ao validar código de celular. Tente novamente.";
      if (usedAccountActionAuth) {
        setAccountActionTwoFactorFeedback(message);
      } else {
        setPhoneChangeError(message);
      }
    } finally {
      setVerifyingPhoneCode(false);
    }
  };

  const resetPasswordChangeFlow = useCallback(() => {
    setPasswordStep("form");
    setPasswordChangeTicket("");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmNewPasswordInput("");
    setPasswordCode("");
    setPasswordCodePhoneMask(null);
    setPasswordForceTwoFactor(false);
    setPasswordChangeError(null);
    setPasswordResendCooldown(0);
    resetAccountActionTwoFactorModal();
  }, [resetAccountActionTwoFactorModal]);

  const closePasswordModal = () => {
    if (sendingPasswordCode || resendingPasswordCode || verifyingPasswordCode) return;
    setPasswordModalOpen(false);
    resetPasswordChangeFlow();
  };

  const openPasswordModal = () => {
    if (sendingPasswordCode || resendingPasswordCode || verifyingPasswordCode) return;
    resetPasswordChangeFlow();
    setPasswordModalOpen(true);
  };

  const startPasswordChange = async () => {
    if (sendingPasswordCode || resendingPasswordCode || verifyingPasswordCode) return;

    const requiresCurrentPassword = !localMustCreatePassword;
    const currentPassword = String(currentPasswordInput || "");
    const newPassword = String(newPasswordInput || "");
    const confirmNewPassword = String(confirmNewPasswordInput || "");

    if (requiresCurrentPassword && !currentPassword) {
      setPasswordChangeError("Informe a senha atual.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError("A confirmação da nova senha não confere.");
      return;
    }
    if (requiresCurrentPassword && newPassword === currentPassword) {
      setPasswordChangeError("A nova senha precisa ser diferente da senha atual.");
      return;
    }

    try {
      setSendingPasswordCode(true);
      setPasswordChangeError(null);

      const res = await fetch("/api/wz_users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
          requireCurrentPassword: requiresCurrentPassword,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        phoneMask?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.ticket) {
        throw new Error(payload.error || "Não foi possível enviar o código para alterar a senha.");
      }

      setPasswordChangeTicket(payload.ticket);
      setPasswordCodePhoneMask(
        typeof payload.phoneMask === "string" && payload.phoneMask.trim()
          ? payload.phoneMask.trim()
          : null
      );
      setPasswordCode("");
      setPasswordForceTwoFactor(false);
      setPasswordStep("confirm-code");
      setPasswordResendCooldown(60);
    } catch (err) {
      console.error("[config-account] start password change failed:", err);
      setPasswordChangeError(
        err instanceof Error ? err.message : "Erro ao iniciar alteração de senha."
      );
    } finally {
      setSendingPasswordCode(false);
    }
  };

  const resendPasswordChangeCode = async () => {
    if (!passwordChangeTicket || passwordResendCooldown > 0) return;
    if (sendingPasswordCode || resendingPasswordCode || verifyingPasswordCode) return;

    try {
      setResendingPasswordCode(true);
      setPasswordChangeError(null);

      const res = await fetch("/api/wz_users/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: passwordChangeTicket }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        phoneMask?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível reenviar o código.");
      }

      if (payload.ticket) {
        setPasswordChangeTicket(payload.ticket);
      }
      if (typeof payload.phoneMask === "string" && payload.phoneMask.trim()) {
        setPasswordCodePhoneMask(payload.phoneMask.trim());
      }
      setPasswordResendCooldown(60);
    } catch (err) {
      console.error("[config-account] resend password change code failed:", err);
      setPasswordChangeError(err instanceof Error ? err.message : "Erro ao reenviar código.");
    } finally {
      setResendingPasswordCode(false);
    }
  };

  const verifyPasswordChangeCode = async (
    nextValue?: string,
    providedTwoFactorCode?: string,
    providedPasskeyProof?: string
  ) => {
    if (!passwordChangeTicket) {
      setPasswordChangeError("Sessão de alteração inválida. Reabra o modal.");
      return;
    }
    if (sendingPasswordCode || resendingPasswordCode || verifyingPasswordCode) return;

    const code = onlyDigits(String(nextValue || passwordCode || "")).slice(0, 7);
    if (code.length !== 7) return;
    const twoFactorCode = onlyDigits(String(providedTwoFactorCode || "")).slice(0, 6);
    const passkeyProof = String(providedPasskeyProof || "").trim();
    const usedAccountActionAuth = twoFactorCode.length === 6 || Boolean(passkeyProof);

    try {
      setVerifyingPasswordCode(true);
      setPasswordChangeError(null);

      const res = await fetch("/api/wz_users/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: passwordChangeTicket,
          code,
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput,
          confirmNewPassword: confirmNewPasswordInput,
          requireCurrentPassword: !localMustCreatePassword,
          ...(twoFactorCode.length === 6 ? { twoFactorCode } : {}),
          ...(passkeyProof ? { passkeyProof } : {}),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        passwordChangedAt?: string | null;
      } & AccountActionAuthResponsePayload;

      if (!res.ok || !payload.ok) {
        if (payload.requiresTwoFactor) {
          setPasswordForceTwoFactor(true);
          setPasswordCode(code);
          setPasswordChangeError(null);
          const twoFactorMessage = String(
            payload.error || "Digite o código de 6 dígitos do aplicativo autenticador.",
          );
          openAccountActionTwoFactorModal(
            "password",
            usedAccountActionAuth ? twoFactorMessage : null,
            payload.authMethods,
          );
          return;
        }
        const fallback =
          res.status === 429
            ? "Você atingiu o limite de 7 tentativas. Reenvie o código."
            : "Código inválido. Tente novamente.";
        setPasswordChangeError(String(payload.error || fallback));
        setPasswordCode("");
        if (res.status === 429) {
          setPasswordResendCooldown(0);
        }
        if (usedAccountActionAuth) {
          resetAccountActionTwoFactorModal();
        }
        return;
      }

      if (usedAccountActionAuth) {
        resetAccountActionTwoFactorModal();
      }

      const nextPasswordChangedAt =
        normalizeIsoDatetime(payload.passwordChangedAt) || new Date().toISOString();
      setLocalPasswordChangedAt(nextPasswordChangedAt);
      setLocalMustCreatePassword(false);
      onUserPasswordChange?.(nextPasswordChangedAt);
      setPasswordModalOpen(false);
      resetPasswordChangeFlow();
    } catch (err) {
      console.error("[config-account] verify password change code failed:", err);
      const message = err instanceof Error ? err.message : "Erro ao validar código de senha.";
      if (usedAccountActionAuth) {
        setAccountActionTwoFactorFeedback(message);
      } else {
        setPasswordChangeError(message);
      }
    } finally {
      setVerifyingPasswordCode(false);
    }
  };

  const submitAccountActionTwoFactorCode = async (nextValue?: string) => {
    if (!accountActionTwoFactorContext) return;
    if (accountActionAuthMethod === "choose") return;
    if (accountActionAuthMethod === "passkey") {
      await verifyAccountActionWithWindowsHello();
      return;
    }

    const code = onlyDigits(String(nextValue || accountActionTwoFactorCode || "")).slice(0, 6);
    setAccountActionTwoFactorCode(code);
    if (code.length !== 6) return;

    clearAccountActionTwoFactorFeedback();
    if (accountActionTwoFactorContext === "email") {
      await verifyEmailChangeCode(undefined, code);
      return;
    }
    if (accountActionTwoFactorContext === "phone") {
      await verifyPhoneChangeCode(undefined, code);
      return;
    }
    if (accountActionTwoFactorContext === "two-factor-disable") {
      await verifyTwoFactorDisableAppCode(code);
      return;
    }
    if (accountActionTwoFactorContext === "two-factor-enable") {
      await verifyTwoFactorEnableCode(code);
      return;
    }
    if (accountActionTwoFactorContext === "passkey") {
      await verifyPasskeyActivation(undefined, code);
      return;
    }
    if (accountActionTwoFactorContext === "passkey-disable") {
      await verifyPasskeyDisable(undefined, code);
      return;
    }
    await verifyPasswordChangeCode(undefined, code);
  };

  const resetTwoFactorFlow = useCallback(() => {
    setTwoFactorStep("enable-verify-app");
    setTwoFactorEnableSubStep("setup");
    setTwoFactorTicket("");
    setTwoFactorManualCode("");
    setTwoFactorQrCodeDataUrl("");
    setTwoFactorEmailMask("");
    setTwoFactorAppCode("");
    setTwoFactorEmailCode("");
    setTwoFactorError(null);
    setTwoFactorResendCooldown(0);
    setCopyingTwoFactorCode("idle");
  }, []);

  const resetTwoFactorRecoveryModal = useCallback(() => {
    setTwoFactorRecoveryModalOpen(false);
    setTwoFactorRecoveryCodes([]);
    setTwoFactorRecoveryDownloaded(false);
    setCopiedRecoveryCode(null);
  }, []);

  const closeTwoFactorRecoveryModal = useCallback(() => {
    resetTwoFactorRecoveryModal();
  }, [resetTwoFactorRecoveryModal]);

  const downloadTwoFactorRecoveryCodesTxt = useCallback(() => {
    if (!twoFactorRecoveryCodes.length || typeof window === "undefined") return;

    const createdAt = new Date().toISOString().replace("T", " ").slice(0, 16);
    const text = [
      "WYZER - CÓDIGOS DE RECUPERAÇÃO (2 ETAPAS)",
      `Gerado em: ${createdAt} UTC`,
      "",
      "Guarde este arquivo em local seguro.",
      "Se você perder acesso ao e-mail e ao dispositivo autenticador, pode ficar sem acesso a conta.",
      "Estes códigos não expiram, mas cada código pode ser usado apenas uma vez.",
      "",
      ...twoFactorRecoveryCodes.map((code, index) => `${index + 1}. ${code}`),
      "",
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = href;
    link.download = `wyzer-códigos-recuperação-2fa-${datePart}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    setTwoFactorRecoveryDownloaded(true);
  }, [twoFactorRecoveryCodes]);

  const isTwoFactorBusy =
    startingTwoFactorFlow || resendingTwoFactorCode || verifyingTwoFactorStep;

  const loadTwoFactorStatus = useCallback(async () => {
    try {
      setLoadingTwoFactorStatus(true);
      const res = await fetch("/api/wz_users/two-factor", { method: "GET" });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        enabled?: boolean;
        twoFactorEnabledAt?: string | null;
        twoFactorDisabledAt?: string | null;
      };

      if (!res.ok || !payload.ok) {
        // Mantém o estado local quando a consulta falha para evitar "desativar visualmente" sem confirmação.
        return null as {
          enabled: boolean;
          twoFactorEnabledAt: string | null;
          twoFactorDisabledAt: string | null;
        } | null;
      }

      const nextStatus = {
        enabled: Boolean(payload.enabled),
        twoFactorEnabledAt: normalizeIsoDatetime(payload.twoFactorEnabledAt),
        twoFactorDisabledAt: normalizeIsoDatetime(payload.twoFactorDisabledAt),
      };
      setTwoFactorEnabled(nextStatus.enabled);
      setTwoFactorEnabledAt(nextStatus.twoFactorEnabledAt);
      setTwoFactorDisabledAt(nextStatus.twoFactorDisabledAt);
      onUserTwoFactorChange?.(
        nextStatus.enabled,
        nextStatus.enabled ? nextStatus.twoFactorEnabledAt : nextStatus.twoFactorDisabledAt
      );
      return nextStatus;
    } catch (err) {
      console.error("[config-account] load two-factor status failed:", err);
      return null;
    } finally {
      setLoadingTwoFactorStatus(false);
      setTwoFactorStatusLoaded(true);
    }
  }, [onUserTwoFactorChange]);

  useEffect(() => {
    void loadTwoFactorStatus();
  }, [loadTwoFactorStatus]);

  useEffect(() => {
    if (copyingTwoFactorCode === "idle") return;
    const timer = window.setTimeout(() => {
      setCopyingTwoFactorCode("idle");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [copyingTwoFactorCode]);

  useEffect(() => {
    if (!copiedRecoveryCode) return;
    const timer = window.setTimeout(() => {
      setCopiedRecoveryCode(null);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [copiedRecoveryCode]);

  const startTwoFactorEnableFlow = async () => {
    if (isTwoFactorBusy) return;

    try {
      setStartingTwoFactorFlow(true);
      setTwoFactorError(null);
      const res = await fetch("/api/wz_users/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "enable-start" }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        manualCode?: string;
        qrCodeDataUrl?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.ticket || !payload.manualCode || !payload.qrCodeDataUrl) {
        throw new Error(payload.error || "Não foi possível iniciar a configuração de 2 etapas.");
      }

      setTwoFactorStep("enable-verify-app");
      setTwoFactorEnableSubStep("setup");
      setTwoFactorTicket(payload.ticket);
      setTwoFactorManualCode(String(payload.manualCode || "").trim());
      setTwoFactorQrCodeDataUrl(String(payload.qrCodeDataUrl || ""));
      setTwoFactorAppCode("");
      setTwoFactorEmailCode("");
      setTwoFactorResendCooldown(0);
    } catch (err) {
      console.error("[config-account] start two-factor enable failed:", err);
      setTwoFactorError(err instanceof Error ? err.message : "Erro ao iniciar configuração de 2 etapas.");
    } finally {
      setStartingTwoFactorFlow(false);
    }
  };

  const startTwoFactorDisableFlow = async () => {
    if (isTwoFactorBusy) return;

    try {
      setStartingTwoFactorFlow(true);
      setTwoFactorError(null);
      const res = await fetch("/api/wz_users/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "disable-start" }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        phase?: "disable-verify-email";
        ticket?: string;
        emailMask?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.ticket) {
        throw new Error(payload.error || "Não foi possível iniciar a desativação de 2 etapas.");
      }

      setTwoFactorStep("disable-verify-email");
      setTwoFactorTicket(payload.ticket);
      setTwoFactorEmailMask(String(payload.emailMask || maskSecureEmail(localEmail)));
      setTwoFactorAppCode("");
      setTwoFactorEmailCode("");
      setTwoFactorResendCooldown(60);
    } catch (err) {
      console.error("[config-account] start two-factor disable failed:", err);
      setTwoFactorError(err instanceof Error ? err.message : "Erro ao iniciar desativação de 2 etapas.");
    } finally {
      setStartingTwoFactorFlow(false);
    }
  };

  const openTwoFactorModal = async () => {
    if (isTwoFactorBusy) return;
    resetTwoFactorFlow();
    resetTwoFactorRecoveryModal();
    setTwoFactorModalOpen(true);

    const optimisticEnabled = twoFactorEnabled;
    if (optimisticEnabled) {
      setTwoFactorStep("disable-intro");
      setTwoFactorEmailMask(maskSecureEmail(localEmail));
    }

    const status = await loadTwoFactorStatus();
    const shouldOpenDisableFlow = status ? status.enabled : optimisticEnabled;
    if (shouldOpenDisableFlow) {
      setTwoFactorStep("disable-intro");
      setTwoFactorEmailMask(maskSecureEmail(localEmail));
      return;
    }
    await startTwoFactorEnableFlow();
  };

  const closeTwoFactorModal = () => {
    if (isTwoFactorBusy) return;
    setTwoFactorModalOpen(false);
    resetTwoFactorFlow();
    resetTwoFactorRecoveryModal();
    resetAccountActionTwoFactorModal();
  };

  const copyTwoFactorManualCode = async () => {
    if (!twoFactorManualCode) return;
    try {
      await navigator.clipboard.writeText(twoFactorManualCode);
      setCopyingTwoFactorCode("copied");
    } catch {
      setCopyingTwoFactorCode("failed");
    }
  };

  const copyTwoFactorRecoveryCode = async (code: string) => {
    const clean = String(code || "").trim();
    if (!clean || typeof window === "undefined") return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clean);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = clean;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedRecoveryCode(clean);
    } catch {
      // noop
    }
  };

  const continueTwoFactorEnableFlow = () => {
    if (isTwoFactorBusy) return;
    if (!twoFactorTicket || !twoFactorManualCode || !twoFactorQrCodeDataUrl) {
      setTwoFactorError("Não foi possível carregar a configuração. Gere um novo QR code.");
      return;
    }
    setTwoFactorError(null);
    setTwoFactorAppCode("");
    setTwoFactorEnableSubStep("verify");
    openAccountActionTwoFactorModal("two-factor-enable");
  };

  const backToTwoFactorEnableSetup = () => {
    if (isTwoFactorBusy) return;
    setTwoFactorError(null);
    setTwoFactorAppCode("");
    setTwoFactorEnableSubStep("setup");
  };

  const verifyTwoFactorEnableCode = async (nextValue?: string) => {
    if (!twoFactorTicket || isTwoFactorBusy || twoFactorEnableSubStep !== "verify") return;
    const code = onlyDigits(String(nextValue || twoFactorAppCode || "")).slice(0, 6);
    if (code.length !== 6) return;
    const usingDynamicIslandForEnable =
      accountActionTwoFactorContext === "two-factor-enable" && accountActionTwoFactorModalOpen;

    try {
      setVerifyingTwoFactorStep(true);
      setTwoFactorError(null);
      if (usingDynamicIslandForEnable) {
        clearAccountActionTwoFactorFeedback();
      }

      const res = await fetch("/api/wz_users/two-factor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: twoFactorTicket, code }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        enabled?: boolean;
        twoFactorEnabledAt?: string | null;
        recoveryCodes?: string[];
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.enabled) {
        throw new Error(payload.error || "Código do aplicativo inválido.");
      }

      const recoveryCodes = Array.isArray(payload.recoveryCodes)
        ? payload.recoveryCodes
            .map((item) => onlyDigits(String(item || "")).slice(0, 6))
            .filter((item) => item.length === 6)
            .slice(0, 20)
        : [];
      if (!recoveryCodes.length) {
        throw new Error("Não foi possível gerar os códigos de recuperação. Tente novamente.");
      }

      const nextEnabledAt =
        normalizeIsoDatetime(payload.twoFactorEnabledAt) || new Date().toISOString();
      setTwoFactorEnabled(true);
      setTwoFactorEnabledAt(nextEnabledAt);
      setTwoFactorDisabledAt(null);
      onUserTwoFactorChange?.(true, nextEnabledAt);
      if (usingDynamicIslandForEnable) {
        resetAccountActionTwoFactorModal();
      }
      setTwoFactorModalOpen(false);
      resetTwoFactorFlow();
      setTwoFactorRecoveryCodes(recoveryCodes);
      setTwoFactorRecoveryDownloaded(false);
      setTwoFactorRecoveryModalOpen(true);
    } catch (err) {
      console.error("[config-account] verify two-factor enable failed:", err);
      const message =
        err instanceof Error ? err.message : "Erro ao validar código da autenticação em 2 etapas.";
      if (usingDynamicIslandForEnable) {
        setAccountActionTwoFactorFeedback(message);
        setAccountActionTwoFactorCode("");
      } else {
        setTwoFactorError(message);
      }
      setTwoFactorAppCode("");
    } finally {
      setVerifyingTwoFactorStep(false);
    }
  };

  const resendTwoFactorDisableEmailCode = async () => {
    if (!twoFactorTicket || twoFactorResendCooldown > 0 || isTwoFactorBusy) return;
    if (twoFactorStep !== "disable-verify-email") return;

    try {
      setResendingTwoFactorCode(true);
      setTwoFactorError(null);

      const res = await fetch("/api/wz_users/two-factor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: twoFactorTicket }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível reenviar o código.");
      }

      if (payload.ticket) {
        setTwoFactorTicket(String(payload.ticket));
      }
      setTwoFactorResendCooldown(60);
    } catch (err) {
      console.error("[config-account] resend two-factor disable email code failed:", err);
      setTwoFactorError(err instanceof Error ? err.message : "Erro ao reenviar código.");
    } finally {
      setResendingTwoFactorCode(false);
    }
  };

  const verifyTwoFactorDisableEmailCode = async (nextValue?: string) => {
    if (!twoFactorTicket || isTwoFactorBusy) return;
    if (twoFactorStep !== "disable-verify-email") return;
    const emailCode = onlyDigits(String(nextValue || twoFactorEmailCode || "")).slice(0, 7);
    if (emailCode.length !== 7) return;

    try {
      setVerifyingTwoFactorStep(true);
      setTwoFactorError(null);

      const res = await fetch("/api/wz_users/two-factor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: twoFactorTicket, emailCode }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: "verify-auth";
        phase?: "disable-verify-app";
        ticket?: string;
        authMethods?: AccountActionAuthMethodsPayload;
        error?: string;
      };

      if (
        !res.ok ||
        !payload.ok ||
        payload.next !== "verify-auth" ||
        payload.phase !== "disable-verify-app" ||
        !payload.ticket
      ) {
        const fallback =
          res.status === 429
            ? "Você atingiu o limite de tentativas. Reenvie o código."
            : "Código de e-mail inválido.";
        setTwoFactorError(String(payload.error || fallback));
        setTwoFactorEmailCode("");
        if (res.status === 429) {
          setTwoFactorResendCooldown(0);
        }
        return;
      }

      setTwoFactorStep("disable-verify-app");
      setTwoFactorTicket(String(payload.ticket));
      setTwoFactorAppCode("");
      setTwoFactorEmailCode("");
      setTwoFactorResendCooldown(0);
      openAccountActionTwoFactorModal(
        "two-factor-disable",
        null,
        payload.authMethods || { totp: true, passkey: passkeyEnabled },
      );
    } catch (err) {
      console.error("[config-account] verify two-factor disable email code failed:", err);
      setTwoFactorError(
        err instanceof Error ? err.message : "Erro ao validar código de e-mail."
      );
      setTwoFactorEmailCode("");
    } finally {
      setVerifyingTwoFactorStep(false);
    }
  };

  const verifyTwoFactorDisableAppCode = async (
    nextValue?: string,
    providedPasskeyProof?: string
  ) => {
    if (!twoFactorTicket || isTwoFactorBusy) return;
    if (twoFactorStep !== "disable-verify-app") return;
    const code = onlyDigits(String(nextValue || twoFactorAppCode || "")).slice(0, 6);
    const passkeyProof = String(providedPasskeyProof || "").trim();
    if (code.length !== 6 && !passkeyProof) return;
    const usingDynamicIslandForDisable =
      accountActionTwoFactorContext === "two-factor-disable" && accountActionTwoFactorModalOpen;

    try {
      setVerifyingTwoFactorStep(true);
      setTwoFactorError(null);
      if (usingDynamicIslandForDisable) {
        clearAccountActionTwoFactorFeedback();
      }

      const res = await fetch("/api/wz_users/two-factor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: twoFactorTicket,
          ...(code.length === 6 ? { code } : {}),
          ...(passkeyProof ? { passkeyProof } : {}),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        enabled?: boolean;
        twoFactorDisabledAt?: string | null;
      } & AccountActionAuthResponsePayload;

      if ((!res.ok || !payload.ok) && payload.requiresTwoFactor && usingDynamicIslandForDisable) {
        openAccountActionTwoFactorModal(
          "two-factor-disable",
          String(payload.error || "Código do aplicativo inválido."),
          payload.authMethods,
        );
        return;
      }

      if (!res.ok || !payload.ok || payload.enabled !== false) {
        throw new Error(payload.error || "Código do aplicativo inválido.");
      }

      const nextDisabledAt =
        normalizeIsoDatetime(payload.twoFactorDisabledAt) || new Date().toISOString();
      setTwoFactorEnabled(false);
      setTwoFactorEnabledAt(null);
      setTwoFactorDisabledAt(nextDisabledAt);
      onUserTwoFactorChange?.(false, nextDisabledAt);
      if (usingDynamicIslandForDisable) {
        resetAccountActionTwoFactorModal();
      }
      setTwoFactorModalOpen(false);
      resetTwoFactorFlow();
    } catch (err) {
      console.error("[config-account] verify two-factor disable app code failed:", err);
      const message =
        err instanceof Error ? err.message : "Erro ao validar código do aplicativo para desativar.";
      if (usingDynamicIslandForDisable) {
        setAccountActionTwoFactorFeedback(message);
        setAccountActionTwoFactorCode("");
      } else {
        setTwoFactorError(message);
      }
      setTwoFactorAppCode("");
    } finally {
      setVerifyingTwoFactorStep(false);
    }
  };

  const loadPasskeyStatus = useCallback(async () => {
    try {
      setLoadingPasskeyStatus(true);
      const res = await fetch("/api/wz_users/passkeys", { method: "GET" });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        schemaReady?: boolean;
        enabled?: boolean;
        credentialCount?: number;
      };

      if (!res.ok || !payload.ok) return;

      setPasskeyEnabled(Boolean(payload.enabled));
      setPasskeyCredentialCount(Math.max(0, Number(payload.credentialCount || 0)));
    } catch (err) {
      console.error("[config-account] load passkey status failed:", err);
    } finally {
      setLoadingPasskeyStatus(false);
      setPasskeyStatusLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadPasskeyStatus();
  }, [loadPasskeyStatus]);

  const resetPasskeyFlow = useCallback(() => {
    setPasskeyFlowMode("activate");
    setPasskeyVerificationMethod("none");
    setPasskeyAwaitingDisableAuth(false);
    setPasskeyTicket("");
    setPasskeyEmailMask(maskSecureEmail(localEmail));
    setPasskeyEmailCode("");
    setPasskeyError(null);
    setPasskeyResendCooldown(0);
    resetAccountActionTwoFactorModal();
  }, [localEmail, resetAccountActionTwoFactorModal]);

  const closePasskeyModal = () => {
    if (isPasskeyBusy) return;
    setPasskeyModalOpen(false);
    resetPasskeyFlow();
  };

  const closePasskeyDisableIntroModal = () => {
    if (isPasskeyBusy) return;
    setPasskeyDisableIntroModalOpen(false);
  };

  const registerPasskeyWithWindowsHello = async (
    registerTicket: string,
    optionsPayload: PasskeyCreateOptionsPayload
  ) => {
    if (!isPasskeySupportedInBrowser()) {
      throw new Error(
        "Seu navegador/dispositivo não suporta Windows Hello com passkey neste ambiente."
      );
    }

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: base64UrlToUint8Array(optionsPayload.challenge),
      rp: {
        id: String(optionsPayload.rp?.id || ""),
        name: String(optionsPayload.rp?.name || "Wyzer"),
      },
      user: {
        id: base64UrlToUint8Array(optionsPayload.user?.id || ""),
        name: String(optionsPayload.user?.name || localEmail),
        displayName: String(optionsPayload.user?.displayName || localEmail),
      },
      timeout: Number(optionsPayload.timeout || 60000),
      attestation: optionsPayload.attestation || "none",
      authenticatorSelection:
        optionsPayload.authenticatorSelection || {
          authenticatorAttachment: "platform",
          residentKey: "required",
          userVerification: "required",
        },
      pubKeyCredParams:
        Array.isArray(optionsPayload.pubKeyCredParams) &&
        optionsPayload.pubKeyCredParams.length > 0
          ? optionsPayload.pubKeyCredParams
          : [
              { type: "public-key", alg: -7 },
              { type: "public-key", alg: -257 },
            ],
      excludeCredentials: (optionsPayload.excludeCredentials || []).map((item) => ({
        type: "public-key",
        id: base64UrlToUint8Array(item.id),
        ...(item.transports?.length
          ? { transports: item.transports as AuthenticatorTransport[] }
          : {}),
      })),
    };

    setRegisteringPasskey(true);
    setPasskeyError(null);

    try {
      const created = (await navigator.credentials.create({
        publicKey,
      })) as PublicKeyCredential | null;

      if (!created) {
        throw new Error("Não foi possível criar a credencial do Windows Hello.");
      }

      const response =
        created.response as AuthenticatorAttestationResponse & {
          getTransports?: () => string[];
          getAuthenticatorData?: () => ArrayBuffer;
        };
      if (!response?.clientDataJSON || !response?.attestationObject) {
        throw new Error("Resposta inválida do dispositivo ao criar a passkey.");
      }

      const transports =
        typeof response.getTransports === "function" ? response.getTransports() : [];
      const authenticatorData =
        typeof response.getAuthenticatorData === "function"
          ? arrayBufferToBase64Url(response.getAuthenticatorData())
          : null;

      const finishRes = await fetch("/api/wz_users/passkeys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "finish",
          ticket: registerTicket,
          credential: {
            id: created.id,
            rawId: arrayBufferToBase64Url(created.rawId),
            type: created.type,
            response: {
              clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
              attestationObject: arrayBufferToBase64Url(response.attestationObject),
              authenticatorData,
              transports,
            },
          },
        }),
      });

      const finishPayload = (await finishRes.json().catch(() => ({}))) as {
        ok?: boolean;
        credentialCount?: number;
        error?: string;
      };

      if (!finishRes.ok || !finishPayload.ok) {
        throw new Error(
          finishPayload.error || "Não foi possível concluir a ativação do Windows Hello."
        );
      }

      setPasskeyEnabled(true);
      setPasskeyCredentialCount(
        Math.max(1, Number(finishPayload.credentialCount || passkeyCredentialCount || 0))
      );
      setPasskeyModalOpen(false);
      resetPasskeyFlow();
      void loadPasskeyStatus();
    } catch (err) {
      const domErr = err as DOMException;
      if (domErr?.name === "NotAllowedError") {
        throw new Error("Solicitação do Windows Hello cancelada.");
      }
      throw err;
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const verifyPasskeyActivation = async (
    nextValue?: string,
    providedTwoFactorCode?: string,
    providedPasskeyProof?: string
  ) => {
    if (!passkeyTicket || passkeyVerificationMethod === "none") return;
    if (startingPasskeyFlow || resendingPasskeyCode || verifyingPasskeyCode || registeringPasskey) {
      return;
    }

    const emailCode = onlyDigits(String(nextValue || passkeyEmailCode || "")).slice(0, 7);
    const twoFactorCode = onlyDigits(String(providedTwoFactorCode || "")).slice(0, 6);
    const passkeyProof = String(providedPasskeyProof || "").trim();
    if (passkeyVerificationMethod === "email" && emailCode.length !== 7) return;
    if (passkeyVerificationMethod === "two-factor" && twoFactorCode.length !== 6 && !passkeyProof) {
      return;
    }

    try {
      setVerifyingPasskeyCode(true);
      setPasskeyError(null);
      if (passkeyVerificationMethod === "two-factor") {
        clearAccountActionTwoFactorFeedback();
      }

      const res = await fetch("/api/wz_users/passkeys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "verify",
          ticket: passkeyTicket,
          ...(passkeyVerificationMethod === "email"
            ? { emailCode }
            : {
                ...(twoFactorCode.length === 6 ? { twoFactorCode } : {}),
                ...(passkeyProof ? { passkeyProof } : {}),
              }),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        options?: PasskeyCreateOptionsPayload;
      } & AccountActionAuthResponsePayload;

      if (
        (!res.ok || !payload.ok) &&
        payload.requiresTwoFactor &&
        passkeyVerificationMethod === "two-factor"
      ) {
        openAccountActionTwoFactorModal(
          "passkey",
          String(payload.error || "Digite o código de 6 dígitos do aplicativo autenticador."),
          payload.authMethods,
        );
        return;
      }

      if (!res.ok || !payload.ok || !payload.ticket || !payload.options) {
        const fallback =
          passkeyVerificationMethod === "email"
            ? "Código inválido. Tente novamente."
            : "Código de 2 etapas inválido. Tente novamente.";
        const message = String(payload.error || fallback);

        if (passkeyVerificationMethod === "two-factor") {
          setAccountActionTwoFactorFeedback(message);
          setAccountActionTwoFactorCode("");
        } else {
          setPasskeyError(message);
          setPasskeyEmailCode("");
          if (res.status === 429) {
            setPasskeyResendCooldown(0);
          }
        }
        return;
      }

      if (passkeyVerificationMethod === "two-factor") {
        resetAccountActionTwoFactorModal();
      }

      await registerPasskeyWithWindowsHello(String(payload.ticket), payload.options);
    } catch (err) {
      console.error("[config-account] verify passkey activation failed:", err);
      const message =
        err instanceof Error ? err.message : "Erro ao validar ativação do Windows Hello.";
      if (passkeyVerificationMethod === "two-factor") {
        setAccountActionTwoFactorFeedback(message);
      } else {
        setPasskeyError(message);
      }
    } finally {
      setVerifyingPasskeyCode(false);
    }
  };

  const verifyPasskeyDisable = async (
    nextValue?: string,
    providedTwoFactorCode?: string,
    providedPasskeyProof?: string
  ) => {
    if (!passkeyTicket) return;
    if (startingPasskeyFlow || resendingPasskeyCode || verifyingPasskeyCode || registeringPasskey) {
      return;
    }

    const emailCode = onlyDigits(String(nextValue || passkeyEmailCode || "")).slice(0, 7);
    const twoFactorCode = onlyDigits(String(providedTwoFactorCode || "")).slice(0, 6);
    const passkeyProof = String(providedPasskeyProof || "").trim();
    const usingDynamicIsland = passkeyAwaitingDisableAuth && (twoFactorCode.length === 6 || !!passkeyProof);

    if (!passkeyAwaitingDisableAuth && emailCode.length !== 7) return;
    if (passkeyAwaitingDisableAuth && twoFactorCode.length !== 6 && !passkeyProof) return;

    try {
      setVerifyingPasskeyCode(true);
      setPasskeyError(null);
      if (passkeyAwaitingDisableAuth) {
        clearAccountActionTwoFactorFeedback();
      }

      const res = await fetch("/api/wz_users/passkeys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "disable-verify",
          ticket: passkeyTicket,
          ...(!passkeyAwaitingDisableAuth
            ? { emailCode }
            : {
                ...(twoFactorCode.length === 6 ? { twoFactorCode } : {}),
                ...(passkeyProof ? { passkeyProof } : {}),
              }),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: "verify-auth";
        phase?: "disable-verify-auth";
        ticket?: string;
        disabled?: boolean;
      } & AccountActionAuthResponsePayload;

      if (!res.ok || !payload.ok) {
        const fallback = passkeyAwaitingDisableAuth
          ? "Não foi possível confirmar a desativação do Windows Hello."
          : "Código inválido. Tente novamente.";
        const message = String(payload.error || fallback);

        if (payload.requiresTwoFactor && passkeyAwaitingDisableAuth) {
          openAccountActionTwoFactorModal("passkey-disable", message, payload.authMethods);
          return;
        }

        if (usingDynamicIsland) {
          setAccountActionTwoFactorFeedback(message);
          setAccountActionTwoFactorCode("");
        } else {
          setPasskeyError(message);
          if (!passkeyAwaitingDisableAuth) {
            setPasskeyEmailCode("");
            if (res.status === 429) {
              setPasskeyResendCooldown(0);
            }
          }
        }
        return;
      }

      if (!passkeyAwaitingDisableAuth) {
        if (!payload.ticket) {
          throw new Error("Resposta inválida do servidor.");
        }
        setPasskeyTicket(String(payload.ticket));
        setPasskeyAwaitingDisableAuth(true);
        setPasskeyEmailCode("");
        setPasskeyResendCooldown(0);
        openAccountActionTwoFactorModal(
          "passkey-disable",
          null,
          payload.authMethods,
        );
        return;
      }

      if (usingDynamicIsland) {
        resetAccountActionTwoFactorModal();
      }
      setPasskeyEnabled(false);
      setPasskeyCredentialCount(0);
      setPasskeyModalOpen(false);
      resetPasskeyFlow();
      void loadPasskeyStatus();
    } catch (err) {
      console.error("[config-account] verify passkey disable failed:", err);
      const message =
        err instanceof Error ? err.message : "Erro ao desativar o Windows Hello.";
      if (usingDynamicIsland) {
        setAccountActionTwoFactorFeedback(message);
      } else {
        setPasskeyError(message);
      }
    } finally {
      setVerifyingPasskeyCode(false);
    }
  };

  const verifyAccountActionWithWindowsHello = useCallback(async () => {
    if (!accountActionTwoFactorContext || !accountActionAllowPasskey) return;
    if (accountActionTwoFactorBusy || accountActionTwoFactorUiLoading) return;

    if (!isPasskeyAssertionSupportedInBrowser()) {
      setAccountActionTwoFactorFeedback(
        "Seu navegador/dispositivo não suporta Windows Hello neste ambiente.",
      );
      return;
    }

    setVerifyingAccountActionPasskey(true);
    clearAccountActionTwoFactorFeedback();

    try {
      const startRes = await fetch("/api/wz_users/passkeys-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "start" }),
      });

      const startPayload = (await startRes.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        options?: PasskeyRequestOptionsPayload;
        error?: string;
      };

      if (!startRes.ok || !startPayload.ok) {
        throw new Error(
          String(startPayload.error || "Não foi possível iniciar a validação do Windows Hello."),
        );
      }

      const startOptions = (startPayload.options || null) as PasskeyRequestOptionsPayload | null;
      const passkeyAuthTicket = String(startPayload.ticket || "").trim();
      if (!passkeyAuthTicket || !startOptions?.challenge) {
        throw new Error("Resposta inválida do servidor para iniciar o Windows Hello.");
      }

      const transportsAllowed = new Set([
        "usb",
        "nfc",
        "ble",
        "internal",
        "hybrid",
        "smart-card",
      ]);

      const allowCredentials: PublicKeyCredentialDescriptor[] = [];
      if (Array.isArray(startOptions.allowCredentials)) {
        for (const item of startOptions.allowCredentials) {
          const id = base64UrlToUint8Array(item?.id || "");
          if (!id.length) continue;

          const transports = Array.isArray(item?.transports)
            ? item.transports
                .map((value) => String(value || "").trim().toLowerCase())
                .filter(
                  (value): value is AuthenticatorTransport => transportsAllowed.has(value),
                )
            : [];

          allowCredentials.push({
            type: "public-key",
            id: id as BufferSource,
            ...(transports.length ? { transports } : {}),
          });
        }
      }

      const userVerification = (() => {
        const raw = String(startOptions.userVerification || "").trim().toLowerCase();
        if (raw === "required" || raw === "preferred" || raw === "discouraged") {
          return raw as UserVerificationRequirement;
        }
        return "required";
      })();

      const rpId = String(startOptions.rpId || "").trim();
      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: base64UrlToUint8Array(startOptions.challenge),
        timeout: Math.max(15000, Number(startOptions.timeout || 60000)),
        userVerification,
        ...(rpId ? { rpId } : {}),
        ...(allowCredentials.length ? { allowCredentials } : {}),
      };

      const assertion = (await navigator.credentials.get({
        publicKey,
      })) as PublicKeyCredential | null;

      if (!assertion) {
        throw new Error("Não foi possível validar com o Windows Hello.");
      }

      const response = assertion.response as AuthenticatorAssertionResponse | null;
      if (!response?.clientDataJSON || !response?.authenticatorData || !response?.signature) {
        throw new Error("Resposta inválida do dispositivo ao validar o Windows Hello.");
      }

      const finishRes = await fetch("/api/wz_users/passkeys-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "finish",
          ticket: passkeyAuthTicket,
          credential: {
            id: assertion.id,
            rawId: arrayBufferToBase64Url(assertion.rawId),
            type: assertion.type,
            response: {
              clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
              authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
              signature: arrayBufferToBase64Url(response.signature),
              ...(response.userHandle
                ? { userHandle: arrayBufferToBase64Url(response.userHandle) }
                : {}),
            },
          },
        }),
      });

      const finishPayload = (await finishRes.json().catch(() => ({}))) as {
        ok?: boolean;
        passkeyProof?: string;
        error?: string;
      };

      if (!finishRes.ok || !finishPayload.ok || !finishPayload.passkeyProof) {
        throw new Error(
          String(finishPayload.error || "Não foi possível concluir a validação com Windows Hello."),
        );
      }

      const passkeyProof = String(finishPayload.passkeyProof || "").trim();
      if (!passkeyProof) {
        throw new Error("Resposta inválida ao validar Windows Hello.");
      }

      if (accountActionTwoFactorContext === "email") {
        await verifyEmailChangeCode(undefined, undefined, passkeyProof);
        return;
      }
      if (accountActionTwoFactorContext === "phone") {
        await verifyPhoneChangeCode(undefined, undefined, passkeyProof);
        return;
      }
      if (accountActionTwoFactorContext === "two-factor-disable") {
        await verifyTwoFactorDisableAppCode(undefined, passkeyProof);
        return;
      }
      if (accountActionTwoFactorContext === "passkey") {
        await verifyPasskeyActivation(undefined, undefined, passkeyProof);
        return;
      }
      if (accountActionTwoFactorContext === "passkey-disable") {
        await verifyPasskeyDisable(undefined, undefined, passkeyProof);
        return;
      }
      await verifyPasswordChangeCode(undefined, undefined, passkeyProof);
    } catch (error) {
      const domErr = error as DOMException;
      if (domErr?.name === "NotAllowedError") {
        if (accountActionAllowTotp && accountActionAllowPasskey) {
          setAccountActionAuthMethod("choose");
          setAccountActionTwoFactorCode("");
          clearAccountActionTwoFactorFeedback();
          return;
        }
        setAccountActionTwoFactorFeedback("Solicitação do Windows Hello cancelada.");
        return;
      }
      setAccountActionTwoFactorFeedback(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao validar com Windows Hello.",
      );
    } finally {
      setVerifyingAccountActionPasskey(false);
    }
  }, [
    accountActionAllowPasskey,
    accountActionAllowTotp,
    accountActionTwoFactorBusy,
    accountActionTwoFactorContext,
    accountActionTwoFactorUiLoading,
    clearAccountActionTwoFactorFeedback,
    setAccountActionTwoFactorFeedback,
    verifyEmailChangeCode,
    verifyPasskeyDisable,
    verifyPasskeyActivation,
    verifyPasswordChangeCode,
    verifyPhoneChangeCode,
    verifyTwoFactorDisableAppCode,
  ]);

  const chooseAccountActionAuthMethod = useCallback(
    (method: Exclude<AccountActionAuthMethod, "choose">) => {
      if (method === "totp") {
        if (!accountActionAllowTotp) return;
        setAccountActionAuthMethod("totp");
        setAccountActionTwoFactorCode("");
        clearAccountActionTwoFactorFeedback();
        return;
      }
      if (!accountActionAllowPasskey) return;
      setAccountActionAuthMethod("passkey");
      setAccountActionTwoFactorCode("");
      clearAccountActionTwoFactorFeedback();
      void verifyAccountActionWithWindowsHello();
    },
    [
      accountActionAllowPasskey,
      accountActionAllowTotp,
      clearAccountActionTwoFactorFeedback,
      verifyAccountActionWithWindowsHello,
    ],
  );

  const backToAccountActionAuthMethodChoice = useCallback(() => {
    if (accountActionTwoFactorBusy) return;
    if (!(accountActionAllowTotp && accountActionAllowPasskey)) return;
    setAccountActionAuthMethod("choose");
    setAccountActionTwoFactorCode("");
    clearAccountActionTwoFactorFeedback();
  }, [
    accountActionAllowPasskey,
    accountActionAllowTotp,
    accountActionTwoFactorBusy,
    clearAccountActionTwoFactorFeedback,
  ]);

  useEffect(() => {
    if (!accountActionTwoFactorModalOpen) {
      accountActionPasskeyAutoStartRef.current = "";
      return;
    }
    if (accountActionTwoFactorUiLoading) return;
    if (accountActionAllowTotp || !accountActionAllowPasskey) return;
    if (accountActionAuthMethod !== "passkey") return;
    if (accountActionTwoFactorBusy) return;

    const autoStartKey = `${accountActionTwoFactorContext || "none"}:passkey-only`;
    if (accountActionPasskeyAutoStartRef.current === autoStartKey) return;
    accountActionPasskeyAutoStartRef.current = autoStartKey;
    void verifyAccountActionWithWindowsHello();
  }, [
    accountActionAllowPasskey,
    accountActionAllowTotp,
    accountActionAuthMethod,
    accountActionTwoFactorBusy,
    accountActionTwoFactorContext,
    accountActionTwoFactorModalOpen,
    accountActionTwoFactorUiLoading,
    verifyAccountActionWithWindowsHello,
  ]);

  const startPasskeyActivationFlow = async () => {
    if (isPasskeyBusy) return;

    try {
      setStartingPasskeyFlow(true);
      setPasskeyFlowMode("activate");
      setPasskeyAwaitingDisableAuth(false);
      setPasskeyError(null);

      const res = await fetch("/api/wz_users/passkeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        verification?: PasskeyVerificationMethod;
        emailMask?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.ticket) {
        throw new Error(payload.error || "Não foi possível iniciar a ativação do Windows Hello.");
      }

      const verification = payload.verification === "two-factor" ? "two-factor" : "email";
      setPasskeyTicket(String(payload.ticket));
      setPasskeyVerificationMethod(verification);
      setPasskeyError(null);
      setPasskeyEmailCode("");

      if (verification === "two-factor") {
        setPasskeyResendCooldown(0);
        openAccountActionTwoFactorModal(
          "passkey",
          null,
          { totp: true, passkey: passkeyEnabled },
        );
        return;
      }

      setPasskeyEmailMask(String(payload.emailMask || maskSecureEmail(localEmail)));
      setPasskeyResendCooldown(60);
    } catch (err) {
      console.error("[config-account] start passkey activation failed:", err);
      setPasskeyError(
        err instanceof Error ? err.message : "Erro ao iniciar ativação do Windows Hello."
      );
    } finally {
      setStartingPasskeyFlow(false);
    }
  };

  const startPasskeyDisableFlow = async () => {
    if (isPasskeyBusy) return;

    try {
      setStartingPasskeyFlow(true);
      setPasskeyFlowMode("disable");
      setPasskeyVerificationMethod("email");
      setPasskeyAwaitingDisableAuth(false);
      setPasskeyError(null);

      const res = await fetch("/api/wz_users/passkeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "disable-start" }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        emailMask?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.ticket) {
        throw new Error(payload.error || "Não foi possível iniciar a desativação do Windows Hello.");
      }

      setPasskeyTicket(String(payload.ticket));
      setPasskeyEmailMask(String(payload.emailMask || maskSecureEmail(localEmail)));
      setPasskeyEmailCode("");
      setPasskeyResendCooldown(60);
    } catch (err) {
      console.error("[config-account] start passkey disable failed:", err);
      setPasskeyError(
        err instanceof Error ? err.message : "Erro ao iniciar desativação do Windows Hello."
      );
    } finally {
      setStartingPasskeyFlow(false);
    }
  };

  const openPasskeyModal = async () => {
    if (isPasskeyBusy) return;
    if (passkeyEnabled) {
      resetPasskeyFlow();
      setPasskeyFlowMode("disable");
      setPasskeyDisableIntroModalOpen(true);
      return;
    }
    resetPasskeyFlow();
    setPasskeyModalOpen(true);
    await startPasskeyActivationFlow();
  };

  const confirmPasskeyDisableFlow = async () => {
    if (isPasskeyBusy) return;
    resetPasskeyFlow();
    setPasskeyModalOpen(true);
    setPasskeyDisableIntroModalOpen(false);
    await startPasskeyDisableFlow();
  };

  const resendPasskeyEmailCode = async () => {
    if (passkeyVerificationMethod !== "email" || !passkeyTicket || passkeyResendCooldown > 0) {
      return;
    }
    if (isPasskeyBusy) return;

    try {
      setResendingPasskeyCode(true);
      setPasskeyError(null);

      const res = await fetch("/api/wz_users/passkeys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: passkeyTicket,
          ...(passkeyFlowMode === "disable" ? { mode: "disable-resend" } : {}),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        emailMask?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível reenviar o código.");
      }

      if (payload.ticket) {
        setPasskeyTicket(String(payload.ticket));
      }
      if (payload.emailMask) {
        setPasskeyEmailMask(String(payload.emailMask));
      }
      setPasskeyResendCooldown(60);
    } catch (err) {
      console.error("[config-account] resend passkey email code failed:", err);
      setPasskeyError(err instanceof Error ? err.message : "Erro ao reenviar código.");
    } finally {
      setResendingPasskeyCode(false);
    }
  };

  const reopenPasskeyAuthIsland = () => {
    if (!passkeyTicket || isPasskeyBusy) return;
    if (passkeyFlowMode === "activate" && passkeyVerificationMethod === "two-factor") {
      openAccountActionTwoFactorModal(
        "passkey",
        null,
        { totp: true, passkey: passkeyEnabled },
      );
      return;
    }
    if (passkeyFlowMode === "disable" && passkeyAwaitingDisableAuth) {
      openAccountActionTwoFactorModal(
        "passkey-disable",
        null,
        { totp: twoFactorEnabled, passkey: true },
      );
    }
  };

  const initial = nickname.trim().charAt(0).toUpperCase() || "U";
  const maskedEmailValue = maskSecureEmail(localEmail);
  const maskedPhoneValue = maskSecurePhone(localPhoneE164);
  const relativeBaseTimestamp = normalizedAccountCreatedAt || relativeFallbackBaseAt;
  const emailChangedLabel = `Alterado há: ${formatElapsedTimeLabel(localEmailChangedAt || relativeBaseTimestamp, relativeNowMs)}`;
  const phoneChangedLabel = `Alterado há: ${formatElapsedTimeLabel(localPhoneChangedAt || relativeBaseTimestamp, relativeNowMs)}`;
  const passwordChangedLabel = `Alterado há: ${formatElapsedTimeLabel(localPasswordChangedAt || relativeBaseTimestamp, relativeNowMs)}`;
  const passwordStatusBadgeLabel = localMustCreatePassword ? "Pendente" : passwordChangedLabel;
  const passwordActionLabel = localMustCreatePassword ? "Criar Senha" : "Alterar Senha";
  const showPhoneSecuritySection = false;
  const externalPrimaryAuthProviderName = resolveExternalAuthProviderName(localPrimaryAuthProvider);
  const passwordDescriptionText = localMustCreatePassword
    ? externalPrimaryAuthProviderName
      ? `Sua conta foi criada com ${externalPrimaryAuthProviderName}. Crie uma senha agora para liberar também o login por senha.`
      : "Crie sua primeira senha para ativar o login por senha nesta conta."
    : "Atualize sua senha com confirmação por código enviado no e-mail.";
  const buttonShellClass =
    "rounded-xl border px-4 py-2 text-[13px] font-semibold transition-[transform,background-color,border-color,box-shadow] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-[0.6px] active:scale-[0.992]";
  const buttonNeutralClass =
    "border-black/10 bg-white/95 text-black/80 hover:border-black/15 hover:bg-black/[0.03]";
  const buttonClass = cx(buttonShellClass, buttonNeutralClass);
  const twoFactorStatusBadge = twoFactorEnabled
    ? "Ativa"
    : twoFactorStatusLoaded
      ? "Inativa"
      : "Carregando...";
  const twoFactorActionLabel = twoFactorEnabled
    ? "Autenticação de 2 etapas ativa"
    : "Adicionar um método de verificação";
  const passkeyStatusBadge = passkeyEnabled
    ? "Ativa"
    : passkeyStatusLoaded
      ? "Inativa"
      : "Carregando...";
  const passkeyActionLabel = passkeyEnabled
    ? "Windows Hello está ativo"
    : "Ativar Windows Hello";
  const usingTwoFactorEnableIsland =
    twoFactorStep === "enable-verify-app" &&
    twoFactorEnableSubStep === "verify" &&
    accountActionTwoFactorContext === "two-factor-enable" &&
    accountActionTwoFactorModalOpen;
  const accountActionCanChooseMethod = accountActionAllowTotp && accountActionAllowPasskey;
  const accountActionShowTotpInput =
    accountActionAuthMethod === "totp" || (accountActionAllowTotp && !accountActionAllowPasskey);
  const accountActionShowPasskeyFlow =
    accountActionAuthMethod === "passkey" || (!accountActionAllowTotp && accountActionAllowPasskey);
  const accountActionTwoFactorTitle =
    accountActionCanChooseMethod && accountActionAuthMethod === "choose"
      ? "Escolha a forma de validação"
      : accountActionTwoFactorContext === "two-factor-disable"
      ? "Desativar autenticação de 2 etapas"
      : accountActionTwoFactorContext === "two-factor-enable"
        ? "Ativar autenticação de 2 etapas"
      : accountActionTwoFactorContext === "passkey-disable"
        ? "Desativar Windows Hello"
      : accountActionTwoFactorContext === "passkey"
        ? "Ativar Windows Hello"
      : "Autenticação de 2 etapas";
  const accountActionTwoFactorDescription =
    accountActionCanChooseMethod && accountActionAuthMethod === "choose"
      ? "Escolha entre código autenticador e Windows Hello."
      : accountActionShowPasskeyFlow
        ? "Confirme a validação no prompt do Windows Hello."
      : accountActionTwoFactorContext === "two-factor-disable"
      ? "Digite o código de 6 dígitos do aplicativo autenticador para concluir a desativação."
      : accountActionTwoFactorContext === "two-factor-enable"
        ? "Digite o código de 6 dígitos gerado no aplicativo para ativar."
      : accountActionTwoFactorContext === "passkey-disable"
        ? "Confirme com código de 2 etapas ou Windows Hello para desativar."
      : accountActionTwoFactorContext === "passkey"
        ? "Confirme com o código de 6 dígitos de seu autenticador para ativação do Windows Hello."
      : "Abra seu aplicativo autenticador para continuar.";
  const twoFactorButtonClass = cx(
    buttonShellClass,
    twoFactorEnabled
      ? "border-lime-500 bg-lime-400 text-black hover:border-lime-600 hover:bg-lime-500"
      : buttonNeutralClass,
    (loadingTwoFactorStatus || isTwoFactorBusy) && "cursor-wait opacity-70"
  );
  const passkeyButtonClass = cx(
    buttonShellClass,
    passkeyEnabled
      ? "border-lime-500 bg-lime-400 text-black hover:border-lime-600 hover:bg-lime-500"
      : buttonNeutralClass,
    (loadingPasskeyStatus || isPasskeyBusy) && "cursor-wait opacity-70"
  );

  return (
    <>
      <div className="mx-auto w-full max-w-[980px] pb-10 text-black/80">
        <input ref={fileInputRef} type="file" accept={AVATAR_ACCEPT} onChange={onFilePicked} className="hidden" />

        <div className="flex items-start gap-4">
          <div className="flex w-[100px] shrink-0 flex-col items-center">
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex h-[100px] w-[100px] items-center justify-center overflow-hidden rounded-xl bg-[#171717] text-[38px] font-semibold text-white transition-all duration-220 hover:opacity-95 active:translate-y-[0.6px] active:scale-[0.992]"
            >
              {localPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={localPhoto} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </button>

            {localPhoto && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={removing || saving}
                className="mt-2 text-[12px] font-medium text-black/55 transition-colors hover:text-black/75 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removing ? "Removendo..." : "Remover foto"}
              </button>
            )}
          </div>

          <div className="min-w-0 max-w-[420px] flex-1">
            <label className="text-[14px] font-medium text-black/60">Nome</label>
            <div className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-black/[0.03] px-3 text-[18px] font-semibold leading-10 text-black/80">
              {nickname}
            </div>
            <p className="mt-3 text-[14px] text-black/60">
              <button type="button" onClick={openPicker} className="text-sky-600 hover:text-sky-700">
                Adicione uma foto
              </button>{" "}
              ou <button type="button" className="text-sky-600 hover:text-sky-700">Wyzer Mascots</button>
            </p>
            {error && (
              <p className="mt-3 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                {error}
              </p>
            )}
          </div>
        </div>

        <section className="mt-10">
          <h4 className="text-[20px] font-semibold text-black/82">Segurança da conta</h4>
          <div className="mt-4 border-t border-black/10" />
          <div className="space-y-6 pt-5">
            <div className="flex flex-col items-start justify-between gap-3 -mx-2 rounded-xl px-2 sm:flex-row sm:gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[18px] font-semibold text-black/85">E-mail</p><span className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-black/62">{emailChangedLabel}</span></div><p className="mt-1 text-[15px] text-black/58">{maskedEmailValue}</p></div><button type="button" onClick={() => void openEmailModal()} className={cx(buttonClass, "self-start sm:self-auto")}>Alterar E-mail</button></div>
            {showPhoneSecuritySection && <div className="flex flex-col items-start justify-between gap-3 -mx-2 rounded-xl px-2 sm:flex-row sm:gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[18px] font-semibold text-black/85">Número de celular</p><span className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-black/62">{phoneChangedLabel}</span></div><p className="mt-1 text-[15px] text-black/58">{maskedPhoneValue}</p></div><button type="button" onClick={() => void openPhoneModal()} className={cx(buttonClass, "self-start sm:self-auto")}>Alterar celular</button></div>}
            <div className="flex flex-col items-start justify-between gap-3 -mx-2 rounded-xl px-2 sm:flex-row sm:gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[18px] font-semibold text-black/85">Senha</p><span className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-black/62">{passwordStatusBadgeLabel}</span></div><p className="mt-1 text-[15px] text-black/58">{passwordDescriptionText}</p></div><button type="button" onClick={() => void openPasswordModal()} className={cx(buttonClass, "self-start sm:self-auto")}>{passwordActionLabel}</button></div>
            <div className="flex flex-col items-start justify-between gap-3 -mx-2 rounded-xl px-2 sm:flex-row sm:gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[18px] font-semibold text-black/85">Verificação em duas etapas</p>
                  <span className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-black/62">
                    {twoFactorStatusBadge}
                  </span>
                </div>
                <p className="mt-1 text-[15px] text-black/58">
                  Adicione mais uma camada de segurança à sua conta durante o login.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openTwoFactorModal()}
                disabled={loadingTwoFactorStatus || isTwoFactorBusy}
                className={cx(twoFactorButtonClass, "self-start sm:self-auto")}
              >
                {twoFactorActionLabel}
              </button>
            </div>
            <div className="flex flex-col items-start justify-between gap-3 -mx-2 rounded-xl px-2 sm:flex-row sm:gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[18px] font-semibold text-black/85">Chaves de acesso</p>
                  <span className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-black/62">
                    {passkeyStatusBadge}
                  </span>
                </div>
                <p className="mt-1 text-[15px] text-black/58">
                  Entre com segurança usando biometria ou PIN do dispositivo via Windows Hello.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openPasskeyModal()}
                disabled={loadingPasskeyStatus || isPasskeyBusy}
                className={cx(passkeyButtonClass, "self-start sm:self-auto")}
              >
                {passkeyActionLabel}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h4 className="text-[20px] font-semibold text-black/82">Suporte</h4>
          <div className="mt-4 border-t border-black/10" />
          <div className="flex items-center justify-between gap-4 -mx-2 rounded-xl px-2 py-5">
            <div className="min-w-0"><p className="text-[18px] font-semibold text-black/85">Acesso para suporte</p><p className="mt-1 text-[15px] leading-[1.45] text-black/58">Conceda ao suporte acesso temporário para ajudar a resolver problemas ou recuperar conteúdo. Você pode revogar a qualquer momento.</p><p className="mt-1 text-[12px] text-black/45">Nossa equipe nunca pedirá senhas ou acessos em nenhum canal de comunicação. Caso aconteça, reporte imediatamente em nossos canais seguros de comunicação.</p></div>
            <button type="button" role="switch" aria-checked={supportAccess} onClick={() => void toggleSupportAccess()} disabled={savingSupportAccess} className={cx("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-220 disabled:cursor-not-allowed disabled:opacity-70", supportAccess ? "bg-lime-400/85" : "bg-black/20")}>
              <span className={cx("inline-block h-5 w-5 rounded-full bg-white transition-transform duration-220", supportAccess ? "translate-x-6" : "translate-x-1")} />
            </button>
          </div>
          {supportAccessError && (
            <p className="-mt-2 mb-3 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
              {supportAccessError}
            </p>
          )}

          <button type="button" className="group -mx-2 flex w-[calc(100%+16px)] items-center justify-between gap-4 rounded-xl px-2 py-5 text-left transition-[transform,background-color] duration-220 active:translate-y-[0.6px] active:scale-[0.998] cursor-pointer">
            <span className="min-w-0"><p className="text-[18px] font-semibold text-[#e3524b]">Excluir minhá conta</p><p className="mt-1 text-[15px] text-black/58">Exclua permanentemente a conta e remova o acesso de todos os espacos de trabalho.</p></span>
            <ChevronRight className="h-5 w-5 shrink-0 text-black/35 transition-all duration-220 group-hover:translate-x-[1px] group-hover:text-black/65" />
          </button>
        </section>
      </div>

      <AnimatePresence>
        {editorOpen && (
          <motion.div className="fixed inset-0 z-[220] flex items-center justify-center p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[4px]" onClick={closeEditor} />
            <motion.section role="dialog" aria-modal="true" className="relative z-[1] w-[min(92vw,700px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_26px_70px_rgba(0,0,0,0.35)]" initial={{ opacity: 0, y: 10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.985 }}>
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6"><h3 className="text-[18px] font-semibold text-black/80">Ajustar foto de perfil</h3><button type="button" onClick={closeEditor} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80"><X className="h-5 w-5" /></button></div>
              <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                <div className={cx("relative mx-auto h-[320px] w-[320px] overflow-hidden rounded-2xl border border-black/10 bg-black/[0.06]", dragging ? "cursor-grabbing" : "cursor-grab")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
                  {source && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={source}
                      alt="Preview da imagem"
                      draggable={false}
                      onLoad={(e) => setNatural({ width: Math.max(e.currentTarget.naturalWidth || 1, 1), height: Math.max(e.currentTarget.naturalHeight || 1, 1) })}
                      className="pointer-events-none absolute select-none"
                      style={{ left: `calc(50% + ${offset.x}px)`, top: `calc(50% + ${offset.y}px)`, width: `${natural.width * scale}px`, height: `${natural.height * scale}px`, transform: "translate(-50%, -50%)", maxWidth: "none" }}
                    />
                  )}
                </div>
                <div className="mx-auto mt-4 w-full max-w-[420px]"><div className="flex items-center justify-between text-[12px] font-medium text-black/55"><span>Zoom</span><span>{Math.round(zoom * 100)}%</span></div><input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-[#171717]" /><p className="mt-2 text-[12px] text-black/50">Arraste a imagem para posicionar e use o zoom para enquadrar.</p></div>
                <div className="mt-5 flex items-center justify-end gap-2"><button type="button" onClick={closeEditor} className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70">Cancelar</button><button type="button" onClick={saveAvatar} className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992]">{saving ? "Salvando..." : "Confirmar"}</button></div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {emailModalOpen && (
          <motion.div
            className="fixed inset-0 z-[225] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
              onClick={closeEmailModal}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              className="relative z-[1] w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_26px_70px_rgba(0,0,0,0.35)] sm:w-[min(92vw,700px)]"
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                <h3 className="text-[18px] font-semibold text-black/80">Alterar e-mail</h3>
                <button
                  type="button"
                  onClick={closeEmailModal}
                  disabled={sendingEmailCode || resendingEmailCode || verifyingEmailCode}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                {emailStep === "confirm-current-intro" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Por segurança, confirme primeiro o e-mail atual antes de informar o novo.
                    </p>
                    <p className="mt-4 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/72">
                      E-mail atual: <span className="font-semibold text-black/86">{maskSecureEmail(localEmail)}</span>
                    </p>
                  </>
                )}

                {emailStep === "confirm-current-code" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Digite o código de 7 dígitos enviado para o seu e-mail atual{" "}
                      <span className="break-all font-semibold text-black/78">{maskSecureEmail(localEmail)}</span>.
                    </p>
                    <CodeBoxes
                      length={7}
                      value={emailCode}
                      onChange={setEmailCode}
                      onComplete={verifyEmailChangeCode}
                      disabled={verifyingEmailCode}
                    />
                    <div className="mt-4 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={resendEmailChangeCode}
                        disabled={
                          resendingEmailCode ||
                          verifyingEmailCode ||
                          sendingEmailCode ||
                          emailResendCooldown > 0
                        }
                        className="text-[13px] font-semibold text-black/72 transition-colors hover:text-black/88 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {emailResendCooldown > 0
                          ? `Reenviar código (${emailResendCooldown}s)`
                          : resendingEmailCode
                          ? "Reenviando..."
                          : "Reenviar código"}
                      </button>
                    </div>
                  </>
                )}

                {emailStep === "new-email-input" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      E-mail atual confirmado. Agora informe o novo e-mail para enviar o código final.
                    </p>
                    <label className="mt-5 block text-[13px] font-medium text-black/60">
                      Novo e-mail
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={pendingEmail}
                      onChange={(e) => setPendingEmail(String(e.target.value || "").trim())}
                      disabled={sendingEmailCode}
                      className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/80 outline-none transition-[border-color,box-shadow] focus:border-black/30 focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:opacity-70"
                      placeholder="novoemail@dominio.com"
                    />
                  </>
                )}

                {emailStep === "confirm-new-code" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Enviamos um código de 7 dígitos para o novo e-mail{" "}
                      <span className="break-all font-semibold text-black/78">{maskSecureEmail(pendingEmail)}</span>.
                    </p>
                    <CodeBoxes
                      length={7}
                      value={emailCode}
                      onChange={setEmailCode}
                      onComplete={verifyEmailChangeCode}
                      disabled={verifyingEmailCode}
                    />
                    <div className="mt-4 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={resendEmailChangeCode}
                        disabled={
                          resendingEmailCode ||
                          verifyingEmailCode ||
                          sendingEmailCode ||
                          emailResendCooldown > 0
                        }
                        className="text-[13px] font-semibold text-black/72 transition-colors hover:text-black/88 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {emailResendCooldown > 0
                          ? `Reenviar código (${emailResendCooldown}s)`
                          : resendingEmailCode
                          ? "Reenviando..."
                          : "Reenviar código"}
                      </button>
                    </div>
                  </>
                )}

                {emailChangeError && (
                  <p className="mt-4 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                    {emailChangeError}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  {emailStep === "confirm-current-code" || emailStep === "confirm-new-code" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (sendingEmailCode || resendingEmailCode || verifyingEmailCode) return;
                        setEmailStep(
                          emailStep === "confirm-current-code"
                            ? "confirm-current-intro"
                            : "new-email-input"
                        );
                        setEmailCode("");
                        setEmailForceTwoFactor(false);
                        setEmailChangeError(null);
                        setEmailResendCooldown(0);
                        resetAccountActionTwoFactorModal();
                      }}
                      disabled={sendingEmailCode || resendingEmailCode || verifyingEmailCode}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Voltar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closeEmailModal}
                      disabled={sendingEmailCode || resendingEmailCode || verifyingEmailCode}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  )}

                  {emailStep === "confirm-current-intro" && (
                    <button
                      type="button"
                      onClick={startCurrentEmailConfirmation}
                      disabled={sendingEmailCode}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {sendingEmailCode ? "Enviando..." : "Enviar código"}
                    </button>
                  )}

                  {emailStep === "new-email-input" && (
                    <button
                      type="button"
                      onClick={sendNewEmailCode}
                      disabled={sendingEmailCode}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {sendingEmailCode ? "Enviando..." : "Enviar código"}
                    </button>
                  )}

                  {(emailStep === "confirm-current-code" || emailStep === "confirm-new-code") && (
                    <button
                      type="button"
                      onClick={() => verifyEmailChangeCode()}
                      disabled={
                        verifyingEmailCode || onlyDigits(emailCode).length !== 7
                      }
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {verifyingEmailCode ? "Validando..." : "Confirmar"}
                    </button>
                  )}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {showPhoneSecuritySection && phoneModalOpen && (
          <motion.div
            className="fixed inset-0 z-[226] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
              onClick={closePhoneModal}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              className="relative z-[1] w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_26px_70px_rgba(0,0,0,0.35)] sm:w-[min(92vw,700px)]"
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                <h3 className="text-[18px] font-semibold text-black/80">Alterar celular</h3>
                <button
                  type="button"
                  onClick={closePhoneModal}
                  disabled={sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                {phoneStep === "confirm-current-intro" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Por segurança, confirme primeiro o celular atual antes de informar o novo.
                    </p>
                    <p className="mt-4 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/72">
                      Celular atual: <span className="font-semibold text-black/86">{maskedPhoneValue}</span>
                    </p>
                  </>
                )}

                {phoneStep === "confirm-current-code" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Digite o código de 7 dígitos enviado por SMS para o celular atual{" "}
                      <span className="font-semibold text-black/78">{maskedPhoneValue}</span>.
                    </p>
                    <CodeBoxes
                      length={7}
                      value={phoneCode}
                      onChange={setPhoneCode}
                      onComplete={verifyPhoneChangeCode}
                      disabled={verifyingPhoneCode}
                    />
                    <div className="mt-4 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={resendPhoneChangeCode}
                        disabled={
                          resendingPhoneCode ||
                          verifyingPhoneCode ||
                          sendingPhoneCode ||
                          phoneResendCooldown > 0
                        }
                        className="text-[13px] font-semibold text-black/72 transition-colors hover:text-black/88 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {phoneResendCooldown > 0
                          ? `Reenviar código (${phoneResendCooldown}s)`
                          : resendingPhoneCode
                          ? "Reenviando..."
                          : "Reenviar código"}
                      </button>
                    </div>
                  </>
                )}

                {phoneStep === "new-phone-input" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Celular atual confirmado. Agora informe o novo celular para enviar o código final por SMS.
                    </p>
                    <label className="mt-5 block text-[13px] font-medium text-black/60">
                      Novo celular
                    </label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={formatPhoneBR(pendingPhone)}
                      onChange={(e) => setPendingPhone(onlyDigits(String(e.target.value || "")).slice(0, 13))}
                      disabled={sendingPhoneCode}
                      className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/80 outline-none transition-[border-color,box-shadow] focus:border-black/30 focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:opacity-70"
                      placeholder="(11) 91234-5678"
                    />
                  </>
                )}

                {phoneStep === "confirm-new-code" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Enviamos um código de 7 dígitos por SMS para o novo celular{" "}
                      <span className="font-semibold text-black/78">{maskSecurePhone(pendingPhone)}</span>.
                    </p>
                    <CodeBoxes
                      length={7}
                      value={phoneCode}
                      onChange={setPhoneCode}
                      onComplete={verifyPhoneChangeCode}
                      disabled={verifyingPhoneCode}
                    />
                    <div className="mt-4 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={resendPhoneChangeCode}
                        disabled={
                          resendingPhoneCode ||
                          verifyingPhoneCode ||
                          sendingPhoneCode ||
                          phoneResendCooldown > 0
                        }
                        className="text-[13px] font-semibold text-black/72 transition-colors hover:text-black/88 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {phoneResendCooldown > 0
                          ? `Reenviar código (${phoneResendCooldown}s)`
                          : resendingPhoneCode
                          ? "Reenviando..."
                          : "Reenviar código"}
                      </button>
                    </div>
                  </>
                )}

                {phoneChangeError && (
                  <p className="mt-4 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                    {phoneChangeError}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  {phoneStep === "confirm-current-code" || phoneStep === "confirm-new-code" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode) return;
                        setPhoneStep(
                          phoneStep === "confirm-current-code"
                            ? "confirm-current-intro"
                            : "new-phone-input"
                        );
                        setPhoneCode("");
                        setPhoneForceTwoFactor(false);
                        setPhoneChangeError(null);
                        setPhoneResendCooldown(0);
                        resetAccountActionTwoFactorModal();
                      }}
                      disabled={sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Voltar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closePhoneModal}
                      disabled={sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  )}

                  {phoneStep === "confirm-current-intro" && (
                    <button
                      type="button"
                      onClick={startCurrentPhoneConfirmation}
                      disabled={sendingPhoneCode}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {sendingPhoneCode ? "Enviando..." : "Enviar código"}
                    </button>
                  )}

                  {phoneStep === "new-phone-input" && (
                    <button
                      type="button"
                      onClick={sendNewPhoneCode}
                      disabled={sendingPhoneCode}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {sendingPhoneCode ? "Enviando..." : "Enviar código"}
                    </button>
                  )}

                  {(phoneStep === "confirm-current-code" || phoneStep === "confirm-new-code") && (
                    <button
                      type="button"
                      onClick={() => verifyPhoneChangeCode()}
                      disabled={
                        verifyingPhoneCode || onlyDigits(phoneCode).length !== 7
                      }
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {verifyingPhoneCode ? "Validando..." : "Confirmar"}
                    </button>
                  )}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {passwordModalOpen && (
          <motion.div
            className="fixed inset-0 z-[227] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
              onClick={closePasswordModal}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              className="relative z-[1] w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_26px_70px_rgba(0,0,0,0.35)] sm:w-[min(92vw,700px)]"
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                <h3 className="text-[18px] font-semibold text-black/80">
                  {localMustCreatePassword ? "Criar senha" : "Alterar senha"}
                </h3>
                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={sendingPasswordCode || resendingPasswordCode || verifyingPasswordCode}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                {passwordStep === "form" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      {localMustCreatePassword
                        ? "Defina uma senha para habilitar também login por senha nesta conta."
                        : "Informe sua senha atual e a nova senha para continuar."}
                    </p>

                    {!localMustCreatePassword && (
                      <>
                        <label className="mt-5 block text-[13px] font-medium text-black/60">
                          Senha atual
                        </label>
                        <input
                          type="password"
                          autoComplete="current-password"
                          value={currentPasswordInput}
                          onChange={(e) => setCurrentPasswordInput(String(e.target.value || ""))}
                          disabled={sendingPasswordCode}
                          className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/80 outline-none transition-[border-color,box-shadow] focus:border-black/30 focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:opacity-70"
                          placeholder="Digite sua senha atual"
                        />
                      </>
                    )}

                    <label className="mt-4 block text-[13px] font-medium text-black/60">
                      Nova senha
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(String(e.target.value || ""))}
                      disabled={sendingPasswordCode}
                      className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/80 outline-none transition-[border-color,box-shadow] focus:border-black/30 focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:opacity-70"
                      placeholder={localMustCreatePassword ? "Crie sua senha" : "Digite a nova senha"}
                    />

                    <label className="mt-4 block text-[13px] font-medium text-black/60">
                      Confirmar nova senha
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmNewPasswordInput}
                      onChange={(e) => setConfirmNewPasswordInput(String(e.target.value || ""))}
                      disabled={sendingPasswordCode}
                      className="mt-2 h-11 w-full rounded-xl border border-black/12 bg-white/90 px-3 text-[15px] text-black/80 outline-none transition-[border-color,box-shadow] focus:border-black/30 focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:opacity-70"
                      placeholder="Confirme a nova senha"
                    />
                  </>
                )}

                {passwordStep === "confirm-code" && (
                  <>
                    {passwordCodePhoneMask ? (
                      <p className="text-[14px] leading-[1.45] text-black/62">
                        Enviamos um código de 7 dígitos para o e-mail{" "}
                        <span className="break-all font-semibold text-black/78">{maskSecureEmail(localEmail)}</span> e
                        para o SMS em <span className="font-semibold text-black/78">{passwordCodePhoneMask}</span>.
                      </p>
                    ) : (
                      <p className="text-[14px] leading-[1.45] text-black/62">
                        Enviamos um código de 7 dígitos para o e-mail{" "}
                        <span className="break-all font-semibold text-black/78">{maskSecureEmail(localEmail)}</span>.
                      </p>
                    )}
                    <CodeBoxes
                      length={7}
                      value={passwordCode}
                      onChange={setPasswordCode}
                      onComplete={verifyPasswordChangeCode}
                      disabled={verifyingPasswordCode}
                    />
                    <div className="mt-4 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={resendPasswordChangeCode}
                        disabled={
                          resendingPasswordCode ||
                          verifyingPasswordCode ||
                          sendingPasswordCode ||
                          passwordResendCooldown > 0
                        }
                        className="text-[13px] font-semibold text-black/72 transition-colors hover:text-black/88 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {passwordResendCooldown > 0
                          ? `Reenviar código (${passwordResendCooldown}s)`
                          : resendingPasswordCode
                          ? "Reenviando..."
                          : "Reenviar código"}
                      </button>
                    </div>
                  </>
                )}

                {passwordChangeError && (
                  <p className="mt-4 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                    {passwordChangeError}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  {passwordStep === "confirm-code" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (sendingPasswordCode || resendingPasswordCode || verifyingPasswordCode) return;
                        setPasswordStep("form");
                        setPasswordCode("");
                        setPasswordForceTwoFactor(false);
                        setPasswordChangeError(null);
                        setPasswordResendCooldown(0);
                        resetAccountActionTwoFactorModal();
                      }}
                      disabled={sendingPasswordCode || resendingPasswordCode || verifyingPasswordCode}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Voltar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closePasswordModal}
                      disabled={sendingPasswordCode || resendingPasswordCode || verifyingPasswordCode}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  )}

                  {passwordStep === "form" && (
                    <button
                      type="button"
                      onClick={startPasswordChange}
                      disabled={sendingPasswordCode}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {sendingPasswordCode ? "Enviando..." : "Enviar código"}
                    </button>
                  )}

                  {passwordStep === "confirm-code" && (
                    <button
                      type="button"
                      onClick={() => verifyPasswordChangeCode()}
                      disabled={
                        verifyingPasswordCode || onlyDigits(passwordCode).length !== 7
                      }
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {verifyingPasswordCode ? "Validando..." : "Confirmar"}
                    </button>
                  )}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {passkeyDisableIntroModalOpen && (
          <motion.div
            className="fixed inset-0 z-[228] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
              onClick={closePasskeyDisableIntroModal}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              className="relative z-[1] w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_26px_70px_rgba(0,0,0,0.35)] sm:w-[min(92vw,700px)]"
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                <h3 className="text-[18px] font-semibold text-black/80">Desativar Windows Hello</h3>
                <button
                  type="button"
                  onClick={closePasskeyDisableIntroModal}
                  disabled={isPasskeyBusy}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                <p className="text-[14px] leading-[1.45] text-black/62">
                  O Windows Hello esta ativo nesta conta.
                </p>
                <p className="mt-3 text-[14px] leading-[1.45] text-black/62">
                  Para desativar, você vai confirmar em duas etapas:
                </p>
                <ol className="mt-2 list-decimal pl-5 text-[14px] leading-[1.5] text-black/62">
                  <li>Código de 7 dígitos enviado para seu e-mail.</li>
                  <li>Confirmação final com Windows Hello ou código de 2 etapas (se ativo).</li>
                </ol>
                <p className="mt-3 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/72">
                  E-mail para confirmação:{" "}
                  <span className="font-semibold text-black/86">
                    {passkeyEmailMask || maskSecureEmail(localEmail)}
                  </span>
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closePasskeyDisableIntroModal}
                    disabled={isPasskeyBusy}
                    className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmPasskeyDisableFlow()}
                    disabled={isPasskeyBusy}
                    className="rounded-xl bg-[#e3524b] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#d34942] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {startingPasskeyFlow ? "Iniciando..." : "Confirmar desativação"}
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {passkeyModalOpen && (
          <motion.div
            className="fixed inset-0 z-[228] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
              onClick={closePasskeyModal}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              className="relative z-[1] w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_26px_70px_rgba(0,0,0,0.35)] sm:w-[min(92vw,700px)]"
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                <h3 className="text-[18px] font-semibold text-black/80">
                  {passkeyFlowMode === "disable" ? "Desativar Windows Hello" : "Ativar Windows Hello"}
                </h3>
                <button
                  type="button"
                  onClick={closePasskeyModal}
                  disabled={isPasskeyBusy}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                <p className="text-[14px] leading-[1.45] text-black/62">
                  {passkeyFlowMode === "disable"
                    ? "Vamos desativar o Windows Hello desta conta com validação de segurança."
                    : "Vamos ativar o Windows Hello para login rapido com PIN ou biometria do seu PC."}
                </p>

                {passkeyVerificationMethod === "none" && (
                  <div className="mt-4 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/70">
                    {startingPasskeyFlow
                      ? "Preparando validação de segurança..."
                      : passkeyFlowMode === "disable"
                        ? "Inicie o fluxo para validar sua identidade antes de desativar o Windows Hello."
                        : "Inicie o fluxo para validar sua identidade antes de ativar o Windows Hello."}
                  </div>
                )}

                {passkeyVerificationMethod === "email" &&
                  !(passkeyFlowMode === "disable" && passkeyAwaitingDisableAuth) && (
                  <>
                    <p className="mt-4 text-[14px] leading-[1.45] text-black/62">
                      Digite o código de 7 dígitos enviado para{" "}
                      <span className="break-all font-semibold text-black/78">
                        {passkeyEmailMask || maskSecureEmail(localEmail)}
                      </span>
                      {passkeyFlowMode === "disable"
                        ? " para continuar a desativação do Windows Hello."
                        : "."}
                    </p>
                    <CodeBoxes
                      length={7}
                      value={passkeyEmailCode}
                      onChange={setPasskeyEmailCode}
                      onComplete={(value) => {
                        if (passkeyFlowMode === "disable") {
                          void verifyPasskeyDisable(value);
                          return;
                        }
                        void verifyPasskeyActivation(value);
                      }}
                      disabled={verifyingPasskeyCode || registeringPasskey}
                    />
                    <div className="mt-4 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={resendPasskeyEmailCode}
                        disabled={isPasskeyBusy || passkeyResendCooldown > 0}
                        className="text-[13px] font-semibold text-black/72 transition-colors hover:text-black/88 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {passkeyResendCooldown > 0
                          ? `Reenviar código (${passkeyResendCooldown}s)`
                          : resendingPasskeyCode
                          ? "Reenviando..."
                          : "Reenviar código"}
                      </button>
                    </div>
                  </>
                )}

                {passkeyFlowMode === "activate" && passkeyVerificationMethod === "two-factor" && (
                  <>
                    <p className="mt-4 text-[14px] leading-[1.45] text-black/62">
                      Sua conta tem autenticação em 2 etapas ativa. Confirme com o código do
                      aplicativo para autorizar o Windows Hello.
                    </p>
                    <div className="mt-3 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/70">
                      A validação de 2 etapas acontece na ilha dinâmica de segurança.
                    </div>
                  </>
                )}

                {passkeyFlowMode === "disable" && passkeyAwaitingDisableAuth && (
                  <>
                    <p className="mt-4 text-[14px] leading-[1.45] text-black/62">
                      Código de e-mail confirmado. Agora conclua a desativação usando Windows Hello
                      ou código de 2 etapas (se estiver ativo).
                    </p>
                    <div className="mt-3 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/70">
                      A confirmação final acontece na ilha dinâmica de segurança.
                    </div>
                  </>
                )}

                {passkeyFlowMode === "activate" && registeringPasskey && (
                  <div className="mt-4 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/70">
                    Abrindo o Windows Hello. Confirme no prompt do sistema com seu PIN ou
                    biometria.
                  </div>
                )}

                {passkeyError && (
                  <p className="mt-4 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                    {passkeyError}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closePasskeyModal}
                    disabled={isPasskeyBusy}
                    className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  {passkeyVerificationMethod === "none" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (passkeyFlowMode === "disable") {
                          void startPasskeyDisableFlow();
                          return;
                        }
                        void startPasskeyActivationFlow();
                      }}
                      disabled={isPasskeyBusy}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {startingPasskeyFlow
                        ? "Iniciando..."
                        : passkeyFlowMode === "disable"
                          ? "Iniciar desativação"
                          : "Iniciar validação"}
                    </button>
                  )}

                  {passkeyFlowMode === "activate" && passkeyVerificationMethod === "two-factor" && (
                    <button
                      type="button"
                      onClick={reopenPasskeyAuthIsland}
                      disabled={isPasskeyBusy}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {verifyingPasskeyCode ? "Validando..." : "Validar 2 etapas"}
                    </button>
                  )}

                  {passkeyFlowMode === "disable" && passkeyAwaitingDisableAuth && (
                    <button
                      type="button"
                      onClick={reopenPasskeyAuthIsland}
                      disabled={isPasskeyBusy}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {verifyingPasskeyCode ? "Validando..." : "Confirmar desativação"}
                    </button>
                  )}

                  {passkeyVerificationMethod === "email" && !passkeyAwaitingDisableAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        if (passkeyFlowMode === "disable") {
                          void verifyPasskeyDisable();
                          return;
                        }
                        void verifyPasskeyActivation();
                      }}
                      disabled={isPasskeyBusy || onlyDigits(passkeyEmailCode).length !== 7}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {verifyingPasskeyCode || registeringPasskey
                        ? "Validando..."
                        : passkeyFlowMode === "disable"
                          ? "Validar e continuar"
                          : "Confirmar e ativar"}
                    </button>
                  )}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {accountActionTwoFactorModalOpen && (
          <motion.div
            className="fixed inset-0 z-[238] px-4 pt-4 sm:px-6 sm:pt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/62 backdrop-blur-[11px]" />

            <div className="relative z-[1] flex flex-col items-center">
              <motion.section
                layout
                role="dialog"
                aria-modal="true"
                className={cx(
                  "relative overflow-hidden border border-white/12 [background:linear-gradient(180deg,#121212_0%,#090909_28%,#000000_100%)] shadow-[0_30px_98px_rgba(0,0,0,0.66)]",
                  accountActionTwoFactorUiLoading
                    ? "h-11 w-11 rounded-full p-0"
                    : "w-[min(96vw,560px)] rounded-[30px] px-4 pb-5 pt-3 sm:w-[min(92vw,580px)] sm:px-5 sm:pb-6"
                )}
                initial={{ opacity: 0, y: -58, scale: 0.78, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -74, scale: 0.86, filter: "blur(3px)" }}
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 34,
                  mass: 0.8,
                  layout: { type: "spring", stiffness: 360, damping: 30, mass: 0.9 },
                }}
              >
                <span
                  aria-hidden="true"
                  className="twofactor-island-border pointer-events-none absolute inset-0 rounded-[inherit]"
                  style={{
                    padding: "1.2px",
                    background:
                      "conic-gradient(from var(--a), rgba(255,255,255,0) 0 76%, rgba(255,255,255,0.86) 84%, rgba(255,255,255,0.22) 91%, rgba(255,255,255,0) 100%)",
                    WebkitMask:
                      "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                  }}
                />
                <div className="relative z-[1]">
                  {accountActionTwoFactorUiLoading ? (
                    <div className="h-full w-full" />
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-[14px] font-semibold tracking-[0.02em] text-white/92 sm:text-[15px]">
                            {accountActionTwoFactorTitle}
                          </h3>
                          <p className="mt-0.5 text-[12px] text-white/58">
                            {accountActionTwoFactorDescription}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {accountActionCanChooseMethod && accountActionAuthMethod !== "choose" && (
                            <button
                              type="button"
                              onClick={backToAccountActionAuthMethodChoice}
                              disabled={accountActionTwoFactorBusy}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Voltar para opções de validação"
                            >
                              <Undo2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={closeAccountActionTwoFactorModal}
                            disabled={accountActionTwoFactorBusy}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {accountActionCanChooseMethod && accountActionAuthMethod === "choose" && (
                        <div className="mt-4 flex w-full flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => chooseAccountActionAuthMethod("totp")}
                            disabled={accountActionTwoFactorBusy}
                            className="h-11 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 text-[12px] font-semibold text-white/78 transition-colors hover:bg-white/[0.1] sm:h-12 sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Código de Autenticação
                          </button>
                          <button
                            type="button"
                            onClick={() => chooseAccountActionAuthMethod("passkey")}
                            disabled={accountActionTwoFactorBusy}
                            className="h-11 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 text-[12px] font-semibold text-white/78 transition-colors hover:bg-white/[0.1] sm:h-12 sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Windows Hello
                          </button>
                        </div>
                      )}

                      {accountActionShowTotpInput && (
                        <motion.div
                          animate={
                            accountActionTwoFactorShakeTick > 0
                              ? { x: [0, -3, 3, -2, 2, 0] }
                              : { x: 0 }
                          }
                          transition={{ duration: 0.23, ease: "easeOut" }}
                          onMouseDownCapture={clearAccountActionTwoFactorFeedback}
                          onTouchStartCapture={clearAccountActionTwoFactorFeedback}
                          onFocusCapture={clearAccountActionTwoFactorFeedback}
                        >
                          <CodeBoxes
                            length={6}
                            value={accountActionTwoFactorCode}
                            onChange={setAccountActionTwoFactorCode}
                            onComplete={(value) => {
                              void submitAccountActionTwoFactorCode(value);
                            }}
                            disabled={accountActionTwoFactorBusy}
                            variant="dark"
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.section>
              <div className="relative z-[1] mt-2 flex w-full justify-center">
                <AnimatePresence initial={false}>
                  {accountActionTwoFactorInvalidError ? (
                    <motion.div
                      key="account-action-twofactor-error"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="relative inline-flex overflow-hidden rounded-full"
                    >
                      <span
                        aria-hidden="true"
                        className="twofactor-error-border pointer-events-none absolute inset-0 rounded-[inherit]"
                        style={{
                          padding: "1px",
                          background:
                            "conic-gradient(from var(--a), rgba(227,82,75,0) 0 74%, rgba(227,82,75,0.86) 84%, rgba(227,82,75,0.28) 92%, rgba(227,82,75,0) 100%)",
                          WebkitMask:
                            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                          WebkitMaskComposite: "xor",
                          maskComposite: "exclude",
                        }}
                      />
                      <span className="relative inline-flex rounded-full bg-[#e3524b]/14 px-3 py-1 text-[11px] font-medium text-[#ff8b86]">
                        Código de autenticação inválido. Tente novamente.
                      </span>
                    </motion.div>
                  ) : verifyingAccountActionPasskey ? (
                    <motion.div
                      key="account-action-twofactor-passkey-loading"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="relative inline-flex overflow-hidden rounded-full"
                    >
                      <span
                        aria-hidden="true"
                        className="twofactor-island-border pointer-events-none absolute inset-0 rounded-[inherit]"
                        style={{
                          padding: "1px",
                          background:
                            "conic-gradient(from var(--a), rgba(255,255,255,0) 0 76%, rgba(255,255,255,0.9) 84%, rgba(255,255,255,0.24) 92%, rgba(255,255,255,0) 100%)",
                          WebkitMask:
                            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                          WebkitMaskComposite: "xor",
                          maskComposite: "exclude",
                        }}
                      />
                      <span className="relative inline-flex items-center gap-2 rounded-full bg-black/28 px-3 py-1 text-[11px] font-medium text-white/88">
                        <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border border-white/45 border-t-white" />
                        Autenticando Windows Hello, aguarde...
                      </span>
                    </motion.div>
                  ) : accountActionTwoFactorError ? (
                    <motion.div
                      key="account-action-twofactor-generic-error"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="inline-flex rounded-full bg-[#e3524b]/14 px-3 py-1 text-[11px] font-medium text-[#ffb2ae]"
                    >
                      {accountActionTwoFactorError}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {twoFactorModalOpen && (
          <motion.div
            className="fixed inset-0 z-[228] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
              onClick={closeTwoFactorModal}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              className="relative z-[1] w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_26px_70px_rgba(0,0,0,0.35)] sm:w-[min(92vw,700px)]"
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                <h3 className="text-[18px] font-semibold text-black/80">
                  {twoFactorEnabled ? "Desativar autenticação de 2 etapas" : "Ativar autenticação de 2 etapas"}
                </h3>
                <button
                  type="button"
                  onClick={closeTwoFactorModal}
                  disabled={isTwoFactorBusy}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                {twoFactorStep === "enable-verify-app" && (
                  <>
                    {twoFactorEnableSubStep === "setup" && (
                      <>
                        <p className="text-[14px] leading-[1.45] text-black/62">
                          Escaneie o QR code com Google Authenticator, Microsoft Authenticator ou app
                          equivalente. Se preferir, use o código manual.
                        </p>

                        {twoFactorQrCodeDataUrl ? (
                          <div className="mt-4 flex justify-center">
                            <div className="rounded-2xl border border-black/10 bg-white p-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={twoFactorQrCodeDataUrl}
                                alt="QR code para autenticação em duas etapas"
                                className="h-[220px] w-[220px] object-contain"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl border border-black/10 bg-white/80 px-3 py-3 text-[13px] text-black/62">
                            Gerando QR code...
                          </div>
                        )}

                        <div className="mt-4 flex justify-center">
                          <div className="w-full max-w-[360px]">
                            <p className="mb-2 text-center text-[13px] font-medium text-black/62">
                              Código manual
                            </p>
                            <div className="relative">
                              <input
                                type="text"
                                readOnly
                                value={twoFactorManualCode || ""}
                                placeholder="Aguardando código..."
                                className="h-11 w-full rounded-xl border border-black/12 bg-white/92 px-3 pr-12 text-center text-[13px] font-semibold tracking-[0.08em] text-black/80 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => void copyTwoFactorManualCode()}
                                disabled={!twoFactorManualCode || isTwoFactorBusy}
                                title="Copiar código manual"
                                aria-label="Copiar código manual"
                                className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-black/60 transition-colors hover:bg-black/[0.05] hover:text-black/82 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {copyingTwoFactorCode === "copied" ? (
                                  <Check className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        <p className="mt-5 text-[14px] leading-[1.45] text-black/62">
                          Depois de adicionar no aplicativo, clique em continuar para validar.
                        </p>
                      </>
                    )}
                    {twoFactorEnableSubStep === "verify" && !usingTwoFactorEnableIsland && (
                      <p className="mt-5 text-[14px] leading-[1.45] text-black/62">
                        Digite o código de 6 dígitos gerado no aplicativo para ativar.
                      </p>
                    )}
                    {twoFactorEnableSubStep === "verify" && !usingTwoFactorEnableIsland && (
                      <>
                        <CodeBoxes
                          length={6}
                          value={twoFactorAppCode}
                          onChange={setTwoFactorAppCode}
                          onComplete={verifyTwoFactorEnableCode}
                          disabled={isTwoFactorBusy}
                        />
                      </>
                    )}
                  </>
                )}

                {twoFactorStep === "disable-intro" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      A autenticação de 2 etapas está ativa nesta conta.
                    </p>
                    <p className="mt-3 text-[14px] leading-[1.45] text-black/62">
                      Para desativar, você vai confirmar em duas etapas:
                    </p>
                    <ol className="mt-2 list-decimal pl-5 text-[14px] leading-[1.5] text-black/62">
                      <li>Código de 7 dígitos enviado para seu e-mail.</li>
                      <li>Confirmação final com Windows Hello ou código de 2 etapas (se ativo).</li>
                    </ol>
                    <p className="mt-3 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/72">
                      E-mail para confirmação:{" "}
                      <span className="font-semibold text-black/86">
                        {twoFactorEmailMask || maskSecureEmail(localEmail)}
                      </span>
                    </p>
                  </>
                )}

                {twoFactorStep === "disable-verify-email" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Digite o código de 7 dígitos enviado para{" "}
                      <span className="break-all font-semibold text-black/78">
                        {twoFactorEmailMask || maskSecureEmail(localEmail)}
                      </span>{" "}
                      para continuar a desativação da autenticação de 2 etapas.
                    </p>
                    <CodeBoxes
                      length={7}
                      value={twoFactorEmailCode}
                      onChange={setTwoFactorEmailCode}
                      onComplete={verifyTwoFactorDisableEmailCode}
                      disabled={isTwoFactorBusy}
                    />
                    <div className="mt-4 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={resendTwoFactorDisableEmailCode}
                        disabled={isTwoFactorBusy || twoFactorResendCooldown > 0}
                        className="text-[13px] font-semibold text-black/72 transition-colors hover:text-black/88 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {twoFactorResendCooldown > 0
                          ? `Reenviar código (${twoFactorResendCooldown}s)`
                          : resendingTwoFactorCode
                          ? "Reenviando..."
                          : "Reenviar código"}
                      </button>
                    </div>
                  </>
                )}

                {twoFactorStep === "disable-verify-app" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Código de e-mail confirmado. Agora conclua a desativação com Windows Hello
                      ou código de 2 etapas na ilha dinâmica de segurança.
                    </p>
                    <CodeBoxes
                      length={6}
                      value={twoFactorAppCode}
                      onChange={setTwoFactorAppCode}
                      onComplete={verifyTwoFactorDisableAppCode}
                      disabled={isTwoFactorBusy}
                    />
                  </>
                )}

                {twoFactorError && (
                  <p className="mt-4 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
                    {twoFactorError}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  {twoFactorStep !== "enable-verify-app" && (
                    <button
                      type="button"
                      onClick={closeTwoFactorModal}
                      disabled={isTwoFactorBusy}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  )}

                  {twoFactorStep === "enable-verify-app" && twoFactorEnableSubStep === "setup" && (
                    <button
                      type="button"
                      onClick={() => void startTwoFactorEnableFlow()}
                      disabled={isTwoFactorBusy}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {startingTwoFactorFlow ? "Gerando..." : "Gerar novo QR"}
                    </button>
                  )}

                  {twoFactorStep === "enable-verify-app" && twoFactorEnableSubStep === "setup" && (
                    <button
                      type="button"
                      onClick={continueTwoFactorEnableFlow}
                      disabled={isTwoFactorBusy || !twoFactorTicket || !twoFactorQrCodeDataUrl}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Continuar
                    </button>
                  )}

                  {twoFactorStep === "enable-verify-app" &&
                    twoFactorEnableSubStep === "verify" &&
                    !usingTwoFactorEnableIsland && (
                    <button
                      type="button"
                      onClick={backToTwoFactorEnableSetup}
                      disabled={isTwoFactorBusy}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Voltar
                    </button>
                  )}

                  {twoFactorStep === "enable-verify-app" &&
                    twoFactorEnableSubStep === "verify" &&
                    !usingTwoFactorEnableIsland && (
                    <button
                      type="button"
                      onClick={() => void verifyTwoFactorEnableCode()}
                      disabled={isTwoFactorBusy || onlyDigits(twoFactorAppCode).length !== 6}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {verifyingTwoFactorStep ? "Validando..." : "Ativar 2 etapas"}
                    </button>
                  )}

                  {twoFactorStep === "disable-intro" && (
                    <button
                      type="button"
                      onClick={() => void startTwoFactorDisableFlow()}
                      disabled={isTwoFactorBusy}
                      className="rounded-xl bg-[#e3524b] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#d34942] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {startingTwoFactorFlow ? "Iniciando..." : "Confirmar desativação"}
                    </button>
                  )}

                  {twoFactorStep === "disable-verify-email" && (
                    <button
                      type="button"
                      onClick={() => void verifyTwoFactorDisableEmailCode()}
                      disabled={isTwoFactorBusy || onlyDigits(twoFactorEmailCode).length !== 7}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {verifyingTwoFactorStep ? "Validando..." : "Validar e continuar"}
                    </button>
                  )}

                  {twoFactorStep === "disable-verify-app" && (
                    <button
                      type="button"
                      onClick={() => void verifyTwoFactorDisableAppCode()}
                      disabled={isTwoFactorBusy || onlyDigits(twoFactorAppCode).length !== 6}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {verifyingTwoFactorStep ? "Validando..." : "Confirmar desativação"}
                    </button>
                  )}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {twoFactorRecoveryModalOpen && (
          <motion.div
            className="fixed inset-0 z-[229] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
              onClick={closeTwoFactorRecoveryModal}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              className="relative z-[1] w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_26px_70px_rgba(0,0,0,0.35)] sm:w-[min(92vw,700px)]"
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                <h3 className="text-[18px] font-semibold text-black/80">Códigos de recuperação</h3>
                <button
                  type="button"
                  onClick={closeTwoFactorRecoveryModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                <p className="text-[14px] leading-[1.45] text-black/62">
                  Sua autenticação em 2 etapas foi ativada. Guarde estes códigos de recuperação em
                  local seguro.
                </p>
                <p className="mt-3 rounded-xl border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-3 text-[13px] font-medium text-[#b2433e]">
                  Se você perder acesso ao e-mail e ao dispositivo autenticador, pode ficar sem
                  acesso a conta. Recomendamos baixar o arquivo .txt agora.
                </p>
                <p className="mt-3 text-[13px] leading-[1.45] text-black/58">
                  Os códigos não expiram, mas cada código funciona uma única vez.
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {twoFactorRecoveryCodes.map((code, index) => {
                    const cleanCode = String(code || "").trim();
                    const isCopied = copiedRecoveryCode === cleanCode;
                    return (
                      <button
                        key={`${cleanCode}-${index}`}
                        type="button"
                        onClick={() => void copyTwoFactorRecoveryCode(cleanCode)}
                        title={isCopied ? "Código copiado" : "Passe o mouse para revelar e clique para copiar"}
                        aria-label="Revelar e copiar código de recuperação"
                        className="group rounded-xl border border-black/12 bg-white/92 px-3 py-2 text-center text-[14px] font-semibold tracking-[0.06em] text-black/78 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                      >
                        <span
                          className={cx(
                            "inline-block transition-[filter] duration-200",
                            isCopied
                              ? "blur-0"
                              : "blur-[5px] group-hover:blur-0 group-focus-visible:blur-0 group-active:blur-0",
                          )}
                        >
                          {cleanCode}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeTwoFactorRecoveryModal}
                    className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70"
                  >
                    Ignorar por agora
                  </button>
                  <button
                    type="button"
                    onClick={downloadTwoFactorRecoveryCodesTxt}
                    disabled={!twoFactorRecoveryCodes.length}
                    className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {twoFactorRecoveryDownloaded ? "Baixado (.txt)" : "Baixar .txt"}
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function DeviceIconBadge({ mobile = false }: { mobile?: boolean }) {
  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-black/10 bg-black/[0.06] text-black/60">
      {mobile ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
    </span>
  );
}

type PrivacyRequiredPreferences = {
  dataProcessing: boolean;
  securityAndFraud: boolean;
  legalCompliance: boolean;
  transactionalCommunications: boolean;
};

type PrivacyOptionalPreferences = {
  productAnalytics: boolean;
  personalizedExperience: boolean;
  marketingCommunications: boolean;
  sponsorMarketing: boolean;
  thirdPartySponsoredPersonalization: boolean;
};

type PrivacySettingsApiResponse = {
  ok?: boolean;
  error?: string;
  settings?: {
    required?: Partial<PrivacyRequiredPreferences> | null;
    optional?: Partial<PrivacyOptionalPreferences> | null;
    updatedAt?: string | null;
  } | null;
};

const PRIVACY_REQUIRED_DEFAULTS: PrivacyRequiredPreferences = {
  dataProcessing: true,
  securityAndFraud: true,
  legalCompliance: true,
  transactionalCommunications: true,
};

const PRIVACY_OPTIONAL_DEFAULTS: PrivacyOptionalPreferences = {
  productAnalytics: true,
  personalizedExperience: true,
  marketingCommunications: false,
  sponsorMarketing: false,
  thirdPartySponsoredPersonalization: false,
};

function normalizePrivacyRequiredPreferences(
  value?: Partial<PrivacyRequiredPreferences> | null,
) {
  return {
    dataProcessing:
      typeof value?.dataProcessing === "boolean"
        ? value.dataProcessing
        : PRIVACY_REQUIRED_DEFAULTS.dataProcessing,
    securityAndFraud:
      typeof value?.securityAndFraud === "boolean"
        ? value.securityAndFraud
        : PRIVACY_REQUIRED_DEFAULTS.securityAndFraud,
    legalCompliance:
      typeof value?.legalCompliance === "boolean"
        ? value.legalCompliance
        : PRIVACY_REQUIRED_DEFAULTS.legalCompliance,
    transactionalCommunications:
      typeof value?.transactionalCommunications === "boolean"
        ? value.transactionalCommunications
        : PRIVACY_REQUIRED_DEFAULTS.transactionalCommunications,
  };
}

function normalizePrivacyOptionalPreferences(
  value?: Partial<PrivacyOptionalPreferences> | null,
) {
  return {
    productAnalytics:
      typeof value?.productAnalytics === "boolean"
        ? value.productAnalytics
        : PRIVACY_OPTIONAL_DEFAULTS.productAnalytics,
    personalizedExperience:
      typeof value?.personalizedExperience === "boolean"
        ? value.personalizedExperience
        : PRIVACY_OPTIONAL_DEFAULTS.personalizedExperience,
    marketingCommunications:
      typeof value?.marketingCommunications === "boolean"
        ? value.marketingCommunications
        : PRIVACY_OPTIONAL_DEFAULTS.marketingCommunications,
    sponsorMarketing:
      typeof value?.sponsorMarketing === "boolean"
        ? value.sponsorMarketing
        : PRIVACY_OPTIONAL_DEFAULTS.sponsorMarketing,
    thirdPartySponsoredPersonalization:
      typeof value?.thirdPartySponsoredPersonalization === "boolean"
        ? value.thirdPartySponsoredPersonalization
        : PRIVACY_OPTIONAL_DEFAULTS.thirdPartySponsoredPersonalization,
  };
}

function formatPrivacyUpdatedLabel(value?: string | null, nowMs = Date.now()) {
  const base = formatElapsedTimeLabel(value, nowMs);
  if (base === "agora") return "agora";
  return `há ${base}`;
}

type PrivacyRowProps = {
  title: string;
  description: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  badge?: string;
  saving?: boolean;
};

function PrivacyToggleRow({
  title,
  description,
  checked,
  disabled = false,
  onToggle,
  badge,
  saving = false,
}: PrivacyRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 -mx-2 rounded-xl px-2 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[18px] font-semibold text-black/85">{title}</p>
          {badge ? (
            <span className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-black/62">
              {badge}
            </span>
          ) : null}
          {saving ? (
            <span className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-black/62">
              Salvando...
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[15px] leading-[1.45] text-black/58">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={cx(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-220 disabled:cursor-not-allowed disabled:opacity-70",
          checked ? "bg-lime-400/85" : "bg-black/20",
        )}
      >
        <span
          className={cx(
            "inline-block h-5 w-5 rounded-full bg-white transition-transform duration-220",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

function PrivacyDataContent() {
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<keyof PrivacyOptionalPreferences | null>(null);
  const [requiredPreferences, setRequiredPreferences] = useState<PrivacyRequiredPreferences>(
    PRIVACY_REQUIRED_DEFAULTS,
  );
  const [optionalPreferences, setOptionalPreferences] = useState<PrivacyOptionalPreferences>(
    PRIVACY_OPTIONAL_DEFAULTS,
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [relativeNowMs, setRelativeNowMs] = useState(() => Date.now());

  const requiredRows = useMemo(
    () =>
      [
        {
          key: "dataProcessing" as const,
          title: "Utilizar dados para operar os serviços Wyzer",
          description:
            "Processamos dados de conta, autenticação, sessões e uso para entregar os recursos principais com estabilidade e segurança.",
          href: "https://privacy.wyzer.com.br/",
        },
        {
          key: "securityAndFraud" as const,
          title: "Utilizar dados para segurança e prevenção a fraude",
          description:
            "Mantemos monitoramento tecnico de risco para bloquear acessos indevidos, abusos e tentativas de fraude na plataforma.",
          href: "https://privacy.wyzer.com.br/",
        },
        {
          key: "legalCompliance" as const,
          title: "Utilizar dados para cumprimento legal e regulatório",
          description:
            "Armazenamos evidências e logs exigidos por lei, auditoria e obrigações regulatórias aplicáveis ao serviço.",
          href: "https://terms.wyzer.com.br/",
        },
        {
          key: "transactionalCommunications" as const,
          title: "Enviar comunicações essenciais da conta",
          description:
            "Notificações de segurança, códigos de verificação, alertas de acesso e avisos críticos da conta são obrigatórios.",
          href: "https://privacy.wyzer.com.br/",
        },
      ] satisfies Array<{
        key: keyof PrivacyRequiredPreferences;
        title: string;
        description: string;
        href: string;
      }>,
    [],
  );

  const optionalRows = useMemo(
    () =>
      [
        {
          key: "productAnalytics" as const,
          title: "Utilizar dados para melhorar a plataforma",
          description:
            "Permite análises de uso para performance, estabilidade e melhoria contínua dos recursos da Wyzer.",
          href: "https://privacy.wyzer.com.br/",
        },
        {
          key: "personalizedExperience" as const,
          title: "Personalizar minhá experiência no Wyzer",
          description:
            "Permite ajustar conteúdo, sugestões e organização da interface com base no seu contexto de uso.",
          href: "https://privacy.wyzer.com.br/",
        },
        {
          key: "marketingCommunications" as const,
          title: "Receber comunicações de marketing",
          description:
            "Permite envio de novidades, lançamentos e campanhas da Wyzer por canais como e-mail e notificações.",
          href: "https://privacy.wyzer.com.br/",
        },
        {
          key: "sponsorMarketing" as const,
          title: "Compartilhamento com patrocinadores para marketing",
          description:
            "Permite compartilhamento controlado de dados para mensuração e personalização de conteúdo patrocinado.",
          href: "https://privacy.wyzer.com.br/",
        },
        {
          key: "thirdPartySponsoredPersonalization" as const,
          title: "Usar dados de terceiros para conteúdo patrocinado",
          description:
            "Permite combinar dados de parceiros para personalização de campanhas. Sem isso, o conteúdo não será personalizado.",
          href: "https://privacy.wyzer.com.br/",
        },
      ] satisfies Array<{
        key: keyof PrivacyOptionalPreferences;
        title: string;
        description: string;
        href: string;
      }>,
    [],
  );

  const loadPreferences = useCallback(
    async (opts?: { signal?: AbortSignal; silent?: boolean }) => {
      const signal = opts?.signal;
      if (!mountedRef.current) return;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch("/api/wz_users/privacy-settings", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal,
        });
        const payload = (await response.json().catch(() => ({}))) as PrivacySettingsApiResponse;

        if (!response.ok || !payload?.ok || !payload.settings) {
          throw new Error(
            String(payload?.error || "Não foi possível carregar as preferências de privacidade."),
          );
        }

        if (!mountedRef.current) return;
        setRequiredPreferences(
          normalizePrivacyRequiredPreferences(payload.settings.required),
        );
        setOptionalPreferences(
          normalizePrivacyOptionalPreferences(payload.settings.optional),
        );
        setUpdatedAt(normalizeIsoDatetime(payload.settings.updatedAt) || new Date().toISOString());
      } catch (fetchError) {
        if (!mountedRef.current || signal?.aborted) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Não foi possível carregar as preferências de privacidade.",
        );
      } finally {
        if (!opts?.silent && mountedRef.current && !signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void loadPreferences({ signal: controller.signal });
    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [loadPreferences]);

  useEffect(() => {
    let disposed = false;
    const tick = () => {
      if (disposed) return;
      setRelativeNowMs(Date.now());
    };

    tick();
    const timer = window.setInterval(tick, 60000);
    const onFocus = () => tick();
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const toggleOptionalPreference = useCallback(
    async (key: keyof PrivacyOptionalPreferences) => {
      if (savingKey || loading) return;

      const previous = optionalPreferences;
      const next = {
        ...previous,
        [key]: !previous[key],
      };

      setOptionalPreferences(next);
      setSavingKey(key);
      setError(null);

      try {
        const response = await fetch("/api/wz_users/privacy-settings", {
          method: "PUT",
          cache: "no-store",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            optional: {
              [key]: next[key],
            },
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as PrivacySettingsApiResponse;

        if (!response.ok || !payload?.ok || !payload.settings) {
          throw new Error(
            String(payload?.error || "Não foi possível atualizar a preferência."),
          );
        }

        if (!mountedRef.current) return;
        setRequiredPreferences((current) =>
          normalizePrivacyRequiredPreferences(payload.settings?.required || current),
        );
        setOptionalPreferences((current) =>
          normalizePrivacyOptionalPreferences(payload.settings?.optional || current),
        );
        setUpdatedAt(normalizeIsoDatetime(payload.settings.updatedAt) || new Date().toISOString());
      } catch (updateError) {
        if (!mountedRef.current) return;
        setOptionalPreferences(previous);
        setError(
          updateError instanceof Error
            ? updateError.message
            : "Não foi possível atualizar a preferência.",
        );
      } finally {
        if (mountedRef.current) {
          setSavingKey(null);
        }
      }
    },
    [loading, optionalPreferences, savingKey],
  );

  const updatedLabel = useMemo(() => {
    if (!updatedAt) return null;
    return `Última atualização: ${formatPrivacyUpdatedLabel(updatedAt, relativeNowMs)}`;
  }, [relativeNowMs, updatedAt]);

  return (
    <div className="mx-auto w-full max-w-[980px] pb-10 text-black/80">
      <p className="text-[15px] leading-[1.45] text-black/58">
        Controle como seus dados são usados pela Wyzer. Alguns tratamentos são obrigatórios para
        segurança, autenticação e conformidade legal.
      </p>
      <p className="mt-3 text-[15px] leading-[1.45] text-black/58">
        Preferências opcionais podem ser alteradas a qualquer momento e entram em vigor
        imediatamente para sua conta.
      </p>
      {updatedLabel ? (
        <p className="mt-3 text-[13px] font-medium text-black/45">{updatedLabel}</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
          {error}
        </p>
      ) : null}

      <section className="mt-10">
        <h4 className="text-[20px] font-semibold text-black/82">Tratamentos obrigatórios</h4>
        <div className="mt-4 border-t border-black/10" />
        <div className="divide-y divide-black/10">
          {requiredRows.map((item) => (
            <PrivacyToggleRow
              key={item.key}
              title={item.title}
              checked={Boolean(requiredPreferences[item.key])}
              disabled
              badge="Obrigatório"
              description={
                <>
                  {item.description}{" "}
                  <a
                    href={item.href}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-sky-600 hover:text-sky-700"
                  >
                    Saiba mais
                  </a>
                </>
              }
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h4 className="text-[20px] font-semibold text-black/82">Tratamentos opcionais</h4>
        <div className="mt-4 border-t border-black/10" />
        {loading ? (
          <div className="mt-4 rounded-xl border border-black/10 bg-white/70 px-4 py-4 text-[14px] text-black/55">
            Carregando preferências de privacidade...
          </div>
        ) : (
          <div className="divide-y divide-black/10">
            {optionalRows.map((item) => (
              <PrivacyToggleRow
                key={item.key}
                title={item.title}
                checked={Boolean(optionalPreferences[item.key])}
                disabled={Boolean(savingKey && savingKey !== item.key)}
                saving={savingKey === item.key}
                onToggle={() => {
                  void toggleOptionalPreference(item.key);
                }}
                description={
                  <>
                    {item.description}{" "}
                    <a
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="text-sky-600 hover:text-sky-700"
                    >
                      Saiba mais
                    </a>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type AuthorizedProviderRecord = {
  id: string;
  provider: "password" | "google" | "discord" | "apple" | "github" | "microsoft" | "unknown";
  providerLabel: string;
  linkedAt: string | null;
  lastLoginAt: string | null;
  linkedEmail?: string | null;
  linkedUsername?: string | null;
  isPassword: boolean;
  isExternal: boolean;
  isPrimary: boolean;
  canRemove?: boolean;
  removeBlockedReason?: string | null;
};

type AuthorizedConnectableProvider = {
  provider: "password" | "google" | "discord" | "apple" | "github" | "microsoft" | "unknown";
  providerLabel: string;
};

type AuthorizedAppsApiResponse = {
  ok?: boolean;
  error?: string;
  primaryProvider?: string;
  creationProvider?: string;
  mustCreatePassword?: boolean;
  providers?: AuthorizedProviderRecord[];
  connectableProviders?: AuthorizedConnectableProvider[];
  summary?: {
    linkedProviders?: number;
    externalProviders?: number;
    hasPasswordProvider?: boolean;
    allSupportedConnected?: boolean;
    generatedAt?: string;
  } | null;
};

function formatAuthorizedProviderSeen(value?: string | null) {
  const base = formatElapsedTimeLabel(value);
  if (base === "agora") return "agora";
  return `há ${base}`;
}

function formatAuthorizedProviderTooltipTimestamp(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return "indisponível";
  const ms = Date.parse(clean);
  if (!Number.isFinite(ms)) return "indisponível";

  const relative = formatAuthorizedProviderSeen(clean);
  const absolute = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));

  return `${relative} • ${absolute}`;
}

function resolveAuthorizedProviderLabel(provider: AuthorizedProviderRecord) {
  if (provider.provider === "password") return "Wyzer Login";
  const raw = String(provider.providerLabel || "").trim();
  if (raw) return raw;
  if (provider.provider === "google") return "Google";
  if (provider.provider === "discord") return "Discord";
  if (provider.provider === "apple") return "Apple";
  if (provider.provider === "github") return "GitHub";
  if (provider.provider === "microsoft") return "Microsoft";
  return "Desconhecido";
}

function resolveAuthorizedProviderName(
  provider?: string | null,
  providerLabelRaw?: string | null,
) {
  const clean = String(provider || "").trim().toLowerCase();
  const raw = String(providerLabelRaw || "").trim();
  if (clean === "password") return "Wyzer Login";
  if (clean === "google") return "Google";
  if (clean === "discord") return "Discord";
  if (clean === "apple") return "Apple";
  if (clean === "github") return "GitHub";
  if (clean === "microsoft") return "Microsoft";
  if (raw) return raw;
  return "Desconhecido";
}

function maskAuthorizedProviderEmail(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return null;
  const parts = clean.split("@");
  if (parts.length !== 2) return null;
  const user = parts[0];
  const domain = parts[1];
  if (!user || !domain) return null;

  const head = user.slice(0, 4);
  const tail = user.length > 4 ? user.slice(-1) : "";
  const starCount = Math.max(4, user.length - head.length - tail.length);
  return `${head}${"*".repeat(starCount)}${tail}@${domain}`;
}

function AuthorizedAppsInfoIcon({ target }: { target?: string }) {
  return (
    <span className="inline-flex h-[14px] w-[14px] items-center justify-center overflow-hidden">
      {React.createElement<LordIconProps>("lord-icon", {
        src: AUTHORIZED_APPS_TOOLTIP_ICON_URL,
        trigger: "hover",
        target,
        colors: "primary:#121330",
        style: { width: "14px", height: "14px" },
      })}
    </span>
  );
}

function buildAuthorizedProviderTooltipData(params: {
  provider: AuthorizedProviderRecord;
  isCreationProvider: boolean;
  mustCreatePassword: boolean;
}) {
  const tags: string[] = [];
  const providerId = String(params.provider.provider || "").trim().toLowerCase();

  if (providerId === "password") {
    tags.push("Padrão");
    tags.push(params.mustCreatePassword ? "Senha pendente" : "Senha definida");
  }

  if (params.provider.isPrimary) {
    tags.push("Principal");
  }

  if (params.provider.isExternal) {
    tags.push("Externo");
  }

  if (params.isCreationProvider) {
    tags.push("Criado com este provedor");
  }

  const note = !params.provider.canRemove
    ? String(params.provider.removeBlockedReason || "Este provedor não pode ser removido.").trim()
    : null;

  return {
    tags: Array.from(new Set(tags)),
    note: note || null,
  };
}

function AuthorizedAppsContent() {
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthorizedProviderRecord[]>([]);
  const [connectableProviders, setConnectableProviders] = useState<AuthorizedConnectableProvider[]>([]);
  const [primaryProvider, setPrimaryProvider] = useState<string>("password");
  const [creationProvider, setCreationProvider] = useState<string>("password");
  const [mustCreatePassword, setMustCreatePassword] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [startingConnectProvider, setStartingConnectProvider] = useState<"google" | "discord" | null>(null);
  const [removingProvider, setRemovingProvider] = useState<string | null>(null);
  const [confirmingRemoveProvider, setConfirmingRemoveProvider] = useState<AuthorizedProviderRecord | null>(null);
  const mustCreatePasswordProviderName = useMemo(() => {
    const byPrimaryProvider = resolveExternalAuthProviderName(primaryProvider);
    if (byPrimaryProvider) return byPrimaryProvider;

    const externalPrimary = providers.find((provider) => provider.isPrimary && provider.isExternal);
    if (externalPrimary?.providerLabel) return String(externalPrimary.providerLabel);

    const anyExternal = providers.find((provider) => provider.isExternal);
    if (anyExternal?.providerLabel) return String(anyExternal.providerLabel);

    return null;
  }, [primaryProvider, providers]);
  const primaryProviderDisplayName = useMemo(() => {
    const primaryFromList = providers.find((provider) => provider.isPrimary);
    if (primaryFromList) {
      return resolveAuthorizedProviderLabel(primaryFromList);
    }

    const clean = String(primaryProvider || "").trim().toLowerCase();
    if (clean === "password") return "Wyzer Login";
    if (clean === "google") return "Google";
    if (clean === "discord") return "Discord";
    if (clean === "apple") return "Apple";
    if (clean === "github") return "GitHub";
    if (clean === "microsoft") return "Microsoft";
    return "Desconhecido";
  }, [primaryProvider, providers]);
  const orderedProviders = useMemo(() => {
    const getRank = (provider: AuthorizedProviderRecord) => {
      const providerId = String(provider.provider || "").trim().toLowerCase();
      if (providerId === "password") return 3;
      if (!provider.canRemove) return 2;
      return 1;
    };

    return providers
      .map((provider, index) => ({ provider, index }))
      .sort((a, b) => {
        const rankA = getRank(a.provider);
        const rankB = getRank(b.provider);
        if (rankA !== rankB) return rankA - rankB;
        return a.index - b.index;
      })
      .map((entry) => entry.provider);
  }, [providers]);
  const showLowMethodsWarning = useMemo(() => {
    const validProviders = providers.filter((provider) => provider.provider !== "unknown");
    if (!validProviders.length) return false;
    if (validProviders.length <= 1) return true;
    return validProviders.every((provider) => !provider.canRemove);
  }, [providers]);

  const loadAuthorizedApps = useCallback(async (opts?: { signal?: AbortSignal; silent?: boolean }) => {
    const signal = opts?.signal;
    if (!mountedRef.current) return;

    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch("/api/wz_users/authorized-apps", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        signal,
      });
      const payload = (await response.json().catch(() => ({}))) as AuthorizedAppsApiResponse;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          String(payload?.error || "Não foi possível carregar aplicativos autorizados."),
        );
      }

      if (!mountedRef.current) return;
      setPrimaryProvider(String(payload.primaryProvider || "password").toLowerCase());
      setCreationProvider(String(payload.creationProvider || payload.primaryProvider || "password").toLowerCase());
      setMustCreatePassword(Boolean(payload.mustCreatePassword));
      setProviders(Array.isArray(payload.providers) ? payload.providers : []);
      setConnectableProviders(
        Array.isArray(payload.connectableProviders) ? payload.connectableProviders : [],
      );
    } catch (fetchError) {
      if (!mountedRef.current || signal?.aborted) return;
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Não foi possível carregar aplicativos autorizados.",
      );
      if (!opts?.silent) {
        setProviders([]);
        setConnectableProviders([]);
      }
    } finally {
      if (!opts?.silent && mountedRef.current && !signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const startConnectProvider = useCallback(async (provider: "google" | "discord") => {
    if (startingConnectProvider || removingProvider) return;

    setError(null);
    setActionNotice(null);
    setStartingConnectProvider(provider);
    try {
      const next =
        typeof window !== "undefined" ? window.location.href : "/dashboard";
      const response = await fetch(`/api/wz_AuthLogin/${provider}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          intent: "connect",
          next,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        authUrl?: string;
      };

      if (!response.ok || !payload?.ok || !payload?.authUrl) {
        throw new Error(
          String(payload?.error || "Não foi possível iniciar a conexão do provedor."),
        );
      }

      if (typeof window !== "undefined") {
        window.location.assign(String(payload.authUrl));
      }
    } catch (connectError) {
      if (!mountedRef.current) return;
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Não foi possível iniciar a conexão do provedor.",
      );
    } finally {
      if (mountedRef.current) {
        setStartingConnectProvider(null);
      }
    }
  }, [removingProvider, startingConnectProvider]);

  const removeProvider = useCallback(async (provider: AuthorizedProviderRecord) => {
    const providerId = String(provider.provider || "").trim().toLowerCase();
    if (!providerId) return;
    if (removingProvider || startingConnectProvider) return;
    if (!provider.canRemove) {
      setError(
        String(provider.removeBlockedReason || "Este provedor não pode ser removido."),
      );
      return;
    }

    setError(null);
    setActionNotice(null);
    setRemovingProvider(providerId);
    try {
      const response = await fetch("/api/wz_users/authorized-apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          action: "remove-provider",
          provider: providerId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as AuthorizedAppsApiResponse & {
        removedProvider?: string;
      };
      if (!response.ok || !payload?.ok) {
        throw new Error(String(payload?.error || "Não foi possível remover o provedor."));
      }

      if (!mountedRef.current) return;
      setPrimaryProvider(String(payload.primaryProvider || "password").toLowerCase());
      setCreationProvider(String(payload.creationProvider || payload.primaryProvider || "password").toLowerCase());
      setMustCreatePassword(Boolean(payload.mustCreatePassword));
      setProviders(Array.isArray(payload.providers) ? payload.providers : []);
      setConnectableProviders(
        Array.isArray(payload.connectableProviders) ? payload.connectableProviders : [],
      );
      const removedProviderName = resolveAuthorizedProviderName(
        payload.removedProvider || provider.provider,
      );
      setActionNotice(`${removedProviderName} removido da conta.`);
    } catch (removeError) {
      if (!mountedRef.current) return;
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Não foi possível remover o provedor.",
      );
    } finally {
      if (mountedRef.current) {
        setRemovingProvider(null);
      }
    }
  }, [removingProvider, startingConnectProvider]);

  const confirmRemoveProvider = useCallback(async () => {
    if (!confirmingRemoveProvider) return;
    const provider = confirmingRemoveProvider;
    setConfirmingRemoveProvider(null);
    await removeProvider(provider);
  }, [confirmingRemoveProvider, removeProvider]);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void loadAuthorizedApps({ signal: controller.signal });

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [loadAuthorizedApps]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const oauthConnect = String(url.searchParams.get("oauthConnect") || "").trim().toLowerCase();
    const oauthProvider = String(url.searchParams.get("oauthProvider") || "").trim().toLowerCase();
    const oauthError = String(url.searchParams.get("oauthError") || "").trim();
    if (!oauthConnect && !oauthError) return;

    if (oauthConnect === "ok") {
      const providerName = resolveAuthorizedProviderName(oauthProvider || null);
      setActionNotice(`${providerName} conectado com sucesso.`);
      setError(null);
      void loadAuthorizedApps({ silent: true });
    } else {
      const fallback =
        oauthError || "Não foi possível conectar o provedor escolhido.";
      setError(fallback);
    }

    url.searchParams.delete("oauthConnect");
    url.searchParams.delete("oauthProvider");
    url.searchParams.delete("oauthError");
    const next =
      `${url.pathname}${url.search || ""}${url.hash || ""}` || "/";
    window.history.replaceState({}, "", next);
  }, [loadAuthorizedApps]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setActionNotice(null);
    }, 10_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [actionNotice]);

  return (
    <div className="mx-auto w-full max-w-[980px] pb-10 text-black/80">
      <Script src="https://cdn.lordicon.com/lordicon.js" strategy="afterInteractive" />
      <p className="text-[15px] leading-[1.45] text-black/58">
        Aqui estão os métodos de login vinculados à sua conta. Provedores externos (como Google)
        podem ser usados para entrar sem senha local.
      </p>
      <p className="mt-3 text-[15px] leading-[1.45] text-black/58">
        Recomendamos manter pelo menos um método interno de senha para contingência de acesso.
      </p>
      {mustCreatePassword && (
        <p className="mt-4 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
          {mustCreatePasswordProviderName
            ? `Sua conta foi criada com ${mustCreatePasswordProviderName}. Finalize a criação de senha na seção Minha Conta para liberar login por senha.`
            : "Sua conta foi criada com um provedor de login. Finalize a criação de senha na seção Minha Conta para liberar login por senha."}
        </p>
      )}
      {error ? (
        <p className="mt-4 rounded-lg border border-[#e3524b]/25 bg-[#e3524b]/8 px-3 py-2 text-[13px] font-medium text-[#b2433e]">
          {error}
        </p>
      ) : null}
      {actionNotice ? (
        <p className="mt-4 rounded-lg border border-[#35a161]/25 bg-[#35a161]/8 px-3 py-2 text-[13px] font-medium text-[#2f7f4f]">
          {actionNotice}
        </p>
      ) : null}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[20px] font-semibold text-black/82">Provedores conectados</h3>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setActionNotice(null);
              setConfirmingRemoveProvider(null);
              setConnectModalOpen(true);
            }}
            disabled={loading || Boolean(startingConnectProvider) || Boolean(removingProvider)}
            className={cx(
              "rounded-full bg-[#171717] px-4 py-2 text-[12px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992]",
              (loading || Boolean(startingConnectProvider) || Boolean(removingProvider)) &&
                "cursor-not-allowed opacity-70",
            )}
          >
            Adicionar conexão
          </button>
        </div>
        <div className="mt-4 border-t border-black/10" />
        {showLowMethodsWarning && !loading ? (
          <div className="border border-t-0 border-[#be8a23]/25 rounded-b-xl bg-[#f7d58a]/20 px-3 py-2 text-center text-[13px] font-medium text-[#7b540d]">
            <span>Recomendamos manter pelo menos 2 métodos ativos. </span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setActionNotice(null);
                setConfirmingRemoveProvider(null);
                setConnectModalOpen(true);
              }}
              disabled={Boolean(startingConnectProvider) || Boolean(removingProvider)}
              className={cx(
                "underline underline-offset-[2px] decoration-[#7b540d]/55 transition-colors hover:text-[#5f420a] hover:decoration-[#5f420a]/75",
                (Boolean(startingConnectProvider) || Boolean(removingProvider)) &&
                  "cursor-not-allowed opacity-60",
              )}
            >
              Ative um método agora mesmo
            </button>
          </div>
        ) : null}
        <div className="relative isolate mt-4 overflow-visible rounded-xl border border-black/10 bg-white/70">
          {!orderedProviders.length ? (
            <div className="px-4 py-5 text-[14px] text-black/55">
              {loading ? "Carregando provedores..." : "Nenhum provedor conectado."}
            </div>
          ) : (
            orderedProviders.map((provider, idx) => {
              const providerLabel = resolveAuthorizedProviderLabel(provider);
              const isCreationProvider =
                String(provider.provider || "").trim().toLowerCase() ===
                String(creationProvider || "").trim().toLowerCase();
              const lastLoginTooltipLabel = formatAuthorizedProviderTooltipTimestamp(provider.lastLoginAt);
              const tooltipHoverTargetId = `authorized-apps-tooltip-icon-${provider.id}`;
              const providerTooltip = buildAuthorizedProviderTooltipData({
                provider,
                isCreationProvider,
                mustCreatePassword,
              });

              return (
                <div
                  key={provider.id}
                  className={cx(
                    "relative z-[1] flex items-center gap-4 px-4 py-5 overflow-visible hover:z-[260] focus-within:z-[260]",
                    idx > 0 && "border-t border-black/10",
                  )}
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black/[0.04] text-[13px] font-semibold text-black/72">
                    {provider.provider === "google" ? (
                      <span
                        aria-hidden
                        className="h-5 w-5 bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url('${AUTHORIZED_APPS_GOOGLE_ICON_URL}')` }}
                      />
                    ) : provider.provider === "discord" ? (
                      <span
                        aria-hidden
                        className="h-5 w-5 bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url('${AUTHORIZED_APPS_DISCORD_ICON_URL}')` }}
                      />
                    ) : provider.provider === "password" ? (
                      <span
                        aria-hidden
                        className="h-5 w-5 bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url('${AUTHORIZED_APPS_WYZER_ICON_URL}')` }}
                      />
                    ) : (
                      provider.providerLabel.slice(0, 2).toUpperCase()
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-black/78">{providerLabel}</p>
                      <span className="group relative z-[280] inline-flex">
                        <button
                          id={tooltipHoverTargetId}
                          type="button"
                          aria-label={`Detalhes de ${providerLabel}`}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-black/62 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
                        >
                          <AuthorizedAppsInfoIcon target={`#${tooltipHoverTargetId}`} />
                        </button>
                        <span
                          role="tooltip"
                          className={cx(
                            "pointer-events-none absolute left-[calc(100%+8px)] top-[44%] z-[1200] w-max max-w-[360px] -translate-y-1/2 rounded-xl border border-black/12 bg-white/98 px-3 py-3 text-[12px] text-black/72 shadow-[0_16px_36px_rgba(0,0,0,0.18)] backdrop-blur-[2px]",
                            "opacity-0 translate-x-1 scale-[0.98] transition-[opacity,transform] duration-180 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                            "group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100",
                            "group-focus-within:opacity-100 group-focus-within:translate-x-0 group-focus-within:scale-100",
                          )}
                        >
                          {providerTooltip.tags.length > 0 && (
                            <span className="flex flex-wrap gap-1.5">
                              {providerTooltip.tags.map((tag) => (
                                <span
                                  key={`${provider.id}-${tag}`}
                                  className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.01em] text-black/70"
                                >
                                  {tag}
                                </span>
                              ))}
                            </span>
                          )}
                          <div
                            className={cx(
                              providerTooltip.tags.length > 0
                                ? "mt-2 border-t border-dashed border-black/14 pt-2"
                                : "mt-0",
                            )}
                          >
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/45">
                              Status da conexão
                            </p>
                            <dl className="space-y-1.5">
                              <div className="flex items-start justify-between gap-3 rounded-lg border border-black/8 bg-black/[0.025] px-2.5 py-2">
                                <dt className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-black/50">
                                  Último login
                                </dt>
                                <dd className="text-right text-[11px] font-semibold leading-[1.35] text-black/76">
                                  {lastLoginTooltipLabel}
                                </dd>
                              </div>
                            </dl>
                          </div>
                          {providerTooltip.note && (
                            <div className="mt-2 rounded-lg border border-[#be8a23]/22 bg-[#f7d58a]/20 px-2.5 py-2">
                              <span className="block text-[11px] leading-[1.4] text-[#7b540d]">
                                {providerTooltip.note}
                              </span>
                            </div>
                          )}
                        </span>
                      </span>
                    </div>
                    {(provider.provider === "google" || provider.provider === "password") ? (
                      <p className="mt-1 text-[13px] text-black/56">
                        Email vinculado: {maskAuthorizedProviderEmail(provider.linkedEmail) || "indisponível"}
                      </p>
                    ) : null}
                    {provider.provider === "discord" ? (
                      <p className="mt-1 text-[13px] text-black/56">
                        Nick vinculado: {String(provider.linkedUsername || "").trim() || "indisponível"}
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (!provider.canRemove) return;
                        setError(null);
                        setActionNotice(null);
                        setConfirmingRemoveProvider(provider);
                      }}
                      disabled={
                        !provider.canRemove ||
                        Boolean(removingProvider) ||
                        Boolean(startingConnectProvider) ||
                        Boolean(confirmingRemoveProvider)
                      }
                      title={provider.removeBlockedReason || ""}
                      className={cx(
                        "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                        provider.canRemove
                          ? "border-black/15 bg-white text-black/72 hover:bg-black/[0.03]"
                          : "border-black/10 bg-black/[0.03] text-black/35 cursor-not-allowed",
                      )}
                    >
                      {removingProvider === provider.provider ? "Removendo..." : "Remover"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-10">
        <h3 className="text-[20px] font-semibold text-black/82">Status atual</h3>
        <div className="mt-4 border-t border-black/10" />
        <div className="mt-4 rounded-xl border border-black/10 bg-white/70 px-4 py-4 text-[14px] text-black/62">
          Provedor principal: <span className="font-semibold text-black/78">{primaryProviderDisplayName}</span>.
        </div>
      </section>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {connectModalOpen && (
              <motion.div
                className="fixed inset-0 z-[1200] flex items-center justify-center px-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  aria-label="Fechar conexões"
                  className="absolute inset-0 bg-black/55 backdrop-blur-[4px]"
                  onClick={() => setConnectModalOpen(false)}
                  disabled={Boolean(startingConnectProvider)}
                />
                <motion.section
                  role="dialog"
                  aria-modal="true"
                  aria-label="Adicionar conexão"
                  initial={{ opacity: 0, y: 14, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.68 }}
                  className="relative z-[1] w-full max-w-[520px] rounded-2xl border border-black/12 bg-[#f3f3f4] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
                >
                  <h3 className="text-[22px] font-semibold text-black/82">Adicionar conexão</h3>
                  <p className="mt-2 text-[14px] leading-[1.45] text-black/62">
                    Conecte novos provedores para facilitar login futuro na mesma conta.
                  </p>

                  {connectableProviders.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-black/12 bg-white/80 px-4 py-3 text-[14px] text-black/62">
                      Você já possui todos conectados à sua conta.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {connectableProviders
                        .filter(
                          (provider) =>
                            provider.provider === "google" || provider.provider === "discord",
                        )
                        .map((provider) => {
                          const connectProvider = provider.provider as "google" | "discord";
                          const isBusy = startingConnectProvider === connectProvider;
                          return (
                            <button
                              key={provider.provider}
                              type="button"
                              onClick={() => void startConnectProvider(connectProvider)}
                              disabled={Boolean(startingConnectProvider)}
                              className={cx(
                                "group inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[15px] border border-black/10 bg-white text-[15px] font-semibold text-black/82",
                                "transition-[transform,background-color,border-color,box-shadow] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                "hover:border-black/20 hover:bg-black/[0.02] active:translate-y-[0.6px] active:scale-[0.992]",
                                "shadow-[0_10px_28px_rgba(0,0,0,0.08)]",
                                Boolean(startingConnectProvider) && "cursor-not-allowed opacity-70",
                              )}
                            >
                              {isBusy ? (
                                <span className="inline-flex h-4 w-4 rounded-full border-2 border-black/35 border-t-transparent animate-spin" />
                              ) : (
                                <span
                                  aria-hidden
                                  className="h-5 w-5 bg-contain bg-center bg-no-repeat"
                                  style={{
                                    backgroundImage:
                                      connectProvider === "google"
                                        ? `url('${AUTHORIZED_APPS_GOOGLE_ICON_URL}')`
                                        : `url('${AUTHORIZED_APPS_DISCORD_ICON_URL}')`,
                                  }}
                                />
                              )}
                              <span>
                                {isBusy
                                  ? "Conectando..."
                                  : `Conectar ${resolveAuthorizedProviderName(provider.provider, provider.providerLabel)}`}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConnectModalOpen(false)}
                      disabled={Boolean(startingConnectProvider)}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Fechar
                    </button>
                  </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {confirmingRemoveProvider && (
              <motion.div
                className="fixed inset-0 z-[1210] flex items-center justify-center px-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  aria-label="Fechar confirmação de remoção"
                  className="absolute inset-0 bg-black/55 backdrop-blur-[4px]"
                  onClick={() => setConfirmingRemoveProvider(null)}
                  disabled={Boolean(removingProvider)}
                />
                <motion.section
                  role="dialog"
                  aria-modal="true"
                  aria-label="Confirmar remoção de provedor"
                  initial={{ opacity: 0, y: 14, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.68 }}
                  className="relative z-[1] w-full max-w-[520px] rounded-2xl border border-black/12 bg-[#f3f3f4] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
                >
                  <h3 className="text-[22px] font-semibold text-black/82">Remover conexão?</h3>
                  <p className="mt-3 text-[14px] leading-[1.45] text-black/62">
                    Esta ação remove este método de login da sua conta.
                  </p>

                  <div className="mt-4 rounded-xl border border-black/12 bg-white/80 px-4 py-3">
                    <p className="text-[14px] font-semibold text-black/78">
                      {resolveAuthorizedProviderLabel(confirmingRemoveProvider)}
                    </p>
                    <p className="mt-1 text-[14px] text-black/58">
                      Você pode reconectar depois em Aplicativos Autorizados.
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingRemoveProvider(null)}
                      disabled={Boolean(removingProvider)}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmRemoveProvider()}
                      disabled={Boolean(removingProvider)}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {Boolean(removingProvider) ? "Removendo..." : "Confirmar"}
                    </button>
                  </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

type DeviceSessionRecord = {
  id: string;
  label: string;
  location: string | null;
  lastSeenAt: string | null;
  revokedAt?: string | null;
  kind: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
};

type DevicesApiResponse = {
  ok?: boolean;
  current?: DeviceSessionRecord | null;
  others?: DeviceSessionRecord[];
  history?: DeviceSessionRecord[];
  error?: string;
};

function isMobileDeviceKind(kind?: string | null) {
  const clean = String(kind || "").trim().toLowerCase();
  return clean === "mobile" || clean === "tablet";
}

function formatDeviceSeenLabel(value?: string | null) {
  const base = formatElapsedTimeLabel(value);
  if (base === "agora") return "agora";
  return `há ${base}`;
}

function DevicesContent() {
  const mountedRef = useRef(true);
  const pollInFlightRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDevice, setCurrentDevice] = useState<DeviceSessionRecord | null>(null);
  const [otherDevices, setOtherDevices] = useState<DeviceSessionRecord[]>([]);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [confirmingDevice, setConfirmingDevice] = useState<DeviceSessionRecord | null>(null);

  const loadDevices = useCallback(
    async (opts?: { signal?: AbortSignal; silent?: boolean }) => {
      const signal = opts?.signal;
      if (!mountedRef.current) return;
      if (!opts?.silent) {
        setLoading(true);
      }
      if (!opts?.silent) {
        setError(null);
      }

      try {
        const response = await fetch("/api/wz_users/devices", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal,
        });
        const payload = (await response.json().catch(() => ({}))) as DevicesApiResponse;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            String(payload?.error || "Não foi possível carregar os dispositivos."),
          );
        }

        if (!mountedRef.current) return;
        const activeOthers = Array.isArray(payload.others) ? payload.others : [];
        setCurrentDevice(payload.current || null);
        setOtherDevices(activeOthers);
      } catch (fetchError) {
        if (signal?.aborted || !mountedRef.current) return;
        if (!opts?.silent) {
          setCurrentDevice(null);
          setOtherDevices([]);
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Não foi possível carregar os dispositivos.",
        );
      } finally {
        if (!opts?.silent && !signal?.aborted && mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void loadDevices({ signal: controller.signal });
    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [loadDevices]);

  useEffect(() => {
    let disposed = false;
    const pollDevices = async () => {
      if (disposed || pollInFlightRef.current) return;
      if (document.visibilityState !== "visible") return;

      pollInFlightRef.current = true;
      try {
        await loadDevices({ silent: true });
      } finally {
        pollInFlightRef.current = false;
      }
    };

    const onFocus = () => {
      void pollDevices();
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void pollDevices();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const timer = window.setInterval(() => {
      void pollDevices();
    }, 5000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadDevices]);

  const handleLogoutDevice = useCallback(async (sessionId: string) => {
    const id = String(sessionId || "").trim();
    if (!id) return;

    setBusySessionId(id);
    setError(null);

    try {
      const response = await fetch("/api/wz_users/devices", {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: id }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload?.ok) {
        throw new Error(
          String(payload?.error || "Não foi possível deslogar este dispositivo."),
        );
      }

      await loadDevices({ silent: true });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível deslogar este dispositivo.",
      );
    } finally {
      setBusySessionId((prev) => (prev === id ? null : prev));
    }
  }, [loadDevices]);

  const handleLogoutAll = useCallback(async () => {
    setBusyAll(true);
    setError(null);

    try {
      const response = await fetch("/api/wz_users/devices", {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allOthers: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload?.ok) {
        throw new Error(
          String(payload?.error || "Não foi possível deslogar os dispositivos."),
        );
      }

      await loadDevices({ silent: true });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível deslogar os dispositivos.",
      );
    } finally {
      setBusyAll(false);
    }
  }, [loadDevices]);

  const requestLogoutDevice = useCallback((device: DeviceSessionRecord) => {
    if (!device?.id) return;
    if (Boolean(device.revokedAt)) return;
    if (busyAll || busySessionId === device.id) return;
    setConfirmingDevice(device);
  }, [busyAll, busySessionId]);

  const closeConfirmLogoutModal = useCallback(() => {
    if (confirmingDevice && busySessionId === confirmingDevice.id) return;
    setConfirmingDevice(null);
  }, [busySessionId, confirmingDevice]);

  const confirmLogoutDevice = useCallback(async () => {
    const target = confirmingDevice;
    if (!target?.id) return;
    await handleLogoutDevice(target.id);
    setConfirmingDevice(null);
  }, [confirmingDevice, handleLogoutDevice]);

  const resolvedCurrentDevice = useMemo(() => {
    if (currentDevice) return currentDevice;

    if (!loading && !error) {
      return {
        id: "current-fallback",
        label: "DISPOSITIVO ATUAL",
        location: "Localização indisponível",
        lastSeenAt: null,
        kind: "desktop" as const,
      };
    }

    return null;
  }, [currentDevice, error, loading]);

  return (
    <div className="mx-auto w-full max-w-[980px] pb-10 text-black/80">
      <p className="text-[15px] leading-[1.45] text-black/58">Aqui estão todos os dispositivos conectados à sua conta. Você pode sair de cada um individualmente ou de todos os outros ao mesmo tempo.</p>
      <p className="mt-3 text-[15px] leading-[1.45] text-black/58">Se você não reconhecer alguma sessão ativa, saia do dispositivo e altere sua senha imediatamente.</p>
      {error && <p className="mt-4 text-[14px] font-medium text-[#c04b44]">{error}</p>}

      <section className="mt-10">
        <h3 className="text-[20px] font-semibold text-black/82">Dispositivo atual</h3>
        <div className="mt-4 border-t border-black/10" />
        {!resolvedCurrentDevice ? (
          <div className="mt-4 rounded-xl border border-black/10 bg-white/70 px-4 py-4 text-[14px] text-black/55">
            {loading ? "Carregando dispositivo atual..." : "Dispositivo atual indisponível."}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-4 -mx-2 rounded-xl px-2 py-2">
            <DeviceIconBadge mobile={isMobileDeviceKind(resolvedCurrentDevice.kind)} />
            <div>
              <p className="text-[15px] font-semibold text-black/78">{resolvedCurrentDevice.label}</p>
              <p className="mt-1 text-[15px] text-black/58">
                {resolvedCurrentDevice.location || "Localização indisponível"}
                {resolvedCurrentDevice.lastSeenAt
                  ? ` - ${formatDeviceSeenLabel(resolvedCurrentDevice.lastSeenAt)}`
                  : ""}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h3 className="text-[20px] font-semibold text-black/82">Outros dispositivos</h3>
        <div className="mt-4 border-t border-black/10" />
        <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white/70">
          {!otherDevices.length ? (
            <div className="px-4 py-5 text-[14px] text-black/55">
              {loading ? "Carregando outros dispositivos..." : "Nenhum outro dispositivo conectado."}
            </div>
          ) : (
            otherDevices.map((device, idx) => (
              <div key={device.id} className={cx("flex items-center gap-4 px-4 py-5", idx > 0 && "border-t border-black/10")}>
                <DeviceIconBadge mobile={isMobileDeviceKind(device.kind)} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-black/78">{device.label}</p>
                  <p className="mt-1 truncate text-[15px] text-black/58">
                    {device.location || "Localização indisponível"} - {formatDeviceSeenLabel(device.lastSeenAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => requestLogoutDevice(device)}
                  disabled={Boolean(device.revokedAt) || busyAll || busySessionId === device.id}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-black/45 transition-all duration-220 hover:bg-black/[0.05] hover:text-black/75 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() => void handleLogoutAll()}
          disabled={busyAll || loading || !otherDevices.length}
          className="rounded-full bg-[#171717] px-6 py-3 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyAll ? "Deslogando..." : "Deslogar de todos dispositivos"}
        </button>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {confirmingDevice && (
              <motion.div
                className="fixed inset-0 z-[1200] flex items-center justify-center px-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  aria-label="Fechar confirmação"
                  className="absolute inset-0 bg-black/55 backdrop-blur-[4px]"
                  onClick={closeConfirmLogoutModal}
                />

                <motion.section
                  role="dialog"
                  aria-modal="true"
                  aria-label="Confirmar desconexão de sessão"
                  initial={{ opacity: 0, y: 14, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.68 }}
                  className="relative z-[1] w-full max-w-[520px] rounded-2xl border border-black/12 bg-[#f3f3f4] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
                >
                  <h3 className="text-[22px] font-semibold text-black/82">Desconectar sessão?</h3>
                  <p className="mt-3 text-[14px] leading-[1.45] text-black/62">
                    Esta ação vai deslogar este dispositivo em tempo real.
                  </p>

                  <div className="mt-4 rounded-xl border border-black/12 bg-white/80 px-4 py-3">
                    <p className="text-[14px] font-semibold text-black/78">{confirmingDevice.label}</p>
                    <p className="mt-1 text-[14px] text-black/58">
                      {confirmingDevice.location || "Localização indisponível"}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeConfirmLogoutModal}
                      disabled={busySessionId === confirmingDevice.id}
                      className="rounded-xl border border-black/10 bg-white/90 px-4 py-2 text-[13px] font-semibold text-black/70 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmLogoutDevice()}
                      disabled={busySessionId === confirmingDevice.id}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {busySessionId === confirmingDevice.id ? "Deslogando..." : "Confirmar"}
                    </button>
                  </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function SidebarGroup({
  title,
  items,
  activeSection,
  onSectionChange,
  tapFeedback,
  tapTransition,
  activePillTransition,
}: {
  title: string;
  items: MenuItem[];
  activeSection: ConfigSectionId;
  onSectionChange: (section: ConfigSectionId) => void;
  tapFeedback: { scale: number; y: number } | undefined;
  tapTransition: { duration: number } | { type: "spring"; stiffness: number; damping: number; mass: number };
  activePillTransition:
    | { duration: number }
    | { type: "spring"; stiffness: number; damping: number; mass: number; restDelta: number; restSpeed: number };
}) {
  if (!items.length) return null;
  return (
    <div className="border-t border-black/10 pt-3">
      <p className="mb-2 text-[13px] font-semibold text-black/45">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = item.id === activeSection;
          return (
            <li key={item.id}>
              <motion.button
                type="button"
                onClick={() => onSectionChange(item.id)}
                whileTap={tapFeedback}
                transition={tapTransition}
                className={cx(
                  "relative flex h-[40px] w-full items-center overflow-hidden rounded-xl px-2.5 text-left text-[15px] font-medium transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  active ? "text-black/80" : "text-black/55 hover:bg-black/[0.04] hover:text-black/80"
                )}
              >
                {active && (
                  <motion.span layoutId="config-sidebar-active-pill" className="pointer-events-none absolute inset-0 rounded-xl bg-[#d9d9de]" transition={activePillTransition} />
                )}
                <span className="relative z-[1] flex min-w-0 items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.iconSrc}
                    alt=""
                    className="h-[20px] w-[20px] shrink-0 object-contain"
                    draggable={false}
                    referrerPolicy="no-referrer"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-[900px] pb-10">
      <div className="rounded-2xl border border-dashed border-black/20 bg-white/50 p-6">
        <h3 className="text-[20px] font-semibold text-black/80">{title}</h3>
        <p className="mt-2 text-[14px] text-black/65">Esta seção foi preparada no modal e pode receber seu conteúdo específico agora.</p>
      </div>
    </div>
  );
}

export default function ConfigMain({
  open,
  onClose,
  activeSection,
  onSectionChange,
  userNickname = "Usuário",
  userFullName,
  userEmail = "conta@wyzer.com.br",
  userPhoneE164 = null,
  userEmailChangedAt = null,
  userPhoneChangedAt = null,
  userPasswordChangedAt = null,
  userSupportAccess = false,
  userTwoFactorEnabled = false,
  userTwoFactorEnabledAt = null,
  userTwoFactorDisabledAt = null,
  userAccountCreatedAt = null,
  userPhotoLink = null,
  onUserPhotoChange,
  onUserEmailChange,
  onUserPhoneChange,
  onUserPasswordChange,
  onUserSupportAccessChange,
  onUserTwoFactorChange,
}: ConfigMainProps) {
  const prefersReducedMotion = useReducedMotion();
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileView, setMobileView] = useState<"menu" | "content">("menu");

  const activePillTransition = useMemo(
    () =>
      prefersReducedMotion
        ? { duration: 0.12 }
        : { type: "spring" as const, stiffness: 980, damping: 54, mass: 0.46, restDelta: 0.25, restSpeed: 0.25 },
    [prefersReducedMotion]
  );
  const tapFeedback = useMemo(() => (prefersReducedMotion ? undefined : { scale: 0.992, y: 0.6 }), [prefersReducedMotion]);
  const tapTransition = useMemo(() => (prefersReducedMotion ? { duration: 0.08 } : ({ type: "spring" as const, stiffness: 1200, damping: 52, mass: 0.24 })), [prefersReducedMotion]);

  const nickname = useMemo(
    () => String(userFullName || "").trim() || String(userNickname || "").trim() || "usuário",
    [userFullName, userNickname]
  );
  const email = useMemo(() => String(userEmail || "").trim().toLowerCase() || "conta@wyzer.com.br", [userEmail]);
  const phone = useMemo(() => normalizeE164Phone(userPhoneE164), [userPhoneE164]);
  const emailChangedAt = useMemo(() => normalizeIsoDatetime(userEmailChangedAt), [userEmailChangedAt]);
  const phoneChangedAt = useMemo(() => normalizeIsoDatetime(userPhoneChangedAt), [userPhoneChangedAt]);
  const passwordChangedAt = useMemo(
    () => normalizeIsoDatetime(userPasswordChangedAt),
    [userPasswordChangedAt]
  );
  const supportAccess = useMemo(() => Boolean(userSupportAccess), [userSupportAccess]);
  const accountCreatedAt = useMemo(
    () => normalizeIsoDatetime(userAccountCreatedAt),
    [userAccountCreatedAt]
  );
  const twoFactorEnabled = useMemo(() => Boolean(userTwoFactorEnabled), [userTwoFactorEnabled]);
  const twoFactorEnabledAt = useMemo(
    () => normalizeIsoDatetime(userTwoFactorEnabledAt),
    [userTwoFactorEnabledAt]
  );
  const twoFactorDisabledAt = useMemo(
    () => normalizeIsoDatetime(userTwoFactorDisabledAt),
    [userTwoFactorDisabledAt]
  );

  const normalizedSearch = useMemo(() => normalizeForSearch(searchTerm), [searchTerm]);
  const filtered = useMemo(() => (!normalizedSearch ? menuItems : menuItems.filter((i) => normalizeForSearch(i.label).includes(normalizedSearch))), [normalizedSearch]);
  const userItems = useMemo(() => filtered.filter((i) => i.group === "user"), [filtered]);
  const billingItems = useMemo(() => filtered.filter((i) => i.group === "billing"), [filtered]);
  const appItems = useMemo(() => filtered.filter((i) => i.group === "app"), [filtered]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    const onChange = () => sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const closeConfig = useCallback(() => {
    setMobileView("menu");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeConfig();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [closeConfig, open]);

  const isMobileConfigLayout = isMobileViewport;

  const handleSectionSelect = useCallback(
    (section: ConfigSectionId) => {
      onSectionChange(section);
      if (isMobileConfigLayout) {
        setMobileView("content");
      }
    },
    [isMobileConfigLayout, onSectionChange],
  );

  const handleBackToMobileMenu = useCallback(() => {
    setMobileView("menu");
  }, []);

  const activeTitle = sectionTitles[activeSection];
  const activeSectionContent = (
    <>
      {activeSection === "my-account" && <AccountContent nickname={nickname} email={email} phoneE164={phone} emailChangedAt={emailChangedAt} phoneChangedAt={phoneChangedAt} passwordChangedAt={passwordChangedAt} supportAccess={supportAccess} accountCreatedAt={accountCreatedAt} twoFactorEnabled={twoFactorEnabled} twoFactorEnabledAt={twoFactorEnabledAt} twoFactorDisabledAt={twoFactorDisabledAt} userPhotoLink={userPhotoLink} onUserPhotoChange={onUserPhotoChange} onUserEmailChange={onUserEmailChange} onUserPhoneChange={onUserPhoneChange} onUserPasswordChange={onUserPasswordChange} onUserSupportAccessChange={onUserSupportAccessChange} onUserTwoFactorChange={onUserTwoFactorChange} />}
      {activeSection === "privacy-data" && <PrivacyDataContent />}
      {activeSection === "authorized-apps" && <AuthorizedAppsContent />}
      {activeSection === "devices" && <DevicesContent />}
      {activeSection !== "my-account" && activeSection !== "privacy-data" && activeSection !== "authorized-apps" && activeSection !== "devices" && <PlaceholderSection title={activeTitle} />}
    </>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cx(
            "fixed inset-0 z-[190]",
            isMobileConfigLayout ? "p-0" : "flex items-center justify-center p-4 sm:p-6",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Fechar configurações"
            className={cx(
              "absolute inset-0",
              isMobileConfigLayout ? "bg-[#ececef]" : "bg-black/55 backdrop-blur-[6px]",
            )}
            onClick={closeConfig}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Configurações da conta"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: isMobileConfigLayout ? 0 : 20, scale: isMobileConfigLayout ? 1 : 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: isMobileConfigLayout ? 0 : 12, scale: isMobileConfigLayout ? 1 : 0.985 }}
            transition={prefersReducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 320, damping: 32, mass: 0.72 }}
            className={cx(
              "relative z-[1] overflow-hidden bg-[#f3f3f4]",
              isMobileConfigLayout
                ? "h-dvh w-screen rounded-none border-0 shadow-none"
                : "h-[min(88vh,910px)] w-[min(95vw,1410px)] rounded-2xl border border-black/15 shadow-[0_30px_80px_rgba(0,0,0,0.44)]",
            )}
          >
            {isMobileConfigLayout ? (
              <div className="relative h-full w-full bg-[#ececef]">
                <AnimatePresence mode="wait" initial={false}>
                  {mobileView === "menu" ? (
                    <motion.div
                      key="config-mobile-menu"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                      transition={prefersReducedMotion ? { duration: 0.1 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      className="flex h-full min-h-0 flex-col"
                    >
                      <div
                        className="sticky top-0 z-[6] border-b border-black/10 bg-[#ececef]/95 px-4 pb-3 backdrop-blur"
                        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
                      >
                        <div className="flex h-10 items-center justify-between">
                          <h2 className="text-[20px] font-semibold text-black/78">Configurações</h2>
                          <button
                            type="button"
                            onClick={closeConfig}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80"
                            aria-label="Fechar configurações"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-black/14 bg-[#e7e7e8] px-3">
                          <Search className="h-[16px] w-[16px] text-black/45" />
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar"
                            className="h-full w-full bg-transparent text-[14px] text-black/70 outline-none placeholder:text-black/45"
                          />
                        </div>
                      </div>

                      <div
                        className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3"
                        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
                      >
                        <LayoutGroup id="config-sidebar-active-pills-mobile">
                          <SidebarGroup
                            title="Configurações de usuário"
                            items={userItems}
                            activeSection={activeSection}
                            onSectionChange={handleSectionSelect}
                            tapFeedback={tapFeedback}
                            tapTransition={tapTransition}
                            activePillTransition={activePillTransition}
                          />
                          {billingItems.length > 0 && (
                            <div className="mt-4">
                              <SidebarGroup
                                title="Configurações de cobrança"
                                items={billingItems}
                                activeSection={activeSection}
                                onSectionChange={handleSectionSelect}
                                tapFeedback={tapFeedback}
                                tapTransition={tapTransition}
                                activePillTransition={activePillTransition}
                              />
                            </div>
                          )}
                          {appItems.length > 0 && (
                            <div className="mt-4">
                              <SidebarGroup
                                title="Config. do aplicativo"
                                items={appItems}
                                activeSection={activeSection}
                                onSectionChange={handleSectionSelect}
                                tapFeedback={tapFeedback}
                                tapTransition={tapTransition}
                                activePillTransition={activePillTransition}
                              />
                            </div>
                          )}
                          {normalizedSearch && filtered.length === 0 && (
                            <div className="mt-4 rounded-xl border border-dashed border-black/18 bg-white/50 px-3 py-3 text-[13px] text-black/55">
                              Nenhum item encontrado.
                            </div>
                          )}
                        </LayoutGroup>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`config-mobile-content-${activeSection}`}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                      transition={prefersReducedMotion ? { duration: 0.1 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      className="flex h-full min-h-0 flex-col bg-[#f3f3f4]"
                    >
                      <div
                        className="sticky top-0 z-[8] border-b border-black/10 bg-[#f3f3f4]/95 backdrop-blur"
                        style={{ paddingTop: "env(safe-area-inset-top)" }}
                      >
                        <div className="flex h-14 items-center justify-between px-2.5">
                          <button
                            type="button"
                            onClick={handleBackToMobileMenu}
                            className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-black/70 transition-colors hover:bg-black/5 hover:text-black/85"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Voltar
                          </button>
                          <h2 className="mx-2 truncate text-[16px] font-semibold text-black/78">
                            {activeTitle}
                          </h2>
                          <button
                            type="button"
                            onClick={closeConfig}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80"
                            aria-label="Fechar configurações"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      <div
                        className="min-h-0 flex-1 overflow-y-auto px-4 pt-5"
                        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
                      >
                        {activeSectionContent}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex h-full min-h-0">
                <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-black/10 bg-[#ececef]">
                  <div className="px-4 pb-3">
                    <div className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-black/14 bg-[#e7e7e8] px-3">
                      <Search className="h-[16px] w-[16px] text-black/45" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar"
                        className="h-full w-full bg-transparent text-[14px] text-black/70 outline-none placeholder:text-black/45"
                      />
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
                    <LayoutGroup id="config-sidebar-active-pills">
                      <SidebarGroup
                        title="Configurações de usuário"
                        items={userItems}
                        activeSection={activeSection}
                        onSectionChange={handleSectionSelect}
                        tapFeedback={tapFeedback}
                        tapTransition={tapTransition}
                        activePillTransition={activePillTransition}
                      />
                      {billingItems.length > 0 && (
                        <div className="mt-4">
                          <SidebarGroup
                            title="Configurações de cobrança"
                            items={billingItems}
                            activeSection={activeSection}
                            onSectionChange={handleSectionSelect}
                            tapFeedback={tapFeedback}
                            tapTransition={tapTransition}
                            activePillTransition={activePillTransition}
                          />
                        </div>
                      )}
                      {appItems.length > 0 && (
                        <div className="mt-4">
                          <SidebarGroup
                            title="Config. do aplicativo"
                            items={appItems}
                            activeSection={activeSection}
                            onSectionChange={handleSectionSelect}
                            tapFeedback={tapFeedback}
                            tapTransition={tapTransition}
                            activePillTransition={activePillTransition}
                          />
                        </div>
                      )}
                      {normalizedSearch && filtered.length === 0 && (
                        <div className="mt-4 rounded-xl border border-dashed border-black/18 bg-white/50 px-3 py-3 text-[13px] text-black/55">
                          Nenhum item encontrado.
                        </div>
                      )}
                    </LayoutGroup>
                  </div>
                </aside>

                <div className="min-w-0 flex-1 bg-[#f3f3f4]">
                  <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6">
                    <h2 className="text-[20px] font-semibold text-black/75">{activeTitle}</h2>
                    <button
                      type="button"
                      onClick={closeConfig}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80"
                      aria-label="Fechar configurações"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="h-[calc(100%-64px)] overflow-y-auto px-4 pb-8 pt-6 sm:px-8 md:px-10">
                    {activeSectionContent}
                  </div>
                </div>
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

