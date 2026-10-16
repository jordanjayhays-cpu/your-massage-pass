// Source of truth for the deployed notify-whatsapp-request edge function.
// The deployed function is a small shim that imports start() from this file
// (pinned to a commit) and passes the Resend and WhatsApp keys in, so no
// secret lives in this public repo. Same arrangement as wa-bot/bot.ts.
// notify-whatsapp-request — fires on every whatsapp_requests INSERT (DB trigger).
// v12: booking alerts go to BOTH support@ and jordan@ until Jordan confirms the
// support inbox is on his phone — a new booking must never go unseen.
// v13: no request dies quietly. When no studio was chosen:
//   1. match bookable studios in the area; if none, fall back to closest bookable ones
//   2. auto-email up to 3 of them the one-tap offer (first tap wins, &p= carries who)
//   3. WhatsApp the customer that we are reaching out to studios right now
//   4. if the area only has unregistered leads, give Jordan one-tap WhatsApp buttons
// v14: studio-facing text is fully Spanish — service names are translated
//   ("Not sure" no longer appears as a giant email headline), and the customer
//   ack says "your massage" instead of "your Not sure".
// v15: requests with no chosen studio that come from the bot (v35+) or the
//   booking card are now fanned out by dispatch-studios: five studios on
//   WhatsApp at once, first to accept wins, customer told the true count. For
//   those, this trigger no longer emails studios, no longer messages the
//   customer, and no longer flips the stage (which used to hide the request
//   from the dispatch sweep). Jordan still gets a slim founder card so nothing
//   goes unseen. The legacy path is unchanged for requests with a chosen studio
//   and for requests from other origins.
// v16 (6 Sept): a studio whose opening hours say it is closed on the requested
//   day or time is not emailed an offer. Calma Madrid (closed Sundays, hours on
//   file) got the one-tap offer for a Sunday 20:00 slot and wrote to complain.
// v17 (7 Sept): every studio-facing message says the choice is theirs. The
//   one-tap offer email leads with "vosotros decidís" and spells out that
//   "Ninguna me va bien" costs them nothing. Em dashes removed from studio copy.
// v18 (16 Oct, Jordan: "i don't want it to look robotic ... i see a weird
//   message not a normal message"). The offer email reads like Jordan wrote it:
//   "Hola, equipo de X:", who we are in one line, the client, the day in
//   Spanish ("el lunes 19 de octubre por la tarde, entre las 13:00 y las
//   18:00"), the duration, the 10% Massage Club rate ask, "Estoy preguntando a
//   varios centros" only when two or more really were, and "Jordan, de Massage
//   Club". Gone: English time buttons ("Monday 19 October Afternoon (13-18)"),
//   the hour-less second button, "14:00 14:00", "el cliente recibe la
//   confirmación al momento" (false since both parties tap), "sin comisión",
//   "€65". The subject names the day. The free-page line is a P. D. after the
//   signature. The wa.me texts Jordan sends by hand say the same, with the
//   intro and signature only for a number we have never written to. After
//   every offer email a studio gets, Jordan gets a copy (wa-bot studio_copy).
//   The builders are exported: stuck-booking-rescue sends this same email.

let RESEND_API_KEY = "";
// wa-bot's ops key, for the studio_copy card. Passed by the loader; falls back
// to the env so an older loader still works (it then only logs).
let OPS_KEY = "";
// Once wa-bot serves note=studio_check (the scanner-safe page where a studio
// picks the hour and its 10% price), the loader passes studioCheckPage: true and
// every tap goes through that page. Until then taps go straight to studio-times.
let CHECK_PAGE = false;
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const TO_EMAILS = ["support@massageclub.io", "jordan@massageclub.io"];
const REPLY_TO = "support@massageclub.io";
const LOGO_URL = "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/branding/mc-avatar-cream.png";
const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const APP = "https://book.massageclub.io";
let WA_TOKEN = "";
const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || "1270437552818077";
const GRAPH = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;

const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu", "longyi_elon@outlook.com", "geromin.nepomuceno@student.ie.edu", "ritiktulsyan674@gmail.com", "sarfrazsingh@gmail.com"];
const TEST_DOMAINS = ["testing.com", "example.com", "test.com", "placeholder.local", "mailinator.com", "example.org"];
const isTestContact = (email?: string | null, name?: string | null) => {
  const e = String(email || "").toLowerCase();
  const n = String(name || "").toLowerCase();
  if (TEST_EMAILS.includes(e)) return true;
  if (TEST_DOMAINS.some((d) => e.endsWith("@" + d))) return true;
  if (/\+(mctest|uitest)/.test(e)) return true;
  if (/\btest\b|\bprueba\b/.test(n)) return true;
  return false;
};
const isTestPhone = (p?: string | null) => {
  const d = String(p || "").replace(/[^0-9]/g, "");
  if (d === "15622355063" || d === "17867276503") return true;
  if (d.startsWith("86") && d.endsWith("997")) return true; // friend tester Yi
  return false;
};

// DB service names are English; studios and Spanish customers must never see them raw.
export const SVC_ES_MAP: Array<[RegExp, string]> = [
  [/not sure|no lo sé|^massage$|massage treatment/i, "Masaje"],
  [/deep tissue|descontracturante/i, "Masaje descontracturante"],
  [/thai|tailand/i, "Masaje tailandés"],
  [/hot stone|piedras/i, "Masaje de piedras calientes"],
  [/sport|deportivo/i, "Masaje deportivo"],
  [/balin/i, "Masaje balinés"],
  [/shiatsu/i, "Shiatsu"],
  [/reflexolog/i, "Reflexología"],
  [/lymphatic|drenaje|linfatic/i, "Drenaje linfático"],
  [/couples|pareja/i, "Masaje en pareja"],
  [/kobido/i, "Masaje facial Kobido"],
  [/relax|swedish|stress/i, "Masaje relajante"],
  // v18: a studio's own English menu item ("Aromatherapy massage", "Prenatal
  // massage") reached studios as "una sesión de prenatal massage".
  [/prenatal|pregnan|embaraz/i, "Masaje prenatal"],
  [/aromather|aromaterap/i, "Masaje con aromaterapia"],
  [/four hands|4 hands|cuatro manos/i, "Masaje a cuatro manos"],
  [/lomi/i, "Masaje lomi lomi"],
  [/ayurved/i, "Masaje ayurvédico"],
  // Head, foot and facial only when it is a massage: a studio's "Foot scrub"
  // or "Facial" keeps its own name rather than being asked for a massage.
  [/\b(head|scalp)\b[^,]*massage|masaje de cabeza|craneal/i, "Masaje de cabeza"],
  [/\b(foot|feet)\b[^,]*massage|massage[^,]*\b(foot|feet)\b|masaje de pies|podal/i, "Masaje de pies"],
  [/facial[^,]*massage|masaje facial/i, "Masaje facial"],
  [/massage/i, "Masaje"],
];
export const svcEs = (n?: string | null): string => {
  const s = String(n || "");
  for (const [re, es] of SVC_ES_MAP) if (re.test(s)) return es;
  return s || "Masaje";
};
// v18: "un masaje deportivo", "una sesión de reflexología", for the middle of a
// sentence to a studio. A name we cannot map (a studio's own menu item) keeps
// its words: "un masaje con aceites" or "una sesión de aromaterapia".
export const svcConUn = (n?: string | null): string => {
  const v = svcEs(n).trim();
  if (/^masaje$/i.test(v)) return "un masaje";
  if (/^reflexolog/i.test(v)) return "una sesión de reflexología";
  const low = v.charAt(0).toLowerCase() + v.slice(1);
  if (/^(un|una)\s/i.test(low)) return low;
  const mapped = SVC_ES_MAP.some(([, es]) => es === v);
  return mapped || /^(masaje|drenaje|shiatsu)\b/i.test(low) ? `un ${low}` : `una sesión de ${low}`;
};
// "reservar un masaje" / "reservar masaje tailandés" — mid-sentence form.
const svcEsFrase = (n?: string | null): string => {
  const v = svcEs(n);
  return v === "Masaje" ? "un masaje" : v.toLowerCase();
};
// English mid-sentence form: "your massage", never "your Not sure".
const svcEn = (n?: string | null): string => {
  const s = String(n || "");
  return !s || /not sure/i.test(s) ? "massage" : s.toLowerCase();
};

