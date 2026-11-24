// Part B (24 Nov 2026): the offer for a customer whose 24 hour WhatsApp window
// has closed, as an approved UTILITY template on the bot number, so the bot can
// reach them without Jordan writing from his own phone (827). Pure: no
// imports, no fetch, no clock; tests/relay.mjs runs it.
//
// Jordan, 24 Nov (pop-up "Yes, automatic"): the bot may send it on its own
// once Meta approves it, so it no longer needs his OK each time. It is still
// NOT SUBMITTED to Meta and NOT DEPLOYED: it needs Meta's approval and a
// deploy of wa-bot, and app_secrets OFFER_TEMPLATE stays off (the default
// here, and for anything missing or unknown) until both are done.
//
// Wording, after the two critiques of the spec:
// - named request_update_v1, and "Other options" instead of "Closer or
//   cheaper", so Meta reads it as an update on a request (UTILITY), not a
//   promotion (implementation critique M12);
// - the greeting word is fixed text and only the name is {{1}} ("Hi Marcel" /
//   "Hola Marcel"; with no name "Hi there" / "Hola de nuevo", EN "Hello
//   again"), because Meta rejects a body that starts with a placeholder
//   (24 Nov: every approved template of ours starts with fixed text);
// - the price line never names a discount or the Massage Club rate: the
//   customer hears about a discount only on the confirmation (CLAUDE.md,
//   discounts; rules critique major 11);
// - the day is always the date ("Thursday 26 November"), never "today" or
//   "tomorrow", because a template can be read hours later;
// - nothing is booked until they tap Yes (BOTH PARTIES TAP). The three quick
//   replies carry offer_yes_<row>, offer_no_<row> and offer_alt_<row>, which the
//   bot already routes to acceptOffer and declineOffer.

