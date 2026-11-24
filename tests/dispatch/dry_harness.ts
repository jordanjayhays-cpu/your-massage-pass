// Offline run of dispatch-studios v49 through its real handler, with fetch
// stubbed: no database, no WhatsApp, no email leaves this process. Checks the
// wiring around the pure rest rule (eligibility, cap, second wave, named
// lists, the recheck before sending, failed reads, what the dry run reports,
// what a stopped request writes). Updated for the review fixes (31 Oct).
// Run: deno run --allow-env --allow-read dry_harness.ts <index.ts>
const src = Deno.args[0];
const NOW = Date.now();
const iso = (hAgo: number) => new Date(NOW - hAgo * 3600e3).toISOString();

type Ask = Record<string, unknown>;
// Every ask is its own request unless one is given, so asks never cover
// each other by accident.
let reqSeq = 5000;
const ask = (pid: string, h: number, kind: string, request_id = ++reqSeq): Ask => {
  const t = iso(h);
  const b: Ask = { request_id, partner_id: pid, created_at: t, sent_at: t, outcome: "stood_down", replied_at: null, accepted_at: null, offered_at: null, offered_time: null, offered_times: null, quoted_price: null, customer_answer: null };
  if (kind === "yes") Object.assign(b, { outcome: "accepted", accepted_at: t, replied_at: t, offered_time: "18:00", offered_at: t });
  if (kind === "times") Object.assign(b, { outcome: "pending", replied_at: t, offered_times: ["15:00"] });
  if (kind === "auto") Object.assign(b, { replied_at: t });
  if (kind === "declined") Object.assign(b, { outcome: "declined", replied_at: t });
  return b;
};
const five = (pid: string, kind = "silent") => [10, 30, 50, 70, 90].map((h) => ask(pid, h, kind));

// The world each scenario sees.
let world: {
  req: Record<string, unknown>;
  prior: Ask[];
  cands: Array<{ id: string; business_name: string; wa: string }>;
  asks: Ask[];
  inbound: Array<{ phone: string; body: string; created_at?: string }>;
  customerSaid: string[];
  stage: string;
  unrest?: string;
  partnerRows?: Array<{ id: string; business_name: string; whatsapp: string }>;
  failAsksRead?: boolean;
  throwOnMessages?: boolean;
};
const calls: Array<{ method: string; url: string; body: string }> = [];

const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
  const method = String(init?.method || "GET");
  calls.push({ method, url, body: String(init?.body || "") });
  if (url.includes("api.resend.com") || url.includes("graph.facebook.com") || url.includes("/functions/v1/")) return json({ ok: true });
  if (url.includes("/rpc/dispatch_candidates")) return json(world.cands.map((c, i) => ({ ...c, area: "Chamberí", km: 1 + i, rank: i + 1, widened: false, score: 50 - i })));
  if (url.includes("/rest/v1/app_secrets")) return json(world.unrest ? [{ value: world.unrest }] : []);
  if (url.includes("/rest/v1/whatsapp_requests")) {
    if (method === "PATCH") return json([{ ...world.req }]);
    if (url.includes("select=stage,stage_note")) return json([{ stage: world.stage, stage_note: "earlier note", created_at: world.req.created_at, client_phone: world.req.client_phone }]);
    if (url.includes("client_phone=ilike")) return json([]);
    return json([world.req]);
  }
  if (url.includes("/rest/v1/request_dispatch")) {
    if (url.includes("partner_id=in.(")) return world.failAsksRead ? json({ message: "canceling statement due to statement timeout" }) : json(world.asks);
    if (url.includes("request_id=in.(")) return json(world.asks);
    if (url.includes(`request_id=eq.${world.req.id}`) && method === "GET") return json(world.prior);
    return json([]);
  }
  if (url.includes("/rest/v1/partners")) {
    if (url.includes("select=id,opening_hours")) return json(world.cands.map((c) => ({ id: c.id, opening_hours: null })));
    if (url.includes("select=id,business_name")) return json(world.partnerRows || []);
    return json([]);
  }
  if (url.includes("/rest/v1/wa_messages")) {
    if (url.includes("phone=in.(")) {
      if (world.throwOnMessages) throw new Error("connection reset");
      return json(world.inbound);
    }
    if (url.includes("created_at=gt.")) return json(world.customerSaid.map((body) => ({ body })));
    return json([{ id: 1 }]); // the customer has written to the bot: reachable
  }
  return json([]);
}) as typeof fetch;

