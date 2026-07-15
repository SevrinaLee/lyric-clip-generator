// Server-only: pulls in the service-role admin client. Never import from a
// Client Component.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Why a download is (or isn't) unlocked for a given user + song.
//   founder        — comp account, everything free
//   paid           — a paid payment exists for this song
//   free-song      — this is the user's claimed free song
//   free-eligible  — user hasn't claimed their one free song yet, so this
//                    song CAN be downloaded free (claiming it on download)
//   locked         — must pay
export type AccessReason =
  | "founder"
  | "subscriber"
  | "paid"
  | "free-song"
  | "free-eligible"
  | "locked";

export type SongAccess = { unlocked: boolean; reason: AccessReason };

const LOCKED: SongAccess = { unlocked: false, reason: "locked" };

// Render tier by access. Paid access (founder or a paid payment) gets a clean,
// full-resolution export; every free/unpaid download is watermarked and
// rendered smaller. This is both the value ladder and the growth engine —
// free clips carry the brand.
export type ExportTier = {
  label: "free" | "paid";
  watermark: boolean;
  width: number;
  height: number;
};

export function exportTier(reason: AccessReason): ExportTier {
  const paid =
    reason === "founder" || reason === "subscriber" || reason === "paid";
  return paid
    ? { label: "paid", watermark: false, width: 1080, height: 1920 }
    : { label: "free", watermark: true, width: 720, height: 1280 };
}

type ProfileAccess = { is_founder: boolean; free_song_id: string | null };

/**
 * Read-only access evaluation (no side effects) — for pages and the
 * payment-status endpoint. "free-eligible" is reported as unlocked because a
 * download WILL succeed (and claim the freebie); the UI labels it as the
 * user's one free song.
 */
export async function evaluateSongAccess(
  userId: string | null,
  songId: string,
): Promise<SongAccess> {
  if (!userId) return LOCKED;

  const supabase = await createClient();
  const [{ data: profile }, { data: paid }, { data: subs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_founder, free_song_id")
      .eq("id", userId)
      .maybeSingle<ProfileAccess>(),
    supabase
      .from("payments")
      .select("id")
      .eq("song_id", songId)
      .eq("status", "paid")
      .limit(1),
    supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .limit(1),
  ]);

  if (profile?.is_founder) return { unlocked: true, reason: "founder" };
  // An active/trialing subscription unlocks EVERY song — the one check that
  // lights up all premium gates (fonts, styles, formats, templates) via
  // exportTier, with no per-feature wiring.
  if (isSubscriptionActive(subs?.[0])) {
    return { unlocked: true, reason: "subscriber" };
  }
  if ((paid?.length ?? 0) > 0) return { unlocked: true, reason: "paid" };
  if (profile?.free_song_id === songId) return { unlocked: true, reason: "free-song" };
  if (!profile?.free_song_id) return { unlocked: true, reason: "free-eligible" };
  return LOCKED;
}

// Trust current_period_end over status alone: webhook events can arrive out of
// order, so a subscription is "active" only if its status is active/trialing
// AND it hasn't lapsed.
function isSubscriptionActive(
  sub: { status: string; current_period_end: string | null } | undefined,
): boolean {
  if (!sub) return false;
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  if (!sub.current_period_end) return true;
  return new Date(sub.current_period_end).getTime() > Date.now();
}

/**
 * Authorize an actual download, CLAIMING the free song if this is the first
 * one the user downloads. The claim is written with the service-role client
 * (users can't write free_song_id themselves — migration 0008) and only if
 * the slot is still empty, so it can't be rotated to unlock multiple songs.
 * Returns true if the download may proceed.
 */
export async function authorizeDownload(
  userId: string,
  songId: string,
): Promise<boolean> {
  const access = await evaluateSongAccess(userId, songId);

  if (
    access.reason === "founder" ||
    access.reason === "paid" ||
    access.reason === "free-song"
  ) {
    return true;
  }

  if (access.reason === "free-eligible") {
    const admin = createAdminClient();
    // Ensure a row exists without clobbering an existing claim.
    await admin
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
    // Atomic claim: only sets free_song_id when it's still null.
    const { data: claimed } = await admin
      .from("profiles")
      .update({ free_song_id: songId, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .is("free_song_id", null)
      .select("free_song_id");
    if (claimed && claimed.length > 0) return true;

    // Lost a race (another concurrent download claimed first): allow only if
    // the winning claim happens to be this same song.
    const { data: after } = await admin
      .from("profiles")
      .select("free_song_id")
      .eq("id", userId)
      .maybeSingle<{ free_song_id: string | null }>();
    return after?.free_song_id === songId;
  }

  return false;
}
