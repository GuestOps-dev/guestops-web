"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type QuickReplyRow = {
  id: string;
  title: string;
  body: string;
};

type Props = {
  propertyId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (body: string) => void;
};

export default function QuickReplyPicker({
  propertyId,
  open,
  onClose,
  onSelect,
}: Props) {
  const [list, setList] = useState<QuickReplyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const cacheRef = useRef<Record<string, QuickReplyRow[]>>({});

  const fetchList = useCallback(async () => {
    if (!propertyId) return;
    const cached = cacheRef.current[propertyId];
    if (cached) {
      setList(cached);
      return;
    }
    setLoading(true);
    try {
      const sb = getSupabaseBrowserClient();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setList([]);
        return;
      }
      const res = await fetch(
        `/api/quick-replies?propertyId=${encodeURIComponent(propertyId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setList([]);
        return;
      }
      const data2 = (await res.json()) as QuickReplyRow[];
      cacheRef.current = { ...cacheRef.current, [propertyId]: data2 ?? [] };
      setList(data2 ?? []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (open && propertyId) void fetchList();
  }, [open, propertyId, fetchList]);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.body && r.body.toLowerCase().includes(q))
    );
  }, [list, search]);

  const handleSelect = (row: QuickReplyRow) => {
    onSelect(row.body);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
      role="dialog"
      aria-label="Quick replies"
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          maxWidth: 480,
          width: "100%",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            Quick Replies
          </h3>
          <input
            type="text"
            placeholder="Search by title or body…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              fontSize: 14,
            }}
          />
        </div>
        <div
          style={{
            overflow: "auto",
            flex: 1,
            padding: 8,
            minHeight: 120,
          }}
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
              No quick replies found.
            </div>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: 12,
                  marginBottom: 4,
                  border: "1px solid #eee",
                  borderRadius: 8,
                  background: "#fafafa",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                {r.body ? (
                  <div
                    style={{
                      marginTop: 4,
                      color: "#555",
                      whiteSpace: "pre-wrap",
                      maxHeight: 60,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.body.slice(0, 120)}
                    {r.body.length > 120 ? "…" : ""}
                  </div>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
