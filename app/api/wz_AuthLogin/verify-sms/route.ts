import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_supabase";
import { sha, onlyDigits } from "../_codes";
import { setSessionCookie } from "../_session";

function isValidEmail(v: string) {
  const s = (v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
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
      console.error("[verify-sms] listUsers error:", error);
      return null;
    }

    const users = (data?.users || []) as Array<any>;
    const found = users.find(
      (u) => String(u?.email || "").trim().toLowerCase() === target,
    );

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

function isUniqueViolation(err: any) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "").toLowerCase();
  return code === "23505" || msg.includes("duplicate key");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const code = onlyDigits(String(body?.code || "")).slice(0, 7);

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "E-mail inválido." },
        { status: 400 },
      );
    }
    if (code.length !== 7) {
      return NextResponse.json(
        { ok: false, error: "Código inválido." },
        { status: 400 },
      );
    }

    const sb = supabaseAdmin();

    const pend = await sb
      .from("wz_pending_auth")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (pend.error || !pend.data) {
      return NextResponse.json(
        { ok: false, error: "Sessão inválida. Reinicie." },
        { status: 400 },
      );
    }

    if (String(pend.data.flow || "") !== "register") {
      return NextResponse.json(
        { ok: false, error: "Etapa inválida. Reinicie o cadastro." },
        { status: 400 },
      );
    }

    if (String(pend.data.stage || "") !== "sms") {
      return NextResponse.json(
        { ok: false, error: "Conclua o e-mail primeiro." },
        { status: 400 },
      );
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
      return NextResponse.json(
        { ok: false, error: "Código expirado. Reenvie." },
        { status: 400 },
      );
    }

    if (new Date(ch.expires_at).getTime() < Date.now()) {
      await sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", ch.id);
      return NextResponse.json(
        { ok: false, error: "Código expirado. Reenvie." },
        { status: 400 },
      );
    }

    if (Number(ch.attempts_left) <= 0) {
      return NextResponse.json(
        { ok: false, error: "Muitas tentativas. Reenvie o código." },
        { status: 429 },
      );
    }

    const hash = sha(code, ch.salt);

    if (hash !== ch.code_hash) {
      await sb
        .from("wz_auth_challenges")
        .update({ attempts_left: Math.max(0, Number(ch.attempts_left) - 1) })
        .eq("id", ch.id);

      return NextResponse.json(
        { ok: false, error: "Código inválido." },
        { status: 400 },
      );
    }

    await sb.from("wz_auth_challenges").update({ consumed: true }).eq("id", ch.id);

    // dados pending (sanitizados)
    let authUserId = pend.data.auth_user_id ? String(pend.data.auth_user_id) : "";
    const fullName = String(pend.data.full_name || "");
    const cpf = onlyDigits(String(pend.data.cpf || "")).slice(0, 11);
    const phoneE164 = String(pend.data.phone_e164 || "").trim();

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
        {
          ok: false,
          error:
            "Não foi possível vincular autenticação. Reinicie o cadastro e tente novamente.",
        },
        { status: 500 },
      );
    }

    // ✅ trava duplicados (CPF/PHONE) antes de gravar no wz_users
    if (cpf.length !== 11) {
      return NextResponse.json(
        { ok: false, error: "CPF inválido." },
        { status: 400 },
      );
    }
    if (!/^\+55\d{10,11}$/.test(phoneE164)) {
      return NextResponse.json(
        { ok: false, error: "Telefone inválido." },
        { status: 400 },
      );
    }

    // pega se já existe por email
    const { data: emailRows, error: emailErr } = await sb
      .from("wz_users")
      .select("id,email,cpf,phone_e164")
      .eq("email", email)
      .limit(1);

    if (emailErr) {
      console.error("[verify-sms] wz_users email select error:", emailErr);
      return NextResponse.json(
        { ok: false, error: "Falha ao validar cadastro." },
        { status: 500 },
      );
    }

    const existingByEmail = emailRows?.[0] ?? null;
    const currentId = existingByEmail?.id ? String(existingByEmail.id) : null;

    // cpf duplicado?
    const { data: cpfRows, error: cpfErr } = await sb
      .from("wz_users")
      .select("id,email")
      .eq("cpf", cpf)
      .limit(1);

    if (cpfErr) {
      console.error("[verify-sms] cpf select error:", cpfErr);
      return NextResponse.json(
        { ok: false, error: "Falha ao validar CPF." },
        { status: 500 },
      );
    }
    if (cpfRows?.[0]?.id && String(cpfRows[0].id) !== currentId) {
      return NextResponse.json(
        { ok: false, error: "Esse CPF já possui cadastro." },
        { status: 409 },
      );
    }

    // phone duplicado?
    const orPhone = `phone_e164.eq.${phoneE164},phone.eq.${onlyDigits(phoneE164).slice(-11)}`;
    const { data: phoneRows, error: phoneErr } = await sb
      .from("wz_users")
      .select("id,email,phone,phone_e164")
      .or(orPhone)
      .limit(1);

    if (phoneErr) {
      console.error("[verify-sms] phone select error:", phoneErr);
      return NextResponse.json(
        { ok: false, error: "Falha ao validar telefone." },
        { status: 500 },
      );
    }
    if (phoneRows?.[0]?.id && String(phoneRows[0].id) !== currentId) {
      return NextResponse.json(
        { ok: false, error: "Esse telefone já possui cadastro." },
        { status: 409 },
      );
    }

    // upsert wz_users
    let userId: string | null = null;

    try {
      if (currentId) {
        userId = currentId;

        const { error: upUserErr } = await sb
          .from("wz_users")
          .update({
            email_verified: true,
            phone_verified: true,
            auth_user_id: authUserId,
            phone_e164: phoneE164 || null,
            cpf: cpf || null,
            full_name: fullName || null,
          })
          .eq("id", userId);

        if (upUserErr) {
          if (isUniqueViolation(upUserErr)) {
            return NextResponse.json(
              { ok: false, error: "CPF, telefone ou e-mail já possui cadastro." },
              { status: 409 },
            );
          }

          console.error("[verify-sms] wz_users update error:", upUserErr);
          return NextResponse.json(
            { ok: false, error: "Falha ao atualizar cadastro." },
            { status: 500 },
          );
        }
      } else {
        const { data: createdRow, error: insErr } = await sb
          .from("wz_users")
          .insert({
            email,
            full_name: fullName || null,
            cpf: cpf || null,
            phone_e164: phoneE164 || null,
            // (opcional) manter compatibilidade se existir coluna "phone"
            phone: onlyDigits(phoneE164).slice(-11),
            auth_user_id: authUserId,
            email_verified: true,
            phone_verified: true,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insErr || !createdRow?.id) {
          if (isUniqueViolation(insErr)) {
            return NextResponse.json(
              { ok: false, error: "CPF, telefone ou e-mail já possui cadastro." },
              { status: 409 },
            );
          }

          console.error("[verify-sms] wz_users insert error:", insErr);
          return NextResponse.json(
            { ok: false, error: "Falha ao salvar cadastro." },
            { status: 500 },
          );
        }

        userId = String(createdRow.id);
      }
    } catch (e: any) {
      console.error("[verify-sms] wz_users write exception:", e);
      return NextResponse.json(
        { ok: false, error: "Falha ao salvar cadastro." },
        { status: 500 },
      );
    }

    await sb.from("wz_pending_auth").delete().eq("email", email);

    const nextUrl = `${getDashboardOrigin()}/create-account`;

    const res = NextResponse.json({ ok: true, nextUrl }, { status: 200 });
    setSessionCookie(res, { userId: String(userId), email });

    return res;
  } catch (e: any) {
    console.error("[verify-sms] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Erro inesperado." },
      { status: 500 },
    );
  }
}
