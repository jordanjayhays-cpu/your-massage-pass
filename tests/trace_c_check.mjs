// Checks for the studio messages on request #126 (19 Nov 2026), trace C.
//
// What went wrong, with invented names below (the repo is public):
//   1. The confirmation to the winning studio read "not sure de 60 min" while
//      the ask had said "un masaje relajante de 60 min". acceptOffer read
//      row.asked_service (no such column) and then copy.ts trSvc, which passes
//      "Not sure" straight through.
//   2. A studio answered dispatch-studios' stand-down with "Ok" and got a
//      second stand-down (wa-bot's coveredLine), because only coveredLine's own
//      words counted as "told".
//   3. A studio we had written to 32 times got "Hola, soy Jordan, de Massage
//      Club" on its stand-down: aviso_centro_v2 is always tried first.
//
// Like tests/replay.mjs, this runs the real code: the block between "studio
// words: pure helpers (start)" and "(end)" in bot.ts, and servicioFrase and
// noteTplOrder from dispatch-studios, are cut out, their types stripped, and
// imported. Nothing touches a database or the network.
//
// Run: node --experimental-strip-types tests/trace_c_check.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const botSrc = fs.readFileSync(path.join(root, "supabase/functions/wa-bot/bot.ts"), "utf8");
const dsSrc = fs.readFileSync(path.join(root, "supabase/functions/dispatch-studios/index.ts"), "utf8");

let pass = 0;
const failures = [];
function check(group, input, got, want, note = "") {
  if (typeof got === "function") { try { got = got(); } catch (e) { got = `threw: ${e.message}`; } }
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else failures.push({ group, input, got, want, note });
}
const lift = (src, head) => { const i = src.indexOf(head); if (i < 0) throw new Error(`missing: ${head}`); return src.slice(i, src.indexOf("\n}\n", i) + 3); };
const liftConst = (src, head, end) => { const i = src.indexOf(head); if (i < 0) throw new Error(`missing: ${head}`); return src.slice(i, src.indexOf(end, i) + end.length); };
const body = (src, head) => { try { return lift(src, head); } catch { return ""; } };

// ---------------------------------------------------------------------------
// Load the code under test.
// ---------------------------------------------------------------------------
const a = botSrc.indexOf("studio words: pure helpers (start)");
const b = botSrc.indexOf("studio words: pure helpers (end)");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trace-c-"));
// Today (before the fix) the block is missing: every behaviour check below
// then fails through these stand-ins, and the source guards say what is wrong.
const missing = () => "MISSING: bot.ts has no studio words helper block";
let W = { askServicio: missing, askedWhat: missing, custSvc: missing, plainStudioAck: missing, STUDIO_ENDED_RE: { test: missing }, endedToldIn: missing, afterEndedAction: missing, noteTplOrder: missing };
if (a >= 0 && b > a) {
  const botMod = path.join(tmp, "bot_words.ts");
  fs.writeFileSync(botMod, stripTypeScriptTypes(botSrc.slice(botSrc.lastIndexOf("\n", a), b))
    + "\nexport { askServicio, askedWhat, custSvc, plainStudioAck, STUDIO_ENDED_RE, endedToldIn, afterEndedAction, noteTplOrder };\n");
  W = await import(pathToFileURL(botMod).href);
}
const dsMod = path.join(tmp, "ds_words.ts");
const dsNote = dsSrc.includes("function noteTplOrder(") ? lift(dsSrc, "function noteTplOrder(") : "function noteTplOrder() { return \"MISSING: dispatch-studios has no noteTplOrder\"; }\n";
fs.writeFileSync(dsMod, stripTypeScriptTypes([
  liftConst(dsSrc, "const SVC_FRASE:", "\n];\n"),
  lift(dsSrc, "function ownServicio("),
  lift(dsSrc, "function servicioFrase("),
  liftConst(dsSrc, "const reqDuration = (r", "\n};\n"),
  dsNote,
].join("\n")) + "\nexport { servicioFrase, noteTplOrder };\n");
const D = await import(pathToFileURL(dsMod).href);

