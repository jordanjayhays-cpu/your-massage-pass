// dispatch-studios — one customer request goes out to several studios at once.
//
// The old flow asked the customer to choose a studio, then messaged that one
// studio and waited. Four of our six real booking attempts died in that wait.
// This asks up to DEFAULT_FANOUT studios simultaneously with the approved
// "solicitud_reserva" template; the first to accept takes the booking and the
// rest are told, politely, that it is covered.
//
// v3: sweep keys on partner_id null instead of stage; Jordan's number is a test customer.
// v4: a second request from the same phone within 24h is a duplicate, not a new fan-out.
// v5 (5 Sept): studios read the service in Spanish with the duration
//   ("Masaje relajante 60 min"), never a raw "Not sure" or "Relaxing", and the
//   founder email lists who was asked in plain words instead of JSON.
// v6 (5 Sept): best offer wins. The ask tells the studio, truthfully, that
//   several studios in the area were asked and the client goes with the best
//   offer, and invites a 10% discount. wa-bot v46 runs the bidding window;
//   "accepted" studios that did not win are stood down like pending ones.
// v7 (5 Sept): price hunt. { cheapest: true } picks candidates by listed
//   60 min relaxing price (cheapest_candidates), { force_dispatch: true } skips
//   the same-customer duplicate rule for a deliberate second fan-out.
// v8 (5 Sept): in price-hunt mode the ask states the client's budget honestly
//   and invites any discount (10%, 15%, 20%); the highest written discount wins.
// v9 (6 Sept): the duration the customer asked for ("Duración: 90 min" in
//   message_text, written by wa-bot v48) reaches the studio instead of a fixed 60.
// v10 (6 Sept): { request_id, extra: true, partner_ids: [...] } is a second wave
//   on a request that is already out: never re-asks a studio, keeps the stage,
//   tells the customer "N more studios".
// v11 (6 Sept): { notify: { request_id, text, short } } sends one note to every
//   studio still in play (free text inside their window, aviso_centro_v1
//   otherwise); { customer_text: { request_id, text } } sends a plain text to
//   the customer. Ops key only.
// v12 (6 Sept): the human studio ask (solicitud_reserva_v2) with the day's date
//   and three buttons, falling back to the old template until Meta approves it.
// v13 (6 Sept): the date the customer tapped ("Fecha: ..." from wa-bot v50)
//   is what the studio reads, not a guess from "Hoy"/"Mañana" at send time.
// v14 (6 Sept): { send: { phone, text } } plain text to any number that has
//   written to the bot, for the watch to answer someone the bot left hanging.
// v17 (8 Sept): a repeat from the same customer that carries new information is
//   a change, not a duplicate. The old studios are stood down, the old request
//   is closed, and the new one goes out. Fernando restated his service once and
//   his day twice on 7 Sept and all three were binned while he was told the
//   studios were being asked.
// v16 (6 Sept): a studio whose opening hours say it is closed on the day (or at
//   the time) the customer asked for is not asked. Calma Madrid, closed on
//   Sundays with hours on file since 18 Aug, was asked for Sunday slots three
//   times in one weekend and wrote to complain. Unknown hours still get asked.
//
// Modes (POST):
//   { request_id: 42 }              dispatch that request now
//   { sweep: true }                 dispatch every request still waiting
//   { won: { request_id, partner_id } }  stand down everyone who did not win
//   { request_id, dry_run: true }   show who would be asked, send nothing
//
// Auth: ops key (?key= or body.key) or the service role bearer.
//
// SAFETY
//  - Test customers never reach a real studio (same rules as studio-ask).
//  - Nothing is sent outside 09:00-21:00 Madrid; the sweep picks it up later.
//  - A studio is never asked more than twice in 24h (enforced in SQL).
//  - A studio is never asked for a day or time its own hours say it is closed.

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const OPS_KEY = Deno.env.get("OPS_KEY") || "";
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const SUPPORT = ["support@massageclub.io"];
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ||
  "";
const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || "1270437552818077";
const GRAPH = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;

// How many studios one request goes out to. Raising this raises how many
// businesses we message per customer, so change it deliberately.
const DEFAULT_FANOUT = 5;

const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

const JORDAN_NUMBERS = ["15622355063", "34612474827", "34613977900"];
const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu", "guest@massageclub.io"];
const TEST_DOMAINS = ["testing.com", "example.com", "test.com", "placeholder.local", "mailinator.com", "example.org"];
// Jordan's own number counts as a test customer too: his bookings must never
// reach a real studio, even though the same number is a safe destination.
const TEST_PHONES = ["15622355063", "17867276503", "34612474827"];

const svc = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const H = () => ({ apikey: svc(), Authorization: `Bearer ${svc()}`, "Content-Type": "application/json" });

