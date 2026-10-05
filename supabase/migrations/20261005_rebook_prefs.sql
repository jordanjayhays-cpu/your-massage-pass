-- Rebooking (5 Oct, Jordan): "capturing the info to rebook them next month".
--
-- One row per customer (by phone, else email), written by the `lead` function
-- when the booking page (public/go.html) sends `prefs`. It holds what a studio
-- needs to know next time (massage, pressure, therapist) and whether, and how
-- often, the customer asked to be reminded.
--
-- remind_ok is only ever true because the customer tapped a reminder option;
-- nothing on the page is preselected. next_remind_on is the requested day plus
-- the interval, so a reminder lands about when they would book again. Nothing
-- sends reminders yet: that is a separate job, approved separately.

create table if not exists public.rebook_prefs (
  id bigserial primary key,
  phone_norm text unique,
  email text,
  name text,
  lang text,
  last_request_id bigint,
  service text,
  pressure text check (pressure in ('Light', 'Medium', 'Firm')),
  therapist_gender text check (therapist_gender in ('female', 'male')),
  every_days int check (every_days in (14, 30, 60)),
  remind_ok boolean not null default false,
  consent_text text,
  consent_at timestamptz,
  next_remind_on date,
  lat double precision,
  lng double precision,
  area text,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists rebook_prefs_email_key on public.rebook_prefs (lower(email)) where phone_norm is null;

-- Contact details and preferences: service role only, never the public API.
alter table public.rebook_prefs enable row level security;
revoke all on public.rebook_prefs from anon, authenticated;
