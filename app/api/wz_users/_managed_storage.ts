import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";

export const USER_PHOTO_BUCKET = "wz-user-photos" as const;
export const ONBOARDING_LOGO_BUCKET = "wz-onboarding-logos" as const;
export const STORAGE_CLEANUP_QUEUE_TABLE = "wz_storage_cleanup_queue" as const;

type ManagedStorageBucket =
  | typeof USER_PHOTO_BUCKET
  | typeof ONBOARDING_LOGO_BUCKET;

type StorageListItem = {
  name?: string | null;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type StorageObjectEntry = {
  objectPath: string;
  updatedAt: string | null;
};

type CleanupQueueRow = {
  id?: string | null;
  bucket?: string | null;
  object_path?: string | null;
  created_at?: string | null;
};

type BucketReferenceMap = Map<ManagedStorageBucket, Set<string>>;

const STORAGE_LIST_PAGE_SIZE = 100;
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const TABLE_SCAN_PAGE_SIZE = 1000;

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeIso(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeBucket(value: unknown): ManagedStorageBucket | null {
  const clean = String(value || "").trim();
  if (clean === USER_PHOTO_BUCKET || clean === ONBOARDING_LOGO_BUCKET) {
    return clean;
  }
  return null;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coerceStorageListItems(data: unknown): StorageListItem[] {
  if (!Array.isArray(data)) return [];

  return data.filter(isRecordLike).map((row) => ({
    name: typeof row.name === "string" ? row.name : null,
    id: typeof row.id === "string" ? row.id : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    metadata: isRecordLike(row.metadata) ? row.metadata : null,
  }));
}

function coerceCleanupQueueRows(data: unknown): CleanupQueueRow[] {
  if (!Array.isArray(data)) return [];

  return data.filter(isRecordLike).map((row) => ({
    id: typeof row.id === "string" ? row.id : null,
    bucket: typeof row.bucket === "string" ? row.bucket : null,
    object_path: typeof row.object_path === "string" ? row.object_path : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  }));
}

function coerceTablePageRows<T extends Record<string, unknown>>(data: unknown) {
  if (!Array.isArray(data)) {
    const emptyRows: T[] = [];
    return emptyRows;
  }

  // Supabase can expose dynamic-table results with broad error-array typings.
  // Normalize only plain objects before projecting them to the requested row shape.
  return data.filter(isRecordLike).map((row) => row as unknown as T);
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

function isMissingBucketError(error: unknown, bucket: string) {
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: unknown } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: unknown } | null)?.hint || "").toLowerCase();
  const needle = String(bucket || "").trim().toLowerCase();
  return (
    (message.includes("bucket") || details.includes("bucket") || hint.includes("bucket")) &&
    (message.includes("not found") ||
      details.includes("not found") ||
      hint.includes("not found") ||
      message.includes(needle) ||
      details.includes(needle) ||
      hint.includes(needle))
  );
}

function chunkArray<T>(values: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    out.push(values.slice(index, index + size));
  }
  return out;
}

function buildPublicBucketMarker(bucket: ManagedStorageBucket) {
  return `/storage/v1/object/public/${bucket}/`;
}

export function extractObjectPathFromPublicUrl(
  bucket: ManagedStorageBucket,
  value?: string | null,
) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const marker = buildPublicBucketMarker(bucket);
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;

    const objectPath = parsed.pathname.slice(idx + marker.length);
    if (!objectPath) return null;

    return decodeURIComponent(objectPath);
  } catch {
    return null;
  }
}

function isFolderLikeStorageItem(item: StorageListItem) {
  const name = normalizeText(item.name);
  if (!name) return false;
  if (item.metadata && typeof item.metadata === "object") return false;
  return !name.includes(".");
}

function toStorageObjectEntry(prefix: string, item: StorageListItem): StorageObjectEntry | null {
  const name = normalizeText(item.name);
  if (!name || isFolderLikeStorageItem(item)) return null;
  return {
    objectPath: prefix ? `${prefix}/${name}` : name,
    updatedAt: normalizeIso(item.updated_at || item.created_at),
  };
}

