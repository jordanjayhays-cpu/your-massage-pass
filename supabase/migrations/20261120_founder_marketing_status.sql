-- 20261120_founder_marketing_status.sql (20 Nov 2026). NOT APPLIED.
--
-- Why: the founder dashboard (src/app/screens/FounderDashboard.tsx) counts who
-- said yes to offers by reading public.marketing_status from the browser, under
-- the founder's signed-in session. Since 20 Nov the consent table and view are
-- service-role only (anon and authenticated have no grants; that is the point:
-- a browser must never read or write the consent list). So the dashboard always
-- shows "Could not read marketing_status" and counts nobody as a yes.
--
-- Fix: one founder-only function instead of reopening the view. It runs as its
-- owner (security definer), checks the caller's signed-in email against the same
-- three founder addresses as the existing "founder reads all bookings" policy on
-- public.bookings, and refuses anyone else with 42501 (so a non-founder gets an
-- error, never an empty list that would read as "0 yes"). It returns only the
-- four columns the dashboard needs. The table and the view keep no grants for
-- anon or authenticated.

create or replace function public.founder_marketing_status()
returns table (kind text, contact text, action text, source text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> all (array[
       'jordanjayhays@gmail.com',
       'jordan.hays@student.ie.edu',
       'jordan@massageclub.io'
     ]) then
    raise exception 'founder only' using errcode = '42501';
  end if;
  return query
    select s.kind, s.contact, s.action, s.source
      from public.marketing_status s;
end;
$$;

revoke all on function public.founder_marketing_status() from public, anon;
grant execute on function public.founder_marketing_status() to authenticated;

comment on function public.founder_marketing_status() is
  'Founder dashboard only: the latest offers answer per email and per phone (kind, contact, action, source) from marketing_status. Refuses every signed-in email except the three founder addresses (same list as the bookings founder policy) with 42501. The consent table and view stay service-role only.';

notify pgrst, 'reload schema';
