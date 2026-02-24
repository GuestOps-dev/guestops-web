import Link from "next/link";
import { redirect } from "next/navigation";
import MarkRead from "./MarkRead";
import LiveThread from "./LiveThread";
import SendMessageBox from "./SendMessageBox";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversationId = (id || "").trim();

  if (!conversationId) redirect("/dashboard");

  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: convo, error } = await (supabase as any)
    .from("conversations")
    .select("id, property_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    console.error("Conversation page load error:", error);
    redirect("/dashboard");
  }

  if (!convo) {
    redirect("/dashboard");
  }

  const propertyId = (convo as any).property_id as string;

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
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