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
// until the customer taps Yes. The studio hears exactly that before it hangs up.
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
//   ?hook=<sig>                                      Vapi's webhook: tool-calls, status-update, end-of-call-report
//
// SAFETY
//  - A studio is only phoned with call_ok = true, not opted out, not suspended,
//    and only once its WhatsApp ask for this request has gone out, so every
//    gate in dispatch-studios (opening hours, test customers, the outreach
//    pause, the 24h cap) has already been passed. dispatch-studios only hands
//    over studios whose listed hours say they are open right now.
//  - Only between 09:00 and 21:00 Madrid, and never twice about one request.
//  - A test customer's request never rings anything but a VOICE_TEST_NUMBERS phone.
//  - The agent never asks for a discount and never confirms a booking.
//  - No recording. Voicemail: it hangs up without leaving a message.
//
// The repo is public, so this file carries no secrets. The deployed function
// is a short loader that pins one commit of this file and passes the ops key in.

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const FN_URL = `${SUPABASE_URL}/functions/v1/studio-calls`;
const VAPI = "https://api.vapi.ai";
let OPS_KEY = "";
let STUDIO_OUTREACH_PAUSED = false;

const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;
// A front desk either answers in a ring or two or is busy with a client. 25s of
// ringing hangs up before most Spanish carrier voicemail picks up.
const RING_S = 25;
const MAX_CALL_S = 120;
const SILENCE_S = 20;
const CLOSED_STAGES = ["confirmed", "cancelled", "dismissed", "no_show", "needs_review", "stale", "too_late", "needs_contact"];

