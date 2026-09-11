"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { usePropertyWorkspace } from "../PropertyWorkspaceProvider";

type Vendor = {
  id: string;
  property_id: string;
  name: string;
  vendor_type: string;
  whatsapp_phone: string | null;
  sms_phone: string | null;
  email: string | null;
  priority_order: number | null;
  max_passengers: number | null;
  notes: string | null;
  active: boolean;
};

type VendorForm = {
  name: string;
  vendor_type: string;
  whatsapp_phone: string;
  sms_phone: string;
  email: string;
  priority_order: string;
  max_passengers: string;
  notes: string;
};

const blankForm: VendorForm = {
  name: "",
  vendor_type: "",
  whatsapp_phone: "",
  sms_phone: "",
  email: "",
  priority_order: "",
  max_passengers: "",
  notes: "",
};

function formFromVendor(vendor: Vendor): VendorForm {
  return {
    name: vendor.name,
    vendor_type: vendor.vendor_type,
    whatsapp_phone: vendor.whatsapp_phone ?? "",
    sms_phone: vendor.sms_phone ?? "",
    email: vendor.email ?? "",
    priority_order: vendor.priority_order?.toString() ?? "",
    max_passengers: vendor.max_passengers?.toString() ?? "",
    notes: vendor.notes ?? "",
  };
}

function contactSummary(vendor: Vendor) {
  return [vendor.whatsapp_phone && `WhatsApp ${vendor.whatsapp_phone}`, vendor.sms_phone && `SMS ${vendor.sms_phone}`, vendor.email]
    .filter(Boolean)
    .join(" · ");
}

export default function VendorsManager() {
  const { selectedPropertyId, setSelectedPropertyId, propertyOptions } = usePropertyWorkspace();
  const browserClient = useMemo(() => getSupabaseBrowserClient(), []);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<VendorForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const propertyId = selectedPropertyId !== "all" ? selectedPropertyId : null;

  const getToken = useCallback(async () => {
    const { data, error } = await browserClient.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Please sign in again.");
    return data.session.access_token;
  }, [browserClient]);

  const loadVendors = useCallback(async () => {
    if (!propertyId) {
      setVendors([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`/api/vendors?propertyId=${encodeURIComponent(propertyId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Unable to load vendors. Please try again.");
      setVendors((await response.json()) as Vendor[]);
    } catch (loadError: any) {
      setError(loadError?.message ?? "Unable to load vendors.");
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, propertyId]);

  useEffect(() => { void loadVendors(); }, [loadVendors]);

  function updateForm(field: keyof VendorForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(blankForm);
    setEditingId(null);
  }

  async function saveVendor(event: React.FormEvent) {
    event.preventDefault();
    if (!propertyId) {
      setError("Select a property first.");
      return;
    }
    if (!form.name.trim() || !form.vendor_type.trim()) {
      setError("Vendor name and service type are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(editingId ? `/api/vendors/${editingId}` : "/api/vendors", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ property_id: propertyId, ...form }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "Unable to save vendor.");
      }
      resetForm();
      await loadVendors();
    } catch (saveError: any) {
      setError(saveError?.message ?? "Unable to save vendor.");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(vendor: Vendor, active: boolean) {
    if (!propertyId) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ property_id: propertyId, active }),
      });
      if (!response.ok) throw new Error("Unable to update vendor.");
      await loadVendors();
    } catch (saveError: any) {
      setError(saveError?.message ?? "Unable to update vendor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <label htmlFor="vendor-property" style={{ fontSize: 13, marginRight: 8 }}>Property:</label>
        <select
          id="vendor-property"
          value={selectedPropertyId}
          onChange={(event) => { setSelectedPropertyId(event.target.value); resetForm(); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", minWidth: 240 }}
        >
          <option value="all">Select a property</option>
          {propertyOptions.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
      </div>

      {error ? <div role="alert" style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}

      {propertyId ? <>
        <form onSubmit={saveVendor} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, padding: 16, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>{editingId ? "Edit vendor" : "Add vendor"}</h2>
            {editingId ? <button type="button" onClick={resetForm} disabled={saving} style={{ border: "none", background: "transparent", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>Cancel edit</button> : null}
          </div>
          <Field label="Name" value={form.name} onChange={(value) => updateForm("name", value)} required />
          <Field label="Service type" value={form.vendor_type} onChange={(value) => updateForm("vendor_type", value)} placeholder="Chef, driver, maintenance…" required />
          <Field label="WhatsApp" value={form.whatsapp_phone} onChange={(value) => updateForm("whatsapp_phone", value)} placeholder="+506…" />
          <Field label="SMS" value={form.sms_phone} onChange={(value) => updateForm("sms_phone", value)} placeholder="+1…" />
          <Field label="Email" type="email" value={form.email} onChange={(value) => updateForm("email", value)} />
          <Field label="Priority order" type="number" min="0" value={form.priority_order} onChange={(value) => updateForm("priority_order", value)} placeholder="1 is first" />
          <Field label="Passenger limit" type="number" min="0" value={form.max_passengers} onChange={(value) => updateForm("max_passengers", value)} />
          <label style={{ gridColumn: "1 / -1", fontSize: 12, display: "grid", gap: 4 }}>
            Internal notes
            <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} placeholder="Availability, preferred contact method, rates…" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", resize: "vertical" }} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" disabled={saving} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: saving ? "wait" : "pointer" }}>{saving ? "Saving…" : editingId ? "Save vendor" : "Add vendor"}</button>
          </div>
        </form>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Vendor directory</h2>
          {loading ? <p style={{ color: "#666" }}>Loading vendors…</p> : vendors.length === 0 ? <p style={{ color: "#666" }}>No vendors for this property yet. Add a chef, driver, or other trusted provider above.</p> : <div style={{ display: "grid", gap: 10 }}>
            {vendors.map((vendor) => <article key={vendor.id} style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 10, background: vendor.active ? "#fff" : "#f8fafc", opacity: vendor.active ? 1 : 0.72 }}>
              <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{vendor.name} <span style={{ color: "#64748b", fontWeight: 500 }}>· {vendor.vendor_type}</span></div>
                  {contactSummary(vendor) ? <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{contactSummary(vendor)}</div> : <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>No contact method saved</div>}
                  {(vendor.priority_order !== null || vendor.max_passengers !== null) ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{vendor.priority_order !== null ? `Priority ${vendor.priority_order}` : ""}{vendor.priority_order !== null && vendor.max_passengers !== null ? " · " : ""}{vendor.max_passengers !== null ? `Up to ${vendor.max_passengers} guests` : ""}</div> : null}
                  {vendor.notes ? <div style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-wrap" }}>{vendor.notes}</div> : null}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => { setEditingId(vendor.id); setForm(formFromVendor(vendor)); }} disabled={saving} style={{ padding: "5px 9px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12 }}>Edit</button>
                  <button type="button" onClick={() => void setActive(vendor, !vendor.active)} disabled={saving} style={{ padding: "5px 9px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12 }}>{vendor.active ? "Deactivate" : "Reactivate"}</button>
                </div>
              </div>
            </article>)}
          </div>}
        </section>
      </> : <p style={{ color: "#666" }}>Select a property to manage its vendor directory.</p>}
    </div>
  );
}

function Field({ label, value, onChange, required, type = "text", min, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; min?: string; placeholder?: string }) {
  return <label style={{ fontSize: 12, display: "grid", gap: 4 }}>{label}<input required={required} type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }} /></label>;
}
