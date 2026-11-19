// Request #126, review round (19 Nov 2026). One case per bug the correctness,
// late-Yes and house-rules reviews found in the #126 fix (371fc28..f25f00e),
// each run against the real bot.ts functions in a sandbox, with invented names
// (the repo is public). Times are Madrid wall clock on Thursday 19 Nov 2026.
//
// Run: node --experimental-strip-types tests/request_126_review.mjs
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
const one = (name) => (botSrc.match(new RegExp(`^const ${name} = .*$`, "m")) || [""])[0];
const liftArrow = (name) => { const i = botSrc.indexOf(`\nconst ${name} = `); return i < 0 ? "" : botSrc.slice(i + 1, botSrc.indexOf("\n};\n", i) + 3); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-126r-"));
let nmod = 0;
async function load(js) {
  const file = path.join(tmp, `m${nmod++}.mjs`);
  fs.writeFileSync(file, js);
  return import(pathToFileURL(file).href);
}
const copyUrl = pathToFileURL(path.join(root, "supabase/functions/wa-bot/copy.ts")).href;
const C = await import(copyUrl);
const dash = (t) => /[‒-―−]/.test(String(t));
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === "string" ? JSON.parse(body) : body), text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });

// The v204 pure block (with the v219 additions) as a module.
const v204 = between(botSrc, "// ---- v204 offer step: pure helpers (start) ----", "// ---- v204 offer step: pure helpers (end) ----");
const O = await load(`import { askBand, stripAcc, madridMidnight, madridInstant, resolveRequestDate, detectTime, COPY, trSvc } from ${JSON.stringify(copyUrl)};\n`
  + stripTypeScriptTypes(v204) + `\nconst __names = {};\n`
  + ["rowSlotAt", "dayOnly", "yesCall", "YES_HURRY_MS", "HURRY_STUDIO_ES", "offerFitsDay", "offerFitsTime", "offerDayDate", "askWindow", "windowText", "offerBody", "offerButtons", "OFFER_COPY", "offerFar", "offerMissBy", "withLine", "offerSubject", "LATE_COPY", "offerSlotAt", "offerDayLabel", "offerDayPhrase", "studioWordDay", "whenFor", "OFFER_LEAD_MS", "OFFER_DATE_FMT", "MADRID_HM", "offerSchedule", "offerNudgeAt", "parseOfferSwitch", "isAwayMessage", "offerEmailWait", "emailOfferHold", "madridHourAt"]
    .map((n) => `try { __names.${n} = ${n}; } catch {}`).join("\n")
  + `\nexport { __names, madridMidnight, madridInstant, resolveRequestDate, COPY, trSvc };\n`);
const P = new Proxy(O.__names, { get: (t, k) => (k in t ? t[k] : () => "MISSING") });
const M = (h, mi = 0, s = 0, dayOff = 0) => O.madridInstant(new Date(Date.UTC(2026, 10, 19 + dayOff)), h).getTime() + mi * 60e3 + s * 1e3;
const iso = (ms) => new Date(ms).toISOString();
const T = { now: 0 };
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(T.now); } static now() { return T.now; } }
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
const replies = between(botSrc, "// ---- v219 studio replies: pure helpers (start) ----", "// ---- v219 studio replies: pure helpers (end) ----");
const words = between(botSrc, "// ---- v219 (19 Nov 2026, #126): studio words: pure helpers (start)", "// ---- v219: studio words: pure helpers (end)");
const R = await load(`import { AUTOREPLY_RE, parseQuotedPrice, parseOfferedTime } from ${JSON.stringify(copyUrl)};\n${stripTypeScriptTypes(replies)}\n`
  + `const __r = {};\n` + ["isAwayMessage", "askEcho", "studioSaysArrived", "arrivalAskedLast", "ourQuestionOpen", "BARE_YES_RE"].map((n) => `try { __r.${n} = ${n}; } catch {}`).join("\n") + `\nexport { __r };\n`);
// A helper the copy of bot.ts under test does not have answers "MISSING", so
// BOT=<an older bot.ts> shows every check it fails instead of stopping.
const orMissing = (o) => new Proxy(o, { get: (t, k) => (k in t ? t[k] : () => "MISSING") });
const RP = orMissing(R.__r);
const OPEN_STAGES = ["new", "dispatching", "studio_asked", "studio_replied", "offered", "bidding"];
const digitsOf = (x) => String(x || "").replace(/[^0-9]/g, "");

