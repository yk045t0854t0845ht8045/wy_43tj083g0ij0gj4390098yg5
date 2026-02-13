import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

export const ACCOUNT_STATE_ACTIVE = "active";
export const ACCOUNT_STATE_PENDING_DELETION = "pending_deletion";
export const ACCOUNT_STATE_DEACTIVATED = "deactivated";

export const ACCOUNT_RESTORE_WINDOW_DAYS = 14;
export const ACCOUNT_EMAIL_REUSE_WINDOW_DAYS = 30;

export type AccountLifecycleState =
  | typeof ACCOUNT_STATE_ACTIVE
  | typeof ACCOUNT_STATE_PENDING_DELETION
  | typeof ACCOUNT_STATE_DEACTIVATED;

type AccountLifecycleRow = {
  id?: string | null;
  email?: string | null;
  account_original_email?: string | null;
  full_name?: string | null;
  phone_e164?: string | null;
  auth_user_id?: string | null;
  user_id?: string | null;
  account_state?: string | null;
  account_delete_requested_at?: string | null;
  account_restore_deadline_at?: string | null;
  account_deactivated_at?: string | null;
  account_email_reuse_at?: string | null;
  account_reactivated_at?: string | null;
};

export type AccountLifecycleRecord = {
  schemaReady: boolean;
  id: string;
  email: string;
  originalEmail: string;
  fullName: string | null;
  phoneE164: string | null;
  authUserId: string | null;
  userId: string | null;
  state: AccountLifecycleState;
  deleteRequestedAt: string | null;
  restoreDeadlineAt: string | null;
  deactivatedAt: string | null;
  emailReuseAt: string | null;
  reactivatedAt: string | null;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeIsoDatetime(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function isMissingColumnError(error: unknown, column: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  const needle = String(column || "").trim().toLowerCase();

  if (!needle) return false;
  if (code === "42703" || code === "PGRST204") return true;
  return (
    (message.includes(needle) || details.includes(needle) || hint.includes(needle)) &&
    (message.includes("column") || details.includes("column") || hint.includes("column"))
  );
}

function isMissingTableError(error: unknown, table: string) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  const needle = String(table || "").trim().toLowerCase();

  if (!needle) return false;
  if (code === "42P01" || code === "PGRST205") return true;
  return (
    (message.includes(needle) || details.includes(needle) || hint.includes(needle)) &&
    (message.includes("does not exist") ||
      details.includes("does not exist") ||
      hint.includes("does not exist") ||
      message.includes("relation") ||
      details.includes("relation") ||
      hint.includes("relation") ||
      message.includes("table") ||
      details.includes("table") ||
      hint.includes("table"))
  );
}

function isLifecycleSchemaMissing(error: unknown) {
  return (
    isMissingTableError(error, "wz_users") ||
    isMissingColumnError(error, "account_original_email") ||
    isMissingColumnError(error, "account_state") ||
    isMissingColumnError(error, "account_delete_requested_at") ||
    isMissingColumnError(error, "account_restore_deadline_at") ||
    isMissingColumnError(error, "account_deactivated_at") ||
    isMissingColumnError(error, "account_email_reuse_at") ||
    isMissingColumnError(error, "account_reactivated_at")
  );
}

function parseAccountState(
  raw: unknown,
  restoreDeadlineAt: string | null,
  deactivatedAt: string | null,
): AccountLifecycleState {
  const clean = String(raw || "").trim().toLowerCase();
  if (clean === ACCOUNT_STATE_ACTIVE) return ACCOUNT_STATE_ACTIVE;
  if (clean === ACCOUNT_STATE_PENDING_DELETION) return ACCOUNT_STATE_PENDING_DELETION;
  if (clean === ACCOUNT_STATE_DEACTIVATED) return ACCOUNT_STATE_DEACTIVATED;

  if (deactivatedAt) return ACCOUNT_STATE_DEACTIVATED;
  if (restoreDeadlineAt) return ACCOUNT_STATE_PENDING_DELETION;
  return ACCOUNT_STATE_ACTIVE;
}

function plusDaysIso(baseIso: string, days: number) {
  const baseMs = Date.parse(baseIso);
  if (!Number.isFinite(baseMs)) return null;
  return new Date(baseMs + Math.max(0, days) * 24 * 60 * 60 * 1000).toISOString();
}

export function buildDeactivatedArchivedEmail(email: string, userId: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUserId = String(userId || "").trim().toLowerCase();

  const [localRaw, domainRaw] = normalizedEmail.split("@");
  const local = String(localRaw || "").trim() || "user";
  const domain = String(domainRaw || "").trim() || "archived.local";
  const suffix = normalizeOptionalText(normalizedUserId)?.replace(/[^a-z0-9_-]/g, "") || "uid";
  const stamp = Date.now().toString(36);
  const maxLocalLen = 64;
  const prefix = `${local.slice(0, Math.max(1, maxLocalLen - 1 - suffix.length - 1 - stamp.length))}`;
  const archivedLocal = `${prefix}_${suffix}_${stamp}`.slice(0, maxLocalLen);
  return `${archivedLocal}@${domain}`;
}

function mapRowToRecord(row: AccountLifecycleRow, schemaReady: boolean): AccountLifecycleRecord | null {
  const id = normalizeOptionalText(row.id);
  const email = normalizeEmail(row.email);
  if (!id || !email) return null;
  const originalEmail = normalizeEmail(row.account_original_email) || email;

  const restoreDeadlineAt = normalizeIsoDatetime(row.account_restore_deadline_at);
  const deactivatedAt = normalizeIsoDatetime(row.account_deactivated_at);
  const state = parseAccountState(row.account_state, restoreDeadlineAt, deactivatedAt);
  const fallbackReuseAt =
    state === ACCOUNT_STATE_DEACTIVATED && deactivatedAt
      ? plusDaysIso(deactivatedAt, ACCOUNT_EMAIL_REUSE_WINDOW_DAYS)
      : null;

  return {
    schemaReady,
    id,
    email,
    originalEmail,
    fullName: normalizeOptionalText(row.full_name),
    phoneE164: normalizeOptionalText(row.phone_e164),
    authUserId: normalizeOptionalText(row.auth_user_id),
    userId: normalizeOptionalText(row.user_id),
    state,
    deleteRequestedAt: normalizeIsoDatetime(row.account_delete_requested_at),
    restoreDeadlineAt,
    deactivatedAt,
    emailReuseAt: normalizeIsoDatetime(row.account_email_reuse_at) || fallbackReuseAt,
    reactivatedAt: normalizeIsoDatetime(row.account_reactivated_at),
  };
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const columnsToTry = [
    "id,email,account_original_email,full_name,phone_e164,auth_user_id,user_id,account_state,account_delete_requested_at,account_restore_deadline_at,account_deactivated_at,account_email_reuse_at,account_reactivated_at",
    "id,email,account_original_email,full_name,phone_e164,auth_user_id,user_id",
    "id,email,account_original_email,full_name,phone_e164,auth_user_id",
    "id,email,account_original_email,full_name,phone_e164,user_id",
    "id,email,account_original_email,full_name,phone_e164",
    "id,email,account_original_email",
    "id,email,full_name,phone_e164,auth_user_id",
    "id,email,full_name,phone_e164,user_id",
    "id,email,full_name,phone_e164",
    "id,email",
  ];

  for (let i = 0; i < columnsToTry.length; i += 1) {
    const columns = columnsToTry[i];
    const base = params.sb.from("wz_users").select(columns).limit(50);
    const res =
      params.mode === "ilike"
        ? await base.ilike(params.column, params.value)
        : await base.eq(params.column, params.value);

    if (!res.error) {
      return {
        schemaReady: i === 0,
        rows: (res.data || []) as AccountLifecycleRow[],
      };
    }

    if (!isLifecycleSchemaMissing(res.error)) {
      console.error("[account-lifecycle] query wz_users error:", res.error);
      return {
        schemaReady: false,
        rows: [] as AccountLifecycleRow[],
      };
    }
  }

  return {
    schemaReady: false,
    rows: [] as AccountLifecycleRow[],
  };
}

function pickBestRow(rows: AccountLifecycleRow[], expectedEmail?: string | null) {
  if (!rows.length) return null;
  const normalizedExpected = normalizeEmail(expectedEmail);
  if (normalizedExpected) {
    const exact = rows.find((row) => normalizeEmail(row.email) === normalizedExpected);
    if (exact?.id) return exact;
    const exactOriginal = rows.find(
      (row) => normalizeEmail(row.account_original_email) === normalizedExpected,
    );
    if (exactOriginal?.id) return exactOriginal;
  }
  const withId = rows
    .map((row) => ({ row, idText: normalizeOptionalText(row.id) || "" }))
    .filter((item) => item.idText);
  if (!withId.length) return null;

  const best = withId
    .slice()
    .sort((a, b) => {
      const an = Number.parseInt(a.idText, 10);
      const bn = Number.parseInt(b.idText, 10);
      const aNum = Number.isFinite(an) ? an : 0;
      const bNum = Number.isFinite(bn) ? bn : 0;
      if (aNum !== bNum) return bNum - aNum;
      return b.idText.localeCompare(a.idText);
    })[0];
  return best?.row || null;
}

function getRowStatePriority(row: AccountLifecycleRow) {
  const state = String(row.account_state || "").trim().toLowerCase();
  if (state === ACCOUNT_STATE_PENDING_DELETION) return 3;
  if (state === ACCOUNT_STATE_DEACTIVATED) return 2;
  if (state === ACCOUNT_STATE_ACTIVE) return 1;
  return 0;
}

function pickBestSessionRow(rows: AccountLifecycleRow[], expectedEmail?: string | null) {
  if (!rows.length) return null;
  const normalizedExpected = normalizeEmail(expectedEmail);
  const withId = rows.filter((row) => normalizeOptionalText(row.id));
  if (!withId.length) return null;

  const byExpectedEmail = normalizedExpected
    ? withId.filter((row) => {
        const rowEmail = normalizeEmail(row.email);
        const rowOriginalEmail = normalizeEmail(row.account_original_email);
        return rowEmail === normalizedExpected || rowOriginalEmail === normalizedExpected;
      })
    : [];

  const pool = byExpectedEmail.length ? byExpectedEmail : withId;
  const best = pool
    .slice()
    .sort((a, b) => {
      const stateDiff = getRowStatePriority(b) - getRowStatePriority(a);
      if (stateDiff !== 0) return stateDiff;

      const aId = normalizeOptionalText(a.id) || "";
      const bId = normalizeOptionalText(b.id) || "";
      const an = Number.parseInt(aId, 10);
      const bn = Number.parseInt(bId, 10);
      const aNum = Number.isFinite(an) ? an : 0;
      const bNum = Number.isFinite(bn) ? bn : 0;
      if (aNum !== bNum) return bNum - aNum;
      return bId.localeCompare(aId);
    })[0];

  return best || null;
}

async function findAccountLifecycleRow(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId?: string | null;
  sessionEmail?: string | null;
}) {
  const sessionUserId = normalizeOptionalText(params.sessionUserId);
  const sessionEmail = normalizeEmail(params.sessionEmail);

  if (sessionUserId) {
    const byAuthUserId = await queryWzUsersRows({
      sb: params.sb,
      column: "auth_user_id",
      value: sessionUserId,
      mode: "eq",
    });
    const bestByAuthUserId = pickBestSessionRow(byAuthUserId.rows, sessionEmail);
    if (bestByAuthUserId?.id) return { row: bestByAuthUserId, schemaReady: byAuthUserId.schemaReady };

    const byUserId = await queryWzUsersRows({
      sb: params.sb,
      column: "user_id",
      value: sessionUserId,
      mode: "eq",
    });
    const bestByUserId = pickBestSessionRow(byUserId.rows, sessionEmail);
    if (bestByUserId?.id) return { row: bestByUserId, schemaReady: byUserId.schemaReady };

    const byId = await queryWzUsersRows({
      sb: params.sb,
      column: "id",
      value: sessionUserId,
      mode: "eq",
    });
    const bestById = pickBestSessionRow(byId.rows, sessionEmail);
    if (bestById?.id) return { row: bestById, schemaReady: byId.schemaReady };
  }

  if (sessionEmail) {
    const byEmail = await queryWzUsersRows({
      sb: params.sb,
      column: "email",
      value: sessionEmail,
      mode: "ilike",
    });
    const best = pickBestRow(byEmail.rows, sessionEmail);
    if (best?.id) return { row: best, schemaReady: byEmail.schemaReady };
  }

  return { row: null as AccountLifecycleRow | null, schemaReady: false };
}

