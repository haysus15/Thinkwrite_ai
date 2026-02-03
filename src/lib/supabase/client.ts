// src/lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

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

let browserClient: ReturnType<typeof createClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createClient(getSupabaseUrl(), getSupabaseKey(), {
    auth: {
      // Prevent noisy refresh attempts when offline/DNS fails.
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });

  return browserClient;
}
