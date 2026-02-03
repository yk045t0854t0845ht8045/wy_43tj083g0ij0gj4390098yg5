import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)"],
};

function isStaticAssetPath(pathname: string) {
  return /\.(?:png|svg|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|json|pdf|mp4|webm|mp3|wav|ogg|woff|woff2|ttf|otf|eot)$/i.test(
    pathname
  );
}

export default function proxy(req: NextRequest) {
  const hostHeader = (req.headers.get("host") || "").toLowerCase();
  const host = hostHeader.split(":")[0];
  const url = req.nextUrl.clone();

  // ✅ Não mexe em assets estáticos
  if (isStaticAssetPath(url.pathname)) return NextResponse.next();

  // ✅ Não mexe em rotas internas/arquivos comuns
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname === "/logo.ico" ||
    url.pathname === "/robots.txt" ||
    url.pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO LINK -> /link/*
  // -----------------------------
  const isLinkSubdomain =
    host === "link.wyzer.com.br" ||
    host === "link.localhost" ||
    host === "link.vercel.app" ||
    host.startsWith("link.") ||
    (host.startsWith("link-") && host.endsWith(".vercel.app"));

  if (!isLinkSubdomain && url.pathname.startsWith("/link")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  if (isLinkSubdomain) {
    if (url.pathname === "/link" || url.pathname.startsWith("/link/")) return NextResponse.next();
    const incomingPath = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/link${incomingPath}`;
    return NextResponse.rewrite(url);
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO TERMS -> /terms/*
  // -----------------------------
  const isTermsSubdomain =
    host === "terms.localhost" ||
    host === "terms.wyzer.com.br" ||
    host === "terms.vercel.app" ||
    host.startsWith("terms.") ||
    (host.startsWith("terms-") && host.endsWith(".vercel.app"));

  if (!isTermsSubdomain && url.pathname.startsWith("/terms")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  if (isTermsSubdomain) {
    if (url.pathname === "/terms" || url.pathname.startsWith("/terms/")) return NextResponse.next();
    const incomingPath = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/terms${incomingPath}`;
    return NextResponse.rewrite(url);
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO POLICY -> /policy/*
  // -----------------------------
  const isPolicySubdomain =
    host === "privacy.localhost" ||
    host === "privacy.wyzer.com.br" ||
    host === "privacy.vercel.app" ||
    host.startsWith("privacy.") ||
    (host.startsWith("privacy-") && host.endsWith(".vercel.app"));

  if (!isPolicySubdomain && url.pathname.startsWith("/privacy")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  if (isPolicySubdomain) {
    if (url.pathname === "/privacy" || url.pathname.startsWith("/privacy/")) return NextResponse.next();
    const incomingPath = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/privacy${incomingPath}`;
    return NextResponse.rewrite(url);
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO DASHBOARD -> /dashboard/*
  // -----------------------------
  const isDashboardSubdomain =
    host === "dashboard.localhost" ||
    host === "dashboard.wyzer.com.br" ||
    host === "dashboard.vercel.app" ||
    host.startsWith("dashboard.") ||
    (host.startsWith("dashboard-") && host.endsWith(".vercel.app"));

  // ✅ BLOQUEIA /dashboard no domínio principal
  if (!isDashboardSubdomain && url.pathname.startsWith("/dashboard")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  if (isDashboardSubdomain) {
    if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) return NextResponse.next();
    const incomingPath = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/dashboard${incomingPath}`;
    return NextResponse.rewrite(url);
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO LOGIN -> /login/*
  // -----------------------------
  const isLoginSubdomain =
    host === "login.localhost" ||
    host === "login.wyzer.com.br" ||
    host === "login.vercel.app" ||
    host.startsWith("login.") ||
    (host.startsWith("login-") && host.endsWith(".vercel.app"));

  // ✅ BLOQUEIA /login no domínio principal
  if (!isLoginSubdomain && url.pathname.startsWith("/login")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  if (isLoginSubdomain) {
    // ✅ se já tem cookie de sessão, manda direto pro dashboard
    const hasSession = !!req.cookies.get("wz_session_v1")?.value;

    if (hasSession && (url.pathname === "/" || url.pathname === "")) {
      // força troca de host
      const target =
        host.endsWith("wyzer.com.br")
          ? "http://dashboard.wyzer.com.br/create-account"
          : "https://dashboard.wyzer.com.br/create-account";

      return NextResponse.redirect(target);
    }

    if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return NextResponse.next();
    const incomingPath = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/login${incomingPath}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
