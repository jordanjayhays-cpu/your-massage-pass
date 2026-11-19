// The consent rule in the WhatsApp bot (20 Nov 2026).
//
// On 19 Nov a customer booked and was never asked whether they wanted offers,
// and the bot's "Membership is free" line after a booking recorded nothing.
// Each group below failed against bot.ts at 3c1064c (the live bot's commit)
// and passes now:
//   1. after a confirmed booking the bot asks the offers question, once per
//      booking while not answered, with two equal buttons, inside the open
//      24h window, only with app_secrets MKT_ASK on, never for test contacts
//   2. the booking path calls it (and no longer sends "Membership is free")
//   3. both taps are saved with the exact wording, language, phone, email and
//      request; a save that fails is never silent; a typed yes re-asks once
//   4. a customer's STOP (in many wordings) records a withdraw for the phone
//      and every email we know, and gets one signed reply; during a live
//      request the booking flow still reads the message
//   5. a studio's BAJA still goes to the letters path first; a customer's
//      BAJA there, at any age, is an opt-out; an unknown number's is recorded
//   6. the copy: the fixed notice, the buttons, no em dashes
//   7. copy.ts stays pinned at 6715b8a and unchanged
//   8. bot.ts and consent.ts parse
//   9. ops "tpl" sends a MARKETING template only to a verified yes; Meta's
//      131050 is recorded as a withdraw
//
// Like tests/request_126.mjs, this runs the real code: the block between
// "marketing consent (start)" and "(end)" in bot.ts, and handleLetterReply,
// with their types stripped, against stubs. Nothing touches a database,
// WhatsApp or the network. Invented names and numbers only (the repo is
// public).
//
// Run: node tests/consent_bot.mjs
// BOT=<path> runs the same checks against another copy of bot.ts.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const botPath = process.env.BOT || path.join(root, "supabase/functions/wa-bot/bot.ts");
const botDir = path.dirname(botPath);
const botSrc = fs.readFileSync(botPath, "utf8");
const consentPath = path.join(botDir, "consent.ts");
const consentSrc = fs.existsSync(consentPath) ? fs.readFileSync(consentPath, "utf8") : "";

let pass = 0;
const failures = [];
function check(group, input, got, want, note = "") {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else failures.push({ group, input, got, want, note });
}
const DASH_RE = /[‒-―−]/;
const between = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i + 1); return i < 0 || j < 0 ? "" : src.slice(i, j); };
const lift = (src, head) => { const i = src.indexOf(head); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i) + 3); };
const one = (name) => (botSrc.match(new RegExp(`^const ${name} = .*$`, "m")) || [""])[0];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-consent-bot-"));
let nmod = 0;
async function load(js) {
  const file = path.join(tmp, `m${nmod++}.mjs`);
  fs.writeFileSync(file, js);
  return import(pathToFileURL(file).href);
}

// ---------------------------------------------------------------------------
// Load consent.ts and the bot's block.
// ---------------------------------------------------------------------------
let K = null;
if (consentSrc) {
  const f = path.join(tmp, "consent.mjs");
  fs.writeFileSync(f, stripTypeScriptTypes(consentSrc));
  K = await import(pathToFileURL(f).href);
}
check("load", "wa-bot/consent.ts exists and loads", !!K, true, "the new strings live in their own module; copy.ts stays pinned");
const block = between(botSrc, "// ---- marketing consent (start) ----", "// ---- marketing consent (end) ----");
check("load", "bot.ts has the marketing consent block", !!block, true);
const importLine = (botSrc.match(/^import \{[^}]*\} from "\.\/consent\.ts";$/m) || [""])[0];
check("load", "bot.ts imports ./consent.ts (relative, so it follows bot.ts's pinned commit)", !!importLine, true);

const letterFn = lift(botSrc, "async function handleLetterReply(");
check("load", "bot.ts has handleLetterReply", !!letterFn, true);
let B = null;
if (K && block && importLine) {
  const consentUrl = pathToFileURL(path.join(tmp, "consent.mjs")).href;
  const lettersUrl = pathToFileURL(path.join(botDir, "letters_reply.ts")).href;
  const js = `
${importLine.replace('"./consent.ts"', JSON.stringify(consentUrl))}
import { letterRefCandidates, letterBajaIntent, BAJA_ONLY_RE, LETTER_BAJA_ACK_ES, LETTER_BAJA_ACK_EN } from ${JSON.stringify(lettersUrl)};
let fetchImpl = async () => res(404, []);
const fetch = (u, o) => fetchImpl(String(u), o || {});
export const calls = [], sent = [], events = [], cards = [], saved = [], waAlerts = [];
export const state = { window: true, lastReq: null, hold: new Set(), sendOk: true, secrets: { MKT_ASK: "on" }, partner: null, letter: null, session: null, cardThrows: false };
export function setFetch(f) { fetchImpl = async (u, o) => { calls.push({ u, o }); return f(u, o); }; }
export function reset() { calls.length = 0; sent.length = 0; events.length = 0; cards.length = 0; saved.length = 0; waAlerts.length = 0; }
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
const SUPABASE_URL = "https://db.invalid";
const WA_TOKEN = "wa-test";
const H = () => ({});
const digitsOf = (x) => String(x || "").replace(/[^0-9]/g, "");
${one("FAKE_NUM_RE")}
${one("TEST_PHONES")}
${one("TEST_EMAIL_RE")}
${one("TEST_NAME_RE")}
export const TEST_PHONE_0 = TEST_PHONES[0];
let quietThisTurn = false;
const heldNum = (x) => state.hold.has(digitsOf(x));
const heldMail = () => false;
async function appSecret(k) { return state.secrets[k] || ""; }
async function waWindowOpen() { return state.window; }
async function sendButtons(to, body, buttons) { sent.push({ type: "buttons", to, body, buttons }); return state.sendOk; }
async function sendText(to, body) { sent.push({ type: "text", to, body }); return state.sendOk; }
async function saveSession(s) { saved.push(JSON.parse(JSON.stringify(s))); }
async function logEvent(phone, event, meta) { events.push({ phone, event, meta }); }
async function founderCard(subject, o) { if (state.cardThrows) throw new Error("resend down"); cards.push({ subject, ...o }); }
async function notifyJordanWa(text, about) { waAlerts.push({ text, about }); }
async function lastRequestFor() { return state.lastReq; }
async function getSession(phone) { return state.session || { phone, step: "start", data: {} }; }
async function findPartnerByNumber() { return state.partner; }
async function letterByRef() { return state.letter; }
async function letterEnglish() { return ""; }
async function letterStudioCard(from, text) { cards.push({ badge: "ANSWER TO A LETTER", quote: text }); }
async function socLinksUrl() { return "https://book.massageclub.io/x"; }
${stripTypeScriptTypes(block)}
${stripTypeScriptTypes(letterFn)}
export { mktAskAfterBooking, mktAfterEmailStep, mktCustomerTurn, mktMutedStop, mktTestContact, mktTemplateGate, mktMetaStopped, handleLetterReply };
`;
  B = await load(js);
}

