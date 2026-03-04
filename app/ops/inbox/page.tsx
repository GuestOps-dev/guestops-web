import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { OpsInboxRow } from "./OpsInboxRow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TabValue = "inbox" | "waiting" | "resolved";

const TAB_STATUS: Record<TabValue, string> = {
  inbox: "awaiting_team",
  waiting: "waiting_guest",
  resolved: "closed",
};

function parseTab(tab: string | string[] | undefined): TabValue {
  const t = Array.isArray(tab) ? tab[0] : tab;
  if (t === "waiting" || t === "resolved") return t;
  return "inbox";
}

export default async function OpsInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = parseTab(params?.tab);
  const status = TAB_STATUS[tab];

  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    notFound();
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, guest_number, channel, status, last_message_at, priority")
    .eq("status", status)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Ops inbox fetch error:", error);
  }

  const list = conversations ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>GuestOpsHQ · Operator Inbox</h1>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 20 }}>
        Conversations by status. Use tabs to switch view.
      </p>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid #eee",
          paddingBottom: 12,
        }}
      >
        <Link
          href="/ops/inbox?tab=inbox"
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: tab === "inbox" ? "#111" : "transparent",
            color: tab === "inbox" ? "#fff" : "#333",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Inbox
        </Link>
        <Link
          href="/ops/inbox?tab=waiting"
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: tab === "waiting" ? "#111" : "transparent",
            color: tab === "waiting" ? "#fff" : "#333",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Waiting on Guest
        </Link>
        <Link
          href="/ops/inbox?tab=resolved"
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: tab === "resolved" ? "#111" : "transparent",
            color: tab === "resolved" ? "#fff" : "#333",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Resolved
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {list.length === 0 ? (
          <div
            style={{
              padding: 24,
              background: "#fafafa",
              borderRadius: 12,
              color: "#666",
              fontSize: 14,
            }}
          >
            No conversations in this tab.
          </div>
        ) : (
          list.map((c) => (
            <OpsInboxRow
              key={c.id}
              id={c.id}
              guest_number={c.guest_number ?? ""}
              channel={c.channel ?? ""}
              status={c.status ?? ""}
              last_message_at={c.last_message_at ?? null}
              priority={c.priority ?? null}
            />
          ))
        )}
      </div>
    </div>
  );
}
