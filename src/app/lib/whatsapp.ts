// Small shared helper for building wa.me links.
export function digitsOnly(input?: string | null): string {
  if (!input) return "";
  return input.replace(/[^\d]/g, "");
}

export function studioWhatsappUrl(number?: string | null, message = ""): string | null {
  const digits = digitsOnly(number);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