// ---------------------------------------------------------------------------
// acceptOffer (the WhatsApp Yes and Yes on the offer page) in a sandbox.
// ---------------------------------------------------------------------------
const ao = lift(botSrc, "async function acceptOffer(");
const aoParts = [ao, lift(botSrc, "async function offerSlotFor("), lift(botSrc, "async function yesTooLate("), lift(botSrc, "async function changeTooLate("), lift(botSrc, "async function reaskStudio("), lift(botSrc, "async function reopenOfferClaim("),
  lift(botSrc, "function offerDayFromText("), lift(botSrc, "function rowDayLabel("), lift(botSrc, "function exactTime("), lift(botSrc, "function studioDate("),
  liftArrow("reqDuration"), one("studioDayOf"), one("studioSlotDate"), one("studioDateFull"), one("studioAtEs"), one("deDay"), one("eurEs"), words].filter(Boolean);
async function accept(nowMs, o = {}) {
  T.now = nowMs;
  const log = { patches: [], tell: [], mail: [], cards: [], events: [], said: [], reask: [], session: null };
  const row = { id: "row-1", request_id: 9126, partner_id: "p-1", phone: "34600000000", offered_time: "13:30", outcome: "accepted", channel: "email", reply_text: "Sí, a las 13:30 (email)", replied_at: iso(M(12, 21, 37)), offered_at: iso(M(12, 21, 37)), quoted_price: 76.5, discount_pct: null, ...(o.row || {}) };
  const req = { id: 9126, first_name: "Maria", service_name: "Not sure", day1: "Thursday 19 Nov, 13:30", time1: "13:30", proposed_time: "13:30", contact_email: "cliente9126@correo.invalid", client_phone: o.phone ? o.phone : null, languages: null, stage: "offered", message_text: "Quiere: Not sure | Origen: go-page-home", created_at: iso(M(12, 9)), confirmed_day: null, confirmed_time: null, confirmed_start: null, partner_id: null, ...(o.req || {}) };
  const env = {
    Date: FakeDate, SUPABASE_URL: "https://db.invalid", OPS_KEY: "k", H: () => ({}),
    fetch: async (u, opt = {}) => {
      u = String(u);
      const body = JSON.parse(opt.body || "{}");
      if (opt.method === "PATCH") log.patches.push({ u, body });
      if (u.includes("/functions/v1/dispatch-studios")) { log.reask.push(body); return res(200, { ok: o.reaskOk !== false }); }
      if (u.includes("/request_dispatch?id=eq.") && !opt.method) return res(200, [row]);
      if (u.includes("/whatsapp_requests?id=eq.") && !opt.method) return res(200, [req]);
      if (u.includes("/whatsapp_requests?id=eq.") && opt.method === "PATCH" && u.includes("stage=not.in.")) return res(200, [req]);
      return res(200, []);
    },
    digitsOf,
    partnerCard: async () => ({ business_name: "Estudio Uno", address: "Calle Inventada 1", phone: "", neighbourhood: "Chamberí" }),
    tellStudio: async (...a) => { log.tell.push(a); return true; },
    emailStudio: async (...a) => { log.mail.push(a); return true; },
    customerConfirmEmail: async (...a) => { log.mail.push(["customer", ...a]); },
    sendText: async (to, t) => { log.said.push(t); return true; },
    sendButtons: async (to, t) => { log.said.push(t); return true; },
    saveSession: async (s) => { log.session = JSON.parse(JSON.stringify(s)); },
    founderCard: async (subject, x) => { log.cards.push(x.badge); },
    logEvent: async (p, e, m) => { log.events.push([e, m]); },
    showNextOffer: async () => false,
    awardRequest: async () => { log.events.push(["award"]); },
    ensureBooking: async () => { log.events.push(["ensureBooking"]); return "tok"; },
    notifyJordanWa: async () => {},
    COPY: O.COPY, madridMidnight: O.madridMidnight, resolveRequestDate: O.resolveRequestDate, trSvc: O.trSvc, OPEN_STAGES,
    ...P,
  };
  const { fns } = sandbox(aoParts, env, ["acceptOffer"]);
  const info = {};
  const s = o.session ? JSON.parse(JSON.stringify(o.session)) : null;
  const booked = await fns.acceptOffer("row-1", o.phone || "", "en", s, o.phone ? "whatsapp" : "web", info);
  return { booked, info, log, s };
}

