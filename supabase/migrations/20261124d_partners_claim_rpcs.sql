-- DRAFT, NOT APPLIED. Step 1 of 3 of the partners lock (Jordan, 24 Nov:
-- "Yes, close it now"; "I prepare the full fix and show you").
--
-- Order (each step is checked on the live site before the next):
--   1. this file: additive only, nothing changes for anyone yet. It must be
--      live BEFORE step 2 ships: the new site calls these functions, so the
--      claim page and the calendar disconnect fail (404) without them.
--   2. the site stops reading the hidden columns (explicit column lists,
--      these RPCs instead of .eq("claim_token", ...)); ship to main, check live
--   3. 20261124e_partners_column_lock.sql: the grants (it refuses to run
--      until this file is live)
--
-- Why each piece:
--   * claim_lookup: the claim page (/studio-setup?claim=<token>) read the
--     whole partners row by claim_token with the public key. After the lock
--     the public key cannot filter on claim_token, so the page asks this
--     function, which returns only the fields the page shows.
--   * claim_token_for_slug: /claim/<slug> (the link the approved
--     lead-to-studio email sends) turned the public slug into the claim
--     token with a plain select. It keeps working through this function, for
--     pending studios only. This is the SAME exposure as today, one slug at a
--     time: the slug is still the claim credential. It is temporary; the
--     proof-of-control claim (S0-3: emailed code, claim-start/claim-finish)
--     replaces it and drops this function.
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

-- ------------------------------------------------------- claim_token_for_slug
create or replace function public.claim_token_for_slug(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- Pending studios only: an active studio's link now shows the page's
  -- existing "already claimed, log in" message instead of its token.
  select p.claim_token
  from public.partners p
  where p_slug is not null and p_slug <> ''
    and p.slug = p_slug
    and p.status = 'pending'
  limit 1;
$$;

revoke all on function public.claim_token_for_slug(text) from public, anon, authenticated;
grant execute on function public.claim_token_for_slug(text) to anon, authenticated, service_role;

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
-- site (after step 2) calls claim_lookup, claim_token_for_slug and
-- partner_disconnect_calendar, so dropping them breaks the claim page and
-- the calendar disconnect. Roll back step 2 (the site) first.
--
-- drop function if exists public.claim_lookup(uuid);
-- drop function if exists public.claim_token_for_slug(text);
-- drop function if exists public.partner_disconnect_calendar();
-- notify pgrst, 'reload schema';
--
-- match_studios needs no rollback: the explicit-column body returns the same
-- rows as the p.* body. To restore the old text exactly, re-run the
-- CREATE OR REPLACE FUNCTION public.match_studios block from
-- supabase/migrations/20260908_registered_studio_spotlight.sql.
