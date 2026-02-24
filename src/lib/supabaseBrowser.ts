import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  // IMPORTANT: createBrowserClient sets auth cookies that middleware can read
  browserClient = createBrowserClient(url, anon);

  return browserClient;
}