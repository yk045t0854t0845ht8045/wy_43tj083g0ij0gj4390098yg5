import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import {
  cleanupPrimaryOnboardingLogoFolder,
  extractObjectPathFromPublicUrl,
  ONBOARDING_LOGO_BUCKET,
} from "@/app/api/wz_users/_managed_storage";
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
import {
  buildOwnWhatsAppInstanceName,
  ensureOwnWhatsAppInstance,
  getOwnWhatsAppSnapshot,
  isOwnWhatsAppProviderConfigured,
  type LocalWhatsAppSnapshot,
  waitForOwnWhatsAppQr,
} from "@/app/api/wz_users/_whatsapp_provider";
import { registerWhatsAppInstanceBinding } from "@/whatsapp-sistema/instance-registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const WHATSAPP_PAIRING_TTL_MS = 1000 * 60 * 2;
const WHATSAPP_QR_WAIT_TIMEOUT_MS = 12000;
const WHATSAPP_QR_MAX_ACQUIRE_WINDOW_MS = 1000 * 60;
const WHATSAPP_QR_MAX_FORCED_RESTARTS = 2;
const WHATSAPP_CONNECTING_STALE_MS = 45000;
const WHATSAPP_PROVIDER_NAME = "self-hosted-baileys";
const ONBOARDING_GOAL_OPTIONS = new Set(["support", "sales", "scheduling", "billing", "mixed"]);
const MONTHLY_CONVERSATION_OPTIONS = new Set([
  "up_to_300",
  "301_1000",
  "1001_3000",
  "3001_10000",
  "10001_plus",
]);

type OnboardingAction =
  | "save-company"
  | "save-team"
  | "set-step"
  | "heartbeat"
  | "generate-whatsapp-qr"
  | "confirm-whatsapp"
  | "finish";

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

function isValidCnpjDigits(value: string) {
  const digits = String(value || "").replace(/\D+/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const numbers = digits.split("").map((digit) => Number.parseInt(digit, 10));
  const calcDigit = (sliceLength: number) => {
    let factor = sliceLength - 7;
    const total = numbers.slice(0, sliceLength).reduce((acc, num) => {
      const next = acc + num * factor;
      factor -= 1;
      if (factor < 2) factor = 9;
      return next;
    }, 0);
    const mod = total % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  return numbers[12] === calcDigit(12) && numbers[13] === calcDigit(13);
}

function normalizeBooleanInput(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "1" || clean === "true" || clean === "t" || clean === "yes" || clean === "sim";
  }
  return false;
}

function normalizeAddressText(value: unknown, maxLength = 180) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.slice(0, maxLength);
}

function normalizeStateCode(value: unknown) {
  const clean = String(value || "")
    .replace(/[^a-zA-Z]/g, "")
    .trim()
    .toUpperCase();
  if (!clean) return null;
  return clean.slice(0, 2);
}

function normalizePostalCodeDigits(value: unknown) {
  const digits = String(value || "").replace(/\D+/g, "");
  return digits || null;
}

function normalizeOnboardingGoal(value: unknown) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return null;
  return ONBOARDING_GOAL_OPTIONS.has(clean) ? clean : null;
}

function normalizeMonthlyConversationsTier(value: unknown) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return null;
  return MONTHLY_CONVERSATION_OPTIONS.has(clean) ? clean : null;
}

function hasCompleteCompanyData(onboarding: OnboardingRecord) {
  const companyName = normalizeCompanyName(onboarding.companyName || "");
  const industry = normalizeIndustry(onboarding.industry || "");
  const logo = normalizeOptionalText(onboarding.companyLogoUrl || "");
  const cnpjDigits = normalizeCnpjDigits(onboarding.companyCnpj || "");
  const isOnlineBusiness = Boolean(onboarding.isOnlineBusiness);
  const companyAddress = normalizeAddressText(onboarding.companyAddress || "", 180);
  const companyCity = normalizeAddressText(onboarding.companyCity || "", 120);
  const companyState = normalizeStateCode(onboarding.companyState || "");
  const companyPostalCode = normalizePostalCodeDigits(onboarding.companyPostalCode || "");

  if (!companyName || !industry || !logo) return false;
  if (cnpjDigits && !isValidCnpjDigits(cnpjDigits)) return false;
  if (isOnlineBusiness) return true;

  return Boolean(
    companyAddress &&
      companyCity &&
      companyState &&
      companyState.length === 2 &&
      companyPostalCode &&
      companyPostalCode.length === 8,
  );
}

