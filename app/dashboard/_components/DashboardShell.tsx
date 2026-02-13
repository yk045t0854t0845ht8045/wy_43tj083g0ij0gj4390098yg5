"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WyzerAIWidget } from "@/app/wyzerai/page";
import LoadingBase from "./LoadingBase";
import Sidebar from "./sidebar";
import ConfigMain, { type ConfigSectionId } from "./config/ConfigMain";

type DashboardShellProps = {
  userNickname: string;
  userFullName?: string;
  userEmail: string;
  userPhotoLink?: string | null;
  userPhoneE164?: string | null;
  userEmailChangedAt?: string | null;
  userPhoneChangedAt?: string | null;
  userPasswordChangedAt?: string | null;
  userSupportAccess?: boolean;
  userTwoFactorEnabled?: boolean;
  userTwoFactorEnabledAt?: string | null;
  userTwoFactorDisabledAt?: string | null;
  userAccountCreatedAt?: string | null;
};

function normalizeIsoDatetime(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

const SESSION_DISCONNECT_EVENT_KEY = "wz:session:disconnected";
const SESSION_CHECK_TIMEOUT_MS = 4500;
const SESSION_CHECK_MIN_GAP_MS = 1200;

function isLikelyMobileClient() {
  if (typeof navigator === "undefined") return false;
  const ua = String(navigator.userAgent || "").toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return true;
  return Number(navigator.maxTouchPoints || 0) > 2;
}

function buildLoginRedirectUrlClient() {
  if (typeof window === "undefined") return "/";

  const host = String(window.location.hostname || "").toLowerCase();
  const isLocalHost = host.endsWith(".localhost") || host === "localhost";
  const loginOrigin = isLocalHost
    ? "http://login.localhost:3000"
    : "https://login.wyzer.com.br";

  const url = new URL(`${loginOrigin}/`);
  url.searchParams.set("returnTo", window.location.href);
  url.searchParams.set("forceLogin", "1");
  return url.toString();
}

export default function DashboardShell({
  userNickname,
  userFullName,
  userEmail,
  userPhotoLink = null,
  userPhoneE164 = null,
  userEmailChangedAt = null,
  userPhoneChangedAt = null,
  userPasswordChangedAt = null,
  userSupportAccess = false,
  userTwoFactorEnabled = false,
  userTwoFactorEnabledAt = null,
  userTwoFactorDisabledAt = null,
  userAccountCreatedAt = null,
}: DashboardShellProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [configSection, setConfigSection] = useState<ConfigSectionId>("my-account");
  const [profileEmail, setProfileEmail] = useState<string>(
    String(userEmail || "").trim().toLowerCase() || "conta@wyzer.com.br"
  );
  const [profilePhotoLink, setProfilePhotoLink] = useState<string | null>(
    userPhotoLink
  );
  const [profilePhoneE164, setProfilePhoneE164] = useState<string | null>(
    userPhoneE164
  );
  const [profileEmailChangedAt, setProfileEmailChangedAt] = useState<string | null>(
    normalizeIsoDatetime(userEmailChangedAt)
  );
  const [profilePhoneChangedAt, setProfilePhoneChangedAt] = useState<string | null>(
    normalizeIsoDatetime(userPhoneChangedAt)
  );
  const [profilePasswordChangedAt, setProfilePasswordChangedAt] = useState<string | null>(
    normalizeIsoDatetime(userPasswordChangedAt)
  );
  const [profileSupportAccess, setProfileSupportAccess] = useState<boolean>(
    Boolean(userSupportAccess)
  );
  const [profileTwoFactorEnabled, setProfileTwoFactorEnabled] = useState<boolean>(
    Boolean(userTwoFactorEnabled)
  );
  const [profileTwoFactorEnabledAt, setProfileTwoFactorEnabledAt] = useState<string | null>(
    normalizeIsoDatetime(userTwoFactorEnabledAt)
  );
  const [profileTwoFactorDisabledAt, setProfileTwoFactorDisabledAt] = useState<string | null>(
    normalizeIsoDatetime(userTwoFactorDisabledAt)
  );
  const [sessionDisconnected, setSessionDisconnected] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(5);
  const redirectingRef = useRef(false);

  const normalizedInitialPhotoLink = useMemo(() => {
    const clean = String(userPhotoLink || "").trim();
    return clean || null;
  }, [userPhotoLink]);

  useEffect(() => {
    setProfilePhotoLink(normalizedInitialPhotoLink);
  }, [normalizedInitialPhotoLink]);

  useEffect(() => {
    const normalized = String(userEmail || "").trim().toLowerCase();
    setProfileEmail(normalized || "conta@wyzer.com.br");
  }, [userEmail]);

  useEffect(() => {
    const normalized = String(userPhoneE164 || "").trim();
    setProfilePhoneE164(normalized || null);
  }, [userPhoneE164]);

  useEffect(() => {
    setProfileEmailChangedAt(normalizeIsoDatetime(userEmailChangedAt));
  }, [userEmailChangedAt]);

  useEffect(() => {
    setProfilePhoneChangedAt(normalizeIsoDatetime(userPhoneChangedAt));
  }, [userPhoneChangedAt]);

  useEffect(() => {
    setProfilePasswordChangedAt(normalizeIsoDatetime(userPasswordChangedAt));
  }, [userPasswordChangedAt]);

  useEffect(() => {
    setProfileSupportAccess(Boolean(userSupportAccess));
  }, [userSupportAccess]);

  useEffect(() => {
    setProfileTwoFactorEnabled(Boolean(userTwoFactorEnabled));
  }, [userTwoFactorEnabled]);

  useEffect(() => {
    setProfileTwoFactorEnabledAt(normalizeIsoDatetime(userTwoFactorEnabledAt));
  }, [userTwoFactorEnabledAt]);

  useEffect(() => {
    setProfileTwoFactorDisabledAt(normalizeIsoDatetime(userTwoFactorDisabledAt));
  }, [userTwoFactorDisabledAt]);

  const handleUserEmailChange = useCallback((nextEmail: string, changedAt?: string | null) => {
    const normalized = String(nextEmail || "").trim().toLowerCase();
    setProfileEmail(normalized || "conta@wyzer.com.br");

    if (typeof changedAt !== "undefined") {
      setProfileEmailChangedAt(normalizeIsoDatetime(changedAt));
      return;
    }

    setProfileEmailChangedAt(new Date().toISOString());
  }, []);

  const handleUserPhoneChange = useCallback((nextPhoneE164: string | null, changedAt?: string | null) => {
    const normalized = String(nextPhoneE164 || "").trim();
    setProfilePhoneE164(normalized || null);

    if (typeof changedAt !== "undefined") {
      setProfilePhoneChangedAt(normalizeIsoDatetime(changedAt));
      return;
    }

    setProfilePhoneChangedAt(new Date().toISOString());
  }, []);

  const handleUserPasswordChange = useCallback((changedAt?: string | null) => {
    if (typeof changedAt !== "undefined") {
      setProfilePasswordChangedAt(normalizeIsoDatetime(changedAt));
      return;
    }
    setProfilePasswordChangedAt(new Date().toISOString());
  }, []);

  const handleUserTwoFactorChange = useCallback((enabled: boolean, changedAt?: string | null) => {
    const nextEnabled = Boolean(enabled);
    setProfileTwoFactorEnabled(nextEnabled);

    if (nextEnabled) {
      setProfileTwoFactorEnabledAt(
        typeof changedAt !== "undefined"
          ? normalizeIsoDatetime(changedAt)
          : new Date().toISOString()
      );
      setProfileTwoFactorDisabledAt(null);
      return;
    }

    setProfileTwoFactorDisabledAt(
      typeof changedAt !== "undefined"
        ? normalizeIsoDatetime(changedAt)
        : new Date().toISOString()
    );
    setProfileTwoFactorEnabledAt(null);
  }, []);

  const handleUserSupportAccessChange = useCallback((enabled: boolean) => {
    setProfileSupportAccess(Boolean(enabled));
  }, []);

  const triggerSessionDisconnected = useCallback((opts?: { broadcast?: boolean }) => {
    setSessionDisconnected(true);
    setDisconnectCountdown(5);

    if (opts?.broadcast === false) return;
    try {
      window.localStorage.setItem(SESSION_DISCONNECT_EVENT_KEY, String(Date.now()));
    } catch {
      // noop
    }
  }, []);

  const handleOpenConfig = useCallback((section: ConfigSectionId = "my-account") => {
    setConfigSection(section);
    setConfigOpen(true);
  }, []);

  const handleCloseConfig = useCallback(() => {
    setConfigOpen(false);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_DISCONNECT_EVENT_KEY) return;
      if (!event.newValue) return;
      triggerSessionDisconnected({ broadcast: false });
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [triggerSessionDisconnected]);

  useEffect(() => {
    if (sessionDisconnected) return;

    let cancelled = false;
    let inFlight = false;
    let inFlightStartedAt = 0;
    let lastCheckStartedAt = 0;
    const pollEveryMs = isLikelyMobileClient() ? 2500 : 5000;

    const checkActiveSession = async () => {
      if (cancelled || sessionDisconnected) return;
      const now = Date.now();
      if (inFlight && now - inFlightStartedAt > SESSION_CHECK_TIMEOUT_MS * 3) {
        inFlight = false;
      }
      if (inFlight) return;
      if (now - lastCheckStartedAt < SESSION_CHECK_MIN_GAP_MS) return;

      lastCheckStartedAt = now;
      inFlight = true;
      inFlightStartedAt = now;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => {
        controller.abort();
      }, SESSION_CHECK_TIMEOUT_MS);

      try {
        const response = await fetch("/api/wz_AuthLogin/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Cache-Control": "no-store",
            Pragma: "no-cache",
          },
        });

        if (response.status === 401 && !cancelled) {
          triggerSessionDisconnected();
          return;
        }

        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
        if (payload && payload.ok === false && !cancelled) {
          triggerSessionDisconnected();
        }
      } catch {
        // Ignora erro de rede temporario para nao derrubar sessao por falso positivo.
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
        inFlightStartedAt = 0;
      }
    };

    void checkActiveSession();

    const timer = window.setInterval(() => {
      void checkActiveSession();
    }, pollEveryMs);

    const triggerFastCheck = () => {
      if (cancelled) return;
      void checkActiveSession();
    };

    const onFocus = () => {
      triggerFastCheck();
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      triggerFastCheck();
    };

    const onPageShow = () => {
      triggerFastCheck();
    };

    const onOnline = () => {
      triggerFastCheck();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionDisconnected, triggerSessionDisconnected]);

  useEffect(() => {
    if (!sessionDisconnected) {
      redirectingRef.current = false;
      return;
    }

    if (disconnectCountdown <= 0) {
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      window.location.replace(buildLoginRedirectUrlClient());
      return;
    }

    const timer = window.setTimeout(() => {
      setDisconnectCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [disconnectCountdown, sessionDisconnected]);

  return (
    <div className="min-h-screen bg-white flex">
      <LoadingBase />
      <Sidebar
        activeMain="overview"
        userNickname={userNickname}
        userEmail={profileEmail}
        userPhotoLink={profilePhotoLink}
        onOpenConfig={handleOpenConfig}
      />

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center" />
        <WyzerAIWidget />
      </div>

      <ConfigMain
        open={configOpen}
        onClose={handleCloseConfig}
        activeSection={configSection}
        onSectionChange={setConfigSection}
        userNickname={userNickname}
        userFullName={userFullName}
        userEmail={profileEmail}
        userPhotoLink={profilePhotoLink}
        onUserPhotoChange={setProfilePhotoLink}
        onUserEmailChange={handleUserEmailChange}
        userPhoneE164={profilePhoneE164}
        onUserPhoneChange={handleUserPhoneChange}
        userEmailChangedAt={profileEmailChangedAt}
        userPhoneChangedAt={profilePhoneChangedAt}
        userPasswordChangedAt={profilePasswordChangedAt}
        userSupportAccess={profileSupportAccess}
        onUserPasswordChange={handleUserPasswordChange}
        userTwoFactorEnabled={profileTwoFactorEnabled}
        userTwoFactorEnabledAt={profileTwoFactorEnabledAt}
        userTwoFactorDisabledAt={profileTwoFactorDisabledAt}
        userAccountCreatedAt={userAccountCreatedAt}
        onUserSupportAccessChange={handleUserSupportAccessChange}
        onUserTwoFactorChange={handleUserTwoFactorChange}
      />

      {sessionDisconnected && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-6">
          <div className="w-full max-w-[760px] text-center text-black">
            <h2 className="text-[42px] font-semibold leading-tight">Conta Desconectada</h2>
            <p className="mx-auto mt-4 max-w-[620px] text-[18px] leading-[1.5] text-black/70">
              Recomendamos que feche Wyzer de todas as guias e fique por 5 segundos.
            </p>
            <p className="mt-8 text-[15px] font-medium text-black/55">
              Redirecionando para o login em {disconnectCountdown}s...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
