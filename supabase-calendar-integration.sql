-- =============================================
-- CALENDAR INTEGRATION + BOOKING ENGINE
-- Run these AFTER supabase-partner-tables.sql
-- =============================================

-- 1. PARTNERS: Add Google Calendar columns
alter table public.partners
  add column if not exists google_calendar_connected boolean default false,
  add column if not exists google_refresh_token text,
  add column if not exists google_access_token text,
  add column if not exists google_token_expiry timestamptz,
  add column if not exists google_calendar_id text default 'primary',
  add column if not exists auto_confirm_bookings boolean default false,
  add column if not exists notification_method text default 'whatsapp' 
    check (notification_method in ('whatsapp', 'email', 'sms', 'none'));

-- 2. BOOKINGS: Add calendar + status columns
alter table public.bookings
  add column if not exists google_event_id text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists studio_id uuid,
  add column if not exists service_name text,
  add column if not exists service_id uuid,
  add column if not exists status text default 'pending' 
    check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show'));

-- Add foreign key to bookings.studio_id
alter table public.bookings
  add constraint if not exists bookings_studio_fk
  foreign key (studio_id) references public.partners(id) on delete set null;

-- 3. PARTNER_NOTIFICATIONS: How studio prefers to be notified
create table if not exists public.partner_notifications (
  id uuid default uuid_generate_v4() primary key,
  partner_id uuid references public.partners on delete cascade not null unique,
  whatsapp_number text,
  email text,
  sms_number text,
  notify_on_booking boolean default true,
  notify_on_cancellation boolean default true,
  auto_confirm boolean default false,
  created_at timestamptz default now()
);

alter table public.partner_notifications enable row level security;

create policy "Partner_notifications: owner can manage"
  on public.partner_notifications for all
  using (auth.uid() = partner_id);

-- 4. INDEX for fast booking lookups
create index if not exists idx_bookings_studio_id on public.bookings(studio_id);
create index if not exists idx_bookings_date on public.bookings(booking_date);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_partners_google_connected on public.partners(google_calendar_connected);

-- 5. Function: get available slots (checks both manual availability + Google Calendar busy slots)
create or replace function public.get_available_slots(
  p_partner_id uuid,
  p_date date,
  p_duration integer -- minutes
) returns setof text as $$
declare
  v_day_of_week integer;
  v_manual_slots text[];
  v_return_slots text[];
begin
  v_day_of_week := extract(dow from p_date)::integer; -- 0=Sunday
  
  -- Get manual availability for this day
  SELECT array_agg(time_slot)
  INTO v_manual_slots
  FROM public.partner_availability
  WHERE partner_id = p_partner_id AND day_of_week = v_day_of_week;
  
  -- TODO: When Google Calendar connected, query Free/Busy API here
  -- and remove those slots from v_manual_slots
  
  RETURN QUERY SELECT unnest(v_manual_slots);
end;
$$ language plpgsql security definer;

-- 6. Function: create a booking
create or replace function public.create_booking(
  p_studio_id uuid,
  p_service_id uuid,
  p_booking_date date,
  p_time_slot text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_notes text default null
) returns public.bookings as $$
declare
  v_booking public.bookings;
  v_service record;
  v_studio record;
begin
  -- Get service details
  select * into v_service from public.partner_services where id = p_service_id;
  
  -- Get studio details
  select * into v_studio from public.partners where id = p_studio_id;
  
  -- Check if auto-confirm
  if v_studio.auto_confirm_bookings then
    INSERT INTO public.bookings (
      studio_id, partner_id, service_id, service_name,
      booking_date, time_slot, duration, massage_type,
      customer_name, customer_phone, customer_email,
      notes, status, confirmed_at
    ) VALUES (
      p_studio_id, p_studio_id, p_service_id, v_service.name,
      p_booking_date, p_time_slot, v_service.duration, v_service.type,
      p_customer_name, p_customer_phone, p_customer_email,
      p_notes, 'confirmed', now()
    ) returning * into v_booking;
  else
    INSERT INTO public.bookings (
      studio_id, partner_id, service_id, service_name,
      booking_date, time_slot, duration, massage_type,
      customer_name, customer_phone, customer_email,
      notes, status
    ) VALUES (
      p_studio_id, p_studio_id, p_service_id, v_service.name,
      p_booking_date, p_time_slot, v_service.duration, v_service.type,
      p_customer_name, p_customer_phone, p_customer_email,
      p_notes, 'pending'
    ) returning * into v_booking;
  end if;
  
  RETURN v_booking;
end;
$$ language plpgsql security definer;

-- 7. Function: cancel a booking
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text default null
) returns public.bookings as $$
declare
  v_booking public.bookings;
begin
  UPDATE public.bookings
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = p_reason
  WHERE id = p_booking_id
  RETURNING * into v_booking;
  
  RETURN v_booking;
end;
$$ language plpgsql security definer;

-- 8. Function: confirm a booking
create or replace function public.confirm_booking(p_booking_id uuid)
returns public.bookings as $$
declare
  v_booking public.bookings;
begin
  UPDATE public.bookings
  SET status = 'confirmed', confirmed_at = now()
  WHERE id = p_booking_id
  RETURNING * into v_booking;
  
  RETURN v_booking;
end;
$$ language plpgsql security definer;

-- 9. Function: get studio bookings
create or replace function public.get_studio_bookings(
  p_studio_id uuid,
  p_from_date date default current_date,
  p_to_date date default current_date + interval '30 days'
) returns setof public.bookings as $$
begin
  RETURN QUERY
  SELECT * FROM public.bookings
  WHERE studio_id = p_studio_id
    AND booking_date >= p_from_date
    AND booking_date <= p_to_date
  ORDER BY booking_date, time_slot;
end;
$$ language plpgsql security definer;
