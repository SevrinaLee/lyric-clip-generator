// Render proof for GIF export (v1.7 S7.5): drives the REAL renderClip with
// kind:"gif" against a locally served audio clip and asserts the output is a
// valid, non-empty, reasonably small GIF89a. Run:
//   npx tsx scripts/verify-gif.ts
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { renderClip } from "../lib/render";
import { resolveClipStyle } from "../lib/captionStyles";
import type { VideoTemplate } from "../lib/types";

const ffmpeg = ffmpegPath as unknown as string;

function sh(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const c = spawn(ffmpeg, args);
    let e = "";
    c.stderr.on("data", (d) => (e += d));
    c.on("close", (code) => (code === 0 ? res() : rej(new Error(e.slice(-1500)))));
  });
}

async function main() {
  const tmp = mkdtempSync(path.join(tmpdir(), "gifverify-"));
  const audioPath = path.join(tmp, "a.m4a");
  await sh(["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=10", "-c:a", "aac", audioPath]);

  const audioBuf = readFileSync(audioPath);
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "audio/mp4", "Content-Length": audioBuf.length });
    res.end(audioBuf);
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const audioUrl = `http://127.0.0.1:${port}/a.m4a`;

  const template: VideoTemplate = {
    id: "t", name: "Test", preview_url: null, font: "Montserrat ExtraBold",
    primary_color: "#1a1030", animation_preset: "fade",
    background_style: "gradient:#ff6b35:#ffd166", is_premium: false, created_at: "",
  };
  const style = resolveClipStyle(template, { caption_animation: "wordpop" });
  const lines = [{ text: "Neon city lights are calling", offsetSeconds: 0 }];

  // Request a 12s window; the GIF must be hard-capped shorter (6s).
  const buffer = await renderClip({
    audioUrl,
    startMs: 0,
    endMs: 12000,
    lines,
    primaryColor: template.primary_color,
    backgroundStyle: template.background_style,
    watermarkText: "made with Lyric Clip Generator",
    width: 1080,
    height: 1920,
    caption: style.ass,
    kind: "gif",
  });

  const outPath = path.join(tmp, "out.gif");
  writeFileSync(outPath, buffer);

  // Waveform background exercises the [0:a] asplit path — prove the GIF branch
  // sinks the dangling [aud] label instead of failing the filtergraph.
  const waveTemplate: VideoTemplate = {
    ...template,
    background_style: "waveform:#101010:#ff2d55",
  };
  const waveStyle = resolveClipStyle(waveTemplate, { caption_animation: "wordpop" });
  const waveBuffer = await renderClip({
    audioUrl,
    startMs: 0,
    endMs: 12000,
    lines,
    primaryColor: waveTemplate.primary_color,
    backgroundStyle: waveTemplate.background_style,
    watermarkText: null,
    width: 1080,
    height: 1920,
    caption: waveStyle.ass,
    kind: "gif",
  });
  server.close();

  let failures = 0;
  const check = (label: string, ok: boolean, extra = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
  };

  const header = buffer.subarray(0, 6).toString("ascii");
  check("valid GIF89a header", header === "GIF89a" || header === "GIF87a", header);
  check("non-empty", buffer.length > 1000, `${(buffer.length / 1024).toFixed(0)} KB`);
  const waveHeader = waveBuffer.subarray(0, 6).toString("ascii");
  check("waveform GIF renders (asplit sunk)", waveHeader === "GIF89a" || waveHeader === "GIF87a", `${(waveBuffer.length / 1024).toFixed(0)} KB`);
  // Shareable size guard — a capped 480px/15fps/6s GIF should stay well under 8MB.
  check("under 8 MB", buffer.length < 8 * 1024 * 1024, `${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  // Probe dimensions + duration with ffprobe-less ffmpeg (parse stderr).
  await new Promise<void>((resolve) => {
    const c = spawn(ffmpeg, ["-i", outPath]);
    let e = "";
    c.stderr.on("data", (d) => (e += d));
    c.on("close", () => {
      const m = e.match(/, (\d+)x(\d+)/);
      const w = m ? Number(m[1]) : 0;
      check("width capped to 480", w === 480, `${w}px`);
      resolve();
    });
  });

  console.log(`\nGIF written to ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  if (failures > 0) {
    console.error(`\n${failures} GIF check(s) FAILED`);
    process.exit(1);
  }
  console.log("All GIF checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
