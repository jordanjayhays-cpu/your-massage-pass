import { useEffect } from "react";

const TRACK_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/track";

/**
 * Fire-and-forget pageview beacon.
 * Posts {path, ref} to the public `track` edge function, which computes the day,
 * derives a privacy-safe hashed visitor_key server-side and writes with the
 * service role. Never throws, never blocks rendering.
 */
export function logSiteVisit(path: string) {
  try {
    const body = JSON.stringify({
      path,
      ref: typeof document !== "undefined" ? document.referrer || null : null,
    });
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

export function useSiteVisit(path?: string) {
  useEffect(() => {
    const p = path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    logSiteVisit(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}
