// Request #126 (Thursday 19 Nov 2026): a website booking for 13:30 the same
// day, an email address and no phone. Everything that went wrong on it is one
// group below, with invented names (the repo is public). Each group failed
// against bot.ts at 371fc28 and passes after the fix.
//
// What happened, in Madrid time: four studios asked at 12:20; the customer got
// the same studio's offer by email twice, 40 seconds apart; the studio's price
// (76,50) and another studio's typed "si" were thrown away as away messages;
// nobody wrote to the customer for an hour; she tapped Yes on the offer page at
// 13:26 for 13:30 and the studio was told "not sure de 60 min"; one studio was
// stood down twice, another was re-introduced as if we had never written; no
// bookings row was ever saved (ensureBooking's upsert had failed with 42P10
// on every bot booking since 12 Sept); client_confirmed_at stayed null. The
// customer arrived at 13:50 and the massage happened, which is why a Yes
// before the start still books (Jordan, 19 Nov).
//
// Run: node --experimental-strip-types tests/request_126.mjs
// BOT=<path> runs the same checks against another copy of bot.ts.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const botPath = process.env.BOT || path.join(root, "supabase/functions/wa-bot/bot.ts");
const botSrc = fs.readFileSync(botPath, "utf8");
const read = (f) => { try { return fs.readFileSync(path.join(root, f), "utf8"); } catch { return ""; } };

let pass = 0;
const failures = [];
function check(group, input, got, want, note = "") {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else failures.push({ group, input, got, want, note });
}
const between = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i + 1); return i < 0 || j < 0 ? "" : src.slice(i, j); };
const lift = (src, head) => { const i = src.indexOf(head); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i) + 3); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-126-"));
let nmod = 0;
async function load(js) {
  const file = path.join(tmp, `m${nmod++}.mjs`);
  fs.writeFileSync(file, js);
  return import(pathToFileURL(file).href);
}
const copyUrl = pathToFileURL(path.join(root, "supabase/functions/wa-bot/copy.ts")).href;
const dash = (t) => /[‒-―−]/.test(String(t));
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === "string" ? JSON.parse(body) : body), text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });

