// app/api/wz_OnboardSystem/save/route.ts
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import { readSessionFromRequest } from "@/app/api/wz_AuthLogin/_session";
import {
  jsonNoStore,
  normText,
  normalizeCompanySize,
  validateCnpjOptional,
  normalizeLanguages,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function hasOwn(o: any, k: string) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function enforceJsonContentType(req: NextRequest) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return jsonNoStore(
      { ok: false, error: "Content-Type deve ser application/json." },
      415,
    );
  }
  return null;
}

/**
 * CSRF/abuso: se o browser mandar Origin e não for da própria app, bloqueia.
 * (Não quebra chamadas server-to-server porque Origin pode vir vazio.)
 */
function enforceSameOriginIfPresent(req: NextRequest) {
  const origin = (req.headers.get("origin") || "").toLowerCase().trim();
  if (!origin) return null;

  const host = (req.headers.get("host") || "").toLowerCase().trim();
  if (!host) return null;

  // aceita exatamente a origem do host atual + localhost dev
  const allowed = new Set<string>([
    `https://${host}`,
    `http://${host}`,
    "http://localhost:3000",
    "http://dashboard.localhost:3000",
    "http://login.localhost:3000",
  ]);

  if (!allowed.has(origin)) {
    return jsonNoStore({ ok: false, error: "Origem não permitida." }, 403);
  }
  return null;
}

function readText(body: any, key: string, maxLen: number) {
  if (!hasOwn(body, key)) return { present: false as const, value: null as any };

  const raw = body[key];

  // permite null / undefined para “limpar”
  if (raw === null || raw === undefined) return { present: true as const, value: null };

  if (typeof raw !== "string") {
    return { present: true as const, error: `Campo ${key} inválido.` };
  }

  const v = normText(raw);
  if (v && v.length > maxLen) {
    return { present: true as const, error: `Campo ${key} muito longo.` };
  }

  return { present: true as const, value: v };
}

function readBooleanNullable(body: any, key: string) {
  if (!hasOwn(body, key)) return { present: false as const, value: null as any };

  const raw = body[key];
  if (raw === null || raw === undefined) return { present: true as const, value: null };
  if (raw === true) return { present: true as const, value: true };
  if (raw === false) return { present: true as const, value: false };

  return { present: true as const, error: `Campo ${key} inválido.` };
}

function readCompanySize(body: any, key: string) {
  if (!hasOwn(body, key)) return { present: false as const, value: null as any };

  const raw = body[key];
  if (raw === null || raw === undefined || raw === "") {
    return { present: true as const, value: null };
  }

  const v = normalizeCompanySize(raw);

  // aqui é “hard”: se veio, tem que ser válido (evita abuso)
  if (v === null) {
    return { present: true as const, error: `Campo ${key} inválido.` };
  }

  return { present: true as const, value: v };
}

function readLanguages(body: any, key: string) {
  if (!hasOwn(body, key)) return { present: false as const, value: null as any };

  const raw = body[key];
  if (raw === null || raw === undefined) return { present: true as const, value: null };

  if (!Array.isArray(raw)) {
    return { present: true as const, error: `Campo ${key} inválido.` };
  }

  // normalizeLanguages filtra/normaliza e pode virar null se vazio
  const v = normalizeLanguages(raw);
  return { present: true as const, value: v };
}

