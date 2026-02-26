"use client";

import { Plus } from "lucide-react";
import { useMemo } from "react";

type OverviewMainProps = {
  onCreateChatbot?: () => void;
};

const SKELETON_CARD_COUNT = 7;

export default function OverviewMain({ onCreateChatbot }: OverviewMainProps) {
  const skeletonOpacities = useMemo(
    () => Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => Math.max(0.18, 0.88 - index * 0.1)),
    [],
  );

  const handleCreateClick = () => {
    if (onCreateChatbot) {
      onCreateChatbot();
    }
  };

  return (
    <section className="w-full px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
      <style>{`
        @keyframes overviewSkeletonShimmer {
          0% { background-position: 140% 0; }
          100% { background-position: -40% 0; }
        }

        .overview-skeleton-shimmer {
          background: linear-gradient(
            104deg,
            #dfe2e6 36%,
            #eceff2 50%,
            #dfe2e6 64%
          );
          background-size: 220% 100%;
          animation: overviewSkeletonShimmer 2.8s linear infinite;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1380px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <button
            type="button"
            onClick={handleCreateClick}
            className={[
              "group relative min-h-[152px] cursor-pointer overflow-hidden rounded-[20px]",
              "bg-[#0f1115] px-5 py-4 text-left",
              "shadow-[0_14px_30px_rgba(0,0,0,0.18)]",
              "transition-[background-color,box-shadow] duration-180 ease-out",
              "hover:bg-[#141822] hover:shadow-[0_18px_34px_rgba(0,0,0,0.22)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff0f2]",
              "active:bg-[#11141b]",
            ].join(" ")}
            aria-label="Adicionar chatbot"
          >
            <span className="relative z-[1] flex h-full flex-col items-center justify-center gap-2.5">
              <span className="inline-flex h-[66px] w-[66px] items-center justify-center rounded-full border border-white/18 bg-white/[0.02] sm:h-[70px] sm:w-[70px]">
                <Plus className="h-[38px] w-[38px] text-white sm:h-[40px] sm:w-[40px]" strokeWidth={2.25} />
              </span>
              <span className="text-[12px] font-semibold tracking-[0.01em] text-white/95 sm:text-[13px]">
                Criar meu sistema
              </span>
            </span>
          </button>

          <div className="hidden sm:contents" aria-hidden="true">
            {skeletonOpacities.map((opacity, index) => (
              <article
                key={`overview-skeleton-${index}`}
                className="overview-skeleton-shimmer relative min-h-[152px] overflow-hidden rounded-[20px] shadow-[0_6px_14px_rgba(0,0,0,0.025)]"
                style={{ opacity }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
