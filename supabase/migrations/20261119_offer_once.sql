-- 20261119_offer_once.sql (19 Nov 2026, request #126). NOT APPLIED.
--
-- One offer per studio offer, an offer email that can wait a moment for the
-- studio's price, and the state the new default-OFF sweeps need. Every column
-- is nullable and the bot tolerates their absence (a claim that errors means
-- "send as before"), so this can go before or after the wa-bot deploy.
--
--   customer_offered_at    when this row's offer first reached the customer, on
--                          any channel. forwardOffer claims it with a
--                          conditional PATCH before it sends, so the studio's
--                          second yes (its other channel: the WhatsApp button
--                          and the time in the lead-to-studio email both land
--                          on this row) sends the customer nothing new.
--   customer_offered_time  the time that went; a different time from the same
--                          studio is a new offer and goes.
--   customer_offer_via     'whatsapp' | 'email' | 'email_pending' (an offer
--                          email waiting up to 3 minutes for the studio's price).
--   offer_email_due_at     when a waiting offer email goes without a price
--                          (wa-bot settle sweep, sendDueOfferEmails).
--   offer_price_eur        the studio-written price the offer carried (null = none).
--   offer_update_sent_at   the one "price update" email (OFFER_PRICE_UPDATE, default off).
--   nudged_at              the one reminder email (OFFER_NUDGE, default off).
--   offer_slot_at          (review) when the offered slot starts, written with the
--                          claim, so the late-Yes rule reads the day the offer was
--                          for. It used to be inferred from reply_text, which a
--                          later message from the studio overwrites ("mañana
--                          también tenemos hueco" moved a 13:30 today to tomorrow),
--                          and an email or call tap stores no day word at all.
--   asked_again_at         (review) a lapsed offer the customer said Yes to was put
--                          to the studio again (rule 4). The studio's yes then sends
--                          a fresh offer even inside the last 45 minutes, until the
--                          start, because this customer has already said they want
--                          it. wa-bot clears the customer_offered_* columns with it,
--                          so that fresh offer is not taken for a duplicate.
--
-- No deadline column: Jordan decided on 19 Nov that a Yes before the start
-- books (the customer of #126 tapped Yes at 13:26 for 13:30, came at 13:50 and
-- the massage happened), so nothing earlier than the start is stored or printed.

alter table public.request_dispatch
  add column if not exists customer_offered_at   timestamptz,
  add column if not exists customer_offered_time text,
  add column if not exists customer_offer_via    text,
  add column if not exists offer_email_due_at    timestamptz,
  add column if not exists offer_price_eur       numeric(6,2),
  add column if not exists offer_update_sent_at  timestamptz,
  add column if not exists nudged_at             timestamptz,
  add column if not exists offer_slot_at         timestamptz,
  add column if not exists asked_again_at        timestamptz;

do $$ begin
  alter table public.request_dispatch
    add constraint request_dispatch_customer_offer_via_chk
    check (customer_offer_via is null or customer_offer_via in ('whatsapp', 'email', 'email_pending'));
exception when duplicate_object then null; end $$;

-- The sweeps only ever look at offers that reached a customer and are open.
create index if not exists request_dispatch_open_offer_idx
  on public.request_dispatch (customer_offered_at)
  where customer_offered_at is not null and customer_answer is null and outcome in ('pending', 'accepted');
create index if not exists request_dispatch_email_pending_idx
  on public.request_dispatch (offer_email_due_at)
  where customer_offer_via = 'email_pending';

-- New automatic messages ship OFF (CLAUDE.md: approval before any new outbound
-- automation). The bot also reads a missing or unknown value as off.
insert into public.app_secrets (key, value) values
  ('OFFER_NUDGE', 'off'),         -- off | shadow | on: one reminder email to an email-only customer, 15 min after the offer
  ('OFFER_PRICE_UPDATE', 'off'),  -- off | on: one labelled price-update email when the price arrives after the offer email
  ('OFFER_LAPSE_EMAIL', 'off'),   -- off | on: lapse an email-only offer and tell the studio it can give the slot away
  ('ARRIVAL_CHECK', 'off')        -- off | on: ask the studio "¿ha llegado ...?" for a booking with no customer phone
on conflict (key) do nothing;

notify pgrst, 'reload schema';