const PH = "34611222333";            // an invented real-looking customer
const EM = "cliente.siete@correo.invalid";
const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const db = (o = {}) => (u, opt) => {
  if (u.includes("/rest/v1/marketing_status?")) {
    if (o.statusFail) return { ok: false, status: 404, json: async () => ({ code: "42P01" }), text: async () => "42P01" };
    const hit = (o.answered || []).find((x) => u.includes(`kind=eq.${x.kind}&contact=eq.${encodeURIComponent(x.contact)}`));
    return ok(hit ? [{ action: hit.action || "yes", source: hit.source || "go_page" }] : []);
  }
  if (u.endsWith("/rest/v1/marketing_optins") && opt.method === "POST") {
    if (o.insertFail) return { ok: false, status: 404, json: async () => ({}), text: async () => '{"code":"42P01"}' };
    return { ok: true, status: 201, json: async () => ({}), text: async () => "" };
  }
  // Read-only lookups: the emails linked to a phone, a known customer.
  if (u.includes("/rest/v1/marketing_optins?") || u.includes("/rest/v1/whatsapp_requests?") || u.includes("/rest/v1/bookings?")) {
    if (o.linkFail) return { ok: false, status: 503, json: async () => ({}), text: async () => "down" };
    if (u.includes("marketing_optins?phone=") && u.includes("select=email")) return ok((o.optinEmails || []).map((email) => ({ email })));
    if (u.includes("whatsapp_requests?") && u.includes("select=contact_email")) return ok((o.reqEmails || []).map((contact_email) => ({ contact_email })));
    if (u.includes("marketing_optins?phone=") && u.includes("select=id")) return ok(o.knownOptin ? [{ id: 1 }] : []);
    if (u.includes("bookings?")) return ok(o.knownBooking ? [{ id: 1 }] : []);
    return ok([]);
  }
  if (u.includes("/rest/v1/app_secrets?")) return ok([]);
  if (u.includes("graph.facebook.com") && u.includes("message_templates")) {
    if (o.graphFail) return { ok: false, status: 500, json: async () => ({}), text: async () => "" };
    return ok({ data: o.templates || [] });
  }
  return { ok: false, status: 404, json: async () => [], text: async () => "" };
};
const sess = (step = "done", data = {}) => ({ phone: PH, step, data: { lang: "en", ...data }, wa_name: "Ana" });
const posts = () => (B ? B.calls.filter((c) => c.u.endsWith("/rest/v1/marketing_optins") && c.o.method === "POST").flatMap((c) => { const b = JSON.parse(c.o.body); return Array.isArray(b) ? b : [b]; }) : []);
const writesElsewhere = () => (B ? B.calls.filter((c) => !c.u.includes("marketing_optins") && c.o.method && c.o.method !== "GET").length : 0);
const ev = (name) => (B ? B.events.filter((e) => e.event === name) : []);

const NOTICE_EN = "Can Massage Club send you offers and reminders to book again, by email and WhatsApp? You can stop any time with one tap, or by writing to support@massageclub.io.";
const NOTICE_ES = "¿Puede Massage Club enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp? Puedes darte de baja cuando quieras con un toque o escribiendo a support@massageclub.io.";
const STOP_EN = "Done. We will not send you offers or reminders to book again any more, here or by email. Messages about a booking you make still reach you.";
const STOP_ES = "Hecho. Ya no te enviaremos ofertas ni recordatorios para volver a reservar, ni por aquí ni por email. Los mensajes sobre una reserva que hagas te seguirán llegando.";

