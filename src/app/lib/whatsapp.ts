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
