// studio-calls: phone the studios that agreed to be phoned, through Vapi.
//
// Jordan (9 Oct): "call 5 or whatever amount of studios at once to get an
// instant answer". dispatch-studios still sends the WhatsApp ask first and that
// stays the written record. Right after it, every asked studio with
// partners.call_ok = true gets a short call from an automated Spanish voice.
// The voice says it is automated in its first sentence, asks one thing (can
// you do this time, and if not, the nearest time that day) and records the
// answer with a tool call before it says goodbye. A spoken "sí, a las 17:00"
// becomes the same offer a WhatsApp yes makes: wa-bot (ops studio_offer,
// channel 'call') sends the customer Yes / No buttons, and nothing is booked
// until the customer taps Yes. The studio hears exactly that before it hangs up,
// and then gets the 10% Massage Club rate question in writing from wa-bot.
//
// Inert until app_secrets VOICE_CALLS is 'test' or 'on' (unset means off):
//   off   nothing is dialled
//   test  only numbers in VOICE_TEST_NUMBERS are dialled and nothing is ever
//         handed to wa-bot; answers are only recorded in studio_calls
//   on    studios are dialled and a yes reaches the customer as an offer
// Also read from app_secrets at run time, never written here: VAPI_API_KEY,
// VAPI_PHONE_NUMBER_ID, VOICE_TEST_NUMBERS (comma separated, E.164 digits),
// VAPI_VOICE_ID (optional, "provider:voiceId", default Azure es-ES Elvira),
// VAPI_MODEL (optional, "provider:model", default openai gpt-4.1-mini).
//
// Modes (POST, JSON, ops key in body.key):
//   { ops: "place", request_id, partner_ids }       call those studios about that request
//   { ops: "test_call", to, studio_name?, dia?, hora?, servicio? }  one made-up call to a test number
//   { ops: "status", request_id? }                   recent calls
//   { ops: "reconcile" }                             fill in calls whose webhooks never arrived
//   ?hook=<sig>&c=<row>                              Vapi's webhook: tool-calls, status-update, end-of-call-report
//
// SAFETY
//  - A studio is only phoned with call_ok = true, not opted out, not suspended,
//    and only once its WhatsApp ask for this request has gone out, so every
//    gate in dispatch-studios (opening hours, test customers, the outreach
//    pause, the 24h cap) has already been passed. dispatch-studios only hands
//    over studios whose listed hours say they are open right now and at the
//    hour the call asks about.
//  - Only between 09:00 and 21:00 Madrid, and never twice about one request.
//  - A test customer's request never rings anything but a VOICE_TEST_NUMBERS phone.
//  - The agent never asks for a discount and never confirms a booking.
//  - No recording. Voicemail: it hangs up without leaving a message.
//  - "No nos llamen más" switches call_ok off, from the tool call or, if the
//    studio hung up first, from its own words in the transcript.
//  - Every webhook URL is signed for its own studio_calls row and must carry
//    that row's Vapi call id.
//
// Jordan hears by email (support@ and jordan@) when a studio opts out, when a
// studio states its opening hours, when it asks to speak to a person, when it
// offers an hour outside the customer's window, and when an answer could not
// be handed to wa-bot. That needs the Resend key from the loader; without it,
// logs only.
//
// 16 Oct (the studio-message rewrite): the opening no longer says "una
// reserva" (nothing is booked) and asks "¿Tendrían hueco ... para un masaje
// deportivo de 60 minutos?", the article inside {{servicio}}, the studio's own
// service when dispatch-studios passes one (services: {partner_id: text}). The
// assistant no longer says the client speaks English (false for Spanish
// speakers), promises "se lo paso ahora mismo a Jordan" only together with the
// email that keeps the promise, looks for another hour only inside the
// customer's window ({{hasta}}), and says "buena tarde" after 14:00.
//
// The repo is public, so this file carries no secrets. The deployed function
// is a short loader that pins one commit of this file and passes the keys in.

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const FN_URL = `${SUPABASE_URL}/functions/v1/studio-calls`;
const VAPI = "https://api.vapi.ai";
let OPS_KEY = "";
let RESEND_API_KEY = "";
let STUDIO_OUTREACH_PAUSED = false;
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const JORDAN_EMAILS = ["support@massageclub.io", "jordan@massageclub.io"];

const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;
// A front desk either answers in a ring or two or is busy with a client. 25s of
// ringing hangs up before most Spanish carrier voicemail picks up.
const RING_S = 25;
const MAX_CALL_S = 120;
const SILENCE_S = 20;
const CLOSED_STAGES = ["confirmed", "cancelled", "dismissed", "no_show", "needs_review", "stale", "too_late", "needs_contact"];

// Belt on top of dispatch-studios' own test-customer rule: Jordan, Cata, Yi and
// the fake 60000 numbers the replay uses. Same lists as dispatch-studios
// (TEST_EMAILS, TEST_PHONES, JORDAN_NUMBERS); change them together.
const TEST_PHONES = ["15622355063", "17867276503", "34612474827", "34635569364", "34662680781", "34613977900"];
const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu", "longyi_elon@outlook.com", "geromin.nepomuceno@student.ie.edu", "ritiktulsyan674@gmail.com", "sarfrazsingh@gmail.com", "guest@massageclub.io"];
const TEST_DOMAINS = ["testing.com", "example.com", "test.com", "placeholder.local", "mailinator.com", "example.org"];

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS } });

const svc = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const H = () => ({ apikey: svc(), Authorization: `Bearer ${svc()}`, "Content-Type": "application/json" });

async function sq(path: string, init?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...(init || {}), headers: { ...H(), ...((init?.headers as Record<string, string>) || {}) } });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt; }
}
async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: H(), body: JSON.stringify(args) });
  return await res.json().catch(() => null);
}
// A write that says whether it landed. A lost answer or a lost opt-out is the
// thing this function must never do quietly.
async function patchOk(path: string, body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify(body) }).catch(() => null);
  if (res?.ok) return true;
  console.log(`[calls] write failed on ${path.split("?")[0]}: ${res ? `${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}` : "network"}`);
  return false;
}
const patchCall = (id: string, body: Record<string, unknown>, filter = "") => patchOk(`studio_calls?id=eq.${id}${filter}`, body);
async function getCall(id: string): Promise<any | null> {
  const rows = await sq(`studio_calls?id=eq.${encodeURIComponent(id)}&select=*`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Work that must outlive the response: the relay after a tool call has been
// answered, so the agent on the phone is never kept waiting on wa-bot.
function bg(p: Promise<unknown>) {
  const er = (globalThis as any).EdgeRuntime;
  if (er && typeof er.waitUntil === "function") { try { er.waitUntil(p); } catch { /* it still runs */ } }
  p.catch((e) => console.log("[calls] background task failed", String(e)));
}
function sameStr(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

// The webhook is authenticated by the URL itself. Vapi does not attach the org
// credential to a server URL that arrives inside the request (orgs created
// after 23 Sept 2026), so a header cannot be relied on. Signed per studio_calls
// row, so a URL seen in Vapi's logs speaks for that one call and no other.
async function hookSig(rowId: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(OPS_KEY + ":vapi-hook"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("v1:" + rowId)));
  return [...mac.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// To Jordan only, never to a studio or a customer.
const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function tellJordan(subject: string, lines: string[]) {
  console.log(`[calls] for Jordan: ${subject} | ${lines.join(" | ").slice(0, 300)}`);
  if (!RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from: FROM_EMAIL, to: JORDAN_EMAILS, subject, text: lines.join("\n"), html: `<p style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#262019;">${lines.map(esc).join("<br>")}</p>` }),
    });
  } catch (e) { console.log("[calls] email to Jordan failed", String(e)); }
}

