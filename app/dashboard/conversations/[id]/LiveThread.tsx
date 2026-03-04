"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import OutboundBubble from "./OutboundBubble";

type InboundRow = {
  id: string;
  created_at: string;
  body: string;
};

type OutboundRow = {
  id: string;
  created_at: string;
  body: string;
  status?: string | null;
  error?: string | null;
};

type InternalNoteRow = {
  id: string;
  conversation_id: string;
  property_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

type Props = {
  conversationId: string;
  propertyId: string;
  initialInbound: InboundRow[];
  initialOutbound: OutboundRow[];
  initialInternalNotes?: InternalNoteRow[];
};

function normalizeBody(body: string) {
  return (body || "").trim().replace(/\s+/g, " ");
}

function isLegacyConfigError(err?: string | null) {
  const e = (err || "").toLowerCase();
  return e.includes("statuscallback") && e.includes("undefined/api/twilio/status");
}

function InternalNoteComposer({
  conversationId,
  propertyId,
  onAdded,
}: {
  conversationId: string;
  propertyId: string;
  onAdded: (note: InternalNoteRow) => void;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sb = getSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !sb) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("Not signed in");
        return;
      }
      const res = await fetch(`/api/conversations/${conversationId}/internal-notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ property_id: propertyId, body: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed: ${res.status}`);
      }
      const note = (await res.json()) as InternalNoteRow;
      onAdded(note);
      setBody("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to add note");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 8,
        padding: 8,
        background: "#fffbeb",
        border: "1px solid #fcd34d",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add internal note…"
          rows={1}
          disabled={submitting}
          style={{
            flex: 1,
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid #fcd34d",
            fontSize: 13,
            resize: "vertical",
            minHeight: 32,
          }}
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "none",
            background: "#d97706",
            color: "#fff",
            fontSize: 12,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "…" : "Add note"}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#b91c1c" }}>{error}</div>
      )}
    </form>
  );
}

