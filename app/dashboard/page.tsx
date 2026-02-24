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

export default async function DashboardPage() {
  const sb = await getSupabaseServerClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  // 1) Load accessible properties (RLS enforced)
  const { data: propsData, error: propsErr } = await (sb as any)
    .from("properties")
    .select("id, name")
    .eq("active", true)
    .order("name", { ascending: true });

  if (propsErr) console.error("Dashboard properties load error:", propsErr);

  const propsList: Array<{ id: string; name: string }> = (propsData as any) ?? [];
  const nameById = new Map(propsList.map((p) => [p.id, p.name]));

  // 2) Load conversations WITHOUT join
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

  const initial: ConversationRow[] = ((conversations as any) ?? []).map((c: any) => ({
    ...c,
    properties: { id: c.property_id, name: nameById.get(c.property_id) ?? c.property_id },
  }));

  return <InboxClient initial={initial} />;
}