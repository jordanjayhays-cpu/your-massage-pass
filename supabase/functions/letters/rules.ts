// Letters (17 Nov 2026): the rules. Template and fee checks, address checks,
// the mailing list CSV, eligibility, the letter state machine, cost maths and
// reference codes. Pure functions only (no Deno, no network), erasable
// TypeScript, so Node tests load this file with --experimental-strip-types.

import { FEE_SENTENCES, SIGN_OFF, MISSING } from "./templates.ts";
import type { Template } from "./templates.ts";

export type Problem = { field?: string; code: string; message: string; line?: number };

// ---------------------------------------------------------------------------
// Text basics
// ---------------------------------------------------------------------------
// Control and invisible characters (C0, DEL, zero-width, bidi marks, word
// joiners, BOM). Built from code points so no tool can turn the escapes into
// the characters themselves.
const INVISIBLE_RE = new RegExp("[" + [[0x00, 0x08], [0x0b, 0x1f], [0x7f, 0x7f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]]
  .map(([a, b]) => `\\u{${a.toString(16)}}-\\u{${b.toString(16)}}`).join("") + "]", "u");
// U+2013 and U+2014, built from code points so the source holds neither.
export const EN_DASH = String.fromCharCode(0x2013);
export const EM_DASH = String.fromCharCode(0x2014);
export const DASH_RE = new RegExp(`[${EN_DASH}${EM_DASH}]`);
export const nfc = (s: unknown): string => String(s ?? "").normalize("NFC").replace(/\r\n?/g, "\n");
export const squash = (s: string): string => s.replace(/\s+/g, " ").trim();
// A whole word or phrase, case-insensitive, with letter/digit boundaries that
// understand accents (JS \b does not).
export function wordRe(words: string[]): RegExp {
  const alt = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, "iu");
}

// ---------------------------------------------------------------------------
// Merge tags
// ---------------------------------------------------------------------------
export const TAGS = {
  body: ["nombre"],
  optout: ["whatsapp", "email_contacto"],
  privacy: ["remitente", "nif", "direccion_remitente", "email_contacto", "privacidad_url"],
  caption: [] as string[],
};
const TAG_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function tagProblems(field: string, text: string, allowed: string[]): Problem[] {
  const out: Problem[] = [];
  for (const m of text.matchAll(TAG_RE)) {
    if (!allowed.includes(m[1])) {
      out.push({ field, code: "unknown_tag", message: `{{${m[1]}}} is not a tag this part of the letter can use (allowed: ${allowed.length ? allowed.map((a) => `{{${a}}}`).join(", ") : "none"}).` });
    }
  }
  const rest = text.replace(TAG_RE, "");
  if (rest.includes("{{") || rest.includes("}}")) out.push({ field, code: "stray_braces", message: "There is a {{ or }} that is not a complete tag." });
  return out;
}

export type Style = "regular" | "medium" | "missing";
export type Run = { text: string; style: Style };
export type TagValue = { text: string; missing?: boolean };

// Merges tags into runs: plain text is "regular", a missing value becomes a
// "missing" run (drawn as a red placeholder, and counted). Unknown tags or
// stray braces throw: they never reach a page.
export function mergeRuns(text: string, values: Record<string, TagValue>, allowed: string[]): Run[] {
  const probs = tagProblems("text", text, allowed);
  if (probs.length) throw new Error(probs.map((p) => p.message).join(" "));
  const runs: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) runs.push({ text: text.slice(last, idx), style: "regular" });
    const v = values[m[1]];
    if (!v) throw new Error(`no value for {{${m[1]}}}`);
    if (v.text) runs.push({ text: v.text, style: v.missing ? "missing" : "regular" });
    last = idx + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), style: "regular" });
  return runs;
}
export const runsText = (runs: Run[]): string => runs.map((r) => r.text).join("");
export function mergeText(text: string, values: Record<string, TagValue>, allowed: string[]): string {
  return runsText(mergeRuns(text, values, allowed));
}

// ---------------------------------------------------------------------------
// Settings as printed (privacy block, opt-out line, sender block)
// ---------------------------------------------------------------------------
export type Settings = {
  sender_type: "" | "company" | "individual";
  legal_sender_name: string;
  legal_sender_nif: string;
  return_name: string;
  return_street: string;
  return_postcode: string;
  return_city: string;
  contact_email: string;
  contact_whatsapp: string;
  privacy_url: string;
  print_spectrum: "grayscale" | "color";
  delivery_product: "cheap" | "fast" | "bulk" | "premium" | "registered";
  price_estimate_eur: number;
  max_price_per_letter: number;
  vat_rate: number;
  max_per_send: number;
  daily_cap: number;
  cooldown_days: number;
  optout_route_confirmed_at: string | null;
  optout_route_confirmed_by?: string | null;
  pingen_price?: number | null;
  pingen_currency?: string | null;
  pingen_checked_at?: string | null;
  updated_at?: string;
  updated_by?: string | null;
};

export const DEFAULT_SETTINGS: Settings = {
  sender_type: "", legal_sender_name: "", legal_sender_nif: "",
  return_name: "", return_street: "", return_postcode: "", return_city: "",
  contact_email: "support@massageclub.io", contact_whatsapp: "+34 612 474 827", privacy_url: "",
  print_spectrum: "grayscale", delivery_product: "cheap",
  price_estimate_eur: 0.97, max_price_per_letter: 3.0, vat_rate: 21,
  max_per_send: 20, daily_cap: 50, cooldown_days: 180,
  optout_route_confirmed_at: null,
};

