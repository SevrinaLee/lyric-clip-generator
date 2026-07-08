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
      <label htmlFor="lyrics" className="block text-sm font-medium">
        Paste lyrics
      </label>
      <textarea
        id="lyrics"
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        rows={10}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
        placeholder={"Lights flash in the neon city\nEvery corner holds a different dream\n..."}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save lyrics"}
      </button>
    </form>
  );
}
