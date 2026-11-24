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
// v1 records only. Nothing here or in the bot's relay block sends anything to
// a studio or a customer: no offer, no price ask, no stand-down. A forwarded
// message is Jordan's report of someone's words, so it can record a studio's
// answer, but it never confirms a booking or a customer's attendance (BOTH
// PARTIES TAP), and a discount counts only from one forwarded text message in
// the studio's own writing (CLAUDE.md, discounts).

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
  return `${head} "${q}"${en}\n\nPick them and I will save it in their chat and show you what I read. Nothing is sent to anyone.${test}${none}${extra}\nRef R${o.ref}`;
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
export type StudioPlan = { kinds: string[]; time: string; price: number | null; pct: number | null; pctBlocked: boolean; gender: boolean | null; hours: string; hoursRaw: boolean };
const NO_RE = /(^|[^a-zñáéíóúü])(no (podemos|puedo|tenemos|hay|nos (da|va|viene))|imposible|complet[oa]s?|llen[oa]s?|ocupad[oa]s?|lo siento|no disponible|sin hueco|no queda|no nos queda)(?![a-zñáéíóúü])/i;
const OTHER_RE = /(^|[^a-zñáéíóúü])(otra hora|otro d[ií]a|otro momento|m[aá]s tarde|m[aá]s temprano)(?![a-zñáéíóúü])/i;
const YES_OPEN_RE = /^\s*[¡]?\s*(s[ií]|claro|perfecto|perfecta|vale|ok|okay|de acuerdo|genial)(?![a-zñáéíóúü])/i;
const AVAIL_RE = /(^|[^a-zñáéíóúü])(hueco|podemos|puedo|tenemos|disponible|libre|os esperamos|le esperamos|la esperamos|sin problema)(?![a-zñáéíóúü])/i;
export function studioRelayPlan(text: string, f: StudioFacts, P: StudioParsers): StudioPlan {
  const t = String(text || "").trim();
  const plan: StudioPlan = { kinds: [], time: "", price: null, pct: null, pctBlocked: false, gender: null, hours: "", hoursRaw: false };
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
      // A discount counts only in the studio's own writing: one forwarded
      // text message, with none of our own lines in the batch.
      if (f.source === "text" && f.single && !f.echo) { plan.kinds.push("discount"); plan.pct = pct; }
      else plan.pctBlocked = true;
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
  const rate = p.pct !== null && f.source === "text" && f.single && !f.echo ? { discount_pct: p.pct, offer_note: raw.slice(0, 200) } : {};
  const accept = f.outcome === "won" ? {} : { outcome: "accepted", accepted_at: f.acceptedAt || nowIso };
  if (action === "yes") return p.time ? { dispatch: { ...accept, ...answered, offered_time: p.time, offered_times: [p.time], ...price, ...rate, ...gender } } : null;
  if (action === "price") return p.price !== null ? { dispatch: { ...answered, ...price, ...gender } } : null;
  if (action === "rate") return p.pct !== null && Object.keys(rate).length ? { dispatch: { ...accept, ...answered, ...rate, ...price, ...gender } } : null;
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
    case "rate": return `their ${p.pct}% Massage Club rate${p.price !== null && p.price !== undefined ? `, price ${euro(p.price)}` : ""}`;
    case "gender": return p.gender ? "that they can give the therapist asked for" : "that they cannot give the therapist asked for";
    case "no": return "their no: their ask is closed";
    case "answered": return "that they answered (their ask stays open)";
    case "hours": return `their opening hours, ${p.hours}`;
    case "hoursx": return `their opening hours, ${p.hours}, in place of the ones on file`;
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
// text goes without one.
export function relayNeedsEnglish(t: string, strongSpanish: (t: string) => boolean): boolean {
  const s = String(t || "").trim();
  if (!s) return false;
  if (strongSpanish(s) || /[ñáéíóúü¿¡]/i.test(s)) return true;
  return !/\b(the|and|is|are|you|we|can|yes|no|ok|okay|thanks|thank|please|time|book|i|my|hi|hello|sorry|tomorrow|today)\b/i.test(s);
}
// One line: what the bot read.
export function relayReadText(kinds: string[], p: { time?: string; price?: number | null; pct?: number | null; gender?: boolean | null; hours?: string; hoursRaw?: boolean; pctBlocked?: boolean }, euro: (n: number) => string): string {
  const out: string[] = [];
  for (const k of kinds) {
    if (k === "yes_ask") out.push(p.time ? `yes at the hour asked, ${p.time}` : "yes, but the request has no exact hour");
    else if (k === "time") out.push(`their own time, ${p.time}`);
    else if (k === "no") out.push("no, they cannot");
    else if (k === "no_confirmed") out.push("a no about the booking they already hold");
    else if (k === "price" && p.price !== null && p.price !== undefined) out.push(`price ${euro(p.price)}`);
    else if (k === "discount" && p.pct) out.push(`a ${p.pct}% Massage Club rate`);
    else if (k === "gender") out.push(p.gender ? "the therapist asked for is fine" : "they cannot give the therapist asked for");
    else if (k === "hours") out.push(p.hours ? `opening hours ${p.hours}` : "opening hours (in words I cannot save as they are)");
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
  if (p.pctBlocked) out.push("a discount I did not take (a discount counts only from one forwarded text message in their own writing)");
  return out.join("; ") || "nothing I can act on";
}
// What a recorded studio answer can set off later, by the bot's normal steps,
// without anyone tapping anything. Said on the card before the tap, so "Record"
// is never a surprise (critique, major 3).
export const STUDIO_FOLLOWS: Record<string, string[]> = {
  yes: [
    "The offer is not sent from here, and nothing sends it on its own, except two of the bot's normal steps: if the customer has another offer open, this one waits behind it and is shown if they turn that one down (the studio then gets the usual note that the client is looking at it); and a bidding window that closes on the request can offer it.",
    "Otherwise it stays recorded until it is sent with ops studio_offer. The studio is not chased for its hour any more, because the hour is recorded.",
  ],
  rate: ["The rate is printed on any offer the bot later sends for this studio, as the studio's confirmed Massage Club rate. The offer itself is not sent from here."],
  price: ["The price is printed on any offer the bot later sends for this studio. An offer email already waiting for it goes when its 3 minutes are up, as it would for any studio price."],
  no: ["Their ask is closed. If every studio asked has now said no or been silent for 3 hours, standing approval C can ask up to 3 more studios."],
  answered: ["Their ask counts as answered, so standing approval A does not chase them."],
  gender: ["The answer is used when the bot tells the customer about this studio."],
  hours: ["The bot and dispatch-studios stop asking them for days and hours they are closed."],
  hoursx: ["The hours on file are replaced; the bot and dispatch-studios ask them only inside these."],
  stop: ["They get no more letters, outreach or asks from us."],
};
