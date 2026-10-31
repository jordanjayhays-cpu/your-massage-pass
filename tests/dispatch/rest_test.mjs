// Tests for dispatch-studios v49's resting rule (Jordan, 31 Oct).
//
// Like tests/replay.mjs does for the bot, this runs the real code: it cuts the
// pure block (SILENT_LIMIT .. blockedReason, plus appendNote) out of
// supabase/functions/dispatch-studios/index.ts, writes it to a .ts module next
// to this file, and imports it (node strips the types). Nothing here touches a
// database or the network.
//
// Run: node rest_test.mjs [path/to/index.ts]
// With --today rows.json it also prints who would be resting today, from a
// SELECT-only dump (see resting_today.md).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const todayAt = args.indexOf("--today");
const todayFile = todayAt >= 0 ? args[todayAt + 1] : null;
const src = args.find((a, i) => a.endsWith(".ts") && !(todayAt >= 0 && i === todayAt + 1))
  || join(here, "..", "..", "supabase", "functions", "dispatch-studios", "index.ts");
const code = readFileSync(src, "utf8");

function cut(from, to) {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a + 1);
  if (a < 0 || b < 0) throw new Error(`marker not found: ${a < 0 ? from : to}`);
  return code.slice(a, b);
}
const pure = cut("const SILENT_LIMIT = 3;", "// restInfo for each candidate, read in one go");
const note = cut("function appendNote(", "\n}\n") + "\n}\n";
// digits() is used by nothing in the pure block, but keep the module honest.
const mod = join(here, "_rest_pure.gen.ts");
writeFileSync(mod, `// GENERATED from ${src} by rest_test.mjs. Do not edit.\n${pure}\n${note}\nexport { SILENT_LIMIT, REST_AFTER_ASKS, REST_YOUNG_MS, studioSaidYes, reachedStudio, askEnding, OPT_OUT_RE, optOutWords, parseUnrest, restInfo, planAsks, coverAsks, yesTimes, OPEN_STAGES, CUSTOMER_CANCEL_RE, blockedReason, appendNote };\n`);
const M = await import(pathToFileURL(mod).href);

let pass = 0;
const failures = [];
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else failures.push({ name, got, want });
}

const NOW = Date.parse("2026-10-31T11:00:00Z"); // 12:00 Madrid
const ago = (h) => new Date(NOW - h * 3600e3).toISOString();
// One ask, h hours ago. kind: silent | auto | declined | yes | offered | price | won | custno | young | failed | email
function ask(h, kind) {
  const t = ago(h);
  const base = { partner_id: "p", created_at: t, sent_at: t, outcome: "pending", replied_at: null, accepted_at: null, offered_time: null, quoted_price: null, customer_answer: null };
  switch (kind) {
    case "silent": return { ...base, outcome: "stood_down" };
    case "auto": return { ...base, outcome: "stood_down", replied_at: t, reply_text: "Gracias por comunicarte con nosotros. ¿Cómo podemos ayudarte?" };
    case "declined": return { ...base, outcome: "declined", replied_at: t, reply_text: "No podemos (botón)" };
    case "yes": return { ...base, outcome: "accepted", accepted_at: t, replied_at: t };
    case "offered": return { ...base, outcome: "pending", offered_time: "18:00", replied_at: t };
    case "price": return { ...base, outcome: "pending", quoted_price: 55, replied_at: t };
    case "won": return { ...base, outcome: "won", replied_at: t };
    case "custno": return { ...base, outcome: "no", offered_time: "17:00", customer_answer: "no", replied_at: t };
    case "oldno": return { ...base, outcome: "no", replied_at: t, reply_text: "El domingo estamos cerrados" };
    case "young": return { ...base, outcome: "pending" };
    case "failed": return { ...base, sent_at: null, outcome: "send_failed" };
    case "email": return { ...base, sent_at: null, outcome: "won", accepted_at: t, offered_time: "12:00", replied_at: t };
    default: throw new Error(kind);
  }
}
const rows = (...spec) => spec.map(([h, k]) => ask(h, k));
const R = (r, inbound = [], unrested = false) => M.restInfo(r, inbound, unrested, NOW);
const resting = (r, inbound, unrested) => R(r, inbound, unrested).resting;

