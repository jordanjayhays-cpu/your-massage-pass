import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";

// Hide the floating language toggle on screens that render their own prominently
// (Login already shows the large flag picker, Profile has it in-header).
const HIDE_LANG_PREFIXES = ["/partner", "/studio-setup", "/studio-portal", "/admin", "/claim"];
const HIDE_LANG_EXACT = new Set(["/", "/app", "/app/", "/app/profile", "/studios"]);
function shouldShowLangToggle(pathname: string) {
  if (HIDE_LANG_EXACT.has(pathname)) return false;
  if (HIDE_LANG_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return true;
}

/**
 * AppShell: full-bleed on mobile, full-width responsive layout on tablet/desktop.
 * No fake device frame — the content simply uses the available width.
 */
export function MobileFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const langVisible = shouldShowLangToggle(pathname);
  return (
    <div className="h-screen w-full bg-background flex flex-col relative overflow-hidden">
      {/* The tab bar is a real flex item, so every scroll area (and any sticky
          Save bar inside it) ends above the tabs instead of sliding under them. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* From 1280px up the shell uses the full viewport minus 32px of page
            padding per side, so the width goes into content, not margins. */}
        <div className="h-full w-full mx-auto md:max-w-5xl xl:max-w-none xl:px-8">
          {children}
        </div>
      </div>


      {langVisible && (
        <div className="absolute top-3 right-3 z-50 pointer-events-auto">
          <LanguageFlagToggle />
        </div>
      )}
      <BottomNav />
    </div>
  );
}
