-- Every booking needs a way of answering the customer (Jordan, 8 September 2026).
--
-- Sharo J asked for a couples massage through the website with no email address
-- and no WhatsApp history. Five studios were asked, two gave up part of their
-- afternoon to it, and she could not be told a single thing. WhatsApp only
-- carries free text for 24 hours after a customer writes to us, so a phone
-- number on its own is not a channel.
--
-- This is the last of three guards, and the only one nothing can route around:
--   1. The web form requires a valid email (BookFlowWizard, StudioBookingPage),
--      and logWhatsappRequestResult refuses the insert without one.
--   2. wa-bot v67 asks for the email before the booking is created.
--   3. This constraint.
--
-- Three shapes are allowed through:
--   - anything with an email;
--   - a booking made inside the WhatsApp chat, which is reachable in that
--     thread. The bot asks for the email first and only records a refusal after
--     telling Jordan there is no second channel;
--   - a handoff click log, which has no customer and no day and only records
--     that a visitor was sent to WhatsApp to start the conversation themselves.
--
-- NOT VALID on purpose: eight historical rows predate the rule and are left
-- alone. The constraint applies from here on.
alter table whatsapp_requests drop constraint if exists whatsapp_requests_reachable;

alter table whatsapp_requests add constraint whatsapp_requests_reachable check (
  contact_email is not null
  or coalesce(message_text, '') like '%Origen: whatsapp-bot%'
  or (first_name is null and day1 is null)
) not valid;
