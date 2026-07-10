-- Run in the Supabase SQL editor.

create table if not exists public.studio_drafts (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  description text,
  address text,
  neighborhood text,
  phone text,
  email text,
  website text,
  source_url text,
  services jsonb default '[]'::jsonb,
  status text default 'draft' check (status in ('draft','claimed','discarded')),
  claim_token uuid not null default gen_random_uuid(),
  created_at timestamptz default now()
);

-- Data API grants (PostgREST has no defaults on public schema).
grant select on public.studio_drafts to authenticated;
grant all on public.studio_drafts to service_role;

alter table public.studio_drafts enable row level security;

drop policy if exists "founder reads drafts" on public.studio_drafts;
create policy "founder reads drafts"
  on public.studio_drafts
  for select
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'jordan.hays@student.ie.edu');
