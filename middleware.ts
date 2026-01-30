import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    // tudo menos assets internos do Next e arquivos comuns
    "/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

export default function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const url = req.nextUrl.clone();

  const isLinkSubdomain =
    host === "link.wyzer.com.br" ||
    host === "link.localhost" ||
    host.startsWith("link.localhost:") ||
    host.startsWith("link.") && host.endsWith(".vercel.app");

    if (!isLinkSubdomain && url.pathname.startsWith("/link")) {
  url.pathname = "/404";
  return NextResponse.rewrite(url);
}


  if (!isLinkSubdomain) {
    return NextResponse.next();
  }

  // Ex.: "/" -> "/link"
  // Ex.: "/foo" -> "/link/foo"
  const incomingPath = url.pathname === "/" ? "" : url.pathname;
  url.pathname = `/link${incomingPath}`;

  return NextResponse.rewrite(url);
}
