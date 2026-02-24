import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type RequireApiAuthResult = {
  supabase: SupabaseClient;
  user: User | null;
  accessToken: string | null;
  error: string | null;
};

/**
 * Bearer-token auth for API routes.
 *
 * - Reads Authorization: Bearer <access_token>
 * - Creates a Supabase client bound to that JWT so RLS enforces property isolation
 * - Validates token via supabase.auth.getUser()
 *
 * NOTE:
 * - Uses ANON key (NOT service role) to preserve RLS.
 * - Service role is for webhooks only (elsewhere).
 */
export async function requireApiAuth(req: Request): Promise<RequireApiAuthResult> {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  const token = parseBearerToken(authHeader);
  if (!token) {
    return {
      supabase: makeRlsClient(null),
      user: null,
      accessToken: null,
      error: "Missing or invalid Authorization header",
    };
  }

  const supabase = makeRlsClient(token);

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return {
      supabase,
      user: null,
      accessToken: token,
      error: error?.message ?? "Unauthorized",
    };
  }

  return {
    supabase,
    user: data.user,
    accessToken: token,
    error: null,
  };
}

function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function makeRlsClient(accessToken: string | null): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";

  if (!url || !anonKey) {
    // Throwing here makes build-time failures obvious in logs if env is misconfigured.
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY)"
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}