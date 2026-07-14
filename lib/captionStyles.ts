// Shared caption-style resolution, used by both the ffmpeg render (server)
// and the CSS preview (client) so they always agree — same pattern as
// lib/backgrounds.ts. The registry is the single source of truth for which
// fonts/presets exist, how the ASS renderer and the browser each address
// them, and which are premium.
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

// ── Caption look presets (Sprint 2) ────────────────────────────────────────
// ASS colours are &HAABBGGRR (alpha, blue, green, red). The high-contrast
// outline styles are the researched scroll-stopping standard; the boxed style
// is the original look, kept as the safe default.

export type CaptionStylePreset = "box" | "outline" | "outline-yellow";

export const STYLE_PRESETS: Record<
  CaptionStylePreset,
  {
    isPremium: boolean;
    // ASS style-line params
    primary: string;
    outline: string;
    back: string;
    borderStyle: number;
    outlineWidth: number;
    shadow: number;
    // CSS preview hints
    previewColor: string;
    previewBox: boolean;
    previewShadow: string;
  }
> = {
  box: {
    isPremium: false,
    primary: "&H00FFFFFF",
    outline: "&H00000000",
    back: "&HA6000000",
    borderStyle: 3,
    outlineWidth: 20,
    shadow: 0,
    previewColor: "#ffffff",
    previewBox: true,
    previewShadow: "none",
  },
  outline: {
    isPremium: false,
    primary: "&H00FFFFFF",
    outline: "&H00000000",
    back: "&H00000000",
    borderStyle: 1,
    outlineWidth: 8,
    shadow: 4,
    previewColor: "#ffffff",
    previewBox: false,
    previewShadow:
      "-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 2px 3px rgba(0,0,0,.55)",
  },
  "outline-yellow": {
    isPremium: true,
    primary: "&H0000FFFF",
    outline: "&H00000000",
    back: "&H00000000",
    borderStyle: 1,
    outlineWidth: 8,
    shadow: 4,
    previewColor: "#ffe600",
    previewBox: false,
    previewShadow:
      "-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 2px 3px rgba(0,0,0,.55)",
  },
};

export const DEFAULT_STYLE_PRESET: CaptionStylePreset = "box";

export type CaptionPosition = "center" | "lower";

// center = middle of frame (ASS Alignment 5). lower = lower-middle third
// (Alignment 2 bottom-anchored + a large MarginV in the 1920 design space),
// clear of the watermark at MarginV 44 and of TikTok's bottom UI.
export const POSITION_PRESETS: Record<
  CaptionPosition,
  { assAlignment: number; assMarginV: number; previewAlign: string }
> = {
  center: { assAlignment: 5, assMarginV: 40, previewAlign: "items-center" },
  lower: { assAlignment: 2, assMarginV: 620, previewAlign: "items-end pb-[20%]" },
};

export const DEFAULT_POSITION: CaptionPosition = "center";

// `wordpop` reveals a line word-by-word with a scale pop; `typewriter` from
// old template rows maps to it (it was a no-op before). fade/bounce unchanged.
export type CaptionAnimation = "fade" | "bounce" | "wordpop";

export const DEFAULT_ANIMATION: CaptionAnimation = "fade";

// Shared word-pop timing (ms) so the ASS transforms and the CSS keyframe stay
// in lockstep. revealMs must be > 0: a zero-duration ASS \t collapses to a
// ramp over the whole event (libass quirk), so each word gets a short, real
// fade-in instead.
export const WORDPOP = { revealMs: 50, popInMs: 140, settleMs: 140, scalePct: 130 };

export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Even distribution of a line's window across its words — the only timing we
// have is line-level, so words are spaced evenly (an accepted approximation).
// Capped so a very long line can't explode the event/DOM count.
export const MAX_WORDPOP_WORDS = 14;

export function wordSchedule(
  text: string,
  lineDurationSec: number,
): { word: string; startSec: number }[] {
  const words = splitWords(text);
  if (words.length === 0 || words.length > MAX_WORDPOP_WORDS) {
    // Fallback: treat the whole line as one "word" revealed at the start.
    return words.length ? [{ word: text.trim(), startSec: 0 }] : [];
  }
  const step = lineDurationSec / words.length;
  return words.map((word, i) => ({ word, startSec: i * step }));
}

