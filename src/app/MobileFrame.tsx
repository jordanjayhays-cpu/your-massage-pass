import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import BottomNav, { shouldShowBottomNav } from "./components/BottomNav";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";

// Hide the floating language toggle on screens that render their own prominently
// (Login already shows the large flag picker, Profile has it in-header).
const HIDE_LANG_PREFIXES = ["/partner", "/studio-setup", "/studio-portal", "/admin"];
const HIDE_LANG_EXACT = new Set(["/", "/app", "/app/", "/app/profile"]);
function shouldShowLangToggle(pathname: string) {
  if (HIDE_LANG_EXACT.has(pathname)) return false;
  if (HIDE_LANG_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return true;
}

/**
 * MobileFrame: phone-sized container that works on real mobile (full-bleed)
 * and shows a centered phone shell on desktop.
 */
export function MobileFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navVisible = shouldShowBottomNav(pathname);
  const langVisible = shouldShowLangToggle(pathname);
  return (
    <div className="min-h-screen bg-gradient-warm md:py-8">
      <div className="mx-auto w-full md:max-w-[420px] md:rounded-[2.5rem] md:border-8 md:border-foreground/90 md:shadow-elegant md:overflow-hidden bg-background min-h-screen md:min-h-[860px] md:max-h-[860px] md:h-[860px] flex flex-col relative">
        <div className={navVisible ? "flex-1 overflow-hidden pb-[68px]" : "flex-1 overflow-hidden"}>
          {children}
        </div>
        {langVisible && (
          <div className="absolute top-3 right-3 z-50 pointer-events-auto">
            <LanguageFlagToggle />
          </div>
        )}
        <BottomNav />
      </div>
    </div>
  );
}