async function listStorageEntries(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  bucket: ManagedStorageBucket;
  prefix?: string | null;
  recursive?: boolean;
}): Promise<StorageObjectEntry[]> {
  const prefix = normalizeText(params.prefix) || "";
  let offset = 0;
  const entries: StorageObjectEntry[] = [];
  const folders: string[] = [];

  while (true) {
    const { data, error } = await params.sb.storage.from(params.bucket).list(prefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      if (isMissingBucketError(error, params.bucket)) {
        return [];
      }
      throw error;
    }

    const page = coerceStorageListItems(data);
    for (const item of page) {
      const name = normalizeText(item.name);
      if (!name) continue;

      if (isFolderLikeStorageItem(item)) {
        if (params.recursive) {
          folders.push(prefix ? `${prefix}/${name}` : name);
        }
        continue;
      }

      const entry = toStorageObjectEntry(prefix, item);
      if (entry) entries.push(entry);
    }

    if (page.length < STORAGE_LIST_PAGE_SIZE) break;
    offset += page.length;
  }

  for (const folder of folders) {
    const nested = await listStorageEntries({
      sb: params.sb,
      bucket: params.bucket,
      prefix: folder,
      recursive: true,
    });
    entries.push(...nested);
  }

  return entries;
}

async function removeStorageObjectPaths(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  bucket: ManagedStorageBucket;
  objectPaths: Iterable<string>;
  dryRun?: boolean;
}) {
  const uniqueObjectPaths = Array.from(
    new Set(
      Array.from(params.objectPaths)
        .map((value) => normalizeText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (!uniqueObjectPaths.length) {
    return {
      removedCount: 0,
      removedObjectPaths: [] as string[],
      dryRun: Boolean(params.dryRun),
    };
  }

  if (params.dryRun) {
    return {
      removedCount: uniqueObjectPaths.length,
      removedObjectPaths: uniqueObjectPaths,
      dryRun: true,
    };
  }

  for (const chunk of chunkArray(uniqueObjectPaths, STORAGE_REMOVE_CHUNK_SIZE)) {
    const { error } = await params.sb.storage.from(params.bucket).remove(chunk);
    if (error && !isMissingBucketError(error, params.bucket)) {
      throw error;
    }
  }

  return {
    removedCount: uniqueObjectPaths.length,
    removedObjectPaths: uniqueObjectPaths,
    dryRun: false,
  };
}

async function readTableRows<T extends Record<string, unknown>>(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  table: string;
  columns: string;
  optional?: boolean;
}) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await params.sb
      .from(params.table)
      .select(params.columns)
      .range(from, from + TABLE_SCAN_PAGE_SIZE - 1);

    if (error) {
      if (params.optional && isMissingTableError(error, params.table)) {
        const emptyRows: T[] = [];
        return {
          ok: true as const,
          schemaReady: false as const,
          rows: emptyRows,
        };
      }
      throw error;
    }

    const page = coerceTablePageRows<T>(data);
    rows.push(...page);

    if (page.length < TABLE_SCAN_PAGE_SIZE) {
      break;
    }

    from += page.length;
  }

  return {
    ok: true as const,
    schemaReady: true as const,
    rows,
  };
}

