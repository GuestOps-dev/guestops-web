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
  propertyOptions: Array<{ id: string; name: string }>;
  allowedPropertyIds: string[];
};

type StatusFilter = "open" | "closed" | "all";

const SELECTED_PROPERTY_KEY = "guestops:selectedPropertyId";

function isUnread(c: ConversationRow) {
  if (!c.last_inbound_at) return false;
  if (!c.last_read_at) return true;
  return new Date(c.last_inbound_at).getTime() > new Date(c.last_read_at).getTime();
}

function sortByUpdatedDesc(a: ConversationRow, b: ConversationRow) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export default function InboxClient({ initial, propertyOptions, allowedPropertyIds }: Props) {
  const [rows, setRows] = useState<ConversationRow[]>(() =>
    [...(initial || [])].sort(sortByUpdatedDesc)
  );

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [propertyId, setPropertyId] = useState<string>("all");

  const sb = useMemo(() => getSupabaseBrowserClient(), []);
  const unreadCount = useMemo(() => rows.filter(isUnread).length, [rows]);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of propertyOptions) map.set(p.id, p.name);
    return map;
  }, [propertyOptions]);

  function displayPropertyName(c: ConversationRow) {
    return c.properties?.name ?? propertyNameById.get(c.property_id) ?? c.property_id;
  }

  async function getAccessToken(): Promise<string> {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("No Supabase session");
    return data.session.access_token;
  }

  // Load and validate saved property selection
  useEffect(() => {
    const saved = safeGetLocalStorage(SELECTED_PROPERTY_KEY);

    const normalized =
      saved && saved !== "all" && allowedPropertyIds.includes(saved) ? saved : "all";

    setPropertyId(normalized);

    // If invalid, overwrite so it doesn't "stick" and hide everything
    if (saved !== normalized) {
      safeSetLocalStorage(SELECTED_PROPERTY_KEY, normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedPropertyIds.join(",")]);

  // Persist selection
  useEffect(() => {
    safeSetLocalStorage(SELECTED_PROPERTY_KEY, propertyId);
  }, [propertyId]);

  // Fetch conversations via secure API
  useEffect(() => {
    let cancelled = false;

    async function refetch() {
      setLoading(true);

      try {
        const token = await getAccessToken();

        const params = new URLSearchParams();
        if (status !== "all") params.set("status", status);

        // Only apply property filter if it is allowed
        if (propertyId !== "all") {
          if (!allowedPropertyIds.includes(propertyId)) {
            // fail closed
            setPropertyId("all");
          } else {
            params.set("propertyId", propertyId);
          }
        }

        const res = await fetch(`/api/conversations?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to load conversations");
        const data = await res.json();

        const nextRows: ConversationRow[] = (data || []).sort(sortByUpdatedDesc);

        // Defensive: only show rows in allowed properties
        const filtered = allowedPropertyIds.length
          ? nextRows.filter((c) => allowedPropertyIds.includes(c.property_id))
          : nextRows;

        if (!cancelled) setRows(filtered);
      } catch (err) {
        console.error("Inbox refetch error:", err);
      }

      setLoading(false);
    }

    refetch();
    return () => {
      cancelled = true;
    };
  }, [sb, status, propertyId, allowedPropertyIds]);

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, opacity: 0.75 }}>
          {loading ? "Refreshing…" : `${rows.length} threads • ${unreadCount} unread`}
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
            {propertyOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="mobileOnly" style={{ display: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((c) => {
            const unread = isUnread(c);
            return (
              <Link
                key={c.id}
                href={`/dashboard/conversations/${c.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  border: unread ? "1px solid #111" : "1px solid #eee",
                  borderRadius: 14,
                  padding: 14,
                  background: unread ? "#fafafa" : "white",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {c.status ?? "-"} •{" "}
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "-"}
                </div>

                <div style={{ marginTop: 6, fontSize: 16, fontWeight: unread ? 700 : 600 }}>
                  {unread ? "● " : ""}
                  Guest: <span style={{ fontWeight: 500 }}>{c.guest_number}</span>
                </div>

                <div style={{ marginTop: 4, fontSize: 14 }}>
                  Twilio: <code>{c.service_number ?? "-"}</code>
                </div>

                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  Property: <code>{displayPropertyName(c)}</code>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Desktop table */}
      <div className="desktopOnly" style={{ display: "block" }}>
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
                  <code>{displayPropertyName(c)}</code>
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
      </div>
    </>
  );
}

function safeGetLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}