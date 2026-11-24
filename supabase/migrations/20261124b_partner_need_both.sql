-- Partner onboarding (24 Nov, Jordan: "what if they want both fill my bookings
-- and run my bookings?"). A studio can tick both cards; that is saved as 'both'.

alter table public.partners drop constraint if exists partners_partner_need_chk;
alter table public.partners add constraint partners_partner_need_chk
  check (partner_need is null or partner_need in ('fill_gaps', 'full_system', 'both'));

comment on column public.partners.partner_need is
  'Onboarding answer: fill_gaps = send them customers for last-minute and empty slots; full_system = they want Massage Club as their booking system; both = both.';
