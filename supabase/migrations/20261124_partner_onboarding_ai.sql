-- Partner onboarding (24 Nov, Jordan).
-- 1. What the studio needs from us and how it takes bookings today, asked on
--    /partner/onboarding: "Need help filling extra time" vs "a full service
--    booking system", and "how they currently book or their main calendar".
-- 2. autofill_runs: one row per "Use AI" run of the partner-autofill function,
--    for its rate limits. Stores a salted daily hash of the IP, never the IP.

alter table public.partners
  add column if not exists partner_need text,
  add column if not exists booking_tools text[];

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'partners_partner_need_chk') then
    alter table public.partners add constraint partners_partner_need_chk
      check (partner_need is null or partner_need in ('fill_gaps', 'full_system'));
  end if;
end $$;

comment on column public.partners.partner_need is
  'Onboarding answer: fill_gaps = only last-minute and empty slots, they keep their own system; full_system = they want Massage Club as their booking system.';
comment on column public.partners.booking_tools is
  'Onboarding answer: how they take bookings today (whatsapp_phone, google_calendar, outlook, apple, treatwell, fresha, booksy, paper, other).';

create table if not exists public.autofill_runs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ip_hash text not null,
  url_host text,
  ok boolean not null default false,
  why text,
  fields_found int,
  ms int
);
create index if not exists autofill_runs_ip_time on public.autofill_runs (ip_hash, created_at desc);
create index if not exists autofill_runs_time on public.autofill_runs (created_at desc);
alter table public.autofill_runs enable row level security;
revoke all on public.autofill_runs from anon, authenticated;
