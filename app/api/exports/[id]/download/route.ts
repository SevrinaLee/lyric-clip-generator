import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizeDownload } from "@/lib/access";

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
    .select("status, video_url, clip_segment_id")
    .eq("id", id)
    .maybeSingle<{
      status: string;
      video_url: string | null;
      clip_segment_id: string;
    }>();

  if (!exportRow || exportRow.status !== "done" || !exportRow.video_url) {
    return NextResponse.json(
      { error: "Export not ready" },
      { status: 404 },
    );
  }

  // Defense in depth — the UI already hides the Download link unless the song
  // is unlocked, but the route itself must enforce (and claim) it too. This
  // is where a founder / first-free-song / paid check happens, and where the
  // user's one free song gets claimed on their first download.
  const { data: segment } = await supabase
    .from("clip_segments")
    .select("song_id")
    .eq("id", exportRow.clip_segment_id)
    .maybeSingle<{ song_id: string }>();

  if (segment) {
    const allowed = await authorizeDownload(user.id, segment.song_id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Payment required before downloading" },
        { status: 402 },
      );
    }
  }

  const { data, error } = await supabase.storage
    .from("exports")
    .createSignedUrl(exportRow.video_url, 60 * 60);

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not create download link" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
