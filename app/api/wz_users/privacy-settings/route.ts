import { NextResponse, type NextRequest } from "next/server";
import { readActiveSessionFromRequest } from "@/app/api/wz_AuthLogin/_active_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const PRIVACY_TABLE = "wz_user_privacy_settings";

const DEFAULT_REQUIRED = {
  dataProcessing: true,
  securityAndFraud: true,
  legalCompliance: true,
  transactionalCommunications: true,
} as const;

const DEFAULT_OPTIONAL = {
  productAnalytics: true,
  personalizedExperience: true,
  marketingCommunications: false,
  sponsorMarketing: false,
  thirdPartySponsoredPersonalization: false,
} as const;

type OptionalPreferenceKey = keyof typeof DEFAULT_OPTIONAL;

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
  user_id?: string | null;
};

type PrivacySettingsRow = {
  id?: string | null;
  user_id?: string | null;
  wz_user_id?: string | null;
  email?: string | null;
  required_data_processing?: boolean | string | number | null;
  required_security_and_fraud?: boolean | string | number | null;
  required_legal_compliance?: boolean | string | number | null;
  required_transactional_communications?: boolean | string | number | null;
  optional_product_analytics?: boolean | string | number | null;
  optional_personalized_experience?: boolean | string | number | null;
  optional_marketing_communications?: boolean | string | number | null;
  optional_sponsor_marketing?: boolean | string | number | null;
  optional_third_party_personalization?: boolean | string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const PRIVACY_SELECT_COLUMNS = [
  "id",
  "user_id",
  "wz_user_id",
  "email",
  "required_data_processing",
  "required_security_and_fraud",
  "required_legal_compliance",
  "required_transactional_communications",
  "optional_product_analytics",
  "optional_personalized_experience",
  "optional_marketing_communications",
  "optional_sponsor_marketing",
  "optional_third_party_personalization",
  "created_at",
  "updated_at",
].join(",");

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    if (!clean) return null;
    if (clean === "1" || clean === "true" || clean === "t" || clean === "yes" || clean === "on") {
      return true;
    }
    if (clean === "0" || clean === "false" || clean === "f" || clean === "no" || clean === "off") {
      return false;
    }
  }
  return null;
}

function parseBooleanWithDefault(value: unknown, fallback: boolean) {
  const parsed = parseBooleanLike(value);
  return parsed === null ? fallback : parsed;
}

function normalizeIso(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function isPrivacyTableMissingError(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes(PRIVACY_TABLE) ||
    details.includes(PRIVACY_TABLE) ||
    hint.includes(PRIVACY_TABLE)
  );
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const runSelect = async (columns: string) => {
    const base = params.sb.from("wz_users").select(columns).limit(5);
    if (params.mode === "ilike") {
      return base.ilike(params.column, params.value);
    }
    return base.eq(params.column, params.value);
  };

  const columnsToTry = [
    "id,email,auth_user_id,user_id",
    "id,email,auth_user_id",
    "id,email,user_id",
    "id,email",
  ];

  for (const columns of columnsToTry) {
    const res = await runSelect(columns);
    if (!res.error) {
      return (res.data || []) as WzUserRow[];
    }
    console.error("[privacy-settings] query wz_users error:", res.error);
  }

  return [] as WzUserRow[];
}

function pickBestWzUserRow(rows: WzUserRow[], expectedEmail?: string | null) {
  if (!rows.length) return null;

  const normalizedExpected = normalizeEmail(expectedEmail);
  if (normalizedExpected) {
    const exact = rows.find((row) => normalizeEmail(row.email) === normalizedExpected);
    if (exact?.id) return exact;
  }

  const firstWithId = rows.find((row) => normalizeOptionalText(row.id));
  return firstWithId || null;
}

