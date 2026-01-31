import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_supabase";
import { onlyDigits } from "../_codes";

/**
 * Mantido por compatibilidade.
 * Recomendado: use o fluxo /start (que cria Auth com senha) + verify-email + verify-sms.
 */
function isValidEmail(v: string) {
  const s = (v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = String(body?.email || "").trim().toLowerCase();
    const fullName = String(body?.fullName || "").trim();
    const phone = onlyDigits(body?.phone || "");
    const cpf = onlyDigits(body?.cpf || "");

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (fullName.length < 4) {
      return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    }
    if (phone.length < 10) {
      return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
    }
    if (cpf.length !== 11) {
      return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    }

    const sb = supabaseAdmin();

    // ✅ evita duplicar (e-mail, telefone e CPF)
    // Obs: para 100% de garantia contra corrida (2 requisições ao mesmo tempo),
    // crie UNIQUE no banco para email/phone/cpf. Ainda assim, fazemos validação aqui.
    const [existingEmail, existingPhone, existingCpf] = await Promise.all([
      sb.from("wz_users").select("id").eq("email", email).maybeSingle(),
      sb.from("wz_users").select("id").eq("phone", phone).maybeSingle(),
      sb.from("wz_users").select("id").eq("cpf", cpf).maybeSingle(),
    ]);

    if (existingEmail.error || existingPhone.error || existingCpf.error) {
      return NextResponse.json({ error: "Falha ao consultar cadastro." }, { status: 500 });
    }

    if (existingEmail.data?.id) {
      return NextResponse.json({ error: "Esse e-mail já possui cadastro." }, { status: 409 });
    }
    if (existingPhone.data?.id) {
      return NextResponse.json({ error: "Esse telefone já possui cadastro." }, { status: 409 });
    }
    if (existingCpf.data?.id) {
      return NextResponse.json({ error: "Esse CPF já possui cadastro." }, { status: 409 });
    }

    // Aqui NÃO cria Auth com senha (fluxo novo faz no /start).
    // Mantemos apenas a criação do perfil se você quiser usar essa rota separada.
    const { data: profile, error: profErr } = await sb
      .from("wz_users")
      .insert({
        email,
        full_name: fullName,
        phone,
        cpf,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (profErr) {
      // fallback: se existir UNIQUE no banco, aqui pode cair com violação de unicidade
      const isUniqueViolation =
        (profErr as any)?.code === "23505" ||
        String((profErr as any)?.message || "").toLowerCase().includes("duplicate key");

      if (isUniqueViolation) {
        return NextResponse.json(
          { error: "E-mail, telefone ou CPF já possui cadastro." },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: "Falha ao salvar cadastro." }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, userId: profile?.id ?? null, note: "Cadastro criado (rota legacy)." },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}
