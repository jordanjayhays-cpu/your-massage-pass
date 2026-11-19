// The consent edge function (the consent rule, 20 Nov 2026).
//
// Every booking path asks "Can Massage Club send you offers ...?" and the
// answer goes to supabase/functions/consent, which writes one row in
// marketing_optins. On 19 Nov the website's opt-in saved into a table that did
// not exist and said "Done" anyway; these checks make sure an answer is either
// written or loudly reported, never lost in silence, that it is tied to the
// person on the server (the approved words, the request or booking it came
// with), and that an unsubscribe stops every address of theirs and never puts
// the address in the link.
//
// The function is run for real (types stripped, imported) with fetch stubbed
// by a tiny in-memory REST table store: nothing touches a database, Resend or
// the network. Invented addresses only (the repo is public).
//
// Run: node tests/consent.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const fnPath = path.join(root, "supabase/functions/consent/index.ts");

let pass = 0;
const failures = [];
function check(group, input, got, want, note = "") {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else failures.push({ group, input, got, want, note });
}
const DASH_RE = /[‒-―−]/;

// ---------------------------------------------------------------------------
// A small stand-in for the REST API: tables of rows, the filters the function
// uses (eq, ilike, not.is.null, gte, in, or=(...)), and inserts.
// ---------------------------------------------------------------------------
const NOW = Date.now();
const DB = { whatsapp_requests: [], bookings: [], marketing_optins: [] };
function resetDb() { for (const k of Object.keys(DB)) DB[k] = []; }
function matchOne(row, col, op, val) {
  const v = row[col];
  if (op === "eq") return String(v ?? "") === val;
  if (op === "ilike") return String(v ?? "").toLowerCase() === val.toLowerCase();
  if (op === "gte") return col === "created_at" ? Date.parse(v || 0) >= Date.parse(val) : String(v) >= val;
  if (op === "not.is") return v !== null && v !== undefined;
  if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(v ?? ""));
  return false;
}
function rest(url, o) {
  const u = new URL(url);
  const table = u.pathname.replace("/rest/v1/", "");
  if (!(table in DB)) return { status: 404, body: { code: "42P01" } };
  if ((o.method || "GET") === "POST") {
    const body = JSON.parse(o.body);
    for (const r of Array.isArray(body) ? body : [body]) DB[table].push({ id: DB[table].length + 1, created_at: new Date().toISOString(), ...r });
    return { status: 201, body: "" };
  }
  let rows = DB[table].slice();
  for (const [k, raw] of u.searchParams) {
    if (["select", "limit", "order"].includes(k)) continue;
    if (k === "or") {
      const parts = raw.replace(/^\(|\)$/g, "").split(",").map((p) => { const [col, op, ...rest2] = p.split("."); return [col, op, rest2.join(".")]; });
      rows = rows.filter((r) => parts.some(([c, op, v]) => matchOne(r, c, op, v)));
      continue;
    }
    if (raw.startsWith("not.is.")) { rows = rows.filter((r) => matchOne(r, k, "not.is")); continue; }
    const dot = raw.indexOf(".");
    rows = rows.filter((r) => matchOne(r, k, raw.slice(0, dot), raw.slice(dot + 1)));
  }
  const lim = Number(u.searchParams.get("limit") || 0);
  return { status: 200, body: lim ? rows.slice(0, lim) : rows };
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
const KEY = "test-sign-key-not-a-secret-0123456789";
const env = { MC_SIGN_KEY: KEY, RESEND_API_KEY: "re_test", SUPABASE_SERVICE_ROLE_KEY: "svc" };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: () => {} };
let route = async () => ({ status: 500, body: "" });
const calls = [];
globalThis.fetch = async (u, o = {}) => {
  const url = String(u);
  calls.push({ url, method: o.method || "GET", body: o.body ? JSON.parse(o.body) : null, headers: o.headers || {} });
  const r = await route(url, o);
  const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
  return new Response(body, { status: r.status });
};
let C = null, S = null;
const src = fs.existsSync(fnPath) ? fs.readFileSync(fnPath, "utf8") : "";
const statusPath = path.join(root, "supabase/functions/consent/status.ts");
const statusSrc = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, "utf8") : "";
if (src) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-consent-"));
  const file = path.join(tmp, "consent.mjs");
  fs.writeFileSync(file, stripTypeScriptTypes(src));
  C = await import(pathToFileURL(file).href);
  if (statusSrc) {
    fs.writeFileSync(path.join(tmp, "status.mjs"), stripTypeScriptTypes(statusSrc));
    S = await import(pathToFileURL(path.join(tmp, "status.mjs")).href);
  }
}
check("load", "supabase/functions/consent/index.ts", !!C, true, "the function file exists and loads");
check("load", "supabase/functions/consent/status.ts", !!S, true, "the shared sender check exists and loads");