// ── Resolution ──────────────────────────────────────────────────────────────

export type AssCaptionStyle = {
  fontFamily: string;
  fontSize: number;
  primary: string;
  outline: string;
  back: string;
  borderStyle: number;
  outlineWidth: number;
  shadow: number;
  alignment: number;
  marginV: number;
  animation: CaptionAnimation;
};

export type PreviewCaptionStyle = {
  cssFamily: string;
  cssWeight: number;
  fontSizePx: number;
  color: string;
  box: boolean;
  textShadow: string;
  align: string;
  animation: CaptionAnimation;
};

export type ResolvedClipStyle = {
  fontName: string;
  font: FontDef;
  size: CaptionSize;
  position: CaptionPosition;
  stylePreset: CaptionStylePreset;
  animation: CaptionAnimation;
  ass: AssCaptionStyle;
  preview: PreviewCaptionStyle;
};

// The per-clip override set (all nullable = inherit). Mirrors the DB columns
// and is what the UI/state and resolveClipStyle pass around.
export type ClipStyleOverrides = Pick<
  ClipSegment,
  "caption_font" | "caption_size" | "caption_position" | "caption_style_preset" | "caption_animation"
>;

type StyleSegment = ClipStyleOverrides;

function normalizeAnimation(raw: string | null | undefined): CaptionAnimation {
  // Legacy template rows store "typewriter" (a former no-op) — map to wordpop.
  if (raw === "typewriter") return "wordpop";
  if (raw === "fade" || raw === "bounce" || raw === "wordpop") return raw;
  return DEFAULT_ANIMATION;
}

/**
 * Template defaults + per-clip overrides (null = inherit) → one effective
 * style consumed by both buildAssSubtitle and ClipPreviewPlayer, so
 * preview/export parity holds by construction.
 */
export function resolveClipStyle(
  template: Pick<VideoTemplate, "font" | "animation_preset">,
  segment?: StyleSegment | null,
): ResolvedClipStyle {
  const requestedFont = segment?.caption_font ?? template.font;
  const fontName = requestedFont in FONT_REGISTRY ? requestedFont : FALLBACK_FONT;
  const font = FONT_REGISTRY[fontName];

  const size: CaptionSize =
    segment?.caption_size && segment.caption_size in SIZE_PRESETS
      ? segment.caption_size
      : DEFAULT_SIZE;

  const position: CaptionPosition =
    segment?.caption_position && segment.caption_position in POSITION_PRESETS
      ? segment.caption_position
      : DEFAULT_POSITION;

  const stylePreset: CaptionStylePreset =
    segment?.caption_style_preset && segment.caption_style_preset in STYLE_PRESETS
      ? segment.caption_style_preset
      : DEFAULT_STYLE_PRESET;

  const animation = normalizeAnimation(
    segment?.caption_animation ?? template.animation_preset,
  );

  const sz = SIZE_PRESETS[size];
  const pos = POSITION_PRESETS[position];
  const preset = STYLE_PRESETS[stylePreset];

  return {
    fontName,
    font,
    size,
    position,
    stylePreset,
    animation,
    ass: {
      fontFamily: font.assFamily,
      fontSize: sz.assFontSize,
      primary: preset.primary,
      outline: preset.outline,
      back: preset.back,
      borderStyle: preset.borderStyle,
      outlineWidth: preset.outlineWidth,
      shadow: preset.shadow,
      alignment: pos.assAlignment,
      marginV: pos.assMarginV,
      animation,
    },
    preview: {
      cssFamily: font.cssFamily,
      cssWeight: font.cssWeight,
      fontSizePx: sz.previewPx,
      color: preset.previewColor,
      box: preset.previewBox,
      textShadow: preset.previewShadow,
      align: pos.previewAlign,
      animation,
    },
  };
}

/** Font names selectable in the customization UI. */
export function selectableFonts(): { name: string; def: FontDef }[] {
  return Object.entries(FONT_REGISTRY).map(([name, def]) => ({ name, def }));
}
