export type TranscribedWord = { text: string; start_ms: number; end_ms: number };
export type TranscribedLine = {
  text: string;
  start_ms: number;
  end_ms: number;
  // Per-word timing (Whisper word granularity), when available — the
  // foundation for vocal-synced captions (aesthetics v1.3). Absent for
  // manually pasted lyrics.
  words?: TranscribedWord[];
};

type WhisperSegment = { text: string; start: number; end: number };
type WhisperWord = { word: string; start: number; end: number };

const toMs = (s: number) => Math.round(s * 1000);

/**
 * Assigns each transcribed word to the segment (line) it belongs to, by TIME
 * (not text): a word joins the last segment whose start is ≤ the word's start.
 * This tolerates Whisper's word/segment text drift (punctuation, merges) and
 * never drops words to gaps between segments. Pure + deterministic so it can
 * be unit-tested against a fixed response. Segments with empty text are
 * dropped first so their words don't vanish.
 */
export function attachWords(
  segments: WhisperSegment[],
  words: WhisperWord[],
): TranscribedLine[] {
  const segs = segments.filter((s) => s.text.trim().length > 0);
  if (segs.length === 0) return [];

  const buckets: TranscribedWord[][] = segs.map(() => []);
  for (const w of words) {
    const text = (w.word ?? "").trim();
    if (!text) continue;
    let idx = 0;
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].start <= w.start + 1e-3) idx = i;
      else break;
    }
    buckets[idx].push({ text, start_ms: toMs(w.start), end_ms: toMs(w.end) });
  }

  return segs.map((s, i) => ({
    text: s.text.trim(),
    start_ms: toMs(s.start),
    end_ms: toMs(s.end),
    words: buckets[i].length ? buckets[i] : undefined,
  }));
}

/**
 * Calls OpenAI's Whisper transcription endpoint directly via fetch rather
 * than pulling in the `openai` SDK for a single call. Requires
 * OPENAI_API_KEY; docs/TASKS.md Sprint 4 — auto-transcribe is optional and
 * the rest of the pipeline (manual lyric paste + rule-based scoring) works
 * fine without it, matching docs/ARCHITECTURE.md's "why it works without AI".
 *
 * Requests both segment and word timestamp granularities in the SAME call, so
 * per-word timing costs no extra API request.
 */
export async function transcribeAudio(audioUrl: string): Promise<TranscribedLine[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Auto-transcription isn't configured yet — add an OPENAI_API_KEY to enable it.",
    );
  }

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(`Could not fetch audio: ${audioRes.status}`);
  }
  const audioBlob = await audioRes.blob();

  const form = new FormData();
  form.append("file", audioBlob, "audio.mp3");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("timestamp_granularities[]", "word");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    segments?: WhisperSegment[];
    words?: WhisperWord[];
  };

  return attachWords(data.segments ?? [], data.words ?? []);
}
