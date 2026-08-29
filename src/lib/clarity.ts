/**
 * Microsoft Clarity (session replay + heatmaps), consent-gated.
 *
 * Never loads unless the visitor accepted cookies on the banner
 * (localStorage "mc_consent" === "granted" / "accepted"), and never loads for
 * the personal opt-out flag (localStorage "mc_nt" === "1").
 */
import { isTrackingExcluded } from "./siteVisit";

const CLARITY_ID = "y6e1s80114";

type ClarityFn = (...args: unknown[]) => void;

function optedOut(): boolean {
  // isTrackingExcluded() also reads ?nt=1 / ?nt=0 from the current URL and
  // persists it, so Clarity is blocked even on the very first page load
  // carrying ?nt=1, before any other component effect runs.
  return isTrackingExcluded();
}

function hasConsent(): boolean {
  try {
    const v = localStorage.getItem("mc_consent");
    return v === "granted" || v === "accepted";
  } catch {
    return false;
  }
}

/** Injects the Clarity tag once, only when consent is granted and not opted out. */
export function loadClarity(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (optedOut() || !hasConsent()) return;
  const w = window as unknown as { clarity?: ClarityFn };
  if (w.clarity) return;
  if (document.querySelector(`script[src*="clarity.ms/tag/"]`)) return;

  (function (c: any, l: Document, a: string, r: string, i: string, t?: any, y?: any) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
}

/** Loads Clarity if the visitor has already accepted on a previous visit. */
export function initClarity(): void {
  loadClarity();
}

/** Tags a Clarity event; no-op for visitors who declined. */
export function clarityEvent(name: string): void {
  try {
    const w = window as unknown as { clarity?: ClarityFn };
    w.clarity?.("event", name);
  } catch {
    /* ignore */
  }
}
