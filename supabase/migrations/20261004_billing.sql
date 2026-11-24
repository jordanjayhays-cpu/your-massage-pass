-- Billing (4 Oct, Jordan): "Invoice, tracking the customer, confirming the
-- appt, auto invoice at the end of the month."
--
-- How money is made: the customer side stays free; the studio pays a referral
-- fee for each booking that actually happened. A booking is billable when the
-- studio confirmed the customer arrived (their "Ha llegado" tap after the
-- appointment), or it was marked completed, and it was not a no-show.
--
--   billing_settings     one row: who issues the invoice, default fee, IVA,
--                        payment terms. Legal name / tax ID / IBAN are left as
--                        TO FILL placeholders on purpose: Jordan enters them.
--   partners.fee_eur /   per-studio deal, overriding the default. fee_pct is a
--   partners.fee_pct     percentage of the booking price instead.
--   studio_invoices      one invoice per studio per month. Starts as a draft;
--                        nothing is sent to a studio until Jordan approves it.
--   bookings.invoice_id  a booking is invoiced once, never twice.
--
-- generate_monthly_invoices() runs on the 1st of each month (pg_cron) for the
-- month that just ended and only ever creates drafts.

create table if not exists public.billing_settings (
  id int primary key default 1 check (id = 1),
  issuer_name text not null default 'TO FILL: legal name',
  issuer_tax_id text not null default 'TO FILL: tax ID',
  issuer_address text not null default 'TO FILL: address',
  issuer_email text not null default 'support@massageclub.io',
  iban text not null default 'TO FILL: IBAN',
  default_fee_eur numeric not null default 10,
  vat_rate numeric not null default 21,
  payment_days int not null default 15,
  invoice_prefix text not null default 'MC',
  updated_at timestamptz not null default now()
);
insert into public.billing_settings (id) values (1) on conflict (id) do nothing;
alter table public.billing_settings enable row level security;

alter table public.partners add column if not exists fee_eur numeric;
alter table public.partners add column if not exists fee_pct numeric;
alter table public.partners add column if not exists billing_name text;
alter table public.partners add column if not exists billing_tax_id text;
alter table public.partners add column if not exists billing_address text;
alter table public.partners add column if not exists billing_email text;

create table if not exists public.studio_invoices (
  id bigserial primary key,
  number text unique,
  partner_id uuid not null references public.partners(id),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  lines jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  vat_rate numeric not null default 21,
  vat numeric not null default 0,
  total numeric not null default 0,
  issued_on date,
  due_on date,
  view_token text not null default encode(gen_random_bytes(12), 'hex'),
  sent_at timestamptz,
  sent_to text,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (partner_id, period_start)
);
alter table public.studio_invoices enable row level security;

alter table public.bookings add column if not exists invoice_id bigint references public.studio_invoices(id);

-- Every real booking with a studio, with whether it happened and what it owes.
create or replace view public.mc_booking_ledger as
select b.id as booking_id,
       b.partner_id,
       p.business_name,
       coalesce(b.client_name, r.first_name) as client_name,
       coalesce(b.massage_type, r.service_name) as service,
       -- start_at is empty on older rows; fall back to the booking's own date,
       -- then when it was completed, then when it was made.
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
       round(coalesce(p.fee_eur,
                      case when p.fee_pct is not null and coalesce(b.price, r.price) is not null
                           then coalesce(b.price, r.price) * p.fee_pct / 100 end,
                      (select default_fee_eur from public.billing_settings where id = 1)), 2) as fee,
       b.invoice_id
from public.bookings b
join public.partners p on p.id = b.partner_id
left join public.whatsapp_requests r on b.booking_ref = 'wa-' || r.id::text
where coalesce(b.is_test, false) = false;

-- Client names live in this view: service role only, never the public API.
alter view public.mc_booking_ledger set (security_invoker = true);
revoke all on public.mc_booking_ledger from anon, authenticated;

-- Drafts for one month (default: the month that just ended). Idempotent: a
-- studio that already has an invoice for the month is skipped, and a booking
-- already on an invoice is never billed again.
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
    where l.attendance = 'completed' and l.invoice_id is null
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
    where l.partner_id = v_partner.partner_id and l.attendance = 'completed' and l.invoice_id is null
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

-- 1st of every month, 07:05 UTC (09:05 Madrid in summer, 08:05 in winter).
select cron.unschedule('mc-monthly-invoices') where exists (select 1 from cron.job where jobname = 'mc-monthly-invoices');
select cron.schedule('mc-monthly-invoices', '5 7 1 * *', $$select public.generate_monthly_invoices()$$);