export const NIF_RE = /^(?:[0-9XYZ][0-9]{7}[A-Z]|[A-HJ-NP-SUVW][0-9]{7}[0-9A-J])$/;
export const PRIVACY_URL_RE = /^https:\/\/(book\.)?massageclub\.io\/[A-Za-z0-9/_#?=.-]*$/;

// The fields that end up on paper. A change to any of them changes every
// letter's render inputs, so approvals are cleared.
export function printedSettings(s: Settings): Record<string, string> {
  return {
    sender_type: s.sender_type, legal_sender_name: s.legal_sender_name, legal_sender_nif: s.legal_sender_nif,
    return_street: s.return_street, return_postcode: s.return_postcode, return_city: s.return_city,
    contact_email: s.contact_email, contact_whatsapp: s.contact_whatsapp, privacy_url: s.privacy_url,
    print_spectrum: s.print_spectrum,
  };
}

export function senderName(s: Settings): string {
  const n = squash(nfc(s.legal_sender_name));
  if (!n) return "";
  if (s.sender_type === "individual" && !/massage club/i.test(n)) return `${n}, que opera como Massage Club`;
  return n;
}

export function tagValues(s: Settings): Record<string, TagValue> {
  const miss = (k: keyof typeof MISSING): TagValue => ({ text: MISSING[k].es, missing: true });
  const name = senderName(s);
  const nif = squash(nfc(s.legal_sender_nif)).toUpperCase();
  const street = squash(nfc(s.return_street)), pc = squash(nfc(s.return_postcode)), city = squash(nfc(s.return_city));
  return {
    remitente: name && s.sender_type ? { text: name } : miss("remitente"),
    nif: nif ? { text: `, NIF ${nif}` } : s.sender_type === "company" ? { text: `, ${MISSING.nif.es}`, missing: true } : { text: "" },
    direccion_remitente: street && pc && city ? { text: `${street}, ${pc} ${city}` } : miss("direccion_remitente"),
    email_contacto: s.contact_email ? { text: s.contact_email } : miss("email_contacto"),
    whatsapp: s.contact_whatsapp ? { text: s.contact_whatsapp } : miss("whatsapp"),
    privacidad_url: s.privacy_url ? { text: s.privacy_url } : miss("privacidad_url"),
  };
}

export function settingsMissing(s: Settings): string[] {
  const out: string[] = [];
  if (!s.sender_type) out.push("Legal sender type (company or individual) is not set.");
  if (!squash(s.legal_sender_name || "")) out.push("Legal sender name is empty.");
  if (s.sender_type === "company" && !squash(s.legal_sender_nif || "")) out.push("A company sender needs its NIF.");
  if (!squash(s.return_street || "") || !squash(s.return_postcode || "") || !squash(s.return_city || "")) out.push("Return postal address is incomplete (street, postcode and town).");
  if (!s.privacy_url) out.push("Privacy page URL on massageclub.io is empty.");
  if (!s.contact_email) out.push("Contact email is empty.");
  if (!s.contact_whatsapp) out.push("Contact WhatsApp is empty.");
  return out;
}

const SETTINGS_TEXT = ["legal_sender_name", "legal_sender_nif", "return_name", "return_street", "return_postcode", "return_city", "contact_email", "contact_whatsapp", "privacy_url"];
const SETTINGS_NUM: Record<string, [number, number]> = {
  price_estimate_eur: [0.01, 10], max_price_per_letter: [0.01, 10], vat_rate: [0, 50],
  max_per_send: [1, 200], daily_cap: [1, 500], cooldown_days: [30, 3650],
};
// Validates a settings patch from the page. Never rewrites what Jordan typed
// beyond trimming; a dash or a bad format is an error he sees.
export function validateSettingsPatch(patch: Record<string, unknown>): { ok: boolean; errors: Problem[]; clean: Partial<Settings> } {
  const errors: Problem[] = [];
  const clean: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(patch || {})) {
    if (SETTINGS_TEXT.includes(k)) {
      const v = squash(nfc(raw));
      if (DASH_RE.test(v)) { errors.push({ field: k, code: "dash", message: "No long dashes (en dash or em dash) in letter copy." }); continue; }
      if (v.length > 120) { errors.push({ field: k, code: "too_long", message: "At most 120 characters." }); continue; }
      if (/[{}<>]/.test(v)) { errors.push({ field: k, code: "bad_chars", message: "Braces and angle brackets are not allowed." }); continue; }
      clean[k] = v;
    } else if (k in SETTINGS_NUM) {
      const n = Number(raw);
      const [lo, hi] = SETTINGS_NUM[k];
      if (!Number.isFinite(n) || n < lo || n > hi) { errors.push({ field: k, code: "range", message: `Must be a number from ${lo} to ${hi}.` }); continue; }
      clean[k] = ["max_per_send", "daily_cap", "cooldown_days"].includes(k) ? Math.round(n) : Math.round(n * 100) / 100;
    } else if (k === "sender_type") {
      if (!["", "company", "individual"].includes(String(raw))) errors.push({ field: k, code: "enum", message: "Company or individual." });
      else clean[k] = String(raw);
    } else if (k === "print_spectrum") {
      if (!["grayscale", "color"].includes(String(raw))) errors.push({ field: k, code: "enum", message: "Grayscale or colour." });
      else clean[k] = String(raw);
    } else if (k === "delivery_product") {
      if (!["cheap", "fast", "bulk", "premium", "registered"].includes(String(raw))) errors.push({ field: k, code: "enum", message: "Unknown delivery product." });
      else clean[k] = String(raw);
    } else {
      errors.push({ field: k, code: "unknown_field", message: `${k} cannot be changed here.` });
    }
  }
  if (typeof clean.legal_sender_nif === "string" && clean.legal_sender_nif) {
    const nif = String(clean.legal_sender_nif).toUpperCase().replace(/[\s.-]/g, "");
    if (!NIF_RE.test(nif)) errors.push({ field: "legal_sender_nif", code: "nif", message: "That is not a NIF/NIE/CIF format (8 digits and a letter, X/Y/Z + 7 digits + letter, or a company letter + 7 digits + check)." });
    else clean.legal_sender_nif = nif;
  }
  if (typeof clean.return_postcode === "string" && clean.return_postcode && !/^[0-9]{5}$/.test(String(clean.return_postcode))) {
    errors.push({ field: "return_postcode", code: "postcode", message: "Postcode is 5 digits." });
  }
  if (typeof clean.privacy_url === "string" && clean.privacy_url && !PRIVACY_URL_RE.test(String(clean.privacy_url))) {
    errors.push({ field: "privacy_url", code: "privacy_url", message: "The privacy page must be on https://massageclub.io or https://book.massageclub.io." });
  }
  if (typeof clean.contact_email === "string" && clean.contact_email && !/^[a-z0-9._%+-]+@massageclub\.io$/i.test(String(clean.contact_email))) {
    errors.push({ field: "contact_email", code: "contact_email", message: "The contact email printed for studios must be a massageclub.io address." });
  }
  if (typeof clean.contact_whatsapp === "string" && clean.contact_whatsapp && !/^\+[0-9 ]{8,20}$/.test(String(clean.contact_whatsapp))) {
    errors.push({ field: "contact_whatsapp", code: "contact_whatsapp", message: "WhatsApp as +34 612 474 827." });
  }
  return { ok: errors.length === 0, errors, clean: clean as Partial<Settings> };
}