const ORIGIN = "https://book.massageclub.io";
const post = (body, o = {}) => new Request("https://fn.invalid/consent", {
  method: o.method || "POST",
  headers: { "Content-Type": "application/json", ...(o.origin === null ? {} : { origin: o.origin || ORIGIN }), ...(o.ip ? { "x-forwarded-for": o.ip } : {}), ...(o.jwt ? { authorization: `Bearer ${o.jwt}` } : {}) },
  body: o.method === "GET" || o.method === "OPTIONS" ? undefined : (typeof body === "string" ? body : JSON.stringify(body)),
});
const inserts = () => calls.filter((c) => c.url.endsWith("/rest/v1/marketing_optins") && c.method === "POST");
const rowsOf = (c) => (c ? (Array.isArray(c.body) ? c.body : [c.body]) : []);
const alerts = () => calls.filter((c) => c.url === "https://api.resend.com/emails");
const okRoutes = (extra = {}) => async (url, o) => {
  if (url.includes("/rest/v1/bookings?action_token")) return extra.bookings || { status: 200, body: [] };
  if (url.endsWith("/rest/v1/marketing_optins") && extra.insert) return extra.insert;
  if (extra.read && url.includes("/rest/v1/") && (o.method || "GET") === "GET") { const r = extra.read(url); if (r) return r; }
  if (url.includes("/rest/v1/")) return rest(url, o);
  if (url.endsWith("/auth/v1/user")) {
    if (extra.auth) return extra.auth;
    const jwt = String((o.headers || {}).Authorization || "").replace(/^Bearer /, "");
    return jwt === "jwt-of-cliente-once" ? { status: 200, body: { id: "11111111-2222-3333-4444-555555555555", email: "Cliente.Once@Correo.invalid" } } : { status: 401, body: { msg: "invalid JWT" } };
  }
  if (url === "https://api.resend.com/emails") return { status: 200, body: { id: "x" } };
  return { status: 404, body: "" };
};
async function run(body, o = {}, routes = okRoutes()) {
  calls.length = 0;
  route = routes;
  if (C?._test) C._test.resetThrottle();
  const res = await C.handleRequest(post(body, o));
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* empty */ }
  return { status: res.status, json, headers: res.headers };
}
const ago = (ms) => new Date(NOW - ms).toISOString();
const addRequest = (r) => DB.whatsapp_requests.push({ created_at: ago(5 * 60e3), ...r });
const addBooking = (r) => DB.bookings.push({ created_at: ago(5 * 60e3), ...r });

const WORD_EN = "Can Massage Club send you offers and reminders to book again, by email and WhatsApp? You can stop any time with one tap, or by writing to support@massageclub.io.";
const WORD_ES = "¿Puede Massage Club enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp? Puedes darte de baja cuando quieras con un toque o escribiendo a support@massageclub.io.";
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

