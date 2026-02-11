"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Accessibility,
  AppWindow,
  Bell,
  ChevronRight,
  CreditCard,
  Mic,
  Monitor,
  Palette,
  Search,
  Shield,
  Smartphone,
  UserRound,
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
  icon: React.ComponentType<{ className?: string }>;
  group: ConfigSectionGroupId;
};

type ConfigMainProps = {
  open: boolean;
  onClose: () => void;
  activeSection: ConfigSectionId;
  onSectionChange: (section: ConfigSectionId) => void;
  userNickname?: string;
  userEmail?: string;
  userPhotoLink?: string | null;
  onUserPhotoChange?: (photoLink: string | null) => void;
};

const menuItems: MenuItem[] = [
  { id: "my-account", label: "Minha conta", icon: UserRound, group: "user" },
  { id: "privacy-data", label: "Dados e privacidade", icon: Shield, group: "user" },
  { id: "authorized-apps", label: "Aplicativos autorizados", icon: AppWindow, group: "user" },
  { id: "devices", label: "Dispositivos", icon: Smartphone, group: "user" },
  { id: "notifications", label: "Notificacoes", icon: Bell, group: "user" },
  { id: "subscriptions", label: "Assinaturas", icon: CreditCard, group: "billing" },
  { id: "billing", label: "Cobranca", icon: CreditCard, group: "billing" },
  { id: "appearance", label: "Aparencia", icon: Palette, group: "app" },
  { id: "accessibility", label: "Acessibilidade", icon: Accessibility, group: "app" },
  { id: "voice-video", label: "Voz", icon: Mic, group: "app" },
];

const sectionTitles: Record<ConfigSectionId, string> = {
  "my-account": "Conta",
  "content-social": "Conteudo e social",
  "privacy-data": "Dados e privacidade",
  "family-center": "Central da Familia",
  "authorized-apps": "Aplicativos autorizados",
  devices: "Dispositivos",
  connections: "Conexoes",
  notifications: "Notificacoes",
  clips: "Clipes",
  nitro: "Nitro",
  "server-boost": "Impulso de servidor",
  subscriptions: "Assinaturas",
  "gift-inventory": "Inventario de presentes",
  billing: "Cobranca",
  appearance: "Aparencia",
  accessibility: "Acessibilidade",
  "voice-video": "Voz",
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

function AccountContent({
  nickname,
  email,
  userPhotoLink,
  onUserPhotoChange,
}: {
  nickname: string;
  email: string;
  userPhotoLink?: string | null;
  onUserPhotoChange?: (photoLink: string | null) => void;
}) {
  const [supportAccess, setSupportAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPhoto, setLocalPhoto] = useState<string | null>(normalizePhotoLink(userPhotoLink));
  const [editorOpen, setEditorOpen] = useState(false);
  const [source, setSource] = useState("");
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => setLocalPhoto(normalizePhotoLink(userPhotoLink)), [userPhotoLink]);

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

  const initial = nickname.trim().charAt(0).toUpperCase() || "U";
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
              {nickname} Account
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
            <div className="flex items-start justify-between gap-4 -mx-2 rounded-xl px-2"><div><p className="text-[18px] font-semibold text-black/85">E-mail</p><p className="mt-1 text-[15px] text-black/58">{email}</p></div><button type="button" className={buttonClass}>Alterar E-mail</button></div>
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
          const Icon = item.icon;
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
                <span className="relative z-[1] flex min-w-0 items-center gap-2.5"><Icon className="h-[18px] w-[18px]" /><span className="truncate">{item.label}</span></span>
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
  userEmail = "conta@wyzer.com.br",
  userPhotoLink = null,
  onUserPhotoChange,
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

  const nickname = useMemo(() => String(userNickname || "").trim() || "usuario", [userNickname]);
  const email = useMemo(() => String(userEmail || "").trim().toLowerCase() || "conta@wyzer.com.br", [userEmail]);

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
                  {activeSection === "my-account" && <AccountContent nickname={nickname} email={email} userPhotoLink={userPhotoLink} onUserPhotoChange={onUserPhotoChange} />}
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
