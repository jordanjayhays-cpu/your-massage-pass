// wa-bot v48 (6 Sept): the bot module lives in this repo and is loaded by a
// five-line index.ts deployed on Supabase that pins this file by commit and
// passes the secrets in (start({ waToken, resendKey, opsKey })). Nothing secret
// is in this file. v48 also: the massage words count as Spanish for language
// detection (copy.ts), and "hora y media" / "90 min" is carried as the
// requested duration into the request, the studio ask and the confirmation.
// wa-bot v47: a customer who declines in a sentence ("I'm not going to be having
// any massage", "me voy de Madrid") at the after-booking email question cancels
// the booking and is acknowledged; nothing that is not an email address is ever
// answered with "that does not look like an email" unless it contains an "@".
// wa-bot v46: best offer wins, not the fastest tap. A studio's Confirmado on a
// request that is not for today opens a short bidding window: the studio is
// told, truthfully, that several studios were asked and the client goes with
// the best offer, and is invited to write "10%" for a discount. A written
// discount of 10% or more wins at once; otherwise the best accepted offer is
// awarded when the window closes (ops "settle", called by cron every 5 min).
// Same-day requests still go to the first yes. The customer only hears the
// discount once it is confirmed, on the confirmation itself.
// wa-bot v39: the hours around a booking are no longer a person's job.
// booking-guard sends the T-3h check (template buttons), the T-1h studio
// warning and the T+20 arrival question; this bot answers every tap
// (rc_yes/rc_change/rc_cancel from customers, arr_yes/arr_no from studios).
// A customer with a confirmed booking who writes "tomorrow", "cancel" or a
// bare "No" freezes the booking and is asked what works, instead of being
// promised a person. A studio writing during a live booking ("no ha llegado",
// "¿podéis contactar?") pings the customer at once and gets an answer. Meta
// delivery failures (the 24h window) are logged in the chat and sent to
// Jordan, because on 4 Sept two reminders silently never arrived. Messages
// outside the 24h window go as approved templates.
// wa-bot v38: offer button ids carry the dispatch row UUID (v36/v37 built
// them with Number(uuid) = NaN, so no tap could ever match).
// wa-bot v37: same-day mornings get an honest answer (most studios open at
// 11 or 12), a studio changing the time on a booking it already won goes to the
// customer with the same Yes button, studios are asked to hold an offered
// slot for 15 minutes, and anything that needs a person reaches Jordan on
// WhatsApp, not only by email.
// wa-bot v36: studio offers close themselves. When a studio answers our ask
// with a different time ("a las 12:15"), the customer gets it with Yes /
// Another time buttons; Yes confirms the studio, tells the customer (chat and
// email) and stands the other studios down. Studio auto-replies are ignored
// instead of counted as answers. Bookings made at night say "at 09:00", not
// "right now". Also: the first reply to a new customer carries a private link to the
// booking card (book.massageclub.io/r/<token>), Partiful-style: three taps, no
// login, live studio replies. The chat keeps working underneath for typers.
// wa-bot v35: no studio question. The customer gives service, day, time and
// area, then we ask several studios at once (dispatch-studios) and the first
// to accept takes the booking. Choosing a studio was the step that killed the
// funnel: 4 customers reached it, 1 got through.
// wa-bot v34: the block list covers the Spanish euphemisms it was missing
// ("sensitivo", "servicio completo"), and a question about clothing gets a
// straight answer about professional standards instead of a human handoff.
// wa-bot v33: reactions are not answers, and any message from a known studio
// number stays out of the customer flow whatever its type.
// wa-bot v32: the studio step is one clear recommendation (yes / see others),
// studio links moved to AFTER the choice, funnel_events on every step.
// wa-bot v31: questions asked mid-flow are answered instead of being stored
// as the answer, and an unrecognised area falls back to all of Madrid.
// wa-bot v29: fast lane, tappable areas, therapists get a real answer.
// wa-bot - the WhatsApp booking bot. Called only by the whatsapp-webhook relay.

import { JORDAN_MAIN_NUMBER, AD_OPENER_RE, UNSURE_RE, ZONEQ_RE, detectDay, detectTime, strongSpanish, isEmail, stripAcc, TIME_RE, BACK_RE, HI_RE, BOOKAGAIN_RE, digitsOf, CHANGE_RE, GOODBYE_RE, CANCEL_RE, ARRIVED_RE, NOSHOW_RE, mcMadridHour, parseOfferedTime, AUTOREPLY_RE, EMAIL_IN_TEXT_RE, EROTIC_RE, MODESTY_RE, BLOCK_LINE_EN, BLOCK_LINE_ES, JOB_RE, ANY_RE, OTHERTYPE_RE, PRICEQ_RE, QUESTION_RE, looksLikeQuestion, HOWWORKS_RE, MAIN_SERVICES, MORE_SERVICES, ALL_SERVICES, SVC_ES, trSvc, trSvcLow, AREAS, AREA_ROWS, HOURS, COPY, SERVICE_HINTS, detectService, detectArea } from "https://raw.githubusercontent.com/jordanjayhays-cpu/your-massage-pass/1becc6fe4a0308d9bb98e0f16a2b1b7a1e5edd0e/supabase/functions/wa-bot/copy.ts";
const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
let RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const SUPPORT = ["support@massageclub.io"];
const JORDAN = ["jordan@massageclub.io", "jordanjayhays@gmail.com"]; // v39: "wants a person" must reach the Gmail too (Jordan, 5 Sept)
const LOGO_URL = "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/branding/mc-avatar-cream.png";
let OPS_KEY = Deno.env.get("MC_OPS_KEY") || "";
const APP = "https://book.massageclub.io";

let WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || "1270437552818077";
const GRAPH = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;

const svc = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const H = () => ({ apikey: svc(), Authorization: `Bearer ${svc()}`, "Content-Type": "application/json" });

async function logMsg(phone: string, direction: "in" | "out", body: string, msg_type = "text", reply_id = "") {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wa_messages`, {
      method: "POST", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ phone, direction, msg_type, body: body.slice(0, 2000), reply_id: reply_id || null }),
    });
  } catch (e) { console.log("[wa] log failed", String(e)); }
}

// Funnel instrumentation: one row per step so conversion is measurable.
async function logEvent(phone: string, event: string, meta: Record<string, unknown> = {}) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/funnel_events`, {
      method: "POST", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ phone: digitsOf(phone), event, meta }),
    });
  } catch (e) { console.log("[wa] event log failed", String(e)); }
}

async function waSend(to: string, payload: Record<string, unknown>, logBody: string, type: string) {
  const res = await fetch(GRAPH, {
    method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
  });
  if (!res.ok) console.log("[wa] send failed", res.status, (await res.text()).slice(0, 300));
  else await logMsg(to, "out", logBody, type);
  return res.ok;
}
const sendText = (to: string, body: string) => waSend(to, { type: "text", text: { body, preview_url: false } }, body, "text");
const sendButtons = (to: string, body: string, buttons: Array<{ id: string; title: string }>) =>
  waSend(to, { type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) } } }, body + " [" + buttons.map((b) => b.title).join("/") + "]", "buttons");
const sendList = (to: string, body: string, button: string, rows: Array<{ id: string; title: string; description?: string }>) =>
  waSend(to, { type: "interactive", interactive: { type: "list", body: { text: body }, action: { button: button.slice(0, 20), sections: [{ title: "Massage Club", rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: r.title.slice(0, 24), description: (r.description || "").slice(0, 72) })) }] } } }, body + " [" + rows.map((r) => r.title).join("/") + "]", "list");
const sendLocationRequest = (to: string, body: string) =>
  waSend(to, { type: "interactive", interactive: { type: "location_request_message", body: { text: body }, action: { name: "send_location" } } }, body + " [share location]", "location_request");

type Session = { phone: string; step: string; data: Record<string, any>; wa_name?: string };
async function getSession(phone: string): Promise<Session> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?phone=eq.${encodeURIComponent(phone)}&select=*`, { headers: H() });
  const rows = await r.json().catch(() => []);
  if (Array.isArray(rows) && rows[0]) return { phone, step: rows[0].step, data: rows[0].data || {}, wa_name: rows[0].wa_name };
  return { phone, step: "start", data: {} };
}
async function saveSession(s: Session) {
  await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?on_conflict=phone`, {
    method: "POST", headers: { ...H(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ phone: s.phone, step: s.step, data: s.data, wa_name: s.wa_name ?? null, updated_at: new Date().toISOString() }),
  });
}

