"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  assigned_to_user_id?: string | null;

  updated_at: string;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_read_at: string | null;
  /** From API: last_inbound_at > last_read_at */
  is_unread?: boolean;
};

type StatusFilter = "open" | "waiting_guest" | "closed" | "all";

/** Unread: last_inbound_at is not null AND (last_read_at is null OR last_inbound_at > last_read_at) */
function isUnread(c: ConversationRow) {
  if (c.last_inbound_at == null) return false;
  if (c.last_read_at == null) return true;
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

  const [allRows, setAllRows] = useState<ConversationRow[]>([]);
  const [rawCount, setRawCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileNameById, setProfileNameById] = useState<
    Record<string, string>
  >({});

  const sb = useMemo(() => getSupabaseBrowserClient(), []);

  const displayRows = useMemo(
    () =>
      status === "all"
        ? allRows
        : allRows.filter((r) => r.status === status),
    [allRows, status]
  );
  const unreadCount = useMemo(
    () => displayRows.filter(isUnread).length,
    [displayRows]
  );
  const unreadInbox = useMemo(
    () => allRows.filter((r) => r.status === "open" && isUnread(r)).length,
    [allRows]
  );
  const unreadWaitingGuest = useMemo(
    () =>
      allRows.filter((r) => r.status === "waiting_guest" && isUnread(r)).length,
    [allRows]
  );
  const unreadResolved = useMemo(
    () => allRows.filter((r) => r.status === "closed" && isUnread(r)).length,
    [allRows]
  );

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

        const { data: profile, error: profileError } = await sb
          .from("profiles")
          .select("role")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (cancelled) return;
        if (!profileError && profile?.role === "admin") {
          setIsAdmin(true);
        }
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
    const previousAllRows = allRows;

    setAllRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, status: nextStatus } : r
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
        setAllRows(previousAllRows);
      } else {
        // Best-effort refresh so tabs stay accurate
        void refetch();
      }
    } catch (e) {
      console.error("Unexpected status update error:", e);
      setAllRows(previousAllRows);
    }
  }

  async function claimConversation(row: ConversationRow) {
    if (!currentUserId) return;

    const previousAllRows = allRows;

    setAllRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, assigned_to_user_id: currentUserId }
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
          assigned_to_user_id: currentUserId,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Assign failed:", res.status, text);
        setAllRows(previousAllRows);
      }
    } catch (e) {
      console.error("Unexpected assign error:", e);
      setAllRows(previousAllRows);
    }
  }

  async function refetch() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();

      const params = new URLSearchParams();
      params.set("status", "all");

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

      if (Array.isArray(data) && data.length === 0) {
        console.log("inbox refetch empty", { propertyId: selectedPropertyId });
      }

      const filtered =
        allowedPropertyIds.length > 0
          ? (data ?? []).filter((c) => allowedPropertyIds.includes(c.property_id))
          : (data ?? []);

      const nextAllRows = [...filtered].sort(sortByUpdatedDesc);
      setAllRows(nextAllRows);

      // Resolve profile names for assigned users per property
      const byProperty = new Map<string, Set<string>>();
      for (const row of nextAllRows) {
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
      setAllRows([]);
      setRawCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, allowedPropertyIds.join(",")]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!allowedPropertyIds.length) return;

    const channel = sb
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          console.log("Realtime conversation update", payload);
          refetchRef.current();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("Realtime message update", payload);
          refetchRef.current();
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [sb, allowedPropertyIds.join(","), status, selectedPropertyId]);

  useEffect(() => {
    const sbClient = getSupabaseBrowserClient();
    if (!sbClient) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        refetchRef.current();
      }, 400);
    };

    const channel = sbClient
      .channel("dashboard-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => scheduleRefetch()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inbound_messages" },
        () => scheduleRefetch()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "outbound_messages" },
        () => scheduleRefetch()
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      channel.unsubscribe();
      sbClient.removeChannel(channel);
    };
  }, []);

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
          {loading ? "Refreshing…" : `${displayRows.length} threads • ${unreadCount} unread`}
          <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.65 }}>
            {`(${rawCount} from API)`}
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              display: "inline-flex",
              borderRadius: 999,
              border: "1px solid #e5e5e5",
              overflow: "hidden",
              fontSize: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setStatus("open")}
              style={{
                padding: "6px 10px",
                border: "none",
                background: status === "open" ? "#111" : "transparent",
                color: status === "open" ? "#fff" : "#444",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Inbox
              {unreadInbox > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    minWidth: 18,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: status === "open" ? "rgba(255,255,255,0.25)" : "#111",
                    color: status === "open" ? "#fff" : "#fff",
                  }}
                >
                  {unreadInbox}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatus("waiting_guest")}
              style={{
                padding: "6px 10px",
                border: "none",
                background: status === "waiting_guest" ? "#111" : "transparent",
                color: status === "waiting_guest" ? "#fff" : "#444",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Waiting on Guest
              {unreadWaitingGuest > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    minWidth: 18,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: status === "waiting_guest" ? "rgba(255,255,255,0.25)" : "#111",
                    color: "#fff",
                  }}
                >
                  {unreadWaitingGuest}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatus("closed")}
              style={{
                padding: "6px 10px",
                border: "none",
                background: status === "closed" ? "#111" : "transparent",
                color: status === "closed" ? "#fff" : "#444",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Resolved
              {unreadResolved > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    minWidth: 18,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: status === "closed" ? "rgba(255,255,255,0.25)" : "#111",
                    color: "#fff",
                  }}
                >
                  {unreadResolved}
                </span>
              )}
            </button>
          </div>

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

      {!loading && !error && displayRows.length === 0 ? (
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
          <div>Actions</div>
        </div>

        {displayRows.map((c) => {
          const unread = c.is_unread ?? isUnread(c);

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
                <StatusBadge status={c.status} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {c.status === "closed" ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void updateStatus(c, "open");
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: "#f9fafb",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Reopen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void updateStatus(c, "closed");
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: "#f9fafb",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Mark Resolved
                  </button>
                )}
                <Link
                  href={`/dashboard/conversations/${c.id}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 13, alignSelf: "center" }}
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
  const label =
    s === "open"
      ? "Open"
      : s === "waiting_guest"
        ? "Waiting on guest"
        : s === "closed"
          ? "Resolved"
          : status ?? "-";

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
      : s === "waiting_guest"
      ? {
          background: "#dbeafe",
          color: "#1d4ed8",
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