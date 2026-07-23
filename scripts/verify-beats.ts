// Unit proof for beat/onset detection (v1.8 S8.1). Builds a synthetic click
// track (impulses at known times) directly as PCM and asserts the energy-flux
// detector recovers onsets near those clicks, then checks the snap logic.
// Run: npx tsx scripts/verify-beats.ts
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { detectOnsetsFromPcm, snapLinesToOnsets, detectOnsets } from "../lib/beats";

const SR = 22050;

// 8s click track at 120 BPM (a click every 0.5s).
const durationSec = 8;
const clickTimes: number[] = [];
for (let t = 0.5; t < durationSec; t += 0.5) clickTimes.push(t);

const pcm = new Int16Array(SR * durationSec);
for (const t of clickTimes) {
  const start = Math.round(t * SR);
  // ~15ms decaying burst = a percussive onset.
  for (let j = 0; j < Math.round(0.015 * SR); j++) {
    const decay = 1 - j / (0.015 * SR);
    pcm[start + j] = Math.round((Math.random() * 2 - 1) * 30000 * decay);
  }
}

let failures = 0;
const check = (label: string, ok: boolean, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
};

const onsets = detectOnsetsFromPcm(pcm);
check("detected a plausible number of onsets", onsets.length >= 12 && onsets.length <= 20, `${onsets.length} (expected ~${clickTimes.length})`);

// Each detected onset should sit near a real click (within ~60ms).
const nearAClick = onsets.every((o) => clickTimes.some((c) => Math.abs(c - o) < 0.06));
check("onsets align to the clicks (±60ms)", nearAClick);

// Snap 8 lines across the 8s track.
const snapped = snapLinesToOnsets(8, durationSec, onsets);
check("snap returns one entry per line", !!snapped && snapped.length === 8, `${snapped?.length}`);
if (snapped) {
  let monotonic = true;
  for (let i = 1; i < snapped.length; i++) {
    if (snapped[i].start_ms <= snapped[i - 1].start_ms) monotonic = false;
  }
  check("line starts are strictly increasing", monotonic);
  check("all starts within the song", snapped.every((s) => s.start_ms >= 0 && s.end_ms <= durationSec * 1000 + 1));
  const notAllEven = snapped.some((s, i) => Math.abs(s.start_ms - i * 1000) > 20);
  check("timing is beat-aligned (not a plain even split)", notAllEven);
}

// Too few onsets → null (caller keeps the even split).
check("falls back (null) when onsets are too sparse", snapLinesToOnsets(8, durationSec, [0.5, 1.0]) === null);

// Real-decode smoke: generate an actual audio file with ffmpeg, serve it, and
// run the full detectOnsets() (ffmpeg PCM decode → detector) — proving the
// decode path, not just the algorithm. A beeping track has real onsets.
async function realDecodeSmoke() {
  const ffmpeg = ffmpegPath as unknown as string;
  const tmp = mkdtempSync(path.join(tmpdir(), "beatsmoke-"));
  const audioPath = path.join(tmp, "beeps.m4a");
  await new Promise<void>((res, rej) => {
    // A tremolo'd tone creates periodic amplitude surges (onset-like).
    const c = spawn(ffmpeg, [
      "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
      "-af", "tremolo=f=4:d=0.9", "-c:a", "aac", audioPath,
    ]);
    let e = ""; c.stderr.on("data", (d) => (e += d));
    c.on("close", (code) => (code === 0 ? res() : rej(new Error(e.slice(-800)))));
  });
  const buf = readFileSync(audioPath);
  const server = createServer((_req, r) => {
    r.writeHead(200, { "Content-Type": "audio/mp4", "Content-Length": buf.length });
    r.end(buf);
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  try {
    const onsets = await detectOnsets(`http://127.0.0.1:${port}/beeps.m4a`);
    check("real ffmpeg decode + detection returns onsets", Array.isArray(onsets) && onsets.length > 0, `${onsets.length} onsets`);
  } finally {
    server.close();
  }
}

realDecodeSmoke()
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} beat check(s) FAILED`);
      process.exit(1);
    }
    console.log("\nAll beat-detection checks passed.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