async function collectReferencedManagedObjects(params: {
  sb: ReturnType<typeof supabaseAdmin>;
}) {
  const references: BucketReferenceMap = new Map<ManagedStorageBucket, Set<string>>([
    [USER_PHOTO_BUCKET, new Set<string>()],
    [ONBOARDING_LOGO_BUCKET, new Set<string>()],
  ]);

  const usersRes = await readTableRows<{
    id?: string | null;
    photo_link?: string | null;
  }>({
    sb: params.sb,
    table: "wz_users",
    columns: "id,photo_link",
  });

  const activeUserIds = new Set<string>();
  for (const row of usersRes.rows) {
    const userId = normalizeText(row.id);
    if (userId) activeUserIds.add(userId);

    const photoPath = extractObjectPathFromPublicUrl(USER_PHOTO_BUCKET, row.photo_link);
    if (photoPath) {
      references.get(USER_PHOTO_BUCKET)?.add(photoPath);
    }
  }

  const onboardingRes = await readTableRows<{
    user_id?: string | null;
    company_logo_url?: string | null;
  }>({
    sb: params.sb,
    table: "wz_onboarding",
    columns: "user_id,company_logo_url",
    optional: true,
  });

  if (onboardingRes.schemaReady) {
    for (const row of onboardingRes.rows) {
      const userId = normalizeText(row.user_id);
      if (!userId || !activeUserIds.has(userId)) continue;

      const logoPath = extractObjectPathFromPublicUrl(
        ONBOARDING_LOGO_BUCKET,
        row.company_logo_url,
      );
      if (logoPath) {
        references.get(ONBOARDING_LOGO_BUCKET)?.add(logoPath);
      }
    }
  }

  const companyRes = await readTableRows<{
    user_id?: string | null;
    company_logo_url?: string | null;
  }>({
    sb: params.sb,
    table: "wz_company_onboarding",
    columns: "user_id,company_logo_url",
    optional: true,
  });

  if (companyRes.schemaReady) {
    for (const row of companyRes.rows) {
      const userId = normalizeText(row.user_id);
      if (!userId || !activeUserIds.has(userId)) continue;

      const logoPath = extractObjectPathFromPublicUrl(
        ONBOARDING_LOGO_BUCKET,
        row.company_logo_url,
      );
      if (logoPath) {
        references.get(ONBOARDING_LOGO_BUCKET)?.add(logoPath);
      }
    }
  }

  return references;
}

export async function cleanupUserPhotoFolder(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  keepObjectPath?: string | null;
  dryRun?: boolean;
}) {
  const userId = normalizeText(params.userId);
  if (!userId) {
    return {
      removedCount: 0,
      removedObjectPaths: [] as string[],
      dryRun: Boolean(params.dryRun),
    };
  }

  const keepObjectPath = normalizeText(params.keepObjectPath || "");
  const entries = await listStorageEntries({
    sb: params.sb,
    bucket: USER_PHOTO_BUCKET,
    prefix: userId,
    recursive: false,
  });

  const staleObjectPaths = entries
    .map((entry) => entry.objectPath)
    .filter(
      (objectPath) =>
        objectPath.startsWith(`${userId}/avatar-`) &&
        (!keepObjectPath || objectPath !== keepObjectPath),
    );

  return removeStorageObjectPaths({
    sb: params.sb,
    bucket: USER_PHOTO_BUCKET,
    objectPaths: staleObjectPaths,
    dryRun: params.dryRun,
  });
}

export async function cleanupPrimaryOnboardingLogoFolder(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  keepObjectPath?: string | null;
  dryRun?: boolean;
}) {
  const userId = normalizeText(params.userId);
  if (!userId) {
    return {
      removedCount: 0,
      removedObjectPaths: [] as string[],
      dryRun: Boolean(params.dryRun),
    };
  }

  const keepObjectPath = normalizeText(params.keepObjectPath || "");
  const entries = await listStorageEntries({
    sb: params.sb,
    bucket: ONBOARDING_LOGO_BUCKET,
    prefix: userId,
    recursive: false,
  });

  const staleObjectPaths = entries
    .map((entry) => entry.objectPath)
    .filter(
      (objectPath) =>
        objectPath.startsWith(`${userId}/logo-`) &&
        (!keepObjectPath || objectPath !== keepObjectPath),
    );

  return removeStorageObjectPaths({
    sb: params.sb,
    bucket: ONBOARDING_LOGO_BUCKET,
    objectPaths: staleObjectPaths,
    dryRun: params.dryRun,
  });
}

