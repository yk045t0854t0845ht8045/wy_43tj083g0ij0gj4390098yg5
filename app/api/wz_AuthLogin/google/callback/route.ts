import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "../../_supabase";
import { setSessionCookie } from "../../_session";
import { registerIssuedSession } from "../../_session_devices";
import { upsertLoginProviderRecord } from "../../_login_providers";
import {
  createTrustedLoginToken,
  getTrustedLoginTtlSeconds,
  hashTrustedLoginToken,
  setTrustedLoginCookie,
} from "../../_trusted_login";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type GoogleStatePayload = {
  typ: "wz-google-oauth-state";
  next: string;
  iat: number;
  exp: number;
  nonce: string;
  cv?: string;
};

type WzUserRow = {
  id?: string | null;
  email?: string | null;
  full_name?: string | null;
  auth_user_id?: string | null;
  auth_provider?: string | null;
  must_create_password?: boolean | string | number | null;
};

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToString(input: string) {
  const b64 =
    input.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((input.length + 3) % 4);
  return Buffer.from(b64, "base64").toString("utf8");
}

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest(),
  );
}

function normalizeText(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function normalizeEmail(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  return clean || null;
}

function normalizePkceVerifier(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  if (clean.length < 43 || clean.length > 128) return null;
  if (!/^[A-Za-z0-9\-._~]+$/.test(clean)) return null;
  return clean;
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

function sanitizeFullName(value?: string | null) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.slice(0, 120);
}

function isSafeNextPath(path: string) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\n") || path.includes("\r")) return false;
  return true;
}

function isAllowedReturnToAbsolute(u: URL) {
  const host = u.hostname.toLowerCase();
  const allowed =
    host === "wyzer.com.br" ||
    host === "www.wyzer.com.br" ||
    host.endsWith(".wyzer.com.br") ||
    host === "localhost" ||
    host.endsWith(".localhost");

  const protoOk = u.protocol === "https:" || u.protocol === "http:";
  return protoOk && allowed;
}

function sanitizeNext(raw: string) {
  const clean = String(raw || "").trim();
  if (!clean) return "/";
  if (isSafeNextPath(clean)) return clean;
  try {
    const u = new URL(clean);
    if (isAllowedReturnToAbsolute(u)) return u.toString();
  } catch {}
  return "/";
}

function toRedirectTarget(next: string, origin: string) {
  if (/^https?:\/\//i.test(next)) return next;
  return new URL(next, origin).toString();
}

function getEnvBool(name: string, def: boolean) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return def;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return def;
}

function isHostOnlyMode() {
  const isProd = process.env.NODE_ENV === "production";
  return isProd && getEnvBool("SESSION_COOKIE_HOST_ONLY", true);
}

function getDashboardOrigin() {
  const env = String(process.env.DASHBOARD_ORIGIN || "").trim();
  if (env) return env.replace(/\/+$/g, "");
  return "https://dashboard.wyzer.com.br";
}

function getRequestOrigin(req: NextRequest) {
  const hostHeader =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const protoHeader =
    req.headers.get("x-forwarded-proto") ||
    req.nextUrl.protocol.replace(":", "") ||
    "https";
  const proto = protoHeader === "http" ? "http" : "https";
  return `${proto}://${hostHeader}`;
}

function applyNoStore(res: NextResponse) {
  res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  res.headers.set("Pragma", NO_STORE_HEADERS.Pragma);
  res.headers.set("Expires", NO_STORE_HEADERS.Expires);
}

