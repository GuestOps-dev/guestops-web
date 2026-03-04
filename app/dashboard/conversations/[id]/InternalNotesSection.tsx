"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export type InternalNoteRow = {
  id: string;
  conversation_id: string;
  property_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export default function InternalNotesSection({
  conversationId,
  propertyId,
}: {
  conversationId: string;
  propertyId: string;
}) {
  const [notes, setNotes] = useState<InternalNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sb = getSupabaseBrowserClient();

  const fetchNotes = useCallback(async () => {
    if (!sb) return;
    setLoading(true);
    setError(null);
    try {
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setNotes([]);
        return;
      }
      const res = await fetch(
        `/api/conversations/${conversationId}/internal-notes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(`Failed to load notes: ${res.status} ${text}`);
        setNotes([]);
        return;
      }
      const data = (await res.json()) as InternalNoteRow[];
      setNotes(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load notes");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, sb]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !sb) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        return;
      }
      const res = await fetch(
        `/api/conversations/${conversationId}/internal-notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ property_id: propertyId, body: trimmed }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed: ${res.status}`);
      }
      setBody("");
      await fetchNotes();
    } catch (err: any) {
      setError(err?.message ?? "Failed to add note");
    } finally {
      setSubmitting(false);
    }
  }

  const sortedNotes = [...notes].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <section
      style={{
        marginTop: 24,
        padding: 16,
        background: "#fffbeb",
        border: "1px solid #fcd34d",
        borderRadius: 12,
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "#92400e",
          margin: 0,
          marginBottom: 12,
        }}
      >
        Internal Notes
      </h2>
      <p style={{ fontSize: 13, color: "#78350f", marginBottom: 12 }}>
        Private to staff; not visible to the guest.
      </p>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: 8,
            background: "#fee",
            borderRadius: 8,
            color: "#b91c1c",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleAddNote} style={{ marginBottom: 16 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          disabled={submitting}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #fcd34d",
            fontSize: 14,
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          style={{
            marginTop: 8,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            background: "#d97706",
            color: "#fff",
            fontSize: 13,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Adding…" : "Add note"}
        </button>
      </form>

      {loading ? (
        <p style={{ fontSize: 13, color: "#666" }}>Loading notes…</p>
      ) : sortedNotes.length === 0 ? (
        <p style={{ fontSize: 13, color: "#666" }}>No internal notes yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {sortedNotes.map((n) => (
            <li
              key={n.id}
              style={{
                padding: 10,
                marginBottom: 8,
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#92400e",
                  marginBottom: 4,
                }}
              >
                {n.created_by ? `${n.created_by.slice(0, 8)}` : "—"} •{" "}
                {new Date(n.created_at).toLocaleString()}
              </div>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
                {n.body}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
