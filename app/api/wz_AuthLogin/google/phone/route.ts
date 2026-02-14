import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../_supabase";
import {
  gen7,
  isValidBRMobilePhoneDigits,
  maskPhoneE164,
  newSalt,
  onlyDigits,
  sha,
  toE164BRMobile,
} from "../../_codes";
import { sendAuthSmsCode } from "../../_sms";

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

function normalizeProvider(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function hasGoogleIdentity(user: unknown) {
  const candidate =
    user && typeof user === "object"
      ? (user as {
          app_metadata?: Record<string, unknown> | null;
          identities?: Array<Record<string, unknown>> | null;
        })
      : null;
  if (!candidate) return false;

  const appProvider = String(candidate.app_metadata?.provider || "")
    .trim()
    .toLowerCase();
  if (appProvider === "google") return true;

  const identities = Array.isArray(candidate.identities)
    ? candidate.identities
    : [];
  return identities.some(
    (identity) => String(identity?.provider || "").trim().toLowerCase() === "google",
  );
}

async function authUserHasGoogleProvider(
  sb: ReturnType<typeof supabaseAdmin>,
  authUserId: string,
) {
  const cleanAuthUserId = String(authUserId || "").trim();
  if (!cleanAuthUserId) return false;

  try {
    const { data, error } = await sb.auth.admin.getUserById(cleanAuthUserId);
    if (error) {
      console.error("[google-phone] getUserById error:", error);
      return false;
    }
    return hasGoogleIdentity(data?.user || null);
  } catch (error) {
    console.error("[google-phone] authUserHasGoogleProvider error:", error);
    return false;
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
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PER_PAGE });

    if (error) {
      console.error("[google-phone] listUsers error:", error);
      return null;
    }

    const users = (data?.users || []) as Array<{ id?: string | null; email?: string | null }>;
    const found = users.find((u) => String(u?.email || "").trim().toLowerCase() === target);

    if (found?.id) return String(found.id);
    if (users.length < PER_PAGE) break;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const phoneDigits = onlyDigits(String(body?.phone || "")).slice(0, 11);

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "E-mail invalido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (!isValidBRMobilePhoneDigits(phoneDigits)) {
      return NextResponse.json(
        { ok: false, error: "Numero invalido. Use celular BR com DDD." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const phoneE164 = toE164BRMobile(phoneDigits);
    if (!phoneE164) {
      return NextResponse.json(
        { ok: false, error: "Numero invalido. Use celular BR com DDD." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const sb = supabaseAdmin();

    const pend = await sb.from("wz_pending_auth").select("*").eq("email", email).maybeSingle();
    if (pend.error || !pend.data) {
      return NextResponse.json(
        { ok: false, error: "Sessao invalida. Reinicie." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const flow = String(pend.data.flow || "").trim().toLowerCase();
    let authUserId = normalizeText(String(pend.data.auth_user_id || ""));
    if (!authUserId) {
      authUserId = await findAuthUserIdByEmail(sb, email);
    }

    const wzUser = await sb
      .from("wz_users")
      .select("id,auth_provider,auth_user_id")
      .ilike("email", email)
      .maybeSingle();

    const providerByColumn = normalizeProvider(String(wzUser.data?.auth_provider || ""));
    const authUserFromWz = normalizeText(String(wzUser.data?.auth_user_id || ""));
    if (!authUserId && authUserFromWz) authUserId = authUserFromWz;

    const googleByAuth = authUserId
      ? await authUserHasGoogleProvider(sb, authUserId)
      : false;
    const isGoogleOnboarding =
      flow === "google" ||
      ((flow === "register" || !flow) &&
        (providerByColumn === "google" || googleByAuth));

    if (!isGoogleOnboarding) {
      return NextResponse.json(
        { ok: false, error: "Fluxo invalido para cadastro de celular Google." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const confPhone = await sb
      .from("wz_users")
      .select("id,email")
      .eq("phone_e164", phoneE164)
      .maybeSingle();
    if (confPhone.error) {
      console.error("[google-phone] duplicate phone check error:", confPhone.error);
      return NextResponse.json(
        { ok: false, error: "Falha ao validar numero." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
    if (confPhone.data?.id && String(confPhone.data.email || "").toLowerCase() !== email) {
      return NextResponse.json(
        { ok: false, error: "Este numero ja possui uma conta." },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const pendingPatch: Record<string, unknown> = {
      phone_e164: phoneE164,
      stage: "sms",
      updated_at: new Date().toISOString(),
    };
    if (authUserId) pendingPatch.auth_user_id = authUserId;
    const pendUp = await sb.from("wz_pending_auth").update(pendingPatch).eq("email", email);
    if (pendUp.error) {
      console.error("[google-phone] pending update error:", pendUp.error);
      return NextResponse.json(
        { ok: false, error: "Falha ao salvar numero para validacao." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    await sb
      .from("wz_users")
      .update({
        phone_e164: phoneE164,
        auth_user_id: authUserId || null,
      })
      .ilike("email", email);

    await sb
      .from("wz_auth_challenges")
      .update({ consumed: true })
      .eq("email", email)
      .eq("channel", "sms")
      .eq("consumed", false);

    const smsCode = gen7();
    const smsSalt = newSalt();
    const smsHash = sha(smsCode, smsSalt);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

    const smsInsert = await sb.from("wz_auth_challenges").insert({
      email,
      channel: "sms",
      code_hash: smsHash,
      salt: smsSalt,
      expires_at: expiresAt,
      attempts_left: 7,
      consumed: false,
    });
    if (smsInsert.error) {
      console.error("[google-phone] sms challenge insert error:", smsInsert.error);
      return NextResponse.json(
        { ok: false, error: "Falha ao gerar SMS." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    await sendAuthSmsCode(phoneE164, smsCode);

    return NextResponse.json(
      {
        ok: true,
        next: "sms",
        phoneMask: maskPhoneE164(phoneE164),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[google-phone] error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
