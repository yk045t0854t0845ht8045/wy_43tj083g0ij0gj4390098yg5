import crypto from "crypto";

export type HeaderLike = { get(name: string): string | null } | null | undefined;

export type DeviceKind = "desktop" | "mobile" | "tablet" | "bot" | "unknown";

export type DeviceIdentity = {
  fingerprint: string;
  kind: DeviceKind;
  platform: string | null;
  osFamily: string | null;
  osVersion: string | null;
  browserFamily: string | null;
  browserVersion: string | null;
  label: string;
  userAgent: string;
  ip: string | null;
  location: string | null;
  host: string | null;
};

function headerGet(headers: HeaderLike, name: string) {
  return String(headers?.get(name) || "").trim();
}

function normalizeWhitespace(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeUriComponentSafe(value: string) {
  let out = String(value || "");
  for (let i = 0; i < 2; i += 1) {
    if (!/%[0-9a-f]{2}/i.test(out)) break;
    try {
      const decoded = decodeURIComponent(out);
      if (!decoded || decoded === out) break;
      out = decoded;
    } catch {
      break;
    }
  }
  return out;
}

function normalizeLocationPart(value: string) {
  const spaced = String(value || "").replace(/\+/g, " ");
  return normalizeWhitespace(decodeUriComponentSafe(spaced));
}

function normalizeUserAgent(value: string) {
  const clean = normalizeWhitespace(value);
  if (!clean) return "";
  return clean.slice(0, 1024);
}

function normalizeHost(headers: HeaderLike) {
  const hostRaw =
    headerGet(headers, "x-forwarded-host") ||
    headerGet(headers, "host") ||
    "";
  const first = hostRaw.split(",")[0]?.trim() || "";
  if (!first) return null;
  return first.toLowerCase();
}

function normalizeIp(raw: string) {
  let ip = String(raw || "").trim();
  if (!ip) return "";

  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }

  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) {
    ip = ip.split(":")[0] || ip;
  }

  return ip.trim();
}

function resolveClientIp(headers: HeaderLike) {
  const cf = normalizeIp(headerGet(headers, "cf-connecting-ip"));
  if (cf) return cf;

  const real = normalizeIp(headerGet(headers, "x-real-ip"));
  const xff = String(headerGet(headers, "x-forwarded-for") || "")
    .split(",")[0]
    ?.trim();
  const xffIp = normalizeIp(xff || "");

  return xffIp || real || null;
}

function resolveLocation(headers: HeaderLike) {
  const city = normalizeLocationPart(headerGet(headers, "x-vercel-ip-city"));
  const region = normalizeLocationPart(headerGet(headers, "x-vercel-ip-country-region"));
  const country =
    normalizeLocationPart(headerGet(headers, "x-vercel-ip-country")) ||
    normalizeLocationPart(headerGet(headers, "cf-ipcountry"));

  const parts = [city, region, country].filter(Boolean);
  if (parts.length) return parts.join(", ").slice(0, 240);

  return null;
}

function pickVersionFromMatch(match: RegExpMatchArray | null) {
  if (!match) return null;
  const value = String(match[1] || "").trim();
  return value || null;
}

function parseOs(userAgent: string) {
  const ua = userAgent;

  if (/android/i.test(ua)) {
    return {
      family: "Android",
      version: pickVersionFromMatch(ua.match(/Android\s+([\d._]+)/i)),
    };
  }
  if (/(iPhone|iPad|iPod)/i.test(ua)) {
    const ios = pickVersionFromMatch(ua.match(/OS\s+([\d_]+)/i));
    return { family: "iOS", version: ios ? ios.replace(/_/g, ".") : null };
  }
  if (/Windows NT/i.test(ua)) {
    const ntVersion = pickVersionFromMatch(ua.match(/Windows NT\s+([\d.]+)/i));
    const mapped =
      ntVersion === "10.0"
        ? "10/11"
        : ntVersion === "6.3"
          ? "8.1"
          : ntVersion === "6.2"
            ? "8"
            : ntVersion === "6.1"
              ? "7"
              : ntVersion;
    return { family: "Windows", version: mapped || null };
  }
  if (/Mac OS X/i.test(ua) || /Macintosh/i.test(ua)) {
    const mac = pickVersionFromMatch(ua.match(/Mac OS X\s+([\d_]+)/i));
    return { family: "macOS", version: mac ? mac.replace(/_/g, ".") : null };
  }
  if (/CrOS/i.test(ua)) {
    const cros = pickVersionFromMatch(ua.match(/CrOS\s+[^\s]+\s+([\d.]+)/i));
    return { family: "ChromeOS", version: cros };
  }
  if (/Linux/i.test(ua)) {
    return { family: "Linux", version: null };
  }

  return { family: null, version: null };
}

