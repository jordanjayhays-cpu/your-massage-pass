-- Spotlight for the three studios that actually signed up (8 Sept).
--
-- Sinergia38, Centro Aloha and Calma Madrid Spa are the only partners with
-- status = 'active' and their own priced menu loaded. Everyone else is a
-- scraped listing with a 12 row placeholder menu, so their prices are an
-- estimate and a booking with them can only be quoted as a range.
--
-- Two changes, applied to the live functions:
--
-- match_studios (what the customer is shown)
--   * returns `registered` and `discount_pct`
--   * the flat +15 for status = 'active' becomes +45 for a registered studio
--   * results order registered first, so the top pick is one of the three
--     wherever the customer's area allows it
--
-- dispatch_candidates (which studios get asked)
--   * returns `registered`
--   * +30 for a registered studio that answers (or has barely been asked),
--     +12 for one that does not, so Calma Madrid Spa at 1 reply in 6 does not
--     bury Centro Aloha at 3 in 3
--   * the 24h ask ceiling goes from 3 to 5 for registered studios only. Both
--     Sinergia38 and Calma Madrid Spa were being dropped from today's lists
--     entirely by the old cap. The 12h throttle (-10 per recent ask) is
--     unchanged and still spaces the asks out.
--
-- The definitions themselves were applied through the Supabase API; this file
-- is the record of what changed and why.

drop function if exists public.match_studios(text, text, uuid, integer);

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
    SELECT p.*,
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

grant execute on function public.match_studios(text, text, uuid, integer) to anon, authenticated, service_role;

drop function if exists public.dispatch_candidates(text, text, integer);

CREATE OR REPLACE FUNCTION public.dispatch_candidates(p_area text DEFAULT NULL::text, p_want text DEFAULT NULL::text, p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, business_name text, area text, wa text, km numeric, fit boolean, rank integer, widened boolean, score numeric, registered boolean)
 LANGUAGE sql
 STABLE
