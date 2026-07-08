import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ClipSegment, Song, VideoTemplate } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: songs }, { data: segments }, { data: templates }] =
    await Promise.all([
      supabase
        .from("songs")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<Song[]>(),
      supabase.from("clip_segments").select("*").returns<ClipSegment[]>(),
      supabase.from("video_templates").select("*").returns<VideoTemplate[]>(),
    ]);

  const templateById = new Map((templates ?? []).map((t) => [t.id, t]));
  const segmentsBySong = new Map<string, ClipSegment[]>();
  for (const seg of segments ?? []) {
    const list = segmentsBySong.get(seg.song_id) ?? [];
    list.push(seg);
    segmentsBySong.set(seg.song_id, list);
  }

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Lyric Clip Generator
          </h1>
          <p className="text-neutral-500 mt-1">
            Turn a song into 3 platform-ready lyric clips in minutes.
          </p>
        </div>
        <Link
          href="/songs/new"
          className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
        >
          New Song
        </Link>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Demo gallery
        </h2>

        {!songs || songs.length === 0 ? (
          <p className="text-neutral-500">No songs yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {songs.map((song) => {
              const clips = (segmentsBySong.get(song.id) ?? []).sort(
                (a, b) => (b.hook_score ?? 0) - (a.hook_score ?? 0),
              );
              return (
                <Link
                  key={song.id}
                  href={`/songs/${song.id}`}
                  className="block rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{song.title}</h3>
                    <span className="text-xs text-neutral-400 uppercase">
                      {song.status}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-500">{song.artist}</p>

                  {clips.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {clips.map((clip) => {
                        const template = clip.template_id
                          ? templateById.get(clip.template_id)
                          : undefined;
                        return (
                          <li
                            key={clip.id}
                            className="rounded px-2.5 py-1 text-xs font-medium text-white"
                            style={{
                              backgroundColor: template?.primary_color
                                ? withReadableText(template.primary_color)
                                : "#404040",
                            }}
                          >
                            {clip.label} · {clip.platform}
                            {typeof clip.hook_score === "number"
                              ? ` · ${clip.hook_score.toFixed(2)}`
                              : ""}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

// Light template colors (e.g. #ffffff) read poorly as chip backgrounds with
// white text; fall back to neutral-800 when the color is too light.
function withReadableText(hex: string) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 180 ? "#262626" : hex;
}
