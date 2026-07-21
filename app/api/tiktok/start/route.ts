import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { isTikTokConfigured, tiktokAuthUrl } from "@/lib/tiktok";

// Begins the TikTok Login Kit OAuth flow. 404 while the integration is dark
// (no credentials). Optional ?exportId=<id> is the clip to post after auth.
export async function GET(request: Request) {
  if (!isTikTokConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const exportId = url.searchParams.get("exportId") ?? "";
  const state = randomUUID();
  const redirectUri = `${url.origin}/api/tiktok/callback`;

  const res = NextResponse.redirect(tiktokAuthUrl({ redirectUri, state }));
  // httpOnly, same-site cookie carries the CSRF state + target clip across the
  // round-trip; short-lived, server-only.
  res.cookies.set("tiktok_oauth", JSON.stringify({ state, exportId }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
