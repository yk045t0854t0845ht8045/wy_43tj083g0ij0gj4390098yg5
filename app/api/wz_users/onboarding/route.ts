import crypto from "crypto";
import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  ensureOnboardingRecord,
  isOnboardingSchemaError,
  normalizeCnpjDigits,
  normalizeEmail,
  normalizeOptionalText,
  ONBOARDING_SCHEMA_HINT,
  patchOnboardingRecord,
  type OnboardingRecord,
  type OnboardingUiStep,
} from "@/app/api/wz_users/_onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const WHATSAPP_PAIRING_TTL_MS = 1000 * 60 * 2;
const EVOLUTION_REQUEST_TIMEOUT_MS = 12000;
const WHATSAPP_PROVIDER_NAME = "evolution";

type OnboardingAction =
  | "save-company"
  | "save-team"
  | "set-step"
  | "generate-whatsapp-qr"
  | "confirm-whatsapp"
  | "finish";

type EvolutionRequestResult = {
  ok: boolean;
  status: number;
  data: unknown;
  error: string | null;
};

type EvolutionStateResult =
  | {
      ok: true;
      exists: boolean;
      state: string;
      data: unknown;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type EvolutionConnectResult =
  | {
      ok: true;
      code: string | null;
      pairingCode: string | null;
      data: unknown;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type ResolvedOnboardingContext = {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  sessionEmail: string;
  onboarding: OnboardingRecord;
};

type WhatsAppProviderSyncResult =
  | {
      ok: true;
      onboarding: OnboardingRecord;
      whatsappState: string;
      qrCodeDataUrl?: string;
      pairingCode?: string;
      pairingExpiresAt?: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

const ONBOARDING_ALLOWED_STEPS = new Set<OnboardingUiStep>([
  "welcome",
  "company",
  "goal",
  "team",
  "ai",
  "whatsapp",
  "improve",
  "final",
]);

function getErrorMessage(error: unknown, fallback: string) {
  const message = String((error as { message?: unknown } | null)?.message || "").trim();
  return message || fallback;
}

function normalizeTeamAgentsCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeUiStep(value: unknown) {
  const clean = String(value || "").trim().toLowerCase();
  if (ONBOARDING_ALLOWED_STEPS.has(clean as OnboardingUiStep)) {
    return clean as OnboardingUiStep;
  }
  return null;
}

function normalizeCompanyName(value: unknown) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.slice(0, 160);
}

function normalizeIndustry(value: unknown) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.slice(0, 120);
}

function resolveEvolutionApiBaseUrl() {
  const configured = String(
    process.env.EVOLUTION_API_BASE_URL || process.env.WHATSAPP_PROVIDER_BASE_URL || "",
  ).trim();
  if (!configured) return "";
  return configured.replace(/\/+$/, "");
}

function resolveEvolutionApiKey() {
  return String(process.env.EVOLUTION_API_KEY || process.env.WHATSAPP_PROVIDER_API_KEY || "").trim();
}

function resolveEvolutionIntegration() {
  const configured = String(process.env.EVOLUTION_INTEGRATION || "").trim();
  if (!configured) return "WHATSAPP-BAILEYS";
  return configured;
}

function resolveEvolutionInstancePrefix() {
  const configured = String(process.env.EVOLUTION_INSTANCE_PREFIX || "").trim().toLowerCase();
  if (!configured) return "wyzer";
  return configured.replace(/[^a-z0-9-_]/g, "") || "wyzer";
}

function resolveEvolutionWebhookUrl() {
  const configured = String(process.env.EVOLUTION_WEBHOOK_URL || "").trim();
  return configured || "";
}

function isEvolutionProviderConfigured() {
  return Boolean(resolveEvolutionApiBaseUrl() && resolveEvolutionApiKey());
}

function buildEvolutionInstanceName(userId: string) {
  const prefix = resolveEvolutionInstancePrefix();
  const cleanUserId = String(userId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = `${prefix}-${cleanUserId || "unknown"}`;
  return base.slice(0, 60);
}

function toJsonSafe(raw: string) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function normalizeEvolutionError(data: unknown, fallback: string) {
  const payload = data as Record<string, unknown> | null;
  const msg =
    normalizeOptionalText(String(payload?.message || "")) ||
    normalizeOptionalText(String(payload?.error || "")) ||
    normalizeOptionalText(String(payload?.response || "")) ||
    normalizeOptionalText(String(payload?.raw || ""));
  return msg || fallback;
}

function pickEvolutionState(data: unknown) {
  const payload = data as Record<string, unknown> | null;
  const instance = (payload?.instance || null) as Record<string, unknown> | null;
  const response = (payload?.response || null) as Record<string, unknown> | null;
  const responseInstance = (response?.instance || null) as Record<string, unknown> | null;

  const candidates = [
    instance?.state,
    instance?.status,
    responseInstance?.state,
    response?.state,
    payload?.state,
    payload?.status,
  ];

  for (const candidate of candidates) {
    const state = String(candidate || "").trim().toLowerCase();
    if (!state) continue;
    if (state === "connected") return "open";
    if (state === "closed") return "close";
    return state;
  }

  return "unknown";
}

function isEvolutionInstanceAlreadyExists(status: number, data: unknown) {
  if (status === 409) return true;
  const text = String(
    (data as Record<string, unknown> | null)?.message ||
      (data as Record<string, unknown> | null)?.error ||
      (data as Record<string, unknown> | null)?.raw ||
      "",
  )
    .trim()
    .toLowerCase();
  if (!text) return false;
  return (
    (text.includes("already") && text.includes("exist")) ||
    text.includes("ja existe") ||
    text.includes("existente") ||
    text.includes("in use")
  );
}

function extractEvolutionConnectCode(data: unknown) {
  const payload = data as Record<string, unknown> | null;
  const response = (payload?.response || null) as Record<string, unknown> | null;

  const codeCandidates = [
    payload?.code,
    payload?.qrcode,
    payload?.qr,
    payload?.base64,
    response?.code,
    response?.qrcode,
    response?.qr,
    response?.base64,
  ];

  const pairingCandidates = [
    payload?.pairingCode,
    payload?.pairingcode,
    payload?.pairing_code,
    response?.pairingCode,
    response?.pairingcode,
    response?.pairing_code,
  ];

  let code: string | null = null;
  for (const candidate of codeCandidates) {
    const normalized = normalizeOptionalText(String(candidate || ""));
    if (!normalized) continue;
    code = normalized;
    break;
  }

  let pairingCode: string | null = null;
  for (const candidate of pairingCandidates) {
    const normalized = normalizeOptionalText(String(candidate || ""));
    if (!normalized) continue;
    pairingCode = normalized;
    break;
  }

  return { code, pairingCode };
}

function looksLikeBase64Image(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  if (clean.startsWith("data:image/")) return true;
  if (clean.length < 180) return false;
  if (clean.includes("@")) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(clean);
}

async function evolutionRequest(params: {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
}) {
  const baseUrl = resolveEvolutionApiBaseUrl();
  const apiKey = resolveEvolutionApiKey();
  if (!baseUrl || !apiKey) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Provider WhatsApp nao configurado no ambiente.",
    } as EvolutionRequestResult;
  }

  const url = `${baseUrl}${params.path.startsWith("/") ? "" : "/"}${params.path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, EVOLUTION_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: params.method || "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        apikey: apiKey,
        ...(params.body ? { "Content-Type": "application/json" } : {}),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });

    const raw = await res.text();
    const data = toJsonSafe(raw);

    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        data,
        error: null,
      } as EvolutionRequestResult;
    }

    return {
      ok: false,
      status: res.status,
      data,
      error: normalizeEvolutionError(data, "Falha ao comunicar com provider WhatsApp."),
    } as EvolutionRequestResult;
  } catch (error) {
    const errMessage =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Tempo limite atingido ao consultar provider WhatsApp."
          : error.message
        : "Erro inesperado ao consultar provider WhatsApp.";
    return {
      ok: false,
      status: 0,
      data: null,
      error: errMessage,
    } as EvolutionRequestResult;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureEvolutionInstance(instanceName: string) {
  const webhookUrl = resolveEvolutionWebhookUrl();
  const body: Record<string, unknown> = {
    instanceName,
    integration: resolveEvolutionIntegration(),
    qrcode: true,
    token: crypto.randomBytes(12).toString("hex"),
  };

  if (webhookUrl) {
    body.webhook = {
      url: webhookUrl,
      byEvents: true,
      base64: true,
      events: ["CONNECTION_UPDATE"],
    };
  }

  const created = await evolutionRequest({
    path: "/instance/create",
    method: "POST",
    body,
  });

  if (created.ok) {
    return { ok: true as const };
  }

  if (isEvolutionInstanceAlreadyExists(created.status, created.data)) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    error: created.error || "Nao foi possivel preparar instancia do WhatsApp.",
  };
}

async function getEvolutionConnectionState(instanceName: string): Promise<EvolutionStateResult> {
  const stateRes = await evolutionRequest({
    path: `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    method: "GET",
  });

  if (!stateRes.ok && stateRes.status === 404) {
    return {
      ok: true,
      exists: false,
      state: "not-found",
      data: stateRes.data,
    };
  }

  if (!stateRes.ok) {
    return {
      ok: false,
      status: stateRes.status,
      error: stateRes.error || "Nao foi possivel consultar status de conexao do WhatsApp.",
    };
  }

  return {
    ok: true,
    exists: true,
    state: pickEvolutionState(stateRes.data),
    data: stateRes.data,
  };
}

