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
      const ok = navigator.sendBeacon(TRACK_URL, new Blob([body], { type: "application/json" }));
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
