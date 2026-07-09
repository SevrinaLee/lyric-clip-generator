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
        className="rounded-full border border-ink/20 text-ink px-5 py-2.5 text-sm font-semibold hover:bg-ink/5 transition-colors disabled:opacity-50"
      >
        {isPending ? "Transcribing…" : "Auto-transcribe from audio"}
      </button>
      {error && <p className="text-sm text-mauve">{error}</p>}
    </div>
  );
}
