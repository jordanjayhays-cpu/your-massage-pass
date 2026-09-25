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
  ZONEQ_RE,
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