// --- (a) last 5 asks, no yes ----------------------------------------------
check("5 asks, no yes -> rest", resting(rows([10, "silent"], [20, "auto"], [30, "declined"], [40, "silent"], [50, "auto"])), true);
check("4 asks, no yes -> not (fewer than 5)", resting(rows([10, "auto"], [20, "declined"], [30, "auto"], [40, "declined"])), false);
check("a yes in the last 5 -> not", resting(rows([10, "silent"], [20, "auto"], [30, "yes"], [40, "silent"], [50, "auto"])), false);
check("a yes only in ask 6 -> rest (KamAI: early yes, then 5 without)", resting(rows([10, "auto"], [20, "auto"], [30, "auto"], [40, "auto"], [50, "auto"], [60, "won"])), true);
check("auto-replies only -> rest", resting(rows([3, "auto"], [26, "auto"], [50, "auto"], [74, "auto"], [98, "auto"])), true);
check("declines only -> rest (a 'No podemos' is not a yes)", resting(rows([3, "declined"], [26, "declined"], [50, "declined"], [74, "declined"], [98, "declined"])), true);
check("offered another hour counts as a yes", resting(rows([10, "silent"], [20, "auto"], [30, "offered"], [40, "silent"], [50, "auto"])), false);
check("a price counts as a yes", resting(rows([10, "silent"], [20, "auto"], [30, "price"], [40, "silent"], [50, "auto"])), false);
check("customer said no to the studio's offer: still the studio's yes", resting(rows([10, "custno"], [20, "auto"], [30, "auto"], [40, "silent"], [50, "auto"])), false);
check("old outcome 'no' with no offer is not a yes", resting(rows([10, "oldno"], [20, "auto"], [30, "auto"], [40, "silent"], [50, "auto"])), true);
check("young pending ask ignored: 4 old + 1 young -> not", resting(rows([0.5, "young"], [20, "auto"], [30, "auto"], [40, "silent"], [50, "auto"])), false);
check("young pending ignored, 5 old behind it -> rest", resting(rows([0.5, "young"], [20, "auto"], [30, "auto"], [40, "silent"], [50, "auto"], [60, "declined"])), true);
check("young ask with an offered hour is still a yes", resting(rows([0.5, "offered"], [20, "auto"], [30, "auto"], [40, "auto"], [50, "auto"])), false);
check("a pending ask older than 2h counts", resting(rows([3, "young"], [20, "auto"], [30, "auto"], [40, "auto"], [50, "auto"])), true);
check("send_failed rows are not asks", resting(rows([1, "failed"], [2, "failed"], [20, "auto"], [30, "auto"], [40, "auto"], [50, "auto"])), false);
check("offer email (no sent_at) counts as an ask with a yes", resting(rows([5, "email"], [20, "auto"], [30, "auto"], [40, "auto"], [50, "auto"])), false);
check("why names the five", R(rows([10, "silent"], [20, "auto"], [30, "declined"], [40, "silent"], [50, "auto"])).why, "last 5 asks with no yes since 29 Oct (2 no reply, 2 replied without a yes, 1 declined)");
check("last5 record, newest first", R(rows([10, "yes"], [20, "auto"], [30, "declined"], [40, "silent"], [50, "auto"])).last, ["yes", "replied without a yes", "declined", "no reply", "replied without a yes"]);

// --- v37 folded in: 3 asks, never a reply ----------------------------------
check("3 silent asks -> rest (v37)", resting(rows([10, "silent"], [20, "silent"], [30, "silent"])), true);
check("3 silent asks, why", R(rows([10, "silent"], [20, "silent"], [30, "silent"])).why, "3 asks and never a reply");
check("2 silent asks -> not", resting(rows([10, "silent"], [20, "silent"])), false);
check("3 asks, one auto-reply -> not (v37 needs no reply at all; (a) needs 5)", resting(rows([10, "silent"], [20, "auto"], [30, "silent"])), false);

