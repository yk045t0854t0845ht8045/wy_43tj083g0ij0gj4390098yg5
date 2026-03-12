import fs from "fs/promises";
import os from "os";
import path from "path";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type ConnectionState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { handleInboundWhatsAppMessage } from "@/whatsapp-sistema/engine";
import { buildWhatsAppInstanceName } from "@/whatsapp-sistema/instance-name";

export type LocalWhatsAppState =
  | "idle"
  | "starting"
  | "connecting"
  | "qr"
  | "open"
  | "close"
  | "logged_out"
  | "error";

export type LocalWhatsAppSnapshot = {
  instanceName: string;
  state: LocalWhatsAppState;
  qr: string | null;
  pairingCode: string | null;
  updatedAt: string;
  lastError: string | null;
};

type LocalWhatsAppInstance = {
  instanceName: string;
  authDir: string;
  socket: WASocket | null;
  socketGeneration: number;
  state: LocalWhatsAppState;
  qr: string | null;
  pairingCode: string | null;
  updatedAt: string;
  lastError: string | null;
  connectPromise: Promise<void> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  waiters: Set<(snapshot: LocalWhatsAppSnapshot) => void>;
};

type EnsureLocalInstanceResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

type EnsureOwnWhatsAppInstanceOptions = {
  forceRestart?: boolean;
};

declare global {
  var __wzLocalWhatsAppInstances: Map<string, LocalWhatsAppInstance> | undefined;
  var __wzLocalWhatsAppBootstrapPromise: Promise<void> | undefined;
  var __wzLocalWhatsAppBootstrapAt: number | undefined;
}

const RECONNECT_DELAY_MS = 1800;
const WAIT_QR_TIMEOUT_MS = 14000;
const BOOTSTRAP_RESCAN_MS = 1000 * 45;
const DISABLED_VALUES = new Set(["0", "false", "off", "no", "disabled"]);
const WRITABLE_FS_ERROR_CODES = new Set(["ENOENT", "EACCES", "EPERM", "EROFS"]);

const localInstances =
  globalThis.__wzLocalWhatsAppInstances || (globalThis.__wzLocalWhatsAppInstances = new Map());

function isMissingPathError(error: unknown) {
  const code = String((error as { code?: unknown } | null)?.code || "").trim().toUpperCase();
  return code === "ENOENT";
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeError(error: unknown, fallback: string) {
  const message = String((error as { message?: unknown } | null)?.message || "").trim();
  return message || fallback;
}

function resolveBooleanEnv(value: string | undefined, fallback: boolean) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return fallback;
  if (DISABLED_VALUES.has(clean)) return false;
  return true;
}

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.K_SERVICE,
  );
}

function resolveDefaultAuthRootDir() {
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), "wz-whatsapp-auth");
  }
  return path.join(process.cwd(), ".wz-whatsapp-auth");
}