function parseBrowser(userAgent: string) {
  const ua = userAgent;

  const edge =
    pickVersionFromMatch(ua.match(/EdgA?\/([\d.]+)/i)) ||
    pickVersionFromMatch(ua.match(/EdgiOS\/([\d.]+)/i));
  if (edge) return { family: "Edge", version: edge };

  const opera = pickVersionFromMatch(ua.match(/OPR\/([\d.]+)/i));
  if (opera) return { family: "Opera", version: opera };

  const samsung = pickVersionFromMatch(ua.match(/SamsungBrowser\/([\d.]+)/i));
  if (samsung) return { family: "Samsung Internet", version: samsung };

  const firefox =
    pickVersionFromMatch(ua.match(/Firefox\/([\d.]+)/i)) ||
    pickVersionFromMatch(ua.match(/FxiOS\/([\d.]+)/i));
  if (firefox) return { family: "Firefox", version: firefox };

  const chrome =
    pickVersionFromMatch(ua.match(/Chrome\/([\d.]+)/i)) ||
    pickVersionFromMatch(ua.match(/CriOS\/([\d.]+)/i));
  if (chrome) return { family: "Chrome", version: chrome };

  const safari =
    pickVersionFromMatch(ua.match(/Version\/([\d.]+).*Safari/i)) ||
    pickVersionFromMatch(ua.match(/Safari\/([\d.]+)/i));
  if (safari && /Safari/i.test(ua)) return { family: "Safari", version: safari };

  const ie =
    pickVersionFromMatch(ua.match(/MSIE\s+([\d.]+)/i)) ||
    pickVersionFromMatch(ua.match(/Trident\/.*rv:([\d.]+)/i));
  if (ie) return { family: "Internet Explorer", version: ie };

  return { family: null, version: null };
}

function parseKind(params: { userAgent: string; secChMobile: string; secChPlatform: string }) {
  const ua = params.userAgent.toLowerCase();
  const mobileHint = params.secChMobile.toLowerCase();
  const platformHint = params.secChPlatform.toLowerCase();

  if (/bot|crawler|spider|headless|phantom/i.test(ua)) return "bot" as const;
  if (mobileHint.includes("?1")) return "mobile" as const;

  if (
    /ipad|tablet|sm-t|tab\s|kindle|silk/i.test(ua) ||
    platformHint.includes("ipad")
  ) {
    return "tablet" as const;
  }

  if (
    /mobi|iphone|ipod|android|windows phone|opera mini|mobile/i.test(ua) ||
    platformHint.includes("android") ||
    platformHint.includes("ios")
  ) {
    return "mobile" as const;
  }

  if (ua) return "desktop" as const;
  return "unknown" as const;
}

function computeDeviceLabel(params: {
  osFamily: string | null;
  browserFamily: string | null;
  kind: DeviceKind;
}) {
  const os = String(params.osFamily || "Desconhecido").toUpperCase();
  const browser = String(params.browserFamily || "NAVEGADOR").toUpperCase();
  if (params.kind === "bot") return `${os} - BOT`;
  return `${os} - ${browser}`;
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function compactVersion(version: string | null) {
  const clean = String(version || "").trim();
  if (!clean) return "";
  return clean.split(".").slice(0, 2).join(".");
}

export function resolveDeviceIdentity(
  headers: HeaderLike,
  params?: { sessionDid?: string | null },
): DeviceIdentity {
  const userAgent = normalizeUserAgent(headerGet(headers, "user-agent"));
  const secChMobile = headerGet(headers, "sec-ch-ua-mobile");
  const secChPlatform = headerGet(headers, "sec-ch-ua-platform").replace(/"/g, "");
  const acceptLanguage = headerGet(headers, "accept-language");
  const host = normalizeHost(headers);
  const ip = resolveClientIp(headers);
  const location = resolveLocation(headers);

  const os = parseOs(userAgent);
  const browser = parseBrowser(userAgent);
  const kind = parseKind({
    userAgent,
    secChMobile,
    secChPlatform,
  });

  const label = computeDeviceLabel({
    osFamily: os.family,
    browserFamily: browser.family,
    kind,
  });

  const didHash = String(params?.sessionDid || "").trim();
  const fingerprintSeed = [
    didHash,
    kind,
    String(os.family || "").toLowerCase(),
    compactVersion(os.version),
    String(browser.family || "").toLowerCase(),
    compactVersion(browser.version),
    String(secChPlatform || "").toLowerCase(),
    String(acceptLanguage || "").toLowerCase().slice(0, 20),
    userAgent.toLowerCase(),
  ].join("|");

  const fingerprint = sha256Hex(fingerprintSeed || `${kind}|${userAgent.toLowerCase()}`);

  return {
    fingerprint,
    kind,
    platform: secChPlatform || os.family || null,
    osFamily: os.family,
    osVersion: os.version,
    browserFamily: browser.family,
    browserVersion: browser.version,
    label,
    userAgent,
    ip,
    location,
    host,
  };
}
