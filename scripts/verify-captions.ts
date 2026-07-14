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

const cases: { name: string; ov: Parameters<typeof resolveClipStyle>[1] }[] = [
  { name: "box-center-fade", ov: { caption_font: "Montserrat ExtraBold", caption_size: "md", caption_style_preset: "box", caption_position: "center", caption_animation: "fade" } },
  { name: "outline-lower-static", ov: { caption_font: "Anton", caption_size: "lg", caption_style_preset: "outline", caption_position: "lower", caption_animation: "fade" } },
  { name: "yellow-lower-wordpop", ov: { caption_font: "Montserrat ExtraBold", caption_size: "lg", caption_style_preset: "outline-yellow", caption_position: "lower", caption_animation: "wordpop" } },
];

for (const c of cases) {
  const style = resolveClipStyle(baseTemplate, c.ov as never);
  const mp4 = await renderClip({
    audioUrl, startMs: 0, endMs: 6000, lines,
    primaryColor: baseTemplate.primary_color,
    backgroundStyle: baseTemplate.background_style,
    caption: style.ass,
    width: 1080, height: 1920,
  });
  writeFileSync(path.join(outDir, c.name + ".mp4"), mp4);
  console.log("rendered", c.name, "(", style.ass.primary, "border", style.ass.borderStyle, "align", style.ass.alignment, ")");
}

server.close();
console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
