// Relay (Part A) and the closed-window offer template (Part B), 24 Nov 2026.
// Jordan forwards to the bot number what a studio or a customer wrote on his
// own phone; the bot asks who wrote it, saves it in that person's chat, reads
// it and records only what he taps. A customer whose 24 hours have closed can
// get the offer as a template. Everything runs against the real bot.ts code in
// sandboxes, with fetch answered by a small in-memory PostgREST, invented
// names (the repo is public) and no network at all.
//
// Run: node --experimental-strip-types tests/relay.mjs
// BOT=<path> runs the same checks against another copy of bot.ts.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const botDir = path.join(root, "supabase/functions/wa-bot");
const botSrc = fs.readFileSync(process.env.BOT || path.join(botDir, "bot.ts"), "utf8");
const read = (f) => { try { return fs.readFileSync(path.join(root, f), "utf8"); } catch { return ""; } };

let pass = 0;
const failures = [];
function check(group, input, got, want, note = "") {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else failures.push({ group, input, got, want, note });
}
const between = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i + 1); return i < 0 || j < 0 ? "" : src.slice(i, j); };
const lift = (src, head) => { const i = src.indexOf(head); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i) + 3); };
const one = (name) => (botSrc.match(new RegExp(`^(?:const|let) ${name} = .*$`, "m")) || [""])[0];
const liftArrow = (name) => { const i = botSrc.indexOf(`\nconst ${name} = `); return i < 0 ? "" : botSrc.slice(i + 1, botSrc.indexOf("\n};\n", i) + 3); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-relay-"));
let nmod = 0;
async function load(js) {
  const file = path.join(tmp, `m${nmod++}.mjs`);
  fs.writeFileSync(file, js);
  return import(pathToFileURL(file).href);
}
const url = (f) => pathToFileURL(path.join(botDir, f)).href;
const C = await import(url("copy.ts"));
const K = await import(url("consent.ts"));
const LR = await import(url("letters_reply.ts"));
const R = await import(url("relay.ts"));
const OT = await import(url("offer_tpl.ts"));
const AC = await import(url("agent_core.ts"));
const dash = (t) => /[‒-―−]/.test(String(t));
const digitsOf = (x) => String(x || "").replace(/[^0-9]/g, "");
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === "string" ? JSON.parse(body) : body), text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });

// The v204 pure block (the day and offer helpers), as request_126.mjs loads it.
const v204 = between(botSrc, "// ---- v204 offer step: pure helpers (start) ----", "// ---- v204 offer step: pure helpers (end) ----");
const O = await load(`import { askBand, stripAcc, madridMidnight, madridInstant, resolveRequestDate, detectTime, COPY, trSvc } from ${JSON.stringify(url("copy.ts"))};\n`
  + stripTypeScriptTypes(v204) + `\nconst __names = {};\n`
  + ["rowSlotAt", "dayOnly", "yesCall", "offerFitsDay", "offerFitsTime", "offerDayDate", "askWindow", "windowText", "offerBody", "offerButtons", "OFFER_COPY", "offerFar", "offerMissBy", "withLine", "offerSubject", "LATE_COPY", "offerSlotAt", "offerDayLabel", "offerDayPhrase", "studioWordDay", "whenFor", "OFFER_LEAD_MS", "MADRID_HM", "offerSchedule", "offerNudgeAt", "isAwayMessage", "offerEmailWait", "emailOfferHold"]
    .map((n) => `try { __names.${n} = ${n}; } catch {}`).join("\n")
  + `\nexport { __names, madridMidnight, madridInstant, resolveRequestDate, COPY, trSvc };\n`);
const P = O.__names;
// Tuesday 24 Nov 2026, Madrid wall clock (CET, UTC+1).
const M = (h, mi = 0, dayOff = 0) => O.madridInstant(new Date(Date.UTC(2026, 10, 24 + dayOff)), h).getTime() + mi * 60e3;
const iso = (ms) => new Date(ms).toISOString();
const T = { now: M(15, 0) };
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

// ---------------------------------------------------------------------------
// A small PostgREST: the filters, orders and writes these functions use.
// Anything outside the database (Meta, Resend, a model) is recorded as a
// network attempt and refused, so a test that reaches one fails.
// ---------------------------------------------------------------------------
function makeDb(seed = {}) {
  const t = { wa_messages: [], request_dispatch: [], whatsapp_requests: [], partners: [], funnel_events: [], wa_inbound_seen: [], app_secrets: [], wa_sessions: [], marketing_optins: [], letter_optouts: [], bookings: [] };
  for (const [k, v] of Object.entries(seed)) t[k] = v.map((r) => ({ ...r }));
  let nextId = 5000;
  const log = [];
  const network = [];
  const storage = [];
  const num = (x) => (x !== null && x !== "" && /^-?\d+(\.\d+)?$/.test(String(x)) ? Number(x) : null);
  const cmp = (a, b) => { const x = num(a), y = num(b); return x !== null && y !== null ? x - y : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; };
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const splitTop = (s) => { const out = []; let d = 0, cur = ""; for (const ch of s) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch; } if (cur) out.push(cur); return out; };
  function test(row, col, expr) {
    let neg = false;
    if (expr.startsWith("not.")) { neg = true; expr = expr.slice(4); }
    const i = expr.indexOf(".");
    const op = expr.slice(0, i), val = expr.slice(i + 1);
    const v = row[col];
    const has = v !== null && v !== undefined;
    let r = false;
    if (op === "eq") r = has && String(v) === val;
    else if (op === "neq") r = has && String(v) !== val;
    else if (op === "is") r = val === "null" ? !has : String(v) === val;
    else if (op === "in") r = has && val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(v));
    else if (op === "gte") r = has && cmp(v, val) >= 0;
    else if (op === "gt") r = has && cmp(v, val) > 0;
    else if (op === "lte") r = has && cmp(v, val) <= 0;
    else if (op === "lt") r = has && cmp(v, val) < 0;
    else if (op === "like" || op === "ilike") r = has && new RegExp(`^${val.split("*").map(esc).join("[\\s\\S]*")}$`, op === "ilike" ? "i" : "").test(String(v));
    else throw new Error(`filter op ${op} not emulated`);
    return neg ? !r : r;
  }
  function parse(u) {
    const q = u.indexOf("?");
    const table = decodeURIComponent((q < 0 ? u : u.slice(0, q)).split("/rest/v1/")[1]);
    const params = [];
    if (q >= 0) for (const part of u.slice(q + 1).split("&")) { const e = part.indexOf("="); params.push([decodeURIComponent(part.slice(0, e)), decodeURIComponent(part.slice(e + 1))]); }
    return { table, params };
  }
  function match(table, params) {
    return (t[table] || []).filter((row) => params.every(([k, v]) => {
      if (["select", "order", "limit", "offset", "on_conflict"].includes(k)) return true;
      if (k === "or") return splitTop(v.replace(/^\(|\)$/g, "")).some((p) => { const j = p.indexOf("."); return test(row, p.slice(0, j), p.slice(j + 1)); });
      return test(row, k, v);
    }));
  }
  async function fetch(u0, o = {}) {
    const u = String(u0);
    const method = (o.method || "GET").toUpperCase();
    const prefer = String((o.headers || {}).Prefer || "");
    if (u.includes("/storage/v1/")) { storage.push({ method, u, body: o.body && typeof o.body === "string" ? JSON.parse(o.body) : null }); return res(200, {}); }
    if (!u.includes("/rest/v1/")) { network.push({ method, u }); throw new Error(`network call refused in tests: ${u.slice(0, 80)}`); }
    const { table, params } = parse(u);
    const body = o.body ? JSON.parse(o.body) : null;
    log.push({ method, table, params, body });
    if (!t[table]) t[table] = [];
    if (method === "GET") {
      let rows = match(table, params);
      const ord = params.find(([k]) => k === "order");
      if (ord) for (const spec of ord[1].split(",").reverse()) { const [c, dir] = spec.split("."); rows = [...rows].sort((a, b) => (dir === "desc" ? -1 : 1) * cmp(a[c] ?? "", b[c] ?? "")); }
      const off = Number((params.find(([k]) => k === "offset") || [0, 0])[1]);
      const lim = params.find(([k]) => k === "limit");
      rows = rows.slice(off, lim ? off + Number(lim[1]) : undefined);
      return res(200, rows.map((r) => ({ ...r })));
    }
    if (method === "POST") {
      const items = Array.isArray(body) ? body : [body];
      const out = [];
      for (const it of items) {
        if (table === "wa_inbound_seen" && t[table].some((r) => r.wamid === it.wamid)) continue;
        const conflict = params.find(([k]) => k === "on_conflict");
        if (conflict) { const key = conflict[1]; const ex = t[table].find((r) => r[key] === it[key]); if (ex) { Object.assign(ex, it); out.push({ ...ex }); continue; } }
        const row = { id: it.id ?? nextId++, created_at: it.created_at || new Date(T.now).toISOString(), ...it };
        t[table].push(row);
        out.push({ ...row });
      }
      return res(201, prefer.includes("return=representation") ? out : []);
    }
    if (method === "PATCH") {
      const rows = match(table, params);
      for (const r of rows) Object.assign(r, body);
      return res(200, prefer.includes("return=representation") ? rows.map((r) => ({ ...r })) : []);
    }
    if (method === "DELETE") {
      const rows = match(table, params);
      t[table] = t[table].filter((r) => !rows.includes(r));
      return res(200, prefer.includes("return=representation") ? rows.map((r) => ({ ...r })) : []);
    }
    throw new Error(`method ${method}`);
  }
  return { t, log, network, storage, fetch, writes: (table) => log.filter((x) => x.table === table && x.method !== "GET") };
}

// ---------------------------------------------------------------------------
// The relay block, lifted with the real helpers it calls.
// ---------------------------------------------------------------------------
const relayBlock = between(botSrc, "// ---- relay (start) ----", "// ---- relay (end) ----");
const v215 = between(botSrc, "// ---- v215 released slots: pure helpers (start) ----", "// ---- v215 released slots: pure helpers (end) ----");
const replies = between(botSrc, "// ---- v219 studio replies: pure helpers (start) ----", "// ---- v219 studio replies: pure helpers (end) ----");
const words = between(botSrc, "// ---- v219 (19 Nov 2026, #126): studio words: pure helpers (start)", "// ---- v219: studio words: pure helpers (end)");
const JORDAN = "34612474827";
const APP_SECRET = "app-secret-for-tests-only";
const OPS = "ops-key-for-tests-only";
const hubSig = (raw) => "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
function relayWorld(o = {}) {
  T.now = o.now || M(15, 0);
  const now = T.now;
  const seed = {
    partners: [
      { id: "p-test", business_name: "Estudio Prueba Norte", status: "active", opted_out_at: null, opening_hours: null, whatsapp: "34911000101", phone: "", created_at: iso(now - 90 * 86400e3) },
      { id: "p-real", business_name: "Estudio Sol", status: "listed", opted_out_at: null, opening_hours: null, whatsapp: "34911000202", phone: "", created_at: iso(now - 90 * 86400e3) },
    ],
    whatsapp_requests: [
      // a test request (the canary's fake number), asked of both studios
      { id: 9301, first_name: "Lucia", last_name: "Prueba", client_phone: "+34600000301", contact_email: "lucia@correo.invalid", day1: "Thursday 26 Nov, 18:00", time1: "18:00", proposed_time: "18:00", message_text: "Quiere: Relaxing massage", created_at: iso(now - 3 * 3600e3), stage: "studio_asked", stage_updated_at: iso(now - 3 * 3600e3), partner_id: null, confirmed_time: null, confirmed_start: null, therapist_gender: o.gender || null, languages: "en", service_name: "Relaxing massage", customer_flag: null },
      // a real customer with an emailed offer waiting
      { id: 9302, first_name: "Tomas", last_name: "Ejemplo", client_phone: "+34699000302", contact_email: "tomas@correo.invalid", day1: "Friday 27 Nov, 19:00", time1: "19:00", proposed_time: "19:00", message_text: "Quiere: Deep tissue massage", created_at: iso(now - 20 * 3600e3), stage: "offered", stage_updated_at: iso(now - 2 * 3600e3), partner_id: null, confirmed_time: null, confirmed_start: null, therapist_gender: null, languages: "en", service_name: "Deep tissue massage", customer_flag: null },
      // a friend tester's request: never listed, never written
      { id: 9304, first_name: "Amiga", last_name: "", client_phone: "+17867276503", contact_email: "", day1: "Thursday 26 Nov, 12:00", time1: "12:00", proposed_time: "12:00", message_text: "", created_at: iso(now - 3600e3), stage: "studio_asked", stage_updated_at: iso(now - 3600e3), partner_id: null, therapist_gender: null, languages: "en", service_name: "Massage", customer_flag: null },
    ],
    request_dispatch: [
      { id: "d0000000-0000-4000-8000-000000000101", request_id: 9301, partner_id: "p-test", phone: "34911000101", sent_at: iso(now - 2 * 3600e3), created_at: iso(now - 2 * 3600e3), replied_at: null, outcome: "pending", offered_time: null, chased_at: null, quoted_price: null, discount_pct: null, accepted_at: null, customer_offered_at: null, customer_answer: null, customer_offer_via: null, channel: null },
      { id: "d0000000-0000-4000-8000-000000000202", request_id: 9301, partner_id: "p-real", phone: "34911000202", sent_at: iso(now - 2 * 3600e3), created_at: iso(now - 2 * 3600e3), replied_at: null, outcome: "pending", offered_time: null, chased_at: null, quoted_price: null, discount_pct: null, accepted_at: null, customer_offered_at: null, customer_answer: null, customer_offer_via: null, channel: null },
      { id: "d0000000-0000-4000-8000-000000000302", request_id: 9302, partner_id: "p-real", phone: "34911000202", sent_at: iso(now - 4 * 3600e3), created_at: iso(now - 4 * 3600e3), replied_at: iso(now - 3 * 3600e3), outcome: "accepted", offered_time: "19:00", chased_at: null, quoted_price: 60, discount_pct: null, accepted_at: iso(now - 3 * 3600e3), customer_offered_at: iso(now - 2 * 3600e3), customer_offered_time: "19:00", customer_offer_via: "email", offer_slot_at: iso(M(19, 0, 3)), customer_answer: null, channel: null },
      { id: "d0000000-0000-4000-8000-000000000404", request_id: 9304, partner_id: "p-real", phone: "34911000202", sent_at: iso(now - 3600e3), created_at: iso(now - 3600e3), replied_at: null, outcome: "pending", offered_time: null, customer_offered_at: null, customer_answer: null },
    ],
    app_secrets: [{ key: "META_APP_SECRET", value: APP_SECRET }],
  };
  if (o.hookKey) seed.app_secrets.push({ key: "RELAY_HOOK_KEY", value: o.hookKey });
  if (o.testStatus) seed.partners[0].status = o.testStatus;
  const db = makeDb(seed);
  const sent = [];
  const spies = { acceptOffer: 0, awardRequest: 0, ensureBooking: 0, awardWinner: 0, forwardOffer: 0, sendTemplate: 0, tellStudio: 0, studioNoteSure: 0, emailOffer: 0, withdraw: [], forwardArgs: [] };
  const outRow = (to, body, type) => db.t.wa_messages.push({ id: 90000 + db.t.wa_messages.length, phone: digitsOf(to), direction: "out", msg_type: type, body: String(body).slice(0, 2000), reply_id: null, created_at: iso(T.now) });
  const turn = { raw: o.raw ?? '{"object":"whatsapp_business_account"}', hubSig: "", relayKey: o.relayKey || "" };
  turn.hubSig = o.badSig ? "sha256=" + "0".repeat(64) : hubSig(turn.raw);
  const env = {
    Date: FakeDate, SUPABASE_URL: "https://db.invalid", OPS_KEY: OPS, H: () => ({}), fetch: db.fetch,
    Deno: { env: { get: () => undefined } }, TURN: { getStore: () => turn },
    setTimeout: (f) => { f(); return 0; }, XLANG: new Map(),
    digitsOf, ...C, stopIntent: K.stopIntent, letterBajaIntent: LR.letterBajaIntent, BAJA_ONLY_RE: LR.BAJA_ONLY_RE,
    parseRelayMode: R.parseRelayMode, JORDAN_OWN: R.JORDAN_OWN, detectRelay: R.detectRelay, relayBase: R.relayBase, relayParse: R.relayParse, relayRank: R.relayRank, relayRowText: R.relayRowText, relayListBody: R.relayListBody,
    studioRelayPlan: R.studioRelayPlan, studioActions: R.studioActions, studioWrites: R.studioWrites, customerRelayPlan: R.customerRelayPlan, customerActions: R.customerActions, customerWrites: R.customerWrites,
    relayStoredText: R.relayStoredText, relayRelativeWords: R.relayRelativeWords, relayHoursShown: R.relayHoursShown, relayNeedsEnglish: R.relayNeedsEnglish, relayReadText: R.relayReadText, relayActionWords: R.relayActionWords, RELAY_LABELS: R.RELAY_LABELS, OUR_LINE_RE: R.OUR_LINE_RE, STUDIO_FOLLOWS: R.STUDIO_FOLLOWS, RELAY_MAX_CANDS: R.RELAY_MAX_CANDS,
    relayYesSend: R.relayYesSend, relayYesWords: R.relayYesWords, relayYesDone: R.relayYesDone,
    offerTplAudience: OT.offerTplAudience, offerTplMode: async () => o.tplMode || "off",
    appSecret: async (k) => String((db.t.app_secrets.find((x) => x.key === k) || {}).value || ""),
    aiText: async (_sys, text) => `EN[${text}]`,
    sendText: async (to, body) => { sent.push({ to: digitsOf(to), kind: "text", body }); outRow(to, body, "text"); return true; },
    sendButtons: async (to, body, buttons) => { sent.push({ to: digitsOf(to), kind: "buttons", body, buttons }); outRow(to, body + " [" + buttons.map((b) => b.title).join("/") + "]", "buttons"); return true; },
    sendList: async (to, body, button, rows) => { sent.push({ to: digitsOf(to), kind: "list", body, button, rows }); outRow(to, body + " [" + rows.map((r) => r.title).join("/") + "]", "list"); return true; },
    logEvent: async (phone, event, meta) => { db.t.funnel_events.push({ id: db.t.funnel_events.length + 1, phone: digitsOf(phone), event, meta, created_at: iso(T.now) }); },
    partnerCard: async (id) => ({ business_name: String((db.t.partners.find((p) => p.id === id) || {}).business_name || ""), address: "", phone: "", neighbourhood: "" }),
    mktRecordWithdraw: async (...a) => { spies.withdraw.push(a); return { why: "", unread: false, emails: [] }; },
    mktNotSavedCard: async () => {}, lastRequestFor: async () => null,
    acceptOffer: async () => { spies.acceptOffer++; return true; }, awardRequest: async () => { spies.awardRequest++; }, ensureBooking: async () => { spies.ensureBooking++; return "tok"; },
    awardWinner: async () => { spies.awardWinner++; return true; }, forwardOffer: async (...a) => { spies.forwardOffer++; spies.forwardArgs.push(a); return o.forward ? o.forward(a, db) : "email"; }, sendTemplate: async () => { spies.sendTemplate++; return true; },
    tellStudio: async () => { spies.tellStudio++; return true; }, studioNoteSure: async () => { spies.studioNoteSure++; return "sent"; }, emailOffer: async () => { spies.emailOffer++; return true; },
    madridMidnight: O.madridMidnight, resolveRequestDate: O.resolveRequestDate, madridInstant: O.madridInstant,
    OPEN_STAGES: ["new", "dispatching", "studio_asked", "studio_replied", "offered", "bidding"], OFFER_ROW_CLOSED: ["expired", "declined", "stood_down", "lost", "no"],
    TEST_PHONES: ["15622355063", "17867276503", "34612474827", "34635569364", "8615273855997", "34662680781"],
    TEST_EMAIL_RE: /@(example|test|testing)\.com$|placeholder\.local$/i, TEST_NAME_RE: /\b(test|prueba|uitest|mctest)\b/i, FAKE_NUM_RE: /(^|\D)34600000\d{3}(\D|$)/,
    heldNum: () => false, heldMail: () => false,
    ...P,
  };
  const parts = [relayBlock, v215, replies, words, one("LONG_ES"), one("LONG_EN"), one("SHORT_EN"), one("madridTime"), one("noDashes"), one("CUSTOMER_WINDOW_MS"), one("REPLY_BASE"), one("DECLINE_RE"),
    lift(botSrc, "async function logMsg("), lift(botSrc, "async function sentRecently("), lift(botSrc, "async function getSession("), lift(botSrc, "async function saveSession("), lift(botSrc, "async function findPartnerByNumber("),
    lift(botSrc, "async function waWindowOpen("), lift(botSrc, "function exactTime("), lift(botSrc, "function studioDate("), lift(botSrc, "function parseDiscount("), lift(botSrc, "async function replySig("), lift(botSrc, "async function replyUrl("),
    lift(botSrc, "async function reopenOfferClaim("), lift(botSrc, "function offerTestCustomer("), lift(botSrc, "function dispatchHours("), lift(botSrc, "function socHoursWritable(")];
  const { fns, calls } = sandbox(parts.filter(Boolean), env, ["relayTurn", "relayMode", "relayVerified", "relayWords", "relayCandidates"]);
  // A forward as the webhook runs it: logged first (logMsg hands back the
  // row's id, review M1), then the relay's turn for that same row.
  let nextRow = 7000;
  const logRow = (body) => { const id = nextRow++; db.t.wa_messages.push({ id, phone: JORDAN, direction: "in", msg_type: "relayed", body, reply_id: null, created_at: iso(T.now) }); return id; };
  const turnFor = (rowId, text, type = "text", extra = {}) => fns.relayTurn({ from: JORDAN, msg: { type, context: { forwarded: true }, ...(extra.msg || {}) }, text, replyId: "", voice: extra.voice || null, relayIn: true, mode: extra.mode || o.mode || "test", rowId });
  const forward = async (text, extra = {}) => {
    const body = extra.voice ? `[voice note ${JORDAN}/1700000000000.ogg] ${text}` : text;
    const rowId = logRow(body);
    if (extra.onlyLog) return rowId;
    return turnFor(rowId, text, extra.voice ? "audio" : "text", { mode: extra.mode, voice: extra.voice ? { path: `${JORDAN}/1700000000000.ogg`, transcript: text } : null });
  };
  const tap = (replyId, mode = o.mode || "test", msg = { type: "interactive" }) => fns.relayTurn({ from: JORDAN, msg, text: "", replyId, voice: null, relayIn: false, mode });
  const type = (text, mode = o.mode || "test", msg = { type: "text" }) => fns.relayTurn({ from: JORDAN, msg, text, replyId: "", voice: null, relayIn: false, mode });
  return { db, sent, spies, env, fns, calls, forward, tap, type, turn, logRow, turnFor };
}
const lastTo = (w, to) => [...w.sent].reverse().find((s) => s.to === to);
// A card over 1000 characters goes as its text, then "What should I record?"
// with the buttons: read the two as one card.
const lastCard = (w) => {
  const toJ = w.sent.filter((s) => s.to === JORDAN);
  const last = toJ[toJ.length - 1];
  if (last?.kind === "buttons" && last.body === "What should I record?" && toJ.length > 1) return { kind: "buttons", body: toJ[toJ.length - 2].body, buttons: last.buttons, split: true };
  return last;
};
const toOthers = (w) => w.sent.filter((s) => s.to !== JORDAN);

