"use client";

import { useState, useTransition } from "react";
import type { Lyric } from "@/lib/types";
import { deleteLyric, updateLyricTiming } from "./actions";

function msToLabel(ms: number): string {
  return (ms / 1000).toFixed(1);
}

/** A lyric line whose start_ms/end_ms may be a real, confirmed timestamp
 * (Whisper, or a prior manual save) or just the best-effort estimate from
 * lib/scoring.ts's timeLines — isEstimated tells the row which. */
export type EditableLine = Lyric & { isEstimated: boolean };

export function EditableLyricsTable({ lyrics }: { lyrics: EditableLine[] }) {
  // Reflowing layout instead of a fixed 5-column table: on a phone the text
  // input takes the first line and the start/end/delete controls wrap beneath
  // it; on wider screens everything sits inline.
  return (
    <div className="text-sm">
      {lyrics.map((line, index) => (
        <LyricRow key={line.id} line={line} displayNumber={index + 1} />
      ))}
    </div>
  );
}

function LyricRow({
  line,
  displayNumber,
}: {
  line: EditableLine;
  displayNumber: number;
}) {
  const [text, setText] = useState(line.text);
  const [start, setStart] = useState(msToLabel(line.start_ms ?? 0));
  const [end, setEnd] = useState(msToLabel(line.end_ms ?? 0));
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeleted, setIsDeleted] = useState(false);

  function markDirty() {
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateLyricTiming(line.id, {
          text,
          start_ms: Math.round(parseFloat(start) * 1000),
          end_ms: Math.round(parseFloat(end) * 1000),
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteLyric(line.id);
        setIsDeleted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete");
      }
    });
  }

  if (isDeleted) return null;

  const timeInput = (line.isEstimated && saved ? "text-ink/40 italic" : "text-ink");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink/10 py-2">
      <span className="w-4 shrink-0 text-ink/30 tabular-nums text-xs">
        {displayNumber}
      </span>

      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          markDirty();
        }}
        placeholder="(empty — delete this line?)"
        aria-label="Lyric text"
        className="min-w-[150px] flex-1 rounded-lg border border-transparent hover:border-ink/15 focus:border-lavender focus:outline-none px-1.5 py-1.5 text-sm text-ink placeholder:text-ink/30 placeholder:italic"
      />

      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-1 text-[10px] text-ink/40">
          <span>start</span>
          <input
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              markDirty();
            }}
            inputMode="decimal"
            aria-label="Start seconds"
            title={line.isEstimated ? "Estimated — adjust by ear" : undefined}
            className={`w-14 rounded-lg border border-ink/10 hover:border-ink/20 focus:border-lavender focus:outline-none px-1.5 py-1.5 text-sm tabular-nums ${timeInput}`}
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-ink/40">
          <span>end</span>
          <input
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              markDirty();
            }}
            inputMode="decimal"
            aria-label="End seconds"
            title={line.isEstimated ? "Estimated — adjust by ear" : undefined}
            className={`w-14 rounded-lg border border-ink/10 hover:border-ink/20 focus:border-lavender focus:outline-none px-1.5 py-1.5 text-sm tabular-nums ${timeInput}`}
          />
        </label>

        {!saved && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-mauve hover:bg-mauve/10 disabled:opacity-50"
          >
            {isPending ? "…" : "Save"}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={isPending}
          aria-label="Delete line"
          title="Delete line"
          className="rounded-lg p-1.5 text-ink/30 hover:text-mauve hover:bg-mauve/10 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
      {error && <p className="w-full text-xs text-mauve">{error}</p>}
    </div>
  );
}
