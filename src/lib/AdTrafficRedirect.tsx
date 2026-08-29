import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const AD_PARAMS = ["gclid", "gbraid", "wbraid", "gad_source"];

/**
 * Paid ad clicks that still land on discovery pages (ads whose final URL was
 * never updated) are bounced to the /start booking flow instead. Replace
 * navigation so Back does not loop. Organic/direct visits are untouched.
 */
export default function AdTrafficRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    const isAdLanding =
      path === "/" || path === "/studios" || path === "/massages" || path.startsWith("/massages/");
    if (!isAdLanding) return;
    const params = new URLSearchParams(location.search);
    if (!AD_PARAMS.some((p) => params.get(p))) return;
    params.set("src", "google");
    navigate(`/start?${params.toString()}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}
