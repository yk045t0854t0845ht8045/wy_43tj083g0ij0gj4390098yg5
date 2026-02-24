import fs from "fs/promises";
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
}

const RECONNECT_DELAY_MS = 1800;
const WAIT_QR_TIMEOUT_MS = 14000;
const DISABLED_VALUES = new Set(["0", "false", "off", "no", "disabled"]);

const localInstances =
  globalThis.__wzLocalWhatsAppInstances || (globalThis.__wzLocalWhatsAppInstances = new Map());

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

function resolveLocalInstancePrefix() {
  const configured = String(process.env.WHATSAPP_INSTANCE_PREFIX || "wyzer").trim().toLowerCase();
  const sanitized = configured.replace(/[^a-z0-9-_]/g, "");
  return sanitized || "wyzer";
}

function resolveAuthRootDir() {
  const configured = String(process.env.WHATSAPP_AUTH_DIR || "").trim();
  if (!configured) {
    return path.join(process.cwd(), ".wz-whatsapp-auth");
  }
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function buildAuthDir(instanceName: string) {
  return path.join(resolveAuthRootDir(), instanceName);
}

function sanitizeInstanceToken(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  await fs.mkdir(instance.authDir, { recursive: true });
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

async function startInstance(instance: LocalWhatsAppInstance) {
  if (instance.connectPromise) {
    await instance.connectPromise;
    return;
  }

  clearReconnectTimer(instance);
  instance.connectPromise = (async () => {
    await ensureAuthDirectory(instance);
    setInstanceState(instance, "starting", { lastError: null });

    const { state, saveCreds } = await useMultiFileAuthState(instance.authDir);
    const latestVersion = await fetchLatestBaileysVersion().catch(() => null);

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

    instance.socket = socket;
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (update) => {
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

  try {
    await instance.connectPromise;
  } catch (error) {
    instance.socket = null;
    setInstanceState(instance, "error", {
      qr: null,
      pairingCode: null,
      lastError: normalizeError(error, "Falha ao iniciar sessao WhatsApp."),
    });
    scheduleReconnect(instance);
    throw error;
  } finally {
    instance.connectPromise = null;
  }
}

export function isOwnWhatsAppProviderConfigured() {
  return resolveBooleanEnv(process.env.WHATSAPP_SELF_HOSTED_ENABLED, true);
}

export function buildOwnWhatsAppInstanceName(userId: string) {
  const prefix = resolveLocalInstancePrefix();
  const userToken = sanitizeInstanceToken(userId) || "unknown";
  return `${prefix}-${userToken}`.slice(0, 64);
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
      snapshot.state === "logged_out" ||
      snapshot.state === "error",
    timeoutMs,
  );
}
