import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("id")
    .eq("song_id", id)
    .eq("status", "paid")
    .limit(1);

  return NextResponse.json({ paid: (data?.length ?? 0) > 0 });
}