async function findWzUserRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  email: string;
}) {
  if (params.email) {
    const byEmail = await queryWzUsersRows({
      sb: params.sb,
      column: "email",
      value: params.email,
      mode: "ilike",
    });
    const bestByEmail = pickBestWzUserRow(byEmail, params.email);
    if (bestByEmail?.id) return bestByEmail;
  }

  if (params.userId) {
    const byAuthUserId = await queryWzUsersRows({
      sb: params.sb,
      column: "auth_user_id",
      value: params.userId,
      mode: "eq",
    });
    const bestByAuthUserId = pickBestWzUserRow(byAuthUserId, params.email);
    if (bestByAuthUserId?.id) return bestByAuthUserId;

    const byUserId = await queryWzUsersRows({
      sb: params.sb,
      column: "user_id",
      value: params.userId,
      mode: "eq",
    });
    const bestByUserId = pickBestWzUserRow(byUserId, params.email);
    if (bestByUserId?.id) return bestByUserId;

    const byId = await queryWzUsersRows({
      sb: params.sb,
      column: "id",
      value: params.userId,
      mode: "eq",
    });
    const bestById = pickBestWzUserRow(byId, params.email);
    if (bestById?.id) return bestById;
  }

  return null;
}

async function findPrivacySettingsRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  wzUserId: string | null;
  email: string;
}) {
  if (params.userId) {
    const byUserId = await params.sb
      .from(PRIVACY_TABLE)
      .select(PRIVACY_SELECT_COLUMNS)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (byUserId.error) {
      if (isPrivacyTableMissingError(byUserId.error)) throw byUserId.error;
      console.error("[privacy-settings] query by user_id error:", byUserId.error);
    } else if (byUserId.data) {
      return byUserId.data as PrivacySettingsRow;
    }
  }

  if (params.wzUserId) {
    const byWzUserId = await params.sb
      .from(PRIVACY_TABLE)
      .select(PRIVACY_SELECT_COLUMNS)
      .eq("wz_user_id", params.wzUserId)
      .limit(1)
      .maybeSingle();

    if (byWzUserId.error) {
      if (isPrivacyTableMissingError(byWzUserId.error)) throw byWzUserId.error;
      console.error("[privacy-settings] query by wz_user_id error:", byWzUserId.error);
    } else if (byWzUserId.data) {
      return byWzUserId.data as PrivacySettingsRow;
    }
  }

  if (params.email) {
    const byEmail = await params.sb
      .from(PRIVACY_TABLE)
      .select(PRIVACY_SELECT_COLUMNS)
      .ilike("email", params.email)
      .limit(1)
      .maybeSingle();

    if (byEmail.error) {
      if (isPrivacyTableMissingError(byEmail.error)) throw byEmail.error;
      console.error("[privacy-settings] query by email error:", byEmail.error);
    } else if (byEmail.data) {
      return byEmail.data as PrivacySettingsRow;
    }
  }

  return null;
}

function buildDefaultPrivacyInsert(params: {
  userId: string;
  wzUserId: string | null;
  email: string;
}) {
  return {
    user_id: params.userId,
    wz_user_id: params.wzUserId,
    email: params.email,
    required_data_processing: DEFAULT_REQUIRED.dataProcessing,
    required_security_and_fraud: DEFAULT_REQUIRED.securityAndFraud,
    required_legal_compliance: DEFAULT_REQUIRED.legalCompliance,
    required_transactional_communications: DEFAULT_REQUIRED.transactionalCommunications,
    optional_product_analytics: DEFAULT_OPTIONAL.productAnalytics,
    optional_personalized_experience: DEFAULT_OPTIONAL.personalizedExperience,
    optional_marketing_communications: DEFAULT_OPTIONAL.marketingCommunications,
    optional_sponsor_marketing: DEFAULT_OPTIONAL.sponsorMarketing,
    optional_third_party_personalization: DEFAULT_OPTIONAL.thirdPartySponsoredPersonalization,
  };
}

