-- 19 Nov 2026 (#126): the service words a studio was asked for.
--
-- dispatch-studios v50 writes, after each ask, the {{2}} phrase the studio read
-- without its article ("masaje relajante de 60 min", or a studio's own service
-- from service_by_partner, "masaje tailandés de 60 min con presión firme").
-- wa-bot's confirmation (acceptOffer) repeats it, so the studio is never told a
-- raw English name: #126 was asked as "un masaje relajante de 60 min" and
-- confirmed as "not sure de 60 min".
--
-- Nullable, no default: rows asked before this exist without it, and wa-bot
-- falls back to the same table dispatch-studios uses (askServicio). Safe to run
-- before or after either function is deployed: dispatch-studios writes it in
-- its own PATCH, which fails alone while the column is missing.
--
-- NOT APPLIED. Apply only with Jordan's go-ahead.

alter table public.request_dispatch add column if not exists asked_service text;

comment on column public.request_dispatch.asked_service is
  'Service words the studio read in the ask, without the article (e.g. "masaje relajante de 60 min"). Written by dispatch-studios v50; repeated by wa-bot in the confirmation.';
