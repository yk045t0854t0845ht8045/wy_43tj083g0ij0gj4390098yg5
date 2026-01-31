import { createClient } from "@supabase/supabase-js";

function must(name: string, value?: string) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function supabaseAdmin() {
  const url = must(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const service = must(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return createClient(url, service, {
    auth: { persistSession: false },
  });
}

export function supabaseAnon() {
  const url = must(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const anon = must(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}