async function ensurePrivacySettingsRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  wzUserId: string | null;
  email: string;
}) {
  const existing = await findPrivacySettingsRow(params);
  if (existing?.id) return existing;

  const insertPayload = buildDefaultPrivacyInsert(params);
  const inserted = await params.sb
    .from(PRIVACY_TABLE)
    .insert(insertPayload)
    .select(PRIVACY_SELECT_COLUMNS)
    .maybeSingle();

  if (inserted.error) throw inserted.error;
  if (!inserted.data) throw new Error("privacy_settings_insert_empty");
  return inserted.data as PrivacySettingsRow;
}

function mapOptionalPayload(row?: PrivacySettingsRow | null) {
  return {
    productAnalytics: parseBooleanWithDefault(
      row?.optional_product_analytics,
      DEFAULT_OPTIONAL.productAnalytics,
    ),
    personalizedExperience: parseBooleanWithDefault(
      row?.optional_personalized_experience,
      DEFAULT_OPTIONAL.personalizedExperience,
    ),
    marketingCommunications: parseBooleanWithDefault(
      row?.optional_marketing_communications,
      DEFAULT_OPTIONAL.marketingCommunications,
    ),
    sponsorMarketing: parseBooleanWithDefault(
      row?.optional_sponsor_marketing,
      DEFAULT_OPTIONAL.sponsorMarketing,
    ),
    thirdPartySponsoredPersonalization: parseBooleanWithDefault(
      row?.optional_third_party_personalization,
      DEFAULT_OPTIONAL.thirdPartySponsoredPersonalization,
    ),
  };
}

function mapRequiredPayload(row?: PrivacySettingsRow | null) {
  return {
    dataProcessing: parseBooleanWithDefault(
      row?.required_data_processing,
      DEFAULT_REQUIRED.dataProcessing,
    ),
    securityAndFraud: parseBooleanWithDefault(
      row?.required_security_and_fraud,
      DEFAULT_REQUIRED.securityAndFraud,
    ),
    legalCompliance: parseBooleanWithDefault(
      row?.required_legal_compliance,
      DEFAULT_REQUIRED.legalCompliance,
    ),
    transactionalCommunications: parseBooleanWithDefault(
      row?.required_transactional_communications,
      DEFAULT_REQUIRED.transactionalCommunications,
    ),
  };
}

function buildSettingsResponse(row: PrivacySettingsRow) {
  return {
    required: mapRequiredPayload(row),
    optional: mapOptionalPayload(row),
    updatedAt: normalizeIso(row.updated_at || row.created_at) || new Date().toISOString(),
  };
}

function parseOptionalPatch(body: Record<string, unknown>) {
  const source =
    body.optional && typeof body.optional === "object"
      ? (body.optional as Record<string, unknown>)
      : body;
  const out: Partial<Record<OptionalPreferenceKey, boolean>> = {};

  const map: Array<[OptionalPreferenceKey, string]> = [
    ["productAnalytics", "productAnalytics"],
    ["personalizedExperience", "personalizedExperience"],
    ["marketingCommunications", "marketingCommunications"],
    ["sponsorMarketing", "sponsorMarketing"],
    ["thirdPartySponsoredPersonalization", "thirdPartySponsoredPersonalization"],
  ];

  for (const [targetKey, sourceKey] of map) {
    if (!(sourceKey in source)) continue;
    const parsed = parseBooleanLike(source[sourceKey]);
    if (parsed === null) {
      throw new Error(`Valor invalido para ${sourceKey}.`);
    }
    out[targetKey] = parsed;
  }

  return out;
}

function validateRequiredPatch(body: Record<string, unknown>) {
  const source =
    body.required && typeof body.required === "object"
      ? (body.required as Record<string, unknown>)
      : null;
  if (!source) return;

  const map: Array<[string, keyof typeof DEFAULT_REQUIRED]> = [
    ["dataProcessing", "dataProcessing"],
    ["securityAndFraud", "securityAndFraud"],
    ["legalCompliance", "legalCompliance"],
    ["transactionalCommunications", "transactionalCommunications"],
  ];

  for (const [sourceKey, requiredKey] of map) {
    if (!(sourceKey in source)) continue;
    const parsed = parseBooleanLike(source[sourceKey]);
    if (parsed === null) {
      throw new Error(`Valor invalido para ${sourceKey}.`);
    }
    if (parsed !== DEFAULT_REQUIRED[requiredKey]) {
      throw new Error("Alguns tratamentos sao obrigatorios e nao podem ser desativados.");
    }
  }
}

