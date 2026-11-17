# letters: postal letters to studios through Pingen

Jordan's private tool (17 Nov 2026). Pick studios, see each letter exactly as it
will be printed, approve or reject each one, and only then post them through
Pingen (Madrid letters are delivered by Hispapost or Correos).

Status: built and tested offline. Not deployed, migration not applied, Pingen
never called.

## How nothing gets posted by accident

- `LETTERS_MODE` unset (or `test`, or anything unknown) means no Pingen request
  at all: no client object can even be built. `staging` uses Pingen's test
  system (nothing printed); `live` prints and posts.
- An approval is bound to the SHA-256 of the exact PDF bytes Jordan looked at.
  Any change to what is printed (settings, template, greeting, address, the
  studio's link, fonts) re-renders the letter and clears the approval.
- Uploading creates the letter in Pingen with `auto_send: false`. Only
  `campaign_send` calls Pingen's send, and only with the passcode, in staging or
  live, after the full preflight, and only if the count and total Jordan
  confirmed equal the server's.
- The legal sender and return address start empty: no letter can be uploaded or
  posted until they are filled in (checked in code and by the `letters_guard`
  trigger, which also enforces the state machine).
- Opted-out, suspended, archived, already-partner, test and recently written
  studios are never eligible; eligibility is checked again at approval, upload
  and send.

## Files

| File | What |
|---|---|
| `index.ts` | Deno entry: secrets, fonts, store, renderer, `Deno.serve` |
| `api.ts` | the JSON API (all ops) and the Pingen webhook receiver |
| `rules.ts` | template and fee checks, address and CSV checks, eligibility, state machine, money, reference codes |
| `templates.ts` | the default letter (Jordan's 17 Nov draft, not yet approved) with English, the approved fee sentence |
| `layout.ts` | A4 geometry, Pingen's window zones, wrapping, the fit algorithm, the box validator |
| `render.ts` | the PDF (pdf-lib, fontkit, qrcode-generator passed in) |
| `sign.ts` | hashing and the studio's signed `/socios` link (same construction as wa-bot) |
| `pingen.ts` | Pingen request builders and client (token cache, upload, create, send, status mapping) |
| `webhook.ts` | Pingen webhook signature check and event planning |
| `auth.ts` | Supabase Auth check against the allowlist, CORS, passcode |
| `db.ts` | the store over PostgREST and Storage (service role) |
| `deps.ts` | pinned esm.sh imports |
| `fonts/` | embedded fonts, licences, `SOURCES.md` |

Schema: `supabase/migrations/20261117_letters.sql`. Function config:
`[functions.letters]` in `supabase/config.toml` (`verify_jwt = false`, because
Pingen's webhooks carry no JWT; every other call checks the user in code).

## Secrets (Supabase, Edge Functions, Secrets)

`LETTERS_MODE`, `PINGEN_CLIENT_ID`, `PINGEN_CLIENT_SECRET`,
`PINGEN_ORGANISATION_ID`, `LETTERS_WEBHOOK_SECRET` (20 to 32 characters),
`LETTERS_PASSCODE` (at least 12), `LETTERS_ADMIN_EMAILS` (optional; exact
addresses; default: the two in `auth.ts`),
`MC_SIGN_KEY` (wa-bot's sign key, for the QR links). The page only ever sees
whether each one is set.

## Tests

```
npm run test:letters
```

The render and glyph tests need pdf-lib 1.17.1, @pdf-lib/fontkit 1.1.1,
qrcode-generator 1.4.4, jsqr and pngjs in a node_modules outside the repo
(`LETTERS_LIBS=/path/to/node_modules`) and poppler-utils; without them they are
skipped. `LETTERS_SAMPLES_DIR` says where the sample PDFs go.

Mailing list: `scripts/letters/seed_from_csv.mjs <list.csv> <out.sql>` writes
the INSERTs outside the repo (it refuses any path inside it); the page's import
does the same with checks.
