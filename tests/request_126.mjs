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
// Shared: the v204 pure block (with the v219 additions) as a module, and a
// sandbox that runs real bot.ts functions with every outside call stubbed.
// ---------------------------------------------------------------------------
const v204 = between(botSrc, "// ---- v204 offer step: pure helpers (start) ----", "// ---- v204 offer step: pure helpers (end) ----");
const O = await load(`import { askBand, stripAcc, madridMidnight, madridInstant, resolveRequestDate, detectTime, COPY, trSvc } from ${JSON.stringify(copyUrl)};\n`
  + stripTypeScriptTypes(v204) + `\nconst __names = {};\n`
  + ["yesCall", "YES_HURRY_MS", "HURRY_STUDIO_ES", "withLine", "offerSubject", "LATE_COPY", "offerSlotAt", "offerDayLabel", "offerDayPhrase", "studioWordDay", "whenFor", "OFFER_LEAD_MS", "OFFER_DATE_FMT", "MADRID_HM", "offerSchedule", "offerNudgeAt", "parseOfferSwitch", "isAwayMessage", "offerEmailWait", "emailOfferHold"]
    .map((n) => `try { __names.${n} = ${n}; } catch {}`).join("\n")
  + `\nexport { __names, madridMidnight, madridInstant, resolveRequestDate, COPY, trSvc };\n`);
const P = O.__names;
// Thursday 19 Nov 2026, Madrid wall clock (CET, UTC+1).
const M = (h, mi = 0, s = 0) => O.madridInstant(new Date(Date.UTC(2026, 10, 19)), h).getTime() + mi * 60e3 + s * 1e3;
const T = { now: 0 };
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(T.now); } static now() { return T.now; } }
// Runs snippets of bot.ts (types stripped) with every free name they use
// resolved from `env` first, then the real globals, then a recording stub.
function sandbox(snippets, env, exportNames) {
  const calls = [];
  const proxy = new Proxy(env, {
    has: (t, k) => typeof k === "string" && (k in t || !(k in globalThis)),
    get: (t, k) => {
      if (typeof k !== "string") return undefined;
      if (k in t) return t[k];
      const f = (...args) => { calls.push({ fn: k, args }); return ""; };
      t[k] = f;
      return f;
    },
  });
  const code = snippets.map((x) => stripTypeScriptTypes(x)).join("\n");
  const make = new Function("env", `with (env) { return (function () {\n${code}\nreturn { ${exportNames.join(", ")} };\n})(); }`);
  return { fns: make(proxy), calls };
}
const one = (name) => (botSrc.match(new RegExp(`^const ${name} = .*$`, "m")) || [""])[0];
// A multi-line `const name = (...) => {` ... `};` at the top level.
const liftArrow = (name) => { const i = botSrc.indexOf(`\nconst ${name} = `); return i < 0 ? "" : botSrc.slice(i + 1, botSrc.indexOf("\n};\n", i) + 3); };

