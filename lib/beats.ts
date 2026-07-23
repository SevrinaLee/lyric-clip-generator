import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

// Rule-based onset detection (v1.8 S8.1) — NO external API. We decode the audio
// to mono PCM with ffmpeg, compute a short-time energy envelope, and pick
// onsets as local energy surges above an adaptive threshold. This is a simple
// energy-flux detector (not full beat-tracking), which is plenty to snap lyric
// line starts onto musical hits instead of an even split.

const SAMPLE_RATE = 22050;
const HOP = 512; // ~23ms frames at 22050 Hz
const MIN_GAP_SEC = 0.28; // collapse onsets closer than this (~215 BPM ceiling)

/** Decode audio (from a URL) to mono 16-bit PCM samples via ffmpeg. */
async function decodePcm(audioUrl: string): Promise<Int16Array> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found");
  const dir = await mkdtemp(path.join(tmpdir(), "beats-"));
  const src = path.join(dir, "source");
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`Could not fetch audio: ${res.status}`);
    await writeFile(src, Buffer.from(await res.arrayBuffer()));

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const ff = spawn(ffmpegPath as string, [
        "-i", src,
        "-ac", "1",
        "-ar", String(SAMPLE_RATE),
        "-f", "s16le",
        "-",
      ]);
      let err = "";
      ff.stdout.on("data", (d: Buffer) => chunks.push(d));
      ff.stderr.on("data", (d) => (err += d.toString()));
      ff.on("error", reject);
      ff.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg decode failed: ${err.slice(-800)}`)),
      );
    });

    const buf = Buffer.concat(chunks);
    // Interpret the byte buffer as little-endian int16 samples.
    return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Per-frame RMS energy envelope. */
function energyEnvelope(pcm: Int16Array): number[] {
  const frames: number[] = [];
  for (let i = 0; i + HOP <= pcm.length; i += HOP) {
    let sum = 0;
    for (let j = 0; j < HOP; j++) {
      const s = pcm[i + j] / 32768;
      sum += s * s;
    }
    frames.push(Math.sqrt(sum / HOP));
  }
  return frames;
}

/**
 * Detect onset times (seconds). Positive energy flux above an adaptive
 * (local-mean × factor) threshold, then min-gap suppression keeps the strongest
 * onset in each cluster. Returns times sorted ascending.
 */
export function detectOnsetsFromPcm(pcm: Int16Array): number[] {
  const env = energyEnvelope(pcm);
  if (env.length < 4) return [];
  const frameSec = HOP / SAMPLE_RATE;

  // Positive flux (energy increase) per frame.
  const flux = env.map((e, i) => (i === 0 ? 0 : Math.max(0, e - env[i - 1])));

  // Adaptive threshold: local moving mean of flux over ~1s, scaled up.
  const win = Math.max(4, Math.round(1 / frameSec));
  const candidates: { t: number; strength: number }[] = [];
  for (let i = 1; i < flux.length - 1; i++) {
    let sum = 0;
    let n = 0;
    for (let k = i - win; k <= i + win; k++) {
      if (k >= 0 && k < flux.length) {
        sum += flux[k];
        n++;
      }
    }
    const threshold = (sum / n) * 1.5 + 1e-4;
    // Local peak above threshold.
    if (flux[i] > threshold && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
      candidates.push({ t: i * frameSec, strength: flux[i] });
    }
  }

  // Min-gap suppression: keep the strongest onset within each MIN_GAP window.
  candidates.sort((a, b) => a.t - b.t);
  const onsets: number[] = [];
  let lastT = -Infinity;
  let lastIdx = -1;
  for (const c of candidates) {
    if (c.t - lastT >= MIN_GAP_SEC) {
      onsets.push(c.t);
      lastT = c.t;
      lastIdx = onsets.length - 1;
    } else if (lastIdx >= 0 && c.strength > flux[Math.round(onsets[lastIdx] / frameSec)]) {
      // Replace with the stronger, nearby onset.
      onsets[lastIdx] = c.t;
      lastT = c.t;
    }
  }
  return onsets;
}

/** Convenience: decode a URL and return onset times in seconds. */
export async function detectOnsets(audioUrl: string): Promise<number[]> {
  const pcm = await decodePcm(audioUrl);
  return detectOnsetsFromPcm(pcm);
}

/**
 * Snap even-split line starts onto the nearest detected onset. Keeps lines
 * spread across the song (so we never bunch them) but aligns each start to a
 * musical hit when one is close. Enforces monotonic order + a minimum gap.
 * Returns start/end ms per line, or null if there aren't enough onsets to be
 * worth it (caller keeps the even split).
 */
export function snapLinesToOnsets(
  lineCount: number,
  durationSeconds: number,
  onsets: number[],
): { start_ms: number; end_ms: number }[] | null {
  if (lineCount === 0 || durationSeconds <= 0) return null;
  // Need a reasonable density of onsets relative to lines to be meaningful.
  if (onsets.length < Math.max(4, lineCount)) return null;

  const perLine = durationSeconds / lineCount;
  const window = perLine * 0.5; // snap only within half a line-slot
  const sorted = [...onsets].sort((a, b) => a - b);

  const nearest = (t: number): number => {
    // Binary search for the closest onset.
    let lo = 0;
    let hi = sorted.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    const cands = [sorted[lo], sorted[lo - 1]].filter((v) => v !== undefined);
    let best = cands[0];
    for (const c of cands) if (Math.abs(c - t) < Math.abs(best - t)) best = c;
    return best;
  };

  const starts: number[] = [];
  let prev = -Infinity;
  for (let i = 0; i < lineCount; i++) {
    const even = i * perLine;
    const cand = nearest(even);
    let start = Math.abs(cand - even) <= window ? cand : even;
    // Keep strictly increasing with a small minimum gap.
    if (start <= prev + 0.05) start = prev + Math.max(0.2, perLine * 0.4);
    start = Math.min(start, durationSeconds - 0.1);
    starts.push(start);
    prev = start;
  }

  return starts.map((s, i) => ({
    start_ms: Math.round(s * 1000),
    end_ms: Math.round((starts[i + 1] ?? durationSeconds) * 1000),
  }));
}
