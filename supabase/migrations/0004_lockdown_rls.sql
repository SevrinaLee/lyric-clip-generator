-- Sprint 5 lock-down: replace v1's permissive `using (true)` policies with
-- per-user ownership, while keeping existing demo rows (user_id is null)
-- publicly readable so the homepage gallery still works for anonymous
-- visitors. New writes always carry a user_id (enforced in application
-- code), so `auth.uid() = user_id` is the write check everywhere.

-- ── songs ──────────────────────────────────────────────────────────────────
drop policy if exists "songs_v1_read" on songs;
drop policy if exists "songs_v1_write" on songs;

create policy "songs_read" on songs
  for select using (user_id is null or auth.uid() = user_id);
create policy "songs_insert" on songs
  for insert with check (auth.uid() = user_id);
create policy "songs_update" on songs
  for update using (auth.uid() = user_id);
create policy "songs_delete" on songs
  for delete using (auth.uid() = user_id);

-- ── lyrics ─────────────────────────────────────────────────────────────────
drop policy if exists "lyrics_v1_read" on lyrics;
drop policy if exists "lyrics_v1_write" on lyrics;

create policy "lyrics_read" on lyrics
  for select using (user_id is null or auth.uid() = user_id);
create policy "lyrics_insert" on lyrics
  for insert with check (auth.uid() = user_id);
create policy "lyrics_update" on lyrics
  for update using (auth.uid() = user_id);
create policy "lyrics_delete" on lyrics
  for delete using (auth.uid() = user_id);

-- ── clip_segments ────────────────────────────────────────────────────────
drop policy if exists "clip_segments_v1_read" on clip_segments;
drop policy if exists "clip_segments_v1_write" on clip_segments;

create policy "clip_segments_read" on clip_segments
  for select using (user_id is null or auth.uid() = user_id);
create policy "clip_segments_insert" on clip_segments
  for insert with check (auth.uid() = user_id);
create policy "clip_segments_update" on clip_segments
  for update using (auth.uid() = user_id);
create policy "clip_segments_delete" on clip_segments
  for delete using (auth.uid() = user_id);

-- ── payments ────────────────────────────────────────────────────────────
drop policy if exists "payments_v1_read" on payments;
drop policy if exists "payments_v1_write" on payments;

create policy "payments_read" on payments
  for select using (user_id is null or auth.uid() = user_id);
create policy "payments_insert" on payments
  for insert with check (auth.uid() = user_id);
create policy "payments_update" on payments
  for update using (auth.uid() = user_id);

-- ── exports ────────────────────────────────────────────────────────────
drop policy if exists "exports_v1_read" on exports;
drop policy if exists "exports_v1_write" on exports;

create policy "exports_read" on exports
  for select using (user_id is null or auth.uid() = user_id);
create policy "exports_insert" on exports
  for insert with check (auth.uid() = user_id);
create policy "exports_update" on exports
  for update using (user_id is null or auth.uid() = user_id);

-- ── audit_logs ─────────────────────────────────────────────────────────
-- Append-only (docs/SECURITY.md): no update/delete policy for anyone.
drop policy if exists "audit_logs_v1_read" on audit_logs;
drop policy if exists "audit_logs_v1_write" on audit_logs;

create policy "audit_logs_read" on audit_logs
  for select using (user_id is null or auth.uid() = user_id);
create policy "audit_logs_insert" on audit_logs
  for insert with check (auth.uid() = user_id);

-- ── video_templates ──────────────────────────────────────────────────────
-- Global catalog, not user-owned: stays public-read; writes need a session.
drop policy if exists "video_templates_v1_write" on video_templates;
create policy "video_templates_write" on video_templates
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── storage: audio uploads now require a session ───────────────────────
drop policy if exists "audio_v1_write" on storage.objects;
create policy "audio_write" on storage.objects
  for insert with check (bucket_id = 'audio' and auth.uid() is not null);
