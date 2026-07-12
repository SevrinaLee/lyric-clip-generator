import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { evaluateSongAccess } from "@/lib/access";
import type { ClipSegment, Export, Song } from "@/lib/types";
import { Icon } from "../nav/icons";

const PLATFORM_STYLES: Record<string, string> = {
  tiktok: "bg-mauve/15 text-mauve",
  reels: "bg-sky/25 text-ink",
  shorts: "bg-sage/30 text-ink",
};

export default async function MyClipsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/clips");

  // Finished exports the user owns, newest first.
  const { data: exports } = await supabase
    .from("exports")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .returns<Export[]>();

  const segmentIds = [...new Set((exports ?? []).map((e) => e.clip_segment_id))];
  const { data: segments } =
    segmentIds.length > 0
      ? await supabase
          .from("clip_segments")
          .select("id, song_id, label, platform")
          .in("id", segmentIds)
          .returns<Pick<ClipSegment, "id" | "song_id" | "label" | "platform">[]>()
      : { data: [] };
  const segById = new Map((segments ?? []).map((s) => [s.id, s]));

  const songIds = [...new Set((segments ?? []).map((s) => s.song_id))];
  const { data: songs } =
    songIds.length > 0
      ? await supabase
          .from("songs")
          .select("id, title, artist")
          .in("id", songIds)
          .returns<Pick<Song, "id" | "title" | "artist">[]>()
      : { data: [] };
  const songById = new Map((songs ?? []).map((s) => [s.id, s]));

  // Unlock status per song (founder / paid / free), so we show Download vs a
  // link to finish payment — mirrors the server-enforced download gate.
  const accessBySong = new Map<string, boolean>();
  await Promise.all(
    songIds.map(async (sid) => {
      const a = await evaluateSongAccess(user.id, sid);
      accessBySong.set(sid, a.unlocked);
    }),
  );

  const dateFmt = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const clips = (exports ?? []).filter((e) => segById.has(e.clip_segment_id));

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-32 h-96 w-96 rounded-full bg-sky/25 blur-3xl"
      />

      <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl sm:text-4xl text-ink">My clips</h1>
          <Link
            href="/songs/new"
            className="flex items-center gap-2 rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors"
          >
            <Icon name="plus" className="h-4 w-4" />
            New song
          </Link>
        </div>

        {clips.length === 0 ? (
          <div className="rounded-3xl bg-cream-deep border border-ink/10 p-10 text-center space-y-4">
            <p className="font-display text-xl text-ink">No clips yet</p>
            <p className="text-ink/50 text-sm max-w-xs mx-auto">
              Export a clip from one of your songs and it will show up here,
              ready to re-download anytime.
            </p>
            <Link
              href="/songs"
              className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors"
            >
              <Icon name="music" className="h-4 w-4" />
              Go to my songs
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {clips.map((exp) => {
              const seg = segById.get(exp.clip_segment_id)!;
              const song = songById.get(seg.song_id);
              const unlocked = accessBySong.get(seg.song_id) ?? false;
              return (
                <li
                  key={exp.id}
                  className="flex items-center gap-4 rounded-2xl bg-cream-deep border border-ink/10 p-4"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky/25 text-ink/60">
                    <Icon name="film" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">
                      {song?.title ?? "Song"}
                      <span className="font-normal text-ink/40">
                        {" · "}
                        {seg.label}
                      </span>
                    </p>
                    <p className="text-sm text-ink/50 truncate">
                      {song?.artist}
                      <span className="text-ink/30">
                        {" · "}
                        {dateFmt.format(new Date(exp.created_at))}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`hidden sm:inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                      PLATFORM_STYLES[seg.platform] ?? "bg-ink/10 text-ink"
                    }`}
                  >
                    {seg.platform}
                  </span>
                  {unlocked ? (
                    <a
                      href={`/api/exports/${exp.id}/download`}
                      className="flex items-center gap-1.5 rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors"
                    >
                      <Icon name="film" className="h-4 w-4" />
                      Download
                    </a>
                  ) : (
                    <Link
                      href={`/songs/${seg.song_id}`}
                      className="rounded-full border border-ink/20 text-ink px-4 py-2 text-sm font-semibold hover:bg-ink/5 transition-colors"
                    >
                      Unlock
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
