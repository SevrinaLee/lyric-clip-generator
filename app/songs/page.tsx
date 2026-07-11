import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ClipSegment, Song } from "@/lib/types";
import { Icon } from "../nav/icons";

const STATUS_STYLES: Record<Song["status"], string> = {
  uploaded: "bg-tan/25 text-ink",
  processing: "bg-sky/25 text-ink",
  ready: "bg-sage/30 text-ink",
};

export default async function MySongsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/songs");

  const { data: songs } = await supabase
    .from("songs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Song[]>();

  const songIds = (songs ?? []).map((s) => s.id);
  const { data: segments } =
    songIds.length > 0
      ? await supabase
          .from("clip_segments")
          .select("id, song_id")
          .in("song_id", songIds)
          .returns<Pick<ClipSegment, "id" | "song_id">[]>()
      : { data: [] };

  const clipCountBySong = new Map<string, number>();
  for (const seg of segments ?? []) {
    clipCountBySong.set(seg.song_id, (clipCountBySong.get(seg.song_id) ?? 0) + 1);
  }

  const dateFmt = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-32 h-96 w-96 rounded-full bg-lavender/30 blur-3xl"
      />

      <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl sm:text-4xl text-ink">My songs</h1>
          <Link
            href="/songs/new"
            className="flex items-center gap-2 rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors"
          >
            <Icon name="plus" className="h-4 w-4" />
            New song
          </Link>
        </div>

        {!songs || songs.length === 0 ? (
          <div className="rounded-3xl bg-cream-deep border border-ink/10 p-10 text-center space-y-4">
            <p className="font-display text-xl text-ink">No songs yet</p>
            <p className="text-ink/50 text-sm max-w-xs mx-auto">
              Upload any audio and turn your favorite moment into a
              platform-ready lyric clip.
            </p>
            <Link
              href="/songs/new"
              className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors"
            >
              <Icon name="plus" className="h-4 w-4" />
              Upload your first song
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {songs.map((song) => {
              const clips = clipCountBySong.get(song.id) ?? 0;
              return (
                <li key={song.id}>
                  <Link
                    href={`/songs/${song.id}`}
                    className="flex items-center gap-4 rounded-2xl bg-cream-deep border border-ink/10 p-4 hover:border-ink/25 transition-colors"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavender/25 text-ink/60">
                      <Icon name="music" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink truncate">
                        {song.title}
                      </p>
                      <p className="text-sm text-ink/50 truncate">
                        {song.artist}
                        {clips > 0 && (
                          <span className="text-ink/30">
                            {" · "}
                            {clips} clip{clips === 1 ? "" : "s"}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="hidden sm:block text-xs text-ink/40">
                      {dateFmt.format(new Date(song.created_at))}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[song.status]}`}
                    >
                      {song.status}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