const C = { page: "#F1EBE2", ink: "#262019", muted: "#8A7F73", clay: "#B85C38", cream: "#FAF6F0", line: "#F0E9E0", dash: "#E4D9CB", wa: "#E7FFDB" };
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const waNum = (p: string) => { const d = String(p || "").replace(/[^0-9]/g, ""); return d.length === 9 && /^[6789]/.test(d) ? "34" + d : d; };

const rowKV = (label: string, value: string, strong = false) => value ? `\n  <tr><td style="padding:9px 0;border-top:1px solid ${C.line};color:${C.muted};font-size:13px;font-family:${SANS};vertical-align:top;">${label}</td>\n  <td align="right" style="padding:9px 0 9px 14px;border-top:1px solid ${C.line};color:${C.ink};font-size:14px;font-weight:${strong ? 700 : 600};font-family:${SANS};">${value}</td></tr>` : "";

function areaFromRequest(r: any): string {
  if (r.area && String(r.area).trim()) return String(r.area).trim();
  const m1 = String(r.studio_name || "").match(/\(([^)]+)\)/);
  if (m1 && m1[1] && !/por asignar/i.test(m1[1])) return m1[1].trim();
  const m2 = String(r.message_text || "").match(/Zona:\s*([^|]+)/i);
  if (m2 && m2[1]) return m2[1].trim();
  return "";
}

function madridHour(): number {
  const s = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date());
  return parseInt(s, 10);
}

// v16: opening hours. partners.opening_hours is free text in one of a few
// shapes ("Mon-Sat 10:00-20:00", "Lun-Vie 10:00-20:00, Sáb 10:00-14:00",
// "Daily 10:00-21:00", "Todos los días 12:00-20:00", "Sun-Thu 10:00-21:30,
// Fri-Sat 10:00-22:00"). Anything the parser cannot read counts as unknown,
// and unknown hours never block an ask.
const DAY_IDX: Record<string, number> = {
  sun: 0, dom: 0, mon: 1, lun: 1, tue: 2, mar: 2, wed: 3, mie: 3, thu: 4, jue: 4, fri: 5, vie: 5, sat: 6, sab: 6,
};
const stripAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
function parseHours(text: unknown): Map<number, [number, number]> | null {
  const raw = stripAccents(String(text || "").toLowerCase()).trim();
  if (!raw) return null;
  const out = new Map<number, [number, number]>();
  const toMin = (h: string) => { const [a, b] = h.split(":"); return parseInt(a, 10) * 60 + (parseInt(b || "0", 10) || 0); };
  for (const seg0 of raw.split(/[,;]|\s+y\s+|\s+and\s+/)) {
    const seg = seg0.trim();
    if (!seg) continue;
    const m = seg.match(/^(.*?)\s*(\d{1,2}(?::\d{2})?)\s*[-–a]\s*(\d{1,2}(?::\d{2})?)\s*h?$/);
    if (!m) return null;
    const dayPart = m[1].trim();
    const open = toMin(m[2]), close = toMin(m[3]);
    const days: number[] = [];
    if (dayPart === "" || /^(daily|todos los dias|every day|diario|cada dia)$/.test(dayPart)) days.push(0, 1, 2, 3, 4, 5, 6);
    else {
      for (const tok of dayPart.split(/\s*\/\s*|\s+/)) {
        const range = tok.match(/^([a-z]{3})[a-z]*\s*[-–]\s*([a-z]{3})[a-z]*$/);
        if (range) {
          const a = DAY_IDX[range[1]], b = DAY_IDX[range[2]];
          if (a === undefined || b === undefined) return null;
          for (let d = a; ; d = (d + 1) % 7) { days.push(d); if (d === b) break; }
        } else {
          const one = tok.match(/^([a-z]{3})[a-z]*\.?$/);
          if (!one || DAY_IDX[one[1]] === undefined) return null;
          days.push(DAY_IDX[one[1]]);
        }
      }
    }
    for (const d of days) out.set(d, [open, close]);
  }
  return out.size ? out : null;
}
// The calendar day the customer asked for, as a Madrid-local date, or null
// when it cannot be read ("Flexible", a time band, a typo).
const MADRID_YMD = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
const MONTHS: Record<string, number> = { jan: 0, ene: 0, feb: 1, mar: 2, apr: 3, abr: 3, may: 4, jun: 5, jul: 6, aug: 7, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dec: 11, dic: 11 };
function madridToday(): Date {
  const [y, m, d] = MADRID_YMD.format(new Date()).split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d));
}
// v18: "hoy" and "tomorrow" mean the day the customer wrote them (created_at),
// not the day a later timer happens to run, same as dispatch-studios v38.
function madridDayOf(iso: unknown): Date {
  const t = Date.parse(String(iso || ""));
  if (!t) return madridToday();
  const [y, m, d] = MADRID_YMD.format(new Date(t)).split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d));
}
// One day as the customer or the website wrote it ("Today", "Monday 19
// October", "lunes 19 de octubre", "Fri 9 Oct, 14:00", "2026-10-19"), or null.
function parseDayText(t0: unknown, anchor: Date): Date | null {
  const t = stripAccents(String(t0 || "").toLowerCase()).trim();
  if (!t) return null;
  const plus = (n: number) => new Date(anchor.getTime() + n * 86400e3);
  if (/^(hoy|today)\b/.test(t)) return anchor;
  if (/^(manana|tomorrow)\b/.test(t)) return plus(1);
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return new Date(Date.UTC(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10)));
  const dm = t.match(/(\d{1,2})\s*(?:de\s+)?([a-z]{3})[a-z]*/);
  if (dm && MONTHS[dm[2]] !== undefined) {
    let dt = new Date(Date.UTC(anchor.getUTCFullYear(), MONTHS[dm[2]], parseInt(dm[1], 10)));
    if (dt.getTime() < anchor.getTime() - 30 * 86400e3) dt = new Date(Date.UTC(anchor.getUTCFullYear() + 1, MONTHS[dm[2]], parseInt(dm[1], 10)));
    return dt;
  }
  const wd = t.match(/\b(sun|mon|tue|wed|thu|fri|sat|dom|lun|mar|mie|jue|vie|sab)[a-z]*\b/);
  if (wd && DAY_IDX[wd[1]] !== undefined) {
    const want = DAY_IDX[wd[1]];
    for (let n = 0; n < 7; n++) { const d = plus(n); if (d.getUTCDay() === want) return d; }
  }
  return null;
}
export function requestDate(r: Record<string, unknown>): Date | null {
  const anchor = madridDayOf(r.created_at);
  const texts = [String(r.message_text || "").match(/Fecha: ([^|]+)/)?.[1] || "", String(r.day1 || "")];
  for (const t of texts) {
    const d = parseDayText(t, anchor);
    if (d) return d;
  }
  return null;
}
const ES_WEEKDAY = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// v18: what a studio reads about WHEN. Spanish only, one hour never printed
// twice, a band said as a band, raw customer words never passed through.
const ES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const ES_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
// "lunes 19 de octubre", no article.
export const fechaEs = (d: Date) => `${ES_DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${ES_MESES[d.getUTCMonth()]}`;
// "hoy", "mañana" or "el lunes 19 de octubre". full = always the date (emails,
// and texts Jordan may send later by hand).
export function dayWordEs(d: Date, full: boolean): string {
  const diff = Math.round((d.getTime() - madridToday().getTime()) / 86400e3);
  if (!full && diff === 0) return "hoy";
  if (!full && diff === 1) return "mañana";
  return `el ${fechaEs(d)}`;
}
// A day we cannot read as a date, in Spanish words, without a trailing hour.
const EN_ES: Array<[RegExp, string]> = [
  [/\bmonday\b/gi, "lunes"], [/\btuesday\b/gi, "martes"], [/\bwednesday\b/gi, "miércoles"], [/\bthursday\b/gi, "jueves"],
  [/\bfriday\b/gi, "viernes"], [/\bsaturday\b/gi, "sábado"], [/\bsunday\b/gi, "domingo"],
  [/\b(this )?weekend\b/gi, "el fin de semana"], [/\btonight\b/gi, "esta noche"],
];
function rawDayEs(day: string): string {
  let t = String(day || "").replace(/,?\s*\b([01]?\d|2[0-3])[:.][0-5]\d\b\s*$/, "").trim();
  if (!t) return "";
  if (/any day|cualquier d[ií]a|flexible/i.test(t)) return "cualquier día";
  for (const [re, es] of EN_ES) t = t.replace(re, es);
  return t.charAt(0).toLowerCase() + t.slice(1);
}
// [start, end) hours of a band: "Afternoon (13-18)", "Tarde (13-18)", "13:00-18:00", "evening".
export function bandOf(t: unknown): [number, number] | null {
  const s = String(t || "").toLowerCase();
  const m = s.match(/\b(\d{1,2})(?::00)?\s*-\s*(\d{1,2})(?::00)?\b/);
  if (m && +m[1] < +m[2] && +m[2] <= 24) return [+m[1], +m[2]];
  if (/\b\d{1,2}[:.]\d{2}\b/.test(s)) return null;
  if (/\b(morning|ma[nñ]ana)\b/.test(s)) return [10, 13];
  if (/\b(afternoon|tarde)\b/.test(s)) return [13, 18];
  if (/\b(evening|night|noche)\b/.test(s)) return [18, 21];
  return null;
}
export function exactOf(t: unknown): string {
  if (bandOf(t)) return "";
  const m = String(t || "").match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}
