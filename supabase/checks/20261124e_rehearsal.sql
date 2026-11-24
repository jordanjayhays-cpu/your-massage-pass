-- REHEARSAL of supabase/migrations/20261124e_partners_column_lock.sql.
-- NEVER apply this file as a migration, and never run it on its own.
--
-- When: after 20261124d is live and the site change is on production, right
-- before applying 20261124e.
-- How: ONE Supabase execute_sql call (never apply_migration, which commits)
-- whose text is "begin;", then the whole lock migration, then this file:
--
--   { echo 'begin;'; cat supabase/migrations/20261124e_partners_column_lock.sql \
--       supabase/checks/20261124e_rehearsal.sql; } > "$SCRATCH/rehearsal.sql"
--
-- Why it cannot commit: its last statement always raises an error that
-- carries the report, so the whole transaction, the lock's grants included,
-- is rolled back whatever the client does. Read the error text:
--   "REHEARSAL (rolled back): N/N passed" and one PASS/FAIL line per check.
-- Any FAIL, or any other error (for example the lock's own self-check), means
-- do not apply 20261124e yet.
--
-- What it checks, the way PostgREST runs a request (set local role plus the
-- JWT claims): the public key (anon); a synthetic signed-in studio created
-- inside this transaction (suspended, test email, password sign-in, gone at
-- rollback); the founder (the email in the "founder reads all partners"
-- policy); and the service role. Nothing outside this transaction changes:
-- the synthetic rows, the claim_reviews row and the webhook queue entries
-- (pg_net queues inside the transaction) all vanish at rollback, and no
-- check moves a row to status active, so the notify-claim trigger never fires.

create function pg_temp.mc_try(p_role text, p_claims jsonb, p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', coalesce(p_claims, '{}'::jsonb)::text, true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql into v;
  exception when others then
    execute 'reset role';
    return 'ERR ' || sqlstate;
  end;
  execute 'reset role';
  return 'ok ' || coalesce(v, '<null>');
end
$f$;

do $rehearsal$
declare
  studio constant uuid := '00000000-0000-4000-8000-00000000c0de';
  prebuilt constant uuid := '00000000-0000-4000-8000-00000000c0df';
  founder_email text;
  anon_c jsonb := '{"role":"anon"}';
  studio_c jsonb;
  founder_c jsonb;
  svc_c jsonb := '{"role":"service_role"}';
  rec record;
  got text;
  report text := '';
  total int := 0;
  passed int := 0;
  s text;
begin
  select substring(qual from $r$= '([^']+)'::text$r$) into founder_email
    from pg_policies
   where schemaname = 'public' and tablename = 'partners' and policyname = 'founder reads all partners';
  studio_c := jsonb_build_object('role', 'authenticated', 'sub', studio, 'email', 'rehearsal+mctest@example.com',
                                 'amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', 0)));
  founder_c := jsonb_build_object('role', 'authenticated', 'sub', '00000000-0000-4000-8000-00000000f00d',
                                  'email', coalesce(founder_email, 'no-founder-policy@example.com'));

  insert into public.partners (id, business_name, email, status)
  values (studio, 'Rehearsal Studio (test)', 'rehearsal+mctest@example.com', 'suspended');
  insert into public.partners (id, business_name, email, status, slug)
  values (prebuilt, 'Rehearsal Prebuilt (test)', 'rehearsal-prebuilt+mctest@example.com', 'pending', 'zz-rehearsal-c0df');

  for rec in
    select * from (values
      -- public key
      (1,  'anon: read claim_token',              'anon', anon_c, 'select claim_token::text from public.partners limit 0', 'ERR 42501'),
      (2,  'anon: read hours_token',              'anon', anon_c, 'select hours_token::text from public.partners limit 0', 'ERR 42501'),
      (3,  'anon: read hours_code',               'anon', anon_c, 'select hours_code from public.partners limit 0', 'ERR 42501'),
      (4,  'anon: read google_access_token',      'anon', anon_c, 'select google_access_token from public.partners limit 0', 'ERR 42501'),
      (5,  'anon: read google_refresh_token',     'anon', anon_c, 'select google_refresh_token from public.partners limit 0', 'ERR 42501'),
      (6,  'anon: read google_calendar_id',       'anon', anon_c, 'select google_calendar_id from public.partners limit 0', 'ERR 42501'),
      (7,  'anon: read google_token_expiry',      'anon', anon_c, 'select google_token_expiry::text from public.partners limit 0', 'ERR 42501'),
      (8,  'anon: select *',                      'anon', anon_c, 'select count(*)::text from (select * from public.partners limit 0) x', 'ERR 42501'),
      (9,  'anon: filter on claim_token',         'anon', anon_c, 'select count(*)::text from public.partners where claim_token is not null', 'ERR 42501'),
      (10, 'anon: filter on hours_code',          'anon', anon_c, 'select count(*)::text from public.partners where hours_code is not null', 'ERR 42501'),
      (11, 'anon: directory-style read',          'anon', anon_c, 'select count(*)::text from (select id, business_name, slug, status, latitude, longitude, opening_hours, google_rating, whatsapp from public.partners where status in (''active'', ''pending'') and opted_out_at is null limit 5) x', 'ok %'),
      (12, 'anon: claim page read by slug',       'anon', anon_c, 'select business_name from public.partners where slug = ''zz-rehearsal-c0df'' and status in (''pending'', ''active'')', 'ok Rehearsal Prebuilt (test)'),
      (13, 'anon: match_studios',                 'anon', anon_c, 'select count(*)::text from public.match_studios(null, null, null, 3)', 'ok %'),
      (14, 'anon: claim_lookup(random)',          'anon', anon_c, 'select count(*)::text from public.claim_lookup(gen_random_uuid())', 'ok 0'),
      (15, 'anon: claim_release_prebuilt',        'anon', anon_c, 'select public.claim_release_prebuilt(gen_random_uuid())::text', 'ERR 42501'),
      (16, 'anon: claim_release_verified',        'anon', anon_c, 'select public.claim_release_verified(gen_random_uuid())', 'ERR 42501'),
      (17, 'anon: partner_disconnect_calendar',   'anon', anon_c, 'select public.partner_disconnect_calendar()::text', 'ERR 42501'),
      (18, 'anon: read claim_reviews',            'anon', anon_c, 'select count(*)::text from public.claim_reviews', 'ERR 42501'),
      (19, 'anon: update a row',                  'anon', anon_c, format('update public.partners set business_name = %L where id = %L returning 1', 'x', studio), 'ERR 42501'),
      (20, 'anon: delete a row',                  'anon', anon_c, format('delete from public.partners where id = %L returning 1', studio), 'ERR 42501'),
      (21, 'anon: insert a row',                  'anon', anon_c, 'insert into public.partners (business_name) values (''x'') returning 1', 'ERR 42501'),
      -- signed-in studio (its own row)
      (30, 'studio: read own claim_token',        'authenticated', studio_c, format('select claim_token::text from public.partners where id = %L', studio), 'ERR 42501'),
      (31, 'studio: read own hours_token',        'authenticated', studio_c, format('select hours_token::text from public.partners where id = %L', studio), 'ERR 42501'),
      (32, 'studio: read own hours_code',         'authenticated', studio_c, format('select hours_code from public.partners where id = %L', studio), 'ERR 42501'),
      (33, 'studio: read own google_access_token','authenticated', studio_c, format('select google_access_token from public.partners where id = %L', studio), 'ERR 42501'),
      (34, 'studio: read own google_refresh_token','authenticated', studio_c, format('select google_refresh_token from public.partners where id = %L', studio), 'ERR 42501'),
      (35, 'studio: read own google_calendar_id', 'authenticated', studio_c, format('select google_calendar_id from public.partners where id = %L', studio), 'ERR 42501'),
      (36, 'studio: read own google_token_expiry','authenticated', studio_c, format('select google_token_expiry::text from public.partners where id = %L', studio), 'ERR 42501'),
      (37, 'studio: select * own row',            'authenticated', studio_c, format('select count(*)::text from (select * from public.partners where id = %L) x', studio), 'ERR 42501'),
      (38, 'studio: read own allowed columns',    'authenticated', studio_c, format('select business_name || ''/'' || status from public.partners where id = %L', studio), 'ok Rehearsal Studio (test)/suspended'),
      (39, 'studio: save profile (update)',       'authenticated', studio_c, format('update public.partners set business_name = %L, phone = %L, preferred_language = %L where id = %L returning 1', 'Rehearsal Studio (test)', '+34600000000', 'es', studio), 'ok 1'),
      (40, 'studio: save profile (PostgREST upsert shape)', 'authenticated', studio_c,
           format($q$with s as (insert into public.partners (id, business_name, email, status, preferred_language) select b.id, b.business_name, b.email, b.status, b.preferred_language from json_to_recordset(%L::json) as b(id uuid, business_name text, email text, status text, preferred_language text) on conflict (id) do update set id = excluded.id, business_name = excluded.business_name, email = excluded.email, status = excluded.status, preferred_language = excluded.preferred_language returning 1) select count(*)::text from s$q$,
                  json_build_array(json_build_object('id', studio, 'business_name', 'Rehearsal Studio (test)', 'email', 'rehearsal+mctest@example.com', 'status', 'suspended', 'preferred_language', 'es'))::text), 'ok 1'),
      (41, 'studio: update own hours_code',       'authenticated', studio_c, format('update public.partners set hours_code = %L where id = %L returning 1', 'zzzzzz', studio), 'ERR 42501'),
      (42, 'studio: update own claim_token',      'authenticated', studio_c, format('update public.partners set claim_token = gen_random_uuid() where id = %L returning 1', studio), 'ERR 42501'),
      (43, 'studio: update own google tokens',    'authenticated', studio_c, format('update public.partners set google_access_token = null where id = %L returning 1', studio), 'ERR 42501'),
      (44, 'studio: update own outreach_status',  'authenticated', studio_c, format('update public.partners set outreach_status = null where id = %L returning 1', studio), 'ERR 42501'),
      (45, 'studio: update own match_boost',      'authenticated', studio_c, format('update public.partners set match_boost = 99 where id = %L returning 1', studio), 'ERR 42501'),
      (46, 'studio: update own fee_eur',          'authenticated', studio_c, format('update public.partners set fee_eur = 0 where id = %L returning 1', studio), 'ERR 42501'),
      (47, 'studio: delete own row',              'authenticated', studio_c, format('delete from public.partners where id = %L returning 1', studio), 'ERR 42501'),
      (48, 'studio: partner_disconnect_calendar', 'authenticated', studio_c, 'select public.partner_disconnect_calendar()::text', 'ok %'),
      (49, 'studio: connected is false after it', 'authenticated', studio_c, format('select google_calendar_connected::text from public.partners where id = %L', studio), 'ok false'),
      (50, 'studio: claim_release_prebuilt',      'authenticated', studio_c, 'select public.claim_release_prebuilt(gen_random_uuid())::text', 'ERR 42501'),
      (51, 'studio: claim_release_verified without proof parks it', 'authenticated', studio_c, format('select public.claim_release_verified(%L)', prebuilt), 'ok needs_review'),
      (52, 'studio: read claim_reviews',          'authenticated', studio_c, 'select count(*)::text from public.claim_reviews', 'ERR 42501'),
      -- founder
      (60, 'founder: read hours_code',            'authenticated', founder_c, 'select hours_code from public.partners limit 0', 'ERR 42501'),
      (61, 'founder: read claim_token',           'authenticated', founder_c, 'select claim_token::text from public.partners limit 0', 'ERR 42501'),
      (62, 'founder: reads every row (safe columns)', 'authenticated', founder_c, format('select count(*)::text from public.partners where id = %L', studio), 'ok 1'),
      -- service role (edge functions, the bot)
      (70, 'service_role: read hours_code',       'service_role', svc_c, 'select count(*)::text from (select hours_code from public.partners limit 5) x', 'ok %'),
      (71, 'service_role: claim_reviews row parked', 'service_role', svc_c, format('select count(*)::text from public.claim_reviews where claimer_id = %L and prebuilt_id = %L and resolved_at is null', studio, prebuilt), 'ok 1'),
      (72, 'service_role: prebuilt row untouched', 'service_role', svc_c, format('select status from public.partners where id = %L', prebuilt), 'ok pending')
    ) v(n, name, role, claims, sql, want)
    order by n
  loop
    got := pg_temp.mc_try(rec.role, rec.claims, rec.sql);
    total := total + 1;
    if got like rec.want then
      passed := passed + 1;
      report := report || E'\nPASS  ' || rec.name;
    else
      report := report || E'\nFAIL  ' || rec.name || '  (got ' || got || ', want ' || rec.want || ')';
    end if;
  end loop;

  if founder_email is null then
    report := report || E'\nFAIL  founder policy not found: founder checks ran with a placeholder email';
    total := total + 1;
  end if;

  s := format('REHEARSAL (rolled back): %s/%s passed%s', passed, total, report);
  raise exception '%', s;
end
$rehearsal$;

rollback;
