// TikTok Content Posting API integration (S6.2) — Login Kit OAuth + Direct Post.
//
// DARK BY DEFAULT: everything here is inert unless BOTH TIKTOK_CLIENT_KEY and
// TIKTOK_CLIENT_SECRET are set (obtained by registering the app — see
// docs/tiktok-app-review.md). The routes 404 and no UI renders while unset, so
// shipping this changes nothing in production until credentials exist.
//
// IMPORTANT: until TikTok AUDITS the app, `video.publish` posts are forced to
// private (SELF_ONLY). We default to SELF_ONLY here to match that constraint;
// after approval, surface the account's allowed privacy levels as a picker.

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const POST_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";

// user.info.basic identifies the account; video.publish is the audited scope
// that enables Direct Post.
export const TIKTOK_SCOPES = ["user.info.basic", "video.publish"] as const;

/** Both credentials present → the feature is live. Otherwise it stays dark. */
export function isTikTokConfigured(): boolean {
  return Boolean(CLIENT_KEY && CLIENT_SECRET);
}

/** Build the Login Kit consent URL. `state` is our CSRF token (also stored in
 *  an httpOnly cookie and re-checked on callback). */
export function tiktokAuthUrl({
  redirectUri,
  state,
}: {
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_key: CLIENT_KEY ?? "",
    scope: TIKTOK_SCOPES.join(","),
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type TikTokToken = {
  access_token: string;
  open_id: string;
  scope: string;
  expires_in: number;
};

/** Exchange the authorization code for an access token. */
export async function exchangeCodeForToken({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<TikTokToken> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: CLIENT_KEY ?? "",
      client_secret: CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const body = (await res.json()) as TikTokToken & { error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? "TikTok token exchange failed");
  }
  return body;
}

/**
 * Direct Post a video via FILE_UPLOAD (no domain verification needed): init the
 * publish, then PUT the bytes to the returned upload_url. Privacy is SELF_ONLY
 * to satisfy the pre-audit restriction. Returns the publish id.
 */
export async function directPostVideo({
  accessToken,
  video,
  title,
}: {
  accessToken: string;
  video: Buffer;
  title: string;
}): Promise<{ publishId: string }> {
  const size = video.length;
  const initRes = await fetch(POST_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: title.slice(0, 150),
        privacy_level: "SELF_ONLY", // forced private until the app is audited
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: size, // single chunk (clips are short/small)
        total_chunk_count: 1,
      },
    }),
  });
  const init = (await initRes.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };
  if (!initRes.ok || !init.data?.upload_url || !init.data.publish_id) {
    throw new Error(init.error?.message ?? "TikTok publish init failed");
  }

  const putRes = await fetch(init.data.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${size - 1}/${size}`,
      "Content-Length": String(size),
    },
    body: new Uint8Array(video),
  });
  if (!putRes.ok) {
    throw new Error(`TikTok upload failed (${putRes.status})`);
  }
  return { publishId: init.data.publish_id };
}
