import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * RLS-bound server client for Server Components.
 * IMPORTANT: In Server Components, cookies are effectively read-only.
 * So set/remove must be no-ops to avoid runtime issues.
 */
export async function getSupabaseRlsServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      // no-ops in Server Components (prevents Next 16 cookie write errors)
      set() {},
      remove() {},
    },
  });
}

/**
 * Service role client (bypasses RLS).
 * ONLY for trusted server-to-server operations (Twilio webhooks, cron/jobs).
 */
let _service: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (_service) return _service;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  _service = createClient(url, secret, { auth: { persistSession: false } });
  return _service;
}

/**
 * Backwards-compatible export:
 * Return RLS-bound client (safe for dashboard/server pages).
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  return getSupabaseRlsServerClient();
}

// Backwards-compatible alias
export async function supabaseServer(): Promise<SupabaseClient> {
  return getSupabaseRlsServerClient();
}