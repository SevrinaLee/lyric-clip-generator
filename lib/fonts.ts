import { FONT_REGISTRY } from "./captionStyles";

/** Builds a Google Fonts stylesheet URL for the distinct font names used by
 * video_templates, so template previews can render in the real font instead
 * of a generic fallback. Registry fonts resolve to their cssFamily + weight
 * axis (e.g. "Montserrat ExtraBold" → Montserrat:wght@800) so the preview
 * loads the same cut the export renders with. */
export function googleFontsUrl(fontNames: string[]): string {
  const unique = Array.from(new Set(fontNames.filter(Boolean)));
  if (unique.length === 0) return "";
  // family=Name:wght@W, deduped after registry resolution (two display names
  // can share a cssFamily at different weights — both axes must load).
  const params = new Set<string>();
  for (const name of unique) {
    const def = FONT_REGISTRY[name];
    const family = def?.cssFamily ?? name;
    const weight = def?.cssWeight ?? 400;
    const enc = encodeURIComponent(family).replace(/%20/g, "+");
    params.add(weight === 400 ? `family=${enc}` : `family=${enc}:wght@${weight}`);
  }
  return `https://fonts.googleapis.com/css2?${[...params].join("&")}&display=swap`;
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