async function resolveAuthenticatedBase(req: NextRequest) {
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

  const sb = supabaseAdmin();
  const userId = String(session.userId || "").trim();
  const email = normalizeEmail(session.email);

  const userRow = await findWzUserRow({
    sb,
    userId,
    email,
  });

  if (!userRow?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Usuario nao encontrado." },
        { status: 404, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true as const,
    sb,
    userId,
    email,
    wzUserId: normalizeOptionalText(userRow.id),
  };
}

export async function GET(req: NextRequest) {
  try {
    const base = await resolveAuthenticatedBase(req);
    if (!base.ok) return base.response;

    const row = await ensurePrivacySettingsRow({
      sb: base.sb,
      userId: base.userId,
      wzUserId: base.wzUserId,
      email: base.email,
    });

    return NextResponse.json(
      {
        ok: true,
        settings: buildSettingsResponse(row),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (isPrivacyTableMissingError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tabela wz_user_privacy_settings ausente. Execute o SQL em sql/wz_user_privacy_settings_create.sql.",
        },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    console.error("[privacy-settings] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao consultar preferencias de privacidade." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const base = await resolveAuthenticatedBase(req);
    if (!base.ok) return base.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    validateRequiredPatch(body);
    const optionalPatch = parseOptionalPatch(body);

    const current = await ensurePrivacySettingsRow({
      sb: base.sb,
      userId: base.userId,
      wzUserId: base.wzUserId,
      email: base.email,
    });

    if (!Object.keys(optionalPatch).length) {
      return NextResponse.json(
        {
          ok: true,
          settings: buildSettingsResponse(current),
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const updatePayload: Record<string, unknown> = {
      user_id: base.userId,
      wz_user_id: base.wzUserId,
      email: base.email,
    };

    if (typeof optionalPatch.productAnalytics === "boolean") {
      updatePayload.optional_product_analytics = optionalPatch.productAnalytics;
    }
    if (typeof optionalPatch.personalizedExperience === "boolean") {
      updatePayload.optional_personalized_experience = optionalPatch.personalizedExperience;
    }
    if (typeof optionalPatch.marketingCommunications === "boolean") {
      updatePayload.optional_marketing_communications = optionalPatch.marketingCommunications;
    }
    if (typeof optionalPatch.sponsorMarketing === "boolean") {
      updatePayload.optional_sponsor_marketing = optionalPatch.sponsorMarketing;
    }
    if (typeof optionalPatch.thirdPartySponsoredPersonalization === "boolean") {
      updatePayload.optional_third_party_personalization =
        optionalPatch.thirdPartySponsoredPersonalization;
    }

    const updated = await base.sb
      .from(PRIVACY_TABLE)
      .update(updatePayload)
      .eq("id", String(current.id))
      .select(PRIVACY_SELECT_COLUMNS)
      .maybeSingle();

    if (updated.error) throw updated.error;
    if (!updated.data) throw new Error("privacy_settings_update_empty");

    return NextResponse.json(
      {
        ok: true,
        settings: buildSettingsResponse(updated.data as PrivacySettingsRow),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof Error && error.message) {
      if (error.message.includes("Valor invalido")) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      if (
        error.message.includes("tratamentos sao obrigatorios") ||
        error.message.includes("tratamentos sao obrigatorios")
      ) {
        return NextResponse.json(
          { ok: false, error: "Tratamentos obrigatorios nao podem ser desativados." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
    }

    if (isPrivacyTableMissingError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tabela wz_user_privacy_settings ausente. Execute o SQL em sql/wz_user_privacy_settings_create.sql.",
        },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    console.error("[privacy-settings] PUT error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao atualizar preferencias de privacidade." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
