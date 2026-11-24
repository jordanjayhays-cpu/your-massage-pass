-- Rotate every studio's hours link (24 Nov 2026). Apply only AFTER
-- 20261124e_partners_column_lock.sql, and only with Jordan's OK.
--
-- Why: until the lock, every visitor's browser received hours_token (all
-- rows) and hours_code through select("*"). The lock stops new reads, but a
-- copy already taken still works in confirm-hours (service role, no login):
-- a POST with action "save" rewrites any studio's partner_availability and
-- opening_hours, so dispatch asks studios at the wrong times or skips them.
-- Fresh values close that; after e the public key can never read them.
--
-- Effect: hours links already in studios' inboxes (?token= and
-- /<slug>/hours?c=) stop working. New links are built from the DB.
-- Codes stay 6 lowercase hex characters: confirm-hours v7 accepts only
-- /^[0-9a-f]{6}$/. A collision on the unique index partners_hours_code_key
-- (about 0.02% over ~82 codes) rolls the whole statement back: just rerun.
-- Claim tokens need no rotation: after d they unlock only public fields.
-- No DOWN: the old values were public and must not come back.

do $$ begin
  if has_column_privilege('anon', 'public.partners', 'hours_code', 'SELECT')
     or has_column_privilege('anon', 'public.partners', 'hours_token', 'SELECT') then
    raise exception 'apply 20261124e_partners_column_lock.sql first: the public key can still read the hours columns';
  end if;
end $$;

update public.partners
   set hours_token = gen_random_uuid(),
       hours_code  = case when hours_code is null then null
                          else substr(replace(gen_random_uuid()::text, '-', ''), 1, 6) end;
