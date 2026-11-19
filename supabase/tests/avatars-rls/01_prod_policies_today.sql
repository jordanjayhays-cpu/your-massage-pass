-- storage.objects policies exactly as pg_policies reports them in production on 2026-11-19.
create policy " studio-photos 1vsuhk_0" on storage.objects for select to authenticated using (true);
create policy " studio-photos 1vsuhk_1" on storage.objects for insert to authenticated with check (true);
create policy " studio-photos 1vsuhk_2" on storage.objects for update to authenticated using (true);
create policy " studio-photos 1vsuhk_3" on storage.objects for delete to authenticated using (true);
create policy avatars_auth_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars'::text);
create policy avatars_auth_update on storage.objects for update to authenticated using (bucket_id = 'avatars'::text);
create policy avatars_public_read on storage.objects for select to public using (bucket_id = 'avatars'::text);
create policy media_public_read on storage.objects for select to public using (bucket_id = 'media'::text);