function makeDashboardTicket(params: {
  userId: string;
  email: string;
  fullName?: string | null;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET nao configurado.");

  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 5);
  const safeFullName = sanitizeFullName(params.fullName);
  const payload = {
    userId: String(params.userId),
    email: String(params.email).trim().toLowerCase(),
    ...(safeFullName ? { fullName: safeFullName } : {}),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signTicket(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function readGoogleStateTicket(ticket: string) {
  const secret = getTicketSecret();
  if (!secret) {
    return { ok: false as const, error: "SESSION_SECRET/WZ_AUTH_SECRET nao configurado." };
  }

  const token = String(ticket || "").trim();
  if (!token.includes(".")) {
    return { ok: false as const, error: "State OAuth invalido." };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) {
    return { ok: false as const, error: "State OAuth invalido." };
  }

  const expected = signTicket(payloadB64, secret);
  if (expected !== sig) {
    return { ok: false as const, error: "State OAuth invalido." };
  }

  try {
    const parsed = JSON.parse(base64UrlDecodeToString(payloadB64)) as GoogleStatePayload;
    if (parsed?.typ !== "wz-google-oauth-state") {
      return { ok: false as const, error: "State OAuth invalido." };
    }
    if (!parsed.exp || parsed.exp < Date.now()) {
      return { ok: false as const, error: "State OAuth expirado." };
    }
    return { ok: true as const, payload: parsed };
  } catch {
    return { ok: false as const, error: "State OAuth invalido." };
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

function isUniqueViolation(error: unknown) {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message = String((error as { message?: unknown } | null)?.message || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key");
}

async function queryWzUsersRows(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  column: string;
  value: string;
  mode: "eq" | "ilike";
}) {
  const columnsToTry = [
    "id,email,full_name,auth_user_id,auth_provider,must_create_password",
    "id,email,full_name,auth_user_id,must_create_password",
    "id,email,full_name,auth_user_id",
    "id,email,full_name",
    "id,email",
  ];

  for (const columns of columnsToTry) {
    const base = params.sb.from("wz_users").select(columns).limit(10);
    const res =
      params.mode === "ilike"
        ? await base.ilike(params.column, params.value)
        : await base.eq(params.column, params.value);

    if (!res.error) {
      const rows = (res.data || []) as WzUserRow[];
      return rows.map((row) => ({
        id: normalizeText(row.id),
        email: normalizeEmail(row.email),
        full_name: sanitizeFullName(row.full_name),
        auth_user_id: normalizeText(row.auth_user_id),
        auth_provider: normalizeText(row.auth_provider),
        must_create_password:
          typeof row.must_create_password === "undefined"
            ? null
            : normalizeBoolean(row.must_create_password),
      }));
    }
  }

  return [] as Array<{
    id: string | null;
    email: string | null;
    full_name: string | null;
    auth_user_id: string | null;
    auth_provider: string | null;
    must_create_password: boolean | null;
  }>;
}

function pickBestWzUserRow(
  rows: Array<{
    id: string | null;
    email: string | null;
    full_name: string | null;
    auth_user_id: string | null;
    auth_provider: string | null;
    must_create_password: boolean | null;
  }>,
  email?: string | null,
) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    const byEmail = rows.find((row) => normalizeEmail(row.email) === normalizedEmail && row.id);
    if (byEmail) return byEmail;
  }
  return rows.find((row) => row.id) || null;
}

async function updateWzUserBestEffort(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  userId: string;
  patch: Record<string, unknown>;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) return;

  const patch = { ...params.patch };
  const patchKeys = Object.keys(patch);
  if (!patchKeys.length) return;

  while (Object.keys(patch).length) {
    const updateRes = await params.sb.from("wz_users").update(patch).eq("id", userId);
    if (!updateRes.error) return;

    let removedAny = false;
    for (const key of Object.keys(patch)) {
      if (isMissingColumnError(updateRes.error, key)) {
        delete patch[key];
        removedAny = true;
      }
    }

    if (!removedAny) {
      throw updateRes.error;
    }
  }
}

async function insertGoogleWzUser(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  fullName: string | null;
  authUserId: string;
  nowIso: string;
}) {
  const attempts: Array<Record<string, unknown>> = [
    {
      email: params.email,
      full_name: params.fullName,
      auth_user_id: params.authUserId,
      email_verified: true,
      auth_provider: "google",
      must_create_password: true,
      created_at: params.nowIso,
    },
    {
      email: params.email,
      full_name: params.fullName,
      auth_user_id: params.authUserId,
      email_verified: true,
      created_at: params.nowIso,
    },
    {
      email: params.email,
      full_name: params.fullName,
      auth_user_id: params.authUserId,
      created_at: params.nowIso,
    },
    {
      email: params.email,
      full_name: params.fullName,
      auth_user_id: params.authUserId,
    },
  ];

  let lastError: unknown = null;

  for (const payload of attempts) {
    const insertRes = await params.sb
      .from("wz_users")
      .insert(payload)
      .select("id")
      .single();

    if (!insertRes.error && insertRes.data?.id) {
      return String(insertRes.data.id);
    }

    if (insertRes.error) {
      lastError = insertRes.error;
      const keys = Object.keys(payload);
      const hasMissingColumn = keys.some((key) =>
        isMissingColumnError(insertRes.error, key),
      );
      if (hasMissingColumn) continue;
      throw insertRes.error;
    }
  }

  if (lastError) throw lastError;
  throw new Error("Nao foi possivel inserir usuario wz_users.");
}

async function findOrCreateGoogleWzUser(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  email: string;
  fullName: string | null;
  authUserId: string;
  nowIso: string;
}) {
  const rowsByAuth = await queryWzUsersRows({
    sb: params.sb,
    column: "auth_user_id",
    value: params.authUserId,
    mode: "eq",
  });
  let existing = pickBestWzUserRow(rowsByAuth, params.email);

  if (!existing) {
    const rowsByEmail = await queryWzUsersRows({
      sb: params.sb,
      column: "email",
      value: params.email,
      mode: "ilike",
    });
    existing = pickBestWzUserRow(rowsByEmail, params.email);
  }

  if (existing?.id) {
    const patch: Record<string, unknown> = {};
    if (!existing.auth_user_id) patch.auth_user_id = params.authUserId;
    if (!existing.full_name && params.fullName) patch.full_name = params.fullName;
    if (normalizeEmail(existing.email) !== normalizeEmail(params.email)) {
      patch.email = params.email;
    }
    patch.auth_provider = "google";

    await updateWzUserBestEffort({
      sb: params.sb,
      userId: existing.id,
      patch,
    });

    return {
      userId: existing.id,
      isNew: false as const,
      mustCreatePassword: Boolean(existing.must_create_password),
    };
  }

  try {
    const createdId = await insertGoogleWzUser({
      sb: params.sb,
      email: params.email,
      fullName: params.fullName,
      authUserId: params.authUserId,
      nowIso: params.nowIso,
    });
    return {
      userId: createdId,
      isNew: true as const,
      mustCreatePassword: true as const,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const rowsByEmail = await queryWzUsersRows({
        sb: params.sb,
        column: "email",
        value: params.email,
        mode: "ilike",
      });
      const recovered = pickBestWzUserRow(rowsByEmail, params.email);
      if (recovered?.id) {
        await updateWzUserBestEffort({
          sb: params.sb,
          userId: recovered.id,
          patch: {
            ...(recovered.auth_user_id ? {} : { auth_user_id: params.authUserId }),
            auth_provider: "google",
          },
        });
        return {
          userId: recovered.id,
          isNew: false as const,
          mustCreatePassword: Boolean(recovered.must_create_password),
        };
      }
    }

    throw error;
  }
}

