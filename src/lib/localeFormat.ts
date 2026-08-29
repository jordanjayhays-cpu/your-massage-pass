import { toFlowLang, type FlowLang } from "@/lib/flowLang";

/**
 * Locale-aware formatting for everything dynamic the visitor sees:
 * weekday names, dates, times and prices. Never hand-write "Saturday" or
 * "15 €" in flow copy - run it through here so a German visitor reads
 * "Samstag" and "15,00 €".
 */

const LOCALES: Record<FlowLang, string> = {
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  zh: "zh-CN",
};

export function localeOf(lang?: string | null): string {
  return LOCALES[toFlowLang(lang)];
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "Sat" / "Sa." / "sáb" - short weekday name for a date. */
export function shortWeekday(date: Date, lang?: string | null): string {
  return cap(new Intl.DateTimeFormat(localeOf(lang), { weekday: "short" }).format(date));
}

/** "Saturday" / "Samstag" / "sábado" */
export function longWeekday(date: Date, lang?: string | null): string {
  return cap(new Intl.DateTimeFormat(localeOf(lang), { weekday: "long" }).format(date));
}

/** "Sat 12 Sep" style short date, localized. */
export function shortDate(date: Date, lang?: string | null): string {
  return cap(
    new Intl.DateTimeFormat(localeOf(lang), { weekday: "short", day: "numeric", month: "short" }).format(date),
  );
}

/** "12 September 2026" style long date, localized. */
export function longDate(date: Date, lang?: string | null): string {
  return cap(new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "long", year: "numeric" }).format(date));
}

/** "September 2026" - used on review cards. */
export function monthYear(date: Date, lang?: string | null): string {
  return cap(new Intl.DateTimeFormat(localeOf(lang), { month: "long", year: "numeric" }).format(date));
}

/** Clock time for a Date, localized (24h in Europe, 12h fallback where usual). */
export function timeLabel(date: Date, lang?: string | null): string {
  return new Intl.DateTimeFormat(localeOf(lang), { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Price in euros, localized: "45,00 €" (es/de/fr) vs "€45.00" (en). */
export function formatPrice(amount: number | null | undefined, lang?: string | null): string {
  if (amount == null || Number.isNaN(amount)) return "";
  return new Intl.NumberFormat(localeOf(lang), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** "60 min" - duration, localized where the unit differs. */
const MIN_UNIT: Record<FlowLang, string> = {
  en: "min",
  es: "min",
  fr: "min",
  de: "Min.",
  it: "min",
  pt: "min",
  zh: "分钟",
};

export function formatMinutes(minutes: number | null | undefined, lang?: string | null): string {
  if (minutes == null || Number.isNaN(minutes)) return "";
  return `${minutes} ${MIN_UNIT[toFlowLang(lang)]}`;
}

/** Parses a "YYYY-MM-DD" value into a local Date without timezone drift. */
export function parseISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
