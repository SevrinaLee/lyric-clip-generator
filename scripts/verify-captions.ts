// Sprint 2 render proof: drives the REAL renderClip + resolveClipStyle for
// several caption-style combinations against a locally generated/served audio
// clip, writing one MP4 per case. A companion bash step extracts frames.
//
// Run: node_modules/.bin/tsx scripts/verify-captions.ts <outDir>
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { renderClip } from "../lib/render";
import { resolveClipStyle } from "../lib/captionStyles";
import { CLIP_FORMATS, renderDimensions } from "../lib/formats";
import type { VideoTemplate } from "../lib/types";

const outDir = process.argv[2] ?? mkdtempSync(path.join(tmpdir(), "capout-"));
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
const tmp = mkdtempSync(path.join(tmpdir(), "capverify-"));
const audioPath = path.join(tmp, "a.m4a");

// A short spoken-word-ish beep track is enough; captions are what we inspect.
await sh(["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:a", "aac", audioPath]);

// Serve the audio so renderClip's fetch() can retrieve it.
const audioBuf = readFileSync(audioPath);
const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "audio/mp4", "Content-Length": audioBuf.length });
  res.end(audioBuf);
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;
const audioUrl = `http://127.0.0.1:${port}/a.m4a`;

const baseTemplate: VideoTemplate = {
  id: "t", name: "Test", preview_url: null, font: "Montserrat ExtraBold",
  primary_color: "#1a1030", animation_preset: "fade", background_style: "solid",
  is_premium: false, created_at: "",
};

const lines = [{ text: "Neon city lights are calling", offsetSeconds: 0 }];

// A line carrying REAL (uneven) per-word timing, to prove synced word-pop /
// karaoke land on the given offsets rather than an even split.
const syncedLines = [
  {
    text: "Neon city lights are calling",
    offsetSeconds: 0,
    words: [
      { text: "Neon", offsetSeconds: 0.2 },
      { text: "city", offsetSeconds: 1.6 },
      { text: "lights", offsetSeconds: 2.2 },
      { text: "are", offsetSeconds: 4.3 },
      { text: "calling", offsetSeconds: 4.8 },
    ],
  },
];

const cases: { name: string; bg: string; synced?: boolean; ov: Parameters<typeof resolveClipStyle>[1] }[] = [
  { name: "box-center-fade", bg: "solid", ov: { caption_font: "Montserrat ExtraBold", caption_size: "md", caption_style_preset: "box", caption_position: "center", caption_animation: "fade" } },
  { name: "outline-lower-static", bg: "solid", ov: { caption_font: "Anton", caption_size: "lg", caption_style_preset: "outline", caption_position: "lower", caption_animation: "fade" } },
  { name: "yellow-lower-wordpop", bg: "solid", ov: { caption_font: "Montserrat ExtraBold", caption_size: "lg", caption_style_preset: "outline-yellow", caption_position: "lower", caption_animation: "wordpop" } },
  { name: "waveform-lower", bg: "waveform:#1a0f30:#8b7cff", ov: { caption_font: "Montserrat ExtraBold", caption_size: "lg", caption_style_preset: "outline", caption_position: "lower", caption_animation: "wordpop" } },
  { name: "pulse-center", bg: "pulse:#ff6b9d:#4a2f7a", ov: { caption_font: "Anton", caption_size: "lg", caption_style_preset: "outline", caption_position: "center", caption_animation: "fade" } },
  // v1.3 S3.2 — synced word-pop (real word timing) and premium karaoke fill.
  { name: "synced-wordpop", bg: "solid", synced: true, ov: { caption_font: "Montserrat ExtraBold", caption_size: "lg", caption_style_preset: "outline", caption_position: "lower", caption_animation: "wordpop" } },
  { name: "karaoke-lower", bg: "solid", synced: true, ov: { caption_font: "Montserrat ExtraBold", caption_size: "lg", caption_style_preset: "outline-yellow", caption_position: "lower", caption_animation: "karaoke" } },
];

for (const c of cases) {
  const style = resolveClipStyle(baseTemplate, c.ov as never);
  const mp4 = await renderClip({
    audioUrl, startMs: 0, endMs: 6000, lines: c.synced ? syncedLines : lines,
    primaryColor: baseTemplate.primary_color,
    backgroundStyle: c.bg,
    caption: style.ass,
    width: 1080, height: 1920,
  });
  writeFileSync(path.join(outDir, c.name + ".mp4"), mp4);
  console.log("rendered", c.name, "anim=" + style.ass.animation);
}

// v1.4 S4.1 — format matrix: each aspect ratio with a lower-third outline
// caption over a waveform bg, to confirm no distortion + correct margins.
const fmtStyle = resolveClipStyle(baseTemplate, {
  caption_font: "Montserrat ExtraBold", caption_size: "lg",
  caption_style_preset: "outline", caption_position: "lower", caption_animation: "fade",
} as never);
for (const f of CLIP_FORMATS) {
  const d = renderDimensions(f, true);
  const mp4 = await renderClip({
    audioUrl, startMs: 0, endMs: 6000, lines,
    primaryColor: baseTemplate.primary_color,
    backgroundStyle: "waveform:#1a0f30:#8b7cff",
    caption: fmtStyle.ass,
    width: d.width, height: d.height,
  });
  writeFileSync(path.join(outDir, "fmt-" + f.replace(":", "x") + ".mp4"), mp4);
  console.log("rendered format", f, `${d.width}x${d.height}`);
}

server.close();
console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
