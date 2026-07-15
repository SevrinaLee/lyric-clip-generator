-- Brand kit (v1.5 Sprint 5.3, premium). Subscribers brand their clips: a
-- custom watermark (text + logo) on paid renders and an accent colour that
-- overrides the yellow/waveform fills. One kit per user.
--
-- Premium gating (paid account) is enforced in the updateBrandKit server
-- action; RLS here just guarantees isolation. Logo files live in a private
-- brand-logos bucket keyed by user id folder.
create table if not exists brand_kits (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text,
  accent_hex text,
  watermark_text text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table brand_kits enable row level security;

drop policy if exists "brand_kits_select" on brand_kits;
create policy "brand_kits_select" on brand_kits
  for select using (auth.uid() = user_id);
drop policy if exists "brand_kits_insert" on brand_kits;
create policy "brand_kits_insert" on brand_kits
  for insert with check (auth.uid() = user_id);
drop policy if exists "brand_kits_update" on brand_kits;
create policy "brand_kits_update" on brand_kits
  for update using (auth.uid() = user_id);
drop policy if exists "brand_kits_delete" on brand_kits;
create policy "brand_kits_delete" on brand_kits
  for delete using (auth.uid() = user_id);

-- Private bucket; each user can only touch objects under their own <uid>/ folder.
insert into storage.buckets (id, name, public)
values ('brand-logos', 'brand-logos', false)
on conflict (id) do nothing;

drop policy if exists "brand_logos_owner" on storage.objects;
create policy "brand_logos_owner" on storage.objects
  for all
  using (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
