-- Socios sign-up (18 Oct 2026). Jordan: "for the new ones we need to easily
-- funnel them into having them give us times so we can send clients their
-- way", "I need this to be easy for them to input and we can have that saved
-- and then easily offer it to the customers without thinking about it", "not
-- on whatsapp, they get a link and then it takes them so we can record these
-- times".
--
-- The landing page (public/socios.html, book.massageclub.io/socios) posts a
-- studio's times to wa-bot (ops studio_signup). This file adds what that needs:
--
--   studio_signups     every submission, as it came in, with what became of it
--   partner_terms      the studio's written acceptance of the fee terms, the
--                      record billing relies on
--   released_patterns  "every week" times (Tuesday 18:00, 60 min)
--   released_slots.pattern_id
--                      which weekly time a released slot came from
--   materialise_released_patterns()
--                      turns active weekly times into released slots for the
--                      next 7 days; every 5 minutes (pg_cron) and right after
--                      a sign-up
--   end_released_pattern()
--                      the studio's Quitar on a weekly time
--
-- Requires 20261018_released_slots.sql (released_slots, release_slots,
-- partners.slots_link_v). Nothing here sends anything. Whether customers see
-- a released time is still decided by app_secrets RELEASED in wa-bot; studios
-- may load times before it is on.
--
-- Safe to apply more than once.

-- ---------------------------------------------------------------------------
-- Every submission from the page, kept as it arrived.
--   received        stored, not yet acted on (a signed link is applied at once)
--   applied         its times and details were saved (signed link, or Jordan
--                   approved it)
--   pending_review  waiting for Jordan (no signed link, a test contact on a
--                   real studio, a studio that opted out, or the apply failed)
--   rejected        Jordan said no; nothing was saved
-- ---------------------------------------------------------------------------
create table if not exists public.studio_signups (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid references public.partners(id) on delete set null,
  signed           boolean not null default false,
  status           text not null default 'received'
                   check (status in ('received', 'applied', 'pending_review', 'rejected')),
  payload          jsonb not null,
  -- The WhatsApp the studio typed, digits only: matching and the per-studio
  -- rate limit when no partner is known yet.
  whatsapp_digits  text,
  -- A keyed hash of the sender's IP (never the IP itself), for the rate limit.
  ip_hash          text,
  user_agent       text,
  note             text,
  -- What the apply did: times saved and skipped, weekly times, fields filled,
  -- values that differ from what we have on file.
  result           jsonb,
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  applied_at       timestamptz
);
create index if not exists studio_signups_partner on public.studio_signups (partner_id, created_at desc);
create index if not exists studio_signups_ip on public.studio_signups (ip_hash, created_at desc);
create index if not exists studio_signups_wa on public.studio_signups (whatsapp_digits, created_at desc);
create index if not exists studio_signups_review on public.studio_signups (created_at desc) where status = 'pending_review';

alter table public.studio_signups enable row level security;
revoke all on public.studio_signups from public, anon, authenticated;
grant all on public.studio_signups to service_role;

-- ---------------------------------------------------------------------------
-- The written agreement. One row per studio and terms version: the first
-- acceptance is the one that counts, later identical ones add nothing.
-- text is the exact sentence the studio ticked, in the language it read.
-- No cascade: like studio_invoices, a partner with an agreement on file cannot
-- be deleted by accident.
-- ---------------------------------------------------------------------------
create table if not exists public.partner_terms (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id),
  version      text not null,
  text         text not null,
  lang         text,
  accepted_at  timestamptz not null,
  -- socios_link: the studio's own signed link. socios_review: an unsigned
  -- form Jordan approved.
  via          text not null check (via in ('socios_link', 'socios_review')),
  signup_id    uuid references public.studio_signups(id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index if not exists partner_terms_once on public.partner_terms (partner_id, version);

alter table public.partner_terms enable row level security;
revoke all on public.partner_terms from public, anon, authenticated;
grant all on public.partner_terms to service_role;

-- ---------------------------------------------------------------------------
-- "Every week": a weekday (0 Sunday to 6 Saturday, as JavaScript getDay and
-- extract(dow)), a Madrid start time on the half hour, a length, rooms and an
-- optional price the studio typed. Only active ones are materialised. Quitar
-- ends one (active false) and withdraws its future free times.
-- ---------------------------------------------------------------------------
create table if not exists public.released_patterns (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),
  start_time    time not null,
  minutes       smallint not null check (minutes in (60, 90)),
  seats         smallint not null default 1 check (seats between 1 and 3),
  price_eur     numeric(8,2) check (price_eur is null or price_eur between 1 and 500),
  active        boolean not null default true,
  created_from  uuid references public.studio_signups(id) on delete set null,
  created_at    timestamptz not null default now(),
  ended_at      timestamptz,
  ended_note    text,
  constraint released_patterns_grid check (extract(second from start_time) = 0 and extract(minute from start_time) in (0, 30)),
  constraint released_patterns_day check (extract(epoch from start_time) / 60 + minutes <= 1440)
);
-- One live weekly time per studio, weekday, start and length.
create unique index if not exists released_patterns_live
  on public.released_patterns (partner_id, weekday, start_time, minutes) where active;
create index if not exists released_patterns_partner on public.released_patterns (partner_id) where active;
-- Review fix (17 Oct): a weekly time starts at 08:00 or later and ends by
-- 22:00 Madrid, whatever hours were typed (wa-bot SOC_DAY_WINDOW). A typed
-- "0-24" once saved a weekly 00:00 that was materialised every 5 minutes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'released_patterns_window') then
    alter table public.released_patterns
      add constraint released_patterns_window check (start_time >= time '08:00' and extract(epoch from start_time) / 60 + minutes <= 22 * 60);
  end if;
