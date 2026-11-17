-- Letters (17 Nov 2026). Jordan decided to write to massage studios by post
-- through Pingen (pingen.com; Madrid letters are delivered by Hispapost or
-- Correos) and asked for a private tool to run letter campaigns: pick
-- studios, see each letter exactly as it will be printed, approve or reject
-- each one, and only then post them.
--
-- This file adds what the edge function `letters` needs:
--
--   letter_settings    one row: the legal sender, the return address, the
--                      privacy page, print options and caps. The sender and
--                      address start EMPTY on purpose: nothing can be uploaded
--                      or posted until Jordan fills them in.
--   letter_recipients  the verified mailing list (business name and business
--                      address), imported through the page or a seed file kept
--                      outside the repo. Never in the repo.
--   letter_campaigns   a campaign: its name and its letter template.
--   letters            one letter per studio per campaign, with the exact PDF
--                      that was approved and what Pingen holds.
--   letter_events      append-only audit of every state change, every Pingen
--                      call result and every webhook.
--   letter_optouts     BAJA messages and the studio each was matched to.
--   letter_rate        rate-limit counters (letters_rate_hit / letters_rate_peek).
--   letter_pdf_deletions  PDFs the retention purge wants gone (the function
--                      deletes them from Storage; SQL cannot).
--   letters_purge_expired()  the 12-month retention the letter promises, run
--                      daily by pg_cron (mc-letters-purge).
--   storage bucket letters-pdf (private): letters/<letter id>/<sha256>.pdf
--
-- Review fixes (17 Nov, before anything was applied): BAJA scope and undo on
-- letter_optouts, test BAJAs that prove the WhatsApp route, the proof letter
-- confirmation on campaigns, list warnings accepted at import, the privacy
-- page and Pingen retention checks on settings, the retention purge, and the
-- guard on INSERT as well as UPDATE.
--
-- The edge function `letters` is the only reader and writer (service role).
-- RLS is on with no policies, and anon and signed-in users have no grants.
-- Nothing here sends anything. Not applied anywhere yet. Safe to apply more
-- than once.
--
-- Requires partners.slots_link_v (20261018_released_slots.sql).

set local lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- Settings (one row)
-- ---------------------------------------------------------------------------
create table if not exists public.letter_settings (
  id                    int primary key default 1 check (id = 1),
  sender_type           text not null default '' check (sender_type in ('', 'company', 'individual')),
  legal_sender_name     text not null default '',
  legal_sender_nif      text not null default '',
  return_name           text not null default '',
  return_street         text not null default '',
  return_postcode       text not null default '' check (return_postcode = '' or return_postcode ~ '^[0-9]{5}$'),
  return_city           text not null default '',
  contact_email         text not null default 'support@massageclub.io',
  contact_whatsapp      text not null default '+34 612 474 827',
  privacy_url           text not null default ''
                        check (privacy_url = '' or privacy_url ~ '^https://(book\.)?massageclub\.io/[A-Za-z0-9/_#?=.-]*$'),
  print_spectrum        text not null default 'grayscale' check (print_spectrum in ('grayscale', 'color')),
  delivery_product      text not null default 'cheap' check (delivery_product in ('cheap', 'fast', 'bulk', 'premium')),
  price_estimate_eur    numeric(6,2) not null default 0.97,
  max_price_per_letter  numeric(6,2) not null default 3.00,
  vat_rate              numeric(5,2) not null default 21,
  max_per_send          int not null default 20 check (max_per_send between 1 and 200),
  daily_cap             int not null default 50 check (daily_cap between 1 and 500),
  cooldown_days         int not null default 180 check (cooldown_days >= 30),
  optout_route_confirmed_at timestamptz,          -- set only after a test BAJA came through WhatsApp (letters function)
  optout_route_confirmed_by text,
  privacy_checked_at    timestamptz,             -- the privacy page was fetched and has its #section
  privacy_checked_url   text,
  privacy_check_ok      boolean,
  privacy_check_note    text,
  pingen_retention_addresses int,                -- months, as Pingen reports them (organisation settings)
  pingen_retention_pdf  int,
  pingen_retention_checked_at timestamptz,
  pingen_retention_env  text,
  pingen_price          numeric(8,2),             -- last price-calculator answer
  pingen_currency       text,
  pingen_checked_at     timestamptz,
  updated_at            timestamptz not null default now(),
  updated_by            text
);
insert into public.letter_settings (id) values (1) on conflict (id) do nothing;
comment on table public.letter_settings is 'Letters tool settings (one row). Legal sender and return address start empty: the letters function and letters_guard refuse to upload or post while they are.';

