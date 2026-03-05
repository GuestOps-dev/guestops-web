"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "awaiting_team", label: "Inbox" },
  { value: "waiting_guest", label: "Waiting on Guest" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

function statusBadgeStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === "awaiting_team") return { background: "#dcfce7", color: "#166534" };
  if (s === "waiting_guest") return { background: "#dbeafe", color: "#1d4ed8" };
  if (s === "active") return { background: "#e0e7ff", color: "#3730a3" };
  if (s === "closed") return { background: "#fee2e2", color: "#7f1d1d" };
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
  const [status, setStatus] = useState<string>(initialStatus ?? "awaiting_team");
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

  async function setStatusAction(newStatus: string) {
    const previous = status;
    setStatus(newStatus);
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
        body: JSON.stringify({ property_id: propertyId, status: newStatus }),
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      setStatus(previous);
    } finally {
      setUpdating(false);
    }
  }

  const isClosed = status === "closed";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
      {!isClosed ? (
        <button
          type="button"
          onClick={() => void setStatusAction("closed")}
          disabled={updating}
          style={{
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#f9fafb",
            cursor: updating ? "not-allowed" : "pointer",
          }}
        >
          Mark Closed
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void setStatusAction("awaiting_team")}
          disabled={updating}
          style={{
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#f9fafb",
            cursor: updating ? "not-allowed" : "pointer",
          }}
        >
          Reopen
        </button>
      )}
      {updating && (
        <span style={{ fontSize: 11, color: "#666" }}>Updating…</span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: "#b91c1c" }}>{error}</span>
      )}
    </div>
  );
}
