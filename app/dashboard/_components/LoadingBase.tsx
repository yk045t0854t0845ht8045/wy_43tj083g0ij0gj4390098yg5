"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Phase = "idle" | "loading" | "completing" | "exiting";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Easing functions para animações ultra-suaves
function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/**
 * LoadingBase - Premium Top Loading Bar
 *
 * Barra de progresso ultra-fluida que:
 * - Cresce da esquerda para a direita durante o carregamento
 * - Ao completar, "apaga" da esquerda para a direita (efeito wipe-out)
 * - Animações baseadas em requestAnimationFrame (60fps+)
 * - Sistema anti-flash inteligente
 * - Efeito de glow premium na ponta
 */
export default function LoadingBase() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const routeKey = useMemo(() => {
    const sp = searchParams?.toString?.() || "";
    return `${pathname || ""}?${sp}`;
  }, [pathname, searchParams]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [visible, setVisible] = useState(false);

  // Progress controla a ponta direita (0-100%)
  const [progress, setProgress] = useState(0);
  // TailProgress controla a ponta esquerda (0-100%) - para o efeito de "apagar"
  const [tailProgress, setTailProgress] = useState(0);

  // Refs para controle preciso
  const rafRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastRouteKeyRef = useRef<string>("");
  const currentProgressRef = useRef<number>(0);
  const currentTailRef = useRef<number>(0);
  const isFinishingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Sincroniza refs com state
  useEffect(() => {
    currentProgressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    currentTailRef.current = tailProgress;
  }, [tailProgress]);

  const reduceMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    );
  }, []);

  const clearAllTimers = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (finishTimerRef.current !== null) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const resetToIdle = useCallback(() => {
    if (!isMountedRef.current) return;

    setPhase("idle");
    setVisible(false);
    setProgress(0);
    setTailProgress(0);
    currentProgressRef.current = 0;
    currentTailRef.current = 0;
    isFinishingRef.current = false;
  }, []);

  const finish = useCallback(() => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;

    clearAllTimers();

    if (!isMountedRef.current) return;

    setPhase("completing");
    setVisible(true);

    if (reduceMotion) {
      setProgress(100);
      setTailProgress(100);
      finishTimerRef.current = setTimeout(() => resetToIdle(), 100);
      return;
    }

    // Fase 1: Completar a barra até 100%
    const fromProgress = currentProgressRef.current;
    const completeDuration = 200;
    const startTime = performance.now();

    const animateComplete = (currentTime: number) => {
      if (!isMountedRef.current) return;

      const elapsed = currentTime - startTime;
      const t = clamp(elapsed / completeDuration, 0, 1);
      const easedT = easeOutExpo(t);
      const newProgress = fromProgress + (100 - fromProgress) * easedT;

      setProgress(newProgress);
      currentProgressRef.current = newProgress;

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animateComplete);
      } else {
        setProgress(100);
        currentProgressRef.current = 100;

        // Fase 2: Animar a "cauda" (tail) da esquerda para direita
        setPhase("exiting");
        const exitStartTime = performance.now();
        const exitDuration = 300;

        const animateExit = (exitCurrentTime: number) => {
          if (!isMountedRef.current) return;

          const exitElapsed = exitCurrentTime - exitStartTime;
          const exitT = clamp(exitElapsed / exitDuration, 0, 1);
          const exitEasedT = easeOutCubic(exitT);
          const newTail = 100 * exitEasedT;

          setTailProgress(newTail);
          currentTailRef.current = newTail;

          if (exitT < 1) {
            rafRef.current = requestAnimationFrame(animateExit);
          } else {
            setTailProgress(100);
            currentTailRef.current = 100;
            // Reset após pequeno delay
            finishTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                resetToIdle();
              }
            }, 50);
          }
        };

        rafRef.current = requestAnimationFrame(animateExit);
      }
    };

    rafRef.current = requestAnimationFrame(animateComplete);
  }, [clearAllTimers, reduceMotion, resetToIdle]);

  const start = useCallback(
    (reason: "mount" | "route") => {
      clearAllTimers();
      isFinishingRef.current = false;

      const SHOW_DELAY = reduceMotion ? 0 : 80;

      startTimeRef.current = performance.now();

      if (isMountedRef.current) {
        setPhase("idle");
        setVisible(false);
        setProgress(0);
        setTailProgress(0);
        currentProgressRef.current = 0;
        currentTailRef.current = 0;
      }

      showTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;

        setVisible(true);
        setPhase("loading");

        if (reduceMotion) {
          setProgress(100);
          if (reason === "route") {
            finishTimerRef.current = setTimeout(() => resetToIdle(), 150);
          }
          return;
        }

        const animationStartTime = performance.now();

        // Fases de progressão natural
        const phase1Duration = 250; // 0% -> 60% (rápido)
        const phase2Duration = 600; // 60% -> 80% (médio)
        const phase3Duration = 2500; // 80% -> 92% (lento)

        const animateProgress = (currentTime: number) => {
          if (!isMountedRef.current || isFinishingRef.current) return;

          const elapsed = currentTime - animationStartTime;
          let newProgress: number;

          if (elapsed <= phase1Duration) {
            const t = clamp(elapsed / phase1Duration, 0, 1);
            newProgress = 60 * easeOutQuart(t);
          } else if (elapsed <= phase1Duration + phase2Duration) {
            const t = clamp(
              (elapsed - phase1Duration) / phase2Duration,
              0,
              1
            );
            newProgress = 60 + 20 * easeOutQuart(t);
          } else {
            const t = clamp(
              (elapsed - phase1Duration - phase2Duration) / phase3Duration,
              0,
              1
            );
            newProgress = 80 + 12 * easeInOutCubic(t);
          }

          const finalProgress = Math.max(
            currentProgressRef.current,
            newProgress
          );
          const clampedProgress = clamp(finalProgress, 0, 92);

          setProgress(clampedProgress);
          currentProgressRef.current = clampedProgress;

          if (clampedProgress < 92 && !isFinishingRef.current) {
            rafRef.current = requestAnimationFrame(animateProgress);
          }
        };

        rafRef.current = requestAnimationFrame(animateProgress);

        if (reason === "route") {
          const MIN_VISIBLE_TIME = 400;
          finishTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              finish();
            }
          }, MIN_VISIBLE_TIME);
        }
      }, SHOW_DELAY);
    },
    [clearAllTimers, reduceMotion, resetToIdle, finish]
  );

  // Effect para mount/unmount e window load
  useEffect(() => {
    if (typeof window === "undefined") return;

    isMountedRef.current = true;
    start("mount");

    const handleLoad = () => {
      const minVisibleTime = reduceMotion ? 0 : 300;
      const elapsed = performance.now() - startTimeRef.current;
      const remainingTime = Math.max(0, minVisibleTime - elapsed);

      setTimeout(() => {
        if (isMountedRef.current) {
          finish();
        }
      }, remainingTime);
    };

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad, { once: true });
    }

    const handleBeforeUnload = () => {
      clearAllTimers();
      isFinishingRef.current = false;
      if (isMountedRef.current) {
        setVisible(true);
        setPhase("loading");
        setProgress(20);
        setTailProgress(0);
        currentProgressRef.current = 20;
        currentTailRef.current = 0;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      isMountedRef.current = false;
      clearAllTimers();
      window.removeEventListener("load", handleLoad);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [start, finish, clearAllTimers, reduceMotion]);

  // Effect para mudanças de rota
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!lastRouteKeyRef.current) {
      lastRouteKeyRef.current = routeKey;
      return;
    }

    if (lastRouteKeyRef.current === routeKey) return;

    lastRouteKeyRef.current = routeKey;
    start("route");
  }, [routeKey, start]);

  // Calcula as posições da barra
  const leftPercent = clamp(tailProgress, 0, 100);
  const rightPercent = clamp(progress, 0, 100);
  const barWidth = Math.max(0, rightPercent - leftPercent);

  const containerClasses = [
    "pointer-events-none fixed inset-x-0 top-0 z-[9999]",
    visible ? "opacity-100" : "opacity-0",
    "transition-opacity duration-150 ease-out",
  ].join(" ");

  return (
    <div
      aria-hidden="true"
      className={containerClasses}
      style={{
        willChange: "opacity",
        contain: "layout style",
      }}
    >
      <div className="relative h-[5px] w-full overflow-hidden bg-transparent">
        {/* Barra principal com posição dinâmica */}
        <div
          className="absolute inset-y-0 bg-black"
          style={{
            left: `${leftPercent}%`,
            width: `${barWidth}%`,
            transition: reduceMotion
              ? "none"
              : "left 50ms cubic-bezier(0.22, 1, 0.36, 1), width 50ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "left, width",
            backfaceVisibility: "hidden",
            transform: "translateZ(0)",
          }}
        />

        {/* Efeito de glow na ponta direita */}
        {visible && !reduceMotion && barWidth > 0 && (
          <div
            className="absolute top-0 h-full"
            style={{
              left: `${rightPercent}%`,
              width: "80px",
              transform: "translateX(-100%)",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.2) 100%)",
              transition: "left 50ms cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: "left",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Sombra sutil */}
        {visible && barWidth > 0 && (
          <div
            className="absolute inset-y-0"
            style={{
              left: `${leftPercent}%`,
              width: `${barWidth}%`,
              boxShadow:
                "0 1px 3px rgba(0, 0, 0, 0.1), 0 0 6px rgba(0, 0, 0, 0.05)",
              transition: reduceMotion
                ? "none"
                : "left 50ms cubic-bezier(0.22, 1, 0.36, 1), width 50ms cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: "left, width",
              backfaceVisibility: "hidden",
              transform: "translateZ(0)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
