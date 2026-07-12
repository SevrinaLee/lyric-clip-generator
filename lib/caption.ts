// Rule-based caption + hashtag suggestion for a finished clip. Deliberately
// no AI: consistent, instant, zero-cost, and good enough as a starting point
// the user can edit. Mirrors the app's "works without an AI key" design.

const BASE_TAGS = ["lyrics", "lyricvideo", "musicedit"];
const PLATFORM_TAGS: Record<string, string[]> = {
  tiktok: ["fyp", "foryou", "tiktokmusic"],
  reels: ["reels", "instamusic", "reelsinstagram"],
  shorts: ["shorts", "ytshorts"],
};

export function suggestedHashtags(platform: string): string {
  const tags = [...BASE_TAGS, ...(PLATFORM_TAGS[platform] ?? [])];
  return tags.map((t) => `#${t}`).join(" ");
}

export function buildCaption({
  title,
  artist,
  platform,
  hookLine,
}: {
  title: string;
  artist?: string | null;
  platform: string;
  hookLine?: string | null;
}): string {
  const hook = (hookLine ?? "").trim();
  const credit = artist ? `${title} — ${artist}` : title;
  const parts: string[] = [];
  if (hook) parts.push(`“${hook}”`);
  parts.push(`🎵 ${credit}`);
  parts.push(suggestedHashtags(platform));
  return parts.join("\n\n");
}
