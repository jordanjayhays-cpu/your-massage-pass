import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { logCampaignVisit, logSiteVisit } from "@/lib/siteVisit";

/**
 * Fires one pageview beacon per route view, including client-side navigations.
 * Must be rendered inside the router.
 */
export default function RouteTracker() {
  const location = useLocation();
  const last = useRef<string | null>(null);
  const initial = useRef(true);

  useEffect(() => {
    const path = location.pathname;
    if (last.current === path) return;
    last.current = path;
    // Fires on the first load AND on every client-side route change.
    logSiteVisit(path);
    if (initial.current) {
      initial.current = false;
      logCampaignVisit(path);
    }
  }, [location.pathname, location.search]);

  return null;
}

