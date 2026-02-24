export function validateSelectedProperty(
  selected: string | null,
  allowedPropertyIds: string[]
) {
  if (!selected || selected === "all") return "all";
  return allowedPropertyIds.includes(selected) ? selected : "all";
}