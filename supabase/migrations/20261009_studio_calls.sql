-- Phone calls to studios through Vapi (9 Oct).
--
-- Jordan: "call 5 or whatever amount of studios at once to get an instant
-- answer". A WhatsApp ask still goes out first and stays the written record;
-- the call is an accelerator on top of it, placed by the studio-calls function
-- and answered through its webhook. Everything here is inert until
-- app_secrets VOICE_CALLS is set to 'test' or 'on'.

-- A studio is only ever phoned after it has agreed to be phoned. Spanish law
-- (LGTel art. 66.1.a) wants prior consent for automated calls, and goodwill
-- wants it anyway: Centro Aloha left over too many WhatsApp asks.
alter table public.partners add column if not exists call_ok boolean not null default false;
alter table public.partners add column if not exists call_ok_at timestamptz;
alter table public.partners add column if not exists call_ok_note text;
-- The front desk line to ring when it differs from the WhatsApp number
-- (Calma: landline +34 919 891 916, WhatsApp +34 660 390 910).
alter table public.partners add column if not exists call_phone text;

-- Which ask a result came from. Null is the WhatsApp template, 'call' a phone
-- answer. request_dispatch.phone keeps the WhatsApp number, because stand-downs
-- and the written confirmation go there and taps are matched by it.
alter table public.request_dispatch add column if not exists channel text;

-- One row per call. Unique per request and studio, so nobody is rung twice
-- about the same customer.
create table if not exists public.studio_calls (
  id uuid primary key default gen_random_uuid(),
  request_id bigint,
  partner_id uuid,
  dispatch_id uuid,
  test boolean not null default false,
  vapi_call_id text unique,
  dialled text,
  status text not null default 'queued',      -- queued | ringing | in-progress | ended | failed
  result text,                                -- yes | other_time | no | wants_person | no_answer | voicemail | busy | no_result | failed
  offered_time text,
  offered_times text[],
  price_said numeric,                         -- said out loud, never quoted to a customer
  discount_said boolean,
  notes text,
  ended_reason text,
  summary text,
  transcript text,
  cost numeric,
  duration_s numeric,
  error text,
  relayed_at timestamptz,
  relay_out jsonb,
  vars jsonb,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index if not exists studio_calls_req_partner on public.studio_calls (request_id, partner_id) where not test;
create index if not exists studio_calls_created on public.studio_calls (created_at desc);
alter table public.studio_calls enable row level security;  -- service role only, no policies

-- Two studios can say yes within seconds of each other. The customer must see
-- one offer at a time, and wa-bot's one-live-offer check is a read then a
-- write, so call results for one request are handed over one at a time.
create table if not exists public.call_relay_locks (
  request_id bigint primary key,
  locked_until timestamptz not null
);
alter table public.call_relay_locks enable row level security;

create or replace function public.claim_call_relay(p_request bigint, p_secs int default 30)
returns boolean
language sql
security definer
set search_path = public
as $$
  with ins as (
    insert into call_relay_locks (request_id, locked_until)
    values (p_request, now() + make_interval(secs => p_secs))
    on conflict (request_id) do update set locked_until = excluded.locked_until
      where call_relay_locks.locked_until < now()
    returning 1
  )
  select exists (select 1 from ins);
$$;

create or replace function public.release_call_relay(p_request bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update call_relay_locks set locked_until = now() - interval '1 second' where request_id = p_request;
$$;

revoke all on function public.claim_call_relay(bigint, int) from public, anon, authenticated;
revoke all on function public.release_call_relay(bigint) from public, anon, authenticated;
grant execute on function public.claim_call_relay(bigint, int) to service_role;
grant execute on function public.release_call_relay(bigint) to service_role;
