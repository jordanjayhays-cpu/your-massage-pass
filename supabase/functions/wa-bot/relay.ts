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
// "unclear" (their words do not clearly give it).
export type StudioPlan = { kinds: string[]; time: string; price: number | null; pct: number | null; pctBlocked: boolean; pctSeen: number | null; pctWhy: "" | "relay" | "refused" | "unclear"; gender: boolean | null; hours: string; hoursRaw: boolean };
// ---- a written percentage: given, refused or unclear ----
// Review of ef19cdd (major; CLAUDE.md discounts: never quote one to a customer
// before the studio has confirmed it in writing). parseDiscount finds a
// percentage anywhere in the words, so "Sí, a las 18:00, 50€. El 10% no lo
// hacemos." (EN: "Yes, at 18:00, 50 EUR. We don't do the 10%.") read as a 10%
// Massage Club rate, and Record yes would have printed it on the customer's
// offer. A percentage now counts as given only in a positive phrase: "os
// hacemos el 10%" (EN: "we give you 10%"), "le dejamos un 10%" (EN: "we leave
// you 10%"), "con el 10%" (EN: "with the 10%"), "aplicamos el 10%" (EN: "we
// apply 10%"), "sí al 10%" (EN: "yes to the 10%"), "un 10% de descuento" (EN:
// "a 10% discount"), "we can do 10%", "with the 10% discount". A refusal next
// to it ("no", "sin el 10%" (EN: "without the 10%"), "el descuento no" (EN:
// "the discount, no"), "we can't"), a question, a condition ("si repite" (EN:
// "if they come back"), "only if"), two different percentages, or a number
// word that is not tied to the discount ("a las diez" (EN: "at ten")) make it
// refused or unclear, and it is never recorded.
export type DiscountStance = "given" | "refused" | "unclear";
const PCT_WORDS = "cinco|diez|quince|veinte|veinticinco|treinta";
// The percentage itself, written so it cannot be anything else.
const PCT_ANCHOR_RE = new RegExp(`(\\d{1,2})\\s*(?:%|\\/(?!\\s*\\d)|por\\s*ciento|porciento|percent)|(?:^|[^a-z])(${PCT_WORDS})\\s*(?:%|por\\s*ciento|porciento|de\\s+(?:descuento|dto))|(?:descuento|dto)\\s+(?:del?|de\\s+un)\\s+(\\d{1,2}|${PCT_WORDS})(?![0-9a-z])`, "g");
const PCT_WORD_N: Record<string, number> = { cinco: 5, diez: 10, quince: 15, veinte: 20, veinticinco: 25, treinta: 30 };
// A clause about the discount ("a las diez" (EN: "at ten") is not one).
const PCT_MARK_RE = new RegExp(`\\d{1,2}\\s*(?:%|\\/(?!\\s*\\d)|por\\s*ciento|porciento|percent)|(?:^|[^a-z])(?:descuento|descuentos|dto|discount|rebaja|rate)(?![a-z])|(?:^|[^a-z])(?:${PCT_WORDS})\\s*(?:%|por\\s*ciento|porciento|de\\s+(?:descuento|dto))`);
// Words that only look like a no.
const NOT_A_NO_RE = /\b(no hay (ningun )?problemas?|sin problemas?|ningun problema|no problem|no worries|no te preocupes|no os preocupeis|no pasa nada)\b/g;
const PCT_NO_RE = /(^|[^a-z0-9ñ'])(no|sin|nada|ningun|ninguno|ninguna|tampoco|imposible|nunca|jamas|siento|demasiado|mucho|not|without|cannot|can't|cant|don't|dont|won't|wont|isn't|isnt|unable|sorry|too much)(?![a-z0-9ñ'])/;
const PCT_IF_RE = /(^|[^a-z0-9ñ])(si (reserva|reservan|reservas|viene|vienen|vienes|repite|repiten|repites|paga|pagan|pagas|son|es|trae|traen|compra|compran|hace|hacen|coge|cogen)|solo (los|las|entre|para|con|si|en|de|el|la|a|por)|solamente|unicamente|a partir de|excepto|salvo|para grupos|en grupo|bono|if|only if|only for|only on|unless|except|for groups)(?![a-z0-9ñ])/;
const PCT_YES_RE: RegExp[] = [
  /(^|[^a-z])(os|le|les|te|lo|la|se lo|se la)\s+(hacemos|hago|haremos|dejamos|dejo|dejaremos|aplicamos|aplico|aplicaremos|ofrecemos|ofrezco|ofreceremos|damos|doy|daremos|ponemos|pongo|respetamos|mantenemos|incluimos)(?![a-z])/,
  /(^|[^a-z])(os|le|les|te)\s+podemos\s+(hacer|dejar|aplicar|ofrecer|dar|poner)(?![a-z])/,
  new RegExp(`(^|[^a-z])(hacemos|aplicamos|ofrecemos|damos|dejamos|ponemos|incluimos|podemos\\s+(hacer|dejar|aplicar|ofrecer|dar|poner)(le|les|os|te)?)\\s+(el\\s+|un\\s+|una\\s+|del\\s+|de\\s+un\\s+)?(descuento\\s+(del?\\s+)?)?(\\d|descuento|dto|${PCT_WORDS})`),
  new RegExp(`(^|[^a-z])con\\s+(el\\s+|un\\s+|una\\s+)?(descuento|dto|\\d{1,2}\\s*(%|\\/|por\\s*ciento|porciento)|${PCT_WORDS})`),
  new RegExp(`(^|[^a-z])si\\s*[,!:]?\\s*(al\\s+|el\\s+|un\\s+|con\\s+el\\s+|con\\s+un\\s+)?(\\d{1,2}\\s*(%|\\/|por\\s*ciento|porciento)|${PCT_WORDS})`),
  /(^|[^a-z])(al|el|un)\s+\d{1,2}\s*(%|\/|por\s*ciento|porciento)(\s*de\s*(descuento|dto))?\s*,?\s*(si|vale|ok|okay|perfecto|de acuerdo|claro|genial)(?![a-z])/,
  new RegExp(`(^|[^a-z])un\\s+(\\d{1,2}\\s*(%|\\/(?!\\s*\\d)|por\\s*ciento|porciento)|(${PCT_WORDS})\\s*(%|por\\s*ciento|porciento))`),
  /(^|[^a-z])(incluido|incluida|incluye|incluyendo|aplicado|aplicada|descontado|ya descontado)(?![a-z])/,
  /\b(we|i)\s*('ll|ll|will|can|could|do|are happy to|'re happy to|re happy to|am happy to|'m happy to)?\s*(do|give|offer|apply|include|honou?r)\b/,
  /\bhappy to (do|give|offer|apply)\b/,
  /\bwith\s+(the\s+|a\s+|an\s+)?(\d{1,2}\s*(%|percent)|discount)/,
  /\b(a|an)\s+\d{1,2}\s*(%|percent)/,
  /\d{1,2}\s*%\s*off\b/,
  /\byes\b[^a-z0-9]*(to\s+)?(the\s+|a\s+)?\d{1,2}\s*(%|percent)/,
  /\b(included|including|applied)\b/,
];
export function relayDiscountStance(text: string): DiscountStance {
  const t = norm(text).replace(NOT_A_NO_RE, " ok ");
  let refused = false, unclear = false, given = false;
  // Sentences (a question keeps its mark), then the parts of each: a no
  // counts when it is in the same part as the discount.
  for (const sent of t.split(/(?<=[.!?;\n])/)) {
    if (!PCT_MARK_RE.test(sent)) continue;
    const parts = sent.split(/,|\(|\)|(?:^|\s)(?:pero|but|y|and|aunque|though)(?=\s)/);
    for (const part of parts) if (PCT_MARK_RE.test(part) && PCT_NO_RE.test(part)) refused = true;
    if (/[?¿]/.test(sent) || PCT_IF_RE.test(sent)) unclear = true;
    if (PCT_YES_RE.some((re) => re.test(sent))) given = true;
  }
  if (refused) return "refused";
  // The percentage must be written as one, and as one figure only.
  const figs = new Set<number>();
  for (const m of t.matchAll(PCT_ANCHOR_RE)) {
    const n = m[1] ? Number(m[1]) : m[2] ? PCT_WORD_N[m[2]] : /^\d+$/.test(m[3] || "") ? Number(m[3]) : PCT_WORD_N[m[3] || ""];
    if (n) figs.add(n);
  }
  return figs.size !== 1 || unclear || !given ? "unclear" : "given";
}
const NO_RE = /(^|[^a-zñáéíóúü])(no (podemos|puedo|tenemos|hay|nos (da|va|viene))|imposible|complet[oa]s?|llen[oa]s?|ocupad[oa]s?|lo siento|no disponible|sin hueco|no queda|no nos queda)(?![a-zñáéíóúü])/i;
const OTHER_RE = /(^|[^a-zñáéíóúü])(otra hora|otro d[ií]a|otro momento|m[aá]s tarde|m[aá]s temprano)(?![a-zñáéíóúü])/i;
const YES_OPEN_RE = /^\s*[¡]?\s*(s[ií]|claro|perfecto|perfecta|vale|ok|okay|de acuerdo|genial)(?![a-zñáéíóúü])/i;
const AVAIL_RE = /(^|[^a-zñáéíóúü])(hueco|podemos|puedo|tenemos|disponible|libre|os esperamos|le esperamos|la esperamos|sin problema)(?![a-zñáéíóúü])/i;
export function studioRelayPlan(text: string, f: StudioFacts, P: StudioParsers): StudioPlan {
  const t = String(text || "").trim();
  const plan: StudioPlan = { kinds: [], time: "", price: null, pct: null, pctBlocked: false, pctSeen: null, pctWhy: "", gender: null, hours: "", hoursRaw: false };
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
  const no = NO_RE.test(t);
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
      // A discount counts only when their words give it (relayDiscountStance:
      // "El 10% no lo hacemos" (EN: "We don't do the 10%") is a no), and only
      // in the studio's own writing: one forwarded text message, with none of
      // our own lines in the batch. Anything else is shown, never recorded.
      plan.pctSeen = pct;
      const stance = relayDiscountStance(t);
      if (stance !== "given") { plan.pctBlocked = true; plan.pctWhy = stance; }
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
export function relayReadText(kinds: string[], p: { time?: string; price?: number | null; pct?: number | null; gender?: boolean | null; hours?: string; hoursRaw?: boolean; pctBlocked?: boolean; pctSeen?: number | null; pctWhy?: string }, euro: (n: number) => string): string {
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
  if (p.pctBlocked && p.pctWhy === "refused") out.push(`a ${seen} they turned down, so no Massage Club rate is recorded (their words say no to it)`);
  else if (p.pctBlocked && p.pctWhy === "unclear") out.push(`a ${seen} I did not take as a discount: their words do not clearly give it (it counts only when they write that they give it, such as "os hacemos el 10%" (EN: "we give you 10%")), so nothing is recorded; ask them as the bot if it matters`);
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
