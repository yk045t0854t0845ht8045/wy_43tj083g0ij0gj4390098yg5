import { NextRequest, NextResponse } from "next/server"

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)"],
}

function isStaticAssetPath(pathname: string) {
  return /\.(?:png|svg|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|json|pdf|mp4|webm|mp3|wav|ogg|woff|woff2|ttf|otf|eot)$/i.test(
    pathname
  )
}

function isSafeReturnTo(raw: string) {
  const value = String(raw || "").trim()
  if (!value) return false

  // bloqueia esquemas perigosos ou URLs "estranhas"
  if (
    value.startsWith("javascript:") ||
    value.startsWith("data:") ||
    value.startsWith("file:") ||
    value.startsWith("vbscript:")
  ) {
    return false
  }

  // permite apenas:
  // - caminho relativo (/algo)
  // - URL absoluta para domínios Wyzer / localhost / vercel preview compatíveis
  try {
    // relativo
    if (value.startsWith("/")) return true

    const u = new URL(value)

    // só http/https
    if (u.protocol !== "http:" && u.protocol !== "https:") return false

    const host = u.hostname.toLowerCase()

    const isWyzer =
      host === "wyzer.com.br" ||
      host.endsWith(".wyzer.com.br") ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".vercel.app") // previews
    if (!isWyzer) return false

    return true
  } catch {
    return false
  }
}

function getDashboardOriginForHost(host: string) {
  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://dashboard.localhost:3000"
  }
  return "https://dashboard.wyzer.com.br"
}

function hasLoginSessionCookie(req: NextRequest) {
  const hostToken = String(req.cookies.get("__Host-wz_session_v1")?.value || "").trim()
  if (hostToken.includes(".")) return true

  const legacyToken = String(req.cookies.get("wz_session_v1")?.value || "").trim()
  if (legacyToken.includes(".")) return true

  return false
}

function resolveLoginRedirectTarget(host: string, rawReturnTo: string | null) {
  const dashboardOrigin = getDashboardOriginForHost(host)
  const value = String(rawReturnTo || "").trim()
  if (!value) return `${dashboardOrigin}/`
  if (!isSafeReturnTo(value)) return `${dashboardOrigin}/`
  if (value.startsWith("/")) return new URL(value, `${dashboardOrigin}/`).toString()
  try {
    const target = new URL(value)
    const targetHost = target.hostname.toLowerCase()
    const isLoginHost =
      targetHost === "login.wyzer.com.br" ||
      targetHost === "login.localhost" ||
      targetHost.startsWith("login.") ||
      (targetHost.startsWith("login-") && targetHost.endsWith(".vercel.app"))

    if (isLoginHost) return `${dashboardOrigin}/`
    return target.toString()
  } catch {
    return `${dashboardOrigin}/`
  }
}

export default function proxy(req: NextRequest) {
  const hostHeader = (req.headers.get("host") || "").toLowerCase()
  const host = hostHeader.split(":")[0]
  const url = req.nextUrl.clone()

  // ✅ Não mexe em assets estáticos
  if (isStaticAssetPath(url.pathname)) return NextResponse.next()

  // ✅ Não mexe em rotas internas/arquivos comuns
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname === "/logo.ico" ||
    url.pathname === "/robots.txt" ||
    url.pathname === "/sitemap.xml"
  ) {
    return NextResponse.next()
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO LINK -> /link/*
  // -----------------------------
  const isLinkSubdomain =
    host === "link.wyzer.com.br" ||
    host === "link.localhost" ||
    host === "link.vercel.app" ||
    host.startsWith("link.") ||
    (host.startsWith("link-") && host.endsWith(".vercel.app"))

  if (!isLinkSubdomain && url.pathname.startsWith("/link")) {
    url.pathname = "/404"
    return NextResponse.rewrite(url)
  }

  if (isLinkSubdomain) {
    if (url.pathname === "/link" || url.pathname.startsWith("/link/"))
      return NextResponse.next()
    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/link${incomingPath}`
    return NextResponse.rewrite(url)
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO TERMS -> /terms/*
  // -----------------------------
  const isTermsSubdomain =
    host === "terms.localhost" ||
    host === "terms.wyzer.com.br" ||
    host === "terms.vercel.app" ||
    host.startsWith("terms.") ||
    (host.startsWith("terms-") && host.endsWith(".vercel.app"))

  if (!isTermsSubdomain && url.pathname.startsWith("/terms")) {
    url.pathname = "/404"
    return NextResponse.rewrite(url)
  }

  if (isTermsSubdomain) {
    if (url.pathname === "/terms" || url.pathname.startsWith("/terms/"))
      return NextResponse.next()
    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/terms${incomingPath}`
    return NextResponse.rewrite(url)
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO privacy -> /privacy/*
  // -----------------------------
  const isprivacySubdomain =
    host === "privacy.localhost" ||
    host === "privacy.wyzer.com.br" ||
    host === "privacy.vercel.app" ||
    host.startsWith("privacy.") ||
    (host.startsWith("privacy-") && host.endsWith(".vercel.app"))

  if (!isprivacySubdomain && url.pathname.startsWith("/privacy")) {
    url.pathname = "/404"
    return NextResponse.rewrite(url)
  }

  if (isprivacySubdomain) {
    if (url.pathname === "/privacy" || url.pathname.startsWith("/privacy/"))
      return NextResponse.next()
    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/privacy${incomingPath}`
    return NextResponse.rewrite(url)
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO DASHBOARD -> /dashboard/*
  // -----------------------------
  const isDashboardSubdomain =
    host === "dashboard.localhost" ||
    host === "dashboard.wyzer.com.br" ||
    host === "dashboard.vercel.app" ||
    host.startsWith("dashboard.") ||
    (host.startsWith("dashboard-") && host.endsWith(".vercel.app"))

  // ✅ BLOQUEIA /dashboard no domínio principal
  if (!isDashboardSubdomain && url.pathname.startsWith("/dashboard")) {
    url.pathname = "/404"
    return NextResponse.rewrite(url)
  }

  if (isDashboardSubdomain) {
    if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/"))
      return NextResponse.next()
    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/dashboard${incomingPath}`
    return NextResponse.rewrite(url)
  }

  // -----------------------------
  // ✅ SUBDOMÍNIO LOGIN -> /login/*
  // -----------------------------
  const isLoginSubdomain =
    host === "login.localhost" ||
    host === "login.wyzer.com.br" ||
    host === "login.vercel.app" ||
    host.startsWith("login.") ||
    (host.startsWith("login-") && host.endsWith(".vercel.app"))

  // ✅ BLOQUEIA /login no domínio principal
  if (!isLoginSubdomain && url.pathname.startsWith("/login")) {
    url.pathname = "/404"
    return NextResponse.rewrite(url)
  }

  if (isLoginSubdomain) {
    // ✅ também valida caso alguém tente /login?returnTo=...
    //    (não redireciona automaticamente, só “limpa” se for inseguro)
    const rt = req.nextUrl.searchParams.get("returnTo")
    if (rt && !isSafeReturnTo(rt)) {
      const cleaned = req.nextUrl.clone()
      cleaned.searchParams.delete("returnTo")
      cleaned.searchParams.delete("r")
      return NextResponse.redirect(cleaned)
    }

    const forceLogin = req.nextUrl.searchParams.get("forceLogin") === "1"
    if (!forceLogin && hasLoginSessionCookie(req)) {
      const target = resolveLoginRedirectTarget(host, rt)
      return NextResponse.redirect(target, 307)
    }

    if (url.pathname === "/login" || url.pathname.startsWith("/login/"))
      return NextResponse.next()

    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/login${incomingPath}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}
