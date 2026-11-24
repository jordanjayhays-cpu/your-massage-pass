# AGENTS.md — massage-madrid-magic (Massage Club / "Your Massage Pass")

Read this before touching anything. It exists so you don't burn tokens rediscovering the repo.

## What this is
Vite + React + TypeScript + shadcn/ui. A pay-per-session massage booking marketplace for Madrid studios.
Live (production): https://book.massageclub.io on Vercel (see `vercel.json`); `CLAUDE.md` is the source of truth.
massage-madrid-magic.lovable.app is the Lovable preview, not production. UNSURE whether the Lovable ↔ GitHub sync is still active; treat Lovable edits as previews that spend credits.

## Where things live

| What | Path |
|---|---|
| App screens (all user-facing pages) | `src/app/screens/*.tsx` |
| Layout / shell | `src/app/AppLayout.tsx`, `src/app/MobileFrame.tsx` |
| Bottom nav | `src/app/components/BottomNav.tsx` |
| Booking state | `src/app/BookingContext.tsx` |
| Static/demo data | `src/app/data.ts` |
| Supabase client | `src/lib/supabase.ts` |
| Referral logic | `src/lib/referral.ts` |
| **i18n config** | `src/i18n/index.ts` |
| **Translations** | `src/i18n/{en,es,zh,fr,de,pt,it,ar}.json` |
| Language switcher | `src/components/LanguageToggle.tsx`, `src/components/LanguageFlagToggle.tsx` |
| shadcn primitives | `src/components/ui/*` — do not edit, these are generated |
| SQL schema files | `supabase-*.sql` at repo root |

## partners table: column lock (24 Nov 2026). Read before touching partners

The public key and signed-in studios may read only the columns in
`src/lib/partnerColumns.ts` and write only the INSERT/UPDATE list in
`supabase/migrations/20261124e_partners_column_lock.sql`. Why: `select("*")` on
partners handed every studio's claim code, hours code and Google tokens to
anyone with the public key.
- Never `select("*")` or `select()` on partners. Name the columns, or use
  `PARTNER_PUBLIC_COLUMNS`. A `select("*")` builds fine and then fails live
  (42501), and the homepage directory silently shows no studios.
- A new partners column is invisible to the site until a migration GRANTs it.
  Never grant a token, code or secret column (claim_token, hours_token,
  hours_code, google_*), and never run a table-level GRANT on partners.
- Claims: `/claim/<slug>` opens `/studio-setup?claim_slug=<slug>`. The claim
  token is never read in the browser; the merge of the pre-built row is
  `rpc("claim_release_verified")`, which needs proof of the email on file.
- `npm run build` runs `src/__tests__/partnersColumnLock.test.ts` first
  (prebuild) and fails on any of the above.

## i18n — READ THIS, IT'S THE #1 SOURCE OF BUGS

Setup: `i18next` + `react-i18next` + browser language detector.
- Config: `src/i18n/index.ts`
- Namespace: single `translation` namespace per language. Keys are dot-paths like `app.profile.header.title`.
- `fallbackLng: "en"` — **so a key missing ONLY from zh.json shows ENGLISH, not a raw key.**
- Supported: en, es, zh, fr, de, pt, it, ar. Arabic sets `dir="rtl"` automatically.
- Language persists in localStorage under `mm-lang`.

### Debugging rule (memorise this)
- Screen shows **English text** when another language is selected → key missing from that language's file only.
- Screen shows the **raw key** (e.g. `app.profile.save`) → the key path is broken/absent in **en.json too**. Fix the structure, not the translation.

### Known structural bug (as of 2026-07-17)
`en.json` has **duplicated nesting**:
- `app.profile.app.profile.*` should be `app.profile.*`
- `app.calendar.app.calendar.*` should be `app.calendar.*`

Components call `t("app.profile.header.title")`, which resolves to nothing → raw keys render. `zh.json` is also missing the entire `app.profile` block and truncates inside `app.customize`.

Fix = flatten the duplicated nesting in `en.json`, then mirror the corrected structure into the other 7 locale files.

### Rules when touching i18n
1. `en.json` is the source of truth for structure. Every other locale mirrors its shape exactly.
2. Never add a key to one locale without adding it to `en.json` first.
3. Interpolation uses `{{var}}` — keep placeholders identical across all languages.
4. After changing keys, grep the `src/app/screens` for the old path before assuming nothing else uses it.

## Conventions
- TypeScript strict. No `any` without a comment justifying it.
- Tailwind for styling. No inline style objects unless dynamic.
- shadcn components come from `src/components/ui` — compose them, don't fork them.
- All user-facing strings go through `t()`. Never hardcode copy in a component.
- Env vars are Vite-style: `VITE_*`, read via `import.meta.env`. Never hardcode keys or URLs.

## Commands
```
npm install
npm run dev      # local dev
npm run build    # must pass with no TS errors before you commit
npm run lint
```

## Boundaries
- Never edit `src/components/ui/*` (generated).
- Never commit `.env`.
- Never touch the agent board database (`dprdnrgjkzgfgtcsguuq`) from app code — that's for agents only.
- Don't refactor beyond the task's scope. Small diffs.
