// app/(dashboard)/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { readSessionFromCookieHeader } from "@/app/api/wz_AuthLogin/_session";
import { supabaseAdmin } from "@/app/api/wz_AuthLogin/_supabase";
import DashboardShell from "./_components/dashboard-shell";
import LoadingBase from "./_components/LoadingBase";
import {
  createEmptyOnboardingData,
  normalizeOnboardingData,
  type OnboardingData,
} from "./_components/Onboarding/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildLoginUrl(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();

  // local/dev
  if (host.endsWith(".localhost") || host === "localhost") {
    return "http://login.localhost:3000/";
  }

  // prod
  if (host.endsWith(".wyzer.com.br")) {
    return "https://login.wyzer.com.br/";
  }

  // fallback
  return "https://login.wyzer.com.br/";
}

function pickHostHeader(h: { get(name: string): string | null }) {
  return h.get("x-forwarded-host") || h.get("host");
}

function isLocalDevHost(hostHeader: string | null) {
  const host = String(hostHeader || "").split(":")[0].toLowerCase();
  return host.endsWith(".localhost") || host === "localhost";
}

function pickFirstName(fullName?: string | null) {
  const clean = String(fullName || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;

  const first = clean.split(" ")[0] || "";
  return first ? first.slice(0, 24) : null;
}

async function getSidebarFirstName(params: {
  userId?: string | null;
  email?: string | null;
}) {
  const userId = String(params.userId || "").trim();
  const email = String(params.email || "")
    .trim()
    .toLowerCase();

  if (!userId && !email) return null;

  try {
    const sb = supabaseAdmin();

    // 1) Igual ao fluxo do e-mail da sessão: prioriza lookup por email (case-insensitive).
    if (email) {
      const { data, error } = await sb
        .from("wz_users")
        .select("full_name")
        .ilike("email", email)
        .limit(5);

      if (!error) {
        for (const row of data || []) {
          const firstByEmail = pickFirstName((row as { full_name?: string | null }).full_name);
          if (firstByEmail) return firstByEmail;
        }
      }
    }

    // 2) Fallback para sessões antigas ou migrações: auth_user_id.
    if (userId) {
      const { data, error } = await sb
        .from("wz_users")
        .select("full_name")
        .eq("auth_user_id", userId)
        .limit(5);

      if (!error) {
        for (const row of data || []) {
          const firstByAuthId = pickFirstName((row as { full_name?: string | null }).full_name);
          if (firstByAuthId) return firstByAuthId;
        }
      }
    }

    // 3) Fallback para bases onde wz_users usa user_id.
    if (userId) {
      const { data, error } = await sb
        .from("wz_users")
        .select("full_name")
        .eq("user_id", userId)
        .limit(5);

      if (!error) {
        for (const row of data || []) {
          const firstByUserId = pickFirstName((row as { full_name?: string | null }).full_name);
          if (firstByUserId) return firstByUserId;
        }
      }
    }

    // 4) Fallback final: id da tabela wz_users.
    if (userId) {
      const { data, error } = await sb
        .from("wz_users")
        .select("full_name")
        .eq("id", userId)
        .limit(5);

      if (!error) {
        for (const row of data || []) {
          const firstById = pickFirstName((row as { full_name?: string | null }).full_name);
          if (firstById) return firstById;
        }
      }
    }
  } catch (error) {
    console.error("[dashboard] failed to load wz_users full_name:", error);
  }

  return null;
}

async function getInitialOnboardingData(params: {
  userId?: string | null;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) return createEmptyOnboardingData();

  const sb = supabaseAdmin();

  const fullSelect = [
    "company_name",
    "cnpj",
    "trade_name",
    "website_or_instagram",
    "segment",
    "company_size",
    "main_use",
    "priority_now",
    "has_supervisor",
    "service_hours",
    "target_response_time",
    "languages",
    "ai_auto_mode",
    "ai_handoff_human_request",
    "ai_handoff_anger_urgency",
    "ai_handoff_after_messages",
    "ai_handoff_price_payment",
    "brand_tone",
    "msg_signature",
    "ai_catalog_summary",
    "ai_knowledge_links",
    "ai_guardrails",
    "welcome_confirmed",
    "team_agents_count",
    "operation_days",
    "operation_start_time",
    "operation_end_time",
    "whatsapp_connected",
    "whatsapp_connected_at",
    "updated_at",
  ].join(",");

  const baseSelect = [
    "company_name",
    "cnpj",
    "trade_name",
    "website_or_instagram",
    "segment",
    "company_size",
    "main_use",
    "priority_now",
    "has_supervisor",
    "service_hours",
    "target_response_time",
    "languages",
    "ai_auto_mode",
    "ai_handoff_human_request",
    "ai_handoff_anger_urgency",
    "ai_handoff_after_messages",
    "ai_handoff_price_payment",
    "brand_tone",
    "msg_signature",
    "ai_catalog_summary",
    "ai_knowledge_links",
    "ai_guardrails",
    "updated_at",
  ].join(",");

  try {
    const { data, error } = await sb
      .from("wz_onboarding")
      .select(fullSelect)
      .eq("user_id", userId)
      .maybeSingle();

    if (!error) {
      const row = (data || {}) as Record<string, unknown>;
      return normalizeOnboardingData({
        companyName: row.company_name as string | null,
        cnpj: row.cnpj as string | null,
        tradeName: row.trade_name as string | null,
        websiteOrInstagram: row.website_or_instagram as string | null,
        segment: row.segment as string | null,
        companySize: row.company_size as OnboardingData["companySize"],
        mainUse: row.main_use as string | null,
        priorityNow: row.priority_now as string | null,
        hasSupervisor: row.has_supervisor as boolean | null,
        serviceHours: row.service_hours as string | null,
        targetResponseTime: row.target_response_time as string | null,
        languages: row.languages as string[] | null,
        aiAutoMode: row.ai_auto_mode as OnboardingData["aiAutoMode"],
        handoffHumanRequest: row.ai_handoff_human_request as boolean | null,
        handoffAngerUrgency: row.ai_handoff_anger_urgency as boolean | null,
        handoffAfterMessages: row.ai_handoff_after_messages as number | null,
        handoffPricePayment: row.ai_handoff_price_payment as boolean | null,
        brandTone: row.brand_tone as OnboardingData["brandTone"],
        msgSignature: row.msg_signature as string | null,
        aiCatalogSummary: row.ai_catalog_summary as string | null,
        aiKnowledgeLinks: row.ai_knowledge_links as string | null,
        aiGuardrails: row.ai_guardrails as string | null,
        welcomeConfirmed: row.welcome_confirmed === true,
        teamAgentsCount: row.team_agents_count as number | null,
        operationDays: row.operation_days as string[] | null,
        operationStartTime: row.operation_start_time as string | null,
        operationEndTime: row.operation_end_time as string | null,
        whatsappConnected: row.whatsapp_connected === true,
        whatsappConnectedAt: row.whatsapp_connected_at as string | null,
        completed: false,
        updatedAt: row.updated_at as string | null,
      });
    }
  } catch (error) {
    console.error("[dashboard] failed to load onboarding with full schema:", error);
  }

  try {
    const { data, error } = await sb
      .from("wz_onboarding")
      .select(baseSelect)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[dashboard] failed to load onboarding:", error.message);
      return createEmptyOnboardingData();
    }

    const row = (data || {}) as Record<string, unknown>;
    return normalizeOnboardingData({
      companyName: row.company_name as string | null,
      cnpj: row.cnpj as string | null,
      tradeName: row.trade_name as string | null,
      websiteOrInstagram: row.website_or_instagram as string | null,
      segment: row.segment as string | null,
      companySize: row.company_size as OnboardingData["companySize"],
      mainUse: row.main_use as string | null,
      priorityNow: row.priority_now as string | null,
      hasSupervisor: row.has_supervisor as boolean | null,
      serviceHours: row.service_hours as string | null,
      targetResponseTime: row.target_response_time as string | null,
      languages: row.languages as string[] | null,
      aiAutoMode: row.ai_auto_mode as OnboardingData["aiAutoMode"],
      handoffHumanRequest: row.ai_handoff_human_request as boolean | null,
      handoffAngerUrgency: row.ai_handoff_anger_urgency as boolean | null,
      handoffAfterMessages: row.ai_handoff_after_messages as number | null,
      handoffPricePayment: row.ai_handoff_price_payment as boolean | null,
      brandTone: row.brand_tone as OnboardingData["brandTone"],
      msgSignature: row.msg_signature as string | null,
      aiCatalogSummary: row.ai_catalog_summary as string | null,
      aiKnowledgeLinks: row.ai_knowledge_links as string | null,
      aiGuardrails: row.ai_guardrails as string | null,
      completed: false,
      updatedAt: row.updated_at as string | null,
    });
  } catch (error) {
    console.error("[dashboard] fallback onboarding load failed:", error);
    return createEmptyOnboardingData();
  }
}

