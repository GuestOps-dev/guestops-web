"use client";

import { useMemo, useState } from "react";

export default function SendMessageBox({
  conversationId,
}: {
  conversationId: string;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const canSend = useMemo(() => !!message.trim() && !sending, [message, sending]);

  async function handleSend() {
    const body = message.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    setHint(null);

    try {
      // Per-send idempotency key prevents accidental double submit
      const idempotencyKey =
        (globalThis.crypto?.randomUUID?.() as string | undefined) ||
        `send:${Date.now()}:${Math.random().toString(16).slice(2)}`;

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
        throw new Error(text || `Send failed (${res.status})`);
      }

      // Clear input; realtime will insert the outbound row and then status updates will follow
      setMessage("");
      setHint("Queued — delivery status will update automatically.");
      setTimeout(() => setHint(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd+Enter (Mac) or Ctrl+Enter (Win) to send
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type a reply..."
        rows={3}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #ccc",
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#111",
            color: "white",
            border: "none",
            opacity: !canSend ? 0.5 : 1,
          }}
        >
          {sending ? "Sending..." : "Send SMS"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {hint || "Tip: Ctrl+Enter / ⌘+Enter to send"}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 8, color: "crimson", fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}