// ---------------------------------------------------------------------------
// 1. The ask after a confirmed booking.
// ---------------------------------------------------------------------------
{
  const G = "1 ask after confirmation";
  if (!B) check(G, "runs against bot.ts", "MISSING: no marketing consent block or consent.ts", "ran", "today: nothing asks after a booking");
  if (B) {
    B.reset(); B.state.window = true; B.setFetch(db());
    const s = sess("done");
    const asked = await B.mktAskAfterBooking(s, PH, "en", { id: 9201, contact_email: EM, first_name: "Ana" });
    const m = B.sent[0] || {};
    check(G, "asked", [asked, B.sent.length, m.type], [true, 1, "buttons"]);
    check(G, "the notice, then the privacy link", m.body, `${NOTICE_EN}\n\nPrivacy: book.massageclub.io/privacy`);
    check(G, "two equal buttons, nothing pre-selected", (m.buttons || []).map((b) => [b.id, b.title]), [["mkt_yes_en_9201", "Yes, send me offers"], ["mkt_no_en_9201", "No thanks"]]);
    check(G, "the status is read by phone and by email", B.calls.filter((c) => c.u.includes("marketing_status")).map((c) => /kind=eq\.(phone|email)/.exec(c.u)[1]), ["phone", "email"]);
    check(G, "remembered in the session, with the words shown", [!!s.data.mktAskedAt, s.data.mktAsk?.lang, s.data.mktAsk?.request_id, s.data.mktAsk?.email, s.data.mktAsk?.wording === K.mktWording("en")], [true, "en", 9201, EM, true]);
    check(G, "one mkt_asked event", ev("mkt_asked").map((e) => e.meta.request_id), [9201]);
    // once per booking, while not answered
    B.reset();
    const same = await B.mktAskAfterBooking(s, PH, "en", { id: 9201, contact_email: EM });
    check(G, "the same booking is never asked twice", [same, B.sent.length, ev("mkt_ask_skipped")[0]?.meta?.why], [false, 0, "asked_before"]);
    B.reset();
    const again = await B.mktAskAfterBooking(s, PH, "en", { id: 9202, contact_email: EM });
    check(G, "a next booking, still not answered: asked again (the rule: existing customers are asked at their next booking)", [again, B.sent.length, s.data.mktAskedReqs], [true, 1, [9201, 9202]]);
    B.reset();
    const told = await B.mktAskAfterBooking(sess("done", { mktAnswer: "withdraw" }), PH, "en", { id: 9220, contact_email: EM });
    check(G, "the session knows they said stop: not asked (even if the row did not save)", [told, B.sent.length, ev("mkt_ask_skipped")[0]?.meta?.why], [false, 0, "answered_before"]);
    // the switch: off until the privacy page is complete
    for (const [name, v] of [["MKT_ASK missing", undefined], ["MKT_ASK off", "off"], ["MKT_ASK anything else", "yes"]]) {
      B.reset(); B.state.secrets.MKT_ASK = v;
      const r = await B.mktAskAfterBooking(sess("done"), PH, "en", { id: 9221, contact_email: EM });
      check(G, `${name}: not asked`, [r, B.sent.length, ev("mkt_ask_skipped")[0]?.meta?.why, B.calls.length], [false, 0, "switch_off", 0], "the question links the privacy page, which must name the controller first");
    }
    B.state.secrets.MKT_ASK = "on";
    // Spanish
    B.reset();
    const es = sess("done", { lang: "es" });
    await B.mktAskAfterBooking(es, PH, "es", { id: 9203, contact_email: EM });
    check(G, "Spanish: the notice", B.sent[0]?.body, `${NOTICE_ES}\n\nPrivacidad: book.massageclub.io/privacy`);
    check(G, "Spanish: the buttons", (B.sent[0]?.buttons || []).map((b) => b.title), ["Sí, quiero ofertas", "No, gracias"]);
    // answered on another path already
    for (const [name, answered] of [["by phone", [{ kind: "phone", contact: PH }]], ["by email (the website form)", [{ kind: "email", contact: EM }]]]) {
      B.reset(); B.setFetch(db({ answered }));
      const r = await B.mktAskAfterBooking(sess("done"), PH, "en", { id: 9204, contact_email: EM });
      check(G, `already answered ${name}: not asked`, [r, B.sent.length, ev("mkt_ask_skipped")[0]?.meta?.why], [false, 0, "answered_before"]);
    }
    // outside the 24h window
    B.reset(); B.setFetch(db()); B.state.window = false;
    const w = await B.mktAskAfterBooking(sess("done"), PH, "en", { id: 9205, contact_email: EM });
    check(G, "outside the 24h window: not asked", [w, B.sent.length, ev("mkt_ask_skipped")[0]?.meta?.why], [false, 0, "window_closed"]);
    B.state.window = true;
    // the status cannot be read (migration not applied): not asked, Jordan told
    B.reset(); B.setFetch(db({ statusFail: true }));
    const u = await B.mktAskAfterBooking(sess("done"), PH, "en", { id: 9206, contact_email: EM });
    check(G, "status unreadable: not asked, one card", [u, B.sent.length, B.cards.map((c) => c.badge)], [false, 0, ["CONSENT NOT ASKED"]], "a tap that could not be saved is worse than no question");
    // test contacts: nothing asked, nothing recorded, nothing logged
    B.setFetch(db());
    const tests = [
      ["Jordan's number (TEST_PHONES)", B.TEST_PHONE_0, null, "Ana"],
      ["a fake canary number", "34600000123", null, "Ana"],
      ["a +86 number ending 997", "8613800000997", null, "Ana"],
      ["an example.com email", PH, "persona@example.com", "Ana"],
      ["a +mctest email", PH, "persona+mctest3@correo.invalid", "Ana"],
      ["a name with prueba", PH, EM, "Prueba Final"],
    ];
    for (const [name, phone, email, first] of tests) {
      B.reset();
      const r = await B.mktAskAfterBooking({ phone, step: "done", data: { lang: "en" } }, phone, "en", { id: 9207, contact_email: email, first_name: first });
      check(G, `test contact, ${name}: nothing at all`, [r, B.sent.length, B.events.length, B.calls.length, B.saved.length], [false, 0, 0, 0, 0]);
    }
    // a held customer, a third-language customer, a web tap with no phone
    B.reset(); B.state.hold.add(PH);
    check(G, "a held customer: not asked", [await B.mktAskAfterBooking(sess("done"), PH, "en", { id: 9208 }), B.sent.length], [false, 0]);
    B.state.hold.clear();
    B.reset();
    check(G, "a customer we write to in Romanian: not asked (the words would be translated)", [await B.mktAskAfterBooking(sess("done", { xlang: "ro" }), PH, "en", { id: 9209 }), B.sent.length], [false, 0]);
    B.reset();
    check(G, "no phone (offer page, no WhatsApp): not asked", [await B.mktAskAfterBooking(sess("done"), "", "en", { id: 9210 }), B.sent.length], [false, 0]);
    // after the email question that follows a confirmation
    B.reset();
    const se = sess("done", { email: EM, mktAfterEmail: { request_id: 9211, at: Date.now() } });
    const ae = await B.mktAfterEmailStep(se, PH, "en");
    check(G, "after the email question: asked, flag cleared", [ae, B.sent.length, B.sent[0]?.buttons?.[0]?.id, "mktAfterEmail" in se.data], [true, 1, "mkt_yes_en_9211", false]);
    B.reset();
    const old = sess("done", { email: EM, mktAfterEmail: { request_id: 9212, at: Date.now() - 2 * 86400e3 } });
    check(G, "a day-old flag: not asked, cleared", [await B.mktAfterEmailStep(old, PH, "en"), B.sent.length, "mktAfterEmail" in old.data], [false, 0, false]);
    B.reset();
    check(G, "no flag (the email question before a confirmation): nothing", [await B.mktAfterEmailStep(sess("await_email_post"), PH, "en"), B.sent.length], [false, 0]);
  }
}

