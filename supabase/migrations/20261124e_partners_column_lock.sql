-- DRAFT, NOT APPLIED. Step 3 of 3 of the partners lock. Apply ONLY after
-- step 1 (20261124d_partners_claim_rpcs.sql) is live AND the site change
-- (step 2: no select("*") on partners, claim page by slug or through
-- claim_lookup, claim merge through claim_release_verified, no
-- google_calendar_id reads, calendar disconnect through
-- partner_disconnect_calendar) is deployed on book.massageclub.io and
-- checked there. The site change must ship first: once this runs, the old
-- site's select("*") reads (directory, studio page, studio portal, founder
-- concierge tab) fail with 42501.
--
-- Rehearse first, as ONE execute_sql call that can never commit:
-- supabase/checks/20261124e_rehearsal.sql says how.
--
-- What it does
--   * anon and authenticated lose every table-level privilege on partners
--     (today both hold arwdDxtm: select, insert, update, delete, truncate,
--     references, trigger, maintain). A table-level REVOKE also removes the
--     matching column-level privileges, so this starts from nothing.
--   * SELECT comes back on 56 named columns. Not granted, so permission
--     denied for the public key and for every signed-in studio or customer:
--       secrets (7): google_calendar_id, google_access_token, google_refresh_token, google_token_expiry, claim_token, hours_token, hours_code
--       internal (21, nothing on the site reads them, and the only
--         partners functions the public key can run, match_studios,
--         dispatch_candidates, cheapest_candidates and offer_studios, use
--         none of them):
--         vat_id, outreach_score, outreach_tier, outreach_hook,
--         followup_1_at, followup_2_at, booking_email,
--         mc_discount_confirmed_at, mc_discount_note, signup_asked_at,
--         fee_eur, fee_pct, billing_name, billing_tax_id,
--         billing_address, billing_email, call_ok, call_ok_at,
--         call_ok_note, call_phone, slots_link_v
--   * INSERT and UPDATE come back for authenticated only, on the 36 columns
--     the site writes (every .insert/.upsert/.update on partners in src/,
--     mapped 24 Nov). Rows are still limited by partners_owner_all
--     (auth.uid() = id). A studio can no longer write its own outreach_status
--     (which reset the claim_release_prebuilt one-per-account guard), match
--     boost, discount, fee, rating, opt-out or any token or code.
--   * No DELETE, TRUNCATE, REFERENCES, TRIGGER or MAINTAIN for anon or
--     authenticated. Nothing on the site deletes a partners row; the claim
--     cleanup runs inside claim_release_prebuilt (SECURITY DEFINER).
--   * service_role and postgres keep everything, so every edge function
--     (all read with the service role key) and the bot are unaffected.
--   * Unchanged: RLS policies, rows anyone can see.
--
-- Rules from now on (the reason: a column-level grant is an allowlist)
--   * A new partners column is invisible to the site until it is added to
--     the GRANT below in its own migration. select("*") on partners fails.
--   * A new site write to partners fails until its columns are in the
--     INSERT/UPDATE grant. Never add a token, code or secret column to either.
--
-- The DO block at the end refuses to finish (rolling the whole migration
-- back) if step 1 is not live, if any live column is in neither list, if a
-- hidden column is still readable or writable, if the INSERT/UPDATE columns
-- are not exactly the writable list, if PUBLIC holds anything on partners,
-- or if the public key or a signed-in studio can run a claim or digest
-- function it must not.

revoke all on table public.partners from anon, authenticated;

grant select (
  id, business_name, email, phone, website, address, address_line2,
  postal_code, city, country, description, latitude, longitude,
  google_place_id, logo_url, cover_url, gallery, amenities, languages,
  payment_methods, instagram, timezone, currency, service_location,
  price_from, cancellation_hours, cancellation_policy, deposit_required,
  deposit_pct, google_calendar_connected, auto_confirm_bookings, status,
  created_at, updated_at, opening_hours, capacity, access_instructions,
  whatsapp, slug, booking_method, google_rating, google_reviews,
  outreach_status, outreach_email_at, staff_count, preferred_language,
  hours_confirmed_at, neighbourhood, opted_out_at, venue_type, match_boost,
  mc_discount_pct, booking_mode, booking_url, partner_need, booking_tools
) on public.partners to anon, authenticated;