// v39: WhatsApp delivers free text only within 24h of the person's last
// message; after that only approved templates arrive.
async function lastInboundMs(phone: string): Promise<number | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${encodeURIComponent(digitsOf(phone))}&direction=eq.in&order=created_at.desc&limit=1&select=created_at`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.created_at ? Date.parse(rows[0].created_at) : null;
}
async function canFreeform(phone: string): Promise<boolean> {
  const t = await lastInboundMs(phone);
  return t !== null && Date.now() - t < 23.5 * 3600 * 1000;
}
const tp = (s: string, max = 300) => (String(s || "").replace(/\s+/g, " ").trim() || "-").slice(0, max);
async function sendTemplate(to: string, name: string, lang: string, params: string[], payloads: string[] = [], logBody = "") {
  const components: any[] = [{ type: "body", parameters: params.map((p) => ({ type: "text", text: tp(p) })) }];
  payloads.forEach((p, i) => components.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload: p }] }));
  return waSend(to, { type: "template", template: { name, language: { code: lang }, components } }, `[template ${name}/${lang}] ${logBody || params.join(" | ")}`, "template");
}


const askService = (to: string, L: string) =>
  sendList(to, COPY[L].intro, COPY[L].introBtn, [
    ...MAIN_SERVICES.map((s) => ({ id: s.id, title: L === "es" ? s.tEs : s.tEn, description: s.id === "svc_unsure" ? (L === "es" ? "sin respuestas incorrectas" : "no wrong answers") : "" })),
    { id: "svc_more", title: COPY[L].moreRow.title, description: COPY[L].moreRow.desc },
    // v39: "Talk to a person" is the last resort, not a first-screen option (Jordan, 5 Sept).
    // It stays in the menu and anyone typing "human"/"persona" still gets a person.
    L === "es" ? { id: "lang_en", title: "English", description: "switch to English" } : { id: "lang_es", title: "Español", description: "cambiar a español" },
  ]);
const askServiceMore = (to: string, L: string) =>
  sendList(to, COPY[L].moreTitle, COPY[L].introBtn, [
    ...MORE_SERVICES.map((s) => ({ id: s.id, title: L === "es" ? s.tEs : s.tEn, description: "" })),
    { id: "svc_back", title: COPY[L].backRow.title, description: COPY[L].backRow.desc },
  ]);
// v50: the day buttons carry the date. "Mañana" tapped at 01:17 meant Sunday to
// David and Monday to every studio we asked (6 Sept). The long form is stored
// on the session (dayDate) and travels to the studios in message_text.
const SHORT_ES = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric" });
const SHORT_EN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric" });
const LONG_ES = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
const LONG_EN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
const shortDate = (L: string, plusDays: number) => (L === "es" ? SHORT_ES : SHORT_EN).format(new Date(Date.now() + plusDays * 86400e3)).replace(/[.,]/g, "");
const longDate = (L: string, plusDays: number) => (L === "es" ? LONG_ES : LONG_EN).format(new Date(Date.now() + plusDays * 86400e3)).replace(/,/g, "");
const dayBtns = (L: string) => [
  { id: "day_today", title: `${L === "es" ? "Hoy" : "Today"} (${shortDate(L, 0)})` },
  { id: "day_tomorrow", title: `${L === "es" ? "Mañana" : "Tomorrow"} (${shortDate(L, 1)})` },
  { id: "day_other", title: L === "es" ? "Otro día" : "Another day" },
];
const askDay = (to: string, L: string) => sendButtons(to, COPY[L].day, dayBtns(L));
const askDayUnsure = (to: string, L: string) => sendButtons(to, COPY[L].dayUnsure, dayBtns(L));
const askTime = (to: string, L: string) =>
  sendList(to, COPY[L].time, COPY[L].timeBtn, [
    { id: "time_morning", title: L === "es" ? HOURS.time_morning.labelEs : HOURS.time_morning.label, description: "" },
    { id: "time_afternoon", title: L === "es" ? HOURS.time_afternoon.labelEs : HOURS.time_afternoon.label, description: "" },
    { id: "time_evening", title: L === "es" ? HOURS.time_evening.labelEs : HOURS.time_evening.label, description: "" },
    { id: "time_custom", title: COPY[L].timeCustomRow.title, description: COPY[L].timeCustomRow.desc },
  ]);
const askHour = (to: string, L: string, band: string) => {
  const b = HOURS[band];
  const rows = b.hours.map((h) => ({ id: `hour_${h.replace(":", "")}`, title: h, description: "" }));
  rows.push({ id: "hour_flex", title: COPY[L].hourFlex, description: COPY[L].hourFlexDesc });
  return sendList(to, COPY[L].hour, COPY[L].hourBtn, rows);
};
const askArea = (to: string, L: string) =>
  sendList(to, COPY[L].area, COPY[L].areaBtn, [
    ...AREA_ROWS.map((a) => ({ id: a.id, title: L === "es" ? a.es : a.en, description: "" })),
    { id: "area_any", title: COPY[L].areaAnyTitle, description: COPY[L].areaAnyDesc },
    { id: "area_other", title: COPY[L].areaOtherTitle, description: COPY[L].areaOtherDesc },
  ]);

// What did they actually ask for, in their own words? Honour it instead of
// making them pick the same thing again from a menu.
const sendMenu = (to: string, L: string) => sendList(to, COPY[L].menuTitle, COPY[L].menuBtn, COPY[L].menuRows);

type Opt = { id: string; business_name: string; slug: string; area: string; google_rating: any; google_reviews: any; venue_type: string; wa: string; svc: string; duration: number; price: number };
async function matchStudios(area: string, want: string): Promise<Opt[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_studios`, {
    method: "POST", headers: H(),
    body: JSON.stringify({ p_area: area || null, p_want: want || null, p_exclude: null, p_limit: 3 }),
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? (rows as Opt[]) : [];
}
async function nearestArea(lat: number, lng: number): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nearest_area`, {
    method: "POST", headers: H(), body: JSON.stringify({ p_lat: lat, p_lng: lng }),
  });
  const v = await res.json().catch(() => null);
  return typeof v === "string" && v ? v : "Madrid";
}
async function findPartnerByName(name: string): Promise<{ id: string; slug: string; business_name: string } | null> {
  const q = name.replace(/[%_]/g, "").trim();
  if (!q) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/partners?business_name=ilike.*${encodeURIComponent(q)}*&select=id,slug,business_name&limit=1`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function findPartnerByNumber(fromDigits: string): Promise<{ id: string; business_name: string } | null> {
  const local = fromDigits.startsWith("34") && fromDigits.length === 11 ? fromDigits.slice(2) : fromDigits;
  if (!local || local.length < 9) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/partners?or=(whatsapp.ilike.*${local}*,phone.ilike.*${local}*)&select=id,business_name&limit=1`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function lastRequestFor(phone: string): Promise<any | null> {
  const num = "+" + digitsOf(phone);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent(num)}&stage=neq.dismissed&order=created_at.desc&limit=1&select=first_name,last_name,contact_email,service_name,studio_name,partner_id,slug,price,languages,day1,time1,confirmed_day,confirmed_time,stage`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// Editable draft for Jordan's "Reply on WhatsApp" button in founder emails.
async function customerPrefill(phone: string): Promise<string> {
  const b = await lastRequestFor(phone);
  // v39: the draft Jordan sends must be in the customer's language (Jordan, 5 Sept).
  const sess = await getSession(digitsOf(phone));
  const es = sess.data?.lang === "es" || (b && b.languages === "es");
  if (!b) return es
    ? "Hola, soy Jordan, de Massage Club. Encantado. ¿En qué te puedo ayudar?"
    : "Hi, I'm Jordan, a representative with Massage Club. Hope you're well. How can I help?";
  const when = b.stage === "confirmed" && b.confirmed_day ? [b.confirmed_day, b.confirmed_time].filter(Boolean).join(" ") : [b.day1, b.time1].filter(Boolean).join(" ");
  const svcN = es ? trSvcLow(b.service_name || "Massage", "es") : String(b.service_name || "massage").toLowerCase();
  return es
    ? `Hola${b.first_name ? " " + b.first_name : ""}, soy Jordan, de Massage Club. Encantado.\n\nVeo que estás pendiente de tu ${svcN}${when ? " para " + when : ""}. ¿Es así? Te ayudo personalmente.`
    : `Hi${b.first_name ? " " + b.first_name : ""}, I'm Jordan, a representative with Massage Club. Hope you're well.\n\nI see you need an update on your ${svcN}${when ? " for " + when : ""}. Is that right?`;
}

// The studio step used to be a five-way quiz and it converted at 25 per cent,
// while every earlier step converted at 60-100. So: lead with one clear
// recommendation (yes / see others), and keep the studio links until AFTER the
// choice so we stop inviting people out of the chat at the decision moment.
async function loadPicks(to: string, L: string, s: Session): Promise<boolean> {
  const svcRow = ALL_SERVICES.find((x) => x.id === s.data.service);
  let picks = await matchStudios(s.data.area || "", svcRow ? svcRow.en : "");
  // An area we do not recognise must never mean "no studios": fall back to all
  // of Madrid, the same way the rescue job does.
  if (!picks.length && s.data.area) picks = await matchStudios("", svcRow ? svcRow.en : "");
  if (!picks.length) return false;
  s.data.picks = picks.map((o) => ({ id: o.id, slug: o.slug, name: o.business_name, svc: o.svc, price: o.price, duration: o.duration, area: o.area }));
  return true;
}

async function askStudio(to: string, L: string, s: Session): Promise<boolean> {
  const ok = await loadPicks(to, L, s);
  if (!ok) return false;
  const top = s.data.picks[0];
  await sendButtons(to, COPY[L].topPick(top.name, trSvc(top.svc, L), top.duration || 60, Number(top.price), top.area || "Madrid"), COPY[L].topPickBtns);
  await logEvent(to, "studio_offered", { variant: "toppick", top: top.name, price: top.price });
  return true;
}

// The full list, only for people who ask to see more.
async function askStudioList(to: string, L: string, s: Session): Promise<boolean> {
  if (!Array.isArray(s.data.picks) || !s.data.picks.length) {
    const ok = await loadPicks(to, L, s);
    if (!ok) return false;
  }
  const picks = s.data.picks;
  const rows = picks.map((o: any, i: number) => ({
    id: `studio_${i}`,
    title: String(o.name).slice(0, 24),
    description: `${trSvc(o.svc, L)} ${o.duration || 60} min · ${Number(o.price)} EUR`,
  }));
  rows.push({ id: "studio_any", title: COPY[L].anyStudio, description: COPY[L].anyStudioDesc });
  rows.push({ id: "studio_other", title: COPY[L].otherStudio, description: COPY[L].otherStudioDesc });
  await sendList(to, COPY[L].studios, COPY[L].studiosBtn, rows);
  await logEvent(to, "studio_offered", { variant: "list" });
  return true;
}

// The booking card link. The token is the login, minted once per number and
// reused, so "your booking page" is always the same address.
async function bookingLink(phone: string, lang: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mc_booking_link`, {
      method: "POST", headers: H(), body: JSON.stringify({ p_phone: digitsOf(phone), p_lang: lang }),
    });
    const tok = await res.json().catch(() => null);
    return typeof tok === "string" && tok ? `${APP}/r/${tok}` : null;
  } catch (e) { console.log("[wa] booking link failed", String(e)); return null; }
}

// Greeting for a fresh conversation: returning customers get a personal hello.
async function greet(s: Session, from: string, firstText?: string): Promise<void> {
  const last = await lastRequestFor(from);
  if (!s.data.lang && last && last.languages === "es") s.data.lang = "es";
  const L = s.data.lang === "es" ? "es" : "en";
  if (last) {
    const fullName = [last.first_name, last.last_name].filter(Boolean).join(" ").trim();
    s.data.known = { name: fullName || null, email: last.contact_email || null };
    if (last.partner_id && !/por asignar/i.test(String(last.studio_name || ""))) {
      s.data.rebookOffer = { service: last.service_name, partner_id: last.partner_id, slug: last.slug, studio_name: last.studio_name, price: last.price };
      s.step = "returning_choice"; await saveSession(s);
      await sendButtons(from, COPY[L].welcomeBack(last.first_name || "", last.service_name ? trSvcLow(last.service_name, L) : (L === "es" ? "un masaje" : "a massage"), last.studio_name || ""), COPY[L].welcomeBackBtns);
      return;
    }
    s.step = "returning_choice"; await saveSession(s);
    await sendButtons(from, COPY[L].welcomeBackPlain(last.first_name || ""), COPY[L].welcomeBackPlainBtns);
    return;
  }
  // v39: someone arriving from the ad has only sent the canned English opener.
  // We do not know their language yet, so the first screen is bilingual and
  // short: one list, no link. Their first tap or word sets the language.
  if (!s.data.lang && (s.data.adRef || AD_OPENER_RE.test(String(firstText || "").trim()))) {
    s.step = "await_service"; await saveSession(s);
    await logEvent(from, "flow_started", { fromAd: true, bilingual: true });
    // v50: a price and a promise before the first question (Jordan, 6 Sept:
    // eleven of nineteen ad leads never answered the old first screen).
    await sendList(from,
      "Hola, somos Massage Club. Te buscamos hueco en un centro de masajes profesional cerca de ti: 60 min desde 45 EUR, pagas en el centro, sin comisión, y nosotros hablamos con los centros por ti.\n\nHi, this is Massage Club. We find you a slot at a professional massage studio near you: 60 min from 45 EUR, you pay the studio, no fee, and we deal with the studios for you.\n\n¿Qué masaje quieres? / Which massage?",
      "Elegir / Choose", [
        { id: "svc_relax", title: "Relajante · Relaxing", description: "" },
        { id: "svc_deep", title: "Descontracturante", description: "Deep tissue" },
        { id: "svc_thai", title: "Tailandés · Thai", description: "" },
        { id: "svc_sports", title: "Deportivo · Sports", description: "" },
        { id: "svc_unsure", title: "Ayúdame · Help me", description: "no sé qué tipo / not sure" },
        { id: "svc_more", title: "Más · More", description: "balinés, shiatsu, reflexología..." },
        { id: "lang_es", title: "Español", description: "seguir en español" },
        { id: "lang_en", title: "English", description: "continue in English" },
      ]);
    return;
  }
  // v36: new customers get the booking card link first. Everything below still
  // runs, so typing works exactly as before for anyone who prefers the chat.
  const cardUrl = await bookingLink(from, L);
  if (cardUrl) { await sendText(from, COPY[L].cardIntro(cardUrl)); await logEvent(from, "card_link_sent", {}); }
  if (firstText && absorbSentence(s, firstText, L)) {
    // v39: "Quiero reservar tailandés en Centro, lunes noche" is three answers, not a
    // reason to show the menu. Confirm what we understood and ask only the rest.
    const row = ALL_SERVICES.find((x) => x.id === s.data.service);
    await logEvent(from, "flow_started", { fastlane: true, service: s.data.service || null, absorbed: true });
    if (s.data.service) await logEvent(from, "service_chosen", { service: s.data.service, fastlane: true });
    const understood = [row ? (L === "es" ? String(row.tEs).toLowerCase() : String(row.tEn).toLowerCase()) : "", s.data.day, s.data.time, s.data.area].filter(Boolean).join(" · ");
    await sendText(from, COPY[L].gotItSvc(understood || (L === "es" ? "tu petición" : "your request")));
    await continueFromKnown(s, from, L);
    return;
  }
  s.step = "await_service"; await saveSession(s);
  await logEvent(from, "flow_started", {});
  await askService(from, L);
}

async function goBack(s: Session, to: string, L: string): Promise<boolean> {
  switch (s.step) {
    case "await_day": s.step = "await_service"; await saveSession(s); await askService(to, L); return true;
    case "await_day_text": s.step = "await_day"; await saveSession(s); await askDay(to, L); return true;
    case "await_time": s.step = "await_day"; await saveSession(s); await askDay(to, L); return true;
    case "await_hour":
    case "await_time_text": s.step = "await_time"; await saveSession(s); await askTime(to, L); return true;
    case "await_sameday":
    case "await_area": s.step = "await_time"; await saveSession(s); await askTime(to, L); return true;
    case "await_studio": s.step = "await_area"; await saveSession(s); await askArea(to, L); return true;
    case "await_studio_text": { s.step = "await_studio"; await saveSession(s); const ok = await askStudio(to, L, s); if (!ok) { s.step = "await_area"; await saveSession(s); await askArea(to, L); } return true; }
    case "await_name": {
      if (Array.isArray(s.data.picks) && s.data.picks.length) { s.step = "await_studio"; await saveSession(s); const ok = await askStudio(to, L, s); if (ok) return true; }
      s.step = "await_area"; await saveSession(s); await askArea(to, L); return true;
    }
    case "await_email": s.step = "await_name"; await saveSession(s); await sendText(to, COPY[L].name); return true;
    default: return false;
  }
}

// Branded founder alert email (same palette as booking-ack).
const C = { page: "#F1EBE2", ink: "#262019", muted: "#8A7F73", clay: "#B85C38", cream: "#FAF6F0", line: "#F0E9E0", dash: "#E4D9CB" };
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function founderCard(subject: string, o: { badge: string; title: string; paras?: string[]; quote?: string; transcript?: string[]; waNum?: string; waLabel?: string; prefill?: string; to?: string[] }) {
  const paras = (o.paras || []).filter(Boolean).map((p) =>
    `<p style="margin:10px 0 0;color:${C.ink};font-size:14px;line-height:1.6;">${esc(p)}</p>`).join("");
  const quote = o.quote
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:${C.cream};border-radius:12px;"><tr><td style="padding:14px 16px;"><p style="margin:0;color:${C.ink};font-size:14.5px;line-height:1.6;font-style:italic;">"${esc(o.quote)}"</p></td></tr></table>`
    : "";
  const transcript = o.transcript && o.transcript.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:${C.cream};border-radius:12px;"><tr><td style="padding:12px 16px;">` +
      `<p style="margin:0 0 6px;color:${C.clay};font-size:10.5px;font-weight:700;letter-spacing:2px;">CONVERSATION</p>` +
      o.transcript.slice(-10).map((l) => {
        const isThem = l.startsWith("THEM:");
        const body = l.replace(/^(THEM|BOT):\s*/, "");
        return `<p style="margin:4px 0 0;font-size:12.5px;line-height:1.5;color:${isThem ? C.ink : C.muted};"><b style="color:${isThem ? C.clay : "#B8AC9E"};">${isThem ? "Them" : "Bot"}</b> · ${esc(body).slice(0, 300)}</p>`;
      }).join("") + `</td></tr></table>`
    : "";
  const waHref = o.waNum ? `https://wa.me/${digitsOf(o.waNum)}${o.prefill ? `?text=${encodeURIComponent(o.prefill)}` : ""}` : "";
  const waBtn = o.waNum
    ? `<tr><td style="padding:20px 34px 0;text-align:center;"><a href="${waHref}" style="display:inline-block;background:#1FA855;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;">${esc(o.waLabel || "Reply on WhatsApp")}</a>${o.prefill ? `<p style="margin:8px 0 0;color:${C.muted};font-size:11.5px;">Opens with a ready-made draft you can edit before sending.</p>` : ""}</td></tr>`
    : "";
  const chatLink = o.waNum
    ? `<tr><td style="padding:12px 34px 0;text-align:center;"><a href="${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&phone=${digitsOf(o.waNum)}" style="color:${C.clay};font-size:13px;font-weight:700;text-decoration:none;">View full conversation</a></td></tr>`
    : "";
  const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center">\n  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;">\n    <tr><td style="padding:26px 34px 0;text-align:center;">\n      <img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;">\n      <p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p>\n    </td></tr>\n    <tr><td style="padding:22px 34px 0;text-align:center;">\n      <span style="display:inline-block;background:${C.cream};color:${C.clay};font-size:11px;font-weight:700;letter-spacing:2.5px;padding:7px 16px;border-radius:999px;">${esc(o.badge)}</span>\n      <h1 style="margin:14px 0 0;color:${C.ink};font-size:23px;line-height:1.3;font-family:${SERIF};font-weight:700;">${esc(o.title)}</h1>\n    </td></tr>\n    <tr><td style="padding:4px 34px 0;">${paras}${quote}${transcript}</td></tr>\n    ${waBtn}\n    ${chatLink}\n    <tr><td style="padding:22px 34px 26px;">\n      <div style="border-top:2px dashed ${C.dash};margin-bottom:12px;"></div>\n      <p style="margin:0;color:#B8AC9E;font-size:11.5px;text-align:center;">Founder alert · WhatsApp bot · +34 613 97 79 00</p>\n    </td></tr>\n  </table>\n</td></tr></table>`;
  const plain = [o.title, ...(o.paras || []), o.quote ? `"${o.quote}"` : "", ...(o.transcript || []), waHref ? `WhatsApp: ${waHref}` : "", o.waNum ? `Full conversation: ${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&phone=${digitsOf(o.waNum)}` : ""].filter(Boolean).join("\n");
  await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: o.to || SUPPORT, subject, html, text: plain }),
  });
}

// v37: urgent things reach Jordan on WhatsApp. Email is where this morning's
// offers went to die. Short, with a link to the chat.
async function notifyJordanWa(text: string, aboutPhone?: string) {
  try {
    const link = aboutPhone ? `\n${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&phone=${digitsOf(aboutPhone)}` : "";
    // v45: free text to Jordan failed on 5 Sept (131047) because test messages
    // from his own number make canFreeform() true while Meta's window is closed.
    // The approved template always delivers, so use it every time.
    await sendTemplate(digitsOf(JORDAN_MAIN_NUMBER), "founder_alert_v1", "en", [text.slice(0, 500)], [], text);
  } catch (e) { console.log("[wa] jordan wa failed", String(e)); }
}

