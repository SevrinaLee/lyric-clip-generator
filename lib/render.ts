import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { parseBackgroundStyle, darkenHex } from "./backgrounds";
import { WORDPOP, wordSchedule, type AssCaptionStyle } from "./captionStyles";

// Vendored copy of Next.js's bundled Noto Sans (SIL OFL) — see assets/fonts.
// require.resolve("next/package.json") is NOT safe here: in Vercel's
// production webpack bundle it can resolve to an internal numeric module id
// instead of a real filesystem path, which crashes path.join at runtime.
// process.cwd() is reliable in both dev and the serverless bundle.
const FONTS_DIR = path.join(process.cwd(), "assets/fonts");
// Watermark always renders in the vendored default regardless of the
// caption's chosen font; captions use the family passed by the caller
// (resolved via lib/captionStyles.ts from vendored TTFs in assets/fonts).
const FONT_FAMILY = "Noto Sans";
// Caption layout is authored at a fixed reference HEIGHT (REF_H); PlayResX is
// derived from the output aspect so the design space always matches the output
// aspect (no distortion) and font sizes / margins stay consistent across
// formats and tiers — libass just scales the reference to the actual output.
const DESIGN_W = 1080;
const DESIGN_H = 1920;
const REF_H = 1920;
export const WATERMARK_TEXT = "made with Lyric Clip Generator";

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

// One Dialogue event that reveals a line word-by-word: each word starts
// hidden (\alpha FF) and, at its scheduled offset, pops in (instant reveal +
// a brief scale bump). All words share one event so libass lays the line out
// at full width once — words appear in place with no reflow jitter. Timing
// comes from the shared wordSchedule so the CSS preview matches.
// One Dialogue event that reveals a line word-by-word: each word starts
// hidden (\alpha FF) and, at its scheduled offset, pops in. Uses real per-word
// timing when the line carries it (line.words), else the even split.
function wordPopEventText(line: RenderLine, lineDurationSeconds: number): string {
  const sched = wordSchedule(line.text, lineDurationSeconds, line.words);
  if (sched.length === 0) return "";
  const { revealMs, popInMs, settleMs, scalePct } = WORDPOP;
  return sched
    .map(({ word, startSec }) => {
      const t = Math.round(startSec * 1000);
      const w = escapeAssText(word);
      // Reset scale/alpha per word (so state can't bleed from the previous
      // word), hide it, then fade+pop in at t. The reveal uses a real (non-
      // zero) duration — a zero-length \t ramps alpha over the whole event.
      return (
        `{\\fscx100\\fscy100\\alpha&HFF&` +
        `\\t(${t},${t + revealMs},\\alpha&H00&)` +
        `\\t(${t},${t + popInMs},\\fscx${scalePct}\\fscy${scalePct})` +
        `\\t(${t + popInMs},${t + popInMs + settleMs},\\fscx100\\fscy100)}${w} `
      );
    })
    .join("");
}

// One Dialogue event that fills each word from the unsung (SecondaryColour) to
// the sung (PrimaryColour) as it's reached, via ASS \k (centiseconds). Uses
// real word timing when present, else the even split. \k only recolours, so it
// composes with any style preset.
function karaokeEventText(line: RenderLine, lineDurationSeconds: number): string {
  const sched = wordSchedule(line.text, lineDurationSeconds, line.words);
  if (sched.length === 0) return "";
  // \k accumulates from the event start, so a lead-in empty syllable delays the
  // first word's fill to its actual offset (otherwise every word fills one slot
  // early when the first word doesn't start at 0).
  const leadCs = Math.round(sched[0].startSec * 100);
  const lead = leadCs > 0 ? `{\\k${leadCs}}` : "";
  return (
    lead +
    sched
      .map(({ word, startSec }, i) => {
        const nextStart = sched[i + 1]?.startSec ?? Math.max(0, lineDurationSeconds);
        const durCs = Math.max(1, Math.round((nextStart - startSec) * 100));
        return `{\\k${durCs}}${escapeAssText(word)} `;
      })
      .join("")
  );
}

