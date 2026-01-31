import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_supabase";
import { onlyDigits, normalizePhoneDigitsBR, toE164BR } from "../_codes";

/**
 * Mantido por compatibilidade.
 * Recomendado: use o fluxo /start + /verify-email + /verify-sms.
 */
function isValidEmail(v: string) {
  const s = (v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
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
    const fullName = String(body?.fullName || "").trim();
    const phoneDigits = normalizePhoneDigitsBR(String(body?.phone || ""));
    const phoneE164 = phoneDigits ? toE164BR(phoneDigits) : null;
    const cpf = onlyDigits(body?.cpf || "").slice(0, 11);

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (fullName.length < 4) {
      return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    }
    if (!phoneDigits || phoneDigits.length < 10 || !phoneE164) {
      return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
    }
    if (cpf.length !== 11) {
      return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    }

    const sb = supabaseAdmin();

    // ✅ evita duplicar (e-mail, telefone e CPF)
    const [existingEmail, existingCpf, existingPhone] = await Promise.all([
      sb.from("wz_users").select("id").eq("email", email).limit(1),
      sb.from("wz_users").select("id").eq("cpf", cpf).limit(1),
      sb
        .from("wz_users")
        .select("id")
        .or(`phone_e164.eq.${phoneE164},phone.eq.${phoneDigits}`)
        .limit(1),
    ]);

    if (existingEmail.error || existingCpf.error || existingPhone.error) {
      return NextResponse.json(
        { error: "Falha ao consultar cadastro." },
        { status: 500 },
      );
    }

    if (existingEmail.data?.[0]?.id) {
      return NextResponse.json(
        { error: "Esse e-mail já possui cadastro." },
        { status: 409 },
      );
    }
    if (existingCpf.data?.[0]?.id) {
      return NextResponse.json(
        { error: "Esse CPF já possui cadastro." },
        { status: 409 },
      );
    }
    if (existingPhone.data?.[0]?.id) {
      return NextResponse.json(
        { error: "Esse telefone já possui cadastro." },
        { status: 409 },
      );
    }

    const { data: profile, error: profErr } = await sb
      .from("wz_users")
      .insert({
        email,
        full_name: fullName,
        cpf,
        phone_e164: phoneE164,
        // (opcional) compat
        phone: phoneDigits,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (profErr) {
      if (isUniqueViolation(profErr)) {
        return NextResponse.json(
          { error: "E-mail, telefone ou CPF já possui cadastro." },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "Falha ao salvar cadastro." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, userId: profile?.id ?? null, note: "Cadastro criado (rota legacy)." },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}
