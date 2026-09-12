import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { PropertyWorkspaceProvider } from "../PropertyWorkspaceProvider";
import PropertyGuideManager from "./PropertyGuideManager";
import KnownContactsManager from "./KnownContactsManager";
import SleepingArrangementsManager from "./SleepingArrangementsManager";

export default async function PropertiesPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await (supabase as any).rpc("my_property_memberships");
  const propertyOptions = (memberships ?? []).map((membership: any) => ({
    id: membership.property_id,
    name: membership.property_name,
  }));

  return (
    <PropertyWorkspaceProvider
      allowedPropertyIds={propertyOptions.map((property: any) => property.id)}
      propertyOptions={propertyOptions}
    >
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <Link href="/dashboard" style={{ fontSize: 14 }}>← Inbox</Link>
        <h1 style={{ fontSize: 24, margin: "16px 0 8px" }}>Property Guide</h1>
        <p style={{ fontSize: 14, color: "#555", margin: "0 0 24px" }}>
          Keep guest-facing details and private operating knowledge current for each property.
        </p>
        <PropertyGuideManager />
        <SleepingArrangementsManager />
        <KnownContactsManager />
      </main>
    </PropertyWorkspaceProvider>
  );
}
