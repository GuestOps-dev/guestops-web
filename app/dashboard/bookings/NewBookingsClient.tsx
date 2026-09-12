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
  const visibleRows = fresh.length ? fresh : rows;

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <a href="/dashboard">← Inbox</a>
      <h1 style={{ margin: "16px 0 6px" }}>New Bookings</h1>
      <p style={{ color: "#64748b", maxWidth: 650 }}>
        Recent Lodgify reservations waiting to become active GuestOpsHQ guest workflows. Starting one creates its guest, stay, and Inbox record—no message is sent.
      </p>

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
              Lodgify #{booking.id}{booking.source ? ` · ${booking.source}` : ""}
            </div>
          </div>
          <button type="button" onClick={() => void startInInbox(booking)} disabled={startingId === booking.id} style={{ padding: "9px 13px", border: "none", borderRadius: 8, background: "#0f5bff", color: "#fff", cursor: startingId === booking.id ? "wait" : "pointer" }}>
            {startingId === booking.id ? "Starting…" : "Start in Inbox"}
          </button>
        </article>)}
        {!rows.length ? <p>No Lodgify bookings match your mapped properties yet. Set each rental in Property Guide first.</p> : null}
      </div> : null}
    </main>
  );
}
