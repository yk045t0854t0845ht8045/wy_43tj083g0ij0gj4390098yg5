"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  Monitor,
  Search,
  Smartphone,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  userPhotoLink?: string | null;
  onUserPhotoChange?: (photoLink: string | null) => void;
  onUserEmailChange?: (email: string, changedAt?: string | null) => void;
  onUserPhoneChange?: (phoneE164: string | null, changedAt?: string | null) => void;
};

// LINKS DOS ICONES (PNG) DA SIDEBAR DE CONFIGURACOES
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

const menuItems: MenuItem[] = [
  { id: "my-account", label: "Minha Conta", iconSrc: CONFIG_SIDEBAR_ICON_LINKS["my-account"], group: "user" },
  { id: "privacy-data", label: "Dados e Privacidade", iconSrc: CONFIG_SIDEBAR_ICON_LINKS["privacy-data"], group: "user" },
  { id: "authorized-apps", label: "Aplicativos Autorizados", iconSrc: CONFIG_SIDEBAR_ICON_LINKS["authorized-apps"], group: "user" },
  { id: "devices", label: "Dispositivos", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.devices, group: "user" },
  { id: "notifications", label: "Notificacoes", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.notifications, group: "user" },
  { id: "subscriptions", label: "Assinaturas", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.subscriptions, group: "billing" },
  { id: "billing", label: "Cobrança", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.billing, group: "billing" },
  { id: "appearance", label: "Aparencia", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.appearance, group: "app" },
  { id: "accessibility", label: "Acessibilidade", iconSrc: CONFIG_SIDEBAR_ICON_LINKS.accessibility, group: "app" },
  { id: "voice-video", label: "Voz e Vídeo", iconSrc: CONFIG_SIDEBAR_ICON_LINKS["voice-video"], group: "app" },
];

