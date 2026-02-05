import { NextRequest, NextResponse } from "next/server"

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)"],
}

function isStaticAssetPath(pathname: string) {
  return /\.(?:png|svg|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|json|pdf|mp4|webm|mp3|wav|ogg|woff|woff2|ttf|otf|eot)$/i.test(
    pathname
  )
}

function getProto(req: NextRequest) {
  // Vercel/Proxy comum
  const xfProto = (req.headers.get("x-forwarded-proto") || "").toLowerCase()
  if (xfProto === "https" || xfProto === "http") return xfProto
  // fallback
  const p = (req.nextUrl.protocol || "https:").replace(":", "")
  return p === "http" ? "http" : "https"
}

function isSafeReturnTo(req: NextRequest, raw: string) {
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

function normalizeReturnTo(req: NextRequest, returnTo: string) {
  const value = String(returnTo || "").trim()
  if (!value) return ""

  // se for relativo, transforma em absoluto no host atual
  if (value.startsWith("/")) {
    const proto = getProto(req)
    const host = (req.headers.get("host") || "").split(":")[0]
    return `${proto}://${host}${value}`
  }

  // absoluto, retorna como está (já validado antes)
  return value
}

function buildDashboardHomeUrl(req: NextRequest) {
  const proto = getProto(req)
  const hostHeader = (req.headers.get("host") || "").toLowerCase()
  const host = hostHeader.split(":")[0]

  // local/dev -> dashboard.localhost
  if (host.endsWith(".localhost") || host === "localhost") {
    return `${proto}://dashboard.localhost:3000/`
  }

  // prod
  return `${proto}://dashboard.wyzer.com.br/`
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
    const hasSession = !!req.cookies.get("wz_session_v1")?.value

    // ✅ se já tem sessão e entrou na HOME do login,
    //    NÃO manda direto sem validar "returnTo".
    //    - se tiver returnTo seguro, volta pra ele
    //    - se não, manda pro dashboard (home)
    if (hasSession && (url.pathname === "/" || url.pathname === "")) {
      const returnToRaw =
        req.nextUrl.searchParams.get("returnTo") ||
        req.nextUrl.searchParams.get("r") ||
        ""

      const canUseReturnTo = returnToRaw && isSafeReturnTo(req, returnToRaw)

      const target = canUseReturnTo
        ? normalizeReturnTo(req, returnToRaw)
        : buildDashboardHomeUrl(req)

      return NextResponse.redirect(target)
    }

    // ✅ também valida caso alguém tente /login?returnTo=...
    //    (não redireciona automaticamente, só “limpa” se for inseguro)
    const rt = req.nextUrl.searchParams.get("returnTo")
    if (rt && !isSafeReturnTo(req, rt)) {
      const cleaned = req.nextUrl.clone()
      cleaned.searchParams.delete("returnTo")
      cleaned.searchParams.delete("r")
      return NextResponse.redirect(cleaned)
    }

    if (url.pathname === "/login" || url.pathname.startsWith("/login/"))
      return NextResponse.next()

    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/login${incomingPath}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}
