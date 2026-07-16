import type { SupabaseClient } from "@supabase/supabase-js";
import { linesForSegment, attachWordTiming } from "./scoring";
import { renderClip, WATERMARK_TEXT } from "./render";
import { resolveClipStyle } from "./captionStyles";
import { resolveSegmentBackground } from "./backgrounds";
import { renderDimensions, formatSlug, DEFAULT_FORMAT, type ClipFormat } from "./formats";
import type { ExportTier } from "./access";
import type { BrandKit, ClipSegment, Lyric, LyricWord, Song, VideoTemplate } from "./types";

// Gathers a segment's render inputs and produces the MP4 at the given tier.
// Shared by queueExport (initial render) and the download route (lazy
// re-render to a clean HD version once a song is paid for).
export async function renderSegmentToBuffer(
  supabase: SupabaseClient,
  segment: ClipSegment,
  tier: ExportTier,
  format: ClipFormat = DEFAULT_FORMAT,
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

  // Attach per-word timing (lyric_words) so synced word-pop/karaoke render on
  // the actual vocal; lyrics without words fall back to the even split.
  const lyricIds = (lyrics ?? []).map((l) => l.id);
  const { data: words } = lyricIds.length
    ? await supabase
        .from("lyric_words")
        .select("lyric_id, word_index, text, start_ms, end_ms")
        .in("lyric_id", lyricIds)
        .returns<LyricWord[]>()
    : { data: [] as LyricWord[] };
  const timedLyrics = attachWordTiming(lyrics ?? [], words ?? []);

  const renderLines = linesForSegment(timedLyrics, song.duration_seconds, segment);

  // Brand kit (v1.5 S5.3) applies on PAID renders only: a subscriber's custom
  // watermark text, logo overlay, and accent colour. Free renders keep the
  // "made with" growth watermark and no branding.
  let brand: BrandKit | null = null;
  if (tier.label === "paid" && segment.user_id) {
    const { data } = await supabase
      .from("brand_kits")
      .select("*")
      .eq("user_id", segment.user_id)
      .maybeSingle<BrandKit>();
    brand = data ?? null;
  }

  const watermarkText = tier.watermark
    ? WATERMARK_TEXT
    : (brand?.watermark_text?.trim() || null);

  let logoBuffer: Buffer | null = null;
  if (brand?.logo_path) {
    const { data: blob } = await supabase.storage
      .from("brand-logos")
      .download(brand.logo_path);
    if (blob) logoBuffer = Buffer.from(await blob.arrayBuffer());
  }

  // Template defaults + per-clip overrides (+ brand accent) → the same
  // effective style the browser preview shows.
  const style = resolveClipStyle(template, segment, brand?.accent_hex);
  // Per-clip custom colors (S7.2) override the template's background; NULL cols
  // fall back to the template. Same resolver the preview uses, so they agree.
  const bg = resolveSegmentBackground(template, segment);
  const dims = renderDimensions(format, tier.label === "paid");
  return renderClip({
    audioUrl: song.audio_url,
    startMs: segment.start_ms,
    endMs: segment.end_ms,
    lines: renderLines,
    primaryColor: bg.primaryColor,
    backgroundStyle: bg.backgroundStyle,
    watermarkText,
    logoBuffer,
    brandAccent: brand?.accent_hex ?? null,
    width: dims.width,
    height: dims.height,
    caption: style.ass,
  });
}

// Storage path for an export at a given tier + format. The paid (HD,
// watermark-free) render lives at a separate path so upgrading never clobbers
// the free file. 9:16 keeps its original path (no format suffix) for backward
// compatibility with pre-4.1 exports; other formats get a slug so they never
// collide.
export function exportStoragePath(
  exportId: string,
  tier: ExportTier,
  format: ClipFormat = DEFAULT_FORMAT,
): string {
  const fmt = format === DEFAULT_FORMAT ? "" : `-${formatSlug(format)}`;
  return tier.label === "paid"
    ? `${exportId}${fmt}-hd.mp4`
    : `${exportId}${fmt}.mp4`;
}
