export type Song = {
  id: string;
  user_id: string | null;
  title: string;
  artist: string;
  audio_url: string | null;
  duration_seconds: number | null;
  status: "uploaded" | "processing" | "ready";
  created_at: string;
};

export type LyricWord = {
  id: string;
  lyric_id: string;
  user_id: string | null;
  word_index: number;
  text: string;
  start_ms: number;
  end_ms: number;
  created_at: string;
};

export type Lyric = {
  id: string;
  user_id: string | null;
  song_id: string;
  line_index: number;
  text: string;
  start_ms: number | null;
  end_ms: number | null;
  created_at: string;
  // Bumped by the timing-edit actions (see actions.ts). Used to tell when a
  // rendered clip has gone stale relative to a later lyric edit. Optional so
  // the app still type-checks/degrades if the 0011 column isn't present yet.
  updated_at?: string;
  // Per-word timing (from lyric_words, migration 0015), attached by callers
  // that fetch it; drives vocal-synced captions. Absent = fall back to the
  // even word split.
  words?: { text: string; start_ms: number; end_ms: number }[];
};

export type VideoTemplate = {
  id: string;
  name: string;
  preview_url: string | null;
  font: string;
  primary_color: string;
  animation_preset: "fade" | "bounce" | "typewriter";
  background_style: string;
  is_premium: boolean;
  created_at: string;
};

export type ClipSegment = {
  id: string;
  user_id: string | null;
  song_id: string;
  label: string;
  start_ms: number;
  end_ms: number;
  platform: "tiktok" | "reels" | "shorts";
  template_id: string | null;
  // Per-clip caption style overrides (migrations 0012/0013); null = inherit
  // from template. Optional-tolerant like lyrics.updated_at so the app still
  // type-checks/degrades before the columns exist.
  caption_font?: string | null;
  caption_size?: "sm" | "md" | "lg" | null;
  caption_position?: "center" | "lower" | null;
  caption_style_preset?: "box" | "outline" | "outline-yellow" | null;
  caption_animation?: "fade" | "bounce" | "wordpop" | "karaoke" | null;
  // Per-clip custom colors (migration 0023); null = inherit the template.
  // #rrggbb hex, DB-CHECK-constrained. c0+c1 override the background (solid if
  // equal, else a gradient); caption_color overrides the caption text color.
  custom_bg_c0?: string | null;
  custom_bg_c1?: string | null;
  custom_caption_color?: string | null;
  hook_score: number | null;
  hook_score_source: string | null;
  hook_score_confidence: number | null;
  hook_score_review_status: string;
  created_at: string;
};

export type ShowcaseEntry = {
  id: string;
  export_id: string;
  user_id: string | null;
  title: string | null;
  approved: boolean;
  created_at: string;
};

export type BrandKit = {
  user_id: string;
  display_name: string | null;
  accent_hex: string | null;
  watermark_text: string | null;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  user_id: string | null;
  song_id: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  amount_cents: number;
  status: "pending" | "paid" | "failed";
  plan: "single" | "subscription";
  created_at: string;
};

export type Export = {
  id: string;
  user_id: string | null;
  clip_segment_id: string;
  status: "queued" | "rendering" | "done" | "failed";
  platform: string;
  video_url: string | null;
  payment_id: string | null;
  created_at: string;
  // Aspect ratio of this export (migration 0017); 9:16 default. Optional-
  // tolerant so the app degrades before the column exists.
  format?: "9:16" | "1:1" | "4:5" | "16:9";
};