// Digits in E.164 without the plus, or "" when it cannot be a phone number.
// A bare nine-digit Spanish number gets its 34.
function e164(raw: unknown): string {
  let d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && /^[6789]/.test(d)) d = "34" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}

type Cfg = { mode: "off" | "test" | "on"; apiKey: string; phoneNumberId: string; testNumbers: string[]; voice: string; model: string };
let cfgCache: { cfg: Cfg; at: number } | null = null;
// Read on every request (20s cache) so turning VOICE_CALLS off takes effect at
// once. Anything unreadable counts as off.
async function config(): Promise<Cfg> {
  if (cfgCache && Date.now() - cfgCache.at < 20e3) return cfgCache.cfg;
  const keys = ["VAPI_API_KEY", "VAPI_PHONE_NUMBER_ID", "VOICE_CALLS", "VOICE_TEST_NUMBERS", "VAPI_VOICE_ID", "VAPI_MODEL"];
  const rows = await sq(`app_secrets?key=in.(${keys.join(",")})&select=key,value`).catch(() => []);
  const m = new Map<string, string>((Array.isArray(rows) ? rows : []).map((r: any) => [String(r.key), String(r.value ?? "").trim()]));
  const mode = (m.get("VOICE_CALLS") || "").toLowerCase();
  const cfg: Cfg = {
    mode: mode === "on" || mode === "test" ? mode : "off",
    apiKey: m.get("VAPI_API_KEY") || "",
    phoneNumberId: m.get("VAPI_PHONE_NUMBER_ID") || "",
    testNumbers: (m.get("VOICE_TEST_NUMBERS") || "").split(",").map(e164).filter(Boolean),
    voice: m.get("VAPI_VOICE_ID") || "",
    model: m.get("VAPI_MODEL") || "",
  };
  cfgCache = { cfg, at: Date.now() };
  return cfg;
}

function madridHour(): number {
  return parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date()), 10);
}
const callingHours = () => { const h = madridHour(); return h >= OPEN_HOUR && h < CLOSE_HOUR; };

function isTestRequest(r: Record<string, unknown>): boolean {
  const p = e164(r.client_phone);
  if (TEST_PHONES.includes(p) || p.startsWith("3460000") || (p.startsWith("86") && p.endsWith("997"))) return true;
  const e = String(r.contact_email || "").toLowerCase();
  if (TEST_EMAILS.includes(e) || TEST_DOMAINS.some((d) => e.endsWith("@" + d)) || /\+(mctest|uitest)/.test(e)) return true;
  return /\btest\b|\bprueba\b/.test(`${r.first_name || ""} ${r.last_name || ""}`.toLowerCase());
}

