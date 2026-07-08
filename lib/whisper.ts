export type TranscribedLine = { text: string; start_ms: number; end_ms: number };

/**
 * Calls OpenAI's Whisper transcription endpoint directly via fetch rather
 * than pulling in the `openai` SDK for a single call. Requires
 * OPENAI_API_KEY; docs/TASKS.md Sprint 4 — auto-transcribe is optional and
 * the rest of the pipeline (manual lyric paste + rule-based scoring) works
 * fine without it, matching docs/ARCHITECTURE.md's "why it works without AI".
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
    segments?: { text: string; start: number; end: number }[];
  };

  return (data.segments ?? [])
    .map((s) => ({
      text: s.text.trim(),
      start_ms: Math.round(s.start * 1000),
      end_ms: Math.round(s.end * 1000),
    }))
    .filter((s) => s.text.length > 0);
}