grant insert (
  id, business_name, email, phone, website, address, postal_code, city,
  country, description, latitude, longitude, google_place_id, logo_url,
  cover_url, gallery, amenities, languages, instagram, service_location,
  cancellation_hours, deposit_required, deposit_pct,
  google_calendar_connected, auto_confirm_bookings, status, opening_hours,
  capacity, access_instructions, whatsapp, slug, staff_count,
  preferred_language, hours_confirmed_at, partner_need, booking_tools
), update (
  id, business_name, email, phone, website, address, postal_code, city,
  country, description, latitude, longitude, google_place_id, logo_url,
  cover_url, gallery, amenities, languages, instagram, service_location,
  cancellation_hours, deposit_required, deposit_pct,
  google_calendar_connected, auto_confirm_bookings, status, opening_hours,
  capacity, access_instructions, whatsapp, slug, staff_count,
  preferred_language, hours_confirmed_at, partner_need, booking_tools
) on public.partners to authenticated;

do $$
declare
  readable text[] := array[
      'id', 'business_name', 'email', 'phone', 'website', 'address',
      'address_line2', 'postal_code', 'city', 'country', 'description',
      'latitude', 'longitude', 'google_place_id', 'logo_url', 'cover_url',
      'gallery', 'amenities', 'languages', 'payment_methods', 'instagram',
      'timezone', 'currency', 'service_location', 'price_from',
      'cancellation_hours', 'cancellation_policy', 'deposit_required',
      'deposit_pct', 'google_calendar_connected', 'auto_confirm_bookings',
      'status', 'created_at', 'updated_at', 'opening_hours', 'capacity',
      'access_instructions', 'whatsapp', 'slug', 'booking_method',
      'google_rating', 'google_reviews', 'outreach_status',
      'outreach_email_at', 'staff_count', 'preferred_language',
      'hours_confirmed_at', 'neighbourhood', 'opted_out_at', 'venue_type',
      'match_boost', 'mc_discount_pct', 'booking_mode', 'booking_url',
      'partner_need', 'booking_tools'
    ];
  hidden text[] := array[
      'google_calendar_id', 'google_access_token', 'google_refresh_token',
      'google_token_expiry', 'claim_token', 'hours_token', 'hours_code',
      'vat_id', 'outreach_score', 'outreach_tier', 'outreach_hook',
      'followup_1_at', 'followup_2_at', 'booking_email',
      'mc_discount_confirmed_at', 'mc_discount_note', 'signup_asked_at',
      'fee_eur', 'fee_pct', 'billing_name', 'billing_tax_id',
      'billing_address', 'billing_email', 'call_ok', 'call_ok_at',
      'call_ok_note', 'call_phone', 'slots_link_v'
    ];
  writable text[] := array[
      'id', 'business_name', 'email', 'phone', 'website', 'address',
      'postal_code', 'city', 'country', 'description', 'latitude',
      'longitude', 'google_place_id', 'logo_url', 'cover_url', 'gallery',
      'amenities', 'languages', 'instagram', 'service_location',
      'cancellation_hours', 'deposit_required', 'deposit_pct',
      'google_calendar_connected', 'auto_confirm_bookings', 'status',
      'opening_hours', 'capacity', 'access_instructions', 'whatsapp',
      'slug', 'staff_count', 'preferred_language', 'hours_confirmed_at',
      'partner_need', 'booking_tools'
    ];
  c text;
  r text;
  f text;