// --- What the studio hears. Same readings as the WhatsApp ask in
// dispatch-studios, shaped for speech: "hoy", "mañana", "el martes 14 de octubre".
// The date is dispatch-studios' requestDate (v38) copied as is: "hoy" and
// "tomorrow" mean the day the customer wrote them (created_at), never the day
// the call happens to go out. A request made at 23:30 for "tomorrow" and called
// at 09:00 is asked about "hoy", the same day its opening hours were checked for.
const MADRID_YMD = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
const MONTHS: Record<string, number> = { jan: 0, ene: 0, feb: 1, mar: 2, apr: 3, abr: 3, may: 4, jun: 5, jul: 6, aug: 7, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dec: 11, dic: 11 };
const DAY_IDX: Record<string, number> = { sun: 0, dom: 0, mon: 1, lun: 1, tue: 2, mar: 2, wed: 3, mie: 3, thu: 4, jue: 4, fri: 5, vie: 5, sat: 6, sab: 6 };
const stripAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
function madridDayOf(iso: unknown): Date {
  const t = Date.parse(String(iso || ""));
  const [y, m, d] = MADRID_YMD.format(t ? new Date(t) : new Date()).split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d));
}
function requestDate(r: Record<string, unknown>): Date | null {
  const today = madridDayOf(r.created_at);
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
// requestDate's dates are midnight UTC, so they are read back in UTC.
const ES_DATE = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
function diaHablado(r: Record<string, unknown>): string {
  const date = requestDate(r);
  // Only a real date is worth a phone call. "Flexible" or "this weekend" is not,
  // and neither is a day that has already gone.
  if (!date) return "";
  const days = Math.round((date.getTime() - madridDayOf(null).getTime()) / 86400e3);
  if (days < 0) return "";
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `el ${ES_DATE.format(date).replace(",", "").toLowerCase()}`;
}
// The hour put to the studios (dispatch v30), or the customer's own exact time.
const BANDS: Array<[RegExp, string]> = [[/morning|ma[nñ]ana/i, "10:00"], [/afternoon|tarde-noche|tarde\s*-\s*noche/i, ""], [/evening|night|noche/i, "18:00"], [/afternoon|tarde/i, "16:00"]];
function concreteTime(t: unknown): string {
  const s = String(t || "").trim();
  if (!s) return "";
  const exact = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (exact) return `${exact[1].padStart(2, "0")}:${exact[2]}`;
  const range = s.match(/\((\d{1,2})\s*-\s*\d{1,2}\)/);
  if (range) return `${range[1].padStart(2, "0")}:00`;
  for (const [re, hh] of BANDS) if (hh && re.test(s)) return hh;
  return "";
}
// The service carries its own article, so the sentence reads "para un masaje
// deportivo" and "para un tratamiento de reflexología" alike.
const SVC_ES: Array<[RegExp, string]> = [
  [/deep tissue|descontract/i, "un masaje descontracturante"], [/thai|tailand/i, "un masaje tailandés"],
  [/hot stone|piedras/i, "un masaje con piedras calientes"], [/sport|deportiv/i, "un masaje deportivo"],
  [/balin/i, "un masaje balinés"], [/shiatsu/i, "un shiatsu"], [/reflexolog/i, "un tratamiento de reflexología"],
  [/lymphatic|linf/i, "un drenaje linfático"], [/couples|pareja/i, "un masaje en pareja"],
  [/kobido|facial/i, "un masaje facial kobido"], [/prenatal|embaraz/i, "un masaje prenatal"],
  [/head|scalp|cabeza/i, "un masaje de cabeza"], [/foot|feet|pies/i, "un masaje de pies"],
  [/four hands|cuatro manos/i, "un masaje a cuatro manos"], [/gua sha/i, "un tratamiento de gua sha"],
  [/swedish|sueco/i, "un masaje sueco"],
];
const reqMinutes = (r: Record<string, unknown>): number => {
  const m = String(r.message_text || "").match(/Duraci[oó]n: (\d{2,3}) min/);
  return m ? parseInt(m[1], 10) : 60;
};
const genderHablado = (r: Record<string, unknown>) => r.therapist_gender === "male" ? " con masajista chico" : r.therapist_gender === "female" ? " con masajista chica" : "";
function servicioHablado(r: Record<string, unknown>): string {
  const name = String(r.service_name || "");
  let base = "un masaje relajante";
  for (const [re, v] of SVC_ES) if (re.test(name)) { base = v; break; }
  return `${base} de ${reqMinutes(r)} minutos${genderHablado(r)}`;
}
// The studio's own service, as dispatch-studios asked it in writing
// ("masaje tailandés de 60 min con presión firme"), said the same way.
function ownServicio(own: string, r: Record<string, unknown>): string {
  let s = own.replace(/\s+/g, " ").trim().replace(/\bmin\b\.?/gi, "minutos");
  if (!/^(un|una)\s/i.test(s)) s = "un " + s.charAt(0).toLowerCase() + s.slice(1);
  if (!/\d/.test(s)) s += ` de ${reqMinutes(r)} minutos`;
  if (!/masajista/i.test(s)) s += genderHablado(r);
  return s;
}
// The customer's window, from the band they chose ("Afternoon (13-18)"), so
// "the nearest time that day" is never an hour they did not ask for.
function franja(r: Record<string, unknown>): { desde: string; hasta: string } {
  const flex = String(r.message_text || "").match(/flexible: ([^|]+)/)?.[1] || "";
  for (const t0 of [r.time1, r.time2, flex]) {
    const t = String(t0 || "").toLowerCase();
    let b: [number, number] | null = null;
    const m = t.match(/\b(\d{1,2})(?::00)?\s*-\s*(\d{1,2})(?::00)?\b/);
    if (m && +m[1] < +m[2] && +m[2] <= 24) b = [+m[1], +m[2]];
    else if (/\b\d{1,2}[:.]\d{2}\b/.test(t)) b = null;
    else if (/morning|ma[nñ]ana/.test(t)) b = [10, 13];
    else if (/afternoon|tarde/.test(t)) b = [13, 18];
    else if (/evening|night|noche/.test(t)) b = [18, 21];
    if (b) return { desde: `${String(b[0]).padStart(2, "0")}:00`, hasta: `${String(b[1]).padStart(2, "0")}:00` };
  }
  return { desde: "", hasta: "" };
}
// "17:00", "17.00", "17h", "5:30" from whatever the model wrote, or "".
function hhmm(t: unknown): string {
  const s = String(t || "").trim();
  const m = s.match(/\b([01]?\d|2[0-3])(?:[:.h]\s*([0-5]\d))?\s*h?\b/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2] || "00"}`;
}

// --- The call. One transient assistant per call: what it is told is fixed as
// sent, so nothing in the Vapi dashboard can change what a studio hears.
// The disclosure is in the first sentence, before anything is asked.
// "un cliente", not "una reserva": nothing is booked yet. {{servicio}} carries
// its own article ("un masaje deportivo de 60 minutos").
const FIRST_MESSAGE = "Hola, buenas. Le llama el asistente automático de Massage Club, de parte de Jordan, por un cliente. ¿Tendrían hueco {{dia}} a las {{hora}} para {{servicio}}?";
// Nothing here promises the customer sees it "ahora mismo": wa-bot can hold an
// offer back (outside the customer's window, or behind one they are already
// looking at), and the studio is never told something that may not happen.
const CLOSE_YES = "Perfecto, se lo trasladamos al cliente. Todavía no está reservado: les confirmamos por WhatsApp en cuanto el cliente diga que sí. Gracias.";
const CLOSE_OTHER = "Gracias, se lo comentamos al cliente. Todavía no está reservado; si le encaja, les confirmamos por WhatsApp.";
// "Buen día" on an evening call sounds off; after 14:00 Madrid it is "buena tarde".
const closeNo = () => `Entendido, muchas gracias. ${madridHour() >= 14 ? "Que tengan buena tarde." : "Que tengan buen día."}`;
const WANTS_PERSON = "Claro, se lo paso ahora mismo a Jordan para que se ponga en contacto con ustedes.";
// Built for each call: the window rule only when the customer gave a band, and
// the goodbye for the hour the call goes out.
function systemFor(v: Vars): string {
  return [
    "Eres el asistente automático de Massage Club y estás al teléfono con {{centro}}, un centro de masajes de Madrid. Llamas de parte de Jordan. Massage Club busca hueco en centros de masajes de Madrid para sus clientes.",
    "Ya has saludado y has preguntado si tendrían hueco {{dia}} a las {{hora}} para {{servicio}}.",
    "Hablas español de España, de usted, con frases cortas y naturales. Es una llamada breve.",
    "",
    "Solo quieres saber esto:",
    "1. Si pueden {{dia}} a las {{hora}}.",
    v.hasta
      ? "2. Si no pueden a esa hora, la hora más cercana que tengan ese mismo día, dentro de la franja del cliente (hasta las {{hasta}})."
      : "2. Si no pueden a esa hora, la hora más cercana que tengan ese mismo día.",
    "3. El precio, solo si lo dicen ellos. No insistas.",
    "",
    "Reglas:",
    "- No pidas descuentos ni hables de comisiones.",
    "- No confirmes la reserva ni digas que está reservada. El cliente decide primero.",
    "- No des datos del cliente. Si preguntan, di que si el cliente confirma les escribimos por WhatsApp con su nombre.",
    "- Si preguntan quién eres, di otra vez que eres un asistente automático de Massage Club que llama de parte de Jordan.",
    `- Si quieren hablar con una persona, di exactamente: "${WANTS_PERSON}" y marca quiere_persona.`,
    "- Si piden que no les llamemos más, pide disculpas, di que no volverán a recibir llamadas nuestras y marca no_llamar.",
    "- Si contesta un buzón de voz o un contestador, cuelga sin dejar mensaje.",
    "- Si te dicen su horario de apertura, apúntalo en horario.",
    "- Antes de despedirte, llama siempre a registrar_respuesta con lo que han dicho. Horas en formato HH:MM de 24 horas.",
    `- Si pueden {{dia}} a las {{hora}}, despídete con estas palabras exactas: "${CLOSE_YES}"`,
    `- Si no pueden a esa hora pero sí a otra ese día, despídete con estas palabras exactas: "${CLOSE_OTHER}"`,
    `- Si no tienen hueco ese día, despídete con: "${closeNo()}"`,
    "- Después de despedirte, cuelga con endCall.",
  ].join("\n");
}

// Vapi's JsonSchema has no null type, so "no price said" is 0, read back as null.
// Not strict: OpenAI's strict mode also wants additionalProperties:false, which
// Vapi's schema cannot carry, and a 400 there would leave the studio listening
// to silence after the greeting. Every field is required and read defensively.
const REGISTRAR = {
  type: "function",
  async: false,
  function: {
    name: "registrar_respuesta",
    description: "Guarda la respuesta del centro. Llámala una sola vez, antes de despedirte.",
    parameters: {
      type: "object",
      properties: {
        disponible: { type: "boolean", description: "true si pueden exactamente a la hora pedida." },
        hora_ofrecida: { type: "string", description: "La hora que pueden ese día, HH:MM: la pedida si pueden, o la más cercana que ofrezcan. Vacío si no pueden ese día." },
        otras_horas: { type: "array", items: { type: "string" }, description: "Otras horas que hayan dicho para ese día, HH:MM. Vacío si ninguna." },
        precio_eur: { type: "number", description: "Precio en euros si lo han dicho. 0 si no lo han dicho." },
        no_llamar: { type: "boolean", description: "true si han pedido que no les llamemos más." },
        horario: { type: "string", description: "Su horario de apertura si lo han dicho, en este formato exacto: Mon-Sat 10:00-21:00, Sun 11:00-15:00 (días en inglés, horas de 24 h; si cierran a mediodía: Mon-Fri 10:00-14:00, Mon-Fri 17:00-21:00). Vacío si no lo han dicho." },
        notas: { type: "string", description: "Cualquier otra cosa importante que hayan dicho, en pocas palabras. Vacío si nada." },
        quiere_persona: { type: "boolean", description: "true si han pedido hablar con una persona." },
      },
      required: ["disponible", "hora_ofrecida", "otras_horas", "precio_eur", "no_llamar", "horario", "notas", "quiere_persona"],
    },
  },
};

function voiceFor(cfg: Cfg): Record<string, unknown> {
  const v = cfg.voice;
  if (!v) return { provider: "azure", voiceId: "es-ES-ElviraNeural" };
  const i = v.indexOf(":");
  if (i > 0) return { provider: v.slice(0, i), voiceId: v.slice(i + 1) };
  return /^[a-z]{2}-[A-Z]{2}-/.test(v) ? { provider: "azure", voiceId: v } : { provider: "11labs", voiceId: v };
}
function modelFor(cfg: Cfg): { provider: string; model: string } {
  const i = cfg.model.indexOf(":");
  return i > 0 ? { provider: cfg.model.slice(0, i), model: cfg.model.slice(i + 1) } : { provider: "openai", model: cfg.model || "gpt-4.1-mini" };
}

// hasta / desde: the customer's window when they gave a band; "" otherwise.
type Vars = { centro: string; dia: string; hora: string; servicio: string; hasta?: string; desde?: string };
function callBody(cfg: Cfg, to: string, vars: Vars, rowId: string, sig: string, label: string): Record<string, unknown> {
  return {
    phoneNumberId: cfg.phoneNumberId,
    customer: { number: "+" + to, name: vars.centro.slice(0, 40) },
    name: label.slice(0, 40),
    assistant: {
      name: "Massage Club llamada",
      firstMessage: FIRST_MESSAGE,
      firstMessageMode: "assistant-speaks-first",
      transcriber: { provider: "deepgram", model: "nova-3", language: "es" },
      voice: voiceFor(cfg),
      model: { ...modelFor(cfg), temperature: 0.2, maxTokens: 200, messages: [{ role: "system", content: systemFor(vars) }], tools: [REGISTRAR, { type: "endCall" }] },
      // No voicemailMessage: on a machine it hangs up and says nothing.
      voicemailDetection: { provider: "vapi", backoffPlan: { startAtSeconds: 2, frequencySeconds: 2.5, maxRetries: 5 } },
      maxDurationSeconds: MAX_CALL_S,
      silenceTimeoutSeconds: SILENCE_S,
      backgroundSound: "off",
      artifactPlan: { recordingEnabled: false, pcapEnabled: false },
      transportConfigurations: [{ provider: "twilio", timeout: RING_S }],
      serverMessages: ["tool-calls", "status-update", "end-of-call-report"],
      server: { url: `${FN_URL}?hook=${sig}&c=${rowId}`, timeoutSeconds: 15 },
      metadata: { studio_call_id: rowId },
    },
    assistantOverrides: { variableValues: vars },
  };
}

// Insert the row first (its id goes into the webhook URL), then dial.
async function dial(cfg: Cfg, to: string, vars: Vars, row: Record<string, unknown>, label: string): Promise<{ placed: boolean; reason?: string; call_id?: string; row?: string }> {
  const ins = await sq("studio_calls", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...row, dialled: "+" + to, status: "queued", vars }),
  });
  const rowId = Array.isArray(ins) && ins[0]?.id ? String(ins[0].id) : "";
  if (!rowId) return { placed: false, reason: /duplicate|23505/.test(JSON.stringify(ins)) ? "already called about this request" : `could not record the call: ${JSON.stringify(ins).slice(0, 160)}` };
  try {
    const res = await fetch(`${VAPI}/call`, {
      method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify(callBody(cfg, to, vars, rowId, await hookSig(rowId), label)),
    });
    const txt = await res.text();
    let out: any = {};
    try { out = JSON.parse(txt); } catch { /* not json */ }
    if (res.ok && out?.id) {
      await patchCall(rowId, { vapi_call_id: String(out.id), status: String(out.status || "queued") });
      if (out.subscriptionLimits?.concurrencyBlocked) console.log(`[calls] concurrency limit reached (${out.subscriptionLimits.concurrencyLimit})`);
      console.log(`[calls] ${label}: dialled +${to}, call ${out.id}`);
      return { placed: true, call_id: String(out.id), row: rowId };
    }
    await patchCall(rowId, { status: "failed", result: "failed", error: `${res.status} ${txt.slice(0, 300)}`, ended_at: new Date().toISOString() });
    console.log(`[calls] ${label}: Vapi refused, ${res.status} ${txt.slice(0, 200)}`);
    return { placed: false, reason: `vapi ${res.status}`, row: rowId };
  } catch (e) {
    await patchCall(rowId, { status: "failed", result: "failed", error: String(e).slice(0, 300), ended_at: new Date().toISOString() });
    console.log(`[calls] ${label}: dial failed`, String(e));
    return { placed: false, reason: String(e).slice(0, 120), row: rowId };
  }
}

// --- ops: place
async function place(body: Record<string, unknown>) {
  const cfg = await config();
  if (cfg.mode === "off") return { ok: false, reason: "VOICE_CALLS is off" };
  if (!cfg.apiKey || !cfg.phoneNumberId) return { ok: false, reason: "VAPI_API_KEY or VAPI_PHONE_NUMBER_ID missing in app_secrets" };
  if (STUDIO_OUTREACH_PAUSED) return { ok: false, reason: "studio outreach paused by Jordan" };
  const id = Number(body.request_id || 0);
  const ids = [...new Set((Array.isArray(body.partner_ids) ? body.partner_ids : []).map((x) => String(x).replace(/[^a-fA-F0-9-]/g, "")).filter((x) => x.length >= 32))].slice(0, 10);
  if (!id || !ids.length) return { ok: false, reason: "request_id and partner_ids needed" };
  if (!callingHours()) return { ok: true, mode: cfg.mode, request_id: id, placed: 0, reason: "outside 09:00-21:00 Madrid" };

  const reqs = await sq(`whatsapp_requests?id=eq.${id}&select=*`);
  const r = Array.isArray(reqs) ? reqs[0] : null;
  if (!r) return { ok: false, reason: "no such request" };
  if (CLOSED_STAGES.includes(String(r.stage || ""))) return { ok: true, mode: cfg.mode, request_id: id, placed: 0, reason: `request is ${r.stage}` };
  const hora = concreteTime(r.proposed_time) || concreteTime(r.time1);
  const dia = diaHablado(r);
  if (!hora || !dia) return { ok: true, mode: cfg.mode, request_id: id, placed: 0, reason: `no exact ${!hora ? "hour" : "day"} to ask about` };
  const servicioDefault = servicioHablado(r);
  const win = franja(r);
  const testReq = isTestRequest(r);

  const inIds = ids.map(encodeURIComponent).join(",");
  const [ps, ds, cs] = await Promise.all([
    sq(`partners?id=in.(${inIds})&select=id,business_name,phone,call_phone,call_ok,opted_out_at,status,outreach_status`),
    sq(`request_dispatch?request_id=eq.${id}&partner_id=in.(${inIds})&select=id,partner_id,sent_at,outcome,offered_time`),
    sq(`studio_calls?request_id=eq.${id}&partner_id=in.(${inIds})&select=partner_id`),
  ]);
  const pById = new Map<string, any>((Array.isArray(ps) ? ps : []).map((p: any) => [String(p.id), p]));
  const dById = new Map<string, any>((Array.isArray(ds) ? ds : []).map((d: any) => [String(d.partner_id), d]));
  const called = new Set<string>((Array.isArray(cs) ? cs : []).map((c: any) => String(c.partner_id)));

  const results = await Promise.all(ids.map(async (pid) => {
    const p = pById.get(pid);
    const name = String(p?.business_name || pid);
    const skip = (reason: string) => { console.log(`[calls] req=${id} not calling ${name}: ${reason}`); return { partner_id: pid, name, placed: false, reason }; };
    if (!p) return skip("no such studio");
    if (p.call_ok !== true) return skip("has not agreed to calls (call_ok)");
    if (p.opted_out_at || ["suspended", "archived"].includes(String(p.status || "")) || ["rejected", "bounced", "opted_out"].includes(String(p.outreach_status || ""))) return skip("opted out or suspended");
    const d = dById.get(pid);
    // The call follows the written ask, never replaces it.
    if (!d || !d.sent_at) return skip("no WhatsApp ask sent for this request");
    if (String(d.outcome || "pending") !== "pending" || d.offered_time) return skip(`already answered (${d.outcome})`);
    if (called.has(pid)) return skip("already called about this request");
    const to = e164(p.call_phone || p.phone);
    if (!to) return skip("no phone number");
    const isTestNumber = cfg.testNumbers.includes(to);
    if (testReq && !isTestNumber) return skip("test customer, real studio");
    if (cfg.mode === "test" && !isTestNumber) return skip("test mode, number not in VOICE_TEST_NUMBERS");
    // The studio's own service when dispatch-studios asked for that one in writing.
    const own = String((body.services as Record<string, unknown> | undefined)?.[pid] || "").trim().slice(0, 120);
    const servicio = own ? ownServicio(own, r) : servicioDefault;
    const vars: Vars = { centro: name.slice(0, 80), dia, hora, servicio, ...(win.hasta ? { hasta: win.hasta, desde: win.desde } : {}) };
    const out = await dial(cfg, to, vars, { request_id: id, partner_id: pid, dispatch_id: d.id, test: cfg.mode === "test" }, `MC #${id} ${name}`);
    return { partner_id: pid, name, ...out };
  }));
  const placed = results.filter((x) => x.placed).length;
  console.log(`[calls] req=${id} mode=${cfg.mode} placed ${placed} of ${ids.length}`);
  return { ok: true, mode: cfg.mode, request_id: id, placed, results };
}