// "a las 15:30", "por la tarde, entre las 13:00 y las 18:00" (short: "por la
// tarde"), or "" when there is nothing we can say in Spanish.
export function timeEs(t: unknown, short = false): string {
  const b = bandOf(t);
  if (b) {
    const part = b[0] < 13 ? "por la mañana" : "por la tarde";
    return short ? part : `${part}, entre las ${hh(b[0])} y las ${hh(b[1])}`;
  }
  const x = exactOf(t);
  return x ? `a las ${x}` : "";
}
// "Duración: 90 min" in message_text, or the usual 60.
export const reqMins = (r: Record<string, unknown>): number => {
  const m = String(r.message_text || "").match(/Duraci[oó]n: (\d{2,3}) min/);
  return m ? parseInt(m[1], 10) : 60;
};
// The client's first name as a studio should read it, or "".
export function cleanFirst(n: unknown): string {
  const f = String(n || "").trim().split(/\s+/)[0] || "";
  if (!f || /^(whatsapp|cliente|client|customer|guest|test|prueba|null|undefined|-)$/i.test(f)) return "";
  return f.charAt(0).toUpperCase() + f.slice(1);
}
// The times on a request, as a studio reads them. pick is the option number
// studio-times maps back to day/time, so it never changes. An empty pair, a
// label already listed, and a second entry for the same day without its own
// HH:MM are left out: wa-bot writes day2 = day1 with the band or nothing as
// time2, which is where the hour-less "Monday 19 October" button and
// "Friday 9 Oct, 14:00 14:00" came from.
export type Slot = { pick: string; day: string; time: string; key: string; label: string; long: string; exact: string; band: [number, number] | null; date: Date | null };
export function slotsEs(r: Record<string, unknown>, full = true): Slot[] {
  const out: Slot[] = [];
  const anchor = madridDayOf(r.created_at);
  const fecha = String(r.message_text || "").match(/Fecha: ([^|]+)/)?.[1] || "";
  for (let i = 1; i <= 3; i++) {
    const day = String(r[`day${i}`] || "").trim();
    const time = String(r[`time${i}`] || "").trim();
    if (!day && !time) continue;
    // A time with no day of its own belongs to the first day.
    const dayText = day || (out[0] ? out[0].day : "");
    const date = (i === 1 ? parseDayText(fecha, anchor) : null) || parseDayText(dayText, anchor) || (!day && out[0] ? out[0].date : null);
    const dayW = date ? dayWordEs(date, full) : rawDayEs(dayText);
    const key = date ? date.toISOString().slice(0, 10) : dayW;
    const exact = exactOf(time) || (!time ? exactOf(day) : "");
    const band = bandOf(time);
    if (out.some((s) => s.key === key) && !exact) continue;
    const label = [dayW, exact ? `a las ${exact}` : timeEs(time, true)].filter(Boolean).join(" ");
    const long = [dayW, exact ? `a las ${exact}` : timeEs(time, false)].filter(Boolean).join(" ");
    if (!label || out.some((s) => s.label === label)) continue;
    out.push({ pick: String(i), day, time, key, label, long, exact, band, date });
  }
  return out;
}
// The first time in full, and a second day when there is one.
export function whenLine(slots: Slot[]): string {
  if (!slots.length) return "";
  const other = slots.find((s) => s.key !== slots[0].key);
  return `${slots[0].long}${other ? `, o si no ${other.label}` : ""}`;
}

// Why this studio should not be asked for this request, or null if it may be.
export function closedReason(hoursText: unknown, r: Record<string, unknown>): string | null {
  const hours = parseHours(hoursText);
  if (!hours) return null;
  const date = requestDate(r);
  if (!date) return null;
  const slot = hours.get(date.getUTCDay());
  if (!slot) return `cerrado los ${ES_WEEKDAY[date.getUTCDay()]}`;
  const tm = String(r.time1 || "").match(/^(\d{1,2}):(\d{2})$/);
  if (tm) {
    const min = parseInt(tm[1], 10) * 60 + parseInt(tm[2], 10);
    if (min < slot[0] || min >= slot[1]) return `a esa hora está cerrado (abre ${hm(slot[0])}-${hm(slot[1])})`;
  }
  // v18: a band ("Afternoon (13-18)") that does not overlap the day's hours at
  // all is closed too. It used to pass unchecked because it is not HH:MM.
  const band = tm ? null : bandOf(r.time1);
  if (band && (band[1] * 60 <= slot[0] || band[0] * 60 >= slot[1])) return `en esa franja está cerrado (abre ${hm(slot[0])}-${hm(slot[1])})`;
  return null;
}

type Opt = { id: string; business_name: string; slug: string; area: string; google_rating: any; google_reviews: any; venue_type: string; wa: string; svc: string; duration: number; price: number };