-- ---------------------------------------------------------------------------
-- The verified mailing list
-- ---------------------------------------------------------------------------
create table if not exists public.letter_recipients (
  id                         uuid primary key default gen_random_uuid(),
  kind                       text not null default 'studio' check (kind in ('studio', 'proof')),
  partner_id                 uuid references public.partners(id) on delete cascade,
  list_version               text not null,
  display_name               text not null check (length(display_name) between 1 and 60),
  greeting_name              text not null check (length(greeting_name) between 1 and 60),
  address_lines              text[],            -- null once purged (12 months, or the studio opted out)
  postcode                   text not null check (postcode = '' or postcode ~ '^[0-9]{5}$'),
  town                       text not null,
  unit_status                text not null default '',
  confidence                 text not null default '',
  partner_address_at_import  text,
  needs_review               text,              -- e.g. 'undeliverable on 2026-12-02'
  active                     boolean not null default true,
  note                       text,
  imported_at                timestamptz not null default now(),
  imported_by                text,
  warnings_acked_at          timestamptz,       -- "unit unknown" / medium confidence accepted at import
  warnings_acked_by          text,
  purged_at                  timestamptz,
  constraint letter_recipients_kind_partner check ((kind = 'studio') = (partner_id is not null)),
  constraint letter_recipients_lines check (address_lines is null or array_length(address_lines, 1) between 3 and 7)
);
create unique index if not exists letter_recipients_one_active
  on public.letter_recipients (partner_id) where active and kind = 'studio';
comment on table public.letter_recipients is 'Verified postal addresses of studios (business data), imported by the letters tool. kind proof = Jordan''s own address for a test letter.';

-- ---------------------------------------------------------------------------
-- Campaigns and letters
-- ---------------------------------------------------------------------------
create table if not exists public.letter_campaigns (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(name) between 3 and 80),
  status            text not null default 'open' check (status in ('open', 'closed')),
  template          jsonb not null,
  template_version  int not null default 1,
  pingen_env        text check (pingen_env in ('staging', 'production')),
  copied_from       uuid references public.letter_campaigns(id) on delete set null,
  proof_confirmed_at timestamptz,          -- live: Jordan's own proof letter arrived and looks right
  proof_confirmed_by text,
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.letter_campaigns is 'A letter campaign: its template (Spanish printed, English for Jordan only) and the Pingen environment it was uploaded to (fixed at the first upload).';

