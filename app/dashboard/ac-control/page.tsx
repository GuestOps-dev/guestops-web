import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import DashboardNavigation from "../DashboardNavigation";
import AcControlClient from "./AcControlClient";
import ThermostatBoard from "./ThermostatBoard";

export default async function AcControlPage() {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await (sb as any).rpc("my_property_memberships");
  const memberships = data ?? [];
  const properties = memberships.map((item: any) => ({ id: item.property_id, name: item.property_name, role: item.property_role }));
  const canManageConnections = memberships.some((item: any) => ["org_owner", "org_admin"].includes(item.org_role));
  return <main className="ac-control-page" style={{ padding: 24, maxWidth: 1040, margin: "0 auto" }}><DashboardNavigation /><h1 style={{ margin: "0 0 10px", fontSize: 20 }}>AC Control</h1><ThermostatBoard /><AcControlClient properties={properties} canManageConnections={canManageConnections} /></main>;
}
