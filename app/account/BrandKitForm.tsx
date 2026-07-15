"use client";

import { useState, useTransition } from "react";
import type { BrandKit } from "@/lib/types";
import { updateBrandKit } from "./actions";

// Creator-plan brand kit editor: a custom caption accent, watermark text, and
// logo that get applied to the user's paid exports. Logo type/size is
// validated server-side (magic bytes, ≤1MB) — this is just the UI.
export function BrandKitForm({ kit }: { kit: BrandKit | null }) {
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [accent, setAccent] = useState(kit?.accent_hex ?? "#00e5ff");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setStatus("idle");
    startTransition(async () => {
      try {
        await updateBrandKit(formData);
        setStatus("saved");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block space-y-1">
          <span className="text-xs text-ink/50">Brand name (optional)</span>
          <input
            name="display_name"
            defaultValue={kit?.display_name ?? ""}
            maxLength={50}
            className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-ink/50">Watermark text</span>
          <input
            name="watermark_text"
            defaultValue={kit?.watermark_text ?? ""}
            maxLength={40}
            placeholder="@yourhandle"
            className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2 text-sm text-ink"
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-xs text-ink/50">Accent</span>
          <input
            type="color"
            name="accent_hex"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-9 w-12 rounded-lg border border-ink/15 bg-cream"
          />
          <span className="text-xs text-ink/40 tabular-nums">{accent}</span>
        </label>
        <label className="block space-y-1 flex-1">
          <span className="text-xs text-ink/50">Logo (PNG/JPEG, ≤1MB)</span>
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg"
            className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:text-cream file:px-3 file:py-1.5 file:text-xs file:font-semibold"
          />
        </label>
      </div>

      {kit?.logo_path && (
        <p className="text-xs text-ink/40">A logo is saved. Uploading a new one replaces it.</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save brand kit"}
        </button>
        {status === "saved" && (
          <span className="text-sm text-sage font-semibold">Saved ✓</span>
        )}
        {error && <span className="text-sm text-mauve">{error}</span>}
      </div>
      <p className="text-xs text-ink/40">
        Applied to your watermark-free exports: the accent recolors the yellow
        caption style and waveform, and your logo + text brand the clip.
      </p>
    </form>
  );
}