function resolveAuthRootDir() {
  const configured = String(process.env.WHATSAPP_AUTH_DIR || "").trim();
  if (!configured) {
    return resolveDefaultAuthRootDir();
  }
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function buildAuthDir(instanceName: string) {
  return path.join(resolveAuthRootDir(), instanceName);
}

function toSnapshot(instance: LocalWhatsAppInstance): LocalWhatsAppSnapshot {
  return {
    instanceName: instance.instanceName,
    state: instance.state,
    qr: instance.qr,
    pairingCode: instance.pairingCode,
    updatedAt: instance.updatedAt,
    lastError: instance.lastError,
  };
}

function notifyWaiters(instance: LocalWhatsAppInstance) {
  const snapshot = toSnapshot(instance);
  for (const waiter of instance.waiters) {
    waiter(snapshot);
  }
}

function setInstanceState(
  instance: LocalWhatsAppInstance,
  state: LocalWhatsAppState,
  patch?: {
    qr?: string | null;
    pairingCode?: string | null;
    lastError?: string | null;
  },
) {
  instance.state = state;
  instance.updatedAt = nowIso();
  if (patch && "qr" in patch) instance.qr = patch.qr ?? null;
  if (patch && "pairingCode" in patch) instance.pairingCode = patch.pairingCode ?? null;
  if (patch && "lastError" in patch) instance.lastError = patch.lastError ?? null;
  notifyWaiters(instance);
}

function readDisconnectStatusCode(update: Partial<ConnectionState>) {
  const maybeError = (update.lastDisconnect as { error?: unknown } | undefined)?.error as
    | {
        output?: { statusCode?: unknown };
        data?: { statusCode?: unknown };
        statusCode?: unknown;
      }
    | undefined;

  const status =
    maybeError?.output?.statusCode ?? maybeError?.data?.statusCode ?? maybeError?.statusCode ?? null;
  return typeof status === "number" ? status : Number(status || 0);
}

async function ensureAuthDirectory(instance: LocalWhatsAppInstance) {
  try {
    await fs.mkdir(instance.authDir, { recursive: true });
  } catch (error) {
    const code = String((error as { code?: unknown } | null)?.code || "").trim().toUpperCase();
    if (!WRITABLE_FS_ERROR_CODES.has(code)) {
      throw error;
    }

    const fallbackDir = path.join(os.tmpdir(), "wz-whatsapp-auth", instance.instanceName);
    if (instance.authDir !== fallbackDir) {
      instance.authDir = fallbackDir;
      await fs.mkdir(instance.authDir, { recursive: true });
      return;
    }

    throw error;
  }
}

async function resetAuthDirectory(instance: LocalWhatsAppInstance) {
  try {
    await fs.rm(instance.authDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup error.
  }
  await ensureAuthDirectory(instance);
}

function getOrCreateInstance(instanceName: string) {
  const existing = localInstances.get(instanceName);
  if (existing) return existing;

  const created: LocalWhatsAppInstance = {
    instanceName,
    authDir: buildAuthDir(instanceName),
    socket: null,
    socketGeneration: 0,
    state: "idle",
    qr: null,
    pairingCode: null,
    updatedAt: nowIso(),
    lastError: null,
    connectPromise: null,
    reconnectTimer: null,
    waiters: new Set(),
  };
  localInstances.set(instanceName, created);
  return created;
}

function clearReconnectTimer(instance: LocalWhatsAppInstance) {
  if (!instance.reconnectTimer) return;
  clearTimeout(instance.reconnectTimer);
  instance.reconnectTimer = null;
}

function scheduleReconnect(instance: LocalWhatsAppInstance) {
  if (instance.reconnectTimer || instance.connectPromise) return;
  instance.reconnectTimer = setTimeout(() => {
    instance.reconnectTimer = null;
    void startInstance(instance);
  }, RECONNECT_DELAY_MS);
}

function safeCloseSocket(instance: LocalWhatsAppInstance) {
  instance.socketGeneration += 1;
  const current = instance.socket as { end?: (error?: Error) => void } | null;
  if (!current) return;
  try {
    current.end?.(new Error("Socket restart requested."));
  } catch {
    // Ignore manual close failure.
  } finally {
    instance.socket = null;
  }
}

async function waitForSnapshot(
  instance: LocalWhatsAppInstance,
  predicate: (snapshot: LocalWhatsAppSnapshot) => boolean,
  timeoutMs: number,
) {
  const first = toSnapshot(instance);
  if (predicate(first)) return first;

  return await new Promise<LocalWhatsAppSnapshot>((resolve) => {
    const onUpdate = (snapshot: LocalWhatsAppSnapshot) => {
      if (!predicate(snapshot)) return;
      cleanup();
      resolve(snapshot);
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(toSnapshot(instance));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      instance.waiters.delete(onUpdate);
    };

    instance.waiters.add(onUpdate);
  });
}

function unwrapMessageContent(message: unknown): Record<string, unknown> | null {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const record = message as Record<string, unknown>;
  const nestedKeys = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
  ];

  for (const key of nestedKeys) {
    const nested = record[key];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const nestedMessage = (nested as Record<string, unknown>).message;
    const unwrapped = unwrapMessageContent(nestedMessage);
    if (unwrapped) return unwrapped;
  }

  return record;
}

function extractInboundText(message: unknown) {
  const content = unwrapMessageContent(message);
  if (!content) return "";

  const direct =
    String(content.conversation || "").trim() ||
    String((content.extendedTextMessage as { text?: unknown } | undefined)?.text || "").trim() ||
    String((content.imageMessage as { caption?: unknown } | undefined)?.caption || "").trim() ||
    String((content.videoMessage as { caption?: unknown } | undefined)?.caption || "").trim() ||
    String((content.documentMessage as { caption?: unknown } | undefined)?.caption || "").trim();

  return direct;
}

async function ensurePersistedInstancesBootstrapped() {
  if (!isOwnWhatsAppProviderConfigured()) return;

  const lastBootstrapAt = Number(globalThis.__wzLocalWhatsAppBootstrapAt || 0);
  if (lastBootstrapAt && Date.now() - lastBootstrapAt < BOOTSTRAP_RESCAN_MS) {
    const existing = globalThis.__wzLocalWhatsAppBootstrapPromise;
    if (existing) {
      await existing.catch(() => undefined);
    }
    return;
  }

  if (globalThis.__wzLocalWhatsAppBootstrapPromise) {
    await globalThis.__wzLocalWhatsAppBootstrapPromise.catch(() => undefined);
    return;
  }

  const bootstrapRun = (async () => {
    try {
      const authRootDir = resolveAuthRootDir();
      await fs.mkdir(authRootDir, { recursive: true });
      const entries = await fs.readdir(authRootDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const instanceName = String(entry.name || "").trim();
        if (!instanceName) continue;

        const instance = getOrCreateInstance(instanceName);
        if (instance.socket || instance.connectPromise) continue;
        void startInstance(instance).catch((error) => {
          console.error(
            `[whatsapp-sistema] failed to bootstrap instance "${instanceName}":`,
            error,
          );
        });
      }
    } catch (error) {
      if (!isMissingPathError(error)) {
        console.error("[whatsapp-sistema] failed to bootstrap persisted instances:", error);
      }
    } finally {
      globalThis.__wzLocalWhatsAppBootstrapAt = Date.now();
      if (globalThis.__wzLocalWhatsAppBootstrapPromise === bootstrapRun) {
        globalThis.__wzLocalWhatsAppBootstrapPromise = undefined;
      }
    }
  })();

  globalThis.__wzLocalWhatsAppBootstrapPromise = bootstrapRun;
  await bootstrapRun;
}

async function startInstance(instance: LocalWhatsAppInstance) {
  if (instance.connectPromise) {
    await instance.connectPromise;
    return;
  }

  clearReconnectTimer(instance);
  const socketGeneration = instance.socketGeneration + 1;
  instance.socketGeneration = socketGeneration;
  const connectRun = (async () => {
    await ensureAuthDirectory(instance);
    if (instance.socketGeneration !== socketGeneration) return;

    setInstanceState(instance, "starting", { lastError: null });

    const { state, saveCreds } = await useMultiFileAuthState(instance.authDir);
    if (instance.socketGeneration !== socketGeneration) return;

    const latestVersion = await fetchLatestBaileysVersion().catch(() => null);
    if (instance.socketGeneration !== socketGeneration) return;

    const socket = makeWASocket({
      auth: state,
      version: latestVersion?.version,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Wyzer"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs: 30000,
      logger: pino({ level: "error" }),
    });

    if (instance.socketGeneration !== socketGeneration) {
      try {
        (socket as { end?: (error?: Error) => void }).end?.(new Error("Ignoring stale WhatsApp socket."));
      } catch {
        // Ignore stale close failure.
      }
      return;
    }

    instance.socket = socket;
    socket.ev.on("creds.update", () => {
      if (instance.socketGeneration !== socketGeneration) return;
      void saveCreds();
    });
    socket.ev.on("messages.upsert", (payload) => {
      if (instance.socketGeneration !== socketGeneration) return;
      if (String((payload as { type?: unknown } | null)?.type || "").trim().toLowerCase() !== "notify") {
        return;
      }

      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      for (const inbound of messages) {
        const key = inbound?.key as
          | {
              id?: string | null;
              remoteJid?: string | null;
              fromMe?: boolean | null;
            }
          | undefined;

        if (!key || key.fromMe) continue;

        const messageId = String(key.id || "").trim();
        const remoteJid = String(key.remoteJid || "").trim();
        const text = extractInboundText((inbound as { message?: unknown } | null)?.message);
        if (!messageId || !remoteJid || !text) continue;

        const pushName = String((inbound as { pushName?: unknown } | null)?.pushName || "").trim() || null;
        void handleInboundWhatsAppMessage({
          instanceName: instance.instanceName,
          messageId,
          remoteJid,
          text,
          pushName,
          receivedAt: nowIso(),
          sendText: async (targetJid, outboundText) => {
            if (instance.socketGeneration !== socketGeneration || !instance.socket) {
              return {
                ok: false,
                error: "Socket do WhatsApp indisponivel para envio.",
              };
            }

            try {
              await instance.socket.sendMessage(targetJid, { text: outboundText });
              return { ok: true };
            } catch (error) {
              return {
                ok: false,
                error: normalizeError(error, "Nao foi possivel enviar mensagem automatica."),
              };
            }
          },
        }).catch((error) => {
          console.error("[whatsapp-sistema] failed to process inbound message:", error);
        });
      }
    });
    socket.ev.on("connection.update", (update) => {
      if (instance.socketGeneration !== socketGeneration) return;

      if (update.qr) {
        setInstanceState(instance, "qr", {
          qr: update.qr,
          pairingCode: null,
          lastError: null,
        });
      }

      if (update.connection === "connecting") {
        if (!instance.qr) {
          setInstanceState(instance, "connecting", {
            lastError: null,
          });
        }
      }

      if (update.connection === "open") {
        setInstanceState(instance, "open", {
          qr: null,
          pairingCode: null,
          lastError: null,
        });
      }

      if (update.connection === "close") {
        instance.socket = null;
        const statusCode = readDisconnectStatusCode(update);
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          setInstanceState(instance, "logged_out", {
            qr: null,
            pairingCode: null,
            lastError: "Sessao desconectada no WhatsApp. Escaneie novamente o QR Code.",
          });
          void resetAuthDirectory(instance).finally(() => {
            scheduleReconnect(instance);
          });
          return;
        }

        setInstanceState(instance, "close", {
          qr: null,
          pairingCode: null,
          lastError: null,
        });
        scheduleReconnect(instance);
      }
    });
  })();
  instance.connectPromise = connectRun;

  try {
    await connectRun;
  } catch (error) {
    if (instance.socketGeneration === socketGeneration) {
      instance.socket = null;
      setInstanceState(instance, "error", {
        qr: null,
        pairingCode: null,
        lastError: normalizeError(error, "Falha ao iniciar sessao WhatsApp."),
      });
      scheduleReconnect(instance);
    }
    throw error;
  } finally {
    if (instance.connectPromise === connectRun) {
      instance.connectPromise = null;
    }
  }
}

