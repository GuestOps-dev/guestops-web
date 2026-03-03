import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type ApiAuthResult = {
  supabase: any; // keep broad to avoid TS generic mismatches across supabase-js versions
  user: { id: string } | null;
  error: string | null;
};

function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { url, anon };
}

function supabaseFromBearer(token: string) {
  const { url, anon } = getPublicEnv();
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function supabaseFromCookies() {
  const { url, anon } = getPublicEnv();

  // In your Next.js version, cookies() returns a Promise
  const cookieStore = await cookies();
  const all = cookieStore.getAll?.() ?? [];

  const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join("; ");

  return createClient(url, anon, {
    global: cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * requireApiAuth(req)
 * Accepts:
 *  - Authorization: Bearer <jwt>
 *  - OR Supabase auth cookies (server-side)
 */
export async function requireApiAuth(req: Request): Promise<ApiAuthResult> {
  // 1) Try Bearer first (current behavior)
  const authHeader = req.headers.get("authorization") || "";
  const bearer =
    authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

  if (bearer) {
    const supabase = supabaseFromBearer(bearer);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return { supabase, user: null, error: "Unauthorized" };
    }

    return { supabase, user: { id: data.user.id }, error: null };
  }

  // 2) Fallback: cookies (for same-origin calls from logged-in app)
  try {
    const supabase = await supabaseFromCookies();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return { supabase, user: null, error: "Missing or invalid Authorization header" };
    }

    return { supabase, user: { id: data.user.id }, error: null };
  } catch (e: any) {
    return { supabase: null, user: null, error: e?.message ?? "Unauthorized" };
  }
}