function hasCompleteTeamData(onboarding: OnboardingRecord) {
  const team = Number(onboarding.teamAgentsCount || 0);
  const goal = normalizeOnboardingGoal(onboarding.onboardingGoal || "");
  const volume = normalizeMonthlyConversationsTier(onboarding.monthlyConversationsTier || "");
  return Number.isFinite(team) && team >= 1 && team <= 5000 && Boolean(goal) && Boolean(volume);
}

function resolveUiStepAfterCompanySave(onboarding: OnboardingRecord): OnboardingUiStep {
  if (onboarding.whatsappConnected) return "final";
  if (hasCompleteTeamData(onboarding)) return "whatsapp";
  return "team";
}

function normalizeProviderState(value: string) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return "unknown";
  if (clean === "starting" || clean === "connecting" || clean === "idle") {
    return "connecting";
  }
  if (clean === "qr") return "qr";
  if (clean === "open") return "open";
  if (clean === "close") return "close";
  if (clean === "logged_out") return "logged_out";
  if (clean === "error") return "error";
  return clean;
}

function snapshotAgeMs(updatedAt?: string | null) {
  const parsed = Date.parse(String(updatedAt || ""));
  if (!Number.isFinite(parsed)) return 0;
  return Date.now() - parsed;
}

function shouldForceRestartForQr(params: {
  state: string;
  hasQr: boolean;
  updatedAt?: string | null;
}) {
  if (params.hasQr) return false;
  if (params.state === "close" || params.state === "logged_out" || params.state === "error") {
    return true;
  }
  return params.state === "connecting" && snapshotAgeMs(params.updatedAt) > WHATSAPP_CONNECTING_STALE_MS;
}

type AcquireQrSnapshotResult =
  | {
      ok: true;
      snapshot: LocalWhatsAppSnapshot;
      state: string;
    }
  | {
      ok: false;
      error: string;
    };