const digits = (s: string) => String(s || "").replace(/[^0-9]/g, "");
function toWa(numRaw: string): string {
  let n = digits(numRaw);
  if (n.length === 9 && /^[6789]/.test(n)) n = "34" + n;
  return n;
}
const isTestPhone = (p: string) => {
  const d = digits(p);
  if (TEST_PHONES.includes(d)) return true;
  if (d.startsWith("86") && d.endsWith("997")) return true;
  return false;
};
const isTestCustomer = (r: Record<string, unknown>) => {
  const e = String(r.contact_email || "").toLowerCase();
  const n = String((r.first_name || "") + " " + (r.last_name || "")).toLowerCase();
  if (isTestPhone(String(r.client_phone || ""))) return true;
  if (TEST_EMAILS.includes(e)) return true;
  if (TEST_DOMAINS.some((d) => e.endsWith("@" + d))) return true;
  if (/\+(mctest|uitest)/.test(e)) return true;
  if (/\btest\b|\bprueba\b/.test(n)) return true;
  return false;
};

const param = (s: string, max = 120) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max) || "-";

// v5: the studio reads the service in its own language. "Not sure" and
// "Relaxing" went out raw to KamAI Spa on 5 Sept.
const SVC_ES: Array<[RegExp, string]> = [
  [/deep tissue|descontract/i, "Masaje descontracturante"], [/thai|tailand/i, "Masaje tailandés"],
  [/hot stone|piedras/i, "Masaje de piedras calientes"], [/sport|deportiv/i, "Masaje deportivo"],
  [/balin/i, "Masaje balinés"], [/shiatsu/i, "Shiatsu"], [/reflexolog/i, "Reflexología"],
  [/lymphatic|linf/i, "Drenaje linfático"], [/couples|pareja/i, "Masaje en pareja"],
  [/kobido|facial/i, "Masaje facial Kobido"], [/prenatal|embaraz/i, "Masaje prenatal"],
  [/head|scalp|cabeza/i, "Masaje de cabeza"], [/foot|feet|pies/i, "Masaje de pies"],
  [/four hands|cuatro manos/i, "Masaje a cuatro manos"], [/gua sha/i, "Gua sha"],
  [/relax|relaj|not sure|^massage$|massage treatment|^masaje$/i, "Masaje relajante"],
];
function svcEs(name: unknown): string {
  const s = String(name || "").trim();
  for (const [re, v] of SVC_ES) if (re.test(s)) return v;
  return s ? `Masaje ${s.toLowerCase()}` : "Masaje relajante";
}
// v9: wa-bot writes "Duración: 90 min" into message_text when the customer asked
// for more than an hour. Anything else is the usual 60.
const reqDuration = (r: Record<string, unknown>): number => {
  const m = String(r.message_text || "").match(/Duraci[oó]n: (\d{2,3}) min/);
  return m ? parseInt(m[1], 10) : 60;
};

function madridHour(): number {
  const s = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date());
  return parseInt(s, 10);
}
const withinSendingHours = () => {
  const h = madridHour();
  return h >= OPEN_HOUR && h < CLOSE_HOUR;
};

async function sq(path: string, init?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...(init || {}), headers: { ...H(), ...((init?.headers as Record<string, string>) || {}) } });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt; }
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: H(), body: JSON.stringify(args) });
  const out = await res.json().catch(() => []);
  return Array.isArray(out) ? out : [];
}

async function logMsg(phone: string, body: string, type = "template") {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wa_messages`, {
      method: "POST", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ phone, direction: "out", msg_type: type, body: body.slice(0, 2000) }),
    });
  } catch (_e) { /* non-fatal */ }
}

async function logEvent(phone: string, event: string, meta: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/funnel_events`, {
      method: "POST", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ phone: digits(phone), event, meta }),
    });
  } catch (_e) { /* non-fatal */ }
}

async function sendText(to: string, body: string) {
  const res = await fetch(GRAPH, {
    method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: false } }),
  });
  if (res.ok) await logMsg(to, body, "text");
  else console.log("[dispatch] text send failed", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

async function founderEmail(subject: string, lines: string[]) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: SUPPORT, subject, html: `<p style=\"font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#262019;\">${lines.join("<br>")}</p>`, text: lines.join("\n") }),
    });
  } catch (_e) { /* non-fatal */ }
}

type Candidate = { id: string; business_name: string; area: string | null; wa: string; km: number | null; rank: number; widened: boolean; score: number };

// v6: the honest leverage, in the ask itself. Several studios really are asked,
// and the client really does go with the best offer.
const BEST_OFFER_LINE = "Consultamos a varios centros de la zona y el cliente irá con la mejor oferta. Si podéis hacerle un 10% de descuento, escribid 10% al confirmar.";
// v8: a price hunt says what the client is looking for and takes any discount.
const PRICE_HUNT_LINE = "El cliente busca el mejor precio por 60 min (presupuesto en torno a 35-40 EUR). Consultamos a varios centros y se irá con la mejor oferta: al confirmar, escribid el descuento que podéis hacerle (10%, 15%, 20%).";

