import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authorizeDownload,
  evaluateSongAccess,
  exportTier,
} from "@/lib/access";
import { renderSegmentToBuffer } from "@/lib/exportRender";
import { isFormat, DEFAULT_FORMAT } from "@/lib/formats";
import type { ClipSegment } from "@/lib/types";

// GIF is rendered on the fly (not stored) — a short, silent, palette-optimized
// loop derived from the same composed frame. Capped hard in render.ts so it
// stays inside the sync budget.
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

  // RLS scopes this to the caller's export → someone else's id returns null.
  const { data: exportRow } = await supabase
    .from("exports")
    .select("status, clip_segment_id, format")
    .eq("id", id)
    .maybeSingle<{
      status: string;
      clip_segment_id: string;
      format: string | null;
    }>();

  if (!exportRow || exportRow.status !== "done") {
    return NextResponse.json({ error: "Export not ready" }, { status: 404 });
  }

  const { data: segment } = await supabase
    .from("clip_segments")
    .select("*")
    .eq("id", exportRow.clip_segment_id)
    .maybeSingle<ClipSegment>();
  if (!segment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Same access gate as the MP4 download (defense in depth + free-song claim).
  const allowed = await authorizeDownload(user.id, segment.song_id);
  if (!allowed) {
    return NextResponse.json(
      { error: "Payment required before downloading" },
      { status: 402 },
    );
  }

  const tier = exportTier(
    (await evaluateSongAccess(user.id, segment.song_id)).reason,
  );
  const format = isFormat(exportRow.format) ? exportRow.format : DEFAULT_FORMAT;

  try {
    const buffer = await renderSegmentToBuffer(supabase, segment, tier, format, "gif");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Content-Disposition": `attachment; filename="clip-${id}.gif"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[exports/gif] render failed:", err);
    return NextResponse.json(
      { error: "Could not render GIF" },
      { status: 500 },
    );
  }
}
