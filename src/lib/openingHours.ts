/**
 * Today's hours from a studio's free-text `partners.opening_hours`.
 *
 * Studios write it by hand, in English or Spanish, and the 25 values on
 * 2 Nov 2026 all follow one shape: comma separated "<days> <from>-<to>"
 * parts, for example "Daily 10:00-22:00", "Mon-Fri 10:00-20:00, Sat
 * 10:00-18:00", "Sun-Thu 10:00-21:30, Fri-Sat 10:00-22:00", "Lun-Vie
 * 10:00-20:00, Sáb 10:00-14:00" or "Todos los días 12:00-20:00".
 *
 * Anything else returns null, so the page shows nothing rather than a guess.
 * "Closed today" is only ever claimed when every part of the text was read.
 */

export type TodayHours = { open: true; from: string; to: string } | { open: false };

const DAY_NAMES: Record<string, number> = {
  sun: 0, sunday: 0, dom: 0, domingo: 0,
  mon: 1, monday: 1, lun: 1, lunes: 1,
  tue: 2, tues: 2, tuesday: 2, mar: 2, martes: 2,
  wed: 3, wednesday: 3, mie: 3, miercoles: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, jue: 4, jueves: 4,
  fri: 5, friday: 5, vie: 5, viernes: 5,
  sat: 6, saturday: 6, sab: 6, sabado: 6,
};

const EVERY_DAY = /^(daily|every ?day|todos los dias|diario|a diario)$/;

/** Lower case, no accents, no trailing dots: "Sáb." -> "sab". */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\./g, "").trim();

const dayOf = (s: string): number | null => {
  const v = DAY_NAMES[norm(s)];
  return v === undefined ? null : v;
};

/** "9:00" or "9.00" -> "9:00"; null when it is not a time of day. */
const timeOf = (s: string): string | null => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return `${h}:${m[2]}`;
};

/** Weekdays (0 = Sunday) a "<days>" part covers, or null when it cannot be read. */
function daysOf(part: string): number[] | null {
  const p = norm(part);
  if (EVERY_DAY.test(p)) return [0, 1, 2, 3, 4, 5, 6];
  // A range: "Mon-Fri", "Lun a Vie", "Sun-Thu" (wraps past Saturday).
  const range = /^([a-z]+)\s*(?:-|–|—|\sa\s|\sto\s)\s*([a-z]+)$/.exec(p);
  if (range) {
    const a = dayOf(range[1]), b = dayOf(range[2]);
    if (a === null || b === null) return null;
    const out: number[] = [];
    for (let d = a; ; d = (d + 1) % 7) {
      out.push(d);
      if (d === b || out.length > 7) break;
    }
    return out;
  }
  // A list: "Sat", "Sat y Dom", "Sat & Sun", "Sat/Sun".
  const list = p.split(/\s*(?:\/|&|\band\b|\by\b|\+)\s*/).filter(Boolean);
  const days = list.map(dayOf);
  return days.length && days.every((d) => d !== null) ? (days as number[]) : null;
}

/**
 * The hours for one weekday (0 = Sunday), or null when the text cannot be read.
 * A weekday no part mentions is closed, but only if every part was read.
 */
export function hoursOn(text: string | null | undefined, weekday: number): TodayHours | null {
  const raw = (text || "").trim();
  if (!raw) return null;
  const parts = raw.split(/\s*[,;\n]\s*/).filter(Boolean);
  let found: TodayHours | null = null;
  for (const part of parts) {
    const m = /^(.*?)\s+(\d{1,2}[:.]\d{2})\s*(?:-|–|—|a|to)\s*(\d{1,2}[:.]\d{2})$/i.exec(part.trim());
    if (!m) return null;
    const days = daysOf(m[1]);
    const from = timeOf(m[2]), to = timeOf(m[3]);
    if (!days || !from || !to) return null;
    if (!found && days.includes(weekday)) found = { open: true, from, to };
  }
  return found ?? { open: false };
}
