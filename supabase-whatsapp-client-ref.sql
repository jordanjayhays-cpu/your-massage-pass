-- =============================================
-- whatsapp_requests.client_ref
-- Run in the Supabase SQL editor (jglftdstrowwckwqmpue).
--
-- Why: whatsapp_requests.id is a BIGINT identity column and the table has an
-- anon INSERT policy but deliberately NO SELECT policy (customer PII), so the
-- client can neither send an id nor read the inserted row back. Instead the
-- client generates its own uuid and stores it in client_ref, then uses that to
-- attach the request to an account once the customer signs in.
--
-- The app already works without this column (it retries the insert without it
-- and falls back to linking by email). Running this simply restores the exact
-- request -> account link.
-- =============================================

alter table public.whatsapp_requests
  add column if not exists client_ref uuid;

create index if not exists whatsapp_requests_client_ref_idx
  on public.whatsapp_requests (client_ref);

-- No SELECT policy is added on purpose. The authenticated UPDATE path
-- (setting user_id after sign-in) filters on client_ref only.
