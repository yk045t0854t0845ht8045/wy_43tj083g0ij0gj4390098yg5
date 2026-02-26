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
      return;
    }

    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent<{ message: string }>("wyzerai:open", {
        detail: { message: "Quero criar meu primeiro chatbot na plataforma." },
      }),
    );
  };

  return (
    <section className="w-full px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
      <style>{`
        @keyframes overviewSkeletonShimmer {
          0% { transform: translateX(-62%); }
          100% { transform: translateX(118%); }
        }
        @keyframes overviewSkeletonBreath {
          0%, 100% { opacity: 0.58; }
          50% { opacity: 0.9; }
        }
        .overview-skeleton-shimmer {
          animation: overviewSkeletonShimmer 2.2s linear infinite;
        }
        .overview-skeleton-breath {
          animation: overviewSkeletonBreath 2.6s ease-in-out infinite;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1380px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <button
            type="button"
            onClick={handleCreateClick}
            className={[
              "group relative min-h-[152px] overflow-hidden rounded-[20px] border border-[#8acc08] bg-[#99e600]",
              "px-5 py-4 text-left shadow-[0_12px_30px_rgba(68,105,0,0.18)]",
              "transition-[transform,box-shadow,filter] duration-200 ease-out",
              "hover:-translate-y-[1px] hover:brightness-[1.02] hover:shadow-[0_18px_34px_rgba(68,105,0,0.26)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d7600]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff0f2]",
              "active:translate-y-[0.5px] active:scale-[0.996]",
            ].join(" ")}
            aria-label="Adicionar chatbot"
          >
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.34),transparent_44%),radial-gradient(circle_at_84%_84%,rgba(0,0,0,0.08),transparent_50%)]" />

            <span className="relative z-[1] flex h-full flex-col items-center justify-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1d2c00] shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <span className="text-[25px] font-semibold tracking-[-0.01em] text-[#1f3000] sm:text-[26px]">
                Add chatbot
              </span>
              <span className="text-[13px] font-medium text-[#243700]/78">Criar seu primeiro fluxo</span>
            </span>
          </button>

          <div className="hidden sm:contents" aria-hidden="true">
            {skeletonOpacities.map((opacity, index) => (
              <article
                key={`overview-skeleton-${index}`}
                className="relative min-h-[152px] overflow-hidden rounded-[20px] border border-black/[0.045] bg-[#f4f4f5] shadow-[0_6px_20px_rgba(0,0,0,0.04)]"
                style={{ opacity }}
              >
                <span className="absolute inset-0 overflow-hidden rounded-[20px]">
                  <span className="overview-skeleton-shimmer absolute inset-y-0 w-[48%] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.55)_45%,transparent_100%)]" />
                </span>

                <div className="relative z-[1] flex h-full flex-col p-4">
                  <div className="overview-skeleton-breath h-3 w-[42%] rounded-full bg-[#d8d8da]" />
                  <div className="mt-auto">
                    <svg
                      viewBox="0 0 356 84"
                      className="h-[56px] w-full text-[#d2d3d6]"
                      preserveAspectRatio="none"
                      fill="none"
                    >
                      <path
                        d="M0 58 C 22 22, 42 22, 67 58 C 90 88, 109 88, 131 58 C 154 26, 178 26, 198 52 C 221 78, 242 78, 264 50 C 287 22, 308 22, 330 52 C 341 67, 349 73, 356 74"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

