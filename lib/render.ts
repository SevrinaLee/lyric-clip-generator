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
function notoSansPath(): string {
  return path.join(process.cwd(), "assets/fonts/noto-sans-regular.ttf");
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%");
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`));
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
  const font = notoSansPath();

  try {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`Could not fetch audio: ${res.status}`);
    await writeFile(sourcePath, Buffer.from(await res.arrayBuffer()));

    const durationSeconds = (endMs - startMs) / 1000;
    const startSeconds = startMs / 1000;

    const drawtextFilters = lines.map((line, i) => {
      const text = escapeDrawtext(line.text);
      const nextOffset = lines[i + 1]?.offsetSeconds ?? durationSeconds;
      const enable = `between(t,${line.offsetSeconds},${nextOffset})`;

      let extra = "";
      if (animationPreset === "fade") {
        extra = `:alpha='if(lt(t-${line.offsetSeconds},0.4),(t-${line.offsetSeconds})/0.4,1)'`;
      } else if (animationPreset === "bounce") {
        extra = `:y=(h-text_h)/2+20*sin(2*PI*(t-${line.offsetSeconds}))`;
      }

      return (
        `drawtext=fontfile='${font.replace(/\\/g, "/")}'` +
        `:text='${text}':fontcolor=white:fontsize=64` +
        `:x=(w-text_w)/2${extra.includes(":y=") ? "" : ":y=(h-text_h)/2"}${extra}` +
        `:box=1:boxcolor=black@0.35:boxborderw=20` +
        `:enable='${enable}'`
      );
    });

    const bg = primaryColor.startsWith("#") ? primaryColor : `#${primaryColor}`;

    await run(ffmpegPath, [
      "-y",
      "-ss", String(startSeconds),
      "-t", String(durationSeconds),
      "-i", sourcePath,
      "-f", "lavfi",
      "-t", String(durationSeconds),
      "-i", `color=c=${bg}:s=1080x1920`,
      "-filter_complex", `[1:v]${drawtextFilters.join(",")}[v]`,
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
