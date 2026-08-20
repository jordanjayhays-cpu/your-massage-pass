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

export function useSiteVisit(path?: string) {
  useEffect(() => {
    const p = path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    logSiteVisit(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}