// --- ops: test_call. Rings one VOICE_TEST_NUMBERS phone with a made-up request.
async function testCall(body: Record<string, unknown>) {
  const cfg = await config();
  if (cfg.mode === "off") return { ok: false, reason: "VOICE_CALLS is off" };
  if (!cfg.apiKey || !cfg.phoneNumberId) return { ok: false, reason: "VAPI_API_KEY or VAPI_PHONE_NUMBER_ID missing in app_secrets" };
  const to = e164(body.to);
  if (!to || !cfg.testNumbers.includes(to)) return { ok: false, reason: "'to' is not in VOICE_TEST_NUMBERS" };
  const clip = (v: unknown, max: number) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
  const vars: Vars = {
    centro: clip(body.studio_name, 80) || "Centro de prueba",
    dia: clip(body.dia, 60) || "mañana",
    hora: hhmm(body.hora) || "17:00",
    servicio: clip(body.servicio, 80) || "un masaje relajante de 60 minutos",
  };
  const out = await dial(cfg, to, vars, { request_id: null, partner_id: null, test: true }, `MC test ${vars.centro}`);
  return { ok: out.placed, mode: cfg.mode, vars, ...out };
}

// --- The studio's answer, from the tool call, the end-of-call report or a
// reconcile. Throws when the answer could not be written, so the caller leaves
// the call open (no ended_at) and the next report or reconcile tries again.
const truthy = (v: unknown) => v === true || String(v).toLowerCase() === "true";
async function recordAnswer(row: any, a: Record<string, unknown>) {
  const asked = String(row.vars?.hora || "");
  const t = hhmm(a.hora_ofrecida);
  const others = (Array.isArray(a.otras_horas) ? a.otras_horas : []).map(hhmm).filter(Boolean);
  let result = "no", offered = "";
  if (truthy(a.disponible)) { offered = t || asked; result = offered && asked && offered !== asked ? "other_time" : "yes"; }
  else {
    // "A las 17 no" can come back with hora_ofrecida 17:00. The hour they just
    // turned down is never offered to the customer.
    const alt = [t, ...others].find((x) => x && x !== asked);
    if (alt) { offered = alt; result = "other_time"; }
  }
  // An hour outside the customer's window is not an offer: it never reaches
  // the customer, and Jordan is told so he can decide.
  const desde = String(row.vars?.desde || ""), hasta = String(row.vars?.hasta || "");
  const inWin = (x: string) => !hasta || ((!desde || x >= desde) && x < hasta);
  let outside: string[] = [];
  if (result === "other_time" && !inWin(offered)) {
    const alt = [t, ...others].find((x) => x && x !== asked && inWin(x));
    if (alt) offered = alt;
    else { outside = [...new Set([offered, ...others.filter((x) => x && x !== asked && !inWin(x))])]; offered = ""; result = "no"; }
  }
  const price = Number(a.precio_eur);
  const times = [...new Set([offered, ...others].filter(Boolean))].filter((x) => result === "yes" || (x !== asked && inWin(x))).slice(0, 6);
  const optOut = truthy(a.no_llamar);
  const wantsPerson = truthy(a.quiere_persona);
  const horario = String(a.horario || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const notes = [String(a.notas || "").trim(), horario ? `horario: ${horario}` : "", outside.length ? `ofreció ${outside.join(", ")}, fuera de la franja del cliente` : "", wantsPerson ? "quiere hablar con una persona" : "", optOut || row.opted_out ? "pidió no recibir más llamadas" : ""].filter(Boolean).join(" | ").slice(0, 500);
  const who = String(row.vars?.centro || row.partner_id);
  // The agent told them "se lo paso ahora mismo a Jordan"; this keeps it.
  if (wantsPerson && !row.person_told) {
    row.person_told = true;
    bg(tellJordan(`${who} wants to talk to a person`, [
      `${who} asked on the phone to speak to a person${row.request_id ? ` about request #${row.request_id}` : ""}.`,
      `Their number: ${row.dialled || "unknown"}`,
      String(a.notas || "").trim() ? `What they said: ${String(a.notas).trim()}` : "",
      `studio_calls row ${row.id}${row.test ? " (test call)" : ""}.`,
    ].filter(Boolean)));
  }
  if (outside.length && !row.outside_told) {
    row.outside_told = true;
    bg(tellJordan(`${who} offered ${outside.join(", ")} for #${row.request_id || "?"}, outside the customer's window`, [
      `${who} said on the phone they cannot do ${asked} but could do ${outside.join(", ")}, outside the customer's window (${desde || "?"} to ${hasta}).`,
      "It was not offered to the customer. If you think they would take it, ask them yourself.",
      `studio_calls row ${row.id}${row.test ? " (test call)" : ""}.`,
    ]));
  }
  // The opt-out first: it must land even if the answer itself does not.
  if (optOut && row.partner_id && !row.opted_out) await stopCalling(row, "said during the call, recorded by the agent");
  if (horario && row.partner_id && !row.hours_told) { row.hours_told = true; bg(hoursHeard(row, horario)); }
  const saved = await patchCall(row.id, {
    result, offered_time: offered || null, offered_times: times.length ? times : null,
    price_said: Number.isFinite(price) && price > 0 && price < 1000 ? price : null, notes: notes || null,
  });
  if (!saved) throw new Error(`could not save the answer for call ${row.id}`);
  Object.assign(row, { result, offered_time: offered || null, notes: notes || null });
  console.log(`[calls] call ${row.id} answer: ${result}${offered ? " " + offered : ""}`);
  return { result, offered };
}

// A registrar_respuesta whose webhook never arrived (cold start, a database
// error, Vapi does not retry) is still in the call's messages, which come with
// the end-of-call report and with GET /call/{id}.
async function recoverAnswer(row: any, src: any) {
  if (row.result) return;
  const lists = [src?.messages, src?.artifact?.messages, src?.artifact?.messagesOpenAIFormatted].filter(Array.isArray);
  for (const list of lists) {
    for (const m of list) {
      const calls = Array.isArray(m?.toolCalls) ? m.toolCalls : Array.isArray(m?.tool_calls) ? m.tool_calls : [];
      const tc = calls.find((x: any) => x?.function?.name === "registrar_respuesta");
      if (tc) { console.log(`[calls] call ${row.id}: answer recovered from the call's messages`); await recordAnswer(row, parseArgs(tc.function.arguments)); return; }
    }
  }
}

// "No nos llamen más" said as the studio hangs up never reaches the tool call,
// so the studio's own words are read too (accents stripped, the agent's lines
// left out where the transcript marks them). A false match only stops calls
// to that one studio, which is the safe side to be wrong on.
const OPT_OUT_RE = /\bno (nos|me|le|les) (vuelv\w* a )?llam(e|en|eis|es|ar|ad)\b|\bno (vuelv\w* a )?llam(e|en|eis)\b|\bdej(e|en|ad|a) de llamar|\bquit(e|en|a)nos\b|\bborr(e|en|a)nos\b|\bno (queremos|quiero) (recibir )?(mas )?llamadas\b/;
function studioWords(src: any): string {
  const msgs = [src?.messages, src?.artifact?.messages].filter(Array.isArray).flat();
  let said = msgs.filter((m: any) => m?.role === "user").map((m: any) => String(m.message || m.content || "")).join(" ");
  if (!said) {
    const tr = String(src?.artifact?.transcript || src?.transcript || "");
    const mine = tr.split("\n").filter((l) => /^\s*(user|customer)\s*:/i.test(l));
    said = mine.length ? mine.join(" ") : tr;
  }
  return stripAccents(said.toLowerCase());
}
async function optOutFromWords(row: any, src: any) {
  if (!row.partner_id || row.opted_out || /pidió no recibir/.test(String(row.notes || ""))) return;
  const m = studioWords(src).match(OPT_OUT_RE);
  if (!m) return;
  await stopCalling(row, `their own words at the end of the call: "${m[0]}", which means they want no more calls`);
  const notes = [String(row.notes || ""), "pidió no recibir más llamadas (transcripción)"].filter(Boolean).join(" | ").slice(0, 500);
  if (await patchCall(row.id, { notes })) row.notes = notes;
}

async function stopCalling(row: any, how: string) {
  row.opted_out = true;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const ok = await patchOk(`partners?id=eq.${encodeURIComponent(row.partner_id)}`, { call_ok: false, call_ok_note: `Pidió no recibir llamadas (llamada del ${day})` });
  const name = String(row.vars?.centro || row.partner_id);
  console.log(ok ? `[calls] ${name} asked not to be called again; call_ok off` : `[calls] !!! ${name} asked not to be called again and call_ok could NOT be switched off`);
  // In the background: this can run inside a tool call the agent is waiting on.
  bg(tellJordan(ok ? `${name} asked not to be phoned again` : `Switch off calls to ${name} by hand`, [
    `${name} asked not to be phoned again (${how}).`,
    ok ? "partners.call_ok is now false, so studio-calls will not ring them again." : `The database write failed. Set partners.call_ok = false for partner ${row.partner_id} before the next request reaches them.`,
    `studio_calls row ${row.id}${row.request_id ? `, request #${row.request_id}` : ""}${row.test ? " (test call)" : ""}.`,
  ]));
}

// CLAUDE.md: a studio's stated hours belong in partners.opening_hours. They
// are not written here: Spanish studios often close at midday, and
// dispatch-studios' parser keeps one range per day, so an automatic write of
// "10:00-14:00, 17:00-21:00" could stop every morning ask. Jordan gets the line
// in the format the parser reads, next to what is on file now.
async function hoursHeard(row: any, horario: string) {
  const ps = await sq(`partners?id=eq.${encodeURIComponent(row.partner_id)}&select=opening_hours`).catch(() => []);
  const now = String((Array.isArray(ps) && ps[0]?.opening_hours) || "").trim();
  if (now && now.toLowerCase() === horario.toLowerCase()) return;
  const name = String(row.vars?.centro || row.partner_id);
  await tellJordan(`${name} told us its opening hours on the phone`, [
    `${name} said on the phone that it opens: ${horario}`,
    `On file now (partners.opening_hours): ${now || "nothing"}`,
    `If it is right, write it into opening_hours so no studio is asked for a time it is closed. Partner ${row.partner_id}, studio_calls row ${row.id}.`,
  ]);
}

// A time from a live (not test) call becomes the customer's offer, through
// wa-bot, one request at a time: two studios can say yes within seconds and
// wa-bot's one-live-offer check is a read then a write. Only an answer from
// wa-bot's studio_offer handler counts as relayed; anything else is tried again
// by the next report or reconcile, up to RELAY_TRIES, and then Jordan is told.
const RELAY_TRIES = 3;
async function relayIfDue(rowId: string) {
  const ready = (r: any) => r && !r.test && !r.relayed_at && r.request_id && r.partner_id && r.offered_time && ["yes", "other_time"].includes(String(r.result || "")) && Number(r.relay_out?.attempts || 0) < RELAY_TRIES;
  let row = await getCall(rowId);
  if (!ready(row)) return;
  if ((await config()).mode !== "on") { console.log(`[calls] call ${rowId} has a time but VOICE_CALLS is not on; recorded only`); return; }
  const reqId = Number(row.request_id);
  let claimed = false;
  // The lock outlives wa-bot's longest answer (60s), and a second yes waits
  // for the first rather than giving up after a few seconds.
  for (let i = 0; i < 30 && !claimed; i++) {
    claimed = (await rpc("claim_call_relay", { p_request: reqId, p_secs: 90 })) === true;
    if (!claimed) await sleep(2500);
  }
  if (!claimed) { console.log(`[calls] req=${reqId} relay lock busy, call ${rowId} left for reconcile`); return; }
  try {
    row = await getCall(rowId);
    if (!ready(row)) return;
    const name = String(row.vars?.centro || row.partner_id);
    // A relay we gave up on can still have finished inside wa-bot. Its offer is
    // on the dispatch row, and sending it twice would put two sets of Yes / No
    // buttons in front of the customer.
    const dq = await sq(`request_dispatch?request_id=eq.${reqId}&partner_id=eq.${encodeURIComponent(row.partner_id)}&channel=eq.call&offered_at=gte.${encodeURIComponent(String(row.created_at))}&select=id`);
    if (Array.isArray(dq) && dq.length) {
      await patchCall(rowId, { relayed_at: new Date().toISOString(), relay_out: { ok: true, already: true, row: dq[0].id } });
      console.log(`[calls] req=${reqId} call ${rowId}: wa-bot already has this offer`);
      return;
    }
    const attempts = Number(row.relay_out?.attempts || 0) + 1;
    let out: Record<string, unknown>;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/wa-bot`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000),
        body: JSON.stringify({ ops: "studio_offer", key: OPS_KEY, request_id: reqId, partner_id: row.partner_id, time: row.offered_time, day: "", option: "call", channel: "call" }),
      });
      const txt = await res.text();
      let got: any = null;
      try { got = JSON.parse(txt); } catch { /* not wa-bot's answer */ }
      if (res.ok && got && typeof got.ok === "boolean") {
        // wa-bot decided. A refusal ("request is confirmed") is final too.
        await patchCall(rowId, { relayed_at: new Date().toISOString(), relay_out: got });
        console.log(`[calls] req=${reqId} call ${rowId} relayed ${row.offered_time}: ${JSON.stringify(got).slice(0, 160)}`);
        if (got.ok === false && !/^request is /.test(String(got.reason || ""))) {
          await tellJordan(`${name}'s phone yes for #${reqId} did not reach the customer`, [
            `${name} said on the phone they can do ${row.offered_time} for request #${reqId}. wa-bot refused the offer: ${String(got.reason || "no reason given")}.`,
            "The studio was told it is not booked yet. Nothing has gone to the customer.",
          ]);
        }
        return;
      }
      out = { ok: false, status: res.status, body: txt.slice(0, 200) };
    } catch (e) {
      out = { ok: false, reason: String(e).slice(0, 200) };
    }
    await patchCall(rowId, { relay_out: { ...out, attempts } });
    console.log(`[calls] req=${reqId} relay to wa-bot failed (try ${attempts} of ${RELAY_TRIES}): ${JSON.stringify(out).slice(0, 160)}`);
    if (attempts >= RELAY_TRIES) {
      await tellJordan(`${name}'s phone yes for #${reqId} could not be handed to wa-bot`, [
        `${name} said on the phone they can do ${row.offered_time} for request #${reqId}, and ${RELAY_TRIES} tries to hand it to wa-bot failed (last: ${JSON.stringify(out).slice(0, 200)}).`,
        "Nothing has gone to the customer. The studio was told it is not booked yet.",
      ]);
    }
  } finally {
    await rpc("release_call_relay", { p_request: reqId });
  }
}