async function issueTrustedLogin(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
  res: NextResponse,
) {
  try {
    const token = createTrustedLoginToken();
    const tokenHash = hashTrustedLoginToken(token);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expIso = new Date(
      now + getTrustedLoginTtlSeconds() * 1000,
    ).toISOString();

    const { error } = await sb.from("wz_auth_trusted_devices").insert({
      email,
      token_hash: tokenHash,
      created_at: nowIso,
      last_used_at: nowIso,
      expires_at: expIso,
    });

    if (error) {
      console.error("[google-callback] trusted login insert error:", error);
      return;
    }

    setTrustedLoginCookie(res, token);
  } catch (error) {
    console.error("[google-callback] issueTrustedLogin error:", error);
  }
}

function parseGoogleProviderUserId(user: Record<string, unknown>) {
  const identities = Array.isArray(user?.identities)
    ? (user.identities as Array<Record<string, unknown>>)
    : [];
  const googleIdentity = identities.find(
    (identity) => String(identity?.provider || "").trim().toLowerCase() === "google",
  );
  if (!googleIdentity) return null;

  const directId = normalizeText(String(googleIdentity.id || ""));
  if (directId) return directId;

  const identityData =
    googleIdentity.identity_data && typeof googleIdentity.identity_data === "object"
      ? (googleIdentity.identity_data as Record<string, unknown>)
      : null;
  const bySub = normalizeText(String(identityData?.sub || ""));
  if (bySub) return bySub;
  const byUserId = normalizeText(String(identityData?.user_id || ""));
  if (byUserId) return byUserId;
  return null;
}

function buildLoginErrorRedirect(params: {
  origin: string;
  next: string;
  error: string;
}) {
  const url = new URL("/", params.origin);
  const safeNext = sanitizeNext(params.next);
  if (safeNext && safeNext !== "/") {
    url.searchParams.set("returnTo", safeNext);
  }
  url.searchParams.set("oauthError", params.error.slice(0, 220));
  return url.toString();
}

type SupabasePkceExchangePayload = {
  user?: Record<string, unknown> | null;
  error?: string;
  error_description?: string;
  message?: string;
  msg?: string;
};

