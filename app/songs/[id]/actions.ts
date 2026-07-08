"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addLyrics(songId: string, rawText: string) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("Paste at least one line of lyrics");
  }

  const supabase = await createClient();

  const rows = lines.map((text, index) => ({
    song_id: songId,
    line_index: index,
    text,
  }));

  const { error } = await supabase.from("lyrics").insert(rows);
  if (error) {
    throw new Error(`Could not save lyrics: ${error.message}`);
  }

  revalidatePath(`/songs/${songId}`);
}
