import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { initClarity, loadClarity } from "@/lib/clarity";


const KEY = "mc_consent";

function gtagSafe(...args: unknown[]) {
  try {
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    w.gtag?.(...args);
  } catch {
    /* ignore */
  }
}

/**
 * Quiet bottom-corner cookie consent bar for the Google Ads tag.
 * - Fixed position, so it never pushes content (no layout shift).
 * - Hidden entirely for visitors with the personal opt-out flag (mc_nt).
 * - Denied defaults are set in index.html before the tag loads; this only upgrades them.
 */
export default function ConsentBanner() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("mc_nt") === "1") return;
      if (localStorage.getItem(KEY)) return;
      setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!visible) return null;

  const decide = (granted: boolean) => {
    try {
      localStorage.setItem(KEY, granted ? "granted" : "denied");
    } catch {
      /* ignore */
    }
    if (granted) {
      gtagSafe("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "granted",
      });
    }
    setVisible(false);
  };

  // Keep clear of the bottom nav / sticky WhatsApp CTA on studio pages.
  const liftedForStickyCta =
    pathname.startsWith("/s/") || pathname.startsWith("/book/") || pathname.split("/").length === 2;
  const bottomClass = liftedForStickyCta ? "bottom-24" : "bottom-4";

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie choice"
      className={`fixed ${bottomClass} left-4 right-4 sm:right-auto sm:max-w-sm z-[60] motion-safe:animate-fade-up`}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-elegant p-4">
        <p className="text-sm text-foreground leading-snug">
          We use cookies to measure how people find Massage Club. Nothing else.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => decide(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => decide(false)}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Decline
          </button>
          <a
            href="/privacy"
            className="ml-auto text-xs text-muted-foreground underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Privacy
          </a>
        </div>
      </div>
    </div>
  );
}
