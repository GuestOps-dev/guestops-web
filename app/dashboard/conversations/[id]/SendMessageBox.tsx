"use client";

import { useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function SendMessageBox({
  conversationId,
  propertyId,
}: {
  conversationId: string;
  propertyId: string;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sb = useMemo(() => getSupabaseBrowserClient(), []);

  async function handleSend() {
    setError(null);

    const body = message.trim();
    if (!body) return;

    setSending(true);
    try {
      const { data, error: sessionErr } = await sb.auth.getSession();
      if (sessionErr || !data.session?.access_token) {
        throw new Error("No Supabase session");
      }

      const token = data.session.access_token;

      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-idempotency-key":
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          property_id: propertyId,
          body,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Send failed (${res.status}): ${text}`);
      }

      setMessage("");
    } catch (e: any) {
      setError(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a reply…"
        style={{
          flex: 1,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
        }}
        disabled={sending}
      />
      <button
        onClick={handleSend}
        disabled={sending}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #111",
          background: "#111",
          color: "white",
          cursor: sending ? "not-allowed" : "pointer",
        }}
      >
        {sending ? "Sending…" : "Send"}
      </button>
      {error ? (
        <div style={{ marginLeft: 8, color: "crimson", fontSize: 12 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}