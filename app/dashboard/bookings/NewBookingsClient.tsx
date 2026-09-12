"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Booking = {
  id: number;
  property_id: string;
  property_name: string;
  guest_name: string | null;
  arrival: string | null;
  departure: string | null;
  booked_at: string | null;
  status: string | null;
  source: string | null;
  is_new: boolean;
  party_size: number | null;
};

export default function NewBookingsClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [updatesActive, setUpdatesActive] = useState<boolean | null>(null);
  const [activatingUpdates, setActivatingUpdates] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [sort, setSort] = useState<"recent" | "arrival">("recent");

  const accessToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) throw new Error("Please sign in again.");
    return data.session.access_token;
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      try {
        const token = await accessToken();
        const response = await fetch("/api/lodgify/bookings", { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error ?? "Unable to load new bookings.");
        setRows(result?.bookings ?? []);
      } catch (loadError: any) {
        setError(loadError?.message ?? "Unable to load new bookings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      try {
        const token = await accessToken();
        const response = await fetch("/api/lodgify/webhook/subscribe", { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => null);
        if (response.ok) setUpdatesActive(result?.active === true);
      } catch { /* The booking list remains usable if setup status is unavailable. */ }
    })();
  }, [accessToken]);

  async function enableAutomaticUpdates() {
    setActivatingUpdates(true);
    setError(null);
    try {
      const token = await accessToken();
      const response = await fetch("/api/lodgify/webhook/subscribe", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Unable to enable automatic Lodgify updates.");
      setUpdatesActive(true);
    } catch (setupError: any) {
      setError(setupError?.message ?? "Unable to enable automatic Lodgify updates.");
    } finally {
      setActivatingUpdates(false);
    }
  }

  async function startInInbox(booking: Booking) {
    setStartingId(booking.id);
    setError(null);
    try {
      const token = await accessToken();
      const response = await fetch("/api/lodgify/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ booking_id: booking.id }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Unable to start this booking.");
      router.push(`/dashboard/conversations/${result.conversation_id}`);
    } catch (startError: any) {
      setError(startError?.message ?? "Unable to start this booking.");
      setStartingId(null);
    }
  }

  const fresh = rows.filter((booking) => booking.is_new);
  const sourceRows = fresh.length ? fresh : rows;
  const propertyOptions = Array.from(new Map(sourceRows.map((booking) => [booking.property_id, booking.property_name])).entries());
  const visibleRows = sourceRows
    .filter((booking) => propertyFilter === "all" || booking.property_id === propertyFilter)
    .sort((a, b) => {
      if (sort === "arrival") return (a.arrival ?? "9999-12-31").localeCompare(b.arrival ?? "9999-12-31");
      return (b.booked_at ? Date.parse(b.booked_at) : b.id) - (a.booked_at ? Date.parse(a.booked_at) : a.id);
    });

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <a href="/dashboard">← Inbox</a>
      <h1 style={{ margin: "16px 0 6px" }}>New Bookings</h1>
      <p style={{ color: "#64748b", maxWidth: 650 }}>
        Recent Lodgify reservations waiting to become active GuestOpsHQ guest workflows. Starting one creates its guest, stay, and Inbox record—no message is sent.
      </p>
      {updatesActive === false ? <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 10, padding: 12, margin: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#1e3a5f" }}>New confirmed Lodgify bookings are not yet arriving automatically.</span>
        <button type="button" onClick={() => void enableAutomaticUpdates()} disabled={activatingUpdates} style={{ padding: "8px 11px", border: "none", borderRadius: 8, background: "#0f5bff", color: "#fff", cursor: activatingUpdates ? "wait" : "pointer" }}>{activatingUpdates ? "Enabling…" : "Enable automatic updates"}</button>
      </div> : null}
      {updatesActive === true ? <p style={{ color: "#166534", fontSize: 13, margin: "14px 0" }}>Automatic confirmed-booking updates are on. Records are created without sending a message.</p> : null}

      {!loading && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "18px 0" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569" }}>Show house
          <select value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>
            <option value="all">All houses</option>
            {propertyOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569" }}>Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value as "recent" | "arrival")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>
            <option value="recent">Most recent booking</option>
            <option value="arrival">Upcoming check-in</option>
          </select>
        </label>
      </div>}

      {loading ? <p>Loading bookings…</p> : null}
      {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}

      {!loading ? <div style={{ display: "grid", gap: 10 }}>
        {visibleRows.map((booking) => <article key={booking.id} style={{ border: "1px solid #dbe4ee", borderRadius: 12, padding: 16, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <strong>{booking.guest_name ?? "Guest name pending"}</strong>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
              {booking.property_name} · {booking.arrival ?? "Date pending"} → {booking.departure ?? "Date pending"}
              {booking.party_size ? ` · ${booking.party_size} guests` : ""}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              {booking.booked_at ? `Booked ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(booking.booked_at))} · ` : ""}Lodgify #{booking.id}{booking.source ? ` · ${booking.source}` : ""}
            </div>
          </div>
          <button type="button" onClick={() => void startInInbox(booking)} disabled={startingId === booking.id} style={{ padding: "9px 13px", border: "none", borderRadius: 8, background: "#0f5bff", color: "#fff", cursor: startingId === booking.id ? "wait" : "pointer" }}>
            {startingId === booking.id ? "Starting…" : "Start in Inbox"}
          </button>
        </article>)}
        {!rows.length ? <p>No Lodgify bookings match your mapped properties yet. Set each rental in Property Guide first.</p> : null}
        {rows.length > 0 && visibleRows.length === 0 ? <p>No new bookings match this house.</p> : null}
      </div> : null}
    </main>
  );
}
