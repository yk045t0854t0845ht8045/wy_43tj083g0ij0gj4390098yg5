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

  if (isStaticAssetPath(url.pathname)) return NextResponse.next();

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
    host === "policy.localhost" ||
    host === "policy.wyzer.com.br" ||
    host === "policy.vercel.app" ||
    host.startsWith("policy.") ||
    (host.startsWith("policy-") && host.endsWith(".vercel.app"));

  if (!isPolicySubdomain && url.pathname.startsWith("/policy")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  if (isPolicySubdomain) {
    if (url.pathname === "/policy" || url.pathname.startsWith("/policy/")) return NextResponse.next();
    const incomingPath = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/policy${incomingPath}`;
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

  // ✅ Só aplica rewrite especial se for login subdomain
  if (isLoginSubdomain) {
    // ✅ já está em /login? segue normal
    if (url.pathname === "/login" || url.pathname.startsWith("/login/")) {
      return NextResponse.next();
    }

    // ✅ mantém URL como "/" ou "/mail/ABC" etc,
    // mas internamente serve a partir de "/login/..."
    const incomingPath = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/login${incomingPath}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
