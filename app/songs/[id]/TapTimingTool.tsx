"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Lyric } from "@/lib/types";
import { bulkUpdateLyricTimings } from "./actions";

type Captured = { start?: number; end?: number };

/**
 * Tap-to-time: play the song, tap (or hit space) the instant each line
 * starts. Far more accurate than typing seconds by ear, and much faster —
 * one pass through the song times every line. Everything is captured in
 * local state while playing (no network calls mid-session, so playback
 * stays smooth) and persisted in one bulk save.
 */
export function TapTimingTool({
  audioUrl,
  lyrics,
  onDone,
}: {
  audioUrl: string;
  lyrics: Lyric[];
  onDone: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [captured, setCaptured] = useState<Record<string, Captured>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const finished = cursor >= lyrics.length;
  const timedCount = Object.values(captured).filter(
    (c) => c.start != null && c.end != null,
  ).length;

  function handleTap() {
    const audio = audioRef.current;
    if (!audio || finished) return;
    const t = audio.currentTime;
    const current = lyrics[cursor];

    setCaptured((prev) => {
      const next = { ...prev };
      if (cursor > 0) {
        const prevLine = lyrics[cursor - 1];
        next[prevLine.id] = { ...next[prevLine.id], end: t };
      }
      next[current.id] = { ...next[current.id], start: t };
      return next;
    });
    setSavedOk(false);

    const nextCursor = cursor + 1;
    setCursor(nextCursor);

    if (nextCursor >= lyrics.length) {
      const dur = audio.duration || t + 3;
      setCaptured((prev) => ({
        ...prev,
        [current.id]: { ...prev[current.id], start: prev[current.id]?.start ?? t, end: dur },
      }));
      audio.pause();
      setIsPlaying(false);
    }
  }

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }

  function handleRestart() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCursor(0);
    setCaptured({});
    setIsPlaying(false);
    setSavedOk(false);
  }

  function handleSave() {
    setError(null);
    const updates = Object.entries(captured)
      .filter(([, c]) => c.start != null && c.end != null)
      .map(([id, c]) => ({
        id,
        start_ms: Math.round(c.start! * 1000),
        end_ms: Math.round(c.end! * 1000),
      }));

    startTransition(async () => {
      try {
        await bulkUpdateLyricTimings(updates);
        setSavedOk(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save timing");
      }
    });
  }

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        handleTap();
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  return (
    <div className="rounded-2xl bg-lavender/10 border border-lavender/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-ink/50">
          Tap timing
        </span>
        <button onClick={onDone} className="text-xs text-ink/40 hover:text-ink">
          Close
        </button>
      </div>

      {!finished ? (
        <>
          <p className="text-xs text-ink/50">
            Play the song, then tap TAP (or press space) the instant this
            line starts:
          </p>
          <p className="font-display text-xl text-ink min-h-[1.5em]">
            {lyrics[cursor]?.text || "(blank line)"}
          </p>
        </>
      ) : (
        <p className="text-sm text-sage font-semibold">
          All lines timed — hit Save to lock it in.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handlePlayPause}
          className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold hover:bg-ink/5"
        >
          {isPlaying ? "Pause" : "▶ Play"}
        </button>
        {!finished && (
          <button
            onClick={handleTap}
            className="rounded-full bg-ink text-cream px-6 py-2 text-sm font-bold hover:bg-ink/85"
          >
            TAP
          </button>
        )}
        <button onClick={handleRestart} className="text-xs text-ink/40 hover:text-ink">
          Restart
        </button>
        <span className="text-xs text-ink/40">
          {Math.min(cursor, lyrics.length)} / {lyrics.length}
        </span>

        <button
          onClick={handleSave}
          disabled={isPending || timedCount === 0}
          className="ml-auto rounded-full bg-gold text-ink px-4 py-2 text-sm font-semibold hover:bg-gold/85 disabled:opacity-50"
        >
          {isPending ? "Saving…" : savedOk ? "Saved ✓" : `Save ${timedCount} line${timedCount === 1 ? "" : "s"}`}
        </button>
      </div>

      {error && <p className="text-sm text-mauve">{error}</p>}

      <audio ref={audioRef} src={audioUrl} preload="none" className="hidden" />
    </div>
  );
}