let handler: ((req: Request) => Promise<Response>) | null = null;
(Deno as unknown as { serve: unknown }).serve = (h: (req: Request) => Promise<Response>) => { handler = h; return {} as unknown; };
const mod = await import(new URL(src, `file://${Deno.cwd()}/`).href);
mod.start({ opsKey: "k", resendKey: "r", waToken: "w" });

async function post(body: Record<string, unknown>) {
  calls.length = 0;
  const res = await handler!(new Request("http://x/?key=k", { method: "POST", body: JSON.stringify(body) }));
  return (await res.json()) as any;
}

let pass = 0;
const fails: string[] = [];
const check = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
};
const mails = () => calls.filter((c) => c.url.includes("api.resend.com")).map((c) => JSON.parse(c.body));
const released = () => !!calls.find((c) => c.method === "PATCH" && c.body.includes("\"dispatched_at\":null"));
const templatesTo = () => new Set(calls.filter((c) => c.url.includes("graph.facebook.com") && c.body.includes("\"type\":\"template\"")).map((c) => JSON.parse(c.body).to));

const C = (id: string, n: number) => ({ id, business_name: id, wa: `3460000${String(n).padStart(4, "0")}` });
const baseReq = { id: 900, first_name: "Ana", client_phone: "34999000111", contact_email: "ana@realmail.es", service_name: "Relaxing", day1: "", time1: "", area: "Chamberí", created_at: iso(0.2), dispatched_at: null, stage: "new" };

// A. Eight candidates: KamAI-like silent five, a decliner five, an opt-out
// with a yes on record, three never said yes, and two with a yes. Only the
// two with a yes are eligible, in the order they came in.
world = {
  req: { ...baseReq }, prior: [], stage: "new", customerSaid: [],
  cands: [C("silent5", 1), C("fresh1", 2), C("decl5", 3), C("optout", 4), C("fresh2", 5), C("yesA", 6), C("yesB", 7), C("fresh3", 8)],
  asks: [...five("silent5"), ...five("decl5", "declined"), ask("optout", 100, "yes"), ask("yesA", 200, "yes"), ask("yesB", 300, "yes"), ...five("yesB", "auto").map((x) => ({ ...x, sent_at: iso(1), created_at: iso(1), outcome: "pending", replied_at: null }))],
  inbound: [{ phone: "34600000004", body: "No me interesa. Gracias", created_at: iso(50) }],
};
let out = await post({ request_id: 900, dry_run: true });
let r0 = out.results[0];
check("A: only eligible (a yes on record), in the order they came in", r0.candidates.map((c: any) => c.name), ["yesA", "yesB"]);
check("A: skippedResting names each with a reason", r0.skippedResting.map((x: any) => x.name), ["silent5", "decl5", "optout"]);
check("A: opt-out reason quotes it", r0.skippedResting[2].why, "wrote \"No me interesa. Gracias\"");
check("A: decliner reason", r0.skippedResting[1].why.startsWith("last 5 asks with no yes"), true);
check("A: skippedNoYes lists the ones never asked or never yes", r0.skippedNoYes, ["fresh1", "fresh2", "fresh3"]);
check("A: fanout is 4", r0.fanout, 4);
check("A: young pending asks do not rest yesB (5 asks under 2h old)", r0.candidates.some((c: any) => c.name === "yesB"), true);
check("A: dry run wrote nothing", calls.filter((c) => c.method !== "GET" && !c.url.includes("/rpc/")).length, 0);

