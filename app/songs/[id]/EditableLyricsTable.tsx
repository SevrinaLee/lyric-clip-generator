"use client";

import { useState, useTransition } from "react";
import type { Lyric } from "@/lib/types";
import { updateLyricTiming } from "./actions";

function msToLabel(ms: number): string {
  return (ms / 1000).toFixed(1);
}

export function EditableLyricsTable({ lyrics }: { lyrics: Lyric[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-ink/50">
          <th className="font-normal pb-2 w-10">#</th>
          <th className="font-normal pb-2">Text</th>
          <th className="font-normal pb-2 w-20">Start (s)</th>
          <th className="font-normal pb-2 w-20">End (s)</th>
          <th className="font-normal pb-2 w-16"></th>
        </tr>
      </thead>
      <tbody>
        {lyrics.map((line) => (
          <LyricRow key={line.id} line={line} />
        ))}
      </tbody>
    </table>
  );
}

function LyricRow({ line }: { line: Lyric }) {
  const [text, setText] = useState(line.text);
  const [start, setStart] = useState(msToLabel(line.start_ms ?? 0));
  const [end, setEnd] = useState(msToLabel(line.end_ms ?? 0));
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <tr className="border-t border-ink/10">
      <td className="py-1.5 text-ink/30 tabular-nums">
        {line.line_index + 1}
      </td>
      <td className="py-1.5 pr-2">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            markDirty();
          }}
          className="w-full rounded-lg border border-transparent hover:border-ink/15 focus:border-lavender focus:outline-none px-1.5 py-1 text-sm text-ink"
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
          className="w-full rounded-lg border border-transparent hover:border-ink/15 focus:border-lavender focus:outline-none px-1.5 py-1 text-sm text-ink tabular-nums"
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
          className="w-full rounded-lg border border-transparent hover:border-ink/15 focus:border-lavender focus:outline-none px-1.5 py-1 text-sm text-ink tabular-nums"
        />
      </td>
      <td className="py-1.5">
        {!saved && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs font-semibold text-mauve hover:underline disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        )}
        {error && <p className="text-xs text-mauve">{error}</p>}
      </td>
    </tr>
  );
}
