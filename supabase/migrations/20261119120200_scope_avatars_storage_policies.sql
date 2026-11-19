-- Scope the avatars storage write policies to the uploader's own folder.
--
-- avatars_auth_insert (WITH CHECK bucket_id = 'avatars') and avatars_auth_update (USING
-- bucket_id = 'avatars', no WITH CHECK) let any signed-in user upload or overwrite
-- avatars/<someone-else's-uid>/avatar.jpg. Sign-up is open with email autoconfirm, so
-- that is anyone. There was no DELETE policy, so Profile.tsx's remove() of the caller's
-- own avatar could not delete anything once the studio-photos dashboard policies are gone.
--
-- Profile.tsx uploads to avatars/<auth.uid()>/avatar.jpg with upsert: true, which needs
-- INSERT plus SELECT and UPDATE on the caller's own object; remove() needs DELETE (and
-- SELECT). SELECT is already covered by avatars_public_read (the bucket is public), which
-- is left unchanged. Service-role callers bypass RLS.
--
-- Depends on 20261119120000_scope_studio_photos_storage_policies.sql for effect: until the
-- " studio-photos 1vsuhk_*" policies (USING / WITH CHECK = true, no bucket filter) are
-- dropped, they still grant every signed-in user write and delete on avatars.

drop policy if exists avatars_auth_insert on storage.objects;
drop policy if exists avatars_auth_update on storage.objects;

drop policy if exists avatars_own_insert on storage.objects;
create policy avatars_own_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_own_update on storage.objects;
create policy avatars_own_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_own_delete on storage.objects;
create policy avatars_own_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
