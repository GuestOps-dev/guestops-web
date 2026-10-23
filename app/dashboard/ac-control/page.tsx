import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import DashboardNavigation from "../DashboardNavigation";
import AcControlClient from "./AcControlClient";

export default async function AcControlPage() {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await (sb as any).rpc("my_property_memberships");
  const properties = (data ?? []).map((item: any) => ({ id: item.property_id, name: item.property_name, role: item.property_role }));
  return <main style={{ padding: 24, maxWidth: 1040, margin: "0 auto" }}><DashboardNavigation /><h1 style={{ margin: "0 0 6px" }}>AC Control</h1><p style={{ color: "#64748b", margin: "0 0 20px", maxWidth: 800 }}>Prepare selected bedrooms for arrival while preserving the guest&apos;s manual control. This rollout is in simulation mode: it records a durable two-hour exemption, but does not send an AC command until room mappings and the provider safety gate are verified.</p><AcControlClient properties={properties} /></main>;
}