// v12 (6 Sept): the studio reads the day with its date. "Mañana" tapped at 1am
// meant Sunday to the customer and Monday to every studio (request #55).
const ES_DAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
function dayLabelEs(day1: unknown, messageText?: unknown): string {
  const d = String(day1 || "").trim();
  const fmt = (t: Date) => ES_DAY.format(t).replace(",", "");
  const today = fmt(new Date()), tomorrow = fmt(new Date(Date.now() + 86400e3));
  // v13: wa-bot v50 stores the date the customer actually tapped ("Fecha: domingo
  // 6 de septiembre"); that beats guessing from "Hoy"/"Mañana" at send time.
  const fm = String(messageText || "").match(/Fecha: ([^|]+)/);
  if (fm) {
    const f = fm[1].trim().toLowerCase();
    if (f === today.toLowerCase()) return `hoy, ${f}`;
    if (f === tomorrow.toLowerCase()) return `mañana, ${f}`;
    return f;
  }
  if (/^(hoy|today)$/i.test(d)) return `hoy, ${today}`;
  if (/^(ma[nñ]ana|tomorrow)$/i.test(d)) return `mañana, ${tomorrow}`;
  return d || "día por concretar";
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
function requestDate(r: Record<string, unknown>): Date | null {
  const today = madridToday();
  const plus = (n: number) => new Date(today.getTime() + n * 86400e3);
  const texts = [String(r.message_text || "").match(/Fecha: ([^|]+)/)?.[1] || "", String(r.day1 || "")];
  for (const t0 of texts) {
    const t = stripAccents(t0.toLowerCase()).trim();
    if (!t) continue;
    if (/^(hoy|today)\b/.test(t)) return today;
    if (/^(manana|tomorrow)\b/.test(t)) return plus(1);
    const dm = t.match(/(\d{1,2})\s*(?:de\s+)?([a-z]{3})[a-z]*/);
    if (dm && MONTHS[dm[2]] !== undefined) {
      let dt = new Date(Date.UTC(today.getUTCFullYear(), MONTHS[dm[2]], parseInt(dm[1], 10)));
      if (dt.getTime() < today.getTime() - 30 * 86400e3) dt = new Date(Date.UTC(today.getUTCFullYear() + 1, MONTHS[dm[2]], parseInt(dm[1], 10)));
      return dt;
    }
    const wd = t.match(/\b(sun|mon|tue|wed|thu|fri|sat|dom|lun|mar|mie|jue|vie|sab)[a-z]*\b/);
    if (wd && DAY_IDX[wd[1]] !== undefined) {
      const want = DAY_IDX[wd[1]];
      for (let n = 0; n < 7; n++) { const d = plus(n); if (d.getUTCDay() === want) return d; }
    }
  }
  return null;
}
const ES_WEEKDAY = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
// Why this studio should not be asked for this request, or null if it may be.
function closedReason(hoursText: unknown, r: Record<string, unknown>): string | null {
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
  return null;
}

// v12: the human ask (solicitud_reserva_v2, submitted 6 Sept 10:25): who we are,
// the client's name, service, day with date, time and area, the honest "others
// were asked" line and the 10% ask, three buttons (Sí, podemos / Otra hora / No
// podemos). Until Meta approves it the send fails with 132001 and we fall back
// to the old template. Price hunts keep the old template and its budget line.
const NEW_TEMPLATE = "solicitud_reserva_v2";
async function sendTemplate(to: string, name: string, params: string[], payloads: string[]): Promise<{ ok: boolean; status: number; out: string }> {
  const components: unknown[] = [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }];
  payloads.forEach((p, i) => components.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload: p }] }));
  const res = await fetch(GRAPH, {
    method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: "es" }, components } }),
  });
  const out = await res.text();
  return { ok: res.ok, status: res.status, out };
}

