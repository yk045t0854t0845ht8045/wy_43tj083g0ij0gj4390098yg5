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
  deviceBrand: string | null;
  deviceModel: string | null;
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

function normalizeDeviceBrand(value?: string | null) {
  const clean = normalizeWhitespace(String(value || ""));
  if (!clean) return null;
  return clean.slice(0, 48);
}

function normalizeDeviceModel(value?: string | null) {
  const clean = normalizeWhitespace(
    String(value || "")
      .replace(/^"+|"+$/g, "")
      .replace(/\s+build\/.+$/i, "")
      .replace(/\bwv\b/gi, "")
      .replace(/\bmobile\b/gi, "")
      .replace(/\btablet\b/gi, ""),
  );
  if (!clean) return null;
  if (
    /^(linux|android)$/i.test(clean) ||
    /^[a-z]{2}[-_][a-z]{2}$/i.test(clean) ||
    /^(u|k|\?0)$/i.test(clean)
  ) {
    return null;
  }
  return clean.slice(0, 80);
}

function detectDeviceBrand(value: string) {
  const source = String(value || "");
  if (!source) return null;

  if (/\biphone\b|\bipad\b|\bipod\b/i.test(source)) return "Apple";
  if (/\bsamsung\b|\bsm-[a-z0-9-]+\b|\bgt-[a-z0-9-]+\b|\bsch-[a-z0-9-]+\b|\bsgh-[a-z0-9-]+\b/i.test(source)) return "Samsung";
  if (/\bmotorola\b|\bmoto[\s-]?[a-z0-9()\-+]+\b|\bxt\d{3,5}\b/i.test(source)) return "Motorola";
  if (/\bpixel\b|\bgoogle\b/i.test(source)) return "Google";
  if (/\bxiaomi\b|\bredmi\b|\bpoco\b|\bmi[\s-][a-z0-9]+\b/i.test(source)) return "Xiaomi";
  if (/\boneplus\b|\bkb200[0-9a-z]+\b|\ble\d{4}\b|\bac\d{4}\b/i.test(source)) return "OnePlus";
  if (/\bhuawei\b|\bhonor\b/i.test(source)) return "Huawei";
  if (/\boppo\b|\bcph\d{3,5}\b/i.test(source)) return "Oppo";
  if (/\brealme\b|\brmx\d{3,5}\b/i.test(source)) return "Realme";
  if (/\bvivo\b|\bv\d{4}[a-z]?\b/i.test(source)) return "Vivo";
  if (/\bnokia\b|\bta-\d{3,5}\b/i.test(source)) return "Nokia";
  if (/\basus\b|\bzenfone\b|\brog phone\b/i.test(source)) return "Asus";
  if (/\bsony\b|\bxperia\b/i.test(source)) return "Sony";
  if (/\blg\b|\blm-[a-z0-9]+\b/i.test(source)) return "LG";

  return null;
}

function extractAndroidModelFromUserAgent(userAgent: string) {
  const byBuild = userAgent.match(/Android[^;)]*;\s*([^;()]+?)\s+Build\//i);
  const byBuildModel = normalizeDeviceModel(byBuild?.[1] || null);
  if (byBuildModel) return byBuildModel;

  const comment = userAgent.match(/\(([^)]+)\)/)?.[1] || "";
  if (!comment) return null;

  const parts = comment
    .split(";")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const androidIndex = parts.findIndex((part) => /^android\b/i.test(part));
  if (androidIndex >= 0) {
    for (let i = androidIndex + 1; i < parts.length; i += 1) {
      const token = normalizeDeviceModel(parts[i]);
      if (!token) continue;
      if (/^linux$/i.test(token)) continue;
      return token;
    }
  }

  return null;
}

function extractModelByPattern(userAgent: string) {
  const patterns: RegExp[] = [
    /\b(Pixel\s+[A-Za-z0-9()\-+ ]{1,28})\b/i,
    /\b(SM-[A-Z0-9-]{3,24})\b/i,
    /\b(GT-[A-Z0-9-]{3,24})\b/i,
    /\b(XT\d{3,5})\b/i,
    /\b(Moto\s+[A-Za-z0-9()\-+ ]{1,28})\b/i,
    /\b(Redmi\s+[A-Za-z0-9()\-+ ]{1,28})\b/i,
    /\b(POCO\s+[A-Za-z0-9()\-+ ]{1,28})\b/i,
    /\b(OnePlus\s+[A-Za-z0-9()\-+ ]{1,28})\b/i,
    /\b(CPH\d{3,5})\b/i,
    /\b(RMX\d{3,5})\b/i,
    /\b(TA-\d{3,5})\b/i,
  ];

  for (const pattern of patterns) {
    const match = userAgent.match(pattern);
    const model = normalizeDeviceModel(match?.[1] || null);
    if (model) return model;
  }

  return null;
}

function parseDeviceBrandAndModel(params: {
  userAgent: string;
  secChModel: string;
  kind: DeviceKind;
}) {
  const ua = String(params.userAgent || "");
  const secChModel = normalizeDeviceModel(params.secChModel);

  let model = secChModel;
  let brand: string | null = null;

  if (/iphone/i.test(ua)) {
    brand = "Apple";
    model = model || "iPhone";
  } else if (/ipad/i.test(ua)) {
    brand = "Apple";
    model = model || "iPad";
  } else if (/ipod/i.test(ua)) {
    brand = "Apple";
    model = model || "iPod";
  }

  if (!model && /android/i.test(ua)) {
    model = extractAndroidModelFromUserAgent(ua);
  }
  if (!model) {
    model = extractModelByPattern(ua);
  }

  brand = brand || detectDeviceBrand(`${secChModel || ""} ${model || ""} ${ua}`);
  brand = normalizeDeviceBrand(brand);
  model = normalizeDeviceModel(model);

  if ((params.kind !== "mobile" && params.kind !== "tablet") && !/iphone|ipad|ipod/i.test(ua)) {
    return { brand: null, model: null };
  }

  return { brand, model };
}

function computeDeviceLabel(params: {
  osFamily: string | null;
  browserFamily: string | null;
  kind: DeviceKind;
  deviceBrand: string | null;
  deviceModel: string | null;
}) {
  const brand = normalizeDeviceBrand(params.deviceBrand);
  const model = normalizeDeviceModel(params.deviceModel);
  if ((params.kind === "mobile" || params.kind === "tablet") && (brand || model)) {
    const startsWithBrand =
      Boolean(brand) &&
      Boolean(model) &&
      String(model).toLowerCase().startsWith(String(brand).toLowerCase());
    const mobileLabel = model
      ? brand && !startsWithBrand
        ? `${brand} ${model}`
        : model
      : brand;

    if (mobileLabel) return mobileLabel.toUpperCase();
  }

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
  const secChModel = headerGet(headers, "sec-ch-ua-model").replace(/"/g, "");
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
  const device = parseDeviceBrandAndModel({
    userAgent,
    secChModel,
    kind,
  });

  const label = computeDeviceLabel({
    osFamily: os.family,
    browserFamily: browser.family,
    kind,
    deviceBrand: device.brand,
    deviceModel: device.model,
  });

  const didHash = String(params?.sessionDid || "").trim();
  const fingerprintSeed = [
    didHash,
    kind,
    String(os.family || "").toLowerCase(),
    compactVersion(os.version),
    String(browser.family || "").toLowerCase(),
    compactVersion(browser.version),
    String(device.brand || "").toLowerCase(),
    String(device.model || "").toLowerCase(),
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
    deviceBrand: device.brand,
    deviceModel: device.model,
    label,
    userAgent,
    ip,
    location,
    host,
  };
}
