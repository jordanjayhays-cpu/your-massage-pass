-- Released slots (17 Oct 2026). Jordan: "We need more studios to give us times".
--
-- A studio gives Massage Club a specific free time in advance (the 12 Oct
-- PRE-RELEASED SLOTS rule in CLAUDE.md). That release counts as the studio's
-- tap: a customer's tap on that time books it, the studio gets the written
-- confirmation at once and may reject it within 15 minutes. Every other path
-- still needs BOTH PARTIES TAP.
--
-- This file only adds storage and the functions that move a slot between
-- states. Nothing here sends anything. Customers only ever see a released time
-- through wa-bot, and only when app_secrets RELEASED is 'test' (test contacts,
-- test studios) or 'on'. With RELEASED off or missing nothing reads this table.
--
-- Safe to apply more than once.

create table if not exists public.released_slots (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  -- Two treatment rooms free at 18:00 are two rows, seat 1 and seat 2.
  seat            smallint not null default 1 check (seat between 1 and 20),
  -- mc_want_terms vocabulary ('relax', 'deep', ...); null is any massage the
  -- studio normally does for that length.
  service         text,
  -- Only a price the studio typed itself. Never invented, never a listing.
  price_eur       numeric(8,2) check (price_eur is null or price_eur between 1 and 500),
  -- Only a discount the studio gave in writing (5 Sept rule).
  discount_pct    smallint check (discount_pct is null or discount_pct between 1 and 50),
  status          text not null default 'released'
                  check (status in ('released', 'held', 'booked', 'rejected', 'withdrawn', 'expired')),
  -- instant: the release is the studio's tap (12 Oct rule). ask: a time we
  -- only believe is free (a synced calendar the studio has not agreed counts
  -- as a release); it can shape an ask, never book anything.
  confirm_mode    text not null default 'instant' check (confirm_mode in ('instant', 'ask')),
  source          text not null check (source in
                  ('studio_link', 'whatsapp_poll', 'ops_page', 'google_calendar', 'acuity', 'simplybook', 'ical')),
  source_ref      text,                -- external id, for idempotent syncs
  evidence        text,                -- the studio's own words or where they came from; required for ops_page and whatsapp_poll
  released_at     timestamptz not null default now(),
  expires_at      timestamptz not null, -- start_at - 60 min: 15 to reject, 45 of notice for the customer
  held_by_phone   text,
  held_request_id bigint,
  held_until      timestamptz,
  request_id      bigint,              -- whatsapp_requests.id once booked (kept after a reject, for the record)
  -- The customer's phone (digits) that booked it. One customer cannot book two
  -- released times at once (review, 17 Oct): two taps handled side by side.
  booked_phone    text,
  booked_at       timestamptz,
  reject_until    timestamptz,
  rejected_at     timestamptz,
  reject_note     text,
  -- Set here from the studio's name, never by a caller: "ZZ Prueba Massage
  -- Club" and "Aurora Test Studio" are test studios. Test customers only ever
  -- see test slots and real customers only ever see real ones.
  is_test         boolean not null default false,
  updated_at      timestamptz not null default now(),
  constraint released_slots_span check (end_at > start_at),
  constraint released_slots_held check (status <> 'held' or held_until is not null),
  constraint released_slots_booked check (status <> 'booked' or (request_id is not null and booked_at is not null and reject_until is not null))
);

-- A studio cannot release the same start on the same seat twice while it is live.
create unique index if not exists released_slots_live_seat
  on public.released_slots (partner_id, start_at, seat)
  where status in ('released', 'held', 'booked');
-- One request books at most one slot, and so one slot is never booked by two
-- requests through the same request either.
create unique index if not exists released_slots_one_booking
  on public.released_slots (request_id)
  where status = 'booked';
-- Idempotent syncs (step 7).
create unique index if not exists released_slots_source_ref
  on public.released_slots (partner_id, source, source_ref)
  where source_ref is not null and status in ('released', 'held', 'booked');
-- Re-applying over a copy from before the review adds the column.
alter table public.released_slots add column if not exists booked_phone text;
create index if not exists released_slots_open on public.released_slots (start_at) where status = 'released';
create index if not exists released_slots_held_phone on public.released_slots (held_by_phone) where status = 'held';
create index if not exists released_slots_booked_phone on public.released_slots (booked_phone) where status = 'booked';
create index if not exists released_slots_partner on public.released_slots (partner_id, start_at);

