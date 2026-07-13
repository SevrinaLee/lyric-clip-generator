"use client";

import { useState, useTransition } from "react";
import {
  FONT_REGISTRY,
  SIZE_PRESETS,
  DEFAULT_SIZE,
  selectableFonts,
  type CaptionSize,
} from "@/lib/captionStyles";
import { updateClipStyle } from "./actions";

const SIZE_LABEL: Record<CaptionSize, string> = { sm: "S", md: "M", lg: "L" };

// Minimal per-clip caption customization (Sprint 1 of the aesthetics plan):
// font family + size. Premium fonts stay visible but locked for unpaid songs
// (same upsell affordance as TemplatePicker); the server action re-checks.
export function ClipStyleRow({
  segmentId,
  templateFont,
  initialFont,
  initialSize,
  paidTier,
  onChange,
}: {
  segmentId: string;
  templateFont: string;
  initialFont: string | null;
  initialSize: CaptionSize | null;
  paidTier: boolean;
  onChange?: (font: string | null, size: CaptionSize | null) => void;
}) {
  const [font, setFont] = useState<string | null>(initialFont);
  const [size, setSize] = useState<CaptionSize | null>(initialSize);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Shown value falls back to the template's font (null = inherit).
  const effectiveFont =
    (font ?? templateFont) in FONT_REGISTRY ? (font ?? templateFont) : "Noto Sans";
  const effectiveSize = size ?? DEFAULT_SIZE;

  function persist(nextFont: string | null, nextSize: CaptionSize | null) {
    setError(null);
    onChange?.(nextFont, nextSize);
    startTransition(async () => {
      try {
        await updateClipStyle(segmentId, {
          caption_font: nextFont,
          caption_size: nextSize,
        });
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
    // Picking the template's own font = clear the override.
    const next = name === templateFont ? null : name;
    setFont(next);
    persist(next, size);
  }

  function handleSize(s: CaptionSize) {
    const next = s === DEFAULT_SIZE ? null : s;
    setSize(next);
    persist(font, next);
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-xs text-ink/50">Caption style</span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={effectiveFont}
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
              className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                effectiveSize === s
                  ? "bg-ink text-cream"
                  : "bg-cream text-ink/60 hover:bg-ink/5"
              }`}
            >
              {SIZE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-mauve">{error}</p>}
    </div>
  );
}
