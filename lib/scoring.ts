import type { Lyric } from "@/lib/types";

const MIN_SEGMENT_MS = 8_000;
const MAX_SEGMENT_MS = 30_000;
const DEFAULT_LINE_MS = 3_500;

export type GeneratedSegment = {
  label: string;
  start_ms: number;
  end_ms: number;
  platform: "tiktok" | "reels" | "shorts";
  hook_score: number;
  hook_score_confidence: number;
};

export type TimedLine = { text: string; start_ms: number; end_ms: number };

/**
 * Fills in start_ms/end_ms for lines that don't have real timestamps yet
 * (manual paste, pre-Whisper). Spreads lines evenly across the known song
 * duration when available, otherwise assumes a fixed per-line duration —
 * this is what lets the pipeline run before Sprint 4 adds real transcription.
 *
 * Deterministic given the same lyrics + duration, so the render step can
 * call this again to recover which lines fall inside a given segment
 * window without persisting the estimate anywhere.
 */
export function timeLines(lyrics: Lyric[], durationSeconds: number | null): TimedLine[] {
  const hasRealTimestamps = lyrics.every(
    (l) => l.start_ms != null && l.end_ms != null,
  );
  if (hasRealTimestamps) {
    return lyrics.map((l) => ({
      text: l.text,
      start_ms: l.start_ms!,
      end_ms: l.end_ms!,
    }));
  }

  const perLineMs =
    durationSeconds && durationSeconds > 0
      ? (durationSeconds * 1000) / lyrics.length
      : DEFAULT_LINE_MS;

  return lyrics.map((l, i) => ({
    text: l.text,
    start_ms: Math.round(i * perLineMs),
    end_ms: Math.round((i + 1) * perLineMs),
  }));
}

function scoreWindow(
  lines: TimedLine[],
  songTitle: string,
  allText: string,
): number {
  const text = lines.map((l) => l.text).join(" ");
  const durationMs = lines[lines.length - 1].end_ms - lines[0].start_ms;
  let score = 0;

  // Line repetition in segment
  const normalized = lines.map((l) => l.text.trim().toLowerCase());
  if (new Set(normalized).size < normalized.length) score += 0.2;

  // Segment contains song title
  if (songTitle && text.toLowerCase().includes(songTitle.toLowerCase())) {
    score += 0.2;
  }

  // Duration 15-30s
  if (durationMs >= 15_000 && durationMs <= 30_000) score += 0.2;

  // Exclamation / question marks
  if (/[!?]/.test(text)) score += 0.1;

  // Starts on a strong beat (ms divisible by ~500)
  if (lines[0].start_ms % 500 < 50) score += 0.15;

  // Ends cleanly — approximated as: not mid-repeat of the very next line
  // outside the window (best-effort without real audio silence detection).
  score += 0.15;

  return Math.min(1, score);
}

function assignPlatform(durationMs: number): GeneratedSegment["platform"] {
  if (durationMs < 15_000) return "shorts";
  if (durationMs <= 22_000) return "tiktok";
  return "reels";
}

/**
 * Rule-based v1 hook scoring (docs/INTELLIGENCE_LAYER.md) — generates
 * candidate 8-30s windows over the lyrics, scores each, and returns the
 * top 3 non-overlapping windows ranked by score. Runs without any AI key,
 * matching docs/ARCHITECTURE.md's "why it works without AI" design.
 */
export function generateSegments(
  lyrics: Lyric[],
  songTitle: string,
  durationSeconds: number | null,
): GeneratedSegment[] {
  const timed = timeLines(lyrics, durationSeconds);
  const allText = timed.map((l) => l.text).join(" ");

  type Candidate = { start: number; end: number; score: number };
  const candidates: Candidate[] = [];

  for (let start = 0; start < timed.length; start++) {
    let end = start;
    while (end < timed.length) {
      const windowMs = timed[end].end_ms - timed[start].start_ms;
      if (windowMs >= MIN_SEGMENT_MS) {
        if (windowMs > MAX_SEGMENT_MS) break;
        const window = timed.slice(start, end + 1);
        candidates.push({
          start,
          end,
          score: scoreWindow(window, songTitle, allText),
        });
      }
      end++;
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const chosen: Candidate[] = [];
  for (const c of candidates) {
    const overlaps = chosen.some((x) => c.start <= x.end && x.start <= c.end);
    if (!overlaps) chosen.push(c);
    if (chosen.length === 3) break;
  }
  chosen.sort((a, b) => a.start - b.start);

  const labels = ["Hook", "Chorus", "Drop"];
  return chosen.map((c, i) => {
    const start_ms = timed[c.start].start_ms;
    const end_ms = timed[c.end].end_ms;
    return {
      label: labels[i] ?? `Clip ${i + 1}`,
      start_ms,
      end_ms,
      platform: assignPlatform(end_ms - start_ms),
      hook_score: c.score,
      hook_score_confidence: Math.round((0.6 + c.score * 0.3) * 100) / 100,
    };
  });
}
