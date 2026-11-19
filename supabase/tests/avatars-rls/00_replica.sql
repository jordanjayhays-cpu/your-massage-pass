-- Local replica of production storage.objects RLS surface (jglftdstrowwckwqmpue, read 2026-11-19).
-- Function bodies, columns, indexes, triggers, grants and table owner copied from production.

create schema auth;
create schema storage authorization supabase_storage_admin;
grant usage on schema auth, storage to anon, authenticated, service_role;

create or replace function auth.uid() returns uuid language sql stable as $function$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$;

create or replace function auth.role() returns text language sql stable as $function$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$function$;

create or replace function auth.jwt() returns jsonb language sql stable as $function$
  select
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$function$;

create or replace function storage.foldername(name text) returns text[] language plpgsql immutable as $function$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$function$;

create or replace function storage.protect_delete() returns trigger language plpgsql as $function$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$function$;

create or replace function storage.update_updated_at_column() returns trigger language plpgsql as $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

create table storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid not null default gen_random_uuid() primary key,
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/'::text)) stored,
  version text,
  owner_id text,
  user_metadata jsonb,
  archived_at timestamptz,
  is_delete_marker boolean not null default false,
  is_versioned boolean not null default false
);

create index idx_objects_bucket_id_name on storage.objects using btree (bucket_id, name collate "C");
create index idx_objects_bucket_id_name_lower on storage.objects using btree (bucket_id, lower(name) collate "C");
create unique index idx_objects_current_version on storage.objects using btree (bucket_id, name collate "C") where (archived_at is null);
create index idx_objects_delete_markers on storage.objects using btree (bucket_id, name collate "C") where is_delete_marker;
create unique index idx_objects_null_version on storage.objects using btree (bucket_id, name collate "C") where (not is_versioned);
create index name_prefix_search on storage.objects using btree (name text_pattern_ops);
create unique index objects_bucket_id_name_version_key on storage.objects using btree (bucket_id, name collate "C", version) nulls not distinct;

create trigger protect_objects_delete before delete on storage.objects for each statement execute function storage.protect_delete();
create trigger update_objects_updated_at before update on storage.objects for each row execute function storage.update_updated_at_column();

alter table storage.objects owner to supabase_storage_admin;
alter table storage.buckets owner to supabase_storage_admin;
alter table storage.objects enable row level security;

revoke all on storage.objects from public;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant all on storage.objects to service_role;

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true), ('studio-photos', 'studio-photos', true),
  ('media', 'media', true), ('wa-media', 'wa-media', false);
