"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WyzerAIWidget } from "@/app/wyzerai/page";
import LoadingBase from "./LoadingBase";
import Sidebar from "./sidebar";
import ConfigMain, { type ConfigSectionId } from "./config/ConfigMain";
import OnboardingModal, { type OnboardingState } from "./onboarding/OnboardingModal";
import OverviewMain from "./overview/OverviewMain";

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

function isUuidLike(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(clean);
}

const SESSION_DISCONNECT_EVENT_KEY = "wz:session:disconnected";
const SESSION_CHECK_TIMEOUT_MS = 4500;
const SESSION_CHECK_MIN_GAP_MS = 1200;
const ONBOARDING_REQUIRED_STORAGE_PREFIX = "wz:onboarding:required:";
const COMPANY_ONBOARDING_ACTIVE_STORAGE_PREFIX = "wz:company-onboarding:active:";
const COMPANY_ONBOARDING_SYSTEM_PENDING_PREFIX = "wz:company-onboarding:pending-system:";
const PASSWORD_SETUP_PROMPT_STORAGE_PREFIX = "wz:password-setup:prompt-shown:";
const DASHBOARD_REQUEST_TIMEOUT_MS = 12000;
const DASHBOARD_FETCH_MAX_ATTEMPTS = 3;
const DASHBOARD_FETCH_RETRY_DELAY_MS = 900;
const MOBILE_TOPBAR_SAFE_OFFSET = "88px";

type PendingCompanySystemContext = {
  id: string;
  companyName: string | null;
};

type PendingConfigBootstrapRequest = {
  section: ConfigSectionId;
  openPasswordModal?: boolean;
  allowWhileLocked?: boolean;
  passwordPromptIdentities?: string[];
};

function normalizeConfigSectionFromQuery(value: string): ConfigSectionId | null {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return null;

  if (
    clean === "my-account" ||
    clean === "privacy-data" ||
    clean === "authorized-apps" ||
    clean === "devices" ||
    clean === "notifications" ||
    clean === "subscriptions" ||
    clean === "billing" ||
    clean === "appearance" ||
    clean === "accessibility" ||
    clean === "voice-video"
  ) {
    return clean as ConfigSectionId;
  }

  return null;
}

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

