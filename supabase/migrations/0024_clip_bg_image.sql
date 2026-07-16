-- Custom image backgrounds (v1.7 S7.3, Creator-gated). A clip can use the
-- user's own uploaded image as its background instead of a template/gradient.
-- The path points at a private clip-backgrounds bucket keyed by <uid>/ folder;
-- NULL = no custom image. Premium gating (Creator plan) is enforced in the
-- updateClipBgImage server action + at render time; RLS/bucket policy here
-- guarantee isolation. The image is never auto-featured in the public showcase
-- (moderation surface) — the submit action refuses clips that use one.
alter table clip_segments
  add column if not exists custom_bg_image_path text;

-- Private bucket; each user can only touch objects under their own <uid>/ folder
-- (same shape as brand-logos, migration 0020).
insert into storage.buckets (id, name, public)
values ('clip-backgrounds', 'clip-backgrounds', false)
on conflict (id) do nothing;

drop policy if exists "clip_backgrounds_owner" on storage.objects;
create policy "clip_backgrounds_owner" on storage.objects
  for all
  using (
    bucket_id = 'clip-backgrounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'clip-backgrounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
