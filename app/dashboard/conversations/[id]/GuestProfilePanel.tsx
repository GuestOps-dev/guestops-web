"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import ConversationTasks from "./ConversationTasks";
import ConversationServices from "./ConversationServices";

export type GuestRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: string | null;
  language_pref: string | null;
  notes: string | null;
  created_at: string;
  property_id: string;
  phone_e164: string | null;
  tags?: string[];
};

export type GuestNoteRow = {
  id: string;
  property_id: string;
  guest_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type BookingStay = {
  id: string;
  check_in_date: string | null;
  check_out_date: string | null;
  party_size?: number | null;
};

export type StayHistoryRow = BookingStay;

export type ConversationHistoryRow = {
  id: string;
  status: string | null;
  last_message_at: string | null;
  updated_at: string | null;
};

export type PropertyGuideSummary = {
  check_in_time: string | null;
  check_out_time: string | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
  check_in_instructions_guest: string | null;
};

type Props = {
  guest: GuestRow;
  conversationId: string;
  propertyId: string;
  propertyName: string;
  booking: BookingStay | null;
  stayHistory: StayHistoryRow[];
  conversationHistory: ConversationHistoryRow[];
  initialNotes: GuestNoteRow[];
  propertyGuide: PropertyGuideSummary | null;
};

function formatStayDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatHistoryDate(value: string | null) {
  if (!value) return "No messages";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString();
}

function conversationStatusLabel(status: string | null) {
  if (status === "awaiting_team" || status === "active") return "Inbox";
  if (status === "waiting_guest") return "Waiting on guest";
  if (status === "closed") return "Closed";
  return status ?? "Unknown";
}

export default function GuestProfilePanel({
  guest,
  conversationId,
  propertyId,
  propertyName,
  booking: initialBooking,
  stayHistory,
  conversationHistory,
  initialNotes,
  propertyGuide,
}: Props) {
  const [profile, setProfile] = useState<GuestRow>(guest);
  const [booking, setBooking] = useState<BookingStay | null>(initialBooking);
  const [notes, setNotes] = useState<GuestNoteRow[]>(initialNotes);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(profile.full_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [emailValue, setEmailValue] = useState(profile.email ?? "");
  const [channelValue, setChannelValue] = useState(profile.preferred_channel ?? "");
  const [languageValue, setLanguageValue] = useState(profile.language_pref ?? "");
  const [savingDetails, setSavingDetails] = useState(false);
  const [editingStay, setEditingStay] = useState(false);
  const [checkInValue, setCheckInValue] = useState(initialBooking?.check_in_date ?? "");
  const [checkOutValue, setCheckOutValue] = useState(initialBooking?.check_out_date ?? "");
  const [partySizeValue, setPartySizeValue] = useState(initialBooking?.party_size?.toString() ?? "");
  const [savingStay, setSavingStay] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagsBusy, setTagsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = profile.tags ?? [];

  const saveName = async () => {
    const trimmed = nameValue.trim();
    if (trimmed === (profile.full_name ?? "")) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    setError(null);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        return;
      }
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ property_id: propertyId, full_name: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const data = await res.json();
      setProfile((p) => ({ ...p, full_name: data.full_name ?? trimmed }));
      setEditingName(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingName(false);
    }
  };

  const saveDetails = async () => {
    if (savingDetails) return;
    setSavingDetails(true);
    setError(null);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        return;
      }
      const email = emailValue.trim();
      const preferredChannel = channelValue.trim();
      const language = languageValue.trim();
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          property_id: propertyId,
          email: email || null,
          preferred_channel: preferredChannel || null,
          language_pref: language || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const data = (await res.json()) as Partial<GuestRow>;
      setProfile((p) => ({
        ...p,
        email: data.email ?? null,
        preferred_channel: data.preferred_channel ?? null,
        language_pref: data.language_pref ?? null,
      }));
      setEditingDetails(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save contact details");
    } finally {
      setSavingDetails(false);
    }
  };

  const saveStay = async () => {
    if (savingStay) return;
    if (checkInValue && checkOutValue && checkOutValue < checkInValue) {
      setError("Check-out must be on or after check-in");
      return;
    }
    const partySize = partySizeValue.trim() === "" ? null : Number(partySizeValue);
    if (partySize !== null && (!Number.isInteger(partySize) || partySize < 1 || partySize > 100)) {
      setError("Party size must be a whole number from 1 to 100");
      return;
    }
    setSavingStay(true);
    setError(null);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        return;
      }
      const res = await fetch(`/api/conversations/${conversationId}/stay`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          property_id: propertyId,
          check_in_date: checkInValue || null,
          check_out_date: checkOutValue || null,
          party_size: partySize,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const data = (await res.json()) as BookingStay;
      setBooking(data);
      setCheckInValue(data.check_in_date ?? "");
      setCheckOutValue(data.check_out_date ?? "");
      setPartySizeValue(data.party_size?.toString() ?? "");
      setEditingStay(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save stay dates");
    } finally {
      setSavingStay(false);
    }
  };

  async function addTag(tagValue: string) {
    const tag = tagValue.trim().toLowerCase();
    if (!tag || tagsBusy) return;
    if (tags.includes(tag)) {
      setTagInput("");
      return;
    }
    setTagsBusy(true);
    setError(null);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        return;
      }
      const res = await fetch(`/api/guests/${guest.id}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ add: tag }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const data = (await res.json()) as { ok?: boolean; guest?: { id: string; tags: string[] } };
      const nextTags = data.guest?.tags ?? [];
      setProfile((p) => ({ ...p, tags: nextTags }));
      setTagInput("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add tag");
    } finally {
      setTagsBusy(false);
    }
  }

  async function removeTag(tag: string) {
    if (tagsBusy) return;
    setTagsBusy(true);
    setError(null);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        return;
      }
      const res = await fetch(`/api/guests/${guest.id}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remove: tag }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const data = (await res.json()) as { ok?: boolean; guest?: { id: string; tags: string[] } };
      const nextTags = data.guest?.tags ?? [];
      setProfile((p) => ({ ...p, tags: nextTags }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove tag");
    } finally {
      setTagsBusy(false);
    }
  }

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteBody.trim();
    if (!trimmed || submittingNote) return;
    setSubmittingNote(true);
    setError(null);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        return;
      }
      const res = await fetch(`/api/guests/${guest.id}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ property_id: propertyId, body: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const created = (await res.json()) as GuestNoteRow;
      setNotes((prev) => [created, ...prev]);
      setNoteBody("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  };

  return (
    <div
      className="guest-profile-panel"
      style={{
        width: 280,
        flexShrink: 0,
        position: "sticky",
        top: 16,
        alignSelf: "flex-start",
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        borderLeft: "1px solid #dbe4ee",
        paddingLeft: 18,
        marginLeft: 16,
        background: "#fff",
        borderRadius: 10,
        paddingTop: 4,
        paddingRight: 4,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Guest profile
      </h3>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 600,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            marginBottom: 3,
          }}
        >
          House
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
          {propertyName}
        </div>
      </div>

      {propertyGuide && (
        <details style={{ marginBottom: 14 }}>
          <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Property quick reference
          </summary>
          <div
            style={{
              marginTop: 7,
              padding: "8px 9px",
              borderRadius: 7,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontSize: 12,
              color: "#334155",
              display: "grid",
              gap: 5,
            }}
          >
            {(propertyGuide.check_in_time || propertyGuide.check_out_time) && (
              <div>
                <strong>Arrival / departure:</strong>{" "}
                {propertyGuide.check_in_time || "—"} / {propertyGuide.check_out_time || "—"}
              </div>
            )}
            {propertyGuide.wifi_ssid && (
              <div><strong>Wi-Fi:</strong> {propertyGuide.wifi_ssid}</div>
            )}
            {propertyGuide.wifi_password && (
              <div><strong>Password:</strong> {propertyGuide.wifi_password}</div>
            )}
            {propertyGuide.check_in_instructions_guest && (
              <div style={{ whiteSpace: "pre-wrap" }}>
                <strong>Arrival notes:</strong>{"\n"}{propertyGuide.check_in_instructions_guest}
              </div>
            )}
            {!propertyGuide.check_in_time && !propertyGuide.check_out_time && !propertyGuide.wifi_ssid && !propertyGuide.wifi_password && !propertyGuide.check_in_instructions_guest && (
              <div style={{ color: "#64748b" }}>No quick-reference details saved yet.</div>
            )}
          </div>
        </details>
      )}

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 600,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            marginBottom: 3,
          }}
        >
          Stay
        </div>
        {editingStay ? (
            <div style={{ fontSize: 12 }}>
              <label style={{ display: "block", marginBottom: 8 }}>
                <span style={{ display: "block", color: "#555", marginBottom: 3 }}>Check-in</span>
                <input
                  type="date"
                  value={checkInValue}
                  onChange={(e) => setCheckInValue(e.target.value)}
                  disabled={savingStay}
                  style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, fontSize: 12 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                <span style={{ display: "block", color: "#555", marginBottom: 3 }}>Check-out</span>
                <input
                  type="date"
                  value={checkOutValue}
                  min={checkInValue || undefined}
                  onChange={(e) => setCheckOutValue(e.target.value)}
                  disabled={savingStay}
                  style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, fontSize: 12 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                <span style={{ display: "block", color: "#555", marginBottom: 3 }}>Guests in party</span>
                <input type="number" min="1" max="100" value={partySizeValue} onChange={(e) => setPartySizeValue(e.target.value)} disabled={savingStay} placeholder="Optional" style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, fontSize: 12 }} />
              </label>
              <button
                type="button"
                onClick={() => void saveStay()}
                disabled={savingStay}
                style={{ padding: "5px 9px", fontSize: 12, border: "1px solid #0ea5e9", background: "#0ea5e9", color: "#fff", borderRadius: 6, cursor: savingStay ? "not-allowed" : "pointer" }}
              >
                {savingStay ? "Saving…" : "Save stay"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckInValue(booking?.check_in_date ?? "");
                  setCheckOutValue(booking?.check_out_date ?? "");
                  setPartySizeValue(booking?.party_size?.toString() ?? "");
                  setEditingStay(false);
                  setError(null);
                }}
                disabled={savingStay}
                style={{ marginLeft: 6, padding: "5px 9px", fontSize: 12, border: "1px solid #ccc", background: "#fff", color: "#333", borderRadius: 6, cursor: savingStay ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
            </div>
          ) : booking ? (
            <div style={{ fontSize: 12, color: "#444" }}>
              <div>Check-in: {formatStayDate(booking.check_in_date)}</div>
              <div>Check-out: {formatStayDate(booking.check_out_date)}</div>
              {booking.party_size ? <div>Party: {booking.party_size} guests</div> : null}
              <button
                type="button"
                onClick={() => {
                  setCheckInValue(booking.check_in_date ?? "");
                  setCheckOutValue(booking.check_out_date ?? "");
                  setPartySizeValue(booking.party_size?.toString() ?? "");
                  setEditingStay(true);
                }}
                style={{ marginTop: 6, padding: 0, border: "none", background: "transparent", color: "#2563eb", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              >
                Edit stay dates
              </button>
            </div>
          ) : (
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            <div>No stay dates added yet.</div>
            <button
              type="button"
              onClick={() => {
                setCheckInValue("");
                setCheckOutValue("");
                setPartySizeValue("");
                setEditingStay(true);
              }}
              style={{ marginTop: 6, padding: 0, border: "none", background: "transparent", color: "#2563eb", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
            >
              Add stay dates
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <h4 style={{ fontSize: 12, fontWeight: 600, margin: "0 0 6px" }}>
          Stay history
        </h4>
        {stayHistory.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6b7280" }}>No stays recorded yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 5 }}>
            {stayHistory.map((stay) => (
              <div
                key={stay.id}
                style={{ fontSize: 12, color: "#444", padding: "5px 7px", borderRadius: 6, background: "#f9fafb" }}
              >
                {formatStayDate(stay.check_in_date)} – {formatStayDate(stay.check_out_date)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <h4 style={{ fontSize: 12, fontWeight: 600, margin: "0 0 6px" }}>
          Other conversations
        </h4>
        {conversationHistory.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6b7280" }}>No other conversations.</div>
        ) : (
          <div style={{ display: "grid", gap: 5 }}>
            {conversationHistory.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/dashboard/conversations/${conversation.id}`}
                style={{ fontSize: 12, color: "#2563eb", padding: "5px 7px", borderRadius: 6, background: "#eff6ff", textDecoration: "none" }}
              >
                {formatHistoryDate(conversation.last_message_at ?? conversation.updated_at)} · {conversationStatusLabel(conversation.status)}
              </Link>
            ))}
          </div>
        )}
      </div>

      <ConversationTasks
        propertyId={propertyId}
        conversationId={conversationId}
        guestId={profile.id}
        bookingId={booking?.id}
      />

      <ConversationServices propertyId={propertyId} bookingId={booking?.id} />

      {editingName ? (
        <div style={{ marginBottom: 12 }}>
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveName();
              if (e.key === "Escape") {
                setNameValue(profile.full_name ?? "");
                setEditingName(false);
              }
            }}
            autoFocus
            style={{
              width: "100%",
              padding: "6px 8px",
              border: "1px solid #ccc",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={saveName}
            disabled={savingName}
            style={{
              marginTop: 4,
              padding: "4px 8px",
              fontSize: 12,
              border: "1px solid #0ea5e9",
              background: "#0ea5e9",
              color: "#fff",
              borderRadius: 6,
              cursor: savingName ? "not-allowed" : "pointer",
            }}
          >
            {savingName ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setNameValue(profile.full_name ?? "");
              setEditingName(false);
              setError(null);
            }}
            disabled={savingName}
            style={{
              marginTop: 4,
              marginLeft: 6,
              padding: "4px 8px",
              fontSize: 12,
              border: "1px solid #ccc",
              background: "#fff",
              color: "#333",
              borderRadius: 6,
              cursor: savingName ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditingName(true);
            setNameValue(profile.full_name ?? "");
          }}
          style={{
            display: "block",
            marginBottom: 12,
            padding: 0,
            border: "none",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            textAlign: "left",
          }}
          aria-label="Edit guest name"
        >
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {profile.full_name || "— No name —"}
          </span>
          <span style={{ fontSize: 11, color: "#666", marginLeft: 6 }}>Edit</span>
        </button>
      )}

      {editingDetails ? (
        <div style={{ marginBottom: 14, fontSize: 12 }}>
          <div style={{ color: "#444", marginBottom: 8 }}>
            Phone: {profile.phone_e164 || profile.phone || "—"}
          </div>
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", color: "#555", marginBottom: 3 }}>Email</span>
            <input
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              disabled={savingDetails}
              style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, fontSize: 12 }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", color: "#555", marginBottom: 3 }}>Preferred channel</span>
            <select
              value={channelValue}
              onChange={(e) => setChannelValue(e.target.value)}
              disabled={savingDetails}
              style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, fontSize: 12 }}
            >
              <option value="">Not set</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", color: "#555", marginBottom: 3 }}>Language</span>
            <select
              value={languageValue}
              onChange={(e) => setLanguageValue(e.target.value)}
              disabled={savingDetails}
              style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, fontSize: 12 }}
            >
              <option value="">Not set</option>
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void saveDetails()}
            disabled={savingDetails}
            style={{ padding: "5px 9px", fontSize: 12, border: "1px solid #0ea5e9", background: "#0ea5e9", color: "#fff", borderRadius: 6, cursor: savingDetails ? "not-allowed" : "pointer" }}
          >
            {savingDetails ? "Saving…" : "Save details"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEmailValue(profile.email ?? "");
              setChannelValue(profile.preferred_channel ?? "");
              setLanguageValue(profile.language_pref ?? "");
              setEditingDetails(false);
              setError(null);
            }}
            disabled={savingDetails}
            style={{ marginLeft: 6, padding: "5px 9px", fontSize: 12, border: "1px solid #ccc", background: "#fff", color: "#333", borderRadius: 6, cursor: savingDetails ? "not-allowed" : "pointer" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#444", marginBottom: 14 }}>
          <div>Phone: {profile.phone_e164 || profile.phone || "—"}</div>
          <div>Email: {profile.email || "—"}</div>
          <div>Channel: {profile.preferred_channel || "—"}</div>
          <div>Language: {profile.language_pref || "—"}</div>
          <button
            type="button"
            onClick={() => {
              setEmailValue(profile.email ?? "");
              setChannelValue(profile.preferred_channel ?? "");
              setLanguageValue(profile.language_pref ?? "");
              setEditingDetails(true);
            }}
            style={{ marginTop: 6, padding: 0, border: "none", background: "transparent", color: "#2563eb", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >
            Edit contact details
          </button>
        </div>
      )}

      <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Tags</h4>
      <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tags.map((t) => (
          <span
            key={t}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#e0e7ff",
              color: "#3730a3",
            }}
          >
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                void removeTag(t);
              }}
              disabled={tagsBusy}
              style={{
                padding: 0,
                margin: 0,
                border: "none",
                background: "none",
                cursor: tagsBusy ? "not-allowed" : "pointer",
                fontSize: 12,
                lineHeight: 1,
                color: "#3730a3",
              }}
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addTag(tagInput);
            }
          }}
          placeholder="Add tag…"
          disabled={tagsBusy}
          style={{
            flex: 1,
            padding: "6px 8px",
            border: "1px solid #ddd",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <button
          type="button"
          onClick={() => void addTag(tagInput)}
          disabled={tagsBusy || !tagInput.trim()}
          style={{
            padding: "6px 10px",
            fontSize: 12,
            border: "none",
            background: "#6366f1",
            color: "#fff",
            borderRadius: 6,
            cursor: tagsBusy || !tagInput.trim() ? "not-allowed" : "pointer",
          }}
        >
          Add
        </button>
      </div>

      {error && (
        <div role="alert" style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>
          {error}
        </div>
      )}

      <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        Notes
      </h4>
      <form onSubmit={addNote} style={{ marginBottom: 12 }}>
        <textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          placeholder="Add note…"
          rows={2}
          disabled={submittingNote}
          style={{
            width: "100%",
            padding: "6px 8px",
            border: "1px solid #ddd",
            borderRadius: 6,
            fontSize: 12,
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          disabled={submittingNote || !noteBody.trim()}
          style={{
            marginTop: 4,
            padding: "6px 10px",
            fontSize: 12,
            border: "none",
            background: "#0ea5e9",
            color: "#fff",
            borderRadius: 6,
            cursor: submittingNote ? "not-allowed" : "pointer",
          }}
        >
          {submittingNote ? "…" : "Add note"}
        </button>
      </form>

      <div style={{ maxHeight: 200, overflowY: "auto" }}>
        {notes.length === 0 ? (
          <div style={{ fontSize: 12, color: "#888" }}>No notes yet.</div>
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              style={{
                fontSize: 11,
                padding: "6px 8px",
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: 6,
                marginBottom: 6,
              }}
            >
              <div style={{ color: "#92400e", marginBottom: 4 }}>
                {n.created_by ? "Team member • " : ""}
                {new Date(n.created_at).toLocaleString()}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