async function matchStudios(r: any, H: Record<string, string>, area: string | null): Promise<Opt[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_studios`, {
    method: "POST", headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ p_area: area, p_want: r.service_name || null, p_exclude: r.partner_id || null, p_limit: 3 }),
  });
  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows)) { console.log("[notify] match_studios error", JSON.stringify(rows).slice(0, 200)); return []; }
  return rows as Opt[];
}

// One-tap offer email a studio receives. pfx appends &p=<partner_id> so
// studio-times knows which studio tapped when several get the same request.
// v18: written the way Jordan writes. chosen = the customer picked this studio
// ("Brandon os ha elegido para..."); several = two or more studios really got
// this request, the only time "Estoy preguntando a varios centros" is said.
// The paragraphs are built once and used by the html and the text, so the two
// can never say different things. stuck-booking-rescue's 4h widen sends this
// same email.
export type OfferOpts = { chosen?: boolean; several?: boolean; checkPage?: boolean };
const priceEs = (p: unknown) => {
  const n = Number(p);
  return Number.isFinite(n) && n > 0 ? `${String(Math.round(n * 100) / 100).replace(".", ",")} €` : "";
};
export function offerEmail(r: any, slots: Slot[], pfx: string, claimSlug: string, studioName: string, o: OfferOpts = {}) {
  const checkPage = o.checkPage ?? CHECK_PAGE;
  const first = cleanFirst(r.first_name);
  const area0 = areaFromRequest(r);
  const area = !o.chosen && area0 && !/^madrid$/i.test(area0) ? area0 : "";
  const when = whenLine(slots);
  const what = `${svcConUn(r.service_name)} de ${reqMins(r)} min${when ? " " + when : ""}`;
  const price = priceEs(r.price);
  const hello = studioName ? `Hola, equipo de ${studioName}:` : "Hola:";
  const intro = "Soy Jordan, de Massage Club, un servicio de reservas de masajes en Madrid.";
  const client = (o.chosen
    ? `${first || "Un cliente"} os ha elegido para ${what}.`
    : `Tengo un cliente${first ? `, ${first},` : ""} que busca ${what}${area ? `, por la zona de ${area}` : ""}.`)
    // The price is this studio's own only when the customer chose it; to any
    // other studio "según vuestra carta" would be someone else's price.
    + ` Paga directamente en el centro.${price && o.chosen ? ` Según vuestra carta son ${price}.` : ""}`;
  // The price box only exists on the check page; until then they answer by email.
  const discount = `${o.several ? "Estoy preguntando a varios centros y se queda con la mejor oferta. " : ""}Si podéis hacerle un 10% como cliente de Massage Club, ${checkPage ? "ponedlo al elegir la hora" : "decídmelo contestando a este correo"}.`;
  const askLine = "Si os viene bien, tocad aquí y elegid la hora:";
  const after = "Vuestro sí todavía no cierra la reserva: se lo proponemos al cliente y, en cuanto acepte, os lo confirmamos por escrito. Si no os viene bien, no pasa nada.";
  const pd = claimSlug ? "P. D.: Si queréis que os lleguen más clientes así, podéis ver y completar vuestra página en Massage Club, sin coste:" : "";
  const tapUrl = (p: string) => checkPage
    ? `${APP}/bot.html?note=studio_check&t=${r.offer_token}&pick=${p}${pfx}`
    : `${SUPABASE_URL}/functions/v1/studio-times?t=${r.offer_token}&pick=${p}${pfx}`;
  const P = (t: string, extra = "") => `\n        <p style="margin:0 0 14px;color:${C.ink};font-size:15px;line-height:1.6;${extra}">${t}</p>`;
  const btn = slots.map((s) => `\n        <a href="${tapUrl(s.pick)}" style="display:block;background:#1A9C56;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 18px;border-radius:999px;margin:0 0 10px;text-align:center;">Sí, ${esc(s.label)}</a>`).join("");
  const noBtn = `\n        <a href="${tapUrl("none")}" style="display:block;background:${C.cream};color:#B91C1C;font-size:14px;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:999px;text-align:center;border:1px solid ${C.line};">No nos viene bien</a>`;
  const pdHtml = pd ? P(`${esc(pd)} <a href="${APP}/claim/${claimSlug}" style="color:${C.clay};font-weight:700;text-decoration:none;">ver vuestra página</a>`, `color:${C.muted};font-size:13px;margin:18px 0 0;`) : "";
  const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center">\n    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;">\n      <tr><td style="padding:26px 34px 0;text-align:center;">\n        <img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;">\n        <p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p>\n      </td></tr>\n      <tr><td style="padding:24px 34px 0;font-family:${SANS};">${P(esc(hello))}${P(esc(intro))}${P(esc(client))}${P(esc(discount))}${P(esc(askLine), "margin:0 0 12px;")}${btn}${noBtn}\n      </td></tr>\n      <tr><td style="padding:18px 34px 0;font-family:${SANS};">${P(esc(after))}${P(`Un saludo,<br>Jordan, de Massage Club`, "margin:0;")}${pdHtml}\n      </td></tr>\n      <tr><td style="padding:8px 34px 26px;">\n        <div style="border-top:2px dashed ${C.dash};margin:18px 0 14px;"></div>\n        <p style="margin:0;color:#B8AC9E;font-size:12px;text-align:center;">Massage Club · Madrid · <a href="${APP}" style="color:${C.clay};text-decoration:none;">book.massageclub.io</a></p>\n      </td></tr>\n    </table></td></tr></table>`;
  const links = checkPage
    ? [`Para decirnos si os viene bien y a qué hora, entrad aquí: ${APP}/bot.html?note=studio_check&t=${r.offer_token}${pfx}`, "También podéis contestar a este correo."]
    : ["Si os viene bien, elegid la hora en uno de estos enlaces:", ...slots.map((s) => `Sí, ${s.label}: ${tapUrl(s.pick)}`), `No nos viene bien: ${tapUrl("none")}`, "También podéis contestar a este correo."];
  const text = [hello, "", intro, "", client, "", discount, "", links.join("\n"), "", after, "", "Un saludo,", "Jordan, de Massage Club", ...(pd ? ["", `${pd} ${APP}/claim/${claimSlug}`] : [])].join("\n");
  const s0 = slots[0];
  const subject = `¿Tenéis hueco${s0 ? " " + s0.label : ""}? ${svcEs(r.service_name)} de ${reqMins(r)} min`;
  return { html, text, subject };
}

// v18: Jordan gets a copy of every email a studio receives from here, in the
// same card wa-bot uses for its own studio messages. Never blocks a send.
export async function copyToJordan(opsKey: string, studio: string, phone: string, subject: string, text: string, channel: "Email" | "WhatsApp" = "Email") {
  if (!opsKey) { console.log(`[studio_copy] no ops key, copy of the ${channel} to ${studio} not sent`); return; }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/wa-bot`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ ops: "studio_copy", key: opsKey, studio, phone: waNum(phone), text, subject: subject || undefined, channel }),
    });
    if (!res.ok) console.log(`[studio_copy] ${studio}: status=${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`);
  } catch (e) { console.log(`[studio_copy] ${studio} failed`, String(e)); }
}

async function logWaMsg(H: Record<string, string>, phone: string, body: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wa_messages`, { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ phone, direction: "out", msg_type: "text", body: body.slice(0, 2000) }) });
  } catch (_e) { /* non-fatal */ }
}

