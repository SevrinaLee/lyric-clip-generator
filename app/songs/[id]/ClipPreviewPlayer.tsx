"use client";

import { useRef, useState } from "react";
import type { VideoTemplate } from "@/lib/types";
import {
  cssBackground,
  parseBackgroundStyle,
  resolveSegmentBackground,
} from "@/lib/backgrounds";
import {
  wordSchedule,
  type CaptionAnimation,
  type ResolvedClipStyle,
} from "@/lib/captionStyles";
import type { PreviewLine } from "@/lib/scoring";
import { DEFAULT_FORMAT, type ClipFormat } from "@/lib/formats";

const LINE_ANIMATION: Record<CaptionAnimation, string> = {
  fade: "animate-[clip-fade-in_0.4s_ease-out]",
  bounce: "animate-[clip-bounce_1s_ease-in-out_infinite]",
  wordpop: "",
  karaoke: "",
};

// Preview container shape per export format (so the preview matches what
// exports). Widths chosen so the tall/short frames stay a similar footprint.
const FORMAT_BOX: Record<ClipFormat, string> = {
  "9:16": "aspect-9/16 w-28",
  "1:1": "aspect-square w-32",
  "4:5": "aspect-[4/5] w-28",
  "16:9": "aspect-video w-44",
};

export function ClipPreviewPlayer({
  audioUrl,
  startMs,
  endMs,
  lines,
  template,
  clipStyle,
  bgColors,
  format = DEFAULT_FORMAT,
}: {
  audioUrl: string;
  startMs: number;
  endMs: number;
  lines: PreviewLine[];
  template: VideoTemplate;
  /** Effective caption style (template + per-clip overrides), resolved by
   *  lib/captionStyles.ts — the same object the export render consumes. */
  clipStyle: ResolvedClipStyle;
  /** Per-clip custom background colors (S7.2); override the template when set.
   *  Same resolver the render uses, so preview/export agree. */
  bgColors?: { custom_bg_c0?: string | null; custom_bg_c1?: string | null };
  /** Export aspect ratio, so the preview frame matches the output. */
  format?: ClipFormat;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [relative, setRelative] = useState(0);

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

    const rel = audio.currentTime - startMs / 1000;
    if (rel >= durationSeconds) {
      audio.pause();
      audio.currentTime = startMs / 1000;
      setIsPlaying(false);
      setActiveIndex(0);
      setRelative(0);
      return;
    }

    setRelative(rel);
    let next = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].offsetSeconds <= rel) next = i;
    }
    setActiveIndex(next);
  }

  const p = clipStyle.preview;
  const line = lines[activeIndex];
  const nextOffset = lines[activeIndex + 1]?.offsetSeconds ?? durationSeconds;
  const lineElapsed = relative - (line?.offsetSeconds ?? 0);

  // Box preset = black backing box; outline presets = no box + text outline
  // (approximated with a multi-shadow). Mirrors the export's ASS style.
  const boxClass = p.box ? "rounded bg-black/60 px-1.5 py-1" : "px-1";
  const spanStyle = {
    fontFamily: `"${p.cssFamily}", sans-serif`,
    fontWeight: p.cssWeight,
    fontSize: `${p.fontSizePx}px`,
    color: p.color,
    textShadow: p.box ? undefined : p.textShadow,
  } as const;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative ${FORMAT_BOX[format]} shrink-0 overflow-hidden rounded-xl`}
        style={{
          background: cssBackground(
            (() => {
              const bg = resolveSegmentBackground(template, bgColors);
              return parseBackgroundStyle(bg.backgroundStyle, bg.primaryColor);
            })(),
          ),
        }}
      >
        <div
          className={`absolute inset-0 flex justify-center p-2 text-center ${p.align}`}
        >
          {p.animation === "wordpop" && line ? (
            <span
              className={`${boxClass} inline-flex flex-wrap justify-center gap-x-1 leading-tight`}
              style={spanStyle}
            >
              {wordSchedule(
                line.text,
                nextOffset - line.offsetSeconds,
                line.words,
              ).map((w, i) => {
                const shown = !isPlaying || lineElapsed >= w.startSec;
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      opacity: shown ? 1 : 0,
                      transform: shown ? "scale(1)" : "scale(1.3)",
                      transition:
                        "opacity 90ms ease, transform 220ms cubic-bezier(.2,1.5,.4,1)",
                    }}
                  >
                    {w.word}
                  </span>
                );
              })}
            </span>
          ) : p.animation === "karaoke" && line ? (
            <span
              className={`${boxClass} inline-flex flex-wrap justify-center gap-x-1 leading-tight`}
              style={spanStyle}
            >
              {wordSchedule(
                line.text,
                nextOffset - line.offsetSeconds,
                line.words,
              ).map((w, i) => {
                // Sung words take the caption colour; unsung dim (mirrors the
                // ASS \k Secondary→Primary fill).
                const sung = !isPlaying || lineElapsed >= w.startSec;
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      color: sung ? p.color : "#808080",
                      transition: "color 120ms linear",
                    }}
                  >
                    {w.word}
                  </span>
                );
              })}
            </span>
          ) : (
            <span
              key={activeIndex}
              className={`${boxClass} leading-tight ${LINE_ANIMATION[p.animation]}`}
              style={spanStyle}
            >
              {line?.text}
            </span>
          )}
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
