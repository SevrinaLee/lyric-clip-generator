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
  type ClipStyleOverrides,
  type CaptionSize,
  type CaptionPosition,
  type CaptionStylePreset,
  type CaptionAnimation,
} from "@/lib/captionStyles";
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
};

// Per-clip caption customization (aesthetics Sprints 1–2): font, size,
// position, style preset, animation. Premium options stay visible but locked
// for unpaid songs (same upsell affordance as TemplatePicker); the
// updateClipStyle server action re-checks. Setting an axis back to the
// template's inherited value clears the override (stores NULL).
export function ClipStyleRow({
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
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Effective (resolved) values, used to highlight the active option.
  const eff = resolveClipStyle(template, ov);
  const inheritedFont =
    template.font in FONT_REGISTRY ? template.font : "Noto Sans";

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

  function handleSize(s: CaptionSize) {
    commit({ ...ov, caption_size: s === DEFAULT_SIZE ? null : s });
  }

  function handlePosition(p: CaptionPosition) {
    commit({ ...ov, caption_position: p === DEFAULT_POSITION ? null : p });
  }

  function handleStyle(sp: CaptionStylePreset) {
    if (STYLE_PRESETS[sp].isPremium && !paidTier) {
      setError("Premium caption style — unlock this song to use it.");
      return;
    }
    commit({
      ...ov,
      caption_style_preset: sp === DEFAULT_STYLE_PRESET ? null : sp,
    });
  }

  function handleAnim(a: CaptionAnimation) {
    // Clearing to null means "inherit the template", whose effective animation
    // is eff.animation when no override is set — so match against that.
    const inherited = resolveClipStyle(template, {
      ...ov,
      caption_animation: null,
    }).animation;
    commit({ ...ov, caption_animation: a === inherited ? null : a });
  }

  const chip = (active: boolean) =>
    `px-2.5 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-ink text-cream" : "bg-cream text-ink/60 hover:bg-ink/5"
    }`;

  return (
    <div className="space-y-2">
      <span className="block text-xs text-ink/50">Caption style</span>

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
          {(["fade", "bounce", "wordpop"] as CaptionAnimation[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => handleAnim(a)}
              className={chip(eff.animation === a)}
            >
              {ANIM_LABEL[a]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-mauve">{error}</p>}
    </div>
  );
}
