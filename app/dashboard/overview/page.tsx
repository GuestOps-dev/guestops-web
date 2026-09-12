import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import DashboardNavigation from "../DashboardNavigation";

function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
}

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function needsReply(item: any) {
  if (item.status === "closed" || !item.last_inbound_at) return false;
  return !item.last_outbound_at || new Date(item.last_inbound_at).getTime() > new Date(item.last_outbound_at).getTime();
}

export default async function OperationsOverviewPage() {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await (sb as any).rpc("my_property_memberships");
  // A global admin can also have a direct property membership. Keep the
  // overview one row per house even if an older database function returns both.
  const properties = Array.from(new Map((memberships ?? []).map((item: any) => [item.property_id as string, { id: item.property_id as string, name: item.property_name as string }])).values());
  const propertyIds = properties.map((item: any) => item.id);
  const [conversationsResult, bookingsResult, tasksResult, inboundResult, outboundResult] = await Promise.all([
    (sb as any).from("conversations").select("id, property_id, status, last_inbound_at, last_outbound_at").in("property_id", propertyIds),
    (sb as any).from("bookings").select("property_id, check_in_date, check_out_date").in("property_id", propertyIds),
    (sb as any).from("tasks").select("property_id, status").in("property_id", propertyIds),
    (sb as any).from("inbound_messages").select("conversation_id").gte("created_at", thirtyDaysAgo()).limit(5000),
    (sb as any).from("outbound_messages").select("conversation_id").gte("created_at", thirtyDaysAgo()).limit(5000),
  ]);
  const conversations = conversationsResult.data ?? [];
  const bookings = bookingsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const today = localDateKey();
  const propertyByConversation = new Map<string, string>(conversations.map((item: any) => [item.id as string, item.property_id as string]));
  const inboundByProperty = new Map<string, number>();
  const outboundByProperty = new Map<string, number>();
  for (const item of inboundResult.data ?? []) { const propertyId = propertyByConversation.get((item as any).conversation_id); if (propertyId) inboundByProperty.set(propertyId, (inboundByProperty.get(propertyId) ?? 0) + 1); }
  for (const item of outboundResult.data ?? []) { const propertyId = propertyByConversation.get((item as any).conversation_id); if (propertyId) outboundByProperty.set(propertyId, (outboundByProperty.get(propertyId) ?? 0) + 1); }

  const stats = properties.map((property: any) => {
    const propertyConversations = conversations.filter((item: any) => item.property_id === property.id);
    const propertyBookings = bookings.filter((item: any) => item.property_id === property.id);
    return {
      ...property,
      inbox: propertyConversations.filter((item: any) => item.status === "awaiting_team" || item.status === "active").length,
      replyNeeded: propertyConversations.filter(needsReply).length,
      inHouse: propertyBookings.filter((item: any) => item.check_in_date && item.check_out_date && item.check_in_date <= today && today <= item.check_out_date).length,
      followUps: tasks.filter((item: any) => item.property_id === property.id && item.status === "open").length,
      guestMessages30d: inboundByProperty.get(property.id) ?? 0,
      teamReplies30d: outboundByProperty.get(property.id) ?? 0,
    };
  });
  const total = stats.reduce((sum: any, item: any) => ({ inbox: sum.inbox + item.inbox, replyNeeded: sum.replyNeeded + item.replyNeeded, inHouse: sum.inHouse + item.inHouse, followUps: sum.followUps + item.followUps, guestMessages30d: sum.guestMessages30d + item.guestMessages30d, teamReplies30d: sum.teamReplies30d + item.teamReplies30d }), { inbox: 0, replyNeeded: 0, inHouse: 0, followUps: 0, guestMessages30d: 0, teamReplies30d: 0 });

  return <main style={{ maxWidth: 1060, padding: 24, margin: "0 auto" }}>
    <DashboardNavigation />
    <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>Operations overview</h1>
    <p style={{ margin: "0 0 20px", color: "#64748b" }}>A live snapshot of where the team’s attention is needed today.</p>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12, marginBottom: 22 }}>
      <Metric label="Inbox" value={total.inbox} tone="#1d4ed8" />
      <Metric label="Reply needed" value={total.replyNeeded} tone="#c2410c" />
      <Metric label="Guests in-house" value={total.inHouse} tone="#6d28d9" />
      <Metric label="Open follow-ups" value={total.followUps} tone="#047857" />
      <Metric label="Guest messages (30d)" value={total.guestMessages30d} tone="#0f766e" />
      <Metric label="Team replies (30d)" value={total.teamReplies30d} tone="#7c3aed" />
    </section>
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
      <div style={{ overflowX: "auto" }}><div style={tableHeaderStyle}><span>Property</span><span>Inbox</span><span>Reply needed</span><span>In-house</span><span>Follow-ups</span><span>Guest msgs · 30d</span><span>Team replies · 30d</span></div>
      {stats.map((item: any) => <div key={item.id} style={tableRowStyle}><strong>{item.name}</strong><span>{item.inbox}</span><span style={{ color: item.replyNeeded ? "#c2410c" : "#64748b", fontWeight: item.replyNeeded ? 700 : 400 }}>{item.replyNeeded}</span><span style={{ color: item.inHouse ? "#6d28d9" : "#64748b", fontWeight: item.inHouse ? 700 : 400 }}>{item.inHouse}</span><span style={{ color: item.followUps ? "#047857" : "#64748b", fontWeight: item.followUps ? 700 : 400 }}>{item.followUps}</span><span>{item.guestMessages30d}</span><span>{item.teamReplies30d}</span></div>)}</div>
      {!stats.length ? <p style={{ padding: 16, color: "#64748b", margin: 0 }}>No properties are assigned to this account yet.</p> : null}
    </section>
    <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap" }}><Link href="/dashboard" style={actionStyle}>Open inbox</Link><Link href="/dashboard/tasks" style={actionStyle}>Review follow-ups</Link><Link href="/dashboard/bookings" style={actionStyle}>View new bookings</Link></div>
  </main>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff" }}><div style={{ fontSize: 12, color: "#64748b" }}>{label}</div><div style={{ fontSize: 28, fontWeight: 700, color: tone, marginTop: 4 }}>{value}</div></div>;
}

const actionStyle = { padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, color: "#334155", fontSize: 13, textDecoration: "none", background: "#fff" };
const tableRowStyle = { display: "grid", gridTemplateColumns: "minmax(170px, 1.7fr) repeat(6, minmax(92px, 1fr))", gap: 8, minWidth: 840, padding: "12px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center", fontSize: 13 };
const tableHeaderStyle = { ...tableRowStyle, background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 12, color: "#64748b", fontWeight: 600 };
