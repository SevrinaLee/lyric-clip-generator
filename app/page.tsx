import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ClipSegment, Song, VideoTemplate } from "@/lib/types";

const PLATFORM_STYLES: Record<string, string> = {
  tiktok: "bg-mauve/15 text-mauve",
  reels: "bg-sky/25 text-ink",
  shorts: "bg-sage/30 text-ink",
};

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
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-32 h-96 w-96 rounded-full bg-lavender/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -right-24 h-80 w-80 rounded-full bg-gold/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sage/30 blur-3xl"
      />

      <div className="relative max-w-5xl mx-auto px-8 py-14 space-y-16">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 text-gold px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              ✦ For musicians, poets & every kind of creator
            </span>
            <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight text-ink">
              Turn a song into{" "}
              <span className="italic text-mauve">scroll-stopping</span>{" "}
              clips
            </h1>
            <p className="text-ink/60 text-lg max-w-md">
              No editing skills needed. Upload any audio — originals, covers,
              poetry, podcasts — and get 3 platform-ready lyric clips in
              minutes, hook scored and ready to post.
            </p>
          </div>
          <Link
            href="/songs/new"
            className="self-start shrink-0 rounded-full bg-ink text-cream px-6 py-3 text-sm font-semibold hover:bg-ink/85 transition-colors shadow-[0_8px_24px_-8px_rgba(43,43,43,0.5)]"
          >
            New Song →
          </Link>
        </header>

        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-mauve" />
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/50">
              Demo gallery
            </h2>
          </div>

          {!songs || songs.length === 0 ? (
            <p className="text-ink/50">No songs yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {songs.map((song, i) => {
                const clips = (segmentsBySong.get(song.id) ?? []).sort(
                  (a, b) => (b.hook_score ?? 0) - (a.hook_score ?? 0),
                );
                const accents = ["bg-lavender", "bg-rose", "bg-tan", "bg-sky"];
                return (
                  <Link
                    key={song.id}
                    href={`/songs/${song.id}`}
                    className="group relative block rounded-2xl bg-cream-deep border border-ink/10 p-6 hover:border-ink/20 hover:shadow-[0_12px_32px_-16px_rgba(43,43,43,0.35)] transition-all"
                  >
                    <span
                      className={`absolute top-0 left-6 h-1.5 w-10 rounded-b-full ${accents[i % accents.length]}`}
                    />
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl text-ink">
                        {song.title}
                      </h3>
                      <span className="text-[10px] font-semibold text-ink/40 uppercase tracking-wide">
                        {song.status}
                      </span>
                    </div>
                    <p className="text-sm text-ink/50 mt-0.5">
                      {song.artist}
                    </p>

                    {clips.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-1.5">
                        {clips.map((clip) => {
                          const template = clip.template_id
                            ? templateById.get(clip.template_id)
                            : undefined;
                          return (
                            <li
                              key={clip.id}
                              title={template?.name}
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                PLATFORM_STYLES[clip.platform] ??
                                "bg-ink/10 text-ink"
                              }`}
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
      </div>
    </main>
  );
}
