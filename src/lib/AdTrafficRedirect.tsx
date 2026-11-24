import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const AD_PARAMS = ["gclid", "gbraid", "wbraid", "gad_source"];

/**
 * Paid ad clicks that still land on discovery pages (ads whose final URL was
 * never updated) open the request flow (/reserve, public/go.html) with
 * src=google instead. A full page load, because /reserve is a static page
 * the React router cannot render; `replace` so Back does not loop.
 * Organic/direct visits are untouched.
 */
export default function AdTrafficRedirect() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const isAdLanding =
      path === "/" || path === "/studios" || path === "/massages" || path.startsWith("/massages/");
    if (!isAdLanding) return;
    const params = new URLSearchParams(location.search);
    if (!AD_PARAMS.some((p) => params.get(p))) return;
    params.set("src", "google");
    window.location.replace(`/reserve?${params.toString()}`);
  }, [location.pathname, location.search]);

  return null;
}