async function notifyHuman(s: Session, lastText: string) {
  const num = s.phone.replace(/[^0-9]/g, "");
  await notifyJordanWa(`${s.wa_name || "+" + num} wants a person${lastText ? ": " + lastText.slice(0, 120) : ""}`, s.phone);
  const hist = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${encodeURIComponent(s.phone)}&order=created_at.desc&limit=12&select=direction,body`, { headers: H() }).then((r) => r.json()).catch(() => []);
  const lines = (Array.isArray(hist) ? hist : []).reverse().map((m: any) => `${m.direction === "in" ? "THEM" : "BOT"}: ${m.body}`);
  const prefill = await customerPrefill(s.phone);
  await founderCard(`🙋 ${s.wa_name || "+" + num} wants a person`, {
    badge: "WANTS A PERSON",
    title: `${s.wa_name || "A customer"} asked for a person`,
    paras: [`+${num} asked to talk to a human on the WhatsApp bot. They were told a Massage Club representative will reply from ${JORDAN_MAIN_NUMBER}.`],
    quote: lastText || "",
    transcript: lines,
    waNum: num,
    prefill,
    to: JORDAN,
  });
}
const wantsHuman = (t: string) => /\b(human|person|agent|jordan|persona|humano|agente|hablar con alguien|real person)\b/i.test(t);
// v39: the customer is never parked on "a representative will write". We answer,
// keep them in the flow, and tell Jordan so he can jump in from his number.
// v53: ask the current step's question again, after answering something else.
async function reAsk(s: Session, from: string, L: string) {
  switch (s.step) {
    case "await_service": await askService(from, L); break;
    case "await_day": if (s.data.service === "svc_unsure") await askDayUnsure(from, L); else await askDay(from, L); break;
    case "await_time": await askTime(from, L); break;
    case "await_hour": await askHour(from, L, s.data.timeBandId || "time_afternoon"); break;
    case "await_area": await askArea(from, L); break;
    case "await_sameday": await sendButtons(from, COPY[L].sameDay, COPY[L].sameDayBtns(String(s.data.time || ""))); break;
    case "await_day_text": await sendText(from, COPY[L].dayAsk); break;
    case "await_time_text": await sendText(from, COPY[L].timeAsk); break;
    case "await_name": await sendText(from, COPY[L].name); break;
    case "await_email": await sendText(from, COPY[L].email); break;
    case "await_email_post": await sendText(from, COPY[L].emailAskPost); break;
  }
}

async function helpInstead(s: Session, from: string, L: string, text: string) {
  await sendText(from, COPY[L].noHuman);
  await notifyJordanWa(`${s.wa_name || "+" + digitsOf(from)} needed help (${s.step}): ${String(text || "").slice(0, 120)}. Bot kept them in the flow; jump in if you want.`, from);
  await founderCard(`💬 ${s.wa_name || "+" + digitsOf(from)} needed help`, {
    badge: "NEEDS ATTENTION", title: `${s.wa_name || "A customer"} wrote something the bot could not place`,
    paras: [`At step ${s.step}. The bot answered with prices and the next question; nothing is waiting on you unless you want to write personally.`],
    quote: text || "", waNum: digitsOf(from), prefill: await customerPrefill(s.phone), to: JORDAN,
  });
  await continueFromKnown(s, from, L);
}

// A studio replied (template button or free text). Never enters the customer flow.
async function handleStudioReply(from: string, payloadId: string, btnText: string, freeText: string, partner: { id: string; business_name: string } | null) {
  const m = payloadId.match(/^studio_(confirm|other|no)_(\d+)$/);
  if (m) {
    const requestId = Number(m[2]);
    const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&select=id,first_name,service_name,studio_name,partner_id,day1,time1,languages,client_phone,stage,contact_email,settle_after`, { headers: H() });
    const rows = await rr.json().catch(() => []);
    const req = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!req) { console.log("[studio] request not found", requestId); return; }
    const L = req.languages === "es" ? "es" : "en";
    const when = [req.day1, req.time1].filter(Boolean).join(" ");
    const studioPrefill = `Hola, soy Jordan de Massage Club, sobre la reserva de ${req.first_name || "nuestro cliente"}${when ? " (" + when + ")" : ""}: `;
    // v49: the "No podemos" button on solicitud_reserva_v2. A clean no beats
    // silence: the row is closed, the studio is thanked, nothing else happens.
    if (m[1] === "no") {
      if (partner) {
        const drow = await dispatchRowFor(requestId, partner.id);
        if (drow && drow.outcome !== "won") await patchDispatch(drow.id, { outcome: "declined", replied_at: new Date().toISOString(), reply_text: "No podemos (botón)" });
      }
      await sendText(from, "Entendido, gracias por avisar tan rápido. Os escribo con la siguiente. Jordan, Massage Club");
      await logEvent(req.client_phone || from, "studio_declined", { id: requestId, studio: partner ? partner.business_name : from });
      return;
    }
    if (m[1] === "confirm") {
      // v41: a second tap from the winning studio is not a new studio.
      if (req.stage === "confirmed") {
        if (partner && String(req.partner_id || "") === String(partner.id)) await sendText(from, "Ya lo tenemos apuntado, gracias. Cualquier cambio, escribidnos aquí. Massage Club");
        else await sendText(from, "Gracias, pero esta reserva ya la ha cogido otro centro hace un momento. No hace falta que hagáis nada. Os avisaremos con la siguiente. Massage Club");
        return;
      }
      // v43: a Confirmado on a request with no exact time is an offer of
      // availability, not a booking. On 5 Sept KamAI tapped Confirmado on Viko's
      // "flexible evening" request and the bot announced a booking with no time.
      if (!req.time1 || !/\d/.test(String(req.time1))) {
        await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&stage=neq.confirmed`, {
          method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
          body: JSON.stringify({ stage: "studio_replied", partner_id: partner ? partner.id : req.partner_id || null, studio_name: partner ? partner.business_name : req.studio_name, studio_reply: `Disponible (Confirmado sin hora fija, ${partner ? partner.business_name : from})`, stage_updated_at: new Date().toISOString() }),
        });
        await sendText(from, `Gracias. ${req.first_name || "El cliente"} todavía no ha fijado la hora exacta${req.day1 ? " (" + req.day1 + ")" : ""}. ¿Qué horas tenéis libres? Responded aquí con una o dos y se las proponemos ahora mismo. Massage Club`);
        const cnum = digitsOf(req.client_phone || "");
        if (cnum && await canFreeform(cnum)) await sendText(cnum, L === "es" ? `¡Buenas noticias! ${partner ? partner.business_name : "Un centro"} puede atenderte${req.day1 ? " (" + req.day1 + ")" : ""}. Dime la hora exacta que prefieres y lo cerramos.` : `Good news! ${partner ? partner.business_name : "A studio"} can take you${req.day1 ? " (" + req.day1 + ")" : ""}. Tell me the exact time you prefer and we lock it in.`);
        await notifyJordanWa(`${partner ? partner.business_name : from} is available for ${req.first_name || "the customer"}'s request #${requestId} (${req.day1 || "no day"}, no exact time). Studio asked for its free hours; customer asked for a time. Not confirmed yet.`, cnum || from);
        await founderCard(`\u23f3 ${partner ? partner.business_name : "Studio"} available for #${requestId}, time still open`, {
          badge: "AVAILABLE, NOT BOOKED", title: `${partner ? partner.business_name : "The studio"} can take ${req.first_name || "the customer"}`,
          paras: [`The request has no exact time (${req.day1 || "no day"}). The studio was asked for its free hours and the customer for a preferred time. The booking confirms when the two meet.`],
          waNum: from, waLabel: "Chat with the studio", prefill: studioPrefill,
        });
        return;
      }
      // v46: not for today and no partner assigned yet: open the bidding window
      // instead of handing the booking to the fastest tap.
      if (partner && !isSameDayReq(req) && !req.partner_id) {
        const drow = await dispatchRowFor(requestId, partner.id);
        if (drow && drow.outcome !== "won") {
          if (drow.outcome !== "accepted") await patchDispatch(drow.id, { outcome: "accepted", accepted_at: new Date().toISOString(), replied_at: new Date().toISOString() });
          const settleAfter = req.settle_after || new Date(Date.now() + BID_WINDOW_MS).toISOString();
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&stage=in.(new,studio_asked,studio_replied,offered,bidding)`, {
            method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
            body: JSON.stringify({ stage: "bidding", settle_after: settleAfter, studio_reply: `Disponible (${partner.business_name})`, stage_updated_at: new Date().toISOString() }),
          });
          await sendText(from, drow.discount_pct ? `Gracias, lo tenemos: ${drow.discount_pct}% de descuento. Os confirmamos en unos minutos. Massage Club` : BID_ASK);
          await logEvent(req.client_phone || from, "studio_accepted", { id: requestId, studio: partner.business_name });
          return;
        }
      }
      await awardWinner(req, partner, from, null);
    } else {
      // v45: on 5 Sept Masajes Camino tapped "Otra hora" 18 minutes after KamAI
      // had won the request (their stand-down was undeliverable). The bot asked
      // them for hours on a booking that no longer existed. A tap on a covered
      // request gets the covered answer and nothing else.
      if (req.stage === "confirmed" || req.stage === "cancelled" || req.stage === "dismissed" || req.stage === "no_show") {
        if (partner && String(req.partner_id || "") === String(partner.id)) await sendText(from, "Ya lo tenemos apuntado, gracias. Si necesitáis cambiar la hora, decidnos cuál os encaja y se lo pasamos al cliente. Massage Club");
        else await sendText(from, "Gracias por responder. Esta reserva ya está cubierta por otro centro, así que no hace falta que hagáis nada. Os avisaremos con la siguiente. Massage Club");
        return;
      }
      // v36: if this studio already wrote a time, the tap is just them being
      // thorough. Do not ask again for what they told us.
      if (partner) {
        const dq = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${requestId}&partner_id=eq.${encodeURIComponent(partner.id)}&select=offered_time&limit=1`, { headers: H() });
        const dqr = await dq.json().catch(() => []);
        if (Array.isArray(dqr) && dqr[0]?.offered_time) {
          await sendText(from, `Gracias, ya le hemos pasado al cliente vuestra hora (${dqr[0].offered_time}). Os confirmamos en cuanto responda.`);
          return;
        }
      }
      await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&stage=neq.confirmed`, {
        method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify({ stage: "studio_replied", studio_reply: `Otra hora (WhatsApp, ${partner ? partner.business_name : from})`, stage_updated_at: new Date().toISOString() }),
      });
      await sendText(from, "Entendido. ¿Qué horas os encajarían ese día o cercanas? Responded aquí y se lo pasamos al cliente.");
      await founderCard(`⚠️ ${req.studio_name || "Studio"} wants another time · #${requestId}`, {
        badge: "OTHER TIME",
        title: `${req.studio_name || "The studio"} cannot do ${when || "that time"}`,
        paras: [`They tapped "Otra hora" for ${req.first_name || "the customer"}'s ${req.service_name || "massage"}.`, `They were asked which times work; their answer will land here. You may need to close the loop with the customer.`],
        waNum: from, waLabel: "Chat with the studio", prefill: studioPrefill,
      });
    }
    return;
  }
  // Free text from a known partner number: attach to their latest open request.
  if (partner && freeText) {
    // v46: a written discount is an offer on the open request. 10% or more wins
    // the booking at once; less waits for the window to close.
    const pct = parseDiscount(freeText);
    if (pct !== null) {
      const since48 = new Date(Date.now() - 48 * 3600e3).toISOString();
      const od = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=eq.${encodeURIComponent(partner.id)}&outcome=in.(pending,accepted)&created_at=gte.${since48}&order=created_at.desc&limit=1&select=id,request_id,outcome,accepted_at`, { headers: H() });
      const odr = (await od.json().catch(() => []))[0] || null;
      if (odr) {
        await patchDispatch(odr.id, { discount_pct: pct, outcome: "accepted", accepted_at: odr.accepted_at || new Date().toISOString(), replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500), offer_note: freeText.slice(0, 200) });
        await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(partner.id)}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ mc_discount_pct: pct, mc_discount_confirmed_at: new Date().toISOString(), mc_discount_note: `WhatsApp: ${freeText.slice(0, 200)}` }) }).catch(() => {});
        const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${odr.request_id}&stage=in.(new,studio_asked,studio_replied,offered,bidding)&limit=1&select=id,first_name,service_name,studio_name,partner_id,day1,time1,languages,client_phone,stage,contact_email,settle_after`, { headers: H() });
        const rqrow = (await rq.json().catch(() => []))[0] || null;
        if (rqrow && pct >= 10) { await awardWinner(rqrow, partner, from, pct); return; }
        if (rqrow) {
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${rqrow.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "bidding", settle_after: rqrow.settle_after || new Date(Date.now() + BID_WINDOW_MS).toISOString(), studio_reply: `${partner.business_name}: ${pct}% dto`, stage_updated_at: new Date().toISOString() }) });
          await sendText(from, `Gracias, anotado: ${pct}% de descuento. Os confirmamos en unos minutos. Massage Club`);
          return;
        }
      }
    }
    // v35: a fanned-out request has no partner assigned until someone accepts,
    // so look the studio up through what we asked them before falling back to
    // an already assigned booking.
    let req: any = null;
    const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=eq.${encodeURIComponent(partner.id)}&outcome=in.(pending,won)&order=created_at.desc&limit=1&select=id,request_id`, { headers: H() });
    const drows = await dr.json().catch(() => []);
    const drow = Array.isArray(drows) && drows[0] ? drows[0] : null;
    if (drow) {
      await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${drow.id}`, {
        method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify({ replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500) }),
      });
      const r1 = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${drow.request_id}&stage=in.(new,studio_asked,studio_replied,offered,bidding)&limit=1&select=id,first_name,service_name,studio_name,day1,time1,client_phone,languages,contact_email,area`, { headers: H() });
      const rows1 = await r1.json().catch(() => []);
      if (Array.isArray(rows1) && rows1[0]) req = rows1[0];
    }
    // v37: a studio changing the time on a booking it already won. Baan Bua
    // did exactly this (12:15 became 12:45) and it landed as a plain note.
    if (!req && drow) {
      const rc = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${drow.request_id}&stage=eq.confirmed&partner_id=eq.${encodeURIComponent(partner.id)}&limit=1&select=id,first_name,service_name,studio_name,day1,time1,confirmed_day,confirmed_time,client_phone,languages,contact_email,area`, { headers: H() });
      const rcs = await rc.json().catch(() => []);
      const creq = Array.isArray(rcs) && rcs[0] ? rcs[0] : null;
      const newTime = creq ? parseOfferedTime(freeText) : "";
      if (creq && newTime && creq.client_phone && newTime !== String(creq.confirmed_time || "")) {
        await forwardTimeChange(creq, partner, String(drow.id), newTime, freeText, from);
        return;
      }
    }
    // v39: a studio writing around a booking it won is about THAT booking:
    // "no ha llegado", "¿podéis contactar?", "ya está aquí". The customer is
    // pinged at once and the studio gets an answer, no human in the loop.
    if (!req) {
      const nowMs = Date.now();
      const lv = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?partner_id=eq.${encodeURIComponent(partner.id)}&stage=eq.confirmed&confirmed_start=gte.${new Date(nowMs - 3 * 3600e3).toISOString()}&confirmed_start=lte.${new Date(nowMs + 6 * 3600e3).toISOString()}&order=confirmed_start.asc&limit=1&select=id,first_name,service_name,studio_name,client_phone,languages,contact_email,confirmed_day,confirmed_time,confirmed_start,customer_flag,customer_pinged_at,arrival_status`, { headers: H() });
      const lrows = await lv.json().catch(() => []);
      const live = Array.isArray(lrows) && lrows[0] ? lrows[0] : null;
      if (live && live.client_phone) { await handleLiveStudioMessage(live, partner, freeText, from); return; }
    }
    if (!req) {
      const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?partner_id=eq.${encodeURIComponent(partner.id)}&stage=in.(studio_asked,studio_replied,bidding)&order=created_at.desc&limit=1&select=id,first_name,service_name,studio_name,day1,time1`, { headers: H() });
      const rows = await rr.json().catch(() => []);
      req = Array.isArray(rows) && rows[0] ? rows[0] : null;
    }
    // v45: a studio answering a request that was already covered ("mañana ya
    // está lleno", "no podemos") within two days of being asked. They never got
    // the stand-down if they had not written before, so this is the first time
    // the bot can actually tell them. Log the answer, thank them, close.
    if (!req) {
      const since = new Date(Date.now() - 48 * 3600e3).toISOString();
      const sd = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=eq.${encodeURIComponent(partner.id)}&outcome=in.(stood_down,lost,declined,expired)&created_at=gte.${since}&order=created_at.desc&limit=1&select=id,request_id,outcome`, { headers: H() });
      const sdr = await sd.json().catch(() => []);
      const sdrow = Array.isArray(sdr) && sdr[0] ? sdr[0] : null;
      if (sdrow && !AUTOREPLY_RE.test(freeText)) {
        await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${sdrow.id}`, {
          method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
          body: JSON.stringify({ replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500) }),
        });
        await sendText(from, "Gracias por responder. Esa reserva ya quedó cubierta por otro centro, así que no hace falta que hagáis nada. Os avisaremos con la siguiente. Massage Club");
        await founderCard(`💬 ${partner.business_name} answered a covered request · #${sdrow.request_id}`, {
          badge: "LATE REPLY", title: `${partner.business_name} wrote back after the request was covered`,
          paras: [`The bot thanked them and said the booking is covered. Nothing to do.`],
          quote: freeText, waNum: from, waLabel: "Reply to the studio", prefill: `Hola, soy Jordan de Massage Club: `,
        });
        return;
      }
    }
    const studioPrefill = `Hola, soy Jordan de Massage Club${req ? `, sobre la reserva de ${req.first_name || "nuestro cliente"}` : ""}: `;
    if (req) {
      // v36: a time in the studio's answer is an offer. Forward it to the
      // customer with buttons instead of parking it in Jordan's inbox.
      const offered = drow && req.client_phone ? parseOfferedTime(freeText) : "";
      if (offered && drow) {
        await forwardOffer(req, partner, String(drow.id), offered, freeText, from);
        return;
      }
      await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&stage=neq.confirmed`, {
        method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify({ stage: "studio_replied", studio_reply: freeText.slice(0, 500), stage_updated_at: new Date().toISOString() }),
      });
      await founderCard(`💬 ${partner.business_name} replied · #${req.id}`, {
        badge: "STUDIO REPLY",
        title: `${partner.business_name} wrote back`,
        paras: [`About ${req.first_name || "the customer"}'s ${req.service_name || "massage"} (${[req.day1, req.time1].filter(Boolean).join(" ")}):`],
        quote: freeText,
        waNum: from, waLabel: "Reply to the studio", prefill: studioPrefill,
      });
    } else {
      await notifyJordanWa(`${partner.business_name} wrote and no open request matched: ${freeText.slice(0, 160)}`, from);
      await founderCard(`💬 ${partner.business_name} messaged the bot number`, {
        badge: "STUDIO MESSAGE",
        title: `${partner.business_name} wrote in`,
        paras: [`No open request found for them, so this may be something else:`],
        quote: freeText,
        waNum: from, waLabel: "Reply to the studio", prefill: studioPrefill,
      });
    }
  }
}

