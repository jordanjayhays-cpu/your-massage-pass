// Replay harness for the WhatsApp bot's reading of real messages.
//
// Why this exists: on 9 September four bugs shipped in one afternoon and every
// one of them was found by a human reading logs after a customer had already
// been failed. Fernando asked which metro and got a service menu. Asim asked
// for 7pm while two studios had offered exactly that. TornaSol answered
// "19 horas" and it parsed to nothing. Each of those is one line in this file
// now, and `npm run replay` fails if any of them comes back.
//
// Every case below is a real message from a real conversation, with the date
// it happened. Add the message, not a paraphrase, whenever something is missed.
//
// Run: node tests/replay.mjs
// This tests the lexicon in copy.ts, which is what decides how a message is
// read before any model or network call happens.

import {
  parseOfferedTime, detectTime, detectDay, strongSpanish, isEmail,
  HI_RE, ARRIVED_RE, NOSHOW_RE, AD_OPENER_RE, ANY_RE, CANCEL_RE,
  AUTOREPLY_RE, EROTIC_RE, JOB_RE, HOURS_STATEMENT_RE, looksLikeQuestion,
  COPY,
} from "../supabase/functions/wa-bot/copy.ts";

let pass = 0;
const failures = [];

function check(group, input, got, want, note) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else failures.push({ group, input, got, want, note });
}

// ---------------------------------------------------------------------------
// Studio replies that name a time. Anything that parses wrong here either loses
// a booking or offers a customer a slot nobody has.
// ---------------------------------------------------------------------------
const times = [
  ["19 horas", "19:00", "TornaSol, 9 Sept. Parsed to nothing, the yes was lost, Asim never heard about it"],
  ["7pm?", "19:00", "Asim, 9 Sept. His own counter-offer, ignored"],
  ["7 pm", "19:00", ""],
  ["7:30pm", "19:30", ""],
  ["10am", "10:00", ""],
  ["12pm", "12:00", "noon, not midnight"],
  ["12am", "00:00", "midnight, not noon"],
  ["Nos viene bien a las 18.00", "18:00", "Calma, 9 Sept"],
  ["17h, 18h y 20h", "17:00", "FISIOBARICA, 9 Sept. Only the first is carried. Still an open bug"],
  ["18.30, 19.00", "18:30", "Calma, 9 Sept. Same open bug"],
  ["mañana jueves a las 18:00 le podríamos atender", "18:00", "Sinergia38, 9 Sept"],
  ["si coges 1h", "", "Centro Aloha, 8 Sept. A duration. Was read as a 01:00 slot and sent to a customer"],
  ["una hora", "", "duration"],
  ["1h", "", "duration"],
  ["de lunes a viernes cerramos a las 20:00 horas", "", "Calma, 7 Sept. Opening hours. 14:00 was once forwarded as a slot"],
  ["abrimos de 10 a 21", "", "opening hours range"],
  ["horario de 10:00 a 20:00", "", "opening hours"],
];
for (const [input, want, note] of times) check("parseOfferedTime", input, parseOfferedTime(input), want, note);

// ---------------------------------------------------------------------------
// A greeting is only a greeting when that is all it is. "Hola / Ya he llegado"
// matched the greeting branch on 9 Sept, which wiped Fernando's session, lost
// his language and sent him the service menu while he stood at the studio door.
// ---------------------------------------------------------------------------
const greetings = [
  ["hola", true, ""],
  ["Hi", true, ""],
  ["hey", true, ""],
  ["Hola\nYa he llegado", false, "Fernando, 9 Sept, standing at Sinergia38"],
  ["Hola, quiero un masaje mañana", false, "a greeting carrying a booking"],
  ["Hola buenas tardes hemos hablado con la directora", false, "FISIOBARICA, 8 Sept"],
];
for (const [input, want, note] of greetings) check("HI_RE (bare greeting only)", input, HI_RE.test(input.trim()), want, note);

// ---------------------------------------------------------------------------
// Arrival. ARRIVED_RE listens to STUDIOS reporting a client showed up. It does
// not and should not match a customer saying it about themselves: that is what
// the arrived intent in the model is for. This locks the split in place.
// ---------------------------------------------------------------------------
const arrivals = [
  ["ya ha llegado", true, "studio reporting the client"],
  ["ya está aquí", true, "studio"],
  ["acaba de llegar", true, "studio"],
  ["no ha llegado", true, "matches, but NOSHOW_RE must win, checked below"],
];
for (const [input, want, note] of arrivals) check("ARRIVED_RE", input, ARRIVED_RE.test(input), want, note);
check("NOSHOW beats ARRIVED", "no ha llegado", NOSHOW_RE.test("no ha llegado"), true,
  "a no-show must never be read as an arrival");

// ---------------------------------------------------------------------------
// Language. Getting this wrong sends a Spanish speaker an English menu, which
// is what happened to Fernando twice on 9 Sept.
// ---------------------------------------------------------------------------
const langs = [
  ["Voy en camino\nMetro más cercano?\nA las 16:00 estaré allí", true, "Fernando, 9 Sept. Got an English menu"],
  ["El tailandés como sería?", true, "Jose, 9 Sept"],
  ["Ya he llegado", true, ""],
  ["Hi, I'd like to book a massage. I saw you on Facebook.", false, "the ad's canned line is not the person's words"],
  ["Provide the service male or female?", false, "Asim, 9 Sept"],
];
for (const [input, want, note] of langs) check("strongSpanish", input, strongSpanish(input), want, note);