// --- (b) opt-out words -----------------------------------------------------
const optOut = (t) => M.optOutWords([t]) !== null;
check("'No me interesa. Gracias' -> opt-out (Masajes Chamberí, 5 Sept)", optOut("No me interesa. Gracias"), true);
check("'No me interesa seguir con vosotros' -> opt-out (Centro Aloha)", optOut("No me interesa seguir con vosotros"), true);
check("'Baja' -> opt-out", optOut("Baja"), true);
check("'BAJA' -> opt-out (Oasis Hammam)", optOut("BAJA"), true);
check("'Baja .\\n\\nGracias' -> opt-out (Masajes Camino)", optOut("Baja .\n\nGracias"), true);
check("'Por favor, dadnos de baja' -> opt-out", optOut("Por favor, dadnos de baja"), true);
check("'Queremos darnos de baja' -> opt-out", optOut("Queremos darnos de baja de esto"), true);
check("'No nos escribáis más' -> opt-out", optOut("No nos escribáis más, gracias"), true);
check("'no me escribas mas' -> opt-out", optOut("no me escribas mas"), true);
check("'No estamos interesados' -> opt-out", optOut("No estamos interesados, un saludo"), true);
check("'no se molesten en escribirnos' -> opt-out (Meissa)", optOut("Si no hay contacto previo no se molesten en escribirnos"), true);
check("'bajamos el precio' must NOT match", optOut("Si queréis bajamos el precio a 50€"), false);
check("'la masajista está de baja' must NOT match (on leave)", optOut("Esta semana la masajista está de baja, lo siento"), false);
check("'No podemos' must NOT match", optOut("No podemos"), false);
check("'nos interesa, ¿cómo funciona?' must NOT match", optOut("Sí, nos interesa, ¿cómo funciona?"), false);
check("'necesitamos que alguien nos contacte' must NOT match (The Nook)", optOut("Por favor, necesitamos que alguien de vuestra empresa nos contacte"), false);
check("'Gracias por contactar con ...' auto-reply must NOT match", optOut("Gracias por contactar con Baan Bua Thai Massage Madrid. ¿En qué podemos ayudarte?"), false);
check("'Baja del 3 al 10' (a price going down) must NOT match", optOut("El precio baja a 45€ entre semana"), false);
check("opt-out rests even with a yes on record", resting(rows([10, "yes"]), ["No me interesa. Gracias"]), true);
check("opt-out is flagged optOut", R(rows([10, "yes"]), ["Baja"]).optOut, true);
check("opt-out with no asks at all -> rest", resting([], ["BAJA"]), true);
check("why quotes the words that matched, not the start of a long message (Meissa)",
  R([], ["Antes de enviarnos nada, necesitamos saber con quiénes trabajamos, condiciones, etc. Si no hay contacto previo no se molesten en escribirnos. Gracias"]).why,
  "wrote \"...Si no hay contacto previo no se molesten en escribirnos. Gracias\"");
check("why for a short opt-out is the whole message", R([], ["No me interesa. Gracias"]).why, "wrote \"No me interesa. Gracias\"");

// --- override: DISPATCH_UNREST --------------------------------------------
const five = rows([10, "silent"], [20, "auto"], [30, "declined"], [40, "silent"], [50, "auto"]);
check("override id -> not rested by (a)", resting(five, [], true), false);
check("override id -> not rested by (b)", resting(five, ["No me interesa"], true), false);
check("override id -> not rested by v37", resting(rows([10, "silent"], [20, "silent"], [30, "silent"]), [], true), false);
const U = M.parseUnrest(" 6F0b-AAA , 7c1d-bbb;\n8e2e-ccc ");
check("parseUnrest: commas, spaces, case", [...U.keys()], ["6f0b-aaa", "7c1d-bbb", "8e2e-ccc"]);
check("parseUnrest: a bare id is for good", [...U.values()], [true, true, true]);
check("parseUnrest: missing key is empty", M.parseUnrest("").size, 0);
const U2 = M.parseUnrest("aaa@2026-11-03, bbb@3-Nov, ccc");
check("parseUnrest: id@date is a time", U2.get("aaa"), Date.parse("2026-11-03T00:00:00Z"));
check("parseUnrest: a date it cannot read counts as a bare id", [U2.get("bbb"), U2.get("ccc")], [true, true]);

// --- review fix 11: id@date brings a studio back with a fresh window -------
{
  const since = NOW - 60 * 3600e3; // 60h ago
  const old5 = rows([70, "silent"], [80, "auto"], [90, "declined"], [100, "silent"], [110, "auto"]);
  check("since: 5 no-yes asks before the date do not rest it", resting([...old5, ...rows([10, "silent"], [20, "auto"])], [], since), false);
  check("since: awake and never said yes is still eligible (Jordan called it)", R(old5, [], since).eligible, true);
  check("since: 5 no-yes asks after the date rest it again", resting([...old5, ...rows([10, "silent"], [20, "auto"], [30, "declined"], [40, "silent"], [50, "auto"])], [], since), true);
  check("since: an opt-out before the date is forgiven", resting(old5, [{ body: "No me interesa", created_at: ago(65) }], since), false);
  check("since: an opt-out after the date rests it", resting(old5, [{ body: "No me interesa", created_at: ago(5) }], since), true);
  check("bare id: an opt-out does not rest it (today's behaviour)", resting(old5, [{ body: "No me interesa", created_at: ago(5) }], true), false);
}