// ---------------------------------------------------------------------------
// Template validation (8.1 to 8.4)
// ---------------------------------------------------------------------------
export const LIMITS = { body: 1600, greeting: 60, privacy: 1300, optout: 220, caption: 40 };
// Words that only the approved fee sentence may contain. "gratis" is checked in
// the body, greeting and privacy text but not in the opt-out line, whose
// "Es gratis y no hace falta dar motivos" is about writing BAJA, not the fee.
const FEE_WORDS = ["eur", "euro", "euros", "iva", "sin coste", "cuota", "cuotas", "comisión", "comision", "comisiones", "tarifa", "tarifas", "descuento", "descuentos", "banco", "bancos", "bancaria", "bancario", "iban"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "setiembre", "octubre", "noviembre", "diciembre"];
const FEE_WORD_RE = wordRe(FEE_WORDS);
const GRATIS_RE = wordRe(["gratis", "gratuito", "gratuita"]);
const MONTH_RE = wordRe(MONTHS);
const YEAR_RE = /(?<![0-9])20[0-9]{2}(?![0-9])/;

export function feeWordProblems(field: string, text: string, opts: { allowGratis?: boolean } = {}): Problem[] {
  const out: Problem[] = [];
  const t = nfc(text);
  if (/[€%]/.test(t)) out.push({ field, code: "fee_word", message: `"${t.match(/[€%]/)?.[0]}" may only appear in the approved fee sentence.` });
  const w = t.match(FEE_WORD_RE);
  if (w) out.push({ field, code: "fee_word", message: `"${w[0]}" may only appear in the approved fee sentence.` });
  if (!opts.allowGratis) {
    const g = t.match(GRATIS_RE);
    if (g) out.push({ field, code: "fee_word", message: `"${g[0]}" may only appear in the approved fee sentence.` });
  }
  const y = t.match(YEAR_RE);
  if (y) out.push({ field, code: "fee_date", message: `A year (${y[0]}) may only appear in the approved fee sentence.` });
  const m = t.match(MONTH_RE);
  if (m) out.push({ field, code: "fee_date", message: `A month name ("${m[0]}") may only appear in the approved fee sentence.` });
  return out;
}

// The fee guard: body_es must hold exactly one approved fee sentence, and
// nothing else in the letter may talk about money or dates.
export function feeGuard(bodyEs: string, others: { field: string; text: string; allowGratis?: boolean }[] = []): { ok: boolean; version: string | null; errors: Problem[] } {
  const body = squash(nfc(bodyEs));
  const errors: Problem[] = [];
  let version: string | null = null;
  let rest = body;
  for (const [v, s] of Object.entries(FEE_SENTENCES)) {
    const sent = squash(s.es);
    const n = body.split(sent).length - 1;
    if (n === 1) { version = v; rest = body.replace(sent, " "); break; }
    if (n > 1) { errors.push({ field: "body_es", code: "fee_twice", message: "The fee sentence appears more than once." }); version = v; rest = body.split(sent).join(" "); break; }
  }
  if (!version) {
    errors.push({ field: "body_es", code: "fee_sentence", message: "The fee sentence is not the approved wording. Use the wording from the /socios terms: \"" + FEE_SENTENCES["2026-10-19"].es + "\" (English: \"" + FEE_SENTENCES["2026-10-19"].en + "\")." });
  }
  errors.push(...feeWordProblems("body_es", rest));
  for (const o of others) errors.push(...feeWordProblems(o.field, o.text, { allowGratis: o.allowGratis }));
  return { ok: errors.length === 0, version, errors };
}

