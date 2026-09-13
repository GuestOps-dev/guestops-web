"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardNavigation from "../DashboardNavigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Property = { id: string; name: string; org_role: string | null };
type Member = { user_id: string; full_name: string | null; org_role: string; created_at: string; assignments: Array<{ property_id: string; property_role: string }> };

const input: React.CSSProperties = { padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", boxSizing: "border-box", background: "#fff" };

export default function TeamManager({ properties }: { properties: Property[] }) {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const manageable = properties.filter((property) => property.org_role === "org_owner" || property.org_role === "org_admin");
  const [propertyId, setPropertyId] = useState(manageable[0]?.id ?? "");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", org_role: "org_staff", property_role: "concierge" });

  const headers = useCallback(async () => {
    const { data } = await client.auth.getSession();
    if (!data.session?.access_token) throw new Error("Please sign in again.");
    return { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" };
  }, [client]);

  const load = useCallback(async () => {
    if (!propertyId) { setMembers([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/team?property_id=${encodeURIComponent(propertyId)}`, { headers: await headers() });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to load the team.");
      setMembers(data?.members ?? []);
    } catch (loadError: any) { setError(loadError?.message ?? "Unable to load the team."); }
    finally { setLoading(false); }
  }, [headers, propertyId]);

  useEffect(() => { void load(); }, [load]);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/team", { method: "POST", headers: await headers(), body: JSON.stringify({ property_id: propertyId, ...form }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to send the invitation.");
      setForm({ full_name: "", email: "", org_role: "org_staff", property_role: "concierge" });
      setNotice("Invitation sent. The person will receive a secure email to create their sign-in.");
      await load();
    } catch (inviteError: any) { setError(inviteError?.message ?? "Unable to send the invitation."); }
    finally { setSaving(false); }
  }

  const propertyName = new Map(properties.map((property) => [property.id, property.name]));
  return <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
    <DashboardNavigation />
    <h1 style={{ margin: "0 0 6px" }}>Team</h1>
    <p style={{ color: "#64748b", maxWidth: 720, lineHeight: 1.5 }}>Invite the people who work with your guests, then give them only the role and house access they need. Invitations are sent only when you submit this form.</p>
    {!manageable.length ? <p style={{ padding: 14, border: "1px solid #fde68a", borderRadius: 10, background: "#fffbeb", color: "#92400e" }}>Only an organization owner or admin can manage team access.</p> : <>
      <label style={{ display: "grid", gap: 5, maxWidth: 340, margin: "18px 0", fontSize: 13, color: "#475569" }}>Workspace property
        <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} style={input}>{manageable.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
      </label>
      <section style={{ padding: 16, border: "1px solid #dbe4ee", borderRadius: 12, background: "#f8fafc", marginBottom: 22 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Invite a team member</h2>
        <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 13 }}>Use staff for concierge and operations access. Owners cannot be changed from this screen.</p>
        <form onSubmit={invite} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <label style={{ fontSize: 12, color: "#475569" }}>Name<input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} placeholder="Orlando" maxLength={120} style={{ ...input, marginTop: 4 }} /></label>
          <label style={{ fontSize: 12, color: "#475569" }}>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" style={{ ...input, marginTop: 4 }} /></label>
          <label style={{ fontSize: 12, color: "#475569" }}>Organization role<select value={form.org_role} onChange={(event) => setForm({ ...form, org_role: event.target.value })} style={{ ...input, marginTop: 4 }}><option value="org_staff">Staff</option><option value="org_admin">Admin</option></select></label>
          <label style={{ fontSize: 12, color: "#475569" }}>Role at this house<select value={form.property_role} onChange={(event) => setForm({ ...form, property_role: event.target.value })} style={{ ...input, marginTop: 4 }}><option value="concierge">Concierge</option><option value="ops">Operations</option><option value="property_manager">Property manager</option><option value="viewer">Viewer</option></select></label>
          <div style={{ display: "flex", alignItems: "end" }}><button disabled={saving} style={{ padding: "10px 13px", border: "none", borderRadius: 8, background: "#0f5bff", color: "#fff", cursor: saving ? "wait" : "pointer", width: "100%" }}>{saving ? "Sending…" : "Send invitation"}</button></div>
        </form>
      </section>
      {notice ? <p role="status" style={{ padding: 12, border: "1px solid #bbf7d0", borderRadius: 9, background: "#f0fdf4", color: "#166534" }}>{notice}</p> : null}
      {error ? <p role="alert" style={{ padding: 12, border: "1px solid #fecaca", borderRadius: 9, background: "#fef2f2", color: "#b91c1c" }}>{error}</p> : null}
      <section style={{ border: "1px solid #dbe4ee", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: "12px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 700 }}>Current team</div>
        {loading ? <p style={{ padding: 14, margin: 0, color: "#64748b" }}>Loading team…</p> : null}
        {!loading && !members.length ? <p style={{ padding: 14, margin: 0, color: "#64748b" }}>No team members are set up yet.</p> : null}
        {members.map((member) => <article key={member.user_id} style={{ padding: 14, borderTop: "1px solid #edf2f7" }}><strong>{member.full_name?.trim() || "Team member"}</strong><span style={{ marginLeft: 8, fontSize: 12, color: "#475569" }}>{member.org_role.replace("org_", "")}</span><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{member.assignments.length ? member.assignments.map((assignment) => <span key={`${assignment.property_id}-${assignment.property_role}`} style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid #dbe4ee", background: "#f8fafc", color: "#334155", fontSize: 12 }}>{propertyName.get(assignment.property_id) ?? "Property"} · {assignment.property_role.replace("_", " ")}</span>) : <span style={{ color: "#64748b", fontSize: 12 }}>No house assignments yet</span>}</div></article>)}
      </section>
    </>}
  </main>;
}
