import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { logSiteVisit } from "@/lib/siteVisit";

/**
 * Fires one pageview beacon per route view, including client-side navigations.
 * Must be rendered inside the router.
 */
export default function RouteTracker() {
  const location = useLocation();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname;
    if (last.current === path) return;
    last.current = path;
    logSiteVisit(path);
  }, [location.pathname]);

  return null;
}
