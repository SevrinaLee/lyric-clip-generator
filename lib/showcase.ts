import { createAdminClient } from "@/lib/supabase/admin";
import { LOOKS } from "@/lib/looks";
import type { ClipSegment, Export, ShowcaseEntry, Song, VideoTemplate } from "@/lib/types";

// One card in the public showcase. Shared by the initial (ISR) page render and
// the /api/showcase load-more route so both build identical shapes.
export type ShowcaseCard = {
  id: string;
  url: string;
  format: string;
  title: string;
  artist: string | null;
  template: string | null;
  remixLookId: string | null;
  createdAt: string;
};

export const SHOWCASE_PAGE_SIZE = 24;

// Loads a page of approved showcase cards, newest first. `before` is a
// created_at ISO cursor (exclusive) for "load more"; omit for the first page.
// Uses the service-role client because everything shown is intentionally public
// (approved-only) and the underlying rows aren't anon-readable via RLS.
export async function loadShowcaseCards({
  before,
  limit = SHOWCASE_PAGE_SIZE,
}: {
  before?: string | null;
  limit?: number;
} = {}): Promise<{ cards: ShowcaseCard[]; nextBefore: string | null }> {
  const admin = createAdminClient();

  let q = admin
    .from("showcase_entries")
    .select("id, export_id, title, created_at")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);

  const { data: entries } = await q.returns<
    Pick<ShowcaseEntry, "id" | "export_id" | "title" | "created_at">[]
  >();

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

  const cards = await Promise.all(
    (entries ?? []).map(async (entry): Promise<ShowcaseCard | null> => {
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
        template: seg?.template_id ? tmplName.get(seg.template_id) ?? null : null,
        remixLookId:
          (seg?.template_id &&
            LOOKS.find((l) => l.templateName === tmplName.get(seg.template_id!))?.id) ||
          null,
        createdAt: entry.created_at,
      };
    }),
  );
  const visible = cards.filter((c): c is ShowcaseCard => c !== null);

  // Another page likely exists only if this one came back full.
  const nextBefore =
    (entries?.length ?? 0) >= limit && visible.length > 0
      ? visible[visible.length - 1].createdAt
      : null;

  return { cards: visible, nextBefore };
}
