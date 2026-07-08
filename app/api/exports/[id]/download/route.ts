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
    .select("status, video_url")
    .eq("id", id)
    .maybeSingle<{ status: string; video_url: string | null }>();

  if (!exportRow || exportRow.status !== "done" || !exportRow.video_url) {
    return NextResponse.json(
      { error: "Export not ready" },
      { status: 404 },
    );
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
