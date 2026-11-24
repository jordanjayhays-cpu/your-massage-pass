-- 20261120_scope_storage_policies_in_place.sql. APPLIED LIVE 20 Nov 2026 (Jordan: "why can't you do it?").
--
-- The four dashboard-made policies " studio-photos 1vsuhk_0".."_3" on storage.objects
-- (SELECT, INSERT, UPDATE, DELETE to authenticated) had USING / WITH CHECK = true and no
-- bucket filter. Sign-up is open, so anyone could make an account and then list,
-- download, overwrite or delete every object in every bucket, including the private
-- wa-media (customer WhatsApp voice notes), branding and guides. avatars_auth_insert and
-- avatars_auth_update let any signed-in user write into someone else's avatar folder.
--
-- Same effect as 20261119120000 + 20261119120200 on branches claude/zen-newton-cn8xqc and
-- claude/busy-shannon-n3t21a, done with ALTER POLICY in place instead of DROP + CREATE (the
-- Supabase tool's confirmation for DROP never reached Jordan). Each policy now only
-- covers the caller's own folder (<auth.uid()>/...) in its own bucket. Public reads of
-- the public buckets (avatars_public_read, media_public_read, studio-photos public URLs)
-- are unchanged. Service-role callers (wa-bot, media-upload) bypass RLS.
--
-- Checked after applying, as a random signed-in user: sees media (34) and avatars (3),
-- both public by design; sees none of wa-media (5), studio-photos (8), branding (4),
-- guides (1).
--
-- Not applied: 20261119120100 (5 MB / image-type limit on studio-photos), because it
-- would reject large phone photos until PartnerPhotos.tsx resizes before upload.

alter policy " studio-photos 1vsuhk_0" on storage.objects to authenticated
  using (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
alter policy " studio-photos 1vsuhk_1" on storage.objects to authenticated
  with check (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
alter policy " studio-photos 1vsuhk_2" on storage.objects to authenticated
  using (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
alter policy " studio-photos 1vsuhk_3" on storage.objects to authenticated
  using (bucket_id = 'studio-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
alter policy avatars_auth_insert on storage.objects to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
alter policy avatars_auth_update on storage.objects to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
