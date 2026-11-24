// Letters (17 Nov 2026): edge function entry. Jordan's private tool for postal
// letters to studios through Pingen (book.massageclub.io/letters.html calls
// this JSON API; Pingen's webhooks arrive at ?pingen_webhook=1).
//
// Deployed with verify_jwt = false (supabase/config.toml) because Pingen's
// webhooks carry no JWT. Every other call is checked in code: a signed-in
// Supabase Auth user whose USER ID is in LETTERS_ADMIN_USER_IDS, with a
// confirmed email and a Google identity for it (auth.ts). Unset: nobody.
//
// Secrets (Supabase, Edge Functions, Secrets; never in code or the DB):
//   LETTERS_MODE            test (default: no Pingen call at all) | staging | live
//   PINGEN_CLIENT_ID, PINGEN_CLIENT_SECRET, PINGEN_ORGANISATION_ID
//   LETTERS_WEBHOOK_SECRET  20 to 32 characters, also given to Pingen
//   LETTERS_PASSCODE        at least 12 characters; needed to post
//   LETTERS_ADMIN_USER_IDS  Supabase Auth user ids allowed in (required; the
//                           refusal page shows the signed-in account its id)
//   MC_SIGN_KEY             wa-bot's sign key, for the studios' QR links
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (platform)

import { PDFDocument, rgb, grayscale, fontkit, qrcode } from "./deps.ts";
import { createHandler } from "./api.ts";
import { createStore } from "./db.ts";
import { renderLetter } from "./render.ts";
import type { FontBytes } from "./render.ts";
import { sha256Hex } from "./sign.ts";

const FONT_FILES: Record<keyof FontBytes, string> = {
  wordmark: "Fraunces-SemiBold.ttf",
  regular: "Outfit-Regular.ttf",
  medium: "Outfit-Medium.ttf",
  address: "Arimo-Regular.ttf",
};

// Fonts ship with the function (config.toml static_files). A file: URL is
// read from disk; an https: URL (a pinned-commit loader) is fetched.
async function loadFont(name: string): Promise<Uint8Array> {
  const u = new URL(`./fonts/${name}`, import.meta.url);
  if (u.protocol === "file:") return await Deno.readFile(u);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`font ${name}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

let fontsP: Promise<{ bytes: FontBytes; hashes: Record<string, string> }> | null = null;
function fonts() {
  fontsP ??= (async () => {
    const bytes = {} as FontBytes;
    const hashes: Record<string, string> = {};
    for (const [k, f] of Object.entries(FONT_FILES) as [keyof FontBytes, string][]) {
      bytes[k] = await loadFont(f);
      hashes[f] = await sha256Hex(bytes[k]);
    }
    return { bytes, hashes };
  })();
  return fontsP;
}

const env = (k: string) => Deno.env.get(k);
const store = createStore({ url: env("SUPABASE_URL") || "", serviceKey: env("SUPABASE_SERVICE_ROLE_KEY") || "", fetch });
const libs = { PDFDocument, rgb, grayscale, fontkit, qrcode };

let handler: ((req: Request) => Promise<Response>) | null = null;
async function getHandler() {
  if (handler) return handler;
  const f = await fonts();
  handler = createHandler({
    env,
    store,
    fetch: (url, init) => fetch(url, init as RequestInit),
    now: () => new Date(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    render: (inp) => renderLetter(libs, f.bytes, inp),
    fontHashes: f.hashes,
    log: (msg, extra) => console.log(msg, extra ? JSON.stringify(extra) : ""),
  });
  return handler;
}

Deno.serve(async (req) => (await getHandler())(req));
