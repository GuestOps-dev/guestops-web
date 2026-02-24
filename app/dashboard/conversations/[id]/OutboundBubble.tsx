"use client";

import { useMemo, useState } from "react";

type OlderAttempt = {
  id: string;
  created_at: string;
  body: string;
  status?: string | null;
  error?: string | null;
};

type Props = {
  conversationId: string;
  outboundId: string;
  createdAt: string;
  body: string;
  status?: string | null;
  error?: string | null;
  olderAttempts?: OlderAttempt[];
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
  olderAttempts = [],
}: Props) {
  const [loading, setLoading] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const retryable = canRetry(status);

  const olderCount = olderAttempts.length;

  const olderSorted = useMemo(() => {
    return [...olderAttempts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [olderAttempts]);

  async function onRetry() {
    setLoading(true);
    setLocalErr(null);

    try {
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
        maxWidth: "92%",
        marginLeft: "auto",
      }}
    >
      <div
        style={{
          fontSize: 12,
          opacity: 0.7,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

        {olderCount > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              border: "none",
              background: "transparent",
              color: "#111",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 12,
              padding: 0,
            }}
          >
            {expanded ? "Hide" : `View ${olderCount} earlier`}
          </button>
        )}
      </div>

      <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{body}</div>

      {(error || localErr) && (
        <div style={{ fontSize: 12, color: "crimson", marginTop: 6 }}>
          Error: {localErr || error}
        </div>
      )}

      {expanded && olderSorted.length > 0 && (
        <div style={{ marginTop: 10, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            Earlier attempts
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {olderSorted.map((a) => (
              <div
                key={a.id}
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(a.created_at).toLocaleString()}
                  {a.status ? ` • ${a.status}` : ""}
                </div>
                <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{a.body}</div>
                {a.error && (
                  <div style={{ fontSize: 12, color: "crimson", marginTop: 6 }}>
                    Error: {a.error}
                  </div>
                )}
              </div>
            ))}
          </div>
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