import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import PropertyQuickRepliesManager from "./PropertyQuickRepliesManager";

export default async function PropertyQuickRepliesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  if (!propertyId?.trim()) redirect("/dashboard");

  const sb = await getSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (sb as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const { data: membership } = await (sb as any)
    .from("property_users")
    .select("property_role")
    .eq("property_id", propertyId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";
  const isManagerOrOps =
    membership?.property_role === "property_manager" ||
    membership?.property_role === "ops";
  if (!isAdmin && !isManagerOrOps) notFound();

  const { data: propertyRow } = await (sb as any)
    .from("properties")
    .select("name")
    .eq("id", propertyId)
    .maybeSingle();
  const propertyName = (propertyRow as any)?.name ?? "Property";

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <Link
        href="/dashboard"
        style={{ fontSize: 14, color: "#555", textDecoration: "none" }}
      >
        ← Back to Dashboard
      </Link>
      <h1 style={{ fontSize: 24, marginTop: 16, marginBottom: 4 }}>
        Quick Replies
      </h1>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 24 }}>
        {propertyName}
      </p>
      <PropertyQuickRepliesManager propertyId={propertyId} propertyName={propertyName} />
    </main>
  );
}
