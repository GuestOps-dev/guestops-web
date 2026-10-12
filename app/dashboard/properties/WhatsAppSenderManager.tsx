"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { usePropertyWorkspace } from "../PropertyWorkspaceProvider";

export default function WhatsAppSenderManager() {
  const { selectedPropertyId } = usePropertyWorkspace();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const propertyId = selectedPropertyId === "all" ? null : selectedPropertyId;
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const token = useCallback(async () => {
    const { data } = await client.auth.getSession();
    if (!data.session?.access_token) throw new Error("Please sign in again.");
    return data.session.access_token;
  }, [client]);

  useEffect(() => {
    if (!propertyId) {
      setNumber("");
      return;
    }
    void (async () => {
      setLoading(true);
      setMessage(null);
      try {
        const response = await fetch(`/api/properties/${propertyId}/whatsapp-sender`, { headers: { Authorization: `Bearer ${await token()}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load sender.");
        setNumber(result.e164 ?? "");
      } catch (error: any) {
        setMessage(error?.message ?? "Unable to load sender.");
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId, token]);

  async function save() {
    if (!propertyId) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/whatsapp-sender`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ e164: number }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save sender.");
      setNumber(result.e164);
      setMessage("WhatsApp sender saved for this property.");
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to save sender.");
    } finally {
      setSaving(false);
    }
  }

  if (!propertyId) return null;
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fafafa", display: "grid", gap: 10 }}>
      <div>
        <h2 style={{ fontSize: 16, margin: 0 }}>WhatsApp sender</h2>
        <p style={{ margin: "5px 0 0", color: "#52525b", fontSize: 13, lineHeight: 1.5 }}>Assign the business WhatsApp number that should route inbound guest messages to this house. A number can belong to only one property.</p>
      </div>
      <label style={{ fontSize: 12, display: "grid", gap: 4 }}>Business WhatsApp number<input value={number} disabled={loading} onChange={(event) => setNumber(event.target.value)} placeholder="+1 609…" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }} /></label>
      {message ? <p role="status" style={{ margin: 0, color: message.startsWith("WhatsApp sender saved") ? "#166534" : "#b91c1c", fontSize: 13 }}>{message}</p> : null}
      <div><button type="button" onClick={() => void save()} disabled={saving || loading || !number.trim()} style={{ padding: "8px 11px", border: "none", borderRadius: 8, background: "#111", color: "#fff", cursor: saving ? "wait" : "pointer" }}>{saving ? "Saving…" : "Save WhatsApp sender"}</button></div>
    </section>
  );
}
