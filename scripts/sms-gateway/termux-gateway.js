#!/usr/bin/env node
/*
  Self-hosted SMS gateway for Android Termux.
  Requirements (no paid API / no external account):
  - Termux app installed on Android with your own SIM
  - Termux:API app installed
  - In Termux: pkg install nodejs termux-api
  - Run: node termux-gateway.js
*/

const http = require("http");
const { execFile } = require("child_process");
const crypto = require("crypto");

const PORT = Number(process.env.SMS_GATEWAY_PORT || 8787);
const TOKEN = String(process.env.SMS_WEBHOOK_TOKEN || "").trim();
const SIGNING_SECRET = String(process.env.SMS_WEBHOOK_SIGNING_SECRET || "").trim();
const GATEWAY_NUMBER = String(process.env.SMS_OWN_NUMBER || "").trim();
const ALLOW_SELF_SEND = ["1", "true", "yes", "on"].includes(
  String(process.env.SMS_GATEWAY_ALLOW_SELF_SEND || "").trim().toLowerCase(),
);
const SMS_SEND_TIMEOUT_MS = Number(process.env.SMS_GATEWAY_SEND_TIMEOUT_MS || 15000);
const ACK_MODE = String(process.env.SMS_GATEWAY_ACK_MODE || "accepted").trim().toLowerCase();
const MAX_BODY_BYTES = 128 * 1024;
const MAX_RECENT_DISPATCHES = Number(process.env.SMS_GATEWAY_MAX_RECENT || 40);
const INTERNAL_API_KEY = String(process.env.SMS_INTERNAL_API_KEY || "").trim();
const QUEUE_PULL_URL = String(process.env.SMS_QUEUE_PULL_URL || "").trim();
const QUEUE_ACK_URL = String(process.env.SMS_QUEUE_ACK_URL || "").trim();
const QUEUE_POLL_INTERVAL_MS = Number(process.env.SMS_QUEUE_POLL_INTERVAL_MS || 800);
const QUEUE_PULL_LIMIT = Number(process.env.SMS_QUEUE_PULL_LIMIT || 8);
const WORKER_ID = String(process.env.SMS_QUEUE_WORKER_ID || "").trim() || `termux-${crypto.randomBytes(4).toString("hex")}`;
const recentDispatches = [];
let queuePollInFlight = false;
let queueLastError = "";
let queueLastSuccessAt = "";

function normalizeAckMode(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "wait") return "wait";
  return "accepted";
}

function parseRequestedAckMode(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "wait") return "wait";
  if (clean === "accepted") return "accepted";
  return null;
}

function isQueueWorkerEnabled() {
  return Boolean(INTERNAL_API_KEY && QUEUE_PULL_URL && QUEUE_ACK_URL);
}

function clampInt(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const int = Math.floor(num);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}

async function fetchJsonWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text().catch(() => "");
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function normalizeE164(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[()-]/g, "");
}

function isLikelyE164(value) {
  return /^\+\d{10,15}$/.test(normalizeE164(value));
}

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function isSamePhoneNumber(a, b) {
  const da = onlyDigits(normalizeE164(a));
  const db = onlyDigits(normalizeE164(b));
  if (!da || !db) return false;
  return da === db;
}

function maskPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length < 6) return String(value || "");
  return `+${digits.slice(0, 2)}${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`;
}

function verifySignature(rawBody, req) {
  if (!SIGNING_SECRET) return true;

  const timestamp = String(req.headers["x-wyzer-timestamp"] || "").trim();
  const signature = String(req.headers["x-wyzer-signature"] || "").trim();
  if (!timestamp || !signature) return false;

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", SIGNING_SECRET)
      .update(`${timestamp}.${rawBody}`, "utf8")
      .digest("hex");
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(signature);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function sendSms(to, message) {
  return new Promise((resolve, reject) => {
    execFile(
      "termux-sms-send",
      ["-n", to, message],
      { timeout: Math.max(3000, SMS_SEND_TIMEOUT_MS) },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message || "termux-sms-send failed"));
          return;
        }
        resolve({ stdout: String(stdout || "").trim(), stderr: String(stderr || "").trim() });
      },
    );
  });
}

function pushDispatch(entry) {
  recentDispatches.unshift(entry);
  if (recentDispatches.length > Math.max(5, MAX_RECENT_DISPATCHES)) {
    recentDispatches.length = Math.max(5, MAX_RECENT_DISPATCHES);
  }
}