create table if not exists public.letters (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null references public.letter_campaigns(id) on delete restrict,
  recipient_id          uuid not null references public.letter_recipients(id) on delete restrict,
  partner_id            uuid references public.partners(id) on delete set null,
  ref_code              text not null unique check (ref_code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'),
  status                text not null default 'draft' check (status in (
                          'draft', 'review', 'approved', 'rejected', 'withdrawn',
                          'uploading', 'checking', 'ready', 'blocked',
                          'sending', 'submitted', 'sent', 'delivered',
                          'undeliverable', 'unprintable', 'cancelled', 'error')),
  status_reason         text,
  greeting_name         text check (greeting_name is null or length(greeting_name) between 1 and 60),
  address_lines         text[],
  qr_url                text,            -- the printed signed /socios link: a bearer link, service role only
  link_v                int,
  render_inputs_sha256  text,
  renderer_version      text,
  pdf_path              text,
  pdf_sha256            text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_bytes             int,
  layout                jsonb,
  rendered_at           timestamptz,
  previewed_sha256      text,
  previewed_at          timestamptz,
  previewed_by          text,
  approved_sha256       text,
  approved_at           timestamptz,
  approved_by           text,
  warnings_acked        boolean not null default false,
  rejected_at           timestamptz,
  rejected_by           text,
  reject_reason         text,
  pingen_env            text check (pingen_env in ('staging', 'production')),
  pingen_letter_id      uuid,
  pingen_status         text,
  pingen_address        text,
  pingen_pages          int,
  pingen_fonts          jsonb,
  pingen_price          numeric(8,2),
  pingen_currency       text,
  uploaded_sha256       text,
  uploaded_at           timestamptz,
  submitted_at          timestamptz,
  submitted_by          text,
  sent_at               timestamptz,
  delivered_at          timestamptz,
  undeliverable_at      timestamptz,
  cancelled_at          timestamptz,
  last_error            text,
  purged_at             timestamptz,     -- address, greeting, QR link and PDF removed (retention)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (campaign_id, recipient_id),
  -- An approval is an approval of these exact bytes.
  constraint letters_approved_bytes check (
    status not in ('approved', 'uploading', 'checking', 'ready', 'sending', 'submitted',
                   'sent', 'delivered', 'undeliverable', 'unprintable')
    or (approved_sha256 is not null and approved_sha256 = pdf_sha256)),
  -- What Pingen holds is what was approved.
  constraint letters_uploaded_bytes check (
    status not in ('checking', 'ready', 'sending', 'submitted', 'sent', 'delivered',
                   'undeliverable', 'unprintable')
    or (uploaded_sha256 = approved_sha256 and pingen_letter_id is not null))
);
create unique index if not exists letters_pingen_id on public.letters (pingen_env, pingen_letter_id) where pingen_letter_id is not null;
create index if not exists letters_campaign_status on public.letters (campaign_id, status);
create index if not exists letters_partner_submitted on public.letters (partner_id, submitted_at desc) where submitted_at is not null;
comment on table public.letters is 'One postal letter per studio per campaign. approved_sha256 binds the approval to the exact PDF bytes; uploaded_sha256 is what Pingen holds. Status changes only along the transitions in letters_guard (and rules.ts).';
comment on column public.letters.qr_url is 'The studio''s signed /socios link printed as the QR. A bearer link: never expose outside the service role.';

-- ---------------------------------------------------------------------------
-- Last line of defence, independent of the function code:
--   - only the transitions of the state machine (rules.ts TRANSITIONS);
--   - a letter cannot move to uploading or sending while the legal sender or
--     return address is empty, while its studio has opted out or is
--     suspended, archived or already a partner, or unless it is approved for
--     its current bytes.
-- ---------------------------------------------------------------------------
create or replace function public.letters_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.letter_settings;
  p record;
  allowed text[] := array[
    'draft>review', 'draft>withdrawn',
    'review>approved', 'review>rejected', 'review>withdrawn', 'review>review',
    'approved>review', 'approved>uploading', 'approved>withdrawn',
    'rejected>review', 'rejected>withdrawn',
    'uploading>checking', 'uploading>approved', 'uploading>error',
    'checking>ready', 'checking>blocked', 'checking>error', 'checking>withdrawn',
    'ready>sending', 'ready>approved', 'ready>review', 'ready>withdrawn',
    'blocked>approved', 'blocked>review', 'blocked>withdrawn',
    'sending>submitted', 'sending>error',
    'submitted>sent', 'submitted>unprintable', 'submitted>cancelled', 'submitted>submitted',
    'sent>delivered', 'sent>undeliverable',
    'error>checking', 'error>submitted', 'error>review'];
begin
  -- A letter is born a draft (review: an INSERT straight into sending for an
  -- opted-out studio used to pass, since the guard only ran on UPDATE).
  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception 'letters: a new letter starts as draft, not %', new.status;
    end if;
    new.updated_at := now();
    return new;
  end if;
  if new.status is distinct from old.status and not ((old.status || '>' || new.status) = any (allowed)) then
    raise exception 'letters: % cannot become %', old.status, new.status;
  end if;
  if new.status in ('uploading', 'sending') and new.status is distinct from old.status then
    select * into s from public.letter_settings where id = 1;
    if coalesce(s.legal_sender_name, '') = '' or coalesce(s.sender_type, '') = ''
       or coalesce(s.return_street, '') = '' or coalesce(s.return_postcode, '') = '' or coalesce(s.return_city, '') = ''
       or coalesce(s.privacy_url, '') = ''
       or (s.sender_type = 'company' and coalesce(s.legal_sender_nif, '') = '') then
      raise exception 'letters: legal sender, return address or privacy page is empty';
    end if;
    if new.partner_id is not null then
      select status, opted_out_at, outreach_status into p from public.partners where id = new.partner_id;
      if not found or p.opted_out_at is not null or coalesce(p.status, '') in ('suspended', 'archived', 'active')
         or coalesce(p.outreach_status, '') = 'opted_out' then
        raise exception 'letters: studio % is opted out or not writable', new.partner_id;
      end if;
      -- A letters-only BAJA (an active partner's) stops letters too.
      if exists (select 1 from public.letter_optouts o where o.partner_id = new.partner_id and o.undone_at is null and not o.test) then
        raise exception 'letters: studio % asked for no more letters (BAJA)', new.partner_id;
      end if;
    end if;
    if new.approved_sha256 is null or new.approved_sha256 is distinct from new.pdf_sha256 then
      raise exception 'letters: not approved for these bytes';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists letters_guard on public.letters;
create trigger letters_guard before insert or update on public.letters
  for each row execute function public.letters_guard();

-- ---------------------------------------------------------------------------
-- Audit (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.letter_events (
  id               bigint generated always as identity primary key,
  campaign_id      uuid references public.letter_campaigns(id) on delete set null,
  letter_id        uuid references public.letters(id) on delete set null,
  actor            text not null,              -- admin email, 'pingen' or 'system'
  event            text not null,
  from_status      text,
  to_status        text,
  detail           jsonb,
  pingen_event_id  text,                       -- webhook dedupe key
  created_at       timestamptz not null default now()
);
create unique index if not exists letter_events_pingen_event on public.letter_events (pingen_event_id) where pingen_event_id is not null;
create index if not exists letter_events_letter on public.letter_events (letter_id, created_at desc);
create index if not exists letter_events_campaign on public.letter_events (campaign_id, created_at desc);
comment on table public.letter_events is 'Append-only audit of the letters tool: every status change, Pingen call result, webhook, passcode failure and dry run. Never holds secrets, tokens or PDF bytes.';

-- ---------------------------------------------------------------------------
-- BAJA messages
-- ---------------------------------------------------------------------------
create table if not exists public.letter_optouts (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null check (channel in ('whatsapp', 'email', 'phone', 'post', 'manual')),
  from_ref    text,
  message     text,
  message_en  text,                  -- the bot's English for Jordan
  ref_code    text,
  partner_id  uuid references public.partners(id) on delete set null,
  matched_by  text,
  matched_at  timestamptz,
  scope       text check (scope is null or scope in ('letters', 'all')),
  prev_opted_out_at timestamptz,     -- partners.opted_out_at before this BAJA set it (for an undo)
  opted_out_set_at  timestamptz,     -- what this BAJA wrote there (null: it wrote nothing)
  undone_at   timestamptz,
  undone_by   text,
  test        boolean not null default false,  -- from the bot's test numbers: proves the route, never touches a studio
  created_at  timestamptz not null default now()
);
create index if not exists letter_optouts_created on public.letter_optouts (created_at desc);
create index if not exists letter_optouts_partner on public.letter_optouts (partner_id) where partner_id is not null and undone_at is null and not test;
comment on table public.letter_optouts is 'BAJA (do not write again) messages from studios, and the studio each was matched to. scope letters: no more letters (an active partner); scope all: partners.opted_out_at was set too. Rows with test true come from the bot''s test numbers and only prove the WhatsApp route.';

-- ---------------------------------------------------------------------------
-- Rate limits (actor = an admin email, all, or ip:<hash>), fixed windows.
-- ---------------------------------------------------------------------------
create table if not exists public.letter_rate (
  actor         text not null,
  kind          text not null,
  window_start  timestamptz not null,
  hits          int not null default 0,
  primary key (actor, kind, window_start)
);
create or replace function public.letters_rate_hit(p_actor text, p_kind text, p_window_s int, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s); n int;
begin
  insert into public.letter_rate (actor, kind, window_start, hits) values (p_actor, p_kind, w, 1)
  on conflict (actor, kind, window_start) do update set hits = public.letter_rate.hits + 1
  returning hits into n;
  delete from public.letter_rate where window_start < now() - interval '2 days';
  return n <= p_limit;
end $$;
create or replace function public.letters_rate_peek(p_actor text, p_kind text, p_window_s int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select hits from public.letter_rate
                    where actor = p_actor and kind = p_kind
                      and window_start = to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s)), 0);
$$;

-- updated_at on settings and campaigns.
create or replace function public.letters_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists letter_settings_touch on public.letter_settings;
create trigger letter_settings_touch before update on public.letter_settings for each row execute function public.letters_touch();
drop trigger if exists letter_campaigns_touch on public.letter_campaigns;
create trigger letter_campaigns_touch before update on public.letter_campaigns for each row execute function public.letters_touch();

-- ---------------------------------------------------------------------------
-- Retention (review fix, 17 Nov). Every letter says: kept until the studio
-- asks us to stop or at most 12 months from this mailing; after a BAJA only
-- what is needed not to write again. letters_purge_expired() does that, every
-- day (pg_cron) and when the letters function asks:
--   - unsent letters of a studio that opted out are withdrawn;
--   - letters 12 months after posting (or after creation, if never posted),
--     and every finished letter of a studio that opted out, lose the address,
--     greeting, QR link, Pingen's reading of the address and the PDF (queued
--     for deletion from Storage, which the function does: SQL cannot);
--   - mailing-list rows imported over 12 months ago with no letter posted to
--     them in the last 12 months, and rows of studios that opted out, lose
--     the address and are made inactive (the name and the studio stay, so it
--     is never written to again);
--   - BAJA messages lose the words and the number after 12 months (the
--     match, the scope and the date stay);
--   - audit details older than 12 months are blanked (they can quote what
--     Pingen read as the address).
-- Letters at Pingen or in flight are never touched.
-- ---------------------------------------------------------------------------
create table if not exists public.letter_pdf_deletions (
  path       text primary key,
  queued_at  timestamptz not null default now()
);
comment on table public.letter_pdf_deletions is 'PDF paths in the letters-pdf bucket that the retention purge wants deleted; the letters function deletes them through the Storage API.';

