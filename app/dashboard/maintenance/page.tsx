import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import DashboardNavigation from "../DashboardNavigation";
import MaintenanceClient from "./MaintenanceClient";

export default async function MaintenancePage() {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await (sb as any).rpc("my_property_memberships");
  const properties = (data ?? []).map((item: any) => ({ id: item.property_id, name: item.property_name }));
  return <main style={{ padding: 24, maxWidth: 1040, margin: "0 auto" }}><DashboardNavigation /><h1 style={{ margin: "0 0 6px" }}>Maintenance</h1><p style={{ margin: "0 0 20px", color: "#64748b", maxWidth: 760 }}>Internal house issues detected by the team or recommended by AI. Keep the original conversation as context, track recurring problems, and never send a guest or vendor message from here.</p><MaintenanceClient properties={properties} /></main>;
}
