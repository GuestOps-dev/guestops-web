import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

type AuthedContext = {
  supabase: SupabaseClient;
  user: User;
  accessToken: string;
};

function getEnv(name: string): string | null {
  const v = process.env[name];
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

function getSupabaseUrl(): string {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL");
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)");
  return url;
}

function getAnonKey(): string {
  const key =
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
    );
  }
  return key;
}

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * Creates a Supabase client scoped to the request's user JWT.
 *
 * This intentionally uses the anon/publishable key + Authorization header,
 * never the service role key.
 */
export async function requireSupabaseUser(
  req: NextRequest
): Promise<AuthedContext> {
  const token = extractBearerToken(req);
  if (!token) {
    const err = new Error("Missing Authorization: Bearer <token>");
    (err as any).status = 401;
    throw err;
  }

  const supabase = createClient(getSupabaseUrl(), getAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    const err = new Error("Invalid or expired session");
    (err as any).status = 401;
    throw err;
  }

  return { supabase, user: data.user, accessToken: token };
}

export function requirePropertyId(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) {
    const err = new Error("Missing property_id");
    (err as any).status = 400;
    throw err;
  }
  return input.trim();
}

/**
 * Server-side authorization check using canonical SQL:
 *   can_access_property(property_id)
 */
export async function assertCanAccessProperty(
  supabase: SupabaseClient,
  propertyId: string
): Promise<void> {
  const { data, error } = await supabase.rpc("can_access_property", {
    property_id: propertyId,
  });

  if (error) {
    // Avoid leaking DB details; treat as forbidden.
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }

  if (data !== true) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }
}

