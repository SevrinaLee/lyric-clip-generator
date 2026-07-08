drop policy if exists "audio_v1_delete" on storage.objects;
create policy "audio_v1_delete" on storage.objects for delete using (bucket_id = 'audio');

drop policy if exists "exports_v1_delete" on storage.objects;
create policy "exports_v1_delete" on storage.objects for delete using (bucket_id = 'exports');