async function waitFor(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchJsonWithRetry<T>(params: {
  input: string;
  init?: RequestInit;
  timeoutMs: number;
  attempts?: number;
  retryDelayMs?: number;
  externalSignal?: AbortSignal;
  shouldCancel?: () => boolean;
}) {
  const attempts =
    typeof params.attempts === "number" && Number.isFinite(params.attempts) && params.attempts > 0
      ? Math.trunc(params.attempts)
      : DASHBOARD_FETCH_MAX_ATTEMPTS;
  const retryDelayMs =
    typeof params.retryDelayMs === "number" && Number.isFinite(params.retryDelayMs) && params.retryDelayMs > 0
      ? Math.trunc(params.retryDelayMs)
      : DASHBOARD_FETCH_RETRY_DELAY_MS;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (params.shouldCancel?.()) return null;
    if (params.externalSignal?.aborted) return null;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), params.timeoutMs);
    const abortHandler = () => controller.abort();
    params.externalSignal?.addEventListener("abort", abortHandler, { once: true });

    try {
      const res = await fetch(params.input, {
        ...params.init,
        signal: controller.signal,
      });
      const payload = (await res.json().catch(() => null)) as T | null;
      if (res.ok) {
        return {
          ok: true,
          response: res,
          payload,
        };
      }

      lastError = new Error(`HTTP_${res.status}`);
      if (attempt >= attempts - 1) {
        return {
          ok: false,
          response: res,
          payload,
        };
      }
      await waitFor(retryDelayMs * (attempt + 1));
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) {
        throw error;
      }
      await waitFor(retryDelayMs * (attempt + 1));
    } finally {
      window.clearTimeout(timeoutId);
      params.externalSignal?.removeEventListener("abort", abortHandler);
    }
  }

  if (lastError) throw lastError;
  return null;
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
  const [autoOpenPasswordModalToken, setAutoOpenPasswordModalToken] = useState(0);
  const [configLockBypassReason, setConfigLockBypassReason] = useState<"password-setup" | null>(
    null,
  );
  const [pendingConfigBootstrapRequest, setPendingConfigBootstrapRequest] =
    useState<PendingConfigBootstrapRequest | null>(null);
  const [sessionDisconnected, setSessionDisconnected] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState<OnboardingState | null>(null);
  const [companyOnboardingOpen, setCompanyOnboardingOpen] = useState(false);
  const [companyOnboardingLoading, setCompanyOnboardingLoading] = useState(false);
  const [companyOnboardingData, setCompanyOnboardingData] = useState<OnboardingState | null>(null);
  const [companyOnboardingId, setCompanyOnboardingId] = useState<string | null>(null);
  const [pendingCompanySystemContext, setPendingCompanySystemContext] =
    useState<PendingCompanySystemContext | null>(null);
  const [overviewSyncToken, setOverviewSyncToken] = useState(0);
  const [primarySystemReadyToken, setPrimarySystemReadyToken] = useState(0);
  const [primarySystemSetupLocked, setPrimarySystemSetupLocked] = useState(false);
  const redirectingRef = useRef(false);
  const queryBootstrapHandledRef = useRef(false);
  const additionalCompanyStartLockRef = useRef(false);
  const companyOnboardingRestoreInFlightRef = useRef(false);
  const pendingCompanyContextValidationRef = useRef(false);
  const onboardingRequired = Boolean(onboardingData && !onboardingData.completed);
  const onboardingUiLocked = onboardingLoading || onboardingRequired;
  const dashboardNavigationLocked = onboardingUiLocked || primarySystemSetupLocked;
  const sidebarLockMessage = onboardingUiLocked
    ? "Conclua o onboarding para liberar a navegacao"
    : primarySystemSetupLocked
      ? "Conclua a configuracao do sistema para liberar a navegacao"
      : "";
  const sidebarLockVariant = onboardingUiLocked
    ? "overlay"
    : primarySystemSetupLocked
      ? "dim"
      : undefined;

  const bumpOverviewSyncToken = useCallback(() => {
    setOverviewSyncToken((current) => current + 1);
  }, []);

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
    setDisconnectCountdown(0);

    if (opts?.broadcast === false) return;
    try {
      window.localStorage.setItem(SESSION_DISCONNECT_EVENT_KEY, String(Date.now()));
    } catch {
      // noop
    }
  }, []);

  const handleOpenConfig = useCallback((section: ConfigSectionId = "my-account") => {
    setConfigLockBypassReason(null);
    setConfigSection(section);
    setConfigOpen(true);
  }, []);

  const handleCloseConfig = useCallback(() => {
    setConfigLockBypassReason(null);
    setConfigOpen(false);
    setAutoOpenPasswordModalToken(0);
  }, []);

  const getOnboardingRequiredKey = useCallback(
    (identity?: string | null) => {
      const base = String(identity || "").trim() || String(profileEmail || "").trim().toLowerCase();
      return `${ONBOARDING_REQUIRED_STORAGE_PREFIX}${base || "unknown"}`;
    },
    [profileEmail],
  );

  const getCompanyOnboardingActiveKey = useCallback(
    (identity?: string | null) => {
      const base = String(identity || "").trim() || String(profileEmail || "").trim().toLowerCase();
      return `${COMPANY_ONBOARDING_ACTIVE_STORAGE_PREFIX}${base || "unknown"}`;
    },
    [profileEmail],
  );

  const getCompanyPendingSystemKey = useCallback(
    (identity?: string | null) => {
      const base = String(identity || "").trim() || String(profileEmail || "").trim().toLowerCase();
      return `${COMPANY_ONBOARDING_SYSTEM_PENDING_PREFIX}${base || "unknown"}`;
    },
    [profileEmail],
  );

  const getPasswordSetupPromptKey = useCallback(
    (identity?: string | null) => {
      const base = String(identity || "").trim() || String(profileEmail || "").trim().toLowerCase();
      return `${PASSWORD_SETUP_PROMPT_STORAGE_PREFIX}${base || "unknown"}`;
    },
    [profileEmail],
  );

  const hasSeenPasswordSetupPrompt = useCallback(
    (identities?: Array<string | null | undefined>) => {
      const keys = new Set<string>();
      keys.add(getPasswordSetupPromptKey());
      for (const identity of identities || []) {
        keys.add(getPasswordSetupPromptKey(identity));
      }

      try {
        for (const key of keys) {
          if (window.localStorage.getItem(key) === "1") {
            return true;
          }
        }
      } catch {
        return false;
      }

      return false;
    },
    [getPasswordSetupPromptKey],
  );

  const markPasswordSetupPromptSeen = useCallback(
    (identities?: Array<string | null | undefined>) => {
      const keys = new Set<string>();
      keys.add(getPasswordSetupPromptKey());
      for (const identity of identities || []) {
        keys.add(getPasswordSetupPromptKey(identity));
      }

      try {
        for (const key of keys) {
          window.localStorage.setItem(key, "1");
        }
      } catch {
        // noop
      }
    },
    [getPasswordSetupPromptKey],
  );

  const queueConfigBootstrapRequest = useCallback((next: PendingConfigBootstrapRequest) => {
    setPendingConfigBootstrapRequest((current) => {
      if (!current) return next;

      const mergedPromptIdentities = Array.from(
        new Set(
          [...(current.passwordPromptIdentities || []), ...(next.passwordPromptIdentities || [])]
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        ),
      );

      return {
        section: next.section || current.section,
        openPasswordModal: Boolean(current.openPasswordModal || next.openPasswordModal),
        allowWhileLocked: Boolean(current.allowWhileLocked || next.allowWhileLocked),
        passwordPromptIdentities: mergedPromptIdentities,
      };
    });
  }, []);

  const syncOnboardingRequiredHint = useCallback(
    (required: boolean, identities?: Array<string | null | undefined>) => {
      const keys = new Set<string>();
      keys.add(getOnboardingRequiredKey());
      for (const identity of identities || []) {
        keys.add(getOnboardingRequiredKey(identity));
      }

      try {
        for (const key of keys) {
          if (required) {
            window.localStorage.setItem(key, "1");
          } else {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // noop
      }
    },
    [getOnboardingRequiredKey],
  );

  const shouldForceOnboardingFromHint = useCallback(() => {
    try {
      return window.localStorage.getItem(getOnboardingRequiredKey()) === "1";
    } catch {
      return false;
    }
  }, [getOnboardingRequiredKey]);

  const handleCloseOnboarding = useCallback(() => {
    if (onboardingData && !onboardingData.completed) {
      setOnboardingOpen(true);
      return;
    }
    setOnboardingOpen(false);
  }, [onboardingData]);

  const handleOnboardingUpdated = useCallback((next: OnboardingState) => {
    setOnboardingData(next);
    bumpOverviewSyncToken();
    if (next.completed) {
      setOnboardingOpen(false);
      syncOnboardingRequiredHint(false, [next.userId, next.email]);
      return;
    }
    syncOnboardingRequiredHint(true, [next.userId, next.email]);
    setOnboardingOpen(true);
  }, [bumpOverviewSyncToken, syncOnboardingRequiredHint]);

  const handleOnboardingCompleted = useCallback((next: OnboardingState) => {
    setOnboardingData(next);
    setOnboardingOpen(false);
    bumpOverviewSyncToken();
    setPrimarySystemReadyToken((current) => current + 1);
    syncOnboardingRequiredHint(false, [next.userId, next.email]);
  }, [bumpOverviewSyncToken, syncOnboardingRequiredHint]);

  const syncCompanyOnboardingActiveHint = useCallback(
    (id: string | null | undefined, identities?: Array<string | null | undefined>) => {
      const keys = new Set<string>();
      keys.add(getCompanyOnboardingActiveKey());
      for (const identity of identities || []) {
        keys.add(getCompanyOnboardingActiveKey(identity));
      }
      try {
        for (const key of keys) {
          if (id) {
            window.localStorage.setItem(key, id);
          } else {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // noop
      }
    },
    [getCompanyOnboardingActiveKey],
  );

  const syncPendingCompanySystemHint = useCallback(
    (payload: PendingCompanySystemContext | null, identities?: Array<string | null | undefined>) => {
      const keys = new Set<string>();
      keys.add(getCompanyPendingSystemKey());
      for (const identity of identities || []) {
        keys.add(getCompanyPendingSystemKey(identity));
      }
      try {
        for (const key of keys) {
          if (payload?.id) {
            window.localStorage.setItem(key, JSON.stringify(payload));
          } else {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // noop
      }
    },
    [getCompanyPendingSystemKey],
  );

  const startAdditionalCompanyOnboarding = useCallback(async () => {
    if (additionalCompanyStartLockRef.current) return;
    if (companyOnboardingRestoreInFlightRef.current) return;
    if (onboardingLoading || onboardingRequired || companyOnboardingLoading || companyOnboardingOpen) return;

    const existing = companyOnboardingData;
    if (existing && !existing.completed && isUuidLike(existing.id)) {
      setCompanyOnboardingId(existing.id);
      setCompanyOnboardingOpen(true);
      syncCompanyOnboardingActiveHint(existing.id, [existing.userId, existing.email]);
      return;
    }

    additionalCompanyStartLockRef.current = true;
    setCompanyOnboardingLoading(true);
    try {
      const res = await fetch("/api/wz_users/company-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          action: "start-additional-company",
          companyOnboardingId:
            existing && !existing.completed && isUuidLike(existing.id)
              ? existing.id
              : undefined,
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        onboarding?: OnboardingState;
      } | null;
      if (!res.ok || !payload?.ok || !payload.onboarding) {
        throw new Error(String(payload?.error || "Nao foi possivel iniciar cadastro de nova empresa."));
      }

      const normalizedId = String(payload.onboarding.id || "").trim();
      if (!isUuidLike(normalizedId)) {
        throw new Error("ID invalido para onboarding adicional.");
      }

      setCompanyOnboardingData(payload.onboarding);
      setCompanyOnboardingId(normalizedId);
      syncCompanyOnboardingActiveHint(normalizedId, [
        payload.onboarding.userId,
        payload.onboarding.email,
      ]);
      setCompanyOnboardingOpen(true);
    } finally {
      setCompanyOnboardingLoading(false);
      additionalCompanyStartLockRef.current = false;
    }
  }, [
    additionalCompanyStartLockRef,
    companyOnboardingData,
    companyOnboardingLoading,
    companyOnboardingOpen,
    onboardingLoading,
    onboardingRequired,
    syncCompanyOnboardingActiveHint,
  ]);

  const handleCloseCompanyOnboarding = useCallback(() => {
    setCompanyOnboardingOpen(false);
  }, []);

  const handleCompanyOnboardingUpdated = useCallback(
    (next: OnboardingState) => {
      const normalizedId = String(next.id || "").trim();
      if (!isUuidLike(normalizedId)) {
        return;
      }
      setCompanyOnboardingData(next);
      setCompanyOnboardingId(normalizedId);
      bumpOverviewSyncToken();
      if (next.completed) {
        setCompanyOnboardingOpen(false);
        syncCompanyOnboardingActiveHint(null, [next.userId, next.email]);
        return;
      }
      syncCompanyOnboardingActiveHint(normalizedId, [next.userId, next.email]);
      setCompanyOnboardingOpen(true);
    },
    [bumpOverviewSyncToken, syncCompanyOnboardingActiveHint],
  );

  const handleCompanyOnboardingCompleted = useCallback(
    (next: OnboardingState) => {
      const normalizedId = String(next.id || "").trim();
      if (!isUuidLike(normalizedId)) return;
      const payload: PendingCompanySystemContext = {
        id: normalizedId,
        companyName: String(next.companyName || "").trim() || null,
      };
      setCompanyOnboardingData(next);
      setCompanyOnboardingId(normalizedId);
      setPendingCompanySystemContext(payload);
      setCompanyOnboardingOpen(false);
      bumpOverviewSyncToken();
      syncCompanyOnboardingActiveHint(null, [next.userId, next.email]);
      syncPendingCompanySystemHint(payload, [next.userId, next.email]);
    },
    [bumpOverviewSyncToken, syncCompanyOnboardingActiveHint, syncPendingCompanySystemHint],
  );

  const handleConsumePendingCompanySystem = useCallback(
    (companyOnboardingIdToConsume: string) => {
      if (!companyOnboardingIdToConsume) return;
      setPendingCompanySystemContext((current) =>
        current?.id === companyOnboardingIdToConsume ? null : current,
      );
      syncPendingCompanySystemHint(null);
    },
    [syncPendingCompanySystemHint],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldForceOnboardingFromHint()) return;
    setOnboardingOpen(true);
  }, [shouldForceOnboardingFromHint]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (companyOnboardingRestoreInFlightRef.current) return;

    const activeIdRaw = window.localStorage.getItem(getCompanyOnboardingActiveKey());
    const activeId = String(activeIdRaw || "").trim();
    if (!activeId) return;
    if (!isUuidLike(activeId)) {
      syncCompanyOnboardingActiveHint(null);
      return;
    }

    if (
      companyOnboardingData &&
      !companyOnboardingData.completed &&
      String(companyOnboardingData.id || "").trim() === activeId
    ) {
      setCompanyOnboardingId(activeId);
      setCompanyOnboardingOpen(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const restore = async () => {
      companyOnboardingRestoreInFlightRef.current = true;
      setCompanyOnboardingLoading(true);
      try {
        const endpoint = `/api/wz_users/company-onboarding?companyOnboardingId=${encodeURIComponent(activeId)}`;
        const result = await fetchJsonWithRetry<{
          ok?: boolean;
          onboarding?: OnboardingState;
        }>({
          input: endpoint,
          timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
          externalSignal: controller.signal,
          shouldCancel: () => cancelled,
          init: {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              "Cache-Control": "no-store",
              Pragma: "no-cache",
            },
          },
        });
        if (!result?.ok) {
          syncCompanyOnboardingActiveHint(null);
          return;
        }
        const payload = result.payload || null;
        if (!payload?.ok || !payload.onboarding || cancelled) {
          syncCompanyOnboardingActiveHint(null);
          return;
        }

        const restoredId = String(payload.onboarding.id || "").trim();
        if (!isUuidLike(restoredId)) {
          syncCompanyOnboardingActiveHint(null, [
            payload.onboarding.userId,
            payload.onboarding.email,
          ]);
          return;
        }
        setCompanyOnboardingData(payload.onboarding);
        setCompanyOnboardingId(restoredId);
        if (!payload.onboarding.completed && !cancelled) {
          setCompanyOnboardingOpen(true);
        } else {
          syncCompanyOnboardingActiveHint(null, [
            payload.onboarding.userId,
            payload.onboarding.email,
          ]);
        }
      } catch {
        syncCompanyOnboardingActiveHint(null);
      } finally {
        if (!cancelled) {
          setCompanyOnboardingLoading(false);
        }
        companyOnboardingRestoreInFlightRef.current = false;
      }
    };

    void restore();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    companyOnboardingData,
    getCompanyOnboardingActiveKey,
    syncCompanyOnboardingActiveHint,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pendingCompanyContextValidationRef.current) return;
    const raw = window.localStorage.getItem(getCompanyPendingSystemKey());
    if (!raw) return;

    let parsed: PendingCompanySystemContext | null = null;
    try {
      parsed = JSON.parse(raw) as PendingCompanySystemContext | null;
      const pendingId = String(parsed?.id || "").trim();
      if (!isUuidLike(pendingId)) {
        syncPendingCompanySystemHint(null);
        return;
      }
    } catch {
      syncPendingCompanySystemHint(null);
      return;
    }

    const pendingId = String(parsed?.id || "").trim();
    if (!isUuidLike(pendingId)) {
      syncPendingCompanySystemHint(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const validate = async () => {
      pendingCompanyContextValidationRef.current = true;
      try {
        const endpoint = `/api/wz_users/company-onboarding?companyOnboardingId=${encodeURIComponent(pendingId)}`;
        const result = await fetchJsonWithRetry<{
          ok?: boolean;
          onboarding?: OnboardingState;
        }>({
          input: endpoint,
          timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
          externalSignal: controller.signal,
          shouldCancel: () => cancelled,
          init: {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              "Cache-Control": "no-store",
              Pragma: "no-cache",
            },
          },
        });
        if (!result?.ok) {
          syncPendingCompanySystemHint(null);
          return;
        }
        const payload = result.payload || null;
        if (!payload?.ok || !payload.onboarding || !payload.onboarding.completed) {
          syncPendingCompanySystemHint(null);
          return;
        }
        if (cancelled) return;
        setPendingCompanySystemContext({
          id: pendingId,
          companyName:
            String(parsed?.companyName || payload.onboarding.companyName || "").trim() || null,
        });
      } catch {
        syncPendingCompanySystemHint(null);
      } finally {
        pendingCompanyContextValidationRef.current = false;
      }
    };

    void validate();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [getCompanyPendingSystemKey, syncPendingCompanySystemHint]);

  useEffect(() => {
    if (queryBootstrapHandledRef.current) return;
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const oauthConnect = String(url.searchParams.get("oauthConnect") || "").trim().toLowerCase();
    const oauthError = String(url.searchParams.get("oauthError") || "").trim();
    const openConfig = normalizeConfigSectionFromQuery(
      String(url.searchParams.get("openConfig") || ""),
    );
    const openPasswordModalRaw = String(url.searchParams.get("openPasswordModal") || "")
      .trim()
      .toLowerCase();
    const shouldOpenPasswordModal =
      openPasswordModalRaw === "1" ||
      openPasswordModalRaw === "true" ||
      openPasswordModalRaw === "yes";

    const hasOauthFeedback = Boolean(oauthConnect || oauthError);
    const hasQueryBootstrap = Boolean(openConfig) || shouldOpenPasswordModal;
    if (!hasOauthFeedback && !hasQueryBootstrap) return;

    queryBootstrapHandledRef.current = true;

    let targetSection: ConfigSectionId = hasOauthFeedback ? "authorized-apps" : "my-account";
    if (openConfig) {
      targetSection = openConfig;
    }
    if (shouldOpenPasswordModal) {
      targetSection = "my-account";
    }

    queueConfigBootstrapRequest({
      section: targetSection,
      openPasswordModal: shouldOpenPasswordModal,
      allowWhileLocked: shouldOpenPasswordModal,
      passwordPromptIdentities: shouldOpenPasswordModal ? [profileEmail] : [],
    });

    url.searchParams.delete("openConfig");
    url.searchParams.delete("openPasswordModal");
    url.searchParams.delete("passwordSetupFlow");
    url.searchParams.delete("passwordSetupProvider");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [profileEmail, queueConfigBootstrapRequest]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    const controller = new AbortController();

    const checkPasswordSetupPrompt = async () => {
      try {
        const res = await fetch("/api/wz_users/password-state", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Cache-Control": "no-store",
            Pragma: "no-cache",
          },
        });
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean;
          resolvedUserId?: string | null;
          mustCreatePassword?: boolean;
          passwordCreated?: boolean;
        } | null;
        if (!res.ok || !payload?.ok || cancelled) return;

        const resolvedUserId = String(payload.resolvedUserId || "").trim();
        const identities = [resolvedUserId, profileEmail].filter(Boolean);
        const shouldPrompt =
          Boolean(payload.mustCreatePassword) && !Boolean(payload.passwordCreated);

        if (!shouldPrompt) return;
        if (hasSeenPasswordSetupPrompt(identities)) return;

        queueConfigBootstrapRequest({
          section: "my-account",
          openPasswordModal: true,
          allowWhileLocked: true,
          passwordPromptIdentities: identities,
        });
      } catch {
        // noop
      }
    };

    void checkPasswordSetupPrompt();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasSeenPasswordSetupPrompt, profileEmail, queueConfigBootstrapRequest]);

  useEffect(() => {
    if (!pendingConfigBootstrapRequest) return;
    if (dashboardNavigationLocked && !pendingConfigBootstrapRequest.allowWhileLocked) return;

    setConfigSection(pendingConfigBootstrapRequest.section);
    setConfigLockBypassReason(
      pendingConfigBootstrapRequest.openPasswordModal ? "password-setup" : null,
    );
    setConfigOpen(true);
    if (pendingConfigBootstrapRequest.openPasswordModal) {
      setAutoOpenPasswordModalToken((current) => current + 1);
      markPasswordSetupPromptSeen(pendingConfigBootstrapRequest.passwordPromptIdentities);
    }
    setPendingConfigBootstrapRequest(null);
  }, [
    dashboardNavigationLocked,
    markPasswordSetupPromptSeen,
    pendingConfigBootstrapRequest,
  ]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const checkOnboarding = async () => {
      setOnboardingLoading(true);
      try {
        const result = await fetchJsonWithRetry<{
          ok?: boolean;
          onboarding?: OnboardingState;
        }>({
          input: "/api/wz_users/onboarding",
          timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
          externalSignal: controller.signal,
          shouldCancel: () => cancelled,
          init: {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              "Cache-Control": "no-store",
              Pragma: "no-cache",
            },
          },
        });
        if (!result?.ok) return;

        const payload = result.payload || null;
        if (!payload?.ok || !payload.onboarding || cancelled) return;

        setOnboardingData(payload.onboarding);
        if (payload.onboarding.completed) {
          syncOnboardingRequiredHint(false, [payload.onboarding.userId, payload.onboarding.email]);
          setOnboardingOpen(false);
          return;
        }

        syncOnboardingRequiredHint(true, [payload.onboarding.userId, payload.onboarding.email]);
        if (!cancelled) {
          setOnboardingOpen(true);
        }
      } catch {
        // noop
      } finally {
        if (!cancelled) {
          setOnboardingLoading(false);
        }
      }
    };

    void checkOnboarding();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [syncOnboardingRequiredHint]);

  useEffect(() => {
    if (!onboardingRequired) return;
    if (!onboardingOpen) {
      setOnboardingOpen(true);
    }
  }, [onboardingOpen, onboardingRequired]);

  useEffect(() => {
    if (!dashboardNavigationLocked) return;
    if (configLockBypassReason === "password-setup") return;
    if (configOpen) {
      setConfigOpen(false);
      setAutoOpenPasswordModalToken(0);
    }
  }, [configLockBypassReason, configOpen, dashboardNavigationLocked]);

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
        // Ignora erro de rede temporário para não derrubar sessão por falso positivo.
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
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#eff0f2]">
      <LoadingBase />

      <div className="relative flex min-h-[100dvh] flex-col min-[901px]:flex-row">
        <div className="fixed inset-x-0 top-0 z-40 min-[901px]:static min-[901px]:inset-auto min-[901px]:z-auto">
          <Sidebar
            activeMain="overview"
            userNickname={userNickname}
            userEmail={profileEmail}
            userPhotoLink={profilePhotoLink}
            onOpenConfig={handleOpenConfig}
            locked={dashboardNavigationLocked}
            lockMessage={sidebarLockMessage}
            lockVariant={sidebarLockVariant}
          />
        </div>

        <main className="min-w-0 flex-1 px-3 pb-4 pt-[calc(env(safe-area-inset-top)+88px)] sm:px-5 sm:pb-6 sm:pt-[calc(env(safe-area-inset-top)+96px)] lg:px-6 min-[901px]:pt-6 min-[901px]:pb-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <OverviewMain
              onboardingLocked={onboardingUiLocked}
              requestingAdditionalCompany={companyOnboardingLoading}
              pendingCompanySystemContext={pendingCompanySystemContext}
              primaryOnboardingState={onboardingData}
              syncToken={overviewSyncToken}
              primarySystemReadyToken={primarySystemReadyToken}
              onPrimarySystemSetupLockChange={setPrimarySystemSetupLocked}
              onRequestAddSystemOnboarding={startAdditionalCompanyOnboarding}
              onConsumePendingCompanySystem={handleConsumePendingCompanySystem}
            />
            <WyzerAIWidget />
          </div>
        </main>
      </div>

      <ConfigMain
        open={configOpen}
        onClose={handleCloseConfig}
        activeSection={configSection}
        onSectionChange={setConfigSection}
        elevated={configLockBypassReason === "password-setup"}
        autoOpenPasswordModalToken={autoOpenPasswordModalToken}
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

      <OnboardingModal
        open={onboardingOpen}
        required={onboardingRequired || onboardingLoading}
        userEmail={profileEmail}
        initialData={onboardingData}
        onClose={handleCloseOnboarding}
        onUpdated={handleOnboardingUpdated}
        onCompleted={handleOnboardingCompleted}
      />

      <OnboardingModal
        open={companyOnboardingOpen}
        required={false}
        userEmail={profileEmail}
        initialData={companyOnboardingData}
        apiBasePath="/api/wz_users/company-onboarding"
        logoApiBasePath="/api/wz_users/company-onboarding/logo"
        contextId={companyOnboardingId}
        contextParamName="companyOnboardingId"
        flowMode="additional-company"
        onClose={handleCloseCompanyOnboarding}
        onUpdated={handleCompanyOnboardingUpdated}
        onCompleted={handleCompanyOnboardingCompleted}
      />

      {sessionDisconnected && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-6">
          <div className="w-full max-w-[760px] text-center text-black">
            <h2 className="text-[42px] font-semibold leading-tight">Conta Desconectada</h2>
            <p className="mx-auto mt-4 max-w-[620px] text-[18px] leading-[1.5] text-black/70">
              Sua sessão foi encerrada por segurança.
            </p>
            <p className="mt-8 text-[15px] font-medium text-black/55">
              Redirecionando para o login...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}