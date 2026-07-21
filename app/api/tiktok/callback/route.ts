import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isTikTokConfigured,
  exchangeCodeForToken,
  directPostVideo,
} from "@/lib/tiktok";
import type { ClipSegment, Song } from "@/lib/types";

// Content Posting API renders exceed the default function budget when we proxy
// the clip bytes to TikTok.
export const maxDuration = 60;

// OAuth callback: verify state (CSRF), exchange the code, and — if a target clip
// was chosen — Direct Post it to the user's TikTok (private until audited).
// 404 while the integration is dark.
export async function GET(request: Request) {
  if (!isTikTokConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const done = (params: string) =>
    NextResponse.redirect(`${origin}/clips?${params}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  if (url.searchParams.get("error")) {
    return done("tiktok=cancelled");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("tiktok_oauth="));
  let cookieState = "";
  let exportId = "";
  if (raw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw.split("=").slice(1).join("=")));
      cookieState = parsed.state ?? "";
      exportId = parsed.exportId ?? "";
    } catch {
      /* ignore malformed cookie */
    }
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return done("tiktok=error");
  }

  try {
    const token = await exchangeCodeForToken({
      code,
      redirectUri: `${origin}/api/tiktok/callback`,
    });

    // No target clip → just connected (used for a "connect" flow).
    if (!exportId) {
      const res = done("tiktok=connected");
      res.cookies.delete("tiktok_oauth");
      return res;
    }

    // RLS scopes this to the caller's own export.
    const { data: exp } = await supabase
      .from("exports")
      .select("status, video_url, clip_segment_id")
      .eq("id", exportId)
      .maybeSingle<{ status: string; video_url: string | null; clip_segment_id: string }>();
    if (!exp || exp.status !== "done" || !exp.video_url) {
      const res = done("tiktok=error");
      res.cookies.delete("tiktok_oauth");
      return res;
    }

    const { data: blob } = await supabase.storage.from("exports").download(exp.video_url);
    if (!blob) {
      const res = done("tiktok=error");
      res.cookies.delete("tiktok_oauth");
      return res;
    }

    // A friendly caption from the song title, best-effort.
    const { data: seg } = await supabase
      .from("clip_segments")
      .select("song_id")
      .eq("id", exp.clip_segment_id)
      .maybeSingle<Pick<ClipSegment, "song_id">>();
    const { data: song } = seg
      ? await supabase.from("songs").select("title").eq("id", seg.song_id).maybeSingle<Pick<Song, "title">>()
      : { data: null };
    const title = song?.title ? `${song.title} — made with Lyric Clip Generator` : "Made with Lyric Clip Generator";

    await directPostVideo({
      accessToken: token.access_token,
      video: Buffer.from(await blob.arrayBuffer()),
      title,
    });

    const res = done("tiktok=posted");
    res.cookies.delete("tiktok_oauth");
    return res;
  } catch (err) {
    console.error("[tiktok/callback] failed:", err);
    const res = done("tiktok=error");
    res.cookies.delete("tiktok_oauth");
    return res;
  }
}