async function acquireProviderSnapshotForQr(params: {
  instanceName: string;
  snapshot: LocalWhatsAppSnapshot;
  state: string;
}): Promise<AcquireQrSnapshotResult> {
  let snapshot = params.snapshot;
  let state = params.state;
  let forcedRestarts = 0;
  let waitTimeoutMs = WHATSAPP_QR_WAIT_TIMEOUT_MS;
  const deadline = Date.now() + WHATSAPP_QR_MAX_ACQUIRE_WINDOW_MS;

  while (Date.now() < deadline) {
    if (snapshot.qr || state === "open") {
      return { ok: true, snapshot, state };
    }

    const shouldRestart =
      shouldForceRestartForQr({
        state,
        hasQr: Boolean(snapshot.qr),
        updatedAt: snapshot.updatedAt,
      }) && forcedRestarts < WHATSAPP_QR_MAX_FORCED_RESTARTS;

    const ensured = await ensureOwnWhatsAppInstance(
      params.instanceName,
      shouldRestart ? { forceRestart: true } : {},
    );

    if (!ensured.ok) {
      if (forcedRestarts >= WHATSAPP_QR_MAX_FORCED_RESTARTS) {
        return {
          ok: false,
          error: ensured.error,
        };
      }

      const hardRestart = await ensureOwnWhatsAppInstance(params.instanceName, { forceRestart: true });
      if (!hardRestart.ok) {
        return {
          ok: false,
          error: hardRestart.error,
        };
      }
      forcedRestarts += 1;
    } else if (shouldRestart) {
      forcedRestarts += 1;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    const nextWaitMs = Math.max(1000, Math.min(waitTimeoutMs, remainingMs));
    snapshot = await waitForOwnWhatsAppQr(params.instanceName, nextWaitMs);
    state = normalizeProviderState(snapshot.state);

    if ((state === "error" || state === "logged_out") && !snapshot.qr) {
      if (forcedRestarts >= WHATSAPP_QR_MAX_FORCED_RESTARTS) {
        break;
      }

      const hardRestart = await ensureOwnWhatsAppInstance(params.instanceName, { forceRestart: true });
      if (!hardRestart.ok) {
        return {
          ok: false,
          error: hardRestart.error,
        };
      }

      forcedRestarts += 1;
      snapshot = getOwnWhatsAppSnapshot(params.instanceName);
      state = normalizeProviderState(snapshot.state);
    }

    waitTimeoutMs = Math.min(waitTimeoutMs + 2500, 18000);
  }

  return { ok: true, snapshot, state };
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
  if (!isOwnWhatsAppProviderConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "Provider proprio de WhatsApp desativado. Defina WHATSAPP_SELF_HOSTED_ENABLED=true no ambiente.",
        },
        { status: 500, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const instanceName = buildOwnWhatsAppInstanceName(params.ctx.onboarding.userId);
  registerWhatsAppInstanceBinding({
    instanceName,
    userId: params.ctx.onboarding.userId,
    onboardingId: params.ctx.onboarding.id,
    companyOnboardingId: null,
    companyName: params.ctx.onboarding.companyName || null,
  });
  const ensured = await ensureOwnWhatsAppInstance(instanceName);
  if (!ensured.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: ensured.error },
        { status: 502, headers: NO_STORE_HEADERS },
      ),
    };
  }

  let providerSnapshot = getOwnWhatsAppSnapshot(instanceName);
  let providerState = normalizeProviderState(providerSnapshot.state);

  if (params.requireQr && !providerSnapshot.qr && providerState !== "open") {
    const qrSnapshot = await acquireProviderSnapshotForQr({
      instanceName,
      snapshot: providerSnapshot,
      state: providerState,
    });
    if (!qrSnapshot.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: qrSnapshot.error },
          { status: 502, headers: NO_STORE_HEADERS },
        ),
      };
    }
    providerSnapshot = qrSnapshot.snapshot;
    providerState = qrSnapshot.state;
  }

  if (providerState === "open") {
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
      whatsappState: providerState,
    };
  }

  if (!providerSnapshot.qr && (providerState === "error" || providerState === "logged_out")) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            providerSnapshot.lastError ||
            "Falha no provider de WhatsApp. Reinicie a sessao e tente novamente.",
        },
        { status: 502, headers: NO_STORE_HEADERS },
      ),
    };
  }

  let qrCodeDataUrl: string | undefined;
  let pairingExpiresAt: string | undefined;

  if (providerSnapshot.qr) {
    qrCodeDataUrl = await QRCode.toDataURL(providerSnapshot.qr, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    pairingExpiresAt = new Date(Date.now() + WHATSAPP_PAIRING_TTL_MS).toISOString();
  }

  const patched = await patchOnboardingAndRefresh({
    ctx: params.ctx,
    patch: {
      ui_step: "whatsapp",
      whatsapp_pairing_code: null,
      whatsapp_pairing_expires_at: pairingExpiresAt || null,
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
    whatsappState: providerState,
    qrCodeDataUrl,
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
        requireQr: false,
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
        providerConfigured: isOwnWhatsAppProviderConfigured(),
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
      const previousLogoObjectPath = extractObjectPathFromPublicUrl(
        ONBOARDING_LOGO_BUCKET,
        ctx.onboarding.companyLogoUrl,
      );
      const nextLogoObjectPath = extractObjectPathFromPublicUrl(
        ONBOARDING_LOGO_BUCKET,
        companyLogoUrl,
      );
      const cnpjDigits = normalizeCnpjDigits(String(body?.companyCnpj || ""));
      const isOnlineBusiness = normalizeBooleanInput(body?.isOnlineBusiness);
      const companyAddress = normalizeAddressText(body?.companyAddress, 180);
      const companyCity = normalizeAddressText(body?.companyCity, 120);
      const companyState = normalizeStateCode(body?.companyState);
      const companyPostalCode = normalizePostalCodeDigits(body?.companyPostalCode);

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
          { ok: false, error: "CNPJ invalido. Verifique os digitos informados." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      if (cnpjDigits && !isValidCnpjDigits(cnpjDigits)) {
        return NextResponse.json(
          { ok: false, error: "CNPJ invalido. Verifique os digitos informados." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      if (!isOnlineBusiness) {
        if (!companyAddress) {
          return NextResponse.json(
            { ok: false, error: "Informe o endereco da empresa." },
            { status: 400, headers: NO_STORE_HEADERS },
          );
        }
        if (!companyCity) {
          return NextResponse.json(
            { ok: false, error: "Informe a cidade da empresa." },
            { status: 400, headers: NO_STORE_HEADERS },
          );
        }
        if (!companyState || companyState.length !== 2) {
          return NextResponse.json(
            { ok: false, error: "Informe o estado (UF) com 2 letras." },
            { status: 400, headers: NO_STORE_HEADERS },
          );
        }
        if (!companyPostalCode || companyPostalCode.length !== 8) {
          return NextResponse.json(
            { ok: false, error: "Informe um CEP valido com 8 digitos." },
            { status: 400, headers: NO_STORE_HEADERS },
          );
        }
      }

      const patched = await patchOnboardingAndRefresh({
        ctx,
        patch: {
          company_name: companyName,
          industry,
          company_logo_url: companyLogoUrl,
          company_cnpj: cnpjDigits,
          is_online_business: isOnlineBusiness,
          company_address: isOnlineBusiness ? null : companyAddress,
          company_city: isOnlineBusiness ? null : companyCity,
          company_state: isOnlineBusiness ? null : companyState,
          company_postal_code: isOnlineBusiness ? null : companyPostalCode,
          welcome_confirmed: true,
          ui_step: resolveUiStepAfterCompanySave(ctx.onboarding),
          completed: ctx.onboarding.whatsappConnected ? ctx.onboarding.completed : false,
          completed_at: ctx.onboarding.whatsappConnected ? ctx.onboarding.completedAt : null,
        },
        fallbackError: "Nao foi possivel salvar os dados da empresa.",
      });
      if (!patched.ok) return patched.response;

      if (previousLogoObjectPath && previousLogoObjectPath !== nextLogoObjectPath) {
        await ctx.sb.storage.from(ONBOARDING_LOGO_BUCKET).remove([previousLogoObjectPath]);
      }

      try {
        await cleanupPrimaryOnboardingLogoFolder({
          sb: ctx.sb,
          userId: ctx.onboarding.userId,
          keepObjectPath: nextLogoObjectPath,
        });
      } catch (cleanupError) {
        console.error("[onboarding] cleanup stale company logos error:", cleanupError);
      }

      return NextResponse.json(
        { ok: true, onboarding: patched.onboarding },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (action === "save-team") {
      if (!hasCompleteCompanyData(ctx.onboarding)) {
        return NextResponse.json(
          { ok: false, error: "Conclua os dados da empresa antes de avancar para o time." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }

      const teamAgentsCount = normalizeTeamAgentsCount(body?.teamAgentsCount);
      const onboardingGoal = normalizeOnboardingGoal(body?.onboardingGoal);
      const monthlyConversationsTier = normalizeMonthlyConversationsTier(body?.monthlyConversationsTier);
      if (!teamAgentsCount || teamAgentsCount < 1 || teamAgentsCount > 5000) {
        return NextResponse.json(
          { ok: false, error: "Quantidade de funcionarios invalida." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      if (!onboardingGoal) {
        return NextResponse.json(
          { ok: false, error: "Selecione o principal objetivo com o WhatsApp." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      if (!monthlyConversationsTier) {
        return NextResponse.json(
          { ok: false, error: "Selecione uma estimativa de conversas por mes." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const patched = await patchOnboardingAndRefresh({
        ctx,
        patch: {
          team_agents_count: teamAgentsCount,
          onboarding_goal: onboardingGoal,
          monthly_conversations_tier: monthlyConversationsTier,
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
          providerConfigured: isOwnWhatsAppProviderConfigured(),
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

      if (uiStep === "team" && !hasCompleteCompanyData(ctx.onboarding)) {
        return NextResponse.json(
          { ok: false, error: "Preencha os dados da empresa antes de seguir para o time." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
      if (uiStep === "whatsapp" && (!hasCompleteCompanyData(ctx.onboarding) || !hasCompleteTeamData(ctx.onboarding))) {
        return NextResponse.json(
          { ok: false, error: "Complete os dados da empresa e do time antes de ir ao WhatsApp." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
      if (uiStep === "final" && !ctx.onboarding.whatsappConnected) {
        return NextResponse.json(
          { ok: false, error: "Conecte o WhatsApp antes de acessar a etapa final." },
          { status: 409, headers: NO_STORE_HEADERS },
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

    if (action === "heartbeat") {
      if (ctx.onboarding.completed) {
        return NextResponse.json(
          { ok: true, onboarding: ctx.onboarding },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }

      const patched = await patchOnboardingAndRefresh({
        ctx,
        patch: {
          welcome_confirmed: Boolean(ctx.onboarding.welcomeConfirmed),
          completed: false,
          completed_at: null,
        },
        fallbackError: "Nao foi possivel atualizar a presenca do onboarding.",
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
          providerConfigured: isOwnWhatsAppProviderConfigured(),
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
          providerConfigured: isOwnWhatsAppProviderConfigured(),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (action === "finish") {
      if (!hasCompleteCompanyData(ctx.onboarding)) {
        return NextResponse.json(
          { ok: false, error: "Dados da empresa incompletos. Revise antes de finalizar." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
      if (!hasCompleteTeamData(ctx.onboarding)) {
        return NextResponse.json(
          { ok: false, error: "Dados do time incompletos. Revise antes de finalizar." },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
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
