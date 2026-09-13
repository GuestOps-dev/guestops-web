import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import TeamManager from "./TeamManager";

export default async function TeamPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await (supabase as any).rpc("my_property_memberships");
  const properties = Array.from(new Map((data ?? []).map((item: any) => [item.property_id, { id: item.property_id, name: item.property_name, org_role: item.org_role }])).values()) as Array<{ id: string; name: string; org_role: string | null }>;
  return <TeamManager properties={properties} />;
}
