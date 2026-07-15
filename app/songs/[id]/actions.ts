"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateSegments } from "@/lib/scoring";
import { evaluateSongAccess, exportTier } from "@/lib/access";
import { renderSegmentToBuffer, exportStoragePath } from "@/lib/exportRender";
import {
  FONT_REGISTRY,
  SIZE_PRESETS,
  STYLE_PRESETS,
  POSITION_PRESETS,
  isAnimationPremium,
  type CaptionAnimation,
} from "@/lib/captionStyles";
import { isFormat, isFormatPremium, DEFAULT_FORMAT } from "@/lib/formats";
import { transcribeAudio } from "@/lib/whisper";
import type { ClipSegment, Lyric, Song, VideoTemplate } from "@/lib/types";

export async function addLyrics(songId: string, rawText: string) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("Paste at least one line of lyrics");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in to add lyrics");

  const rows = lines.map((text, index) => ({
    song_id: songId,
    user_id: user.id,
    line_index: index,
    text,
  }));

  const { error } = await supabase.from("lyrics").insert(rows);
  if (error) {
    throw new Error(`Could not save lyrics: ${error.message}`);
  }

  revalidatePath(`/songs/${songId}`);
}

export async function transcribeLyrics(songId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in to transcribe lyrics");

  const { data: song } = await supabase
    .from("songs")
    .select("*")
    .eq("id", songId)
    .maybeSingle<Song>();
  if (!song?.audio_url) throw new Error("Song has no audio to transcribe");

  const lines = await transcribeAudio(song.audio_url);
  if (lines.length === 0) {
    throw new Error("Couldn't transcribe this audio — try pasting lyrics instead");
  }

  const { error: deleteError } = await supabase
    .from("lyrics")
    .delete()
    .eq("song_id", songId);
  if (deleteError) throw new Error(`Could not replace lyrics: ${deleteError.message}`);

  const rows = lines.map((line, index) => ({
    song_id: songId,
    user_id: user.id,
    line_index: index,
    text: line.text,
    start_ms: line.start_ms,
    end_ms: line.end_ms,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("lyrics")
    .insert(rows)
    .select("id, line_index");
  if (insertError) throw new Error(`Could not save lyrics: ${insertError.message}`);

  // Persist per-word timing where Whisper provided it (aesthetics v1.3). The
  // old lines were just deleted, so their words cascaded away. Word insert is
  // non-fatal: captions fall back to the even split if it fails, so a word
  // hiccup never blocks a successful transcription.
  const byIndex = new Map((inserted ?? []).map((r) => [r.line_index, r.id]));
  const wordRows = lines.flatMap((line, index) => {
    const lyricId = byIndex.get(index);
    if (!lyricId || !line.words) return [];
    return line.words.map((w, wordIndex) => ({
      lyric_id: lyricId,
      user_id: user.id,
      word_index: wordIndex,
      text: w.text,
      start_ms: w.start_ms,
      end_ms: w.end_ms,
    }));
  });
  if (wordRows.length > 0) {
    await supabase.from("lyric_words").insert(wordRows);
  }

  revalidatePath(`/songs/${songId}`);
}

export async function updateLyricTiming(
  lyricId: string,
  updates: { text: string; start_ms: number; end_ms: number },
) {
  const supabase = await createClient();
  const { data: lyric } = await supabase
    .from("lyrics")
    .select("song_id")
    .eq("id", lyricId)
    .maybeSingle<{ song_id: string }>();

  const { error } = await supabase
    .from("lyrics")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", lyricId);
  if (error) throw new Error(`Could not update line: ${error.message}`);

  // A hand-retimed line's Whisper word times are now stale — drop them so
  // captions fall back to the even split rather than mis-syncing (v1.3).
  await supabase.from("lyric_words").delete().eq("lyric_id", lyricId);

  if (lyric) revalidatePath(`/songs/${lyric.song_id}`);
}

// Used by TapTimingTool: the user taps along to the whole song locally
// (no network calls mid-session, so playback stays smooth), then this
// persists every captured line in one round trip.
export async function bulkUpdateLyricTimings(
  updates: { id: string; start_ms: number; end_ms: number }[],
) {
  if (updates.length === 0) return;

  const supabase = await createClient();
  const { data: lyric } = await supabase
    .from("lyrics")
    .select("song_id")
    .eq("id", updates[0].id)
    .maybeSingle<{ song_id: string }>();

  const now = new Date().toISOString();
  for (const u of updates) {
    const { error } = await supabase
      .from("lyrics")
      .update({ start_ms: u.start_ms, end_ms: u.end_ms, updated_at: now })
      .eq("id", u.id);
    if (error) throw new Error(`Could not save timing: ${error.message}`);
  }

  // Retimed lines' Whisper word times are stale — drop them (v1.3).
  await supabase
    .from("lyric_words")
    .delete()
    .in("lyric_id", updates.map((u) => u.id));

  if (lyric) revalidatePath(`/songs/${lyric.song_id}`);
}

// Deleting doesn't renumber remaining rows' line_index — the UI displays
// each line's position in the fetched (already line_index-ordered) array
// rather than the stored line_index, so gaps left by a delete are never
// visible, and lib/scoring.ts's timing estimate only cares about that same
// array position too.
export async function deleteLyric(lyricId: string) {
  const supabase = await createClient();
  const { data: lyric } = await supabase
    .from("lyrics")
    .select("song_id")
    .eq("id", lyricId)
    .maybeSingle<{ song_id: string }>();

  const { error } = await supabase.from("lyrics").delete().eq("id", lyricId);
  if (error) throw new Error(`Could not delete line: ${error.message}`);

  if (lyric) revalidatePath(`/songs/${lyric.song_id}`);
}

export async function generateClips(songId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in to generate clips");

  const [{ data: song }, { data: lyrics }, { data: existing }, { data: templates }] =
    await Promise.all([
      supabase.from("songs").select("*").eq("id", songId).maybeSingle<Song>(),
      supabase
        .from("lyrics")
        .select("*")
        .eq("song_id", songId)
        .order("line_index", { ascending: true })
        .returns<Lyric[]>(),
      supabase
        .from("clip_segments")
        .select("id")
        .eq("song_id", songId)
        .returns<{ id: string }[]>(),
      supabase.from("video_templates").select("*").returns<VideoTemplate[]>(),
    ]);

  if (!song) throw new Error("Song not found");
  if (!lyrics || lyrics.length === 0) {
    throw new Error("Add lyrics before generating clips");
  }
  if (existing && existing.length > 0) {
    throw new Error("Clips already generated for this song");
  }

  const segments = generateSegments(lyrics, song.title, song.duration_seconds);
  if (segments.length === 0) {
    throw new Error("Couldn't score clips — try adding more lyrics");
  }

  // Default new clips to free (non-premium) templates so a free user always
  // starts with something they can actually export; premium ones are opt-in
  // after unlocking the song.
  const freeTemplates = (templates ?? []).filter((t) => !t.is_premium);
  const templateList = freeTemplates.length > 0 ? freeTemplates : (templates ?? []);
  const rows = segments.map((seg, i) => ({
    song_id: songId,
    user_id: user.id,
    label: seg.label,
    start_ms: seg.start_ms,
    end_ms: seg.end_ms,
    platform: seg.platform,
    template_id: templateList[i % templateList.length]?.id ?? null,
    hook_score: seg.hook_score,
    hook_score_source: "rule-based-v1",
    hook_score_confidence: seg.hook_score_confidence,
    hook_score_review_status: "unreviewed",
  }));

  const { error } = await supabase.from("clip_segments").insert(rows);
  if (error) {
    throw new Error(`Couldn't score clips — please try again`);
  }

  revalidatePath(`/songs/${songId}`);
}

// Nudge a clip's window (start/end). Owner-only via RLS. Bounds: 3-60s and
// within the song. Marks the hook score as user-adjusted so we don't present a
// machine score for a hand-picked window. The download's stale badge is
// handled client-side (a window change post-render marks the clip stale).
export async function updateSegmentWindow(
  segmentId: string,
  startMs: number,
  endMs: number,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in");

  const { data: segment } = await supabase
    .from("clip_segments")
    .select("song_id")
    .eq("id", segmentId)
    .maybeSingle<{ song_id: string }>();
  if (!segment) throw new Error("Clip segment not found");

  const { data: song } = await supabase
    .from("songs")
    .select("duration_seconds")
    .eq("id", segment.song_id)
    .maybeSingle<{ duration_seconds: number | null }>();

  const start = Math.max(0, Math.round(startMs));
  let end = Math.round(endMs);
  const durationMs = song?.duration_seconds
    ? Math.round(song.duration_seconds * 1000)
    : null;
  if (durationMs) end = Math.min(end, durationMs);

  const windowMs = end - start;
  if (windowMs < 3000) throw new Error("A clip must be at least 3 seconds");
  if (windowMs > 60000) throw new Error("A clip must be 60 seconds or less");

  const { error } = await supabase
    .from("clip_segments")
    .update({
      start_ms: start,
      end_ms: end,
      hook_score_review_status: "user-adjusted",
    })
    .eq("id", segmentId);
  if (error) throw new Error(`Could not update clip window: ${error.message}`);

  revalidatePath(`/songs/${segment.song_id}`);
}

// Re-suggest clips. Replaces the old "Clips already generated" dead-end:
// segments WITHOUT a finished export are cleared and re-scored, while any
// segment you've already exported is kept (its clip lives in your library).
export async function regenerateClips(songId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in to regenerate clips");

  const [{ data: song }, { data: lyrics }, { data: existing }, { data: templates }] =
    await Promise.all([
      supabase.from("songs").select("*").eq("id", songId).maybeSingle<Song>(),
      supabase
        .from("lyrics")
        .select("*")
        .eq("song_id", songId)
        .order("line_index", { ascending: true })
        .returns<Lyric[]>(),
      supabase
        .from("clip_segments")
        .select("id, start_ms, end_ms")
        .eq("song_id", songId)
        .returns<{ id: string; start_ms: number; end_ms: number }[]>(),
      supabase.from("video_templates").select("*").returns<VideoTemplate[]>(),
    ]);

  if (!song) throw new Error("Song not found");
  if (!lyrics || lyrics.length === 0) {
    throw new Error("Add lyrics before generating clips");
  }

  // Which segments have a finished export? Those are kept.
  const segIds = (existing ?? []).map((s) => s.id);
  const { data: doneExports } = segIds.length
    ? await supabase
        .from("exports")
        .select("clip_segment_id")
        .in("clip_segment_id", segIds)
        .eq("status", "done")
    : { data: [] as { clip_segment_id: string }[] };
  const exportedSegIds = new Set(
    (doneExports ?? []).map((e) => e.clip_segment_id),
  );
  const kept = (existing ?? []).filter((s) => exportedSegIds.has(s.id));
  const toDelete = (existing ?? [])
    .filter((s) => !exportedSegIds.has(s.id))
    .map((s) => s.id);

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("clip_segments")
      .delete()
      .in("id", toDelete);
    if (error) throw new Error(`Could not clear old clips: ${error.message}`);
  }

  const generated = generateSegments(lyrics, song.title, song.duration_seconds);
  const freeTemplates = (templates ?? []).filter((t) => !t.is_premium);
  const templateList = freeTemplates.length > 0 ? freeTemplates : (templates ?? []);
  const keptWindows = new Set(kept.map((s) => `${s.start_ms}-${s.end_ms}`));
  const slotsLeft = Math.max(0, 3 - kept.length);
  const newSegs = generated
    .filter((g) => !keptWindows.has(`${g.start_ms}-${g.end_ms}`))
    .slice(0, slotsLeft);

  if (newSegs.length > 0) {
    const rows = newSegs.map((seg, i) => ({
      song_id: songId,
      user_id: user.id,
      label: seg.label,
      start_ms: seg.start_ms,
      end_ms: seg.end_ms,
      platform: seg.platform,
      template_id: templateList[i % templateList.length]?.id ?? null,
      hook_score: seg.hook_score,
      hook_score_source: "rule-based-v1",
      hook_score_confidence: seg.hook_score_confidence,
      hook_score_review_status: "unreviewed",
    }));
    const { error } = await supabase.from("clip_segments").insert(rows);
    if (error) throw new Error("Couldn't regenerate clips — please try again");
  }

  revalidatePath(`/songs/${songId}`);
}

export async function selectTemplate(segmentId: string, templateId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in");

  const { data: segment } = await supabase
    .from("clip_segments")
    .select("song_id")
    .eq("id", segmentId)
    .maybeSingle<{ song_id: string }>();
  if (!segment) throw new Error("Clip segment not found");

  // Premium templates require paid access to the song — enforce server-side,
  // not just in the picker UI.
  const { data: template } = await supabase
    .from("video_templates")
    .select("is_premium")
    .eq("id", templateId)
    .maybeSingle<{ is_premium: boolean }>();
  if (template?.is_premium) {
    const access = await evaluateSongAccess(user.id, segment.song_id);
    if (exportTier(access.reason).label !== "paid") {
      throw new Error("Premium template — unlock this song to use it.");
    }
  }

  const { error } = await supabase
    .from("clip_segments")
    .update({ template_id: templateId })
    .eq("id", segmentId);

  if (error) throw new Error(`Could not update template: ${error.message}`);
  revalidatePath(`/songs/${segment.song_id}`);
}

// Per-clip caption style overrides (null = revert to template default).
// Values are validated against the registries and premium fonts are gated
// server-side, mirroring selectTemplate — never trust the picker UI alone.
type ClipStyleUpdates = {
  caption_font?: string | null;
  caption_size?: string | null;
  caption_position?: string | null;
  caption_style_preset?: string | null;
  caption_animation?: string | null;
};

export async function updateClipStyle(segmentId: string, updates: ClipStyleUpdates) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in");

  const { data: segment } = await supabase
    .from("clip_segments")
    .select("song_id")
    .eq("id", segmentId)
    .maybeSingle<{ song_id: string }>();
  if (!segment) throw new Error("Clip segment not found");

  // Cache paid-access lookup: several premium-gated options may be set at once.
  let paidChecked = false;
  let isPaid = false;
  const requirePaid = async (label: string) => {
    if (!paidChecked) {
      const access = await evaluateSongAccess(user.id, segment.song_id);
      isPaid = exportTier(access.reason).label === "paid";
      paidChecked = true;
    }
    if (!isPaid) throw new Error(`Premium ${label} — unlock this song to use it.`);
  };

  const patch: ClipStyleUpdates = {};

  if ("caption_font" in updates) {
    const font = updates.caption_font;
    if (font !== null && font !== undefined) {
      const def = FONT_REGISTRY[font];
      if (!def) throw new Error("Unknown font");
      if (def.isPremium) await requirePaid("font");
    }
    patch.caption_font = font ?? null;
  }

  if ("caption_size" in updates) {
    const size = updates.caption_size;
    if (size !== null && size !== undefined && !(size in SIZE_PRESETS)) {
      throw new Error("Unknown size");
    }
    patch.caption_size = size ?? null;
  }

  if ("caption_position" in updates) {
    const pos = updates.caption_position;
    if (pos !== null && pos !== undefined && !(pos in POSITION_PRESETS)) {
      throw new Error("Unknown position");
    }
    patch.caption_position = pos ?? null;
  }

  if ("caption_style_preset" in updates) {
    const sp = updates.caption_style_preset;
    if (sp !== null && sp !== undefined) {
      const preset = STYLE_PRESETS[sp as keyof typeof STYLE_PRESETS];
      if (!preset) throw new Error("Unknown style preset");
      if (preset.isPremium) await requirePaid("caption style");
    }
    patch.caption_style_preset = sp ?? null;
  }

  if ("caption_animation" in updates) {
    const anim = updates.caption_animation;
    if (anim !== null && anim !== undefined) {
      if (!["fade", "bounce", "wordpop", "karaoke"].includes(anim)) {
        throw new Error("Unknown animation");
      }
      if (isAnimationPremium(anim as CaptionAnimation)) {
        await requirePaid("caption animation");
      }
    }
    patch.caption_animation = anim ?? null;
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("clip_segments")
    .update(patch)
    .eq("id", segmentId);
  if (error) throw new Error(`Could not update style: ${error.message}`);
  revalidatePath(`/songs/${segment.song_id}`);
}

export async function queueExport(segmentId: string, format: string = DEFAULT_FORMAT) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in to export a clip");

  if (!isFormat(format)) throw new Error("Unknown format");

  const { data: segment } = await supabase
    .from("clip_segments")
    .select("*")
    .eq("id", segmentId)
    .maybeSingle<ClipSegment>();
  if (!segment) throw new Error("Clip segment not found");
  if (!segment.template_id) throw new Error("Pick a template first");

  // Render at the exporter's current tier: paid (founder or a paid song) gets
  // a clean HD clip; everyone else gets the watermarked, smaller free tier. A
  // later paid download re-renders a clean version (see the download route).
  const access = await evaluateSongAccess(user.id, segment.song_id);
  const tier = exportTier(access.reason);

  // Non-9:16 aspect ratios are premium — gate server-side (the picker UI
  // mirrors this but is never trusted).
  if (isFormatPremium(format) && tier.label !== "paid") {
    throw new Error("This aspect ratio is premium — unlock this song to export it.");
  }

  const { data: exportRow, error: insertError } = await supabase
    .from("exports")
    .insert({
      clip_segment_id: segmentId,
      user_id: user.id,
      status: "rendering",
      platform: segment.platform,
      format,
    })
    .select("id")
    .single();
  if (insertError || !exportRow) {
    throw new Error(`Could not queue export: ${insertError?.message}`);
  }

  revalidatePath(`/songs/${segment.song_id}`);

  try {
    const videoBuffer = await renderSegmentToBuffer(supabase, segment, tier, format);

    const path = exportStoragePath(exportRow.id, tier, format);
    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(path, videoBuffer, { contentType: "video/mp4", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    await supabase
      .from("exports")
      .update({ status: "done", video_url: path, tier: tier.label })
      .eq("id", exportRow.id);

    return { id: exportRow.id as string };
  } catch (err) {
    await supabase
      .from("exports")
      .update({ status: "failed" })
      .eq("id", exportRow.id);
    throw err;
  } finally {
    revalidatePath(`/songs/${segment.song_id}`);
  }
}
