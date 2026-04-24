-- =============================================
-- PARTNER PORTAL TABLES for Massage Pass
-- Run these in your Supabase SQL editor
-- https://jglftdstrowwckwqmpue.supabase.co
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- PARTNERS table
-- =============================================
create table if not exists public.partners (
  id uuid references auth.users on delete cascade primary key,
  business_name text not null,
  email text,
  phone text,
  website text,
  address text,
  city text default 'Madrid',
  country text default 'Spain',
  description text,
  latitude numeric,
  longitude numeric,
  google_place_id text,
  status text default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: partners can only be managed by their owner
alter table public.partners enable row level security;

create policy "Partners: owner can do everything"
  on public.partners for all
  using (auth.uid() = id);

-- =============================================
-- PARTNER_SERVICES table
-- =============================================
create table if not exists public.partner_services (
  id uuid default uuid_generate_v4() primary key,
  partner_id uuid references public.partners on delete cascade not null,
  name text not null,
  type text,
  duration integer default 60, -- minutes
  price numeric(10,2) not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(partner_id, name) -- same service name per partner
);

alter table public.partner_services enable row level security;

create policy "Partner_services: owner can manage"
  on public.partner_services for all
  using (auth.uid() = partner_id);

-- =============================================
-- PARTNER_AVAILABILITY table
-- =============================================
create table if not exists public.partner_availability (
  id uuid default uuid_generate_v4() primary key,
  partner_id uuid references public.partners on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sunday, 6=Saturday
  time_slot text not null, -- e.g. "09:00"
  created_at timestamptz default now(),
  unique(partner_id, day_of_week, time_slot)
);

alter table public.partner_availability enable row level security;

create policy "Partner_availability: owner can manage"
  on public.partner_availability for all
  using (auth.uid() = partner_id);

-- =============================================
-- BOOKINGS table update (add partner_id + commission tracking)
-- =============================================
-- First check if bookings table exists
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'bookings'
  ) then
    -- Add columns if they don't exist
    alter table public.bookings
      add column if not exists partner_id uuid,
      add column if not exists commission numeric(5,2) default 0,
      add column if not exists massage_type text,
      add column if not exists duration integer;
    
    -- Add foreign key if not exists
    alter table public.bookings
      add constraint if not exists bookings_partner_fk
      foreign key (partner_id) references public.partners(id) on delete set null;
  end if;
end $$;

-- =============================================
-- Update trigger function
-- =============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger
drop trigger if exists set_updated_at on public.partners;
create trigger set_updated_at
  before update on public.partners
  for each row execute procedure public.handle_updated_at();
