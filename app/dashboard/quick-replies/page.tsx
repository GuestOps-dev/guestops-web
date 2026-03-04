import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { PropertyWorkspaceProvider } from "../PropertyWorkspaceProvider";
import QuickRepliesAdmin from "./QuickRepliesAdmin";

export default async function QuickRepliesPage() {
  const sb = await getSupabaseServerClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberships } = await (sb as any).rpc("my_property_memberships");
  const propertyOptions =
    (memberships ?? []).map((m: any) => ({
      id: m.property_id,
      name: m.property_name,
    })) ?? [];
  const allowedPropertyIds = propertyOptions.map((p: any) => p.id);

  const isAdmin = profile?.role === "admin";
  if (!isAdmin && allowedPropertyIds.length === 0) {
    notFound();
  }

  return (
    <PropertyWorkspaceProvider
      allowedPropertyIds={allowedPropertyIds}
      propertyOptions={propertyOptions}
    >
      <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Quick Replies</h1>
        <p style={{ fontSize: 14, color: "#555", marginBottom: 24 }}>
          Create and manage canned responses per property. Only admins and
          property managers can edit.
        </p>
        <QuickRepliesAdmin />
      </div>
    </PropertyWorkspaceProvider>
  );
}
