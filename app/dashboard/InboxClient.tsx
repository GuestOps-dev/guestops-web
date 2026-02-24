"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePropertyWorkspace } from "./PropertyWorkspaceProvider";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type ConversationRow = {
  id: string;
  property_id: string;

  guest_number: string;
  service_number: string | null;

  channel: string;
  provider: string;

  status: string | null;
  priority: string | null;
  assigned_to: string | null;

  updated_at: string;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_read_at: string | null;
};

type StatusFilter = "open" | "closed" | "all";

function isUnread(c: ConversationRow) {
  if (!c.last_inbound_at) return false;
  if (!c.last_read_at) return true;
  return new Date(c.last_inbound_at).getTime() > new Date(c.last_read_at).getTime();
}

function sortByUpdatedDesc(a: ConversationRow, b: ConversationRow) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export default function InboxClient() {
  const {
    selectedPropertyId,
    setSelectedPropertyId,
    allowedPropertyIds,
    propertyOptions,
  } = usePropertyWorkspace();

  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [rawCount, setRawCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const sb = useMemo(() => getSupabaseBrowserClient(), []);
  const unreadCount = useMemo(() => rows.filter(isUnread).length, [rows]);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of propertyOptions) map.set(p.id, p.name);
    return map;
  }, [propertyOptions]);

  async function getAccessToken(): Promise<string> {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("No Supabase session");
    return data.session.access_token;
  }

  async function refetch() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();

      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);

      if (selectedPropertyId !== "all") {
        params.set("propertyId", selectedPropertyId);
      }

      const res = await fetch(`/api/conversations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Failed to load conversations: ${res.status} ${text}`);
      }

      const data = (text ? JSON.parse(text) : []) as ConversationRow[];
      setRawCount(Array.isArray(data) ? data.length : 0);

      // IMPORTANT:
      // Only apply allowedPropertyIds filtering if we actually have memberships.
      // If allowedPropertyIds is empty, do NOT drop everything — show what RLS returns.
      const filtered =
        allowedPropertyIds.length > 0
          ? (data ?? []).filter((c) => allowedPropertyIds.includes(c.property_id))
          : (data ?? []);

      setRows([...filtered].sort(sortByUpdatedDesc));
    } catch (e: any) {
      console.error("Inbox refetch error:", e);
      setError(e?.message ?? "Failed to load conversations");
      setRows([]);
      setRawCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedPropertyId, allowedPropertyIds.join(",")]);

  function displayPropertyName(propertyId: string) {
    return propertyNameById.get(propertyId) ?? propertyId;
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, opacity: 0.75 }}>
          {loading ? "Refreshing…" : `${rows.length} threads • ${unreadCount} unread`}
          <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.65 }}>
            (debug: allowed={allowedPropertyIds.length}, selected={selectedPropertyId}, apiRows={rawCount})
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>

          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              minWidth: 240,
            }}
          >
            <option value="all">All properties</option>
            {propertyOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div
          style={{
            border: "1px solid #f5c2c7",
            background: "#f8d7da",
            color: "#842029",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fafafa",
            color: "#555",
            fontSize: 13,
          }}
        >
          No conversations visible for your assigned properties.
        </div>
      ) : null}

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 2fr 2fr 1.2fr 1fr 1fr",
            gap: 12,
            padding: 12,
            background: "#fafafa",
            fontWeight: 600,
          }}
        >
          <div>Guest</div>
          <div>Twilio #</div>
          <div>Property</div>
          <div>Last Message</div>
          <div>Status</div>
          <div>Open</div>
        </div>

        {rows.map((c) => {
          const unread = isUnread(c);

          return (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 2fr 2fr 1.2fr 1fr 1fr",
                gap: 12,
                padding: 12,
                borderTop: "1px solid #eee",
                background: unread ? "#fffdf3" : "white",
              }}
            >
              <div style={{ fontWeight: unread ? 700 : 500 }}>
                {unread ? "● " : ""}
                {c.guest_number}
              </div>
              <div>
                <code>{c.service_number ?? "-"}</code>
              </div>
              <div>
                <code>{displayPropertyName(c.property_id)}</code>
              </div>
              <div>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "-"}</div>
              <div>{c.status ?? "-"}</div>
              <div>
                <Link href={`/dashboard/conversations/${c.id}`}>Open</Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}