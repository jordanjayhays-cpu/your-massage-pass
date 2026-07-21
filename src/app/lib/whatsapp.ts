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

export function studioWhatsappUrl(number?: string | null, message = ""): string | null {
  const digits = digitsOnly(number);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
