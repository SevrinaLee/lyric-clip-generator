// Shared parsing for video_templates.background_style, used by both the
// ffmpeg render (server) and the CSS previews (client) so they always agree.
//
// Formats:
//   'solid'                  → flat primary_color
//   'gradient:<hex0>:<hex1>' → two-color gradient (drifts slowly in the
//                              rendered video; static diagonal in previews)
//   'pulse:<hex0>:<hex1>'    → gradient that drifts faster and gently
//                              breathes in brightness (animated; previews
//                              approximate with a plain gradient)
//   'waveform:<base>:<accent>' → audio-reactive waveform (accent) over a dark
//                              gradient derived from <base>. Genuinely reacts
//                              to the song in the render; previews show a
//                              static wave hint.

export type ParsedBackground =
  | { type: "solid"; color: string }
  | { type: "gradient"; colors: [string, string] }
  | { type: "pulse"; colors: [string, string] }
  | { type: "waveform"; colors: [string, string] };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function parseTwo(
  style: string,
  prefix: string,
): [string, string] | null {
  const [, c0, c1] = style.split(":");
  if (HEX_RE.test(c0) && HEX_RE.test(c1)) return [c0, c1];
  return null;
}

export function parseBackgroundStyle(
  style: string | null | undefined,
  primaryColor: string,
): ParsedBackground {
  if (style?.startsWith("gradient:")) {
    const c = parseTwo(style, "gradient:");
    if (c) return { type: "gradient", colors: c };
  }
  if (style?.startsWith("pulse:")) {
    const c = parseTwo(style, "pulse:");
    if (c) return { type: "pulse", colors: c };
  }
  if (style?.startsWith("waveform:")) {
    const c = parseTwo(style, "waveform:");
    if (c) return { type: "waveform", colors: c };
  }
  return { type: "solid", color: primaryColor };
}

/** Multiply a #rrggbb hex's channels by `factor` (0..1) to darken it. */
export function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function waveHintDataUri(accent: string): string {
  // A static sine path — a "this is a waveform template" hint for swatches and
  // the paused preview; the real render is audio-reactive.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60' viewBox='0 0 120 60'><path d='M0 30 C 10 6, 20 6, 30 30 S 50 54, 60 30 S 80 6, 90 30 S 110 54, 120 30' fill='none' stroke='${accent}' stroke-width='4' stroke-linecap='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function cssBackground(bg: ParsedBackground): string {
  if (bg.type === "gradient" || bg.type === "pulse") {
    return `linear-gradient(160deg, ${bg.colors[0]}, ${bg.colors[1]})`;
  }
  if (bg.type === "waveform") {
    const [base, accent] = bg.colors;
    return `${waveHintDataUri(accent)} left center/100% 42% no-repeat, linear-gradient(160deg, ${base}, ${darkenHex(base, 0.4)})`;
  }
  return bg.color;
}
