"use client";

import { useState, useTransition } from "react";
import type { VideoTemplate } from "@/lib/types";
import {
  FONT_REGISTRY,
  SIZE_PRESETS,
  STYLE_PRESETS,
  POSITION_PRESETS,
  DEFAULT_SIZE,
  DEFAULT_POSITION,
  DEFAULT_STYLE_PRESET,
  selectableFonts,
  resolveClipStyle,
  isAnimationPremium,
  type ClipStyleOverrides,
  type CaptionSize,
  type CaptionPosition,
  type CaptionStylePreset,
  type CaptionAnimation,
} from "@/lib/captionStyles";
import {
  parseBackgroundStyle,
  resolveSegmentBackground,
} from "@/lib/backgrounds";
import { updateClipStyle } from "./actions";

const SIZE_LABEL: Record<CaptionSize, string> = { sm: "S", md: "M", lg: "L" };
const POSITION_LABEL: Record<CaptionPosition, string> = {
  center: "Center",
  lower: "Lower third",
};
const STYLE_LABEL: Record<CaptionStylePreset, string> = {
  box: "Box",
  outline: "Outline",
  "outline-yellow": "Yellow",
};
const ANIM_LABEL: Record<CaptionAnimation, string> = {
  fade: "Fade",
  bounce: "Bounce",
  wordpop: "Word pop",
  karaoke: "Karaoke",
};

const NO_OVERRIDES: ClipStyleOverrides = {
  caption_font: null,
  caption_size: null,
  caption_position: null,
  caption_style_preset: null,
  caption_animation: null,
  custom_bg_c0: null,
  custom_bg_c1: null,
  custom_caption_color: null,
};

// The two effective background colors currently shown for a clip — the custom
// pair if set, otherwise the template's (a solid shows the same color twice).
// Lets the color pickers open on the current look instead of black.
function effectiveBgPair(
  template: VideoTemplate,
  ov: ClipStyleOverrides,
): [string, string] {
  const bg = resolveSegmentBackground(template, ov);
  const parsed = parseBackgroundStyle(bg.backgroundStyle, bg.primaryColor);
  return parsed.type === "solid" ? [parsed.color, parsed.color] : parsed.colors;
}

