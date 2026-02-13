import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_supabase";
import {
  ACCOUNT_STATE_DEACTIVATED,
  canReactivateWithinWindow,
  canReuseEmailForRegister,
  resolveAccountLifecycleByEmail,
  syncAccountLifecycleIfNeeded,
} from "@/app/api/wz_users/_account_lifecycle";

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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const sb = supabaseAdmin();
    const lifecycle = await resolveAccountLifecycleByEmail({ sb, email });
    const syncedLifecycle = lifecycle
      ? await syncAccountLifecycleIfNeeded({ sb, record: lifecycle })
      : null;
    const canReuseEmail =
      syncedLifecycle?.state === ACCOUNT_STATE_DEACTIVATED
        ? canReuseEmailForRegister(syncedLifecycle)
        : false;
    const canReactivate = syncedLifecycle
      ? canReactivateWithinWindow(syncedLifecycle)
      : false;
    const exists = Boolean(syncedLifecycle) && !canReuseEmail;
    const hasPhone = exists && Boolean(String(syncedLifecycle?.phoneE164 || "").trim());

    return NextResponse.json(
      {
        exists,
        hasPhone,
        accountState: syncedLifecycle?.state || null,
        canReuseEmail,
        canReactivate,
        emailReuseAt: syncedLifecycle?.emailReuseAt || null,
        restoreDeadlineAt: syncedLifecycle?.restoreDeadlineAt || null,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
