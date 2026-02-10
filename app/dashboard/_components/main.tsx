"use client";

import { useEffect, useMemo, useState } from "react";
import { WyzerAIWidget } from "@/app/wyzerai/page";
import Pendencias from "./Onboarding/Pendencias";
import { calculateOnboardingProgress } from "./Onboarding/progress";
import {
  normalizeOnboardingData,
  type OnboardingData,
  type OnboardingProgress,
} from "./Onboarding/types";

type Props = {
  initialOnboarding: OnboardingData;
  onProgressChange?: (progress: OnboardingProgress) => void;
  onDataChange?: (nextData: OnboardingData) => void;
};

export default function Main({
  initialOnboarding,
  onProgressChange,
  onDataChange,
}: Props) {
  const [data, setData] = useState<OnboardingData>(() =>
    normalizeOnboardingData(initialOnboarding),
  );

  const progress = useMemo(() => calculateOnboardingProgress(data), [data]);
  const showOnboarding = !progress.isCompleted;

  useEffect(() => {
    onProgressChange?.(progress);
  }, [onProgressChange, progress]);

  const handleData = (nextData: OnboardingData) => {
    setData(nextData);
    onDataChange?.(nextData);
  };

  return (
    <div className="flex-1">
      {showOnboarding ? (
        <Pendencias
          initialData={data}
          onDataChange={handleData}
          onProgressChange={onProgressChange}
          onFinished={handleData}
        />
      ) : (
        <div className="flex h-full min-h-[70vh] items-center justify-center px-6">
          <div className="max-w-[520px] rounded-3xl border border-black/10 bg-white p-8 text-center shadow-[0_14px_36px_rgba(0,0,0,0.08)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">
              Dashboard liberado
            </p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-black/90">
              Cadastro finalizado
            </h1>
            <p className="mt-3 text-[14px] leading-6 text-black/65">
              Sua conta foi configurada com sucesso. Agora voce pode usar o painel
              principal sem pendencias.
            </p>
          </div>
        </div>
      )}

      <WyzerAIWidget />
    </div>
  );
}
