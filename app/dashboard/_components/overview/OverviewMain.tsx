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
    void onCreateChatbot;
  };

  return (
    <section className="w-full px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
      <style>{`
        @keyframes overviewCreatePlusFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-2px) scale(1.035); }
        }

        @keyframes overviewSkeletonSheen {
          0% { background-position: 12% 50%; }
          100% { background-position: 88% 50%; }
        }

        @keyframes overviewSkeletonTone {
          0%, 100% { opacity: 0.84; }
          50% { opacity: 0.96; }
        }

        .overview-create-plus {
          animation: overviewCreatePlusFloat 2.3s ease-in-out infinite;
        }

        .overview-skeleton-sheen {
          background-size: 180% 100%;
          animation: overviewSkeletonSheen 3.4s ease-in-out infinite alternate;
        }

        .overview-skeleton-tone {
          animation: overviewSkeletonTone 2.4s ease-in-out infinite;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1380px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <button
            type="button"
            onClick={handleCreateClick}
            className={[
              "group relative min-h-[152px] cursor-pointer overflow-hidden rounded-[20px]",
              "bg-[linear-gradient(136deg,#99e600_0%,#93db00_46%,#82c200_100%)]",
              "px-5 py-4 text-left shadow-[0_16px_36px_rgba(68,105,0,0.22)]",
              "transition-[transform,box-shadow,filter] duration-220 ease-out",
              "hover:-translate-y-[1px] hover:brightness-[1.03] hover:shadow-[0_22px_44px_rgba(68,105,0,0.28)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d7600]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff0f2]",
              "active:translate-y-[0.6px] active:scale-[0.996]",
            ].join(" ")}
            aria-label="Adicionar chatbot"
          >
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(255,255,255,0.38),transparent_42%),radial-gradient(circle_at_82%_84%,rgba(0,0,0,0.12),transparent_50%)]" />
            <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.2)_38%,transparent_60%)]" />

            <span className="relative z-[1] flex h-full flex-col items-center justify-center gap-2">
              <Plus
                className="overview-create-plus h-[58px] w-[58px] text-white drop-shadow-[0_10px_22px_rgba(0,0,0,0.2)] sm:h-[64px] sm:w-[64px]"
                strokeWidth={2.35}
              />
              <span className="text-[12px] font-semibold tracking-[0.01em] text-white/95 sm:text-[13px]">
                Criar meu sistema
              </span>
            </span>
          </button>

          <div className="hidden sm:contents" aria-hidden="true">
            {skeletonOpacities.map((opacity, index) => (
              <article
                key={`overview-skeleton-${index}`}
                className="overview-skeleton-tone relative min-h-[152px] overflow-hidden rounded-[20px] bg-[#e0e3e6] shadow-[0_8px_18px_rgba(0,0,0,0.03)]"
                style={{ opacity }}
              >
                <span className="absolute inset-0 overflow-hidden rounded-[20px]">
                  <span className="overview-skeleton-sheen absolute inset-0 bg-[linear-gradient(104deg,rgba(255,255,255,0.02)_16%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.02)_84%)]" />
                </span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
