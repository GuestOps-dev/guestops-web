"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "vip", label: "VIP" },
  { value: "urgent", label: "Urgent" },
];

function priorityBadgeStyle(priority: string): React.CSSProperties {
  const p = priority.toLowerCase();
  if (p === "urgent") return { background: "#fee2e2", color: "#b91c1c" };
  if (p === "vip") return { background: "#ede9fe", color: "#5b21b6" };
  return { background: "#f3f4f6", color: "#6b7280" };
}

type Props = {
  conversationId: string;
  propertyId: string;
  initialPriority: string | null;
};

export default function ConversationPrioritySelect({
  conversationId,
  propertyId,
  initialPriority,
}: Props) {
  const [priority, setPriority] = useState<string>(initialPriority ?? "normal");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextPriority = e.target.value;
    const previous = priority;
    setPriority(nextPriority);
    setError(null);
    setUpdating(true);

    try {
      const sb = getSupabaseBrowserClient();
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        setPriority(previous);
        return;
      }

      const res = await fetch(`/api/conversations/${conversationId}/priority`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ property_id: propertyId, priority: nextPriority }),
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
        setPriority(previous);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      setPriority(previous);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <select
        value={priority}
        onChange={handleChange}
        disabled={updating}
        style={{
          fontSize: 12,
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid #e5e5e5",
          fontWeight: 500,
          ...priorityBadgeStyle(priority),
          cursor: updating ? "not-allowed" : "pointer",
          minWidth: 100,
        }}
      >
        {PRIORITY_OPTIONS.map((opt) => (
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
