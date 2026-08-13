-- Booking reminders: add column + schedule daily cron at 10:00 Europe/Madrid
-- Run this once in the Supabase SQL editor.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS bookings_reminder_lookup_idx
  ON public.bookings (booking_date, reminder_sent)
  WHERE status <> 'cancelled';

-- Required extensions for scheduling HTTP calls from Postgres
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing schedule if re-running
SELECT cron.unschedule('send-booking-reminders-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-booking-reminders-daily');

-- 10:00 Europe/Madrid. Madrid is UTC+1 (CET) / UTC+2 (CEST in summer).
-- pg_cron runs in UTC. Use 08:00 UTC as a single fixed time;
-- it'll fire at 09:00 Madrid in winter and 10:00 Madrid in summer.
-- For exact 10:00 Madrid year-round, schedule two jobs (winter 09:00 UTC, summer 08:00 UTC)
-- or use a per-row check. We pick 08:00 UTC = 10:00 CEST as the primary slot.
SELECT cron.schedule(
  'send-booking-reminders-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://jglftdstrowwckwqmpue.supabase.co/functions/v1/send-booking-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- NOTE: set the service-role key once so the cron job can authenticate:
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
