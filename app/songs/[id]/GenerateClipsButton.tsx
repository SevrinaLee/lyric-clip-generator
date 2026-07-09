"use client";

import { useState, useTransition } from "react";
import { generateClips } from "./actions";

export function GenerateClipsButton({ songId }: { songId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await generateClips(songId);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't score clips — please try again",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded-full bg-gold text-ink px-5 py-2.5 text-sm font-semibold hover:bg-gold/85 transition-colors disabled:opacity-50"
      >
        {isPending ? "Scoring clips…" : "✦ Generate Clips"}
      </button>
      {error && <p className="text-sm text-mauve">{error}</p>}
    </div>
  );
}
