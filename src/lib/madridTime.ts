/**
 * Madrid wall-clock time, whatever the visitor's browser timezone is.
 *
 * Studios are in Madrid, so "today" and "is this time still bookable" are
 * Madrid questions. A visitor in New York at 11:39 must not be offered
 * 10:00 in Madrid when it is already 16:39 there. go.html (`madridNow`, line
 * 393) does the same for /reserve.
 */

const TZ = "Europe/Madrid";

type Wall = { y: number; mo: number; d: number; h: number; mi: number };

let fmt: Intl.DateTimeFormat | null = null;

/** Madrid calendar date and clock time for an instant. */
function madridWall(at: Date = new Date()): Wall {
  fmt ??= new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) parts[p.type] = p.value;
  const h = Number(parts.hour);
  return {
    y: Number(parts.year),
    mo: Number(parts.month),
    d: Number(parts.day),
    h: h === 24 ? 0 : h,
    mi: Number(parts.minute),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A Date whose local fields (getHours, getDate...) read the Madrid wall clock.
 * Same idea as go.html's madridNow(). Use it for display arithmetic only.
 */
export function madridNow(at: Date = new Date()): Date {
  const w = madridWall(at);
  return new Date(w.y, w.mo - 1, w.d, w.h, w.mi);
}

/** Today's date in Madrid as "YYYY-MM-DD". */
export function madridTodayIso(at: Date = new Date()): string {
  const w = madridWall(at);
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}`;
}

/** "YYYY-MM-DD" plus n calendar days (pure date arithmetic, no timezone). */
export function addDaysIso(iso: string, n: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Local-midnight Date for an ISO day, for formatting and weekday lookups. */
export function isoToLocalDate(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

/** "YYYY-MM-DD" from a Date's local fields. */
export function localDateIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The next `count` Madrid days, starting with today, as ISO strings. */
export function madridDays(count: number, at: Date = new Date()): string[] {
  const today = madridTodayIso(at);
  return Array.from({ length: count }, (_, i) => addDaysIso(today, i));
}

/**
 * True when a slot on `isoDate` at `hhmm` (Madrid time) starts before Madrid
 * now plus `leadMinutes`. Studios need at least an hour's notice, so the
 * default lead is 60. Slots on later days are never too soon; slots on past
 * days always are. "HH:MM:SS" is accepted too.
 */
export function isTooSoon(isoDate: string, hhmm: string, leadMinutes = 60, at: Date = new Date()): boolean {
  const [y, mo, d] = (isoDate || "").split("-").map(Number);
  const [h, mi] = (hhmm || "").split(":").map(Number);
  if (!y || !mo || !d || !Number.isFinite(h)) return false;
  const w = madridWall(at);
  // Both sides are Madrid wall-clock minutes, so DST changes cancel out.
  const nowMin = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) / 60000;
  const slotMin = Date.UTC(y, mo - 1, d, h, Number.isFinite(mi) ? mi : 0) / 60000;
  return slotMin < nowMin + leadMinutes;
}
