import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_supabase";
import { sha, onlyDigits, isValidCPF, isValidE164BRMobile } from "../_codes";
import { setSessionCookie } from "../_session";
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

async function findAuthUserIdByEmail(sb: ReturnType<typeof supabaseAdmin>, email: string) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  const PER_PAGE = 200;
  const MAX_PAGES = 20;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PER_PAGE });

    if (error) {
      console.error("[verify-sms] listUsers error:", error);
      return null;
    }

    const users = (data?.users || []) as Array<{ id?: string | null; email?: string | null }>;
    const found = users.find((u) => String(u?.email || "").trim().toLowerCase() === target);

    if (found?.id) return String(found.id);
    if (users.length < PER_PAGE) break;
  }

  return null;
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

  const ttlMs = Number(params.ttlMs ?? 1000 * 60 * 5); // 5 min
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

export async function POST(req: Request) {
  try {
 const body = await req.json().catch(() => ({}));
const email = String(body?.email || "").trim().toLowerCase();
const code = onlyDigits(String(body?.code || "")).slice(0, 7);
const next = String(body?.next || "").trim(); // ✅ novo

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (code.length !== 7) {
      return NextResponse.json({ ok: false, error: "Código inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const sb = supabaseAdmin();

    const pend = await sb.from("wz_pending_auth").select("*").eq("email", email).maybeSingle();
    if (pend.error || !pend.data) {
      return NextResponse.json({ ok: false, error: "Sessão inválida. Reinicie." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (String(pend.data.flow || "") !== "register") {
      return NextResponse.json({ ok: false, error: "Etapa inválida. Reinicie o cadastro." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (String(pend.data.stage || "") !== "sms") {
      return NextResponse.json({ ok: false, error: "Conclua o e-mail primeiro." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const { data: ch, error: chErr } = await sb
      .from("wz_auth_challenges")
      .select("*")
      .eq("email", email)
      .eq("channel", "sms")
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chErr || !ch) {
      return NextResponse.json({ ok: false, error: "Código expirado. Reenvie." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (new Date(ch.expires_at).getTime() < Date.now()) {
      await sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", ch.id);
      return NextResponse.json({ ok: false, error: "Código expirado. Reenvie." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (Number(ch.attempts_left) <= 0) {
      return NextResponse.json({ ok: false, error: "Muitas tentativas. Reenvie o código." }, { status: 429, headers: NO_STORE_HEADERS });
    }

    const hash = sha(code, ch.salt);

    if (hash !== ch.code_hash) {
      await sb
        .from("wz_auth_challenges")
        .update({ attempts_left: Math.max(0, Number(ch.attempts_left) - 1) })
        .eq("id", ch.id);

      return NextResponse.json({ ok: false, error: "Código inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    await sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", ch.id);

    // dados pending
    let authUserId = pend.data.auth_user_id ? String(pend.data.auth_user_id) : "";
    const fullName = String(pend.data.full_name || "");
    const cpf = String(pend.data.cpf || "");
    const phoneE164 = String(pend.data.phone_e164 || "");

    // ✅ validações fortes antes de salvar
    if (!isValidCPF(cpf)) {
      return NextResponse.json({ ok: false, error: "CPF inválido. Tente novamente." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (!phoneE164 || !isValidE164BRMobile(phoneE164)) {
      return NextResponse.json(
        { ok: false, error: "Telefone inválido para SMS. Use um celular BR válido com DDD." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!authUserId) {
      const recovered = await findAuthUserIdByEmail(sb, email);
      if (recovered) {
        authUserId = recovered;

        const { error: upErr } = await sb
          .from("wz_pending_auth")
          .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
          .eq("email", email);

        if (upErr) {
          console.error("[verify-sms] pending update auth_user_id error:", upErr);
        }
      }
    }

    if (!authUserId) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível vincular autenticação. Reinicie o cadastro e tente novamente." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    // ✅ bloqueia duplicados (cpf/phone) em relação a OUTROS e-mails
    const [confCpf, confPhone] = await Promise.all([
      sb.from("wz_users").select("id,email").eq("cpf", cpf).maybeSingle(),
      sb.from("wz_users").select("id,email").eq("phone_e164", phoneE164).maybeSingle(),
    ]);

    if (confCpf.error || confPhone.error) {
      console.error("[verify-sms] duplicate check error:", { cpf: confCpf.error, phone: confPhone.error });
      return NextResponse.json({ ok: false, error: "Falha ao validar cadastro." }, { status: 500, headers: NO_STORE_HEADERS });
    }

    if (confCpf.data?.id && String(confCpf.data.email || "").toLowerCase() !== email) {
      return NextResponse.json({ ok: false, error: "Este CPF já possui uma conta." }, { status: 409, headers: NO_STORE_HEADERS });
    }

    if (confPhone.data?.id && String(confPhone.data.email || "").toLowerCase() !== email) {
      return NextResponse.json({ ok: false, error: "Este número já possui uma conta." }, { status: 409, headers: NO_STORE_HEADERS });
    }

    // upsert wz_users
    let userId: string | null = null;

    const { data: existing, error: exErr } = await sb
      .from("wz_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (exErr) {
      console.error("[verify-sms] wz_users select error:", exErr);
      return NextResponse.json({ ok: false, error: "Falha ao validar cadastro." }, { status: 500, headers: NO_STORE_HEADERS });
    }

    if (existing?.id) {
      userId = String(existing.id);

      const { error: upUserErr } = await sb
        .from("wz_users")
        .update({
          email_verified: true,
          phone_verified: true,
          auth_user_id: authUserId,
          full_name: fullName || null,
          cpf: cpf || null,
          phone_e164: phoneE164 || null,
        })
        .eq("id", userId);

      if (upUserErr) {
        console.error("[verify-sms] wz_users update error:", upUserErr);
        return NextResponse.json({ ok: false, error: "Falha ao atualizar cadastro." }, { status: 500, headers: NO_STORE_HEADERS });
      }
    } else {
      const { data: createdRow, error: insErr } = await sb
        .from("wz_users")
        .insert({
          email,
          full_name: fullName || null,
          cpf: cpf || null,
          phone_e164: phoneE164 || null,
          auth_user_id: authUserId,
          email_verified: true,
          phone_verified: true,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insErr || !createdRow?.id) {
        const errCode =
          typeof (insErr as { code?: unknown } | null)?.code === "string"
            ? String((insErr as { code?: string }).code)
            : "";
        const errMessage = String((insErr as { message?: unknown } | null)?.message || "")
          .toLowerCase();
        const isUniqueViolation =
          errCode === "23505" ||
          errMessage.includes("duplicate key");

        if (isUniqueViolation) {
          return NextResponse.json(
            { ok: false, error: "E-mail, telefone ou CPF já possui cadastro." },
            { status: 409, headers: NO_STORE_HEADERS }
          );
        }

        console.error("[verify-sms] wz_users insert error:", insErr);
        return NextResponse.json({ ok: false, error: "Falha ao salvar cadastro." }, { status: 500, headers: NO_STORE_HEADERS });
      }

      userId = String(createdRow.id);
    }

    await sb.from("wz_pending_auth").delete().eq("email", email);

    const dashboard = getDashboardOrigin();

    // ✅ host-only => ticket + exchange no dashboard
    if (isHostOnlyMode()) {
      const ticket = makeDashboardTicket({
        userId: String(userId),
        email,
        fullName,
      });
     const nextUrl =
  `${dashboard}/api/wz_AuthLogin/exchange` +
  `?ticket=${encodeURIComponent(ticket)}` +
  `&next=${encodeURIComponent(next || "/")}`;

      const res = NextResponse.json(
        { ok: true, nextUrl },
        { status: 200, headers: NO_STORE_HEADERS },
      );
      setSessionCookie(res, { userId: String(userId), email, fullName }, req.headers);
      return res;
    }

    // ✅ legacy/domain-cookie mode
  const nextUrl = next ? next : `${dashboard}/`;
    const res = NextResponse.json({ ok: true, nextUrl }, { status: 200, headers: NO_STORE_HEADERS });
    setSessionCookie(res, { userId: String(userId), email, fullName }, req.headers);
    return res;
  } catch (e: unknown) {
    console.error("[verify-sms] error:", e);
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
