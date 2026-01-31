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
      console.error("[start] listUsers error:", error);
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    // dados cadastro
    const fullName = String(body?.fullName || "");
    const cpf = onlyDigits(String(body?.cpf || "")).slice(0, 11);
    const phoneDigits = onlyDigits(String(body?.phone || "")).slice(0, 11);

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "E-mail inválido." },
        { status: 400 },
      );
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Senha inválida." },
        { status: 400 },
      );
    }

    const admin = supabaseAdmin();

    // existe perfil?
    const { data: existingWz, error: exErr } = await admin
      .from("wz_users")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();

    if (exErr) console.error("[start] wz_users select error:", exErr);

    // ✅ se já existe em wz_users, sempre é login (não deixa “registrar por cima”)
    const flow = existingWz?.id ? "login" : "register";

    // ✅ LOGIN: valida senha antes de mandar o code
    if (flow === "login") {
      const anon = supabaseAnon();
      const { data: signIn, error: signErr } =
        await anon.auth.signInWithPassword({
          email,
          password,
        });

      if (signErr || !signIn?.user?.id) {
        const msg = String((signErr as any)?.message || "");
        if (!/email not confirmed/i.test(msg)) {
          return NextResponse.json(
            { ok: false, error: "Senha incorreta." },
            { status: 401 },
          );
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
          { status: 500 },
        );
      }
    }

    // ✅ REGISTER: valida CPF real + telefone BR válido (celular) + bloqueia duplicados
    if (flow === "register") {
      if (fullName.trim().length < 4) {
        return NextResponse.json(
          { ok: false, error: "Informe seu nome completo." },
          { status: 400 },
        );
      }

      if (!isValidCPF(cpf)) {
        return NextResponse.json(
          { ok: false, error: "CPF inválido." },
          { status: 400 },
        );
      }

      if (!isValidBRMobilePhoneDigits(phoneDigits)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Telefone inválido. Use um celular BR válido com DDD (11 dígitos).",
          },
          { status: 400 },
        );
      }

      const phoneE164 = toE164BRMobile(phoneDigits);
      if (!phoneE164) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Telefone inválido. Use um celular BR válido com DDD (11 dígitos).",
          },
          { status: 400 },
        );
      }

      // ✅ bloqueia duplicados antes de criar pending/auth
      const [dupCpf, dupPhone] = await Promise.all([
        admin
          .from("wz_users")
          .select("id,email")
          .eq("cpf", cpf)
          .maybeSingle(),
        admin
          .from("wz_users")
          .select("id,email")
          .eq("phone_e164", phoneE164)
          .maybeSingle(),
      ]);

      if (dupCpf.error || dupPhone.error) {
        console.error("[start] duplicate check error:", {
          cpf: dupCpf.error,
          phone: dupPhone.error,
        });
        return NextResponse.json(
          { ok: false, error: "Falha ao validar cadastro." },
          { status: 500 },
        );
      }

      if (dupCpf.data?.id) {
        return NextResponse.json(
          { ok: false, error: "Esse CPF já possui cadastro." },
          { status: 409 },
        );
      }

      if (dupPhone.data?.id) {
        return NextResponse.json(
          { ok: false, error: "Esse telefone já possui cadastro." },
          { status: 409 },
        );
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
          const code = String((created.error as any)?.code || "");
          console.error("[start] auth create error:", created.error);

          if (code === "email_exists" || /already been registered/i.test(msg)) {
            authUserId = await findAuthUserIdByEmail(admin, email);
          } else {
            return NextResponse.json(
              { ok: false, error: "Falha ao criar usuário de autenticação." },
              { status: 500 },
            );
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
        return NextResponse.json(
          { ok: false, error: "Falha ao iniciar cadastro." },
          { status: 500 },
        );
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
      return NextResponse.json(
        { ok: false, error: "Falha ao gerar código." },
        { status: 500 },
      );
    }

    await sendLoginCodeEmail(email, emailCode);
    return NextResponse.json({ ok: true, next: "email" }, { status: 200 });
  } catch (e: any) {
    console.error("[start] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Erro inesperado." },
      { status: 500 },
    );
  }
}
