-- Adds a shareable claim token to every partner row (scraped/pending or otherwise).
-- Run once in the Supabase SQL editor:
--   https://jglftdstrowwckwqmpue.supabase.co

alter table public.partners
  add column if not exists claim_token uuid not null default gen_random_uuid();

create index if not exists partners_claim_token_idx
  on public.partners(claim_token);

-- Public (unauthenticated) read of a single pending row by claim_token,
-- so a studio owner can open their /studio-setup?claim=<token> link without logging in.
drop policy if exists "Partners: public read pending by claim_token" on public.partners;
create policy "Partners: public read pending by claim_token"
  on public.partners for select
  to anon, authenticated
  using (status = 'pending');

-- Anon needs to be able to read the pre-built services too, to pre-fill the page.
drop policy if exists "Partner_services: public read for pending partners" on public.partner_services;
create policy "Partner_services: public read for pending partners"
  on public.partner_services for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.partners p
      where p.id = partner_services.partner_id
        and p.status = 'pending'
    )
  );

grant select on public.partners to anon;
grant select on public.partner_services to anon;
