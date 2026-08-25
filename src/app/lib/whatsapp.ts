// Small shared helper for building wa.me links.
export function digitsOnly(input?: string | null): string {
  if (!input) return "";
  return input.replace(/[^\d]/g, "");
}

// Spanish mobile numbers start with 6 or 7 (after the +34 country code). Landlines start 8/9.
export function isWhatsappCapable(number?: string | null): boolean {
  const d = digitsOnly(number);
  if (!d) return false;
  const national = d.length > 9 ? d.slice(-9) : d;   // drop 34 country code if present
  return /^[67]/.test(national);
}

/** Normalise to the digits wa.me expects: strip everything, prefix 34 for 9-digit numbers. */
export function waDigits(number?: string | null): string {
  const d = digitsOnly(number);
  if (!d) return "";
  return d.length === 9 ? `34${d}` : d;
}

export type WhatsappSource = {
  whatsapp?: string | null;
  phone?: string | null;
};

/**
 * The number we can actually message.
 * Prefer the explicit `whatsapp` column; fall back to `phone` only when it
 * looks like a Spanish mobile (34 6…, 34 7…, 6…, 7…).
 */
export function resolveWhatsappNumber(p?: WhatsappSource | null): string | null {
  if (!p) return null;
  const wa = waDigits(p.whatsapp);
  if (wa) return wa;
  if (isWhatsappCapable(p.phone)) {
    const phone = waDigits(p.phone);
    if (phone) return phone;
  }
  return null;
}

export function hasWhatsapp(p?: WhatsappSource | null): boolean {
  return resolveWhatsappNumber(p) != null;
}

export function studioWhatsappUrl(number?: string | null, message = ""): string | null {
  const digits = waDigits(number);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/* ─────────── Concierge model ───────────
 * Every CLIENT-facing WhatsApp CTA opens a chat with Massage Club, never with
 * the studio. We arrange the booking on the client's behalf.
 */
export const MASSAGE_CLUB_WA = "34612474827";
export const MASSAGE_CLUB_WA_DISPLAY = "+34 612 474 827";

/** wa.me link to the Massage Club concierge number. Always returns a link. */
export function conciergeWhatsappUrl(message = ""): string {
  return `https://wa.me/${MASSAGE_CLUB_WA}?text=${encodeURIComponent(message)}`;
}

const LANG_NAMES_EN: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  it: "Italian", pt: "Portuguese", zh: "Chinese",
};
const LANG_NAMES_ES: Record<string, string> = {
  en: "inglés", es: "español", fr: "francés", de: "alemán",
  it: "italiano", pt: "portugués", zh: "chino",
};

function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

export type ConciergePrefill = {
  lang?: string | null;          // "es" → Spanish message, anything else → English
  studio: string;
  service?: string | null;
  duration?: number | null;
  price?: number | null;
  when?: string | null;          // human readable day/time selections
  name?: string | null;          // first name if known
  languages?: string[] | null;   // spoken language codes
};

/**
 * The prefilled message the client sends to Massage Club.
 * Only includes the fields we actually know; the minimum viable message is
 * "Hi Massage Club! I'd like to book at {studio}."
 */
export function conciergePrefill(p: ConciergePrefill): string {
  const es = String(p.lang || "").slice(0, 2).toLowerCase() === "es";
  const firstName = (p.name || "").trim().split(/\s+/)[0] || "";
  const meta: string[] = [];
  if (p.duration && Number(p.duration) > 0) meta.push(`${Number(p.duration)} min`);
  if (p.price != null && Number(p.price) > 0) meta.push(`${Number(p.price)}€`);
  const serviceLabel = p.service
    ? meta.length ? `${p.service} (${meta.join(", ")})` : String(p.service)
    : "";

  const langCodes = (p.languages || []).filter(Boolean);
  const langNames = langCodes
    .map((c) => (es ? LANG_NAMES_ES[c] : LANG_NAMES_EN[c]))
    .filter(Boolean) as string[];

  const parts: string[] = [];
  if (es) {
    parts.push(
      serviceLabel
        ? `¡Hola Massage Club! Me gustaría reservar ${serviceLabel} en ${p.studio}.`
        : `¡Hola Massage Club! Me gustaría reservar en ${p.studio}.`
    );
    if (p.when) parts.push(`Preferencia: ${p.when}.`);
    if (firstName) parts.push(`Me llamo ${firstName}.`);
    if (langNames.length) parts.push(`Hablo ${joinList(langNames, "y")}.`);
  } else {
    parts.push(
      serviceLabel
        ? `Hi Massage Club! I'd like a ${serviceLabel} at ${p.studio}.`
        : `Hi Massage Club! I'd like to book at ${p.studio}.`
    );
    if (p.when) parts.push(`Preferred: ${p.when}.`);
    if (firstName) parts.push(`My name is ${firstName}.`);
    if (langNames.length) parts.push(`I speak ${joinList(langNames, "and")}.`);
  }
  return parts.join(" ");
}



/**
 * The one helper every tel: link in the app should use.
 * Strips spaces and punctuation, prefixes +34 for 9-digit Spanish numbers.
 */
export function telHref(number?: string | null): string | null {
  const digits = waDigits(number);
  if (!digits) return null;
  return `tel:+${digits}`;
}


export type WhatsappPrefill = {
  studio: string;
  service?: string | null;   // SPANISH service name — the studio reads Spanish
  duration?: number | null;
  price?: number | null;
  date?: string | null;      // already formatted for humans
  time?: string | null;
  name?: string | null;
};

const NO_SPANISH = "Todavía no hablo español.";
const ENGLISH_OFFER = "Si habláis inglés, decídmelo y sigo en inglés 🙏";

/**
 * Spanish prefill for the "Ask on WhatsApp" button.
 * Fills only what the visitor has actually chosen; falls back to a generic
 * enquiry when nothing is selected yet.
 */
export function whatsappPrefill(p: WhatsappPrefill): string {
  const bits: string[] = [];
  if (p.service) {
    const meta: string[] = [];
    if (p.duration && Number(p.duration) > 0) meta.push(`${Number(p.duration)} min`);
    if (p.price != null && Number(p.price) > 0) meta.push(`${Number(p.price)}€`);
    bits.push(meta.length ? `${p.service} (${meta.join(", ")})` : p.service);
  }
  if (p.date) bits.push(`el ${p.date}`);
  if (p.time) bits.push(`a las ${p.time}`);
  if (p.name?.trim()) bits.push(`a nombre de ${p.name.trim()}`);

  if (bits.length === 0) {
    return `¡Hola ${p.studio}! He visto vuestro estudio en Massage Club y me gustaría pedir una cita. ${NO_SPANISH} ${ENGLISH_OFFER}`;
  }

  return `¡Hola ${p.studio}! Me gustaría reservar: ${bits.join(" ")}. ${NO_SPANISH} ¿Me puedes confirmar con un "sí" o proponerme otra hora? ${ENGLISH_OFFER}`;
}
