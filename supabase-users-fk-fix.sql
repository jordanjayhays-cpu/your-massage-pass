-- Run in Supabase SQL editor
-- Creates a public.users table and repoints partners.id FK to it
-- (so partners rows can exist without a matching auth.users row — needed for scraped/pending studios)

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_id_fkey;

ALTER TABLE public.partners
  ADD CONSTRAINT partners_id_fkey
  FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;
