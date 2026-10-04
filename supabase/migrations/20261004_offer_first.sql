-- Offer first (4 Oct, Jordan): "lead with an offer, not a questionnaire."
--
-- Two changes:
--
-- dispatch_candidates v4 (which studios get asked)
--   A reply is not a slot. Over 60 days KamAI Spa was asked 23 times, replied
--   4 times and offered nothing; Masajes Chamberí 14 asks, 0 offers; The Organic
--   Spa 12, 0. Calma Madrid Spa offered 13 times out of 21. The ranking rewarded
--   replies, so the studios that answer "no" kept being asked first. It now
--   also scores the share of asks that ended in a real offer (a time, a price,
--   an accept or a win), and rests a studio asked 4+ times that never offered.
--
-- offer_studios (what the customer is shown, then asked)
--   The bot now shows the customer two real studios with prices and asks the
--   one they tap. Those two must come from the same ranking that decides who
--   gets asked, otherwise we would offer a studio that never answers. This is
--   dispatch_candidates joined to each studio's best matching priced service.
--   `registered` tells the bot whether the price is the studio's own menu
--   (exact) or a placeholder listing (shown as "about").

CREATE OR REPLACE FUNCTION public.dispatch_candidates(p_area text DEFAULT NULL::text, p_want text DEFAULT NULL::text, p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, business_name text, area text, wa text, km numeric, fit boolean, rank integer, widened boolean, score numeric, registered boolean)
 LANGUAGE sql
 STABLE
AS $function$
with centre as (select lat, lon from mc_area_centre(p_area)),
terms as (select mc_want_terms(p_want) as t),
-- v3 (9 Sept, Jordan): sponsored placement. "anywhere", "me da igual" and a
-- blank area are the same answer: the customer has no location preference.
-- A quarter of all requests look like this. When there is no preference there
-- is no reason to send the request anywhere except the studios that signed up,
-- loaded a real menu and can be quoted at an exact price.
no_pref as (
  select (p_area is null or btrim(p_area) = ''
    or unaccent_simple(lower(p_area)) ~ '(anywhere|any where|somewhere|cualquier|donde sea|dondequiera|no importa|me da igual|flexible|^madrid$)') as v
),
base as (
  select p.id, p.business_name,
         coalesce(p.neighbourhood, p.city) as area,
         lower(coalesce(p.city, '')) as city_l,
         mc_wa_number(coalesce(p.whatsapp, p.phone)) as wa,
         p.google_rating, p.google_reviews, p.venue_type,
         coalesce(p.match_boost, 0) as boost,
         coalesce(p.outreach_status, '') as outreach,
         p.status as pstatus,
         (p.status = 'active'
          and (select count(*) from partner_services ms
               where ms.partner_id = p.id and ms.is_active and ms.price > 0) >= 5) as registered,
         lower(unaccent_simple(coalesce(p.business_name, '') || ' ' || coalesce(p.description, ''))) as haystack,
         mc_km(c.lat, c.lon, p.latitude, p.longitude) as km,
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.sent_at > now() - interval '24 hours') as asked_24h,
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.sent_at > now() - interval '12 hours') as asked_12h,
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.replied_at is not null) as replies_ever,
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.sent_at is not null) as asks_ever,
         -- v4: asks that ended in something bookable, not just an answer
         (select count(*) from request_dispatch d where d.partner_id = p.id and d.sent_at is not null
            and (d.offered_time is not null or d.quoted_price is not null or d.outcome in ('accepted', 'won'))) as offers_ever,
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
    (b.replies_ever > 0 or b.wins_ever > 0 or b.outreach in ('replied', 'claimed', 'interested') or b.pstatus = 'active') as warm,
    (b.asks_ever < 2 or (b.replies_ever::numeric / greatest(b.asks_ever, 1)) >= 0.4) as answers_ok
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
    -- answer rate, not answer count (8 Sept)
    + case when f.asks_ever >= 3 and f.replies_ever = 0 then -35
           when f.asks_ever >= 2 then ((f.replies_ever::numeric / f.asks_ever) * 22) - 6
           else 0 end
    -- v4 (4 Oct): offer rate. A studio that replies "no" every time is not a
    -- studio that books customers.
    + case when f.asks_ever >= 4 and f.offers_ever = 0 then -25
           when f.asks_ever >= 3 then (f.offers_ever::numeric / f.asks_ever) * 25
           else 0 end
    -- speed decides same-day bookings
    + case when f.avg_reply_min is null then 0
           when f.avg_reply_min <= 30 then 12
           when f.avg_reply_min <= 120 then 6
           when f.avg_reply_min >= 720 then -8
           else 0 end
    -- Sponsored placement, halved on 19 Sept (Jordan). A registered studio still
    -- leads a comparable one, but no longer outranks a fast one five to one.
    + case when not f.registered then 0
           when (select v from no_pref) and f.answers_ok then 30
           when (select v from no_pref) then 12
           when f.answers_ok then 15
           else 6 end
    + f.boost
    - f.asked_12h * 10
    as score
  from fitted f
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

CREATE OR REPLACE FUNCTION public.offer_studios(p_area text DEFAULT NULL::text, p_want text DEFAULT NULL::text, p_limit integer DEFAULT 3)
 RETURNS TABLE(id uuid, business_name text, slug text, area text, svc text, duration integer, price numeric, registered boolean, score numeric, km numeric)
 LANGUAGE sql
 STABLE
AS $function$
  with want as (
    select case
      when unaccent(lower(coalesce(p_want,''))) ~ '(deep tissue|descontracturante|profundo)' then 'deep'
      when unaccent(lower(coalesce(p_want,''))) ~ '(thai|tailand)'      then 'thai'
      when unaccent(lower(coalesce(p_want,''))) ~ '(sport|deportivo)'   then 'sport'
      when unaccent(lower(coalesce(p_want,''))) ~ '(hot stone|piedras)' then 'stone'
      when unaccent(lower(coalesce(p_want,''))) ~ '(relax|relajante|sueco|swedish)' then 'relax'
      else null end as kind
  ),
  cand as (select * from public.dispatch_candidates(p_area, p_want, 8)),
  svc as (
    select distinct on (s.partner_id) s.partner_id,
           coalesce(s.name_en, s.type, s.name, 'Massage') as svc,
           coalesce(s.duration, 60) as duration, s.price
    from partner_services s join cand c on c.id = s.partner_id
    where s.is_active and s.price > 0
    order by s.partner_id,
      (case when (select kind from want) is null then 0
            when unaccent(lower(coalesce(s.type,'') || ' ' || coalesce(s.name,'') || ' ' || coalesce(s.name_en,''))) like '%' || (select kind from want) || '%' then 0
            else 1 end),
      abs(coalesce(s.duration, 60) - 60), s.price
  )
  select c.id, p.business_name, p.slug, coalesce(p.neighbourhood, p.city, 'Madrid') as area,
         v.svc, v.duration::integer, v.price, c.registered, c.score, c.km
  from cand c
  join svc v on v.partner_id = c.id
  join partners p on p.id = c.id
  order by c.rank
  limit greatest(1, least(coalesce(p_limit, 3), 5));
$function$;