// v15: the slim founder card for requests handled by dispatch-studios.
// Facts only, one button, no manual work implied.
async function slimFounderCard(r: any, area: string) {
  const when1 = [r.day1, r.time1].filter(Boolean).join(" ");
  const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ");
  const origin = /booking-card/i.test(String(r.message_text || "")) ? "booking card" : "WhatsApp chat";
  const h = madridHour();
  const inHours = h >= 9 && h < 21;
  const isTest = isTestContact(r.contact_email, r.first_name) || isTestPhone(r.client_phone) || String(r.client_phone || "").replace(/[^0-9]/g, "") === "34612474827";
  const dispatchLine = isTest
    ? "Test contact: dispatch will not message any real studio."
    : inHours
      ? "Dispatch is asking up to 5 studios on WhatsApp right now. First to confirm wins; the others are stood down automatically. You will get a separate email listing who was asked."
      : "Outside studio hours. Dispatch will ask up to 5 studios on WhatsApp at 09:00 and message the customer as soon as one confirms. The customer has already been told this.";
  const custDigits = waNum(r.client_phone || "");
  const custWa = custDigits ? `https://wa.me/${custDigits}` : "";
  const rows = [
    rowKV("Service", esc(r.service_name || "Massage"), true),
    when1 ? rowKV("When", esc(when1)) : "",
    rowKV("Area", esc(area || "Madrid")),
    rowKV("Name", esc(fullName || "not given")),
    r.client_phone ? rowKV("WhatsApp", esc(r.client_phone), true) : "",
    rowKV("Email", r.contact_email ? esc(r.contact_email) : `<span style="color:#B91C1C;">not given</span>`),
    rowKV("Came via", esc(origin)),
  ].join("");
  const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center">\n  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;">\n    <tr><td style="padding:26px 34px 0;text-align:center;">\n      <img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;">\n      <p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p>\n    </td></tr>\n    <tr><td style="padding:26px 34px 0;text-align:center;">\n      <span style="display:inline-block;background:${C.cream};color:${C.clay};font-size:11px;font-weight:700;letter-spacing:2.5px;padding:7px 16px;border-radius:999px;">BOOKING REQUEST #${r.id}</span>\n      <h1 style="margin:16px 0 0;color:${C.ink};font-size:27px;line-height:1.2;font-family:${SERIF};font-weight:700;">${esc(r.service_name || "New request")}</h1>\n      <p style="margin:8px 0 0;color:#1A7F42;font-size:13px;font-weight:600;">${esc(dispatchLine)}</p>\n    </td></tr>\n    <tr><td style="padding:18px 34px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table></td></tr>\n    <tr><td style="padding:0 34px;">\n    <div style="text-align:center;padding-top:18px;">\n      ${custWa ? `<a href="${custWa}" style="display:inline-block;background-color:#1FA855;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:999px;margin:4px;">💬 Reply to the customer</a>` : ""}\n    </div></td></tr>\n    <tr><td style="padding:24px 34px 26px;">\n      <div style="border-top:2px dashed ${C.dash};margin-bottom:16px;"></div>\n      <p style="margin:0;color:#B8AC9E;font-size:12px;text-align:center;">Founder alert · nothing to do, dispatch is handling it</p>\n    </td></tr>\n  </table>\n</td></tr></table>`;
  const plain = [
    `💬 Booking request #${r.id} · ${r.service_name || "request"} · ${area || "Madrid"} · via ${origin}`,
    when1 ? `When: ${when1}` : "",
    fullName ? `Name: ${fullName}` : "Name: not given",
    r.client_phone ? `WhatsApp: ${r.client_phone}` : "",
    r.contact_email ? `Email: ${r.contact_email}` : "Email: not given",
    dispatchLine,
    custWa ? `Reply to customer: ${custWa}` : "",
  ].filter(Boolean).join("\n");
  const subject = `💬 ${r.service_name || "Booking request"} · ${area || "Madrid"} · #${r.id}${isTest ? " · test" : inHours ? " · dispatching" : " · at 09:00"}`;
  const e = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject, html, text: plain }) });
  console.log(`[notify] slim founder email status=${e.status}`);
}