// ---------------------------------------------------------------------------
// 1. Spotting a forward, and RELAY off changing nothing.
// ---------------------------------------------------------------------------
{
  const G = "1 detect and switch";
  const d = (msg, from) => R.detectRelay(msg, from).relay;
  check(G, "forwarded from 827", d({ context: { forwarded: true } }, JORDAN), true);
  check(G, "frequently_forwarded from the US number", d({ context: { frequently_forwarded: true } }, "+1 562 235 5063"), true);
  check(G, "a quoted reply (context.id only) is not a relay", d({ context: { id: "wamid.x", from: JORDAN } }, JORDAN), false);
  check(G, "a forward from anyone else is not a relay", [d({ context: { forwarded: true } }, "34699000302"), R.detectRelay({ context: { forwarded: true } }, "34699000302").forwarded], [false, true]);
  check(G, "no context", d({ type: "text" }, JORDAN), false);
  check(G, "parseRelayMode", ["on", " TEST ", "", null, "yes", "off"].map(R.parseRelayMode), ["on", "test", "off", "off", "off", "off"]);
  check(G, "JORDAN_OWN is the bot's own list for his numbers", R.JORDAN_OWN, ["34612474827", "15622355063"]);
  // relayTurn with the switch off: false, and no read at all.
  const w = relayWorld();
  const before = w.db.log.length;
  const out = await w.fns.relayTurn({ from: JORDAN, msg: { type: "text", context: { forwarded: true } }, text: "Sí", replyId: "", voice: null, relayIn: true, mode: "off" });
  check(G, "RELAY off: relayTurn says no and reads nothing", [out, w.db.log.length - before, w.sent.length], [false, 0, 0]);
  // The switch is read once a minute, and a failed read keeps what was read.
  const w2 = relayWorld();
  w2.db.t.app_secrets.push({ key: "RELAY", value: "test" });
  const m1 = await w2.fns.relayMode(), m2 = await w2.fns.relayMode();
  const reads = w2.db.log.filter((x) => x.table === "app_secrets").length;
  check(G, "RELAY read once and cached", [m1, m2, reads], ["test", "test", 1]);
  const realFetch = w2.env.fetch;
  w2.env.fetch = async (u, o) => (String(u).includes("app_secrets") ? res(500, "down") : realFetch(u, o));
  T.now += 61e3;
  check(G, "a failed read keeps the last value (a forward never becomes a test booking)", await w2.fns.relayMode(), "test");
  w2.env.fetch = realFetch;
  // Not a forward, not a tap, no "Someone else" open: the normal flow.
  const w3 = relayWorld();
  const normal = await w3.type("page");
  check(G, "Jordan's own 'page' with RELAY on: not the relay's", [normal, w3.sent.length, w3.db.writes("wa_messages").length], [false, 0, 0]);
}

// ---------------------------------------------------------------------------
// 2. The hook in the webhook, as the live handler runs it.
// ---------------------------------------------------------------------------
{
  const G = "2 webhook hook";
  const seg = between(botSrc, "    const relayFwd = detectRelay(msg, from);", "    // v216: the message the /socios page prefills");
  check(G, "hook found between the parse and /socios", !!seg && seg.includes("await relayTurn({") && seg.indexOf("await logMsg(from") < seg.indexOf("await relayTurn({"), true);
  const run = async (o) => {
    const log = { logged: [], modeReads: 0, turns: [], said: [] };
    const env = {
      detectRelay: R.detectRelay, digitsOf, Response,
      relayMode: async () => { log.modeReads++; return o.mode; },
      logMsg: async (phone, dir, body, type, reply, wantId) => { log.logged.push({ phone, dir, body, type, reply, wantId: !!wantId }); return wantId ? 4242 : null; },
      relayTurn: async (x) => { log.turns.push(x); if (o.throws) throw new Error("boom"); return o.turnSays ?? (x.relayIn || /^rly_/.test(x.replyId)); },
      sendText: async (to, t) => { log.said.push([to, t]); return true; },
    };
    const code = `async function hook(msg, from, text, replyId, voice) { let btnText = "", loc = null; const ref = null; const reactionEmoji = "";\n${seg}\nreturn "continued"; }`;
    const { fns } = sandbox([code], env, ["hook"]);
    const out = await fns.hook(o.msg, o.from, o.text, o.replyId || "", null);
    return { out: typeof out === "string" ? out : "answered", log };
  };
  const fwd = { type: "text", text: { body: "Sí, a las 18:00" }, context: { forwarded: true } };
  const off = await run({ mode: "off", msg: fwd, from: JORDAN, text: "Sí, a las 18:00" });
  check(G, "RELAY off, a forward from 827: logged as text, the relay never runs, the flow carries on", [off.out, off.log.logged[0]?.type, off.log.turns.length, off.log.modeReads], ["continued", "text", 0, 1], "today's behaviour: his test-customer flow reads it");
  const on = await run({ mode: "on", msg: fwd, from: JORDAN, text: "Sí, a las 18:00" });
  check(G, "RELAY on, a forward from 827: logged as relayed and handled by the relay", [on.out, on.log.logged[0]?.type, on.log.turns[0]?.relayIn, on.log.logged[0]?.reply], ["answered", "relayed", true, ""]);
  check(G, "review M1: the relayed row's own id comes back from logMsg and goes to relayTurn; other rows are logged as before", [on.log.logged[0]?.wantId, on.log.turns[0]?.rowId, off.log.logged[0]?.wantId], [true, 4242, false]);
  // Review m6: a tap on an old relay list or card with RELAY off.
  const oldTap = await run({ mode: "off", msg: { type: "interactive" }, from: JORDAN, text: "", replyId: "rly_i_7001_0123456789abcdef" });
  check(G, "review m6: RELAY off, an old rly_ tap from Jordan is swallowed with one line, never his test flow", [oldTap.out, oldTap.log.turns.length, oldTap.log.said.length, /relay is switched off/.test(oldTap.log.said[0]?.[1] || "")], ["answered", 0, 1, true]);
  const custTap = await run({ mode: "off", msg: { type: "interactive" }, from: "34699000302", text: "", replyId: "rly_i_7001_0123456789abcdef" });
  check(G, "an rly_ id from anyone else: the normal flow (it is not Jordan's)", [custTap.out, custTap.log.said.length], ["continued", 0]);
  const other = await run({ mode: "on", msg: fwd, from: "34699000302", text: "Sí, a las 18:00" });
  check(G, "a forwarded message from a customer's number: the normal customer flow", [other.out, other.log.logged[0]?.type, other.log.turns.length, other.log.modeReads], ["continued", "text", 0, 0], "the switch is not even read");
  const quoted = await run({ mode: "on", msg: { type: "text", context: { id: "wamid.q" } }, from: JORDAN, text: "page", turnSays: false });
  check(G, "a quoted reply from Jordan with RELAY on: not relayed, the flow carries on", [quoted.out, quoted.log.logged[0]?.type, quoted.log.turns[0]?.relayIn], ["continued", "text", false]);
  const boom = await run({ mode: "on", msg: fwd, from: JORDAN, text: "Sí", throws: true });
  check(G, "a relay error on a forward fails closed (never his test booking)", [boom.out, boom.log.said.length, /nothing was saved/i.test(boom.log.said[0]?.[1] || "")], ["answered", 1, true]);
  const img = await run({ mode: "on", msg: { type: "image", image: { id: "m1" }, context: { forwarded: true } }, from: JORDAN, text: "" });
  check(G, "a forwarded image is logged as [image], relayed", [img.log.logged[0]?.body, img.log.logged[0]?.type], ["[image]", "relayed"]);
  check(G, "the relay runs before /socios and the letters' BAJA", [botSrc.indexOf("await relayTurn({") < botSrc.indexOf("if (text && SOCIOS_FALLBACK_RE.test(text))"), botSrc.indexOf("await relayTurn({") < botSrc.indexOf("await handleLetterReply(from, text)")], [true, true]);
  check(G, "the switch is read only for Jordan's numbers", /const rMode: RelayMode = relayFwd\.jordan \? await relayMode\(\) : "off";/.test(botSrc), true);
  check(G, "the turn keeps the body and the two proof headers", /st\.raw = raw; st\.hubSig = req\.headers\.get\("x-hub-signature-256"\)/.test(botSrc), true);
}

