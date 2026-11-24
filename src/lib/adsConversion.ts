/**
 * Google Ads conversion tracking (AW-18401185487).
 *
 * Only additive: our internal funnel events are untouched. The gtag script and
 * Consent Mode defaults live in index.html; this module just fires conversions.
 */
const SEND_TO = "AW-18401185487/g623CMGQnOccEM-dr8ZE";
const FLAG = "mc_ads_signup_conv";

function alreadyFired(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

function markFired(): void {
  try {
    localStorage.setItem(FLAG, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Fires the account-creation conversion exactly once per browser.
 * Call only when a NEW account was created, never on plain sign-ins.
 */
export function trackAccountCreatedConversion(): void {
  if (typeof window === "undefined") return;
  if (alreadyFired()) return;
  markFired();
  try {
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    w.gtag?.("event", "conversion", { send_to: SEND_TO });
  } catch {
    /* ignore */
  }
}

/** True when the auth user row was created moments ago (i.e. a fresh signup). */
export function isFreshlyCreatedUser(createdAt?: string | null, windowMs = 120_000): boolean {
  if (!createdAt) return false;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < windowMs;
}
