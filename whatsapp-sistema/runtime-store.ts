import fs from "fs/promises";
import path from "path";
import type { ContactRuntimeState, InstanceRuntimeState } from "./types";

declare global {
  var __wzWhatsAppRuntimeCache: Map<string, InstanceRuntimeState> | undefined;
  var __wzWhatsAppRuntimeWrites: Map<string, Promise<void>> | undefined;
}

const runtimeCache =
  globalThis.__wzWhatsAppRuntimeCache ||
  (globalThis.__wzWhatsAppRuntimeCache = new Map<string, InstanceRuntimeState>());
const runtimeWrites =
  globalThis.__wzWhatsAppRuntimeWrites ||
  (globalThis.__wzWhatsAppRuntimeWrites = new Map<string, Promise<void>>());

const RUNTIME_DATA_DIR = path.join(process.cwd(), "whatsapp-sistema", "runtime-data");
const PROCESSED_MESSAGE_TTL_MS = 1000 * 60 * 60 * 72;
const PROCESSED_MESSAGE_LIMIT = 600;

function nowIso() {
  return new Date().toISOString();
}

function sanitizeFileToken(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function runtimeFilePath(instanceName: string) {
  const token = sanitizeFileToken(instanceName) || "default";
  return path.join(RUNTIME_DATA_DIR, `${token}.json`);
}

function createEmptyRuntimeState(): InstanceRuntimeState {
  return {
    contacts: {},
    processedMessageIds: {},
    updatedAt: nowIso(),
  };
}

function parseIsoMs(value?: string | null) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cloneContactState(state: ContactRuntimeState | null) {
  if (!state) return null;
  return {
    ...state,
  };
}

function normalizeContactState(contactKey: string, value: unknown): ContactRuntimeState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    contactKey: String(row.contactKey || contactKey).trim() || contactKey,
    remoteJid: String(row.remoteJid || "").trim(),
    displayName: String(row.displayName || "").trim() || null,
    collectedName: String(row.collectedName || "").trim() || null,
    collectedEmail: String(row.collectedEmail || "").trim() || null,
    collectedPhone: String(row.collectedPhone || "").trim() || null,
    pendingField:
      row.pendingField === "name" || row.pendingField === "email" || row.pendingField === "phone"
        ? row.pendingField
        : null,
    lastInboundText: String(row.lastInboundText || "").trim() || null,
    lastInboundAt: String(row.lastInboundAt || "").trim() || null,
    lastAutoReplyAt: String(row.lastAutoReplyAt || "").trim() || null,
    lastAutoReplyKind: String(row.lastAutoReplyKind || "").trim() || null,
    lastCompletedAt: String(row.lastCompletedAt || "").trim() || null,
    updatedAt: String(row.updatedAt || "").trim() || nowIso(),
  };
}

function normalizeRuntimeState(value: unknown): InstanceRuntimeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyRuntimeState();
  }

  const row = value as Record<string, unknown>;
  const contactsRecord =
    row.contacts && typeof row.contacts === "object" && !Array.isArray(row.contacts)
      ? (row.contacts as Record<string, unknown>)
      : {};
  const processedRecord =
    row.processedMessageIds &&
    typeof row.processedMessageIds === "object" &&
    !Array.isArray(row.processedMessageIds)
      ? (row.processedMessageIds as Record<string, unknown>)
      : {};

  const contacts: Record<string, ContactRuntimeState> = {};
  for (const [contactKey, contactValue] of Object.entries(contactsRecord)) {
    const normalized = normalizeContactState(contactKey, contactValue);
    if (!normalized) continue;
    contacts[contactKey] = normalized;
  }

  const processedMessageIds: Record<string, string> = {};
  for (const [messageId, processedAt] of Object.entries(processedRecord)) {
    const normalizedAt = String(processedAt || "").trim();
    if (!normalizedAt) continue;
    processedMessageIds[messageId] = normalizedAt;
  }

  const normalized: InstanceRuntimeState = {
    contacts,
    processedMessageIds,
    updatedAt: String(row.updatedAt || "").trim() || nowIso(),
  };
  pruneRuntimeState(normalized);
  return normalized;
}