// ---------------------------------------------------------------------------
// 2. The booking path calls it, and "Membership is free" is gone.
// ---------------------------------------------------------------------------
{
  const G = "2 wiring";
  const code = botSrc.replace(/^\s*\/\/.*$/gm, "");
  const ao = lift(code, "async function acceptOffer(");
  check(G, "acceptOffer asks after the booked card", /if \(mktNow\) await mktAskAfterBooking\(s, from, L, req\)/.test(ao) && ao.indexOf("mktAskAfterBooking(") > ao.indexOf('badge: relSlot ? "BOOKED (RELEASED TIME)" : "BOOKED"'), true);
  check(G, "with an email on file: asked straight away (mktNow)", /s\.step = "done"; await saveSession\(s\);\s*mktNow = true;/.test(ao), true);
  check(G, "without one: after the email question (mktAfterEmail)", /s\.step = "await_email_post";\s*s\.data\.mktAfterEmail = \{ request_id: Number\(req\.id\), at: Date\.now\(\) \};/.test(ao), true);
  check(G, "Membership is free is never sent", /COPY\[\w+\]\.memberJoin/.test(code), false, "it promised a membership nothing recorded");
  check(G, "the email step asks next (typed address, skip, no email)", [
    /if \(isEmail\(text\) && s\.step === "await_email_post" && s\.data\.mktAfterEmail\) \{[\s\S]{0,300}?mktAfterEmailStep\(s, from, L\)/.test(code),
    (between(code, 'case "await_email_post": {', 'case "await_offer": {').match(/mktAfterEmailStep\(s, from, L\)/g) || []).length,
  ], [true, 3]);
  check(G, "no offers question on the way out (cancel at the email step)", /if \(s\.data\.mktAfterEmail\) \{ delete s\.data\.mktAfterEmail; await saveSession\(s\); \}\s*const cq = /.test(code), true);
}

// ---------------------------------------------------------------------------
// 3. Both taps are saved.
// ---------------------------------------------------------------------------
{
  const G = "3 taps saved";
  if (!B) check(G, "runs against bot.ts", "MISSING: no marketing consent block or consent.ts", "ran", "today: no tap is saved anywhere");
  if (B) {
    B.reset(); B.setFetch(db());
    const s = sess("done", { mktAskedAt: "x", mktAsk: { lang: "en", request_id: 9201, email: EM, wording: K.mktWording("en") } });
    const y = await B.mktCustomerTurn(s, PH, "mkt_yes_en_9201", "");
    check(G, "yes: handled", y, true);
    check(G, "yes: one row", posts(), [{ channel: "email+whatsapp", source: "bot", action: "yes", wording: K.mktWording("en"), wording_lang: "en", phone: PH, email: EM, request_id: 9201 }]);
    check(G, "yes: the words saved are the words shown", K.mktWording("en"), `${NOTICE_EN}\n\nPrivacy: book.massageclub.io/privacy\n[Yes, send me offers] [No thanks]`);
    check(G, "yes: the reply", B.sent.map((x) => x.body), [K.MKT_COPY.en.savedYes]);
    check(G, "yes: the step is untouched, the answer remembered", [s.step, s.data.mktAnswer, "mktAsk" in s.data], ["done", "yes", false]);
    check(G, "yes: one mkt_answer event", ev("mkt_answer").map((e) => e.meta.action), ["yes"]);
    B.reset();
    const sn = sess("await_day", { lang: "es", service: "svc_relax" });
    await B.mktCustomerTurn(sn, PH, "mkt_no_es_9203", "");
    const p = posts()[0] || {};
    check(G, "no (Spanish, no session ask): the row", [p.action, p.wording, p.wording_lang, p.request_id, p.phone, p.email], ["no", K.mktWording("es"), "es", 9203, PH, null], "the button id carries the language and the request");
    check(G, "no: the reply", B.sent.map((x) => x.body), [K.MKT_COPY.es.savedNo]);
    check(G, "no: a booking in progress carries on", [sn.step, sn.data.service], ["await_day", "svc_relax"]);
    // a save that fails
    B.reset(); B.setFetch(db({ insertFail: true }));
    const sf = sess("done", { mktAsk: { lang: "en", request_id: 9201, email: EM, wording: K.mktWording("en") } });
    await B.mktCustomerTurn(sf, PH, "mkt_yes_en_9201", "");
    check(G, "failed save: tried twice", posts().length, 2);
    check(G, "failed save: the customer is told it did not save, never 'saved'", B.sent.map((x) => x.body), [K.MKT_COPY.en.saveFailed]);
    check(G, "failed save: Jordan gets a card", B.cards.map((c) => c.badge), ["CONSENT NOT SAVED"]);
    check(G, "failed save: nothing remembered as answered", [sf.data.mktAnswer, ev("mkt_save_failed").length], [undefined, 1]);
    // a test contact's tap
    B.reset(); B.setFetch(db());
    await B.mktCustomerTurn({ phone: "34600000123", step: "done", data: {} }, "34600000123", "mkt_yes_en_1", "");
    check(G, "a test contact's tap: answered, never recorded", [B.sent.length, posts().length], [1, 0]);
    // a typed yes or no: the same question once more, never saved
    B.reset();
    const st = sess("done", { mktAskedAt: new Date().toISOString(), mktAsk: { lang: "es", request_id: 9230, email: EM, wording: K.mktWording("es") } });
    const ty = await B.mktCustomerTurn(st, PH, "", "Sí");
    check(G, "a typed 'Sí': the same question and buttons again, nothing saved", [ty, B.sent.map((x) => [x.type, x.body]), (B.sent[0]?.buttons || []).map((b) => b.id), posts().length], [true, [["buttons", K.mktAskBody("es")]], ["mkt_yes_es_9230", "mkt_no_es_9230"], 0]);
    B.reset();
    check(G, "only once", [await B.mktCustomerTurn(st, PH, "", "si"), B.sent.length], [false, 0]);
    B.reset();
    const live = sess("await_offer", { mktAskedAt: new Date().toISOString(), mktAsk: { lang: "en", request_id: 9231, email: EM, wording: K.mktWording("en") }, offer: { row: "r-2" } });
    check(G, "a typed 'yes' while an offer waits is the offer's, not ours", [await B.mktCustomerTurn(live, PH, "", "yes"), B.sent.length], [false, 0]);
    // not ours
    B.reset();
    check(G, "other buttons are not ours", [await B.mktCustomerTurn(sess("await_offer"), PH, "offer_yes_abc", ""), await B.mktCustomerTurn(sess("await_day"), PH, "day_tomorrow", ""), B.sent.length, B.calls.length], [false, false, 0, 0]);
  }
}

// ---------------------------------------------------------------------------
// 4. STOP from a customer.
// ---------------------------------------------------------------------------
{
  const G = "4 STOP for a customer";
  if (!K || !B) check(G, "runs against bot.ts", "MISSING: no marketing consent block or consent.ts", "ran", "today: a customer's STOP goes into the booking flow and is recorded nowhere");
  if (K) {
    const yes = ["STOP", "stop", "Stop.", "STOP 🛑", "please stop", "Unsubscribe", "unsubscribe me", "Stop offers", "stop promotions", "Stop Promotions", "no more offers", "opt-out", "BAJA", "Baja", "darme de baja", "Quiero darme de baja", "no quiero más ofertas", "No quiero recibir ofertas, gracias", "basta de ofertas",
      // the review's probe (20 Nov): each of these used to reach the booking flow
      "No quiero publicidad", "No quiero recibir publicidad", "No me mandes publicidad", "Dejad de enviarme ofertas", "Deja de escribirme", "no quiero más mensajes", "Bórrame de la lista", "eliminar mis datos", "Don't send me offers", "I don't want offers", "No more emails", "unsubscribe me from emails", "Cancel subscription",
      // Meta's marketing opt-out button, in English and Spanish
      "Detener promociones", "darme de baja de las ofertas", "no quiero promociones"];
    for (const t of yes) check(G, `stopIntent("${t}")`, !!K.stopIntent(t), true);
    const no = ["stop at 7pm", "Can you stop by the studio?", "Stop, 7pm is better", "No", "cancel", "tomorrow", "planta baja", "baja por maternidad", "I want to stop the booking", "no thanks", "ok", "", "stop ".repeat(30),
      "no offers yet?", "Any offers?", "Do you have offers?", "I don't want the deep tissue offer, I prefer relax", "no quiero la oferta de las 18:00", "¿Qué necesitas para enviar la reserva?", "estoy de baja, no puedo ir", "no me mandes la dirección"];
    for (const t of no) check(G, `stopIntent(${JSON.stringify(t.slice(0, 30))}) is not a STOP`, K.stopIntent(t), null);
    check(G, "the language of the words", [K.stopIntent("BAJA")?.lang, K.stopIntent("unsubscribe")?.lang, K.stopIntent("STOP")?.lang, K.stopIntent("No quiero publicidad")?.lang, K.stopIntent("Don't send me offers")?.lang], ["es", "en", null, "es", "en"]);
    check(G, "an erasure request is flagged", [K.stopIntent("eliminar mis datos")?.erase, K.stopIntent("Please delete my data")?.erase, !!K.stopIntent("STOP")?.erase], [true, true, false]);
    check(G, "the replies, exactly, signed Massage Club", [K.stopReply("en"), K.stopReply("es")], [`${STOP_EN}\n\nMassage Club`, `${STOP_ES}\n\nMassage Club`]);
    check(G, "the reply names offers AND reminders, here AND by email", [/offers or reminders/.test(STOP_EN) && /by email/.test(STOP_EN), /ofertas ni recordatorios/.test(STOP_ES) && /por email/.test(STOP_ES)], [true, true], "what the yes covered is what stops");
  }
  if (B) {
    B.reset(); B.setFetch(db({ optinEmails: ["cliente.ocho@correo.invalid"], reqEmails: ["Otra.Direccion@Correo.invalid"] })); B.state.lastReq = { id: 9301, contact_email: "Cliente.Ocho@Correo.invalid", first_name: "Ana", stage: "confirmed", created_at: new Date().toISOString() };
    const s = sess("done", { lang: "en" });
    const r = await B.mktCustomerTurn(s, PH, "", "STOP", "wamid.TEST1");
    check(G, "handled", r, true);
    check(G, "withdraw rows for the phone and every email known for them, in one insert", [posts(), B.calls.filter((c) => c.u.endsWith("/rest/v1/marketing_optins") && c.o.method === "POST").length], [[
      { channel: "email+whatsapp", source: "bot", action: "withdraw", wording: "STOP", wording_lang: "en", phone: PH, email: "cliente.ocho@correo.invalid" },
      { channel: "email+whatsapp", source: "bot", action: "withdraw", wording: "STOP", wording_lang: "en", phone: null, email: "otra.direccion@correo.invalid" },
    ], 1], "a STOP on WhatsApp stops email too");
    check(G, "one reply, signed", B.sent.map((x) => x.body), [`${STOP_EN}\n\nMassage Club`]);
    check(G, "nothing about the booking is written", writesElsewhere(), 0, "no whatsapp_requests PATCH, no cancel");
    check(G, "remembered, with the message id", [s.data.mktAnswer, ev("mkt_withdraw")[0]?.meta?.recorded, ev("mkt_withdraw")[0]?.meta?.wamid, ev("mkt_withdraw")[0]?.meta?.live], ["withdraw", true, "wamid.TEST1", false]);
    // Spanish, from the words
    B.reset(); B.setFetch(db()); B.state.lastReq = null;
    await B.mktCustomerTurn(sess("done", { lang: "en", email: EM }), PH, "", "darme de baja");
    check(G, "Spanish words, Spanish reply", [B.sent.map((x) => x.body), posts()[0]?.wording_lang, posts()[0]?.email], [[`${STOP_ES}\n\nMassage Club`], "es", EM]);
    B.reset();
    await B.mktCustomerTurn(sess("done", { lang: "en", email: EM }), PH, "", "No quiero recibir publicidad, gracias");
    check(G, "a tier 2 wording: recorded and answered", [posts()[0]?.action, posts()[0]?.wording, B.sent.length], ["withdraw", "No quiero recibir publicidad, gracias", 1]);
    // a bare STOP in a Spanish session
    B.reset();
    await B.mktCustomerTurn(sess("done", { lang: "es", email: EM }), PH, "", "STOP");
    check(G, "a bare STOP follows the session's language", B.sent.map((x) => x.body), [`${STOP_ES}\n\nMassage Club`]);
    // the template's own opt-out button text
    B.reset();
    check(G, "Meta's 'Stop promotions' button text", await B.mktCustomerTurn(sess("done", { email: EM }), PH, "Stop promotions", "Stop promotions"), true);
    // an erasure request
    B.reset();
    await B.mktCustomerTurn(sess("done", { email: EM }), PH, "", "Borrad todos mis datos por favor");
    check(G, "an erasure request: withdrawn, answered, and Jordan gets an ERASURE card", [posts().length, B.sent.length, B.cards.map((c) => c.badge)], [1, 1, ["ERASURE REQUEST"]], "GDPR art. 17: a person answers within a month");
    // in the middle of a booking, a request still live
    B.reset();
    const mid = sess("await_offer", { lang: "en", email: EM, offer: { row: "r-1", time: "18:00", studio: "Estudio Ficticio", request: 9302 }, service: "svc_relax", day: "Tomorrow" });
    const before = JSON.stringify({ step: mid.step, offer: mid.data.offer, service: mid.data.service, day: mid.data.day });
    const mr = await B.mktCustomerTurn(mid, PH, "", "stop");
    check(G, "live request: the withdraw is recorded", [posts().map((p) => p.action), ev("mkt_withdraw")[0]?.meta?.live], [["withdraw"], true]);
    check(G, "live request: NO 'no more offers' reply, and the booking flow still reads the message", [mr, B.sent.length], [false, 0], "the next studio offer would contradict it; 'stop' at an offer has always meant change or cancel");
    check(G, "live request: the step, the offer and the details stay", JSON.stringify({ step: mid.step, offer: mid.data.offer, service: mid.data.service, day: mid.data.day }), before);
    B.reset(); B.state.lastReq = { id: 9303, stage: "studio_asked", created_at: new Date(Date.now() - 3600e3).toISOString(), contact_email: EM };
    const pend = sess("done", { lang: "es", email: EM });
    check(G, "a request still with the studios (step done): the same", [await B.mktCustomerTurn(pend, PH, "", "no quiero más ofertas"), posts().length, B.sent.length], [false, 1, 0]);
    B.reset(); B.state.lastReq = { id: 9304, stage: "studio_asked", created_at: new Date(Date.now() - 5 * 86400e3).toISOString() };
    check(G, "a request stuck for 5 days is not live: answered here", [await B.mktCustomerTurn(sess("done", { email: EM }), PH, "", "STOP"), B.sent.length], [true, 1]);
    B.reset(); B.state.lastReq = { id: 9305, stage: "confirmed", created_at: new Date().toISOString() };
    check(G, "a confirmed booking: answered here, never a cancel", [await B.mktCustomerTurn(sess("done", { email: EM }), PH, "", "no quiero más ofertas"), B.sent.length, writesElsewhere()], [true, 1, 0]);
    B.state.lastReq = null;
    // halfway through choosing (no request yet): answered, step kept
    B.reset();
    const flowS = sess("await_day", { lang: "en", service: "svc_relax" });
    check(G, "mid-flow, no request yet: recorded and answered, the step stays", [await B.mktCustomerTurn(flowS, PH, "", "STOP"), posts().length, B.sent.length, flowS.step], [true, 1, 1, "await_day"]);
    // ordinary messages are left to the booking flow
    B.reset();
    const flow = sess("await_day", { lang: "en", service: "svc_relax" });
    const results = [];
    for (const t of ["tomorrow", "stop at 7pm", "No", "cancel", "Hi"]) results.push(await B.mktCustomerTurn(flow, PH, "", t));
    check(G, "booking-flow messages are not ours", [results, B.sent.length, B.calls.length, flow.step], [[false, false, false, false, false], 0, 0, "await_day"]);
    // a withdraw that does not save: still told it is done, Jordan writes it
    B.reset(); B.setFetch(db({ insertFail: true }));
    await B.mktCustomerTurn(sess("done", { email: EM }), PH, "", "unsubscribe");
    check(G, "failed withdraw: told done, card to Jordan, event says not recorded", [B.sent.map((x) => x.body), B.cards.map((c) => c.badge), ev("mkt_withdraw")[0]?.meta?.recorded], [[`${STOP_EN}\n\nMassage Club`], ["CONSENT NOT SAVED"], false], "the opt-out is theirs the moment they ask");
    B.reset(); B.state.cardThrows = true;
    await B.mktCustomerTurn(sess("done", { email: EM }), PH, "", "unsubscribe");
    check(G, "failed withdraw AND the email card fails: Jordan's WhatsApp hears", [B.waAlerts.length, /NOT saved/.test(B.waAlerts[0]?.text || "")], [1, true]);
    B.state.cardThrows = false;
    // the linked email lookup fails: the phone is saved, Jordan checks the email
    B.reset(); B.setFetch(db({ linkFail: true }));
    await B.mktCustomerTurn(sess("done", {}), PH, "", "STOP");
    check(G, "linked lookup down: the phone is withdrawn, one card to add the email", [posts().map((p) => [p.phone, p.email]), B.cards.map((c) => c.badge), B.sent.length], [[[PH, null]], ["CONSENT: CHECK EMAIL"], 1]);
    // twice in a minute: one row
    B.reset(); B.setFetch(db());
    const tw = sess("done", { email: EM });
    await B.mktCustomerTurn(tw, PH, "", "STOP"); await B.mktCustomerTurn(tw, PH, "", "STOP");
    check(G, "STOP twice in a minute: one row, two replies", [posts().length, B.sent.length], [1, 2]);
    // a test contact
    B.reset(); B.setFetch(db());
    await B.mktCustomerTurn({ phone: "34600000123", step: "done", data: {} }, "34600000123", "", "STOP");
    check(G, "a test contact: replied, nothing recorded", [B.sent.length, posts().length], [1, 0]);
    B.state.lastReq = null;
  }
}

// ---------------------------------------------------------------------------
// 5. Studios first; a BAJA on the letters path.
// ---------------------------------------------------------------------------
{
  const G = "5 studios and the letters path";
  const at = (needle) => botSrc.indexOf(needle);
  const letters = at("if (text && !replyId && await handleLetterReply(from, text)");
  const studios = at("// Anything at all from a known studio number is a studio talking to us,");
  const hook = at("if (await mktCustomerTurn(s, from, replyId,");
  const lateEmail = at("// v125 (25 Sept, live): an email address is an email address wherever it");
  const shadow = at("if (text && !replyId) readerShadow(s, from, text);");
  check(G, "letters, then studio numbers, then the customer STOP and taps", [letters > 0, studios > letters, hook > studios], [true, true, true]);
  check(G, "and the STOP comes before anything in the booking flow reads the message", [hook > 0 && hook < shadow, hook > 0 && hook < lateEmail], [true, true]);
  const muted = at('if (s.step === "muted") { await mktMutedStop(from, text).catch(() => null); return new Response("OK", { status: 200 }); }');
  check(G, "a muted number never gets here (it is only taken off, silently, above)", muted > 0 && hook > muted, true);
  if (B) {
    B.reset(); B.setFetch(db());
    const m1 = await B.mktMutedStop(PH, "STOP");
    check(G, "muted + STOP: a withdraw row, no reply, no card", [m1, posts().map((p) => [p.action, p.phone]), B.sent.length, B.cards.length], [true, [["withdraw", PH]], 0, 0], "the shutdown rule: no replies");
    B.reset();
    check(G, "muted + anything else: nothing", [await B.mktMutedStop(PH, "hola"), B.calls.length, B.sent.length], [false, 0, 0]);
    B.reset(); B.setFetch(db({ insertFail: true }));
    const m2 = await B.mktMutedStop(PH, "STOP");
    check(G, "muted + STOP that does not save: still no reply, but Jordan gets a card", [m2, B.sent.length, B.cards.map((c) => c.badge)], [false, 0, ["CONSENT NOT SAVED"]], "never silent; the rule bars replies to them, not internal alerts");
    // handleLetterReply
    const letterCase = async (name, o, text, want) => {
      B.reset(); B.setFetch(db(o.db || {}));
      B.state.lastReq = o.lastReq || null; B.state.partner = o.partner || null; B.state.letter = null; B.state.session = o.session || null;
      const handled = await B.handleLetterReply(o.from || PH, text);
      const got = { handled, withdraws: posts().filter((p) => p.action === "withdraw").length, replies: B.sent.map((x) => x.body), cards: B.cards.map((c) => c.badge) };
      check(G, name, got, want);
    };
    const old = { id: 9401, stage: "confirmed", created_at: new Date(Date.now() - 90 * 86400e3).toISOString(), contact_email: EM };
    await letterCase("a customer 90 days after their last request writes BAJA: withdrawn and answered, no letters card", { lastReq: old }, "BAJA", { handled: true, withdraws: 1, replies: [`${STOP_ES}\n\nMassage Club`], cards: [] });
    await letterCase("a website customer known only by an offers answer: the same", { db: { knownOptin: true } }, "Quiero darme de baja", { handled: true, withdraws: 1, replies: [`${STOP_ES}\n\nMassage Club`], cards: [] });
    await letterCase("a customer known only by a booking: the same", { db: { knownBooking: true } }, "baja", { handled: true, withdraws: 1, replies: [`${STOP_ES}\n\nMassage Club`], cards: [] });
    await letterCase("a customer with a recent request: the same (no longer handed back unrecorded)", { lastReq: { ...old, created_at: new Date().toISOString() } }, "BAJA", { handled: true, withdraws: 1, replies: [`${STOP_ES}\n\nMassage Club`], cards: [] });
    await letterCase("a customer with a request still live: recorded, and handed on to the booking flow", { lastReq: { ...old, stage: "studio_asked", created_at: new Date().toISOString() } }, "BAJA", { handled: false, withdraws: 1, replies: [], cards: [] });
    await letterCase("a muted customer: recorded, silent", { lastReq: old, session: { phone: PH, step: "muted", data: {} } }, "BAJA", { handled: true, withdraws: 1, replies: [], cards: [] });
    await letterCase("a number we cannot place: the letters card AND a marketing withdraw", {}, "BAJA", { handled: true, withdraws: 1, replies: [], cards: ["LETTER BAJA"] });
    const unknownCard = B.cards[0]?.paras || [];
    check(G, "the letters card says the marketing opt-out was recorded", unknownCard.some((p) => /marketing opt-out was also recorded/.test(p)), true);
    await letterCase("a studio's own number: letters only, no marketing row", { partner: { id: "p-1", business_name: "Estudio Ficticio" } }, "BAJA", { handled: true, withdraws: 0, replies: [], cards: ["LETTER BAJA"] });
    await letterCase("a test number: the letters test path only", { from: "34600000123" }, "BAJA", { handled: true, withdraws: 0, replies: [], cards: ["TEST BAJA (LETTERS)"] });
    await letterCase("not a BAJA at all: not the letters path's", {}, "hola, quiero un masaje", { handled: false, withdraws: 0, replies: [], cards: [] });
    B.state.lastReq = null; B.state.partner = null; B.state.session = null;
  }
  const lr = path.join(botDir, "letters_reply.ts");
  const L = await import(pathToFileURL(lr).href).catch(() => null);
  check(G, "the letters path still reads BAJA as BAJA", L ? [L.letterBajaIntent("BAJA"), L.BAJA_ONLY_RE.test("BAJA")] : null, [true, true]);
  try {
    const oldLr = execFileSync("git", ["show", "3c1064c:supabase/functions/wa-bot/letters_reply.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    check(G, "letters_reply.ts unchanged since 3c1064c", oldLr === fs.readFileSync(lr, "utf8"), true);
  } catch { /* no git history here */ }
}

// ---------------------------------------------------------------------------
// 9. ops "tpl" and Meta's 131050.
// ---------------------------------------------------------------------------
{
  const G = "9 templates";
  const code = botSrc.replace(/^\s*\/\/.*$/gm, "");
  const tpl = between(code, 'if (payload?.ops === "tpl") {', "const wabaId = String(payload?.entry?.[0]?.id");
  check(G, "ops tpl checks consent before sending, and refuses when it says no", [tpl.indexOf("mktTemplateGate(") > 0 && tpl.indexOf("mktTemplateGate(") < tpl.indexOf("sendTemplate("), /if \(!consent\.ok\) return/.test(tpl)], [true, true]);
  check(G, "a 131050 delivery failure is recorded as a withdraw", /Number\(err\.code\) === 131050\) await mktMetaStopped\(to, err\)/.test(code), true);
  if (B) {
    B.state.secrets.WABA_ID = "123456789012";
    const gate = async (o, to = PH) => { B.reset(); B.setFetch(db(o)); return await B.mktTemplateGate(to, "rebook_offer_v1", "es"); };
    const mk = [{ name: "rebook_offer_v1", language: "es", category: "MARKETING" }];
    const ut = [{ name: "rebook_offer_v1", language: "es", category: "UTILITY" }];
    check(G, "MARKETING to a verified yes: sends", (await gate({ templates: mk, answered: [{ kind: "phone", contact: PH, action: "yes", source: "bot" }] })).ok, true);
    check(G, "MARKETING to someone who said STOP: refused", (await gate({ templates: mk, answered: [{ kind: "phone", contact: PH, action: "withdraw", source: "bot" }] })).ok, false);
    check(G, "MARKETING to someone never asked: refused", (await gate({ templates: mk })).ok, false);
    check(G, "MARKETING to a quiz yes (no proof it is theirs): refused", (await gate({ templates: mk, answered: [{ kind: "phone", contact: PH, action: "yes", source: "quiz" }] })).ok, false);
    check(G, "MARKETING, status unreadable: refused", (await gate({ templates: mk, statusFail: true })).ok, false);
    check(G, "category unreadable: treated as marketing", (await gate({ graphFail: true, answered: [{ kind: "phone", contact: PH, action: "withdraw" }] })).ok, false);
    check(G, "UTILITY (about a booking) after a STOP: still sends", (await gate({ templates: ut, answered: [{ kind: "phone", contact: PH, action: "withdraw" }] })).ok, true);
    check(G, "MARKETING to a test number: refused", (await gate({ templates: mk, answered: [{ kind: "phone", contact: "34600000123", action: "yes", source: "bot" }] }, "34600000123")).ok, false);
    delete B.state.secrets.WABA_ID;
    B.reset(); B.setFetch(db());
    await B.mktMetaStopped(PH, { code: 131050, title: "User stopped marketing messages" });
    check(G, "131050: one withdraw row for the number", posts().map((p) => [p.action, p.phone, /131050/.test(p.wording)]), [["withdraw", PH, true]]);
  }
}

// ---------------------------------------------------------------------------
// 6. Copy.
// ---------------------------------------------------------------------------
{
  const G = "6 copy";
  if (!K) check(G, "runs against consent.ts", "MISSING: consent.ts", "ran");
  if (K) {
    check(G, "the fixed notice (EN)", K.MKT_COPY.en.notice, NOTICE_EN);
    check(G, "the fixed notice (ES)", K.MKT_COPY.es.notice, NOTICE_ES);
    check(G, "the fixed buttons", [K.MKT_COPY.en.yes, K.MKT_COPY.en.no, K.MKT_COPY.es.yes, K.MKT_COPY.es.no], ["Yes, send me offers", "No thanks", "Sí, quiero ofertas", "No, gracias"]);
    check(G, "buttons fit WhatsApp's 20 characters", [K.MKT_COPY.en.yes, K.MKT_COPY.en.no, K.MKT_COPY.es.yes, K.MKT_COPY.es.no].every((t) => t.length <= 20), true);
    const all = JSON.stringify(K.MKT_COPY) + K.MKT_COPY.en.emailAdded("a@b.c") + K.MKT_COPY.es.emailAdded("a@b.c");
    check(G, "no em dashes in consent.ts", DASH_RE.test(consentSrc), false);
    check(G, "no em dashes in the bot's consent block", DASH_RE.test(block), false);
    check(G, "massageclub.io links only", (all.match(/[a-z0-9.-]+\.(?:io|com|app)\/[^\s"]*/gi) || []).every((u) => /^book\.massageclub\.io\//.test(u)), true);
    check(G, "never signed with Jordan's name", /Jordan/.test(all), false);
    check(G, "no rate, membership, discount or health promise", /member|rate|discount|descuento|socio|tarifa|detox|toxin|immun/i.test(all), false);
  }
}

// ---------------------------------------------------------------------------
// 7. copy.ts stays pinned and unchanged.
// ---------------------------------------------------------------------------
{
  const G = "7 copy.ts pin";
  check(G, "bot.ts still imports copy.ts at 6715b8a", /from "https:\/\/raw\.githubusercontent\.com\/jordanjayhays-cpu\/your-massage-pass\/6715b8a\/supabase\/functions\/wa-bot\/copy\.ts"/.test(botSrc), true);
  try {
    const pinned = execFileSync("git", ["show", "6715b8a:supabase/functions/wa-bot/copy.ts"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 24, stdio: ["ignore", "pipe", "ignore"] });
    check(G, "copy.ts is byte for byte the pinned one", pinned === fs.readFileSync(path.join(botDir, "copy.ts"), "utf8"), true);
  } catch { /* no git history here: the import check above still runs */ }
}

// ---------------------------------------------------------------------------
// 8. The whole of bot.ts and consent.ts still parse (the hook and the email
// step live in the handler, which no other test lifts).
// ---------------------------------------------------------------------------
{
  const G = "8 parses";
  for (const [name, srcText] of [["bot.ts", botSrc], ["consent.ts", consentSrc]]) {
    let ok = "";
    try {
      const f = path.join(tmp, `parse_${name}.mjs`);
      fs.writeFileSync(f, stripTypeScriptTypes(srcText));
      execFileSync(process.execPath, ["--check", f], { stdio: ["ignore", "ignore", "pipe"] });
      ok = "parses";
    } catch (e) { ok = String(e.stderr || e.message || e).split("\n").slice(0, 4).join(" | "); }
    check(G, name, ok, "parses");
  }
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL [${f.group}] ${f.input}\n  got:  ${JSON.stringify(f.got)}\n  want: ${JSON.stringify(f.want)}${f.note ? "\n  note: " + f.note : ""}`);
  console.log(`\nconsent bot: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`consent bot: all ${pass} pass`);
