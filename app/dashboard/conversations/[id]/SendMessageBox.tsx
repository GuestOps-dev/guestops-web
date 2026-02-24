"use client";

import { useState } from "react";

export default function SendMessageBox({
  conversationId,
}: {
  conversationId: string;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          body: message,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Send failed (${res.status})`);
      }

      setMessage("");
      // Simple refresh to show new outbound row
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a reply..."
        rows={3}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      <button
        onClick={handleSend}
        disabled={sending}
        style={{
          marginTop: 8,
          padding: "8px 16px",
          borderRadius: 8,
          background: "#111",
          color: "white",
          border: "none",
          opacity: sending ? 0.6 : 1,
        }}
      >
        {sending ? "Sending..." : "Send SMS"}
      </button>

      {error && (
        <div style={{ marginTop: 8, color: "crimson", fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}