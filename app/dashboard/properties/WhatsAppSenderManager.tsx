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
  const [connecting, setConnecting] = useState(false);
  const [checkingGroups, setCheckingGroups] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupsEndpointReachable, setGroupsEndpointReachable] = useState<boolean | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
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

  async function connectMetaDelivery() {
    if (!propertyId) return;
    setConnecting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/whatsapp-sender/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to connect Meta WhatsApp.");
      setMessage("Meta WhatsApp delivery is connected for this sender.");
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to connect Meta WhatsApp.");
    } finally {
      setConnecting(false);
    }
  }

  async function checkGroupsApi() {
    if (!propertyId) return;
    setCheckingGroups(true);
    setMessage(null);
    setInviteLink(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/whatsapp-sender/groups-test`, { headers: { Authorization: `Bearer ${await token()}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to check Meta Groups API.");
      setGroupsEndpointReachable(result.reachable === true);
      const activeGroups = Number.isFinite(result.activeGroups) ? result.activeGroups : 0;
      setMessage(result.reachable ? `Meta’s Groups endpoint is reachable (${activeGroups} active ${activeGroups === 1 ? "group" : "groups"}). Create a private test group to verify eligibility.` : (result.error ?? "Meta Groups API is not available for this sender yet."));
    } catch (error: any) {
      setGroupsEndpointReachable(false);
      setMessage(error?.message ?? "Unable to check Meta Groups API.");
    } finally {
      setCheckingGroups(false);
    }
  }

  async function createPrivateTestGroup() {
    if (!propertyId) return;
    setCreatingGroup(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/whatsapp-sender/groups-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ confirm: "CREATE_PRIVATE_TEST_GROUP" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create Meta test group.");
      setInviteLink(result.inviteLink ?? null);
      setMessage(result.message ?? "Private test group created.");
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to create Meta test group.");
    } finally {
      setCreatingGroup(false);
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
      {message ? <p role="status" style={{ margin: 0, color: message.startsWith("WhatsApp sender saved") || message.startsWith("Meta WhatsApp delivery") || message.startsWith("Meta’s Groups endpoint is reachable") || message.startsWith("Private test group created") ? "#166534" : "#b91c1c", fontSize: 13 }}>{message}</p> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button type="button" onClick={() => void save()} disabled={saving || loading || !number.trim()} style={{ padding: "8px 11px", border: "none", borderRadius: 8, background: "#111", color: "#fff", cursor: saving ? "wait" : "pointer" }}>{saving ? "Saving…" : "Save WhatsApp sender"}</button><button type="button" onClick={() => void connectMetaDelivery()} disabled={connecting || loading || !number.trim()} style={{ padding: "8px 11px", border: "1px solid #0f766e", borderRadius: 8, background: "#ecfdf5", color: "#0f766e", cursor: connecting ? "wait" : "pointer" }}>{connecting ? "Connecting…" : "Reconnect Meta delivery"}</button><button type="button" onClick={() => void checkGroupsApi()} disabled={checkingGroups || loading || !number.trim()} style={{ padding: "8px 11px", border: "1px solid #4338ca", borderRadius: 8, background: "#eef2ff", color: "#3730a3", cursor: checkingGroups ? "wait" : "pointer" }}>{checkingGroups ? "Checking…" : "Check Groups API"}</button>{groupsEndpointReachable ? <button type="button" onClick={() => void createPrivateTestGroup()} disabled={creatingGroup} style={{ padding: "8px 11px", border: "1px solid #7c2d12", borderRadius: 8, background: "#fff7ed", color: "#9a3412", cursor: creatingGroup ? "wait" : "pointer" }}>{creatingGroup ? "Creating…" : "Create private test group"}</button> : null}</div>
      {inviteLink ? <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>Invite link: <a href={inviteLink} target="_blank" rel="noreferrer">Open the private WhatsApp test group</a></p> : null}
    </section>
  );
}
