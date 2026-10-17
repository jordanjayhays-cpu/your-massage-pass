-- First-visit fee (17 Oct, Jordan: "Let's do 5 euros I think it's more fair
-- at first"). Partner terms, decision 3 of the upgrade week: a free pilot to
-- 30 November, then the studio pays 5 EUR + IVA for a new customer's first
-- visit that actually happened, and nothing for repeat visits. No monthly fee.
--
--   billing_settings.default_fee_eur  10 -> 5
--   billing_settings.fees_from        new: visits before this date (Madrid)
--                                     cost the studio nothing (the pilot)
--   mc_booking_ledger.first_visit     new: no earlier completed visit by the
--                                     same customer (phone or email) at the
--                                     same studio
--   mc_booking_ledger.fee             0 before fees_from and on repeat visits
--   generate_monthly_invoices()       bills only lines with a fee, so a month
--                                     of pilot or repeat visits makes no
--                                     invoice at all
--
-- A per-studio deal in partners.fee_eur / fee_pct still overrides the 5 EUR,
-- but only on a first visit after fees_from. Invoices stay drafts until Jordan
-- taps "Approve and send", as before.

alter table public.billing_settings alter column default_fee_eur set default 5;
alter table public.billing_settings add column if not exists fees_from date not null default '2026-12-01';
update public.billing_settings set default_fee_eur = 5, fees_from = '2026-12-01', updated_at = now() where id = 1;

-- Columns keep their names and order; first_visit is added at the end.
create or replace view public.mc_booking_ledger as
with base as (
  select b.id as booking_id,
         b.partner_id,
         p.business_name,
         coalesce(b.client_name, r.first_name) as client_name,
         coalesce(b.massage_type, r.service_name) as service,
         coalesce(b.start_at, r.confirmed_start,
                  case when b.booking_date ~ '^\d{4}-\d{2}-\d{2}$'
                       then (b.booking_date || ' ' || case when b.booking_time ~ '^\d{1,2}:\d{2}' then substring(b.booking_time from '^\d{1,2}:\d{2}') else '12:00' end)::timestamp at time zone 'Europe/Madrid' end,
                  b.completed_at, b.created_at) as start_at,
         coalesce(b.price, r.price) as price,
         case
           when b.no_show_at is not null or r.no_show_at is not null or r.arrival_status = 'no_show' then 'no_show'
           when b.status = 'cancelled' or r.stage = 'cancelled' then 'cancelled'
           when b.completed_at is not null or r.arrival_status = 'arrived' then 'completed'
           when coalesce(b.start_at, r.confirmed_start) > now() then 'upcoming'
           else 'to_confirm'
         end as attendance,
         p.fee_eur,
         p.fee_pct,
         b.invoice_id,
         -- Who the customer is, for telling a first visit from a repeat. A
         -- Spanish mobile saved without +34 is matched to one saved with it.
         (select case when length(d) = 9 and d ~ '^[6789]' then '34' || d else d end
            from (select regexp_replace(coalesce(nullif(b.client_phone, ''), r.client_phone, ''), '\D', '', 'g') as d) x) as cust_phone,
         lower(trim(coalesce(nullif(b.client_email, ''), r.contact_email, ''))) as cust_email
  from public.bookings b
  join public.partners p on p.id = b.partner_id
  left join public.whatsapp_requests r on b.booking_ref = 'wa-' || r.id::text
  where coalesce(b.is_test, false) = false
), visits as (
  select x.*,
         not exists (
           select 1 from base y
           where y.partner_id = x.partner_id
             and y.booking_id <> x.booking_id
             and y.attendance = 'completed'
             and (y.start_at < x.start_at or (y.start_at = x.start_at and y.booking_id < x.booking_id))
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
         when (v.start_at at time zone 'Europe/Madrid')::date < s.fees_from then 0::numeric
         when not v.first_visit then 0::numeric
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

-- Same as 20261004_billing.sql, except that only lines with a fee are billed:
-- pilot-period and repeat visits never appear on an invoice, and a studio
-- whose month holds only those gets no invoice.
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
  select * into v_set from billing_settings where id = 1;
  for v_partner in
    select distinct l.partner_id
    from mc_booking_ledger l
    where l.attendance = 'completed' and l.invoice_id is null and l.fee > 0
      and (l.start_at at time zone 'Europe/Madrid')::date between v_start and v_end
      and not exists (select 1 from studio_invoices i where i.partner_id = l.partner_id and i.period_start = v_start)
  loop
    select jsonb_agg(jsonb_build_object(
             'booking_id', l.booking_id,
             'date', to_char(l.start_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI'),
             'client', l.client_name,
             'service', l.service,
             'price', l.price,
             'fee', l.fee) order by l.start_at),
           coalesce(sum(l.fee), 0)
      into v_lines, v_sub
    from mc_booking_ledger l
    where l.partner_id = v_partner.partner_id and l.attendance = 'completed' and l.invoice_id is null and l.fee > 0
      and (l.start_at at time zone 'Europe/Madrid')::date between v_start and v_end;

    select count(*) + 1 into v_seq from studio_invoices
     where extract(year from created_at) = extract(year from now()) and number is not null;

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
