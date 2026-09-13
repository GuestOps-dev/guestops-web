"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { usePropertyWorkspace } from "../PropertyWorkspaceProvider";
import DashboardNavigation from "../DashboardNavigation";

type Experience = { id: string; name: string; details: string; active: boolean };
type Property = { id: string; name: string };
type Availability = { property_id: string; experience_id: string; enabled: boolean };

const input: React.CSSProperties = { padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", boxSizing: "border-box" };
const button: React.CSSProperties = { padding: "9px 12px", border: "none", borderRadius: 8, background: "#0f5bff", color: "#fff", cursor: "pointer" };

export default function ExperienceLibraryManager() {
  const { propertyOptions, selectedPropertyId } = usePropertyWorkspace();
  // Experiences belong to the account, rather than to the currently selected
  // house.  We only need one accessible property to establish that account in
  // the API; availability is managed by the per-house checkboxes below.
  const propertyId = selectedPropertyId === "all" ? (propertyOptions[0]?.id ?? "") : selectedPropertyId;
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback(async () => {
    const { data } = await client.auth.getSession();
    if (!data.session?.access_token) throw new Error("Please sign in again.");
    return { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" };
  }, [client]);

  const load = useCallback(async () => {
    if (!propertyId) { setExperiences([]); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/experience-library?property_id=${encodeURIComponent(propertyId)}`, { headers: await headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Unable to load experiences.");
      setExperiences(data.experiences ?? []); setProperties(data.properties ?? []); setAvailability(data.availability ?? []);
    } catch (err: any) { setError(err?.message ?? "Unable to load experiences."); }
    finally { setLoading(false); }
  }, [headers, propertyId]);

  useEffect(() => { void load(); }, [load]);

  function beginEdit(item: Experience) { setEditing(item.id); setName(item.name); setDetails(item.details); setError(null); }
  function resetForm() { setEditing(null); setName(""); setDetails(""); }

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!propertyId || !name.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(editing ? `/api/experience-library/${editing}` : "/api/experience-library", {
        method: editing ? "PATCH" : "POST", headers: await headers(), body: JSON.stringify({ property_id: propertyId, name, details }),
      });
      const data = await res.json(); if (!res.ok) throw new Error(data?.error ?? "Unable to save experience.");
      resetForm(); await load();
    } catch (err: any) { setError(err?.message ?? "Unable to save experience."); }
    finally { setSaving(false); }
  }

  async function setEnabled(experience: Experience, targetProperty: Property, enabled: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/experience-library/${experience.id}/availability`, { method: "PATCH", headers: await headers(), body: JSON.stringify({ property_id: targetProperty.id, enabled }) });
      const data = await res.json(); if (!res.ok) throw new Error(data?.error ?? "Unable to change availability.");
      setAvailability((current) => [...current.filter((row) => !(row.experience_id === experience.id && row.property_id === targetProperty.id)), data]);
    } catch (err: any) { setError(err?.message ?? "Unable to change availability."); }
  }

  function enabledFor(experienceId: string, targetPropertyId: string) { return availability.find((item) => item.experience_id === experienceId && item.property_id === targetPropertyId)?.enabled ?? true; }
  const visibleExperiences = experiences.filter((experience) => {
    const needle = search.trim().toLocaleLowerCase();
    return !needle || `${experience.name}\n${experience.details ?? ""}`.toLocaleLowerCase().includes(needle);
  });

  return <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
    <DashboardNavigation />
    <h1 style={{ margin: "0 0 6px" }}>Experiences</h1>
    <p style={{ color: "#64748b", maxWidth: 720, lineHeight: 1.5 }}>One account-wide library for tours, dining, grocery stocking, and anything else your concierge can arrange. Keep the full reference details in one place so AI and the team have the same approved information. New experiences are available to every house by default.</p>

    {!propertyId ? <p style={{ color: "#64748b" }}>No houses are available for this account yet.</p> : <>
      {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}
      <form onSubmit={save} style={{ display: "grid", gap: 10, padding: 16, border: "1px solid #dbe4ee", borderRadius: 12, background: "#f8fafc", marginBottom: 22 }}>
        <strong>{editing ? "Edit experience" : "Add an experience"}</strong>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Grocery stocking" maxLength={160} required style={input} />
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Paste the full approved details here: what it is, options, timing, pricing guidance, what the guest should provide, and anything AI should know. This is internal reference material, not an automatic guest message." rows={9} maxLength={24000} style={{ ...input, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 8 }}><button disabled={saving} style={button}>{saving ? "Saving…" : editing ? "Save experience" : "Add to every house"}</button>{editing ? <button type="button" onClick={resetForm} style={{ ...button, background: "#fff", border: "1px solid #cbd5e1", color: "#334155" }}>Cancel</button> : null}</div>
      </form>
      <label style={{ display: "grid", gap: 5, maxWidth: 540, fontSize: 13, margin: "0 0 16px" }}>Find an experience
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by experience name or any detail…" style={input} />
      </label>
      {loading ? <p>Loading experiences…</p> : <div style={{ display: "grid", gap: 12 }}>{visibleExperiences.map((experience) => <article key={experience.id} style={{ border: "1px solid #dbe4ee", borderRadius: 12, padding: 16, background: experience.active ? "#fff" : "#f8fafc" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>{experience.name}</strong><button type="button" onClick={() => beginEdit(experience)} style={{ ...button, background: "#fff", border: "1px solid #cbd5e1", color: "#334155" }}>Edit details</button></div>
        {experience.details ? <p style={{ whiteSpace: "pre-wrap", color: "#475569", fontSize: 13, lineHeight: 1.5 }}>{experience.details}</p> : <p style={{ color: "#94a3b8", fontSize: 13 }}>No reference details added yet.</p>}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 10 }}><span style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 7 }}>Available at</span><div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{properties.map((property) => <label key={property.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={enabledFor(experience.id, property.id)} onChange={(event) => void setEnabled(experience, property, event.target.checked)} />{property.name}</label>)}</div></div>
      </article>)}{experiences.length === 0 ? <p style={{ color: "#64748b" }}>No experiences yet. Add the first one above.</p> : null}{experiences.length > 0 && visibleExperiences.length === 0 ? <p style={{ color: "#64748b" }}>No experiences match that search.</p> : null}</div>}
    </>}
  </main>;
}
