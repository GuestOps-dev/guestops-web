export type MyPropertyMembership = {
  org_id: string;
  property_id: string;
  property_name: string;
  org_role: "org_owner" | "org_admin" | "org_staff" | null;
  property_role: "property_manager" | "concierge" | "ops" | "viewer";
};

export async function fetchMembershipsClient(accessToken: string) {
  const res = await fetch("/api/me/memberships", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch memberships: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { memberships: MyPropertyMembership[] };
  return json.memberships ?? [];
}