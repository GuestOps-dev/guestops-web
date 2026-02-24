import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export type ApiAuthContext = {
  token: string;
  supabase: ReturnType<typeof createClient>;
  userId: string;
  role?: string | null;
};

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function requireApiAuth(req: NextRequest): Promise<ApiAuthContext> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (!token) {
    throw new Error("Unauthorized");
  }

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // IMPORTANT:
  // We bind the JWT to all PostgREST calls via global headers.
  // This ensures RLS runs as the authenticated user (no cookies required).
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error("Unauthorized");
  }

  // Optional: pull role for server-side decisions (RLS remains authoritative)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    token,
    supabase,
    userId: data.user.id,
    role: (profile as any)?.role ?? null,
  };
}