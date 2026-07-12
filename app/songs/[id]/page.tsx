import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ClipSegment, Export, Lyric, Song, VideoTemplate } from "@/lib/types";
import { LyricEntryForm } from "./LyricEntryForm";
import { GenerateClipsButton } from "./GenerateClipsButton";
import { SegmentsPanel } from "./SegmentsPanel";
import { CheckoutStatusWatcher } from "./CheckoutStatusWatcher";
import { AutoTranscribeButton } from "./AutoTranscribeButton";
import type { EditableLine } from "./EditableLyricsTable";
import { LyricsEditPanel } from "./LyricsEditPanel";
import { linesForSegment, timeLines } from "@/lib/scoring";
import { googleFontsUrl } from "@/lib/fonts";
import { evaluateSongAccess } from "@/lib/access";

const PLATFORM_STYLES: Record<string, string> = {
  tiktok: "bg-mauve/15 text-mauve",
  reels: "bg-sky/25 text-ink",
  shorts: "bg-sage/30 text-ink",
};

// Rendering a clip (ffmpeg trim + drawtext + mux) runs inline inside the
// queueExport server action and can take longer than the 10s default.
export const maxDuration = 60;

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: song }, { data: { user } }] = await Promise.all([
    supabase.from("songs").select("*").eq("id", id).maybeSingle<Song>(),
    supabase.auth.getUser(),
  ]);

  if (!song) notFound();
  const isOwner = !!user && song.user_id === user.id;

  const [
    { data: lyrics },
    { data: segments },
    { data: templates },
    { data: exportRows },
    access,
  ] = await Promise.all([
    supabase
      .from("lyrics")
      .select("*")
      .eq("song_id", id)
      .order("line_index", { ascending: true })
      .returns<Lyric[]>(),
    supabase
      .from("clip_segments")
      .select("*")
      .eq("song_id", id)
      .order("start_ms", { ascending: true })
      .returns<ClipSegment[]>(),
    supabase.from("video_templates").select("*").returns<VideoTemplate[]>(),
    supabase
      .from("exports")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<Export[]>(),
    evaluateSongAccess(user?.id ?? null, id),
  ]);

  const hasLyrics = (lyrics?.length ?? 0) > 0;
  const hasSegments = (segments?.length ?? 0) > 0;

  // For the owner's edit view: every line gets a start/end to show (real if
  // set, lib/scoring.ts's estimate otherwise), flagged so the UI can hint
  // which is which — matches the same estimate queueExport/the preview use.
  const editableLyrics: EditableLine[] =
    isOwner && lyrics
      ? timeLines(lyrics, song.duration_seconds).map((t, i) => ({
          ...lyrics[i],
          start_ms: t.start_ms,
          end_ms: t.end_ms,
          isEstimated: lyrics[i].start_ms == null,
        }))
      : [];

  // Latest export per clip_segment_id (exports is queried unfiltered since
  // there's no FK to song_id — fine at this dataset size for v1).
  const exportsBySegment = new Map<string, Export>();
  for (const exp of exportRows ?? []) {
    if (!exportsBySegment.has(exp.clip_segment_id)) {
      exportsBySegment.set(exp.clip_segment_id, exp);
    }
  }

  // Precompute which lyric lines fall in each segment's window (same
  // logic queueExport uses to build captions) so the live preview shows
  // exactly what the export will render.
  const linesBySegment = new Map<string, { text: string; offsetSeconds: number }[]>();
  if (isOwner) {
    for (const seg of segments ?? []) {
      linesBySegment.set(
        seg.id,
        linesForSegment(lyrics ?? [], song.duration_seconds, seg),
      );
    }
  }

  const fontsUrl =
    isOwner && hasSegments
      ? googleFontsUrl((templates ?? []).map((t) => t.font))
      : "";

  return (
    <main className="relative min-h-screen overflow-hidden">
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-32 h-96 w-96 rounded-full bg-lavender/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-96 -left-24 h-72 w-72 rounded-full bg-sage/25 blur-3xl"
      />

      <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        <Link href="/" className="text-sm text-ink/50 hover:text-ink">
          ← Back
        </Link>

        <div>
          <h1 className="font-display text-4xl text-ink">{song.title}</h1>
          <p className="text-ink/50 mt-1">{song.artist}</p>
        </div>

        <Suspense fallback={null}>
          <CheckoutStatusWatcher songId={song.id} />
        </Suspense>

        {song.audio_url && (
          <audio
            controls
            src={song.audio_url}
            className="w-full rounded-full"
          >
            Your browser does not support the audio element.
          </audio>
        )}

        <section className="rounded-3xl bg-cream-deep border border-ink/10 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-lavender" />
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/50">
              Lyrics
            </h2>
          </div>

          {!hasLyrics ? (
            isOwner ? (
              <div className="space-y-4">
                <p className="text-ink/50 text-sm">Add lyrics to continue.</p>
                <LyricEntryForm songId={song.id} />
                <div className="flex items-center gap-3 text-xs text-ink/30">
                  <span className="h-px flex-1 bg-ink/10" />
                  or
                  <span className="h-px flex-1 bg-ink/10" />
                </div>
                <AutoTranscribeButton songId={song.id} />
              </div>
            ) : (
              <p className="text-ink/50 text-sm">No lyrics yet.</p>
            )
          ) : isOwner ? (
            <LyricsEditPanel lyrics={editableLyrics} audioUrl={song.audio_url} />
          ) : (
            <ol className="space-y-1.5 text-sm">
              {lyrics!.map((line) => (
                <li key={line.id} className="text-ink/80">
                  <span className="text-ink/30 mr-2 tabular-nums">
                    {line.line_index + 1}
                  </span>
                  {line.text}
                </li>
              ))}
            </ol>
          )}
        </section>

        {hasLyrics && (
          <section className="rounded-3xl bg-cream-deep border border-ink/10 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-mauve" />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/50">
                Clips
              </h2>
            </div>

            {!hasSegments &&
              (isOwner ? (
                <GenerateClipsButton songId={song.id} />
              ) : (
                <p className="text-ink/50 text-sm">No clips yet.</p>
              ))}

            {hasSegments && isOwner && (
              <SegmentsPanel
                songId={song.id}
                songTitle={song.title}
                songArtist={song.artist}
                audioUrl={song.audio_url}
                segments={segments!}
                templates={templates ?? []}
                linesBySegment={linesBySegment}
                exportsBySegment={exportsBySegment}
                unlocked={access.unlocked}
                accessReason={access.reason}
              />
            )}

            {hasSegments && !isOwner && (
              <div className="space-y-3">
                <p className="text-xs text-ink/40">
                  This is a demo song — upload your own to export clips.
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {segments!.map((seg) => (
                    <li
                      key={seg.id}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        PLATFORM_STYLES[seg.platform] ?? "bg-ink/10 text-ink"
                      }`}
                    >
                      {seg.label} · {seg.platform}
                      {typeof seg.hook_score === "number"
                        ? ` · ${seg.hook_score.toFixed(2)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
