"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Users2 } from "lucide-react";
import { useRouter } from "next/navigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(v: string) {
  return v.replace(/\D+/g, "");
}

function formatCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);

  if (d.length <= 2) return p1;
  if (d.length <= 5) return `${p1}.${p2}`;
  if (d.length <= 8) return `${p1}.${p2}.${p3}`;
  if (d.length <= 12) return `${p1}.${p2}.${p3}/${p4}`;
  return `${p1}.${p2}.${p3}/${p4}-${p5}`;
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
        <span className="absolute inset-0 rounded-full border-2 border-black/15 mt-1.5" />
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

type CompanySize = "1-5" | "6-20" | "21-100" | "100+";

export default function OnboardCreateAccountClient({
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos do onboarding (1 página)
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [websiteOrInstagram, setWebsiteOrInstagram] = useState("");
  const [segment, setSegment] = useState("");
  const [companySize, setCompanySize] = useState<CompanySize | "">("");

  const saveTimerRef = useRef<number | null>(null);
  const saveAbortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingField, setSavingField] = useState<string | null>(null);

  const [saveToastOpen, setSaveToastOpen] = useState(false);
  const [saveToastTick, setSaveToastTick] = useState(0);

  const segmentPresets = useMemo(
    () => [
      "Estética",
      "E-commerce",
      "Clínica",
      "Imobiliária",
      "Educação",
      "Restaurante",
      "Academia",
      "Serviços",
      "SaaS",
      "Outro",
    ],
    [],
  );

  const sizePresets = useMemo(
    () => ["1-5", "6-20", "21-100", "100+"] as CompanySize[],
    [],
  );

  const canContinue = useMemo(() => {
    const okName = companyName.trim().length >= 2;
    const okSeg = segment.trim().length >= 2;
    const okSize = !!companySize;
    // cnpj é opcional: se vier preenchido, precisa ter 14 dígitos
    const d = onlyDigits(cnpj);
    const okCnpj = d.length === 0 || d.length === 14;
    return okName && okSeg && okSize && okCnpj;
  }, [companyName, segment, companySize, cnpj]);

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
    }, 1200);
  }, []);

  const isFieldLoading = useCallback(
    (k: string) => {
      return !!dirty[k] || savingField === k;
    },
    [dirty, savingField],
  );

  // Carrega dados existentes e se já completou, redireciona pro dashboard “limpo”
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

        setCompanyName(j?.data?.companyName || "");
        setCnpj(j?.data?.cnpj ? formatCnpj(String(j.data.cnpj)) : "");
        setTradeName(j?.data?.tradeName || "");
        setWebsiteOrInstagram(j?.data?.websiteOrInstagram || "");
        setSegment(j?.data?.segment || "");
        setCompanySize((j?.data?.companySize as any) || "");
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

  const queueSave = useCallback(
    (fieldKey: string, patch: any) => {
      setError(null);

      // marca como "pendente" (loader no input)
      const keys = Object.keys(patch || {});
      setDirty((prev) => {
        const next = { ...prev };
        keys.forEach((k) => (next[k] = true));
        return next;
      });

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        setSaving(true);
        setSavingField(fieldKey);

        try {
          if (saveAbortRef.current) saveAbortRef.current.abort();
          saveAbortRef.current = new AbortController();

          const res = await fetch("/api/wz_OnboardSystem/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
            signal: saveAbortRef.current.signal,
          });

          if (res.status === 401) {
            hardRedirectToLogin();
            return;
          }

          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j?.error || "Falha ao salvar.");

          // limpa loaders desses campos
          setDirty((prev) => {
            const next = { ...prev };
            keys.forEach((k) => (next[k] = false));
            return next;
          });

          fireSavedToast();
        } catch (e: any) {
          if (e?.name === "AbortError") return;
          setError(e?.message || "Erro ao salvar.");
        } finally {
          setSaving(false);
          setSavingField(null);
        }
      }, 520);
    },
    [hardRedirectToLogin, fireSavedToast],
  );

  const continueFlow = useCallback(async () => {
    if (!canContinue || busy) return;

    setBusy(true);
    setError(null);

    try {
      const payload = {
        companyName,
        cnpj,
        tradeName,
        websiteOrInstagram,
        segment,
        companySize,
      };

      // ✅ NÃO marca como "complete" (vai ter próximos passos)
      const res = await fetch("/api/wz_OnboardSystem/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        hardRedirectToLogin();
        return;
      }

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Falha ao salvar.");

      fireSavedToast();

      // ✅ Próximo passo você vai me passar depois
      // router.replace("/create-account/step-2");
    } catch (e: any) {
      setError(e?.message || "Erro ao continuar.");
    } finally {
      setBusy(false);
    }
  }, [
    canContinue,
    busy,
    companyName,
    cnpj,
    tradeName,
    websiteOrInstagram,
    segment,
    companySize,
    hardRedirectToLogin,
    fireSavedToast,
  ]);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="relative z-10 min-h-screen flex items-start sm:items-center justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+44px)] sm:pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+44px)]">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: DUR.lg, ease: EASE }
          }
          className="w-full max-w-[640px]"
          style={{ willChange: "transform, opacity, filter" }}
        >
          <div className="rounded-[28px] p-7 sm:p-9 md:p-10">
            <div className="text-center">
              <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04] ring-1 ring-black/5 shrink-0">
                <Users2 className="h-6 w-6 text-black/80" />
              </div>

              <div className="text-black font-semibold tracking-tight text-[26px] sm:text-[30px] md:text-[34px]">
                Configure sua empresa
              </div>

              <div className="mt-2 text-black/55 text-[14px] sm:text-[15px] md:text-[16px]">
                Isso leva menos de 1 minuto. Vamos personalizar o seu dashboard.
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nome empresa */}
                    <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden relative">
                      <input
                        value={companyName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCompanyName(v);
                          queueSave("companyName", { companyName: v });
                        }}
                        placeholder="Nome da empresa"
                        className="w-full bg-transparent px-6 py-5 pr-14 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                        autoComplete="organization"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2">
                        <AnimatePresence initial={false}>
                          {isFieldLoading("companyName") && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.92 }}
                              transition={{
                                duration: prefersReducedMotion ? 0 : 0.18,
                                ease: EASE,
                              }}
                            >
                              <SpinnerMini reduced={!!prefersReducedMotion} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* CNPJ opcional */}
                    <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden relative">
                      <input
                        value={cnpj}
                        onChange={(e) => {
                          const v = formatCnpj(e.target.value);
                          setCnpj(v);
                          queueSave("cnpj", { cnpj: v });
                        }}
                        placeholder="CNPJ (opcional)"
                        className="w-full bg-transparent px-6 py-5 pr-14 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                        inputMode="numeric"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2">
                        <AnimatePresence initial={false}>
                          {isFieldLoading("cnpj") && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.92 }}
                              transition={{
                                duration: prefersReducedMotion ? 0 : 0.18,
                                ease: EASE,
                              }}
                            >
                              <SpinnerMini reduced={!!prefersReducedMotion} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Nome fantasia opcional */}
                    <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden md:col-span-2 relative">
                      <input
                        value={tradeName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setTradeName(v);
                          queueSave("tradeName", { tradeName: v });
                        }}
                        placeholder="Nome fantasia (opcional)"
                        className="w-full bg-transparent px-6 py-5 pr-14 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2">
                        <AnimatePresence initial={false}>
                          {isFieldLoading("tradeName") && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.92 }}
                              transition={{
                                duration: prefersReducedMotion ? 0 : 0.18,
                                ease: EASE,
                              }}
                            >
                              <SpinnerMini reduced={!!prefersReducedMotion} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Site/Instagram opcional */}
                    <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden md:col-span-2 relative">
                      <input
                        value={websiteOrInstagram}
                        onChange={(e) => {
                          const v = e.target.value;
                          setWebsiteOrInstagram(v);
                          queueSave("websiteOrInstagram", {
                            websiteOrInstagram: v,
                          });
                        }}
                        placeholder="Site ou Instagram (opcional — ajuda no contexto)"
                        className="w-full bg-transparent px-6 py-5 pr-14 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2">
                        <AnimatePresence initial={false}>
                          {isFieldLoading("websiteOrInstagram") && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.92 }}
                              transition={{
                                duration: prefersReducedMotion ? 0 : 0.18,
                                ease: EASE,
                              }}
                            >
                              <SpinnerMini reduced={!!prefersReducedMotion} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Segmento */}
                    <div className="md:col-span-2">
                      <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden relative">
                        <input
                          value={segment}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSegment(v);
                            queueSave("segment", { segment: v });
                          }}
                          placeholder="Segmento (ex: estética, e-commerce, clínica, etc)"
                          className="w-full bg-transparent px-6 py-5 pr-14 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                        />
                        <div className="absolute right-5 top-1/2 -translate-y-1/2">
                          <AnimatePresence initial={false}>
                            {isFieldLoading("segment") && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                transition={{
                                  duration: prefersReducedMotion ? 0 : 0.18,
                                  ease: EASE,
                                }}
                              >
                                <SpinnerMini reduced={!!prefersReducedMotion} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {segmentPresets.map((s) => {
                          const active =
                            segment.trim().toLowerCase() === s.toLowerCase();
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                const next = s === "Outro" ? segment : s;
                                setSegment(next);
                                queueSave("segment", { segment: next });
                              }}
                              className={cx(
                                "rounded-full px-4 py-2 text-[13px] font-semibold transition-all",
                                active
                                  ? "bg-black text-white"
                                  : "bg-[#f3f3f3] ring-1 ring-black/10 text-black/70 hover:text-black hover:bg-[#ededed]",
                              )}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tamanho */}
                    <div className="md:col-span-2 mt-2">
                      <div className="text-black/70 text-[13px] font-semibold mb-3">
                        Tamanho da empresa
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {sizePresets.map((s) => {
                          const active = companySize === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setCompanySize(s);
                                queueSave("companySize", { companySize: s });
                              }}
                              className={cx(
                                "rounded-[14px] px-4 py-2 text-[13px] font-semibold transition-all",
                                active
                                  ? "bg-black text-white"
                                  : "bg-[#f3f3f3] ring-1 ring-black/10 text-black/70 hover:text-black hover:bg-[#ededed]",
                              )}
                            >
                              {s === "1-5"
                                ? "1–5"
                                : s === "6-20"
                                  ? "6–20"
                                  : s === "21-100"
                                    ? "21–100"
                                    : "100+"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Error */}
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

                  {/* Bottom actions */}
                  <div className="mt-10 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => router.replace("/")}
                      className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-white ring-1 ring-black/10 text-black/70 text-[14px] font-semibold hover:text-black hover:bg-[#f7f7f7] transition-colors"
                    >
                      Voltar
                    </button>

                    <motion.button
                      type="button"
                      onClick={continueFlow}
                      disabled={!canContinue || busy}
                      whileHover={
                        prefersReducedMotion || !canContinue || busy
                          ? undefined
                          : { y: -2, scale: 1.01 }
                      }
                      whileTap={
                        prefersReducedMotion || !canContinue || busy
                          ? undefined
                          : { scale: 0.98 }
                      }
                      transition={{
                        duration: prefersReducedMotion ? 0 : DUR.sm,
                        ease: EASE,
                      }}
                      className={cx(
                        "group relative rounded-full px-7 py-3 bg-[#171717] border border-[#454545] border-2 text-white",
                        "focus:outline-none transition-all duration-300 ease-out",
                        "text-[14px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-14 transform-gpu",
                        !canContinue || busy
                          ? "opacity-60 cursor-not-allowed select-none pointer-events-none"
                          : "hover:border-[#6a6a6a] focus:border-lime-400",
                      )}
                      style={{ willChange: "transform" }}
                    >
                      <span className="relative z-10">
                        {busy ? "Aguarde..." : "Continuar"}
                      </span>

                      <motion.span
                        whileHover={
                          prefersReducedMotion || !canContinue || busy
                            ? undefined
                            : { scale: 1.06 }
                        }
                        whileTap={
                          prefersReducedMotion || !canContinue || busy
                            ? undefined
                            : { scale: 0.96 }
                        }
                        transition={{
                          duration: prefersReducedMotion ? 0 : DUR.sm,
                          ease: EASE,
                        }}
                        className={cx(
                          "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2.5 transition-all duration-300 ease-out",
                          !canContinue || busy
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
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ✅ Toast "Salvo com sucesso" (sobe e desce) */}
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