const sectionTitles: Record<ConfigSectionId, string> = {
  "my-account": "Minha Conta",
  "content-social": "Conteudo e Social",
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
  billing: "Cobranca",
  appearance: "Aparencia",
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
  if (national.length !== 11) return "Nao informado";
  return `${national.slice(0, 4)}${"*".repeat(7)}`;
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
  if (!normalized) return "nao informado";

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
    reader.onerror = () => reject(new Error("Nao foi possivel ler o arquivo."));
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
    next.onerror = () => reject(new Error("Nao foi possivel processar a imagem."));
    next.src = params.src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Falha ao iniciar canvas.");

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
      (blob) => (blob ? resolve(blob) : reject(new Error("Nao foi possivel exportar o avatar."))),
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
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
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
            "h-11 w-8 rounded-[10px] border border-black/12 bg-[#ececef] text-center text-[16px] font-semibold text-black/85 sm:h-12 sm:w-10 sm:rounded-[12px] sm:text-[18px]",
            "focus:outline-none focus:ring-2 focus:ring-black/20",
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
  userPhotoLink,
  onUserPhotoChange,
  onUserEmailChange,
  onUserPhoneChange,
}: {
  nickname: string;
  email: string;
  phoneE164?: string | null;
  emailChangedAt?: string | null;
  phoneChangedAt?: string | null;
  userPhotoLink?: string | null;
  onUserPhotoChange?: (photoLink: string | null) => void;
  onUserEmailChange?: (email: string, changedAt?: string | null) => void;
  onUserPhoneChange?: (phoneE164: string | null, changedAt?: string | null) => void;
}) {
  const [supportAccess, setSupportAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localEmail, setLocalEmail] = useState(() => String(email || "").trim().toLowerCase());
  const [localPhoneE164, setLocalPhoneE164] = useState(() => normalizeE164Phone(phoneE164));
  const [localEmailChangedAt, setLocalEmailChangedAt] = useState<string | null>(() =>
    normalizeIsoDatetime(emailChangedAt)
  );
  const [localPhoneChangedAt, setLocalPhoneChangedAt] = useState<string | null>(() =>
    normalizeIsoDatetime(phoneChangedAt)
  );
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
  const [phoneChangeError, setPhoneChangeError] = useState<string | null>(null);
  const [phoneResendCooldown, setPhoneResendCooldown] = useState(0);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [resendingPhoneCode, setResendingPhoneCode] = useState(false);
  const [verifyingPhoneCode, setVerifyingPhoneCode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => setLocalPhoto(normalizePhotoLink(userPhotoLink)), [userPhotoLink]);
  useEffect(() => setLocalEmail(String(email || "").trim().toLowerCase()), [email]);
  useEffect(() => setLocalPhoneE164(normalizeE164Phone(phoneE164)), [phoneE164]);
  useEffect(() => setLocalEmailChangedAt(normalizeIsoDatetime(emailChangedAt)), [emailChangedAt]);
  useEffect(() => setLocalPhoneChangedAt(normalizeIsoDatetime(phoneChangedAt)), [phoneChangedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRelativeNowMs(Date.now());
    }, 60000);
    return () => window.clearInterval(timer);
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
        setError("Formato invalido. Use PNG, JPG, JPEG, WEBP, GIF ou SVG.");
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
      setError("Nao foi possivel abrir a imagem.");
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
        throw new Error(payload.error || "Nao foi possivel salvar a foto de perfil.");
      }

      const next = normalizePhotoLink(payload.photoLink);
      if (!next) throw new Error("Resposta invalida do servidor.");
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
        throw new Error(payload.error || "Nao foi possivel remover a foto de perfil.");
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

  const resetEmailChangeFlow = useCallback(
    () => {
      setEmailStep("confirm-current-intro");
      setPendingEmail("");
      setEmailCode("");
      setEmailChangeTicket("");
      setEmailChangeError(null);
      setEmailResendCooldown(0);
    },
    []
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
        throw new Error(payload.error || "Nao foi possivel enviar o codigo de verificacao.");
      }

      setEmailChangeTicket(payload.ticket);
      setEmailCode("");
      setEmailStep("confirm-current-code");
      setEmailResendCooldown(60);
    } catch (err) {
      console.error("[config-account] start current email confirmation failed:", err);
      setEmailChangeError(
        err instanceof Error ? err.message : "Erro ao iniciar confirmacao do e-mail atual."
      );
    } finally {
      setSendingEmailCode(false);
    }
  };

  const sendNewEmailCode = async () => {
    if (!emailChangeTicket) {
      setEmailChangeError("Sessao de alteracao invalida. Reabra o modal.");
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
        throw new Error(payload.error || "Nao foi possivel enviar o codigo para o novo e-mail.");
      }

      setEmailChangeTicket(payload.ticket);
      setPendingEmail(String(payload.nextEmail || nextEmail).trim().toLowerCase());
      setEmailCode("");
      setEmailStep("confirm-new-code");
      setEmailResendCooldown(60);
    } catch (err) {
      console.error("[config-account] send new email code failed:", err);
      setEmailChangeError(
        err instanceof Error ? err.message : "Erro ao enviar codigo para o novo e-mail."
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
        throw new Error(payload.error || "Nao foi possivel reenviar o codigo.");
      }

      if (payload.ticket) {
        setEmailChangeTicket(payload.ticket);
      }
      setEmailResendCooldown(60);
    } catch (err) {
      console.error("[config-account] resend email change code failed:", err);
      setEmailChangeError(err instanceof Error ? err.message : "Erro ao reenviar codigo.");
    } finally {
      setResendingEmailCode(false);
    }
  };

  const verifyEmailChangeCode = async (nextValue?: string) => {
    if (!emailChangeTicket) {
      setEmailChangeError("Sessao de alteracao invalida. Reabra o modal.");
      return;
    }
    if (sendingEmailCode || resendingEmailCode || verifyingEmailCode) return;

    const code = onlyDigits(String(nextValue || emailCode || "")).slice(0, 7);
    if (code.length !== 7) return;

    try {
      setVerifyingEmailCode(true);
      setEmailChangeError(null);

      const res = await fetch("/api/wz_users/change-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: emailChangeTicket, code }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: "set-new";
        ticket?: string;
        email?: string;
        emailChangedAt?: string | null;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        const fallback =
          res.status === 429
            ? "Voce atingiu o limite de 7 tentativas. Reenvie o codigo."
            : "Codigo invalido. Tente novamente.";
        setEmailChangeError(String(payload.error || fallback));
        setEmailCode("");
        if (res.status === 429) {
          setEmailResendCooldown(0);
        }
        return;
      }

      if (payload.next === "set-new") {
        if (!payload.ticket) {
          throw new Error("Resposta invalida do servidor.");
        }
        setEmailChangeTicket(payload.ticket);
        setEmailCode("");
        setEmailChangeError(null);
        setEmailStep("new-email-input");
        setEmailResendCooldown(0);
        return;
      }

      if (!payload.email) {
        throw new Error("Resposta invalida do servidor.");
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
      setEmailChangeError(
        err instanceof Error
          ? err.message
          : "Erro ao validar codigo de e-mail. Tente novamente."
      );
    } finally {
      setVerifyingEmailCode(false);
    }
  };

  const resetPhoneChangeFlow = useCallback(
    () => {
      setPhoneStep("confirm-current-intro");
      setPendingPhone("");
      setPhoneCode("");
      setPhoneChangeTicket("");
      setPhoneChangeError(null);
      setPhoneResendCooldown(0);
    },
    []
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
        throw new Error(payload.error || "Nao foi possivel enviar o codigo de verificacao por SMS.");
      }

      setPhoneChangeTicket(payload.ticket);
      setPhoneCode("");
      setPhoneStep("confirm-current-code");
      setPhoneResendCooldown(60);
    } catch (err) {
      console.error("[config-account] start current phone confirmation failed:", err);
      setPhoneChangeError(
        err instanceof Error ? err.message : "Erro ao iniciar confirmacao do celular atual."
      );
    } finally {
      setSendingPhoneCode(false);
    }
  };

  const sendNewPhoneCode = async () => {
    if (!phoneChangeTicket) {
      setPhoneChangeError("Sessao de alteracao invalida. Reabra o modal.");
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
        throw new Error(payload.error || "Nao foi possivel enviar o codigo para o novo celular.");
      }

      setPhoneChangeTicket(payload.ticket);
      setPendingPhone(nextPhoneE164);
      setPhoneCode("");
      setPhoneStep("confirm-new-code");
      setPhoneResendCooldown(60);
    } catch (err) {
      console.error("[config-account] send new phone code failed:", err);
      setPhoneChangeError(
        err instanceof Error ? err.message : "Erro ao enviar codigo para o novo celular."
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
        throw new Error(payload.error || "Nao foi possivel reenviar o codigo.");
      }

      if (payload.ticket) {
        setPhoneChangeTicket(payload.ticket);
      }
      setPhoneResendCooldown(60);
    } catch (err) {
      console.error("[config-account] resend phone change code failed:", err);
      setPhoneChangeError(err instanceof Error ? err.message : "Erro ao reenviar codigo.");
    } finally {
      setResendingPhoneCode(false);
    }
  };

  const verifyPhoneChangeCode = async (nextValue?: string) => {
    if (!phoneChangeTicket) {
      setPhoneChangeError("Sessao de alteracao invalida. Reabra o modal.");
      return;
    }
    if (sendingPhoneCode || resendingPhoneCode || verifyingPhoneCode) return;

    const code = onlyDigits(String(nextValue || phoneCode || "")).slice(0, 7);
    if (code.length !== 7) return;

    try {
      setVerifyingPhoneCode(true);
      setPhoneChangeError(null);

      const res = await fetch("/api/wz_users/change-phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: phoneChangeTicket, code }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: "set-new";
        ticket?: string;
        phone?: string;
        phoneChangedAt?: string | null;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        const fallback =
          res.status === 429
            ? "Voce atingiu o limite de 7 tentativas. Reenvie o codigo."
            : "Codigo invalido. Tente novamente.";
        setPhoneChangeError(String(payload.error || fallback));
        setPhoneCode("");
        if (res.status === 429) {
          setPhoneResendCooldown(0);
        }
        return;
      }

      if (payload.next === "set-new") {
        if (!payload.ticket) {
          throw new Error("Resposta invalida do servidor.");
        }
        setPhoneChangeTicket(payload.ticket);
        setPhoneCode("");
        setPhoneChangeError(null);
        setPhoneStep("new-phone-input");
        setPhoneResendCooldown(0);
        return;
      }

      const updatedPhone = normalizeE164Phone(payload.phone);
      if (!updatedPhone) {
        throw new Error("Resposta invalida do servidor.");
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
      setPhoneChangeError(
        err instanceof Error ? err.message : "Erro ao validar codigo de celular. Tente novamente."
      );
    } finally {
      setVerifyingPhoneCode(false);
    }
  };

  const initial = nickname.trim().charAt(0).toUpperCase() || "U";
  const maskedEmailValue = maskSecureEmail(localEmail);
  const maskedPhoneValue = maskSecurePhone(localPhoneE164);
  const emailChangedLabel = `Alterado ha: ${formatElapsedTimeLabel(localEmailChangedAt, relativeNowMs)}`;
  const phoneChangedLabel = `Alterado ha: ${formatElapsedTimeLabel(localPhoneChangedAt, relativeNowMs)}`;
  const buttonClass = cx(
    "rounded-xl border border-black/10 bg-white/95 px-4 py-2 text-[13px] font-semibold text-black/80",
    "transition-[transform,background-color,border-color,box-shadow] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "hover:border-black/15 hover:bg-black/[0.03] active:translate-y-[0.6px] active:scale-[0.992]"
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
          <h4 className="text-[20px] font-semibold text-black/82">Seguranca da conta</h4>
          <div className="mt-4 border-t border-black/10" />
          <div className="space-y-6 pt-5">
            <div className="flex flex-col items-start justify-between gap-3 -mx-2 rounded-xl px-2 sm:flex-row sm:gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[18px] font-semibold text-black/85">E-mail</p><span className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-black/62">{emailChangedLabel}</span></div><p className="mt-1 text-[15px] text-black/58">{maskedEmailValue}</p></div><button type="button" onClick={openEmailModal} className={cx(buttonClass, "self-start sm:self-auto")}>Alterar E-mail</button></div>
            <div className="flex flex-col items-start justify-between gap-3 -mx-2 rounded-xl px-2 sm:flex-row sm:gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[18px] font-semibold text-black/85">Numero de celular</p><span className="inline-flex items-center rounded-full border border-black/12 bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-black/62">{phoneChangedLabel}</span></div><p className="mt-1 text-[15px] text-black/58">{maskedPhoneValue}</p></div><button type="button" onClick={openPhoneModal} className={cx(buttonClass, "self-start sm:self-auto")}>Alterar celular</button></div>
            <div className="flex items-start justify-between gap-4 -mx-2 rounded-xl px-2"><div><p className="text-[18px] font-semibold text-black/85">Senha</p><p className="mt-1 text-[15px] text-black/58">Defina uma senha permanente para acessar sua conta.</p></div><button type="button" className={buttonClass}>Alterar Senha</button></div>
            <div className="flex items-start justify-between gap-4 -mx-2 rounded-xl px-2"><div><p className="text-[18px] font-semibold text-black/85">Verificacao em duas etapas</p><p className="mt-1 text-[15px] text-black/58">Adicione mais uma camada de seguranca a sua conta durante o login.</p></div><button type="button" className={buttonClass}>Adicionar um metodo de verificacao</button></div>
            <div className="flex items-start justify-between gap-4 -mx-2 rounded-xl px-2"><div><p className="text-[18px] font-semibold text-black/85">Chaves de acesso</p><p className="mt-1 text-[15px] text-black/58">Entre com seguranca com a autenticacao biometrica no dispositivo.</p></div><button type="button" className={buttonClass}>Adicionar passkey</button></div>
          </div>
        </section>

        <section className="mt-10">
          <h4 className="text-[20px] font-semibold text-black/82">Suporte</h4>
          <div className="mt-4 border-t border-black/10" />
          <div className="flex items-center justify-between gap-4 -mx-2 rounded-xl px-2 py-5">
            <div className="min-w-0"><p className="text-[18px] font-semibold text-black/85">Acesso para suporte</p><p className="mt-1 text-[15px] leading-[1.45] text-black/58">Conceda ao suporte acesso temporario para ajudar a resolver problemas ou recuperar conteudo. Voce pode revogar a qualquer momento.</p></div>
            <button type="button" role="switch" aria-checked={supportAccess} onClick={() => setSupportAccess((v) => !v)} className={cx("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-220", supportAccess ? "bg-sky-500/85" : "bg-black/20")}>
              <span className={cx("inline-block h-5 w-5 rounded-full bg-white transition-transform duration-220", supportAccess ? "translate-x-6" : "translate-x-1")} />
            </button>
          </div>

          <button type="button" className="group -mx-2 flex w-[calc(100%+16px)] items-center justify-between gap-4 rounded-xl px-2 py-5 text-left transition-[transform,background-color] duration-220 active:translate-y-[0.6px] active:scale-[0.998] cursor-pointer">
            <span className="min-w-0"><p className="text-[18px] font-semibold text-[#e3524b]">Excluir minha conta</p><p className="mt-1 text-[15px] text-black/58">Exclua permanentemente a conta e remova o acesso de todos os espacos de trabalho.</p></span>
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
                      Por seguranca, confirme primeiro o e-mail atual antes de informar o novo.
                    </p>
                    <p className="mt-4 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/72">
                      E-mail atual: <span className="font-semibold text-black/86">{maskSecureEmail(localEmail)}</span>
                    </p>
                  </>
                )}

                {emailStep === "confirm-current-code" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Digite o codigo de 7 digitos enviado para o seu e-mail atual{" "}
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
                          ? `Reenviar codigo (${emailResendCooldown}s)`
                          : resendingEmailCode
                          ? "Reenviando..."
                          : "Reenviar codigo"}
                      </button>
                    </div>
                  </>
                )}

                {emailStep === "new-email-input" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      E-mail atual confirmado. Agora informe o novo e-mail para enviar o codigo final.
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
                      Enviamos um codigo de 7 digitos para o novo e-mail{" "}
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
                          ? `Reenviar codigo (${emailResendCooldown}s)`
                          : resendingEmailCode
                          ? "Reenviando..."
                          : "Reenviar codigo"}
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
                        setEmailChangeError(null);
                        setEmailResendCooldown(0);
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
                      {sendingEmailCode ? "Enviando..." : "Enviar codigo"}
                    </button>
                  )}

                  {emailStep === "new-email-input" && (
                    <button
                      type="button"
                      onClick={sendNewEmailCode}
                      disabled={sendingEmailCode}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {sendingEmailCode ? "Enviando..." : "Enviar codigo"}
                    </button>
                  )}

                  {(emailStep === "confirm-current-code" || emailStep === "confirm-new-code") && (
                    <button
                      type="button"
                      onClick={() => verifyEmailChangeCode()}
                      disabled={verifyingEmailCode || onlyDigits(emailCode).length !== 7}
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

        {phoneModalOpen && (
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
                      Por seguranca, confirme primeiro o celular atual antes de informar o novo.
                    </p>
                    <p className="mt-4 rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-[14px] text-black/72">
                      Celular atual: <span className="font-semibold text-black/86">{maskedPhoneValue}</span>
                    </p>
                  </>
                )}

                {phoneStep === "confirm-current-code" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Digite o codigo de 7 digitos enviado por SMS para o celular atual{" "}
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
                          ? `Reenviar codigo (${phoneResendCooldown}s)`
                          : resendingPhoneCode
                          ? "Reenviando..."
                          : "Reenviar codigo"}
                      </button>
                    </div>
                  </>
                )}

                {phoneStep === "new-phone-input" && (
                  <>
                    <p className="text-[14px] leading-[1.45] text-black/62">
                      Celular atual confirmado. Agora informe o novo celular para enviar o codigo final por SMS.
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
                      Enviamos um codigo de 7 digitos por SMS para o novo celular{" "}
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
                          ? `Reenviar codigo (${phoneResendCooldown}s)`
                          : resendingPhoneCode
                          ? "Reenviando..."
                          : "Reenviar codigo"}
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
                        setPhoneChangeError(null);
                        setPhoneResendCooldown(0);
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
                      {sendingPhoneCode ? "Enviando..." : "Enviar codigo"}
                    </button>
                  )}

                  {phoneStep === "new-phone-input" && (
                    <button
                      type="button"
                      onClick={sendNewPhoneCode}
                      disabled={sendingPhoneCode}
                      className="rounded-xl bg-[#171717] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {sendingPhoneCode ? "Enviando..." : "Enviar codigo"}
                    </button>
                  )}

                  {(phoneStep === "confirm-current-code" || phoneStep === "confirm-new-code") && (
                    <button
                      type="button"
                      onClick={() => verifyPhoneChangeCode()}
                      disabled={verifyingPhoneCode || onlyDigits(phoneCode).length !== 7}
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

function DevicesContent() {
  const devices = [
    ["ANDROID - DISCORD ANDROID", "Maua, Sao Paulo, Brazil", "ha 12 horas", "mobile"],
    ["WINDOWS - CHROME", "Maua, Sao Paulo, Brazil", "ha 13 dias", "desktop"],
    ["ANDROID - ANDROID CHROME", "Sao Paulo, Sao Paulo, Brazil", "ha 23 dias", "mobile"],
    ["WINDOWS - DISCORD CLIENT", "Maua, Sao Paulo, Brazil", "ha um mes", "desktop"],
    ["WINDOWS - CHROME", "Maua, Sao Paulo, Brazil", "ha um mes", "desktop"],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[980px] pb-10 text-black/80">
      <p className="text-[15px] leading-[1.45] text-black/58">Aqui estao todos os dispositivos conectados a sua conta. Voce pode sair de cada um individualmente ou de todos os outros ao mesmo tempo.</p>
      <p className="mt-3 text-[15px] leading-[1.45] text-black/58">Se voce nao reconhecer alguma sessao ativa, saia do dispositivo e altere sua senha imediatamente.</p>

      <section className="mt-10">
        <h3 className="text-[20px] font-semibold text-black/82">Dispositivo atual</h3>
        <div className="mt-4 border-t border-black/10" />
        <div className="mt-4 flex items-center gap-4 -mx-2 rounded-xl px-2 py-2">
          <DeviceIconBadge />
          <div><p className="text-[15px] font-semibold text-black/78">WINDOWS - DISCORD CLIENT</p><p className="mt-1 text-[15px] text-black/58">Maua, Sao Paulo, Brazil</p></div>
        </div>
      </section>

      <section className="mt-10">
        <h3 className="text-[20px] font-semibold text-black/82">Outros dispositivos</h3>
        <div className="mt-4 border-t border-black/10" />
        <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white/70">
          {devices.map(([title, location, seen, kind], idx) => (
            <div key={title + seen} className={cx("flex items-center gap-4 px-4 py-5", idx > 0 && "border-t border-black/10")}>
              <DeviceIconBadge mobile={kind === "mobile"} />
              <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold text-black/78">{title}</p><p className="mt-1 truncate text-[15px] text-black/58">{location} - {seen}</p></div>
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-black/45 transition-all duration-220 hover:bg-black/[0.05] hover:text-black/75"><X className="h-5 w-5" /></button>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex justify-center">
        <button type="button" className="rounded-full bg-[#171717] px-6 py-3 text-[13px] font-semibold text-white transition-all duration-220 hover:bg-[#222222] active:translate-y-[0.6px] active:scale-[0.992]">Deslogar de todos dispositivos</button>
      </div>
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
        <p className="mt-2 text-[14px] text-black/65">Esta secao foi preparada no modal e pode receber seu conteudo especifico agora.</p>
      </div>
    </div>
  );
}

export default function ConfigMain({
  open,
  onClose,
  activeSection,
  onSectionChange,
  userNickname = "Usuario",
  userFullName,
  userEmail = "conta@wyzer.com.br",
  userPhoneE164 = null,
  userEmailChangedAt = null,
  userPhoneChangedAt = null,
  userPhotoLink = null,
  onUserPhotoChange,
  onUserEmailChange,
  onUserPhoneChange,
}: ConfigMainProps) {
  const prefersReducedMotion = useReducedMotion();
  const [searchTerm, setSearchTerm] = useState("");

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
    () => String(userFullName || "").trim() || String(userNickname || "").trim() || "usuario",
    [userFullName, userNickname]
  );
  const email = useMemo(() => String(userEmail || "").trim().toLowerCase() || "conta@wyzer.com.br", [userEmail]);
  const phone = useMemo(() => normalizeE164Phone(userPhoneE164), [userPhoneE164]);
  const emailChangedAt = useMemo(() => normalizeIsoDatetime(userEmailChangedAt), [userEmailChangedAt]);
  const phoneChangedAt = useMemo(() => normalizeIsoDatetime(userPhoneChangedAt), [userPhoneChangedAt]);

  const normalizedSearch = useMemo(() => normalizeForSearch(searchTerm), [searchTerm]);
  const filtered = useMemo(() => (!normalizedSearch ? menuItems : menuItems.filter((i) => normalizeForSearch(i.label).includes(normalizedSearch))), [normalizedSearch]);
  const userItems = useMemo(() => filtered.filter((i) => i.group === "user"), [filtered]);
  const billingItems = useMemo(() => filtered.filter((i) => i.group === "billing"), [filtered]);
  const appItems = useMemo(() => filtered.filter((i) => i.group === "app"), [filtered]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const activeTitle = sectionTitles[activeSection];

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[190] flex items-center justify-center p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.button type="button" aria-label="Fechar configuracoes" className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" onClick={onClose} />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Configuracoes da conta"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={prefersReducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 320, damping: 32, mass: 0.72 }}
            className="relative z-[1] h-[min(88vh,910px)] w-[min(95vw,1410px)] overflow-hidden rounded-2xl border border-black/15 bg-[#f3f3f4] shadow-[0_30px_80px_rgba(0,0,0,0.44)]"
          >
            <div className="flex h-full min-h-0">
              <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-black/10 bg-[#ececef]">
                <div className="px-4 pb-3"><div className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-black/14 bg-[#e7e7e8] px-3"><Search className="h-[16px] w-[16px] text-black/45" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar" className="h-full w-full bg-transparent text-[14px] text-black/70 outline-none placeholder:text-black/45" /></div></div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
                  <LayoutGroup id="config-sidebar-active-pills">
                    <SidebarGroup title="Configuracoes de usuario" items={userItems} activeSection={activeSection} onSectionChange={onSectionChange} tapFeedback={tapFeedback} tapTransition={tapTransition} activePillTransition={activePillTransition} />
                    {billingItems.length > 0 && <div className="mt-4"><SidebarGroup title="Configuracoes de cobranca" items={billingItems} activeSection={activeSection} onSectionChange={onSectionChange} tapFeedback={tapFeedback} tapTransition={tapTransition} activePillTransition={activePillTransition} /></div>}
                    {appItems.length > 0 && <div className="mt-4"><SidebarGroup title="Config. do aplicativo" items={appItems} activeSection={activeSection} onSectionChange={onSectionChange} tapFeedback={tapFeedback} tapTransition={tapTransition} activePillTransition={activePillTransition} /></div>}
                    {normalizedSearch && filtered.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-black/18 bg-white/50 px-3 py-3 text-[13px] text-black/55">Nenhum item encontrado.</div>}
                  </LayoutGroup>
                </div>
              </aside>

              <div className="min-w-0 flex-1 bg-[#f3f3f4]">
                <div className="flex h-16 items-center justify-between border-b border-black/10 px-4 sm:px-6"><h2 className="text-[20px] font-semibold text-black/75">{activeTitle}</h2><button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/80"><X className="h-5 w-5" /></button></div>
                <div className="h-[calc(100%-64px)] overflow-y-auto px-4 pb-8 pt-6 sm:px-8 md:px-10">
                  {activeSection === "my-account" && <AccountContent nickname={nickname} email={email} phoneE164={phone} emailChangedAt={emailChangedAt} phoneChangedAt={phoneChangedAt} userPhotoLink={userPhotoLink} onUserPhotoChange={onUserPhotoChange} onUserEmailChange={onUserEmailChange} onUserPhoneChange={onUserPhoneChange} />}
                  {activeSection === "devices" && <DevicesContent />}
                  {activeSection !== "my-account" && activeSection !== "devices" && <PlaceholderSection title={activeTitle} />}
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
