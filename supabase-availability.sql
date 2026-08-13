-- =============================================
-- REAL-TIME AVAILABILITY: opening_hours + capacity
-- Run in Supabase SQL editor
-- =============================================

alter table public.partners
  add column if not exists opening_hours jsonb default '{}'::jsonb,
  add column if not exists capacity integer default 1;

-- Helpful index for availability lookups
create index if not exists bookings_partner_date_idx
  on public.bookings (partner_id, booking_date);
