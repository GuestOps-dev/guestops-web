import { redirect } from "next/navigation";
import InboxClient from "./InboxClient";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export default async function DashboardPage() {
  const sb = await getSupabaseServerClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

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
      last_read_at,
      properties:property_id ( id, name )
    `
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Dashboard conversations load error:", error);
  }

  return <InboxClient initial={(conversations as any) ?? []} />;
}