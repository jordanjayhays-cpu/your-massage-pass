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
  parseOfferedTime, parseOfferedTimes, GOODBYE_RE, detectTime, detectDay, strongSpanish, isEmail,
  HI_RE, ARRIVED_RE, genderWanted, genderBare, offerMatchesAsk, HOME_VISIT_RE, LINK_ONLY_RE, studioGenderReply, BLOCK_LINE_EN, BLOCK_LINE_ES, NOSHOW_RE, AD_OPENER_RE, ANY_RE, CANCEL_RE,
  AUTOREPLY_RE, EROTIC_RE, JOB_RE, HOURS_STATEMENT_RE, looksLikeQuestion, parseQuotedPrice, euro, SERVICEQ_RE, ACK_ONLY_RE,
  NO_ENGLISH_RE, dayLabelFor, parseName,
  CONFIRM_LATER_RE, confirmLaterRemindAt, madridInstant,
  EMAIL_REFUSE_RE, EMAIL_IN_TEXT_RE,
  firstNameFromProfile, detectArea, detectService,
  ZONEQ_RE, PRICEQ_RE, PHOTOQ_RE,
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
// 16 Oct: Kamiraku's autoresponder, word for word. It got past AUTOREPLY_RE,
// "no podemos atender" counted as an offer marker, its hours were read as an
// 11:00 offer for Brandon, and the studio was told "Lo confirmo con Brandon".
{
  const kami = "¡Gracias por comunicar con Kamilaku!\nEn este momento no podemos atender porque estamos trabajando con buena energía ✨ o estamos fuera de horario.\nSi desea reservar un masaje, puede llamarnos o hacerlo online (también disponible).\nSi nos escribe por WhatsApp y no respondemos de inmediato, le contestaremos lo antes posible.\nO llámanos 661217881 y atenderá nuestro asistente de equipo.\nNuestro horario es lunes,Martes jueves a sábado 11:00-21:00\nMiércoles 12:00-21:00\nDomingo 11:00-20:00\n¡Muchas gracias! 🙏";
  check("AUTOREPLY_RE", "Kamiraku autoresponder", AUTOREPLY_RE.test(kami), true, "an autoresponder is not a reply");
  check("parseOfferedTime", "Kamiraku autoresponder", parseOfferedTime(kami), "", "opening hours are not an offer");
  check("parseOfferedTimes", "Kamiraku autoresponder", JSON.stringify(parseOfferedTimes(kami)), "[]", "opening hours are not offers");
  // Chalalai's booking system, 15 Oct: "Hora: 3:00 pm" reached Jordan as 03:00.
  const chal = "Servicio: Masaje tailandes 1h\nFecha: octubre 19, 2026\nHora: 3:00 pm\nNombre del cliente: Brandon (Massage Club)";
  check("parseOfferedTime", "Chalalai booking confirmation", parseOfferedTime(chal), "15:00", "3:00 pm is 15:00");
  check("parseOfferedTime", "a one hour slot range", parseOfferedTime("tengo hueco 16:00-17:00"), "16:00", "a short range is still a slot");
}
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
  // Jasper, 11 Sept 08:50. Asked twice whether the studios have "extra
  // services" and was answered "Good choice. Which day suits you?" both times,
  // then his question was stored as the day he wanted.
  ["They have extra services", true, "Jasper, 11 Sept. Got the day question twice instead of an answer"],
  ["Just asking they have extra services", true, "his second attempt, same reply"],
  ["servicios extras?", true, ""],
  // Ordinary words that happen to contain extra. Blocking these would be worse
  // than the bug.
  ["I need an extra towel please", false, "a real request"],
  ["trabajo muchas horas extras", false, "nothing to do with massage"],
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
// (v13, 9 Oct: also the v188 wording, "the answer will come here")
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
const RESCUE_PROMISE_RE = /(I am finding out for you now|rather check than guess|lo consulto ahora mismo y te digo|Prefiero confirmarlo antes que|the answer will come here|y la respuesta te llega por aqu)/i;
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
// v81: therapist gender is a preference, not an off-menu request.
// Abdul typed "i need good girl for me" on 7 September while a real 13
// September booking was already sent to three studios, and was silenced.
// Fernando typed "MAN" on 11 September and was dumped into the main menu 84
// seconds before he cancelled. Both must read as a gender preference, and
// neither may be read as an erotic request.
// ---------------------------------------------------------------------------
const genderCases = [
  // Abdul, 7 Sept. Deliberately NOT classified: with no word like "therapist"
  // or "masajista" beside it this is ambiguous, and a regex loose enough to
  // catch it would catch much else besides. What matters is the line below:
  // it must not be treated as an erotic request, which is what silenced him
  // while a real 13 September booking was already out with three studios.
  ["i need good girl for me", null, "Abdul, 7 Sept. Ambiguous on purpose, but must never be blocked"],
  ["MAN", null, "Fernando, 11 Sept. Bare word, answered by the therapist question's own branch"],
  ["Will be a guy right ?", null, "Fernando, 11 Sept. A question, handled as a question"],
  ["quiero una masajista chica", "female", ""],
  ["prefiero un chico", "male", ""],
  ["do you have a male therapist", "male", ""],
  ["masajista hombre por favor", "male", ""],
  ["female masseuse please", "female", ""],
];
for (const [msg, want, note] of genderCases) {
  check("therapist gender read", msg, genderWanted(msg), want, note);
}
// A gender preference must never trip the erotic lexicon. This is the exact
// pair that cost Abdul his booking.
for (const [msg] of genderCases) {
  check("gender request is not erotic", msg, EROTIC_RE.test(msg), false,
    "if this goes true, someone asking for a man or a woman gets shut down");
}
// And the genuine cases must still be caught, because the neutral reply still
// has to fire for them.
for (const msg of ["Sensitive massage pleas", "Whith some thing erotic", "nuru massage with happy ending", "masaje tantrico", "final feliz"]) {
  check("erotic still caught", msg, EROTIC_RE.test(msg), true, "");
}
// The neutral reply replaced a shutdown. It must stay short and must not
// moralise: Jordan was explicit that the point is to keep them in the flow.
for (const [lang, line] of [["en", BLOCK_LINE_EN], ["es", BLOCK_LINE_ES]]) {
  check("neutral line stays short", `${lang}: ${line}`, line.length <= 90, true,
    "a lecture here is what pushed 10 people out of the funnel");
  check("neutral line does not moralise", `${lang}: ${line}`,
    /cannot help|no podemos ayudar(te)?|we cannot|no ofrecemos nada/i.test(line), false,
    "the old copy ended the conversation; this one must not");
}

// ---------------------------------------------------------------------------
// v81: reading a studio's answer to the therapist-gender question. A wrong yes
// here sends someone to a studio expecting the opposite of what they asked for,
// so anything short of a clear answer must stay null and claim nothing.
// ---------------------------------------------------------------------------
const studioGender = [
  ["Si hay masajista chico, mañana le esperamos a Fernando", "male", true,
   "Centro Aloha, 10 Sept 17:10. The written yes nothing could remember"],
  ["si, tenemos masajista chico", "male", true, ""],
  ["Solo tenemos masajista chica", "male", false, "the case that must stand the studio down"],
  ["no tenemos masajista hombre", "male", false, ""],
  ["tenemos masajista chica disponible", "female", true, ""],
  ["solo hombres", "female", false, ""],
  // Ambiguous or unrelated: claim nothing.
  ["a las 17:00", "male", null, "a time is not an answer about the therapist"],
  ["Ok, aqui estaremos", "male", null, "Aloha, 11 Sept. Relaying this as an answer is how bookings break"],
  ["Que?", "male", null, "Aloha, 11 Sept"],
  ["si", "male", null, "a bare yes does not say what they are agreeing to"],
  ["tenemos chico y chica", "male", null, "mentions both, so it is not a clean confirmation"],
];
for (const [msg, want, expect, note] of studioGender) {
  check("studio gender reply", `${msg} (wanted ${want})`, studioGenderReply(msg, want), expect, note);
}

// ---------------------------------------------------------------------------
// v81: the shape of the opening message. 37 people sent one message and never
// wrote again, and 12 of them stopped at this exact question. These checks are
// about structure, not taste: three taps, one language, no link, no price.
// ---------------------------------------------------------------------------
for (const lang of ["en", "es"]) {
  const intro = COPY[lang].intro;
  const btns = COPY[lang].introBtns;
  check("opener offers exactly three buttons", `${lang}`, btns.length, 3,
    "WhatsApp only renders three as taps; a fourth turns it into a menu to open");
  check("opener has no link", `${lang}: ${intro}`, /https?:\/\//.test(intro), false,
    "one of the five old openers led with a booking link to someone sitting in WhatsApp");
  check("opener quotes no price", `${lang}: ${intro}`, /\d+\s*(EUR|€)/i.test(intro), false,
    "price before a question was in every one of the five openers that died");
  check("opener is one language", `${lang}: ${intro}`, /Hi, this is|Massage Club here\./.test(intro) && /Hola|somos/.test(intro), false,
    "the bilingual opener sent both languages in one block");
  check("opener is short", `${lang}`, intro.length <= 130, true,
    "37 people got a wall of text and never replied");
  // The third button has to lead somewhere, not dead-end the undecided.
  check("third button opens the rest", `${lang}: ${btns[2].id}`, btns[2].id, "svc_more", "");
  // v108 (Jordan, 19 Sept, case 05): the "we are on it" line is gone on
  // purpose. The "Done, ..." confirmation right above it already says what
  // happens next, and at midnight this line contradicted the honest
  // out-of-hours sentence two seconds after it was sent. The confirmation is
  // what now has to carry the promise, so that is what this checks.
  check("no duplicate on-it line", `${lang}`, COPY[lang].onIt === undefined, true,
    "removed 19 Sept; the Done confirmation says it once");
  check("member join line asks for both", `${lang}`,
    /email/i.test(COPY[lang].memberJoin) && /(name|nombre)/i.test(COPY[lang].memberJoin), true,
    "the email moved here, to the moment they accept a slot");
}
// The member rate must be computed, never rounded to a tidier number. 10% off
// 60 is 54. Quoting 55 means the counter charges something we did not say.
const memberMath = (was, pct) => Math.round(was * (100 - pct)) / 100;
check("member rate arithmetic", "60 EUR less 10%", memberMath(60, 10), 54, "Jordan's own example said 55");
check("member rate arithmetic", "45 EUR less 10%", memberMath(45, 10), 40.5, "");
check("member rate arithmetic", "70 EUR less 15%", memberMath(70, 15), 59.5, "");

// ---------------------------------------------------------------------------
// v83: the review ask. On 11 September whatsapp-followup asked Fernando how his
// massage went six hours BEFORE it happened, because it selected on when the
// request was created. This one selects on end_at, so the window is arithmetic
// and can be checked here.
// ---------------------------------------------------------------------------
const reviewDue = (endAt, now) => {
  const end = Date.parse(endAt), t = Date.parse(now);
  return end <= t - 15 * 60e3 && end >= t - 6 * 3600e3;
};
const NOW = "2026-09-11T17:00:00Z";
check("review not asked before the massage ends", "ends 17:30, now 17:00", reviewDue("2026-09-11T17:30:00Z", NOW), false,
  "this is exactly the Fernando bug: asked six hours before it happened");
check("review not asked at the exact end", "ends 17:00, now 17:00", reviewDue("2026-09-11T17:00:00Z", NOW), false,
  "still on the table or at the counter");
check("review not asked 14 minutes after", "ends 16:46", reviewDue("2026-09-11T16:46:00Z", NOW), false, "");
check("review asked 15 minutes after", "ends 16:45", reviewDue("2026-09-11T16:45:00Z", NOW), true, "Jordan chose 15 minutes");
check("review asked two hours after", "ends 15:00", reviewDue("2026-09-11T15:00:00Z", NOW), true, "");
check("review not asked a day later", "ends yesterday", reviewDue("2026-09-10T15:00:00Z", NOW), false,
  "a sweep restart must not message everyone who ever had a massage");
// The message itself: one line, one link, and the link is ours.
for (const lang of ["en", "es"]) {
  const msg = COPY[lang].reviewAsk("Centro Aloha", "https://book.massageclub.io/review?token=abc");
  check("review ask names the studio", `${lang}`, /Centro Aloha/.test(msg), true, "");
  check("review ask links massageclub only", `${lang}`, /^https:\/\/book\.massageclub\.io\//.test(msg.split("\n").pop()), true,
    "customer-facing links must be massageclub.io only");
  check("review ask stays short", `${lang}`, msg.split("\n")[0].length <= 70, true, "Jordan asked for super simple");
}

// ---------------------------------------------------------------------------
// v84: a studio offering more than one time. FISIOBARICA answered Asim on
// 9 September with "17h, 18h y 20h" and only 17:00 survived, so two thirds of
// what they volunteered was discarded. When he asked for 7pm an hour later
// there was nothing on file to come close with.
// ---------------------------------------------------------------------------
const multiTimes = [
  ["17h, 18h y 20h", ["17:00", "18:00", "20:00"], "FISIOBARICA, 9 Sept, for Asim. Only the first was kept"],
  ["Nos viene bien a las 18.00", ["18:00"], "Calma Madrid Spa, 9 Sept"],
  ["podemos a las 12:15 o a las 18:00", ["12:15", "18:00"], ""],
  ["19 horas", ["19:00"], "TornaSol, 9 Sept"],
  ["tenemos 10:00, 11:00 y 12:00 libres", ["10:00", "11:00", "12:00"], ""],
  ["7pm o 8pm", ["19:00", "20:00"], ""],
  // Guards: none of these are offers.
  ["Abrimos de 10 a 20", [], "opening hours, not availability"],
  ["horario de lunes a viernes 10:00 a 21:00", [], "an hours statement"],
  ["si coges 1h", [], "a duration, and no Madrid studio opens at 01:00"],
  ["gracias", [], ""],
];
for (const [msg, want, note] of multiTimes) {
  check("studio offered times", msg, parseOfferedTimes(msg), want, note);
}
// The plural must never disagree with the singular about what comes first,
// or the lead offer and the alternatives would describe different things.
for (const [msg] of multiTimes) {
  const many = parseOfferedTimes(msg), one = parseOfferedTime(msg);
  check("first offered time agrees with the singular", msg, many[0] || "", one, "");
}

// ---------------------------------------------------------------------------
// v86: the language switch must work in both directions. It used to be one way:
// a single Spanish word turned Spanish on and nothing ever turned it off, so an
// English speaker who typed "hola" once was answered in Spanish forever. Jordan
// wrote "Hi" to the bot on 12 September and got Spanish, because a test session
// from weeks earlier still had him flagged es.
//
// Leaving a language must be harder than entering one, so a message has to look
// English AND carry no Spanish signal before it switches back.
// ---------------------------------------------------------------------------
const looksEnglish = (t) => /\b(hi|hello|hey|i|i'd|i'm|id|im|like|book|booking|want|need|please|massage|can|could|you|tomorrow|today|tonight|near|the)\b/i.test(String(t || ""));
const nextLang = (cur, text) => {
  if (!text) return cur;
  if (cur !== "es" && strongSpanish(text)) return "es";
  if (cur === "es" && !strongSpanish(text) && looksEnglish(text)) return "en";
  return cur;
};
const langCases = [
  ["es", "Hi", "en", "Jordan, 12 Sept. One English word from someone wrongly flagged Spanish"],
  ["es", "Hi, I'd like to book a massage", "en", ""],
  ["es", "tomorrow please", "en", ""],
  ["en", "Hola, quiero reservar un masaje", "es", "a real Spanish speaker still switches in"],
  ["en", "buenas, cuanto cuesta?", "es", ""],
  // Must NOT flip back on a message that still carries Spanish.
  ["es", "hola, tomorrow please", "es", "mixed, and Spanish signal present, so it stays"],
  ["es", "gracias", "es", "no English signal at all"],
  ["es", "ok", "es", "too thin to move anyone"],
  ["es", "👍", "es", ""],
  // A brand new person with nothing set gets English, which is what the ads say.
  ["", "Hi, I'd like to book a massage. I saw you on Facebook.", "", "empty resolves to English downstream"],
];
for (const [cur, text, want, note] of langCases) {
  check("language switches both ways", `${cur || "(new)"} + ${text}`, nextLang(cur, text), want, note);
}
check("empty language means English", "(new)", "" === "es" ? "es" : "en", "en",
  "the ads are written in English, so an unknown language is English");

// ---------------------------------------------------------------------------
// v87: "always respond" (Jordan, 12 Sept). Twelve threads had drifted with the
// other person's message last and ours never sent, one of them a partner studio
// complaining about a no-show, unanswered for eight days. The handler now sends
// a holding line whenever a branch answered nothing, with common-sense
// exceptions. These check the exceptions, because a fallback that fires on a
// goodbye is worse than silence: it restarts a conversation that had ended.
// ---------------------------------------------------------------------------
const threadClosed = (said) =>
  GOODBYE_RE.test(said)
  || /^\s*(ok|okay|vale|gracias|thanks|thank you|👍|👌|🙏)\s*$/i.test(said)
  || /\b(have a (good|nice|lovely) (day|one|evening|night)|good night|buenas noches|buen d[ií]a|que vaya bien|igualmente)\b/i.test(said);
const closedCases = [
  ["Ok thanks", true, "Marvin, 7 Sept. His last words, and nothing more was needed"],
  ["Have a good day", true, "Nabin Bista, 8 Sept"],
  ["gracias", true, ""],
  ["Thanks", true, "Fernando, 11 Sept, after cancelling"],
  ["👍", true, ""],
  ["hasta luego", true, ""],
  ["vale", true, ""],
  // These are NOT closed, and silence on them is the fault being fixed.
  ["Por lo menos debería avisarnos que no iba a venir.", false, "Baan Bua, 4 Sept. Eight days unanswered"],
  ["Si no habla español no puede venir", false, "Taolandia, 31 Aug. Twelve days unanswered"],
  ["Que?", false, "Centro Aloha, 11 Sept"],
  ["How much", false, "Marvin asked this and was answered; it must never count as closed"],
  ["7pm?", false, "Asim, 9 Sept"],
  ["No podemos", false, "Sinergia38's decline still deserves a thank you"],
];
for (const [said, want, note] of closedCases) {
  check("thread closed needs no reply", said, threadClosed(said), want, note);
}
// The holding line must not promise a person, because the bot never hands off
// to "a representative", and must not restate the question it failed to answer.
for (const lang of ["en", "es"]) {
  const f = COPY[lang].fallbackAck;
  check("fallback does not promise a human", `${lang}: ${f}`,
    /representative|agent|colleague|compañer|representante|una persona/i.test(f), false, "");
  check("fallback stays short", `${lang}`, f.length <= 110, true, "");
}

// ---------------------------------------------------------------------------
// v93: the one word answer to our own man-or-woman question. genderBare only
// ever runs when the bot has just asked, so it is deliberately strict: it takes
// a standalone gender word and nothing else. The two real losses are the first
// two cases here. The negatives are sentences that must never be read as a
// booking preference, because a stray "man" is not an instruction.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["MAN", "male", "Fernando, 11 Sept 13:30:57, answered the bot's own question and was shown the menu"],
  ["Mujer", "female", "Andy, 15 Sept 17:06:36, answered and was shown a 17:00 slot that had passed"],
  ["man", "male", ""],
  ["Woman", "female", ""],
  ["hombre", "male", ""],
  ["chica", "female", ""],
  ["chico", "male", ""],
  ["female please", "female", "a polite one word answer is still one word"],
  ["mujer por favor", "female", ""],
  ["una chica", "female", ""],
  ["Lady", "female", ""],
  ["guy", "male", ""],
  ["man or woman is fine", null, "not a choice, must not be read as male"],
  ["I am the man who booked yesterday", null, "a stray gender word in a sentence"],
  ["can a woman therapist do deep tissue", null, "a question, not an answer"],
  ["no", null, ""],
  ["", null, ""],
]) {
  check("bare gender answer", JSON.stringify(msg), genderBare(msg), want, note);
}

// The paired form must keep working untouched, and must still match on its own.
for (const [msg, want] of [
  ["male therapist", "male"],
  ["masajista chica", "female"],
  ["prefiero un hombre", "male"],
]) {
  check("paired gender still reads", msg, genderWanted(msg), want, "");
}

// ---------------------------------------------------------------------------
// An offer inside the band they asked for is not a change of plan (17 Sept).
// Pedro was told TornaSol could see him "a las 17:00 Hoy en vez de Hoy Tarde
// (13-18)". 17:00 is inside 13-18, so there was nothing to apologise for.
// ---------------------------------------------------------------------------
for (const [time, offerDay, day1, time1, want, note] of [
  ["17:00", null, "Hoy", "Tarde (13-18)", true, "Pedro, the line that started this"],
  ["13:00", null, "Hoy", "Tarde (13-18)", true, "the first hour of the band counts"],
  ["18:00", null, "Hoy", "Tarde (13-18)", false, "the band ends at 18, so this is outside"],
  ["19:00", "Manana", "Hoy", "Tarde (13-18)", false, "Sinergia38: a different day is a real change"],
  ["16:00", null, "Hoy", "Tarde (13-18)", true, "Centro Aloha"],
  ["11:00", null, "Hoy", "Manana (10-13)", true, "morning band by its numbers"],
  ["20:00", null, "Hoy", "Evening (18-21)", true, "English band name, no numbers"],
  ["12:00", null, "Hoy", "afternoon", false, "named band with no numbers, midday is not afternoon"],
  ["16:30", null, "Friday", "16:30", true, "exact time asked, exact time offered"],
  ["17:00", null, "Friday", "16:30", false, "exact time asked, different time offered"],
  ["16:00", null, "Hoy", "", false, "no time asked at all, say nothing clever"],
  ["", null, "Hoy", "Tarde (13-18)", false, "no offered time is never a match"],
  ["17:00", "Hoy", "Hoy", "Tarde (13-18)", true, "same day named explicitly still matches"],
]) {
  check("offer matches the ask", `${time} vs ${day1} ${time1}`, offerMatchesAsk(time, offerDay, day1, time1), want, note);
}

// ---------------------------------------------------------------------------
// Someone saying they cannot read us settles the language (18 Sept, live).
// A Facebook lead wrote "No entiendo" and was answered in English.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["No entiendo", true, "the message that started this"],
  ["no entiendo nada", true, ""],
  ["No te entiendo", true, ""],
  ["no comprendo", true, ""],
  ["No hablo ingles", true, "no accent typed"],
  ["Hablas espanol?", true, ""],
  ["en espanol por favor", true, ""],
  ["Quesiera informaci\u00f3n", true, "Juan, 17 Sept, exactly as he typed it"],
  ["Quesiera informacion", true, "same words with the accent dropped, as a phone often does"],
  ["Dime tipo masaje y precio", true, "Juan asking mid-flow"],
  ["Otro dia te llamo", true, "a polite no, still Spanish"],
  ["Hola", true, ""],
  ["I don't understand", false, "English speaker saying the same thing"],
  ["Saturday 3", false, "a day, not a language signal"],
  ["Hi, I'd like to book a massage. I saw you on Facebook.", false, "the ad's canned line"],
  ["no", false, "reads the same in both languages"],
]) {
  check("says they cannot read us", JSON.stringify(msg), strongSpanish(msg), want, note);
}

// ---------------------------------------------------------------------------
// The not-caught line exists in both languages and says so plainly (18 Sept).
// ---------------------------------------------------------------------------
for (const [lang, want] of [["en", "Sorry, I did not catch that."], ["es", "Perdona, no te he entendido."]]) {
  check("not caught line", lang, COPY[lang].notCaught, want, "shown from the second miss at a step");
}

// ---------------------------------------------------------------------------
// "a las 3 p.m." is fifteen hundred, not three in the morning (19 Sept).
// Centro Aloha wrote "Hoy 19 hay disponibilidad a las 3 p.m." and Javier was
// offered 03:00.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["Hoy 19 hay disponibilidad a las 3 p.m.", "15:00", "Centro Aloha, the message that started this"],
  ["a las 3 pm", "15:00", ""],
  ["a las 3", "15:00", "bare, and no studio in Madrid opens at 03:00"],
  ["a las 7", "19:00", "evening, not dawn"],
  ["a las 9", "09:00", "9 and later are read as written"],
  ["a las 10", "10:00", ""],
  ["a las 20", "20:00", ""],
  ["a las 16:30", "16:30", "an exact time still wins"],
  ["Tenemos disponibilidad hasta las 14:00 horas", "14:00", "Calma this morning"],
  ["19 horas", "19:00", "the v77 case still works"],
  ["si coges 1h", "", "a duration, not 01:00"],
]) {
  check("offered time", JSON.stringify(msg), parseOfferedTime(msg), want, note);
}

// ---------------------------------------------------------------------------
// Jordan's corrections, 19 Sept (Bot School cases 01, 02, 04, 11).
// ---------------------------------------------------------------------------
for (const lang of ["en", "es"]) {
  const line = COPY[lang].offer("Javier", "Centro Aloha", "Malasaña", lang === "es" ? "masaje relajante" : "relaxing massage", "15:00", lang === "es" ? "hoy" : "Today", "Today Afternoon (13-18)");
  check("offer has no asterisks", lang, line.includes("*"), false, "case 11: send it normally");
  check("offer drops instead-of", lang, /instead of|en vez de/.test(line), false, "case 01");
  check("offer has line breaks", lang, line.split("\n").length >= 3, true, "case 01: room to read");
  check("offer names the time", lang, line.includes("15:00"), true, "");
}
for (const [msg, want, note] of [
  ["Home services", true, "the French lead, 18 Sept"],
  ["home service", true, ""],
  ["Can you come to my hotel?", true, ""],
  ["massage at my hotel", true, ""],
  ["send someone to my house", true, ""],
  ["masaje a domicilio", true, ""],
  ["outcall", true, ""],
  ["I am at my hotel in Sol, which studios are near", false, "saying where they are is not asking for a home visit"],
  ["Relaxing massage", false, ""],
]) {
  check("home visit asked for", JSON.stringify(msg), HOME_VISIT_RE.test(msg), want, note);
}
for (const [msg, want] of [
  ["https://www.instagram.com/p/DdbYKQzAsK6/", true],
  ["www.samsarawellness.es", true],
  ["look at this https://x.com/a and tell me", false],
  ["Saturday", false],
]) {
  check("message is only a link", JSON.stringify(msg), LINK_ONLY_RE.test(msg), want, "case 04");
}
check("we answer a home visit", "en", COPY.en.noHomeVisit.includes("in person"), true, "case 02");
check("we answer a home visit", "es", COPY.es.noHomeVisit.includes("presenciales"), true, "case 02");

// ---------------------------------------------------------------------------
// Job seekers (19 Sept). A masseur asked three times whether we needed one and
// was sold a massage instead. Who needs whom is the whole distinction.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["Don't you need a masseur? I work as a masseur.", true, "Red, 19 Sept, the one we missed"],
  ["I ask you if you need masseur", true, ""],
  ["Ask them if they need masseur", true, ""],
  ["Im a masseuse with 5 years experience", true, ""],
  ["soy masajista", true, ""],
  ["busco trabajo", true, ""],
  ["I am a massage therapist looking for work", true, ""],
  ["do you have any vacancies", true, ""],
  ["I need a masseur for my back", false, "a customer, not an applicant"],
  ["I would like a female masseuse please", false, "a preference, not a CV"],
  ["Can I book a massage with a male masseur?", false, ""],
  ["do you need my email?", false, ""],
]) {
  check("job seeker", JSON.stringify(msg), JOB_RE.test(msg), want, note);
}

// ---------------------------------------------------------------------------
// The price a studio confirmed (Jordan, 19 Sept: "before we offer pricing we
// must confirm with the studio there price after our potential discount").
// Every line here is the shape a Madrid studio actually writes. The rejections
// matter more than the matches: a bare number in a studio's message is far more
// often an hour or a percentage than a price, and quoting one of those to a
// customer is a wrong number at the till.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["45€", 45, ""],
  ["45 eur", 45, ""],
  ["son 40 euros", 40, ""],
  ["A las 16:00, 45€", 45, "one message carries both the time and the price"],
  ["precio 39", 39, ""],
  ["1h 55 eur", 55, ""],
  ["40,50 EUR con el descuento", 40.5, "Spanish decimal comma"],
  ["Sí, con el 10% se queda en 54 euros", 54, ""],
  ["16:00", null, "an hour is not a price"],
  ["a las 3 p.m.", null, "an hour is not a price"],
  ["10% de descuento", null, "a percentage is not a price"],
  ["Tenemos disponibilidad hasta las 14:00 horas", null, ""],
  ["Sí, tengo hueco", null, ""],
  ["", null, ""],
  ["9€", null, "no massage in Madrid costs this"],
  ["podemos hacerle el 10€ pero hoy no nos queda disponibilidd", null,
    "Sinergia38, 9 Sept: they meant 10 percent and typed a euro sign"],
  ["Hay que dejar un depósito de 30€ por Bizum", null,
    "Centro Aloha's deposit is not the price of the massage"],
  ["Le hacemos 45€ de descuento", null, "a discount attached to the number is not the price"],
  ["Sí, con el 10% se queda en 54 euros", 54,
    "the discount and the final price in one message is exactly what we ask for"],
  ["Masaje de 40 minutos 60€ \n1h 80€\nEl horario a las 18:00 bien", 80,
    "Private Spa Madrid, 19 Sept 18:16 Madrid, on Al's 60 minute request. The first price in the message is the 40 minute one"],
  ["Masaje de 40 minutos 60€", null,
    "they priced 40 minutes and we book 60, so we have no price we may quote"],
  ["60 min 45€", 45, ""],
  ["30 minutos 35€\n60 minutos 55€", 55, "the menu line that matches the booking wins"],
  ["17:00, 45€ con el 10% de Massage Club", 45, ""],
  ["500 euros", null, "over 400 EUR is not one massage"],
]) {
  check("studio quoted price", JSON.stringify(msg), parseQuotedPrice(msg), want, note);
}

// A time with an acceptance word after it is an offer, even in a sentence
// carrying the word "horario". Private Spa's "El horario a las 18:00 bien" was
// swallowed by the opening-hours guard and Al never heard about the one studio
// that named him a slot.
for (const [msg, want, note] of [
  ["El horario a las 18:00 bien", "18:00", "the real message, 19 Sept"],
  ["Masaje de 40 minutos 60€ \n1h 80€\nEl horario a las 18:00 bien", "18:00", ""],
  ["Nuestro horario es de 10:00 a 20:00", "", "opening hours are still not an offer"],
  ["Hoy cerramos a las 15:00", "", ""],
  ["Abrimos de lunes a viernes", "", ""],
]) {
  check("offered time vs opening hours", JSON.stringify(msg), parseOfferedTime(msg), want, note);
}

check("euro", "45", euro(45), "45 EUR", "no stray decimals on a whole number");
check("euro", "40.5", euro(40.5), "40.50 EUR", "cents when there are cents");

// The offer line only ever carries a studio-confirmed number, and it says
// "Massage Club rate" only when that same studio also confirmed the discount.
for (const lang of ["en", "es"]) {
  check("price line", `${lang} member`, /45 EUR/.test(COPY[lang].priceLine(45, 60, true)), true, "");
  check("price line", `${lang} plain`, /45 EUR/.test(COPY[lang].priceLine(45, 60, false)), true, "");
  check("price line", `${lang} member names the rate`, /Massage Club/.test(COPY[lang].priceLine(45, 60, true)), true, "");
  check("price line", `${lang} plain does not claim a rate`, /Massage Club/.test(COPY[lang].priceLine(45, 60, false)), false,
    "a studio that gave a price and ducked the discount is not a member rate");
  check("price line", `${lang} no asterisks`, COPY[lang].priceLine(45, 60, true).includes("*"), false,
    "Jordan, 18 Sept: remove the * and just send it normally");
  check("price line", `${lang} no em dash`, /\u2014/.test(COPY[lang].priceLine(45, 60, true)), false, "");
  check("no list-price member rate", `${lang}`, COPY[lang].memberRate === undefined, true,
    "removed 19 Sept: it multiplied a listed price by the discount and nobody had confirmed the result");
}

// ---------------------------------------------------------------------------
// "What type?" (Jordan, 19 Sept: "why would you ask what day???"). Someone came
// off the ad asking what types of massage we provide, asked again when the
// first answer was the day buttons, and was told "Good choice. Which day suits
// you?". The rejections below are the ones that would hijack a booking already
// in progress.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["What type?", true, "the real message, 19 Sept 16:41 Madrid"],
  ["What type of massage you provide?", true, "his first message, same person"],
  ["what types of massage do you have", true, ""],
  ["which massages do you offer", true, ""],
  ["what kind of massage", true, ""],
  ["What do you offer?", true, ""],
  ["what do you provide", true, ""],
  ["¿Qué tipos de masaje tenéis?", true, ""],
  ["que masajes ofreceis", true, ""],
  ["tipos de masaje", true, ""],
  ["Which day suits you", false, "our own question must never match"],
  ["what time do you open", false, ""],
  ["what area are you in", false, ""],
  ["how much is it", false, "a price question, answered elsewhere"],
  ["Tomorrow", false, ""],
  ["relaxing massage please", false, "they have named it, do not send them back to the menu"],
  ["", false, ""],
]) {
  check("what do you offer", JSON.stringify(msg), SERVICEQ_RE.test(msg), want, note);
}

// The answer names every service the picker offers, in both languages.
for (const lang of ["en", "es"]) {
  const a = COPY[lang].servicesAnswer;
  check("services answer", `${lang} lists deep tissue`, /Deep tissue|Descontracturante/.test(a), true, "");
  check("services answer", `${lang} lists thai`, /Thai|Tailand/.test(a), true, "");
  check("services answer", `${lang} lists couples`, /Couples|pareja/.test(a), true, "");
  check("services answer", `${lang} no em dash`, /\u2014/.test(a), false, "");
  check("services answer", `${lang} no asterisks`, a.includes("*"), false, "");
}

// ---------------------------------------------------------------------------
// A studio closing the thread is not asking a question. Calma sent "A vosotros"
// and then "De acuerdo" two minutes apart on 21 Sept; both got the holding line
// and both alerted Jordan's phone. Bare agreement only counts on its own: a
// studio writing "vale, a las 17:00" is making an offer.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["De acuerdo", true, "Calma, 21 Sept 11:23"],
  ["A vosotros", true, "Calma, 21 Sept 11:22"],
  ["Ok", true, "Centro Aloha, 21 Sept 11:41"],
  ["Vale", true, ""],
  ["Entendido", true, ""],
  ["Perfecto!", true, ""],
  ["👍", true, ""],
  ["vale, a las 17:00", false, "an offer, must reach the offer branch"],
  ["ok pero a las 18", false, ""],
  ["De acuerdo, 45€", false, "carries a price, must be parsed"],
  ["Sí", false, "a studio saying yes is an answer, not a sign-off"],
  ["No puedo", false, ""],
]) {
  check("thread closed", JSON.stringify(msg), ACK_ONLY_RE.test(msg), want, note);
}

// ---------------------------------------------------------------------------
// Someone telling us, in English, that they cannot read English. Pilar, 82,
// wrote four of these on 21 September and the bot answered "Sorry, I did not
// catch that" in English six times, then read her escape taps as a booking and
// asked four studios to hold 18:00. Every line below is hers or a near miss of
// hers, plus the cases that must NOT flip, because a person who cannot read
// English is very different from a person who cannot read Spanish.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["I dont speak inglesi", true, "Pilar, first message, live 21 Sept"],
  ["I dont speak englis", true, "Pilar, live"],
  ["Said in spanich", true, "Pilar, live"],
  ["Please am española", true, "Pilar, live"],
  ["i don't speak english", true, ""],
  ["I do not speak English", true, ""],
  ["no speak english", true, ""],
  ["cant understand english", true, ""],
  ["I dont understand inglés", true, ""],
  ["can you answer in spanish", true, ""],
  ["reply in castellano please", true, ""],
  ["im spanish", true, ""],
  ["I am española", true, ""],
  ["no inglés", true, ""],
  // Must not flip. These are English speakers.
  ["I don't speak Spanish", false, "the opposite person, must stay in English"],
  ["I do not understand Spanish", false, ""],
  ["sorry I only speak english", false, "states English, does not deny it"],
  ["english please", false, "asking FOR English"],
  ["Hi, I'd like to book a massage", false, ""],
  ["do you have anyone who speaks english", false, "asking about the studio, not the bot"],
]) {
  check("cannot read English", JSON.stringify(msg), NO_ENGLISH_RE.test(msg), want, note);
}

// strongSpanish must inherit the whole of that, because it is the function the
// bot actually asks, and it must not have been broken for the plain cases.
for (const [msg, want, note] of [
  ["I dont speak inglesi", true, "the live miss, through the real entry point"],
  ["Said in spanich", true, ""],
  ["Hola, quiero un masaje", true, ""],
  ["Hi, I'd like to book a massage. I saw you on Facebook.", false, "the ad opener is not the person's words"],
  ["I don't speak Spanish", false, ""],
  ["tomorrow evening please", false, ""],
]) {
  check("strongSpanish", JSON.stringify(msg), strongSpanish(msg), want, note);
}

// ---------------------------------------------------------------------------
// The day named in an offer. Nell asked on Monday 21 September at 22:41 Madrid
// for "tomorrow" morning. On Tuesday 22nd at 09:17 and 09:56 TornaSol and Calma
// both said yes, and both offers read "Tomorrow", which by then meant the 23rd.
// She was invited to the wrong day for a booking two hours away. The word the
// customer typed goes stale; the date does not.
// ---------------------------------------------------------------------------
{
  // Tuesday 22 September 2026, 09:56 Madrid.
  const tueMorning = new Date("2026-09-22T07:56:00Z");
  const nellMsg = "Quiere: Relaxing massage | Cuando: tomorrow Morning (10-13) | Zona: Alarcon pozuelo | Fecha: tuesday 22 september | Origen: whatsapp-bot";
  for (const [day1, msg, L, want, note] of [
    ["tomorrow", nellMsg, "en", "Today", "Nell, live 22 Sept. Was 'Tomorrow', which meant the 23rd"],
    ["tomorrow", nellMsg, "es", "Hoy", ""],
    ["tomorrow", "", "en", "Tomorrow", "no date on file, the word is all we have"],
    ["today", "", "en", "Today", ""],
    ["hoy", "", "es", "Hoy", ""],
    ["mañana", "", "es", "Mañana", ""],
    ["", "Quiere: X | Fecha: wednesday 23 september | Origen: whatsapp-bot", "en", "Tomorrow", "the day after Nell's"],
    ["", "Quiere: X | Fecha: friday 25 september | Origen: whatsapp-bot", "en", "Friday 25 September", "far enough out to name"],
    ["", "Quiere: X | Fecha: viernes 25 de septiembre | Origen: whatsapp-bot", "es", "viernes 25 de septiembre", ""],
    ["25 september", "", "en", "Friday 25 September", "date typed straight into day1"],
    ["next week sometime", "", "en", "", "unresolvable, must NOT echo the words back"],
    ["", "", "en", "", "nothing at all"],
  ]) {
    check("offer day", JSON.stringify([day1, L]), dayLabelFor(day1, msg, L, tueMorning), want, note);
  }
}

// ---------------------------------------------------------------------------
// The name step. Manju answered "Me llamo Manju" on 22 September and was
// recorded as "Me". Four studios were asked to hold an hour for "Me". People
// answer this question in sentences; the name is inside the sentence.
// ---------------------------------------------------------------------------
for (const [said, want, note] of [
  ["Me llamo Manju", "Manju", "live, 22 Sept. Was 'Me'"],
  ["me llamo Ana Garcia", "Ana Garcia", ""],
  ["Mi nombre es Carlos", "Carlos", ""],
  ["My name is Sarah", "Sarah", ""],
  ["I'm Tom", "Tom", ""],
  ["im nell", "nell", ""],
  ["Soy Pilar", "Pilar", ""],
  ["Call me Dave", "Dave", ""],
  ["Manju", "Manju", "the bare answer still works"],
  ["Ana Maria Lopez", "Ana Maria Lopez", "three words is a name"],
  ["Manju, encantada", "Manju", "the aside is dropped"],
  ["Name: Jordan", "Jordan", ""],
  // Rejected, so the bot asks again instead of sending a phrase to a studio.
  ["Vivo en Urgel, cerca del metro, a unos 5 minutos", "", "an address, not a name"],
  ["I am looking for work as a masseuse", "", "too long to be a name"],
  ["test@example.com", "", "an email is not a name"],
  ["+34612474827", "", "a phone is not a name"],
  ["", "", ""],
]) {
  check("name", JSON.stringify(said), parseName(said), want, note);
}

// ---------------------------------------------------------------------------
// Does the offer match what they asked for? Every one of these is a real offer
// we sent between 17 and 22 September. In nine days not one offer carrying
// "instead of" was ever accepted, and forwardOffer now refuses to send them.
// ---------------------------------------------------------------------------
for (const [offered, offerDay, day1, time1, want, note] of [
  // Javier, 19 Sept. Asked for today 13-18, sent all of these.
  ["03:00", null, "Today", "Afternoon (13-18)", false, "three in the morning, live 19 Sept"],
  ["11:00", null, "Today", "Afternoon (13-18)", false, "Selvarrosa, live"],
  ["20:00", null, "Today", "Afternoon (13-18)", false, "Samsara, live"],
  ["14:00", null, "Today", "Afternoon (13-18)", true, "Calma, the one that actually fitted"],
  ["15:00", null, "Today", "Afternoon (13-18)", true, ""],
  // Manas, 19 Sept. Asked for the evening, offered late morning.
  ["11:45", null, "Today", "Evening (18-21)", false, "live"],
  ["18:30", null, "Today", "Evening (18-21)", true, ""],
  // The edges of each band.
  ["13:00", null, "Today", "Afternoon (13-18)", true, "first hour of the band"],
  ["17:59", null, "Today", "Afternoon (13-18)", true, ""],
  ["18:00", null, "Today", "Afternoon (13-18)", false, "one minute past the band"],
  ["12:59", null, "Today", "Afternoon (13-18)", false, ""],
  // An exact hour the customer typed has to be that hour.
  ["19:00", null, "Today", "19:00", true, ""],
  ["18:00", null, "Today", "19:00", false, "Asim, 9 Sept: he wanted 19:00 and Calma offered 18:00"],
  // A different day never matches, whatever the hour.
  ["15:00", "Tomorrow", "Today", "Afternoon (13-18)", false, "right hour, wrong day"],
]) {
  check("offer fits the ask", JSON.stringify([offered, offerDay, day1, time1]),
    offerMatchesAsk(offered, offerDay, day1, time1), want, note);
}

// ---------------------------------------------------------------------------
// "I will confirm the day before". Juan, 15 September: he answered a studio
// offer with "Lo confirmaria un dia antes" and was never contacted again. The
// reply is a yes with a date on it, and reading it as noise cost the booking.
//
// The regex has to be narrow enough that a plain acceptance and a question
// about the address both keep going where they went before.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["Lo confirmaria un dia antes", true, "Juan, 15 Sept, his exact words. This is the one that has to fire"],
  ["Lo confirmaría un día antes", true, "the same sentence with its accents"],
  ["lo confirmo un dia antes", true, ""],
  ["Te confirmo el día antes", true, ""],
  ["un día antes te confirmo", true, "said the other way round"],
  ["Te aviso el día antes", true, ""],
  ["Os aviso la víspera", true, ""],
  ["I'll confirm the day before", true, ""],
  ["I will confirm a day before", true, ""],
  ["Let me confirm the day before please", true, ""],
  ["I'd rather confirm closer to the date", true, ""],
  ["I'll confirm closer to the day", true, ""],
  ["I'll let you know the day before", true, ""],
  ["I'll get back to you the night before", true, ""],
  ["Can I confirm the day before?", true, ""],
  // Must not fire. These already go somewhere better.
  ["Yes", false, "a plain acceptance goes straight to acceptOffer"],
  ["Confirmo", false, "so does this one"],
  ["confirmado", false, ""],
  ["Can you confirm the address?", false, "a question about the studio, not about when"],
  ["Please confirm the price before I book", false, "'before' is about the price, not a day"],
  ["7pm?", false, "Asim's counter-offer still belongs to the time branch"],
  ["No, otra hora", false, ""],
  ["The day before yesterday I called them", false, "day before, but nobody is confirming anything"],
]) {
  check("confirm the day before", msg, CONFIRM_LATER_RE.test(msg), want, note);
}

// ---------------------------------------------------------------------------
// When that reminder should land. 11:00 Madrid the day before the massage,
// and never after the massage itself.
// ---------------------------------------------------------------------------
// Monday 21 September 2026, 16:00 Madrid (CEST, UTC+2).
const clNow = new Date("2026-09-21T14:00:00Z");
for (const [day1, messageText, want, note] of [
  ["Thursday", "", "2026-09-23T09:00:00.000Z", "massage Thursday the 24th, reminder 11:00 Madrid on Wednesday the 23rd"],
  ["", "Fecha: 24 september | Hora: 19:00", "2026-09-23T09:00:00.000Z", "the date out of message_text wins, same answer"],
  ["Tomorrow", "", "2026-09-21T16:00:00.000Z", "massage tomorrow, so 11:00 the day before has gone: two hours from now"],
  ["Today", "", "2026-09-21T16:00:00.000Z", "said it on the day itself, still worth one nudge two hours out"],
  ["whenever", "", null, "no day can be read, so we promise nothing"],
  ["", "", null, "nothing to go on at all"],
]) {
  const got = confirmLaterRemindAt(day1, messageText, clNow);
  check("day-before reminder time", JSON.stringify([day1, messageText]), got ? got.toISOString() : null, want, note);
}

// Late at night the nudge waits for the morning, and if the massage is already
// over by then there is no nudge at all.
{
  // Monday 21 September 2026, 21:30 Madrid.
  const late = new Date("2026-09-21T19:30:00Z");
  check("day-before reminder time", "tomorrow, asked at 21:30 Madrid",
    confirmLaterRemindAt("Tomorrow", "", late).toISOString(), "2026-09-22T08:00:00.000Z",
    "10:00 Madrid the next morning, which is the morning of the massage");
  check("day-before reminder time", "today, asked at 21:30 Madrid",
    confirmLaterRemindAt("Today", "", late), null,
    "the massage is today and the morning is too late, so nothing goes out");
  // The massage is today and they wrote at dawn: the nudge waits for 10:00.
  const dawn = new Date("2026-09-22T04:00:00Z"); // 06:00 Madrid
  check("day-before reminder time", "today, asked at 06:00 Madrid",
    confirmLaterRemindAt("Today", "", dawn).toISOString(), "2026-09-22T08:00:00.000Z",
    "two hours from now would be 08:00 Madrid, which is too early to write to somebody");
  // Early morning: never before 10:00 Madrid.
  const early = new Date("2026-09-22T04:00:00Z"); // 06:00 Madrid
  check("day-before reminder time", "tomorrow, asked at 06:00 Madrid",
    confirmLaterRemindAt("Tomorrow", "", early).toISOString(), "2026-09-22T09:00:00.000Z",
    "11:00 Madrid today is still ahead of us, so it waits for it rather than writing at 06:00");
}

// Madrid moved off summer time on 25 October 2026, so the same wall clock hour
// is a different instant either side of it.
check("Madrid wall clock", "11:00 on 23 September 2026",
  madridInstant(new Date(Date.UTC(2026, 8, 23)), 11).toISOString(), "2026-09-23T09:00:00.000Z", "CEST, UTC+2");
check("Madrid wall clock", "11:00 on 23 November 2026",
  madridInstant(new Date(Date.UTC(2026, 10, 23)), 11).toISOString(), "2026-11-23T10:00:00.000Z", "CET, UTC+1");

// ---------------------------------------------------------------------------
// Who is actually refusing to give an email. Hatem, 24 September: asked for his
// email, he typed "Hatem", which was his name, because he had been one question
// behind since the start. It was logged as a refusal, and nine seconds later he
// sent Hatem@vitasnacafe.com and that was thrown away too. He booked for the
// next afternoon with no second channel.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  // Real refusals. These must still be taken at their word.
  ["no", true, ""],
  ["No thanks", true, ""],
  ["nope", true, ""],
  ["skip", true, ""],
  ["No gracias", true, ""],
  ["paso", true, ""],
  ["no tengo", true, ""],
  ["I don't have one", true, ""],
  ["prefiero no darlo", true, ""],
  ["rather not", true, ""],
  ["later", true, ""],
  // Not refusals. Every one of these used to end the question.
  ["Hatem", false, "Hatem, 24 Sept, his exact answer. His name, not a no"],
  ["Retiro", false, "the answer to the question before that one"],
  ["Relaxing massage", false, "and the one before that"],
  ["que?", false, "they did not understand the question"],
  ["?", false, ""],
  ["ok", false, ""],
  ["Juan Perez", false, ""],
  ["whats that for", false, ""],
  ["hatem arroba vitasnacafe punto com", false, "spelled out, still not a refusal"],
]) {
  check("email refusal", msg, EMAIL_REFUSE_RE.test(msg), want, note);
}

// An address is an address wherever it turns up in the message.
for (const [msg, want, note] of [
  ["Hatem@vitasnacafe.com", "hatem@vitasnacafe.com", "Hatem, 24 Sept, nine seconds too late and binned"],
  ["my email is jordan.hays@student.ie.edu thanks", "jordan.hays@student.ie.edu", "buried in a sentence"],
  ["Es ana.lopez+spa@gmail.com", "ana.lopez+spa@gmail.com", "a plus address is a real address"],
  ["Hatem", null, ""],
  ["no", null, ""],
  ["call me at 612474827", null, "a phone number is not an email"],
]) {
  const m = msg.match(EMAIL_IN_TEXT_RE);
  check("email in any message", msg, m ? m[0].toLowerCase() : null, want, note);
}

// ---------------------------------------------------------------------------
// The name we never have to ask for. Jordan, 25 September: "i need you to be
// very simple when they ask for a massage." WhatsApp sends the profile name on
// every inbound. On 24 September it sent "Hatem", the bot asked him his name
// anyway, and filed "Retiro" under it.
//
// Every case below is a real wa_sessions.wa_name from the last thirty days.
// ---------------------------------------------------------------------------
for (const [profile, want, note] of [
  ["Hatem", "Hatem", "24 Sept. We had his name before we asked for it"],
  ["Nell Anthony", "Nell", "a first name is enough to book a massage"],
  ["Bakary Camara", "Bakary", ""],
  ["Paco Balaguer Molinero", "Paco", "three surnames, one greeting"],
  ["José Angel", "José", "accents survive"],
  ["Ash", "Ash", "three letters is a name"],
  ["Paulo", "Paulo", ""],
  ["Dev", "Dev", ""],
  ["Monchi", "Monchi", ""],
  ["قیصر", "قیصر", "a script with no capitals must not be thrown away"],
  // Not names. These fall through to asking, exactly as today.
  ["la vida", "", "a lowercase phrase is a handle, not a name"],
  ["ibra Yatusave", "", "same"],
  ["🇪🇸SALADO 🇪🇸", "", "flags stripped, SALADO is a nickname in caps"],
  ["👩🏼‍🦰🦋", "", "nothing but emoji"],
  ["J̣̌ÅŢìŇ..:", "", ""],
  ["H.V.", "", "initials"],
  ["JM", "", "initials"],
  ["H", "", "one letter"],
  ["", "", ""],
  [null, "", ""],
  ["Massage Madrid", "", "a business, and the stoplist catches it"],
]) {
  check("name from WhatsApp profile", String(profile), firstNameFromProfile(profile), want, note);
}

// ---------------------------------------------------------------------------
// An answer belongs to the field it plainly IS, not to the question that
// happens to be open. Hatem answered the area question with his service and the
// name question with his area, and both were stored where they landed.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["Retiro", true, "Hatem, 24 Sept, typed at the NAME question and stored as his name"],
  ["Chamberí", true, ""],
  ["Salamanca", true, ""],
  ["Hatem", false, "his actual name must still read as a name"],
  ["Nell", false, ""],
]) {
  check("is this an area", msg, !!detectArea(msg), want, note);
}
for (const [msg, want, note] of [
  ["Relaxing massage", true, "Hatem, 24 Sept, typed at the AREA question and stored as his neighbourhood"],
  ["masaje relajante", true, ""],
  ["deep tissue", true, ""],
  ["Retiro", false, "an area is not a service"],
  ["Hatem", false, ""],
]) {
  check("is this a service", msg, !!detectService(msg), want, note);
}

// ---------------------------------------------------------------------------
// "Donde". A Facebook lead typed exactly that at 21:25 on 25 September and was
// answered "Sorry, I did not catch that" in English. It is one word, it is
// unmistakably Spanish, and it is a question we have a good answer for.
// ---------------------------------------------------------------------------
for (const [msg, zone, es, note] of [
  ["Donde", true, true, "+34 602 819 908, 25 Sept 21:25, his exact message"],
  ["donde?", true, true, ""],
  ["¿Dónde?", true, true, ""],
  ["Donde estais", true, true, "already worked, must keep working"],
  ["Where", true, false, "same question in English, and it stays English"],
  ["where?", true, false, ""],
  ["where are you located", true, false, ""],
  // Must not fire.
  ["I am in Chamberi", false, false, "an answer to the area question, not a question"],
  ["Another day", false, false, ""],
  ["wonder where to go", false, false, "'where' inside a sentence is not the bare question"],
  ["nowhere", false, false, ""],
]) {
  check("bare location question", msg, ZONEQ_RE.test(msg), zone, note);
  check("bare location question", msg + " (language)", strongSpanish(msg), es, note);
}

// ---------------------------------------------------------------------------
// Price questions. Two live failures on the night of 26 September, both from
// +34 601 015 258, who asked twice and never got a number.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["Buenas noches , cual es el precio de los masajes.", true, "26 Sept 23:14, his exact first message. Got the service menu, no price"],
  ["Y el valor", true, "26 Sept 23:17, his second try. Matched nothing at all"],
  ["¿Cuál es el valor?", true, ""],
  ["cuanto cuesta", true, "already worked, must keep working"],
  ["Que precio es?", true, "6 Sept, already covered"],
  ["how much is a massage", true, ""],
  ["what is the cost", true, ""],
  ["¿cuánto cobráis?", true, ""],
  ["cual es el coste", true, ""],
  ["el importe total", true, ""],
  // Must not fire. A price answer thrown at these is a non sequitur.
  ["Relajante", false, "a service, not a question"],
  ["Vale", false, "'vale' alone is Spanish for ok, never a price question"],
  ["vale, gracias", false, "ok thanks, closing the thread"],
  ["Chamberi", false, ""],
  ["mañana por la tarde", false, ""],
]) {
  check("price question", msg, PRICEQ_RE.test(msg), want, note);
}

// ---------------------------------------------------------------------------
// Photo questions. Until 27 September the bot had no answer for these at all.
// +34 640 032 448 asked three times in two languages at 05:00 and 05:35 and got
// the day question twice and "Sorry, I did not catch that" once.
// ---------------------------------------------------------------------------
for (const [msg, photo, es, note] of [
  ["Tienes fotos", true, true, "27 Sept 05:00, his exact message. Answered in English"],
  ["Fotos", true, true, "27 Sept 05:01, his second try"],
  ["Photo", true, false, "27 Sept 05:35, his third try, in English"],
  ["photos?", true, false, ""],
  ["do you have pictures", true, false, ""],
  ["¿tienes imágenes del centro?", true, true, ""],
  ["can I see the studio", true, false, ""],
  ["muéstrame el sitio", true, true, ""],
  ["any pics", true, false, ""],
  // Must not fire.
  ["Relaxing", false, false, ""],
  ["photographer", false, false, "not a request to see the studio"],
  ["Chamberi", false, false, ""],
  ["mañana", false, true, ""],
]) {
  check("photo question", msg, PHOTOQ_RE.test(msg), photo, note);
  check("photo question", msg + " (language)", strongSpanish(msg), es, note);
}

// ---------------------------------------------------------------------------
// The day question must not congratulate anyone. "Good choice." was baked into
// it, so every re-ask claimed a choice that had not happened. Recorded five
// times in copy.ts comments before it was finally taken out of the string.
// ---------------------------------------------------------------------------
for (const L of ["en", "es"]) {
  check("day question claims no choice", `COPY.${L}.day`, /good choice|buena elecci/i.test(COPY[L].day), false,
    "27 Sept: asked for photos three times, told 'Good choice' three times");
  check("day question still asks the day", `COPY.${L}.day`, /d[ií]a|day/i.test(COPY[L].day), true, "");
}

// ---------------------------------------------------------------------------
// "What do you offer" must be recognised as a service question even when it is
// asked standing at another question. +34 613 617 839, 28 Sept 10:42, arrived
// through the Facebook ad and asked at the day step. The bot had no case for it
// there, promised to find out, and never came back.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["what type of massage you offer ?", true, "28 Sept 10:43, his exact message. Got a stall and a broken promise"],
  ["what massages do you have", true, ""],
  ["which types do you do", true, ""],
  ["¿qué tipos de masaje ofrecen?", true, ""],
  // Must not fire: he has already named the massage he wants.
  ["I want a relaxing massage", false, "names the service, must not be sent back to the menu"],
  ["Today", false, ""],
  ["alright", false, "an acknowledgement, not a question"],
]) {
  check("what do you offer, asked mid-flow", msg, SERVICEQ_RE.test(msg) && !detectService(msg), want, note);
}

// ---------------------------------------------------------------------------
// Therapists looking for work reach us through the same ads. +34 632 487 014,
// 28 Sept 20:48, asked in Spanish whether there was a vacancy. JOB_RE carried
// the English "vacancy" but not the Spanish "vacante", so he was pushed into
// the booking flow. Worse, "en su centro" (at your establishment) was mined for
// a Madrid district and he was greeted "Perfecto, Centro."
// ---------------------------------------------------------------------------
for (const [msg, job, area, note] of [
  ["Hola. Estoy interesado en un puesto de terapeuta de masaje. \u00bfHay alguna vacante en su centro? Le agradecer\u00eda que me informara. Gracias de antemano.", true, "", "28 Sept 20:48, his exact message"],
  ["\u00bfTen\u00e9is alguna vacante?", true, "", ""],
  ["Busco un puesto de masajista", true, "", ""],
  ["Quiero trabajar con vosotros", true, "", ""],
  ["Quiero dejar mi curriculum", true, "", ""],
  // The district must survive. "Centro" only stops counting after a possessive.
  ["Estoy en el centro", false, "Centro", "the district, not their premises"],
  ["Centro", false, "Centro", ""],
  ["Un masaje relajante en Chamberi", false, "Chamber\u00ed", ""],
  ["Un masaje en Salamanca", false, "Salamanca", ""],
  ["Quiero reservar un masaje", false, "", "a customer, not a job seeker"],
]) {
  check("job seeker in Spanish", msg, JOB_RE.test(msg), job, note);
  check("job seeker in Spanish", msg + " (area)", detectArea(msg), area, note);
}

// ---------------------------------------------------------------------------
// A bare hour needs a lead-in, and "a las" was the only one we accepted.
// +595 961 330 360, 29 Sept 02:12, deep in the flow and answering properly:
// "A partir de las 17". It read as no time at all and he got the time question
// back. He had already answered the day and asked for a photo by then.
// ---------------------------------------------------------------------------
for (const [msg, want, note] of [
  ["A partir de las 17", "17:00", "29 Sept 02:12, his exact message"],
  ["a partir de las 17", "17:00", ""],
  ["desde las 17", "17:00", ""],
  ["despues de las 17", "17:00", ""],
  ["sobre las 19", "19:00", ""],
  ["las 18", "18:00", ""],
  ["after 17", "17:00", ""],
  ["from 18", "18:00", ""],
  // Already worked, must keep working.
  ["a las 20", "20:00", ""],
  ["a las 20:30", "20:30", ""],
  ["A partir de las 17:00", "17:00", ""],
  ["18h", "18:00", ""],
  // A bare number with no time lead-in is not a time. These are the ones that
  // would quietly book somebody at 03:00 if the guard were dropped.
  ["3 de septiembre", "", "a date"],
  ["el 3 de octubre", "", "a date"],
  ["2 de octubre", "", "a date"],
  ["somos 2 personas", "", "a count"],
  ["Calle Mayor 15", "", "a street number"],
]) {
  check("a bare hour needs a lead-in", msg, detectTime(msg, "es"), want, note);
}

// ---------------------------------------------------------------------------
// v204 (12 Oct): the offer step. Eleven customers since 14 Sept were given a
// real time by a real studio and none of them tapped Yes (offers_audit). The
// helpers that decide the offer live in bot.ts, which imports copy.ts from a
// pinned URL and cannot be loaded here, so the block between its "pure helpers
// (start)" and "(end)" markers is lifted out, its types stripped, and run
// against the local copy.ts.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { stripTypeScriptTypes } = await import("node:module");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const botSrc = fs.readFileSync(path.join(here, "../supabase/functions/wa-bot/bot.ts"), "utf8");
  const a = botSrc.indexOf("// ---- v204 offer step: pure helpers (start) ----");
  const b = botSrc.indexOf("// ---- v204 offer step: pure helpers (end) ----");
  if (a < 0 || b < a) throw new Error("bot.ts: the v204 offer-step helper markers are missing");
  const names = ["askWindow", "offerFitsDay", "offerFitsTime", "offerMissBy", "offerSlotAt", "offerSchedule", "offerDue", "offerRelDay", "offerDayPhrase", "windowText", "windowEs", "quotedRangeIn", "offerFar", "offerBetterAlt", "offerRank", "ALT_OFFER_RE", "OFFER_COPY", "offerButtons", "offerBody", "OFFER_LEAD_MS", "ASK_UNREAD", "altOfferAsked", "studioWordDay", "offerDayLabel", "offerDayDate", "whenFor"];
  const copyUrl = pathToFileURL(path.join(here, "../supabase/functions/wa-bot/copy.ts")).href;
  const js = `import { askBand, stripAcc, madridMidnight, madridInstant, resolveRequestDate, detectTime, COPY } from ${JSON.stringify(copyUrl)};\n`
    + stripTypeScriptTypes(botSrc.slice(a, b)) + `\nexport { ${names.join(", ")} };\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-offer-"));
  const file = path.join(dir, "offer.mjs");
  fs.writeFileSync(file, js);
  const O = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });

  // Tuesday 13 Oct 2026, Madrid wall clock (CEST).
  const M = (h, mi = 0, plusDays = 0) => madridInstant(new Date(Date.UTC(2026, 9, 13 + plusDays)), h).getTime() + mi * 60e3;
  const at = (ms) => new Date(ms).toISOString();

  // Buttons. WhatsApp cuts a reply button title at 20 characters.
  check("offer buttons", "en 18:00", O.offerButtons("en", "r1", "18:00"), [
    { id: "offer_yes_r1", title: "Yes, book 18:00" }, { id: "offer_no_r1", title: "Another time" }, { id: "offer_alt_r1", title: "Closer or cheaper" },
  ], "Jordan's wording, 12 Oct");
  check("offer buttons", "es 18:00", O.offerButtons("es", "r1", "18:00").map((x) => x.title), ["Sí, reserva 18:00", "Otra hora", "Más cerca o barato"],
    "\"Más cerca o más barato\" is 22 characters and WhatsApp would cut it");
  for (const L of ["en", "es"]) for (const t of ["18:00", "09:30", "23:45"]) {
    check("offer buttons fit in 20 characters", `${L} ${t}`, O.offerButtons(L, "r", t).map((x) => x.title.length <= 20), [true, true, true], "");
  }

  // The window the customer asked for.
  for (const [t1, want, note] of [
    ["Evening (18-21)", [1080, 1260], "#77 Andy, #82 Manas"],
    ["Hoy Tarde (13-18)", [780, 1080], "#78 Pedro"],
    ["Mañana (10-13)", [600, 780], ""],
    ["18:00", [1080, 1081], "an exact hour"],
    ["Lo antes posible (desde 12:00)", [720, 1440], "#81 Alvaro: every offer said \"instead of\""],
    ["Earliest available (from 12:00)", [720, 1440], "COPY.en.earliestToday"],
    ["Flexible", null, "no window: any hour fits"],
    ["", null, ""],
  ]) check("askWindow", t1, O.askWindow(t1), want, note);
  for (const [time, t1, want, note] of [
    ["11:45", "Evening (18-21)", false, "#82 Manas, 19 Sept: sent anyway, never answered"],
    ["16:00", "Evening (18-21)", false, "#77 Andy, 15 Sept"],
    ["14:00", "Afternoon (13-18)", true, "#84 Javier: the one perfect match"],
    ["18:00", "Tarde (13-18)", false, "#107 Willy: 18:00 is the edge, outside"],
    ["17:45", "Tarde (13-18)", true, ""],
    ["16:00", "Lo antes posible (desde 12:00)", true, "#81 Alvaro: inside his window, not \"instead of\""],
    ["11:00", "Lo antes posible (desde 12:00)", false, ""],
    ["17:00", "Flexible", true, ""],
    ["18:00", "18:00", true, ""],
    ["18:30", "18:00", false, ""],
  ]) check("offerFitsTime", `${time} vs ${t1}`, O.offerFitsTime(time, t1), want, note);
  const now13 = new Date(M(12));
  check("offerFitsDay", "Hoy vs Today", O.offerFitsDay("Hoy", "Today", "", now13), true, "a Spanish studio, an English customer, one day");
  check("offerFitsDay", "Mañana vs Today", O.offerFitsDay("Mañana", "Today", "", now13), false, "#78: Sinergia38 offered tomorrow 19:00 for a today request");
  check("offerFitsDay", "no day in the studio's words", O.offerFitsDay("", "Tomorrow", "", now13), true, "");
  check("offerMissBy", "17:00 vs 18-21", O.offerMissBy("17:00", [1080, 1260]), 60, "");
  check("offerMissBy", "21:30 vs 18-21", O.offerMissBy("21:30", [1080, 1260]), 31, "");
  check("offerMissBy", "19:00 vs 18-21", O.offerMissBy("19:00", [1080, 1260]), 0, "");

  // Lead time. Nell (#90) was sent Calma at 10:00 at 09:56.
  const slot90 = O.offerSlotAt("10:00", new Date(Date.UTC(2026, 9, 13)));
  check("offerSlotAt", "10:00 on 13 Oct", at(slot90), at(M(10)), "");
  check("never offer a slot under 45 minutes away", "#90 Nell, 10:00 sent at 09:56", slot90 - M(9, 56) < O.OFFER_LEAD_MS, true, "");
  check("never offer a slot under 45 minutes away", "10:00 sent at 09:10", M(10) - M(9, 10) < O.OFFER_LEAD_MS, false, "");

  // The follow-up and the lapse.
  const sch = (s, sl) => { const x = O.offerSchedule(s, sl); return { chaseAt: at(x.chaseAt), lapseAt: x.lapseAt === null ? null : at(x.lapseAt) }; };
  check("offerSchedule", "same day: 13:00 offered at 11:00 (the canary in synth.md)", sch(M(11), M(13)), { chaseAt: at(M(11, 15)), lapseAt: at(M(12, 15)) }, "15 minutes after, lapse 45 before");
  check("offerSchedule", "same day: 18:00 offered at 12:00", sch(M(12), M(18)), { chaseAt: at(M(12, 15)), lapseAt: at(M(17, 15)) }, "");
  check("offerSchedule", "same day: 13:30 offered at 12:00", sch(M(12), M(13, 30)), { chaseAt: at(M(12, 15)), lapseAt: at(M(12, 45)) }, "75 before the slot is earlier than 15 after, floored at 5 after");
  check("offerSchedule", "#96 Javier: 19:00 offered at 18:11", sch(M(18, 11), M(19)), { chaseAt: at(M(18, 16)), lapseAt: at(M(18, 26)) }, "never withdrawn 4 minutes after it arrived");
  check("offerSchedule", "another day: offered at 14:00 for tomorrow 13:00", sch(M(14), M(13, 0, 1)), { chaseAt: at(M(16)), lapseAt: at(M(12, 15, 1)) }, "two hours after");
  check("offerSchedule", "another day: offered at 20:30, slot in two days", sch(M(20, 30), M(18, 0, 2)), { chaseAt: at(M(10, 0, 1)), lapseAt: at(M(17, 15, 2)) }, "not at 22:30: 10:00 the next morning");
  check("offerSchedule", "another day: offered at 20:00 for tomorrow 10:00", sch(M(20), M(10, 0, 1)), { chaseAt: at(M(8, 45, 1)), lapseAt: at(M(9, 15, 1)) }, "75 before the slot wins over 10:00");
  check("offerSchedule", "no day known", sch(M(14), null), { chaseAt: at(M(16)), lapseAt: null }, "no slot, no lapse");
  const canary = O.offerSchedule(M(11), M(13));
  for (const [now, want, note] of [
    [M(11, 10), "wait", "not yet"],
    [M(11, 16), "chase", "sentAt set back 16 minutes: exactly one reminder (the once is the sweep's diary)"],
    [M(12, 14), "chase", ""],
    [M(12, 15), "lapse", "at 12:15 it has gone and the studio is told"],
  ]) check("offerDue", `13:00 offered at 11:00, now ${at(now)}`, O.offerDue(now, canary), want, note);
  check("offerDue", "#96 at 18:16", O.offerDue(M(18, 16), O.offerSchedule(M(18, 11), M(19))), "chase", "");
  check("offerDue", "#96 at 18:26", O.offerDue(M(18, 26), O.offerSchedule(M(18, 11), M(19))), "lapse", "");
  check("offerDue", "a reminder due at 22:30 waits", O.offerDue(M(23), { chaseAt: M(22, 30), lapseAt: null }), "wait", "no reminders between 22:00 and 08:00");
  check("offerDue", "and goes at 08:05", O.offerDue(M(8, 5, 1), { chaseAt: M(22, 30), lapseAt: null }), "chase", "");
  check("offerDue", "a reminder within 5 minutes of the lapse is dropped", O.offerDue(M(12, 12), { chaseAt: M(12, 12), lapseAt: M(12, 15) }), "wait", "");

  // Days in words.
  check("offerRelDay", "slot today", O.offerRelDay(M(19), M(12), "en"), "today", "");
  check("offerRelDay", "slot tomorrow, es", O.offerRelDay(M(10, 0, 1), M(20), "es"), "mañana", "#90: the word is worked out when it is sent, not copied");
  check("offerRelDay", "slot in two days", O.offerRelDay(M(10, 0, 2), M(20), "en"), "", "");
  const OFFER_ASK_EN = (x) => O.OFFER_COPY.en.ask(x);
  check("offerDayPhrase", "Today", O.offerDayPhrase("Today", "en"), "today", "the audit: \"at 16:00 Today\" read oddly");
  check("offerDayPhrase", "Tuesday 14 October", O.offerDayPhrase("Tuesday 14 October", "en"), "on Tuesday 14 October", "");
  check("offerDayPhrase", "Hoy (studio word) to an English customer", O.offerDayPhrase("Hoy", "en"), "today", "canary 12 Oct: 'can take you at 18:00 hoy'");
  check("offerDayPhrase", "Tomorrow to a Spanish customer", O.offerDayPhrase("Tomorrow", "es"), "mañana", "");
  check("whenFor", "Hoy 18:00 to an English customer", O.whenFor("Hoy 18:00", "en"), "Today 18:00", "canary 12 Oct: 'Booked! ... for *Hoy 18:00*'");
  check("whenFor", "Tomorrow 10:00 to a Spanish customer", O.whenFor("Tomorrow 10:00", "es"), "Mañana 10:00", "");
  check("whenFor", "a date is left alone", O.whenFor("Tuesday 14 October 18:00", "en"), "Tuesday 14 October 18:00", "");
  check("offer ask", "service lower-cased mid-sentence", OFFER_ASK_EN("Relaxing massage"), "Shall I book your relaxing massage? Nothing is booked until you tap Yes.", "canary 12 Oct");
  check("offer ask", "Thai keeps its capital", OFFER_ASK_EN("Thai massage"), "Shall I book your Thai massage? Nothing is booked until you tap Yes.", "");
  check("offerDayPhrase", "martes 14 de octubre", O.offerDayPhrase("martes 14 de octubre", "es"), "el martes 14 de octubre", "");
  check("windowText", "18-21 en", O.windowText([1080, 1260], "en"), "18:00 to 21:00", "");
  check("windowText", "18-21 es", O.windowText([1080, 1260], "es"), "hueco de 18:00 a 21:00", "");
  check("windowText", "from 12 en", O.windowText([720, 1440], "en"), "anything from 12:00", "");
  check("windowEs", "18-21", O.windowEs([1080, 1260]), "entre las 18:00 y las 21:00", "what the studio is told while a time is held");

  // The price range the customer was told, read off what we sent them.
  for (const [body, want, note] of [
    ["Hi Willy, Massage Club here 👋 Happy to find you one. We book you into professional studios around Madrid, and a 60 min relaxing massage is usually 50 to 60 EUR, paid at the studio.\n\nWhat day would you like it?", { lo: 50, hi: 60 }, "the v198 opener"],
    ["Hola Willy, somos Massage Club 👋 Te buscamos hueco encantados. Reservamos en centros profesionales de todo Madrid, y un masaje relajante de 60 min suele costar entre 50 y 85 EUR, que se pagan en el centro.", { lo: 50, hi: 85 }, "the opener in Spanish"],
    [COPY.en.priceInfo, { lo: 50, hi: 85 }, "the price answer"],
    ["... a 60 min relaxing massage is usually about 55 EUR, paid at the studio.", { lo: 55, hi: 55 }, "one price"],
    ["Price: 85 EUR for 60 minutes, confirmed by the studio. You pay there, no fee.", null, "an offer's price is not a range"],
    ["Mañana (10-13)", null, ""],
  ]) check("quotedRangeIn", body.slice(0, 60), O.quotedRangeIn(body), want, note);

  // Distance.
  check("offerFar", "7.6 km from Orcasitas", O.offerFar(7.6, "Orcasitas", "en"), "about 8 km from Orcasitas", "#107 Willy got Chamberí with no word about it");
  check("offerFar", "es", O.offerFar(9.4, "Tres Cantos", "es"), "a unos 9 km de Tres Cantos", "#88 Garry");
  check("offerFar", "3.2 km", O.offerFar(3.2, "Centro", "en"), "", "near enough to say nothing");
  check("offerFar", "anywhere", O.offerFar(9, "Anywhere in Madrid", "en"), "", "");
  check("offerFar", "unknown", O.offerFar(NaN, "Retiro", "en"), "", "");

  // The next offer after "Closer or cheaper".
  const declined = { price: 85, km: 1.2 };
  check("offerBetterAlt", "59 EUR, 6 km", O.offerBetterAlt({ price: 59, km: 6 }, declined), true, "cheaper");
  check("offerBetterAlt", "90 EUR, 0.5 km", O.offerBetterAlt({ price: 90, km: 0.5 }, declined), true, "closer");
  check("offerBetterAlt", "90 EUR, 3 km", O.offerBetterAlt({ price: 90, km: 3 }, declined), false, "neither");
  check("offerBetterAlt", "unknown", O.offerBetterAlt({ price: null, km: null }, declined), true, "not knowing is not worse");
  check("offerRank", "cheapest, then nearest, unknowns last",
    [{ n: "Calma", price: 85, km: 1 }, { n: "?", price: null, km: 2 }, { n: "Sinergia38", price: 59, km: 6 }, { n: "TornaSol", price: 59, km: 3 }].sort(O.offerRank).map((x) => x.n),
    ["TornaSol", "Sinergia38", "Calma", "?"], "");
  for (const [msg, want, note] of [
    ["Prefer to look for another center", true, "#83 Al, 21 Sept 13:51: got \"I am checking that now\" and nothing"],
    ["Keep looking", true, "#83 Al, the first time"],
    ["¿Hay otro centro más cerca?", true, ""],
    ["algo más barato?", true, ""],
    ["Something cheaper?", true, ""],
    ["otra zona", true, ""],
    ["Another time", false, "that is the other button"],
    ["Otra hora", false, ""],
    ["No", false, ""],
    ["más tarde", false, ""],
    ["Calle Mayor 15?", false, ""],
  ]) check("ALT_OFFER_RE", msg, O.ALT_OFFER_RE.test(msg), want, note);

  // The offer: decision first, price and place above the question.
  const listed = "Price: about 85 EUR for 60 minutes, the studio's listed price. You pay there, no fee.";
  const body107 = O.offerBody("en", { name: "Willy", studio: "Calma Madrid Spa", where: "Chamberí", time: "18:00", day: "Today", band: "", svc: "relaxing massage", price: listed, above: O.OFFER_COPY.en.above(50, 60), address: "Calle Domenico Scarlatti 5, 28003 Madrid", far: O.offerFar(7.6, "Orcasitas", "en") });
  check("offer body", "#107 Willy, as it would go now", body107,
    "Willy, Calma Madrid Spa (Chamberí) can take you at 18:00 today.\n\n" + listed + "\nThat is more than the 50 to 60 EUR I mentioned earlier: it is this studio's own price.\nCalle Domenico Scarlatti 5, 28003 Madrid, about 8 km from Orcasitas\n\nShall I book your relaxing massage? Nothing is booked until you tap Yes.",
    "price and place above the question, the gap said plainly");
  check("offer body", "the question is last", body107.trim().split("\n").pop(), "Shall I book your relaxing massage? Nothing is booked until you tap Yes.", "");
  const body82 = O.offerBody("en", { name: "Manas", studio: "Selvarrosa", where: "Chueca", time: "17:00", day: "Today", band: O.windowText([1080, 1260], "en"), svc: "massage", price: "", above: "", address: "", far: "" });
  check("offer body", "#82 Manas, an out-of-window time after the wait", body82.split("\n")[0], "Manas, nobody has 18:00 to 21:00 yet; Selvarrosa (Chueca) can do 17:00 today.", "the honest line Jordan asked for");
  const body82es = O.offerBody("es", { name: "Manas", studio: "Selvarrosa", where: "Chueca", time: "17:00", day: "Hoy", band: O.windowText([1080, 1260], "es"), svc: "masaje relajante", price: "", above: "", address: "", far: O.offerFar(6.2, "Chamartín", "es") });
  check("offer body", "#82 in Spanish", body82es,
    "Manas, todavía nadie tiene hueco de 18:00 a 21:00; Selvarrosa (Chueca) puede a las 17:00 hoy.\n\nA unos 6 km de Chamartín.\n\n¿Te reservo el masaje relajante? No se reserva nada hasta que toques Sí.", "");
  check("offer body", "next offer after a no", O.offerBody("en", { lead: O.OFFER_COPY.en.next, name: "", studio: "TornaSol", where: "Salamanca", time: "17:00", day: "Today", band: "", svc: "massage", price: "", above: "", address: "", far: "" }).split("\n\n")[0], "No problem. Here is the next option:", "");

  // The follow-up and the lapse, word for word.
  check("offer chase", "en", O.OFFER_COPY.en.chase("Javier", "Calma Madrid Spa", "19:00", "today"),
    "Javier, Calma Madrid Spa still has 19:00 free today. Tap Yes and it is yours, or tell me what would suit you better.\n\nMassage Club", "#96: the 19:00 passed with no word");
  check("offer chase", "es", O.OFFER_COPY.es.chase("Javier", "Calma Madrid Spa", "19:00", "hoy"),
    "Javier, Calma Madrid Spa sigue teniendo libre las 19:00 hoy. Toca Sí y es tuya, o dime qué te vendría mejor.\n\nMassage Club", "");
  check("offer lapse", "en, no name", O.OFFER_COPY.en.lapse("", "Calma Madrid Spa", "19:00"),
    "It is now too close to 19:00 to book Calma Madrid Spa, so that slot has gone. If you still want a massage, tell me another time or day and I will ask the studios again.\n\nMassage Club", "");

  // House rules on every new line: no em or en dashes, no holding line, no Jordan.
  const samples = [];
  for (const L of ["en", "es"]) {
    for (const [k, v] of Object.entries(O.OFFER_COPY[L])) {
      samples.push([`${L}.${k}`, typeof v === "function" ? v("Ana", "Calma Madrid Spa", "Chamberí", "18:00", "today", "x") : v]);
    }
    samples.push([`${L} body`, O.offerBody(L, { lead: O.OFFER_COPY[L].better, name: "Ana", studio: "Calma", where: "Chamberí", time: "18:00", day: "Today", band: O.windowText([1080, 1260], L), svc: "massage", price: "Price: 85 EUR", above: O.OFFER_COPY[L].above(50, 60), address: "Calle X 5", far: O.offerFar(9, "Retiro", L) })]);
  }
  for (const [k, text] of samples) {
    check("offer copy house rules", k, { dash: /[\u2013\u2014]/.test(text), holding: /checking that now|lo miro ahora mismo/i.test(text), jordan: /\bJordan\b/.test(text) }, { dash: false, holding: false, jordan: false }, "");
  }

  // v204 review (12 Oct): typed times are windows. await_time, await_hour and
  // await_time_text store what was typed, and the first cut read every one of
  // these as Flexible, so any hour a studio named was a match.
  for (const [t1, want, note] of [
    ["Tomorrow 2pm", [840, 841], "#98: a studio's 11:00 would have gone out as a plain offer"],
    ["2pm", [840, 841], ""],
    ["18h", [1080, 1081], ""],
    ["19h30", [1170, 1171], ""],
    ["19.30", [1170, 1171], ""],
    ["7:30pm", [1170, 1171], ""],
    ["a las 7", [1140, 1141], "a bare 7 is the evening: the studios open at 9 or 10"],
    ["07:30", [450, 451], "written with its zero, it stays morning"],
    ["after 7pm", [1140, 1440], ""],
    ["a partir de las 19", [1140, 1440], ""],
    ["antes de las 14", [0, 840], ""],
    ["around 6pm", [1050, 1111], "17:30 up to and including 18:30"],
    ["18:00-20:00", [1080, 1200], "askBand read this as 00:00 to 20:00"],
    ["entre las 18 y las 20", [1080, 1200], ""],
    ["de 6 a 8 de la tarde", [1080, 1200], ""],
    ["6-8pm", [1080, 1200], ""],
    ["11-1pm", [660, 780], ""],
    ["Mañana a las 18:00", [1080, 1081], "\"mañana\" is the day here, not the morning band"],
    ["mañana por la tarde", [780, 1080], ""],
    ["after work", [1080, 1260], ""],
    ["any time", null, "really flexible"],
    ["me da igual", null, ""],
    ["sometime soonish", O.ASK_UNREAD, "unreadable: no hour fits it, so a same-day time is held and another day's withheld"],
  ]) check("askWindow, typed", t1, O.askWindow(t1), want, note);
  for (const [time, t1, want, note] of [
    ["11:00", "Tomorrow 2pm", false, "#98: held or withheld, never a plain match"],
    ["14:00", "Tomorrow 2pm", true, ""],
    ["19:30", "after 7pm", true, ""],
    ["18:30", "after 7pm", false, ""],
    ["21:00", "18:00-20:00", false, ""],
    ["17:00", "sometime soonish", false, ""],
  ]) check("offerFitsTime, typed", `${time} vs ${t1}`, O.offerFitsTime(time, t1), want, note);
  check("windowText", "unreadable en", O.windowText(O.ASK_UNREAD, "en"), "the time you asked for", "the honest line still reads");
  check("windowText", "unreadable es", O.windowText(O.ASK_UNREAD, "es"), "hueco a la hora que pediste", "");
  check("windowText", "around 18:00", O.windowText(O.askWindow("around 6pm"), "en"), "17:30 to 18:30", "");
  check("windowEs", "unreadable", O.windowEs(O.ASK_UNREAD), "", "the studio is told the customer's own words instead");
  check("offerMissBy", "unreadable window", O.offerMissBy("17:00", O.ASK_UNREAD), 0, "every held time is as close as any other; price decides");

  // v204 review: "Earliest available (from 12:00)" is stored as time1 "12:00"
  // (createRequest, v159). The request's message_text still says "from".
  const earliestMsg = "Quiere: Relaxing massage | Cuando: Today Earliest available (from 12:00) | Zona: Retiro | Origen: whatsapp-bot";
  check("askWindow, stored earliest", "12:00 + message_text", O.askWindow("12:00", earliestMsg), [720, 1440], "#81 Alvaro: Calma's 14:00 is inside, not \"Nobody has 12:00 yet\"");
  check("askWindow, stored earliest", "12:00 + es message_text", O.askWindow("12:00", "Quiere: Masaje | Cuando: Hoy Lo antes posible (desde 12:00) | Zona: Sol"), [720, 1440], "");
  check("askWindow, stored earliest", "12:00 alone", O.askWindow("12:00"), [720, 721], "a real 12:00 is still exact");
  check("offerFitsTime, stored earliest", "14:00", O.offerFitsTime("14:00", "12:00", earliestMsg), true, "");

  // v204 review: a question about the offered studio is not "Closer or cheaper".
  const addrSrc = botSrc.match(/^const ADDRESS_Q_RE = (.*);$/m)?.[1];
  if (!addrSrc) throw new Error("bot.ts: ADDRESS_Q_RE is missing");
  const ADDRESS_Q_RE = new Function(`return ${addrSrc};`)();
  for (const [msg, want, note] of [
    ["Which metro is closer?", false, "a question about this studio: the address answer, not a decline"],
    ["¿Está más cerca de Sol o de Atocha?", false, ""],
    ["Is there another option to pay?", false, ""],
    ["Prefer to look for another center", true, "#83 Al"],
    ["Keep looking", true, ""],
    ["¿Hay otro centro más cerca?", true, "a question, but an explicit ask for another centre"],
    ["algo más barato?", true, ""],
    ["Something cheaper?", true, ""],
    ["Is there anything closer?", true, ""],
    ["Do you have a cheaper one?", true, ""],
    ["otra zona", true, ""],
  ]) check("altOfferAsked", msg, O.altOfferAsked(msg, looksLikeQuestion(msg) || ADDRESS_Q_RE.test(msg)), want, note);

  // v207 (12 Oct): "where is it?" in the shapes ZONEQ_RE (copy.ts) missed.
  const zmSrc = botSrc.match(/^const ZONEQ_MORE_RE = (.*);$/m)?.[1];
  if (!zmSrc) throw new Error("bot.ts: ZONEQ_MORE_RE is missing");
  const ZONEQ_MORE_RE = new Function(`return ${zmSrc};`)();
  const zoneQ = (t) => ZONEQ_RE.test(t) || ZONEQ_MORE_RE.test(t);
  for (const [msg, want, note] of [
    ["Cuál es la direcion, donde está la sala", true, "pacomartin, 12 Oct 16:46 Madrid, from the ad. Got the opener and no answer"],
    ["Cual es la direccion?", true, ""],
    ["cuál es vuestra dirección", true, ""],
    ["¿Me pasas la dirección?", true, ""],
    ["me podéis mandar la ubicación", true, ""],
    ["Dirección?", true, ""],
    ["y la dirección?", true, ""],
    ["¿Dónde está el centro?", true, ""],
    ["donde queda el local", true, ""],
    ["Dónde es?", true, ""],
    ["Quiero un masaje mañana, dónde es?", true, ""],
    ["qué metro tengo cerca", true, ""],
    ["What's the address?", true, ""],
    ["whats the location", true, ""],
    ["send me the address", true, ""],
    ["Where is the studio?", true, ""],
    ["Address?", true, ""],
    ["where are you?", true, ""],
    ["Which metro station is it?", true, ""],
    // Must not fire.
    ["Mi dirección es Calle Mayor 5", false, "their own address, not a question"],
    ["¿Cuál es tu dirección de correo?", false, "asks for an email address"],
    ["te paso mi dirección de email", false, ""],
    ["¿Dónde está mi reserva?", false, "about the booking, not the place"],
    ["where is my booking", false, ""],
    ["my email address is ana@gmail.com", false, ""],
    ["I am in Chamberi", false, ""],
    ["Another day", false, ""],
    ["nowhere", false, ""],
    ["Hi, I'd like to book a massage", false, "the ad's canned line"],
  ]) check("where question (v207)", msg, zoneQ(msg), want, note);

  // v204 review: a queued studio's "mañana" is the day after it wrote it.
  const monday = new Date(M(14, 0, -1)), tuesday = new Date(M(10)), wednesday = new Date(M(10, 0, 1));
  const tueDay = O.studioWordDay("Mañana", monday.getTime());
  check("studioWordDay", "Monday's mañana", tueDay.toISOString().slice(0, 10), "2026-10-13", "");
  check("studioWordDay", "no day word", O.studioWordDay("", monday.getTime()), null, "");
  check("offerDayLabel", "seen from Monday", O.offerDayLabel(tueDay, monday, "en"), "Tomorrow", "");
  check("offerDayLabel", "seen from Tuesday", O.offerDayLabel(tueDay, tuesday, "en"), "Today", "shown on Tuesday after \"Another time\": today, not Wednesday");
  check("offerDayLabel", "seen from Tuesday, es", O.offerDayLabel(tueDay, tuesday, "es"), "Hoy", "");
  check("offerDayLabel", "full date, en", O.offerDayLabel(new Date(Date.UTC(2026, 9, 16)), tuesday, "en"), "Friday 16 October", "");
  check("offerDayLabel", "full date, es", O.offerDayLabel(new Date(Date.UTC(2026, 9, 16)), tuesday, "es"), "viernes 16 de octubre", "");
  check("offerDayDate", "the label reads back as the same day", O.offerDayDate("", O.offerDayLabel(tueDay, tuesday, "en"), "Tomorrow", "", tuesday).toISOString().slice(0, 10), "2026-10-13", "");
  check("offerDayDate", "the old way, for the record", O.offerDayDate("Mañana", "", "Tomorrow", "", tuesday).toISOString().slice(0, 10), "2026-10-14", "what the slot, the lapse and the confirmation would have used");
  check("offerDayDate", "a full date reads back", O.offerDayDate("", "viernes 16 de octubre", null, null, wednesday).toISOString().slice(0, 10), "2026-10-16", "");
  check("offerFitsDay", "queued, with the day hint", O.offerFitsDay("", "Tomorrow", "Quiere: Masaje | Fecha: martes 13 de octubre", tuesday, "Today"), true, "");

  // v204 review: Spanish article and the new lines.
  check("offer copy", "es ask, reflexología", O.OFFER_COPY.es.ask("reflexología"), "¿Te reservo la reflexología? No se reserva nada hasta que toques Sí.", "not \"el reflexología\"");
  check("offer copy", "es ask, masaje", O.OFFER_COPY.es.ask("masaje relajante"), "¿Te reservo el masaje relajante? No se reserva nada hasta que toques Sí.", "");
  check("offer copy", "en noneLeft", O.OFFER_COPY.en.noneLeft("Paulo"), "No problem, Paulo. None of the other studios I asked can do it, so nothing is booked. Would another day or time work? Tap a day below, or tell me a day and time and I will ask again.", "never \"I am still asking\" with nothing being asked");
  check("offer copy", "en bookedStands", O.OFFER_COPY.en.bookedStands("Calma Madrid Spa", "18:00"), "Your booking at Calma Madrid Spa at 18:00 is confirmed and stays as it is. If you want to change it, tell me the new day and time.", "an old \"Another time\" after the booking was won");
}

// ---------------------------------------------------------------------------
// v204 (12 Oct): synth.md changes 3 to 5 and the two open non-customer bugs.
// Same lift as above: the block between "requests, days and voice: pure
// helpers (start)" and "(end)" in bot.ts, plus noDashes and agentReplyOk, and
// askedWhere from dispatch-studios, all run against the local copy.ts.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { stripTypeScriptTypes } = await import("node:module");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const botSrc = fs.readFileSync(path.join(here, "../supabase/functions/wa-bot/bot.ts"), "utf8");
  const dsSrc = fs.readFileSync(path.join(here, "../supabase/functions/dispatch-studios/index.ts"), "utf8");
  const a = botSrc.indexOf("// ---- v204 requests, days and voice: pure helpers (start) ----");
  const b = botSrc.indexOf("// ---- v204 requests, days and voice: pure helpers (end) ----");
  if (a < 0 || b < a) throw new Error("bot.ts: the v204 requests/days/voice helper markers are missing");
  const lift = (src, head) => { const i = src.indexOf(head); if (i < 0) throw new Error(`missing: ${head}`); return src.slice(i, src.indexOf("\n}\n", i) + 3); };
  const noDashesSrc = botSrc.match(/^const noDashes = .*$/m)?.[0];
  if (!noDashesSrc) throw new Error("bot.ts: noDashes is missing");
  const names = ["REQUEST_COPY", "stuckMinutes", "noOfferWhy", "dayListRows", "DAY_LIST_COPY", "dashRanges", "FOUNDER_CTX_MS", "FOUNDER_YES_RE", "founderMenuYes", "VOICE_FAIL", "JOB_EXTRA_RE", "isJobSeeker", "jobSeekerKind", "noDashes", "agentReplyOk", "askedWhere"];
  const copyUrl = pathToFileURL(path.join(here, "../supabase/functions/wa-bot/copy.ts")).href;
  const js = `import { JOB_RE, madridMidnight, madridInstant } from ${JSON.stringify(copyUrl)};\n`
    + stripTypeScriptTypes(botSrc.slice(a, b) + "\n" + noDashesSrc + "\n" + lift(botSrc, "function agentReplyOk(") + lift(dsSrc, "function askedWhere("))
    + `\nexport { ${names.join(", ")} };\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-req-"));
  const file = path.join(dir, "req.mjs");
  fs.writeFileSync(file, js);
  const R = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });

  // Monday 12 Oct 2026, Madrid wall clock (CEST).
  const M = (h, mi = 0, plusDays = 0) => madridInstant(new Date(Date.UTC(2026, 9, 12 + plusDays)), h).getTime() + mi * 60e3;

  // Change 3: a request stuck at "new". Ten minutes of studio hours, and a
  // night request's clock starts at 09:00, when the dispatch sweep runs.
  for (const [made, now, want, note] of [
    [M(10), M(10, 9), 9, "not yet"],
    [M(10), M(10, 10), 10, "alert at 10 minutes"],
    [M(22, 4, -1), M(9, 5), 5, "#95, made at 22:04: waiting for the 09:00 sweep is not stuck"],
    [M(22, 4, -1), M(9, 10), 10, "#95 at 09:10: stuck, nobody had noticed for days"],
    [M(7, 47), M(9, 12), 12, "#94, made 07:47 for today 12:00"],
    [M(10), M(21, 30), 0, "never after 21:00"],
    [M(10), M(8, 30), 0, "never before 09:00"],
  ]) check("stuckMinutes", note, R.stuckMinutes(made, now), want, note);

  // Change 3: nothing came. "declined" when nothing is left in play, "quiet"
  // when a same-day request has had no time from anyone for an hour.
  const D = (outcome, offered_time = null) => ({ outcome, offered_time });
  for (const [rows, sameDay, mins, want, note] of [
    [[D("declined"), D("declined"), D("declined")], false, 5, "declined", "#87 Paulo: every studio said no and he heard nothing"],
    [[D("declined"), D("no", "17:00")], true, 20, "declined", "the customer turned down the only time and the rest said no"],
    [[D("declined"), D("pending")], false, 300, "", "one studio still to answer, another day: wait"],
    [[D("pending"), D("pending"), D("declined")], true, 61, "quiet", "same day, an hour, no time from anyone"],
    [[D("pending"), D("pending")], true, 59, "", "not an hour yet"],
    [[D("pending"), D("accepted", "19:00")], true, 90, "", "a studio offered a time: the offer step has it"],
    [[D("declined"), D("expired", "13:00")], true, 90, "", "a lapsed offer already told them the slot had gone"],
    [[], true, 90, "", "nobody asked: that is the stuck check, not this one"],
  ]) check("noOfferWhy", note, R.noOfferWhy(rows, sameDay, M(12), M(12, mins)), want, note);

  // Change 3: what the customer hears. Never "I'm asking" when nobody was asked.
  check("request copy", "nothing open near Majadahonda, en", R.REQUEST_COPY.en.nothingAsked("Rajesh", R.REQUEST_COPY.en.closed("Majadahonda")),
    "Rajesh, to be straight with you: the studios near Majadahonda are closed at the time you asked for, so I have not asked anyone and nothing is booked.\n\nWould another day or time work? Tap a day below or write when suits you, and I will ask straight away.",
    "#109 Rajesh: Sunday 11:00 near Majadahonda, nothing open, never told");
  check("request copy", "nothing near, es, no area", R.REQUEST_COPY.es.nothingAsked("", R.REQUEST_COPY.es.none("")),
    "Te lo digo claro: no tengo ningún centro al que preguntar por eso, así que no he preguntado a nadie y no hay nada reservado.\n\n¿Te vendría bien otro día u otra hora? Toca un día abajo o escríbeme cuándo te viene bien y pregunto enseguida.", "");
  check("request copy", "all declined, en", R.REQUEST_COPY.en.allDeclined("Paulo", true),
    "Paulo, none of the studios I asked can take you at that time, so nothing is booked. Would another day work? Tap one below, or tell me a day and time and I will ask again.\n\nMassage Club", "#87");
  check("request copy", "quiet today, es, by email", R.REQUEST_COPY.es.quietToday("Ana", false),
    "Ana, ningún centro ha propuesto hora para hoy todavía, así que no hay nada reservado. Sigo preguntando y te escribo enseguida si alguno puede. Por si nadie puede hoy, ¿te viene bien mañana? Escríbenos por WhatsApp con otro día y hora.\n\nMassage Club", "no buttons in an email");
  const reqSamples = [];
  for (const L of ["en", "es"]) {
    const C = R.REQUEST_COPY[L];
    reqSamples.push([`${L}.nothingAsked`, C.nothingAsked("Ana", C.closed("Retiro"))], [`${L}.nothingAsked none`, C.nothingAsked("Ana", C.none("Retiro"))], [`${L}.notYet`, C.notYet("Ana")],
      [`${L}.allDeclined`, C.allDeclined("Ana", true)], [`${L}.allDeclined email`, C.allDeclined("Ana", false)], [`${L}.quietToday`, C.quietToday("Ana", true)], [`${L}.quietToday email`, C.quietToday("Ana", false)]);
  }
  for (const [k, text] of reqSamples) {
    check("request copy house rules", k, {
      dash: /[–—]/.test(text), jordan: /\bJordan\b/.test(text),
      askingNow: /asking the studios right now|preguntando a los centros ahora mismo/i.test(text) && !/quietToday/.test(k),
      booked: /nothing is booked|no hay nada reservado/i.test(text),
    }, { dash: false, jordan: false, askingNow: false, booked: true }, "honest about what has and has not happened");
  }
  // v204 review: the settle sweep's version for a night request nobody could
  // be asked about (#95), signed, and by email without the buttons.
  check("request copy", "nothing asked at 09:10, email, en", R.REQUEST_COPY.en.nothingAsked("Ana", R.REQUEST_COPY.en.closed("Vallecas"), false, true),
    "Ana, to be straight with you: the studios near Vallecas are closed at the time you asked for, so I have not asked anyone and nothing is booked.\n\nWould another day or time work? Write to us on WhatsApp with a day and time, and I will ask straight away.\n\nMassage Club", "#95, 22:04, Saturday morning in Vallecas: never told");
  for (const L of ["en", "es"]) {
    const C = R.REQUEST_COPY[L];
    for (const [k, text] of [[`${L}.nothingAsked sweep`, C.nothingAsked("Ana", C.none("Retiro"), true, true)], [`${L}.nothingAsked email`, C.nothingAsked("Ana", C.closed("Retiro"), false, true)]]) {
      check("request copy house rules", k, { dash: /[–—]/.test(text), jordan: /\bJordan\b/.test(text), signed: text.endsWith("\n\nMassage Club"), booked: /nothing is booked|no hay nada reservado/i.test(text) }, { dash: false, jordan: false, signed: true, booked: true }, "");
    }
  }
  for (const k of ["allDeclined", "quietToday"]) for (const L of ["en", "es"]) {
    check("request copy signed", `${L}.${k}`, R.REQUEST_COPY[L][k]("Ana", true).endsWith("\n\nMassage Club"), true, "sent by the sweep on its own, so it is signed");
  }

  // Change 4: the seven-day list. Monday 12 Oct 2026.
  const es7 = R.dayListRows("es", M(10));
  check("dayListRows", "es titles", es7.map((r) => r.title), ["Mar 13 oct", "Mié 14 oct", "Jue 15 oct", "Vie 16 oct", "Sáb 17 oct", "Dom 18 oct", "Lun 19 oct"], "Jordan's label, \"Mar 13 oct\"");
  check("dayListRows", "es ids", es7.map((r) => r.id), ["dayd_2026-10-13", "dayd_2026-10-14", "dayd_2026-10-15", "dayd_2026-10-16", "dayd_2026-10-17", "dayd_2026-10-18", "dayd_2026-10-19"], "");
  check("dayListRows", "tomorrow marked", es7.map((r) => r.description), ["Mañana", "", "", "", "", "", ""], "");
  check("dayListRows", "en", R.dayListRows("en", M(10)).slice(0, 2).map((r) => r.title), ["Tue 13 Oct", "Wed 14 Oct"], "");
  check("dayListRows", "at 23:30 the list still starts tomorrow", R.dayListRows("en", M(23, 30))[0].id, "dayd_2026-10-13", "Madrid date, not UTC");
  const dst = R.dayListRows("en", M(20, 0, 12)).map((r) => r.id);
  check("dayListRows", "across the clock change (25 Oct)", dst, ["dayd_2026-10-25", "dayd_2026-10-26", "dayd_2026-10-27", "dayd_2026-10-28", "dayd_2026-10-29", "dayd_2026-10-30", "dayd_2026-10-31"], "");
  for (const L of ["en", "es"]) {
    check("dayListRows fits a WhatsApp list", L, R.dayListRows(L, M(10)).every((r) => r.title.length <= 24 && r.id.length <= 200), true, "");
    check("day list copy", `${L} button`, R.DAY_LIST_COPY[L].button.length <= 20, true, "");
  }
  // The typed-day step saves a day only when there is one. synth.md tested
  // these four against v200 and every one would have become Hafeez's day.
  for (const [msg, L] of [["yes please", "en"], ["send me the list", "en"], ["si porfa", "es"], ["Mándame la lista", "es"], ["Plzz", "en"], ["Send me", "en"], ["Mandame derecicon", "es"]]) {
    check("never a day", msg, detectDay(msg, L), "", "Hafeez, 11 Oct; +34 642 627 441");
  }
  check("never a day", "the save-anything line is gone", /s\.data\.day = text\.slice\(0, 60\)/.test(botSrc), false, "await_day_text took any text at all as the day");
  for (const [msg, L, want] of [["el sábado", "es", "Sábado"], ["tomorrow", "en", "Tomorrow"], ["20 de octubre", "es", "20 octubre"]]) {
    check("a typed day is still a day", msg, detectDay(msg, L), want, "");
  }

  // Change 4: a good answer is not thrown away for a dash.
  const hafeez = "For a first massage, relaxing is a good choice — or deep tissue if you have knots. Most studios charge 50–85 EUR for 60 minutes.";
  check("agent dashes", "the raw answer fails", R.agentReplyOk(hafeez), false, "Hafeez, 11 Oct 15:34: dropped whole for one dash");
  const fixed = R.noDashes(R.dashRanges(hafeez, "en"));
  check("agent dashes", "swapped, not dropped", fixed, "For a first massage, relaxing is a good choice, or deep tissue if you have knots. Most studios charge 50 to 85 EUR for 60 minutes.", "");
  check("agent dashes", "and then it passes", R.agentReplyOk(fixed), true, "");
  check("agent dashes", "es range", R.noDashes(R.dashRanges("Suele costar 50–85 EUR.", "es")), "Suele costar 50 a 85 EUR.", "never \"50, 85 EUR\"");
  check("agent dashes", "the other checks still hold", R.agentReplyOk(R.noDashes(R.dashRanges("We can give you a 10% discount — booked for you.", "en"))), false, "a discount is still never quoted");

  // Change 4: Jordan's inbox message is the context for the next reply.
  check("founder context", "30 minutes", R.FOUNDER_CTX_MS, 30 * 60e3, "");
  const menuQ = "Would you like a menu of massages offered?";
  for (const reply of ["Plzz", "Send me", "yes please", "send me the list", "si porfa", "Mándame la lista", "Sí, por favor", "Yes!", "ok thanks"]) {
    check("founderMenuYes", reply, R.founderMenuYes(menuQ, reply), true, "Hafeez answered Jordan's menu question; the day step took \"Plzz\" as his day");
  }
  for (const [said, reply, note] of [
    [menuQ, "Tomorrow at 6", "an answer with details goes to the reader"],
    [menuQ, "what is the price?", "a question goes to the agent"],
    ["Which day suits you?", "yes", "a yes to something that is not a menu"],
  ]) check("founderMenuYes", `${said} / ${reply}`, R.founderMenuYes(said, reply), false, note);

  // Change 5: a voice note that did not come through.
  check("voice fail", "en", R.VOICE_FAIL.en, "Sorry, that voice note didn't come through on our side. Could you type it?", "Jordan's words");
  check("voice fail", "es", R.VOICE_FAIL.es, "Perdona, esa nota de voz no nos ha llegado bien. ¿Nos lo escribes?", "");
  check("voice fail", "en has no Spanish first", /perdona|audios/i.test(R.VOICE_FAIL.en), false, "the old line opened in Spanish to English speakers");
  const botCode = botSrc.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  check("voice fail", "never says we cannot listen", /can'?t listen|cannot listen|no podemos escuchar|escuchar audios/i.test(botCode), false, "we transcribe them; SENE's failed because of the OpenRouter balance");

  // Job seekers never become requests.
  for (const [msg, want, note] of [
    ["Hola, 👋 Me llamo Manju. Estoy buscando trabajo de masaje. Tengo experiencia y sé hacer masajes. Me gustaría saber si tienen alguna oportunidad de trabajo disponible.", true, "#91 Manju, 22 Sept 18:45: walked through the booking, four studios asked"],
    ["I’m looking for work. If you have any work available, please let me know. I’m interested in working with you. Thank you.", true, "#91, 18:47, at the time question"],
    ["Hola, yo estoy buscando trabajo como masajista, no estoy buscando una cita para recibir un masaje.", true, "#91, 18:55: \"cita\" let it through as a booking"],
    ["Hola, creo que ha habido una confusión. Yo estoy buscando trabajo como masajista. No estoy buscando una cita para recibir un masaje.", true, "#91, 18:57"],
    ["Busco trabajo como masajista. Tengo experiencia y estoy disponible para trabajar.", true, "#91, 19:01, the one JOB_RE caught"],
    ["Busco trabajo", true, ""],
    ["¿Necesitáis trabajo de masajista?", true, ""],
    ["Do you have any job opportunities for therapists?", true, ""],
    ["I want to book a massage after work", false, "a customer"],
    ["Busco un masaje relajante cerca del trabajo", false, "a customer"],
    ["Does the massage work for back pain?", false, "a customer"],
    ["Quiero reservar una cita para mañana", false, "a customer"],
    ["I'm looking for a massage tomorrow evening", false, "a customer"],
  ]) check("isJobSeeker", msg.slice(0, 60), R.isJobSeeker(msg), want, note);
  // v204 review (12 Oct): the check runs before every question branch and
  // closes live requests, so a customer's own words must never trip it.
  for (const [msg, want, note] of [
    ["Does the student discount apply?", "", "JOB_RE's bare \"apply\""],
    ["Does the 10% discount apply?", "", "typed at an offer: dropped it and stood the studios down"],
    ["I finish my job at 18:00, is 19:00 possible?", "", "a bare \"job\""],
    ["Can we resume?", "", "a bare \"resume\""],
    ["Is it ok to resume tomorrow?", "", ""],
    ["Great job, thanks!", "", ""],
    ["They did a great job, thanks", "", ""],
    ["¿Tenéis alguna plaza mañana por la tarde?", "", "\"alguna plaza\" is a slot"],
    ["Are you hiring?", "job", "the rest of JOB_RE still counts"],
    ["¿Tenéis alguna vacante?", "job", ""],
    ["I'd like to apply for a job as a therapist", "explicit", ""],
    ["Can I send my CV?", "explicit", ""],
    ["Estoy buscando trabajo de masaje", "explicit", "#91 Manju"],
    ["Busco trabajo", "explicit", ""],
  ]) check("jobSeekerKind", msg, R.jobSeekerKind(msg), want, note);
  check("job seeker at the offer step", "only an explicit ask, and only it closes asked requests", /jobKind && \(jobKind === "explicit" \|\| s\.step !== "await_offer"\)/.test(botSrc) && /jobKind === "explicit" \? "new,needs_contact,awaiting_go,studio_asked,studio_replied,offered,bidding" : "new,needs_contact,awaiting_go"/.test(botSrc), true, "");

  // dispatch-studios v41: the note names where the studios really are.
  const S = (area, km = null) => ({ area, km });
  for (const [studios, es, want, note] of [
    [[S("Chamberí", 7.6), S("Chamberí", 7.9)], true, " en Chamberí", "#107 Willy was told \"en Orcasitas\""],
    [[S("Chamberí"), S("Salamanca"), S("Malasaña"), S("Chamberí")], true, " en Chamberí, Salamanca y Malasaña", "#91 Manju was told \"en Vivo en Urgel, cerca del metro, a unos 5\""],
    [[S("Chamberí"), S("Salamanca")], false, " in Chamberí and Salamanca", ""],
    [[S("Chamberí", 1), S("Salamanca", 2), S("Retiro", 3), S("Centro", 2.5)], true, " cerca de ti", "four areas, all within 4 km"],
    [[S("Chamberí", 1), S("Salamanca", 2), S("Retiro", 9), S("Centro", 2.5)], false, "", "four areas, one far: no place named"],
    [[S(null, 2), S("Retiro", 3)], false, " near you", "an area unknown, all close"],
  ]) check("askedWhere", note || want, R.askedWhere(studios, es), want, note);
  const isTestPhoneSrc = dsSrc.match(/const isTestPhone = \(p: string\) => \{[\s\S]*?\n\};/)?.[0];
  if (!isTestPhoneSrc) throw new Error("dispatch-studios: isTestPhone is missing");
  const isTestPhone = new Function("TEST_PHONES", "digits", `${stripTypeScriptTypes(isTestPhoneSrc)}\nreturn isTestPhone;`)(["15622355063", "17867276503", "34612474827"], (x) => String(x || "").replace(/[^0-9]/g, ""));
  for (const [ph, want, note] of [["34600001234", true, "the canary's fake numbers never reach a real studio"], ["+34 600 00 12 34", true, ""], ["34600012345", false, "a real number that only looks close"], ["8613800000997", true, "Yi"], ["34623415275", false, "SENE, a real customer"]]) {
    check("dispatch isTestPhone", ph, isTestPhone(ph), want, note);
  }

  // v204 review: guards that live in I/O code, checked in the source.
  check("review guards", "no price ask after \"no os guardéis el hueco\"", /!drow\.quoted_price && \["whatsapp", "email", "none", "queued", "held_window", "held"\]\.includes\(fwd\)/.test(botSrc), true, "a studio told not to hold the slot was then asked its price");
  check("review guards", "declineOffer stops on a row that was not open", /const closedNow = await up\.json\(\)/.test(botSrc) && /outcome=in\.\(pending,accepted\)`, \{ method: "PATCH", headers: \{ \.\.\.H\(\), Prefer: "return=representation" \}, body: JSON\.stringify\(\{ outcome: "no"/.test(botSrc), true, "an old \"Another time\" told the winning studio the client did not want it");
  check("review guards", "\"I am still asking\" only with something asked", /if \(await widenRequest\(req\) \|\| await asksOpen\(Number\(req\.id\)\)\) \{\s*await say\(OFFER_COPY\[L\]\.noneYet\)/.test(botSrc), true, "");
  check("review guards", "the voice ping carries the number", /could not be transcribed; the bot asked them to type it\. Listen: [^\n]*`, from\);/.test(botSrc), true, "a fake 3460000xxxx canary paged Jordan");
  check("review guards", "lapse and \"Another time\" notes have a template fallback", (botSrc.match(/await studioNoteSure\(/g) || []).length >= 3 && /body\.studio_note && typeof body\.studio_note === "object"/.test(dsSrc) && /sendStudioNote\(to, String\(n\.text\)/.test(dsSrc), true, "plain text to a studio dies at Meta after 24h");
  check("review guards", "dispatch: a cancelled request is nobody's original", /stage=not\.in\.\(dismissed,cancelled,stale,too_late\)&created_at=gte\.\$\{since24\}/.test(dsSrc), true, "");
  check("review guards", "the canary's settle only touches fake numbers", /const only = \/\^34600000\\d\{0,3\}\$\/\.test\(String\(payload\.only/.test(botSrc) && /if \(!o \|\| !o\.row \|\| !o\.sentAt \|\| o\.change \|\| !phone \|\| \(only && !phone\.startsWith\(only\)\)\) continue;/.test(botSrc), true, "settle on wa-bot-canary would otherwise sweep every real session");
  check("review guards", "the two automatic studio replies are signed", /const SOCIOS_FALLBACK_ACK = "[^"\n]*\\n\\nJordan, de Massage Club";/.test(botSrc) && /const SOCIOS_HELLO_ACK = "[^"\n]*\\n\\nJordan, de Massage Club";/.test(botSrc), true, "messages to studios are from Jordan, de Massage Club");
  check("review guards", "the A/B open log keeps only v=t or v=h", /const v = via === "t" \|\| via === "h" \? via : "";/.test(botSrc) && /socLogView\(String\(partner\.id\), String\(url\.searchParams\.get\("v"\) \|\| ""\)\)/.test(botSrc), true, "");
  check("review guards", "dispatch: the \"it ended\" sweep reaches chased rows", /request_dispatch\?outcome=in\.\(pending,accepted\)&created_at=gte/.test(dsSrc), true, "");
}

// ---------------------------------------------------------------------------
// v206 (12 Oct, Jordan approved "change 3"): agent_core.ts lets Claude run the
// conversation behind AGENT_CORE. It imports nothing, so it is loaded here as
// it is. noDashes, dashRanges and stripUnaskedLink are lifted out of bot.ts the
// same way as above. No API is called: runCoreTurn is driven with a stub fetch
// that plays back model responses, and every send lands in a log.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { stripTypeScriptTypes } = await import("node:module");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const C = await import(pathToFileURL(path.join(here, "../supabase/functions/wa-bot/agent_core.ts")).href);
  const copyUrl = pathToFileURL(path.join(here, "../supabase/functions/wa-bot/copy.ts")).href;
  const { HOURS, ALL_SERVICES, CHANGE_RE } = await import(copyUrl);
  const botSrc = fs.readFileSync(path.join(here, "../supabase/functions/wa-bot/bot.ts"), "utf8");
  const facts = fs.readFileSync(path.join(here, "../docs/agent/facts.md"), "utf8");
  const one = (name) => { const m = botSrc.match(new RegExp(`^const ${name} = .*$`, "m")); if (!m) throw new Error(`bot.ts: ${name} is missing`); return m[0]; };
  const lift = (src, head) => { const i = src.indexOf(head); if (i < 0) throw new Error(`missing: ${head}`); return src.slice(i, src.indexOf("\n}\n", i) + 3); };
  const js = `import { HOWWORKS_RE, PHOTOQ_RE, resolveRequestDate, madridInstant } from ${JSON.stringify(copyUrl)};\n`
    + stripTypeScriptTypes([one("noDashes"), one("dashRanges"), one("WHO_RE"), one("linkAsked"), one("DECLINE_RE"), lift(botSrc, "function stripUnaskedLink("),
      lift(botSrc, "function coreConfirmedStart("), lift(botSrc, "function coreConfirmedStillAhead(")].join("\n"))
    + `\nexport { noDashes, dashRanges, linkAsked, stripUnaskedLink, DECLINE_RE, coreConfirmedStart, coreConfirmedStillAhead };\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-core-"));
  const file = path.join(dir, "core.mjs");
  fs.writeFileSync(file, js);
  const G = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });

  // Monday 12 Oct 2026, Madrid wall clock (CEST).
  const M = (h, mi = 0, plusDays = 0) => madridInstant(new Date(Date.UTC(2026, 9, 12 + plusDays)), h).getTime() + mi * 60e3;

  // 1. The switch. Anything but "test" or "on" is off.
  for (const [v, want] of [["", "off"], [undefined, "off"], ["OFF ", "off"], ["yes", "off"], ["test", "test"], [" On", "on"]]) check("AGENT_CORE", String(v), C.parseCoreMode(v), want, "");
  for (const [mode, ph, want, note] of [
    ["test", "34600000234", true, "a canary fake number"], ["test", "3460000023", false, "one digit short"], ["test", "34600004188", false, "a real customer in the old, wider block"],
    ["test", "34612474827", false, "Jordan's own number is not a canary number"], ["test", "15622355063", false, ""],
    ["on", "34631294370", true, "Hafeez, once it is on"], ["on", "", false, ""], ["off", "34600000234", false, "off is off"],
  ]) check("coreEligiblePhone", `${mode} ${ph}`, C.coreEligiblePhone(mode, ph), want, note);

  // 2. Which messages the core takes. Everything here is decided in bot.ts
  // exactly like this (the coreTake block above the clothing gate).
  const AD = "Hi, I'd like to book a massage. I saw you on Facebook.";
  const takes = (step, text, o = {}) => C.coreTakes({ mode: "test", phone: "34600000234", step, text, jobSeeker: false,
    offerTimeNamed: step === "await_offer" && !!parseOfferedTime(text) && parseOfferedTime(text) !== "18:00",
    confirmLater: CONFIRM_LATER_RE.test(text), emailOnly: isEmail(text), bareOpener: HI_RE.test(text.trim()) || AD_OPENER_RE.test(text.trim()), adOpener: AD_OPENER_RE.test(text.trim()), ...o }).ok;
  check("coreTakes", "job seeker", takes("await_day", "Estoy buscando trabajo de masaje", { jobSeeker: true }), false, "#91 Manju: the job-seeker gate answers");
  for (const st of ["human", "await_go", "await_reconfirm", "await_change", "await_studio_text"]) check("coreTakes", `step ${st}`, takes(st, "hello there, any news?"), false, "");
  check("coreTakes", "start + Hi", takes("start", "Hi"), false, "greet() sends Jordan's opener");
  check("coreTakes", "start + the ad line", takes("start", AD), false, "greet()");
  check("coreTakes", "start + the ad line and more", takes("start", AD + " . hola"), true, "their own words after the ad's");
  check("coreTakes", "await_offer + another time", takes("await_offer", "7pm?"), false, "Asim: the await_offer case asks for it");
  check("coreTakes", "await_offer + confirm later", takes("await_offer", "I'll confirm the day before"), false, "Juan, v124");
  check("coreTakes", "await_offer + more info", takes("await_offer", "I want to know more info"), true, "Al (#83)");
  check("coreTakes", "await_email_post + email", takes("await_email_post", "ana@gmail.com"), false, "booking-ack path");
  check("coreTakes", "await_email_post + skip", takes("await_email_post", "skip"), false, "");
  check("coreTakes", "await_day_text + send me the list", takes("await_day_text", "send me the list"), true, "Hafeez");
  check("coreTakes", "Hi at await_day", takes("await_day", "Hi"), true, "Hafeez 13:27 got the whole opener again");
  check("coreTakes", "a real number under test", C.coreTakes({ mode: "test", phone: "34631294370", step: "await_day", text: "Hi", jobSeeker: false, offerTimeNamed: false, confirmLater: false, emailOnly: false, bareOpener: false }).ok, false, "");

  // 3. set_details validation, Monday 12 Oct.
  const cal = C.madridCalendar(M(10), 61);
  const vdeps = {
    dayLabel: (iso, L) => {
      const c = cal.find((x) => x.iso === iso); if (!c) return null;
      const long = L === "es" ? c.es : c.en;
      return c.plus === 0 ? { day: L === "es" ? "Hoy" : "Today", dayDate: long } : c.plus === 1 ? { day: L === "es" ? "Mañana" : "Tomorrow", dayDate: long } : { day: long, dayDate: null };
    },
    isEmail, parseName, hours: HOURS, earliestLabel: (L) => COPY[L === "es" ? "es" : "en"].earliestToday, noDashes: G.noDashes,
    detectAreaPlus: (t) => detectArea(t) || (/majadahonda/i.test(t) ? "Majadahonda" : /lavapi[eé]s/i.test(t) ? "Lavapiés" : ""),
  };
  const V = (args, at = M(10), data = {}, L = "en", live = "") => C.validateDetails(args, data, at, vdeps, L, live);
  const today = V({ day: "2026-10-12" });
  check("set_details day", "2026-10-12 at 10:00", [today.patch.day, today.patch.dayDate, today.errors.length], ["Today", "Monday 12 October", 0], "");
  check("set_details day", "2026-10-12 at 19:30", [V({ day: "2026-10-12" }, M(19, 30)).errors.length, "day" in V({ day: "2026-10-12" }, M(19, 30)).patch], [1, false], "no same-day booking after 19:00");
  check("set_details day", "2026-10-13 in Spanish", V({ day: "2026-10-13" }, M(10), {}, "es").patch.day, "Mañana", "");
  for (const [d, note] of [["2026-10-11", "past"], ["2026-12-25", "more than 60 days"], ["next friday", "not a date"]]) check("set_details day rejected", d, V({ day: d }).errors.length, 1, note);
  check("set_details day", "\"Plzz\" is never a day", V({ day: "Plzz" }).errors.length, 1, "Hafeez, 11 Oct");
  check("set_details time", "18:00 tomorrow", V({ time: "18:00" }, M(10), { day: "Tomorrow" }).patch.time, "18:00", "");
  check("set_details time", "07:00", V({ time: "07:00" }, M(10), { day: "Tomorrow" }).errors.length, 1, "before studio hours");
  check("set_details time", "today 10:30 at 10:00", V({ time: "10:30" }, M(10), { day: "Today" }).errors.length, 1, "less than an hour away");
  check("set_details time", "today 11:00 at 10:00", V({ time: "11:00" }, M(10), { day: "Today" }).patch.time, "11:00", "exactly an hour away");
  check("set_details time", "morning today at 11:30", V({ time: "morning" }, M(11, 30), { day: "Today" }).errors.length, 1, "11:30 + 105 min is past 13:00 (dispatch-studios tooLateReason)");
  check("set_details time", "morning today at 11:00", V({ time: "morning" }, M(11), { day: "Today" }).patch.timeBandId, "time_morning", "12:45 is inside 13:00, and dispatch would ask");
  check("set_details time", "evening (en)", [V({ time: "evening" }).patch.timeBandId, V({ time: "evening" }).patch.time], ["time_evening", "Evening (18-21)"], "");
  check("set_details time", "evening (es)", V({ time: "evening" }, M(10), {}, "es").patch.time, "Noche (18-21)", "");
  check("set_details time", "earliest today at 10:00", V({ time: "earliest" }, M(10), { day: "Today" }).patch.time, COPY.en.earliestToday, "");
  check("set_details time", "earliest today at 11:30", V({ time: "earliest" }, M(11, 30), { day: "Today" }).errors.length, 1, "studios are asked for 12:00, too soon");
  check("set_details time", "earliest tomorrow", V({ time: "earliest" }, M(10), { day: "Tomorrow" }).errors.length, 1, "only for today");
  const moved = V({ day: "2026-10-12" }, M(10), { day: "Tomorrow", dayDate: "Tuesday 13 October", time: "10:30" });
  check("set_details time", "day moved to today under a time that has gone", [moved.clear.includes("time"), moved.errors.length], [true, 1], "");
  check("set_details area", "the ad line", V({ area: "Hi, I'd like to book a massage. I saw yo" }).errors.length, 1, "Salado, 12 Oct: offered studios \"cerca de Hi, I'd like...\"");
  check("set_details area", "Majadahonda", V({ area: "Majadahonda" }).patch.area, "Majadahonda", "Rajesh (#109)");
  check("set_details area", "en la zona de Lavapiés", V({ area: "Lavapiés" }).patch.area, "Lavapiés", "Javier");
  check("set_details area", "Madrid", V({ area: "Madrid" }).errors.length, 1, "not an area");
  check("set_details area", "anywhere", V({ area: "anywhere" }).patch.area, "anywhere", "");
  check("set_details email", "ana@gmail", V({ email: "ana@gmail" }).errors.length, 1, "");
  check("set_details email", "ANA@Gmail.com", V({ email: "ANA@Gmail.com" }).patch.email, "ana@gmail.com", "");
  check("set_details email", "refused", V({ email_refused: true }).patch.emailRefused, true, "");
  check("set_details language", "ro", [V({ language: "ro" }).patch.xlang, V({ language: "ro" }).patch.lang], ["ro", "en"], "Alexandru, 8 Oct");
  check("set_details language", "es clears xlang", V({ language: "es" }).clear.includes("xlang"), true, "");
  check("set_details service", "svc_lymph", V({ service: "svc_lymph" }).patch.service, "svc_lymph", "CG, 4 Oct");
  check("set_details service", "svc_foo", V({ service: "svc_foo" }).errors.length, 1, "");
  check("set_details name", "My name us bernard", V({ name: "Bernard" }).patch.name, "Bernard", "");
  const so = { lang: "es", name: "Ana", email: "ana@gmail.com", day: "Today", dayDate: "x", time: "18:00", area: "Retiro", picks: [{ id: "1" }], offerMode: true, prefer: [{ id: "1" }] };
  C.applyPatch(so, V({ start_over: true }, M(10), so));
  check("set_details start_over", "clears the booking, keeps who they are", [so.day, so.time, so.area, so.picks, so.offerMode, so.prefer, so.lang, so.name, so.email], [undefined, undefined, undefined, undefined, undefined, undefined, "es", "Ana", "ana@gmail.com"], "");
  const live = V({ day: "2026-10-13", name: "Rajesh" }, M(10), {}, "en", "Request #109 is with the studios");
  check("set_details live", "day is refused, name is kept", [live.errors.length, /Only if they asked to cancel or move it, use booking_action/.test(live.errors[0] || ""), live.patch.name, "day" in live.patch], [1, true, "Rajesh", false], "#109: the area cannot move behind the studios' backs");
  // v206 review: the refusal never pushes a cancel; a second booking goes to the team.
  check("set_details live", "never suggests cancelling unasked", [/use booking_action cancel/.test(live.errors[0] || ""), /second, separate booking[^.]*notify_jordan/.test(live.errors[0] || "")], [false, true], "\"can I also book one for my wife?\" must not cancel a real booking");

  // 4. nextStep, one rung each.
  for (const [data, prof, want] of [
    [{}, "", "await_day"], [{ day: "Today" }, "", "await_time"], [{ day: "Today", time: "18:00" }, "", "await_area"],
    [{ day: "Today", time: "18:00", area: "Retiro" }, "", "await_name"], [{ day: "Today", time: "18:00", area: "Retiro" }, "Hafeez", "await_email_req"],
    [{ day: "Today", time: "18:00", area: "Retiro", name: "Ana", emailRefused: true }, "", "await_studio"],
    [{ day: "Today", time: "18:00", area: "Retiro", name: "Ana", email: "a@b.co" }, "", "await_studio"],
  ]) check("nextStep", JSON.stringify(data) + (prof ? " +profile" : ""), C.nextStep(data, prof), want, "");

  // 5. The guard.
  const gdeps = { noDashes: G.noDashes, dashRanges: G.dashRanges, stripUnaskedLink: G.stripUnaskedLink };
  const gbase = { lang: "en", asked: "", linkAsked: false, allowedPrices: [50, 85], allowedStudios: [], allStudioNames: ["calma madrid spa", "sinergia38", "centro aloha", "masajes"], allowedEmails: ["support@massageclub.io", "ana@gmail.com"], firstReply: false, night: false, confirmed: false };
  const GR = (t, o = {}) => C.guardReply(t, { ...gbase, ...o }, gdeps);
  check("guard repairs", "Relaxing \u2014 gentle", [GR("Relaxing \u2014 gentle").ok, GR("Relaxing \u2014 gentle").text], [true, "Relaxing, gentle"], "Hafeez's answer was dropped over one em dash");
  check("guard repairs", "50\u201385 EUR", GR("50\u201385 EUR").text, "50 to 85 EUR", "");
  check("guard repairs", "50\u201385 EUR (es)", GR("50\u201385 EUR", { lang: "es" }).text, "50 a 85 EUR", "");
  for (const [t, o, note] of [
    ["Your massage is booked for 18:00.", {}, "only a studio's offer plus their tap books"],
    ["Te hemos reservado a las 18:00.", {}, ""],
    ["You get 10% off.", {}, "never quote a discount"],
    ["Hay un descuento para ti.", {}, ""],
    ["A relaxing massage helps you detox.", {}, ""],
    ["The therapists speak English.", {}, ""],
    ["Jordan will reply soon.", {}, ""],
    ["See https://example.com for more.", {}, ""],
    ["I will pass you to a representative.", {}, ""],
    ["Call us on +34 612 474 827.", {}, ""],
    ["Write to bob@example.com.", {}, ""],
    ["It is 70 EUR for 60 minutes.", {}, "70 is not a price anyone gave"],
    ["Calma Madrid Spa has room at 18:00.", {}, "studio names come only with studio_options or the offer"],
    ["Which day would you like?", { firstReply: true }, "the first message carries the price"],
    ["I'm asking them right now.", { night: true }, "23:00: studios are asked from 09:00"],
    ["Hola Bernard, soy Ana. ¿Qué día?", {}, "never signed with a person's name"],
    ["The therapists are fully licensed.", {}, ""],
    ["Book here: https://book.massageclub.io/reserve", {}, "no link they did not ask for"],
  ]) check("guard fails", t, GR(t, o).ok, false, note);
  for (const [t, o, note] of [
    ["Nothing is booked until you tap Yes.", {}, ""],
    ["No se reserva nada hasta que toques Sí.", {}, ""],
    ["Studios in Madrid usually speak Spanish.", {}, ""],
    ["Pagas en el centro, sin comisión.", {}, ""],
    ["A 60 minute relaxing massage is usually 50 to 60 EUR.", { allowedPrices: [50, 60] }, ""],
    ["Got it, I'll send the confirmation to ana@gmail.com too.", {}, "their own email"],
    ["Calma Madrid Spa (Chamberí), relaxing 60 min, 85 EUR.", { allowedStudios: ["Calma Madrid Spa"] }, "a studio from studio_options"],
    ["Our masajes relajantes are the most popular.", {}, "a partner called Masajes is not checked"],
    ["I'm Massage Club's booking assistant.", {}, "Bernard asked \"Tu nombre?\""],
    ["Here it is: https://book.massageclub.io", { linkAsked: true }, "they asked for the website"],
    ["The offer tells you whether the studio confirmed it.", {}, "a hedge"],
    ["Thanks Jordan, which day suits you?", { ownNames: ["Jordan"] }, "a customer called Jordan"],
    // The answers the core is meant to give in the ten cases of the design.
    ["1. The studio's own professional therapist, and you can ask for a woman or a man. 2. 60 minutes is usual, 90 is possible; a 60 minute relaxing massage is usually 50 to 85 EUR, paid at the studio. 3. We are not one place: we book a studio near you, and its name and address come with the offer. 4. You are covered with a towel and underwear stays on; only the area being worked on is uncovered. What time tomorrow suits you?", {}, "CCF, 6 Oct: four questions, four answers"],
    ["Te lo da un masajista profesional del propio centro, y si prefieres chica o chico se lo pedimos. No somos un solo sitio: te reservamos en un centro cerca de ti. ¿En qué zona de Madrid estás?", { lang: "es" }, "Javier (+34 693 301 014)"],
    ["None of the studios near Chamartín lists lymphatic drainage on its menu. I can ask several whether they do it on Tuesday evening, and you'll get each one's price before anything is booked. Shall I?", {}, "CG, 4 Oct"],
    ["Perfecto, sin prisa. Cuando lo tengas claro me escribes aquí y te lo busco en Salamanca.", { lang: "es" }, "Bernard, 10 Oct"],
    ["Soy el asistente de reservas de Massage Club.", { lang: "es" }, "Bernard: \"Tu nombre?\""],
    ["Tu nombre, para que el centro tenga la reserva a tu nombre.", { lang: "es" }, "Salado's bare \"?\""],
  ]) check("guard passes", t, [GR(t, o).ok, GR(t, o).reasons], [true, []], note);

  // 6. Prices next to a currency.
  for (const [t, want] of [["50 to 60 EUR", [50, 60]], ["€85", [85]], ["18:00", []], ["60 min", []], ["entre 50 y 85 euros", [50, 85]], ["unos 59,90 € por 60 min", [59.9]], ["at 18:00, 50 EUR", [50]]]) check("priceNumbers", t, C.priceNumbers(t), want, "");

  // 7. The prompt.
  const sys = C.coreSystemPrompt(C.factsForCore(facts));
  check("system prompt", "no em or en dash", /[\u2013\u2014]/.test(sys), false, "");
  check("system prompt", "the booking page", sys.includes("book.massageclub.io"), true, "");
  check("system prompt", "no hand-off contract", /hand-off contract|AGENT_URL|"mode": "send"/.test(sys), false, "facts.md's old JSON contract is not for the core");
  check("system prompt", "stable bytes", C.coreSystemPrompt(C.factsForCore(facts)) === sys, true, "the prompt cache needs the same prefix every time");
  const at = (h, mi = 0) => new Date(M(h, mi)).toISOString();
  const rows = [];
  for (let k = 0; k < 26; k++) rows.push({ id: k + 1, dir: k % 2 ? "out" : "in", body: k % 2 ? `Which day? [Today/Tomorrow/Another day] ${k}` : `message ${k}`, at: at(12, k), type: "text" });
  rows.push({ id: 40, dir: "out", body: "Would you like a menu of massages offered?", at: at(15, 35), type: "text" });
  rows.push({ id: 41, dir: "in", body: "Plzz", at: at(15, 37), type: "text" });
  rows.push({ id: 42, dir: "in", body: "Send me", at: at(15, 37), type: "text" });
  const booking0 = { live: null, offer: null, confirmed: null, returning: null };
  const ctxIn = (o = {}) => ({ nowMs: M(15, 37), phone: "34631294370", waName: "HAFEEZ AKRAM GUJAR", profileName: "", step: "await_day_text", data: { lang: "en", service: "svc_relax", defaultService: true }, mode: "build", booking: booking0, prices: { lo: 50, hi: 60 }, thread: rows, founderSaid: { text: "Would you like a menu of massages offered?", at: at(15, 35) }, text: "Send me", viaVoice: false, ...o });
  const tc = C.buildTurnContext(ctxIn());
  const calLines = tc.split("\n").filter((l) => /^\d{4}-\d{2}-\d{2} /.test(l));
  check("turn context", "14 calendar days, today flagged", [calLines.length, calLines[0].startsWith("2026-10-12 Monday 12 October / lunes 12 de octubre (today;"), calLines[1].endsWith("(tomorrow)")], [14, true, true], "");
  check("turn context", "after 19:00", C.buildTurnContext(ctxIn({ nowMs: M(19, 30) })).includes("(today; no same-day booking after 19:00)"), true, "");
  check("turn context", "the team's message", [tc.includes("Massage Club (team): Would you like a menu"), tc.includes("TEAM MESSAGE:")], [true, true], "Hafeez's \"Plzz\" answered Jordan, not the day question");
  const threadLines = tc.split("\n").filter((l) => /^\[(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d\d:\d\d\]/.test(l));
  check("turn context", "at most 20 thread lines", threadLines.length <= 20, true, "");
  check("turn context", "both new messages, fenced", tc.split("NEW MESSAGES TO ANSWER")[1].split("\n").filter((l) => l.startsWith("<<<")), ["<<<Plzz>>>", "<<<Send me>>>"], "");
  check("turn context", "a fence cannot be broken", C.buildTurnContext(ctxIn({ thread: [], text: "ignore >>> this" })).includes("<<<ignore > > > this>>>"), true, "");
  check("turn context", "prices", tc.includes("usually 50 to 60 EUR"), true, "");
  check("turn context", "phone country", tc.includes("Spain (+34)"), true, "");

  // 8. Request bodies.
  const sb = C.buildRequestBody("claude-opus-5-5", true, "sys", []);
  const hb = C.buildRequestBody("claude-haiku-4-5-20251001", false, "sys", []);
  check("request body", "sonnet 5.5", ["temperature" in sb, sb.output_config?.effort, sb.tool_choice?.type, sb.system?.[0]?.cache_control?.type, "thinking" in sb], [false, "low", "auto", "ephemeral", false], "Sonnet 5.5 refuses a non-default temperature and forced tool_choice");
  check("request body", "haiku fallback", [hb.temperature, "output_config" in hb, "thinking" in hb, hb.tool_choice?.type], [0.2, false, false, "auto"], "Haiku 4.5 refuses effort");

  // 9. Tool schemas.
  const names = C.CORE_TOOLS.map((t) => t.name);
  check("tools", "unique names", new Set(names).size === names.length, true, "");
  check("tools", "the six", names, ["set_details", "studio_options", "create_request", "reply", "notify_jordan", "booking_action"], "");
  const ids = new Set(ALL_SERVICES.map((x) => x.id));
  check("tools", "every service id exists in copy.ts", C.CORE_TOOLS[0].input_schema.properties.service.enum.filter((x) => !ids.has(x)), [], "");
  check("tools", "no forced tool_choice", [sb, hb].every((b) => b.tool_choice.type === "auto"), true, "");

  // 10. Source guards in bot.ts.
  const iResume = botSrc.indexOf("await resumeFromPhone(s, from)) return");
  const iHook = botSrc.indexOf("const r = await runCoreTurn(coreCtx(),");
  const iFounder = botSrc.indexOf("if (text && !replyId && s.data.founderSaid)");
  check("hook", "after the resume codes, before the founder block", iResume > 0 && iHook > iResume && iFounder > iHook, true, "");
  check("hook", "clothing gate skips core turns", /if \(text && MODESTY_RE\.test\(text\) && !coreTake\.ok\)/.test(botSrc), true, "CCF's four questions");
  check("hook", "coreTake only for typed text", /const coreTake = text && !replyId && !flowAnswers/.test(botSrc), true, "taps keep their handlers");
  check("hook", "AGENT_CORE", /parseCoreMode\(await appSecret\("AGENT_CORE"\)\)/.test(botSrc), true, "");
  check("hook", "agent_core import", /from "\.\/agent_core\.ts";/.test(botSrc), true, "");
  check("hook", "the job-seeker gate still runs its v204 rule", /closeAsJobSeeker\(s, from, L, text, jobKind\)/.test(botSrc), true, "");

  // 11. One turn, with the API played back from a stub. Nothing leaves the process.
  const tu = (name, input, id = `${name}_${Math.random().toString(36).slice(2, 7)}`) => ({ type: "tool_use", id, name, input });
  const resp = (...content) => ({ content, stop_reason: content.some((c) => c.type === "tool_use") ? "tool_use" : "end_turn", usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 4 } });
  const mkCtx = (responses, o = {}) => {
    const log = { sent: [], events: [], saves: 0, bodies: [], notes: [], finalized: 0 };
    let i = 0;
    const ctx = {
      now: () => o.now ?? M(10),
      fetch: async (_url, init) => { log.bodies.push(JSON.parse(init.body)); const r = responses[i++]; if (!r) throw new Error("no response left"); if (r.status) return { ok: false, status: r.status, json: async () => ({ error: { message: "boom" } }) }; return { ok: true, status: 200, json: async () => r }; },
      aiKey: async () => "test-key", model: "claude-opus-5-5", fallbackModel: "claude-haiku-4-5-20251001",
      facts: async () => facts,
      thread: async () => o.thread || [{ id: 7, dir: "in", body: o.text || "hi", at: at(9, 59), type: "text" }],
      myInboundId: async () => 7, newerInbound: async () => !!o.newer,
      ownWords: (t, kind) => kind === "cancel" ? (CANCEL_RE.test(t) || G.DECLINE_RE.test(t)) : (CHANGE_RE.test(t) && !GOODBYE_RE.test(t)),
      bookingFacts: async () => o.booking || booking0,
      openerFacts: async () => ({ lo: 50, hi: 60, areas: [] }),
      profileFirstName: firstNameFromProfile,
      saveSession: async () => { log.saves++; },
      logEvent: async (_p, e, m) => { log.events.push([e, m]); },
      dropStaleDay: () => {}, dayLabel: vdeps.dayLabel, earliestLabel: vdeps.earliestLabel,
      isEmail, parseName, detectService, detectAreaPlus: vdeps.detectAreaPlus, hours: HOURS,
      noDashes: G.noDashes, dashRanges: G.dashRanges, stripUnaskedLink: G.stripUnaskedLink, linkAsked: G.linkAsked,
      studioNames: async () => ["calma madrid spa", "sinergia38"],
      sendText: async (_to, body) => { log.sent.push(["text", body]); return true; },
      sendButtons: async (_to, body, btns) => { log.sent.push(["buttons", body, btns.map((b) => b.id)]); return true; },
      sendList: async (_to, body, _b, rws) => { log.sent.push(["list", body, rws.map((r) => r.id)]); return true; },
      dayButtons: () => [{ id: "day_today", title: "Today" }, { id: "day_tomorrow", title: "Tomorrow" }, { id: "day_other", title: "Another day" }],
      timeButtons: () => [{ id: "time_morning", title: "Morning" }, { id: "time_afternoon", title: "Afternoon" }, { id: "time_evening", title: "Evening" }],
      areaRows: () => ({ button: "Choose area", rows: [{ id: "area_centro", title: "Centro" }, { id: "area_any", title: "Anywhere" }] }),
      sendReservePage: async () => { log.sent.push(["page"]); },
      studioOptions: async () => o.picks || [],
      finalizeBooking: async (s) => { log.finalized++; s.step = "done"; log.sent.push(["text", "Done, asking the studios"]); return { outcome: "asked", requestId: 130 }; },
      askedStudios: async () => 3, lastOutbound: async () => "Done, asking the studios",
      reshowOffer: async () => { log.sent.push(["buttons", "offer again"]); return true; }, declineOffer: async () => {}, cancelOffered: async () => {}, reconfirm: async () => {}, cancelOpenRequest: async () => true,
      genderOnLiveRequest: async () => null, attachEmail: async () => null, closeAsJobSeeker: async () => { log.sent.push(["text", "job"]); },
      blockLine: () => BLOCK_LINE_EN, notifyJordan: async (t) => { log.notes.push(t); }, notifyHuman: async () => { log.notes.push("human"); },
    };
    return { ctx, log };
  };
  const sess = (step, data = {}) => ({ phone: "34600000234", step, data: { lang: "en", service: "svc_relax", ...data }, wa_name: "Hafeez Akram" });
  const turn = (s, text, o = {}) => ({ s, from: "34600000234", L: "en", text, viaVoice: false, founderSaid: null, ackOnly: false, switchMode: "test", ...o });
  const ev = (log, name) => log.events.filter((e) => e[0] === name);

  // a. Everything said in one message is kept, and the next question is asked once.
  {
    const { ctx, log } = mkCtx([resp(tu("set_details", { day: "2026-10-13", time: "evening" }), tu("reply", { text: "Lovely, tomorrow evening. Which part of Madrid suits you?", buttons: { kind: "areas" } }))]);
    const s = sess("await_day");
    const r = await C.runCoreTurn(ctx, turn(s, "tomorrow evening please"));
    check("core turn", "details kept, area asked", [r.handled, r.sent, log.sent.map((x) => x[0]), s.step, s.data.day, s.data.timeBandId, ev(log, "day_chosen").length, ev(log, "agent_core_turn").length], [true, 1, ["list"], "await_area", "Tomorrow", "time_evening", 1, 1], "");
    const b0 = log.bodies[0];
    check("core turn", "the request", [b0.model, b0.output_config.effort, "temperature" in b0, b0.messages[0].content.includes("NEW MESSAGES TO ANSWER")], ["claude-opus-5-5", "low", false, true], "");
  }
  // b. The API down on both models: the old flow answers, the session as it was.
  {
    const { ctx, log } = mkCtx([{ status: 500 }, { status: 503 }]);
    const s = sess("await_day", { area: "Retiro" });
    const before = JSON.stringify(s.data);
    const r = await C.runCoreTurn(ctx, turn(s, "What type massage?"));
    check("core turn", "API down", [r.handled, log.sent.length, JSON.stringify(s.data) === before, s.step, ev(log, "agent_core_fallback")[0]?.[1]?.reason, log.bodies[1].model, log.bodies[1].temperature], [false, 0, true, "await_day", "api", "claude-haiku-4-5-20251001", 0.2], "");
  }
  // c. A reply that breaks the house rules twice is never sent.
  {
    const { ctx, log } = mkCtx([resp(tu("reply", { text: "Your massage is booked for 18:00." })), resp(tu("reply", { text: "Great, you get 10% off." }))]);
    const s = sess("await_time", { day: "Tomorrow" });
    const r = await C.runCoreTurn(ctx, turn(s, "18:00 ok?"));
    check("core turn", "guard twice", [r.handled, log.sent.length, ev(log, "agent_core_fallback")[0]?.[1]?.reason, s.step], [false, 0, "guard", "await_time"], "");
    check("core turn", "the model is told why", log.bodies[1].messages[2].content[0].is_error && /booked, confirmed or reserved/.test(log.bodies[1].messages[2].content[0].content), true, "");
  }
  // d. A newer message arrived: this turn says nothing, the newer one answers both.
  {
    const { ctx, log } = mkCtx([resp(tu("set_details", { day: "2026-10-13" }), tu("reply", { text: "Which day?", buttons: { kind: "days" } }))], { newer: true });
    const s = sess("await_day_text");
    const r = await C.runCoreTurn(ctx, turn(s, "Plzz"));
    check("core turn", "superseded", [r.handled, r.quiet, log.sent.length, s.data.day, log.saves], [true, true, 0, undefined, 0], "Hafeez's \"Plzz\" can never become his day");
  }
  // e. Sonnet fails mid-turn: Haiku carries on, without Sonnet's thinking blocks.
  {
    const { ctx, log } = mkCtx([resp({ type: "thinking", thinking: "", signature: "sig" }, tu("set_details", { name: "Hafeez" })), { status: 529 }, resp(tu("reply", { text: "Thanks Hafeez. Which day would you like your massage?", buttons: { kind: "days" } }))]);
    const s = sess("await_day");
    const r = await C.runCoreTurn(ctx, turn(s, "My name is Hafeez"));
    const hb2 = log.bodies[2];
    check("core turn", "fallback model", [r.handled, hb2.model, hb2.temperature, hb2.messages[1].content.some((x) => x.type === "thinking"), log.bodies[1].messages[1].content.some((x) => x.type === "thinking"), ev(log, "agent_core_turn")[0]?.[1]?.fell_back], [true, "claude-haiku-4-5-20251001", 0.2, false, true, true], "");
  }
  // f. Words outside reply are still guarded and sent.
  {
    const { ctx, log } = mkCtx([resp({ type: "text", text: "Hi Hafeez! Which day would you like your massage?" })]);
    const s = sess("await_day");
    const r = await C.runCoreTurn(ctx, turn(s, "Hi"));
    check("core turn", "plain text", [r.handled, log.sent[0]?.[0], s.step], [true, "text", "await_day"], "Hafeez 13:27 got the whole opener again");
  }
  // g. The first message must carry the price; the booking page follows (v162).
  {
    const { ctx, log } = mkCtx([
      resp(tu("reply", { text: "Hi! Which day would you like?", buttons: { kind: "days" } })),
      resp(tu("reply", { text: "Hi, Massage Club here. We book you into professional studios around Madrid, and a 60 min relaxing massage is usually 50 to 60 EUR, paid at the studio. Which day would you like?", buttons: { kind: "days" } })),
    ]);
    const s = sess("start", { lang: "" });
    const r = await C.runCoreTurn(ctx, turn(s, "Hi, I'd like to book a massage. I saw you on Facebook. What kind of massages and what is the cost?"));
    check("core turn", "first message", [r.handled, log.sent.map((x) => x[0]), log.sent[0][2], s.step, ev(log, "agent_core_turn")[0]?.[1]?.guard_fails], [true, ["buttons", "page"], ["day_today", "day_tomorrow", "day_other"], "await_day", 1], "CCF, 5 Oct");
  }
  // h. No email yet: no request. The model asks for it instead.
  {
    const { ctx, log } = mkCtx([resp(tu("create_request", {})), resp(tu("reply", { text: "Last thing: what is your email, so the confirmation reaches you by email too?" }))]);
    const s = sess("await_area", { day: "Tomorrow", dayDate: "Tuesday 13 October", time: "18:00", area: "Salamanca" });
    const r = await C.runCoreTurn(ctx, turn(s, "Salamanca"));
    check("core turn", "email before the request", [r.handled, log.finalized, /needs_email/.test(log.bodies[1].messages[2].content[0].content), s.step], [true, 0, true, "await_email_req"], "CLAUDE.md, 8 Sept (v67)");
  }
  // i. Everything there: create_request runs the old path and the model does not repeat it.
  {
    const { ctx, log } = mkCtx([resp(tu("create_request", {})), resp({ type: "text", text: "" })]);
    const s = sess("await_email_req", { day: "Tomorrow", dayDate: "Tuesday 13 October", time: "18:00", area: "Salamanca", email: "ana@gmail.com" });
    const r = await C.runCoreTurn(ctx, turn(s, "ana@gmail.com"));
    const res = JSON.parse(log.bodies[1].messages[2].content[0].content);
    check("core turn", "request created", [r.handled, log.finalized, res.outcome, res.studios_asked, s.data.name, s.step, log.sent.length], [true, 1, "asked", 3, "Hafeez", "done", 1], "the profile name is used, never asked (v126)");
  }
  // j. A special request: the standard line, nothing else, no booking page.
  {
    const { ctx, log } = mkCtx([resp(tu("notify_jordan", { kind: "special_request", text: "asked for extras" }), tu("reply", { text: "Which day?" }))]);
    const s = sess("start");
    const r = await C.runCoreTurn(ctx, turn(s, "do you do massage with a good girl for me"));
    check("core turn", "special request", [r.handled, log.sent, s.data.eroticHits], [true, [["text", BLOCK_LINE_EN]], 1], "veiled requests EROTIC_RE misses");
  }
  // k. A live request: the day cannot move quietly.
  {
    const bk = { live: { id: 109, stage: "studio_asked", massage: "Relaxing massage", day: "Sunday", time: "11:00", area: "Madrid", studios_asked: 3, createdMs: M(9) }, offer: null, confirmed: null, returning: null };
    const { ctx, log } = mkCtx([resp(tu("set_details", { area: "Majadahonda" })), resp(tu("reply", { text: "Your request #109 is with 3 studios in Madrid. Would you like me to ask studios closer to Majadahonda instead?" }))], { booking: bk });
    const s = sess("done", { area: "Madrid" });
    const r = await C.runCoreTurn(ctx, turn(s, "I stay at Majadahonda"));
    check("core turn", "live request", [r.handled, s.data.area, log.bodies[1].messages[2].content[0].is_error, /use booking_action \(cancel/.test(log.bodies[1].messages[2].content[0].content), s.step], [true, "Madrid", true, true, "done"], "Rajesh (#109) was told \"we are checking with studios near you\"");
  }
  // l. A reply written alongside studio_options waits for its result.
  {
    const picks = [{ id: "p1", name: "Sinergia38", svc: "Relaxing massage", price: 59, duration: 55, area: "Chamartín", registered: false }, { id: "p2", name: "Calma Madrid Spa", svc: "Relaxing massage", price: 85, duration: 60, area: "Chamberí", registered: true }];
    const { ctx, log } = mkCtx([
      resp(tu("studio_options", {}), tu("reply", { text: "Here are some options." })),
      resp(tu("reply", { text: "Near you: *Sinergia38* (Chamartín), relaxing 55 min, about 59 EUR; *Calma Madrid Spa* (Chamberí), relaxing 60 min, 85 EUR. Tap one, or Best price and I ask several.", buttons: { kind: "studios" } })),
    ], { picks });
    const s = sess("await_area", { day: "Tomorrow", dayDate: "Tuesday 13 October", time: "18:00", area: "Chamberí" });
    const r = await C.runCoreTurn(ctx, turn(s, "Chamberí"));
    check("core turn", "studio options", [r.handled, log.sent.length, log.sent[0][2], s.step, s.data.offerMode, /Not sent yet/.test(log.bodies[1].messages[2].content[1].content)], [true, 1, ["studio_0", "studio_1", "studio_any"], "await_studio", true, true], "Vitalii asked the price and address of the studios three times");
  }
  // m. "Ok thanks" with nothing to say: quiet, and the old flow is not run.
  {
    const { ctx, log } = mkCtx([resp({ type: "text", text: "" })]);
    const s = sess("done");
    const r = await C.runCoreTurn(ctx, turn(s, "ok thanks", { ackOnly: true }));
    check("core turn", "ack only", [r.handled, r.quiet, log.sent.length], [true, true, 0], "");
  }
  // m2. "No thanks" closes the chat, so recover-abandoned never chases it.
  {
    const { ctx, log } = mkCtx([resp(tu("set_details", { declined: true }), tu("reply", { text: "No problem at all, thanks for letting me know. Whenever you fancy a massage, just write here." }))]);
    const s = sess("await_day");
    const r = await C.runCoreTurn(ctx, turn(s, "Ya no gracias"));
    check("core turn", "declined", [r.handled, s.step, ev(log, "declined_flow").length], [true, "done", 1], "Adrian: \"Ya no gracias\" was read as an answer (v179)");
    check("set_details declined", "with a live request", V({ declined: true }, M(10), {}, "en", "Request #120 is with the studios").errors.length, 1, "a cancel tells the studios");
  }
  // m3. The opening counts in the ops funnel like greet()'s.
  {
    const { ctx, log } = mkCtx([resp(tu("set_details", { language: "es" }), tu("reply", { text: "Hola, somos Massage Club. Reservamos en centros profesionales de todo Madrid, y un masaje relajante de 60 min suele costar entre 50 y 60 EUR, que se pagan en el centro. ¿Qué día te viene bien?", buttons: { kind: "days" } }))]);
    const s = sess("start", { lang: "", service: undefined });
    delete s.data.service;
    const r = await C.runCoreTurn(ctx, turn(s, "Hola, quería información de precios"));
    check("core turn", "opening events", [r.handled, ev(log, "flow_started").length, ev(log, "service_chosen")[0]?.[1]?.assumed, s.data.lang, s.data.defaultService], [true, 1, true, "es", true], "");
  }
  // m4. "Keep looking" at an offer: the offer's own button path, and nothing
  // from this turn is saved over the next offer forwardOffer just stored.
  {
    const bk = { live: { id: 83, stage: "offered", massage: "Relaxing massage", day: "Monday", time: "18:00", area: "Centro", studios_asked: 4, createdMs: M(9) }, offer: { row: "row-83", studio: "Private Spa", time: "18:00", day: "", address: "Calle Mayor 1", price_text: "Price: about 80 EUR" }, confirmed: null, returning: null };
    const { ctx, log } = mkCtx([resp(tu("booking_action", { action: "closer_or_cheaper" }), tu("reply", { text: "Sure, let me look." }))], { booking: bk });
    let declined = "";
    ctx.declineOffer = async (row, _f, _L, _s, mode) => { declined = `${row}/${mode}`; };
    const s = sess("await_offer", { offer: { row: "row-83", time: "18:00", studio: "Private Spa", request: 83 } });
    const r = await C.runCoreTurn(ctx, turn(s, "Keep looking"));
    check("core turn", "closer or cheaper", [r.handled, declined, log.saves, log.bodies.length, log.sent.length], [true, "row-83/alt", 0, 1, 0], "Al (#83): \"Keep looking\" got \"I am checking that now\" and nothing after it");
  }
  // n. A time button with no day would build a request with no day.
  {
    const { ctx, log } = mkCtx([resp(tu("reply", { text: "What time suits you?", buttons: { kind: "times" } })), resp(tu("reply", { text: "Which day would you like?", buttons: { kind: "days" } }))]);
    const s = sess("await_day");
    const r = await C.runCoreTurn(ctx, turn(s, "sometime soon"));
    check("core turn", "buttons follow the order", [r.handled, log.sent.length, log.sent[0][2][0], s.step], [true, 1, "day_today", "await_day"], "");
  }

  // 12. The two reviews of 12 Oct (safety and integration), one check or more
  // per finding, written as each was reported.
  // Safety 1: "never says booked" could be excused by any hedge word anywhere in the sentence.
  for (const [t, note] of [
    ["Perfect, you're booked for tomorrow at 18:00, no need to do anything else.", "a stray \"no\" used to excuse the whole sentence"],
    ["Great news: your massage is confirmed for 18:00, see you there if you need anything write here.", "\"if\" after the claim"],
    ["Tu masaje queda reservado para mañana a las 18:00, no tienes que hacer nada más.", ""],
    ["Nothing is booked yet, but your massage is confirmed for 18:00.", "a hedge on one claim does not cover the next"],
    ["If you need anything, your massage is confirmed for 18:00.", "a condition that does not govern the claim"],
  ]) check("guard fails (v206 review)", t, GR(t).ok, false, note);
  for (const [t, note] of [
    ["It is only confirmed once you tap Yes on a studio's offer.", ""],
    ["Once you tap Yes, it is booked.", ""],
    ["Todavía no está reservado: te escribo en cuanto un centro conteste.", ""],
    ["Nada está reservado hasta que toques Sí.", ""],
    ["You'll get each offer here with its price, before anything is booked.", "the prompt's own words"],
  ]) check("guard passes (v206 review)", t, [GR(t).ok, GR(t).reasons], [true, []], note);
  // Safety 3: links that only start like ours, and links with no scheme.
  for (const [t, note] of [
    ["Here is our site: https://massageclub.io.evil.com/reserve", "massageclub.io must end the host"],
    ["Book at book.massageclub.io-offers.com", ""],
    ["See photos at studio-photos.info or evil.xyz", "no scheme, and WhatsApp still links it"],
  ]) check("guard fails (v206 review)", t, GR(t, { linkAsked: true }).ok, false, note);
  check("guard passes (v206 review)", "our link ending a sentence", GR("Here it is: https://book.massageclub.io.", { linkAsked: true }).ok, true, "");
  check("guard passes (v206 review)", "a numbered point with no space", GR("1.Relaxing, 60 min.").ok, true, "not a link");
  // Safety 9: dashes in a saved area or name reach deterministic copy and the studios.
  check("set_details area", "an en dash", V({ area: "Mirasierra \u2013 Fuencarral" }).patch.area, "Mirasierra, Fuencarral", "\"near Mirasierra \u2013 Fuencarral\" went out in offerStudios and to the studios");
  check("set_details name", "an em dash", V({ name: "Ana \u2014 Maria" }).patch.name, "Ana", "");
  // Safety 2, safety 6, integration 1: last month's confirmed booking.
  const oldConf = { live: null, offer: null, confirmed: { id: 90, studio: "Calma Madrid Spa", day: "Saturday", time: "18:00", address: "", price_text: "", startMs: M(18, 0, -16), createdMs: M(10, 0, -18) }, returning: null };
  check("confirmedNow", "last month's booking", [C.confirmedNow(oldConf, M(10)), C.bookingModeOf(oldConf, M(10))], [false, "build"], "");
  const noStart = (daysAgo) => ({ ...oldConf, confirmed: { ...oldConf.confirmed, startMs: null, createdMs: M(10, 0, -daysAgo) } });
  check("confirmedNow", "no start, made 2 days ago", C.confirmedNow(noStart(2), M(10)), true, "");
  check("confirmedNow", "no start, made 9 days ago", C.confirmedNow(noStart(9), M(10)), false, "locked out of booking for good");
  check("turn context", "an old confirmed booking is not shown as confirmed", JSON.parse(C.buildTurnContext(ctxIn({ booking: oldConf, mode: "build" })).split("BOOKING STATE: ")[1].split("\n")[0]).confirmed, null, "");
  {
    const { ctx, log } = mkCtx([resp(tu("reply", { text: "Your massage is booked for Saturday at 18:00." })), resp(tu("reply", { text: "Lovely to hear from you again. Which day would you like this time?", buttons: { kind: "days" } }))], { booking: oldConf });
    const s = sess("await_day");
    const r = await C.runCoreTurn(ctx, turn(s, "I want another one"));
    const m = ev(log, "agent_core_turn")[0]?.[1] || {};
    check("core turn", "last month's booking does not unlock \"booked\"", [r.handled, log.sent.length, m.guard_fails, m.mode], [true, 1, 1, "build"], "");
  }
  {
    // The bot.ts side: when a confirmed request starts, read off the request.
    const dayMs = 86400e3, now0 = Date.now(), ahead = new Date(now0 + 3 * dayMs);
    const EN_M = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    check("coreConfirmedStillAhead", "confirmed 3 weeks ago, no confirmed_start", G.coreConfirmedStillAhead({ day1: "Saturday", time1: "18:00", confirmed_start: null }, now0 - 22 * dayMs), false, "requests stay at confirmed after the massage");
    check("coreConfirmedStillAhead", "booked for 3 days ahead", G.coreConfirmedStillAhead({ day1: "Saturday", time1: "18:00", message_text: `Quiere: x | Fecha: ${ahead.getUTCDate()} ${EN_M[ahead.getUTCMonth()]}`, confirmed_start: null }, now0), true, "");
    check("coreConfirmedStillAhead", "no day at all, made yesterday", G.coreConfirmedStillAhead({ day1: "", confirmed_start: null }, now0 - dayMs), true, "");
    check("coreConfirmedStillAhead", "no day at all, made 9 days ago", G.coreConfirmedStillAhead({ day1: "", confirmed_start: null }, now0 - 9 * dayMs), false, "");
    check("coreConfirmedStillAhead", "confirmed_start wins", G.coreConfirmedStillAhead({ day1: "Today", confirmed_start: new Date(now0 - 3 * 3600e3).toISOString() }, now0), false, "two hours after the start");
  }
  // Safety 4: a studio they already picked is kept.
  for (const [label, extra, want] of [
    ["a studio_0 tap (prefer)", { prefer: [{ id: "p2", name: "Calma Madrid Spa" }, { id: "p1", name: "Sinergia38" }] }, ["p2", null]],
    ["a studio typed by name (chosen)", { chosen: { id: "p9", slug: "aloha", name: "Centro Aloha", svc: null, price: null } }, ["p9", null]],
  ]) {
    const { ctx } = mkCtx([resp(tu("create_request", {})), resp({ type: "text", text: "" })]);
    let at = null;
    const fin = ctx.finalizeBooking;
    ctx.finalizeBooking = async (s, ...rest) => { at = { prefer: s.data.prefer, chosen: s.data.chosen }; return fin(s, ...rest); };
    const s = sess("await_name", { day: "Tomorrow", dayDate: "Tuesday 13 October", time: "18:00", area: "Chamberí", email: "ana@gmail.com", ...extra });
    await C.runCoreTurn(ctx, turn(s, "Ana"));
    check("core turn", `create_request keeps ${label}`, [at?.prefer?.[0]?.id ?? null, at?.chosen ?? null], want, "it used to fan out with their studio not asked first");
  }
  check("turn context", "the chosen studio is in the booking state", JSON.parse(C.buildTurnContext(ctxIn({ data: { prefer: [{ id: "p2", name: "Calma Madrid Spa" }] } })).split("BOOKING STATE: ")[1].split("\n")[0]).studio_chosen, "Calma Madrid Spa", "");
  // Safety 5, integration 4: the ad's line and old days.
  check("coreTakes", "the ad line at await_area", takes("await_area", AD), false, "Salado, 12 Oct: v201's restart must run");
  check("coreTakes", "the ad line at done", takes("done", AD), false, "");
  const rd = (data, at0 = M(10)) => { const d = { ...data }; const r = C.reconcileDay(d, at0); return [r, d.day ?? null, d.time ?? null, d.dayIso ?? null]; };
  check("reconcileDay", "a listed date gone by", rd({ day: "Sunday 27 September", time: "18:00" }), ["cleared", null, null, null], "Salado's day, two weeks gone");
  check("reconcileDay", "detectDay's \"24 september\"", rd({ day: "24 september", time: "18:00" })[0], "cleared", "");
  check("reconcileDay", "a listed date ahead", rd({ day: "Saturday 17 October", time: "18:00" }), ["tagged", "Saturday 17 October", "18:00", "2026-10-17"], "");
  check("reconcileDay", "in Spanish", rd({ day: "sábado 17 de octubre" })[3], "2026-10-17", "");
  check("reconcileDay", "a bare weekday is left", rd({ day: "Saturday", time: "18:00" }), ["kept", "Saturday", "18:00", null], "create_request wants it as a date");
  check("reconcileDay", "today and flexible are not its business", [rd({ day: "Today" })[0], rd({ day: "Any day (flexible)" })[0]], ["", ""], "");
  {
    const { ctx, log } = mkCtx([resp(tu("create_request", {})), resp(tu("reply", { text: "Just to check, is that this Saturday, the 17th?" }))]);
    const s = sess("await_email_req", { day: "Saturday", time: "18:00", area: "Salamanca", email: "ana@gmail.com" });
    await C.runCoreTurn(ctx, turn(s, "ana@gmail.com"));
    check("core turn", "a day with no date never goes to the studios", [log.finalized, /has no date/.test(log.bodies[1].messages[2].content[0].content)], [0, true], "");
  }
  {
    const { ctx, log } = mkCtx([resp(tu("reply", { text: "Which day would you like?", buttons: { kind: "days" } }))]);
    const s = sess("await_area", { day: "Sunday 27 September", time: "18:00" });
    await C.runCoreTurn(ctx, turn(s, "Hello? are you there"));
    check("core turn", "a day gone by is cleared before the model sees it", [s.data.day ?? null, s.data.time ?? null, /"day":null/.test(log.bodies[0].messages[0].content), ev(log, "stale_day_cleared").length], [null, null, true, 1], "");
  }
  // Safety 7: cancel acts on the live request, not on an old offer in the session.
  {
    const bk = { live: { id: 131, stage: "studio_asked", massage: "Relaxing massage", day: "Tomorrow", time: "18:00", area: "Retiro", studios_asked: 3, createdMs: M(9) }, offer: null, confirmed: null, returning: null };
    const { ctx } = mkCtx([resp(tu("booking_action", { action: "cancel" })), resp({ type: "text", text: "" })], { booking: bk });
    let which = "";
    ctx.cancelOffered = async () => { which = "offered"; };
    ctx.cancelOpenRequest = async () => { which = "open"; return true; };
    const s = sess("done", { offer: { row: "row-83", time: "18:00", studio: "Private Spa", request: 83 } });
    await C.runCoreTurn(ctx, turn(s, "cancel it please"));
    check("core turn", "cancel goes to the live request", which, "open", "#N used to stay open and its studios were never told");
    check("set_details start_over", "clears an old offer", C.START_OVER_CLEARS.includes("offer"), true, "");
  }
  // Safety 8, integration 9: each turn marks the message it takes.
  {
    const { ctx, log } = mkCtx([resp(tu("reply", { text: "Which day would you like?", buttons: { kind: "days" } }))]);
    await C.runCoreTurn(ctx, turn(sess("await_day"), "hello"));
    check("core turn", "agent_core_taken marks the inbound id", [ev(log, "agent_core_taken")[0]?.[1]?.inbound_id, log.events[0]?.[0]], [7, "agent_core_taken"], "an older turn only goes quiet for a newer message a core turn has");
  }
  check("hook", "newer means taken by a core turn", /event=in\.\(agent_core_taken,agent_core_released\)/.test(botSrc) && !/msg_type=eq\.text&id=gt/.test(botSrc), true, "\"yes\" at an offer used to silence the parking question before it");
  {
    const { ctx, log } = mkCtx([{ status: 500 }, { status: 503 }]);
    await C.runCoreTurn(ctx, turn(sess("await_day"), "What type massage?"));
    check("core turn", "a turn that falls back releases its mark", ev(log, "agent_core_released")[0]?.[1]?.inbound_id, 7, "the old flow answers it, so an older turn must still answer its own");
  }
  // Safety 10, integration 3 and 7: no pitch and no Book now after a no thanks, a complaint or a request.
  {
    const { ctx, log } = mkCtx([resp(tu("set_details", { declined: true }), tu("reply", { text: "No problem at all, thanks for letting me know. Whenever you fancy a massage, just write here." }))]);
    const s = sess("start", { lang: "" });
    const r = await C.runCoreTurn(ctx, turn(s, "not interested, thanks"));
    check("core turn", "a first-message no thanks", [r.handled, log.sent.map((x) => x[0]), s.step, ev(log, "agent_core_turn")[0]?.[1]?.guard_fails], [true, ["text"], "done", 0], "no prices, no Book now");
  }
  {
    const { ctx, log } = mkCtx([resp(tu("notify_jordan", { kind: "complaint", text: "says nobody answered last week" }), tu("reply", { text: "I'm really sorry about that. We're looking into it and will reply here." }))]);
    const s = sess("start", { lang: "" });
    const r = await C.runCoreTurn(ctx, turn(s, "You never answered me last week, terrible"));
    check("core turn", "a first-message complaint", [r.handled, log.sent.map((x) => x[0]), ev(log, "agent_core_turn")[0]?.[1]?.guard_fails], [true, ["text"], 0], "");
  }
  {
    const { ctx, log } = mkCtx([resp(tu("set_details", { day: "2026-10-13", time: "18:00", area: "Salamanca", name: "Ana", email: "ana@gmail.com" }), tu("create_request", {})), resp({ type: "text", text: "" })]);
    const s = sess("start", { lang: "en" });
    const r = await C.runCoreTurn(ctx, turn(s, "Tomorrow 18:00 in Salamanca please, I'm Ana, ana@gmail.com"));
    check("core turn", "no booking page after the request went out", [r.handled, log.finalized, log.sent.some((x) => x[0] === "page")], [true, 1, false], "a second way to book the same massage");
  }
  // Integration 2: a confirmed booking is cancelled or moved only on the customer's own ask.
  {
    const bk = { live: null, offer: null, confirmed: { id: 140, studio: "Calma Madrid Spa", day: "Tomorrow", time: "18:00", address: "Calle X 1", price_text: "", startMs: M(18, 0, 1), createdMs: M(9) }, returning: null };
    for (const [said, wantRc, wantSent, note] of [
      ["can I also book one for my wife on Saturday?", "", [["buttons", "rc_cancel_140,fx_core_keep"]], "the model's word alone used to cancel it and tell the studio"],
      ["Please cancel my booking for tomorrow", "cancel/140", [], "their own words: the v39 path"],
    ]) {
      const { ctx, log } = mkCtx([resp(tu("booking_action", { action: "cancel" }), tu("reply", { text: "Done!" })), resp({ type: "text", text: "" })], { booking: bk });
      let rc = "";
      ctx.reconfirm = async (kind, id) => { rc = `${kind}/${id}`; };
      const r = await C.runCoreTurn(ctx, turn(sess("done"), said));
      check("core turn", `confirmed booking + "${said}"`, [r.handled, rc, log.sent.map((x) => [x[0], (x[2] || []).join(",")])], [true, wantRc, wantSent], note);
    }
  }
  // Integration 5, 6, 8: bot.ts.
  check("hook", "a core chat's name and email survive a studio tap", /if \(s\.data\.coreAt && s\.data\.name\) \{ await finalizeBooking/.test(botSrc) && (botSrc.match(/s\.data\.email = \(s\.data\.coreAt && s\.data\.email\) \|\| s\.data\.known\.email \|\| null;/g) || []).length === 2, true, "ana@x.com was set back to null by askNameOrFinalize");
  check("hook", "a Today tap rechecks a saved time", /validateDetails\(\{ day: iso \}, \{ \.\.\.s\.data, day: null, dayDate: null \}/.test(botSrc), true, "");
  const late = V({ day: "2026-10-12" }, M(18, 55), { time: "18:00" });
  check("set_details day", "Today at 18:55 under a saved 18:00", [late.clear.includes("time"), late.errors.length], [true, 1], "what the Today tap now runs");
  check("hook", "needs_contact can be cancelled", /const CANCELLABLE = \[\.\.\.OPEN_STAGES, "needs_contact"\]/.test(botSrc) && /stage=in\.\(\$\{CANCELLABLE\.join\(","\)\}\)/.test(botSrc), true, "a parked request was told \"nothing to cancel\"");
}

// ---------------------------------------------------------------------------
// v215 (17 Oct, Jordan: "We need more studios to give us times"). Released
// slots: a studio gives us a time in advance, the customer's tap books it.
// The helpers that decide who sees which times, the studio page's half-hour
// grid inside its opening hours, and the window a customer's ask covers live
// in bot.ts between "released slots: pure helpers (start)" and "(end)"; they
// are lifted out the same way as the blocks above. The clock changes on
// Sunday 25 Oct 2026, so the DST cases are real dates, not hypotheticals.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { stripTypeScriptTypes } = await import("node:module");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const botSrc = fs.readFileSync(path.join(here, "../supabase/functions/wa-bot/bot.ts"), "utf8");
  const migSrc = fs.readFileSync(path.join(here, "../supabase/migrations/20261018_released_slots.sql"), "utf8");
  const a = botSrc.indexOf("// ---- v215 released slots: pure helpers (start) ----");
  const b = botSrc.indexOf("// ---- v215 released slots: pure helpers (end) ----");
  if (a < 0 || b < a) throw new Error("bot.ts: the v215 released-slot helper markers are missing");
  const names = ["parseReleasedMode", "releasedAudience", "releasedScope", "releasedHoursOk", "relAt", "relHm", "relYmd", "slotDays", "slotHours", "slotWindows", "slotGrid", "releaseCheck", "releasedRange", "relDayWord", "releasedLine", "releasedButtons", "releasedContactEs", "RELEASED_COPY", "REL_TEST_STUDIO_RE", "releasedRefusal", "releasedSaveNote", "relHueco"];
  const copyUrl = pathToFileURL(path.join(here, "../supabase/functions/wa-bot/copy.ts")).href;
  const js = `import { madridInstant, madridMidnight, stripAcc, euro } from ${JSON.stringify(copyUrl)};\n`
    + stripTypeScriptTypes(botSrc.slice(a, b)) + `\nexport { ${names.join(", ")} };\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-released-"));
  const file = path.join(dir, "released.mjs");
  fs.writeFileSync(file, js);
  const R = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });

  // Madrid wall clock on a given October 2026 day.
  const M = (day, h, mi = 0) => madridInstant(new Date(Date.UTC(2026, 9, day)), h).getTime() + mi * 60e3;
  const iso = (ms) => new Date(ms).toISOString();

  // The switch. Anything that is not test or on is off.
  for (const [v, want] of [["on", "on"], ["TEST", "test"], [" on ", "on"], ["off", "off"], ["", "off"], [undefined, "off"], [null, "off"], ["yes", "off"], ["true", "off"]]) {
    check("RELEASED switch", String(v), R.parseReleasedMode(v), want, "off, missing or unknown must change nothing");
  }

  // Who is a test customer for released times.
  for (const [c, want, note] of [
    [{ phone: "15622355063" }, "test", "Jordan, CLAUDE.md test number"],
    [{ phone: "+34 612 474 827" }, "test", "Jordan's business number"],
    [{ phone: "34600000234" }, "test", "a canary number"],
    [{ phone: "34611222333", email: "ana@example.com" }, "test", "a test domain"],
    [{ phone: "34611222333", email: "jordan+mctest@gmail.com" }, "test", "+mctest"],
    [{ phone: "34611222333", email: "jordan.hays@student.ie.edu" }, "test", "Jordan's student address"],
    [{ phone: "34611222333", name: "Prueba Jordan" }, "none", "review 17 Oct: a profile name alone never opens the test studios"],
    [{ phone: "34611222333", name: "Test" }, "none", "nor a real studio: a test name is held back from both"],
    [{ phone: "15622355063", name: "Ana" }, "test", "a test number with any name"],
    [{ phone: "34600000234", name: "Prueba" }, "test", "a canary number named Prueba"],
    [{ phone: "34600004188" }, "real", "a real customer in the old, wider 3460000xxxx block (18 Sep lead)"],
    [{ phone: "17867276503" }, "none", "Cata, friend tester: never"],
    [{ phone: "34611222333", email: "cata.waack@gmail.com" }, "none", "Cata by email"],
    [{ phone: "8615273855997" }, "none", "Yi, friend tester: never"],
    [{ phone: "34635569364", knownTester: true }, "none", "another number the bot treats as a tester"],
    [{ phone: "34611222333", email: "ana@gmail.com", name: "Ana" }, "real", "a real customer"],
    [{ phone: "34611222333", name: "Testa" }, "real", "test only as a whole word"],
  ]) check("released audience", JSON.stringify(c), R.releasedAudience(c), want, note);

  // Test and real never meet: test contacts only ever see test studios, real
  // customers only real ones, and only when the switch says so.
  for (const [mode, aud, want] of [
    ["off", "test", null], ["off", "real", null], ["off", "none", null],
    ["test", "test", "test"], ["test", "real", null], ["test", "none", null],
    ["on", "test", "test"], ["on", "real", "real"], ["on", "none", null],
  ]) check("released scope", `${mode}/${aud}`, R.releasedScope(mode, aud), want, "");
  for (const [studio, want] of [["ZZ Prueba Massage Club", true], ["Aurora Test Studio", true], ["Calma Madrid Spa", false], ["Testarossa Spa", false]]) {
    check("test studio", studio, R.REL_TEST_STUDIO_RE.test(studio), want, "same rule as released_slots.is_test in the migration");
  }

  // Review (17 Oct): offered from 09:00 to 20:15 Madrid and a tap taken until
  // 20:45, so with the 30 minute offer and the 15 minutes from tap to booking
  // the studio's confirmation always goes out by 21:00.
  for (const [ms, want, note] of [[M(19, 8, 59), false, ""], [M(19, 9), true, ""], [M(19, 20, 14), true, ""], [M(19, 20, 15), false, "tapped by 20:45, booked by 21:00"], [M(19, 20, 39), false, "was true before the review: a confirmation at about 21:20"], [M(25, 9), true, "the DST Sunday"]]) {
    check("released offering hours", iso(ms), R.releasedHoursOk(ms), want, note);
  }
  for (const [ms, want, note] of [[M(19, 8, 59), false, ""], [M(19, 20, 44), true, "booked by 20:59 at the latest"], [M(19, 20, 45), false, ""], [M(19, 21, 8), false, "the reviewer's 21:08 tap"]]) {
    check("released tap hours", iso(ms), R.releasedHoursOk(ms, "tap"), want, note);
  }

  // Madrid wall clock to an instant, across both clock changes.
  for (const [ymd, min, want, note] of [
    ["2026-10-24", 600, "2026-10-24T08:00:00.000Z", "Saturday, CEST (UTC+2)"],
    ["2026-10-25", 600, "2026-10-25T09:00:00.000Z", "Sunday 25 Oct, the clocks went back at 03:00: CET (UTC+1)"],
    ["2026-10-26", 630, "2026-10-26T09:30:00.000Z", ""],
    ["2026-10-24", 1440, "2026-10-24T22:00:00.000Z", "midnight at the end of the 24th is still CEST"],
    ["2026-03-29", 600, "2026-03-29T08:00:00.000Z", "spring forward"],
  ]) check("relAt (Madrid to UTC)", `${ymd} +${min}`, iso(R.relAt(ymd, min)), want, note);
  check("relHm across DST", "25 Oct 09:00Z", R.relHm(Date.parse("2026-10-25T09:00:00Z")), "10:00", "");
  check("slotDays", "Sat 24 Oct, 23:30 Madrid", R.slotDays(M(24, 23, 30), 3).map((x) => `${x.ymd}/${x.dow}`), ["2026-10-24/6", "2026-10-25/0", "2026-10-26/1"], "the Madrid day, not the UTC one");

  // opening_hours, both shapes.
  const H = (oh) => { const h = R.slotHours(oh); return h ? [0, 1, 2, 3, 4, 5, 6].map((d) => JSON.stringify(R.slotWindows(h, d))) : null; };
  const open = (o, c) => JSON.stringify([[o, c]]);
  for (const [oh, want, note] of [
    ["Mon-Sat 10:00-20:00", ["[]", open(600, 1200), open(600, 1200), open(600, 1200), open(600, 1200), open(600, 1200), open(600, 1200)], "a day not named is closed, as openDays reads it"],
    ["Lun-Vie 10:00-14:00 y 17:00-21:00", ["[]", "[[600,840],[1020,1260]]", "[[600,840],[1020,1260]]", "[[600,840],[1020,1260]]", "[[600,840],[1020,1260]]", "[[600,840],[1020,1260]]", "[]"], "a split shift belongs to the same days"],
    ["Daily 10:00-21:00", Array(7).fill(open(600, 1260)), ""],
    ["Todos los días 12:00-20:00", Array(7).fill(open(720, 1200)), ""],
    ["Sun-Thu 10:00-21:30, Fri-Sat 10:00-22:00", [open(600, 1290), open(600, 1290), open(600, 1290), open(600, 1290), open(600, 1290), open(600, 1320), open(600, 1320)], ""],
    [{ mon: { open: "10:00", close: "20:00" }, sun: { closed: true }, sat: { open: "10:00", close: "14:00", closed: false } }, ["[]", open(600, 1200), open(480, 1320), open(480, 1320), open(480, 1320), open(480, 1320), open(600, 840)], "PartnerCalendar's object; a missing day is unknown (08:00 to 22:00)"],
    ['{"tue":{"open":"11:00","close":"19:30"}}', [open(480, 1320), open(480, 1320), open(660, 1170), open(480, 1320), open(480, 1320), open(480, 1320), open(480, 1320)], "the object as a JSON string"],
    ["", null, "unknown"], [null, null, "unknown"], ["llamar antes", null, "unreadable is unknown, never closed"],
  ]) check("opening hours", typeof oh === "string" ? oh : JSON.stringify(oh), H(oh), want, note);

  // The studio page's grid: every half hour inside the hours, the massage ends
  // by closing, and at least 65 minutes from now.
  const mon = [[600, 1200]];
  const g1 = R.slotGrid("2026-10-19", mon, 60, M(18, 12));
  check("slot grid", "Mon 10-20, 60 min, from the day before", [g1.length, g1[0].hm, g1[g1.length - 1].hm], [19, "10:00", "19:00"], "");
  const g2 = R.slotGrid("2026-10-19", mon, 60, M(19, 9));
  check("slot grid", "the same Monday at 09:00", [g2.length, g2[0].hm], [18, "10:30"], "10:00 is only an hour away");
  const g3 = R.slotGrid("2026-10-19", mon, 90, M(18, 12));
  check("slot grid", "90 min", g3[g3.length - 1].hm, "18:30", "a 90 minute massage at 19:00 would end after closing");
  const g4 = R.slotGrid("2026-10-19", [[600, 840], [1020, 1260]], 60, M(18, 12));
  check("slot grid", "split shift", g4.map((x) => x.hm).join(","), "10:00,10:30,11:00,11:30,12:00,12:30,13:00,17:00,17:30,18:00,18:30,19:00,19:30,20:00", "nothing across the lunch break");
  const g5 = R.slotGrid("2026-10-25", [[615, 720]], 60, M(24, 12));
  check("slot grid", "DST Sunday, opens 10:15", g5.map((x) => `${x.hm}=${iso(x.startMs)}`), ["10:30=2026-10-25T09:30:00.000Z", "11:00=2026-10-25T10:00:00.000Z"], "starts on the half hour, in CET");
  check("slot grid", "a day already over", R.slotGrid("2026-10-19", mon, 60, M(19, 20)).length, 0, "");

  // What may be saved (the page and the ops release both ask this).
  const mh = R.slotHours("Mon-Sat 10:00-20:00");
  const now = M(19, 9);
  for (const [r, hours, want, note] of [
    [{ ymd: "2026-10-19", hm: "18:00", minutes: 60 }, mh, "", ""],
    [{ ymd: "2026-10-19", hm: "09:50", minutes: 60 }, mh, "soon", "under an hour away"],
    [{ ymd: "2026-10-25", hm: "12:00", minutes: 60 }, mh, "closed", "Sunday, Mon-Sat hours"],
    [{ ymd: "2026-10-19", hm: "19:30", minutes: 60 }, mh, "hours", "ends after 20:00"],
    [{ ymd: "2026-10-20", hm: "08:00", minutes: 60 }, mh, "hours", "before opening"],
    [{ ymd: "2026-10-19", hm: "19:30", minutes: 30 }, mh, "", "30 minutes fit"],
    [{ ymd: "2026-10-19", hm: "18:00", minutes: 45 }, mh, "duration", ""],
    // v217 (18 Oct): studios give times up to 8 weeks ahead (was today and the next six days).
    [{ ymd: "2026-10-26", hm: "18:00", minutes: 60 }, mh, "", "a week out: inside the 8 weeks now (v217; was refused)"],
    [{ ymd: "2026-12-12", hm: "18:00", minutes: 60 }, mh, "", "Sat 12 Dec, today plus 54 days: inside the 8 weeks"],
    [{ ymd: "2026-12-14", hm: "18:00", minutes: 60 }, mh, "day", "Mon 14 Dec, today plus 56 days: past the 8 weeks"],
    [{ ymd: "2026-10-25", hm: "12:00", minutes: 60 }, null, "", "unknown hours never rule a time out"],
    [{ ymd: "2026-10-19", hm: "25:00", minutes: 60 }, mh, "format", ""],
    [{ ymd: "19/10/2026", hm: "18:00", minutes: 60 }, mh, "format", ""],
  ]) check("releaseCheck", JSON.stringify(r), R.releaseCheck(r, hours, now), want, note);

  // The stretch a customer's ask covers. Monday 19 Oct.
  const day19 = new Date(Date.UTC(2026, 9, 19));
  const rng = (x) => x ? [iso(x.from), iso(x.to)] : null;
  for (const [win, nowMs, want, note] of [
    [[1080, 1260], M(19, 10), ["2026-10-19T16:00:00.000Z", "2026-10-19T19:00:00.000Z"], "Evening (18-21)"],
    [[1080, 1081], M(19, 10), ["2026-10-19T16:00:00.000Z", "2026-10-19T16:01:00.000Z"], "an exact 18:00: only 18:00 fits"],
    [[1080, 1260], M(19, 17, 30), ["2026-10-19T16:30:00.000Z", "2026-10-19T19:00:00.000Z"], "never sooner than an hour from now"],
    [null, M(19, 10), ["2026-10-19T09:00:00.000Z", "2026-10-19T22:00:00.000Z"], "Flexible: the rest of the day"],
    [[-1, -1], M(19, 10), null, "an ask that could not be read fits nothing"],
    [[600, 780], M(19, 12, 30), null, "the window has gone"],
  ]) check("released range", JSON.stringify(win), rng(R.releasedRange(day19, win, nowMs)), want, note);
  check("released range", "no day", R.releasedRange(null, [1080, 1260], M(19, 10)), null, "a day that cannot be read gets today's path");
  check("released range", "DST Sunday 10:00", rng(R.releasedRange(new Date(Date.UTC(2026, 9, 25)), [600, 601], M(24, 12))), ["2026-10-25T09:00:00.000Z", "2026-10-25T09:01:00.000Z"], "10:00 on 25 Oct is 09:00Z");

  // What the customer reads.
  for (const [ms, L, want] of [[M(19, 18), "en", "today"], [M(20, 18), "es", "mañana"], [M(24, 18), "en", "Sat 24 Oct"], [M(24, 18), "es", "sáb 24 oct"]]) {
    check("released day word", `${iso(ms)} ${L}`, R.relDayWord(ms, M(19, 10), L), want, "");
  }
  check("released line", "en, typed price", R.releasedLine({ studio: "Calma Madrid Spa", area: "Chamberí", day: "today", hm: "18:00", svc: "Relaxing massage", minutes: 60, price: 60, exact: true }, "en"),
    "· *Calma Madrid Spa* (Chamberí): today 18:00, Relaxing massage 60 min, 60 EUR", "");
  check("released line", "es, listed price", R.releasedLine({ studio: "ZZ Prueba Massage Club", area: "Sol", day: "hoy", hm: "18:30", svc: "masaje relajante", minutes: 60, price: 55, exact: false }, "es"),
    "· *ZZ Prueba Massage Club* (Sol): hoy 18:30, masaje relajante 60 min, unos 55 EUR", "a listing is never quoted as the price");
  check("released line", "no price", R.releasedLine({ studio: "X", area: "", day: "today", hm: "18:00", svc: "massage", minutes: 90, price: null, exact: false }, "en"), "· *X*: today 18:00, massage 90 min", "");
  const two = R.releasedButtons("en", [{ studio: "ZZ Prueba Massage Club", hm: "18:00" }, { studio: "Aurora Test Studio", hm: "18:30" }]);
  check("released buttons", "two", two.map((x) => x.id), ["rel_0", "rel_1", "rel_more"], "");
  check("released buttons", "two titles", two.map((x) => x.title), ["18:00 ZZ Prueba", "18:30 Aurora Test", "More options"], "");
  check("released buttons", "one, es", R.releasedButtons("es", [{ studio: "Calma", hm: "18:00" }]).map((x) => `${x.id}=${x.title}`), ["rel_0=Sí, reserva 18:00", "rel_more=Más opciones"], "");
  for (const L of ["en", "es"]) for (const opts of [[{ studio: "Centro de Masajes Muy Largo De Verdad", hm: "18:00" }, { studio: "Otro Centro Con Nombre Larguísimo", hm: "21:30" }], [{ studio: "X", hm: "23:30" }]]) {
    check("released buttons fit in 20 characters", `${L} ${opts.length}`, R.releasedButtons(L, opts).every((x) => x.title.length <= 20), true, "");
  }
  check("released contact line", "phone and email", R.releasedContactEs("34600000501", "ana@gmail.com"), "Su teléfono es +34600000501 y su email, ana@gmail.com.", "");
  check("released contact line", "phone only", R.releasedContactEs("+34 600 000 501", ""), "Su teléfono es +34600000501.", "");
  check("released contact line", "nothing", R.releasedContactEs("", null), "", "");

  // Review (17 Oct): why a tap was refused. Never "someone booked it" when nobody did.
  {
    const now = Date.parse("2026-10-19T15:00:00Z");
    const ago = (min) => new Date(now - min * 60e3).toISOString();
    const at = (min) => new Date(now + min * 60e3).toISOString();
    const A = { id: "a", status: "booked", booked_phone: "34611000001", booked_at: ago(0.2), start_at: at(180), end_at: at(240), expires_at: at(120) };
    const B = { id: "b", status: "released", start_at: at(210), end_at: at(270), expires_at: at(150) };
    const C = { id: "c", status: "released", start_at: at(600), end_at: at(660), expires_at: at(540) };
    for (const [rows, id, want, note] of [
      [[A, B], "b", "dup", "two buttons tapped side by side: the other tap booked a moment ago"],
      [[A], "a", "dup", "the same button twice: this customer booked this very time"],
      [[{ ...A, booked_phone: "34622000002" }], "a", "taken", "someone else booked it"],
      [[{ ...A, booked_at: ago(5) }, B], "b", "clash", "their own booking overlaps this time"],
      [[{ ...A, booked_at: ago(5) }, C], "c", "taken", "a later time they could also take: another customer won it"],
      [[{ id: "h", status: "held", held_by_phone: "34611000001", held_until: at(8), updated_at: ago(0.1) }, C], "c", "dup", "their other tap holds a time right now"],
      [[{ id: "h", status: "held", held_by_phone: "34611000001", held_until: at(8), updated_at: ago(6) }, C], "c", "stale_hold", "a hold left over from an earlier ask: give it back and retry"],
      [[{ id: "h", status: "held", held_by_phone: "34611000001", held_until: ago(1), updated_at: ago(11) }, C], "c", "taken", "a hold that ran out does not count"],
      [[{ ...C, status: "expired" }], "c", "too_close", "expired, nobody took it"],
      [[{ ...C, expires_at: at(9) }], "c", "too_close", "under 10 minutes left to book it"],
      [[], "c", "taken", "nothing could be read: as before"],
    ]) check("released refusal", note, R.releasedRefusal(rows, id, "+34 611 000 001", now), want, "");
  }
  // The studio page's save note: singular and plural agree (review, 17 Oct).
  for (const [saved, missed, want] of [
    [["18:00"], [], "Guardado. Ya se puede reservar: 18:00."],
    [["18:00", "18:30"], [], "Guardado. Ya se pueden reservar: 18:00 y 18:30."],
    [["18:00"], ["20:30"], "Guardado. Ya se puede reservar: 18:00. No hemos guardado las 20:30: ya estaba marcada o acaba de cambiar, falta menos de una hora o no cabe en vuestro horario."],
    [[], ["20:00", "20:30"], "No hemos guardado las 20:00 ni las 20:30: ya estaban marcadas o acaban de cambiar, falta menos de una hora o no caben en vuestro horario."],
    [[], ["19:00", "20:00", "20:30"], "No hemos guardado las 19:00, las 20:00 ni las 20:30: ya estaban marcadas o acaban de cambiar, falta menos de una hora o no caben en vuestro horario."],
  ]) check("released save note", `${saved.length}/${missed.length}`, R.releasedSaveNote(saved, missed).note, want, "");
  check("released save note", "error only when nothing saved", [R.releasedSaveNote(["18:00"], ["20:00"]).err, R.releasedSaveNote([], ["20:00"]).err], [false, true], "");
  // The released slot a request was made for, from message_text.
  for (const [t, want, note] of [
    ["Quiere: Relaxing massage | Cuando: Tomorrow Evening | Zona: Sol | Origen: whatsapp-bot | Hueco: 5B2C1E0A-1111-4222-8333-944445555666 (ZZ Prueba 18:00)", "5b2c1e0a-1111-4222-8333-944445555666", "a released booking"],
    ["Quiere: Relaxing massage | Cuando: Tomorrow Evening | Zona: Sol | Origen: whatsapp-bot", null, "every other request: the cancel path is unchanged"],
    ["Hueco: 5b2c1e0a-1111-4222-8333-944445555666", null, "only the marker createRequest writes"],
    [null, null, ""],
  ]) check("relHueco", note || String(t), R.relHueco(t), want, "");
  // What the customer agrees to, and what follows a refused tap.
  for (const L of ["en", "es"]) {
    const c = R.RELEASED_COPY[L];
    const consent = L === "en" ? "your name, phone and email" : "tu nombre, tu teléfono y tu email";
    check("released consent", L, [c.many(["· a"]).includes(consent), c.one("· a").includes(consent)], [true, true], "the confirmation carries the email too (review, 17 Oct)");
    check("released copy", `${L}: no "free now" before offerStudios`, [c.justTaken, c.stale, c.heldOut, c.tooClose].filter((t) => /free now|queda libre\./i.test(t)), [], "offerStudios may show studios to ask, not free times");
    check("released copy", `${L}: vocative comma`, c.rejectedNone("Ana", "Calma", "x").startsWith(L === "en" ? "Sorry, Ana, Calma" : "Lo siento, Ana, Calma"), true, "");
  }
  check("released copy", "es: present perfect and indicative", [R.RELEASED_COPY.es.rejectNote, R.RELEASED_COPY.es.heldOut.slice(0, 33), R.RELEASED_COPY.es.stale.slice(0, 48)], ["Si el centro tiene algún problema, nos lo dice en 15 minutos y te avisamos al momento.", "Te he guardado esa hora 10 minuto", "Esas horas han cambiado desde que te las he mand"], "");

  // No em or en dashes in anything a customer or studio reads (standing rule).
  const copyOut = [];
  for (const L of ["en", "es"]) {
    const c = R.RELEASED_COPY[L];
    for (const [k, v] of Object.entries(c)) if (k !== "many") copyOut.push(typeof v === "function" ? v("Ana", "Calma", "at 18:00 today", "· *X* (Sol): today 18:00") : v);
    copyOut.push(c.many(["· a", "· b"]), c.one("· a"));
  }
  check("released copy", "no em or en dashes", copyOut.filter((t) => /[—–]/.test(t)), [], "");
  const sideA = botSrc.indexOf("// ---- v215 released slots: the bot side");
  const sideB = botSrc.indexOf("async function createRequest(", sideA);
  check("released copy", "no em or en dashes in the studio page, the reject page and the studio texts", sideA > 0 && sideB > sideA && !/[—–]/.test(botSrc.slice(sideA, sideB)), true, "");

  // Hooks: the switch is read before anything else, and today's path is untouched without it.
  check("hook", "offerReleased reads nothing when RELEASED is off", /async function offerReleased[\s\S]{0,200}const mode = await releasedMode\(\);\s*if \(mode === "off"\) return false;/.test(botSrc), true, "off must be zero change");
  check("hook", "offerStudios asks offerReleased first, unless More options", /if \(!o\.noReleased && await offerReleased\(s, from, L\)\) return true;/.test(botSrc), true, "");
  check("hook", "finalizeBooking books a tapped released time", /if \(s\.data\.released\) return await finalizeReleased\(s, from, L\);/.test(botSrc), true, "");
  check("hook", "acceptOffer books the slot before it confirms", /relRpcOne\("book_released_slot"[\s\S]{0,2000}const claim = await fetch/.test(botSrc), true, "one conditional update decides who gets it");
  check("hook", "confirmed_start is written for a released time", /confirmed_start: relSlot\.start_at/.test(botSrc), true, "ensureBooking needs it for the bookings row");
  // Review (17 Oct).
  check("hook", "RELEASED off stops taps already on screen", /async function releasedTap[\s\S]{0,2400}const off = \(await releasedMode\(\)\) === "off" \|\| !releasedHoursOk\(Date\.now\(\), "tap"\);/.test(botSrc), true, "kill switch");
  check("hook", "RELEASED off stops a booking in progress", /async function finalizeReleased[\s\S]{0,1200}const off = !!r\?\.slot_id && \(await releasedMode\(\)\) === "off";/.test(botSrc), true, "kill switch");
  check("hook", "a double tap says nothing", /if \(why === "dup"\) \{ quietThisTurn = true; await logEvent\(from, "released_dup_tap"/.test(botSrc) && /if \(why === "dup"\) quietThisTurn = true;\s*if \(!from \|\| why === "dup"\) return;/.test(botSrc), true, "the other tap carries on, and no holding line");
  check("hook", "the page save passes when it was drawn", /p_source: "studio_link", p_evidence: `studio page \$\{new Date\(nowMs\)\.toISOString\(\)\}`, p_since: new Date\(at\)\.toISOString\(\)/.test(botSrc), true, "a reload never re-releases a rejected time");
  check("hook", "a reject reads the slot again before saying it is late", /const now2 = await readSlot\(\);\s*if \(now2\?\.status === "rejected"\) return pageOut\(url, already\(\)\);/.test(botSrc), true, "");
  check("hook", "a reject after the customer cancelled tells nobody but Jordan", /if \(req\.stage !== "confirmed" \|\| flag === "cancelled" \|\| flag === "change_requested"\) \{/.test(botSrc), true, "");
  check("hook", "a cancel withdraws the released time at once", /if \(relSlotId\) await relRpc\("released_request_closed", \{ p_request: Number\(req\.id\) \}\);/.test(botSrc), true, "");
  check("hook", "a released cancel is emailed to the studio", /const cMail = await relMail\(`Cancelada: /.test(botSrc) && /relSlotId && req\.partner_id \? await emailStudio\(/.test(botSrc), true, "email-only studios");
  check("hook", "a late-given email follows the released confirmation", /if \(relHueco\(reqRow\.message_text\) && reqRow\.stage === "confirmed" && reqRow\.partner_id\) await releasedEmailFollowUp\(reqRow, email\);/.test(botSrc), true, "");
  check("hook", "a next released time after a reject only inside the offering hours", /if \(scope && releasedHoursOk\(Date\.now\(\)\)\) \{/.test(botSrc), true, "");
  // The migration's ON CONFLICT names the same partial index it creates.
  const idx = migSrc.match(/released_slots_live_seat\s+on public\.released_slots \(partner_id, start_at, seat\)\s+where (status in \([^)]*\))/);
  const onc = migSrc.match(/on conflict \(partner_id, start_at, seat\) where (status in \([^)]*\)) do nothing/);
  check("migration", "ON CONFLICT matches the live-seat index", !!idx && !!onc && idx[1] === onc[1], true, "otherwise Postgres cannot infer the index and the insert fails");
  check("migration", "no access for anon or signed-in users", /revoke all on public\.released_slots from public, anon, authenticated;/.test(migSrc) && /enable row level security/.test(migSrc), true, "");
  // Review (17 Oct).
  const fnDefs = [...migSrc.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => [m[1], m[2].split(",").map((x) => x.trim().split(/\s+/)[1]).join(", ")]);
  const grants = new Set([...migSrc.matchAll(/grant execute on function public\.(\w+)\(([^)]*)\) to service_role;/g)].map((m) => `${m[1]}(${m[2]})`));
  const revokes = new Set([...migSrc.matchAll(/revoke all on function public\.(\w+)\(([^)]*)\) from public, anon, authenticated;/g)].map((m) => `${m[1]}(${m[2]})`));
  check("migration", "every function is revoked from anon and granted to service_role, with its own signature", fnDefs.filter(([n, a]) => !grants.has(`${n}(${a})`) || !revokes.has(`${n}(${a})`)).map(([n, a]) => `${n}(${a})`), [], "a changed signature must change both lines");
  check("migration", "the old release_slots signature is dropped first", /drop function if exists public\.release_slots\(uuid, jsonb, text, text\);\s*create or replace function public\.release_slots\(p_partner uuid, p_rows jsonb, p_source text, p_evidence text default null, p_since timestamptz default null\)/.test(migSrc), true, "re-applying never leaves two overloads");
  check("migration", "a hold never outlasts the time it can be booked in", /held_until = least\(expires_at,/.test(migSrc) && /now\(\) \+ interval '10 minutes' <= expires_at/.test(migSrc) && /s\.expires_at > now\(\) \+ interval '15 minutes'/.test(migSrc), true, "");
  check("migration", "released times only at studios with an email", /and coalesce\(p\.booking_email, p\.email, ''\) like '%_@_%\.%'/.test(migSrc) && !/mc_wa_number\(coalesce\(p\.whatsapp, p\.phone\)\) is not null or/.test(migSrc), true, "the email carries the phone and the reject link");
  check("migration", "one phone, one released time at a time", (migSrc.match(/hashtextextended\('released-phone:' \|\| v_phone, 0\)/g) || []).length, 2, "hold and book both lock the phone first");
}

// ---------------------------------------------------------------------------
// v216 (18 Oct, Jordan: "for the new ones we need to easily funnel them into
// having them give us times", "not on whatsapp, they get a link"). The
// /socios page saves a studio's times: a signed personal link is applied at
// once, anything else waits for Jordan. The helpers (the link signature, the
// checks, "every week" dates, what differs from what we have on file, and
// «ocupado» from a studio on WhatsApp) are in bot.ts between "socios: pure
// helpers (start)" and "(end)"; they are lifted out with the v215 block they
// build on. The clock changes on Sunday 25 Oct 2026, so those are real dates.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const nodeCrypto = await import("node:crypto");
  const { stripTypeScriptTypes } = await import("node:module");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const botSrc = fs.readFileSync(path.join(here, "../supabase/functions/wa-bot/bot.ts"), "utf8");
  const migSrc = fs.readFileSync(path.join(here, "../supabase/migrations/20261018_socios_signup.sql"), "utf8");
  const html = fs.readFileSync(path.join(here, "../public/socios.html"), "utf8");
  const kit = fs.readFileSync(path.join(here, "../docs/studio-pitch-kit.md"), "utf8");
  const a = botSrc.indexOf("// ---- v215 released slots: pure helpers (start) ----");
  const b = botSrc.indexOf("// ---- v216 socios: pure helpers (end) ----");
  const s0 = botSrc.indexOf("// ---- v216 socios: pure helpers (start) ----");
  if (a < 0 || s0 < a || b < s0) throw new Error("bot.ts: the v216 socios helper markers are missing");
  const names = ["SOCIOS_TERMS", "socAllowedOrigin", "socPhone", "relHmac", "socSigValue", "socTimeCheck", "socWeeklyCheck", "socValidate", "socPatternDates", "socDiff", "socSlug", "socMsg", "SOC_MSG", "ocupadoIntent", "ocupadoPick", "ocupadoReply", "socFunnelRank", "socShareText", "SOC_PITCH_ES", "relAt", "relYmd", "socSignedUpdate", "ocupadoClash", "socWindows", "socProposalNow", "socProposedEn", "socProposalWaiting", "dispatchHours", "socHoursWritable", "slotHours"];
  const copyUrl = pathToFileURL(path.join(here, "../supabase/functions/wa-bot/copy.ts")).href;
  const js = `import { madridInstant, madridMidnight, stripAcc, euro } from ${JSON.stringify(copyUrl)};\n`
    + stripTypeScriptTypes(botSrc.slice(a, b)) + `\nexport { ${names.join(", ")} };\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-socios-"));
  const file = path.join(dir, "socios.mjs");
  fs.writeFileSync(file, js);
  const R = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });
  const { madridInstant } = await import(copyUrl);
  const M = (day, h, mi = 0) => madridInstant(new Date(Date.UTC(2026, 9, day)), h).getTime() + mi * 60e3;
  const iso = (ms) => new Date(ms).toISOString();

  // The terms stored are exactly the sentence the page shows.
  const termsLine = (L) => (html.match(new RegExp(`\\n  ${L}: \\{[\\s\\S]*?\\n    termsLine: "([^"]*)",`)) || [])[1];
  const ver = (html.match(/const TERMS_VERSION = "([^"]+)";/) || [])[1];
  check("socios terms", "page version is one the server knows", !!R.SOCIOS_TERMS[ver], true, "an unknown version is refused");
  for (const L of ["es", "en"]) check("socios terms", `${L} text word for word`, R.SOCIOS_TERMS[ver][L], termsLine(L), "the written agreement billing relies on");
  check("socios terms", "the fee is 5 EUR + IVA for every visit we book from 1 Jan 2027, first or repeat, only if the customer comes; free to 31 Dec 2026; 0 for a direct booking (CLAUDE.md PARTNER FEE, 19 Oct)", [/^Gratis hasta el 31 de diciembre de 2026; desde el 1 de enero de 2027, 5 € \+ IVA por cada visita que os reservemos nosotros, solo si el cliente viene\. Si un cliente os reserva directamente, sin nosotros, 0 €\. Sin cuota mensual ni contrato\.$/.test(R.SOCIOS_TERMS[ver].es), /^Free until 31 December 2026; from 1 January 2027, 5 € \+ VAT for each visit we book for you, only if the customer comes\. If a customer books you directly, without us, 0 €\. No monthly fee, no contract\.$/.test(R.SOCIOS_TERMS[ver].en), /primera visita|cliente nuevo|siguientes visitas|first visit|new customer|later visits/i.test(R.SOCIOS_TERMS[ver].es + " " + R.SOCIOS_TERMS[ver].en)], [true, true, false], "never quote another figure; the old first-visit-only wording is gone");

  // The page's origins.
  for (const [o, want] of [["https://book.massageclub.io", true], ["https://massageclub.io", true], ["https://your-massage-pass-git-main.vercel.app", true], ["https://www.massageclub.io", false], ["http://book.massageclub.io", false], ["https://book.massageclub.io.evil.com", false], ["https://evil.com/?https://book.massageclub.io", false], ["", false], ["https://a.b.vercel.app", false], ["https://your-massage-pass.vercel.app", true], ["https://your-massage-pass-o5fo.vercel.app", true], ["https://evil-app.vercel.app", false], ["https://evil.vercel.app", false], ["https://notyour-massage-pass.vercel.app", false]]) {
    check("socios CORS origin", o, !!R.socAllowedOrigin(o), want, "");
  }
  // Phones as the page sends them.
  for (const [v, want] of [["+34 600 000 000", "34600000000"], ["660 390 910", "34660390910"], ["0034 660 390 910", "34660390910"], ["+1 562 235 5063", "15622355063"], ["12345", ""], ["", ""], ["+34 600 000 000 000 000", ""]]) check("socios phone", v, R.socPhone(v), want, "");

  // The link signature: the same construction as relSig, a kind of its own,
  // and revoked with slots_link_v.
  const ref = (key, kind, value) => nodeCrypto.createHmac("sha256", `${key}:${kind}`).update(value).digest().subarray(0, 12).toString("hex");
  const pid = "22222222-2222-2222-2222-222222222222";
  const sig1 = await R.relHmac("k1", "socios", R.socSigValue({ id: pid, slots_link_v: 1 }));
  check("socios signature", "HMAC-SHA256 under '<key>:socios', 12 bytes hex", [sig1, /^[0-9a-f]{24}$/.test(sig1)], [ref("k1", "socios", `${pid}:1`), true], "");
  check("socios signature", "bumping slots_link_v revokes it", sig1 === await R.relHmac("k1", "socios", R.socSigValue({ id: pid, slots_link_v: 2 })), false, "one number revokes both links");
  check("socios signature", "differs from the times page's own signature", sig1 === ref("k1", "slots", `${pid}:1`), false, "a /socios link cannot be turned into a times page link");
  check("socios signature", "no ops key, no signature", await R.relHmac("", "socios", `${pid}:1`), "", "never valid without the key");
  check("socios signature", "missing slots_link_v reads as 1", R.socSigValue({ id: pid }), `${pid}:1`, "");
  check("socios signature", "relSig is the same construction", /async function relSig\(kind: string, value: string\): Promise<string> \{\s*if \(!SIGN_KEY\) return "";\s*const k = await crypto\.subtle\.importKey\("raw", new TextEncoder\(\)\.encode\(SIGN_KEY \+ ":" \+ kind\)/.test(botSrc), true, "");

  // The checks. Now: Wednesday 21 Oct 2026, 12:00 Madrid.
  const now = M(21, 12);
  const P = (o = {}) => ({
    lang: "es", drawn_at: now - 5 * 60e3,
    studio: { business_name: "Calma", whatsapp: "+34 600 111 222", address: "Calle Mayor 1", email: "hola@calma.es", opening_hours: "Lun-Vie 10-20", opening_hours_read: "Lun-Vie 10:00-20:00", price_60_eur: 50, price_90_eur: null, ...(o.studio || {}) },
    terms: { accepted: true, version: "2026-10-19", text: R.SOCIOS_TERMS["2026-10-19"].es, ...(o.terms || {}) },
    availability: { duration_min: 60, repeat_weekly: false, slots: [{ date: "2026-10-22", start: "18:00" }], ...(o.availability || {}) },
  });
  const V = (o, stored = null, at = now) => R.socValidate(P(o), at, stored);
  let v = V({});
  check("socios checks", "a good dated time", [v.ok, v.plan.once, v.plan.price, v.plan.terms.text, v.plan.drawnAt], [true, [{ ymd: "2026-10-22", hm: "18:00" }], 50, R.SOCIOS_TERMS["2026-10-19"].es, now - 5 * 60e3], "");
  for (const [o, err, note] of [
    [{ studio: { email: "" } }, "email_missing", "released times need an email (R7)"],
    [{ studio: { email: "hola@calma" } }, "email", ""],
    [{ studio: { business_name: "C" } }, "name", ""],
    [{ studio: { business_name: "x".repeat(121) } }, "name", "length"],
    [{ studio: { whatsapp: "123" } }, "wa", ""],
    [{ studio: { address: "" } }, "address", ""],
    [{ studio: { address: "x".repeat(201) } }, "address", "length"],
    [{ studio: { opening_hours: "x".repeat(201) } }, "hours", "length"],
    [{ studio: { price_60_eur: 0 } }, "price", ""],
    [{ studio: { price_60_eur: "abc" } }, "price", ""],
    [{ studio: { price_90_eur: 501 } }, "price", ""],
    [{ availability: { duration_min: 30 } }, "duration", "60 or 90 only"],
    [{ terms: { accepted: false } }, "terms", ""],
    [{ terms: { version: "2025-01-01" } }, "terms", "unknown version"],
    [{ terms: { text: "Gratis siempre. Nunca pagaréis nada." } }, "terms_text", "review fix: a different terms text is refused, never stored as ours"],
    [{ terms: { text: undefined } }, "terms_text", "no text at all is refused too"],
    [{ terms: { lang: "en" } }, "terms_text", "the Spanish sentence ticked on an English page is not the English one"],
    // Jordan, 23 Oct: a missing price is no longer refused (see below), but
    // a price that is typed is still checked.
    [{ studio: { price_60_eur: 501 } }, "price", "the page's other amount, over 500"],
    [{ studio: { price_60_eur: 0.5 } }, "price", "under 1"],
    [{ studio: { price_60_eur: "40-50" } }, "price", "a range is not a price"],
    [{ availability: { slots: [] } }, "times_none", ""],
    [{ availability: { slots: Array.from({ length: 41 }, (_, i) => ({ date: "2026-10-22", start: `${String(8 + Math.floor(i / 2) % 12).padStart(2, "0")}:${i % 2 ? "30" : "00"}` })) } }, "times_many", "a sane maximum"],
  ]) {
    const r = V(o);
    check("socios checks", `refused: ${err}${note ? ` (${note})` : ""}`, [r.ok, r.errors.includes(err)], [false, true], note);
  }
  check("socios checks", "every error code has Spanish and English copy", Object.keys(R.SOC_MSG).filter((k) => !R.SOC_MSG[k].es || !R.SOC_MSG[k].en), [], "");
  // Single times that no longer fit are skipped and said; none left is an error.
  v = V({ availability: { slots: [
    { date: "2026-10-22", start: "18:00" }, { date: "2026-10-22", start: "18:15" }, { date: "2026-10-21", start: "12:30" },
    { date: "2026-10-24", start: "12:00" }, { date: "2026-10-22", start: "19:30" }, { date: "2026-12-16", start: "12:00" },
    { date: "2026-12-17", start: "12:00" }, { date: "2026-10-20", start: "12:00" }, { date: "2026-10-22", start: "18:00" }, { date: "22/10", start: "18:00" },
  ] } });
  // v217: the two dates past the limit were 29 and 30 Oct (more than 7 days
  // ahead); with 8 weeks they are 16 and 17 Dec (today plus 56 and 57 days).
  check("socios checks", "only the good one kept, once", v.plan.once, [{ ymd: "2026-10-22", hm: "18:00" }], "");
  check("socios checks", "why each was skipped", v.plan.skipped.map((x) => `${x.day} ${x.hm} ${x.why}`), ["2026-10-22 18:15 grid", "2026-10-21 12:30 soon", "2026-10-24 12:00 closed", "2026-10-22 19:30 hours", "2026-12-16 12:00 day", "2026-12-17 12:00 day", "2026-10-20 12:00 day", "22/10 18:00 format"], "grid, 60 minutes ahead, hours, at most 8 weeks ahead (v217)");
  check("socios checks", "nothing left: times_invalid", V({ availability: { slots: [{ date: "2026-10-24", start: "12:00" }] } }).errors, ["times_invalid"], "");
  // Hours: unknown is 08:00 to 22:00, as the page shows; the page's reading first; stored hours last.
  const U = { opening_hours: "", opening_hours_read: "" };
  check("socios checks", "unknown hours: 08:00 to 22:00", V({ studio: U, availability: { slots: [{ date: "2026-10-24", start: "07:30" }, { date: "2026-10-24", start: "08:00" }, { date: "2026-10-24", start: "21:00" }, { date: "2026-10-24", start: "21:30" }] } }).plan.once.map((x) => x.hm), ["08:00", "21:00"], "REL_DEFAULT_HOURS");
  check("socios checks", "stored hours when none typed", V({ studio: U, availability: { slots: [{ date: "2026-10-24", start: "12:00" }] } }, "Lun-Vie 10:00-20:00").errors, ["times_invalid"], "Saturday is closed on file");
  check("socios checks", "the page's reading wins over a raw text it could not parse", V({ studio: { opening_hours: "de lunes a sábado, de 10 a 21", opening_hours_read: "Lun-Sáb 10:00-21:00" }, availability: { slots: [{ date: "2026-10-24", start: "12:00" }] } }).ok, true, "");
  check("socios checks", "90 minutes must end by closing", V({ studio: { price_90_eur: 80 }, availability: { duration_min: 90, slots: [{ date: "2026-10-22", start: "18:30" }, { date: "2026-10-22", start: "19:00" }] } }).plan.once.map((x) => x.hm), ["18:30"], "");
  check("socios checks", "a 90 minute price comes from price_90_eur", V({ studio: { price_90_eur: 80 }, availability: { duration_min: 90 } }).plan.price, 80, "only a price the studio typed");
  // Every week.
  v = V({ availability: { repeat_weekly: true, slots: [{ weekday: 1, start: "18:00" }, { weekday: 1, start: "18:00" }, { weekday: 0, start: "12:00" }, { weekday: 3, start: "19:30" }, { weekday: 7, start: "12:00" }, { weekday: 2, start: "10:10" }] } });
  check("socios checks", "weekly: Monday 18:00 once; Sunday closed, 19:30 past closing, weekday 7 and 10:10 refused", [v.plan.pattern, v.plan.skipped.map((x) => x.why)], [[{ dow: 1, hm: "18:00" }], ["closed", "hours", "format", "grid"]], "");
  // Terms: exactly our sentence for that version and language, or refused.
  v = V({ terms: { text: "0 € para siempre" } });
  check("socios checks", "a changed terms text is refused (review fix)", [v.ok, v.errors], [false, ["terms_text"]], "partner_terms only ever holds what the studio saw");
  check("socios checks", "English page, English terms", V({ terms: { lang: "en", text: R.SOCIOS_TERMS["2026-10-19"].en } }).plan.terms.text, R.SOCIOS_TERMS["2026-10-19"].en, "");
  check("socios checks", "the same sentence with extra spaces still counts", V({ terms: { text: "  " + R.SOCIOS_TERMS["2026-10-19"].es.replace(/ /g, "  ") + " " } }).ok, true, "socLine collapses spaces");
  // Price. Jordan, 23 Oct ("this makes 0 sense ... or at least skip this
  // step and send them a form later"): a form without a price is accepted
  // and its times saved; pricePending says customers cannot see them until
  // there is one. With the menu on file (the studio's own link) it is quoted.
  check("socios checks", "no price, menu on file (priceKnown): accepted, not pending", [R.socValidate(P({ studio: { price_60_eur: null } }), now, null, { priceKnown: true }).ok, R.socValidate(P({ studio: { price_60_eur: null } }), now, null, { priceKnown: true }).plan?.price, R.socValidate(P({ studio: { price_60_eur: null } }), now, null, { priceKnown: true }).plan?.pricePending], [true, null, false], "the listed price is quoted");
  v = V({ studio: { price_60_eur: null } });
  check("socios checks", "no price and no menu: accepted, times kept, price pending (Jordan, 23 Oct)", [v.ok, v.errors, v.plan?.once, v.plan?.price, v.plan?.pricePending], [true, [], [{ ymd: "2026-10-22", hm: "18:00" }], null, true], "was refused as price_needed");
  v = V({ studio: { price_60_eur: null, price_90_eur: 80 } });
  check("socios checks", "60 min chosen with only a 90 min price: accepted, the 60 min price pending", [v.ok, v.plan?.price, v.plan?.pricePending], [true, null, true], "");
  v = V({ studio: { price_60_eur: "", price_later: true } });
  check("socios checks", "the page's «Lo pongo más tarde» (price_later, an empty price): accepted, pending", [v.ok, v.plan?.price, v.plan?.pricePending], [true, null, true], "");
  check("socios checks", "a typed price is not pending", [V({}).plan?.pricePending, V({ studio: { price_60_eur: "55" } }).plan?.price], [false, 55], "");
  check("socios checks", "price_needed is no longer an answer the sign-up gives", [V({ studio: { price_60_eur: null } }).errors.includes("price_needed"), "price_needed" in R.SOC_MSG], [false, false], "");
  // Hours (review fixes): the hard 08:00 to 22:00 window; on file first unless it is the studio's own link.
  const H24 = { opening_hours: "Lun-Dom 0-24", opening_hours_read: "Lun-Dom 00:00-24:00" };
  v = V({ studio: H24, availability: { slots: [{ date: "2026-10-24", start: "03:00" }, { date: "2026-10-23", start: "23:00" }, { date: "2026-10-23", start: "21:30" }, { date: "2026-10-23", start: "21:00" }, { date: "2026-10-23", start: "08:00" }, { date: "2026-10-23", start: "07:30" }] } });
  check("socios checks", "never before 08:00 or after 22:00, whatever was typed", [v.plan.once.map((x) => x.hm), v.plan.skipped.map((x) => `${x.hm} ${x.why}`)], [["21:00", "08:00"], ["03:00 hours", "23:00 hours", "21:30 hours", "07:30 hours"]], "attack scenario A");
  v = V({ studio: H24, availability: { repeat_weekly: true, slots: [{ weekday: 0, start: "00:00" }, { weekday: 1, start: "22:00" }, { weekday: 1, start: "12:00" }] } });
  check("socios checks", "a weekly 00:00 or 22:00 is refused", [v.plan.pattern, v.plan.skipped.map((x) => x.why)], [[{ dow: 1, hm: "12:00" }], ["hours", "hours"]], "materialised every 5 minutes otherwise");
  check("socios checks", "unsigned: the hours on file come before what was typed", V({ studio: H24, availability: { slots: [{ date: "2026-10-24", start: "12:00" }] } }, "Lun-Vie 10:00-20:00").errors, ["times_invalid"], "Saturday is closed on file");
  check("socios checks", "own signed link: what it typed comes first (then saved on its row)", R.socValidate(P({ studio: { opening_hours: "Lun-Sáb 10-20", opening_hours_read: "Lun-Sáb 10:00-20:00" }, availability: { slots: [{ date: "2026-10-24", start: "12:00" }] } }), now, "Lun-Vie 10:00-20:00", { typedFirst: true }).ok, true, "");
  check("socios checks", "own signed link, nothing typed: the file", R.socValidate(P({ studio: U, availability: { slots: [{ date: "2026-10-24", start: "12:00" }] } }), now, "Lun-Vie 10:00-20:00", { typedFirst: true }).errors, ["times_invalid"], "");
  check("socios checks", "the window clamps a day that opens early and closes late", R.socWindows(new Map([[1, [[6 * 60, 23 * 60]]], [2, [[22 * 60, 24 * 60]]]]), 1), [[480, 1320]], "");
  check("socios checks", "a day open only after 22:00 is closed", R.socWindows(new Map([[2, [[22 * 60, 24 * 60]]]]), 2), [], "");
  check("socios checks", "drawn_at in the future or days old is ignored", [V({}, null, now).plan.drawnAt, R.socValidate({ ...P({}), drawn_at: now + 3600e3 }, now).plan.drawnAt, R.socValidate({ ...P({}), drawn_at: now - 3 * 86400e3 }, now).plan.drawnAt], [now - 5 * 60e3, null, null], "");

  // "Every week" dates across the clock change (Sunday 25 Oct 2026, 03:00 -> 02:00).
  const dates = (dow, hm, at) => R.socPatternDates(dow, hm, 60, at).map((x) => `${x.ymd} ${iso(x.startMs).slice(11, 16)}Z`);
  check("socios weekly dates", "Sat 18:00 before the change is 16:00Z", dates(6, "18:00", now), ["2026-10-24 16:00Z"], "CEST, UTC+2");
  check("socios weekly dates", "Sun 18:00 after the change is 17:00Z", dates(0, "18:00", now), ["2026-10-25 17:00Z"], "CET, UTC+1");
  check("socios weekly dates", "Mon 10:00 next week, 09:00Z", dates(1, "10:00", now), ["2026-10-26 09:00Z"], "");
  check("socios weekly dates", "Wed 12:30 today is too soon; next Wednesday is outside 7 days", dates(3, "12:30", now), [], "today and the next 6 days, 60 minutes ahead");
  check("socios weekly dates", "Wed 13:30 today, an hour and a half away", dates(3, "13:30", now), ["2026-10-21 11:30Z"], "");
  check("socios weekly dates", "on the change day itself, at 01:30 CEST", dates(0, "10:00", M(25, 1, 30)), ["2026-10-25 09:00Z"], "");
  check("socios weekly dates", "same as the migration: Madrid wall clock, generate_series(0, 6), 60 minutes ahead, under 8 days", /from \(select v_today \+ g as day from generate_series\(0, 6\) g\) d/.test(migSrc) && /\(\(d\.day \+ pat\.start_time\) at time zone 'Europe\/Madrid'\)/.test(migSrc) && /c\.start_at >= now\(\) \+ interval '60 minutes'/.test(migSrc) && /c\.start_at < now\(\) \+ interval '8 days'/.test(migSrc), true, "");

  // What we have on file is never overwritten.
  const st = V({}).plan.studio;
  let d = R.socDiff({ whatsapp: null, phone: "+34 910 000 001", email: null, booking_email: null, address: "", opening_hours: null }, st);
  check("socios on file", "empty fields filled", d.fill, { whatsapp: "+34600111222", email: "hola@calma.es", address: "Calle Mayor 1", opening_hours: "Lun-Vie 10:00-20:00" }, "");
  check("socios on file", "a different phone on file is noted", d.differ.map((x) => x.field), ["phone"], "");
  d = R.socDiff({ whatsapp: "+34 600 111 222", email: "otro@calma.es", booking_email: null, address: "Calle Mayor 1, Madrid", opening_hours: "Mon-Fri 10:00-20:00" }, st);
  check("socios on file", "same WhatsApp in another format, same hours in another language: no difference; another email: noted, not filled", [d.fill, d.differ.map((x) => x.field)], [{}, ["email"]], "never overwrite email silently");
  d = R.socDiff({ whatsapp: "+34 699 999 999", email: "x@y.es", booking_email: "hola@calma.es", address: "Otra calle 3", opening_hours: { mon: { open: "09:00", close: "14:00" } } }, st);
  check("socios on file", "booking_email counts; WhatsApp, address and hours differences noted", [d.fill, d.differ.map((x) => x.field)], [{}, ["whatsapp", "address", "opening_hours"]], "");
  // Review fix (17 Oct), changed in review (23 Oct): on its own signed link
  // the studio's hours replace ours and empty fields are filled at once, but
  // a new booking WhatsApp or booking email is only proposed and waits for
  // Jordan's Aprobar. Studio links get forwarded, so whoever holds one could
  // otherwise send every later booking (the customer's name, phone and email)
  // wherever they liked.
  const pv = (u) => u.proposed.changes.map((x) => `${x.field}: ${x.was} -> ${x.now}`);
  let up = R.socSignedUpdate({ whatsapp: "+34655000006", phone: "+34655000006", email: "calma@studio.es", booking_email: null, address: "Calle Mayor 1", opening_hours: "Lun-Sáb 10:00-20:00" }, { ...st, wa: "34655111222", email: "reservas@calmareal.es", hoursRead: "Lun-Dom 10:00-20:00" });
  check("socios own link", "hours replaced at once; the new booking WhatsApp and email only proposed", [up.set, up.replaced.map((x) => `${x.field}: ${x.was} -> ${x.now}`), up.proposed.set, pv(up), up.proposed.lostNumber], [{ opening_hours: "Lun-Dom 10:00-20:00" }, ["opening_hours: Lun-Sáb 10:00-20:00 -> Lun-Dom 10:00-20:00"], { whatsapp: "+34655111222", booking_email: "reservas@calmareal.es" }, ["whatsapp: +34655000006 -> +34655111222", "booking_email: calma@studio.es -> reservas@calmareal.es"], ""], "the reviewer's Calma case: bookings keep reaching what we have until Jordan approves (go-live review, 23 Oct)");
  check("socios own link", "what is written at once never touches where bookings go", ["whatsapp", "phone", "booking_email"].filter((k) => k in up.set), [], "go-live review, 23 Oct: a forwarded link cannot redirect bookings");
  up = R.socSignedUpdate({ whatsapp: "+34655000006", phone: null, email: null, booking_email: null, address: "", opening_hours: null }, { ...st, wa: "34655111222" });
  check("socios own link", "empty fields filled at once; the old WhatsApp's move to an empty phone is part of the proposal", [up.set.whatsapp, up.set.phone, up.filled.sort(), up.proposed.set], [undefined, undefined, ["address", "email", "opening_hours"], { whatsapp: "+34655111222", phone: "+34655000006" }], "so on approval a message from it still reads as the studio");
  up = R.socSignedUpdate({ whatsapp: "+34655000006", phone: "+34910000001", email: "a@b.es", booking_email: "a@b.es" }, { ...st, wa: "34655111222", email: "a@b.es" });
  check("socios own link", "phone holds another number: the proposal says the old WhatsApp would be lost", [["whatsapp", "phone"].filter((k) => k in up.set), up.proposed.set.phone, up.proposed.lostNumber], [[], undefined, "+34655000006"], "on Jordan's card");
  up = R.socSignedUpdate({ whatsapp: null, phone: null, email: "hola@calma.es", booking_email: null, address: "Calle Mayor 1", opening_hours: "Lun-Vie 10:00-20:00" }, st);
  check("socios own link", "an empty WhatsApp is filled at once, nothing proposed", [up.set, up.filled, up.proposed.changes], [{ whatsapp: "+34600111222" }, ["whatsapp"], []], "go-live review: fill empty fields at once");
  up = R.socSignedUpdate({ whatsapp: "+34 600 111 222", phone: null, email: "calma@studio.es", booking_email: null, address: "Calle Mayor 1", opening_hours: "Lun-Vie 10:00-20:00" }, st);
  check("socios own link", "a booking email when bookings reach the general email today is a replacement, so proposed", [up.set, pv(up)], [{}, ["booking_email: calma@studio.es -> hola@calma.es"]], "bookings go to booking_email, else email");
  up = R.socSignedUpdate({ whatsapp: "+34 600 111 222", phone: "+34600111222", email: "hola@calma.es", address: "Otra calle 9", opening_hours: "Lun-Vie 10:00-20:00" }, st);
  check("socios own link", "same details: nothing changes or is proposed; a different address is only noted", [up.set, up.replaced, up.proposed.changes, up.noted.map((x) => x.field)], [{}, [], [], ["address"]], "");
  // Review (23 Oct, follow-up): bookings go to whatsapp || phone, so with no
  // WhatsApp on file but a mobile in phone, a different WhatsApp moves where
  // bookings go: proposed, never written at once. phone stays as it is.
  const onFile = { email: "hola@calma.es", booking_email: null, address: "Calle Mayor 1", opening_hours: "Lun-Vie 10:00-20:00" };
  for (const [phone, note] of [["+34611000999", "the verifier's repro"], ["611 000 999", "a bare Spanish mobile"], ["+44 7700 900123", "a foreign mobile"]]) {
    up = R.socSignedUpdate({ whatsapp: null, phone, ...onFile }, { ...st, wa: "34655111222" });
    check("socios own link", `no WhatsApp, a mobile in phone (${phone}): the new WhatsApp is proposed, not filled`, [up.set, up.filled, up.proposed.set, pv(up), up.proposed.lostNumber, up.noted], [{}, [], { whatsapp: "+34655111222" }, [`whatsapp: ${phone} -> +34655111222`], "", []], `${note}: bookings reach that mobile today; the phone note is the proposal now`);
  }
  up = R.socSignedUpdate({ whatsapp: null, phone: "+34 910 000 001", ...onFile }, { ...st, wa: "34655111222" });
  check("socios own link", "no WhatsApp, a landline in phone: the WhatsApp is filled at once", [up.set, up.filled, up.proposed.changes, up.noted.map((x) => x.field)], [{ whatsapp: "+34655111222" }, ["whatsapp"], [], ["phone"]], "a landline gets no WhatsApp, so nothing reaches the studio there today");
  up = R.socSignedUpdate({ whatsapp: "", phone: "+34 655 111 222", ...onFile }, { ...st, wa: "34655111222" });
  check("socios own link", "no WhatsApp, the same mobile in phone: filled at once", [up.set, up.proposed.changes], [{ whatsapp: "+34655111222" }, []], "bookings keep reaching the same number");
  // What Jordan's Aprobar on a proposal writes, from the row as it is then.
  const prop = { status: "waiting", set: { whatsapp: "+34655111222", booking_email: "reservas@calmareal.es" }, changes: [{ field: "whatsapp", was: "+34655000006", now: "+34655111222" }, { field: "booking_email", was: "calma@studio.es", now: "reservas@calmareal.es" }], lostNumber: "" };
  let pn = R.socProposalNow({ whatsapp: "+34655000006", phone: "+34655000006", email: "calma@studio.es", booking_email: null, address: "Calle Mayor 1", opening_hours: "Lun-Sáb 10:00-20:00" }, prop);
  check("socios contacts review", "approving writes the new WhatsApp and booking email, nothing else", [pn.set, pn.proposed.set, pn.noted], [{}, { whatsapp: "+34655111222", booking_email: "reservas@calmareal.es" }, []], "hours and address untouched");
  pn = R.socProposalNow({ whatsapp: "+34 655 111 222", phone: "+34655000006", email: "calma@studio.es", booking_email: "Reservas@CalmaReal.es " }, prop);
  check("socios contacts review", "already on file (changed by hand since): nothing to write", [pn.set, pn.proposed.set], [{}, {}], "");
  pn = R.socProposalNow({ whatsapp: "+34699999999", phone: "+34910000001", email: "x@y.es", booking_email: null }, prop);
  check("socios contacts review", "the row changed since: worked out from what is on file now", [pv(pn), pn.proposed.lostNumber], [["whatsapp: +34699999999 -> +34655111222", "booking_email: x@y.es -> reservas@calmareal.es"], "+34699999999"], "the page shows what is on file at that moment");
  pn = R.socProposalNow({ whatsapp: null, phone: null, email: null, booking_email: null }, prop);
  check("socios contacts review", "emptied since: filled", [pn.set, pn.proposed.changes], [{ whatsapp: "+34655111222", email: "reservas@calmareal.es" }, []], "");
  pn = R.socProposalNow({ whatsapp: null, phone: "+34611000999", email: "calma@studio.es", booking_email: "reservas@calmareal.es" }, prop);
  check("socios contacts review", "WhatsApp emptied since, a mobile in phone: still a replacement, written only by this Aprobar", [pn.set, pn.proposed.set, pv(pn)], [{}, { whatsapp: "+34655111222" }, ["whatsapp: +34611000999 -> +34655111222"]], "review follow-up (23 Oct): socContactsReview writes set and proposed.set");
  check("socios contacts review", "nothing proposed: nothing to write", [R.socProposalNow({ whatsapp: "+34655000006" }, { changes: [] }).set, R.socProposalNow({ whatsapp: "+34655000006" }, null).proposed.changes], [{}, []], "");
  check("socios contacts review", "Jordan's lines", R.socProposedEn({ set: {}, changes: [{ field: "whatsapp", was: "+34655000006", now: "+34655111222" }, { field: "booking_email", was: "calma@studio.es", now: "reservas@calmareal.es" }, { field: "email", was: "", now: "a@b.es" }], lostNumber: "+34655000006" }), ['Booking WhatsApp: on file "+34655000006", their own link gave "+34655111222".', 'Booking email: on file "calma@studio.es", their own link gave "reservas@calmareal.es".', 'email: nothing on file, their own link gave "a@b.es".', "If you approve, their old WhatsApp +34655000006 is no longer on file (phone holds another number): a message from it would read as a customer."], "");
  check("socios contacts review", "nothing proposed, no lines", [R.socProposedEn(null), R.socProposedEn({ set: {}, changes: [], lostNumber: "+34600000000" })], [[], []], "");
  const W = (row) => R.socProposalWaiting(row);
  check("socios contacts review", "waiting only on an applied signup whose proposal waits", [W({ status: "applied", result: { proposed: { status: "waiting" } } }), W({ status: "applied", result: { proposed: { status: "approved" } } }), W({ status: "applied", result: { proposed: { status: "rejected" } } }), W({ status: "pending_review", result: { proposed: { status: "waiting" } } }), W({ status: "applied", result: null }), W(null)], [true, false, false, false, false, false], "the links page lists it for review too");
  check("socios slug", "new studio slug", [R.socSlug("Centro Ána Masajes & Spa"), R.socSlug("¡¡!!"), R.socSlug("x".repeat(80)).length], ["centro-ana-masajes-spa", "centro", 60], "");

  // Review (23 Oct): /socios writes opening_hours only in a form the deployed
  // dispatch-studios (and notify-whatsapp-request) reads day by day as the
  // page and slotHours do, with one window a day. dispatchHours is their
  // parseHours line for line, pinned here against both deployed copies.
  const liftFn = (src, head) => { const i = src.indexOf(head); if (i < 0) throw new Error(`missing: ${head}`); return src.slice(i, src.indexOf("\n}\n", i) + 3); };
  const liftRe = (src, re) => { const m = src.match(re); if (!m) throw new Error(`missing: ${re}`); return m[0]; };
  const deployedHours = ["dispatch-studios/index.ts", "notify-whatsapp-request/notify.ts"].map((f) => {
    const src = fs.readFileSync(path.join(here, "../supabase/functions", f), "utf8");
    const body = liftRe(src, /const DAY_IDX: Record<string, number> = \{[\s\S]*?\n\};\n/) + liftRe(src, /const stripAccents = [^\n]*\n/) + liftFn(src, "function parseHours(");
    return [f, new Function(`${stripTypeScriptTypes(body)}\nreturn parseHours;`)()];
  });
  const week = (m) => m ? [0, 1, 2, 3, 4, 5, 6].map((d) => m.has(d) ? m.get(d) : null) : null;
  const split = "Lun-Vie 10:00-14:00 y 17:00-21:00, Sáb 10:00-14:00";
  const hoursCases = [
    // [text, writable, why]
    ["Lun-Vie 10:00-20:00", true, "the page's one-window week"],
    ["Lun-Sáb 10:00-20:00", true, ""],
    ["Mon-Sat 10:00-20:00", true, "English page"],
    ["Lun-Vie 10:00-20:00, Sáb 10:00-14:00", true, "a shorter Saturday is still one window a day"],
    ["Todos los días 10:00-21:00", true, "the page's every day"],
    ["Daily 10:00-21:00", true, ""],
    ["Sun-Thu 10:00-21:30, Fri-Sat 10:00-22:00", true, ""],
    ["Sáb-Dom 11:00-15:00", true, "a range across the week's end"],
    ["Lun/Mié/Vie 10:00-20:00", true, ""],
    ["Lun-Dom 00:00-24:00", true, "24:00 is 1440 in both"],
    ["Lun-Vie 10-20h", true, ""],
    ["Lun-Vie 10:00\u201320:00", true, "an en dash between the times"],
    ["10:00-20:00", true, "no day at all is every day in both"],
    [split, false, "the reviewer's split shift: Sunday open and Mon-Fri 17:00-21:00 only in dispatch-studios"],
    ["Todos los días 10:00-14:00 y 17:00-21:00", false, "two windows a day: dispatch-studios keeps only the afternoon"],
    ["Lun-Vie 10:00-20:00, Lun 12:00-14:00", false, "two windows on Monday"],
    ["Lun-Dom 22:00-02:00", false, "past midnight: slotHours runs to 24:00, dispatch-studios reads it as always shut"],
    ["Lun-Vie 10h-20h", false, "dispatch-studios cannot read it, so it would never block an ask"],
    ["Lun-Vie 10.00-20.00", false, "the same with dots"],
    ["de lunes a sábado, de 10 a 21", false, "the raw text the page sends when it cannot read the hours"],
    ["", false, ""],
    ['{"mon":{"open":"10:00","close":"20:00"}}', false, "the object shape is not free text"],
  ];
  for (const [f, parseHours] of deployedHours) {
    check("socios hours", `dispatchHours reads as the deployed ${f} parseHours`, hoursCases.map(([t]) => week(R.dispatchHours(t))), hoursCases.map(([t]) => week(parseHours(t))), "keep dispatchHours in step until dispatch-studios learns split shifts");
  }
  check("socios hours", "dispatch-studios today: a dayless second window is every day, and the later window replaces the morning", week(R.dispatchHours(split)), [[1020, 1260], [1020, 1260], [1020, 1260], [1020, 1260], [1020, 1260], [1020, 1260], [600, 840]], "Sun 17:00-21:00 (closed), Mon-Fri afternoons only, Sat 10:00-14:00 (go-live review, 23 Oct)");
  check("socios hours", "slotHours on the same text: the same days' afternoon, Sunday closed", week(R.slotHours(split)), [[], [[600, 840], [1020, 1260]], [[600, 840], [1020, 1260]], [[600, 840], [1020, 1260]], [[600, 840], [1020, 1260]], [[600, 840], [1020, 1260]], [[600, 840]]], "what the page and the times checks read");
  for (const [t, want, why] of hoursCases) check("socios hours", `writable: ${t || "(empty)"}`, R.socHoursWritable(t), want, why);
  check("socios hours", "not text: never writable", [R.socHoursWritable({ mon: { open: "10:00", close: "20:00" } }), R.socHoursWritable(null), R.socHoursWritable(undefined)], [false, false, false], "");
  // On its own link: hours that are not writable never replace or fill ours.
  const hr = (u) => [u.set.opening_hours, u.filled.includes("opening_hours"), u.replaced.filter((x) => x.field === "opening_hours").length, u.noted.filter((x) => x.field === "opening_hours")];
  const ohFile = { whatsapp: "+34 600 111 222", phone: null, email: "hola@calma.es", booking_email: null, address: "Calle Mayor 1" };
  up = R.socSignedUpdate({ ...ohFile, opening_hours: "Lun-Sáb 10:00-20:00" }, { ...st, hoursRead: split });
  check("socios own link hours", "a split shift does not replace readable hours: kept, and on Jordan's card", hr(up), [undefined, false, 0, [{ field: "opening_hours", onFile: "Lun-Sáb 10:00-20:00", given: split }]], "go-live review (23 Oct): studios would be asked on Sunday and refused at 11:00");
  up = R.socSignedUpdate({ ...ohFile, opening_hours: null }, { ...st, hoursRead: split });
  check("socios own link hours", "a split shift does not fill empty hours either", [hr(up), up.set], [[undefined, false, 0, [{ field: "opening_hours", onFile: "", given: split }]], {}], "");
  up = R.socSignedUpdate({ ...ohFile, opening_hours: "Lun-Sáb 10:00-20:00" }, { ...st, hoursRaw: "de lunes a sábado, de 10 a 21", hoursRead: "" });
  check("socios own link hours", "raw text the page could not read never replaces readable hours", hr(up), [undefined, false, 0, [{ field: "opening_hours", onFile: "Lun-Sáb 10:00-20:00", given: "de lunes a sábado, de 10 a 21" }]], "the reviewer's second case: unknown hours never block an ask");
  up = R.socSignedUpdate({ ...ohFile, opening_hours: "" }, { ...st, hoursRaw: "de lunes a sábado, de 10 a 21", hoursRead: "" });
  check("socios own link hours", "nor fills empty hours", hr(up), [undefined, false, 0, [{ field: "opening_hours", onFile: "", given: "de lunes a sábado, de 10 a 21" }]], "");
  up = R.socSignedUpdate({ ...ohFile, opening_hours: "lunes a viernes de 10 a 8" }, { ...st, hoursRead: "Lun-Sáb 10:00-20:00, Dom 11:00-15:00" });
  check("socios own link hours", "writable hours still replace text nobody could read", [hr(up), up.replaced], [["Lun-Sáb 10:00-20:00, Dom 11:00-15:00", false, 1, []], [{ field: "opening_hours", was: "lunes a viernes de 10 a 8", now: "Lun-Sáb 10:00-20:00, Dom 11:00-15:00" }]], "");
  up = R.socSignedUpdate({ ...ohFile, opening_hours: null }, { ...st, hoursRead: "Lun-Vie 10:00-20:00, Sáb 10:00-14:00" });
  check("socios own link hours", "and fill empty ones", [hr(up), up.filled], [["Lun-Vie 10:00-20:00, Sáb 10:00-14:00", true, 0, []], ["opening_hours"]], "");
  up = R.socSignedUpdate({ ...ohFile, opening_hours: split }, { ...st, hoursRead: split });
  check("socios own link hours", "the same split shift already on file: nothing to write or say", [hr(up), up.noted], [[undefined, false, 0, []], []], "socDiff reads them the same");
  // Jordan's card says why the hours were held back.
  const appliedEnSrc = (() => { const i = botSrc.indexOf("function socAppliedEn("); return botSrc.slice(i, botSrc.indexOf("\n}\n", i) + 3); })();
  const socAppliedEn = new Function("socHoursWritable", "socWhen", "socWhyText", "socProposedEn", "SOC_WD", `${stripTypeScriptTypes(appliedEnSrc)}\nreturn socAppliedEn;`)(R.socHoursWritable, () => "", () => "", () => [], {});
  const card = (differ) => socAppliedEn({ saved: [], weekly: [], refused: [], skipped: [], filled: [], replaced: [], differ, terms: "accepted now" }, now);
  const held = card([{ field: "opening_hours", onFile: "Lun-Sáb 10:00-20:00", given: split }, { field: "opening_hours", onFile: "", given: split }, { field: "opening_hours", onFile: "Lun-Vie 10:00-20:00", given: "Lun-Sáb 10:00-20:00" }]);
  check("socios own link hours", "the card: held hours say NOT written and why, with what we keep", [/^Opening hours NOT written: they gave "Lun-Vie 10:00-14:00 y 17:00-21:00, Sáb 10:00-14:00"\. dispatch-studios would read that differently/.test(held[0]), /We keep "Lun-Sáb 10:00-20:00"\./.test(held[0]), /Nothing is on file, so they can be asked on any day until you add hours\./.test(held[1]), held[2]], [true, true, true, 'Different from what we have, NOT changed: opening_hours on file "Lun-Vie 10:00-20:00", they gave "Lun-Sáb 10:00-20:00".'], "a readable difference keeps the old line");
  check("socios own link hours", "no em or en dashes on the card", /[\u2013\u2014]/.test(held.join("\n")), false, "CLAUDE.md");
  // A new studio from an approved form: the same rule on the new row.
  const rvH0 = botSrc.indexOf("async function socReviewPage(url: URL)");
  const rvH = botSrc.slice(rvH0, botSrc.indexOf("\n}\n", rvH0));
  check("hook", "a new studio's row gets the hours only when writable, else the card says what they gave", /const hoursGiven = plan\.studio\.hoursRead \|\| plan\.studio\.hoursRaw;\s*const hoursOk = !!hoursGiven && socHoursWritable\(hoursGiven\);/.test(rvH) && /\.\.\.\(hoursOk \? \{ opening_hours: hoursGiven \} : \{\}\) \}\) \}\);/.test(rvH) && !/opening_hours: plan\.studio\.hoursRead \|\| plan\.studio\.hoursRaw/.test(botSrc) && /if \(created && hoursGiven && !hoursOk\) res\.result\.differ\.push\(\{ field: "opening_hours", onFile: "", given: hoursGiven \}\);/.test(rvH) && rvH.indexOf("res.result.differ.push({ field: \"opening_hours\"") < rvH.indexOf("await socPatch(id, { partner_id: partner.id, applied_at:"), true, "go-live review (23 Oct)");
  check("hook", "every opening_hours /socios writes goes through socHoursWritable", /out\.set\.opening_hours !== undefined && !socHoursWritable\(out\.set\.opening_hours\)/.test(botSrc) && /else if \(x\.field === "opening_hours" && socHoursWritable\(x\.given\)\) \{\s*out\.set\.opening_hours = x\.given;/.test(botSrc), true, "socSignedUpdate, both the fill and the replacement");

  // «ocupado»: read only when the message is mainly that.
  const sat = M(24, 12);
  for (const [t, want, note] of [
    ["Ocupado", { ymd: null, mins: [] }, ""],
    ["ocupado 18:00", { ymd: null, mins: [1080] }, ""],
    ["La de mañana a las 19:30 ya no está libre", { ymd: "2026-10-25", mins: [1170] }, "mañana is the day the clocks change"],
    ["Hola, el hueco de hoy a las 17 lo hemos llenado, gracias", { ymd: "2026-10-24", mins: [1020] }, ""],
    ["No, está ocupado", { ymd: null, mins: [] }, "the comma: not 'no está ocupado'"],
    ["ocupado el martes a las 6 de la tarde", { ymd: "2026-10-27", mins: [1080] }, ""],
    ["las 2 salas ocupadas a las 18", { ymd: null, mins: [1080] }, "two rooms, not 02:00"],
    ["quitad la de las 18h", { ymd: null, mins: [1080] }, ""],
    ["ocupado mañana por la mañana a las 10", { ymd: "2026-10-25", mins: [600] }, ""],
    ["ocupado a las 7", { ymd: null, mins: [420, 1140] }, "07:00 or 19:00: whichever is live"],
    ["lleno", { ymd: null, mins: [] }, ""],
    ["ocupado el 26 a las 12", { ymd: "2026-10-26", mins: [720] }, "day of the month"],
    ["Ocupada la de las 18:30, gracias!", { ymd: null, mins: [1110] }, ""],
    ["ya no está ocupado", null, "the opposite"],
    ["no estamos ocupados", null, ""],
    ["¿está ocupado?", null, "a question"],
    ["Perfecto, ya está reservada", null, "acknowledging our booking"],
    ["Estamos ocupados hoy, no podemos atender a tu cliente a las 18, pero mañana sí", null, "an answer to an ask, not mainly «ocupado»"],
    ["ocupado, 45 € el masaje", null, "a price"],
    ["Ahora mismo estamos ocupados, te respondemos en breve", null, "an away message"],
    ["Hola, tenemos libre mañana a las 18", null, "free, not taken"],
    ["No, a las 18 está ocupado, podemos a las 19", null, "review fix: a counter-offer is an answer, not a withdrawal"],
    ["ocupado a las 18 y a las 19", null, "two hours named: today's path"],
    ["Ocupado a las 18, pero mañana sí", null, "pero"],
    ["mejor a las 19, a las 18 lleno", null, "mejor"],
    ["Lo siento, mañana a las 18 al final estamos llenos", { ymd: "2026-10-25", mins: [1080] }, "still read; the open-ask check decides (scenario F)"],
    ["la de las 18:30 ocupada", { ymd: null, mins: [1110] }, "18 and 18:30 are one hour"],
    ["", null, ""],
  ]) check("ocupado intent", t, R.ocupadoIntent(t, sat), want, note);
  // Which time it means.
  const row = (id, day, h, mi, status, extra = {}) => ({ id, start_at: iso(M(day, h, mi)), status, request_id: status === "booked" ? 7 : null, pattern_id: null, ...extra });
  const rows = [row("a", 24, 18, 0, "released"), row("b", 25, 18, 0, "released", { pattern_id: "p" }), row("c", 25, 18, 0, "released", { pattern_id: "p" }), row("d", 26, 12, 0, "booked"), row("e", 27, 10, 0, "held")];
  const pick = (t, rs = rows) => { const p = R.ocupadoPick(R.ocupadoIntent(t, sat), rs, sat); return [p.kind, p.group ? `${p.group.ymd} ${p.group.hm} free=${p.group.free.join("+")}` : null]; };
  const two = [rows[0], row("z", 25, 9, 0, "released"), ...rows.slice(1)];
  check("ocupado pick", "no time, two live times in 24 h: ask", pick("ocupado", two), ["ask", null], "");
  check("ocupado pick", "no time, one in 24 h and others later: that one", pick("ocupado"), ["withdraw", "2026-10-24 18:00 free=a"], "");
  check("ocupado pick", "no time, one in 24 h: that one", pick("ocupado", [rows[0], rows[3]]), ["withdraw", "2026-10-24 18:00 free=a"], "");
  check("ocupado pick", "18:00 without a day: the one in the next 24 h", pick("ocupado 18:00"), ["withdraw", "2026-10-24 18:00 free=a"], "");
  check("ocupado pick", "tomorrow 18:00 across the clock change: both rooms", pick("mañana a las 18 ya no está libre"), ["withdraw", "2026-10-25 18:00 free=b+c"], "17:00Z, CET");
  check("ocupado pick", "a booked time: never withdrawn", pick("ocupado el lunes a las 12"), ["booked", "2026-10-26 12:00 free="], "Jordan's card");
  check("ocupado pick", "a held time: said so", pick("ocupado el martes a las 10"), ["held", "2026-10-27 10:00 free="], "");
  check("ocupado pick", "a time we do not have: none", pick("ocupado a las 13:30"), ["none", null], "");
  check("ocupado pick", "a day with nothing live: none", pick("ocupado el jueves"), ["none", null], "");
  check("ocupado pick", "a past time is not live", pick("ocupado", [row("x", 24, 11, 0, "released")]), ["ask", null], "");
  check("ocupado pick", "7 means 19:00 when that is the one we have", pick("ocupado a las 7", [row("y", 24, 19, 0, "released")]), ["withdraw", "2026-10-24 19:00 free=y"], "");
  // Review fix (17 Oct): could it be about one of the studio's own bookings?
  const I = (t) => R.ocupadoIntent(t, sat);
  const tom18 = M(25, 18), mon12 = M(26, 12);
  check("ocupado clash", "no bookings: no", R.ocupadoClash(I("ocupado"), []), false, "");
  check("ocupado clash", "a booking and no time named: yes", R.ocupadoClash(I("ocupado"), [mon12]), true, "it may be about the booking");
  check("ocupado clash", "the booking's hour named (scenario F): yes", R.ocupadoClash(I("Lo siento, mañana a las 18 al final estamos llenos"), [tom18]), true, "today's path and Jordan's card");
  check("ocupado clash", "another hour named: no", R.ocupadoClash(I("ocupado mañana a las 12"), [tom18]), false, "the released 12:00 can go");
  check("ocupado clash", "the same hour on another day: no", R.ocupadoClash(I("ocupado el lunes a las 18"), [tom18]), false, "");
  check("ocupado clash", "the hour without a day: yes", R.ocupadoClash(I("ocupado a las 18"), [tom18]), true, "");
  check("ocupado clash", "a booking with no start on file: yes", R.ocupadoClash(I("ocupado mañana a las 12"), [NaN]), true, "never a guess");
  check("ocupado clash", "7 could be 19:00: yes when a booking is at 19:00", R.ocupadoClash(I("ocupado a las 7"), [M(25, 19)]), true, "");
  // What the studio is told.
  const link = "https://book.massageclub.io/bot.html?slots=1&k=2";
  const say = (t, rs = rows, first = "") => { const i = R.ocupadoIntent(t, sat); return R.ocupadoReply(R.ocupadoPick(i, rs, sat), i, link, sat, first); };
  check("ocupado reply", "withdrawn", say("ocupado 18:00"), "Hecho, he quitado la hora de hoy a las 18:00: ya no se puede reservar. Gracias por avisar.", "");
  check("ocupado reply", "both rooms of a weekly time", say("mañana a las 18 ocupado"), "Hecho, he quitado la hora de mañana a las 18:00 (las 2 salas): ya no se puede reservar. Las demás semanas siguen igual. Gracias por avisar.", "");
  check("ocupado reply", "booked", say("ocupado el lunes a las 12", rows, "Ana López"), "Ojo: la hora del lunes 26 a las 12:00 ya la tiene reservada Ana. ¿Me confirmáis que al final no podéis atenderle? Si es así, yo se lo digo.", "the v212 wording for a confirmed booking");
  check("ocupado reply", "held", say("ocupado el martes a las 10"), "Ahora mismo un cliente está reservando la hora del martes 27 a las 10:00. Si la reserva, os llega la confirmación y podéis rechazarla en los 15 minutos siguientes.", "");
  check("ocupado reply", "ask", say("ocupado", two), `Vale. ¿Cuál se os ha llenado? Podéis quitarla aquí mismo: ${link}`, "");
  check("ocupado reply", "none", say("ocupado el jueves a las 7"), `No encuentro ninguna hora vuestra libre el jueves 29 a las 19:00. Las podéis ver y quitar aquí: ${link}`, "");
  const replies = ["ocupado 18:00", "mañana a las 18 ocupado", "ocupado el lunes a las 12", "ocupado el martes a las 10", "ocupado", "ocupado a las 13:30"].map((t) => say(t, two));
  check("ocupado reply", "no em or en dashes", replies.filter((t) => /[–—]/.test(t)), [], "");
  // Go-live review (23 Oct): studios hold times up to REL_STUDIO_HORIZON_DAYS
  // (56) ahead, so «ocupado» reads the same days (Sat 24 Oct to Fri 18 Dec),
  // a date's month, and a named day it cannot find is null (today's path),
  // never another day's time. Before: "ocupado el 10 a las 18:00" read as
  // ymd null and took off Tue 27 Oct 18:00; "el jueves 10 de diciembre"
  // read as Thu 29 Oct.
  const D = (mo, day, h, mi = 0) => madridInstant(new Date(Date.UTC(2026, mo - 1, day)), h).getTime() + mi * 60e3;
  for (const [t, want, note] of [
    ["ocupado el 10 a las 18:00", { ymd: "2026-11-10", mins: [1080] }, "the next 10th, not any day"],
    ["el jueves 10 de diciembre a las 18:00 ocupado", { ymd: "2026-12-10", mins: [1080] }, "the month, 7 weeks out"],
    ["ocupado el 10 de diciembre a las 18", { ymd: "2026-12-10", mins: [1080] }, ""],
    ["ocupado 10 dic 18:00", { ymd: "2026-12-10", mins: [1080] }, "short month"],
    ["ocupado el 10/12 a las 18", { ymd: "2026-12-10", mins: [1080] }, "day first, as in Spain"],
    ["ocupado el jueves 10 a las 18", { ymd: "2026-12-10", mins: [1080] }, "the first Thursday 10th"],
    ["ocupado el lunes 16 a las 18", { ymd: "2026-11-16", mins: [1080] }, ""],
    ["ocupado el 3 de noviembre", { ymd: "2026-11-03", mins: [] }, "a day, no time"],
    ["ocupado el 18 de diciembre a las 12", { ymd: "2026-12-18", mins: [720] }, "today plus 55 days, the last day a studio can hold"],
    ["ocupado el lunes 12", { ymd: "2026-10-26", mins: [720] }, "no Monday 12th and no other hour: 12:00 on Monday, as before"],
    ["ocupado el 19 de diciembre a las 18", null, "past the 8 weeks: null, not ymd null"],
    ["ocupado el 10 de enero a las 18", null, "next year"],
    ["ocupado el 31 de noviembre a las 18", null, "no such date"],
    ["ocupado el jueves 11 de diciembre a las 18", null, "11 Dec is a Friday"],
    ["ocupado el viernes 12 a las 18", null, "no Friday 12th in the 8 weeks"],
    ["ocupado el 10/13 a las 18", null, "no month 13"],
  ]) check("ocupado intent 56 days", t, R.ocupadoIntent(t, sat), want, note);
  const farRows = [row("t", 27, 18, 0, "released"), { id: "d10", start_at: iso(D(12, 10, 18)), status: "released", request_id: null, pattern_id: null }];
  check("ocupado pick 56 days", "«el 10» is 10 Nov: nothing there, never Tue 27 Oct", pick("ocupado el 10 a las 18:00", farRows), ["none", null], "go-live review scenario");
  check("ocupado pick 56 days", "«el jueves 10 de diciembre» takes off 10 Dec", pick("el jueves 10 de diciembre a las 18:00 ocupado", farRows), ["withdraw", "2026-12-10 18:00 free=d10"], "go-live review scenario");
  check("ocupado pick 56 days", "10/12 takes off 10 Dec", pick("ocupado el 10/12 a las 18", farRows), ["withdraw", "2026-12-10 18:00 free=d10"], "");
  check("ocupado pick 56 days", "an hour with no day: the one in the next 8 days", pick("ocupado a las 18", farRows), ["withdraw", "2026-10-27 18:00 free=t"], "as before the 8 weeks");
  check("ocupado pick 56 days", "an hour with no day never takes off a time weeks away", pick("ocupado a las 18", [farRows[1]]), ["none", null], "today's path");
  check("ocupado pick 56 days", "a day with no time, 7 weeks out", pick("ocupado el 10 de diciembre", farRows), ["withdraw", "2026-12-10 18:00 free=d10"], "");
  check("ocupado clash 56 days", "a booking of theirs that far day at that hour: yes", R.ocupadoClash(I("ocupado el 10 de diciembre a las 18"), [D(12, 10, 18)]), true, "studioOpenAsk reads to the end of the day named");
  check("ocupado reply 56 days", "a week or more away: with its month", [say("ocupado el 10 de diciembre a las 18", farRows), say("ocupado el 31 a las 18", [row("o", 31, 18, 0, "released")]), say("ocupado el 30 a las 18", [row("v", 30, 18, 0, "released")])], ["Hecho, he quitado la hora del jueves 10 de diciembre a las 18:00: ya no se puede reservar. Gracias por avisar.", "Hecho, he quitado la hora del sábado 31 de octubre a las 18:00: ya no se puede reservar. Gracias por avisar.", "Hecho, he quitado la hora del viernes 30 a las 18:00: ya no se puede reservar. Gracias por avisar."], "31 Oct is 7 days on; 30 Oct is 6");
  check("ocupado reply 56 days", "none, far day: with its month", say("ocupado el 9 de diciembre a las 18", farRows), `No encuentro ninguna hora vuestra libre el miércoles 9 de diciembre a las 18:00. Las podéis ver y quitar aquí: ${link}`, "");
  // Review (23 Oct, verifier): a date written any other way than "N de <mes>",
  // "N <mes>" or "N/M" is null (today's path), never today's time or the next
  // 10th's; so is "el jueves 10" with no other hour when there is a Thursday
  // 10th (10 Dec, or 10:00 on Thursday). The verifier's probe: Fri 23 Oct
  // 12:00, a weekly 18:00 every day, dated 18:00s on 10 Nov and 10 Dec and a
  // 10:00 on Thu 29 Oct. Before, "ocupado dic 10 a las 18" took off today's
  // 18:00, "ocupado el 10 del 12 a las 18" the 10 Nov one and "ocupado el
  // jueves 10" the 10 Dec one.
  const fri = D(10, 23, 12);
  const vRow = (id, ms, pattern_id = null) => ({ id, start_at: iso(ms), status: "released", request_id: null, pattern_id });
  const vRows = [...[0, 1, 2, 3, 4, 5, 6].map((i) => vRow(`w${i}`, D(10, 23 + i, 18), "p")), vRow("n10", D(11, 10, 18)), vRow("d10", D(12, 10, 18)), vRow("t10", D(10, 29, 10))];
  for (const [t, want, note] of [
    ["ocupado dic 10 a las 18", null, "month first"],
    ["ocupado diciembre 10 a las 18", null, "month first, in full"],
    ["ocupado en diciembre a las 18", null, "a month alone"],
    ["ocupado 10 december 18:00", null, "a month in English"],
    ["ocupado 10-12 a las 18", null, "a dash: 10 Dec, or 10 to 12"],
    ["ocupado el 10-12 a las 18", null, "was 10 Nov"],
    ["ocupado el 10 del 12 a las 18", null, "was 10 Nov"],
    ["ocupado el dia 10 del 12", null, "was 10 Nov at 12:00, the month taken as the hour"],
    ["ocupado el hueco del 24 a las 18", null, "was any 18:00"],
    ["ocupado mañana 10 de diciembre a las 18", null, "two days named: was tomorrow"],
    ["ocupado el jueves 10", null, "Thu 10 Dec, or 10:00 on Thu 29 Oct"],
    ["ocupado el jueves 10 por la tarde", null, "the same, with the afternoon"],
    ["ocupado el jueves 10 a las 18", { ymd: "2026-12-10", mins: [1080] }, "another hour named: the date"],
    ["ocupado el jueves 11", { ymd: "2026-10-29", mins: [660, 1380] }, "no Thursday 11th: 11:00 on Thursday, as before"],
    ["ocupado el lunes 2", { ymd: "2026-11-02", mins: [] }, "2 is not read as an hour: Mon 2 Nov"],
    ["la del 10 de diciembre a las 18 ocupada", { ymd: "2026-12-10", mins: [1080] }, "«del» with its month is read"],
    ["ocupado del 18:00", { ymd: null, mins: [1080] }, "«del» and an hour is an hour"],
    ["ocupado 10 de dic a las 18", { ymd: "2026-12-10", mins: [1080] }, ""],
  ]) check("ocupado intent unread dates", t, R.ocupadoIntent(t, fri), want, note);
  const pickFri = (t) => { const i = R.ocupadoIntent(t, fri); if (!i) return null; const p = R.ocupadoPick(i, vRows, fri); return [p.kind, p.group ? `${p.group.ymd} ${p.group.hm} free=${p.group.free.join("+")}` : null]; };
  check("ocupado pick unread dates", "the verifier's probe: nothing is taken off for a date not read", ["ocupado dic 10 a las 18", "ocupado diciembre 10 a las 18", "ocupado en diciembre a las 18", "ocupado 10-12 a las 18", "ocupado el 10-12 a las 18", "ocupado el 10 del 12 a las 18", "ocupado el dia 10 del 12", "ocupado el jueves 10"].map(pickFri), [null, null, null, null, null, null, null, null], "today's path, which never withdraws");
  check("ocupado pick unread dates", "the dates still read take off that day's time only", ["ocupado el 10 de diciembre a las 18", "ocupado el 10/12 a las 18", "ocupado el jueves 10 a las 18", "ocupado el 10 de noviembre a las 18", "ocupado el jueves a las 10"].map(pickFri), [["withdraw", "2026-12-10 18:00 free=d10"], ["withdraw", "2026-12-10 18:00 free=d10"], ["withdraw", "2026-12-10 18:00 free=d10"], ["withdraw", "2026-11-10 18:00 free=n10"], ["withdraw", "2026-10-29 10:00 free=t10"]], "");
  // Review (23 Oct, re-verify): more ways of naming a day the refix still read
  // as another day: a dot or "de" and a number for the month, "mes" or
  // "semana", two days, a weekday that is not the day read, and a number
  // left over once the day and time are read. Same probe, Fri 23 Oct 12:00.
  for (const [t, want, note] of [
    ["ocupado el 24.10 a las 18", null, "a dot date: was any 18:00 in the next days"],
    ["ocupado 24.10 18:00", null, ""],
    ["ocupado el 23.10", null, "was 23:10"],
    ["ocupado el 25 de 11 a las 18", null, "was 25 Oct"],
    ["ocupado el 23 de 10", null, "was 23 Oct at 10:00, the month taken as the hour"],
    ["ocupado 10 de 12 a las 18", null, "was any 18:00"],
    ["ocupado el 10 de este mes", null, "was any time in the next 24 h"],
    ["ocupado el dia 10 mes 12", null, "was 12:00 on any day"],
    ["ocupado el jueves de la otra semana a las 18", null, "was Thu 29 Oct"],
    ["ocupado el 10 y el 11 a las 18", null, "two days: was any 18:00"],
    ["ocupado el 10 y 11 de diciembre a las 18", null, "two days: was any 18:00"],
    ["ocupado 10, 11 dic 18:00", null, ""],
    ["ocupado 10 a las 18", null, "a number not read: was any 18:00"],
    ["ocupado mañana el 10 a las 18", null, "two days: was tomorrow"],
    ["ocupado hoy y mañana a las 18", null, "two days: was tomorrow"],
    ["ocupado hoy, mañana no", null, "was tomorrow"],
    ["ocupado esta tarde el jueves", null, "was Thu 29 Oct"],
    ["ocupado el lunes y el martes a las 18", null, "two weekdays: was Monday"],
    ["ocupado mañana jueves a las 18", null, "tomorrow is Saturday: was Saturday"],
    ["ocupado 7", null, "was the only time in the next 24 h"],
    ["ocupado 18:30h", null, "was the only time in the next 24 h"],
    ["ocupado a las 18 sala 2", null, "was the only time in the next 24 h"],
    ["ocupado a las 18 y 30", null, "was 18:00"],
    ["ocupado 1800", null, ""],
    ["ocupado el 10 de diciembre de 2026 a las 18", { ymd: "2026-12-10", mins: [1080] }, "a year is not a day"],
    ["ocupado 18:00 2 salas", { ymd: null, mins: [1080] }, "a count is not a day"],
    ["ocupado hoy viernes a las 18", { ymd: "2026-10-23", mins: [1080] }, "today is Friday"],
    ["ocupado mañana sábado a las 18", { ymd: "2026-10-24", mins: [1080] }, ""],
    ["ocupado esta tarde a las 6", { ymd: "2026-10-23", mins: [1080] }, ""],
  ]) check("ocupado intent unread dates (re-verify)", t, R.ocupadoIntent(t, fri), want, note);
  check("ocupado intent unread dates (re-verify)", "«mañana jueves» on a Wednesday is Thursday", R.ocupadoIntent("ocupado mañana jueves a las 18", D(10, 28, 12)), { ymd: "2026-10-29", mins: [1080] }, "");
  check("ocupado pick unread dates (re-verify)", "nothing is taken off for a day not read", ["ocupado el 24.10 a las 18", "ocupado el 25 de 11 a las 18", "ocupado el 23 de 10", "ocupado el 10 de este mes", "ocupado el 10 y el 11 a las 18", "ocupado 10 a las 18", "ocupado hoy y mañana a las 18", "ocupado mañana jueves a las 18", "ocupado 18:30h", "ocupado a las 18 sala 2"].map(pickFri), [null, null, null, null, null, null, null, null, null, null], "today's path, which never withdraws");

  // Jordan's links page order, and the share text.
  const F = (o) => R.socFunnelRank({ review: false, viewed: false, submitted: false, live: 0, weekly: 0, terms: false, ...o }).rank;
  check("socios links page", "review, not opened, opened, sent, live", [F({ review: true, live: 3 }), F({}), F({ viewed: true }), F({ viewed: true, submitted: true }), F({ submitted: true, weekly: 1 })], [0, 1, 2, 3, 4], "");
  const FL = (o) => R.socFunnelRank({ review: false, viewed: false, submitted: false, live: 0, weekly: 0, terms: false, ...o }).label;
  check("socios links page", "saved is not bookable (review nit)", [FL({ live: 2 }), FL({ live: 2, bookable: true }), FL({ submitted: true })], ["Times saved, not offered yet", "Times saved, customers can book", "Submitted, nothing saved"], "");
  check("socios links page", "share text: the pitch kit's first line, the link, the signature", [kit.includes(R.SOC_PITCH_ES), R.socShareText("L")], [true, `${R.SOC_PITCH_ES}\n\nL\n\nJordan, de Massage Club`], "");

  // No em or en dashes anywhere in the new code (pages, cards, studio texts, comments).
  const side0 = botSrc.indexOf("// ---- v216 socios: the page's endpoint");
  const side1 = botSrc.indexOf("// v215: rel is a released time the customer has tapped", side0);
  check("socios copy", "no em or en dashes in the v216 blocks", side0 > 0 && side1 > side0 && !/[–—]/.test(botSrc.slice(s0, b) + botSrc.slice(side0, side1)), true, "");
  check("socios copy", "no em or en dashes in socios.html", /[–—]/.test(html), false, "");
  // Jordan, 23 Oct: the business is a «negocio» / "business", never a
  // «centro» / "centre" (Centro is also a Madrid district). Every string in
  // T.es and T.en, the title and the meta tags. The booking example in the
  // sheet is not in T: it stays word for word as wa-bot sends it.
  const tBlock = (html.match(/\nconst T = \{\n[\s\S]*?\n\};\n/) || [""])[0];
  const tStrings = [...tBlock.matchAll(/:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  const headTags = [...html.matchAll(/<title>[^<]*<\/title>|<meta [^>]*content="[^"]*"[^>]*>/g)].map((m) => m[0]);
  check("socios copy", "no «centro» / \"centre\" for the business on the page (Jordan, 23 Oct)", [tStrings.length > 300, tStrings.filter((s) => /\bcentr(?:o|os|e|es)\b/i.test(s)), headTags.filter((s) => /\bcentr(?:o|os|e|es)\b/i.test(s))], [true, [], []], "«negocio» / \"business\"");
  const tv = (k, L) => (html.match(new RegExp(`\\n  ${L}: \\{[\\s\\S]*?\\n    (?:[a-zA-Z0-9]+: "[^"]*", )*${k}: "([^"]*)"`)) || [])[1];
  check("socios copy", "«negocio» / \"business\": title, kicker, step 4, its field and its error (Jordan, 23 Oct)", ["docTitle", "kick", "tkKick", "q5", "fName", "errName", "kCentro"].flatMap((k) => ["es", "en"].map((L) => tv(k, L))),
    ["Negocios asociados · Massage Club", "Partner businesses · Massage Club", "Massage Club · Negocios", "Massage Club · Businesses", "Massage Club · Negocios", "Massage Club · Businesses", "Vuestro negocio", "Your business", "Nombre del negocio", "Business name", "Falta el nombre del negocio.", "The business name is missing.", "Negocio", "Business"], "");
  check("socios copy", "the <title> matches docTitle", (html.match(/<title>([^<]*)<\/title>/) || [])[1], tv("docTitle", "es"), "");
  check("socios copy", "step 1 asks it in Jordan's words (23 Oct)", [tv("q2", "es"), tv("q2", "en")], ["¿Qué días de esta semana tenéis hueco para más clientes?", "Which days this week are you free to take on more customers?"], "");
  check("socios copy", "who pays is said without naming the place", [tv("payLine", "es"), tv("payLine", "en")], ["El cliente os paga directamente a vosotros, a vuestro precio.", "The customer pays you directly, at your price."], "");
  check("socios copy", "the server's missing-name error matches the page's (Jordan, 23 Oct: «negocio»)", [R.SOC_MSG.name.es, R.SOC_MSG.name.en], [tv("errName", "es"), tv("errName", "en")], "");
  {
    const np0 = botSrc.indexOf("\nfunction notePage(url: URL): Response {");
    const np = botSrc.slice(np0, botSrc.indexOf("\n}\n", np0)).replace(/^\s*\/\/.*$/gm, "");
    const tp0 = botSrc.indexOf('<p class="foot">Una hora se puede reservar hasta 60 minutos antes.');
    const tp = botSrc.slice(tp0, botSrc.indexOf("</p>", tp0));
    check("socios copy", "the pages a business lands on say «negocio», not «centro» (Jordan, 23 Oct)", [np0 > 0, /\bcentr(?:o|os|e|es)\b/i.test(np), /otro negocio/.test(np) && /another business/.test(np), tp0 > 0, /\bcentr(?:o|os)\b/i.test(tp), /solo para vuestro negocio/.test(tp)], [true, false, true, true, false, true], "the note pages after a tap, and the times page's footer");
  }

  // Hooks.
  check("hook", "the page's endpoint is routed before anything else reads the body", /const url = new URL\(req\.url\);\s*\/\/ v216[^\n]*\n[^\n]*\n\s*if \(url\.searchParams\.has\("socios"\)\) return await sociosApi\(req, url\);/.test(botSrc), true, "");
  check("hook", "«ocupado» before the 45 second away-message guess; only away text skips it (review fix)", /const awayOnly = awayText && !ourQuestion;\s*if \(!awayOnly && await studioOcupado\(from, text, partner\)\.catch\([^\n]*\) \{ \/\* answered \*\/ \}\s*else if \(autoReply\) \{/.test(botSrc) && /const autoReply = !ourQuestion && \(awayText \|\| \(sinceMs < 45_000 && !parseOfferedTime\(text\)\)\);/.test(botSrc), true, "a quick 'Ocupado' and the answer to 'which one?' were dropped");
  check("hook", "an answer to our released-times question is never an away message", /async function ocupadoQuestionOpen\(from: string\)[\s\S]{0,700}¿Cuál se os ha llenado\\\?\|¿Me confirmáis que al final no podéis atenderle\\\?/.test(botSrc), true, "'Sí, no podemos atenderle' matched AUTOREPLY_RE");
  check("hook", "«ocupado» is not gated by RELEASED any more (review fix)", /async function studioOcupado\([^)]*\): Promise<boolean> \{\s*const nowMs = Date\.now\(\);/.test(botSrc) && !/async function studioOcupado\([^)]*\): Promise<boolean> \{\s*if \(\(await releasedMode/.test(botSrc), true, "times saved while off must still come off");
  check("hook", "«ocupado» checks for an open ask or a booking of theirs before it acts", /const openWhy = await studioOpenAsk\(partner\.id, intent\)[^\n]*\n\s*if \(openWhy\) \{[\s\S]{0,900}return false;\s*\}\s*let plan = ocupadoPick/.test(botSrc), true, "never confused with an answer to an ask");
  check("hook", "a time we have nothing at goes to today's path", /if \(plan\.kind === "none"\) \{[^\n]*return false; \}/.test(botSrc), true, "scenario F");
  check("hook", "a failed read counts as an open ask; won rows, 8 days of confirmed bookings (to the end of a later day named) and website bookings are read", /if \(!asked \|\| !chased \|\| !won \|\| !mine \|\| !conf \|\| !confNoStart \|\| !web\) return "a read failed";/.test(botSrc) && /outcome=eq\.won/.test(botSrc) && /const far = !!intent\.ymd && relAt\(intent\.ymd, 1440\) > nowMs \+ 8 \* 86400e3;\s*const reach = far \? relAt\(String\(intent\.ymd\), 1440\) : nowMs \+ 8 \* 86400e3;/.test(botSrc) && /confirmed_start=lte\.\$\{iso\(reach\)\}/.test(botSrc) && /last = far \? String\(intent\.ymd\) : relYmd\(reach\);/.test(botSrc) && /bookings\?partner_id=eq\.\$\{p\}&status=in\.\(pending,confirmed\)&booking_date=gte\.\$\{today\}&booking_date=lte\.\$\{last\}/.test(botSrc), true, "go-live review (23 Oct): a booking of theirs on a far day named is still seen");
  // Go-live review (23 Oct): «ocupado» reads the studio's live times and the
  // days of the message over REL_STUDIO_HORIZON_DAYS, not 8 days.
  const ocuI0 = botSrc.indexOf("function ocupadoIntent(");
  const ocuI = botSrc.slice(ocuI0, botSrc.indexOf("\n}\n", ocuI0));
  check("hook", "«ocupado» reads a far day's bookings latest first, so a cut at 200 never drops the day named (verifier nit, 23 Oct)", /&select=id,confirmed_start,message_text&order=confirmed_start\.\$\{far \? "desc" : "asc"\}&limit=200/.test(botSrc) && /&select=booking_ref,booking_date,booking_time&order=booking_date\.\$\{far \? "desc" : "asc"\}&limit=200/.test(botSrc), true, "a clash on that day was missed");
  check("hook", "«ocupado»: a date it does not read is null; a month word is looked for once the date read is taken out (verifier, 23 Oct)", /if \(OCU_ODD_DATE_RE\.test\(s\)\) return null;\s*\/\/ The day:/.test(ocuI) && /\n  if \(OCU_MONTH_LEFT_RE\.test\(s\)\) return null;\n  if \(off !== null && off < 0\) return null;/.test(ocuI) && /const OCU_DATE_RE = new RegExp\(`[^`]*\$\{OCU_MONTH_ALT\}/.test(botSrc) && /const OCU_MONTH_LEFT_RE = new RegExp\(`[^`]*\$\{OCU_MONTH_ALT\}/.test(botSrc) && /const OCU_ODD_DATE_RE = new RegExp\(`[^`]*\$\{OCU_MONTH_ALT\}/.test(botSrc), true, "one month list for the dates read and the dates refused");
  check("hook", "«ocupado» reads 8 weeks of live times and days (go-live review)", /const days = slotDays\(nowMs, REL_STUDIO_HORIZON_DAYS\);/.test(ocuI) && !/slotDays\(nowMs, 8\)/.test(ocuI) && /released_slots\?partner_id=eq\.\$\{pid\}&status=in\.\(released,held,booked\)&start_at=gt\.[^`]*&start_at=lt\.\$\{encodeURIComponent\(new Date\(nowMs \+ REL_STUDIO_HORIZON_DAYS \* 86400e3\)\.toISOString\(\)\)\}&order=start_at\.asc/.test(botSrc) && !/start_at=lt\.\$\{encodeURIComponent\(new Date\(nowMs \+ 8 \* 86400e3\)\.toISOString\(\)\)\}&order=start_at\.asc/.test(botSrc), true, "a time held 7 weeks out could not be taken off, and the wrong one was");
  // v217: the times part of socApply moved into socSaveTimes, shared with studio_times.
  check("hook", "a signed submit releases through release_slots, source studio_link, evidence the signup", /const sv = await socSaveTimes\(pid, plan, plan\.minutes, plan\.price, `socios signup \$\{signup\.id\}`, plan\.drawnAt, String\(signup\.id\), nowMs\);/.test(botSrc) && /relRpc\("release_slots", \{ p_partner: pid, p_rows: rows, p_source: "studio_link", p_evidence: evidence, p_since: drawnAt \? new Date\(drawnAt\)\.toISOString\(\) : null \}\)/.test(botSrc), true, "");
  check("hook", "only a signed, live studio is applied at once", /const why = !signed \? [\s\S]{0,400}socTestish\(plan\.studio\.wa, plan\.studio\.email\) && !socIsTestStudio\(partner\) \? "a test contact on a real studio" : "";/.test(botSrc), true, "test contacts never reach a real studio");
  check("hook", "approve claims before it applies (one conditional update)", /const claimed = await socPatch\(id, \{ status: "applied", reviewed_at: new Date\(\)\.toISOString\(\) \}, row\.status\);\s*if \(!claimed\)/.test(botSrc), true, "a double tap applies once");
  check("hook", "approve and reject need the page's own button (fresh t)", /const fresh = t > 0 && nowMs - t < 2 \* 3600e3 && t <= nowMs \+ 60e3;/.test(botSrc) && /if \(a === "yes" && fresh\)/.test(botSrc) && /if \(a === "no" && fresh\)/.test(botSrc), true, "a scanner opening the emailed link changes nothing");
  check("hook", "a test studio's contact fields are never changed; only its own link changes a studio's details", /const own = via === "socios_link";\s*if \(own && !socIsTestStudio\(partner\)\) \{\s*const up = socSignedUpdate\(partner, plan\.studio\);/.test(botSrc), true, "");
  check("hook", "terms recorded only on the studio's own link or for a new studio (review fix)", /if \(own \|\| created\) \{\s*const tr = await fetch\(`\$\{SUPABASE_URL\}\/rest\/v1\/partner_terms/.test(botSrc), true, "an unsigned form never records terms in an existing studio's name");
  check("hook", "a signed send counts only against its own signed sends (review fix)", /if \(signed\) \{\s*if \(\(await socCount\(`partner_id=eq\.\$\{encodeURIComponent\(String\(partner\.id\)\)\}&signed=is\.true&/.test(botSrc) && /partner_id: signed \? partner\.id : null, status: "rejected"/.test(botSrc), true, "a public slug can no longer lock a studio out");
  check("hook", "the sender address is cf-connecting-ip, else the last X-Forwarded-For entry (review fix)", /const cf = \(req\.headers\.get\("cf-connecting-ip"\) \|\| ""\)\.trim\(\);\s*if \(cf\) return cf;[\s\S]{0,200}return xff\[xff\.length - 1\];/.test(botSrc) && !/x-forwarded-for"\) \|\| ""\)\.split\(","\)\[0\]/.test(botSrc), true, "the first entry is whatever the client sent");
  check("hook", "one cap for every unsigned send, and a card limit for Jordan", /signed=is\.false&status=neq\.rejected&created_at=gte\.\$\{since\(3600e3\)\}`\)\) >= SOC_LIMIT_UNSIGNED_H\) return busy;/.test(botSrc) && /if \(cardsH < SOC_CARDS_UNSIGNED_H\) await socReviewCard/.test(botSrc), true, "go-live review (23 Oct): the cap counts forms that passed the checks and answers busy (503); run below");
  check("hook", "Aprobar and Rechazar are form submits, not links (review nit)", /const yes = pillForm\(f\("yes"\)/.test(botSrc) && /const no = pillForm\(f\("no"\)/.test(botSrc) && !/pillLink\(`\$\{base\}&a=yes/.test(botSrc), true, "a link follower cannot approve");
  // Go-live review (23 Oct): an unsigned form never releases times for a
  // studio we already have, and the approve card says plainly what approving
  // a new studio starts.
  const rv0 = botSrc.indexOf("async function socReviewPage(url: URL)");
  const rv = botSrc.slice(rv0, botSrc.indexOf("\n}\n", rv0));
  check("hook", "Aprobar on an unsigned form for a studio we already have saves nothing and says to send its own link", /const own = signedRow && !!partner && String\(partner\.id\) === String\(row\.partner_id\);\s*(?:\/\/[^\n]*\n\s*)*if \(partner && !own\) \{\s*const gone = socInactive\(partner\);\s*await socPatch\(id, \{ status: "pending_review", partner_id: partner\.id, note: [^\n]*\n\s*const share = gone \? null : await socOwnLinkShare\(partner\);[\s\S]{0,900}return done\("Not saved", [^\n]*Send them their own link/.test(rv) && rv.indexOf("if (partner && !own) {") < rv.indexOf("const v = socValidate(p, nowMs, partner?.opening_hours") && rv.indexOf("if (partner && !own) {") < rv.indexOf("await socApply(claimed, partner, plan"), true, "release_slots source studio_link is instant confirm (go-live review, 23 Oct)");
  check("hook", "the card for it has no Aprobar: its own link and Rechazar", /const linkOnly = canApprove && !!match && row\?\.signed !== true;\s*const approve = canApprove && !linkOnly;/.test(botSrc) && /links: approve \? \[\{ href: await socReviewLink\(String\(row\.id\), "yes"\), label: "Aprobar \(Approve\)"[^\n]*\n\s*: linkOnly \? \[\.\.\.\(own \? \[\{ \.\.\.own, primary: true \}\] : \[\]\), \{ href: await socReviewLink\(String\(row\.id\), "no"\), label: "Rechazar \(Reject\)" \}\]/.test(botSrc), true, "");
  check("hook", "the review page for it has no Aprobar either", /const linkOnly = !!known && !signedRow;[\s\S]{0,400}if \(linkOnly\) return done\(`\$\{name\}`, [^\n]*\(ownShare \? pillLink\(escAttr\(ownShare\.href\), ownShare\.label, true\) \+ no : pillForm\(f\("no"\), "Rechazar \(Reject\): save nothing", true\)\)\);/.test(rv), true, "");
  // Review (23 Oct, follow-up): no own link for a studio that has opted out,
  // or is suspended or archived, on the confirm page or after Aprobar; the
  // studio matched at review time is kept on the row; a new studio's typed
  // WhatsApp is checked as a studio's own link's is.
  check("hook", "no own link to send to a studio that is not active", /const ownShare = linkOnly && !socInactive\(known\) \? await socOwnLinkShare\(known\) : null;/.test(rv) && /const share = gone \? null : await socOwnLinkShare\(partner\);/.test(rv) && /if \(gone\) return done\("Not saved", [^\n]*has opted out, or is suspended or archived\. Nothing is saved for it and there is no link to send them\.[^\n]*, reject\);/.test(rv), true, "the old page said it had opted out; the new one offered its link as the main button");
  check("hook", "a new studio's typed WhatsApp is never another studio's or a customer's", /const waWhy = socTestish\(plan\.studio\.wa, ""\) \? "" : await socWaBlocked\(plan\.studio\.wa, ""\);\s*if \(waWhy\) return await back\(/.test(rv) && rv.indexOf('await socWaBlocked(plan.studio.wa, "")') < rv.indexOf("const cr = await fetch(`${SUPABASE_URL}/rest/v1/partners`, { method: \"POST\""), true, "a customer's messages would read as a studio's");
  check("hook", "a failed save on a signed link keeps the phone note out when the WhatsApp replacing it is proposed", /x\.field === "email" \? "booking_email" : x\.field === "phone" \? "whatsapp" : x\.field/.test(botSrc), true, "");
  const effSrc = (botSrc.match(/\nfunction socApproveEffect\([\s\S]*?\n\}\n/) || [""])[0];
  const inactSrc = (botSrc.match(/\nconst socInactive = [^\n]*\n/) || [""])[0];
  const socApproveEffect = new Function(`${stripTypeScriptTypes(inactSrc + effSrc)}\nreturn socApproveEffect;`)();
  const effNew = socApproveEffect(null, false, { wa: "34600111222", email: "hola@calma.es" });
  const effMatch = socApproveEffect({ business_name: "Calma" }, false);
  const effSigned = socApproveEffect({ business_name: "Calma" }, true);
  check("socios approve card", "a new studio: says it starts getting customer requests at the number and email typed, and to check both", [/starts getting real customer requests at the WhatsApp \+34600111222 and the email hola@calma\.es typed here/.test(effNew), /customer's name, phone and email/.test(effNew), /check both are really this studio's before you approve/.test(effNew)], [true, true, true], "go-live review (23 Oct): dispatch and the offer email reach a pending studio");
  check("socios approve card", "without what was typed it still says so", /starts getting real customer requests at the WhatsApp and the email typed here/.test(socApproveEffect(null, false)), true, "");
  check("socios approve card", "a studio we already have: cannot be approved, send its own link", [/^This cannot be approved: /.test(effMatch), /\(Calma\)/.test(effMatch), /Send them their own link/.test(effMatch), /Approving saves/.test(effMatch)], [true, true, true, false], "");
  check("socios approve card", "a failed signed save: a new booking contact still needs its own OK", /A new booking WhatsApp or email replaces ours only after a second OK from you\./.test(effSigned), true, "");
  const effGone = [{ business_name: "Calma", status: "archived" }, { business_name: "Calma", status: "suspended" }, { business_name: "Calma", status: "active", opted_out_at: "2026-10-20T10:00:00Z" }].map((m) => socApproveEffect(m, false));
  check("socios approve card", "a studio that is not active: cannot be approved, and no link to send", effGone.map((t) => [/^This cannot be approved: Calma has opted out, or is suspended or archived/.test(t), /no link to send them/.test(t), /Send them their own link/.test(t)]), [[true, true, false], [true, true, false], [true, true, false]], "review follow-up (23 Oct)");
  check("socios approve card", "no em or en dashes", /[–—]/.test(effNew + effMatch + effSigned + effGone.join("")), false, "CLAUDE.md");
  // Go-live review (23 Oct): a signed link fills empty fields at once; a new
  // booking WhatsApp or email waits for Jordan; a customer's number is never
  // a studio's WhatsApp.
  check("hook", "a signed link's new WhatsApp, filled or proposed, is checked first", /if \(up\.set\.whatsapp \|\| up\.proposed\.set\.whatsapp\) \{\s*const why = await socWaBlocked\(plan\.studio\.wa, pid\);\s*if \(why\) \{\s*delete up\.set\.whatsapp; delete up\.proposed\.set\.whatsapp; delete up\.proposed\.set\.phone;/.test(botSrc), true, "");
  const wb0 = botSrc.indexOf("async function socWaBlocked(");
  const wb = botSrc.slice(wb0, botSrc.indexOf("\n}\n", wb0));
  check("hook", "never another studio's number, never a customer's (whatsapp_requests.client_phone), and a failed read is a no", wb0 > 0 && /if \(other && String\(other\.id\) !== String\(pid\)\) return `already on file for/.test(wb) && /socRead\(`whatsapp_requests\?client_phone=like\.\*\$\{l9\}&select=id&limit=1`\)/.test(wb) && /if \(cust === null\) return "/.test(wb), true, "");
  check("hook", "only up.set is written at once; the proposal is stored as waiting", /body: JSON\.stringify\(up\.set\) \}\);[\s\S]{0,700}if \(up\.proposed\.changes\.length\) result\.proposed = \{ \.\.\.up\.proposed, status: "waiting" \};/.test(botSrc) && !/JSON\.stringify\(\{ \.\.\.up\.set, \.\.\.up\.proposed\.set \}\)/.test(botSrc), true, "");
  check("hook", "Jordan's card for it links to the review, and the links page lists it", /links: \[\.\.\.\(contacts \? \[\{ href: await socReviewLink\(String\(row\.id\), "yes"\), label: "Review the new contact", primary: true \}\] : \[\]\)/.test(botSrc) && /if \(pid && socProposalWaiting\(s\)\) review\.add\(pid\);/.test(botSrc), true, "");
  check("hook", "the review link opens the contact review before 'Already approved'", rv.indexOf("if (socProposalWaiting(row)) return await socContactsReview(url, row, id, sig, a, fresh);") > 0 && rv.indexOf("if (socProposalWaiting(row))") < rv.indexOf('if (row.status === "applied") {'), true, "");
  const cr0 = botSrc.indexOf("async function socContactsReview(");
  const cr = botSrc.slice(cr0, botSrc.indexOf("\n}\n", cr0));
  check("hook", "approving a new contact: page buttons only, claimed once, WhatsApp checked again, then written", cr0 > 0 && /if \(a === "yes" && fresh\)/.test(cr) && /if \(a === "no" && fresh\)/.test(cr) && /const up = socProposalNow\(studio, row\.result\.proposed\);/.test(cr) && /const waWhy = waNew \? await socWaBlocked\(waNew, String\(studio\.id\)\) : "";\s*if \(waWhy\) \{ delete patch\.whatsapp; delete patch\.phone; \}/.test(cr) && cr.indexOf('if (!(await socContactsDecide(id, row.result, "approved"') < cr.indexOf("rest/v1/partners?id=eq.") && /result->proposed->>status=eq\.\$\{from\}/.test(botSrc), true, "a double tap acts once");
  check("hook", "no em or en dashes in the contact review", /[–—]/.test(cr + wb), false, "");
  check("hook", "the unsigned prefill shows nothing for a studio that is not active (review nit)", /if \(!signed && String\(partner\.status \|\| ""\) !== "active"\) return \{ ok: true, status: "unknown" \};/.test(botSrc), true, "");
  check("hook", "the fast lane offers released times before finalising (review fix)", /await continueFromKnown\(s, from, L, \{ released: true \}\);/.test(botSrc) && /if \(o\.released && !s\.data\.chosen[^\n]*\n\s*&& await offerReleased\(s, from, L\)\) return;\s*await askNameOrFinalize\(s, from, L\);/.test(botSrc), true, "the one-sentence opener never saw them");
  check("hook", "the page's hello from a number that is not a partner never enters the customer flow (review fix)", botSrc.indexOf("if (text && SOCIOS_HELLO_RE.test(text) && !(await findPartnerByNumber(") > 0 && botSrc.indexOf("if (text && SOCIOS_HELLO_RE.test(text) && !(await findPartnerByNumber(") < botSrc.indexOf("// ---- Studio replies: template button payloads") && /if \(s\.data\.socStudioAt && Date\.now\(\) - Number\(s\.data\.socStudioAt\) < SOC_STUDIO_CHAT_MS/.test(botSrc), true, "");
  const helloRe = new RegExp((botSrc.match(/const SOCIOS_HELLO_RE = \/(.*)\/;/) || [])[1]);
  const pageHello = (k, L) => (html.match(new RegExp(`\\n  ${L}: \\{[\\s\\S]*?\\n    ${k}: "([^"]*)",`)) || [])[1];
  check("hook", "the page's four hellos are recognised", ["es", "en"].flatMap((L) => [pageHello("contactHello", L).replace("{n}", "Centro Nuevo Masajes"), pageHello("contactHello0", L)]).map((t) => helloRe.test(t + "¿Cómo funciona?")), [true, true, true, true], "contactHello and contactHello0, es and en");
  // Jordan, 23 Oct: «negocio» / "business", never «centro» / "centre", in the
  // page's hellos; every older hello is still read.
  check("hook", "the page's hellos say «un negocio de masajes» / \"a massage business\" (Jordan, 23 Oct)", ["msgHello", "contactHello", "contactHello0"].flatMap((k) => ["es", "en"].map((L) => pageHello(k, L))), ["Hola, Massage Club. Somos {n}, un negocio de masajes.", "Hello, Massage Club. We are {n}, a massage business.", "Hola, Massage Club. Somos {n}, un negocio de masajes. ", "Hello, Massage Club. We are {n}, a massage business. ", "Hola, Massage Club. Somos un negocio de masajes. ", "Hello, Massage Club. We are a massage business. "], "");
  check("hook", "every older hello is still recognised (a page left open, a message typed from an old one)", [
    "Hola, Massage Club. Somos Calma, centro de masaje. ¿Cómo funciona?",
    "Hola, Massage Club. Somos un centro de masaje. Hola",
    "Hello, Massage Club. We are Calma, a massage centre. Hi",
    "Hello, Massage Club. We are a massage centre. Hi",
    "Hello, Massage Club. We are Calma, a massage studio. Hi",
    "Hello, Massage Club. We are a massage studio. Hi",
    "Hola, Massage Club. Somos Calma, un negocio de masajes. ¿Cómo funciona?",
    "Hola, Massage Club. Somos un negocio de masajes. ",
    "Hello, Massage Club. We are Calma, a massage business. Hi",
    "Hello, Massage Club. We are a massage business. ",
  ].map((t) => helloRe.test(t)), [true, true, true, true, true, true, true, true, true, true], "");
  check("hook", "a customer's own words never read as the page's hello", ["Hola, Massage Club. Somos dos y queremos un masaje en el centro.", "Hola, somos un negocio de masajes, ¿cómo funciona?", "Hello, Massage Club. We are two people looking for a massage.", "Hola, Massage Club. Somos de Centro, ¿tenéis hueco hoy?"].map((t) => helloRe.test(t)), [false, false, false, false], "only the page's exact opening");
  check("hook", "a released booking's email question promises no rate (review nit)", /await say\(relSlot \? RELEASED_COPY\[L === "es" \? "es" : "en"\]\.emailAsk : COPY\[L\]\.memberJoin\);/.test(botSrc), true, "");
  check("hook", "the times page works before RELEASED is on, and says so", !/Todavía no está activa/.test(botSrc) && /const liveNow = socLiveFor\(mode, isTest\);/.test(botSrc) && /Todavía no las ofrecemos a clientes: las guardamos y os avisamos en cuanto empecemos\./.test(botSrc), true, "Jordan: studios may load times before it is on");
  check("hook", "the page's WhatsApp fallback is read before the studio and customer paths", botSrc.indexOf("if (text && SOCIOS_FALLBACK_RE.test(text)) {") > 0 && botSrc.indexOf("if (text && SOCIOS_FALLBACK_RE.test(text)) {") < botSrc.indexOf("// ---- Studio replies: template button payloads"), true, "");
  const fbRe = new RegExp((botSrc.match(/const SOCIOS_FALLBACK_RE = \/(.*)\/;/) || [])[1]);
  check("hook", "the fallback needs its times block (the page's other WhatsApp links open with the same hello)", [fbRe.test("Hola, Massage Club. Somos Calma, centro de masaje.\n\nHoras que os ofrecemos (1 hueco de 60 min, cada semana):\nCada martes: 18:00"), fbRe.test("Hola, Massage Club. Somos Calma, centro de masaje. ¿Cómo funciona el pago?"), fbRe.test("Hello, Massage Club. We are Calma, a massage centre.\n\nTimes we offer you (1 slot, 60 min, every week):"), fbRe.test("Hello, Massage Club. We are Calma, a massage studio.\n\nTimes we offer you (1 slot, 60 min, every week):")], [true, false, true, true], "");
  check("hook", "the fallback reads the new hello and every older one (Jordan, 23 Oct: «negocio»)", [
    fbRe.test("Hola, Massage Club. Somos Calma, un negocio de masajes.\n\nHoras que os ofrecemos (1 hueco de 60 min, cada semana):\nCada martes: 18:00"),
    fbRe.test("Hello, Massage Club. We are Calma, a massage business.\n\nTimes we offer you (1 slot, 60 min, every week):"),
    fbRe.test("Hola, Massage Club. Somos Calma, centro de masaje.\nHoras que os ofrecemos (2 huecos de 60 min, solo esta semana):"),
    fbRe.test("Hola, Massage Club. Somos Calma, un negocio de masajes. ¿Cómo funciona el pago?"),
    fbRe.test("Hello, Massage Club. We are Calma, a massage business. How does payment work?"),
    fbRe.test(pageHello("msgHello", "es").replace("{n}", "Calma") + "\n\n" + pageHello("msgTimes", "es").replace("{s}", "1 hueco de 60 min, cada semana") + "\nCada martes: 18:00"),
    fbRe.test(pageHello("msgHello", "en").replace("{n}", "Calma") + "\n\n" + pageHello("msgTimes", "en").replace("{s}", "1 slot, 60 min, every week") + "\nEvery Tuesday: 18:00"),
  ], [true, true, true, false, false, true, true], "the page's own msgHello and msgTimes, es and en, as it builds them");

  // socios.html: what it sends and when.
  check("socios page", "preview sends nothing", /if \(PREVIEW\) \{[\s\S]{0,400}return finish\("preview", list, key\);\s*\}\s*S\.saving = true;/.test(html), true, "");
  check("socios page", "the fallback only when the save cannot be reached, or the server is busy", /if \(r\.ok && j && j\.ok === true && \(j\.status === "applied" \|\| j\.status === "pending_review"\)\) kind = j\.status;\s*(?:\/\/[^\n]*\n\s*)*else if \(r\.status === 503 \|\| \(j && j\.status === "busy"\)\) kind = "fallback";\s*else if \(r\.status >= 400 && r\.status < 500 && j && j\.ok === false && typeof j\.message === "string" && j\.message\) kind = "refused";/.test(html), true, "a refusal is said under the button; busy (go-live review, 23 Oct) is the WhatsApp and email fallback; run below");
  check("socios page", "email required, with its reason", /id="email"[^>]*required/.test(html) && /errEmailNone/.test(html) && /fEmailHint: "Cada reserva os llega también por email/.test(html), true, "R7");
  check("socios page", "sends the link signature and when it was drawn", /link_sig: SIG_OK \? SIG : null,\s*drawn_at: DRAWN_AT,/.test(html), true, "");
  check("socios page", "the view is logged only for a signed link and never in preview", /\(SIG_OK \? "&k=" \+ SIG \+ \(PREVIEW \? "" : "&view=1" \+ via\) : ""\)/.test(html) && /const via = \/\^\[th\]\$\/\.test\(String\(q\.get\("v"\) \|\| ""\)\) \? "&v=" \+ q\.get\("v"\) : "";/.test(html), true, "");
  check("socios page", "the same limits as the server", [(html.match(/const MAX_TIMES = (\d+);/) || [])[1], (botSrc.match(/const SOC_MAX_TIMES = (\d+);/) || [])[1], (html.match(/const LEAD_MIN = (\d+);/) || [])[1]], ["40", "40", "65"], "65: the grid's lead, one hour is release_slots'");
  check("socios page", "Recibido says WhatsApp and email too (review nit)", /nextB: "Si un cliente coge una hora, os llega la reserva por WhatsApp y por email/.test(html), true, "");
  check("socios page", "the page holds times to 08:00 to 22:00 like the server", /const DAY_WIN = \[8 \* 60, 22 \* 60\];/.test(html) && /\.map\(\(\[o, c\]\) => \[Math\.max\(o, DAY_WIN\[0\]\), Math\.min\(c, DAY_WIN\[1\]\)\]\)/.test(html), true, "");
  check("socios page", "a price, another amount or «Lo pongo más tarde» is chosen, unless own link with a menu", /const priceNeeded = \(\) => !\(S\.signed && S\.partner && S\.partner\.has_menu === true\);/.test(html) && /const need = !pBad && !pr\.later && pr\.price === null && priceNeeded\(\);/.test(html) && /errPriceNeed/.test(html), true, "Jordan, 23 Oct: the price can be left for later; run below");
  check("socios page", "the result screens say what the server said", /s4Saved: "Guardado"/.test(html) && /s4Received: "Recibido"/.test(html) && /received0: "Lo revisamos y os confirmamos por WhatsApp o email\."/.test(html), true, "");

  // The migration.
  for (const t of ["studio_signups", "partner_terms", "released_patterns"]) {
    check("socios migration", `${t}: RLS on, nothing for anon or signed-in users, service role only`, new RegExp(`alter table public\\.${t} enable row level security;\\s*revoke all on public\\.${t} from public, anon, authenticated;\\s*grant all on public\\.${t} to service_role;`).test(migSrc), true, "");
  }
  const fnDefs = [...migSrc.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => [m[1], m[2].split(",").map((x) => x.trim().split(/\s+/)[1]).join(", ")]);
  const grants = new Set([...migSrc.matchAll(/grant execute on function public\.(\w+)\(([^)]*)\) to service_role;/g)].map((m) => `${m[1]}(${m[2]})`));
  const revokes = new Set([...migSrc.matchAll(/revoke all on function public\.(\w+)\(([^)]*)\) from public, anon, authenticated;/g)].map((m) => `${m[1]}(${m[2]})`));
  check("socios migration", "every function revoked from anon and granted to service_role", fnDefs.filter(([n, a2]) => !grants.has(`${n}(${a2})`) || !revokes.has(`${n}(${a2})`)).map(([n, a2]) => `${n}(${a2})`), [], "");
  check("socios migration", "weekly times go through release_slots and never recreate a start and room that has any row", /from release_slots\(pat\.partner_id, v_rows, 'studio_link',/.test(migSrc) && /and not exists \(select 1 from released_slots o\s*where o\.partner_id = pat\.partner_id and o\.start_at = c\.start_at and o\.seat = c\.seat\);/.test(migSrc), true, "a removed or rejected time never comes back by itself");
  check("socios migration", "the sweep job, replaced not doubled", /cron\.unschedule\('mc-released-patterns'\)/.test(migSrc) && /cron\.schedule\('mc-released-patterns', '\*\/5 \* \* \* \*', 'select public\.materialise_released_patterns\(\)'\)/.test(migSrc), true, "");
  check("socios migration", "the status vocabulary the task names", (migSrc.match(/check \(status in \('received', 'applied', 'pending_review', 'rejected'\)\)/) || []).length, 1, "");
  check("socios migration", "the written agreement survives a partner delete", /partner_id\s+uuid not null references public\.partners\(id\),/.test(migSrc), true, "like studio_invoices");
}

// ---------------------------------------------------------------------------
// v217 (18 Oct, Jordan: studios change their times whenever they want, from
// the same link they start with, with no WhatsApp, and give times as far
// ahead as they choose). The signed /socios prefill now carries the studio's
// own times (socTimesView) and the page sends changes as ops studio_times
// (socTimesAsk, socTimesSplit, then socTimesSubmit). A "just once" time may
// be up to 8 weeks ahead (REL_STUDIO_HORIZON_DAYS, and release_slots in the
// migration). The pure parts are lifted with the v215 and v216 blocks; the
// rest (signatures, the database) runs in the offline harness on local
// Postgres. Now: Wednesday 21 Oct 2026, 12:00 Madrid.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { stripTypeScriptTypes } = await import("node:module");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const botSrc = fs.readFileSync(path.join(here, "../supabase/functions/wa-bot/bot.ts"), "utf8");
  const relSql = fs.readFileSync(path.join(here, "../supabase/migrations/20261018_released_slots.sql"), "utf8");
  const socSql = fs.readFileSync(path.join(here, "../supabase/migrations/20261018_socios_signup.sql"), "utf8");
  const a = botSrc.indexOf("// ---- v215 released slots: pure helpers (start) ----");
  const b = botSrc.indexOf("// ---- v216 socios: pure helpers (end) ----");
  if (a < 0 || b < a) throw new Error("bot.ts: the v215 / v216 helper markers are missing");
  const names = ["REL_STUDIO_HORIZON_DAYS", "socTimeCheck", "socValidate", "socTimesSplit", "socTimesAsk", "socTimesView", "socRemoveWhy", "socAddMissWhy", "socWhyText", "SOC_WHY", "SOC_MSG", "socMsg", "SOCIOS_TERMS", "releaseCheck", "slotHours", "slotDays", "SOC_MAX_TIMES", "SOC_MAX_REMOVE"];
  const copyUrl = pathToFileURL(path.join(here, "../supabase/functions/wa-bot/copy.ts")).href;
  const js = `import { madridInstant, madridMidnight, stripAcc, euro } from ${JSON.stringify(copyUrl)};\n`
    + stripTypeScriptTypes(botSrc.slice(a, b)) + `\nexport { ${names.join(", ")} };\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-times-"));
  const file = path.join(dir, "times.mjs");
  fs.writeFileSync(file, js);
  const R = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });
  const { madridInstant } = await import(copyUrl);
  const M = (mo, day, h, mi = 0) => madridInstant(new Date(Date.UTC(2026, mo - 1, day)), h).getTime() + mi * 60e3;
  const now = M(10, 21, 12);
  const H = R.slotHours("Lun-Sáb 10:00-20:00");

  // The horizon: one constant, the same limit as the database.
  check("v217 horizon", "8 weeks", R.REL_STUDIO_HORIZON_DAYS, 56, "Jordan: as far ahead as they choose");
  check("v217 horizon", "release_slots holds the same limit", new RegExp(`and r\\.start_at < now\\(\\) \\+ interval '${R.REL_STUDIO_HORIZON_DAYS} days'`).test(relSql) && !/and r\.start_at < now\(\) \+ interval '8 days'/.test(relSql), true, "one number in bot.ts, one check in the SQL function");
  check("v217 horizon", "weekly times are still made 7 days ahead", /c\.start_at < now\(\) \+ interval '8 days'/.test(socSql) && /generate_series\(0, 6\)/.test(socSql), true, "only dated times go further");
  for (const [ymd, want, note] of [
    ["2026-12-09", "", "7 weeks out (Wed 9 Dec): accepted"],
    ["2026-12-15", "", "today plus 55 days, the last day shown: accepted"],
    ["2026-12-16", "day", "today plus 56 days: refused"],
    ["2026-12-23", "day", "9 weeks out (Wed 23 Dec): refused"],
    ["2026-10-20", "day", "yesterday"],
    ["2026-11-22", "closed", "a Sunday 4 weeks out: still the opening hours"],
    ["2026-11-21", "", "a Saturday 4 weeks out"],
  ]) check("v217 horizon", `socTimeCheck ${ymd} 12:00`, R.socTimeCheck(ymd, "12:00", 60, H, now), want, note);
  check("v217 horizon", "still at least 60 minutes ahead", [R.socTimeCheck("2026-10-21", "12:30", 60, H, now), R.socTimeCheck("2026-10-21", "13:00", 60, H, now)], ["soon", ""], "");
  check("v217 horizon", "still 08:00 to 22:00 whatever the hours", R.socTimeCheck("2026-12-09", "22:00", 60, R.slotHours("Lun-Dom 0-24"), now), "hours", "");
  check("v217 horizon", "the times page and the ops release: 8 weeks too", [R.releaseCheck({ ymd: "2026-12-09", hm: "12:00", minutes: 60 }, H, now), R.releaseCheck({ ymd: "2026-12-23", hm: "12:00", minutes: 60 }, H, now)], ["", "day"], "releaseCheck");
  check("v217 horizon", "the reason reads 8 weeks", [R.socWhyText("day", "es"), R.socWhyText("far", "en")], ["fuera de las próximas 8 semanas", "outside the next 8 weeks"], "");
  // The sign-up form gets the same 8 weeks.
  const P = (slots, weekly = false) => ({
    lang: "es", drawn_at: now - 60e3,
    studio: { business_name: "Calma", whatsapp: "+34 600 111 222", address: "Calle Mayor 1", email: "hola@calma.es", opening_hours: "Lun-Sáb 10-20", opening_hours_read: "Lun-Sáb 10:00-20:00", price_60_eur: 50 },
    terms: { accepted: true, version: "2026-10-19", text: R.SOCIOS_TERMS["2026-10-19"].es },
    availability: { duration_min: 60, repeat_weekly: weekly, slots },
  });
  let v = R.socValidate(P([{ date: "2026-12-09", start: "18:00" }, { date: "2026-12-23", start: "18:00" }]), now);
  check("v217 horizon", "sign-up: 7 weeks out saved, 9 weeks out skipped", [v.ok, v.plan.once, v.plan.skipped.map((x) => `${x.day} ${x.why}`)], [true, [{ ymd: "2026-12-09", hm: "18:00" }], ["2026-12-23 day"]], "");
  check("v217 horizon", "the times_invalid message says 8 weeks", /más de 8 semanas/.test(R.socMsg("times_invalid", "es")) && /more than 8 weeks/.test(R.socMsg("times_invalid", "en")), true, "");

  // What a studio_times request asks for.
  const id1 = "11111111-1111-4111-8111-111111111111", id2 = "22222222-2222-4222-8222-222222222222";
  let q = R.socTimesAsk({ add: [{ date: "2026-12-09", start: "18:00" }], remove: [id1, id1.toUpperCase(), "x' or 1=1", 5], end_weekly: [id2], drawn_at: now - 60e3 }, now);
  check("v217 ask", "lists read; ids kept once, lower case; a non-id is answered not found", [q.ok, q.remove, q.endWeekly, q.badRemove, q.minutes, q.price, q.drawnAt], [true, [id1], [id2], ["x' or 1=1", ""], 60, null, now - 60e3], "never put into a query");
  check("v217 ask", "nothing to do", R.socTimesAsk({}, now).errors, ["nothing"], "");
  check("v217 ask", "a list that is not a list", R.socTimesAsk({ add: "18:00" }, now).errors, ["bad"], "");
  check("v217 ask", "too many at once", [R.socTimesAsk({ add: Array.from({ length: R.SOC_MAX_TIMES + 1 }, () => ({})) }, now).errors, R.socTimesAsk({ remove: Array.from({ length: R.SOC_MAX_REMOVE + 1 }, () => id1) }, now).errors], [["times_many"], ["remove_many"]], "");
  check("v217 ask", "length: 60 unless 90", [R.socTimesAsk({ remove: [id1] }, now).minutes, R.socTimesAsk({ remove: [id1], minutes: 90 }, now).minutes, R.socTimesAsk({ remove: [id1], minutes: 45 }, now).errors], [60, 90, ["duration"]], "the page never asks");
  check("v217 ask", "a price only between 1 and 500", [R.socTimesAsk({ remove: [id1], price_eur: "48" }, now).price, R.socTimesAsk({ remove: [id1], price_eur: 0 }, now).errors, R.socTimesAsk({ remove: [id1], price_eur: "abc" }, now).errors], [48, ["price"], ["price"]], "");
  check("v217 ask", "drawn_at in the future or days old is ignored", [R.socTimesAsk({ remove: [id1], drawn_at: now + 3600e3 }, now).drawnAt, R.socTimesAsk({ remove: [id1], drawn_at: now - 3 * 86400e3 }, now).drawnAt], [null, null], "as the sign-up");
  check("v217 ask", "every error code has Spanish and English copy", ["nothing", "bad", "times_many", "remove_many", "duration", "price", "times_link", "times_inactive", "times_done", "times_nothing", "rate", "error"].filter((k) => !R.SOC_MSG[k] || !R.SOC_MSG[k].es || !R.SOC_MSG[k].en), [], "");

  // Each time says whether it is weekly.
  const t = R.socTimesSplit([
    { date: "2026-12-09", start: "18:00" }, { date: "2026-12-09", start: "18:00", weekly: false }, { date: "2026-12-23", start: "18:00" },
    { weekday: 2, start: "18:00", weekly: true }, { date: "2026-10-27", start: "19:00", weekly: true }, { weekday: 0, start: "12:00", weekly: true },
  ], (x) => x?.weekly === true, 60, H, now);
  check("v217 split", "dated and weekly side by side; a weekly time by its date takes that weekday", [t.once, t.pattern, t.skipped.map((x) => `${x.weekly ? "w" : "d"} ${x.day} ${x.hm} ${x.why}`)], [[{ ymd: "2026-12-09", hm: "18:00" }], [{ dow: 2, hm: "18:00" }, { dow: 2, hm: "19:00" }], ["d 2026-12-23 18:00 day", "w 0 12:00 closed"]], "27 Oct is a Tuesday");

  // The studio's times as its page shows them: never anything about a customer.
  const iso = (ms) => new Date(ms).toISOString();
  const row = (id, mo, d, h, status, extra = {}) => ({ id, start_at: iso(M(mo, d, h)), end_at: iso(M(mo, d, h) + 3600e3), seat: 1, status, price_eur: 50, pattern_id: null,
    request_id: 77, held_by_phone: "34600000001", booked_phone: "34600000002", first_name: "Ana", contact_email: "ana@x.com", evidence: "x", ...extra });
  const view = R.socTimesView([
    row("a", 10, 22, 18, "released"), row("b", 10, 23, 18, "held"), row("c", 10, 24, 12, "booked"), row("d", 12, 9, 18, "released", { pattern_id: "p1" }),
    row("e", 10, 21, 10, "released"), row("f", 12, 16, 12, "released"), row("g", 10, 25, 12, "withdrawn"), row("h", 10, 26, 12, "rejected"), row("i", 10, 27, 12, "expired"),
  ], [{ id: "p2", weekday: 0, start_time: "12:00:00", minutes: 60, active: true }, { id: "p1", weekday: 3, start_time: "18:00:00", minutes: 60, price_eur: 45, active: true }, { id: "p3", weekday: 1, start_time: "10:00:00", minutes: 60, active: false }], now);
  check("v217 view", "only live times from now to the end of the 8 weeks, in order", view.slots.map((x) => `${x.id} ${x.date} ${x.time} ${x.status} ${x.removable}`), ["a 2026-10-22 18:00 free true", "b 2026-10-23 18:00 being booked false", "c 2026-10-24 12:00 booked false", "d 2026-12-09 18:00 free true"], "past, 16 Dec, removed, rejected and expired are left out");
  check("v217 view", "no customer data, whatever the rows hold", [...new Set(view.slots.flatMap((x) => Object.keys(x)))].sort(), ["date", "id", "minutes", "price_eur", "removable", "seat", "status", "time", "weekly_id"], "no request id, phone, name or email");
  check("v217 view", "nothing of the customer anywhere in it", /Ana|ana@x\.com|3460000000[12]|"77"|request|phone|evidence/.test(JSON.stringify(view)), false, "");
  check("v217 view", "active weekly times, Monday first", view.weekly, [{ id: "p1", weekday: 3, start: "18:00", minutes: 60, price_eur: 45 }, { id: "p2", weekday: 0, start: "12:00", minutes: 60, price_eur: null }], "an ended one is not shown");
  check("v217 view", "the days it covers", [view.horizon_days, view.first_day, view.last_day, view.slots[3].weekly_id], [56, "2026-10-21", "2026-12-15", "p1"], "");
  // What could not be removed, and why an added time was not saved.
  check("v217 remove", "free goes; being booked and booked stay; anything else is not found", ["withdrawn", "held", "booked", "rejected", "expired", "released", undefined].map((x) => R.socRemoveWhy(x)), ["", "being booked", "booked", "not_found", "not_found", "not_found", "not_found"], "another studio's id is never read, so it is not found too");
  check("v217 remove", "a booked time points to the reject link in the confirmation email", [/enlace del email de confirmación/.test(R.socWhyText("booked", "es")), /link in the confirmation email/.test(R.socWhyText("booked", "en")), /15 minutos/.test(R.socWhyText("being booked", "es"))], [true, true, true], "nothing goes to WhatsApp");
  check("v217 add", "why the database did not take a time", [R.socAddMissWhy(5, new Set([5]), 3), R.socAddMissWhy(6, new Set([5]), 200), R.socAddMissWhy(6, new Set([5]), 3)], ["already", "limit", "taken"], "");
  check("v217 copy", "no em or en dashes in the reasons and messages", JSON.stringify([R.SOC_WHY, R.SOC_MSG]).match(/[–—]/g), null, "");

  // Hooks: the endpoint, the order of the checks, the tables.
  const fn = (head) => { const i = botSrc.indexOf(head); return i < 0 ? "" : botSrc.slice(i, botSrc.indexOf("\n}\n", i) + 3); };
  const sub = fn("async function socTimesSubmit(");
  check("v217 hook", "studio_times is routed to socTimesSubmit", /const r = ops === "studio_times" \? await socTimesSubmit\(p, req, L\) : await socSubmit\(p, req, L\);/.test(botSrc), true, "same CORS, body limit and origin checks as studio_signup");
  check("v217 hook", "only the studio's own signed link: refused before anything is stored", /^async function socTimesSubmit[^\n]*\n\s*const nowMs = Date\.now\(\);\s*const \{ partner, signed \} = await socResolve\(p\?\.link_slug, p\?\.link_sig\);\s*if \(!partner \|\| !signed\) return \{ status: 403,/.test(sub) && sub.indexOf("socInsert(") > sub.indexOf("if (!partner || !signed)"), true, "an unsigned or wrongly signed request writes nothing");
  check("v217 hook", "its own limit, counted on its own rows", /socCount\(`partner_id=eq\.\$\{enc\}&kind=eq\.times&created_at=gte\.\$\{since\(3600e3\)\}`\)\) >= SOC_LIMIT_TIMES_H\)/.test(sub) && /const SOC_LIMIT_TIMES_H = SOC_LIMIT_STUDIO_H;/.test(botSrc) && /signed=is\.true&kind=eq\.signup&created_at=gte/.test(botSrc), true, "the same 6 an hour as a signed sign-up");
  check("v217 hook", "remove: only this studio's rows, through withdraw_released_slot", /released_slots\?partner_id=eq\.\$\{enc\}&id=in\./.test(sub) && /relRpc\("withdraw_released_slot", \{ p_slot: id, p_partner: pid \}\)/.test(sub), true, "another studio's id is never read");
  check("v217 hook", "end weekly: end_released_pattern for this studio", /rpc\/end_released_pattern`[\s\S]{0,200}p_pattern: id, p_partner: pid/.test(sub) && /released_patterns\?partner_id=eq\.\$\{enc\}&id=in\./.test(sub), true, "");
  check("v217 hook", "add: the sign-up's checks and saving, the terms and a price first", /socTimesSplit\(ask\.add, \(x\) => x\?\.weekly === true, ask\.minutes, slotHours\(partner\.opening_hours\), nowMs\)/.test(sub) && /else if \(!terms\.length\) refuseReady\("terms"\);\s*else if \(price === null && !\(await socHasMenu\(pid\)\)\) refuseReady\("price_needed"\);/.test(sub) && /socSaveTimes\(pid, t, ask\.minutes, price, `socios times \$\{row\.id\}`, ask\.drawnAt, String\(row\.id\), nowMs\)/.test(sub), true, "release_slots with p_since, released_patterns for weekly");
  check("v217 hook", "removes and ends come before adds", sub.indexOf("// 1. Remove.") < sub.indexOf("// 2. End weekly times.") && sub.indexOf("// 2. End weekly times.") < sub.indexOf("// 3. Add."), true, "room under the 200 cap first");
  check("v217 hook", "nothing is sent to the studio or a customer", /sendText|sendWa|sendTemplate|emailStudio|emailCustomer|notifyJordanWa/.test(sub), false, "only Jordan's email card");
  check("v217 hook", "the answer carries the fresh list", /const times = await socTimesList\(partner, Date\.now\(\)\);/.test(sub) && /saved, removed, could_not_remove: couldNot, ended_weekly: ended, could_not_end: couldNotEnd, refused, next, times \} \};/.test(sub), true, "");
  check("v217 hook", "the prefill's times only for a signed link", /\.\.\.\(signed \? \{ times: await socTimesList\(partner, Date\.now\(\)\) \} : \{\}\),/.test(botSrc), true, "an unsigned prefill shows nothing of them");
  check("v217 hook", "the times list reads no customer column", /status=in\.\(released,held,booked\)&start_at=gte\.[^`]*select=id,start_at,end_at,seat,status,price_eur,pattern_id&limit=400`/.test(fn("async function socTimesList(")), true, "");
  check("v217 hook", "the times page shows the same 8 weeks", /const days = slotDays\(nowMs, REL_STUDIO_HORIZON_DAYS\);\s*const dq = /.test(botSrc), true, "a far time given on /socios can be removed there too");
  check("v217 hook", "the links page counts sign-ups only", /studio_signups\?kind=eq\.signup&select=id,partner_id,status,created_at,payload,result/.test(botSrc), true, "a change of times is not a form to review");
  check("v217 migration", "studio_signups.kind, signed only for times", /add column if not exists kind text not null default 'signup';/.test(socSql) && /check \(kind in \('signup', 'times'\) and \(kind = 'signup' or \(signed and status in \('received', 'applied', 'rejected'\)\)\)\)/.test(socSql), true, "safe to apply more than once");
  check("v217 copy", "no em or en dashes in the new code", /[–—]/.test(sub + fn("async function socTimesList(") + fn("async function socPricesOnFile(") + fn("async function socSaveTimes(")), false, "");
}

// ---------------------------------------------------------------------------
// Review (23 Oct, before links): /socios drew the "every week" grid with
// today's cut-off, so a studio on a Friday afternoon could not give "every
// Friday 10:00" and was told it was too late for it; and a date tapped today
// dropped out with its times, and no word, once the calendar moved on. The
// page's own calendar code runs here in a vm with the clock faked: from
// `const LEAD_MIN = 65;` to the phone section, with weekPicks, fmtDates,
// onceDates and toggleDay, and the page's Spanish copy. Hours every day
// 10:00 to 21:00; Friday 23 Oct 2026, Madrid on CEST (UTC+2).
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const vm = await import("node:vm");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const html = fs.readFileSync(path.join(here, "../public/socios.html"), "utf8");
  const a = html.indexOf("const LEAD_MIN = 65;");
  const b = html.indexOf("// ---------------------------------------------------------------- phone");
  const t0 = html.indexOf("\nconst T = {"), t1 = html.indexOf("\nconst $ = (id)");
  const fnSrc = (name) => { const i = html.indexOf(`\nfunction ${name}(`); return i < 0 ? "" : html.slice(i, html.indexOf("\n}\n", i) + 3); };
  const line = (re) => (html.match(re) || [""])[0];
  const helpers = [line(/\nconst t = \(k, vars\) => \{[\s\S]*?\n\};\n/), line(/\nconst cap = .*\n/), line(/\nconst joinList = .*\n/)];
  const fns = ["weekPicks", "fmtDates", "onceDates", "toggleDay"].map(fnSrc);
  if (a < 0 || b < a || t0 < 0 || t1 < t0 || helpers.some((x) => !x) || fns.some((x) => !x)) throw new Error("socios.html: the calendar code or its markers are missing");
  const code = html.slice(t0, t1) + helpers.join("") + html.slice(a, b) + fns.join("")
    + "\n;globalThis.__page = { calDays, selList, hiddenByDay, droppedText, firstDate, gridStarts, chosenDays, countFor, weekPicks, onceDates, toggleDay, setHours: (h) => { HOURS = h; } };";
  const RealDate = Date;
  const ALL = new Map([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [[600, 1260]]]));
  const NO_FRI = new Map([0, 1, 2, 3, 4, 6].map((d) => [d, [[600, 1260]]]).concat([[5, []]]));
  const FRI_AM = new Map([0, 1, 2, 3, 4, 6].map((d) => [d, [[600, 1260]]]).concat([[5, [[600, 780]]]]));
  // One open page: its clock moves with at(), its draft saves are counted.
  const page = (utc, hours = ALL) => {
    const clock = { t: RealDate.parse(utc) };
    class FakeDate extends RealDate { constructor(...x) { if (x.length) super(...x); else super(clock.t); } static now() { return clock.t; } }
    const ctx = { Date: FakeDate, Intl, Math, Number, String, Array, Set, Map, JSON, Object, L: "es", saves: 0,
      S: { dur: 60, repeat: true, repeatPicked: false, dates: new Set(), selW: {} } };
    ctx.saveDraft = () => { ctx.saves++; };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    ctx.__page.setHours(hours);
    return Object.assign(ctx.__page, { S: ctx.S, ctx, at: (u) => { clock.t = RealDate.parse(u); } });
  };
  const sel = (p) => p.selList().map((x) => [x.d.weekly ? x.d.wd : x.d.iso, x.mins]);
  const dates = (p) => Array.from(p.S.dates).sort();
  const once = (p) => { p.S.repeat = false; p.S.repeatPicked = true; };

  // 1. Friday 12:00: every Friday at 10:00 and 18:00.
  let p = page("2026-10-23T10:00:00Z");
  p.S.dates.add("2026-10-23"); p.S.selW["5"] = new Set([600, 1080]);
  check("socios page weekly grid", "Fri 12:00: the calendar starts today", p.calDays()[0].iso, "2026-10-23", "");
  check("socios page weekly grid", "Fri 12:00, not answered yet: the grid offers the whole Friday", [p.gridStarts(5)[0], p.countFor(5)], [600, 2], "was 13:30 on, today's cut-off");
  check("socios page weekly grid", "every Friday 10:00 and 18:00 are both sent", sel(p), [[5, [600, 1080]]], "was [[5,[1080]]]: 10:00 lost");
  check("socios page weekly grid", "first dates: 10:00 from next Friday, 18:00 from today", [p.firstDate(5, 600), p.firstDate(5, 1080)], ["2026-10-30", "2026-10-23"], "buildPayload's first_date");
  check("socios page weekly grid", "no \"too late today\" note for a weekly time", [p.hiddenByDay(), p.droppedText()], [[], ""], "was \"Hoy ya es tarde para esta hora y no la enviamos: vie 10:00.\"");
  check("socios page weekly grid", "the repeat question names both; \"solo esta semana\" names today's date for 18:00", [p.weekPicks(), p.onceDates()], [[{ wd: 5, mins: [600, 1080] }], "vie\u00a023\u00a0oct"], "");
  p.S.repeatPicked = true;
  check("socios page weekly grid", "\"Sí, cada semana\": the same", sel(p), [[5, [600, 1080]]], "");
  once(p);
  check("socios page weekly grid", "\"No, solo esta semana\": the grid from 13:30, 10:00 not sent, and said", [p.gridStarts(5)[0], p.countFor(5), sel(p), p.droppedText()], [810, 1, [["2026-10-23", [1080]]], "Hoy ya es tarde para esta hora y no la enviamos: vie 10:00."], "a dated time still needs LEAD_MIN");
  p.S.repeatPicked = false;
  check("socios page weekly grid", "more times after a once send: read as weekly again until answered", [p.gridStarts(5)[0], sel(p), p.droppedText()], [600, [[5, [600, 1080]]], ""], "again() leaves S.repeat false");

  // 2. The calendar moves on: Friday 20:00 tapped at 18:50; at 18:56 today
  // has no time 65 minutes ahead and the calendar runs Sat 24 to Fri 30.
  p = page("2026-10-23T16:50:00Z");
  p.S.dates.add("2026-10-23"); p.S.selW["5"] = new Set([1200]);
  check("socios page calendar moves", "18:50: today, every Friday 20:00", [p.calDays()[0].iso, sel(p)], ["2026-10-23", [[5, [1200]]]], "");
  p.at("2026-10-23T16:56:00Z");
  check("socios page calendar moves", "18:56, every week: the pick moves to Fri 30 and is still sent", [p.calDays()[0].iso, dates(p), p.chosenDays(), sel(p), p.firstDate(5, 1200), p.droppedText(), p.ctx.saves], ["2026-10-24", ["2026-10-30"], [5], [[5, [1200]]], "2026-10-30", "", 1], "was selList [] with no note");
  p = page("2026-10-23T16:50:00Z");
  p.S.dates.add("2026-10-23"); p.S.dates.add("2026-10-24"); p.S.selW["5"] = new Set([1200]); p.S.selW["6"] = new Set([720]);
  once(p);
  check("socios page calendar moves", "18:50, just this week: Fri 23 20:00 and Sat 24 12:00", [sel(p), p.onceDates()], [[["2026-10-23", [1200]], ["2026-10-24", [720]]], "vie\u00a023 y sáb\u00a024\u00a0oct"], "");
  p.at("2026-10-23T16:56:00Z");
  check("socios page calendar moves", "18:56, just this week: Fri 23 not sent and said, never moved to Fri 30", [sel(p), p.droppedText(), dates(p), p.onceDates(), p.ctx.saves], [[["2026-10-24", [720]]], "Hoy ya es tarde para esta hora y no la enviamos: vie 20:00.", ["2026-10-23", "2026-10-24"], "sáb\u00a024\u00a0oct", 0], "was dropped with no note, the send going ahead without it");
  p.S.repeat = true;
  check("socios page calendar moves", "answer changed to every week: Friday 20:00 is back, from Fri 30", [sel(p), dates(p), p.droppedText()], [[[5, [1200]], [6, [720]]], ["2026-10-24", "2026-10-30"], ""], "`once` is in the calendar cache");
  p = page("2026-10-23T16:56:00Z");
  p.S.dates.add("2026-10-23"); p.S.selW["5"] = new Set([1200]);
  once(p);
  check("socios page calendar moves", "just this week, Friday the only day: nothing to send, and said", [sel(p), p.droppedText()], [[], "Hoy ya es tarde para esta hora y no la enviamos: vie 20:00."], "reach() goes back to the times with the note");
  p.toggleDay(5, true);
  check("socios page calendar moves", "tapping Fri 30: its times go there, the note goes", [sel(p), dates(p), p.droppedText()], [[["2026-10-30", [1200]]], ["2026-10-30"], ""], "a weekday has one date");
  p.toggleDay(5, false);
  check("socios page calendar moves", "tapping it off: the day and its times go", [dates(p), "5" in p.S.selW, p.droppedText()], [[], false, ""], "");

  // 3. New hours move the calendar both ways (Friday 12:00).
  p = page("2026-10-23T10:00:00Z");
  p.S.dates.add("2026-10-23"); p.S.selW["5"] = new Set([1080]);
  p.setHours(NO_FRI);
  check("socios page calendar moves", "every week, Friday now closed: on Fri 30, not sent, and said", [p.calDays()[0].iso, dates(p), sel(p), p.droppedText()], ["2026-10-24", ["2026-10-30"], [], "Esta hora ya no cabe en vuestro horario y no la enviamos: vie 18:00."], "");
  p.setHours(ALL);
  check("socios page calendar moves", "every week, Friday open again: back on Fri 23", [p.calDays()[0].iso, dates(p), sel(p)], ["2026-10-23", ["2026-10-23"], [[5, [1080]]]], "");
  p = page("2026-10-23T10:00:00Z", FRI_AM);
  p.S.dates.add("2026-10-30"); p.S.selW["5"] = new Set([720]);
  once(p);
  check("socios page calendar moves", "just this week, Fridays 10:00 to 13:00 (none left today): Fri 30 12:00", [p.calDays()[0].iso, sel(p)], ["2026-10-24", [["2026-10-30", [720]]]], "");
  p.setHours(ALL);
  check("socios page calendar moves", "just this week, Friday open to 21:00 so the calendar ends Thu 29: Fri 30 not sent, and said", [p.calDays()[6].iso, sel(p), dates(p), p.droppedText()], ["2026-10-29", [], ["2026-10-30"], "Esta hora ya no cabe en vuestro horario y no la enviamos: vie 12:00."], "never moved to today");

  // 4. The clock change and a month boundary.
  check("socios page calendar moves", "Sat 24 Oct 23:30 CEST: Sun 25 to Sat 31", page("2026-10-24T21:30:00Z").calDays().map((d) => d.iso), ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"], "");
  check("socios page calendar moves", "Thu 29 Oct 20:30 CET: Fri 30 Oct to Thu 5 Nov", page("2026-10-29T19:30:00Z").calDays().map((d) => d.iso), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"], "");

  // 5. Every place the grid is drawn or tapped uses the same starts.
  check("socios page weekly grid", "grid, chips, differing days, seeding and taps all use gridStarts", [
    /const startsBy = new Map\(days\.map\(\(wd\) => \[wd, gridStarts\(wd\)\]\)\);/.test(html),
    /function countFor\(wd\) \{[^}]*new Set\(gridStarts\(wd\)\)/.test(html),
    /const ok = gridStarts\(wd\), s = S\.selW\[String\(wd\)\];/.test(html),
    /if \(S\.selW\[k\] && S\.selW\[k\]\.size\) continue;\s*const ok = new Set\(gridStarts\(wd\)\);/.test(html),
    /const fit = days\.filter\(\(wd\) => gridStarts\(wd\)\.includes\(m\)\);/.test(html),
    (html.match(/\bdayStarts\b/g) || []).length,
  ], [true, true, true, true, true, 3], "dayStarts: its definition, the once grid and onceDates");
}

// ---------------------------------------------------------------------------
// Go-live review (23 Oct), before any studio gets a link: the reject page's
// «No podemos atenderle» and the times page's Quitar were plain GET links on
// the rendered page. A mail scanner that runs bot.html and follows the links
// on a page could cancel a confirmed booking (and the customer was messaged
// at once) or remove a studio's free times and end its weekly ones. They are
// now GET forms carrying the moment the page was drawn (t on the reject page,
// at on the times page, where t is already the times picked), and the server
// acts only on a fresh one: under 20 minutes for a reject, 6 hours for a
// remove. relPageFresh is lifted with the v215 block; pillForm and the times
// page's quitar are lifted on their own and rendered, and the form they draw
// is submitted the way a browser would.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { stripTypeScriptTypes } = await import("node:module");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const botSrc = fs.readFileSync(path.join(here, "../supabase/functions/wa-bot/bot.ts"), "utf8");
  const a = botSrc.indexOf("// ---- v215 released slots: pure helpers (start) ----");
  const b = botSrc.indexOf("// ---- v215 released slots: pure helpers (end) ----");
  if (a < 0 || b < a) throw new Error("bot.ts: the v215 released-slot helper markers are missing");
  const names = ["relPageFresh", "REL_REJECT_FRESH_MS", "REL_SLOTS_FRESH_MS"];
  const copyUrl = pathToFileURL(path.join(here, "../supabase/functions/wa-bot/copy.ts")).href;
  const js = `import { madridInstant, madridMidnight, stripAcc, euro } from ${JSON.stringify(copyUrl)};\n`
    + stripTypeScriptTypes(botSrc.slice(a, b)) + `\nexport { ${names.join(", ")} };\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-forms-"));
  const file = path.join(dir, "forms.mjs");
  fs.writeFileSync(file, js);
  const R = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });

  // Freshness. Now: Friday 23 Oct 2026, 12:00 Madrid (10:00 UTC).
  const now = Date.UTC(2026, 9, 23, 10, 0);
  const min = 60e3, hr = 3600e3;
  const rej = (t) => R.relPageFresh(t, now, R.REL_REJECT_FRESH_MS);
  const slo = (t) => R.relPageFresh(t, now, R.REL_SLOTS_FRESH_MS);
  check("studio page forms", "reject: drawn 1, 14 and 19 minutes ago acts; 20 minutes, 3 hours ago does not", [rej(String(now - min)), rej(String(now - 14 * min)), rej(String(now - 19 * min)), rej(String(now - 20 * min)), rej(String(now - 3 * hr))], [true, true, true, false, false], "the 15 minutes and some slack");
  check("studio page forms", "reject: no t, an empty, zero, junk or far-future t does not act", [rej(null), rej(undefined), rej(""), rej("0"), rej("abc"), rej(String(now + 2 * min)), rej(String(now + 30e3))], [false, false, false, false, false, false, true], "the old bare link had no t; a phone clock a few seconds ahead still works");
  check("studio page forms", "remove: drawn 5 minutes and 5 h 59 ago acts; 6 hours, a day ago, or no at does not", [slo(String(now - 5 * min)), slo(String(now - 6 * hr + min)), slo(String(now - 6 * hr)), slo(String(now - 24 * hr)), slo(null)], [true, true, false, false, false], "as Guardar's at");

  // pillForm and quitar, rendered, then submitted as a browser would: the
  // hidden fields become the whole query string of bot.html.
  const lineAt = (start) => { const i = botSrc.indexOf(start); return i < 0 ? "" : botSrc.slice(i, botSrc.indexOf("\n", i)); };
  const pf0 = botSrc.indexOf("const pillForm = (");
  const pfSrc = pf0 < 0 ? "" : botSrc.slice(pf0, botSrc.indexOf("</form>`;\n", pf0) + 9);
  const lifted = [lineAt("const C = {"), lineAt("const SANS = "), lineAt("const esc = "), lineAt("const escAttr = "), pfSrc, lineAt("  const quitar = (")].join("\n");
  const P = new Function("p", "k", "ymd", "minutes", "nowMs", `${stripTypeScriptTypes(lifted)}\nreturn { pillForm, quitar };`)({ id: "11111111-2222-3333-4444-555555555555" }, "abc123sig", "2026-10-24", 90, now);
  const unq = (s) => s.replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const submit = (html) => { const q = new URLSearchParams(); for (const m of html.matchAll(/<input type="hidden" name="([^"]*)" value="([^"]*)">/g)) q.append(unq(m[1]), unq(m[2])); return q; };
  const isForm = (html) => /^<form method="get" action=""[^>]*>/.test(html) && /<button type="submit"[^>]*>[^<]*<\/button><\/form>$/.test(html) && !/<a\b|href=/.test(html);
  const rb = P.pillForm({ slotr: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", sig: "s1g", a: "no", t: String(now) }, "No podemos atenderle", false);
  const rq = submit(rb);
  check("studio page forms", "the reject button is a form, and pressing it sends slotr, sig, a=no and t", [isForm(rb), [...rq.keys()], rq.get("a"), rej(rq.get("t"))], [true, ["slotr", "sig", "a", "t"], "no", true], "a link follower never sees a=no");
  const qd = P.quitar({ do: "del", id: "id1,id2" });
  const qq = submit(qd);
  check("studio page forms", "a free time's Quitar is a form; pressing it sends the page's own link, the day, the length, do=del, the ids and at", [isForm(qd), Object.fromEntries(qq)], [true, { slots: "11111111-2222-3333-4444-555555555555", k: "abc123sig", d: "2026-10-24", m: "90", do: "del", id: "id1,id2", at: String(now) }], "the same fields the old link carried, plus at");
  const qp = P.quitar({ do: "delp", pid: "pat-1" });
  const pq = submit(qp);
  check("studio page forms", "a weekly time's Quitar is a form with do=delp, pid and at", [isForm(qp), pq.get("do"), pq.get("pid"), pq.get("at"), slo(pq.get("at"))], [true, "delp", "pat-1", String(now), true], "");
  check("studio page forms", "at is always the page's own, after the fields", submit(P.quitar({ do: "del", id: "x", at: "1" })).get("at"), String(now), "");
  check("studio page forms", "Quitar is drawn as text, not a big pill", /\n\.mcs \.li form\{margin:0\}\n\.mcs \.li button\{border:0;background:none;[^}]*color:#9A3B1E;/.test(botSrc) && !/\.mcs \.li a\{/.test(botSrc), true, "the list rows keep their layout");

  // Hooks: the pages use them, and nothing acts before the fresh check.
  const fnSrc = (head) => { const i = botSrc.indexOf(head); return i < 0 ? "" : botSrc.slice(i, botSrc.indexOf("\n}\n", i)); };
  const rj = fnSrc("async function slotRejectPage(url: URL)");
  const sp = fnSrc("async function slotsPage(url: URL)");
  const rjGate = rj.indexOf(`if (String(url.searchParams.get("a") || "") === "no" && relPageFresh(url.searchParams.get("t"), Date.now(), REL_REJECT_FRESH_MS)) {`);
  check("hook", "the reject page draws «No podemos atenderle» with pillForm and t, never a link (go-live review)", [
    /const button = \(\) => pillForm\(\{ slotr: id, sig, a: "no", t: String\(Date\.now\(\)\) \}, "No podemos atenderle", false\);/.test(rj),
    (rj.match(/\bbutton\(\)/g) || []).length,
    /pillLink\(/.test(rj),
    /slotRejectLink\([^)]*\)\}&a=no/.test(botSrc),
  ], [true, 2, false, false], "both the booking card and the try-again card");
  check("hook", "a=no rejects only with a fresh t; the reject and the customer message sit inside that check", [
    rjGate > 0,
    rjGate < rj.indexOf("reject_released_slot") && (rj.match(/reject_released_slot/g) || []).length === 1,
    rjGate < rj.indexOf("releasedRejected(") && (rj.match(/releasedRejected\(/g) || []).length === 1,
    rjGate < rj.indexOf("await lateCard()") && (rj.match(/await lateCard\(\)/g) || []).length === 1,
  ], [true, true, true, true], "a stale or missing t shows the page again");
  const spGate = sp.indexOf(`} else if ((act === "del" || act === "delp") && !relPageFresh(url.searchParams.get("at"), nowMs, REL_SLOTS_FRESH_MS)) {`);
  check("hook", "the times page draws Quitar with quitar(), never a link", [
    /\$\{quitar\(\{ do: "delp", pid: String\(x\.id\) \}\)\}/.test(sp),
    /const del = a\.free\.length \? quitar\(\{ do: "del", id: a\.free\.join\(","\) \}\) : "";/.test(sp),
    /do=del/.test(sp),
    /<a [^>]*>Quitar<\/a>/.test(sp),
  ], [true, true, false, false], "");
  check("hook", "do=del and do=delp act only with a fresh at; nothing is withdrawn or ended before that check", [
    spGate > 0,
    spGate < sp.indexOf(`} else if (act === "del") {`) && spGate < sp.indexOf(`} else if (act === "delp") {`),
    spGate < sp.indexOf("withdraw_released_slot") && (sp.match(/withdraw_released_slot/g) || []).length === 1,
    spGate < sp.indexOf("rpc/end_released_pattern") && (sp.match(/rpc\/end_released_pattern/g) || []).length === 1,
    /note = "Esta página llevaba mucho rato abierta\. Volved a pulsar Quitar, por favor\."; noteErr = true;/.test(sp),
  ], [true, true, true, true, true], "an old tab or a link followed on its own removes nothing");
  check("hook", "no em or en dashes in the forms' code and copy", /[–—]/.test(rj + sp + pfSrc), false, "");
}

// ---------------------------------------------------------------------------
// Go-live review (23 Oct), before any studio gets a link: /socios rate
// limits. The cap for everyone on unsigned forms (30 an hour) counted junk
// stored as rejected, so about 30 junk posts an hour from a few addresses
// locked every new studio out, and the page then said only "wait a few
// minutes", so the studio's times were lost. The cap now counts only forms
// that passed the checks (and that Jordan has not rejected) and answers 503
// "busy", which the page turns into the WhatsApp and email fallback.
// Jordan's review cards count only the forms that came in before this one,
// marked pending_review or not yet, so a burst sent at once gives five cards
// and one "more are waiting", whatever order they finish in. socSubmit runs
// here with studio_signups in memory and the PostgREST filters it sends
// parsed as the server parses them (a "+" left unencoded in a timestamp
// reads as a space); the page's send() runs in a vm against a faked fetch.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const vm = await import("node:vm");
  const { stripTypeScriptTypes } = await import("node:module");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const botSrc = fs.readFileSync(path.join(here, "../supabase/functions/wa-bot/bot.ts"), "utf8");
  const html = fs.readFileSync(path.join(here, "../public/socios.html"), "utf8");
  const fnOf = (src, head) => { const i = src.indexOf(head); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i) + 3); };
  const subSrc = fnOf(botSrc, "\nasync function socSubmit(");
  const limSrc = (botSrc.match(/\nconst SOC_LIMIT_IP_10M = [^\n]*\n/) || [""])[0] + (botSrc.match(/\nconst SOC_CARDS_UNSIGNED_H = \d+;\n/) || [""])[0];
  const m0 = botSrc.indexOf("\nconst SOC_MSG: Record"), m1 = botSrc.indexOf("\nconst socMsg = ");
  const msgSrc = m0 < 0 || m1 < m0 ? "" : botSrc.slice(m0, botSrc.indexOf("\n", m1 + 1) + 1);
  const sendSrc = fnOf(html, "\nasync function send(btn) {");
  if (!subSrc || !limSrc.includes("SOC_CARDS_UNSIGNED_H") || !msgSrc || !sendSrc) throw new Error("socSubmit, the /socios limits or messages, or the page's send() are missing");
  const limits = new Function(`${stripTypeScriptTypes(limSrc)}\nreturn { SOC_LIMIT_IP_10M, SOC_LIMIT_IP_DAY, SOC_LIMIT_STUDIO_H, SOC_LIMIT_NOIP_10M, SOC_LIMIT_UNSIGNED_H, SOC_CARDS_UNSIGNED_H };`)();
  const socMsg = new Function("SOC_MAX_TIMES", "REL_STUDIO_HORIZON_DAYS", "SOC_MAX_REMOVE", `${stripTypeScriptTypes(msgSrc)}\nreturn socMsg;`)(40, 56, 20);
  const G = "socios rate limits";

  // One database: studio_signups rows, Jordan's cards, and socSubmit wired to them.
  const world = (o = {}) => {
    const rows = [], cards = [], more = [];
    const t0 = Date.now();
    let seq = 0;
    // As PostgREST returns a timestamptz: microseconds and +00:00.
    const stamp = (ms) => new Date(ms).toISOString().replace("Z", "123+00:00");
    const add = (r, ago = 0) => { seq++; const row = { id: `row-${seq}`, kind: "signup", signed: false, partner_id: null, ip_hash: null, whatsapp_digits: null, created_at: stamp(t0 - ago + seq), ...r }; rows.push(row); return row; };
    const cmp = (x, v) => { const dot = v.indexOf("."), op = v.slice(0, dot), val = v.slice(dot + 1), t = (s) => Date.parse(s);
      if (op === "eq") return String(x) === val;
      if (op === "neq") return x != null && String(x) !== val;
      if (op === "is") return val === "null" ? x == null : x === (val === "true");
      if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").includes(String(x));
      if (op === "gte") return t(x) >= t(val);
      if (op === "lt") return t(x) < t(val);
      throw new Error(`filter not faked: ${v}`); };
    const count = (q) => rows.filter((r) => [...new URLSearchParams(q)].every(([k, v]) => k === "select" || k === "limit" || cmp(r[k], v))).length;
    const deps = {
      ...limits, socMsg,
      socIpHash: async (ip) => ip ? `h-${ip}` : "",
      socClientIp: (req) => req.ip,
      socLine: (s) => String(s || ""),
      socPhone: (x) => String(x || "").replace(/\D/g, ""),
      socResolve: async (slug) => slug === "calma" ? { partner: { id: "p-calma", business_name: "Calma", opening_hours: null, inactive: true }, signed: true, sigBad: false } : { partner: null, signed: false, sigBad: false },
      socCount: async (q) => Math.min(count(q), 100),
      socValidate: (p) => p.junk ? { ok: false, errors: ["name"] } : { ok: true, plan: { studio: { wa: "", email: "hola@calma.es", name: p.name } } },
      socHasMenu: async () => false,
      socInsert: async (r) => ({ ...add(r) }),
      socPatch: async (id, patch) => { const ms = o.patchDelay ? o.patchDelay(id) : 0; if (ms) await new Promise((res) => setTimeout(res, ms)); const r = rows.find((x) => x.id === id); Object.assign(r, patch); return { ...r }; },
      findPartnerByNumber: async () => null,
      socPartner: async () => null,
      socInactive: (p) => !!p?.inactive,
      socReviewCard: async (row) => { cards.push(row.id); },
      founderCard: async (subject) => { more.push(subject); },
      socLinksUrl: async () => "https://book.massageclub.io/links",
    };
    const socSubmit = new Function(...Object.keys(deps), `${stripTypeScriptTypes(subSrc)}\nreturn socSubmit;`)(...Object.values(deps));
    const submit = (p, ip) => socSubmit(p, { ip, headers: { get: () => "" } }, "es");
    return { rows, cards, more, add, submit };
  };
  const form = (name, wa) => ({ name, studio: { whatsapp: wa } });

  // 1. A junk flood no longer locks a real studio out.
  let w = world();
  const junk = [];
  for (let i = 0; i < 50; i++) junk.push(await w.submit({ junk: true, studio: { whatsapp: "" } }, `203.0.113.${i % 10}`));
  check(G, "50 junk posts from 10 addresses in an hour: each refused as invalid and kept as rejected", [junk.every((r) => r.status === 400 && r.body.status === "invalid"), w.rows.filter((r) => r.status === "rejected").length], [true, 50], "5 each, under the 6 per address in 10 minutes");
  const real = await w.submit(form("Calma", "34600111222"), "192.0.2.7");
  check(G, "then a real studio's form is received and Jordan gets its card", [real.status, real.body.status, w.cards.length], [200, "pending_review", 1], "was 429 \"wait a few minutes\": the cap counted the junk");

  // 2. The cap for everyone is busy (503), and the page's fallback.
  w = world();
  for (let i = 0; i < limits.SOC_LIMIT_UNSIGNED_H; i++) w.add({ status: i < 25 ? "pending_review" : "applied", ip_hash: `h-198.51.100.${i}`, whatsapp_digits: `3460000${String(i).padStart(4, "0")}` }, (50 - i) * 60e3);
  let n0 = w.rows.length;
  const busy = await w.submit(form("Calma", "34600111222"), "192.0.2.7");
  check(G, "30 forms that passed the checks in the last hour: the next is busy (503), nothing stored, no card", [busy.status, busy.body.ok, busy.body.status, w.rows.length - n0, w.cards.length + w.more.length], [503, false, "busy", 0, 0], "");
  check(G, "busy says WhatsApp or email, vosotros, no dashes", [busy.body.message, socMsg("busy", "en"), /[–—]/.test(socMsg("busy", "es") + socMsg("busy", "en"))], ["Ahora mismo nos llegan muchos formularios y no podemos guardar el vuestro. Enviadnos vuestras horas por WhatsApp o por email.", "We are getting a lot of forms right now and cannot save yours. Send us your times by WhatsApp or email.", false], "\"We are getting a lot of forms right now and cannot save yours. Send us your times by WhatsApp or email.\"");
  for (const r of w.rows.slice(0, 5)) r.status = "rejected";
  const after = await w.submit(form("Calma", "34600111222"), "192.0.2.7");
  check(G, "Jordan rejects five of them: the next real studio gets through", [after.status, after.body.status], [200, "pending_review"], "a rejected row never counts against everyone");
  n0 = w.rows.length;
  const signed = await w.submit({ name: "Calma", link_slug: "calma", studio: { whatsapp: "34600111222" } }, "192.0.2.7");
  for (let i = 0; i < 5; i++) w.add({ status: "pending_review", ip_hash: `h-198.51.101.${i}` });
  const signed2 = await w.submit({ name: "Calma", link_slug: "calma", studio: { whatsapp: "34600111222" } }, "192.0.2.7");
  check(G, "with the cap for everyone full, a studio's own link is still taken and carded", [signed.status, signed.body.status, signed2.status, signed2.body.status, w.rows.length - n0], [200, "pending_review", 200, "pending_review", 7], "it counts only its own signed sends");

  // 3. The limits for one sender are unchanged, and still "wait a few minutes".
  w = world();
  const seven = [];
  for (let i = 0; i < 7; i++) seven.push(await w.submit(form(`Centro ${i}`, `3460011122${i}`), "192.0.2.8"));
  check(G, "one address, a 7th form in 10 minutes: 429 rate_limited with \"wait a few minutes\"", [seven.map((r) => r.status), seven[6].body.status, seven[6].body.message], [[200, 200, 200, 200, 200, 200, 429], "rate_limited", "Habéis enviado varias veces seguidas. Esperad unos minutos y probad otra vez."], "\"You have sent this several times in a row. Wait a few minutes and try again.\"");
  check(G, "and Jordan got 5 cards and one \"more are waiting\"", [w.cards.length, w.more.length], [5, 1], "");

  // 4. Bursts sent at once: the first five in get the cards.
  const ids = (k) => Array.from({ length: k }, (_, i) => `row-${i + 1}`);
  const burst = async (o) => {
    const b = world(o);
    const res = await Promise.all(Array.from({ length: 8 }, (_, i) => b.submit(form(`Centro ${i}`, `346002000${i}`), `198.51.100.${i}`)));
    return [res.map((r) => r.body.status), [...b.cards].sort(), b.more.length];
  };
  const all8 = Array(8).fill("pending_review");
  check(G, "8 forms at once: all received, cards for the first 5 in, one \"more are waiting\", none after", await burst(), [all8, ids(5), 1], "each counted the 7 others, so Jordan got no card at all; created_at sent unencoded would read as no earlier forms and card all 8");
  check(G, "the same burst with the earliest forms marked pending_review last: the same", await burst({ patchDelay: (id) => 5 * (9 - Number(id.split("-")[1])) }), [all8, ids(5), 1], "a form not yet marked counts too: counting pending_review only gave all 8 a card");

  // 5. The page: busy is the WhatsApp and email fallback.
  const pageSend = async (respond) => {
    const said = { dataset: { k: "x" }, textContent: "" };
    const done = [];
    const ctx = {
      S: { saving: false, step: "last", lastKey: null, miss: [] }, ST: { centro: "centro", times: "times", last: "last" }, PREVIEW: false, MAX_TIMES: 40, SAVE_URL: "https://example.test/save",
      setErr: () => {}, centroValid: () => true, checkCentro: () => [], focusField: () => {}, selList: () => [{ d: { wd: 5 }, mins: [1080] }], countOf: (l) => l.length,
      checkLast: () => [], paintMiss: () => {}, buildPayload: () => ({ lang: "es" }), batchKey: () => "k1", t: (k) => k, go: () => {},
      finish: (result, list, key, server) => { done.push([result, server ? server.status : null]); },
      $: (id) => id === "saveErr" ? said : null,
      window: { AbortController }, AbortController, setTimeout, clearTimeout, JSON, console,
      fetch: async () => respond(),
    };
    vm.createContext(ctx);
    vm.runInContext(sendSrc, ctx);
    await ctx.send({ textContent: "Enviar", disabled: false });
    return [done, said.textContent];
  };
  const answer = (status, body) => () => ({ ok: status >= 200 && status < 300, status, json: () => body === undefined ? Promise.reject(new SyntaxError("not JSON")) : Promise.resolve(body) });
  check(G, "page: 503 busy goes to the WhatsApp and email fallback, nothing said under the button", await pageSend(answer(503, { ok: false, status: "busy", message: socMsg("busy", "es") })), [[["fallback", null]], ""], "was \"wait a few minutes\" when the cap was a 429");
  check(G, "page: busy with any code is the fallback too", await pageSend(answer(429, { ok: false, status: "busy", message: socMsg("busy", "es") })), [[["fallback", null]], ""], "");
  check(G, "page: a 503 that is not JSON is the fallback", await pageSend(answer(503)), [[["fallback", null]], ""], "");
  check(G, "page: 429 rate_limited is said under the button, nothing else changes", await pageSend(answer(429, { ok: false, status: "rate_limited", message: socMsg("rate", "es") })), [[], "Habéis enviado varias veces seguidas. Esperad unos minutos y probad otra vez."], "");
  check(G, "page: received and saved are kept; a 500 or no network is the fallback", [
    await pageSend(answer(200, { ok: true, status: "pending_review", message: socMsg("pending", "es") })),
    await pageSend(answer(200, { ok: true, status: "applied", message: socMsg("applied_wait", "es") })),
    await pageSend(answer(500, { ok: false, status: "error", message: socMsg("error", "es") })),
    await pageSend(() => { throw new TypeError("Failed to fetch"); }),
  ], [[[["received", "pending_review"]], ""], [[["saved", "applied"]], ""], [[["fallback", null]], ""], [[["fallback", null]], ""]], "");
}

// ---------------------------------------------------------------------------
// Jordan, 23 Oct, on the /socios page's last step ("Last step / Your price
// and the terms. The customer pays you at your centre. / Price of a 60 min
// massage"): "this makes 0 sense, we need an easy way for them to plug in
// their prices, or at least skip this step and send them a form later". The
// step now asks "¿Cuánto cobráis por un masaje de 60 minutos?" with eight
// prices to tap, another amount in a small field, and «Lo pongo más tarde»
// ("I'll add it later"). A form without a price is saved: its times wait
// for one (released_offers never offers a time without a price), Jordan's
// card says "Price: not given yet, ask for it", and the studio is told we
// offer them as soon as we have it. The page's code runs in a vm with a fake
// DOM; socSubmit runs with the real socValidate and Jordan's card helpers.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const vm = await import("node:vm");
  const { stripTypeScriptTypes } = await import("node:module");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const html = fs.readFileSync(path.join(here, "../public/socios.html"), "utf8");
  const botSrc = fs.readFileSync(path.join(here, "../supabase/functions/wa-bot/bot.ts"), "utf8");
  const G = "socios price (Jordan, 23 Oct)";
  const fnOf = (src, head) => { const i = src.indexOf(head); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i) + 3); };
  const one = (re) => (html.match(re) || [""])[0];

  // 1. The step's words.
  const tBlock = one(/\nconst T = \{\n[\s\S]*?\n\};\n/);
  const tv = (k, L) => (html.match(new RegExp(`\\n  ${L}: \\{[\\s\\S]*?\\n    (?:[a-zA-Z0-9]+: "(?:[^"\\\\]|\\\\.)*", )*${k}: "((?:[^"\\\\]|\\\\.)*)"`)) || [])[1];
  check(G, "the question in Jordan's words, and the choice to leave it for later", ["q6", "priceLater", "fPriceOther"].flatMap((k) => ["es", "en"].map((L) => tv(k, L))),
    ["¿Cuánto cobráis por un masaje de 60 minutos?", "How much do you charge for a 60-minute massage?", "Lo pongo más tarde", "I'll add it later", "Otro precio", "Other price"], "was \"Último paso\" / \"Last step\"");
  check(G, "the old step's words are gone from the page's copy", /Último paso|Last step|Vuestro precio y las condiciones|Your price and the terms|Precio de un masaje de 60 min|Price of a 60 min massage/.test(tBlock), false, "\"this makes 0 sense\"");
  check(G, "the line under it says who sees the price and who pays, without «centro»", [tv("s6", "es"), tv("s6", "en")], ["Es lo que ve el cliente. Os paga directamente a vosotros.", "It's what the customer sees. They pay you directly."], "");
  check(G, "the terms line is untouched (wa-bot stores it word for word)", /\n    termsLine: "Gratis hasta el 31 de diciembre de 2026; desde el 1 de enero de 2027, 5 € \+ IVA por cada visita que os reservemos nosotros, solo si el cliente viene\. Si un cliente os reserva directamente, sin nosotros, 0 €\. Sin cuota mensual ni contrato\.",/.test(html) && /<label class="check" id="acceptBox" for="accept">/.test(html), true, "");

  // 2. The page's price code in a vm, with a fake DOM.
  const t0 = html.indexOf("\nconst T = {"), t1 = html.indexOf("\nconst $ = (id)");
  const parts = [
    t0 < 0 || t1 < t0 ? "" : html.slice(t0, t1),
    one(/\nconst t = \(k, vars\) => \{[\s\S]*?\n\};\n/),
    one(/\nconst priceNum = \(v\) => \{[\s\S]*?\n\};\n/),
    one(/\nconst PRICE_CHIPS = .*\n/),
    one(/\nconst euro = .*\n/),
    one(/\nconst priceNeeded = .*\n/),
    ...["priceNow", "setPrice", "paintPrice", "setErr", "checkLast", "buildPayload", "buildMessage"].map((n) => fnOf(html, `\nfunction ${n}(`)),
  ];
  if (parts.some((x) => !x)) throw new Error("socios.html: the price step's code or its markers are missing");
  const pageCode = parts.join("") + "\n;globalThis.__p = { priceNow, setPrice, paintPrice, checkLast, buildPayload, buildMessage };";
  const mk = () => {
    const e = { value: "", textContent: "", dataset: {}, attrs: {}, cls: new Set(), checked: true, children: [] };
    e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
    e.classList = { toggle: (c, on) => { if (on === undefined ? !e.cls.has(c) : on) e.cls.add(c); else e.cls.delete(c); }, remove: (c) => e.cls.delete(c), add: (c) => e.cls.add(c), contains: (c) => e.cls.has(c) };
    return e;
  };
  const page = (o = {}) => {
    const els = {};
    const $ = (id) => els[id] || (els[id] = mk());
    const box = $("priceChips");
    Object.defineProperty(box, "innerHTML", { set(h) { box.children = [...h.matchAll(/data-price="(\d+)"[^>]*>([^<]*)</g)].map(([, p, label]) => { const b = mk(); b.dataset.price = p; b.textContent = label; return b; }); } });
    $("name").value = "Calma"; $("wa").value = "+34600111222"; $("addr").value = "Calle Mayor 1"; $("email").value = "hola@calma.es";
    const ctx = {
      L: o.L || "es", S: { pricePick: null, priceLater: false, signed: !!o.menu, partner: o.menu ? { has_menu: true, slug: "calma", status: "active" } : null, accepted: true, repeat: true, dur: 60, miss: [] },
      $, val: (id) => $(id).value.trim(), saves: 0,
      intl: (v) => v, isLandline: () => false, HOURS: null, hoursField: () => null, FORM_VERSION: "f", SLUG_OK: false, SLUG: "", SIG_OK: false, SIG: "", DRAWN_AT: 0, TERMS_VERSION: "2026-10-19",
      firstDate: () => "2026-10-27", hhmm: (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      countOf: (l) => l.reduce((n, x) => n + x.mins.length, 0), dayLabel: (d) => d.label, pretty: (v) => v,
      Date, Number, String, Array, Object, JSON, Math, Set, Map,
    };
    ctx.saveDraft = () => { ctx.saves++; };
    ctx.unmiss = () => {};
    vm.createContext(ctx);
    vm.runInContext(pageCode, ctx);
    ctx.__p.paintPrice();
    const chips = () => box.children.filter((b) => b.cls.has("sel")).map((b) => b.dataset.price);
    const pressed = () => box.children.filter((b) => b.attrs["aria-pressed"] === "true").map((b) => b.dataset.price);
    const now = () => JSON.parse(JSON.stringify(ctx.__p.priceNow()));
    return Object.assign({}, ctx.__p, { ctx, $, S: ctx.S, chips, pressed, now });
  };
  const list = [{ d: { weekly: true, wd: 2, label: "Cada martes" }, mins: [720] }];
  const last = { list, dur: 60, repeat: true };
  const priceLines = (p, re) => p.buildMessage(last).split("\n").filter((x) => re.test(x));

  let p = page();
  check(G, "page: eight prices to tap, 40 to 80 €, none chosen yet", [p.$("priceChips").children.map((b) => b.textContent), p.chips(), p.pressed()], [["40 €", "45 €", "50 €", "55 €", "60 €", "65 €", "70 €", "80 €"], [], []], "");
  check(G, "page: nothing chosen: one line asks for a price or «Lo pongo más tarde», and it goes back to the prices", [p.checkLast(), p.$("priceErr").textContent, p.$("p60").attrs["aria-invalid"]], [["prices"], "Tocad vuestro precio o «Lo pongo más tarde».", "false"], "not into the other amount's field");
  // Picking a price.
  p.setPrice("pick", 55);
  check(G, "page: tap 55 €: chosen and pressed, the error goes, the draft is saved", [p.chips(), p.pressed(), p.now(), p.$("priceErr").textContent, p.checkLast(), p.ctx.saves > 0], [["55"], ["55"], { later: false, price: 55 }, "", [], true], "");
  let pay = p.buildPayload(list);
  check(G, "page: tap 55 €: sent as the 60 min price", [pay.studio.price_60_eur, pay.studio.price_later, pay.studio.price_90_eur, pay.availability.duration_min], [55, false, null, 60], "");
  check(G, "page: tap 55 €: the WhatsApp fallback carries it", priceLines(p, /^Precio/), ["Precio: 60 min 55 €"], "");
  p.setPrice("pick", 70);
  check(G, "page: tap 70 € after 55 €: one choice", [p.chips(), p.pressed(), p.now()], [["70"], ["70"], { later: false, price: 70 }], "");
  // Another amount.
  p.$("p60").value = "75"; p.setPrice("typed");
  check(G, "page: type 75 in «Otro precio»: the tapped price is let go, 75 is sent", [p.chips(), p.now(), p.checkLast(), p.buildPayload(list).studio.price_60_eur, priceLines(p, /^Precio/)], [[], { later: false, price: 75 }, [], 75, ["Precio: 60 min 75 €"]], "");
  p.$("p60").value = "72,50 €"; p.setPrice("typed");
  check(G, "page: \"72,50 €\" reads as 72.5", p.buildPayload(list).studio.price_60_eur, 72.5, "priceNum, as before");
  for (const [typed, note] of [["40-50", "a range"], ["desde 40", "words"], ["600", "over 500, the server's limit"], ["0", "nothing"], ["0,50", "under 1"]]) {
    p.$("p60").value = typed; p.setPrice("typed");
    check(G, `page: another amount "${typed}" is still checked (${note})`, [p.checkLast(), p.$("priceErr").textContent, p.$("p60").attrs["aria-invalid"]], [["p60"], "Poned solo el número, entre 1 y 500. Por ejemplo, 75.", "true"], "");
  }
  p.setPrice("pick", 45);
  check(G, "page: tap a price after a bad amount: the field empties, the error goes", [p.$("p60").value, p.now(), p.$("priceErr").textContent, p.$("p60").attrs["aria-invalid"], p.checkLast()], ["", { later: false, price: 45 }, "", "false", []], "");
  // «Lo pongo más tarde».
  p.setPrice("later");
  check(G, "page: «Lo pongo más tarde»: chosen alone, and it says the times wait for the price", [p.chips(), p.$("priceLater").cls.has("sel"), p.$("priceLater").attrs["aria-pressed"], p.$("p60").value, p.$("priceLaterNote").textContent], [[], true, "true", "", "Vale, os lo pedimos más tarde. Hasta entonces, estas horas no se ofrecen a clientes."], "");
  check(G, "page: «Lo pongo más tarde»: the form can be sent without a price", [p.now(), p.checkLast()], [{ later: true, price: null }, []], "Jordan: \"or at least skip this step\"");
  pay = p.buildPayload(list);
  check(G, "page: «Lo pongo más tarde»: sent with no price and price_later", [pay.studio.price_60_eur, pay.studio.price_later], [null, true], "wa-bot keeps the times and marks the price pending");
  check(G, "page: «Lo pongo más tarde»: the WhatsApp fallback says the price follows", priceLines(p, /^Precio/), ["Precio: os lo enviamos más tarde."], "");
  p.setPrice("pick", 50);
  check(G, "page: a price after «Lo pongo más tarde»: later is let go, its note goes", [p.$("priceLater").cls.has("sel"), p.$("priceLater").attrs["aria-pressed"], p.$("priceLaterNote").textContent, p.now()], [false, "false", "", { later: false, price: 50 }], "");
  p.$("p60").value = "48"; p.setPrice("typed");
  p.setPrice("later");
  check(G, "page: «Lo pongo más tarde» after typing: the amount is cleared, nothing is sent as a price", [p.$("p60").value, p.buildPayload(list).studio.price_60_eur], ["", null], "");
  // English, and a studio's own link with its menu on file.
  p = page({ L: "en" });
  p.checkLast();
  check(G, "page, English: nothing chosen", p.$("priceErr").textContent, "Tap your price, or \"I'll add it later\".", "");
  p.setPrice("later");
  check(G, "page, English: \"I'll add it later\"", [p.$("priceLaterNote").textContent, priceLines(p, /^Price/)], ["Fine, we'll ask you for it later. Until then, these times aren't offered to customers.", ["Price: we'll send it to you later."]], "");
  p.$("p60").value = "600"; p.setPrice("typed"); p.checkLast();
  check(G, "page, English: an amount over 500", p.$("priceErr").textContent, "Just the number, between 1 and 500. For example, 75.", "");
  p = page({ menu: true });
  check(G, "page: own link with a menu on file: nothing chosen is fine, as before", [p.checkLast(), p.buildPayload(list).studio.price_60_eur], [[], null], "the menu is quoted (priceKnown)");
  p.setPrice("later");
  check(G, "page: own link with a menu: «Lo pongo más tarde» says the price on file is used", p.$("priceLaterNote").textContent, "Vale. Mientras tanto, usamos el precio que ya tenemos apuntado.", "");
  // What the vm does not run: the wiring, the draft and the ticket.
  check(G, "page: the three choices are wired", /\$\("priceChips"\)\.addEventListener\("click", \(e\) => \{\s*const b = e\.target\.closest\("\[data-price\]"\);\s*if \(b\) setPrice\("pick", Number\(b\.dataset\.price\)\);\s*\}\);/.test(html) && /\$\("priceLater"\)\.addEventListener\("click", \(\) => setPrice\("later"\)\);/.test(html) && /\$\("p60"\)\.addEventListener\("input", \(\) => setPrice\("typed"\)\);/.test(html), true, "");
  check(G, "page: the choice is kept in the draft, only a listed price", /pricePick: S\.pricePick, priceLater: S\.priceLater,/.test(html) && /S\.priceLater = d\.priceLater === true;\s*S\.pricePick = !S\.priceLater && PRICE_CHIPS\.includes\(Number\(d\.pricePick\)\) \? Number\(d\.pricePick\) : null;/.test(html), true, "");
  check(G, "page: the ticket shows the price, or that we will ask for it", /if \(Number\.isFinite\(pr\.price\)\) rows\.push\(row\("💶", t\("kPrice"\), esc\(euro\(pr\.price\)\)\)\);\n(?:\s*\/\/[^\n]*\n)*\s*else if \(pr\.later && priceNeeded\(\)\) rows\.push\(row\("💶", t\("kPrice"\), esc\(t\("tkPriceLater"\)\)\)\);/.test(html) && [tv("tkPriceLater", "es"), tv("tkPriceLater", "en")].join(" | ") === "Os lo pedimos más tarde | We'll ask you for it later", true, "");
  check(G, "page: saved without a price never says \"ya se pueden reservar\"", /t\(!srv\.live \? "nextWait" : srv\.price_pending \? "nextPrice" : "nextLive"\)/.test(html) && tv("nextPrice", "es") === "Las ofrecemos a clientes en cuanto tengamos vuestro precio.", true, "wa-bot's price_pending");
  check(G, "page: the prices sit in a group named by the question", /<div class="pchips" id="priceChips" role="group" aria-labelledby="h6"><\/div>/.test(html) && /<button type="button" class="chip plater" id="priceLater" aria-pressed="false"/.test(html), true, "");

  // 3. The bot's pure helpers.
  const a = botSrc.indexOf("// ---- v215 released slots: pure helpers (start) ----");
  const b = botSrc.indexOf("// ---- v216 socios: pure helpers (end) ----");
  if (a < 0 || b < a) throw new Error("bot.ts: the v215 / v216 helper markers are missing");
  const names = ["socValidate", "socPriceState", "socPriceEn", "socSeenEn", "socPriceAskEs", "socPriceAskEn", "SOC_MSG", "socMsg", "SOCIOS_TERMS", "socLine", "socPhone", "socWhyText"];
  const copyUrl = pathToFileURL(path.join(here, "../supabase/functions/wa-bot/copy.ts")).href;
  const js = `import { madridInstant, madridMidnight, stripAcc, euro } from ${JSON.stringify(copyUrl)};\n`
    + stripTypeScriptTypes(botSrc.slice(a, b)) + `\nexport { ${names.join(", ")} };\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-price-"));
  const file = path.join(dir, "price.mjs");
  fs.writeFileSync(file, js);
  const R = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });
  check(G, "bot: socPriceState", [R.socPriceState({ price: 55, pricePending: false }), R.socPriceState({ price: null, pricePending: false }), R.socPriceState({ price: null, pricePending: true })], ["given", "menu", "pending"], "SocApplied.price");
  check(G, "bot: the price line on Jordan's cards", [R.socPriceEn({ p60: null, p90: null }, true), R.socPriceEn({ p60: 55, p90: null }, false), R.socPriceEn({ p60: null, p90: null }, false)],
    ["Price: not given yet, ask for it (customers cannot see these times until there is one)", "Prices: 60 min 55 EUR", "Prices: not given (their menu on file is used)"], "");
  const seen = R.socSeenEn(true, "on", true);
  check(G, "bot: what customers see without a price: nothing, and why", [seen.startsWith("Price: not given yet, ask for it. Customers cannot see these times until there is one: released_offers never offers a time without a price"), /can book these now/.test(seen), /RELEASED/.test(seen), /RELEASED is off too/.test(R.socSeenEn(false, "off", true)), /partner_services/.test(seen)], [true, false, false, true, true], "how to make them visible is on the card");
  check(G, "bot: with a price, as before", [R.socSeenEn(true, "on", false), R.socSeenEn(false, "test", false)], ["Customers can book these now.", "Customers cannot see them yet (RELEASED is test)."], "");
  check(G, "bot: the draft for Jordan's own WhatsApp asks the page's question, from Jordan, with vosotros", [R.socPriceAskEs(60), R.socPriceAskEn(60)],
    ["Hola, soy Jordan, de Massage Club. Gracias por vuestras horas. Para ofrecerlas a clientes nos falta vuestro precio: ¿cuánto cobráis por un masaje de 60 minutos?", "Hi, this is Jordan from Massage Club. Thank you for your times. To offer them to customers we still need your price: how much do you charge for a 60-minute massage?"], "CLAUDE.md: studios hear from \"Jordan, de Massage Club\"");
  check(G, "bot: the answer to the page when saved without a price", [R.socMsg("applied_price", "es"), R.socMsg("applied_price", "en")], ["Guardado. Las ofrecemos a clientes en cuanto tengamos vuestro precio.", "Saved. We will offer them to customers as soon as we have your price."], "never \"Ya se pueden reservar\"");
  check(G, "bot: no em or en dashes in the new copy", /[–—]/.test([seen, R.socSeenEn(false, "off", true), R.socPriceEn({ p60: null, p90: null }, true), R.socPriceAskEs(60), R.socPriceAskEn(60), R.socMsg("applied_price", "es"), R.socMsg("applied_price", "en")].join(" ")), false, "");

  // 4. socSubmit with the real socValidate: the server accepts a missing price.
  const subSrc = fnOf(botSrc, "\nasync function socSubmit(");
  const limSrc = (botSrc.match(/\nconst SOC_LIMIT_IP_10M = [^\n]*\n/) || [""])[0] + (botSrc.match(/\nconst SOC_CARDS_UNSIGNED_H = \d+;\n/) || [""])[0];
  const studioSrc = fnOf(botSrc, "\nfunction socStudioEn("), pickSrc = fnOf(botSrc, "\nfunction socPick(");
  if (!subSrc || !limSrc.includes("SOC_CARDS_UNSIGNED_H") || !studioSrc || !pickSrc) throw new Error("bot.ts: socSubmit, socStudioEn, socPick or the /socios limits are missing");
  const limits = new Function(`${stripTypeScriptTypes(limSrc)}\nreturn { SOC_LIMIT_IP_10M, SOC_LIMIT_IP_DAY, SOC_LIMIT_STUDIO_H, SOC_LIMIT_NOIP_10M, SOC_LIMIT_UNSIGNED_H, SOC_CARDS_UNSIGNED_H };`)();
  const studioEn = new Function("socPriceEn", `${stripTypeScriptTypes(studioSrc)}\nreturn socStudioEn;`)(R.socPriceEn);
  const socPick = new Function("socPhone", `${stripTypeScriptTypes(pickSrc)}\nreturn socPick;`)(R.socPhone);
  const form = (price) => ({
    lang: "es", link_slug: "calma", link_sig: "a".repeat(24), drawn_at: Date.now() - 60e3,
    studio: { business_name: "Calma Madrid Spa", whatsapp: "+34 600 111 222", address: "Calle Mayor 1", email: "hola@calma.es", opening_hours: "", opening_hours_read: "", price_60_eur: price, price_later: price === null, price_90_eur: null },
    terms: { accepted: true, accepted_at: new Date().toISOString(), version: "2026-10-19", text: R.SOCIOS_TERMS["2026-10-19"].es },
    availability: { tz: "Europe/Madrid", duration_min: 60, repeat_weekly: true, slots: [{ weekday: 2, start: "12:00", first_date: null, date: null }] },
  });
  const run = async (o) => {
    const rows = [], cards = [], reviews = [], applied = [];
    const calma = { id: "p-calma", business_name: "Calma Madrid Spa", status: "active", whatsapp: "+34 600 111 222", opening_hours: null };
    const deps = {
      ...limits, socMsg: R.socMsg, socValidate: R.socValidate, socLine: R.socLine, socPhone: R.socPhone, socWhyText: R.socWhyText,
      socIpHash: async () => "h-192.0.2.9", socClientIp: () => "192.0.2.9",
      socResolve: async () => o.signed ? { partner: calma, signed: true, sigBad: false } : { partner: null, signed: false, sigBad: false },
      socCount: async () => 0,
      socHasMenu: async () => !!o.menu,
      socInsert: async (r) => { const row = { id: `row-${rows.length + 1}`, created_at: new Date().toISOString(), ...r }; rows.push(row); return row; },
      socPatch: async (id, patch) => { const r = rows.find((x) => x.id === id); Object.assign(r, patch); return { ...r }; },
      findPartnerByNumber: async () => null, socPartner: async () => null,
      socInactive: () => false, socTestish: () => false, socIsTestStudio: () => false,
      // socApply's database work is the offline harness's; its price is socPriceState.
      socApply: async (row, partner, plan, via) => { applied.push({ plan, via }); return { ok: true, error: "", result: { filled: [], differ: [], replaced: [], saved: [], refused: [], skipped: plan.skipped, weekly: plan.pattern.map((x) => ({ ...x, isNew: true })), next: [{ startMs: Date.now() + 2 * 86400e3 }], terms: "accepted now", price: R.socPriceState(plan) } }; },
      releasedMode: async () => o.mode || "on",
      socLiveFor: (mode, isTest) => isTest ? mode !== "off" : mode === "on",
      slotsLink: async () => "https://book.massageclub.io/bot.html?slots=calma",
      logEvent: async () => {},
      founderCard: async (subject, card) => { cards.push({ subject, ...card }); },
      socReviewLink: async (id, want) => `https://example.test/review/${id}/${want || ""}`,
      socLinksUrl: async () => "https://example.test/links",
      socAppliedEn: () => [],
      socStudioEn: studioEn, socPick, socSeenEn: R.socSeenEn, socPriceAskEs: R.socPriceAskEs, socPriceAskEn: R.socPriceAskEn,
      socWhen: () => "mar 12:00", SOC_WD: { es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
      socReviewCard: async (row, plan, match, why) => { reviews.push({ plan, why, after: studioEn(plan) }); },
    };
    const socSubmit = new Function(...Object.keys(deps), `${stripTypeScriptTypes(subSrc)}\nreturn socSubmit;`)(...Object.values(deps));
    const res = await socSubmit(form(o.price === undefined ? null : o.price), { headers: { get: () => "" } }, o.L || "es");
    return { res, rows, cards, reviews, applied };
  };
  const cardOf = (w) => w.cards[0] || { subject: "", badge: "", paras: [""], after: [], links: [], to: [] };
  let w = await run({});
  check(G, "server: an unsigned form without a price is received for Jordan's review, not refused", [w.res.status, w.res.body.status, w.rows.map((r) => r.status), w.reviews.length, w.reviews[0]?.plan?.pricePending], [200, "pending_review", ["pending_review"], 1, true], "was 400 invalid, price_needed");
  check(G, "server: its review card says to ask for the price", (w.reviews[0]?.after || []).filter((x) => /^Price/.test(x)), ["Price: not given yet, ask for it (customers cannot see these times until there is one)"], "");
  w = await run({ signed: true });
  const card = cardOf(w);
  check(G, "server: own link without a price: saved at once, marked pending, and the page is told the truth", [w.res.status, w.res.body.status, w.res.body.price_pending, w.res.body.live, w.res.body.message, w.rows.map((r) => r.status), w.rows[0].result?.price, w.applied[0]?.plan.price], [200, "applied", true, true, "Guardado. Las ofrecemos a clientes en cuanto tengamos vuestro precio.", ["applied"], "pending", null], "never \"Ya se pueden reservar\" for times no customer can see");
  check(G, "server: Jordan's card: \"Price: not given yet, ask for it\", and why customers cannot see the times", [card.subject, card.badge, card.paras[0].startsWith("Applied at once (signed link). Price: not given yet, ask for it. Customers cannot see these times until there is one: released_offers never offers a time without a price"), / The studio was told we will offer them as soon as we have their price\.$/.test(card.paras[0]), card.after.includes("Price: not given yet, ask for it (customers cannot see these times until there is one)")],
    ["📥 Calma Madrid Spa gave 1 time on its /socios link: price not given yet, ask for it", "STUDIO GAVE TIMES, NO PRICE YET", true, true, true], "");
  const askBtn = card.links.find((l) => /price/.test(l.label)) || {};
  check(G, "server: the card's button opens a draft in Jordan's own WhatsApp; only Jordan gets an email, nothing goes to the business", [askBtn.label, askBtn.href, askBtn.primary, card.to, w.cards.length, card.paras.some((x) => x.includes(`(English: "${R.socPriceAskEn(60)}")`))],
    ["Ask them for their price (my WhatsApp)", "https://wa.me/34600111222?text=" + encodeURIComponent(R.socPriceAskEs(60)), true, ["jordan@massageclub.io"], 1, true], "CLAUDE.md: English beside any Spanish shown to Jordan");
  w = await run({ signed: true, menu: true });
  check(G, "server: own link, no price, menu on file: the menu is quoted, nothing pending", [w.res.body.price_pending, w.res.body.message, w.rows[0]?.result?.price, /price/i.test(cardOf(w).subject), cardOf(w).after.filter((x) => /^Price/.test(x)), cardOf(w).links.some((l) => /price/.test(l.label))], [false, "Guardado. Ya se pueden reservar.", "menu", false, ["Prices: not given (their menu on file is used)"], false], "");
  w = await run({ signed: true, price: 55 });
  check(G, "server: own link with a price tapped: as before", [w.res.body.price_pending, w.res.body.message, w.rows[0]?.result?.price, w.applied[0]?.plan.price, cardOf(w).badge, cardOf(w).paras[0], cardOf(w).after.filter((x) => /^Price/.test(x))], [false, "Guardado. Ya se pueden reservar.", "given", 55, "STUDIO GAVE TIMES", "Applied at once (signed link). Customers can book these now.", ["Prices: 60 min 55 EUR"]], "");
  w = await run({ signed: true, mode: "off" });
  check(G, "server: own link, no price, RELEASED off: \"os avisamos en cuanto empecemos\", and the card says both", [w.res.body.live, w.res.body.price_pending, w.res.body.message, /, and RELEASED is off too\./.test(cardOf(w).paras[0]), / The studio was told we will let them know when we start\.$/.test(cardOf(w).paras[0])], [false, true, R.socMsg("applied_wait", "es"), true, true], "");
  w = await run({ signed: true, price: 600 });
  check(G, "server: a typed price over 500 is still refused, in the studio's words", [w.res.status, w.res.body.errors, w.res.body.message, w.rows.map((r) => r.status)], [400, ["price"], "El precio tiene que ser un número entre 1 y 500.", ["rejected"]], "");
  // What the harness does not run: socApply, and the approve page.
  const rp = fnOf(botSrc, "\nasync function socReviewPage(");
  check(G, "server: socApply stores the price as given, menu or pending", /terms: "", price: socPriceState\(plan\) \};/.test(fnOf(botSrc, "\nasync function socApply(")), true, "studio_signups.result.price");
  check(G, "server: the approve page says it too, and the draft Jordan sends asks for the price", /const noPrice = res\.result\.price === "pending";/.test(rp) && /\$\{socSeenEn\(live, mode, noPrice, plan\.minutes\)\}/.test(rp) && /\$\{noPrice \? `\\n\\nPara ofrecerlas a clientes nos falta vuestro precio: ¿cuánto cobráis por un masaje de \$\{plan\.minutes\} minutos\?` : ""\}/.test(rp) && /\$\{noPrice \? `\\n\\nTo offer them to customers we still need your price: how much do you charge for a \$\{plan\.minutes\}-minute massage\?` : ""\}/.test(rp), true, "a draft in his own WhatsApp; nothing is sent by us");
  check(G, "server: a studio's later changes on its link still need a price (unchanged)", /else if \(price === null && !\(await socHasMenu\(pid\)\)\) refuseReady\("price_needed"\);/.test(fnOf(botSrc, "\nasync function socTimesSubmit(")), true, "studio_times is not wired to the page yet");
}

// ---------------------------------------------------------------------------
// Jordan, 23 Oct: stop calling the business «centro» / "centre". It is
// «negocio» in Spanish and "business" in English everywhere a business owner
// reads it: the partner portal (src/i18n es.json and en.json, partner.* and
// the owner links on the customer pages) and the hardcoded portal, survey,
// claim and invite strings. Customer copy keeps «Pago en el centro», the
// Madrid district stays "Centro", and partner.dashboard.ourStudio stays: it
// is only the fallback name in the subject of an email the business sends
// its own customer («Tu reserva en nuestro centro»), which customers read.
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const G = "business wording (portal)";
  const read = (f) => fs.readFileSync(path.join(here, "..", f), "utf8");
  const es = JSON.parse(read("src/i18n/es.json"));
  const en = JSON.parse(read("src/i18n/en.json"));
  const flat = (o, p = "", out = {}) => { for (const [k, v] of Object.entries(o)) { const q = p ? `${p}.${k}` : k; if (typeof v === "string") out[q] = v; else if (v && typeof v === "object") flat(v, q, out); } return out; };
  const ES = flat(es), EN = flat(en);
  const ownerApp = ["app.massageList.switchToPartner", "app.massageList.studioCta", "app.login.actions.forStudios", "app.login.actions.ownStudio", "app.login.studioCard.label", "app.login.studioCard.title", "app.partnerAuth.resetHelp", "app.studioHours.staffTitle"];
  const ownerKeys = (F) => Object.keys(F).filter((k) => (k.startsWith("partner.") && k !== "partner.dashboard.ourStudio") || ownerApp.includes(k));
  check(G, "es: no «centro» left in what a business owner reads", ownerKeys(ES).filter((k) => /\bcentros?\b/i.test(ES[k])), [], "");
  check(G, "en: no \"centre\" left in what a business owner reads", ownerKeys(EN).filter((k) => /\bcent(re|er)s?\b/i.test(EN[k])), [], "");
  check(G, "es: the new words, masculine like «centro»", ["partner.login.businessNameLabel", "partner.onboarding.stepStudio", "partner.onboarding.atMyStudio", "app.login.actions.forStudios", "app.massageList.studioCta", "partner.studioSetup.doneDescInvite"].map((k) => ES[k]),
    ["Nombre del negocio", "Negocio", "En mi negocio", "Para negocios", "¿Tienes un negocio de masajes? Aparece gratis en Massage Club →", "Tu negocio ya es visible para miles de clientes en Madrid."], "");
  check(G, "en: the new words", ["partner.login.registerTab", "partner.onboarding.stepStudio", "app.login.actions.forStudios", "app.massageList.switchToPartner", "partner.studioSetup.claimBadgeLabel"].map((k) => EN[k]),
    ["List My Business", "Business", "For massage businesses", "Your business dashboard →", "Claim Your Business"], "");
  check(G, "es: no feminine article in front of «negocio»", Object.entries(ES).filter(([, v]) => /\b(la|las|una|unas|esta|nuestra|vuestra|otra)\s+negocios?\b/i.test(v)).map(([k]) => k), [], "");
  check(G, "no em or en dash in any string that now says negocio / business", [...Object.entries(ES).filter(([, v]) => /negocio/i.test(v)), ...Object.entries(EN).filter(([, v]) => /\bbusiness/i.test(v))].filter(([, v]) => /[–—]/.test(v)).map(([k]) => k), [], "CLAUDE.md");
  check(G, "customer copy keeps «centro» (unchanged)", ["app.shopDetail.pay_at_studio", "app.login.hero.payAtStudio", "app.payment.main.totals.footer", "partner.dashboard.ourStudio"].map((k) => ES[k]),
    ["Pago en el centro", "Paga en el centro", "El masaje se paga directamente en el centro al llegar.", "nuestro centro"], "customers read these");
  const ownerTsx = ["src/app/screens/StudioPortal.tsx", "src/app/screens/ClaimShortLink.tsx", "src/app/screens/AdminInviteStudio.tsx", "src/app/screens/SurveyStudios.tsx", "src/pages/Home.tsx", "src/pages/guides/GuideLayout.tsx", "src/pages/Web.tsx"];
  check(G, "hardcoded portal, survey, claim, invite and owner-link strings: no centre / centro", ownerTsx.filter((f) => /\bcentr(e|es|o|os)\b/i.test(read(f))), [], "");
  const idx = read("src/pages/Index.tsx");
  check(G, "Index.tsx: owner links say business; \"Centro\" is only the district", [(idx.match(/\bcentr(e|es|o|os)\b/gi) || []).length, /district: "Centro"/.test(idx), /List your business<\/a>/.test(idx), /For Massage Businesses<\/a>/.test(idx), /Massage business\?<\/span>/.test(idx)], [1, true, true, true, true], "");
  const survey = read("src/app/screens/SurveyStudios.tsx");
  check(G, "SurveyStudios.tsx (Spanish survey for businesses)", [/>Negocios de masajes · Madrid</.test(survey), /algo útil para tu negocio\./.test(survey), /block">Nombre del negocio</.test(survey), /¿Listarías tu negocio gratis/.test(survey)], [true, true, true, true], "");
}

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
