import { useLocation, useNavigate } from "react-router-dom";
import { Flower2, Sparkles, CalendarDays, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const TAB_DEFS = [
  { key: "massages", to: "/app/massages", icon: Flower2, match: ["/app/massages", "/massages"] },
  { key: "discovery", to: "/app/discovery", icon: Sparkles, match: ["/app/discovery", "/discovery"] },
  { key: "bookings", to: "/app/bookings", icon: CalendarDays, match: ["/app/bookings", "/bookings"] },
  { key: "profile", to: "/app/profile", icon: User, match: ["/app/profile", "/profile"] },
] as const;


// Hide nav on these path prefixes/exacts
const HIDDEN_EXACT = new Set(["/", "/app", "/app/", "/landing", "/web", "/survey"]);
const HIDDEN_PREFIXES = ["/partner", "/studio-setup", "/studio-portal", "/admin", "/s/", "/book/"];


export function shouldShowBottomNav(pathname: string): boolean {
  if (HIDDEN_EXACT.has(pathname)) return false;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return true;
}

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!shouldShowBottomNav(pathname)) return null;

  return (
    <nav
      className="absolute bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/60 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
          return (
            <li key={t.to} className="flex-1">
              <button
                onClick={() => navigate(t.to)}
                className={cn(
                  "w-full flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors",
                  active ? "text-[#C4622D]" : "text-[#7A7068] hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                <span className="text-[10px] font-semibold tracking-wide">{t.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
