import type { InstanceBinding } from "./types";

declare global {
  var __wzWhatsAppInstanceBindings: Map<string, InstanceBinding> | undefined;
}

const bindingRegistry =
  globalThis.__wzWhatsAppInstanceBindings ||
  (globalThis.__wzWhatsAppInstanceBindings = new Map<string, InstanceBinding>());

export function registerWhatsAppInstanceBinding(binding: InstanceBinding) {
  const instanceName = String(binding.instanceName || "").trim();
  if (!instanceName) return;

  bindingRegistry.set(instanceName, {
    instanceName,
    userId: String(binding.userId || "").trim(),
    onboardingId: String(binding.onboardingId || "").trim() || null,
    companyOnboardingId: String(binding.companyOnboardingId || "").trim() || null,
    companyName: String(binding.companyName || "").trim() || null,
  });
}

export function getWhatsAppInstanceBinding(instanceName: string) {
  const clean = String(instanceName || "").trim();
  if (!clean) return null;
  return bindingRegistry.get(clean) || null;
}
