import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authorizeDownload,
  evaluateSongAccess,
  exportTier,
} from "@/lib/access";
import { renderSegmentToBuffer, exportStoragePath } from "@/lib/exportRender";
import { isFormat, DEFAULT_FORMAT } from "@/lib/formats";
import type { ClipSegment } from "@/lib/types";

// Re-rendering a clean HD version on the first paid download can exceed the
// 10s default.
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // RLS already ensures this export row belongs to the caller (or is a public
  // demo). maybeSingle returns null for someone else's export → 404.
  const { data: exportRow } = await supabase
    .from("exports")
    .select("status, video_url, clip_segment_id, tier, format")
    .eq("id", id)
    .maybeSingle<{
      status: string;
      video_url: string | null;
      clip_segment_id: string;
      tier: string | null;
      format: string | null;
    }>();

  if (!exportRow || exportRow.status !== "done" || !exportRow.video_url) {
    return NextResponse.json({ error: "Export not ready" }, { status: 404 });
  }

  // Defense in depth — the UI already hides the Download link unless the song
  // is unlocked, but the route itself must enforce (and claim) it too: founder
  // / first-free-song / paid check, plus the free-song claim on first download.
  const { data: segment } = await supabase
    .from("clip_segments")
    .select("*")
    .eq("id", exportRow.clip_segment_id)
    .maybeSingle<ClipSegment>();

  let videoPath = exportRow.video_url;

  if (segment) {
    const allowed = await authorizeDownload(user.id, segment.song_id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Payment required before downloading" },
        { status: 402 },
      );
    }

    // Value ladder: if the stored file is the free (watermarked) tier but the
    // caller now has paid access, render a clean HD version once and cache it.
    const desired = exportTier((await evaluateSongAccess(user.id, segment.song_id)).reason);
    const format = isFormat(exportRow.format) ? exportRow.format : DEFAULT_FORMAT;
    if (desired.label === "paid" && (exportRow.tier ?? "free") !== "paid") {
      try {
        const buffer = await renderSegmentToBuffer(supabase, segment, desired, format);
        const hdPath = exportStoragePath(id, desired, format);
        const { error: upErr } = await supabase.storage
          .from("exports")
          .upload(hdPath, buffer, { contentType: "video/mp4", upsert: true });
        if (!upErr) {
          await supabase
            .from("exports")
            .update({ video_url: hdPath, tier: "paid" })
            .eq("id", id);
          videoPath = hdPath;
        }
      } catch {
        // If the HD re-render fails, fall back to serving the existing file
        // rather than blocking the download the user paid for.
      }
    }
  }

  const { data, error } = await supabase.storage
    .from("exports")
    .createSignedUrl(videoPath, 60 * 60);

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not create download link" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