begin
  -- Step 1 must be live, or the claim page, the calendar disconnect and
  -- /match break the moment the grants change.
  if to_regprocedure('public.claim_lookup(uuid)') is null
     or to_regprocedure('public.claim_release_verified(uuid)') is null
     or to_regprocedure('public.partner_disconnect_calendar()') is null
     or to_regclass('public.claim_reviews') is null then
    raise exception 'apply 20261124d_partners_claim_rpcs.sql first';
  end if;
  -- The slug must never turn into a claim token for the public key again.
  if to_regprocedure('public.claim_token_for_slug(text)') is not null then
    raise exception 'claim_token_for_slug exists: it gives out claim tokens, drop it';
  end if;
  if (select p.prosrc from pg_proc p
      where p.oid = to_regprocedure('public.match_studios(text,text,uuid,integer)')) ~ 'p\.\*' then
    raise exception 'match_studios still selects p.*: apply 20261124d_partners_claim_rpcs.sql first';
  end if;
  for c in
    select a.attname from pg_attribute a
    where a.attrelid = 'public.partners'::regclass and a.attnum > 0 and not a.attisdropped
  loop
    if not (c = any(readable) or c = any(hidden)) then
      raise exception 'partners.% is in neither list: classify it before applying', c;
    end if;
  end loop;
  foreach r in array array['anon', 'authenticated'] loop
    foreach c in array readable loop
      if not has_column_privilege(r, 'public.partners', c, 'SELECT') then
        raise exception '% cannot read partners.%', r, c;
      end if;
    end loop;
    foreach c in array hidden loop
      if has_column_privilege(r, 'public.partners', c, 'SELECT')
         or has_column_privilege(r, 'public.partners', c, 'UPDATE')
         or has_column_privilege(r, 'public.partners', c, 'INSERT') then
        raise exception '% still has access to partners.%', r, c;
      end if;
    end loop;
    if has_table_privilege(r, 'public.partners', 'DELETE')
       or has_table_privilege(r, 'public.partners', 'TRUNCATE') then
      raise exception '% can still delete from partners', r;
    end if;
  end loop;
  -- INSERT and UPDATE: exactly the writable list for authenticated, nothing
  -- for anon, on every live column.
  for c in
    select a.attname from pg_attribute a
    where a.attrelid = 'public.partners'::regclass and a.attnum > 0 and not a.attisdropped
  loop
    if c = any(writable) then
      if not has_column_privilege('authenticated', 'public.partners', c, 'UPDATE')
         or not has_column_privilege('authenticated', 'public.partners', c, 'INSERT') then
        raise exception 'authenticated cannot write partners.%', c;
      end if;
    elsif has_column_privilege('authenticated', 'public.partners', c, 'UPDATE')
       or has_column_privilege('authenticated', 'public.partners', c, 'INSERT') then
      raise exception 'authenticated can write partners.%, which is not in the writable list', c;
    end if;
    if has_column_privilege('anon', 'public.partners', c, 'UPDATE')
       or has_column_privilege('anon', 'public.partners', c, 'INSERT') then
      raise exception 'anon can write partners.%', c;
    end if;
  end loop;
  if has_column_privilege('authenticated', 'public.partners', 'outreach_status', 'UPDATE') then
    raise exception 'authenticated can still reset outreach_status';
  end if;
  -- PUBLIC (every role) must hold nothing on partners.
  if exists (select 1 from pg_class cl, aclexplode(cl.relacl) x
             where cl.oid = 'public.partners'::regclass and x.grantee = 0) then
    raise exception 'PUBLIC holds a privilege on partners';
  end if;
  if exists (select 1 from pg_attribute a, aclexplode(a.attacl) x
             where a.attrelid = 'public.partners'::regclass and x.grantee = 0) then
    raise exception 'PUBLIC holds a column privilege on partners';
  end if;
  -- Functions the public key must not run.
  foreach f in array array[
      'public.claim_release_prebuilt(uuid)', 'public.claim_release_verified(uuid)',
      'public.partner_disconnect_calendar()', 'public.claim_activate_partner(uuid,text,text)',
      'public.mc_cold_requests_digest()', 'public.mc_booking_link(text,text)'
    ] loop
    if to_regprocedure(f) is not null and has_function_privilege('anon', f, 'EXECUTE') then
      raise exception 'anon can execute %', f;
    end if;
  end loop;
  -- ...and the ones a signed-in studio must not run either.
  foreach f in array array[
      'public.claim_release_prebuilt(uuid)', 'public.claim_activate_partner(uuid,text,text)',
      'public.mc_cold_requests_digest()', 'public.mc_booking_link(text,text)'
    ] loop
    if to_regprocedure(f) is not null and has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'authenticated can execute %', f;
    end if;
  end loop;
  -- Parked claims are for Jordan only.
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'public.claim_reviews', 'SELECT')
       or has_table_privilege(r, 'public.claim_reviews', 'INSERT')
       or has_table_privilege(r, 'public.claim_reviews', 'UPDATE')
       or has_table_privilege(r, 'public.claim_reviews', 'DELETE') then
      raise exception '% has access to claim_reviews', r;
    end if;
  end loop;
  -- has_table_privilege with a list is true when ANY is held, so check each.
  foreach c in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not has_table_privilege('service_role', 'public.partners', c) then
      raise exception 'service_role lost % on partners', c;
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------------ DOWN
-- Run by hand only, to undo step 3. Puts back exactly today's privileges
-- (arwdDxtm for anon and authenticated; on Postgres 17 ALL includes
-- MAINTAIN). It does not drop the step 1 functions, because the site
-- calls them after step 2.
--
-- revoke all on table public.partners from anon, authenticated;
-- grant all on table public.partners to anon, authenticated;
-- notify pgrst, 'reload schema';
