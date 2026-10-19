-- Free until the end of the year (Jordan, 19 Oct: "it's going to be free
-- until the end of the year, we can't accept money because we don't have a
-- bank account yet"). The first-visit fee of 5 EUR + IVA now starts with
-- visits on or after 1 January 2027 (Madrid); everything before is 0.00 in
-- mc_booking_ledger, so no invoice is made for 2026. Applied live 19 Oct.
-- Safe to re-run: it only moves the date forward from the old 1 December.
alter table public.billing_settings alter column fees_from set default '2027-01-01';
update public.billing_settings set fees_from = '2027-01-01', updated_at = now()
 where id = 1 and fees_from < '2027-01-01';
