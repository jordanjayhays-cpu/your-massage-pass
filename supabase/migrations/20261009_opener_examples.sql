-- wa-bot v188: the first message quotes the real listed 60 min relaxing price
-- range and areas of the studios that actually answer us (said yes at least
-- once), instead of a fixed "45 to 60 EUR". Studio names are never shown before
-- the offer (facts.md rule 12); the bot only uses areas and prices from here.
drop function if exists public.opener_examples(integer);
create or replace function public.opener_examples(p_limit integer default 12)
returns table(id uuid, business_name text, area text, price numeric, opening_hours text, yeses integer, address text)
language sql stable security definer set search_path = public as $$
  with relax as (
    select s.partner_id, min(s.price) price
    from partner_services s
    where s.is_active and s.price >= 30 and s.duration between 50 and 70
      and lower(coalesce(s.type,'') || ' ' || coalesce(s.name,'') || ' ' || coalesce(s.name_en,'')) ~ '(relax|relaj|sueco|swedish|californ)'
    group by 1
  ), yes as (
    select partner_id, count(*)::int n from request_dispatch where offered_time is not null group by 1
  )
  select p.id, p.business_name, p.neighbourhood, r.price, coalesce(p.opening_hours #>> '{}', ''), coalesce(y.n, 0), coalesce(p.address, '')
  from partners p
  join relax r on r.partner_id = p.id
  left join yes y on y.partner_id = p.id
  where p.status in ('active','pending') and p.opted_out_at is null
    and coalesce(p.neighbourhood,'') <> ''
  order by (coalesce(y.n,0) > 0) desc, r.price, coalesce(y.n,0) desc
  limit p_limit;
$$;
revoke execute on function public.opener_examples(integer) from public, anon, authenticated;
grant execute on function public.opener_examples(integer) to service_role;
