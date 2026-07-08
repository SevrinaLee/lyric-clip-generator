import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Lyric, Song } from "@/lib/types";
import { LyricEntryForm } from "./LyricEntryForm";

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

  const { data: lyrics } = await supabase
    .from("lyrics")
    .select("*")
    .eq("song_id", id)
    .order("line_index", { ascending: true })
    .returns<Lyric[]>();

  const hasLyrics = (lyrics?.length ?? 0) > 0;

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto space-y-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{song.title}</h1>
        <p className="text-neutral-500">{song.artist}</p>
      </div>

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
          </div>
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
    </main>
  );
}
