"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { usePropertyWorkspace } from "../PropertyWorkspaceProvider";

type PropertyGuide = {
  id: string;
  name: string;
  location: string | null;
  timezone: string;
  wifi_ssid: string | null;
  wifi_password: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_instructions_guest: string | null;
  check_out_instructions_guest: string | null;
  property_notes: string | null;
  vibe_description: string | null;
  ai_guide: string | null;
  lodgify_property_id: number | null;
};

type GuideForm = {
  [Field in Exclude<keyof PropertyGuide, "id">]: string;
};

const emptyGuide: GuideForm = {
  name: "",
  location: "",
  timezone: "",
  wifi_ssid: "",
  wifi_password: "",
  check_in_time: "",
  check_out_time: "",
  check_in_instructions_guest: "",
  check_out_instructions_guest: "",
  property_notes: "",
  vibe_description: "",
  ai_guide: "",
  lodgify_property_id: "",
};

function formFromGuide(guide: PropertyGuide): GuideForm {
  return Object.fromEntries(
    Object.entries(guide)
      .filter(([key]) => key !== "id")
      .map(([key, value]) => [key, value == null ? "" : String(value)])
  ) as GuideForm;
}

export default function PropertyGuideManager() {
  const { selectedPropertyId, setSelectedPropertyId, propertyOptions } = usePropertyWorkspace();
  const browserClient = useMemo(() => getSupabaseBrowserClient(), []);
  const [form, setForm] = useState<GuideForm>(emptyGuide);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const propertyId = selectedPropertyId === "all" ? null : selectedPropertyId;

  const getToken = useCallback(async () => {
    const { data, error } = await browserClient.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Please sign in again.");
    return data.session.access_token;
  }, [browserClient]);

  const loadGuide = useCallback(async () => {
    if (!propertyId) {
      setForm(emptyGuide);
      return;
    }
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getToken();
      const response = await fetch(`/api/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Unable to load this property guide.");
      setForm(formFromGuide((await response.json()) as PropertyGuide));
    } catch (loadError: any) {
      setError(loadError?.message ?? "Unable to load this property guide.");
      setForm(emptyGuide);
    } finally {
      setLoading(false);
    }
  }, [getToken, propertyId]);

  useEffect(() => { void loadGuide(); }, [loadGuide]);

  function setField(field: keyof GuideForm, value: string) {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveGuide(event: React.FormEvent) {
    event.preventDefault();
    if (!propertyId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getToken();
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Unable to save this property guide.");
      setForm(formFromGuide(result as PropertyGuide));
      setSaved(true);
    } catch (saveError: any) {
      setError(saveError?.message ?? "Unable to save this property guide.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <label htmlFor="guide-property" style={{ fontSize: 13, marginRight: 8 }}>Property:</label>
        <select id="guide-property" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", minWidth: 240 }}>
          <option value="all">Select a property</option>
          {propertyOptions.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
      </div>

      {error ? <div role="alert" style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
      {saved ? <div role="status" style={{ padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534", fontSize: 13 }}>Property guide saved.</div> : null}

      {propertyId ? (loading ? <p style={{ color: "#666" }}>Loading property guide…</p> : <form onSubmit={saveGuide} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section style={sectionStyle}>
          <h2 style={headingStyle}>Property basics</h2>
          <div style={gridStyle}>
            <Field label="Property name" value={form.name} onChange={(value) => setField("name", value)} required />
            <Field label="Location" value={form.location} onChange={(value) => setField("location", value)} placeholder="City, country" />
            <Field label="Timezone" value={form.timezone} onChange={(value) => setField("timezone", value)} required placeholder="America/Costa_Rica" />
            <Field label="Guest-facing vibe" value={form.vibe_description} onChange={(value) => setField("vibe_description", value)} placeholder="Relaxed jungle retreat…" />
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Reservation connection</h2>
          <p style={{ margin: 0, color: "#52525b", fontSize: 13, lineHeight: 1.5 }}>Once Lodgify is connected, this tells GuestOpsHQ which Lodgify rental belongs to this property. Find the numeric Rental ID in Lodgify; leave it blank until you are ready to connect.</p>
          <Field label="Lodgify rental ID" value={form.lodgify_property_id} onChange={(value) => setField("lodgify_property_id", value)} placeholder="Example: 779143" inputMode="numeric" />
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Guest essentials</h2>
          <div style={gridStyle}>
            <Field label="Wi-Fi network" value={form.wifi_ssid} onChange={(value) => setField("wifi_ssid", value)} />
            <Field label="Wi-Fi password" value={form.wifi_password} onChange={(value) => setField("wifi_password", value)} />
            <Field label="Check-in time" type="time" value={form.check_in_time} onChange={(value) => setField("check_in_time", value)} />
            <Field label="Check-out time" type="time" value={form.check_out_time} onChange={(value) => setField("check_out_time", value)} />
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Instructions and internal knowledge</h2>
          <TextArea label="Check-in instructions for guests" value={form.check_in_instructions_guest} onChange={(value) => setField("check_in_instructions_guest", value)} placeholder="Arrival, access, parking, welcome details…" />
          <TextArea label="Check-out instructions for guests" value={form.check_out_instructions_guest} onChange={(value) => setField("check_out_instructions_guest", value)} placeholder="Departure checklist and key return…" />
          <TextArea label="Private operating notes" value={form.property_notes} onChange={(value) => setField("property_notes", value)} placeholder="Team-only operating knowledge. Never sent to guests automatically." />
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Guide for AI</h2>
          <p style={{ margin: 0, color: "#52525b", fontSize: 13, lineHeight: 1.5 }}>Add approved, property-specific guidance for future AI drafting: what makes the home special, common fixes, guest-safe explanations, and when to contact a person or vendor. This is internal-only and will never be sent automatically.</p>
          <TextArea label="Approved property guidance" value={form.ai_guide} onChange={(value) => setField("ai_guide", value)} placeholder={"Ocean-view details guests may ask about…\n\nIf the front door sticks: [approved steps].\n\nIf power is out: [guest-safe explanation and escalation contact]."} />
        </section>

        <div><button type="submit" disabled={saving} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: saving ? "wait" : "pointer" }}>{saving ? "Saving…" : "Save property guide"}</button></div>
      </form>) : <p style={{ color: "#666" }}>Select a property to view its guide.</p>}
    </div>
  );
}

const sectionStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fafafa" };
const headingStyle: React.CSSProperties = { fontSize: 16, margin: 0 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 };

function Field({ label, value, onChange, required, type = "text", placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return <label style={{ fontSize: 12, display: "grid", gap: 4 }}>{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }} /></label>;
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label style={{ fontSize: 12, display: "grid", gap: 4 }}>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} placeholder={placeholder} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", resize: "vertical" }} /></label>;
}
