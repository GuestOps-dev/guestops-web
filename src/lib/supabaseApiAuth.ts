import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export type ApiAuthContext = {
  token: string;
  supabase: any;
  userId: string;
  role?: string | null;
};

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getBearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
  if (!token) throw new Error("Unauthorized");
  return token;
}

/**
 * Canonical: Bearer token -> RLS-bound Supabase client
 */
export async function requireApiAuth(req: NextRequest): Promise<ApiAuthContext> {
  const token = getBearerToken(req);

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // Bind JWT to all PostgREST calls. RLS evaluates as this user.
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
  }) as any;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error("Unauthorized");

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

/* =========================================================
   Legacy compatibility exports (do not remove yet)
   ========================================================= */

export async function requireSupabaseUser(req: NextRequest) {
  const { supabase, userId, role, token } = await requireApiAuth(req);
  return { supabase, user: { id: userId }, role, token };
}

export function requirePropertyId(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) {
    const err: any = new Error("Missing property_id");
    err.status = 400;
    throw err;
  }
  const s = v.trim();
  const ok =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    );
  if (!ok) {
    const err: any = new Error("Invalid property_id");
    err.status = 400;
    throw err;
  }
  return s;
}

export async function assertCanAccessProperty(supabase: any, propertyId: string) {
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle();

  if (error || !data) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}