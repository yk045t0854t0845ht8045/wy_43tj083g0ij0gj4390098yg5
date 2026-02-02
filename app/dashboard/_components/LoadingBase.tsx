"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Phase = "idle" | "showing" | "finishing";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Easing functions para animações mais suaves
function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * LoadingBase - Premium Top Loading Bar
 * 
 * Uma barra de progresso elegante no estilo Apple/YouTube que:
 * - Aparece suavemente durante navegações e refreshes
 * - Usa animações baseadas em requestAnimationFrame para máxima fluidez
 * - Sistema anti-flash inteligente
 * - Efeito de glow e shimmer premium
 * - Respeita prefers-reduced-motion
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
  const [progress, setProgress] = useState(0);

  // Refs para controle preciso de timers e animações
  const rafRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastRouteKeyRef = useRef<string>("");
  const currentProgressRef = useRef<number>(0);
  const isFinishingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Sincroniza ref com state para uso em callbacks
  useEffect(() => {
    currentProgressRef.current = progress;
  }, [progress]);

  const reduceMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
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
    currentProgressRef.current = 0;
    isFinishingRef.current = false;
  }, []);

  const finish = useCallback(() => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    
    clearAllTimers();

    if (!isMountedRef.current) return;

    setPhase("finishing");
    setVisible(true);

    if (reduceMotion) {
      setProgress(100);
      finishTimerRef.current = setTimeout(() => resetToIdle(), 150);
      return;
    }

    const fromProgress = currentProgressRef.current;
    const toProgress = 100;
    const duration = 280; // Duração da animação final
    const startTime = performance.now();

    const animateFinish = (currentTime: number) => {
      if (!isMountedRef.current) return;

      const elapsed = currentTime - startTime;
      const normalizedTime = clamp(elapsed / duration, 0, 1);
      const easedProgress = easeOutExpo(normalizedTime);
      const newProgress = fromProgress + (toProgress - fromProgress) * easedProgress;

      setProgress(newProgress);
      currentProgressRef.current = newProgress;

      if (normalizedTime < 1) {
        rafRef.current = requestAnimationFrame(animateFinish);
      } else {
        setProgress(100);
        currentProgressRef.current = 100;
        // Fade out suave
        finishTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            resetToIdle();
          }
        }, 200);
      }
    };

    rafRef.current = requestAnimationFrame(animateFinish);
  }, [clearAllTimers, reduceMotion, resetToIdle]);

  const start = useCallback((reason: "mount" | "route") => {
    clearAllTimers();
    isFinishingRef.current = false;

    // Anti-flash: delay antes de mostrar
    const SHOW_DELAY = reduceMotion ? 0 : 100;

    startTimeRef.current = performance.now();
    
    if (isMountedRef.current) {
      setPhase("idle");
      setVisible(false);
      setProgress(0);
      currentProgressRef.current = 0;
    }

    showTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      setVisible(true);
      setPhase("showing");

      if (reduceMotion) {
        setProgress(100);
        if (reason === "route") {
          finishTimerRef.current = setTimeout(() => resetToIdle(), 200);
        }
        return;
      }

      const animationStartTime = performance.now();
      
      // Configuração das fases de animação
      const phase1Duration = 300;  // 0% -> 65% (rápido)
      const phase2Duration = 800;  // 65% -> 85% (médio)
      const phase3Duration = 2000; // 85% -> 92% (lento, "arrastando")

      const animateProgress = (currentTime: number) => {
        if (!isMountedRef.current || isFinishingRef.current) return;

        const elapsed = currentTime - animationStartTime;
        let newProgress: number;

        if (elapsed <= phase1Duration) {
          // Fase 1: Subida rápida inicial (0 -> 65)
          const t = clamp(elapsed / phase1Duration, 0, 1);
          newProgress = 65 * easeOutQuart(t);
        } else if (elapsed <= phase1Duration + phase2Duration) {
          // Fase 2: Subida média (65 -> 85)
          const t = clamp((elapsed - phase1Duration) / phase2Duration, 0, 1);
          newProgress = 65 + 20 * easeOutQuart(t);
        } else {
          // Fase 3: Subida lenta "arrastando" (85 -> 92)
          const t = clamp((elapsed - phase1Duration - phase2Duration) / phase3Duration, 0, 1);
          newProgress = 85 + 7 * easeInOutCubic(t);
        }

        // Garante que nunca volta
        const finalProgress = Math.max(currentProgressRef.current, newProgress);
        const clampedProgress = clamp(finalProgress, 0, 92);

        setProgress(clampedProgress);
        currentProgressRef.current = clampedProgress;

        // Continua animando até chegar em 92% ou ser interrompido
        if (clampedProgress < 92 && !isFinishingRef.current) {
          rafRef.current = requestAnimationFrame(animateProgress);
        }
      };

      rafRef.current = requestAnimationFrame(animateProgress);

      // Para navegação SPA, finaliza após tempo mínimo
      if (reason === "route") {
        const MIN_VISIBLE_TIME = 450;
        finishTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            finish();
          }
        }, MIN_VISIBLE_TIME);
      }
    }, SHOW_DELAY);
  }, [clearAllTimers, reduceMotion, resetToIdle, finish]);

  // Effect para mount/unmount e window load
  useEffect(() => {
    if (typeof window === "undefined") return;

    isMountedRef.current = true;
    start("mount");

    const handleLoad = () => {
      const minVisibleTime = reduceMotion ? 0 : 350;
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

    // Mostra loading instantâneo antes de sair da página
    const handleBeforeUnload = () => {
      clearAllTimers();
      isFinishingRef.current = false;
      if (isMountedRef.current) {
        setVisible(true);
        setPhase("showing");
        setProgress(15);
        currentProgressRef.current = 15;
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

    // Ignora a primeira execução (mount)
    if (!lastRouteKeyRef.current) {
      lastRouteKeyRef.current = routeKey;
      return;
    }

    // Só dispara se a rota realmente mudou
    if (lastRouteKeyRef.current === routeKey) return;

    lastRouteKeyRef.current = routeKey;
    start("route");
  }, [routeKey, start]);

  // Calcula o scaleX com precisão
  const scaleX = clamp(progress / 100, 0, 1);

  // Classes dinâmicas para transições
  const containerClasses = [
    "pointer-events-none fixed inset-x-0 top-0 z-[9999]",
    visible ? "opacity-100" : "opacity-0",
    phase === "finishing" 
      ? "transition-opacity duration-[250ms] ease-out" 
      : "transition-opacity duration-[120ms] ease-out",
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
      {/* Container da barra */}
      <div className="relative h-[4px] w-full overflow-hidden bg-transparent">
        {/* Barra principal */}
        <div
          className="absolute inset-y-0 left-0 w-full origin-left bg-black"
          style={{
            transform: `scaleX(${scaleX})`,
            transition: reduceMotion 
              ? "none" 
              : "transform 60ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        />
        
        {/* Efeito de glow/shimmer na ponta */}
        {visible && !reduceMotion && (
          <div
            className="absolute top-0 h-full w-24 animate-pulse"
            style={{
              left: `${progress}%`,
              transform: "translateX(-100%)",
              background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.15), transparent)",
              transition: "left 60ms cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: "left",
            }}
          />
        )}
        
        {/* Sombra sutil para profundidade */}
        <div
          className="absolute inset-y-0 left-0 w-full origin-left"
          style={{
            transform: `scaleX(${scaleX})`,
            boxShadow: visible 
              ? "0 1px 4px rgba(0, 0, 0, 0.12), 0 0 8px rgba(0, 0, 0, 0.06)" 
              : "none",
            transition: reduceMotion 
              ? "none" 
              : "transform 60ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 150ms ease",
            willChange: "transform, box-shadow",
            backfaceVisibility: "hidden",
          }}
        />
      </div>
    </div>
  );
}
