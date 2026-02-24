"use client";

import { useEffect, useMemo, useState } from "react";
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

type Props = {
  conversationId: string;
  initialInbound: InboundRow[];
  initialOutbound: OutboundRow[];
};

function normalizeBody(body: string) {
  return (body || "").trim().replace(/\s+/g, " ");
}

function isLegacyConfigError(err?: string | null) {
  const e = (err || "").toLowerCase();
  return e.includes("statuscallback") && e.includes("undefined/api/twilio/status");
}

export default function LiveThread({
  conversationId,
  initialInbound,
  initialOutbound,
}: Props) {
  const [inbound, setInbound] = useState<InboundRow[]>(initialInbound);
  const [outbound, setOutbound] = useState<OutboundRow[]>(initialOutbound);
  const [realtimeReady, setRealtimeReady] = useState(true);

  // Subscribe to realtime changes
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

    const channel = sb
      .channel(`thread:${conversationId}`)
      // inbound inserts
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
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Supabase realtime channel error:", conversationId);
        }
      });

    return () => {
      sb.removeChannel(channel);
    };
  }, [conversationId]);

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

  // Merge inbound + outbound latest into a single timeline list
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

    return [...inItems, ...outLatest].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [inbound, collapsedOutbound]);

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
      </div>
    </>
  );
}