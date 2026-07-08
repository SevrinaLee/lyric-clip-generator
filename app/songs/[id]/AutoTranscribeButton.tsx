"use client";

import { useState, useTransition } from "react";
import { transcribeLyrics } from "./actions";

export function AutoTranscribeButton({ songId }: { songId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await transcribeLyrics(songId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't transcribe audio",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {isPending ? "Transcribing…" : "Auto-transcribe from audio"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
