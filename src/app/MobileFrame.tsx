import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteChromeDrawn } from "@/components/SiteChrome";

// Hide the floating language toggle on screens that render their own prominently
// (Login already shows the large flag picker, Profile has it in-header).
// From 900px it is always hidden: SiteHeader carries the language picker there.
const HIDE_LANG_PREFIXES = ["/partner", "/studio-setup", "/studio-portal", "/admin", "/claim"];
const HIDE_LANG_EXACT = new Set(["/", "/login", "/login/", "/app", "/app/", "/app/profile", "/studios"]);
function shouldShowLangToggle(pathname: string) {
  if (HIDE_LANG_EXACT.has(pathname)) return false;
  if (HIDE_LANG_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return true;
}

/**
 * App shell for every AppLayout route (/login, /studios, /discovery, /bookings,
 * /profile and their /app copies).
 *
 * Phones and tablets: full bleed, the screen scrolls inside, tab bar at the
 * bottom. Unchanged.
 *
 * From 900px (desktop fixes F1, F8, F11, F12):
 * - SiteHeader is the first flex item, above the scroller, so it stays put
 *   without being sticky; the tab bar is hidden (its links are in the header).
 * - The content sits in one centred column of at most 1120px, the same
 *   container as the header and footer. Screens add their own 20px gutter
 *   (px-5), so text starts at (width - 1120) / 2 + 20. There is no jump at
 *   1280px any more: the cap is the same from 768px up.
 * - SiteFooter closes the scroll area.
 *
 * `h-full` stays on the column: Discovery and Quiz pin their header and scroll
 * inside it.
 */
export function MobileFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const langVisible = shouldShowLangToggle(pathname);
  return (
    <div className="h-screen w-full bg-background flex flex-col relative overflow-hidden">
      <SiteHeader />
      {/* The tab bar is a real flex item, so every scroll area (and any sticky
          Save bar inside it) ends above the tabs instead of sliding under them. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="h-full w-full mx-auto md:max-w-page">
          <SiteChromeDrawn>{children}</SiteChromeDrawn>
          <SiteFooter className="mt-12" />
        </div>
      </div>

      {langVisible && (
        <div className="absolute top-3 right-3 z-50 pointer-events-auto desk:hidden">
          <LanguageFlagToggle />
        </div>
      )}
      <BottomNav />
    </div>
  );
}