export function isOwnWhatsAppProviderConfigured() {
  return resolveBooleanEnv(process.env.WHATSAPP_SELF_HOSTED_ENABLED, true);
}

export async function ensurePersistedWhatsAppInstancesBootstrapped() {
  await ensurePersistedInstancesBootstrapped();
}

export function buildOwnWhatsAppInstanceName(userId: string, scopeId?: string | null) {
  return buildWhatsAppInstanceName(userId, scopeId);
}

export async function ensureOwnWhatsAppInstance(
  instanceName: string,
  options: EnsureOwnWhatsAppInstanceOptions = {},
): Promise<EnsureLocalInstanceResult> {
  if (!isOwnWhatsAppProviderConfigured()) {
    return {
      ok: false,
      error: "Provider proprio de WhatsApp desativado no ambiente.",
    };
  }

  await ensurePersistedInstancesBootstrapped();

  const instance = getOrCreateInstance(instanceName);
  try {
    if (options.forceRestart) {
      clearReconnectTimer(instance);
      safeCloseSocket(instance);
      setInstanceState(instance, "idle", {
        qr: null,
        pairingCode: null,
        lastError: null,
      });
      instance.connectPromise = null;
    }

    if (!instance.socket && !instance.connectPromise) {
      await startInstance(instance);
    }

    const snapshot = toSnapshot(instance);
    if (snapshot.state === "error" || snapshot.state === "logged_out") {
      return {
        ok: false,
        error: snapshot.lastError || "Falha ao iniciar sessao do WhatsApp.",
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: normalizeError(error, "Nao foi possivel iniciar sessao do WhatsApp."),
    };
  }
}

export function getOwnWhatsAppSnapshot(instanceName: string) {
  const instance = getOrCreateInstance(instanceName);
  return toSnapshot(instance);
}

export async function waitForOwnWhatsAppQr(instanceName: string, timeoutMs = WAIT_QR_TIMEOUT_MS) {
  const instance = getOrCreateInstance(instanceName);
  return await waitForSnapshot(
    instance,
    (snapshot) =>
      Boolean(snapshot.qr) ||
      snapshot.state === "open" ||
      snapshot.state === "close" ||
      snapshot.state === "logged_out" ||
      snapshot.state === "error",
    timeoutMs,
  );
}
