import { NextRequest, NextResponse } from "next/server"

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)"],
}

const GOOGLE_STATE_COOKIE_NAME = "wz_google_oauth_state_v1"
const GOOGLE_CONNECT_STATE_COOKIE_NAME = "wz_google_oauth_connect_state_v1"
const AZURE_STATE_COOKIE_NAME = "wz_azure_oauth_state_v1"
const AZURE_CONNECT_STATE_COOKIE_NAME = "wz_azure_oauth_connect_state_v1"

function isStaticAssetPath(pathname: string) {
  return /\.(?:png|svg|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|json|pdf|mp4|webm|mp3|wav|ogg|woff|woff2|ttf|otf|eot)$/i.test(
    pathname
  )
}

function isSafeReturnTo(raw: string) {
  const value = String(raw || "").trim()
  if (!value) return false

  if (
    value.startsWith("javascript:") ||
    value.startsWith("data:") ||
    value.startsWith("file:") ||
    value.startsWith("vbscript:")
  ) {
    return false
  }

  try {
    if (value.startsWith("/")) return true

    const u = new URL(value)
    if (u.protocol !== "http:" && u.protocol !== "https:") return false

    const host = u.hostname.toLowerCase()
    return (
      host === "wyzer.com.br" ||
      host.endsWith(".wyzer.com.br") ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".vercel.app")
    )
  } catch {
    return false
  }
}

function hasLoginSessionCookie(req: NextRequest) {
  const hostToken = String(req.cookies.get("__Host-wz_session_v1")?.value || "").trim()
  if (hostToken.includes(".")) return true

  const legacyToken = String(req.cookies.get("wz_session_v1")?.value || "").trim()
  if (legacyToken.includes(".")) return true

  return false
}

function hasGoogleOAuthStateCookie(req: NextRequest) {
  const token = String(req.cookies.get(GOOGLE_STATE_COOKIE_NAME)?.value || "").trim()
  if (token.includes(".")) return true

  const connectToken = String(req.cookies.get(GOOGLE_CONNECT_STATE_COOKIE_NAME)?.value || "").trim()
  return connectToken.includes(".")
}

function hasAzureOAuthStateCookie(req: NextRequest) {
  const token = String(req.cookies.get(AZURE_STATE_COOKIE_NAME)?.value || "").trim()
  if (token.includes(".")) return true

  const connectToken = String(req.cookies.get(AZURE_CONNECT_STATE_COOKIE_NAME)?.value || "").trim()
  return connectToken.includes(".")
}

function base64UrlDecodeToString(input: string) {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/")
  const pad = "=".repeat((4 - (normalized.length % 4)) % 4)
  return atob(normalized + pad)
}

function inferOAuthProviderFromStateTicket(ticket: string) {
  const token = String(ticket || "").trim()
  if (!token.includes(".")) return null

  const [payloadB64] = token.split(".")
  if (!payloadB64) return null

  try {
    const parsed = JSON.parse(base64UrlDecodeToString(payloadB64)) as { typ?: string | null }
    const type = String(parsed?.typ || "").trim().toLowerCase()
    if (type === "wz-google-oauth-state") return "google"
    if (type === "wz-azure-oauth-state") return "azure"
  } catch {}

  return null
}

function resolveOAuthRelayProvider(req: NextRequest, pathname: string) {
  const isAlreadyCallback =
    pathname.startsWith("/api/wz_AuthLogin/google/callback") ||
    pathname.startsWith("/api/wz-auth/google/callback") ||
    pathname.startsWith("/api/wz_AuthLogin/azure/callback") ||
    pathname.startsWith("/api/wz-auth/azure/callback")
  if (isAlreadyCallback) return null

  const code = String(req.nextUrl.searchParams.get("code") || "").trim()
  const error = String(req.nextUrl.searchParams.get("error") || "").trim()
  const errorDescription = String(req.nextUrl.searchParams.get("error_description") || "").trim()
  const hasOAuthParams = Boolean(code || error || errorDescription)
  if (!hasOAuthParams) return null

  const providerFromState = inferOAuthProviderFromStateTicket(
    String(req.nextUrl.searchParams.get("st") || "").trim()
  )
  if (providerFromState) return providerFromState

  const hasGoogleState = hasGoogleOAuthStateCookie(req)
  const hasAzureState = hasAzureOAuthStateCookie(req)

  if (hasGoogleState && !hasAzureState) return "google"
  if (hasAzureState && !hasGoogleState) return "azure"

  return null
}

