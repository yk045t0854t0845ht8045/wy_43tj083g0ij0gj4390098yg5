import { supabaseAdmin } from "./_supabase";

export type LoginProvider =
  | "password"
  | "google"
  | "azure"
  | "apple"
  | "github"
  | "unknown";

type LoginProviderRow = {
  id?: string | null;
  user_id?: string | null;
  auth_user_id?: string | null;
  email?: string | null;
  provider?: string | null;
  provider_user_id?: string | null;
  linked_at?: string | null;
  last_login_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeEmail(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  return clean || null;
}

function normalizeIso(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const ms = Date.parse(clean);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function normalizeLoginProvider(value?: string | null): LoginProvider {
  const clean = String(value || "").trim().toLowerCase();
  if (
    clean === "password" ||
    clean === "google" ||
    clean === "azure" ||
    clean === "apple" ||
    clean === "github"
  ) {
    return clean;
  }
  return "unknown";
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

function isMissingTableError(error: unknown, table: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const needle = String(table || "").trim().toLowerCase();
  if (!needle) return false;
  if (code === "42P01" || code === "PGRST205") return true;
  return (
    (message.includes(needle) || details.includes(needle)) &&
    (message.includes("does not exist") ||
      details.includes("does not exist") ||
      message.includes("relation") ||
      details.includes("relation") ||
      message.includes("table") ||
      details.includes("table"))
  );
}

function isLoginProvidersSchemaMissing(error: unknown) {
  return (
    isMissingTableError(error, "wz_auth_login_providers") ||
    isMissingColumnError(error, "user_id") ||
    isMissingColumnError(error, "provider") ||
    isMissingColumnError(error, "email")
  );
}

export function isLoginProvidersSchemaMissingError(error: unknown) {
  return isLoginProvidersSchemaMissing(error);
}

function isUniqueViolation(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key") || details.includes("duplicate key");
}

function getUniqueConstraintText(error: unknown) {
  const message = String((error as { message?: unknown } | null)?.message || "");
  const details = String((error as { details?: unknown } | null)?.details || "");
  const hint = String((error as { hint?: unknown } | null)?.hint || "");
  const constraint = String((error as { constraint?: unknown } | null)?.constraint || "");
  return [message, details, hint, constraint].join(" ").toLowerCase();
}

function isExternalIdentityUniqueViolation(error: unknown) {
  if (!isUniqueViolation(error)) return false;
  const text = getUniqueConstraintText(error);
  return (
    text.includes("wz_auth_login_providers_provider_auth_uidx") ||
    text.includes("wz_auth_login_providers_provider_user_uidx") ||
    text.includes("(provider, auth_user_id)") ||
    text.includes("(provider, provider_user_id)")
  );
}

function isExternalOAuthProvider(provider: LoginProvider) {
  return (
    provider === "google" ||
    provider === "azure" ||
    provider === "apple" ||
    provider === "github"
  );
}

export async function upsertLoginProviderRecord(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  authUserId?: string | null;
  email: string;
  provider: LoginProvider | string;
  providerUserId?: string | null;
  metadata?: Record<string, unknown> | null;
  nowIso?: string;
}) {
  const userId = String(params.userId || "").trim();
  const email = normalizeEmail(params.email);
  const provider = normalizeLoginProvider(params.provider);
  const nowIso = normalizeIso(params.nowIso) || new Date().toISOString();
  const authUserId = normalizeText(params.authUserId || null);
  const providerUserId = normalizeText(params.providerUserId || null);

  if (!userId || !email) {
    return { ok: false as const, schemaReady: true as const, reason: "invalid" as const };
  }

  const basePayload = {
    auth_user_id: authUserId,
    email,
    provider_user_id: providerUserId,
    last_login_at: nowIso,
    metadata: params.metadata || {},
    updated_at: nowIso,
  };

  if (isExternalOAuthProvider(provider)) {
    const identityLookup = await findLinkedUserByProviderIdentity({
      sb: params.sb,
      provider,
      authUserId,
      providerUserId,
      email,
      allowEmailFallback: true,
      emailFallbackMode: "legacy-only",
    });

    if (!identityLookup.lookupOk) {
      if (!identityLookup.schemaReady) {
        return {
          ok: false as const,
          schemaReady: false as const,
          reason: "schema-missing" as const,
        };
      }
      return {
        ok: false as const,
        schemaReady: true as const,
        reason: "lookup-failed" as const,
      };
    }

    if (identityLookup.conflict) {
      return {
        ok: false as const,
        schemaReady: true as const,
        reason: "identity-conflict" as const,
        conflictUserId: null as string | null,
      };
    }

    if (identityLookup.userId && identityLookup.userId !== userId) {
      return {
        ok: false as const,
        schemaReady: true as const,
        reason: "identity-conflict" as const,
        conflictUserId: identityLookup.userId,
      };
    }
  }

  try {
    const lookup = await params.sb
      .from("wz_auth_login_providers")
      .select("id,linked_at")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();

    if (lookup.error) throw lookup.error;

    if (lookup.data?.id) {
      const updateRes = await params.sb
        .from("wz_auth_login_providers")
        .update(basePayload)
        .eq("id", String(lookup.data.id))
        .select("id")
        .single();

      if (updateRes.error) throw updateRes.error;
      return { ok: true as const, schemaReady: true as const, id: String(updateRes.data.id) };
    }

    const insertRes = await params.sb
      .from("wz_auth_login_providers")
      .insert({
        user_id: userId,
        provider,
        linked_at: nowIso,
        created_at: nowIso,
        ...basePayload,
      })
      .select("id")
      .single();

    if (insertRes.error) throw insertRes.error;
    return { ok: true as const, schemaReady: true as const, id: String(insertRes.data.id) };
  } catch (error) {
    if (isLoginProvidersSchemaMissing(error)) {
      return { ok: false as const, schemaReady: false as const, reason: "schema-missing" as const };
    }
    if (isUniqueViolation(error)) {
      // Handles concurrent insert for the same user/provider pair.
      const lookupAfterUnique = await params.sb
        .from("wz_auth_login_providers")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", provider)
        .maybeSingle();

      if (!lookupAfterUnique.error && lookupAfterUnique.data?.id) {
        const retryUpdate = await params.sb
          .from("wz_auth_login_providers")
          .update(basePayload)
          .eq("id", String(lookupAfterUnique.data.id))
          .select("id")
          .single();

        if (!retryUpdate.error && retryUpdate.data?.id) {
          return { ok: true as const, schemaReady: true as const, id: String(retryUpdate.data.id) };
        }
      }

      if (isExternalOAuthProvider(provider)) {
        const identityLookup = await findLinkedUserByProviderIdentity({
          sb: params.sb,
          provider,
          authUserId,
          providerUserId,
          email,
          allowEmailFallback: true,
          emailFallbackMode: "legacy-only",
        });

        if (identityLookup.lookupOk) {
          if (identityLookup.conflict) {
            return {
              ok: false as const,
              schemaReady: true as const,
              reason: "identity-conflict" as const,
              conflictUserId: null as string | null,
            };
          }
          if (identityLookup.userId && identityLookup.userId !== userId) {
            return {
              ok: false as const,
              schemaReady: true as const,
              reason: "identity-conflict" as const,
              conflictUserId: identityLookup.userId,
            };
          }
        }

        if (isExternalIdentityUniqueViolation(error)) {
          return {
            ok: false as const,
            schemaReady: true as const,
            reason: "identity-conflict" as const,
            conflictUserId: null as string | null,
          };
        }
      }
    }
    console.error("[login-providers] upsert error:", error);
    return { ok: false as const, schemaReady: true as const, reason: "error" as const };
  }
}

export async function findLinkedUserByProviderIdentity(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  provider: LoginProvider | string;
  authUserId?: string | null;
  providerUserId?: string | null;
  email?: string | null;
  allowEmailFallback?: boolean;
  emailFallbackMode?: "legacy-only" | "always";
}) {
  const provider = normalizeLoginProvider(params.provider);
  if (provider === "password" || provider === "unknown") {
    return {
      schemaReady: true as const,
      lookupOk: true as const,
      userId: null as string | null,
      matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
      usedEmailFallback: false as const,
      conflict: false as const,
    };
  }

  const strictIdentities: Array<{
    column: "auth_user_id" | "provider_user_id";
    value: string;
  }> = [];

  const authUserId = normalizeText(params.authUserId || null);
  if (authUserId) {
    strictIdentities.push({ column: "auth_user_id", value: authUserId });
  }

  const providerUserId = normalizeText(params.providerUserId || null);
  if (providerUserId) {
    strictIdentities.push({ column: "provider_user_id", value: providerUserId });
  }

  const email = normalizeEmail(params.email || null);
  const allowEmailFallback = params.allowEmailFallback === true;
  const emailFallbackMode = params.emailFallbackMode || "legacy-only";

  if (!strictIdentities.length && (!allowEmailFallback || !email)) {
    return {
      schemaReady: true as const,
      lookupOk: true as const,
      userId: null as string | null,
      matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
      usedEmailFallback: false as const,
      conflict: false as const,
    };
  }

  try {
    const strictMatches: Array<{
      userId: string;
      matchedBy: "auth_user_id" | "provider_user_id";
    }> = [];

    for (const identity of strictIdentities) {
      const res = await params.sb
        .from("wz_auth_login_providers")
        .select("user_id")
        .eq("provider", provider)
        .eq(identity.column, identity.value)
        .limit(20);

      if (res.error) {
        if (isMissingTableError(res.error, "wz_auth_login_providers")) {
          return {
            schemaReady: false as const,
            lookupOk: false as const,
            userId: null as string | null,
            matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
            usedEmailFallback: false as const,
            conflict: false as const,
          };
        }

        if (
          isMissingColumnError(res.error, identity.column) ||
          isMissingColumnError(res.error, "user_id")
        ) {
          continue;
        }
        throw res.error;
      }

      const rows = (res.data || []) as Array<{ user_id?: string | null }>;
      for (const row of rows) {
        const userId = normalizeText(row.user_id);
        if (!userId) continue;
        strictMatches.push({
          userId,
          matchedBy: identity.column,
        });
      }
    }

    if (strictMatches.length) {
      const uniqueStrictUserIds = Array.from(
        new Set(strictMatches.map((entry) => entry.userId)),
      );
      if (uniqueStrictUserIds.length > 1) {
        console.error(
          "[login-providers] strict identity conflict for provider:",
          provider,
          strictMatches,
        );
        return {
          schemaReady: true as const,
          lookupOk: true as const,
          userId: null as string | null,
          matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
          usedEmailFallback: false as const,
          conflict: true as const,
        };
      }

      const strictUserId = uniqueStrictUserIds[0] || null;
      const firstStrict =
        strictMatches.find((entry) => entry.userId === strictUserId) || null;

      return {
        schemaReady: true as const,
        lookupOk: true as const,
        userId: strictUserId,
        matchedBy: firstStrict?.matchedBy || null,
        usedEmailFallback: false as const,
        conflict: false as const,
      };
    }

    if (!allowEmailFallback || !email) {
      return {
        schemaReady: true as const,
        lookupOk: true as const,
        userId: null as string | null,
        matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
        usedEmailFallback: false as const,
        conflict: false as const,
      };
    }

    const fallbackColumns = [
      "user_id,auth_user_id,provider_user_id",
      "user_id,auth_user_id",
      "user_id,provider_user_id",
      "user_id",
    ];

    let fallbackRows: Array<{
      userId: string | null;
      authUserId: string | null;
      providerUserId: string | null;
    }> = [];
    let fallbackQueryOk = false;

    for (const columns of fallbackColumns) {
      const res = await params.sb
        .from("wz_auth_login_providers")
        .select(columns)
        .eq("provider", provider)
        .eq("email", email)
        .limit(20);

      if (!res.error) {
        fallbackRows = ((res.data || []) as Array<{
          user_id?: string | null;
          auth_user_id?: string | null;
          provider_user_id?: string | null;
        }>).map((row) => ({
          userId: normalizeText(row.user_id || null),
          authUserId: normalizeText(row.auth_user_id || null),
          providerUserId: normalizeText(row.provider_user_id || null),
        }));
        fallbackQueryOk = true;
        break;
      }

      if (isMissingTableError(res.error, "wz_auth_login_providers")) {
        return {
          schemaReady: false as const,
          lookupOk: false as const,
          userId: null as string | null,
          matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
          usedEmailFallback: false as const,
          conflict: false as const,
        };
      }

      if (
        isMissingColumnError(res.error, "email") ||
        isMissingColumnError(res.error, "user_id") ||
        isMissingColumnError(res.error, "auth_user_id") ||
        isMissingColumnError(res.error, "provider_user_id")
      ) {
        continue;
      }

      throw res.error;
    }

    if (!fallbackQueryOk) {
      return {
        schemaReady: false as const,
        lookupOk: false as const,
        userId: null as string | null,
        matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
        usedEmailFallback: false as const,
        conflict: false as const,
      };
    }

    const fallbackCandidates = fallbackRows.filter((row) => {
      if (!row.userId) return false;
      if (emailFallbackMode !== "legacy-only") return true;
      return !row.authUserId && !row.providerUserId;
    });

    if (!fallbackCandidates.length) {
      return {
        schemaReady: true as const,
        lookupOk: true as const,
        userId: null as string | null,
        matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
        usedEmailFallback: false as const,
        conflict: false as const,
      };
    }

    const uniqueFallbackUserIds = Array.from(
      new Set(fallbackCandidates.map((entry) => String(entry.userId || ""))),
    ).filter(Boolean);
    if (uniqueFallbackUserIds.length > 1) {
      console.error(
        "[login-providers] email fallback conflict for provider:",
        provider,
        fallbackCandidates,
      );
      return {
        schemaReady: true as const,
        lookupOk: true as const,
        userId: null as string | null,
        matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
        usedEmailFallback: false as const,
        conflict: true as const,
      };
    }

    const fallbackUserId = uniqueFallbackUserIds[0] || null;
    if (!fallbackUserId) {
      return {
        schemaReady: true as const,
        lookupOk: true as const,
        userId: null as string | null,
        matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
        usedEmailFallback: false as const,
        conflict: false as const,
      };
    }

    return {
      schemaReady: true as const,
      lookupOk: true as const,
      userId: fallbackUserId,
      matchedBy: "email" as const,
      usedEmailFallback: true as const,
      conflict: false as const,
    };
  } catch (error) {
    console.error("[login-providers] find identity error:", error);
    return {
      schemaReady: true as const,
      lookupOk: false as const,
      userId: null as string | null,
      matchedBy: null as "auth_user_id" | "provider_user_id" | "email" | null,
      usedEmailFallback: false as const,
      conflict: false as const,
    };
  }
}

export async function listLoginProvidersForUser(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) {
    return { schemaReady: true as const, rows: [] as Array<{
      id: string;
      provider: LoginProvider;
      email: string | null;
      providerUserId: string | null;
      linkedAt: string | null;
      lastLoginAt: string | null;
      metadata: Record<string, unknown> | null;
    }> };
  }

  try {
    const res = await params.sb
      .from("wz_auth_login_providers")
      .select("id,user_id,auth_user_id,email,provider,provider_user_id,linked_at,last_login_at,metadata")
      .eq("user_id", userId)
      .order("linked_at", { ascending: true })
      .limit(50);

    if (res.error) throw res.error;

    const rows = ((res.data || []) as LoginProviderRow[])
      .map((row) => {
        const id = normalizeText(row.id);
        if (!id) return null;
        return {
          id,
          provider: normalizeLoginProvider(row.provider),
          email: normalizeEmail(row.email),
          providerUserId: normalizeText(row.provider_user_id),
          linkedAt: normalizeIso(row.linked_at),
          lastLoginAt: normalizeIso(row.last_login_at),
          metadata:
            row.metadata && typeof row.metadata === "object"
              ? (row.metadata as Record<string, unknown>)
              : null,
        };
      })
      .filter(
        (row): row is {
          id: string;
          provider: LoginProvider;
          email: string | null;
          providerUserId: string | null;
          linkedAt: string | null;
          lastLoginAt: string | null;
          metadata: Record<string, unknown> | null;
        } => Boolean(row),
      );

    return { schemaReady: true as const, rows };
  } catch (error) {
    if (isLoginProvidersSchemaMissing(error)) {
      return { schemaReady: false as const, rows: [] as Array<{
        id: string;
        provider: LoginProvider;
        email: string | null;
        providerUserId: string | null;
        linkedAt: string | null;
        lastLoginAt: string | null;
        metadata: Record<string, unknown> | null;
      }> };
    }
    console.error("[login-providers] list error:", error);
    return { schemaReady: false as const, rows: [] as Array<{
      id: string;
      provider: LoginProvider;
      email: string | null;
      providerUserId: string | null;
      linkedAt: string | null;
      lastLoginAt: string | null;
      metadata: Record<string, unknown> | null;
    }> };
  }
}
