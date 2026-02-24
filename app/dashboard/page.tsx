import { redirect } from "next/navigation";
import InboxClient from "./InboxClient";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { PropertyWorkspaceProvider } from "./PropertyWorkspaceProvider";

export default async function DashboardPage() {
  const sb = await getSupabaseServerClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships } = await (sb as any).rpc(
    "my_property_memberships"
  );

  const propertyOptions =
    (memberships ?? []).map((m: any) => ({
      id: m.property_id,
      name: m.property_name,
    })) ?? [];

  const allowedPropertyIds = propertyOptions.map((p: any) => p.id);

  return (
    <PropertyWorkspaceProvider
      allowedPropertyIds={allowedPropertyIds}
      propertyOptions={propertyOptions}
    >
      <InboxClient />
    </PropertyWorkspaceProvider>
  );
}