import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)"],
};

function isStaticAssetPath(pathname: string) {
  return /\.(?:png|svg|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|json|pdf|mp4|webm|mp3|wav|ogg|woff|woff2|ttf|otf|eot)$/i.test(
    pathname
  );
}

// ✅ Proxy (antes: middleware)
export default function proxy(req: NextRequest) {
  const hostHeader = (req.headers.get("host") || "").toLowerCase();
  const host = hostHeader.split(":")[0]; // remove porta
  const url = req.nextUrl.clone();

  // ✅ Não mexe em assets estáticos
  if (isStaticAssetPath(url.pathname)) {
    return NextResponse.next();
  }

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

  // ✅ Bloqueia acesso ao /link no domínio principal
  if (!isLinkSubdomain && url.pathname.startsWith("/link")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  // ✅ Se for link subdomain, reescreve para /link
  if (isLinkSubdomain) {
    // já está em /link?
    if (url.pathname === "/link" || url.pathname.startsWith("/link/")) {
      return NextResponse.next();
    }

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

  // ✅ Bloqueia /terms no domínio principal
  if (!isTermsSubdomain && url.pathname.startsWith("/terms")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  // ✅ Se for terms subdomain, reescreve para /terms
  if (isTermsSubdomain) {
    // já está em /terms?
    if (url.pathname === "/terms" || url.pathname.startsWith("/terms/")) {
      return NextResponse.next();
    }

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

  // ✅ Bloqueia /policy no domínio principal
  if (!isPolicySubdomain && url.pathname.startsWith("/policy")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  // ✅ Se for policy subdomain, reescreve para /policy
  if (isPolicySubdomain) {
    // já está em /policy?
    if (url.pathname === "/policy" || url.pathname.startsWith("/policy/")) {
      return NextResponse.next();
    }

    const incomingPath = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/policy${incomingPath}`;
    return NextResponse.rewrite(url);
  }

  // ✅ Domínio normal segue normal
  return NextResponse.next();
}