// ---------------------------------------------------------------------------
// 1. The confirmation repeats the ask's service words.
// ---------------------------------------------------------------------------
const names = ["Not sure", "Any", "", "Massage", "massage treatment", "Masaje", "Relaxing massage", "Swedish massage",
  "Deep tissue massage", "Thai massage", "Hot stone massage", "Sports massage", "Balinese massage", "Shiatsu",
  "Reflexology", "Lymphatic drainage", "Couples massage", "Kobido facial massage", "Prenatal massage",
  "Head massage", "Foot massage", "Four hands massage", "Gua sha", "Aromatherapy massage", "Help me figure it out"];
for (const n of names) for (const mins of [60, 90]) {
  const r = { service_name: n, message_text: mins === 60 ? "Quiere: x" : `Quiere: x | Duración: ${mins} min` };
  check("ask parity (bot askServicio = dispatch-studios servicioFrase)", `${n || "(empty)"} ${mins}`, W.askServicio(n, mins), D.servicioFrase(r), "the two tables must never drift");
}
check("#126 confirmation words", "Not sure, no asked_service", W.askedWhat(null, "Not sure", 60), "masaje relajante de 60 min", "Calma read 'not sure de 60 min'");
check("#126 confirmation words", "Any", W.askedWhat(undefined, "Any", 60), "masaje de 60 min", "the ask's own default for a name it cannot map");
check("#126 confirmation words", "empty", W.askedWhat("", "", 60), "masaje de 60 min", "");
check("#126 confirmation words", "unknown name", W.askedWhat("", "Aromatherapy massage", 90), "masaje de 90 min", "never pasted in raw");
check("#126 confirmation words", "stored phrase wins", W.askedWhat("masaje tailandés de 60 min con presión firme", "Sports massage", 60), "masaje tailandés de 60 min con presión firme", "a studio asked for its own service hears it back");
check("#126 confirmation words", "stored phrase with article", W.askedWhat("un masaje relajante de 60 min", "Not sure", 60), "masaje relajante de 60 min", "");
// The text the studio read, built the way acceptOffer builds it.
const fn = "Ana Prueba";
const studioText = `Hola, ${fn} ha dicho que sí, así que queda confirmado: hoy a las 13:30, ${W.askedWhat(null, "Not sure", 60)}, 76,50 €. Ya podéis apuntarlo.`;
check("#126 confirmation words", "studio text", /not sure/i.test(studioText), false, studioText);

// Customers read the same massage, never "Not sure".
const cust = [["Not sure", "Relaxing massage"], ["Help me figure it out", "Relaxing massage"], ["Massage", "Relaxing massage"],
  ["", "Massage"], [null, "Massage"], ["Any", "Massage"], ["Deep tissue massage", "Deep tissue massage"], ["Couples massage", "Couples massage"]];
for (const [n, want] of cust) check("custSvc", String(n), W.custSvc(n), want, "customer confirmation email, offer page, reminders");

