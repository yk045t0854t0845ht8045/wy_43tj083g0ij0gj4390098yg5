import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";

export const dynamic = "force-dynamic";

function buildLoginUrl(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();

  // dev
  if (host === "dashboard.wyzer.com.br" || host.endsWith(".wyzer.com.br")) {
    return "http://login.wyzer.com.br";
  }

  // prod (ajuste se seu domínio final for outro)
  if (host.endsWith(".wyzer.com.br")) {
    return "https://login.wyzer.com.br/";
  }

  // fallback
  return "/";
}

export default async function CreateAccountDashboardPage() {
  const h = await headers();
  const cookieHeader = h.get("cookie");
const session = readSessionFromCookieHeader(cookieHeader, { headers: h });

  if (!session) {
    const loginUrl = buildLoginUrl(h.get("host"));

    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-black font-semibold text-[22px]">
            Sessão expirada
          </div>
          <div className="mt-2 text-black/60 text-[14px]">
            Faça login novamente.
          </div>

          <div className="mt-6">
            <Link
              href={loginUrl}
              className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-black text-white text-[14px] font-semibold"
            >
              Ir para Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="text-center max-w-[520px] w-full">
        <div className="text-black font-semibold text-[26px]">
          Conta
        </div>

        <div className="mt-6 rounded-[18px] bg-black/[0.04] ring-1 ring-black/10 px-5 py-4 text-left">
          <div className="text-[13px] text-black/60">User ID</div>
          <div className="text-[15px] font-semibold text-black break-all">
            {session.userId}
          </div>

          <div className="mt-4 text-[13px] text-black/60">E-mail</div>
          <div className="text-[15px] font-semibold text-black break-all">
            {session.email}
          </div>
        </div>

        <form
          action="/api/wz_AuthLogin/logout"
          method="post"
          className="mt-8"
        >
          <button
            type="submit"
            className="w-full rounded-full px-6 py-4 bg-black text-white text-[14px] font-semibold"
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