-- Service role only: no policies, nothing for anon or signed-in users. The
-- studio page and the bot both go through wa-bot with the service key.
alter table public.released_slots enable row level security;
revoke all on public.released_slots from public, anon, authenticated;
grant all on public.released_slots to service_role;

-- The offer a released slot becomes (channel 'released').
alter table public.request_dispatch add column if not exists slot_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'request_dispatch_slot_id_fkey') then
    alter table public.request_dispatch
      add constraint request_dispatch_slot_id_fkey foreign key (slot_id) references public.released_slots(id) on delete set null;
  end if;
end $$;
create index if not exists request_dispatch_slot on public.request_dispatch (slot_id) where slot_id is not null;

-- The studio's free-times link is signed over (partner id, slots_link_v).
-- Bumping the number revokes every link sent before. Nothing secret is stored.
alter table public.partners add column if not exists slots_link_v int not null default 1;

-- ---------------------------------------------------------------------------
-- State changes. Every one is a single conditional UPDATE: the row's status in
-- the WHERE is the guard, so two callers can never both win.
-- ---------------------------------------------------------------------------

-- Release times. p_rows: [{start_at, end_at, seat?, price_eur?, discount_pct?,
-- service?, source_ref?}]. Rows that are too soon (under 60 minutes away), too
-- far (8 days), too long (3 hours), out of range, or already live are skipped,
-- not errors; the caller compares what came back with what it sent. At most
-- 40 rows a call and 200 live slots a studio.
-- p_since (review, 17 Oct): when the studio's page was drawn. A start and
-- seat that has any row created or changed since then is skipped, whatever
-- its status, so reloading a save link (Back, a reload, a phone restoring the
-- tab) never puts back a time the studio has rejected or removed since. A
-- time marked again from a freshly drawn page is saved as usual.
-- A row whose source_ref is already live for this studio and source is
-- skipped too, so one moved calendar event cannot abort the whole batch.
-- The signature gained p_since: the four-argument version is dropped first so
-- that re-applying never leaves two overloads.
drop function if exists public.release_slots(uuid, jsonb, text, text);
create or replace function public.release_slots(p_partner uuid, p_rows jsonb, p_source text, p_evidence text default null, p_since timestamptz default null)
returns setof public.released_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_test boolean;
  v_room int;
begin
  if p_source is null or p_source not in ('studio_link', 'whatsapp_poll', 'ops_page', 'google_calendar', 'acuity', 'simplybook', 'ical') then
    raise exception 'release_slots: unknown source %', p_source;
  end if;
  if p_source in ('ops_page', 'whatsapp_poll') and coalesce(btrim(p_evidence), '') = '' then
    raise exception 'release_slots: a % release needs evidence', p_source;
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return;
  end if;
  if jsonb_array_length(p_rows) > 40 then
    raise exception 'release_slots: at most 40 rows per call';
  end if;
  select business_name into v_name
    from partners
   where id = p_partner and opted_out_at is null and coalesce(status, '') <> 'suspended';
  if not found then
    raise exception 'release_slots: no such studio, or it has opted out or is suspended';
  end if;
  v_test := coalesce(v_name, '') ~* '\m(test|prueba)\M';
  -- One release at a time per studio, so the 200 cap holds.
  perform pg_advisory_xact_lock(hashtextextended('released:' || p_partner::text, 0));
  select greatest(0, 200 - count(*))::int into v_room
    from released_slots
   where partner_id = p_partner and status in ('released', 'held', 'booked') and end_at > now();
  return query
  with r as (
    select (x->>'start_at')::timestamptz as start_at,
           (x->>'end_at')::timestamptz as end_at,
           coalesce(nullif(x->>'seat', '')::smallint, 1::smallint) as seat,
           nullif(btrim(x->>'service'), '') as service,
           nullif(x->>'price_eur', '')::numeric as price_eur,
           nullif(x->>'discount_pct', '')::smallint as discount_pct,
           nullif(btrim(x->>'source_ref'), '') as source_ref
      from jsonb_array_elements(p_rows) x
  ), ok as (
    select distinct on (r.start_at, r.seat) r.*
      from r
     where r.start_at is not null and r.end_at > r.start_at
       and r.end_at - r.start_at <= interval '180 minutes'
       and r.start_at >= now() + interval '60 minutes'
       and r.start_at < now() + interval '8 days'
       and r.seat between 1 and 20
       and (r.price_eur is null or r.price_eur between 1 and 500)
       and (r.discount_pct is null or r.discount_pct between 1 and 50)
       and (p_since is null or not exists (
             select 1 from released_slots o
              where o.partner_id = p_partner and o.start_at = r.start_at and o.seat = r.seat
                and greatest(o.released_at, o.updated_at) >= p_since))
       and (r.source_ref is null or not exists (
             select 1 from released_slots o
              where o.partner_id = p_partner and o.source = p_source and o.source_ref = r.source_ref
                and o.status in ('released', 'held', 'booked')))
     order by r.start_at, r.seat
     limit v_room
  ), ins as (
    insert into released_slots (partner_id, start_at, end_at, seat, service, price_eur, discount_pct, status,
                                confirm_mode, source, source_ref, evidence, expires_at, is_test)
    select p_partner, ok.start_at, ok.end_at, ok.seat, ok.service, ok.price_eur, ok.discount_pct, 'released',
           case when p_source in ('studio_link', 'whatsapp_poll', 'ops_page') then 'instant' else 'ask' end,
           p_source, ok.source_ref, left(p_evidence, 2000), ok.start_at - interval '60 minutes', v_test
      from ok
    on conflict (partner_id, start_at, seat) where status in ('released', 'held', 'booked') do nothing
    returning *
  )
  select * from ins;
