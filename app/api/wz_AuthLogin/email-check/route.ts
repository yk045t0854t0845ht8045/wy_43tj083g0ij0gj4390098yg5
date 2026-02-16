import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_supabase";
import { listLoginProvidersForUser } from "../_login_providers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function isValidEmail(v: string) {
  const s = (v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    return clean === "1" || clean === "true" || clean === "t";
  }
  return false;
}

function isMissingColumnError(error: unknown, column: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const needle = String(column || "").trim().toLowerCase();
  if (!needle) return false;
  if (code === "42703" || code === "PGRST204") return true;
  return (
    (message.includes(needle) || details.includes(needle)) &&
    (message.includes("column") || details.includes("column"))
  );
}

type ExternalLoginProvider = "google";

function normalizeExternalProvider(value: unknown): ExternalLoginProvider | null {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "google") return "google";
  return null;
}

function providerLabel(provider: ExternalLoginProvider) {
  if (provider === "google") return "Google";
  return "Provedor";
}

type EmailCheckUserLookup = {
  id: string | null;
  email: string | null;
  phoneE164: string | null;
  authProvider: string | null;
  mustCreatePassword: boolean;
};

async function getWzUserByEmail(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
) {
  const columnsToTry = [
    "id,email,phone_e164,auth_provider,must_create_password",
    "id,email,phone_e164,auth_provider",
    "id,email,phone_e164,must_create_password",
    "id,email,phone_e164",
  ];

  for (const columns of columnsToTry) {
    const res = await sb.from("wz_users").select(columns).eq("email", email).maybeSingle();

    if (!res.error) {
      if (!res.data) return null;
      const row = (res.data || {}) as {
        id?: string | null;
        email?: string | null;
        phone_e164?: string | null;
        auth_provider?: string | null;
        must_create_password?: boolean | number | string | null;
      };

      return {
        id: normalizeText(row.id),
        email: normalizeText(row.email),
        phoneE164: normalizeText(row.phone_e164),
        authProvider: normalizeText(row.auth_provider),
        mustCreatePassword:
          typeof row.must_create_password === "undefined"
            ? false
            : normalizeBoolean(row.must_create_password),
      } as EmailCheckUserLookup;
    }

    const hasMissingColumn = [
      "auth_provider",
      "must_create_password",
      "phone_e164",
      "email",
      "id",
    ].some((column) => isMissingColumnError(res.error, column));
    if (!hasMissingColumn) {
      throw res.error;
    }
  }

  return null;
}

async function resolvePasswordSetupProvider(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId?: string | null;
  authProvider?: string | null;
}) {
  const byColumn = normalizeExternalProvider(params.authProvider);
  if (byColumn) return byColumn;

  const userId = normalizeText(params.userId || null);
  if (!userId) return null;

  const linked = await listLoginProvidersForUser({ sb: params.sb, userId });
  if (!linked.rows?.length) return null;

  for (const row of linked.rows) {
    const provider = normalizeExternalProvider(row.provider);
    if (provider) return provider;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const sb = supabaseAdmin();

    const user = await getWzUserByEmail(sb, email);
    if (!user) {
      return NextResponse.json(
        {
          exists: false,
          hasPhone: false,
          passwordSetupRequired: false,
          provider: null,
          providerLabel: null,
          ctaLabel: null,
          notice: null,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    let provider: ExternalLoginProvider | null = null;
    if (user.mustCreatePassword) {
      provider = await resolvePasswordSetupProvider({
        sb,
        userId: user.id,
        authProvider: user.authProvider,
      });
    }

    const payload = {
      exists: true,
      hasPhone: Boolean(user.phoneE164),
      passwordSetupRequired: Boolean(user.mustCreatePassword && provider),
      provider: provider || null,
      providerLabel: provider ? providerLabel(provider) : null,
      ctaLabel: provider ? "Criar agora" : null,
      notice: provider
        ? "Voce nao cumpriu os requisitos de senha da conta."
        : null,
    };

    return NextResponse.json(payload, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[email-check] error:", error);
    return NextResponse.json({ error: "Falha ao consultar cadastro." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
