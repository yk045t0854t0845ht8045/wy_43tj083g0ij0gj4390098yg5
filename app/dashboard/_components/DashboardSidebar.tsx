"use client";

import React from "react";

export default function DashboardSidebar({
  email,
  userId,
  logoutHref = "/api/wz_AuthLogin/logout",
}: {
  email: string;
  userId: string;
  logoutHref?: string;
}) {
  // Base (sem front-end). Você vai implementar o layout depois.
  void email;
  void userId;
  void logoutHref;

  return null;
}
