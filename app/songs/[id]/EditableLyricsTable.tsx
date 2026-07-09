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
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-ink/50">
          <th className="font-normal pb-2 w-10">#</th>
          <th className="font-normal pb-2">Text</th>
          <th className="font-normal pb-2 w-20">Start (s)</th>
          <th className="font-normal pb-2 w-20">End (s)</th>
          <th className="font-normal pb-2 w-14"></th>
        </tr>
      </thead>
      <tbody>
        {lyrics.map((line, index) => (
          <LyricRow key={line.id} line={line} displayNumber={index + 1} />
        ))}
      </tbody>
    </table>
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

  return (
    <tr className="border-t border-ink/10">
      <td className="py-1.5 text-ink/30 tabular-nums">{displayNumber}</td>
      <td className="py-1.5 pr-2">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            markDirty();
          }}
          placeholder="(empty — delete this line?)"
          className="w-full rounded-lg border border-transparent hover:border-ink/15 focus:border-lavender focus:outline-none px-1.5 py-1 text-sm text-ink placeholder:text-ink/30 placeholder:italic"
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            markDirty();
          }}
          inputMode="decimal"
          title={line.isEstimated ? "Estimated — adjust by ear" : undefined}
          className={`w-full rounded-lg border border-transparent hover:border-ink/15 focus:border-lavender focus:outline-none px-1.5 py-1 text-sm tabular-nums ${line.isEstimated && saved ? "text-ink/40 italic" : "text-ink"}`}
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          value={end}
          onChange={(e) => {
            setEnd(e.target.value);
            markDirty();
          }}
          inputMode="decimal"
          title={line.isEstimated ? "Estimated — adjust by ear" : undefined}
          className={`w-full rounded-lg border border-transparent hover:border-ink/15 focus:border-lavender focus:outline-none px-1.5 py-1 text-sm tabular-nums ${line.isEstimated && saved ? "text-ink/40 italic" : "text-ink"}`}
        />
      </td>
      <td className="py-1.5">
        <div className="flex items-center gap-2">
          {!saved && (
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-semibold text-mauve hover:underline disabled:opacity-50"
            >
              {isPending ? "…" : "Save"}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isPending}
            title="Delete line"
            className="text-ink/30 hover:text-mauve disabled:opacity-50"
          >
            ✕
          </button>
        </div>
        {error && <p className="text-xs text-mauve">{error}</p>}
      </td>
    </tr>
  );
}
