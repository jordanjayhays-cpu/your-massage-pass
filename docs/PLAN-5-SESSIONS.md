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

---

# ROOT CAUSE FOUND — 2026-09-25

I was wrong twice on the way here, so both corrections are recorded.

**Wrong once:** I said "60 edge functions and 19 crons run constantly and produce nothing." Not true.
**Wrong twice:** I said the n8n stall digest duplicated `stuck-booking-rescue`. Also not true.

## The actual bug is one line

`stuck-booking-rescue` runs every 30 minutes and does watch `whatsapp_requests` at exactly the
stages that matter (`new, studio_asked, studio_replied, offered`). It is a serious piece of work —
version 10, with guards for customers who said no, customers owed an answer, quiet hours, and
duplicate sends.

But its query is bounded at both ends:

```
created_at=lt.${cutStuck}   -- older than 1 hour
created_at=gt.${cutMax}     -- AND NEWER THAN 24 HOURS
```

**`cutMax` is 24 hours.** A request that is still unresolved after one day falls out of the window
and nothing looks at it again, ever.

**All 13 cold requests are 4 to 20 days old.** They aged out of the only system watching them.
They were not stuck in a broken machine; they fell off the end of the conveyor belt.

## Why the reminder system looked broken and was not

`booking-reminders` fires 96 times a day and has reminded 2 people ever, most recently 28 August.
That is correct behaviour: **there are zero bookings dated today or later.** The latest booking date
in the table is 2026-09-11. You cannot remind someone about an appointment that does not exist.

The whole chain reads:

1. Requests arrive — still happening, newest 22 Sept ✅
2. Studios are asked and reply — still happening ✅
3. **Somebody turns the studio's yes into a booking row** ❌ *nobody owns this after day one*
4. Reminders, calendar invites, review requests — all correct, all idle for lack of input

Step 3 is a human step. The concierge step. It has no owner past the 24-hour mark.

## What was built

**`mc_cold_requests_digest()`** on `jglftdstrowwckwqmpue`, scheduled as `mc-cold-requests-daily`
(`0 7 * * *`, 09:00 Madrid). It finds requests at `studio_replied` or `offered` **older than 24
hours** — precisely the blind spot — skips anyone flagged cancelled or change_requested, and posts a
digest to the n8n webhook, which emails Jordan. It sends nothing on a clean day.

Verified end to end on 2026-09-25: the function found 13, the webhook fired, n8n ran
`Webhook → Any stalled? → Email Jordan`, and the mail was sent.

**This does not message customers.** After five days of silence an automated message is worse than
a human one, and `THE-13.md` already has a drafted message per person.

## The order of work is now unambiguous

1. Send the 13 messages from `THE-13.md`.
2. Each yes becomes a booking row.
3. The existing stack — reminders, calendar, review requests, rebook nudges — wakes up on its own,
   because it was never broken.

Nothing else needs building.

## Built but DISARMED — Jordan's call, 2026-09-25

Everything above is built, tested end to end, and then deliberately switched off.

| Piece | State |
| --- | --- |
| `mc_cold_requests_digest()` function | Exists on `jglftdstrowwckwqmpue`. Callable by hand, fires nothing on its own |
| `mc-cold-requests-daily` cron (jobid 38) | **INACTIVE.** Schedule `0 7 * * *` preserved |
| n8n `Massage Club — warm requests going cold` (`pKeG5ceHBacESt5k`) | **INACTIVE** |

### To arm it — two commands

```sql
-- 1. wake the daily sweep (09:00 Madrid)
select cron.alter_job(38, active := true);
```

```bash
# 2. wake the workflow that turns the digest into an email
curl -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://neuromatch.app.n8n.cloud/api/v1/workflows/pKeG5ceHBacESt5k/activate
```

Swap `activate` for `deactivate` and `true` for `false` to put it back to sleep.

### To run it once, by hand, without arming anything

```sql
select mc_cold_requests_digest();
```

Returns the count and the full summary text. It only sends an email if the n8n workflow above is
active, so with the workflow off this is a pure read.

### What is still active in n8n, and why it cannot fire

`Amigo Sales — send as jordan@amigosales.com` and `Board — urgent task landed` are active, but both
are webhook-only. Nothing currently POSTs to either, so neither can fire by itself. They are tools
waiting to be called, not jobs waiting to run.
