// wa-bot-copy: copy strings, service tables and lexicon for wa-bot. No secrets.
// Generated from wa-bot-v39.ts by split_bot.py; edit the source, not this file.
export const JORDAN_MAIN_NUMBER = "+34 612 474 827";
export const AD_OPENER_RE = /^hi,? i'?d like to book a massage\.? i saw you on (facebook|instagram)\.?$/i;
// v39: people write whole sentences ("Tailandés en Centro, lunes noche"). Read them.
export const UNSURE_RE = /(no s[eé] (qu[eé]|cu[aá]l)|not sure|don'?t know|no tengo claro|cualquiera me vale|recomi[eé]nda|recommend|ay[uú]dame a elegir|help me (choose|pick|figure))/i;
// v59: people ask where we are without a question mark. "What street in madrid"
// and "Que calle o zona en madrid" both got the service menu instead of an
// answer on 7 Sept, the second time in the same conversation.
export const ZONEQ_RE = /(d[oó]nde est[aá]is|d[oó]nde (est[aá]n|se encuentran|sois)|en qu[eé] (zona|barrio|calle|parte|sitio)|qu[eé] (zona|zonas|barrio|calle|direcci[oó]n|parte de madrid)|vuestra direcci[oó]n|direcci[oó]n del centro|ubicaci[oó]n|where are you (located|based)|which area|what area|which street|what street|where is it|your address)/i;
export function detectDay(t: string, L: string): string {
  const s = stripAcc(t);
  if (/\b(hoy|today|tonight|esta noche|esta tarde)\b/.test(s)) return L === "es" ? "Hoy" : "Today";
  if (/\b(manana|tomorrow)\b/.test(s) && !/\bpor la manana\b|\bde la manana\b|\bin the morning\b/.test(s)) return L === "es" ? "Mañana" : "Tomorrow";
  const days: Array<[RegExp, string, string]> = [
    [/\b(lunes|monday)\b/, "Lunes", "Monday"], [/\b(martes|tuesday)\b/, "Martes", "Tuesday"], [/\b(miercoles|wednesday)\b/, "Miércoles", "Wednesday"],
    [/\b(jueves|thursday)\b/, "Jueves", "Thursday"], [/\b(viernes|friday)\b/, "Viernes", "Friday"], [/\b(sabado|saturday)\b/, "Sábado", "Saturday"], [/\b(domingo|sunday)\b/, "Domingo", "Sunday"],
  ];
  for (const [re, es, en] of days) if (re.test(s)) return L === "es" ? es : en;
  const m = s.match(/\b(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|ene|feb|mar|abr|jun|jul|ago|sep|sept|oct|nov|dic|jan|apr|aug|dec)\b/);
  if (m) return `${m[1]} ${m[2]}`;
  return "";
}
export function detectTime(t: string, L: string): string {
  const s = stripAcc(t);
  const hm = s.match(/\b(?:a las?\s*)?([01]?\d|2[0-3])[:.h]([0-5]\d)\b/) || s.match(/\ba las?\s*([01]?\d|2[0-3])\b(?![:.\d])/) || s.match(/\b([01]?\d|2[0-3])\s*(pm|am|h)\b/);
  if (hm) { let h = parseInt(hm[1], 10); const mm = /^\d{2}$/.test(hm[2] || "") ? hm[2] : "00"; if (/pm/.test(hm[2] || "") && h < 12) h += 12; return `${String(h).padStart(2, "0")}:${mm}`; }
  if (/\b(noche|evening|tarde-noche|after work|por la tarde noche)\b/.test(s)) return L === "es" ? HOURS.time_evening.labelEs : HOURS.time_evening.label;
  if (/\b(tarde|afternoon|mediodia|midday|lunch)\b/.test(s)) return L === "es" ? HOURS.time_afternoon.labelEs : HOURS.time_afternoon.label;
  if (/\b(por la manana|de la manana|morning|temprano|early)\b/.test(s)) return L === "es" ? HOURS.time_morning.labelEs : HOURS.time_morning.label;
  return "";
}
// v78: everyday words, no booking vocabulary. Deliberately excludes anything
// that reads the same in both languages ("a", "no", "me", "hotel", "metro"), so
// a mixed message is not dragged either way by a coincidence.
const ES_COMMON = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "del", "al", "que", "qué", "con", "para", "por", "en", "es", "son", "está", "estás", "estoy", "estar", "estaré", "estamos", "voy", "vamos", "va", "he", "ha", "han", "hemos", "te", "se", "nos", "mis", "tu", "su", "muy", "ya", "sí", "más", "pero", "como", "cómo", "cuando", "cuándo", "dónde", "donde", "aquí", "allí", "ahí", "ahora", "luego", "hasta", "desde", "sin", "sobre", "todo", "toda", "todos", "tengo", "tienes", "tiene", "quiero", "puedo", "puede", "podemos", "vale", "bien", "bueno", "buenas", "buenos", "llegado", "llegar", "llego", "camino", "cerca", "cercano", "cercana", "calle", "día", "días", "semana", "también", "entonces", "claro", "perfecto", "vosotros", "ustedes", "da", "igual", "otra", "otro", "mejor", "prefiero", "gusta", "zona", "barrio", "sitio", "algo", "nada", "poco", "mucho", "siento", "vemos"]);
const EN_COMMON = new Set(["the", "an", "i", "you", "your", "is", "are", "was", "to", "for", "and", "of", "my", "can", "could", "would", "should", "want", "need", "please", "book", "booking", "massage", "tomorrow", "today", "tonight", "hi", "hello", "what", "when", "where", "which", "how", "much", "many", "do", "does", "did", "have", "has", "provide", "service", "male", "female", "there", "here", "with", "from", "about", "time", "day", "price", "cheap", "near", "nearest"]);
// "I don't understand", in the forms people actually type it.
export const LOST_ES_RE = /\bno\s+(?:te\s+|le\s+|lo\s+)?(?:entiendo|entiendes|entiende|comprendo)\b|\bno\s+hablo\s+ingl[eé]s\b|\bhablas?\s+espa[nñ]ol\b|\ben\s+espa[nñ]ol\b/i;
// v119 (22 Sept, live): Pilar, 82, opened with "I dont speak inglesi", then
// "I dont speak englis", "Said in spanich" and "Please am española", and was
// answered "Sorry, I did not catch that" in English six times before she gave
// up and tapped buttons at random. Every one of those sentences is built from
// English words, so every language test we had scored them English. The tell is
// not which language the words are in, it is what they say. Spelled any way at
// all, this settles it. "I don't speak Spanish" deliberately does NOT match:
// the first branch wants an English word after the verb, and the second wants
// "in Spanish", which is a request, not a refusal.
export const NO_ENGLISH_RE = /\b(?:do\s*not|do\s*n[o']?t|dont|can\s*not|cant|can[o']?t|no|not)\s+(?:speak|talk|understand|understan|read|write|know)\s+(?:any\s+|much\s+|the\s+)?(?:engl|ingl)\w*|\b(?:in|en)\s+(?:spanish|spanich|spanis|espa[nñ]ol|castellano)\b|\b(?:i\s*am|i'?m|am)\s+(?:spanish|espa[nñ]ola?)\b|\bno\s+ingl[eé]s\b/i;
// v119 (22 Sept, live): an offer must never echo the relative word the customer
// typed last night. Nell asked on Monday evening for "tomorrow". On Tuesday
// morning TornaSol and Calma both said yes, and both offers still read
// "Tomorrow", which by then meant Wednesday. She was being invited to the wrong
// day for a booking that was happening in two hours. The request already
// carries the real date in message_text ("Fecha: tuesday 22 september"), which
// is exactly what dispatch-studios reads to tell the studios "hoy, martes 22 de
// septiembre". This says the same thing to the customer, in their language.
//
// When the date cannot be worked out this returns "", never the stale word, so
// the caller falls back to "that day" instead of naming a day that is wrong.
const MONTH_IDX: Record<string, number> = {
  jan: 0, ene: 0, feb: 1, mar: 2, apr: 3, abr: 3, may: 4, jun: 5, jul: 6,
  aug: 7, ago: 7, sep: 8, oct: 9, nov: 10, dec: 11, dic: 11,
};
const WEEKDAY_IDX: Record<string, number> = {
  sun: 0, dom: 0, mon: 1, lun: 1, tue: 2, mar: 2, wed: 3, mie: 3,
  thu: 4, jue: 4, fri: 5, vie: 5, sat: 6, sab: 6,
};
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ES_DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ES_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Midnight in Madrid, expressed as a UTC date, so two of these can be compared.
export function madridMidnight(now: Date = new Date()): Date {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const g = (k: string) => Number(p.find((x) => x.type === k)?.value || 0);
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day")));
}

export function resolveRequestDate(day1: unknown, messageText?: unknown, now: Date = new Date()): Date | null {
  const today = madridMidnight(now);
  const plus = (n: number) => new Date(today.getTime() + n * 86400e3);
  const fecha = String(messageText || "").match(/Fecha:\s*([^|]+)/)?.[1] || "";
  for (const raw of [fecha, String(day1 || "")]) {
    const t = stripAcc(String(raw).toLowerCase()).trim();
    if (!t) continue;
    if (/^(hoy|today)\b/.test(t)) return today;
    if (/^(manana|tomorrow)\b/.test(t)) return plus(1);
    const dm = t.match(/(\d{1,2})\s*(?:de\s+)?([a-z]{3})[a-z]*/);
    if (dm && MONTH_IDX[dm[2]] !== undefined) {
      let dt = new Date(Date.UTC(today.getUTCFullYear(), MONTH_IDX[dm[2]], parseInt(dm[1], 10)));
      // A date more than a month behind us is next year's, not last year's.
      if (dt.getTime() < today.getTime() - 30 * 86400e3) dt = new Date(Date.UTC(today.getUTCFullYear() + 1, MONTH_IDX[dm[2]], parseInt(dm[1], 10)));
      return dt;
    }
    const wd = t.match(/\b(sun|dom|mon|lun|tue|mar|wed|mie|thu|jue|fri|vie|sat|sab)[a-z]*\b/);
    if (wd && WEEKDAY_IDX[wd[1]] !== undefined) {
      for (let n = 0; n < 7; n++) { const d = plus(n); if (d.getUTCDay() === WEEKDAY_IDX[wd[1]]) return d; }
    }
  }
  return null;
}

export function dayLabelFor(day1: unknown, messageText: unknown, L: string, now: Date = new Date()): string {
  const d = resolveRequestDate(day1, messageText, now);
  if (!d) return "";
  const today = madridMidnight(now);
  const days = Math.round((d.getTime() - today.getTime()) / 86400e3);
  if (days === 0) return L === "es" ? "Hoy" : "Today";
  if (days === 1) return L === "es" ? "Mañana" : "Tomorrow";
  return L === "es"
    ? `${ES_DAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${ES_MONTHS[d.getUTCMonth()]}`
    : `${EN_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${EN_MONTHS[d.getUTCMonth()]}`;
}

// v124 (25 Sept): "Lo confirmaria un dia antes." ("I would confirm it the day
// before.") Juan wrote exactly that to a studio offer on 15 September and was
// never contacted again. It is not a no. It is a yes with a date on it, and the
// only thing it needed was somebody to come back to him the day before.
//
// Deliberately narrow. A confirm verb has to sit within one clause of a
// day-before phrase, so "can you confirm the address?" and a bare "confirmo"
// (which is an acceptance and must keep going straight to acceptOffer) do not
// match. It is checked only at the offer step, where the alternative today is
// repeating the same offer at them and filing a card.
const CL_VERB = "confirm[a-záéíóúñ]*|avis[a-záéíóúñ]*|te\\s+digo|let\\s+you\\s+know|tell\\s+you|get\\s+back\\s+to\\s+you";
const CL_WHEN = "(?:d[ií]a|day|night|noche)\\s+(?:before|antes)|v[ií]spera|closer\\s+to\\s+the\\s+(?:day|date|time)";
export const CONFIRM_LATER_RE = new RegExp(
  `(?:${CL_VERB})[^.!?\\n]{0,40}?(?:${CL_WHEN})|(?:${CL_WHEN})[^.!?\\n]{0,30}?(?:${CL_VERB})`,
  "i",
);

// The UTC instant of a wall-clock hour in Madrid on a given Madrid day. The
// second pass is what makes it right on the two days a year the offset moves.
export function madridInstant(day: Date, hour: number): Date {
  const naive = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour);
  const off = (at: number) => {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(at));
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value || 0);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute")) - at;
  };
  return new Date(naive - off(naive - off(naive)));
}

