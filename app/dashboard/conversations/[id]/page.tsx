import Link from "next/link";
import { redirect } from "next/navigation";
import MarkRead from "./MarkRead";
import LiveThread from "./LiveThread";
import SendMessageBox from "./SendMessageBox";
import { getSupabaseServerClient } from "@/src/lib/supabaseServer";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversationId = (id || "").trim();

  if (!conversationId) redirect("/dashboard");

  const supabase = await getSupabaseServerClient();

  // Ensure user is logged in (middleware should already enforce, but keep server-safe)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Load conversation to derive property_id (RLS enforced)
  const { data: convo, error } = await supabase
    .from("conversations")
    .select("id, property_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    // If you want, you can render a nicer error page — but keep it deterministic
    console.error("Conversation page load error:", error);
    redirect("/dashboard");
  }

  if (!convo) {
    // Not found or not authorized by RLS
    redirect("/dashboard");
  }

  const propertyId = (convo as any).property_id as string;

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* Marks the conversation read via bearer-auth API */}
      <MarkRead conversationId={conversationId} propertyId={propertyId} />

      <Link href="/dashboard">← Back</Link>

      <div style={{ marginTop: 12 }}>
        <LiveThread conversationId={conversationId} />
      </div>

      <div style={{ marginTop: 12 }}>
        <SendMessageBox conversationId={conversationId} propertyId={propertyId} />
      </div>
    </main>
  );
}