// ---------------------------------------------------------------------------
// Questions. Every one of these got a menu on 9 September instead of an answer.
// The model classifies them now, but they must at least register as questions.
// ---------------------------------------------------------------------------
const questions = [
  ["Metro más cercano?", true, "Fernando, 9 Sept"],
  ["Provide the service male or female?", true, "Asim, 9 Sept"],
  ["El tailandés como sería?", true, "Jose, 9 Sept, never wrote again"],
  ["Its how much?", true, "Asim, 9 Sept, this one was answered correctly"],
];
for (const [input, want, note] of questions) check("looksLikeQuestion", input, looksLikeQuestion(input), want, note);

// ---------------------------------------------------------------------------
// "Who does the massage?" was asked twice in six hours on 9 September, by two
// different people, and neither got an answer. It has a canned answer now
// (COPY.therapistAnswer) reached through the model's "therapist" question type.
// These are the exact words both of them used.
// ---------------------------------------------------------------------------
const therapistAsks = [
  ["Who give the Massage ?", "Instagram lead, 9 Sept 21:11. Promised an answer, never got one"],
  ["Provide the service male or female?", "Asim, 9 Sept 14:09. Got the service menu"],
];
for (const [input, note] of therapistAsks) check("therapist question reads as a question", input, looksLikeQuestion(input), true, note);

// ---------------------------------------------------------------------------
// Things that must never reach a studio or a customer.
// ---------------------------------------------------------------------------
check("AD_OPENER_RE", "Hi, I'd like to book a massage. I saw you on Facebook.",
  AD_OPENER_RE.test("Hi, I'd like to book a massage. I saw you on Facebook."), true, "");
check("AUTOREPLY_RE", "Gracias por contactar con nosotros, te responderemos lo antes posible",
  AUTOREPLY_RE.test("Gracias por contactar con nosotros, te responderemos lo antes posible"), true,
  "an out of office is not a studio saying yes");
check("EROTIC_RE", "buscas masaje erotico?", EROTIC_RE.test("buscas masaje erotico?"), true, "");
// Antonio, 10 Sept 11:54. Came off the ad, asked for a "Sensitive massage" and
// the bot said "Good choice. Which day suits you?" before he spelled it out a
// minute later and finally got the block line. The English word slipped past a
// filter that only knew the Spanish sensitivo/sensitiva.
const eroticCases = [
  ["Sensitive massage pleas", true, "Antonio, 10 Sept. Got \"Good choice\" instead of the block line"],
  ["sensitive masaje", true, ""],
  ["massage sensitive", true, ""],
  ["Whith some thing erotic", true, "Antonio's next message, this one did block"],
  // These are ordinary customers describing their body. Blocking them would be
  // far worse than the bug above: a real person turned away for asking properly.
  ["I have sensitive skin, is oil ok?", false, "a real question about skin"],
  ["my lower back is very sensitive", false, "a real question about a sore back"],
  ["sensitive areas after surgery", false, ""],
];
for (const [input, want, note] of eroticCases) check("EROTIC_RE", input, EROTIC_RE.test(input), want, note);
check("JOB_RE", "hola busco trabajo de masajista", JOB_RE.test("hola busco trabajo de masajista"), true,
  "therapists reach us through the same ads");
check("ANY_RE", "me da igual", ANY_RE.test("me da igual"), true,
  "no location preference. 12 of the last 47 requests");
check("ANY_RE", "anywhere", ANY_RE.test("anywhere"), true, "");
check("CANCEL_RE", "quiero cancelar", CANCEL_RE.test("quiero cancelar"), true, "");
check("isEmail", "asim.s15d@gmail.com", isEmail("asim.s15d@gmail.com"), true, "");
check("isEmail", "not an email", isEmail("not an email"), false, "");

// ---------------------------------------------------------------------------
// A promise the bot makes here is read by a cron somewhere else.
//
// When the bot cannot answer a question it sends COPY[lang].willFindOut, which
// says we are finding out and will come back. stuck-booking-rescue v10 decides
// whether a customer is still owed an answer by looking for these exact words
// in the last thing we said to them, and stays silent if it finds them.
//
// That regex lives in the deployed function, not in this repo, so nothing in a
// compiler will notice if this copy is reworded. If the two drift apart the
// cron goes back to sending a cheerful "just checking in" over the top of an
// unanswered question, which is what happened to the Instagram lead on
// 9 September: they asked "Who give the Massage ?" at 21:11, got this promise
// four seconds later, and got the generic nudge at 09:00 the next morning.
//
// Keep this regex identical to WILL_FIND_OUT_RE in stuck-booking-rescue.
// ---------------------------------------------------------------------------
const RESCUE_PROMISE_RE = /(I am finding out for you now|rather check than guess|lo consulto ahora mismo y te digo|Prefiero confirmarlo antes que)/i;
for (const lang of ["en", "es"]) {
  check("rescue cron still recognises willFindOut", `${lang}: ${COPY[lang].willFindOut}`,
    RESCUE_PROMISE_RE.test(COPY[lang].willFindOut), true,
    "reword this and stuck-booking-rescue starts nudging people who are owed an answer");
}
// The nudge itself must never look like the promise, or the cron would read its
// own message as proof that someone is waiting and go quiet forever.
check("rescue promise does not match the nudge",
  "Just checking in ...",
  RESCUE_PROMISE_RE.test("Just checking in \u{1F642} Your massage booking is saved right where you left off. Reply anytime and we continue from the same spot."),
  false, "");

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const total = pass + failures.length;
if (failures.length) {
  console.log(`\n${failures.length} of ${total} FAILING\n`);
  for (const f of failures) {
    console.log(`  ${f.group}`);
    console.log(`    input : ${JSON.stringify(f.input)}`);
    console.log(`    got   : ${JSON.stringify(f.got)}`);
    console.log(`    want  : ${JSON.stringify(f.want)}`);
    if (f.note) console.log(`    why   : ${f.note}`);
    console.log("");
  }
  process.exit(1);
}
console.log(`all ${total} pass`);