// Every printed link must be on massageclub.io.
export function linkProblems(field: string, text: string): Problem[] {
  const out: Problem[] = [];
  const t = nfc(text);
  for (const m of t.matchAll(/https?:\/\/([^\s/?#]+)/gi)) {
    const host = m[1].toLowerCase().replace(/[.,;:)]+$/, "");
    if (host !== "massageclub.io" && host !== "book.massageclub.io") out.push({ field, code: "link_host", message: `Links printed for studios must be on massageclub.io (found ${host}).` });
  }
  for (const m of t.matchAll(/(?<![\w@./-])((?:[a-z0-9-]+\.)+io)\//gi)) {
    const host = m[1].toLowerCase();
    if (host !== "massageclub.io" && host !== "book.massageclub.io") out.push({ field, code: "link_host", message: `Links printed for studios must be on massageclub.io (found ${host}).` });
  }
  return out;
}

const TEMPLATE_FIELDS: [keyof Template, string[], number, boolean][] = [
  ["body_es", TAGS.body, LIMITS.body, true],
  ["optout_es", TAGS.optout, LIMITS.optout, true],
  ["privacy_es", TAGS.privacy, LIMITS.privacy, true],
  ["qr_caption_es", TAGS.caption, LIMITS.caption, true],
  ["body_en", TAGS.body, 4000, false],
  ["optout_en", TAGS.optout, 1000, false],
  ["privacy_en", TAGS.privacy, 4000, false],
  ["qr_caption_en", TAGS.caption, 200, false],
];

export type TemplateCheck = { ok: boolean; errors: Problem[]; warnings: Problem[]; fee_version: string | null };

// hasGlyph: when given (render time), every printed character must exist in
// the font used for it.
export function validateTemplate(t: Partial<Template>, opts: { hasGlyph?: (cp: number) => boolean } = {}): TemplateCheck {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  for (const [f, tags, max, printed] of TEMPLATE_FIELDS) {
    const raw = (t as Record<string, unknown>)[f];
    if (typeof raw !== "string" || (printed && !raw.trim())) {
      if (printed) errors.push({ field: f, code: "missing", message: `${f} is empty.` });
      continue;
    }
    const v = nfc(raw);
    if (DASH_RE.test(v)) errors.push({ field: f, code: "dash", message: "No long dashes (en dash or em dash). Use a comma, a colon or a full stop." });
    if (v.length > max) errors.push({ field: f, code: "too_long", message: `At most ${max} characters (now ${v.length}).` });
    errors.push(...tagProblems(f, v, tags));
    if (printed) {
      errors.push(...linkProblems(f, v));
      if (INVISIBLE_RE.test(v)) errors.push({ field: f, code: "control_chars", message: "Invisible or control characters are not allowed." });
      if (opts.hasGlyph) {
        const bad = [...new Set([...v.replace(TAG_RE, "")].filter((c) => c !== "\n" && !opts.hasGlyph!(c.codePointAt(0)!)))];
        if (bad.length) errors.push({ field: f, code: "no_glyph", message: `The font cannot print: ${bad.join(" ")}` });
      }
    }
  }
  const body = nfc(t.body_es || "");
  if (body && !squash(body).endsWith(SIGN_OFF)) errors.push({ field: "body_es", code: "sign_off", message: `The letter must end with "${SIGN_OFF}".` });
  if (body && !body.includes("{{nombre}}")) warnings.push({ field: "body_es", code: "no_name", message: "The letter does not use {{nombre}}, so every studio gets the same greeting." });
  const optout = nfc(t.optout_es || "");
  if (optout && (!/\bBAJA\b/.test(optout) || !(optout.includes("{{whatsapp}}") || optout.includes("{{email_contacto}}")))) {
    errors.push({ field: "optout_es", code: "optout_route", message: "The opt-out line must say BAJA and give {{whatsapp}} or {{email_contacto}}." });
  }
  const privacy = nfc(t.privacy_es || "");
  if (privacy) {
    for (const tag of ["remitente", "direccion_remitente", "email_contacto", "privacidad_url"]) {
      if (!privacy.includes(`{{${tag}}}`)) errors.push({ field: "privacy_es", code: "privacy_tag", message: `The privacy block must name {{${tag}}} (GDPR art. 14).` });
    }
    if (!/aepd/i.test(privacy)) errors.push({ field: "privacy_es", code: "privacy_aepd", message: "The privacy block must say studios can complain to the AEPD." });
  }
  const fee = feeGuard(body, [
    { field: "optout_es", text: optout, allowGratis: true },
    { field: "privacy_es", text: privacy },
    { field: "qr_caption_es", text: nfc(t.qr_caption_es || "") },
  ]);
  errors.push(...fee.errors);
  return { ok: errors.length === 0, errors, warnings, fee_version: fee.version };
}

// Marks the English as stale when a Spanish field changed and its English did
// not (the page then says "English not updated since you changed the Spanish").
export function markStale(prev: Template, next: Template): Template {
  const out = { ...next };
  const pairs: [keyof Template, keyof Template, keyof Template][] = [
    ["body_es", "body_en", "body_en_stale"], ["optout_es", "optout_en", "optout_en_stale"], ["privacy_es", "privacy_en", "privacy_en_stale"],
  ];
  for (const [es, en, stale] of pairs) {
    const esChanged = nfc(prev[es]) !== nfc(next[es]);
    const enChanged = nfc(prev[en]) !== nfc(next[en]);
    (out as Record<string, unknown>)[stale] = esChanged && !enChanged ? true : enChanged ? false : !!prev[stale];
  }
  return out;
}

export function cleanTemplate(t: Record<string, unknown>, base: Template): Template {
  const out = { ...base } as Record<string, unknown>;
  for (const k of Object.keys(base)) {
    if (k === "version") continue;
    if (k.endsWith("_stale")) continue;
    if (typeof t[k] === "string") out[k] = nfc(t[k]);
  }
  out.version = 1;
  return out as Template;
}

// The greeting printed as {{nombre}}.
export function greetingProblems(g: string): Problem[] {
  const v = nfc(g);
  const out: Problem[] = [];
  if (!squash(v)) out.push({ field: "greeting_name", code: "missing", message: "The greeting name is empty." });
  if (v.length > LIMITS.greeting) out.push({ field: "greeting_name", code: "too_long", message: `At most ${LIMITS.greeting} characters.` });
  if (DASH_RE.test(v)) out.push({ field: "greeting_name", code: "dash", message: "No long dashes (en dash or em dash)." });
  if (/[{}\n<>]/.test(v)) out.push({ field: "greeting_name", code: "bad_chars", message: "No braces, angle brackets or line breaks." });
  out.push(...feeWordProblems("greeting_name", v));
  out.push(...linkProblems("greeting_name", v));
  return out;
}

// ---------------------------------------------------------------------------
// Addresses (Pingen + Hispapost/Correos rules, 5.8)
// ---------------------------------------------------------------------------
export const ADDRESS_LINE_MAX = 42;
export const ADDRESS_LINE_HARD = 45;
// Pingen accepts 3 to 7 lines; at 9 pt (the smallest step) only 5 fit inside
// the window area, so the list import allows at most 5.
export const ADDRESS_LINES_MAX = 5;
const ADDR_OK_RE = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž0-9 .,\/ºª'-]+$/;
const ADDR_FORBIDDEN = ["&", "(", ")", "!", "?", "#", "§", '"', "“", "”", "«", "»", EN_DASH, EM_DASH, "¿", "¡"];
const COUNTRY_RE = wordRe(["españa", "espana", "spain", "spanien", "espagne"]);

export function validateAddressLines(linesIn: string[], postcode: string, town: string): { ok: boolean; lines: string[]; errors: Problem[]; warnings: Problem[] } {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const lines = linesIn.map((l) => squash(nfc(l))).filter(Boolean);
  if (lines.length < 3) errors.push({ code: "too_few_lines", message: `An address needs at least 3 lines (has ${lines.length}).` });
  if (lines.length > ADDRESS_LINES_MAX) errors.push({ code: "too_many_lines", message: `At most ${ADDRESS_LINES_MAX} lines fit in the envelope window (has ${lines.length}).` });
  lines.forEach((l, i) => {
    const n = i + 1;
    if (l.length > ADDRESS_LINE_HARD) errors.push({ code: "line_too_long", message: `Line ${n} has ${l.length} characters (at most ${ADDRESS_LINE_MAX}).` });
    else if (l.length > ADDRESS_LINE_MAX) warnings.push({ code: "line_long", message: `Line ${n} has ${l.length} characters (aim for ${ADDRESS_LINE_MAX} or fewer).` });
    const bad = ADDR_FORBIDDEN.filter((c) => l.includes(c));
    if (bad.length) errors.push({ code: "forbidden_chars", message: `Line ${n} has characters the post office does not accept: ${bad.join(" ")}` });
    else if (!ADDR_OK_RE.test(l)) errors.push({ code: "bad_chars", message: `Line ${n} has characters other than Latin letters, digits and . , / º ª ' -` });
    if (/[.,;:-]$/.test(l)) errors.push({ code: "trailing_punct", message: `Line ${n} ends with punctuation.` });
    if (COUNTRY_RE.test(l)) errors.push({ code: "country_line", message: `Line ${n} names a country: domestic letters carry no country line.` });
    if (/\bES-/i.test(l)) errors.push({ code: "es_prefix", message: `Line ${n} has an ES- prefix.` });
  });
  const pc = squash(nfc(postcode)), tw = squash(nfc(town));
  if (!/^[0-9]{5}$/.test(pc)) errors.push({ code: "postcode", message: "Postcode must be 5 digits." });
  const last = lines[lines.length - 1] || "";
  if (!/^[0-9]{5} \S.*$/.test(last)) errors.push({ code: "town_line", message: "The last line must be the postcode, one space and the town (28004 Madrid)." });
  else if (last !== `${pc} ${tw}`) errors.push({ code: "town_mismatch", message: `The last line "${last}" does not match postcode and town "${pc} ${tw}".` });
  if (/^[0-9]{5}$/.test(pc) && !pc.startsWith("28")) warnings.push({ code: "outside_madrid", message: `Postcode ${pc} is outside the Madrid region.` });
  return { ok: errors.length === 0, lines, errors, warnings };
}

// Madrid city postcodes 28001 to 28055 go by Hispapost (research of 15 Nov);
// anything else goes by Correos and may cost more.
export const isHispapostPostcode = (pc: string): boolean => /^280[0-5][0-9]$/.test(pc) && Number(pc) >= 28001 && Number(pc) <= 28055;

// ---------------------------------------------------------------------------
// Mailing list CSV (7.2)
// ---------------------------------------------------------------------------
export const CSV_HEADER = ["id", "name", "line1", "line2", "line3", "line4", "line5", "postcode", "town", "unit_status", "confidence"];
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// RFC 4180: quoted fields, doubled quotes, CRLF or LF. Returns rows with the
// line number where each row starts.
export function parseCsv(text: string): { rows: { line: number; cells: string[] }[]; error?: string } {
  const rows: { line: number; cells: string[] }[] = [];
  const s = String(text ?? "").replace(new RegExp("^" + String.fromCharCode(0xfeff)), "");
  let i = 0, line = 1, rowStart = 1;
  let cells: string[] = [], cell = "", inQ = false, any = false;
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      if (c === "\n") line++;
      cell += c; i++; continue;
    }
    if (c === '"') { if (cell.length) return { rows, error: `Line ${line}: a quote inside an unquoted field.` }; inQ = true; any = true; i++; continue; }
    if (c === ",") { cells.push(cell); cell = ""; any = true; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") {
      cells.push(cell);
      if (any || cells.some((x) => x !== "")) rows.push({ line: rowStart, cells });
      cells = []; cell = ""; any = false; line++; rowStart = line; i++; continue;
    }
    cell += c; any = true; i++;
  }
  if (inQ) return { rows, error: `Line ${rowStart}: a quoted field is not closed.` };
  if (any || cell !== "" || cells.length) { cells.push(cell); if (cells.some((x) => x !== "")) rows.push({ line: rowStart, cells }); }
  return { rows };
}

export type ListRow = {
  line: number; kind: "studio" | "proof"; partner_id: string | null; name: string;
  address_lines: string[]; postcode: string; town: string; unit_status: string; confidence: string;
  warnings: Problem[];
};

// The verified mailing list as CSV (id, name, line1..line5, postcode, town,
// unit_status, confidence). All or nothing: every row error comes back with
// its CSV line number. Partner existence is checked by the caller (DB).
export function parseListCsv(text: string): { ok: boolean; rows: ListRow[]; errors: Problem[]; warnings: Problem[] } {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const out: ListRow[] = [];
  const p = parseCsv(text);
  if (p.error) return { ok: false, rows: [], errors: [{ code: "csv", message: p.error }], warnings };
  if (!p.rows.length) return { ok: false, rows: [], errors: [{ code: "empty", message: "The file is empty." }], warnings };
  const head = p.rows[0].cells.map((c) => c.trim().toLowerCase());
  if (head.join(",") !== CSV_HEADER.join(",")) {
    return { ok: false, rows: [], errors: [{ code: "header", line: p.rows[0].line, message: `The first line must be exactly: ${CSV_HEADER.join(",")}` }], warnings };
  }
  const seen = new Set<string>();
  let proofs = 0;
  for (const r of p.rows.slice(1)) {
    const c = r.cells;
    if (c.length !== CSV_HEADER.length) { errors.push({ code: "columns", line: r.line, message: `Line ${r.line}: ${c.length} columns, expected ${CSV_HEADER.length}.` }); continue; }
    const [idRaw, name, l1, l2, l3, l4, l5, postcode, town, unit, conf] = c.map((x) => nfc(x).trim());
    const id = idRaw.toLowerCase();
    const isProof = id === "proof";
    if (!isProof && !UUID_RE.test(id)) { errors.push({ code: "id", line: r.line, message: `Line ${r.line}: id "${idRaw}" is not a studio id (or "proof").` }); continue; }
    if (!isProof) {
      if (seen.has(id)) { errors.push({ code: "duplicate", line: r.line, message: `Line ${r.line}: studio ${id} appears twice.` }); continue; }
      seen.add(id);
    } else if (++proofs > 3) { errors.push({ code: "proofs", line: r.line, message: `Line ${r.line}: at most 3 proof addresses.` }); continue; }
    const a = validateAddressLines([l1, l2, l3, l4, l5], postcode, town);
    for (const e of a.errors) errors.push({ ...e, line: r.line, message: `Line ${r.line}: ${e.message}` });
    const w: Problem[] = a.warnings.map((x) => ({ ...x, line: r.line, message: `Line ${r.line}: ${x.message}` }));
    if (unit === "unit unknown") w.push({ code: "unit_unknown", line: r.line, message: `Line ${r.line}: floor or door unknown.` });
    if (conf && conf !== "high") w.push({ code: "medium_confidence", line: r.line, message: `Line ${r.line}: address confidence is ${conf}.` });
    if (a.lines[0] && a.lines[0].length > LIMITS.greeting) errors.push({ code: "name", line: r.line, message: `Line ${r.line}: the first line (the name) is longer than ${LIMITS.greeting} characters.` });
    warnings.push(...w);
    if (a.ok) out.push({ line: r.line, kind: isProof ? "proof" : "studio", partner_id: isProof ? null : id, name: squash(name), address_lines: a.lines, postcode: squash(postcode), town: squash(town), unit_status: unit, confidence: conf, warnings: w });
  }
  if (!errors.length && !out.length) errors.push({ code: "empty", message: "The file has a header but no rows." });
  return { ok: errors.length === 0, rows: errors.length ? [] : out, errors, warnings };
}

// ---------------------------------------------------------------------------
// Eligibility (7.3)
// ---------------------------------------------------------------------------
export type Partner = {
  id: string; business_name?: string | null; slug?: string | null; status?: string | null;
  opted_out_at?: string | null; outreach_status?: string | null; address?: string | null; slots_link_v?: number | null;
};
export type Recipient = {
  id: string; kind: "studio" | "proof"; partner_id: string | null; list_version?: string;
  display_name: string; greeting_name: string; address_lines: string[]; postcode: string; town: string;
  unit_status?: string; confidence?: string; partner_address_at_import?: string | null; needs_review?: string | null;
  active: boolean;
};
export type LetterLite = { id: string; campaign_id: string; status: string; submitted_at?: string | null; partner_id?: string | null };
export type Reason = { code: string; text: string };

export const TEST_STUDIO_RE = /\b(test|prueba)\b/i;
// "From approved to submitted": a letter in another open campaign in one of
// these states means the studio is already being written to.
export const IN_FLIGHT = ["approved", "uploading", "checking", "ready", "blocked", "sending", "submitted", "error"];

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", day: "numeric", month: "short", year: "numeric" }).format(d);
};
const addrKey = (s: unknown): string => squash(nfc(s)).toLowerCase();

