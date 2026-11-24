-- First-visit fee (17 Oct, Jordan: "Let's do 5 euros I think it's more fair
-- at first"). Partner terms, decision 3 of the upgrade week: a free pilot to
-- 30 November, then the studio pays 5 EUR + IVA for a new customer's first
-- visit that actually happened, and nothing for repeat visits. No monthly fee.
--
--   billing_settings.default_fee_eur  10 -> 5
--   billing_settings.fees_from        new: visits before this date (Madrid)
--                                     cost the studio nothing (the pilot)
--   mc_booking_ledger.first_visit     new: the customer (phone or email) has
--                                     no earlier completed visit at the same
--                                     studio and was never billed there
--   mc_booking_ledger.fee             0 before fees_from and on repeat visits;
--                                     an invoiced row shows what was billed
--   generate_monthly_invoices()       bills only lines with a fee, picks up
--                                     late-confirmed lines from earlier months,
--                                     and numbers invoices from the highest
--                                     number so a deleted draft cannot collide
--
-- A per-studio deal in partners.fee_eur / fee_pct still overrides the 5 EUR,
-- but only on a first visit after fees_from (none is set on 17 Oct). Bookings
-- by the CLAUDE.md test contacts never reach the ledger. Invoices stay drafts
-- until Jordan taps "Approve and send", as before.
--
-- Safe to re-run: it never resets a fee or fees_from Jordan changed later.

alter table public.billing_settings alter column default_fee_eur set default 5;
alter table public.billing_settings add column if not exists fees_from date not null default '2026-12-01';
update public.billing_settings set default_fee_eur = 5, updated_at = now() where id = 1 and default_fee_eur = 10;

-- Columns keep their names and order; first_visit is added at the end.
create or replace view public.mc_booking_ledger with (security_invoker = true) as
with src as (
  select b.*,
         r.first_name as r_first_name, r.service_name as r_service_name, r.price as r_price,
         r.confirmed_start as r_confirmed_start, r.no_show_at as r_no_show_at,
         r.arrival_status as r_arrival_status, r.stage as r_stage,
         -- Who the customer is, for telling a first visit from a repeat. Each
         -- source is cleaned on its own, so a blank or placeholder on the
         -- booking still falls back to the WhatsApp request.
         coalesce(nullif(regexp_replace(regexp_replace(coalesce(b.client_phone, ''), '\D', '', 'g'), '^00', ''), ''),
                  regexp_replace(regexp_replace(coalesce(r.client_phone, ''), '\D', '', 'g'), '^00', '')) as phone_digits,
         coalesce(nullif(lower(trim(b.client_email)), ''), lower(trim(coalesce(r.contact_email, '')))) as cust_email
  from public.bookings b
  left join public.whatsapp_requests r on b.booking_ref = 'wa-' || r.id::text
  where coalesce(b.is_test, false) = false
), base as (
  select s.id as booking_id,
         s.partner_id,
         p.business_name,
         coalesce(s.client_name, s.r_first_name) as client_name,
         coalesce(s.massage_type, s.r_service_name) as service,
         coalesce(s.start_at, s.r_confirmed_start,
                  case when s.booking_date ~ '^\d{4}-\d{2}-\d{2}$'
                       then (s.booking_date || ' ' || case when s.booking_time ~ '^\d{1,2}:\d{2}' then substring(s.booking_time from '^\d{1,2}:\d{2}') else '12:00' end)::timestamp at time zone 'Europe/Madrid' end,
                  s.completed_at, s.created_at) as start_at,
         coalesce(s.price, s.r_price) as price,
         case
           when s.no_show_at is not null or s.r_no_show_at is not null or s.r_arrival_status = 'no_show' then 'no_show'
           when s.status = 'cancelled' or s.r_stage = 'cancelled' then 'cancelled'
           when s.completed_at is not null or s.r_arrival_status = 'arrived' then 'completed'
           when coalesce(s.start_at, s.r_confirmed_start) > now() then 'upcoming'
           else 'to_confirm'
         end as attendance,
         p.fee_eur,
         p.fee_pct,
         s.invoice_id,
         s.commission,
         -- A Spanish mobile or landline saved without 34 matches one saved
         -- with it; a run of one repeated digit is a placeholder, not a phone.
         case when s.phone_digits ~ '^(\d)\1+$' then ''
              when length(s.phone_digits) = 9 and s.phone_digits ~ '^[6789]' then '34' || s.phone_digits
              else s.phone_digits end as cust_phone,
         s.cust_email
  from src s
  join public.partners p on p.id = s.partner_id
  -- CLAUDE.md test contacts: never billed, even if a row was not flagged.
  where s.cust_email !~ '(@massageclub\.io|@(example|test|testing)\.com|@placeholder\.local)$'
    and s.cust_email !~ '\+(mctest|uitest)'
    and s.cust_email not in ('jordanjayhays@gmail.com', 'jordan.hays@student.ie.edu', 'jordan@niahconnect.com',
                             'cata.waack@gmail.com', 'elon_yilong@student.ie.edu')
    and s.phone_digits not in ('15622355063', '34612474827', '17867276503')
    and s.phone_digits !~ '^86\d*997$'
    and coalesce(s.client_name, s.r_first_name, '') !~* '(\mtest|prueba)'
), visits as (
  select x.*,
         not exists (
           select 1 from base y
           where y.partner_id = x.partner_id
             and y.booking_id <> x.booking_id
             -- Already billed at this studio, whatever the date, or an earlier
             -- visit that happened. A late "It happened" tap on an older
             -- visit can never make a studio pay twice for one customer.
             and (y.invoice_id is not null
                  or (y.attendance = 'completed'
                      and (y.start_at < x.start_at or (y.start_at = x.start_at and y.booking_id < x.booking_id))))
             and ((length(x.cust_phone) >= 8 and y.cust_phone = x.cust_phone)
                  or (x.cust_email like '%@%' and y.cust_email = x.cust_email))
         ) as first_visit
  from base x
)
select v.booking_id,
       v.partner_id,
       v.business_name,
       v.client_name,
       v.service,
       v.start_at,
       v.price,
       v.attendance,
       case
         when v.invoice_id is not null then coalesce(v.commission, 0)
         when (v.start_at at time zone 'Europe/Madrid')::date < s.fees_from then 0.00
         when not v.first_visit then 0.00
         else round(coalesce(v.fee_eur,
                             case when v.fee_pct is not null and v.price is not null
                                  then v.price * v.fee_pct / 100 end,
                             s.default_fee_eur), 2)
       end as fee,
       v.invoice_id,
       v.first_visit
from visits v
cross join (select default_fee_eur, fees_from from public.billing_settings where id = 1) s;

-- Client names live in this view: service role only, never the public API.
alter view public.mc_booking_ledger set (security_invoker = true);
revoke all on public.mc_booking_ledger from anon, authenticated;

-- As in 20261004_billing.sql, with three changes: only lines with a fee are
-- billed (pilot and repeat visits never appear, and a studio whose month holds
-- only those gets no invoice); a visit confirmed after its month was invoiced
-- goes on the next invoice instead of being lost; and the number comes from
-- the highest existing one, under a lock, so deleting a draft or a click
-- during the cron run cannot produce a duplicate number.
create or replace function public.generate_monthly_invoices(p_month date default (date_trunc('month', now() at time zone 'Europe/Madrid') - interval '1 month')::date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_set record;
  v_partner record;
  v_lines jsonb;
  v_sub numeric;
  v_id bigint;
  v_seq int;
  v_made int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('mc_invoice_numbers'));
  select * into v_set from billing_settings where id = 1;
  for v_partner in
    select distinct l.partner_id
    from mc_booking_ledger l
    where l.attendance = 'completed' and l.invoice_id is null and l.fee > 0
      and (l.start_at at time zone 'Europe/Madrid')::date <= v_end
      and not exists (select 1 from studio_invoices i where i.partner_id = l.partner_id and i.period_start = v_start)
  loop
    select jsonb_agg(jsonb_build_object(
             'booking_id', l.booking_id,
             'date', to_char(l.start_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI'),
             'client', l.client_name,
             'service', l.service,
             'price', l.price,
             'fee', l.fee) order by l.start_at, l.booking_id),
           coalesce(sum(l.fee), 0)
      into v_lines, v_sub
    from mc_booking_ledger l
    where l.partner_id = v_partner.partner_id and l.attendance = 'completed' and l.invoice_id is null and l.fee > 0
      and (l.start_at at time zone 'Europe/Madrid')::date <= v_end;

    select coalesce(max((regexp_match(number, '(\d+)$'))[1]::int), 0) + 1 into v_seq
      from studio_invoices
     where number like v_set.invoice_prefix || '-' || to_char(now(), 'YYYY') || '-%';

    insert into studio_invoices (number, partner_id, period_start, period_end, lines, subtotal, vat_rate, vat, total, issued_on, due_on)
    values (v_set.invoice_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0'),
            v_partner.partner_id, v_start, v_end, v_lines, v_sub, v_set.vat_rate,
            round(v_sub * v_set.vat_rate / 100, 2), round(v_sub * (1 + v_set.vat_rate / 100), 2),
            (now() at time zone 'Europe/Madrid')::date,
            (now() at time zone 'Europe/Madrid')::date + v_set.payment_days)
    returning id into v_id;

    update bookings b set invoice_id = v_id,
           commission = (v->>'fee')::numeric
      from jsonb_array_elements(v_lines) v
     where b.id::text = v->>'booking_id';
    v_made := v_made + 1;
  end loop;
  return v_made;
end;
$$;

revoke execute on function public.generate_monthly_invoices(date) from public, anon, authenticated;
