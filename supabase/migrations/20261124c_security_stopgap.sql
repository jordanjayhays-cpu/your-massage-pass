-- Record of a migration that is ALREADY LIVE. Do not apply it again.
--
-- Applied 24 Nov 2026 through the Supabase API as version 20261124043444,
-- name "security_stopgap_public_functions", with Jordan's OK ("Yes, close it
-- now"). The SQL below is the applied text, copied from
-- supabase_migrations.schema_migrations, so the repo matches the database.
-- Checked 24 Nov: everything from the line "-- 24 Nov 2026 (Jordan: ..."
-- down is byte-identical to the live statement (md5 1912243d...), the
-- claim_release_prebuilt body matches the live prosrc (md5 3e4d861c...), and
-- the live EXECUTE grants are as below (claim_release_prebuilt: postgres,
-- authenticated, service_role; the other two: postgres, service_role).
--
-- If a fresh database (a branch, db reset) ever replays it, that is harmless:
-- create or replace with the same signature, then the same grants again.
--
-- Known gap, closed by the partners column lock that follows
-- (20261124e_partners_column_lock.sql): the "one release per account" guard
-- reads partners.outreach_status, and until that lock a signed-in studio can
-- still UPDATE its own outreach_status (and DELETE and re-insert its own row)
-- through the partners_owner_all policy, which resets the guard.

-- 24 Nov 2026 (Jordan: "Yes, close it now"). Stopgap: the public (anon) key
-- could call these SECURITY DEFINER functions directly.

-- Returned customers' first names and studio replies, and posts to n8n.
-- Only the (paused) daily cron job calls it.
revoke execute on function public.mc_cold_requests_digest() from public, anon, authenticated;
grant execute on function public.mc_cold_requests_digest() to service_role;

-- Made a personal booking link for any phone number. Only wa-bot calls it,
-- with the service role key.
revoke execute on function public.mc_booking_link(text, text) from public, anon, authenticated;
grant execute on function public.mc_booking_link(text, text) to service_role;

-- Deleted any pending studio whose claim token you had (and the tokens were
-- readable with the public key). Now: logged-in callers only, who already
-- have their own studio row, and one release per account (the function marks
-- the caller's row 'claimed' on release).
revoke execute on function public.claim_release_prebuilt(uuid) from public, anon;
grant execute on function public.claim_release_prebuilt(uuid) to authenticated, service_role;

create or replace function public.claim_release_prebuilt(p_claim_token uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  pre partners%rowtype;
  uid uuid := auth.uid();
begin
  -- 24 Nov 2026 stopgap guards.
  if uid is null then return; end if;
  if not exists (select 1 from partners where id = uid) then return; end if;
  if exists (select 1 from partners where id = uid and outreach_status = 'claimed') then return; end if;

  select * into pre from partners where claim_token = p_claim_token and status = 'pending' limit 1;
  if pre.id is null or pre.id = uid then
    return;
  end if;

  delete from partner_services where partner_id = pre.id;
  delete from partner_availability where partner_id = pre.id;
  delete from partners where id = pre.id;

  update partners set
    slug              = coalesce(slug, pre.slug),
    whatsapp          = coalesce(whatsapp, pre.whatsapp),
    phone             = coalesce(phone, pre.phone),
    opening_hours     = coalesce(opening_hours, pre.opening_hours),
    google_rating     = coalesce(google_rating, pre.google_rating),
    google_reviews    = coalesce(google_reviews, pre.google_reviews),
    outreach_email_at = coalesce(outreach_email_at, pre.outreach_email_at),
    -- keep the studio on the map and in neighbourhood filters after claiming
    latitude          = coalesce(latitude, pre.latitude),
    longitude         = coalesce(longitude, pre.longitude),
    google_place_id   = coalesce(google_place_id, pre.google_place_id),
    neighbourhood     = coalesce(neighbourhood, pre.neighbourhood),
    postal_code       = coalesce(postal_code, pre.postal_code),
    price_from        = coalesce(price_from, pre.price_from),
    hours_token       = coalesce(hours_token, pre.hours_token),
    hours_code        = coalesce(hours_code, pre.hours_code),
    outreach_status   = 'claimed',
    updated_at        = now()
  where id = uid;
end;
$function$;

-- create or replace keeps the grants above; restate them to be sure.
revoke execute on function public.claim_release_prebuilt(uuid) from public, anon;
grant execute on function public.claim_release_prebuilt(uuid) to authenticated, service_role;
