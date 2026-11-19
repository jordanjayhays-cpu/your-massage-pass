-- Scope the studio-photos storage policies to the uploader's own folder.
--
-- The four dashboard-created policies " studio-photos 1vsuhk_0".."_3" (SELECT, INSERT,
-- UPDATE, DELETE for `authenticated`) had USING / WITH CHECK = true and no bucket filter,
-- so any signed-in user could list, download, upload, overwrite and delete objects in
-- every bucket, including the private wa-media, bot, pk-inbox and pk-outbox.
--
-- PartnerPhotos.tsx uploads to studio-photos/<auth.uid()>/<kind>-<ts>.<ext> with
-- upsert: true, which needs INSERT plus SELECT and UPDATE on the caller's own objects.
-- Display reads go through the public URL (the bucket is public), so SELECT is limited
-- to the caller's own folder. Service-role callers (media-upload, wa-bot) bypass RLS.
-- avatars_* and media_public_read are left unchanged.

drop policy if exists " studio-photos 1vsuhk_0" on storage.objects;
drop policy if exists " studio-photos 1vsuhk_1" on storage.objects;
drop policy if exists " studio-photos 1vsuhk_2" on storage.objects;
drop policy if exists " studio-photos 1vsuhk_3" on storage.objects;

drop policy if exists studio_photos_own_select on storage.objects;
create policy studio_photos_own_select on storage.objects
  for select to authenticated
  using (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists studio_photos_own_insert on storage.objects;
create policy studio_photos_own_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists studio_photos_own_update on storage.objects;
create policy studio_photos_own_update on storage.objects
  for update to authenticated
  using (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists studio_photos_own_delete on storage.objects;
create policy studio_photos_own_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