// Per-clip caption customization (aesthetics Sprint 4): a collapsible panel
// consolidating font, size, position, style preset, and animation over the
// selected template. Premium options stay visible but locked for unpaid songs
// (same affordance as TemplatePicker); updateClipStyle re-checks server-side.
// Setting an axis to the template's inherited value clears that override;
// "Reset to template" clears them all (stores NULL = inherit).
export function ClipStylePanel({
  segmentId,
  template,
  initial,
  paidTier,
  onChange,
}: {
  segmentId: string;
  template: VideoTemplate;
  initial: ClipStyleOverrides;
  paidTier: boolean;
  onChange?: (overrides: ClipStyleOverrides) => void;
}) {
  const [ov, setOv] = useState<ClipStyleOverrides>(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const eff = resolveClipStyle(template, ov);
  const inheritedFont =
    template.font in FONT_REGISTRY ? template.font : "Noto Sans";
  const hasOverrides = Object.values(ov).some((v) => v != null);

  function commit(next: ClipStyleOverrides) {
    setError(null);
    setOv(next);
    onChange?.(next);
    startTransition(async () => {
      try {
        await updateClipStyle(segmentId, next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save style");
      }
    });
  }

  function handleFont(name: string) {
    const def = FONT_REGISTRY[name];
    if (def?.isPremium && !paidTier) {
      setError("Premium font — unlock this song to use it.");
      return;
    }
    commit({ ...ov, caption_font: name === inheritedFont ? null : name });
  }
  const handleSize = (s: CaptionSize) =>
    commit({ ...ov, caption_size: s === DEFAULT_SIZE ? null : s });
  const handlePosition = (p: CaptionPosition) =>
    commit({ ...ov, caption_position: p === DEFAULT_POSITION ? null : p });
  function handleStyle(sp: CaptionStylePreset) {
    if (STYLE_PRESETS[sp].isPremium && !paidTier) {
      setError("Premium caption style — unlock this song to use it.");
      return;
    }
    commit({ ...ov, caption_style_preset: sp === DEFAULT_STYLE_PRESET ? null : sp });
  }
  function handleAnim(a: CaptionAnimation) {
    if (isAnimationPremium(a) && !paidTier) {
      setError("Premium animation — unlock this song to use it.");
      return;
    }
    const inherited = resolveClipStyle(template, {
      ...ov,
      caption_animation: null,
    }).animation;
    commit({ ...ov, caption_animation: a === inherited ? null : a });
  }

  // Custom colors (S7.2) — free. The two background colors are a pair: setting
  // one initializes the other from the current look so a single pick yields a
  // sensible gradient/solid rather than a jump to black.
  const [bg0, bg1] = effectiveBgPair(template, ov);
  const captionColor = eff.preview.color;
  const hasCustomBg = ov.custom_bg_c0 != null || ov.custom_bg_c1 != null;
  function handleBgColor(idx: 0 | 1, hex: string) {
    const pair: [string, string] = [bg0, bg1];
    pair[idx] = hex;
    commit({ ...ov, custom_bg_c0: pair[0], custom_bg_c1: pair[1] });
  }
  const clearBg = () => commit({ ...ov, custom_bg_c0: null, custom_bg_c1: null });
  const handleCaptionColor = (hex: string) =>
    commit({ ...ov, custom_caption_color: hex });
  const clearCaptionColor = () => commit({ ...ov, custom_caption_color: null });

  const chip = (active: boolean) =>
    `px-2.5 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-ink text-cream" : "bg-cream text-ink/60 hover:bg-ink/5"
    }`;

  const summary = `${eff.fontName} · ${SIZE_LABEL[eff.size]} · ${POSITION_LABEL[eff.position]} · ${STYLE_LABEL[eff.stylePreset]} · ${ANIM_LABEL[eff.animation]}`;

  return (
    <div className="rounded-xl border border-ink/10 bg-cream-deep/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-ink">✨ Customize</span>
          <span className="truncate text-[11px] text-ink/45">{summary}</span>
        </span>
        <span className="shrink-0 text-ink/40 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-2 px-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={eff.fontName}
              onChange={(e) => handleFont(e.target.value)}
              className="rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-xs text-ink"
            >
              {selectableFonts().map(({ name, def }) => {
                const locked = def.isPremium && !paidTier;
                return (
                  <option key={name} value={name}>
                    {name}
                    {locked ? " 🔒" : def.isPremium ? " ★" : ""}
                  </option>
                );
              })}
            </select>

            <div className="flex rounded-lg border border-ink/15 overflow-hidden">
              {(Object.keys(SIZE_PRESETS) as CaptionSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSize(s)}
                  title={`${SIZE_LABEL[s]} caption size`}
                  className={chip(eff.size === s)}
                >
                  {SIZE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-ink/15 overflow-hidden">
              {(Object.keys(POSITION_PRESETS) as CaptionPosition[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePosition(p)}
                  className={chip(eff.position === p)}
                >
                  {POSITION_LABEL[p]}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-ink/15 overflow-hidden">
              {(Object.keys(STYLE_PRESETS) as CaptionStylePreset[]).map((sp) => {
                const locked = STYLE_PRESETS[sp].isPremium && !paidTier;
                return (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => handleStyle(sp)}
                    title={locked ? `${STYLE_LABEL[sp]} — premium` : STYLE_LABEL[sp]}
                    className={chip(eff.stylePreset === sp)}
                  >
                    {STYLE_LABEL[sp]}
                    {locked ? " 🔒" : STYLE_PRESETS[sp].isPremium ? " ★" : ""}
                  </button>
                );
              })}
            </div>

            <div className="flex rounded-lg border border-ink/15 overflow-hidden">
              {(["fade", "bounce", "wordpop", "karaoke"] as CaptionAnimation[]).map(
                (a) => {
                  const locked = isAnimationPremium(a) && !paidTier;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => handleAnim(a)}
                      title={locked ? `${ANIM_LABEL[a]} — premium` : ANIM_LABEL[a]}
                      className={chip(eff.animation === a)}
                    >
                      {ANIM_LABEL[a]}
                      {locked ? " 🔒" : isAnimationPremium(a) ? " ★" : ""}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-[11px] text-ink/55">
              <span>Background</span>
              <input
                type="color"
                aria-label="Background color 1"
                value={bg0}
                onChange={(e) => handleBgColor(0, e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-ink/15 bg-transparent p-0"
              />
              <input
                type="color"
                aria-label="Background color 2"
                value={bg1}
                onChange={(e) => handleBgColor(1, e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-ink/15 bg-transparent p-0"
              />
              {hasCustomBg && (
                <button
                  type="button"
                  onClick={clearBg}
                  className="text-ink/35 hover:text-ink"
                  title="Reset background to template"
                >
                  ✕
                </button>
              )}
            </label>

            <label className="flex items-center gap-1.5 text-[11px] text-ink/55">
              <span>Caption</span>
              <input
                type="color"
                aria-label="Caption color"
                value={captionColor.startsWith("#") ? captionColor : "#ffffff"}
                onChange={(e) => handleCaptionColor(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-ink/15 bg-transparent p-0"
              />
              {ov.custom_caption_color != null && (
                <button
                  type="button"
                  onClick={clearCaptionColor}
                  className="text-ink/35 hover:text-ink"
                  title="Reset caption color to style default"
                >
                  ✕
                </button>
              )}
            </label>
          </div>

          {hasOverrides && (
            <button
              type="button"
              onClick={() => commit({ ...NO_OVERRIDES })}
              className="text-xs text-ink/45 hover:text-ink hover:underline"
            >
              ↺ Reset to template
            </button>
          )}

          {error && <p className="text-sm text-mauve">{error}</p>}
        </div>
      )}
    </div>
  );
}