// ---------------------------------------------------------------------------
// forwardOffer (a studio's yes reaching the customer) in a sandbox.
// ---------------------------------------------------------------------------
const fo = lift(botSrc, "async function forwardOffer(");
async function forward(nowMs, o = {}) {
  T.now = nowMs;
  const st = { row: { id: "row-1", request_id: 9126, partner_id: "p-1", phone: "34600000001", offered_time: "13:30", outcome: "accepted", reply_text: "Sí, tengo hueco (botón)", replied_at: iso(M(12, 20, 51)), customer_answer: null, customer_offered_at: null, customer_offered_time: null, customer_offer_via: null, quoted_price: null, asked_again_at: null, offer_slot_at: null, ...(o.row || {}) } };
  const log = { emails: [], studio: [], events: [], patches: [], cards: [] };
  const req = { id: 9126, first_name: "Maria", service_name: "Relaxing massage", day1: "Thursday 19 Nov, 13:30", time1: "13:30", proposed_time: "13:30", contact_email: "cliente9126@correo.invalid", client_phone: null, languages: null, stage: "studio_asked", message_text: "Quiere: Not sure", created_at: iso(M(12, 9)), area: "Chamberí", ...(o.req || {}) };
  const env = {
    Date: FakeDate, SUPABASE_URL: "https://db.invalid", H: () => ({}),
    fetch: async (u, opt = {}) => {
      u = decodeURIComponent(String(u));
      const body = JSON.parse(opt.body || "{}");
      if (opt.method === "PATCH") log.patches.push({ u, body });
      if (u.includes("customer_offer_via=in.(email,email_pending)")) return res(200, o.liveMail || []);
      if (opt.method === "PATCH" && u.includes("request_dispatch?id=eq.row-1")) {
        if (u.includes("&or=(customer_offered_at.is.null,customer_offered_time.neq.")) {
          const t = u.match(/customer_offered_time\.neq\.([^)]*)\)/)[1];
          if (st.row.customer_offered_at && st.row.customer_offered_time === t) return res(200, []);
        }
        Object.assign(st.row, body);
        return res(200, [st.row]);
      }
      if (u.includes("request_dispatch?id=eq.row-1")) return res(200, [st.row]);
      if (u.includes("whatsapp_requests?id=eq.")) return res(200, [req]);
      return res(200, []);
    },
    digitsOf,
    getSession: async () => ({ step: "", data: {} }),
    partnerCard: async () => ({ business_name: "Estudio Uno", address: "Calle Inventada 1", phone: "", neighbourhood: "Chamberí" }),
    dispatchRowFor: async () => st.row,
    emailOffer: async (...a) => { log.emails.push(a); return true; },
    waWindowOpen: async () => false,
    studioSay: async (to, t) => { log.studio.push(t); return true; },
    studioNoteSure: async (n) => { log.studio.push(n.text); return "sent"; },
    logEvent: async (p, e, m) => { log.events.push(e); },
    founderCard: async (s, x) => { log.cards.push(x.badge); },
    resolveRequestDate: O.resolveRequestDate, madridMidnight: O.madridMidnight, COPY: O.COPY, trSvc: O.trSvc, trSvcLow: (n) => String(n || "").toLowerCase(),
    dayLabelFor: () => "Today", parseQuotedPrice: C.parseQuotedPrice, parseOfferedTimes: () => [],
    OPEN_STAGES, FAKE_NUM_RE: /(^|\D)34600000\d{3}(\D|$)/, TEST_NAME_RE: /\b(test|prueba|uitest|mctest)\b/i,
    ...P,
  };
  const { fns } = sandbox([fo, lift(botSrc, "function offerDayFromText("), lift(botSrc, "function rowDayLabel("), one("isSameDayReq"), words].filter(Boolean), env, ["forwardOffer"]);
  const out = await fns.forwardOffer(req, { id: "p-1", business_name: "Estudio Uno" }, "row-1", o.time || "13:30", o.text || "Sí, tengo hueco (botón)", o.studioFrom ?? "34600000001", o.opts || {});
  return { out, st, log };
}

// ---------------------------------------------------------------------------
// H1. The capacity trigger keeps SECURITY DEFINER and its search_path.
// ---------------------------------------------------------------------------
{
  const G = "H1 capacity trigger header";
  const mig = read("supabase/migrations/20261119_bookings_ref_unique.sql");
  const head = (mig.match(/create or replace function public\.enforce_booking_capacity\(\)[\s\S]*?as \$function\$/) || [""])[0];
  check(G, "security definer, search_path public", [/security definer/.test(head), /set search_path to 'public'/.test(head)], [true, true], "the live function has both; CREATE OR REPLACE would drop them and let a full slot take a second website booking");
}

