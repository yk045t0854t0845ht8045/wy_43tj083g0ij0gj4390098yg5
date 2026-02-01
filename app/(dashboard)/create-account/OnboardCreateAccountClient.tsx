"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Users2, ChevronDown, Search, Check } from "lucide-react";
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

type TokenPart = { text: string; dim?: boolean };

function tokenizeWebsite(value: string): TokenPart[] {
  const s = String(value || "");
  if (!s) return [];

  let rest = s;
  const parts: TokenPart[] = [];

  while (true) {
    const l = rest.toLowerCase();

    if (l.startsWith("https://")) {
      parts.push({ text: rest.slice(0, 8), dim: true });
      rest = rest.slice(8);
      continue;
    }

    if (l.startsWith("http://")) {
      parts.push({ text: rest.slice(0, 7), dim: true });
      rest = rest.slice(7);
      continue;
    }

    if (l.startsWith("www.")) {
      parts.push({ text: rest.slice(0, 4), dim: true });
      rest = rest.slice(4);
      continue;
    }

    if (parts.length === 0 && rest.startsWith("@")) {
      parts.push({ text: "@", dim: true });
      rest = rest.slice(1);
      continue;
    }

    break;
  }

  parts.push({ text: rest, dim: false });
  return parts;
}

function WebsiteOverlayText({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const parts = useMemo(() => tokenizeWebsite(value), [value]);

  if (!value) return null;

  return (
    <div
      aria-hidden
      className={cx(
        "absolute inset-0 px-6 py-5 flex items-center pointer-events-none select-none",
        className,
      )}
    >
      <div className="w-full truncate text-[15px] sm:text-[16px]">
        {parts.map((p, i) => (
          <span
            key={i}
            className={cx(p.dim ? "text-black/35" : "text-black/80")}
          >
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
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

  // ranking simples e “inteligente”
  if (L.startsWith(Q)) return { ok: true, score: 0 };
  const idx = L.indexOf(Q);
  if (idx >= 0) return { ok: true, score: 10 + idx };
  return { ok: true, score: 50 };
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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const flat = useMemo(() => {
    const out: Array<{ group: string; label: string }> = [];
    for (const g of groups) {
      for (const opt of g.options) out.push({ group: g.group, label: opt });
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

    // mantém agrupamento visual “normal” (sem layout grandão)
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

    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      const t = e.target as Node | null;
      if (!el || !t) return;
      if (!el.contains(t)) setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);

    // foca busca ao abrir
    window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      {/* “select normal” (1 linha) */}
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
        <span className="block truncate">
          {value ? value : placeholder}
        </span>

        <span className="absolute right-4 inset-y-0 flex items-center justify-center">
          {loading ? (
            <SpinnerMini reduced={!!prefersReducedMotion} />
          ) : (
            <ChevronDown className="h-5 w-5 text-black/50" />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, filter: "blur(10px)" }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.18,
              ease: EASE,
            }}
            className="absolute left-0 right-0 mt-2 z-[40]"
          >
            <div className="rounded-[18px] bg-white ring-1 ring-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.10)] overflow-hidden">
              {/* barra de busca (topo) */}
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

              {/* lista compacta (sem “grandão”) */}
              <div className="max-h-[260px] overflow-auto px-2 pb-2">
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-[13px] text-black/55">
                    Nenhum resultado.
                  </div>
                ) : (
                  filtered.map((g) => (
                    <div key={g.group} className="pb-2">
                      <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-black/45">
                        {g.group}
                      </div>

                      <div className="space-y-1">
                        {g.options.map((opt) => {
                          const active =
                            normalizeText(value) === normalizeText(opt);

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
                                "rounded-[14px] px-4 py-3 text-left text-[13px] font-semibold transition-all",
                                active
                                  ? "bg-black text-white"
                                  : "bg-[#f3f3f3] ring-1 ring-black/10 text-black/75 hover:text-black hover:bg-[#ededed]",
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

  const [error, setError] = useState<string | null>(null);

  // Campos do onboarding (1 página)
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [websiteOrInstagram, setWebsiteOrInstagram] = useState("");
  const [segment, setSegment] = useState("");
  const [companySize, setCompanySize] = useState<CompanySize | "">("");

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

  const segmentPresets = useMemo(
    () => [
      {
        group: "Saúde & Bem-estar",
        options: [
          "Clínica / Consultório",
          "Odontologia",
          "Estética & Beleza",
          "Fisioterapia",
          "Psicologia",
          "Nutrição",
          "Academia / Fitness",
          "Veterinária / Pet",
        ],
      },
      {
        group: "Comércio",
        options: [
          "E-commerce",
          "Loja física",
          "Moda & Acessórios",
          "Mercado / Conveniência",
          "Farmácia / Perfumaria",
          "Eletrônicos / Informática",
          "Casa & Decoração",
        ],
      },
      {
        group: "Serviços",
        options: [
          "Prestador de serviços",
          "Agência / Consultoria",
          "Imobiliária",
          "Automotivo",
          "Educação / Cursos",
          "Eventos",
          "Jurídico",
          "Financeiro",
        ],
      },
      {
        group: "Alimentação & Hospitalidade",
        options: [
          "Restaurante",
          "Delivery",
          "Cafeteria",
          "Bar / Balada",
          "Hotelaria / Turismo",
        ],
      },
      {
        group: "Tecnologia",
        options: ["SaaS / Software", "Startup", "TI / Suporte", "Marketing / Mídia"],
      },
      {
        group: "Outros",
        options: ["Indústria", "Agronegócio", "ONG / Projeto social", "Outro"],
      },
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
      ...pendingPatchRef.current, // pending mais novo prevalece
    };
  }, []);

  const flushNow = useCallback(
    async (reason: "debounce" | "blur" | "nav" = "debounce") => {
      const patch = pendingPatchRef.current;
      const keys = Object.keys(patch || {});
      if (!keys.length) return true;

      // se houver request em voo, aborta e tenta com o patch mais novo
      if (inFlightRef.current?.controller) {
        inFlightRef.current.controller.abort();
      }

      const patchToSend = { ...pendingPatchRef.current };
      pendingPatchRef.current = {}; // limpa buffer, mas em erro re-merge

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

          // sucesso: só limpa dirty se não houve digitação depois
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
          // abort por digitação/novo flush: não é erro
          if (e?.name === "AbortError") {
            // devolve patch pro buffer (sem sobrescrever valores novos)
            mergePending(patchToSend);
            return false;
          }

          // erro real: re-merge e retry automático
          mergePending(patchToSend);

          const msg = String(e?.message || "Erro ao salvar.");
          failureRef.current += 1;

          // só mostra erro se persistir (evita “bg visual” a cada oscilaçao)
          if (mountedRef.current && failureRef.current >= 2) {
            setError(msg);
          }

          // retry curto (mais “forte” contra falhas)
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

      // limpa savingKeys apenas se ainda for o request atual
      if (mountedRef.current && inFlightRef.current?.id === id) {
        setSavingKeys([]);
        inFlightRef.current = null;
      }

      // se foi navegação, tenta forçar mais uma vez caso tenha patch novo pendente
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
    }, 260); // mais “tempo real” e ainda estável
  }, [flushNow]);

  const queueSave = useCallback(
    (patch: Record<string, any>) => {
      setError(null);

      const keys = Object.keys(patch || {});
      keys.forEach((k) => {
        fieldVerRef.current[k] = (fieldVerRef.current[k] || 0) + 1;
      });

      // marca dirty imediato (loader aparece instantâneo)
      setDirty((prev) => {
        const next = { ...prev };
        keys.forEach((k) => (next[k] = true));
        return next;
      });

      // merge patch e agenda flush
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      scheduleFlush();
    },
    [scheduleFlush],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);

      if (inFlightRef.current?.controller) inFlightRef.current.controller.abort();
    };
  }, []);

  // Carrega dados existentes
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

  const onBlurFlush = useCallback(() => {
    // flush imediato quando o usuário sai do campo (mais “perfeito”)
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    flushNow("blur");
  }, [flushNow]);

  const [leaving, setLeaving] = useState<null | "next">(null);

  const goNext = useCallback(async () => {
    if (!canContinue || busy) return;

    setBusy(true);
    setError(null);

    // garante save antes de mudar de página
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    const ok = await flushNow("nav");

    if (!ok) {
      setBusy(false);
      // se falhar, não navega (evita “perder” dado)
      setError((e) => e || "Não foi possível salvar agora. Tente novamente.");
      return;
    }

    setLeaving("next");
    window.setTimeout(() => {
      // ✅ segunda página deve importar o OnboardCreateAccountClient-2.tsx
      router.push("/create-account/step-2");
    }, prefersReducedMotion ? 0 : 240);
  }, [busy, canContinue, flushNow, prefersReducedMotion, router]);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="relative z-10 min-h-screen flex items-start sm:items-center justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+44px)] sm:pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+44px)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={leaving ? "leaving" : "idle"}
            initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
            animate={
              leaving
                ? { opacity: 0, y: 0, x: -18, filter: "blur(10px)" }
                : { opacity: 1, y: 0, x: 0, filter: "blur(0px)" }
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
            <div className="rounded-[28px] bg-white ring-1 ring-black/10 p-7 sm:p-9 md:p-10">
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
                            queueSave({ companyName: v });
                          }}
                          onBlur={onBlurFlush}
                          placeholder="Nome da empresa"
                          className="w-full bg-transparent px-6 py-5 pr-16 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                          autoComplete="organization"
                        />
                        <div className="absolute right-4 inset-y-0 flex items-center justify-center">
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
                            queueSave({ cnpj: v });
                          }}
                          onBlur={onBlurFlush}
                          placeholder="CNPJ (opcional)"
                          className="w-full bg-transparent px-6 py-5 pr-16 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                          inputMode="numeric"
                        />
                        <div className="absolute right-4 inset-y-0 flex items-center justify-center">
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
                            queueSave({ tradeName: v });
                          }}
                          onBlur={onBlurFlush}
                          placeholder="Nome fantasia (opcional)"
                          className="w-full bg-transparent px-6 py-5 pr-16 text-[15px] sm:text-[16px] text-black placeholder-black/45 focus:outline-none"
                        />
                        <div className="absolute right-4 inset-y-0 flex items-center justify-center">
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

                      {/* Site/Instagram opcional (prefix com opacidade diferente) */}
                      <div className="rounded-[18px] bg-[#f3f3f3] ring-1 ring-black/5 overflow-hidden md:col-span-2 relative">
                        <WebsiteOverlayText value={websiteOrInstagram} />
                        <input
                          value={websiteOrInstagram}
                          onChange={(e) => {
                            const v = e.target.value;
                            setWebsiteOrInstagram(v);
                            queueSave({ websiteOrInstagram: v });
                          }}
                          onBlur={onBlurFlush}
                          placeholder="Site ou Instagram (opcional — ajuda no contexto)"
                          className={cx(
                            "w-full bg-transparent px-6 py-5 pr-16 text-[15px] sm:text-[16px]",
                            "text-transparent caret-black placeholder-black/45 focus:outline-none",
                          )}
                          autoComplete="url"
                          inputMode="url"
                        />
                        <div className="absolute right-4 inset-y-0 flex items-center justify-center">
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

                      {/* Segmento (select normal + busca) */}
                      <div className="md:col-span-2">
                        <SearchableSelect
                          value={segment}
                          placeholder="Segmento (selecione uma opção)"
                          groups={segmentPresets}
                          onChange={(opt) => {
                            setSegment(opt);
                            queueSave({ segment: opt });
                          }}
                          loading={isFieldLoading("segment")}
                          prefersReducedMotion={!!prefersReducedMotion}
                          EASE={EASE}
                        />
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
                                  // salva “quase imediato” em clique
                                  flushNow("blur");
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

                    {/* Error (só aparece se falhar repetido) */}
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
                        onClick={goNext}
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

                    {/* (mantido) userId disponível se precisar (sem UI) */}
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

      {/* Toast "Salvo com sucesso" */}
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