// --- planAsks: eligible only, incoming order, cap, named lists -------------
// (review fixes 2, 3, 5: no yes-first sort, no fallback, a named list skips
// only opt-outs)
const C = (id) => ({ id, business_name: id });
const info = (m) => new Map(Object.entries(m));
const I = (o) => ({ resting: false, eligible: false, why: "", optOut: false, yesEver: false, unrested: false, last: [], ...o });
const ids = (p) => p.ask.map((c) => c.id);
{
  const cands = ["a", "b", "c", "d", "e", "f", "g"].map(C);
  const m = info({
    a: I({}), b: I({ yesEver: true, eligible: true }), c: I({ resting: true, why: "x", yesEver: true }),
    d: I({ unrested: true, eligible: true }), e: I({ yesEver: true, eligible: true }), f: I({}),
    g: I({ resting: true, optOut: true, why: "wrote \"BAJA\"" }),
  });
  check("only eligible, in the order they came in", ids(M.planAsks(cands, m, { cap: 4 })), ["b", "d", "e"]);
  check("cap trims the eligible", ids(M.planAsks(cands, m, { cap: 2 })), ["b", "d"]);
  check("resting reported, not asked", M.planAsks(cands, m, { cap: 4 }).resting.map((c) => c.id), ["c", "g"]);
  check("no yes on record reported, not asked", M.planAsks(cands, m, { cap: 4 }).noYes.map((c) => c.id), ["a", "f"]);
  check("Jordan's unrested studio with no yes yet is asked (a new studio he called)", ids(M.planAsks([C("d"), C("a")], m, { cap: 4 })), ["d"]);
  check("cap 0 (four already asked) asks nobody", ids(M.planAsks(cands, m, { cap: 0 })), []);
  check("nobody eligible: nobody asked, no fallback", ids(M.planAsks([C("a"), C("c"), C("f")], m, { cap: 4 })), []);
  const named = M.planAsks([C("c"), C("a"), C("g"), C("b")], m, { cap: 4, named: true });
  check("named list: keeps its order, skips only the opt-out", ids(named), ["c", "a", "b"]);
  check("named list: the opt-out is reported as resting", named.resting.map((c) => c.id), ["g"]);
  check("named list: picks asked although resting or with no yes are named for Jordan", named.askedAnyway.map((c) => c.id), ["c", "a"]);
  check("named list: cap still holds", ids(M.planAsks([C("c"), C("a"), C("b")], m, { cap: 2, named: true })), ["c", "a"]);
}
// RestInfo.eligible
check("eligible: a yes on record, awake", R(rows([10, "yes"], [20, "auto"])).eligible, true);
check("eligible: no yes on record -> not eligible", R(rows([10, "auto"], [20, "auto"])).eligible, false);
check("eligible: never asked -> not eligible", R([]).eligible, false);
check("eligible: brought back with no yes -> eligible", R([], [], true).eligible, true);
check("eligible: resting with a yes on record -> not eligible", R(rows([10, "silent"], [20, "auto"], [30, "declined"], [40, "silent"], [50, "auto"], [60, "yes"])).eligible, false);

// --- review fix 10: offered_times alone is a yes ----------------------------
check("offered_times alone is a yes (Centro Aloha #84)", M.studioSaidYes({ outcome: "pending", replied_at: ago(5), offered_time: null, offered_times: ["15:00"] }), true);
check("an empty offered_times is not a yes", M.studioSaidYes({ outcome: "pending", replied_at: ago(5), offered_time: null, offered_times: [] }), false);

