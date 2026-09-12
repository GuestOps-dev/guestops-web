type GroupMember = { id: string; display_name: string | null; participant_role: string; membership_status: string };

export type WhatsAppGroupSetupData = {
  display_name: string;
  status: "setup_required" | "active" | "closed" | "failed" | string;
  members: GroupMember[];
};

export default function WhatsAppGroupSetup({ group }: { group: WhatsAppGroupSetupData | null }) {
  if (!group) return null;
  const active = group.status === "active";
  const failed = group.status === "failed";
  const label = active ? "Active" : failed ? "Needs attention" : group.status === "closed" ? "Closed" : "Internal preparation only";
  const color = active ? "#166534" : failed ? "#b91c1c" : group.status === "closed" ? "#475569" : "#92400e";
  const background = active ? "#f0fdf4" : failed ? "#fef2f2" : group.status === "closed" ? "#f8fafc" : "#fffbeb";
  const border = active ? "#bbf7d0" : failed ? "#fecaca" : group.status === "closed" ? "#e2e8f0" : "#fde68a";

  return <section style={{ marginBottom: 10, padding: "10px 12px", border: `1px solid ${border}`, borderRadius: 10, background, fontSize: 12 }}>
    <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", alignItems: "baseline" }}>
      <strong style={{ color: "#0f172a" }}>WhatsApp group preparation · {group.display_name}</strong>
      <span style={{ color, fontWeight: 700 }}>{label}</span>
    </div>
    {active ? <p style={{ margin: "5px 0 0", color: "#475569" }}>This group is active through the supported provider connection.</p> : <p style={{ margin: "5px 0 0", color: "#475569" }}>The participant list is kept inside GuestOpsHQ for review. No WhatsApp group, invitation, or guest message has been created.</p>}
    {group.members.length ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{group.members.map((member) => <span key={member.id} style={{ border: "1px solid #cbd5e1", borderRadius: 999, background: "#fff", padding: "3px 7px", color: "#334155" }}>{member.display_name ?? "Participant"} · {member.participant_role}</span>)}</div> : null}
  </section>;
}