// Source guards: every place that printed the raw name now goes through these.
const accept = body(botSrc, "async function acceptOffer(");
check("source", "acceptOffer uses askedWhat", /askedWhat\(row\.asked_service, req\.service_name, reqDuration\(req\)\)/.test(accept), true);
check("source", "acceptOffer has no raw trSvc", /trSvc\(req\.service_name/.test(accept), false);
const cce = body(botSrc, "async function customerConfirmEmail(");
check("source", "customerConfirmEmail prints custSvc", /custSvc\(req\.service_name\)/.test(cce) && !/req\.service_name \|\| "Massage"/.test(cce) && !/req\.service_name \|\| "massage"/.test(cce), true);
check("source", "ensureBooking massage_type is custSvc", /massage_type: custSvc\(req\.service_name\)/.test(botSrc), true, "send-booking-reminders prints it");
check("source", "offer page body uses custSvc", /trSvc\(custSvc\(req\.service_name\), L\)/.test(botSrc), true);
check("source", "dispatch-studios stores asked_service", /asked_service: servicioFrase\(r, opts\.serviceBy\?\.\[String\(c\.id\)\] \|\| ""\)/.test(dsSrc), true);
check("source", "migration adds asked_service", fs.existsSync(path.join(root, "supabase/migrations/20261119_dispatch_asked_service.sql")), true);

// ---------------------------------------------------------------------------
// 2. A plain acknowledgement after a stand-down or a confirmation gets nothing.
// ---------------------------------------------------------------------------
const acks = ["Ok", "ok", "OK.", "Vale", "vale, gracias", "Gracias", "Muchas gracias!", "Perfecto", "perfecto 👍", "👍", "🙏",
  "De acuerdo", "Ok gracias 😊", "Genial, gracias", "Entendido", "Vale, no te preocupes", "Perfecto, un saludo", "Gracias igualmente", "Recibido"];
for (const t of acks) check("plainStudioAck yes", t, W.plainStudioAck(t), true);
const notAcks = ["Ok, ¿y mañana?", "podemos a las 15:30", "Vale, tenemos hueco mañana", "No", "si", "Sí, tenemos hueco", "76,50€",
  "Vale, no te preocupes, quedo super atenta para cuando quieras agendar 🥰", "Si, llegó a las 13:50", "", "Ok pero la clienta no ha llegado", "¿Viene?"];
for (const t of notAcks) check("plainStudioAck no", t, W.plainStudioAck(t), false, "anything with news in it reaches Jordan");

// Every way a studio is told an ask ended counts as told.
const ended = [
  "Hola, lo de Ana Prueba de hoy a las 13:30 ya está cubierto, así que no hace falta que le guardéis hueco. Gracias, a la próxima.",
  "Hola, soy Jordan, de Massage Club. Os escribo por el masaje de Ana Prueba de hoy a las 13:30. Ya está cubierto, así que no hace falta que le guardéis hueco.\n\nGracias.",
  "Aviso de Massage Club sobre la cita de Ana Prueba de hoy a las 13:30: ya está cubierto, así que no hace falta que le guardéis hueco. Gracias por vuestra paciencia.",
  "Hola, os escribo por el masaje de Ana Prueba de hoy a las 13:30. Ya está cubierto, así que no hace falta que le guardéis hueco.\n\nGracias.",
];
for (const t of ended) check("STUDIO_ENDED_RE", t.slice(0, 60), W.STUDIO_ENDED_RE.test(t), true);
// Every ending dispatch-studios and coveredLine can send, read from the source.
const ends = [body(dsSrc, "function standDownNote("), body(dsSrc, "function standDownEmail(")].join("\n");
const endLits = [...ends.matchAll(/(?:v2|v1): "([^"]+)"|"((?:Al final|Ha cambiado|Ya lo ha)[^"]+)"/g)].map((m) => m[1] || m[2]);
check("STUDIO_ENDED_RE", "dispatch-studios endings found", endLits.length >= 9, true, String(endLits.length));
for (const t of endLits) check("STUDIO_ENDED_RE dispatch-studios", t.slice(0, 60), W.STUDIO_ENDED_RE.test(t), true);
const cov = liftConst(botSrc, "const coveredLine = ", "\n};\n");
const covLits = [...cov.matchAll(/return `([^`]+)`/g)].map((m) => m[1]);
check("STUDIO_ENDED_RE", "coveredLine endings found", covLits.length, 4);
for (const t of covLits) check("STUDIO_ENDED_RE coveredLine", t.slice(0, 60), W.STUDIO_ENDED_RE.test(t), true);
// Messages that are not an ending.
const notEnded = [
  "Hola, ¿tenéis hueco hoy a las 13:30 para un masaje relajante de 60 min? El cliente se llama Ana Prueba.",
  "Vale, gracias. Lo confirmo con Ana Prueba y os digo algo en cuanto me conteste.",
  "Ahora mismo no consigo localizar a Ana Prueba, así que todavía no está reservado y no hace falta que le guardéis el hueco. Si me contesta, os escribo enseguida.",
  "Hola, Ana Prueba ha dicho que sí, así que queda confirmado: hoy a las 13:30, masaje relajante de 60 min. Ya podéis apuntarlo.",
];
for (const t of notEnded) check("STUDIO_ENDED_RE not", t.slice(0, 60), W.STUDIO_ENDED_RE.test(t), false);

// Replay of #126: what the studio that had the stand-down gets for "Ok".
const thread = [
  "Hola, ¿tenéis hueco hoy a las 13:30 para un masaje relajante de 60 min? El cliente se llama Ana Prueba.\nEstoy preguntando a varios centros y se queda con la mejor oferta. Si podéis hacerle un 10% como cliente de Massage Club, decídmelo. [Sí, tenemos hueco/Otra hora/No podemos]",
  "Hola, lo de Ana Prueba de hoy a las 13:30 ya está cubierto, así que no hace falta que le guardéis hueco. Gracias, a la próxima.",
];
check("replay #126", "Ok after dispatch-studios' stand-down", W.afterEndedAction(W.endedToldIn(thread), "Ok"), "quiet", "it got 'ya ha reservado en otro centro' a second time");
check("replay #126", "a question after the stand-down", W.afterEndedAction(W.endedToldIn(thread), "¿Y para mañana?"), "card", "Jordan sees it, nothing is said back");
check("replay #126", "never told, writes", W.afterEndedAction(W.endedToldIn(thread.slice(0, 1)), "Ok"), "covered", "the stand-down is said once");
const sd = (() => { const i = botSrc.indexOf("const told = lastOut === cl"); return i < 0 ? "" : botSrc.slice(i, i + 900); })();
check("source", "stand-down branch reads what was sent", /studioToldEnded\(from, String\(sdrow\.created_at/.test(sd) && /afterEndedAction\(told, freeText\)/.test(sd), true);
check("source", "STUDIO_THANKS is no longer sent", /sendText\(from, STUDIO_THANKS\)/.test(botSrc), false);
check("source", "stand-down query selects created_at", /outcome=in\.\(stood_down,lost,declined,expired\)[^`]*select=id,request_id,outcome,created_at/.test(botSrc), true);
check("source", "a plain ok to a confirmation is quiet", /if \(!req && plainStudioAck\(freeText\)\)[\s\S]{0,900}after: "confirmation"/.test(botSrc), true, "no 'the studio is trying to reach you' ping to the customer");

