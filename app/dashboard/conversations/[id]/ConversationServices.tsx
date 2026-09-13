"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type ServiceType = { id: string; name: string; category: string | null; default_vendor_id: string | null };
type Vendor = { id: string; name: string; vendor_type: string };
type Experience = {
  id: string; status: string; start_at: string | null; pickup_location: string | null; internal_notes_private: string | null;
  experience_types: { name: string } | null; vendors: { name: string } | null;
  vendor_requests: Array<{ id: string; status: string; sent_at: string }> | null;
  vendor_coordination_groups: Array<{ id: string; display_name: string; draft_message: string; status: string }> | null;
};

async function headers() {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Your session expired. Please sign in again.");
  return { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" };
}

export default function ConversationServices({ propertyId, bookingId }: { propertyId: string; bookingId?: string | null }) {
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Experience[]>([]);
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [newType, setNewType] = useState("");
  const [vendorChoices, setVendorChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!bookingId) return;
    try {
      const auth = await headers();
      const [typeResponse, vendorResponse, experienceResponse] = await Promise.all([
        fetch(`/api/experience-types?propertyId=${encodeURIComponent(propertyId)}`, { headers: auth }),
        fetch(`/api/vendors?propertyId=${encodeURIComponent(propertyId)}&activeOnly=true`, { headers: auth }),
        fetch(`/api/experiences?propertyId=${encodeURIComponent(propertyId)}&bookingId=${encodeURIComponent(bookingId)}`, { headers: auth }),
      ]);
      if (!typeResponse.ok || !vendorResponse.ok || !experienceResponse.ok) throw new Error("Unable to load experiences");
      setTypes(await typeResponse.json()); setVendors(await vendorResponse.json()); setItems(await experienceResponse.json());
    } catch (e: any) { setError(e?.message ?? "Unable to load experiences"); }
  }

  useEffect(() => { void load(); }, [propertyId, bookingId]);

  async function addType() {
    const name = newType.trim();
    if (!name || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/experience-types", { method: "POST", headers: await headers(), body: JSON.stringify({ property_id: propertyId, name }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to add experience");
      setTypes((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setServiceTypeId(data.id); setNewType("");
    } catch (e: any) { setError(e?.message ?? "Unable to add experience"); } finally { setBusy(false); }
  }

  async function createService() {
    if (!bookingId || !serviceTypeId || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/experiences", {
        method: "POST", headers: await headers(),
        body: JSON.stringify({ property_id: propertyId, booking_id: bookingId, experience_type_id: serviceTypeId, vendor_id: vendorId || null, start_at: startsAt || null, pickup_location: pickupLocation || null, internal_notes_private: notes || null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to plan experience");
      setItems((current) => [data, ...current]); setStartsAt(""); setPickupLocation(""); setNotes(""); setVendorId("");
    } catch (e: any) { setError(e?.message ?? "Unable to plan experience"); } finally { setBusy(false); }
  }

  async function updateService(item: Experience, action: "contacted" | "confirmed" | "cancelled") {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/experiences/${item.id}`, {
        method: "PATCH", headers: await headers(), body: JSON.stringify({ property_id: propertyId, action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to update service request");
      setItems((current) => current.map((value) => value.id === data.id ? data : value));
    } catch (e: any) { setError(e?.message ?? "Unable to update service request"); } finally { setBusy(false); }
  }

  async function assignVendor(item: Experience) {
    const vendorId = vendorChoices[item.id];
    if (!vendorId || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/experiences/${item.id}`, { method: "PATCH", headers: await headers(), body: JSON.stringify({ property_id: propertyId, vendor_id: vendorId }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to assign vendor");
      setItems((current) => current.map((value) => value.id === data.id ? data : value));
      setVendorChoices((current) => ({ ...current, [item.id]: "" }));
    } catch (e: any) { setError(e?.message ?? "Unable to assign vendor"); } finally { setBusy(false); }
  }

  async function prepareVendorCoordination(item: Experience) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/experiences/${item.id}/coordination`, { method: "POST", headers: await headers(), body: JSON.stringify({ property_id: propertyId }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to prepare private vendor coordination.");
      await load();
    } catch (e: any) { setError(e?.message ?? "Unable to prepare private vendor coordination."); } finally { setBusy(false); }
  }

  if (!bookingId) return <section style={{ marginTop: 18, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}><h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>Experiences</h3><p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Add this guest’s stay dates before planning a chef, grocery stocking, driver, or tour.</p></section>;

  return <section style={{ marginTop: 18, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
    <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>Experiences</h3>
    <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 9px" }}>Plan an experience here; contact vendors manually and keep the details with this stay. Planning one also adds a follow-up so it does not get missed.</p>
    {types.length === 0 ? <div style={{ padding: 9, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 12 }}>
      <strong>Add an experience</strong>
      <div style={{ display: "flex", gap: 6, marginTop: 7 }}><input value={newType} onChange={(event) => setNewType(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addType(); }} placeholder="Private chef, grocery stocking…" maxLength={280} style={{ flex: 1, minWidth: 0, padding: "6px 7px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 }} /><button type="button" onClick={() => void addType()} disabled={busy || !newType.trim()} style={buttonStyle}>Add</button></div>
    </div> : <div style={{ display: "grid", gap: 7 }}>
      <select value={serviceTypeId} onChange={(event) => { const selected = types.find((type) => type.id === event.target.value); setServiceTypeId(event.target.value); if (selected?.default_vendor_id) setVendorId(selected.default_vendor_id); }} style={inputStyle}><option value="">Choose experience…</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
      <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} style={inputStyle}><option value="">Choose vendor later</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.vendor_type}</option>)}</select>
      <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} style={inputStyle} aria-label="Experience date and time" />
      <input value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} placeholder="Pickup or meeting point (optional)" style={inputStyle} />
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Private request details for the team…" style={{ ...inputStyle, resize: "vertical" }} />
      <button type="button" disabled={busy || !serviceTypeId} onClick={() => void createService()} style={{ ...buttonStyle, justifySelf: "start" }}>{busy ? "Saving…" : "Plan experience"}</button>
      <div style={{ fontSize: 11, color: "#64748b" }}>Need a different provider? <Link href="/dashboard/vendors" style={{ color: "#2563eb" }}>Manage vendors</Link>.</div>
    </div>}
    {error ? <p role="alert" style={{ color: "#b91c1c", fontSize: 12, margin: "8px 0 0" }}>{error}</p> : null}
    {items.length ? <div style={{ display: "grid", gap: 7, marginTop: 10 }}>{items.map((item) => { const coordination = item.vendor_coordination_groups?.[0]; return <div key={item.id} style={{ padding: "7px 8px", borderRadius: 7, border: "1px solid #dbe4ee", background: "#fff", fontSize: 12 }}><strong>{item.experience_types?.name ?? "Experience"}</strong><span style={{ color: "#64748b" }}> · {item.status.replaceAll("_", " ")}</span>{item.vendors?.name ? <div style={{ marginTop: 2 }}>Vendor: {item.vendors.name}</div> : <><div style={{ marginTop: 2, color: "#64748b" }}>Vendor not chosen yet</div>{item.status === "proposed" ? <div style={{ display: "flex", gap: 5, marginTop: 6 }}><select value={vendorChoices[item.id] ?? ""} onChange={(event) => setVendorChoices((current) => ({ ...current, [item.id]: event.target.value }))} style={{ ...inputStyle, flex: 1, padding: "5px 6px" }}><option value="">Choose vendor…</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select><button type="button" disabled={busy || !vendorChoices[item.id]} onClick={() => void assignVendor(item)} style={smallButtonStyle}>Assign</button></div> : null}</>}{item.start_at ? <div style={{ color: "#64748b", marginTop: 2 }}>{new Date(item.start_at).toLocaleString()}</div> : null}{item.pickup_location ? <div style={{ color: "#64748b", marginTop: 2 }}>Pickup: {item.pickup_location}</div> : null}{item.internal_notes_private ? <div style={{ color: "#475569", marginTop: 4, whiteSpace: "pre-wrap" }}>{item.internal_notes_private}</div> : null}{item.vendors ? <div style={{ marginTop: 7 }}>{coordination ? <div style={{ padding: 7, borderRadius: 7, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" }}><strong>Private vendor coordination prepared</strong><div style={{ marginTop: 3 }}>Team + vendor only · no guest, WhatsApp group, or message has been created.</div><details style={{ marginTop: 5, color: "#334155" }}><summary style={{ cursor: "pointer" }}>View vendor-facing draft</summary><div style={{ whiteSpace: "pre-wrap", marginTop: 5 }}>{coordination.draft_message}</div></details></div> : <button type="button" disabled={busy} onClick={() => void prepareVendorCoordination(item)} style={smallButtonStyle}>Prepare private vendor coordination</button>}</div> : null}{item.status === "proposed" ? <div style={{ display: "flex", gap: 6, marginTop: 7 }}><button type="button" disabled={busy || !item.vendors} onClick={() => void updateService(item, "contacted")} style={smallButtonStyle}>Mark vendor contacted</button><button type="button" disabled={busy} onClick={() => void updateService(item, "cancelled")} style={quietButtonStyle}>Cancel</button></div> : null}{item.status === "vendor_contacted" ? <div style={{ display: "flex", gap: 6, marginTop: 7 }}><button type="button" disabled={busy} onClick={() => void updateService(item, "confirmed")} style={smallButtonStyle}>Mark confirmed</button><button type="button" disabled={busy} onClick={() => void updateService(item, "cancelled")} style={quietButtonStyle}>Cancel</button></div> : null}</div>; })}</div> : null}
  </section>;
}

const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "7px 8px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 12, background: "#fff" };
const buttonStyle = { padding: "7px 9px", border: "1px solid #2563eb", borderRadius: 7, background: "#2563eb", color: "#fff", fontSize: 12, cursor: "pointer" };
const smallButtonStyle = { padding: "5px 7px", border: "1px solid #2563eb", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", fontSize: 11, cursor: "pointer" };
const quietButtonStyle = { padding: "5px 7px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#475569", fontSize: 11, cursor: "pointer" };
