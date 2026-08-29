-- Public, read-only access to verified reviews.
-- Anonymous visitors must never read client_email, private_note, user_id or
-- booking_id, so they never touch public.reviews directly. They read a view that
-- exposes ONLY the public columns of published rows. Category scores
-- (cleanliness, ambience, pressure_feedback) are exposed for the aggregate bars
-- on the studio page; the UI never renders them per review card.

-- 1. The view (owner rights, so the base-table RLS on reviews stays closed).
create or replace view public.public_reviews as
  select
    r.id,
    r.partner_id,
    r.rating,
    r.tags,
    r.custom_tag,
    r.comment,
    r.display_name,
    r.would_return,
    r.cleanliness,
    r.ambience,
    r.pressure_feedback,
    r.created_at
  from public.reviews r
  where r.published is true
    and r.rating is not null;

-- Views default to security_invoker = false, i.e. they run with the view owner's
-- rights and bypass the base table's RLS. Be explicit about it.
alter view public.public_reviews set (security_invoker = false);

-- 2. Grants: read-only for the anon key.
grant select on public.public_reviews to anon, authenticated;

-- 3. Make sure the base table itself stays locked down.
alter table public.reviews enable row level security;
revoke all on public.reviews from anon;
grant all on public.reviews to service_role;
-- The /review edge function writes with the service role, so no anon insert policy
-- is needed. Signed-in customers may read their own review rows:
drop policy if exists "reviews owner read" on public.reviews;
create policy "reviews owner read"
  on public.reviews for select
  to authenticated
  using (auth.uid() = user_id);
grant select on public.reviews to authenticated;
