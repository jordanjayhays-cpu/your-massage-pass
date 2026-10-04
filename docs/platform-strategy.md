# Massage Club as a platform (4 Oct 2026)

Four readings from Competing in Platform Markets (IE), applied to our own data.

## What the readings say

**Hagiu & Wright, "What are platform businesses?"** A platform enables *direct* interactions between customers who have *chosen to join* it. A business that sets the terms and carries out the transaction in its own name is a reseller or service provider, not a platform. Most businesses sit somewhere in between.

**Eisenmann, Parker & Van Alstyne, "Strategies for two-sided markets" (HBR 2006).**
- Subsidise the side that is more price- and quality-sensitive, and charge the side that values the other's growth most.
- A giveaway is wasted if the subsidised side can transact through a rival.
- Negative same-side effects (sellers dislike rivals) can justify exclusivity per territory, as Autobytel did.
- Marquee users accelerate growth.
- "Get big fast" is a mistake when the service is not readily scalable, for example when it needs skilled people.

**Cennamo & Santaló, "How to avoid platform traps" (MIT SMR 2015).**
- Trap 1, growth without focus: Groupon set merchants against each other in a discount war.
- Trap 2, straddling mass market and niche: BlackBerry and MySpace tried both and won neither.
- Trap 3, ignoring partners' value proposition: Kindle's low prices pushed publishers away, while Apple let publishers set their own prices.
- Size is not strength.

**Zhu & Iansiti, "Why some platforms thrive and others don't" (HBR 2019).** Scale is easier to get than to keep. Five properties decide which:
- Strength of network effects.
- Clustering: local networks like Uber's are easy to attack; global ones like Airbnb's are not.
- Disintermediation risk: Homejoy died when cleaners and clients went direct.
- Multi-homing.
- Bridging into other networks.

## Massage Club against them (data from the last 30 to 60 days)

| Reading | What our data shows | Implication |
|---|---|---|
| Studios have to join | 183 studios listed, 2 active. Studios are messaged cold, so they haven't chosen to join. | We are a concierge (a service provider), not yet a platform. That is fine at this stage, but the goal is studios that join, set their own prices and slots, and accept the terms. |
| Subsidy side / money side | Customers pay nothing; studios pay nothing. Revenue: 0. | Customers are the subsidy side (price-sensitive, many alternatives). Studios are the money side: they value a steady flow of English-speaking clients. Charge studios, but only for bookings that happened. |
| Trap 1 (discount war) | We ask every studio for a 10% Massage Club rate and tell them the client goes with the best offer. | This is Groupon's discount war, aimed at partners we need. Kindle shows the cost. Let studios set their own price and charge a referral fee instead. **Decision for Jordan.** |
| Trap 2 (niche vs mass) | 89 ad conversations in 30 days: 50 English, 32 Spanish (36%). | The value we add is an English concierge. Spanish speakers can book Treatwell or Fresha directly (multi-homing), so the ads are drifting toward the mass market. Choose a lane. |
| Trap 3 (partner value) / negative same-side effects | KamAI: 23 asks, 0 offers. Masajes Chamberí: 14 asks, 0. Calma: 21 asks, 13 offers, 6 accepted. TornaSol was messaged three times about one customer. | Fewer, better partners, asked less often (the Nintendo and Autobytel approach). |
| Network effects | Customers care about 2 or 3 good studios near them, not 183. | Network effects are weak, like game consoles: a few hits matter. Curate. |
| Clustering | Demand sits in Centro and Sol, and supply there is thin: the top offer for Sol is Calma in Chamberí. | Local cluster. Win neighbourhoods one at a time, starting with Centro and Sol. Visitors to Madrid are the global, Airbnb-like slice of the market. |
| Disintermediation | Studios receive the customer's name, phone and email; the customer gets the studio's address. | A happy customer can rebook directly. Capture value at the match with a fee per completed booking, and keep adding value on our side: English concierge, one-tap rebooking, reviews. |
| Multi-homing | Studios are on Treatwell, Fresha and Booksy too. | We can't prevent it. Be the easiest channel for English speakers. |
| Bridging | None yet. | IE students, hotels and hostels, expat groups, gyms: networks that already contain our customers. |

Funnel, last 60 days: 127 people wrote on WhatsApp → 78 requests → 42 sent to studios → 19 got an offer → 2 customers confirmed → 1 completed massage (all time).

## What changed today

1. **Offer first (wa-bot v152).** After day, time and area the customer sees two real studios with prices and taps one. That studio is asked right away, with the other as backup. The email is asked while they wait.
2. **Ranking rewards offers (dispatch_candidates v4).** A studio is scored on the share of asks that ended in an offer, not just a reply. A studio asked 4 or more times that never offered is rested. Samsara and Masajes Chamberí dropped out of the top 5 for Centro.
3. **Money side (wa-bot v153 and the billing migration).**
   - A referral fee per booking that happened: 10 EUR by default, or set per studio in `partners.fee_eur` / `fee_pct`.
   - The studio's arrival tap now marks the booking completed.
   - Invoice drafts are generated on the 1st of each month.
   - Billing page with one-tap "It happened" / "No-show" / "Approve and send" / "Mark paid".
   - A Spanish invoice page for studios.

## Decisions waiting on Jordan

1. **Fee level** and how to present it to studios: a fixed referral fee per completed booking. Recommended: 8 to 10 EUR or about 15%, charged only after the customer shows up.
2. **Stop the 10% / best-offer auction** (Trap 1) in favour of studio-set prices plus the referral fee. This changes the 5 Sept standing rule.
3. **Niche:** English speakers only in the ads, or serve Spanish speakers too.
4. **Issuer details for invoices:** legal name, tax ID, address, IBAN, and the correct IVA treatment. Check with a gestor, especially if the issuing entity is not Spanish. Fill these into `billing_settings`.
5. **Meta business verification (EIN):** lifts the 250-conversation daily cap and unlocks the in-WhatsApp booking form.
