/** Builds a Google Fonts stylesheet URL for the distinct font names used by
 * video_templates, so template previews can render in the real font instead
 * of a generic fallback. */
export function googleFontsUrl(fontNames: string[]): string {
  const unique = Array.from(new Set(fontNames.filter(Boolean)));
  if (unique.length === 0) return "";
  const families = unique
    .map((name) => `family=${encodeURIComponent(name).replace(/%20/g, "+")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Picks readable text color (white or ink) for a given hex background. */
export function readableTextColor(hex: string): "#ffffff" | "#2b2b2b" {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 180 ? "#2b2b2b" : "#ffffff";
}
