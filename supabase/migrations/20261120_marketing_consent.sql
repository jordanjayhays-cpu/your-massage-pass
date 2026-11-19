-- 20261120_marketing_consent.sql (20 Nov 2026, the consent rule). NOT APPLIED.
--
-- Why: on 19 Nov a customer booked through the homepage form and was never
-- asked whether she wants offers. The website's opt-in card saved into
-- marketing_optins, a table that was only ever defined in a repo-root paste
-- file (supabase-email-capture.sql) that nobody ran, and showed "Done" anyway.
-- Jordan adopted the consent rule (CLAUDE.md): every booking path asks, with two
-- equal buttons, nothing pre-selected, the booking goes ahead whatever the
-- answer (LOPDGDD art. 6.3), and promotions go ONLY to people whose latest
-- answer is yes (LSSI art. 21.1). This file makes the table the answers go
-- into real, as a migration.
--
--   marketing_optins   one row per answer, append-only. Never edited: a change
--                      of mind is a new row, so the history is the proof GDPR
--                      art. 7.1 asks for (who, when, the exact words shown, in
--                      which language, on which page or chat).
--     email            lowercased (null when only a phone is known)
--     phone            digits only, country code included (null when only an
--                      email is known)
--     user_id          the signed-in account, when there is one
--     source           where the answer was given: go_page (homepage request
--                      form), studio_booking, studio_request (unclaimed studio
--                      form), payment, review_page, profile, bot (WhatsApp),
--                      quiz, unsubscribe (the one-tap page)
--     booking_ref      bookings.booking_ref, when known
--     request_id       whatsapp_requests.id, when known
--     channel          what the answer covers. 'email+whatsapp' is the only
--                      value today: the notice names both channels.
--     action           yes | no | withdraw. withdraw is an opt-out after the
--                      fact (STOP on WhatsApp, the unsubscribe link).
--     wording          the exact words the person was shown next to the
--                      buttons (for withdraw: the words they wrote, or the
--                      unsubscribe page's text)
--     wording_lang     en | es (the language of `wording`)
--     ip_hash          keyed hash of the client IP (consent function only), so
--                      a disputed answer can be matched to a request without
--                      storing the address itself
--
--   marketing_status   the latest action per email and per phone. A sender
--                      (newsletter, rebooking reminder) looks up EVERY address
--                      it holds for a person and sends only when each one it
--                      finds says 'yes' (supabase/functions/consent/status.ts
--                      canMarket does exactly that). No row means not
--                      answered, which is never a yes. A withdrawal is written
--                      for every address known for the person (the consent
--                      function and wa-bot both look up the phone that came
--                      with an email and the emails that came with a phone),
--                      so a STOP on WhatsApp also stops email and an email
--                      unsubscribe also stops WhatsApp, even for a sender that
--                      only checks one address.
--
-- Who writes: only the service role (the `consent` edge function for the
-- website, wa-bot for WhatsApp). RLS is on with NO policies for anon or
-- authenticated, and they have no grants on the table or the view, so the
-- browser can neither read the list nor write to it directly. The old paste
-- file's anon insert policy is dropped if it was ever created.
--
-- Not created here: quiz_leads (the missing-tables audit decides).
--
-- Erasure (GDPR art. 17): the table owner can delete a person's rows by hand.
-- Keeping a withdraw row for someone who asked never to be contacted again is
-- expressly lawful (LOPDGDD art. 23), so prefer that to deleting it.
--
-- Retention (not enforced here; the privacy page must state it): a proposed
-- default for the adviser to confirm is to keep a yes or no while it is relied
-- on and 3 years after it is replaced or the person stops booking (the
-- longest limitation period for these offences, LSSI art. 45 and LOPDGDD art.
-- 72), and a withdraw row for as long as it is needed to keep them excluded.
--
-- A withdrawal that arrives by email (support@massageclub.io) is one insert
-- in the SQL editor, with the sender's own words:
--   insert into public.marketing_optins (email, source, action, wording, wording_lang)
--   values ('<address, lowercased>', 'unsubscribe', 'withdraw', '<their words>', 'en');
--
-- The switch: wa-bot asks the WhatsApp question only while app_secrets
-- MKT_ASK is 'on'. It is written 'off' below, because the question links the
-- privacy page and a yes given before that page names the controller, its
-- address and the retention periods is not an informed yes (GDPR arts. 7 and
-- 13). Turn it on once the privacy page is complete and live:
--   update public.app_secrets set value = 'on' where key = 'MKT_ASK';
-- STOP, BAJA and every other opt-out work whatever the switch says.
--
-- Safe to apply more than once, before or after the wa-bot and consent
-- deploys: wa-bot only asks when it can read marketing_status, so until this
-- is applied it asks nobody.

create table if not exists public.marketing_optins (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  email         text,
  phone         text,
  user_id       uuid,
  source        text not null,
  booking_ref   text,
  request_id    bigint,
  channel       text not null default 'email+whatsapp',
  action        text not null,
  wording       text not null,
  wording_lang  text,
  ip_hash       text
);

-- If the old paste file was run somewhere, its table has an identity id and
-- no phone, action or wording. Add what is missing. A legacy row has no
-- recorded wording, so it is not consent; the NOT NULLs below then fail on
-- purpose and a person has to decide what to do with those rows.
alter table public.marketing_optins
  add column if not exists phone         text,
  add column if not exists request_id    bigint,
  add column if not exists channel       text not null default 'email+whatsapp',
  add column if not exists action        text,
  add column if not exists wording       text,
  add column if not exists wording_lang  text,
  add column if not exists ip_hash       text;
alter table public.marketing_optins alter column action  set not null;
alter table public.marketing_optins alter column wording set not null;
alter table public.marketing_optins alter column source  set not null;

do $$ begin
  alter table public.marketing_optins add constraint marketing_optins_action_chk
    check (action in ('yes', 'no', 'withdraw'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.marketing_optins add constraint marketing_optins_source_chk
    check (source in ('go_page', 'studio_booking', 'studio_request', 'payment', 'review_page', 'profile', 'bot', 'quiz', 'unsubscribe'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.marketing_optins add constraint marketing_optins_channel_chk
    check (channel in ('email+whatsapp'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.marketing_optins add constraint marketing_optins_who_chk
    check (coalesce(email, '') <> '' or coalesce(phone, '') <> '' or user_id is not null);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.marketing_optins add constraint marketing_optins_email_chk
    check (email is null or (email = lower(email) and position('@' in email) > 1));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.marketing_optins add constraint marketing_optins_phone_chk
    check (phone is null or phone ~ '^[0-9]{6,15}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.marketing_optins add constraint marketing_optins_wording_chk
    check (length(btrim(wording)) between 1 and 2000);
exception when duplicate_object then null; end $$;

create index if not exists marketing_optins_email_idx on public.marketing_optins (email, created_at desc) where email is not null;
create index if not exists marketing_optins_phone_idx on public.marketing_optins (phone, created_at desc) where phone is not null;
create index if not exists marketing_optins_created_idx on public.marketing_optins (created_at desc);

-- A consent record is never edited, by anyone (the owner included): a
-- correction or a change of mind is a new row.
create or replace function public.marketing_optins_no_update() returns trigger
language plpgsql as $$
begin
  raise exception 'marketing_optins is append-only: insert a new row instead of changing row %', old.id;
end $$;
drop trigger if exists marketing_optins_no_update on public.marketing_optins;
create trigger marketing_optins_no_update before update on public.marketing_optins
  for each row execute function public.marketing_optins_no_update();

-- Access: service role only.
alter table public.marketing_optins enable row level security;
drop policy if exists "marketing_optins_anon_insert" on public.marketing_optins;
revoke all on public.marketing_optins from public, anon, authenticated;
revoke update, delete, truncate on public.marketing_optins from service_role;  -- append only
grant select, insert on public.marketing_optins to service_role;
do $$ begin
  execute 'revoke all on sequence public.marketing_optins_id_seq from public, anon, authenticated';
  execute 'grant usage, select on sequence public.marketing_optins_id_seq to service_role';
exception when undefined_table then null; end $$;
revoke all on function public.marketing_optins_no_update() from public, anon, authenticated;

-- The latest action per address. security_invoker, so the view never lets
-- anyone read more than the table lets them (and anon/authenticated have no
-- grant on it at all: Supabase's default privileges would otherwise expose
-- every address in it through the REST API).
create or replace view public.marketing_status with (security_invoker = true) as
with keyed as (
  select 'email'::text as kind, m.email as contact, m.action, m.created_at, m.id, m.source, m.wording_lang
    from public.marketing_optins m
   where coalesce(m.email, '') <> ''
  union all
  select 'phone'::text as kind, m.phone as contact, m.action, m.created_at, m.id, m.source, m.wording_lang
    from public.marketing_optins m
   where coalesce(m.phone, '') <> ''
)
select distinct on (kind, contact)
       kind,                       -- 'email' | 'phone'
       contact,                    -- the lowercased email or the digits
       action,                     -- latest: yes | no | withdraw
       created_at as answered_at,
       source,
       wording_lang,
       id as optin_id
  from keyed
 order by kind, contact, created_at desc, id desc;
alter view public.marketing_status set (security_invoker = true);
revoke all on public.marketing_status from public, anon, authenticated;
grant select on public.marketing_status to service_role;

-- The ask switch (see the header): off until the privacy page is complete.
insert into public.app_secrets (key, value) values
  ('MKT_ASK', 'off')   -- off | on: wa-bot asks the offers question after a booking
on conflict (key) do nothing;

comment on table public.marketing_optins is
  'The consent rule (19 Nov 2026): one append-only row per marketing answer (yes, no, withdraw) with the exact wording shown, its language, the source and the time. Promotions go only to addresses whose latest action in marketing_status is yes. Written only by the service role (consent edge function, wa-bot).';
comment on view public.marketing_status is
  'Latest marketing action per email and per phone. Send a promotion only when every address held for the person reads yes here. No row = not answered = no.';
