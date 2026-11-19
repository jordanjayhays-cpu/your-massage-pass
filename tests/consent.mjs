// The consent edge function (the Kelly rule, 20 Nov 2026).
//
// Every booking path asks "Can Massage Club send you offers ...?" and the
// answer goes to supabase/functions/consent, which writes one row in
// marketing_optins. On 19 Nov the website's opt-in saved into a table that did
// not exist and said "Done" anyway; these checks make sure an answer is either
// written or loudly reported, never lost in silence.
//
// The function is run for real (types stripped, imported) with fetch stubbed:
// nothing touches a database, Resend or the network. Invented addresses only
// (the repo is public).
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
let C = null;
const src = fs.existsSync(fnPath) ? fs.readFileSync(fnPath, "utf8") : "";
if (src) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-consent-"));
  const file = path.join(tmp, "consent.mjs");
  fs.writeFileSync(file, stripTypeScriptTypes(src));
  C = await import(pathToFileURL(file).href);
}
check("load", "supabase/functions/consent/index.ts", !!C, true, "the function file exists and loads");

const ORIGIN = "https://book.massageclub.io";
const post = (body, o = {}) => new Request("https://fn.invalid/consent", {
  method: o.method || "POST",
  headers: { "Content-Type": "application/json", ...(o.origin === null ? {} : { origin: o.origin || ORIGIN }), ...(o.ip ? { "x-forwarded-for": o.ip } : {}) },
  body: o.method === "GET" || o.method === "OPTIONS" ? undefined : (typeof body === "string" ? body : JSON.stringify(body)),
});
const inserts = () => calls.filter((c) => c.url.endsWith("/rest/v1/marketing_optins") && c.method === "POST");
const alerts = () => calls.filter((c) => c.url === "https://api.resend.com/emails");
const okRoutes = (extra = {}) => async (url, o) => {
  if (url.includes("/rest/v1/bookings?")) return extra.bookings || { status: 200, body: [] };
  if (url.endsWith("/rest/v1/marketing_optins")) return extra.insert || { status: 201, body: "" };
  if (url === "https://api.resend.com/emails") return { status: 200, body: { id: "x" } };
  return { status: 404, body: "" };
};
async function run(body, o = {}, routes = okRoutes()) {
  calls.length = 0;
  route = routes;
  const res = await C.handleRequest(post(body, o));
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* empty */ }
  return { status: res.status, json, headers: res.headers };
}

const WORD_EN = "Can Massage Club send you offers and reminders to book again, by email and WhatsApp? You can stop any time with one tap, or by writing to support@massageclub.io.";
const WORD_ES = "¿Puede Massage Club enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp? Puedes darte de baja cuando quieras con un toque o escribiendo a support@massageclub.io.";