function limitKeyCount(body: Record<string, any>, maxKeys = 20) {
  // evita payload gigante / mass assignment (mesmo ignorando chaves)
  const keys = Object.keys(body);
  if (keys.length > maxKeys) {
    return jsonNoStore({ ok: false, error: "Payload inválido." }, 400);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const s = readSessionFromRequest(req);
  if (!s) return jsonNoStore({ ok: false }, 401);

  // Content-Type e Origin (se existir)
  const ctErr = enforceJsonContentType(req);
  if (ctErr) return ctErr;

  const originErr = enforceSameOriginIfPresent(req);
  if (originErr) return originErr;

  try {
    const raw = await req.json().catch(() => ({}));
    if (!isPlainObject(raw)) {
      return jsonNoStore({ ok: false, error: "Payload inválido." }, 400);
    }

    const tooMany = limitKeyCount(raw, 20);
    if (tooMany) return tooMany;

    // Patch: só atualiza o que vier no body (não apaga o resto)
    const patch: Record<string, any> = {};
    const now = new Date().toISOString();

    // ---------------------------
    // step-1 (validação forte)
    // ---------------------------
    const companyName = readText(raw, "companyName", 120);
    if (companyName.present && "error" in companyName)
      return jsonNoStore({ ok: false, error: companyName.error }, 400);
    if (companyName.present) patch.company_name = companyName.value;

    const tradeName = readText(raw, "tradeName", 120);
    if (tradeName.present && "error" in tradeName)
      return jsonNoStore({ ok: false, error: tradeName.error }, 400);
    if (tradeName.present) patch.trade_name = tradeName.value;

    const websiteOrInstagram = readText(raw, "websiteOrInstagram", 180);
    if (websiteOrInstagram.present && "error" in websiteOrInstagram)
      return jsonNoStore({ ok: false, error: websiteOrInstagram.error }, 400);
    if (websiteOrInstagram.present)
      patch.website_or_instagram = websiteOrInstagram.value;

    const segment = readText(raw, "segment", 80);
    if (segment.present && "error" in segment)
      return jsonNoStore({ ok: false, error: segment.error }, 400);
    if (segment.present) patch.segment = segment.value;

    const companySize = readCompanySize(raw, "companySize");
    if (companySize.present && "error" in companySize)
      return jsonNoStore({ ok: false, error: companySize.error }, 400);
    if (companySize.present) patch.company_size = companySize.value;

    if (hasOwn(raw, "cnpj")) {
      const cnpjCheck = validateCnpjOptional(raw.cnpj);
      if (!cnpjCheck.ok)
        return jsonNoStore({ ok: false, error: cnpjCheck.message }, 400);
      patch.cnpj = cnpjCheck.value;
    }

    // ---------------------------
    // step-2 (validação forte)
    // ---------------------------
    const mainUse = readText(raw, "mainUse", 120);
    if (mainUse.present && "error" in mainUse)
      return jsonNoStore({ ok: false, error: mainUse.error }, 400);
    if (mainUse.present) patch.main_use = mainUse.value;

    const priorityNow = readText(raw, "priorityNow", 120);
    if (priorityNow.present && "error" in priorityNow)
      return jsonNoStore({ ok: false, error: priorityNow.error }, 400);
    if (priorityNow.present) patch.priority_now = priorityNow.value;

    const hasSupervisor = readBooleanNullable(raw, "hasSupervisor");
    if (hasSupervisor.present && "error" in hasSupervisor)
      return jsonNoStore({ ok: false, error: hasSupervisor.error }, 400);
    if (hasSupervisor.present) patch.has_supervisor = hasSupervisor.value;

    const serviceHours = readText(raw, "serviceHours", 80);
    if (serviceHours.present && "error" in serviceHours)
      return jsonNoStore({ ok: false, error: serviceHours.error }, 400);
    if (serviceHours.present) patch.service_hours = serviceHours.value;

    const targetResponseTime = readText(raw, "targetResponseTime", 80);
    if (targetResponseTime.present && "error" in targetResponseTime)
      return jsonNoStore({ ok: false, error: targetResponseTime.error }, 400);
    if (targetResponseTime.present)
      patch.target_response_time = targetResponseTime.value;

    const languages = readLanguages(raw, "languages");
    if (languages.present && "error" in languages)
      return jsonNoStore({ ok: false, error: languages.error }, 400);
    if (languages.present) patch.languages = languages.value;

    // se não veio nada que a API entende, não faz write
    const patchKeys = Object.keys(patch);
    if (!patchKeys.length) {
      return jsonNoStore({ ok: false, error: "Nada para salvar." }, 400);
    }

    // updated_at sempre
    patch.updated_at = now;

    const sb = supabaseAdmin();

    // Pega estado atual (proteções extras)
    const { data: current, error: currentErr } = await sb
      .from("wz_onboarding")
      .select("user_id,completed,updated_at")
      .eq("user_id", s.userId)
      .maybeSingle();

    if (currentErr) {
      return jsonNoStore(
        { ok: false, error: currentErr.message || "Falha ao buscar onboarding." },
        500,
      );
    }

    // Se já completou, trava (impede “descompletar” via abuso)
    if (current?.completed === true) {
      return jsonNoStore(
        { ok: false, error: "Onboarding já foi finalizado." },
        409,
      );
    }

    // Throttle simples por usuário (evita spam/abuso no save)
    // (bem leve pra não atrapalhar seu debounce 260ms)
    if (current?.updated_at) {
      const last = Date.parse(String(current.updated_at));
      const nowMs = Date.parse(now);
      if (Number.isFinite(last) && Number.isFinite(nowMs) && nowMs - last < 150) {
        return jsonNoStore(
          { ok: false, error: "Muitas requisições. Tente novamente." },
          429,
        );
      }
    }

    if (current?.user_id) {
      const { error } = await sb
        .from("wz_onboarding")
        .update(patch)
        .eq("user_id", s.userId);

      if (error) return jsonNoStore({ ok: false, error: error.message }, 500);
    } else {
      const { error } = await sb.from("wz_onboarding").insert({
        user_id: s.userId,
        email: s.email,
        created_at: now,
        completed: false,
        ...patch,
      });

      if (error) return jsonNoStore({ ok: false, error: error.message }, 500);
    }

    return jsonNoStore({ ok: true }, 200);
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: e?.message || "Erro inesperado." },
      500,
    );
  }
}
