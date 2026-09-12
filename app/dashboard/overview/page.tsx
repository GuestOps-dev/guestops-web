import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
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
  const properties = (memberships ?? []).map((item: any) => ({ id: item.property_id as string, name: item.property_name as string }));
  const propertyIds = properties.map((item: any) => item.id);
  const [conversationsResult, bookingsResult, tasksResult] = await Promise.all([
    (sb as any).from("conversations").select("property_id, status, last_inbound_at, last_outbound_at").in("property_id", propertyIds),
    (sb as any).from("bookings").select("property_id, check_in_date, check_out_date").in("property_id", propertyIds),
    (sb as any).from("tasks").select("property_id, status").in("property_id", propertyIds),
  ]);
  const conversations = conversationsResult.data ?? [];
  const bookings = bookingsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const today = localDateKey();

  const stats = properties.map((property: any) => {
    const propertyConversations = conversations.filter((item: any) => item.property_id === property.id);
    const propertyBookings = bookings.filter((item: any) => item.property_id === property.id);
    return {
      ...property,
      inbox: propertyConversations.filter((item: any) => item.status === "awaiting_team" || item.status === "active").length,
      replyNeeded: propertyConversations.filter(needsReply).length,
      inHouse: propertyBookings.filter((item: any) => item.check_in_date && item.check_out_date && item.check_in_date <= today && today <= item.check_out_date).length,
      followUps: tasks.filter((item: any) => item.property_id === property.id && item.status === "open").length,
    };
  });
  const total = stats.reduce((sum: any, item: any) => ({ inbox: sum.inbox + item.inbox, replyNeeded: sum.replyNeeded + item.replyNeeded, inHouse: sum.inHouse + item.inHouse, followUps: sum.followUps + item.followUps }), { inbox: 0, replyNeeded: 0, inHouse: 0, followUps: 0 });

  return <main style={{ maxWidth: 1060, padding: 24, margin: "0 auto" }}>
    <Link href="/dashboard" style={{ fontSize: 14, color: "#475569", textDecoration: "none" }}>← Inbox</Link>
    <h1 style={{ fontSize: 26, margin: "16px 0 6px" }}>Operations overview</h1>
    <p style={{ margin: "0 0 20px", color: "#64748b" }}>A live snapshot of where the team’s attention is needed today.</p>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12, marginBottom: 22 }}>
      <Metric label="Inbox" value={total.inbox} tone="#1d4ed8" />
      <Metric label="Reply needed" value={total.replyNeeded} tone="#c2410c" />
      <Metric label="Guests in-house" value={total.inHouse} tone="#6d28d9" />
      <Metric label="Open follow-ups" value={total.followUps} tone="#047857" />
    </section>
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.6fr) repeat(4, minmax(92px, 1fr))", gap: 8, padding: "11px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 12, color: "#64748b", fontWeight: 600 }}><span>Property</span><span>Inbox</span><span>Reply needed</span><span>In-house</span><span>Follow-ups</span></div>
      {stats.map((item: any) => <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.6fr) repeat(4, minmax(92px, 1fr))", gap: 8, padding: "14px", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}><strong>{item.name}</strong><span>{item.inbox}</span><span style={{ color: item.replyNeeded ? "#c2410c" : "#64748b", fontWeight: item.replyNeeded ? 700 : 400 }}>{item.replyNeeded}</span><span style={{ color: item.inHouse ? "#6d28d9" : "#64748b", fontWeight: item.inHouse ? 700 : 400 }}>{item.inHouse}</span><span style={{ color: item.followUps ? "#047857" : "#64748b", fontWeight: item.followUps ? 700 : 400 }}>{item.followUps}</span></div>)}
      {!stats.length ? <p style={{ padding: 16, color: "#64748b", margin: 0 }}>No properties are assigned to this account yet.</p> : null}
    </section>
    <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap" }}><Link href="/dashboard" style={actionStyle}>Open inbox</Link><Link href="/dashboard/tasks" style={actionStyle}>Review follow-ups</Link><Link href="/dashboard/bookings" style={actionStyle}>View new bookings</Link></div>
  </main>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff" }}><div style={{ fontSize: 12, color: "#64748b" }}>{label}</div><div style={{ fontSize: 28, fontWeight: 700, color: tone, marginTop: 4 }}>{value}</div></div>;
}

const actionStyle = { padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, color: "#334155", fontSize: 13, textDecoration: "none", background: "#fff" };