// ---- v39: the live booking window ----
const reqTime = (r: any): string => {
  if (/^\d{1,2}:\d{2}$/.test(String(r.confirmed_time || ""))) return String(r.confirmed_time);
  if (r.confirmed_start) return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(r.confirmed_start));
  return String(r.confirmed_time || r.time1 || "");
};
async function tellStudio(studioNum: string, name: string, time: string, freeText: string, shortEs: string) {
  if (!studioNum) return false;
  if (await canFreeform(studioNum)) return sendText(studioNum, freeText);
  return sendTemplate(studioNum, "aviso_centro_v1", "es", [name || "el cliente", time || "-", shortEs], [], `aviso: ${shortEs}`);
}
async function studioNumberFor(req: any): Promise<string> {
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${req.id}&partner_id=eq.${encodeURIComponent(req.partner_id || "")}&order=created_at.desc&limit=1&select=phone`, { headers: H() });
  const drow = (await dr.json().catch(() => []))[0] || {};
  if (drow.phone) return digitsOf(drow.phone);
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(req.partner_id || "")}&select=whatsapp,phone`, { headers: H() });
  const p = (await pr.json().catch(() => []))[0] || {};
  return digitsOf(p.whatsapp || p.phone || "");
}
async function markNoShow(req: any, studio: string, studioNum: string, reason: string) {
  const cust = digitsOf(req.client_phone || "");
  const L = req.languages === "es" ? "es" : "en";
  const name = req.first_name || (L === "es" ? "el cliente" : "the customer");
  await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "no_show", arrival_status: "no_show", no_show_at: new Date().toISOString(), stage_note: `No-show: ${reason}`.slice(0, 300), stage_updated_at: new Date().toISOString() }) });
  if (studioNum) await sendText(studioNum, `Lo sentimos mucho. Tomamos nota y a partir de ahora solo os enviaremos clientes que nos hayan confirmado el mismo día. Gracias por avisar. Massage Club`).catch(() => {});
  if (cust) {
    if (await canFreeform(cust)) await sendText(cust, COPY[L].missedYou(studio));
    else await sendTemplate(cust, "missed_you_v1", L, [req.first_name || (L === "es" ? "hola" : "there"), studio], [], `missed you at ${studio}`);
  }
  await logEvent(cust || studioNum, "no_show", { id: req.id, studio });
  await notifyJordanWa(`NO-SHOW: ${name} did not arrive at ${studio} (${reqTime(req)}). Studio thanked, customer got a soft "we missed you". Request #${req.id} marked no_show.`, cust);
  await founderCard(`❌ No-show: ${name} at ${studio} · #${req.id}`, {
    badge: "NO-SHOW", title: `${name} did not arrive at ${studio}`,
    paras: [`Marked no_show. The studio was thanked and told we will only send same-day-confirmed customers from now on. The customer got a soft message with an open door to rebook.`, `A personal note to the studio from you is still worth it.`],
    quote: reason, waNum: studioNum, waLabel: "Chat with the studio",
  });
}
async function handleLiveStudioMessage(live: any, partner: { id: string; business_name: string }, text: string, from: string) {
  const cust = digitsOf(live.client_phone || "");
  const L = live.languages === "es" ? "es" : "en";
  const name = live.first_name || "";
  const time = reqTime(live);
  const studio = partner.business_name || live.studio_name || "";
  const minsTo = live.confirmed_start ? Math.round((Date.parse(live.confirmed_start) - Date.now()) / 60000) : 0;
  if (ARRIVED_RE.test(text) && !NOSHOW_RE.test(text)) {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${live.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ arrival_status: "arrived", customer_flag: null }) });
    await sendText(from, "¡Gracias por avisar! Que vaya bien. Massage Club");
    await notifyJordanWa(`${name || "The customer"} arrived at ${studio} (${time}).`, cust);
    return;
  }
  if (NOSHOW_RE.test(text) && minsTo <= -15) { await markNoShow({ ...live, partner_id: partner.id }, studio, from, text); return; }
  // Anything else during the window: reach the customer now, answer the
  // studio, tell Jordan. One ping per 30 minutes so a chatty studio does not
  // turn into spam for the customer.
  const pingedRecently = live.customer_pinged_at && Date.now() - Date.parse(live.customer_pinged_at) < 30 * 60000;
  let pinged = false;
  if (cust && !pingedRecently) {
    pinged = (await canFreeform(cust))
      ? await sendText(cust, COPY[L].studioReaching(studio, time, text))
      : await sendTemplate(cust, "studio_reaching_v1", L, [name || (L === "es" ? "hola" : "there"), studio, time], [], `${studio} is trying to reach you (${time})`);
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${live.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ customer_pinged_at: new Date().toISOString(), ...(NOSHOW_RE.test(text) ? { customer_flag: "at_risk" } : {}) }) });
  }
  await sendText(from, pinged || pingedRecently
    ? "Recibido. Estamos contactando con el cliente ahora mismo y os decimos algo en cuanto responda. Massage Club"
    : "Recibido, gracias. Lo miramos ahora mismo. Massage Club");
  await notifyJordanWa(`${studio} about ${name || "the customer"}'s ${time}: "${text.slice(0, 140)}". ${pinged ? "Customer pinged automatically." : pingedRecently ? "Customer already pinged in the last 30 min." : "Could not ping the customer."}`, cust || from);
}
async function handleArrival(from: string, replyId: string, partner: { id: string; business_name: string } | null) {
  const m = replyId.match(/^arr_(yes|no)_(\d+)$/);
  if (!m) return;
  const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${m[2]}&select=id,first_name,service_name,studio_name,partner_id,client_phone,languages,contact_email,confirmed_time,confirmed_start,arrival_status,stage`, { headers: H() });
  const req = (await rr.json().catch(() => []))[0] || null;
  if (!req) return;
  const studio = partner?.business_name || req.studio_name || "";
  if (m[1] === "yes") {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ arrival_status: "arrived", customer_flag: null }) });
    await sendText(from, "¡Gracias! Que vaya bien. Massage Club");
    await logEvent(digitsOf(req.client_phone || from), "arrived", { id: req.id, studio });
    return;
  }
  if (req.arrival_status === "no_show" || req.stage === "no_show") { await sendText(from, "Gracias, ya lo teníamos apuntado. Massage Club"); return; }
  await markNoShow(req, studio, from, "studio tapped No ha venido");
}
// Customer answers to the T-3h check (template buttons or typed words).
async function handleCustomerReconfirm(kind: "yes" | "change" | "cancel", reqId: string, from: string, L: string, s: Session) {
  const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${reqId}&select=id,first_name,service_name,studio_name,partner_id,client_phone,languages,confirmed_day,confirmed_time,confirmed_start,customer_flag,reconfirmed_at,studio_warned_at,stage`, { headers: H() });
  const req = (await rr.json().catch(() => []))[0] || null;
  if (!req || digitsOf(req.client_phone) !== digitsOf(from)) { await sendMenu(from, L); return; }
  const pc = req.partner_id ? await partnerCard(req.partner_id) : { business_name: "", address: "", phone: "", neighbourhood: "" };
  const studio = pc.business_name || req.studio_name || "";
  const time = reqTime(req);
  const name = req.first_name || "";
  const studioNum = await studioNumberFor(req);
  const minsTo = req.confirmed_start ? Math.round((Date.parse(req.confirmed_start) - Date.now()) / 60000) : 9999;
  if (req.stage !== "confirmed") { await sendStatus(from, L, from); return; }
  if (kind === "yes") {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ reconfirmed_at: new Date().toISOString(), customer_flag: null }) });
    await sendText(from, COPY[L].reconfirmYes(studio, time, pc.address));
    await tellStudio(studioNum, name, time, `${name || "El cliente"} nos confirma que viene a las ${time}. Gracias, Massage Club`, "nos confirma que viene");
    if (req.studio_warned_at) await notifyJordanWa(`${name || "Customer"} confirmed after all for ${studio} ${time}. Studio told.`, from);
    s.step = "done"; s.data.reconfirm = null; await saveSession(s);
    await logEvent(from, "reconfirmed", { id: req.id });
    return;
  }
  if (kind === "cancel") {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "cancelled", customer_flag: "cancelled", stage_note: "Cancelled by the customer on WhatsApp", stage_updated_at: new Date().toISOString() }) });
    await sendText(from, COPY[L].cancelled(studio));
    await tellStudio(studioNum, name, time, `${name || "El cliente"} ha cancelado su cita de las ${time}. Sentimos las molestias y gracias por vuestra paciencia. Massage Club`, "el cliente ha cancelado, sentimos las molestias");
    await notifyJordanWa(`${name || "Customer"} CANCELLED ${studio} ${time} (${minsTo > 0 ? minsTo + " min before" : "after the time"}). Studio told. Request #${req.id}.`, from);
    s.step = "done"; s.data.reconfirm = null; await saveSession(s);
    await logEvent(from, "cancelled", { id: req.id, minsTo });
    return;
  }
  // change: nothing is promised to anyone until the customer names a time.
  await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ customer_flag: "change_requested" }) });
  await sendText(from, COPY[L].changeAsk(studio, time));
  if (minsTo <= 240) await tellStudio(studioNum, name, time, `${name || "El cliente"} nos pide cambiar la hora de las ${time}. Podéis dar esa hora por libre; os confirmamos la nueva en cuanto la tengamos. Gracias, Massage Club`, "nos pide cambiar la hora, podéis dar esa hora por libre");
  s.data.prevStep = s.step; s.step = "await_change"; s.data.change = { request: req.id, studio, time, studioNum }; s.data.reconfirm = null; await saveSession(s);
  await notifyJordanWa(`${name || "Customer"} wants to CHANGE ${studio} ${time}. Bot asked what works${minsTo <= 240 ? " and told the studio to free the slot" : ""}. Request #${req.id}.`, from);
  await logEvent(from, "change_requested", { id: req.id, minsTo });
}

// v47: a customer saying no in a sentence, not with the word "cancel". On 5 Sept
// Mateo wrote "I'm not going to be having any massage" and "I'm leaving Madrid
// early" at the email question and was told twice it did not look like an email.
const DECLINE_RE = /\b(not going to|won'?t be|no longer|not any ?more|leaving madrid|leaving (the )?city|no voy a|ya no (voy|quiero|puedo)|no podr[eé]|me voy de madrid|no me interesa|no quiero|forget it|never ?mind|don'?t need|no (lo )?necesito|not (be )?(having|coming|going))\b/i;

// ---- v46: best offer wins ----
const BID_WINDOW_MS = 10 * 60 * 1000;
const BID_ASK = "Gracias. Estamos consultando a varios centros de la zona y el cliente irá con la mejor oferta. Si podéis hacerle un 10% de descuento, escribid 10% ahora y le confirmamos con vosotros. Si no, os decimos algo en unos minutos. Massage Club";
const isSameDayReq = (req: any) => /^(today|hoy)$/i.test(String(req?.day1 || "").trim());

// v48: "hora y media" is a 90 minute request, not a 60 minute one (6 Sept, 02:54).
// The duration rides in message_text ("Duración: 90 min") so the studio ask and
// the confirmation card say it too. 60 stays implicit.
function detectDuration(text: string): number | null {
  const t = String(text || "").toLowerCase();
  if (/hora y media|hour and a half|90 ?min|noventa min|ninety min|1[.,]5 ?h(ours?)?\b/.test(t)) return 90;
  if (/dos horas|two hours|120 ?min|\b2 ?h(oras|ours)?\b/.test(t)) return 120;
  if (/una hora\b|one hour|60 ?min|sesenta min|sixty min|\b1 ?h(ora|our)?\b/.test(t)) return 60;
  return null;
}
const reqDuration = (req: any): number => {
  const m = String(req?.message_text || "").match(/Duraci[oó]n: (\d{2,3}) min/);
  return m ? parseInt(m[1], 10) : 60;
};
async function dispatchRowFor(requestId: number, partnerId: string): Promise<any | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${requestId}&partner_id=eq.${encodeURIComponent(partnerId)}&order=created_at.desc&limit=1&select=id,outcome,phone,discount_pct,accepted_at`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function patchDispatch(id: string, body: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify(body) });
}
// "10%", "un 10 %", "10 por ciento", "diez por ciento de descuento".
function parseDiscount(text: string): number | null {
  const t = String(text || "").toLowerCase();
  const m = t.match(/(\d{1,2})\s*(%|por\s*ciento|porciento)/);
  let n: number | null = m ? parseInt(m[1], 10) : null;
  if (n === null && /descuento|dto|por\s*ciento/.test(t)) {
    const words: Record<string, number> = { cinco: 5, diez: 10, quince: 15, veinte: 20, veinticinco: 25, treinta: 30 };
    for (const [w, v] of Object.entries(words)) if (new RegExp(`\\b${w}\\b`).test(t)) { n = v; break; }
  }
  if (n === null || n < 5 || n > 50) return null;
  return n;
}
// One studio takes the booking: the request is claimed, the others stood down,
// the studio gets the card, the customer the address (and the discount, if any).
async function awardWinner(req: any, partner: { id: string; business_name: string } | null, from: string, discountPct: number | null): Promise<boolean> {
  const requestId = Number(req.id);
  const L = req.languages === "es" ? "es" : "en";
  const when = [req.day1, req.time1].filter(Boolean).join(" ");
  const studioPrefill = `Hola, soy Jordan de Massage Club, sobre la reserva de ${req.first_name || "nuestro cliente"}${when ? " (" + when + ")" : ""}: `;
  // v35: the request is fanned out to several studios with nobody assigned, so
  // the claim both wins the booking and names the studio. The stage filter makes
  // that a race only one of them can win.
  const claim = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&stage=neq.confirmed`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({
      stage: "confirmed", confirmed_day: req.day1, confirmed_time: req.time1,
      partner_id: partner ? partner.id : req.partner_id || null,
      studio_name: partner ? partner.business_name : req.studio_name,
      studio_reply: `Confirmado por WhatsApp (${partner ? partner.business_name : from})${discountPct ? ", " + discountPct + "% dto" : ""}`,
      discount_pct: discountPct,
      settle_after: null,
      stage_updated_at: new Date().toISOString(),
    }),
  });
  const claimed = await claim.json().catch(() => []);
  if (!Array.isArray(claimed) || !claimed.length) {
    // Someone else got there first. Say so plainly rather than silently.
    await sendText(from, "Gracias, pero esta reserva ya la ha cogido otro centro hace un momento. No hace falta que hagáis nada. Os avisaremos con la siguiente. Massage Club");
    return false;
  }
  if (partner) {
    req.studio_name = partner.business_name;
    const drow = await dispatchRowFor(requestId, partner.id);
    if (drow) await patchDispatch(drow.id, { outcome: "won", discount_pct: discountPct ?? drow.discount_pct ?? null });
  }
  await awardRequest(requestId, partner ? partner.id : null);
  await logEvent(req.client_phone || from, "confirmed", { id: requestId, studio: req.studio_name, discount: discountPct });
  const clientNum = digitsOf(req.client_phone || "");
  const pc = partner ? await partnerCard(partner.id) : { business_name: "", address: "", phone: "", neighbourhood: "", status: "", slug: "" };
  await sendText(from, studioConfirmCard(req, clientNum, pc, discountPct));
  if (clientNum) {
    const discountLine = discountPct ? (L === "es" ? `\n💶 ${discountPct}% de descuento sobre la tarifa del centro, pagas allí.` : `\n💶 ${discountPct}% off the studio's price, you pay there.`) : "";
    await sendText(clientNum, COPY[L].studioConfirmed(req.first_name || "", req.studio_name || (L === "es" ? "el centro" : "the studio"), trSvcLow(req.service_name || "massage", L), when) + (pc.address ? `\n📍 ${pc.address}` : "") + discountLine);
    // Email-skippers get one ask at the happiest moment: booking confirmed.
    if (!req.contact_email) {
      const cs = await getSession(clientNum);
      if (cs.step !== "blocked") {
        cs.step = "await_email_post"; await saveSession(cs);
        await sendText(clientNum, COPY[L].emailAskPost);
      }
    }
  }
  await founderCard(`✅ ${req.studio_name || "Studio"} confirmed #${requestId}${discountPct ? " · " + discountPct + "% off" : ""}`, {
    badge: "CONFIRMED",
    title: `${req.studio_name || "The studio"} said yes${discountPct ? " with " + discountPct + "% off" : ""}`,
    paras: [`${req.service_name || "Massage"} for ${req.first_name || "the customer"} · ${when}${pc.address ? " · " + pc.address : ""}.`, `The studio got the full card (customer first name and language, service, time${discountPct ? ", the " + discountPct + "% they offered" : ""}, how to reach the customer through us${pc.status !== "active" ? ", and the free sign-up ask" : ""}). The customer was told on WhatsApp with the address. Nothing to do.`],
    waNum: from, waLabel: "Chat with the studio", prefill: studioPrefill,
  });
  return true;
}
// Cron calls this every 5 minutes: every bidding window that has closed goes to
// the best accepted offer (highest discount, then earliest yes).
async function settleBids(): Promise<number> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?stage=eq.bidding&settle_after=lte.${new Date().toISOString()}&order=settle_after.asc&limit=10&select=id,first_name,service_name,studio_name,partner_id,day1,time1,languages,client_phone,stage,contact_email,settle_after`, { headers: H() });
  const reqs = await r.json().catch(() => []);
  let n = 0;
  for (const req of Array.isArray(reqs) ? reqs : []) {
    const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${req.id}&outcome=eq.accepted&order=discount_pct.desc.nullslast,accepted_at.asc&limit=1&select=id,partner_id,phone,discount_pct`, { headers: H() });
    const rows = await dr.json().catch(() => []);
    const best = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!best) {
      await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&stage=eq.bidding`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "studio_asked", settle_after: null, stage_updated_at: new Date().toISOString() }) });
      continue;
    }
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(best.partner_id)}&select=id,business_name`, { headers: H() });
    const partner = (await pr.json().catch(() => []))[0] || null;
    if (!partner) continue;
    const ok = await awardWinner(req, partner, digitsOf(best.phone || ""), best.discount_pct ?? null);
    if (ok) n++;
  }
  return n;
}

