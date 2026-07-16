"use client";

import { useState, useTransition } from "react";
import { buildCaption, captionPlatform } from "@/lib/caption";
import { submitToShowcase } from "./actions";

// Shown once a clip is rendered: a ready-to-post caption + hashtags the user
// can tweak, copy, or fire straight into the native share sheet on mobile.
export function SharePanel({
  title,
  artist,
  platform,
  hookLine,
  format,
  exportId,
}: {
  title: string;
  artist?: string | null;
  platform: string;
  hookLine?: string | null;
  format?: string;
  exportId?: string;
}) {
  const [caption, setCaption] = useState(() =>
    buildCaption({ title, artist, platform: captionPlatform(platform, format), hookLine }),
  );
  const [copied, setCopied] = useState(false);
  const [showcaseState, setShowcaseState] = useState<
    "idle" | "submitted" | "error"
  >("idle");
  const [showcaseError, setShowcaseError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleShowcase() {
    if (!exportId) return;
    setShowcaseError(null);
    startTransition(async () => {
      try {
        await submitToShowcase(exportId, `${title}${artist ? " — " + artist : ""}`);
        setShowcaseState("submitted");
      } catch (err) {
        setShowcaseState("error");
        setShowcaseError(err instanceof Error ? err.message : "Could not submit");
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still select the text manually */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: caption });
        return;
      } catch {
        /* user dismissed the share sheet */
      }
    }
    copy();
  }

  return (
    <div className="rounded-2xl bg-sky/10 border border-sky/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-ink/50">
          Share
        </span>
        <span className="text-[11px] text-ink/40">caption + hashtags</span>
      </div>
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={5}
        aria-label="Suggested caption"
        className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-sky resize-none"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={copy}
          className="rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors"
        >
          {copied ? "Copied!" : "Copy caption"}
        </button>
        <button
          onClick={share}
          className="rounded-full border border-ink/20 text-ink px-4 py-2 text-sm font-semibold hover:bg-ink/5 transition-colors"
        >
          Share…
        </button>
      </div>

      {exportId && (
        <div className="flex flex-wrap items-center gap-2 border-t border-sky/20 pt-2">
          {showcaseState === "submitted" ? (
            <span className="text-xs text-sage font-semibold">
              ✓ Submitted for the showcase — we&apos;ll review it
            </span>
          ) : (
            <button
              onClick={handleShowcase}
              disabled={isPending}
              className="text-xs font-semibold text-ink/60 hover:text-ink hover:underline disabled:opacity-50"
            >
              {isPending ? "Submitting…" : "✨ Submit to the public showcase"}
            </button>
          )}
          {showcaseError && (
            <span className="text-xs text-mauve">{showcaseError}</span>
          )}
        </div>
      )}
    </div>
  );
}
