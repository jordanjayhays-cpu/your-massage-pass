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
    <div className="min-h-screen bg-gradient-warm">
      <div className="mx-auto w-full md:max-w-2xl lg:max-w-3xl md:border-x md:border-border/60 bg-background h-[100dvh] min-h-[100dvh] flex flex-col relative">
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