async function exchangeGooglePkceCode(params: {
  code: string;
  codeVerifier: string;
}) {
  const supabaseUrl = normalizeText(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnon = normalizeText(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !supabaseAnon) {
    return {
      ok: false as const,
      error:
        "Variaveis NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY nao configuradas.",
    };
  }

  const tokenUrl = new URL("/auth/v1/token", `${supabaseUrl}/`);
  tokenUrl.searchParams.set("grant_type", "pkce");

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("apikey", supabaseAnon);
  headers.set("Authorization", `Bearer ${supabaseAnon}`);

  const response = await fetch(tokenUrl.toString(), {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      auth_code: params.code,
      code_verifier: params.codeVerifier,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as SupabasePkceExchangePayload;
  if (!response.ok) {
    const reason = normalizeText(
      payload.error_description || payload.message || payload.msg || payload.error || "",
    );
    return {
      ok: false as const,
      error: reason || "Nao foi possivel validar o codigo OAuth no Supabase.",
    };
  }

  const user =
    payload.user && typeof payload.user === "object"
      ? (payload.user as Record<string, unknown>)
      : null;
  if (!user) {
    return {
      ok: false as const,
      error: "Resposta de autenticacao invalida recebida do Supabase.",
    };
  }

  return { ok: true as const, user };
}

export async function GET(req: NextRequest) {
  const requestOrigin = getRequestOrigin(req);
  const st = String(req.nextUrl.searchParams.get("st") || "").trim();
  const stateRes = readGoogleStateTicket(st);
  const safeNext = stateRes.ok ? sanitizeNext(stateRes.payload.next) : "/";

  const fail = (message: string) => {
    const res = NextResponse.redirect(
      buildLoginErrorRedirect({
        origin: requestOrigin,
        next: safeNext,
        error: message,
      }),
      303,
    );
    applyNoStore(res);
    return res;
  };

  if (!stateRes.ok) {
    return fail("Sessao OAuth invalida. Tente novamente.");
  }

  const oauthError = normalizeText(
    req.nextUrl.searchParams.get("error_description") ||
      req.nextUrl.searchParams.get("error") ||
      "",
  );
  if (oauthError) {
    return fail(oauthError);
  }

  const code = String(req.nextUrl.searchParams.get("code") || "").trim();
  if (!code) {
    return fail("Codigo OAuth ausente. Reinicie o login com Google.");
  }

  try {
    const codeVerifier = normalizePkceVerifier(
      stateRes.ok ? String(stateRes.payload.cv || "") : "",
    );
    if (!codeVerifier) {
      return fail("Sessao OAuth invalida. Reinicie o login com Google.");
    }

    const exchange = await exchangeGooglePkceCode({
      code,
      codeVerifier,
    });
    if (!exchange.ok) {
      console.error("[google-callback] PKCE exchange error:", exchange.error);
      return fail(
        "Nao foi possivel validar o retorno do Google. Confira as URLs de redirecionamento.",
      );
    }

    const user = exchange.user;
    const authUserId = normalizeText(String(user.id || ""));
    const email = normalizeEmail(String(user.email || ""));
    const userMetadata =
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : null;
    const fullName =
      sanitizeFullName(
        String(userMetadata?.full_name || userMetadata?.name || "").trim(),
      ) || null;

    if (!authUserId || !email) {
      return fail("Conta Google sem e-mail valido. Tente outra conta.");
    }

    const sb = supabaseAdmin();
    const nowIso = new Date().toISOString();

    const wzUser = await findOrCreateGoogleWzUser({
      sb,
      email,
      fullName,
      authUserId,
      nowIso,
    });

    const providerUserId = parseGoogleProviderUserId(user);
    await upsertLoginProviderRecord({
      sb,
      userId: wzUser.userId,
      authUserId,
      email,
      provider: "google",
      providerUserId,
      metadata: {
        fullName,
        avatarUrl: normalizeText(String(userMetadata?.avatar_url || userMetadata?.picture || "")),
      },
      nowIso,
    });

    const dashboard = getDashboardOrigin();
    const loginFlow = wzUser.isNew ? "register" : "login";
    const isAccountCreationSession = Boolean(wzUser.isNew);

    if (isHostOnlyMode()) {
      const ticket = makeDashboardTicket({
        userId: wzUser.userId,
        email,
        fullName,
      });
      const nextUrl =
        `${dashboard}/api/wz_AuthLogin/exchange` +
        `?ticket=${encodeURIComponent(ticket)}` +
        `&next=${encodeURIComponent(safeNext)}` +
        `&lm=google` +
        `&lf=${encodeURIComponent(loginFlow)}` +
        (isAccountCreationSession ? "&acs=1" : "");

      const res = NextResponse.redirect(nextUrl, 303);
      setSessionCookie(
        res,
        { userId: wzUser.userId, email, fullName },
        req.headers,
      );
      await issueTrustedLogin(sb, email, res);
      applyNoStore(res);
      return res;
    }

    const redirectTarget = toRedirectTarget(safeNext, dashboard);
    const res = NextResponse.redirect(redirectTarget, 303);
    const sessionPayload = setSessionCookie(
      res,
      { userId: wzUser.userId, email, fullName },
      req.headers,
    );
    await registerIssuedSession({
      headers: req.headers,
      userId: wzUser.userId,
      authUserId,
      email,
      session: sessionPayload,
      loginMethod: "google",
      loginFlow,
      isAccountCreationSession,
    });
    await issueTrustedLogin(sb, email, res);
    applyNoStore(res);
    return res;
  } catch (error) {
    console.error("[google-callback] error:", error);
    return fail("Erro inesperado no login Google. Tente novamente.");
  }
}
