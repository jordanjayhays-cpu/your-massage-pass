-- DRAFT, NOT APPLIED. Step 1 of 3 of the partners lock (Jordan, 24 Nov:
-- "Yes, close it now"; "I prepare the full fix and show you").
--
-- Order (each step is checked on the live site before the next):
--   1. this file. It must be live BEFORE step 2 ships: the new site calls
--      these functions, so the claim page and the calendar disconnect fail
--      (PGRST202, function not found) without them. It is safe with today's
--      site: the only change today's site can notice is that its claim
--      cleanup call (claim_release_prebuilt) is refused, and that call's
--      error is ignored, so a claim made in the gap simply waits in
--      claim_reviews for Jordan (see below).
--   2. the site stops reading the hidden columns (explicit column lists,
--      these RPCs instead of .eq("claim_token", ...)); ship to main, check live
--   3. 20261124e_partners_column_lock.sql: the grants (it refuses to run
--      until this file is live)
--
-- Why each piece:
--   * claim_lookup: the claim page (/studio-setup?claim=<token>, the old
--      link shape) read the whole partners row by claim_token with the
--      public key. After the lock the public key cannot filter on
--      claim_token, so the page asks this function, which returns only the
--      fields the page shows and never the token.
--   * No slug-to-token lookup. /claim/<slug> (the link the approved
--      lead-to-studio email sends) used to turn the public slug into the
--      claim token. Now it opens /studio-setup?claim_slug=<slug> and the page
--      reads the studio's public fields by slug. The token is never sent to
--      a browser, and it is no longer needed for anything: claiming is
--      decided by claim_release_verified below.
--   * claim_release_verified replaces claim_release_prebuilt for signed-in
--      studios. The reason: every claim token was readable with the public
--      key until the lock, and slugs are public, so a token proves nothing.
--      Anyone could sign up, call claim_release_prebuilt and take over a
--      pending studio's page (its slug moves to the caller's row, with the
--      caller's own WhatsApp and email). Now the pending row is merged into
--      the caller's row only when the caller proved control of the email
--      already on file for that studio: the account email equals it, is
--      confirmed, the account has no password, and this session signed in
--      with Google (JWT amr oauth). Why so strict (fresh review, 24 Nov):
--      mailer_autoconfirm is on live, so anyone can pre-register a studio's
--      email with a password, and the real studio's later magic link or
--      Google sign-in lands in that account; GoTrue also gives magic-link
--      sign-ups a random password, so no emailed link proves anything. Any
--      other claim still saves the studio's own row as today, but the
--      merge waits in public.claim_reviews for Jordan, who merges by hand
--      only with proof from outside the site (a WhatsApp from the studio's
--      number on file): a parked row whose email matches proves nothing.
--      The proper emailed-code claim (design S0-3, claim-start/claim-finish)
--      replaces this later.
--   * claim_release_prebuilt: service role only from here (the design's
--      S0-4 accept test: a studio JWT calling it is denied).
--   * partner_disconnect_calendar: the "Disconnect" button on
--     /partner/connect-calendar wiped the studio's own Google tokens with a
--     plain update. After the lock a studio cannot write (or read) those
--     columns, and leaving the tokens behind would keep a Google grant the
--     studio asked us to drop. This function does the same wipe for the
--     caller's own row only (auth.uid()), signed-in callers only.
--   * match_studios: SECURITY INVOKER and called with the public key by
--     /match (MatchFlow). It selected p.*, which fails for anon once any
--     column is hidden. Same body as live (20260908_registered_studio_
--     spotlight.sql, md5 of the live prosrc checked 24 Nov), with p.* replaced
--     by the 14 columns it actually uses. Results are unchanged.

