# Massage Club — working notes for Claude

## Time and location (do not guess)
- Jordan lives and works in **Madrid, Spain — timezone Europe/Madrid** (CEST, UTC+2 in summer; CET, UTC+1 in winter).
- **Always convert the current UTC time to Madrid time before saying anything about "tonight", "this morning", or scheduling.** Never infer the hour from conversation vibes. Timestamps Jordan pastes from WhatsApp are Madrid local time.
- Jordan often works very late or very early. Do not assume the time of day.

## Who / what
- Jordan Hays runs Massage Club (book.massageclub.io), a Madrid massage concierge for English speakers. WhatsApp Business +34 612 474 827. Emails: jordan@massageclub.io, jordanjayhays@gmail.com, support@massageclub.io (Workspace admin), jordan.hays@student.ie.edu (student).
- Frontend built with Lovable (project 13ab3b1d-1034-4ac7-b40c-8e51807e553c) deploying to this repo's main; Supabase project jglftdstrowwckwqmpue for DB and edge functions.

## Hard rules (standing)
- Customer-facing links must be massageclub.io only. Never send claude.ai links to customers.
- In WhatsApp chats: answers and offers only, links only if someone asks what the service is. Every conversation gets an offer with prices within the first two messages.
- No em dashes in any user-facing copy.
- Always provide an English translation for any Spanish text shown to Jordan.
- Never claim massage releases toxins, detoxes, cures, or boosts immunity. Never promise studios speak English.
- Discounts (Jordan, 5 Sept): we never fund a discount, never invent one, and never quote one to a customer before the studio has confirmed it in writing. On every request the bot asks each studio for a 10% Massage Club rate, tells them truthfully that several studios were asked and the client goes with the best offer, and awards the booking to the best offer (same-day requests go to the first yes). Never tell a studio the client has another booking unless that is true. The customer hears about a discount only on the confirmation, once the studio gave it.
- Instagram account is banned from automation: no DMs, no scheduling tools.
- "Special massage" seekers get the standard shutdown line and no further replies.
- Approval required before any outbound message to third parties, except automations Jordan has explicitly approved (lead-to-studio offer email).
- ASK BEFORE SENDING (Jordan, 7 Sept): when we are drafting, brainstorming or discussing a message, that is NOT permission to send it. Show the final text and ask "can I send it out?", then wait for a yes on that turn. "Send it if it works", a yes to an earlier draft, or enthusiasm mid-discussion do not count. Applies to every channel: WhatsApp, email, anything. Automations Jordan has already approved and told to keep running (the studio outreach drip, the lead-to-studio offer email) carry on without asking each time.
- Test contacts that must never trigger real emails or nudges: jordan.hays@student.ie.edu, jordanjayhays@gmail.com, jordan@massageclub.io, support@massageclub.io, jordan@niahconnect.com, +15622355063, testing.com/example.com/test.com/placeholder.local domains, +mctest/+uitest, names containing test/prueba. Friend testers (never contact, never save as real customers, tests must never reach real studios): Cata (+17867276503, cata.waack@gmail.com) and Yi (+86 numbers ending 997, elon_yilong@student.ie.edu).
- Never confirm attendance to a studio on a customer's behalf. Only the customer's own tap or words confirm. A customer who asks to change or cancel a confirmed booking freezes it: nothing new is promised to the studio until the customer names a time.
- Names (Jordan, 6 Sept): messages to customers on the bot number are signed "Massage Club", never with Jordan's name. Messages to studios (asks, notes, sign-up) are from "Jordan, de Massage Club".
- Studio hours (6 Sept): never ask a studio for a day or time its `partners.opening_hours` say it is closed. dispatch-studios v16 and notify-whatsapp-request v16 enforce this; when a studio tells us its hours in a reply, write them into `opening_hours`. If a customer cancels, every studio that was asked (WhatsApp or email) must be told.
- The bot never hands off to "a representative". It answers, keeps the customer in the booking flow, and tells Jordan. A "wants a person" email goes to jordan@massageclub.io and jordanjayhays@gmail.com only when someone explicitly asks for a person.