// --- review fix 1: asks another studio answered first do not count ----------
{
  // One ask per request: this studio's row, plus another studio's yes `gapMin`
  // minutes after it (negative: before it).
  const rq = (n, h, kind, gapMin) => {
    const mine = { ...ask(h, kind), request_id: n, partner_id: "p" };
    const other = gapMin === null ? [] : [{ request_id: n, partner_id: "q", outcome: "pending", sent_at: ago(h), created_at: ago(h), replied_at: ago(h - gapMin / 60), offered_at: ago(h - gapMin / 60), offered_time: "18:00" }];
    return { mine, other };
  };
  const build = (spec) => {
    const parts = spec.map(([n, h, kind, gap]) => rq(n, h, kind, gap));
    return M.coverAsks(parts.map((x) => x.mine), parts.flatMap((x) => [x.mine, ...x.other]));
  };
  // Selvarrosa-like: three silent asks closed by another's yes within minutes,
  // two more silent asks nobody answered, and a yes behind them.
  const selva = build([[107, 10, "silent", 8], [91, 20, "silent", 1], [89, 30, "silent", 3], [87, 40, "silent", null], [85, 50, "auto", null], [84, 60, "offered", null], [82, 70, "offered", null]]);
  check("covered: _covered stamped from the other studio's yes", typeof selva[0]._covered, "number");
  check("covered: three asks answered by another studio first do not count", resting(selva), false);
  check("covered: the last 5 skip them", R(selva).last, ["no reply", "replied without a yes", "yes", "yes"]);
  const late = build([[1, 10, "silent", 180], [2, 20, "silent", 180], [3, 30, "silent", 180], [4, 40, "silent", 180], [5, 50, "silent", 180], [6, 60, "yes", null]]);
  check("covered: a yes 3h after the ask leaves it counted", resting(late), true);
  const declined = build([[1, 10, "declined", 2], [2, 20, "declined", 2], [3, 30, "declined", 2], [4, 40, "declined", 2], [5, 50, "declined", 2], [6, 60, "yes", null]]);
  check("covered: a studio that replied (No podemos) still counts", resting(declined), true);
  const before = build([[1, 10, "silent", -30], [2, 20, "silent", -30], [3, 30, "silent", -30], [4, 40, "silent", -30], [5, 50, "silent", -30], [6, 60, "yes", null]]);
  check("covered: a yes given before the ask went out does not cover it", resting(before), true);
  const own = M.coverAsks([{ ...ask(10, "silent"), request_id: 9 }], [{ ...ask(10, "yes"), request_id: 9, partner_id: "p" }]);
  check("covered: the studio's own yes on another row never covers it", own[0]._covered, undefined);
}

// --- review fix 9: opt-out words, new forms, and a yes since ----------------
check("'No nos mandes más mensajes' -> opt-out", optOut("No nos mandes más mensajes"), true);
check("'No nos envíen más mensajes por favor' -> opt-out", optOut("No nos envíen más mensajes por favor"), true);
check("'no me contactes más' -> opt-out", optOut("no me contactes más"), true);
{
  const msgAt = NOW - 5 * 3600e3;
  const offer = { ...ask(6, "offered"), replied_at: new Date(msgAt + 2000).toISOString(), offered_at: new Date(msgAt + 2000).toISOString() };
  const desc = [{ body: "No nos interesa hacer descuento, pero tenemos hueco a las 17:00", created_at: new Date(msgAt).toISOString() }];
  check("'No nos interesa hacer descuento, pero tenemos hueco' with its own offered hour -> not resting", resting([offer], desc), false);
  check("same words with no yes after them -> opt-out", resting(rows([20, "yes"]), desc), true);
  check("a later yes forgives an earlier 'No me interesa'", resting([offer], [{ body: "No me interesa", created_at: ago(30) }]), false);
}

// --- review fix 6: customer cancel words, whole words only ------------------
for (const t of ["What is your cancellation policy?", "¿Cuál es la política de cancelación?", "anulación", "[tap: cancel_121]", "[tap: rc_cancel_48]", "I cancelled my other plans so any time works"]) {
  check(`cancel guard ignores ${JSON.stringify(t)}`, M.blockedReason("new", [t]), null);
}
for (const t of ["cancel", "Cancel Please", "Cancelar", "Cancelamos la solicitud de cita", "Quiero anular la cita", "please cancel it", "cancela porfa"]) {
  check(`cancel guard stops on ${JSON.stringify(t)}`, M.blockedReason("new", [t])?.words, true);
}

