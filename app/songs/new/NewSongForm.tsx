"use client";

import { useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { createSong } from "./actions";

const MAX_BYTES = 50 * 1024 * 1024;

export function NewSongForm() {
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setDuration(null);
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError("File is larger than 50 MB");
      e.target.value = "";
      return;
    }

    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      URL.revokeObjectURL(audio.src);
    };
    audio.src = URL.createObjectURL(file);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createSong(formData);
      } catch (err) {
        unstable_rethrow(err);
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Song title
        </label>
        <input
          id="title"
          name="title"
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Neon City"
        />
      </div>

      <div>
        <label htmlFor="artist" className="block text-sm font-medium mb-1">
          Artist
        </label>
        <input
          id="artist"
          name="artist"
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Demo Artist"
        />
      </div>

      <div>
        <label htmlFor="audio" className="block text-sm font-medium mb-1">
          Audio file (MP3 or WAV, max 50 MB)
        </label>
        <input
          id="audio"
          name="audio"
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          required
          onChange={handleFileChange}
          className="w-full text-sm"
        />
        {duration && (
          <p className="text-xs text-neutral-500 mt-1">
            Duration: {Math.round(duration)}s
          </p>
        )}
      </div>

      <input type="hidden" name="duration_seconds" value={duration ?? ""} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
      >
        {isPending ? "Uploading…" : "Upload song"}
      </button>
    </form>
  );
}
