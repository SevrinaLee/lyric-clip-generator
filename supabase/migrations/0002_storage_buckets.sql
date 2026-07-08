insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

drop policy if exists "audio_v1_read" on storage.objects;
create policy "audio_v1_read" on storage.objects for select using (bucket_id = 'audio');
drop policy if exists "audio_v1_write" on storage.objects;
create policy "audio_v1_write" on storage.objects for insert with check (bucket_id = 'audio');

drop policy if exists "exports_v1_read" on storage.objects;
create policy "exports_v1_read" on storage.objects for select using (bucket_id = 'exports');
drop policy if exists "exports_v1_write" on storage.objects;
create policy "exports_v1_write" on storage.objects for insert with check (bucket_id = 'exports');