// ---------------------------------------------------------------------------
// 1. The bookings row. ensureBooking's upsert failed with 42P10 on every bot
// booking for ten weeks and only console.log knew.
// ---------------------------------------------------------------------------
{
  const G = "1 bookings row";
  const marked = between(botSrc, "// ---- bookings row (start) ----", "// ---- bookings row (end) ----");
  check(G, "markers around ensureBooking", !!marked, true, "the block is lifted and run below");
  // Without the markers (bot.ts before the fix) the same function is lifted by
  // name, so the behaviour checks below still run and show what it did.
  const one = (name) => (botSrc.match(new RegExp(`^const ${name} = .*$`, "m")) || [""])[0];
  const block = marked || [one("TEST_PHONES"), one("TEST_EMAIL_RE"), one("TEST_NAME_RE"), lift(botSrc, "async function ensureBooking(")].join("\n");
  if (block) {
    const js = `
let fetchImpl = async () => res(500, "");
const fetch = (u, o) => fetchImpl(String(u), o || {});
export const calls = [], cards = [], events = [];
export function setFetch(f) { fetchImpl = async (u, o) => { calls.push({ u, o }); return f(u, o); }; }
const res = ${res.toString()};
const SUPABASE_URL = "https://db.invalid";
const H = () => ({});
const digitsOf = (x) => String(x || "").replace(/[^0-9]/g, "");
const FAKE_NUM_RE = /^34600000\\d{3}$/;
const REL_TEST_STUDIO_RE = /\\b(test|prueba)\\b/i;
async function logEvent(phone, event, meta) { events.push({ phone, event, meta }); }
async function founderCard(subject, o) { cards.push({ subject, ...o }); }
${stripTypeScriptTypes(block)}
export { ensureBooking };
`;
    const B = await load(js);
    const req = { id: 9126, first_name: "Maria", last_name: "Lopez", contact_email: "cliente9126@correo.invalid", client_phone: null, studio_name: "Estudio Ficticio", service_name: "Relaxing massage", price: null, confirmed_start: "2026-11-19T12:30:00Z", languages: null, partner_id: "p-1" };
    const stub = (postAnswer, seen = []) => (u, o) => {
      if (u.includes("/whatsapp_requests?")) return res(200, [req]);
      if (u.includes("/funnel_events?")) return res(200, seen);
      if (u.includes("/bookings?on_conflict=booking_ref") && o.method === "POST") return postAnswer();
      return res(404, []);
    };
    const reset = () => { B.calls.length = 0; B.cards.length = 0; B.events.length = 0; };
    // (a) the live failure: 400 42P10
    reset();
    B.setFetch(stub(() => res(400, { code: "42P10", message: "there is no unique or exclusion constraint matching the ON CONFLICT specification" })));
    const a = await B.ensureBooking(9126);
    check(G, "400 42P10: returns null", a, null);
    check(G, "400 42P10: one founder card", B.cards.map((c) => c.badge), ["BOOKING ROW NOT SAVED"], "today: nothing, the failure only reached console.log");
    check(G, "400 42P10: the card carries the database answer", /42P10/.test((B.cards[0]?.paras || []).join(" ")), true);
    check(G, "400 42P10: one booking_row_failed event", B.events.map((e) => [e.event, e.meta?.request_id]), [["booking_row_failed", "9126"]]);
    // (b) already alerted for this request: no second card
    reset();
    B.setFetch(stub(() => res(400, { code: "42P10" }), [{ id: 7 }]));
    await B.ensureBooking(9126);
    check(G, "a second failure on the same request", [B.cards.length, B.events.length], [0, 0], "one alert per request, never a card per retry");
    // (c) the fixed index: 201 with the row
    reset();
    B.setFetch(stub(() => res(201, [{ id: 1, action_token: "tok" }])));
    const c = await B.ensureBooking(9126);
    check(G, "201: the action token, no card", [c, B.cards.length], ["tok", 0]);
    const post = B.calls.find((x) => x.o.method === "POST");
    const body = post ? JSON.parse(post.o.body) : {};
    check(G, "the row written", { ref: body.booking_ref, date: body.booking_date, time: body.booking_time, end: body.end_at, test: body.is_test, lang: body.lang, status: body.status },
      { ref: "wa-9126", date: "2026-11-19", time: "13:30", end: "2026-11-19T13:30:00.000Z", test: false, lang: "en", status: "confirmed" }, "Madrid local date and time");
    // (d) no confirmed_start: an alert, not a silent null
    reset();
    B.setFetch((u, o) => u.includes("/whatsapp_requests?") ? res(200, [{ ...req, confirmed_start: null }]) : u.includes("/funnel_events?") ? res(200, []) : res(404, []));
    await B.ensureBooking(9126);
    check(G, "no confirmed_start", B.cards.map((c) => c.badge), ["BOOKING ROW NOT SAVED"]);
  }
  // client_confirmed_at on both paths
  const ao = lift(botSrc, "async function acceptOffer(");
  check(G, "claim PATCH writes client_confirmed_at", /const claim = await fetch\([\s\S]{0,1600}client_confirmed_at: new Date\(\)\.toISOString\(\)[\s\S]{0,900}const claimed = /.test(ao), true, "#126 had a Yes on the offer page and client_confirmed_at null");
  const tc = between(ao, 'if (req.stage === "confirmed") {', "await tellStudio(");
  check(G, "time change writes client_confirmed_at and moves the bookings row", /client_confirmed_at: new Date\(\)\.toISOString\(\)[\s\S]{0,600}await ensureBooking\(req\.id\)/.test(tc), true, "the moved time never reached bookings");
  // after-care stays held for bot bookings
  const afr = lift(botSrc, "async function askForReviews(");
  check(G, "askForReviews leaves wa- bookings alone unless WA_BOOKING_AFTERCARE is on", /appSecret\("WA_BOOKING_AFTERCARE"\)[\s\S]{0,300}=== "on"[\s\S]{0,400}booking_ref\.not\.like\.wa-\*/.test(afr), true, "a working upsert would otherwise start review asks nobody approved");
  // the migration
  const mig = read("supabase/migrations/20261119_bookings_ref_unique.sql");
  check(G, "migration: plain unique index, partial one dropped", [/create unique index if not exists bookings_booking_ref_key on public\.bookings \(booking_ref\);/.test(mig), /drop index if exists public\.bookings_booking_ref_uniq;/.test(mig), /bookings_booking_ref_key[^;]*where/i.test(mig)], [true, true, false], "PostgREST's on_conflict=booking_ref can infer only a non-partial index");
  check(G, "migration: capacity trigger lets a wa- upsert through", /if coalesce\(new\.booking_ref, ''\) like 'wa-%' then\s+return new;/.test(mig), true, "BEFORE INSERT runs before the conflict check and counted the row itself");
  check(G, "migration: WA_BOOKING_AFTERCARE off and the hold trigger", [/\('WA_BOOKING_AFTERCARE', 'off'\)/.test(mig), /create trigger trg_hold_wa_aftercare/.test(mig), /review_requested_at\s+:= coalesce\(new\.review_requested_at, 'epoch'/.test(mig)], [true, true, true]);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length) {
  for (const f of failures) console.log(`FAIL [${f.group}] ${JSON.stringify(f.input)}\n  got  ${JSON.stringify(f.got)}\n  want ${JSON.stringify(f.want)}${f.note ? `\n  (${f.note})` : ""}`);
  console.log(`\nrequest 126: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`request 126: all ${pass} pass`);