// ---------------------------------------------------------------------------
// 3. RELAY test: forward, who wrote this, pick, external copy, record.
// ---------------------------------------------------------------------------
const TEST_ROW = "d0000000-0000-4000-8000-000000000101";
const REAL_ROW = "d0000000-0000-4000-8000-000000000202";
{
  const G = "3 studio yes";
  const w = relayWorld({ mode: "test" });
  await w.forward("Sí, a las 18:00, 45€");
  const list = lastTo(w, JORDAN);
  check(G, "a list goes to Jordan, and only to him", [list?.kind, toOthers(w).length], ["list", 0]);
  const rows = list?.rows || [];
  check(G, "list shape: at most 10 rows, titles 24, descriptions 72, the three fixed rows last", [rows.length <= 10, rows.every((r) => r.title.length <= 24 && (r.description || "").length <= 72), rows.slice(-3).map((r) => r.title)], [true, true, ["Someone else", "Me (my own words)", "Ignore"]]);
  check(G, "the test studio is listed and marked (test); the friend tester's request is not", [rows.some((r) => r.title === "Estudio Prueba (studio)" || r.title.startsWith("Estudio Prueba")), rows.some((r) => /\(test\)/.test(r.description || "")), rows.some((r) => /#9304/.test(r.description || ""))], [true, true, false]);
  check(G, "the list says who it is from by the last 4 digits", rows.some((r) => /\.\.\.0101/.test(r.description || "")), true, "so Jordan can match it to his chat header");
  check(G, "the list quotes the words, with English, and promises nothing goes out", [list?.body.includes('"Sí, a las 18:00, 45€"'), /\(EN: "EN\[/.test(list?.body || ""), /Picking sends nothing to anyone\./.test(list?.body || ""), /TEST MODE/.test(list?.body || "")], [true, true, true, true]);
  const relayed = w.db.t.wa_messages.filter((m) => m.msg_type === "relayed");
  check(G, "the forward is frozen as listed", relayed.map((m) => m.reply_id), [`rly:${relayed[0].id}:listed`]);
  check(G, "the top row is the studio whose ask matches the hour", rows[0]?.title.startsWith("Estudio "), true);
  // Pick the test studio.
  const pick = rows.find((r) => r.title.startsWith("Estudio Prueba"));
  await w.tap(pick.id);
  const ext = w.db.t.wa_messages.filter((m) => m.msg_type === "external");
  check(G, "the words are saved in the studio's chat as external, unchanged", ext.map((m) => [m.phone, m.direction, m.body, m.reply_id]), [["34911000101", "in", "Sí, a las 18:00, 45€", `rly:${relayed[0].id}`]]);
  const card = lastCard(w);
  if (process.env.RELAY_SHOW) console.log(`\n--- list ---\n${list.body}\n${rows.map((r) => `  [${r.title}] ${r.description}`).join("\n")}\n--- studio card ---\n${card.body}\n  buttons: ${card.buttons.map((b) => b.title).join(" / ")}\n`);
  check(G, "the card: what was read, in English, and the buttons", [card?.kind, /I read: yes at the hour asked, 18:00; price 45 EUR\./.test(card?.body || ""), /\(EN: "EN\[/.test(card?.body || ""), (card?.buttons || []).map((b) => b.title)], ["buttons", true, true, ["Record yes", "Not theirs"]]);
  check(G, "the card says nothing is sent, and why Record yes sends nothing here (a test contact)", [/Nothing is sent to the studio or the customer from here/.test(card?.body || ""), /Record yes records their yes at 18:00, with the price 45 EUR, on their ask\. It counts as Estudio Prueba Norte's tap \(your rule of 24 Nov\), but Lucia is a test contact, and the relay never sends a test contact anything: the yes is only recorded\./.test(card?.body || "")], [true, true]);
  check(G, "no message to the studio or the customer, no write to the ask yet", [toOthers(w).length, w.db.writes("request_dispatch").length], [0, 0]);
  // Record yes.
  const yes = card.buttons.find((b) => b.title === "Record yes");
  await w.tap(yes.id);
  const row = w.db.t.request_dispatch.find((d) => d.id === TEST_ROW);
  check(G, "after one tap: accepted at 18:00 with 45, answered", [row.outcome, row.offered_time, row.quoted_price, !!row.replied_at, String(row.reply_text).startsWith("[reenviado por Jordan, jueves 26 de noviembre] ")], ["accepted", "18:00", 45, true, true]);
  check(G, "Jordan is told what was recorded, and that the test contact got nothing; still nothing to anyone else", [/^Recorded for Estudio Prueba Norte on #9301: their yes at 18:00, with the price 45 EUR, on their ask\. Nothing was sent to Lucia or to Estudio Prueba Norte: the relay never sends a test anything\./.test(lastTo(w, JORDAN)?.body || ""), toOthers(w).length], [true, 0]);
  check(G, "nothing books, awards, forwards, templates or tells the studio", [w.spies.acceptOffer, w.spies.awardRequest, w.spies.ensureBooking, w.spies.awardWinner, w.spies.forwardOffer, w.spies.sendTemplate, w.spies.tellStudio, w.spies.studioNoteSure, w.spies.emailOffer], [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  check(G, "no network call", w.db.network.length, 0);
  // A second tap on the same button does nothing.
  const writes = w.db.writes("request_dispatch").length;
  await w.tap(yes.id);
  check(G, "a double tap: one write, 'Already done.'", [w.db.writes("request_dispatch").length, lastTo(w, JORDAN)?.body], [writes, "Already done."]);
  // A forged or edited id is ignored.
  const forged = yes.id.replace(/_[0-9a-f]{16}$/, "_" + "a".repeat(16));
  const n0 = w.sent.length;
  await w.tap(forged);
  check(G, "a forged id: ignored, nothing said or written", [w.sent.length - n0, w.db.writes("request_dispatch").length], [0, writes]);
  const edited = yes.id.replace("rly_a_yes_", "rly_a_no_");
  await w.tap(edited);
  check(G, "an edited action: the signature fails, nothing changes", [w.db.t.request_dispatch.find((d) => d.id === TEST_ROW).outcome, w.db.writes("request_dispatch").length], ["accepted", writes]);
  // A0: the external row never opens the studio's window.
  const open = await (async () => { const s = sandbox([lift(botSrc, "async function waWindowOpen("), one("CUSTOMER_WINDOW_MS")], { fetch: w.db.fetch, SUPABASE_URL: "https://db.invalid", H: () => ({}), digitsOf, Date: FakeDate }, ["waWindowOpen"]); return s.fns.waWindowOpen("34911000101"); })();
  check(G, "A0: the relayed copy does not open the studio's 24 hours", open, false);
}

// ---------------------------------------------------------------------------
// 4. Test mode with a real person, the burst, voice, Ignore, Someone else.
// ---------------------------------------------------------------------------
{
  const G = "4 test mode and the rest";
  const w = relayWorld({ mode: "test" });
  await w.forward("No podemos, lo siento");
  const rows = lastTo(w, JORDAN).rows;
  const real = rows.find((r) => r.title.startsWith("Estudio Sol"));
  check(G, "a real studio is listed in test mode (unmarked)", [!!real, /\(test\)/.test(real?.description || "")], [true, false]);
  await w.tap(real.id);
  const card = lastTo(w, JORDAN);
  check(G, "a real studio in test mode: the TEST MODE card, no buttons, nothing saved", [card.kind, card.body.startsWith("TEST MODE: nothing recorded or sent."), /Record no would record their no/.test(card.body), w.db.t.wa_messages.filter((m) => m.msg_type === "external").length, w.db.writes("request_dispatch").length], ["text", true, true, 0, 0]);
  check(G, "the forward is marked testmode", w.db.t.wa_messages.find((m) => m.msg_type === "relayed").reply_id.endsWith(":testmode"), true);

  // A burst of two: one list, for both.
  const b = relayWorld({ mode: "test" });
  const holaRow = await b.forward("Hola", { onlyLog: true });
  await b.forward("a las 18:00 sí");
  await b.turnFor(holaRow, "Hola");
  const lists = b.sent.filter((s) => s.kind === "list");
  check(G, "two forwards in a burst: one list for both", [lists.length, /Who wrote these 2 messages\?/.test(lists[0]?.body || "")], [1, true]);

  // A voice note: no yes, time or price is recorded from it.
  const v = relayWorld({ mode: "test" });
  await v.forward("Sí, a las 18:00, 45 euros", { voice: true });
  await v.tap(lastTo(v, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba")).id);
  const vc = lastTo(v, JORDAN);
  check(G, "a voice note: read, but only 'Mark answered' is offered", [(vc.buttons || []).map((x) => x.title), /A voice note is not their writing/.test(vc.body)], [["Mark answered", "Not theirs"], true]);
  check(G, "the voice file is copied into the studio's folder", [v.db.storage.some((s) => s.u.endsWith("/object/copy") && s.body?.sourceKey === `${JORDAN}/1700000000000.ogg` && String(s.body?.destinationKey).startsWith("34911000101/")), /^\[voice note 34911000101\/\d+\.ogg\] Sí, a las 18:00, 45 euros$/.test(v.db.t.wa_messages.find((m) => m.msg_type === "external")?.body || "")], [true, true]);
  await v.tap(vc.buttons[0].id);
  const vr = v.db.t.request_dispatch.find((d) => d.id === TEST_ROW);
  check(G, "Mark answered: replied_at only, the ask stays pending", [vr.outcome, !!vr.replied_at, vr.offered_time, vr.quoted_price], ["pending", true, null, null]);

  // Ignore: the text is blanked, and so is the list's copy of it.
  const ig = relayWorld({ mode: "test" });
  await ig.forward("Esto es de una amiga");
  await ig.tap(lastTo(ig, JORDAN).rows.find((r) => r.title === "Ignore").id);
  check(G, "Ignore: forgotten and deleted", [ig.db.t.wa_messages.find((m) => m.msg_type === "relayed").body, ig.db.t.wa_messages.find((m) => m.msg_type === "list").body.startsWith("[relay list R"), lastTo(ig, JORDAN).body], ["[relay ignored]", true, "Forgotten. The text is deleted."]);

  // Someone else: an unknown number saves nothing; a studio's number goes to its ask.
  const se = relayWorld({ mode: "test" });
  await se.forward("¿Tenéis hueco el sábado?");
  await se.tap(lastTo(se, JORDAN).rows.find((r) => r.title === "Someone else").id);
  check(G, "Someone else: asks for the contact or number", lastTo(se, JORDAN).body, "Send me their contact card, or type their number.");
  await se.type("+34 699 111 222");
  check(G, "an unknown number: nothing saved, the text deleted (data minimisation)", [lastTo(se, JORDAN).body, se.db.t.wa_messages.find((m) => m.msg_type === "relayed").body, se.db.t.wa_messages.filter((m) => m.msg_type === "external").length], ["No studio or open request matches +34699111222, so nothing was saved and the text is deleted.", "[relay ignored]", 0]);
  const se2 = relayWorld({ mode: "test" });
  await se2.forward("Sí, a las 18:00");
  await se2.tap(lastTo(se2, JORDAN).rows.find((r) => r.title === "Someone else").id);
  await se2.type("x", "test", { type: "contacts", contacts: [{ name: { formatted_name: "Estudio" }, phones: [{ phone: "+34 911 00 01 01", wa_id: "34911000101" }] }] });
  check(G, "a contact card that is a studio's number: that studio's card, marked as checked", [/number checked from your contact card/.test(lastCard(se2).body || ""), se2.db.t.wa_messages.filter((m) => m.msg_type === "external").map((m) => m.phone)], [true, ["34911000101"]]);
  const se3 = relayWorld({ mode: "test" });
  await se3.forward("hola");
  await se3.tap(lastTo(se3, JORDAN).rows.find((r) => r.title === "Someone else").id);
  await se3.type("+1 786 727 6503");
  check(G, "a friend tester's number: never saved", [/test or friend number/.test(lastTo(se3, JORDAN).body), se3.db.t.wa_messages.filter((m) => m.msg_type === "external").length], [true, 0]);
  const se4 = relayWorld({ mode: "test" });
  await se4.forward("hola");
  await se4.tap(lastTo(se4, JORDAN).rows.find((r) => r.title === "Someone else").id);
  const back = await se4.type("I am testing a booking");
  check(G, "any other text after Someone else: the question is dropped and his message runs as before", [back, se4.db.t.wa_messages.find((m) => m.msg_type === "relayed").reply_id.endsWith(":listed")], [false, true]);

  // An old forward: too old.
  const old = relayWorld({ mode: "test" });
  await old.forward("Sí");
  const oldRows = lastTo(old, JORDAN).rows;
  T.now += 3 * 3600e3;
  await old.tap(oldRows[0].id);
  check(G, "a pick on a forward over 2 hours old: nothing written", [lastTo(old, JORDAN).body, old.db.t.wa_messages.filter((m) => m.msg_type === "external").length], ["Too old, forward it again.", 0]);

  // Unverified: nothing is listed, Jordan is told once.
  const un = relayWorld({ mode: "test", badSig: true });
  await un.forward("Sí");
  check(G, "a request that is not proven to come from Meta: nothing listed", [un.sent.filter((s) => s.kind === "list").length, /could not check that it came from WhatsApp/.test(lastTo(un, JORDAN)?.body || "")], [0, true]);

  // Our own webhook relay's key works in place of Meta's signature; a short key never does.
  const hk = relayWorld({ mode: "test", badSig: true, hookKey: "k".repeat(32), relayKey: "k".repeat(32) });
  await hk.forward("Sí");
  check(G, "the webhook relay's own key (RELAY_HOOK_KEY, 24+ characters) proves it", hk.sent.filter((s) => s.kind === "list").length, 1);
  const hs = relayWorld({ mode: "test", badSig: true, hookKey: "short", relayKey: "short" });
  await hs.forward("Sí");
  check(G, "a short hook key proves nothing", hs.sent.filter((s) => s.kind === "list").length, 0);

  // Opening hours, written only in the form dispatch-studios reads.
  const hr = relayWorld({ mode: "test" });
  await hr.forward("Abrimos de lunes a sábado de 10 a 21");
  await hr.tap(lastTo(hr, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba")).id);
  const hrc = hr.sent.filter((s) => s.kind === "buttons").slice(-1)[0];
  check(G, "hours: read as hours, never as a time, and offered to save", [hr.sent.some((s) => /I read: opening hours Lun-Sab 10:00-21:00/.test(s.body)), hrc.buttons.map((b) => b.title)], [true, ["Save hours", "Mark answered", "Not theirs"]]);
  await hr.tap(hrc.buttons[0].id);
  check(G, "Save hours fills opening_hours (it was empty), the ask untouched", [hr.db.t.partners.find((p) => p.id === "p-test").opening_hours, hr.db.t.request_dispatch.find((d) => d.id === TEST_ROW).offered_time], ["Lun-Sab 10:00-21:00", null]);

  // BAJA from a studio that is not an active partner: opted out, on the tap.
  const bj = relayWorld({ mode: "test", testStatus: "listed" });
  await bj.forward("BAJA");
  await bj.tap(lastTo(bj, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba")).id);
  const bjc = lastTo(bj, JORDAN);
  check(G, "a studio's BAJA: Record opt-out", bjc.buttons.map((b) => b.title), ["Record opt-out", "Not theirs"]);
  await bj.tap(bjc.buttons[0].id);
  check(G, "Record opt-out sets opted_out_at; nothing is sent to them", [!!bj.db.t.partners.find((p) => p.id === "p-test").opted_out_at, toOthers(bj).length, /^Opted out:/.test(lastTo(bj, JORDAN).body)], [true, 0, true]);
  const bja = relayWorld({ mode: "test" });
  await bja.forward("BAJA");
  await bja.tap(lastTo(bja, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba")).id);
  check(G, "an active partner's BAJA: letters only, shown, not recorded here", [lastTo(bja, JORDAN).buttons.map((b) => b.title), lastTo(bja, JORDAN).body.includes("is an active partner, so a BAJA means letters only")], [["Not theirs"], true]);

  // An off-menu request from a customer: muted on the tap, nothing sent.
  const om = relayWorld({ mode: "on" });
  await om.forward("do you do massage with happy ending");
  await om.tap(lastTo(om, JORDAN).rows.find((r) => r.title.startsWith("Tomas")).id);
  const omc = lastTo(om, JORDAN);
  check(G, "off-menu: Mute them, and the shutdown line is not sent from here", [omc.buttons.map((b) => b.title), /The standard shutdown line is not sent from here/.test(omc.body)], [["Mute them", "Not theirs"], true]);
  await om.tap(omc.buttons[0].id);
  check(G, "Mute them: their session is muted, nothing sent", [om.db.t.wa_sessions.find((s) => s.phone === "34699000302")?.step, toOthers(om).length], ["muted", 0]);

  // Not theirs: taken back out of the chat, the list works again.
  const nt = relayWorld({ mode: "test" });
  await nt.forward("Sí, a las 18:00");
  const ntRows = lastTo(nt, JORDAN).rows;
  await nt.tap(ntRows.find((r) => r.title.startsWith("Estudio Prueba")).id);
  await nt.tap(lastTo(nt, JORDAN).buttons.find((x) => x.title === "Not theirs").id);
  check(G, "Not theirs: the copy leaves their chat and the forward is listed again", [nt.db.t.wa_messages.filter((m) => m.msg_type === "external").length, nt.db.t.wa_messages.find((m) => m.msg_type === "relayed").reply_id.endsWith(":listed"), /taken back/.test(lastTo(nt, JORDAN).body)], [0, true, true]);
}

// ---------------------------------------------------------------------------
// 5. A customer's yes never confirms anything (BOTH PARTIES TAP).
// ---------------------------------------------------------------------------
{
  const G = "5 customer yes";
  const w = relayWorld({ mode: "on" });
  await w.forward("yes");
  const rows = lastTo(w, JORDAN).rows;
  const cust = rows.find((r) => r.title.startsWith("Tomas"));
  check(G, "the customer with the offer waiting is listed, with the offer", [!!cust, /Estudio Sol 19:00 offer waiting/.test(cust?.description || "")], [true, true]);
  check(G, "on mode: test studios and test customers are not listed", rows.some((r) => /Prueba|Lucia/.test(r.title)), false);
  await w.tap(cust.id);
  const card = lastCard(w);
  if (process.env.RELAY_SHOW) console.log(`\n--- customer card ---\n${card.body}\n  buttons: ${card.buttons.map((b) => b.title).join(" / ")}\n`);
  check(G, "the card: nothing is booked, only their tap books; the only button is Not theirs", [/Nothing is booked\. Only their own tap on Yes books it\./.test(card.body), card.buttons.map((b) => b.title)], [true, ["Not theirs"]]);
  check(G, "saved in the customer's chat as external", w.db.t.wa_messages.filter((m) => m.msg_type === "external").map((m) => [m.phone, m.body]), [["34699000302", "yes"]]);
  const confirmed = w.db.writes("whatsapp_requests").filter((x) => x.body?.stage === "confirmed" || x.body?.client_confirmed_at || x.body?.reconfirmed_at);
  check(G, "no confirmation anywhere: no stage, no client_confirmed_at, no bookings row, no answer on the offer", [confirmed.length, w.db.writes("bookings").length, w.db.writes("request_dispatch").length], [0, 0, 0]);
  check(G, "nothing to the customer or the studio, and no booking path called", [toOthers(w).length, w.spies.acceptOffer, w.spies.awardRequest, w.spies.ensureBooking, w.spies.sendTemplate, w.spies.emailOffer], [0, 0, 0, 0, 0, 0]);
  check(G, "A0: the customer's window is still closed", w.db.t.wa_messages.filter((m) => m.phone === "34699000302" && m.direction === "in" && m.msg_type !== "external").length, 0);
  // A cancel freezes the request at the pick (critique major 8), sends nothing.
  const c = relayWorld({ mode: "on" });
  await c.forward("I need to cancel, sorry");
  await c.tap(lastTo(c, JORDAN).rows.find((r) => r.title.startsWith("Tomas")).id);
  const cc = lastCard(c);
  check(G, "a cancel: frozen at the pick (customer_flag change_requested), the stage untouched, nothing sent", [c.db.t.whatsapp_requests.find((r) => r.id === 9302).customer_flag, c.db.t.whatsapp_requests.find((r) => r.id === 9302).stage, toOthers(c).length, cc.body.startsWith("I froze the request at once"), /It is frozen/.test(cc.body), cc.buttons.map((b) => b.title)], ["change_requested", "offered", 0, true, true, ["Not theirs"]]);
  await c.tap(cc.buttons[0].id);
  check(G, "Not theirs unfreezes it and takes the words back", [c.db.t.whatsapp_requests.find((r) => r.id === 9302).customer_flag, c.db.t.wa_messages.filter((m) => m.msg_type === "external").length], [null, 0]);
  const ct = relayWorld({ mode: "test" });
  await ct.forward("I need to cancel, sorry");
  await ct.tap(lastTo(ct, JORDAN).rows.find((r) => r.title.startsWith("Tomas")).id);
  check(G, "test mode, a real customer: nothing frozen, the TEST MODE card says it would be", [ct.db.t.whatsapp_requests.find((r) => r.id === 9302).customer_flag, /TEST MODE/.test(lastTo(ct, JORDAN).body), /It would be frozen/.test(lastTo(ct, JORDAN).body)], [null, true, true]);
  // A STOP records the opt-out under the customer's number, with the evidence.
  const s = relayWorld({ mode: "on" });
  await s.forward("STOP");
  await s.tap(lastTo(s, JORDAN).rows.find((r) => r.title.startsWith("Tomas")).id);
  await s.tap(lastTo(s, JORDAN).buttons.find((b) => b.title === "Record opt-out").id);
  check(G, "STOP: the withdraw is recorded under their number, marked as relayed", [s.spies.withdraw.length, s.spies.withdraw[0]?.[1], /^\[relayed by Jordan from his phone, original time unknown\] STOP$/.test(s.spies.withdraw[0]?.[2] || ""), toOthers(s).length], [1, "34699000302", true, 0]);
  // Source: nothing in the relay block can book, award, offer or message anyone else.
  check(G, "the relay block calls no booking or sending path (forwardOffer aside, below)", ["acceptOffer(", "awardRequest(", "ensureBooking(", "awardWinner(", "sendTemplate(", "tellStudio(", "studioNoteSure(", "emailOffer(", "declineOffer(", "reshowOffer(", "sendOfferTemplate(", "sendHeldOfferEmail(", "showNextOffer(", "studioSay("].filter((f) => relayBlock.includes(f)), []);
  // Jordan, 24 Nov: Record yes is the studio's tap, so the block calls
  // forwardOffer exactly once, in relayYesOffer, with no studio number.
  const fwdCalls = [...relayBlock.matchAll(/\bforwardOffer\(/g)].length;
  const yo = lift(relayBlock, "async function relayYesOffer(");
  check(G, "forwardOffer: called once in the block, from relayYesOffer, with an empty studio number and no options", [fwdCalls, (yo.match(/\bforwardOffer\(/g) || []).length, /await forwardOffer\(fresh, \{ id: String\(ctx\.p\.id\), business_name: ctx\.name \}, String\(ctx\.row\.id\), v\.plan\.time, v\.stamped, "", \{\}\)/.test(yo)], [1, 1, true]);
  check(G, "relayYesOffer runs only from relayApplyStudio's yes", [...relayBlock.matchAll(/relayYesOffer\(ctx, v\)/g)].length === 1 && /if \(action === "yes"\) \{[\s\S]{0,120}relayYesOffer\(ctx, v\)/.test(lift(relayBlock, "async function relayApplyStudio(")), true);
  const sendsTo = [...relayBlock.matchAll(/\b(sendText|sendButtons|sendList|relaySay)\((\w+)/g)].map((m) => m[2]);
  check(G, "every send in the relay block goes to `from` (Jordan) or is relaySay's own", [...new Set(sendsTo)].sort(), ["from", "to"].sort());
}

// ---------------------------------------------------------------------------
// 6. What a studio's words say (relay.ts), and parity with the live handler.
// ---------------------------------------------------------------------------
const SP = { parseOfferedTime: C.parseOfferedTime, parseQuotedPrice: C.parseQuotedPrice, strongSpanish: C.strongSpanish, studioGenderReply: C.studioGenderReply, AUTOREPLY_RE: C.AUTOREPLY_RE, HOURS_STATEMENT_RE: C.HOURS_STATEMENT_RE, stopIntent: K.stopIntent, bajaIntent: (t) => LR.letterBajaIntent(t) || LR.BAJA_ONLY_RE.test(t) };
const RB = await load(`import { AUTOREPLY_RE, parseQuotedPrice, parseOfferedTime } from ${JSON.stringify(url("copy.ts"))};\n${stripTypeScriptTypes(replies)}\n${stripTypeScriptTypes(words)}\n${stripTypeScriptTypes(lift(botSrc, "function parseDiscount("))}\nexport { BARE_YES_RE, studioSaysArrived, plainStudioAck, parseDiscount };\n`);
Object.assign(SP, { BARE_YES_RE: RB.BARE_YES_RE, studioSaysArrived: RB.studioSaysArrived, plainStudioAck: RB.plainStudioAck, parseDiscount: RB.parseDiscount });
const facts = (o = {}) => ({ askTime: "18:00", wantGender: "", confirmedHere: false, confirmedTime: "", started: false, outcome: "pending", source: "text", single: true, echo: false, hoursOnFile: "", open: true, ...o });
const FIX = [
  ["Sí", facts(), { kinds: ["yes_ask"], time: "18:00" }],
  ["Sí, a las 18:00, 45€", facts(), { kinds: ["yes_ask", "price"], time: "18:00", price: 45 }],
  ["No podemos, lo siento", facts(), { kinds: ["no"] }],
  ["Mejor a las 19:30", facts(), { kinds: ["time"], time: "19:30" }],
  ["Abrimos de 10 a 21", facts(), { kinds: ["hours"], time: "", hours: "Lun-Dom 10:00-21:00" }],
  ["76,50€", facts(), { kinds: ["price"], price: 76.5 }],
  ["un 10% de descuento", facts(), { kinds: ["discount"], pct: 10 }],
  ["chica sí", facts({ wantGender: "female" }), { kinds: ["gender"], gender: true }],
  ["¡Hola! Gracias por comunicarte con Estudio Tres. En breve te atenderemos.", facts(), { kinds: ["away"] }],
  ["Ok", facts(), { kinds: ["ack"] }],
  ["BAJA", facts(), { kinds: ["stop"] }],
];
{
  const G = "6 studio readings";
  for (const [text, f, want] of FIX) {
    const p = R.studioRelayPlan(text, f, SP);
    const got = { kinds: p.kinds };
    for (const k of Object.keys(want)) if (k !== "kinds") got[k] = p[k];
    check(G, `studioRelayPlan ${JSON.stringify(text)}`, got, want);
  }
  // Blocker 2: a discount only from one forwarded text message of theirs.
  check(G, "a discount in a burst with our own lines is not taken", [R.studioRelayPlan("Sí, un 10%", facts({ echo: true, single: false }), SP).kinds.includes("discount"), R.studioRelayPlan("Sí, un 10%", facts({ echo: true, single: false }), SP).pctBlocked], [false, true]);
  check(G, "nor from a voice note", R.studioRelayPlan("os hacemos un 10%", facts({ source: "voice", single: false }), SP).kinds.includes("discount"), false);
  check(G, "a voice note: no yes recorded, only answered", R.studioActions(R.studioRelayPlan("Sí, a las 18:00", facts({ source: "voice", single: false }), SP), facts({ source: "voice", single: false })), ["answered", "undo"]);
  check(G, "a yes with no hour asked: never recorded as an offer", R.studioActions(R.studioRelayPlan("Sí", facts({ askTime: "" }), SP), facts({ askTime: "" })), ["answered", "undo"]);
  check(G, "a no from the studio holding the booking stands nothing down", R.studioActions(R.studioRelayPlan("No podemos", facts({ confirmedHere: true, outcome: "won", open: false }), SP), facts({ confirmedHere: true, outcome: "won", open: false })), ["undo"]);
  check(G, "an away message is never 'answered' (the chase goes on)", R.studioActions(R.studioRelayPlan("Gracias por contactar, te responderemos", facts(), SP), facts()), ["undo"]);
  const wr = R.studioWrites("yes", R.studioRelayPlan("Sí, a las 18:00, 45€", facts(), SP), facts(), "NOW", "[stamped]", "Sí, a las 18:00, 45€");
  check(G, "Record yes writes", wr, { dispatch: { outcome: "accepted", accepted_at: "NOW", replied_at: "NOW", reply_text: "[stamped]", offered_time: "18:00", offered_times: ["18:00"], quoted_price: 45 } }, "channel is left alone: it is the ask channel");
  check(G, "the stored text names the request's own day for a relative word", [R.relayStoredText("Sí, mañana a las 18:00", "jueves 26 de noviembre"), R.relayStoredText("por la mañana sí", "jueves 26 de noviembre"), R.relayRelativeWords("Sí, mañana a las 18:00 o por la mañana")], ["[reenviado por Jordan, jueves 26 de noviembre] Sí, jueves 26 de noviembre a las 18:00", "[reenviado por Jordan, jueves 26 de noviembre] por la mañana sí", ["mañana"]]);
  check(G, "hours as dispatch-studios reads them", ["Abrimos de lunes a sábado de 10 a 21", "Horario: 10:00 a 20:30", "Abrimos de 10 a 14 y de 17 a 21", "Cerramos los domingos"].map(R.relayHoursText), ["Lun-Sab 10:00-21:00", "Lun-Dom 10:00-20:30", "", ""]);
}
{
  const G = "6 parity with handleStudioReply";
  const hs = lift(botSrc, "async function handleStudioReply(");
  const parts = [hs, lift(botSrc, "async function patchDispatch("), lift(botSrc, "async function dispatchRowFor("), lift(botSrc, "function parseDiscount("), lift(botSrc, "function exactTime("), lift(botSrc, "async function reopenOfferClaim("), one("isSameDayReq"), one("OFFER_ROW_CLOSED"), one("OPEN_STAGES"), replies, words].filter(Boolean);
  const live = async (text, o = {}) => {
    T.now = M(15, 0);
    const now = T.now;
    const db = makeDb({
      whatsapp_requests: [{ id: 9401, first_name: "Lucia", service_name: "Relaxing massage", studio_name: null, partner_id: null, day1: "Thursday 26 Nov, 18:00", time1: "18:00", proposed_time: "18:00", languages: "en", client_phone: "+34600000401", stage: "studio_asked", contact_email: "x@correo.invalid", settle_after: null, message_text: "", created_at: iso(now - 3600e3), therapist_gender: o.gender || null, area: "Centro" }],
      request_dispatch: [{ id: "d-401", request_id: 9401, partner_id: "p-1", phone: "34911000401", outcome: "pending", created_at: iso(now - 3600e3), sent_at: iso(now - 3600e3), replied_at: null, quoted_price: null, discount_pct: null, accepted_at: null, chased_at: null }],
    });
    const log = { forward: [], award: [], said: [] };
    const env = {
      Date: FakeDate, SUPABASE_URL: "https://db.invalid", H: () => ({}), fetch: db.fetch, digitsOf, ...C,
      forwardOffer: async (req, p, row, time) => { log.forward.push(time); return "email"; },
      awardWinner: async (req, p, from, pct) => { log.award.push(pct); return true; },
      sendText: async (to, t) => { log.said.push(t); return true; }, founderCard: async () => {}, logEvent: async () => {}, notifyJordanWa: async () => {},
      severalAsked: async () => true, priceAsk: () => "", askedMins: () => 60, sendHeldOfferEmail: async () => false, offerPriceUpdate: async () => false,
      lastOutTo: async () => null, studioOpener: () => "", studioWhenEs: () => "", studioDayEs: () => "", coveredLine: () => "", handleLiveStudioMessage: async () => {},
      OPEN_STAGES: ["new", "dispatching", "studio_asked", "studio_replied", "offered", "bidding"], BID_WINDOW_MS: 600000, eurEs: (n) => `${n} €`,
    };
    const { fns } = sandbox(parts, env, ["handleStudioReply"]);
    const partner = { id: "p-1", business_name: "Estudio Uno" };
    if (o.button) await fns.handleStudioReply("34911000401", `studio_${o.button}_9401`, text, "", partner);
    else await fns.handleStudioReply("34911000401", "", "", text, partner);
    const row = db.t.request_dispatch[0];
    return { outcome: row.outcome, quoted_price: row.quoted_price ?? null, discount_pct: row.discount_pct ?? null, gender: row.therapist_gender_ok ?? null, forward: log.forward[0] || "", award: log.award.length > 0 };
  };
  const planOf = (text, f = facts()) => R.studioRelayPlan(text, f, SP);
  const cases = [
    ["Sí", { button: "confirm" }, (l, p) => [l.outcome === "accepted" && l.forward === "18:00", p.kinds.includes("yes_ask") && p.time === "18:00"]],
    ["Sí, a las 18:00, 45€", {}, (l, p) => [l.forward === "18:00" && l.quoted_price === 45, p.time === "18:00" && p.price === 45]],
    ["Mejor a las 19:30", {}, (l, p) => [l.forward === "19:30", p.kinds.includes("time") && p.time === "19:30"]],
    ["76,50€", {}, (l, p) => [l.quoted_price === 76.5 && !l.forward, p.price === 76.5 && !p.time]],
    ["un 10% de descuento", {}, (l, p) => [l.discount_pct === 10 && l.outcome === "accepted" && l.award, p.pct === 10]],
    ["chica sí", { gender: "female" }, (l, p) => [l.gender === true, p.gender === true], facts({ wantGender: "female" })],
    ["Abrimos de 10 a 21", {}, (l, p) => [!l.forward, p.kinds.includes("hours") && !p.time]],
    ["No podemos (botón)", { button: "no" }, (l, p) => [l.outcome === "declined", planOf("No podemos, lo siento").kinds.includes("no")]],
  ];
  for (const [text, o, cmpFn, f] of cases) {
    const l = await live(text, o);
    const [a, b] = cmpFn(l, planOf(text, f || facts()));
    check(G, `live and relay read ${JSON.stringify(text)} the same way`, [a, b], [true, true], JSON.stringify(l));
  }
}

// ---------------------------------------------------------------------------
// 7. Who wrote this: ranking and rows.
// ---------------------------------------------------------------------------
{
  const G = "7 ranking";
  const now = M(15, 0);
  const cand = (o) => ({ kind: "studio", key: o.key, requestId: 1, name: "Estudio", phone: "34911000000", test: false, atMs: now - 10 * 3600e3, ...o });
  const RP = { parseOfferedTime: C.parseOfferedTime, parseQuotedPrice: C.parseQuotedPrice, strongSpanish: C.strongSpanish };
  const top = (text, cs) => R.relayRank(text, cs, now, RP)[0].key;
  check(G, "a name in the text wins", top("Hola, somos Bambu Spa, sí podemos", [cand({ key: "a", name: "Estudio Sol", answered: false, outcome: "pending" }), cand({ key: "b", name: "Bambu Spa", answered: true, outcome: "accepted" })]), "b");
  check(G, "the hour asked wins", top("a las 18:00", [cand({ key: "a", askTime: "17:00" }), cand({ key: "b", askTime: "18:00" })]), "b");
  check(G, "an unanswered ask beats an answered one", top("vale", [cand({ key: "a", answered: true, outcome: "accepted" }), cand({ key: "b", answered: false, outcome: "pending" })]), "b");
  check(G, "a customer with a live offer and a yes", top("yes please", [cand({ key: "s", answered: true, outcome: "accepted" }), { kind: "customer", key: "c", requestId: 2, name: "Tomas", phone: "34699000000", test: false, atMs: now - 10 * 3600e3, liveOffer: { studio: "X", time: "19:00" }, windowOpen: false }]), "c");
  check(G, "ties go to the newest", top("hola", [cand({ key: "old", atMs: now - 20 * 3600e3 }), cand({ key: "new", atMs: now - 20 * 3600e3 + 1 })]), "new");
  const long = R.relayRowText(cand({ key: "x", name: "Centro de Masajes Muy Largo Madrid Centro", customerName: "Lucia", dayShort: "Thu 26", askTime: "18:00", sentHm: "14:05", outcome: "pending" }), "on");
  check(G, "a long name is cut, never the suffix; 24 and 72", [long.title.endsWith(" (studio)"), long.title.length <= 24, long.description.length <= 72, long.description], [true, true, true, "#1 Lucia · Thu 26 18:00 · asked 14:05, no answer · ...0000"]);
  check(G, "the list body says nothing is sent and carries English", R.relayListBody({ n: 1, quote: "Sí", en: "Yes", mode: "on", ref: 7 }), 'Who wrote this? "Sí"\n(EN: "Yes")\n\nPick them and I will save it in their chat and show you what I read. Picking sends nothing to anyone.\nRef R7');
}

// ---------------------------------------------------------------------------
// 8. A0: no external row ever opens a window.
// ---------------------------------------------------------------------------
{
  const G = "8 A0";
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.ts$/.test(f.name) && !/_v214(_\d)?\.ts$/.test(f.name)) files.push(p); } };
  walk(path.join(root, "supabase/functions"));
  const unclassified = [];
  let sites = 0;
  for (const f of files) {
    const src = path.resolve(f) === path.join(botDir, "bot.ts") ? botSrc : fs.readFileSync(f, "utf8");
    src.split("\n").forEach((line, i) => {
      if (!line.includes("direction=eq.in")) return;
      sites++;
      if (!/msg_type\.neq\.external/.test(line) && !/\/\/ A0: words/.test(line)) unclassified.push(`${path.relative(root, f)}:${i + 1}`);
    });
  }
  check(G, "every direction=eq.in read is a window read (external left out) or marked as reading words", unclassified, [], `${sites} sites`);
  check(G, "the filter keeps NULL msg_type (or=, never neq alone)", [...botSrc.matchAll(/msg_type=neq\.external/g)].length, 0);
  const winRead = (name) => /or=\(msg_type\.is\.null,msg_type\.neq\.external\)/.test(lift(botSrc, `async function ${name}(`));
  check(G, "lastInboundMs, waWindowOpen, coreInboundId leave external out", [winRead("lastInboundMs"), winRead("waWindowOpen"), winRead("coreInboundId")], [true, true, true]);
  const ds = read("supabase/functions/dispatch-studios/index.ts"), rs = read("supabase/functions/stuck-booking-rescue/index.ts");
  check(G, "dispatch-studios: reachableCustomer, the send op, the shut-studio grace, sendStudioNote", [/const prior = await sq\(`wa_messages\?phone=eq\.\$\{phone\}&direction=eq\.in&or=\(msg_type\.is\.null,msg_type\.neq\.external\)/.test(ds), (ds.match(/direction=eq\.in&or=\(msg_type\.is\.null,msg_type\.neq\.external\)/g) || []).length], [true, 5]);
  check(G, "stuck-booking-rescue: the window reads, and 'wrote in the last 2 hours' counts relayed words", [(rs.match(/direction=eq\.in&or=\(msg_type\.is\.null,msg_type\.neq\.external\)/g) || []).length, /lastAnyAt > now - 2 \* 60 \* 60 \* 1000/.test(rs)], [2, true]);
  check(G, "the watchdog: window from the bot, answered from anyone; left hanging skips external", [/const quietMs = lastWin \? now - Date\.parse\(lastWin\) : Infinity;/.test(botSrc), /if \(m\.direction !== "in" \|\| m\.msg_type === "external"\) continue;/.test(botSrc)], [true, true]);
  check(G, "the offer chase counts a relayed answer as an answer", /const lastIn = await lastInboundAnyMs\(phone\);\s*if \(tapped \|\| \(lastIn !== null && lastIn > sent\)/.test(botSrc), true);
  check(G, "the inbox: window and waiting skip external; the reply page labels it", [/if \(!e\.lastIn && m\.direction === "in" && m\.msg_type !== "external"\) e\.lastIn = m;/.test(botSrc), /waiting: e\.last\.direction === "in" && e\.last\.msg_type !== "external"/.test(botSrc), /\(VIA YOUR PHONE\)/.test(lift(botSrc, "function replyHtml(")), /select=id,direction,body,created_at,body_en,msg_type/.test(lift(botSrc, "async function fullThread("))], [true, true, true, true]);
  check(G, "the external copy is written with msg_type external", /await logMsg\(target, "in", body, "external", `rly:\$\{a\}`\);/.test(relayBlock), true);
  // agent_core: never answers relayed words as fresh customer words.
  const fresh = AC.newMessages([{ dir: "out", body: "Which day?", at: "" }, { dir: "in", body: "I said yes to Jordan", at: "", type: "external" }, { dir: "in", body: "Tomorrow", at: "", type: "text" }], "Tomorrow");
  check(G, "agent_core newMessages leaves external rows out", fresh, ["Tomorrow"]);
  // Behaviour: a window with only an external row is closed; a text row opens it.
  const db = makeDb({ wa_messages: [{ id: 1, phone: "34699000999", direction: "in", msg_type: "external", body: "yes", created_at: iso(T.now - 3600e3) }] });
  const s = sandbox([lift(botSrc, "async function waWindowOpen("), lift(botSrc, "async function lastInboundMs("), lift(botSrc, "async function lastInboundAnyMs("), one("CUSTOMER_WINDOW_MS")], { fetch: db.fetch, SUPABASE_URL: "https://db.invalid", H: () => ({}), digitsOf, Date: FakeDate }, ["waWindowOpen", "lastInboundMs", "lastInboundAnyMs"]);
  const a = [await s.fns.waWindowOpen("34699000999"), await s.fns.lastInboundMs("34699000999"), !!(await s.fns.lastInboundAnyMs("34699000999"))];
  db.t.wa_messages.push({ id: 2, phone: "34699000999", direction: "in", msg_type: null, body: "hi", created_at: iso(T.now - 600e3) });
  check(G, "external only: window closed, no last inbound, but an answer; a NULL type still opens it", [...a, await s.fns.waWindowOpen("34699000999")], [false, null, true, true]);
}

// ---------------------------------------------------------------------------
// 9. Copy: no em or en dashes; English beside every Spanish quote.
// ---------------------------------------------------------------------------
{
  const G = "9 copy";
  check(G, "relay.ts and offer_tpl.ts have no em or en dash", [dash(fs.readFileSync(path.join(botDir, "relay.ts"), "utf8")), dash(fs.readFileSync(path.join(botDir, "offer_tpl.ts"), "utf8"))], [false, false]);
  check(G, "the relay block has no em or en dash", dash(relayBlock), false);
  const w = relayWorld({ mode: "test" });
  await w.forward("Sí, mañana a las 18:00");
  await w.tap(lastTo(w, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba")).id);
  const toJ = w.sent.filter((s) => s.to === JORDAN).map((s) => s.body);
  check(G, "everything Jordan got: no dash, and every Spanish quote has its EN line", [toJ.some(dash), toJ.filter((b) => /"Sí, mañana/.test(b)).every((b) => /\(EN: "/.test(b))], [false, true]);
  check(G, "the card says how the relative day was read", toJ.some((b) => /They wrote "mañana"\. A forward carries no time, so I read it as the request's own day, Thursday 26 November/.test(b)), true);
  check(G, "a card too long for one WhatsApp message goes as the text, then the buttons", [w.sent.filter((s) => s.to === JORDAN).every((s) => s.kind !== "buttons" || s.body.length <= 1024), w.sent.slice(-1)[0].kind, w.sent.slice(-1)[0].body], [true, "buttons", "What should I record?"]);
  const stored = w.db.t.request_dispatch.find((d) => d.id === TEST_ROW);
  await w.tap(w.sent.slice(-1)[0].buttons.find((b) => b.title === "Record yes").id);
  check(G, "the stored text names the request's day, not the forward's 'mañana'", stored.reply_text, "[reenviado por Jordan, jueves 26 de noviembre] Sí, jueves 26 de noviembre a las 18:00", "the bot's later readers would resolve 'mañana' from the day it was recorded");
  check(G, "labels fit WhatsApp buttons (20)", Object.values(R.RELAY_LABELS).every((l) => l.length <= 20), true);
}

// ---------------------------------------------------------------------------
// 10. Part B: the offer template for a closed window.
// ---------------------------------------------------------------------------
{
  const G = "10 template copy";
  const long = (ms, L) => new Intl.DateTimeFormat(L === "es" ? "es-ES" : "en-GB", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(new Date(ms));
  const slot = M(18, 0, 2);
  const base = { firstName: "Lucia Ejemplo", studio: "Estudio Ejemplo", neighbourhood: "Chamberí", slotAtMs: slot, time: "18:00", svc: "relaxing massage", mins: 60, price: null, listed: null };
  const p = (L, o) => OT.offerTplParams(L, { ...base, ...(L === "es" ? { svc: "masaje relajante" } : {}), ...o }, long);
  const cases = [
    ["en", { price: 55 }, ["Lucia", "Estudio Ejemplo (Chamberí)", "Thursday 26 November", "18:00", "relaxing massage, 60 minutes", "55 EUR (confirmed by the studio)"]],
    ["en", { listed: 55 }, ["Lucia", "Estudio Ejemplo (Chamberí)", "Thursday 26 November", "18:00", "relaxing massage, 60 minutes", "about 55 EUR (the studio's listed price)"]],
    ["en", { firstName: "" }, ["there", "Estudio Ejemplo (Chamberí)", "Thursday 26 November", "18:00", "relaxing massage, 60 minutes", "not confirmed yet"]],
    ["es", { price: 76.5 }, ["Lucia", "Estudio Ejemplo (Chamberí)", "jueves 26 de noviembre", "18:00", "masaje relajante, 60 minutos", "76,50 € (confirmado por el centro)"]],
    ["es", { listed: 55, firstName: "" }, ["de nuevo", "Estudio Ejemplo (Chamberí)", "jueves 26 de noviembre", "18:00", "masaje relajante, 60 minutos", "unos 55 € (precio publicado del centro)"]],
    ["es", {}, ["Lucia", "Estudio Ejemplo (Chamberí)", "jueves 26 de noviembre", "18:00", "masaje relajante, 60 minutos", "aún sin confirmar"]],
  ];
  for (const [L, o, want] of cases) check(G, `offerTplParams ${L} ${JSON.stringify(o)}`, p(L, o), want);
  check(G, "no start known: no template", p("en", { slotAtMs: null }), null);
  const all = cases.map(([L, o]) => p(L, o)).flat();
  check(G, "every parameter one line, at most 300, never today or tomorrow, no dash, no discount wording", [all.every((x) => !/\n/.test(x) && x.length <= 300), all.some((x) => /\b(today|tomorrow|hoy|mañana)\b/i.test(x)), all.some(dash), all.some((x) => /Massage Club rate|tarifa Massage Club|descuento|discount/i.test(x))], [true, false, false, false]);
  check(G, "the bodies as submitted", [OT.renderOfferTpl("en", cases[0][2]), OT.renderOfferTpl("es", cases[5][2])], [
    "Hi Lucia, here is news on your massage request.\n\nEstudio Ejemplo (Chamberí) can take you on Thursday 26 November at 18:00: relaxing massage, 60 minutes.\nPrice: 55 EUR (confirmed by the studio). You pay at the studio, no fee.\n\nNothing is booked until you tap Yes.\n\nMassage Club",
    "Hola Lucia, te escribimos con novedades sobre tu solicitud de masaje.\n\nEstudio Ejemplo (Chamberí) puede atenderte el jueves 26 de noviembre a las 18:00: masaje relajante, 60 minutos.\nPrecio: aún sin confirmar. Pagas en el centro, sin comisión.\n\nNo se reserva nada hasta que toques Sí.\n\nMassage Club",
  ]);
  check(G, "buttons: 25 characters at most, three, the offer payloads", [[...OT.OFFER_TPL_BUTTONS.en, ...OT.OFFER_TPL_BUTTONS.es].every((b) => b.length <= 25), OT.OFFER_TPL_BUTTONS.en.length, OT.OFFER_TPL_BUTTONS.es.length, OT.offerTplPayloads("r-1")], [true, 3, 3, ["offer_yes_r-1", "offer_no_r-1", "offer_alt_r-1"]]);
  check(G, "who may get it", [
    OT.offerTplAudience("off", { phone: JORDAN, testCustomer: true, held: false, muted: false }),
    OT.offerTplAudience("test", { phone: JORDAN, testCustomer: true, held: false, muted: false }),
    OT.offerTplAudience("test", { phone: "34600000301", testCustomer: true, held: false, muted: false }),
    OT.offerTplAudience("test", { phone: "34699000302", testCustomer: false, held: false, muted: false }),
    OT.offerTplAudience("on", { phone: "34699000302", testCustomer: false, held: false, muted: false }),
    OT.offerTplAudience("on", { phone: "17867276503", testCustomer: true, held: false, muted: false }),
    OT.offerTplAudience("on", { phone: "34699000302", testCustomer: false, held: true, muted: false }),
  ], [false, true, false, false, true, false, false], "test: Jordan's two numbers only, never the canary");
  // The ops tplnew submission, dry, in a stub (never run without dry).
  const tn = between(botSrc, '    if (payload?.ops === "tplnew") {', "    // v97: can this project's token touch the ad accounts");
  const db = makeDb({ app_secrets: [{ key: "WABA_ID", value: "100000000000001" }] });
  const { fns } = sandbox([`async function tplnew(payload) {\n${tn}\nreturn null; }`], { fetch: db.fetch, SUPABASE_URL: "https://db.invalid", H: () => ({}), OPS_KEY: OPS, WA_TOKEN: "x", Response }, ["tplnew"]);
  for (const L of ["en", "es"]) {
    const out = await (await fns.tplnew({ ...OT.offerTplSubmission(L), key: OPS })).json();
    const comps = out.spec?.components || [];
    check(G, `tplnew dry ${L}: UTILITY, 6 examples, 3 quick replies, no network`, [out.dry, out.spec?.category, out.spec?.language, out.spec?.name, comps[0]?.example?.body_text?.[0]?.length, comps[1]?.buttons?.map((b) => b.type), db.network.length], [true, "UTILITY", L, "request_update_v1", 6, ["QUICK_REPLY", "QUICK_REPLY", "QUICK_REPLY"], 0]);
  }
  check(G, "the submission examples use invented names", OT.offerTplSubmission("en").examples.slice(0, 2), ["Lucy", "Example Studio (Chamberí)"]);
  for (const L of ["en", "es"]) check(G, `the ${L} body never starts or ends with a placeholder (Meta rejects it)`, [/^\s*\{\{/.test(OT.OFFER_TPL_TEXT[L]), /\}\}\s*$/.test(OT.OFFER_TPL_TEXT[L])], [false, false]);
}
{
  const G = "10 template sends";
  const fo = lift(botSrc, "async function forwardOffer(");
  const sh = lift(botSrc, "async function sendHeldOfferEmail(");
  const sot = lift(botSrc, "async function sendOfferTemplate(");
  const otm = lift(botSrc, "async function offerTplMode(");
  const run = async (o = {}) => {
    T.now = M(12, 20);
    const st = { row: { id: "row-1", request_id: 9501, partner_id: "p-1", phone: "34911000501", offered_time: "18:00", outcome: "accepted", reply_text: "Sí, tengo hueco (botón)", replied_at: iso(T.now), customer_answer: null, customer_offered_at: null, customer_offered_time: null, customer_offer_via: null, quoted_price: o.price ?? null, discount_pct: null, offer_slot_at: null, ...(o.row || {}) } };
    const log = { tpl: [], emails: [], studio: [], cards: [], session: null, alerts: [] };
    const req = { id: 9501, first_name: "Lucia", service_name: "Relaxing massage", day1: "Thursday 26 Nov, 18:00", time1: "18:00", proposed_time: "18:00", contact_email: "lucia@correo.invalid", client_phone: o.phone ? "+" + o.phone : null, languages: "en", stage: "studio_asked", message_text: "", created_at: iso(T.now - 3600e3), area: "Centro" };
    const env = {
      Date: FakeDate, SUPABASE_URL: "https://db.invalid", H: () => ({}),
      fetch: async (u, opt = {}) => {
        u = decodeURIComponent(String(u));
        const body = JSON.parse(opt.body || "{}");
        if (opt.method === "PATCH" && u.includes("request_dispatch?id=eq.row-1")) {
          if (u.includes("customer_offer_via=eq.email_pending") && st.row.customer_offer_via !== "email_pending") return res(200, []);
          Object.assign(st.row, body); return res(200, [st.row]);
        }
        if (u.includes("request_dispatch?id=eq.row-1")) return res(200, [st.row]);
        if (u.includes("whatsapp_requests?id=eq.")) return res(200, [req]);
        if (/graph\.facebook|resend|anthropic/.test(u)) throw new Error("network");
        return res(200, []);
      },
      digitsOf, getSession: async () => ({ step: "", data: {} }), saveSession: async (s) => { log.session = JSON.parse(JSON.stringify(s)); },
      partnerCard: async () => ({ business_name: "Estudio Uno", address: "Calle Inventada 1", phone: "", neighbourhood: "Chamberí" }),
      dispatchRowFor: async () => st.row, emailOffer: async (...a) => { log.emails.push(a); return true; }, waWindowOpen: async () => false,
      studioSay: async (to, t) => { log.studio.push(t); return true; }, studioNoteSure: async (n) => { log.studio.push(n.text); return "sent"; },
      logEvent: async () => {}, founderCard: async (s, x) => { log.cards.push(x.paras?.[0] || ""); }, notifyJordanWa: async (t) => { log.alerts.push(t); },
      appSecret: async (k) => (k === "OFFER_TEMPLATE" ? o.mode || "off" : ""),
      mktTemplateGate: async (to, name, lang) => (o.category === "MARKETING" ? { ok: false, category: "MARKETING", status: "not answered", why: "a MARKETING template needs a yes" } : { ok: true, category: "UTILITY", status: null }),
      sendTemplate: async (to, name, lang, params, payloads, logBody) => { log.tpl.push({ to, name, lang, params, payloads, logBody }); return true; },
      offerTplParams: OT.offerTplParams, renderOfferTpl: OT.renderOfferTpl, offerTplAudience: OT.offerTplAudience, offerTplPayloads: OT.offerTplPayloads, parseOfferTplMode: OT.parseOfferTplMode, OFFER_TPL_NAME: OT.OFFER_TPL_NAME,
      resolveRequestDate: O.resolveRequestDate, madridMidnight: O.madridMidnight, COPY: O.COPY, trSvc: O.trSvc, trSvcLow: C.trSvcLow,
      dayLabelFor: () => "Thursday 26 November", parseQuotedPrice: C.parseQuotedPrice, parseOfferedTimes: () => [], listedPrice: async () => null,
      OPEN_STAGES: ["new", "dispatching", "studio_asked", "studio_replied", "offered", "bidding"], FAKE_NUM_RE: /(^|\D)34600000\d{3}(\D|$)/, TEST_NAME_RE: /\b(test|prueba|uitest|mctest)\b/i,
      TEST_PHONES: ["15622355063", "17867276503", "34612474827"], TEST_EMAIL_RE: /@(example|test|testing)\.com$/i, REL_TEST_EMAIL_RE: /@(testing|example|test)\.com$/i, heldNum: () => false, heldMail: () => false,
      TPL_NOT_LIVE: /132001|template|does not exist|not found|not approved/i, lastWaError: "",
      ...P,
    };
    const { fns } = sandbox([fo, sh, sot, otm, one("offerTplCache"), one("offerTplToldNotLive"), one("LONG_EN"), one("LONG_ES"), lift(botSrc, "function offerTestCustomer("), lift(botSrc, "function offerDayFromText("), lift(botSrc, "function rowDayLabel("), one("isSameDayReq"), liftArrow("reqDuration"), liftArrow("askedMins"), words].filter(Boolean), env, ["forwardOffer", "sendHeldOfferEmail"]);
    const out = await fns.forwardOffer(req, { id: "p-1", business_name: "Estudio Uno" }, "row-1", "18:00", o.text || "Sí, a las 18:00", "34911000501", o.opts || {});
    return { out, st, log, fns };
  };
  const off = await run({ mode: "off", phone: JORDAN });
  check(G, "switch off, window closed: exactly today's result (the email), no template", [off.out, off.log.emails.length, off.log.tpl.length, off.st.row.customer_offer_via, off.log.session?.data?.offer?.via], ["email", 1, 0, "email", "email"]);
  const test = await run({ mode: "test", phone: JORDAN, price: 55 });
  check(G, "test, Jordan's number, window closed: the template and the email", [test.out, test.log.emails.length, test.log.tpl.length, test.log.tpl[0]?.name, test.log.tpl[0]?.lang, test.log.tpl[0]?.payloads, test.log.session?.data?.offer?.via], ["email", 1, 1, "request_update_v1", "en", ["offer_yes_row-1", "offer_no_row-1", "offer_alt_row-1"], "template"]);
  check(G, "the template carries the date and the written price; the log shows what they read", [test.log.tpl[0]?.params?.[2], test.log.tpl[0]?.params?.[5], /^Hi Lucia, here is news on your massage request\./.test(test.log.tpl[0]?.logBody || "")], ["Thursday 26 November", "55 EUR (confirmed by the studio)", true]);
  const canary = await run({ mode: "test", phone: "34600000501" });
  check(G, "test mode never sends to the canary", canary.log.tpl.length, 0);
  const mkt = await run({ mode: "on", phone: "34699000501" });
  check(G, "on, a real customer: the template goes", mkt.log.tpl.length, 1);
  const marketing = await run({ mode: "on", phone: "34699000501", category: "MARKETING" });
  check(G, "if Meta files it as MARKETING and they never said yes: the email only", [marketing.log.tpl.length, marketing.log.emails.length, marketing.out], [0, 1, "email"]);
  const held = await run({ mode: "test", phone: JORDAN, opts: { willAskPrice: true } });
  check(G, "an email held for the price: no template yet", [held.out, held.log.tpl.length, held.log.emails.length], ["email_pending", 0, 0]);
  held.st.row.quoted_price = 60;
  held.st.row.offer_slot_at = iso(M(18, 0, 2));
  T.now = M(12, 23);
  await held.fns.sendHeldOfferEmail("row-1", "timer");
  check(G, "the held email goes, and the template with it, with the same price", [held.log.emails.length, held.log.tpl.length, held.log.tpl[0]?.params?.[5]], [1, 1, "60 EUR (confirmed by the studio)"]);
  // The tap: offer_yes_<row> from a template reaches acceptOffer.
  check(G, "a template tap (type button, payload offer_yes_<row>) reaches acceptOffer", [/else if \(msg\.type === "button"\) \{ replyId = msg\.button\?\.payload \|\| ""/.test(botSrc), /const om = replyId\.match\(\/\^offer_\(yes\|no\|alt\)_\(\[0-9a-fA-F-\]\{8,\}\)\$\/\);\s*if \(om\) \{\s*if \(om\[1\] === "yes"\) await acceptOffer\(om\[2\], from, L, s\)/.test(botSrc)], [true, true]);
  check(G, "a template offer is never chased with free text", /o\.via !== "whatsapp"\) continue;/.test(botSrc), true);
}
{
  const G = "10 a second Yes";
  const ao = lift(botSrc, "async function acceptOffer(");
  const parts = [ao, lift(botSrc, "async function offerSlotFor("), lift(botSrc, "async function yesTooLate("), lift(botSrc, "async function changeTooLate("), lift(botSrc, "async function reaskStudio("), lift(botSrc, "async function reopenOfferClaim("), lift(botSrc, "function offerDayFromText("), lift(botSrc, "function rowDayLabel("), lift(botSrc, "function exactTime("), lift(botSrc, "function studioDate("), liftArrow("reqDuration"), one("studioDayOf"), one("studioAtEs"), one("deDay"), one("eurEs"), words].filter(Boolean);
  const run = async (rowOver = {}) => {
    const o = { L: rowOver.L };
    delete rowOver.L;
    T.now = M(12, 0);
    const log = { tell: [], mail: [], said: [], patches: [] };
    const row = { id: "row-1", request_id: 9601, partner_id: "p-1", phone: "34911000601", offered_time: "18:00", outcome: "won", channel: null, reply_text: "Sí", replied_at: iso(M(11, 0)), offered_at: iso(M(11, 0)), quoted_price: 50, discount_pct: null, ...rowOver };
    const req = { id: 9601, first_name: "Lucia", service_name: "Relaxing massage", day1: "Thursday 26 Nov, 18:00", time1: "18:00", proposed_time: "18:00", contact_email: "lucia@correo.invalid", client_phone: "+34699000601", languages: "en", stage: "confirmed", message_text: "", created_at: iso(M(9, 0)), confirmed_day: "Thursday 26 November", confirmed_time: "18:00", confirmed_start: iso(M(18, 0, 2)), partner_id: "p-1" };
    const env = {
      Date: FakeDate, SUPABASE_URL: "https://db.invalid", OPS_KEY: "k", H: () => ({}), quietThisTurn: false, sentThisTurn: false,
      fetch: async (u, opt = {}) => { u = String(u); if (opt.method === "PATCH") log.patches.push(u); if (u.includes("/request_dispatch?id=eq.") && !opt.method) return res(200, [row]); if (u.includes("/whatsapp_requests?id=eq.") && !opt.method) return res(200, [req]); return res(200, []); },
      digitsOf, partnerCard: async () => ({ business_name: "Estudio Uno", address: "Calle Inventada 1", phone: "", neighbourhood: "" }),
      tellStudio: async (...a) => { log.tell.push(a); return true; }, customerConfirmEmail: async (...a) => { log.mail.push(a); }, sendText: async (to, t) => { log.said.push(t); env.sentThisTurn = true; return true; },
      saveSession: async () => {}, founderCard: async () => {}, logEvent: async () => {}, notifyJordanWa: async () => {}, ensureBooking: async () => "tok",
      COPY: O.COPY, madridMidnight: O.madridMidnight, resolveRequestDate: O.resolveRequestDate, trSvc: O.trSvc, OPEN_STAGES: ["new", "dispatching", "studio_asked", "studio_replied", "offered", "bidding"], ...P,
    };
    const { fns } = sandbox(parts, env, ["acceptOffer"]);
    const booked = await fns.acceptOffer("row-1", "34699000601", o.L || "en", { phone: "34699000601", step: "await_offer", data: { offer: { row: "row-1" } } }, "whatsapp", {});
    // The webhook's holding line runs only when nothing went out and the
    // turn was not marked quiet (handler, "!sentThisTurn && !quietThisTurn").
    return { booked, log, fallback: !env.sentThisTurn && !env.quietThisTurn, quiet: env.quietThisTurn };
  };
  const again = await run();
  check(G, "a second Yes on the confirmed booking (email Yes, then the template's): it stands, nothing to the studio, one line to them", [again.booked, again.log.tell.length, again.log.mail.length, again.log.said, again.log.patches.length], [true, 0, 0, ["You're already booked: Estudio Uno at 18:00. Nothing more to do."], 0], "before: the studio was told 'acepta el cambio' and the customer confirmed again");
  check(G, "review m1: over the whole turn, no holding line and no ping to Jordan after it", [again.fallback, again.quiet, /if \(m && from && !sentThisTurn && !quietThisTurn && !isReaction/.test(botSrc)], [false, true, true]);
  const againEs = await run({ L: "es" });
  check(G, "the same in Spanish, no dash", [againEs.log.said, dash(againEs.log.said[0])], [["Ya tienes la reserva: Estudio Uno, a las 18:00. No tienes que hacer nada más."], false]);
  const moved = await run({ id: "row-1", offered_time: "18:30", outcome: "accepted" });
  check(G, "a real time change still goes through", [moved.booked, moved.log.tell.length], [true, 1]);
}

// ---------------------------------------------------------------------------
// 11. The review of 16243161 (24 Nov): M1-M3, m2-m8.
// ---------------------------------------------------------------------------
// Timers held until fired, so two webhooks can interleave as they do live.
const heldTimers = (w) => { const q = []; w.env.setTimeout = (f) => { q.push(f); return 0; }; return q; };
const until = async (cond) => { for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => setImmediate(r)); };
const fireAll = async (q) => { while (q.length) { const n = q.length; q.shift()(); await until(() => q.length < n - 1 || q.length === 0); for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r)); } };
const relayedRows = (w) => w.db.t.wa_messages.filter((m) => m.msg_type === "relayed").map((m) => [m.id, m.reply_id, m.body]);
{
  const G = "11 M1 text and photo";
  // (a) text, then a photo; the text's 4-second check runs after the photo's turn.
  {
    const w = relayWorld({ mode: "test" });
    const q = heldTimers(w);
    const t = w.logRow("Sí, a las 18:00");
    const pt = w.turnFor(t, "Sí, a las 18:00");
    await until(() => q.length === 1);
    const p = w.logRow("[image]");
    const pp = w.turnFor(p, "", "image");
    await until(() => q.length === 2);
    await fireAll(q);
    await pt; await pp;
    const lists = w.sent.filter((s) => s.kind === "list");
    check(G, "text then photo: one list, quoting the text; the photo marked not read; the text listed", [lists.length, lists[0]?.body.includes('"Sí, a las 18:00"'), relayedRows(w)], [1, true, [[t, `rly:${t}:listed`, "Sí, a las 18:00"], [p, `rly:${p}:ignored`, "[relay: image, not read]"]]]);
    check(G, "and Jordan is told the photo is not read", w.sent.some((s) => s.body === "I can read text and voice notes only. Forward the text instead."), true);
  }
  // (b) text, then a photo; the text's check runs while the photo is still waiting.
  {
    const w = relayWorld({ mode: "test" });
    const q = heldTimers(w);
    const t = w.logRow("Sí, a las 18:00");
    const pt = w.turnFor(t, "Sí, a las 18:00");
    await until(() => q.length === 1);
    const p = w.logRow("[image]");
    await fireAll(q); // the text's check sees the photo waiting and leaves the list to it
    await pt;
    check(G, "text check first: no list yet, the text still waiting", [w.sent.filter((s) => s.kind === "list").length, relayedRows(w)[0][1]], [0, null]);
    const pp = w.turnFor(p, "", "image");
    await until(() => q.length === 1);
    await fireAll(q);
    await pp;
    const lists = w.sent.filter((s) => s.kind === "list");
    check(G, "the photo's turn then sends the text's list (it no longer waits forever)", [lists.length, lists[0]?.body.includes('"Sí, a las 18:00"'), relayedRows(w).map((r) => r[1])], [1, true, [`rly:${t}:listed`, `rly:${p}:ignored`]]);
  }
  // (c) photo logged, then text logged, then the photo's turn (the race).
  {
    const w = relayWorld({ mode: "test" });
    const p = w.logRow("[image]");
    const t = w.logRow("Sí, a las 18:00");
    await w.turnFor(p, "", "image");
    await w.turnFor(t, "Sí, a las 18:00");
    const lists = w.sent.filter((s) => s.kind === "list");
    check(G, "photo then text: the photo's turn marks its own row only; the words survive and are listed", [relayedRows(w), lists.length, lists[0]?.body.includes('"Sí, a las 18:00"'), /Who wrote this\?/.test(lists[0]?.body || "")], [[[p, `rly:${p}:ignored`, "[relay: image, not read]"], [t, `rly:${t}:listed`, "Sí, a las 18:00"]], 1, true, true]);
  }
  // (d) a forward whose log failed (no row id): nothing read, Jordan told.
  {
    const w = relayWorld({ mode: "test" });
    w.logRow("Sí");
    await w.turnFor(null, "Sí");
    check(G, "no row id: no list, nothing claimed, one plain line", [w.sent.filter((s) => s.kind === "list").length, relayedRows(w)[0][1], lastTo(w, JORDAN)?.body], [0, null, "I could not save that forward, so I did nothing with it. Forward it again in a minute."]);
  }
}
{
  const G = "11 M3 the rate";
  const w = relayWorld({ mode: "test" });
  const req = w.db.t.whatsapp_requests.find((r) => r.id === 9301);
  req.stage = "bidding"; req.settle_after = iso(T.now - 60e3);
  await w.forward("Os hacemos un 10% de descuento");
  await w.tap(lastTo(w, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba")).id);
  const card = lastCard(w);
  check(G, "the card offers Record the rate, and says the ask stays open", [card.buttons.map((b) => b.title), /Their ask stays open: a rate is not a yes to an hour/.test(card.body)], [["Record the rate", "Not theirs"], true]);
  await w.tap(card.buttons[0].id);
  const row = w.db.t.request_dispatch.find((d) => d.id === TEST_ROW);
  check(G, "Record the rate: discount and answered only, the ask still pending (no accepted, no hour)", [row.outcome, row.discount_pct, !!row.replied_at, row.accepted_at, row.offered_time], ["pending", 10, true, null, null]);
  // dispatch-studios' hour-and-price chase reads accepted rows with no hour.
  const ds = read("supabase/functions/dispatch-studios/index.ts");
  const chaseQ = (ds.match(/request_dispatch\?outcome=eq\.accepted&offered_time=is\.null&chased_at=is\.null/) || [""])[0];
  const chased = chaseQ ? await (await w.db.fetch(`https://db.invalid/rest/v1/${chaseQ}&select=id`)).json() : null;
  check(G, "the chase A query finds nothing to chase", [!!chaseQ, chased], [true, []]);
  // settleBids, lifted, on the same database.
  const sb = sandbox([lift(botSrc, "async function settleBids(")], { fetch: w.db.fetch, SUPABASE_URL: "https://db.invalid", H: () => ({}), digitsOf, Date: FakeDate, awardWinner: async () => { w.spies.awardWinner++; return true; } }, ["settleBids"]);
  await sb.fns.settleBids();
  check(G, "the bidding settle offers nothing from the rate alone", w.spies.awardWinner, 0, "before the fix it awarded the asked hour to the customer");
  check(G, "studioWrites rate: no outcome", R.studioWrites("rate", R.studioRelayPlan("un 10% de descuento", facts(), SP), facts(), "NOW", "[s]", "un 10% de descuento"), { dispatch: { replied_at: "NOW", reply_text: "[s]", discount_pct: 10, offer_note: "un 10% de descuento" } });
  check(G, "the card no longer points Jordan at ops studio_offer (review M5)", Object.values(R.STUDIO_FOLLOWS).flat().some((x) => /studio_offer/.test(x)), false);
}
{
  const G = "11 M2 freeze";
  const c = relayWorld({ mode: "on" });
  await c.forward("I need to cancel, sorry");
  await c.tap(lastTo(c, JORDAN).rows.find((r) => r.title.startsWith("Tomas")).id);
  const cc = lastCard(c);
  check(G, "the card says what the freeze stops and what it does not", [/dispatch-studios then stops asking the studios on it for an hour or a price and stops asking more studios/.test(cc.body), /It does not stop the bot sending the customer an offer if a studio says yes or a bidding window closes/.test(cc.body), /nothing new is promised to the studio/.test(cc.body)], [true, true, false]);
  const ds = read("supabase/functions/dispatch-studios/index.ts");
  const chase = lift(ds, "async function chaseOpenAsks(");
  const aPart = chase.slice(chase.indexOf("// A: they said yes"));
  check(G, "dispatch-studios chase A skips a frozen request before any note", [/const FROZEN_FLAGS = \["change_requested", "cancelled"\];/.test(ds), /customer_flag&limit=1/.test(aPart), aPart.indexOf("FROZEN_FLAGS.includes(String(rq.customer_flag") > 0 && aPart.indexOf("FROZEN_FLAGS.includes(String(rq.customer_flag") < aPart.indexOf("await sendStudioNote(to, line")], [true, true, true]);
  const widen = between(ds, "} else if (body.widen === true) {", "requests = open;");
  check(G, "and its widen skips one too", widen.indexOf("FROZEN_FLAGS.includes(String(r.customer_flag") > 0 && widen.indexOf("FROZEN_FLAGS.includes(String(r.customer_flag") < widen.indexOf("const live = await sq("), true);
}
{
  const G = "11 minors";
  // m2: a list WhatsApp refused: the rows wait again and Jordan is told.
  const f = relayWorld({ mode: "test" });
  f.env.sendList = async () => false;
  const id = await (async () => { const r = f.logRow("Sí, a las 18:00"); await f.turnFor(r, "Sí, a las 18:00"); return r; })();
  check(G, "m2: a list that did not go: Jordan is told, the rows are closed and blanked", [relayedRows(f)[0], /did not take the "Who wrote this\?" list, so nothing was saved/.test(lastTo(f, JORDAN)?.body || ""), f.db.t.funnel_events.some((e) => e.event === "relay_list_failed" && e.meta.anchor === id)], [[id, `rly:${id}:failed`, "[relay ignored]"], true, true]);
  f.env.sendList = async (to, body, button, rows) => { f.sent.push({ to: digitsOf(to), kind: "list", body, button, rows }); return true; };
  await f.forward("Sí, a las 18:00");
  check(G, "m2: forwarding it again lists it once, not twice", /^Who wrote this\? "Sí, a las 18:00"/.test(f.sent.filter((s) => s.kind === "list").slice(-1)[0]?.body || ""), true);
  // m3: test mode, a test studio on a real customer's request: card only.
  const m3 = relayWorld({ mode: "test" });
  m3.db.t.request_dispatch.push({ id: "d0000000-0000-4000-8000-000000000502", request_id: 9302, partner_id: "p-test", phone: "34911000101", sent_at: iso(T.now - 3600e3), created_at: iso(T.now - 3600e3), replied_at: null, outcome: "pending", offered_time: null, chased_at: null, quoted_price: null, discount_pct: null, accepted_at: null, customer_offered_at: null, customer_answer: null, customer_offer_via: null, channel: null });
  await m3.forward("Sí, a las 19:00");
  const m3row = lastTo(m3, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba") && /#9302/.test(r.description || ""));
  check(G, "m3: the test studio's ask on a real request is listed without (test)", [!!m3row, /\(test\)/.test(m3row?.description || "")], [true, false]);
  await m3.tap(m3row.id);
  check(G, "m3: picking it gives the TEST MODE card; nothing saved or written", [lastTo(m3, JORDAN).body.startsWith("TEST MODE: nothing recorded or sent."), m3.db.t.wa_messages.filter((m) => m.msg_type === "external").length, m3.db.writes("request_dispatch").length], [true, 0, 0]);
  // m4: a TEST_PHONES tester that releasedAudience calls real.
  const m4 = relayWorld({ mode: "on" });
  m4.db.t.whatsapp_requests.push({ id: 9305, first_name: "Probador", last_name: "", client_phone: "+34635569364", contact_email: "", day1: "Thursday 26 Nov, 12:00", time1: "12:00", proposed_time: "12:00", message_text: "", created_at: iso(T.now - 3600e3), stage: "studio_asked", stage_updated_at: iso(T.now - 3600e3), partner_id: null, therapist_gender: null, languages: "en", service_name: "Massage", customer_flag: null });
  await m4.forward("I need to cancel");
  check(G, "m4: on mode never lists a TEST_PHONES tester", lastTo(m4, JORDAN).rows.some((r) => /#9305/.test(r.description || "")), false);
  const m4t = relayWorld({ mode: "test" });
  m4t.db.t.whatsapp_requests.push({ ...m4.db.t.whatsapp_requests.find((r) => r.id === 9305) });
  await m4t.forward("I need to cancel");
  const m4row = lastTo(m4t, JORDAN).rows.find((r) => /#9305/.test(r.description || ""));
  check(G, "m4: test mode writes for them (marked test)", [!!m4row, /\(test\)/.test(m4row?.description || "")], [true, true]);
  // m5: a forwarded contact card answering "Someone else" is handled, never quoted later.
  const m5 = relayWorld({ mode: "test" });
  await m5.forward("Sí, a las 18:00");
  await m5.tap(lastTo(m5, JORDAN).rows.find((r) => r.title === "Someone else").id);
  const cardRow = m5.logRow("[contacts]");
  await m5.turnFor(cardRow, "", "contacts", { msg: { contacts: [{ phones: [{ phone: "+34 911 00 01 01", wa_id: "34911000101" }] }] } });
  check(G, "m5: the contact card's own row is marked handled", m5.db.t.wa_messages.find((m) => m.id === cardRow)?.reply_id, `rly:${cardRow}:card`);
  await m5.forward("Otra cosa");
  const m5list = m5.sent.filter((s) => s.kind === "list").slice(-1)[0];
  check(G, "m5: the next burst quotes only its own words", [/Who wrote this\? "Otra cosa"/.test(m5list?.body || ""), /contacts/.test(m5list?.body || "")], [true, false]);
  // m8: a typed number is said as typed; an email-only studio has no chat.
  const ty = relayWorld({ mode: "test" });
  await ty.forward("Sí, a las 18:00");
  await ty.tap(lastTo(ty, JORDAN).rows.find((r) => r.title === "Someone else").id);
  await ty.type("+34 911 000 101");
  check(G, "m8: a typed number: 'the number you typed', not the contact card", [/the number you typed/.test(lastCard(ty).body), /contact card/.test(lastCard(ty).body)], [true, false]);
  const em = relayWorld({ mode: "test" });
  em.db.t.request_dispatch.find((d) => d.id === TEST_ROW).phone = "";
  await em.forward("Sí, a las 18:00");
  await em.tap(lastTo(em, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba") && /#9301/.test(r.description || "")).id);
  check(G, "m8: an email-only studio: 'Not saved in a chat', and nothing saved", [/^Not saved in a chat: Estudio Prueba Norte has no WhatsApp number on file\./.test(lastCard(em).body), em.db.t.wa_messages.filter((m) => m.msg_type === "external").length], [true, 0]);
  // m8: hours with English beside the Spanish day names.
  check(G, "m8: hours shown with English", [R.relayHoursShown("Lun-Sab 10:00-21:00"), R.relayHoursShown("Lun-Dom 10:00-20:30"), R.relayHoursShown("10:00-21:00"), R.relayActionWords("hours", { hours: "Mié-Sáb 10:00-14:00" }, String)], ["Lun-Sab 10:00-21:00 (EN: Mon-Sat 10:00-21:00)", "Lun-Dom 10:00-20:30 (EN: Mon-Sun 10:00-20:30)", "10:00-21:00", "their opening hours, Mié-Sáb 10:00-14:00 (EN: Wed-Sat 10:00-14:00)"]);
  const hr = relayWorld({ mode: "test" });
  await hr.forward("Abrimos de lunes a sábado de 10 a 21");
  await hr.tap(lastTo(hr, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba")).id);
  check(G, "m8: the hours card reads them in English too", /I read: opening hours Lun-Sab 10:00-21:00 \(EN: Mon-Sat 10:00-21:00\)/.test(lastCard(hr).body), true);
  // m8: an older "Someone else" goes back to its list when a newer one is picked.
  const ol = relayWorld({ mode: "test" });
  await ol.forward("Primero");
  const firstList = lastTo(ol, JORDAN);
  await ol.tap(firstList.rows.find((r) => r.title === "Someone else").id);
  T.now += 5 * 60e3;
  await ol.forward("Segundo");
  await ol.tap(lastTo(ol, JORDAN).rows.find((r) => r.title === "Someone else").id);
  check(G, "m8: only one 'Someone else' open at a time; the older burst is listed again", relayedRows(ol).map((r) => String(r[1]).replace(/\d+/, "N")), ["rly:N:listed", "rly:N:ask"]);
  await ol.tap(firstList.rows.find((r) => r.title === "Ignore").id);
  check(G, "m8: and its list works again", lastTo(ol, JORDAN).body, "Forgotten. The text is deleted.");
  // m8: the import line no longer runs into the next statement.
  check(G, "m8: bot.ts import line ends before const SUPABASE_URL", /from "\.\/offer_tpl\.ts";\nconst SUPABASE_URL = /.test(botSrc), true);
  // m8: the held email's request select carries last_name.
  check(G, "m8: sendHeldOfferEmail reads last_name", /select=id,first_name,last_name,service_name,day1/.test(lift(botSrc, "async function sendHeldOfferEmail(")), true);
}
{
  const G = "11 M4 socios";
  const html = read("public/socios.html");
  check(G, "the /socios page sends studios to the bot number (SOCIOS_FALLBACK_RE, SOCIOS_HELLO_RE and «ocupado» are read there), never 827", [/const WA_NUM = "34613977900";/.test(html), /612\D?474\D?827|612\\u00a0474/.test(html), /WhatsApp \+34&nbsp;613&nbsp;977&nbsp;900/.test(html)], [true, false, true]);
}

// ---------------------------------------------------------------------------
// 12. Record yes is the studio's tap (Jordan, 24 Nov: "Yes, my tap = studio's
// tap"): the yes is recorded as accepted, then the customer gets the normal
// offer through forwardOffer, as ops studio_offer does. Never twice, never on
// a frozen or closed request, never to a test contact; a relayed customer
// "yes" still confirms nothing.
// ---------------------------------------------------------------------------
const YES_ROW = "d0000000-0000-4000-8000-000000000606";
function yesWorld(o = {}) {
  const w = relayWorld({ mode: "on", ...o });
  w.db.t.whatsapp_requests.push({ id: 9306, first_name: "Marta", last_name: "Ejemplo", client_phone: "+34699000306", contact_email: o.email ?? "marta@correo.invalid", day1: "Thursday 26 Nov, 18:00", time1: "18:00", proposed_time: "18:00", message_text: "Quiere: Relaxing massage", created_at: iso(T.now - 3 * 3600e3), stage: o.stage || "studio_asked", stage_updated_at: iso(T.now - 3 * 3600e3), partner_id: null, confirmed_time: null, confirmed_start: null, therapist_gender: null, languages: "en", service_name: "Relaxing massage", customer_flag: o.flag ?? null });
  w.db.t.request_dispatch.push({ id: YES_ROW, request_id: 9306, partner_id: "p-real", phone: "34911000202", sent_at: iso(T.now - 2 * 3600e3), created_at: iso(T.now - 2 * 3600e3), replied_at: null, outcome: "pending", offered_time: null, chased_at: null, quoted_price: null, discount_pct: null, accepted_at: null, customer_offered_at: null, customer_answer: null, customer_offer_via: null, channel: null });
  if (o.windowOpen) w.db.t.wa_messages.push({ id: 80001, phone: "34699000306", direction: "in", msg_type: null, body: "hi", reply_id: null, created_at: iso(T.now - 3600e3) });
  if (o.muted) w.db.t.wa_sessions.push({ phone: "34699000306", step: "muted", data: {} });
  if (o.live) {
    w.db.t.partners.push({ id: "p-luna", business_name: "Estudio Luna", status: "listed", opted_out_at: null, opening_hours: null, whatsapp: "34911000303", phone: "", created_at: iso(T.now - 90 * 86400e3) });
    w.db.t.request_dispatch.push({ id: "d0000000-0000-4000-8000-000000000607", request_id: 9306, partner_id: "p-luna", phone: "34911000303", sent_at: iso(T.now - 2 * 3600e3), created_at: iso(T.now - 2 * 3600e3), replied_at: iso(T.now - 3600e3), outcome: "accepted", offered_time: "19:00", quoted_price: 50, accepted_at: iso(T.now - 3600e3), customer_offered_at: iso(T.now - 3600e3), customer_offered_time: "19:00", customer_offer_via: "email", offer_slot_at: iso(M(19, 0, 2)), customer_answer: null, channel: null });
  }
  return w;
}
// forwardOffer as it behaves on the row: the claim (customer_offered_at and
// the hour) and what carried it, so a second offer of the same row and hour
// reads as "already".
const claimAs = (via) => (a, db) => {
  const row = db.t.request_dispatch.find((d) => d.id === a[2]);
  if (row.customer_offered_at && row.customer_offered_time === a[3]) return "already";
  if (via !== "none") Object.assign(row, { customer_offered_at: iso(T.now), customer_offered_time: a[3], customer_offer_via: via === "template" ? "whatsapp" : via, offer_slot_at: iso(M(18, 0, 2)) });
  return via === "template" ? "whatsapp" : via;
};
const pickYes = async (w, text = "Sí, a las 18:00, 45€") => {
  await w.forward(text);
  const row = lastTo(w, JORDAN).rows.find((r) => r.title.startsWith("Estudio Sol") && /#9306/.test(r.description || ""));
  if (!row) return null;
  await w.tap(row.id);
  return lastCard(w);
};
const yesBtn = (card) => (card?.buttons || []).find((b) => b.title === "Record yes");
const yesRow = (w) => w.db.t.request_dispatch.find((d) => d.id === YES_ROW);
const confirmWrites = (w) => w.db.writes("whatsapp_requests").filter((x) => x.body?.stage === "confirmed" || x.body?.client_confirmed_at || x.body?.reconfirmed_at).length + w.db.writes("bookings").length;
{
  const G = "12 Record yes sends the normal offer";
  const atCall = [];
  const w = yesWorld({ forward: (a, db) => { atCall.push({ ...db.t.request_dispatch.find((d) => d.id === a[2]) }); return claimAs("email")(a, db); } });
  const card = await pickYes(w);
  if (process.env.RELAY_SHOW) console.log(`\n--- Record yes card (real customer, window closed, email) ---\n${card.body}\n  buttons: ${card.buttons.map((b) => b.title).join(" / ")}\n`);
  check(G, "the card: Record yes and Not theirs", card.buttons.map((b) => b.title), ["Record yes", "Not theirs"]);
  check(G, "the card says, before the tap, that it is the studio's tap and the customer gets the normal offer, how, and with what", /Record yes records their yes at 18:00, with the price 45 EUR, on their ask\. It counts as Estudio Sol's tap \(your rule of 24 Nov\), so Marta then gets the normal offer, the same message a studio's own yes sends: Estudio Sol, Thursday 26 November, at 18:00, with the price they wrote \(45 EUR\), by email to marta@correo\.invalid with Yes and No on its offer page, since their 24 hours with the bot are closed\./.test(card.body), true);
  check(G, "the card says what is checked, that nothing is booked until the customer taps, and that the studio is told nothing", [/As with any studio yes, it is not sent if it starts in under 45 minutes, is outside the day or hours they asked for, or costs more than an offer they already have; I tell you if that happens\./.test(card.body), /Nothing is booked until the customer taps Yes themselves; only then does the studio get the confirmation in writing/.test(card.body), /Nothing is sent to Estudio Sol from here: tell them on your phone that you are checking with Marta\./.test(card.body), /Nothing is sent to the studio from here, and nothing to the customer unless you tap Record yes\./.test(card.body)], [true, true, true, true]);
  check(G, "the old 'not sent from here, ask Claude' copy is gone", [/The offer is not sent from here/.test(card.body), /ask Claude to send the offer/.test(card.body), Object.values(R.STUDIO_FOLLOWS).flat().some((x) => /not sent from here|ask Claude/.test(x))], [false, false, false]);
  check(G, "before the tap: nothing offered, nothing written, nothing to anyone else", [w.spies.forwardOffer, w.db.writes("request_dispatch").length, toOthers(w).length], [0, 0, 0]);
  await w.tap(yesBtn(card).id);
  const row = yesRow(w);
  check(G, "Record yes: the ask is accepted at 18:00 with 45, as studio_offer records it", [row.outcome, row.offered_time, row.quoted_price, !!row.accepted_at, !!row.replied_at], ["accepted", "18:00", 45, true, true]);
  check(G, "then forwardOffer, once, on the accepted row", [w.spies.forwardOffer, atCall[0]?.outcome, atCall[0]?.offered_time, atCall[0]?.quoted_price], [1, "accepted", "18:00", 45]);
  const a = w.spies.forwardArgs[0] || [];
  check(G, "forwardOffer's arguments: the request as it is now, the studio, the row, the hour, the stored words, no studio number, no options", [a[0]?.id, a[0]?.stage, a[0]?.contact_email, a[1], a[2], a[3], a[4], a[5], a[6]], [9306, "studio_asked", "marta@correo.invalid", { id: "p-real", business_name: "Estudio Sol" }, YES_ROW, "18:00", "[reenviado por Jordan, jueves 26 de noviembre] Sí, a las 18:00, 45€", "", {}]);
  const reply = lastTo(w, JORDAN)?.body || "";
  if (process.env.RELAY_SHOW) console.log(`--- after the tap ---\n${reply}\n`);
  check(G, "Jordan is told what was recorded and what went to the customer", /^Recorded for Estudio Sol on #9306: their yes at 18:00, with the price 45 EUR, on their ask\. Sent Marta the normal offer by email to marta@correo\.invalid, with Yes and No on its offer page\. Nothing was sent to Estudio Sol: tell them on your phone that you are checking with Marta\. Nothing is booked until the customer taps Yes themselves/.test(reply), true);
  check(G, "logged as studio_accepted via relay, as studio_offer logs it", w.db.t.funnel_events.filter((e) => e.event === "studio_accepted").map((e) => [e.meta.id, e.meta.via, e.meta.offer]), [[9306, "relay", "email"]]);
  check(G, "nothing books, awards or confirms: only the customer's own tap does", [w.spies.acceptOffer, w.spies.awardRequest, w.spies.ensureBooking, w.spies.awardWinner, confirmWrites(w), w.spies.tellStudio, w.spies.studioNoteSure], [0, 0, 0, 0, 0, 0, 0]);
  // A double tap on the same button.
  await w.tap(yesBtn(card).id);
  check(G, "a double tap: no second offer, 'Already done.'", [w.spies.forwardOffer, lastTo(w, JORDAN)?.body], [1, "Already done."]);
  // The same yes forwarded again: the card says it is already with them, and a tap sends nothing again.
  T.now += 60e3;
  const card2 = await pickYes(w);
  check(G, "the same yes forwarded again: the card says the offer is already with them", /It counts as Estudio Sol's tap \(your rule of 24 Nov\), but Marta already got this offer \(Estudio Sol at 18:00\), so nothing goes to them again: the yes is only recorded\./.test(card2?.body || ""), true);
  await w.tap(yesBtn(card2).id);
  check(G, "and Record yes on it: still one offer", [w.spies.forwardOffer, /Marta already had this offer, so nothing went again\./.test(lastTo(w, JORDAN)?.body || "")], [1, true]);
  // A relayed customer yes still confirms nothing (BOTH PARTIES TAP).
  T.now += 60e3;
  await w.forward("yes");
  const cust = lastTo(w, JORDAN).rows.find((r) => r.title.startsWith("Marta"));
  check(G, "Marta is listed with the offer waiting", /Estudio Sol 18:00 offer waiting/.test(cust?.description || ""), true);
  await w.tap(cust.id);
  const cc = lastCard(w);
  check(G, "a relayed customer yes: nothing is booked, the only button is Not theirs", [/Nothing is booked\. Only their own tap on Yes books it\./.test(cc.body), cc.buttons.map((b) => b.title)], [true, ["Not theirs"]]);
  check(G, "and it confirms nothing anywhere", [w.spies.acceptOffer, confirmWrites(w), yesRow(w).customer_answer, w.spies.forwardOffer, toOthers(w).length], [0, 0, null, 1, 0]);
}
{
  const G = "12 Record yes: how it reaches them";
  const open = yesWorld({ windowOpen: true, forward: claimAs("whatsapp") });
  const oc = await pickYes(open);
  check(G, "window open: the card says WhatsApp with its buttons", /Marta then gets the normal offer, the same message a studio's own yes sends: Estudio Sol, Thursday 26 November, at 18:00, with the price they wrote \(45 EUR\), on WhatsApp with its Yes, Another time and Closer or cheaper buttons, since their 24 hours with the bot are open\./.test(oc.body), true);
  await open.tap(yesBtn(oc).id);
  check(G, "and the reply says it went on WhatsApp", [open.spies.forwardOffer, /Sent Marta the normal offer on WhatsApp, with its Yes button\./.test(lastTo(open, JORDAN).body)], [1, true]);
  const none = yesWorld({ email: "", forward: claimAs("none") });
  const nc = await pickYes(none);
  check(G, "window closed, no email, template off: the card says nothing can reach them and the OFFER NOT DELIVERED card comes", /so Marta would get the normal offer \(Estudio Sol, Thursday 26 November, at 18:00, with the price they wrote \(45 EUR\)\), but nothing can reach them: their 24 hours with the bot are closed and there is no email on file\. The offer is held, nothing is booked, and you get the OFFER NOT DELIVERED card\./.test(nc.body), true);
  await none.tap(yesBtn(nc).id);
  check(G, "and the reply says so", [none.spies.forwardOffer, /Nothing could reach Marta \(their 24 hours are closed and there is no email on file\), so nothing is booked: see the OFFER NOT DELIVERED card\./.test(lastTo(none, JORDAN).body)], [1, true]);
  const tpl = yesWorld({ tplMode: "on", forward: claimAs("email") });
  const tc = await pickYes(tpl);
  check(G, "OFFER_TEMPLATE on, window closed: the card names the template too, if Meta has approved it", /by email to marta@correo\.invalid with Yes and No on its offer page, and as the request_update_v1 WhatsApp template too if Meta has approved it, since their 24 hours with the bot are closed\./.test(tc.body), true);
  const tplOff = yesWorld({ forward: claimAs("email") });
  check(G, "OFFER_TEMPLATE off (the default): no template on the card", /request_update_v1/.test((await pickYes(tplOff)).body), false);
  const live = yesWorld({ live: true, forward: () => "queued" });
  const lc = await pickYes(live);
  check(G, "another offer open: the card says this one waits behind it", /Marta already has Estudio Luna 19:00 open, so this one waits behind it and is shown if they turn that one down/.test(lc.body), true);
  await live.tap(yesBtn(lc).id);
  check(G, "and the reply says it is queued", [live.spies.forwardOffer, /Marta has another offer open, so this one waits behind it and is shown if they turn that one down\./.test(lastTo(live, JORDAN).body)], [1, true]);
  const muted = yesWorld({ muted: true, forward: () => "muted" });
  const mc = await pickYes(muted);
  check(G, "a muted customer: the card says nothing goes and the request closes, as for any studio yes", [/but Marta is muted \(off-menu requests\), so, as for any studio yes, nothing is sent to them and the bot closes the request\./.test(mc.body), /nothing to the customer unless you tap Record yes/.test(mc.body)], [true, false]);
  for (const [res, re] of [["withheld_too_soon", /Not sent to Marta: 18:00 starts in under 45 minutes\. Nothing was sent to Estudio Sol either/], ["withheld_mismatch", /Not sent to Marta: 18:00 is outside the day or hours they asked for\. Nothing was sent to Estudio Sol either/], ["held_window", /Held for up to 15 minutes: 18:00 is outside the hours Marta asked for today/], ["withheld_dearer", /Not sent to Marta: they already have a cheaper offer open\./]]) {
    const x = yesWorld({ forward: () => res });
    await x.tap(yesBtn(await pickYes(x)).id);
    check(G, `forwardOffer says ${res}: the reply says so`, [x.spies.forwardOffer, re.test(lastTo(x, JORDAN).body), yesRow(x).outcome], [1, true, "accepted"]);
  }
  // A row that had lapsed (or was declined) with the same hour: a new offer, as the live tap path does.
  const lapsed = yesWorld({ forward: claimAs("email") });
  Object.assign(yesRow(lapsed), { outcome: "expired", offered_time: "18:00", customer_offered_at: iso(T.now - 5 * 3600e3), customer_offered_time: "18:00", customer_offer_via: "email", offer_slot_at: iso(M(18, 0, 2)) });
  const lpc = await pickYes(lapsed);
  check(G, "a lapsed row: the card says the normal offer goes again (not 'already')", [/so Marta then gets the normal offer/.test(lpc.body), /already got this offer/.test(lpc.body)], [true, false]);
  await lapsed.tap(yesBtn(lpc).id);
  check(G, "and the tap reopens the claim and offers it once", [lapsed.spies.forwardOffer, yesRow(lapsed).outcome, /Sent Marta the normal offer by email/.test(lastTo(lapsed, JORDAN).body)], [1, "accepted", true]);
  const boom = yesWorld({ forward: () => { throw new Error("boom"); } });
  await boom.tap(yesBtn(await pickYes(boom)).id);
  check(G, "the offer step failing: the yes stays recorded and the reply says the offer may not have gone (never 'nothing changed')", [yesRow(boom).outcome, /The offer step did not finish \(an error\), so Marta may not have the offer\. The yes is recorded/.test(lastTo(boom, JORDAN).body), /did not save/.test(lastTo(boom, JORDAN).body)], ["accepted", true, false]);
}
{
  const G = "12 Record yes: frozen, closed, test";
  // Frozen before the card.
  const fz = yesWorld({ flag: "change_requested" });
  const fc = await pickYes(fz);
  check(G, "frozen: the card says nothing new is sent, the yes is only recorded", [/but the request is frozen \(Marta asked to change or cancel it\), so nothing new is sent to them: the yes is only recorded\./.test(fc.body), /Nothing is sent to the studio or the customer from here\./.test(fc.body)], [true, true]);
  await fz.tap(yesBtn(fc).id);
  check(G, "frozen: recorded, no offer, the reply says why", [yesRow(fz).outcome, fz.spies.forwardOffer, /Nothing was sent to Marta: the request is frozen/.test(lastTo(fz, JORDAN).body), toOthers(fz).length], ["accepted", 0, true, 0]);
  const fx = yesWorld({ flag: "cancelled" });
  await fx.tap(yesBtn(await pickYes(fx)).id);
  check(G, "customer_flag cancelled: no offer either", fx.spies.forwardOffer, 0);
  // Frozen after the card, before the tap: the hash sees it.
  const fl = yesWorld();
  const flc = await pickYes(fl);
  fl.db.t.whatsapp_requests.find((r) => r.id === 9306).customer_flag = "change_requested";
  await fl.tap(yesBtn(flc).id);
  check(G, "frozen after the card: nothing recorded or sent, the new card instead", [yesRow(fl).outcome, fl.spies.forwardOffer, /^Something changed since that card, so I did nothing\./.test(lastCard(fl).body), /the request is frozen/.test(lastCard(fl).body)], ["pending", 0, true, true]);
  // Frozen between the record and the offer: the request is read again.
  const race = yesWorld();
  const rc = await pickYes(race);
  const realFetch = race.env.fetch;
  race.env.fetch = async (u, o = {}) => { const r = await realFetch(u, o); if (o.method === "PATCH" && String(u).includes(`request_dispatch?id=eq.${YES_ROW}`)) race.db.t.whatsapp_requests.find((x) => x.id === 9306).customer_flag = "cancelled"; return r; };
  await race.tap(yesBtn(rc).id);
  check(G, "frozen between the record and the offer: recorded, nothing sent", [yesRow(race).outcome, race.spies.forwardOffer, /Nothing was sent to Marta: the request is frozen/.test(lastTo(race, JORDAN).body)], ["accepted", 0, true]);
  // Closed.
  const cl = yesWorld({ stage: "cancelled" });
  const clc = await pickYes(cl);
  check(G, "a cancelled request: no Record yes on the card", (clc?.buttons || []).map((b) => b.title).includes("Record yes"), false);
  const cl2 = yesWorld();
  const cl2c = await pickYes(cl2);
  cl2.db.t.whatsapp_requests.find((r) => r.id === 9306).stage = "confirmed";
  await cl2.tap(yesBtn(cl2c).id);
  check(G, "confirmed with someone else after the card: nothing recorded or sent", [yesRow(cl2).outcome, cl2.spies.forwardOffer, /^Something changed since that card/.test(lastCard(cl2).body)], ["pending", 0, true]);
  const cl3 = yesWorld();
  const cl3c = await pickYes(cl3);
  const f3 = cl3.env.fetch;
  cl3.env.fetch = async (u, o = {}) => { const r = await f3(u, o); if (o.method === "PATCH" && String(u).includes(`request_dispatch?id=eq.${YES_ROW}`)) cl3.db.t.whatsapp_requests.find((x) => x.id === 9306).stage = "cancelled"; return r; };
  await cl3.tap(yesBtn(cl3c).id);
  check(G, "cancelled between the record and the offer: nothing sent", [cl3.spies.forwardOffer, /Nothing was sent to anyone: the request is cancelled\./.test(lastTo(cl3, JORDAN).body)], [0, true]);
  for (const st of ["needs_review", "no_show", "dismissed"]) {
    const x = yesWorld({ stage: st });
    const xc = await pickYes(x);
    check(G, `a request in ${st}: never offered from the relay`, [(xc?.buttons || []).some((b) => b.title === "Record yes"), x.spies.forwardOffer], [false, 0]);
  }
  // Test contacts and friend testers.
  const t = relayWorld({ mode: "test" });
  await t.forward("Sí, a las 18:00");
  await t.tap(lastTo(t, JORDAN).rows.find((r) => r.title.startsWith("Estudio Prueba")).id);
  const tc = lastCard(t);
  await t.tap(yesBtn(tc).id);
  check(G, "test mode, a test customer: the card says so, the yes is recorded, no offer, nothing to anyone", [/but Lucia is a test contact, and the relay never sends a test contact anything/.test(tc.body), t.db.t.request_dispatch.find((d) => d.id === TEST_ROW).outcome, t.spies.forwardOffer, toOthers(t).length, /Nothing was sent to Lucia or to Estudio Prueba Norte: the relay never sends a test anything\./.test(lastTo(t, JORDAN).body)], [true, "accepted", 0, 0, true]);
  const tj = yesWorld();
  const tjc = await pickYes(tj);
  const fj = tj.env.fetch;
  tj.env.fetch = async (u, o = {}) => { const r = await fj(u, o); if (o.method === "PATCH" && String(u).includes(`request_dispatch?id=eq.${YES_ROW}`)) tj.db.t.whatsapp_requests.find((x) => x.id === 9306).client_phone = "+15622355063"; return r; };
  await tj.tap(yesBtn(tjc).id);
  check(G, "a request that turns out to be a test contact when read again: nothing sent", [tj.spies.forwardOffer, /the relay never sends a test anything/.test(lastTo(tj, JORDAN).body)], [0, true]);
  const fr = yesWorld();
  const frc = await pickYes(fr);
  const ff = fr.env.fetch;
  fr.env.fetch = async (u, o = {}) => { const r = await ff(u, o); if (o.method === "PATCH" && String(u).includes(`request_dispatch?id=eq.${YES_ROW}`)) fr.db.t.whatsapp_requests.find((x) => x.id === 9306).contact_email = "cata.waack@gmail.com"; return r; };
  await fr.tap(yesBtn(frc).id);
  check(G, "a friend tester's address when read again: nothing sent", fr.spies.forwardOffer, 0);
  check(G, "relayYesSend", [R.relayYesSend({ open: false, flag: "", test: false, already: false }), R.relayYesSend({ open: true, flag: "", test: true, already: false }), R.relayYesSend({ open: true, flag: "change_requested", test: false, already: false }), R.relayYesSend({ open: true, flag: "cancelled", test: false, already: true }), R.relayYesSend({ open: true, flag: "", test: false, already: true }), R.relayYesSend({ open: true, flag: "", test: false, already: false })], ["closed", "test", "frozen", "frozen", "already", "offer"]);
  const allWords = [];
  const base = { customer: "Marta", studio: "Estudio Sol", time: "18:00", day: "Thursday 26 November", price: 45, windowOpen: false, email: "m@correo.invalid", template: false, live: null, muted: false, stage: "studio_asked" };
  for (const send of ["offer", "already", "frozen", "test", "closed"]) for (const extra of [{}, { windowOpen: true }, { email: "" }, { template: true }, { live: { studio: "Estudio Luna", time: "19:00" } }, { muted: true }, { testStudio: true }, { customer: "" }]) allWords.push(R.relayYesWords({ ...base, send, ...extra }, (n) => `${n} EUR`));
  for (const res of ["whatsapp", "email", "email_pending", "queued", "already", "withheld_too_soon", "withheld_mismatch", "held_window", "withheld_dearer", "held", "muted", "none", "closed", "test", "frozen", "error", ""]) for (const tp of [false, true]) allWords.push(R.relayYesDone(res, { customer: "Marta", studio: "Estudio Sol", time: "18:00", email: "m@correo.invalid", template: tp, stage: "cancelled" }));
  check(G, "the yes copy: no em or en dash, never a claim that a booking is made", [allWords.some(dash), allWords.some((x) => /\b(is booked|booking is confirmed|confirmed the booking)\b/i.test(x.replace(/nothing is booked/gi, "")))], [false, false]);
}
{
  const G = "12 forwardOffer with no studio number";
  // The real forwardOffer, as relayYesOffer calls it (studioFrom ""): the
  // studio wrote to Jordan's phone, so the bot says nothing to it.
  const fo = lift(botSrc, "async function forwardOffer(");
  const studioSays = [];
  const st = { id: "row-1", request_id: 9501, partner_id: "p-1", phone: "34911000501", offered_time: "18:00", outcome: "accepted", reply_text: "", replied_at: iso(M(12, 0)), customer_answer: null, customer_offered_at: null, customer_offered_time: null, customer_offer_via: null, quoted_price: 45, discount_pct: null, offer_slot_at: null };
  T.now = M(12, 20);
  const req = { id: 9501, first_name: "Marta", service_name: "Relaxing massage", day1: "Thursday 26 Nov, 18:00", time1: "18:00", proposed_time: "18:00", contact_email: "marta@correo.invalid", client_phone: "+34699000501", languages: "en", stage: "studio_asked", message_text: "", created_at: iso(T.now - 3600e3), area: "Centro" };
  const emails = [];
  const env = {
    Date: FakeDate, SUPABASE_URL: "https://db.invalid", H: () => ({}),
    fetch: async (u, opt = {}) => { u = decodeURIComponent(String(u)); const body = JSON.parse(opt.body || "{}"); if (opt.method === "PATCH" && u.includes("request_dispatch?id=eq.row-1")) { Object.assign(st, body); return res(200, [st]); } if (u.includes("request_dispatch?id=eq.row-1")) return res(200, [st]); return res(200, []); },
    digitsOf, getSession: async () => ({ step: "", data: {} }), saveSession: async () => {}, partnerCard: async () => ({ business_name: "Estudio Uno", address: "Calle Inventada 1", phone: "", neighbourhood: "Chamberí" }),
    dispatchRowFor: async () => st, emailOffer: async (...x) => { emails.push(x); return true; }, waWindowOpen: async () => false, sendText: async (to, t) => { studioSays.push([to, t]); return true; },
    studioSay: (to, t) => (digitsOf(to) ? (studioSays.push([to, t]), Promise.resolve(true)) : Promise.resolve(false)), studioNoteSure: async (n) => { studioSays.push([n.phone, n.text]); return "sent"; },
    logEvent: async () => {}, founderCard: async () => {}, notifyJordanWa: async () => {}, appSecret: async () => "", sendOfferTemplate: async () => false,
    resolveRequestDate: O.resolveRequestDate, madridMidnight: O.madridMidnight, COPY: O.COPY, trSvc: O.trSvc, trSvcLow: C.trSvcLow, dayLabelFor: () => "Thursday 26 November", parseQuotedPrice: C.parseQuotedPrice, parseOfferedTimes: C.parseOfferedTimes, listedPrice: async () => null,
    OPEN_STAGES: ["new", "dispatching", "studio_asked", "studio_replied", "offered", "bidding"], heldNum: () => false, heldMail: () => false, FAKE_NUM_RE: /(^|\D)34600000\d{3}(\D|$)/, TEST_NAME_RE: /\b(test|prueba|uitest|mctest)\b/i,
    ...P,
  };
  const { fns } = sandbox([fo, one("LONG_EN"), one("LONG_ES"), lift(botSrc, "function offerDayFromText("), one("isSameDayReq"), liftArrow("reqDuration"), liftArrow("askedMins"), words].filter(Boolean), env, ["forwardOffer"]);
  const out = await fns.forwardOffer(req, { id: "p-1", business_name: "Estudio Uno" }, "row-1", "18:00", "[reenviado por Jordan, jueves 26 de noviembre] Sí, a las 18:00, 45€", "", {});
  check(G, "the offer email goes to the customer, nothing to the studio, the row claimed for the hour", [out, emails.length, studioSays.length, st.customer_offered_time, st.customer_offer_via, st.reply_text.startsWith("[reenviado por Jordan")], ["email", 1, 0, "18:00", "email", true]);
  const again = await fns.forwardOffer(req, { id: "p-1", business_name: "Estudio Uno" }, "row-1", "18:00", "[reenviado por Jordan, jueves 26 de noviembre] Sí, a las 18:00, 45€", "", {});
  check(G, "the same row and hour again: 'already', no second email, still nothing to the studio", [again, emails.length, studioSays.length], ["already", 1, 0]);
}

// ---------------------------------------------------------------------------
console.log(`relay: ${failures.length ? `${failures.length} of ${pass + failures.length} FAILING` : `all ${pass} pass`}`);
for (const f of failures) console.log(`\n  ${f.group}\n    input : ${f.input}\n    got   : ${JSON.stringify(f.got)}\n    want  : ${JSON.stringify(f.want)}${f.note ? `\n    note  : ${f.note}` : ""}`);
process.exit(failures.length ? 1 : 0);