create or replace function public.letters_purge_expired() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cutoff timestamptz := now() - interval '12 months';
  busy text[] := array['uploading', 'checking', 'ready', 'blocked', 'sending', 'submitted', 'error'];
  done text[] := array['withdrawn', 'rejected', 'sent', 'delivered', 'undeliverable', 'unprintable', 'cancelled'];
  n_withdrawn int; n_pdfs int; n_letters int; n_recips int; n_optouts int; n_events int;
begin
  create temporary table if not exists letters_purge_out (partner_id uuid primary key) on commit drop;
  delete from letters_purge_out;
  insert into letters_purge_out
    select id from public.partners where opted_out_at is not null or coalesce(outreach_status, '') = 'opted_out'
    union
    select partner_id from public.letter_optouts where partner_id is not null and undone_at is null and not test
  on conflict do nothing;

  with w as (
    update public.letters l set status = 'withdrawn', status_reason = 'Studio asked not to be contacted (BAJA).'
     where l.status in ('draft', 'review', 'approved', 'rejected')
       and l.partner_id in (select partner_id from letters_purge_out)
    returning l.id, l.campaign_id, l.status
  ), ev as (
    insert into public.letter_events (campaign_id, letter_id, actor, event, to_status, detail)
    select campaign_id, id, 'system', 'withdrawn', 'withdrawn', '{"reason":"baja (retention purge)"}'::jsonb from w
    returning 1
  )
  select count(*) into n_withdrawn from ev;

  with target as (
    select l.id, l.pdf_path from public.letters l
     where l.purged_at is null and not (l.status = any (busy))
       and (coalesce(l.submitted_at, l.created_at) < cutoff
            or (l.status = any (done) and l.partner_id in (select partner_id from letters_purge_out)))
  ), q as (
    insert into public.letter_pdf_deletions (path)
    select pdf_path from target where pdf_path is not null
    on conflict (path) do nothing
    returning 1
  )
  select count(*) into n_pdfs from q;

  update public.letters l set address_lines = null, greeting_name = null, qr_url = null, pingen_address = null,
         pdf_path = null, status_reason = null, last_error = null, purged_at = now()
   where l.purged_at is null and not (l.status = any (busy))
     and (coalesce(l.submitted_at, l.created_at) < cutoff
          or (l.status = any (done) and l.partner_id in (select partner_id from letters_purge_out)));
  get diagnostics n_letters = row_count;

  update public.letter_recipients r set address_lines = null, postcode = '', town = '', partner_address_at_import = null,
         needs_review = null, active = false, purged_at = now()
   where r.purged_at is null
     and not exists (select 1 from public.letters l where l.recipient_id = r.id and l.status = any (busy))
     and ((r.imported_at < cutoff
           and not exists (select 1 from public.letters l where l.recipient_id = r.id and coalesce(l.submitted_at, l.created_at) >= cutoff))
          or r.partner_id in (select partner_id from letters_purge_out));
  get diagnostics n_recips = row_count;

  update public.letter_optouts set message = null, message_en = null, from_ref = null
   where created_at < cutoff and (message is not null or message_en is not null or from_ref is not null);
  get diagnostics n_optouts = row_count;

  update public.letter_events set detail = null where created_at < cutoff and detail is not null;
  get diagnostics n_events = row_count;

  return jsonb_build_object('withdrawn', n_withdrawn, 'pdfs_queued', n_pdfs, 'letters', n_letters,
                            'recipients', n_recips, 'optouts', n_optouts, 'events', n_events);
end $$;

-- Every day at 03:17 UTC. Re-applying replaces the job instead of adding a second.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('mc-letters-purge') where exists (select 1 from cron.job where jobname = 'mc-letters-purge');
    perform cron.schedule('mc-letters-purge', '17 3 * * *', 'select public.letters_purge_expired()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Private PDF store, content-addressed: letters/<letter id>/<sha256>.pdf.
-- No storage policies: only the service role can read or write it.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('letters-pdf', 'letters-pdf', false, 8388608, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Service role only: RLS on, no policies, nothing for anon or signed-in users.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['letter_settings', 'letter_recipients', 'letter_campaigns', 'letters',
                           'letter_events', 'letter_optouts', 'letter_rate', 'letter_pdf_deletions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
revoke update, delete, truncate on public.letter_events from service_role;  -- append only
revoke all on function public.letters_rate_hit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.letters_rate_hit(text, text, int, int) to service_role;
revoke all on function public.letters_rate_peek(text, text, int) from public, anon, authenticated;
grant execute on function public.letters_rate_peek(text, text, int) to service_role;
revoke all on function public.letters_guard() from public, anon, authenticated;
revoke all on function public.letters_purge_expired() from public, anon, authenticated;
grant execute on function public.letters_purge_expired() to service_role;
