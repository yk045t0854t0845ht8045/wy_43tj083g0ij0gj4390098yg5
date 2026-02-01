"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Users2, ChevronDown, Search, Check } from "lucide-react";
import { useRouter } from "next/navigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeText(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(label: string, query: string) {
  const L = normalizeText(label);
  const Q = normalizeText(query);
  if (!Q) return { ok: true, score: 1000 };

  const tokens = Q.split(" ").filter(Boolean);
  for (const t of tokens) {
    if (!L.includes(t)) return { ok: false, score: 0 };
  }

  if (L.startsWith(Q)) return { ok: true, score: 0 };
  const idx = L.indexOf(Q);
  if (idx >= 0) return { ok: true, score: 10 + idx };
  return { ok: true, score: 50 };
}

function SpinnerMini({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="inline-flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    >
      <span className="relative h-5 w-5">
        <span className="absolute inset-0 rounded-full border-2 border-black/15" />
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-black/50 border-t-transparent"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={
            reduced
              ? undefined
              : { repeat: Infinity, duration: 0.8, ease: "linear" }
          }
        />
      </span>
    </motion.span>
  );
}

type GroupedOptions = Array<{ group: string; options: string[] }>;

function SearchableSelect({
  value,
  placeholder,
  groups,
  onChange,
  loading,
  prefersReducedMotion,
  EASE,
}: {
  value: string;
  placeholder: string;
  groups: GroupedOptions;
  onChange: (v: string) => void;
  loading: boolean;
  prefersReducedMotion: boolean;
  EASE: readonly [number, number, number, number];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"down" | "up">("down");
  const [listMaxH, setListMaxH] = useState(260);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const flat = useMemo(() => {
    const out: Array<{ group: string; label: string }> = [];
    for (const g of groups) for (const opt of g.options) out.push({ group: g.group, label: opt });
    return out;
  }, [groups]);

  const filtered = useMemo(() => {
    const rows = flat
      .map((r) => {
        const m = scoreMatch(`${r.group} ${r.label}`, q);
        return { ...r, ok: m.ok, score: m.score };
      })
      .filter((r) => r.ok)
      .sort((a, b) => a.score - b.score);

    const byGroup = new Map<string, string[]>();
    for (const r of rows) {
      if (!byGroup.has(r.group)) byGroup.set(r.group, []);
      byGroup.get(r.group)!.push(r.label);
    }

    const result: Array<{ group: string; options: string[] }> = [];
    for (const g of groups) {
      const opts = byGroup.get(g.group);
      if (opts && opts.length) result.push({ group: g.group, options: opts });
    }
    return result;
  }, [flat, q, groups]);

  useEffect(() => {
    if (!open) return;

    const recalc = () => {
      const el = wrapRef.current;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const margin = 14;
      const headApprox = 66;
      const minList = 180;
      const maxList = 340;

      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;

      const nextSide =
        spaceBelow < 240 && spaceAbove > spaceBelow ? "up" : "down";

      const available =
        (nextSide === "down" ? spaceBelow : spaceAbove) - headApprox;

      const nextMaxH = Math.max(minList, Math.min(maxList, available));

      setSide(nextSide);
      setListMaxH(Number.isFinite(nextMaxH) ? nextMaxH : 260);
    };

    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      const t = e.target as Node | null;
      if (!el || !t) return;
      if (!el.contains(t)) setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    requestAnimationFrame(recalc);
    window.setTimeout(() => searchRef.current?.focus(), 0);

    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);

    const vv = (window as any).visualViewport as VisualViewport | undefined;
    vv?.addEventListener?.("resize", recalc);

    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
      vv?.removeEventListener?.("resize", recalc);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "w-full rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden",
          "px-6 py-5 pr-16 text-left",
          "text-[15px] sm:text-[16px] focus:outline-none",
          value ? "text-black" : "text-black/45",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="block truncate">{value ? value : placeholder}</span>
        <span className="absolute right-4 inset-y-0 flex items-center justify-center">
          {loading ? (
            <SpinnerMini reduced={!!prefersReducedMotion} />
          ) : (
            <ChevronDown className={cx("h-5 w-5 text-black/50", open && "rotate-180")} />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: side === "down" ? 10 : -10, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: side === "down" ? 10 : -10, filter: "blur(10px)" }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: EASE }}
            className={cx(
              "absolute left-0 right-0 z-[40]",
              side === "down" ? "top-full mt-2" : "bottom-full mb-2",
            )}
          >
            <div className="rounded-[18px] bg-white ring-1 ring-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.10)] overflow-hidden">
              <div className="p-2">
                <div className="relative rounded-[14px] bg-[#f3f3f3] ring-1 ring-black/10 overflow-hidden">
                  <input
                    ref={searchRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar…"
                    className="w-full bg-transparent pl-11 pr-4 py-3 text-[13px] text-black placeholder-black/45 focus:outline-none"
                  />
                  <div className="absolute left-3 inset-y-0 flex items-center justify-center">
                    <Search className="h-4 w-4 text-black/45" />
                  </div>
                </div>
              </div>

              <div className="overflow-auto px-2 pb-2" style={{ maxHeight: listMaxH }}>
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-[13px] text-black/55">Nenhum resultado.</div>
                ) : (
                  filtered.map((g) => (
                    <div key={g.group} className="pb-2">
                      <div className="px-3 pt-2 pb-2 text-[11px] font-semibold text-black/45">
                        {g.group}
                      </div>

                      <div className="space-y-2">
                        {g.options.map((opt) => {
                          const active = normalizeText(value) === normalizeText(opt);

                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                onChange(opt);
                                setOpen(false);
                                setQ("");
                              }}
                              className={cx(
                                "w-full flex items-center justify-between gap-3",
                                "rounded-[14px] px-4 py-3.5 text-left text-[13px] font-semibold transition-all",
                                active
                                  ? "bg-black text-white"
                                  : "bg-[#f3f3f3] hover:text-black hover:bg-[#ededed]",
                              )}
                            >
                              <span className="truncate">{opt}</span>
                              {active && <Check className="h-4 w-4 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



function MultiSelect({
  value,
  placeholder,
  options,
  onChange,
  loading,
  prefersReducedMotion,
  EASE,
}: {
  value: string[];
  placeholder: string;
  options: string[];
  onChange: (v: string[]) => void;
  loading: boolean;
  prefersReducedMotion: boolean;
  EASE: readonly [number, number, number, number];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"down" | "up">("down");
  const [listMaxH, setListMaxH] = useState(240);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    return options
      .map((label) => {
        const m = scoreMatch(label, q);
        return { label, ok: m.ok, score: m.score };
      })
      .filter((r) => r.ok)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.label);
  }, [options, q]);

  useEffect(() => {
    if (!open) return;

    const recalc = () => {
      const el = wrapRef.current;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const margin = 14;
      const headApprox = 66;
      const minList = 170;
      const maxList = 320;

      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;

      const nextSide =
        spaceBelow < 220 && spaceAbove > spaceBelow ? "up" : "down";

      const available =
        (nextSide === "down" ? spaceBelow : spaceAbove) - headApprox;

      const nextMaxH = Math.max(minList, Math.min(maxList, available));

      setSide(nextSide);
      setListMaxH(Number.isFinite(nextMaxH) ? nextMaxH : 240);
    };

    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      const t = e.target as Node | null;
      if (!el || !t) return;
      if (!el.contains(t)) setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    requestAnimationFrame(recalc);
    window.setTimeout(() => searchRef.current?.focus(), 0);

    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);

    const vv = (window as any).visualViewport as VisualViewport | undefined;
    vv?.addEventListener?.("resize", recalc);

    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
      vv?.removeEventListener?.("resize", recalc);
    };
  }, [open]);

  const label = value.length ? value.join(", ") : "";

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "w-full rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden",
          "px-6 py-5 pr-16 text-left",
          "text-[15px] sm:text-[16px] focus:outline-none",
          value.length ? "text-black" : "text-black/45",
        )}
      >
        <span className="block truncate">{label || placeholder}</span>
        <span className="absolute right-4 inset-y-0 flex items-center justify-center">
          {loading ? (
            <SpinnerMini reduced={!!prefersReducedMotion} />
          ) : (
            <ChevronDown className={cx("h-5 w-5 text-black/50", open && "rotate-180")} />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: side === "down" ? 10 : -10, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: side === "down" ? 10 : -10, filter: "blur(10px)" }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: EASE }}
            className={cx(
              "absolute left-0 right-0 z-[40]",
              side === "down" ? "top-full mt-2" : "bottom-full mb-2",
            )}
          >
            <div className="rounded-[18px] bg-white ring-1 ring-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.10)] overflow-hidden">
              <div className="p-2">
                <div className="relative rounded-[14px] bg-[#f3f3f3] ring-1 ring-black/10 overflow-hidden">
                  <input
                    ref={searchRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar…"
                    className="w-full bg-transparent pl-11 pr-4 py-3 text-[13px] text-black placeholder-black/45 focus:outline-none"
                  />
                  <div className="absolute left-3 inset-y-0 flex items-center justify-center">
                    <Search className="h-4 w-4 text-black/45" />
                  </div>
                </div>
              </div>

              <div className="overflow-auto px-2 pb-2" style={{ maxHeight: listMaxH }}>
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-[13px] text-black/55">Nenhum resultado.</div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((opt) => {
                      const active = value.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const next = active ? value.filter((x) => x !== opt) : [...value, opt];
                            onChange(next);
                          }}
                          className={cx(
                            "w-full flex items-center justify-between gap-3",
                            "rounded-[14px] px-4 py-3.5 text-left text-[13px] font-semibold transition-all",
                            active
                              ? "bg-black text-white"
                              : "bg-[#f3f3f3] text-black/75 hover:text-black hover:bg-[#ededed]",
                          )}
                        >
                          <span className="truncate">{opt}</span>
                          {active && <Check className="h-4 w-4 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-2 pt-0">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full rounded-[14px] px-4 py-3 text-[13px] font-semibold bg-[#f3f3f3] ring-1 ring-black/10 text-black/70 hover:text-black hover:bg-[#ededed] transition-all"
                >
                  Limpar seleção
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


export default function OnboardCreateAccountClient2({
  email,
  userId,
  loginUrl,
}: {
  email: string;
  userId: string;
  loginUrl: string;
}) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const EASE = useMemo(() => [0.2, 0.8, 0.2, 1] as const, []);
  const DUR = useMemo(
    () => ({
      xs: 0.18,
      sm: 0.22,
      md: 0.35,
      lg: 0.7,
      xl: 0.9,
    }),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // campos step-2
  const [mainUse, setMainUse] = useState("");
  const [priorityNow, setPriorityNow] = useState("");
  const [hasSupervisor, setHasSupervisor] = useState("");
  const [serviceHours, setServiceHours] = useState("");
  const [targetResponseTime, setTargetResponseTime] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  const saveTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<string[]>([]);

  const fieldVerRef = useRef<Record<string, number>>({});
  const pendingPatchRef = useRef<Record<string, any>>({});
  const inFlightRef = useRef<{
    id: number;
    controller: AbortController;
    keys: string[];
    versions: Record<string, number>;
    patch: Record<string, any>;
  } | null>(null);

  const reqSeqRef = useRef(0);
  const mountedRef = useRef(true);
  const failureRef = useRef(0);

  const [saveToastOpen, setSaveToastOpen] = useState(false);
  const [saveToastTick, setSaveToastTick] = useState(0);

  const hardRedirectToLogin = useCallback(() => {
    if (typeof window !== "undefined") window.location.href = loginUrl;
  }, [loginUrl]);

  const api = useCallback(
    async (path: string, body?: any) => {
      const res = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) {
        hardRedirectToLogin();
        return { ok: false, _401: true } as any;
      }

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Falha na requisição.");
      return j;
    },
    [hardRedirectToLogin],
  );

  const fireSavedToast = useCallback(() => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);

    setSaveToastTick((t) => t + 1);
    setSaveToastOpen(true);

    toastTimerRef.current = window.setTimeout(() => {
      setSaveToastOpen(false);
    }, 1100);
  }, []);

  const isFieldLoading = useCallback(
    (k: string) => {
      return !!dirty[k] || savingKeys.includes(k);
    },
    [dirty, savingKeys],
  );

  const mergePending = useCallback((patch: Record<string, any>) => {
    pendingPatchRef.current = {
      ...patch,
      ...pendingPatchRef.current,
    };
  }, []);

  const flushNow = useCallback(
    async (reason: "debounce" | "blur" | "nav" = "debounce") => {
      const patch = pendingPatchRef.current;
      const keys = Object.keys(patch || {});
      if (!keys.length) return true;

      if (inFlightRef.current?.controller) {
        inFlightRef.current.controller.abort();
      }

      const patchToSend = { ...pendingPatchRef.current };
      pendingPatchRef.current = {};

      const versionsSnapshot: Record<string, number> = {};
      keys.forEach((k) => {
        versionsSnapshot[k] = fieldVerRef.current[k] || 0;
      });

      const id = ++reqSeqRef.current;
      const controller = new AbortController();

      inFlightRef.current = {
        id,
        controller,
        keys,
        versions: versionsSnapshot,
        patch: patchToSend,
      };

      if (mountedRef.current) setSavingKeys(keys);

      const doRequest = async (attempt: number) => {
        const timeoutMs = 10000;
        const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

        try {
          const res = await fetch("/api/wz_OnboardSystem/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchToSend),
            signal: controller.signal,
          });

          if (res.status === 401) {
            hardRedirectToLogin();
            return false;
          }

          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j?.error || "Falha ao salvar.");

          if (mountedRef.current) {
            setDirty((prev) => {
              const next = { ...prev };
              keys.forEach((k) => {
                const nowVer = fieldVerRef.current[k] || 0;
                if (nowVer === versionsSnapshot[k]) next[k] = false;
              });
              return next;
            });

            failureRef.current = 0;
            setError(null);
            fireSavedToast();
          }

          return true;
        } catch (e: any) {
          if (e?.name === "AbortError") {
            mergePending(patchToSend);
            return false;
          }

          mergePending(patchToSend);

          const msg = String(e?.message || "Erro ao salvar.");
          failureRef.current += 1;

          if (mountedRef.current && failureRef.current >= 2) {
            setError(msg);
          }

          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, attempt === 0 ? 350 : 650));
            return doRequest(attempt + 1);
          }

          return false;
        } finally {
          window.clearTimeout(timeout);
        }
      };

      const ok = await doRequest(0);

      if (mountedRef.current && inFlightRef.current?.id === id) {
        setSavingKeys([]);
        inFlightRef.current = null;
      }

      if (reason === "nav" && Object.keys(pendingPatchRef.current).length) {
        return flushNow("nav");
      }

      return ok;
    },
    [fireSavedToast, hardRedirectToLogin, mergePending],
  );

  const scheduleFlush = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      flushNow("debounce");
    }, 260);
  }, [flushNow]);

  const queueSave = useCallback(
    (patch: Record<string, any>) => {
      setError(null);

      const keys = Object.keys(patch || {});
      keys.forEach((k) => {
        fieldVerRef.current[k] = (fieldVerRef.current[k] || 0) + 1;
      });

      setDirty((prev) => {
        const next = { ...prev };
        keys.forEach((k) => (next[k] = true));
        return next;
      });

      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const onBlurFlush = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    flushNow("blur");
  }, [flushNow]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);

      if (inFlightRef.current?.controller) inFlightRef.current.controller.abort();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const j = await api("/api/wz_OnboardSystem/me");
        if (!mounted) return;

        setMainUse(j?.data?.mainUse || "");
        setPriorityNow(j?.data?.priorityNow || "");
        setHasSupervisor(
          typeof j?.data?.hasSupervisor === "boolean"
            ? j.data.hasSupervisor
              ? "Sim"
              : "Não"
            : j?.data?.hasSupervisor || "",
        );
        setServiceHours(j?.data?.serviceHours || "");
        setTargetResponseTime(j?.data?.targetResponseTime || "");
        setLanguages(Array.isArray(j?.data?.languages) ? j.data.languages : []);
      } catch (e: any) {
        setError(e?.message || "Erro ao carregar onboarding.");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [api]);

  const [leaving, setLeaving] = useState<null | "back" | "next">(null);

  const goBack = useCallback(async () => {
    if (busy) return;

    setBusy(true);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    await flushNow("nav");

    setLeaving("back");
    window.setTimeout(() => {
      router.push("/create-account");
    }, prefersReducedMotion ? 0 : 220);
  }, [busy, flushNow, prefersReducedMotion, router]);

  const goNext = useCallback(async () => {
    if (busy) return;

    setBusy(true);
    setError(null);

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    const ok = await flushNow("nav");

    if (!ok) {
      setBusy(false);
      setError((e) => e || "Não foi possível salvar agora. Tente novamente.");
      return;
    }

    setLeaving("next");
    window.setTimeout(() => {
      // próximo passo (você me passa depois)
      // router.push("/create-account/step-3");
     router.push("/create-account/step-3");
    }, prefersReducedMotion ? 0 : 240);
  }, [busy, flushNow, prefersReducedMotion, router]);

  const useGroups = useMemo<GroupedOptions>(
    () => [
      {
        group: "Uso principal",
        options: [
          "Vendas / SDR",
          "Suporte / SAC",
          "Agendamentos",
          "Cobrança",
          "Qualificação de leads",
          "Tudo junto (híbrido)",
        ],
      },
    ],
    [],
  );

  const priorityGroups = useMemo<GroupedOptions>(
    () => [
      {
        group: "Prioridade",
        options: [
          "Reduzir tempo de resposta",
          "Aumentar conversão",
          "Organizar equipe",
          "Automatizar FAQs",
          "Evitar perda de leads",
        ],
      },
    ],
    [],
  );

  const yesNoGroups = useMemo<GroupedOptions>(
    () => [{ group: "Selecione", options: ["Sim", "Não"] }],
    [],
  );

  const hoursGroups = useMemo<GroupedOptions>(
    () => [
      {
        group: "Horário",
        options: [
          "Seg–Sex (09:00–18:00)",
          "Seg–Sáb (09:00–18:00)",
          "Todos os dias (09:00–18:00)",
          "24/7",
          "Personalizado",
        ],
      },
    ],
    [],
  );

  const responseGroups = useMemo<GroupedOptions>(
    () => [
      {
        group: "Tempo alvo",
        options: ["Até 1 min", "Até 5 min", "Até 15 min", "Até 30 min"],
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="relative z-10 min-h-screen flex items-start sm:items-center justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+44px)] sm:pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+44px)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={leaving ? "leaving" : "idle"}
            initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
            animate={
              leaving === "next"
                ? { opacity: 0, x: -18, filter: "blur(10px)" }
                : leaving === "back"
                  ? { opacity: 0, x: 18, filter: "blur(10px)" }
                  : { opacity: 1, x: 0, y: 0, filter: "blur(0px)" }
            }
            exit={{ opacity: 0, y: 16, filter: "blur(10px)" }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: leaving ? DUR.sm : DUR.lg, ease: EASE }
            }
            className="w-full max-w-[640px]"
            style={{ willChange: "transform, opacity, filter" }}
          >
            <div className="rounded-[28px] bg-white p-7 sm:p-9 md:p-10">
              <div className="text-center">
                <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04] ring-1 ring-black/5 shrink-0">
                  <Users2 className="h-6 w-6 text-black/80" />
                </div>

                <div className="text-black font-semibold tracking-tight text-[26px] sm:text-[30px] md:text-[34px]">
                  Como você vai usar o WhatsApp?
                </div>

                <div className="mt-2 text-black/55 text-[14px] sm:text-[15px] md:text-[16px]">
                  Só pra ajustar o Wyzer ao seu fluxo (rapidinho).
                </div>

                <div className="mt-3 text-[12px] text-black/40 font-medium">
                  Logado como{" "}
                  <span className="text-black/60 font-semibold">{email}</span>
                </div>
              </div>

              <div className="mt-10">
                <AnimatePresence initial={false}>
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.22,
                        ease: EASE,
                      }}
                      className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 px-6 py-5 flex items-center justify-center gap-2 text-black/60 text-[14px]"
                    >
                      <SpinnerMini reduced={!!prefersReducedMotion} />
                      Carregando…
                    </motion.div>
                  )}
                </AnimatePresence>

                {!loading && (
                  <>
                    <div className="space-y-4">
                      {/* Pergunta 1 */}
                      <div>
                        <div className="text-black/70 text-[13px] font-semibold mb-2">
                          Você vai usar o WhatsApp principalmente para…
                        </div>
                        <SearchableSelect
                          value={mainUse}
                          placeholder="Selecione uma opção"
                          groups={useGroups}
                          onChange={(v) => {
                            setMainUse(v);
                            queueSave({ mainUse: v });
                          }}
                          loading={isFieldLoading("mainUse")}
                          prefersReducedMotion={!!prefersReducedMotion}
                          EASE={EASE}
                        />
                      </div>

                      {/* Pergunta 2 */}
                      <div>
                        <div className="text-black/70 text-[13px] font-semibold mb-2">
                          Qual é a prioridade agora?
                        </div>
                        <SearchableSelect
                          value={priorityNow}
                          placeholder="Selecione uma opção"
                          groups={priorityGroups}
                          onChange={(v) => {
                            setPriorityNow(v);
                            queueSave({ priorityNow: v });
                          }}
                          loading={isFieldLoading("priorityNow")}
                          prefersReducedMotion={!!prefersReducedMotion}
                          EASE={EASE}
                        />
                      </div>

                      {/* Supervisor */}
                      <div>
                        <div className="text-black/70 text-[13px] font-semibold mb-2">
                          Vai ter supervisor/gestor?
                        </div>
                        <SearchableSelect
                          value={hasSupervisor}
                          placeholder="Sim ou Não"
                          groups={yesNoGroups}
                          onChange={(v) => {
                            setHasSupervisor(v);
                            queueSave({ hasSupervisor: v === "Sim" });
                          }}
                          loading={isFieldLoading("hasSupervisor")}
                          prefersReducedMotion={!!prefersReducedMotion}
                          EASE={EASE}
                        />
                      </div>

                      {/* Horário */}
                      <div>
                        <div className="text-black/70 text-[13px] font-semibold mb-2">
                          Horário de atendimento
                        </div>
                        <SearchableSelect
                          value={serviceHours}
                          placeholder="Selecione"
                          groups={hoursGroups}
                          onChange={(v) => {
                            setServiceHours(v);
                            queueSave({ serviceHours: v });
                          }}
                          loading={isFieldLoading("serviceHours")}
                          prefersReducedMotion={!!prefersReducedMotion}
                          EASE={EASE}
                        />
                      </div>

                      {/* Tempo alvo */}
                      <div>
                        <div className="text-black/70 text-[13px] font-semibold mb-2">
                          Tempo alvo de resposta
                        </div>
                        <SearchableSelect
                          value={targetResponseTime}
                          placeholder="Selecione"
                          groups={responseGroups}
                          onChange={(v) => {
                            setTargetResponseTime(v);
                            queueSave({ targetResponseTime: v });
                          }}
                          loading={isFieldLoading("targetResponseTime")}
                          prefersReducedMotion={!!prefersReducedMotion}
                          EASE={EASE}
                        />
                      </div>

                      {/* Idiomas */}
                      <div>
                        <div className="text-black/70 text-[13px] font-semibold mb-2">
                          Idiomas
                        </div>
                        <MultiSelect
                          value={languages}
                          placeholder="Selecione (PT/EN/ES)"
                          options={["PT", "EN", "ES"]}
                          onChange={(v) => {
                            setLanguages(v);
                            queueSave({ languages: v });
                          }}
                          loading={isFieldLoading("languages")}
                          prefersReducedMotion={!!prefersReducedMotion}
                          EASE={EASE}
                        />
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {!!error && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                          transition={{
                            duration: prefersReducedMotion ? 0 : 0.22,
                            ease: EASE,
                          }}
                          className="mt-4 rounded-[16px] bg-black/5 ring-1 ring-black/10 px-4 py-3 text-[13px] text-black/70"
                        >
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mt-10 flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={goBack}
                        className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-white ring-1 ring-black/10 text-black/70 text-[14px] font-semibold hover:text-black hover:bg-[#f7f7f7] transition-colors"
                      >
                        Voltar
                      </button>

                      <motion.button
                        type="button"
                        onClick={goNext}
                        disabled={busy}
                        whileHover={prefersReducedMotion || busy ? undefined : { y: -2, scale: 1.01 }}
                        whileTap={prefersReducedMotion || busy ? undefined : { scale: 0.98 }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : DUR.sm,
                          ease: EASE,
                        }}
                        className={cx(
                          "group relative rounded-full px-7 py-3 bg-[#171717] border border-[#454545] border-2 text-white",
                          "focus:outline-none transition-all duration-300 ease-out",
                          "text-[14px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-14 transform-gpu",
                          busy
                            ? "opacity-60 cursor-not-allowed select-none pointer-events-none"
                            : "hover:border-[#6a6a6a] focus:border-lime-400",
                        )}
                        style={{ willChange: "transform" }}
                      >
                        <span className="relative z-10">
                          {busy ? "Aguarde..." : "Continuar"}
                        </span>

                        <motion.span
                          whileHover={prefersReducedMotion || busy ? undefined : { scale: 1.06 }}
                          whileTap={prefersReducedMotion || busy ? undefined : { scale: 0.96 }}
                          transition={{
                            duration: prefersReducedMotion ? 0 : DUR.sm,
                            ease: EASE,
                          }}
                          className={cx(
                            "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2.5 transition-all duration-300 ease-out",
                            busy
                              ? "bg-transparent"
                              : "bg-transparent group-hover:bg-white/10 group-hover:translate-x-0.5",
                          )}
                        >
                          {busy ? (
                            <SpinnerMini reduced={!!prefersReducedMotion} />
                          ) : (
                            <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                          )}
                        </motion.span>
                      </motion.button>
                    </div>

                    <div className="sr-only" aria-hidden>
                      {userId}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {saveToastOpen && (
          <motion.div
            key={`saved-${saveToastTick}`}
            className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pointer-events-none"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
            }}
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.22,
              ease: EASE,
            }}
          >
            <div className="rounded-full bg-black text-white text-[13px] font-semibold px-5 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
              Salvo com sucesso
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
