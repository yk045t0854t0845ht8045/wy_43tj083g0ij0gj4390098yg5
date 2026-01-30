import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    // Mantém seu matcher, mas o bloqueio real de assets será feito dentro do middleware
    "/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

function isStaticAssetPath(pathname: string) {
  // Arquivos estáticos comuns + fontes + mapas + mídia
  // (se quiser, dá pra adicionar mais extensões aqui)
  return /\.(?:png|svg|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|json|pdf|mp4|webm|mp3|wav|ogg|woff|woff2|ttf|otf|eot)$/i.test(
    pathname
  );
}

// ✅ Proxy (antes: middleware)
export default function proxy(req: NextRequest) {
  const hostHeader = (req.headers.get("host") || "").toLowerCase();
  const host = hostHeader.split(":")[0]; // remove porta
  const url = req.nextUrl.clone();

  // ✅ Não mexe em assets estáticos (senão quebra /logo.png -> /link/logo.png)
  if (isStaticAssetPath(url.pathname)) {
    return NextResponse.next();
  }

  // ✅ Não mexe em rotas internas/arquivos comuns (redundância extra de segurança)
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname === "/logo.ico" ||
    url.pathname === "/robots.txt" ||
    url.pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const isLinkSubdomain =
    host === "link.wyzer.com.br" ||
    host === "link.localhost" ||
    host === "link.vercel.app" ||
    host.startsWith("link.") || // cobre link.* (inclui preview deployments)
    (host.startsWith("link-") && host.endsWith(".vercel.app")); // fallback pra alguns formatos

  // ✅ Bloqueia acesso ao /link no domínio principal
  if (!isLinkSubdomain && url.pathname.startsWith("/link")) {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  // ✅ Domínio normal segue normal
  if (!isLinkSubdomain) {
    return NextResponse.next();
  }

  // ✅ Já está em /link/... ? não reescreve de novo (evita duplicar /link/link/..)
  if (url.pathname === "/link" || url.pathname.startsWith("/link/")) {
    return NextResponse.next();
  }

  // ✅ Subdomínio: "/" -> "/link" e "/foo" -> "/link/foo"
  const incomingPath = url.pathname === "/" ? "" : url.pathname;
  url.pathname = `/link${incomingPath}`;

  return NextResponse.rewrite(url);
}
