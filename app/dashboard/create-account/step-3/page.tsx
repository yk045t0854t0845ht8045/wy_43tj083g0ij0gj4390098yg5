// app/create-account/step-3/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import OnboardCreateAccountClient3 from "../_components/OnboardCreateAccountClient-3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildLoginUrl(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();

  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://login.localhost:3000/";
  }

  if (host.endsWith(".wyzer.com.br")) {
    return "https://login.wyzer.com.br/";
  }

  return "https://login.wyzer.com.br/";
}

export default async function Step3Page() {
  const h = await headers();
  const loginUrl = buildLoginUrl(h.get("host"));
  const cookie = h.get("cookie") || "";

  const s = readSessionFromCookieHeader(cookie);
  if (!s) redirect(loginUrl);

  return (
    <OnboardCreateAccountClient3
      email={s.email}
      userId={s.userId}
      loginUrl={loginUrl}
    />
  );
}
