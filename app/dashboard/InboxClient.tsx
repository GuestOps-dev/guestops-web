"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  assigned_to_user_id?: string | null;

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
  return (
    new Date(c.last_inbound_at).getTime() >
    new Date(c.last_read_at).getTime()
  );
}

function sortByUpdatedDesc(a: ConversationRow, b: ConversationRow) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function isInteractiveElement(el: HTMLElement | null) {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "a" || tag === "button" || tag === "select" || tag === "input") {
    return true;
  }
  // If clicked inside an interactive element, treat as interactive too.
  return Boolean(el.closest("a,button,select,input"));
}

export default function InboxClient() {
  const router = useRouter();

  const {
    selectedPropertyId,
    setSelectedPropertyId,
    allowedPropertyIds,
    propertyOptions,
    loadingMemberships,
    membershipsError,
  } = usePropertyWorkspace();

  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [rawCount, setRawCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileNameById, setProfileNameById] = useState<
    Record<string, string>
  >({});

  const sb = useMemo(() => getSupabaseBrowserClient(), []);
  const unreadCount = useMemo(() => rows.filter(isUnread).length, [rows]);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of propertyOptions) map.set(p.id, p.name);
    return map;
  }, [propertyOptions]);

  useEffect(() => {
    let cancelled = false;

    async function loadUserAndRole() {
      const { data: userData, error: userError } = await sb.auth.getUser();
      if (cancelled) return;
      if (!userError && userData?.user) {
        setCurrentUserId(userData.user.id);

// TEMP: assume admin for now (we'll replace with a proper /api/me endpoint)
setIsAdmin(true);

      }
    }

    void loadUserAndRole();

    return () => {
      cancelled = true;
    };
  }, [sb]);

  async function getAccessToken(): Promise<string> {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session?.access_token)
      throw new Error("No Supabase session");
    return data.session.access_token;
  }

  async function updateStatus(row: ConversationRow, nextStatus: string) {
    const previousRows = rows;

    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: nextStatus,
            }
          : r
      )
    );

    try {
      const token = await getAccessToken();

      const res = await fetch(`/api/conversations/${row.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          property_id: row.property_id,
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Status update failed:", res.status, text);
        setRows(previousRows);
      }
    } catch (e) {
      console.error("Unexpected status update error:", e);
      setRows(previousRows);
    }
  }

  async function claimConversation(row: ConversationRow) {
    if (!currentUserId) return;

    const previousRows = rows;

    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              assigned_to_user_id: currentUserId,
            }
          : r
      )
    );

    try {
      const token = await getAccessToken();

      const res = await fetch(`/api/conversations/${row.id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          property_id: row.property_id,
          assigned_user_id: currentUserId,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Assign failed:", res.status, text);
        setRows(previousRows);
      }
    } catch (e) {
      console.error("Unexpected assign error:", e);
      setRows(previousRows);
    }
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

      const filtered =
        allowedPropertyIds.length > 0
          ? (data ?? []).filter((c) => allowedPropertyIds.includes(c.property_id))
          : (data ?? []);

      const nextRows = [...filtered].sort(sortByUpdatedDesc);
      setRows(nextRows);

      // Resolve profile names for assigned users per property
      const byProperty = new Map<string, Set<string>>();
      for (const row of nextRows) {
        const uid = row.assigned_to_user_id;
        if (!uid) continue;
        if (profileNameById[uid]) continue;
        if (!byProperty.has(row.property_id)) {
          byProperty.set(row.property_id, new Set<string>());
        }
        byProperty.get(row.property_id)!.add(uid);
      }

      const lookups = Array.from(byProperty.entries()).map(
        async ([propertyId, ids]) => {
          const body = {
            property_id: propertyId,
            profile_ids: Array.from(ids),
          };

          try {
            const res = await fetch("/api/profiles/lookup", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(body),
            });

            if (!res.ok) {
              const text = await res.text().catch(() => "");
              console.error("profiles lookup failed", propertyId, res.status, text);
              return [];
            }

            const json = (await res.json().catch(() => null)) as
              | { profiles?: Array<{ id: string; full_name: string | null }> }
              | null;
            return json?.profiles ?? [];
          } catch (e) {
            console.error("profiles lookup error", propertyId, e);
            return [];
          }
        }
      );

      if (lookups.length > 0) {
        const results = await Promise.all(lookups);
        const merged: Record<string, string> = {};
        for (const batch of results) {
          for (const p of batch) {
            if (!p.id) continue;
            if (p.full_name) merged[p.id] = p.full_name;
          }
        }

        if (Object.keys(merged).length > 0) {
          setProfileNameById((prev) => ({ ...prev, ...merged }));
        }
      }
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

  function assignedLabel(row: ConversationRow): string {
    const id = row.assigned_to_user_id ?? null;
    if (!id) return "Unassigned";

    const name = profileNameById[id];
    if (name && name.trim()) return name;

    return id.slice(0, 8);
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

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {loadingMemberships ? (
            <span style={{ fontSize: 12, opacity: 0.65 }}>Loading properties…</span>
          ) : membershipsError ? (
            <span style={{ fontSize: 12, color: "#b42318" }}>Property load failed</span>
          ) : null}

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
            gridTemplateColumns: "2.1fr 1.8fr 2fr 1.4fr 1.4fr 1fr 0.8fr",
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
          <div>Assigned</div>
          <div>Status</div>
          <div>Open</div>
        </div>

        {rows.map((c) => {
          const unread = isUnread(c);

          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                const target = e.target as HTMLElement | null;
                if (isInteractiveElement(target)) return;
                router.push(`/dashboard/conversations/${c.id}`);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  const target = e.target as HTMLElement | null;
                  if (isInteractiveElement(target)) return;
                  e.preventDefault();
                  router.push(`/dashboard/conversations/${c.id}`);
                }
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "2.1fr 1.8fr 2fr 1.4fr 1.4fr 1fr 0.8fr",
                gap: 12,
                padding: 12,
                borderTop: "1px solid #eee",
                background: unread ? "#fffdf3" : "white",
                cursor: "pointer",
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
              <div>
                {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "-"}
              </div>
              <div>
                <div style={{ fontSize: 12 }}>{assignedLabel(c)}</div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => claimConversation(c)}
                    style={{
                      marginTop: 4,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: "#f9fafb",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Claim
                  </button>
                ) : null}
              </div>
              <div>
                {isAdmin ? (
                  <select
                    value={c.status ?? "open"}
                    onChange={(e) => updateStatus(c, e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      fontSize: 12,
                      background: "white",
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                ) : (
                  <StatusBadge status={c.status} />
                )}
              </div>
              <div>
                <Link
                  href={`/dashboard/conversations/${c.id}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 13 }}
                >
                  Open
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || "").toLowerCase();
  const label = status ?? "-";

  const style: React.CSSProperties =
    s === "open"
      ? {
          background: "#dcfce7",
          color: "#166534",
          borderRadius: 999,
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 500,
        }
      : s === "closed"
      ? {
          background: "#fee2e2",
          color: "#7f1d1d",
          borderRadius: 999,
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 500,
        }
      : {
          background: "#e5e7eb",
          color: "#374151",
          borderRadius: 999,
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 500,
        };

  return <span style={style}>{label}</span>;
}