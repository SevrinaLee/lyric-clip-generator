"use client";

import { useState, useTransition } from "react";
import { addLyrics } from "./actions";

export function LyricEntryForm({ songId }: { songId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addLyrics(songId, text);
        setText("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="lyrics" className="block text-sm font-medium text-ink/70">
        Paste lyrics
      </label>
      <textarea
        id="lyrics"
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        rows={10}
        className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
        placeholder={"Lights flash in the neon city\nEvery corner holds a different dream\n..."}
      />
      {error && <p className="text-sm text-mauve">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save lyrics"}
      </button>
    </form>
  );
}