export async function cleanupCompanyOnboardingLogoFolder(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  companyOnboardingId: string;
  keepObjectPath?: string | null;
  dryRun?: boolean;
}) {
  const userId = normalizeText(params.userId);
  const companyOnboardingId = normalizeText(params.companyOnboardingId);
  if (!userId || !companyOnboardingId) {
    return {
      removedCount: 0,
      removedObjectPaths: [] as string[],
      dryRun: Boolean(params.dryRun),
    };
  }

  const keepObjectPath = normalizeText(params.keepObjectPath || "");
  const prefix = `${userId}/companies/${companyOnboardingId}`;
  const entries = await listStorageEntries({
    sb: params.sb,
    bucket: ONBOARDING_LOGO_BUCKET,
    prefix,
    recursive: false,
  });

  const staleObjectPaths = entries
    .map((entry) => entry.objectPath)
    .filter(
      (objectPath) =>
        objectPath.startsWith(`${prefix}/logo-`) &&
        (!keepObjectPath || objectPath !== keepObjectPath),
    );

  return removeStorageObjectPaths({
    sb: params.sb,
    bucket: ONBOARDING_LOGO_BUCKET,
    objectPaths: staleObjectPaths,
    dryRun: params.dryRun,
  });
}

export async function flushQueuedManagedStorageCleanup(params?: {
  sb?: ReturnType<typeof supabaseAdmin>;
  dryRun?: boolean;
  limit?: number;
}) {
  const sb = params?.sb || supabaseAdmin();
  const limit =
    typeof params?.limit === "number" && Number.isFinite(params.limit) && params.limit > 0
      ? Math.trunc(params.limit)
      : 200;

  const { data, error } = await sb
    .from(STORAGE_CLEANUP_QUEUE_TABLE)
    .select("id,bucket,object_path,created_at")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (
      isMissingTableError(error, STORAGE_CLEANUP_QUEUE_TABLE) ||
      isMissingColumnError(error, "processed_at")
    ) {
      return {
        ok: true as const,
        schemaReady: false as const,
        dryRun: Boolean(params?.dryRun),
        queuedCount: 0,
        processedCount: 0,
        failedCount: 0,
      };
    }
    throw error;
  }

  const rows = coerceCleanupQueueRows(data);
  const normalizedRows = rows
    .map((row) => {
      const id = normalizeText(row.id);
      const bucket = normalizeBucket(row.bucket);
      const objectPath = normalizeText(row.object_path);
      if (!id || !bucket || !objectPath) return null;
      return {
        id,
        bucket,
        objectPath,
      };
    })
    .filter(
      (
        row,
      ): row is {
        id: string;
        bucket: ManagedStorageBucket;
        objectPath: string;
      } => Boolean(row),
    );

  if (!normalizedRows.length) {
    return {
      ok: true as const,
      schemaReady: true as const,
      dryRun: Boolean(params?.dryRun),
      queuedCount: 0,
      processedCount: 0,
      failedCount: 0,
    };
  }

  const idsByBucket = new Map<
    ManagedStorageBucket,
    Array<{
      id: string;
      objectPath: string;
    }>
  >();

  for (const row of normalizedRows) {
    const bucketRows = idsByBucket.get(row.bucket) || [];
    bucketRows.push({
      id: row.id,
      objectPath: row.objectPath,
    });
    idsByBucket.set(row.bucket, bucketRows);
  }

  let processedCount = 0;
  let failedCount = 0;
  const errors: Array<{ bucket: ManagedStorageBucket; message: string }> = [];

  for (const [bucket, bucketRows] of idsByBucket.entries()) {
    for (const chunk of chunkArray(bucketRows, STORAGE_REMOVE_CHUNK_SIZE)) {
      const chunkIds = chunk.map((row) => row.id);
      const chunkPaths = chunk.map((row) => row.objectPath);

      try {
        await removeStorageObjectPaths({
          sb,
          bucket,
          objectPaths: chunkPaths,
          dryRun: params?.dryRun,
        });

        if (!params?.dryRun) {
          const { error: updateError } = await sb
            .from(STORAGE_CLEANUP_QUEUE_TABLE)
            .update({
              processed_at: new Date().toISOString(),
              last_error: null,
            })
            .in("id", chunkIds);

          if (updateError) {
            throw updateError;
          }
        }

        processedCount += chunk.length;
      } catch (error) {
        failedCount += chunk.length;
        const message = String((error as { message?: unknown } | null)?.message || error || "")
          .trim() || "Falha ao processar fila de cleanup.";
        errors.push({ bucket, message });

        if (!params?.dryRun) {
          await sb
            .from(STORAGE_CLEANUP_QUEUE_TABLE)
            .update({
              last_error: message.slice(0, 1000),
            })
            .in("id", chunkIds);
        }
      }
    }
  }

  return {
    ok: true as const,
    schemaReady: true as const,
    dryRun: Boolean(params?.dryRun),
    queuedCount: normalizedRows.length,
    processedCount,
    failedCount,
    errors,
  };
}

