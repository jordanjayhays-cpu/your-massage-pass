// The consent rule and the jobs that nudge people (20 Nov 2026).
//
// A customer who writes STOP halfway through a booking is told "we will not
// send you offers or reminders to book again any more". Their session stays
// in a booking step, which is exactly what recover-abandoned (a marketing
// template) and the rescue job's mid-flow nudge look for. Both now read
// marketing_status (consent/status.ts) and the session's own answer, and say
// nothing to anyone who said no or stop, or whom they cannot check.
//
// Each job is run for real in dry mode (types stripped, Deno and fetch
// stubbed): nothing touches a database, WhatsApp or the network. Invented
// numbers only (the repo is public).
//
// Run: node tests/consent_jobs.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const fns = path.join(root, "supabase/functions");

let pass = 0;
const failures = [];
function check(group, input, got, want, note = "") {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else failures.push({ group, input, got, want, note });
}

// ---------------------------------------------------------------------------
// Load each job with its relative imports pointed at stripped copies.
// ---------------------------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-consent-jobs-"));
const strip = (rel, out, swaps = {}) => {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(fns, rel), "utf8"));
  for (const [from, to] of Object.entries(swaps)) js = js.split(JSON.stringify(from)).join(JSON.stringify(pathToFileURL(path.join(tmp, to)).href));
  fs.writeFileSync(path.join(tmp, out), js);
  return pathToFileURL(path.join(tmp, out)).href;
};
strip("consent/status.ts", "status.mjs");
strip("notify-whatsapp-request/notify.ts", "notify.mjs");
let handler = null;
globalThis.Deno = { env: { get: () => "" }, serve: (h) => { handler = h; } };
let route = () => ({ status: 404, body: [] });
const calls = [];
globalThis.fetch = async (u, o = {}) => {
  const url = String(u);
  calls.push({ url, method: o.method || "GET" });
  const r = route(url, o);
  return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status });
};
const RA = await import(strip("recover-abandoned/index.ts", "recover.mjs", { "../consent/status.ts": "status.mjs" }));
RA.start({ cronKey: "k", resendKey: "re_test", waToken: "wa_test" });
const recover = handler;
const SB = await import(strip("stuck-booking-rescue/index.ts", "rescue.mjs", { "../consent/status.ts": "status.mjs", "../notify-whatsapp-request/notify.ts": "notify.mjs" }));
SB.start({ cronKey: "k", resendKey: "re_test", waToken: "wa_test" });
const rescue = handler;
check("load", "both jobs load and start", [!!recover, !!rescue, recover !== rescue], [true, true, true]);

// ---------------------------------------------------------------------------
// Three people, all halfway through a booking and quiet:
//   STOPPED  wrote STOP; marketing_status says withdraw (the session knows nothing)
//   SESSION  wrote STOP; the session says withdraw (the row did not save)
//   CONTROL  never answered: the job behaves as before
// ---------------------------------------------------------------------------
const STOPPED = "34611000001", SESSION = "34611000002", CONTROL = "34611000003", SAIDNO = "34611000004";
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const status = { [STOPPED]: "withdraw", [SAIDNO]: "no" };
const sessData = (p) => ({ lang: "en", service: "svc_relax", ...(p === SESSION ? { mktAnswer: "withdraw" } : {}) });
const world = (o = {}) => (url, opt) => {
  const u = new URL(url);
  const t = u.pathname.replace("/rest/v1/", "");
  const q = (k) => u.searchParams.get(k) || "";
  const phoneQ = (q("phone") || q("client_phone")).replace(/^eq\./, "").replace(/^\+/, "");
  if ((opt.method || "GET") !== "GET") return { status: 201, body: "" };
  if (t === "marketing_status") {
    if (o.statusDown) return { status: 503, body: "down" };
    const list = q("contact").replace(/^in\.\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
    return { status: 200, body: list.filter((c) => status[c]).map((c) => ({ kind: "phone", contact: c, action: status[c], source: "bot" })) };
  }
  if (t === "wa_customers") return { status: 200, body: [STOPPED, SESSION, CONTROL, SAIDNO].map((p) => ({ phone: p, chat_step: "await_day", last_inbound: hoursAgo(48), confirmed_bookings: 0, name: "Cliente" })) };
  if (t === "funnel_events") return { status: 200, body: [] };
  if (t === "wa_sessions") {
    if (q("step").startsWith("in.")) return { status: 200, body: [STOPPED, SESSION, CONTROL, SAIDNO].map((p) => ({ phone: p, step: "await_day", data: sessData(p), updated_at: hoursAgo(5) })) };
    return { status: 200, body: [{ step: "await_day", data: sessData(phoneQ), wa_name: "Cliente" }] };
  }
  if (t === "wa_messages") return { status: 200, body: q("direction") === "eq.in" ? [{ body: "hello", created_at: hoursAgo(5) }] : [] };
  if (t === "whatsapp_requests") return { status: 200, body: [] };
  if (t === "rpc/match_studios") return { status: 200, body: [] };
  return { status: 404, body: [] };
};
const get = async (h, qs) => { calls.length = 0; const r = await h(new Request(`https://fn.invalid/?key=k&dry=1${qs || ""}`)); return await r.json(); };
const sends = () => calls.filter((c) => c.url.includes("graph.facebook.com") || c.url.includes("api.resend.com")).length;

{
  const G = "1 recover-abandoned";
  route = world();
  const r = await get(recover);
  const would = (r.sent || []).map((x) => x.phone).sort();
  const why = Object.fromEntries((r.skipped || []).map((x) => [x.phone, x.why]));
  check(G, "dry run: only the customer who never answered would get the template", would, [CONTROL]);
  check(G, "STOP recorded in marketing_status: skipped", /said no or stop/.test(why[STOPPED] || ""), true);
  check(G, "STOP only in the session: skipped", why[SESSION], "said withdraw to offers");
  check(G, "No thanks to offers: skipped", /said no or stop/.test(why[SAIDNO] || ""), true);
  check(G, "nothing sent in dry mode", sends(), 0);
  route = world({ statusDown: true });
  const d = await get(recover);
  check(G, "marketing_status unreadable: nobody (we do not write to someone we cannot check)", [(d.sent || []).length, (d.skipped || []).filter((x) => /unreadable/.test(x.why)).length], [0, 3]);
}

{
  const G = "2 stuck-booking-rescue E (mid-flow nudge)";
  route = world();
  const r = await get(rescue);
  const flow = r.flow || [];
  check(G, "dry run: only the customer who never answered would be nudged", flow.filter((x) => x.dry).map((x) => x.phone), [CONTROL]);
  check(G, "the others are skipped for their answer", flow.filter((x) => x.skipped === "offers_stopped").map((x) => x.phone).sort(), [STOPPED, SESSION, SAIDNO].sort());
  check(G, "nothing sent in dry mode", sends(), 0);
  route = world({ statusDown: true });
  const d = await get(rescue);
  check(G, "marketing_status unreadable: nobody", (d.flow || []).filter((x) => x.dry).length, 0);
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL [${f.group}] ${f.input}\n  got:  ${JSON.stringify(f.got)}\n  want: ${JSON.stringify(f.want)}${f.note ? "\n  note: " + f.note : ""}`);
  console.log(`\nconsent jobs: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`consent jobs: all ${pass} pass`);
