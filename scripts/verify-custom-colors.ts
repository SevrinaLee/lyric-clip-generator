/**
 * Unit check for per-clip custom colors (v1.7 S7.2). Proves the shared
 * resolvers that BOTH the export render and the browser preview consume produce
 * the right background + caption color, so the two stay in parity. Run:
 *   npx tsx scripts/verify-custom-colors.ts
 */
import { resolveSegmentBackground } from "../lib/backgrounds";
import { resolveClipStyle, hexToAss } from "../lib/captionStyles";

const template = {
  font: "Montserrat ExtraBold",
  animation_preset: "wordpop",
  background_style: "gradient:#111111:#222222",
  primary_color: "#333333",
} as const;

let failures = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label} → ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
}

// Background: two different custom colors → gradient
check(
  "custom pair → gradient",
  resolveSegmentBackground(template, { custom_bg_c0: "#ff0000", custom_bg_c1: "#0000ff" }),
  { backgroundStyle: "gradient:#ff0000:#0000ff", primaryColor: "#ff0000" },
);

// Background: equal custom colors → solid
check(
  "custom equal pair → solid",
  resolveSegmentBackground(template, { custom_bg_c0: "#abcdef", custom_bg_c1: "#ABCDEF" }),
  { backgroundStyle: "solid", primaryColor: "#abcdef" },
);

// Background: no custom → falls back to template
check(
  "no custom → template",
  resolveSegmentBackground(template, {}),
  { backgroundStyle: "gradient:#111111:#222222", primaryColor: "#333333" },
);

// Background: invalid custom (only one set) → template
check(
  "half custom → template",
  resolveSegmentBackground(template, { custom_bg_c0: "#ff0000" }),
  { backgroundStyle: "gradient:#111111:#222222", primaryColor: "#333333" },
);

// Caption color: custom overrides preset in both ASS and preview
const styled = resolveClipStyle(template, { custom_caption_color: "#ff8800" });
check("caption custom → ass primary", styled.ass.primary, hexToAss("#ff8800"));
check("caption custom → preview color", styled.preview.color, "#ff8800");

// Caption color: custom beats brand accent
const withAccent = resolveClipStyle(
  { ...template },
  { custom_caption_color: "#00ff00", caption_style_preset: "outline-yellow" },
  "#123456",
);
check("caption custom beats accent (ass)", withAccent.ass.primary, hexToAss("#00ff00"));
check("caption custom beats accent (preview)", withAccent.preview.color, "#00ff00");

// Caption color: invalid custom is ignored (falls back to preset)
const badColor = resolveClipStyle(template, { custom_caption_color: "notacolor" });
check("invalid caption color ignored", badColor.preview.color, "#ffffff");

if (failures > 0) {
  console.error(`\n${failures} custom-color check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll custom-color checks passed.");
