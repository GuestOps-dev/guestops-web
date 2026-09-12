import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import TasksClient from "./TasksClient";
import DashboardNavigation from "../DashboardNavigation";

export default async function TasksPage() {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await (sb as any).rpc("my_property_memberships");
  const properties = (data ?? []).map((item: any) => ({ id: item.property_id, name: item.property_name }));
  return <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}><DashboardNavigation /><h1 style={{ margin: "0 0 6px" }}>Follow-ups</h1><p style={{ margin: "0 0 20px", color: "#64748b" }}>Every open task across your houses, including internal WhatsApp group preparation. No live group is created here.</p><TasksClient properties={properties} /></main>;
}
