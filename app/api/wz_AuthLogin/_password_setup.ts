import {
  listLoginProvidersForUser,
  normalizeLoginProvider,
} from "./_login_providers";
import { supabaseAdmin } from "./_supabase";

export type ExternalLoginProvider = "google";

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeEmail(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  return clean || null;
}

function normalizeAuthProviderName(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeExternalProvider(value: unknown): ExternalLoginProvider | null {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "google") return "google";
  return null;
}

function readAuthUserHasPasswordProvider(user: unknown) {
  const candidate =
    user && typeof user === "object"
      ? (user as {
          app_metadata?: Record<string, unknown> | null;
          identities?: Array<Record<string, unknown>> | null;
        })
      : null;
  if (!candidate) return false;

  const appProvider = normalizeAuthProviderName(candidate.app_metadata?.provider);
  if (appProvider === "email" || appProvider === "password") {
    return true;
  }

  const appProvidersRaw = candidate.app_metadata?.providers;
  if (Array.isArray(appProvidersRaw)) {
    for (const provider of appProvidersRaw) {
      const normalized = normalizeAuthProviderName(provider);
      if (normalized === "email" || normalized === "password") {
        return true;
      }
    }
  }

  const identities = Array.isArray(candidate.identities) ? candidate.identities : [];
  for (const identity of identities) {
    const provider = normalizeAuthProviderName(identity?.provider);
    if (provider === "email" || provider === "password") {
      return true;
    }
  }

  return false;
}

async function findAuthUserIdByEmail(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string | null;
}) {
  const email = normalizeEmail(params.email);
  if (!email) {
    return {
      lookupOk: false as const,
      authUserId: null as string | null,
    };
  }

  const PER_PAGE = 200;
  const MAX_PAGES = 20;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await params.sb.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) {
      console.error("[password-setup] listUsers error:", error);
      return {
        lookupOk: false as const,
        authUserId: null as string | null,
      };
    }

    const users = (data?.users || []) as Array<{
      id?: string | null;
      email?: string | null;
    }>;
    const found = users.find((user) => normalizeEmail(user.email) === email);
    if (found?.id) {
      return {
        lookupOk: true as const,
        authUserId: normalizeText(found.id),
      };
    }
    if (users.length < PER_PAGE) break;
  }

  return {
    lookupOk: true as const,
    authUserId: null as string | null,
  };
}

async function getAuthUserProviderSignals(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  authUserId: string | null;
  email: string | null;
}) {
  let authUserId = normalizeText(params.authUserId);
  if (!authUserId) {
    const byEmail = await findAuthUserIdByEmail({
      sb: params.sb,
      email: params.email,
    });
    if (!byEmail.lookupOk) {
      return {
        lookupOk: false as const,
        authUserId: null as string | null,
        hasPasswordProvider: false,
      };
    }
    authUserId = byEmail.authUserId;
    if (!authUserId) {
      return {
        lookupOk: true as const,
        authUserId: null as string | null,
        hasPasswordProvider: false,
      };
    }
  }

  try {
    const { data, error } = await params.sb.auth.admin.getUserById(authUserId);
    if (error) {
      console.error("[password-setup] getUserById error:", error);
      return {
        lookupOk: false as const,
        authUserId: null as string | null,
        hasPasswordProvider: false,
      };
    }

    return {
      lookupOk: true as const,
      authUserId,
      hasPasswordProvider: readAuthUserHasPasswordProvider(data?.user || null),
    };
  } catch (error) {
    console.error("[password-setup] getAuthUserProviderSignals error:", error);
    return {
      lookupOk: false as const,
      authUserId: null as string | null,
      hasPasswordProvider: false,
    };
  }
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

export async function updateMustCreatePasswordBestEffort(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId?: string | null;
  mustCreatePassword: boolean;
}) {
  const userId = normalizeText(params.userId);
  if (!userId) return;

  const updateRes = await params.sb
    .from("wz_users")
    .update({ must_create_password: params.mustCreatePassword })
    .eq("id", userId);

  if (!updateRes.error) return;
  if (isMissingColumnError(updateRes.error, "must_create_password")) return;
  console.error("[password-setup] must_create_password update error:", updateRes.error);
}

export function externalProviderLabel(provider: ExternalLoginProvider) {
  if (provider === "google") return "Google";
  return "Provedor";
}

export type PasswordSetupResolution = {
  shouldRequireSetup: boolean;
  shouldAutoClearMustCreatePassword: boolean;
  hasPasswordProvider: boolean;
  providerForSetup: ExternalLoginProvider | null;
};

export async function resolvePasswordSetupRequirement(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId?: string | null;
  email?: string | null;
  authUserId?: string | null;
  authProvider?: string | null;
  mustCreatePassword: boolean;
}): Promise<PasswordSetupResolution> {
  const mustCreatePassword = Boolean(params.mustCreatePassword);
  const userId = normalizeText(params.userId);
  const authProviderByColumn = normalizeExternalProvider(params.authProvider);

  let hasPersistedPasswordProvider = false;
  let providerFromLinkedRows: ExternalLoginProvider | null = null;

  if (userId) {
    const providerRows = await listLoginProvidersForUser({
      sb: params.sb,
      userId,
    });

    for (const row of providerRows.rows) {
      const provider = normalizeLoginProvider(row.provider);
      if (provider === "password") {
        hasPersistedPasswordProvider = true;
        continue;
      }

      if (!providerFromLinkedRows) {
        const external = normalizeExternalProvider(provider);
        if (external) providerFromLinkedRows = external;
      }
    }
  }

  let hasPasswordProvider = false;
  if (mustCreatePassword) {
    const authSignals = await getAuthUserProviderSignals({
      sb: params.sb,
      authUserId: normalizeText(params.authUserId),
      email: normalizeEmail(params.email),
    });

    if (authSignals.lookupOk) {
      // Prioriza sinal do Auth, mas aceita o provedor persistido local como fallback
      // para evitar falso-positivo de "criar senha novamente" após fluxo concluído.
      hasPasswordProvider =
        authSignals.hasPasswordProvider || hasPersistedPasswordProvider;
    } else {
      hasPasswordProvider = hasPersistedPasswordProvider;
    }
  }

  const providerForSetup = authProviderByColumn || providerFromLinkedRows;
  const shouldAutoClearMustCreatePassword = mustCreatePassword && hasPasswordProvider;
  const shouldRequireSetup =
    mustCreatePassword && !hasPasswordProvider && Boolean(providerForSetup);

  return {
    shouldRequireSetup,
    shouldAutoClearMustCreatePassword,
    hasPasswordProvider,
    providerForSetup,
  };
}