const BUSINESS_WORDS = wordRe(["centro", "center", "centre", "spa", "estudio", "studio", "masaje", "masajes", "massage", "massages", "fisio", "fisioterapia", "physio", "clinica", "clínica", "clinic", "wellness", "salon", "salón", "quiromasaje", "terapia", "terapias", "therapy", "thai", "bienestar", "beauty", "belleza", "estetica", "estética", "osteopatia", "osteopatía", "yoga", "sala", "instituto", "gabinete", "health", "relax", "zen", "body", "care", "club", "house", "casa", "space", "espacio", "lounge", "home", "sl", "s.l", "sociedad"]);
export function greetingLooksLikePerson(g: string): boolean {
  const v = squash(nfc(g));
  if (BUSINESS_WORDS.test(v)) return false;
  return /^\p{Lu}[\p{Ll}']+(?: (?:de |del |la |y )?\p{Lu}[\p{Ll}']+){1,3}$/u.test(v);
}

export function eligibility(x: {
  recipient: Recipient | null; partner: Partner | null; letters: LetterLite[]; campaignStatus: Record<string, string>;
  cooldownDays: number; now: Date; selfLetterId?: string; greeting?: string;
}): { eligible: boolean; reasons: Reason[]; warnings: Reason[] } {
  const reasons: Reason[] = [];
  const warnings: Reason[] = [];
  const r = x.recipient, p = x.partner;
  if (!r || !r.active) reasons.push({ code: "not_in_list", text: "Not on the verified mailing list." });
  if (r && r.kind === "studio") {
    if (!p) reasons.push({ code: "not_in_list", text: "The studio is no longer in our records." });
    else {
      if (p.opted_out_at || p.outreach_status === "opted_out") reasons.push({ code: "opted_out", text: `Asked not to be contacted${p.opted_out_at ? ` (on ${fmtDate(p.opted_out_at)})` : ""}.` });
      if (p.status === "suspended" || p.status === "archived") reasons.push({ code: "not_writable", text: "Suspended or archived." });
      if (p.status === "active") reasons.push({ code: "already_partner", text: "Already a Massage Club partner." });
      if (p.outreach_status && ["rejected", "skipped_not_massage", "claimed", "bounced"].includes(p.outreach_status)) reasons.push({ code: "outreach_closed", text: `Closed in outreach (${p.outreach_status}).` });
      if (TEST_STUDIO_RE.test(String(p.business_name || "")) || TEST_STUDIO_RE.test(String(r.display_name || ""))) reasons.push({ code: "test_studio", text: "Test studio." });
      const cutoff = x.now.getTime() - x.cooldownDays * 86400e3;
      const recent = x.letters.filter((l) => l.id !== x.selfLetterId && l.submitted_at && new Date(l.submitted_at).getTime() >= cutoff)
        .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))[0];
      const inFlight = x.letters.find((l) => l.id !== x.selfLetterId && IN_FLIGHT.includes(l.status) && (x.campaignStatus[l.campaign_id] ?? "open") === "open");
      if (recent) reasons.push({ code: "recently_written", text: `Already written to on ${fmtDate(String(recent.submitted_at))}.` });
      else if (inFlight) reasons.push({ code: "recently_written", text: "Already in another campaign that is being posted." });
      if (r.partner_address_at_import != null && addrKey(p.address) !== addrKey(r.partner_address_at_import)) {
        reasons.push({ code: "address_changed", text: "Address changed in our records since the list was checked: re-check it." });
      }
    }
  }
  if (r && r.needs_review) reasons.push({ code: "needs_review", text: `Last letter came back: check the address (${r.needs_review}).` });
  if (r) {
    if (r.unit_status === "unit unknown") warnings.push({ code: "unit_unknown", text: "Floor or door unknown: the postman may not find the studio inside the building." });
    if (r.confidence && r.confidence !== "high") warnings.push({ code: "medium_confidence", text: `Address confidence is ${r.confidence}.` });
    const g = x.greeting ?? r.greeting_name;
    if (r.kind === "studio" && greetingLooksLikePerson(g)) warnings.push({ code: "greeting_looks_like_a_person", text: `"${g}" looks like a person's name: consider the greeting "Hola, ${g}:" instead of "equipo de".` });
    if (!isHispapostPostcode(r.postcode)) warnings.push({ code: "postcode_not_hispapost", text: `Postcode ${r.postcode} goes by Correos, not Hispapost: it may cost more.` });
  }
  const uniq = (a: Reason[]) => a.filter((v, i) => a.findIndex((w) => w.code === v.code) === i);
  return { eligible: reasons.length === 0, reasons: uniq(reasons), warnings: uniq(warnings) };
}

