"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Task = { id: string; title: string; status: "open" | "completed"; due_at: string | null };

async function authHeaders() {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Your session expired. Please sign in again.");
  return { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" };
}

function dueLabel(value: string | null) {
  if (!value) return "No due date";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "No due date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due ${due.toLocaleDateString()}`;
}

export default function ConversationTasks({ propertyId, conversationId, guestId, bookingId }: {
  propertyId: string;
  conversationId: string;
  guestId?: string | null;
  bookingId?: string | null;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams({ propertyId, conversationId });
      const res = await fetch(`/api/tasks?${params}`, { headers });
      if (!res.ok) throw new Error("Unable to load follow-ups");
      setTasks(await res.json());
    } catch (e: any) {
      setError(e?.message ?? "Unable to load follow-ups");
    }
  }

  useEffect(() => { void load(); }, [propertyId, conversationId]);

  async function addTask() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true); setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/tasks", {
        method: "POST", headers,
        body: JSON.stringify({ property_id: propertyId, conversation_id: conversationId, guest_id: guestId, booking_id: bookingId, title: trimmed }),
      });
      if (!res.ok) throw new Error("Unable to create follow-up");
      const task = await res.json();
      setTasks((previous) => [task, ...previous]);
      setTitle("");
    } catch (e: any) { setError(e?.message ?? "Unable to create follow-up"); }
    finally { setBusy(false); }
  }

  async function toggle(task: Task) {
    setBusy(true); setError(null);
    try {
      const headers = await authHeaders();
      const nextStatus = task.status === "completed" ? "open" : "completed";
      const res = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers, body: JSON.stringify({ property_id: propertyId, status: nextStatus }) });
      if (!res.ok) throw new Error("Unable to update follow-up");
      const updated = await res.json();
      setTasks((previous) => previous.map((item) => item.id === updated.id ? updated : item));
    } catch (e: any) { setError(e?.message ?? "Unable to update follow-up"); }
    finally { setBusy(false); }
  }

  const openTasks = tasks.filter((task) => task.status === "open");
  return (
    <section style={{ marginTop: 18, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Follow-ups{openTasks.length ? ` · ${openTasks.length}` : ""}</h3>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addTask(); }} placeholder="Add a follow-up…" maxLength={280} style={{ minWidth: 0, flex: 1, padding: "7px 8px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12 }} />
        <button type="button" disabled={busy || !title.trim()} onClick={() => void addTask()} style={{ border: "1px solid #2563eb", borderRadius: 8, background: "#2563eb", color: "#fff", padding: "7px 9px", fontSize: 12, cursor: "pointer" }}>Add</button>
      </div>
      {error ? <p style={{ color: "#b91c1c", fontSize: 12, marginTop: 7 }}>{error}</p> : null}
      {tasks.length ? <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
        {tasks.map((task) => <label key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: task.status === "completed" ? "#64748b" : "#0f172a" }}>
          <input type="checkbox" checked={task.status === "completed"} disabled={busy} onChange={() => void toggle(task)} style={{ marginTop: 2 }} />
          <span style={{ textDecoration: task.status === "completed" ? "line-through" : "none" }}>{task.title}<small style={{ display: "block", color: task.status === "open" && dueLabel(task.due_at) === "Overdue" ? "#c2410c" : "#64748b", marginTop: 2 }}>{dueLabel(task.due_at)}</small></span>
        </label>)}
      </div> : <p style={{ color: "#64748b", fontSize: 12, marginTop: 9 }}>No follow-ups yet.</p>}
    </section>
  );
}