// A2. Jordan brings fresh1 back (DISPATCH_UNREST): it is asked, in its place.
world = { ...world, unrest: "fresh1, someone-else@2026-11-03" };
out = await post({ request_id: 900, dry_run: true });
check("A2: an unrested studio with no yes yet is eligible", out.results[0].candidates.map((c: any) => c.name), ["fresh1", "yesA", "yesB"]);
check("A2: reported as brought back", out.results[0].candidates[0].broughtBack, true);
world = { ...world, unrest: undefined };

// A3. fanout 10 from a caller is still four.
world = { ...world, cands: ["y1", "y2", "y3", "y4", "y5", "y6"].map((p, i) => C(p, 20 + i)), asks: ["y1", "y2", "y3", "y4", "y5", "y6"].map((p) => ask(p, 100, "yes")), inbound: [] };
out = await post({ request_id: 900, dry_run: true, fanout: 10 });
check("A3: body.fanout 10 is capped at 4", out.results[0].candidates.map((c: any) => c.name), ["y1", "y2", "y3", "y4"]);

// A4. An hour read only into offered_times is a yes (Centro Aloha #84).
world = { ...world, cands: [C("timesOnly", 30)], asks: [ask("timesOnly", 100, "times")] };
out = await post({ request_id: 900, dry_run: true });
check("A4: offered_times alone makes a studio eligible", out.results[0].candidates.map((c: any) => c.name), ["timesOnly"]);

// A5. Asks closed by another studio's yes within minutes do not rest a studio
// (Selvarrosa #89, #91, #107).
{
  const asks: Ask[] = [ask("selva", 400, "yes")];
  for (const h of [10, 30, 50, 70, 90]) {
    const rq = ++reqSeq;
    asks.push(ask("selva", h, "silent", rq));
    asks.push({ ...ask("calma", h - 0.05, "yes", rq) });
  }
  world = { ...world, cands: [C("selva", 31)], asks };
  out = await post({ request_id: 900, dry_run: true });
  check("A5: covered asks do not count, so selva is asked", out.results[0].candidates.map((c: any) => c.name), ["selva"]);
  world = { ...world, asks: asks.filter((a) => a.partner_id !== "calma") };
  out = await post({ request_id: 900, dry_run: true });
  check("A5: the same asks with nobody else's yes rest it", out.results[0].skippedResting.map((x: any) => x.name), ["selva"]);
}

// B. Everyone resting: nobody is asked (no fallback), and the dry run says who and why.
world = { ...world, cands: [C("silent5", 1), C("optout", 4), C("decl5", 3)], asks: [...five("silent5"), ...five("decl5", "declined"), ask("optout", 100, "yes")], inbound: [{ phone: "34600000004", body: "No me interesa. Gracias", created_at: iso(50) }] };
out = await post({ request_id: 900, dry_run: true });
r0 = out.results[0];
check("B: nobody eligible: no_candidates", r0.reason, "no_candidates");
check("B: skippedResting lists all three", r0.skippedResting.map((x: any) => x.name), ["silent5", "optout", "decl5"]);
out = await post({ request_id: 900, force: true });
check("B: a real run sends nothing", templatesTo().size, 0);
check("B: and hands the claim back", released(), true);

// C. Second wave: two already asked, two places left, eligible only.
world = {
  ...world,
  cands: [C("asked1", 11), C("fresh1", 2), C("yesA", 6), C("yesB", 7), C("yesC", 9), C("fresh2", 5)],
  asks: [ask("yesA", 200, "yes"), ask("yesB", 300, "yes"), ask("yesC", 400, "yes"), ask("asked1", 500, "yes")],
  prior: ["asked1", "x2"].map((p) => ask(p, 1, "silent")),
  inbound: [],
};
out = await post({ request_id: 900, dry_run: true, widen: true });
r0 = out.results[0];
check("C: widen asks two eligible, not the one already asked", r0.candidates.map((c: any) => c.name), ["yesA", "yesB"]);
check("C: widen lists who was left out for no yes", r0.skippedNoYes, ["fresh1", "fresh2"]);
check("C: widen fanout 2", r0.fanout, 2);

