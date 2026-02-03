// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

function getSupabaseKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseKey(), {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return browserClient;
}
