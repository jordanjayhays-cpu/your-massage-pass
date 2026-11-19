-- 20261119_bookings_ref_unique.sql (19 Nov 2026, request #126). NOT APPLIED.
-- Apply this BEFORE deploying the wa-bot that checks the upsert's answer
-- (bookingRowFailed): with only the bot change, every confirmation would
-- raise the "BOOKING ROW NOT SAVED" card (correctly) until the index is fixed.
--
-- Why: wa-bot's ensureBooking upserts with POST /rest/v1/bookings?on_conflict=booking_ref,
-- i.e. INSERT ... ON CONFLICT (booking_ref) DO UPDATE. The only unique index on
-- booking_ref is PARTIAL (migration 20260912180019 bookings_ref_unique_for_wa:
-- "... on bookings (booking_ref) where booking_ref is not null"). Postgres can only
-- infer a partial index when the ON CONFLICT clause repeats its predicate, and
-- PostgREST's on_conflict cannot. Every upsert since 12 Sept has failed with 42P10
-- ("there is no unique or exclusion constraint matching the ON CONFLICT
-- specification") and ensureBooking swallowed it. Not one 'wa-%' row exists.
-- Confirmed 19 Nov: EXPLAIN of that INSERT fails 42P10 against live; the same
-- statement with "where booking_ref is not null" plans fine; postgres_logs show the
-- 42P10 at 12:26:21 UTC next to the bot's "booking ? status=400" log line.
-- The same mistake was made and fixed on leads_waitlist on 27 Aug
-- (20260827141441 leads_waitlist_nonpartial_uniques).
--
-- A plain unique index still lets any number of rows have booking_ref NULL
-- (NULLs are distinct), so the 40 website rows with no ref are untouched.
--
-- Checked read-only 19 Nov: 41 rows, 1 with a non-null booking_ref, 0 duplicate
-- non-null refs. The table is tiny, so a plain CREATE INDEX inside the migration
-- transaction is instant; CONCURRENTLY is not needed (and cannot run in a
-- transaction).

begin;

-- 0. Refuse to run if two rows share a non-null ref, rather than fail halfway.
do $$
begin
  if exists (
    select 1 from public.bookings
    where booking_ref is not null
    group by booking_ref having count(*) > 1
  ) then
    raise exception 'bookings has duplicate non-null booking_ref values; resolve them first';
  end if;
end $$;

-- 1. The plain unique index first, then drop the partial one, so there is never
--    a moment without uniqueness.
create unique index if not exists bookings_booking_ref_key on public.bookings (booking_ref);
drop index if exists public.bookings_booking_ref_uniq;

comment on column public.bookings.booking_ref is
  'For WhatsApp/web requests, wa-<whatsapp_requests.id>. Plain unique index (bookings_booking_ref_key) so PostgREST on_conflict=booking_ref can infer it; NULLs stay distinct.';

-- 2. The capacity trigger fires BEFORE INSERT, which on INSERT ... ON CONFLICT
--    DO UPDATE is before the conflict check. So once the upsert can run, a
--    second ensureBooking for the same request (the time-change path, the
--    email_confirmed op) counts the request's own row as "taken" and, at any
--    studio with capacity 1, raises 'This time slot is fully booked' (23505):
--    the update fails. A wa- booking is also the studio's own yes for that slot
--    (BOTH PARTIES TAP), so the website capacity count must not overrule it.
--    Body below is the live function (read 19 Nov) plus the one marked line.
--    The header is the live one too: SECURITY DEFINER, search_path public
--    (pg_get_functiondef, 19 Nov). CREATE OR REPLACE resets whatever it does
--    not state, and without SECURITY DEFINER the count below would run as the
--    inserting customer, whose RLS shows only their own bookings, so a full
--    slot at a capacity-1 studio would take a second website booking.
create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cap int;
  slot_cap int;
  taken int;
  bdate date;
begin
  if new.partner_id is null or coalesce(new.status, 'pending') = 'cancelled' then
    return new;
  end if;

  -- 19 Nov: a WhatsApp/web request booking is the studio's own confirmation of
  -- the slot, and an upsert of the same ref must not count itself.
  if coalesce(new.booking_ref, '') like 'wa-%' then
    return new;
  end if;

  begin
    bdate := new.booking_date::date;
  exception when others then
    bdate := null;
  end;

  if bdate is not null and bdate < current_date then
    raise exception 'Cannot book a date in the past';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(new.partner_id::text || '|' || coalesce(new.booking_date,'') || '|' || coalesce(new.booking_time,''))
  );

  select greatest(coalesce(capacity,1), 1) into cap from partners where id = new.partner_id;
  if cap is null then cap := 1; end if;

  -- Per-hour override wins over the studio default when set.
  if bdate is not null then
    select a.capacity into slot_cap
    from partner_availability a
    where a.partner_id = new.partner_id
      and a.day_of_week = extract(dow from bdate)::int
      and a.time_slot = new.booking_time
    limit 1;
    if slot_cap is not null then
      cap := greatest(slot_cap, 1);
    end if;
  end if;

  select count(*) into taken
  from bookings b
  where b.partner_id = new.partner_id
    and b.booking_date = new.booking_date
    and b.booking_time = new.booking_time
    and coalesce(b.status,'pending') <> 'cancelled';

  if taken >= cap then
    raise exception 'This time slot is fully booked' using errcode = '23505';
  end if;

  return new;
end;
$function$;

-- 3. After-care, one switch per job (review of 19 Nov: one switch for four jobs
--    meant approving the review email also started three things nobody
--    approved). Once wa- rows exist, four jobs that have never once run for a
--    WhatsApp/web booking start reading them. What each would send, and when
--    (booking_time is read as UTC by the dashboard functions, so "3h after the
--    end" is about 4h in Madrid winter time):
--      WA_REVIEW_EMAIL      review-request (dashboard, hourly at :20 UTC): the
--                           review email to the customer, "How was your massage
--                           at <studio>?" with five star links, signed "Massage
--                           Club" (v7, 19 Nov), about 3h after the end, within 14
--                           days, never for no_show. Column review_requested_at.
--      WA_ATTENDANCE_EMAIL  attendance-request (dashboard, daily 07:00 UTC):
--                           "¿Vino el cliente?" email to the studio with Sí, vino
--                           / No vino links, the morning after. Its subject has an
--                           em dash between "¿Vino el cliente?" and the date: fix it
--                           in the dashboard before this is ever 'on'. It duplicates
--                           booking-guard's T+20 arrival question.
--                           Column attendance_requested_at.
--      WA_REMINDER_EMAILS   booking-reminders (dashboard, every 15 min, through
--                           bookings_needing_reminders()): 24h and 3h reminder
--                           emails to the customer, which duplicate wa-bot's own
--                           day-before reminder. Columns reminder_24h_sent_at,
--                           reminder_3h_sent_at.
--      WA_REVIEW_WHATSAPP   wa-bot askForReviews (settle sweep, every 5 min): the
--                           WhatsApp review ask, 15 min to 6 h after the end, only
--                           in an open 24h window. Read by the bot itself.
--    review-request and askForReviews share review_requested_at, so a booking
--    is asked for a review once, by whichever runs first.
--    All four ship 'off' (CLAUDE.md: approval before any new outbound
--    automation). Jordan approved the review email for every massage on 19 Nov
--    (CLAUDE.md, ASK BEFORE SENDING): set WA_REVIEW_EMAIL to 'on' when applying
--    if that stands. A held row gets the sentinel 'epoch' (1970-01-01) in that
--    job's "already done" columns, which the job reads as done and which can
--    never be confused with a real send time. A test booking (is_test, set by
--    trg_flag_test_booking and by ensureBooking) is held on all four whatever
--    the switches say: review-request does not read is_test.
--    A switch affects rows inserted after it changes. To release one held
--    row: update bookings set review_requested_at = null where booking_ref =
--    'wa-<id>' and review_requested_at = 'epoch'.
insert into public.app_secrets (key, value) values
  ('WA_REVIEW_EMAIL', 'off'),
  ('WA_ATTENDANCE_EMAIL', 'off'),
  ('WA_REMINDER_EMAILS', 'off'),
  ('WA_REVIEW_WHATSAPP', 'off')
on conflict (key) do nothing;

create or replace function public.mc_hold_wa_aftercare()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  on_review  boolean := coalesce((select lower(trim(value)) from public.app_secrets where key = 'WA_REVIEW_EMAIL'), 'off') = 'on';
  on_attend  boolean := coalesce((select lower(trim(value)) from public.app_secrets where key = 'WA_ATTENDANCE_EMAIL'), 'off') = 'on';
  on_remind  boolean := coalesce((select lower(trim(value)) from public.app_secrets where key = 'WA_REMINDER_EMAILS'), 'off') = 'on';
  test_row   boolean := coalesce(new.is_test, false);
begin
  if coalesce(new.booking_ref, '') like 'wa-%' then
    if test_row or not on_review then
      new.review_requested_at := coalesce(new.review_requested_at, 'epoch'::timestamptz);
    end if;
    if test_row or not on_attend then
      new.attendance_requested_at := coalesce(new.attendance_requested_at, 'epoch'::timestamptz);
    end if;
    if test_row or not on_remind then
      new.reminder_24h_sent_at := coalesce(new.reminder_24h_sent_at, 'epoch'::timestamptz);
      new.reminder_3h_sent_at  := coalesce(new.reminder_3h_sent_at, 'epoch'::timestamptz);
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_hold_wa_aftercare on public.bookings;
create trigger trg_hold_wa_aftercare
  before insert on public.bookings
  for each row execute function public.mc_hold_wa_aftercare();
-- (On an ON CONFLICT DO UPDATE, PostgREST's merge-duplicates only sets the
-- columns in ensureBooking's payload, so these four are never overwritten.
-- trg_hold_wa_aftercare runs after trg_flag_test_booking, triggers of the same
-- kind firing in name order, so is_test is already set when it reads it.)

-- 3b. (review) A wa- bookings row follows its request when the request is
--     cancelled or marked no_show. wa-bot's markNoShow and the WhatsApp cancel
--     at the reminder step write only whatsapp_requests, so the row would stay
--     'confirmed', and once WA_REVIEW_EMAIL is on review-request (which skips
--     cancelled and no_show) would ask someone who cancelled, or never came,
--     how the massage was. bookings has no UPDATE trigger (checked 19 Nov:
--     studio-email, the capacity and test-flag triggers are INSERT only), so
--     this sends nothing itself.
create or replace function public.mc_sync_wa_booking_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.stage in ('cancelled', 'no_show') and old.stage is distinct from new.stage then
    update public.bookings
       set status = case when new.stage = 'no_show' then 'no_show' else 'cancelled' end
     where booking_ref = 'wa-' || new.id::text
       and status in ('pending', 'confirmed');
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_sync_wa_booking_status on public.whatsapp_requests;
create trigger trg_sync_wa_booking_status
  after update of stage on public.whatsapp_requests
  for each row execute function public.mc_sync_wa_booking_status();

-- 4. OPTIONAL, left commented: the "studio-email" webhook (notify-booking) emails
--    and Telegrams Jordan "New booking #id" on every INSERT. acceptOffer already
--    sends him a "Booked" founder card for every wa- booking, so after this
--    migration he gets two alerts per booking. Uncomment to keep only one.
-- drop trigger if exists "studio-email" on public.bookings;
-- create trigger "studio-email" after insert on public.bookings
--   for each row
--   when (new.booking_ref is null or new.booking_ref not like 'wa-%')
--   execute function supabase_functions.http_request(
--     'https://jglftdstrowwckwqmpue.supabase.co/functions/v1/notify-booking',
--     'POST', '{"Content-type":"application/json"}', '{}', '5000');

notify pgrst, 'reload schema';

commit;