async function getEvolutionConnectCode(instanceName: string): Promise<EvolutionConnectResult> {
  const res = await evolutionRequest({
    path: `/instance/connect/${encodeURIComponent(instanceName)}`,
    method: "GET",
  });

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: res.error || "Nao foi possivel gerar QR Code no provider WhatsApp.",
    };
  }

  const extracted = extractEvolutionConnectCode(res.data);
  return {
    ok: true,
    code: extracted.code,
    pairingCode: extracted.pairingCode,
    data: res.data,
  };
}

async function refreshOnboarding(params: ResolvedOnboardingContext) {
  const refreshed = await ensureOnboardingRecord({
    sb: params.sb,
    sessionUserId: params.sessionUserId,
    sessionEmail: params.sessionEmail,
  });

  if (!refreshed.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Nao foi possivel recarregar onboarding." },
        { status: refreshed.schemaReady === false ? 500 : 400, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    onboarding: refreshed.record,
  };
}

async function patchOnboardingAndRefresh(params: {
  ctx: ResolvedOnboardingContext;
  patch: Record<string, unknown>;
  fallbackError: string;
}) {
  const updated = await patchOnboardingRecord({
    sb: params.ctx.sb,
    recordId: params.ctx.onboarding.id,
    patch: params.patch,
  });

  if (!updated.ok) {
    const status = updated.schemaReady === false ? 500 : 400;
    const errorMessage =
      updated.schemaReady === false
        ? ONBOARDING_SCHEMA_HINT
        : getErrorMessage(updated.error, params.fallbackError);
    if (updated.schemaReady !== false) {
      console.error("[onboarding] patch/update error:", updated.error);
    }
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: errorMessage },
        { status, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const refreshed = await refreshOnboarding(params.ctx);
  if (!refreshed.ok) return refreshed;

  return {
    ok: true as const,
    onboarding: refreshed.onboarding,
  };
}

async function syncWhatsAppWithProvider(params: {
  ctx: ResolvedOnboardingContext;
  requireQr: boolean;
}): Promise<WhatsAppProviderSyncResult> {
  if (!isEvolutionProviderConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "Provider WhatsApp nao configurado. Defina EVOLUTION_API_BASE_URL e EVOLUTION_API_KEY no ambiente.",
        },
        { status: 500, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const instanceName = buildEvolutionInstanceName(params.ctx.onboarding.userId);
  let stateResult = await getEvolutionConnectionState(instanceName);
  if (!stateResult.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: stateResult.error },
        { status: 502, headers: NO_STORE_HEADERS },
      ),
    };
  }

  if (!stateResult.exists) {
    const ensured = await ensureEvolutionInstance(instanceName);
    if (!ensured.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: ensured.error },
          { status: 502, headers: NO_STORE_HEADERS },
        ),
      };
    }

    stateResult = await getEvolutionConnectionState(instanceName);
    if (!stateResult.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: stateResult.error },
          { status: 502, headers: NO_STORE_HEADERS },
        ),
      };
    }
  }

  if (stateResult.state === "open") {
    let onboarding = params.ctx.onboarding;
    const patch: Record<string, unknown> = {};
    const nowIso = new Date().toISOString();

    if (!onboarding.whatsappConnected) {
      patch.whatsapp_connected = true;
      patch.whatsapp_connected_at = nowIso;
    }
    if (onboarding.uiStep !== "final") {
      patch.ui_step = "final";
    }
    if (onboarding.whatsappPairingCode) {
      patch.whatsapp_pairing_code = null;
    }
    if (onboarding.whatsappPairingExpiresAt) {
      patch.whatsapp_pairing_expires_at = null;
    }

    if (Object.keys(patch).length > 0) {
      const patched = await patchOnboardingAndRefresh({
        ctx: params.ctx,
        patch,
        fallbackError: "Nao foi possivel salvar status de conexao do WhatsApp.",
      });
      if (!patched.ok) return patched;
      onboarding = patched.onboarding;
    }

    return {
      ok: true,
      onboarding,
      whatsappState: "open",
    };
  }

  if (!params.requireQr) {
    let onboarding = params.ctx.onboarding;
    const needsRollback =
      onboarding.whatsappConnected || onboarding.whatsappConnectedAt || onboarding.uiStep === "final";

    if (needsRollback) {
      const patched = await patchOnboardingAndRefresh({
        ctx: params.ctx,
        patch: {
          ui_step: "whatsapp",
          whatsapp_connected: false,
          whatsapp_connected_at: null,
          completed: false,
          completed_at: null,
        },
        fallbackError: "Nao foi possivel atualizar status do WhatsApp.",
      });
      if (!patched.ok) return patched;
      onboarding = patched.onboarding;
    }

    return {
      ok: true,
      onboarding,
      whatsappState: stateResult.state,
    };
  }

  let connectResult = await getEvolutionConnectCode(instanceName);
  if (!connectResult.ok && connectResult.status === 404) {
    const ensured = await ensureEvolutionInstance(instanceName);
    if (ensured.ok) {
      connectResult = await getEvolutionConnectCode(instanceName);
    }
  }

  if (!connectResult.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: connectResult.error },
        { status: 502, headers: NO_STORE_HEADERS },
      ),
    };
  }

  if (!connectResult.code) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Provider WhatsApp nao retornou QR Code valido. Tente novamente em alguns segundos.",
        },
        { status: 502, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const codeValue = String(connectResult.code || "").trim();
  const qrCodeDataUrl = codeValue.startsWith("data:image/")
    ? codeValue
    : looksLikeBase64Image(codeValue)
      ? `data:image/png;base64,${codeValue}`
      : await QRCode.toDataURL(codeValue, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: "M",
        });

  const pairingCode =
    normalizeOptionalText(connectResult.pairingCode || params.ctx.onboarding.whatsappPairingCode || "") || null;
  const pairingExpiresAt = new Date(Date.now() + WHATSAPP_PAIRING_TTL_MS).toISOString();

  const patched = await patchOnboardingAndRefresh({
    ctx: params.ctx,
    patch: {
      ui_step: "whatsapp",
      whatsapp_pairing_code: pairingCode,
      whatsapp_pairing_expires_at: pairingExpiresAt,
      whatsapp_connected: false,
      whatsapp_connected_at: null,
      completed: false,
      completed_at: null,
    },
    fallbackError: "Nao foi possivel atualizar QR Code do WhatsApp.",
  });
  if (!patched.ok) return patched;

  return {
    ok: true,
    onboarding: patched.onboarding,
    whatsappState: stateResult.state,
    qrCodeDataUrl,
    pairingCode: pairingCode || undefined,
    pairingExpiresAt,
  };
}