// --- dispatch-time guard ---------------------------------------------------
check("open stage, nothing said -> go", M.blockedReason("new", ["Hi, any time after 5 is fine"]), null);
check("stage cancelled -> stop", M.blockedReason("cancelled", []), { why: "stage is cancelled", words: false });
check("stage confirmed -> stop", M.blockedReason("confirmed", []).why, "stage is confirmed");
check("customer wrote 'cancel' -> stop (Fahad #121)", M.blockedReason("new", ["cancel"]), { why: "the customer wrote \"cancel\"", words: true });
check("customer wrote 'Quiero cancelar' -> stop", M.blockedReason("studio_asked", ["Quiero cancelar la cita"]).words, true);
check("customer wrote 'anula la reserva' -> stop", M.blockedReason("new", ["anula la reserva porfa"]).words, true);
check("'granulado' is not 'anula'", M.blockedReason("new", ["exfoliante granulado?"]), null);
check("force_dispatch skips the words, never the stage", [M.blockedReason("new", ["cancel"], true), M.blockedReason("dismissed", ["cancel"], true)?.why], [null, "stage is dismissed"]);
check("needs_contact is still open (Jordan re-dispatches it)", M.blockedReason("needs_contact", []), null);

// --- stage_note append keeps the new line whole -----------------------------
check("appendNote on empty", M.appendNote("", "not dispatched: x"), "not dispatched: x");
check("appendNote keeps the new line when the note is full", M.appendNote("y".repeat(600), "not dispatched: x").endsWith("; not dispatched: x") && M.appendNote("y".repeat(600), "not dispatched: x").length === 500, true);

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`FAIL ${f.name}\n  got  ${JSON.stringify(f.got)}\n  want ${JSON.stringify(f.want)}`);

// --- who rests today (SELECT-only dump) ------------------------------------
if (todayFile) {
  const dump = JSON.parse(readFileSync(todayFile, "utf8"));
  const unrest = M.parseUnrest(dump.unrest || "");
  const now = Date.parse(dump.now);
  const out = [];
  for (const p of dump.partners) {
    // Each ask comes as [ts, outcome, sent, replied, accepted, offered, price, custAnswer]
    const rs = p.asks.map(([ts, outcome, sent, replied, acc, off, price, cust]) => ({
      created_at: ts, sent_at: sent ? ts : null, outcome, replied_at: replied ? ts : null,
      accepted_at: acc ? ts : null, offered_time: off ? "x" : null, quoted_price: price ? 1 : null, customer_answer: cust ? "x" : null,
    }));
    const r = M.restInfo(rs, p.inbound || [], unrest.has(String(p.id).toLowerCase()), now);
    out.push({ name: p.name, opted_out: !!p.opted_out, asks: rs.filter(M.reachedStudio).length, yes: rs.filter(M.studioSaidYes).length, ...r });
  }
  console.log(JSON.stringify(out));
}
// --- who rests today after the review fixes (SELECT-only dump) ------------
// node rest_test.mjs --today-rv today_rv.json
const rvAt = args.indexOf("--today-rv");
if (rvAt >= 0) {
  const dump = JSON.parse(readFileSync(args[rvAt + 1], "utf8"));
  const unrest = M.parseUnrest(dump.unrest || "");
  const now = Date.parse(dump.now);
  const iso = (t) => (t ? new Date(t * 1000).toISOString() : null);
  const pidOf = new Map(dump.partners.map(([i, id]) => [i, id]));
  const all = dump.rows.map(([req, i, outcome, sent, created, replied, acc, offAt, off, offs, price, cust]) => ({
    request_id: req, partner_id: pidOf.get(i), outcome, sent_at: iso(sent), created_at: iso(created), replied_at: iso(replied),
    accepted_at: iso(acc), offered_at: iso(offAt), offered_time: off ? "x" : null, offered_times: Array(offs).fill("x"),
    quoted_price: price ? 1 : null, customer_answer: cust ? "x" : null,
  }));
  const covered = M.coverAsks(all, all);
  const out = [];
  for (const [i, id, name, optedOut] of dump.partners) {
    const rs = covered.filter((x) => x.partner_id === id);
    const inbound = dump.inbound.filter(([j]) => j === i).map(([, t, body]) => ({ body, created_at: iso(t) }));
    const r = M.restInfo(rs, inbound, unrest.get(String(id).toLowerCase()) ?? false, now);
    const reached = rs.filter(M.reachedStudio);
    out.push({ name, opted_out: optedOut, asks: reached.length, yes: rs.filter(M.studioSaidYes).length, covered: reached.filter((x) => !M.studioSaidYes(x) && !x.replied_at && x._covered && x._covered - Date.parse(x.sent_at || x.created_at) < M.REST_YOUNG_MS).length, ...r });
  }
  console.log(JSON.stringify(out));
}
if (failures.length) process.exit(1);
