# AGENTS.md — massage-madrid-magic (Massage Club / "Your Massage Pass")

Read this before touching anything. It exists so you don't burn tokens rediscovering the repo.

## What this is
Vite + React + TypeScript + shadcn/ui. A pay-per-session massage booking marketplace for Madrid studios.
Live: https://massage-madrid-magic.lovable.app
Deploys via Lovable ↔ GitHub sync. Push to `main` → Lovable syncs → Jordan publishes.

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
