import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";

export const dynamic = "force-dynamic";

function buildLoginUrl(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();

  // local/dev
  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://login.localhost:3000/";
  }

  // prod
  if (host.endsWith(".wyzer.com.br")) {
    return "https://login.wyzer.com.br/";
  }

  // fallback
  return "https://login.wyzer.com.br/";
}

function pickHostHeader(h: { get(name: string): string | null }) {
  // Em proxy/CDN o host real costuma vir em x-forwarded-host
  return h.get("x-forwarded-host") || h.get("host");
}

export default async function CreateAccountDashboardPage() {
  // ✅ Next 16: garanta await para evitar "vermelho" e problemas de tipagem
  const h = await headers();

  const cookieHeader = h.get("cookie");

  // ✅ "HeaderLike" compatível com teu _session (só precisa de .get)
  const headerLike: { get(name: string): string | null } = {
    get: (name: string) => h.get(name),
  };

  // ✅ passa headers para validar bind UA/IP quando ligado por ENV
  const session = readSessionFromCookieHeader(cookieHeader, headerLike);

  if (!session) {
    const hostHeader = pickHostHeader(headerLike);
    const loginUrl = buildLoginUrl(hostHeader);

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
        <div className="text-black font-semibold text-[26px]">Conta</div>

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

        <form action="/api/wz_AuthLogin/logout" method="post" className="mt-8">
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
