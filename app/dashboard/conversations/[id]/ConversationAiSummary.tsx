"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function ConversationAiSummary({ conversationId }: { conversationId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!data.session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch(`/api/conversations/${conversationId}/ai-summary`, { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.summary !== "string") throw new Error(result?.error || "Unable to create summary");
      setSummary(result.summary);
    } catch (e: any) { setError(e?.message || "Unable to create summary"); }
    finally { setLoading(false); }
  }

  return <section style={{ marginBottom: 12, border: "1px solid #ddd6fe", borderRadius: 10, padding: "9px 11px", background: "#fafaff" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}><strong style={{ fontSize: 13, color: "#4c1d95" }}>AI conversation summary</strong><button type="button" onClick={() => void generate()} disabled={loading} style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #c4b5fd", background: "#fff", color: "#6d28d9", fontSize: 12 }}>{loading ? "Summarizing…" : summary ? "Refresh" : "Summarize"}</button></div>
    {summary ? <p style={{ whiteSpace: "pre-line", fontSize: 13, lineHeight: 1.5, margin: "8px 0 0", color: "#334155" }}>{summary}</p> : <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0" }}>Internal only. It never sends a message.</p>}
    {error ? <p role="alert" style={{ color: "#b91c1c", fontSize: 12, margin: "7px 0 0" }}>{error}</p> : null}
  </section>;
}