// ---------------------------------------------------------------------------
// Letter state machine (10.5): the only place transitions are allowed.
// Additions to the spec's diagram, each for a failure path:
//   uploading -> approved   the upload or create failed before Pingen held a letter
//   uploading -> error      the create call's outcome is unknown
//   checking  -> withdrawn  opt-out while Pingen validates (the letter is DELETEd)
// ---------------------------------------------------------------------------
export const STATUSES = ["draft", "review", "approved", "rejected", "withdrawn", "uploading", "checking", "ready", "blocked", "sending", "submitted", "sent", "delivered", "undeliverable", "unprintable", "cancelled", "error"];
export const TRANSITIONS: Record<string, string[]> = {
  draft: ["review", "withdrawn"],
  review: ["approved", "rejected", "withdrawn", "review"],
  approved: ["review", "uploading", "withdrawn"],
  rejected: ["review", "withdrawn"],
  uploading: ["checking", "approved", "error"],
  checking: ["ready", "blocked", "error", "withdrawn"],
  ready: ["sending", "approved", "review", "withdrawn"],
  blocked: ["approved", "review", "withdrawn"],
  sending: ["submitted", "error"],
  submitted: ["sent", "unprintable", "cancelled", "submitted"],
  sent: ["delivered", "undeliverable"],
  error: ["checking", "submitted", "review"],
  withdrawn: [], delivered: [], undeliverable: [], unprintable: [], cancelled: [],
};
export const canTransition = (from: string, to: string): boolean => (TRANSITIONS[from] || []).includes(to);
// Letters in these states are with Pingen (or may be): settings and template
// changes are refused while any letter is in one of them.
export const IN_PINGEN = ["uploading", "checking", "ready", "blocked", "sending", "error"];
export const POSTED = ["submitted", "sent", "delivered", "undeliverable", "unprintable"];
export const EDITABLE = ["draft", "review", "approved", "rejected"];