AS $function$
with centre as (select lat, lon from mc_area_centre(p_area)),
terms as (select mc_want_terms(p_want) as t),
base as (
  select p.id, p.business_name,
         coalesce(p.neighbourhood, p.city) as area,
         lower(coalesce(p.city, '')) as city_l,
         mc_wa_number(coalesce(p.whatsapp, p.phone)) as wa,
         p.google_rating, p.google_reviews, p.venue_type,
         coalesce(p.match_boost, 0) as boost,
         coalesce(p.outreach_status, '') as outreach,
         p.status as pstatus,
         -- Spotlight (8 Sept): signed up and loaded its own priced menu.
         (p.status = 'active'
          and (select count(*) from partner_services ms
               where ms.partner_id = p.id and ms.is_active and ms.price > 0) >= 5) as registered,
         lower(unaccent_simple(coalesce(p.business_name, '') || ' ' || coalesce(p.description, ''))) as haystack,
         mc_km(c.lat, c.lon, p.latitude, p.longitude) as km,
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.sent_at > now() - interval '24 hours') as asked_24h,
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.sent_at > now() - interval '12 hours') as asked_12h,
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.replied_at is not null) as replies_ever,
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.sent_at is not null) as asks_ever,
         (select avg(extract(epoch from (d.replied_at - d.sent_at))/60)
            from request_dispatch d where d.partner_id = p.id and d.replied_at is not null and d.sent_at is not null) as avg_reply_min,
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.outcome = 'won') as wins_ever
  from partners p cross join centre c
  where coalesce(p.status, '') <> 'suspended'
    and p.opted_out_at is null
    and coalesce(p.outreach_status, '') not in ('rejected', 'bounced', 'opted_out')
    and mc_wa_number(coalesce(p.whatsapp, p.phone)) is not null
),
fitted as (
  select b.*,
    (cardinality((select t from terms)) > 0
      and exists (select 1 from unnest((select t from terms)) as term where b.haystack like '%' || term || '%')) as fit,
    (b.replies_ever > 0 or b.wins_ever > 0 or b.outreach in ('replied', 'claimed', 'interested') or b.pstatus = 'active') as warm
  from base b
),
scored as (
  select f.*,
    case when p_area is null or btrim(p_area) = '' then 0
         when f.km is null then -25
         else greatest(-45, -1.9 * greatest(f.km - 1.5, 0)) end
    + (((coalesce(f.google_rating, 4.4) * coalesce(f.google_reviews, 0)) + (4.4 * 25))
       / (coalesce(f.google_reviews, 0) + 25) - 4.0) * 18
    + least(ln(coalesce(f.google_reviews, 0) + 1) * 3.0, 12)
    + least(f.replies_ever, 4) * 6
    + least(f.wins_ever, 3) * 8
    + case when f.warm then 15 when f.outreach = 'contacted' then 5 else 0 end
    + case when f.fit then 14 else 0 end
    + case when f.venue_type = 'spa' and (select t from terms) @> array['relax'] then 3
           when f.venue_type = 'clinic' and (select t from terms) @> array['deep'] then 3
           else 0 end
    -- v2 (8 Sept): answer rate, not answer count. 83 asks produced 29 replies.
    -- Sinergia38 answered 5 of 8 and Centro Aloha 3 of 3, while four studios sat
    -- at 1 in 6 or worse and still scored well because they had been asked often.
    -- Three asks with nothing back is a studio that does not want these.
    + case when f.asks_ever >= 3 and f.replies_ever = 0 then -35
           when f.asks_ever >= 2 then ((f.replies_ever::numeric / f.asks_ever) * 22) - 6
           else 0 end
    -- Speed decides same-day bookings. The average reply takes 6.5 hours.
    + case when f.avg_reply_min is null then 0
           when f.avg_reply_min <= 30 then 12
           when f.avg_reply_min <= 120 then 6
           when f.avg_reply_min >= 720 then -8
           else 0 end
    -- Spotlight (8 Sept): registered studios lead every ask, because only they
    -- can be quoted at an exact price. A registered studio that ignores the
    -- asks still gets the smaller nudge, not the full one, so we do not bury
    -- studios that actually answer under one that does not.
    + case when f.registered and (f.asks_ever < 2 or (f.replies_ever::numeric / greatest(f.asks_ever, 1)) >= 0.4) then 30
           when f.registered then 12
           else 0 end
    + f.boost
    - f.asked_12h * 10
    as score
  from fitted f
  -- A registered studio signed up to receive these, so its daily ceiling is
  -- higher. The 12h throttle above still spaces the asks out for everyone.
  where f.asked_24h < (case when f.registered then 5 else 3 end)
    and (p_area is null or btrim(p_area) = ''
      or (f.km is not null and f.km <= 12)
      or (f.km is null and (f.area ilike '%' || p_area || '%' or f.city_l like '%madrid%')))
),
capped as (
  select s.*, row_number() over (partition by s.warm order by s.score desc, s.business_name) as cold_rank
  from scored s
)
select c.id, c.business_name, c.area, c.wa, c.km, c.fit,
       (row_number() over (order by c.score desc, c.business_name))::integer as rank,
       (p_area is not null and btrim(p_area) <> '' and coalesce(c.km, 99) > 2.5) as widened,
       round(c.score::numeric, 1) as score,
       c.registered
from capped c
where c.warm or c.cold_rank <= 2
order by c.score desc, c.business_name
limit greatest(1, least(coalesce(p_limit, 5), 12));
$function$;

grant execute on function public.dispatch_candidates(text, text, integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- v3, 9 September (Jordan): sponsored placement when location is open.
--
-- "anywhere", "me da igual" and a blank area are the same answer: the customer
-- has no location preference. That is 12 of the last 47 requests, a quarter of
-- everything. When nobody has named a neighbourhood there is no reason to send
-- the request anywhere except the studios that signed up, loaded a real menu
-- and can be quoted at an exact price.
--
-- The registered bonus in dispatch_candidates becomes:
--   no area named, and the studio answers   +60
--   no area named, and it does not          +25
--   area named, and it answers              +30
--   area named, and it does not             +12
--
-- Being signed up never outranks actually replying, or we bury the studios
-- doing the work. With no area named the three partners take ranks 1, 2 and 3.
-- With an area named they still lead but do not monopolise: a strong local
-- studio can still come second.
--
-- Applied through the Supabase API; this is the record of the change.
