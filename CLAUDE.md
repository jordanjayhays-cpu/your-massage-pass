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
- Never claim massage releases toxins, detoxes, cures, or boosts immunity. Never promise studios speak English. Never offer discounts.
- Instagram account is banned from automation: no DMs, no scheduling tools.
- "Special massage" seekers get the standard shutdown line and no further replies.
- Approval required before any outbound message to third parties, except automations Jordan has explicitly approved (lead-to-studio offer email).
- Test contacts that must never trigger real emails or nudges: jordan.hays@student.ie.edu, jordanjayhays@gmail.com, jordan@massageclub.io, support@massageclub.io, jordan@niahconnect.com, +15622355063, testing.com/example.com/test.com/placeholder.local domains, +mctest/+uitest, names containing test/prueba. Friend testers (never contact, never save as real customers, tests must never reach real studios): Cata (+17867276503, cata.waack@gmail.com) and Yi (+86 numbers ending 997, elon_yilong@student.ie.edu).
