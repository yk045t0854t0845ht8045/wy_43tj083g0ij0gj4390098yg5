export type ContactField = "name" | "email" | "phone";

export type ScheduleDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DaySchedule = {
  day: ScheduleDay;
  enabled: boolean;
  start: string;
  end: string;
};

export type InstanceBinding = {
  instanceName: string;
  userId: string;
  onboardingId: string | null;
  companyOnboardingId: string | null;
  companyName: string | null;
};

export type BotSystemRuntimeConfig = {
  id: string;
  userId: string;
  onboardingId: string | null;
  companyOnboardingId: string | null;
  companyName: string | null;
  whatsappConnected: boolean;
  status: string;
  welcomeMessage: string;
  closingMessage: string;
  outOfHoursMessage: string;
  weeklySchedule: DaySchedule[];
  aiCollectName: boolean;
  aiCollectEmail: boolean;
  aiCollectPhone: boolean;
  updatedAt: string;
};

export type ContactRuntimeState = {
  contactKey: string;
  remoteJid: string;
  displayName: string | null;
  collectedName: string | null;
  collectedEmail: string | null;
  collectedPhone: string | null;
  pendingField: ContactField | null;
  lastInboundText: string | null;
  lastInboundAt: string | null;
  lastAutoReplyAt: string | null;
  lastAutoReplyKind: string | null;
  lastCompletedAt: string | null;
  updatedAt: string;
};

export type InstanceRuntimeState = {
  contacts: Record<string, ContactRuntimeState>;
  processedMessageIds: Record<string, string>;
  updatedAt: string;
};

export type SendTextResult = {
  ok: boolean;
  error?: string;
};

export type SendTextFn = (remoteJid: string, text: string) => Promise<SendTextResult>;

export type InboundWhatsAppMessage = {
  instanceName: string;
  remoteJid: string;
  messageId: string;
  text: string;
  pushName?: string | null;
  receivedAt?: string | null;
  sendText: SendTextFn;
};
