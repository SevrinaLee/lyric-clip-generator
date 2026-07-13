// Shared caption-style resolution, used by both the ffmpeg render (server)
// and the CSS preview (client) so they always agree — same pattern as
// lib/backgrounds.ts. The registry is the single source of truth for which
// fonts exist, how the ASS renderer and the browser each address them, and
// which are premium.
//
// ASS side: `assFamily` must match a vendored TTF's internal family name in
// assets/fonts/ (verified against the files' name tables — e.g. the
// ExtraBold cut's legacy family is "Montserrat ExtraBold", distinct from the
// regular cut's "Montserrat", so both can live in fontsdir). Unknown font
// names resolve to Noto Sans rather than crashing.
//
// CSS side: `cssFamily` + `cssWeight` drive both the Google Fonts stylesheet
// URL (lib/fonts.ts) and the preview's inline style.

import type { ClipSegment, VideoTemplate } from "./types";

export type FontDef = {
  /** Family name libass matches inside assets/fonts/ */
  assFamily: string;
  /** Google Fonts family for the browser preview */
  cssFamily: string;
  /** Weight for both the GF stylesheet axis and the preview font-weight */
  cssWeight: number;
  isPremium: boolean;
};

export const FALLBACK_FONT = "Noto Sans";

export const FONT_REGISTRY: Record<string, FontDef> = {
  "Noto Sans": { assFamily: "Noto Sans", cssFamily: "Noto Sans", cssWeight: 400, isPremium: false },
  Inter: { assFamily: "Inter", cssFamily: "Inter", cssWeight: 400, isPremium: false },
  Montserrat: { assFamily: "Montserrat", cssFamily: "Montserrat", cssWeight: 400, isPremium: false },
  "Courier Prime": { assFamily: "Courier Prime", cssFamily: "Courier Prime", cssWeight: 400, isPremium: false },
  Outfit: { assFamily: "Outfit", cssFamily: "Outfit", cssWeight: 400, isPremium: false },
  // The scroll-stopping bold look must be tastable on the free tier.
  "Montserrat ExtraBold": { assFamily: "Montserrat ExtraBold", cssFamily: "Montserrat", cssWeight: 800, isPremium: false },
  // Premium display fonts.
  Anton: { assFamily: "Anton", cssFamily: "Anton", cssWeight: 400, isPremium: true },
  "Poppins Bold": { assFamily: "Poppins", cssFamily: "Poppins", cssWeight: 700, isPremium: true },
};

export type CaptionSize = "sm" | "md" | "lg";

// Font sizes in the fixed 1080x1920 ASS design space (lib/render.ts); libass
// rescales to the output tier. `md` (64) is the pre-customization default.
// preview values are px in the 112px-wide preview (~1/9.6 of design width).
export const SIZE_PRESETS: Record<CaptionSize, { assFontSize: number; previewPx: number }> = {
  sm: { assFontSize: 52, previewPx: 9 },
  md: { assFontSize: 64, previewPx: 11 },
  lg: { assFontSize: 84, previewPx: 15 },
};

export const DEFAULT_SIZE: CaptionSize = "md";

export type ResolvedClipStyle = {
  /** Display name as stored (registry key) */
  fontName: string;
  font: FontDef;
  size: CaptionSize;
  assFontSize: number;
  previewPx: number;
};

/**
 * Template defaults + per-clip overrides (null = inherit) → one effective
 * style consumed by both buildAssSubtitle and ClipPreviewPlayer, so
 * preview/export parity holds by construction.
 */
export function resolveClipStyle(
  template: Pick<VideoTemplate, "font">,
  segment?: Pick<ClipSegment, "caption_font" | "caption_size"> | null,
): ResolvedClipStyle {
  const requestedFont = segment?.caption_font ?? template.font;
  const fontName = requestedFont in FONT_REGISTRY ? requestedFont : FALLBACK_FONT;
  const size: CaptionSize =
    segment?.caption_size && segment.caption_size in SIZE_PRESETS
      ? segment.caption_size
      : DEFAULT_SIZE;
  return {
    fontName,
    font: FONT_REGISTRY[fontName],
    size,
    assFontSize: SIZE_PRESETS[size].assFontSize,
    previewPx: SIZE_PRESETS[size].previewPx,
  };
}

/** Font names selectable in the customization UI. */
export function selectableFonts(): { name: string; def: FontDef }[] {
  return Object.entries(FONT_REGISTRY).map(([name, def]) => ({ name, def }));
}
