import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClipSegment, Export, ShowcaseEntry, Song, VideoTemplate } from "@/lib/types";

export const metadata: Metadata = {
  title: "Showcase — Lyric Clip Generator",
  description: "Lyric clips made with Lyric Clip Generator. Turn your song into scroll-stopping captioned clips.",
  openGraph: {
    title: "Lyric Clip Showcase",
    description: "Scroll-stopping lyric clips made by creators. Make your own free.",
    type: "website",
  },
};

// Public gallery of curated (approved) clips. Uses the service-role client
// because everything shown is intentionally public (approved-only) and anon
// visitors can't read the underlying export/storage rows via RLS. A clip goes
// public only after manual approval (there's no self-approve path).
export const revalidate = 300;

export default async function ShowcasePage() {
  const admin = createAdminClient();

  const { data: entries } = await admin
    .from("showcase_entries")
    .select("id, export_id, title, created_at")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(60)
    .returns<Pick<ShowcaseEntry, "id" | "export_id" | "title" | "created_at">[]>();

  const exportIds = (entries ?? []).map((e) => e.export_id);
  const { data: exports } = exportIds.length
    ? await admin
        .from("exports")
        .select("id, video_url, format, clip_segment_id")
        .in("id", exportIds)
        .eq("status", "done")
        .returns<Pick<Export, "id" | "video_url" | "format" | "clip_segment_id">[]>()
    : { data: [] };
  const expById = new Map((exports ?? []).map((e) => [e.id, e]));

  const segIds = [...new Set((exports ?? []).map((e) => e.clip_segment_id))];
  const { data: segs } = segIds.length
    ? await admin
        .from("clip_segments")
        .select("id, label, template_id, song_id")
        .in("id", segIds)
        .returns<Pick<ClipSegment, "id" | "label" | "template_id" | "song_id">[]>()
    : { data: [] };
  const segById = new Map((segs ?? []).map((s) => [s.id, s]));

  const { data: templates } = await admin
    .from("video_templates")
    .select("id, name")
    .returns<Pick<VideoTemplate, "id" | "name">[]>();
  const tmplName = new Map((templates ?? []).map((t) => [t.id, t.name]));

  const songIds = [...new Set((segs ?? []).map((s) => s.song_id))];
  const { data: songs } = songIds.length
    ? await admin
        .from("songs")
        .select("id, title, artist")
        .in("id", songIds)
        .returns<Pick<Song, "id" | "title" | "artist">[]>()
    : { data: [] };
  const songById = new Map((songs ?? []).map((s) => [s.id, s]));

  // Signed URLs for each approved clip (1h). Batch-friendly enough at gallery size.
  const cards = await Promise.all(
    (entries ?? []).map(async (entry) => {
      const exp = expById.get(entry.export_id);
      if (!exp?.video_url) return null;
      const seg = segById.get(exp.clip_segment_id);
      const song = seg ? songById.get(seg.song_id) : undefined;
      const { data: signed } = await admin.storage
        .from("exports")
        .createSignedUrl(exp.video_url, 60 * 60);
      if (!signed?.signedUrl) return null;
      return {
        id: entry.id,
        url: signed.signedUrl,
        format: exp.format ?? "9:16",
        title: entry.title ?? song?.title ?? "Lyric clip",
        artist: song?.artist ?? null,
        template: seg?.template_id ? tmplName.get(seg.template_id) : null,
      };
    }),
  );
  const visible = cards.filter((c): c is NonNullable<typeof c> => c !== null);

  const aspect: Record<string, string> = {
    "9:16": "aspect-9/16",
    "1:1": "aspect-square",
    "4:5": "aspect-[4/5]",
    "16:9": "aspect-video",
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-32 h-96 w-96 rounded-full bg-mauve/20 blur-3xl"
      />
      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 text-gold px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            ✨ Showcase
          </span>
          <h1 className="font-display text-4xl sm:text-5xl text-ink">
            Clips made by creators
          </h1>
          <p className="text-ink/60 max-w-md mx-auto">
            Real lyric clips made with Lyric Clip Generator. Make yours in
            minutes — the first song is free.
          </p>
          <Link
            href="/songs/new"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors"
          >
            Make your clip
          </Link>
        </div>

        {visible.length === 0 ? (
          <p className="text-center text-ink/50 py-16">
            No featured clips yet — check back soon.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {visible.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl overflow-hidden bg-cream-deep border border-ink/10"
              >
                <div className={`${aspect[c.format] ?? "aspect-9/16"} bg-ink/90`}>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={c.url}
                    className="h-full w-full object-cover"
                    controls
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-ink truncate">{c.title}</p>
                  <p className="text-xs text-ink/50 truncate">
                    {c.artist ? `${c.artist} · ` : ""}
                    {c.template ?? "Lyric clip"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-center text-xs text-ink/40">
          Clips are featured with their creator&apos;s permission.
        </p>
      </div>
    </main>
  );
}
