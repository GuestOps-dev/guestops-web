"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type ConversationRow = {
  id: string;
  property_id: string;
  properties?: { id: string; name: string } | null;

  guest_number: string;
  service_number: string | null;
  channel: string;
  provider: string;
  status: string;
  priority: string;
  assigned_to: string | null;

  updated_at: string;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_read_at: string | null;
};

type Props = {
  initial: ConversationRow[];
};

type StatusFilter = "open" | "closed" | "all";

function isUnread(c: ConversationRow) {
  if (!c.last_inbound_at) return false;
  if (!c.last_read_at) return true;
  return (
    new Date(c.last_inbound_at).getTime() >
    new Date(c.last_read_at).getTime()
  );
}

function sortByUpdatedDesc(a: ConversationRow, b: ConversationRow) {
  return (
    new Date(b.updated_at).getTime() -
    new Date(a.updated_at).getTime()
  );
}

export default function InboxClient({ initial }: Props) {
  const [rows, setRows] = useState<ConversationRow[]>(
    () => [...(initial || [])].sort(sortByUpdatedDesc)
  );

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [propertyId, setPropertyId] = useState<string>("all");
  const [properties, setProperties] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const sb = useMemo(() => getSupabaseBrowserClient(), []);
  const unreadCount = useMemo(
    () => rows.filter(isUnread).length,
    [rows]
  );

  async function getAccessToken(): Promise<string> {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error("No Supabase session");
    }
    return data.session.access_token;
  }

  // Load properties via secure API
  useEffect(() => {
    let cancelled = false;

    async function loadProperties() {
      try {
        const token = await getAccessToken();

        const res = await fetch("/api/properties", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Failed to load properties");

        const data = await res.json();
        if (!cancelled) setProperties(data || []);
      } catch (err) {
        console.error("Failed to load properties:", err);
      }
    }

    loadProperties();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch conversations via secure API
  useEffect(() => {
    let cancelled = false;

    async function refetch() {
      setLoading(true);

      try {
        const token = await getAccessToken();

        const params = new URLSearchParams();
        if (status !== "all") params.set("status", status);
        if (propertyId !== "all") params.set("propertyId", propertyId);

        const res = await fetch(
          `/api/conversations?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) throw new Error("Failed to load conversations");

        const data = await res.json();

        if (!cancelled) {
          setRows((data || []).sort(sortByUpdatedDesc));
        }
      } catch (err) {
        console.error("Inbox refetch error:", err);
      }

      setLoading(false);
    }

    refetch();

    return () => {
      cancelled = true;
    };
  }, [status, propertyId]);

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.75 }}>
          {loading
            ? "Refreshing…"
            : `${rows.length} threads • ${unreadCount} unread`}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as StatusFilter)
            }
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>

          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              minWidth: 240,
            }}
          >
            <option value="all">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        {rows.map((c) => {
          const unread = isUnread(c);
          return (
            <Link
              key={c.id}
              href={`/dashboard/conversations/${c.id}`}
              style={{
                display: "block",
                padding: 12,
                borderBottom: "1px solid #eee",
                background: unread ? "#fafafa" : "white",
                fontWeight: unread ? 600 : 500,
              }}
            >
              {unread ? "● " : ""}
              {c.guest_number} —{" "}
              {c.properties?.name ?? c.property_id}
            </Link>
          );
        })}
      </div>
    </>
  );
}