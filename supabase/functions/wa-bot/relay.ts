// Relay (24 Nov 2026, Jordan: "i shouldn't have to report everything from my
// convos, this should be rare not expectations"). When a studio or a customer
// still answers on Jordan's own phone (827, or his US number), he forwards the
// message to the bot number and taps who wrote it. The bot saves it in that
// person's chat (msg_type 'external'), reads it with the same parsers as the
// live handlers, and shows him what it read and what a tap would record.
//
// This file is pure: no imports, no fetch, no clock. The parsers come in as
// arguments (P), the same pattern as letters_reply.ts and consent.ts, so
// tests/relay.mjs runs it with the real copy.ts parsers.
//
// It records, with one exception. Jordan, 24 Nov (pop-up "Yes, my tap =
// studio's tap"): his tap on "Record yes" counts as the studio's tap under
// BOTH PARTIES TAP, so the customer then gets the normal offer, by the same
// path ops studio_offer uses (the ask recorded as accepted with the hour and
// price, then forwardOffer). The customer still has to tap Yes themselves
// before anything is booked, and the studio gets the confirmation in writing
// only after that tap. The card shows the exact words before the tap
// (relayYesPreview). forwardOffer can write to a studio itself: when this
// offer replaces a live one outside the hours asked ("Better news"), the
// replaced studio gets a note not to hold its slot (the card shows it), and
// an offer that waits behind another or is held for 15 minutes is shown
// later by the bot's normal steps, which then send the studio that wrote the
// yes the bot's usual note, inside its hours. Nothing else here or in the
// bot's relay block sends anything to a studio or a customer: no price ask,
// no stand-down, no other note.
// A forwarded message is Jordan's report of someone's words: a customer's
// relayed "yes" never confirms a booking or their attendance, and a discount
// counts only from one forwarded text message in the studio's own writing
// (CLAUDE.md, discounts).

export type RelayMode = "off" | "test" | "on";
// app_secrets RELAY: off (the default; anything missing, blank or unknown),
// test (the whole relay runs, but only test studios and test customers get
// anything recorded) or on.
export function parseRelayMode(v: unknown): RelayMode {
  const x = String(v ?? "").trim().toLowerCase();
  return x === "on" || x === "test" ? x : "off";
}
// Jordan's own numbers: 827 (his WhatsApp Business app) and his US number.
export const JORDAN_OWN = ["34612474827", "15622355063"];
const digits = (x: unknown) => String(x ?? "").replace(/\D/g, "");

// A forward carries context.forwarded (forwarded 5 times or fewer) or
// context.frequently_forwarded. context.id on its own is a quoted reply, which
// is never a relay.
export function detectRelay(msg: any, from: unknown, own: string[] = JORDAN_OWN): { forwarded: boolean; jordan: boolean; relay: boolean } {
  const c = msg && typeof msg === "object" && msg.context && typeof msg.context === "object" ? msg.context : null;
  const forwarded = !!c && (c.forwarded === true || c.frequently_forwarded === true);
  const jordan = own.includes(digits(from));
  return { forwarded, jordan, relay: forwarded && jordan };
}

// ---- ids ----
// List rows and buttons carry their whole meaning, so no state is stored
// between the list and the tap:
//   rly_s_<anchor>_<dispatch uuid>   a studio's ask row
//   rly_c_<anchor>_<request id>      a customer's request
//   rly_x_<anchor>                   someone else (a contact card or a number)
//   rly_m_<anchor>                   my own words
//   rly_i_<anchor>                   ignore (delete the text)
//   rly_a_<action>_<anchor>_<s|c>.<target>_<hash8>   an action on the card
// The anchor is the wa_messages id of the last relayed row of the burst. Every
// id ends with _<sig>, an HMAC the bot checks (the webhook itself carries no
// proof that it came from Meta), so an id cannot be guessed or edited.
export type RelayKind = "s" | "c" | "x" | "m" | "i" | "a";
export type RelayId = { kind: RelayKind; anchor: number; target: string; tkind: "" | "s" | "c"; action: string; hash: string; sig: string; base: string };
export const RELAY_ACTIONS = ["yes", "price", "rate", "no", "gender", "hours", "hoursx", "stop", "answered", "freeze", "optout", "mute", "undo"];
export function relayBase(kind: RelayKind, anchor: number | string, target = "", action = "", hash = "", tkind: "" | "s" | "c" = ""): string {
  const a = String(anchor);
  if (kind === "s" || kind === "c") return `rly_${kind}_${a}_${target}`;
  if (kind === "a") return `rly_a_${action}_${a}_${tkind}.${target}_${hash}`;
  return `rly_${kind}_${a}`;
}
const UUIDISH = "[0-9a-fA-F-]{8,40}";
export function relayParse(id: unknown): RelayId | null {
  const s = String(id ?? "");
  let m = s.match(new RegExp(`^(rly_(s)_(\\d{1,15})_(${UUIDISH}))_([0-9a-f]{16})$`));
  if (m) return { kind: "s", anchor: Number(m[3]), target: m[4], tkind: "", action: "", hash: "", sig: m[5], base: m[1] };
  m = s.match(/^(rly_(c)_(\d{1,15})_(\d{1,12}))_([0-9a-f]{16})$/);
  if (m) return { kind: "c", anchor: Number(m[3]), target: m[4], tkind: "", action: "", hash: "", sig: m[5], base: m[1] };
  m = s.match(/^(rly_([xmi])_(\d{1,15}))_([0-9a-f]{16})$/);
  if (m) return { kind: m[2] as RelayKind, anchor: Number(m[3]), target: "", tkind: "", action: "", hash: "", sig: m[4], base: m[1] };
  m = s.match(new RegExp(`^(rly_a_([a-z]{2,10})_(\\d{1,15})_([sc])\\.(${UUIDISH}|\\d{1,12})_([0-9a-f]{8}))_([0-9a-f]{16})$`));
  if (m && RELAY_ACTIONS.includes(m[2])) return { kind: "a", anchor: Number(m[3]), target: m[5], tkind: m[4] as "s" | "c", action: m[2], hash: m[6], sig: m[7], base: m[1] };
  return null;
}

