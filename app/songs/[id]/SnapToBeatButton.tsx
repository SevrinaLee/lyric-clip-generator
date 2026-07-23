"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { snapLyricsToBeats } from "./actions";

// Rule-based, no-API alternative to tap-timing: analyzes the song's own audio
// and snaps each line's start onto the nearest beat/onset (v1.8 S8.1).
export function SnapToBeatButton({ songId }: { songId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      try {
        await snapLyricsToBeats(songId);
        setOk(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't align to the beat");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        title="Analyze the audio and align lines to the beat — no typing"
        className="rounded-full border border-ink/20 text-ink px-5 py-2.5 text-sm font-semibold hover:bg-ink/5 transition-colors disabled:opacity-50"
      >
        {isPending ? "Listening for the beat…" : ok ? "Aligned to the beat ✓" : "🎵 Snap to beat"}
      </button>
      {error && <p className="text-sm text-mauve">{error}</p>}
    </div>
  );
}
