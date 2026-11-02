/**
 * Site analytics: pageviews (site_visits) and named events (site_events),
 * both sent to the `track` edge function.
 *
 * How `track` stores events (deployed function, not in this repo):
 * - any event name is kept, cut to 40 characters;
 * - only the FIRST row per (day, visitor_key, event, path) is kept, so a step
 *   belongs in the event NAME, never only in `meta`;
 * - `site_events` has `day`, not `created_at`: weekly SQL groups on `day`.
 *
 * Every event's `meta` also gets `lang`, `host`, `vw` (xs/sm/md/lg) and
 * `v: "ds1"` here (the caller's own keys win). `meta` never carries names,
 * emails or phone numbers.
 *
 * Shared step events for every request flow (go.html, studio pages):
 *
 * | Event                               | Fires when                                         | Extra meta                                    |
 * |-------------------------------------|----------------------------------------------------|-----------------------------------------------|
 * | req_view                            | the first question renders, once per load          | src, ref, utm keys                            |
 * | req_answer_massage                  | a massage tile or studio service is tapped         | value (massage type / service name)           |
 * | req_answer_day / req_answer_time    | a day / a time is tapped                           | offset (days from today) / hour               |
 * | req_answer_when                     | day and time are both set (studio pages)           | offset                                        |
 * | req_answer_where                    | an area is tapped or the location is found         | area, or located: true                        |
 * | req_details_view                    | the details screen is shown the first time         | none                                          |
 * | req_submit_attempt                  | EVERY tap on Send, valid or not                    | invalid: field keys (name, email, phone)      |
 * | req_submit_ok / req_submit_error    | saved / failed                                     | request_id, has_phone, gender / error (120 ch)|
 * | wa_handoff                          | tap on the WhatsApp button after a request         | request_id, has_id                            |
 * | studio_view                         | unchanged; the studio-page denominator             |                                               |
 *
 * Every flow also sets meta.flow. Retired: go_view, go_step_*, go_submit_ok/error,
 * go_wa_tap, and wizard_step_${n} fired on mount.
 */
import { useEffect } from "react";

const TRACK_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/track";
const NT_KEY = "mc_nt";

/**
 * Reads ?nt=1 / ?nt=0 from the URL and persists the "do not track me" flag.
 * Returns true when the current visitor is excluded from analytics.
 */
export function isTrackingExcluded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nt = new URLSearchParams(window.location.search).get("nt");
    if (nt === "1") localStorage.setItem(NT_KEY, "1");
    else if (nt === "0") localStorage.removeItem(NT_KEY);
    return localStorage.getItem(NT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Fire-and-forget POST to the track endpoint. Never throws, never blocks. */
export function sendTrack(payload: Record<string, unknown>): void {
  if (isTrackingExcluded()) return;
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // text/plain keeps the beacon a "simple" request, so no CORS preflight
      // is needed and route-change beacons are not silently dropped.
      const ok = navigator.sendBeacon(TRACK_URL, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      if (ok) return;
    }
    void fetch(TRACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).then(
      () => undefined,
      () => undefined
    );
  } catch {
    /* ignore */
  }
}

/**
 * Named funnel event. Routed to site_events by the track function.
 * Respects the same opt-out logic as pageviews and never blocks the UI.
 */
export function trackEvent(
  event: string,
  opts?: { slug?: string | null; meta?: Record<string, unknown> }
): void {
  sendTrack({
    event,
    path: typeof window !== "undefined" ? window.location.pathname : "/",
    slug: opts?.slug ?? null,
    partner_slug: opts?.slug ?? null,
    meta: { ...eventContext(), ...(opts?.meta ?? {}) },
  });
}

/** Viewport bucket: xs < 400 px, sm < 768, md < 1200, else lg. */
export function viewportBucket(width: number): "xs" | "sm" | "md" | "lg" {
  if (width < 400) return "xs";
  if (width < 768) return "sm";
  if (width < 1200) return "md";
  return "lg";
}

/**
 * What every event carries so funnels can be split by language and device:
 * the page language (<html lang>), the host, a viewport bucket and the event
 * schema version. Never personal data.
 */
export function eventContext(): { lang?: string; host?: string; vw?: string; v: "ds1" } {
  const ctx: { lang?: string; host?: string; vw?: string; v: "ds1" } = { v: "ds1" };
  try {
    if (typeof document !== "undefined" && document.documentElement.lang) {
      ctx.lang = document.documentElement.lang;
    }
    if (typeof window !== "undefined") {
      ctx.host = window.location.hostname;
      if (typeof window.innerWidth === "number") ctx.vw = viewportBucket(window.innerWidth);
    }
  } catch {
    /* never let analytics break the page */
  }
  return ctx;
}


/**
 * Fire-and-forget pageview beacon.
 * Skipped entirely for visitors who opted out via ?nt=1 (localStorage "mc_nt").
 */
export function logSiteVisit(path: string) {
  sendTrack({
    path,
    ref: typeof document !== "undefined" ? document.referrer || null : null,
  });
}

/**
 * Fire-and-forget campaign attribution beacon.
 * Fires once per page load when utm_source or gclid is present.
 * Only whitelisted UTM params are sent; the raw query string is never forwarded.
 */
export function logCampaignVisit(path: string) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const gclid = params.has("gclid");
  const source = params.get("utm_source");
  if (!source && !gclid) return;

  sendTrack({
    event: "campaign_visit",
    path,
    meta: {
      ...eventContext(),
      source: source || "gclid",
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
      term: params.get("utm_term"),
      content: params.get("utm_content"),
      gclid,
    },
  });
}

export function useSiteVisit(path?: string) {
  useEffect(() => {
    const p = path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    logSiteVisit(p);
    logCampaignVisit(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}
