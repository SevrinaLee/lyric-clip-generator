"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateSegments, timeLines } from "@/lib/scoring";
import { renderClip } from "@/lib/render";
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

  const rows = lines.map((text, index) => ({
    song_id: songId,
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
    line_index: index,
    text: line.text,
    start_ms: line.start_ms,
    end_ms: line.end_ms,
  }));

  const { error: insertError } = await supabase.from("lyrics").insert(rows);
  if (insertError) throw new Error(`Could not save lyrics: ${insertError.message}`);

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
    .update(updates)
    .eq("id", lyricId);
  if (error) throw new Error(`Could not update line: ${error.message}`);

  if (lyric) revalidatePath(`/songs/${lyric.song_id}`);
}

export async function generateClips(songId: string) {
  const supabase = await createClient();

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

  const templateList = templates ?? [];
  const rows = segments.map((seg, i) => ({
    song_id: songId,
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

export async function selectTemplate(segmentId: string, templateId: string) {
  const supabase = await createClient();
  const { data: segment } = await supabase
    .from("clip_segments")
    .select("song_id")
    .eq("id", segmentId)
    .maybeSingle<{ song_id: string }>();

  const { error } = await supabase
    .from("clip_segments")
    .update({ template_id: templateId })
    .eq("id", segmentId);

  if (error) throw new Error(`Could not update template: ${error.message}`);
  if (segment) revalidatePath(`/songs/${segment.song_id}`);
}

export async function queueExport(segmentId: string) {
  const supabase = await createClient();

  const { data: segment } = await supabase
    .from("clip_segments")
    .select("*")
    .eq("id", segmentId)
    .maybeSingle<ClipSegment>();
  if (!segment) throw new Error("Clip segment not found");
  if (!segment.template_id) throw new Error("Pick a template first");

  const [{ data: song }, { data: template }, { data: lyrics }] =
    await Promise.all([
      supabase
        .from("songs")
        .select("*")
        .eq("id", segment.song_id)
        .maybeSingle<Song>(),
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

  const { data: exportRow, error: insertError } = await supabase
    .from("exports")
    .insert({
      clip_segment_id: segmentId,
      status: "rendering",
      platform: segment.platform,
    })
    .select("id")
    .single();
  if (insertError || !exportRow) {
    throw new Error(`Could not queue export: ${insertError?.message}`);
  }

  revalidatePath(`/songs/${segment.song_id}`);

  try {
    // Same estimation generateClips used to pick this window — recomputing
    // it here (rather than trusting lyrics.start_ms, which is null until
    // Sprint 4's real transcription lands) recovers which lines it covers.
    const timedLines = timeLines(lyrics ?? [], song.duration_seconds);
    const linesInWindow = timedLines.filter(
      (l) => l.start_ms < segment.end_ms && l.end_ms > segment.start_ms,
    );
    const renderLines =
      linesInWindow.length > 0
        ? linesInWindow.map((l) => ({
            text: l.text,
            offsetSeconds: Math.max(0, (l.start_ms - segment.start_ms) / 1000),
          }))
        : [{ text: segment.label, offsetSeconds: 0 }];

    const videoBuffer = await renderClip({
      audioUrl: song.audio_url,
      startMs: segment.start_ms,
      endMs: segment.end_ms,
      lines: renderLines,
      primaryColor: template.primary_color,
      animationPreset: template.animation_preset,
    });

    const path = `${exportRow.id}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(path, videoBuffer, { contentType: "video/mp4" });
    if (uploadError) throw new Error(uploadError.message);

    await supabase
      .from("exports")
      .update({ status: "done", video_url: path })
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
