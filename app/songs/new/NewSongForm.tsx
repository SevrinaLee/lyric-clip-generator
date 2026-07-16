"use client";

import { useRef, useState, useTransition } from "react";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { createSong } from "./actions";
import { LOOKS } from "@/lib/looks";

const MAX_BYTES = 50 * 1024 * 1024;

export function NewSongForm() {
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  // Remix deep-link (S7.4): a validated Look id carried from the showcase.
  const lookId = useSearchParams().get("look");
  const remixLook = lookId ? LOOKS.find((l) => l.id === lookId) : undefined;

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
      {remixLook && (
        <div className="rounded-xl bg-lavender/15 border border-lavender/40 px-4 py-3 text-sm text-ink">
          <span className="font-semibold">
            {remixLook.emoji} Remixing the {remixLook.name} look.
          </span>{" "}
          Upload your song and we&apos;ll offer to apply it to every clip.
          <input type="hidden" name="look" value={remixLook.id} />
        </div>
      )}
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1 text-ink/70">
          Song title
        </label>
        <input
          id="title"
          name="title"
          required
          className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
          placeholder="Neon City"
        />
      </div>

      <div>
        <label htmlFor="artist" className="block text-sm font-medium mb-1 text-ink/70">
          Artist
        </label>
        <input
          id="artist"
          name="artist"
          required
          className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
          placeholder="Demo Artist"
        />
      </div>

      <div>
        <label htmlFor="audio" className="block text-sm font-medium mb-1 text-ink/70">
          Audio file (MP3 or WAV, max 50 MB)
        </label>
        <input
          id="audio"
          name="audio"
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          required
          onChange={handleFileChange}
          className="w-full text-sm text-ink/70 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:text-cream file:px-4 file:py-2 file:text-sm file:font-semibold hover:file:bg-ink/85 file:cursor-pointer"
        />
        {duration && (
          <p className="text-xs text-gold font-medium mt-1.5">
            Duration: {Math.round(duration)}s
          </p>
        )}
      </div>

      <input type="hidden" name="duration_seconds" value={duration ?? ""} />

      {error && <p className="text-sm text-mauve">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
      >
        {isPending ? "Uploading…" : "Upload song"}
      </button>
    </form>
  );
}
