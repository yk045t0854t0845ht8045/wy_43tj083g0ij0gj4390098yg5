"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

export default function DashboardShell({
  userNickname,
  userFullName,
  userEmail,
  userPhotoLink = null,
  userPhoneE164 = null,
  userEmailChangedAt = null,
  userPhoneChangedAt = null,
  userPasswordChangedAt = null,
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
  const [profileTwoFactorEnabled, setProfileTwoFactorEnabled] = useState<boolean>(
    Boolean(userTwoFactorEnabled)
  );
  const [profileTwoFactorEnabledAt, setProfileTwoFactorEnabledAt] = useState<string | null>(
    normalizeIsoDatetime(userTwoFactorEnabledAt)
  );
  const [profileTwoFactorDisabledAt, setProfileTwoFactorDisabledAt] = useState<string | null>(
    normalizeIsoDatetime(userTwoFactorDisabledAt)
  );

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

  const handleOpenConfig = useCallback((section: ConfigSectionId = "my-account") => {
    setConfigSection(section);
    setConfigOpen(true);
  }, []);

  const handleCloseConfig = useCallback(() => {
    setConfigOpen(false);
  }, []);

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
        onUserPasswordChange={handleUserPasswordChange}
        userTwoFactorEnabled={profileTwoFactorEnabled}
        userTwoFactorEnabledAt={profileTwoFactorEnabledAt}
        userTwoFactorDisabledAt={profileTwoFactorDisabledAt}
        userAccountCreatedAt={userAccountCreatedAt}
        onUserTwoFactorChange={handleUserTwoFactorChange}
      />
    </div>
  );
}
