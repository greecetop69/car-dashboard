const COLOR_MAP: Record<string, { bg: string; border: string }> = {
  "белая":                { bg: "#f9fafb", border: "#d1d5db" },
  "белая (мелкие диски)": { bg: "#f9fafb", border: "#d1d5db" },
  "серая":                { bg: "#9ca3af", border: "#6b7280" },
  "темно-серая":          { bg: "#4b5563", border: "#374151" },
  "черная":               { bg: "#1f2937", border: "#111827" },
};

export function getColorSwatch(name: string): { bg: string; border: string } {
  return COLOR_MAP[name.toLowerCase()] ?? { bg: "#e5e7eb", border: "#9ca3af" };
}
