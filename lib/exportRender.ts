import type { SupabaseClient } from "@supabase/supabase-js";
import { linesForSegment } from "./scoring";
import { renderClip } from "./render";
import { resolveClipStyle } from "./captionStyles";
import type { ExportTier } from "./access";
import type { ClipSegment, Lyric, Song, VideoTemplate } from "./types";

// Gathers a segment's render inputs and produces the MP4 at the given tier.
// Shared by queueExport (initial render) and the download route (lazy
// re-render to a clean HD version once a song is paid for).
export async function renderSegmentToBuffer(
  supabase: SupabaseClient,
  segment: ClipSegment,
  tier: ExportTier,
): Promise<Buffer> {
  if (!segment.template_id) throw new Error("Pick a template first");

  const [{ data: song }, { data: template }, { data: lyrics }] =
    await Promise.all([
      supabase.from("songs").select("*").eq("id", segment.song_id).maybeSingle<Song>(),
      supabase
        .from("video_templates")
        .select("*")
        .eq("id", segment.template_id)
        .maybeSingle<VideoTemplate>(),
      supabase
        .from("lyrics")
        .select("*")
        .eq("song_id", segment.song_id)
        .order("line_index", { ascending: true })
        .returns<Lyric[]>(),
    ]);

  if (!song?.audio_url) throw new Error("Song has no audio to render from");
  if (!template) throw new Error("Template not found");

  const renderLines = linesForSegment(lyrics ?? [], song.duration_seconds, segment);
  // Template defaults + per-clip overrides → the same effective style the
  // browser preview shows, so exports match the preview (font, size, style
  // preset, position, animation).
  const style = resolveClipStyle(template, segment);
  return renderClip({
    audioUrl: song.audio_url,
    startMs: segment.start_ms,
    endMs: segment.end_ms,
    lines: renderLines,
    primaryColor: template.primary_color,
    backgroundStyle: template.background_style,
    watermark: tier.watermark,
    width: tier.width,
    height: tier.height,
    caption: style.ass,
  });
}

// Storage path for an export at a given tier. The paid (HD, watermark-free)
// render lives at a separate path so upgrading never clobbers the free file.
export function exportStoragePath(exportId: string, tier: ExportTier): string {
  return tier.label === "paid" ? `${exportId}-hd.mp4` : `${exportId}.mp4`;
}
