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
  const spies = { acceptOffer: 0, awardRequest: 0, ensureBooking: 0, awardWinner: 0, forwardOffer: 0, sendTemplate: 0, tellStudio: 0, studioNoteSure: 0, emailOffer: 0, withdraw: [] };
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
    relayStoredText: R.relayStoredText, relayRelativeWords: R.relayRelativeWords, relayNeedsEnglish: R.relayNeedsEnglish, relayReadText: R.relayReadText, relayActionWords: R.relayActionWords, RELAY_LABELS: R.RELAY_LABELS, OUR_LINE_RE: R.OUR_LINE_RE, STUDIO_FOLLOWS: R.STUDIO_FOLLOWS, RELAY_MAX_CANDS: R.RELAY_MAX_CANDS,
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
    awardWinner: async () => { spies.awardWinner++; return true; }, forwardOffer: async () => { spies.forwardOffer++; return "email"; }, sendTemplate: async () => { spies.sendTemplate++; return true; },
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
  const forward = async (text, extra = {}) => {
    const mode = extra.mode || o.mode || "test";
    const body = extra.voice ? `[voice note ${JORDAN}/1700000000000.ogg] ${text}` : text;
    db.t.wa_messages.push({ id: 7000 + db.t.wa_messages.length, phone: JORDAN, direction: "in", msg_type: "relayed", body, reply_id: null, created_at: iso(T.now) });
    if (extra.onlyLog) return;
    return fns.relayTurn({ from: JORDAN, msg: { type: extra.voice ? "audio" : "text", context: { forwarded: true } }, text, replyId: "", voice: extra.voice ? { path: `${JORDAN}/1700000000000.ogg`, transcript: text } : null, relayIn: true, mode });
  };
  const tap = (replyId, mode = o.mode || "test", msg = { type: "interactive" }) => fns.relayTurn({ from: JORDAN, msg, text: "", replyId, voice: null, relayIn: false, mode });
  const type = (text, mode = o.mode || "test", msg = { type: "text" }) => fns.relayTurn({ from: JORDAN, msg, text, replyId: "", voice: null, relayIn: false, mode });
  return { db, sent, spies, env, fns, calls, forward, tap, type, turn };
}
const lastTo = (w, to) => [...w.sent].reverse().find((s) => s.to === to);
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
      logMsg: async (phone, dir, body, type, reply) => { log.logged.push({ phone, dir, body, type, reply }); },
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
  check(G, "the list quotes the words, with English, and promises nothing goes out", [list?.body.includes('"Sí, a las 18:00, 45€"'), /\(EN: "EN\[/.test(list?.body || ""), /Nothing is sent to anyone\./.test(list?.body || ""), /TEST MODE/.test(list?.body || "")], [true, true, true, true]);
  const relayed = w.db.t.wa_messages.filter((m) => m.msg_type === "relayed");
  check(G, "the forward is frozen as listed", relayed.map((m) => m.reply_id), [`rly:${relayed[0].id}:listed`]);
  check(G, "the top row is the studio whose ask matches the hour", rows[0]?.title.startsWith("Estudio "), true);
  // Pick the test studio.
  const pick = rows.find((r) => r.title.startsWith("Estudio Prueba"));
  await w.tap(pick.id);
  const ext = w.db.t.wa_messages.filter((m) => m.msg_type === "external");
  check(G, "the words are saved in the studio's chat as external, unchanged", ext.map((m) => [m.phone, m.direction, m.body, m.reply_id]), [["34911000101", "in", "Sí, a las 18:00, 45€", `rly:${relayed[0].id}`]]);
  const card = lastTo(w, JORDAN);
  if (process.env.RELAY_SHOW) console.log(`\n--- list ---\n${list.body}\n${rows.map((r) => `  [${r.title}] ${r.description}`).join("\n")}\n--- studio card ---\n${card.body}\n  buttons: ${card.buttons.map((b) => b.title).join(" / ")}\n`);
  check(G, "the card: what was read, in English, and the buttons", [card?.kind, /I read: yes at the hour asked, 18:00; price 45 EUR\./.test(card?.body || ""), /\(EN: "EN\[/.test(card?.body || ""), (card?.buttons || []).map((b) => b.title)], ["buttons", true, true, ["Record yes", "Not theirs"]]);
  check(G, "the card says nothing is sent, and what may follow", [/Nothing is sent to the studio or the customer from here/.test(card?.body || ""), /The offer is not sent from here/.test(card?.body || "")], [true, true]);
  check(G, "no message to the studio or the customer, no write to the ask yet", [toOthers(w).length, w.db.writes("request_dispatch").length], [0, 0]);
  // Record yes.
  const yes = card.buttons.find((b) => b.title === "Record yes");
  await w.tap(yes.id);
  const row = w.db.t.request_dispatch.find((d) => d.id === TEST_ROW);
  check(G, "after one tap: accepted at 18:00 with 45, answered", [row.outcome, row.offered_time, row.quoted_price, !!row.replied_at, String(row.reply_text).startsWith("[reenviado por Jordan, jueves 26 de noviembre] ")], ["accepted", "18:00", 45, true, true]);
  check(G, "Jordan is told what was recorded; still nothing to anyone else", [/^Recorded for Estudio Prueba Norte on #9301: their yes at 18:00, with the price 45 EUR/.test(lastTo(w, JORDAN)?.body || ""), toOthers(w).length], [true, 0]);
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
  await b.forward("Hola", { onlyLog: true });
  await b.forward("a las 18:00 sí");
  await b.fns.relayTurn({ from: JORDAN, msg: { type: "text", context: { forwarded: true } }, text: "Hola", replyId: "", voice: null, relayIn: true, mode: "test" });
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
  check(G, "a contact card that is a studio's number: that studio's card, marked as checked", [/number checked from your contact card/.test(lastTo(se2, JORDAN).body || ""), se2.db.t.wa_messages.filter((m) => m.msg_type === "external").map((m) => m.phone)], [true, ["34911000101"]]);
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
  const card = lastTo(w, JORDAN);
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
  const cc = lastTo(c, JORDAN);
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
  check(G, "the relay block calls no booking or sending path", ["acceptOffer(", "awardRequest(", "ensureBooking(", "awardWinner(", "forwardOffer(", "sendTemplate(", "tellStudio(", "studioNoteSure(", "emailOffer(", "declineOffer(", "reshowOffer("].filter((f) => relayBlock.includes(f)), []);
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
  check(G, "the list body says nothing is sent and carries English", R.relayListBody({ n: 1, quote: "Sí", en: "Yes", mode: "on", ref: 7 }), 'Who wrote this? "Sí"\n(EN: "Yes")\n\nPick them and I will save it in their chat and show you what I read. Nothing is sent to anyone.\nRef R7');
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
    ["en", { price: 55 }, ["Hi Lucia", "Estudio Ejemplo (Chamberí)", "Thursday 26 November", "18:00", "relaxing massage, 60 minutes", "55 EUR (confirmed by the studio)"]],
    ["en", { listed: 55 }, ["Hi Lucia", "Estudio Ejemplo (Chamberí)", "Thursday 26 November", "18:00", "relaxing massage, 60 minutes", "about 55 EUR (the studio's listed price)"]],
    ["en", { firstName: "" }, ["Hi there", "Estudio Ejemplo (Chamberí)", "Thursday 26 November", "18:00", "relaxing massage, 60 minutes", "not confirmed yet"]],
    ["es", { price: 76.5 }, ["Hola Lucia", "Estudio Ejemplo (Chamberí)", "jueves 26 de noviembre", "18:00", "masaje relajante, 60 minutos", "76,50 € (confirmado por el centro)"]],
    ["es", { listed: 55, firstName: "" }, ["Hola", "Estudio Ejemplo (Chamberí)", "jueves 26 de noviembre", "18:00", "masaje relajante, 60 minutos", "unos 55 € (precio publicado del centro)"]],
    ["es", {}, ["Hola Lucia", "Estudio Ejemplo (Chamberí)", "jueves 26 de noviembre", "18:00", "masaje relajante, 60 minutos", "aún sin confirmar"]],
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
  check(G, "the submission examples use invented names", OT.offerTplSubmission("en").examples.slice(0, 2), ["Hi Lucy", "Example Studio (Chamberí)"]);
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
    T.now = M(12, 0);
    const log = { tell: [], mail: [], said: [], patches: [] };
    const row = { id: "row-1", request_id: 9601, partner_id: "p-1", phone: "34911000601", offered_time: "18:00", outcome: "won", channel: null, reply_text: "Sí", replied_at: iso(M(11, 0)), offered_at: iso(M(11, 0)), quoted_price: 50, discount_pct: null, ...rowOver };
    const req = { id: 9601, first_name: "Lucia", service_name: "Relaxing massage", day1: "Thursday 26 Nov, 18:00", time1: "18:00", proposed_time: "18:00", contact_email: "lucia@correo.invalid", client_phone: "+34699000601", languages: "en", stage: "confirmed", message_text: "", created_at: iso(M(9, 0)), confirmed_day: "Thursday 26 November", confirmed_time: "18:00", confirmed_start: iso(M(18, 0, 2)), partner_id: "p-1" };
    const env = {
      Date: FakeDate, SUPABASE_URL: "https://db.invalid", OPS_KEY: "k", H: () => ({}),
      fetch: async (u, opt = {}) => { u = String(u); if (opt.method === "PATCH") log.patches.push(u); if (u.includes("/request_dispatch?id=eq.") && !opt.method) return res(200, [row]); if (u.includes("/whatsapp_requests?id=eq.") && !opt.method) return res(200, [req]); return res(200, []); },
      digitsOf, partnerCard: async () => ({ business_name: "Estudio Uno", address: "Calle Inventada 1", phone: "", neighbourhood: "" }),
      tellStudio: async (...a) => { log.tell.push(a); return true; }, customerConfirmEmail: async (...a) => { log.mail.push(a); }, sendText: async (to, t) => { log.said.push(t); return true; },
      saveSession: async () => {}, founderCard: async () => {}, logEvent: async () => {}, notifyJordanWa: async () => {}, ensureBooking: async () => "tok",
      COPY: O.COPY, madridMidnight: O.madridMidnight, resolveRequestDate: O.resolveRequestDate, trSvc: O.trSvc, OPEN_STAGES: ["new", "dispatching", "studio_asked", "studio_replied", "offered", "bidding"], ...P,
    };
    const { fns } = sandbox(parts, env, ["acceptOffer"]);
    const booked = await fns.acceptOffer("row-1", "34699000601", "en", { phone: "34699000601", step: "await_offer", data: { offer: { row: "row-1" } } }, "whatsapp", {});
    return { booked, log };
  };
  const again = await run();
  check(G, "a second Yes on the confirmed booking (email Yes, then the template's): it stands, nothing to anyone", [again.booked, again.log.tell.length, again.log.mail.length, again.log.said.length, again.log.patches.length], [true, 0, 0, 0, 0], "before: the studio was told 'acepta el cambio' and the customer confirmed again");
  const moved = await run({ id: "row-1", offered_time: "18:30", outcome: "accepted" });
  check(G, "a real time change still goes through", [moved.booked, moved.log.tell.length], [true, 1]);
}

// ---------------------------------------------------------------------------
console.log(`relay: ${failures.length ? `${failures.length} of ${pass + failures.length} FAILING` : `all ${pass} pass`}`);
for (const f of failures) console.log(`\n  ${f.group}\n    input : ${f.input}\n    got   : ${JSON.stringify(f.got)}\n    want  : ${JSON.stringify(f.want)}${f.note ? `\n    note  : ${f.note}` : ""}`);
process.exit(failures.length ? 1 : 0);
