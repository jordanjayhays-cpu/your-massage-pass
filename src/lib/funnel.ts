import { trackEvent } from "@/lib/siteVisit";

/**
 * Funnel instrumentation helper.
 * Thin wrapper over trackEvent (site_events) that always stamps the page path
 * into meta and drops empty values, so funnel rows stay comparable.
 */
export function trackFunnel(
  event: string,
  meta: Record<string, unknown> = {},
  slug?: string | null,
): void {
  const clean: Record<string, unknown> = {
    path: typeof window !== "undefined" ? window.location.pathname : null,
  };
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null || v === "") continue;
    clean[k] = v;
  }
  trackEvent(event, { slug: slug ?? null, meta: clean });
}
