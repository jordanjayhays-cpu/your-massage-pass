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
    "Javier, Calma Madrid Spa still has 19:00 free today, but they will not hold it for long. Tap Yes and it is yours, or tell me what would suit you better.\n\nMassage Club", "#96: the 19:00 passed with no word");
  check("offer chase", "es", O.OFFER_COPY.es.chase("Javier", "Calma Madrid Spa", "19:00", "hoy"),
    "Javier, Calma Madrid Spa sigue teniendo libre las 19:00 hoy, pero no te la guardan mucho. Toca Sí y es tuya, o dime qué te vendría mejor.\n\nMassage Club", "");
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
  check("review guards", "the canary's settle only touches fake numbers", /const only = \/\^3460000\\d\{0,4\}\$\/\.test\(String\(payload\.only/.test(botSrc) && /if \(!o \|\| !o\.row \|\| !o\.sentAt \|\| o\.change \|\| !phone \|\| \(only && !phone\.startsWith\(only\)\)\) continue;/.test(botSrc), true, "settle on wa-bot-canary would otherwise sweep every real session");
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
    ["test", "34600001234", true, "a canary fake number"], ["test", "3460000123", false, "one digit short"],
    ["test", "34612474827", false, "Jordan's own number is not a canary number"], ["test", "15622355063", false, ""],
    ["on", "34631294370", true, "Hafeez, once it is on"], ["on", "", false, ""], ["off", "34600001234", false, "off is off"],
  ]) check("coreEligiblePhone", `${mode} ${ph}`, C.coreEligiblePhone(mode, ph), want, note);

  // 2. Which messages the core takes. Everything here is decided in bot.ts
  // exactly like this (the coreTake block above the clothing gate).
  const AD = "Hi, I'd like to book a massage. I saw you on Facebook.";
  const takes = (step, text, o = {}) => C.coreTakes({ mode: "test", phone: "34600001234", step, text, jobSeeker: false,
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
  const sess = (step, data = {}) => ({ phone: "34600001234", step, data: { lang: "en", service: "svc_relax", ...data }, wa_name: "Hafeez Akram" });
  const turn = (s, text, o = {}) => ({ s, from: "34600001234", L: "en", text, viaVoice: false, founderSaid: null, ackOnly: false, switchMode: "test", ...o });
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
