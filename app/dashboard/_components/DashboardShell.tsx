"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { WyzerAIWidget } from "@/app/wyzerai/page";
import LoadingBase from "./LoadingBase";
import Sidebar from "./sidebar";
import ConfigMain, { type ConfigSectionId } from "./config/ConfigMain";

type DashboardShellProps = {
  userNickname: string;
  userEmail: string;
  userPhotoLink?: string | null;
};

export default function DashboardShell({
  userNickname,
  userEmail,
  userPhotoLink = null,
}: DashboardShellProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [configSection, setConfigSection] = useState<ConfigSectionId>("my-account");
  const [profilePhotoLink, setProfilePhotoLink] = useState<string | null>(
    userPhotoLink
  );

  const normalizedInitialPhotoLink = useMemo(() => {
    const clean = String(userPhotoLink || "").trim();
    return clean || null;
  }, [userPhotoLink]);

  useEffect(() => {
    setProfilePhotoLink(normalizedInitialPhotoLink);
  }, [normalizedInitialPhotoLink]);

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
        userEmail={userEmail}
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
        userEmail={userEmail}
        userPhotoLink={profilePhotoLink}
        onUserPhotoChange={setProfilePhotoLink}
      />
    </div>
  );
}
