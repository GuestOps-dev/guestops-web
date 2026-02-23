import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  _client = createClient(url, secret, { auth: { persistSession: false } });
  return _client;
}

// Backwards-compatible export (so older code won't break)
export function supabaseServer(): SupabaseClient {
  return getSupabaseServerClient();
}