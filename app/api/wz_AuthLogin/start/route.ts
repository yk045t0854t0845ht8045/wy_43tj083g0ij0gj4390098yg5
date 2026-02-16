import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAnon } from "../_supabase";
import {
  sha,
  gen7,
  newSalt,
  onlyDigits,
  toE164BRMobile,
  isValidCPF,
  isValidBRMobilePhoneDigits,
} from "../_codes";
import { sendLoginCodeEmail } from "../_email";
import { setSessionCookie } from "../_session";
import { registerIssuedSession } from "../_session_devices";
import {
  externalProviderLabel,
  resolvePasswordSetupRequirement,
  updateMustCreatePasswordBestEffort,
} from "../_password_setup";
import {
  hashTrustedLoginToken,
  readTrustedLoginTokenFromCookieHeader,
  setTrustedLoginCookie,
} from "../_trusted_login";
import crypto from "crypto";

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

type WzUserLoginLookup = {
  id: string | null;
  email: string | null;
  fullName: string | null;
  authUserId: string | null;
  authProvider: string | null;
  mustCreatePassword: boolean;
};

async function getWzUserLoginLookupByEmail(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
) {
  const columnsToTry = [
    "id,email,full_name,auth_user_id,auth_provider,must_create_password",
    "id,email,full_name,auth_user_id,auth_provider",
    "id,email,full_name,auth_user_id,must_create_password",
    "id,email,full_name,auth_user_id",
    "id,email,full_name,auth_provider,must_create_password",
    "id,email,full_name,auth_provider",
    "id,email,full_name,must_create_password",
    "id,email,full_name",
  ];

  for (const columns of columnsToTry) {
    const res = await sb.from("wz_users").select(columns).eq("email", email).maybeSingle();

    if (!res.error) {
      if (!res.data) return null;
      const row = (res.data || {}) as {
        id?: string | null;
        email?: string | null;
        full_name?: string | null;
        auth_user_id?: string | null;
        auth_provider?: string | null;
        must_create_password?: boolean | number | string | null;
      };

      return {
        id: normalizeText(row.id),
        email: normalizeText(row.email),
        fullName: normalizeText(row.full_name),
        authUserId: normalizeText(row.auth_user_id),
        authProvider: normalizeText(row.auth_provider),
        mustCreatePassword:
          typeof row.must_create_password === "undefined"
            ? false
            : normalizeBoolean(row.must_create_password),
      } as WzUserLoginLookup;
    }

    const hasMissingColumn = [
      "auth_user_id",
      "auth_provider",
      "must_create_password",
      "full_name",
      "email",
      "id",
    ].some((column) => isMissingColumnError(res.error, column));

    if (!hasMissingColumn) {
      console.error("[start] wz_users select error:", res.error);
      break;
    }
  }

  return null;
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

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getTicketSecret() {
  return process.env.SESSION_SECRET || process.env.WZ_AUTH_SECRET || "";
}

function signTicket(payloadB64: string, secret: string) {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest(),
  );
}