// D. Three already asked: a second wave gets one; four: none.
world = { ...world, prior: ["a1", "a2", "a3"].map((p) => ask(p, 1, "silent")) };
out = await post({ request_id: 900, dry_run: true, widen: true });
check("D: three asked, room for one", out.results[0].candidates.length, 1);
world = { ...world, prior: ["a1", "a2", "a3", "a4"].map((p) => ask(p, 1, "silent")) };
out = await post({ request_id: 900, dry_run: true, widen: true });
check("D: four asked, nobody more", out.results[0].reason, "max_asks");
world = { ...world, prior: [...["a1", "a2", "a3"].map((p) => ask(p, 1, "silent")), { ...ask("a4", 1, "silent"), sent_at: null, outcome: "send_failed" }] };
out = await post({ request_id: 900, dry_run: true, widen: true });
check("D: a send_failed row does not use a place", out.results[0].candidates.length, 1);

// D2. A first wave run again (dispatched_at cleared) does not re-ask a
// studio already asked, and retries one the ask never reached.
world = { ...world, prior: [ask("yesA", 1, "silent"), { ...ask("yesB", 1, "silent"), sent_at: null, outcome: "send_failed" }] };
out = await post({ request_id: 900, dry_run: true });
check("D2: first wave skips the studio already asked, retries the failed one, fills the 3 places left", out.results[0].candidates.map((c: any) => c.name), ["asked1", "yesB", "yesC"]);

// E. The customer wrote "cancel" after the request: dry run says so, a real
// run writes stage_note, emails Jordan, keeps the claim, asks nobody.
world = { ...world, prior: [], cands: [C("yesA", 6), C("fresh1", 2)], asks: [ask("yesA", 200, "yes")], customerSaid: ["Hi", "cancel please"] };
out = await post({ request_id: 900, dry_run: true });
check("E: dry run reports the stop", [out.results[0].reason, out.results[0].why], ["not_open", "the customer wrote \"cancel please\""]);
out = await post({ request_id: 900, force: true });
const notePatch = calls.find((c) => c.method === "PATCH" && c.body.includes("not dispatched"));
check("E: no studio messaged", templatesTo().size, 0);
check("E: stage_note appended", JSON.parse(notePatch?.body || "{}").stage_note, "earlier note; not dispatched: the customer wrote \"cancel please\" (dispatch-studios v49)");
check("E: claim kept (not released)", released(), false);
check("E: Jordan emailed", mails()[0]?.subject, "Request #900 not sent: the customer may have cancelled");
check("E: first wave email says clear dispatched_at", String(mails()[0]?.html || "").includes("clear dispatched_at"), true);

// E2. A question about the cancellation policy is not a cancel.
world = { ...world, customerSaid: ["What is your cancellation policy?", "[tap: cancel_121]"] };
out = await post({ request_id: 900, dry_run: true });
check("E2: 'cancellation policy' does not stop it", out.results[0].candidates?.map((c: any) => c.name), ["yesA"]);

// E3. A second wave stopped by the words: the email must not say "clear dispatched_at".
world = { ...world, customerSaid: ["Cancelar"], prior: [ask("x1", 1, "silent")] };
out = await post({ request_id: 900, extra: true, force: true });
const e3 = String(mails()[0]?.html || "");
check("E3: second wave email says extra + force_dispatch", e3.includes("extra: true, force_dispatch: true"), true);
check("E3: and never to clear dispatched_at", e3.includes("Do not clear dispatched_at"), true);

