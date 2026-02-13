import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromRequest } from "../_session";
import { supabaseAdmin } from "../_supabase";
import {
  ACCOUNT_STATE_DEACTIVATED,
  ACCOUNT_STATE_PENDING_DELETION,
  resolveAccountLifecycleBySession,
  syncAccountLifecycleIfNeeded,
} from "@/app/api/wz_users/_account_lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  const s = readSessionFromRequest(req);

  if (!s) {
    return NextResponse.json(
      { ok: false },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const sb = supabaseAdmin();
  const lifecycle = await resolveAccountLifecycleBySession({
    sb,
    sessionUserId: s.userId,
    sessionEmail: s.email,
  });

  if (!lifecycle) {
    return NextResponse.json(
      { ok: false, error: "Sessao sem conta valida." },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const syncedLifecycle = await syncAccountLifecycleIfNeeded({ sb, record: lifecycle });

  if (syncedLifecycle.state === ACCOUNT_STATE_PENDING_DELETION) {
    return NextResponse.json(
      {
        ok: false,
        requiresReactivation: true,
        accountState: syncedLifecycle.state,
        restoreDeadlineAt: syncedLifecycle.restoreDeadlineAt,
        error:
          "Esta conta esta em exclusao temporaria. Reative no prazo para voltar a usar o painel.",
      },
      {
        status: 409,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  if (syncedLifecycle.state === ACCOUNT_STATE_DEACTIVATED) {
    return NextResponse.json(
      {
        ok: false,
        requiresReactivation: false,
        accountState: syncedLifecycle.state,
        emailReuseAt: syncedLifecycle.emailReuseAt,
        deactivatedAt: syncedLifecycle.deactivatedAt,
        error:
          "Esta conta foi desativada e nao pode mais acessar o painel. Crie uma nova conta quando o prazo de reutilizacao do e-mail for liberado.",
      },
      {
        status: 409,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  return NextResponse.json(
    { ok: true, session: s },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}