export const OFFER_TPL_NAME = "request_update_v1";
export type OfferTplMode = "off" | "test" | "on";
export function parseOfferTplMode(v: unknown): OfferTplMode {
  const x = String(v ?? "").trim().toLowerCase();
  return x === "on" || x === "test" ? x : "off";
}
// The bodies exactly as they would be submitted. renderOfferTpl fills them
// in for the log, so the inbox shows what the customer read.
export const OFFER_TPL_TEXT: Record<"en" | "es", string> = {
  en: "Hi {{1}}, here is news on your massage request.\n\n{{2}} can take you on {{3}} at {{4}}: {{5}}.\nPrice: {{6}}. You pay at the studio, no fee.\n\nNothing is booked until you tap Yes.\n\nMassage Club",
  // EN: "{{1}}, we are writing with news about your massage request. {{2}} can
  // see you on {{3}} at {{4}}: {{5}}. Price: {{6}}. You pay at the studio, no
  // fee. Nothing is booked until you tap Yes. Massage Club"
  es: "Hola {{1}}, te escribimos con novedades sobre tu solicitud de masaje.\n\n{{2}} puede atenderte el {{3}} a las {{4}}: {{5}}.\nPrecio: {{6}}. Pagas en el centro, sin comisión.\n\nNo se reserva nada hasta que toques Sí.\n\nMassage Club",
};
// Quick replies, 25 characters at most. ES in English: "Yes, book it",
// "Another time", "Other options".
export const OFFER_TPL_BUTTONS: Record<"en" | "es", string[]> = {
  en: ["Yes, book it", "Another time", "Other options"],
  es: ["Sí, resérvalo", "Otra hora", "Otras opciones"],
};
export const offerTplPayloads = (row: string) => [`offer_yes_${row}`, `offer_no_${row}`, `offer_alt_${row}`];
const one = (s: string, max = 300) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);
const eurEn = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2)) + " EUR";
const eurEs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",")) + " €";
export type OfferTplInput = {
  firstName: string;
  studio: string;
  neighbourhood?: string;
  slotAtMs: number | null;   // when the slot starts; no start known means no template
  time: string;              // "18:00"
  svc: string;               // the service in the customer's words and language ("relaxing massage", "masaje relajante")
  mins: number;
  price: number | null;      // a price this studio wrote (quoted_price, or in its message)
  listed: number | null;     // else the studio's listed price
};
// The six parameters, or null when no template should go (no start known,
// or a clock time that is not one).
export function offerTplParams(L: string, o: OfferTplInput, longDate: (ms: number, L: "en" | "es") => string): string[] | null {
  const es = L === "es";
  if (o.slotAtMs === null || !Number.isFinite(o.slotAtMs) || !/^\d{1,2}:\d{2}$/.test(String(o.time || ""))) return null;
  const first = one(String(o.firstName || "").split(/\s+/)[0] || "", 40);
  const p1 = first || (es ? "de nuevo" : "there");
  const where = one(o.neighbourhood || "", 60);
  const p2 = one(`${o.studio}${where && !String(o.studio).toLowerCase().includes(where.toLowerCase()) ? ` (${where})` : ""}`, 120);
  const p3 = one(longDate(o.slotAtMs, es ? "es" : "en").replace(/,/g, ""), 60);
  const p4 = String(o.time).padStart(5, "0");
  const svc = one(o.svc || (es ? "masaje" : "massage"), 80);
  const p5 = es ? `${svc}, ${o.mins} minutos` : `${svc}, ${o.mins} minutes`;
  const p6 = o.price !== null && o.price > 0
    ? (es ? `${eurEs(o.price)} (confirmado por el centro)` : `${eurEn(o.price)} (confirmed by the studio)`)
    : o.listed !== null && o.listed > 0
    ? (es ? `unos ${eurEs(o.listed)} (precio publicado del centro)` : `about ${eurEn(o.listed)} (the studio's listed price)`)
    : (es ? "aún sin confirmar" : "not confirmed yet");
  return [p1, p2, p3, p4, p5, p6].map((x) => one(x));
}
export function renderOfferTpl(L: string, params: string[]): string {
  const body = OFFER_TPL_TEXT[L === "es" ? "es" : "en"];
  return body.replace(/\{\{(\d)\}\}/g, (_m: string, n: string) => String(params[Number(n) - 1] ?? ""));
}
// Who may get it. off: nobody. test: Jordan's own two numbers only (never the
// 34600000xxx canary: a template is billed, and a fake number may belong to a
// real subscriber). on: anyone who is not a test contact, a friend tester, a
// held customer or muted. The bot also requires mktTemplateGate: if Meta files
// the template as MARKETING, only a verified yes to offers gets it.
const JORDAN = ["34612474827", "15622355063"];
export function offerTplAudience(mode: OfferTplMode, c: { phone: string; testCustomer: boolean; held: boolean; muted: boolean }): boolean {
  const d = String(c.phone || "").replace(/\D/g, "");
  if (mode === "off" || !d || c.held || c.muted) return false;
  if (mode === "test") return JORDAN.includes(d);
  return !c.testCustomer;
}
// The ops tplnew payload, for submitting the wording to Meta: UTILITY,
// one example per placeholder (invented names, the repo is public), three
// quick replies. Run it with dry: true first.
export function offerTplSubmission(L: "en" | "es"): { ops: string; name: string; lang: string; category: string; body: string; buttons: string[]; examples: string[]; dry: boolean } {
  const examples = L === "es"
    ? ["Lucía", "Estudio Ejemplo (Chamberí)", "jueves 26 de noviembre", "18:00", "masaje relajante, 60 minutos", "55 € (confirmado por el centro)"]
    : ["Lucy", "Example Studio (Chamberí)", "Thursday 26 November", "18:00", "relaxing massage, 60 minutes", "55 EUR (confirmed by the studio)"];
  return { ops: "tplnew", name: OFFER_TPL_NAME, lang: L, category: "UTILITY", body: OFFER_TPL_TEXT[L], buttons: OFFER_TPL_BUTTONS[L], examples, dry: true };
}
