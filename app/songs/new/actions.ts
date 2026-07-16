"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOOKS } from "@/lib/looks";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"];

export async function createSong(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const artist = String(formData.get("artist") ?? "").trim();
  const duration = formData.get("duration_seconds");
  const file = formData.get("audio") as File | null;
  // Remix carry-through (S7.4): only a known Look id survives, so the redirect
  // param can't be used to inject anything.
  const rawLook = String(formData.get("look") ?? "").trim();
  const look = LOOKS.some((l) => l.id === rawLook) ? rawLook : null;

  if (!title || !artist) {
    throw new Error("Title and artist are required");
  }
  if (!file || file.size === 0) {
    throw new Error("An audio file is required");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File is larger than 50 MB");
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only MP3 or WAV files are supported");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in to upload a song");

  const ext = file.name.split(".").pop() || "mp3";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("audio")
    .upload(path, file, { contentType: file.type || "audio/mpeg" });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("audio").getPublicUrl(path);

  const { data: song, error: insertError } = await supabase
    .from("songs")
    .insert({
      user_id: user.id,
      title,
      artist,
      audio_url: publicUrl,
      duration_seconds: duration ? Number(duration) : null,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (insertError || !song) {
    throw new Error(`Could not save song: ${insertError?.message}`);
  }

  redirect(look ? `/songs/${song.id}?look=${look}` : `/songs/${song.id}`);
}
