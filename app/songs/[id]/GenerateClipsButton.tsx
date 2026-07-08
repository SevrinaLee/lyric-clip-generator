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
        className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
      >
        {isPending ? "Scoring clips…" : "Generate Clips"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