export async function resolveAccountLifecycleBySession(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  sessionUserId?: string | null;
  sessionEmail?: string | null;
}) {
  const found = await findAccountLifecycleRow(params);
  if (!found.row) return null;
  return mapRowToRecord(found.row, found.schemaReady);
}

export async function resolveAccountLifecycleByEmail(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email?: string | null;
}) {
  const email = normalizeEmail(params.email);
  if (!email) return null;
  const foundByEmail = await queryWzUsersRows({
    sb: params.sb,
    column: "email",
    value: email,
    mode: "ilike",
  });
  const rowByEmail = pickBestRow(foundByEmail.rows, email);
  if (rowByEmail) return mapRowToRecord(rowByEmail, foundByEmail.schemaReady);

  const foundByOriginalEmail = await queryWzUsersRows({
    sb: params.sb,
    column: "account_original_email",
    value: email,
    mode: "ilike",
  });
  const rowByOriginalEmail = pickBestRow(foundByOriginalEmail.rows, email);
  if (!rowByOriginalEmail) return null;
  return mapRowToRecord(rowByOriginalEmail, foundByOriginalEmail.schemaReady);
}

export function canReactivateWithinWindow(record: AccountLifecycleRecord, nowMs = Date.now()) {
  if (record.state !== ACCOUNT_STATE_PENDING_DELETION) return false;
  const deadlineMs = Date.parse(String(record.restoreDeadlineAt || ""));
  if (!Number.isFinite(deadlineMs)) return false;
  return nowMs < deadlineMs;
}