export default function LiveThread({
  conversationId,
  propertyId,
  initialInbound,
  initialOutbound,
  initialInternalNotes = [],
}: Props) {
  const [inbound, setInbound] = useState<InboundRow[]>(initialInbound);
  const [outbound, setOutbound] = useState<OutboundRow[]>(initialOutbound);
  const [internalNotes, setInternalNotes] = useState<InternalNoteRow[]>(initialInternalNotes);
  const [realtimeReady, setRealtimeReady] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(
    initialInbound.length + initialOutbound.length + initialInternalNotes.length
  );
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to bottom when a new message or note is appended
  useEffect(() => {
    const total = inbound.length + outbound.length + internalNotes.length;
    if (total > prevMessageCountRef.current) {
      prevMessageCountRef.current = total;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [inbound.length, outbound.length, internalNotes.length]);

  // Supabase Realtime: inbound_messages (filter conversation_id) → append to list; cleanup on unmount
  useEffect(() => {
    const sb = getSupabaseBrowserClient();

    if (!sb) {
      setRealtimeReady(false);
      console.error(
        "Realtime disabled: missing/empty NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
      return;
    }

    setRealtimeReady(true);

    const scheduleMarkRead = () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = setTimeout(async () => {
        markReadTimerRef.current = null;
        try {
          const { data } = await sb.auth.getSession();
          if (!data.session?.access_token) return;
          await fetch(`/api/conversations/${conversationId}/read`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ property_id: propertyId }),
          });
        } catch (e) {
          console.error("Mark read on new inbound:", e);
        }
      }, 500);
    };

    const channel = sb
      .channel(`thread:${conversationId}`)
      // inbound inserts: append to thread and mark read (user is viewing)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inbound_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;
          setInbound((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const next = [
              ...prev,
              { id: row.id, created_at: row.created_at, body: row.body },
            ];
            next.sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            return next;
          });
          scheduleMarkRead();
        }
      )
      // outbound inserts
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "outbound_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;
          setOutbound((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const next = [
              ...prev,
              {
                id: row.id,
                created_at: row.created_at,
                body: row.body,
                status: row.status,
                error: row.error,
              },
            ];
            next.sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            return next;
          });
        }
      )
      // outbound updates (status flips)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "outbound_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;
          setOutbound((prev) => {
            const next = prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    status: row.status,
                    error: row.error,
                    created_at: row.created_at ?? m.created_at,
                    body: row.body ?? m.body,
                  }
                : m
            );
            next.sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "internal_notes",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;
          setInternalNotes((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev;
            return [...prev, {
              id: row.id,
              conversation_id: row.conversation_id,
              property_id: row.property_id,
              body: row.body ?? "",
              created_by: row.created_by ?? null,
              created_at: row.created_at,
            }].sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Supabase realtime channel error:", conversationId);
        }
      });

    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
      channel.unsubscribe();
      sb.removeChannel(channel);
    };
  }, [conversationId, propertyId]);

  // Apply legacy filtering
  const legacyCount = useMemo(
    () => outbound.filter((o) => isLegacyConfigError(o.error)).length,
    [outbound]
  );

  const filteredOutbound = useMemo(
    () => outbound.filter((o) => !isLegacyConfigError(o.error)),
    [outbound]
  );

  // Collapse outbound attempts by body, keeping latest + older list
  const collapsedOutbound = useMemo(() => {
    const grouped = new Map<string, { latest: OutboundRow; older: OutboundRow[] }>();

    for (const row of filteredOutbound) {
      const key = normalizeBody(row.body);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { latest: row, older: [] });
        continue;
      }

      const latestTime = new Date(existing.latest.created_at).getTime();
      const rowTime = new Date(row.created_at).getTime();

      if (rowTime >= latestTime) {
        existing.older.push(existing.latest);
        existing.latest = row;
      } else {
        existing.older.push(row);
      }

      existing.older.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return Array.from(grouped.values()).map((g) => ({
      latest: g.latest,
      older: g.older,
    }));
  }, [filteredOutbound]);

  // Merge inbound + outbound + internal notes into a single timeline (sort by created_at)
  const timeline = useMemo(() => {
    const outLatest = collapsedOutbound.map((g) => ({
      kind: "outbound" as const,
      id: g.latest.id,
      created_at: g.latest.created_at,
      body: g.latest.body,
      status: g.latest.status,
      error: g.latest.error,
      olderAttempts: g.older,
    }));

    const inItems = inbound.map((m) => ({
      kind: "inbound" as const,
      id: m.id,
      created_at: m.created_at,
      body: m.body,
    }));

    const noteItems = internalNotes.map((n) => ({
      kind: "internal" as const,
      id: n.id,
      created_at: n.created_at,
      body: n.body,
      created_by: n.created_by,
    }));

    return [...inItems, ...outLatest, ...noteItems].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [inbound, collapsedOutbound, internalNotes]);

  return (
    <>
      {!realtimeReady && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#fee",
            border: "1px solid #f99",
            color: "#7f1d1d",
            fontSize: 13,
          }}
        >
          Realtime disabled: missing/empty NEXT_PUBLIC_SUPABASE_URL or
          NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel env vars.
        </div>
      )}

      {legacyCount > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#7c2d12",
            fontSize: 13,
          }}
        >
          System note: {legacyCount} earlier outbound attempt(s) failed due to a
          configuration issue that has since been fixed.
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {timeline.map((m) => {
          if (m.kind === "outbound") {
            return (
              <OutboundBubble
                key={`out-${m.id}`}
                conversationId={conversationId}
                outboundId={m.id}
                createdAt={m.created_at}
                body={m.body}
                status={m.status}
                error={m.error}
                olderAttempts={m.olderAttempts}
              />
            );
          }

          if (m.kind === "internal") {
            return (
              <div
                key={`note-${m.id}`}
                style={{
                  background: "#fef3c7",
                  border: "1px solid #f59e0b",
                  padding: 8,
                  borderRadius: 8,
                  marginBottom: 8,
                  maxWidth: "92%",
                  marginLeft: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#92400e",
                    marginRight: 8,
                  }}
                >
                  INTERNAL
                </span>
                <span style={{ fontSize: 11, color: "#78350f" }}>
                  {m.created_by ? `${m.created_by.slice(0, 8)} • ` : ""}
                  {new Date(m.created_at).toLocaleString()}
                </span>
                <div style={{ marginTop: 4, whiteSpace: "pre-wrap", fontSize: 13 }}>
                  {m.body}
                </div>
              </div>
            );
          }

          return (
            <div
              key={`in-${m.id}`}
              style={{
                background: "#f2f2f2",
                padding: 10,
                borderRadius: 12,
                marginBottom: 8,
                maxWidth: "92%",
                marginLeft: 0,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                INBOUND • {new Date(m.created_at).toLocaleString()}
              </div>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>
          );
        })}
        <InternalNoteComposer
          conversationId={conversationId}
          propertyId={propertyId}
          onAdded={(note) =>
            setInternalNotes((prev) =>
              [...prev, note].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
            )
          }
        />
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </>
  );
}