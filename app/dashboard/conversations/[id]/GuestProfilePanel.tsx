"use client";

import { useState, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

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

type Props = {
  guest: GuestRow;
  propertyId: string;
  initialNotes: GuestNoteRow[];
};

export default function GuestProfilePanel({
  guest,
  propertyId,
  initialNotes,
}: Props) {
  const [profile, setProfile] = useState<GuestRow>(guest);
  const [notes, setNotes] = useState<GuestNoteRow[]>(initialNotes);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(profile.full_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagsBusy, setTagsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = profile.tags ?? [];

  const refreshGuest = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const { data: session } = await sb.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          id: data.id,
          full_name: data.full_name ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          preferred_channel: data.preferred_channel ?? null,
          language_pref: data.language_pref ?? null,
          notes: data.notes ?? null,
          created_at: data.created_at,
          property_id: data.property_id,
          phone_e164: data.phone_e164 ?? null,
          tags: Array.isArray(data.tags) ? data.tags : [],
        });
      }
    } catch (e) {
      console.error("Refresh guest error:", e);
    }
  }, [guest.id]);

  const saveName = async () => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed === (profile.full_name ?? "")) return;
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingName(false);
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
      if (data.guest) {
        setProfile((p) => ({ ...p, tags: data.guest.tags ?? [] }));
      }
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
      if (data.guest) {
        setProfile((p) => ({ ...p, tags: data.guest.tags ?? [] }));
      }
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
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: "1px solid #eee",
        paddingLeft: 16,
        marginLeft: 16,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Guest profile
      </h3>

      {editingName ? (
        <div style={{ marginBottom: 12 }}>
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
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
        </div>
      ) : (
        <div
          style={{ marginBottom: 12, cursor: "pointer" }}
          onClick={() => {
            setEditingName(true);
            setNameValue(profile.full_name ?? "");
          }}
          title="Click to edit"
        >
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {profile.full_name || "— No name —"}
          </span>
          <span style={{ fontSize: 11, color: "#666", marginLeft: 6 }}>Edit</span>
        </div>
      )}

      <div style={{ fontSize: 12, color: "#444", marginBottom: 12 }}>
        <div>Phone: {profile.phone_e164 || profile.phone || "—"}</div>
        <div>Email: {profile.email || "—"}</div>
        <div>Channel: {profile.preferred_channel || "—"}</div>
        <div>Language: {profile.language_pref || "—"}</div>
      </div>

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
        <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>
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
                {n.created_by ? `${n.created_by.slice(0, 8)} • ` : ""}
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
