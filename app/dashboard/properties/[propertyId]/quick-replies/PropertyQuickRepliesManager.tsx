"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export type QuickReplyRow = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  is_active?: boolean;
  created_at?: string;
};

type Props = {
  propertyId: string;
  propertyName: string;
};

export default function PropertyQuickRepliesManager({
  propertyId,
  propertyName,
}: Props) {
  const [list, setList] = useState<QuickReplyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [isActiveNew, setIsActiveNew] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editActive, setEditActive] = useState(true);

  const sb = useMemo(() => getSupabaseBrowserClient(), []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setList([]);
        return;
      }
      const res = await fetch(
        `/api/quick-replies?propertyId=${encodeURIComponent(propertyId)}&activeOnly=false`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(`Failed to load: ${res.status} ${text}`);
        setList([]);
        return;
      }
      const data2 = (await res.json()) as QuickReplyRow[];
      setList(data2 ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId, sb]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setError("Title and body are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/quick-replies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          property_id: propertyId,
          title: t,
          body: b,
          category: category.trim() || null,
          is_active: isActiveNew,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Create failed: ${res.status}`);
      }
      setTitle("");
      setBody("");
      setCategory("");
      setIsActiveNew(true);
      await fetchList();
    } catch (e: any) {
      setError(e?.message ?? "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id: string) {
    const t = editTitle.trim();
    const b = editBody.trim();
    if (!t || !b) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/quick-replies/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: t,
          body: b,
          category: editCategory.trim() || null,
          is_active: editActive,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed: ${res.status}`);
      }
      setEditingId(null);
      await fetchList();
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this quick reply?")) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/quick-replies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed: ${res.status}`);
      }
      await fetchList();
    } catch (e: any) {
      setError(e?.message ?? "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(r: QuickReplyRow) {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/quick-replies/${r.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !r.is_active }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed: ${res.status}`);
      }
      await fetchList();
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {error && (
        <div
          style={{
            padding: 12,
            background: "#fee",
            border: "1px solid #fcc",
            borderRadius: 8,
            color: "#c00",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 16,
          border: "1px solid #eee",
          borderRadius: 12,
          background: "#fafafa",
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>New quick reply</h2>
        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
            placeholder="e.g. Check-out time"
          />
        </div>
        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
            Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
            placeholder="Message text…"
          />
        </div>
        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
            Category (optional)
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
            placeholder="e.g. Check-out"
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={isActiveNew}
            onChange={(e) => setIsActiveNew(e.target.checked)}
          />
          Active
        </label>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: "#111",
            color: "#fff",
            cursor: submitting ? "not-allowed" : "pointer",
            width: "fit-content",
          }}
        >
          {submitting ? "Creating…" : "Create"}
        </button>
      </form>

      <div>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Quick replies</h2>
        {loading ? (
          <p style={{ color: "#666" }}>Loading…</p>
        ) : list.length === 0 ? (
          <p style={{ color: "#666" }}>No quick replies yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {list.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  border: "1px solid #eee",
                  borderRadius: 8,
                  background: r.is_active === false ? "#f5f5f5" : "#fff",
                }}
              >
                {editingId === r.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                      }}
                      placeholder="Title"
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={2}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                      }}
                      placeholder="Body"
                    />
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                      }}
                      placeholder="Category (optional)"
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                      />
                      Active
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleUpdate(r.id)}
                        disabled={submitting}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "none",
                          background: "#111",
                          color: "#fff",
                          cursor: submitting ? "not-allowed" : "pointer",
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #ddd",
                          background: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <div>
                        <strong>{r.title}</strong>
                        {r.category && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 12,
                              color: "#666",
                            }}
                          >
                            {r.category}
                          </span>
                        )}
                        {r.is_active === false && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 12,
                              color: "#999",
                            }}
                          >
                            (inactive)
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={r.is_active !== false}
                            onChange={() => toggleActive(r)}
                            disabled={submitting}
                          />
                          Active
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r.id);
                            setEditTitle(r.title);
                            setEditBody(r.body);
                            setEditCategory(r.category ?? "");
                            setEditActive(r.is_active !== false);
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          disabled={submitting}
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#fff",
                            color: "#c00",
                            cursor: submitting ? "not-allowed" : "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {r.body && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          color: "#555",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {r.body}
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