// ---------------------------------------------------------------------------
// Money (cents, never floats), dates, ref codes, canonical JSON
// ---------------------------------------------------------------------------
export const toCents = (eur: number): number => Math.round(Number(eur) * 100);
export const fmtEur = (cents: number): string => (cents / 100).toFixed(2);
export function costEstimate(unitPricesEur: number[], vatRate: number): { count: number; net_cents: number; vat_cents: number; gross_cents: number; text: string } {
  const net = unitPricesEur.reduce((a, p) => a + toCents(p), 0);
  const vat = Math.round((net * Number(vatRate)) / 100);
  const n = unitPricesEur.length;
  return { count: n, net_cents: net, vat_cents: vat, gross_cents: net + vat, text: `${n} letter${n === 1 ? "" : "s"}, about ${fmtEur(net)} EUR + ${Number(vatRate)}% IVA = ${fmtEur(net + vat)} EUR` };
}

// Start of today in Madrid, as a UTC instant (daily cap).
export function madridDayStart(now: Date): Date {
  const parts = (d: Date) => {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d);
    const g = (t: string) => Number(f.find((x) => x.type === t)?.value);
    return { y: g("year"), m: g("month"), d: g("day"), h: g("hour"), mi: g("minute"), s: g("second") };
  };
  const a = parts(now);
  const offset = Date.UTC(a.y, a.m - 1, a.d, a.h, a.mi, a.s) - Math.floor(now.getTime() / 1000) * 1000;
  let guess = Date.UTC(a.y, a.m - 1, a.d) - offset;
  const b = parts(new Date(guess));
  const offset2 = Date.UTC(b.y, b.m - 1, b.d, b.h, b.mi, b.s) - guess;
  guess = Date.UTC(a.y, a.m - 1, a.d) - offset2;
  return new Date(guess);
}

export const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REF_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
// Six characters from a 31-letter alphabet without 0 O 1 I L, by rejection
// sampling so every character is equally likely.
export function refCode(randomBytes: (n: number) => Uint8Array): string {
  let out = "";
  while (out.length < 6) {
    for (const b of randomBytes(16)) {
      if (b < 248 && out.length < 6) out += REF_ALPHABET[b % 31];
    }
  }
  return out;
}
export function refCodes(n: number, taken: Set<string>, randomBytes: (n: number) => Uint8Array): string[] {
  const out: string[] = [];
  let guard = 0;
  while (out.length < n) {
    if (++guard > n * 50 + 100) throw new Error("could not make unique reference codes");
    const c = refCode(randomBytes);
    if (!taken.has(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

export const spanishTemplate = (t: Template) => ({ body_es: nfc(t.body_es), optout_es: nfc(t.optout_es), privacy_es: nfc(t.privacy_es), qr_caption_es: nfc(t.qr_caption_es) });
