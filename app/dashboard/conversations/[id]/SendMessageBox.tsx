"use client";

import { useState } from "react";

export default function SendMessageBox({
  conversationId,
}: {
  conversationId: string;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;

    setSending(true);

    await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message }),
    });

    setMessage("");
    setSending(false);
    window.location.reload();
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
    </div>
  );
}