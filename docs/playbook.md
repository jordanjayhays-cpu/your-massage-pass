# Massage Club playbook

Copy-paste messages and the rules behind them, so nobody has to ask for a draft.
Spanish goes to studios, English to English-speaking customers. Every Spanish
text has its English meaning underneath. No em dashes anywhere.

## How a booking works now (September 2026)

1. Customer asks the bot (WhatsApp +34 613 977 900) for a massage: type, day, time, area.
2. `dispatch-studios` asks up to 5 studios in the area with the `solicitud_reserva`
   template. The ask says, truthfully, that several studios were asked, the client
   goes with the best offer, and invites a 10% Massage Club rate.
3. A studio taps Confirmado:
   - Same-day request: first yes wins at once.
   - Any other day: a 10 minute bidding window opens. A studio that writes "10%"
     (or more) wins at once. When the window closes, the best accepted offer wins
     (highest discount, then earliest yes). Cron `bidding-settle-5min` closes windows.
4. The winner gets the confirmation card (customer first name and language, service,
   time, discount if any, sign-up link if not yet a partner). The customer gets the
   studio, time, address and, only if the studio gave one, the discount.
5. Everyone else is stood down politely.
6. `booking-guard` runs the day-of flow: T-3h customer check, T-1h studio warning,
   T+20 arrival question. The bot handles every tap. Jordan is only alerted for a
   cancellation, a change, a no-show or a complaint.

Studios with `booking_mode = 'online'` (The Nook) only book through their own
site; the customer gets `booking_url` instead of the bot asking the studio.

## Discount rules

- We never fund a discount and never invent one.
- We ask every studio for 10% for Massage Club clients, on every request.
- We only quote a discount to a customer after the studio confirmed it in writing.
  It is stored on the request (`discount_pct`) and on the studio (`mc_discount_pct`).
- Never tell a studio the client has another booking unless it is true. "Several
  studios were asked and the client goes with the best offer" is always true.

## Messages to studios (Jordan's number)

**First contact, warm (they replied to a bot ask or accepted once)**

> Hola, soy Jordan, de Massage Club. Gracias por responder tan rápido a la reserva de [día]. Me gustaría que fuerais nuestro centro de referencia en [zona]: os mandamos clientes sin comisión, el cliente paga en el centro, y vosotros decidís si aceptáis cada reserva a mano o en automático. ¿Os va bien que os dé de alta y hablamos 5 minutos esta semana?

Hi, I'm Jordan from Massage Club. Thanks for answering [day]'s booking so fast. I'd like you to be our go-to studio in [area]: we send you clients with no commission, the client pays at the studio, and you decide whether to accept each booking manually or automatically. Is it OK if I set you up and we talk for 5 minutes this week?

**Discount ask on a booking that is already confirmed**

> Una cosa más sobre [nombre], [día] a las [hora]: ¿le podéis hacer un 10% de descuento como cliente de Massage Club? Os iremos trayendo más clientes, sin comisión, y el cliente paga en el centro. Si no os es posible, lo entiendo perfectamente.

One more thing about [name], [day] at [time]: could you give them 10% off as a Massage Club client? We'll keep bringing you clients, no commission, and the client pays at the studio. If it's not possible, I completely understand.

**Closing without booking (studio said yes, client went elsewhere)**

> Gracias de verdad por la rapidez. Al final el cliente se ha quedado con otra opción que ya tenía, así que hoy no reservamos. Os escribo con la siguiente. Buen fin de semana.

Thank you for the quick reply. In the end the client kept another option they already had, so no booking today. I'll write with the next one. Have a good weekend.

**Late reply to a covered request**

> Gracias por avisar, esa reserva ya quedó cubierta. Os escribimos con la siguiente. Jordan, Massage Club

Thanks for letting us know, that booking is already covered. We'll write with the next one.

**Opt-out received (Art Thai style)**

> Hola, soy Jordan Hays, de Massage Club. Lamento las molestias. Ya hemos retirado [centro] de nuestra web y de nuestra lista de contacto, y no volveréis a recibir mensajes ni solicitudes nuestras. Os pido disculpas por haberos escrito varias veces sin haber hablado antes con vosotros. Si algún día cambiáis de opinión, aquí estaremos. Un saludo, Jordan

Hi, I'm Jordan Hays from Massage Club. Sorry for the trouble. We have removed [studio] from our website and our contact list, and you will not receive any more messages or requests from us. I apologise for writing several times without having spoken with you first. If you ever change your mind, we'll be here. Regards, Jordan.

Then: set `opted_out_at`, `outreach_status = 'opted_out'`, `status = 'suspended'` on the partner.

## Messages to customers (Jordan's number, English)

**Personal note after a confirmed booking**

> Hi [name], Jordan from Massage Club. You're set: [service], [day] at [time], [studio], [address]. You pay at the studio. If anything doesn't work for you, tell me and I'll sort it, no problem.

**Booking is in a different district than they asked**

> Hi [name], Jordan from Massage Club. Nobody in [asked area] could take [day] evening, so I booked you at [studio], [address], about [n] minutes further on the metro. If that doesn't work, tell me and I'll cancel it for you.

**Consent to be quoted (after the massage)**

> Glad it went well. Would you mind if I quote your first name and one line about it on our site? No pressure at all.

If yes: set `share_ok = true` on the request. The home page strip shows the first name only after that; until then it shows an initial.

## Who does what

- The bot: every customer question, every studio ask, confirmations, stand-downs,
  reminders, no-shows, late replies.
- `studio-followups` (cron, every 10 min, 09:00 to 21:00 Madrid): the studio
  relationship without a person. A studio that writes BAJA or "no nos escribáis
  más" is opted out, hidden from the site and gets the apology automatically. A
  studio that replied and is not yet a partner gets the free sign-up link once.
  A confirmed booking with no discount gets one 10% ask to the studio; a written
  percentage is recorded and the customer is told.
- Cron: dispatch sweep (every 20 min, 08:00 to 22:00 Madrid), bidding settle
  (every 5 min), booking-guard (every 10 min), rescue (every 30 min).
- The hourly reply watch (Claude routine): emails support@ only when something
  new happened that the bot did not handle.
- Jordan: nothing routine. The messages above exist for the rare case a studio
  asks for a person by name or a situation goes wrong. Everything else is sent
  by the bot.
