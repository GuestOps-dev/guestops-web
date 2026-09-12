"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import QuickReplyPicker from "./QuickReplyPicker";

export default function SendMessageBox({
  conversationId,
  propertyId,
  recipientAvailable = true,
  welcomeDraft,
  welcomeVariables,
}: {
  conversationId: string;
  propertyId: string;
  recipientAvailable?: boolean;
  welcomeDraft?: string | null;
  welcomeVariables?: {
    guestName: string | null;
    propertyName: string;
    checkInDate: string | null;
    checkOutDate: string | null;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [a2pPending, setA2pPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pendingSendKey = useRef<string | null>(null);

  const sb = useMemo(() => getSupabaseBrowserClient(), []);

  function insertQuickReply(body: string) {
    setMessage((prev) => (prev ? prev + "\n" + body : body));
  }

  function insertWelcomeDraft() {
    if (!welcomeDraft) return;
    const firstName = welcomeVariables?.guestName?.trim().split(/\s+/)[0] ?? "there";
    const formatDate = (value: string | null | undefined) => value
      ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`))
      : "[Check-in Date]";
    const completed = welcomeDraft
      .replaceAll("[Guest First Name]", firstName)
      .replaceAll("[Guest Name]", welcomeVariables?.guestName?.trim() || "[Guest Name]")
      .replaceAll("[Property Name]", welcomeVariables?.propertyName || "[Property Name]")
      .replaceAll("[Check-in Date]", formatDate(welcomeVariables?.checkInDate))
      .replaceAll("[Check-out Date]", welcomeVariables?.checkOutDate ? formatDate(welcomeVariables.checkOutDate) : "[Check-out Date]");
    setMessage((prev) => (prev.trim() ? `${prev}\n\n${completed}` : completed));
    pendingSendKey.current = null;
  }

  async function handleSend() {
    setError(null);

    if (!recipientAvailable) return;

    const body = message.trim();
    if (!body) return;

    setSending(true);
    const idempotencyKey = pendingSendKey.current ?? crypto.randomUUID();
    pendingSendKey.current = idempotencyKey;
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
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Send failed (${res.status}): ${text}`);
      }

      setMessage("");
      pendingSendKey.current = null;
      router.refresh();
    } catch (e: any) {
      const message = e?.message || "Send failed";
      if (message.toLowerCase().includes("a2p campaign approval")) {
        setA2pPending(true);
        setError("SMS delivery is pending A2P campaign approval.");
      } else {
        setError(message);
      }
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!sending && !a2pPending && recipientAvailable) void handleSend();
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <textarea
            value={message}
            onKeyDown={handleComposerKeyDown}
            onChange={(e) => {
              setMessage(e.target.value);
              // A modified draft is a new message, not a retry of the old one.
              pendingSendKey.current = null;
            }}
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
            disabled={sending || a2pPending || !recipientAvailable}
          />
          {!recipientAvailable ? <span role="status" style={{ color: "#92400e", fontSize: 12 }}>
            A guest mobile number is needed before a message can be sent.
          </span> : null}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={a2pPending || !recipientAvailable}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#f9f9f9",
                fontSize: 12,
                cursor: a2pPending || !recipientAvailable ? "not-allowed" : "pointer",
                opacity: a2pPending || !recipientAvailable ? 0.6 : 1,
              }}
            >
              ⚡ Quick Replies
            </button>
            {welcomeDraft ? <button
              type="button"
              onClick={insertWelcomeDraft}
              disabled={a2pPending || !recipientAvailable}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontSize: 12,
                cursor: a2pPending || !recipientAvailable ? "not-allowed" : "pointer",
                opacity: a2pPending || !recipientAvailable ? 0.6 : 1,
              }}
            >
              Use welcome draft
            </button> : null}
            {error ? (
              <span role="alert" style={{ color: "crimson", fontSize: 12 }}>
                {error}
              </span>
            ) : null}
            <span style={{ color: "#64748b", fontSize: 12 }}>
              Ctrl/⌘ + Enter to send
            </span>
          </div>
        </div>
        <button
          onClick={handleSend}
          disabled={sending || a2pPending || !recipientAvailable}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: sending || a2pPending || !recipientAvailable ? "not-allowed" : "pointer",
          }}
        >
          {!recipientAvailable ? "Add mobile number" : a2pPending ? "Pending A2P approval" : sending ? "Sending…" : "Send"}
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
