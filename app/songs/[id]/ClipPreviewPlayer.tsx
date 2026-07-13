"use client";

import { useRef, useState } from "react";
import type { VideoTemplate } from "@/lib/types";
import { cssBackground, parseBackgroundStyle } from "@/lib/backgrounds";
import type { ResolvedClipStyle } from "@/lib/captionStyles";

type PreviewLine = { text: string; offsetSeconds: number };

const LINE_ANIMATION: Record<VideoTemplate["animation_preset"], string> = {
  fade: "animate-[clip-fade-in_0.4s_ease-out]",
  bounce: "animate-[clip-bounce_1s_ease-in-out_infinite]",
  typewriter: "",
};

export function ClipPreviewPlayer({
  audioUrl,
  startMs,
  endMs,
  lines,
  template,
  clipStyle,
}: {
  audioUrl: string;
  startMs: number;
  endMs: number;
  lines: PreviewLine[];
  template: VideoTemplate;
  /** Effective caption style (template + per-clip overrides), resolved by
   *  lib/captionStyles.ts — the same object the export render consumes. */
  clipStyle: ResolvedClipStyle;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const durationSeconds = (endMs - startMs) / 1000;

  function handleToggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio.currentTime = startMs / 1000;
    audio.play();
    setIsPlaying(true);
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;

    const relative = audio.currentTime - startMs / 1000;
    if (relative >= durationSeconds) {
      audio.pause();
      audio.currentTime = startMs / 1000;
      setIsPlaying(false);
      setActiveIndex(0);
      return;
    }

    let next = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].offsetSeconds <= relative) next = i;
    }
    setActiveIndex(next);
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative aspect-9/16 w-28 shrink-0 overflow-hidden rounded-xl"
        style={{
          background: cssBackground(
            parseBackgroundStyle(template.background_style, template.primary_color),
          ),
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center">
          {/* Mirrors the export's ASS style: white text on a ~65% black box,
              which keeps captions readable over any background visual. */}
          <span
            key={activeIndex}
            className={`rounded bg-black/60 px-1.5 py-1 leading-tight text-white ${LINE_ANIMATION[template.animation_preset]}`}
            style={{
              fontFamily: `"${clipStyle.font.cssFamily}", sans-serif`,
              fontWeight: clipStyle.font.cssWeight,
              fontSize: `${clipStyle.previewPx}px`,
            }}
          >
            {lines[activeIndex]?.text}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        className="rounded-full border border-ink/20 text-ink px-4 py-2 text-sm font-semibold hover:bg-ink/5 transition-colors"
      >
        {isPlaying ? "Pause preview" : "▶ Preview"}
      </button>

      <audio
        ref={audioRef}
        src={audioUrl}
        preload="none"
        onTimeUpdate={handleTimeUpdate}
        className="hidden"
      />
    </div>
  );
}
