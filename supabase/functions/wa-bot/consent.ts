// Marketing consent on WhatsApp (the consent rule in CLAUDE.md, Jordan 19 Nov
// 2026).
//
// Every customer who books is asked, with two equal buttons, whether Massage
// Club may send them offers and reminders to book again. The booking stands
// whatever they answer (LOPDGDD art. 6.3), nothing is pre-selected, no answer
// means no, and promotions go only to a yes (LSSI art. 21.1). A customer who
// asks to stop, in any words we can recognise, is taken off (LSSI art. 22.1:
// "con la simple notificación de su voluntad").
//
// This module holds the words and the pure helpers, so copy.ts (pinned at
// 6715b8a) does not move. bot.ts (the "marketing consent" block) does the
// asking, the saving into public.marketing_optins and the STOP handling.
// No imports, so tests/consent_bot.mjs can load it directly.
//
// The notice is the one fixed for every booking path (website and bot alike):
// it names Massage Club, both channels and how to stop (WhatsApp policy asks
// the opt-in to name the business; LSSI 21.2 asks for a free way to refuse at
// collection). The privacy page is linked next to it (GDPR art. 13).

export type MktLang = "en" | "es";

export const MKT_COPY: Record<MktLang, {
  notice: string; privacy: string; yes: string; no: string;
  savedYes: string; savedNo: string; saveFailed: string;
  stopDone: string; sign: string; emailAsk: string; emailAdded: (addr: string) => string; noEmail: string;
}> = {
  en: {
    notice: "Can Massage Club send you offers and reminders to book again, by email and WhatsApp? You can stop any time with one tap, or by writing to support@massageclub.io.",
    privacy: "Privacy: book.massageclub.io/privacy",
    yes: "Yes, send me offers",
    no: "No thanks",
    savedYes: "Thank you, saved. You can stop any time: write STOP here, or email support@massageclub.io.",
    savedNo: "No problem, saved. We will only write to you about your bookings.",
    saveFailed: "Sorry, your answer did not save. Please tap it again in a minute.",
    // Names everything the yes covered (offers AND reminders, here AND by
    // email), so they know what stopped (GDPR art. 12.1). Jordan approves.
    stopDone: "Done. We will not send you offers or reminders to book again any more, here or by email. Messages about a booking you make still reach you.",
    sign: "Massage Club",
    // After a confirmation, for a customer we have no email for. It replaces
    // copy.ts memberJoin ("Membership is free ... to lock in the rate and send
    // your confirmation"), which promised a membership nothing ever recorded.
    // It promises only what happens: the address goes on the booking
    // (attachEmail), and the bot emails it when WhatsApp cannot reach them.
    emailAsk: "One more thing: what is your email? It is how we reach you about this booking if WhatsApp cannot.",
    emailAdded: (addr: string) => `Got it, thank you. I have added ${addr} to your booking.`,
    noEmail: "No problem, we will leave it without an email. If you need anything about your booking, just write here.",
  },
  es: {
    // "Can Massage Club send you offers and reminders to book again, by email
    // and WhatsApp? You can unsubscribe whenever you want with one tap or by
    // writing to support@massageclub.io."
    notice: "¿Puede Massage Club enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp? Puedes darte de baja cuando quieras con un toque o escribiendo a support@massageclub.io.",
    privacy: "Privacidad: book.massageclub.io/privacy",
    // "Yes, I want offers" / "No, thanks"
    yes: "Sí, quiero ofertas",
    no: "No, gracias",
    // "Thanks, saved. You can unsubscribe whenever you want: write STOP here or
    // write to support@massageclub.io." (STOP, not BAJA: a BAJA from someone
    // whose last booking is over 60 days old is read as a studio answering a
    // postal letter, see handleLetterReply.)
    savedYes: "Gracias, guardado. Puedes darte de baja cuando quieras: escribe STOP aquí o escribe a support@massageclub.io.",
    // "No problem, saved. We will only write to you about your bookings."
    savedNo: "Sin problema, guardado. Solo te escribiremos sobre tus reservas.",
    // "Sorry, your answer was not saved. Tap it again in a minute."
    saveFailed: "Perdona, tu respuesta no se ha guardado. Vuelve a tocarla en un minuto.",
    // "Done. We will no longer send you offers or reminders to book again,
    // neither here nor by email. Messages about a booking you make will keep
    // reaching you."
    stopDone: "Hecho. Ya no te enviaremos ofertas ni recordatorios para volver a reservar, ni por aquí ni por email. Los mensajes sobre una reserva que hagas te seguirán llegando.",
    sign: "Massage Club",
    // "One more thing: what is your email? It is where we let you know about
    // this booking if WhatsApp fails."
    emailAsk: "Una cosa más: ¿cuál es tu email? Es por donde te avisamos de esta reserva si WhatsApp falla.",
    // "Received, thank you. I have added <addr> to your booking."
    emailAdded: (addr: string) => `Recibido, gracias. He añadido ${addr} a tu reserva.`,
    // "No problem, we leave it without an email. If you need anything about
    // your booking, write to me here."
    noEmail: "Sin problema, lo dejamos sin email. Si necesitas algo de tu reserva, escríbeme aquí.",
  },
};

