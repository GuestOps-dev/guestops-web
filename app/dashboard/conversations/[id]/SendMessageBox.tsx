"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function SendMessageBox({
  conversationId,
  propertyId,
}: {
  conversationId: string;
  propertyId: string;
}) {
  const router = useRouter();
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

      const res = await fetch(`/api/conversations/${conversationId}/outbound`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Send failed (${res.status}): ${text}`);
      }

      setMessage("");
      router.refresh();
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