export function canReuseEmailForRegister(record: AccountLifecycleRecord, nowMs = Date.now()) {
  if (record.state !== ACCOUNT_STATE_DEACTIVATED) return false;
  const reuseAtMs = Date.parse(String(record.emailReuseAt || ""));
  if (!Number.isFinite(reuseAtMs)) return false;
  return nowMs >= reuseAtMs;
}

export async function syncAccountLifecycleIfNeeded(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  record: AccountLifecycleRecord;
  nowMs?: number;
}): Promise<AccountLifecycleRecord> {
  if (!params.record.schemaReady) return params.record;

  const nowMs = Number(params.nowMs ?? Date.now());
  const nowIso = new Date(nowMs).toISOString();

  if (params.record.state === ACCOUNT_STATE_PENDING_DELETION) {
    const deadlineMs = Date.parse(String(params.record.restoreDeadlineAt || ""));
    if (Number.isFinite(deadlineMs) && nowMs >= deadlineMs) {
      const deactivatedAt = new Date(deadlineMs).toISOString();
      const emailReuseAt = plusDaysIso(deactivatedAt, ACCOUNT_EMAIL_REUSE_WINDOW_DAYS);
      const originalEmail = normalizeEmail(params.record.originalEmail || params.record.email);
      const shouldArchiveEmail = normalizeEmail(params.record.email) === originalEmail;
      const archivedEmail = buildDeactivatedArchivedEmail(originalEmail, params.record.id);
      await params.sb
        .from("wz_users")
        .update({
          account_state: ACCOUNT_STATE_DEACTIVATED,
          account_original_email: originalEmail,
          ...(shouldArchiveEmail ? { email: archivedEmail } : {}),
          account_deactivated_at: deactivatedAt,
          account_email_reuse_at: emailReuseAt,
        })
        .eq("id", params.record.id);

      return {
        ...params.record,
        email: shouldArchiveEmail ? archivedEmail : params.record.email,
        originalEmail,
        state: ACCOUNT_STATE_DEACTIVATED,
        deactivatedAt,
        emailReuseAt,
      } satisfies AccountLifecycleRecord;
    }
    return params.record;
  }

  if (params.record.state === ACCOUNT_STATE_DEACTIVATED && !params.record.emailReuseAt) {
    const base = params.record.deactivatedAt || nowIso;
    const emailReuseAt = plusDaysIso(base, ACCOUNT_EMAIL_REUSE_WINDOW_DAYS);
    await params.sb
      .from("wz_users")
      .update({ account_email_reuse_at: emailReuseAt })
      .eq("id", params.record.id);

    return {
      ...params.record,
      emailReuseAt,
    } satisfies AccountLifecycleRecord;
  }

  return params.record;
}

