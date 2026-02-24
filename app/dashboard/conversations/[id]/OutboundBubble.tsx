"use client";

import { useState } from "react";

type Props = {
  conversationId: string;
  outboundId: string;
  createdAt: string;
  body: string;
  status?: string | null;
  error?: string | null;
};

function canRetry(status?: string | null) {
  const s = (status || "").toLowerCase();
  return s === "failed" || s === "undelivered";
}

export default function OutboundBubble({
  conversationId,
  outboundId,
  createdAt,
  body,
  status,
  error,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const retryable = canRetry(status);

  async function onRetry() {
    setLoading(true);
    setLocalErr(null);

    try {
      // Idempotency key prevents double-tap duplicates for the same outboundId
      const idempotencyKey = `retry:${outboundId}`;

      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          body,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Retry failed (${res.status})`);
      }

      // Refresh to show new outbound row + updated status
      window.location.reload();
    } catch (e: any) {
      setLocalErr(e?.message || "Retry failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "#e8f1ff",
        padding: 10,
        borderRadius: 12,
        marginBottom: 8,
        maxWidth: "92%", // mobile friendly
        marginLeft: "auto",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span>OUTBOUND</span>
        <span>•</span>
        <span>{new Date(createdAt).toLocaleString()}</span>
        {status ? (
          <>
            <span>•</span>
            <span>{status}</span>
          </>
        ) : null}
      </div>

      <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{body}</div>

      {(error || localErr) && (
        <div style={{ fontSize: 12, color: "crimson", marginTop: 6 }}>
          Error: {localErr || error}
        </div>
      )}

      {retryable && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onRetry}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "#111",
              color: "white",
              border: "none",
              opacity: loading ? 0.6 : 1,
              width: "fit-content",
            }}
          >
            {loading ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}
    </div>
  );
}