const lg = (l: unknown): MktLang => (l === "es" ? "es" : "en");

// The message body: the notice, then the privacy link.
export function mktAskBody(lang: unknown): string {
  const c = MKT_COPY[lg(lang)];
  return `${c.notice}\n\n${c.privacy}`;
}
// What is saved as "the exact wording shown": the body and both buttons.
export function mktWording(lang: unknown): string {
  const c = MKT_COPY[lg(lang)];
  return `${mktAskBody(lang)}\n[${c.yes}] [${c.no}]`;
}
// Two equal reply buttons. The id carries the answer, the language the
// question was shown in and the request, so a tap can be saved correctly even
// when the session has moved on.
export const MKT_BTN_RE = /^mkt_(yes|no)_(en|es)_(\d+)$/;
export function mktButtons(lang: unknown, requestId: unknown): Array<{ id: string; title: string }> {
  const l = lg(lang);
  const rid = Number.isSafeInteger(Number(requestId)) && Number(requestId) > 0 ? Number(requestId) : 0;
  return [
    { id: `mkt_yes_${l}_${rid}`, title: MKT_COPY[l].yes },
    { id: `mkt_no_${l}_${rid}`, title: MKT_COPY[l].no },
  ];
}
export function mktTap(replyId: unknown): { action: "yes" | "no"; lang: MktLang; requestId: number | null } | null {
  const m = MKT_BTN_RE.exec(String(replyId || ""));
  if (!m) return null;
  const rid = Number(m[3]);
  return { action: m[1] as "yes" | "no", lang: m[2] as MktLang, requestId: rid > 0 ? rid : null };
}

// The STOP reply, signed (customer messages on the bot number are signed
// "Massage Club", never with Jordan's name).
export function stopReply(lang: unknown): string {
  const c = MKT_COPY[lg(lang)];
  return `${c.stopDone}\n\n${c.sign}`;
}