if (C) {
  // -------------------------------------------------------------------------
  // 1. A yes and a no each write one row, with the exact words and language.
  // -------------------------------------------------------------------------
  {
    const G = "1 yes and no rows";
    const r = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "  Cliente.Uno@Correo.invalid ", phone: "+34 600 111 222", request_id: 512 }, { ip: "203.0.113.9, 10.0.0.1" });
    check(G, "yes: answer", [r.status, r.json], [200, { ok: true }]);
    check(G, "yes: CORS for the site", r.headers.get("access-control-allow-origin"), ORIGIN);
    const row = inserts()[0]?.body || {};
    check(G, "yes: one insert", inserts().length, 1);
    check(G, "yes: the row", { email: row.email, phone: row.phone, source: row.source, action: row.action, wording: row.wording, lang: row.wording_lang, request_id: row.request_id, channel: row.channel, booking_ref: row.booking_ref },
      { email: "cliente.uno@correo.invalid", phone: "34600111222", source: "go_page", action: "yes", wording: WORD_EN, lang: "en", request_id: 512, channel: "email+whatsapp", booking_ref: null }, "email lowercased, phone digits only");
    check(G, "yes: ip kept only as a keyed hash", /^[0-9a-f]{32}$/.test(String(row.ip_hash)) && !JSON.stringify(row).includes("203.0.113.9"), true);
    check(G, "yes: service role writes", inserts()[0]?.headers?.Authorization, "Bearer svc");
    check(G, "yes: no alert", alerts().length, 0);
    const n = await run({ choice: "no", source: "studio_booking", wording: WORD_ES, lang: "es", email: "cliente.dos@correo.invalid", booking_ref: "sb-77" });
    const nrow = inserts()[0]?.body || {};
    check(G, "no: answer", [n.status, n.json], [200, { ok: true }]);
    check(G, "no: the row", [nrow.action, nrow.source, nrow.wording, nrow.wording_lang, nrow.booking_ref, nrow.phone], ["no", "studio_booking", WORD_ES, "es", "sb-77", null]);
    const p = await run({ choice: "yes", source: "bot", wording: WORD_EN, lang: "en", phone: "34 600 333 444" });
    check(G, "phone only is enough", [p.status, inserts()[0]?.body?.phone, inserts()[0]?.body?.email], [200, "34600333444", null]);
  }

  // -------------------------------------------------------------------------
  // 2. The review page sends a booking token; the booking says who it is.
  // -------------------------------------------------------------------------
  {
    const G = "2 token lookup";
    const booking = { status: 200, body: [{ booking_ref: "wa-901", client_email: "Cliente.Tres@Correo.invalid", client_phone: "+34600555666", client_name: "Cliente Tres" }] };
    const r = await run({ choice: "yes", source: "review_page", wording: WORD_ES, lang: "es", token: "tok_abcdef123456", email: "otra.persona@correo.invalid" }, {}, okRoutes({ bookings: booking }));
    const look = calls.find((c) => c.url.includes("/rest/v1/bookings?"));
    check(G, "looked up by action_token", !!look && look.url.includes("action_token=eq.tok_abcdef123456"), true);
    const row = inserts()[0]?.body || {};
    check(G, "the booking's email, phone and ref, never the browser's", [r.status, row.email, row.phone, row.booking_ref, row.source], [200, "cliente.tres@correo.invalid", "34600555666", "wa-901", "review_page"]);
    const u = await run({ choice: "yes", source: "review_page", wording: WORD_ES, lang: "es", token: "tok_unknown12345" });
    check(G, "unknown token: 404, nothing written, no alert", [u.status, u.json?.error, inserts().length, alerts().length], [404, "unknown_token", 0, 0]);
    const m = await run({ choice: "yes", source: "review_page", wording: WORD_ES, token: "bad token!" });
    check(G, "malformed token: 400", [m.status, inserts().length], [400, 0]);
    const f = await run({ choice: "yes", source: "review_page", wording: WORD_ES, lang: "es", token: "tok_abcdef123456" }, {}, okRoutes({ bookings: { status: 503, body: "down" } }));
    check(G, "bookings unreadable: 500 and one alert", [f.status, f.json, inserts().length, alerts().length], [500, { ok: false }, 0, 1]);
  }

  // -------------------------------------------------------------------------
  // 3. Bad input is refused before anything is written.
  // -------------------------------------------------------------------------
  {
    const G = "3 bad input";
    const base = { choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente@correo.invalid" };
    const cases = [
      ["choice maybe", { ...base, choice: "maybe" }, 400],
      ["choice missing", { ...base, choice: undefined }, 400],
      ["source unknown", { ...base, source: "website" }, 400],
      ["source unsubscribe is the withdraw path's", { ...base, source: "unsubscribe" }, 400],
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
    check(G, "no Origin (server to server) is checked like anything else", none.status, 200);
  }

  // -------------------------------------------------------------------------
  // 4. A failed insert is never silent: 500 and one email to Jordan.
  // -------------------------------------------------------------------------
  {
    const G = "4 failed insert";
    const r = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente.cuatro@correo.invalid", request_id: 404 }, {}, okRoutes({ insert: { status: 404, body: { code: "42P01", message: "relation \"public.marketing_optins\" does not exist" } } }));
    check(G, "500 { ok: false }", [r.status, r.json], [500, { ok: false }], "the page shows its error line, never Done");
    check(G, "exactly one founder alert", alerts().length, 1);
    const a = alerts()[0]?.body || {};
    check(G, "to jordan@massageclub.io", a.to, ["jordan@massageclub.io"]);
    check(G, "the alert says what and why", [/NOT saved/.test(a.subject || ""), /42P01/.test(a.text || ""), /cliente\.cuatro@correo\.invalid/.test(a.text || ""), /#404/.test(a.text || "")], [true, true, true, true]);
    check(G, "no em dash in the alert", DASH_RE.test(String(a.subject) + String(a.text)), false);
    const t = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", email: "cliente@correo.invalid" }, {}, async (url) => { if (url.endsWith("/rest/v1/marketing_optins")) throw new Error("network down"); return { status: 200, body: {} }; });
    check(G, "a network error too", [t.status, alerts().length], [500, 1]);
  }

  // -------------------------------------------------------------------------
  // 5. Test contacts are recorded, flagged, and never alerted about.
  // -------------------------------------------------------------------------
  {
    const G = "5 test contacts";
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
    for (const [name, who] of tests) {
      const ok = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", ...who });
      check(G, `${name}: recorded and flagged`, [ok.status, ok.json, inserts().length], [200, { ok: true, test: true }, 1]);
      const bad = await run({ choice: "yes", source: "go_page", wording: WORD_EN, lang: "en", ...who }, {}, fail);
      check(G, `${name}: a failure is not alerted`, [bad.status, alerts().length], [500, 0]);
    }
    const tok = await run({ choice: "no", source: "review_page", wording: WORD_EN, token: "tok_testname1234" }, {}, okRoutes({ bookings: { status: 200, body: [{ booking_ref: "wa-1", client_email: "persona@correo.invalid", client_name: "Prueba Uno" }] }, insert: { status: 500, body: "boom" } }));
    check(G, "a booking named Prueba: not alerted", [tok.status, alerts().length], [500, 0]);
    check(G, "a real address is not a test contact", C.isTestContact({ email: "cliente@correo.invalid", phone: "34600111222", name: "Ana" }), false);
  }

  // -------------------------------------------------------------------------
  // 6. Withdraw: a signed link, POST only.
  // -------------------------------------------------------------------------
  {
    const G = "6 withdraw";
    const em = "Cliente.Seis@Correo.invalid";
    const s = await C.signContact(em, KEY);
    check(G, "signature: 32 hex", /^[0-9a-f]{32}$/.test(s), true);
    const nodeSig = (await import("node:crypto")).createHmac("sha256", KEY).update("cliente.seis@correo.invalid").digest("hex").slice(0, 32);
    check(G, "signature = first 32 hex of HMAC-SHA256(MC_SIGN_KEY, u)", s, nodeSig, "the contract the unsubscribe page and senders share");
    const r = await run({ action: "withdraw", u: em, s });
    const row = inserts()[0]?.body || {};
    check(G, "good signature: written", [r.status, r.json, row.action, row.source, row.email, row.phone, row.channel], [200, { ok: true }, "withdraw", "unsubscribe", "cliente.seis@correo.invalid", null, "email+whatsapp"]);
    check(G, "wording recorded", typeof row.wording === "string" && row.wording.length > 10 && !DASH_RE.test(row.wording), true);
    const ph = "34600777888";
    const rp = await run({ action: "withdraw", u: "+" + ph, s: await C.signContact(ph, KEY), lang: "es" });
    check(G, "a phone, in Spanish", [rp.status, inserts()[0]?.body?.phone, inserts()[0]?.body?.email, inserts()[0]?.body?.wording_lang], [200, ph, null, "es"]);
    const bad = await run({ action: "withdraw", u: em, s: "0".repeat(32) });
    check(G, "bad signature: 403, nothing written", [bad.status, inserts().length, alerts().length], [403, 0, 0]);
    const swapped = await run({ action: "withdraw", u: "otra@correo.invalid", s });
    check(G, "someone else's address with this signature: 403", [swapped.status, inserts().length], [403, 0]);
    const short = await run({ action: "withdraw", u: em, s: s.slice(0, 20) });
    check(G, "short signature: 403", [short.status, inserts().length], [403, 0]);
    const nou = await run({ action: "withdraw", s });
    check(G, "no address: 400", [nou.status, inserts().length], [400, 0]);
    const f = await run({ action: "withdraw", u: em, s }, {}, okRoutes({ insert: { status: 500, body: "boom" } }));
    check(G, "a withdraw that cannot be written: 500 and one alert", [f.status, alerts().length, /unsubscribe/i.test(alerts()[0]?.body?.text || "")], [500, 1, true]);
    const url = await C.unsubscribeUrl(em, KEY);
    check(G, "unsubscribeUrl", url, `https://book.massageclub.io/unsubscribe?u=${encodeURIComponent("cliente.seis@correo.invalid")}&s=${s}`, "massageclub.io only");
    let threw = false; try { await C.unsubscribeUrl(em, ""); } catch { threw = true; }
    check(G, "unsubscribeUrl refuses without a key (no promotion without a link)", threw, true);
    env.MC_SIGN_KEY = "";
  }
}

// -------------------------------------------------------------------------
// 7. Copy: no em dashes anywhere in the function.
// -------------------------------------------------------------------------
check("7 copy", "no em or en dash in consent/index.ts", DASH_RE.test(src) || /–/.test(src), false, "CLAUDE.md: no em dashes in user-facing copy");
check("7 copy", "customer-facing link is massageclub.io", (src.match(/https:\/\/book\.[a-z.]+\/unsubscribe/g) || []).every((u) => u === "https://book.massageclub.io/unsubscribe"), true);
const cfg = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");
check("7 copy", "config.toml: verify_jwt = false", /\[functions\.consent\]\s*\nverify_jwt = false/.test(cfg), true);

if (failures.length) {
  for (const f of failures) console.log(`FAIL [${f.group}] ${f.input}\n  got:  ${JSON.stringify(f.got)}\n  want: ${JSON.stringify(f.want)}${f.note ? "\n  note: " + f.note : ""}`);
  console.log(`\nconsent: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`consent: all ${pass} pass`);