function resultFromEnd(endedReason: string): string {
  const er = endedReason.toLowerCase();
  if (er === "voicemail") return "voicemail";
  if (er === "customer-did-not-answer") return "no_answer";
  if (er.includes("busy")) return "busy";
  if (/error|fault|failed/.test(er)) return "failed";
  return "no_result";
}
function parseArgs(a: unknown): Record<string, unknown> {
  if (a && typeof a === "object") return a as Record<string, unknown>;
  try { const o = JSON.parse(String(a || "{}")); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
function endFields(src: any, row: any): Record<string, unknown> {
  const er = String(src.endedReason || "");
  const startedAt = src.startedAt || src.call?.startedAt || null;
  const endedAt = src.endedAt || src.call?.endedAt || new Date().toISOString();
  const dur = num(src.durationSeconds) ?? (startedAt ? Math.max(0, (Date.parse(endedAt) - Date.parse(startedAt)) / 1000) : null);
  return {
    status: "ended", ended_reason: er || null, ended_at: endedAt,
    summary: String(src.analysis?.summary || src.summary || "").slice(0, 1000) || null,
    transcript: String(src.artifact?.transcript || src.transcript || "").slice(0, 8000) || null,
    cost: num(src.cost),
    duration_s: Number.isFinite(dur as number) ? dur : null,
    ...(row.result ? {} : { result: resultFromEnd(er) }),
  };
}
// The end of a call, from the report or from GET /call/{id}: an opt-out the
// tool call missed, the answer if it was lost, then the closing fields. If the
// answer cannot be written this throws before ended_at is set, so reconcile
// comes back to it.
async function finishCall(row: any, src: any) {
  await optOutFromWords(row, src);
  await recoverAnswer(row, src);
  await patchCall(row.id, endFields(src, row));
}

// --- Vapi's webhook. Answers tool calls at once; anything slow runs after.
// The URL is signed for one row (c), and the message must carry that row's
// Vapi call id: a message with none, or with another call's, is ignored.
async function webhook(body: any, rowId: string): Promise<Response> {
  const msg = body?.message || {};
  const type = String(msg.type || "");
  const callId = String(msg.call?.id || "");
  let row: any = null;
  try {
    row = callId ? await getCall(rowId) : null;
    // The webhook beat the PATCH that stores the call id.
    if (row && !row.vapi_call_id) { await patchCall(row.id, { vapi_call_id: callId }); row.vapi_call_id = callId; }
    else if (row && row.vapi_call_id !== callId) row = null;
  } catch (e) { console.log("[calls] webhook lookup failed", String(e)); }

  if (type === "tool-calls") {
    const list = Array.isArray(msg.toolCallList) ? msg.toolCallList : [];
    const results: Array<{ toolCallId: string; result: string }> = [];
    for (const tc of list) {
      const name = String(tc?.function?.name || tc?.name || "");
      if (name === "registrar_respuesta" && row) {
        try {
          const a = await recordAnswer(row, parseArgs(tc?.function?.arguments ?? tc?.parameters));
          if (a.offered) bg(relayIfDue(String(row.id)));
        } catch (e) { console.log("[calls] could not record answer; the end-of-call report will try again", String(e)); }
      } else if (!row) console.log(`[calls] tool call ${name} for unknown call ${callId}`);
      results.push({ toolCallId: String(tc?.id || ""), result: "ok" });
    }
    return json({ results });
  }
  if (!row) { console.log(`[calls] ${type} for unknown call ${callId}`); return json({ ok: true }); }
  try {
    if (type === "status-update") {
      const st = String(msg.status || "");
      if (st && st !== "ended") await patchCall(row.id, { status: st }, "&status=neq.ended");
      else if (st === "ended") await patchCall(row.id, { status: "ended", ...(msg.endedReason ? { ended_reason: String(msg.endedReason) } : {}) });
    } else if (type === "end-of-call-report") {
      await finishCall(row, msg);
      bg(relayIfDue(String(row.id)));
    }
  } catch (e) { console.log(`[calls] ${type} failed for ${row.id}; reconcile will pick it up`, String(e)); }
  return json({ ok: true });
}

// --- ops: reconcile. Webhooks are not retried by Vapi, so anything still open
// after 10 minutes is read back from GET /call/{id}, and a yes from the last
// six hours that never reached wa-bot is handed over again.
async function reconcile() {
  const cfg = await config();
  if (!cfg.apiKey) return { ok: false, reason: "VAPI_API_KEY missing in app_secrets" };
  const before = new Date(Date.now() - 10 * 60e3).toISOString();
  const never = await sq(`studio_calls?vapi_call_id=is.null&ended_at=is.null&created_at=lt.${before}&select=id`);
  for (const n of Array.isArray(never) ? never : []) await patchCall(n.id, { status: "failed", result: "failed", error: "never placed", ended_at: new Date().toISOString() });
  const open = await sq(`studio_calls?vapi_call_id=not.is.null&ended_at=is.null&created_at=lt.${before}&order=created_at.asc&limit=25&select=*`);
  const out: Array<Record<string, unknown>> = [];
  for (const row of Array.isArray(open) ? open : []) {
    try {
      const res = await fetch(`${VAPI}/call/${encodeURIComponent(row.vapi_call_id)}`, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(15000) });
      const c: any = await res.json().catch(() => ({}));
      if (!res.ok) { out.push({ id: row.id, error: res.status }); continue; }
      if (String(c.status || "") !== "ended") { await patchCall(row.id, { status: String(c.status || row.status) }); out.push({ id: row.id, status: c.status }); continue; }
      await finishCall(row, c);
      out.push({ id: row.id, status: "ended", ended_reason: c.endedReason || null });
    } catch (e) { out.push({ id: row.id, error: String(e).slice(0, 120) }); }
  }
  const since = new Date(Date.now() - 6 * 3600e3).toISOString();
  const due = await sq(`studio_calls?test=is.false&relayed_at=is.null&offered_time=not.is.null&result=in.(yes,other_time)&created_at=gt.${since}&order=created_at.desc&limit=25&select=id`);
  for (const d of Array.isArray(due) ? due : []) {
    try { await relayIfDue(String(d.id)); } catch (e) { console.log(`[calls] reconcile relay failed for ${d.id}`, String(e)); }
  }
  return { ok: true, never_placed: Array.isArray(never) ? never.length : 0, checked: out.length, calls: out, relay_checked: Array.isArray(due) ? due.length : 0 };
}

async function status(body: Record<string, unknown>) {
  const id = Number(body.request_id || 0);
  const rows = await sq(`studio_calls?${id ? `request_id=eq.${id}&` : ""}order=created_at.desc&limit=30&select=*`);
  return { ok: true, mode: (await config()).mode, calls: Array.isArray(rows) ? rows : [] };
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "not found" }, 404);
  if (!OPS_KEY) return json({ ok: false, error: "not configured" }, 503);
  const url = new URL(req.url);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const hook = url.searchParams.get("hook");
  if (hook !== null) {
    const c = url.searchParams.get("c") || "";
    if (!/^[0-9a-f-]{36}$/i.test(c) || !sameStr(hook, await hookSig(c))) return json({ ok: false }, 403);
    try { return await webhook(body, c); }
    catch (e) { console.log("[calls] webhook failed", String(e)); return json({ ok: false }, 200); }
  }

  const ops = String(body?.ops || "");
  const handlers: Record<string, (b: Record<string, unknown>) => Promise<unknown>> = { place, test_call: testCall, status, reconcile };
  if (!handlers[ops]) return json({ ok: false, error: "not found" }, 404);
  if (!sameStr(String(body.key || ""), OPS_KEY)) return json({ ok: false }, 403);
  try { return json(await handlers[ops](body)); }
  catch (e) { console.log(`[calls] ops ${ops} failed`, String(e)); return json({ ok: false, error: String(e).slice(0, 200) }, 500); }
}

// resendKey is optional: without it, what Jordan should hear only reaches the logs.
export function start(opts: { opsKey: string; resendKey?: string; studioOutreachPaused?: boolean }) {
  OPS_KEY = opts.opsKey;
  if (opts.resendKey) RESEND_API_KEY = opts.resendKey;
  if (opts.studioOutreachPaused) STUDIO_OUTREACH_PAUSED = true;
  Deno.serve(handleRequest);
}