-- ---------------------------------------------------------------- claim_lookup
create or replace function public.claim_lookup(p_claim_token uuid)
returns table (
  id uuid,
  business_name text,
  email text,
  address text,
  phone text,
  website text,
  description text,
  city text,
  access_instructions text,
  preferred_language text,
  status text,
  slug text,
  opening_hours jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Same rows the public key could see by token before: pending or active.
  select p.id, p.business_name, p.email, p.address, p.phone, p.website,
         p.description, p.city, p.access_instructions, p.preferred_language,
         p.status, p.slug, p.opening_hours
  from public.partners p
  where p_claim_token is not null
    and p.claim_token = p_claim_token
    and p.status in ('pending', 'active')
  limit 1;
$$;

revoke all on function public.claim_lookup(uuid) from public, anon, authenticated;
grant execute on function public.claim_lookup(uuid) to anon, authenticated, service_role;

-- ------------------------------------------- no slug-to-token lookup, ever
-- An earlier draft of this file created claim_token_for_slug(text), which
-- handed any pending studio's claim token to the public key. It was never
-- applied live; drop it in case a branch or local database has it.
drop function if exists public.claim_token_for_slug(text);

-- ------------------------------------------------ partner_disconnect_calendar
create or replace function public.partner_disconnect_calendar()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  -- The caller's own row only; a null auth.uid() (public key) matches nothing.
  update public.partners
     set google_calendar_connected = false,
         google_access_token = null,
         google_refresh_token = null,
         google_token_expiry = null,
         google_calendar_id = null
   where id = auth.uid();
$$;

revoke all on function public.partner_disconnect_calendar() from public, anon, authenticated;
grant execute on function public.partner_disconnect_calendar() to authenticated, service_role;

-- --------------------------------------------------------------- claim_reviews
-- Claims that could not be merged automatically. Jordan (service role) reads
-- this table and merges by hand. Nobody else can read or write it: RLS on,
-- no policy, no grant to the public key or to signed-in users. One row per
-- (claimer, studio); no emails are copied here, both rows are in partners.
create table if not exists public.claim_reviews (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  claimer_id uuid not null,   -- the signed-in studio's own partners row (auth uid)
  prebuilt_id uuid not null,  -- the pending studio row it asked to take over
  reason text not null,       -- no_email_on_file | email_mismatch | password_account | sign_in_method
  resolved_at timestamptz,
  unique (claimer_id, prebuilt_id)
);
alter table public.claim_reviews enable row level security;
revoke all on table public.claim_reviews from public, anon, authenticated;
grant all on table public.claim_reviews to service_role;

-- ------------------------------------------------------ claim_release_verified
-- Returns what happened, for the page and for logs:
--   released        the pending row was merged into the caller's row
--   needs_review    parked in claim_reviews for Jordan (proof missing)
--   not_found       no pending studio with that id (or it is the caller)
--   no_own_row      the caller has not saved its own studio row yet
--   already_claimed this account already took over a studio (one per account)
--   not_signed_in   no JWT
-- The merge itself is the live 24 Nov stopgap body (20261124c), unchanged:
-- note it deletes the pending row, so ON DELETE CASCADE also removes that
-- row's reviews, request_dispatch rows and released slots, as it does live.
create or replace function public.claim_release_verified(p_prebuilt uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  amr jsonb;
  my_email text;
  pre_email text;
  reason text;
  pre public.partners%rowtype;
begin
  if uid is null then return 'not_signed_in'; end if;
  if p_prebuilt is null or p_prebuilt = uid then return 'not_found'; end if;

  -- The caller's own row must exist; lock it so two parallel calls cannot
  -- both pass the one-release-per-account guard.
  perform 1 from public.partners where id = uid for update;
  if not found then return 'no_own_row'; end if;
  if exists (select 1 from public.partners where id = uid and outreach_status = 'claimed') then
    return 'already_claimed';
  end if;

  select * into pre from public.partners p
   where p.id = p_prebuilt and p.status = 'pending'
   for update;
  if pre.id is null then return 'not_found'; end if;

  -- Proof of control of the email already on file for the pending studio.
  pre_email := lower(btrim(coalesce(pre.email, '')));
  select lower(btrim(u.email)) into my_email
    from auth.users u
   where u.id = uid and u.email_confirmed_at is not null;
  amr := case when jsonb_typeof(claims -> 'amr') = 'array' then claims -> 'amr' else '[]'::jsonb end;

  if pre_email = '' then
    reason := 'no_email_on_file';
  elsif my_email is null or my_email <> pre_email then
    reason := 'email_mismatch';
  elsif exists (select 1 from auth.users u
                 where u.id = uid and coalesce(u.encrypted_password, '') <> '') then
    -- Under mailer_autoconfirm anyone can pre-register a studio's email with
    -- a password; the real studio's later magic link or Google sign-in then
    -- lands in that account. GoTrue gives magic-link sign-ups a random
    -- password too, so only a Google-only account merges automatically.
    reason := 'password_account';
  elsif not exists (
    select 1 from jsonb_array_elements(amr) a
     where coalesce(a ->> 'method', a #>> '{}') = 'oauth'
  ) then
    reason := 'sign_in_method';
  end if;

  if reason is not null then
    insert into public.claim_reviews (claimer_id, prebuilt_id, reason)
    values (uid, pre.id, reason)
    on conflict (claimer_id, prebuilt_id) do update
       set reason = excluded.reason, created_at = now()
     where public.claim_reviews.resolved_at is null;
    return 'needs_review';
  end if;

  delete from public.partner_services where partner_id = pre.id;
  delete from public.partner_availability where partner_id = pre.id;
  delete from public.partners where id = pre.id;

  update public.partners set
    slug              = coalesce(slug, pre.slug),
    whatsapp          = coalesce(whatsapp, pre.whatsapp),
    phone             = coalesce(phone, pre.phone),
    opening_hours     = coalesce(opening_hours, pre.opening_hours),
    google_rating     = coalesce(google_rating, pre.google_rating),
    google_reviews    = coalesce(google_reviews, pre.google_reviews),
    outreach_email_at = coalesce(outreach_email_at, pre.outreach_email_at),
    -- keep the studio on the map and in neighbourhood filters after claiming
    latitude          = coalesce(latitude, pre.latitude),
    longitude         = coalesce(longitude, pre.longitude),
    google_place_id   = coalesce(google_place_id, pre.google_place_id),
    neighbourhood     = coalesce(neighbourhood, pre.neighbourhood),
    postal_code       = coalesce(postal_code, pre.postal_code),
    price_from        = coalesce(price_from, pre.price_from),
    hours_token       = coalesce(hours_token, pre.hours_token),
    hours_code        = coalesce(hours_code, pre.hours_code),
    outreach_status   = 'claimed',
    updated_at        = now()
  where id = uid;

  update public.claim_reviews set resolved_at = now()
   where claimer_id = uid and prebuilt_id = pre.id and resolved_at is null;
  return 'released';
end;
$$;

revoke all on function public.claim_release_verified(uuid) from public, anon, authenticated;
grant execute on function public.claim_release_verified(uuid) to authenticated, service_role;

-- ------------------------------------------------- claim_release_prebuilt
-- The live stopgap (20261124c) lets any signed-in account call it with a
-- token. Tokens were public, so: service role only from now on. Also pin
-- pg_temp last on its search_path (it was searched first for tables).
revoke execute on function public.claim_release_prebuilt(uuid) from public, anon, authenticated;
grant execute on function public.claim_release_prebuilt(uuid) to service_role;
alter function public.claim_release_prebuilt(uuid) set search_path = public, pg_temp;

-- --------------------------------------------- match_studios, explicit columns
-- create or replace keeps the existing owner and EXECUTE grants.
CREATE OR REPLACE FUNCTION public.match_studios(p_area text DEFAULT NULL::text, p_want text DEFAULT NULL::text, p_exclude uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 3)
 RETURNS TABLE(id uuid, business_name text, slug text, area text, google_rating numeric, google_reviews integer, venue_type text, wa text, svc text, duration integer, price numeric, registered boolean, discount_pct integer)
 LANGUAGE sql
 STABLE
AS $function$
  WITH want AS (
    SELECT CASE
      WHEN unaccent(lower(coalesce(p_want,''))) ~ '(deep tissue|descontracturante|profundo)' THEN 'deep'
      WHEN unaccent(lower(coalesce(p_want,''))) ~ '(thai|tailand)'      THEN 'thai'
      WHEN unaccent(lower(coalesce(p_want,''))) ~ '(sport|deportivo)'   THEN 'sport'
      WHEN unaccent(lower(coalesce(p_want,''))) ~ '(hot stone|piedras)' THEN 'stone'
      WHEN unaccent(lower(coalesce(p_want,''))) ~ '(shiatsu)'           THEN 'shiatsu'
      WHEN unaccent(lower(coalesce(p_want,''))) ~ '(balines|balinese)'  THEN 'balines'
      WHEN unaccent(lower(coalesce(p_want,''))) ~ '(reflexolog)'        THEN 'reflex'
      WHEN unaccent(lower(coalesce(p_want,''))) ~ '(linfatic|lymph|drenaje)' THEN 'linfatic'
      WHEN unaccent(lower(coalesce(p_want,''))) ~ '(relax|relajante|sueco|swedish)' THEN 'relax'
      ELSE NULL END AS kind
  ),
  conf AS (
    SELECT r.partner_id, count(*)::int AS confirmed
    FROM whatsapp_requests r
    WHERE r.stage = 'confirmed' AND r.partner_id IS NOT NULL
    GROUP BY r.partner_id
  ),
  cand AS (
    SELECT p.id, p.business_name, p.slug, p.neighbourhood, p.city, p.status,
           p.email, p.whatsapp, p.phone, p.venue_type, p.google_rating,
           p.google_reviews, p.match_boost, p.mc_discount_pct,
           row_number() OVER (
             PARTITION BY p.id
             ORDER BY (CASE WHEN (SELECT kind FROM want) IS NULL THEN 0
                            WHEN unaccent(lower(coalesce(s.type,'')||' '||coalesce(s.name,'')||' '||coalesce(s.name_en,'')))
                                 LIKE '%'||(SELECT kind FROM want)||'%' THEN 0 ELSE 1 END),
                      s.price ASC
           ) AS rn,
           s.name_en, s.type AS s_type, s.name AS s_name, s.duration AS s_duration, s.price AS s_price,
           (CASE WHEN (SELECT kind FROM want) IS NULL THEN true
                 WHEN unaccent(lower(coalesce(s.type,'')||' '||coalesce(s.name,'')||' '||coalesce(s.name_en,'')))
                      LIKE '%'||(SELECT kind FROM want)||'%' THEN true ELSE false END) AS type_match,
           -- Spotlight (8 Sept): a studio that signed up and loaded its own menu.
           -- Only these can be quoted at an exact price, so they lead the list.
           (p.status = 'active'
            AND (SELECT count(*) FROM partner_services ms
                 WHERE ms.partner_id = p.id AND ms.is_active AND ms.price > 0) >= 5) AS is_registered
    FROM partners p
    JOIN partner_services s ON s.partner_id = p.id AND s.is_active AND s.price > 0
    WHERE p.opted_out_at IS NULL
      AND mc_wa_number(coalesce(p.whatsapp, p.phone)) IS NOT NULL
      AND coalesce(p.status, 'pending') <> 'suspended'
      AND (p_exclude IS NULL OR p.id <> p_exclude)
      AND (p_area IS NULL OR p_area = ''
           -- "anywhere" answers: treat as all of Madrid
           OR unaccent(lower(p_area)) ~ '(somewhere|anywhere|any where|\many\M|cualquier|donde sea|dondequiera|no importa|me da igual|flexible|you choose|elige|surprise)'
           OR p.neighbourhood ILIKE '%'||p_area||'%' OR p.city ILIKE '%'||p_area||'%')
  ),
  scored AS (
    SELECT c.*, coalesce(cf.confirmed, 0) AS confirmed_ct,
      (
        (CASE c.venue_type WHEN 'massage' THEN 20 WHEN 'spa' THEN 12 WHEN 'clinic' THEN 6 ELSE 0 END)
        + (CASE WHEN (SELECT kind FROM want) IS NULL THEN 15 WHEN c.type_match THEN 30 ELSE 0 END)
        + greatest(least(((coalesce(c.google_rating, 4.2) * coalesce(c.google_reviews, 0) + 4.4 * 25)
                          / (coalesce(c.google_reviews, 0) + 25) - 3.8) * 20, 16), -16)
        + least(ln(coalesce(c.google_reviews, 0) + 1) * 2.2, 12)
        -- was a flat +15 for status = 'active'
        + (CASE WHEN c.is_registered THEN 45 WHEN c.status = 'active' THEN 15 ELSE 0 END)
        + (CASE WHEN coalesce(c.email,'') <> '' OR coalesce(c.whatsapp,'') <> '' THEN 6 ELSE 0 END)
        + least(coalesce(cf.confirmed, 0) * 10, 20)
        + coalesce(c.match_boost, 0)
      ) AS score
    FROM cand c
    LEFT JOIN conf cf ON cf.partner_id = c.id
    WHERE c.rn = 1
  )
  SELECT sc.id, sc.business_name, sc.slug,
         coalesce(sc.neighbourhood, sc.city, 'Madrid') AS area,
         sc.google_rating, sc.google_reviews, sc.venue_type,
         coalesce(sc.whatsapp, sc.phone) AS wa,
         coalesce(sc.name_en, sc.s_type, sc.s_name, 'Massage') AS svc,
         coalesce(sc.s_duration, 60) AS duration, sc.s_price AS price,
         sc.is_registered AS registered,
         sc.mc_discount_pct AS discount_pct
  FROM scored sc
  ORDER BY sc.is_registered DESC, sc.score DESC, coalesce(sc.google_reviews, 0) DESC
  LIMIT p_limit;
$function$;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------------ DOWN
-- Run by hand only, and only while step 3 (20261124e) is NOT applied: the
-- site (after step 2) calls claim_lookup, claim_release_verified and
-- partner_disconnect_calendar, so dropping them breaks the claim page and
-- the calendar disconnect. Roll back step 2 (the site) first. Read
-- claim_reviews before dropping it: unresolved rows are claims Jordan still
-- has to merge.
--
-- drop function if exists public.claim_lookup(uuid);
-- drop function if exists public.claim_release_verified(uuid);
-- drop function if exists public.partner_disconnect_calendar();
-- drop table if exists public.claim_reviews;
-- -- claim_release_prebuilt back to the live stopgap grants and search_path:
-- revoke execute on function public.claim_release_prebuilt(uuid) from public, anon;
-- grant execute on function public.claim_release_prebuilt(uuid) to authenticated, service_role;
-- alter function public.claim_release_prebuilt(uuid) set search_path = public;
-- notify pgrst, 'reload schema';
--
-- match_studios needs no rollback: the explicit-column body returns the same
-- rows as the p.* body. To restore the old text exactly, re-run the
-- CREATE OR REPLACE FUNCTION public.match_studios block from
-- supabase/migrations/20260908_registered_studio_spotlight.sql.
