export async function canManageAc(supabase: any) {
  const { data, error } = await supabase.rpc("my_property_memberships");
  if (error) throw error;
  return (data ?? []).some((membership: any) => ["property_manager"].includes(membership.property_role) || ["org_owner", "org_admin"].includes(membership.org_role));
}

export async function requireAcManager(supabase: any) {
  const { data, error: rpcError } = await supabase.rpc("my_property_memberships");
  if (rpcError) throw rpcError;
  const memberships = data ?? [];
  // Account-wide device discovery writes to ac_devices, whose RLS policy is
  // deliberately limited to account owners/admins. Keep the API rule aligned
  // with that policy rather than offering a button that will fail for a
  // property-only manager.
  if (!memberships.some((membership: any) => ["org_owner", "org_admin"].includes(membership.org_role))) {
    const error: any = new Error("Only owners and admins can manage AC connections and device mappings");
    error.status = 403;
    throw error;
  }
  return memberships;
}
