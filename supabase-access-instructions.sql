-- Ensures partners.access_instructions exists (idempotent)
alter table public.partners
  add column if not exists access_instructions text;
