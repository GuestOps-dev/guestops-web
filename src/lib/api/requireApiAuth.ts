import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Minimal helper to create a Supabase client from request bearer token (if present)
function supabaseFromBearer(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Minimal helper to create a Supabase client using cookies (server-side)
function supabaseFromCookies() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = cookies();

  // Forward all cookies to Supabase so it can read sb-* auth cookies
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  return createClient(url, anon, {
    global: cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * requireApiAuth(req)
 * Accepts:
 *  - Authorization: Bearer <jwt>
 *  - OR Supabase auth cookies (server-side)
 */
export async function requireApiAuth(req: Request): Promise<{
  supabase: ReturnType<typeof createClient>;
  user: { id: string } | null;
  error: string | null;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return { supabase: createClient("http://invalid", "invalid"), user: null, error: "Missing Supabase env vars" };
  }

  // 1) Try Bearer token first
  const authHeader = req.headers.get("authorization") || "";
  const bearer =
    authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

  try {
    if (bearer) {
      const supabase = supabaseFromBearer(bearer);
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        return { supabase, user: null, error: "Unauthorized" };
      }
      return { supabase, user: { id: data.user.id }, error: null };
    }
  } catch {
    // fall through to cookie auth
  }

  // 2) Fallback to cookie-based auth (server-side)
  const supabase = supabaseFromCookies();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return { supabase, user: null, error: "Missing or invalid Authorization header" };
  }

  return { supabase, user: { id: data.user.id }, error: null };
}