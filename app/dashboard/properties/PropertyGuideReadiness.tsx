"use client";

import { usePropertyWorkspace } from "../PropertyWorkspaceProvider";

export type GuideReadinessProperty = {
  id: string;
  name: string;
  lodgify_property_id: number | null;
  ai_guide: string | null;
  welcome_message_draft: string | null;
  check_in_instructions_guest: string | null;
  check_out_instructions_guest: string | null;
};

function filled(value: string | null) {
  return Boolean(value?.trim());
}

function Item({ done, children }: { done: boolean; children: React.ReactNode }) {
  return <span style={{ color: done ? "#166534" : "#9a3412", fontSize: 12 }}>{done ? "✓" : "○"} {children}</span>;
}

export default function PropertyGuideReadiness({ properties }: { properties: GuideReadinessProperty[] }) {
  const { selectedPropertyId, setSelectedPropertyId } = usePropertyWorkspace();
  const complete = properties.filter((property) => filled(property.ai_guide) && filled(property.welcome_message_draft) && filled(property.check_in_instructions_guest) && filled(property.check_out_instructions_guest)).length;

  return <section style={{ border: "1px solid #dbe4ee", borderRadius: 12, padding: 16, background: "#f8fafc", marginBottom: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
      <div><h2 style={{ fontSize: 16, margin: 0 }}>Guide readiness</h2><p style={{ color: "#475569", fontSize: 13, margin: "4px 0 0" }}>{complete} of {properties.length} homes have their core guest guide complete.</p></div>
      <span style={{ color: "#64748b", fontSize: 12 }}>Select a home below to edit it.</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 14 }}>
      {properties.map((property) => {
        const selected = selectedPropertyId === property.id;
        return <button key={property.id} type="button" onClick={() => setSelectedPropertyId(property.id)} style={{ textAlign: "left", padding: 12, borderRadius: 10, border: `1px solid ${selected ? "#2563eb" : "#dbe4ee"}`, background: selected ? "#eff6ff" : "#fff", cursor: "pointer" }}>
          <strong style={{ display: "block", fontSize: 13, color: "#0f172a", marginBottom: 7 }}>{property.name}</strong>
          <div style={{ display: "grid", gap: 3 }}>
            <Item done={property.lodgify_property_id != null}>Lodgify mapped</Item>
            <Item done={filled(property.ai_guide)}>Guide for AI</Item>
            <Item done={filled(property.welcome_message_draft)}>Welcome draft</Item>
            <Item done={filled(property.check_in_instructions_guest) && filled(property.check_out_instructions_guest)}>Check-in & check-out</Item>
          </div>
        </button>;
      })}
    </div>
  </section>;
}
