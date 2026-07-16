// Curated "Looks" — one-tap style bundles that set a clip's template AND all
// five caption axes at once (aesthetics v1.3 Sprint 3.3). Templates are the
// building blocks; Looks are the fast path.
//
// Code-defined on purpose (no DB table): a Look references template names and
// registry keys, so a TS module gets typechecked against both — a table would
// silently rot. Premium status is DERIVED from the referenced template +
// overrides, so there's no separate flag to drift. Looks whose template isn't
// present at runtime are simply filtered out (see availableLooks).

import type { ClipStyleOverrides } from "./captionStyles";
import { FONT_REGISTRY, STYLE_PRESETS, isAnimationPremium } from "./captionStyles";
import type { VideoTemplate } from "./types";

export type Look = {
  id: string;
  name: string;
  emoji: string;
  /** Resolved to a video_templates row by name at runtime. */
  templateName: string;
  overrides: Required<{
    [K in keyof ClipStyleOverrides]: NonNullable<ClipStyleOverrides[K]>;
  }>;
};

export const LOOKS: Look[] = [
  {
    id: "punchy",
    name: "Punchy",
    emoji: "⚡",
    templateName: "Pulse Violet", // free pulse background
    overrides: {
      caption_font: "Montserrat ExtraBold",
      caption_size: "lg",
      caption_style_preset: "outline",
      caption_position: "lower",
      caption_animation: "wordpop",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    emoji: "🎞️",
    templateName: "Clean Fade", // free solid
    overrides: {
      caption_font: "Courier Prime",
      caption_size: "sm",
      caption_style_preset: "box",
      caption_position: "center",
      caption_animation: "fade",
    },
  },
  {
    id: "viral",
    name: "Viral",
    emoji: "🔥",
    templateName: "Sound Wave", // premium waveform
    overrides: {
      caption_font: "Anton",
      caption_size: "lg",
      caption_style_preset: "outline-yellow",
      caption_position: "lower",
      caption_animation: "wordpop",
    },
  },
  {
    id: "wave",
    name: "Wave",
    emoji: "🌊",
    templateName: "Neon Wave", // premium waveform
    overrides: {
      caption_font: "Montserrat ExtraBold",
      caption_size: "lg",
      caption_style_preset: "outline",
      caption_position: "lower",
      caption_animation: "wordpop",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    emoji: "🌅",
    templateName: "Sunset Glow", // premium gradient
    overrides: {
      caption_font: "Outfit",
      caption_size: "md",
      caption_style_preset: "box",
      caption_position: "center",
      caption_animation: "fade",
    },
  },
  {
    id: "ink",
    name: "Bold Dark",
    emoji: "🖤",
    templateName: "Ink", // free solid
    overrides: {
      caption_font: "Montserrat ExtraBold",
      caption_size: "lg",
      caption_style_preset: "outline",
      caption_position: "lower",
      caption_animation: "wordpop",
    },
  },
  {
    id: "crimson",
    name: "Crimson",
    emoji: "🔴",
    templateName: "Crimson Wave", // premium waveform
    overrides: {
      caption_font: "Anton",
      caption_size: "lg",
      caption_style_preset: "outline-yellow",
      caption_position: "lower",
      caption_animation: "karaoke",
    },
  },
  {
    id: "dream",
    name: "Dream",
    emoji: "🌌",
    templateName: "Aurora", // premium gradient
    overrides: {
      caption_font: "Poppins Bold",
      caption_size: "md",
      caption_style_preset: "box",
      caption_position: "center",
      caption_animation: "fade",
    },
  },
];

export function resolveLookTemplate(
  look: Look,
  templates: VideoTemplate[],
): VideoTemplate | undefined {
  return templates.find((t) => t.name === look.templateName);
}

/** Premium if the referenced template OR any override is premium. Derived. */
export function isLookPremium(look: Look, templates: VideoTemplate[]): boolean {
  if (resolveLookTemplate(look, templates)?.is_premium) return true;
  const ov = look.overrides;
  if (FONT_REGISTRY[ov.caption_font]?.isPremium) return true;
  if (STYLE_PRESETS[ov.caption_style_preset]?.isPremium) return true;
  if (isAnimationPremium(ov.caption_animation)) return true;
  return false;
}

/** Only Looks whose template exists right now (guards against drift). */
export function availableLooks(templates: VideoTemplate[]): Look[] {
  return LOOKS.filter((l) => resolveLookTemplate(l, templates));
}

/** Is this Look the clip's current template + exact overrides? */
export function matchesLook(
  look: Look,
  templateId: string | null,
  overrides: ClipStyleOverrides,
  templates: VideoTemplate[],
): boolean {
  if (resolveLookTemplate(look, templates)?.id !== templateId) return false;
  const ov = look.overrides;
  return (
    overrides.caption_font === ov.caption_font &&
    overrides.caption_size === ov.caption_size &&
    overrides.caption_style_preset === ov.caption_style_preset &&
    overrides.caption_position === ov.caption_position &&
    overrides.caption_animation === ov.caption_animation
  );
}