if (C) {
  // -------------------------------------------------------------------------
  // 1. A yes and a no each write one row, with the exact words and language,
  //    tied to the request or booking they came with.
  // -------------------------------------------------------------------------
  {
    const G = "1 yes and no rows";
    resetDb();
    addRequest({ id: 512, contact_email: "Cliente.Uno@Correo.invalid", client_phone: "+34600111222" });
    const r = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "  Cliente.Uno@Correo.invalid ", phone: "+34 600 111 222", request_id: 512 }, { ip: "203.0.113.9, 10.0.0.1" });
    check(G, "yes: answer", [r.status, r.json], [200, { ok: true }]);
    check(G, "yes: CORS for the site", r.headers.get("access-control-allow-origin"), ORIGIN);
    const row = rowsOf(inserts()[0])[0] || {};
    check(G, "yes: one insert", inserts().length, 1);
    check(G, "yes: the row", { email: row.email, phone: row.phone, source: row.source, action: row.action, wording: row.wording, lang: row.wording_lang, request_id: row.request_id, channel: row.channel, booking_ref: row.booking_ref },
      { email: "cliente.uno@correo.invalid", phone: "34600111222", source: "go_page", action: "yes", wording: WORD_EN, lang: "en", request_id: 512, channel: "email+whatsapp", booking_ref: null }, "email lowercased, phone digits only");
    check(G, "yes: ip kept only as a keyed hash", /^[0-9a-f]{32}$/.test(String(row.ip_hash)) && !JSON.stringify(row).includes("203.0.113.9"), true);
    check(G, "yes: service role writes", inserts()[0]?.headers?.Authorization, "Bearer svc");
    check(G, "yes: the request was read by its id", calls.some((c) => c.url.includes("/rest/v1/whatsapp_requests?id=eq.512")), true);
    check(G, "yes: no alert", alerts().length, 0);
    addBooking({ id: UUID, booking_ref: "sb-77", client_email: "cliente.dos@correo.invalid", client_phone: null });
    const n = await run({ choice: "no", source: "studio_booking", wording: WORD_ES, lang: "es", email: "cliente.dos@correo.invalid", booking_ref: "sb-77" });
    const nrow = rowsOf(inserts()[0])[0] || {};
    check(G, "no: answer", [n.status, n.json], [200, { ok: true }]);
    check(G, "no: the row", [nrow.action, nrow.source, nrow.wording, nrow.wording_lang, nrow.booking_ref, nrow.phone], ["no", "studio_booking", WORD_ES, "es", "sb-77", null]);
    const byId = await run({ choice: "yes", source: "studio_booking", wording: WORD_EN, lang: "en", email: "cliente.dos@correo.invalid", booking_ref: UUID });
    check(G, "a booking named by its id (what the studio page sends)", [byId.status, rowsOf(inserts()[0])[0]?.booking_ref], [200, "sb-77"]);
    addRequest({ id: 600, contact_email: null, client_phone: "+34600333444" });
    const p = await run({ choice: "yes", source: "studio_request", wording: WORD_EN, lang: "en", phone: "34 600 333 444" });
    check(G, "phone only, no request id: matched to a request made just now", [p.status, rowsOf(inserts()[0])[0]?.phone, rowsOf(inserts()[0])[0]?.email, rowsOf(inserts()[0])[0]?.request_id], [200, "34600333444", null, 600]);
    addRequest({ id: 601, contact_email: "cliente.tres.b@correo.invalid", client_phone: "+34600444555" });
    const local = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente.tres.b@correo.invalid", phone: "600 444 555", request_id: 601 });
    check(G, "a phone typed without its country code still matches", [local.status, rowsOf(inserts()[0])[0]?.phone], [200, "34600444555"]);
    const lang = await run({ choice: "yes", source: "go_page", wording: WORD_ES, lang: "en", email: "cliente.tres.b@correo.invalid", request_id: 601 });
    check(G, "the saved language is the language of the words shown", [lang.status, rowsOf(inserts()[0])[0]?.wording_lang], [200, "es"]);
    const quiz = await run({ choice: "yes", source: "quiz", wording: WORD_EN, lang: "en", email: "cliente.quiz@correo.invalid" });
    check(G, "quiz: saved as given (canMarket does not count it)", [quiz.status, rowsOf(inserts()[0])[0]?.source], [200, "quiz"]);
    // profile: the signed-in account says who this is
    const pr = await run({ choice: "yes", source: "profile", wording: WORD_EN, lang: "en", email: "cliente.once@correo.invalid", phone: "34600121212" }, { jwt: "jwt-of-cliente-once" });
    const prow = rowsOf(inserts()[0])[0] || {};
    check(G, "profile with the session: the account's email and id, not the body's phone", [pr.status, prow.email, prow.user_id, prow.phone, prow.source], [200, "cliente.once@correo.invalid", "11111111-2222-3333-4444-555555555555", null, "profile"]);
    const pn = await run({ choice: "yes", source: "profile", wording: WORD_EN, lang: "en", email: "cliente.once@correo.invalid" });
    check(G, "profile with no session: 403, nothing written", [pn.status, pn.json?.error, inserts().length], [403, "session", 0]);
    const pw = await run({ choice: "yes", source: "profile", wording: WORD_EN, lang: "en", email: "otra@correo.invalid" }, { jwt: "jwt-of-cliente-once" });
    check(G, "profile naming another address than the account's: 403", [pw.status, pw.json?.error, inserts().length], [403, "not_linked", 0]);
    const pd = await run({ choice: "yes", source: "profile", wording: WORD_EN, lang: "en", email: "cliente.once@correo.invalid" }, { jwt: "jwt-of-cliente-once" }, okRoutes({ auth: { status: 502, body: "" } }));
    check(G, "Auth unreachable: 500 and Jordan told", [pd.status, inserts().length, alerts().length], [500, 0, 1]);
  }

  // -------------------------------------------------------------------------
  // 2. The review page sends a booking token; the booking says who it is.
  // -------------------------------------------------------------------------
  {
    const G = "2 token lookup";
    const booking = { status: 200, body: [{ booking_ref: "wa-901", client_email: "Cliente.Tres@Correo.invalid", client_phone: "+34600555666", client_name: "Cliente Tres" }] };
    const r = await run({ choice: "yes", source: "review_page", wording: WORD_ES, lang: "es", token: "tok_abcdef123456", email: "otra.persona@correo.invalid" }, {}, okRoutes({ bookings: booking }));
    const look = calls.find((c) => c.url.includes("/rest/v1/bookings?action_token"));
    check(G, "looked up by action_token", !!look && look.url.includes("action_token=eq.tok_abcdef123456"), true);
    const row = rowsOf(inserts()[0])[0] || {};
    check(G, "the booking's email, phone and ref, never the browser's", [r.status, row.email, row.phone, row.booking_ref, row.source], [200, "cliente.tres@correo.invalid", "34600555666", "wa-901", "review_page"]);
    const u = await run({ choice: "yes", source: "review_page", wording: WORD_ES, lang: "es", token: "tok_unknown12345" });
    check(G, "unknown token: 404, nothing written, no alert", [u.status, u.json?.error, inserts().length, alerts().length], [404, "unknown_token", 0, 0]);
    const m = await run({ choice: "yes", source: "review_page", wording: WORD_ES, token: "bad token!" });
    check(G, "malformed token: 400", [m.status, inserts().length], [400, 0]);
    const nt = await run({ choice: "yes", source: "review_page", wording: WORD_ES, email: "otra.persona@correo.invalid" });
    check(G, "the review page without its token: 400", [nt.status, nt.json?.error, inserts().length], [400, "token", 0]);
    const f = await run({ choice: "yes", source: "review_page", wording: WORD_ES, lang: "es", token: "tok_abcdef123456" }, {}, okRoutes({ bookings: { status: 503, body: "down" } }));
    check(G, "bookings unreadable: 500 and one alert", [f.status, f.json, inserts().length, alerts().length], [500, { ok: false }, 0, 1]);
  }

  // -------------------------------------------------------------------------
  // 3. Bad input is refused before anything is written.
  // -------------------------------------------------------------------------
  {
    const G = "3 bad input";
    resetDb();
    addRequest({ id: 700, contact_email: "cliente@correo.invalid", client_phone: "+34600999000" });
    const base = { choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente@correo.invalid" };
    const cases = [
      ["choice maybe", { ...base, choice: "maybe" }, 400],
      ["choice missing", { ...base, choice: undefined }, 400],
      ["source unknown", { ...base, source: "website" }, 400],
      ["source unsubscribe is the withdraw path's", { ...base, source: "unsubscribe" }, 400],
      ["source bot is wa-bot's own (the WhatsApp sender is its proof)", { ...base, source: "bot" }, 400],
      ["wording empty", { ...base, wording: "  " }, 400],
      ["wording missing", { ...base, wording: undefined }, 400],
      ["wording too long", { ...base, wording: "x".repeat(2001) }, 400],
      ["no email or phone", { ...base, email: undefined }, 400],
      ["bad email", { ...base, email: "not-an-email" }, 400],
      ["bad phone", { ...base, email: undefined, phone: "12" }, 400],
      ["bad request_id", { ...base, request_id: "abc" }, 400],
      ["bad booking_ref", { ...base, booking_ref: "<script>" }, 400],
      ["unknown action", { ...base, action: "delete" }, 400],
    ];
    for (const [name, body, want] of cases) {
      const r = await run(body);
      check(G, name, [r.status, r.json?.ok, inserts().length, alerts().length], [want, false, 0, 0]);
    }
    const w = await run({ ...base, wording: "Do you want offers? Yes / No" });
    check(G, "words that are not the approved notice: refused, Jordan told once", [w.status, w.json?.error, inserts().length, alerts().length, /refused/.test(alerts()[0]?.body?.subject || "")], [400, "wording", 0, 1, true]);
    const w2 = await run({ ...base, wording: WORD_EN.replace("offers", "deals") });
    check(G, "a one-word change is refused too", [w2.status, inserts().length], [400, 0]);
    const j = await run("{not json");
    check(G, "not JSON", [j.status, inserts().length], [400, 0]);
    const arr = await run([1, 2]);
    check(G, "an array", [arr.status, inserts().length], [400, 0]);
    const big = await run({ ...base, wording: "x".repeat(20000) });
    check(G, "a huge body", [big.status, inserts().length], [413, 0]);
    const g = await run(null, { method: "GET" });
    check(G, "GET is not used (link scanners)", [g.status, inserts().length], [405, 0]);
    const other = await run(base, { origin: "https://evil.invalid" });
    check(G, "another site's page", [other.status, inserts().length, other.headers.get("access-control-allow-origin")], [403, 0, null]);
    const pre = await run(null, { method: "OPTIONS", origin: "https://your-massage-pass-o5fo.vercel.app" });
    check(G, "preflight from the Vercel site", [pre.status, pre.headers.get("access-control-allow-origin"), /POST/.test(pre.headers.get("access-control-allow-methods") || "")], [204, "https://your-massage-pass-o5fo.vercel.app", true]);
    const none = await run(base, { origin: null });
    check(G, "an answer with no Origin (a script, not the site's page): 403", [none.status, none.json?.error, inserts().length], [403, "origin", 0]);
  }

  // -------------------------------------------------------------------------
  // 4. An answer must belong to the request or booking it came with.
  // -------------------------------------------------------------------------
  {
    const G = "4 tied to a request or booking";
    resetDb();
    addRequest({ id: 801, contact_email: "cliente.real@correo.invalid", client_phone: "+34600800801" });
    const someone = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "otra.victima@correo.invalid" });
    check(G, "a yes for an address with no request: 403, nothing written, no alert", [someone.status, someone.json?.error, inserts().length, alerts().length], [403, "not_linked", 0, 0], "anyone could otherwise save a yes for anyone, and undo a withdrawal");
    const wrong = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "otra.victima@correo.invalid", request_id: 801 });
    check(G, "another person's request id: 403, Jordan told (the page named a request)", [wrong.status, inserts().length, alerts().length], [403, 0, 1]);
    const half = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente.real@correo.invalid", phone: "+34 699 999 999", request_id: 801 });
    const hrow = rowsOf(inserts()[0])[0] || {};
    check(G, "only the addresses the request carries are saved", [half.status, hrow.email, hrow.phone], [200, "cliente.real@correo.invalid", null], "a mistyped or someone else's phone is not given a yes");
    DB.whatsapp_requests.push({ id: 802, contact_email: "cliente.vieja@correo.invalid", client_phone: null, created_at: ago(2 * 86400e3) });
    const old = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente.vieja@correo.invalid" });
    check(G, "a request from two days ago without its id: not matched", [old.status, inserts().length], [403, 0]);
    const oldId = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente.vieja@correo.invalid", request_id: 802 });
    check(G, "the same request named by its id (within 7 days): matched", [oldId.status, rowsOf(inserts()[0])[0]?.request_id], [200, 802]);
    const down = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente.real@correo.invalid", request_id: 801 }, {}, okRoutes({ read: (u) => (u.includes("whatsapp_requests") ? { status: 503, body: "down" } : null) }));
    check(G, "requests unreadable: 500, Jordan told, nothing written", [down.status, down.json, inserts().length, alerts().length], [500, { ok: false }, 0, 1]);
    const many = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));
    const rate = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente.real@correo.invalid", request_id: 801 }, { ip: "198.51.100.7" }, okRoutes({ read: (u) => (u.includes("marketing_optins?ip_hash") ? { status: 200, body: many } : null) }));
    check(G, "30 answers from one IP in an hour: 429", [rate.status, rate.json?.error, inserts().length], [429, "rate", 0]);
  }

  // -------------------------------------------------------------------------
  // 5. A failed insert is never silent: 500 and one email to Jordan.
  // -------------------------------------------------------------------------
  {
    const G = "5 failed insert";
    resetDb();
    addRequest({ id: 404, contact_email: "cliente.cuatro@correo.invalid", client_phone: null });
    const r = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente.cuatro@correo.invalid", request_id: 404 }, {}, okRoutes({ insert: { status: 404, body: { code: "42P01", message: "relation \"public.marketing_optins\" does not exist" } } }));
    check(G, "500 { ok: false }", [r.status, r.json], [500, { ok: false }], "the page shows its error line, never Done");
    check(G, "exactly one founder alert", alerts().length, 1);
    const a = alerts()[0]?.body || {};
    check(G, "to jordan@massageclub.io", a.to, ["jordan@massageclub.io"]);
    check(G, "the alert says what and why", [/NOT saved/.test(a.subject || ""), /42P01/.test(a.text || ""), /cliente\.cuatro@correo\.invalid/.test(a.text || ""), /#404/.test(a.text || "")], [true, true, true, true]);
    check(G, "no em dash in the alert", DASH_RE.test(String(a.subject) + String(a.text)), false);
    const t = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente.cuatro@correo.invalid", request_id: 404 }, {}, async (url, o) => { if (url.endsWith("/rest/v1/marketing_optins")) throw new Error("network down"); if (url.includes("/rest/v1/")) return rest(url, o); return { status: 200, body: {} }; });
    check(G, "a network error too", [t.status, alerts().length], [500, 1]);
  }

  // -------------------------------------------------------------------------
  // 6. Test contacts are recorded, flagged, and never alerted about.
  // -------------------------------------------------------------------------
  {
    const G = "6 test contacts";
    resetDb();
    const fail = okRoutes({ insert: { status: 500, body: "boom" } });
    const tests = [
      ["Jordan's address", { email: "jordan@massageclub.io" }],
      ["an example.com address", { email: "someone@example.com" }],
      ["a +mctest address", { email: "persona+mctest1@correo.invalid" }],
      ["Jordan's US number", { phone: "+1 562 235 5063" }],
      ["Cata", { phone: "+1 786 727 6503" }],
      ["Yi", { phone: "+86 152 7385 5997" }],
      ["a canary number", { phone: "34600000123" }],
    ];
    let id = 900;
    for (const [name, who] of tests) {
      addRequest({ id: ++id, contact_email: who.email || null, client_phone: who.phone ? "+" + who.phone.replace(/\D/g, "") : null });
      const ok = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", request_id: id, ...who });
      check(G, `${name}: recorded and flagged`, [ok.status, ok.json, inserts().length], [200, { ok: true, test: true }, 1]);
      const bad = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", request_id: id, ...who }, {}, fail);
      check(G, `${name}: a failure is not alerted`, [bad.status, alerts().length], [500, 0]);
    }
    const tok = await run({ choice: "no", source: "review_page", wording: WORD_EN, token: "tok_testname1234" }, {}, okRoutes({ bookings: { status: 200, body: [{ booking_ref: "wa-1", client_email: "persona@correo.invalid", client_name: "Prueba Uno" }] }, insert: { status: 500, body: "boom" } }));
    check(G, "a booking named Prueba: not alerted", [tok.status, alerts().length], [500, 0]);
    check(G, "a real address is not a test contact", C.isTestContact({ email: "cliente@correo.invalid", phone: "34600111222", name: "Ana" }), false);
  }

  // -------------------------------------------------------------------------
  // 7. Withdraw: a sealed, signed link, POST only, every address of theirs.
  // -------------------------------------------------------------------------
  {
    const G = "7 withdraw";
    resetDb();
    const em = "Cliente.Seis@Correo.invalid";
    const url = await C.unsubscribeUrl(em, KEY);
    const parsed = new URL(url);
    const tok = parsed.searchParams.get("u");
    const s = parsed.searchParams.get("s");
    const frag = new URLSearchParams(parsed.hash.slice(1));
    check(G, "the link is massageclub.io", `${parsed.origin}${parsed.pathname}`, "https://book.massageclub.io/unsubscribe");
    check(G, "the address is not in the link (no @, no digits, not the name)", [/@|%40/.test(url.split("?")[1]), /\d/.test(tok), /cliente|seis|correo/i.test(tok)], [false, false, false], "the link is in every email, server logs and the page's analytics");
    check(G, "the same token in the fragment and the query (either page version reads it)", [frag.get("u") === tok, frag.get("s") === s], [true, true]);
    check(G, "signature = first 32 hex of HMAC-SHA256(MC_SIGN_KEY, u)", s, (await import("node:crypto")).createHmac("sha256", KEY).update(tok).digest("hex").slice(0, 32), "the contract the unsubscribe page and senders share");
    check(G, "a fresh token each time", (await C.unsubscribeUrl(em, KEY)) === url, false);
    check(G, "the token opens to the address with the key only", [await C.openContact(tok, KEY), await C.openContact(tok, "another-key-entirely-0000")], ["cliente.seis@correo.invalid", null]);
    const r = await run({ action: "withdraw", u: tok, s });
    const row = rowsOf(inserts()[0])[0] || {};
    check(G, "good link: written", [r.status, r.json, row.action, row.source, row.email, row.phone, row.channel], [200, { ok: true }, "withdraw", "unsubscribe", "cliente.seis@correo.invalid", null, "email+whatsapp"]);
    check(G, "wording recorded", typeof row.wording === "string" && row.wording.length > 10 && !DASH_RE.test(row.wording), true);
    const noOrigin = await run({ action: "withdraw", u: tok, s }, { origin: null });
    check(G, "a signed withdrawal needs no Origin (a mail client's own unsubscribe)", noOrigin.status, 200);
    // every address of theirs
    resetDb();
    DB.marketing_optins.push({ id: 1, email: "cliente.siete@correo.invalid", phone: "34600777000", action: "yes", source: "go_page" });
    addRequest({ id: 1001, contact_email: "Cliente.Siete@Correo.invalid", client_phone: "+34600777111" });
    addBooking({ id: UUID, booking_ref: "sb-1", client_email: "cliente.siete@correo.invalid", client_phone: "+34600777222" });
    const u7 = new URL(await C.unsubscribeUrl("cliente.siete@correo.invalid", KEY));
    const lr = await run({ action: "withdraw", u: u7.searchParams.get("u"), s: u7.searchParams.get("s") });
    const lrows = rowsOf(inserts()[0]);
    check(G, "an email link also withdraws every phone seen with it", [lr.status, inserts().length, lrows.map((x) => x.email || x.phone)], [200, 1, ["cliente.siete@correo.invalid", "34600777000", "34600777111", "34600777222"]], "the page promises 'by email or WhatsApp'");
    check(G, "all withdraw rows, one insert", lrows.every((x) => x.action === "withdraw" && x.source === "unsubscribe"), true);
    resetDb();
    DB.marketing_optins.push({ id: 1, email: "cliente.ocho@correo.invalid", phone: "34600888000", action: "yes", source: "go_page" });
    const ph = "34600888000";
    const up = new URL(await C.unsubscribeUrl("+" + ph, KEY));
    const rp = await run({ action: "withdraw", u: up.searchParams.get("u"), s: up.searchParams.get("s"), lang: "es" });
    check(G, "a phone link, in Spanish, also withdraws the email", [rp.status, rowsOf(inserts()[0]).map((x) => x.email || x.phone), rowsOf(inserts()[0])[0]?.wording_lang], [200, [ph, "cliente.ocho@correo.invalid"], "es"]);
    const lookDown = await run({ action: "withdraw", u: up.searchParams.get("u"), s: up.searchParams.get("s") }, {}, okRoutes({ read: (u) => (u.includes("whatsapp_requests") ? { status: 503, body: "down" } : null) }));
    check(G, "linked lookup down: the address in the link is still saved, Jordan told", [lookDown.status, inserts().length, alerts().length, /other addresses could not be looked up/.test(alerts()[0]?.body?.text || "")], [200, 1, 1, true]);
    // the old form: a plain address, signed normalised
    const plain = await C.signContact(em, KEY);
    const nodeSig = (await import("node:crypto")).createHmac("sha256", KEY).update("cliente.seis@correo.invalid").digest("hex").slice(0, 32);
    check(G, "a plain address is still accepted when signed normalised", [plain === nodeSig, (await run({ action: "withdraw", u: em, s: plain })).status], [true, 200]);
    const bad = await run({ action: "withdraw", u: tok, s: "0".repeat(32) });
    check(G, "bad signature: 403, nothing written", [bad.status, inserts().length], [403, 0]);
    const flip = tok.slice(0, -1) + (tok.endsWith("a") ? "b" : "a");
    const tampered = await run({ action: "withdraw", u: flip, s: await C.signToken(flip, "another-key-entirely-0000") });
    check(G, "a token changed or signed with another key: 403", [tampered.status, inserts().length], [403, 0]);
    const swapped = await run({ action: "withdraw", u: "otra@correo.invalid", s: plain });
    check(G, "someone else's address with this signature: 403, Jordan told once", [swapped.status, inserts().length, alerts().length], [403, 0, 1]);
    const short = await run({ action: "withdraw", u: tok, s: s.slice(0, 20) });
    check(G, "short signature: 403", [short.status, inserts().length], [403, 0]);
    const nou = await run({ action: "withdraw", s });
    check(G, "no address: 400", [nou.status, inserts().length], [400, 0]);
    const f = await run({ action: "withdraw", u: tok, s }, {}, okRoutes({ insert: { status: 500, body: "boom" } }));
    check(G, "a withdraw that cannot be written: 500 and one alert", [f.status, alerts().length, /unsubscribe/i.test(alerts()[0]?.body?.text || "")], [500, 1, true]);
    // the page with no link: the address the person types
    resetDb();
    DB.marketing_optins.push({ id: 1, email: "cliente.doce@correo.invalid", phone: "34600121200", action: "yes", source: "go_page" });
    const ts = await run({ action: "stop", u: " Cliente.Doce@Correo.invalid ", lang: "es", wording: "Escribe el email o el número de WhatsApp al que te escribimos" });
    check(G, "typed stop: withdrawn for the address and its phone", [ts.status, ts.json, rowsOf(inserts()[0]).map((x) => [x.action, x.source, x.email || x.phone, x.wording_lang])], [200, { ok: true }, [["withdraw", "unsubscribe", "cliente.doce@correo.invalid", "es"], ["withdraw", "unsubscribe", "34600121200", "es"]]]);
    const tsPhone = await run({ action: "stop", u: "34600555000" });
    check(G, "typed stop by phone, unknown to us: one do-not-contact row", [tsPhone.status, rowsOf(inserts()[0]).map((x) => x.phone)], [200, ["34600555000"]]);
    check(G, "typed stop needs the site's page (Origin)", (await run({ action: "stop", u: "34600555000" }, { origin: null })).status, 403);
    check(G, "typed stop with nothing usable: 400", [(await run({ action: "stop", u: "hola" })).status, inserts().length], [400, 0]);
    const tsRate = await run({ action: "stop", u: "34600555000" }, { ip: "198.51.100.8" }, okRoutes({ read: (u) => (u.includes("marketing_optins?ip_hash") ? { status: 200, body: Array.from({ length: 30 }, (_, i) => ({ id: i })) } : null) }));
    check(G, "typed stop: 30 an hour from one IP at most", [tsRate.status, inserts().length], [429, 0]);
    let threw = false; try { await C.unsubscribeUrl(em, ""); } catch { threw = true; }
    check(G, "unsubscribeUrl refuses without a key (no promotion without a link)", threw, true);
    // promotional email parts
    const pp = await C.promoParts("cliente.nueve@correo.invalid", "es", "Oferta de otoño", "Texto.", KEY);
    check(G, "promoParts: 'Publicidad' first, the link and the support address", [pp.subject, pp.text.includes(pp.unsubscribe), /support@massageclub\.io/.test(pp.text), /cliente\.nueve/.test(pp.unsubscribe)], ["Publicidad: Oferta de otoño", true, true, false], "LSSI art. 20.1 and 22.1");
    let pthrew = false; try { await C.promoParts("cliente.nueve@correo.invalid", "en", "x", "y", ""); } catch { pthrew = true; }
    check(G, "promoParts refuses without a key", pthrew, true);
  }
}