// Belt on top of dispatch-studios' own test-customer rule: Jordan, Cata, Yi and
// the fake 60000 numbers the replay uses.
const TEST_PHONES = ["34612474827", "15622355063", "17867276503", "34613977900", "34635569364", "34662680781"];
const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu"];
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
const patchCall = (id: string, body: Record<string, unknown>, filter = "") =>
  sq(`studio_calls?id=eq.${id}${filter}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });
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
// after 23 Sept 2026), so a header cannot be relied on.
async function hookSig(): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(OPS_KEY + ":vapi-hook"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("v1")));
  return [...mac.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
const ES_DAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
const EN_ES: Array<[RegExp, string]> = [
  [/\bmonday\b/gi, "lunes"], [/\btuesday\b/gi, "martes"], [/\bwednesday\b/gi, "miércoles"], [/\bthursday\b/gi, "jueves"],
  [/\bfriday\b/gi, "viernes"], [/\bsaturday\b/gi, "sábado"], [/\bsunday\b/gi, "domingo"],
  [/\bjanuary\b/gi, "enero"], [/\bfebruary\b/gi, "febrero"], [/\bmarch\b/gi, "marzo"], [/\bapril\b/gi, "abril"],
  [/\bmay\b/gi, "mayo"], [/\bjune\b/gi, "junio"], [/\bjuly\b/gi, "julio"], [/\baugust\b/gi, "agosto"],
  [/\bseptember\b/gi, "septiembre"], [/\boctober\b/gi, "octubre"], [/\bnovember\b/gi, "noviembre"], [/\bdecember\b/gi, "diciembre"],
];
function toEs(t: string): string {
  let out = String(t || "");
  for (const [re, es] of EN_ES) out = out.replace(re, es);
  return out.replace(/(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/gi, "$1 de $2");
}
const WEEKDAY_ES = /^(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/;
function diaHablado(day1: unknown, messageText: unknown): string {
  const fmt = (t: Date) => ES_DAY.format(t).replace(",", "").toLowerCase();
  const today = fmt(new Date()), tomorrow = fmt(new Date(Date.now() + 86400e3));
  const d = String(day1 || "").trim();
  // wa-bot v50 writes the date the customer tapped ("Fecha: martes 14 de octubre").
  const fm = String(messageText || "").match(/Fecha: ([^|]+)/);
  let f = fm ? toEs(fm[1].trim().toLowerCase()) : "";
  if (!f) {
    if (/^(hoy|today)$/i.test(d)) return "hoy";
    if (/^(ma[nñ]ana|tomorrow)$/i.test(d)) return "mañana";
    f = toEs(d.toLowerCase());
  }
  if (f === today) return "hoy";
  if (f === tomorrow) return "mañana";
  // Only a real date is worth a phone call. "Flexible" or "this weekend" is not.
  if (WEEKDAY_ES.test(f) && /\d/.test(f)) return `el ${f}`;
  return "";
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
const SVC_ES: Array<[RegExp, string]> = [
  [/deep tissue|descontract/i, "masaje descontracturante"], [/thai|tailand/i, "masaje tailandés"],
  [/hot stone|piedras/i, "masaje con piedras calientes"], [/sport|deportiv/i, "masaje deportivo"],
  [/balin/i, "masaje balinés"], [/shiatsu/i, "shiatsu"], [/reflexolog/i, "tratamiento de reflexología"],
  [/lymphatic|linf/i, "drenaje linfático"], [/couples|pareja/i, "masaje en pareja"],
  [/kobido|facial/i, "masaje facial kobido"], [/prenatal|embaraz/i, "masaje prenatal"],
  [/head|scalp|cabeza/i, "masaje de cabeza"], [/foot|feet|pies/i, "masaje de pies"],
  [/four hands|cuatro manos/i, "masaje a cuatro manos"], [/gua sha/i, "tratamiento de gua sha"],
];
function servicioHablado(r: Record<string, unknown>): string {
  const name = String(r.service_name || "");
  let base = "masaje relajante";
  for (const [re, v] of SVC_ES) if (re.test(name)) { base = v; break; }
  const m = String(r.message_text || "").match(/Duraci[oó]n: (\d{2,3}) min/);
  const mins = m ? parseInt(m[1], 10) : 60;
  const gender = r.therapist_gender === "male" ? " con masajista chico" : r.therapist_gender === "female" ? " con masajista chica" : "";
  return `${base} de ${mins} minutos${gender}`;
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
const FIRST_MESSAGE = "Hola, buenas. Le llama el asistente automático de Massage Club, de parte de Jordan, por una reserva de un cliente. ¿Tienen hueco {{dia}} a las {{hora}} para un {{servicio}}?";
const CLOSE_YES = "Perfecto, se lo proponemos al cliente ahora mismo. Todavía no está reservado: les confirmamos por WhatsApp en cuanto el cliente diga que sí. Gracias.";
const CLOSE_NO = "Entendido, muchas gracias. Que tengan buen día.";
const SYSTEM = [
  "Eres el asistente automático de Massage Club y estás al teléfono con {{centro}}, un centro de masajes de Madrid. Llamas de parte de Jordan. Massage Club busca hueco en centros de Madrid para clientes que hablan inglés.",
  "Ya has saludado y has preguntado si tienen hueco {{dia}} a las {{hora}} para un {{servicio}}.",
  "Hablas español de España, de usted, con frases cortas y naturales. Es una llamada breve.",
  "",
  "Solo quieres saber esto:",
  "1. Si pueden {{dia}} a las {{hora}}.",
  "2. Si no pueden a esa hora, la hora más cercana que tengan ese mismo día.",
  "3. El precio, solo si lo dicen ellos. No insistas.",
  "",
  "Reglas:",
  "- No pidas descuentos ni hables de comisiones.",
  "- No confirmes la reserva ni digas que está reservada. El cliente decide primero.",
  "- No des datos del cliente. Si preguntan, es un cliente que habla inglés.",
  "- Si preguntan quién eres, di otra vez que eres un asistente automático de Massage Club que llama de parte de Jordan.",
  "- Si quieren hablar con una persona, di que tomas nota para Jordan y ponlo en notas.",
  "- Si piden que no les llamemos más, pide disculpas, di que no volverán a recibir llamadas nuestras y marca no_llamar.",
  "- Si contesta un buzón de voz o un contestador, cuelga sin dejar mensaje.",
  "- Antes de despedirte, llama siempre a registrar_respuesta con lo que han dicho. Horas en formato HH:MM de 24 horas.",
  `- Si tienen hueco, a esa hora o a otra de ese día, despídete con estas palabras exactas: "${CLOSE_YES}"`,
  `- Si no tienen hueco ese día, despídete con: "${CLOSE_NO}"`,
  "- Después de despedirte, cuelga con endCall.",
].join("\n");

// Vapi's JsonSchema has no null type, so "no price said" is 0, read back as null.
const REGISTRAR = {
  type: "function",
  async: false,
  function: {
    name: "registrar_respuesta",
    description: "Guarda la respuesta del centro. Llámala una sola vez, antes de despedirte.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        disponible: { type: "boolean", description: "true si pueden exactamente a la hora pedida." },
        hora_ofrecida: { type: "string", description: "La hora que pueden ese día, HH:MM: la pedida si pueden, o la más cercana que ofrezcan. Vacío si no pueden ese día." },
        otras_horas: { type: "array", items: { type: "string" }, description: "Otras horas que hayan dicho para ese día, HH:MM. Vacío si ninguna." },
        precio_eur: { type: "number", description: "Precio en euros si lo han dicho. 0 si no lo han dicho." },
        no_llamar: { type: "boolean", description: "true si han pedido que no les llamemos más." },
        notas: { type: "string", description: "Cualquier otra cosa importante que hayan dicho, en pocas palabras. Vacío si nada." },
      },
      required: ["disponible", "hora_ofrecida", "otras_horas", "precio_eur", "no_llamar", "notas"],
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

type Vars = { centro: string; dia: string; hora: string; servicio: string };
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
      model: { ...modelFor(cfg), temperature: 0.2, maxTokens: 200, messages: [{ role: "system", content: SYSTEM }], tools: [REGISTRAR, { type: "endCall" }] },
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
      body: JSON.stringify(callBody(cfg, to, vars, rowId, await hookSig(), label)),
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
  const dia = diaHablado(r.day1, r.message_text);
  if (!hora || !dia) return { ok: true, mode: cfg.mode, request_id: id, placed: 0, reason: `no exact ${!hora ? "hour" : "day"} to ask about` };
  const servicio = servicioHablado(r);
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
    const vars: Vars = { centro: name.slice(0, 80), dia, hora, servicio };
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
    servicio: clip(body.servicio, 80) || "masaje relajante de 60 minutos",
  };
  const out = await dial(cfg, to, vars, { request_id: null, partner_id: null, test: true }, `MC test ${vars.centro}`);
  return { ok: out.placed, mode: cfg.mode, vars, ...out };
}

// --- The studio's answer, from the tool call (or from a reconcile).
async function recordAnswer(row: any, a: Record<string, unknown>) {
  const asked = String(row.vars?.hora || "");
  const t = hhmm(a.hora_ofrecida);
  const others = (Array.isArray(a.otras_horas) ? a.otras_horas : []).map(hhmm).filter(Boolean);
  let result = "no", offered = "";
  if (a.disponible === true) { offered = t || asked; result = offered && asked && offered !== asked ? "other_time" : "yes"; }
  else if (t || others.length) { offered = t || others[0]; result = "other_time"; }
  const price = Number(a.precio_eur);
  const times = [...new Set([offered, ...others].filter(Boolean))].slice(0, 6);
  const notes = [String(a.notas || "").trim(), a.no_llamar === true ? "pidió no recibir más llamadas" : ""].filter(Boolean).join(" | ").slice(0, 500);
  await patchCall(row.id, {
    result, offered_time: offered || null, offered_times: times.length ? times : null,
    price_said: Number.isFinite(price) && price > 0 && price < 1000 ? price : null, notes: notes || null,
  });
  if (a.no_llamar === true && row.partner_id) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    await sq(`partners?id=eq.${row.partner_id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ call_ok: false, call_ok_note: `Pidió no recibir llamadas (llamada del ${day})` }),
    });
    console.log(`[calls] partner ${row.partner_id} asked not to be called again; call_ok off`);
  }
  console.log(`[calls] call ${row.id} answer: ${result}${offered ? " " + offered : ""}`);
  return { result, offered };
}