async function askOneStudio(r: Record<string, unknown>, c: Candidate, cheapest: boolean): Promise<{ ok: boolean; error?: string }> {
  const sameDay = /^(today|hoy)$/i.test(String(r.day1 || "").trim());
  const client = param(String(r.first_name || "Cliente"), 40);

  if (!cheapest) {
    const p2 = [client, param(`${svcEs(r.service_name).toLowerCase()} de ${reqDuration(r)} min`, 60), param(dayLabelEs(r.day1, r.message_text), 60), param(String(r.time1 || "hora por concretar"), 30), param(String(r.area || "Madrid"), 40)];
    const r2 = await sendTemplate(c.wa, NEW_TEMPLATE, p2, [`studio_confirm_${r.id}`, `studio_other_${r.id}`, `studio_no_${r.id}`]);
    console.log(`[dispatch] req=${r.id} studio=${c.business_name} to=${c.wa} tpl=${NEW_TEMPLATE} status=${r2.status} ${r2.out.slice(0, 160)}`);
    if (r2.ok) {
      await logMsg(c.wa, `[${NEW_TEMPLATE}] ${p2[0]}: ${p2[1]} | ${p2[2]} a las ${p2[3]}, cerca de ${p2[4]} (req #${r.id})`);
      return { ok: true };
    }
    // Anything other than "template not (yet) available" is a real failure.
    if (!/132001|template|does not exist|not found/i.test(r2.out)) return { ok: false, error: `${r2.status} ${r2.out.slice(0, 200)}` };
  }

  const service = param(`${svcEs(r.service_name)} ${reqDuration(r)} min${r.price ? " · " + r.price + " EUR" : ""}${cheapest ? ". " + PRICE_HUNT_LINE : (sameDay ? "" : ". " + BEST_OFFER_LINE)}`, 300);
  const when = param(`${dayLabelEs(r.day1, r.message_text)}${r.time1 ? ", " + r.time1 : ""}`);

  const res = await fetch(GRAPH, {
    method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: c.wa,
      type: "template",
      template: {
        name: "solicitud_reserva", language: { code: "es" },
        components: [
          { type: "body", parameters: [{ type: "text", text: service }, { type: "text", text: when }, { type: "text", text: client }] },
          { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: `studio_confirm_${r.id}` }] },
          { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: `studio_other_${r.id}` }] },
        ],
      },
    }),
  });
  const out = await res.text();
  console.log(`[dispatch] req=${r.id} studio=${c.business_name} to=${c.wa} status=${res.status} ${out.slice(0, 160)}`);
  if (res.ok) {
    await logMsg(c.wa, `[solicitud_reserva] ${service} | ${when} | ${client} (req #${r.id})`);
    return { ok: true };
  }
  return { ok: false, error: `${res.status} ${out.slice(0, 200)}` };
}

// Everyone who did not win hears back. These are the same businesses we are
// trying to recruit as partners, so silence would cost us more than it saves.
// v6: studios that said yes but did not give the best offer ("accepted") are
// stood down too, with a line that thanks them for the yes.
// v17: one note to every studio still in play on a request, free text inside
// their 24h window and aviso_centro_v1 outside it. Lifted out of the notify
// handler so the amendment path can stand studios down without a second call.
async function notifyStudios(requestId: number, text: string, short?: string, onlyIds?: string[]) {
  const reqRows = await sq(`whatsapp_requests?id=eq.${requestId}&select=id,first_name,time1,confirmed_time`);
  const rq = (Array.isArray(reqRows) && reqRows[0] ? reqRows[0] : {}) as Record<string, unknown>;
  const only = Array.isArray(onlyIds) && onlyIds.length ? new Set(onlyIds.map(String)) : null;
  const rows = await sq(`request_dispatch?request_id=eq.${requestId}&outcome=in.(pending,accepted,won)&select=id,partner_id,phone,outcome`);
  const out: Array<{ phone: string; how: string; ok: boolean }> = [];
  for (const row of (Array.isArray(rows) ? rows : [])) {
    if (only && !only.has(String(row.partner_id))) continue;
    const to = String(row.phone || "");
    const lastIn = await sq(`wa_messages?phone=eq.${to}&direction=eq.in&order=created_at.desc&limit=1&select=created_at`);
    const openWindow = Array.isArray(lastIn) && lastIn[0]?.created_at && (Date.now() - Date.parse(lastIn[0].created_at)) < 23.5 * 3600e3;
    let ok = false; let how = "text";
    if (openWindow) ok = await sendText(to, text);
    if (!ok) {
      how = "template";
      const params = [param(String(rq.first_name || "el cliente"), 40), param(String(rq.confirmed_time || rq.time1 || "-"), 20), param(String(short || text), 300)];
      const res = await fetch(GRAPH, {
        method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: "aviso_centro_v1", language: { code: "es" }, components: [{ type: "body", parameters: params.map((x) => ({ type: "text", text: x })) }] } }),
      });
      ok = res.ok;
      if (ok) await logMsg(to, `[aviso_centro_v1] ${params.join(" | ")}`); else console.log("[dispatch] notify template failed", res.status, (await res.text()).slice(0, 200));
    }
    out.push({ phone: to, how, ok });
  }
  return out;
}

// v17: two requests from the same person are the same booking when the four
// fields a studio actually reads agree. A blank on the newer row means "not
// restated", not "changed": the web form and the WhatsApp chat it opens fill in
// different blanks, which is why they must not read as a change.
const normField = (v: unknown) => String(v ?? "").toLowerCase().replace(/[.,;:!¡?¿]/g, " ").replace(/\s+/g, " ").trim();
function bookingDiff(fresh: Record<string, unknown>, sib: Record<string, unknown>): string[] {
  const diff: string[] = [];
  for (const [col, label] of [["service_name", "service"], ["day1", "day"], ["time1", "time"], ["area", "area"]] as Array<[string, string]>) {
    const a = normField(fresh[col]);
    const b = normField(sib[col]);
    if (!a || a === b) continue;
    if (b && (a.includes(b) || b.includes(a))) continue; // "Deep tissue" vs "Deep tissue massage"
    diff.push(b ? `${label} ${sib[col]} -> ${fresh[col]}` : `${label} now ${fresh[col]}`);
  }
  return diff;
}

