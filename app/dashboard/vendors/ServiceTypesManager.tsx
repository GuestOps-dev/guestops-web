"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { usePropertyWorkspace } from "../PropertyWorkspaceProvider";

type ServiceType = { id: string; name: string; category: string | null; default_vendor_id: string | null; active: boolean };
type Vendor = { id: string; name: string; vendor_type: string; active: boolean };

export default function ServiceTypesManager() {
  const { selectedPropertyId } = usePropertyWorkspace();
  const browserClient = useMemo(() => getSupabaseBrowserClient(), []);
  const propertyId = selectedPropertyId === "all" ? null : selectedPropertyId;
  const [items, setItems] = useState<ServiceType[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [defaultVendorId, setDefaultVendorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback(async () => {
    const { data, error } = await browserClient.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Please sign in again.");
    return { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" };
  }, [browserClient]);

  const load = useCallback(async () => {
    if (!propertyId) { setItems([]); setVendors([]); return; }
    try {
      setError(null);
      const auth = await headers();
      const [typesResponse, vendorsResponse] = await Promise.all([
        fetch(`/api/experience-types?propertyId=${encodeURIComponent(propertyId)}&includeInactive=true`, { headers: auth }),
        fetch(`/api/vendors?propertyId=${encodeURIComponent(propertyId)}&activeOnly=true`, { headers: auth }),
      ]);
      if (!typesResponse.ok || !vendorsResponse.ok) throw new Error("Unable to load the service menu.");
      setItems(await typesResponse.json());
      setVendors(await vendorsResponse.json());
    } catch (loadError: any) { setError(loadError?.message ?? "Unable to load the service menu."); }
  }, [headers, propertyId]);

  useEffect(() => { void load(); }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!propertyId || !name.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/experience-types", {
        method: "POST", headers: await headers(),
        body: JSON.stringify({ property_id: propertyId, name, category, default_vendor_id: defaultVendorId || null }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Unable to add service type.");
      setName(""); setCategory(""); setDefaultVendorId("");
      await load();
    } catch (saveError: any) { setError(saveError?.message ?? "Unable to add service type."); }
    finally { setBusy(false); }
  }

  async function setActive(item: ServiceType, active: boolean) {
    if (!propertyId || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/experience-types/${item.id}`, { method: "PATCH", headers: await headers(), body: JSON.stringify({ property_id: propertyId, active }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Unable to update service type.");
      await load();
    } catch (updateError: any) { setError(updateError?.message ?? "Unable to update service type."); }
    finally { setBusy(false); }
  }

  const vendorName = (id: string | null) => vendors.find((vendor) => vendor.id === id)?.name ?? "No default vendor";

  if (!propertyId) return <p style={{ color: "#666", margin: 0 }}>Select a property above to set up its service menu.</p>;
  return <section style={{ display: "grid", gap: 12, paddingTop: 8 }}>
    <div><h2 style={{ fontSize: 16, margin: 0 }}>Service menu</h2><p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Set up the services guests can request before you need them.</p></div>
    {error ? <div role="alert" style={{ padding: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
    <form onSubmit={add} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, padding: 14, border: "1px solid #e5e7eb", borderRadius: 10, background: "#fafafa" }}>
      <Field label="Service name" value={name} onChange={setName} placeholder="Private chef" required />
      <Field label="Category" value={category} onChange={setCategory} placeholder="Dining, transport…" />
      <label style={labelStyle}>Preferred vendor<select value={defaultVendorId} onChange={(event) => setDefaultVendorId(event.target.value)} style={inputStyle}><option value="">Choose later</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.vendor_type}</option>)}</select></label>
      <div style={{ alignSelf: "end" }}><button type="submit" disabled={busy || !name.trim()} style={buttonStyle}>{busy ? "Saving…" : "Add service"}</button></div>
    </form>
    {items.length === 0 ? <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>No services yet. Add common guest requests such as chef, driver, tour, or maintenance.</p> : <div style={{ display: "grid", gap: 7 }}>{items.map((item) => <div key={item.id} style={{ padding: "9px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: item.active ? "#fff" : "#f8fafc", opacity: item.active ? 1 : 0.7, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><strong style={{ fontSize: 13 }}>{item.name}</strong>{item.category ? <span style={{ color: "#64748b", fontSize: 12 }}> · {item.category}</span> : null}<div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Preferred vendor: {vendorName(item.default_vendor_id)}</div></div><button type="button" disabled={busy} onClick={() => void setActive(item, !item.active)} style={quietButtonStyle}>{item.active ? "Deactivate" : "Reactivate"}</button></div>)}</div>}
  </section>;
}

const labelStyle = { fontSize: 12, display: "grid", gap: 4 };
const inputStyle = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" };
const buttonStyle = { padding: "8px 12px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer" };
const quietButtonStyle = { padding: "5px 9px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12 };

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <label style={labelStyle}>{label}<input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} /></label>;
}
