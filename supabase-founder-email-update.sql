-- Run this in the Supabase SQL editor to update founder-read RLS policies
-- from jordanjayhays@gmail.com to jordan.hays@student.ie.edu.
-- Policy names below are placeholders — adjust to match your actual policy names
-- (check via: select schemaname, tablename, policyname, qual from pg_policies
--  where qual::text like '%jordanjayhays%';).

-- Helper: quickly locate all policies still referencing the old email
-- select schemaname, tablename, policyname, qual
-- from pg_policies
-- where qual::text ilike '%jordanjayhays%' or with_check::text ilike '%jordanjayhays%';

-- validation_responses
drop policy if exists "Founder can read validation responses" on public.validation_responses;
create policy "Founder can read validation responses"
  on public.validation_responses
  for select
  to authenticated
  using (lower((auth.jwt() ->> 'email')) = 'jordan.hays@student.ie.edu');

-- bookings (if a founder-read policy exists)
drop policy if exists "Founder can read bookings" on public.bookings;
create policy "Founder can read bookings"
  on public.bookings
  for select
  to authenticated
  using (lower((auth.jwt() ->> 'email')) = 'jordan.hays@student.ie.edu');

-- partners (if a founder-read policy exists)
drop policy if exists "Founder can read partners" on public.partners;
create policy "Founder can read partners"
  on public.partners
  for select
  to authenticated
  using (lower((auth.jwt() ->> 'email')) = 'jordan.hays@student.ie.edu');

-- profiles (if a founder-read policy exists)
drop policy if exists "Founder can read profiles" on public.profiles;
create policy "Founder can read profiles"
  on public.profiles
  for select
  to authenticated
  using (lower((auth.jwt() ->> 'email')) = 'jordan.hays@student.ie.edu');
