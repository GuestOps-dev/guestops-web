import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { PropertyWorkspaceProvider } from "../PropertyWorkspaceProvider";
import ExperienceLibraryManager from "./ExperienceLibraryManager";

export default async function ExperiencesPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await (supabase as any).rpc("my_property_memberships");
  const properties = (memberships ?? []).map((item: any) => ({ id: item.property_id, name: item.property_name }));
  return <PropertyWorkspaceProvider allowedPropertyIds={properties.map((property: any) => property.id)} propertyOptions={properties}><ExperienceLibraryManager /></PropertyWorkspaceProvider>;
}