// ---- who wrote it: candidates and ranking ----
export type RelayCand = {
  kind: "studio" | "customer";
  key: string;            // dispatch row id (studio) or request id (customer)
  requestId: number;
  name: string;           // studio business name, or the customer's first name
  customerName?: string;  // for a studio row: whose request
  phone: string;          // digits of the number we reach them on
  test: boolean;          // a test studio or a test customer
  askTime?: string;       // the hour every studio was asked (exactTime)
  offeredTime?: string;
  outcome?: string;
  answered?: boolean;     // the studio's replied_at is set
  chasedAtMs?: number | null;
  liveOffer?: { studio: string; time: string } | null;
  windowOpen?: boolean;
  lastPickMs?: number | null;
  atMs: number;           // when it last moved: the ask, or the request
  dayShort?: string;      // "Thu 26"
  stageWords?: string;    // a customer row's status in a few words
  sentHm?: string;        // "14:05", when the ask went
};
export type RelayParsers = {
  parseOfferedTime: (t: string) => string;
  parseQuotedPrice: (t: string) => number | null;
  strongSpanish: (t: string) => boolean;
};
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const GENERIC_NAME = new Set(["masaje", "masajes", "centro", "studio", "estudio", "madrid", "massage", "massages", "club", "spa", "wellness", "salud", "terapia", "therapy", "beauty", "belleza", "the", "and"]);
function nameTokens(name: string, min: number): string[] {
  return norm(name).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= min && !GENERIC_NAME.has(w));
}
const STUDIO_WORDS_RE = /(^|[^a-zñáéíóúü])(hueco|tenemos|podemos|cliente|disponible|libre|os esperamos|le esperamos)(?![a-zñáéíóúü])/i;
const YESNO_RE = /^\s*[¡¿]?\s*(yes|yeah|yep|ok|okay|sure|si|sí|vale|perfecto|perfect|great|no|nope|book it|claro)\b/i;
const CUSTOMER_EN_RE = /\b(i|i'm|im|my|me|book|booking|massage)\b/i;
export function relayRank(text: string, cands: RelayCand[], nowMs: number, P: RelayParsers): Array<RelayCand & { score: number }> {
  const t = String(text || "");
  const nt = ` ${norm(t).replace(/[^a-z0-9ñ]+/g, " ")} `;
  const time = P.parseOfferedTime(t);
  const price = P.parseQuotedPrice(t);
  const spanish = P.strongSpanish(t);
  const out = cands.map((c) => {
    let score = 0;
    const toks = c.kind === "studio" ? nameTokens(c.name, 4) : nameTokens(String(c.name || "").split(/\s+/)[0] || "", 3);
    if (toks.some((w) => nt.includes(` ${w} `))) score += 50;
    if (time && (time === c.askTime || time === c.offeredTime)) score += 30;
    if (c.kind === "studio") {
      if (!c.answered && (c.outcome === "pending" || !c.outcome)) score += 25;
      if (c.chasedAtMs && nowMs - c.chasedAtMs < 6 * 3600e3) score += 10;
      if (STUDIO_WORDS_RE.test(t) || spanish) score += 20;
      if (price !== null) score += 15;
    } else {
      if (c.liveOffer && YESNO_RE.test(t)) score += 25;
      if (c.windowOpen === false) score += 15;
      if (!spanish && CUSTOMER_EN_RE.test(t)) score += 20;
    }
    if (c.lastPickMs && nowMs - c.lastPickMs < 2 * 3600e3) score += 20;
    const h = Math.max(0, (nowMs - c.atMs) / 3600e3);
    score += 15 * Math.exp(-h / 24);
    return { ...c, score: Math.round(score * 100) / 100 };
  });
  return out.sort((a, b) => b.score - a.score || b.atMs - a.atMs);
}
// 7 people, then Someone else, Me (my own words) and Ignore: the 10 rows a
// WhatsApp list allows. Titles 24 characters, descriptions 72; the name is cut,
// never the "(studio)" or "(customer)" after it.
export const RELAY_MAX_CANDS = 7;
const cut = (s: string, n: number) => (s.length <= n ? s : s.slice(0, Math.max(1, n - 1)).trimEnd() + ".");
export function relayRowText(c: RelayCand, mode: RelayMode): { title: string; description: string } {
  const suffix = c.kind === "studio" ? " (studio)" : " (customer)";
  const title = cut(String(c.name || (c.kind === "studio" ? "A studio" : "A customer")).trim(), 24 - suffix.length) + suffix;
  const last4 = c.phone ? `...${c.phone.slice(-4)}` : "";
  const parts: string[] = [];
  if (mode === "test" && c.test) parts.push("(test)");
  if (c.kind === "studio") {
    parts.push(`#${c.requestId}${c.customerName ? " " + c.customerName : ""}`);
    const when = [c.dayShort, c.askTime].filter(Boolean).join(" ");
    if (when) parts.push(when);
    parts.push(c.outcome === "declined" ? "said no" : c.outcome === "expired" ? "lapsed" : c.outcome === "won" ? "booked" : c.answered ? "answered" : `asked${c.sentHm ? " " + c.sentHm : ""}, no answer`);
  } else {
    parts.push(`#${c.requestId}`);
    if (c.liveOffer) parts.push(`${c.liveOffer.studio} ${c.liveOffer.time} offer waiting`);
    else if (c.stageWords) parts.push(c.stageWords);
  }
  if (last4) parts.push(last4);
  return { title, description: cut(parts.join(" · "), 72) };
}
export function relayListBody(o: { n: number; quote: string; en: string; enFailed?: boolean; mode: RelayMode; ref: number; none?: boolean; extra?: string }): string {
  const q = cut(String(o.quote || "").replace(/\s+/g, " ").trim(), 200);
  const en = o.en ? `\n(EN: "${cut(o.en.replace(/\s+/g, " ").trim(), 300)}")` : o.enFailed ? "\n(English not available: the translation failed.)" : "";
  const head = o.n > 1 ? `Who wrote these ${o.n} messages?` : "Who wrote this?";
  const test = o.mode === "test" ? "\nTEST MODE: only test studios and test customers get anything recorded." : "";
  const none = o.none ? "\nNobody with an open request in the last 3 days matches, so the list only has the fixed rows." : "";
  const extra = o.extra ? `\n${o.extra}` : "";
  return `${head} "${q}"${en}\n\nPick them and I will save it in their chat and show you what I read. Picking sends nothing to anyone.${test}${none}${extra}\nRef R${o.ref}`;
}

// ---- what a studio's words say ----
// The live handler's own parsers, in the live handler's order
// (handleStudioReply, bot.ts): an away message is nothing; the hours they
// open are never a time; a time different from the ask is their own time; a
// bare yes is the "Sí, tenemos hueco" button at the hour asked; a price and a
// written discount are captured alongside; a therapist answer when the request
// wants a man or a woman.
export type StudioParsers = RelayParsers & {
  parseDiscount: (t: string) => number | null;
  studioGenderReply: (t: string, wanted: "male" | "female") => boolean | null;
  BARE_YES_RE: RegExp;
  AUTOREPLY_RE: RegExp;
  HOURS_STATEMENT_RE: RegExp;
  plainStudioAck: (t: string) => boolean;
  studioSaysArrived: (t: string) => boolean;
  stopIntent: (t: string) => unknown;
  bajaIntent: (t: string) => boolean;
};
export type StudioFacts = {
  askTime: string;                 // exactTime(req), "" when the request has no exact hour
  wantGender: "" | "male" | "female";
  confirmedHere: boolean;          // the request is confirmed with this studio
  confirmedTime: string;
  started: boolean;                // the confirmed booking has started
  outcome: string;                 // the dispatch row's outcome
  source: "text" | "voice";       // any voice note in the batch makes it voice
  single: boolean;                 // one forwarded text message
  echo: boolean;                   // the batch had our own lines (left out)
  hoursOnFile: string;             // partners.opening_hours as text, "" when empty
  open: boolean;                   // the request is still open
};
// pctSeen is the percentage parseDiscount found, pct only one that counts as
// given; pctWhy says why one seen was not taken: "relay" (not one forwarded
// text message in their own writing), "refused" (their words say no to it) or
// "unclear" (their words do not clearly give it); pctReason is the reason in
// a few English words (relayDiscountRead), for Jordan.
export type StudioPlan = { kinds: string[]; time: string; price: number | null; pct: number | null; pctBlocked: boolean; pctSeen: number | null; pctWhy: "" | "relay" | "refused" | "unclear"; pctReason: string; gender: boolean | null; hours: string; hoursRaw: boolean };
// ---- a written percentage: given, refused or unclear ----
// Review of ef19cdd (major; CLAUDE.md discounts: never quote one to a customer
// before the studio has confirmed it in writing). parseDiscount finds a
// percentage anywhere in the words, so "Sí, a las 18:00, 50€. El 10% no lo
// hacemos." (EN: "Yes, at 18:00, 50 EUR. We don't do the 10%.") read as a 10%
// Massage Club rate, and Record yes would have printed it on the customer's
// offer.
// 24 Nov (Jordan's rule, made strict): it errs to "unclear". A missed real
// discount costs a little; a false one breaks the rule. Unclear means no
// discount_pct, no mc_discount_pct, no award on it, and Jordan is shown the
// percentage seen and why (relayDiscountNote).
// 24 Nov, after the adversary round (tests/relay.mjs group 16): a word list
// always misses a word. "Os hacemos el 10%. Uy perdona, me he equivocado de
// chat" (EN: "We give you 10%. Oops sorry, I got the wrong chat"), "Igual os
// podemos hacer el 10%" (EN: "Maybe we can give you 10%"), "Son 50€ y le
// aplicamos el 21% de IVA" (EN: "It's 50 EUR and we apply 21% VAT") and "Le
// hacemos el 10% la sig vez" (EN: "We give her 10% next time") were all given.
// So given now also needs every other word of the message to be one this
// reading knows is harmless (point 6), and an hour in it to be the hour asked
// (point 7). The word lists stay, to name the reason for Jordan.
//   1. The words that only look like a no come out first: "no hay problema"
//      (EN: "no problem"), "sin problema" (EN: "no problem"), "no hay
//      inconveniente" (EN: "no trouble"), "no pasa nada" (EN: "it's fine"),
//      "cómo no" (EN: "of course"), "no hay de qué" (EN: "you're welcome"),
//      "no problem", "no worries", "don't worry", "why not". "Por supuesto"
//      (EN: "of course"), "claro que sí" (EN: "of course") and "sí que sí" (EN:
//      "yes, yes") read as a plain yes. Words that are neither a yes nor a no
//      are set aside: an apology for the wait ("perdona la tardanza" (EN:
//      "sorry for the delay")), "no hay parking" (EN: "there is no parking"),
//      "no hay que pagar señal" (EN: "no deposit to pay"), "masaje completo"
//      (EN: "full-body massage"), "solo esta vez" (EN: "only this time").
//   2. Every sentence is read. A no in a sentence before the percentage
//      makes it unclear ("No tenemos hueco. Os hacemos el 10%." (EN: "We have
//      no slot. We give you 10%.") has no booking to discount).
//   3. A negation anywhere from the sentence that holds the percentage to the
//      end (no, nop, sin, ni, tampoco, tp, nada, ningún, imposible, nunca,
//      not, can't, without, never) makes it not given, whatever "pero",
//      "but", "y", "and", "aunque" or "though" stands between them. It is
//      "refused" when the negation is in the same clause as the percentage,
//      or comes after it with no hour or day word in its clause ("Os hacemos
//      el 10%. Bueno no, perdona, no podemos." (EN: "We give you 10%. Well no,
//      sorry, we can't.")); otherwise "unclear" ("Os hacemos el 10%, pero no a
//      las 18" (EN: "We give you 10%, but not at 18")).
//   4. Unclear, each with its reason: a correction, a joke or a retraction
//      ("perdona" (EN: "sorry"), "me equivoqué" (EN: "I made a mistake"), "es
//      broma" (EN: "just kidding"), "tarifa normal" (EN: "normal rate")); a
//      tax, deposit, surcharge, commission or tip ("IVA" (EN: "VAT"), "señal"
//      (EN: "deposit"), "recargo" (EN: "surcharge"), "comisión" (EN:
//      "commission"), "un 10% más" (EN: "10% more")); something else
//      ("productos" (EN: "products"), "tarjeta regalo" (EN: "gift card"), "el
//      de 90" (EN: "the 90-minute one"), "su amiga" (EN: "her friend")); a
//      deferral or a date ("la próxima vez" (EN: "next time"), "la sig vez"
//      (EN: "next time"), "el mes que viene" (EN: "next month"), "en enero"
//      (EN: "in January"), "desde el lunes" (EN: "from Monday"), "en la 2da"
//      (EN: "at the 2nd")); members, regulars or a pack; habit ("normalmente"
//      (EN: "usually")); a hedge ("igual" (EN: "maybe"), "creo" (EN: "I
//      think"), "en principio" (EN: "in principle"), would, could, probably);
//      a condition ("si nos deja una reseña" (EN: "if they leave us a
//      review"), "en efectivo" (EN: "in cash"), "los martes" (EN: "on
//      Tuesdays"), "por la mañana" (EN: "in the morning"), "a estudiantes" (EN:
//      "to students"), only, until, as long as); someone else still to agree
//      or a check first ("lo consulto" (EN: "I'll check"), "tengo que
//      preguntar a mi jefa" (EN: "I have to ask my boss"), "pendiente de
//      confirmar" (EN: "pending confirmation"), "te aviso" (EN: "I'll let you
//      know")); an apology ("lo siento" (EN: "sorry")); a limit ("no más" (EN:
//      "no more"), "no acumulable" (EN: "cannot be combined")); a question
//      about it; two different percentages.
//   5. Given needs a phrase that gives it for THIS booking: "os/le/te hacemos
//      el 10%" (EN: "we give you 10%"), "le dejamos un 10%" (EN: "we leave you
//      10%"), "le aplicamos el 10%" (EN: "we apply 10% for you"), "le podemos
//      hacer un 10%" (EN: "we can give you 10%"), "el 10% se lo hacemos" (EN:
//      "the 10%, we do it for you"), "con el 10% queda en 45€" (EN: "with the
//      10% it comes to 45 EUR"), "45€ con el 10%" (EN: "45 EUR with the
//      10%"), "sí al 10%" (EN: "yes to the 10%"), "sí, el 10%" (EN: "yes, the
//      10%"), "el 10% sin problema" (EN: "the 10%, no problem"), "aceptamos el
//      10%" (EN: "we accept the 10%"), "we can do 10%", "we'll give you 10%",
//      "with the 10% it is 45", "yes to the 10%", "10% is fine". A percentage
//      on its own ("un 10% de descuento" (EN: "a 10% discount"), "10% off")
//      is unclear: it does not say they give it, and the ask itself names the
//      10%. So is a verb with no "os", "le" or "te" and no yes in front of it
//      ("Aplicamos el 10%" (EN: "We apply 10%") can be their general policy).
//   6. And nothing else in the message but harmless words: a yes, a greeting
//      or thanks, a price, the hour asked, "tenemos hueco" (EN: "we have a
//      slot"), "os esperamos" (EN: "we expect you"), "de descuento" (EN:
//      "off"), "para Massage Club" (EN: "for Massage Club"), articles,
//      pronouns and the booking's own nouns (masaje, sesión, cita (EN:
//      massage, session, appointment)). Any other word (a date, a length, a
//      product, a person, a correction, a hedge, a typo of any of them) makes
//      it unclear.
//   7. An hour in the message that is not the hour asked makes it unclear.
//      The live path offers the customer the asked hour (awardWinner), so
//      "No podemos a las 18. A las 19 sí, y os hacemos el 10%" (EN: "We can't
//      at 18. At 19 yes, and we give you 10%") would have offered the 18:00
//      they declined, at 10%. With no hour asked, any hour makes it unclear.
export type DiscountStance = "given" | "refused" | "unclear";
export type DiscountRead = { stance: DiscountStance; why: string; pct: number | null };
const PCT_WORDS = "cinco|diez|quince|veinte|veinticinco|treinta";
// The percentage itself, written so it cannot be anything else.
const PCT_ANCHOR_RE = new RegExp(`(\\d{1,2})\\s*(?:%|\\/(?!\\s*\\d)|por\\s*ciento|porciento|percent)|(?:^|[^a-z])(${PCT_WORDS})\\s*(?:%|por\\s*ciento|porciento|de\\s+(?:descuento|dto))|(?:descuento|dto)\\s+(?:del?|de\\s+un)\\s+(\\d{1,2}|${PCT_WORDS})(?![0-9a-z])`, "g");
const PCT_WORD_N: Record<string, number> = { cinco: 5, diez: 10, quince: 15, veinte: 20, veinticinco: 25, treinta: 30 };
const FIG = `(?:\\d{1,2}\\s*(?:%|\\/(?!\\s*\\d)|por\\s*ciento|porciento|percent)|(?:${PCT_WORDS})\\s*(?:%|por\\s*ciento|porciento|percent))`;
// A clause about the discount ("a las diez" (EN: "at ten") is not one).
const PCT_MARK_RE = new RegExp(`\\d{1,2}\\s*(?:%|\\/(?!\\s*\\d)|por\\s*ciento|porciento|percent)|(?:^|[^a-z])(?:descuento|descuentos|dto|desc|discount|discounts|rebaja|rate)(?![a-z])|(?:^|[^a-z])(?:${PCT_WORDS})\\s*(?:%|por\\s*ciento|porciento|de\\s+(?:descuento|dto))`);
// The text as these rules read it: an accented "sí" (yes) is kept apart from
// "si" (if) as "si_", then accents go, then the words that are neither a yes
// nor a no become "=", the words that only look like a no "~" and "of
// course" a yes. A laughing or winking face is read as "jaja" (a joke), a
// cross, a no-entry sign or a thumbs down as "no", a thinking face or a shrug
// as "quizás" (EN: "maybe"); any other emoji but a friendly few is a word
// this reading does not know (point 6).
// An apology for the wait, and one for not seeing the message: about the
// delay, not the discount or the slot.
const DELAY_SORRY = "(?:(?:lo |le |te |os )?siento|lo sentimos|sentimos|perdon|perdona|perdone|perdonad|perdonen|disculpa|disculpe|disculpad|disculpen|disculpas|mil disculpas|sorry|so sorry|apologies)(?: mucho| muchisimo| so much)?\\s*,?\\s*(?:(?:por|for|x)\\s+)?(?:(?:el|la|the|my|our|mi|nuestra|nuestro|this|tanta)\\s+)?(?:retraso|tardanza|espera|demora|delay|late (?:reply|answer|response)|wait|waiting|delayed (?:reply|answer|response)|slow (?:reply|answer|response)|tardar(?: tanto)?|haber tardado|contestar tarde|responder tarde|no (?:contestar|responder|haber contestado|haber respondido) antes)";
const SEEN_SORRY = "(?:lo siento|sorry|perdon|perdona|disculpa|disculpad|disculpe)\\s*,?\\s*(?:no (?:vi|habia visto|he visto|lei|habia leido) (?:el|tu|vuestro|su) mensaje(?: antes| hasta ahora)?|i (?:didn't|didnt|did not) see (?:the|your) message(?: earlier| before)?)";
const NEUTRAL_RE = new RegExp(`(^|[^a-z0-9_'])(buenos dias|buenas tardes|buenas noches|buenas|no hay (?:parking|aparcamiento|ascensor)(?: cerca)?|no tenemos (?:datafono|tpv|parking|aparcamiento|ascensor)|no hay que (?:pagar|traer|llevar|abonar)(?: (?:nada|senal|ninguna senal|por adelantado))*|no hace falta (?:que |q )?(?:traiga|traigan|traigais|traer|llevar)(?: nada)?|no (?:tardeis|tardes|tarden|llegueis tarde|lleguen tarde|llegues tarde)|no (?:dudeis|dudes|dude|duden) en (?:escribirnos|contactarnos|llamarnos|preguntar|preguntarnos|escribir)|don'?t hesitate to (?:contact|write to|call|ask|message) us|(?:masaje|cuerpo|tratamiento) completo|casi (?:complet|llen)[oa]s?|imposible (?:antes|mas temprano|mas pronto)(?=\s*(?:[,.!;)]|$))|(?:xo |pero )?(?:solo|solamente) (?:por )?esta vez|just this once|only this time|${DELAY_SORRY}|${SEEN_SORRY})(?![a-z0-9'])`, "g");
const NOT_A_NO_RE = /(^|[^a-z0-9_'])(no hay (?:ningun )?(?:problema+s?|pb|prob|probl|problem|problemo|inconvenientes?|fallo|drama|lio)|no es (?:ningun )?(?:problema|molestia)|no tenemos (?:ningun )?(?:problemas?|inconvenientes?)|sin (?:ningun (?:tipo de )?)?(?:problema+s?|inconvenientes?)(?: ningun[oa]?)?|ningun (?:problema|inconveniente)|no pasa nada|no problem(?:o|s)?|not a problem|no probs?|no worries|no te preocupes|no os preocupeis|no se preocupe|no se preocupen|don'?t worry|no stress|no doubt|why not|no faltaria mas|no faltaba mas|como no(?=\s*(?:[,.!;)]|$))|no hay de que|nada que agradecer|de nada|sin compromiso)(?![a-z0-9'])/g;
const OF_COURSE_RE = /(^|[^a-z0-9_'])(por supuesto|claro (?:que|q) si_?|si_? (?:que|q) si_?|of course)(?![a-z0-9'])/g;
const JOKE_FACE_RE = /[\u{1F602}\u{1F923}\u{1F605}\u{1F606}\u{1F61C}\u{1F61D}\u{1F61B}\u{1F643}\u{1F60F}\u{1F609}\u{1F92A}\u{1F92D}]/gu;
const NO_FACE_RE = /[\u{274C}\u{274E}\u{2716}\u{1F6AB}\u{26D4}\u{1F44E}\u{1F645}]/gu;
const HEDGE_FACE_RE = /[\u{1F914}\u{1F937}\u{1F62C}\u{1F644}\u{1F928}\u{1F615}\u{1F61F}\u{1F610}\u{1F611}]/gu;
// The friendly few (thumbs up, OK hand, smiles, thanks, a tick, hearts, a
// wave, a massage), with their modifiers.
const SAFE_EMOJI = new Set([..."\u{1F44D}\u{1F44C}\u{1F642}\u{1F60A}\u{1F600}\u{1F603}\u{1F604}\u{1F601}\u{1F64F}\u{2705}\u{1F4AA}\u{2764}\u{2665}\u{1F338}\u{2728}\u{1F44B}\u{1F917}\u{1F60D}\u{1F970}\u{1F486}\u{1F33F}\u{263A}\u{1F49A}\u{1F499}\u{1F49C}\u{1F9E1}\u{1F49B}\u{1F64C}\u{1F44F}\u{1F389}\u{1F60C}\u{2640}\u{2642}"]);
function stanceText(text: string): string {
  const s = String(text || "").replace(/[’‘`´]/g, "'").replace(JOKE_FACE_RE, " jaja ").replace(NO_FACE_RE, " no ").replace(HEDGE_FACE_RE, " quizas ").replace(/(^|[^A-Za-zÀ-ÿ])[sS][íÍ](?![A-Za-zÀ-ÿ])/g, "$1si_ ");
  return norm(s).replace(/(^|[^a-z])como mucho(?![a-z])/g, "$1como maximo").replace(NEUTRAL_RE, "$1 = ").replace(NOT_A_NO_RE, "$1 ~ ").replace(OF_COURSE_RE, "$1 si_ ");
}
// Sentences: a full stop that is not inside a number ("18.15", "76.50").
const sentencesOf = (t: string) => t.split(/(?<=[!?;\n])|(?<=\.)(?!\d)/).map((s) => s.trim()).filter(Boolean);
// Clauses, only to tell "refused" from "unclear": a comma not inside a number,
// brackets, a colon not inside an hour, and the joining words.
const CLAUSE_SPLIT_RE = /,(?!\d)|\(|\)|:(?!\d)|(?:^|\s)(?:pero|xo|but|y|and|aunque|though|although|sino|however|sin embargo)(?=\s|$)/;
const PCT_NO_RE = /(^|[^a-z0-9'_])(no+|nop|nope|nah|nanai|sin|ni|nada|ningun|ninguno|ninguna|tampoco|tampco|tampoc[a-z]*|tp|imposible|nunca|jamas|demasiado|mucho|ni hablar|para nada|not|without|cannot|can't|cant|couldn't|couldnt|don't|dont|doesn't|doesnt|didn't|didnt|won't|wont|isn't|isnt|aren't|arent|wasn't|wasnt|unable|impossible|never|nothing|none|neither|nor|too much|too high|no longer|no way)(?![a-z0-9'])/;
const PCT_SORRY_RE = /(^|[^a-z_])(lo siento|lo sentimos|siento|sentimos|lamentablemente|desgraciadamente|por desgracia|me temo|nos tememos|sorry|unfortunately|i'm afraid|im afraid|we're afraid)(?![a-z])/;
// A no that sets a ceiling ("no más" (EN: "no more")) is not a no to it.
const PCT_LIMIT_RE = /(^|[^a-z])(no mas|nada mas|ni uno mas|no more|not more|nothing more|maximo|como maximo|at most|tope|no acumulable|no combinable|not combinable|cannot be combined)(?![a-z])/;
// An hour or a day in a clause with a no after the percentage: the no may be
// about the hour, not the discount, so it is unclear, not refused.
const PCT_TIME_RE = /\d{1,2}[:.h]\d{2}|\d{1,2}\s*h(?![a-z])|(^|[^a-z])(a las|las \d|hueco|huecos|hora|horas|horario|cita|citas|turno|tarde|tardes|noche|manana|mananas|hoy|dia|dias|semana|finde|fin de semana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|slot|slots|time|times|hour|hours|today|tonight|tomorrow|morning|afternoon|evening|day|at \d)(?![a-z])/;
// Point 4, each kind with its reason for Jordan.
const PCT_RETRACT_RE = /(^|[^a-z_])(perdona|perdon|perdone|perdonad|perdonen|disculpa|disculpe|disculpad|me equivoque|me he equivocado|equivocad[oa]s?|equivocacion|me lie|me he liado|me lio|rectifico|rectificamos|rectificacion|corrijo|correccion|queria decir|quise decir|queriamos decir|olvida|olvidalo|olvidad|olvidadlo|olvide|anulo|anulamos|lo retiro|retiro lo|es broma|era broma|de broma|broma|jaja[a-z]*|jeje[a-z]*|jiji[a-z]*|haha[a-z]*|hehe[a-z]*|lol|just kidding|kidding|joking|jk|wrong chat|wrong person|wrong number|i meant|my mistake|mistake|scratch that|ignore that|correction|al final|tarifa normal|precio normal|normal price|normal rate|full price|precio completo|tarifa completa|era antes|era una promo|se acabo|se termino|ya termino|termino|terminado|terminada|acabado|acabada|caducad[oa]s?|expirad[oa]s?|expired|ended|is over|era para otr[oa]|otra clienta|otro cliente|espera|wait|hold on|dice mi|me dice|me dicen|me comenta)(?![a-z])/;
const PCT_NOT_DISC_RE = new RegExp(`(^|[^a-z_])(iva|i\\.v\\.a|vat|tax|taxes|impuestos?|senal|deposit|deposito|fianza|adelantado|anticipo|prepago|prepay|prepayment|upfront|in advance|comision|comisiones|commission|commissions|recargos?|suplementos?|surcharges?|supplements?|propinas?|tips?|gratuity|aparte|a parte|on top|encima|cobramos|cobrar|cobra|charge|charged|extras?|plus)(?![a-z])|${FIG}\\s+(?:mas|more|extra)(?![a-z])`);
const PCT_OTHER_RE = /(^|[^a-z0-9_])(productos?|products?|tarjetas? regalo|gift ?cards?|gift vouchers?|vouchers?|bonos? regalo|cheques? regalo|aceites?|cremas?|oils?|creams?|cosmetica|cosmetics|depilacion|waxing|tailandes|thai|facial(?:es)?|manicura|pedicura|tratamientos?|treatments?|otros? servicios?|other services?|amig[oa]s?|friends?|acompanante|parejas?|couples?|duo|dos personas|\d+ personas|two people|\d+ people|siendo (?:dos|tres|\d+)|por persona|per person|persona|\d{2,3}\s*-?\s*(?:min|mins|minutos|minute|minutes)|el de \d{2,3})(?![a-z0-9])/;
const PCT_OTHER_HOUR_RE = /(^|[^a-z_])(otra hora|otro momento|other time|another hour|different time)(?![a-z])/;
const PCT_LATER_RE = /(^|[^a-z0-9_])(prox[a-z]*|prosim[a-z]*|sig|sigte|sgte|siguientes?|pa la otra|la otra|en otra|otra ocasion|otras ocasiones|otra vez|otra visita|otra reserva|otra cita|otro dia|otros dias|a la vuelta|vuelta|(?:que|q) viene|mas adelante|en adelante|futur[oa]s?|cuando|en cuanto|una vez|segund[oa]s?|a partir|desde|dsd|tras|despues|luego|(?<!la |de )manana|mes|meses|ano|anos|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|navidad(?:es)?|reyes|semana santa|verano|invierno|primavera|otono|temporada|black friday|cyber monday|20\d\d|\d+(?:ª|º|a|o|er|era|da|do|ra|ro|nd|rd|th|st)|next|future|later|another time|another day|another visit|second|returning|repeat|from now on|from|starting|as of|once|when|whenever|after|afterwards|tomorrow|month|months|year|years|january|february|march|april|june|july|august|september|october|november|december|christmas|season)(?![a-z0-9])/;
const PCT_MEMBERS_RE = /(^|[^a-z_])(socios?|socias?|miembros?|membresia|abonad[oa]s?|abonos?|bonos?|packs?|paquetes?|tarjeta de cliente|fidelidad|habituales|vip|regulars|members?|membership|loyalty|card holders?)(?![a-z])/;
const PCT_HABIT_RE = /(^|[^a-z_])(normalmente|habitualmente|generalmente|por lo general|en general|solemos|soleis|suele|suelen|a veces|siempre|como siempre|usually|normally|generally|typically|sometimes|always)(?![a-z])/;
const PCT_HEDGE_RE = /(^|[^a-z_])(depende|dependiendo|quizas?|kizas?|kiza|tal vez|a lo mejor|igual|lo mismo|puede que|puede|posiblemente|probablemente|seguramente|creo|creemos|supongo|suponemos|imagino|en principio|en teoria|teoricamente|ya veremos|veremos|a ver|no se|no estoy segur[oa]|intentaremos|intentamos|intentare|hariamos|haria|harian|podriamos|podria|podrian|dejariamos|dejaria|aplicariamos|aplicaria|dariamos|daria|pondriamos|ofreceriamos|maybe|perhaps|might|could|would|should|depends|depending|i think|we think|i guess|i suppose|i believe|probably|possibly|hopefully|likely|in principle|in theory|theoretically|we'll see|we will see|let's see|lets see|not sure)(?![a-z])/;
// A condition. "si" with no accent and a word after it is "if" ("si nos deja
// una reseña" (EN: "if they leave us a review")), unless the word is a yes
// ("si claro" (EN: "yes, of course")) or "al" ("si al 10%" (EN: "yes to the
// 10%")); a "sí" with its accent is read as yes (stanceText). Time windows,
// days, payment, groups and reviews are conditions too: "entre semana" (EN:
// "on weekdays"), "el martes" (EN: "on Tuesday"), "por la mañana" (EN: "in
// the morning"), "hasta las 16" (EN: "until 16"), "con bizum" (EN: "by
// Bizum"), "a estudiantes" (EN: "to students"), "con una reseña" (EN: "with a
// review"), "en la 2ª sesión" (EN: "at the second session").
const PCT_IF_RE = /(^|[^a-z0-9_])(si (?!(?:claro|vale|perfecto|perfecta|ok|okay|genial|de acuerdo|si_?|al)(?![a-z]))[a-z]+|\d+\s*(?:ª|º|a|o|er|era)\s+(?:sesion|sesiones|visita|visitas|reserva|reservas|vez|cita|citas|session|visit|booking)|solo (?:los|las|entre|para|pa|con|si|en|de|el|la|a|por|cuando|hoy|manana|este|esta|fines|festivos|primera|primer|lunes|martes|miercoles|jueves|viernes|sabado|domingo|clientes|clientas|socios|estudiantes|residentes)|solamente|unicamente|exclusivamente|excepto|salvo|menos|para (?:grupos|estudiantes|residentes|jubilados|parejas|empresas|ninos|menores|mayores|sesiones|masajes|dos|tres|\d+)|pa (?:grupos|estudiantes|residentes|jubilados|parejas|empresas|dos|\d+)|en grupo|entre semana|fines? de semana|finde|laborables|festivos?|(?:de|d) (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo) a|lunes|martes|miercoles|jueves|viernes|sabados?|domingos?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|(?:lun|mar|mie|jue|vie|sab|dom|mon|tue|wed|thu|fri|sat|sun)\s*-\s*(?:lun|mar|mie|jue|vie|sab|dom|mon|tue|wed|thu|fri|sat|sun)|por las? (?:mananas?|tardes?|noches?)|de (?:manana|tarde|noche)|mananas|tardes|noches|en horario|horario de|hora valle|horas valle|hasta|antes de|despues de|temporada (?:baja|alta)|low season|high season|siempre (?:que|q|y cuando)|con tal (?:de|que|q)|en caso de|a condicion|condicion|condiciones|como minimo|minimo|al menos|mas de \d+|pagando|pago|pagan|paguen|efectivo|metalico|bizum|tarjeta|transferencia|paypal|reservando|reserven|reserva anticipada|con antelacion|antelacion|repitiendo|registrad[oa]s|estudiantes?|universitari[oa]s|carnet|residentes|empadronad[oa]s|jubilad[oa]s|pensionistas|cupon(?:es)?|codigo|resenas?|estrellas|google|tripadvisor|instagram|a cambio|sujet[oa] a|if|only(?! (?:do|give|offer)(?![a-z]))|unless|except|for groups|for (?:students|couples|seniors|locals|residents|members|groups|bookings|sessions|\d+)|students?|residents?|locals|seniors|coupons?|code|reviews?|stars|provided|providing|so long as|as long as|assuming|on condition|conditions?|subject to|at least|minimum|over \d+|more than \d+|above \d+|cash|card payment|paying|pay|weekdays?|weekends?|mornings?|afternoons?|evenings?|nights?|in the (?:morning|afternoon|evening)|at night|until|till|before|after|happy hour|off-peak|off peak|in exchange|exchange|advance booking|book early|early booking)(?![a-z0-9])/;
const PCT_PENDING_RE = /(^|[^a-z])(lo consulto|consult[a-z]*|lo pregunto|pregunt[a-z]*|lo miro|lo miramos|lo mirare|lo mire|mirarlo|mirar|miro|lo vemos|lo veo|lo hablo|lo hablamos|habl[a-z]*|confirm[a-z]*|te digo|os digo|le digo|t digo|te dire|os dire|le dire|te aviso|os aviso|le aviso|t aviso|aviso|avisamos|avisare|compruebo|comprob[a-z]*|pendiente[a-z]*|a falta de|aprueb[a-z]*|aprob[a-z]*|autori[a-z]*|decid[a-z]*|decide|llamame|llamadme|llameme|llamanos|jefa|jefe|jefes|encargad[oa]s?|duen[oa]s?|gerente|responsable|propietari[oa]s?|let me check|i'll check|ill check|we'll check|will check|check with|double check|checking|get back|let you know|ask the|ask my|let me ask|i'll ask|will ask|pending|approval|approve|tbc|call me|give me a call|manager|boss|owner|last word)(?![a-z])/;
const PCT_UNCLEAR: Array<[RegExp, string]> = [
  [PCT_RETRACT_RE, "they take it back, correct it, joke about it or say it was for someone else"],
  [PCT_NOT_DISC_RE, "the percentage is a tax, a deposit, a surcharge, a commission or a tip, not a discount"],
  [PCT_OTHER_RE, "it is for something else: products, a gift card, another service, another length or other people"],
  [PCT_OTHER_HOUR_RE, "they turn down the hour asked"],
  [PCT_PENDING_RE, "they say they will check first, or someone else still has to agree"],
  [PCT_LATER_RE, "it is put off to another visit or a later date, not given for this booking"],
  [PCT_MEMBERS_RE, "it is for members, regulars or a pack, not said for this booking"],
  [PCT_HABIT_RE, "it is what they usually do, not a written offer for this booking"],
  [PCT_HEDGE_RE, "it is only a maybe (would, could, perhaps, I think, it depends)"],
  [PCT_IF_RE, "it comes with a condition"],
  [PCT_SORRY_RE, "an apology (\"lo siento\" (EN: \"sorry\")) is in the message"],
  [PCT_LIMIT_RE, "a limit or a small-print note comes with it"],
];
// Point 7: the hours written in the message, as HH:MM. A clock time, "a las
// 18" (EN: "at 18"), "at 18" or "18h"; never a price ("12.50€").
const HOUR_RE = /(?<![0-9:.,a-z])([01]?\d|2[0-3])\s*(?:[:.]|h)\s*([0-5]\d)(?![0-9])(?!\s*(?:€|eur|euros|e(?![a-z])))(?:\s*(?:h|hs|hrs|horas)(?![a-z]))?|(?<![a-z])(?:a las|a la|las|at|sobre las|hacia las|para las)\s+([01]?\d|2[0-3])(?![0-9]|[:.,]\d)(?!\s*(?:€|eur|euros|e(?![a-z])|%|\/|min|minutos|minutes|mins|personas|people|sesiones|sessions))\s*(?:h|hs|hrs|horas)?(?![a-z])|(?<![0-9:.,a-z])([01]?\d|2[0-3])\s*(?:h|hs|hrs|horas)(?![a-z0-9])/g;
const hhmm = (h: string, m = "00") => `${String(Number(h)).padStart(2, "0")}:${m}`;
// The phrases that give it for this booking (point 5), each tied to the
// percentage itself.
const TARGET_ES = `(?:(?:el|un|una|del|de un|al)\\s+)?(?:(?:descuento|dto\\.?|desc\\.?|rebaja)\\s+(?:del?\\s+|de\\s+un\\s+)?)?${FIG}`;
const TARGET_EN = `(?:(?:the|a|an)\\s+)?(?:discount\\s+of\\s+)?${FIG}`;
const GIVE_V = "hacemos|hago|haremos|hare|dejamos|dejo|dejaremos|dejare|aplicamos|aplico|aplicaremos|aplicare|ofrecemos|ofrezco|ofreceremos|damos|doy|daremos|ponemos|pongo|pondremos|respetamos|respeto|mantenemos|mantengo|incluimos|incluyo|descontamos|descuento|rebajamos|rebajo";
const YES_W = "si_|si|vale|ok|okay|okey|perfecto|perfecta|de acuerdo|claro|genial|hecho|yes|yep|yeah|sure|perfect|great";
const PRICE = `\\d{1,3}(?:[.,]\\d{1,2})?\\s*(?:€|e|eur|euros)(?![a-z])`;
const PCT_GIVE_RES: RegExp[] = [
  // os hacemos el 10%, le dejamos un 10%, te podemos hacer un descuento del 10%
  new RegExp(`(?:^|[^a-z])(?:os|le|les|te|se lo|se la)\\s+(?:${GIVE_V}|podemos\\s+(?:hacer|dejar|aplicar|ofrecer|dar|poner|mantener|respetar)|puedo\\s+(?:hacer|dejar|aplicar|ofrecer|dar|poner))\\s+(?:(?:ya|encantados|encantadas|con gusto|gustosamente|tambien|tb|tmb|igualmente|~)\\s+)?${TARGET_ES}`),
  // podemos hacerle un 15%, vamos a dejaros el 10%
  new RegExp(`(?:^|[^a-z])(?:podemos|puedo|vamos a|voy a)\\s+(?:hacer|dejar|aplicar|ofrecer|dar|poner)(?:le|les|os|te)(?:lo|la)?\\s+${TARGET_ES}`),
  // el 10% se lo hacemos, el 10% os lo aplicamos, el 10% lo hacemos encantados
  new RegExp(`${FIG}(?:\\s+de\\s+(?:descuento|dto))?\\s+(?:(?:se|os|te|le|les)\\s+)?(?:lo|la|os|le|te|les)\\s+(?:${GIVE_V})(?![a-z])`),
  // con el 10% queda en 45€, con el 10% son 45, con el 10% de descuento, 45€
  new RegExp(`(?:^|[^a-z])con\\s+(?:el|un|una)\\s+(?:(?:descuento|dto\\.?|rebaja)\\s+(?:del?\\s+|de\\s+un\\s+)?)?${FIG}(?:\\s+de\\s+(?:descuento|dto))?(?:\\s+(?:ya\\s+)?(?:aplicado|incluido|descontado))?\\s*,?\\s*(?:(?:se|te|le|os|les)\\s+)?(?:queda|quedan|quedaria|quedarian|sale|salen|saldria|saldrian|seria|serian|son|es|sera|seran|total|precio|cuesta|cuestan|\\d)`),
  // 45€ con el 10%, 45€, con un 10% de descuento
  new RegExp(`${PRICE}\\s*,?\\s*\\(?\\s*con\\s+(?:el|un|una)\\s+(?:(?:descuento|dto\\.?|rebaja)\\s+(?:del?\\s+|de\\s+un\\s+)?)?${FIG}`),
  // sí al 10%, sí, el 10%, sí, un descuento del 10%, vale, el 10%, sí! el 10%
  new RegExp(`(?:^|[^a-z])(?:si_\\s*[,!:.]*\\s*|(?:${YES_W})\\s*[,!:.]+\\s*|(?:si|ok|okay|vale)\\s+(?=al\\s))(?:(?:al|el|un|una|con el|con un|con una|a un)\\s+)?(?:(?:descuento|dto\\.?|rebaja)\\s+(?:del?\\s+|de\\s+un\\s+)?)?${FIG}`),
  // el 10%, vale. / el 10% sí (only at the end of a clause: "el 10% si
  // puede" is "if they can"); el 10% sin problema
  new RegExp(`${FIG}(?:\\s+de\\s+(?:descuento|dto))?\\s*[,!:]?\\s*(?:${YES_W}|~)(?=\\s*(?:[,.!;)]|$))`),
  // sí, aplicamos el 10% (a verb with no pronoun counts after a yes)
  new RegExp(`(?:^|[^a-z])(?:si_|(?:${YES_W})\\s*[,!:])\\s*(?:${GIVE_V})\\s+${TARGET_ES}`),
  // incluido el 10%, 10% incluido, ya incluye el descuento del 10%
  new RegExp(`(?:^|[^a-z])(?:incluido|incluida|incluye|incluyendo|aplicado|aplicada|descontado|descontada)\\s+(?:ya\\s+)?(?:el|un|del)\\s+(?:(?:descuento|dto)\\s+(?:del?\\s+)?)?${FIG}`),
  new RegExp(`${FIG}(?:\\s+de\\s+(?:descuento|dto))?\\s+(?:ya\\s+)?(?:incluido|incluida|aplicado|aplicada|descontado|descontada)(?![a-z])`),
  // ningún problema con el 10%, aceptamos el 10%, nos parece bien el 10%,
  // de acuerdo con el 10%, te lo dejo en un 10%, solo podemos hacer el 10%,
  // hacemos el 10% a la clienta, ok 10%
  new RegExp(`~\\s*,?\\s*con\\s+(?:el|un|una)\\s+${FIG}`),
  new RegExp(`(?:^|[^a-z])(?:aceptamos|acepto)\\s+(?:el|un)\\s+${FIG}`),
  new RegExp(`(?:^|[^a-z])(?:nos|me)\\s+parece\\s+(?:bien|perfecto|genial|correcto)\\s+(?:el|un)\\s+${FIG}`),
  new RegExp(`(?:^|[^a-z])de acuerdo con\\s+(?:el|un)\\s+${FIG}`),
  new RegExp(`(?:^|[^a-z])(?:te|os|le|les|se)\\s+lo\\s+(?:dejo|dejamos)\\s+(?:en|a)\\s+${TARGET_ES}`),
  new RegExp(`(?:^|[^a-z])solo\\s+(?:(?:os|le|te)\\s+)?(?:podemos|puedo)\\s+(?:hacer|dejar|aplicar|ofrecer|dar)(?:os|le|les|te)?\\s+${TARGET_ES}`),
  new RegExp(`(?:^|[^a-z])(?:hacemos|aplicamos|dejamos)\\s+${TARGET_ES}\\s+(?:a la clienta|al cliente|a la cliente|a tu clienta|a tu cliente|a vuestra clienta|a vuestro cliente)(?![a-z])`),
  new RegExp(`(?:^|[^a-z])(?:ok|okay|vale|yes|sure|perfecto|perfect|claro)\\s+(?:(?:al|el|un|the|a)\\s+)?${FIG}`),
  // we can do 10%, we'll give you 10% off, I can give you a 10% discount, we
  // can only do 10%
  new RegExp(`(?:^|[^a-z])(?:we|i)\\s*(?:'ll|ll|will|can|are happy to|'re happy to|re happy to|am happy to|'m happy to|m happy to|are glad to|'re glad to|re glad to)\\s+(?:only\\s+)?(?:do|give|offer|apply|include|honou?r|leave)\\s+(?:(?:you|them|her|him|the client|the customer|your client|your customer)\\s+)?${TARGET_EN}`),
  // happy to do 10%
  new RegExp(`(?:^|[^a-z])(?:happy|glad) to (?:do|give|offer|apply)\\s+(?:(?:you|them|her|him|the client|the customer)\\s+)?${TARGET_EN}`),
  // we give you 10%; yes, we do 10%
  new RegExp(`(?:^|[^a-z])(?:we|i)\\s+(?:give|offer|apply|do)\\s+(?:you|them|her|him|the client|the customer|your client|your customer)\\s+${TARGET_EN}`),
  new RegExp(`(?:^|[^a-z])yes\\s*[,!.]*\\s*we\\s+do\\s+${TARGET_EN}`),
  // with the 10% it is 45, with the 10% discount that's 45
  new RegExp(`(?:^|[^a-z])with\\s+(?:the|a|an|your)\\s+(?:discount\\s+of\\s+)?${FIG}(?:\\s+discount)?(?:\\s+(?:applied|included|off))?\\s*,?\\s*(?:it(?:'s|s| is| comes to)?|that(?:'s|s| is| comes to)|the total|total|comes to|=|the price is|price|\\d)`),
  // 45 EUR with the 10%
  new RegExp(`${PRICE}\\s*,?\\s*with\\s+(?:the|a|an|your)\\s+${FIG}`),
  // yes to the 10%, yes, with the 10% discount
  new RegExp(`(?:^|[^a-z])yes(?![a-z])[^a-z0-9]*(?:(?:to|with|for)\\s+)?(?:(?:the|a|an)\\s+)?(?:discount\\s+of\\s+)?${FIG}`),
  // including the 10%, 10% included, 10% is fine
  new RegExp(`(?:^|[^a-z])(?:including|includes|included)\\s+(?:the|a|an|your)\\s+${FIG}`),
  new RegExp(`${FIG}\\s+(?:discount\\s+)?(?:off\\s+)?(?:already\\s+)?(?:included|applied)(?![a-z])`),
  new RegExp(`${FIG}\\s+(?:is fine|is ok|is okay|is good|is perfect|works|esta bien|nos va bien|nos parece bien)(?![a-z])`),
];
const PCT_GIVE_G = PCT_GIVE_RES.map((re) => new RegExp(re.source, "g"));
// Point 6: what may stand beside the giving words. The phrases first, then
// single words; anything left over makes it unclear.
const RES_PRICE_RE = new RegExp(`(?<![a-z0-9_'])(?:(?:(?:se|te|os|le|les)\\s+)?(?:(?:lo|la)\\s+)?(?:queda|quedan|quedaria|quedarian|sale|salen|saldria|saldrian|seria|serian|son|es|sera|seran|total|cuesta|cuestan|dejamos|dejo|it is|it's|its|that's|thats|that is|comes to|total is)\\s*:?\\s*)?(?:(?:en|a)\\s+)?${PRICE}`, "g");
const RES_SAFE_RE = /(?<![a-z0-9_'])(?:muchas gracias|mil gracias|thank you(?: very much| so much)?|un saludo|un abrazo|best regards|kind regards|good morning|good afternoon|good evening|(?:os|le|la|les|te|los|las) esperamos|we'll see you|we will see you|see you(?: then| there| soon)?|nos vemos|tenemos hueco|hay hueco|tenemos sitio|we have (?:a |the )?(?:slot|space|room|availability)|de descuento|de dto|para (?:massage club|mc|vosotros|vosotras|ti|usted|ella|la clienta|el cliente|tu clienta|tu cliente|vuestra clienta|vuestro cliente|vuestros clientes|vuestras clientas|(?:los |las |todos los |todas las )?(?:clientes|clientas) de (?:massage club|mc))|for (?:you|them|her|him|the client|your client|the customer|your customer|massage club|mc|(?:all )?(?:the )?(?:massage club|mc) (?:clients|customers)|your clients|your customers)|massage club|yes we can)(?![a-z0-9_'])/g;
const RES_OK = new Set(("si si_ yes yeah yep yup ok okay okey oki vale perfecto perfecta perfect claro genial hecho sure great "
  + "encantados encantadas encantado encantada gustosamente hola holaa holaaa holi hi hello hey gracias thanks saludos regards "
  + "y e and tambien igualmente tb tmb too also ya "
  + "descuento dto desc rebaja discount off incluido incluida aplicado aplicada descontado descontada included applied "
  + "el la los las un una al del de a en para con the an of to for with on "
  + "os le les te se lo nos you we i them her him us your su tu vuestra vuestro vuestros vuestras vosotros vosotras ella ti usted "
  + "cliente clienta clientes clientas client clients customer customers massage club mc masaje sesion reserva cita session booking appointment "
  + "tenemos hueco podemos puedo disponible available libre").split(" "));
function residualWords(t: string): string[] {
  const blank = new Array(t.length).fill(false);
  const mark = (re: RegExp) => { for (const m of t.matchAll(re)) for (let i = m.index ?? 0; i < (m.index ?? 0) + m[0].length; i++) blank[i] = true; };
  for (const re of PCT_GIVE_G) mark(re);
  mark(HOUR_RE);
  mark(RES_PRICE_RE);
  mark(RES_SAFE_RE);
  const left = Array.from({ length: t.length }, (_, i) => (blank[i] ? " " : t[i])).join("");
  const odd = [...left.matchAll(/\p{Extended_Pictographic}/gu)].map((m) => m[0]).filter((e) => !SAFE_EMOJI.has(e));
  return [...left.split(/[^a-z0-9_']+/).map((w) => w.replace(/^'+|'+$/g, "")).filter((w) => w && !RES_OK.has(w)), ...odd];
}
export function relayDiscountRead(text: string, askTime = ""): DiscountRead {
  const t = stanceText(text);
  const figs = new Set<number>();
  for (const m of t.matchAll(PCT_ANCHOR_RE)) {
    const n = m[1] ? Number(m[1]) : m[2] ? PCT_WORD_N[m[2]] : /^\d+$/.test(m[3] || "") ? Number(m[3]) : PCT_WORD_N[m[3] || ""];
    if (n) figs.add(n);
  }
  const pct = figs.size === 1 ? [...figs][0] : null;
  const sents = sentencesOf(t);
  const first = sents.findIndex((s) => PCT_MARK_RE.test(s));
  if (first < 0) return { stance: "unclear", why: "it is not written as a discount", pct };
  let refused = "", unclear = "", seenMark = false;
  // A no to the booking itself anywhere ("Completo." (EN: "Full."), "No
  // tenemos hueco." (EN: "We have no slot.")): there is no booking to discount.
  if (NO_RE.test(t)) unclear = "they also say they cannot take the booking (no slot, full, cannot)";
  for (const [re, why] of PCT_UNCLEAR) if (!unclear && re.test(t)) unclear = why;
  sents.forEach((s, i) => {
    if (PCT_MARK_RE.test(s) && /[?¿]/.test(s)) unclear ||= "it is a question";
    // Point 2: a no before the sentence that holds the percentage.
    if (i < first) { if (PCT_NO_RE.test(s)) unclear ||= "a no comes before it, in an earlier sentence"; return; }
    for (const c of s.split(CLAUSE_SPLIT_RE)) {
      if (!c) continue;
      const cm = PCT_MARK_RE.test(c);
      if (PCT_NO_RE.test(c)) {
        if (cm) refused ||= "a no is next to it";
        else if (seenMark && !PCT_TIME_RE.test(c) && !PCT_LIMIT_RE.test(c)) refused ||= "a no comes after it";
        else unclear ||= !seenMark ? "a no comes before it in the same sentence" : PCT_LIMIT_RE.test(c) ? "a limit or a small-print note comes after it" : "a no about an hour or a day comes after it";
      }
      if (cm) seenMark = true;
    }
  });
  if (refused) return { stance: "refused", why: refused, pct };
  if (!figs.size) unclear ||= "no percentage is written as one";
  if (figs.size > 1) unclear ||= "two different percentages";
  // Point 7: every hour written is the hour asked.
  const am = String(askTime || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  const ask = am ? hhmm(am[1], am[2]) : "";
  const other = [...t.matchAll(HOUR_RE)].map((m) => (m[1] ? hhmm(m[1], m[2]) : hhmm(m[3] || m[4]))).find((h) => h !== ask);
  if (other) unclear ||= ask ? `it is written beside another hour (${other}), not the ${ask} asked, and an offer goes at the hour asked` : `it is written beside an hour (${other}), and the request has no hour to check it against`;
  if (unclear) return { stance: "unclear", why: unclear, pct };
  if (!PCT_GIVE_RES.some((re) => re.test(t))) return { stance: "unclear", why: "no words say they give it for this booking", pct };
  // Point 6: nothing else in the message but harmless words.
  if (residualWords(t).length) return { stance: "unclear", why: "other words come with it that I cannot be sure of (a date, a condition, a correction, a hedge or another service may be among them)", pct };
  return { stance: "given", why: "", pct };
}
export function relayDiscountStance(text: string, askTime = ""): DiscountStance {
  return relayDiscountRead(text, askTime).stance;
}
// What Jordan is told when a studio's percentage was seen and not taken, on
// the live path (bot.ts handleStudioReply) as on the relay card.
export function relayDiscountNote(seen: number, r: { stance: string; why?: string }): string {
  const why = r.why ? ` (${r.why})` : "";
  return r.stance === "refused"
    ? `They wrote ${seen}% but their words turn it down${why}, so it was not taken: no discount on any offer, no Massage Club rate saved for the studio, and nothing awarded on it.`
    : `They wrote ${seen}% but their words do not clearly give it for this booking${why}, so it was not taken: no discount on any offer, no Massage Club rate saved for the studio, and nothing awarded on it. It counts only when they write that they give it, such as "os hacemos el 10%" (EN: "we give you 10%"); ask them as the bot if it matters.`;
}
// "No hay problema" (EN: "no problem") is not a no. "Lo siento" and "sorry"
// are a no only when the same sentence has no hour or availability word:
// "Tenemos hueco a las 18:00, lo siento por la tardanza" (EN: "We have a slot
// at 18:00, sorry for the delay") is a yes. An apology for the wait, or a
// bare "Sorry!" in its own sentence, is a no only when nothing in the
// message says yes: "Sorry for the late reply. Yes, 18:00 works" is a yes,
// "Lo siento por la espera" (EN: "Sorry for the wait") on its own is a no.
const NO_RE = /(^|[^a-zñáéíóúü])(no (podemos|puedo|tenemos|hay|nos (da|va|viene))|imposible|complet[oa]s?|llen[oa]s?|ocupad[oa]s?|no disponible|sin hueco|no queda|no nos queda|we are full|we're full|fully booked|booked up|no availability|not available|no slots?)(?![a-zñáéíóúü])/i;
const NO_SORRY_RE = /(^|[^a-z_])(lo siento|lo sentimos|sorry)(?![a-z])/;
const NO_AVAIL_RE = /\d{1,2}[:.h]\d{2}|(^|[^a-z_])(hueco|huecos|hora|horas|tenemos|a las|puedo|podemos|slot|slots|at|disponible|libre)(?![a-z])/;
const STUDIO_YES_RE = /(^|[^a-z_])(si_|yes|yeah|yep|vale|claro|perfecto|perfecta|ok|okay|sure|de acuerdo|genial|podemos|tenemos hueco|hay hueco|we can|works|os esperamos|le esperamos|la esperamos)(?![a-z'])/;
const DELAY_SORRY_RE = new RegExp(`(^|[^a-z_])(?:${DELAY_SORRY}|${SEEN_SORRY})(?![a-z])`);
const BARE_SORRY_RE = /^[^a-z0-9]*(?:sorry|lo siento|lo sentimos|perdon|perdona|perdone|disculpa|disculpe|disculpad)[^a-z0-9]*$/;
export function relayStudioNo(text: string): boolean {
  const t = stanceText(text);
  if (NO_RE.test(t)) return true;
  const yes = STUDIO_YES_RE.test(t);
  if (!yes && DELAY_SORRY_RE.test(norm(String(text || "").replace(/[’‘`´]/g, "'")))) return true;
  return sentencesOf(t).some((s) => NO_SORRY_RE.test(s) && !NO_AVAIL_RE.test(s) && !(yes && BARE_SORRY_RE.test(s)));
}
const OTHER_RE = /(^|[^a-zñáéíóúü])(otra hora|otro d[ií]a|otro momento|m[aá]s tarde|m[aá]s temprano)(?![a-zñáéíóúü])/i;
const YES_OPEN_RE = /^\s*[¡]?\s*(s[ií]|claro|perfecto|perfecta|vale|ok|okay|de acuerdo|genial)(?![a-zñáéíóúü])/i;
const AVAIL_RE = /(^|[^a-zñáéíóúü])(hueco|podemos|puedo|tenemos|disponible|libre|os esperamos|le esperamos|la esperamos|sin problema)(?![a-zñáéíóúü])/i;
export function studioRelayPlan(text: string, f: StudioFacts, P: StudioParsers): StudioPlan {
  const t = String(text || "").trim();
  const plan: StudioPlan = { kinds: [], time: "", price: null, pct: null, pctBlocked: false, pctSeen: null, pctWhy: "", pctReason: "", gender: null, hours: "", hoursRaw: false };
  if (!t) { plan.kinds.push("unclear"); return plan; }
  if (P.bajaIntent(t) || P.stopIntent(t)) { plan.kinds.push("stop"); return plan; }
  if (P.AUTOREPLY_RE.test(t)) { plan.kinds.push("away"); return plan; }
  if (P.HOURS_STATEMENT_RE.test(t)) {
    plan.kinds.push("hours");
    plan.hours = relayHoursText(t);
    plan.hoursRaw = !plan.hours;
  }
  const time = P.parseOfferedTime(t);
  const price = P.parseQuotedPrice(t);
  const pct = P.parseDiscount(t);
  const no = relayStudioNo(t);
  if (f.confirmedHere) {
    if (f.started && P.studioSaysArrived(t)) plan.kinds.push("arrived");
    else if (!f.started && time && time !== f.confirmedTime) { plan.kinds.push("time_change"); plan.time = time; }
    else if (no) plan.kinds.push("no_confirmed");
  } else {
    if (time && time !== f.askTime) { plan.kinds.push("time"); plan.time = time; }
    else if (no) plan.kinds.push("no");
    else if (time === f.askTime && time) { plan.kinds.push("yes_ask"); plan.time = time; }
    else if (P.BARE_YES_RE.test(t) || (YES_OPEN_RE.test(t) && AVAIL_RE.test(t))) { plan.kinds.push("yes_ask"); plan.time = f.askTime; }
    else if (OTHER_RE.test(t)) plan.kinds.push("other");
    if (price !== null && !plan.kinds.includes("no")) { plan.kinds.push("price"); plan.price = price; }
    if (pct !== null) {
      // A discount counts only when their words give it for this booking
      // (relayDiscountRead: "El 10% no lo hacemos" (EN: "We don't do the
      // 10%") is a no, "un 10% de descuento" (EN: "a 10% discount") on its
      // own is unclear), at the figure parseDiscount found, and only in the
      // studio's own writing: one forwarded text message, with none of our
      // own lines in the batch. Anything else is shown, never recorded. An
      // hour in the words other than the one asked makes it unclear, as on
      // the live path (relayDiscountRead point 7).
      plan.pctSeen = pct;
      const read = relayDiscountRead(t, f.askTime);
      const stance: DiscountStance = read.stance === "given" && read.pct !== pct ? "unclear" : read.stance;
      if (stance !== "given") { plan.pctBlocked = true; plan.pctWhy = stance; plan.pctReason = read.stance === "given" ? "the percentage read is not the one written" : read.why; }
      else if (f.source === "text" && f.single && !f.echo) { plan.kinds.push("discount"); plan.pct = pct; }
      else { plan.pctBlocked = true; plan.pctWhy = "relay"; }
    }
  }
  if (f.wantGender) {
    const g = P.studioGenderReply(t, f.wantGender);
    if (g !== null) { plan.kinds.push("gender"); plan.gender = g; }
  }
  if (!plan.kinds.length) plan.kinds.push(P.plainStudioAck(t) ? "ack" : "unclear");
  return plan;
}
// What a tap can record, in order, at most two plus "Not theirs".
// A voice note is not the studio's writing, so it records no yes, time,
// price, discount or therapist answer; only a no, the hours, an opt-out or
// "they answered" (which stops the 3-hour chase).
export function studioActions(p: StudioPlan, f: StudioFacts): string[] {
  const acts: string[] = [];
  const text = f.source === "text";
  const k = (x: string) => p.kinds.includes(x);
  if (k("stop")) acts.push("stop");
  else if (!f.confirmedHere && f.open) {
    if ((k("yes_ask") || k("time")) && text && p.time) acts.push("yes");
    else if (k("no") && f.outcome !== "won") acts.push("no");
    else if (k("price") && text) acts.push("price");
    else if (k("discount") && text) acts.push("rate");
    else if (k("gender") && text) acts.push("gender");
  }
  if (k("hours") && p.hours) {
    if (!f.hoursOnFile) acts.push("hours");
    else if (f.hoursOnFile.trim() !== p.hours) acts.push("hoursx");
  }
  const recorded = acts.some((a) => ["yes", "no", "price", "rate", "gender"].includes(a));
  if (!recorded && !k("away") && !k("stop") && !f.confirmedHere && f.open && f.outcome !== "won") acts.push("answered");
  return [...acts.slice(0, 2), "undo"];
}
// The writes a studio action makes, so the card, its hash and the tap all see
// the same thing. stamped is the text as stored: marked as relayed, with any
// relative day word replaced by the request's own date (relayStoredText).
export function studioWrites(action: string, p: StudioPlan, f: StudioFacts & { acceptedAt?: string | null }, nowIso: string, stamped: string, raw: string): { dispatch?: Record<string, unknown>; partner?: Record<string, unknown> } | null {
  const answered = { replied_at: nowIso, reply_text: stamped.slice(0, 500) };
  const gender = p.gender !== null && f.source === "text" ? { therapist_gender_ok: p.gender, therapist_gender_note: raw.slice(0, 300) } : {};
  const price = p.price !== null && f.source === "text" ? { quoted_price: p.price } : {};
  // Only a rate studioRelayPlan read as given (kind "discount"): a refused
  // or unclear percentage is never written (review of ef19cdd, major).
  const rate = p.pct !== null && p.kinds.includes("discount") && !p.pctBlocked && f.source === "text" && f.single && !f.echo ? { discount_pct: p.pct, offer_note: raw.slice(0, 200) } : {};
  const accept = f.outcome === "won" ? {} : { outcome: "accepted", accepted_at: f.acceptedAt || nowIso };
  if (action === "yes") return p.time ? { dispatch: { ...accept, ...answered, offered_time: p.time, offered_times: [p.time], ...price, ...rate, ...gender } } : null;
  if (action === "price") return p.price !== null ? { dispatch: { ...answered, ...price, ...gender } } : null;
  // Review M3: a rate on its own is not a yes to an hour, so the ask stays
  // open (no outcome accepted). An accepted row with no hour would set off
  // dispatch-studios' hour-and-price chase to the studio within 45 minutes,
  // and on a request in bidding settleBids would offer the asked hour to the
  // customer, both from one tap. A rate that comes with a yes goes with "yes".
  if (action === "rate") return p.pct !== null && Object.keys(rate).length ? { dispatch: { ...answered, ...rate, ...price, ...gender } } : null;
  if (action === "gender") return p.gender !== null ? { dispatch: { ...answered, ...gender } } : null;
  if (action === "no") return f.outcome === "won" ? null : { dispatch: { outcome: "declined", ...answered } };
  if (action === "answered") return { dispatch: answered };
  if (action === "hours" || action === "hoursx") return p.hours ? { partner: { opening_hours: p.hours } } : null;
  return null;
}

// ---- what a customer's words say ----
// The live customer handler's words (bot.ts, the offer step and the booking
// check-in), copied here; tests/relay.mjs checks they stay the same.
export const OFFER_YES_RE = /^(yes|yeah|yep|ok|okay|sure|si|sí|vale|perfecto|perfect|great|book it|reserva|reservar|confirm|confirmo|1)$/;
export const OFFER_NO_RE = /^(no|nope|another|otra|other|otra hora|another time|2)$/;
export const ATTEND_YES_RE = /^(yes|yeah|yep|ok|okay|sure|si|sí|vale|claro|confirmo|confirmed|coming|i'?ll be there|voy|all[ií] estar[eé])$/;
export type CustomerParsers = {
  parseOfferedTime: (t: string) => string;
  stopIntent: (t: string) => unknown;
  EROTIC_RE: RegExp;
  CANCEL_RE: RegExp;
  DECLINE_RE: RegExp;
  CHANGE_RE: RegExp;
  GOODBYE_RE: RegExp;
};
export type CustomerFacts = { liveOffer: boolean; confirmed: boolean; open: boolean; flagged: string };
export type CustomerPlan = { kinds: string[]; time: string };
export function customerRelayPlan(text: string, f: CustomerFacts, P: CustomerParsers): CustomerPlan {
  const t = String(text || "").trim();
  const bare = t.toLowerCase().replace(/[.!¡¿?]/g, "").trim();
  const plan: CustomerPlan = { kinds: [], time: "" };
  if (!t) { plan.kinds.push("unclear"); return plan; }
  if (P.EROTIC_RE.test(t)) { plan.kinds.push("offmenu"); return plan; }
  if (P.stopIntent(t)) { plan.kinds.push("stop"); return plan; }
  const cancel = P.CANCEL_RE.test(t) || P.DECLINE_RE.test(t);
  const change = !cancel && P.CHANGE_RE.test(t) && !P.GOODBYE_RE.test(t);
  if (cancel) plan.kinds.push("cancel");
  else if (change && f.confirmed) plan.kinds.push("change");
  else if (f.liveOffer && OFFER_YES_RE.test(bare)) plan.kinds.push("yes");
  else if (f.confirmed && ATTEND_YES_RE.test(bare)) plan.kinds.push("attend_yes");
  else if (f.liveOffer && OFFER_NO_RE.test(bare)) plan.kinds.push("no");
  const time = P.parseOfferedTime(t);
  if (time && !plan.kinds.includes("cancel")) { plan.kinds.push("time"); plan.time = time; }
  if (!plan.kinds.length) plan.kinds.push(change ? "change" : "unclear");
  return plan;
}
// Customer actions never send anything and never confirm anything. A yes is
// theirs to tap; a change or cancel freezes the request (customer_flag
// change_requested, as the live change path writes); a STOP records their
// opt-out; an off-menu request mutes them.
export function customerActions(p: CustomerPlan, f: CustomerFacts): string[] {
  const k = (x: string) => p.kinds.includes(x);
  const acts: string[] = [];
  if (k("stop")) acts.push("optout");
  else if (k("offmenu")) acts.push("mute");
  else if ((k("cancel") || k("change")) && (f.open || f.confirmed) && f.flagged !== "change_requested" && f.flagged !== "cancelled") acts.push("freeze");
  return [...acts, "undo"];
}
export function customerWrites(action: string): { request?: Record<string, unknown>; session?: { step: string } } | null {
  if (action === "freeze") return { request: { customer_flag: "change_requested" } };
  if (action === "mute") return { session: { step: "muted" } };
  return null;
}

// ---- small pieces ----
// Button labels, 20 characters at most.
export const RELAY_LABELS: Record<string, string> = {
  yes: "Record yes", price: "Record price", rate: "Record the rate", no: "Record no", gender: "Record answer",
  hours: "Save hours", hoursx: "Replace hours", stop: "Record opt-out", answered: "Mark answered",
  freeze: "Freeze it", optout: "Record opt-out", mute: "Mute them", undo: "Not theirs",
};
// Our own lines (the ask, the price ask, the chase), which Jordan may forward
// together with the studio's answer. They are left out of what is read.
export const OUR_LINE_RE = /¿ten[eé]is hueco|tengo un cliente para un masaje|otro cliente para vosotros|qu[eé] precio final le dejar[ií]ais|como cliente de massage club|soy jordan, de massage club|os escribo por el masaje de|lo confirmo con .* y os digo/i;
// "Abrimos de lunes a sábado de 10 a 21" as dispatch-studios reads hours:
// "Lun-Sáb 10:00-21:00". "" when it cannot be said that way (two windows a
// day, no hours, anything unusual): the card then shows their words only.
const DAY_IDX: Array<[RegExp, number]> = [[/^lun/, 1], [/^mar/, 2], [/^mi[eé]/, 3], [/^jue/, 4], [/^vie/, 5], [/^s[aá]b/, 6], [/^dom/, 0]];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const dayIdx = (w: string): number => { for (const [re, i] of DAY_IDX) if (re.test(w)) return i; return -1; };
const hm = (h: string, m?: string) => { const H = parseInt(h, 10), M = m ? parseInt(m, 10) : 0; return H >= 0 && H <= 24 && M >= 0 && M < 60 ? `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}` : ""; };
export function relayHoursText(text: string): string {
  const t = norm(text);
  const times = [...t.matchAll(/(?:de\s+|desde\s+las\s+|desde\s+)?(\d{1,2})(?:[:.h](\d{2}))?\s*(?:h\b|hs\b)?\s*(?:a|-|hasta(?:\s+las)?)\s*(?:las\s+)?(\d{1,2})(?:[:.h](\d{2}))?/g)];
  if (times.length !== 1) return "";
  const open = hm(times[0][1], times[0][2]), close = hm(times[0][3], times[0][4]);
  if (!open || !close || open >= close) return "";
  let days = "Lun-Dom";
  const dr = t.match(/(?:de\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+a\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/);
  if (dr) {
    const a = dayIdx(dr[1]), b = dayIdx(dr[2]);
    if (a < 0 || b < 0) return "";
    days = `${DAY_SHORT[a]}-${DAY_SHORT[b]}`;
  } else if (/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/.test(t) && !/todos los dias/.test(t)) return "";
  return `${days} ${open}-${close}`;
}
// Review m8: the hours as saved are Spanish day names ("Lun-Sab 10:00-21:00"),
// and CLAUDE.md wants English beside any Spanish shown to Jordan:
// "Lun-Sab 10:00-21:00 (EN: Mon-Sat 10:00-21:00)". Text with no Spanish day
// name comes back unchanged.
const DAY_EN: Record<string, string> = { lun: "Mon", mar: "Tue", mie: "Wed", jue: "Thu", vie: "Fri", sab: "Sat", dom: "Sun" };
export function relayHoursShown(h: string): string {
  const s = String(h || "");
  const en = s.replace(/(^|[^A-Za-zÁÉÍÓÚáéíóúñ])(Lun|Mar|Mi[eé]|Jue|Vie|S[aá]b|Dom)(?![A-Za-zÁÉÍÓÚáéíóúñ])/g, (_a: string, pre: string, d: string) => pre + (DAY_EN[norm(d)] || d));
  return en === s ? s : `${s} (EN: ${en})`;
}
// The text as stored on the dispatch row: marked as relayed, and any "hoy",
// "mañana", "today" or "tomorrow" replaced by the request's own date, because a
// forward carries no time and the bot's later readers resolve those words
// from when the row was written.
const REL_DAY_RE = /(^|[^a-zñáéíóúü])(hoy|ma[nñ]ana|today|tomorrow)(?![a-zñáéíóúü])/gi;
// "por la mañana" and "de la mañana" are the morning, not tomorrow.
const morningBefore = (s: string, at: number) => /(por|de) la $/i.test(s.slice(Math.max(0, at - 7), at));
export function relayRelativeWords(t: string): string[] {
  const s = String(t || "");
  const out: string[] = [];
  for (const m of s.matchAll(REL_DAY_RE)) {
    const at = (m.index || 0) + m[1].length;
    if (!morningBefore(s, at)) out.push(m[2].toLowerCase());
  }
  return out;
}
// Review of a9c4c0e (minor 7): a weekday or a date in the studio's words that
// is not the request's own day. "Sí, el viernes a las 18:00" on a Thursday
// request read as a yes at the hour asked, and forwardOffer (which reads only
// hoy and mañana) would offer Thursday. The card says so before the tap. ask
// is the request's own day (dow 0 Sunday to 6, dom 1 to 31, month 1 to 12);
// null when the request has no day, or the words name none that differs.
// Hours statements ("de lunes a sábado") are not a day for the slot.
const WEEKDAY_RE = /(^|[^a-zñáéíóúü])(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?![a-zñáéíóúü])/gi;
const WEEKDAY_IDX: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function relayOtherDay(text: string, ask: { dow: number; dom: number; month: number } | null, isHours = false): { word: string; en: string } | null {
  if (!ask || isHours) return null;
  const s = String(text || "");
  for (const m of s.matchAll(WEEKDAY_RE)) {
    const i = WEEKDAY_IDX[norm(m[2])];
    if (i !== undefined && i !== ask.dow) return { word: m[2].toLowerCase(), en: WEEKDAY_EN[i] };
  }
  const t = norm(s);
  const named = t.match(new RegExp(`(?:^|[^0-9])([0-3]?\\d)\\s+de\\s+(${MONTHS_ES.join("|")})`));
  if (named) {
    const dom = Number(named[1]), month = MONTHS_ES.indexOf(named[2]) + 1;
    if (dom >= 1 && dom <= 31 && (dom !== ask.dom || month !== ask.month)) return { word: `${dom} de ${named[2]}`, en: `${dom} ${MONTHS_EN[month - 1]}` };
  }
  const slash = t.match(/(?:^|[^0-9:.])([0-3]?\d)\/([01]?\d)(?![0-9])/);
  if (slash) {
    const dom = Number(slash[1]), month = Number(slash[2]);
    if (dom >= 1 && dom <= 31 && month >= 1 && month <= 12 && (dom !== ask.dom || month !== ask.month)) return { word: `${slash[1]}/${slash[2]}`, en: `${dom} ${MONTHS_EN[month - 1]}` };
  }
  const el = t.match(/(?:^|[^a-z0-9])el\s+([0-3]?\d)(?![0-9:.h])/);
  if (el) {
    const dom = Number(el[1]);
    if (dom >= 1 && dom <= 31 && dom !== ask.dom) return { word: `el ${el[1]}`, en: `the ${dom}${dom % 10 === 1 && dom !== 11 ? "st" : dom % 10 === 2 && dom !== 12 ? "nd" : dom % 10 === 3 && dom !== 13 ? "rd" : "th"}` };
  }
  return null;
}
export function relayStoredText(t: string, dayEs: string): string {
  const s = String(t || "");
  const body = dayEs ? s.replace(REL_DAY_RE, (all: string, pre: string, _w: string, off: number) => (morningBefore(s, off + pre.length) ? all : `${pre}${dayEs}`)) : s;
  return `[reenviado por Jordan${dayEs ? ", " + dayEs : ""}] ${body}`;
}
// What a button does, in words, for the card and for the reply after the tap.
export function relayActionWords(action: string, p: { time?: string; price?: number | null; pct?: number | null; gender?: boolean | null; hours?: string }, euro: (n: number) => string, voice = false): string {
  const extras = voice ? "" : [p.price !== null && p.price !== undefined ? `the price ${euro(p.price)}` : "", p.pct ? `a ${p.pct}% Massage Club rate` : "", p.gender === true ? "the therapist asked for" : p.gender === false ? "that they cannot give the therapist asked for" : ""].filter(Boolean).join(", ");
  switch (action) {
    case "yes": return `their yes at ${p.time}${extras ? ", with " + extras : ""}, on their ask`;
    case "price": return `their price, ${p.price !== null && p.price !== undefined ? euro(p.price) : "?"}`;
    case "rate": return `their ${p.pct}% Massage Club rate${p.price !== null && p.price !== undefined ? `, price ${euro(p.price)}` : ""} (their ask stays open: not a yes)`;
    case "gender": return p.gender ? "that they can give the therapist asked for" : "that they cannot give the therapist asked for";
    case "no": return "their no: their ask is closed";
    case "answered": return "that they answered (their ask stays open)";
    case "hours": return `their opening hours, ${relayHoursShown(p.hours || "")}`;
    case "hoursx": return `their opening hours, ${relayHoursShown(p.hours || "")}, in place of the ones on file`;
    case "stop": return "their opt-out from everything we send studios";
    case "freeze": return "the request as frozen (customer_flag change_requested)";
    case "optout": return "their opt-out from offers";
    case "mute": return "that the bot never answers them again";
    case "undo": return "nothing: it takes the text back out of their chat";
    default: return action;
  }
}
// Whether Jordan needs an English line under the text (CLAUDE.md: always an
// English translation for any Spanish shown to him). Only clearly English
// text goes without one. Review of ef19cdd (minor 7): words both languages
// use (no, ok, okay, i, time) are no evidence of English, so "No, completo"
// (EN: "No, fully booked") and "Vale ok" (EN: "OK, fine") get their line.
export function relayNeedsEnglish(t: string, strongSpanish: (t: string) => boolean): boolean {
  const s = String(t || "").trim();
  if (!s) return false;
  if (strongSpanish(s) || /[ñáéíóúü¿¡]/i.test(s)) return true;
  return !/\b(the|and|is|are|you|we|can|yes|thanks|thank|please|book|my|hi|hello|sorry|tomorrow|today|have|not|with|for|available|booked|that|this|will)\b/i.test(s);
}
// One line: what the bot read.
export function relayReadText(kinds: string[], p: { time?: string; price?: number | null; pct?: number | null; gender?: boolean | null; hours?: string; hoursRaw?: boolean; pctBlocked?: boolean; pctSeen?: number | null; pctWhy?: string; pctReason?: string }, euro: (n: number) => string): string {
  const out: string[] = [];
  for (const k of kinds) {
    if (k === "yes_ask") out.push(p.time ? `yes at the hour asked, ${p.time}` : "yes, but the request has no exact hour");
    else if (k === "time") out.push(`their own time, ${p.time}`);
    else if (k === "no") out.push("no, they cannot");
    else if (k === "no_confirmed") out.push("a no about the booking they already hold");
    else if (k === "price" && p.price !== null && p.price !== undefined) out.push(`price ${euro(p.price)}`);
    else if (k === "discount" && p.pct) out.push(`a ${p.pct}% Massage Club rate`);
    else if (k === "gender") out.push(p.gender ? "the therapist asked for is fine" : "they cannot give the therapist asked for");
    else if (k === "hours") out.push(p.hours ? `opening hours ${relayHoursShown(p.hours)}` : "opening hours (in words I cannot save as they are)");
    else if (k === "arrived") out.push("the customer arrived");
    else if (k === "time_change") out.push(`a new time on a confirmed booking, ${p.time}`);
    else if (k === "stop") out.push("they want no more messages from us");
    else if (k === "away") out.push("an automatic reply, not an answer");
    else if (k === "ack") out.push("a plain thanks or ok");
    else if (k === "other") out.push("they want another time, with none named");
    else if (k === "yes") out.push("a yes to the offer");
    else if (k === "attend_yes") out.push("a yes that they are coming");
    else if (k === "cancel") out.push("they want to cancel");
    else if (k === "change") out.push("they want to change it");
    else if (k === "offmenu") out.push("an off-menu request");
    else if (k === "unclear") out.push("nothing I can act on");
  }
  const seen = p.pctSeen ? `${p.pctSeen}%` : "percentage";
  const reason = p.pctReason ? `: ${p.pctReason}` : "";
  if (p.pctBlocked && p.pctWhy === "refused") out.push(`a ${seen} they turned down, so no Massage Club rate is recorded (their words say no to it${reason})`);
  else if (p.pctBlocked && p.pctWhy === "unclear") out.push(`a ${seen} I did not take as a discount: their words do not clearly give it${p.pctReason ? ` (${p.pctReason})` : ""}. It counts only when they write that they give it for this booking, such as "os hacemos el 10%" (EN: "we give you 10%"), so nothing is recorded; ask them as the bot if it matters`);
  else if (p.pctBlocked) out.push("a discount I did not take (a discount counts only from one forwarded text message in their own writing)");
  return out.join("; ") || "nothing I can act on";
}
// What a recorded studio answer can set off later, by the bot's normal steps,
// without anyone tapping anything. Said on the card before the tap, so "Record"
// is never a surprise (critique, major 3).
export const STUDIO_FOLLOWS: Record<string, string[]> = {
  // Jordan, 24 Nov: Record yes is the studio's tap, so the customer gets the
  // normal offer (relayYesWords says how, before the tap; relayYesDone says
  // what happened, after it). These lines hold whatever happens.
  yes: [
    "Nothing is booked until the customer taps Yes themselves; only then does the studio get the confirmation in writing and the other studios are stood down.",
    "The studio is not chased for its hour any more, because the hour is recorded.",
  ],
  rate: ["Their ask stays open: a rate is not a yes to an hour, so nothing is offered to the customer and the studio is not asked for its hour or price because of this tap. The rate is printed on any offer the bot later sends for this studio, as the studio's confirmed Massage Club rate. Their ask counts as answered, so standing approval A does not chase them."],
  price: ["The price is printed on any offer the bot later sends for this studio. An offer email already waiting for it goes when its 3 minutes are up, as it would for any studio price."],
  no: ["Their ask is closed. If every studio asked has now said no or been silent for 3 hours, standing approval C can ask up to 3 more studios."],
  answered: ["Their ask counts as answered, so standing approval A does not chase them."],
  gender: ["The answer is used when the bot tells the customer about this studio."],
  hours: ["The bot and dispatch-studios stop asking them for days and hours they are closed."],
  hoursx: ["The hours on file are replaced; the bot and dispatch-studios ask them only inside these."],
  stop: ["They get no more letters, outreach or asks from us."],
};

// ---- Record yes: the studio's tap (Jordan, 24 Nov 2026) ----
// Jordan's pop-up answer "Yes, my tap = studio's tap": when he forwards a
// studio's answer and taps Record yes, that is the studio's tap under BOTH
// PARTIES TAP, so the customer then gets the normal offer, by the path ops
// studio_offer uses (the ask recorded as accepted, then forwardOffer). The
// customer's own tap on Yes is still the only thing that books it.
// What the tap does after recording:
//   offer     the normal offer goes to the customer (forwardOffer)
//   already   this studio's offer at this hour is already with them: nothing again
//   declined  they turned this studio down at this hour (review of a9c4c0e,
//             major 2): the yes is saved as an answer only, the ask stays
//             closed, and nothing goes to them again
//   frozen    customer_flag change_requested or cancelled: nothing new is sent
//   test      a test contact or friend tester: the relay never reaches them
//   closed    the request is no longer open: nothing is sent
//   unchecked what the offer step would send could not be worked out (the
//             preview failed), so this card only records (relayYesFacts)
// Review of ef19cdd (3, 4): declined, frozen, closed and unchecked are saved
// as an answer only (yesAsAnswer: the words, the price, a rate, a therapist
// answer; no outcome accepted, no accepted time, no hour), so settleBids, a
// queued offer or any later step can never send it.
export type YesSend = "offer" | "already" | "declined" | "frozen" | "test" | "closed" | "unchecked";
export const YES_ANSWER_ONLY: YesSend[] = ["declined", "frozen", "closed", "unchecked"];
export const relayYesAnswerOnly = (send: unknown): boolean => YES_ANSWER_ONLY.includes(String(send || "") as YesSend);
export function relayYesSend(o: { open: boolean; flag: string; test: boolean; already: boolean; declined?: boolean }): YesSend {
  if (!o.open) return "closed";
  if (o.test) return "test";
  if (o.flag === "change_requested" || o.flag === "cancelled") return "frozen";
  if (o.declined) return "declined";
  if (o.already) return "already";
  return "offer";
}
// A declined hour's yes, saved as an answer only: the words, the price, a
// rate and a therapist answer, but not the outcome, the accepted time or the
// hour. Written as accepted, settleBids (which reads every accepted row) could
// offer it to them again when a bidding window closes.
export function yesAsAnswer(w: { dispatch?: Record<string, unknown> } | null): { dispatch?: Record<string, unknown> } | null {
  if (!w?.dispatch) return w;
  const { outcome: _o, accepted_at: _a, offered_time: _t, offered_times: _ts, ...rest } = w.dispatch;
  return { dispatch: rest };
}
// What forwardOffer would do with the offer now, worked out by the bot from
// the same reads in the same order (relayOfferPreview): "go" (it is sent,
// preview.via says how) or the check that stops it. "" when it could not be
// worked out: the card then gives the general rule.
export type YesFate = "" | "go" | "queued" | "withheld_too_soon" | "withheld_mismatch" | "held_window" | "withheld_dearer" | "held" | "muted";
export type YesWordsOut = { text: string; buttons: string[]; subject: string; email: string; tpl: string };
export type YesPreview = YesWordsOut & {
  via: "whatsapp" | "email" | "template" | "none"; // what carries it: the buttons, the email (tpl says if the template goes too), the template alone, nothing
  L: "en" | "es";
  en: YesWordsOut | null;                          // the same words in English, for Jordan, when the customer reads Spanish
  replaced: { studio: string; es: string; en: string } | null; // the note the studio of the offer this replaces gets
};
export type YesFacts = {
  send: YesSend;
  customer: string;        // their first name, "" when none
  studio: string;
  time: string;            // the hour recorded
  day: string;             // the request's own day in English, "" when not known
  price: number | null;    // the price this studio wrote, recorded on the ask
  windowOpen: boolean;     // the customer's 24 hours with the bot
  email: string;           // the customer's email on file, "" when none
  template: boolean;       // OFFER_TEMPLATE would add request_update_v1 for them
  live: { studio: string; time: string } | null; // another offer in front of them now
  muted: boolean;          // their session is muted (off-menu requests)
  stage: string;
  testStudio?: boolean;    // send "test" because the studio is a test studio
  fate?: YesFate;
  preview?: YesPreview | null;
  turnedDown?: string;     // an hour they turned down on this ask, when it is not this one
};
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// What Jordan should tell the studio, since the bot says nothing to it (it
// wrote to him), worded as the bot's own path words it for each answer
// (review of a9c4c0e, minor 5): that he is checking with the customer when it
// goes, not to hold it yet when it waits, no need to hold it when nothing can
// reach the customer, not to hold it when it is not sent. Review of ef19cdd
// (6): always as the bot, from the bot number (link: replyUrl), never from his
// own phone, so their answer reaches the bot.
export function relayStudioAdvice(res: string, studio: string, who: string, link = ""): string {
  const asBot = `reply to them as the bot${link ? ` (${link})` : ""}`;
  switch (res) {
    case "go": case "whatsapp": case "email": case "email_pending": return `Nothing is sent to ${studio} from here: ${asBot} that you are checking with ${who}.`;
    case "queued": case "held_window": return `Nothing is sent to ${studio} from here: ${asBot} that you are checking with ${who} and that they should not hold it yet. If it is shown to ${who} later, the bot sends ${studio} its usual note then, inside its hours.`;
    case "none": return `Nothing is sent to ${studio} from here: ${asBot} that it is not booked yet and there is no need to hold it.`;
    case "withheld_too_soon": case "withheld_dearer": return `Nothing is sent to ${studio} from here: ${asBot} that they should not hold it.`;
    case "withheld_mismatch": return `Nothing is sent to ${studio} from here: ${asBot} and ask them for a time inside the hours ${who} asked for.`;
    case "muted": return `The request closes, so dispatch-studios tells ${studio}, inside its hours, that it is not going ahead, as for any closed request.`;
    case "held": return `Nothing is sent to ${studio} from here: ${asBot} with what you decide.`;
    default: return `Nothing is sent to ${studio} from here.`;
  }
}
// The card, before the tap: exactly what Record yes then does for the
// customer, in plain words, and that it goes by the normal offer. The words
// themselves come after it (relayYesPreview).
export function relayYesWords(f: YesFacts, euro: (n: number) => string, link = ""): string {
  const who = f.customer || "the customer";
  const Who = capFirst(who);
  const tap = `It counts as ${f.studio}'s tap (your rule of 24 Nov)`;
  const asBot = `reply to them as the bot${link ? ` (${link})` : ""}`;
  // Review of ef19cdd (3): saved as an answer only, so no later step sends it.
  const only = "the yes is saved as an answer only (no accepted hour), so no later step can send it either: not a bidding window closing, not their next offer";
  if (f.send === "closed") return `The request is ${f.stage || "closed"}, so nothing is sent to anyone: ${only}.`;
  if (f.send === "test") return f.testStudio
    ? `${tap}, but ${f.studio} is a test studio, and a test studio's yes never reaches a real customer from the relay: the yes is only recorded.`
    : `${tap}, but ${who} is a test contact, and the relay never sends a test contact anything: the yes is only recorded.`;
  if (f.send === "frozen") return `${tap}, but the request is frozen (${who} asked to change or cancel it), so nothing new is sent to them: ${only}. Once ${who} names a time, forward ${f.studio}'s answer again.`;
  // Review of ef19cdd (4): the preview failed, so this card cannot show what
  // would be sent, and its Record yes only records.
  if (f.send === "unchecked") return `${tap}, but I could not work out what the offer step would send ${who} (the preview failed), so on this card Record yes only records: nothing is sent to ${who}, and ${only}. Forward ${f.studio}'s message to me again for a card that can send the offer.`;
  if (f.send === "declined") return `${tap}, but ${who} turned down ${f.studio} at ${f.time}, so nothing goes to them again: the yes is saved as an answer only and their ask stays closed. If this is a new message from ${f.studio}, ${asBot} that ${who} has already said no to that time.`;
  if (f.send === "already") return `${tap}, but ${who} already got this offer (${f.studio} at ${f.time}), so nothing goes to them again: the yes is only recorded.`;
  const fate = f.fate || "";
  if (f.muted || fate === "muted") return `${tap}, but ${who} is muted (off-menu requests), so, as for any studio yes, nothing is sent to them and the bot closes the request. ${relayStudioAdvice("muted", f.studio, who)}`;
  const what = `${f.studio}${f.day ? `, ${f.day},` : ""} at ${f.time}, ${f.price !== null && f.price !== undefined ? `with the price they wrote (${euro(f.price)})` : "with their listed price if they have one"}`;
  const out: string[] = [];
  if (f.turnedDown) out.push(`${Who} turned down ${f.studio}'s ${f.turnedDown} before; ${f.time} is a new hour, so it goes as a new offer.`);
  const lv = f.live ? `${f.live.studio}${f.live.time ? " " + f.live.time : ""}` : "another offer";
  if (fate === "withheld_too_soon") out.push(`${tap}, but ${f.time} starts in under 45 minutes, so, as for any studio yes, it is not sent to ${who}: the yes is only recorded.`);
  else if (fate === "withheld_mismatch") out.push(`${tap}, but ${what} is outside the day or hours ${who} asked for, so, as for any studio yes, it is not sent to them: the yes is only recorded.`);
  else if (fate === "held_window") out.push(`${tap}, but ${f.time} is outside the hours ${who} asked for today, so, as for any studio yes, it is held for up to 15 minutes while the bot waits for a studio inside them, and then the best time it has goes to them.`);
  else if (fate === "withheld_dearer") out.push(`${tap}, but ${who} already has a cheaper offer open, so, as for any studio yes, it is not sent to them: the yes is only recorded.`);
  else if (fate === "held") out.push(`${tap}, but ${who} is on your hold list, so nothing goes to them and you get the OFFER HELD FOR YOU card.`);
  else if (fate === "queued") out.push(`${tap}, so ${who} gets the normal offer (${what}), but not yet: they already have ${lv} open, so this one waits behind it and is shown if they turn that one down.`);
  else {
    const v = f.preview?.via;
    const sure = fate === "go";
    const tplToo = v === "email" && f.preview ? !!f.preview.tpl : f.template;
    if (v === "whatsapp" || (!v && f.windowOpen)) out.push(`${tap}, so ${who} then gets the normal offer, the same message a studio's own yes sends: ${what}, on WhatsApp with its Yes, Another time and Closer or cheaper buttons, since their 24 hours with the bot are open.`);
    else if (v === "email" || (!v && f.email)) out.push(`${tap}, so ${who} then gets the normal offer, the same message a studio's own yes sends: ${what}, by email to ${f.email} with Yes and No on its offer page${tplToo ? ", and as the request_update_v1 WhatsApp template too if Meta has approved it" : ""}, since their 24 hours with the bot are closed.`);
    else if (v === "template" || (!v && f.template)) out.push(`${tap}, so ${who} then gets the normal offer: ${what}, as the request_update_v1 WhatsApp template, since their 24 hours with the bot are closed and there is no email on file. If Meta has not approved it yet, nothing reaches them and you get the OFFER NOT DELIVERED card.`);
    else out.push(`${tap}, so ${who} would get the normal offer (${what}), but nothing can reach them: their 24 hours with the bot are closed and there is no email on file. The offer is held, nothing is booked, and you get the OFFER NOT DELIVERED card.`);
    if (f.preview?.replaced) out.push(`It goes now although ${Who} has ${f.preview.replaced.studio}'s offer open, because that one is outside the hours they asked for and this one is inside: ${f.preview.replaced.studio} is then told, inside its hours, not to hold its slot (its words are below).`);
    else if (f.live && !sure) out.push(`${Who} already has ${lv} open, so this one waits behind it and is shown if they turn that one down (unless that one is outside the hours they asked for and this one is inside: then this one goes now, and that studio is told, inside its hours, not to hold its slot).`);
    if (sure && f.preview && f.preview.via !== "none") out.push("The exact words are below.");
    if (!sure) out.push("As with any studio yes, it is not sent if it starts in under 45 minutes, is outside the day or hours they asked for, or costs more than an offer they already have; I tell you if that happens.");
  }
  const adv = fate === "go" || !fate ? (f.preview?.via === "none" || (!f.preview && !f.windowOpen && !f.email && !f.template) ? "none" : "go") : fate;
  out.push(relayStudioAdvice(adv, f.studio, who, link));
  return out.join(" ");
}
// The words themselves, after the card's description (review of a9c4c0e,
// major 1: "the exact text of anything it would send, before a tap sends
// it"). With an English version when the customer reads Spanish, and the
// note the replaced studio gets in Spanish and English. The offer page's
// link is a placeholder: it opens the customer's own Yes. "" when nothing is
// sent now.
export function relayYesPreview(f: YesFacts): string {
  const p = f.preview;
  if (!p || (f.send !== "offer" && f.send !== "test") || (f.send === "offer" && f.fate !== "go")) return "";
  const who = f.customer || "the customer";
  const q = (s: string) => `"${s}"`;
  const enOf = (pick: (x: YesWordsOut) => string) => (p.en && pick(p.en) ? `\n(EN: ${q(pick(p.en))})` : "");
  const head = f.send === "test" ? `A real customer would get exactly this (nothing goes to a test contact)` : `Exactly what ${who} gets`;
  const out: string[] = [];
  if (p.via === "whatsapp") out.push(`${head} on WhatsApp, with the buttons ${p.buttons.map((b) => `[${b}]`).join(" ")}${p.en ? ` (EN: ${p.en.buttons.map((b) => `[${b}]`).join(" ")})` : ""}:\n${q(p.text)}${enOf((x) => x.text)}`);
  else if (p.via === "email") out.push(`${head} by email, subject ${q(p.subject)}${p.en ? ` (EN: ${q(p.en.subject)})` : ""}:\n${q(p.email)}${enOf((x) => x.email)}`);
  else if (p.via === "template") out.push(`${head} as the request_update_v1 template, if Meta has approved it:\n${q(p.tpl)}${enOf((x) => x.tpl)}`);
  else return "";
  if (p.via === "email" && p.tpl) out.push(`And as the request_update_v1 template, if Meta has approved it:\n${q(p.tpl)}${enOf((x) => x.tpl)}`);
  if (p.replaced) out.push(`And ${p.replaced.studio}, whose offer this replaces, gets inside its hours:\n${q(p.replaced.es)}\n(EN: ${q(p.replaced.en)})`);
  return out.join("\n\n");
}
// The reply, after the tap: what became of it. res is the send above when
// nothing was offered, or forwardOffer's own answer.
export function relayYesDone(res: string, o: { customer: string; studio: string; time: string; email: string; template: boolean; stage: string; link?: string }): string {
  const who = o.customer || "the customer";
  const Who = capFirst(who);
  const adv = (r: string) => " " + relayStudioAdvice(r, o.studio, who, o.link || "").replace(/^Nothing is sent to (.*?) from here/, "Nothing was sent to $1");
  const only = "so no later step can send it (not a bidding window closing, not their next offer)";
  switch (res) {
    case "closed": return `Saved as their answer only (no accepted hour): nothing was sent to anyone, the request is ${o.stage || "closed"}, ${only}.`;
    case "test": return `Nothing was sent to ${who} or to ${o.studio}: the relay never sends a test anything.`;
    case "frozen": return `Saved as their answer only (no accepted hour): nothing was sent to ${who}, the request is frozen (they asked to change or cancel it), ${only}. Nothing was sent to ${o.studio}. Once ${who} names a time, forward ${o.studio}'s answer again.`;
    case "unchecked": return `Saved as their answer only (no accepted hour): the offer preview failed, so nothing went to ${who}, ${only}. Nothing was sent to ${o.studio}. Forward ${o.studio}'s message to me again for a card that can send the offer.`;
    case "declined": return `Saved as their answer only: ${who} turned down ${o.studio} at ${o.time}, so nothing went to them and the ask stays closed. Nothing was sent to ${o.studio}.`;
    case "already": return `${Who} already had this offer, so nothing went again.`;
    case "whatsapp": return (o.template ? `Sent ${who} the normal offer as the request_update_v1 WhatsApp template (their 24 hours were closed and there is no email on file).` : `Sent ${who} the normal offer on WhatsApp, with its Yes button.`) + adv("whatsapp");
    case "email": return `Sent ${who} the normal offer by email${o.email ? ` to ${o.email}` : ""}, with Yes and No on its offer page${o.template ? ", and as the request_update_v1 WhatsApp template" : ""}.` + adv("email");
    case "email_pending": return `The normal offer email goes to ${who} within 3 minutes.` + adv("email_pending");
    case "queued": return `${Who} has another offer open, so this one waits behind it and is shown if they turn that one down.` + adv("queued");
    case "held_window": return `Held for up to 15 minutes: ${o.time} is outside the hours ${who} asked for today, so the bot waits for a studio inside them and then sends the best time it has.` + adv("held_window");
    case "withheld_too_soon": return `Not sent to ${who}: ${o.time} starts in under 45 minutes.` + adv("withheld_too_soon");
    case "withheld_mismatch": return `Not sent to ${who}: ${o.time} is outside the day or hours they asked for.` + adv("withheld_mismatch");
    case "withheld_dearer": return `Not sent to ${who}: they already have a cheaper offer open.` + adv("withheld_dearer");
    case "held": return `Held for you: ${who} is on your hold list, so nothing went to them (see the OFFER HELD FOR YOU card).` + adv("held");
    case "muted": return `Not sent: ${who} is muted (off-menu requests), so the request is now closed.` + adv("muted");
    case "none": return `Nothing could reach ${who} (their 24 hours are closed and there is no email on file), so nothing is booked: see the OFFER NOT DELIVERED card.` + adv("none");
    default: return `The offer step did not finish (${!res || res === "error" ? "an error" : res}), so ${who} may not have the offer. The yes is recorded; ask Claude to check it.`;
  }
}