function buildAssSubtitle(
  lines: RenderLine[],
  durationSeconds: number,
  watermarkText: string | null,
  cap: AssCaptionStyle,
  playResX: number,
  playResY: number,
): string {
  // Watermark style: bottom-centre (Alignment 2), small, ~60% opacity white
  // with a soft outline so it stays legible over any background. The caption
  // (Default) style is driven by the resolved per-clip style.
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${cap.fontFamily},${cap.fontSize},${cap.primary},${cap.secondary},${cap.outline},${cap.back},0,0,0,0,100,100,0,0,${cap.borderStyle},${cap.outlineWidth},${cap.shadow},${cap.alignment},40,40,${cap.marginV},1
Style: Watermark,${FONT_FAMILY},34,&H50FFFFFF,&H000000FF,&H80000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,40,40,44,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = lines
    .map((line, i) => {
      const nextOffset = lines[i + 1]?.offsetSeconds ?? durationSeconds;
      const start = formatAssTime(line.offsetSeconds);
      const end = formatAssTime(nextOffset);

      if (cap.animation === "wordpop") {
        const body = wordPopEventText(line, nextOffset - line.offsetSeconds);
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${body}`;
      }
      if (cap.animation === "karaoke") {
        const body = karaokeEventText(line, nextOffset - line.offsetSeconds);
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${body}`;
      }

      const text = escapeAssText(line.text);
      let tag = "";
      if (cap.animation === "fade") {
        tag = "{\\fad(400,0)}";
      } else if (cap.animation === "bounce") {
        tag = "{\\t(0,150,\\fscx115\\fscy115)\\t(150,300,\\fscx100\\fscy100)}";
      }
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${tag}${text}`;
    })
    .join("\n");

  const watermarkEvent = watermarkText
    ? `\nDialogue: 1,${formatAssTime(0)},${formatAssTime(durationSeconds)},Watermark,,0,0,0,,${escapeAssText(watermarkText)}`
    : "";

  return header + events + watermarkEvent + "\n";
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

export type RenderLine = {
  text: string;
  offsetSeconds: number;
  // Per-word timing relative to the segment start, when available (drives
  // synced word-pop/karaoke); absent = even split.
  words?: { text: string; offsetSeconds: number }[];
};

// Resolves a background_style into the ffmpeg pieces the render needs:
//  - lavfiInput: the `-f lavfi -i` source that becomes input [1]
//  - filterChain: an optional filter_complex fragment turning [1:v] (and, for
//    waveform, the audio) into a labelled [bg]; empty means use [1:v] directly
//  - audioMap: the output audio stream (waveform must asplit so the same audio
//    both drives the wave and is muxed out)
type BackgroundSource = {
  lavfiInput: string;
  filterChain: string;
  audioMap: string;
};

function backgroundSource(
  backgroundStyle: string | null | undefined,
  primaryColor: string,
  width: number,
  height: number,
  brandAccent?: string | null,
): BackgroundSource {
  const bg = parseBackgroundStyle(backgroundStyle, primaryColor);
  const size = `${width}x${height}`;

  if (bg.type === "gradient") {
    return {
      lavfiInput: `gradients=s=${size}:c0=${bg.colors[0]}:c1=${bg.colors[1]}:x0=0:y0=0:x1=${width}:y1=${height}:speed=0.03`,
      filterChain: "",
      audioMap: "0:a",
    };
  }

  if (bg.type === "pulse") {
    // Faster gradient drift + a gentle brightness "breath" (~2s period).
    return {
      lavfiInput: `gradients=s=${size}:c0=${bg.colors[0]}:c1=${bg.colors[1]}:x0=0:y0=0:x1=${width}:y1=${height}:speed=0.08`,
      filterChain: `[1:v]eq=brightness=0.06*sin(t*PI):eval=frame[bg]`,
      audioMap: "0:a",
    };
  }

  if (bg.type === "waveform") {
    const base = bg.colors[0];
    // Brand-kit accent overrides the wave colour when set (paid renders).
    const accentHex =
      brandAccent && /^#[0-9a-fA-F]{6}$/.test(brandAccent) ? brandAccent : bg.colors[1];
    const accent = accentHex.replace("#", "0x"); // showwaves wants 0xRRGGBB
    const waveH = Math.round(height * 0.36);
    // asplit: one copy feeds showwaves, the other is muxed as the clip's audio.
    // mode=line + draw=full keeps the accent colour crisp (cline washes out).
    const filterChain =
      `[0:a]asplit=2[aud][wsrc];` +
      `[wsrc]showwaves=s=${width}x${waveH}:mode=line:colors=${accent}:rate=25:draw=full,format=yuva420p[w];` +
      `[1:v][w]overlay=0:(H-h)/2[bg]`;
    return {
      lavfiInput: `gradients=s=${size}:c0=${base}:c1=${darkenHex(base, 0.4)}:speed=0.02`,
      filterChain,
      audioMap: "[aud]",
    };
  }

  const color = bg.color.startsWith("#") ? bg.color : `#${bg.color}`;
  return { lavfiInput: `color=c=${color}:s=${size}`, filterChain: "", audioMap: "0:a" };
}

export async function renderClip({
  audioUrl,
  startMs,
  endMs,
  lines,
  primaryColor,
  caption,
  backgroundStyle,
  watermarkText = null,
  logoBuffer = null,
  brandAccent = null,
  width = DESIGN_W,
  height = DESIGN_H,
}: {
  audioUrl: string;
  startMs: number;
  endMs: number;
  lines: RenderLine[];
  primaryColor: string;
  /** Resolved caption style (font, size, preset, position, animation) */
  caption: AssCaptionStyle;
  backgroundStyle?: string | null;
  /** Bottom-centre watermark text (free-tier growth mark OR a brand kit's
   *  text); null = none. */
  watermarkText?: string | null;
  /** Optional brand logo (PNG/JPEG), overlaid bottom-right on paid renders. */
  logoBuffer?: Buffer | null;
  /** Brand accent (#rrggbb) — overrides waveform colour; caption fill is
   *  handled by the resolved `caption`. */
  brandAccent?: string | null;
  width?: number;
  height?: number;
}): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found");

  const dir = await mkdtemp(path.join(tmpdir(), "clip-"));
  const sourcePath = path.join(dir, "source");
  const outPath = path.join(dir, "out.mp4");
  const assPath = path.join(dir, "captions.ass");
  const logoPath = path.join(dir, "logo.img");

  try {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`Could not fetch audio: ${res.status}`);
    await writeFile(sourcePath, Buffer.from(await res.arrayBuffer()));

    const durationSeconds = (endMs - startMs) / 1000;
    const startSeconds = startMs / 1000;

    // Author captions at the reference height with an aspect-matched width, so
    // the same font sizes/margins work for any output format.
    const playResY = REF_H;
    const playResX = Math.round((REF_H * width) / height);
    await writeFile(
      assPath,
      buildAssSubtitle(lines, durationSeconds, watermarkText, caption, playResX, playResY),
    );

    const assFilterPath = escapeFilterPath(assPath);
    const fontsDirPath = escapeFilterPath(FONTS_DIR);
    // Paid tier renders at full resolution with a higher-quality crf; the free
    // tier is smaller and slightly more compressed.
    const crf = width >= DESIGN_W ? "20" : "28";

    const bgSrc = backgroundSource(backgroundStyle, primaryColor, width, height, brandAccent);
    // Compose the (optional) background filter chain, then burn captions over
    // whichever label carries the finished background.
    const bgLabel = bgSrc.filterChain ? "[bg]" : "[1:v]";
    let filterComplex =
      (bgSrc.filterChain ? `${bgSrc.filterChain};` : "") +
      `${bgLabel}ass='${assFilterPath}':fontsdir='${fontsDirPath}'[v]`;

    const inputs = [
      "-ss", String(startSeconds),
      "-t", String(durationSeconds),
      "-i", sourcePath,
      "-f", "lavfi",
      "-t", String(durationSeconds),
      "-i", bgSrc.lavfiInput,
    ];

    // Brand logo (paid renders): scale to ~8% of the output height and overlay
    // bottom-right. The logo is input [2]; captions are already burned into [v].
    let videoLabel = "[v]";
    if (logoBuffer) {
      await writeFile(logoPath, logoBuffer);
      inputs.push("-i", logoPath);
      const logoH = Math.round(height * 0.08);
      filterComplex += `;[2:v]scale=-1:${logoH}[lg];[v][lg]overlay=W-w-40:H-h-40[out]`;
      videoLabel = "[out]";
    }

    await run(ffmpegPath, [
      "-y",
      ...inputs,
      "-filter_complex", filterComplex,
      "-map", videoLabel,
      "-map", bgSrc.audioMap,
      "-c:v", "libx264",
      "-crf", crf,
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
