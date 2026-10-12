-- Distance on each studio ask (12 Oct, wa-bot v204, dispatch-studios v40).
--
-- request_dispatch.km is how far the studio is from the area the customer gave,
-- in km, as dispatch_candidates worked it out when the studio was asked. NULL
-- when the area could not be placed or the studio has no coordinates.
--
-- Why: 9 of the 12 customers who got a real studio time since 14 Sept were
-- offered a studio nowhere near them, and the offer never said so. Willy (#107)
-- asked from Orcasitas and Garry (#88) from Tres Cantos, and both were offered
-- Calma in Chamberí. The offer now says "about 9 km from Orcasitas" when a
-- studio is more than 4 km away, and "Closer or cheaper" ranks the next offer
-- by price and then by this distance.
--
-- dispatch-studios writes it in a separate PATCH after the row is created, so
-- deploying the function before this migration costs the distance and nothing
-- else. wa-bot reads it with select=* for the same reason.

alter table public.request_dispatch add column if not exists km numeric;

comment on column public.request_dispatch.km is
  'Distance in km from the customer''s area to the studio when it was asked (dispatch_candidates.km). NULL when unknown.';
