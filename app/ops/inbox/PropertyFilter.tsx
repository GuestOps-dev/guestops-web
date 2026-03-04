"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  tab: string;
  properties: Array<{ id: string; name: string }>;
  selectedPropertyId: string | null;
};

export function PropertyFilter({ tab, properties, selectedPropertyId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    if (value === "all") {
      next.delete("propertyId");
    } else {
      next.set("propertyId", value);
    }
    router.push(`/ops/inbox?${next.toString()}`);
  }

  if (properties.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, marginRight: 8 }}>Property:</label>
      <select
        value={selectedPropertyId ?? "all"}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #ddd",
          fontSize: 13,
        }}
      >
        <option value="all">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
