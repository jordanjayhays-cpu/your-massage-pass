// Marketing consent on WhatsApp (the Kelly rule, Jordan 19 Nov 2026).
//
// Every customer who books is asked, once, with two equal buttons, whether
// Massage Club may send them offers and reminders to book again. The booking
// stands whatever they answer (LOPDGDD art. 6.3), nothing is pre-selected, no
// answer means no, and promotions go only to a yes (LSSI art. 21.1). A
// customer who writes STOP at any time is taken off, and told so once.
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
    stopDone: "Done. You won't get offers from us any more. Messages about your bookings still come.",
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
    // "Done. We will no longer send you offers. Messages about your bookings
    // will keep arriving."
    stopDone: "Hecho. Ya no te enviaremos ofertas. Los mensajes sobre tus reservas seguirán llegando.",
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
// A customer saying stop: the whole message is one of these phrases, give or
// take punctuation, an emoji, "please" or "thanks". Anything longer is read by
// the booking flow as before ("stop, 7pm is better" is not an opt-out).
// Returns the language the words are in, or null for a bare "stop" (the
// session's language decides).
// ---------------------------------------------------------------------------
const STOP_ANY = new Set(["stop", "stop it", "stop please"]);
const STOP_EN = new Set([
  "stop offers", "stop the offers", "stop promotions", "stop promos", "stop marketing", "stop ads",
  "stop messages", "stop messaging me", "stop texting me",
  "stop sending offers", "stop sending me offers", "stop sending promotions", "stop sending me promotions",
  "stop sending messages", "stop sending me messages",
  "unsubscribe", "unsubscribe me", "opt out", "optout", "opt me out",
  "no more offers", "no more promotions", "no more promos", "no more messages", "no offers", "no offers please",
  "remove me", "remove me from the list", "remove me from your list", "take me off the list", "take me off your list",
]);
const STOP_ES = new Set([
  "baja", "de baja", "darme de baja", "dame de baja", "darse de baja", "quiero darme de baja", "quiero la baja",
  "no quiero ofertas", "no quiero mas ofertas", "no quiero recibir ofertas", "no quiero recibir mas ofertas",
  "no mas ofertas", "basta de ofertas", "sin ofertas", "parar ofertas", "para las ofertas", "parad las ofertas",
  "no me mandes mas ofertas", "no me mandeis mas ofertas", "no me envies mas ofertas", "no me envieis mas ofertas",
  "no mas mensajes", "no me escribais mas", "no me escribas mas",
  "cancelar suscripcion", "cancelar la suscripcion", "anular suscripcion",
]);
const POLITE_RE = /^(?:please|pls|por favor|porfa|hola|hi|hello)\s+|\s+(?:please|pls|por favor|porfa|thanks|thank you|thx|gracias|muchas gracias)$/;
export function stopIntent(text: unknown): { lang: MktLang | null } | null {
  const raw = String(text || "");
  if (!raw.trim() || raw.length > 80) return null;
  let t = raw.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
  t = t.replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  for (let i = 0; i < 3; i++) { const u = t.replace(POLITE_RE, ""); if (u === t) break; t = u; }
  if (!t) return null;
  if (STOP_ANY.has(t)) return { lang: null };
  if (STOP_EN.has(t)) return { lang: "en" };
  if (STOP_ES.has(t)) return { lang: "es" };
  return null;
}