// ---------------------------------------------------------------------------
// H2 / F1. Rule 4: a Yes after a real lapse asks the studio again, and the
// studio's yes reaches the customer as a fresh offer.
// ---------------------------------------------------------------------------
{
  const G = "H2 rule 4 re-ask";
  const lapseAt = P.offerSchedule(M(12, 21), M(13, 30)).lapseAt;
  check(G, "the live WhatsApp lapse for an offer sent 12:21 for 13:30", lapseAt, M(12, 45), "always at or after start - 45: the old 45-minute re-ask gate could never pass");
  for (const [at, label] of [[M(12, 50), "12:50"], [M(13, 20), "13:20"]]) {
    const k = await accept(at, { row: { outcome: "expired", customer_offered_at: iso(M(12, 21)), customer_offered_time: "13:30", customer_offer_via: "email" } });
    check(G, `Yes at ${label} on the lapsed offer: the studio is asked again, nothing booked`, [k.booked, k.info.reask === true, k.log.reask.length, k.log.reask[0]?.reask?.row, k.log.tell.length, k.log.events.some((e) => e[0] === "ensureBooking")], [false, true, 1, "row-1", 0, false], "before: 'This offer is no longer available' and no ask");
    const reopen = k.log.patches.find((p) => p.u.includes("request_dispatch?id=eq.row-1") && "asked_again_at" in p.body);
    check(G, `Yes at ${label}: the first offer's claim is cleared and the row marked`, reopen ? [reopen.body.customer_offered_at, reopen.body.customer_offered_time, reopen.body.customer_offer_via, typeof reopen.body.asked_again_at] : null, [null, null, null, "string"], "the studio's yes was otherwise swallowed as 'already'");
  }
  const notAsk = await accept(M(12, 50), { row: { outcome: "expired", offered_time: "14:15" } });
  check(G, "a lapsed counter time (not the time asked): not asked again, Jordan told", [notAsk.booked, notAsk.log.reask.length, notAsk.log.cards], [false, 0, ["YES ON A LAPSED OFFER"]], "it used to say 'no longer available' with no card");
  // The studio's yes after the re-ask, at 12:52 for 13:30 (38 minutes away).
  const fresh = await forward(M(12, 52), { row: { asked_again_at: iso(M(12, 50, 30)), offered_time: null } });
  check(G, "the studio's yes after the re-ask: one fresh offer email", { out: fresh.out, emails: fresh.log.emails.length, tooSoon: fresh.log.events.includes("offer_withheld_too_soon") }, { out: "email", emails: 1, tooSoon: false }, "the customer was promised the offer again");
  const notAsked = await forward(M(12, 52), { row: { offered_time: null } });
  check(G, "the same yes on a row nobody re-asked: still too soon (45 minutes)", notAsked.out, "withheld_too_soon");
  const passed = await forward(M(13, 31), { row: { asked_again_at: iso(M(12, 50, 30)) } });
  check(G, "after the start, even a re-asked row sends nothing", passed.log.emails.length, 0);
  check(G, "the other reopen points clear the claim", [/await reopenOfferClaim\(String\(sdrow\.id\)\);\s*await forwardOffer\(sd0/.test(botSrc), /if \(wasClosed\) await reopenOfferClaim\(String\(row\.id\)\);/.test(botSrc), (botSrc.match(/if \(OFFER_ROW_CLOSED\.includes\(String\(drow\.outcome \|\| ""\)\)\) await reopenOfferClaim\(String\(drow\.id\)\);/g) || []).length], [true, true, 2], "a studio offering again after a lapse: typed time, lead-email tap, the WhatsApp button (both the tap path and awardWinner)");
  const op = lift(botSrc, "async function offerPage(");
  check(G, "offer page: the re-ask button until the start", /const canReask = lapsed && slotMs !== null && slotMs > Date\.now\(\)/.test(op), true);
  check(G, "migration: asked_again_at and offer_slot_at", [/add column if not exists asked_again_at/.test(read("supabase/migrations/20261119_offer_once.sql")), /add column if not exists offer_slot_at/.test(read("supabase/migrations/20261119_offer_once.sql"))], [true, true]);
}

// ---------------------------------------------------------------------------
// H3. A typed "Sí" counts as a studio's yes only right after that row's ask.
// ---------------------------------------------------------------------------
{
  const G = "H3 bare yes";
  check(G, "askEcho exists", typeof RP.askEcho, "function");
  if (typeof RP.askEcho === "function") {
    const sent = M(12, 0, 4);
    const ask = { msg_type: "template", body: "Hola, ¿tenéis hueco hoy a las 13:30 para un masaje relajante de 60 min? El cliente se llama Ana.", created_at: iso(M(12, 0, 5)) };
    check(G, "our last message is the ask, 1 s after sent_at", RP.askEcho(ask, sent), true);
    check(G, "the intro ask by nota_centro_v1", RP.askEcho({ ...ask, body: "Hola, os escribimos de Massage Club sobre una reserva:\n\nSoy Jordan, de Massage Club, un servicio de reservas de masajes en Madrid. ¿Tenéis hueco hoy a las 13:30 para ..." }, sent), true);
    check(G, "a confirmation template for another request at 12:40", RP.askEcho({ msg_type: "template", body: "Hola, os escribo por el masaje de Ana de hoy a las 13:30. Ha dicho que sí, así que queda confirmado.\n\nGracias.", created_at: iso(M(12, 40)) }, sent), false, "it credited request B with a yes the studio never gave");
    check(G, "booking-guard's arrival question", RP.askEcho({ msg_type: "template", body: "Hola, ¿ha llegado Ana a su cita de las 12:00?", created_at: iso(M(12, 20)) }, sent), false);
    check(G, "an ask logged 20 minutes away from this row's sent_at", RP.askEcho({ ...ask, created_at: iso(M(12, 20)) }, sent), false, "another request's ask");
    check(G, "free text is never the ask", RP.askEcho({ ...ask, msg_type: "text" }, sent), false);
  }
  const by = lift(botSrc, "async function bareYesAsk(");
  check(G, "bareYesAsk uses askEcho on the body", /select=msg_type,body,created_at/.test(by) && /askEcho\(last, Date\.parse\(String\(rows\[0\]\.sent_at/.test(by), true);
}

// ---------------------------------------------------------------------------
// M1. Arrivals: questions, no-shows and wine are not arrivals; a bare "Sí"
// to our own arrival question is one; nothing before the start.
// ---------------------------------------------------------------------------
{
  const G = "M1 arrivals";
  for (const [t, want] of [["¿Ha llegado ya? No la vemos", false], ["¿Llegó la clienta?", false], ["¿Vino?", false], ["Nadie ha venido", false], ["No sé si llegó", false], ["El vino tinto", false], ["Todavía no ha llegado", false], ["Aún no llegó", false],
    ["Si, llegó a las 13:50☺️", true], ["Ha llegado, gracias", true], ["Sí, vino a las 14:00", true], ["Ya vino", true], ["Vino tarde pero bien", true]]) check(G, `studioSaysArrived ${t}`, RP.studioSaysArrived(t), want);
  const q = { msg_type: "text", body: "Hola, ¿ha llegado Ana a su cita de las 13:30? Gracias.", created_at: iso(M(13, 50)) };
  check(G, "arrivalAskedLast", [RP.arrivalAskedLast(q, M(14, 10)), RP.arrivalAskedLast(q, M(17, 0)), RP.arrivalAskedLast({ ...q, body: "Hola, os escribo por el masaje de Ana de hoy a las 13:30. ¿Ha llegado ya a su cita?\n\nGracias." }, M(14, 0)), RP.arrivalAskedLast({ ...q, body: "Hola, ¿tenéis hueco hoy a las 13:30?" }, M(14, 0))], [true, false, true, false]);
  const hs = lift(botSrc, "async function handleStudioReply(");
  check(G, "only once the booking has started; a bare yes to our question counts", /if \(creq && started && \(studioSaysArrived\(freeText\) \|\| \(BARE_YES_RE\.test\(freeText\) && arrivalAskedLast\(await lastOutTo\(from\), Date\.now\(\)\)\)\)\)/.test(hs), true, "'¿Os ha llegado mi correo?' the day before made the visit billable");
}

// ---------------------------------------------------------------------------
// M2. Real answers over 25 characters inside 45 seconds are read; anything
// still dropped for its timing reaches Jordan.
// ---------------------------------------------------------------------------
{
  const G = "M2 away messages";
  for (const [t, want] of [["Sí, tenemos hueco a esa hora, os esperamos", false], ["Si podemos, le esperamos sin problema", false], ["No podemos a esa hora, lo siento mucho", false], ["Perfecto, apuntado. ¿Nos pasas su teléfono?", false], ["Mañana tenemos hueco toda la tarde", false],
    ["¡Hola! Gracias por comunicarte con Estudio Tres. En breve te atenderemos.", true], ["Hola buenas, ahora mismo la recepción está cerrada, os escribimos enseguida", true]]) check(G, `isAwayMessage ${t}`, RP.isAwayMessage(t, 10_000, {}), want);
  check(G, "a timing-only drop sends Jordan a card", /else if \(!awayText\) await founderCard\([\s\S]{0,200}STUDIO REPLY \(MAYBE AN AWAY MESSAGE\)/.test(botSrc), true, "it was a console.log line only");
}

// ---------------------------------------------------------------------------
// M3. "Ok" after our own question is not a quiet ack; a lone 👎 never is.
// ---------------------------------------------------------------------------
{
  const G = "M3 quiet ack";
  const asked = { msg_type: "text", body: "Vaya. Ana tiene la cita confirmada con vosotros hoy a las 13:30. ¿Me confirmáis que al final no podéis? Si es así, yo se lo digo.", created_at: iso(M(11, 0)) };
  check(G, "our 'no podéis?' question is open 5 minutes later", RP.ourQuestionOpen(asked, M(11, 5)), true, "so the studio's 'Ok' goes to Jordan");
  check(G, "the quiet path checks it", /if \(!req && plainStudioAck\(freeText\) && !ourQuestionOpen\(await lastOutTo\(from\), Date\.now\(\)\)\)/.test(botSrc), true);
  const W = await load(`${stripTypeScriptTypes(words)}\nexport { plainStudioAck };\n`);
  check(G, "plainStudioAck", ["👎", "❌", "😡", "👍", "Ok"].map(W.plainStudioAck), [false, false, false, true, true]);
}

// ---------------------------------------------------------------------------
// M4. The duplicate check comes before the 45-minute and window checks.
// ---------------------------------------------------------------------------
{
  const G = "M4 duplicate first";
  const k = await forward(M(12, 50), { row: { customer_offered_at: iso(M(12, 21)), customer_offered_time: "13:30", customer_offer_via: "email" }, text: "Sí, a las 13:30, 76,50€" });
  check(G, "studio repeats its 13:30 at 12:50", { out: k.out, tooClose: k.log.studio.some((t) => /demasiado cerca|no le guardéis/.test(t)), rewrote: k.log.patches.some((p) => "reply_text" in p.body || "offered_at" in p.body), emails: k.log.emails.length }, { out: "already", tooClose: false, rewrote: false, emails: 0 }, "it was told to drop a slot the customer could still book until 13:30");
  check(G, "the studio hears we are checking", k.log.studio, ["Vale, gracias. Lo confirmo con Maria y os digo algo en cuanto me conteste."]);
}

// ---------------------------------------------------------------------------
// M5. A Yes on a closed request, or from a muted customer.
// ---------------------------------------------------------------------------
{
  const G = "M5 closed request";
  const sess = { step: "await_offer", data: { offer: { row: "row-1" } } };
  const c = await accept(M(13, 40), { req: { stage: "cancelled" }, phone: "34600000126", session: sess });
  check(G, "cancelled, Yes after the start", { booked: c.booked, late: !!c.info.late, cards: c.log.cards, said: c.log.said, dayButtons: c.s?.step }, { booked: false, late: false, cards: [], said: [O.COPY.en.offerGone], dayButtons: "done" }, "it got '13:30 has already passed', the day buttons and a card");
  const mu = await accept(M(13, 40), { phone: "34600000126", session: { step: "muted", data: {} } });
  check(G, "a muted customer: nothing said, still muted", { booked: mu.booked, said: mu.log.said.length, step: mu.s.step, cards: mu.log.cards }, { booked: false, said: 0, step: "muted", cards: [] });
}

// ---------------------------------------------------------------------------
// M6 / F3. The slot is the one stored when the offer went (offer_slot_at),
// not one inferred from reply_text, which the studio's next message rewrites.
// ---------------------------------------------------------------------------
{
  const G = "M6 offer_slot_at";
  check(G, "rowSlotAt", [P.rowSlotAt({ offer_slot_at: iso(M(13, 30)), offered_time: "13:30" }), P.rowSlotAt({ offer_slot_at: iso(M(13, 30)), offered_time: "14:00" }), P.rowSlotAt({ offered_time: "13:30" })], [M(13, 30), null, null], "a moved time is not the stored slot");
  const over = { offer_slot_at: iso(M(13, 30)), reply_text: "si no puede hoy, mañana también tenemos hueco", replied_at: iso(M(12, 50)) };
  const late = await accept(M(13, 40), { row: over });
  check(G, "studio wrote 'mañana también' at 12:50; Yes at 13:40 for today's 13:30", [late.booked, !!late.info.late, late.log.tell.length], [false, true, 0], "it booked, and confirmed the studio for 'mañana a las 13:30'");
  const ok = await accept(M(13, 0), { row: over });
  check(G, "the same at 13:00: books today", [ok.booked, String(ok.log.tell[0]?.[3] || "").includes("hoy a las 13:30")], [true, true]);
  // An emailed time for Saturday (the day exists only as forwardOffer's dayHint).
  const sat = await accept(M(19, 0), { row: { offered_time: "18:00", offer_slot_at: iso(M(18, 0, 0, 2)), reply_text: "Sí, a las 18:00 (email)", replied_at: iso(M(12, 0)) } });
  check(G, "Thursday 19:00, Yes for Saturday 18:00 from an email tap", [sat.booked, !!sat.info.late, String(sat.log.tell[0]?.[3] || "").includes("sábado 21 de noviembre a las 18:00")], [true, false, true], "read as today's 18:00, already passed");
  const fo2 = await forward(M(12, 20, 51), { opts: {} });
  const claim = fo2.log.patches.find((p) => p.u.includes("or=(customer_offered_at.is.null"));
  check(G, "forwardOffer stores the slot with the claim", claim?.body?.offer_slot_at, iso(M(13, 30)));
}

// ---------------------------------------------------------------------------
// F2. One live offer for an email-only customer too.
// ---------------------------------------------------------------------------
{
  const G = "F2 one live email offer";
  const k = await forward(M(12, 20, 51), { liveMail: [{ id: "row-2", partner_id: "p-2", customer_offered_time: "13:30", offer_slot_at: null }] });
  check(G, "a second studio's yes while the first studio's email offer is open", { out: k.out, emails: k.log.emails.length, told: k.log.studio[0] || "" }, { out: "queued", emails: 0, told: "Gracias, apuntado: 13:30. Maria está mirando ahora otra propuesta, así que no le guardéis el hueco todavía. Os digo algo en cuanto conteste." }, "#126 replayed: two studios holding a room and two offer emails");
  const gone = await forward(M(12, 20, 51), { liveMail: [{ id: "row-2", partner_id: "p-2", customer_offered_time: "11:00", offer_slot_at: iso(M(11, 0)) }] });
  check(G, "a live offer whose slot has passed does not hold this one", gone.out, "email");
}

// ---------------------------------------------------------------------------
// F4. The confirmation's time once ("Thursday 19 Nov, 13:30 13:30").
// ---------------------------------------------------------------------------
{
  const G = "F4 when";
  check(G, "dayOnly", [P.dayOnly("Thursday 19 Nov, 13:30"), P.dayOnly("Today"), P.dayOnly("sábado 21 de noviembre a las 18:00"), P.dayOnly("Mañana 9.30")], ["Thursday 19 Nov", "Today", "sábado 21 de noviembre", "Mañana"]);
  const k = await accept(M(13, 26, 8));
  const cm = k.log.mail.find((m) => m[0] === "customer");
  check(G, "#126 timeline: the email's time once", [k.booked, /13:30.*13:30/.test(String(cm?.[3] || "")), /today/i.test(String(cm?.[3] || ""))], [true, false, true], String(cm?.[3] || ""));
}

// ---------------------------------------------------------------------------
// F5. No "Soy Jordan, de Massage Club" in an email to a studio we know.
// ---------------------------------------------------------------------------
{
  const G = "F5 studio email";
  const head = one("studioMailHead");
  const f = new Function(`${stripTypeScriptTypes(head)}; return studioMailHead;`)();
  check(G, "studioMailHead", [f("Estudio Uno"), /Soy Jordan|un servicio de reservas/.test(f("Estudio Uno"))], ["Hola, equipo de Estudio Uno:", false], "Calma read it in the confirmation of the booking it had just offered");
}

// ---------------------------------------------------------------------------
// R2. ARRIVAL_CHECK never asks at night.
// ---------------------------------------------------------------------------
{
  const G = "R2 arrival check hours";
  const fn = lift(botSrc, "async function askArrivalNoPhone(");
  const run = async (nowMs) => {
    T.now = nowMs;
    const log = { reads: 0, tell: [] };
    const env = { Date: FakeDate, SUPABASE_URL: "https://db.invalid", H: () => ({}), appSecret: async () => "on", parseOfferSwitch: P.parseOfferSwitch, madridHourAt: P.madridHourAt,
      fetch: async (u, o = {}) => { u = String(u); if (u.includes("whatsapp_requests?stage=eq.confirmed")) { log.reads++; return res(200, [{ id: 1, first_name: "Ana", client_phone: null, partner_id: "p-1", studio_name: "Estudio Uno", confirmed_start: iso(nowMs - 40 * 60e3), confirmed_time: "13:30" }]); } if (o.method === "PATCH") return res(200, [{ id: 1 }]); return res(200, []); },
      digitsOf, offerTestCustomer: () => false, studioNumberFor: async () => "34600000001", studioHour: () => "13:30", studioDayEs: () => "hoy", REL_TEST_STUDIO_RE: /\b(test|prueba)\b/i,
      tellStudio: async (...a) => { log.tell.push(a); return true; }, logEvent: async () => {} };
    const { fns } = sandbox([fn], env, ["askArrivalNoPhone"]);
    const n = await fns.askArrivalNoPhone();
    return { n, ...log };
  };
  const night = await run(M(21, 30));
  const day = await run(M(14, 10));
  check(G, "21:30 Madrid: nothing read, nothing sent", [night.n, night.reads, night.tell.length], [0, 0, 0], "the sweep runs every 5 minutes all night");
  check(G, "14:10 Madrid: the question goes", [day.n, day.tell.length], [1, 1]);
}

// ---------------------------------------------------------------------------
// R5. A Yes to a moved time at or after it changes nothing.
// ---------------------------------------------------------------------------
{
  const G = "R5 moved time";
  const conf = { stage: "confirmed", partner_id: "p-1", confirmed_time: "13:30", confirmed_day: "Today", confirmed_start: iso(M(13, 30)) };
  const late = await accept(M(14, 5), { req: conf, row: { offered_time: "14:00", outcome: "won", reply_text: "mejor a las 14:00", replied_at: iso(M(12, 0)) }, phone: "34600000126", session: { step: "await_offer", data: { offer: { row: "row-1", change: true } } } });
  check(G, "Yes at 14:05 to a move from 13:30 to 14:00", { booked: late.booked, change: !!late.info.change, tell: late.log.tell.length, row: late.log.events.some((e) => e[0] === "ensureBooking"), confirmedPatch: late.log.patches.some((p) => p.u.includes("whatsapp_requests") && "confirmed_time" in p.body), cards: late.log.cards }, { booked: false, change: true, tell: 0, row: false, confirmedPatch: false, cards: ["MOVED TIME, YES TOO LATE"] }, "the studio was told 'acepta el cambio' after the new time had started");
  check(G, "the customer is told, signed Massage Club", late.log.said, ["Maria, 14:00 has already passed, so your booking was not moved to 14:00. If you still want to go, reply here and we will sort it out with Estudio Uno.\n\nMassage Club"]);
  const early = await accept(M(13, 40), { req: conf, row: { offered_time: "14:00", outcome: "won", reply_text: "mejor a las 14:00", replied_at: iso(M(12, 0)) }, phone: "34600000126", session: { step: "await_offer", data: { offer: { row: "row-1", change: true } } } });
  check(G, "Yes at 13:40 to the move: as before", [early.booked, early.log.tell.length], [true, 1]);
  const L = P.LATE_COPY;
  const cl = (x) => (typeof x?.changeLate === "function" ? x.changeLate("Ana", "Estudio Uno", "14:00") : "MISSING");
  check(G, "copy: there, no dash", [cl(L.en) !== "MISSING" && cl(L.es) !== "MISSING", dash(JSON.stringify([cl(L.en), cl(L.es)]))], [true, false]);
}

// ---------------------------------------------------------------------------
// R3, R8 (also in trace_c_check.mjs and request_126.mjs).
// ---------------------------------------------------------------------------
{
  const G = "R3 R8";
  const W = await load(`${stripTypeScriptTypes(words)}\nexport { noteTplOrder };\n`);
  check(G, "a studio we know never gets aviso_centro_v2", [W.noteTplOrder(true, true), W.noteTplOrder(true, false)], [["aviso_centro_v3", "aviso_centro_v1"], ["aviso_centro_v3"]]);
  const mig = read("supabase/migrations/20261119_bookings_ref_unique.sql");
  check(G, "one after-care switch per job", ["WA_REVIEW_EMAIL", "WA_ATTENDANCE_EMAIL", "WA_REMINDER_EMAILS", "WA_REVIEW_WHATSAPP"].map((k) => new RegExp(`'${k}', 'off'`).test(mig)), [true, true, true, true]);
  // markNoShow and the WhatsApp cancel write only whatsapp_requests: the wa- row
  // would stay 'confirmed' and get "How was your massage?" once the review email is on.
  check(G, "a cancelled or no-show request moves its wa- bookings row", [/create trigger trg_sync_wa_booking_status\s+after update of stage on public\.whatsapp_requests/.test(mig), /set status = case when new\.stage = 'no_show' then 'no_show' else 'cancelled' end/.test(mig), /where booking_ref = 'wa-' \|\| new\.id::text\s+and status in \('pending', 'confirmed'\)/.test(mig)], [true, true, true]);
}

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length) {
  for (const f of failures) console.log(`FAIL [${f.group}] ${JSON.stringify(f.input)}\n  got  ${JSON.stringify(f.got)}\n  want ${JSON.stringify(f.want)}${f.note ? `\n  (${f.note})` : ""}`);
  console.log(`\nrequest 126 review: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`request 126 review: all ${pass} pass`);