async function withOnboardingContext(req: NextRequest) {
  const session = await readActiveSessionFromRequest(req);
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Nao autenticado." },
        { status: 401, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const sessionUserId = normalizeOptionalText(String(session.userId || ""));
  const sessionEmail = normalizeEmail(session.email);
  if (!sessionUserId || !sessionEmail) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Sessao invalida." },
        { status: 401, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const sb = supabaseAdmin();
  const onboarding = await ensureOnboardingRecord({
    sb,
    sessionUserId,
    sessionEmail,
  });

  if (!onboarding.ok) {
    const status = onboarding.schemaReady === false ? 500 : 400;
    const errorMessage =
      onboarding.schemaReady === false
        ? ONBOARDING_SCHEMA_HINT
        : getErrorMessage(onboarding.error, "Nao foi possivel carregar onboarding.");
    if (onboarding.error && !isOnboardingSchemaError(onboarding.error)) {
      console.error("[onboarding] ensure record error:", onboarding.error);
    }
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: errorMessage },
        { status, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    sb,
    sessionUserId,
    sessionEmail,
    onboarding: onboarding.record,
  };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await withOnboardingContext(req);
    if (!ctx.ok) return ctx.response;

    let onboarding = ctx.onboarding;
    let qrCodeDataUrl: string | undefined;
    let pairingCode: string | undefined;
    let pairingExpiresAt: string | undefined;
    let whatsappState = onboarding.whatsappConnected ? "open" : "close";

    const shouldSyncWhatsApp =
      !onboarding.completed &&
      (onboarding.uiStep === "whatsapp" ||
        (onboarding.uiStep === "final" && !onboarding.whatsappConnected));

    if (shouldSyncWhatsApp) {
      const sync = await syncWhatsAppWithProvider({
        ctx: {
          ...ctx,
          onboarding,
        },
        requireQr: onboarding.uiStep === "whatsapp",
      });
      if (!sync.ok) return sync.response;
      onboarding = sync.onboarding;
      whatsappState = sync.whatsappState;
      qrCodeDataUrl = sync.qrCodeDataUrl;
      pairingCode = sync.pairingCode;
      pairingExpiresAt = sync.pairingExpiresAt;
    }

    return NextResponse.json(
      {
        ok: true,
        onboarding,
        qrCodeDataUrl,
        pairingCode,
        pairingExpiresAt,
        whatsappState,
        whatsappProvider: WHATSAPP_PROVIDER_NAME,
        providerConfigured: isEvolutionProviderConfigured(),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[onboarding] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao carregar onboarding." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await withOnboardingContext(req);
    if (!ctx.ok) return ctx.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body?.action || "").trim().toLowerCase() as OnboardingAction;
    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Acao invalida de onboarding." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const nowIso = new Date().toISOString();

    if (action === "save-company") {
      const companyName = normalizeCompanyName(body?.companyName);
      const industry = normalizeIndustry(body?.industry);
      const companyLogoUrl = normalizeOptionalText(String(body?.companyLogoUrl || ""));
      const cnpjDigits = normalizeCnpjDigits(String(body?.companyCnpj || ""));

      if (!companyName) {
        return NextResponse.json(
          { ok: false, error: "Informe o nome da empresa." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      if (!industry) {
        return NextResponse.json(
          { ok: false, error: "Informe a atuacao da empresa." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      if (!companyLogoUrl) {
        return NextResponse.json(
          { ok: false, error: "Envie a logo da empresa para continuar." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      if (cnpjDigits && cnpjDigits.length !== 14) {
        return NextResponse.json(
          { ok: false, error: "CNPJ invalido. Use 14 digitos." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const patched = await patchOnboardingAndRefresh({
        ctx,
        patch: {
          company_name: companyName,
          industry,
          company_logo_url: companyLogoUrl,
          company_cnpj: cnpjDigits,
          welcome_confirmed: true,
          ui_step: "team",
          completed: false,
          completed_at: null,
        },
        fallbackError: "Nao foi possivel salvar os dados da empresa.",
      });
      if (!patched.ok) return patched.response;

      return NextResponse.json(
        { ok: true, onboarding: patched.onboarding },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (action === "save-team") {
      const teamAgentsCount = normalizeTeamAgentsCount(body?.teamAgentsCount);
      if (!teamAgentsCount || teamAgentsCount < 1 || teamAgentsCount > 5000) {
        return NextResponse.json(
          { ok: false, error: "Quantidade de funcionarios invalida." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const patched = await patchOnboardingAndRefresh({
        ctx,
        patch: {
          team_agents_count: teamAgentsCount,
          ui_step: "whatsapp",
          completed: false,
          completed_at: null,
        },
        fallbackError: "Nao foi possivel salvar os dados do time.",
      });
      if (!patched.ok) return patched.response;

      const sync = await syncWhatsAppWithProvider({
        ctx: {
          ...ctx,
          onboarding: patched.onboarding,
        },
        requireQr: true,
      });
      if (!sync.ok) return sync.response;

      return NextResponse.json(
        {
          ok: true,
          onboarding: sync.onboarding,
          qrCodeDataUrl: sync.qrCodeDataUrl,
          pairingCode: sync.pairingCode,
          pairingExpiresAt: sync.pairingExpiresAt,
          whatsappState: sync.whatsappState,
          whatsappProvider: WHATSAPP_PROVIDER_NAME,
          providerConfigured: isEvolutionProviderConfigured(),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (action === "set-step") {
      const uiStep = normalizeUiStep(body?.uiStep);
      if (!uiStep) {
        return NextResponse.json(
          { ok: false, error: "Etapa de onboarding invalida." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const patched = await patchOnboardingAndRefresh({
        ctx,
        patch: {
          ui_step: uiStep,
        },
        fallbackError: "Nao foi possivel atualizar etapa.",
      });
      if (!patched.ok) return patched.response;

      return NextResponse.json(
        { ok: true, onboarding: patched.onboarding },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (action === "generate-whatsapp-qr") {
      const sync = await syncWhatsAppWithProvider({
        ctx,
        requireQr: true,
      });
      if (!sync.ok) return sync.response;

      return NextResponse.json(
        {
          ok: true,
          onboarding: sync.onboarding,
          qrCodeDataUrl: sync.qrCodeDataUrl,
          pairingCode: sync.pairingCode,
          pairingExpiresAt: sync.pairingExpiresAt,
          whatsappState: sync.whatsappState,
          whatsappProvider: WHATSAPP_PROVIDER_NAME,
          providerConfigured: isEvolutionProviderConfigured(),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (action === "confirm-whatsapp") {
      const sync = await syncWhatsAppWithProvider({
        ctx,
        requireQr: false,
      });
      if (!sync.ok) return sync.response;

      if (!sync.onboarding.whatsappConnected) {
        return NextResponse.json(
          {
            ok: false,
            error: "WhatsApp ainda nao conectado. Escaneie o QR Code e aguarde a validacao automatica.",
          },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          onboarding: sync.onboarding,
          whatsappState: sync.whatsappState,
          whatsappProvider: WHATSAPP_PROVIDER_NAME,
          providerConfigured: isEvolutionProviderConfigured(),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (action === "finish") {
      if (!ctx.onboarding.whatsappConnected) {
        return NextResponse.json(
          { ok: false, error: "Conecte o WhatsApp antes de finalizar." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const patched = await patchOnboardingAndRefresh({
        ctx,
        patch: {
          ui_step: "final",
          completed: true,
          completed_at: nowIso,
        },
        fallbackError: "Nao foi possivel concluir onboarding.",
      });
      if (!patched.ok) return patched.response;

      return NextResponse.json(
        { ok: true, onboarding: patched.onboarding },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Acao de onboarding nao suportada." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[onboarding] POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao salvar onboarding." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
