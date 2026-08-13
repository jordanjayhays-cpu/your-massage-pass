-- Add source-tracking column for validation surveys.
-- Run once in the Supabase SQL editor.
alter table public.validation_responses
  add column if not exists source text;
