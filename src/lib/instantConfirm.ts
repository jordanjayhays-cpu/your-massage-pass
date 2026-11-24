/**
 * Instant (auto) confirmation only applies to massage dates BEFORE 2026-09-01.
 * From September 1, 2026 onward every booking is a request the studio confirms
 * by email, even for studios with auto_confirm_bookings = true.
 */
export const INSTANT_CONFIRM_CUTOFF = new Date(2026, 8, 1, 0, 0, 0, 0); // 1 Sep 2026, local time

/** True when the studio auto-confirms AND the chosen date falls before the cutoff. */
export function isInstantConfirm(
  autoConfirm: boolean | null | undefined,
  date: Date | string | null | undefined
): boolean {
  if (!autoConfirm || !date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return false;
  return d.getTime() < INSTANT_CONFIRM_CUTOFF.getTime();
}

/** True while instant confirmation can still apply to any bookable date. */
export function instantConfirmWindowOpen(now: Date = new Date()): boolean {
  return now.getTime() < INSTANT_CONFIRM_CUTOFF.getTime();
}