function buildLoginSessionContinueUrl(req: NextRequest, rawReturnTo: string | null) {
  const target = req.nextUrl.clone()
  target.pathname = "/api/wz_AuthLogin/continue"
  target.search = ""

  const value = String(rawReturnTo || "").trim()
  if (value && isSafeReturnTo(value)) {
    target.searchParams.set("next", value)
  }

  return target.toString()
}

export default function proxy(req: NextRequest) {
  const hostHeader = (req.headers.get("host") || "").toLowerCase()
  const host = hostHeader.split(":")[0]
  const url = req.nextUrl.clone()

  if (isStaticAssetPath(url.pathname)) return NextResponse.next()

  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname === "/logo.ico" ||
    url.pathname === "/robots.txt" ||
    url.pathname === "/sitemap.xml"
  ) {
    return NextResponse.next()
  }

  const oauthRelayProvider = resolveOAuthRelayProvider(req, url.pathname)
  if (oauthRelayProvider) {
    const target = req.nextUrl.clone()
    target.pathname =
      oauthRelayProvider === "azure"
        ? "/api/wz_AuthLogin/azure/callback"
        : "/api/wz_AuthLogin/google/callback"
    return NextResponse.redirect(target, 307)
  }

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
    if (url.pathname === "/link" || url.pathname.startsWith("/link/")) {
      return NextResponse.next()
    }
    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/link${incomingPath}`
    return NextResponse.rewrite(url)
  }

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
    if (url.pathname === "/terms" || url.pathname.startsWith("/terms/")) {
      return NextResponse.next()
    }
    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/terms${incomingPath}`
    return NextResponse.rewrite(url)
  }

  const isPrivacySubdomain =
    host === "privacy.localhost" ||
    host === "privacy.wyzer.com.br" ||
    host === "privacy.vercel.app" ||
    host.startsWith("privacy.") ||
    (host.startsWith("privacy-") && host.endsWith(".vercel.app"))

  if (!isPrivacySubdomain && url.pathname.startsWith("/privacy")) {
    url.pathname = "/404"
    return NextResponse.rewrite(url)
  }

  if (isPrivacySubdomain) {
    if (url.pathname === "/privacy" || url.pathname.startsWith("/privacy/")) {
      return NextResponse.next()
    }
    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/privacy${incomingPath}`
    return NextResponse.rewrite(url)
  }

  const isDashboardSubdomain =
    host === "dashboard.localhost" ||
    host === "dashboard.wyzer.com.br" ||
    host === "dashboard.vercel.app" ||
    host.startsWith("dashboard.") ||
    (host.startsWith("dashboard-") && host.endsWith(".vercel.app"))

  if (!isDashboardSubdomain && url.pathname.startsWith("/dashboard")) {
    url.pathname = "/404"
    return NextResponse.rewrite(url)
  }

  if (isDashboardSubdomain) {
    if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) {
      return NextResponse.next()
    }
    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/dashboard${incomingPath}`
    return NextResponse.rewrite(url)
  }

  const isLoginSubdomain =
    host === "login.localhost" ||
    host === "login.wyzer.com.br" ||
    host === "login.vercel.app" ||
    host.startsWith("login.") ||
    (host.startsWith("login-") && host.endsWith(".vercel.app"))

  if (!isLoginSubdomain && url.pathname.startsWith("/login")) {
    url.pathname = "/404"
    return NextResponse.rewrite(url)
  }

  if (isLoginSubdomain) {
    const rt = req.nextUrl.searchParams.get("returnTo")
    if (rt && !isSafeReturnTo(rt)) {
      const cleaned = req.nextUrl.clone()
      cleaned.searchParams.delete("returnTo")
      cleaned.searchParams.delete("r")
      return NextResponse.redirect(cleaned)
    }

    const forceLogin = req.nextUrl.searchParams.get("forceLogin") === "1"
    if (!forceLogin && hasLoginSessionCookie(req)) {
      const target = buildLoginSessionContinueUrl(req, rt)
      return NextResponse.redirect(target, 307)
    }

    if (url.pathname === "/login" || url.pathname.startsWith("/login/")) {
      return NextResponse.next()
    }

    const incomingPath = url.pathname === "/" ? "" : url.pathname
    url.pathname = `/login${incomingPath}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}