// ---- v36: studio offers, forwarded and closed without a human ----
async function partnerCard(partnerId: string): Promise<{ business_name: string; address: string; phone: string; neighbourhood: string; status: string; slug: string }> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(partnerId)}&select=business_name,address,phone,whatsapp,neighbourhood,status,slug`, { headers: H() });
  const rows = await r.json().catch(() => []);
  const p = Array.isArray(rows) && rows[0] ? rows[0] : {};
  return { business_name: p.business_name || "", address: p.address || "", phone: p.phone || p.whatsapp || "", neighbourhood: p.neighbourhood || "", status: p.status || "", slug: p.slug || "" };
}

// v41: what a studio reads the moment it wins a booking. Who is coming, for
// what, when, how to reach them, what happens next, and (for studios not yet
// signed up) how to keep getting clients. Two identical "¡Gracias!" lines
// after KamAI Spa's double tap on 5 Sept were not good enough.
function studioConfirmCard(req: any, clientNum: string, pc: { status: string; slug: string }, discountPct: number | null = null): string {
  const custLang = req.languages === "es" ? "habla español" : "habla inglés";
  const svcEsName = trSvc(req.service_name || "Massage", "es");
  const when = [req.day1, req.time1].filter(Boolean).join(", ") || "por concretar";
  const lines = [
    "✅ Reserva confirmada, gracias.",
    "",
    `Cliente: ${req.first_name || "cliente"} (${custLang})`,
    `Servicio: ${svcEsName}, ${reqDuration(req)} min`,
    `Cuándo: ${when}`,
  ];
  // v42: the customer's number stays with us (Jordan, 5 Sept). A studio that
  // needs the customer writes here and the bot relays it within seconds.
  // v46: the discount the studio wrote is part of the deal, in plain words.
  if (discountPct) lines.push(`Precio: vuestra tarifa con el ${discountPct}% de descuento que habéis ofrecido. Paga en el centro.`);
  lines.push("", `El cliente paga en el centro${discountPct ? "" : " vuestra tarifa habitual"}, sin comisión. Le enviamos un recordatorio el mismo día. Si necesitáis decirle algo, si no llega o hay cualquier cambio, escribidnos aquí y se lo hacemos llegar al momento.`);
  if (pc.status !== "active" && pc.slug) {
    lines.push("", `Nos gustaría seguir enviándoos clientes. Para hacerlo bien, daos de alta gratis en ${APP}/claim/${pc.slug} e indicad vuestros horarios. Con el alta, a los clientes les resulta más fácil reservaros, y vosotros elegís: aceptar las reservas automáticamente o solo cuando queráis, como hace Calma Madrid Spa.`);
  }
  lines.push("", "Massage Club");
  return lines.join("\n");
}

async function forwardOffer(req: any, partner: { id: string; business_name: string }, rowId: string, time: string, freeText: string, studioFrom: string) {
  const clientNum = digitsOf(req.client_phone || "");
  await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
    body: JSON.stringify({ offered_time: time, offered_at: new Date().toISOString(), replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500) }),
  });
  await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&stage=neq.confirmed`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
    body: JSON.stringify({ stage: "offered", studio_reply: `${partner.business_name}: ${freeText}`.slice(0, 500), stage_updated_at: new Date().toISOString() }),
  });
  const cs = await getSession(clientNum);
  const L = cs.data.lang === "es" || req.languages === "es" ? "es" : "en";
  const pc = await partnerCard(partner.id);
  // v51: a studio's "mañana a las 10" is an offer for TOMORROW. Selvarrosa wrote
  // exactly that on 6 Sept and David was told "10:00 today" (already past).
  const offerDay = offerDayFromText(freeText, L);
  const day = offerDay || req.day1 || (L === "es" ? "ese día" : "that day");
  const asked = [req.day1, req.time1].filter(Boolean).join(" ");
  await sendButtons(clientNum,
    COPY[L].offer(req.first_name || "", partner.business_name, pc.neighbourhood, trSvcLow(req.service_name || "massage", L), time, day, asked),
    [{ id: `offer_yes_${rowId}`, title: COPY[L].offerYes(time) }, { id: `offer_no_${rowId}`, title: COPY[L].offerNo }]);
  cs.data.prevStep = cs.step;
  cs.step = "await_offer";
  cs.data.offer = { row: rowId, time, studio: partner.business_name, request: req.id, day: offerDay || null };
  await saveSession(cs);
  await sendText(studioFrom, "Gracias. Se lo proponemos ahora mismo al cliente. ¿Podéis guardar esa hora unos 15 minutos? Os confirmamos en cuanto responda.");
  await logEvent(clientNum, "offer_forwarded", { request_id: req.id, studio: partner.business_name, time });
  await founderCard(`⏰ ${partner.business_name} offers ${time} · #${req.id}`, {
    badge: "OFFER FORWARDED",
    title: `${partner.business_name} can do ${time} ${day}`,
    paras: [`Sent to ${req.first_name || "the customer"} with Yes / Another time buttons. On Yes the booking confirms itself, the studio is told, and the other studios are stood down. Nothing to do.`],
    quote: freeText, waNum: clientNum,
  });
}

async function forwardTimeChange(req: any, partner: { id: string; business_name: string }, rowId: string, time: string, freeText: string, studioFrom: string) {
  const clientNum = digitsOf(req.client_phone || "");
  await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
    body: JSON.stringify({ offered_time: time, offered_at: new Date().toISOString(), replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500) }),
  });
  const cs = await getSession(clientNum);
  const L = cs.data.lang === "es" || req.languages === "es" ? "es" : "en";
  const day = (/\bma[nñ]ana\b/i.test(freeText) ? (L === "es" ? "mañana" : "tomorrow") : "") || req.confirmed_day || req.day1 || "";
  await sendButtons(clientNum,
    COPY[L].timeChange(partner.business_name, time, day, String(req.confirmed_time || "")),
    [{ id: `offer_yes_${rowId}`, title: COPY[L].offerYes(time) }, { id: `offer_no_${rowId}`, title: COPY[L].offerNo }]);
  cs.data.prevStep = cs.step;
  cs.step = "await_offer";
  const dayWord = /\bma[nñ]ana\b/i.test(freeText) ? (L === "es" ? "Mañana" : "Tomorrow") : (/\bhoy\b/i.test(freeText) ? (L === "es" ? "Hoy" : "Today") : "");
  cs.data.offer = { row: rowId, time, studio: partner.business_name, request: req.id, change: true, old: req.confirmed_time || "", day: dayWord };
  await saveSession(cs);
  await sendText(studioFrom, "Gracias. Se lo consultamos al cliente ahora mismo y os confirmamos en cuanto responda.");
  await logEvent(clientNum, "time_change_forwarded", { request_id: req.id, studio: partner.business_name, time });
  await notifyJordanWa(`${partner.business_name} moved ${req.first_name || "the customer"}'s confirmed ${req.confirmed_time || "time"} to ${time}. Customer asked with Yes / Another time. Bot handles the answer.`, clientNum);
  await founderCard(`⏰ ${partner.business_name} moved a confirmed time to ${time} · #${req.id}`, {
    badge: "TIME CHANGE",
    title: `${partner.business_name}: ${req.confirmed_time || "?"} became ${time}`,
    paras: [`${req.first_name || "The customer"} was asked with Yes / Another time buttons. On Yes the booking updates itself and the studio is told. Nothing to do.`],
    quote: freeText, waNum: clientNum,
  });
}

async function customerConfirmEmail(req: any, studio: string, when: string, addr: string, phone: string) {
  if (!req.contact_email) return;
  const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;"><tr><td style="padding:26px 34px 0;text-align:center;"><img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;"><p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p></td></tr><tr><td style="padding:26px 34px 0;text-align:center;"><span style="display:inline-block;background:#E6F4EA;color:#1A7F42;font-size:11px;font-weight:700;letter-spacing:2.5px;padding:7px 16px;border-radius:999px;">CONFIRMED</span><h1 style="margin:16px 0 0;color:${C.ink};font-size:27px;line-height:1.2;font-family:${SERIF};font-weight:700;">${esc(studio)}</h1></td></tr><tr><td style="padding:24px 34px 0;text-align:center;"><table width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};border-radius:16px;"><tr><td style="padding:22px 20px;text-align:center;"><p style="margin:0;color:${C.clay};font-size:34px;line-height:1.1;font-family:${SERIF};font-weight:700;">${esc(when)}</p><p style="margin:8px 0 0;color:${C.ink};font-size:15px;font-weight:600;">${esc(req.service_name || "Massage")}</p>${addr ? `<p style="margin:8px 0 0;color:${C.muted};font-size:14px;">${esc(addr)}</p>` : ""}${phone ? `<p style="margin:4px 0 0;color:${C.muted};font-size:14px;">${esc(phone)}</p>` : ""}</td></tr></table></td></tr><tr><td style="padding:20px 34px 26px;text-align:center;"><p style="margin:0;color:${C.muted};font-size:14px;line-height:1.6;">You pay the studio directly. No booking fee.<br>Pagas directamente en el centro. Sin comisión.</p><div style="border-top:2px dashed ${C.dash};margin:16px 0;"></div><p style="margin:0;color:#B8AC9E;font-size:12px;">Massage Club · Madrid · book.massageclub.io</p></td></tr></table></td></tr></table>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [req.contact_email], reply_to: "support@massageclub.io", subject: `✅ Confirmed: ${studio}, ${when}`, html, text: `Confirmed: ${req.service_name || "massage"} at ${studio}, ${when}.${addr ? " " + addr + "." : ""} You pay the studio directly, no fee.` }),
  }).catch((e) => console.log("[wa] customer email failed", String(e)));
}

// v51: which day a studio's offer is for, from its own words. Empty = the day asked.
function offerDayFromText(t: string, L: string): string {
  const s = String(t || "").toLowerCase();
  if (/\bma[nñ]ana\b/.test(s) && !/\bpor la ma[nñ]ana\b|\bde la ma[nñ]ana\b/.test(s)) return L === "es" ? "Mañana" : "Tomorrow";
  if (/\bhoy\b/.test(s)) return L === "es" ? "Hoy" : "Today";
  return "";
}

async function acceptOffer(rowId: string, from: string, L: string, s: Session) {
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}&select=id,request_id,partner_id,phone,offered_time,reply_text`, { headers: H() });
  const drows = await dr.json().catch(() => []);
  const row = Array.isArray(drows) && drows[0] ? drows[0] : null;
  if (!row || !row.offered_time) { await sendText(from, COPY[L].offerGone); s.step = "done"; s.data.offer = null; await saveSession(s); return; }
  const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${row.request_id}&select=id,first_name,service_name,day1,contact_email,client_phone,languages,stage`, { headers: H() });
  const reqRows = await rr.json().catch(() => []);
  const req = Array.isArray(reqRows) && reqRows[0] ? reqRows[0] : null;
  if (!req) { await sendText(from, COPY[L].offerGone); s.step = "done"; s.data.offer = null; await saveSession(s); return; }
  const pc = await partnerCard(row.partner_id);
  const studio = pc.business_name || s.data.offer?.studio || "the studio";
  // v37: the winning studio moved an already confirmed time and the customer said yes.
  if (req.stage === "confirmed") {
    const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&select=partner_id,confirmed_day`, { headers: H() });
    const rqs = await rq.json().catch(() => []);
    const cur = Array.isArray(rqs) && rqs[0] ? rqs[0] : null;
    if (!cur || String(cur.partner_id || "") !== String(row.partner_id)) { await sendText(from, COPY[L].offerGone); s.step = "done"; s.data.offer = null; await saveSession(s); return; }
    const cday = s.data.offer?.day || cur.confirmed_day || req.day1 || "";
    const cwhen = [cday, row.offered_time].filter(Boolean).join(" ");
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ confirmed_time: row.offered_time, confirmed_day: cday || null, customer_flag: null, reconfirmed_at: new Date().toISOString(), stage_updated_at: new Date().toISOString(), studio_reply: `Hora cambiada a ${row.offered_time} por ${studio}, cliente acepta` }) });
    await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ customer_answer: "yes", customer_answered_at: new Date().toISOString() }) });
    await sendText(row.phone, `Perfecto, ${cwhen} entonces. Confirmado con ${req.first_name || "el cliente"}. Gracias, Massage Club`);
    await sendText(from, COPY[L].offerAccepted(studio, cwhen, pc.address, pc.phone));
    await customerConfirmEmail(req, studio, cwhen, pc.address, pc.phone);
    s.step = "done"; s.data.offer = null; await saveSession(s);
    await logEvent(from, "time_change_accepted", { id: req.id, studio, time: row.offered_time });
    await notifyJordanWa(`${req.first_name || "Customer"} accepted ${studio}'s new time ${cwhen}. Studio told, customer confirmed by chat and email.`, from);
    return;
  }
  // v51: the day comes from the offer itself (session, or the studio's words on
  // the dispatch row when the customer tapped an older offer), not the day asked.
  const day = (s.data.offer?.row === rowId && s.data.offer?.day) || offerDayFromText(String(row.reply_text || ""), L) || req.day1 || "";
  const when = [day, row.offered_time].filter(Boolean).join(" ");
  // Same race guard as a studio's Confirmado tap: only one confirmation per request.
  const claim = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&stage=neq.confirmed`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({ stage: "confirmed", confirmed_day: day || null, confirmed_time: row.offered_time, partner_id: row.partner_id, studio_name: studio, studio_reply: `Cliente acepta ${row.offered_time} (${studio})`, stage_updated_at: new Date().toISOString() }),
  });
  const claimed = await claim.json().catch(() => []);
  if (!Array.isArray(claimed) || !claimed.length) { await sendText(from, COPY[L].offerGone); s.step = "done"; s.data.offer = null; await saveSession(s); return; }
  await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ outcome: "won", customer_answer: "yes", customer_answered_at: new Date().toISOString() }) });
  await awardRequest(req.id, row.partner_id);
  const clientDigits = digitsOf(req.client_phone || from);
  await sendText(row.phone, `Confirmado: ${req.first_name || "el cliente"}, ${trSvc(req.service_name || "Massage", "es").toLowerCase()}, ${when}. ${req.languages === "es" ? "" : "Habla inglés. "}Si necesitáis decirle algo, escribidnos aquí y se lo hacemos llegar. Gracias, Massage Club`);
  await sendText(from, COPY[L].offerAccepted(studio, when, pc.address, pc.phone));
  await customerConfirmEmail(req, studio, when, pc.address, pc.phone);
  s.step = "done"; s.data.offer = null; await saveSession(s);
  await logEvent(from, "confirmed", { id: req.id, studio, via: "offer" });
  await founderCard(`✅ Booked: ${req.first_name || "customer"} at ${studio}, ${when} · #${req.id}`, {
    badge: "BOOKED",
    title: `${studio} · ${when}`,
    paras: [`${req.first_name || "The customer"} accepted the studio's offer. The studio has the confirmation and the customer's number, the customer was told on WhatsApp${req.contact_email ? " and by email" : ""}, and every other studio asked was stood down. Nothing to do.`],
    waNum: clientDigits,
  });
}