// ---------------------------------------------------------------------------
// 2. The late Yes (Jordan, 19 Nov). Before the start a Yes books; in the last
// 20 minutes the confirmations say to head over now; at or after the start it
// books nothing. The customer's own timeline (offer 12:21, Yes on the offer
// page 13:26 for 13:30) must still confirm.
// ---------------------------------------------------------------------------
{
  const G = "2 late yes";
  check(G, "yesCall exists", typeof P.yesCall, "function", "nothing compared the Yes with the start");
  if (typeof P.yesCall === "function") {
    for (const [now, slot, want, note] of [
      [M(13, 26, 8), M(13, 30), "hurry", "#126: Yes on the offer page at 13:26 for 13:30 books, with the head-over line"],
      [M(13, 9, 59), M(13, 30), "book", "20 minutes and a second before: books as normal"],
      [M(13, 10), M(13, 30), "hurry", "exactly 20 minutes before: start - now <= 20"],
      [M(12, 30), M(13, 30), "book", ""],
      [M(13, 30), M(13, 30), "late", "at the start: books nothing"],
      [M(13, 31), M(13, 30), "late", "after the start"],
      [M(13, 26), null, "book", "no start known: books as before"],
    ]) check(G, `yesCall ${new Date(now).toISOString()} for ${slot === null ? "null" : new Date(slot).toISOString()}`, P.yesCall(now, slot), want, note);
    const L = P.LATE_COPY;
    check(G, "copy: the head-over lines", [L.en.hurry("Estudio Uno", "13:30"), L.es.hurry("Estudio Uno", "13:30"), P.HURRY_STUDIO_ES],
      ["Head over now, Estudio Uno expects you at 13:30.", "Ve para allá ya, Estudio Uno te espera a las 13:30.", "Acaba de confirmar, va de camino."], "Jordan's words, 19 Nov");
    check(G, "copy: the offer note", [L.en.tapNote("13:30"), L.es.tapNote("13:30")],
      ["Tap Yes as soon as you can. The studio is holding 13:30 for you, and it is only booked once you tap.", "Pulsa Sí cuanto antes. El centro te guarda las 13:30 y solo queda reservado cuando lo pulses."], "no deadline earlier than the start");
    check(G, "copy: subjects", [P.offerSubject("en", "Estudio Uno", "13:30", "Today"), P.offerSubject("es", "Estudio Uno", "13:30", "Hoy"), P.offerSubject("en", "Estudio Uno", "18:00", "Tomorrow"), P.offerSubject("en", "Estudio Uno", "18:00", "Saturday 21 November"), P.offerSubject("es", "Estudio Uno", "18:00", "sábado 21 de noviembre"), P.offerSubject("en", "Estudio Uno", "18:00", "that day")],
      ["Estudio Uno can do 13:30 today: tap Yes to book", "Estudio Uno puede a las 13:30 hoy: pulsa Sí para reservar", "Estudio Uno can do 18:00 tomorrow: tap Yes to book", "Estudio Uno can do 18:00 on Saturday 21 November: tap Yes to book", "Estudio Uno puede a las 18:00 el sábado 21 de noviembre: pulsa Sí para reservar", "Estudio Uno can do 18:00: tap Yes to book"]);
    const all = JSON.stringify([L, P.HURRY_STUDIO_ES, P.offerSubject("en", "X", "1", "Today")], (k, v) => typeof v === "function" ? v("Estudio Uno", "13:30", "x") : v);
    check(G, "copy: no em or en dash, no deadline word", [dash(all), /\bby \d|como tarde/.test(all)], [false, false]);
    check(G, "withLine goes above the signature", P.withLine("Booked!\n\nMassage Club · book.massageclub.io", "Head over now."), "Booked!\n\nHead over now.\n\nMassage Club · book.massageclub.io");
  }
  // acceptOffer itself, in a sandbox: the web Yes on the offer page.
  const ao = lift(botSrc, "async function acceptOffer(");
  const parts = [ao, lift(botSrc, "async function offerSlotFor("), lift(botSrc, "async function yesTooLate("), lift(botSrc, "async function reaskStudio("),
    lift(botSrc, "function offerDayFromText("), lift(botSrc, "function rowDayLabel("), lift(botSrc, "function exactTime("), lift(botSrc, "function studioDate("),
    liftArrow("reqDuration"),
    one("studioDayOf"), one("studioSlotDate"), one("studioDateFull"), one("studioAtEs"), one("deDay"), one("eurEs")];
  check(G, "sandbox parts found", parts.every(Boolean), true);
  const run = async (nowMs, rowOver = {}) => {
    T.now = nowMs;
    const log = { patches: [], tell: [], mail: [], cards: [], events: [] };
    const row = { id: "row-1", request_id: 9126, partner_id: "p-1", phone: "34600000000", offered_time: "13:30", outcome: "accepted", channel: "email", reply_text: "Sí, a las 13:30 (email)", replied_at: new Date(M(12, 21, 37)).toISOString(), offered_at: new Date(M(12, 21, 37)).toISOString(), quoted_price: 76.5, discount_pct: null, ...rowOver };
    const req = { id: 9126, first_name: "Maria", service_name: "Not sure", day1: "Thursday 19 Nov, 13:30", time1: "13:30", proposed_time: "13:30", contact_email: "cliente9126@correo.invalid", client_phone: null, languages: null, stage: "offered", message_text: "Quiere: Not sure | Origen: go-page-home", created_at: new Date(M(12, 9)).toISOString(), confirmed_day: null, confirmed_start: null };
    const env = {
      Date: FakeDate, SUPABASE_URL: "https://db.invalid", OPS_KEY: "k", H: () => ({}),
      fetch: async (u, o = {}) => {
        u = String(u);
        if (o.method === "PATCH") log.patches.push({ u, body: JSON.parse(o.body || "{}") });
        if (u.includes("/request_dispatch?id=eq.") && !o.method) return res(200, [row]);
        if (u.includes("/whatsapp_requests?id=eq.") && !o.method) return res(200, [req]);
        if (u.includes("/whatsapp_requests?id=eq.") && o.method === "PATCH" && u.includes("stage=not.in.")) return res(200, [req]);
        return res(200, []);
      },
      digitsOf: (x) => String(x || "").replace(/[^0-9]/g, ""),
      partnerCard: async () => ({ business_name: "Estudio Uno", address: "Calle Inventada 1", phone: "", neighbourhood: "Chamberí" }),
      tellStudio: async (...a) => { log.tell.push(a); return true; },
      emailStudio: async (...a) => { log.mail.push(a); return true; },
      customerConfirmEmail: async (...a) => { log.mail.push(["customer", ...a]); },
      founderCard: async (subject, o) => { log.cards.push(o.badge); },
      logEvent: async (p, e, m) => { log.events.push([e, m]); },
      showNextOffer: async () => false,
      awardRequest: async () => { log.events.push(["award"]); },
      ensureBooking: async () => { log.events.push(["ensureBooking"]); return "tok"; },
      COPY: O.COPY, madridMidnight: O.madridMidnight, resolveRequestDate: O.resolveRequestDate, trSvc: O.trSvc, askedWhat: undefined,
      ...P,
    };
    if (!/askedWhat\(/.test(ao)) delete env.askedWhat;
    const { fns } = sandbox(parts.filter(Boolean), env, ["acceptOffer"]);
    const info = {};
    const booked = await fns.acceptOffer("row-1", "", "en", null, "web", info);
    return { booked, info, log };
  };
  // Before the fix only acceptOffer exists; it runs anyway, so the checks show what it did.
  if (ao) {
    const k = await run(M(13, 26, 8));
    check(G, "#126 timeline: Yes at 13:26 for 13:30 books", k.booked, true, "the customer came at 13:50 and the massage happened");
    check(G, "#126 timeline: claimed, awarded, bookings row", [k.log.patches.some((p) => p.u.includes("stage=not.in.") && p.body.stage === "confirmed"), k.log.events.some((e) => e[0] === "award"), k.log.events.some((e) => e[0] === "ensureBooking")], [true, true, true]);
    const st = String(k.log.tell[0]?.[3] || "");
    check(G, "#126 timeline: the studio hears they are on their way", [st.includes("Ya podéis apuntarlo. Acaba de confirmar, va de camino."), String(k.log.tell[0]?.[5]?.v2 || "").includes("Acaba de confirmar, va de camino."), String(k.log.tell[0]?.[4] || "").includes("Acaba de confirmar, va de camino")], [true, true, true], "WhatsApp text, aviso v2 and v1 forms");
    const cm = k.log.mail.find((m) => m[0] === "customer");
    check(G, "#126 timeline: the customer's email says head over now", cm?.[6], "Head over now, Estudio Uno expects you at 13:30.");
    const early = await run(M(12, 40));
    check(G, "a Yes 50 minutes before books with no extra line", [early.booked, String(early.log.tell[0]?.[3] || "").includes("de camino"), early.log.mail.find((m) => m[0] === "customer")?.[6] || ""], [true, false, ""]);
    const late = await run(M(13, 31));
    check(G, "a Yes at 13:31 for 13:30 books nothing", [late.booked, late.info.late === true], [false, true], "today this confirmed to the studio in writing");
    check(G, "a late Yes: no claim, no award, no row, no studio confirmation, no customer confirmation", [late.log.patches.some((p) => p.body.stage === "confirmed"), late.log.events.some((e) => e[0] === "award" || e[0] === "ensureBooking"), late.log.tell.length, late.log.mail.length], [false, false, 0, 0]);
    check(G, "a late Yes: the offer closed, Jordan told", [late.log.patches.some((p) => p.u.includes("request_dispatch?id=eq.row-1&outcome=in.(pending,accepted)") && p.body.outcome === "expired"), late.log.cards], [true, ["YES AFTER THE START"]]);
    const lapsedLate = await run(M(13, 40), { outcome: "expired" });
    check(G, "a Yes after the start on a lapsed offer: the late path", [lapsedLate.booked, lapsedLate.info.late === true, lapsedLate.log.tell.length], [false, true, 0]);
    const lapsedEarly = await run(M(12, 30), { outcome: "expired" });
    check(G, "a Yes before the start on a lapsed offer does not book", [lapsedEarly.booked, lapsedEarly.log.patches.some((p) => p.body.stage === "confirmed"), lapsedEarly.log.tell.length], [false, false, 0], "rule 4: the studio is asked again instead");
  }
  const op = lift(botSrc, "async function offerPage(");
  check(G, "offer page: a=yes goes through acceptOffer with info, late and reask pages", /acceptOffer\(rowId, phone, L, s, "web", info\)/.test(op) && /info\.late\) return lateCard/.test(op) && /info\.reask\)/.test(op), true);
  check(G, "offer page: a GET at or after the start shows no live Yes", /yesCall\(Date\.now\(\), slotMs\) === "late"\) return lateCard\(false\)/.test(op), true);
  check(G, "offer page and email: no deadline, Jordan's note", [/LC\.tapNote\(/.test(op), /LATE_COPY\[es \? "es" : "en"\]\.tapNote\(time\)/.test(lift(botSrc, "async function emailOffer(")), /subject: offerSubject\(L, studio, time, day\)/.test(lift(botSrc, "async function emailOffer("))], [true, true, true]);
  const ytl = lift(botSrc, "async function yesTooLate(");
  check(G, "yesTooLate never confirms anything", [!!ytl, /ensureBooking\(|awardRequest\(|tellStudio\(|emailStudio\(|customerConfirmEmail\(/.test(ytl), /outcome=in\.\(pending,accepted\)/.test(ytl)], [true, false, true]);
  const ds = read("supabase/functions/dispatch-studios/index.ts");
  check(G, "dispatch-studios reask: only a lapsed row, the usual ask", /body\.reask[\s\S]{0,2500}row\.outcome !== "expired"[\s\S]{0,2500}askOneStudio\(r, c, \{ several \}\)/.test(ds), true, "rule 4, no new kind of studio message");
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
