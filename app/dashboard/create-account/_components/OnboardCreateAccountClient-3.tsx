// app/create-account/_components/OnboardCreateAccountClient3.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Users2, ChevronDown, Search, Check, Sparkles, Shield, Link2 } from "lucide-react";
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
  for (const t of tokens) if (!L.includes(t)) return { ok: false, score: 0 };

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
          transition={reduced ? undefined : { repeat: Infinity, duration: 0.8, ease: "linear" }}
        />
      </span>
    </motion.span>
  );
}

type GroupedOptions = Array<{ group: string; options: Array<{ label: string; value: string }> }>;

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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [dir, setDir] = useState<"down" | "up">("down");

  const flat = useMemo(() => {
    const out: Array<{ group: string; label: string; value: string }> = [];
    for (const g of groups) {
      for (const opt of g.options) out.push({ group: g.group, label: opt.label, value: opt.value });
    }
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

    const byGroup = new Map<string, Array<{ label: string; value: string }>>();
    for (const r of rows) {
      if (!byGroup.has(r.group)) byGroup.set(r.group, []);
      byGroup.get(r.group)!.push({ label: r.label, value: r.value });
    }

    const result: Array<{ group: string; options: Array<{ label: string; value: string }> }> = [];
    for (const g of groups) {
      const opts = byGroup.get(g.group);
      if (opts && opts.length) result.push({ group: g.group, options: opts });
    }
    return result;
  }, [flat, q, groups]);

  const currentLabel = useMemo(() => {
    if (!value) return "";
    for (const g of groups) {
      for (const opt of g.options) if (opt.value === value) return opt.label;
    }
    return value;
  }, [groups, value]);

  useEffect(() => {
    if (!open) return;

    const el = wrapRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;

      // dropdown ~ 360px com margem
      const need = 360;
      if (spaceBelow < need && spaceAbove > spaceBelow) setDir("up");
      else setDir("down");
    }

    const onDown = (e: MouseEvent | TouchEvent) => {
      const el2 = wrapRef.current;
      const t = e.target as Node | null;
      if (!el2 || !t) return;
      if (!el2.contains(t)) setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);

    window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
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
          currentLabel ? "text-black" : "text-black/45",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="block truncate">{currentLabel ? currentLabel : placeholder}</span>

        <span className="absolute right-4 inset-y-0 flex items-center justify-center">
          {loading ? <SpinnerMini reduced={!!prefersReducedMotion} /> : <ChevronDown className="h-5 w-5 text-black/50" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: dir === "down" ? 10 : -10, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: dir === "down" ? 10 : -10, filter: "blur(10px)" }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: EASE }}
            className={cx("absolute left-0 right-0 z-[40]", dir === "down" ? "mt-2 top-full" : "mb-2 bottom-full")}
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

              <div className="max-h-[320px] overflow-auto px-2 pb-2">
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-[13px] text-black/55">Nenhum resultado.</div>
                ) : (
                  filtered.map((g) => (
                    <div key={g.group} className="pb-3">
                      <div className="px-3 pt-2 pb-2 text-[11px] font-semibold text-black/45">{g.group}</div>

                      <div className="space-y-2">
                        {g.options.map((opt) => {
                          const active = opt.value === value;

                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                onChange(opt.value);
                                setOpen(false);
                                setQ("");
                              }}
                              className={cx(
                                "w-full flex items-center justify-between gap-3",
                                "rounded-[14px] px-4 py-3.5 text-left text-[13px] font-semibold transition-all",
                                active
                                  ? "bg-black text-white"
                                  : "bg-[#f3f3f3] text-black/75 hover:text-black hover:bg-[#ededed]",
                              )}
                            >
                              <span className="truncate">{opt.label}</span>
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

function ToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cx(
        "w-full flex items-center justify-between gap-3",
        "rounded-[16px] bg-[#f3f3f3] px-5 py-4",
        "text-left text-[13px] font-semibold text-black/75 hover:text-black hover:bg-[#ededed] transition-all",
      )}
    >
      <span className="pr-3">{label}</span>
      <span
        className={cx(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          checked ? "bg-black" : "bg-black/20",
        )}
      >
        <span
          className={cx(
            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-5" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

export default function OnboardCreateAccountClient3({
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
    () => ({ xs: 0.18, sm: 0.22, md: 0.35, lg: 0.7, xl: 0.9 }),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step-3 fields
  const [aiAutoMode, setAiAutoMode] = useState("");
  const [handoffHumanRequest, setHandoffHumanRequest] = useState(false);
  const [handoffAngerUrgency, setHandoffAngerUrgency] = useState(false);
  const [handoffAfterMessages, setHandoffAfterMessages] = useState(""); // string (para digitar sem travar)
  const [handoffPricePayment, setHandoffPricePayment] = useState(false);
  const [brandTone, setBrandTone] = useState("");
  const [msgSignature, setMsgSignature] = useState("");

  // extras IA
  const [aiCatalogSummary, setAiCatalogSummary] = useState("");
  const [aiKnowledgeLinks, setAiKnowledgeLinks] = useState("");
  const [aiGuardrails, setAiGuardrails] = useState("");

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
    toastTimerRef.current = window.setTimeout(() => setSaveToastOpen(false), 1100);
  }, []);

  const isFieldLoading = useCallback(
    (k: string) => !!dirty[k] || savingKeys.includes(k),
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

      if (inFlightRef.current?.controller) inFlightRef.current.controller.abort();

      const patchToSend = { ...pendingPatchRef.current };
      pendingPatchRef.current = {};

      const versionsSnapshot: Record<string, number> = {};
      keys.forEach((k) => (versionsSnapshot[k] = fieldVerRef.current[k] || 0));

      const id = ++reqSeqRef.current;
      const controller = new AbortController();

      inFlightRef.current = { id, controller, keys, versions: versionsSnapshot, patch: patchToSend };

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

            // se backend devolver fieldErrors (ex.: cnpj não encontrado), mostra sem travar
            if (j?.fieldErrors) {
              const first = Object.values(j.fieldErrors)[0];
              if (first) setError(String(first));
            }
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

          if (mountedRef.current && failureRef.current >= 2) setError(msg);

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
    saveTimerRef.current = window.setTimeout(() => flushNow("debounce"), 260);
  }, [flushNow]);

  const queueSave = useCallback(
    (patch: Record<string, any>) => {
      setError(null);

      const keys = Object.keys(patch || {});
      keys.forEach((k) => (fieldVerRef.current[k] = (fieldVerRef.current[k] || 0) + 1));

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

  // load
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const j = await api("/api/wz_OnboardSystem/me");
        if (!mounted) return;

        if (j?.data?.completed) {
          router.replace("/");
          return;
        }

        setAiAutoMode(j?.data?.aiAutoMode || "");
        setHandoffHumanRequest(!!j?.data?.handoffHumanRequest);
        setHandoffAngerUrgency(!!j?.data?.handoffAngerUrgency);
        setHandoffAfterMessages(
          typeof j?.data?.handoffAfterMessages === "number" ? String(j.data.handoffAfterMessages) : "",
        );
        setHandoffPricePayment(!!j?.data?.handoffPricePayment);
        setBrandTone(j?.data?.brandTone || "");
        setMsgSignature(j?.data?.msgSignature || "");

        setAiCatalogSummary(j?.data?.aiCatalogSummary || "");
        setAiKnowledgeLinks(j?.data?.aiKnowledgeLinks || "");
        setAiGuardrails(j?.data?.aiGuardrails || "");
      } catch (e: any) {
        setError(e?.message || "Erro ao carregar onboarding.");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [api, router]);

  const [leaving, setLeaving] = useState<null | "back" | "done">(null);

  const goBack = useCallback(async () => {
    if (busy) return;
    setBusy(true);

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    await flushNow("nav");

    setLeaving("back");
    window.setTimeout(() => router.push("/create-account/step-2"), prefersReducedMotion ? 0 : 220);
  }, [busy, flushNow, prefersReducedMotion, router]);

  const finish = useCallback(async () => {
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

    try {
      const j = await api("/api/wz_OnboardSystem/complete", {});
      if (j?.warnings) {
        const first = Object.values(j.warnings)[0];
        if (first) setError(String(first));
      }
      setLeaving("done");
      window.setTimeout(() => router.replace(j?.nextUrl || "/"), prefersReducedMotion ? 0 : 260);
    } catch (e: any) {
      setBusy(false);
      setError(e?.message || "Falha ao finalizar.");
    }
  }, [api, busy, flushNow, prefersReducedMotion, router]);

  const aiModeGroups = useMemo<GroupedOptions>(
    () => [
      {
        group: "Automação",
        options: [
          { label: "Sim, em tudo", value: "all" },
          { label: "Sim, só em perguntas comuns", value: "common" },
          { label: "Não, só assistente para atendentes", value: "assistant" },
        ],
      },
    ],
    [],
  );

  const toneGroups = useMemo<GroupedOptions>(
    () => [
      {
        group: "Tom de voz",
        options: [
          { label: "Formal", value: "formal" },
          { label: "Neutro", value: "neutral" },
          { label: "Descontraído", value: "casual" },
        ],
      },
    ],
    [],
  );

  const handoffEnabled = aiAutoMode === "all" || aiAutoMode === "common";

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="relative z-10 min-h-screen flex items-start sm:items-center justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+44px)] sm:pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+44px)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={leaving ? "leaving" : "idle"}
            initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
            animate={
              leaving === "done"
                ? { opacity: 0, x: -18, filter: "blur(10px)" }
                : leaving === "back"
                  ? { opacity: 0, x: 18, filter: "blur(10px)" }
                  : { opacity: 1, x: 0, y: 0, filter: "blur(0px)" }
            }
            exit={{ opacity: 0, y: 16, filter: "blur(10px)" }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: leaving ? DUR.sm : DUR.lg, ease: EASE }}
            className="w-full max-w-[640px]"
            style={{ willChange: "transform, opacity, filter" }}
          >
            <div className="rounded-[28px] bg-white p-7 sm:p-9 md:p-10">
              <div className="text-center">
                <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04] ring-1 ring-black/5 shrink-0">
                  <Sparkles className="h-6 w-6 text-black/80" />
                </div>

                <div className="text-black font-semibold tracking-tight text-[26px] sm:text-[30px] md:text-[34px]">
                  Mensageria e automação
                </div>

                <div className="mt-2 text-black/55 text-[14px] sm:text-[15px] md:text-[16px]">
                  Vamos ajustar a IA para ficar perfeita no seu WhatsApp.
                </div>

                <div className="mt-3 text-[12px] text-black/40 font-medium">
                  Logado como <span className="text-black/60 font-semibold">{email}</span>
                </div>
              </div>

              <div className="mt-10">
                <AnimatePresence initial={false}>
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: EASE }}
                      className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 px-6 py-5 flex items-center justify-center gap-2 text-black/60 text-[14px]"
                    >
                      <SpinnerMini reduced={!!prefersReducedMotion} />
                      Carregando…
                    </motion.div>
                  )}
                </AnimatePresence>

                {!loading && (
                  <>
                    <div className="space-y-5">
                      {/* IA Auto */}
                      <div>
                        <div className="text-black/70 text-[13px] font-semibold mb-2">
                          Você quer IA respondendo automaticamente?
                        </div>

                        <SearchableSelect
                          value={aiAutoMode}
                          placeholder="Selecione uma opção"
                          groups={aiModeGroups}
                          onChange={(v) => {
                            setAiAutoMode(v);
                            queueSave({ aiAutoMode: v });
                          }}
                          loading={isFieldLoading("aiAutoMode")}
                          prefersReducedMotion={!!prefersReducedMotion}
                          EASE={EASE}
                        />
                      </div>

                      {/* Handoff */}
                      <div className={cx(!handoffEnabled && "opacity-60")}>
                        <div className="text-black/70 text-[13px] font-semibold mb-2">
                          Se a IA responder, quando deve passar para humano?
                        </div>

                        <div className="space-y-2">
                          <ToggleRow
                            label="Cliente pediu humano"
                            checked={handoffHumanRequest}
                            onToggle={() => {
                              const next = !handoffHumanRequest;
                              setHandoffHumanRequest(next);
                              queueSave({ handoffHumanRequest: next });
                            }}
                          />

                          <ToggleRow
                            label="Detectar raiva/urgência (palavras-chave)"
                            checked={handoffAngerUrgency}
                            onToggle={() => {
                              const next = !handoffAngerUrgency;
                              setHandoffAngerUrgency(next);
                              queueSave({ handoffAngerUrgency: next });
                            }}
                          />

                          <ToggleRow
                            label="Quando for preço/pagamento"
                            checked={handoffPricePayment}
                            onToggle={() => {
                              const next = !handoffPricePayment;
                              setHandoffPricePayment(next);
                              queueSave({ handoffPricePayment: next });
                            }}
                          />

                          <div className="rounded-[16px] bg-[#f3f3f3] px-4 py-4">
                            <div className="text-[13px] font-semibold text-black/75 mb-2">
                              Após X mensagens sem resolver
                            </div>

                            <div className="relative">
                              <input
                                value={handoffAfterMessages}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^\d]/g, "").slice(0, 2);
                                  setHandoffAfterMessages(v);
                                  // salva enquanto digita, mas backend ignora inválido; e vazio vira null
                                  queueSave({ handoffAfterMessages: v });
                                }}
                                onBlur={onBlurFlush}
                                placeholder="Ex: 5"
                                inputMode="numeric"
                                className="w-full rounded-[14px] bg-white px-4 py-3 text-[13px] font-semibold text-black/80 placeholder-black/35 focus:outline-none"
                              />
                              <div className="absolute right-3 inset-y-0 flex items-center justify-center">
                                <AnimatePresence initial={false}>
                                  {isFieldLoading("handoffAfterMessages") && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.92 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.92 }}
                                      transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: EASE }}
                                    >
                                      <SpinnerMini reduced={!!prefersReducedMotion} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>

                            <div className="mt-2 text-[12px] text-black/45">
                              Dica: 4–8 mensagens costuma funcionar bem.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tom de voz */}
                      <div>
                        <div className="text-black/70 text-[13px] font-semibold mb-2">
                          Tom de voz da marca
                        </div>

                        <SearchableSelect
                          value={brandTone}
                          placeholder="Selecione"
                          groups={toneGroups}
                          onChange={(v) => {
                            setBrandTone(v);
                            queueSave({ brandTone: v });
                          }}
                          loading={isFieldLoading("brandTone")}
                          prefersReducedMotion={!!prefersReducedMotion}
                          EASE={EASE}
                        />
                      </div>

                      {/* Assinatura */}
                      <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden relative">
                        <input
                          value={msgSignature}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMsgSignature(v);
                            queueSave({ msgSignature: v });
                          }}
                          onBlur={onBlurFlush}
                          placeholder='Assinatura (ex: "— Equipe Wyzer" / "— Ana | Suporte")'
                          className="w-full bg-transparent px-6 py-5 pr-16 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                        />
                        <div className="absolute right-4 inset-y-0 flex items-center justify-center">
                          <AnimatePresence initial={false}>
                            {isFieldLoading("msgSignature") && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: EASE }}
                              >
                                <SpinnerMini reduced={!!prefersReducedMotion} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Extras IA */}
                      <div className="pt-2">
                        <div className="text-black/85 text-[14px] font-semibold flex items-center gap-2 mb-2">
                          <Users2 className="h-4 w-4 text-black/60" />
                          Dados extras para deixar a IA mais inteligente
                        </div>
                        <div className="text-black/50 text-[12px] mb-3">
                          Opcional, mas isso aumenta MUITO a qualidade das respostas no futuro.
                        </div>

                        {/* o que vende */}
                        <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden relative">
                          <div className="absolute left-4 top-4 text-black/40">
                            <Shield className="h-4 w-4" />
                          </div>
                          <textarea
                            value={aiCatalogSummary}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAiCatalogSummary(v);
                              queueSave({ aiCatalogSummary: v });
                            }}
                            onBlur={onBlurFlush}
                            placeholder="O que você vende/resolve? (1–2 frases) Ex: automação de WhatsApp para clínicas…"
                            className="w-full bg-transparent pl-11 pr-16 px-6 py-5 text-[14px] text-black placeholder-black/45 focus:outline-none min-h-[110px] resize-none"
                          />
                          <div className="absolute right-4 top-4">
                            <AnimatePresence initial={false}>
                              {isFieldLoading("aiCatalogSummary") && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.92 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.92 }}
                                  transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: EASE }}
                                >
                                  <SpinnerMini reduced={!!prefersReducedMotion} />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* links */}
                        <div className="mt-3 rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden relative">
                          <div className="absolute left-4 top-4 text-black/40">
                            <Link2 className="h-4 w-4" />
                          </div>
                          <textarea
                            value={aiKnowledgeLinks}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAiKnowledgeLinks(v);
                              queueSave({ aiKnowledgeLinks: v });
                            }}
                            onBlur={onBlurFlush}
                            placeholder="Links importantes (site, catálogo, políticas, FAQ, etc). Pode colar vários."
                            className="w-full bg-transparent pl-11 pr-16 px-6 py-5 text-[14px] text-black placeholder-black/45 focus:outline-none min-h-[110px] resize-none"
                          />
                          <div className="absolute right-4 top-4">
                            <AnimatePresence initial={false}>
                              {isFieldLoading("aiKnowledgeLinks") && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.92 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.92 }}
                                  transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: EASE }}
                                >
                                  <SpinnerMini reduced={!!prefersReducedMotion} />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* guardrails */}
                        <div className="mt-3 rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden relative">
                          <div className="absolute left-4 top-4 text-black/40">
                            <Shield className="h-4 w-4" />
                          </div>
                          <textarea
                            value={aiGuardrails}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAiGuardrails(v);
                              queueSave({ aiGuardrails: v });
                            }}
                            onBlur={onBlurFlush}
                            placeholder="Regras/limites: o que a IA nunca deve prometer/falar? (descontos, prazos, termos…)"
                            className="w-full bg-transparent pl-11 pr-16 px-6 py-5 text-[14px] text-black placeholder-black/45 focus:outline-none min-h-[110px] resize-none"
                          />
                          <div className="absolute right-4 top-4">
                            <AnimatePresence initial={false}>
                              {isFieldLoading("aiGuardrails") && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.92 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.92 }}
                                  transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: EASE }}
                                >
                                  <SpinnerMini reduced={!!prefersReducedMotion} />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {!!error && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                          transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: EASE }}
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
                        onClick={finish}
                        disabled={busy}
                        whileHover={prefersReducedMotion || busy ? undefined : { y: -2, scale: 1.01 }}
                        whileTap={prefersReducedMotion || busy ? undefined : { scale: 0.98 }}
                        transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
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
                        <span className="relative z-10">{busy ? "Finalizando..." : "Finalizar"}</span>

                        <motion.span
                          whileHover={prefersReducedMotion || busy ? undefined : { scale: 1.06 }}
                          whileTap={prefersReducedMotion || busy ? undefined : { scale: 0.96 }}
                          transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                          className={cx(
                            "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2.5 transition-all duration-300 ease-out",
                            busy ? "bg-transparent" : "bg-transparent group-hover:bg-white/10 group-hover:translate-x-0.5",
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
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: EASE }}
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
