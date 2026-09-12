"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePropertyWorkspace } from "./PropertyWorkspaceProvider";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type GuestInfo = {
  full_name?: string | null;
  phone_e164?: string | null;
  phone?: string | null;
  tags?: string[] | null;
} | null;

type BookingInfo = {
  check_in_date?: string | null;
  check_out_date?: string | null;
  source_reservation_id?: string | null;
} | null;

type ConversationRow = {
  id: string;
  property_id: string;
  guest_number: string;
  guest_id?: string | null;
  guests?: GuestInfo;
  bookings?: BookingInfo | BookingInfo[];
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
  is_unread?: boolean;
  tasks?: Array<{ status?: string | null }> | null;
};

function getGuestDisplayName(c: ConversationRow): string {
  const name = c.guests?.full_name?.trim();
  if (name) return name;
  const phone = c.guests?.phone_e164 ?? c.guests?.phone ?? c.guest_number;
  return phone || "—";
}

type StatusTab = "awaiting_team" | "waiting_guest" | "closed";
type AssignmentFilter = "all" | "assigned_to_me" | "unassigned";
const STATUS_TABS: StatusTab[] = ["awaiting_team", "waiting_guest", "closed"];

function belongsToStatusTab(rowStatus: string | null, tab: StatusTab) {
  // `active` is a legacy pre-MVP status. Keep existing rows visible in Inbox
  // while all new operator actions use the three canonical statuses.
  return rowStatus === tab || (tab === "awaiting_team" && rowStatus === "active");
}

function formatLastMessageAt(
  value: string | null,
  nowMs: number
): { label: string; exact: string } {
  if (!value) return { label: "No messages yet", exact: "" };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: "—", exact: "" };

  const differenceMs = nowMs - date.getTime();
  const minutes = Math.max(0, Math.floor(differenceMs / 60_000));
  const exact = date.toLocaleString();

  if (minutes < 1) return { label: "Just now", exact };
  if (minutes < 60) {
    return { label: `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`, exact };
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return { label: `${hours} ${hours === 1 ? "hour" : "hours"} ago`, exact };
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return { label: `${days} ${days === 1 ? "day" : "days"} ago`, exact };
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return { label: `${months} ${months === 1 ? "month" : "months"} ago`, exact };
  }

  const years = Math.floor(days / 365);
  return { label: `${years} ${years === 1 ? "year" : "years"} ago`, exact };
}

/** Unread: last_inbound_at is not null AND (last_read_at is null OR last_inbound_at > last_read_at) */
function isUnread(c: ConversationRow) {
  if (c.last_inbound_at == null) return false;
  if (c.last_read_at == null) return true;
  return (
    new Date(c.last_inbound_at).getTime() >
    new Date(c.last_read_at).getTime()
  );
}

/** A guest has sent something more recently than the property has replied. */
function needsReply(c: ConversationRow) {
  if (c.status === "closed" || c.last_inbound_at == null) return false;
  if (c.last_outbound_at == null) return true;
  return (
    new Date(c.last_inbound_at).getTime() >
    new Date(c.last_outbound_at).getTime()
  );
}

