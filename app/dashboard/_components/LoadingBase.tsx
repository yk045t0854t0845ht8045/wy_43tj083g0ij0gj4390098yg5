// app/(dashboard)/_components/LoadingBase.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Phase = "idle" | "showing" | "finishing";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * LoadingBase
 * - Linha no topo (estilo Apple) com animação fluida.
 * - Aparece em:
 *   - refresh/reload (mount) e termina quando a janela termina de carregar
 *   - navegação SPA (mudança de pathname/searchParams)
 * - Sistema "inteligente":
 *   - delay anti-flash (se for rápido demais, nem mostra)
 *   - progresso suave até ~92% e depois finaliza pra 100% + fade
 *   - respeita prefers-reduced-motion
 */
export default function LoadingBase() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const key = useMemo(() => {
    const sp = searchParams?.toString?.() || "";
    return `${pathname || ""}?${sp}`;
  }, [pathname, searchParams]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const rafRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const startAtRef = useRef<number>(0);
  const lastKeyRef = useRef<string>("");

  const reduceMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }, []);

  function clearTimers() {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function setToIdle() {
    setPhase("idle");
    setVisible(false);
    setProgress(0);
  }

  function finish() {
    clearTimers();

    setPhase("finishing");
    setVisible(true);

    if (reduceMotion) {
      setProgress(100);
      finishTimerRef.current = window.setTimeout(() => setToIdle(), 180);
      return;
    }

    // completa pra 100 com easing curto, depois some
    const from = progress;
    const to = 100;
    const dur = 220;
    const t0 = performance.now();

    const step = (t: number) => {
      const k = clamp((t - t0) / dur, 0, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - k, 3);
      setProgress(from + (to - from) * eased);

      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        finishTimerRef.current = window.setTimeout(() => setToIdle(), 180);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }

  function start(reason: "mount" | "route") {
    clearTimers();

    // anti-flash: só mostra se demorar um tiquinho
    const SHOW_DELAY = reduceMotion ? 0 : 120;

    startAtRef.current = performance.now();
    setPhase("idle");
    setVisible(false);
    setProgress(0);

    showTimerRef.current = window.setTimeout(() => {
      setVisible(true);
      setPhase("showing");

      if (reduceMotion) {
        setProgress(100);
        // em rota, fecha logo; em mount, espera o load chamar finish
        if (reason === "route") finishTimerRef.current = window.setTimeout(() => setToIdle(), 220);
        return;
      }

      // sobe rápido até ~70, depois vai “arrastando” até ~92
      const t0 = performance.now();
      const fastDur = 260;
      const slowDur = 980;

      const step = (t: number) => {
        const dt = t - t0;

        // Fase 1: 0 -> 72 (rápida)
        const k1 = clamp(dt / fastDur, 0, 1);
        const e1 = 1 - Math.pow(1 - k1, 3); // easeOutCubic
        const p1 = 72 * e1;

        // Fase 2: 72 -> 92 (lenta, com leve easing)
        const k2 = clamp((dt - fastDur) / slowDur, 0, 1);
        const e2 = 1 - Math.pow(1 - k2, 2); // easeOutQuad
        const p2 = 72 + (92 - 72) * e2;

        const p = dt <= fastDur ? p1 : p2;

        setProgress((prev) => {
          // nunca volta pra trás
          const next = Math.max(prev, p);
          return clamp(next, 0, 92);
        });

        rafRef.current = requestAnimationFrame(step);
      };

      rafRef.current = requestAnimationFrame(step);

      // Em navegação SPA, como não temos o "fim" real (App Router),
      // finaliza com um tempo mínimo pra ficar “Apple” e consistente.
      if (reason === "route") {
        const MIN_VISIBLE = 520;
        finishTimerRef.current = window.setTimeout(() => finish(), MIN_VISIBLE);
      }
    }, SHOW_DELAY);
  }

  useEffect(() => {
    // Mount: inicia e finaliza no window.load (refresh/reload)
    if (typeof window === "undefined") return;

    start("mount");

    const onLoad = () => {
      // garante tempo mínimo de presença (evita “piscar” no refresh)
      const min = reduceMotion ? 0 : 420;
      const elapsed = performance.now() - startAtRef.current;
      const wait = Math.max(0, min - elapsed);
      window.setTimeout(() => finish(), wait);
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }

    // Antes de sair (reload/navegar fora), mostra instantâneo
    const onBeforeUnload = () => {
      clearTimers();
      setVisible(true);
      setPhase("showing");
      setProgress(12);
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearTimers();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Mudou rota/search: dispara loader
    if (typeof window === "undefined") return;

    if (!lastKeyRef.current) {
      lastKeyRef.current = key;
      return;
    }
    if (lastKeyRef.current === key) return;

    lastKeyRef.current = key;
    start("route");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // visual: linha no topo com leve “glow” e sombra sutil
  // progress via scaleX (bem suave) + opacidade/fade na finalização
  const scaleX = clamp(progress / 100, 0, 1);

  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none fixed inset-x-0 top-0 z-[9999]",
        visible ? "opacity-100" : "opacity-0",
        phase === "finishing" ? "transition-opacity duration-200" : "transition-opacity duration-150",
      ].join(" ")}
      style={{
        willChange: "opacity, transform",
        transform: "translateZ(0)",
      }}
    >
      {/* trilho invisível só pra manter altura consistente */}
      <div className="h-[3px] w-full bg-transparent">
        <div
          className="h-[3px] w-full origin-left bg-black"
          style={{
            transform: `scaleX(${scaleX}) translateZ(0)`,
            transition: reduceMotion ? "none" : "transform 80ms linear",
            boxShadow: "0 0 0 0 rgba(0,0,0,0), 0 1px 10px rgba(0,0,0,0.10)",
            filter: "saturate(1.05)",
          }}
        />
      </div>
    </div>
  );
}
