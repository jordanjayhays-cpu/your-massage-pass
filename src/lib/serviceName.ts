/**
 * Service naming helpers.
 *
 * Studios enter their menu in Spanish (`partner_services.name`). We added an
 * English column (`name_en`) so visitors can understand what they are booking.
 *
 * DISPLAY RULE: English first (primary line), Spanish underneath (muted).
 * If `name_en` is missing, we show the Spanish name alone — never an empty line.
 *
 * SENDING RULE: anything that reaches the studio (WhatsApp, email) must use
 * the SPANISH `name`. Never `name_en`. Use `serviceNameForStudio()` for that.
 */

export type ServiceLike = {
  name?: string | null;
  name_en?: string | null;
};

const clean = (v?: string | null) => (typeof v === "string" ? v.trim() : "");

/**
 * Primary line shown to the visitor: English when we have it, else Spanish.
 * With lang "es" the studio's own Spanish name comes first (one language per
 * label for Spanish visitors).
 */
export function servicePrimaryName(s: ServiceLike | null | undefined, fallback = "Massage", lang?: string): string {
  if (!s) return fallback;
  if (lang === "es") return clean(s.name) || clean(s.name_en) || fallback;
  return clean(s.name_en) || clean(s.name) || fallback;
}

/**
 * Secondary (muted) line: the Spanish name the studio actually uses.
 * Returns "" when there is no English name (the Spanish name is already the
 * primary line) or when both names are identical.
 */
export function serviceSecondaryName(s: ServiceLike | null | undefined, lang?: string): string {
  if (!s) return "";
  // Spanish visitors read the Spanish name alone.
  if (lang === "es") return "";
  const en = clean(s.name_en);
  const es = clean(s.name);
  if (!en || !es) return "";
  if (en.toLowerCase() === es.toLowerCase()) return "";
  return es;
}

/**
 * The name that goes INTO messages sent to the studio (WhatsApp, email).
 * Always the Spanish name — the studio must recognise it on their own menu.
 */
export function serviceNameForStudio(s: ServiceLike | null | undefined, fallback = "un masaje"): string {
  if (!s) return fallback;
  return clean(s.name) || clean(s.name_en) || fallback;
}

/** One-line label for compact places (dropdown options, cards). */
export function serviceInlineLabel(s: ServiceLike | null | undefined): string {
  const primary = servicePrimaryName(s, "");
  const secondary = serviceSecondaryName(s);
  if (!primary) return "";
  return secondary ? `${primary} (${secondary})` : primary;
}