export async function markAccountPendingDeletion(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  nowMs?: number;
}) {
  const targetUserId = String(params.userId || "").trim();
  if (!targetUserId) {
    throw new Error("Nao foi possivel identificar a conta para exclusao.");
  }

  const nowMs = Number(params.nowMs ?? Date.now());
  const requestedAt = new Date(nowMs).toISOString();
  const restoreDeadlineAt = plusDaysIso(requestedAt, ACCOUNT_RESTORE_WINDOW_DAYS) || requestedAt;

  const { data: updatedRow, error } = await params.sb
    .from("wz_users")
    .update({
      account_state: ACCOUNT_STATE_PENDING_DELETION,
      account_delete_requested_at: requestedAt,
      account_restore_deadline_at: restoreDeadlineAt,
      account_deactivated_at: null,
      account_email_reuse_at: null,
    })
    .eq("id", targetUserId)
    .select("id,account_state,account_restore_deadline_at")
    .maybeSingle();

  if (error) {
    const message = String((error as { message?: unknown } | null)?.message || "");
    throw new Error(message || "Nao foi possivel marcar a conta para exclusao.");
  }

  if (!updatedRow || !normalizeOptionalText((updatedRow as { id?: string | null }).id)) {
    throw new Error("Conta nao encontrada para exclusao.");
  }

  const updatedState = String(
    (updatedRow as { account_state?: string | null }).account_state || "",
  )
    .trim()
    .toLowerCase();
  if (updatedState !== ACCOUNT_STATE_PENDING_DELETION) {
    throw new Error("Nao foi possivel confirmar a exclusao da conta.");
  }

  const persistedRestoreDeadlineAt = normalizeIsoDatetime(
    (updatedRow as { account_restore_deadline_at?: string | null }).account_restore_deadline_at,
  );

  return { requestedAt, restoreDeadlineAt: persistedRestoreDeadlineAt || restoreDeadlineAt };
}

