# Massage Club — the 5 sessions plan

Written 2026-09-25. Replaces the board task "get 5 paying sessions booked this month", which was
an outcome, not a task, and sat untouched for 19 days because nobody could start it.

## What the database actually says

Read from Supabase `jglftdstrowwckwqmpue`, 2026-09-25.

| Signal | Value |
| --- | --- |
| WhatsApp bot | **Alive.** 2,464 messages, newest today |
| Requests, last 30 days | **64** |
| Requests that became a booking, last 30 days | **1** |
| Last booking of any status | **2026-09-10** |
| Last confirmed booking | **2026-09-07** |
| Last *completed* session | **2026-08-24** |
| All-time bookings | 41 — 21 confirmed, 17 cancelled, **3 completed** |

**The top of the funnel is not the problem.** Of the 35 "dismissed" requests in the last 30 days,
most are legitimate cleanup: 12 test contacts, 4 duplicates of the same customer inside 24h, two
job seekers asking for work rather than a massage, and one out-of-zone. Demand is arriving and the
bot is handling it.

## The actual leak: 13 warm requests nobody closed

| Stage | Count | Newest | Studio replied? | Became a booking? |
| --- | --- | --- | --- | --- |
| `studio_replied` | **7** | 2026-09-21 | yes, all 7 | **0** |
| `offered` | **6** | 2026-09-21 | yes, all 6 | **0** |

**Thirteen people asked for a massage, a studio said yes, and none of them were booked.** Some are
four days old. That is the whole problem in one line.

Not "we need more demand." Not "the site needs work." Thirteen warm, unclosed requests, sitting in
the database right now.

## The plan

### Step 1 — Claude pulls the 13 (today, no input needed)
A list: request id, first name, contact channel, studio, service, what the studio actually replied,
the offered time, how many days stale. One page.

**Done when:** Jordan has the list and can read it in two minutes.

### Step 2 — Jordan closes them by hand (one sitting, ~45 min)
Not automation. A human message to each, in the concierge model this business was designed around.
Script per case, drafted by Claude in step 1:
- **Studio replied with a time** → send the customer that time, ask yes/no.
- **Studio replied vaguely** → pick a time, offer it, ask yes/no.
- **Older than 7 days** → assume dead, send one re-ask with a discount, then close it.

**Done when:** every one of the 13 has had a human message and a status set. Target: 5 say yes.
That is the five sessions, and they already exist.

### Step 3 — Claude finds why the handoff broke (after step 2)
Thirteen consecutive requests stalling at the same two stages is a mechanism, not bad luck. Either
an automation stopped firing around 10 September, or the offer step needs a human and nobody knew.
Diagnosis, then the smallest fix.

**Done when:** a named cause, and a one-line fix or a documented "this step is manual by design".

### Step 4 — Jordan calls Calma Madrid Spa (20 min, only if step 2 shows studio friction)
One phone call to the one onboarded studio. Two questions: are you still in, and what would make you
answer faster? Skip this if the studios were responsive in step 2 — the data says they replied to
all 13, so this is probably not the bottleneck.

## What this plan deliberately does NOT do

- **No new marketing.** 64 requests in 30 days is enough demand to produce 5 sessions. Adding
  traffic to a funnel that converts 1-in-64 wastes the traffic.
- **No new studios.** Onboarding a second studio does not help until the first one's requests close.
- **No app changes** until step 3 names a cause.

## The number to watch

**Completed sessions, not bookings.** All-time: 41 booked, 3 completed. A confirmed booking that
never happens is not revenue, and the 17 cancellations say this is the real failure mode.
Per the lane rules: a reimbursed test is a paid experiment, not revenue.

## Accept when

Five customers have had a session and the `bookings` row says `completed` — not confirmed,
completed. And step 3 has named why 13 requests stalled.