// A repeat this soon after the first fan-out is the same arrival, not a change.
const SAME_ARRIVAL_MS = 10 * 60 * 1000;
// Stages a bot does not unwind on its own: a studio has been promised a slot,
// and only the customer's own words move a confirmed booking.
const LOCKED_STAGES = new Set(["confirmed", "no_show"]);

async function standDownOthers(requestId: number, winnerPartnerId: string | null) {
  const rows = await sq(`request_dispatch?request_id=eq.${requestId}&outcome=in.(pending,accepted)&select=id,partner_id,phone,outcome`);
  if (!Array.isArray(rows) || !rows.length) return 0;
  let n = 0;
  for (const row of rows) {
    if (winnerPartnerId && row.partner_id === winnerPartnerId) continue;
    const ok = await sendText(row.phone, row.outcome === "accepted"
      ? "Gracias por decir que sí. Esta vez el cliente se ha ido con otra oferta, así que no hace falta que hagáis nada. Os escribo con la siguiente. Jordan, Massage Club"
      : "Gracias por responder. Esta reserva ya está cubierta por otro centro, así que no hace falta que hagáis nada. Os escribo con la siguiente. Jordan, Massage Club");
    await sq(`request_dispatch?id=eq.${row.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ outcome: "stood_down" }),
    });
    if (ok) n++;
  }
  return n;
}

async function dispatchOne(r: Record<string, unknown>, opts: { dryRun: boolean; fanout: number; cheapest: boolean; extra?: boolean; partnerIds?: string[] }) {
  const requestId = Number(r.id);
  const area = String(r.area || "");
  const want = String(r.service_name || "");

  // v7: a price hunt ranks by listed 60 min relaxing price instead of fit and distance.
  // v10: an explicit partner list wins over both.
  let candidates: Candidate[];
  if (opts.partnerIds && opts.partnerIds.length) {
    const ids = opts.partnerIds.map((x) => encodeURIComponent(x)).join(",");
    const rows = await sq(`partners?id=in.(${ids})&select=id,business_name,neighbourhood,city,whatsapp,phone`);
    candidates = (Array.isArray(rows) ? rows : []).map((p: any, i: number) => ({
      id: String(p.id), business_name: String(p.business_name || ""), area: p.neighbourhood || p.city || null,
      wa: toWa(String(p.whatsapp || p.phone || "")), km: null, rank: i + 1, widened: false, score: 0,
    })).filter((c: Candidate) => c.wa.length >= 9);
  } else {
    candidates = (opts.cheapest
      ? await rpc("cheapest_candidates", { p_limit: opts.fanout })
      : await rpc("dispatch_candidates", { p_area: area || null, p_want: want || null, p_limit: opts.fanout })) as Candidate[];
  }
  // v10: never ask the same studio twice for one request.
  if (opts.extra) {
    const prior = await sq(`request_dispatch?request_id=eq.${requestId}&select=partner_id`);
    const seen = new Set((Array.isArray(prior) ? prior : []).map((x: any) => String(x.partner_id)));
    candidates = candidates.filter((c) => !seen.has(String(c.id)));
  }
  // v16: never ask a studio its own hours say is closed for that day or time.
  const skippedClosed: string[] = [];
  if (candidates.length) {
    const hids = candidates.map((c) => encodeURIComponent(c.id)).join(",");
    const hrows = await sq(`partners?id=in.(${hids})&select=id,opening_hours`);
    const hoursById = new Map<string, unknown>((Array.isArray(hrows) ? hrows : []).map((p: any) => [String(p.id), p.opening_hours]));
    candidates = candidates.filter((c) => {
      const why = closedReason(hoursById.get(String(c.id)), r);
      if (why) { skippedClosed.push(`${c.business_name} (${why})`); console.log(`[dispatch] req=${requestId} skip ${c.business_name}: ${why}`); }
      return !why;
    });
  }
  if (!candidates.length) {
    console.log(`[dispatch] req=${requestId} no reachable studios`);
    return { requestId, sent: 0, candidates: [], skippedClosed, reason: "no_candidates" };
  }

  const testCustomer = isTestCustomer(r);
  if (opts.dryRun) {
    return { requestId, sent: 0, dryRun: true, testCustomer, skippedClosed, requestDate: requestDate(r)?.toISOString().slice(0, 10) || null, candidates: candidates.map((c) => ({ name: c.business_name, area: c.area, km: c.km, wa: c.wa, widened: c.widened, score: c.score })) };
  }

  let sent = 0;
  const sentNames: string[] = [];
  for (const c of candidates) {
    // A test booking must never reach a real studio.
    if (testCustomer && !JORDAN_NUMBERS.includes(c.wa)) {
      console.log(`[dispatch] req=${requestId} test customer, skipping real studio ${c.business_name}`);
      continue;
    }
    const ins = await sq(`request_dispatch?on_conflict=request_id,partner_id`, {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ request_id: requestId, partner_id: c.id, phone: c.wa, rank: c.rank, outcome: "pending" }),
    });
    const rowId = Array.isArray(ins) && ins[0] ? ins[0].id : null;

    const res = await askOneStudio(r, c, opts.cheapest);
    if (rowId) {
      await sq(`request_dispatch?id=eq.${rowId}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify(res.ok ? { sent_at: new Date().toISOString() } : { send_error: res.error, outcome: "send_failed" }),
      });
    }
    if (res.ok) { sent++; sentNames.push(c.business_name + (opts.cheapest && c.score != null ? ` (${Number(c.score)} EUR)` : "") + (c.widened ? " (fuera de la zona)" : "")); }
  }

  if (sent > 0 && opts.extra) {
    // v10: second wave. Keep the stage (a bidding or confirmed request must not
    // be pulled back), add to the count, append to the note.
    await sq(`whatsapp_requests?id=eq.${requestId}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        dispatch_count: (Number(r.dispatch_count) || 0) + sent,
        stage_note: `${String(r.stage_note || "")}; second wave to ${sent}: ${sentNames.join(", ")}`.slice(0, 500),
      }),
    });
    const clientPhone = toWa(String(r.client_phone || ""));
    // A single added studio is not news to the customer.
    if (clientPhone && !testCustomer && sent >= 2) {
      const sess = await sq(`wa_sessions?phone=eq.${clientPhone}&select=data`);
      const sessLang = Array.isArray(sess) && sess[0]?.data ? String(sess[0].data.lang || "") : "";
      const es = (sessLang || String(r.languages || "")).toLowerCase().startsWith("es");
      await sendText(clientPhone, es
        ? `Seguimos en ello: hemos escrito a ${sent} centros más cerca de ${area || "tu zona"} para tener más opciones. Te confirmamos en cuanto uno diga que sí.`
        : `Still on it: we have asked ${sent} more studios near ${area || "your area"} to widen the options. We confirm as soon as one says yes.`);
      await logEvent(clientPhone, "dispatched_extra", { request_id: requestId, studios: sent, area });
    }
  } else if (sent > 0) {
    await sq(`whatsapp_requests?id=eq.${requestId}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        stage: "studio_asked",
        studio_asked_at: new Date().toISOString(),
        dispatched_at: new Date().toISOString(),
        dispatch_count: sent,
        stage_note: `${opts.cheapest ? "price hunt, " : ""}dispatched to ${sent}: ${sentNames.join(", ")}`.slice(0, 500),
      }),
    });

    // Tell the customer the true number, in their language. The chat session is
    // the reliable signal: requests.languages is null for our one real Spanish
    // speaker while his session correctly says "es".
    const clientPhone = toWa(String(r.client_phone || ""));
    if (clientPhone && !testCustomer && !opts.cheapest) {
      const sess = await sq(`wa_sessions?phone=eq.${clientPhone}&select=data`);
      const sessLang = Array.isArray(sess) && sess[0]?.data ? String(sess[0].data.lang || "") : "";
      const es = (sessLang || String(r.languages || "")).toLowerCase().startsWith("es");
      const where = area ? (es ? ` en ${area}` : ` in ${area}`) : "";
      const body = es
        ? `Ya estamos en ello. Hemos escrito a ${sent} centros${where} con tu petición y te confirmamos en cuanto uno nos diga que sí. No tienes que hacer nada más.`
        : `We are on it. We have messaged ${sent} studios${where} with your request and we will come back as soon as one of them says yes. Nothing more for you to do.`;
      await sendText(clientPhone, body);
      await logEvent(clientPhone, "dispatched", { request_id: requestId, studios: sent, area });
    }
  }

  // A test booking sends nothing, so mark it handled or the sweep would pick
  // it up again every 20 minutes for two days.
  if (sent === 0 && testCustomer) {
    await sq(`whatsapp_requests?id=eq.${requestId}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ dispatched_at: new Date().toISOString(), dispatch_count: 0, stage_note: "test customer, dispatch skipped" }),
    });
  }

  return { requestId, sent, studios: sentNames, skippedClosed, testCustomer, name: String(r.first_name || ""), service: `${svcEs(r.service_name)} ${reqDuration(r)} min`, when: [r.day1, r.time1].filter(Boolean).join(" "), area };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  const key = String(url.searchParams.get("key") || body.key || "");
  const auth = req.headers.get("Authorization") || "";
  if (key !== OPS_KEY && !auth.includes(svc())) {
    return new Response("forbidden", { status: 403 });
  }

  const fanout = Math.max(1, Math.min(Number(body.fanout || DEFAULT_FANOUT), 10));
  const dryRun = body.dry_run === true;
  const force = body.force === true;
  const cheapest = body.cheapest === true;
  const forceDispatch = body.force_dispatch === true;
  // v10 (6 Sept): a deliberate second wave on a request that is already out
  // (Jordan: "look for more places"). extra skips the already-dispatched guard
  // and the duplicate rule, never re-asks a studio that already has a row for
  // this request, and can take an explicit partner_ids list instead of
  // dispatch_candidates. The customer hears "N more studios", not a fresh count.
  const extra = body.extra === true;
  const partnerIds = Array.isArray(body.partner_ids) ? (body.partner_ids as unknown[]).map(String).filter(Boolean) : [];

  // v11: a note to every studio still in play on a request (free text while
  // their 24h window is open, the aviso_centro_v1 template otherwise), and a
  // plain text to the customer. Both are ops-only and log like every other send.
  if (body.notify && typeof body.notify === "object") {
    const n = body.notify as { request_id?: number; text?: string; short?: string; partner_ids?: string[] };
    if (!n.request_id || !n.text) return new Response(JSON.stringify({ error: "notify.request_id and notify.text required" }), { status: 200, headers: { "Content-Type": "application/json" } });
    const out = await notifyStudios(Number(n.request_id), String(n.text), n.short, n.partner_ids);
    return new Response(JSON.stringify({ ok: true, notified: out }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  // v14: a plain text to any number that has written to the bot (ops key only).
  // For the watch to answer a customer the bot left hanging, before a request exists.
  if (body.send && typeof body.send === "object") {
    const c = body.send as { phone?: string; text?: string };
    const to = toWa(String(c.phone || ""));
    if (!to || !c.text) return new Response(JSON.stringify({ error: "send.phone and send.text required" }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (isTestPhone(to)) return new Response(JSON.stringify({ ok: false, reason: "test number" }), { status: 200, headers: { "Content-Type": "application/json" } });
    const prior = await sq(`wa_messages?phone=eq.${to}&direction=eq.in&limit=1&select=id`);
    if (!Array.isArray(prior) || !prior.length) return new Response(JSON.stringify({ ok: false, reason: "number never wrote to the bot" }), { status: 200, headers: { "Content-Type": "application/json" } });
    const ok = await sendText(to, String(c.text));
    return new Response(JSON.stringify({ ok }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (body.customer_text && typeof body.customer_text === "object") {
    const c = body.customer_text as { request_id?: number; text?: string };
    if (!c.request_id || !c.text) return new Response(JSON.stringify({ error: "customer_text.request_id and text required" }), { status: 200, headers: { "Content-Type": "application/json" } });
    const reqRows = await sq(`whatsapp_requests?id=eq.${Number(c.request_id)}&select=id,client_phone,first_name,contact_email,last_name`);
    const rq = Array.isArray(reqRows) && reqRows[0] ? reqRows[0] : null;
    if (!rq || isTestCustomer(rq)) return new Response(JSON.stringify({ ok: false, reason: "no request or test customer" }), { status: 200, headers: { "Content-Type": "application/json" } });
    const ok = await sendText(toWa(String(rq.client_phone || "")), String(c.text));
    return new Response(JSON.stringify({ ok }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // Winner declared: stand everyone else down.
  if (body.won && typeof body.won === "object") {
    const w = body.won as { request_id?: number; partner_id?: string };
    if (!w.request_id) return new Response(JSON.stringify({ error: "won.request_id required" }), { status: 200, headers: { "Content-Type": "application/json" } });
    const stoodDown = await standDownOthers(Number(w.request_id), w.partner_id || null);
    if (w.partner_id) {
      await sq(`request_dispatch?request_id=eq.${w.request_id}&partner_id=eq.${w.partner_id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ outcome: "won", replied_at: new Date().toISOString() }),
      });
    }
    return new Response(JSON.stringify({ ok: true, stood_down: stoodDown }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (!dryRun && !force && !withinSendingHours()) {
    console.log(`[dispatch] outside sending hours (Madrid ${madridHour()}:00), deferring`);
    return new Response(JSON.stringify({ ok: true, deferred: true, madrid_hour: madridHour() }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  let requests: Record<string, unknown>[] = [];
  if (body.request_id) {
    requests = await sq(`whatsapp_requests?id=eq.${Number(body.request_id)}&select=*`);
  } else if (body.sweep === true) {
    // Anything still sitting unasked, newest first, within the last two days.
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    // Unassigned = partner_id null. Not keyed on stage: the legacy notify
    // trigger used to flip new requests to studio_asked, which hid them from
    // this sweep for good (request #44, 3 Sept).
    requests = await sq(`whatsapp_requests?dispatched_at=is.null&partner_id=is.null&stage=in.(new,dispatching,studio_asked)&created_at=gte.${since}&order=id.desc&limit=10&select=*`);
  } else {
    return new Response(JSON.stringify({ error: "pass request_id, sweep or won" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (!Array.isArray(requests) || !requests.length) {
    return new Response(JSON.stringify({ ok: true, handled: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const results = [];
  for (const r of requests) {
    if (!dryRun && r.dispatched_at && !extra) { results.push({ requestId: r.id, skipped: "already dispatched" }); continue; }
    // v4: one customer, one fan-out. The same person often arrives twice within
    // minutes (web form, then the WhatsApp chat it opens: #45 and #46, 3 Sept).
    // A second request rides on the first instead of asking five more studios.
    // v7: force_dispatch is a deliberate second fan-out (a price hunt) and skips this.
    const phoneDigits = String(r.client_phone || "").replace(/[^0-9]/g, "");
    if (!dryRun && !forceDispatch && !extra && phoneDigits.length >= 9) {
      const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const sibs = await sq(`whatsapp_requests?id=neq.${r.id}&client_phone=ilike.*${phoneDigits}&dispatched_at=not.is.null&dispatch_count=gt.0&stage=neq.dismissed&created_at=gte.${since24}&order=id.desc&select=id,stage,stage_note,service_name,day1,time1,area,dispatched_at&limit=1`);
      const sib = (Array.isArray(sibs) && sibs[0] ? sibs[0] : null) as Record<string, unknown> | null;
      if (sib) {
        const sinceDispatch = Date.now() - Date.parse(String(sib.dispatched_at || ""));
        const sameArrival = Number.isFinite(sinceDispatch) && sinceDispatch < SAME_ARRIVAL_MS;
        const diff = sameArrival ? [] : bookingDiff(r, sib);
        if (!diff.length) {
          await sq(`whatsapp_requests?id=eq.${r.id}`, {
            method: "PATCH", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ dispatched_at: new Date().toISOString(), dispatch_count: 0, stage: "dismissed", stage_note: `duplicate of #${sib.id} (same customer within 24h, nothing changed), not re-dispatched` }),
          });
          console.log(`[dispatch] req=${r.id} duplicate of #${sib.id}, skipped`);
          results.push({ requestId: r.id, skipped: `duplicate of #${sib.id}` });
          continue;
        }
        if (LOCKED_STAGES.has(String(sib.stage || ""))) {
          // A confirmed booking is frozen. Nothing new is promised to the studio
          // and nothing is unwound until a person has read what the customer said.
          await sq(`whatsapp_requests?id=eq.${r.id}`, {
            method: "PATCH", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ dispatched_at: new Date().toISOString(), dispatch_count: 0, stage: "needs_review", stage_note: `change to confirmed #${sib.id} (${diff.join("; ")}), held for a person`.slice(0, 500), stage_updated_at: new Date().toISOString() }),
          });
          await founderEmail(`Change on a confirmed booking, #${sib.id}`, [
            `${String(r.first_name || "The customer")} has asked for something different on a booking that is already confirmed.<br>${diff.join("<br>")}<br>No studio was told anything. Request #${r.id} is waiting for you.`,
          ]);
          results.push({ requestId: r.id, skipped: `change to confirmed #${sib.id}, held for a person` });
          continue;
        }
        // A change. The studios asked for the old slot are told it is off, the
        // old request is closed, and the new one goes out fresh below.
        const notified = await notifyStudios(Number(sib.id),
          "Gracias por vuestra paciencia. El cliente ha cambiado la cita, así que la anterior queda anulada y no hace falta que hagáis nada. Os escribo ahora con los datos nuevos. Jordan, de Massage Club",
          "el cliente ha cambiado la cita, la anterior queda anulada, no hace falta que hagáis nada");
        await sq(`whatsapp_requests?id=eq.${sib.id}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ stage: "cancelled", stage_updated_at: new Date().toISOString(), stage_note: `${String(sib.stage_note || "")}; superseded by #${r.id} (${diff.join("; ")}), ${notified.filter((x) => x.ok).length} of ${notified.length} studios stood down`.slice(0, 500) }),
        });
        console.log(`[dispatch] req=${r.id} supersedes #${sib.id}: ${diff.join("; ")}`);
      }
    }
    results.push(await dispatchOne(r, { dryRun, fanout, cheapest, extra, partnerIds }));
  }

  const totalSent = results.reduce((n, x) => n + (Number((x as { sent?: number }).sent) || 0), 0);
  if (totalSent > 0) {
    // v5: a founder email a person can read at a glance. v12: it links to the
    // request page in wa-chat, which shows every studio asked and their replies.
    const lines = results.filter((x: any) => x.sent > 0).map((x: any) =>
      `Request #${x.requestId} · ${x.name || "customer"} · ${x.service} · ${x.when || "time to be set"}${x.area ? " · " + x.area : ""}<br>Asked ${x.sent} studios${cheapest ? " (cheapest listed 60 min first, client budget stated, any discount invited)" : ""}${extra ? " (second wave)" : ""}: ${(x.studios || []).join(", ")}.<br>Each studio was asked for a Massage Club rate; the best offer wins after a 10 minute window (same-day requests go to the first yes). The others are stood down automatically. Nothing to do.${(x.skippedClosed || []).length ? "<br>Not asked, closed by their own hours: " + x.skippedClosed.join(", ") + "." : ""}<br>All studios and their replies: ${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&request=${x.requestId}`);
    await founderEmail(`Asked ${totalSent} studios${cheapest ? " (price hunt)" : ""}${extra ? " (second wave)" : ""}`, lines);
  }

  return new Response(JSON.stringify({ ok: true, handled: results.length, results }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
});
