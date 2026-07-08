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
import { EditableLyricsTable } from "./EditableLyricsTable";

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

  const { data: song } = await supabase
    .from("songs")
    .select("*")
    .eq("id", id)
    .maybeSingle<Song>();

  if (!song) notFound();

  const [
    { data: lyrics },
    { data: segments },
    { data: templates },
    { data: exportRows },
    { data: paidPayments },
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
    supabase
      .from("payments")
      .select("id")
      .eq("song_id", id)
      .eq("status", "paid")
      .limit(1),
  ]);

  const hasLyrics = (lyrics?.length ?? 0) > 0;
  const hasSegments = (segments?.length ?? 0) > 0;
  const hasPaid = (paidPayments?.length ?? 0) > 0;
  const hasTimestamps = (lyrics ?? []).some((l) => l.start_ms != null);

  // Latest export per clip_segment_id (exports is queried unfiltered since
  // there's no FK to song_id — fine at this dataset size for v1).
  const exportsBySegment = new Map<string, Export>();
  for (const exp of exportRows ?? []) {
    if (!exportsBySegment.has(exp.clip_segment_id)) {
      exportsBySegment.set(exp.clip_segment_id, exp);
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto space-y-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{song.title}</h1>
        <p className="text-neutral-500">{song.artist}</p>
      </div>

      <Suspense fallback={null}>
        <CheckoutStatusWatcher songId={song.id} />
      </Suspense>

      {song.audio_url && (
        <audio controls src={song.audio_url} className="w-full">
          Your browser does not support the audio element.
        </audio>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Lyrics
        </h2>

        {!hasLyrics ? (
          <div className="space-y-4">
            <p className="text-neutral-500 text-sm">
              Add lyrics to continue.
            </p>
            <LyricEntryForm songId={song.id} />
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" />
              or
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
            <AutoTranscribeButton songId={song.id} />
          </div>
        ) : hasTimestamps ? (
          <EditableLyricsTable lyrics={lyrics!} />
        ) : (
          <ol className="space-y-1 text-sm">
            {lyrics!.map((line) => (
              <li key={line.id} className="text-neutral-700">
                <span className="text-neutral-400 mr-2 tabular-nums">
                  {line.line_index + 1}
                </span>
                {line.text}
              </li>
            ))}
          </ol>
        )}
      </section>

      {hasLyrics && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Clips
          </h2>

          {!hasSegments ? (
            <GenerateClipsButton songId={song.id} />
          ) : (
            <SegmentsPanel
              songId={song.id}
              segments={segments!}
              templates={templates ?? []}
              exportsBySegment={exportsBySegment}
              hasPaid={hasPaid}
            />
          )}
        </section>
      )}
    </main>
  );
}
