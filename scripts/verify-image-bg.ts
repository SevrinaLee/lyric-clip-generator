// Render proof for custom image backgrounds (v1.7 S7.3): generates a test
// image, then drives the REAL renderClip with bgImageBuffer for both MP4 and
// GIF, asserting the image path composes (captions over a scaled/cropped
// still) and produces a valid file. Run:
//   npx tsx scripts/verify-image-bg.ts
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
  const tmp = mkdtempSync(path.join(tmpdir(), "imgbg-"));
  const audioPath = path.join(tmp, "a.m4a");
  const imgPath = path.join(tmp, "bg.png");
  // A landscape test image (wider than 9:16) proves the cover-crop path.
  await sh(["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", "-c:a", "aac", audioPath]);
  await sh(["-y", "-f", "lavfi", "-i", "testsrc=size=1600x900:duration=1", "-frames:v", "1", imgPath]);
  const imageBuffer = readFileSync(imgPath);

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
    primary_color: "#1a1030", animation_preset: "fade", background_style: "solid",
    is_premium: false, created_at: "",
  };
  const style = resolveClipStyle(template, {});
  const lines = [{ text: "Over my own photo", offsetSeconds: 0 }];

  const common = {
    audioUrl, startMs: 0, endMs: 5000, lines,
    primaryColor: template.primary_color, backgroundStyle: template.background_style,
    watermarkText: null, width: 1080, height: 1920, caption: style.ass,
    bgImageBuffer: imageBuffer,
  };
  const mp4 = await renderClip({ ...common, kind: "mp4" });
  const gif = await renderClip({ ...common, kind: "gif" });
  server.close();

  let failures = 0;
  const check = (label: string, ok: boolean, extra = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
  };

  // MP4: 'ftyp' box appears at bytes 4-8.
  check("MP4 with image bg renders", mp4.subarray(4, 8).toString("ascii") === "ftyp", `${(mp4.length / 1024).toFixed(0)} KB`);
  check("GIF with image bg renders", gif.subarray(0, 6).toString("ascii").startsWith("GIF8"), `${(gif.length / 1024).toFixed(0)} KB`);

  // Confirm the MP4 is exactly the requested output size (cover-cropped).
  await new Promise<void>((resolve) => {
    const outPath = path.join(tmp, "out.mp4");
    writeFileSync(outPath, mp4);
    const c = spawn(ffmpeg, ["-i", outPath]);
    let e = "";
    c.stderr.on("data", (d) => (e += d));
    c.on("close", () => {
      check("output cropped to 1080x1920", /1080x1920/.test(e), (e.match(/, (\d+x\d+)/) || [])[1] || "?");
      resolve();
    });
  });

  if (failures > 0) {
    console.error(`\n${failures} image-bg check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll image-background checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