// F. Stage closed: stopped whatever the words, even with force_dispatch.
world = { ...world, prior: [], stage: "cancelled", customerSaid: [] };
out = await post({ request_id: 900, dry_run: true, force_dispatch: true });
check("F: cancelled stage stops it", out.results[0].why, "stage is cancelled");

// G. A real run that asks: four templates, no more.
world = { ...world, stage: "new", cands: ["y1", "y2", "y3", "y4", "y5", "y6"].map((p, i) => C(p, 20 + i)), asks: ["y1", "y2", "y3", "y4", "y5", "y6"].map((p) => ask(p, 100, "yes")) };
out = await post({ request_id: 900, force: true });
check("G: exactly four studios messaged", templatesTo().size, 4);
check("G: result sent 4", out.results[0].sent, 4);

// H. A named list (the customer's pick in wa-bot): a resting pick is asked
// anyway (wa-bot already told the customer), the opt-out never is, and
// Jordan gets one email naming the resting pick, escaped.
world = {
  ...world, cands: [C("<b>kam</b>", 41), C("optout", 4), C("yesA", 6)],
  partnerRows: [{ id: "<b>kam</b>", business_name: "<b>kam</b>", whatsapp: "34600000041" }, { id: "optout", business_name: "optout", whatsapp: "34600000004" }, { id: "yesA", business_name: "yesA", whatsapp: "34600000006" }],
  asks: [...five("<b>kam</b>"), ask("optout", 100, "yes"), ask("yesA", 200, "yes")],
  inbound: [{ phone: "34600000004", body: "BAJA", created_at: iso(50) }],
};
out = await post({ request_id: 900, partner_ids: ["<b>kam</b>", "optout", "yesA"], force: true, customer_note: false });
r0 = out.results[0];
check("H: named list asks the resting pick and the backup, never the opt-out", r0.studios, ["<b>kam</b>", "yesA"]);
check("H: askedResting names the resting pick", r0.askedResting.map((x: any) => x.name), ["<b>kam</b>"]);
const hMail = mails().find((m) => String(m.subject).includes("the rest rule would skip"));
check("H: Jordan emailed about it", !!hMail, true);
check("H: the name is escaped in the email", String(hMail?.html || "").includes("&lt;b&gt;kam&lt;/b&gt;") && !String(hMail?.html || "").includes("<b><b>kam"), true);
world = { ...world, partnerRows: undefined };

// I. The asks cannot be read: nothing goes out, and the claim is handed back.
world = { ...world, cands: [C("yesA", 6)], asks: [ask("yesA", 200, "yes")], inbound: [], failAsksRead: true };
out = await post({ request_id: 900, force: true });
check("I: failed read -> recheck_failed", out.results[0].reason, "recheck_failed");
check("I: nothing sent", templatesTo().size, 0);
check("I: claim released for the sweep", released(), true);
world = { ...world, failAsksRead: false };

// J. A read throws: the error is a result, and the claim is handed back.
world = { ...world, throwOnMessages: true };
out = await post({ request_id: 900, force: true });
check("J: exception -> reason error", out.results[0].reason, "error");
check("J: claim released", released(), true);
world = { ...world, throwOnMessages: false };

// K. "No nos interesa hacer descuento, pero tenemos hueco a las 17:00" with
// its own offered hour is not an opt-out.
{
  const t = iso(5);
  world = { ...world, cands: [C("disc", 50)], asks: [{ ...ask("disc", 5, "yes"), accepted_at: null, outcome: "pending", replied_at: new Date(Date.parse(t) + 2000).toISOString(), offered_at: new Date(Date.parse(t) + 2000).toISOString() }], inbound: [{ phone: "34600000050", body: "No nos interesa hacer descuento, pero tenemos hueco a las 17:00", created_at: t }] };
  out = await post({ request_id: 900, dry_run: true });
  check("K: a no-discount reply that offers an hour leaves the studio eligible", out.results[0].candidates?.map((c: any) => c.name), ["disc"]);
}

console.log(`${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log("FAIL " + f);
if (fails.length) Deno.exit(1);
