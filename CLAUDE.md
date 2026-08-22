# Working notes for Claude sessions — Massage Club (your-massage-pass)

Read this first; it saves every session from rediscovering the setup.

## This lane
- **Massage Club** — Madrid massage-studio marketplace, LIVE at book.massageclub.io (Vercel).
- Database: Supabase `jglftdstrowwckwqmpue`. **Separate from the agent board** (`neurodashboards`,
  `dprdnrgjkzgfgtcsguuq`) — never mix the two.
- Business reality (do not inflate): **1 onboarded studio (Calma Madrid Spa)**, not "73 partners" —
  the directory lists scraped studios, onboarded ≠ listed. The model: client books via MC, pays the
  studio full rate, MC reimburses test bookings. **A reimbursed test is a paid experiment, not revenue.**
- Current play: concierge-first (book massages for real people by hand, learn, then automate).

## Operator rules (binding)
- Ambiguous ask → ask up to 5 short questions before building. Never guess constraints.
- Never state a fact, name, or email you haven't verified — write UNSURE and flag it.
- Outward-facing work (outreach, posts, payments) → list top 3 failure modes, fix, then proceed.
- Creative work → 3 versions (safe/bold/weird), one-line tradeoffs.
- Big deliverables end with "Accept when: …".
- Minimal surgical edits; verify with a read-back before claiming success; check output, never status.
- Anything only Jordan can do → task on the `agent_tasks` board (`neurodashboards`), assigned `jordan` —
  his 09:00 brief reads it. If it is not on the board, it does not exist.

## Token discipline
One lane per session. Name columns + LIMIT in SQL. Iterate functions locally, deploy once.
Bulk row analysis (>~20 rows) → delegate to the `agent-worker` edge function on `neurodashboards`.

**The master map lives in `mission-control/CLAUDE.md`.**
