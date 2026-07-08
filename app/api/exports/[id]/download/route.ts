import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

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

  // Defense in depth — the UI already hides the Download link until a
  // payment is confirmed, but the route itself must enforce the gate too.
  const { data: segment } = await supabase
    .from("clip_segments")
    .select("song_id")
    .eq("id", exportRow.clip_segment_id)
    .maybeSingle<{ song_id: string }>();

  if (segment) {
    const { data: paidPayments } = await supabase
      .from("payments")
      .select("id")
      .eq("song_id", segment.song_id)
      .eq("status", "paid")
      .limit(1);

    if (!paidPayments || paidPayments.length === 0) {
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
