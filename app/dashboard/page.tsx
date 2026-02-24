import { redirect } from "next/navigation";
import InboxClient from "./InboxClient";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ConversationRow = {
  id: string;
  property_id: string;
  guest_number: string;
  service_number: string | null;
  channel: string;
  provider: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  updated_at: string;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_read_at: string | null;
  properties?: { id: string; name: string } | null;
};

type PropertyOption = { id: string; name: string };

export default async function DashboardPage() {
  const sb = await getSupabaseServerClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  // Canonical: memberships (RLS truth)
  const { data: memberships, error: membershipsErr } = await (sb as any).rpc(
    "my_property_memberships"
  );

  if (membershipsErr) {
    console.error("Dashboard memberships RPC error:", membershipsErr);
  }

  const propertyOptions: PropertyOption[] = (memberships ?? []).map((m: any) => ({
    id: m.property_id,
    name: m.property_name,
  }));

  const allowedPropertyIds = propertyOptions.map((p) => p.id);
  const nameById = new Map(propertyOptions.map((p) => [p.id, p.name]));

  // Load conversations (RLS enforced). No join.
  const { data: conversations, error } = await (sb as any)
    .from("conversations")
    .select(
      `
      id,
      property_id,
      guest_number,
      service_number,
      channel,
      provider,
      status,
      priority,
      assigned_to,
      updated_at,
      last_message_at,
      last_inbound_at,
      last_outbound_at,
      last_read_at
    `
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) console.error("Dashboard conversations load error:", error);

  // Defensive: ensure we only send conversations from allowed properties
  const raw: any[] = (conversations as any) ?? [];
  const filtered = allowedPropertyIds.length
    ? raw.filter((c) => allowedPropertyIds.includes(c.property_id))
    : raw;

  const initial: ConversationRow[] = filtered.map((c: any) => ({
    ...c,
    properties: { id: c.property_id, name: nameById.get(c.property_id) ?? c.property_id },
  }));

  return (
    <InboxClient
      initial={initial}
      propertyOptions={propertyOptions}
      allowedPropertyIds={allowedPropertyIds}
    />
  );
}