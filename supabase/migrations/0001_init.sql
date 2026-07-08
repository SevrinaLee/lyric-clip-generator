create table if not exists video_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  preview_url text,
  font text not null default 'Inter',
  primary_color text not null default '#ffffff',
  animation_preset text not null default 'fade',
  created_at timestamptz not null default now()
);
alter table video_templates enable row level security;
drop policy if exists "video_templates_v1_read" on video_templates;
create policy "video_templates_v1_read" on video_templates for select using (true);
drop policy if exists "video_templates_v1_write" on video_templates;
create policy "video_templates_v1_write" on video_templates for all using (true) with check (true);

create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  artist text not null,
  audio_url text,
  duration_seconds numeric,
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);
alter table songs enable row level security;
drop policy if exists "songs_v1_read" on songs;
create policy "songs_v1_read" on songs for select using (true);
drop policy if exists "songs_v1_write" on songs;
create policy "songs_v1_write" on songs for all using (true) with check (true);

create table if not exists lyrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  song_id uuid references songs(id),
  line_index integer not null,
  text text not null,
  start_ms integer,
  end_ms integer,
  created_at timestamptz not null default now()
);
alter table lyrics enable row level security;
drop policy if exists "lyrics_v1_read" on lyrics;
create policy "lyrics_v1_read" on lyrics for select using (true);
drop policy if exists "lyrics_v1_write" on lyrics;
create policy "lyrics_v1_write" on lyrics for all using (true) with check (true);

create table if not exists clip_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  song_id uuid references songs(id),
  label text not null default 'Clip',
  start_ms integer not null,
  end_ms integer not null,
  platform text not null default 'tiktok',
  template_id uuid references video_templates(id),
  hook_score numeric,
  hook_score_source text,
  hook_score_confidence numeric,
  hook_score_review_status text not null default 'unreviewed',
  created_at timestamptz not null default now()
);
alter table clip_segments enable row level security;
drop policy if exists "clip_segments_v1_read" on clip_segments;
create policy "clip_segments_v1_read" on clip_segments for select using (true);
drop policy if exists "clip_segments_v1_write" on clip_segments;
create policy "clip_segments_v1_write" on clip_segments for all using (true) with check (true);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  song_id uuid references songs(id),
  stripe_session_id text,
  stripe_payment_intent text,
  amount_cents integer not null default 499,
  status text not null default 'pending',
  plan text not null default 'single',
  created_at timestamptz not null default now()
);
alter table payments enable row level security;
drop policy if exists "payments_v1_read" on payments;
create policy "payments_v1_read" on payments for select using (true);
drop policy if exists "payments_v1_write" on payments;
create policy "payments_v1_write" on payments for all using (true) with check (true);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  clip_segment_id uuid references clip_segments(id),
  status text not null default 'queued',
  platform text not null default 'tiktok',
  video_url text,
  payment_id uuid references payments(id),
  created_at timestamptz not null default now()
);
alter table exports enable row level security;
drop policy if exists "exports_v1_read" on exports;
create policy "exports_v1_read" on exports for select using (true);
drop policy if exists "exports_v1_write" on exports;
create policy "exports_v1_write" on exports for all using (true) with check (true);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  actor_id text,
  action text not null,
  object_type text not null,
  object_id uuid,
  payload_snapshot jsonb,
  risk_level text,
  outcome text,
  created_at timestamptz not null default now()
);
alter table audit_logs enable row level security;
drop policy if exists "audit_logs_v1_read" on audit_logs;
create policy "audit_logs_v1_read" on audit_logs for select using (true);
drop policy if exists "audit_logs_v1_write" on audit_logs;
create policy "audit_logs_v1_write" on audit_logs for all using (true) with check (true);

insert into video_templates (id, name, preview_url, font, primary_color, animation_preset) values
  ('a1000000-0000-0000-0000-000000000001', 'Typewriter Dark', '/previews/typewriter-dark.gif', 'Courier Prime', '#f5f5f5', 'typewriter'),
  ('a1000000-0000-0000-0000-000000000002', 'Neon Bounce', '/previews/neon-bounce.gif', 'Montserrat', '#ff00ff', 'bounce'),
  ('a1000000-0000-0000-0000-000000000003', 'Clean Fade', '/previews/clean-fade.gif', 'Inter', '#ffffff', 'fade');

insert into songs (id, title, artist, audio_url, duration_seconds, status) values
  ('b1000000-0000-0000-0000-000000000001', 'Neon City', 'Demo Artist', '/demo/neon_city.mp3', 187, 'ready'),
  ('b1000000-0000-0000-0000-000000000002', 'Midnight Run', 'Demo Artist', '/demo/midnight_run.mp3', 214, 'ready');

insert into lyrics (song_id, line_index, text, start_ms, end_ms) values
  ('b1000000-0000-0000-0000-000000000001', 0, 'Lights flash in the neon city', 0, 3200),
  ('b1000000-0000-0000-0000-000000000001', 1, 'Every corner holds a different dream', 3200, 6800),
  ('b1000000-0000-0000-0000-000000000001', 2, 'I chase the glow across the skyline', 6800, 10500),
  ('b1000000-0000-0000-0000-000000000001', 3, 'Neon city, you know what I mean', 10500, 14000),
  ('b1000000-0000-0000-0000-000000000002', 0, 'Running past the midnight hour', 0, 3500),
  ('b1000000-0000-0000-0000-000000000002', 1, 'Nothing left to lose tonight', 3500, 7000),
  ('b1000000-0000-0000-0000-000000000002', 2, 'Feel the asphalt under my feet', 7000, 10800),
  ('b1000000-0000-0000-0000-000000000002', 3, 'Midnight run, I am finally free', 10800, 14500);

insert into clip_segments (song_id, label, start_ms, end_ms, platform, template_id, hook_score, hook_score_source, hook_score_confidence, hook_score_review_status) values
  ('b1000000-0000-0000-0000-000000000001', 'Hook', 10500, 28000, 'tiktok', 'a1000000-0000-0000-0000-000000000001', 0.91, 'gpt-4o', 0.88, 'unreviewed'),
  ('b1000000-0000-0000-0000-000000000001', 'Chorus', 42000, 67000, 'reels', 'a1000000-0000-0000-0000-000000000002', 0.84, 'gpt-4o', 0.82, 'unreviewed'),
  ('b1000000-0000-0000-0000-000000000001', 'Drop', 95000, 118000, 'shorts', 'a1000000-0000-0000-0000-000000000003', 0.78, 'gpt-4o', 0.75, 'unreviewed'),
  ('b1000000-0000-0000-0000-000000000002', 'Hook', 10800, 29000, 'tiktok', 'a1000000-0000-0000-0000-000000000002', 0.89, 'gpt-4o', 0.86, 'unreviewed'),
  ('b1000000-0000-0000-0000-000000000002', 'Chorus', 48000, 71000, 'reels', 'a1000000-0000-0000-0000-000000000001', 0.81, 'gpt-4o', 0.79, 'unreviewed'),
  ('b1000000-0000-0000-0000-000000000002', 'Bridge', 102000, 125000, 'shorts', 'a1000000-0000-0000-0000-000000000003', 0.74, 'gpt-4o', 0.71, 'unreviewed');