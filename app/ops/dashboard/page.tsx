import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export default async function OpsDashboardPage() {
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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalConversations }, { count: openConversations }, inboundRes, propsRes] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .then((r) => ({ count: r.count ?? 0 })),
      supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("status", "open")
        .then((r) => ({ count: r.count ?? 0 })),
      supabase
        .from("inbound_messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      supabase.from("conversations").select("property_id"),
    ]);

  const inboundLast7Days = inboundRes.count ?? 0;

  const propertyIds =
    propsRes.data?.map((row: { property_id: string | null }) => row.property_id) ?? [];
  const distinctPropertyCount = new Set(propertyIds.filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              GuestOpsHQ · Ops Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              High-level health overview for conversations and inbound activity.
            </p>
          </div>
          <Link
            href="/ops/inbox"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Operator Inbox
          </Link>
        </header>

        <section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total conversations"
              value={totalConversations}
              helper="All conversations you can access"
            />
            <StatCard
              label="Open conversations"
              value={openConversations}
              helper="Currently marked as open"
            />
            <StatCard
              label="Inbound messages (7d)"
              value={inboundLast7Days}
              helper="Received in the last 7 days"
            />
            <StatCard
              label="Active properties"
              value={distinctPropertyCount}
              helper="Properties with at least one conversation"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard(props: { label: string; value: number; helper?: string }) {
  const { label, value, helper } = props;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm shadow-zinc-100/60 sm:px-5 sm:py-5">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-zinc-950">{value}</div>
      {helper ? (
        <div className="mt-1 text-xs text-zinc-500">{helper}</div>
      ) : null}
    </div>
  );
}

