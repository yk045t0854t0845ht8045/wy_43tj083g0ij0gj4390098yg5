"use client";

import { useState } from "react";
import Main from "./main";
import Sidebar from "./sidebar";
import { calculateOnboardingProgress } from "./Onboarding/progress";
import {
  normalizeOnboardingData,
  type OnboardingData,
  type OnboardingProgress,
} from "./Onboarding/types";

type Props = {
  userNickname: string;
  userEmail: string;
  initialOnboarding: OnboardingData;
};

export default function DashboardShell({
  userNickname,
  userEmail,
  initialOnboarding,
}: Props) {
  const [onboardingData, setOnboardingData] = useState<OnboardingData>(() =>
    normalizeOnboardingData(initialOnboarding),
  );
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress>(
    () => calculateOnboardingProgress(normalizeOnboardingData(initialOnboarding)),
  );

  const handleDataChange = (nextData: OnboardingData) => {
    setOnboardingData(nextData);
    setOnboardingProgress(calculateOnboardingProgress(nextData));
  };

  const handleProgressChange = (nextProgress: OnboardingProgress) => {
    setOnboardingProgress(nextProgress);
  };

  return (
    <div className="min-h-screen bg-white flex">
      <Sidebar
        activeMain="overview"
        userNickname={userNickname}
        userEmail={userEmail}
        onboardingProgressPercent={onboardingProgress.percent}
        onboardingCompletedRequired={onboardingProgress.completedRequired}
        onboardingTotalRequired={onboardingProgress.totalRequired}
        onboardingRemainingRequired={onboardingProgress.remaining}
        onboardingDone={onboardingProgress.isCompleted}
      />

      <Main
        initialOnboarding={onboardingData}
        onDataChange={handleDataChange}
        onProgressChange={handleProgressChange}
      />
    </div>
  );
}