export async function reconcileManagedStorageObjects(params?: {
  sb?: ReturnType<typeof supabaseAdmin>;
  dryRun?: boolean;
  unreferencedGraceMs?: number;
}) {
  const sb = params?.sb || supabaseAdmin();
  const now = Date.now();
  const graceMs =
    typeof params?.unreferencedGraceMs === "number" &&
    Number.isFinite(params.unreferencedGraceMs) &&
    params.unreferencedGraceMs >= 0
      ? Math.trunc(params.unreferencedGraceMs)
      : 15 * 60 * 1000;

  const references = await collectReferencedManagedObjects({ sb });
  const summary = {
    ok: true as const,
    dryRun: Boolean(params?.dryRun),
    unreferencedGraceMs: graceMs,
    totals: {
      referencedCount:
        (references.get(USER_PHOTO_BUCKET)?.size || 0) +
        (references.get(ONBOARDING_LOGO_BUCKET)?.size || 0),
      removedCount: 0,
      skippedRecentCount: 0,
    },
    buckets: {
      [USER_PHOTO_BUCKET]: {
        referencedCount: references.get(USER_PHOTO_BUCKET)?.size || 0,
        scannedCount: 0,
        removedCount: 0,
        skippedRecentCount: 0,
        removedObjectPaths: [] as string[],
      },
      [ONBOARDING_LOGO_BUCKET]: {
        referencedCount: references.get(ONBOARDING_LOGO_BUCKET)?.size || 0,
        scannedCount: 0,
        removedCount: 0,
        skippedRecentCount: 0,
        removedObjectPaths: [] as string[],
      },
    },
  };

  const buckets: ManagedStorageBucket[] = [USER_PHOTO_BUCKET, ONBOARDING_LOGO_BUCKET];
  for (const bucket of buckets) {
    const entries = await listStorageEntries({
      sb,
      bucket,
      recursive: true,
    });
    const referencedPaths = references.get(bucket) || new Set<string>();
    const removablePaths: string[] = [];

    summary.buckets[bucket].scannedCount = entries.length;

    for (const entry of entries) {
      if (referencedPaths.has(entry.objectPath)) continue;

      const updatedAtMs = Date.parse(String(entry.updatedAt || ""));
      if (Number.isFinite(updatedAtMs) && now - updatedAtMs < graceMs) {
        summary.buckets[bucket].skippedRecentCount += 1;
        summary.totals.skippedRecentCount += 1;
        continue;
      }

      removablePaths.push(entry.objectPath);
    }

    const removed = await removeStorageObjectPaths({
      sb,
      bucket,
      objectPaths: removablePaths,
      dryRun: params?.dryRun,
    });

    summary.buckets[bucket].removedCount = removed.removedCount;
    summary.buckets[bucket].removedObjectPaths = removed.removedObjectPaths;
    summary.totals.removedCount += removed.removedCount;
  }

  return summary;
}