export function start(opts: { resendKey: string; waToken: string; opsKey?: string; studioCheckPage?: boolean }) {
  RESEND_API_KEY = opts.resendKey;
  WA_TOKEN = opts.waToken;
  OPS_KEY = opts.opsKey || Deno.env.get("OPS_KEY") || "";
  CHECK_PAGE = opts.studioCheckPage === true;

  Deno.serve(async (req: Request) => {
  let payload: any;
  try { payload = await req.json(); } catch { return new Response("bad body", { status: 200 }); }
  const { type, table, record } = payload;
  if (type !== "INSERT" || table !== "whatsapp_requests" || !record) return new Response("OK", { status: 200 });
  const r = record;

  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const H = { "apikey": svcKey, "Authorization": `Bearer ${svcKey}` };

  // v15: unassigned requests from the bot or the booking card belong to
  // dispatch-studios. Do not email studios, do not message the customer, do
  // not touch the stage. Slim card to Jordan, done.
  const newFlow = !r.partner_id && /booking-card|whatsapp-bot/i.test(String(r.message_text || ""));
  if (newFlow) {
    await slimFounderCard(r, areaFromRequest(r));
    return new Response("OK", { status: 200 });
  }

  let reqCount = 1;
  try {
    const key = r.partner_id ? `partner_id=eq.${r.partner_id}` : `studio_name=eq.${encodeURIComponent(r.studio_name)}`;
    const cRes = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?${key}&select=id`, { headers: { ...H, "Prefer": "count=exact" }, method: "HEAD" });
    const range = cRes.headers.get("content-range");
    if (range && range.includes("/")) reqCount = Number(range.split("/")[1]) || 1;
  } catch (_e) { /* keep 1 */ }

  let studioStatus = "", outreach = "", studioEmail = "", studioWaRaw = "", studioOpted = false, studioClosed: string | null = null, studioBiz = "";
  if (r.partner_id) {
    try {
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${r.partner_id}&select=status,outreach_status,phone,whatsapp,email,opted_out_at,opening_hours,business_name`, { headers: H });
      const ps = await pRes.json().catch(() => []);
      if (Array.isArray(ps) && ps[0]) {
        studioStatus = ps[0].status || ""; outreach = ps[0].outreach_status || "never contacted";
        studioBiz = ps[0].business_name || "";
        studioEmail = ps[0].email || "";
        studioWaRaw = ps[0].whatsapp || ps[0].phone || "";
        studioOpted = !!ps[0].opted_out_at;
        studioClosed = closedReason(ps[0].opening_hours, r);
      }
    } catch (_e) { /* optional */ }
  }

  const when1 = [r.day1, r.time1].filter(Boolean).join(" ");
  const when2 = [r.day2, r.time2].filter(Boolean).join(" ");
  const when3 = [r.day3, r.time3].filter(Boolean).join(" ");
  const price = r.price ? `€${r.price}` : "";
  // v18: the times as a studio reads them (Spanish, no hour twice, no
  // hour-less duplicate of the same day).
  const slots = slotsEs(r);
  const timeOpts = slots;
  const isTest = isTestContact(r.contact_email, r.first_name) || isTestPhone(r.client_phone);

  // --- Chosen studio path: auto-email that one studio ---
  let autoOffered = false;
  const canAutoOffer = !!(r.partner_id && r.offer_token && studioEmail && timeOpts.length && outreach !== "bounced" && !studioOpted && !isTest && !studioClosed);
  if (studioClosed) console.log(`[notify] chosen studio not emailed: ${studioClosed}`);
  if (canAutoOffer) {
    const studioLabel = studioBiz || String(r.studio_name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
    const mail = offerEmail(r, slots, "", studioStatus !== "active" && r.slug ? r.slug : "", studioLabel, { chosen: true });
    try {
      const sRes = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM_EMAIL, to: [studioEmail], reply_to: REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text }) });
      autoOffered = sRes.ok;
      console.log(`[notify] auto studio offer -> ${studioEmail}: status=${sRes.status}`);
      if (autoOffered) {
        await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${r.id}`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json", "Prefer": "return=minimal" }, body: JSON.stringify({ stage: "studio_asked", studio_offered_at: new Date().toISOString(), studio_asked_at: new Date().toISOString() }) });
        await copyToJordan(OPS_KEY, studioLabel || studioEmail, waNum(studioWaRaw), mail.subject, mail.text);
      }
    } catch (e) { console.log("[notify] auto offer failed", String(e)); }
  }

  // --- No studio chosen: find bookable candidates, fall back to closest ---
  const area = areaFromRequest(r);
  let picks: Opt[] = [];
  let areaMissed = false; // true = nothing bookable in their area, picks are the closest instead
  if (!r.partner_id) {
    try {
      picks = await matchStudios(r, H, area || null);
      if (!picks.length && area) { areaMissed = true; picks = await matchStudios(r, H, null); }
    } catch (e) { console.log("[notify] match failed", String(e)); }
  }

  // --- Auto-email the candidates (first tap wins) ---
  const offeredNames: string[] = [];
  const closedNames: string[] = [];
  if (!r.partner_id && picks.length && r.offer_token && timeOpts.length && !isTest) {
    try {
      const ids = picks.map((o) => o.id).join(",");
      const eRows = await (await fetch(`${SUPABASE_URL}/rest/v1/partners?id=in.(${ids})&select=id,email,opted_out_at,outreach_status,status,slug,opening_hours`, { headers: H })).json().catch(() => []);
      const byId: Record<string, any> = {};
      for (const p of (Array.isArray(eRows) ? eRows : [])) byId[p.id] = p;
      // v18: who will really get the email is known before the first one goes,
      // so "Estoy preguntando a varios centros" is only said when it is true.
      const sendTo: Array<{ o: Opt; p: any }> = [];
      for (const o of picks) {
        const p = byId[o.id];
        if (!p || !p.email || p.opted_out_at || p.outreach_status === "bounced") continue;
        // v16: their own hours say closed for this day or time: no offer.
        const why = closedReason(p.opening_hours, r);
        if (why) { closedNames.push(`${o.business_name} (${why})`); console.log(`[notify] skip ${o.business_name}: ${why}`); continue; }
        sendTo.push({ o, p });
      }
      for (const { o, p } of sendTo) {
        const mail = offerEmail(r, slots, `&p=${o.id}`, p.status !== "active" && p.slug ? p.slug : "", o.business_name, { several: sendTo.length > 1 });
        const sRes = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM_EMAIL, to: [p.email], reply_to: REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text }) });
        console.log(`[notify] multi offer -> ${o.business_name} (${p.email}): status=${sRes.status}`);
        if (sRes.ok) {
          offeredNames.push(o.business_name);
          await copyToJordan(OPS_KEY, o.business_name, waNum(o.wa || ""), mail.subject, mail.text);
        }
      }
      if (offeredNames.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${r.id}`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json", "Prefer": "return=minimal" }, body: JSON.stringify({ stage: "studio_asked", studio_offered_at: new Date().toISOString(), studio_asked_at: new Date().toISOString(), stage_note: `auto-offered to: ${offeredNames.join(", ")}${closedNames.length ? " | not offered (closed by their hours): " + closedNames.join(", ") : ""}` }) });
      }
    } catch (e) { console.log("[notify] multi offer failed", String(e)); }
  }

  // --- Tell the customer we are on it (WhatsApp, their language) ---
  // Only for bot-origin requests with no chosen studio: their 24h window is open
  // and they would otherwise hear nothing until a studio answers.
  let custAcked = false;
  const fromBot = /whatsapp-bot/i.test(String(r.message_text || "")) || !!r.wa_number;
  if (!r.partner_id && fromBot && r.client_phone) {
    const to = waNum(r.client_phone);
    if (to && to.length >= 9) {
      const es = String(r.languages || "").toLowerCase().startsWith("es");
      const names = offeredNames.slice(0, 3).join(", ");
      const areaTxt = area || "Madrid";
      const svcTxt = es ? svcEsFrase(r.service_name).replace(/^un /, "") : svcEn(r.service_name);
      const who = names || (es ? `centros de masaje en ${areaTxt}` : `massage studios in ${areaTxt}`);
      const body = es
        ? `Novedades${r.first_name ? `, ${r.first_name}` : ""}: estamos contactando ahora mismo con ${who} para tu ${svcTxt}. En cuanto un centro confirme tu hora y la mejor opción, te escribimos por aquí. No tienes que hacer nada más.`
        : `Quick update${r.first_name ? `, ${r.first_name}` : ""}: we are reaching out to ${who} right now about your ${svcTxt}. As soon as a studio confirms your time and the best option, we will message you here. Nothing else needed from you.`;
      try {
        const wRes = await fetch(GRAPH, { method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }) });
        custAcked = wRes.ok;
        console.log(`[notify] customer ack -> ${to}: status=${wRes.status}`);
        if (custAcked) {
          await logWaMsg(H, to, body);
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${r.id}`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json", "Prefer": "return=minimal" }, body: JSON.stringify({ acknowledged_at: new Date().toISOString() }) });
        }
      } catch (e) { console.log("[notify] customer ack failed", String(e)); }
    }
  }

  // --- Leads block: places in their area we have not onboarded yet ---
  let leads: any[] = [];
  if (!r.partner_id && areaMissed && area) {
    try {
      const lRes = await fetch(`${SUPABASE_URL}/rest/v1/partners?or=(neighbourhood.ilike.*${encodeURIComponent(area)}*,city.ilike.*${encodeURIComponent(area)}*)&opted_out_at=is.null&select=business_name,whatsapp,phone,email,venue_type,google_rating,google_reviews&order=google_reviews.desc.nullslast&limit=6`, { headers: H });
      const lRows = await lRes.json().catch(() => []);
      if (Array.isArray(lRows)) {
        leads = lRows.sort((a: any, b: any) => (a.venue_type === "massage" ? 0 : 1) - (b.venue_type === "massage" ? 0 : 1)).slice(0, 3);
      }
    } catch (e) { console.log("[notify] leads lookup failed", String(e)); }
  }

  // --- The texts Jordan sends to studios by hand (wa.me links) ---
  // v18: the same voice as the offer email. The intro line and the signature
  // only go to a number we have never written to; the several-centres line
  // only when more than one studio is in play; the date in full, because
  // Jordan may tap the link hours later.
  const waDigits = waNum(studioWaRaw);
  const relayNums = [...new Set([waDigits, ...picks.map((o) => waNum(o.wa || "")), ...leads.map((l: any) => waNum(l.whatsapp || l.phone || ""))].filter((n) => n && n.length >= 9))];
  const talked = new Set<string>();
  if (relayNums.length) {
    try {
      const tRows = await (await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=in.(${relayNums.join(",")})&direction=eq.out&select=phone&limit=1000`, { headers: H })).json().catch(() => []);
      for (const x of (Array.isArray(tRows) ? tRows : [])) talked.add(String(x.phone || ""));
    } catch (e) { console.log("[notify] wa_messages lookup failed", String(e)); }
  }
  const relayWhen = whenLine(slots);
  const studioAsk = (kind: "chosen" | "option" | "lead", num: string, several: boolean): string => {
    const intro = !talked.has(num);
    const first = cleanFirst(r.first_name);
    const what = `${svcConUn(r.service_name)} de ${reqMins(r)} min${relayWhen ? " " + relayWhen : ""}`;
    const parts = ["Hola, buenas."];
    if (intro) parts.push("Somos Massage Club, un servicio de reservas de masajes en Madrid.");
    if (kind === "chosen") parts.push(`${first || "Un cliente"} os ha elegido para ${what}.`);
    else if (kind === "lead") parts.push(`Tengo un cliente${area && !/^madrid$/i.test(area) ? ` por la zona de ${area}` : ""} que busca ${what}.`, "Paga directamente en el centro.");
    else parts.push(`Tengo un cliente${first ? `, ${first},` : ""} que busca ${what}.`);
    parts.push("¿Tenéis hueco?");
    // The customer chose this one studio, so "varios centros" would be untrue.
    if (several && kind !== "chosen") parts.push("Estoy preguntando a varios centros y se queda con la mejor oferta.");
    parts.push("Si podéis hacerle un 10% como cliente de Massage Club, decídmelo al contestar.");
    return parts.join(" ") + (intro ? "\n\nJordan, de Massage Club" : "");
  };

  // --- Founder email pieces ---
  let optionsBlock = "";
  let optionsPlain: string[] = [];
  if (picks.length) {
    const nums = ["1⃣", "2⃣", "3⃣"];
    const lines = picks.map((o, i) => `${nums[i]} ${o.business_name} · ${o.area} · ${o.google_rating != null ? `⭐${o.google_rating}` : "⭐-"} · ${o.svc} ${o.duration} min · €${o.price}`);
    const custText = [`Good options for you:`, ...lines, ``, `Reply 1, 2 or 3 and I'll confirm your time with them. You pay at the studio, no fee.`].join("\n");
    const custNum = waNum(r.client_phone || "");
    const sendOffer = custNum ? `https://wa.me/${custNum}?text=${encodeURIComponent(custText)}` : "";
    const relayFor = (o: Opt) => {
      const num = waNum(o.wa || "");
      const msg = studioAsk("option", num, picks.length > 1);
      return num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : "";
    };
    const cards = picks.map((o, i) => {
      const rl = relayFor(o);
      const emailed = offeredNames.includes(o.business_name);
      const closed = closedNames.find((c) => c.startsWith(o.business_name + " ("));
      return `\n      <tr><td style="padding:0 0 10px;">\n        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:14px;background:${C.cream};">\n          <tr><td style="padding:13px 16px;">\n            <p style="margin:0;color:${C.ink};font-size:15px;font-weight:700;font-family:${SANS};">${nums[i]} ${esc(o.business_name)}${emailed ? ` <span style=\"color:#1A7F42;font-size:12px;\">· emailed ✅</span>` : closed ? ` <span style=\"color:#B91C1C;font-size:12px;\">· not emailed, ${esc(closed.slice(o.business_name.length + 2, -1))}</span>` : ""}</p>\n            <p style="margin:3px 0 0;color:${C.muted};font-size:12.5px;">${esc(o.area)} · ${esc(o.venue_type)}${o.google_rating != null ? ` · ★ ${esc(String(o.google_rating))}${o.google_reviews != null ? ` (${esc(String(o.google_reviews))})` : ""}` : ""}</p>\n            <p style="margin:6px 0 0;color:${C.ink};font-size:13.5px;font-weight:600;">${esc(o.svc)} · ${o.duration} min · €${o.price}</p>\n            ${rl ? `<a href="${rl}" style="display:inline-block;margin-top:9px;background:#1FA855;color:#fff;font-size:12.5px;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:999px;">Ask this studio →</a>` : `<p style="margin:9px 0 0;color:#B91C1C;font-size:12px;">No WhatsApp on file</p>`}\n          </td></tr>\n        </table>\n      </td></tr>`;
    }).join("");
    const introTxt = areaMissed
      ? `Nothing bookable in ${esc(area)} yet, so these are the closest bookable matches — real massage places first.`
      : `No studio was chosen, so here are the best matches — real massage places first.`;
    optionsBlock = `\n      <div style="margin-top:22px;">\n        <p style="margin:0 0 4px;color:${C.clay};font-size:11px;font-weight:700;letter-spacing:2px;font-family:${SANS};">SEND THESE THREE — ONE TAP</p>\n        <p style="margin:0 0 12px;color:${C.muted};font-size:12.5px;font-family:${SANS};line-height:1.5;">${introTxt}</p>\n        ${sendOffer ? `<a href="${sendOffer}" style="display:block;background:#1FA855;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 18px;border-radius:999px;text-align:center;margin:0 0 14px;font-family:${SANS};">💬 Send these options to ${esc(r.first_name || "the customer")}</a>` : `<p style="margin:0 0 14px;color:#B91C1C;font-size:12.5px;font-family:${SANS};">No WhatsApp number left — reply by email instead.</p>`}\n        <table width="100%" cellpadding="0" cellspacing="0">${cards}</table>\n      </div>`;
    optionsPlain = ["", "Send these options:", ...lines, sendOffer ? `One tap: ${sendOffer}` : ""].filter(Boolean);
  }

  let leadsBlock = "";
  let leadsPlain: string[] = [];
  if (leads.length) {
    const leadCards = leads.map((l: any) => {
      const num = waNum(l.whatsapp || l.phone || "");
      const msg = studioAsk("lead", num, leads.length + picks.length > 1);
      const link = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : "";
      return `\n      <tr><td style="padding:0 0 10px;">\n        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:14px;background:#fff;">\n          <tr><td style="padding:13px 16px;">\n            <p style="margin:0;color:${C.ink};font-size:15px;font-weight:700;font-family:${SANS};">${esc(l.business_name)}</p>\n            <p style="margin:3px 0 0;color:${C.muted};font-size:12.5px;">${esc(area)} · ${esc(l.venue_type || "massage")}${l.google_rating != null ? ` · ★ ${esc(String(l.google_rating))}${l.google_reviews != null ? ` (${esc(String(l.google_reviews))})` : ""}` : ""}</p>\n            ${link ? `<a href="${link}" style="display:inline-block;margin-top:9px;background:#1FA855;color:#fff;font-size:12.5px;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:999px;">Ask on WhatsApp →</a>` : `<p style="margin:9px 0 0;color:#B91C1C;font-size:12px;">No number on file</p>`}\n          </td></tr>\n        </table>\n      </td></tr>`;
    }).join("");
    leadsBlock = `\n      <div style="margin-top:22px;">\n        <p style="margin:0 0 4px;color:${C.clay};font-size:11px;font-weight:700;letter-spacing:2px;font-family:${SANS};">IN ${esc(area.toUpperCase())} · NOT ONBOARDED YET</p>\n        <p style="margin:0 0 12px;color:${C.muted};font-size:12.5px;font-family:${SANS};line-height:1.5;">These places are in the customer's area but have no email or menu with us yet, so the automation could not contact them. One tap opens WhatsApp with the request already written in Spanish.</p>\n        <table width="100%" cellpadding="0" cellspacing="0">${leadCards}</table>\n      </div>`;
    leadsPlain = ["", `In ${area}, not onboarded yet (tap to ask on WhatsApp):`, ...leads.map((l: any) => `- ${l.business_name} (${l.whatsapp || l.phone || "no number"})`)];
  }

  const relayMsg = studioAsk("chosen", waDigits, false);
  const relayUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(relayMsg)}` : "";

  const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ");
  const rows = [
    rowKV("Service", esc([r.service_name, price].filter(Boolean).join(" · ")), true),
    when1 ? rowKV("First choice", esc(when1)) : "",
    when2 ? rowKV("Backup", esc(when2)) : "",
    when3 ? rowKV("Backup 2", esc(when3)) : "",
    rowKV("Name", esc(fullName)),
    r.client_phone ? rowKV("WhatsApp", esc(r.client_phone), true) : "",
    rowKV("Email", r.contact_email ? esc(r.contact_email) : `<span style="color:#B91C1C;">none left</span>`),
    r.partner_id ? rowKV("Requests for this studio", `${reqCount} total`, true) : "",
    studioStatus ? rowKV("Studio status", esc(`${studioStatus} · outreach: ${outreach}`)) : "",
    r.partner_id ? (autoOffered ? rowKV("Studio auto-emailed", "✅ one-tap time links sent", true) : rowKV("Studio auto-email", studioClosed ? `not sent, ${esc(studioClosed)}` : "not sent, handle manually")) : "",
    !r.partner_id ? (offeredNames.length ? rowKV("Studios auto-emailed", `✅ ${esc(offeredNames.join(", "))}`, true) : (isTest ? rowKV("Studios auto-emailed", "skipped — test contact") : rowKV("Studios auto-emailed", closedNames.length ? `none, closed by their hours: ${esc(closedNames.join(", "))}` : "none reachable by email"))) : "",
    !r.partner_id && closedNames.length && offeredNames.length ? rowKV("Not emailed (closed)", esc(closedNames.join(", "))) : "",
    !r.partner_id && fromBot ? rowKV("Customer auto-messaged", custAcked ? "✅ told we are contacting studios" : "⚠️ WhatsApp send failed", true) : "",
  ].join("");

  const msgBubble = r.message_text ? `\n    <div style="background:#ECE5DD;border-radius:14px;padding:14px;margin-top:18px;">\n      <p style="margin:0 0 6px;color:${C.muted};font-size:11px;font-weight:700;letter-spacing:2px;">REQUEST DETAILS</p>\n      <div style="background:${C.wa};border-radius:12px 12px 4px 12px;padding:12px 14px;">\n        <p style="margin:0;color:#111;font-size:13.5px;line-height:1.55;white-space:pre-line;">${esc(r.message_text)}</p>\n      </div>\n    </div>` : "";

  const custDigits = waNum(r.client_phone || "");
  const custWa = custDigits ? `https://wa.me/${custDigits}` : "";

  const relayBlock = `\n    <div style="text-align:center;padding-top:18px;">\n      ${custWa ? `<a href="${custWa}" style="display:inline-block;background-color:#1FA855;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:999px;margin:4px;">💬 Reply to the customer</a>` : ""}\n      ${relayUrl ? `<a href="${relayUrl}" style="display:inline-block;background-color:${C.cream};color:#1FA855;border:1px solid ${C.line};font-size:14px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:999px;margin:4px;">→ Relay to studio</a>` : ""}\n    </div>`;

  const headline = r.partner_id ? esc(r.studio_name) : esc(r.service_name || "New request");
  const subhead = r.partner_id
    ? (autoOffered ? `<p style="margin:8px 0 0;color:#1A7F42;font-size:13px;font-weight:600;">Studio emailed automatically with one-tap times. You'll be told when they pick.</p>` : "")
    : (offeredNames.length
      ? `<p style="margin:8px 0 0;color:#1A7F42;font-size:13px;font-weight:600;">${offeredNames.length} studio${offeredNames.length > 1 ? "s" : ""} emailed automatically with one-tap times. First to accept wins${custAcked ? " and the customer knows we are on it" : ""}.</p>`
      : `<p style="margin:8px 0 0;color:${C.muted};font-size:13px;">${esc(area || "Madrid")} · no studio chosen yet${custAcked ? " · customer told we are on it" : ""}</p>`);

  const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center">\n  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;">\n    <tr><td style="padding:26px 34px 0;text-align:center;">\n      <img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;">\n      <p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p>\n    </td></tr>\n    <tr><td style="padding:26px 34px 0;text-align:center;">\n      <span style="display:inline-block;background:${C.cream};color:${C.clay};font-size:11px;font-weight:700;letter-spacing:2.5px;padding:7px 16px;border-radius:999px;">BOOKING REQUEST #${r.id}</span>\n      <h1 style="margin:16px 0 0;color:${C.ink};font-size:27px;line-height:1.2;font-family:${SERIF};font-weight:700;">${headline}</h1>\n      ${subhead}\n    </td></tr>\n    <tr><td style="padding:18px 34px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table></td></tr>\n    <tr><td style="padding:0 34px;">${optionsBlock}${leadsBlock}${msgBubble}${relayBlock}</td></tr>\n    <tr><td style="padding:24px 34px 26px;">\n      <div style="border-top:2px dashed ${C.dash};margin-bottom:16px;"></div>\n      <p style="margin:0;color:#B8AC9E;font-size:12px;text-align:center;">Founder alert</p>\n    </td></tr>\n  </table>\n</td></tr></table>`;

  const lines = [
    `💬 Booking request #${r.id} · ${r.partner_id ? `${r.studio_name} (${reqCount} total)` : `${r.service_name || "request"} · ${area || "Madrid"}`}`,
    r.service_name ? `Service: ${r.service_name}${price ? ` · ${price}` : ""}` : "",
    when1 ? `Times: ${[when1, when2, when3].filter(Boolean).join(" / ")}` : "",
    fullName ? `Name: ${fullName}` : "",
    r.client_phone ? `WhatsApp: ${r.client_phone}` : "",
    r.contact_email ? `Email: ${r.contact_email}` : "No email left",
    r.partner_id ? (autoOffered ? `✅ Studio auto-emailed with one-tap times` : `⚠️ Studio NOT auto-emailed: ${studioClosed || "handle manually"}`) : "",
    !r.partner_id && offeredNames.length ? `✅ Auto-emailed: ${offeredNames.join(", ")} (first tap wins)` : "",
    !r.partner_id && closedNames.length ? `Not emailed, closed by their hours: ${closedNames.join(", ")}` : "",
    !r.partner_id && fromBot ? (custAcked ? `✅ Customer auto-messaged: we are contacting studios` : `⚠️ Customer WhatsApp ack failed`) : "",
    ...optionsPlain,
    ...leadsPlain,
    custWa ? `Reply to customer: ${custWa}` : "",
    relayUrl ? `Relay to studio: ${relayUrl}` : "",
  ].filter(Boolean);
  const plain = lines.join("\n");

  const tgToken = Deno.env.get("TELEGRAM_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN");
  const tgChat = Deno.env.get("TELEGRAM_CHAT_ID") || Deno.env.get("ADMIN_TELEGRAM_CHAT_ID");
  if (tgToken && tgChat) {
    const t = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: tgChat, text: plain }) });
    console.log(`[notify] telegram status=${t.status}`);
  }

  const subject = r.partner_id
    ? `💬 ${r.studio_name} · ${r.service_name || "Booking request"}${autoOffered ? " · studio auto-emailed ✅" : ""}`
    : `💬 ${r.service_name || "Booking request"} · ${area || "Madrid"}${offeredNames.length ? ` · ${offeredNames.length} studios emailed ✅` : (picks.length ? ` · ${picks.length} options ready` : "")}`;

  const e = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject, html, text: plain }) });
  console.log(`[notify] email status=${e.status}`);
  return new Response("OK", { status: 200 });
  });
}
