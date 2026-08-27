import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import WhatsAppAskButton from "@/components/WhatsAppAskButton";
import { trackEvent } from "@/lib/siteVisit";
import { shouldShowBottomNav } from "./BottomNav";

/* ── Tiny global store so screens can give the bubble context (or hide it) ── */
type BubbleCtx = { studio?: string | null; hidden?: boolean };
let ctx: BubbleCtx = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Screens call this to set studio context or hide the bubble (wizard steps, success). */
export function setWaBubbleContext(next: BubbleCtx) {
  if (ctx.studio === (next.studio ?? undefined) && !!ctx.hidden === !!next.hidden) return;
  ctx = { studio: next.studio ?? undefined, hidden: !!next.hidden };
  emit();
}
export function clearWaBubbleContext() {
  if (!ctx.studio && !ctx.hidden) return;
  ctx = {};
  emit();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
const getSnapshot = () => ctx;

/** Routes where the concierge bubble lives. Studio pages opt in via context. */
function routeAllowsBubble(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/web" || p === "/landing") return true;
  if (p === "/studios") return true;
  if (p === "/app/discovery" || p === "/discovery") return true;
  if (p === "/app/bookings" || p === "/bookings") return true;
  if (p === "/app/profile" || p === "/profile") return true;
  if (/^\/(app\/)?massages\/[^/]+$/.test(p)) return true;
  return false;
}

const TOOLTIP_SEEN_KEY = "mc_wa_bubble_hint";

export default function WhatsAppBubble() {
  const { pathname } = useLocation();
  const { i18n } = useTranslation();
  const { studio, hidden } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [showHint, setShowHint] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const visible = !hidden && (!!studio || routeAllowsBubble(pathname));
  if (!visible) return null;

  const es = (i18n.language || "en").slice(0, 2).toLowerCase() === "es";

  // Sit above the bottom tab bar when it is on screen.
  const bottomClass = shouldShowBottomNav(pathname)
    ? "bottom-[calc(84px+env(safe-area-inset-bottom))]"
    : "bottom-[calc(20px+env(safe-area-inset-bottom))]";

  return (
    <div className={`fixed right-4 z-50 flex items-center gap-2 ${bottomClass}`}>
      {showHint && (
        <span
          role="status"
          className="max-w-[190px] rounded-full bg-white/95 backdrop-blur px-3 py-2 text-[12px] leading-snug font-medium text-[#4a3a2c] shadow-lg border border-black/5 motion-safe:animate-in motion-safe:fade-in"
        >
          {es ? "¿Dudas? Escríbenos por WhatsApp" : "Questions? WhatsApp us, we reply fast"}
        </span>
      )}
      <WhatsAppAskButton
        source="bubble"
        studioName={studio ?? null}
        sheet
        renderTrigger={({ open }) => (
          <button
            type="button"
            onClick={() => {
              trackEvent("wa_bubble_tap", { meta: { path: pathname, studio: studio ?? null } });
              try {
                if (sessionStorage.getItem(TOOLTIP_SEEN_KEY) !== "1") {
                  sessionStorage.setItem(TOOLTIP_SEEN_KEY, "1");
                  setShowHint(true);
                  timer.current = window.setTimeout(() => setShowHint(false), 3000);
                }
              } catch { /* private mode: ignore */ }
              open();
            }}
            aria-label={es ? "Escríbenos por WhatsApp" : "WhatsApp us"}
            className="h-[52px] w-[52px] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl motion-safe:transition hover:scale-[1.04] active:scale-95"
            style={{ backgroundColor: "#25D366" }}
          >
            <svg viewBox="0 0 32 32" className="h-7 w-7" fill="#fff" aria-hidden="true">
              <path d="M16.001 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.47 1.73 6.42L3.2 28.8l6.55-1.7a12.74 12.74 0 0 0 6.25 1.63h.01c7.06 0 12.79-5.74 12.79-12.8 0-3.42-1.33-6.63-3.75-9.05a12.7 12.7 0 0 0-9.05-3.68Zm0 23.02h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-4.03 1.05 1.08-3.93-.25-.4a10.58 10.58 0 0 1-1.62-5.63c0-5.86 4.77-10.63 10.63-10.63 2.84 0 5.5 1.11 7.51 3.12a10.55 10.55 0 0 1 3.11 7.52c0 5.86-4.77 10.61-10.63 10.61Zm5.83-7.95c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1.01 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.18-.32-.02-.5.14-.66.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.73-.98-2.36-.26-.62-.52-.54-.71-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65 0 1.56 1.14 3.07 1.3 3.28.16.21 2.25 3.44 5.45 4.82.76.33 1.36.53 1.82.68.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
            </svg>
          </button>
        )}
      />
    </div>
  );
}
