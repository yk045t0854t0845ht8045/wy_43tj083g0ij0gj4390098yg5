function sanitizeInstanceToken(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveLocalInstancePrefix() {
  const configured = String(process.env.WHATSAPP_INSTANCE_PREFIX || "wyzer").trim().toLowerCase();
  const sanitized = configured.replace(/[^a-z0-9-_]/g, "");
  return sanitized || "wyzer";
}

export function buildWhatsAppInstanceName(userId: string, scopeId?: string | null) {
  const prefix = resolveLocalInstancePrefix();
  const userToken = sanitizeInstanceToken(userId) || "unknown";
  const scopeToken = sanitizeInstanceToken(String(scopeId || ""));
  const scoped = scopeToken ? `${prefix}-${userToken}-${scopeToken}` : `${prefix}-${userToken}`;
  return scoped.slice(0, 64);
}
