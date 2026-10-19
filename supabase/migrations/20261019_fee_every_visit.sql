-- 5 EUR + IVA for EVERY visit Massage Club books, first or repeat (Jordan,
-- 19 Oct: "i want to earn when the customer comes back because i want to sell
-- that customer the option to go to other studios because the studios will
-- offer the best deal to MC"; he chose "5 EUR + IVA every visit"). Every row in
-- bookings is a visit Massage Club booked, so a completed one after fees_from
-- (1 Jan 2027, free until then) costs the studio 5 EUR + IVA. A customer who
-- books the studio directly never reaches this table and costs nothing.
-- first_visit stays in the view as information only; it no longer sets fee.
-- Same columns, same order. Applied live 19 Oct.

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