function sanitizeFullName(v?: string | null) {
  const clean = String(v || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.slice(0, 120);
}

function makeDashboardTicket(params: {
  userId: string;
  email: string;
  fullName?: string | null;
  ttlMs?: number;
}) {
  const secret = getTicketSecret();
  if (!secret) throw new Error("SESSION_SECRET/WZ_AUTH_SECRET não configurado.");

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

function sanitizeNext(nextRaw: string) {
  const s = String(nextRaw || "").trim();
  if (!s) return "/";

  if (s.startsWith("/")) return s;

  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();

    const ok =
      host === "wyzer.com.br" ||
      host.endsWith(".wyzer.com.br") ||
      host === "localhost" ||
      host.endsWith(".localhost");

    if (!ok) return "/";

    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

async function findAuthUserIdByEmail(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  const PER_PAGE = 200;
  const MAX_PAGES = 20;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) {
      console.error("[start] listUsers error:", error);
      return null;
    }

    const users = (data?.users || []) as Array<{
      id?: string | null;
      email?: string | null;
    }>;
    const found = users.find(
      (u) => String(u?.email || "").trim().toLowerCase() === target,
    );

    if (found?.id) return String(found.id);
    if (users.length < PER_PAGE) break;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const nextFromBody = String(body?.next || body?.returnTo || "").trim();
    const nextSafe = sanitizeNext(nextFromBody || "/");

    // dados cadastro
    const fullName = String(body?.fullName || "");
    const cpf = onlyDigits(String(body?.cpf || "")).slice(0, 11);
    const phoneDigits = onlyDigits(String(body?.phone || "")).slice(0, 11);

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ ok: false, error: "Senha inválida." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const admin = supabaseAdmin();

    // existe perfil?
    const existingWz = await getWzUserLoginLookupByEmail(admin, email);

    // ✅ se já existe em wz_users, sempre é login (não deixa “registrar por cima”)
    const flow = existingWz?.id ? "login" : "register";

    // ✅ LOGIN: valida senha e, se dispositivo confiável válido, finaliza sem código.
    if (flow === "login") {
      const anon = supabaseAnon();
      const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({
        email,
        password,
      });

      if (signErr || !signIn?.user?.id) {
        const msg = String((signErr as { message?: unknown } | null)?.message || "");
        if (!/email not confirmed/i.test(msg)) {
          if (existingWz?.mustCreatePassword) {
            const passwordSetupState = await resolvePasswordSetupRequirement({
              sb: admin,
              userId: existingWz.id,
              email: existingWz.email || email,
              authUserId: existingWz.authUserId,
              authProvider: existingWz.authProvider,
              mustCreatePassword: true,
            });

            if (passwordSetupState.shouldAutoClearMustCreatePassword) {
              await updateMustCreatePasswordBestEffort({
                sb: admin,
                userId: existingWz.id,
                mustCreatePassword: false,
              });
            }

            if (
              passwordSetupState.shouldRequireSetup &&
              passwordSetupState.providerForSetup
            ) {
              return NextResponse.json(
                {
                  ok: false,
                  code: "password_setup_required",
                  error: "Voce nao cumpriu os requisitos de senha da conta.",
                  provider: passwordSetupState.providerForSetup,
                  providerLabel: externalProviderLabel(passwordSetupState.providerForSetup),
                  ctaLabel: "Criar agora",
                },
                { status: 409, headers: NO_STORE_HEADERS },
              );
            }
          }
          return NextResponse.json(
            { ok: false, error: "Senha incorreta." },
            { status: 401, headers: NO_STORE_HEADERS },
          );
        }
      }

      const trustedToken = readTrustedLoginTokenFromCookieHeader(
        req.headers.get("cookie"),
      );

      if (trustedToken) {
        const tokenHash = hashTrustedLoginToken(trustedToken);
        const nowIso = new Date().toISOString();

        const { data: trustedRow, error: trustedErr } = await admin
          .from("wz_auth_trusted_devices")
          .select("id")
          .eq("email", email)
          .eq("token_hash", tokenHash)
          .is("revoked_at", null)
          .gt("expires_at", nowIso)
          .maybeSingle();

        if (trustedErr) {
          console.error("[start] trusted device lookup error:", trustedErr);
        }

        if (trustedRow?.id) {
          await admin
            .from("wz_auth_trusted_devices")
            .update({ last_used_at: nowIso })
            .eq("id", trustedRow.id);

          const authMeta = (signIn?.user?.user_metadata ?? null) as
            | { full_name?: string | null }
            | null;
          const authMetaFullName = String(authMeta?.full_name || "").trim();
          const resolvedFullName = sanitizeFullName(
            existingWz?.fullName || authMetaFullName,
          );

          const dashboard = getDashboardOrigin();
          const fallbackAuthUserId = signIn?.user?.id ? String(signIn.user.id) : "";
          const userId = String(existingWz?.id || fallbackAuthUserId);
          if (!userId) {
            return NextResponse.json(
              { ok: false, error: "Falha ao validar usuário." },
              { status: 401, headers: NO_STORE_HEADERS },
            );
          }

          if (isHostOnlyMode()) {
            const ticket = makeDashboardTicket({
              userId,
              email,
              fullName: resolvedFullName,
            });
            const nextUrl =
              `${dashboard}/api/wz_AuthLogin/exchange` +
              `?ticket=${encodeURIComponent(ticket)}` +
              `&next=${encodeURIComponent(nextSafe)}` +
              `&lm=trusted` +
              `&lf=login`;

            const res = NextResponse.json(
              { ok: true, nextUrl, trustedBypass: true },
              { status: 200, headers: NO_STORE_HEADERS },
            );
            setSessionCookie(res, { userId, email, fullName: resolvedFullName }, req.headers);
            setTrustedLoginCookie(res, trustedToken);
            return res;
          }

          const nextUrl = `${dashboard}${nextSafe.startsWith("/") ? nextSafe : "/"}`;
          const res = NextResponse.json(
            { ok: true, nextUrl, trustedBypass: true },
            { status: 200, headers: NO_STORE_HEADERS },
          );
          const sessionPayload = setSessionCookie(
            res,
            { userId, email, fullName: resolvedFullName },
            req.headers,
          );
          await registerIssuedSession({
            headers: req.headers,
            userId,
            authUserId: fallbackAuthUserId || null,
            email,
            session: sessionPayload,
            loginMethod: "trusted",
            loginFlow: "login",
            isAccountCreationSession: false,
          });
          setTrustedLoginCookie(res, trustedToken);
          return res;
        }
      }

      const { error: pendErr } = await admin.from("wz_pending_auth").upsert(
        {
          email,
          flow: "login",
          stage: "email",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );

      if (pendErr) {
        console.error("[start] pending upsert error:", pendErr);
        return NextResponse.json(
          { ok: false, error: "Falha ao iniciar login." },
          { status: 500, headers: NO_STORE_HEADERS },
        );
      }
    }

    // ✅ REGISTER: valida CPF real + telefone BR válido (celular) + bloqueia duplicados
    if (flow === "register") {
      if (fullName.trim().length < 4) {
        return NextResponse.json({ ok: false, error: "Informe seu nome completo." }, { status: 400, headers: NO_STORE_HEADERS });
      }

      if (!isValidCPF(cpf)) {
        return NextResponse.json({ ok: false, error: "CPF inválido. Tente novamente." }, { status: 400, headers: NO_STORE_HEADERS });
      }

      if (!isValidBRMobilePhoneDigits(phoneDigits)) {
        return NextResponse.json(
          { ok: false, error: "Formato de celular inválido. . Inclua o DDD." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      const phoneE164 = toE164BRMobile(phoneDigits);
      if (!phoneE164) {
        return NextResponse.json(
          { ok: false, error: "Formato de celular inválido. . Inclua o DDD." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      // ✅ bloqueia duplicados antes de criar pending/auth
      const [dupCpf, dupPhone] = await Promise.all([
        admin.from("wz_users").select("id,email").eq("cpf", cpf).maybeSingle(),
        admin.from("wz_users").select("id,email").eq("phone_e164", phoneE164).maybeSingle(),
      ]);

      if (dupCpf.error || dupPhone.error) {
        console.error("[start] duplicate check error:", {
          cpf: dupCpf.error,
          phone: dupPhone.error,
        });
        return NextResponse.json({ ok: false, error: "Falha ao validar cadastro." }, { status: 500, headers: NO_STORE_HEADERS });
      }

      if (dupCpf.data?.id) {
        return NextResponse.json({ ok: false, error: "Este CPF já possui uma conta." }, { status: 409, headers: NO_STORE_HEADERS });
      }

      if (dupPhone.data?.id) {
        return NextResponse.json({ ok: false, error: "Este número já possui uma conta." }, { status: 409, headers: NO_STORE_HEADERS });
      }

      let authUserId = await findAuthUserIdByEmail(admin, email);

      if (!authUserId) {
        const created = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: false,
          user_metadata: { full_name: fullName.trim() },
        });

        if (created.error) {
          const msg = String(created.error?.message || "");
          const code = String(
            (created.error as { code?: unknown } | null)?.code || "",
          );
          console.error("[start] auth create error:", created.error);

          if (code === "email_exists" || /already been registered/i.test(msg)) {
            authUserId = await findAuthUserIdByEmail(admin, email);
          } else {
            return NextResponse.json({ ok: false, error: "Falha ao criar usuário de autenticação." }, { status: 500, headers: NO_STORE_HEADERS });
          }
        } else {
          authUserId = created.data?.user?.id ? String(created.data.user.id) : null;
        }
      }

      const { error: pendErr } = await admin.from("wz_pending_auth").upsert(
        {
          email,
          flow: "register",
          stage: "email",
          auth_user_id: authUserId,
          full_name: fullName.trim(),
          cpf,
          phone_e164: phoneE164,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );

      if (pendErr) {
        console.error("[start] pending upsert error:", pendErr);
        return NextResponse.json({ ok: false, error: "Falha ao iniciar cadastro." }, { status: 500, headers: NO_STORE_HEADERS });
      }
    }

    // invalida desafios antigos de email
    await admin
      .from("wz_auth_challenges")
      .update({ consumed: true })
      .eq("email", email)
      .eq("channel", "email")
      .eq("consumed", false);

    // cria desafio de email
    const emailCode = gen7();
    const emailSalt = newSalt();
    const emailHash = sha(emailCode, emailSalt);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

    const { error: chErr } = await admin.from("wz_auth_challenges").insert({
      email,
      channel: "email",
      code_hash: emailHash,
      salt: emailSalt,
      expires_at: expiresAt,
      attempts_left: 7,
      consumed: false,
    });

    if (chErr) {
      console.error("[start] challenge insert error:", chErr);
      return NextResponse.json({ ok: false, error: "Falha ao gerar código." }, { status: 500, headers: NO_STORE_HEADERS });
    }

    await sendLoginCodeEmail(email, emailCode);
    return NextResponse.json({ ok: true, next: "email" }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (e: unknown) {
    console.error("[start] error:", e);
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