end $$;

alter table public.released_patterns enable row level security;
revoke all on public.released_patterns from public, anon, authenticated;
grant all on public.released_patterns to service_role;

alter table public.released_slots add column if not exists pattern_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'released_slots_pattern_id_fkey') then
    alter table public.released_slots
      add constraint released_slots_pattern_id_fkey foreign key (pattern_id) references public.released_patterns(id) on delete set null;
  end if;
end $$;
create index if not exists released_slots_pattern on public.released_slots (pattern_id) where pattern_id is not null;

-- ---------------------------------------------------------------------------
-- Weekly times become released slots for today and the next 6 days (Madrid
-- calendar days), through release_slots, so every one of its limits holds:
-- at least 60 minutes ahead, under 8 days, at most 40 rows a call (a pattern
-- is at most 7 days x 3 rooms = 21), 200 live a studio, test studios marked
-- from their name, nothing for a studio that opted out or is suspended.
--
-- Idempotent and never undoes the studio: a start and room that already has
-- a row of ANY status (free, held, booked, removed, rejected, expired) is not
-- created again, so a time the studio took off with Quitar, rejected, or that
-- a customer cancelled never comes back by itself. Times are Madrid wall
-- clock: 18:00 is 18:00 on both sides of the clock change (25 Oct 2026).
-- One pattern that fails does not stop the others.
-- ---------------------------------------------------------------------------
create or replace function public.materialise_released_patterns(p_partner uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pat record;
  v_rows jsonb;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_pats int := 0;
  v_ins int := 0;
  v_n int;
  v_ids uuid[];
  v_failed int := 0;
begin
  for pat in
    select rp.*
      from released_patterns rp
      join partners p on p.id = rp.partner_id
     where rp.active
       and (p_partner is null or rp.partner_id = p_partner)
       -- The same 08:00 to 22:00 window as released_patterns_window, for a
       -- row that was saved before the constraint existed.
       and rp.start_time >= time '08:00' and extract(epoch from rp.start_time) / 60 + rp.minutes <= 22 * 60
       and p.opted_out_at is null
       and coalesce(p.status, '') not in ('suspended', 'archived')
     order by rp.partner_id, rp.created_at
  loop
    v_pats := v_pats + 1;
    begin
      select coalesce(jsonb_agg(jsonb_build_object(
               'start_at', c.start_at,
               'end_at', c.start_at + make_interval(mins => pat.minutes),
               'seat', c.seat,
               'price_eur', pat.price_eur) order by c.start_at, c.seat), '[]'::jsonb)
        into v_rows
        from (
          select ((d.day + pat.start_time) at time zone 'Europe/Madrid') as start_at, s.seat::smallint as seat
            from (select v_today + g as day from generate_series(0, 6) g) d
           cross join generate_series(1, pat.seats) s(seat)
           where extract(dow from d.day) = pat.weekday
        ) c
       where c.start_at >= now() + interval '60 minutes'
         and c.start_at < now() + interval '8 days'
         and not exists (select 1 from released_slots o
                          where o.partner_id = pat.partner_id and o.start_at = c.start_at and o.seat = c.seat);
      if jsonb_array_length(v_rows) = 0 then continue; end if;
      -- Two statements: rows inserted inside release_slots are not visible to
      -- an UPDATE in the same statement.
      select coalesce(array_agg(r.id), '{}'::uuid[])
        into v_ids
        from release_slots(pat.partner_id, v_rows, 'studio_link',
                           'weekly pattern ' || pat.id::text || coalesce(' from socios signup ' || pat.created_from::text, ''),
                           null) r;
      update released_slots set pattern_id = pat.id where id = any(v_ids);
      get diagnostics v_n = row_count;
      v_ins := v_ins + v_n;
    exception when others then
      v_failed := v_failed + 1;
      raise warning 'materialise_released_patterns: pattern % failed: %', pat.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('patterns', v_pats, 'inserted', v_ins, 'failed', v_failed);
end;
$$;

-- The studio's Quitar on a weekly time (or Jordan's). Ends the pattern and
-- withdraws its future times nobody holds or has booked; a held or booked one
-- stays as it is. Returns {ended, withdrawn}.
create or replace function public.end_released_pattern(p_pattern uuid, p_partner uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ended int;
  v_withdrawn int;
begin
  update released_patterns
     set active = false, ended_at = now(), ended_note = left(p_note, 300)
   where id = p_pattern and partner_id = p_partner and active;
  get diagnostics v_ended = row_count;
  update released_slots
     set status = 'withdrawn', reject_note = coalesce(reject_note || ' ', '') || 'weekly time ended', updated_at = now()
   where pattern_id = p_pattern and partner_id = p_partner and status = 'released' and start_at > now();
  get diagnostics v_withdrawn = row_count;
  return jsonb_build_object('ended', v_ended > 0, 'withdrawn', v_withdrawn);
end;
$$;

revoke all on function public.materialise_released_patterns(uuid) from public, anon, authenticated;
revoke all on function public.end_released_pattern(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.materialise_released_patterns(uuid) to service_role;
grant execute on function public.end_released_pattern(uuid, uuid, text) to service_role;

-- Every 5 minutes, beside the released-slot sweep. Re-applying replaces the
-- job instead of adding a second.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('mc-released-patterns') where exists (select 1 from cron.job where jobname = 'mc-released-patterns');
    perform cron.schedule('mc-released-patterns', '*/5 * * * *', 'select public.materialise_released_patterns()');
  end if;
end $$;
