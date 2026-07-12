"use client";

import { useState, useTransition } from "react";
import type { VideoTemplate } from "@/lib/types";
import { readableTextColor } from "@/lib/fonts";
import { cssBackground, parseBackgroundStyle } from "@/lib/backgrounds";
import { selectTemplate } from "./actions";

const SWATCH_ANIMATION: Record<VideoTemplate["animation_preset"], string> = {
  fade: "animate-[swatch-fade_1.6s_ease-in-out_infinite]",
  bounce: "animate-[swatch-bounce_1s_ease-in-out_infinite]",
  typewriter: "",
};

export function TemplatePicker({
  segmentId,
  templates,
  selectedId,
  paidTier,
  onSelect,
}: {
  segmentId: string;
  templates: VideoTemplate[];
  selectedId: string | null;
  paidTier: boolean;
  onSelect?: (templateId: string) => void;
}) {
  const [current, setCurrent] = useState(selectedId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelect(t: VideoTemplate) {
    if (t.is_premium && !paidTier) {
      setError("Premium template — unlock this song to use it.");
      return;
    }
    setError(null);
    setCurrent(t.id);
    onSelect?.(t.id);
    startTransition(async () => {
      try {
        await selectTemplate(segmentId, t.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (templates.length === 0) {
    return <p className="text-xs text-ink/40">No templates available</p>;
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-xs text-ink/50">Template</span>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {templates.map((t) => {
          const isSelected = current === t.id;
          const textColor = readableTextColor(t.primary_color);
          const locked = t.is_premium && !paidTier;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelect(t)}
              disabled={isPending}
              title={locked ? `${t.name} — premium (unlock this song)` : t.name}
              className={`relative shrink-0 flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all disabled:opacity-50 ${
                isSelected
                  ? "ring-2 ring-offset-2 ring-offset-cream ring-ink"
                  : "ring-1 ring-ink/10 hover:ring-ink/25"
              }`}
            >
              <span
                className="relative flex h-12 w-12 items-center justify-center rounded-lg text-sm font-semibold overflow-hidden"
                style={{
                  background: cssBackground(
                    parseBackgroundStyle(t.background_style, t.primary_color),
                  ),
                  color: textColor,
                }}
              >
                <span
                  className={locked ? "opacity-40" : SWATCH_ANIMATION[t.animation_preset]}
                  style={{ fontFamily: `"${t.font}", sans-serif` }}
                >
                  Aa
                </span>
                {locked && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/35 text-cream text-xs">
                    🔒
                  </span>
                )}
                {t.is_premium && !locked && (
                  <span className="absolute top-0.5 right-0.5 text-[9px] text-gold">
                    ★
                  </span>
                )}
              </span>
              <span className="max-w-14 truncate text-[10px] text-ink/50">
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-mauve">{error}</p>}
    </div>
  );
}
