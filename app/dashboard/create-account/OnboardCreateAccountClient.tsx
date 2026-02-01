"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  Users2,
  Globe,
  LogOut,
  Check,
} from "lucide-react";
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
  const [savedPulse, setSavedPulse] = useState(false);
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

  const canFinish = useMemo(() => {
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
    (patch: any) => {
      setError(null);

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        setSaving(true);

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

          setSavedPulse(true);
          window.setTimeout(() => setSavedPulse(false), 700);
        } catch (e: any) {
          if (e?.name === "AbortError") return;
          setError(e?.message || "Erro ao salvar.");
        } finally {
          setSaving(false);
        }
      }, 520);
    },
    [hardRedirectToLogin],
  );

  const finish = useCallback(async () => {
    if (!canFinish || busy) return;

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

      const j = await api("/api/wz_OnboardSystem/complete", payload);
      const nextUrl = String(j?.nextUrl || "/");
      router.replace(nextUrl);
    } catch (e: any) {
      setError(e?.message || "Erro ao finalizar.");
    } finally {
      setBusy(false);
    }
  }, [
    api,
    router,
    canFinish,
    busy,
    companyName,
    cnpj,
    tradeName,
    websiteOrInstagram,
    segment,
    companySize,
  ]);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="relative z-10 min-h-screen flex items-start md:items-center justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+44px)] md:pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+44px)]">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: DUR.lg, ease: EASE }
          }
          className="w-full max-w-[1150px]"
          style={{ willChange: "transform, opacity, filter" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6 md:gap-10">
            {/* LEFT CARD (igual vibe da imagem) */}
            <div className="rounded-[28px] bg-[#f7f7f7] ring-1 ring-black/5 p-7 md:p-8 flex flex-col min-h-[520px]">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-[14px] bg-emerald-600/90 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.10)] ring-1 ring-black/10">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div className="text-black font-semibold tracking-tight text-[18px]">
                  Wyzer
                </div>
              </div>

              <div className="mt-10 space-y-7">
                <div>
                  <div className="text-black font-semibold text-[15px]">
                    Suporte por e-mail
                  </div>
                  <div className="mt-1 text-black/60 text-[13px]">
                    Respondemos em até 24h.
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 text-[14px] font-semibold text-black/80">
                    <Mail className="h-4 w-4" />
                    support@wyzer.com.br
                  </div>
                </div>

                <div className="h-px bg-black/10" />

                <div>
                  <div className="text-black font-semibold text-[15px]">
                    Chat suporte
                  </div>
                  <div className="mt-1 text-black/60 text-[13px]">
                    Atendimento rápido durante o horário comercial.
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 text-[14px] font-semibold text-black/80">
                    <MessageCircle className="h-4 w-4" />
                    Iniciar chat
                    <span className="ml-1 rounded-full bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-600/20 px-2 py-0.5 text-[12px] font-semibold">
                      Online
                    </span>
                  </div>
                </div>

                <div className="h-px bg-black/10" />

                <div>
                  <div className="text-black font-semibold text-[15px]">
                    Ligue para nós
                  </div>
                  <div className="mt-1 text-black/60 text-[13px]">
                    Seg–Sex, 9:00–18:00 (BRT).
                  </div>
                  <div className="mt-2 flex flex-col gap-1 text-[14px] font-semibold text-black/80">
                    <span className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      +55 (11) 0000-0000
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Headphones className="h-4 w-4" />
                      +55 (11) 0000-0000
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8 flex items-center justify-between">
                <form action="/api/wz_AuthLogin/logout" method="post">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white ring-1 ring-black/10 text-[13px] font-semibold text-black/70 hover:text-black hover:bg-[#f3f3f3] transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </form>

                <div className="text-[12px] text-black/45 font-medium">
                  Logado como{" "}
                  <span className="text-black/65 font-semibold">{email}</span>
                </div>
              </div>
            </div>

            {/* RIGHT (FORM) */}
            <div className="rounded-[28px] bg-white ring-1 ring-black/10 p-7 md:p-10">
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

                <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-black/55">
                  <AnimatePresence initial={false}>
                    {saving ? (
                      <motion.div
                        key="saving"
                        initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : 0.18,
                          ease: EASE,
                        }}
                        className="inline-flex items-center gap-2"
                      >
                        <SpinnerMini reduced={!!prefersReducedMotion} />
                        Salvando…
                      </motion.div>
                    ) : savedPulse ? (
                      <motion.div
                        key="saved"
                        initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : 0.18,
                          ease: EASE,
                        }}
                        className="inline-flex items-center gap-2 text-emerald-700"
                      >
                        <Check className="h-4 w-4" />
                        Salvo
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
                        className="inline-flex items-center gap-2"
                      >
                        <Globe className="h-4 w-4" />
                        Dados sincronizam automaticamente
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                    {/* Grid 2 col (desktop) como na imagem */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nome empresa */}
                      <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden">
                        <input
                          value={companyName}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCompanyName(v);
                            queueSave({ companyName: v });
                          }}
                          placeholder="Nome da empresa"
                          className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                          autoComplete="organization"
                        />
                      </div>

                      {/* CNPJ opcional */}
                      <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden">
                        <input
                          value={cnpj}
                          onChange={(e) => {
                            const v = formatCnpj(e.target.value);
                            setCnpj(v);
                            queueSave({ cnpj: v });
                          }}
                          placeholder="CNPJ (opcional)"
                          className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                          inputMode="numeric"
                        />
                      </div>

                      {/* Nome fantasia opcional */}
                      <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden md:col-span-2">
                        <input
                          value={tradeName}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTradeName(v);
                            queueSave({ tradeName: v });
                          }}
                          placeholder="Nome fantasia (opcional)"
                          className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                        />
                      </div>

                      {/* Site/Instagram opcional */}
                      <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden md:col-span-2">
                        <input
                          value={websiteOrInstagram}
                          onChange={(e) => {
                            const v = e.target.value;
                            setWebsiteOrInstagram(v);
                            queueSave({ websiteOrInstagram: v });
                          }}
                          placeholder="Site ou Instagram (opcional — ajuda no contexto)"
                          className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                        />
                      </div>

                      {/* Segmento */}
                      <div className="md:col-span-2">
                        <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden">
                          <input
                            value={segment}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSegment(v);
                              queueSave({ segment: v });
                            }}
                            placeholder="Segmento (ex: estética, e-commerce, clínica, etc)"
                            className="w-full bg-transparent px-6 py-5 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                          />
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
                                  queueSave({ segment: next });
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
                                  queueSave({ companySize: s });
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

                    {/* Bottom actions (igual vibe da imagem: back + finish) */}
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
                        onClick={finish}
                        disabled={!canFinish || busy}
                        whileHover={
                          prefersReducedMotion || !canFinish || busy
                            ? undefined
                            : { y: -2, scale: 1.01 }
                        }
                        whileTap={
                          prefersReducedMotion || !canFinish || busy
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
                          !canFinish || busy
                            ? "opacity-60 cursor-not-allowed select-none pointer-events-none"
                            : "hover:border-[#6a6a6a] focus:border-lime-400",
                        )}
                        style={{ willChange: "transform" }}
                      >
                        <span className="relative z-10">
                          {busy ? "Finalizando..." : "Finalizar"}
                        </span>

                        <motion.span
                          whileHover={
                            prefersReducedMotion || !canFinish || busy
                              ? undefined
                              : { scale: 1.06 }
                          }
                          whileTap={
                            prefersReducedMotion || !canFinish || busy
                              ? undefined
                              : { scale: 0.96 }
                          }
                          transition={{
                            duration: prefersReducedMotion ? 0 : DUR.sm,
                            ease: EASE,
                          }}
                          className={cx(
                            "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2.5 transition-all duration-300 ease-out",
                            !canFinish || busy
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

                    {/* Debug opcional (mantém teu exemplo de sessão “visível” se quiser) */}
                    <div className="mt-8 rounded-[18px] bg-black/[0.04] ring-1 ring-black/10 px-5 py-4 text-left">
                      <div className="text-[13px] text-black/60">User ID</div>
                      <div className="text-[15px] font-semibold text-black break-all">
                        {userId}
                      </div>

                      <div className="mt-4 text-[13px] text-black/60">E-mail</div>
                      <div className="text-[15px] font-semibold text-black break-all">
                        {email}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
