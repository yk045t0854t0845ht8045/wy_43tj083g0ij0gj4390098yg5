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
const WHATSAPP_PAIRING_TTL_MS = 1000 * 60 * 10;

type OnboardingAction =
  | "save-company"
  | "save-team"
  | "set-step"
  | "generate-whatsapp-qr"
  | "confirm-whatsapp"
  | "finish";

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

function createWhatsAppPairingCode() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

function resolveDashboardOrigin() {
  const configured = String(process.env.DASHBOARD_ORIGIN || "").trim();
  if (configured) return configured;
  return "https://dashboard.wyzer.com.br";
}

function resolveBridgeBase() {
  const configured = String(process.env.WHATSAPP_BRIDGE_URL || "").trim();
  if (configured) return configured;
  return resolveDashboardOrigin();
}

function buildWhatsAppPairingUrl(params: { pairingCode: string; userId: string }) {
  const bridgeBase = resolveBridgeBase();
  const pairingUrl = new URL("/onboarding/whatsapp/connect", bridgeBase);
  pairingUrl.searchParams.set("code", params.pairingCode);
  pairingUrl.searchParams.set("uid", params.userId);
  pairingUrl.searchParams.set("at", String(Date.now()));
  return pairingUrl.toString();
}

async function buildWhatsAppQrPayload(params: {
  pairingCode: string;
  userId: string;
  pairingExpiresAt: string;
}) {
  const pairingUrl = buildWhatsAppPairingUrl({
    pairingCode: params.pairingCode,
    userId: params.userId,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(pairingUrl, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return {
    qrCodeDataUrl,
    pairingCode: params.pairingCode,
    pairingExpiresAt: params.pairingExpiresAt,
    pairingUrl,
  };
}

function isWhatsAppPairingStillValid(onboarding: OnboardingRecord) {
  const pairingCode = normalizeOptionalText(onboarding.whatsappPairingCode);
  if (!pairingCode) return false;
  const expiresAt = normalizeOptionalText(onboarding.whatsappPairingExpiresAt);
  if (!expiresAt) return false;
  const expiresAtTs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtTs)) return false;
  return expiresAtTs > Date.now();
}

type ResolvedOnboardingContext = {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId: string;
  sessionEmail: string;
  onboarding: OnboardingRecord;
};

async function generateAndPersistWhatsAppPairing(ctx: ResolvedOnboardingContext) {
  const pairingCode = createWhatsAppPairingCode();
  const pairingExpiresAt = new Date(Date.now() + WHATSAPP_PAIRING_TTL_MS).toISOString();
  const qrPayload = await buildWhatsAppQrPayload({
    pairingCode,
    userId: ctx.onboarding.userId,
    pairingExpiresAt,
  });

  const updated = await patchOnboardingRecord({
    sb: ctx.sb,
    recordId: ctx.onboarding.id,
    patch: {
      ui_step: "whatsapp",
      whatsapp_pairing_code: pairingCode,
      whatsapp_pairing_expires_at: pairingExpiresAt,
      whatsapp_connected: false,
      whatsapp_connected_at: null,
      completed: false,
      completed_at: null,
    },
  });

  if (!updated.ok) {
    const status = updated.schemaReady === false ? 500 : 400;
    const errorMessage =
      updated.schemaReady === false
        ? ONBOARDING_SCHEMA_HINT
        : getErrorMessage(updated.error, "Nao foi possivel gerar QR Code do WhatsApp.");
    if (updated.schemaReady !== false) {
      console.error("[onboarding] generate-whatsapp-qr update error:", updated.error);
    }
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: errorMessage },
        { status, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const refreshed = await ensureOnboardingRecord({
    sb: ctx.sb,
    sessionUserId: ctx.sessionUserId,
    sessionEmail: ctx.sessionEmail,
  });

  if (!refreshed.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Nao foi possivel recarregar onboarding apos gerar QR." },
        { status: 500, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    onboarding: refreshed.record,
    ...qrPayload,
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
    let pairingUrl: string | undefined;

    const shouldPrepareWhatsAppQr =
      !onboarding.completed &&
      !onboarding.whatsappConnected &&
      onboarding.uiStep === "whatsapp";

    if (shouldPrepareWhatsAppQr) {
      if (isWhatsAppPairingStillValid(onboarding)) {
        const currentPairingCode = String(onboarding.whatsappPairingCode || "").trim().toUpperCase();
        const currentPairingExpiresAt = String(onboarding.whatsappPairingExpiresAt || "").trim();
        const qrPayload = await buildWhatsAppQrPayload({
          pairingCode: currentPairingCode,
          userId: onboarding.userId,
          pairingExpiresAt: currentPairingExpiresAt,
        });
        qrCodeDataUrl = qrPayload.qrCodeDataUrl;
        pairingCode = qrPayload.pairingCode;
        pairingExpiresAt = qrPayload.pairingExpiresAt;
        pairingUrl = qrPayload.pairingUrl;
      } else {
        const generated = await generateAndPersistWhatsAppPairing({
          sb: ctx.sb,
          sessionUserId: ctx.sessionUserId,
          sessionEmail: ctx.sessionEmail,
          onboarding,
        });
        if (!generated.ok) return generated.response;
        onboarding = generated.onboarding;
        qrCodeDataUrl = generated.qrCodeDataUrl;
        pairingCode = generated.pairingCode;
        pairingExpiresAt = generated.pairingExpiresAt;
        pairingUrl = generated.pairingUrl;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        onboarding,
        qrCodeDataUrl,
        pairingCode,
        pairingExpiresAt,
        pairingUrl,
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

      const updated = await patchOnboardingRecord({
        sb: ctx.sb,
        recordId: ctx.onboarding.id,
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
      });

      if (!updated.ok) {
        const status = updated.schemaReady === false ? 500 : 400;
        const errorMessage =
          updated.schemaReady === false
            ? ONBOARDING_SCHEMA_HINT
            : getErrorMessage(updated.error, "Nao foi possivel salvar os dados da empresa.");
        if (updated.schemaReady !== false) {
          console.error("[onboarding] save-company update error:", updated.error);
        }
        return NextResponse.json(
          { ok: false, error: errorMessage },
          { status, headers: NO_STORE_HEADERS },
        );
      }

      const refreshed = await ensureOnboardingRecord({
        sb: ctx.sb,
        sessionUserId: ctx.sessionUserId,
        sessionEmail: ctx.sessionEmail,
      });
      if (!refreshed.ok) {
        return NextResponse.json(
          { ok: false, error: "Nao foi possivel recarregar onboarding apos salvar." },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        { ok: true, onboarding: refreshed.record },
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

      const updated = await patchOnboardingRecord({
        sb: ctx.sb,
        recordId: ctx.onboarding.id,
        patch: {
          team_agents_count: teamAgentsCount,
          ui_step: "whatsapp",
        },
      });
      if (!updated.ok) {
        const status = updated.schemaReady === false ? 500 : 400;
        const errorMessage =
          updated.schemaReady === false
            ? ONBOARDING_SCHEMA_HINT
            : getErrorMessage(updated.error, "Nao foi possivel salvar os dados do time.");
        if (updated.schemaReady !== false) {
          console.error("[onboarding] save-team update error:", updated.error);
        }
        return NextResponse.json(
          { ok: false, error: errorMessage },
          { status, headers: NO_STORE_HEADERS },
        );
      }

      const refreshed = await ensureOnboardingRecord({
        sb: ctx.sb,
        sessionUserId: ctx.sessionUserId,
        sessionEmail: ctx.sessionEmail,
      });
      if (!refreshed.ok) {
        return NextResponse.json(
          { ok: false, error: "Nao foi possivel recarregar onboarding apos salvar time." },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        { ok: true, onboarding: refreshed.record },
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

      const updated = await patchOnboardingRecord({
        sb: ctx.sb,
        recordId: ctx.onboarding.id,
        patch: {
          ui_step: uiStep,
        },
      });
      if (!updated.ok) {
        const status = updated.schemaReady === false ? 500 : 400;
        const errorMessage =
          updated.schemaReady === false
            ? ONBOARDING_SCHEMA_HINT
            : getErrorMessage(updated.error, "Nao foi possivel atualizar etapa.");
        if (updated.schemaReady !== false) {
          console.error("[onboarding] set-step update error:", updated.error);
        }
        return NextResponse.json(
          { ok: false, error: errorMessage },
          { status, headers: NO_STORE_HEADERS },
        );
      }

      const refreshed = await ensureOnboardingRecord({
        sb: ctx.sb,
        sessionUserId: ctx.sessionUserId,
        sessionEmail: ctx.sessionEmail,
      });
      if (!refreshed.ok) {
        return NextResponse.json(
          { ok: false, error: "Nao foi possivel recarregar onboarding apos atualizar etapa." },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        { ok: true, onboarding: refreshed.record },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (action === "generate-whatsapp-qr") {
      const generated = await generateAndPersistWhatsAppPairing({
        sb: ctx.sb,
        sessionUserId: ctx.sessionUserId,
        sessionEmail: ctx.sessionEmail,
        onboarding: ctx.onboarding,
      });
      if (!generated.ok) return generated.response;

      return NextResponse.json(
        {
          ok: true,
          onboarding: generated.onboarding,
          qrCodeDataUrl: generated.qrCodeDataUrl,
          pairingCode: generated.pairingCode,
          pairingExpiresAt: generated.pairingExpiresAt,
          pairingUrl: generated.pairingUrl,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    if (action === "confirm-whatsapp") {
      const inputPairingCode = normalizeOptionalText(String(body?.pairingCode || ""))?.toUpperCase() || null;
      const recordPairingCode = normalizeOptionalText(ctx.onboarding.whatsappPairingCode)?.toUpperCase() || null;

      if (recordPairingCode && inputPairingCode && recordPairingCode !== inputPairingCode) {
        return NextResponse.json(
          { ok: false, error: "Codigo de pareamento invalido." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      if (ctx.onboarding.whatsappPairingExpiresAt) {
        const expiresAtTs = Date.parse(ctx.onboarding.whatsappPairingExpiresAt);
        if (Number.isFinite(expiresAtTs) && expiresAtTs < Date.now()) {
          return NextResponse.json(
            { ok: false, error: "QR Code expirado. Gere um novo QR para conectar." },
            { status: 409, headers: NO_STORE_HEADERS },
          );
        }
      }

      const updated = await patchOnboardingRecord({
        sb: ctx.sb,
        recordId: ctx.onboarding.id,
        patch: {
          ui_step: "final",
          whatsapp_connected: true,
          whatsapp_connected_at: nowIso,
          completed: true,
          completed_at: nowIso,
        },
      });
      if (!updated.ok) {
        const status = updated.schemaReady === false ? 500 : 400;
        const errorMessage =
          updated.schemaReady === false
            ? ONBOARDING_SCHEMA_HINT
            : getErrorMessage(updated.error, "Nao foi possivel confirmar conexao WhatsApp.");
        if (updated.schemaReady !== false) {
          console.error("[onboarding] confirm-whatsapp update error:", updated.error);
        }
        return NextResponse.json(
          { ok: false, error: errorMessage },
          { status, headers: NO_STORE_HEADERS },
        );
      }

      const refreshed = await ensureOnboardingRecord({
        sb: ctx.sb,
        sessionUserId: ctx.sessionUserId,
        sessionEmail: ctx.sessionEmail,
      });
      if (!refreshed.ok) {
        return NextResponse.json(
          { ok: false, error: "Nao foi possivel recarregar onboarding apos confirmar WhatsApp." },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        { ok: true, onboarding: refreshed.record },
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

      const updated = await patchOnboardingRecord({
        sb: ctx.sb,
        recordId: ctx.onboarding.id,
        patch: {
          ui_step: "final",
          completed: true,
          completed_at: nowIso,
        },
      });
      if (!updated.ok) {
        const status = updated.schemaReady === false ? 500 : 400;
        const errorMessage =
          updated.schemaReady === false
            ? ONBOARDING_SCHEMA_HINT
            : getErrorMessage(updated.error, "Nao foi possivel concluir onboarding.");
        if (updated.schemaReady !== false) {
          console.error("[onboarding] finish update error:", updated.error);
        }
        return NextResponse.json(
          { ok: false, error: errorMessage },
          { status, headers: NO_STORE_HEADERS },
        );
      }

      const refreshed = await ensureOnboardingRecord({
        sb: ctx.sb,
        sessionUserId: ctx.sessionUserId,
        sessionEmail: ctx.sessionEmail,
      });
      if (!refreshed.ok) {
        return NextResponse.json(
          { ok: false, error: "Nao foi possivel recarregar onboarding apos concluir." },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        { ok: true, onboarding: refreshed.record },
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