async function declineOffer(rowId: string, from: string, L: string, s: Session) {
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}&select=id,request_id,phone,offered_time`, { headers: H() });
  const drows = await dr.json().catch(() => []);
  const row = Array.isArray(drows) && drows[0] ? drows[0] : null;
  if (row && s.data.offer?.change) {
    // v37: the customer refused a moved time on a confirmed booking. Ask the
    // studio to keep the original slot; a person closes it if they cannot.
    const old = String(s.data.offer?.old || "");
    await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ customer_answer: "no", customer_answered_at: new Date().toISOString() }) });
    await sendText(row.phone, `Al cliente no le encaja ${row.offered_time || "esa hora"}. ¿Podéis mantener la hora original${old ? " (" + old + ")" : ""}? Si no es posible, decídnoslo por aquí y buscamos otra opción. Gracias, Massage Club`);
    await sendText(from, COPY[L].timeChangeDeclined(old));
    s.step = "done"; s.data.offer = null; await saveSession(s);
    await logEvent(from, "time_change_declined", { row: rowId });
    await notifyJordanWa(`${s.wa_name || from} refused the moved time ${row.offered_time || ""} (was ${old || "?"}). Studio asked to keep the original. Watch this one.`, from);
    return;
  }
  if (row) {
    await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ outcome: "no", customer_answer: "no", customer_answered_at: new Date().toISOString() }) });
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${row.request_id}&stage=eq.offered`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "studio_asked", stage_updated_at: new Date().toISOString() }) });
    await sendText(row.phone, `Gracias, al cliente no le encaja ${row.offered_time || "esa hora"}. Si os surge otra opción ese día, decídnoslo por aquí. Massage Club`);
  }
  await sendText(from, COPY[L].offerDeclined);
  s.step = "done"; s.data.offer = null; await saveSession(s);
  await logEvent(from, "offer_declined", { row: rowId });
}

async function createRequest(s: Session): Promise<number | null> {
  const d = s.data;
  // v40: "Help me figure it out" is booked as a relaxing massage, which every
  // studio offers. Nobody should ever read "confirmed your Not sure" (Jordan, 5 Sept).
  const svcRow = ALL_SERVICES.find((x) => x.id === (d.service === "svc_unsure" ? "svc_relax" : d.service));
  const serviceName = svcRow ? svcRow.en : "Massage";
  const area = d.area || "Madrid";
  const when = [d.day, d.time].filter(Boolean).join(" ");
  const full = String(d.name || s.wa_name || "").trim();
  const first = full.split(" ")[0] || "WhatsApp customer";
  const last = full.split(" ").slice(1).join(" ") || null;
  const chosen = d.chosen || null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests`, {
    method: "POST", headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({
      partner_id: chosen ? chosen.id : null,
      slug: chosen ? chosen.slug : null,
      studio_name: chosen ? chosen.name : (d.customStudio ? d.customStudio : `Por asignar (${area})`),
      service_name: chosen && chosen.svc ? chosen.svc : serviceName,
      price: chosen && chosen.price ? chosen.price : null,
      first_name: first, last_name: last,
      area,
      client_phone: "+" + s.phone.replace(/[^0-9]/g, ""),
      contact_email: d.email || null,
      day1: d.day || null, time1: d.time || null,
      day2: d.day || null, time2: d.timeBand && d.timeBand !== d.time ? d.timeBand : null,
      languages: d.lang === "es" ? "es" : "en",
      message_text: `Quiere: ${chosen && chosen.svc ? chosen.svc : serviceName} | Cuando: ${when}${d.timeBand && d.timeBand !== d.time ? " (flexible: " + d.timeBand + ")" : ""} | Zona: ${area}${chosen ? " | Centro: " + chosen.name : (d.customStudio ? " | Centro pedido: " + d.customStudio : "")}${d.duration && d.duration !== 60 ? " | Duración: " + d.duration + " min" : ""}${d.dayDate ? " | Fecha: " + d.dayDate : ""} | Origen: whatsapp-bot${d.rebook ? " (repeat)" : ""}${d.adRef ? " | Ad: " + String(d.adRef).slice(0, 120) : ""}`,
      stage: "new",
    }),
  });
  const rows = await res.json().catch(() => []);
  console.log(`[wa] request created status=${res.status}`);
  return Array.isArray(rows) && rows[0] ? rows[0].id : null;
}

// Create the request and send the confirmation - shared by the normal flow end
// and the shortcuts that skip name/email for known customers.
async function finalizeBooking(s: Session, from: string, L: string) {
  s.step = "done"; await saveSession(s);
  const id = await createRequest(s);
  const svcName = s.data.chosen && s.data.chosen.svc ? s.data.chosen.svc : (ALL_SERVICES.find((x) => x.id === (s.data.service === "svc_unsure" ? "svc_relax" : s.data.service))?.en || "Massage");
  const studioLine = s.data.chosen ? `${s.data.chosen.name}${s.data.chosen.price ? " · " + Number(s.data.chosen.price) + " EUR" : ""}` : (s.data.customStudio ? s.data.customStudio : (s.data.area && s.data.area !== "anywhere" ? (L === "es" ? `cerca de ${s.data.area}` : `near ${s.data.area}`) : (L === "es" ? "en Madrid" : "in Madrid")));
  // v36: outside studio hours the honest line is "at 09:00", not "right now".
  const h = mcMadridHour();
  const confirmCopy = (!s.data.chosen && (h < 9 || h >= 21)) ? COPY[L].confirmLater : COPY[L].confirm;
  const svcLabel = trSvc(svcName, L) + (s.data.duration && s.data.duration !== 60 ? ` ${s.data.duration} min` : "");
  const whenLabel = [s.data.dayDate ? `${String(s.data.day || "").toLowerCase()} ${s.data.dayDate}`.trim() : s.data.day, s.data.time].filter(Boolean).join(", ");
  await sendText(from, confirmCopy(String(s.data.name || s.wa_name || "").split(" ")[0], svcLabel, whenLabel, studioLine, id));
  // Now that the choice is made, the studio page is useful instead of a
  // distraction: send it after the confirmation, never before.
  if (s.data.chosen && s.data.chosen.slug) {
    await sendText(from, `${COPY[L].studioLinks}\n${COPY[L].bookedLink(s.data.chosen.name, `${APP}/book/${s.data.chosen.slug}`)}`);
  }
  await logEvent(from, "request_created", { id, studio: s.data.chosen ? s.data.chosen.name : null });
  // Go and actually ask studios. dispatch-studios fans the request out to
  // several at once and tells the customer how many were contacted; it defers
  // itself outside 09:00-21:00 Madrid and its sweep picks it up in the morning.
  // Only for unassigned requests: a customer still finishing the old flow with
  // a studio already chosen is handled by the studio-ask trigger, and fanning
  // out as well would message five studios about a booking that has one.
  if (id && !s.data.chosen) await dispatchRequest(id);
}

// Fire and forget: a dispatch failure must never break the customer's
// confirmation, and the sweep will retry anything that did not go out.
async function dispatchRequest(requestId: number) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-studios?key=${OPS_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId }),
    });
    console.log(`[wa] dispatch request=${requestId} status=${res.status} ${(await res.text()).slice(0, 200)}`);
  } catch (e) { console.log("[wa] dispatch failed", String(e)); }
}

// A studio said yes. Give them the booking and stand the others down.
async function awardRequest(requestId: number, partnerId: string | null) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-studios?key=${OPS_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ won: { request_id: requestId, partner_id: partnerId } }),
    });
    console.log(`[wa] award request=${requestId} partner=${partnerId} status=${res.status}`);
  } catch (e) { console.log("[wa] award failed", String(e)); }
}

// v39: after reading a sentence, ask only for what is still missing.
async function continueFromKnown(s: Session, from: string, L: string) {
  if (!s.data.service) { s.step = "await_service"; await saveSession(s); await askService(from, L); return; }
  if (!s.data.day) { s.step = "await_day"; await saveSession(s); if (s.data.service === "svc_unsure") await askDayUnsure(from, L); else await askDay(from, L); return; }
  if (!s.data.time) { s.step = "await_time"; await saveSession(s); await askTime(from, L); return; }
  if (!s.data.area) { s.step = "await_area"; await saveSession(s); await askArea(from, L); return; }
  await askNameOrFinalize(s, from, L);
}
// Read a free-text sentence into the session. Returns true if anything was understood.
function absorbSentence(s: Session, text: string, L: string): boolean {
  let got = false;
  const svc = UNSURE_RE.test(text) ? "svc_unsure" : detectService(text);
  if (svc && !s.data.service) { s.data.service = svc; got = true; }
  const day = detectDay(text, L); if (day && !s.data.day) { s.data.day = day; got = true; }
  const time = detectTime(text, L); if (time && !s.data.time) { s.data.time = time; s.data.timeBand = /\(/.test(time) ? time : null; got = true; }
  const area = detectArea(text); if (area && !s.data.area) { s.data.area = area; got = true; }
  const dur = detectDuration(text); if (dur && !s.data.duration) s.data.duration = dur;
  return got;
}

// After the time is set: rebooks with known details finish right here, everyone
// else continues to the area question.
const isTodayEarly = (day: string, time: string): boolean => {
  if (!/^(today|hoy)$/i.test(String(day || "").trim())) return false;
  const t = String(time || "");
  if (/morning|ma\u00f1ana \(/i.test(t)) return true;
  const m = t.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!m) return false;
  let h = parseInt(m[1], 10);
  if (/pm/i.test(t) && h < 12) h += 12;
  return h < 12;
};

async function afterTime(s: Session, from: string, L: string) {
  // v37: an honest word before we promise a morning Madrid cannot sell.
  if (!s.data.sameDayAsked && isTodayEarly(s.data.day, s.data.time)) {
    s.data.sameDayAsked = true; s.step = "await_sameday"; await saveSession(s);
    await sendButtons(from, COPY[L].sameDay, COPY[L].sameDayBtns(String(s.data.time || "")));
    await logEvent(from, "sameday_warning", { time: s.data.time });
    return;
  }
  if (s.data.rebook && s.data.known?.name) {
    s.data.name = s.data.known.name;
    s.data.email = s.data.known.email || null;
    await finalizeBooking(s, from, L);
    return;
  }
  s.step = "await_area"; await saveSession(s); await logEvent(from, "time_chosen", { time: s.data.time }); await askArea(from, L);
}

// Reaching the name step: known customers skip name+email and finish directly.
async function askNameOrFinalize(s: Session, from: string, L: string) {
  if (s.data.known?.name) {
    s.data.name = s.data.known.name;
    s.data.email = s.data.known.email || null;
    await finalizeBooking(s, from, L);
    return;
  }
  s.step = "await_name"; await saveSession(s);
  await sendText(from, COPY[L].name);
}

async function sendStatus(to: string, L: string, phone: string) {
  const num = "+" + phone.replace(/[^0-9]/g, "");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent(num)}&stage=neq.dismissed&order=created_at.desc&limit=1&select=service_name,day1,time1,studio_name,stage,confirmed_day,confirmed_time`, { headers: H() });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows) || !rows[0]) { await sendText(to, COPY[L].noBooking); return; }
  const b = rows[0];
  const stageTxt = COPY[L].stages[b.stage === "bidding" ? "studio_replied" : b.stage] || b.stage;
  const when = b.stage === "confirmed" && b.confirmed_day ? `${b.confirmed_day} ${b.confirmed_time || ""}`.trim() : [b.day1, b.time1].filter(Boolean).join(" ");
  const studio = /por asignar/i.test(b.studio_name || "") ? "" : b.studio_name;
  await sendText(to, COPY[L].statusLine(trSvc(b.service_name || "Massage", L), when, studio, stageTxt));
}