function openTaskCount(c: ConversationRow) {
  return c.tasks?.filter((task) => task.status === "open").length ?? 0;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bookingFor(c: ConversationRow): BookingInfo {
  return Array.isArray(c.bookings) ? c.bookings[0] ?? null : c.bookings ?? null;
}

/** The check-out date is inclusive so the thread stays prominent through departure day. */
function isInHouse(c: ConversationRow, today = localDateKey()) {
  const booking = bookingFor(c);
  if (!booking?.check_in_date || !booking.check_out_date) return false;
  // A new inbound message without a reservation receives a short-lived
  // placeholder record solely to keep its thread routable. It is not a stay.
  if (booking.source_reservation_id?.startsWith("placeholder:")) return false;
  return booking.check_in_date <= today && today <= booking.check_out_date;
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 3,
  vip: 2,
  normal: 1,
};

function priorityRank(c: ConversationRow): number {
  const p = (c.priority ?? "normal").toLowerCase();
  if (p === "urgent") return 4;
  if (isInHouse(c)) return 3;
  return PRIORITY_RANK[p] ?? 1;
}

function sortByPriorityThenUpdated(a: ConversationRow, b: ConversationRow) {
  const rankA = priorityRank(a);
  const rankB = priorityRank(b);
  if (rankB !== rankA) return rankB - rankA;
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
  const pathname = usePathname();
  const dashboardNavLinkStyle = (href: string): React.CSSProperties => ({
    padding: "6px 8px",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: pathname === href ? 650 : 550,
    color: pathname === href ? "#0f3d75" : "#334155",
    textDecoration: "none",
    whiteSpace: "nowrap",
    background: pathname === href ? "#fff" : "transparent",
    boxShadow: pathname === href ? "0 1px 2px rgba(15, 23, 42, 0.10)" : "none",
  });

  const {
    selectedPropertyId,
    setSelectedPropertyId,
    allowedPropertyIds,
    propertyOptions,
  } = usePropertyWorkspace();

  const [allRows, setAllRows] = useState<ConversationRow[]>([]);
  const [rawCount, setRawCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [statusTabs, setStatusTabs] = useState<StatusTab[]>(["awaiting_team"]);
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyNeededOnly, setReplyNeededOnly] = useState(false);
  const [inHouseOnly, setInHouseOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileNameById, setProfileNameById] = useState<
    Record<string, string>
  >({});
  const [relativeNow, setRelativeNow] = useState(() => Date.now());
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const sb = useMemo(() => getSupabaseBrowserClient(), []);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of propertyOptions) map.set(p.id, p.name);
    return map;
  }, [propertyOptions]);

  const displayRows = useMemo(() => {
    let rows = allRows.filter((r) => statusTabs.some((tab) => belongsToStatusTab(r.status, tab)));
    if (assignmentFilter === "assigned_to_me" && currentUserId) {
      rows = rows.filter((r) => r.assigned_to_user_id === currentUserId);
    } else if (assignmentFilter === "unassigned") {
      rows = rows.filter((r) => r.assigned_to_user_id == null);
    }
    if (replyNeededOnly) {
      rows = rows.filter(needsReply);
    }
    if (inHouseOnly) {
      rows = rows.filter((row) => isInHouse(row));
    }
    if (tagFilter) {
      rows = rows.filter((r) => {
        const tags = r.guests?.tags;
        return (
          Array.isArray(tags) &&
          tags.some(
            (tag) =>
              typeof tag === "string" &&
              tag.trim().toLowerCase() === tagFilter
          )
        );
      });
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      rows = rows.filter((row) => {
        const searchable = [
          getGuestDisplayName(row),
          row.guests?.phone_e164,
          row.guests?.phone,
          row.guest_number,
          propertyNameById.get(row.property_id),
        ];
        return searchable.some(
          (value) => typeof value === "string" && value.toLowerCase().includes(query)
        );
      });
    }
    return rows;
  }, [allRows, statusTabs, assignmentFilter, currentUserId, replyNeededOnly, inHouseOnly, tagFilter, searchQuery, propertyNameById]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) {
      const tags = r.guests?.tags;
      if (Array.isArray(tags)) {
        for (const t of tags) {
          if (typeof t === "string" && t.trim()) set.add(t.trim().toLowerCase());
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allRows]);
  const unreadCount = useMemo(
    () => displayRows.filter(isUnread).length,
    [displayRows]
  );
  const replyNeededCount = useMemo(
    () => displayRows.filter(needsReply).length,
    [displayRows]
  );
  const inHouseCount = useMemo(
    () => displayRows.filter((row) => isInHouse(row)).length,
    [displayRows]
  );
  const unreadInbox = useMemo(
    () =>
      allRows.filter((r) => belongsToStatusTab(r.status, "awaiting_team") && isUnread(r)).length,
    [allRows]
  );
  const unreadWaitingGuest = useMemo(
    () =>
      allRows.filter((r) => r.status === "waiting_guest" && isUnread(r)).length,
    [allRows]
  );
  const unreadClosed = useMemo(
    () => allRows.filter((r) => r.status === "closed" && isUnread(r)).length,
    [allRows]
  );

  const tabLabel: Record<StatusTab, string> = {
    awaiting_team: "Inbox",
    waiting_guest: "Waiting on Guest",
    closed: "Closed",
  };
  const hasActiveFilters =
    assignmentFilter !== "all" || replyNeededOnly || inHouseOnly || tagFilter !== "" || searchQuery.trim() !== "";

  function toggleStatusTab(tab: StatusTab) {
    setStatusTabs((current) => current.includes(tab) ? current.filter((item) => item !== tab) : [...current, tab]);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadUserAndRole() {
      const { data: userData, error: userError } = await sb.auth.getUser();
      if (cancelled) return;
      if (!userError && userData?.user) {
        setCurrentUserId(userData.user.id);
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
        method: "PATCH",
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
        setError("The conversation status could not be updated. Please try again.");
      } else {
        // Best-effort refresh so tabs stay accurate
        void refetch();
      }
    } catch (e) {
      console.error("Unexpected status update error:", e);
      setAllRows(previousAllRows);
      setError("The conversation status could not be updated. Please try again.");
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
        setError("The conversation could not be assigned to you. Please try again.");
      } else {
        void refetch();
      }
    } catch (e) {
      console.error("Unexpected assign error:", e);
      setAllRows(previousAllRows);
      setError("The conversation could not be assigned to you. Please try again.");
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

      const nextAllRows = [...filtered].sort(sortByPriorityThenUpdated);
      setAllRows(nextAllRows);

      const profileIdsByProperty = new Map<string, Set<string>>();
      for (const row of nextAllRows) {
        const profileId = row.assigned_to_user_id;
        if (!profileId || profileNameById[profileId]) continue;
        const ids = profileIdsByProperty.get(row.property_id) ?? new Set<string>();
        ids.add(profileId);
        profileIdsByProperty.set(row.property_id, ids);
      }

      if (profileIdsByProperty.size > 0) {
        try {
          const lookupResults = await Promise.all(
            Array.from(profileIdsByProperty, async ([propertyId, profileIds]) => {
              const res = await fetch("/api/profiles/lookup", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  property_id: propertyId,
                  profile_ids: Array.from(profileIds),
                }),
              });

              if (!res.ok) {
                const text = await res.text().catch(() => "");
                console.error("profiles lookup failed", res.status, text);
                return [] as Array<{ id: string; full_name?: string | null }>;
              }

              const json = (await res.json().catch(() => null)) as
                | { profiles?: Array<{ id: string; full_name?: string | null }> }
                | null;
              return json?.profiles ?? [];
            })
          );

          const merged: Record<string, string> = {};
          for (const profiles of lookupResults) {
            for (const profile of profiles) {
              if (profile.full_name?.trim()) merged[profile.id] = profile.full_name.trim();
            }
          }
          if (Object.keys(merged).length > 0) {
            setProfileNameById((prev) => ({ ...prev, ...merged }));
          }
        } catch (e) {
          console.error("profiles lookup error", e);
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
  }, [selectedPropertyId, allowedPropertyIds]);

  useEffect(() => {
    function focusSearchOnSlash(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", focusSearchOnSlash);
    return () => window.removeEventListener("keydown", focusSearchOnSlash);
  }, []);

  // Keep relative timestamps truthful even while the inbox is otherwise idle.
  useEffect(() => {
    const interval = window.setInterval(() => setRelativeNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        refetchRef.current();
      }, 400);
    };

    const channel = sb
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
      sb.removeChannel(channel);
    };
  }, [sb]);

  function displayPropertyName(propertyId: string) {
    return propertyNameById.get(propertyId) ?? propertyId;
  }

  function assignedLabel(row: ConversationRow): string {
    const id = row.assigned_to_user_id ?? null;
    if (!id) return "Unassigned";

    const name = profileNameById[id];
    if (name && name.trim()) return name;

    return "Assigned";
  }

  return (
    <div className="inbox-workspace">
      <div
        className="inbox-summarybar"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 10,
          padding: "12px 14px",
          border: "1px solid #dbe4ee",
          borderRadius: 14,
          background: "#fff",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.75 }}>
          {loading
            ? "Refreshing…"
            : `${displayRows.length} threads • ${unreadCount} unread${replyNeededCount ? ` • ${replyNeededCount} need${replyNeededCount === 1 ? "s" : ""} reply` : ""}`}
          {hasActiveFilters && rawCount !== displayRows.length ? (
            <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.65 }}>
              {`${rawCount} total`}
            </span>
          ) : null}
        </div>

        <div className="inbox-primary-controls" style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <nav
            aria-label="Dashboard sections"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              alignItems: "center",
              padding: 4,
              border: "1px solid #d9e3ee",
              borderRadius: 11,
              background: "#f6f9fc",
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9)",
            }}
          >
            <Link href="/dashboard/overview" style={dashboardNavLinkStyle("/dashboard/overview")}>Overview</Link>
            <Link href="/dashboard/bookings" style={dashboardNavLinkStyle("/dashboard/bookings")}>New Bookings</Link>
            <Link href="/dashboard/tasks" style={dashboardNavLinkStyle("/dashboard/tasks")}>Follow-ups</Link>
            <Link href="/dashboard/vendors" style={dashboardNavLinkStyle("/dashboard/vendors")}>
              Vendors
            </Link>
            <Link href="/dashboard/properties" style={dashboardNavLinkStyle("/dashboard/properties")}>
              Property Guide
            </Link>
          </nav>
          <div
            style={{
              display: "inline-flex",
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              overflow: "hidden",
              fontSize: 12,
            }}
          >
            {STATUS_TABS.map((tab) => {
              const unread =
                tab === "awaiting_team"
                  ? unreadInbox
                  : tab === "waiting_guest"
                    ? unreadWaitingGuest
                    : unreadClosed;
              const active = statusTabs.includes(tab);
              const tone = tab === "awaiting_team"
                ? { background: "#dcfce7", border: "#86efac", color: "#166534", badge: "#15803d" }
                : tab === "waiting_guest"
                  ? { background: "#fef3c7", border: "#fcd34d", color: "#92400e", badge: "#b45309" }
                  : { background: "#f1f5f9", border: "#cbd5e1", color: "#475569", badge: "#64748b" };
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => toggleStatusTab(tab)}
                  aria-pressed={active}
                  style={{
                    padding: "8px 14px",
                    border: `1px solid ${active ? tone.border : "transparent"}`,
                    borderRight: tab !== "closed" ? `1px solid ${active ? tone.border : "#e5e5e5"}` : undefined,
                    background: active ? tone.background : "transparent",
                    color: active ? tone.color : "#64748b",
                    cursor: "pointer",
                    fontWeight: active ? 600 : 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {tabLabel[tab]}
                  {unread > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        minWidth: 18,
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: active ? tone.badge : "#64748b",
                        color: "#fff",
                      }}
                    >
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
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

      <div
        className="inbox-filterbar"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          padding: "10px 14px",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#f8fafc",
        }}
      >
        <span style={{ fontSize: 12, color: "#666" }}>Assignment:</span>
        <div
          style={{
            display: "inline-flex",
            borderRadius: 8,
            border: "1px solid #e5e5e5",
            overflow: "hidden",
            fontSize: 12,
          }}
        >
          {(["all", "assigned_to_me", "unassigned"] as const).map((filter) => {
            const active = assignmentFilter === filter;
            const label =
              filter === "all"
                ? "All"
                : filter === "assigned_to_me"
                  ? "Assigned to me"
                  : "Unassigned";
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setAssignmentFilter(filter)}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  borderRight: filter !== "unassigned" ? "1px solid #e5e5e5" : "none",
                  background: active ? "#374151" : "transparent",
                  color: active ? "#fff" : "#444",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: "#666" }}>Tag:</span>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #e5e5e5",
            fontSize: 12,
            minWidth: 120,
            cursor: "pointer",
          }}
        >
          <option value="">All tags</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={replyNeededOnly}
          onClick={() => setReplyNeededOnly((value) => !value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: replyNeededOnly ? "1px solid #c2410c" : "1px solid #e5e5e5",
            background: replyNeededOnly ? "#fff7ed" : "#fff",
            color: replyNeededOnly ? "#9a3412" : "#444",
            fontSize: 12,
            fontWeight: replyNeededOnly ? 600 : 500,
            cursor: "pointer",
          }}
        >
          Reply needed{replyNeededCount ? ` (${replyNeededCount})` : ""}
        </button>
        <button
          type="button"
          aria-pressed={inHouseOnly}
          onClick={() => setInHouseOnly((value) => !value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: inHouseOnly ? "1px solid #7c3aed" : "1px solid #e5e5e5",
            background: inHouseOnly ? "#f5f3ff" : "#fff",
            color: inHouseOnly ? "#6d28d9" : "#444",
            fontSize: 12,
            fontWeight: inHouseOnly ? 600 : 500,
            cursor: "pointer",
          }}
        >
          In-house{inHouseCount ? ` (${inHouseCount})` : ""}
        </button>
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search guest, phone, or property"
          aria-label="Search inbox"
          title="Press / to search"
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #e5e5e5",
            fontSize: 12,
            minWidth: 220,
          }}
        />
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              setAssignmentFilter("all");
              setReplyNeededOnly(false);
              setInHouseOnly(false);
              setTagFilter("");
              setSearchQuery("");
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#374151",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
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
          <div>{error}</div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={loading}
            style={{
              marginTop: 10,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid currentColor",
              background: "transparent",
              color: "inherit",
              cursor: loading ? "wait" : "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {loading ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : null}

      {!loading && !error && displayRows.length === 0 ? (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 24,
            background: "#fafafa",
            color: "#555",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {hasActiveFilters
            ? "No conversations match your filters."
            : statusTabs.length
              ? "No conversations in the selected views."
              : "Choose one or more status views above to see conversations."}
        </div>
      ) : null}

      {displayRows.length > 0 ? (
      <div
        className="inbox-table"
        style={{
          border: "1px solid #dbe4ee",
          borderRadius: 14,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          className="inbox-table-header"
          style={{
            display: "grid",
            gridTemplateColumns: "2.1fr 2fr 1.4fr 1.4fr 1fr",
            gap: 12,
            padding: 12,
            background: "#f8fafc",
            fontWeight: 600,
          }}
        >
          <div>Guest</div>
          <div>Property</div>
          <div>Last Message</div>
          <div>Assigned</div>
          <div>Actions</div>
        </div>

        {displayRows.map((c) => {
          const unread = c.is_unread ?? isUnread(c);
          const replyNeeded = needsReply(c);
          const openTasks = openTaskCount(c);
          const statusLabel = conversationStatusLabel(c.status);

          return (
            <div
              key={c.id}
              className="inbox-table-row"
              role="button"
              aria-label={`${getGuestDisplayName(c)} conversation, ${statusLabel}`}
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
                gridTemplateColumns: "2.1fr 2fr 1.4fr 1.4fr 1fr",
                gap: 12,
                padding: "12px 12px 12px 9px",
                borderTop: "1px solid #edf2f7",
                borderLeft: `4px solid ${conversationStatusAccent(c.status)}`,
                background: unread ? "#fffdf3" : "white",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: unread ? 700 : 500, display: "flex", alignItems: "center", gap: 6 }}>
                {unread ? "● " : ""}
                {getGuestDisplayName(c)}
                <PriorityBadge priority={c.priority} />
                {isInHouse(c) ? <InHouseBadge /> : null}
                {replyNeeded ? (
                  <span
                    title="The guest's latest message has not received a property reply yet."
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#9a3412",
                      background: "#ffedd5",
                      border: "1px solid #fdba74",
                      borderRadius: 999,
                      padding: "2px 7px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Reply needed
                  </span>
                ) : null}
                {openTasks > 0 ? (
                  <span
                    title={`${openTasks} open follow-up${openTasks === 1 ? "" : "s"} on this conversation.`}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#1d4ed8",
                      background: "#dbeafe",
                      border: "1px solid #93c5fd",
                      borderRadius: 999,
                      padding: "2px 7px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {openTasks} follow-up{openTasks === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <div>
                <code>{displayPropertyName(c.property_id)}</code>
              </div>
              <div title={formatLastMessageAt(c.last_message_at, relativeNow).exact}>
                {formatLastMessageAt(c.last_message_at, relativeNow).label}
              </div>
              <div>
                <div style={{ fontSize: 12 }}>{assignedLabel(c)}</div>
                {currentUserId && c.assigned_to_user_id !== currentUserId ? (
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
                    {c.assigned_to_user_id ? "Assign to me" : "Claim"}
                  </button>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {c.status === "closed" ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void updateStatus(c, "awaiting_team");
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
                    Mark Closed
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
      ) : null}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string | null }) {
  const p = (priority ?? "normal").toLowerCase();
  const style: React.CSSProperties =
    p === "urgent"
      ? { background: "#fee2e2", color: "#b91c1c" }
      : p === "vip"
        ? { background: "#ede9fe", color: "#5b21b6" }
        : { background: "#f3f4f6", color: "#6b7280" };
  const label = p === "urgent" ? "Urgent" : p === "vip" ? "VIP" : "Normal";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 6px",
        borderRadius: 999,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

function InHouseBadge() {
  return (
    <span
      title="This guest is currently in-house."
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 999,
        background: "#f5f3ff",
        color: "#6d28d9",
        border: "1px solid #ddd6fe",
        whiteSpace: "nowrap",
      }}
    >
      In-house
    </span>
  );
}

function conversationStatusLabel(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "awaiting_team" || s === "active") return "Inbox";
  if (s === "waiting_guest") return "Waiting on Guest";
  if (s === "closed") return "Closed";
  return status ?? "Unknown status";
}

function conversationStatusAccent(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "awaiting_team" || s === "active") return "#22a75b";
  if (s === "waiting_guest") return "#d97706";
  if (s === "closed") return "#94a3b8";
  return "#cbd5e1";
}
