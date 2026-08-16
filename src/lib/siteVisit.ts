import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Fire-and-forget site visit beacon: logs path + referrer to site_visits.
 * Silently ignores errors (table/policies may not exist in every environment).
 */
export function logSiteVisit(path: string) {
  try {
    void supabase
      .from("site_visits")
      .insert({
        path,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      })
      .then(
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