// ---------------------------------------------------------------------------
// 3. Only a number we have never written to is introduced.
// ---------------------------------------------------------------------------
for (const known of [true, false]) for (const v1ok of [true, false]) {
  check("noteTplOrder parity", `${known}/${v1ok}`, W.noteTplOrder(known, v1ok), D.noteTplOrder(known, v1ok));
}
check("noteTplOrder", "known studio, v1 can carry it", W.noteTplOrder(true, true), ["aviso_centro_v3", "aviso_centro_v1", "aviso_centro_v2"], "Selvarrosa: no 'soy Jordan' while v1 is live");
check("noteTplOrder", "known studio, never v2 first", W.noteTplOrder(true, false)[0], "aviso_centro_v3");
check("noteTplOrder", "never written to: introduced", W.noteTplOrder(false, true)[0], "aviso_centro_v2");
const v3 = "Hola, os escribo por el masaje de {{1}}. {{2}}\\n\\nGracias.";
check("source", "aviso_centro_v3 body, same in both files", botSrc.includes(`aviso_centro_v3: "${v3}"`) && dsSrc.includes(`aviso_centro_v3: "${v3}"`), true);
check("source", "v3 has no introduction and no dash", /soy Jordan|—|–/.test(v3), false);
const sn = body(dsSrc, "async function sendStudioNote(");
check("source", "sendStudioNote goes through noteTplOrder", /noteTplOrder\(known, !v1why\)/.test(sn) && !/sendTemplate\(to, "aviso_centro_v2"/.test(sn), true);
check("source", "sendStudioNote reads the outbound history", /wa_messages\?phone=eq\.\$\{to\}&direction=eq\.out/.test(sn), true);
const av = body(botSrc, "async function studioAviso(");
check("source", "studioAviso goes through noteTplOrder", /noteTplOrder\(await studioKnown\(to\), !why\)/.test(av) && !/sendTemplate\(to, "aviso_centro_v2"/.test(av), true);
const ask = body(dsSrc, "async function dispatchOne(");
check("source", "the first ask is still decided by the outbound history", /wa_messages\?phone=eq\.\$\{c\.wa\}&direction=eq\.out&limit=1/.test(ask), true);

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length) {
  for (const f of failures) console.log(`FAIL [${f.group}] ${JSON.stringify(f.input)}\n  got  ${JSON.stringify(f.got)}\n  want ${JSON.stringify(f.want)}${f.note ? `\n  (${f.note})` : ""}`);
  console.log(`\ntrace C: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`trace C: all ${pass} pass`);
