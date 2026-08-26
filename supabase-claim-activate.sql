-- One-tap claim activation: a studio owner goes live with a single yes,
-- no account, no calendar, no login. Run once in the Supabase SQL editor:
--   https://jglftdstrowwckwqmpue.supabase.co
--
-- The booking notification emails use token based confirm/decline links, so a
-- partner account is never required for a studio to receive and accept bookings.

create or replace function public.claim_activate_partner(
  p_claim_token uuid,
  p_email text,
  p_address text default null
)
returns table (id uuid, slug text, business_name text, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.partners p
     set status  = 'active',
         email   = coalesce(nullif(btrim(p_email), ''), p.email),
         address = coalesce(nullif(btrim(p_address), ''), p.address)
   where p.claim_token = p_claim_token
     and p.status = 'pending'
  returning p.id, p.slug, p.business_name, p.email;
end;
$$;

grant execute on function public.claim_activate_partner(uuid, text, text) to anon, authenticated;

-- Anon must be able to re-read the row after it flips to active so the done
-- screen (and a reload of the claim link) still resolves.
drop policy if exists "Partners: public read active" on public.partners;
create policy "Partners: public read active"
  on public.partners for select
  to anon, authenticated
  using (status = 'active');
