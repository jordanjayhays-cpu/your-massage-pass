-- Languages the customer speaks, used to tell an unclaimed studio which
-- language to reply in on the WhatsApp handoff.
alter table public.profiles
  add column if not exists spoken_languages text[] default '{}'::text[];