// When the day-before reminder should go out. 11:00 Madrid the day before the
// massage. If that moment has already gone (they said it the day before, or on
// the day itself) it is two hours from now instead, never before 10:00 and
// never after 20:00, and never after the massage, because a reminder that
// arrives late is worse than none at all. Returns null when the day cannot be
// worked out, so the caller promises nothing it cannot keep.
export const CL_REMIND_HOUR = 11;
export function confirmLaterRemindAt(day1: unknown, messageText: unknown, now: Date = new Date()): Date | null {
  const d = resolveRequestDate(day1, messageText, now);
  if (!d) return null;
  const at = madridInstant(new Date(d.getTime() - 86400e3), CL_REMIND_HOUR);
  if (at.getTime() > now.getTime() + 30 * 60e3) return at;
  const soon = new Date(now.getTime() + 2 * 3600e3);
  const today = madridMidnight(soon);
  const floor = madridInstant(today, 10);
  const ceil = madridInstant(today, 20);
  if (soon.getTime() < floor.getTime()) return floor;
  if (soon.getTime() <= ceil.getTime()) return soon;
  const next = madridInstant(new Date(today.getTime() + 86400e3), 10);
  return next.getTime() < madridInstant(d, 22).getTime() ? next : null;
}

// v121 (23 Sept, live): the name step took the whole message. Manju answered
// "Me llamo Manju" and became "Me", and four studios were asked to hold an hour
// for "Me". People answer this question in sentences, not with a bare word, so
// strip the sentence and keep the name. Anything left that is not a plausible
// name is rejected, and the caller asks again rather than storing a phrase.
const NAME_LEAD_RE = /^\s*(?:me\s+llamo|mi\s+nombre\s+es|my\s+name\s+is|i\s*am|i'?m|im|soy|it'?s|this\s+is|call\s+me|name\s*[:.]?)\s+/i;
const NAME_TRAIL_RE = /[\s,.!¡¿?]+$/;
export function parseName(t: string): string {
  let s = String(t || "").trim().replace(NAME_LEAD_RE, "").replace(NAME_TRAIL_RE, "");
  // "Manju, encantada" / "Manju :)" - the name is what comes before the aside.
  s = s.split(/[,;\n]/)[0].trim();
  if (!s) return "";
  const words = s.split(/\s+/);
  // A name is one to four words. Longer than that is a sentence, not a name.
  if (words.length > 4) return "";
  // Digits, @ and urls are never names.
  if (/[0-9@]|https?:/i.test(s)) return "";
  // Words that never sit inside a person's name but do sit inside the answers
  // people give to other questions. Manju's area answer, "Vivo en Urgel, cerca
  // del metro", survived the comma split as "Vivo en Urgel" and would have gone
  // to a studio as a name. Deliberately narrow: "de", "la" and "del" are left
  // out because real names carry them (Ana de la Cruz).
  if (/\b(?:vivo|vive|cerca|calle|avenida|plaza|metro|barrio|zona|minutos?|en|soy\s+de|live|living|near|street|road|avenue|from|looking|work|trabajo|masaje|massage)\b/i.test(s)) return "";
  if (s.length > 60) return "";
  return s;
}
export function strongSpanish(t: string): boolean {
  const s = String(t).toLowerCase();
  if (AD_OPENER_RE.test(s.trim())) return false; // the ad's canned line, not the person's words
  // v104 (18 Sept, live): a Facebook lead wrote "No entiendo" and the bot
  // answered "Good choice. Which day suits you?". Neither word was in any list:
  // "no" is deliberately excluded because it reads the same in both languages,
  // and "entiendo" was simply missing. Someone telling us they cannot read the
  // message is the strongest language signal there is, so it settles it on its
  // own, whatever else is in the sentence.
  if (LOST_ES_RE.test(s)) return true;
  // v119: the same thing said in English. See NO_ENGLISH_RE above.
  if (NO_ENGLISH_RE.test(s)) return true;
  const words = ["hola", "buenas", "quiero", "masaje", "reservar", "cuanto", "cuánto", "precio", "gracias", "por", "favor", "mañana", "hoy", "para", "una", "cita", "hora", "tarde", "noche", "zona", "donde", "dónde"];
  // v48: the massage words themselves are Spanish too. "Relajante de hora y media"
  // (6 Sept, 02:54) scored as English and got the English day question.
  const strong = ["hola", "buenas", "quiero", "masaje", "masajes", "reservar", "reserva", "precio", "gracias", "español", "espanol", "castellano", "cuánto", "cuanto", "cuándo", "mañana", "hoy", "quisiera", "necesito", "busco", "ofrecen", "tenéis", "teneis", "hacéis", "haceis", "relajante", "relajación", "relajacion", "descontracturante", "tailandés", "tailandes", "deportivo", "hora", "minutos", "disponible", "disponibilidad", "entiendo", "entiendes", "entiende", "entender", "hablo", "hablas", "habla", "perdona", "perdon", "perdón", "ayuda", "ayudarme", "dime", "digame", "dígame", "sabes", "podrias", "podrías", "puedes", "informacion", "información", "informacion?", "quesiera"];
  const toks = s.split(/[^a-záéíóúñü]+/).filter(Boolean);
  const found = new Set<string>();
  for (const w of toks) if (words.includes(w)) found.add(w);
  if (found.size >= 3) return true;
  // v39: a short message with one unmistakably Spanish word is Spanish ("Hola", "Buenos días", "¿Qué tipo de masaje ofrecen?")
  if (toks.length <= 7 && toks.some((w) => strong.includes(w))) return true;
  // v78: ordinary Spanish that happens to contain none of the booking keywords
  // was scored as English. Fernando wrote "Voy en camino / Metro más cercano? /
  // A las 16:00 estaré allí" and later "Ya he llegado" on 9 September, and both
  // came back false, so a Spanish speaker standing at the studio door was sent
  // an English service menu. Ordinary words carry the language too.
  const esHits = toks.filter((w) => ES_COMMON.has(w)).length;
  const enHits = toks.filter((w) => EN_COMMON.has(w)).length;
  if (esHits >= 2 && esHits > enHits) return true;
  // Spanish orthography, with nothing English around it, is enough on its own.
  if (/[áéíóúñ]/.test(s) && enHits === 0) return true;
  return /[¿¡]/.test(s);
}
export const isEmail = (t: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.trim());
export const stripAcc = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const TIME_RE = /^\d{1,2}([:.h]\d{2})?\s*(am|pm)?$/i;
export const BACK_RE = /^(back|atras|atrás|volver)$/i;
export const HI_RE = /^(hi|hello|hey|hola|start|reset|empezar)$/i;
export const BOOKAGAIN_RE = /\b(book again|another massage|otra vez|otro masaje|quiero reservar)\b/i;
export const digitsOf = (s: string) => String(s || "").replace(/[^0-9]/g, "");
export const CHANGE_RE = /\b(tomorrow|ma[nñ]ana|another (day|time)|otro d[ií]a|otra hora|change|cambiar|cambio|reschedule|postpone|move it|m[aá]s tarde|can'?t make it|cannot make it|no puedo|no voy a poder|not today|hoy no)\b/i;
// "hasta mañana", "see you tomorrow", "thanks" are goodbyes, not changes.
// v118 (21 Sept): a studio agreeing or thanking us is closing the thread, not
// asking a question. "De acuerdo", "A vosotros", "Vale" and a bare "Ok" all fell
// through to the holding line, and each one also alerted Jordan's phone. Calma
// did it twice in two minutes. Bare agreement only counts on its own: "vale, a
// las 17:00" is an offer and must keep reaching the offer branch.
export const GOODBYE_RE = /(hasta (ma[nñ]ana|luego|pronto|ahora)|see you|nos vemos|thank|gracias|perfect|great|genial)/i;
export const ACK_ONLY_RE = /^\s*(?:de acuerdo|a vosotros|a ti|vale|ok(?:ay)?|okey|entendido|correcto|sin problema|perfecto|genial|estupendo|muy bien|bien|👍|👌|🙏|✅)[\s.!¡]*$/i;
export const CANCEL_RE = /\b(cancel|cancelar|cancela|anular|forget it|no longer|ya no)\b/i;
export const ARRIVED_RE = /(ha llegado|ya est[aá] aqu[ií]|ya ha venido|ya vino|en cabina|ya est[aá] con nosotros|acaba de llegar)/i;
export const NOSHOW_RE = /(no ha llegado|no ha venido|no vino|no aparece|no se ha presentado|no puedas venir|no vais a venir|plant[oó]n|sin venir)/i;
// v36: studio offers. A studio answering with a time ("a las 12:15", "12:15",
// "16.30") is an offer for the customer, not a note for Jordan.
export const mcMadridHour = (): number => parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date()), 10);
// v58: a studio stating its opening hours is not offering an appointment.
// Calma Madrid wrote "el sábado abrimos hasta las 14:00 horas y de lunes a
// viernes cerramos a las 20:00 horas" on 7 Sept and the bot forwarded 14:00 to
// a customer as a slot they never offered. Words like these mean the message is
// about when the doors are open; only an explicit offer beside them makes it a
// real time. When in doubt the reply goes to a founder card, never to a client.
export const HOURS_STATEMENT_RE = /\b(abrimos|abre|abierto|cerramos|cierra|cerrad[oa]s?|horario|de lunes a viernes|lun(es)?\s*[-a]\s*vie(rnes)?|todos los d[ií]as|we (open|close)|opening hours|closed on|mon(day)?\s*(-|to)\s*(fri|sat|sun))/i;
// v113 (19 Sept): a time followed by an acceptance word is an offer, even in a
// sentence that also carries the word horario. Private Spa Madrid answered
// "El horario a las 18:00 bien" for Al, the opening-hours guard swallowed it,
// and the one studio that named a slot never reached him.
const OFFER_MARKER_RE = /\b(podemos|podr[ií]amos|tenemos (hueco|libre|disponible)|hay hueco|disponible|(nos|os|le) va bien|s[ií],?\s*a\s+las|vale\s+a\s+las|ok\s+a\s+las|puede venir|os espero|te esperamos|reservad[oa])\b|\d{1,2}(?:[:.]\d{2})?\s*(?:h|horas?)?\s*(?:bien|perfecto|ok|vale|genial|correcto|sin\s+problema)\b/i;
// v84: a studio that offers several times. FISIOBARICA answered Asim's request
// on 9 September with "17h, 18h y 20h" and only 17:00 was kept, so two thirds of
// the availability they volunteered was thrown away. When he asked for 7pm an
// hour later, nothing had 20:00 on file to come close with.
//
// Same guards as the singular: an opening-hours statement is not an offer, and
// neither is a range like "de 10 a 20". Returns every distinct time in the order
// the studio wrote them, so the first is still the one we lead with.
export function parseOfferedTimes(t: string): string[] {
  const s = String(t || "");
  if (HOURS_STATEMENT_RE.test(s) && !OFFER_MARKER_RE.test(s)) return [];
  if (/\bde\s+\d{1,2}[:.h]?\d{0,2}\s+a\s+\d{1,2}[:.h]?\d{0,2}/i.test(s)) return [];
  const out: string[] = [];
  const push = (h: number, m = "00") => {
    if (h < 0 || h > 23) return;
    const v = `${String(h).padStart(2, "0")}:${m}`;
    if (!out.includes(v)) out.push(v);
  };
  // Walk the string once so the written order is preserved.
  const re = /\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b|\ba\s+las?\s+([01]?\d|2[0-3])(?![:.\d])(?!\s*[ap]\.?\s?m)|\b([01]?\d|2[0-3])\s*h(?:oras?|rs?)?\b|\b(1[0-2]|[1-9])(?:[:.]([0-5]\d))?\s*([ap])\.?m\.?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[1] !== undefined) push(parseInt(m[1], 10), m[2]);
    else if (m[3] !== undefined) {
      // v107: same two corrections as parseOfferedTime. "a las 3 p.m." is
      // handed to the am/pm arm, and a bare "a las 3" is the afternoon.
      const h3 = parseInt(m[3], 10);
      push(h3 >= 1 && h3 <= 7 ? h3 + 12 : h3);
    }
    // A bare "1h" is a duration, not 01:00. Centro Aloha's "si coges 1h" was
    // once read as a 01:00 slot and forwarded to a customer.
    else if (m[4] !== undefined && parseInt(m[4], 10) >= 8) push(parseInt(m[4], 10));
    else if (m[5] !== undefined) {
      let h = parseInt(m[5], 10);
      const ap = String(m[7] || "").toLowerCase();
      if (ap === "p" && h < 12) h += 12;
      if (ap === "a" && h === 12) h = 0;
      push(h, m[6] || "00");
    }
  }
  return out;
}
export function parseOfferedTime(t: string): string {
  const s = String(t || "");
  if (HOURS_STATEMENT_RE.test(s) && !OFFER_MARKER_RE.test(s)) return "";
  if (/\bde\s+\d{1,2}[:.h]?\d{0,2}\s+a\s+\d{1,2}[:.h]?\d{0,2}/i.test(s)) return ""; // opening hours range, not an offer
  let m = s.match(/\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  // v107 (19 Sept): "a las 3 p.m." used to stop here and return 03:00, because
  // this rule matched before the am/pm rule below. Centro Aloha offered Javier
  // "Hoy 19 hay disponibilidad a las 3 p.m." and he was told three in the
  // morning. The lookahead hands anything carrying am or pm to that rule.
  m = s.match(/\ba\s+las?\s+([01]?\d|2[0-3])(?![:.\d])(?!\s*[ap]\.?\s?m)/i);
  if (m) {
    const h = parseInt(m[1], 10);
    // A bare "a las 3" is the afternoon. No studio in Madrid opens at 03:00,
    // and 1 to 7 written without a marker always means the second half of the
    // day here. 8 and later are read as written.
    return `${String(h >= 1 && h <= 7 ? h + 12 : h).padStart(2, "0")}:00`;
  }
  // v77: "19 horas" is a time and did not parse, because \b after h failed on
  // the "o". TornaSol answered "19 horas" for Asim on 9 September, it was never
  // recorded, and a studio that could do the exact evening slot he wanted was
  // never offered to him. A bare "18h" is a time. A bare "1h" is a duration,
  // and no studio in Madrid offers 01:00: Centro Aloha's "si coges 1h" (if he
  // takes the hour) was read as a 01:00 slot and forwarded to a customer.
  m = s.match(/\b([01]?\d|2[0-3])\s*h(?:oras?|rs?)?\b/i);
  if (m && parseInt(m[1], 10) >= 8) return `${m[1].padStart(2, "0")}:00`;
  // v77: customers write "7pm". Asim did, while two studios had already offered
  // exactly that, and the bot repeated an 18:00 offer he had just turned down.
  m = s.match(/\b(1[0-2]|[1-9])(?:[:.]([0-5]\d))?\s*([ap])\.?m\.?\b/i);
  if (m) {
    let h = parseInt(m[1], 10);
    if (m[3].toLowerCase() === "p" && h < 12) h += 12;
    if (m[3].toLowerCase() === "a" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m[2] || "00"}`;
  }
  return "";
}
export const AUTOREPLY_RE = /gracias por (contactar|comunicarte|comunicarse|escribir|tu mensaje)|te responderemos|responderemos lo antes|te atenderemos|nos pondremos en contacto|contestar lo antes|hemos recibido tu mensaje|ahora no podemos responder|en este momento estamos ocupados|get back to you|currently busy|horario de atenci[o\u00f3]n|thank you for contacting|thanks for your message/i;
export const EMAIL_IN_TEXT_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// v125 (25 Sept, live): Hatem answered the email question with "Hatem", which
// was his NAME, because he was one question behind the whole way through. The
// bot logged email_refused and moved on, and nine seconds later he typed
// Hatem@vitasnacafe.com and that went in the bin too. He booked for the next
// afternoon with no email on file, which is the exact thing Jordan wrote in
// capitals on 8 September.
//
// Only these words are a refusal now. Anything else that is not an address gets
// the question once more, because a one word answer is far more likely to be an
// answer to the last question than a no.
export const EMAIL_REFUSE_RE = /^\s*(?:no|nope|nah|skip|later|luego|m[aá]s tarde|paso|ninguno|nada|sin email|no tengo|i\s*do\s*n[o']?t\s*have|dont have|no quiero|prefiero no|prefer not|rather not|no thanks?|no gracias)\b/i;
// "Special massage" probes - one standard line, then permanent silence.
// "Extra services" is the other English euphemism: Jasper asked twice on
// 11 Sept and the bot answered "Good choice. Which day suits you?" both times,
// then stored his question as the day he wanted.
// "Sensitive massage" is the English euphemism and it is only ever that when
// it sits next to the word massage: "I have a sensitive lower back" and
// "sensitive skin" are real things real customers say. Antonio wrote
// "Sensitive massage pleas" on 10 Sept and the bot answered "Good choice".
export const EROTIC_RE = /\b(er[oó]tic\w*|sensual\w*|sensitiv[oa]s?\b|sensitive\s+(?:massage|masaje)|(?:massage|masaje)\s+sensitive|t[aá]ntr\w*|nuru|happy\s*end\w*|final\s*feliz|con\s*extras?|extra\s*servic\w*|servicios?\s*extras?|servicio\s*completo|body\s*(2|to)\s*body|lingam|yoni|prostat\w*)\b/i;
// Asking about clothing is often a genuine modesty question, so it gets a
// straight answer about how professional studios work rather than a block. If
// the next message crosses the line, EROTIC_RE catches it.
// v108 (Jordan, 19 Sept, case 02): we book in person only. A French lead wrote
// "Home services" on 18 Sept and the bot answered "Good choice", then quietly
// set them up for a studio appointment they had not asked for.
// A request for us to come to them, not a person saying where they are.
// "I am at my hotel in Sol, which studios are near" is a location, not an
// outcall, so the phrases that only describe a place need a verb in front.
// v110 (Jordan, 19 Sept): "before we offer pricing we must confirm with the
// studio their price after our potential discount." So a price only ever comes
// from a studio's own written reply about this booking, never from a listed or
// scraped figure. A number without a currency marker is not a price: "a las
// 16:00" and "10% de descuento" must never be read as one.
// Two real messages set the floor and the veto. Sinergia38 wrote "podemos
// hacerle el 10€" on 9 Sept and meant 10 percent, and Centro Aloha's deposit is
// 10 EUR by Bizum. Neither is what the client pays for the massage, so nothing
// under 20 EUR counts and a figure sitting next to a deposit or a discount is
// skipped rather than trusted. A message often carries the discount and the
// final price together ("17:00, 45€ con el 10%"), which is exactly what we ask
// for, so a percentage elsewhere in the sentence is not a veto.
const priceIn = (s: string): number | null => {
  const re = /(?:^|[^\d])(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)|(?:precio|price|cuesta|son|queda|sale|total)\D{0,12}(\d{1,3}(?:[.,]\d{1,2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const v = parseFloat(String(m[1] || m[2]).replace(",", "."));
    if (!(v >= 20 && v <= 400)) continue;
    const before = s.slice(Math.max(0, m.index - 24), m.index);
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 18);
    if (/dep[oó]sito|se[ñn]al\b|fianza|adelanto|anticipo/i.test(before + " " + after)) continue;
    if (/^\s*(?:de\s+)?(?:descuento|dto)\b/i.test(after)) continue;
    return v;
  }
  return null;
};
// v113 (19 Sept): a studio that answers with its menu. Private Spa Madrid was
// asked for a 60 minute massage for Al and wrote "Masaje de 40 minutos 60€ /
// 1h 80€ / El horario a las 18:00 bien". The first price in that message is the
// 40 minute one, and quoting 60 EUR for an hour would have been wrong at the
// till, which is the single thing this function exists to prevent. So when the
// studio names durations, only the line matching the booking counts, and if
// they never priced that length we say nothing rather than guess.
export const parseQuotedPrice = (t: string, mins = 60): number | null => {
  const s = String(t || "");
  const byDuration = new Map<number, number>();
  for (const line of s.split(/[\n;]+/)) {
    const mm = line.match(/(\d{1,3})\s*min(?:uto)?s?\b/i);
    const hh = mm ? null : line.match(/\b(\d)\s*h(?:oras?)?\b/i);
    if (!mm && !hh) continue;
    const dur = mm ? parseInt(mm[1], 10) : parseInt(hh![1], 10) * 60;
    const p = priceIn(line);
    if (p !== null && dur > 0) byDuration.set(dur, p);
  }
  if (byDuration.size) return byDuration.has(mins) ? byDuration.get(mins)! : null;
  return priceIn(s);
};
export const euro = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2)) + " EUR";
export const HOME_VISIT_RE = /\b(?:home\s*(?:service|visit)s?|(?:home|in[-\s]?home|out)\s?call|(?:massage|masaje)\s+(?:at|in|en)\s+(?:my|mi)\s+(?:home|house|hotel|room|casa|habitaci[oó]n)|(?:come|travel|send|bring)(?:\s+\w+){0,2}?\s+(?:to|round\s+to)\s+(?:my|our|the)\s+(?:home|house|hotel|room|place|flat|apartment)|a\s+domicilio|en\s+mi\s+(?:casa|domicilio)|servicio\s+a\s+domicilio|(?:ven[ií]r|desplaz\w+)\s+a\s+mi\s+(?:casa|hotel|habitaci[oó]n))\b/i;
// A message that is nothing but a link. Case 04: four Instagram links in a row.
export const LINK_ONLY_RE = /^\s*(?:https?:\/\/|www\.)\S+\s*$/i;
export const MODESTY_RE = /\b(desnud\w*|sin\s*ropa|naked|nude|undress\w*|ropa\s*interior)\b/i;
// v81 (Jordan, 10 and 12 Sept): stop blocking, persuade instead. The old lines
// below ended the conversation and set the session to "blocked" forever. Ten
// people sat in that state, 19% of everyone who had ever written, more than had
// ever completed a booking. Two of them, Marvin and Abdul, had walked the whole
// funnel first and Abdul had a real 13 September booking already sent to three
// studios. The replacement answers the question flatly, without a lecture, and
// carries straight on with the booking. No moralising: Jordan was explicit that
// the point is to keep them in the flow, not to tell them off.
export const BLOCK_LINE_EN = "We book therapeutic massage at licensed studios, nothing else.";
export const BLOCK_LINE_ES = "Reservamos masajes terapéuticos en centros con licencia, nada más.";
// Someone asking for a man or a woman is stating a preference about their
// therapist, not asking for something else. Abdul typed "i need good girl for
// me" while a real booking was in flight; Fernando typed "MAN" and was dumped
// into the main menu 84 seconds before he cancelled. Both are this.
export const GENDER_RE = /\b(masajista\s+(chic[oa]|hombre|mujer|femenin[oa]|masculin[oa])|(chic[oa]|hombre|mujer|male|female|man|woman|guy|girl|lady)\s+(masajista|therapist|masseur|masseuse)|(male|female|man|woman|guy|girl)\s+(therapist|masseur|masseuse)|prefiero\s+(un\s+)?(chic[oa]|hombre|mujer)|quiero\s+(un[ao]?\s+)?(masajista\s+)?(chic[oa]|hombre|mujer))\b/i;
// v93: the answer to our own question. The bot says "if you would prefer a man
// or a woman, just tell me" and people answer with exactly one word, which
// GENDER_RE cannot match because every branch of it needs a second word.
// Fernando typed "MAN" on 11 Sept and cancelled fifty seconds later. Andy typed
// "Mujer" on 15 Sept and went quiet. This only ever runs when the bot has just
// asked, so a stray "man" in ordinary conversation is still not a preference.
// v102: an offer inside the band the customer asked for is not a change of
// plan. On 17 Sept the bot told Pedro that TornaSol could see him "a las 17:00
// Hoy en vez de Hoy Tarde (13-18)", and 17:00 sits inside 13-18. "Instead of"
// turned an exact match into an apology and made a good offer read like a
// compromise. Only a different day, or a time outside the band, is worth
// flagging to the customer.
export const askBand = (time1: string): [number, number] | null => {
  const t = String(time1 || "").trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (/morning|ma[n\u00f1]ana/.test(t)) return [10, 13];
  if (/afternoon|tarde/.test(t)) return [13, 18];
  if (/evening|night|noche/.test(t)) return [18, 21];
  return null;
};
export const offerMatchesAsk = (offeredTime: string, offerDay: string | null, day1: string, time1: string): boolean => {
  const od = String(offerDay || "").trim().toLowerCase();
  if (od && od !== String(day1 || "").trim().toLowerCase()) return false;
  const h = String(offeredTime || "").trim().match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!h) return false;
  const asked = String(time1 || "").trim();
  if (/^\d{1,2}(?:[:.]\d{2})?$/.test(asked)) return asked.replace(".", ":") === String(offeredTime).trim().replace(".", ":");
  const band = askBand(asked);
  if (!band) return false;
  const hour = parseInt(h[1], 10);
  return hour >= band[0] && hour < band[1];
};

export const GENDER_BARE_RE = /^(?:una?\s+)?(chic[oa]|hombre|mujer|se[nñ]ora|masculin[oa]|femenin[oa]|male|female|man|woman|guy|girl|lady)(?:\s+(?:por\s+favor|please|preferably|mejor|gracias|thanks|thx))?[.!]?$/i;
export const genderBare = (t: string): "male" | "female" | null => {
  const m = String(t || "").trim().match(GENDER_BARE_RE);
  if (!m) return null;
  return /^(chica|mujer|se[nñ]ora|femenin[oa]|female|woman|girl|lady)$/i.test(m[1]) ? "female" : "male";
};
export const genderWanted = (t: string): "male" | "female" | null => {
  if (!GENDER_RE.test(String(t || ""))) return null;
  return /\b(chica|mujer|femenin[oa]|female|woman|girl|lady|masseuse)\b/i.test(t) ? "female" : "male";
};
// v81: a studio answering the therapist-gender question in its own words.
// Returns true only on a clear yes and false only on a clear no. Anything else
// is null, because the rule is that we never tell a customer something a studio
// has not actually confirmed, and a wrong yes here means someone arrives to
// find the opposite of what they asked for.
// Real examples: Centro Aloha's "Si hay masajista chico, mañana le esperamos a
// Fernando" (10 Sept) is a yes; "Solo tenemos masajista chica" is a no to a man.
export function studioGenderReply(text: string, wanted: "male" | "female"): boolean | null {
  const t = stripAcc(text);
  if (!/(masajist|terapeut|chic[oa]|hombre|mujer|senor|chaval)/.test(t)) return null;
  const wantRe = wanted === "male" ? /(chico|hombre|masculino|chaval|senor)/ : /(chica|mujer|femenina|senora)/;
  const otherRe = wanted === "male" ? /(chica|mujer|femenina)/ : /(chico|hombre|masculino|chaval)/;
  const saysWanted = wantRe.test(t);
  const saysOther = otherRe.test(t);
  // "solo tenemos chica", "no hay chico", "no tenemos masajista hombre"
  if (/\b(no|solo|solamente|unicamente|nicamente)\b/.test(t)) {
    if (saysOther && !saysWanted) return false;
    if (/\bno\b[^.]{0,20}/.test(t) && saysWanted) return false;
    return null;
  }
  if (saysWanted && !saysOther) return true;
  return null;
}
// People asking for a job, not a massage (the ads reach therapists too).
// v109 (19 Sept): the first real job seeker reached us through the ads and
// this missed him, because it knew "massage therapist" and "masajista" but not
// "masseur". He asked three times whether we needed one, was answered with the
// therapist-gender line each time, and the flow built him two bookings and
// asked four studios to hold slots for him.
//
// The distinction that matters is who needs whom. "Do YOU need a masseur" is
// someone offering their labour. "I need a masseur" is a customer, and must
// never be caught here.
export const JOB_RE = /(\b(hiring|apply|applying|vacancy|vacancies|cv|resume|curriculum)\b|\bjob\b|\b(i|i'm|im|we)\s+(am\s+)?(a\s+)?(masseur|masseuse|massage\s+therapist|masajista|terapeuta)\b|\bwork(ing)?\s+as\s+(a\s+)?(masseur|masseuse|massage\s+therapist|therapist|masajista|terapeuta)\b|\b(do|dont|don't|if)\s+(you|they)\s+(need|want|require)\s+(a\s+)?(masseur|masseuse|massage\s+therapist|masajista|terapeuta)\b|\b(you|they)\s+need\s+(a\s+)?(masseur|masseuse|masajista)\b|\b(soy|busco)\s+(masajista|terapeuta|trabajo|empleo)\b|\bcontrat(ais|an|amos)\b|\bofrezco\s+mis\s+servicios\b)/i;
// "Any of them" / "you choose" typed instead of tapped.
export const ANY_RE = /^(any|anyone|any of them|anywhere|whichever|whatever|you (choose|pick|decide)|the best|best one|cualquiera|el que sea|elige tu|elegid|lo que sea|me da igual)\b/i;
// "I want a different type of massage" at the studio step.
export const OTHERTYPE_RE = /(different|another|other|specific|change).{0,20}(massage|type|kind|service)|(otro|distinto|diferente|especifico|específico).{0,20}(masaje|tipo)/i;
// A question asked in the middle of the flow must be answered, not stored as
// an answer. MRB asked "How much for 90 minutes?" at the area step and the bot
// filed it as his neighbourhood.
export const PRICEQ_RE = /(how much|price|cost|charges|rates?|cu[aá]nto|precio|cuesta|tarifa)/i;
export const QUESTION_RE = /(how much|how many|how long|price|cost|charges|what (is|are|do)|do you|can i|is it|cu[aá]nto|precio|cuesta|tarifa|qu[eé] incluye|puedo|se puede)/i;
export const looksLikeQuestion = (t: string): boolean => {
  const q = String(t || "").trim();
  if (!q) return false;
  if (QUESTION_RE.test(q)) return true;
  return q.includes("?") && q.split(/\s+/).length >= 3;
};
// "How does this work?" in its many forms - deserves an answer, not a menu.
export const HOWWORKS_RE = /(how (does (this|it) work|this works?|do (you|i))|how it works|what is this|what do you do|who are you|is this real|qu[eé] es esto|c[oó]mo funciona|qui[eé]nes sois|qu[eé] hac[eé]is|es real)/i;

// v112 (Jordan, 19 Sept): "why would you ask what day???" Someone came off the
// ad at 16:41 Madrid asking "What type of massage you provide?", got the price
// and the day buttons, asked "What type?" again, and was answered "Good choice.
// Which day suits you?". They asked the same question twice and never saw a
// list. A question about what we offer is answered with what we offer.
// OTHERTYPE_RE did not catch it because it wants "another" or "different" in
// front of the word type, and a plain "What type?" has neither.
export const SERVICEQ_RE = /^\s*(?:what|which|qu[eé]|cu[aá]l(?:es)?)\s*(?:type|types|kind|tipo|tipos)\s*\??\s*$|\b(?:what|which|qu[eé]|cu[aá]l(?:es)?)\b[^?.]{0,30}\b(?:types?|kinds?|sorts?|massages|services|tipos?|clases?|masajes|servicios)\b|\bwhat\s+(?:do\s+you|you)\s+(?:provide|offer|have|do)\b|\b(?:tipos?\s+de\s+masaje|qu[eé]\s+masajes)\b/i;

export const MAIN_SERVICES = [
  { id: "svc_relax", en: "Relaxing massage", tEn: "Relaxing", tEs: "Relajante" },
  { id: "svc_deep", en: "Deep tissue massage", tEn: "Deep tissue", tEs: "Descontracturante" },
  { id: "svc_thai", en: "Thai massage", tEn: "Thai", tEs: "Tailandés" },
  { id: "svc_sports", en: "Sports massage", tEn: "Sports", tEs: "Deportivo" },
  { id: "svc_stone", en: "Hot stone massage", tEn: "Hot stone", tEs: "Piedras calientes" },
  { id: "svc_unsure", en: "Not sure", tEn: "Help me figure it out", tEs: "Ayúdame a elegir" },
];
export const MORE_SERVICES = [
  { id: "svc_bali", en: "Balinese massage", tEn: "Balinese", tEs: "Balinés" },
  { id: "svc_shiatsu", en: "Shiatsu", tEn: "Shiatsu", tEs: "Shiatsu" },
  { id: "svc_reflex", en: "Reflexology", tEn: "Reflexology", tEs: "Reflexología" },
  { id: "svc_lymph", en: "Lymphatic drainage", tEn: "Lymphatic drainage", tEs: "Drenaje linfático" },
  { id: "svc_couples", en: "Couples massage", tEn: "Couples", tEs: "En pareja" },
  { id: "svc_kobido", en: "Kobido facial massage", tEn: "Kobido facial", tEs: "Kobido facial" },
];
export const ALL_SERVICES = [...MAIN_SERVICES, ...MORE_SERVICES];

// DB service names are English; translate them when shown inside a Spanish chat.
export const SVC_ES: Array<[RegExp, string]> = [
  [/deep tissue|descontracturante/i, "Masaje descontracturante"],
  [/thai|tailand/i, "Masaje tailandés"],
  [/hot stone|piedras/i, "Masaje de piedras calientes"],
  [/sport|deportivo/i, "Masaje deportivo"],
  [/balin/i, "Masaje balinés"],
  [/shiatsu/i, "Shiatsu"],
  [/reflexolog/i, "Reflexología"],
  [/lymphatic|drenaje|linfatic/i, "Drenaje linfático"],
  [/couples|pareja/i, "Masaje en pareja"],
  [/kobido/i, "Masaje facial Kobido"],
  [/relax|swedish|sueco/i, "Masaje relajante"],
  [/stress|antiestr/i, "Masaje antiestrés"],
  [/massage|masaje/i, "Masaje"],
];
export const trSvc = (name: string, L: string): string => {
  const n = String(name || "");
  if (L !== "es" || !n) return n;
  for (const [re, es] of SVC_ES) if (re.test(n)) return es;
  return n;
};
// Mid-sentence variant: "tu masaje tailandés", not "tu Masaje tailandés".
export const trSvcLow = (name: string, L: string): string => L === "es" ? trSvc(name, L).toLowerCase() : String(name || "");
export const AREAS = ["Centro", "Chamberí", "Salamanca", "Retiro", "La Latina", "Malasaña", "Chamartín"];
// Tappable areas: typing a neighbourhood was where most people went quiet.
export const AREA_ROWS = [
  { id: "area_centro", area: "Centro", en: "Centro / Sol", es: "Centro / Sol" },
  { id: "area_chamberi", area: "Chamberí", en: "Chamberí", es: "Chamberí" },
  { id: "area_salamanca", area: "Salamanca", en: "Salamanca", es: "Salamanca" },
  { id: "area_retiro", area: "Retiro", en: "Retiro", es: "Retiro" },
  { id: "area_chamartin", area: "Chamartín", en: "Chamartín", es: "Chamartín" },
  { id: "area_malasana", area: "Malasaña", en: "Malasaña / Chueca", es: "Malasaña / Chueca" },
];

export const HOURS: Record<string, { hours: string[]; label: string; labelEs: string }> = {
  time_morning: { hours: ["10:00", "11:00", "12:00"], label: "Morning (10-13)", labelEs: "Mañana (10-13)" },
  time_afternoon: { hours: ["13:00", "14:00", "15:00", "16:00", "17:00"], label: "Afternoon (13-18)", labelEs: "Tarde (13-18)" },
  time_evening: { hours: ["18:00", "19:00", "20:00"], label: "Evening (18-21)", labelEs: "Noche (18-21)" },
};
export const COPY: Record<string, any> = {
  en: {
    // v81 (Jordan, 12 Sept). The old opener made three claims about us before
    // asking anything, and offered nine services as a WhatsApp list, which is a
    // menu the customer has to open first. 37 people sent one message and never
    // wrote again; 12 of them stopped exactly here. Three claims become one, and
    // nine options become three taps with everything else behind "Something else".
    intro: "Hi! We're Massage Club, we help you find the best massage in Madrid.\n\nWhat type of massage would you like?",
    introBtns: [{ id: "svc_relax", title: "Relaxing" }, { id: "svc_deep", title: "Deep tissue" }, { id: "svc_more", title: "Something else" }],
    introBtn: "Choose massage",
    moreTitle: "More massages:",
    moreRow: { title: "More massages", desc: "Balinese, shiatsu, reflexology..." },
    backRow: { title: "Back", desc: "main massage list" },
    day: "Good choice. Which day suits you?",
    // v105: repeating the same question at someone who sent something we could
    // not read makes the bot look broken. On 18 Sept a lead sent four Instagram
    // links and got "Good choice. Which day suits you?" four times, word for
    // word. From the second miss at a step we say so first.
    notCaught: "Sorry, I did not catch that.",
    gotLink: "Thank you for the link. Would you like to continue with booking a massage?",
    // Jordan, 19 Sept, case 02: we book in person only. Say so, then ask the
    // one question that keeps them moving.
    noHomeVisit: "We only book massages in person, at professional studios. I can find you one close by. Which part of Madrid are you in? You can also share your location.",
    dayUnsure: "No problem, that's what we're here for. We'll match you with the right massage and studio. Which day suits you?",
    dayBtns: [{ id: "day_today", title: "Today" }, { id: "day_tomorrow", title: "Tomorrow" }, { id: "day_other", title: "Another day" }],
    dayAsk: "Which day? Just type it, for example Saturday or 3 September.",
    // v81b: exact times are invited here rather than hidden behind a fourth
    // list row. Anyone who needs 20:00 says so and gets 20:00; everyone else
    // gives a window the studio can actually fill from its own gaps.
    time: "What time works best? Tap a window, or type an exact time like 20:00.",
    timeBtn: "Pick a window",
    timeCustomRow: { title: "Custom time", desc: "type your exact time" },
    timeAsk: "What time? Type it, for example 16:30 or 9pm.",
    hour: "And what exact time? The studio confirms faster with a precise time.",
    hourBtn: "Pick a time",
    hourFlex: "Flexible",
    hourFlexDesc: "any time in this window",
    area: "Last question: which part of Madrid are you located in? Tap one, type any other area, or share your location.",
    areaBtn: "Choose area",
    areaAnyTitle: "Anywhere in Madrid",
    areaAnyDesc: "we pick the best studio for you",
    areaOtherTitle: "Another area",
    areaOtherDesc: "type it or share your location",
    areaShare: "Type your area, for example Arganzuela or Tetuán, or share your location.",
    gotItSvc: (svc: string) => `Got it, ${svc}. 👌`,
    // v81: after four taps we stop asking and go to work. This is the first
    // message in the whole flow the customer receives instead of gives.

    jobSeeker: "Thanks for writing! We do not hire directly, but we work with Madrid's best studios and sometimes they look for good therapists. Send your name, experience and the neighbourhoods you cover, and we will keep you in mind. 🙏",
    otherTypeAck: "Of course, let us change the massage. Your day, time and area are saved.",
    areaAgain: "Type your area, for example Chamberí, Sol or Retiro. Or tap share location.",
    modesty: "Good question. Our studios are professional therapeutic studios: you are covered with a towel the whole time and underwear stays on. The therapist only uncovers the area being worked on. If that works for you, let us carry on with your booking.",
    studios: "Best matches near you, with real prices. Pick one and we ask them to confirm your time.\n\nType *back* anytime to change an earlier answer.",
    // v73: the three studios that signed up and loaded their own menu are the
    // only ones we can quote at an exact price, so say so when we recommend one.
    topPick: (name: string, svcN: string, dur: number, price: number, area: string, registered?: boolean) =>
      `Best match for you:\n\n*${name}*\n${svcN} · ${dur} min · ${price} EUR\n${area}${registered ? "\nMassage Club partner, so that is their real menu price and not an estimate." : ""}\n\nShall we ask them to confirm your time?`,
    topPickBtns: [{ id: "pick_yes", title: "Yes, book it" }, { id: "pick_more", title: "See other options" }],
    partnerTag: "Massage Club partner",
    // v79: "Who give the Massage ?" and "Provide the service male or female?".
    // True of every studio, needs no data we do not hold, and offers the thing
    // they are really asking for rather than just stating a policy.
    therapistAnswer: "The massage is given by a qualified therapist at the studio. If you would prefer a man or a woman, just tell me and I will ask the studio before booking.",
    // v77: the customer names a time at the offer step. Asim typed "7pm?" while
    // TornaSol and Calma had both already offered 19:00 on his request, and the
    // bot repeated the 18:00 he had just declined.
    altOffer: (studio: string, time: string) => `Good news, *${studio}* can do *${time}*. Shall I book that?`,
    askingTime: (time: string) => `Let me ask the studios about ${time} and I will come straight back here.`,
    bookedLink: (name: string, url: string) => `${name}: ${url}`,
    studiosBtn: "Choose studio",
    studioLinks: "Want a closer look first? Photos, full menus and reviews:",
    anyStudio: "Any of them",
    anyStudioDesc: "we pick the best fit",
    otherStudio: "A different studio",
    otherStudioDesc: "type the studio's name",
    otherStudioAsk: "Which studio? Type its name and we will ask them for your time.",
    name: "Almost done: what is your name?",
    email: "Last thing before I ask the studios: what is your email? The studio's confirmation goes there as well as here, so nothing gets lost if it cannot reach you on WhatsApp.",
    emailBad: "That does not look like an email address. Could you send it again? It is the one thing that guarantees your confirmation reaches you.",
    // v125: an address that turns up later, at any step. Hatem sent his nine
    // seconds after we had given up asking and it was read as a menu tap.
    emailLate: (addr: string) => `Got it, thank you. I have put ${addr} on your booking, so the confirmation reaches you there as well as here.`,
    emailAskPost: "One more thing: want this confirmation by email, plus your bookings saved so next time takes one tap? Reply with your email and your free account is ready.",
    emailSaved: "Done! Check your inbox: your confirmation and account link are on their way. 📫",
    rebookLater: "No problem, we'll be here when you need us. 🙌",
    // v112: the answer to "what type?" is the list, not another question. Built
    // from MAIN_SERVICES and MORE_SERVICES so it can never drift from the
    // picker that follows it.
    servicesAnswer: "We book these at professional studios in Madrid:\n\n"
      + MAIN_SERVICES.filter((x) => x.id !== "svc_unsure").map((x) => "\u00b7 " + x.tEn).join("\n")
      + "\n\nAlso available: " + MORE_SERVICES.map((x) => x.tEn).join(", ")
      + ".\n\nWhich one would you like? If you are not sure, I can help you pick.",
    howItWorks: "Happy to explain! It is simple:\n\n1. Tell us what massage you would like and when\n2. We confirm the time and price with one of Madrid's best studios for you, everything in English\n3. You just show up and pay the studio directly. No fee from us, and your time is only booked once the studio confirms.\n\nAll our studios with photos and prices: book.massageclub.io - but you're very welcome to keep everything right here in the chat, we handle it for you.",
    human: `No problem. A Massage Club representative will message you personally in a few minutes from our main number ${JORDAN_MAIN_NUMBER}. You can also just reply here, we see everything.`,
    menuTitle: "What would you like to do?",
    menuBtn: "Open menu",
    menuRows: [
      { id: "menu_status", title: "My booking", description: "check where your booking is" },
      { id: "menu_book", title: "Book a massage", description: "start a new booking" },
      { id: "lang_es", title: "Español", description: "cambiar a español" },
    ],
    noBooking: "No bookings yet under this number. Want to make one? Type *book*.",
    welcomeBack: (n: string, svcN: string, studio: string) =>
      `Welcome back${n ? " " + n : ""}! Massage Club here.\n\nLast time you booked ${svcN}${studio ? " at " + studio : ""}. Same again, or something new?`,
    welcomeBackBtns: [{ id: "rebook_same", title: "Same again" }, { id: "menu_book", title: "New booking" }, { id: "menu_status", title: "My booking" }],
    welcomeBackPlain: (n: string) => `Welcome back${n ? " " + n : ""}! Massage Club here. What would you like to do?`,
    welcomeBackPlainBtns: [{ id: "menu_book", title: "Book a massage" }, { id: "menu_status", title: "My booking" }],
    stages: { new: "Received. We are checking with the studio now.", studio_asked: "Sent to the studio. Waiting for them to confirm your time.", studio_replied: "The studio replied. We are finalising your time.", offered: "We sent you options. Reply with your choice.", confirmed: "Confirmed! Check the details in this chat or your email.", dismissed: "Closed.", cancelled: "Cancelled.", no_show: "Missed. Write here whenever you want to rebook." },
    statusLine: (svcN: string, when: string, studio: string, stage: string) => `${svcN}${when ? " · " + when : ""}${studio ? "\nStudio: " + studio : ""}\nStatus: ${stage}`,
    confirm: (n: string, sN: string, w: string, st: string, _id: number | null) =>
      `Done, ${n}. ${sN}, ${w}, ${st}.\n\nI'm asking the studios right now and I'll write here the moment one confirms, usually within the hour when they're open. If nobody can do that time, I'll suggest another. You pay at the studio, no fee.`,
    studioConfirmed: (n: string, studio: string, svcN: string, when: string) =>
      `Good news ${n}! *${studio}* confirmed your ${svcN} for *${when}*.\n\nYou pay the studio directly. Enjoy!\n\nMassage Club · book.massageclub.io`,
    priceInfo: "Good question. At our studios 60 minutes is usually between 40 and 85 EUR, and 90 minutes between 60 and 100 EUR, depending on the studio and the type of massage. We always send you the exact price before you confirm, and you pay the studio directly. No fee from us.",
    ackReply: "🙌 We'll update you here as soon as the studio replies.",
    cardIntro: (url: string) => `Massage Club here. Book in three taps, no login, and watch the studios reply live:\n${url}\n\nOr just tell me what you would like and I will handle it right here.`,
    // v119 (Jordan, 22 Sept): "you must be positive the clients want to book a
    // massage. confirm and then send it to the masage places." Nothing goes to
    // a studio until the person says yes to this. Pilar tapped buttons at
    // random to make an English bot stop talking at her, and four studios were
    // asked for an appointment she had never wanted.
    askGo: (name: string, svc: string, when: string, where: string) =>
      `Let me read that back, ${name}: ${svc}, ${when}, ${where}.\n\nShall I ask the studios now?`,
    askGoBtns: [{ id: "go_yes", title: "Yes, ask them" }, { id: "go_change", title: "Change something" }],
    goChanged: "No problem, nothing has been sent. Let's fix it.",
    goWaiting: "Nothing has gone out yet. Tap Yes and I ask the studios, or tell me what to change.",
    confirmLater: (n: string, sN: string, w: string, st: string, _id: number | null) =>
      `Done, ${n}. ${sN}, ${w}, ${st}.\n\nThe studios are closed right now. I'll ask them the moment they open at 09:00 and write here as soon as one confirms. If nobody can do that time, I'll suggest another. You pay at the studio, no fee.`,
    offer: (n: string, studio: string, where: string, svcN: string, time: string, day: string, asked: string) =>
      `Update on your ${svcN}${n ? ", " + n : ""}:\n\n${studio}${where ? " (" + where + ")" : ""} can take you at ${time} ${day}.\n\nDoes that work?`,
    // v81 (Jordan, 12 Sept): the member rate. We ask every studio for a Massage
    // Club rate, so when one gives it in writing the customer hears what we got
    // them, not just a price. It is truthful only because that is literally how
    // we obtain it: never label a studio's ordinary price a member rate, and
    // never mention a discount we asked for and did not get. The figure must be
    // computed from the price the studio confirmed, never rounded to look nicer:
    // 10% off 60 is 54, not 55.
    // v83: sent 15 minutes after the massage ends. Massage Club's own review
    // page, not Google: the reviews are an asset we keep and they feed the
    // studio pages. Deliberately one line and one link, because Jordan asked
    // for super simple and a paragraph after a massage gets ignored.
    // v87: the line nobody should ever need. It only goes out when a branch
    // answered nothing at all, which is a bug, so it stays vague on purpose
    // rather than guessing at what they asked. Jordan is told every time.
    fallbackAck: "Got that, thank you. Let me look into it and I will come straight back to you.",
    reviewAsk: (studio: string, link: string) =>
      `How was ${studio || "it"}? Rate it here, takes 10 seconds:\n${link}`,
    // v110 (Jordan, 19 Sept): "before we offer pricing we must confirm with the
    // studio there price after our potential discount." The old memberRate line
    // multiplied a listed price by the discount and called the result a member
    // rate. A listed price is not a confirmed one, so it is gone. This line only
    // ever carries a number the studio wrote about this booking, and it only
    // says "Massage Club rate" when that same studio also confirmed a discount.
    priceLine: (n: number, mins: number, member: boolean) =>
      member
        ? `Price: ${euro(n)} for ${mins} minutes, the Massage Club rate they confirmed for you. You pay at the studio.`
        : `Price: ${euro(n)} for ${mins} minutes, confirmed by the studio. You pay there, no fee.`,
    // Asked only after they tap to book, where it buys them something.
    memberJoin: "Brilliant. Membership is free, I just need your name and email to lock in the rate and send your confirmation. I'll pass your details to the studio so they can reach you on the day.",
    offerYes: (t: string) => `Yes, book ${t}`,
    offerNo: "Another time",
    offerAccepted: (studio: string, when: string, addr: string, phone: string) =>
      `Booked! *${studio}* confirmed your massage for *${when}*.${addr ? "\nAddress: " + addr : ""}${phone ? "\nStudio phone: " + phone : ""}\n\nYou pay the studio directly. Enjoy!\n\nMassage Club · book.massageclub.io`,
    offerDeclined: "No problem, we keep asking the other studios and will message you with the next option.",
    offerGone: "That slot has just been taken, sorry. We are still on it and will message you with the next option.",
    offerRemind: (studio: string, time: string) => `Just so we do not lose it: *${studio}* can do *${time}*. Tap Yes to book it, or Another time and we keep looking.`,
    // v124: what Juan should have heard. Honest about what is and is not being
    // held, and when the reminder is switched on it commits us to exactly one
    // more message, on a day we can name. With it switched off it promises
    // nothing, because a promise we do not keep is how we lost him.
    confirmLaterAck: (armed: boolean) =>
      armed
        ? `Understood, I will write here the day before so you can confirm then.\n\nNothing is booked yet and the studio is not holding the time for you, so if you decide sooner just tap *Yes* on the message above and it is done.`
        : `Understood. Nothing is booked yet and the studio is not holding the time for you. Whenever you are ready, tap *Yes* on the message above, or tell me a time and I will ask them again.`,
    confirmLaterNudge: (n: string, studio: string, time: string, day: string) =>
      `Hello${n ? " " + n : ""}, you said you would confirm the day before, so here it is.\n\n${studio} at ${time}${day ? " " + day : ""}. Shall I book it?`,
    sameDay: "Quick heads-up: most Madrid studios open at 11:00 or 12:00, so the earliest they can usually confirm today is around 12:00. What would you prefer?",
    sameDayBtns: (t: string) => [{ id: "sd_earliest", title: "Earliest today" }, { id: "sd_tomorrow", title: "Tomorrow morning" }, { id: "sd_keep", title: `Keep ${t}`.slice(0, 20) }],
    earliestToday: "Earliest available (from 12:00)",
    timeChange: (studio: string, time: string, day: string, old: string) =>
      `Change from the studio: *${studio}* now says *${time}* ${day}${old ? " instead of " + old : ""}. Does that still work?`,
    timeChangeDeclined: (old: string) => `Understood. We have asked the studio to keep your original time${old ? " (" + old + ")" : ""} and will confirm here. If they cannot, we find you another option.`,
    reconfirmYes: (studio: string, time: string, addr: string) => `Great, see you at *${time}*${studio ? " at " + studio : ""}.${addr ? "\n" + addr : ""}\nWe have told the studio you are coming.`,
    changeAsk: (studio: string, time: string) => `Understood, we will not hold you to ${time}${studio ? " at " + studio : ""}. What day and time would work instead? Type it here and we check with the studio right away.`,
    changeNoted: (studio: string) => `Got it. We are checking that with ${studio || "the studio"} now and will confirm here. Nothing is booked until you say yes.`,
    cancelled: (studio: string) => `Cancelled, no problem. We have let ${studio || "the studio"} know. Whenever you want another one, just write here.`,
    missedYou: (studio: string) => `We are sorry we missed you today at ${studio || "the studio"}. If something came up, just reply here and we will find you another time.`,
    studioReaching: (studio: string, time: string, text: string) => `${studio} is trying to reach you about your ${time} appointment${text ? ': "' + text.slice(0, 120) + '"' : ""}. Are you on your way? Reply here and we will let them know.`,
    reconfirmRemind: (studio: string, time: string) => `Quick one: are you still coming to ${studio} at ${time}? Reply *yes*, or tell us what to change.`,
    // v76: what we say when someone asks something we have no canned answer
    // for. Before this, an unanswerable question fell through to the service
    // menu: Fernando asked which metro and Asim asked whether a man or a woman
    // does the treatment, and both got "which massage would you like?".
    willFindOut: "Good question. I would rather check than guess, so I am finding out for you now and I will come straight back here with the answer.",
    noHuman: "I can sort this out right here. Tell me the massage you would like, the day, and the part of Madrid, in one message if you like. 60 minutes is 40 to 85 EUR depending on the studio, paid directly there, no fee from us.",
    zoneAnswer: "We are not a single studio. We book you into professional studios all over Madrid (Centro, Salamanca, Chamberí, Retiro, Chamartín, Malasaña and more) and you pick the area that suits you.",
  },
  es: {
    intro: "¡Hola! Somos Massage Club, te ayudamos a encontrar el mejor masaje de Madrid.\n\n¿Qué tipo de masaje quieres?",
    introBtns: [{ id: "svc_relax", title: "Relajante" }, { id: "svc_deep", title: "Descontracturante" }, { id: "svc_more", title: "Otra cosa" }],
    introBtn: "Elegir masaje",
    moreTitle: "Más masajes:",
    moreRow: { title: "Más masajes", desc: "balinés, shiatsu, reflexología..." },
    backRow: { title: "Volver", desc: "lista principal" },
    day: "Buena elección. ¿Qué día te viene bien?",
    notCaught: "Perdona, no te he entendido.",
    gotLink: "Gracias por el enlace. ¿Quieres seguir con la reserva del masaje?",
    noHomeVisit: "Solo reservamos masajes presenciales, en centros profesionales. Te busco uno cerca. ¿En qué zona de Madrid estás? También puedes compartir tu ubicación.",
    dayUnsure: "Sin problema, para eso estamos. Te buscamos el masaje y el centro perfectos. ¿Qué día te viene bien?",
    dayBtns: [{ id: "day_today", title: "Hoy" }, { id: "day_tomorrow", title: "Mañana" }, { id: "day_other", title: "Otro día" }],
    dayAsk: "¿Qué día? Escríbelo, por ejemplo sábado o 3 de septiembre.",
    time: "¿Qué hora te viene mejor? Toca una franja, o escribe una hora exacta como las 20:00.",
    timeBtn: "Elegir franja",
    timeCustomRow: { title: "Otra hora", desc: "escribe tu hora exacta" },
    timeAsk: "¿A qué hora? Escríbela, por ejemplo 16:30 o 21:00.",
    hour: "¿Y a qué hora exacta? El centro confirma antes con una hora concreta.",
    hourBtn: "Elegir hora",
    hourFlex: "Flexible",
    hourFlexDesc: "cualquier hora de esta franja",
    area: "Última pregunta: ¿en qué zona de Madrid estás? Toca una, escribe otra zona, o comparte tu ubicación.",
    areaBtn: "Elegir zona",
    areaAnyTitle: "Cualquier zona",
    areaAnyDesc: "elegimos el mejor centro para ti",
    areaOtherTitle: "Otra zona",
    areaOtherDesc: "escríbela o comparte tu ubicación",
    areaShare: "Escribe tu zona, por ejemplo Arganzuela o Tetuán, o comparte tu ubicación.",
    gotItSvc: (svc: string) => `Perfecto, ${svc}. 👌`,

    jobSeeker: "¡Gracias por escribir! No contratamos directamente, pero trabajamos con los mejores centros de Madrid y a veces buscan buenos masajistas. Envíanos tu nombre, experiencia y las zonas que cubres, y te tendremos en cuenta. 🙏",
    otherTypeAck: "Claro, cambiamos el masaje. Tu día, hora y zona quedan guardados.",
    areaAgain: "Escribe tu zona, por ejemplo Chamberí, Sol o Retiro. O toca compartir ubicación.",
    modesty: "Buena pregunta. Nuestros centros son profesionales y terapéuticos: te cubren con una toalla durante toda la sesión y la ropa interior se mantiene puesta. El terapeuta solo descubre la zona que está trabajando. Si te parece bien, seguimos con tu reserva.",
    studios: "Las mejores opciones cerca de ti, con precios reales. Elige una y pedimos al centro que confirme tu hora.\n\nEscribe *volver* cuando quieras para cambiar una respuesta anterior.",
    topPick: (name: string, svcN: string, dur: number, price: number, area: string, registered?: boolean) =>
      `Tu mejor opción:\n\n*${name}*\n${svcN} · ${dur} min · ${price} EUR\n${area}${registered ? "\nCentro asociado a Massage Club, así que este es su precio real de carta, no una estimación." : ""}\n\n¿Les pedimos que confirmen tu hora?`,
    topPickBtns: [{ id: "pick_yes", title: "Sí, resérvalo" }, { id: "pick_more", title: "Ver otras opciones" }],
    partnerTag: "centro asociado",
    therapistAnswer: "El masaje lo da un terapeuta profesional del centro. Si prefieres que sea hombre o mujer, dímelo y se lo pregunto al centro antes de reservar.",
    altOffer: (studio: string, time: string) => `Buenas noticias, *${studio}* puede a las *${time}*. ¿Te lo reservo?`,
    askingTime: (time: string) => `Les pregunto por las ${time} y te digo aquí mismo.`,
    bookedLink: (name: string, url: string) => `${name}: ${url}`,
    studiosBtn: "Elegir centro",
    studioLinks: "¿Quieres verlos antes? Fotos, menús completos y opiniones:",
    anyStudio: "Cualquiera",
    anyStudioDesc: "elegimos el mejor para ti",
    otherStudio: "Otro centro",
    otherStudioDesc: "escribe el nombre del centro",
    otherStudioAsk: "¿Qué centro? Escribe su nombre y les pedimos tu hora.",
    name: "Casi listo: ¿cómo te llamas?",
    email: "Última cosa antes de preguntar a los centros: ¿cuál es tu email? Ahí te llega también la confirmación del centro, así no se pierde nada si por lo que sea no te llega por WhatsApp.",
    emailBad: "Eso no parece un email. ¿Me lo puedes escribir otra vez? Es lo que garantiza que te llegue la confirmación.",
    // v125: ver la nota en la versión inglesa.
    emailLate: (addr: string) => `Perfecto, gracias. He añadido ${addr} a tu reserva, así la confirmación te llega también por ahí.`,
    emailAskPost: "Una cosa más: ¿quieres la confirmación por email y tus reservas guardadas para repetir en un toque? Responde con tu email y tu cuenta gratis queda lista.",
    emailSaved: "¡Listo! Mira tu correo: te llegan la confirmación y el enlace de tu cuenta. 📫",
    rebookLater: "Sin problema, aquí estaremos cuando te apetezca. 🙌",
    servicesAnswer: "Reservamos estos en centros profesionales de Madrid:\n\n"
      + MAIN_SERVICES.filter((x) => x.id !== "svc_unsure").map((x) => "\u00b7 " + x.tEs).join("\n")
      + "\n\nTambién: " + MORE_SERVICES.map((x) => x.tEs).join(", ")
      + ".\n\n¿Cuál te apetece? Si no lo tienes claro, te ayudo a elegir.",
    howItWorks: "¡Te lo explicamos! Es muy fácil:\n\n1. Dinos qué masaje quieres y cuándo\n2. Confirmamos hora y precio con uno de los mejores centros de Madrid por ti\n3. Solo tienes que ir y pagar directamente en el centro. Sin comisión, y tu hora queda reservada cuando el centro confirma.\n\nTodos nuestros centros con fotos y precios: book.massageclub.io - aunque puedes seguirlo todo por aquí mismo, nosotros nos encargamos.",
    human: `Sin problema. Un representante de Massage Club te escribe personalmente en unos minutos desde nuestro número principal ${JORDAN_MAIN_NUMBER}. También puedes responder aquí, lo vemos todo.`,
    menuTitle: "¿Qué quieres hacer?",
    menuBtn: "Abrir menú",
    menuRows: [
      { id: "menu_status", title: "Mi reserva", description: "ver el estado de tu reserva" },
      { id: "menu_book", title: "Reservar masaje", description: "empezar una reserva nueva" },
      { id: "lang_en", title: "English", description: "switch to English" },
    ],
    noBooking: "No hay reservas con este número todavía. ¿Quieres hacer una? Escribe *reservar*.",
    welcomeBack: (n: string, svcN: string, studio: string) =>
      `¡Hola de nuevo${n ? " " + n : ""}! Somos Massage Club.\n\nLa última vez reservaste ${svcN}${studio ? " en " + studio : ""}. ¿Repetimos, o algo nuevo?`,
    welcomeBackBtns: [{ id: "rebook_same", title: "Repetir" }, { id: "menu_book", title: "Nueva reserva" }, { id: "menu_status", title: "Mi reserva" }],
    welcomeBackPlain: (n: string) => `¡Hola de nuevo${n ? " " + n : ""}! Somos Massage Club. ¿Qué quieres hacer?`,
    welcomeBackPlainBtns: [{ id: "menu_book", title: "Reservar masaje" }, { id: "menu_status", title: "Mi reserva" }],
    stages: { new: "Recibida. Estamos consultando con el centro.", studio_asked: "Enviada al centro. Esperando que confirmen tu hora.", studio_replied: "El centro ha respondido. Estamos cerrando tu hora.", offered: "Te enviamos opciones. Responde con tu elección.", confirmed: "¡Confirmada! Mira los detalles en este chat o tu email.", dismissed: "Cerrada.", cancelled: "Cancelada.", no_show: "No asististe. Escríbenos cuando quieras otra hora." },
    statusLine: (svcN: string, when: string, studio: string, stage: string) => `${svcN}${when ? " · " + when : ""}${studio ? "\nCentro: " + studio : ""}\nEstado: ${stage}`,
    confirm: (n: string, sN: string, w: string, st: string, _id: number | null) =>
      `Listo, ${n}. ${sN}, ${w}, ${st}.\n\nEstoy preguntando a los centros ahora mismo y te escribo aquí en cuanto uno confirme, normalmente en menos de una hora si están abiertos. Si ninguno puede a esa hora, te propongo otra. Pagas en el centro, sin comisión.`,
    studioConfirmed: (n: string, studio: string, svcN: string, when: string) =>
      `¡Buenas noticias ${n}! *${studio}* ha confirmado tu ${svcN} para *${when}*.\n\nPagas directamente en el centro. ¡Disfruta!\n\nMassage Club · book.massageclub.io`,
    priceInfo: "Buena pregunta. En nuestros centros 60 minutos suele costar entre 40 y 85 EUR, y 90 minutos entre 60 y 100 EUR, según el centro y el tipo de masaje. Te enviamos el precio exacto antes de confirmar y pagas directamente en el centro. Sin comisión.",
    ackReply: "🙌 Te avisamos por aquí en cuanto responda el centro.",
    cardIntro: (url: string) => `Somos Massage Club. Reserva en tres toques, sin registro, y mira cómo responden los centros en directo:\n${url}\n\nO dime qué quieres y lo gestiono por aquí mismo.`,
    // v119: ver la nota en la version inglesa.
    askGo: (name: string, svc: string, when: string, where: string) =>
      `Te lo repito, ${name}: ${svc}, ${when}, ${where}.\n\n¿Pregunto ya a los centros?`,
    askGoBtns: [{ id: "go_yes", title: "Sí, pregunta" }, { id: "go_change", title: "Cambiar algo" }],
    goChanged: "Sin problema, no hemos enviado nada. Lo cambiamos.",
    goWaiting: "Todavía no ha salido nada. Toca Sí y pregunto a los centros, o dime qué cambiamos.",
    confirmLater: (n: string, sN: string, w: string, st: string, _id: number | null) =>
      `Listo, ${n}. ${sN}, ${w}, ${st}.\n\nAhora mismo los centros están cerrados. Les pregunto en cuanto abran a las 09:00 y te escribo aquí en cuanto uno confirme. Si ninguno puede a esa hora, te propongo otra. Pagas en el centro, sin comisión.`,
    offer: (n: string, studio: string, where: string, svcN: string, time: string, day: string, asked: string) =>
      `Novedades sobre tu ${svcN}${n ? ", " + n : ""}:\n\n${studio}${where ? " (" + where + ")" : ""} puede atenderte a las ${time} ${day}.\n\n¿Te va bien?`,
    fallbackAck: "Recibido, gracias. Lo miro y te digo algo enseguida.",
    reviewAsk: (studio: string, link: string) =>
      `¿Qué tal ${studio || "ha ido"}? Valóralo aquí, son 10 segundos:\n${link}`,
    priceLine: (n: number, mins: number, member: boolean) =>
      member
        ? `Precio: ${euro(n)} por ${mins} minutos, la tarifa Massage Club que te han confirmado. Pagas en el centro.`
        : `Precio: ${euro(n)} por ${mins} minutos, confirmado por el centro. Pagas allí, sin comisión.`,
    memberJoin: "Genial. Hacerse socio es gratis, solo necesito tu nombre y tu email para fijar la tarifa y mandarte la confirmación. Paso tus datos al centro para que puedan localizarte el día de la cita.",
    offerYes: (t: string) => `Sí, reserva ${t}`,
    offerNo: "Otra hora",
    offerAccepted: (studio: string, when: string, addr: string, phone: string) =>
      `¡Reservado! *${studio}* ha confirmado tu masaje para *${when}*.${addr ? "\nDirección: " + addr : ""}${phone ? "\nTeléfono del centro: " + phone : ""}\n\nPagas directamente en el centro. ¡Disfruta!\n\nMassage Club · book.massageclub.io`,
    offerDeclined: "Sin problema, seguimos preguntando a los demás centros y te escribimos con la siguiente opción.",
    offerGone: "Esa hora acaba de ocuparse, lo sentimos. Seguimos en ello y te escribimos con la siguiente opción.",
    offerRemind: (studio: string, time: string) => `Para que no se pierda: *${studio}* puede a las *${time}*. Toca Sí para reservarla, u Otra hora y seguimos buscando.`,
    // v124: ver la nota en la versión inglesa.
    confirmLaterAck: (armed: boolean) =>
      armed
        ? `Entendido, te escribo por aquí el día antes para que lo confirmes entonces.\n\nNo hay nada reservado todavía y el centro no te está guardando la hora, así que si lo decides antes, toca *Sí* en el mensaje de arriba y listo.`
        : `Entendido. No hay nada reservado todavía y el centro no te está guardando la hora. Cuando lo tengas claro, toca *Sí* en el mensaje de arriba, o dime una hora y se la pregunto.`,
    confirmLaterNudge: (n: string, studio: string, time: string, day: string) =>
      `Hola${n ? " " + n : ""}, me dijiste que lo confirmabas el día antes, así que aquí lo tienes.\n\n${studio} a las ${time}${day ? " " + day : ""}. ¿Te la reservo?`,
    sameDay: "Aviso rápido: la mayoría de los centros de Madrid abren a las 11:00 o 12:00, así que lo más temprano que suelen confirmar hoy es sobre las 12:00. ¿Qué prefieres?",
    sameDayBtns: (t: string) => [{ id: "sd_earliest", title: "Lo antes posible hoy" }, { id: "sd_tomorrow", title: "Mañana por la mañana" }, { id: "sd_keep", title: `Mantener ${t}`.slice(0, 20) }],
    earliestToday: "Lo antes posible (desde 12:00)",
    timeChange: (studio: string, time: string, day: string, old: string) =>
      `Cambio del centro: *${studio}* ahora propone *${time}* ${day}${old ? " en vez de " + old : ""}. ¿Te sigue viniendo bien?`,
    timeChangeDeclined: (old: string) => `Entendido. Le hemos pedido al centro que mantenga tu hora original${old ? " (" + old + ")" : ""} y te confirmamos por aquí. Si no pueden, te buscamos otra opción.`,
    reconfirmYes: (studio: string, time: string, addr: string) => `Genial, nos vemos a las *${time}*${studio ? " en " + studio : ""}.${addr ? "\n" + addr : ""}\nYa le hemos dicho al centro que vas.`,
    changeAsk: (studio: string, time: string) => `Entendido, no te comprometemos a las ${time}${studio ? " en " + studio : ""}. ¿Qué día y hora te vendrían bien? Escríbelo aquí y lo consultamos con el centro ahora mismo.`,
    changeNoted: (studio: string) => `Apuntado. Lo estamos consultando con ${studio || "el centro"} y te confirmamos por aquí. No hay nada reservado hasta que digas que sí.`,
    cancelled: (studio: string) => `Cancelado, sin problema. Ya hemos avisado a ${studio || "el centro"}. Cuando quieras otro, escríbenos por aquí.`,
    missedYou: (studio: string) => `Sentimos no haberte visto hoy en ${studio || "el centro"}. Si surgió algo, responde aquí y te buscamos otra hora.`,
    studioReaching: (studio: string, time: string, text: string) => `${studio} intenta contactarte sobre tu cita de las ${time}${text ? ': "' + text.slice(0, 120) + '"' : ""}. ¿Estás de camino? Responde aquí y se lo decimos.`,
    reconfirmRemind: (studio: string, time: string) => `Una cosa rápida: ¿sigues contando con ir a ${studio} a las ${time}? Responde *sí*, o dinos qué cambiar.`,
    willFindOut: "Buena pregunta. Prefiero confirmarlo antes que darte un dato a medias, así que lo consulto ahora mismo y te digo aquí.",
    noHuman: "Te lo resuelvo aquí mismo. Dime qué masaje quieres, qué día y en qué zona de Madrid, en un solo mensaje si quieres. 60 minutos cuesta entre 40 y 85 EUR según el centro, se paga allí directamente, sin comisión.",
    zoneAnswer: "No somos un solo centro. Te reservamos en centros profesionales de todo Madrid (Centro, Salamanca, Chamberí, Retiro, Chamartín, Malasaña y más) y tú eliges la zona que te venga bien.",
  },
};
export const SERVICE_HINTS: Array<[RegExp, string]> = [
  [/deep tissue|descontracturante|deep-tissue|profundo/i, "svc_deep"],
  [/thai|tailand/i, "svc_thai"],
  [/sports?|deportivo/i, "svc_sports"],
  [/hot stone|piedras calientes|piedras/i, "svc_stone"],
  [/balin|balines/i, "svc_bali"],
  [/shiatsu/i, "svc_shiatsu"],
  [/reflexolog|reflexolog[ií]a/i, "svc_reflex"],
  [/lymphatic|linf[aá]tic|drenaje/i, "svc_lymph"],
  [/couples?|pareja|for two|two people/i, "svc_couples"],
  [/kobido|facial/i, "svc_kobido"],
  [/relax|relaxing|relajante|sueco|swedish|stress|estr[eé]s/i, "svc_relax"],
];
export function detectService(t: string): string {
  const s = String(t || "");
  if (!s) return "";
  for (const [re, id] of SERVICE_HINTS) if (re.test(s)) return id;
  return "";
}
export function detectArea(t: string): string {
  const s = stripAcc(String(t || ""));
  if (!s) return "";
  for (const a of AREAS) if (s.includes(stripAcc(a))) return a;
  if (/\bsol\b|gran via|puerta del sol/i.test(s)) return "Centro";
  return "";
}
