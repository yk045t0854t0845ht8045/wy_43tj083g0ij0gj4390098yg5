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
const MAX_BODY_BYTES = 128 * 1024;

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

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
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
    sendTimeoutMs: Math.max(3000, SMS_SEND_TIMEOUT_MS),
  };
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
          to: "+5511999999999",
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

      await sendSms(to, message);

      return json(res, 200, {
        ok: true,
        id: crypto.randomBytes(8).toString("hex"),
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
});