export default async function DashboardHomePage() {
  const h = await headers();

  const headerLike: { get(name: string): string | null } = {
    get: (name: string) => h.get(name),
  };
  const hostHeader = pickHostHeader(headerLike);
  const shouldBypassAuth = isLocalDevHost(hostHeader);

  const cookieHeader = h.get("cookie");
  const session = readSessionFromCookieHeader(cookieHeader, headerLike);
  const sidebarEmail = session?.email || (shouldBypassAuth ? "local@localhost" : "");
  let sidebarNickname = shouldBypassAuth ? "Local User" : "Usuario";

  if (session) {
    const firstNameFromSession = pickFirstName(session.fullName);
    if (firstNameFromSession) {
      sidebarNickname = firstNameFromSession;
    } else {
      const dbFirstName = await getSidebarFirstName({
        userId: session.userId,
        email: session.email,
      });
      if (dbFirstName) sidebarNickname = dbFirstName;
    }
  }
  const initialOnboarding = await getInitialOnboardingData({
    userId: session?.userId,
  });

  const loginUrl = buildLoginUrl(hostHeader);

  if (!shouldBypassAuth && !session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Link href={loginUrl}>Ir para Login</Link>
      </div>
    );
  }

  return (
    <>
      <LoadingBase />
      <DashboardShell
        userNickname={sidebarNickname}
        userEmail={sidebarEmail}
        initialOnboarding={initialOnboarding}
      />
    </>
  );
}