// A time from a live (not test) call becomes the customer's offer, through
// wa-bot, one request at a time: two studios can say yes within seconds and
// wa-bot's one-live-offer check is a read then a write.
async function relayIfDue(rowId: string) {
  const ready = (r: any) => r && !r.test && !r.relayed_at && r.request_id && r.partner_id && r.offered_time && ["yes", "other_time"].includes(String(r.result || ""));
  let row = await getCall(rowId);
  if (!ready(row)) return;
  if ((await config()).mode !== "on") { console.log(`[calls] call ${rowId} has a time but VOICE_CALLS is not on; recorded only`); return; }
  const reqId = Number(row.request_id);
  let claimed = false;
  for (let i = 0; i < 8 && !claimed; i++) {
    claimed = (await rpc("claim_call_relay", { p_request: reqId, p_secs: 30 })) === true;
    if (!claimed) await sleep(2500);
  }
  if (!claimed) { console.log(`[calls] req=${reqId} relay lock busy, call ${rowId} left for the next webhook or reconcile`); return; }
  try {
    row = await getCall(rowId);
    if (!ready(row)) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/wa-bot`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ ops: "studio_offer", key: OPS_KEY, request_id: reqId, partner_id: row.partner_id, time: row.offered_time, day: "", option: "call", channel: "call" }),
      });
      const out = await res.json().catch(() => ({ ok: false, status: res.status }));
      await patchCall(rowId, { relayed_at: new Date().toISOString(), relay_out: out });
      console.log(`[calls] req=${reqId} call ${rowId} relayed ${row.offered_time}: ${JSON.stringify(out).slice(0, 160)}`);
    } catch (e) {
      // No relayed_at, so end-of-call-report or reconcile tries again.
      await patchCall(rowId, { relay_out: { ok: false, reason: String(e).slice(0, 200) } });
      console.log(`[calls] req=${reqId} relay to wa-bot failed`, String(e));
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

// --- Vapi's webhook. Answers tool calls at once; anything slow runs after.
async function webhook(body: any, rowHint: string): Promise<Response> {
  const msg = body?.message || {};
  const type = String(msg.type || "");
  const callId = String(msg.call?.id || "");
  let row: any = null;
  try {
    if (callId) {
      const rows = await sq(`studio_calls?vapi_call_id=eq.${encodeURIComponent(callId)}&select=*`);
      row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    }
    if (!row && /^[0-9a-f-]{36}$/i.test(rowHint)) {
      row = await getCall(rowHint);
      // The webhook beat the PATCH that stores the call id.
      if (row && callId && !row.vapi_call_id) await patchCall(row.id, { vapi_call_id: callId });
      else if (row && callId && row.vapi_call_id !== callId) row = null;
    }
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
        } catch (e) { console.log("[calls] could not record answer", String(e)); }
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
      await patchCall(row.id, endFields(msg, row));
      bg(relayIfDue(String(row.id)));
    }
  } catch (e) { console.log(`[calls] ${type} failed for ${row.id}`, String(e)); }
  return json({ ok: true });
}

// --- ops: reconcile. Webhooks are not retried by Vapi, so anything still open
// after 10 minutes is read back from GET /call/{id}.
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
      // A tool call whose webhook was lost is still in the call's messages.
      if (!row.result) {
        for (const m of [...(Array.isArray(c.messages) ? c.messages : []), ...(Array.isArray(c.artifact?.messages) ? c.artifact.messages : [])]) {
          const tc = (Array.isArray(m?.toolCalls) ? m.toolCalls : []).find((t: any) => t?.function?.name === "registrar_respuesta");
          if (tc) { const a = await recordAnswer(row, parseArgs(tc.function.arguments)); row.result = a.result; break; }
        }
      }
      await patchCall(row.id, endFields(c, row));
      await relayIfDue(String(row.id));
      out.push({ id: row.id, status: "ended", ended_reason: c.endedReason || null });
    } catch (e) { out.push({ id: row.id, error: String(e).slice(0, 120) }); }
  }
  return { ok: true, never_placed: Array.isArray(never) ? never.length : 0, checked: out.length, calls: out };
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
    if (!sameStr(hook, await hookSig())) return json({ ok: false }, 403);
    try { return await webhook(body, url.searchParams.get("c") || ""); }
    catch (e) { console.log("[calls] webhook failed", String(e)); return json({ ok: false }, 200); }
  }

  const ops = String(body?.ops || "");
  const handlers: Record<string, (b: Record<string, unknown>) => Promise<unknown>> = { place, test_call: testCall, status, reconcile };
  if (!handlers[ops]) return json({ ok: false, error: "not found" }, 404);
  if (!sameStr(String(body.key || ""), OPS_KEY)) return json({ ok: false }, 403);
  try { return json(await handlers[ops](body)); }
  catch (e) { console.log(`[calls] ops ${ops} failed`, String(e)); return json({ ok: false, error: String(e).slice(0, 200) }, 500); }
}

export function start(opts: { opsKey: string; studioOutreachPaused?: boolean }) {
  OPS_KEY = opts.opsKey;
  if (opts.studioOutreachPaused) STUDIO_OUTREACH_PAUSED = true;
  Deno.serve(handleRequest);
}
