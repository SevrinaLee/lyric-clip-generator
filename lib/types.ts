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

export type Lyric = {
  id: string;
  user_id: string | null;
  song_id: string;
  line_index: number;
  text: string;
  start_ms: number | null;
  end_ms: number | null;
  created_at: string;
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
  hook_score: number | null;
  hook_score_source: string | null;
  hook_score_confidence: number | null;
  hook_score_review_status: string;
  created_at: string;
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
};