// -------------------------------------------------------------------------
// 8. status.ts: who may get a promotion.
// -------------------------------------------------------------------------
if (S) {
  const G = "8 canMarket";
  const st = (rows) => async (url) => {
    const u = new URL(url);
    const kind = (u.searchParams.get("kind") || "").replace("eq.", "");
    const list = (u.searchParams.get("contact") || "").replace(/^in\.\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
    return { ok: true, status: 200, json: async () => rows.filter((r) => r.kind === kind && list.includes(r.contact)) };
  };
  const down = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const E = "cliente.diez@correo.invalid", P = "34600100100";
  const yesE = { kind: "email", contact: E, action: "yes", source: "go_page" };
  const yesP = { kind: "phone", contact: P, action: "yes", source: "bot" };
  const can = (c, rows) => S.canMarket("https://db.invalid", {}, c, rows === null ? down : st(rows));
  check(G, "a verified yes on every address: yes", await can({ emails: [E], phones: [P] }, [yesE, yesP]), true);
  check(G, "one address withdrawn: no", await can({ emails: [E], phones: [P] }, [yesE, { ...yesP, action: "withdraw" }]), false);
  check(G, "one address not answered: no", await can({ emails: [E], phones: [P] }, [yesE]), false);
  check(G, "a yes from the quiz (no proof the address is theirs): no", await can({ emails: [E] }, [{ ...yesE, source: "quiz" }]), false);
  check(G, "a yes from the signed-in profile: yes", await can({ emails: [E] }, [{ ...yesE, source: "profile" }]), true);
  check(G, "status unreadable: no", await can({ emails: [E] }, null), false);
  check(G, "no address at all: no", await can({}, [yesE]), false);
  check(G, "a test contact with a yes: no", await can({ emails: ["persona@example.com"] }, [{ ...yesE, contact: "persona@example.com" }]), false);
  check(G, "addresses are normalised (case, +, spaces)", await can({ emails: [" Cliente.Diez@Correo.INVALID"], phones: ["+34 600 100 100"] }, [yesE, yesP]), true);
  const blocked = (c, rows) => S.marketingBlocked("https://db.invalid", {}, c, rows === null ? down : st(rows));
  check(G, "marketingBlocked: a withdraw on any address", await blocked({ emails: [E], phones: [P] }, [yesE, { ...yesP, action: "withdraw" }]), true);
  check(G, "marketingBlocked: a no", await blocked({ phones: [P] }, [{ ...yesP, action: "no" }]), true);
  check(G, "marketingBlocked: not answered is not blocked", await blocked({ phones: [P] }, []), false);
  check(G, "marketingBlocked: unreadable counts as blocked", await blocked({ phones: [P] }, null), true);
}

// -------------------------------------------------------------------------
// 9. Copy: no em dashes anywhere in the function.
// -------------------------------------------------------------------------
check("9 copy", "no em or en dash in consent/index.ts and status.ts", DASH_RE.test(src + statusSrc) || /–/.test(src + statusSrc), false, "CLAUDE.md: no em dashes in user-facing copy");
check("9 copy", "customer-facing link is massageclub.io", (src.match(/https:\/\/book\.[a-z.]+\/unsubscribe/g) || []).every((u) => u === "https://book.massageclub.io/unsubscribe"), true);
check("9 copy", "the approved notice is the fixed one", C ? [C.APPROVED_WORDING.en, C.APPROVED_WORDING.es] : null, [WORD_EN, WORD_ES]);
const cfg = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");
check("9 copy", "config.toml: verify_jwt = false", /\[functions\.consent\]\s*\nverify_jwt = false/.test(cfg), true);

if (failures.length) {
  for (const f of failures) console.log(`FAIL [${f.group}] ${f.input}\n  got:  ${JSON.stringify(f.got)}\n  want: ${JSON.stringify(f.want)}${f.note ? "\n  note: " + f.note : ""}`);
  console.log(`\nconsent: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`consent: all ${pass} pass`);
