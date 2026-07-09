// Shared parsing for video_templates.background_style, used by both the
// ffmpeg render (server) and the CSS previews (client) so they always agree.
//
// Formats:
//   'solid'                  → flat primary_color
//   'gradient:<hex0>:<hex1>' → two-color gradient (drifts slowly in the
//                              rendered video; static diagonal in previews)

export type ParsedBackground =
  | { type: "solid"; color: string }
  | { type: "gradient"; colors: [string, string] };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function parseBackgroundStyle(
  style: string | null | undefined,
  primaryColor: string,
): ParsedBackground {
  if (style?.startsWith("gradient:")) {
    const [, c0, c1] = style.split(":");
    if (HEX_RE.test(c0) && HEX_RE.test(c1)) {
      return { type: "gradient", colors: [c0, c1] };
    }
  }
  return { type: "solid", color: primaryColor };
}

export function cssBackground(bg: ParsedBackground): string {
  return bg.type === "gradient"
    ? `linear-gradient(160deg, ${bg.colors[0]}, ${bg.colors[1]})`
    : bg.color;
}
