/**
 * Build a Google Maps link that opens the studio's listing,
 * where users can read reviews and leave their own.
 */
export function googleReviewUrl(
  studioName: string,
  address?: string | null,
  opts?: { place_id?: string | null; google_review_url?: string | null }
): string {
  if (opts?.google_review_url) return opts.google_review_url;
  if (opts?.place_id) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(opts.place_id)}`;
  }
  const query = `${studioName} ${address ?? "Madrid"}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
