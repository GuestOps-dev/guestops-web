"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "waiting_guest", label: "Waiting on Guest" },
  { value: "waiting_staff", label: "Waiting on Staff" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

function statusBadgeStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === "open")
    return { background: "#dcfce7", color: "#166534" };
  if (s === "waiting_guest" || s === "waiting_staff")
    return { background: "#dbeafe", color: "#1d4ed8" };
  if (s === "resolved" || s === "closed")
    return { background: "#fee2e2", color: "#7f1d1d" };
  return { background: "#f3f4f6", color: "#374151" };
}

type Props = {
  conversationId: string;
  propertyId: string;
  initialStatus: string | null;
};

export default function ConversationStatusSelect({
  conversationId,
  propertyId,
  initialStatus,
}: Props) {
  const [status, setStatus] = useState<string>(initialStatus ?? "open");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = e.target.value;
    const previous = status;
    setStatus(nextStatus);
    setError(null);
    setUpdating(true);

    try {
      const sb = getSupabaseBrowserClient();
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        setStatus(previous);
        return;
      }

      const res = await fetch(`/api/conversations/${conversationId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ property_id: propertyId, status: nextStatus }),
      });

      if (!res.ok) {
        const text = await res.text();
        const msg = (() => {
          try {
            const j = JSON.parse(text) as { error?: string };
            return j?.error ?? (text || res.statusText);
          } catch {
            return text || res.statusText;
          }
        })();
        setError(msg);
        setStatus(previous);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      setStatus(previous);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <select
        value={status}
        onChange={handleChange}
        disabled={updating}
        style={{
          fontSize: 12,
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid #e5e5e5",
          fontWeight: 500,
          ...statusBadgeStyle(status),
          cursor: updating ? "not-allowed" : "pointer",
          minWidth: 140,
        }}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {updating && (
        <span style={{ fontSize: 11, color: "#666" }}>Updating…</span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: "#b91c1c" }}>{error}</span>
      )}
    </div>
  );
}
