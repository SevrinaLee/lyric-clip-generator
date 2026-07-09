import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

// Vendored copy of Next.js's bundled Noto Sans (SIL OFL) — see assets/fonts.
// require.resolve("next/package.json") is NOT safe here: in Vercel's
// production webpack bundle it can resolve to an internal numeric module id
// instead of a real filesystem path, which crashes path.join at runtime.
// process.cwd() is reliable in both dev and the serverless bundle.
const FONTS_DIR = path.join(process.cwd(), "assets/fonts");
const FONT_FAMILY = "Noto Sans";
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;

// ffmpeg-static's prebuilt linux binary (johnvansickle.com) does not compile
// in the "drawtext" filter, even though its configure flags list
// --enable-libfreetype — confirmed by inspecting `ffmpeg -filters` in
// production. Burned-in captions are rendered instead via the "ass" filter
// (libass IS present), which is also more robust for styling/timing than
// chained drawtext expressions.
function escapeAssText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

function formatAssTime(seconds: number): string {
  const cs = Math.round(Math.max(0, seconds) * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

function buildAssSubtitle(
  lines: RenderLine[],
  durationSeconds: number,
  animationPreset: "fade" | "bounce" | "typewriter",
): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${VIDEO_WIDTH}
PlayResY: ${VIDEO_HEIGHT}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${FONT_FAMILY},64,&H00FFFFFF,&H000000FF,&H00000000,&HA6000000,0,0,0,0,100,100,0,0,3,20,0,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = lines
    .map((line, i) => {
      const nextOffset = lines[i + 1]?.offsetSeconds ?? durationSeconds;
      const start = formatAssTime(line.offsetSeconds);
      const end = formatAssTime(nextOffset);
      const text = escapeAssText(line.text);

      let tag = "";
      if (animationPreset === "fade") {
        tag = "{\\fad(400,0)}";
      } else if (animationPreset === "bounce") {
        tag = "{\\t(0,150,\\fscx115\\fscy115)\\t(150,300,\\fscx100\\fscy100)}";
      }

      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${tag}${text}`;
    })
    .join("\n");

  return header + events + "\n";
}

// ffmpeg filter-argument escaping: backslashes and colons are special inside
// a filter's option string (colon separates key=value pairs).
function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-4000)}`));
    });
  });
}

export type RenderLine = { text: string; offsetSeconds: number };

export async function renderClip({
  audioUrl,
  startMs,
  endMs,
  lines,
  primaryColor,
  animationPreset,
}: {
  audioUrl: string;
  startMs: number;
  endMs: number;
  lines: RenderLine[];
  primaryColor: string;
  animationPreset: "fade" | "bounce" | "typewriter";
}): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found");

  const dir = await mkdtemp(path.join(tmpdir(), "clip-"));
  const sourcePath = path.join(dir, "source");
  const outPath = path.join(dir, "out.mp4");
  const assPath = path.join(dir, "captions.ass");

  try {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`Could not fetch audio: ${res.status}`);
    await writeFile(sourcePath, Buffer.from(await res.arrayBuffer()));

    const durationSeconds = (endMs - startMs) / 1000;
    const startSeconds = startMs / 1000;

    await writeFile(assPath, buildAssSubtitle(lines, durationSeconds, animationPreset));

    const bg = primaryColor.startsWith("#") ? primaryColor : `#${primaryColor}`;
    const assFilterPath = escapeFilterPath(assPath);
    const fontsDirPath = escapeFilterPath(FONTS_DIR);

    await run(ffmpegPath, [
      "-y",
      "-ss", String(startSeconds),
      "-t", String(durationSeconds),
      "-i", sourcePath,
      "-f", "lavfi",
      "-t", String(durationSeconds),
      "-i", `color=c=${bg}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}`,
      "-filter_complex", `[1:v]ass='${assFilterPath}':fontsdir='${fontsDirPath}'[v]`,
      "-map", "[v]",
      "-map", "0:a",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-shortest",
      outPath,
    ]);

    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
