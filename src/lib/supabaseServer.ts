import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  const url = process.env.SUPABASE_URL!;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, secret, { auth: { persistSession: false } });
}