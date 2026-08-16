/**
 * First-touch booking attribution.
 * Stores referrer + landing path once per browser (first touch wins).
 */
const KEY = "mc-src";

export type SourceTouch = { ref: string; landing: string; ts: number };

export function captureSource() {
  try {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return; // never overwrite
    const touch: SourceTouch = {
      ref: (typeof document !== "undefined" && document.referrer) || "",
      landing: window.location.pathname,
      ts: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(touch));
  } catch {
    /* ignore */
  }
}

export function getSource(): { source_referrer: string | null; source_landing: string | null } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { source_referrer: null, source_landing: null };
    const parsed = JSON.parse(raw) as Partial<SourceTouch>;
    return {
      source_referrer: parsed?.ref || null,
      source_landing: parsed?.landing || null,
    };
  } catch {
    return { source_referrer: null, source_landing: null };
  }
}