export function start(cfg: { waToken?: string; resendKey?: string; opsKey?: string } = {}) {
  if (cfg.waToken) WA_TOKEN = cfg.waToken;
  if (cfg.resendKey) RESEND_API_KEY = cfg.resendKey;
  if (cfg.opsKey) OPS_KEY = cfg.opsKey;
  Deno.serve(handler);
}
const handler = async (req: Request) => {
  let payload: any = null;
  try { payload = await req.json(); } catch { return new Response("OK", { status: 200 }); }

  try {
    // v46: cron closes bidding windows through here (key-guarded, no Meta payload).
    if (payload?.ops === "settle") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const settled = await settleBids();
      return new Response(JSON.stringify({ ok: true, settled }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    // v39: delivery failures are news. A free-text reminder outside the 24h
    // window dies silently at Meta; log it in the chat and tell Jordan.
    if (!msg && Array.isArray(value?.statuses)) {
      for (const st of value.statuses) {
        if (st?.status !== "failed") continue;
        const to = digitsOf(st.recipient_id || "");
        const err = Array.isArray(st.errors) && st.errors[0] ? st.errors[0] : {};
        const line = `DELIVERY FAILED (${err.code || "?"}): ${err.title || err.message || "unknown"}${err.error_data?.details ? " · " + String(err.error_data.details).slice(0, 160) : ""}`;
        if (to) await logMsg(to, "out", line, "status_failed");
        if (to && to !== digitsOf(JORDAN_MAIN_NUMBER)) await notifyJordanWa(`message to +${to} was NOT delivered: ${err.title || err.code || "unknown"}${Number(err.code) === 131047 ? " (24h window closed, only a template reaches them now)" : ""}.`, to);
      }
      return new Response("OK", { status: 200 });
    }
    if (!msg) return new Response("OK", { status: 200 });
    const from = String(msg.from || "");
    const profileName = value?.contacts?.[0]?.profile?.name || "";
    if (!from) return new Response("OK", { status: 200 });

    let replyId = "", text = "";
    let loc: { latitude?: number; longitude?: number } | null = null;
    let btnText = "";
    if (msg.type === "interactive") replyId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";
    else if (msg.type === "button") { replyId = msg.button?.payload || ""; btnText = msg.button?.text || ""; }
    else if (msg.type === "text") text = String(msg.text?.body || "").trim();
    else if (msg.type === "location") loc = { latitude: Number(msg.location?.latitude), longitude: Number(msg.location?.longitude) };
    const reactionEmoji = msg.type === "reaction" ? String(msg.reaction?.emoji || "") : "";

    // Click-to-WhatsApp ad attribution: Meta attaches the ad to the first message.
    const ref = msg.referral || null;
    const adLine = ref ? `Came from an ad: ${[ref.headline, ref.body].filter(Boolean).join(" · ").slice(0, 140) || ref.source_url || "unknown creative"}${ref.source_type ? ` (${ref.source_type})` : ""}` : "";
    if (ref) console.log(`[wa] ad referral from ${from}:`, JSON.stringify(ref).slice(0, 300));

    // Look up when this number last wrote BEFORE logging the current message,
    // so we can tell a fresh/resumed conversation from a mid-flow tap.
    let priorLastAt: number | null = null;
    try {
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${encodeURIComponent(from)}&order=created_at.desc&limit=1&select=created_at`, { headers: H() });
      const prows = await pr.json().catch(() => []);
      if (Array.isArray(prows) && prows[0]?.created_at) priorLastAt = Date.parse(prows[0].created_at);
    } catch (_e) { /* alert heuristics only */ }

    await logMsg(from, "in", (text || btnText || (msg.type === "reaction" ? `[reaction ${reactionEmoji}]`.trim() : "") || (loc ? `[location ${loc.latitude},${loc.longitude}]` : `[tap: ${replyId}]`)) + (ref ? ` [via ad]` : ""), msg.type, replyId);

    // A reaction (someone tapping a thumbs up on our message) is not an answer.
    if (msg.type === "reaction") return new Response("OK", { status: 200 });

    // ---- Studio replies: template button payloads, or free text from a partner number ----
    if (/^arr_(yes|no)_\d+$/.test(replyId)) {
      const partner = await findPartnerByNumber(digitsOf(from));
      await handleArrival(from, replyId, partner);
      return new Response("OK", { status: 200 });
    }
    if (/^studio_(confirm|other)_\d+$/.test(replyId)) {
      const partner = await findPartnerByNumber(digitsOf(from));
      await handleStudioReply(from, replyId, btnText, text, partner);
      return new Response("OK", { status: 200 });
    }
    // Anything at all from a known studio number is a studio talking to us,
    // whatever the message type. It must never enter the customer flow.
    {
      const partner = await findPartnerByNumber(digitsOf(from));
      if (partner) {
        if (text) {
          // v36: an away message is not an answer. Studios fire one within
          // seconds of our template ("gracias por contactar, te responderemos").
          const sinceMs = priorLastAt === null ? Infinity : Date.now() - priorLastAt;
          const autoReply = AUTOREPLY_RE.test(text) || (sinceMs < 45_000 && !parseOfferedTime(text));
          if (autoReply) {
            console.log(`[studio] auto-reply from ${partner.business_name} ignored (${Math.round(sinceMs / 1000)}s after our message)`);
            const em = text.match(EMAIL_IN_TEXT_RE);
            if (em) {
              await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(partner.id)}&booking_email=is.null`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ booking_email: em[0].toLowerCase() }) }).catch(() => {});
            }
          } else await handleStudioReply(from, "", "", text, partner);
        }
        else console.log(`[wa] non-text message from partner ${partner.business_name}, ignored`);
        return new Response("OK", { status: 200 });
      }
    }

    const s = await getSession(from);
    if (profileName && !s.wa_name) s.wa_name = profileName;
    if (ref) s.data.adRef = [ref.headline, ref.source_url].filter(Boolean).join(" ") || "ctwa";

    // Blocked numbers stay blocked: no replies, no alerts, ever.
    if (s.step === "blocked") return new Response("OK", { status: 200 });

    // Someone is talking to the bot: alert on a number's first ever message and
    // whenever a known number comes back after 6+ quiet hours. Taps and replies
    // inside an active flow stay silent.
    const QUIET_MS = 6 * 60 * 60 * 1000;
    const isFresh = priorLastAt === null;
    const isResumed = priorLastAt !== null && (Date.now() - priorLastAt) > QUIET_MS;
    if (isFresh || isResumed) {
      const num = digitsOf(from);
      const firstMsg = text || btnText || (loc ? "[shared their location]" : "[tapped a button]");
      await founderCard(`💬 ${isFresh ? "New chat" : "Back again"}: ${profileName || "+" + num}${ref ? " · from your ad" : ""}`, {
        badge: isFresh ? "NEW CONVERSATION" : "BACK AGAIN",
        title: `${profileName || "+" + num} ${isFresh ? "just messaged the bot" : "picked the chat back up"}`,
        paras: [
          isFresh ? `First ever message from +${num}. The bot is handling it; you can watch live below or jump in from your main number.` : `+${num} wrote again after a quiet spell. The bot is handling it; you can watch live below or jump in from your main number.`,
          adLine,
        ].filter(Boolean),
        quote: firstMsg,
        waNum: num,
        to: [...SUPPORT, ...JORDAN],
      }).catch((e) => console.log("[wa] chat alert failed", String(e)));
    }

    // "Special massage" probes: standard line once, then permanent silence.
    if ((text && EROTIC_RE.test(text)) || (btnText && EROTIC_RE.test(btnText))) {
      s.step = "blocked"; await saveSession(s);
      await sendText(from, s.data.lang === "es" ? BLOCK_LINE_ES : BLOCK_LINE_EN);
      await logEvent(from, "blocked", { text: String(text || btnText).slice(0, 120) });
      await founderCard(`🚫 Blocked: ${profileName || "+" + digitsOf(from)}`, {
        badge: "BLOCKED",
        title: "Special-massage seeker blocked",
        paras: [`+${digitsOf(from)} asked for something we do not offer. They got the standard line and the bot will never reply to them again. Nothing to do.`],
        quote: text || btnText,
        waNum: digitsOf(from),
        to: [...SUPPORT],
      }).catch(() => {});
      return new Response("OK", { status: 200 });
    }

    // v39: a typed "Español" or "English" switches language like the tap does.
    // Ismael typed Español three times on 5 Sept and got the English menu each time.
    if (text && /^(espa[nñ]ol|spanish|castellano|en espa[nñ]ol)$/i.test(text.trim())) replyId = "lang_es";
    else if (text && /^(english|ingl[eé]s|in english)$/i.test(text.trim())) replyId = "lang_en";
    if (replyId === "lang_es" || replyId === "lang_en") {
      s.data.lang = replyId === "lang_es" ? "es" : "en";
      if (s.step === "start") s.step = "await_service";
      if (s.data.pendingService) {
        // v39: they already picked a massage on the bilingual list; carry on to the day.
        const svcId = String(s.data.pendingService); s.data.pendingService = null; s.data.service = svcId;
        s.step = "await_day"; await saveSession(s);
        await logEvent(from, "service_chosen", { service: svcId, bilingual: true });
        if (svcId === "svc_unsure") await askDayUnsure(from, s.data.lang); else await askDay(from, s.data.lang);
        return new Response("OK", { status: 200 });
      }
      await saveSession(s);
      // v40: Mateo tapped English while on the day question and got the service list again.
      const NL = s.data.lang;
      switch (s.step) {
        case "done": case "menu": await sendMenu(from, NL); break;
        case "await_day": if (s.data.service === "svc_unsure") await askDayUnsure(from, NL); else await askDay(from, NL); break;
        case "await_day_text": await sendText(from, COPY[NL].dayAsk); break;
        case "await_time": await askTime(from, NL); break;
        case "await_hour": await askHour(from, NL, s.data.timeBandId || "time_afternoon"); break;
        case "await_time_text": await sendText(from, COPY[NL].timeAsk); break;
        case "await_area": await askArea(from, NL); break;
        case "await_name": await sendText(from, COPY[NL].name); break;
        case "await_email": await sendText(from, COPY[NL].email); break;
        default: await askService(from, NL);
      }
      return new Response("OK", { status: 200 });
    }
    if (text && s.data.lang !== "es" && strongSpanish(text)) s.data.lang = "es";
    const L: string = s.data.lang === "es" ? "es" : "en";

    // Clothing questions get a real answer about professional standards, then
    // we pick the flow back up. Never a human handoff, never stored as data.
    if (text && MODESTY_RE.test(text)) {
      await sendText(from, COPY[L].modesty);
      switch (s.step) {
        case "await_area": await askArea(from, L); break;
        case "await_day_text": await sendText(from, COPY[L].dayAsk); break;
        case "await_time_text": await sendText(from, COPY[L].timeAsk); break;
        case "await_studio_text": await sendText(from, COPY[L].otherStudioAsk); break;
        case "await_name": await sendText(from, COPY[L].name); break;
        case "await_email": await sendText(from, COPY[L].email); break;
      }
      await logEvent(from, "modesty_question", {});
      return new Response("OK", { status: 200 });
    }

    // "Not now" on the rebooking nudge: warm goodbye, no sales pitch.
    if (replyId === "rebook_later") {
      s.step = "done"; await saveSession(s);
      await sendText(from, COPY[L].rebookLater);
      return new Response("OK", { status: 200 });
    }

    // v36: answers to a forwarded studio offer win over whatever step they were on.
    {
      const om = replyId.match(/^offer_(yes|no)_([0-9a-fA-F-]{8,})$/);
      if (om) {
        if (om[1] === "yes") await acceptOffer(om[2], from, L, s); else await declineOffer(om[2], from, L, s);
        return new Response("OK", { status: 200 });
      }
      if (s.step === "await_offer" && text && s.data.offer?.row) {
        const bare = text.trim().toLowerCase().replace(/[.!¡¿?]/g, "");
        if (/^(yes|yeah|yep|ok|okay|sure|si|sí|vale|perfecto|perfect|great|book it|reserva|reservar|confirm|confirmo|1)$/.test(bare)) { await acceptOffer(String(s.data.offer.row), from, L, s); return new Response("OK", { status: 200 }); }
        if (/^(no|nope|another|otra|other|otra hora|another time|2)$/.test(bare)) { await declineOffer(String(s.data.offer.row), from, L, s); return new Response("OK", { status: 200 }); }
      }
    }

    // v39: answers to the booking check-in, and any change of heart on a
    // confirmed booking. Nothing gets confirmed to a studio from here; the
    // customer names a time first.
    {
      const rm = replyId.match(/^rc_(yes|change|cancel)_(\d+)$/);
      if (rm) { await handleCustomerReconfirm(rm[1] as any, rm[2], from, L, s); return new Response("OK", { status: 200 }); }
      if (text && ["done", "human", "menu", "start", "await_reconfirm", "await_email_post"].includes(s.step)) {
        const bare = text.trim().toLowerCase().replace(/[.!¡¿?]/g, "");
        const isYes = /^(yes|yeah|yep|ok|okay|sure|si|sí|vale|claro|confirmo|confirmed|coming|i'?ll be there|voy|all[ií] estar[eé])$/.test(bare);
        const isNo = /^(no|nope|nah)$/.test(bare);
        const wantsCancel = CANCEL_RE.test(text) || DECLINE_RE.test(text);
        const wantsChange = CHANGE_RE.test(text) && !GOODBYE_RE.test(text) && !wantsCancel;
        if (isYes || isNo || wantsCancel || wantsChange) {
          const cq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent("+" + digitsOf(from))}&stage=eq.confirmed&order=created_at.desc&limit=1&select=id,confirmed_start`, { headers: H() });
          const creq = (await cq.json().catch(() => []))[0] || null;
          const soon = creq && (!creq.confirmed_start || Date.parse(creq.confirmed_start) > Date.now() - 2 * 3600e3);
          if (creq && soon && (wantsCancel || wantsChange || isNo || (isYes && s.step === "await_reconfirm"))) {
            await handleCustomerReconfirm(wantsCancel ? "cancel" : (isYes ? "yes" : "change"), String(creq.id), from, L, s);
            return new Response("OK", { status: 200 });
          }
        }
      }
    }

    if (text && BACK_RE.test(text)) {
      const moved = await goBack(s, from, L);
      if (moved) return new Response("OK", { status: 200 });
    }

    const freeTextStep = ["await_name", "await_email", "await_email_post", "await_day_text", "await_area", "await_time_text", "await_studio_text"].includes(s.step);

    // A question at a free-text step gets answered, then we ask our question
    // again. Never store someone's question as their name, day or area.
    if (text && freeTextStep && !isEmail(text) && looksLikeQuestion(text)) {
      if (PRICEQ_RE.test(text)) await sendText(from, COPY[L].priceInfo);
      else if (HOWWORKS_RE.test(text)) await sendText(from, COPY[L].howItWorks);
      else if (ZONEQ_RE.test(text)) await sendText(from, COPY[L].zoneAnswer);
      else {
        await helpInstead(s, from, L, text);
        return new Response("OK", { status: 200 });
      }
      switch (s.step) {
        case "await_area": await askArea(from, L); break;
        case "await_day_text": await sendText(from, COPY[L].dayAsk); break;
        case "await_time_text": await sendText(from, COPY[L].timeAsk); break;
        case "await_studio_text": await sendText(from, COPY[L].otherStudioAsk); break;
        case "await_name": await sendText(from, COPY[L].name); break;
        case "await_email": await sendText(from, COPY[L].email); break;
        case "await_email_post": await sendText(from, COPY[L].emailAskPost); break;
      }
      return new Response("OK", { status: 200 });
    }

    // v53: a question typed at a button step gets its answer and then the question
    // again. On 6 Sept a customer asked "Que precio es?" three times at the day
    // question and got the day buttons three times.
    const buttonStep = ["await_service", "await_day", "await_time", "await_hour", "await_area", "await_sameday"].includes(s.step);
    if (text && buttonStep && !replyId && (PRICEQ_RE.test(text) || HOWWORKS_RE.test(text) || ZONEQ_RE.test(text) || (looksLikeQuestion(text) && !detectService(text) && !detectDay(text, L)))) {
      if (PRICEQ_RE.test(text)) await sendText(from, COPY[L].priceInfo);
      else if (HOWWORKS_RE.test(text)) await sendText(from, COPY[L].howItWorks);
      else if (ZONEQ_RE.test(text)) await sendText(from, COPY[L].zoneAnswer);
      else { await helpInstead(s, from, L, text); return new Response("OK", { status: 200 }); }
      await reAsk(s, from, L);
      return new Response("OK", { status: 200 });
    }

    if ((text && !freeTextStep && wantsHuman(text)) || replyId === "svc_human") {
      // v39: no hand-off. Help here, tell Jordan, carry on (Jordan, 5 Sept).
      await helpInstead(s, from, L, text || "asked for a person");
      return new Response("OK", { status: 200 });
    }
    if (text && !freeTextStep && ZONEQ_RE.test(text)) {
      await sendText(from, COPY[L].zoneAnswer);
      await continueFromKnown(s, from, L);
      return new Response("OK", { status: 200 });
    }

    // Therapists looking for work reach us through the same ads. Answer them
    // properly once, then hand over to a human instead of looping the menu.
    if (text && !freeTextStep && JOB_RE.test(text) && !/book|reserv|appointment|cita/i.test(text)) {
      s.step = "human"; await saveSession(s);
      await sendText(from, COPY[L].jobSeeker);
      await notifyHuman(s, text);
      return new Response("OK", { status: 200 });
    }

    // "How does this work?" gets a real answer anywhere outside free-text steps,
    // then the flow continues where it left off.
    if (text && !freeTextStep && HOWWORKS_RE.test(text)) {
      await sendText(from, COPY[L].howItWorks);
      if (["start", "await_service", "returning_choice", "done"].includes(s.step)) {
        s.step = "await_service"; await saveSession(s);
        await askService(from, L);
      }
      return new Response("OK", { status: 200 });
    }

    if (/^(menu|menú)$/i.test(text) || replyId === "menu_open") {
      await sendMenu(from, L);
      return new Response("OK", { status: 200 });
    }
    if (/^(status|estado)$/i.test(text) || replyId === "menu_status") {
      await sendStatus(from, L, from);
      return new Response("OK", { status: 200 });
    }
    if (/^(book|reservar)$/i.test(text) || replyId === "menu_book") {
      s.step = "await_service"; s.data = { lang: s.data.lang || "", known: s.data.known || null, adRef: s.data.adRef || null };
      await saveSession(s); await logEvent(from, "flow_started", { via: "menu" }); await askService(from, L);
      return new Response("OK", { status: 200 });
    }
    if ((HI_RE.test(text) || (text && !freeTextStep && BOOKAGAIN_RE.test(text))) && s.step !== "start" && !["await_name", "await_email", "await_email_post", "await_day_text", "await_offer", "await_sameday", "await_reconfirm", "await_change"].includes(s.step)) {
      if (s.step === "done" && HI_RE.test(text)) { await sendMenu(from, L); return new Response("OK", { status: 200 }); }
      // A "hola" seconds after the greeting is a hello, not a restart: ask the
      // service question again instead of resending the card link and intro.
      if (s.step === "await_service" && HI_RE.test(text)) { await askService(from, L); return new Response("OK", { status: 200 }); }
      s.data = { lang: s.data.lang || "", adRef: s.data.adRef || null };
      await greet(s, from);
      return new Response("OK", { status: 200 });
    }

    switch (s.step) {
      case "start": {
        await greet(s, from, text);
        break;
      }
      case "returning_choice": {
        if (replyId === "rebook_same" && s.data.rebookOffer) {
          const o = s.data.rebookOffer;
          s.data.chosen = { id: o.partner_id, slug: o.slug, name: o.studio_name, svc: o.service, price: o.price };
          s.data.rebook = true;
          s.step = "await_day"; await saveSession(s);
          await askDay(from, L);
        } else if (replyId === "rebook_same") {
          s.step = "await_service"; await saveSession(s); await askService(from, L);
        } else {
          // Anything unrecognized here: show the service list (fresh booking).
          s.step = "await_service"; await saveSession(s); await askService(from, L);
        }
        break;
      }
      case "await_service": {
        // v39: an ad lead who tapped a massage on the bilingual list has not told us
        // their language yet. Ask once, then continue in it.
        if (!s.data.lang && (s.data.adRef || s.data.bilingual) && replyId.startsWith("svc_") && replyId !== "svc_more" && replyId !== "svc_back") {
          s.data.pendingService = replyId; s.data.bilingual = true; await saveSession(s);
          await sendButtons(from, "¿Seguimos en español o en inglés? / Spanish or English?", [{ id: "lang_es", title: "Español" }, { id: "lang_en", title: "English" }]);
          break;
        }
        if (replyId === "svc_more") { await askServiceMore(from, L); }
        else if (replyId === "svc_back") { await askService(from, L); }
        else if (replyId === "svc_unsure") { s.data.service = replyId; s.step = "await_day"; await saveSession(s); await logEvent(from, "service_chosen", { service: replyId }); await askDayUnsure(from, L); }
        else if (replyId.startsWith("svc_")) { s.data.service = replyId; s.step = "await_day"; await saveSession(s); await logEvent(from, "service_chosen", { service: replyId }); await askDay(from, L); }
        else {
          if (text && absorbSentence(s, text, L)) {
            const row = ALL_SERVICES.find((x) => x.id === s.data.service);
            if (s.data.service) await logEvent(from, "service_chosen", { service: s.data.service, typed: true });
            const understood = [row ? (L === "es" ? String(row.tEs).toLowerCase() : String(row.tEn).toLowerCase()) : "", s.data.day, s.data.time, s.data.area].filter(Boolean).join(" · ");
            await sendText(from, COPY[L].gotItSvc(understood || (L === "es" ? "tu petición" : "your request")));
            await continueFromKnown(s, from, L);
          } else if (text && ZONEQ_RE.test(text)) {
            await sendText(from, COPY[L].zoneAnswer);
            await askService(from, L);
          } else await askService(from, L);
        }
        break;
      }
      case "await_day": {
        if (replyId === "day_today") { s.data.day = L === "es" ? "Hoy" : "Today"; s.data.dayDate = longDate(L, 0); s.step = "await_time"; await saveSession(s); await logEvent(from, "day_chosen", { day: "today" }); await askTime(from, L); }
        else if (replyId === "day_tomorrow") { s.data.day = L === "es" ? "Mañana" : "Tomorrow"; s.data.dayDate = longDate(L, 1); s.step = "await_time"; await saveSession(s); await logEvent(from, "day_chosen", { day: "tomorrow" }); await askTime(from, L); }
        else if (replyId === "day_other") { s.step = "await_day_text"; await saveSession(s); await sendText(from, COPY[L].dayAsk); }
        // v53: a typed "hoy", "mañana", "el lunes" or "12 de septiembre" at the day buttons is an answer.
        else if (text && detectDay(text, L)) {
          const d = detectDay(text, L);
          s.data.day = d;
          s.data.dayDate = /^(hoy|today)$/i.test(d) ? longDate(L, 0) : (/^(mañana|tomorrow)$/i.test(d) ? longDate(L, 1) : null);
          s.step = "await_time"; await saveSession(s); await logEvent(from, "day_chosen", { day: "typed" }); await askTime(from, L);
        }
        else await askDay(from, L);
        break;
      }
      case "await_day_text": {
        if (text) { s.data.day = text.slice(0, 60); s.step = "await_time"; await saveSession(s); await logEvent(from, "day_chosen", { day: "typed" }); await askTime(from, L); }
        else await sendText(from, COPY[L].dayAsk);
        break;
      }
      case "await_time": {
        if (HOURS[replyId]) {
          s.data.timeBandId = replyId;
          s.data.timeBand = L === "es" ? HOURS[replyId].labelEs : HOURS[replyId].label;
          s.step = "await_hour"; await saveSession(s);
          await askHour(from, L, replyId);
        } else if (replyId === "time_custom") {
          s.step = "await_time_text"; await saveSession(s);
          await sendText(from, COPY[L].timeAsk);
        } else if (text && TIME_RE.test(text)) {
          s.data.time = text.slice(0, 20); s.data.timeBand = null; s.data.timeBandId = null;
          await afterTime(s, from, L);
        } else await askTime(from, L);
        break;
      }
      case "await_time_text": {
        if (text && TIME_RE.test(text)) {
          s.data.time = text.slice(0, 20); s.data.timeBand = null; s.data.timeBandId = null;
          await afterTime(s, from, L);
        } else if (text && /\d/.test(text)) {
          s.data.time = text.slice(0, 30); s.data.timeBand = null; s.data.timeBandId = null;
          await afterTime(s, from, L);
        } else await sendText(from, COPY[L].timeAsk);
        break;
      }
      case "await_hour": {
        if (replyId === "hour_flex") { s.data.time = s.data.timeBand; await afterTime(s, from, L); }
        else if (replyId.startsWith("hour_")) {
          const h = replyId.replace("hour_", "");
          s.data.time = `${h.slice(0, 2)}:${h.slice(2)}`;
          await afterTime(s, from, L);
        } else if (text && TIME_RE.test(text)) {
          s.data.time = text.slice(0, 20);
          await afterTime(s, from, L);
        } else await askHour(from, L, s.data.timeBandId || "time_afternoon");
        break;
      }
      case "await_sameday": {
        if (replyId === "sd_earliest") { s.data.time = COPY[L].earliestToday; s.data.timeBand = null; s.data.timeBandId = null; await logEvent(from, "sameday_choice", { choice: "earliest" }); await afterTime(s, from, L); }
        else if (replyId === "sd_tomorrow") { s.data.day = L === "es" ? "Mañana" : "Tomorrow"; s.data.dayDate = longDate(L, 1); await logEvent(from, "sameday_choice", { choice: "tomorrow" }); await afterTime(s, from, L); }
        else if (replyId === "sd_keep") { await logEvent(from, "sameday_choice", { choice: "keep" }); await afterTime(s, from, L); }
        else if (text && /tomorrow|ma\u00f1ana/i.test(text)) { s.data.day = L === "es" ? "Mañana" : "Tomorrow"; s.data.dayDate = longDate(L, 1); await afterTime(s, from, L); }
        else if (text && /earliest|soon|antes|cuanto antes|12/i.test(text)) { s.data.time = COPY[L].earliestToday; s.data.timeBand = null; s.data.timeBandId = null; await afterTime(s, from, L); }
        else await sendButtons(from, COPY[L].sameDay, COPY[L].sameDayBtns(String(s.data.time || "")));
        break;
      }
      case "await_area": {
        if (replyId === "area_other") { await sendLocationRequest(from, COPY[L].areaShare); break; }
        let area = "";
        if (replyId === "area_any") area = "anywhere";
        else if (replyId.startsWith("area_")) area = AREA_ROWS.find((a) => a.id === replyId)?.area || "";
        else if (loc && loc.latitude && loc.longitude) area = await nearestArea(loc.latitude, loc.longitude);
        else if (text) {
          if (ANY_RE.test(text)) area = "anywhere";
          else {
            const hit = AREAS.find((a) => stripAcc(a) === stripAcc(text) || stripAcc(text).includes(stripAcc(a)));
            area = hit || text.slice(0, 40);
          }
        }
        if (area) {
          s.data.area = area;
          await logEvent(from, "area_given", { area });
          // v35: no studio question. Choosing a studio was where the funnel
          // died (4 of 4 customers saw options, 1 picked), so we take the job
          // on ourselves and go ask several studios instead.
          await askNameOrFinalize(s, from, L);
        } else await sendText(from, COPY[L].areaAgain);
        break;
      }
      case "await_studio": {
        if (replyId === "pick_yes") {
          const top = (s.data.picks || [])[0];
          if (top) { s.data.chosen = top; s.data.customStudio = null; await logEvent(from, "studio_chosen", { how: "toppick", studio: top.name }); await askNameOrFinalize(s, from, L); }
          else await askStudio(from, L, s);
        }
        else if (replyId === "pick_more") { await askStudioList(from, L, s); }
        else if (replyId === "studio_any") { s.data.chosen = null; s.data.customStudio = null; await logEvent(from, "studio_chosen", { how: "any" }); await askNameOrFinalize(s, from, L); }
        else if (replyId === "studio_other") { s.step = "await_studio_text"; await saveSession(s); await sendText(from, COPY[L].otherStudioAsk); }
        else if (replyId.startsWith("studio_")) {
          const idx = Number(replyId.split("_")[1]);
          const p = (s.data.picks || [])[idx];
          if (p) { s.data.chosen = p; s.data.customStudio = null; await logEvent(from, "studio_chosen", { how: "list", studio: p.name }); await askNameOrFinalize(s, from, L); }
          else { await askStudio(from, L, s); }
        } else if (text && OTHERTYPE_RE.test(text)) {
          s.step = "await_service"; s.data.picks = null; await saveSession(s);
          await sendText(from, COPY[L].otherTypeAck);
          await askService(from, L);
        } else if (text && ANY_RE.test(text)) {
          s.data.chosen = null; s.data.customStudio = null; await logEvent(from, "studio_chosen", { how: "any_typed" }); await askNameOrFinalize(s, from, L);
        } else if (text && detectService(text) && detectService(text) !== s.data.service) {
          s.data.service = detectService(text); s.data.picks = null; await saveSession(s);
          const offered = await askStudio(from, L, s);
          if (!offered) await askNameOrFinalize(s, from, L);
        } else await askStudio(from, L, s);
        break;
      }
      case "await_studio_text": {
        if (!text) { await sendText(from, COPY[L].otherStudioAsk); break; }
        const typed = text.slice(0, 60);
        const hit = await findPartnerByName(typed);
        if (hit) { s.data.chosen = { id: hit.id, slug: hit.slug, name: hit.business_name, svc: null, price: null }; s.data.customStudio = null; }
        else { s.data.chosen = null; s.data.customStudio = typed; }
        await logEvent(from, "studio_chosen", { how: "typed" });
        await askNameOrFinalize(s, from, L);
        break;
      }
      case "await_name": {
        if (!text) { await sendText(from, COPY[L].name); break; }
        s.data.name = text.slice(0, 80);
        // v50: no email question before the booking. Seven questions before we
        // did anything was too many (Jordan, 6 Sept). The email is asked once,
        // after a studio confirms (await_email_post).
        s.data.email = s.data.email || null;
        await finalizeBooking(s, from, L);
        break;
      }
      case "await_email": {
        if (text && /^(skip|saltar|no)$/i.test(text)) { s.data.email = null; }
        else if (text && isEmail(text)) { s.data.email = text.trim().toLowerCase(); }
        else { await sendText(from, COPY[L].emailBad); break; }
        await finalizeBooking(s, from, L);
        break;
      }
      case "await_email_post": {
        // They skipped email during booking; the studio just confirmed and we
        // asked once more. Capture it, attach it to the request, send the
        // welcome + account email via booking-ack.
        if (text && /^(skip|saltar|no)$/i.test(text)) {
          s.step = "done"; await saveSession(s);
          await sendText(from, COPY[L].ackReply);
          break;
        }
        // v47: a decline or cancellation typed here is not a bad email address.
        if (text && !isEmail(text) && (CANCEL_RE.test(text) || DECLINE_RE.test(text))) {
          const cq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent("+" + digitsOf(from))}&stage=eq.confirmed&order=created_at.desc&limit=1&select=id`, { headers: H() });
          const creq = (await cq.json().catch(() => []))[0] || null;
          if (creq) { await handleCustomerReconfirm("cancel", String(creq.id), from, L, s); break; }
          s.step = "done"; await saveSession(s);
          await sendText(from, COPY[L].ackReply);
          break;
        }
        // v47: only a mangled address ("@" present) gets one retry; anything else
        // closes the question politely instead of nagging.
        if (!text || !isEmail(text)) {
          if (text && text.includes("@")) { await sendText(from, COPY[L].emailBad); break; }
          s.step = "done"; await saveSession(s);
          await sendText(from, L === "es" ? "Sin problema, lo dejamos sin email. Si necesitas algo de tu reserva, escríbeme aquí." : "No problem, we will leave it without an email. If you need anything about your booking, just write here.");
          break;
        }
        const email = text.trim().toLowerCase();
        s.data.email = email; s.step = "done"; await saveSession(s);
        try {
          const num = "+" + digitsOf(from);
          const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent(num)}&stage=neq.dismissed&order=created_at.desc&limit=1&select=*`, { headers: H() });
          const rows2 = await rr.json().catch(() => []);
          const reqRow = Array.isArray(rows2) && rows2[0] ? rows2[0] : null;
          if (reqRow) {
            await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${reqRow.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ contact_email: email }) });
            reqRow.contact_email = email;
            await fetch(`${SUPABASE_URL}/functions/v1/booking-ack`, { method: "POST", headers: H(), body: JSON.stringify({ type: "INSERT", table: "whatsapp_requests", record: reqRow }) }).catch((e) => console.log("[wa] booking-ack call failed", String(e)));
          }
        } catch (e) { console.log("[wa] email-post attach failed", String(e)); }
        await logEvent(from, "email_captured", { when: "post_confirm" });
        await sendText(from, COPY[L].emailSaved);
        break;
      }
      case "await_offer": {
        // Anything that is not a clear yes/no: a person reads it, the buttons stay valid.
        if (text) {
          const num = s.phone.replace(/[^0-9]/g, "");
          await founderCard(`💬 ${s.wa_name || "+" + num} replied to an offer: ${text.slice(0, 50)}`, {
            badge: "OFFER REPLY",
            title: `${s.wa_name || "Customer"} wrote instead of tapping`,
            paras: [`Offer on the table: ${s.data.offer?.studio || "studio"} at ${s.data.offer?.time || "?"} (request #${s.data.offer?.request || "?"}). Their message:`],
            quote: text, waNum: num, prefill: await customerPrefill(s.phone), to: JORDAN,
          });
          await sendText(from, COPY[L].offerRemind(s.data.offer?.studio || "the studio", s.data.offer?.time || ""));
          await notifyJordanWa(`${s.wa_name || "+" + num} replied to the ${s.data.offer?.studio || "studio"} ${s.data.offer?.time || ""} offer with text instead of a tap: ${text.slice(0, 120)}`, s.phone);
        }
        break;
      }
      case "await_reconfirm": {
        // Not a clear yes/no/change: remind once, and a person reads it.
        if (text) {
          const num = s.phone.replace(/[^0-9]/g, "");
          await sendText(from, COPY[L].reconfirmRemind(s.data.reconfirm?.studio || (L === "es" ? "el centro" : "the studio"), s.data.reconfirm?.time || ""));
          await notifyJordanWa(`${s.wa_name || "+" + num} replied to the booking check-in with text: ${text.slice(0, 140)}`, s.phone);
        }
        break;
      }
      case "await_change": {
        // The customer named a new time. Ask the studio, tell Jordan, and keep
        // the customer's words in the record. A studio answer with a time comes
        // back through the offer loop; a person closes anything else.
        if (text) {
          const num = s.phone.replace(/[^0-9]/g, "");
          const c = s.data.change || {};
          await sendText(from, COPY[L].changeNoted(c.studio || ""));
          if (c.request) await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${c.request}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage_note: `Customer asks to change to: ${text.slice(0, 200)}` }) }).catch(() => {});
          if (c.studioNum) await tellStudio(String(c.studioNum), String(s.wa_name || ""), String(c.time || ""), `El cliente pide cambiar su cita de las ${c.time || "-"} a: "${text.slice(0, 160)}". ¿Os encaja? Responded aquí con la hora que podéis y se lo pasamos. Gracias, Massage Club`, `pide cambiar a: ${text.slice(0, 120)}`);
          await notifyJordanWa(`${s.wa_name || "+" + num} wants to move ${c.studio || "the booking"} (${c.time || "?"}) to: ${text.slice(0, 140)}. Studio asked; their time reply goes to the customer with buttons.`, s.phone);
          s.step = "human"; await saveSession(s);
        }
        break;
      }
      case "human": {
        if (text) {
          const num = s.phone.replace(/[^0-9]/g, "");
          await notifyJordanWa(`${s.wa_name || "+" + num} (waiting for a person) wrote: ${text.slice(0, 160)}`, s.phone);
          const prefill = await customerPrefill(s.phone);
          await founderCard(`💬 ${s.wa_name || "+" + num}: ${text.slice(0, 50)}`, {
            badge: "HUMAN MODE",
            title: `${s.wa_name || "Customer"} wrote`,
            paras: [`+${num} is in human mode (waiting for a person). Their message:`],
            quote: text,
            waNum: num,
            prefill,
            to: JORDAN,
          });
        }
        break;
      }
      case "done": {
        // Post-booking small talk: answer what we can instead of spamming the menu.
        const bare = (text || "").replace(/[^\p{L}\p{N}]/gu, "");
        if (text && /(how much|price|cost|rates?|cu[aá]nto|precio|cuesta|tarifa)/i.test(text)) {
          await sendText(from, COPY[L].priceInfo);
        } else if (text && (bare === "" || /^(ok|okay|okey|vale|si|sí|yes|great|perfect|perfecto|genial|gracias|thanks|thankyou|thx)$/i.test(bare))) {
          await sendText(from, COPY[L].ackReply);
        } else if (text && (() => { const fresh = { phone: s.phone, step: s.step, wa_name: s.wa_name, data: { lang: s.data.lang || "", known: s.data.known || null, adRef: s.data.adRef || null } }; if (absorbSentence(fresh, text, L)) { s.data = fresh.data; return true; } return false; })()) {
          // v39: a new request typed after a finished one ("otro masaje el sábado").
          // The finished booking's answers are cleared first so the sentence is read fresh.
          await continueFromKnown(s, from, L);
        } else if (text && (/\?/.test(text) || text.trim().split(/\s+/).length >= 3)) {
          // v39: a question we cannot place gets an answer and the menu, never a hand-off.
          await sendText(from, COPY[L].noHuman);
          await notifyJordanWa(`${s.wa_name || "+" + digitsOf(from)} (after booking) wrote: ${text.slice(0, 140)}. Bot answered with help + menu.`, from);
          await sendMenu(from, L);
        } else {
          await sendMenu(from, L);
        }
        break;
      }
      default: {
        s.step = "await_service"; await saveSession(s); await askService(from, L);
      }
    }
  } catch (e) { console.log("[wa] handler error", String(e)); }

  return new Response("OK", { status: 200 });
};
