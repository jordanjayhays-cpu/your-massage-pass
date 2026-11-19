-- Test helpers. Every action runs the way PostgREST / Storage API run a user request:
-- SET ROLE authenticated|anon plus request.jwt.claims, inside one transaction.
create schema t;
create table t.results (id serial, scenario text, label text, got text, want text, pass boolean);

create function t.act(uid text, sql text, allow_delete boolean default true) returns text
language plpgsql as $$
declare n bigint;
begin
  begin
    perform set_config('request.jwt.claims',
      case when uid is null then '{"role":"anon"}'
           else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
    -- Storage API sets this before its own deletes; protect_delete blocks deletes without it.
    perform set_config('storage.allow_delete_query', allow_delete::text, true);
    perform set_config('role', case when uid is null then 'anon' else 'authenticated' end, true);
    execute sql;
    get diagnostics n = row_count;
    perform set_config('role', 'none', true);
    return 'ok:' || n;
  exception when others then
    return 'err:' || sqlstate || ' ' || left(sqlerrm, 90);
  end;
end $$;

-- Upload with upsert: true (INSERT ... ON CONFLICT DO UPDATE ... RETURNING, as storage-api does).
create function t.upsert(bucket text, path text, uid text, ver text) returns text language sql as $$
  select format($f$insert into storage.objects (bucket_id, name, owner, owner_id, version, metadata)
    values (%L, %L, %L::uuid, %L, %L, '{}'::jsonb)
    on conflict (bucket_id, name) where (archived_at is null and not is_versioned)
    do update set version = excluded.version, owner = excluded.owner,
                  owner_id = excluded.owner_id, metadata = excluded.metadata
    returning id$f$, bucket, path, uid, uid, ver) $$;

create function t.ins(bucket text, path text, uid text, ver text) returns text language sql as $$
  select format($f$insert into storage.objects (bucket_id, name, owner, owner_id, version)
    values (%L, %L, %L::uuid, %L, %L) returning id$f$, bucket, path, uid, uid, ver) $$;

create function t.upd(bucket text, path text, ver text) returns text language sql as $$
  select format($f$update storage.objects set version = %L where bucket_id = %L and name = %L returning id$f$,
    ver, bucket, path) $$;

create function t.mv(bucket text, src text, dst text) returns text language sql as $$
  select format($f$update storage.objects set name = %L where bucket_id = %L and name = %L returning id$f$,
    dst, bucket, src) $$;

-- remove([path]) as storage-api issues it: DELETE ... WHERE name = ANY(...) RETURNING.
create function t.del(bucket text, path text) returns text language sql as $$
  select format($f$delete from storage.objects where bucket_id = %L and name = any(array[%L]) returning id$f$,
    bucket, path) $$;

create function t.sel(bucket text, path text) returns text language sql as $$
  select format($f$select id from storage.objects where bucket_id = %L and name = %L$f$, bucket, path) $$;

-- Ground truth, read as superuser.
create function t.ver(bucket text, path text) returns text language sql as $$
  select coalesce((select version from storage.objects where bucket_id = bucket and name = path), 'absent') $$;

create function t.expect(scenario text, label text, got text, want text) returns void language plpgsql as $$
begin
  insert into t.results (scenario, label, got, want, pass) values (scenario, label, got, want, got like want);
end $$;