export async function markAccountRestored(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  nowMs?: number;
}) {
  const restoredAt = new Date(Number(params.nowMs ?? Date.now())).toISOString();
  const targetUserId = String(params.userId || "").trim();
  if (!targetUserId) {
    throw new Error("Nao foi possivel identificar a conta para restaurar.");
  }

  const { data: currentRow } = await params.sb
    .from("wz_users")
    .select("email,account_original_email")
    .eq("id", targetUserId)
    .maybeSingle();
  const restoredEmail = normalizeEmail(
    (currentRow as { account_original_email?: string | null; email?: string | null } | null)
      ?.account_original_email ||
      (currentRow as { email?: string | null } | null)?.email,
  );
  const { data: updatedRow, error } = await params.sb
    .from("wz_users")
    .update({
      ...(restoredEmail
        ? {
            email: restoredEmail,
            account_original_email: restoredEmail,
          }
        : {}),
      account_state: ACCOUNT_STATE_ACTIVE,
      account_delete_requested_at: null,
      account_restore_deadline_at: null,
      account_deactivated_at: null,
      account_email_reuse_at: null,
      account_reactivated_at: restoredAt,
    })
    .eq("id", targetUserId)
    .select("id,account_state")
    .maybeSingle();

  if (error) {
    const message = String((error as { message?: unknown } | null)?.message || "");
    throw new Error(message || "Nao foi possivel restaurar a conta.");
  }

  if (!updatedRow || !normalizeOptionalText((updatedRow as { id?: string | null }).id)) {
    throw new Error("Conta nao encontrada para restaurar.");
  }

  const updatedState = String(
    (updatedRow as { account_state?: string | null }).account_state || "",
  )
    .trim()
    .toLowerCase();
  if (updatedState !== ACCOUNT_STATE_ACTIVE) {
    throw new Error("Nao foi possivel confirmar a reativacao da conta.");
  }

  return { restoredAt };
}