end;
$$;

-- A customer has tapped this time and is finishing (their name, the readback).
-- Held for p_secs (at most 15 minutes), and never past expires_at, so a hold
-- never outlasts the time it can still be booked in. The same phone or
-- request can hold it again; anyone else only once the hold has run out.
-- Refused when an overlapping slot on the same seat is already booked, and
-- (review, 17 Oct) when fewer than 10 minutes are left to book it.
-- One customer, one released time at a time (review, 17 Oct): under a lock
-- on the phone, a hold is refused while the same phone holds another time,
-- has booked another one in the last 2 minutes (two taps handled side by
-- side), or has booked one that overlaps this. The bot reads why and stays
-- quiet on a double tap instead of saying someone else took it.
create or replace function public.hold_released_slot(p_slot uuid, p_phone text, p_request bigint default null, p_secs int default 600)
returns setof public.released_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v released_slots;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  select * into v from released_slots where id = p_slot;
  if not found then return; end if;
  -- Always phone first, then the seat: the same order as book_released_slot.
  if v_phone is not null then
    perform pg_advisory_xact_lock(hashtextextended('released-phone:' || v_phone, 0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('released:' || v.partner_id::text || ':' || v.seat::text, 0));
  if exists (select 1 from released_slots o
              where o.partner_id = v.partner_id and o.seat = v.seat and o.id <> v.id and o.status = 'booked'
                and o.start_at < v.end_at and v.start_at < o.end_at) then
    return;
  end if;
  if v_phone is not null and exists (
       select 1 from released_slots o
        where o.id <> v.id
          and ((o.status = 'held' and o.held_by_phone = v_phone and o.held_until > now())
               or (o.status = 'booked' and o.booked_phone = v_phone
                   and (o.booked_at > now() - interval '2 minutes' or (o.start_at < v.end_at and v.start_at < o.end_at))))) then
    return;
  end if;
  return query
  with u as (
    update released_slots
       set status = 'held',
           held_by_phone = v_phone,
           held_request_id = p_request,
           held_until = least(expires_at, now() + make_interval(secs => least(greatest(coalesce(p_secs, 600), 60), 900))),
           updated_at = now()
     where id = p_slot and now() + interval '10 minutes' <= expires_at
       and (status = 'released'
            or (status = 'held' and (held_by_phone = v_phone or held_request_id = p_request or held_until < now())))
    returning *
  )
  select * from u;
end;
$$;

-- The customer's tap books it. Exactly one winner: callers for the same seat
-- queue on the advisory lock, and the UPDATE re-checks the status, so the
-- second one finds 'booked' and gets nothing back. The 15 minute reject window
-- starts now. Review (17 Oct): the same phone cannot book a second time
-- within 2 minutes (a double tap) or one that overlaps a time it has booked,
-- and two bookings for one request queue on a lock of their own, so the
-- second gets nothing back instead of a unique_violation.
create or replace function public.book_released_slot(p_slot uuid, p_request bigint, p_phone text default null)
returns setof public.released_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v released_slots;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if p_request is null then return; end if;
  select * into v from released_slots where id = p_slot;
  if not found then return; end if;
  -- Phone, then request, then seat: one order everywhere, so no deadlock.
  if v_phone is not null then
    perform pg_advisory_xact_lock(hashtextextended('released-phone:' || v_phone, 0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('released-req:' || p_request::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('released:' || v.partner_id::text || ':' || v.seat::text, 0));
  if exists (select 1 from released_slots where request_id = p_request and status = 'booked') then return; end if;
  if exists (select 1 from released_slots o
              where o.partner_id = v.partner_id and o.seat = v.seat and o.id <> v.id and o.status = 'booked'
                and o.start_at < v.end_at and v.start_at < o.end_at) then
    return;
  end if;
  if v_phone is not null and exists (
       select 1 from released_slots o
        where o.id <> v.id and o.status = 'booked' and o.booked_phone = v_phone
          and (o.booked_at > now() - interval '2 minutes' or (o.start_at < v.end_at and v.start_at < o.end_at))) then
    return;
  end if;
  return query
  with u as (
    update released_slots
       set status = 'booked', request_id = p_request, booked_phone = v_phone, booked_at = now(),
           reject_until = now() + interval '15 minutes',
           held_by_phone = null, held_request_id = null, held_until = null, updated_at = now()
     where id = p_slot and now() < expires_at
       and (status = 'released'
            or (status = 'held' and (held_by_phone = v_phone or held_request_id = p_request or held_until < now())))
    returning *
  )
  select * from u;
end;
$$;

-- Undo a booking that could not be written on the request side (the request
-- was closed in between). Only the request that booked it can undo it.
create or replace function public.unbook_released_slot(p_slot uuid, p_request bigint)
returns setof public.released_slots
language sql
security definer
set search_path = public
as $$
  update released_slots
     set status = case when now() < expires_at then 'released' else 'expired' end,
         request_id = null, booked_phone = null, booked_at = null, reject_until = null, updated_at = now()
   where id = p_slot and request_id = p_request and status = 'booked'
  returning *;
$$;

-- A hold given back (the customer moved on, or the hold was for nothing).
create or replace function public.unhold_released_slot(p_slot uuid, p_phone text default null)
returns setof public.released_slots
language sql
security definer
set search_path = public
as $$
  update released_slots
     set status = case when now() < expires_at then 'released' else 'expired' end,
         held_by_phone = null, held_request_id = null, held_until = null, updated_at = now()
   where id = p_slot and status = 'held'
     and (nullif(p_phone, '') is null or held_by_phone = p_phone)
  returning *;
$$;

-- The studio's reject link. Only a booked slot, only within its 15 minutes,
-- and (review, 17 Oct) only while the customer still has the booking: once
-- they have cancelled it there is nothing left to reject.
create or replace function public.reject_released_slot(p_slot uuid, p_note text default null)
returns setof public.released_slots
language sql
security definer
set search_path = public
as $$
  update released_slots s
     set status = 'rejected', rejected_at = now(), reject_note = left(p_note, 500), updated_at = now()
   where s.id = p_slot and s.status = 'booked' and now() <= s.reject_until
     and not exists (select 1 from whatsapp_requests r where r.id = s.request_id and r.stage in ('cancelled', 'dismissed'))
  returning s.*;
$$;

-- The customer cancelled (or Jordan closed) the request a released time was
-- booked for: the time is withdrawn at once, not up to 5 minutes later by the
-- sweep, so the studio's reject link finds nothing left to reject. Never
-- re-released automatically. Does nothing while the request is still live.
create or replace function public.released_request_closed(p_request bigint)
returns setof public.released_slots
language sql
security definer
set search_path = public
as $$
  update released_slots s
     set status = 'withdrawn', reject_note = coalesce(s.reject_note || ' ', '') || 'request ' || r.stage, updated_at = now()
    from whatsapp_requests r
   where s.request_id = p_request and s.status = 'booked' and r.id = s.request_id and r.stage in ('cancelled', 'dismissed')
  returning s.*;
$$;

-- The studio takes a time back. Only a time nobody is holding or has booked.
create or replace function public.withdraw_released_slot(p_slot uuid, p_partner uuid)
returns setof public.released_slots
language sql
security definer
set search_path = public
as $$
  update released_slots
     set status = 'withdrawn', updated_at = now()
   where id = p_slot and partner_id = p_partner and status = 'released'
  returning *;
$$;

-- Every 5 minutes (pg_cron below). Sends nothing.
--  - a hold that ran out goes back to released;
--  - a released or held time inside its last 60 minutes expires;
--  - a booked time whose request the customer cancelled (or Jordan closed) is
--    withdrawn. wa-bot's cancel path does this at once (released_request_closed)
--    and tells the studio by WhatsApp and email; this catches anything else.
create or replace function public.sweep_released_slots()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unheld int; v_expired int; v_withdrawn int;
begin
  update released_slots
     set status = 'released', held_by_phone = null, held_request_id = null, held_until = null, updated_at = now()
   where status = 'held' and held_until < now() and now() < expires_at;
  get diagnostics v_unheld = row_count;
  update released_slots
     set status = 'expired', held_by_phone = null, held_request_id = null, held_until = null, updated_at = now()
   where status in ('released', 'held') and now() >= expires_at;
  get diagnostics v_expired = row_count;
  update released_slots s
     set status = 'withdrawn', reject_note = coalesce(s.reject_note || ' ', '') || 'request ' || r.stage, updated_at = now()
    from whatsapp_requests r
   where s.status = 'booked' and r.id = s.request_id and r.stage in ('cancelled', 'dismissed');
  get diagnostics v_withdrawn = row_count;
  return jsonb_build_object('unheld', v_unheld, 'expired', v_expired, 'withdrawn', v_withdrawn);
end;
$$;

-- What the bot may offer a customer: live instant releases inside the
-- customer's window [p_from, p_to), at least an hour away, the length they
-- asked for, test slots only for test customers (p_test), within 12 km of the
-- area they gave (the same radius dispatch_candidates uses), one per studio
-- (its earliest fitting time), nearest first, then cheapest, then soonest. A
-- time that overlaps a booked one on the same seat is not offered.
create or replace function public.released_offers(
  p_from timestamptz, p_to timestamptz, p_area text default null, p_want text default null,
  p_test boolean default false, p_minutes int default 60, p_exclude uuid[] default null, p_limit int default 3)
returns table(slot_id uuid, partner_id uuid, business_name text, slug text, area text, address text, wa text,
              start_at timestamptz, end_at timestamptz, minutes int, seat smallint, price_eur numeric,
              discount_pct smallint, listed_price numeric, registered boolean, km numeric)
language sql
stable
security definer
set search_path = public
as $$
  with centre as (select lat, lon from mc_area_centre(p_area) limit 1),
  terms as (select coalesce(mc_want_terms(p_want), '{}'::text[]) as t),
  live as (
    select s.*, (extract(epoch from (s.end_at - s.start_at)) / 60)::int as mins
      from released_slots s
     cross join terms tm
     where (s.status = 'released' or (s.status = 'held' and s.held_until < now()))
       and s.confirm_mode = 'instant' and s.is_test = coalesce(p_test, false)
       and s.start_at >= p_from and s.start_at < p_to
       -- Room for the 10 minute hold and the name question (review, 17 Oct).
       and s.expires_at > now() + interval '15 minutes'
       and (p_exclude is null or not (s.partner_id = any(p_exclude)))
       and (s.service is null or s.service = any(tm.t))
       and not exists (select 1 from released_slots o
                        where o.partner_id = s.partner_id and o.seat = s.seat and o.id <> s.id and o.status = 'booked'
                          and o.start_at < s.end_at and s.start_at < o.end_at)
  ),
  fit as (
    select l.id, l.partner_id, l.start_at, l.end_at, l.mins, l.seat, l.price_eur, l.discount_pct,
           p.business_name, p.slug, coalesce(p.neighbourhood, p.city, 'Madrid') as area, p.address, p.status as pstatus,
           mc_wa_number(coalesce(p.whatsapp, p.phone)) as wa,
           mc_km(c.lat, c.lon, p.latitude, p.longitude) as km,
           lower(coalesce(p.city, '')) as city_l,
           c.lat is not null as centre_known,
           p.latitude is not null and p.longitude is not null as has_ll,
           p.neighbourhood as hood
      from live l
      join partners p on p.id = l.partner_id
      left join centre c on true
     where l.mins = coalesce(p_minutes, 60)
       and p.opted_out_at is null and coalesce(p.status, '') <> 'suspended'
       -- Review (17 Oct): an email address is required. The confirmation's
       -- email is the one channel sure to carry the client's phone and the
       -- 15 minute reject link: outside the studio's 24 hour WhatsApp window
       -- the aviso_centro_v1 fallback carries neither. Until the T3 template
       -- (hueco_reservado_v1) exists, a WhatsApp-only studio is not offered.
       and coalesce(p.booking_email, p.email, '') like '%_@_%.%'
  ),
  -- Review fix (socios, 17 Oct): a studio with no map position (a new one
  -- approved from /socios) used to match any area through "city Madrid", so
  -- the 12 km check never applied to it. Now it matches only a customer who
  -- names its neighbourhood. The city fallback stays for a customer whose
  -- area has no known centre, as before.
  near as (
    select distinct on (f.partner_id) f.*
      from fit f
     where p_area is null or btrim(p_area) = ''
        or (f.km is not null and f.km <= 12)
        or (f.centre_known and not f.has_ll and f.hood is not null and btrim(f.hood) <> ''
            and (f.hood ilike '%' || btrim(p_area) || '%' or btrim(p_area) ilike '%' || f.hood || '%'))
        or (not f.centre_known and (f.area ilike '%' || p_area || '%' or f.city_l like '%madrid%'))
     order by f.partner_id, f.start_at, f.seat
  )
  select n.id, n.partner_id, n.business_name, n.slug, n.area, n.address, n.wa, n.start_at, n.end_at, n.mins, n.seat,
         n.price_eur, n.discount_pct, lp.price, (coalesce(n.pstatus, '') = 'active' and rc.n >= 5), n.km
    from near n
    left join lateral (
      select ps.price from partner_services ps
       where ps.partner_id = n.partner_id and ps.is_active and ps.price > 0
       order by abs(coalesce(ps.duration, 60) - coalesce(p_minutes, 60)), ps.price
       limit 1
    ) lp on true
    left join lateral (
      select count(*) as n from partner_services ms where ms.partner_id = n.partner_id and ms.is_active and ms.price > 0
    ) rc on true
   -- Review fix (socios, 17 Oct): every offer carries a price, so a time with
   -- neither the studio's typed price nor a listed one is never offered.
   where coalesce(n.price_eur, lp.price) is not null
   order by n.km nulls last, coalesce(n.price_eur, lp.price, 999), n.start_at
   limit greatest(1, least(coalesce(p_limit, 3), 6));
$$;

revoke all on function public.release_slots(uuid, jsonb, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.hold_released_slot(uuid, text, bigint, int) from public, anon, authenticated;
revoke all on function public.book_released_slot(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.unbook_released_slot(uuid, bigint) from public, anon, authenticated;
revoke all on function public.unhold_released_slot(uuid, text) from public, anon, authenticated;
revoke all on function public.reject_released_slot(uuid, text) from public, anon, authenticated;
revoke all on function public.released_request_closed(bigint) from public, anon, authenticated;
revoke all on function public.withdraw_released_slot(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sweep_released_slots() from public, anon, authenticated;
revoke all on function public.released_offers(timestamptz, timestamptz, text, text, boolean, int, uuid[], int) from public, anon, authenticated;
grant execute on function public.release_slots(uuid, jsonb, text, text, timestamptz) to service_role;
grant execute on function public.hold_released_slot(uuid, text, bigint, int) to service_role;
grant execute on function public.book_released_slot(uuid, bigint, text) to service_role;
grant execute on function public.unbook_released_slot(uuid, bigint) to service_role;
grant execute on function public.unhold_released_slot(uuid, text) to service_role;
grant execute on function public.reject_released_slot(uuid, text) to service_role;
grant execute on function public.released_request_closed(bigint) to service_role;
grant execute on function public.withdraw_released_slot(uuid, uuid) to service_role;
grant execute on function public.sweep_released_slots() to service_role;
grant execute on function public.released_offers(timestamptz, timestamptz, text, text, boolean, int, uuid[], int) to service_role;

-- Every 5 minutes. Re-applying replaces the job instead of adding a second.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('mc-released-sweep') where exists (select 1 from cron.job where jobname = 'mc-released-sweep');
    perform cron.schedule('mc-released-sweep', '*/5 * * * *', 'select public.sweep_released_slots()');
  end if;
end $$;
