"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import QuickReplyPicker from "./QuickReplyPicker";

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
  const [pickerOpen, setPickerOpen] = useState(false);

  const sb = useMemo(() => getSupabaseBrowserClient(), []);

  function insertQuickReply(body: string) {
    setMessage((prev) => (prev ? prev + "\n" + body : body));
  }

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
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a reply…"
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontSize: 14,
              resize: "vertical",
              minHeight: 44,
            }}
            disabled={sending}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#f9f9f9",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ⚡ Quick Replies
            </button>
            {error ? (
              <span style={{ color: "crimson", fontSize: 12 }}>{error}</span>
            ) : null}
          </div>
        </div>
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
      </div>
      <QuickReplyPicker
        propertyId={propertyId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={insertQuickReply}
      />
    </>
  );
}