async function dispatchSms(params) {
  const startedAt = Date.now();
  try {
    const commandResult = await sendSms(params.to, params.message);
    const record = {
      id: params.id,
      status: "sent",
      to: maskPhone(params.to),
      elapsedMs: Date.now() - startedAt,
      mode: params.mode,
      at: new Date().toISOString(),
      stdout: commandResult?.stdout || "",
      stderr: commandResult?.stderr || "",
    };
    pushDispatch(record);
    return { ok: true, record };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    const record = {
      id: params.id,
      status: "error",
      to: maskPhone(params.to),
      elapsedMs: Date.now() - startedAt,
      mode: params.mode,
      at: new Date().toISOString(),
      error: message,
    };
    pushDispatch(record);
    throw new Error(message);
  }
}

function checkCommandAvailability(command) {
  return new Promise((resolve) => {
    execFile("sh", ["-lc", `command -v ${command}`], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(Boolean(String(stdout || "").trim()));
    });
  });
}

async function collectDiagnostics() {
  const termuxSmsSendAvailable = await checkCommandAvailability("termux-sms-send");
  const termuxApiAvailable = await checkCommandAvailability("termux-api");

  return {
    termuxSmsSendAvailable,
    termuxApiAvailable,
    selfSendAllowed: ALLOW_SELF_SEND,
    ackMode: normalizeAckMode(ACK_MODE),
    sendTimeoutMs: Math.max(3000, SMS_SEND_TIMEOUT_MS),
    queueWorkerEnabled: isQueueWorkerEnabled(),
    queuePollIntervalMs: clampInt(QUEUE_POLL_INTERVAL_MS, 800, 500, 60000),
    queuePullLimit: clampInt(QUEUE_PULL_LIMIT, 8, 1, 20),
    queueWorkerId: WORKER_ID,
    queueLastError: queueLastError || null,
    queueLastSuccessAt: queueLastSuccessAt || null,
    recentDispatches: recentDispatches.slice(0, 20),
  };
}

async function pullQueueJobs() {
  const timeoutMs = Math.max(3000, SMS_SEND_TIMEOUT_MS + 3000);
  const payload = {
    workerId: WORKER_ID,
    limit: clampInt(QUEUE_PULL_LIMIT, 8, 1, 20),
  };

  const { res, data } = await fetchJsonWithTimeout(
    QUEUE_PULL_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sms-api-key": INTERNAL_API_KEY,
      },
      body: JSON.stringify(payload),
    },
    timeoutMs,
  );

  if (!res.ok || !data || data.ok !== true) {
    const err = String((data && (data.error || data.message)) || `HTTP ${res.status}`);
    throw new Error(`queue_pull_failed: ${err}`);
  }

  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  return jobs;
}

async function ackQueueJob(id, status, errorMessage) {
  const timeoutMs = Math.max(3000, SMS_SEND_TIMEOUT_MS + 3000);
  const payload = {
    id,
    status,
    ...(errorMessage ? { error: String(errorMessage).slice(0, 4000) } : {}),
  };

  const { res, data } = await fetchJsonWithTimeout(
    QUEUE_ACK_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sms-api-key": INTERNAL_API_KEY,
      },
      body: JSON.stringify(payload),
    },
    timeoutMs,
  );

  if (!res.ok || !data || data.ok !== true) {
    const err = String((data && (data.error || data.message)) || `HTTP ${res.status}`);
    throw new Error(`queue_ack_failed: ${err}`);
  }
}

async function processQueueJob(job) {
  const id = String(job?.id || "").trim();
  const to = normalizeE164(String(job?.phoneE164 || ""));
  const message = String(job?.message || "").replace(/\s+/g, " ").trim();

  if (!id) return;
  if (!isLikelyE164(to) || !message) {
    await ackQueueJob(id, "failed", "invalid_queue_job_payload");
    return;
  }

  try {
    await dispatchSms({ id, to, message, mode: "queue-pull" });
    await ackQueueJob(id, "sent");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "queue_dispatch_failed";
    try {
      await ackQueueJob(id, "failed", msg);
    } catch (ackError) {
      const ackMsg = ackError instanceof Error ? ackError.message : String(ackError || "queue_ack_error");
      console.error("[sms-gateway] queue ack failed", { id, error: ackMsg });
    }
  }
}

