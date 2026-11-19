/**
 * Who runs Massage Club, for the privacy page (GDPR art. 13.1.a), the legal
 * notice (/legal, LSSI art. 10) and the footers. One place, so the pages can
 * never disagree.
 *
 * Source: CLAUDE.md, "Legal entity" (Jordan, 19 Nov 2026): "Kinsol LLC,
 * trading as Massage Club, 1500 N Grant St, Ste N, Denver, CO 80203, United
 * States", registered in Colorado, contact support@massageclub.io.
 *
 * Still to come from Jordan (a null here prints nothing, never a placeholder):
 *   entityId           the Colorado Secretary of State entity number
 *   taxId              the EIN, or a Spanish NIF if Kinsol LLC has one
 *   euRepresentative   the EU representative (GDPR art. 27): name and address.
 *                      The privacy page should not go live until it is set.
 */
export const LEGAL_ENTITY = {
  name: "Kinsol LLC",
  tradingAs: "Massage Club",
  street: "1500 N Grant St, Ste N",
  city: "Denver, CO 80203",
  country: { en: "United States", es: "Estados Unidos" },
  registered: {
    en: "a limited liability company registered in the State of Colorado, United States",
    es: "sociedad de responsabilidad limitada (LLC) registrada en el estado de Colorado, Estados Unidos",
  },
  email: "support@massageclub.io",
  website: "massageclub.io",
  entityId: null as string | null,
  taxId: null as string | null,
  euRepresentative: null as string | null,
} as const;

/** "1500 N Grant St, Ste N, Denver, CO 80203, United States" */
export function postalAddress(lang: "en" | "es"): string {
  return `${LEGAL_ENTITY.street}, ${LEGAL_ENTITY.city}, ${LEGAL_ENTITY.country[lang]}`;
}