function pruneRuntimeState(state: InstanceRuntimeState) {
  const cutoffMs = Date.now() - PROCESSED_MESSAGE_TTL_MS;
  const processedEntries = Object.entries(state.processedMessageIds || {})
    .filter(([, processedAt]) => parseIsoMs(processedAt) >= cutoffMs)
    .sort((a, b) => parseIsoMs(b[1]) - parseIsoMs(a[1]))
    .slice(0, PROCESSED_MESSAGE_LIMIT);

  state.processedMessageIds = Object.fromEntries(processedEntries);
  state.updatedAt = nowIso();
}

async function ensureRuntimeDataDir() {
  await fs.mkdir(RUNTIME_DATA_DIR, { recursive: true });
}

async function loadRuntimeState(instanceName: string) {
  const clean = String(instanceName || "").trim();
  if (!clean) return createEmptyRuntimeState();

  const cached = runtimeCache.get(clean);
  if (cached) return cached;

  await ensureRuntimeDataDir();

  try {
    const raw = await fs.readFile(runtimeFilePath(clean), "utf8");
    const parsed = normalizeRuntimeState(JSON.parse(raw));
    runtimeCache.set(clean, parsed);
    return parsed;
  } catch (error) {
    const code = String((error as { code?: unknown } | null)?.code || "").trim().toUpperCase();
    if (code !== "ENOENT") {
      console.error("[whatsapp-sistema] failed to read runtime state:", error);
    }
    const fallback = createEmptyRuntimeState();
    runtimeCache.set(clean, fallback);
    return fallback;
  }
}

async function persistRuntimeState(instanceName: string, state: InstanceRuntimeState) {
  const clean = String(instanceName || "").trim();
  if (!clean) return;

  await ensureRuntimeDataDir();
  await fs.writeFile(runtimeFilePath(clean), JSON.stringify(state, null, 2), "utf8");
}

async function queueStateMutation<T>(
  instanceName: string,
  mutate: (state: InstanceRuntimeState) => T | Promise<T>,
) {
  const clean = String(instanceName || "").trim();
  if (!clean) {
    return await mutate(createEmptyRuntimeState());
  }

  const previous = runtimeWrites.get(clean) || Promise.resolve();
  let result!: T;

  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const state = await loadRuntimeState(clean);
      result = await mutate(state);
      pruneRuntimeState(state);
      runtimeCache.set(clean, state);
      await persistRuntimeState(clean, state);
    });

  runtimeWrites.set(
    clean,
    next.catch((error) => {
      console.error("[whatsapp-sistema] failed to persist runtime mutation:", error);
    }),
  );

  await next;
  return result;
}

export async function hasProcessedMessage(instanceName: string, messageId: string) {
  const cleanMessageId = String(messageId || "").trim();
  if (!cleanMessageId) return false;
  const state = await loadRuntimeState(instanceName);
  pruneRuntimeState(state);
  return Boolean(state.processedMessageIds[cleanMessageId]);
}

export async function markProcessedMessage(
  instanceName: string,
  messageId: string,
  processedAt = nowIso(),
) {
  const cleanMessageId = String(messageId || "").trim();
  if (!cleanMessageId) return;

  await queueStateMutation(instanceName, async (state) => {
    state.processedMessageIds[cleanMessageId] = processedAt;
  });
}

export async function readContactState(instanceName: string, contactKey: string) {
  const cleanContactKey = String(contactKey || "").trim();
  if (!cleanContactKey) return null;
  const state = await loadRuntimeState(instanceName);
  return cloneContactState(state.contacts[cleanContactKey] || null);
}

export async function writeContactState(
  instanceName: string,
  contactKey: string,
  contactState: ContactRuntimeState,
) {
  const cleanContactKey = String(contactKey || "").trim();
  if (!cleanContactKey) return null;

  return await queueStateMutation(instanceName, async (state) => {
    const next = {
      ...contactState,
      contactKey: cleanContactKey,
      updatedAt: nowIso(),
    };
    state.contacts[cleanContactKey] = next;
    return cloneContactState(next);
  });
}
