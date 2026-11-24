/**
 * ONE canonical studio URL: book.massageclub.io/{slug}.
 *
 * Every link to a studio page goes through here. The partner id is only used
 * as a last resort when a studio has no slug yet, and /s/:id now redirects to
 * the slug URL, so no new /s/{id} links are ever generated.
 */
type StudioLike = {
  slug?: string | null;
  partner_id?: string | null;
  id?: string | null;
};

export function studioPath(studio: StudioLike | null | undefined): string {
  if (!studio) return "/studios";
  const key = (studio.slug || "").trim() || studio.partner_id || studio.id || "";
  return `/${key}`;
}

export function studioUrl(studio: StudioLike | null | undefined): string {
  return `https://book.massageclub.io${studioPath(studio)}`;
}
