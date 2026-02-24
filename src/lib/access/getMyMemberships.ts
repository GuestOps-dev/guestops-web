import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

export type MyPropertyMembership = {
  org_id: string;
  property_id: string;
  property_name: string;
  org_role: "org_owner" | "org_admin" | "org_staff" | null;
  property_role: "property_manager" | "concierge" | "ops" | "viewer";
};

/**
 * Cookie-session (RLS-bound) helper for Server Components and dashboard data loading.
 * Calls the canonical DB function my_property_memberships().
 */
export async function getMyMemberships(): Promise<MyPropertyMembership[]> {
  const supabase = await getSupabaseRlsServerClient();

  const { data, error } = await supabase.rpc("my_property_memberships");
  if (error) {
    throw new Error(`Failed to load memberships: ${error.message}`);
  }

  return (data ?? []) as MyPropertyMembership[];
}