// ---------------------------------------------------------------------------
// A customer saying stop. The law does not let us choose the words a person
// uses to withdraw (LSSI art. 22.1, GDPR art. 7.3), so two tiers:
//   tier 1  the whole message is one of these phrases, give or take
//           punctuation, an emoji, "please" or "thanks" ("STOP", "BAJA",
//           "unsubscribe", "no quiero más ofertas", Meta's "Stop promotions"
//           and "Detener promociones" button texts).
//   tier 2  a short message that pairs a stop or a "don't" with what we send
//           ("No quiero publicidad", "Don't send me offers", "Dejad de
//           enviarme ofertas", "Bórrame de la lista", "No more emails").
// erase: they also asked for their data to be deleted (GDPR art. 17): the
// opt-out is recorded at once and Jordan gets a card to handle the rest.
// Anything else is read by the booking flow as before ("stop, 7pm is better",
// "I want to stop the booking" and "no offers yet?" are not opt-outs).
// lang is the language of the words, or null for a bare "stop" (the
// session's language decides).
// ---------------------------------------------------------------------------
const STOP_ANY = new Set(["stop", "stop it", "stop please"]);
const STOP_EN = new Set([
  "stop offers", "stop the offers", "stop promotions", "stop promos", "stop marketing", "stop ads",
  "stop messages", "stop messaging me", "stop texting me", "stop emailing me", "stop emails", "stop the emails",
  "stop sending offers", "stop sending me offers", "stop sending promotions", "stop sending me promotions",
  "stop sending messages", "stop sending me messages",
  "unsubscribe", "unsubscribe me", "opt out", "optout", "opt me out",
  "no more offers", "no more promotions", "no more promos", "no more messages", "no more emails", "no offers", "no offers please",
  "remove me", "remove me from the list", "remove me from your list", "take me off the list", "take me off your list",
]);
const STOP_ES = new Set([
  "baja", "de baja", "darme de baja", "dame de baja", "darse de baja", "quiero darme de baja", "quiero la baja",
  "no quiero ofertas", "no quiero mas ofertas", "no quiero recibir ofertas", "no quiero recibir mas ofertas",
  "no quiero promociones", "no quiero mas promociones", "no quiero publicidad", "no quiero recibir publicidad",
  "no mas ofertas", "no mas promociones", "basta de ofertas", "sin ofertas", "parar ofertas", "para las ofertas", "parad las ofertas",
  "detener promociones", "detener las promociones", "parar promociones", "parar las promociones",
  "no me mandes mas ofertas", "no me mandeis mas ofertas", "no me envies mas ofertas", "no me envieis mas ofertas",
  "no mas mensajes", "no me escribais mas", "no me escribas mas",
  "cancelar suscripcion", "cancelar la suscripcion", "anular suscripcion",
]);
const POLITE_RE = /^(?:please|pls|por favor|porfa|hola|hi|hello)\s+|\s+(?:please|pls|por favor|porfa|thanks|thank you|thx|gracias|muchas gracias)$/;
// Tier 2, on the normalised text (no accents, lowercase, punctuation gone).
const OBJ_EN = "(?:offers?|promotions?|promos?|marketing|ads|advertising|adverts?|newsletters?|e ?mails?|messages?|texts?|notifications?|spam)";
const OBJ_ES = "(?:publicidad|ofertas?|promociones|promocion|promos?|mensajes?|e ?mails?|correos?|newsletter|boletin(?:es)?|anuncios?|notificaciones|spam|marketing)";
const TIER2_EN = [
  new RegExp(`\\b(?:don t|dont|do not)\\s+(?:want|need|send me|email me|message me|text me)\\s+(?:any\\s+)?(?:more\\s+)?(?:of\\s+)?(?:your\\s+)?${OBJ_EN}\\b`),
  /\b(?:don t|dont|do not)\s+(?:email|message|text|spam|contact)\s+me\b/,
  /\b(?:stop|quit)\s+(?:sending|emailing|messaging|texting|spamming|contacting)\b/,
  new RegExp(`\\bno more\\s+${OBJ_EN}\\b`),
  /\bunsubscribe\b/, /\bopt\s?out\b/, /\bopt me out\b/,
  /\b(?:remove|take|delete)\s+me\s+(?:from|off)\b/,
  /\bcancel\s+(?:my\s+|the\s+)?(?:subscription|newsletter|emails?)\b/,
];
const TIER2_ES = [
  new RegExp(`\\bno\\s+(?:me\\s+|nos\\s+)?(?:mand|envi|escrib)\\w*\\s+(?:mas\\s+)?(?:la\\s+|las\\s+|los\\s+|vuestra\\s+|vuestras\\s+|vuestros\\s+|tu\\s+|tus\\s+)?${OBJ_ES}\\b`),
  new RegExp(`\\bno\\s+(?:quiero|queremos|deseo)\\s+(?:recibir\\s+)?(?:mas\\s+|ningun[ao]?s?\\s+)?${OBJ_ES}\\b`),
  /\b(?:deja|dejad|dejen|deje|dejar|para|parad|paren|pare|parar)\s+de\s+(?:\w+\s+)?(?:mandar|enviar|escribir|molestar|spamear)\w*/,
  new RegExp(`\\b(?:basta de|detener|detened|parar|parad)\\s+(?:las\\s+|los\\s+|la\\s+)?${OBJ_ES}\\b`),
  /\b(?:borr|elimin|quit|sac)\w*\s+(?:me\s+)?de\s+(?:la\s+|vuestra\s+|tu\s+|su\s+)?lista\b/,
  /\bdar(?:me|nos|se)?\s+de\s+baja\b/,
  /\bcancel\w*\s+(?:la\s+|mi\s+)?suscripcion\b/,
];
const ERASE_EN = /\b(?:delete|erase|remove)\s+(?:all\s+)?(?:of\s+)?(?:my|our)\s+(?:personal\s+)?(?:data|details|information|info)\b|\bright to (?:be forgotten|erasure)\b/;
const ERASE_ES = /\b(?:borr|elimin|suprim)\w*\s+(?:todos\s+)?(?:mis|los|nuestros)\s+datos\b|\bderecho\s+(?:al\s+)?olvido\b/;
function normal(text: unknown): string {
  let t = String(text || "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
  t = t.replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  for (let i = 0; i < 3; i++) { const u = t.replace(POLITE_RE, ""); if (u === t) break; t = u; }
  return t;
}
export function stopIntent(text: unknown): { lang: MktLang | null; tier: 1 | 2; erase?: boolean } | null {
  const raw = String(text || "");
  if (!raw.trim() || raw.length > 160) return null;
  const t = normal(raw);
  if (!t) return null;
  if (raw.length <= 80) {
    if (STOP_ANY.has(t)) return { lang: null, tier: 1 };
    if (STOP_EN.has(t)) return { lang: "en", tier: 1 };
    if (STOP_ES.has(t)) return { lang: "es", tier: 1 };
  }
  const eraseEn = ERASE_EN.test(t), eraseEs = ERASE_ES.test(t);
  if (eraseEs) return { lang: "es", tier: 2, erase: true };
  if (eraseEn) return { lang: "en", tier: 2, erase: true };
  if (TIER2_ES.some((re) => re.test(t))) return { lang: "es", tier: 2 };
  if (TIER2_EN.some((re) => re.test(t))) return { lang: "en", tier: 2 };
  return null;
}

// A typed answer to the offers question ("yes", "si", "no thanks"): not saved
// (a tap is the proof), but the same two buttons are sent once more, the way
// a typed "yes" to a studio offer re-sends its buttons.
const BARE = new Set(["yes", "yes please", "yep", "yeah", "sure", "si", "si por favor", "claro", "no", "no thanks", "no thank you", "nope", "no gracias"]);
export function bareAnswer(text: unknown): boolean {
  const raw = String(text || "");
  return raw.length <= 30 && BARE.has(normal(raw));
}
