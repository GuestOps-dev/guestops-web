"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  id: string;
  guest_number: string;
  channel: string;
  status: string;
  last_message_at: string | null;
  priority: string | null;
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function OpsInboxRow({
  id,
  guest_number,
  channel,
  status,
  last_message_at,
  priority,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(newStatus: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/conversations/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const isClosed = status === "closed";

  return (
    <div
      style={{
        borderTop: "1px solid #eee",
        padding: "12px 0",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{guest_number}</span>
        <span style={{ fontSize: 13, color: "#666" }}>{channel}</span>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
            background: isClosed ? "#e5e7eb" : "#dbeafe",
            color: isClosed ? "#374151" : "#1d4ed8",
          }}
        >
          {status === "awaiting_team"
            ? "Inbox"
            : status === "waiting_guest"
              ? "Waiting"
              : "Resolved"}
        </span>
        {priority ? (
          <span style={{ fontSize: 12, color: "#666" }}>Priority: {priority}</span>
        ) : null}
      </div>
      <div style={{ fontSize: 12, color: "#555" }}>
        Last message: {formatTime(last_message_at)}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link
          href={`/dashboard/conversations/${id}`}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#f9fafb",
            fontSize: 13,
            textDecoration: "none",
            color: "#111",
          }}
        >
          Open
        </Link>
        {isClosed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("awaiting_team")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f9fafb",
              fontSize: 13,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "…" : "Reopen"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("closed")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f9fafb",
              fontSize: 13,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "…" : "Mark Resolved"}
          </button>
        )}
      </div>
    </div>
  );
}
