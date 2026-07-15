// Export aspect ratios (aesthetics v1.4 Sprint 4.1). 9:16 is the free default;
// the others are premium ("export every format"). The paid tier renders each
// format at full resolution; the free tier scales down (only 9:16 is ever free
// in practice, so this keeps the existing 720x1280 free size).
//
// Captions don't need per-format tweaks: render.ts authors the ASS at a fixed
// reference HEIGHT (1920) with an aspect-matched PlayResX, so font sizes and
// the lower-third margin stay consistent and libass scales without distortion.

export type ClipFormat = "9:16" | "1:1" | "4:5" | "16:9";

export const DEFAULT_FORMAT: ClipFormat = "9:16";

const FREE_SCALE = 2 / 3; // 1080x1920 -> 720x1280, matching the prior free tier

export const FORMAT_PRESETS: Record<
  ClipFormat,
  { label: string; hint: string; width: number; height: number; isPremium: boolean }
> = {
  "9:16": { label: "9:16", hint: "Reels · TikTok · Shorts", width: 1080, height: 1920, isPremium: false },
  "1:1": { label: "1:1", hint: "Feed square", width: 1080, height: 1080, isPremium: true },
  "4:5": { label: "4:5", hint: "Feed portrait", width: 1080, height: 1350, isPremium: true },
  "16:9": { label: "16:9", hint: "YouTube · landscape", width: 1920, height: 1080, isPremium: true },
};

export const CLIP_FORMATS = Object.keys(FORMAT_PRESETS) as ClipFormat[];

const even = (n: number) => Math.round(n / 2) * 2;

/** Output dimensions for a format at the given tier (paid = full, free = 2/3). */
export function renderDimensions(
  format: ClipFormat,
  isPaid: boolean,
): { width: number; height: number } {
  const p = FORMAT_PRESETS[format] ?? FORMAT_PRESETS[DEFAULT_FORMAT];
  const scale = isPaid ? 1 : FREE_SCALE;
  return { width: even(p.width * scale), height: even(p.height * scale) };
}

export function isFormat(v: unknown): v is ClipFormat {
  return typeof v === "string" && v in FORMAT_PRESETS;
}

export function isFormatPremium(format: ClipFormat): boolean {
  return FORMAT_PRESETS[format]?.isPremium ?? false;
}

/** Filesystem/storage-safe form of a format ("16:9" -> "16x9"). */
export function formatSlug(format: ClipFormat): string {
  return format.replace(":", "x");
}
