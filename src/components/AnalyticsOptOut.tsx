import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { shouldShowBottomNav } from "@/app/components/BottomNav";

type NoticeType = "off" | "on" | null;

/**
 * Visible feedback for the personal analytics opt-out (?nt=1 / ?nt=0).
 *
 * - Shows a short confirmation toast/banner when the flag is toggled via URL.
 * - Strips the query parameter with history.replaceState so it never gets bookmarked.
 * - Renders a subtle persistent indicator while mc_nt is set.
 */
export default function AnalyticsOptOut() {
  const { pathname, search } = useLocation();
  const [notice, setNotice] = useState<NoticeType>(null);
  const [visible, setVisible] = useState(false);
  const [excluded, setExcluded] = useState(false);

  // Track the current exclusion state for the persistent indicator.
  useEffect(() => {
    try {
      setExcluded(localStorage.getItem("mc_nt") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // React to ?nt=1 / ?nt=0 in the URL, update storage, show feedback, and strip the param.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(search);
    const nt = params.get("nt");
    if (nt !== "1" && nt !== "0") return;

    try {
      if (nt === "1") {
        localStorage.setItem("mc_nt", "1");
        setExcluded(true);
        setNotice("off");
      } else {
        localStorage.removeItem("mc_nt");
        setExcluded(false);
        setNotice("on");
      }
    } catch {
      /* ignore */
    }

    // Remove ?nt=... from the address bar without a reload, preserving other params and hash.
    params.delete("nt");
    const query = params.toString();
    const newUrl = pathname + (query ? `?${query}` : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
  }, [search, pathname]);

  // Auto-dismiss the notice after ~6 seconds.
  useEffect(() => {
    if (!notice) return;
    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), 6000);
    const removeTimer = setTimeout(() => setNotice(null), 6300);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [notice]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setNotice(null), 300);
  };

  const bottomClass = shouldShowBottomNav(pathname) ? "bottom-20" : "bottom-4";

  return (
    <>
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-4 z-[70] max-w-sm transition-opacity duration-300 motion-safe:animate-fade-up ${
            visible ? "opacity-100" : "opacity-0"
          } ${bottomClass}`}
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-elegant backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-snug text-foreground">
                {notice === "off"
                  ? "Analytics off on this device. Your visits will not be counted."
                  : "Analytics back on for this device."}
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Link
              to={notice === "off" ? "/?nt=0" : "/?nt=1"}
              onClick={dismiss}
              className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {notice === "off" ? "Turn tracking back on" : "Turn tracking back off"}
            </Link>
          </div>
        </div>
      )}

      {excluded && !notice && (
        <div
          className={`fixed left-4 z-[60] flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2 py-1 text-[10px] text-muted-foreground shadow-soft backdrop-blur-sm ${bottomClass}`}
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          title="Analytics opt-out is active on this device"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70" aria-hidden="true" />
          analytics off
        </div>
      )}
    </>
  );
}