async function pollQueueOnce() {
  if (!isQueueWorkerEnabled()) return;
  if (queuePollInFlight) return;
  queuePollInFlight = true;

  try {
    const jobs = await pullQueueJobs();
    for (const job of jobs) {
      await processQueueJob(job);
    }
    queueLastError = "";
    queueLastSuccessAt = new Date().toISOString();
  } catch (error) {
    queueLastError = error instanceof Error ? error.message : String(error || "queue_poll_failed");
    console.error("[sms-gateway] queue poll error", { error: queueLastError });
  } finally {
    queuePollInFlight = false;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    return json(res, 200, {
      ok: true,
      gateway: "termux",
      endpoints: {
        health: { method: "GET", path: "/health" },
        diag: { method: "GET", path: "/diag", auth: "Bearer token" },
        send: { method: "POST", path: "/send", auth: "Bearer token" },
        queuePull: { method: "POST", path: "SMS_QUEUE_PULL_URL", auth: "x-sms-api-key" },
        queueAck: { method: "POST", path: "SMS_QUEUE_ACK_URL", auth: "x-sms-api-key" },
      },
      now: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && req.url === "/health") {
    const diagnostics = await collectDiagnostics();
    return json(res, 200, {
      ok: true,
      gateway: "termux",
      ownNumber: GATEWAY_NUMBER || null,
      hasToken: Boolean(TOKEN),
      hasSigningSecret: Boolean(SIGNING_SECRET),
      diagnostics,
      now: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && req.url === "/diag") {
    if (!TOKEN) {
      return json(res, 503, { ok: false, error: "missing_sms_webhook_token" });
    }

    const auth = String(req.headers.authorization || "").trim();
    if (auth !== `Bearer ${TOKEN}`) {
      return json(res, 401, { ok: false, error: "unauthorized" });
    }

    const diagnostics = await collectDiagnostics();
    return json(res, 200, {
      ok: true,
      diagnostics,
      ownNumber: GATEWAY_NUMBER || null,
      now: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && req.url === "/send") {
    return json(res, 405, {
      ok: false,
      error: "method_not_allowed",
      message: "Use POST /send com JSON e Authorization Bearer.",
      expected: {
        method: "POST",
        path: "/send",
        headers: ["Authorization: Bearer <SMS_WEBHOOK_TOKEN>", "Content-Type: application/json"],
        body: {
          to: "+5511937250986",
          message: "Wyzer - Seu codigo de verificacao: 1234567",
          code: "1234567",
        },
      },
    });
  }

  if (req.method !== "POST" || req.url !== "/send") {
    return json(res, 404, { ok: false, error: "not_found" });
  }

  if (!TOKEN) {
    return json(res, 503, { ok: false, error: "missing_sms_webhook_token" });
  }

  const auth = String(req.headers.authorization || "").trim();
  if (auth !== `Bearer ${TOKEN}`) {
    return json(res, 401, { ok: false, error: "unauthorized" });
  }

  let rawBody = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    rawBody += chunk;
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      req.destroy();
    }
  });

  req.on("end", async () => {
    try {
      if (!verifySignature(rawBody, req)) {
        return json(res, 401, { ok: false, error: "invalid_signature" });
      }

      const payload = JSON.parse(rawBody || "{}");
      const to = normalizeE164(payload.to);
      const message = String(payload.message || "").replace(/\s+/g, " ").trim();
      const requestedAckMode = parseRequestedAckMode(
        String(req.headers["x-wyzer-prefer-ack"] || payload.dispatchMode || ""),
      );

      if (!isLikelyE164(to)) {
        return json(res, 400, { ok: false, error: "invalid_to" });
      }
      if (!message) {
        return json(res, 400, { ok: false, error: "missing_message" });
      }
      if (!ALLOW_SELF_SEND && GATEWAY_NUMBER && isSamePhoneNumber(to, GATEWAY_NUMBER)) {
        return json(res, 400, {
          ok: false,
          error: "self_send_blocked",
          message: "Destino igual ao numero do gateway. Use outro numero ou ative SMS_GATEWAY_ALLOW_SELF_SEND=1.",
        });
      }

      const dispatchId = crypto.randomBytes(8).toString("hex");
      const mode = requestedAckMode || normalizeAckMode(ACK_MODE);

      if (mode === "accepted") {
        dispatchSms({ id: dispatchId, to, message, mode }).catch((error) => {
          const errMessage = error instanceof Error ? error.message : String(error || "unexpected_error");
          console.error("[sms-gateway] async dispatch error", {
            id: dispatchId,
            to: maskPhone(to),
            error: errMessage,
          });
        });

        return json(res, 202, {
          ok: true,
          id: dispatchId,
          status: "accepted",
        });
      }

      await dispatchSms({ id: dispatchId, to, message, mode });

      return json(res, 200, {
        ok: true,
        id: dispatchId,
        status: "queued",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected_error";
      return json(res, 500, { ok: false, error: message });
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[sms-gateway] running on 0.0.0.0:${PORT}`);
  if (isQueueWorkerEnabled()) {
    const intervalMs = clampInt(QUEUE_POLL_INTERVAL_MS, 800, 500, 60000);
    console.log(`[sms-gateway] queue worker enabled: ${WORKER_ID} (every ${intervalMs}ms)`);
    void pollQueueOnce();
    setInterval(() => {
      void pollQueueOnce();
    }, intervalMs);
  } else {
    console.log("[sms-gateway] queue worker disabled (configure SMS_QUEUE_PULL_URL/SMS_QUEUE_ACK_URL/SMS_INTERNAL_API_KEY)");
  }
});
