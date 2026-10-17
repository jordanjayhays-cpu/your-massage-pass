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

import { LOST_ES_RE, NO_ENGLISH_RE, genderWanted, genderBare, offerMatchesAsk, CONFIRM_LATER_RE, confirmLaterRemindAt, EMAIL_REFUSE_RE, firstNameFromProfile, parseQuotedPrice, euro, dayLabelFor, parseName, HOME_VISIT_RE, LINK_ONLY_RE, studioGenderReply, JORDAN_MAIN_NUMBER, AD_OPENER_RE, UNSURE_RE, ZONEQ_RE, detectDay, detectTime, strongSpanish, isEmail, stripAcc, TIME_RE, BACK_RE, HI_RE, BOOKAGAIN_RE, digitsOf, CHANGE_RE, GOODBYE_RE, CANCEL_RE, ARRIVED_RE, NOSHOW_RE, mcMadridHour, parseOfferedTime, parseOfferedTimes, AUTOREPLY_RE, EMAIL_IN_TEXT_RE, EROTIC_RE, MODESTY_RE, BLOCK_LINE_EN, BLOCK_LINE_ES, JOB_RE, ANY_RE, OTHERTYPE_RE, PRICEQ_RE, PHOTOQ_RE, QUESTION_RE, looksLikeQuestion, HOWWORKS_RE, SERVICEQ_RE, ACK_ONLY_RE, MAIN_SERVICES, MORE_SERVICES, ALL_SERVICES, SVC_ES, trSvc, trSvcLow, AREAS, AREA_ROWS, HOURS, COPY, SERVICE_HINTS, detectService, detectArea, askBand, madridInstant, madridMidnight, resolveRequestDate } from "https://raw.githubusercontent.com/jordanjayhays-cpu/your-massage-pass/6715b8a/supabase/functions/wa-bot/copy.ts";
import { readMessage, type Reading as Reading2 } from "./read.ts";
import { runCoreTurn, coreTakes, parseCoreMode, validateDetails, madridCalendar, DAY_CLEARS, CORE_MODEL, type CoreCtx, type CoreMode, type CoreBooking, type StudioPick } from "./agent_core.ts";
const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
let RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
let AI_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const AI_MODEL = "claude-haiku-4-5-20251001";
// The shared secrets for this project live in app_secrets, the way CRON_KEY and
// the LinkedIn keys already do, so the key is read from there when it is not in
// the environment. Looked up once per worker, then held in memory.
let aiKeyChecked = false;
async function aiKey(): Promise<string> {
  if (AI_KEY || aiKeyChecked) return AI_KEY;
  aiKeyChecked = true;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_secrets?key=eq.ANTHROPIC_API_KEY&select=value&limit=1`, { headers: H() });
    const rows = await r.json().catch(() => []);
    AI_KEY = Array.isArray(rows) && rows[0]?.value ? String(rows[0].value).trim() : "";
  } catch (e) {
    console.log("[wa] ai key lookup failed", String(e));
  }
  return AI_KEY;
}
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const SUPPORT = ["support@massageclub.io"];
const JORDAN = ["jordan@massageclub.io", "jordanjayhays@gmail.com"]; // v39: "wants a person" must reach the Gmail too (Jordan, 5 Sept)
const LOGO_URL = "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/branding/mc-avatar-cream.png";
let OPS_KEY = Deno.env.get("MC_OPS_KEY") || "";
// v124 (25 Sept): the day-before reminder ships OFF. It is a new automated
// message to a customer, and Jordan's standing rule is that those are his call,
// not mine. The detection, the schedule and the founder card all run either way
// so he can see what it would have done; only the message to the customer is
// behind this. Turn it on with start({ confirmLaterReminders: true }) in the
// loader, the same shape as the studio outreach pause in dispatch-studios.
let CONFIRM_LATER_REMINDERS = false;
// v204 (12 Oct): the follow-up on an unanswered studio offer, and its honest
// lapse, ship ON. Jordan said yes to it on 12 Oct ("Yes to the follow-up
// messages in change 1"). start({ offerChase: false }) in the loader turns it
// off without a code change.
let OFFER_CHASE = true;
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

// v163 (5 Oct): voice notes. Four customers sent them this week and all the
// bot could say was "I can only read text"; +34 610 393 816 sent eight in a
// row. Each one is now saved (storage bucket wa-media, private) so Jordan can
// play it on the reply page, and transcribed when a speech-to-text key is set
// in app_secrets: TRANSCRIBE_API_KEY, optionally TRANSCRIBE_URL and
// TRANSCRIBE_MODEL (any OpenAI-compatible endpoint; the default is Groq's
// whisper-large-v3, an open-weight model). A transcript is then read exactly
// as if they had typed it.
async function appSecret(key: string): Promise<string> {
  // An Edge Function secret (Supabase dashboard, Edge Functions, Secrets)
  // works too and wins over the app_secrets table.
  const env = Deno.env.get(key);
  if (env) return env.trim();
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_secrets?key=eq.${encodeURIComponent(key)}&select=value&limit=1`, { headers: H() });
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows[0]?.value ? String(rows[0].value).trim() : "";
  } catch { return ""; }
}
async function handleVoice(mediaId: string, from: string): Promise<{ path: string | null; transcript: string }> {
  let path: string | null = null, transcript = "";
  try {
    const meta = await (await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${WA_TOKEN}` } })).json().catch(() => ({}));
    if (!meta?.url) return { path, transcript };
    const audio = await fetch(String(meta.url), { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
    if (!audio.ok) return { path, transcript };
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const mime = String(meta.mime_type || "audio/ogg").split(";")[0];
    const ext = /mpeg|mp3/.test(mime) ? "mp3" : /mp4|m4a|aac/.test(mime) ? "m4a" : /amr/.test(mime) ? "amr" : "ogg";
    const p = `${digitsOf(from)}/${Date.now()}.${ext}`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/wa-media/${p}`, { method: "POST", headers: { ...H(), "Content-Type": mime, "x-upsert": "true" }, body: bytes });
    if (up.ok) path = p; else console.log("[wa] voice upload failed", up.status, (await up.text()).slice(0, 200));
    const key = await appSecret("TRANSCRIBE_API_KEY");
    if (key) {
      const fd = new FormData();
      fd.append("file", new Blob([bytes], { type: mime }), `voice.${ext}`);
      fd.append("model", (await appSecret("TRANSCRIBE_MODEL")) || "whisper-large-v3");
      fd.append("response_format", "json");
      const t = await fetch((await appSecret("TRANSCRIBE_URL")) || "https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd, signal: AbortSignal.timeout(20000),
      });
      const j = await t.json().catch(() => ({}));
      transcript = String(j?.text || "").trim().slice(0, 1500);
      if (!t.ok) console.log("[wa] transcription failed", t.status, JSON.stringify(j).slice(0, 200));
    } else if (["ogg", "mp3", "m4a"].includes(ext)) {
      // v181 (Jordan, 6 Oct: no new Groq account). Transcribe through the
      // OpenRouter credits already paid for: Gemini Flash-Lite hears audio,
      // tested on an OGG/Opus Spanish note at 1.2 s and $0.0001 a note.
      const orKey = await appSecret("OPENROUTER_API_KEY");
      if (orKey) {
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const t = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST", signal: AbortSignal.timeout(20000),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${orKey}`, "HTTP-Referer": "https://book.massageclub.io", "X-Title": "Massage Club bot" },
          body: JSON.stringify({ model: (await appSecret("TRANSCRIBE_MODEL_OR")) || "google/gemini-2.5-flash-lite", temperature: 0, messages: [{ role: "user", content: [
            { type: "text", text: "Transcribe this WhatsApp voice note exactly, in its original language. Return only the transcript. If there is no speech, return nothing." },
            { type: "input_audio", input_audio: { data: btoa(bin), format: ext } },
          ] }] }),
        });
        const j = await t.json().catch(() => ({}));
        const out = String(j?.choices?.[0]?.message?.content || "").trim();
        transcript = /^\[?(no speech|silence|inaudible|sin voz)/i.test(out) ? "" : out.slice(0, 1500);
        if (!t.ok) console.log("[wa] openrouter transcription failed", t.status, JSON.stringify(j).slice(0, 200));
      }
    }
  } catch (e) { console.log("[wa] voice note failed", String(e)); }
  return { path, transcript };
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

// v87 (Jordan, 12 Sept): "always respond, never be the last one to message".
// Twelve threads had drifted with their message last and ours never sent, some
// for twelve days, including a partner studio complaining about a no-show. The
// rule is worthless as a memo, so it is enforced: every send flips this, and the
// handler checks it before it finishes. Reset per webhook, not per process.
let sentThisTurn = false;
// v204 (12 Oct): a turn where saying nothing is the decision: the customer is
// answering Jordan and the bot is not sure (founderContextTurn), or a second
// voice note failed inside ten minutes and the first already got the line.
// Jordan has been pinged either way, so the fallback below stays out of it.
let quietThisTurn = false;
// v209 (Jordan, 15 Oct: "dont' send anything to brandon, keep sending for
// Brandon to top tier massage places in Salamanca"). A held customer gets
// nothing automatic from the bot, WhatsApp or email. Studio offers for them go
// to Jordan as a card (forwardOffer) and the studio is told we are checking
// with the client. Jordan's own sends from the reply page still go out.
const HOLD_CUSTOMERS = new Set(["15102901422"]);
const HOLD_EMAILS = new Set(["brandon.k.brooks@gmail.com"]);
const heldNum = (to: unknown) => HOLD_CUSTOMERS.has(digitsOf(String(to || "")));
const heldMail = (to: unknown) => HOLD_EMAILS.has(String(to || "").trim().toLowerCase());

// v212: why the last send failed, as Meta put it, so a caller can tell a
// template Meta does not have or has not approved yet (TPL_NOT_LIVE) from a
// real fault, and fall back to the approved one only for the first.
let lastWaError = "";
const TPL_NOT_LIVE = /132001|template|does not exist|not found|not approved/i;
async function waSend(to: string, payload: Record<string, unknown>, logBody: string, type: string, opts: { manual?: boolean } = {}) {
  lastWaError = "";
  if (!opts.manual && heldNum(to)) { console.log("[wa] held customer, not sent:", digitsOf(to), logBody.slice(0, 80)); lastWaError = "held"; return false; }
  // v197: a customer who writes in another language reads every message in it.
  // Jordan's own replies from the reply page go out exactly as he wrote them.
  const xl = opts.manual ? "" : (XLANG.get(digitsOf(to)) || "");
  if (xl) {
    const tr = await translatePayload(xl, payload);
    if (tr) { payload = tr.payload; logBody = tr.logBody; }
  }
  // v197: never the same message twice in a row. Alexandru sent "Traslator"
  // and "Romano" two seconds apart and got "Which day suits you?" twice, three
  // times over two days; each message ran the whole flow on its own.
  if (await sameAsLastOut(to, logBody, SAME_OUT_MS)) {
    console.log("[wa] skipped a repeat of the last message to", digitsOf(to));
    sentThisTurn = true;
    return true;
  }
  const res = await fetch(GRAPH, {
    method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
  });
  if (!res.ok) { const why = (await res.text()).slice(0, 300); lastWaError = why || String(res.status); console.log("[wa] send failed", res.status, why); }
  else { sentThisTurn = true; await logMsg(to, "out", logBody, type); studioCopyLater(to, "WhatsApp", logBody); }
  return res.ok;
}

// v210 (Jordan, 16 Oct): "i want to get emails of the messages sent to
// studios, every single one ... i see a weird message not a normal message".
// Every message a studio receives from the bot, by WhatsApp or by email, is
// copied to Jordan as its own card: the Spanish exactly as the studio read it,
// the English under it, and the button to answer that studio as the bot. It
// runs after the send, so a slow translation never holds up the studio.
const studioCache = new Map<string, { id: string; business_name: string } | null>();
async function studioAt(num: string): Promise<{ id: string; business_name: string } | null> {
  const d = digitsOf(num);
  if (studioCache.has(d)) return studioCache.get(d) || null;
  const p = d.length >= 9 ? await findPartnerByNumber(d).catch(() => null) : null;
  studioCache.set(d, p);
  return p;
}
function studioCopyLater(to: string, channel: "WhatsApp" | "Email", logBody: string, o: { studio?: { business_name: string }; subject?: string } = {}) {
  const run = copyStudioSend(to, channel, logBody, o).catch((e) => console.log("[wa] studio copy failed", String(e)));
  try { (globalThis as any).EdgeRuntime?.waitUntil?.(run); } catch { /* runs anyway */ }
}
async function copyStudioSend(to: string, channel: "WhatsApp" | "Email", logBody: string, o: { studio?: { business_name: string }; subject?: string }) {
  const studio = o.studio || await studioAt(to);
  if (!studio || /\b(prueba|test)\b/i.test(studio.business_name)) return;
  let shown = prettyLogged(logBody).trim();
  let buttons = "";
  const b = /\s*\[([^\]]*\/[^\]]*)\]\s*$/.exec(shown);
  if (b) { buttons = b[1].split("/").map((x) => x.trim()).filter(Boolean).join("  ·  "); shown = shown.slice(0, b.index).trim(); }
  const en = await translateOut("en", shown, []).catch(() => null);
  const first = shown.replace(/\s+/g, " ").slice(0, 70);
  await founderCard(`📤 ${studio.business_name}: ${first}${shown.length > 70 ? "…" : ""}`, {
    badge: channel === "Email" ? "EMAIL TO A STUDIO" : "WHATSAPP TO A STUDIO",
    title: `What ${studio.business_name} just got`,
    paras: o.subject ? [`Subject: ${o.subject}`] : [],
    quote: shown,
    after: [buttons ? `Buttons they can tap: ${buttons}` : "", en && en.body !== shown ? `In English: ${en.body}` : ""],
    waNum: digitsOf(to).length >= 9 ? to : "",
    to: ["jordan@massageclub.io"],
  });
}
const sendText = (to: string, body: string, opts: { manual?: boolean } = {}) => waSend(to, { type: "text", text: { body, preview_url: false } }, body, "text", opts);
const sendButtons = (to: string, body: string, buttons: Array<{ id: string; title: string }>, opts: { manual?: boolean } = {}) =>
  waSend(to, { type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) } } }, body + " [" + buttons.map((b) => b.title).join("/") + "]", "buttons", opts);
const sendList = (to: string, body: string, button: string, rows: Array<{ id: string; title: string; description?: string }>) =>
  waSend(to, { type: "interactive", interactive: { type: "list", body: { text: body }, action: { button: button.slice(0, 20), sections: [{ title: "Massage Club", rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: r.title.slice(0, 24), description: (r.description || "").slice(0, 72) })) }] } } }, body + " [" + rows.map((r) => r.title).join("/") + "]", "list");
// v197 (10 Oct, Jordan: "can you respond in romanian please for him?").
// Alexandru came in from the ad writing Romanian. Over two days he wrote ten
// messages, most of them some form of "Traslator. Romano", and was answered
// "Sorry, I did not catch that" four times, "We can help in English or Spanish
// only" once, and "Which day suits you?" eleven times. Jordan ended up writing
// to him in Romanian by hand at four in the morning.
//
// The flow keeps running in English or Spanish internally, so every rule,
// parser and piece of approved copy stays exactly as it is. What changes is the
// last step: while a customer's session carries xlang, waSend translates what
// is about to go out (the text, the button titles, the list rows) into their
// language. Button ids never change, so a tap means what it always meant, and
// the reader already understands any language on the way in. A failed or slow
// translation sends the original rather than nothing.
const XLANG = new Map<string, string>();
const XLANG_NAMES: Record<string, string> = {
  ro: "Romanian", pt: "Portuguese", fr: "French", it: "Italian", de: "German", nl: "Dutch", pl: "Polish",
  ru: "Russian", uk: "Ukrainian", ar: "Arabic", zh: "Simplified Chinese", ja: "Japanese", ko: "Korean",
  tr: "Turkish", hi: "Hindi", bn: "Bengali", ur: "Urdu", ca: "Catalan", el: "Greek", bg: "Bulgarian",
  sq: "Albanian", hu: "Hungarian", cs: "Czech", sv: "Swedish", fa: "Persian", he: "Hebrew", vi: "Vietnamese",
  tl: "Tagalog", id: "Indonesian", th: "Thai", ka: "Georgian", hy: "Armenian", az: "Azerbaijani",
};
const xlName = (code: string) => XLANG_NAMES[code] || `the language with ISO 639-1 code "${code}"`;
const XLATE_SYSTEM = (lang: string) => `You translate WhatsApp messages that Massage Club, a service in Madrid that books massages at professional studios, sends to a customer. Translate into ${lang}.
Rules:
- Translate the meaning naturally and warmly, as a person would write it in a chat. Use the informal "you".
- Keep exactly as they are: numbers, prices, "EUR", clock times, URLs, email addresses, emoji, line breaks, studio names, street names, Madrid area names, and the sign-off "Massage Club".
- Add nothing and leave nothing out. Never use em dashes or en dashes.
- The input is JSON: {"body": "...", "labels": [{"text": "...", "max": 20}]}. Labels are button or list titles; each translated label must be at most "max" characters, so shorten if needed.
- Reply with JSON only, in the same shape: {"body": "...", "labels": ["...", "..."]}.`;
const xlCache = new Map<string, { body: string; labels: string[] }>();
async function translateOut(lang: string, body: string, labels: Array<{ text: string; max: number }>): Promise<{ body: string; labels: string[] } | null> {
  const ck = `${lang}|${body}|${labels.map((l) => l.text).join("|")}`;
  const hit = xlCache.get(ck);
  if (hit) return hit;
  const key = await aiKey();
  if (!key || !body.trim()) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 1500, temperature: 0, system: XLATE_SYSTEM(xlName(lang)), messages: [{ role: "user", content: JSON.stringify({ body, labels }) }] }),
    });
    clearTimeout(timer);
    if (!res.ok) { console.log("[wa] translate http", res.status); return null; }
    const out = await res.json();
    const raw = String(out?.content?.[0]?.text || "");
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const b = noDashes(String(j?.body || "")).trim();
    // The model sometimes answers labels in the input's own shape ({text, max});
    // on the test copy that went out as a button reading "[object Object]".
    const ls: string[] = Array.isArray(j?.labels) ? j.labels.map((x: any) => noDashes(String(x && typeof x === "object" ? (x.text ?? "") : (x ?? ""))).trim()) : [];
    if (!b || ls.length !== labels.length || [b, ...ls].some((x) => /\[object |undefined|null/.test(x))) return null;
    const r = { body: b, labels: ls.map((x, i) => (x || labels[i].text).slice(0, labels[i].max)) };
    xlCache.set(ck, r);
    if (xlCache.size > 300) xlCache.delete(xlCache.keys().next().value as string);
    return r;
  } catch (e) {
    console.log("[wa] translate failed", String(e));
    return null;
  }
}
// The payload shapes waSend carries to customers: text, reply buttons, a list,
// a location request. Anything else (a flow form, a template) goes as it is.
async function translatePayload(lang: string, payload: Record<string, any>): Promise<{ payload: Record<string, unknown>; logBody: string } | null> {
  const p = JSON.parse(JSON.stringify(payload));
  if (p.type === "text" && p.text?.body) {
    const t = await translateOut(lang, String(p.text.body), []);
    if (!t) return null;
    p.text.body = t.body;
    return { payload: p, logBody: t.body };
  }
  const it = p.type === "interactive" ? p.interactive : null;
  if (!it || !it.body?.text) return null;
  if (it.type === "button") {
    const btns = it.action.buttons as Array<{ reply: { title: string } }>;
    const t = await translateOut(lang, String(it.body.text), btns.map((b) => ({ text: b.reply.title, max: 20 })));
    if (!t) return null;
    it.body.text = t.body;
    btns.forEach((b, i) => { b.reply.title = t.labels[i]; });
    return { payload: p, logBody: t.body + " [" + t.labels.join("/") + "]" };
  }
  if (it.type === "list") {
    const rows = (it.action.sections?.[0]?.rows || []) as Array<{ title: string; description?: string }>;
    const labels = [{ text: String(it.action.button), max: 20 }, ...rows.map((r) => ({ text: r.title, max: 24 })), ...rows.filter((r) => r.description).map((r) => ({ text: String(r.description), max: 72 }))];
    const t = await translateOut(lang, String(it.body.text), labels);
    if (!t) return null;
    it.body.text = t.body;
    it.action.button = t.labels[0];
    rows.forEach((r, i) => { r.title = t.labels[1 + i]; });
    let k = 1 + rows.length;
    rows.forEach((r) => { if (r.description) r.description = t.labels[k++]; });
    return { payload: p, logBody: t.body + " [" + rows.map((r) => r.title).join("/") + "]" };
  }
  if (it.type === "cta_url") {
    const t = await translateOut(lang, String(it.body.text), [{ text: String(it.action.parameters.display_text), max: 20 }]);
    if (!t) return null;
    it.body.text = t.body;
    it.action.parameters.display_text = t.labels[0];
    return { payload: p, logBody: t.body + " [" + t.labels[0] + ": " + String(it.action.parameters.url) + "]" };
  }
  if (it.type === "location_request_message") {
    const t = await translateOut(lang, String(it.body.text), []);
    if (!t) return null;
    it.body.text = t.body;
    return { payload: p, logBody: t.body + " [share location]" };
  }
  return null;
}
// v197: the same message to the same number inside 30 seconds is a repeat,
// whatever else went out in between (a text and its buttons come as a pair, and
// a delivery report is logged as an outgoing line).
const SAME_OUT_MS = 30_000;
async function sameAsLastOut(to: string, logBody: string, ms: number): Promise<boolean> {
  try {
    const since = new Date(Date.now() - ms).toISOString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${encodeURIComponent(digitsOf(to))}&direction=eq.out&created_at=gte.${since}&order=created_at.desc&limit=8&select=body`, { headers: H() });
    const rows = await r.json().catch(() => []);
    const want = logBody.slice(0, 2000);
    return Array.isArray(rows) && rows.some((x: { body?: string }) => String(x.body || "") === want);
  } catch { return false; }
}
// v197: which language a customer is writing in, when it is neither English
// nor Spanish. Asking for a language is the plainest signal there is ("Romano",
// "Traslator. Romano"); letters Spanish and English never use are the next
// (Alexandru's very first message was "Bună. Seara"), and then the reader,
// which names the language. Only a plain request ("English please", "en
// español") switches it back: Alexandru also wrote "Si" and "Una. Foto", and a
// couple of Spanish words are not a change of language.
const LANG_CUES: Array<[RegExp, string]> = [
  [/\b(rom[aâ]n[aăo]?(?![a-zăâîșț])|romanian|rumano|rumana)/i, "ro"], [/\b(portugu[eê]s|portuguese)\b/i, "pt"],
  [/\b(italiano|italian)\b/i, "it"], [/\b(fran[cç]ais|french|franc[eé]s)\b/i, "fr"], [/\b(deutsch|german|alem[aá]n)\b/i, "de"],
  [/(\brussian\b|\bruso\b|русск)/i, "ru"], [/(\barabic\b|[aá]rabe\b|عربي|العربية)/i, "ar"], [/\b(polski|polish|polaco)\b/i, "pl"],
  [/(\bukrainian\b|\bucraniano\b|україн)/i, "uk"], [/(\bchinese\b|\bchino\b|中文)/i, "zh"], [/\b(t[uü]rk[cç]e|turkish|turco)\b/i, "tr"],
];
const BACK_CUES: Array<[RegExp, string]> = [[/\b(english|ingl[eé]s)\b/i, "en"], [/\b(espa[nñ]ol|spanish|castellano)\b/i, "es"]];
const TRANSLATOR_RE = /\b(tra[ns]{0,2}lat\w*|tradu[cz]\w*|traslat\w*|traduc[aă]tor|in\s+my\s+language|en\s+mi\s+idioma)/i;
const FOREIGN_CHARS_RE = /[ăâîșțşţãõàèìòùêôûëïœæøåäößąćęłńśźżčďěňřšťůžőű\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/i;
// Letters that belong to one language only name it at once, with no wait for
// the reader. On the test copy the reader took six seconds on a cold first
// message and "Bună. Seara" was answered in English before it came back.
const SCRIPT_LANG: Array<[RegExp, string]> = [
  // Only letters that point at one language; Arabic script, Cyrillic, ä/ö
  // and the like are shared by several, so those wait for the reader.
  [/[ășțşţ]/i, "ro"], [/[ãõ]/i, "pt"], [/[ąęłśźż]/i, "pl"], [/[\u0370-\u03FF]/, "el"], [/[\u0590-\u05FF]/, "he"],
  [/[\u3040-\u30FF]/, "ja"], [/[\uAC00-\uD7AF]/, "ko"], [/[\u4E00-\u9FFF]/, "zh"], [/[\u0E00-\u0E7F]/, "th"],
];
const scriptLang = (t: string): string => { for (const [re, c] of SCRIPT_LANG) if (re.test(t)) return c; return ""; };
function langAsked(text: string): string {
  const t = String(text || "").replace(/\s*\[via ad\]$/i, "").trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  if (!t || (words > 4 && !TRANSLATOR_RE.test(t))) return "";
  for (const [re, code] of [...BACK_CUES, ...LANG_CUES]) if (re.test(t)) return code;
  return "";
}
async function settleForeignLang(s: Session, from: string, text: string): Promise<void> {
  try {
    const asked = langAsked(text);
    let code = "";
    if (asked === "en" || asked === "es") {
      if (s.data.xlang) {
        delete s.data.xlang;
        s.data.lang = asked;
        await saveSession(s);
        await logEvent(from, "xlang_cleared", { to: asked, text: text.slice(0, 80) });
      }
      return;
    }
    if (asked) code = asked;
    else if (!s.data.xlang && FOREIGN_CHARS_RE.test(text)) {
      code = scriptLang(text);
      if (!code) {
        const rd = await readingFor(from, text, 9000);
        if (rd && rd.language === "other" && rd.language_code && !["en", "es"].includes(rd.language_code)) code = rd.language_code;
      }
    }
    if (code && code !== s.data.xlang) {
      s.data.xlang = code;
      await saveSession(s);
      await logEvent(from, "xlang_set", { lang: code, text: text.slice(0, 80) });
      await notifyJordanWa(`+${digitsOf(from)} writes in ${xlName(code)}. The bot now answers them in ${xlName(code)}.`, from).catch(() => {});
    }
  } catch (e) { console.log("[wa] foreign language check failed", String(e)); }
}
// v128 (25 Sept): WhatsApp Flows. The booking flow is six questions asked one
// at a time, and 39 of the 85 people who have ever written are frozen at the
// first or second of them. A Flow is one form inside WhatsApp: every field on
// screen at once, each one labelled. Hatem could not have been a question
// behind, because there is no queue. Andres could not have typed "Y tu" into
// the email box, because it is a labelled field.
//
// "Massage booking v1", flow 2519994188477304, is built and validates clean.
// SENDING IS OFF until the loader passes bookingFlowId, because the flow is
// still DRAFT and sending a draft fails. The REPLY handler below is always on:
// it costs nothing and means the moment the flow is published, a completed form
// is read correctly rather than falling through as an unknown message.
let BOOKING_FLOW_ID = "";
const FLOW_SERVICE: Record<string, string> = {
  relaxing: "svc_relax", deep_tissue: "svc_deep", thai: "svc_thai",
  sports: "svc_sports", hot_stone: "svc_stone", unsure: "svc_unsure",
};
const FLOW_AREA: Record<string, string> = {
  centro: "Centro", chamberi: "Chamberí", salamanca: "Salamanca", retiro: "Retiro",
  chamartin: "Chamartín", malasana: "Malasaña", other: "", anywhere: "anywhere",
};
const FLOW_TIME: Record<string, string> = {
  morning: "time_morning", afternoon: "time_afternoon", evening: "time_evening", flexible: "",
};
// v156 (5 Oct, Jordan): "like the website, picking the time and then a back up
// time." The form asks the day from real dates, the way the website wizard
// does, so the dates are built here each time the form is sent and travel in
// flow_action_payload. Ids are Madrid ISO dates; "flexible" and, for the
// backup list, "none". Same rule as the day buttons: after 19:00 there is no
// "today" left to sell.
const ISO_MADRID = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
const FLOW_DAY_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" });
function flowDays() {
  const days: Array<{ id: string; title: string; description?: string }> = [];
  for (let i = mcMadridHour() >= 19 ? 1 : 0; i <= 6; i++) {
    const t = new Date(Date.now() + i * 86400e3);
    const label = FLOW_DAY_FMT.format(t).replace(/,/g, "");
    if (i === 0) days.push({ id: ISO_MADRID.format(t), title: "Today", description: label });
    else if (i === 1) days.push({ id: ISO_MADRID.format(t), title: "Tomorrow", description: label });
    else days.push({ id: ISO_MADRID.format(t), title: label });
  }
  days.push({ id: "flexible", title: "I am flexible", description: "Whenever a studio has room" });
  // 5 Oct (Jordan): no backup day; the studio is asked for exactly this time.
  return { days };
}
// A day the form sent back. Today and tomorrow keep their words plus the date
// (the date is what the studio reads, v50); a later day is its full date. A
// date already past (the form was opened yesterday) is no answer at all.
function flowDay(id: string, L: string): { day: string; dayDate: string | null; es: string } | null {
  if (id === "flexible") return { day: L === "es" ? "Cualquier día (flexible)" : "Any day (flexible)", dayDate: null, es: "cualquier día (flexible)" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
  const t = new Date(id + "T12:00:00Z");
  const plus = Math.round((t.getTime() - new Date(ISO_MADRID.format(new Date()) + "T12:00:00Z").getTime()) / 86400e3);
  if (!(plus >= 0)) return null;
  const long = (L === "es" ? LONG_ES : LONG_EN).format(t).replace(/,/g, "");
  const es = LONG_ES.format(t).replace(/,/g, "");
  if (plus === 0) return { day: L === "es" ? "Hoy" : "Today", dayDate: long, es: `hoy, ${es}` };
  if (plus === 1) return { day: L === "es" ? "Mañana" : "Tomorrow", dayDate: long, es: `mañana, ${es}` };
  return { day: long, dayDate: null, es };
}
// Chip ids are start hours ("18"). An old form (v4) answered with a band id.
function flowHours(v: unknown, isToday: boolean): string[] {
  const ids = Array.isArray(v) ? v.map(String) : (v ? [String(v)] : []);
  const out: string[] = [];
  for (const id of ids) {
    const band = FLOW_TIME[id];
    if (band) { out.push(HOURS[band].hours[0]); continue; }
    const h = Number(id);
    if (!Number.isInteger(h) || h < 9 || h > 21) continue;
    if (isToday && h <= mcMadridHour()) continue;
    out.push(`${h}:00`);
  }
  return [...new Set(out.filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b)).slice(0, 3);
}
const sendBookingFlow = (to: string, L: string) =>
  waSend(to, {
    type: "interactive",
    interactive: {
      type: "flow",
      body: { text: COPY[L].flowBody },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: `mc-${to}-${Date.now()}`,
          flow_id: BOOKING_FLOW_ID,
          flow_cta: COPY[L].flowCta,
          flow_action: "navigate",
          flow_action_payload: { screen: "SERVICE", data: flowDays() },
        },
      },
    },
  }, COPY[L].flowBody + " [flow: " + COPY[L].flowCta + "]", "flow");

const sendLocationRequest = (to: string, body: string) =>
  waSend(to, { type: "interactive", interactive: { type: "location_request_message", body: { text: body }, action: { name: "send_location" } } }, body + " [share location]", "location_request");

type Session = { phone: string; step: string; data: Record<string, any>; wa_name?: string };
async function getSession(phone: string): Promise<Session> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?phone=eq.${encodeURIComponent(phone)}&select=*`, { headers: H() });
  const rows = await r.json().catch(() => []);
  if (Array.isArray(rows) && rows[0]) {
    XLANG.set(digitsOf(phone), String(rows[0].data?.xlang || ""));
    return { phone, step: rows[0].step, data: rows[0].data || {}, wa_name: rows[0].wa_name };
  }
  return { phone, step: "start", data: {} };
}
async function saveSession(s: Session) {
  XLANG.set(digitsOf(s.phone), String(s.data?.xlang || ""));
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
// v212: `max` is the longest a blank may be. 300 as before; the v2 studio
// notes carry whole sentences and take more.
async function sendTemplate(to: string, name: string, lang: string, params: string[], payloads: string[] = [], logBody = "", max = 300) {
  const components: any[] = [{ type: "body", parameters: params.map((p) => ({ type: "text", text: tp(p, max) })) }];
  payloads.forEach((p, i) => components.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload: p }] }));
  return waSend(to, { type: "template", template: { name, language: { code: lang }, components } }, `[template ${name}/${lang}] ${logBody || params.join(" | ")}`, "template");
}


// v81: three buttons, not a nine row list. A WhatsApp list is a menu the
// customer has to open before they can answer, and 12 of the 53 people who ever
// wrote to us stopped at exactly this question. Cutting choices to three is the
// single best evidenced change available here. Everything else, including the
// undecided, lives behind "Something else", which opens the full list, so
// nothing is lost and the three easy answers stay one tap away.
// v128: when a Flow is configured this is one form instead of six questions.
// Falls back to the buttons whenever no flow is published, so nothing depends
// on it existing.
const askService = (to: string, L: string) =>
  BOOKING_FLOW_ID ? sendBookingFlow(to, L) : sendButtons(to, COPY[L].intro, COPY[L].introBtns);
// "Something else" now carries the undecided as well as the rarer massages, so
// "Help me figure it out" leads the list rather than hiding at the bottom of it.
const askServiceMore = (to: string, L: string) =>
  sendList(to, COPY[L].moreTitle, COPY[L].introBtn, [
    { id: "svc_unsure", title: L === "es" ? "Ayúdame a elegir" : "Help me figure it out", description: L === "es" ? "sin respuestas incorrectas" : "no wrong answers" },
    ...MAIN_SERVICES.filter((s) => !["svc_relax", "svc_deep", "svc_unsure"].includes(s.id)).map((s) => ({ id: s.id, title: L === "es" ? s.tEs : s.tEn, description: "" })),
    ...MORE_SERVICES.map((s) => ({ id: s.id, title: L === "es" ? s.tEs : s.tEn, description: "" })),
    // No language row here on purpose: 1 + 3 + 6 is exactly the 10 rows a
    // WhatsApp list allows, and an eleventh would be silently dropped by the
    // slice in sendList rather than refused. Switching language still works by
    // typing "español" or "English", and the row is on the main menu.
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
// v127 (25 Sept, live): never offer a day that is already over. At 21:25
// tonight a Facebook lead was offered "Today (Fri 25)", took it, was then
// offered "Afternoon (13-18)" and took that too. Every studio in Madrid had
// been shut for hours. He spent four taps building a request that could not
// exist. A massage has to finish by 21:00 and needs an hour plus notice, so
// after 19:00 Madrid there is no "today" left to sell and the button goes.
const dayBtns = (L: string) => {
  const btns = [
    { id: "day_today", title: `${L === "es" ? "Hoy" : "Today"} (${shortDate(L, 0)})` },
    { id: "day_tomorrow", title: `${L === "es" ? "Mañana" : "Tomorrow"} (${shortDate(L, 1)})` },
    { id: "day_other", title: L === "es" ? "Otro día" : "Another day" },
  ];
  return mcMadridHour() >= 19 ? btns.slice(1) : btns;
};
// v188 built the typed-day prompt's example from today. v204 replaced the
// prompt itself with the seven-day list (askDayList, below askDay).
// v60: an email we sent ("your massage is still open") carries a code. When
// they tap through, WhatsApp opens with that code already typed, so the very
// first thing the bot sees identifies their request. Pick the thread back up
// with what they already told us instead of greeting them as a stranger.
const RESUME_RE = /\bMC-(R\d{1,6}|C\d{4,8})\b/i;
// v61: the code is only in the link for people we have no phone number for.
// Everyone else taps a link that says something a person would actually write,
// and we identify them the way we always could: by the number they wrote from.
const RESUME_PHRASE_RE = /\b(termin[ao]r|acabar|completar|continuar con|seguir con)\s+(mi|la)\s+reserva\b|\bmi reserva de masaje\b|\bfinish (my|the) booking\b|\bcontinue (my|the) booking\b|\bcomplete my booking\b/i;
const RESUME_LINE = (L: string, name: string, svc: string, area: string) =>
  L === "es"
    ? `Hola${name ? " " + name : ""}, seguimos donde lo dejamos: ${svc}${area ? " por " + area : ""}. Pagas en el centro, sin comisión.\n\n¿Qué día te viene bien?`
    : `Hi${name ? " " + name : ""}, picking up where we left off: ${svc}${area ? " around " + area : ""}. You pay the studio, no fee from us.\n\nWhich day works for you?`;

// v160 (5 Oct): the booking page (go.html) ends on "Get my offers on WhatsApp",
// which opens this chat with "...on the website (#104)..." already typed. That
// message is the customer joining the request they just made, and it opens the
// 24 hour window so we can send them the offers. Without this it read as a new
// customer: "Welcome back! What would you like to do? [Book a massage]", and a
// tap there would have started a second request. Only a request made from this
// same number in the last day counts.
const WEB_HANDOFF_RE = /(?:website|la web|web)\b[^#]{0,40}\(#(\d{2,7})\)/i;
async function webHandoff(s: Session, from: string, text: string): Promise<boolean> {
  const m = text.match(WEB_HANDOFF_RE);
  if (!m) return false;
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${m[1]}&client_phone=eq.${encodeURIComponent("+" + digitsOf(from))}&created_at=gte.${since}&select=id,first_name,service_name,day1,area,stage,contact_email,languages&limit=1`, { headers: H() });
  const req = (await r.json().catch(() => []))[0];
  if (!req || ["dismissed", "cancelled"].includes(String(req.stage))) return false;
  const es = strongSpanish(text) || /^hola\b/i.test(text.trim());
  s.data.lang = es ? "es" : "en";
  s.data.webRequest = req.id;
  if (req.contact_email && !s.data.email) s.data.email = req.contact_email;
  if (req.first_name && !s.data.name) s.data.name = String(req.first_name).slice(0, 80);
  s.step = "done"; await saveSession(s);
  await logEvent(from, "web_handoff", { request_id: req.id, stage: req.stage });
  const name = String(req.first_name || "").split(" ")[0];
  const svc = trSvcLow(String(req.service_name || "Massage"), s.data.lang);
  const where = req.area && !/^(anywhere|me da igual|madrid)$/i.test(String(req.area)) ? (es ? ` cerca de ${req.area}` : ` near ${req.area}`) : "";
  await sendText(from, es
    ? `Perfecto${name ? ", " + name : ""}. Tu solicitud #${req.id} ya está con los centros: ${svc}, ${req.day1 || ""}${where}. Te escribo aquí en cuanto uno diga que sí. No se reserva nada hasta que tú lo confirmes. Massage Club`
    : `Got it${name ? ", " + name : ""}. Your request #${req.id} is with the studios: ${svc}, ${req.day1 || ""}${where}. I'll message you here as soon as one says yes. Nothing is booked until you confirm. Massage Club`);
  return true;
}

// v162 (5 Oct, Jordan chose: "WhatsApp bot sends it"): a new chat also gets
// the booking page as a "Book now" button, after the greeting with prices. It
// opens inside WhatsApp's own browser at book.massageclub.io/reserve with their
// number and first name filled in. The chat questions still work for anyone
// who would rather answer here. Once per customer, never to a returning one
// (they get the welcome-back menu) and never when the greeting was held back.
async function sendReservePage(s: Session, from: string) {
  if (s.step === "start" || s.step === "returning_choice" || s.step === "muted" || s.data.pageSent) return;
  const L = s.data.lang === "es" ? "es" : "en";
  const name = firstNameFromProfile(s.wa_name);
  const url = `https://book.massageclub.io/reserve?p=${digitsOf(from)}${name ? "&n=" + encodeURIComponent(name) : ""}&lang=${L}&src=wa`;
  // v198: one line. The only booking confirmed since 5 Oct came through this
  // page, so it stays, but as a short aside rather than a second brochure.
  const body = L === "es"
    ? "¿Prefieres elegirlo tú? Aquí tardas un minuto."
    : "Prefer to pick it all yourself? It takes a minute here.";
  await waSend(from, { type: "interactive", interactive: { type: "cta_url", body: { text: body }, action: { name: "cta_url", parameters: { display_text: L === "es" ? "Reservar ahora" : "Book now", url } } } }, body + " [Book now: " + url + "]", "cta_url");
  s.data.pageSent = true; await saveSession(s);
  await logEvent(from, "reserve_page_sent", { lang: L });
}

// They tapped the link but the text carries no code, so find their own most
// recent request by the number they wrote from.
async function resumeFromPhone(s: Session, from: string): Promise<boolean> {
  const digits = digitsOf(from);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?or=(client_phone.eq.${digits},client_phone.eq.%2B${digits})&order=created_at.desc&limit=1&select=id`, { headers: H() });
    const rows = await r.json().catch(() => []);
    const id = Array.isArray(rows) && rows[0] ? rows[0].id : null;
    return await resumeFromCode(s, from, id ? `R${id}` : `C${digits.slice(-6)}`);
  } catch (e) {
    console.log("[wa] resume by phone failed", String(e));
    return await resumeFromCode(s, from, `C${digits.slice(-6)}`);
  }
}

// Returns true when the code was recognised and answered.
async function resumeFromCode(s: Session, from: string, code: string): Promise<boolean> {
  const m = code.match(/^R(\d+)$/i);
  let req: Record<string, unknown> | null = null;
  if (m) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${m[1]}&select=id,first_name,service_name,day1,time1,area,languages,stage,studio_name&limit=1`, { headers: H() });
    const rows = await r.json().catch(() => []);
    req = Array.isArray(rows) && rows[0] ? rows[0] : null;
  }
  // An unknown code is still someone answering our email, so never fall through
  // to a cold greeting: carry on with whatever the session already knows.
  const L: string = req && req.languages === "es" ? "es" : (s.data.lang === "es" ? "es" : (s.data.lang === "en" ? "en" : "en"));
  s.data.lang = L;
  if (req) {
    const svcId = detectService(String(req.service_name || ""));
    if (svcId) { s.data.service = svcId; s.data.defaultService = false; }
    if (!s.data.area && req.area) s.data.area = String(req.area);
    if (!s.data.known?.name && req.first_name) s.data.known = { ...(s.data.known || {}), name: String(req.first_name) };
    s.data.resumedRequest = req.id;
  }
  if (!s.data.service) { s.data.service = "svc_relax"; s.data.defaultService = true; }
  s.step = "await_day";
  await saveSession(s);
  const name = String(req?.first_name || s.data.known?.name || "").split(" ")[0];
  const svc = trSvcLow(String(req?.service_name || "massage"), L);
  await sendButtons(from, RESUME_LINE(L, name, svc, String(s.data.area || "")), dayBtns(L));
  await logEvent(from, "resumed_from_email", { code, request_id: req?.id ?? null });
  await founderCard(`\u{1F517} ${name || from} came back from the email (${code})`, {
    badge: "EMAIL WORKED",
    title: `${name || from} tapped the link in our email`,
    paras: [`They landed straight at the day question with ${svc} already known. Nothing to do, the bot has it.`],
    waNum: from, waLabel: "Open the chat",
  });
  return true;
}

// v75 (Jordan, 9 Sept): when the first message does not tell us the language,
// open in ENGLISH and let anyone who wants Spanish say so. v72 sent both
// languages at once, which doubled the length of the first screen and put a
// slash through every button title without asking anything extra. The language
// question itself stays gone: their own next words still settle it, so nobody
// is stuck in English by writing back in Spanish.
// v188: the English opener plus this line is now firstLine("en", "es_word").
const dayBtnsBoth = () => dayBtns("en");

// v188 (9 Oct, from reading all 139 conversations): 68 of 114 real prospects
// stopped at the first message and 33 never answered it. Price, "where are
// you" and "who are you" were the three most asked questions. The first
// message now quotes the real listed 60 min relaxing prices and the areas of
// the studios that actually answer us (opener_examples: said yes at least
// once, open on the day), instead of a fixed "45 to 60 EUR" that most offers
// then broke. Studio names still come only with the offer (facts.md rule 12).
// After 19:00, when the Today button is gone, it says so plainly. When the
// studios cannot be read, the old line goes out unchanged.
type OpenerEx = { area: string; price: number; opening_hours: string; yeses: number };
let openerCache: { at: number; rows: OpenerEx[] } | null = null;
const OH_DAY: Record<string, number> = { sun: 0, dom: 0, mon: 1, lun: 1, tue: 2, mar: 2, wed: 3, mie: 3, thu: 4, jue: 4, fri: 5, vie: 5, sat: 6, sab: 6 };
// Same reading of partners.opening_hours as dispatch-studios: null means we
// cannot tell, and unknown hours never rule a studio out.
function openDays(text: unknown): Set<number> | null {
  const raw = stripAcc(String(text || "").toLowerCase()).trim();
  if (!raw) return null;
  const out = new Set<number>();
  for (const seg0 of raw.split(/[,;]|\s+y\s+|\s+and\s+/)) {
    const seg = seg0.trim();
    if (!seg) continue;
    const m = seg.match(/^(.*?)\s*(\d{1,2}(?::\d{2})?)\s*[-–a]\s*(\d{1,2}(?::\d{2})?)\s*h?$/);
    if (!m) return null;
    const dayPart = m[1].trim();
    if (dayPart === "" || /^(daily|todos los dias|every day|diario|cada dia)$/.test(dayPart)) { for (let d = 0; d < 7; d++) out.add(d); continue; }
    for (const tok of dayPart.split(/\s*\/\s*|\s+/)) {
      const range = tok.match(/^([a-z]{3})[a-z]*\s*[-–]\s*([a-z]{3})[a-z]*$/);
      if (range) {
        const a = OH_DAY[range[1]], b = OH_DAY[range[2]];
        if (a === undefined || b === undefined) return null;
        for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; }
      } else {
        const one = tok.match(/^([a-z]{3})[a-z]*\.?$/);
        if (!one || OH_DAY[one[1]] === undefined) return null;
        out.add(OH_DAY[one[1]]);
      }
    }
  }
  return out.size ? out : null;
}
const DOW_FMT = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" });
const madridDow = (plusDays: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(DOW_FMT.format(new Date(Date.now() + plusDays * 86400e3)));
async function openerFacts(plusDays: number): Promise<{ lo: number; hi: number; areas: string[] } | null> {
  try {
    if (!openerCache || Date.now() - openerCache.at > 10 * 60e3) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/opener_examples`, { method: "POST", headers: H(), body: JSON.stringify({ p_limit: 40 }) });
      const rows = await r.json().catch(() => []);
      openerCache = { at: Date.now(), rows: Array.isArray(rows) ? rows.map((x: any) => ({ area: String(x.area || ""), price: Number(x.price), opening_hours: String(x.opening_hours || ""), yeses: Number(x.yeses) || 0 })).filter((x: OpenerEx) => x.area && x.price > 0) : [] };
    }
    const dow = madridDow(plusDays);
    const live = openerCache.rows.filter((x) => { if (x.yeses <= 0) return false; const d = openDays(x.opening_hours); return !d || d.has(dow); });
    if (live.length < 2) return null;
    const prices = live.map((x) => x.price);
    const areas: string[] = [];
    for (const x of [...live].sort((a, b) => b.yeses - a.yeses)) if (!areas.some((y) => stripAcc(y).toLowerCase() === stripAcc(x.area).toLowerCase())) areas.push(x.area);
    return { lo: Math.min(...prices), hi: Math.max(...prices), areas: areas.slice(0, 4) };
  } catch (_e) { return null; }
}
// hint: "es" adds the Spanish switch line under an English opener, "en" the
// English one under a Spanish opener, "es_word" the original "write español".
// v198 (10 Oct, Jordan: "can we change the opening line, it's not working").
// After v188 went live on 9 Oct, 3 of the 4 people who came in from the ad
// never wrote back. What they got was four paragraphs: a list of areas, a
// price with a caveat, instructions on how to type the answer ("like tomorrow
// 18:00 near Sol"), a line about Spanish, three buttons, then a second bubble
// with a link. That reads like a brochure, not a person. The opener is now what
// a person would send: hello with their name, what we do and what it costs in
// one sentence, and one question.
async function firstLine(L: string, hint: "" | "es" | "en" | "es_word" = "", ack = "", ask = true, name = ""): Promise<string> {
  const night = mcMadridHour() >= 19;
  const f = await openerFacts(night ? 1 : 0);
  const lo = f ? f.lo : 50, hi = f ? f.hi : 85;
  const tail = hint === "es" || hint === "es_word" ? "\n\n¿En español? Escríbeme en español."
    : hint === "en" ? "\n\nIn English? Just write in English."
    : "";
  const who = name ? " " + name : "";
  if (L === "es") {
    const price = hi > lo ? `entre ${lo} y ${euro(hi)}` : `unos ${euro(lo)}`;
    return `Hola${who}, somos Massage Club 👋 Te buscamos hueco encantados. Reservamos en centros profesionales de todo Madrid, y un masaje relajante de 60 min suele costar ${price}, que se pagan en el centro.`
      + (night ? "\nPara esta noche ya es tarde, así que miro mañana." : "")
      + (ack ? "\n\n" + ack : "")
      + (ask ? "\n\n¿Qué día te viene bien?" : "")
      + tail;
  }
  const price = hi > lo ? `${lo} to ${euro(hi)}` : `about ${euro(lo)}`;
  return `Hi${who}, Massage Club here 👋 Happy to find you one. We book you into professional studios around Madrid, and a 60 min relaxing massage is usually ${price}, paid at the studio.`
    + (night ? "\nIt's late for tonight, so I'll look at tomorrow." : "")
    + (ack ? "\n\n" + ack : "")
    + (ask ? "\n\nWhat day would you like it?" : "")
    + tail;
}
const openerName = (s: Session) => firstNameFromProfile(s.wa_name);
// v188: the ad's prefilled line is English whatever the person speaks, so it
// says nothing about them. 33 of 46 Spanish conversations got the wrong
// language, 28 of them at this first message, and Spanish speakers who did get
// through booked as often as English ones. A Spanish-speaking country code, or
// a Spain number with a clearly Spanish name, opens in Spanish with one line to
// switch; any other Spain number opens in English with one line to switch.
const ES_CC_RE = /^(5[1234678]|59[1358]|50[2-7]|1(809|829|849))/;
const ES_GIVEN = new Set("jose juan antonio manuel francisco javier jesus miguel alejandro rafael pedro pablo sergio fernando jorge luis alberto alvaro diego raul enrique ramon vicente ivan ruben andres joaquin santiago eduardo roberto jaime ignacio marcos alfonso guillermo gonzalo angel emilio julian salvador agustin tomas cristian mateo nicolas rodrigo felipe ricardo arturo ernesto gustavo hector cesar mariano lorenzo eugenio borja inigo inaki unai aitor jordi xavier oriol paco pepe manolo nacho chema juanan juanma quique kike txema curro fermin efrain basilio gregorio carlos maria carmen ana isabel lucia cristina marta pilar raquel rosa silvia patricia beatriz nuria rocio teresa mercedes montserrat montse sonia monica ines lorena noelia veronica belen susana alicia esther marina angela yolanda encarnacion concepcion dolores josefa amparo inmaculada angeles angelines consuelo rosario soledad remedios milagros begona ainhoa leire maite almudena macarena paloma lourdes nerea ainara conchi merche puri luisa juana manuela francisca antonia lola paqui ximena guadalupe".split(" "));
const ES_SURNAME = new Set("garcia munoz moreno romero navarro torres ruiz ortiz molina delgado castro ortega rubio morales serrano molinero iglesias medina garrido cortes castillo lozano guerrero cano prieto cruz calvo gallego vidal herrera marin pena flores cabrera campos vega fuentes carrasco diez caballero reyes nieto aguilar pascual santana herrero montero hidalgo ibanez ferrer duran mora vargas arias carmona crespo pastor soto velasco moya soler parra esteban bravo gallardo rojas manzano burgos arjona balaguer ibarra valenciano garzon lazcano llanos".split(" "));
function spanishName(raw: unknown): boolean {
  const s = String(raw || "");
  if (/[ñÑáíóúÁÍÓÚ]/.test(s)) return true;
  const toks = stripAcc(s).toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return toks.some((t) => ES_GIVEN.has(t) || ES_SURNAME.has(t) || (t.length >= 5 && /[^aeiou]ez$/.test(t)));
}
// v191: the first message, with whatever the customer already told us read
// back to them and used. Anything beyond the ad's own line is theirs.
const AD_PREFIX_RE = /^hi,? i'?d like to book a massage\.? i saw you on (facebook|instagram)\s*\.?\s*/i;
async function openWith(s: Session, from: string, L: string, hint: "" | "es" | "en" | "es_word", text: string, pre = ""): Promise<void> {
  if (s.data.xlang) hint = ""; // v197: their language, no switch line
  const own = String(text || "").replace(AD_PREFIX_RE, "").trim();
  const got = own.split(/\s+/).filter(Boolean).length >= 2 ? await readerAssist(s, from, L, String(text || ""), null) : [];
  const ack = got.length ? COPY[L].gotItSvc(understood(s, L, got)) : "";
  const head = pre ? pre + "\n\n" : "";
  if (got.length && s.data.day) {
    await sendText(from, head + await firstLine(L, hint, ack, false, openerName(s)));
    await nextStep(s, from, L);
    return;
  }
  await sendButtons(from, head + await firstLine(L, hint, ack, true, openerName(s)), L === "en" && hint === "es_word" ? dayBtnsBoth() : dayBtns(L));
}
// The next question once something new is known: with day and time, straight
// to the area or the studio options.
async function nextStep(s: Session, from: string, L: string): Promise<void> {
  dropStaleDay(s, L);
  if (s.data.service && s.data.day && s.data.time) { await afterTime(s, from, L); return; }
  await continueFromKnown(s, from, L);
}
function adLeadLang(phone: string, waName: unknown): { L: "es" | "en"; hint: "" | "es" | "en" } {
  const d = digitsOf(phone);
  if (ES_CC_RE.test(d)) return { L: "es", hint: "en" };
  if (d.startsWith("34")) return spanishName(waName) ? { L: "es", hint: "en" } : { L: "en", hint: "es" };
  return { L: "en", hint: "" };
}
const looksEnglish = (t: string) => /\b(hi|hello|hey|i|i'd|i'm|id|im|like|book|booking|want|need|please|massage|can|could|you|tomorrow|today|tonight|near|the)\b/i.test(String(t || "")) && !/[¿¡ñ]|\b(hola|quiero|masaje|reservar|gracias)\b/i.test(String(t || ""));
const askDay = (to: string, L: string) => sendButtons(to, COPY[L].day, dayBtns(L));
// v204 (12 Oct, synth.md change 4): "Another day" opens a list of the next
// seven dates (dayListRows) instead of "Which day? Just type it", which saved
// whatever came back as the day.
const askDayList = (to: string, L: string) => sendList(to, DAY_LIST_COPY[L === "es" ? "es" : "en"].body, DAY_LIST_COPY[L === "es" ? "es" : "en"].button, dayListRows(L, Date.now()));
// A date tapped on that list is set the way the booking form sets one
// (flowDay): "Tomorrow" with its date, or the full date, which is what travels
// to the studios. The flow then goes on exactly as after a typed day. False for
// a date that has gone.
async function pickListedDay(s: Session, from: string, L: string, id: string): Promise<boolean> {
  const d = flowDay(id.replace(/^dayd_/, ""), L);
  if (!d) return false;
  s.data.day = d.day; s.data.dayDate = d.dayDate;
  await logEvent(from, "day_chosen", { day: "list", date: id.replace(/^dayd_/, "") });
  if (s.data.time) { await saveSession(s); await afterTime(s, from, L); }
  else { s.step = "await_time"; await saveSession(s); await askTime(from, L); }
  return true;
}
const askDayUnsure = (to: string, L: string) => sendButtons(to, COPY[L].dayUnsure, dayBtns(L));
// v81b: three taps, not a four row list. The "custom time" row was the fourth,
// which is what forced this into a menu the customer had to open first; the
// invitation to type an exact time now lives in the question itself, and free
// text was always parsed anyway. Someone who needs 20:00 types it and gets it.
// v206: the buttons on their own, so agent_core can put them under its own words.
const timeBtns = (L: string) => [
  { id: "time_morning", title: L === "es" ? HOURS.time_morning.labelEs : HOURS.time_morning.label },
  { id: "time_afternoon", title: L === "es" ? HOURS.time_afternoon.labelEs : HOURS.time_afternoon.label },
  { id: "time_evening", title: L === "es" ? HOURS.time_evening.labelEs : HOURS.time_evening.label },
];
const askTime = (to: string, L: string) => sendButtons(to, COPY[L].time, timeBtns(L));
const askHour = (to: string, L: string, band: string) => {
  const b = HOURS[band];
  const rows = b.hours.map((h) => ({ id: `hour_${h.replace(":", "")}`, title: h, description: "" }));
  rows.push({ id: "hour_flex", title: COPY[L].hourFlex, description: COPY[L].hourFlexDesc });
  return sendList(to, COPY[L].hour, COPY[L].hourBtn, rows);
};
const areaListRows = (L: string) => ({ button: String(COPY[L].areaBtn), rows: [
  ...AREA_ROWS.map((a) => ({ id: a.id, title: L === "es" ? a.es : a.en, description: "" })),
  { id: "area_any", title: COPY[L].areaAnyTitle, description: COPY[L].areaAnyDesc },
  { id: "area_other", title: COPY[L].areaOtherTitle, description: COPY[L].areaOtherDesc },
] });
const askArea = (to: string, L: string) => { const a = areaListRows(L); return sendList(to, COPY[L].area, a.button, a.rows); };

// What did they actually ask for, in their own words? Honour it instead of
// making them pick the same thing again from a menu.
const sendMenu = (to: string, L: string) => sendList(to, COPY[L].menuTitle, COPY[L].menuBtn, COPY[L].menuRows);

type Opt = { id: string; business_name: string; slug: string; area: string; google_rating: any; google_reviews: any; venue_type: string; wa: string; svc: string; duration: number; price: number; registered?: boolean; discount_pct?: number | null };
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
// v81: was limit=1 with no ordering. Sinergia38 had two partner rows carrying
// the same phone (a 9 Sept self signup alongside the live row), so Postgres
// returned whichever it felt like. On 10 Sept it returned the duplicate, the
// dispatch lookup then found no row for that partner_id, and their tap to
// decline Fernando's request was silently dropped. Order so the live row wins:
// active first, then the oldest, which is the one dispatches were built against.
async function findPartnerByNumber(fromDigits: string): Promise<{ id: string; business_name: string } | null> {
  const local = fromDigits.startsWith("34") && fromDigits.length === 11 ? fromDigits.slice(2) : fromDigits;
  if (!local || local.length < 9) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/partners?or=(whatsapp.ilike.*${local}*,phone.ilike.*${local}*)&select=id,business_name,status&order=status.asc,created_at.asc&limit=5`, { headers: H() });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows) || !rows[0]) return null;
  const live = rows.find((p: Record<string, unknown>) => String(p.status || "") === "active") || rows[0];
  if (rows.length > 1) console.log("[studio] duplicate partner rows for", local, rows.map((p: Record<string, unknown>) => `${p.id}:${p.status}`).join(","), "using", live.id);
  return { id: String(live.id), business_name: String(live.business_name || "") };
}
async function lastRequestFor(phone: string): Promise<any | null> {
  const num = "+" + digitsOf(phone);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent(num)}&stage=neq.dismissed&order=created_at.desc&limit=1&select=id,first_name,last_name,contact_email,service_name,studio_name,partner_id,slug,price,languages,day1,time1,confirmed_day,confirmed_time,stage,therapist_gender,created_at`, { headers: H() });
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
    ? "Hola, somos Massage Club. ¿En qué te podemos ayudar?"
    : "Hi, this is Massage Club. How can we help?";
  const when = b.stage === "confirmed" && b.confirmed_day ? [b.confirmed_day, b.confirmed_time].filter(Boolean).join(" ") : [b.day1, b.time1].filter(Boolean).join(" ");
  const svcN = es ? trSvcLow(b.service_name || "Massage", "es") : String(b.service_name || "massage").toLowerCase();
  return es
    ? `Hola${b.first_name ? " " + b.first_name : ""}, somos Massage Club.\n\nVeo que estás pendiente de tu ${svcN}${when ? " para " + when : ""}. ¿Es así? Te ayudamos ahora.`
    : `Hi${b.first_name ? " " + b.first_name : ""}, this is Massage Club.\n\nI see you need an update on your ${svcN}${when ? " for " + when : ""}. Is that right?`;
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
  s.data.picks = picks.map((o) => ({ id: o.id, slug: o.slug, name: o.business_name, svc: o.svc, price: o.price, duration: o.duration, area: o.area, registered: !!o.registered }));
  return true;
}

async function askStudio(to: string, L: string, s: Session): Promise<boolean> {
  const ok = await loadPicks(to, L, s);
  if (!ok) return false;
  const top = s.data.picks[0];
  await sendButtons(to, COPY[L].topPick(top.name, trSvc(top.svc, L), top.duration || 60, Number(top.price), top.area || "Madrid", !!top.registered), COPY[L].topPickBtns);
  await logEvent(to, "studio_offered", { variant: "toppick", top: top.name, price: top.price, registered: !!top.registered });
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
    description: `${trSvc(o.svc, L)} ${o.duration || 60} min · ${Number(o.price)} EUR${o.registered ? " · " + COPY[L].partnerTag : ""}`.slice(0, 72),
  }));
  rows.push({ id: "studio_any", title: COPY[L].anyStudio, description: COPY[L].anyStudioDesc });
  rows.push({ id: "studio_other", title: COPY[L].otherStudio, description: COPY[L].otherStudioDesc });
  await sendList(to, COPY[L].studios, COPY[L].studiosBtn, rows);
  await logEvent(to, "studio_offered", { variant: "list" });
  return true;
}

// v152 (Jordan, 4 Oct): "lead with an offer, not a questionnaire." Once we know
// when and where, the customer sees two real studios with their prices and taps
// one; that studio is asked straight away, with the other as backup. The two
// come from offer_studios, which is the same ranking that decides who gets
// asked, so we never offer a studio that never answers. A registered studio's
// price is its own menu; anyone else's is a listing, so it reads "about".
// Nothing here says the studio is free: that is the studio's yes to give.
// v188: the weekday a request is for, in Madrid, or null when the day is not
// a plain today, tomorrow or named weekday (then nothing is filtered).
const WEEKDAY_IDX: Array<[RegExp, number]> = [
  [/\b(sunday|domingo)\b/i, 0], [/\b(monday|lunes)\b/i, 1], [/\b(tuesday|martes)\b/i, 2], [/\b(wednesday|mi[eé]rcoles)\b/i, 3],
  [/\b(thursday|jueves)\b/i, 4], [/\b(friday|viernes)\b/i, 5], [/\b(saturday|s[aá]bado)\b/i, 6],
];
async function dropClosed(s: Session, from: string, rows: any[]): Promise<any[]> {
  rows = await dropSilent(from, rows);
  const dow = requestedDow(s);
  if (dow === null || !rows.length) return rows;
  try {
    const hr = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=in.(${rows.map((o: any) => o.id).join(",")})&select=id,opening_hours`, { headers: H() });
    const hours = await hr.json().catch(() => []);
    const shut = new Set((Array.isArray(hours) ? hours : []).filter((x: any) => { const d = openDays(x.opening_hours); return d && !d.has(dow); }).map((x: any) => String(x.id)));
    if (!shut.size) return rows;
    await logEvent(from, "offer_skipped_closed", { dow, skipped: rows.filter((o: any) => shut.has(String(o.id))).map((o: any) => o.business_name || o.name) });
    return rows.filter((o: any) => !shut.has(String(o.id)));
  } catch (_e) { return rows; } // hours unreadable: offer as before
}
// v189: the same rest rule as dispatch-studios v37. A studio asked three times
// that has never once written back would be skipped by dispatch, so offering
// it to the customer only parks them on a studio nobody will ask (KamAI: 25
// asks, no reply, still offered on 9 Oct).
async function dropSilent(from: string, rows: any[]): Promise<any[]> {
  if (!rows.length) return rows;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=in.(${rows.map((o: any) => o.id).join(",")})&sent_at=not.is.null&select=partner_id,replied_at`, { headers: H() });
    const list = await r.json().catch(() => []);
    const asked = new Map<string, number>(); const replied = new Set<string>();
    for (const x of (Array.isArray(list) ? list : [])) { const pid = String(x.partner_id); asked.set(pid, (asked.get(pid) || 0) + 1); if (x.replied_at) replied.add(pid); }
    const silent = new Set([...asked].filter(([pid, n]) => n >= 3 && !replied.has(pid)).map(([pid]) => pid));
    if (!silent.size) return rows;
    await logEvent(from, "offer_skipped_silent", { skipped: rows.filter((o: any) => silent.has(String(o.id))).map((o: any) => o.business_name || o.name) });
    return rows.filter((o: any) => !silent.has(String(o.id)));
  } catch (_e) { return rows; }
}
function requestedDow(s: Session): number | null {
  const d = String(s.data.day || "").trim();
  if (/^(today|hoy)$/i.test(d)) return madridDow(0);
  if (/^(tomorrow|ma[nñ]ana)$/i.test(d)) return madridDow(1);
  const txt = `${s.data.dayDate || ""} ${d}`;
  for (const [re, i] of WEEKDAY_IDX) if (re.test(txt)) return i;
  return null;
}
// v206: the studios offerStudios would show, read without sending anything,
// so agent_core's studio_options tool shows exactly the same ones. Same
// source, same filters, same order; offerStudios now calls this.
async function studioOptions(s: Session, from: string): Promise<StudioPick[]> {
  // No service chosen yet means relaxing, the default everywhere else. Without
  // this CG (4 Oct) was offered "Sports" and "Shiatsu", the cheapest 60 min
  // rows, for a plain massage.
  const svcRow = ALL_SERVICES.find((x) => x.id === (!s.data.service || s.data.service === "svc_unsure" ? "svc_relax" : s.data.service));
  const area = s.data.area && s.data.area !== "anywhere" ? s.data.area : "";
  let rows: any[] = [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/offer_studios`, {
      method: "POST", headers: H(), body: JSON.stringify({ p_area: area || null, p_want: svcRow ? svcRow.en : null, p_limit: 6 }),
    });
    const j = await res.json().catch(() => []);
    rows = Array.isArray(j) ? j : [];
  } catch (_e) { rows = []; }
  // v188 (9 Oct test): Saturday 18:00 offered Sinergia38, open Monday to
  // Friday, and dispatch-studios would then refuse to ask it. A studio whose
  // own opening_hours say it is shut that day is not offered.
  rows = (await dropClosed(s, from, rows)).slice(0, 3);
  const picks: StudioPick[] = rows.map((o: any) => ({ id: o.id, slug: o.slug, name: o.business_name, svc: o.svc, price: Number(o.price), duration: Number(o.duration) || 60, area: o.area, registered: !!o.registered }));
  // v182 (7 Oct): cheapest first. Javier and the "carísimo" lead on 6 Oct were
  // both shown Calma at 85 EUR at the top and left over price. The ranking
  // still decides WHICH studios are offered; price decides the order.
  picks.sort((a: any, b: any) => (Number(a.price) || 999) - (Number(b.price) || 999));
  return picks;
}
async function offerStudios(s: Session, from: string, L: string): Promise<boolean> {
  if (await staleDay(s, from, L)) return true;
  const picks = await studioOptions(s, from);
  if (picks.length < 2) return false;
  const area = s.data.area && s.data.area !== "anywhere" ? s.data.area : "";
  s.data.picks = picks; s.data.picksAt = Date.now();
  s.data.offerMode = true; s.data.cheapPick = null;
  s.step = "await_studio"; await saveSession(s);
  const es = L === "es";
  const when = [s.data.dayDate ? `${String(s.data.day || "").toLowerCase()} ${s.data.dayDate}`.trim() : s.data.day, s.data.time].filter(Boolean).join(", ");
  const where = area ? (es ? `cerca de ${area}` : `near ${area}`) : (es ? "en Madrid" : "in Madrid");
  const lines = s.data.picks.slice(0, 2).map((o: any) =>
    `· *${o.name}* (${o.area}): ${trSvcLow(o.svc, L)} ${o.duration} min, ${o.registered ? "" : (es ? "unos " : "about ")}${euro(o.price)}`);
  const body = es
    ? `${when ? when.charAt(0).toUpperCase() + when.slice(1) + ", " : ""}${where}, estas son las mejores opciones:\n\n${lines.join("\n")}\n\nToca uno y se lo pregunto ahora mismo. O toca *Mejor precio* y pregunto a varios y te traigo la mejor oferta. Pagas en el centro, sin comisión.`
    : `${when ? when.charAt(0).toUpperCase() + when.slice(1) + ", " : ""}${where}, here are the best options:\n\n${lines.join("\n")}\n\nTap one and I'll ask them right now. Or tap *Best price* and I'll ask a few and bring back the best offer. You pay at the studio, no fee from us.`;
  const short = (n: string) => n.replace(/\s+(Relax and Beauty|Wellness Studio|Madrid Spa|Masajes?|Spa|Studio)$/i, "").slice(0, 20);
  await sendButtons(from, body, [
    { id: "studio_0", title: short(s.data.picks[0].name) },
    { id: "studio_1", title: short(s.data.picks[1].name) },
    { id: "studio_any", title: es ? "Mejor precio" : "Best price" },
  ]);
  await logEvent(from, "studio_offered", { variant: "offer_first", picks: s.data.picks.slice(0, 2).map((o: any) => o.name) });
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

// v207 (12 Oct): pacomartin came from the ad and wrote "Cuál es la direcion,
// donde está la sala" at 16:46. ZONEQ_RE (copy.ts) knows "qué dirección" and
// "dónde estáis" but not "cuál es la dirección", the one-c spelling, or "dónde
// está la sala", so he got the plain opener and no answer. The extra shapes
// live here because copy.ts stays pinned. Someone giving their own address
// ("mi dirección es", "my email address") or asking where their booking is
// does not match.
const ZONEQ_MORE_RE = /((cu[aá]l|qu[eé]) es (la|vuestra|su|tu) dir+ec+i[oó]n(?!\s+(de\s+)?(correo|e-?mail|mail|electr[oó]nica))|(d[aá]me|d[ií]me|p[aá]same|m[aá]ndame|env[ií]ame|me (das|dais|da|dices|dec[ií]s|pasas|pas[aá]is|mandas|mand[aá]is|env[ií]as|env[ií][aá]is|puedes (dar|pasar|decir|mandar|enviar)|podr[ií]as (dar|pasar|decir|mandar|enviar)|pod[eé]is (dar|pasar|decir|mandar|enviar)))\s+(la |vuestra |su )?(dir+ec+i[oó]n|ubicaci[oó]n)(?!\s+(de\s+)?(correo|e-?mail|mail|electr[oó]nica))|^\s*[¿?]?\s*((y|ok|vale)\s*,?\s*)?(la\s+)?dir+ec+i[oó]n\s*[?!.]*\s*$|(?<![a-zñáéíóú])dir+ec+i[oó]n\s*[?]|d[oó]nde (est[aá]|queda|es|se encuentra)\s+(la sala|el centro|el local|el sitio|el spa|la cl[ií]nica|el estudio|el sal[oó]n|la consulta|el negocio|ubicad[oa]s?|situad[oa]s?)(?![a-zñáéíóú])|d[oó]nde (est[aá]|queda|es|se encuentra)\s*[?!.]*\s*$|qu[eé] metro|metro m[aá]s cercano|(what'?s|whats|what is) (the|your) (address|location)|(send|give|share)( me| us)? (the|your) (address|location)|where (is|'s|are) (the|your) (studio|place|salon|spa|center|centre|clinic|massage|location|shop)\b|^\s*(the\s+)?addr?ess+\s*[?!.]*\s*$|where are you\s*[?!.]*\s*$|which (metro|tube|subway)|nearest (metro|tube|subway))/iu;
const zoneQ = (t: string): boolean => ZONEQ_RE.test(t) || ZONEQ_MORE_RE.test(t);

// v207: "where is it?" from someone whose booking is confirmed and still ahead
// is about that studio, so it gets the studio's name and address, never the
// general answer. Anyone else gets the general answer.
function bookedWhere(req: any, pc: { address: string }, L: string): string {
  const when = whenFor([req.confirmed_day || req.day1, req.confirmed_time || req.time1].filter(Boolean).join(" "), L);
  return L === "es"
    ? `${req.studio_name || "El centro"}\n📍 ${pc.address}${when ? `\n🗓 ${when}` : ""}\n\nPagas allí, sin comisión.`
    : `${req.studio_name || "The studio"}\n📍 ${pc.address}${when ? `\n🗓 ${when}` : ""}\n\nYou pay there, no fee from us.`;
}
async function bookedWhereFor(from: string, L: string): Promise<string> {
  const req = await lastRequestFor(from).catch(() => null);
  if (!req || req.stage !== "confirmed" || !req.partner_id) return "";
  const made = Date.parse(String(req.created_at || ""));
  if (!(Date.now() - made < 8 * 86400e3)) return "";
  const day = resolveRequestDate(req.confirmed_day || req.day1, "", new Date());
  if (day && day.getTime() < madridMidnight().getTime()) return "";
  const pc = await partnerCard(String(req.partner_id));
  return pc.address ? bookedWhere(req, pc, L) : "";
}
async function whereAnswer(from: string, L: string): Promise<string> {
  return (await bookedWhereFor(from, L)) || COPY[L].zoneAnswer;
}

// Greeting for a fresh conversation: returning customers get a personal hello.
// v59: a first message that is a real question gets its answer before we ask
// ours. "What street in madrid" produced the service menu, twice.
function firstAnswer(t: string, L: string): string {
  const s = String(t || "");
  if (zoneQ(s)) return COPY[L].zoneAnswer;
  if (HOWWORKS_RE.test(s)) return COPY[L].howItWorks;
  return "";
}

// v59: WhatsApp delivered an ad lead's two opening messages 0.34s apart on
// 7 Sept and each one ran greet(), so they got three walls of text before they
// had said anything. One greeting per minute, whichever arrives first.
async function greetedRecently(phone: string, windowMs = 60_000): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${encodeURIComponent(phone)}&direction=eq.out&created_at=gte.${since}&select=id&limit=1`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function greet(s: Session, from: string, firstText?: string, preAnswer = ""): Promise<void> {
  // v195: 15 seconds, not 60. A "Hola" 30 seconds after the first message got
  // no reply at all; the window only exists for WhatsApp's double delivery.
  if (await greetedRecently(from, 15_000)) { await logEvent(from, "greet_suppressed", { firstText: String(firstText || "").slice(0, 80) }); return; }
  const last = await lastRequestFor(from);
  if (!s.data.lang && last && last.languages === "es") s.data.lang = "es";
  const L = s.data.lang === "es" ? "es" : "en";
  // v204: a line that rides on top of whichever first message goes out (the
  // failed voice note's "Could you type it?"), so it is still one message.
  const head = preAnswer ? preAnswer + "\n\n" : "";
  if (last) {
    const fullName = [last.first_name, last.last_name].filter(Boolean).join(" ").trim();
    s.data.known = { name: fullName || null, email: last.contact_email || null };
    if (last.partner_id && !/por asignar/i.test(String(last.studio_name || ""))) {
      s.data.rebookOffer = { service: last.service_name, partner_id: last.partner_id, slug: last.slug, studio_name: last.studio_name, price: last.price };
      s.step = "returning_choice"; await saveSession(s);
      await sendButtons(from, head + COPY[L].welcomeBack(last.first_name || "", last.service_name ? trSvcLow(last.service_name, L) : (L === "es" ? "un masaje" : "a massage"), last.studio_name || ""), COPY[L].welcomeBackBtns);
      return;
    }
    s.step = "returning_choice"; await saveSession(s);
    await sendButtons(from, head + COPY[L].welcomeBackPlain(last.first_name || ""), COPY[L].welcomeBackPlainBtns);
    return;
  }
  // v39: someone arriving from the ad has only sent the canned English opener.
  // We do not know their language yet, so the first screen is bilingual and
  // short: one list, no link. Their first tap or word sets the language.
  if (!s.data.lang && (s.data.adRef || AD_OPENER_RE.test(String(firstText || "").trim()))) {
    // v56 (7 Sept): when the first message already tells us the language, one
    // question in that language, not a bilingual wall. "Hi, I'd like to book a
    // massage" got a Spanish-first screen with eight options at 00:28 on 7 Sept.
    // Relaxing 60 min is assumed; they can name another type at any point.
    const ft = String(firstText || "").trim();
    // v188: the canned ad line is not their words; guess from the number and name.
    const canned = AD_OPENER_RE.test(ft) || !ft;
    const guess = canned && !strongSpanish(ft) ? adLeadLang(from, s.wa_name) : null;
    const knownLang = strongSpanish(ft) ? "es" : guess ? guess.L : looksEnglish(ft) ? "en" : "";
    if (knownLang) {
      s.data.lang = knownLang; s.data.service = "svc_relax"; s.data.defaultService = true; s.step = "await_day";
      if (guess) s.data.langGuess = guess.L;
      await saveSession(s);
      await logEvent(from, "flow_started", { fromAd: true, oneQuestion: true, lang: knownLang, guessed: !!guess });
      await logEvent(from, "service_chosen", { service: "svc_relax", assumed: true });
      await openWith(s, from, knownLang, guess ? guess.hint : "", ft, preAnswer || firstAnswer(ft, knownLang));
      return;
    }
    s.data.service = "svc_relax"; s.data.defaultService = true; s.data.langUnset = true;
    s.step = "await_day"; await saveSession(s);
    await logEvent(from, "flow_started", { fromAd: true, langUnset: true, oneQuestion: true });
    await logEvent(from, "service_chosen", { service: "svc_relax", assumed: true });
    await openWith(s, from, "en", "es_word", ft);
    return;
  }
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
  // v59: anyone whose first message shows the language gets the same single
  // question as an ad lead: what it costs, then "which day?". The eight-option
  // list and the booking link are the fallback for a message we cannot read
  // (a sticker, a bare "Hola"), not the opening move for everyone.
  const gLang = strongSpanish(String(firstText || "")) ? "es" : looksEnglish(String(firstText || "")) ? "en" : "";
  if (gLang) {
    s.data.lang = gLang; s.data.service = "svc_relax"; s.data.defaultService = true; s.step = "await_day"; await saveSession(s);
    await logEvent(from, "flow_started", { oneQuestion: true, lang: gLang });
    await logEvent(from, "service_chosen", { service: "svc_relax", assumed: true });
    await openWith(s, from, gLang, "", String(firstText || ""), preAnswer || firstAnswer(String(firstText || ""), gLang));
    return;
  }
  // v72: one message, one question, no link. This used to send the booking link
  // and then the service menu, so a person who had said one word got three
  // messages and a website competing with the chat before they had answered
  // anything.
  s.data.service = "svc_relax"; s.data.defaultService = true; s.data.langUnset = !s.data.lang;
  s.step = "await_day"; await saveSession(s);
  await logEvent(from, "flow_started", { oneQuestion: true, unreadable: true });
  await logEvent(from, "service_chosen", { service: "svc_relax", assumed: true });
  // v197: someone writing another language gets the plain opener in it, not
  // an English one with a line about switching to Spanish.
  if (s.data.xlang) await sendButtons(from, head + await firstLine("en", "", "", true, openerName(s)), dayBtns("en"));
  else if (s.data.lang) await sendButtons(from, head + await firstLine(L, "", "", true, openerName(s)), dayBtns(L));
  else await sendButtons(from, head + await firstLine("en", "es_word", "", true, openerName(s)), dayBtnsBoth());
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

async function founderCard(subject: string, o: { badge: string; title: string; paras?: string[]; quote?: string; after?: string[]; transcript?: string[]; waNum?: string; waLabel?: string; prefill?: string; to?: string[]; studioNum?: string; studioName?: string }) {
  if (aboutFakeCustomer(subject, o.waNum || "", o.title, o.paras || [], o.quote || "")) { console.log("[wa] founder card about a fake test number, not sent"); return; }
  const paras = (o.paras || []).filter(Boolean).map((p) =>
    `<p style="margin:10px 0 0;color:${C.ink};font-size:14px;line-height:1.6;">${esc(p)}</p>`).join("");
  // v210: line breaks kept, so a studio message reads the way it arrived.
  const quote = o.quote
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:${C.cream};border-radius:12px;"><tr><td style="padding:14px 16px;"><p style="margin:0;color:${C.ink};font-size:14.5px;line-height:1.6;font-style:italic;white-space:pre-line;">"${esc(o.quote)}"</p></td></tr></table>`
    : "";
  const after = (o.after || []).filter(Boolean).map((p) =>
    `<p style="margin:10px 0 0;color:${C.muted};font-size:13.5px;line-height:1.6;white-space:pre-line;">${esc(p)}</p>`).join("");
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
  // v139: the main button now replies AS THE BOT, from the bot number. Writing
  // from Jordan's own phone stays as a smaller link underneath.
  const botHref = o.waNum ? await replyUrl(o.waNum) : "";
  // v208 (Jordan, 15 Oct): "a way to reply as the bot to the studio". A card
  // about a customer's offer or booking also opens the studio's chat, on the
  // same page, sending from the bot number.
  const studioHref = o.studioNum && digitsOf(o.studioNum) !== digitsOf(o.waNum || "") ? await replyUrl(o.studioNum) : "";
  const studioLabel = `Reply to ${o.studioName || "the studio"} as the bot`;
  const studioBtn = studioHref
    ? `<p style="margin:12px 0 0;"><a href="${studioHref}" style="display:inline-block;background:#fff;color:#1A7F42;border:2px solid #1FA855;font-size:14px;font-weight:700;text-decoration:none;padding:11px 24px;border-radius:999px;">${esc(studioLabel)}</a></p>`
    : "";
  const waBtn = o.waNum
    ? `<tr><td style="padding:20px 34px 0;text-align:center;"><a href="${botHref}" style="display:inline-block;background:#1FA855;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;">${studioHref ? "Reply to the customer as the bot" : "Reply as the bot"}</a>${studioBtn}<p style="margin:8px 0 0;color:${C.muted};font-size:11.5px;">Opens a suggested answer you can edit. Sends from the bot number as Massage Club.</p><p style="margin:10px 0 0;font-size:12px;"><a href="${waHref}" style="color:${C.muted};">${esc(o.waLabel || "Or write from your own WhatsApp")}</a></p></td></tr>`
    : "";
  const chatLink = o.waNum
    ? `<tr><td style="padding:12px 34px 0;text-align:center;"><a href="${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&phone=${digitsOf(o.waNum)}" style="color:${C.clay};font-size:13px;font-weight:700;text-decoration:none;">View full conversation</a> <span style="color:${C.dash};">·</span> <a href="${await inboxUrl()}" style="color:${C.clay};font-size:13px;font-weight:700;text-decoration:none;">Open inbox</a></td></tr>`
    : "";
  const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center">\n  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;">\n    <tr><td style="padding:26px 34px 0;text-align:center;">\n      <img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;">\n      <p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p>\n    </td></tr>\n    <tr><td style="padding:22px 34px 0;text-align:center;">\n      <span style="display:inline-block;background:${C.cream};color:${C.clay};font-size:11px;font-weight:700;letter-spacing:2.5px;padding:7px 16px;border-radius:999px;">${esc(o.badge)}</span>\n      <h1 style="margin:14px 0 0;color:${C.ink};font-size:23px;line-height:1.3;font-family:${SERIF};font-weight:700;">${esc(o.title)}</h1>\n    </td></tr>\n    <tr><td style="padding:4px 34px 0;">${paras}${quote}${after}${transcript}</td></tr>\n    ${waBtn}\n    ${chatLink}\n    <tr><td style="padding:22px 34px 26px;">\n      <div style="border-top:2px dashed ${C.dash};margin-bottom:12px;"></div>\n      <p style="margin:0;color:#B8AC9E;font-size:11.5px;text-align:center;">Founder alert · WhatsApp bot · +34 613 97 79 00</p>\n    </td></tr>\n  </table>\n</td></tr></table>`;
  const plain = [o.title, ...(o.paras || []), o.quote ? `"${o.quote}"` : "", ...(o.after || []), ...(o.transcript || []), botHref ? `Reply as the bot: ${botHref}` : "", studioHref ? `${studioLabel}: ${studioHref}` : "", waHref ? `WhatsApp: ${waHref}` : "", o.waNum ? `Full conversation: ${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&phone=${digitsOf(o.waNum)}` : ""].filter(Boolean).join("\n");
  await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: o.to || SUPPORT, subject, html, text: plain }),
  });
}

// v139 (Jordan, 3 Oct): "I need to be able to reply as the bot, not as Jordan."
// The founder alert's only button opened wa.me on Jordan's own phone, so every
// answer he gave came from a different number and handed the customer over to a
// person. This page sends from the bot number instead, signed Massage Club, and
// leaves the session where it is so the bot carries on the booking.
//
//   GET  ?reply=<phone>&sig=<sig>   the thread, a suggested answer, a Send box
//   POST same URL, form field text  sends it, then redirects back with &sent=1
//
// The sig is an HMAC of the phone under the ops key, so a link opens exactly one
// customer's thread and cannot be pointed at anyone else. The ops key itself
// never appears in the page or the email.
async function replySig(phone: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(OPS_KEY + ":bot-reply"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(digitsOf(phone))));
  return [...mac.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Supabase serves every HTML response from *.supabase.co as text/plain (Jordan
// saw raw code on 3 Oct), so the pages live at book.massageclub.io/bot.html, a
// static shell that fetches the rendered page from here as JSON (fmt=json) and
// posts replies back as a form. Nothing secret is in the shell.
// v150 (Jordan, 3 Oct): founder links use the vercel.app address of the same
// page, which opens on networks that block massageclub.io. Founder only; links
// sent to customers stay on massageclub.io.
const REPLY_BASE = "https://your-massage-pass-o5fo.vercel.app/bot.html";
async function replyUrl(phone: string): Promise<string> {
  return `${REPLY_BASE}?reply=${digitsOf(phone)}&sig=${await replySig(phone)}`;
}
async function inboxUrl(): Promise<string> {
  return `${REPLY_BASE}?inbox=1&sig=${await replySig("inbox")}`;
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
// fmt=json wraps the page for the bot.html shell; without it, raw HTML (useful
// for checking the page with curl).
function pageOut(url: URL, html: string, status = 200): Response {
  if (url.searchParams.get("fmt") === "json") return new Response(JSON.stringify({ html }), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
// No em or en dashes in anything a customer reads (standing rule).
const noDashes = (s: string) => String(s || "").replace(/\s*[—–]\s*/g, ", ").trim();

const REPLY_SYSTEM = `You write ONE WhatsApp message for Massage Club, a concierge in Madrid that books massages at professional studios for people, mostly English speakers. The founder will read your draft, may edit it, and sends it from the Massage Club WhatsApp number.

Rules, all of them hard:
- Write in the customer's language (Spanish if they write Spanish, otherwise English).
- First answer the thing they actually asked, plainly. Then move the booking one step on by asking the single next question for where they stopped (which day, what time, which area of Madrid, or their email).
- Facts you may use: a 60 minute relaxing massage at a professional studio is usually 50 to 85 EUR at the studio's listed price, paid directly at the studio, no fee from us. We ask several studios at once, send the customer the options and get them the best offer. Studios are all over Madrid (Centro, Salamanca, Chamberi, Retiro, Chamartin, Malasana and more).
- Never invent a discount, a price, a studio name, a time slot or availability. Never promise the therapist speaks English. Never claim massage detoxes, cures or boosts immunity.
- If they ask for anything sexual, "special", "extras", "happy ending", tantra or similar, the message is exactly: "We book therapeutic massage at licensed studios, nothing else." (Spanish: "Reservamos masajes terapéuticos en centros con licencia, nada más.") and nothing more.
- Never say you are handing them to a person or a representative.
- Do not include any link unless they ask what Massage Club is, for photos or for the website.
- Never claim we already asked a studio, checked availability, booked or did anything else unless the conversation above shows it happened.
- No em dashes, no en dashes, no links, no emoji, no bullet points. Under 60 words.
- Start with "Hi <first name>, Massage Club here." (Spanish: "Hola <nombre>, somos Massage Club.") using their first name if you know it, otherwise without a name.
Output only the message text.`;

// v142 (Jordan, 3 Oct): the same page answers STUDIOS, so the studio side of a
// booking can be handled without leaving it.
// v212 (16 Oct, Jordan: "i don't want it to look robotic"): vosotros, Jordan
// in the first person singular, the request's own duration, and no promise of
// a next client.
const STUDIO_REPLY_SYSTEM = `You write ONE WhatsApp message in Spanish from Jordan, of Massage Club, to a partner massage studio in Madrid. Massage Club sends them clients; the studio's reply decides whether a booking happens. Jordan reads your draft, may edit it, and sends it.

Rules, all hard:
- Spanish from Spain, short, warm and plain, the way a person writes on WhatsApp. Address the studio as vosotros (podéis, tenéis, decídmelo), never tú and never usted. Jordan speaks in the first person singular (os escribo, se lo paso, lo tengo apuntado), never "nosotros". Under 50 words. No em dashes, no en dashes, no emoji, no links, no brackets, no English words.
- Answer or acknowledge what the studio last said, then ask the one thing still needed (an exact start time, the final price for the duration given above the conversation, or whether they can take it at all). Never assume 60 minutes when another duration is given.
- Dates as "el lunes 19 de octubre", "hoy" or "mañana"; times as "a las 15:30"; prices as "65 €".
- Never confirm a booking, a time or the client's attendance on the client's behalf. Only the client confirms. If the studio offered a slot, say you are checking with the client and will tell them as soon as the client answers.
- Never invent a client name, time, price or discount, and never claim something was done unless the conversation shows it. Never say the client has another booking or went elsewhere unless the conversation shows it. If asking about price, you may add: "Si podéis hacerle un 10% como cliente de Massage Club, decídmelo."
- If the client cancelled or the request is no longer needed, say so plainly, tell them there is no need to hold the slot, and thank them. Do not promise to send them another client.
- Never write "sin comisión". Never say you are asking several studios unless the conversation already shows it.
- No signature unless this is the first message ever to this studio, in which case end with "Jordan, de Massage Club".
Output only the message text.`;

async function suggestReply(phone: string, studio?: { business_name: string } | null, esHint = false): Promise<string> {
  const s = await getSession(digitsOf(phone));
  if (studio) {
    // v212: vosotros, and the duration of the studio's newest request, not a
    // fixed 60 minutes.
    let mins = 60;
    try {
      const dq = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?phone=eq.${digitsOf(phone)}&order=created_at.desc&limit=1&select=request_id`, { headers: H() });
      const rid = (((await dq.json().catch(() => [])) || [])[0] || {}).request_id;
      if (rid) {
        const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${encodeURIComponent(String(rid))}&select=message_text`, { headers: H() });
        mins = reqDuration((((await rq.json().catch(() => [])) || [])[0]) || {});
      }
    } catch { /* 60 */ }
    const fb = `Gracias. ¿Me confirmáis la hora exacta y el precio final por ${mins} min?`;
    const key = await aiKey();
    if (!key) return fb;
    try {
      const thread = await recentThread(phone);
      // v208: with no messages the model invented a pitch ("plataforma de
      // masajes en Barcelona", "a domicilio") for Chalalai. Nothing to answer
      // means no suggestion.
      if (!thread.length) return "";
      const convo = thread.map((m) => `${m.dir === "in" ? "Studio" : "Us"}: ${m.body.slice(0, 300)}`).join("\n");
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 14000);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: ctl.signal,
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: AI_MODEL, max_tokens: 300, system: STUDIO_REPLY_SYSTEM, messages: [{ role: "user", content: `Studio: ${studio.business_name}\nThe client's latest request with this studio is for ${mins} minutes.\n\nConversation, oldest first:\n${convo}\n\nWrite the reply.` }] }),
      });
      clearTimeout(timer);
      if (!res.ok) return fb;
      const out = await res.json();
      return noDashes(String(out?.content?.[0]?.text || "")).replace(/^["']|["']$/g, "") || fb;
    } catch (_e) { return fb; }
  }
  const es = esHint || s.data?.lang === "es";
  const first = String(s.wa_name || "").trim().split(/\s+/)[0] || "";
  const fallback = es
    ? `Hola${first ? " " + first : ""}, somos Massage Club. ¿Qué día te viene bien para el masaje?`
    : `Hi${first ? " " + first : ""}, Massage Club here. Which day works for your massage?`;
  const key = await aiKey();
  if (!key) return fallback;
  try {
    const thread = await recentThread(phone);
    const st = await bookingState(phone);
    const convo = thread.map((m) => `${m.dir === "in" ? "Customer" : "Us"}: ${m.body.slice(0, 300)}`).join("\n");
    const user = `Customer's WhatsApp name: ${s.wa_name || "unknown"}\nBot step they are on: ${s.step}\nBooking: ${st.line}\n\nConversation, oldest first:\n${convo}\n\nWrite the reply.`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 14000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 300, system: REPLY_SYSTEM, messages: [{ role: "user", content: user }] }),
    });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const out = await res.json();
    const text = noDashes(String(out?.content?.[0]?.text || "")).replace(/^["']|["']$/g, "");
    return text || fallback;
  } catch (e) {
    console.log("[wa] suggestReply failed", String(e));
    return fallback;
  }
}

// v139: the founder pages. Mobile first, Massage Club palette, no external
// assets, so they load instantly on a phone from an alert.
const PAGE_CSS = `*{box-sizing:border-box}body{margin:0;background:${C.page};font-family:${SANS};color:${C.ink};-webkit-font-smoothing:antialiased}
a{color:inherit}main{max-width:760px;margin:0 auto;padding:0 0 20px}
.day{align-self:center;margin:14px 0 6px;font-size:11.5px;font-weight:700;letter-spacing:1px;color:${C.muted};background:#fff;border:1px solid ${C.line};border-radius:999px;padding:4px 12px}
.tm{display:block;text-align:right;font-size:10.5px;color:${C.muted};margin-top:3px}
.en{display:block;margin-top:6px;padding-top:6px;border-top:1px dashed ${C.dash};font-size:13px;color:#5E7A64;font-style:italic}
.btns{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.btns span{font-size:12px;font-weight:600;color:${C.clay};background:#fff;border:1px solid ${C.dash};border-radius:999px;padding:3px 9px}
.top{position:sticky;top:0;z-index:5;background:${C.page}ee;backdrop-filter:blur(8px);padding:14px 16px 10px;display:flex;align-items:center;gap:12px;border-bottom:1px solid ${C.dash}}
.top img{width:36px;height:36px;border-radius:50%}.top .t{flex:1;min-width:0}.brand{font-size:10.5px;font-weight:700;letter-spacing:3px;color:${C.clay}}
.top h1{margin:1px 0 0;font-family:${SERIF};font-size:19px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top .sub{color:${C.muted};font-size:12.5px}.back{text-decoration:none;font-size:13px;font-weight:700;color:${C.clay};white-space:nowrap}
.pill{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.5px;padding:4px 10px;border-radius:999px}
.pill.ok{background:#E6F4EA;color:#1F7A45}.pill.warn{background:#FBE9E3;color:#9A3B1E}.pill.wait{background:${C.clay};color:#fff}.pill.mute{background:#EEE7DD;color:${C.muted}}
.wrap{padding:14px 16px}.thread{display:flex;flex-direction:column;gap:6px}
.msg{max-width:84%;padding:9px 12px 7px;border-radius:16px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 0 rgba(0,0,0,.04)}
.msg.them{align-self:flex-start;background:#fff;border-bottom-left-radius:5px}.msg.us{align-self:flex-end;background:#F6E7DC;border-bottom-right-radius:5px}
.who{display:block;font-size:10.5px;font-weight:700;letter-spacing:1px;margin-bottom:2px}.them .who{color:${C.clay}}.us .who{color:${C.muted}}
.note{border-radius:14px;padding:11px 14px;font-size:14px;margin:12px 16px 0}.note.done{background:#E6F4EA;color:#1F7A45}.note.err{background:#FBE9E3;color:#9A3B1E}
.compose{position:sticky;bottom:0;background:#fff;border-top:1px solid ${C.dash};padding:10px 12px calc(12px + env(safe-area-inset-bottom));box-shadow:0 -6px 18px rgba(38,32,25,.06)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.two label{display:block;font-size:11px;font-weight:700;letter-spacing:1px;color:${C.muted};margin:0 0 4px 4px;text-transform:uppercase}
.two textarea{width:100%;min-height:96px}@media (max-width:620px){.two{grid-template-columns:1fr}.two textarea{min-height:70px}}
.row2{display:flex;align-items:center;gap:10px;margin-top:8px}.lang{flex:1;font-size:13px;color:${C.ink};display:flex;gap:12px;align-items:center;flex-wrap:wrap}.lang label{display:flex;gap:4px;align-items:center;font-weight:600}
.busy{opacity:.55}.btnrow{margin-top:8px}.btnrow .bl{display:block;font-size:11px;font-weight:700;letter-spacing:1px;color:${C.muted};margin:0 0 4px 4px;text-transform:uppercase}
.bi{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.bi input{min-width:0;border:1px solid ${C.dash};border-radius:999px;padding:8px 12px;font:14px ${SANS};color:${C.ink};background:${C.cream}}
.presets{margin-top:6px;padding-bottom:0}.chip.preset{background:#fff}
.compose .in{max-width:760px;margin:0 auto}.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
.chip{flex:0 0 auto;border:1px solid ${C.dash};background:${C.cream};color:${C.ink};border-radius:999px;padding:7px 12px;font-size:12.5px;font-weight:600;cursor:pointer}
.row{display:flex;gap:8px;align-items:flex-end}textarea{flex:1;min-height:46px;max-height:40vh;resize:vertical;border:1px solid ${C.dash};border-radius:18px;padding:11px 14px;font:15px/1.45 ${SANS};color:${C.ink};background:${C.cream}}
textarea:focus{outline:2px solid ${C.clay}33;border-color:${C.clay}}
.send{border:0;background:${C.clay};color:#fff;border-radius:999px;height:46px;padding:0 18px;font-size:15px;font-weight:700;cursor:pointer}.send:disabled{background:#cbbfb2}
.hint{color:${C.muted};font-size:11.5px;margin-top:6px}
.card{display:block;text-decoration:none;background:#fff;border:1px solid ${C.line};border-radius:18px;padding:14px 16px;margin:10px 16px 0}
.card .h{display:flex;align-items:center;gap:8px}.card .n{font-weight:700;font-size:15.5px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card .q{margin:8px 0 0;color:${C.ink};font-size:14px;line-height:1.45;font-style:italic}.card .m{margin-top:8px;color:${C.muted};font-size:12px}
.sec{margin:20px 16px 0;font-size:11px;font-weight:700;letter-spacing:2.5px;color:${C.muted}}.empty{margin:30px 16px;color:${C.muted};text-align:center;font-size:14px}`;

function pageShell(title: string, top: string, body: string, extra = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body><main>${top}${body}</main>${extra}</body></html>`;
}

// One-tap answers Jordan reaches for most. Inserted into the box, never sent
// on their own, so he can still edit before tapping Send.
function studioQuickReplies(): Array<[string, string]> {
  return [
    ["Hora exacta", "Gracias. ¿Me confirmáis la hora exacta?"],
    ["Precio final", "¿Qué precio final le dejaríais por 60 min? Si podéis hacerle un 10% como cliente de Massage Club, decídmelo."],
    ["Lo confirmo", "Vale, gracias. Lo confirmo con el cliente y os digo algo en cuanto me conteste."],
    ["Ya no hace falta", "Gracias. Al final ya no lo necesita, así que no hace falta que le guardéis hueco."],
    ["Gracias", "Muchas gracias."],
  ];
}
function quickReplies(es: boolean, first: string): Array<[string, string]> {
  const hi = es ? `Hola${first ? " " + first : ""}, somos Massage Club. ` : `Hi${first ? " " + first : ""}, Massage Club here. `;
  return es ? [
    ["Qué día", hi + "¿Qué día te viene bien para el masaje?"],
    ["Qué hora", hi + "¿A qué hora te viene mejor? Por ejemplo, las 18:00."],
    ["Qué zona", hi + "¿En qué zona de Madrid estás? Así busco el centro más cercano."],
    ["Precio", hi + "Un masaje relajante de 60 min en un centro profesional suele costar entre 50 y 85 EUR, según la tarifa del centro. Pagas directamente en el centro, sin comisión."],
    ["Mejor oferta", hi + "Preguntamos a varios centros a la vez, te mandamos las opciones y te conseguimos la mejor oferta. ¿Qué día te viene bien?"],
    ["Solo terapéutico", "Reservamos masajes terapéuticos en centros con licencia, nada más."],
  ] : [
    ["Which day", hi + "Which day works for your massage?"],
    ["What time", hi + "What time suits you? For example 18:00."],
    ["Which area", hi + "Which part of Madrid are you in? Then I can find the closest studio."],
    ["Price", hi + "A 60 min relaxing massage at a professional studio is usually 50 to 85 EUR at the studio's listed price, paid directly at the studio, no fee from us."],
    ["Best offer", hi + "We ask several studios at once, send you the options and get you the best offer. Which day works for you?"],
    ["Therapeutic only", "We book therapeutic massage at licensed studios, nothing else."],
  ];
}

// v145 (Jordan, 3 Oct): "I need to type and it auto translate into Spanish,
// and you translate what they say into English." One model call per page for
// the incoming side, one per send for the outgoing side. Both fail soft: no
// translation shown, or the text sent exactly as typed is never the result of a
// failure (a failed outgoing translation stops the send instead).
async function aiText(system: string, user: string, maxTokens = 1500, timeoutMs = 12000): Promise<string | null> {
  const key = await aiKey();
  if (!key) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const out = await res.json();
    return String(out?.content?.[0]?.text || "");
  } catch (_e) { return null; }
}
// English for every message that is not already English, by index.
// v149 (Jordan, 3 Oct: "all chats need to have an English translation"): each
// message is translated once and saved in wa_messages.body_en (NULL = not yet,
// "" = already English), so a page view only translates what is new, and a
// failed batch is retried instead of leaving the whole page without English.
const TRANSLATE_SYSTEM = "Translate each numbered WhatsApp message into natural English. These are customers and massage studios in Madrid: keep place and neighbourhood names as they are (Sol, Centro, Chueca, Salamanca, Retiro and so on), and keep names, times and prices exactly. Use an empty string only when a message is entirely in English; if any part is Spanish, translate the whole message. Reply with one JSON object only, mapping each message number to its translation, like {\"1\": \"...\", \"2\": \"\"}. Every number must be present. No commentary.";
async function translateIncoming(thread: Array<{ id?: number; dir: string; body: string; en?: string | null }>): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const want = thread.map((m, i) => ({ m, i })).filter(({ m }) => /[a-záéíóúñü]/i.test(m.body) && !/^\[(tap|template|reaction|location)/.test(m.body));
  const todo: typeof want = [];
  for (const w of want) {
    if (typeof w.m.en === "string") { if (w.m.en) out.set(w.i, w.m.en); }
    else todo.push(w);
  }
  if (!todo.length) return out;
  const clean = (b: string) => b.replace(/\s*\[via ad\]$/, "").replace(/\s*\[[^\[\]]*\/[^\[\]]*\]$/, "").replace(/^\[solicitud[^\]]*\]\s*/, "").replace(/\s+/g, " ").slice(0, 500);
  const batches: Array<typeof todo> = [];
  for (let k = 0; k < Math.min(todo.length, 120); k += 12) batches.push(todo.slice(k, k + 12));
  const saves: Array<Promise<unknown>> = [];
  await Promise.all(batches.map(async (b, bi) => {
    const list = b.map(({ m }, k) => `${k + 1}. ${clean(m.body)}`).join("\n");
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 700 * attempt + bi * 150));
      const raw = await aiText(TRANSLATE_SYSTEM, list, 2500, 20000);
      const jm = raw && raw.match(/\{[\s\S]*\}/);
      if (!jm) continue;
      let obj: Record<string, unknown>;
      try { obj = JSON.parse(jm[0]); } catch (_e) { continue; }
      if (!obj || typeof obj !== "object") continue;
      b.forEach(({ m, i }, k) => {
        const v = obj[String(k + 1)];
        if (typeof v !== "string") return;
        const t = noDashes(v).trim();
        if (t && !sameText(t, clean(m.body))) out.set(i, t);
        if (m.id) saves.push(fetch(`${SUPABASE_URL}/rest/v1/wa_messages?id=eq.${m.id}`, { method: "PATCH", headers: { ...H(), "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ body_en: t && !sameText(t, clean(m.body)) ? t : "" }) }).catch(() => null));
      });
      return;
    }
  }));
  await Promise.all(saves);
  return out;
}
// Spanish (Spain) version of what Jordan typed, or null when it could not be done.
async function toSpanish(text: string, studio: boolean): Promise<string | null> {
  const raw = await aiText(`Translate the message into natural Spanish from Spain for WhatsApp, written to ${studio ? "a massage studio we work with (use vosotros where it addresses the studio)" : "a customer (use tú)"}. If it is already Spanish, return it unchanged. Keep names, times, prices and addresses exactly. No em dashes, no en dashes. Output only the message.`, text, 800);
  return raw === null ? null : noDashes(raw).replace(/^["']|["']$/g, "").trim() || null;
}
const sameText = (a: string, b: string) => a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();

// v141 (Jordan, 3 Oct): the reply page shows the WHOLE conversation, with the
// day and the Madrid time on every message, not just the last dozen.
async function fullThread(phone: string): Promise<Array<{ id: number; dir: string; body: string; at: string; en: string | null }>> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${digitsOf(phone)}&order=created_at.desc&limit=500&select=id,direction,body,created_at,body_en`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) ? rows : []).reverse().map((x: any) => ({ id: Number(x.id) || 0, dir: String(x.direction || ""), body: String(x.body || ""), at: String(x.created_at || ""), en: typeof x.body_en === "string" ? x.body_en : null }));
}
const madridDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
const madridTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// v151: ready-made button sets for the reply page, in the chat's language.
function buttonPresets(es: boolean): Array<[string, string[]]> {
  return es
    ? [["Sí / No", ["Sí", "No"]], ["Hoy / Mañana", ["Hoy", "Mañana", "Otro día"]], ["Franja", ["Mañana (10-13)", "Tarde (13-18)", "Noche (18-21)"]], ["Reservar", ["Sí, reservar", "Otra hora"]]]
    : [["Yes / No", ["Yes", "No"]], ["Today / Tomorrow", ["Today", "Tomorrow", "Another day"]], ["Time of day", ["Morning (10-13)", "Afternoon (13-18)", "Evening (18-21)"]], ["Book it", ["Yes, book it", "Another time"]]];
}
function replyHtml(o: { phone: string; name: string; thread: Array<{ dir: string; body: string; at?: string }>; draft: string; open: boolean; hoursLeft: number | null; muted: boolean; sent: boolean; error: string; action: string; inbox: string; es: boolean; studio?: boolean; trans?: Map<number, string>; notice?: string; mediaSig?: string }): string {
  const first = o.studio ? String(o.name || "STUDIO") : (String(o.name || "").trim().split(/\s+/)[0] || "");
  const pill = o.muted ? `<span class="pill mute">MUTED</span>`
    : o.open ? `<span class="pill ok">${o.hoursLeft !== null ? `${Math.floor(o.hoursLeft)}h left` : "OPEN"}</span>`
    : `<span class="pill warn">WINDOW CLOSED</span>`;
  const top = `<div class="top"><img src="${LOGO_URL}" alt=""><div class="t"><div class="brand">MASSAGE CLUB</div><h1>${esc(o.name || "Customer")}</h1><div class="sub">${o.studio ? "Studio · " : ""}+${esc(o.phone)} · ${pill}</div></div><a class="back" href="${esc(o.inbox)}">All chats</a></div>`;
  let lastDay = "";
  const bubbles = o.thread.map((m, mi) => {
    const them = m.dir === "in";
    const en = o.trans?.get(mi);
    let body = (them ? m.body : prettyLogged(m.body)).replace(/\s*\[via ad\]$/, "").slice(0, 1500);
    // A message sent with buttons is logged as "text [A/B/C]"; show the buttons.
    let btns = "";
    const bm = body.match(/^([\s\S]*?)\s*\[([^\[\]]{1,300})\]$/);
    // v177: a link button is logged as "[Book now: https://...]". Its "/"s are
    // part of the address, not separators: show one button, as the customer
    // sees it in WhatsApp.
    const link = !them && bm ? /^([^:\/]{1,40}):\s*(https?:\/\/\S+)$/.exec(bm[2]) : null;
    if (link) {
      body = bm![1];
      btns = `<span class="btns"><a href="${esc(link[2])}" target="_blank" rel="noopener" style="text-decoration:none"><span>${esc(link[1].trim())} ↗</span></a></span>`;
    } else if (!them && bm && bm[2].includes("/") && !/^template /.test(bm[2])) {
      body = bm[1];
      btns = `<span class="btns">${bm[2].split("/").map((b) => `<span>${esc(b.trim())}</span>`).join("")}</span>`;
    }
    // v163: a saved voice note plays here, with its transcript if there is one.
    let player = "";
    const vn = them && /^\[voice note(?: ([0-9]+\/[0-9]+\.[a-z0-9]+))?\]\s*([\s\S]*)$/.exec(body);
    if (vn) {
      body = vn[2] ? `🎤 ${vn[2]}` : "🎤 Voice note (not transcribed yet)";
      if (vn[1] && o.mediaSig) player = `<audio controls preload="none" style="display:block;width:100%;margin-top:6px" src="${SUPABASE_URL}/functions/v1/wa-bot?media=${encodeURIComponent(vn[1])}&sig=${o.mediaSig}"></audio>`;
    }
    const tap = them && /^\[tap: ?([^\]]*)\]$/.exec(body);
    if (tap) body = tap[1] ? `Tapped: ${tap[1].replace(/_/g, " ")}` : "Sent a voice note or media";
    const day = m.at ? madridDay(m.at) : "";
    const divider = day && day !== lastDay ? `<div class="day">${esc(day)}</div>` : "";
    if (day) lastDay = day;
    const time = m.at ? `<span class="tm">${madridTime(m.at)}</span>` : "";
    const enLine = en ? `<span class="en">EN: ${esc(en)}</span>` : "";
    return `${divider}<div class="msg ${them ? "them" : "us"}"><span class="who">${them ? esc(first || "THEM").toUpperCase() : "MASSAGE CLUB"}</span>${esc(body)}${player}${enLine}${btns}${time}</div>`;
  }).join("");
  const notes = (o.notice ? `<div class="note done">${o.notice}</div>` : "")
    + (o.sent ? `<div class="note done">Sent from the bot number. The bot carries on from here.</div>` : "")
    + (o.error ? `<div class="note err">${esc(o.error)}</div>` : "")
    + (!o.open && !o.muted && !o.studio ? `<div class="note err">It has been over 24 hours since they last wrote, so WhatsApp will not deliver a normal message. Only an approved template can reach them now.</div>` : "")
    + (!o.open && !o.muted && o.studio ? `<div class="note">They have not written to us in the last 24 hours, so your message goes inside a WhatsApp template: "Hola, soy Jordan, de Massage Club. <i>your message</i> Gracias." Until Meta approves that one it goes as "Hola, os escribimos de Massage Club sobre una reserva: <i>your message</i>. Podéis responder aquí mismo. Gracias.", whose full stop is fixed, so end on a statement, not a question. Buttons are not added to it.</div>` : "")
    + (o.muted ? `<div class="note err">This number is muted. Nothing is ever sent to it.</div>` : "");
  // v208 (Jordan, 15 Oct: "i want to be able to send a message to the studio
  // like i can to the customers"): a studio can always be written to. With the
  // 24h window shut it goes as a template (studioClosedSend).
  const can = (o.open || !!o.studio) && !o.muted;
  const chips = (o.studio ? studioQuickReplies() : quickReplies(o.es, first)).map(([label, text]) =>
    `<button type="button" class="chip" data-l="${o.studio || o.es ? "es" : "en"}" data-t="${esc(text)}">${esc(label)}</button>`).join("");
  // v148 (Jordan, 3 Oct): side by side. He writes in English on the left, the
  // Spanish appears live on the right (editable), and the box he picks is what
  // gets sent. bot.html does the live translation through mode=translate.
  const sendEs = o.es;
  const compose = `<form class="compose" method="post" action="${esc(o.action)}"><div class="in">${can ? `<div class="chips">${chips}</div>` : ""}
<div class="two">
<div><label for="src">You write (English)</label><textarea id="src" rows="4" ${can ? "" : "disabled"} placeholder="Type in English. The Spanish appears on the right.">${sendEs ? "" : esc(o.draft)}</textarea></div>
<div><label for="t">Spanish (edit freely)</label><textarea id="t" rows="4" ${can ? "" : "disabled"} placeholder="La traducción aparece aquí.">${sendEs ? esc(o.draft) : ""}</textarea></div>
</div>
<div class="btnrow"><span class="bl">Tap buttons (optional, up to 3, max 20 letters each)</span>
<div class="bi"><input name="b1" maxlength="20" ${can ? "" : "disabled"} placeholder="Button 1"><input name="b2" maxlength="20" ${can ? "" : "disabled"} placeholder="Button 2"><input name="b3" maxlength="20" ${can ? "" : "disabled"} placeholder="Button 3"></div>
${can ? `<div class="chips presets">${buttonPresets(o.studio || o.es).map(([label, set]) => `<button type="button" class="chip preset" data-b="${esc(set.join("|"))}">${esc(label)}</button>`).join("")}<button type="button" class="chip preset" data-b="">Clear</button></div>` : ""}</div>
<div class="row2"><span class="lang">Send:
<label><input type="radio" name="lang" value="es" ${sendEs ? "checked" : ""} ${can ? "" : "disabled"}> Spanish</label>
<label><input type="radio" name="lang" value="en" ${sendEs ? "" : "checked"} ${can ? "" : "disabled"}> English</label></span>
<button class="send" type="submit" ${can ? "" : "disabled"}>Send</button></div>
<div class="hint">${can ? (o.studio ? "Sends from +34 613 977 900. Studios only get messages between 09:00 and 21:00 Madrid." : "Sends from +34 613 977 900 as Massage Club.") + " Only the box you pick under Send goes out." : "Sending is off for this chat."}</div></div></form>`;
  const js = "";
  return pageShell(`Reply · ${o.name || "+" + o.phone}`, top, `${notes}<div class="wrap"><div class="thread">${bubbles || `<p class="empty">No messages yet.</p>`}</div></div>`, compose + js);
}

// v143 (Jordan, 3 Oct): ONE link to watch everything. Every conversation from
// the last 7 days, customers and studios on separate tabs, showing the last
// message either way (so he sees what the bot is SENDING, not only what came
// in), whether he can still write freely, and one tap into the chat to step in.
// v153 (Jordan, 4 Oct): "Invoice, tracking the customer, confirming the appt,
// auto invoice at the end of the month." The money side of the platform.
//
//   ?billing=1&sig=<inbox sig>     Jordan's page: every booking with whether it
//                                  happened and the fee it owes, the monthly
//                                  invoices, and the one-tap actions.
//   ?invoice=<id>&t=<view_token>   the invoice as the studio sees it (Spanish).
//
// The ledger is the mc_booking_ledger view, the drafts come from
// generate_monthly_invoices() (pg_cron, 1st of the month). Nothing reaches a
// studio until Jordan taps "Approve and send", and that refuses while the
// issuer details in billing_settings still read "TO FILL".
const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const eur2 = (n: unknown) => `${Number(n || 0).toFixed(2).replace(".", ",")} EUR`;
// v212: what a studio reads on its invoice: "12,10 €", "1 de noviembre de
// 2026", "19/10/2026". Jordan's billing page keeps eur2.
const eur2Es = (n: unknown) => `${Number(n || 0).toFixed(2).replace(".", ",")} €`;
const fechaLargaEs = (iso: unknown, year = true) => {
  const d = new Date(String(iso || "").slice(0, 10) + "T12:00:00Z");
  return isNaN(d.getTime()) ? String(iso || "") : `${d.getUTCDate()} de ${MONTHS_ES[d.getUTCMonth()]}${year ? ` de ${d.getUTCFullYear()}` : ""}`;
};
const fechaCortaEs = (iso: unknown) => {
  const m = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
};
async function billingSettings(): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/billing_settings?id=eq.1&select=*`, { headers: H() });
  return ((await r.json().catch(() => [])) || [])[0] || {};
}
async function billingUrl(): Promise<string> {
  return `${REPLY_BASE}?billing=1&sig=${await replySig("inbox")}`;
}
function invoiceUrl(inv: { id: number; view_token: string }): string {
  return `https://book.massageclub.io/bot.html?invoice=${inv.id}&t=${inv.view_token}`;
}

async function invoicePage(url: URL): Promise<Response> {
  const id = Number(url.searchParams.get("invoice") || 0);
  const t = String(url.searchParams.get("t") || "");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/studio_invoices?id=eq.${id}&select=*`, { headers: H() });
  const inv = ((await r.json().catch(() => [])) || [])[0];
  if (!inv || !t || t !== inv.view_token || inv.status === "void") return pageOut(url, pageShell("Factura", "", `<p class="empty">Este enlace no es válido.</p>`), 404);
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${inv.partner_id}&select=business_name,billing_name,billing_tax_id,billing_address,address`, { headers: H() });
  const p = ((await pr.json().catch(() => [])) || [])[0] || {};
  const st = await billingSettings();
  const per = new Date(inv.period_start + "T12:00:00Z");
  const lines = (Array.isArray(inv.lines) ? inv.lines : []).map((l: any) =>
    `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};">${esc(fechaCortaEs(l.date))}</td><td style="padding:7px 6px;border-bottom:1px solid ${C.line};">Cliente de Massage Club: ${esc(String(l.client || "").split(" ")[0])} · ${esc(trSvc(String(l.service || "Masaje"), "es"))}</td><td style="padding:7px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap;">${eur2Es(l.fee)}</td></tr>`).join("");
  const body = `<div style="background:#fff;margin:16px;border-radius:18px;padding:22px 20px;font-size:14px;line-height:1.5;">
<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div><div style="font-size:11px;font-weight:700;letter-spacing:3px;color:${C.clay};">MASSAGE CLUB</div><h1 style="margin:4px 0 0;font-family:Georgia,serif;font-size:24px;">Factura ${esc(inv.number || "")}</h1></div>
<div style="text-align:right;color:${C.muted};font-size:13px;">Fecha: ${esc(fechaLargaEs(inv.issued_on))}<br>Vencimiento: ${esc(fechaLargaEs(inv.due_on))}<br>${inv.status === "paid" ? `<b style="color:#1F7A45;">PAGADA</b>` : ""}</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px;font-size:13px;">
<div><b>Emisor</b><br>${esc(st.issuer_name)}<br>${esc(st.issuer_tax_id)}<br>${esc(st.issuer_address)}<br>${esc(st.issuer_email)}</div>
<div><b>Cliente</b><br>${esc(p.billing_name || p.business_name || "")}<br>${esc(p.billing_tax_id || "")}<br>${esc(p.billing_address || p.address || "")}</div></div>
<p style="margin:18px 0 6px;"><b>Concepto:</b> comisión por la primera visita de los clientes nuevos que Massage Club os envió en ${MONTHS_ES[per.getUTCMonth()]} de ${per.getUTCFullYear()} y que vinieron a su cita. Las siguientes visitas de esos clientes no se cobran.</p>
<table style="width:100%;border-collapse:collapse;font-size:13px;">${lines}</table>
<table style="width:100%;margin-top:12px;font-size:14px;"><tr><td>Base imponible</td><td style="text-align:right;">${eur2Es(inv.subtotal)}</td></tr><tr><td>IVA (${Number(inv.vat_rate)}%)</td><td style="text-align:right;">${eur2Es(inv.vat)}</td></tr><tr><td style="padding-top:6px;"><b>Total</b></td><td style="text-align:right;padding-top:6px;"><b>${eur2Es(inv.total)}</b></td></tr></table>
<p style="margin:18px 0 0;font-size:13px;color:${C.muted};">Pago por transferencia a ${esc(st.iban)}, indicando ${esc(inv.number || "")} en el concepto. Gracias por trabajar con nosotros.</p></div>`;
  return pageOut(url, pageShell(`Factura ${inv.number || ""}`, "", body));
}

async function billingPage(url: URL): Promise<Response> {
  const sig = String(url.searchParams.get("sig") || "");
  if (sig !== (await replySig("inbox"))) return pageOut(url, pageShell("Link not valid", "", `<p class="empty">This link is not valid.</p>`), 403);
  const base = await billingUrl();
  const act = String(url.searchParams.get("do") || "");
  let note = "", noteErr = false;
  const patch = (table: string, q: string, body: unknown) => fetch(`${SUPABASE_URL}/rest/v1/${table}?${q}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify(body) });
  const st = await billingSettings();
  const unfilled = ["issuer_name", "issuer_tax_id", "issuer_address", "iban"].filter((k) => /^TO FILL/i.test(String(st[k] || "")));
  // One-tap actions. GET so the bot.html shell can run them; each is safe to
  // repeat (a sent invoice is not sent twice, a completed booking stays so).
  if (act === "done" || act === "noshow") {
    const b = Number(url.searchParams.get("b") || 0);
    if (b) {
      await patch("bookings", `id=eq.${b}&invoice_id=is.null`, act === "done" ? { completed_at: new Date().toISOString(), completed_source: "founder", no_show_at: null } : { no_show_at: new Date().toISOString(), completed_at: null });
      note = act === "done" ? `Booking ${b} marked as happened. If it is a new customer's first visit from ${st.fees_from || "the fee start date"}, it goes on the next invoice; otherwise it is free.` : `Booking ${b} marked as a no-show. No fee.`;
    }
  } else if (act === "generate") {
    const m = String(url.searchParams.get("m") || "");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/generate_monthly_invoices`, { method: "POST", headers: H(), body: JSON.stringify(/^\d{4}-\d{2}-01$/.test(m) ? { p_month: m } : {}) });
    const n = await res.json().catch(() => null);
    note = res.ok ? `${Number(n) || 0} new draft invoice${Number(n) === 1 ? "" : "s"} created.` : "Could not create invoices; check the logs.";
    noteErr = !res.ok;
  } else if (act === "send" || act === "paid" || act === "void") {
    const i = Number(url.searchParams.get("i") || 0);
    const ir = await fetch(`${SUPABASE_URL}/rest/v1/studio_invoices?id=eq.${i}&select=*`, { headers: H() });
    const inv = ((await ir.json().catch(() => [])) || [])[0];
    if (!inv) { note = "Invoice not found."; noteErr = true; }
    else if (act === "paid") { await patch("studio_invoices", `id=eq.${i}`, { status: "paid", paid_at: new Date().toISOString() }); note = `${inv.number} marked as paid.`; }
    else if (act === "void") {
      if (inv.status === "draft") {
        await patch("bookings", `invoice_id=eq.${i}`, { invoice_id: null });
        await fetch(`${SUPABASE_URL}/rest/v1/studio_invoices?id=eq.${i}`, { method: "DELETE", headers: H() });
        note = `Draft ${inv.number} deleted; its bookings are free to invoice again.`;
      } else { await patch("studio_invoices", `id=eq.${i}`, { status: "void" }); note = `${inv.number} voided.`; }
    } else if (inv.status !== "draft") { note = `${inv.number} was already sent.`; }
    else if (unfilled.length) { note = `Not sent. Fill in your invoice details first (${unfilled.join(", ")}) in billing_settings.`; noteErr = true; }
    else {
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${inv.partner_id}&select=business_name,billing_email,email`, { headers: H() });
      const p = ((await pr.json().catch(() => [])) || [])[0] || {};
      const to = String(p.billing_email || p.email || "").trim();
      if (!to || !RESEND_API_KEY) { note = `Not sent: ${p.business_name || "this studio"} has no email on file.`; noteErr = true; }
      else {
        const per = new Date(inv.period_start + "T12:00:00Z");
        const month = `${MONTHS_ES[per.getUTCMonth()]} de ${per.getUTCFullYear()}`;
        // v212: the house greeting and "who we are" line, the due date in
        // Spanish, "12,10 €", "os enviamos" said once.
        const n = (inv.lines || []).length;
        const subject = `Factura ${inv.number} de Massage Club, ${month}`;
        const text = `Hola${p.business_name ? `, equipo de ${p.business_name}:` : ","}\n\nSoy Jordan, de Massage Club, un servicio de reservas de masajes en Madrid. Os paso la factura ${inv.number} de ${month}: ${n === 1 ? "la primera visita de un cliente nuevo" : `la primera visita de ${n} clientes nuevos`}, ${eur2Es(inv.total)} con IVA incluido.\n\nPodéis verla aquí: ${invoiceUrl(inv)}\n\n${inv.due_on ? `Se paga por transferencia antes del ${fechaLargaEs(inv.due_on, false)}.` : "Se paga por transferencia."} Si tenéis cualquier duda, contestad a este correo.\n\nUn saludo,\nJordan, de Massage Club`;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM_EMAIL, to: [to], reply_to: "support@massageclub.io", subject, text }),
        }).catch(() => null);
        if (res && res.ok) {
          await patch("studio_invoices", `id=eq.${i}&status=eq.draft`, { status: "sent", sent_at: new Date().toISOString(), sent_to: to });
          note = `${inv.number} sent to ${to}.`;
          // v212: it bypasses emailStudio, so it gets its own copy to Jordan.
          studioCopyLater(to, "Email", text, { studio: { business_name: String(p.business_name || "") }, subject });
        }
        else { note = "The email did not go out. Nothing was marked as sent."; noteErr = true; }
      }
    }
  }
  const lr = await fetch(`${SUPABASE_URL}/rest/v1/mc_booking_ledger?select=*&order=start_at.desc&limit=200`, { headers: H() });
  const ledger: any[] = await lr.json().catch(() => []);
  const ivr = await fetch(`${SUPABASE_URL}/rest/v1/studio_invoices?select=*,partners(business_name)&order=created_at.desc&limit=60`, { headers: H() });
  const invoices: any[] = await ivr.json().catch(() => []);
  const now = new Date();
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const pill = (a: string) => a === "completed" ? `<span class="pill ok">HAPPENED</span>` : a === "to_confirm" ? `<span class="pill wait">TO CONFIRM</span>` : a === "upcoming" ? `<span class="pill mute">UPCOMING</span>` : `<span class="pill warn">${esc(a.replace("_", " ").toUpperCase())}</span>`;
  const btn = (href: string, label: string, strong = false) => `<a href="${esc(href)}" style="display:inline-block;text-decoration:none;font-size:12.5px;font-weight:700;padding:6px 12px;border-radius:999px;margin:6px 6px 0 0;${strong ? `background:${C.clay};color:#fff;` : `background:#fff;color:${C.ink};border:1px solid ${C.dash};`}">${label}</a>`;
  // v213: pilot-period and repeat visits carry no fee and are never invoiced.
  const owed = (Array.isArray(ledger) ? ledger : []).filter((l) => l.attendance === "completed" && !l.invoice_id && Number(l.fee || 0) > 0);
  const freeWhy = (l: any) => Number(l.fee || 0) > 0 ? "" : st.fees_from && l.start_at && ISO_MADRID.format(new Date(l.start_at)) < String(st.fees_from) ? " (pilot, free)" : l.first_visit === false ? " (repeat visit, free)" : "";
  const owedSum = owed.reduce((a, l) => a + Number(l.fee || 0), 0);
  const fmtWhen = (iso: string) => iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";
  const ledgerCards = (Array.isArray(ledger) ? ledger : []).map((l) => `<div class="card"><div class="h"><span class="n">${esc(l.business_name || "")}</span>${pill(String(l.attendance))}</div>
<div class="m">${esc(fmtWhen(l.start_at))} · ${esc(String(l.client_name || "").split(" ")[0])} · ${esc(l.service || "")}${l.price ? ` · ${esc(String(l.price))} EUR` : ""} · fee <b>${eur2(l.fee)}</b>${freeWhy(l)}${l.invoice_id ? " · invoiced" : ""}</div>
${!l.invoice_id && (l.attendance === "to_confirm" || l.attendance === "completed" || l.attendance === "no_show") ? `<div>${l.attendance !== "completed" ? btn(`${base}&do=done&b=${l.booking_id}`, "It happened") : ""}${l.attendance !== "no_show" ? btn(`${base}&do=noshow&b=${l.booking_id}`, "No-show") : ""}</div>` : ""}</div>`).join("");
  const invCards = (Array.isArray(invoices) ? invoices : []).map((v) => `<div class="card"><div class="h"><span class="n">${esc(v.number || "")} · ${esc(v.partners?.business_name || "")}</span><span class="pill ${v.status === "paid" ? "ok" : v.status === "sent" ? "wait" : v.status === "void" ? "mute" : "warn"}">${esc(String(v.status).toUpperCase())}</span></div>
<div class="m">${esc(v.period_start)} to ${esc(v.period_end)} · ${(v.lines || []).length} booking${(v.lines || []).length === 1 ? "" : "s"} · <b>${eur2(v.total)}</b> incl. IVA${v.sent_to ? ` · sent to ${esc(v.sent_to)}` : ""}</div>
<div>${btn(invoiceUrl(v), "View")}${v.status === "draft" ? btn(`${base}&do=send&i=${v.id}`, "Approve and send", true) + btn(`${base}&do=void&i=${v.id}`, "Delete draft") : ""}${v.status === "sent" ? btn(`${base}&do=paid&i=${v.id}`, "Mark paid", true) : ""}</div></div>`).join("");
  const top = `<div class="top"><img src="${LOGO_URL}" alt=""><div class="t"><div class="brand">MASSAGE CLUB</div><h1>Billing</h1><div class="sub">Studios pay ${eur2(st.default_fee_eur)} + IVA ${Number(st.vat_rate || 0)}% for a new customer's first visit that happened${st.fees_from ? `, from ${esc(String(st.fees_from))}` : ""}. Repeat visits are free.</div></div><a class="back" href="${esc(await inboxUrl())}">All chats</a></div>`;
  const body = `${note ? `<div class="note ${noteErr ? "err" : "done"}">${esc(note)}</div>` : ""}
${unfilled.length ? `<div class="note err">Invoices cannot be sent until your details are filled in: ${esc(unfilled.join(", "))} (Supabase, table billing_settings). Drafts still get made.</div>` : ""}
<div class="card"><div class="h"><span class="n">Not yet invoiced</span><b>${eur2(owedSum)}</b></div><div class="m">${owed.length} first visit${owed.length === 1 ? "" : "s"} that happened, with a fee. Drafts are made automatically on the 1st of each month for the month before.</div><div>${btn(`${base}&do=generate&m=${lastMonth}`, "Make last month's drafts now")}${btn(`${base}&do=generate&m=${now.toISOString().slice(0, 8)}01`, "Make this month's drafts")}</div></div>
<div class="sec">INVOICES</div>${invCards || `<p class="empty">No invoices yet.</p>`}
<div class="sec">BOOKINGS</div>${ledgerCards || `<p class="empty">No bookings yet.</p>`}
<p class="empty"><a href="${esc(base)}">Refresh</a></p>`;
  return pageOut(url, pageShell("Billing · Massage Club", top, body));
}

async function inboxPage(url: URL): Promise<Response> {
  const sig = String(url.searchParams.get("sig") || "");
  if (sig !== (await replySig("inbox"))) return pageOut(url, pageShell("Link not valid", "", `<p class="empty">This link is not valid.</p>`), 403);
  const tab = url.searchParams.get("tab") === "studios" ? "studios" : "customers";
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?created_at=gte.${since}&order=created_at.desc&limit=3000&select=phone,direction,body,created_at`, { headers: H() });
  const rows: any[] = await r.json().catch(() => []);
  const byPhone = new Map<string, { last: any; lastIn: any; n: number }>();
  for (const m of Array.isArray(rows) ? rows : []) {
    const p = digitsOf(String(m.phone || ""));
    if (!p) continue;
    const e = byPhone.get(p) || { last: null, lastIn: null, n: 0 };
    if (!e.last) e.last = m;
    if (!e.lastIn && m.direction === "in") e.lastIn = m;
    e.n++;
    byPhone.set(p, e);
  }
  // Studios and sessions in two reads, not two per phone.
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?select=business_name,phone,whatsapp,status&limit=1000`, { headers: H() });
  const partners: any[] = await pr.json().catch(() => []);
  const studioOf = new Map<string, string>();
  for (const pt of Array.isArray(partners) ? partners : []) {
    for (const raw of [pt.whatsapp, pt.phone]) {
      let d = digitsOf(String(raw || ""));
      if (d.length === 9) d = "34" + d;
      if (d.length >= 9 && (!studioOf.has(d) || pt.status === "active")) studioOf.set(d, String(pt.business_name || ""));
    }
  }
  const phones = [...byPhone.keys()];
  const sr = phones.length ? await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?phone=in.(${phones.join(",")})&select=phone,step,wa_name`, { headers: H() }) : null;
  const sess = new Map<string, any>();
  for (const x of sr ? ((await sr.json().catch(() => [])) as any[]) : []) sess.set(digitsOf(String(x.phone || "")), x);
  type Item = { phone: string; name: string; studio: boolean; waiting: boolean; open: boolean; hoursLeft: number; lastBody: string; lastDir: string; at: number; step: string };
  const items: Item[] = [];
  for (const [p, e] of byPhone) {
    if (TEST_PHONES.includes(p)) continue;
    const s = sess.get(p) || {};
    if (s.step === "muted") continue;
    const studioName = studioOf.get(p);
    const inAt = e.lastIn ? Date.parse(e.lastIn.created_at) : 0;
    const left = inAt ? (inAt + 24 * 3600 * 1000 - Date.now()) / 3600000 : 0;
    items.push({ phone: p, name: studioName || s.wa_name || "", studio: !!studioName, waiting: e.last.direction === "in", open: left > 0.5, hoursLeft: Math.max(0, left), lastBody: String(e.last.body || ""), lastDir: String(e.last.direction || ""), at: Date.parse(e.last.created_at), step: String(s.step || "") });
  }
  items.sort((a, b) => Number(b.waiting) - Number(a.waiting) || b.at - a.at);
  const shown = items.filter((i) => (tab === "studios") === i.studio);
  const tidy = (b: string) => {
    let t = b.replace(/\s*\[via ad\]$/, "");
    // Templates are logged as "[template name/lang] ..." or "[name] ...".
    const tm = /^\[(?:template )?([a-z0-9_]+)(?:\/[a-z_]+)?\]\s*(.*)$/s.exec(t);
    const TPL: Record<string, string> = { solicitud_reserva: "Booking request sent", booking_unfinished: "Unfinished-booking reminder", founder_alert: "Alert to Jordan" };
    // v210 (Jordan, 16 Oct: "i see a weird message not a normal message"): a
    // studio ask shows what the studio read, not "Booking request sent: ...".
    // v212: and so does a closed-window note (aviso_centro, nota_centro).
    if (tm && /^(solicitud_|aviso_centro|nota_centro)/.test(tm[1])) t = prettyLogged(t);
    else if (tm) { const k = Object.keys(TPL).find((x) => tm[1].startsWith(x)); t = `${k ? TPL[k] : "Template " + tm[1]}: ${tm[2]}`; }
    const tap = /^\[tap: ?([^\]]*)\]$/.exec(t);
    if (tap) t = tap[1] ? `Tapped: ${tap[1].replace(/_/g, " ")}` : "Sent a voice note or media";
    return t;
  };
  const card = async (i: Item) => {
    const ago = Math.round((Date.now() - i.at) / 60000);
    const agoTxt = ago < 60 ? `${ago} min ago` : ago < 1440 ? `${Math.round(ago / 60)} h ago` : `${Math.round(ago / 1440)} d ago`;
    const pill = i.waiting ? `<span class="pill wait">WAITING ON US</span>` : "";
    const win = i.open ? `<span class="pill ${i.hoursLeft < 3 ? "warn" : "ok"}">${Math.floor(i.hoursLeft)}h to reply</span>` : `<span class="pill mute">read only</span>`;
    const who = i.lastDir === "in" ? (i.studio ? "Studio" : "Them") : "Us";
    return `<a class="card" href="${esc(await replyUrl(i.phone))}"><div class="h"><span class="n">${esc(i.name || "+" + i.phone)}</span>${pill}${win}</div><p class="q"><b style="font-style:normal;color:${i.lastDir === "in" ? C.clay : C.muted};">${who}:</b> ${esc(tidy(i.lastBody).slice(0, 180))}</p><div class="m">+${esc(i.phone)} · ${agoTxt}${i.studio || !i.step ? "" : ` · bot step: ${esc(i.step.replace(/^await_/, ""))}`}</div></a>`;
  };
  const base = await inboxUrl();
  const nC = items.filter((i) => !i.studio).length, nS = items.filter((i) => i.studio).length;
  const wC = items.filter((i) => !i.studio && i.waiting).length, wS = items.filter((i) => i.studio && i.waiting).length;
  const tabBtn = (key: string, label: string, n: number, w: number) =>
    `<a href="${esc(base + (key === "studios" ? "&tab=studios" : ""))}" style="flex:1;text-align:center;text-decoration:none;padding:9px 6px;border-radius:999px;font-size:13.5px;font-weight:700;${tab === key ? `background:${C.clay};color:#fff;` : `background:#fff;color:${C.ink};border:1px solid ${C.dash};`}">${label} ${n}${w ? ` · <span style="${tab === key ? "" : `color:${C.clay};`}">${w} waiting</span>` : ""}</a>`;
  const top = `<div class="top" style="flex-wrap:wrap;"><img src="${LOGO_URL}" alt=""><div class="t"><div class="brand">MASSAGE CLUB</div><h1>Conversations</h1><div class="sub">Last 7 days · newest first · waiting on us at the top</div></div><a class="back" href="${esc(await billingUrl())}" style="margin-right:12px;">Billing</a><a class="back" href="${esc(base + (tab === "studios" ? "&tab=studios" : ""))}">Refresh</a>
<div style="display:flex;gap:8px;width:100%;margin-top:10px;">${tabBtn("customers", "Customers", nC, wC)}${tabBtn("studios", "Studios", nS, wS)}</div></div>`;
  const body = shown.length ? (await Promise.all(shown.map(card))).join("") : `<p class="empty">Nothing in the last 7 days.</p>`;
  return pageOut(url, pageShell("Conversations · Massage Club", top, body));
}

// v208 (Jordan, 15 Oct, on "[solicitud_reserva_v2] Brandon: masaje ... |
// Lunes ... (req #120)": "never again, why does this look like this"). The
// chat shows what the other side read. Studio asks logged before
// dispatch-studios v44 are rebuilt into the approved template text; any other
// "[template name/lang]" tag is dropped.
const TPL_V2 = (a: string[]) => `Hola, soy Jordan, de Massage Club. Somos un servicio de reservas de masajes en Madrid: los clientes nos escriben por WhatsApp y nosotros les buscamos hueco en un buen centro cerca de ellos. Sin comisión, el cliente paga directamente en el centro.\n\nTengo un cliente que quiere reservar con vosotros:\n• ${a[0]}: ${a[1]}\n• ${a[2]} a las ${a[3]}, cerca de ${a[4]}\n\nLe he preguntado también a otros centros de la zona y el cliente se queda con la mejor oferta que confirme. Si podéis hacerle un 10% de descuento como cliente de Massage Club, decídmelo al confirmar y lo cierro con vosotros.\n\n¿Podéis atenderle? Tocad un botón o escribidme aquí. [Sí, podemos/Otra hora/No podemos]`;
const TPL_V3 = (a: string[]) => `Hola, tengo un cliente para un masaje ${a[0]}. Se llama ${a[1]} y lo quiere el ${a[2]}. ¿Tenéis hueco?\nEstoy preguntando a varios centros de la zona.\n\nJordan, de Massage Club [Sí, tengo hueco/Otra hora/No puedo]`;
function prettyLogged(body: string): string {
  const b = String(body || "");
  let m = /^\[solicitud_reserva_v2\] ([^:]*): ([\s\S]*?) \| ([\s\S]*?) a las ([\s\S]*?), cerca de ([\s\S]*?) \(req #\d+\)$/.exec(b);
  if (m) return TPL_V2([m[1], m[2], m[3], m[4], m[5]]);
  m = /^\[solicitud_reserva_v3\] ([^:]*): ([\s\S]*?) \| ([\s\S]*?) \(req #\d+\)$/.exec(b);
  if (m) return TPL_V3([m[2], m[1], m[3]]);
  return b.replace(/^\[(?:template )?[a-z0-9_]+(?:\/[a-z_]+)?\]\s*/i, "").replace(/\s*\(req #\d+\)$/, "");
}
// v212: the closed-window templates wa-bot sends itself, word for word as
// submitted to Meta (dispatch-studios TPL_BODY has the same aviso bodies), so
// the chat, the inbox and Jordan's copy show what the studio read. Blanks are
// filled the way sendTemplate sends them (tp: one line).
const NOTE_TPL: Record<string, string> = {
  aviso_centro_v2: "Hola, soy Jordan, de Massage Club. Os escribo por el masaje de {{1}}. {{2}}\n\nGracias.",
  aviso_centro_v1: "Aviso de Massage Club sobre la cita de {{1}} a las {{2}}: {{3}}. Gracias por vuestra paciencia.",
  nota_centro_v2: "Hola, soy Jordan, de Massage Club. {{1}}\n\nGracias.",
  nota_centro_v1: "Hola, os escribimos de Massage Club sobre una reserva: {{1}}. Podéis responder aquí mismo. Gracias.",
};
const renderNoteTpl = (name: string, params: string[], max = 300) =>
  (NOTE_TPL[name] || `[${name}] ${params.join(" | ")}`).replace(/\{\{(\d+)\}\}/g, (_m, n) => tp(params[Number(n) - 1] ?? "", max));
// A note as aviso_centro_v2's {{2}} carries it: whole sentences, capitalised,
// ending in their own stop (the template adds "Gracias." after them).
function noteSentences(t: string): string {
  const s = String(t || "").replace(/\s+/g, " ").trim().replace(/;\s+(\p{L})/gu, (_m, c: string) => `. ${c.toUpperCase()}`);
  if (!s) return "";
  const c = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!?]$/.test(c) ? c : `${c}.`;
}
// The same note as aviso_centro_v1's {{3}}: lowercase start (unless it opens
// with the client's name), no final stop, because the template adds ". ".
function noteShort(t: string, name = ""): string {
  const b = String(t || "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  return name && b.startsWith(name) ? b : b.charAt(0).toLowerCase() + b.slice(1);
}

// v208: a studio outside its 24h window, written to from the reply page.
// v212: nota_centro_v2 first ("Hola, soy Jordan, de Massage Club. {{1}}
// Gracias.", the note as Jordan wrote it), then the approved nota_centro_v1
// with the note's own final stop taken off (it adds one; a note ending in "?"
// still reads "?.", so the page asks Jordan to end on a statement), then the
// aviso templates about the studio's newest open or confirmed request, and
// only with a real hour: never "a las Afternoon (13-18)".
async function studioClosedSend(phone: string, text: string): Promise<boolean> {
  const body = text.replace(/\s+/g, " ").trim();
  if (await sendTemplate(phone, "nota_centro_v2", "es", [body], [], renderNoteTpl("nota_centro_v2", [body], 900), 900)) return true;
  if (!TPL_NOT_LIVE.test(lastWaError)) return false;
  const b1 = body.replace(/[.\s]+$/, "");
  if (await sendTemplate(phone, "nota_centro_v1", "es", [b1], [], renderNoteTpl("nota_centro_v1", [b1]))) return true;
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?phone=eq.${digitsOf(phone)}&order=created_at.desc&limit=10&select=request_id,offered_time`, { headers: H() }).then((r) => r.json()).catch(() => []);
  const drows: any[] = Array.isArray(dr) ? dr : [];
  const ids = [...new Set(drows.map((d) => Number(d.request_id)).filter((n) => n > 0))];
  if (!ids.length) return false;
  const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=in.(${ids.join(",")})&stage=in.(${[...OPEN_STAGES, "confirmed"].join(",")})&order=created_at.desc&limit=1&select=id,first_name,proposed_time,confirmed_time,confirmed_day,confirmed_start,day1,time1,message_text,created_at`, { headers: H() }).then((r) => r.json()).catch(() => []);
  const rq = Array.isArray(rr) && rr[0] ? rr[0] : null;
  if (!rq) return false;
  const offered = String((drows.find((d) => Number(d.request_id) === Number(rq.id)) || {}).offered_time || "");
  const hour = (/^\d{1,2}:\d{2}$/.test(offered) ? offered.padStart(5, "0") : "") || studioHour(rq);
  return await studioAviso(phone, { name: String(rq.first_name || ""), dayEs: studioDayEs(rq), time: hour, v2: body, short: body, text: body, hold: false });
}

async function replyPage(req: Request, url: URL): Promise<Response> {
  const phone = digitsOf(url.searchParams.get("reply") || "");
  const sig = String(url.searchParams.get("sig") || "");
  if (!phone || sig !== (await replySig(phone))) return pageOut(url, pageShell("Link not valid", "", `<p class="empty">This link is not valid.</p>`), 403);
  const html = (body: string, status = 200) => pageOut(url, body, status);
  const action = `${REPLY_BASE}?reply=${phone}&sig=${sig}`;
  const s = await getSession(phone);
  const muted = s.step === "muted";
  const last = await lastInboundMs(phone);
  const open = last !== null && Date.now() - last < 23.5 * 3600 * 1000;
  const hoursLeft = last !== null ? Math.max(0, Math.round((last + 24 * 3600 * 1000 - Date.now()) / 360000) / 10) : null;
  const studio = await findPartnerByNumber(phone);
  // The chat's language is what the customer is writing NOW: Stonelove started
  // in English and switched to Spanish, and his session still said English.
  const lastIn = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${phone}&direction=eq.in&order=created_at.desc&limit=3&select=body`, { headers: H() }).then((r) => r.json()).catch(() => []);
  const recentEs = (Array.isArray(lastIn) ? lastIn : []).some((m: any) => strongSpanish(String(m.body || "").replace(/\s*\[via ad\]$/, "")));
  const es = !!studio || recentEs || s.data?.lang === "es";
  const name = studio ? studio.business_name : (s.wa_name || "");
  const inbox = (await inboxUrl()) + (studio ? "&tab=studios" : "");
  let error = "";
  // Every page view shows the conversation with English under each incoming
  // message that was not in English.
  const render = async (o: { draft: string | Promise<string>; sent: boolean; error: string; notice?: string }) => {
    const thread = await fullThread(phone);
    // The suggestion and the translation are separate model calls; run together.
    const [trans, draft] = await Promise.all([translateIncoming(thread), Promise.resolve(o.draft)]);
    return html(replyHtml({ phone, name, studio: !!studio, thread, trans, open, hoursLeft, muted, action, inbox, es, sent: o.sent, error: o.error, notice: o.notice, draft, mediaSig: sig }));
  };
  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    // v148: live translation for the side-by-side composer. Sends nothing.
    if (String(form?.get("mode") || "") === "translate") {
      const src = String(form?.get("text") || "").slice(0, 1500);
      const to = String(form?.get("to") || "es");
      const out = !src.trim() ? "" : to === "en"
        ? noDashes(String((await aiText("Translate this WhatsApp message into natural English. Keep Madrid place names, names, times and prices exactly. Output only the translation.", src, 800)) || "")).trim()
        : (await toSpanish(src, !!studio)) || "";
      return new Response(JSON.stringify({ out }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const raw = String(form?.get("raw") || "") === "1";
    let text = noDashes(String(form?.get("text") || "")).slice(0, 1500);
    if (!text) error = "The message was empty, so nothing was sent.";
    else if (muted) error = "This number is muted. Nothing was sent.";
    else if (!open && !studio) error = "The 24 hour window is closed, so WhatsApp would not deliver this. Nothing was sent.";
    else if (studio && (mcMadridHour() < 9 || mcMadridHour() >= 21)) error = "Studios only get messages between 09:00 and 21:00 Madrid. Nothing was sent; try again after 09:00.";
    else {
      // Spanish chats: English goes back to Jordan translated, for a second
      // press. Only text that is already Spanish goes out on the first press.
      if (es && !raw) {
        const esText = await toSpanish(text, !!studio);
        if (esText === null) return render({ draft: text, sent: false, error: "The translation did not work, so nothing was sent. Try again, or write it in Spanish." });
        if (!sameText(esText, text)) {
          return render({ draft: esText, sent: false, error: "", notice: `Translated to Spanish. Nothing has been sent yet. Check it below and press Send again.<br><span style="color:${C.muted};font-size:13px;">You wrote: ${esc(text)}</span>` });
        }
        text = esText;
      }
      // v151 (Jordan, 4 Oct): up to three tap buttons under the message. Ids
      // start with fx_ so a tap comes back to the bot as the button's words.
      const btns = ["b1", "b2", "b3"].map((k) => noDashes(String(form?.get(k) || "")).trim().slice(0, 20)).filter(Boolean);
      const closedStudio = !!studio && !open;
      const ok = closedStudio
        ? await studioClosedSend(phone, text)
        : btns.length
        ? await sendButtons(phone, text, btns.map((title, i) => ({ id: `fx_${i + 1}`, title })), { manual: true })
        : await sendText(phone, text, { manual: true });
      if (ok) {
        await logEvent(phone, "founder_reply_as_bot", { len: text.length, step: s.step, buttons: btns.length });
        // v204 (12 Oct, synth.md change 4): the bot could not see what Jordan
        // sent from here. At 15:35 on 11 Oct he asked Hafeez "Would you like a
        // menu of massages offered?"; "Plzz" came back, the day step took it as
        // the day and asked the time. His words and the time are kept on the
        // session, and the customer's next reply within 30 minutes is read
        // against them (founderContextTurn). Customers only: studios never
        // enter the customer flow. Read fresh, so nothing the customer did
        // since this page opened is written over.
        if (!studio) {
          const fs = await getSession(phone);
          fs.data.founderSaid = { text: text.slice(0, 500), at: new Date().toISOString() };
          await saveSession(fs);
        }
        return render({ draft: "", sent: true, error: "" });
      }
      error = "WhatsApp refused the message. Nothing was sent; check the bot logs.";
    }
    return render({ draft: text, sent: false, error });
  }
  const sent = url.searchParams.get("sent") === "1";
  return render({ draft: sent ? "" : suggestReply(phone, studio, es), sent, error });
}

// v37: urgent things reach Jordan on WhatsApp. Email is where this morning's
// offers went to die. Short, with a link to the chat.
// v193: the fake 3460000xxxx test customers never alert Jordan, by phone or by
// email, wherever the alert is raised. Before this only a few call sites knew,
// so a replay of real conversations on test numbers would have paged him.
const FAKE_NUM_RE = /(^|\D)3460000\d{4}(\D|$)/;
const aboutFakeCustomer = (...parts: unknown[]) => parts.some((p) => { const t = typeof p === "string" ? p : JSON.stringify(p ?? ""); return FAKE_NUM_RE.test(t) || /\bprueba\b/i.test(t); });
async function notifyJordanWa(text: string, aboutPhone?: string) {
  if (aboutFakeCustomer(aboutPhone || "", text)) { console.log("[wa] alert about a fake test number, not sent"); return; }
  try {
    // v139: the phone alert links straight to the reply-as-bot page.
    const link = aboutPhone ? ` Reply as the bot: ${await replyUrl(aboutPhone)}` : "";
    // v45: free text to Jordan failed on 5 Sept (131047) because test messages
    // from his own number make canFreeform() true while Meta's window is closed.
    // The approved template always delivers, so use it every time.
    // The template parameter is capped at 300 characters (tp), so the alert
    // text gives way to keep the link whole.
    await sendTemplate(digitsOf(JORDAN_MAIN_NUMBER), "founder_alert_v1", "en", [text.slice(0, Math.max(60, 300 - link.length)) + link], [], text);
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
// v55: message types the bot cannot read. WhatsApp also sends "unsupported"
// for things like polls and view-once media.
const MEDIA_TYPES = ["image", "sticker", "audio", "video", "document", "contacts", "unsupported", "order"];
// v178 (Jordan, 5 Oct: "this should be auto"). Ad leads open with the English
// autofill, so a Spanish speaker who only sends voice notes was answered in
// English (+34 610 393 816, eight notes). Until voice is transcribed the
// English line carries Spanish first.
// v204 (12 Oct): no longer says we cannot listen to voice notes. We transcribe
// them, and one that fails gets VOICE_FAIL instead. This is for the rest.
const MEDIA_LINE: Record<string, string> = {
  es: "Perdona, aquí no podemos ver imágenes ni archivos. ¿Nos lo escribes en un mensaje? O toca una opción.",
  en: "Perdona, aquí no podemos ver imágenes ni archivos. ¿Nos lo escribes en un mensaje?\n\nSorry, we can't open images or files here. Could you type it instead?",
};
// v212: no "se lo paso al cliente ahora mismo", which was untrue for a held
// customer. Sent only to a studio with an open ask, never for a sticker.
const STUDIO_MEDIA_LINE = "Gracias. Por aquí no puedo abrir fotos ni audios. Si es la hora o el precio, ¿me lo escribís en un mensaje?";
// v212: the holding line a studio gets when nothing else answered it. The
// customers' line said "te" (tú) to a studio and promised a reply that
// depends on Jordan seeing a ping.
const STUDIO_FALLBACK_ACK = "Recibido, gracias. Lo miro y, si hace falta, os contesto por aquí.";
// True if we sent this exact line to this number within the window.
async function sentRecently(phone: string, body: string, windowMs: number): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowMs).toISOString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${encodeURIComponent(phone)}&direction=eq.out&created_at=gt.${since}&body=eq.${encodeURIComponent(body)}&select=id&limit=1`, { headers: H() });
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}
// v53: ask the current step's question again, after answering something else.
async function reAsk(s: Session, from: string, L: string) {
  switch (s.step) {
    case "await_service": await askService(from, L); break;
    case "await_day": if (s.data.service === "svc_unsure") await askDayUnsure(from, L); else await askDay(from, L); break;
    case "await_time": await askTime(from, L); break;
    case "await_hour": await askHour(from, L, s.data.timeBandId || "time_afternoon"); break;
    case "await_area": await askArea(from, L); break;
    case "await_sameday": await sendButtons(from, COPY[L].sameDay, COPY[L].sameDayBtns(String(s.data.time || ""))); break;
    case "await_day_text": await askDayList(from, L); break;
    case "await_time_text": await sendText(from, COPY[L].timeAsk); break;
    case "await_name": await sendText(from, COPY[L].name); break;
    case "await_email": case "await_email_req": await sendText(from, COPY[L].email); break;
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

// v114 (Jordan, 19 Sept): "just a button for yes or no. Something simple."
// The one hour we actually put to the studios. dispatch-studios v30 writes it
// on the request when the customer chose a band, so a tap on "Sí, tengo hueco"
// resolves to the same time the studio read in the template. An exact time the
// customer typed needs no translation. Anything else is not a time, and a tap
// on it is availability, not a booking.
function exactTime(req: any): string {
  const p = String(req?.proposed_time || "").trim();
  if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(p)) return p.padStart(5, "0");
  const m = String(req?.time1 || "").match(/^\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

// A studio replied (template button or free text). Never enters the customer flow.
async function handleStudioReply(from: string, payloadId: string, btnText: string, freeText: string, partner: { id: string; business_name: string } | null) {
  const m = payloadId.match(/^studio_(confirm|other|no)_(\d+)$/);
  if (m) {
    const requestId = Number(m[2]);
    const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&select=id,first_name,service_name,studio_name,partner_id,day1,time1,proposed_time,languages,client_phone,stage,contact_email,settle_after,message_text,created_at,confirmed_day,confirmed_time,confirmed_start,stage_note,customer_flag`, { headers: H() });
    const rows = await rr.json().catch(() => []);
    const req = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!req) { console.log("[studio] request not found", requestId); return; }
    const L = req.languages === "es" ? "es" : "en";
    const when = [req.day1, req.time1].filter(Boolean).join(" ");
    // v212: what Jordan's own WhatsApp opens with, in Spanish, no brackets.
    const studioPrefill = studioOpener(req);
    // v49: the "No podemos" button on solicitud_reserva_v2. A clean no beats
    // silence: the row is closed, the studio is thanked, nothing else happens.
    if (m[1] === "no") {
      // v81: was gated on `partner`, so a studio we could not resolve to a
      // partner row tapped "No podemos" into the void. The tap itself is the
      // fact; record it whether or not the partner lookup worked.
      const drow = await dispatchRowFor(requestId, partner ? partner.id : "", from);
      // v212: a No from the studio that holds the CONFIRMED booking is not a
      // stand-down. It used to be thanked with "Os escribo con la siguiente"
      // while the booking stayed confirmed and nobody was told. The booking is
      // left as it is, the studio is asked whether it really cannot, and
      // Jordan hears at once. The customer is told nothing yet.
      const ours = req.stage === "confirmed" && ((!!partner && String(req.partner_id || "") === String(partner.id)) || drow?.outcome === "won");
      if (ours) {
        const w = studioWhenEs(req);
        const sname = partner ? partner.business_name : "";
        await sendText(from, `Vaya. ${req.first_name || "El cliente"} tiene la cita confirmada con vosotros${w ? " " + w : ""}. ¿Me confirmáis que al final no podéis? Si es así, yo se lo digo.`);
        await notifyJordanWa(`${sname || from} tapped NO on ${req.first_name || "the customer"}'s CONFIRMED booking #${requestId}. Booking left as it is, studio asked to confirm, customer not told.`, digitsOf(req.client_phone || "") || from);
        await founderCard(`${sname || "A studio"} tapped No on confirmed #${requestId}`, {
          badge: "STUDIO MAY BE PULLING OUT",
          title: `${sname || "The studio"} tapped No on ${req.first_name || "a customer"}'s confirmed booking`,
          paras: ["The booking is still confirmed and the customer has been told nothing. The studio was asked whether it really cannot do it."],
          waNum: from, waLabel: "Chat with the studio", prefill: studioPrefill,
        });
        await logEvent(req.client_phone || from, "studio_declined_confirmed", { id: requestId, studio: sname || from });
        return;
      }
      if (drow && drow.outcome !== "won") await patchDispatch(drow.id, { outcome: "declined", replied_at: new Date().toISOString(), reply_text: "No podemos (botón)" });
      await sendText(from, "Vale, gracias por avisar. A la próxima.");
      await logEvent(req.client_phone || from, "studio_declined", { id: requestId, studio: partner ? partner.business_name : from });
      return;
    }
    if (m[1] === "confirm") {
      // v41: a second tap from the winning studio is not a new studio.
      // v212: the winner is read off the dispatch rows too, so a winning
      // studio whose number has no partner row is not told another centre
      // took its own booking; a number with neither is told nothing.
      if (req.stage === "confirmed") {
        const ownP = !!partner && String(req.partner_id || "") === String(partner.id);
        const dC = ownP ? null : await dispatchRowFor(requestId, partner ? partner.id : "", from);
        if (ownP || dC?.outcome === "won") await sendText(from, "Ya lo tengo apuntado, gracias. Cualquier cambio, escribidme por aquí.");
        else if (dC || partner) await sendText(from, coveredLine("confirmed", req.first_name || "", false, studioDayEs(req)));
        else await notifyJordanWa(`Number ${from} (no partner, no dispatch row) tapped Sí on #${requestId}, already confirmed with ${req.studio_name || "a studio"}. Nothing sent to them.`, from);
        return;
      }
      // v43: a Confirmado on a request with no exact time is an offer of
      // availability, not a booking. On 5 Sept KamAI tapped Confirmado on Viko's
      // "flexible evening" request and the bot announced a booking with no time.
      // v114: "Evening (18-21)" has digits in it but is not a time. Only an
      // hour we actually put to this studio counts as one.
      if (!exactTime(req)) {
        await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&stage=neq.confirmed`, {
          method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
          body: JSON.stringify({ stage: "studio_replied", partner_id: partner ? partner.id : req.partner_id || null, studio_name: partner ? partner.business_name : req.studio_name, studio_reply: `Disponible (Confirmado sin hora fija, ${partner ? partner.business_name : from})`, stage_updated_at: new Date().toISOString() }),
        });
        // v212: the day and band in Spanish, never day1 as the customer typed it.
        const nw = studioWhenEs(req);
        await sendText(from, `Gracias. ${req.first_name || "El cliente"} ${nw ? `lo quiere ${nw}, pero aún no ha elegido hora` : "aún no ha elegido hora"}. ¿Qué horas tenéis libres? Decidme una o dos y se las paso.`);
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
      // v114 (Jordan, 19 Sept): "just a button for yes or no. Something simple."
      // A tap at a concrete hour is a complete answer, so it goes straight to
      // the customer instead of opening a ten minute bidding window the studio
      // could not see and the customer was never told about. The v46 window
      // bought a better discount and cost every booking ten minutes, and a
      // studio that tapped yes got no sign their tap had done anything.
      // We still ask this studio for their price and the Massage Club rate,
      // but that question no longer holds the booking up.
      if (partner && !isSameDayReq(req) && !req.partner_id) {
        const drow = await dispatchRowFor(requestId, partner.id, from);
        if (drow && drow.outcome !== "won") {
          if (drow.outcome !== "accepted") await patchDispatch(drow.id, { outcome: "accepted", accepted_at: new Date().toISOString(), replied_at: new Date().toISOString() });
          const fwd = await forwardOffer(req, partner, String(drow.id), exactTime(req), "Sí, tengo hueco (botón)", from);
          // v204 review (12 Oct): never right after "no os guardéis el hueco"
          // (a time too close, a dearer one) or about a request just closed
          // (muted). Only while the time is still in play.
          if (!drow.quoted_price && ["whatsapp", "email", "none", "queued", "held_window", "held"].includes(fwd)) await sendText(from, priceAsk(req, await severalAsked(requestId)));
          await logEvent(req.client_phone || from, "studio_accepted", { id: requestId, studio: partner.business_name, time: exactTime(req) });
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
        // v54: a cancelled or dismissed request is not "covered by another
        // centre". On 6 Sept Sinergia38 was told that about Mateo's cancelled
        // booking. Say what actually happened.
        // v212: "Ya lo tenemos apuntado" went to a studio whose client had
        // cancelled. A tap on a confirmed booking of theirs is a possible
        // change, and Jordan hears about it.
        const own = !!partner && String(req.partner_id || "") === String(partner.id);
        if (own && req.stage === "confirmed") {
          const w = studioWhenEs(req);
          await sendText(from, `Vale. ${req.first_name || "El cliente"} tiene la cita con vosotros${w ? " " + w : ""}. ¿Necesitáis cambiarla? Decidme qué hora os va bien y se lo pregunto.`);
          await founderCard(`${partner!.business_name} tapped Otra hora on confirmed #${requestId}`, {
            badge: "STUDIO MAY WANT A CHANGE",
            title: `${partner!.business_name} may need to move ${req.first_name || "the customer"}'s booking`,
            paras: ["Booking unchanged. The studio was asked which time works; a time they write goes to the customer through forwardTimeChange."],
            waNum: from, waLabel: "Chat with the studio", prefill: studioPrefill,
          });
        } else if (own && req.stage === "no_show") await sendText(from, `Gracias. La cita de ${req.first_name || "este cliente"} ya está cerrada, no hace falta que hagáis nada.`);
        else await sendText(from, coveredLine(req.stage, req.first_name || "", req.customer_flag === "cancelled", studioDayEs(req)));
        return;
      }
      // v36: if this studio already wrote a time, the tap is just them being
      // thorough. Do not ask again for what they told us.
      // v212: it says what we know (their time, noted), not that the client
      // already has it (untrue when held or queued) or "os confirmamos". A
      // stored value that is not a clock time falls through to the question.
      if (partner) {
        const dq = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${requestId}&partner_id=eq.${encodeURIComponent(partner.id)}&select=offered_time,reply_text,replied_at,offered_at&limit=1`, { headers: H() });
        const dqr = await dq.json().catch(() => []);
        const ot = String((Array.isArray(dqr) && dqr[0]?.offered_time) || "").trim();
        if (/^\d{1,2}:\d{2}$/.test(ot)) {
          const rd = rowDayLabel(dqr[0], "es");
          const od = rd ? offerDayPhrase(rd, "es") : studioDayEs(req);
          await sendText(from, `Gracias, ya tengo apuntado que podéis atender a ${req.first_name || "este cliente"}${od ? " " + od : ""} a las ${ot.padStart(5, "0")}. Si os viene mejor otra hora, decídmela por aquí.`);
          return;
        }
      }
      await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&stage=neq.confirmed`, {
        method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify({ stage: "studio_replied", studio_reply: `Otra hora (WhatsApp, ${partner ? partner.business_name : from})`, stage_updated_at: new Date().toISOString() }),
      });
      const oDay = studioDayEs(req);
      await sendText(from, `Vale. ¿Qué otra hora le podríais dar a ${req.first_name || "este cliente"}${oDay ? " " + oDay : ""}? Decídmela por aquí y se la paso.`);
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
    // v81: a studio answering the therapist-gender question. Recorded against
    // the dispatch row with the studio's own words, so the claim we later make
    // to the customer can always be traced back to something they wrote. Only
    // a clear yes or no is stored; anything ambiguous is left null on purpose.
    try {
      const since48g = new Date(Date.now() - 48 * 3600e3).toISOString();
      const gd = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=eq.${encodeURIComponent(partner.id)}&outcome=in.(pending,accepted,won)&created_at=gte.${since48g}&order=created_at.desc&limit=1&select=id,request_id`, { headers: H() });
      const gdr = (await gd.json().catch(() => []))[0] || null;
      if (gdr) {
        const gq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${gdr.request_id}&select=therapist_gender&limit=1`, { headers: H() });
        const want = String(((await gq.json().catch(() => []))[0] || {}).therapist_gender || "");
        if (want === "male" || want === "female") {
          const ans = studioGenderReply(freeText, want);
          if (ans !== null) {
            await patchDispatch(gdr.id, { therapist_gender_ok: ans, therapist_gender_note: freeText.slice(0, 300) });
            console.log("[studio] therapist gender", want, ans ? "confirmed" : "refused", "by", partner.business_name);
          }
        }
      }
    } catch (e) { console.log("[studio] gender parse failed", String(e)); }
    // v110 (Jordan, 19 Sept): "before we offer pricing we must confirm with the
    // studio there price after our potential discount." A figure this studio
    // wrote about this booking is the only price we are ever allowed to quote,
    // so it is captured the moment it arrives and written against the dispatch
    // row. Pure capture: it sends nothing, moves no stage and does not return,
    // because one message is usually both ("17:00, 45€") and the discount and
    // offered-time branches below still have to run on it.
    const quotedNow = parseQuotedPrice(freeText);
    if (quotedNow !== null) {
      try {
        const sinceP = new Date(Date.now() - 48 * 3600e3).toISOString();
        const pd = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=eq.${encodeURIComponent(partner.id)}&outcome=in.(pending,accepted,won)&created_at=gte.${sinceP}&order=created_at.desc&limit=1&select=id`, { headers: H() });
        const pdr = (await pd.json().catch(() => []))[0] || null;
        if (pdr) {
          await patchDispatch(pdr.id, { quoted_price: quotedNow, replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500) });
          console.log("[studio] quoted price", quotedNow, "from", partner.business_name);
        }
      } catch (e) { console.log("[studio] price capture failed", String(e)); }
    }
    // v46: a written discount is an offer on the open request. 10% or more goes
    // to the customer at once (v199: as an offer they tap Yes on, never as a
    // booking); less waits for the window to close.
    const pct = parseDiscount(freeText);
    if (pct !== null) {
      const since48 = new Date(Date.now() - 48 * 3600e3).toISOString();
      const od = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=eq.${encodeURIComponent(partner.id)}&outcome=in.(pending,accepted)&created_at=gte.${since48}&order=created_at.desc&limit=1&select=id,request_id,outcome,accepted_at`, { headers: H() });
      const odr = (await od.json().catch(() => []))[0] || null;
      if (odr) {
        await patchDispatch(odr.id, { discount_pct: pct, ...(quotedNow !== null ? { quoted_price: quotedNow } : {}), outcome: "accepted", accepted_at: odr.accepted_at || new Date().toISOString(), replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500), offer_note: freeText.slice(0, 200) });
        await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(partner.id)}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ mc_discount_pct: pct, mc_discount_confirmed_at: new Date().toISOString(), mc_discount_note: `WhatsApp: ${freeText.slice(0, 200)}` }) }).catch(() => {});
        const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${odr.request_id}&stage=in.(new,studio_asked,studio_replied,offered,bidding)&limit=1&select=id,first_name,service_name,studio_name,partner_id,day1,time1,proposed_time,confirmed_time,languages,client_phone,stage,contact_email,settle_after,message_text,created_at`, { headers: H() });
        const rqrow = (await rq.json().catch(() => []))[0] || null;
        if (rqrow && pct >= 10) { await awardWinner(rqrow, partner, from, pct); return; }
        if (rqrow) {
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${rqrow.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "bidding", settle_after: rqrow.settle_after || new Date(Date.now() + BID_WINDOW_MS).toISOString(), studio_reply: `${partner.business_name}: ${pct}% dto`, stage_updated_at: new Date().toISOString() }) });
          // v212: no "os confirmamos" (only the customer's tap confirms), no
          // second 10% ask after a 5%, and "los otros centros" only when there
          // are others.
          const waitLine = (await severalAsked(rqrow.id)) ? "Estoy esperando a los otros centros y en unos minutos os digo algo." : "En unos minutos os digo algo.";
          await sendText(from, quotedNow !== null ? `Gracias, apuntado: ${pct}% de descuento, ${eurEs(quotedNow)}. ${waitLine}` : `Gracias, apuntado el ${pct}%. ¿Qué precio final le quedaría por ${reqDuration(rqrow)} min? ${waitLine}`);
          return;
        }
      }
    }
    // v35: a fanned-out request has no partner assigned until someone accepts,
    // so look the studio up through what we asked them before falling back to
    // an already assigned booking.
    let req: any = null;
    // The row must be recent and must include the ones we have already marked
    // accepted, or a studio's reply lands on whatever else of theirs is still
    // open. Centro Aloha answered about Fernando on 8 September and the bot
    // attached it to David's request from the 5th, which was still pending, and
    // offered David a slot at 01:00.
    const drSince = new Date(Date.now() - 48 * 3600e3).toISOString();
    // v115 (20 Sept): if we chased this studio in the last three hours, their
    // reply is about the request we chased, not whatever of theirs is newest.
    // This morning the chase asked Centro Aloha about Al's Monday, they wrote
    // back "a las 18.15h si hay disponibilidad mañana lunes", and the bot filed
    // it against Javier because his row was newer. Javier was sent an offer for
    // a slot nobody had offered him, Centro Aloha was told we would confirm
    // with Javier when they had been asked about Al, and Al never heard about
    // the one real slot he had. The chase makes this far more likely, because
    // it deliberately prompts studios about older requests, so the prompt has
    // to decide where the answer lands.
    // v116 (21 Sept): three hours was too narrow and the same bug fired again.
    // Centro Aloha was chased about Al at 09:00, answered at 10:40, and answered
    // AGAIN at 15:45 with the price. By then the chase was six hours old, the
    // window had lapsed, and their 60 EUR landed on Javier a second time. The
    // age of the chase was never the point: what matters is that we asked them
    // a question and are still waiting on the answer. An open chase owns the
    // studio's replies until that request is closed or another is chased.
    const chaseSince = new Date(Date.now() - 48 * 3600e3).toISOString();
    const chased = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=eq.${encodeURIComponent(partner.id)}&outcome=in.(pending,accepted,won)&chased_at=gte.${chaseSince}&order=chased_at.desc&limit=1&select=id,request_id`, { headers: H() });
    const chasedRow = (await chased.json().catch(() => []))[0] || null;
    if (chasedRow) console.log(`[studio] reply attributed to the chased request #${chasedRow.request_id}`);
    const dr = chasedRow
      ? { json: async () => [chasedRow] } as unknown as Response
      : await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=eq.${encodeURIComponent(partner.id)}&outcome=in.(pending,accepted,won)&created_at=gte.${drSince}&order=created_at.desc&limit=1&select=id,request_id`, { headers: H() });
    const drows = await dr.json().catch(() => []);
    const drow = Array.isArray(drows) && drows[0] ? drows[0] : null;
    if (drow) {
      await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${drow.id}`, {
        method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify({ replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500) }),
      });
      const r1 = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${drow.request_id}&stage=in.(new,studio_asked,studio_replied,offered,bidding)&limit=1&select=id,first_name,service_name,studio_name,day1,time1,proposed_time,created_at,client_phone,languages,contact_email,area,message_text`, { headers: H() });
      const rows1 = await r1.json().catch(() => []);
      if (Array.isArray(rows1) && rows1[0]) req = rows1[0];
    }
    // v37: a studio changing the time on a booking it already won. Baan Bua
    // did exactly this (12:15 became 12:45) and it landed as a plain note.
    if (!req && drow) {
      const rc = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${drow.request_id}&stage=eq.confirmed&partner_id=eq.${encodeURIComponent(partner.id)}&limit=1&select=id,first_name,service_name,studio_name,day1,time1,confirmed_day,confirmed_time,client_phone,languages,contact_email,area,message_text`, { headers: H() });
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
      const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?partner_id=eq.${encodeURIComponent(partner.id)}&stage=in.(studio_asked,studio_replied,bidding)&order=created_at.desc&limit=1&select=id,first_name,service_name,studio_name,day1,time1,proposed_time,created_at,price,client_phone,languages,message_text`, { headers: H() });
      const rows = await rr.json().catch(() => []);
      req = Array.isArray(rows) && rows[0] ? rows[0] : null;
    }
    // v45: a studio answering a request that was already covered ("mañana ya
    // está lleno", "no podemos") within two days of being asked. They never got
    // the stand-down if they had not written before, so this is the first time
    // the bot can actually tell them. Log the answer, thank them, close.
    // v63: a studio holding a live booking of ours is not writing about a dead
    // request. Sinergia38 asked for the client's email while a confirmed
    // booking of theirs for the next day was on our books, and the bot told
    // them "the client cancelled", because a stood-down row from an older
    // request of the same customer was the newest thing the next query saw.
    // Telling a partner their booking is off when it is not is worse than
    // saying nothing, so a live booking closes that branch entirely.
    let liveBooking: any = null;
    if (!req) {
      const lb = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?partner_id=eq.${encodeURIComponent(partner.id)}&stage=eq.confirmed&order=stage_updated_at.desc&limit=1&select=id,first_name,service_name,studio_name,day1,time1,confirmed_day,confirmed_time,confirmed_start,created_at,client_phone,languages,contact_email,area,message_text,share_ok,stage_updated_at`, { headers: H() });
      const lbs = await lb.json().catch(() => []);
      const cand = Array.isArray(lbs) && lbs[0] ? lbs[0] : null;
      // A booking from last month is not what they are writing about.
      const age = cand ? Date.now() - Date.parse(String(cand.stage_updated_at || "")) : Infinity;
      if (cand && age < 14 * 24 * 3600e3) liveBooking = cand;
    }
    if (!req && !liveBooking) {
      const since = new Date(Date.now() - 48 * 3600e3).toISOString();
      const sd = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?partner_id=eq.${encodeURIComponent(partner.id)}&outcome=in.(stood_down,lost,declined,expired)&created_at=gte.${since}&order=created_at.desc&limit=1&select=id,request_id,outcome`, { headers: H() });
      const sdr = await sd.json().catch(() => []);
      const sdrow = Array.isArray(sdr) && sdr[0] ? sdr[0] : null;
      if (sdrow && !AUTOREPLY_RE.test(freeText)) {
        await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${sdrow.id}`, {
          method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
          body: JSON.stringify({ replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500) }),
        });
        const sdq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${sdrow.request_id}&select=id,first_name,service_name,studio_name,partner_id,day1,time1,proposed_time,confirmed_day,confirmed_time,confirmed_start,client_phone,languages,contact_email,area,message_text,created_at,stage,customer_flag`, { headers: H() });
        const sdreq = await sdq.json().catch(() => []);
        const sd0 = Array.isArray(sdreq) && sdreq[0] ? sdreq[0] : null;
        const sdStage = sd0 ? String(sd0.stage || "") : "";
        // v212: a request that is still open was never "covered by another
        // centre". Chalalai tapping No for 15:00 and then writing "podemos a
        // las 15:30", or writing after its offer lapsed while the customer is
        // still looking, was told another centre took it and the new time was
        // lost. A time is a new offer; anything else goes to Jordan, and
        // nothing is said back.
        if (sd0 && OPEN_STAGES.includes(sdStage)) {
          const t = parseOfferedTime(freeText);
          if (t && sd0.client_phone) {
            await patchDispatch(sdrow.id, { outcome: "accepted", accepted_at: new Date().toISOString() });
            await forwardOffer(sd0, partner, String(sdrow.id), t, freeText, from);
            return;
          }
          await founderCard(`${partner.business_name} wrote again on open #${sdrow.request_id}`, {
            badge: "STUDIO REPLY", title: `${partner.business_name} wrote after a No or a lapse, and the request is still open`,
            paras: ["Nothing was said back. This may be a new offer."],
            quote: freeText, waNum: from, waLabel: "Reply to the studio", prefill: studioOpener(sd0),
          });
          return;
        }
        // Nor is a booking this same studio holds.
        if (sd0 && sdStage === "confirmed" && String(sd0.partner_id || "") === String(partner.id)) {
          await founderCard(`${partner.business_name} wrote about confirmed #${sdrow.request_id}`, {
            badge: "STUDIO MESSAGE", title: `${partner.business_name} wrote about ${sd0.first_name || "a customer"}'s confirmed booking`,
            paras: ["Nothing was said back to them automatically."],
            quote: freeText, waNum: from, waLabel: "Reply to the studio", prefill: studioOpener(sd0),
          });
          return;
        }
        // v214 (17 Oct): Natura Spaces answered the covered line with "Vale, no
        // te preocupes, quedo super atenta para cuando quieras agendar 🥰" and
        // got the same covered line again. Said once; a friendly answer to it
        // gets one short thanks, and after that only Jordan hears.
        const cl = coveredLine(sdStage, sd0 ? String(sd0.first_name || "") : "", sd0?.customer_flag === "cancelled", sd0 ? studioDayEs(sd0) : "");
        const lastOut = await coreLastOutbound(from);
        if (lastOut === cl || lastOut === STUDIO_THANKS) {
          if (studioAck(freeText)) {
            if (lastOut === cl) await sendText(from, STUDIO_THANKS);
          } else {
            await founderCard(`${partner.business_name} wrote again after the stand-down · #${sdrow.request_id}`, {
              badge: "STUDIO MESSAGE", title: `${partner.business_name} wrote again about a request that is closed`,
              paras: ["They were already told it is not going ahead, so nothing was said back."],
              quote: freeText, waNum: from, waLabel: "Reply to the studio", prefill: studioOpener(sd0),
            });
          }
          return;
        }
        await sendText(from, cl);
        await founderCard(`💬 ${partner.business_name} answered a covered request · #${sdrow.request_id}`, {
          badge: "LATE REPLY", title: `${partner.business_name} wrote back after the request was covered`,
          paras: [`The bot thanked them and said the booking is covered (or that the client cancelled, when that is what happened). Nothing to do.`],
          quote: freeText, waNum: from, waLabel: "Reply to the studio", prefill: studioOpener(sd0),
        });
        return;
      }
    }
    const studioPrefill = studioOpener(req);
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
    } else if (liveBooking) {
      // They have a confirmed booking with us, so this is about that. Say
      // nothing to them: answering a question we have not read is how the
      // false cancellation happened. Jordan gets it with the booking attached.
      const lbWhen = [liveBooking.confirmed_day || liveBooking.day1, liveBooking.confirmed_time || liveBooking.time1].filter(Boolean).join(" ");
      await notifyJordanWa(`${partner.business_name} wrote about ${liveBooking.first_name || "a client"}'s confirmed booking (${lbWhen}): ${freeText.slice(0, 160)}`, from);
      await founderCard(`💬 ${partner.business_name} wrote about a confirmed booking · #${liveBooking.id}`, {
        badge: "STUDIO MESSAGE",
        title: `${partner.business_name} has a question about ${liveBooking.first_name || "the customer"}`,
        paras: [
          `${liveBooking.service_name || "Massage"} on ${lbWhen || "a day not recorded"}. Nothing was said back to them automatically.`,
          liveBooking.share_ok
            ? `The customer agreed to share their details: ${liveBooking.client_phone || "no phone on file"}.`
            : `The customer has NOT agreed to share their phone or email, so do not pass either on without asking them first.`,
        ],
        quote: freeText,
        waNum: from, waLabel: "Reply to the studio", prefill: studioOpener(liveBooking),
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
// v212 (16 Oct): a note about one booking to a studio whose 24 hours have
// passed. aviso_centro_v2 first ("Hola, soy Jordan, de Massage Club. Os
// escribo por el masaje de {{1}}. {{2}}\n\nGracias.", {{1}} the client, day
// and hour, {{2}} whole sentences). While Meta has not approved it, the
// approved aviso_centro_v1, filled the one way dispatch-studios fills it:
// {{1}} the client and day ("Brandon de hoy"), {{2}} a real HH:MM, {{3}} the
// short with a lowercase start and no final stop. With no HH:MM, or a short
// that is a question, v1 would read "a las -" or "?.", so it is not sent and
// Jordan gets the note to send by hand (unless hold is false: the reply page
// tells him itself). Both are logged as the studio read them.
async function studioAviso(to: string, o: { name: string; dayEs?: string; time: string; v2?: string; short: string; text: string; hold?: boolean }): Promise<boolean> {
  const hm = String(o.time || "").match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  const hour = hm ? `${hm[1].padStart(2, "0")}:${hm[2]}` : "";
  // "el masaje de el cliente" is not Spanish; a nameless client is "nuestro cliente".
  const nm = String(o.name || "").trim();
  const name = nm && !/^el cliente$/i.test(nm) ? nm : "nuestro cliente";
  const dd = deDay(o.dayEs || "");
  const p2 = [[name, dd, hour ? `a las ${hour}` : ""].filter(Boolean).join(" "), noteSentences(o.v2 || o.short)];
  if (await sendTemplate(to, "aviso_centro_v2", "es", p2, [], renderNoteTpl("aviso_centro_v2", p2, 700), 700)) return true;
  if (!TPL_NOT_LIVE.test(lastWaError)) return false;
  const v1 = noteShort(o.short, name);
  const why = !hour ? "this note has no clock time for it" : (!v1 || /\?$/.test(v1)) ? "it cannot carry a question" : "";
  if (why) {
    if (o.hold !== false) {
      await founderCard(`Note not sent to a studio: send it by hand`, {
        badge: "STUDIO NOTE NOT SENT",
        title: `This note did not reach the studio`,
        paras: [`Their 24 hour WhatsApp window is shut, aviso_centro_v2 is not approved yet, and aviso_centro_v1 was not used because ${why}. Send it from the reply page below.`],
        quote: o.text, waNum: to, waLabel: "Chat with the studio", prefill: o.text,
      });
    }
    return false;
  }
  const p1 = [`${name}${dd ? " " + dd : ""}`.slice(0, 60), hour, v1];
  return sendTemplate(to, "aviso_centro_v1", "es", p1, [], renderNoteTpl("aviso_centro_v1", p1));
}
// Free text in the studio's window, the aviso templates outside it. `freeText`
// is the whole message; `shortEs` the same news in a few words for the
// templates. o.dayEs is the booking's day (studioDayEs) and o.v2 the note as
// aviso_centro_v2 should carry it, if it differs from shortEs.
async function tellStudio(studioNum: string, name: string, time: string, freeText: string, shortEs: string, o: { dayEs?: string; v2?: string } = {}) {
  if (!studioNum) return false;
  if (await canFreeform(studioNum)) return sendText(studioNum, freeText);
  return studioAviso(studioNum, { name: name || "", dayEs: o.dayEs || "", time, v2: o.v2 || shortEs, short: shortEs, text: freeText });
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
  // v212: no promise of a same-day-confirmation policy nothing enforces.
  const nsAt = studioHour(req);
  if (studioNum) await sendText(studioNum, `Vaya, siento mucho que ${req.first_name || "el cliente"} no haya venido${nsAt ? " a las " + nsAt : ""}. Gracias por avisar, lo tengo en cuenta.`).catch(() => {});
  if (cust) {
    if (await canFreeform(cust)) await sendText(cust, COPY[L].missedYou(studio));
    else await sendTemplate(cust, "missed_you_v1", L, [req.first_name || (L === "es" ? "hola" : "there"), studio], [], `missed you at ${studio}`);
  }
  await logEvent(cust || studioNum, "no_show", { id: req.id, studio });
  await notifyJordanWa(`NO-SHOW: ${name} did not arrive at ${studio} (${reqTime(req)}). Studio thanked, customer got a soft "we missed you". Request #${req.id} marked no_show.`, cust);
  await founderCard(`❌ No-show: ${name} at ${studio} · #${req.id}`, {
    badge: "NO-SHOW", title: `${name} did not arrive at ${studio}`,
    paras: [`Marked no_show. The studio was thanked; nothing was promised. The customer got a soft message with an open door to rebook.`, `A personal note to the studio from you is still worth it.`],
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
    await sendText(from, "¡Gracias por avisar! Que vaya bien.");
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
    ? `Recibido, gracias. Ya le he escrito a ${name || "el cliente"} y os digo algo en cuanto conteste.`
    : `Recibido, gracias. Ahora mismo no consigo avisar a ${name || "el cliente"} por WhatsApp. Lo intento por otra vía y os digo algo.`);
  // v212: that promise has an owner. Jordan gets the card, with the email on file.
  if (!pinged && !pingedRecently) {
    await founderCard(`${studio} needs ${name || "the customer"} now · #${live.id}`, {
      badge: "STUDIO WAITING ON YOU",
      title: `${studio} wrote about ${name || "the customer"}'s ${time} and the bot could not reach them`,
      paras: [`The studio was told you would try another way. Email on file: ${live.contact_email || "none"}.`],
      quote: text, waNum: from, waLabel: "Reply to the studio",
    });
  }
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
    // v153: the studio's "ha llegado" is what makes a booking billable.
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?booking_ref=eq.wa-${req.id}&completed_at=is.null`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ completed_at: new Date().toISOString(), completed_source: "studio" }) });
    await sendText(from, "¡Gracias! Que vaya bien.");
    await logEvent(digitsOf(req.client_phone || from), "arrived", { id: req.id, studio });
    return;
  }
  if (req.arrival_status === "no_show" || req.stage === "no_show") { await sendText(from, "Gracias, ya lo tenía apuntado."); return; }
  await markNoShow(req, studio, from, "studio tapped No ha venido");
}
// Customer answers to the T-3h check (template buttons or typed words).
async function handleCustomerReconfirm(kind: "yes" | "change" | "cancel", reqId: string, from: string, L: string, s: Session) {
  const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${reqId}&select=id,first_name,service_name,studio_name,partner_id,client_phone,languages,day1,time1,message_text,created_at,confirmed_day,confirmed_time,confirmed_start,customer_flag,reconfirmed_at,studio_warned_at,stage`, { headers: H() });
  const req = (await rr.json().catch(() => []))[0] || null;
  if (!req || digitsOf(req.client_phone) !== digitsOf(from)) { await sendMenu(from, L); return; }
  const pc = req.partner_id ? await partnerCard(req.partner_id) : { business_name: "", address: "", phone: "", neighbourhood: "" };
  const studio = pc.business_name || req.studio_name || "";
  const time = reqTime(req);
  const name = req.first_name || "";
  const studioNum = await studioNumberFor(req);
  const minsTo = req.confirmed_start ? Math.round((Date.parse(req.confirmed_start) - Date.now()) / 60000) : 9999;
  if (req.stage !== "confirmed") { await sendStatus(from, L, from); return; }
  // v212: what the studio reads names the client, the day and the hour, in
  // Spanish: "Hola, Brandon me ha confirmado que viene hoy a las 15:30."
  const who = name || "el cliente";
  const dEs = studioDayEs(req);
  const hEs = studioHour(req) ? `a las ${studioHour(req)}` : "";
  const ref = [deDay(dEs), hEs].filter(Boolean).join(" ");
  if (kind === "yes") {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ reconfirmed_at: new Date().toISOString(), customer_flag: null }) });
    await sendText(from, COPY[L].reconfirmYes(studio, time, pc.address));
    await tellStudio(studioNum, name, time, `Hola, ${who} me ha confirmado que viene${[dEs, hEs].filter(Boolean).length ? " " + [dEs, hEs].filter(Boolean).join(" ") : ""}. Gracias.`, "ha confirmado que viene", { dayEs: dEs, v2: "Ha confirmado que viene." });
    if (req.studio_warned_at) await notifyJordanWa(`${name || "Customer"} confirmed after all for ${studio} ${time}. Studio told.`, from);
    s.step = "done"; s.data.reconfirm = null; await saveSession(s);
    await logEvent(from, "reconfirmed", { id: req.id });
    return;
  }
  if (kind === "cancel") {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "cancelled", customer_flag: "cancelled", stage_note: "Cancelled by the customer on WhatsApp", stage_updated_at: new Date().toISOString() }) });
    await sendText(from, COPY[L].cancelled(studio));
    await tellStudio(studioNum, name, time, `Hola, ${who} acaba de cancelar su masaje${ref ? " " + ref : ""}, así que podéis dar el hueco a otra persona. Perdonad las molestias.`, "ha cancelado, así que podéis dar el hueco a otra persona", { dayEs: dEs, v2: "Acaba de cancelar, así que podéis dar el hueco a otra persona. Perdonad las molestias." });
    await notifyJordanWa(`${name || "Customer"} CANCELLED ${studio} ${time} (${minsTo > 0 ? minsTo + " min before" : "after the time"}). Studio told. Request #${req.id}.`, from);
    s.step = "done"; s.data.reconfirm = null; await saveSession(s);
    await logEvent(from, "cancelled", { id: req.id, minsTo });
    return;
  }
  // change: nothing is promised to anyone until the customer names a time.
  await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ customer_flag: "change_requested" }) });
  await sendText(from, COPY[L].changeAsk(studio, time));
  // v212: nothing new is promised to the studio until the customer names a time.
  if (minsTo <= 240) await tellStudio(studioNum, name, time, `Hola, ${who} me pide cambiar su masaje${ref ? " " + ref : ""}, así que podéis dejar libre ese hueco. Cuando me diga otra hora, os pregunto si os va bien.`, "pide cambiar la hora, así que podéis dejar libre ese hueco", { dayEs: dEs, v2: "Me pide cambiar la hora, así que podéis dejar libre ese hueco. Cuando me diga otra, os pregunto si os va bien." });
  s.data.prevStep = s.step; s.step = "await_change"; s.data.change = { request: req.id, studio, time, studioNum }; s.data.reconfirm = null; await saveSession(s);
  await notifyJordanWa(`${name || "Customer"} wants to CHANGE ${studio} ${time}. Bot asked what works${minsTo <= 240 ? " and told the studio to free the slot" : ""}. Request #${req.id}.`, from);
  await logEvent(from, "change_requested", { id: req.id, minsTo });
}

// v47: a customer saying no in a sentence, not with the word "cancel". On 5 Sept
// Mateo wrote "I'm not going to be having any massage" and "I'm leaving Madrid
// early" at the email question and was told twice it did not look like an email.
const DECLINE_RE = /\b(not going to|won'?t be|no longer|not any ?more|leaving madrid|leaving (the )?city|no voy a|ya no (voy|quiero|puedo)|no podr[eé]|me voy de madrid|no me interesa|no quiero|forget it|never ?mind|don'?t need|no (lo )?necesito|not (be )?(having|coming|going))\b/i;

// ---- v46: best offer wins ----
// v114 (Jordan, 19 Sept): a tap no longer opens this window. It still holds the
// requests where a studio writes a discount in free text, which is the only
// remaining way a booking waits for a better offer.
const BID_WINDOW_MS = 10 * 60 * 1000;
// v110 (Jordan, 19 Sept): "before we offer pricing we must confirm with the
// studio there price after our potential discount." This is the only thing we
// still ask a studio for after they have said yes, and it no longer holds the
// booking up: the customer already has the offer by the time it goes out.
// v212 (16 Oct): "Por cierto" makes the second bubble read like a person
// adding a thought, not a form; the duration is the request's own; "se lo
// decimos en cuanto nos lo digáis" (untrue for a held customer, and the offer
// is already with the customer) and the signature are gone. "Estoy
// preguntando a varios centros" only when two or more really were asked.
const priceAsk = (req: any, several: boolean) => several
  ? `Por cierto, ¿qué precio final le dejaríais por ${reqDuration(req)} min? Estoy preguntando a varios centros y se queda con la mejor oferta, así que si podéis hacerle un 10% como cliente de Massage Club, decídmelo.`
  : `Por cierto, ¿qué precio final le dejaríais por ${reqDuration(req)} min? Si podéis hacerle un 10% como cliente de Massage Club, decídmelo.`;
// True when two or more studios were really asked about this request.
async function severalAsked(requestId: number | string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${encodeURIComponent(String(requestId))}&select=id&limit=2`, { headers: H() });
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length > 1;
  } catch { return false; }
}
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
// v81: partner_id is not a reliable key for a tap. A studio with more than one
// partner row, or an offer that went out against a different row, leaves the
// partner lookup pointing somewhere the dispatch was never written. The phone
// we actually messaged is the fact that cannot be wrong, so fall back to it.
// A dropped tap is invisible and costs a booking, so this never returns empty
// quietly: if nothing matches at all, it says so in the log.
async function dispatchRowFor(requestId: number, partnerId: string, fromDigits = ""): Promise<any | null> {
  const sel = "id,outcome,phone,discount_pct,quoted_price,accepted_at,partner_id";
  if (partnerId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${requestId}&partner_id=eq.${encodeURIComponent(partnerId)}&order=created_at.desc&limit=1&select=${sel}`, { headers: H() });
    const rows = await r.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]) return rows[0];
  }
  const digits = digitsOf(fromDigits);
  if (digits.length >= 9) {
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${requestId}&order=created_at.desc&select=${sel}`, { headers: H() });
    const all = await r2.json().catch(() => []);
    if (Array.isArray(all)) {
      const tail = digits.slice(-9);
      const hit = all.find((d: Record<string, unknown>) => digitsOf(String(d.phone || "")).endsWith(tail));
      if (hit) { console.log("[studio] dispatch matched by phone, not partner_id", requestId, digits); return hit; }
      console.log("[studio] TAP DROPPED: no dispatch row for request", requestId, "phone", digits, "rows", all.length);
    }
  }
  return null;
}
async function patchDispatch(id: string, body: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify(body) });
}
// "10%", "un 10 %", "10 por ciento", "diez por ciento de descuento".
function parseDiscount(text: string): number | null {
  const t = String(text || "").toLowerCase();
  // "10/" is a slipped "10%": Centro Aloha wrote "le hacemos el 10/ de
  // descuento" and it read as no discount at all, so the message fell through
  // to the free-text branch and was attached to the wrong request.
  // v212: but "19/10" is a date, not 19%. A slash followed by a digit is never
  // a discount; "10/ de descuento" still is.
  const m = t.match(/(\d{1,2})\s*(%|\/(?!\s*\d)|por\s*ciento|porciento)/);
  let n: number | null = m ? parseInt(m[1], 10) : null;
  if (n === null && /descuento|dto|por\s*ciento/.test(t)) {
    const words: Record<string, number> = { cinco: 5, diez: 10, quince: 15, veinte: 20, veinticinco: 25, treinta: 30 };
    for (const [w, v] of Object.entries(words)) if (new RegExp(`\\b${w}\\b`).test(t)) { n = v; break; }
  }
  if (n === null || n < 5 || n > 50) return null;
  return n;
}
// ---- v65: read the message instead of pattern-matching it ----
// Every customer-facing failure on 8 September was a regular expression missing
// a plain sentence. Fernando typed "Sinergia 38", "Opción 1", "Lavapies es
// perfecto", "Dígame la dirección", "Cuánto es el precio con el 10 por ciento?"
// and his own phone number when asked for consent. All six got the menu.
//
// This runs ONLY where the bot has already given up, so it can never make a
// working path worse. Without an API key it does nothing at all and the old
// behaviour stands, which is why it is safe to ship before the key exists.
//
// The model never writes to the customer. It returns a structured reading and
// the bot answers from the same approved copy it always used, so the rules on
// wording, signing and health claims cannot be talked around.
type Reading = {
  intent: string;
  language: string;
  question: string | null;
  fields: { day?: string; time?: string; area?: string; service?: string; budget_eur?: number | null; studio_choice?: string; phone_consent?: boolean | null };
  confidence: number;
};
const AI_SYSTEM = `You read one WhatsApp message for Massage Club, a massage booking concierge in Madrid, and return JSON only.

You never write to the customer. You only report what their message means.

Return exactly this shape:
{"intent":"...","language":"es|en","question":"price|address|how_it_works|zone|hours|therapist|services|other|null","fields":{"day":"","time":"","area":"","service":"","budget_eur":null,"studio_choice":"","phone_consent":null},"confidence":0.0}

intent is one of:
  ask        they are asking a question (set "question")
  choose     they are picking one of the options we offered (set fields.studio_choice to the studio name or the option number as written)
  confirm    they are saying yes to what we proposed
  decline    they are saying no to what we proposed
  detail     they are supplying booking details (set the fields they gave)
  consent    they are answering a request for permission (set fields.phone_consent true or false)
  change     they want to move or alter an existing booking
  cancel     they want to cancel
  arrived    they are at the studio now, or on their way to an appointment they already have
  smalltalk  thanks, greetings, acknowledgements, nothing to act on
  unclear    you cannot tell

Rules:
- question "therapist" is anyone asking WHO does the massage: man or woman, male or female, qualified, trained, who is the masseur.
- question "services" is asking which massages or types we offer, or for a list or menu of them ("what type massage?", "send me the menu", "qué masajes hay").
- Report only what the message says. Never invent a day, time, price or studio.
- fields.time only for a clock time the customer named, in HH:MM. A duration like "1h" or "una hora" is not a time.
- budget_eur only if they named a maximum they will pay.
- confidence is 0 to 1. Use below 0.6 when you are guessing.
- Output JSON and nothing else.`;

async function interpret(text: string, history: Array<{ dir: string; body: string }>, state: string): Promise<Reading | null> {
  const key = await aiKey();
  if (!key || !text.trim()) return null;
  const convo = history.slice(-8).map((m) => `${m.dir === "in" ? "Customer" : "Us"}: ${m.body.slice(0, 300)}`).join("\n");
  const user = `Where the booking stands: ${state}\n\nRecent conversation:\n${convo}\n\nThe message to read:\n${text.slice(0, 600)}`;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 400, system: AI_SYSTEM, messages: [{ role: "user", content: user }] }),
    });
    clearTimeout(timer);
    if (!res.ok) { console.log("[wa] interpret http", res.status, (await res.text()).slice(0, 200)); return null; }
    const out = await res.json();
    const raw = String(out?.content?.[0]?.text || "");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const r = JSON.parse(m[0]) as Reading;
    if (!r || typeof r.intent !== "string") return null;
    r.fields = r.fields || {};
    r.confidence = Number(r.confidence) || 0;
    return r;
  } catch (e) {
    console.log("[wa] interpret failed", String(e));
    return null;
  }
}

// The last dozen messages either way, oldest first.
async function recentThread(phone: string): Promise<Array<{ dir: string; body: string }>> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${digitsOf(phone)}&order=created_at.desc&limit=12&select=direction,body`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) ? rows : []).reverse().map((x: any) => ({ dir: String(x.direction || ""), body: String(x.body || "") }));
}

// A one-line description of where this person's booking stands, for the model.
async function bookingState(phone: string): Promise<{ line: string; req: any }> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=ilike.*${digitsOf(phone)}&order=id.desc&limit=1&select=id,first_name,service_name,day1,time1,area,stage,studio_name,confirmed_day,confirmed_time,partner_id,share_ok,client_phone,therapist_gender`, { headers: H() });
  const rows = await r.json().catch(() => []);
  const req = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!req) return { line: "No booking on file yet.", req: null };
  const when = [req.confirmed_day || req.day1, req.confirmed_time || req.time1].filter(Boolean).join(" ");
  return {
    line: `Request #${req.id}, ${req.stage}. ${req.service_name || "massage"}${when ? " for " + when : ""}${req.studio_name ? " at " + req.studio_name : ""}${req.area ? " near " + req.area : ""}.`,
    req,
  };
}

// The bot acts on the reading using its own approved copy. Returns true when it
// handled the message, false to let the old fallback run.
// v81: has a studio confirmed the therapist gender this customer asked for,
// in its own written words? Only a dispatch row carrying therapist_gender_ok
// counts, and only for the studio that is actually holding the booking, because
// one studio saying yes says nothing about another. Returns null when we do not
// know, which is the case the customer must never hear a guess about.
async function confirmedGender(req: any): Promise<{ studio: string; gender: string } | null> {
  const want = String(req?.therapist_gender || "");
  if (!want || !req?.id) return null;
  const url = `${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${req.id}&therapist_gender_ok=is.true&select=partner_id,therapist_gender_note${req.partner_id ? `&partner_id=eq.${encodeURIComponent(req.partner_id)}` : ""}&limit=1`;
  const rows = await (await fetch(url, { headers: H() })).json().catch(() => []);
  if (!Array.isArray(rows) || !rows[0]) return null;
  return { studio: String(req.studio_name || "The studio"), gender: want };
}

async function actOnReading(r: Reading, s: Session, from: string, L: string, req: any, text: string): Promise<boolean> {
  await logEvent(from, "interpreted", { intent: r.intent, question: r.question, confidence: r.confidence, text: text.slice(0, 160) });
  if (r.confidence < 0.6) return false;
  // v93: the reading's language guess is a guess, and it loses to the language
  // this customer has actually been speaking. Andy wrote "Tell them how is the
  // masseur?" on 15 Sept, in English, in a session already set to en, and the
  // model read it as Spanish. He was answered twice in Spanish and stopped
  // replying. A stored language is evidence; a per-message guess is not.
  const lang = (s.data.lang === "es" || s.data.lang === "en") ? String(s.data.lang)
    : (r.language === "es" || r.language === "en") ? r.language : L;

  if (r.intent === "ask") {
    if (r.question === "price") { await sendText(from, COPY[lang].priceInfo); return true; }
    if (r.question === "how_it_works") { await sendText(from, COPY[lang].howItWorks); return true; }
    if (r.question === "address") {
      // Only a real address from a real confirmed booking, never a guess.
      if (req && req.partner_id && req.stage === "confirmed") {
        const pc = await partnerCard(String(req.partner_id));
        if (pc.address) {
          await sendText(from, bookedWhere(req, pc, lang));
          return true;
        }
      }
      await sendText(from, COPY[lang].zoneAnswer);
      return true;
    }
    if (r.question === "zone") { await sendText(from, COPY[lang].zoneAnswer); return true; }
    // v79: asked twice in six hours on 9 September, by Asim at 14:09 and by an
    // Instagram lead at 21:11. Both got a service menu or a promise nobody kept.
    // It is a frequently asked question, not an edge case, and the answer holds
    // for every studio without any therapist data we do not have.
    // v81: if a studio has already answered this in writing, say so. Fernando
    // asked "Will be a guy right ?" at 13:30:41 on 11 September, twenty hours
    // after Centro Aloha had written "Si hay masajista chico, mañana le
    // esperamos a Fernando". He got the generic line offering to ask the studio
    // before booking, then the main menu, and cancelled 66 seconds later.
    if (r.question === "therapist") {
      const known = req ? await confirmedGender(req) : null;
      if (known) {
        const when = [req.confirmed_time || req.time1].filter(Boolean).join("");
        await sendText(from, lang === "es"
          ? `Sí. ${known.studio} confirmó masajista ${known.gender === "male" ? "chico" : "chica"} para tu cita${when ? " de las " + when : ""}.`
          : `Yes. ${known.studio} confirmed a ${known.gender} therapist for your${when ? " " + when : ""} booking.`);
        // Back where they were, never the main menu. The menu is what lost him.
        await reAsk(s, from, lang);
        return true;
      }
      const wanted = req && req.therapist_gender ? String(req.therapist_gender) : (s.data.therapistGender ? String(s.data.therapistGender) : "");
      if (wanted) {
        await sendText(from, lang === "es"
          ? `Se lo he pedido al centro: masajista ${wanted === "male" ? "chico" : "chica"}. En cuanto me confirmen te lo digo.`
          : `I have asked the studio for a ${wanted} therapist. I will tell you the moment they confirm.`);
        await reAsk(s, from, lang);
        return true;
      }
      // v93: this line invites a one word answer, so remember that we asked.
      // The handler upstream then accepts a bare "MAN" or "Mujer" as the answer.
      await sendText(from, COPY[lang].therapistAnswer);
      s.data.askedGender = new Date().toISOString();
      await saveSession(s);
      return true;
    }
    // v76 (9 Sept): everything else used to return false, which dropped the
    // customer into the service menu. On 9 Sept the model read Asim's "Provide
    // the service male or female?" as intent ask, question other, confidence
    // 0.95, and the bot still asked him which massage he would like. Fernando
    // got the same treatment when he asked which metro on his way to a booking
    // he had already paid attention to, and Jose asked what a Thai massage was
    // like and was told "Perfecto, tailandés". A question we cannot answer is
    // not noise: say we are finding out, and put it in front of Jordan.
    // v200 (11 Oct): Hafeez typed "What type massage?" at the free-text day
    // step, the chain there has no services case, and he was told "I do not
    // have that detail to hand". The list is in COPY. The list goes without its
    // closing question and the step's own question follows, so it is one ask.
    if (r.question === "services" || (SERVICEQ_RE.test(text) && !detectService(text))) {
      const list = String(COPY[lang].servicesAnswer).split("\n\n").slice(0, -1).join("\n\n");
      await sendText(from, list + "\n\n" + (lang === "es" ? "Dime cuál te apetece. Si no lo tienes claro, el relajante es el más pedido." : "Tell me which one you'd like. If you're not sure, relaxing is the most popular."));
      await logEvent(from, "services_asked", { said: String(text).slice(0, 80), at: s.step, via: "reading" });
      await reAsk(s, from, lang);
      return true;
    }
    const askNum = digitsOf(from);
    await sendText(from, COPY[lang].willFindOut);
    await notifyJordanWa(`${s.wa_name || "+" + askNum} asked something the bot has no answer for${req ? " (#" + req.id + ")" : ""}: ${text.slice(0, 140)}`, from);
    await founderCard(`❓ ${s.wa_name || "+" + askNum} asked a question we cannot answer${req ? " · #" + req.id : ""}`, {
      badge: "NEEDS AN ANSWER",
      title: `${s.wa_name || "The customer"} asked something not in the bot's copy`,
      paras: [
        `Read as: a question, type "${r.question || "unknown"}" (confidence ${r.confidence}).`,
        `They were told we are finding out. Nothing was guessed at and no menu was sent. They are waiting on a real answer from you.`,
      ],
      quote: text, waNum: askNum, prefill: await customerPrefill(s.phone), to: JORDAN,
    });
    return true;
  }

  if (r.intent === "consent" && typeof r.fields.phone_consent === "boolean" && req) {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, {
      method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ share_ok: r.fields.phone_consent }),
    });
    await sendText(from, r.fields.phone_consent
      ? (lang === "es" ? "Perfecto, gracias. Se lo paso al centro." : "Perfect, thank you. I will pass it to the studio.")
      : (lang === "es" ? "Entendido, no se lo damos. Cualquier cosa te la digo yo por aquí." : "Understood, we will not share it. Anything they need to say reaches you through me."));
    await notifyJordanWa(`${s.wa_name || "+" + digitsOf(from)} ${r.fields.phone_consent ? "AGREED" : "REFUSED"} to share their number with the studio (#${req.id}).`, from);
    return true;
  }

  // v76: "Ya he llegado" from a customer standing at the studio door came back
  // as the service menu, because a message opening with "Hola" was read as a
  // greeting and nothing after it was read at all. Acknowledge the booking they
  // already have. The studio is NOT messaged from here: the relay that guesses
  // which customer a studio means is still wrong, and adding another automatic
  // studio message would make that worse.
  if (r.intent === "arrived" && req && String(req.stage) === "confirmed") {
    const when = [req.confirmed_day || req.day1, req.confirmed_time || req.time1].filter(Boolean).join(" ");
    await sendText(from, lang === "es"
      ? `Genial${req.first_name ? ", " + req.first_name : ""}. Tu cita en ${req.studio_name || "el centro"}${when ? " es " + when : ""}. Que la disfrutes.`
      : `Great${req.first_name ? ", " + req.first_name : ""}. Your appointment at ${req.studio_name || "the studio"}${when ? " is " + when : ""}. Enjoy it.`);
    await logEvent(from, "customer_arrived", { id: req.id, studio: req.studio_name || null });
    await notifyJordanWa(`${req.first_name || s.wa_name || "+" + digitsOf(from)} says they have arrived for #${req.id} at ${req.studio_name || "the studio"}${when ? " (" + when + ")" : ""}.`, from);
    return true;
  }

  if (r.intent === "smalltalk") { await sendText(from, COPY[lang].ackReply); return true; }

  // v204 (12 Oct): never at the offer step. With a studio's time in front of
  // the customer the block below answered "Got it, I am checking that now and
  // will confirm in a moment" and moved the chat to "human", which dropped the
  // live offer. Al (#83) turned down Centro Aloha with "Keep looking" and then
  // "Prefer to look for another center"; both got that line and nothing ever
  // followed. Each of these has an answer the bot can give itself. A yes brings the buttons
  // back (only a tap confirms, v199), a no or "another centre" shows the next
  // offer (declineOffer), a change asks for the time or leaves a named time to
  // the await_offer step, and a clear cancel closes the request.
  if (s.step === "await_offer" && s.data.offer?.row && ["choose", "confirm", "decline", "change", "cancel"].includes(r.intent)) {
    if (r.intent === "change" && r.fields.time) return false;
    const row = String(s.data.offer.row);
    if (r.intent === "confirm" || r.intent === "choose") {
      if (!(await reshowOffer(s, from, lang, "typed_yes"))) await sendText(from, COPY[lang].offerGone);
    } else if (r.intent === "change") {
      await sendText(from, OFFER_COPY[lang].askTime);
    } else if (r.intent === "cancel" && (CANCEL_RE.test(text) || DECLINE_RE.test(text))) {
      await cancelOffered(s, from, lang, text);
    } else {
      await declineOffer(row, from, lang, s, ALT_OFFER_RE.test(text) ? "alt" : "time");
    }
    await logEvent(from, "offer_step_reading", { intent: r.intent, row });
    return true;
  }

  // choose, confirm, decline, change and cancel all move money or a partner's
  // diary, so a person decides. The difference from before is that Jordan is
  // told what the customer actually meant instead of "bot answered with menu".
  if (["choose", "confirm", "decline", "change", "cancel"].includes(r.intent)) {
    const num = digitsOf(from);
    await sendText(from, lang === "es"
      ? "Recibido, lo miro ahora mismo y te confirmo en un momento."
      : "Got it, I am checking that now and will confirm in a moment.");
    await notifyJordanWa(`${s.wa_name || "+" + num} wants to ${r.intent.toUpperCase()}${r.fields.studio_choice ? " (" + r.fields.studio_choice + ")" : ""}${req ? " on #" + req.id : ""}: ${text.slice(0, 140)}`, from);
    await founderCard(`🔔 ${s.wa_name || "+" + num} wants to ${r.intent}${req ? " · #" + req.id : ""}`, {
      badge: r.intent.toUpperCase(),
      title: `${s.wa_name || "The customer"} said something the bot will not act on alone`,
      paras: [
        `Read as: ${r.intent}${r.fields.studio_choice ? `, choosing "${r.fields.studio_choice}"` : ""}${r.fields.day ? `, day ${r.fields.day}` : ""}${r.fields.time ? `, time ${r.fields.time}` : ""}${r.fields.budget_eur ? `, budget ${r.fields.budget_eur} EUR` : ""} (confidence ${r.confidence}).`,
        `They were told we are looking at it. Nothing was promised to a studio.`,
      ],
      quote: text, waNum: num, to: JORDAN,
    });
    s.step = "human"; await saveSession(s);
    return true;
  }
  return false;
}

// The single entry point the give-up branches call.
// v163 (5 Oct, Jordan: "use openclaw or hermes to use openweight models to
// help you with the customers"). The hand-off to the customer agent. When
// app_secrets holds AGENT_URL (and AGENT_KEY), anything the bot cannot answer
// by itself goes there first with the conversation, the booking and the facts
// file (docs/agent/facts.md). The agent answers { reply, mode }. "send" goes
// out only if it passes the house rules below; everything else, and every
// "draft", goes to Jordan instead and the bot carries on as before. With no
// AGENT_URL nothing changes.
// v195: facts.md comes from the same commit as this file, not from main. main
// still said "40 to 85 EUR" after the branch moved to 50 to 85, so the agent
// quoted the old range. When bot.ts is loaded from a pinned raw URL this
// resolves to that commit's docs/agent/facts.md; run locally it falls back to main.
const FACTS_URL = import.meta.url.startsWith("https://raw.githubusercontent.com/")
  ? new URL("../../../docs/agent/facts.md", import.meta.url).href
  : "https://raw.githubusercontent.com/jordanjayhays-cpu/your-massage-pass/main/docs/agent/facts.md";
// v196 (replay, 9 Oct): the agent added "o usar nuestro formulario rápido:
// https://book.massageclub.io/reserve" to answers nobody asked a link for.
// Links go only to someone asking what we are, for photos or for the website
// (standing rule), so any sentence carrying one is dropped otherwise.
// v206: the condition on its own, so agent_core's guard asks the same question.
const linkAsked = (asked: string): boolean => HOWWORKS_RE.test(asked) || WHO_RE.test(asked) || PHOTOQ_RE.test(asked) || /\b(web|website|p[aá]gina|link|enlace|online|fotos?|photos?|pictures?)\b/i.test(asked);
function stripUnaskedLink(reply: string, asked: string): string {
  if (!/massageclub\.io/i.test(reply)) return reply;
  if (linkAsked(asked)) return reply;
  const kept = reply.split(/(?<=[.!?])\s+/).filter((x) => !/massageclub\.io/i.test(x));
  const out = kept.join(" ").trim();
  return out.length >= 20 ? out : reply;
}
function agentReplyOk(reply: string): boolean {
  if (!reply || reply.length > 700) return false;
  if (/\u2014|\u2013/.test(reply)) return false;                                   // no em or en dashes
  if (/descuento|discount|\d+\s?%/i.test(reply)) return false;                      // never quote a discount
  if (/https?:\/\/(?!(book\.)?massageclub\.io)/i.test(reply)) return false;       // massageclub.io links only
  if (/\b(detox|toxin|toxinas|cure|cura|immun|inmun)\b/i.test(reply)) return false; // no health claims
  if (/\b(confirmed|confirmado|reservado|booked for you)\b/i.test(reply)) return false; // only the flow confirms
  // v171 (Jordan, 5 Oct: "I don't want made up stuff"). A studio fact the
  // facts file does not hold (Hermes without the rules said "el centro cuenta
  // con duchas privadas") only goes out as "it depends, we will ask".
  const studioFact = /\b(showers?|duchas?|parking|aparcamiento|lockers?|taquillas?|wifi|tarjeta|card|address|direcci[oó]n|open until|abierto hasta)\b/i.test(reply)
    || /\b(therapists?|terapeutas?|staff|studios?|estudios?|centros?)\b[^.]{0,60}\b(english|ingl[eé]s)\b/i.test(reply);
  if (studioFact && !/\b(depends?|depende|ask|preguntamos|preguntaremos|check|comprobamos|lo miramos)\b/i.test(reply)) return false;
  // v172 (Jordan, 5 Oct: "make sure Hermes doesn't reveal anything sensitive").
  // Nothing about how we run goes to a customer: keys, our tools, the prompt,
  // money between us and studios, Jordan, any phone number or email.
  if (/\b(sk-|hk-|ghp_|re_[A-Za-z0-9]{6}|EAA[A-Za-z0-9]{10}|eyJ[A-Za-z0-9_-]{10})/.test(reply)) return false;
  if (/\b(supabase|railway|hermes|openrouter|qwen|anthropic|claude|chatgpt|openai|api|app_secrets|system prompt|my instructions|mis instrucciones|facts file|commission|comisi[oó]n|margin|margen|jordan)\b/i.test(reply)) return false;
  if (/\+?\d[\d\s.-]{7,}\d/.test(reply)) return false;
  if ((reply.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).some((e) => e.toLowerCase() !== "support@massageclub.io")) return false;
  return true;
}
// v172: studio names are ours to reveal with an offer, never the agent's.
let studioNames: string[] | null = null;
// v206: the list on its own, for agent_core's guard too. Throws when the
// partners cannot be fetched; both callers treat that as unsafe.
async function studioNameList(): Promise<string[]> {
  if (studioNames) return studioNames;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/partners?select=business_name&limit=2000`, { headers: H() });
  const rows = await r.json().catch(() => []);
  studioNames = (Array.isArray(rows) ? rows : []).map((x: any) => String(x.business_name || "").toLowerCase().trim()).filter((n: string) => n.length >= 5);
  return studioNames;
}
async function namesAStudio(reply: string): Promise<boolean> {
  let names: string[];
  try { names = await studioNameList(); } catch { return true; } // cannot check: treat as unsafe
  const t = reply.toLowerCase();
  return names.some((n) => t.includes(n));
}
// v164 (5 Oct): Railway (where Hermes lives) is blocked by an expired trial,
// and Jordan has OpenRouter credits. With OPENROUTER_API_KEY in app_secrets and
// no AGENT_URL, the bot asks an open-weight model on OpenRouter directly
// (AGENT_MODEL, default qwen/qwen3.5-122b-a10b, thinking off), with docs/agent/facts.md as
// its instructions. Same contract and same checks as the Hermes hand-off.
// AGENT_MODE=draft in app_secrets turns every answer into a draft for Jordan.
let factsCache = "";
async function agentFacts(): Promise<string> {
  if (factsCache) return factsCache;
  try { const r = await fetch(FACTS_URL); if (r.ok) factsCache = await r.text(); } catch { /* use what we have */ }
  return factsCache;
}
// v168: one OpenAI-style caller for both brains. OpenRouter (default), or
// Hermes on Railway when AGENT_URL ends in /v1 (the hermes-api-relay service,
// with AGENT_KEY). Hermes gets X-Hermes-Session-Id per customer, which is what
// gives it a memory of each person across conversations.
function agentSystem(facts: string): string {
  return `You answer WhatsApp messages for Massage Club, a massage concierge in Madrid. These are your facts and rules; follow them exactly:\n\n${facts}\n\nWrite ONE short WhatsApp reply (at most 3 sentences) in the customer's language (lang). Answer only what they asked. Do NOT ask the next booking question (day, time, area): the bot sends it with buttons right after your answer. Plain text, no markdown, no emojis beyond one if natural. Return JSON only: {"reply": "...", "mode": "send" or "draft"}. Use "draft" whenever you are not sure, the question is about a specific booking, a complaint, money, or anything not in the facts.`;
}
// v173 (Jordan, 5 Oct: "go with option 1"). Claude is the second opinion: when
// Hermes or Qwen drafts, fails a check, or does not answer, Claude gets the
// same question and the same rules. Its answer goes out only if it passes the
// same checks; otherwise Jordan gets both drafts.
async function claudeAgent(body: Record<string, unknown>): Promise<{ reply?: string; mode?: string } | null> {
  const key = await aiKey();
  const facts = await agentFacts();
  if (!key || !facts) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal: AbortSignal.timeout(9000),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 500, temperature: 0.2, system: agentSystem(facts), messages: [{ role: "user", content: JSON.stringify(body) }] }),
  });
  if (!res.ok) { console.log("[wa] claude agent http", res.status, (await res.text()).slice(0, 160)); return null; }
  const out = await res.json().catch(() => ({}));
  const txt = (Array.isArray(out?.content) ? out.content : []).filter((b: any) => b?.type === "text").map((b: any) => String(b.text || "")).join("");
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
async function openRouterAgent(body: Record<string, unknown>, hermes?: { url: string; key: string }): Promise<{ reply?: string; mode?: string } | null> {
  const key = hermes ? hermes.key : await appSecret("OPENROUTER_API_KEY");
  if (!key) return null;
  const facts = await agentFacts();
  if (!facts) return null;
  const system = agentSystem(facts);
  const res = await fetch(hermes ? `${hermes.url.replace(/\/$/, "")}/chat/completions` : "https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(hermes ? 10000 : 15000),
    headers: hermes
      ? { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Hermes-Session-Id": `wa-${String(body.phone || "")}` }
      : { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "HTTP-Referer": "https://book.massageclub.io", "X-Title": "Massage Club bot" },
    body: JSON.stringify(hermes ? { model: "massage-club", stream: false, messages: [{ role: "system", content: system + " Do not use any tools." }, { role: "user", content: JSON.stringify(body) }] } : { model: (await appSecret("AGENT_MODEL")) || "qwen/qwen3.5-122b-a10b", max_tokens: 700, temperature: 0.3, response_format: { type: "json_object" },
      // Thinking off: with it on Qwen took 22 and 93 seconds on 5 Oct, past
      // the 15 second budget; off it answers in about 1.5 seconds.
      reasoning: { enabled: false },
      messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(body) }] }),
  });
  const j = await res.json().catch(() => ({}));
  const content = String(j?.choices?.[0]?.message?.content || "");
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) { console.log("[wa] openrouter agent: no JSON", res.status, content.slice(0, 160)); return null; }
  try { return JSON.parse(m[0]); } catch { return null; }
}
// v175 (Jordan, 5 Oct, TypeSafe docs): SHADOW MODE. When TYPESAFE_API_KEY is
// in app_secrets, every customer text is also read by Jev (a model that picks
// from a fixed list with a confidence) and logged as funnel_events "jev_shadow"
// beside what the bot's own word lists said. It never changes a reply. After a
// week we compare: where Jev is sure and the word lists missed (the v174
// complaint), Jev can take that decision over. No key, nothing happens.
const JEV_INTENTS: Record<string, string> = {
  booking_info: "Answers or gives booking details: massage type, day, time, area, name, email or phone",
  question: "Asks a question about the service, prices, studios or how it works",
  complaint: "Complains about a massage, studio or our service, or asks for a refund",
  cancel: "Wants to cancel a booking or says they no longer want it",
  change: "Wants to change the day, time or place of an existing booking",
  special: "Asks for a sexual, erotic, happy ending or 'special' massage",
  job: "A therapist or masseuse looking for work",
  smalltalk: "Greeting, thanks, ok, emoji or goodbye with nothing else",
  other: "None of the above",
};
function jevShadow(s: Session, from: string, text: string) {
  const run = (async () => {
    const key = await appSecret("TYPESAFE_API_KEY");
    if (!key) return;
    const t0 = Date.now();
    const res = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST", signal: AbortSignal.timeout(4000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "jev-latest",
        state: `A customer of Massage Club (a massage booking service in Madrid) wrote on WhatsApp. The bot had just asked them for: ${s.step}.\nTheir message: ${text.slice(0, 600)}`,
        questions: {
          intent: { type: "choice", instructions: "What is the customer doing with this message", criteria: JEV_INTENTS },
          complaint: { type: "noul", instructions: "The customer is unhappy with a massage, a studio or our service" },
          wants_person: { type: "noul", instructions: "The customer asks to talk to a real person" },
        },
      }),
    });
    const j = await res.json().catch(() => ({}));
    const a = j?.answers || {};
    await logEvent(from, "jev_shadow", {
      ms: Date.now() - t0, http: res.status, step: s.step, text: text.slice(0, 300),
      jev: { intent: a.intent?.choice ?? null, conf: a.intent?.confidence ?? null, probs: a.intent?.probabilities ?? null, complaint: a.complaint?.noul ?? null, wants_person: a.wants_person?.noul ?? null },
      rules: { complaint: COMPLAINT_RE.test(text), question: looksLikeQuestion(text), cancel: CANCEL_RE.test(text), change: CHANGE_RE.test(text), special: EROTIC_RE.test(text), job: JOB_RE.test(text), human: wantsHuman(text) },
    });
  })().catch((e) => console.log("[wa] jev shadow failed", String(e)));
  try { (globalThis as any).EdgeRuntime?.waitUntil?.(run); } catch { /* runs anyway */ }
}
// v184 (8 Oct): the new reader in shadow. Every customer free-text message is
// read by Claude into a structured Reading (see read.ts) and logged next to
// what the bot actually did, as funnel_events reader_shadow. Nothing it reads
// is acted on yet. READER in app_secrets: off | shadow (default) | on.
// READER_MODEL overrides the model.
let readerModeCache: { mode: string; model: string; at: number } | null = null;
async function readerConfig(): Promise<{ mode: string; model: string }> {
  if (readerModeCache && Date.now() - readerModeCache.at < 60_000) return readerModeCache;
  const mode = ((await appSecret("READER")) || "shadow").toLowerCase();
  const model = (await appSecret("READER_MODEL")) || AI_MODEL;
  readerModeCache = { mode, model, at: Date.now() };
  return readerModeCache;
}
// v206 (12 Oct, Jordan approved "change 3"): who goes through agent_core.ts.
// AGENT_CORE in app_secrets (an Edge Function secret wins, as for every
// appSecret): off, the default and the value for anything missing, empty,
// unreadable or unknown; test, only the canary's fake 3460000xxxx numbers;
// on, everyone. Read once a minute, like READER.
let coreModeCache: { mode: CoreMode; at: number } | null = null;
async function agentCoreMode(): Promise<CoreMode> {
  if (coreModeCache && Date.now() - coreModeCache.at < 60_000) return coreModeCache.mode;
  const mode = parseCoreMode(await appSecret("AGENT_CORE"));
  coreModeCache = { mode, at: Date.now() };
  return mode;
}
function madridNowLabel(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
function knownSlots(s: Session): Record<string, unknown> {
  const d = s.data || {};
  const k: Record<string, unknown> = {};
  for (const [a, b] of [["day", d.day], ["time", d.time], ["area", d.area], ["service", d.service], ["therapist_gender", d.therapistGender], ["language", d.lang], ["name", d.name], ["has_email", d.email ? true : null], ["live_offer", d.offer ? `${d.offer.studio} at ${d.offer.time}` : null]] as Array<[string, unknown]>) {
    if (b !== undefined && b !== null && b !== "") k[a] = b;
  }
  return k;
}
async function readFor(s: Session, from: string, text: string, model: string): Promise<{ reading: Reading2 | null; ms: number; usage?: unknown; error?: string; lastAsked: string }> {
  const thread = await recentThread(from);
  // The message being read is already logged; leave it out of the history.
  const hist = thread.length && thread[thread.length - 1].dir === "in" && thread[thread.length - 1].body === text ? thread.slice(0, -1) : thread;
  const lastOut = [...hist].reverse().find((m) => m.dir === "out");
  const r = await readMessage({ key: await aiKey(), model, text, step: s.step, lastAsked: lastOut ? lastOut.body : "", known: knownSlots(s), history: hist, madridNow: madridNowLabel() });
  return { ...r, lastAsked: lastOut ? lastOut.body.slice(0, 200) : "" };
}
// v191: one reading per message. The shadow read starts as soon as the message
// arrives; readerAssist below waits for that same reading instead of paying for
// (and waiting on) a second call.
const readings = new Map<string, Promise<Awaited<ReturnType<typeof readFor>> | null>>();
function readerShadow(s: Session, from: string, text: string) {
  const stepBefore = s.step;
  const knownBefore = knownSlots(s);
  const key = `${from}|${text}`;
  const reading = (async () => {
    const cfg = await readerConfig();
    if (cfg.mode === "off") return null;
    const r = await readFor(s, from, text, cfg.model);
    await logEvent(from, "reader_shadow", { text: text.slice(0, 400), step: stepBefore, known: knownBefore, last_asked: r.lastAsked, ms: r.ms, model: cfg.model, reading: r.reading, error: r.error || null, usage: r.usage || null });
    return r;
  })().catch((e) => { console.log("[wa] reader shadow failed", String(e)); return null; });
  readings.set(key, reading);
  if (readings.size > 200) readings.delete(readings.keys().next().value as string);
  try { (globalThis as any).EdgeRuntime?.waitUntil?.(reading); } catch { /* runs anyway */ }
}

// v191 (9 Oct, live): an Instagram lead wrote "1. Full body but with emphasis on
// lower lattisimus pain. 2. any time 3. near Rios Rosas" under the ad's line
// and was asked "Which day works for you?" as if they had said nothing. Every
// regex missed all three; the reader had area and service with quotes.
//
// READER=assist (or on): wherever the regex parsers found nothing, the reader's
// details are used. Only slots it can quote (validateReading already dropped
// anything else), only empty slots unless the customer is correcting one, and
// never on a message that declines, cancels, complains, asks for a person, a
// home visit or something sexual: those keep their own handling.
const READER_SVC: Record<string, string> = { relax: "svc_relax", deep: "svc_deep", thai: "svc_thai", sports: "svc_sports", couples: "svc_couples", hot_stone: "svc_stone", reflexology: "svc_reflex", shiatsu: "svc_shiatsu", balinese: "svc_bali", lymphatic: "svc_lymph" };
// v197: another language is no longer hands off. The reader understands it and
// waSend answers in it, so the details they give are kept like anyone else's.
const READER_HANDS_OFF = ["decline", "cancel", "complaint", "special_request", "home_visit", "wants_person"];
const YMD_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
function readerDay(v: string, L: string): { day: string; dayDate: string } | null {
  const x = String(v || "").trim().toLowerCase();
  const at = (plus: number, label?: string) => ({ day: label || longDate(L, plus), dayDate: longDate(L, plus) });
  if (x === "today") return mcMadridHour() >= 19 ? null : at(0, L === "es" ? "Hoy" : "Today");
  if (x === "tomorrow") return at(1, L === "es" ? "Mañana" : "Tomorrow");
  const wd = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(x);
  if (wd >= 0) {
    let plus = (wd - madridDow(0) + 7) % 7;
    if (plus === 0 && mcMadridHour() >= 19) plus = 7;
    return plus === 0 ? at(0, L === "es" ? "Hoy" : "Today") : plus === 1 ? at(1, L === "es" ? "Mañana" : "Tomorrow") : at(plus);
  }
  const m = x.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [ty, tm, td] = YMD_FMT.format(new Date()).split("-").map((n) => parseInt(n, 10));
    const plus = Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(ty, tm - 1, td)) / 86400e3);
    if (plus < 0 || plus > 60) return null;
    return plus === 0 ? readerDay("today", L) : plus === 1 ? at(1, L === "es" ? "Mañana" : "Tomorrow") : at(plus);
  }
  return null;
}
function applyReading(s: Session, r: Reading2, L: string, own: string | null): string[] {
  const got: string[] = [];
  const sl = r.slots || {};
  const may = (k: string, cur: unknown) => k === own || !cur || r.changes_earlier_answer;
  if (sl.day && may("day", s.data.day)) {
    const d = readerDay(sl.day.value, L);
    if (d) { s.data.day = d.day; s.data.dayDate = d.dayDate; got.push("day"); }
  }
  if (sl.time && may("time", s.data.time)) {
    const v = String(sl.time.value || "").toLowerCase();
    const band = v === "morning" ? "time_morning" : v === "afternoon" ? "time_afternoon" : v === "evening" ? "time_evening" : "";
    const hm = v.match(/^(\d{1,2}):(\d{2})$/);
    if (band) { s.data.timeBandId = band; s.data.timeBand = L === "es" ? HOURS[band].labelEs : HOURS[band].label; s.data.time = s.data.timeBand; got.push("time"); }
    else if (hm && +hm[1] >= 8 && +hm[1] <= 21) { s.data.time = `${hm[1].padStart(2, "0")}:${hm[2]}`; s.data.timeBand = null; s.data.timeBandId = null; got.push("time"); }
    else if (v === "earliest" && /^(today|hoy)$/i.test(String(s.data.day || ""))) { s.data.time = COPY[L].earliestToday; s.data.timeBand = null; s.data.timeBandId = null; got.push("time"); }
  }
  if (sl.area && may("area", s.data.area)) {
    const v = String(sl.area.value || "").trim();
    const a = detectAreaPlus(v) || detectAreaPlus(sl.area.quote) || (/^[\p{L}][\p{L} .'-]{1,39}$/u.test(v) && !/^(madrid|centro de madrid)$/i.test(v) ? v : "");
    if (a) { s.data.area = a; s.data.areaAt = Date.now(); got.push("area"); }
  }
  if (sl.service && (may("service", s.data.service) || s.data.defaultService)) {
    const id = READER_SVC[String(sl.service.value || "").toLowerCase()];
    if (id && id !== s.data.service) { s.data.service = id; delete s.data.defaultService; got.push("service"); }
  }
  if (sl.duration_min && !s.data.duration && [30, 45, 60, 90, 120].includes(Number(sl.duration_min.value))) s.data.duration = Number(sl.duration_min.value);
  if (sl.therapist_gender && !s.data.therapistGender && ["male", "female"].includes(String(sl.therapist_gender.value))) { s.data.therapistGender = String(sl.therapist_gender.value); got.push("therapist_gender"); }
  return got;
}
// v195: the reading of this message, waiting at most waitMs for the read the
// shadow call already started. null when the reader is off or slow.
async function readingFor(from: string, text: string, waitMs: number): Promise<Reading2 | null> {
  const p = readings.get(`${from}|${text}`);
  if (!p) return null;
  const r = await Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), waitMs))]);
  return r && (r as any).reading ? (r as any).reading as Reading2 : null;
}
async function readerAssist(s: Session, from: string, L: string, text: string, own: string | null): Promise<string[]> {
  try {
    const cfg = await readerConfig();
    // Fake 3460000xxxx test numbers get assist while the rest is still in shadow.
    const testNum = /^3460000\d{4}$/.test(digitsOf(from)) && cfg.mode === "shadow";
    if (cfg.mode !== "assist" && cfg.mode !== "on" && !testNum) return [];
    const key = `${from}|${text}`;
    const r = await (readings.get(key) || readFor(s, from, text, cfg.model));
    const rd = r?.reading;
    if (!rd || rd.confidence < 0.6 || rd.intents.some((i) => READER_HANDS_OFF.includes(i))) return [];
    // A question is answered by its own path (the agent), which keeps details too.
    if (rd.question && rd.question !== "none") return [];
    const got = applyReading(s, rd, L, own);
    if (got.length) { await saveSession(s); await logEvent(from, "reader_assist", { step: s.step, got, text: text.slice(0, 200) }); }
    return got;
  } catch (e) { console.log("[wa] reader assist failed", String(e)); return []; }
}
// What we just understood, for "Got it, ...".
function understood(s: Session, L: string, got: string[]): string {
  const row = ALL_SERVICES.find((x) => x.id === s.data.service);
  const parts: string[] = [];
  if (got.includes("service") && row) parts.push(L === "es" ? String(row.tEs).toLowerCase() : String(row.tEn).toLowerCase());
  if (got.includes("day")) parts.push(String(s.data.dayDate || s.data.day));
  if (got.includes("time")) parts.push(String(s.data.time));
  if (got.includes("area")) parts.push(L === "es" ? `cerca de ${s.data.area}` : `near ${s.data.area}`);
  if (got.includes("therapist_gender")) parts.push(s.data.therapistGender === "male" ? (L === "es" ? "terapeuta hombre" : "male therapist") : (L === "es" ? "terapeuta mujer" : "female therapist"));
  return parts.join(", ");
}
// v176 (5 Oct 19:34, live: Fermin from the ad wrote "No sé quién eres" and
// "Dime quién eres" and got "Perdona, no te he entendido" twice).
const WHO_RE = /(qui[eé]n(es)? (eres|sois|es esto|me escribe)|no s[eé] (qui[eé]n|qu[eé] es|nada)|who (are you|is this|r u)|what is this|qu[eé] es esto|de qu[eé] va esto|no te conozco|don'?t know (you|who))/i;
// v179 (Jordan, 6 Oct: "go for it"). Six things the 5-6 Oct chats got wrong.
// "Home serves" (Vinzma29) slipped past HOME_VISIT_RE.
// v200 (11 Oct): "Te lo diré cuando lo tenga claro", "sin prisas", "I'll let
// you know": they have answered the day question for now.
const NOT_A_DAY_RE = /^(pl[sz]+|plea+s[ea]|pls|por\s+favor|porfa|send(\s+(me|it|them|the\s+(menu|list)))?|men[uú]|ok(ay)?|vale|yes+|yeah|yep|s[ií]+|claro|hi|hello|hola|thanks?|thank\s+you|gracias|\?+)[\s!.?]*$/i;
const LATER_RE = /(te\s+l[oi]\s+dir[eéií]a?|ya\s+te\s+(digo|dir[eé]|aviso|cuento)|te\s+(aviso|confirmo)\s+(luego|m[aá]s\s+tarde|ma[nñ]ana|cuando)|sin\s+prisas?|cuando\s+l[oi]\s+tenga\s+claro|todav[ií]a\s+no\s+(lo\s+)?s[eé]|a[uú]n\s+no\s+(lo\s+)?s[eé]|i'?ll\s+(let\s+you\s+know|tell\s+you|get\s+back)|let\s+you\s+know|no\s+rush|not\s+sure\s+yet|don'?t\s+know\s+yet)/i;
// v200 (11 Oct): Bernard asked "Vendrias a illescas?" and was told Illescas is
// outside Madrid, never that we do not travel at all.
const HOME_EXTRA_RE = /(\bhome\s*serv\w*|\bdomicilio\b|\ba\s+mi\s+casa\b|\b(to|at|in)\s+my\s+(home|house|hotel|flat|apartment|room)\b|\bhotel\s+massage\b|\b(vendr[ií]a[sn]|vendr[eé]is|ven[ií]s|pod[eé]is\s+venir|puedes\s+venir|(could|can|would|will|do)\s+you\s+come)\s+(a|al|hasta|to)\b(?!\s+las\b))/i;
// "couples means" / "deep tissue means" (Mehedi) were taken as a choice.
// v195: "El tailandés como sería?" and "I want to know the massages description"
// are questions about the massage, not a choice of it.
const THERAPISTQ_RE = /(who\s+(gives?|does|will\s+(give|do)|is)\s+(the\s+)?(massage|masseuse|masseur|therapist)|who\s+is\s+the\s+mass|qui[eé]n\s+(me\s+)?(da|hace|dar[aá]|har[aá])\s+el\s+masaje|qui[eé]n\s+es\s+(el|la)\s+masajista|qui[eé]n\s+me\s+toca)/i;
const MEANING_RE = /\b(means?|meaning|what\s+(is|are)|what'?s|qu[eé]\s+es|qu[eé]\s+significa|significa|explain|expl[ií]ca(me)?|c[oó]mo\s+(es|ser[ií]a|son|funciona)|how\s+is|what\s+.{0,20}\s+like|descripci[oó]n|description|describe)\b/i;
// "Ya no gracias" (Adrian) and a "No" tap (Vinzma29) were read as answers.
const NOTHANKS_RE = /^(no|nope|nah|ya no|no,? gracias|ya no,? gracias|no thanks?|no,? thank you|not now|ahora no|no me interesa|not interested|ya no hace falta|no hace falta|d[eé]jalo|olv[ií]dalo)[\s.!,]*(gracias|thanks|thank you|thx)?[\s.!]*$/i;
// v183: "¡Gracias!", "Si, si" and acks with any emoji (skin tones too) count.
const SOFT_ACK_RE = /^[\s¡]*(s[ií]+|s[ií],?\s*s[ií]|sisi+|yes|yes,? yes|yep|yeah|ok(ay)?|okey|vale|claro|perfecto|genial|bien|gracias|muchas gracias|thanks|thank you|thx|ok,? gracias|vale,? gracias|s[ií],? gracias)[\s.,!¡\p{Extended_Pictographic}\p{EMod}\u200d\ufe0f]*$/iu;
// v183 (review): a message that is only a gender word, said without being
// asked. Symmetric for "A girl" / "A man", tolerant of "por favor", commas and
// emoji. A bare "Hombre!" or "Man!" is an interjection, so those two only count
// with an article or a please ("a man", "hombre, por favor").
function bareGenderWord(t: string): "male" | "female" | null {
  const said = String(t || "").trim();
  const m = said.match(/^(?:a\s+|una?\s+)?(girl|woman|lady|chica|mujer|se[nñ]ora|female|femenin[oa]|boy|chico|male|masculin[oa]|man|hombre|guy)[\s,.!¡\p{Extended_Pictographic}\p{EMod}\u200d\ufe0f]*(?:please|pls|por\s*favor|porfa|gracias|thanks|thx|therapist|masajista)?[\s.!\p{Extended_Pictographic}\p{EMod}\u200d\ufe0f]*$/iu);
  if (!m) return null;
  const w = m[1].toLowerCase();
  if (/^(man|hombre|guy)$/.test(w) && !/^\s*(a|un)\s+|please|pls|por\s*favor|porfa|therapist|masajista/i.test(said)) return null;
  return /^(girl|woman|lady|chica|mujer|se[nñ]ora|female|femenin[oa])$/.test(w) ? "female" : "male";
}
const DECLINE_STEPS = ["start", "menu", "await_service", "await_day", "await_day_text", "await_time", "await_time_text", "await_hour", "await_area"];
// v179: detectArea (copy.ts) knows the big districts only. "Estoy en la zona
// de Lavapiés" found nothing, so Javier's area was never kept. These are the
// neighbourhoods and towns customers actually name (facts.md lists several).
const EXTRA_AREAS = ["Lavapiés", "Arganzuela", "Tetuán", "Moncloa", "Argüelles", "Usera", "Carabanchel", "Vallecas", "Moratalaz", "Ciudad Lineal", "Hortaleza", "Barajas", "Fuencarral", "Chueca", "Huertas", "Embajadores", "Delicias", "Legazpi", "Atocha", "Prosperidad", "Goya", "Arturo Soria", "Cuatro Caminos", "Pozuelo", "Majadahonda", "Alcobendas", "Las Rozas", "Getafe", "Leganés", "Alcorcón", "Móstoles", "Orcasitas", "Plaza Castilla", "Castellana", "Ópera", "Aravaca", "Boadilla", "San Sebastián de los Reyes", "Rivas", "Fuenlabrada", "Parla", "Torrejón", "Alcalá de Henares"];
function detectAreaPlus(t: string): string {
  const a = detectArea(t);
  if (a) return a;
  const low = stripAcc(String(t || "")).toLowerCase();
  return EXTRA_AREAS.find((x) => new RegExp(`\\b${stripAcc(x).toLowerCase()}\\b`).test(low)) || "";
}
const COMPLAINT_RE = /(refund|money back|reembolso|devoluci[oó]n|devu[eé]lv|me devolv|complain|complaint|queja|reclamaci[oó]n|reclamar|bad experience|mala experiencia|(was|were|it's|is) (terrible|awful|horrible|disgusting)|(fue|era|ha sido) (horrible|fatal|terrible|un desastre|asqueros)|\brude\b|maleducad|unprofessional|poco profesional|never again|nunca m[aá]s)/i;
const JORDAN_TEST_NUMS = ["34612474827", "15622355063"];
// v204: ctx.founderSaid is Jordan's own message from the reply page, which the
// customer's text answers (founderContextTurn). It rides in the payload, and
// when nothing passes the checks the drafts go to him as the reply to his
// message (ctx.pinged says one went, so the caller does not page him twice).
async function agentHandoff(s: Session, from: string, L: string, text: string, thread: Array<{ dir: string; body: string }>, booking: string, ctx: { founderSaid?: string; pinged?: boolean } = {}): Promise<boolean> {
  // v170 (Jordan, 5 Oct: "just do it only if you're confident"): Hermes answers
  // Jordan's own test numbers only, through HERMES_URL_STANDBY, until it has
  // proved itself. Customers keep AGENT_URL (unset) and so Qwen on OpenRouter.
  const url = JORDAN_TEST_NUMS.includes(digitsOf(from)) ? (await appSecret("HERMES_URL_STANDBY")) || (await appSecret("AGENT_URL")) : await appSecret("AGENT_URL");
  try {
    const payload: Record<string, unknown> = { phone: digitsOf(from), name: firstNameFromProfile(s.wa_name) || null, lang: L, text, step: s.step, booking, thread, facts_url: FACTS_URL };
    if (ctx.founderSaid) payload.context = `A person from the Massage Club team wrote the last message in this chat by hand: "${ctx.founderSaid.slice(0, 500)}". The customer's text answers that message, not the booking question before it. Answer it as that person would, using only the facts.`;
    let j: any = null;
    let via = url ? "agent_url" : "openrouter";
    if (url && /\/v1\/?$/.test(url)) {
      via = "hermes";
      j = await openRouterAgent(payload, { url, key: await appSecret("AGENT_KEY") }).catch((e) => { console.log("[wa] hermes failed", String(e)); return null; });
      if (!j) { via = "claude_fallback"; j = await claudeAgent(payload).catch(() => null); } // Hermes down or slow: Claude answers
    } else if (url) {
      const res = await fetch(url, {
        method: "POST", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await appSecret("AGENT_KEY")}` },
        body: JSON.stringify(payload),
      });
      j = await res.json().catch(() => ({}));
    } else {
      // v186 (8 Oct, Jordan: "we want to replace openrouter"): text answers come
      // from Claude, which already had the same facts and checks as the second
      // opinion. OpenRouter now only transcribes voice notes (Jordan's choice).
      via = "claude";
      j = await claudeAgent(payload).catch((e) => { console.log("[wa] claude agent failed", String(e)); return null; });
    }
    const draftOnly = (await appSecret("AGENT_MODE")) === "draft";
    // v204 (12 Oct, synth.md change 4): the dash rule is kept by swapping the
    // dash, not by throwing the answer away. At 15:34 on 11 Oct Hafeez asked
    // "What type massage?" and the agent wrote a good answer (relaxing for a
    // first massage, or deep tissue); agentReplyOk dropped all of it for one em
    // dash and he got "I do not have that detail to hand". 5 of the 9 answers
    // discarded in the last 14 days went for a dash alone. noDashes is what the
    // reply page already does to Jordan's own messages.
    const passes = async (x: any): Promise<string> => {
      const r = stripUnaskedLink(noDashes(dashRanges(String(x?.reply || "").trim(), L)), text);
      return r && x?.mode === "send" && agentReplyOk(r) && !(await namesAStudio(r)) ? r : "";
    };
    const first = String(j?.reply || "").trim();
    let sendNow = draftOnly ? "" : await passes(j);
    if (first) await logEvent(from, "agent_reply", { mode: j?.mode || null, sent: !!sendNow, chars: first.length, via, reply: first.slice(0, 300) });
    let second = "";
    if (!sendNow && !draftOnly && via !== "claude" && via !== "claude_fallback") {
      const c = await claudeAgent(payload).catch((e) => { console.log("[wa] claude agent failed", String(e)); return null; });
      second = String(c?.reply || "").trim();
      if (second) {
        sendNow = await passes(c);
        await logEvent(from, "agent_reply", { mode: c?.mode || null, sent: !!sendNow, chars: second.length, via: "claude_second", reply: second.slice(0, 300) });
      }
    }
    if (sendNow) { await sendText(from, sendNow); return true; }
    // Template text cannot hold line breaks and is cut near 180 characters
    // once the reply link is on, so Claude's draft (usually the better one)
    // leads; both are in the agent_reply events and the reply page.
    const drafts = [second && `Claude: ${second}`, first && `${via}: ${first}`].filter(Boolean);
    if (drafts.length) {
      await notifyJordanWa(`${ctx.founderSaid ? `They answered your message with "${text.slice(0, 60)}" and the bot stayed quiet. ` : ""}Not sent to +${digitsOf(from)}. ${drafts.join(" | ")}`.replace(/\s+/g, " "), from).catch(() => {});
      ctx.pinged = true;
    }
    return false;
  } catch (e) {
    console.log("[wa] agent handoff failed", String(e));
    return false;
  }
}

async function lastResort(s: Session, from: string, L: string, text: string): Promise<boolean> {
  if (!text) return false;
  if (!(await aiKey())) {
    const [thread0, st0] = await Promise.all([recentThread(from), bookingState(from)]);
    return await agentHandoff(s, from, L, text, thread0, st0.line);
  }
  try {
    const [thread, st] = await Promise.all([recentThread(from), bookingState(from)]);
    if (await agentHandoff(s, from, L, text, thread, st.line)) {
      // v179: the agent answered, but whatever they told us (area, day, time,
      // massage) is still booking information. Keep it, except the slot the
      // current question owns, which its own branch handles.
      const own = /await_service/.test(s.step) ? "service" : /await_day/.test(s.step) ? "day" : /await_(time|hour)/.test(s.step) ? "time" : /await_area/.test(s.step) ? "area" : null;
      const got = own ? absorbOffStep(s, text, L, own) : (absorbSentence(s, text, L) ? ["some"] : []);
      if (got.length) { await saveSession(s); await logEvent(from, "agent_turn_absorbed", { got, step: s.step }); }
      return true;
    }
    const r = await interpret(text, thread, st.line);
    if (!r) return false;
    return await actOnReading(r, s, from, L, st.req, text);
  } catch (e) {
    console.log("[wa] lastResort failed", String(e));
    return false;
  }
}

// v204 (12 Oct, synth.md change 4): the customer's first reply after Jordan
// wrote to them from the reply page. It answers him, so the step parser never
// gets it: Hafeez's "Plzz" on 11 Oct was a yes to Jordan's menu, and the day
// step saved it as his day.
//  1. A yes to a menu, list or the types he offered gets the massage list.
//  2. While a booking is being made, details the reader can quote (a day, a
//     time, an area) are kept and the flow goes on from them.
//  3. Anything else goes to the agent, with his message as the context.
//  4. When none of that is sure, the bot says nothing and Jordan is pinged:
//     he is in this conversation, and a wrong guess from the bot talks over
//     him (+34 680 995 062).
const FOUNDER_FLOW_STEPS = ["await_service", "await_day", "await_day_text", "await_time", "await_hour", "await_time_text", "await_area", "await_sameday", "await_studio"];
async function founderContextTurn(s: Session, from: string, L: string, text: string, said: string): Promise<void> {
  if (founderMenuYes(said, text)) {
    const list = String(COPY[L].servicesAnswer).split("\n\n").slice(0, -1).join("\n\n");
    await sendText(from, list + "\n\n" + (L === "es" ? "Dime cuál te apetece y qué día." : "Tell me which one you'd like, and which day."));
    await logEvent(from, "founder_context", { did: "menu", said: text.slice(0, 60) });
    return;
  }
  const rd = await readingFor(from, text, 6000);
  const handsOff = !!rd && rd.intents.some((i) => READER_HANDS_OFF.includes(i));
  if (rd && !handsOff && FOUNDER_FLOW_STEPS.includes(s.step) && rd.confidence >= 0.7 && (!rd.question || rd.question === "none")) {
    const got = applyReading(s, rd, L, null);
    if (got.length) {
      await saveSession(s);
      await logEvent(from, "founder_context", { did: "reader", got, said: text.slice(0, 60) });
      await sendText(from, COPY[L].gotItSvc(understood(s, L, got)));
      await nextStep(s, from, L);
      return;
    }
  }
  const ctx: { founderSaid: string; pinged?: boolean } = { founderSaid: said };
  if (!handsOff) {
    const [thread, st] = await Promise.all([recentThread(from), bookingState(from)]);
    if (await agentHandoff(s, from, L, text, thread, st.line, ctx)) {
      await logEvent(from, "founder_context", { did: "agent", said: text.slice(0, 60) });
      return;
    }
  }
  quietThisTurn = true;
  await logEvent(from, "founder_context", { did: "quiet", hands_off: handsOff, said: text.slice(0, 60) });
  if (!ctx.pinged) await notifyJordanWa(`${s.wa_name || "+" + digitsOf(from)} answered your message ("${said.slice(0, 50)}") with: ${text.slice(0, 100)}. The bot did not reply; over to you.`, from);
}

// ---- v63: reaching a customer when WhatsApp cannot ----
// WhatsApp only carries free text within 24 hours of the customer's last
// message. Deyanira Ramirez arrived through the website and never wrote to the
// bot at all, so six messages about a slot Sinergia38 was really holding for
// her bounced with 131047 while her email address sat in the same row.
const CUSTOMER_WINDOW_MS = 23.5 * 3600e3;
async function waWindowOpen(phone: unknown): Promise<boolean> {
  const p = digitsOf(String(phone || ""));
  if (!p) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${p}&direction=eq.in&order=created_at.desc&limit=1&select=created_at`, { headers: H() });
  const rows = await r.json().catch(() => []);
  const last = Array.isArray(rows) && rows[0]?.created_at ? Date.parse(String(rows[0].created_at)) : 0;
  return last > 0 && Date.now() - last < CUSTOMER_WINDOW_MS;
}
async function emailCustomer(req: any, subject: string, body: string): Promise<boolean> {
  const to = String(req?.contact_email || "").trim();
  if (heldMail(to) || heldNum(req?.client_phone)) { console.log("[wa] held customer, email not sent:", subject); return false; }
  if (!to || !RESEND_API_KEY) return false;
  const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;"><tr><td style="padding:26px 34px 0;text-align:center;"><img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;"><p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p></td></tr><tr><td style="padding:22px 34px 8px;"><p style="margin:0;color:${C.ink};font-size:15px;line-height:1.65;white-space:pre-wrap;">${esc(body)}</p></td></tr><tr><td style="padding:8px 34px 26px;"><div style="border-top:2px dashed ${C.dash};margin-bottom:12px;"></div><p style="margin:0;color:#B8AC9E;font-size:11.5px;text-align:center;">Massage Club · Madrid · book.massageclub.io</p></td></tr></table></td></tr></table>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], reply_to: "support@massageclub.io", subject, html, text: body }),
  }).catch(() => null);
  const ok = !!res && res.ok;
  if (!ok) console.log("[wa] customer email failed", to);
  return ok;
}
// Say something to a customer on whichever channel can actually carry it, and
// report which one did. "none" means they were not told, which is a fact the
// caller has to act on rather than ignore.
async function reachCustomer(req: any, text: string, subject: string): Promise<"whatsapp" | "email" | "none"> {
  const phone = digitsOf(String(req?.client_phone || ""));
  if (phone && await waWindowOpen(phone) && await sendText(phone, text)) return "whatsapp";
  if (await emailCustomer(req, subject, text)) return "email";
  // No window on record and no email: the send may still work, so try it.
  if (phone && await sendText(phone, text)) return "whatsapp";
  return "none";
}
// An exact clock time. A band ("mañana (10-13)") or "Flexible" is not something
// a studio can be told is booked.
const EXACT_TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

// One studio takes the booking: the request is claimed, the others stood down,
// the studio gets the card, the customer the address (and the discount, if any).
async function awardWinner(req: any, partner: { id: string; business_name: string } | null, from: string, discountPct: number | null): Promise<boolean> {
  const requestId = Number(req.id);
  const L = req.languages === "es" ? "es" : "en";
  const when = [req.day1, req.time1].filter(Boolean).join(" ");
  // v63: two things must be true before a studio hears the word confirmed.
  // There has to be an exact time, and the customer has to be reachable on some
  // channel. Deyanira's request said "jueves, 10 sept, mañana (10-13)" with no
  // time at all, and Sinergia38 was sent "Reserva confirmada" for her while she
  // had never written us a single word. A confirmation the customer never
  // receives is not a booking, it is a no-show waiting to happen.
  const t = exactTime(req) || (EXACT_TIME_RE.test(String(req.confirmed_time || "").trim()) ? String(req.confirmed_time).trim() : "");
  const hasTime = !!t;
  const reachable = !!String(req.contact_email || "").trim() || await waWindowOpen(req.client_phone);
  if (!hasTime || !reachable) {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&stage=neq.confirmed`, {
      method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({
        stage: "studio_replied",
        studio_reply: `${partner ? partner.business_name : from}: disponible, sin confirmar (${hasTime ? "cliente ilocalizable" : "sin hora exacta"})`,
        stage_updated_at: new Date().toISOString(),
      }),
    });
    // v212: the client by name and the day in Spanish, never "la reserva".
    const holdWho = req.first_name || "el cliente";
    const holdDay = studioDayEs(req);
    await sendText(from, hasTime
      ? `Gracias. Antes de cerrarlo tengo que hablar con ${holdWho}, así que todavía no está reservado. En cuanto me diga algo, os aviso.`
      : `Gracias. ${req.first_name || "El cliente"} todavía no ha elegido hora, así que aún no está reservado. ¿Qué hora os vendría bien${holdDay ? " " + holdDay : ""}? Se la propongo.`);
    await founderCard(`⚠️ Not confirmed: ${hasTime ? "customer unreachable" : "no exact time"} · #${requestId}`, {
      badge: "HELD",
      title: `${partner ? partner.business_name : "The studio"} said yes, but this is not a booking`,
      paras: [
        hasTime
          ? `${req.first_name || "The customer"} cannot be reached on WhatsApp and we have no email for them, so they cannot be told. The studio was asked to hold off.`
          : `${req.first_name || "The customer"} never gave an exact time (${String(req.time1 || "none")}), so there is nothing to confirm. The studio was asked which time suits them.`,
        `Nothing was promised to the studio. Request #${requestId} is waiting.`,
      ],
      waNum: from,
    });
    return false;
  }
  // v199 (Jordan, 10 Oct: "make sure both parties confirm ... via a tap of the
  // button"). A studio's yes is an offer, never a booking. On 9 Oct The Nook
  // tapped a time in its email and request #110 was marked confirmed while
  // William had not said a word, and Calma has had a therapist and a room ready
  // for customers who never confirmed. Every path that used to confirm here (a
  // studio's button on a same-day request, a written 10% discount, the bidding
  // window closing) now puts the studio's time in front of the customer with Yes
  // and No buttons. The booking confirms only in acceptOffer, on the customer's
  // own tap, and only then does the studio get the confirmation in writing.
  if (!partner) {
    await founderCard(`⚠️ A yes for #${requestId} from a number we could not match`, {
      badge: "HELD", title: "A studio said yes but we could not tell which one",
      paras: [`${from} answered yes to ${req.first_name || "the customer"}'s request. Nothing was sent to the customer and nothing is confirmed.`],
      waNum: from,
    });
    return false;
  }
  let drow = await dispatchRowFor(requestId, partner.id, from);
  if (!drow) {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?on_conflict=request_id,partner_id`, {
      method: "POST", headers: { ...H(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ request_id: requestId, partner_id: partner.id, phone: digitsOf(from), outcome: "pending" }),
    });
    drow = (await ins.json().catch(() => []))[0] || null;
  }
  if (!drow) { console.log("[studio] no dispatch row to carry the offer", requestId, partner.business_name); return false; }
  if (drow.outcome === "won") return false;
  const now = new Date().toISOString();
  await patchDispatch(drow.id, { outcome: "accepted", accepted_at: drow.accepted_at || now, replied_at: now, ...(discountPct ? { discount_pct: discountPct } : {}) });
  await forwardOffer(req, partner, String(drow.id), t, `Sí, a las ${t}`, from);
  await logEvent(req.client_phone || from, "studio_accepted", { id: requestId, studio: partner.business_name, time: t, discount: discountPct, via: "award" });
  return false;
}
// Cron calls this every 5 minutes: every bidding window that has closed goes to
// the best accepted offer (highest discount, then earliest yes).
// v83 (Jordan, 12 Sept): ask for the review straight after the massage, not the
// next morning, and send them to Massage Club's own review page rather than
// Google, because that is an asset we keep and it feeds the studio pages.
//
// Fifteen minutes after the end, so they have dressed, paid and picked the phone
// back up. Never before the massage has finished, which is the mistake
// whatsapp-followup made on 11 September when it asked Fernando how his massage
// went six hours before it happened; this reads end_at, not created_at.
//
// Only within the 24 hour window, because a template would be needed otherwise
// and none is approved for this. Test bookings are skipped. One ask per booking,
// recorded in review_requested_at.
async function askForReviews(): Promise<number> {
  const now = Date.now();
  const from = new Date(now - 6 * 3600e3).toISOString();
  const to = new Date(now - 15 * 60e3).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/bookings?status=eq.confirmed&is_test=is.false&review_requested_at=is.null&end_at=gte.${from}&end_at=lte.${to}&select=id,action_token,spa_name,client_phone,lang&limit=20`;
  const rows = await (await fetch(url, { headers: H() })).json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return 0;
  let sent = 0;
  for (const b of rows) {
    const phone = digitsOf(b.client_phone || "");
    // Mark it asked before sending, so a failure cannot turn into a loop that
    // messages the same person on every sweep.
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${b.id}`, {
      method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ review_requested_at: new Date().toISOString() }),
    });
    if (!phone || !(await canFreeform(phone))) { console.log("[review] window shut, skipping booking", b.id); continue; }
    const L = b.lang === "es" ? "es" : "en";
    await sendText(phone, COPY[L].reviewAsk(String(b.spa_name || ""), `${APP}/review?token=${b.action_token}`));
    await logEvent(phone, "review_asked", { booking: b.id, studio: b.spa_name });
    sent++;
  }
  return sent;
}

// v124 (25 Sept): the day-before reminder, riding the same five minute sweep as
// the bid settlement so there is no new cron to schedule and none to forget.
//
// The diary is funnel_events, not a new column: a confirm_later event carries
// the request, the offer row and the minute it should fire, and a matching
// confirm_later_reminded event is what stops it firing twice. One reminder per
// request, ever, and only while the request is still waiting on the customer.
//
// Dormant until the loader passes confirmLaterReminders. See the note on
// CONFIRM_LATER_REMINDERS.
async function remindConfirmLater(): Promise<number> {
  if (!CONFIRM_LATER_REMINDERS) return 0;
  const now = Date.now();
  const since = new Date(now - 30 * 86400e3).toISOString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?event=in.(confirm_later,confirm_later_reminded)&created_at=gte.${since}&order=created_at.asc&limit=500&select=phone,event,meta`, { headers: H() });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return 0;
  const done = new Set<string>(rows.filter((x: any) => x?.event === "confirm_later_reminded").map((x: any) => String(x?.meta?.request_id || "")));
  let sent = 0;
  for (const ev of rows) {
    if (ev?.event !== "confirm_later") continue;
    const m = (ev.meta || {}) as Record<string, any>;
    const reqId = String(m.request_id || "");
    const at = Date.parse(String(m.remind_at || ""));
    if (!reqId || done.has(reqId) || !at || at > now) continue;
    done.add(reqId);
    const phone = digitsOf(String(ev.phone || ""));
    if (!phone || TEST_PHONES.includes(phone)) continue;
    const qr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${reqId}&select=id,first_name,stage,day1,message_text,languages`, { headers: H() });
    const req = (await qr.json().catch(() => []))[0] || null;
    // Only a request still waiting on this customer gets a nudge. Confirmed,
    // cancelled and dismissed ones are closed and must never be reopened.
    if (!req || !["offered", "studio_replied", "studio_asked", "bidding"].includes(String(req.stage || ""))) continue;
    // Marked before sending, so a failure cannot become a loop that messages
    // the same person on every sweep.
    const open = await canFreeform(phone);
    await logEvent(phone, "confirm_later_reminded", { request_id: reqId, row: m.row || null, window_open: open });
    if (!open) {
      console.log(`[wa] confirm-later window shut for ${phone}, request ${reqId}`);
      await founderCard(`🗓 Cannot remind ${req.first_name || "+" + phone} · #${reqId}`, {
        badge: "WINDOW SHUT",
        title: `${req.first_name || "The customer"} asked to be reminded the day before and WhatsApp will not carry it`,
        paras: [`They have not written for over 24 hours, so free text does not reach them and no template is approved for this. ${m.studio || "The studio"} at ${m.time || "?"} is still open on the board. Their number is below.`],
        waNum: phone, to: JORDAN,
      });
      continue;
    }
    const L = String(m.lang || "") === "es" || req.languages === "es" ? "es" : "en";
    const day = dayLabelFor(req.day1, req.message_text, L) || String(m.day || "");
    const row = String(m.row || "");
    const studio = String(m.studio || (L === "es" ? "el centro" : "the studio"));
    const body = COPY[L].confirmLaterNudge(String(req.first_name || ""), studio, String(m.time || ""), day);
    if (row) {
      await sendButtons(phone, body, offerButtons(L, row, String(m.time || "")));
      const cs = await getSession(phone);
      cs.data.prevStep = cs.step;
      cs.step = "await_offer";
      cs.data.offer = { row, time: m.time || "", studio, request: Number(reqId), day: m.day || null };
      await saveSession(cs);
    } else {
      await sendText(phone, body);
    }
    sent++;
  }
  return sent;
}

async function settleBids(): Promise<number> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?stage=eq.bidding&settle_after=lte.${new Date().toISOString()}&order=settle_after.asc&limit=10&select=id,first_name,service_name,studio_name,partner_id,day1,time1,proposed_time,confirmed_time,languages,client_phone,stage,contact_email,settle_after,message_text,created_at`, { headers: H() });
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
    // v199: the window closing forwards the best offer to the customer; it no
    // longer books it. Leave "bidding" first so this sweep never sends it twice.
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&stage=eq.bidding`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "studio_replied", settle_after: null, stage_updated_at: new Date().toISOString() }) });
    await awardWinner(req, partner, digitsOf(best.phone || ""), best.discount_pct ?? null);
    n++;
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

// v212 (16 Oct): studioConfirmCard (v41) is gone. Nothing called it, and its
// text had an emoji, "sin comisión" (studios are invoiced a commission), the
// client's language, another studio's name and the old signature. The studio's
// confirmation is the one acceptOffer sends after the customer's own tap.

// ---- v204 offer step: pure helpers (start) ----
// v204 (12 Oct): eleven customers since 14 Sept were given a real time by a
// real studio and not one tapped Yes (offers_audit, 12 Oct). Every offer had two
// to four things wrong at once: the price missing or after the question, 85 EUR
// when the opener had said 50 to 60, a studio across Madrid, a time outside the
// window they asked for or minutes away, and nobody came back when they went
// quiet. These helpers make those calls without any I/O, and tests/replay.mjs
// lifts this block out of the file to check them, so keep fetches, sends and
// anything defined further down out of it.
//
// No offer for a slot under 45 minutes away, and an unanswered one lapses then.
const OFFER_LEAD_MS = 45 * 60e3;
// Same day: how long an out-of-window time waits for one inside the window.
const OFFER_HOLD_MS = 15 * 60e3;
// Nobody is given less than this to decide before an offer lapses.
const OFFER_DECIDE_MS = 15 * 60e3;
// Further than this and the offer says how far the studio is from them.
const OFFER_FAR_KM = 4;
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const MADRID_HM = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false });
const madridMinAt = (ms: number) => { const [h, m] = MADRID_HM.format(new Date(ms)).split(":").map((x) => parseInt(x, 10)); return (h % 24) * 60 + m; };
const madridHourAt = (ms: number) => Math.floor(madridMinAt(ms) / 60);

// The window the customer asked for, in minutes after midnight with the end
// left out, or null when there is none to hold a studio to (Flexible, blank).
// askBand (copy.ts) reads the bands. This adds an exact hour and "as soon as
// possible from 12:00", which askBand reads as no window at all, so every offer
// Alvaro (#81) got on 19 Sept said "instead of".
// v204 review (12 Oct): a typed time is a window too. await_time, await_hour
// and await_time_text keep what the customer typed ("2pm", "18h", "19h30",
// "after 7pm", "a partir de las 19", "18:00-20:00"), and the first cut read all
// of that as Flexible, so any hour a studio named went out as a match: #98
// asked for "Tomorrow 2pm", and a studio's "mañana a las 11" would have reached
// him as a plain offer with no "Nobody has 14:00 yet". "18:00-20:00" went
// through askBand as 00:00 to 20:00. Only a blank or a real "any time" is
// Flexible now. Anything else that cannot be read is ASK_UNREAD, which no time
// fits, so a same-day time is held and another day's withheld, the way
// offerMatchesAsk treated it. messageText is the request's message_text:
// createRequest stores "Earliest available (from 12:00)" as time1 "12:00"
// (v159), and only its "Cuando:" part still says "from 12:00", not "at 12:00".
const ASK_UNREAD: [number, number] = [-1, -1];
const askUnread = (w: [number, number] | null) => !!w && w[1] < 0;
const FLEX_ASK_RE = /^(flexible|any\s*time|any\s+hour|whenever|no\s+preference|cualquier\s+hora|a\s+cualquier\s+hora|me\s+da\s+igual|da\s+igual|indiferente|cuando\s+sea|lo\s+que\s+sea)[\s.!]*$/i;
const EARLIEST_ASK_RE = /lo antes posible|cuanto antes|\basap\b|as soon as|earliest/i;
// A typed hour on the 24 hour clock. "pm" and "de la tarde" add 12, and so does
// a bare 1 to 7 ("a las 7", "2-4"): nobody books a massage for 3 in the morning
// and the studios open at 9 or 10. "07:00" written with its zero stays morning.
function askHour24(h: number, mer: string, s: string, lead0: boolean): number {
  if (mer === "am") return h % 12;
  if (mer === "pm") return h < 12 ? h + 12 : h;
  if (h === 0 || h >= 12 || lead0 || /\b(de la manana|por la manana|in the morning|morning)\b/.test(s)) return h;
  return h <= 7 || /\b(tarde|noche|evening|night|tonight|afternoon)\b/.test(s) ? h + 12 : h;
}
function askWindow(time1: unknown, messageText?: unknown): [number, number] | null {
  const t = String(time1 || "").trim();
  if (!t || FLEX_ASK_RE.test(t)) return null;
  const cuando = String(messageText || "").match(/Cuando:\s*([^|]*)/i)?.[1] || "";
  const earliest = EARLIEST_ASK_RE.test(t) ? t : (/^12[:.]00$/.test(t) && EARLIEST_ASK_RE.test(cuando) ? cuando : "");
  if (earliest) {
    const f = earliest.match(/(?:desde|from|a partir de)\s*(?:las\s*)?([01]?\d|2[0-3])(?:[:.]([0-5]\d))?/i);
    return [f ? Number(f[1]) * 60 + Number(f[2] || 0) : 0, 24 * 60];
  }
  const s = stripAcc(t).toLowerCase();
  // A range: "18:00-20:00", "18-21", "de 6 a 8 de la tarde", "6 to 8pm".
  const r = s.match(/\b(2[0-3]|[01]?\d)(?!\d)(?:[:.h]([0-5]\d))?\s*(am|pm)?\s*(?:h\b|hrs?\b)?\s*(?:-|\u2013|\u2014|\bto\b|\ba\b|\by\b|\band\b|\bhasta\b|\buntil\b|\btill\b)\s*(?:las?\s+)?(2[0-3]|[01]?\d)(?!\d)(?:[:.h]([0-5]\d))?\s*(am|pm)?/);
  if (r) {
    let a = askHour24(Number(r[1]), r[3] || "", s, /^0/.test(r[1]));
    let b = askHour24(Number(r[4]), r[6] || "", s, /^0/.test(r[4]));
    if (!r[3] && r[6] === "pm" && a < 12 && a + 12 <= b) a += 12;
    if (b <= a && b < 12) b += 12;
    if (b > a) return [a * 60 + Number(r[2] || 0), b * 60 + Number(r[5] || 0)];
  }
  // One hour, with "after" or "before" around it. "19h30" and "7:30pm" are read
  // here; the rest ("2pm", "18h", "a las 7") the way the time step reads them
  // (detectTime, copy.ts), with am or pm read off the text.
  const hm = s.match(/\b(2[0-3]|[01]?\d)[:.h]([0-5]\d)\s*(am|pm)?(?!\d)/);
  const dt = detectTime(t, "en");
  const one = hm ? null : dt.match(/^(\d{2}):(\d{2})$/);
  if (hm || one) {
    const mer = hm ? (hm[3] || "") : (s.match(/\b(?:2[0-3]|[01]?\d)\s*(am|pm)\b/)?.[1] || "");
    const m = askHour24(Number(hm ? hm[1] : one![1]), mer, s, hm ? /^0/.test(hm[1]) : /\b0\d\b/.test(s)) * 60 + Number(hm ? hm[2] : one![2]);
    if (/\b(after|from|later than|desde|a partir de|despues de|mas tarde de)\b/.test(s)) return [m, 24 * 60];
    if (/\b(before|until|till|no later than|antes de|hasta)\b/.test(s)) return [0, m];
    if (/\b(around|about|approx\w*|ish|sobre|hacia|aprox\w*|mas o menos)\b/.test(s)) return [m - 30, m + 31];
    return [m, m + 1];
  }
  // A band in words ("evening", "por la tarde", "after work"): detectTime turns
  // it into the band's own label, "Evening (18-21)".
  const band = askBand(/\(\d{1,2}-\d{1,2}\)/.test(dt) ? dt : t);
  return band ? [band[0] * 60, band[1] * 60] : ASK_UNREAD;
}
const offerDayWord = (d: unknown) => { const t = stripAcc(String(d || "")).trim().toLowerCase(); return t === "hoy" ? "today" : t === "manana" ? "tomorrow" : t; };
// The Madrid date an offer is for: the studio's own "hoy" or "mañana" first,
// then the day handed in with it (an emailed tap), then the day asked for.
function offerDayDate(offerDay: string, dayHint: string, day1: unknown, messageText: unknown, now: Date): Date | null {
  const w = offerDayWord(offerDay);
  const today = madridMidnight(now);
  if (w === "today") return today;
  if (w === "tomorrow") return new Date(today.getTime() + 86400e3);
  return (dayHint ? resolveRequestDate(dayHint, "", now) : null) || resolveRequestDate(day1, messageText, now);
}
// The same day as the one asked for. Dates, not words: "Hoy" from a studio and
// "Today" from an English customer are one day, which offerMatchesAsk missed.
// v204 review: dayHint is the day the offer came with when the studio's own
// words are not used (a queued offer, a phone call), and is checked the same way.
function offerFitsDay(offerDay: string, day1: unknown, messageText: unknown, now: Date, dayHint = ""): boolean {
  if (!offerDay && !dayHint) return true;
  const a = offerDayDate(offerDay, dayHint, null, null, now);
  const b = resolveRequestDate(day1, messageText, now);
  if (a && b) return a.getTime() === b.getTime();
  return offerDay ? offerDayWord(offerDay) === offerDayWord(day1) : true;
}
// Inside the hours asked for. No window ("Flexible") means any hour is a yes;
// a window that could not be read (ASK_UNREAD) means no hour is.
function offerFitsTime(time: string, time1: unknown, messageText?: unknown): boolean {
  const m = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const w = askWindow(time1, messageText);
  if (!w) return true;
  const at = Number(m[1]) * 60 + Number(m[2]);
  return at >= w[0] && at < w[1];
}
// v204 review (12 Oct): the day a studio's own "hoy" or "mañana" meant, read
// from when it wrote it, not from now. A time queued on Monday ("mañana a las
// 16:00", for Tuesday) and shown on Tuesday after "Another time" was read
// against Tuesday: shown as Wednesday, lapsed a day late, and a Yes would have
// confirmed Wednesday to the studio.
function studioWordDay(offerDay: string, wroteMs: number): Date | null {
  const w = offerDayWord(offerDay);
  if ((w !== "today" && w !== "tomorrow") || !Number.isFinite(wroteMs)) return null;
  return new Date(madridMidnight(new Date(wroteMs)).getTime() + (w === "tomorrow" ? 86400e3 : 0));
}
// A Madrid date as an offer names it, seen from now: "Today", "Tomorrow", or
// the full date ("Tuesday 13 October", "martes 13 de octubre"), which
// resolveRequestDate reads back as the same day.
const OFFER_DATE_FMT: Record<string, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }),
  es: new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }),
};
function offerDayLabel(day: Date, now: Date, L: string): string {
  const n = Math.round((day.getTime() - madridMidnight(now).getTime()) / 86400e3);
  const es = L === "es";
  if (n === 0) return es ? "Hoy" : "Today";
  if (n === 1) return es ? "Mañana" : "Tomorrow";
  return OFFER_DATE_FMT[es ? "es" : "en"].format(day).replace(",", "");
}
// How many minutes an offered time sits outside the window; 0 inside it, and 0
// for a window nobody could read, where every time is as far as any other.
function offerMissBy(time: string, w: [number, number] | null): number {
  const m = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 24 * 60;
  if (!w || askUnread(w)) return 0;
  const at = Number(m[1]) * 60 + Number(m[2]);
  return at < w[0] ? w[0] - at : at >= w[1] ? at - w[1] + 1 : 0;
}
// When the slot starts, as epoch ms, or null when the day cannot be worked out.
function offerSlotAt(time: string, day: Date | null): number | null {
  const m = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m || !day) return null;
  return madridInstant(day, Number(m[1])).getTime() + Number(m[2]) * 60e3;
}
// When an unanswered offer is followed up, and when it lapses.
//  Same day (sent on the slot's own date): 15 minutes after it went out, or 75
//  minutes before the slot if that is sooner.
//  Another day: two hours after it went out; if that lands between 21:00 and
//  09:00 Madrid, 10:00 instead, and never later than 75 minutes before the slot.
//  Never sooner than five minutes after the offer itself.
//  It lapses 45 minutes before the slot, or 15 minutes after it went out if
//  that is later: Javier (#96) was sent Calma's 19:00 at 18:11, and an offer
//  withdrawn four minutes after it arrives is not an offer.
function offerSchedule(sentMs: number, slotMs: number | null): { chaseAt: number; lapseAt: number | null } {
  const sameDay = slotMs !== null && madridMidnight(new Date(sentMs)).getTime() === madridMidnight(new Date(slotMs)).getTime();
  let chaseAt: number;
  if (sameDay) chaseAt = Math.min(sentMs + 15 * 60e3, (slotMs as number) - 75 * 60e3);
  else {
    chaseAt = sentMs + 2 * 3600e3;
    const h = madridHourAt(chaseAt);
    const day = madridMidnight(new Date(chaseAt));
    if (h >= 21) chaseAt = madridInstant(new Date(day.getTime() + 86400e3), 10).getTime();
    else if (h < 9) chaseAt = madridInstant(day, 10).getTime();
    if (slotMs !== null) chaseAt = Math.min(chaseAt, slotMs - 75 * 60e3);
  }
  return { chaseAt: Math.max(chaseAt, sentMs + 5 * 60e3), lapseAt: slotMs !== null ? Math.max(slotMs - OFFER_LEAD_MS, sentMs + OFFER_DECIDE_MS) : null };
}
// What the sweep does about one unanswered offer now. A reminder that would
// land within five minutes of the lapse is left out: the lapse says it. No
// reminder between 22:00 and 08:00 Madrid; it waits for the morning.
function offerDue(nowMs: number, sch: { chaseAt: number; lapseAt: number | null }): "lapse" | "chase" | "wait" {
  if (sch.lapseAt !== null && nowMs >= sch.lapseAt) return "lapse";
  if (nowMs < sch.chaseAt) return "wait";
  if (sch.lapseAt !== null && sch.chaseAt > sch.lapseAt - 5 * 60e3) return "wait";
  const h = madridHourAt(nowMs);
  return h >= 8 && h < 22 ? "chase" : "wait";
}
// "today" / "tomorrow" for a slot, seen from now; "" for any other day.
function offerRelDay(slotMs: number, nowMs: number, L: string): string {
  const d = Math.round((madridMidnight(new Date(slotMs)).getTime() - madridMidnight(new Date(nowMs)).getTime()) / 86400e3);
  return d === 0 ? (L === "es" ? "hoy" : "today") : d === 1 ? (L === "es" ? "mañana" : "tomorrow") : "";
}
// The day as it sits after a time: "17:00 today", "17:00 on Tuesday 14 October".
// v205 (canary, 12 Oct): "Booked! ... for *Hoy 18:00*" reached an English
// customer because the studio wrote "Hoy". The customer's copy of the time.
function whenFor(when: string, L: string): string {
  const es = L === "es";
  return String(when || "")
    .replace(/^(hoy|today)\b/i, es ? "Hoy" : "Today")
    .replace(/^(ma[nñ]ana|tomorrow)\b/i, es ? "Mañana" : "Tomorrow");
}
function offerDayPhrase(day: string, L: string): string {
  const d = String(day || "").trim();
  if (!d) return "";
  // v205 (canary, 12 Oct): a studio's "Hoy" reached an English customer as
  // "can take you at 18:00 hoy". Relative words go out in the customer's language.
  if (/^(today|hoy)$/i.test(d)) return L === "es" ? "hoy" : "today";
  if (/^(tomorrow|ma[nñ]ana)$/i.test(d)) return L === "es" ? "mañana" : "tomorrow";
  if (/^(that day|ese d[ií]a)$/i.test(d)) return L === "es" ? "ese día" : "that day";
  return L === "es" ? `el ${d.charAt(0).toLowerCase()}${d.slice(1)}` : `on ${d}`;
}
// The window in words, for the customer: "18:00 to 21:00" / "hueco de 18:00 a 21:00".
// v204 review: a window nobody could read is "the time you asked for", and an
// "around 18:00" window (17:30 up to and including 18:30) ends at 18:30 in words.
const windowEnd = (w: [number, number]) => (w[1] - w[0]) % 5 === 1 ? w[1] - 1 : w[1];
function windowText(w: [number, number] | null, L: string): string {
  if (!w) return "";
  const es = L === "es";
  if (askUnread(w)) return es ? "hueco a la hora que pediste" : "the time you asked for";
  if (w[1] - w[0] === 1) return es ? `hueco a las ${hhmm(w[0])}` : hhmm(w[0]);
  if (w[1] >= 24 * 60) return es ? `hueco a partir de las ${hhmm(w[0])}` : `anything from ${hhmm(w[0])}`;
  return es ? `hueco de ${hhmm(w[0])} a ${hhmm(windowEnd(w))}` : `${hhmm(w[0])} to ${hhmm(windowEnd(w))}`;
}
// The same window for a studio, in Spanish: "entre las 18:00 y las 21:00". ""
// for one nobody could read, so the caller quotes the customer's own words.
function windowEs(w: [number, number] | null): string {
  if (!w || askUnread(w)) return "";
  if (w[1] - w[0] === 1) return `a las ${hhmm(w[0])}`;
  if (w[1] >= 24 * 60) return `a partir de las ${hhmm(w[0])}`;
  return `entre las ${hhmm(w[0])} y las ${hhmm(windowEnd(w))}`;
}
// The price range one of our messages gave the customer: the opener's "usually
// 50 to 60 EUR", the price answer's "entre 50 y 85 EUR", or a lone "about 55 EUR".
function quotedRangeIn(body: string): { lo: number; hi: number } | null {
  const t = String(body || "");
  const r = t.match(/(\d{2,3})\s*(?:to|y|a|-)\s*(\d{2,3})\s*(?:EUR|€)/i);
  if (r) { const lo = Number(r[1]), hi = Number(r[2]); return lo <= hi ? { lo, hi } : null; }
  const one = t.match(/(?:usually|suele costar)\s+(?:about|unos)\s+(\d{2,3})\s*(?:EUR|€)/i);
  return one ? { lo: Number(one[1]), hi: Number(one[1]) } : null;
}
// "about 9 km from Orcasitas", only past OFFER_FAR_KM and only for a real area.
function offerFar(km: number, area: string, L: string): string {
  const a = String(area || "").trim();
  if (!Number.isFinite(km) || km <= OFFER_FAR_KM || !a || /^(anywhere|any|cualquier|me da igual|donde sea|madrid|flexible)\b/i.test(a)) return "";
  return OFFER_COPY[L].far(Math.round(km), a);
}
// "Closer or cheaper" means one of the two, measurably. A row that cannot be
// compared on either is still shown: not knowing is not the same as worse.
function offerBetterAlt(o: { price: number | null; km: number | null }, d: { price: number | null; km: number | null }): boolean {
  const pc = o.price !== null && d.price !== null, kc = o.km !== null && d.km !== null;
  if (!pc && !kc) return true;
  return (pc && (o.price as number) < (d.price as number)) || (kc && (o.km as number) < (d.km as number));
}
// A different studio, asked for in words: "another center", "otro centro",
// "más cerca", "más barato", "cheaper", "keep looking". Same as the button.
const ALT_OFFER_RE = /\b(another|other|different)\s+(cent(?:er|re)|studio|place|spa|one|option)s?\b|\botr[oa]s?\s+(centros?|sitios?|lugar(?:es)?|spas?|estudios?|opci[oó]n(?:es)?|zona)(?![a-zñáéíóú])|\bm[aá]s\s+(barat[oa]s?|econ[oó]mic[oa]s?|cerca|cercan[oa]s?)(?![a-zñáéíóú])|\b(closer|nearer|cheaper)\b|\bkeep\s+looking\b|\bsig(?:ue|o|an)\s+buscando\b/i;
// v204 review (12 Oct): a question about the offered studio is not a request
// for a different one. "Which metro is closer?", "¿Está más cerca de Sol o de
// Atocha?" and "Is there another option to pay?" all match ALT_OFFER_RE, and
// each would have turned the offer down, told the studio the client did not
// want the time and widened the request. In a question (aboutPlace: the caller
// passes looksLikeQuestion or ADDRESS_Q_RE) only an explicit ask for another
// centre, or for something closer or cheaper, counts.
const ALT_EXPLICIT_RE = /\b(another|other|different)\s+(cent(?:er|re)|studio|place|spa)s?\b|\botr[oa]s?\s+(centros?|sitios?|lugar(?:es)?|spas?|estudios?)(?![a-zñáéíóú])|\bkeep\s+looking\b|\bsig(?:ue|o|an)\s+buscando\b|\b(something|anything|any|one|ones)\s+(closer|nearer|cheaper)\b|\b(closer|nearer|cheaper)\s+(one|ones|option|options|place|places|studio|studios|cent(?:er|re)s?|spa)\b|\b(algo|alguno|alguna|uno|una|otro|otra)\s+m[aá]s\s+(barat[oa]|econ[oó]mic[oa]|cerca|cercan[oa])(?![a-zñáéíóú])/i;
function altOfferAsked(text: string, aboutPlace: boolean): boolean {
  if (!ALT_OFFER_RE.test(text)) return false;
  return !aboutPlace || ALT_EXPLICIT_RE.test(text);
}
// Queued offers, best first: cheapest, then nearest. Unknowns go last.
const offerRank = (a: { price: number | null; km: number | null }, b: { price: number | null; km: number | null }) =>
  (a.price ?? 1e9) - (b.price ?? 1e9) || (a.km ?? 1e9) - (b.km ?? 1e9);

// The offer itself (v204). Decision first, then everything needed to make it:
// price, the line about the price when it is above what we quoted, address and
// distance, and the question last. The old message opened "Update on your
// massage", put the price under "Does that work?" and never said how far away
// the studio was. Plain text, no bold (Jordan, 19 Sept), no em or en dashes.
const OFFER_COPY: Record<string, any> = {
  en: {
    head: (n: string, studio: string, where: string, time: string, day: string) =>
      `${n ? n + ", " : ""}${studio}${where ? " (" + where + ")" : ""} can take you at ${time}${day ? " " + day : ""}.`,
    headMiss: (n: string, band: string, studio: string, where: string, time: string, day: string) =>
      `${n ? n + ", n" : "N"}obody has ${band} yet; ${studio}${where ? " (" + where + ")" : ""} can do ${time}${day ? " " + day : ""}.`,
    anyToday: "anything today",
    above: (lo: number, hi: number) => `That is more than the ${lo === hi ? "" : lo + " to "}${hi} EUR I mentioned earlier: it is this studio's own price.`,
    far: (km: number, area: string) => `about ${km} km from ${area}`,
    ask: (svcN: string) => `Shall I book your ${svcN.replace(/^(Relaxing|Deep|Sports|Hot|Couples|Lymphatic|Balinese)\b/, (m) => m.toLowerCase())}? Nothing is booked until you tap Yes.`,
    other: "Another time",
    closer: "Closer or cheaper",
    next: "No problem. Here is the next option:",
    better: "Better news, this one is inside the time you asked for:",
    noneYet: "No problem. No other studio has offered a time yet. I am still asking and will write here as soon as one has something.",
    // v204 review: "Closer or cheaper" when other times exist but none is
    // either, and a "no" when nothing at all is left in play.
    noBetter: "Nothing closer or cheaper has come in yet. This is the next best option:",
    noneLeft: (n: string) => `No problem${n ? ", " + n : ""}. None of the other studios I asked can do it, so nothing is booked. Would another day or time work? Tap a day below, or tell me a day and time and I will ask again.`,
    bookedStands: (studio: string, time: string) => `Your booking${studio ? " at " + studio : ""}${time ? " at " + time : ""} is confirmed and stays as it is. If you want to change it, tell me the new day and time.`,
    askTime: "What time would suit you better? Tell me and I will ask the studios.",
    cancelled: "Understood, I will not book it. Whenever you want a massage, just write here.",
    chase: (n: string, studio: string, time: string, day: string) =>
      `${n ? n + ", " : ""}${studio} still has ${time} free${day ? " " + day : ""}, but they will not hold it for long. Tap Yes and it is yours, or tell me what would suit you better.\n\nMassage Club`,
    lapse: (n: string, studio: string, time: string) =>
      `${n ? n + ", i" : "I"}t is now too close to ${time} to book ${studio}, so that slot has gone. If you still want a massage, tell me another time or day and I will ask the studios again.\n\nMassage Club`,
  },
  es: {
    head: (n: string, studio: string, where: string, time: string, day: string) =>
      `${n ? n + ", " : ""}${studio}${where ? " (" + where + ")" : ""} puede atenderte a las ${time}${day ? " " + day : ""}.`,
    headMiss: (n: string, band: string, studio: string, where: string, time: string, day: string) =>
      `${n ? n + ", t" : "T"}odavía nadie tiene ${band}; ${studio}${where ? " (" + where + ")" : ""} puede a las ${time}${day ? " " + day : ""}.`,
    anyToday: "hueco hoy",
    above: (lo: number, hi: number) => `Es más de los ${lo === hi ? "" : lo + " a "}${hi} EUR que te comenté: es el precio de este centro.`,
    far: (km: number, area: string) => `a unos ${km} km de ${area}`,
    // v204 review: "la reflexología", the one service that is feminine in Spanish.
    ask: (svcN: string) => `¿Te reservo ${/^reflexolog/i.test(svcN) ? "la" : "el"} ${svcN}? No se reserva nada hasta que toques Sí.`,
    other: "Otra hora",
    // 18 characters: WhatsApp cuts a button title at 20, and "Más cerca o más barato" is 22.
    closer: "Más cerca o barato",
    next: "Sin problema. Aquí tienes la siguiente opción:",
    better: "Mejor noticia, esta sí encaja con la hora que pediste:",
    noneYet: "Sin problema. Ningún otro centro ha propuesto hora todavía. Sigo preguntando y te escribo por aquí en cuanto uno tenga algo.",
    noBetter: "Todavía no ha llegado nada más cerca ni más barato. Esta es la siguiente mejor opción:",
    noneLeft: (n: string) => `Sin problema${n ? ", " + n : ""}. Ninguno de los otros centros a los que pregunté puede, así que no hay nada reservado. ¿Te vendría bien otro día u otra hora? Toca un día abajo, o dime día y hora y vuelvo a preguntar.`,
    bookedStands: (studio: string, time: string) => `Tu reserva${studio ? " en " + studio : ""}${time ? " a las " + time : ""} está confirmada y sigue igual. Si quieres cambiarla, dime el nuevo día y la hora.`,
    askTime: "¿Qué hora te vendría mejor? Dímela y se la pregunto a los centros.",
    cancelled: "Entendido, no lo reservo. Cuando quieras un masaje, escríbeme por aquí.",
    chase: (n: string, studio: string, time: string, day: string) =>
      `${n ? n + ", " : ""}${studio} sigue teniendo libre las ${time}${day ? " " + day : ""}, pero no te la guardan mucho. Toca Sí y es tuya, o dime qué te vendría mejor.\n\nMassage Club`,
    lapse: (n: string, studio: string, time: string) =>
      `${n ? n + ", y" : "Y"}a queda muy poco para las ${time} y no da tiempo a reservar ${studio}, así que esa hora se ha perdido. Si todavía quieres el masaje, dime otra hora u otro día y vuelvo a preguntar a los centros.\n\nMassage Club`,
  },
};
// v204: three buttons on every offer. "Another time" and "Closer or cheaper"
// both lead to the next offer (declineOffer), where "Another time" used to end
// in "we keep asking" and silence.
const offerButtons = (L: string, row: string, time: string) => [
  { id: `offer_yes_${row}`, title: COPY[L].offerYes(time) },
  { id: `offer_no_${row}`, title: OFFER_COPY[L].other },
  { id: `offer_alt_${row}`, title: OFFER_COPY[L].closer },
];
function offerBody(L: string, o: { lead?: string; name: string; studio: string; where: string; time: string; day: string; band: string; svc: string; price: string; above: string; address: string; far: string }): string {
  const C = OFFER_COPY[L];
  const day = offerDayPhrase(o.day, L);
  const head = o.band ? C.headMiss(o.name, o.band, o.studio, o.where, o.time, day) : C.head(o.name, o.studio, o.where, o.time, day);
  const place = o.address ? o.address + (o.far ? ", " + o.far : "") : (o.far ? o.far.charAt(0).toUpperCase() + o.far.slice(1) + "." : "");
  const facts = [o.price, o.above, place].filter(Boolean).join("\n");
  return [o.lead || "", head, facts, C.ask(o.svc)].filter(Boolean).join("\n\n");
}
// ---- v204 offer step: pure helpers (end) ----

// ---- v212 studio Spanish: shared helpers ----
// v212 (16 Oct, Jordan: "i don't want it to look robotic ... i see a weird
// message not a normal message"). One way of saying the day, the hour and the
// price in every message wa-bot writes to a studio, the same way
// dispatch-studios v48 says them: "el lunes 19 de octubre", "hoy", "mañana";
// "a las 15:30"; "por la tarde, entre las 13:00 y las 18:00"; "65 €". The day
// comes from the calendar date, never from day1 as the customer typed it
// (English, or a "Tomorrow" that has gone stale). Every studio message in this
// file uses these; do not add another set. They sit between the two blocks
// tests/replay.mjs lifts, not inside them, because they call exactTime, which
// lives outside both.
//
// The Madrid calendar day of a request: when it starts if that is stored, a
// written confirmed day, else the day asked for, read from when the request
// was made (as dispatch-studios' requestDate does).
function studioDate(req: any, now = new Date()): Date | null {
  const cs = req?.confirmed_start ? Date.parse(String(req.confirmed_start)) : NaN;
  if (!isNaN(cs)) return madridMidnight(new Date(cs));
  const made = req?.created_at ? Date.parse(String(req.created_at)) : NaN;
  const base = isNaN(made) ? now : new Date(made);
  // confirmed_day holds the offer's own words; a "Mañana" there is relative to
  // when it was written, so only a written date is trusted from it.
  const cd = String(req?.confirmed_day || "").trim();
  if (cd && /\d/.test(cd)) { const d = resolveRequestDate(cd, "", base); if (d) return d; }
  return resolveRequestDate(req?.day1, req?.message_text, base);
}
// A day as the studio reads it, seen from now: "hoy", "mañana", "el lunes 19 de octubre".
const studioDayOf = (d: Date | null, now = new Date()): string => d ? offerDayPhrase(offerDayLabel(d, now, "es"), "es") : "";
// The day of a request ("" when it cannot be read: say nothing rather than guess).
const studioDayEs = (req: any, now = new Date()): string => studioDayOf(studioDate(req, now), now);
// The day of a slot instant (an offer's slotAt).
const studioDayAt = (ms: number | null): string => ms === null || isNaN(ms) ? "" : studioDayOf(madridMidnight(new Date(ms)));
// "el lunes 19 de octubre" -> "del lunes 19 de octubre", "hoy" -> "de hoy".
const deDay = (p: string): string => !p ? "" : p.startsWith("el ") ? `del ${p.slice(3)}` : `de ${p}`;
// The window asked for, with its part of the day: "por la tarde, entre las
// 13:00 y las 18:00", "a partir de las 12:00", or "" when it cannot be read.
function studioBandEs(req: any): string {
  const w = askWindow(req?.time1, req?.message_text);
  const span = windowEs(w);
  if (!w || !span.startsWith("entre ")) return span;
  return `${w[0] < 13 * 60 ? "por la mañana" : w[0] < 20 * 60 ? "por la tarde" : "por la noche"}, ${span}`;
}
// The agreed hour ("15:30"), else the hour put to the studios, else "".
function studioHour(req: any): string {
  const ct = String(req?.confirmed_time || "").trim().match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (ct) return `${ct[1].padStart(2, "0")}:${ct[2]}`;
  const cs = req?.confirmed_start ? Date.parse(String(req.confirmed_start)) : NaN;
  if (!isNaN(cs)) return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(cs));
  return exactTime(req);
}
// "a las 15:30", else the band, else "".
const studioHoursEs = (req: any): string => { const h = studioHour(req); return h ? `a las ${h}` : studioBandEs(req); };
// "el lunes 19 de octubre a las 15:30", "hoy por la tarde, entre las 13:00 y las 18:00".
const studioWhenEs = (req: any): string => [studioDayEs(req), studioHoursEs(req)].filter(Boolean).join(" ");
// A price as a studio reads it: "65 €", "62,50 €".
const eurEs = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",")) + " €";
// The Madrid day of an offer's slot (session offer.slotAt, an ISO instant).
const studioSlotDate = (iso: unknown): Date | null => { const t = Date.parse(String(iso || "")); return Number.isFinite(t) ? madridMidnight(new Date(t)) : null; };
// The day an email gives a studio: always the full date, never "hoy" or
// "mañana", because an email can be read the next morning. "el lunes 19 de octubre".
const studioDateFull = (d: Date | null): string => d ? `el ${OFFER_DATE_FMT.es.format(d).replace(",", "")}` : "";
// "a las 15:30" for a clock time, "" for anything else (never raw time1).
const studioAtEs = (t: unknown): string => { const m = String(t || "").match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/); return m ? `a las ${m[1].padStart(2, "0")}:${m[2]}` : ""; };
// The first lines and the sign-off of every email to a studio.
const studioMailHead = (studio: string): string => `Hola${studio ? `, equipo de ${studio}:` : ","}\n\nSoy Jordan, de Massage Club, un servicio de reservas de masajes en Madrid.`;
const STUDIO_MAIL_SIGN = "Un saludo,\nJordan, de Massage Club";
// What a studio reads before anything else when Jordan writes from his own
// number or a closed-window template opens: "Hola, soy Jordan, de Massage
// Club. Os escribo por el masaje de Brandon del lunes 19 de octubre a las
// 15:30. " The same opener as aviso_centro_v2.
function studioOpener(req: any): string {
  if (!req) return "Hola, soy Jordan, de Massage Club. ";
  const ref = [deDay(studioDayEs(req)), studioHoursEs(req)].filter(Boolean).join(" ");
  return `Hola, soy Jordan, de Massage Club. Os escribo por el masaje de ${req.first_name || "nuestro cliente"}${ref ? " " + ref : ""}. `;
}
// ---- v212 studio Spanish: shared helpers (end) ----

// ---- v204 requests, days and voice: pure helpers (start) ----
// v204 (12 Oct): synth.md changes 3, 4 and 5, and the two open non-customer
// bugs. Same contract as the offer-step block above: no fetches, no sends and
// nothing defined further down, because tests/replay.mjs lifts this block too.
//
// Change 3. What a customer hears about a request no studio could be asked
// about, or that no studio has answered. Six of the twenty requests since
// 14 Sept never reached a studio (#93, #94, #95, #108, #109 among them), at
// least four of those customers had been told "I'm asking the studios right
// now", and Rajesh (#109, Sunday 11:00 near Majadahonda, nothing open) was
// never told anything. Paulo (#87) had ten studios say no or nothing to an
// afternoon and heard nothing either. The replies made while the booking is
// being made are unsigned, like the rest of that conversation; the two the
// settle sweep sends on its own are signed, like the offer follow-up.
const REQUEST_COPY: Record<string, any> = {
  en: {
    closed: (area: string) => `the studios ${area ? "near " + area + " " : ""}are closed at the time you asked for`,
    none: (area: string) => `I do not have a studio ${area ? "near " + area + " " : ""}that I can ask for that`,
    // v204 review: tap false is the email version, and signed is the settle
    // sweep telling a night request at 09:10 that nobody could be asked.
    nothingAsked: (n: string, why: string, tap = true, signed = false) => `${n ? n + ", t" : "T"}o be straight with you: ${why}, so I have not asked anyone and nothing is booked.\n\nWould another day or time work? ${tap ? "Tap a day below or write when suits you" : "Write to us on WhatsApp with a day and time"}, and I will ask straight away.${signed ? "\n\nMassage Club" : ""}`,
    notYet: (n: string) => `${n ? n + ", I" : "I"} have not been able to reach the studios yet, so nobody has been asked and nothing is booked. I will write here as soon as I have news.`,
    allDeclined: (n: string, tap: boolean) => `${n ? n + ", n" : "N"}one of the studios I asked can take you at that time, so nothing is booked. Would another day work? ${tap ? "Tap one below, or tell me a day and time" : "Write to us on WhatsApp with a day and time"} and I will ask again.\n\nMassage Club`,
    quietToday: (n: string, tap: boolean) => `${n ? n + ", n" : "N"}o studio has offered a time for today yet, so nothing is booked. I am still asking and will write ${tap ? "here" : "to you"} straight away if one does. In case nobody can today, would tomorrow work? ${tap ? "Tap below, or tell me another day and time." : "Write to us on WhatsApp with another day and time."}\n\nMassage Club`,
    subject: "Your massage request",
  },
  es: {
    closed: (area: string) => `los centros ${area ? "cerca de " + area + " " : ""}están cerrados el día y a la hora que pediste`,
    none: (area: string) => `no tengo ningún centro ${area ? "cerca de " + area + " " : ""}al que preguntar por eso`,
    nothingAsked: (n: string, why: string, tap = true, signed = false) => `${n ? n + ", t" : "T"}e lo digo claro: ${why}, así que no he preguntado a nadie y no hay nada reservado.\n\n¿Te vendría bien otro día u otra hora? ${tap ? "Toca un día abajo o escríbeme cuándo te viene bien" : "Escríbenos por WhatsApp con el día y la hora"} y pregunto enseguida.${signed ? "\n\nMassage Club" : ""}`,
    notYet: (n: string) => `${n ? n + ", t" : "T"}odavía no he podido contactar con los centros, así que no he preguntado a nadie y no hay nada reservado. Te escribo por aquí en cuanto tenga noticias.`,
    allDeclined: (n: string, tap: boolean) => `${n ? n + ", n" : "N"}inguno de los centros a los que pregunté puede atenderte a esa hora, así que no hay nada reservado. ¿Te viene bien otro día? ${tap ? "Toca uno abajo, o dime día y hora" : "Escríbenos por WhatsApp con el día y la hora"} y vuelvo a preguntar.\n\nMassage Club`,
    quietToday: (n: string, tap: boolean) => `${n ? n + ", n" : "N"}ingún centro ha propuesto hora para hoy todavía, así que no hay nada reservado. Sigo preguntando y te escribo ${tap ? "por aquí " : ""}enseguida si alguno puede. Por si nadie puede hoy, ¿te viene bien mañana? ${tap ? "Toca abajo, o dime otro día y hora." : "Escríbenos por WhatsApp con otro día y hora."}\n\nMassage Club`,
    subject: "Tu petición de masaje",
  },
};
// How long a request has sat at stage "new" inside studio hours, in minutes. A
// request made at night is waiting for dispatch-studios' 09:00 sweep, so its
// clock starts at 09:00; outside 09:00 to 21:00 Madrid it is 0.
function stuckMinutes(createdMs: number, nowMs: number): number {
  const day = madridMidnight(new Date(nowMs));
  const open = madridInstant(day, 9).getTime(), close = madridInstant(day, 21).getTime();
  if (nowMs < open || nowMs >= close) return 0;
  return Math.max(0, Math.floor((nowMs - Math.max(createdMs, open)) / 60e3));
}
// Why a dispatched request needs a word to the customer now, or "" when it
// does not. "declined": every studio asked has said no (or the customer turned
// down the only time), so nothing is left in play. "quiet": a same-day request
// with no time from anyone an hour after the studios were asked. A row that
// lapsed has already told the customer the slot went (lapseOffer).
function noOfferWhy(rows: Array<{ outcome?: unknown; offered_time?: unknown }>, sameDay: boolean, dispatchedMs: number, nowMs: number): "declined" | "quiet" | "" {
  if (!rows.length || rows.some((x) => String(x.outcome || "") === "expired")) return "";
  if (!rows.some((x) => ["pending", "accepted", "won"].includes(String(x.outcome || "")))) return "declined";
  if (sameDay && !rows.some((x) => x.offered_time) && Number.isFinite(dispatchedMs) && nowMs - dispatchedMs >= 60 * 60e3) return "quiet";
  return "";
}

// Change 4. "Another day" used to say "Which day? Just type it", and whatever
// came back was saved as the day: Hafeez's "Plzz" on 11 Oct, and "Mandame
// derecicon" (EN: send me the address) from +34 642 627 441. Three more people
// left at that prompt. It is now a list of the next seven dates to tap; a typed
// date still works. Closed days are listed too: the studios' own hours decide
// who gets asked, and some studio is open most days.
const DAY_LIST_FMT: Record<string, Intl.DateTimeFormat> = {
  es: new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }),
  en: new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }),
};
const DAY_ID_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_LIST_COPY: Record<string, { body: string; button: string }> = {
  en: { body: "Which day? Pick one below, or write another date.", button: "Pick a day" },
  es: { body: "¿Qué día? Elige uno abajo o escríbeme otra fecha.", button: "Elegir día" },
};
// Tomorrow and the six days after it: "Mar 13 oct" / "Tue 13 Oct", id dayd_2026-10-13.
function dayListRows(L: string, nowMs: number): Array<{ id: string; title: string; description: string }> {
  const base = madridMidnight(new Date(nowMs)).getTime();
  const rows: Array<{ id: string; title: string; description: string }> = [];
  for (let n = 1; n <= 7; n++) {
    const at = new Date(base + n * 86400e3 + 12 * 3600e3);
    const p = DAY_LIST_FMT[L === "es" ? "es" : "en"].formatToParts(at);
    const g = (k: string) => String(p.find((x) => x.type === k)?.value || "").replace(/\.$/, "");
    const wd = g("weekday");
    rows.push({ id: `dayd_${DAY_ID_FMT.format(at)}`, title: `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${g("day")} ${g("month")}`, description: n === 1 ? (L === "es" ? "Mañana" : "Tomorrow") : "" });
  }
  return rows;
}
// A number range written with a dash ("50–85 EUR") becomes words before
// noDashes turns every other dash into a comma, so it never reads "50, 85 EUR".
const dashRanges = (reply: string, L: string) => String(reply || "").replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, L === "es" ? "$1 a $2" : "$1 to $2");
// Jordan's own message from the reply page is the context for the customer's
// next reply, for this long.
const FOUNDER_CTX_MS = 30 * 60e3;
// A plain yes. Hafeez answered "Would you like a menu of massages offered?" with
// "Plzz" and "Send me"; synth.md found "yes please", "send me the list", "si
// porfa" and "Mándame la lista" would all still have been saved as his day.
const FOUNDER_YES_RE = /^(yes|yeah|yep|sure|ok(ay)?|please|pl[sz]+|plea+s[ea]|s[ií]+|vale|claro|dale|porfa(vor)?|por\s+favor|send(\s+(me|it|them))?(\s+the\s+(menu|list))?|m[aá]nda(me|lo|la)?(\s+la\s+(lista|carta))?)(,?\s+(please|pls|por\s+favor|porfa|thanks|thank\s+you|gracias))*[\s!.]*$/i;
// He offered a menu, a list or the types, and they said yes to it.
const founderMenuYes = (said: string, reply: string) => /\b(menu|men[uú]|list|lista|carta|types?|tipos?)\b/i.test(said) && FOUNDER_YES_RE.test(String(reply || "").trim());

// Change 5. A voice note we could not transcribe. The old line opened in Spanish
// to English speakers and said we cannot listen to audio, which is not true: we
// transcribe them, and SENE's two notes this morning (+34 623 415 275) failed
// only because the OpenRouter balance fell under its audio minimum.
const VOICE_FAIL: Record<string, string> = {
  en: "Sorry, that voice note didn't come through on our side. Could you type it?",
  es: "Perdona, esa nota de voz no nos ha llegado bien. ¿Nos lo escribes?",
};

// Job seekers. Manju (#91, 22 Sept) wrote "Estoy buscando trabajo de masaje"
// (EN: I'm looking for massage work) and "I'm looking for work", was walked
// through the whole booking, and four real studios were asked about her; Calma
// offered her 13:00. JOB_RE (copy.ts, pinned) knows "busco trabajo" but not
// "estoy buscando trabajo", "trabajo de masajista" or "looking for work". And
// her clearest message, "no estoy buscando una cita para recibir un masaje"
// (EN: I am not looking for an appointment to receive a massage), counted as a
// booking because it says "cita". A booking word that is denied is not one.
const JOB_EXTRA_RE = /\b(estoy\s+)?buscando\s+(un\s+)?(trabajo|empleo|curro)\b|\bbusco\s+(un\s+)?(trabajo|empleo|curro)\b|\btrabajo\s+(de|como)\s+(masajista|terapeuta|masaje)\b|\btrabajar\s+(de|como)\s+(masajista|terapeuta)\b|\boportunidad(es)?\s+de\s+(trabajo|empleo)\b|\bofertas?\s+de\s+(trabajo|empleo)\b|\blooking\s+for\s+(a\s+)?(massage\s+)?(job|work|employment)\b|\b(job|work)\s+opportunit/i;
const NOT_A_BOOKING_RE = /\b(no|not)\s+(estoy\s+|i'?m\s+|am\s+)?(buscando|busco|quiero|looking\s+for|want(ing)?)\s+(una?\s+|an?\s+)?(cita|reserva|appointment|booking|masaje|massage)\b/gi;
// v204 review (12 Oct): the check now runs before every question branch and
// closes live requests, so a customer's own words must never trip it. JOB_RE
// (pinned) matches the bare words "job", "apply", "cv" and "resume", and with
// them "Does the student discount apply?", "I finish my job at 18:00, is 19:00
// possible?", "Can we resume?" and "Great job, thanks!" were all job seekers;
// at the offer step that dropped the live offer and told every studio the
// client was not going ahead. "Plaza" is weak too: "¿Tenéis alguna plaza
// mañana?" asks for a slot. Those words count only inside a phrase about work.
const JOB_WEAK_RE = /\b(jobs?|apply|applying|cv|resume|plaza)\b/gi;
const JOB_PHRASE_RE = /\bapply(ing)?\s+(for|to)\s+(a\s+|the\s+|any\s+)?(job|position|role|post|vacanc)|\b(my|mi|send|sending|enviar|mandar|mando|attach(ed)?|adjunto)\s+(my\s+|mi\s+)?(cv|resume|curr[ií]culum)\b|\b(a|any|some)\s+jobs?\s+(for|as|opening|openings|available|offer)\b|\bjob\s+(offer|opening|application|vacanc)/i;
// "explicit" is someone plainly asking for work (JOB_EXTRA_RE, or "apply for a
// job", "send my CV"); "job" is the rest of JOB_RE without its weak words.
function jobSeekerKind(t: string): "explicit" | "job" | "" {
  const s = String(t || "");
  const kind = JOB_EXTRA_RE.test(s) || JOB_PHRASE_RE.test(s) ? "explicit" : JOB_RE.test(s.replace(JOB_WEAK_RE, " ")) ? "job" : "";
  if (!kind) return "";
  return /book|reserv|appointment|cita/i.test(s.replace(NOT_A_BOOKING_RE, "")) ? "" : kind;
}
const isJobSeeker = (t: string): boolean => !!jobSeekerKind(t);
// ---- v204 requests, days and voice: pure helpers (end) ----

// ---- v215 released slots: pure helpers (start) ----
// v215 (17 Oct, Jordan: "We need more studios to give us times"). A studio
// gives Massage Club a specific free time in advance (CLAUDE.md, PRE-RELEASED
// SLOTS, 12 Oct): that release counts as the studio's tap, so the customer's
// tap books it, the studio gets the written confirmation at once with the
// client's name and phone and may reject it within 15 minutes. The table and
// its state changes are supabase/migrations/20261018_released_slots.sql.
// Behind app_secrets RELEASED: off (the default, and anything missing or
// unknown) changes nothing for anyone; test shows test studios' times to test
// contacts only; on shows real studios' times to real customers, and test
// contacts still only ever see test studios.
// tests/replay.mjs lifts this block out of the file like the two above, so it
// only uses copy.ts (madridInstant, madridMidnight, stripAcc, euro).
type RelMode = "off" | "test" | "on";
function parseReleasedMode(v: unknown): RelMode {
  const x = String(v ?? "").trim().toLowerCase();
  return x === "on" || x === "test" ? x : "off";
}
// Who counts as a test customer for released times: Jordan's own numbers, the
// canary's fake 3460000xxxx numbers, and CLAUDE.md's test contacts (his
// addresses, the test domains, +mctest/+uitest, a name with test or prueba).
// Cata and Yi, the friend testers, never see a released time at all, and
// neither does anyone else the bot already treats as a tester (knownTester).
const REL_TEST_PHONES = ["15622355063", "34612474827"];
const REL_CANARY_RE = /^3460000\d{4}$/;
const REL_FRIEND_EMAIL_RE = /^(cata\.waack@gmail\.com|elon_yilong@student\.ie\.edu|longyi_elon@outlook\.com)$/i;
const REL_TEST_EMAIL_RE = /^(jordan\.hays@student\.ie\.edu|jordanjayhays@gmail\.com|jordan@massageclub\.io|support@massageclub\.io|jordan@niahconnect\.com)$|@(testing|example|test)\.com$|@placeholder\.local$|\+(mctest|uitest)[^@]*@/i;
const REL_TEST_NAME_RE = /\b(test|prueba|uitest|mctest)\b/i;
// A test studio, the same rule the migration uses for released_slots.is_test.
const REL_TEST_STUDIO_RE = /\b(test|prueba)\b/i;
type RelAudience = "test" | "real" | "none";
function releasedAudience(c: { phone?: unknown; email?: unknown; name?: unknown; knownTester?: boolean }): RelAudience {
  const d = String(c.phone ?? "").replace(/\D/g, "");
  const e = String(c.email ?? "").trim().toLowerCase();
  if (d === "17867276503" || /^86\d*997$/.test(d) || REL_FRIEND_EMAIL_RE.test(e)) return "none";
  if (REL_TEST_PHONES.includes(d) || REL_CANARY_RE.test(d) || REL_TEST_EMAIL_RE.test(e) || REL_TEST_NAME_RE.test(String(c.name ?? ""))) return "test";
  return c.knownTester ? "none" : "real";
}
// Which studios' times this customer may see: "test", "real" or none at all.
function releasedScope(mode: RelMode, audience: RelAudience): "test" | "real" | null {
  if (mode === "off" || audience === "none") return null;
  if (audience === "test") return "test";
  return mode === "on" ? "real" : null;
}
// Released times are offered from 09:00 to 20:40 Madrid, so the studio's
// written confirmation goes out at once and inside studio hours (09:00 to
// 21:00) even after the 10 minute hold. Outside that, today's path runs.
const REL_HM_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false });
const REL_YMD_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
const relMinOfDay = (ms: number): number => { const [h, m] = REL_HM_FMT.format(new Date(ms)).split(":").map((x) => parseInt(x, 10)); return (h % 24) * 60 + m; };
const relHmOf = (min: number): string => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const relHm = (ms: number): string => relHmOf(relMinOfDay(ms));
const relYmd = (ms: number): string => REL_YMD_FMT.format(new Date(ms));
function releasedHoursOk(nowMs: number): boolean {
  const m = relMinOfDay(nowMs);
  return m >= 9 * 60 && m < 20 * 60 + 40;
}
// The instant of a Madrid wall-clock time on a Madrid calendar day:
// relAt("2026-10-25", 600) is 10:00 Madrid on the day the clocks go back
// (09:00Z), and 1440 is midnight at the end of that day.
function relAt(ymd: string, minutes: number): number {
  const [y, mo, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const day = new Date(Date.UTC(y, mo - 1, d) + Math.floor(minutes / 1440) * 86400e3);
  const m = ((minutes % 1440) + 1440) % 1440;
  return madridInstant(day, Math.floor(m / 60)).getTime() + (m % 60) * 60e3;
}
// Today and the next n-1 days, as Madrid calendar dates.
function slotDays(nowMs: number, n = 7): Array<{ ymd: string; dow: number }> {
  const base = madridMidnight(new Date(nowMs)).getTime();
  const out: Array<{ ymd: string; dow: number }> = [];
  for (let i = 0; i < n; i++) { const d = new Date(base + i * 86400e3); out.push({ ymd: d.toISOString().slice(0, 10), dow: d.getUTCDay() }); }
  return out;
}
// partners.opening_hours comes in two shapes: free text ("Mon-Sat 10:00-20:00",
// "Lun-Vie 10:00-14:00 y 17:00-21:00", "Daily 10:00-21:00") as dispatch-studios
// reads it, and the object PartnerCalendar.tsx writes ({mon: {open, close,
// closed}}). Day -> its open windows in minutes, [] for a closed day. Null is
// "cannot tell", which never rules a time out. In free text a day that is not
// named is closed, as openDays reads it; in the object a missing day is unknown.
// A window after a day's first one with no day of its own ("y 17:00-21:00") is
// the same days' afternoon, which dispatch-studios reads as every day.
const REL_DAY: Record<string, number> = { sun: 0, dom: 0, mon: 1, lun: 1, tue: 2, mar: 2, wed: 3, mie: 3, thu: 4, jue: 4, fri: 5, vie: 5, sat: 6, sab: 6 };
const REL_DEFAULT_HOURS: Array<[number, number]> = [[8 * 60, 22 * 60]];
function relToMin(t: unknown): number | null {
  const m = String(t ?? "").trim().match(/^(\d{1,2})(?:[:.h](\d{2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mi = parseInt(m[2] || "0", 10);
  return h > 24 || mi > 59 || h * 60 + mi > 1440 ? null : h * 60 + mi;
}
function slotHours(oh: unknown): Map<number, Array<[number, number]>> | null {
  let v: unknown = oh;
  if (typeof v === "string" && /^\s*\{/.test(v)) { try { v = JSON.parse(v); } catch { return null; } }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const out = new Map<number, Array<[number, number]>>();
    for (const [k0, x] of Object.entries(v as Record<string, any>)) {
      const d = REL_DAY[stripAcc(String(k0)).slice(0, 3)];
      if (d === undefined) continue;
      if (!x || x.closed === true) { out.set(d, []); continue; }
      const o = relToMin(x.open), c = relToMin(x.close);
      if (o === null || c === null) continue;
      out.set(d, [[o, c <= o ? 1440 : c]]);
    }
    return out.size ? out : null;
  }
  const raw = stripAcc(String(v ?? "")).trim();
  if (!raw) return null;
  const out = new Map<number, Array<[number, number]>>();
  let last: number[] = [];
  for (const seg0 of raw.split(/[,;]|\s+y\s+|\s+and\s+/)) {
    const seg = seg0.trim();
    if (!seg) continue;
    const m = seg.match(/^(.*?)\s*(\d{1,2}(?:[:.]\d{2})?)\s*h?\s*[-–a]\s*(\d{1,2}(?:[:.]\d{2})?)\s*h?$/);
    if (!m) return null;
    const o = relToMin(m[2]), c0 = relToMin(m[3]);
    if (o === null || c0 === null) return null;
    const dayPart = m[1].trim();
    let days: number[] = [];
    if (dayPart === "") days = last.length ? last : [0, 1, 2, 3, 4, 5, 6];
    else if (/^(daily|todos los dias|every day|diario|cada dia)$/.test(dayPart)) days = [0, 1, 2, 3, 4, 5, 6];
    else {
      for (const tok of dayPart.split(/\s*\/\s*|\s+/)) {
        const range = tok.match(/^([a-z]{3})[a-z]*\s*[-–]\s*([a-z]{3})[a-z]*$/);
        if (range) {
          const a = REL_DAY[range[1]], b = REL_DAY[range[2]];
          if (a === undefined || b === undefined) return null;
          for (let d = a; ; d = (d + 1) % 7) { days.push(d); if (d === b) break; }
        } else {
          const one = tok.match(/^([a-z]{3})[a-z]*\.?$/);
          if (!one || REL_DAY[one[1]] === undefined) return null;
          days.push(REL_DAY[one[1]]);
        }
      }
    }
    last = days;
    for (const d of days) out.set(d, [...(out.get(d) || []), [o, c0 <= o ? 1440 : c0] as [number, number]]);
  }
  if (!out.size) return null;
  for (let d = 0; d < 7; d++) if (!out.has(d)) out.set(d, []);
  return out;
}
const slotWindows = (hours: Map<number, Array<[number, number]>> | null, dow: number): Array<[number, number]> =>
  hours && hours.has(dow) ? hours.get(dow) || [] : REL_DEFAULT_HOURS;
// The starts a studio can tap on one day: every half hour inside its windows
// where a massage of `minutes` still ends by closing, and at least leadMin
// from now (the page uses 65, one more than the 60 the database insists on).
function slotGrid(ymd: string, windows: Array<[number, number]>, minutes: number, nowMs: number, leadMin = 65): Array<{ hm: string; min: number; startMs: number }> {
  const seen = new Set<number>();
  const out: Array<{ hm: string; min: number; startMs: number }> = [];
  for (const [o, c] of windows) {
    for (let t = Math.ceil(o / 30) * 30; t + minutes <= c; t += 30) {
      if (seen.has(t)) continue;
      seen.add(t);
      const startMs = relAt(ymd, t);
      if (startMs - leadMin * 60e3 < nowMs) continue;
      out.push({ hm: relHmOf(t), min: t, startMs });
    }
  }
  return out.sort((a, b) => a.min - b.min);
}
// Why one released time cannot be saved, or "" when it can. The studio page
// and the ops release both use it; the database checks the same limits again.
const REL_MINUTES = [30, 60, 90, 120];
function releaseCheck(r: { ymd: string; hm: string; minutes: number }, hours: Map<number, Array<[number, number]>> | null, nowMs: number): "" | "format" | "duration" | "day" | "soon" | "closed" | "hours" {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.ymd || ""))) return "format";
  const t = relToMin(r.hm);
  if (t === null || t >= 1440 || t % 5) return "format";
  if (!REL_MINUTES.includes(Number(r.minutes))) return "duration";
  const day = slotDays(nowMs, 7).find((d) => d.ymd === r.ymd);
  if (!day) return "day";
  if (relAt(r.ymd, t) - 60 * 60e3 < nowMs) return "soon";
  if (hours) {
    const w = slotWindows(hours, day.dow);
    if (!w.length) return "closed";
    if (!w.some(([o, c]) => t >= o && t + Number(r.minutes) <= c)) return "hours";
  }
  return "";
}
// The stretch of time a customer's ask covers, for released_offers: the day
// they asked for (a Madrid midnight, from resolveRequestDate) and the window
// from askWindow (null is Flexible, [-1, -1] could not be read). Never sooner
// than leadMin from now. Null when nothing can fit.
function releasedRange(day: Date | null, win: [number, number] | null, nowMs: number, leadMin = 60): { from: number; to: number } | null {
  if (!day || (win && win[1] < 0)) return null;
  const ymd = day.toISOString().slice(0, 10);
  const a = Math.max(0, win ? win[0] : 0), b = Math.min(1440, win ? win[1] : 1440);
  if (b <= a) return null;
  const from = Math.max(relAt(ymd, a), nowMs + leadMin * 60e3);
  const to = relAt(ymd, b);
  return from < to ? { from, to } : null;
}
// The customer's copy of a released time's day: "today", "tomorrow", "Sat 18 Oct".
const REL_DAY_FMT: Record<string, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }),
  es: new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }),
};
function relDayWord(slotMs: number, nowMs: number, L: string): string {
  const n = Math.round((madridMidnight(new Date(slotMs)).getTime() - madridMidnight(new Date(nowMs)).getTime()) / 86400e3);
  const es = L === "es";
  if (n === 0) return es ? "hoy" : "today";
  if (n === 1) return es ? "mañana" : "tomorrow";
  return REL_DAY_FMT[es ? "es" : "en"].format(new Date(slotMs)).replace(/[.,]/g, "");
}
// What the customer reads. A price is shown only when the studio typed it
// (exact) or as the studio's listed price ("about" unless it is a registered
// studio's own menu), the way offerStudios shows prices.
type RelLine = { studio: string; area: string; day: string; hm: string; svc: string; minutes: number; price: number | null; exact: boolean };
function releasedLine(o: RelLine, L: string): string {
  const es = L === "es";
  const price = o.price && o.price > 0 ? `, ${o.exact ? "" : es ? "unos " : "about "}${euro(o.price)}` : "";
  return `· *${o.studio}*${o.area ? ` (${o.area})` : ""}: ${o.day} ${o.hm}, ${o.svc} ${o.minutes} min${price}`;
}
const RELEASED_COPY: Record<string, {
  many: (lines: string[]) => string; one: (line: string) => string; more: string; yes: (t: string) => string;
  justTaken: string; stale: string; gone: string; heldOut: string; rejectNote: string; noThanks: string; showOptions: string; noThanksBtn: string;
  rejectedNext: (first: string, studio: string, at: string, line: string) => string; rejectedNone: (first: string, studio: string, at: string) => string;
  rejectedMail: (first: string, studio: string, at: string) => string; rejectedSubject: (studio: string) => string;
}> = {
  en: {
    many: (lines) => `Good news: these times are free and you can book one right now.\n\n${lines.join("\n")}\n\nTap one and it's booked. The studio gets your name and phone for the booking. You pay at the studio, no fee from us.`,
    one: (line) => `Good news: this time is free and you can book it right now.\n\n${line}\n\nTap Yes and it's booked. The studio gets your name and phone for the booking. You pay at the studio, no fee from us.`,
    more: "More options",
    yes: (t) => `Yes, book ${t}`,
    justTaken: "Someone has just booked that time, sorry. Here is what is free now.",
    stale: "Those times have changed since I sent them. Here is what is free now.",
    gone: "Those times are no longer on offer. Write here whenever you would like to book.",
    heldOut: "I held that time for 10 minutes and it has gone back on offer, so nothing is booked yet. Here is what is free now.",
    rejectNote: "If the studio has a problem with it, they tell us within 15 minutes and we let you know straight away.",
    noThanks: "No problem, nothing is booked. Write here whenever you would like a massage.",
    showOptions: "Show options",
    noThanksBtn: "No, thanks",
    rejectedNext: (first, studio, at, line) => `Sorry${first ? " " + first : ""}, ${studio} has just told us they cannot take you ${at} after all, so nothing is booked there.\n\nThe next free time near you:\n${line}\n\nTap Yes and it's booked, or More options to see other studios.`,
    rejectedNone: (first, studio, at) => `Sorry${first ? " " + first : ""}, ${studio} has just told us they cannot take you ${at} after all, so nothing is booked there.\n\nWould you like to see other studios near you?`,
    rejectedMail: (first, studio, at) => `Sorry${first ? " " + first : ""}, ${studio} has just told us they cannot take you ${at} after all, so nothing is booked there and you do not need to go.\n\nReply to us on WhatsApp and we will find you another time.\n\nMassage Club`,
    rejectedSubject: (studio) => `${studio} cannot take you after all`,
  },
  es: {
    many: (lines) => `Buenas noticias: estas horas están libres y puedes reservar una ahora mismo.\n\n${lines.join("\n")}\n\nToca una y queda reservada. El centro recibe tu nombre y tu teléfono para la reserva. Pagas en el centro, sin comisión.`,
    one: (line) => `Buenas noticias: esta hora está libre y puedes reservarla ahora mismo.\n\n${line}\n\nToca Sí y queda reservada. El centro recibe tu nombre y tu teléfono para la reserva. Pagas en el centro, sin comisión.`,
    more: "Más opciones",
    yes: (t) => `Sí, reserva ${t}`,
    justTaken: "Alguien acaba de reservar esa hora, lo siento. Esto es lo que queda libre.",
    stale: "Esas horas han cambiado desde que te las mandé. Esto es lo que queda libre.",
    gone: "Esas horas ya no están disponibles. Escríbenos cuando quieras reservar.",
    heldOut: "Te guardé esa hora 10 minutos y ha vuelto a quedar libre, así que todavía no hay nada reservado. Esto es lo que queda libre.",
    rejectNote: "Si el centro tuviera algún problema, nos lo dice en 15 minutos y te avisamos al momento.",
    noThanks: "Sin problema, no hay nada reservado. Escríbenos cuando te apetezca un masaje.",
    showOptions: "Ver opciones",
    noThanksBtn: "No, gracias",
    rejectedNext: (first, studio, at, line) => `Lo siento${first ? " " + first : ""}, ${studio} nos acaba de decir que al final no puede ${at}, así que ahí no hay nada reservado.\n\nLa siguiente hora libre cerca de ti:\n${line}\n\nToca Sí y queda reservada, o Más opciones para ver otros centros.`,
    rejectedNone: (first, studio, at) => `Lo siento${first ? " " + first : ""}, ${studio} nos acaba de decir que al final no puede ${at}, así que ahí no hay nada reservado.\n\n¿Quieres ver otros centros cerca de ti?`,
    rejectedMail: (first, studio, at) => `Lo siento${first ? " " + first : ""}, ${studio} nos acaba de decir que al final no puede ${at}, así que ahí no hay nada reservado y no hace falta que vayas.\n\nEscríbenos por WhatsApp y te buscamos otra hora.\n\nMassage Club`,
    rejectedSubject: (studio) => `${studio} al final no puede`,
  },
};
// Buttons. Two options: "18:00 Calma" style, cut at WhatsApp's 20 characters.
// One option: "Yes, book 18:00". Always "More options", which runs today's path.
function releasedButtons(L: string, opts: Array<{ studio: string; hm: string }>): Array<{ id: string; title: string }> {
  const c = RELEASED_COPY[L === "es" ? "es" : "en"];
  const short = (n: string) => String(n || "").replace(/\s+(Relax and Beauty|Wellness Studio|Madrid Spa|Massage Club|Masajes?|Spa|Studio)$/i, "");
  const btns = opts.length === 1
    ? [{ id: "rel_0", title: c.yes(opts[0].hm) }]
    : opts.slice(0, 2).map((o, i) => ({ id: `rel_${i}`, title: `${o.hm} ${short(o.studio)}`.slice(0, 20).trim() }));
  btns.push({ id: "rel_more", title: c.more });
  return btns;
}
// The client's contact line in the studio's confirmation: "Su teléfono es
// +34 600... y su email, ana@x.com." (Their phone is ... and their email ...)
function releasedContactEs(phone: unknown, email: unknown): string {
  const p = String(phone ?? "").replace(/\D/g, "");
  const e = String(email ?? "").trim();
  const tel = p ? `+${p}` : "";
  if (tel && e) return `Su teléfono es ${tel} y su email, ${e}.`;
  if (tel) return `Su teléfono es ${tel}.`;
  return e ? `Su email es ${e}.` : "";
}
// ---- v215 released slots: pure helpers (end) ----

// v203: says what became of the offer ("whatsapp", "email", "none", or why it
// was held back), so a caller with no WhatsApp thread to the studio (a phone
// call) knows when the customer was never shown it.
// v204: opts.fromQueue is an offer a studio made a while ago, shown now because
// the customer asked for the next one or a same-day hold ran out. Its row is
// not rewritten (replied_at feeds the studio's reply speed), it is never held
// again, and anything said to the studio goes through studioNoteSure, inside its
// hours, because it is no longer an answer to something the studio just wrote.
// opts.lead is a line above the offer ("No problem. Here is the next option:").
async function forwardOffer(req: any, partner: { id: string; business_name: string }, rowId: string, time: string, freeText: string, studioFrom: string, opts: { dayHint?: string; ownOption?: boolean; fromQueue?: boolean; lead?: string } = {}): Promise<string> {
  const clientNum = digitsOf(req.client_phone || "");
  if (!opts.fromQueue) {
    await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, {
      method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ offered_time: time, offered_times: parseOfferedTimes(freeText), offered_at: new Date().toISOString(), replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500) }),
    });
  }
  // v212: a queued time shown later is not an answer to something the studio
  // just wrote, and its 24 hours may have passed, so it goes through
  // studioNoteSure (aviso templates, queued outside studio hours) with `short`,
  // the same news as one or two sentences for the template. Never plain text
  // that Meta drops once the window has shut.
  let noteUntil: string | null = null;
  const toStudio = (t: string, short = ""): Promise<boolean> => opts.fromQueue
    ? studioNoteSure({ request_id: Number(req.id), partner_id: partner.id, phone: studioFrom, text: t, short: short || t, time: /^\d{1,2}:\d{2}$/.test(time) ? time : "", until: noteUntil }).then((r) => r !== "failed")
    : studioSay(studioFrom, t);
  const who = String(req.first_name || "").trim() || "el cliente";
  const Who = who.charAt(0).toUpperCase() + who.slice(1);
  const cs = await getSession(clientNum);
  // v204 (12 Oct): a muted session is someone who asked twice for something we
  // do not sell. Jordan's rule is the shutdown line and no further replies, and
  // this function used to overwrite step "muted" with "await_offer" and send
  // them the studio's time anyway. Nothing goes to them and the request is
  // closed; dispatch-studios' chase sweep then tells every studio still holding
  // it, inside that studio's own hours.
  if (clientNum && cs.step === "muted") {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&stage=not.in.(confirmed,cancelled,dismissed)`, {
      method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ stage: "dismissed", stage_note: "Customer muted (off-menu requests); studio offers are not forwarded", stage_updated_at: new Date().toISOString() }),
    });
    await logEvent(clientNum, "offer_not_sent_muted", { request_id: req.id, studio: partner.business_name, time });
    await notifyJordanWa(`${partner.business_name} offered ${time} on #${req.id}, but the customer is muted. Nothing sent to them and the request is closed.`, clientNum);
    return "muted";
  }
  // v117 (21 Sept): never send a customer a worse price than one they already
  // have. Al turned down 80 EUR, was offered 60 at Centro Aloha, and ninety
  // minutes later Calma answered the chase with 85 and the bot forwarded it
  // straight to him. A dearer slot arriving after a cheaper live one is not an
  // option, it is a reason to stop trusting the price we quote. The dearer
  // offer is still recorded, and the studio is still thanked, so nothing is
  // lost if the cheaper one falls through.
  // v204: only against offers this customer was actually shown. Rows queued
  // behind a live offer never reached them, so a cheaper one of those is no
  // reason to hide a time they have just asked to see.
  try {
    const mine = parseQuotedPrice(freeText) || 0;
    const shown: string[] = cs.data.offersShown && Number(cs.data.offersShown.request) === Number(req.id)
      ? (cs.data.offersShown.rows || []).map(String).filter((x: string) => x !== String(rowId)) : [];
    if (mine > 0 && shown.length) {
      const bq = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=in.(${shown.map(encodeURIComponent).join(",")})&quoted_price=not.is.null&outcome=in.(pending,accepted,won)&order=quoted_price.asc&limit=1&select=quoted_price,partner_id`, { headers: H() });
      const best = (await bq.json().catch(() => []))[0] || null;
      if (best && Number(best.quoted_price) < mine) {
        console.log(`[wa] offer withheld: ${partner.business_name} at ${euro(mine)} is dearer than the live ${euro(Number(best.quoted_price))} already with the customer`);
        await toStudio(`Gracias, apuntado: ${time}, ${eurEs(mine)}. Ahora mismo ${who} tiene delante una oferta más barata, así que no le guardéis el hueco. Si cambia algo, os escribo enseguida.`,
          `Ahora mismo tiene delante una oferta más barata, así que no le guardéis el hueco. Si cambia algo, os escribo enseguida.`);
        await logEvent(clientNum, "offer_withheld_dearer", { request_id: req.id, studio: partner.business_name, price: mine, best: Number(best.quoted_price) });
        return "withheld_dearer";
      }
    }
  } catch (e) { console.log("[wa] dearer-offer check skipped", String(e)); }
  const L = cs.data.lang === "es" || req.languages === "es" ? "es" : "en";
  // v204: the customer's area, for the distance line. Not every caller selects
  // it. Nor message_text, which askWindow reads an "earliest" request from.
  // v212: and created_at, so a "Tomorrow" in day1 is read from when it was written.
  if (req.area === undefined || req.message_text === undefined || req.created_at === undefined) {
    const ar = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&select=area,message_text,created_at`, { headers: H() });
    const got = (((await ar.json().catch(() => [])) || [])[0] || {}) as Record<string, unknown>;
    req = { ...req, area: req.area === undefined ? String(got.area || "") : req.area, message_text: req.message_text === undefined ? String(got.message_text || "") : req.message_text, created_at: req.created_at === undefined ? (got.created_at || null) : req.created_at };
  }
  const pc = await partnerCard(partner.id);
  // v51: a studio's "mañana a las 10" is an offer for TOMORROW. Selvarrosa wrote
  // exactly that on 6 Sept and David was told "10:00 today" (already past).
  // v204 review: a queued offer carries the day its studio meant, worked out
  // from when it wrote (studioWordDay), and its "mañana" is not read again now.
  const offerDay = opts.fromQueue && opts.dayHint ? "" : offerDayFromText(freeText, L);
  // v119: never echo req.day1 here. It holds the word the customer typed, and
  // a word like "tomorrow" ages: Nell asked on Monday night for tomorrow, and
  // on Tuesday morning both offers still said "Tomorrow", pointing her at
  // Wednesday for a booking that was two hours away. dayLabelFor resolves the
  // real date the same way dispatch-studios does for the studios, and returns
  // "" rather than a stale word when it cannot, so we say "that day" instead of
  // naming the wrong one.
  const day = opts.dayHint || offerDay || dayLabelFor(req.day1, req.message_text, L) || (L === "es" ? "ese día" : "that day");
  // v102: only say "instead of" when it really is instead of. 17:00 offered
  // against a 13-18 band is the thing they asked for, not a compromise.
  // v204: offerFitsDay and offerFitsTime replace offerMatchesAsk here. They
  // compare dates rather than the words "Hoy" and "Today", read "as soon as
  // possible from 12:00" as a window, and take "Flexible" as any hour.
  const now = new Date();
  const dayOk = offerFitsDay(offerDay, req.day1, req.message_text, now, opts.dayHint || "");
  const fits = !!opts.ownOption || (dayOk && offerFitsTime(time, req.time1, req.message_text));
  const slotAt = offerSlotAt(time, offerDayDate(offerDay, opts.dayHint || "", req.day1, req.message_text, now));
  if (slotAt !== null) noteUntil = new Date(slotAt).toISOString();
  const askedDate = resolveRequestDate(req.day1, req.message_text, now);
  const sameDayReq = isSameDayReq(req) || (!!askedDate && askedDate.getTime() === madridMidnight(now).getTime());
  // v204: never a slot that starts in under 45 minutes, or one that has gone.
  // Nell (#90) asked at 22:41 for the next morning and at 09:56 was sent Calma
  // at 10:00, four minutes away. Nobody books, dresses and crosses Madrid in
  // four minutes, and a studio left holding a room for an offer that could not
  // be taken stops answering us.
  if (slotAt !== null && slotAt - now.getTime() < OFFER_LEAD_MS) {
    console.log(`[wa] offer withheld: ${partner.business_name} ${time} starts in under 45 minutes, req=${req.id}`);
    await toStudio(`Gracias. Las ${time} quedan demasiado cerca para que ${who} lo confirme a tiempo, así que no le guardéis el hueco. Si tenéis algo más tarde, decídmelo por aquí.`,
      `Queda demasiado cerca para que lo confirme a tiempo, así que no le guardéis el hueco. Si tenéis algo más tarde, decídmelo por aquí.`);
    await logEvent(clientNum || "web", "offer_withheld_too_soon", { request_id: req.id, studio: partner.business_name, time, minutes: Math.round((slotAt - now.getTime()) / 60e3) });
    return "withheld_too_soon";
  }
  // v122 (24 Sept): an offer that misses the window the customer asked for does
  // not go to the customer at all. It goes back to the studio.
  //
  // Javier asked for today between 13:00 and 18:00 on 19 September. He was sent
  // seven offers: 11:00, 20:00, 03:00, 14:00 today, 15:00 tomorrow, 15:00 today.
  // Three in the morning. He never answered one of them. Manas asked for the
  // evening and was offered 11:45. Alvaro asked for anything from 12:00 and got
  // three offers all labelled "instead of". Every one of them went silent, and
  // in nine days not a single offer that carried "instead of" was ever accepted.
  //
  // The old behaviour computed the mismatch, glued "instead of" onto the message
  // and sent it anyway. `asked` above is exactly that label. We have the answer
  // already; we were just choosing to ignore it and let the customer do the
  // filtering. Now the studio does, which is where the knowledge is.
  //
  // Same-day is the one exception: when someone wants a massage today, a slot an
  // hour outside their window is still worth showing, because the alternative is
  // nothing at all today.
  // v122: one live offer at a time. Javier had six sent to him inside 30 hours,
  // each one a fresh "Does that work?" about a different studio and a different
  // hour. That does not read as helpful, it reads as noise, and he answered
  // none of them. If there is already an offer in front of this customer that
  // they have not answered, the new one waits.
  // v204: except when the live one is outside their window and this one is
  // inside it. That is better news, and it goes straight to them.
  const liveOffer = cs.step === "await_offer" && cs.data.offer && Number(cs.data.offer.request) === Number(req.id);
  const betterThanLive = !!liveOffer && !!cs.data.offer.miss && fits;
  if (liveOffer && String(cs.data.offer.row) !== String(rowId) && !betterThanLive) {
    console.log(`[wa] offer queued: ${partner.business_name} ${time}, ${req.first_name} still has ${cs.data.offer.studio} ${cs.data.offer.time} open`);
    await toStudio(`Gracias, apuntado: ${time}. ${Who} está mirando ahora otra propuesta, así que no le guardéis el hueco todavía. Os digo algo en cuanto conteste.`,
      `Está mirando ahora otra propuesta, así que no le guardéis el hueco todavía. Os digo algo en cuanto conteste.`);
    await logEvent(clientNum, "offer_queued_behind_live", { request_id: req.id, studio: partner.business_name, time, live: cs.data.offer.studio });
    return "queued";
  }
  if (!fits && !sameDayReq) {
    console.log(`[wa] offer withheld: ${partner.business_name} ${time} misses ${req.day1} ${req.time1} for req=${req.id}`);
    // v212: the day and window in Spanish, never raw time1 ("Afternoon
    // (13-18)", "2pm"), and a wrong day said as such.
    // v212 review: a day nobody could read ("Flexible") is never "ese día",
    // and a window nobody could read is "a otra hora", not "lo quiere el
    // lunes, así que las 19:00 se le quedan fuera". The template form leaves
    // out the client, the day and the hour, which its opener already gives.
    const dayW = studioDayEs(req);
    const span = studioBandEs(req);
    const wantEs = [dayW, span].filter(Boolean).join(" ");
    const q = span.startsWith("a las ") ? "¿Podéis a esa hora?" : "¿Tenéis algo en esa franja?";
    const missText = !dayOk
      ? (dayW
        ? `${Who} lo quiere ${wantEs}. ¿Tenéis algo ese día? Si no, no pasa nada.`
        : `De momento no se lo propongo a ${who}, así que no hace falta que le guardéis el hueco. Si cambia algo, os escribo.`)
      : span
        ? `${Who} lo quiere ${wantEs}, así que las ${time} se le quedan fuera. ${q} Si no, no pasa nada.`
        : `${Who} lo quiere ${dayW ? dayW + " " : ""}a otra hora, así que las ${time} no le encajan. ¿Tenéis otra? Si no, no pasa nada.`;
    const missShort = !dayOk
      ? (dayW
        ? `Lo quiere ${wantEs}. ¿Tenéis algo ese día? Si no, no pasa nada.`
        : `De momento no se lo propongo, así que no hace falta que le guardéis el hueco. Si cambia algo, os escribo.`)
      : span
        ? `Lo quiere ${span}, así que esa hora se le queda fuera. ${q} Si no, no pasa nada.`
        : `Esa hora no le encaja. ¿Tenéis otra? Si no, no pasa nada.`;
    await toStudio(`Gracias. ${missText}`, missShort);
    await logEvent(clientNum, "offer_withheld_mismatch", { request_id: req.id, studio: partner.business_name, offered: time, asked: `${req.day1 || ""} ${req.time1 || ""}`.trim() });
    return "withheld_mismatch";
  }
  // v204 (12 Oct): the same-day exception no longer leads with the miss. Andy
  // (#77) asked for 18:00 to 21:00 and four minutes later had Calma at 16:00
  // "instead of"; Manas (#82) asked for the evening and got Selvarrosa at 11:45.
  // Neither answered. On a busy day a studio inside the window often answers a
  // few minutes later, so an out-of-window time now waits up to 15 minutes for
  // one (releaseHeldOffers, on the settle sweep). If none comes, the best of
  // the held ones goes out with an honest line: "Nobody has 18:00 to 21:00
  // yet; Calma can do 17:00."
  if (!fits && !opts.fromQueue) {
    const hSpan = studioBandEs(req);
    // v212 review: an exact hour asked for is not a "franja".
    const hWhere = hSpan.startsWith("a las ") ? "a esa hora" : "en esa franja";
    await toStudio(`Gracias, apunto las ${time}. ${Who} lo quiere hoy ${hSpan ? `${hSpan}. Si en unos minutos no sale nada ${hWhere}` : "a otra hora. Si en unos minutos no sale nada más cerca"}, le propongo la vuestra. De momento no le guardéis el hueco.`);
    await logEvent(clientNum || "web", "offer_held_window", { request_id: req.id, row: rowId, studio: partner.business_name, partner_id: partner.id, time, day: opts.dayHint || offerDay || null, slot_at: slotAt !== null ? new Date(slotAt).toISOString() : null });
    return "held_window";
  }
  // v210 (16 Oct): a held customer's offers pass the same checks as anyone's
  // first. Kamiraku's autoresponder listed its opening hours, was read as an
  // 11:00 offer outside Brandon's 13:00 to 18:00, and the studio was told
  // "Lo confirmo con Brandon". Only an offer that would reach a customer
  // reaches Jordan as held.
  if (clientNum && heldNum(clientNum)) {
    await toStudio(`Gracias. Lo confirmo con ${who} y os digo algo en cuanto me conteste.`, `Lo estoy confirmando con ${who} y os digo algo en cuanto me conteste.`);
    await logEvent(clientNum, "offer_held_for_jordan", { request_id: req.id, studio: partner.business_name, time });
    await founderCard(`⏸ ${partner.business_name} offers ${time} for ${req.first_name || "the customer"} · #${req.id} (held for you)`, {
      badge: "OFFER HELD FOR YOU",
      title: `${partner.business_name} can do ${time}`,
      paras: [`You asked that nothing goes to ${req.first_name || "this customer"} automatically, so nothing was sent to them. The studio was told we are checking with the client. Tell ${req.first_name || "them"} yourself, or reply below.`],
      quote: freeText, waNum: clientNum, studioNum: studioFrom, studioName: partner.business_name,
    });
    return "held";
  }
  // v204: "offered" only once something is really going to the customer. It
  // used to be set before the checks above, so a withheld or queued time
  // still marked the request as offered.
  await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&stage=neq.confirmed`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
    body: JSON.stringify({ stage: "offered", studio_reply: `${partner.business_name}: ${freeText}`.slice(0, 500), stage_updated_at: new Date().toISOString() }),
  });
  // v110 (Jordan, 19 Sept): "before we offer pricing we must confirm with the
  // studio there price after our potential discount." The v81 line took the
  // listed price off partners and multiplied it by the discount. Nobody had
  // confirmed that number for this booking, so it could be wrong at the till,
  // and it is gone. The only price that reaches a customer is one this studio
  // wrote: the figure stored on the dispatch row, or one in the very message
  // that carried this offer. No confirmed price means no price in the message.
  let priceLine = "";
  let priceNum = 0;
  try {
    const dsp = await dispatchRowFor(req.id, partner.id, studioFrom);
    const quoted = Number((dsp && dsp.quoted_price) || parseQuotedPrice(freeText) || 0);
    if (quoted > 0) {
      // whatsapp_requests has no duration column; 60 is the standard booking and
      // the length the studios quote against.
      const pct = dsp && dsp.discount_pct ? Number(dsp.discount_pct) : 0;
      // "Massage Club rate" only when this same studio also confirmed the
      // discount in writing. A studio that gave a price and ducked the discount
      // gets the plain line: "we asked and they said no" makes us look weak.
      priceLine = COPY[L].priceLine(quoted, 60, pct > 0);
      priceNum = quoted;
    }
  } catch (e) { console.log("[wa] price line skipped", String(e)); }
  // v182: no confirmed figure means the studio's listed price, labelled as such.
  if (!priceLine) {
    const lp = await listedPrice(partner.id, String(req.service_name || ""));
    if (lp) { priceLine = listedPriceLine(L, lp); priceNum = lp.price; }
  }
  // v204: when the price is above the range this customer was quoted, say so
  // in the offer. The opener says 50 to 60 EUR on some days, and the studio that
  // answers most lists 85. Willy (#107) tapped "Mejor precio" after seeing
  // Sinergia38 at 59 and Calma at 85, and the offer that came was Calma with no
  // price at all. The range is read off what we actually sent them.
  let above = "";
  if (priceNum > 0 && clientNum) {
    const qr = await quotedRangeFor(clientNum);
    if (qr && priceNum > qr.hi) above = OFFER_COPY[L].above(qr.lo, qr.hi);
  }
  // v204: how far, when it is far. Garry (#88) said Tres Cantos and was offered
  // Calma in Chamberí; Willy (#107) asked from Orcasitas and got Chamberí too.
  // request_dispatch.km is written by dispatch-studios v40 (migration
  // 20261012_dispatch_km.sql). select=* so a database without the column yet
  // simply has no distance line.
  let far = "";
  try {
    const kr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}&select=*`, { headers: H() });
    const kd = (((await kr.json().catch(() => [])) || [])[0] || {}) as Record<string, unknown>;
    far = kd.km === null || kd.km === undefined ? "" : offerFar(Number(kd.km), String(req.area || ""), L);
  } catch (_e) { /* no distance line */ }
  // v199: the customer has to be able to tap Yes. WhatsApp buttons when their
  // 24 hour window is open; otherwise an email whose button opens the offer on
  // book.massageclub.io with the same Yes and No. If neither can reach them the
  // offer is held and Jordan hears it, because an offer nobody can see is how a
  // studio ends up holding a slot for nobody.
  const offerText = offerBody(L, {
    lead: opts.lead || (betterThanLive ? OFFER_COPY[L].better : ""),
    name: String(req.first_name || "").trim(), studio: partner.business_name, where: pc.neighbourhood, time, day,
    band: fits ? "" : (dayOk ? windowText(askWindow(req.time1, req.message_text), L) : OFFER_COPY[L].anyToday),
    svc: trSvcLow(req.service_name || "massage", L), price: priceLine, above, address: pc.address, far,
  });
  let offerVia = "none";
  if (clientNum && await waWindowOpen(clientNum) && await sendButtons(clientNum, offerText, offerButtons(L, rowId, time))) offerVia = "whatsapp";
  if (offerVia === "none") {
    let email = String(req.contact_email || "").trim();
    if (!email && req.contact_email === undefined) {
      const er = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&select=contact_email`, { headers: H() });
      email = String(((await er.json().catch(() => [])) || [])[0]?.contact_email || "").trim();
    }
    if (email && await emailOffer({ ...req, contact_email: email }, L, rowId, partner.business_name, time, day, pc.address, priceLine)) offerVia = "email";
  }
  // v204 review (12 Oct): the offer this one replaces ("Better news"). Its
  // studio was told "Lo confirmo con ... y os digo algo", and once the session
  // points at the new row nothing (the follow-up, the lapse) ever comes back to
  // it, so if the customer ignores both it holds the slot for nobody. It is
  // told not to hold it; the row stays open, so "Another time" can still bring
  // it back.
  const replaced = betterThanLive && offerVia !== "none" && String(cs.data.offer?.row || "") !== String(rowId) ? { ...cs.data.offer } : null;
  if (clientNum) {
    cs.data.prevStep = cs.step;
    cs.step = "await_offer";
    // v204: sentAt and slotAt drive the one follow-up and the lapse
    // (chaseOffers); via says whether WhatsApp buttons carried it; miss marks a
    // time outside the window, which a time inside it may replace.
    cs.data.offer = { row: rowId, time, studio: partner.business_name, request: req.id, day: opts.dayHint || offerDay || null, sentAt: new Date().toISOString(), slotAt: slotAt !== null ? new Date(slotAt).toISOString() : null, via: offerVia, miss: !fits };
    if (offerVia !== "none") {
      const prev: string[] = cs.data.offersShown && Number(cs.data.offersShown.request) === Number(req.id) ? (cs.data.offersShown.rows || []).map(String) : [];
      cs.data.offersShown = { request: req.id, rows: [...prev.filter((x) => x !== String(rowId)), String(rowId)].slice(-12) };
    }
    await saveSession(cs);
  }
  if (offerVia === "none") {
    await founderCard(`⚠️ ${partner.business_name} offered ${time} but ${req.first_name || "the customer"} cannot see it · #${req.id}`, {
      badge: "OFFER NOT DELIVERED", title: `${partner.business_name} can do ${time} ${day}, and the customer cannot be reached`,
      paras: [`WhatsApp is outside its 24 hour window and there is no email on file, so the Yes button could not be sent. Nothing is confirmed. The studio was told it is not booked yet.`],
      quote: freeText, waNum: clientNum, studioNum: studioFrom, studioName: partner.business_name,
    });
  }
  // v81 (Jordan, 12 Sept): his own words for this moment. The old line asked the
  // studio to hold the slot for 15 minutes, which is a promise about the
  // customer that we cannot make on their behalf. This one names the customer
  // and commits only to coming back.
  // v212: three cases. Unreachable: say so, and that the slot need not be
  // held (what the OFFER NOT DELIVERED card tells Jordan). A queued time shown
  // later: which time and day, since it arrives out of the blue. Otherwise
  // Jordan's own v81 words.
  const queuedDay = slotAt !== null ? studioDayAt(slotAt) : studioDayEs(req);
  if (offerVia === "none") {
    await toStudio(`${opts.fromQueue ? "Hola de nuevo." : "Vale, gracias."} Ahora mismo no consigo localizar a ${who}, así que todavía no está reservado y no hace falta que le guardéis el hueco. Si me contesta, os escribo enseguida.`,
      `Ahora mismo no consigo localizarle, así que todavía no está reservado y no hace falta que le guardéis el hueco. Si me contesta, os escribo enseguida.`);
  } else if (opts.fromQueue) {
    await toStudio(`Hola de nuevo. Le acabo de pasar a ${who} vuestra hora${queuedDay ? " " + deDay(queuedDay) : ""} a las ${time}. Todavía no está reservado: os digo algo en cuanto conteste, y si mientras tanto se os ha ocupado, decídmelo.`,
      `Le acabo de pasar vuestra hora. Todavía no está reservado: os digo algo en cuanto conteste, y si mientras tanto se os ha ocupado, decídmelo.`);
  } else await toStudio(`Vale, gracias. Lo confirmo con ${who} y os digo algo en cuanto me conteste.`);
  if (replaced?.row) {
    const or = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${encodeURIComponent(String(replaced.row))}&outcome=in.(pending,accepted)&select=id,partner_id,phone,offered_time`, { headers: H() });
    const old = ((await or.json().catch(() => [])) || [])[0] || null;
    if (old?.phone && !(FAKE_NUM_RE.test(clientNum) && !TEST_NAME_RE.test(String(replaced.studio || "")))) {
      const t0 = String(old.offered_time || replaced.time || "");
      // v212: the time once, the day named, no clipped opener, no signature.
      const d0 = replaced.slotAt ? studioDayAt(Date.parse(String(replaced.slotAt))) : studioDayEs(req);
      const ref0 = [deDay(d0), /^\d{1,2}:\d{2}$/.test(t0) ? `a las ${t0}` : ""].filter(Boolean).join(" ");
      await studioNoteSure({ request_id: Number(req.id), partner_id: String(old.partner_id || ""), phone: String(old.phone), text: `Hola de nuevo. ${req.first_name ? "A " + req.first_name : "Al cliente"} le ha salido otra opción más cerca de la hora que pidió, así que no hace falta que le guardéis el hueco${ref0 ? " " + ref0 : ""}. Si al final lo prefiere, os escribo enseguida.`, short: `Le ha salido otra opción más cerca de la hora que pidió, así que no hace falta que le guardéis el hueco. Si al final lo prefiere, os escribo enseguida.`, time: /^\d{1,2}:\d{2}$/.test(t0) ? t0 : "", until: replaced.slotAt || null });
    }
  }
  await logEvent(clientNum, "offer_forwarded", { request_id: req.id, studio: partner.business_name, time, fits, from_queue: !!opts.fromQueue, far: !!far, above: !!above, replaced: replaced?.row || null });
  await founderCard(`⏰ ${partner.business_name} offers ${time} · #${req.id}`, {
    badge: "OFFER FORWARDED",
    title: `${partner.business_name} can do ${time} ${day}`,
    paras: [`Sent to ${req.first_name || "the customer"} ${offerVia === "email" ? "by email, with a Yes / No page" : "with Yes / Another time / Closer or cheaper buttons"}. Nothing is booked until they tap Yes; then the studio gets the confirmation in writing and the other studios are stood down.`],
    quote: freeText, waNum: clientNum, studioNum: studioFrom, studioName: partner.business_name,
  });
  return offerVia;
}

// v212: studioNote (plain text through dispatch-studios' send op) is gone. Its
// one caller, a queued offer shown later, now uses studioNoteSure, because
// plain text to a studio whose 24 hours have passed is dropped by Meta.
// v204 review (12 Oct): a note a studio has to get, because it is holding a
// slot on our word: the lapse's "liberad el hueco", "Another time", an offer
// replaced by a better one, a queued offer shown later. Plain text is dropped
// by Meta without a word once the studio's 24 hours have passed (an offer made Monday at 10:00
// for Tuesday 18:00 lapses Tuesday at 17:15), and it simply gives up outside
// 09:00 to 21:00. This goes through dispatch-studios' studio_note op (v42),
// which falls back to the aviso templates (v48: aviso_centro_v2, then v1 only
// with a real hour), and a note refused for the
// hour, the studio's own hours or Jordan's outreach pause is queued
// (studio_note_queued) for flushStudioNotes on the settle sweep, until `until`
// (the slot) has passed. "sent", "queued" or "failed".
async function studioNoteSure(n: { request_id: number; partner_id: string; phone: string; text: string; short: string; time: string; until?: string | null; key?: string }): Promise<string> {
  const phone = digitsOf(n.phone);
  if (!phone) return "failed";
  const h = mcMadridHour();
  let how = "hours";
  if (h >= 9 && h < 21) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-studios?key=${OPS_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio_note: { request_id: n.request_id, phone, text: n.text, short: n.short, time: n.time } }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) return "sent";
      how = String(j?.how || "failed");
      console.log("[wa] studio note not sent", phone, how, j?.why || res.status);
    } catch (e) { console.log("[wa] studio note failed", String(e)); how = "failed"; }
  }
  if (!["hours", "skipped", "paused"].includes(how)) return "failed";
  if (n.key) return "queued";
  await logEvent(phone, "studio_note_queued", { key: crypto.randomUUID(), request_id: n.request_id, partner_id: n.partner_id, phone, text: n.text.slice(0, 600), short: n.short.slice(0, 300), time: n.time, until: n.until || null, why: how });
  return "queued";
}
// v204 review: the queued notes, inside studio hours, oldest first. One that
// goes, or whose slot has passed, or that fails for any reason but the hour,
// is closed with studio_note_done; nothing is tried after 24 hours.
async function flushStudioNotes(): Promise<number> {
  const h = mcMadridHour();
  if (h < 9 || h >= 21) return 0;
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const er = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?event=in.(studio_note_queued,studio_note_done)&created_at=gte.${since}&order=created_at.asc&limit=300&select=event,meta`, { headers: H() });
  const evs = await er.json().catch(() => []);
  const open = new Map<string, any>();
  for (const e of Array.isArray(evs) ? evs : []) {
    const k = String(e?.meta?.key || "");
    if (!k) continue;
    if (e.event === "studio_note_done") open.delete(k); else open.set(k, e.meta);
  }
  let n = 0;
  for (const [key, m] of open) {
    const gone = m.until && Date.parse(String(m.until)) <= Date.now();
    const r = gone ? "gone" : await studioNoteSure({ request_id: Number(m.request_id || 0), partner_id: String(m.partner_id || ""), phone: String(m.phone || ""), text: String(m.text || ""), short: String(m.short || ""), time: String(m.time || ""), key });
    if (r === "queued") continue;
    await logEvent(String(m.phone || ""), "studio_note_done", { key, request_id: m.request_id, result: r });
    if (r === "sent") n++;
  }
  return n;
}
// v204: the price range this customer was actually told, read off the messages
// we sent them (the opener, a price answer), newest first. None found, no line.
async function quotedRangeFor(phone: string): Promise<{ lo: number; hi: number } | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${digitsOf(phone)}&direction=eq.out&order=created_at.desc&limit=40&select=body`, { headers: H() });
    const rows = await r.json().catch(() => []);
    for (const m of Array.isArray(rows) ? rows : []) { const q = quotedRangeIn(String(m?.body || "")); if (q) return q; }
  } catch (_e) { /* no range, no line */ }
  return null;
}
const OPEN_STAGES = ["new", "dispatching", "studio_asked", "studio_replied", "offered", "bidding"];

// v204: the times studios offered on this request that the customer has not
// been shown, best first. Since v122 only one offer is in front of a customer
// at a time, and the ones that arrived behind it were queued and never shown:
// Pedro (#78) had Calma at 13:00, inside his window, queued behind Centro
// Aloha's 16:00. "Another time" skips the time just turned down; "Closer or
// cheaper" keeps only what is measurably one or the other. A time withheld for
// missing the window on another day stays withheld, and nothing under 45
// minutes away is offered.
// v204 review: mode "any" keeps every time, for "Closer or cheaper" when none
// of them is either. Each row comes back with dayHint, the day its studio's own
// "hoy" or "mañana" meant when it wrote (studioWordDay), not seen from now.
async function queuedOffers(req: any, declined: any, mode: "time" | "alt" | "any", L: string): Promise<any[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${Number(req.id)}&id=neq.${encodeURIComponent(String(declined.id))}&offered_time=not.is.null&outcome=in.(pending,accepted)&customer_answer=is.null&select=*`, { headers: H() });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return [];
  const now = new Date();
  const asked = resolveRequestDate(req.day1, req.message_text, now);
  const sameDay = isSameDayReq(req) || (!!asked && asked.getTime() === madridMidnight(now).getTime());
  const priced = async (x: any) => {
    if (Number(x?.quoted_price) > 0) return Number(x.quoted_price);
    const lp = x?.partner_id ? await listedPrice(String(x.partner_id), String(req.service_name || "")) : null;
    return lp ? lp.price : null;
  };
  const kmOf = (x: any) => (x?.km === null || x?.km === undefined || !Number.isFinite(Number(x.km)) ? null : Number(x.km));
  const out: any[] = [];
  for (const x of rows) {
    const t = String(x.offered_time || "");
    const hint = rowDayLabel(x, L, now);
    const od = hint ? "" : offerDayFromText(String(x.reply_text || ""), L);
    const slot = offerSlotAt(t, offerDayDate(od, hint, req.day1, req.message_text, now));
    if (slot !== null && slot - now.getTime() < OFFER_LEAD_MS) continue;
    const fits = x.channel === "email" || (offerFitsDay(od, req.day1, req.message_text, now, hint) && offerFitsTime(t, req.time1, req.message_text));
    if (!fits && !sameDay) continue;
    if (mode === "time" && t === String(declined.offered_time || "")) continue;
    out.push({ ...x, price: await priced(x), km: kmOf(x), dayHint: hint });
  }
  const d = { price: await priced(declined), km: kmOf(declined) };
  return (mode === "alt" ? out.filter((x) => offerBetterAlt(x, d)) : out).sort(offerRank);
}
// v204: put the best queued offer in front of the customer. True once one went
// (or could not reach them at all, which forwardOffer has already told Jordan).
async function showNextOffer(req: any, declined: any, mode: "time" | "alt" | "any", L: string, lead = OFFER_COPY[L].next): Promise<boolean> {
  for (const x of (await queuedOffers(req, declined, mode, L)).slice(0, 3)) {
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(String(x.partner_id || ""))}&select=id,business_name&limit=1`, { headers: H() });
    const p = ((await pr.json().catch(() => [])) || [])[0];
    if (!p) continue;
    const viaPhone = x.channel === "email" || x.channel === "call" ? "" : digitsOf(String(x.phone || ""));
    const res = await forwardOffer(req, { id: String(p.id), business_name: String(p.business_name || "") }, String(x.id), String(x.offered_time), String(x.reply_text || `Sí, a las ${x.offered_time}`), viaPhone, { fromQueue: true, ownOption: x.channel === "email", lead, dayHint: x.dayHint || undefined });
    if (["whatsapp", "email", "none", "held"].includes(res)) return true;
  }
  return false;
}
// v204: "if the request allows". dispatch-studios' own widen sweep skips every
// request a studio has offered a time on, so a customer who turned the only
// offer down was never widened. Once per request (widened_at), only for a day
// that has not gone, never with under 90 minutes of the window left, and only
// in studio hours, because dispatch-studios defers anything outside them and the
// claim would be spent on nothing. A second wave there skips its stale and
// too-late checks, so they are made here.
async function widenRequest(req: any): Promise<boolean> {
  if (req.widened_at || !["studio_asked", "studio_replied", "offered"].includes(String(req.stage || ""))) return false;
  const now = new Date();
  const h = mcMadridHour();
  if (h < 9 || h >= 20) return false;
  const d = resolveRequestDate(req.day1, req.message_text, now);
  const today = madridMidnight(now);
  if (!d || d.getTime() < today.getTime()) return false;
  if (d.getTime() === today.getTime()) {
    const w = askWindow(req.time1, req.message_text);
    if (Math.min(w && !askUnread(w) ? w[1] : 21 * 60, 21 * 60) - madridMinAt(now.getTime()) < 90) return false;
  }
  const claim = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(req.id)}&widened_at=is.null`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({ widened_at: now.toISOString() }),
  });
  const got = await claim.json().catch(() => []);
  if (!Array.isArray(got) || !got.length) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-studios?key=${OPS_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: Number(req.id), widen: true }),
    });
    console.log(`[wa] widen request=${req.id} status=${res.status} ${(await res.text()).slice(0, 200)}`);
  } catch (e) { console.log("[wa] widen failed", String(e)); }
  return true;
}
// v204: "cancel" with an offer on the table. The request is closed and the
// customer told plainly; every studio still holding it hears so from
// dispatch-studios' chase sweep, inside its own hours, which is the rule for a
// customer who cancels. Nothing is said to a studio from here.
// v204 review: that sweep (dispatch-studios v42) now reaches every open row,
// including a studio already chased for its hour, and emails a studio it has
// no WhatsApp for; before, both were stood down without a word. The muted and
// job-seeker closures ride on the same sweep.
async function cancelOffered(s: Session, from: string, L: string, text: string) {
  const reqId = Number(s.data.offer?.request || 0);
  if (reqId) {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${reqId}&stage=not.in.(confirmed,cancelled,dismissed,no_show)`, {
      method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ stage: "cancelled", customer_flag: "cancelled", stage_note: "Cancelled by the customer at the offer step", stage_updated_at: new Date().toISOString() }),
    });
  }
  if (s.data.offer?.row) await patchDispatch(String(s.data.offer.row), { customer_answer: "no", customer_answered_at: new Date().toISOString() });
  await sendText(from, OFFER_COPY[L].cancelled);
  s.step = "done"; s.data.offer = null; await saveSession(s);
  await logEvent(from, "offer_cancelled", { request_id: reqId || null });
  await notifyJordanWa(`${s.wa_name || "+" + digitsOf(from)} cancelled #${reqId || "?"} at the offer step: ${text.slice(0, 120)}. The studios still holding it are told by the chase sweep.`, from);
}

// v204: the other half of the same-day hold in forwardOffer. Fifteen minutes
// after the first out-of-window time on a request was held, if nothing inside
// the window has gone to the customer since, the best held time goes out with
// the honest line. Best is the closest to the window, then the cheapest, and
// only one forwardOffer would still send (45 minutes or more away).
// v204 review: `only` (a canary phone prefix, see the settle op) limits the
// sweep to those numbers. The same goes for chaseOffers and watchRequests.
async function releaseHeldOffers(only = ""): Promise<number> {
  const now = Date.now();
  const since = new Date(now - 6 * 3600e3).toISOString();
  const er = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?event=in.(offer_held_window,offer_held_released)&created_at=gte.${since}&order=created_at.asc&limit=500&select=event,meta,created_at`, { headers: H() });
  const evs = await er.json().catch(() => []);
  const held = new Map<string, Array<{ at: number; meta: any }>>();
  for (const e of Array.isArray(evs) ? evs : []) {
    const id = String(e?.meta?.request_id || "");
    if (!id) continue;
    // Oldest first, so a release settles every hold before it and a later hold
    // (after the customer turned the released one down) starts a new wait.
    if (e.event === "offer_held_released") { held.delete(id); continue; }
    held.set(id, [...(held.get(id) || []), { at: Date.parse(String(e.created_at || "")), meta: e.meta || {} }]);
  }
  let n = 0;
  for (const [id, list] of held) {
    if (!list.length || now - Math.min(...list.map((x) => x.at)) < OFFER_HOLD_MS) continue;
    const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(id)}&select=*`, { headers: H() });
    const req = ((await rq.json().catch(() => [])) || [])[0] || null;
    const phone = digitsOf(String(req?.client_phone || ""));
    if (only && !phone.startsWith(only)) continue;
    const done = (why: string, extra: Record<string, unknown> = {}) => logEvent(phone || "web", "offer_held_released", { request_id: id, why, ...extra });
    if (!req || !OPEN_STAGES.includes(String(req.stage || ""))) { await done("request closed"); continue; }
    const s = phone ? await getSession(phone) : null;
    if (s && s.step === "muted") { await done("muted"); continue; }
    if (s && s.step === "await_offer" && Number(s.data.offer?.request) === Number(id)) { await done("an offer is already with them"); continue; }
    const ids = [...new Set(list.map((x) => String(x.meta?.row || "")).filter(Boolean))];
    const dr = ids.length ? await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=in.(${ids.map(encodeURIComponent).join(",")})&offered_time=not.is.null&outcome=in.(pending,accepted)&customer_answer=is.null&select=*`, { headers: H() }) : null;
    const rows = dr ? await dr.json().catch(() => []) : [];
    const w = askWindow(req.time1, req.message_text);
    const today = madridMidnight(new Date(now)).getTime();
    const cands: Array<{ x: any; meta: any; miss: number; price: number | null }> = [];
    for (const x of Array.isArray(rows) ? rows : []) {
      const meta = list.find((y) => String(y.meta?.row) === String(x.id))?.meta || {};
      const slot = meta.slot_at ? Date.parse(String(meta.slot_at)) : NaN;
      if (Number.isFinite(slot) && slot - now < OFFER_LEAD_MS) continue;
      const otherDay = Number.isFinite(slot) && madridMidnight(new Date(slot)).getTime() !== today;
      const lp = Number(x.quoted_price) > 0 ? null : await listedPrice(String(x.partner_id || ""), String(req.service_name || ""));
      cands.push({ x, meta, miss: offerMissBy(String(x.offered_time || ""), w) + (otherDay ? 24 * 60 : 0), price: Number(x.quoted_price) > 0 ? Number(x.quoted_price) : (lp ? lp.price : null) });
    }
    cands.sort((a, b) => a.miss - b.miss || (a.price ?? 1e9) - (b.price ?? 1e9));
    const best = cands[0];
    if (!best) { await done("nothing left in time"); continue; }
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(String(best.x.partner_id || ""))}&select=id,business_name&limit=1`, { headers: H() });
    const p = ((await pr.json().catch(() => [])) || [])[0];
    if (!p) { await done("studio not found"); continue; }
    const viaPhone = best.x.channel === "email" || best.x.channel === "call" ? "" : digitsOf(String(best.x.phone || ""));
    // v204 review: the day comes from the slot worked out when the time was
    // held, named as seen from now, not from the studio's "mañana" read again.
    const heldSlot = best.meta.slot_at ? Date.parse(String(best.meta.slot_at)) : NaN;
    const RL = s?.data.lang === "es" || req.languages === "es" ? "es" : "en";
    const dayHint = Number.isFinite(heldSlot) ? offerDayLabel(madridMidnight(new Date(heldSlot)), new Date(now), RL) : (best.meta.day || "");
    const res = await forwardOffer(req, { id: String(p.id), business_name: String(p.business_name || "") }, String(best.x.id), String(best.x.offered_time), String(best.x.reply_text || `Sí, a las ${best.x.offered_time}`), viaPhone, { fromQueue: true, ownOption: best.x.channel === "email", dayHint: dayHint || undefined });
    await done("released", { row: String(best.x.id), result: res });
    if (res === "whatsapp" || res === "email") n++;
  }
  return n;
}

// v204 (12 Oct, Jordan: "Yes to the follow-up messages in change 1"). One
// follow-up on an offer nobody answered, then an honest lapse. Eight of the
// eleven customers given a real studio time since 14 Sept went quiet and were
// never written to again (#78, #81, #82, #84, #88, #90, #96, #107). Javier (#96)
// was offered Calma at 19:00 at 18:11 on 2 Oct; the slot passed with no word to
// him or to Calma, and the next message, typed by hand the day after, was "la
// cita de las 19:00 ya pasó".
//
// The diary is the session (offer.sentAt, offer.slotAt, offer.chasedAt) plus
// funnel_events offer_chased and offer_lapsed, so a session saved over by a
// stale copy still cannot be chased twice. offerSchedule says when; this says
// whether: never to a muted session (it is never at await_offer), never after
// a tap or anything they wrote back, once per request, and on WhatsApp only
// inside the 24 hour window. Outside it the emailed offer (v199) carries it,
// and the lapse still frees the studio either way.
async function chaseOffers(only = ""): Promise<{ chased: number; lapsed: number }> {
  const out = { chased: 0, lapsed: 0 };
  if (!OFFER_CHASE) return out;
  const now = Date.now();
  const since = new Date(now - 7 * 86400e3).toISOString();
  const sr = await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?step=eq.await_offer&updated_at=gte.${since}&order=updated_at.desc&limit=100&select=phone,step,data`, { headers: H() });
  const sessions = await sr.json().catch(() => []);
  if (!Array.isArray(sessions) || !sessions.length) return out;
  const er = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?event=in.(offer_chased,offer_lapsed)&created_at=gte.${since}&order=created_at.desc&limit=1000&select=event,meta`, { headers: H() });
  const evs = await er.json().catch(() => []);
  const chasedReq = new Set<string>(), lapsedRow = new Set<string>();
  for (const e of Array.isArray(evs) ? evs : []) {
    if (e?.event === "offer_chased") chasedReq.add(String(e?.meta?.request_id || ""));
    if (e?.event === "offer_lapsed") lapsedRow.add(String(e?.meta?.row || ""));
  }
  for (const srow of sessions) {
    const o = (srow?.data || {}).offer;
    const phone = digitsOf(String(srow?.phone || ""));
    if (!o || !o.row || !o.sentAt || o.change || !phone || (only && !phone.startsWith(only))) continue;
    // Jordan's own numbers and the friend testers never get a nudge. The fake
    // 3460000xxxx canary numbers do, so the sweep can be tested end to end.
    if (TEST_PHONES.includes(phone) || /^86\d*997$/.test(phone)) continue;
    const sent = Date.parse(String(o.sentAt));
    const slot = o.slotAt ? Date.parse(String(o.slotAt)) : NaN;
    if (!Number.isFinite(sent)) continue;
    const due = offerDue(now, offerSchedule(sent, Number.isFinite(slot) ? slot : null));
    if (due === "wait") continue;
    if (due === "lapse" && lapsedRow.has(String(o.row))) continue;
    if (due === "chase" && (o.chasedAt || chasedReq.has(String(o.request)))) continue;
    const dq = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${encodeURIComponent(String(o.row))}&select=id,request_id,partner_id,phone,offered_time,outcome,channel`, { headers: H() });
    const d = ((await dq.json().catch(() => [])) || [])[0] || null;
    if (!d || !["pending", "accepted"].includes(String(d.outcome || ""))) continue;
    const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(d.request_id)}&select=id,first_name,stage,languages,contact_email,day1,message_text,created_at,confirmed_day,confirmed_start`, { headers: H() });
    const req = ((await rq.json().catch(() => [])) || [])[0] || null;
    if (!req || !OPEN_STAGES.includes(String(req.stage || ""))) continue;
    const L = srow.data?.lang === "es" || req.languages === "es" ? "es" : "en";
    // v204 review: a test contact by name or email (CLAUDE.md: a name with
    // "test" or "prueba", Jordan's addresses, the test domains) on an ordinary
    // number gets no reminder and no lapse line; the studio is still let go.
    const testContact = TEST_NAME_RE.test(String(req.first_name || "")) || TEST_EMAIL_RE.test(String(req.contact_email || ""));
    if (due === "lapse") {
      if (await lapseOffer(phone, o, d, req, L, testContact)) { out.lapsed++; lapsedRow.add(String(d.id)); }
      continue;
    }
    if (testContact) continue;
    // A tap on any offer for this request, or anything they wrote after this
    // one went out, is an answer. A reminder on top of an answer is noise.
    const tq = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${Number(d.request_id)}&customer_answer=not.is.null&limit=1&select=id`, { headers: H() });
    const tapped = ((await tq.json().catch(() => [])) || []).length > 0;
    const lastIn = await lastInboundMs(phone);
    if (tapped || (lastIn !== null && lastIn > sent) || o.via !== "whatsapp") continue;
    // Marked before sending, so a failure cannot become a loop. The session is
    // read again first, so a tap that landed during the sweep is never undone.
    const cs = await getSession(phone);
    if (cs.step !== "await_offer" || String(cs.data.offer?.row || "") !== String(d.id)) continue;
    cs.data.offer = { ...cs.data.offer, chasedAt: new Date().toISOString() };
    await saveSession(cs);
    chasedReq.add(String(d.request_id));
    const open = await waWindowOpen(phone);
    await logEvent(phone, "offer_chased", { request_id: String(d.request_id), row: String(d.id), studio: o.studio, time: o.time, window_open: open });
    if (!open) continue;
    const dayW = Number.isFinite(slot) ? (offerRelDay(slot, now, L) || offerDayPhrase((L === "es" ? LONG_ES : LONG_EN).format(new Date(slot)), L)) : "";
    if (await sendButtons(phone, OFFER_COPY[L].chase(String(req.first_name || "").trim(), String(o.studio || ""), String(o.time || ""), dayW), offerButtons(L, String(d.id), String(o.time || "")))) out.chased++;
  }
  return out;
}
// v204: the slot is 45 minutes away (or the 15 minutes to decide are up) and
// nobody tapped. The row is closed as expired first (that is the guard: only
// one sweep can win it, and the Yes on the old buttons and on the offer page
// then says it has gone), the customer hears the truth in their open window,
// and the studio is told it is free, inside its hours. A fake 3460000xxxx
// canary only ever releases a test partner.
// v204 review: quiet is a test contact by name or email (CLAUDE.md): the slot
// is still let go, but nothing is sent to them.
async function lapseOffer(phone: string, o: any, d: any, req: any, L: string, quiet = false): Promise<boolean> {
  const up = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${encodeURIComponent(String(d.id))}&outcome=in.(pending,accepted)`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({ outcome: "expired" }),
  });
  const got = await up.json().catch(() => []);
  if (!Array.isArray(got) || !got.length) return false;
  await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(req.id)}&stage=eq.offered`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "studio_asked", stage_updated_at: new Date().toISOString() }) });
  const cs = await getSession(phone);
  if (cs.step === "await_offer" && String(cs.data.offer?.row || "") === String(d.id)) { cs.step = "done"; cs.data.offer = null; await saveSession(cs); }
  const first = String(req.first_name || "").trim();
  const time = String(o.time || d.offered_time || "");
  const open = !quiet && await waWindowOpen(phone);
  if (open) await sendText(phone, OFFER_COPY[L].lapse(first, String(o.studio || ""), time));
  // v212 (16 Oct): the client, the slot's own day and the hour, said once.
  // "Hola, sobre Brandon, 15:00:" read like a log line, "liberad el hueco, no
  // hace falta guardarlo" said the same thing twice, and "Gracias por responder
  // tan rápido" went out whatever the timing. The email is an email: who we
  // are, the full date, a sign-off.
  const ld = studioSlotDate(o.slotAt) || studioDate(req);
  const at = studioAtEs(time);
  const slotRef = [deDay(studioDayOf(ld)), at].filter(Boolean).join(" ");
  const note = `Hola, al final ${first || "el cliente"} no ha confirmado, así que podéis dar el hueco${slotRef ? " " + slotRef : ""} a otra persona. Gracias igualmente.`;
  const mailWho = first || "nuestro cliente";
  const fullRef = [studioDateFull(ld), at].filter(Boolean).join(" ");
  const subjRef = [deDay(studioDateFull(ld)), at].filter(Boolean).join(" ");
  const mail = `${studioMailHead(String(o.studio || ""))} Os escribo por el hueco que me ofrecisteis para ${mailWho}${fullRef ? " " + fullRef : ""}.\n\nAl final no lo ha confirmado, así que podéis dárselo a otra persona. Gracias por ofrecérmelo.\n\n${STUDIO_MAIL_SIGN}`;
  // v204 review: told_studio says what really happened ("sent", "queued" for
  // the studio's next hours, "email", "failed"). It used to log true for a
  // plain text Meta had silently dropped.
  let told = "failed";
  if (FAKE_NUM_RE.test(phone) && !TEST_NAME_RE.test(String(o.studio || ""))) { console.log("[wa] lapse on a test customer, real studio not written to", o.studio); told = "test"; }
  else {
    // v212: an email rings nobody at night, so an email studio gets it at any
    // hour; the WhatsApp note (queued for the studio's hours) only when there
    // is no email to send. It used to fall through to a number that may never
    // have written to the bot whenever the lapse came after 21:00.
    if (d.channel === "email" && await emailStudio(String(d.partner_id || ""), `Ya no hace falta el hueco de ${mailWho}${subjRef ? " " + subjRef : ""}`, mail)) told = "email";
    else if (d.phone) told = await studioNoteSure({ request_id: Number(req.id), partner_id: String(d.partner_id || ""), phone: String(d.phone), text: note, short: `al final no ha confirmado, así que podéis dar el hueco a otra persona`, time: /^\d{1,2}:\d{2}$/.test(time) ? time : "", until: o.slotAt || null });
  }
  await logEvent(phone, "offer_lapsed", { request_id: String(req.id), row: String(d.id), studio: o.studio, time, told_customer: open, told_studio: told });
  return true;
}

// v204 (12 Oct, Jordan: "Go on change 3"). Two checks on the settle sweep, both
// only inside 09:00 to 21:00 Madrid, each once per request (funnel_events):
//  1. STUCK: a request still at stage "new" after 10 minutes of studio hours
//     has reached no studio. #94, #95 and #108 sat there for days and nobody
//     noticed. Jordan gets one WhatsApp alert; dispatchAndTell logs the same
//     event when it already told him at the moment the booking was made.
//  2. NOTHING CAME: every studio asked said no, or a same-day request has had
//     no time from anyone for an hour. The customer is told, signed, and
//     offered another day with the day buttons. Paulo (#87) had ten studios say
//     no or nothing to a Monday afternoon and never heard a word. When every
//     studio said no, a second wave goes first (widenRequest, once per
//     request); dispatch-studios tells them about that one itself.
// Jordan's numbers and the friend testers are left out; the fake 3460000xxxx
// canary numbers are not, and notifyJordanWa already never pages about those.
async function watchRequests(only = ""): Promise<{ stuck: number; told: number }> {
  const out = { stuck: 0, told: 0 };
  const now = Date.now();
  const h = mcMadridHour();
  if (h < 9 || h >= 21) return out;
  const since = new Date(now - 48 * 3600e3).toISOString();
  const er = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?event=in.(request_stuck_alerted,no_offer_told)&created_at=gte.${new Date(now - 4 * 86400e3).toISOString()}&order=created_at.desc&limit=1000&select=event,meta`, { headers: H() });
  const evs = await er.json().catch(() => []);
  const stuckSeen = new Set<string>(), toldSeen = new Set<string>();
  for (const e of Array.isArray(evs) ? evs : []) (e?.event === "no_offer_told" ? toldSeen : stuckSeen).add(String(e?.meta?.request_id || ""));
  // v204 review: test contacts by name or email too (CLAUDE.md), not only the
  // numbers: a "Prueba" or a test address on an ordinary number is left alone.
  const tester = (ph: string, r: any = {}) => !ph || (!!only && !ph.startsWith(only)) || TEST_PHONES.includes(ph) || /^86\d*997$/.test(ph) || TEST_NAME_RE.test(String(r?.first_name || "")) || TEST_EMAIL_RE.test(String(r?.contact_email || ""));

  // dispatched_at is null: a request being dispatched this second holds the
  // claim, and a test customer's is marked handled with nothing sent.
  const nr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?stage=eq.new&dispatched_at=is.null&created_at=gte.${since}&order=id.desc&limit=30&select=*`, { headers: H() });
  const newRows = await nr.json().catch(() => []);
  for (const r of Array.isArray(newRows) ? newRows : []) {
    const ph = digitsOf(String(r?.client_phone || ""));
    const mins = stuckMinutes(Date.parse(String(r?.created_at || "")), now);
    if (stuckSeen.has(String(r.id)) || tester(ph, r) || mins < 10) continue;
    stuckSeen.add(String(r.id));
    // v204 review (12 Oct): a night request is told "I'll ask them at 09:00".
    // When the 09:00 run finds nobody open or near enough (#95, 22:04,
    // "Saturday morning, Vallecas"), it hands the request back and it sits
    // here; Jordan was paged and the customer never heard a word. A dry run
    // says whether anyone could be asked at all, and when nobody can, the
    // customer hears it the way a daytime request does (dispatchAndTell) and
    // the request is closed so the dispatch sweep stops picking it up.
    const dry = await dispatchDryRun(Number(r.id));
    if (dry?.reason === "no_candidates") {
      const closedBy: string[] = Array.isArray(dry.skippedClosed) ? dry.skippedClosed : [];
      const via = await tellNothingAsked(r, closedBy.length > 0);
      await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(r.id)}&stage=eq.new`, {
        method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify({ stage: "dismissed", stage_note: `No studio could be asked at 09:00 (${closedBy.length ? "closed: " + closedBy.join(", ") : "none near enough"}). Customer ${via === "none" ? "could not be told" : "told by " + via} (wa-bot v204).`.slice(0, 500), stage_updated_at: new Date().toISOString() }),
      });
      await logEvent(ph, "request_stuck_alerted", { request_id: String(r.id), why: "nothing_to_ask", minutes: mins, told: via, closed: closedBy.length ? closedBy : null });
      await notifyJordanWa(`Request #${r.id} (${r.first_name || "+" + ph}, ${r.service_name || "massage"}, ${[r.day1, r.time1].filter(Boolean).join(" ") || "no day"}${r.area ? ", " + r.area : ""}) reached no studio: ${closedBy.length ? "every studio near enough is closed then (" + closedBy.join(", ").slice(0, 80) + ")" : "no studio near enough to ask"}. ${via === "none" ? "The customer could NOT be told (WhatsApp window shut or they are mid-chat, and no email)." : `The customer was told by ${via} and offered another day.`} The request is closed.`, ph);
      out.stuck++;
      continue;
    }
    await logEvent(ph, "request_stuck_alerted", { request_id: String(r.id), why: "still_new", minutes: mins });
    await notifyJordanWa(`Request #${r.id} (${r.first_name || "+" + ph}, ${r.service_name || "massage"}, ${[r.day1, r.time1].filter(Boolean).join(" ") || "no day"}${r.area ? ", " + r.area : ""}) has sat at stage new for ${mins} min of studio hours: no studio has been asked and the customer has not been told. Worth a look.`, ph);
    out.stuck++;
  }

  const lr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?stage=in.(studio_asked,studio_replied)&dispatched_at=gte.${since}&order=id.desc&limit=30&select=*`, { headers: H() });
  const liveRows = await lr.json().catch(() => []);
  for (const req of Array.isArray(liveRows) ? liveRows : []) {
    const id = String(req?.id || "");
    const ph = digitsOf(String(req?.client_phone || ""));
    if (!id || toldSeen.has(id) || tester(ph, req)) continue;
    const today = madridMidnight(new Date(now)).getTime();
    const asked = resolveRequestDate(req.day1, req.message_text, new Date(now));
    if (asked && asked.getTime() < today) continue;
    const dq = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${Number(id)}&sent_at=not.is.null&select=outcome,offered_time`, { headers: H() });
    const rows = await dq.json().catch(() => []);
    const sameDay = isSameDayReq(req) || (!!asked && asked.getTime() === today);
    const why = noOfferWhy(Array.isArray(rows) ? rows : [], sameDay, Date.parse(String(req.dispatched_at || "")), now);
    if (!why) continue;
    if (why === "declined" && await widenRequest(req)) continue;
    const s = await getSession(ph);
    toldSeen.add(id);
    // Only someone who is not in the middle of something else: an offer in
    // front of them, a new booking half made, or a muted number is left alone.
    // "start" is a web customer who never wrote here; they get the email.
    // v204 review: Jordan still hears about it. The first cut logged it and
    // moved on, and a request whose customer sat at await_offer while every
    // other studio said no was never looked at again by anyone.
    if (!["done", "await_email_post", "menu", "start"].includes(s.step)) {
      await logEvent(ph, "no_offer_told", { request_id: id, why, sent: false, step: s.step });
      await notifyJordanWa(`Request #${id} (${String(req.first_name || "").trim() || "+" + ph}): ${why === "declined" ? "every studio asked said no" : "no studio has offered a time in the hour since they were asked"}. The customer was NOT told: they are at step ${s.step} in the chat. Over to you.`, ph);
      continue;
    }
    // No second wave after they have been told nothing came: dispatch-studios'
    // own widen sweep skips a request with widened_at set.
    if (!req.widened_at) await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(id)}&widened_at=is.null`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ widened_at: new Date().toISOString() }) }).catch(() => null);
    const L = s.data.lang === "es" || req.languages === "es" ? "es" : "en";
    const first = String(req.first_name || "").trim().split(" ")[0];
    const open = await waWindowOpen(ph);
    // Marked before sending, so a failure cannot become a loop.
    await logEvent(ph, "no_offer_told", { request_id: id, why, sent: true, window_open: open });
    let via = "none";
    if (open) {
      s.data.day = null; s.data.dayDate = null; s.data.time = null; s.data.timeBand = null; s.data.timeBandId = null;
      s.data.prefer = null; s.data.chosen = null; s.data.picks = null;
      s.step = "await_day"; await saveSession(s);
      const btns = dayBtns(L).filter((b) => !(sameDay && b.id === "day_today"));
      if (await sendButtons(ph, why === "declined" ? REQUEST_COPY[L].allDeclined(first, true) : REQUEST_COPY[L].quietToday(first, true), btns)) via = "whatsapp";
    } else if (req.contact_email && !TEST_EMAIL_RE.test(String(req.contact_email))) {
      if (await emailCustomer(req, REQUEST_COPY[L].subject, why === "declined" ? REQUEST_COPY[L].allDeclined(first, false) : REQUEST_COPY[L].quietToday(first, false))) via = "email";
    }
    await notifyJordanWa(`Request #${id} (${first || "+" + ph}): ${why === "declined" ? "every studio asked said no" : "no studio has offered a time in the hour since they were asked"}. ${via === "none" ? "The customer could NOT be told (WhatsApp window shut, no email)." : `The customer was told by ${via} and offered another day.`}`, ph);
    if (via !== "none") out.told++;
  }
  return out;
}

// v204 review: what dispatch-studios would do with a request now, sending
// nothing ({ request_id, dry_run: true }). null when it could not be asked.
async function dispatchDryRun(requestId: number): Promise<any | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-studios?key=${OPS_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, dry_run: true }),
    });
    const j = await res.json().catch(() => null);
    return (Array.isArray(j?.results) && j.results[0]) || null;
  } catch (e) { console.log("[wa] dispatch dry run failed", String(e)); return null; }
}
// v204 review: the settle sweep's "nobody could be asked", signed: on WhatsApp
// with the day buttons when their window is open and they are not in the
// middle of something else, otherwise by email. "whatsapp", "email" or "none".
async function tellNothingAsked(r: any, closed: boolean): Promise<string> {
  const ph = digitsOf(String(r?.client_phone || ""));
  const s = await getSession(ph);
  const L = s.data.lang === "es" || r.languages === "es" ? "es" : "en";
  const first = String(r.first_name || "").trim().split(" ")[0];
  const area = r.area && !/^(anywhere|madrid|any|cualquier)/i.test(String(r.area)) ? String(r.area) : "";
  const why = closed ? REQUEST_COPY[L].closed(area) : REQUEST_COPY[L].none(area);
  if (["done", "await_email_post", "menu", "start"].includes(s.step) && await waWindowOpen(ph)) {
    s.data.day = null; s.data.dayDate = null; s.data.time = null; s.data.timeBand = null; s.data.timeBandId = null;
    s.data.prefer = null; s.data.chosen = null; s.data.picks = null;
    s.step = "await_day"; await saveSession(s);
    if (await sendButtons(ph, REQUEST_COPY[L].nothingAsked(first, why, true, true), dayBtns(L))) return "whatsapp";
  }
  if (r.contact_email && !TEST_EMAIL_RE.test(String(r.contact_email)) && await emailCustomer(r, REQUEST_COPY[L].subject, REQUEST_COPY[L].nothingAsked(first, why, false, true))) return "email";
  return "none";
}

// v199: a studio reached by email has no WhatsApp number to answer on.
const studioSay = (to: string, text: string) => digitsOf(to) ? sendText(digitsOf(to), text) : Promise.resolve(false);
// v199: the customer's Yes / No page for an offer, on book.massageclub.io (the
// bot.html shell renders it from here). Signed per offer, so the link opens that
// offer and nothing else.
const OFFER_PAGE = "https://book.massageclub.io/bot.html";
async function offerSig(rowId: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(OPS_KEY + ":offer"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(String(rowId))));
  return [...mac.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function offerLink(rowId: string, a = ""): Promise<string> {
  return `${OFFER_PAGE}?offer=${encodeURIComponent(rowId)}&sig=${await offerSig(rowId)}${a ? "&a=" + a : ""}`;
}
async function emailOffer(req: any, L: string, rowId: string, studio: string, time: string, day: string, address: string, priceLine: string): Promise<boolean> {
  const to = String(req?.contact_email || "").trim();
  if (heldMail(to) || heldNum(req?.client_phone)) { console.log("[wa] held customer, offer email not sent"); return false; }
  if (!to || !RESEND_API_KEY) return false;
  const es = L === "es";
  const link = await offerLink(rowId);
  const who = String(req.first_name || "").trim();
  const price = String(priceLine || "").replace(/^\s+/, "").replace(/\*/g, "");
  const lead = es ? `${who ? who + ", b" : "B"}uenas noticias: ${studio} puede darte el masaje.` : `Good news${who ? ", " + who : ""}: ${studio} can do your massage.`;
  const note = es ? "Todavía no está reservado. Toca el botón, revisa la oferta y pulsa Sí para confirmarla." : "It is not booked yet. Tap the button, check the offer and press Yes to confirm it.";
  const btn = es ? "Ver la oferta y confirmar" : "See the offer and confirm";
  const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;"><tr><td style="padding:26px 34px 0;text-align:center;"><img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;"><p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p></td></tr><tr><td style="padding:22px 34px 0;text-align:center;"><p style="margin:0;color:${C.ink};font-size:15px;line-height:1.6;">${esc(lead)}</p><h1 style="margin:14px 0 0;color:${C.ink};font-size:25px;line-height:1.2;font-family:${SERIF};">${esc(studio)}</h1>${address ? `<p style="margin:6px 0 0;color:${C.muted};font-size:14px;">${esc(address)}</p>` : ""}<p style="margin:14px 0 0;color:${C.clay};font-size:30px;font-family:${SERIF};font-weight:700;">${esc([day, time].filter(Boolean).join(", "))}</p>${price ? `<p style="margin:8px 0 0;color:${C.ink};font-size:14px;">${esc(price)}</p>` : ""}<p style="margin:16px 0 0;color:${C.muted};font-size:14px;line-height:1.6;">${esc(note)}</p></td></tr><tr><td style="padding:22px 34px 0;text-align:center;"><a href="${link}" style="display:inline-block;background:#1FA855;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:999px;">${esc(btn)}</a></td></tr><tr><td style="padding:22px 34px 26px;"><div style="border-top:2px dashed ${C.dash};margin-bottom:12px;"></div><p style="margin:0;color:#B8AC9E;font-size:11.5px;text-align:center;">Massage Club · Madrid · book.massageclub.io</p></td></tr></table></td></tr></table>`;
  const text = `${lead}\n${studio}${address ? ", " + address : ""}\n${[day, time].filter(Boolean).join(", ")}${price ? "\n" + price : ""}\n\n${note}\n${link}\n\nMassage Club`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], reply_to: "support@massageclub.io", subject: es ? `${studio} puede a las ${time}: ¿lo confirmas?` : `${studio} can do ${time}: confirm it?`, html, text }),
  }).catch(() => null);
  const ok = !!res && res.ok;
  if (!ok) console.log("[wa] offer email failed", to);
  else await logEvent(digitsOf(req.client_phone || "") || "web", "offer_emailed", { request_id: req.id, row: rowId, studio, time });
  return ok;
}
// v199: the written confirmation for a studio that took the request by email.
async function emailStudio(partnerId: string, subject: string, text: string): Promise<boolean> {
  if (!partnerId || !RESEND_API_KEY) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(partnerId)}&select=booking_email,email`, { headers: H() });
  const p = ((await r.json().catch(() => [])) || [])[0] || {};
  const to = String(p.booking_email || p.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], reply_to: "support@massageclub.io", subject, text }),
  }).catch(() => null);
  if (res && res.ok) {
    const pn = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(partnerId)}&select=business_name,whatsapp,phone`, { headers: H() }).then((x) => x.json()).catch(() => []);
    const pr = (Array.isArray(pn) && pn[0]) || {};
    studioCopyLater(String(pr.whatsapp || pr.phone || ""), "Email", text, { studio: { business_name: String(pr.business_name || to) }, subject });
  }
  return !!res && res.ok;
}

// v77: has any studio on this request already offered the time the customer
// just named? On 9 September Asim typed "7pm?" while TornaSol had offered 19:00
// and Calma had offered 18:30 and 19:00 on the same request, and the bot
// answered by repeating the 18:00 he had already turned down.
async function dispatchOfferingTime(requestId: number, time: string, skipRow: string): Promise<{ id: string; partner: { id: string; business_name: string } } | null> {
  if (!requestId || !time) return null;
  // v84: `or` so a studio that offered several times is reachable by any of
  // them. FISIOBARICA offered Asim "17h, 18h y 20h"; only 17:00 was on file, so
  // when he asked for 7pm the 20:00 they had volunteered was invisible.
  const r = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${requestId}&or=(offered_time.eq.${encodeURIComponent(time)},offered_times.cs.{${encodeURIComponent(time)}})&outcome=not.in.(declined,stood_down,expired)&order=replied_at.desc.nullslast&limit=4&select=id,partner_id`, { headers: H() });
  const rows = await r.json().catch(() => []);
  const row = (Array.isArray(rows) ? rows : []).find((x: any) => String(x.id) !== String(skipRow));
  if (!row || !row.partner_id) return null;
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(String(row.partner_id))}&select=id,business_name&limit=1`, { headers: H() });
  const prs = await pr.json().catch(() => []);
  const p = Array.isArray(prs) && prs[0] ? prs[0] : null;
  return p ? { id: String(row.id), partner: { id: String(p.id), business_name: String(p.business_name || "") } } : null;
}

async function forwardTimeChange(req: any, partner: { id: string; business_name: string }, rowId: string, time: string, freeText: string, studioFrom: string) {
  const clientNum = digitsOf(req.client_phone || "");
  await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
    body: JSON.stringify({ offered_time: time, offered_times: parseOfferedTimes(freeText), offered_at: new Date().toISOString(), replied_at: new Date().toISOString(), reply_text: freeText.slice(0, 500) }),
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
  // v212: the client named, Jordan in the singular, and no "ahora mismo": the
  // send to the customer above can fail when their window has shut.
  const tcWho = String(req.first_name || "").trim();
  await sendText(studioFrom, `Gracias. Se lo pregunto ${tcWho ? "a " + tcWho : "al cliente"} y os digo algo en cuanto conteste.`);
  await logEvent(clientNum, "time_change_forwarded", { request_id: req.id, studio: partner.business_name, time });
  await notifyJordanWa(`${partner.business_name} moved ${req.first_name || "the customer"}'s confirmed ${req.confirmed_time || "time"} to ${time}. Customer asked with Yes / Another time. Bot handles the answer.`, clientNum);
  await founderCard(`⏰ ${partner.business_name} moved a confirmed time to ${time} · #${req.id}`, {
    badge: "TIME CHANGE",
    title: `${partner.business_name}: ${req.confirmed_time || "?"} became ${time}`,
    paras: [`${req.first_name || "The customer"} was asked with Yes / Another time buttons. On Yes the booking updates itself and the studio is told. Nothing to do.`],
    quote: freeText, waNum: clientNum, studioNum: studioFrom, studioName: partner.business_name,
  });
}

async function customerConfirmEmail(req: any, studio: string, when: string, addr: string, phone: string) {
  if (!req.contact_email) return;
  if (heldMail(req.contact_email) || heldNum(req.client_phone)) return;
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
// v204 review: the same, for a dispatch row read back later (a queued offer, a
// tap on an older one, the offer page): its "mañana" is the day after the
// studio wrote it, named as seen from now. "" when its words name no day.
function rowDayLabel(row: any, L: string, now: Date = new Date()): string {
  const d = studioWordDay(offerDayFromText(String(row?.reply_text || ""), L), Date.parse(String(row?.replied_at || row?.offered_at || "")));
  return d ? offerDayLabel(d, now, L) : "";
}

// v199 (Jordan, 10 Oct: "we need to make sure both parties confirm"). This is
// the only place a booking becomes confirmed, and only on the customer's own
// tap: the WhatsApp Yes button, or Yes on the offer page linked from the offer
// email. The studio's yes is what put the offer here. `from` is the customer's
// number ("" for a web customer with none) and `s` their session, or null when
// there is none, so the web path never invents a session.
async function acceptOffer(rowId: string, from: string, L: string, s: Session | null, via: "whatsapp" | "web" = "whatsapp"): Promise<boolean> {
  const say = (t: string) => from ? sendText(from, t) : Promise.resolve(false);
  const closeOffer = async () => { if (s) { s.step = "done"; s.data.offer = null; await saveSession(s); } };
  // v212: select=* so the confirmation can give the studio the price it
  // quoted and any discount it gave (quoted_price, discount_pct), and the
  // service it was asked for once request_dispatch has asked_service.
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}&select=*`, { headers: H() });
  const drows = await dr.json().catch(() => []);
  const row = Array.isArray(drows) && drows[0] ? drows[0] : null;
  // An offer the studio has since withdrawn, or one stood down because someone
  // else got the booking, is not there to accept.
  // v205 (canary, 12 Oct): a Yes on an offer that lapsed was told "we are still
  // on it", but after a lapse nobody is still asking. Say what is true.
  if (row && String(row.outcome || "") === "expired") {
    await say(L === "es" ? "Esa hora ya no está disponible y no hay nada reservado. Dime otro día u hora y vuelvo a preguntar a los centros." : "That time is no longer available and nothing is booked. Tell me another day or time and I will ask the studios again.");
    await closeOffer(); return false;
  }
  if (!row || !row.offered_time || ["no", "declined", "stood_down", "expired", "send_failed"].includes(String(row.outcome || ""))) { await say(COPY[L].offerGone); await closeOffer(); return false; }
  const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${row.request_id}&select=id,first_name,service_name,day1,contact_email,client_phone,languages,stage,message_text,created_at,confirmed_day,confirmed_start`, { headers: H() });
  const reqRows = await rr.json().catch(() => []);
  const req = Array.isArray(reqRows) && reqRows[0] ? reqRows[0] : null;
  if (!req) { await say(COPY[L].offerGone); await closeOffer(); return false; }
  const pc = await partnerCard(row.partner_id);
  const studio = pc.business_name || s?.data.offer?.studio || "the studio";
  // v37: the winning studio moved an already confirmed time and the customer said yes.
  if (req.stage === "confirmed") {
    const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&select=partner_id,confirmed_day,confirmed_start,day1,message_text,created_at`, { headers: H() });
    const rqs = await rq.json().catch(() => []);
    const cur = Array.isArray(rqs) && rqs[0] ? rqs[0] : null;
    if (!cur || String(cur.partner_id || "") !== String(row.partner_id)) { await say(COPY[L].offerGone); await closeOffer(); return false; }
    const cday = s?.data.offer?.day || cur.confirmed_day || req.day1 || "";
    const cwhen = [cday, row.offered_time].filter(Boolean).join(" ");
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ confirmed_time: row.offered_time, confirmed_day: cday || null, customer_flag: null, reconfirmed_at: new Date().toISOString(), stage_updated_at: new Date().toISOString(), studio_reply: `Hora cambiada a ${row.offered_time} por ${studio}, cliente acepta` }) });
    await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ customer_answer: "yes", customer_answered_at: new Date().toISOString() }) });
    // v212: cwhen is in the customer's language ("Tomorrow 15:30", or the word
    // they typed), so the studio's day is read from the calendar instead: the
    // studio's own "hoy" or "mañana" from when it wrote, else the booking's day.
    const cdd = studioWordDay(offerDayFromText(String(row.reply_text || ""), "es"), Date.parse(String(row.replied_at || row.offered_at || ""))) || studioDate(cur);
    const cDayEs = studioDayOf(cdd);
    const cName = String(req.first_name || "").trim();
    const cRef = [cDayEs, studioAtEs(row.offered_time)].filter(Boolean).join(" ");
    await tellStudio(digitsOf(row.phone || ""), cName, String(row.offered_time), `Hola, ${cName || "el cliente"} acepta el cambio, así que queda ${cRef || "así"}. Gracias.`, "acepta el cambio de hora, así que queda así", { dayEs: cDayEs, v2: "Acepta el cambio de hora, así que queda así." });
    await say(COPY[L].offerAccepted(studio, whenFor(cwhen, L), pc.address, pc.phone));
    await customerConfirmEmail(req, studio, whenFor(cwhen, L), pc.address, pc.phone);
    await closeOffer();
    await logEvent(from || "web", "time_change_accepted", { id: req.id, studio, time: row.offered_time, via });
    await notifyJordanWa(`${req.first_name || "Customer"} accepted ${studio}'s new time ${cwhen}. Studio told, customer confirmed by chat and email.`, from);
    return true;
  }
  // v51: the day comes from the offer itself (session, or the studio's words on
  // the dispatch row when the customer tapped an older offer), not the day asked.
  // v204 review: the studio's "mañana" read from when it wrote it (rowDayLabel).
  const day = (s?.data.offer?.row === rowId && s?.data.offer?.day) || rowDayLabel(row, L) || offerDayFromText(String(row.reply_text || ""), L) || req.day1 || "";
  const when = [day, row.offered_time].filter(Boolean).join(" ");
  // Same race guard as a studio's Confirmado tap: only one confirmation per request.
  // v199: and never on a request that has since been cancelled or closed.
  const claim = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${req.id}&stage=not.in.(confirmed,cancelled,dismissed,no_show,needs_review,stale,too_late)`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({ stage: "confirmed", confirmed_day: day || null, confirmed_time: row.offered_time, partner_id: row.partner_id, studio_name: studio, studio_reply: `Cliente acepta ${row.offered_time} (${studio})`, stage_updated_at: new Date().toISOString() }),
  });
  const claimed = await claim.json().catch(() => []);
  if (!Array.isArray(claimed) || !claimed.length) { await say(COPY[L].offerGone); await closeOffer(); return false; }
  await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ outcome: "won", customer_answer: "yes", customer_answered_at: new Date().toISOString() }) });
  await awardRequest(req.id, row.partner_id);
  await ensureBooking(req.id);
  const clientDigits = digitsOf(req.client_phone || from);
  // v199: the studio's confirmation in writing, and it has to arrive. Plain
  // WhatsApp text dies at Meta unless the studio wrote to us in the last 24
  // hours, so tellStudio falls back to the aviso templates; a
  // studio that took the request by email also gets it by email. If neither
  // reaches them, Jordan is told, because a studio that never hears "confirmado"
  // is a customer turned away at the door.
  // v212 (16 Oct): `when` is in the customer's language ("Tomorrow 15:00", or
  // the day1 they typed), so the studio's day is read from the calendar: the
  // offer's own slot, the studio's "hoy" or "mañana" from when it wrote, else
  // the day asked. The duration is the request's, the price the one the
  // studio quoted (with its discount, if it gave one), and "Habla inglés" only
  // for an English speaker, as information. The email is an email: who we
  // are, the full date, a sign-off.
  const fn = String(req.first_name || "").trim();
  const dd = (s?.data.offer?.row === rowId ? studioSlotDate(s?.data.offer?.slotAt) : null)
    || studioWordDay(offerDayFromText(String(row.reply_text || ""), "es"), Date.parse(String(row.replied_at || row.offered_at || "")))
    || studioDate(req);
  const dEs = studioDayOf(dd);
  const atEs = studioAtEs(row.offered_time);
  const svcEs = String(row.asked_service || trSvc(req.service_name || "Massage", "es")).trim().toLowerCase();
  const qPrice = Number(row.quoted_price || 0), qPct = Number(row.discount_pct || 0);
  const priceEs = qPrice > 0 ? `, ${eurEs(qPrice)}${qPct > 0 ? `, ya con el ${qPct}% de Massage Club` : ""}` : qPct > 0 ? `, con el ${qPct}% de Massage Club` : "";
  // (A customer writing in a third language is stored as "en" with xlang set.)
  const habla = req.languages === "en" && !s?.data?.xlang ? " Habla inglés." : "";
  const what = `${svcEs} de ${reqDuration(req)} min${priceEs}`;
  const waRef = [dEs, atEs].filter(Boolean).join(" ");
  const studioText = `Hola, ${fn || "el cliente"} ha dicho que sí, así que queda confirmado: ${waRef ? waRef + ", " : ""}${what}. Ya podéis apuntarlo.${habla} Si necesitáis decirle algo, escribidme por aquí y se lo paso.`;
  const toldWa = await tellStudio(digitsOf(row.phone || ""), fn, String(row.offered_time), studioText, `ha dicho que sí y queda confirmado, ${what}.${habla} Ya podéis apuntarlo`, { dayEs: dEs, v2: `Ha dicho que sí, así que queda confirmado: ${what}.${habla} Ya podéis apuntarlo.` });
  const mailRef = [studioDateFull(dd), atEs].filter(Boolean).join(" ");
  const studioMail = `${studioMailHead(pc.business_name || String(s?.data.offer?.studio || ""))}\n\n${fn || "Nuestro cliente"} ha dicho que sí a vuestra hora, así que la reserva queda confirmada: ${mailRef ? mailRef + ", " : ""}${what}.${habla ? " Habla inglés y paga" : " Paga"} directamente en el centro.\n\nYa podéis apuntarlo. Si necesitáis decirle algo, contestad a este correo y se lo paso.\n\n${STUDIO_MAIL_SIGN}`;
  const toldMail = (row.channel === "email" || !toldWa) ? await emailStudio(String(row.partner_id || ""), `Reserva confirmada: ${fn || "nuestro cliente"}${mailRef ? ", " + mailRef.replace(/^el /, "") : ""}`, studioMail) : false;
  if (!toldWa && !toldMail) {
    await founderCard(`⚠️ ${studio} has not been told #${req.id} is confirmed`, {
      badge: "STUDIO NOT TOLD", title: `${req.first_name || "The customer"} confirmed ${studio} at ${when}, and the studio could not be reached`,
      paras: [`Neither WhatsApp nor email reached ${studio}. Please call them so they hold the slot.`],
      waNum: digitsOf(row.phone || ""),
    });
  }
  await say(COPY[L].offerAccepted(studio, whenFor(when, L), pc.address, pc.phone));
  await customerConfirmEmail(req, studio, whenFor(when, L), pc.address, pc.phone);
  // v81 (Jordan, 12 Sept): the email lands here, at the moment they have just
  // said yes to a real slot, where it buys them the member rate rather than
  // standing between them and any answer. Nobody abandons over an email address
  // once they have a booking in front of them. Sharo J had none of this: no
  // email, no WhatsApp history, five studios asked and nothing we could tell her.
  if (s) {
    s.data.offer = null;
    if (!req.contact_email && !s.data.emailRefused && from) {
      s.step = "await_email_post"; await saveSession(s);
      await say(COPY[L].memberJoin);
    } else {
      s.step = "done"; await saveSession(s);
    }
  }
  await logEvent(from || "web", "confirmed", { id: req.id, studio, via: via === "web" ? "offer_page" : "offer" });
  await founderCard(`✅ Booked: ${req.first_name || "customer"} at ${studio}, ${when} · #${req.id}`, {
    badge: "BOOKED",
    title: `${studio} · ${when}`,
    paras: [`${req.first_name || "The customer"} tapped Yes${via === "web" ? " on the offer page" : " on WhatsApp"}. ${toldWa || toldMail ? `The studio has the confirmation in writing (${[toldWa ? "WhatsApp" : "", toldMail ? "email" : ""].filter(Boolean).join(" and ")})` : "The studio could NOT be told, see the separate alert"}, the customer was told${req.contact_email ? " (and emailed)" : ""}, and every other studio asked was stood down.`],
    waNum: clientDigits, studioNum: digitsOf(row.phone || ""), studioName: studio,
  });
  return true;
}


// v199: null-safe like acceptOffer, so the offer page's No works for a customer
// with no WhatsApp session.
// v204: mode "alt" is "Closer or cheaper" (or a typed "otro centro", "más
// barato"); "time" is "Another time". Either way the next offer studios have
// already made goes straight to them (showNextOffer), and when there is none
// they are told so honestly and the request is widened if it can be.
async function declineOffer(rowId: string, from: string, L: string, s: Session | null, mode: "time" | "alt" = "time") {
  const say = (t: string) => from ? sendText(from, t) : Promise.resolve(false);
  // v204: select=* for km, which the next offer is ranked by when it is there.
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}&select=*`, { headers: H() });
  const drows = await dr.json().catch(() => []);
  const row = Array.isArray(drows) && drows[0] ? drows[0] : null;
  if (row && s?.data.offer?.change) {
    // v37: the customer refused a moved time on a confirmed booking. Ask the
    // studio to keep the original slot; a person closes it if they cannot.
    const old = String(s.data.offer?.old || "");
    await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ customer_answer: "no", customer_answered_at: new Date().toISOString() }) });
    // v212 (16 Oct): the client and the booked day named, "no le van bien las
    // 15:30" (not "no le encaja 15:30"), and through tellStudio, so a studio
    // whose 24 hours have passed gets the template instead of nothing; an
    // email studio gets an email. Jordan hears whether it reached them.
    const tq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(row.request_id)}&select=first_name,day1,message_text,created_at,confirmed_day,confirmed_start`, { headers: H() });
    const trq = ((await tq.json().catch(() => [])) || [])[0] || {};
    const tfn = String(trq.first_name || "").trim();
    const tdEs = studioDayEs(trq);
    const nt = studioAtEs(row.offered_time).replace(/^a /, "");
    const keep = [tdEs, studioAtEs(old)].filter(Boolean).join(" ");
    const keepText = `${tfn ? "A " + tfn : "Al cliente"} ${nt ? "no le van bien " + nt : "no le va bien esa hora"}. ¿Podéis mantenerle la hora que teníamos${keep ? ", " + keep : ""}? Si no puede ser, decidme qué otra hora tenéis y se la propongo.`;
    // The template's opener already names the client and the booked day and
    // hour, so its sentences do not say them again.
    const keepV2 = `${nt ? "No le van bien " + nt : "No le va bien la nueva hora"}. ¿Podéis mantenerle la hora que teníamos? Si no puede ser, decidme qué otra hora tenéis y se la propongo.`;
    let toldKeep = await tellStudio(digitsOf(row.phone || ""), tfn, old, `Hola, ${keepText.charAt(0).toLowerCase()}${keepText.slice(1)}`, `${nt ? "no le van bien " + nt : "no le va bien la nueva hora"}, así que os pido mantener esta hora o que me digáis otra`, { dayEs: tdEs, v2: keepV2 });
    if (!toldKeep && row.channel === "email") {
      const fullDay = studioDateFull(studioDate(trq));
      const full = [fullDay, studioAtEs(old)].filter(Boolean).join(" ");
      const subj = [deDay(fullDay), studioAtEs(old)].filter(Boolean).join(" ");
      toldKeep = await emailStudio(String(row.partner_id || ""), `¿Podéis mantener la hora de ${tfn || "nuestro cliente"}${subj ? " " + subj : ""}?`, `${studioMailHead((await partnerCard(String(row.partner_id || ""))).business_name || "")}\n\n${tfn ? "A " + tfn : "Al cliente"} ${nt ? "no le van bien " + nt : "no le va bien la nueva hora"}. ¿Podéis mantenerle la hora que teníamos${full ? ", " + full : ""}? Si no puede ser, contestad a este correo con la hora que tenéis y se la propongo.\n\n${STUDIO_MAIL_SIGN}`);
    }
    await say(COPY[L].timeChangeDeclined(old));
    s.step = "done"; s.data.offer = null; await saveSession(s);
    await logEvent(from, "time_change_declined", { row: rowId });
    await notifyJordanWa(`${s.wa_name || from} refused the moved time ${row.offered_time || ""} (was ${old || "?"}). ${toldKeep ? "Studio asked to keep the original." : "The studio could NOT be told; call them."} Watch this one.`, from);
    return;
  }
  if (row) {
    // v204: only an open offer becomes a "no". An old "Another time" tapped on a
    // booking that has since been won must not unwind it.
    // v204 review (12 Oct): and nothing after this runs for a row that was not
    // open. The guard used to cover the PATCH alone, so an old "Another time"
    // tapped after the booking was won still told the winning studio "al
    // cliente no le encaja 18:00", and a double tap reset the session's newer
    // offer and sent it again as "Here is the next option".
    const up = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${rowId}&outcome=in.(pending,accepted)`, { method: "PATCH", headers: { ...H(), Prefer: "return=representation" }, body: JSON.stringify({ outcome: "no", customer_answer: "no", customer_answered_at: new Date().toISOString() }) });
    const closedNow = await up.json().catch(() => []);
    if (!Array.isArray(closedNow) || !closedNow.length) {
      const live = !!s && String(s.data.offer?.row || "") === String(rowId);
      if (String(row.outcome || "") === "won") {
        // Their booking stands; a change is theirs to name (CLAUDE.md), and
        // nothing is said to the studio.
        const studio = (await partnerCard(String(row.partner_id || ""))).business_name || "";
        await say(OFFER_COPY[L].bookedStands(studio, String(row.offered_time || "")));
        if (live && s) { s.step = "done"; s.data.offer = null; await saveSession(s); }
        await notifyJordanWa(`${s?.wa_name || "+" + digitsOf(from)} tapped "${mode === "alt" ? "Closer or cheaper" : "Another time"}" on the offer they already booked (#${row.request_id}, ${row.offered_time || "?"}). Told the booking stands and to name a new time if they want one; nothing sent to the studio.`, from);
      } else if (live && s) {
        await say(COPY[L].offerGone);
        s.step = "done"; s.data.offer = null; await saveSession(s);
      }
      await logEvent(from || "web", "offer_declined_closed", { row: rowId, mode, outcome: row.outcome || null, live });
      return;
    }
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${row.request_id}&stage=eq.offered`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage: "studio_asked", stage_updated_at: new Date().toISOString() }) });
    // v204: inside the studio's hours. A customer tapping "Another time" at
    // 23:00 is no reason to write to a studio at 23:00.
    // v204 review: through studioNoteSure, so it falls back to the template
    // and waits for the morning instead of being lost.
    // v212 (16 Oct): "Hola, al final" (it can land long after the studio's
    // offer), the client and the day named, "no le van bien las 15:00" (not
    // "no le encaja 15:00"), and the real reason for "Closer or cheaper",
    // which is not the time.
    if (row.phone) {
      const nq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(row.request_id)}&select=first_name,day1,message_text,created_at,confirmed_day,confirmed_start`, { headers: H() });
      const nrq = ((await nq.json().catch(() => [])) || [])[0] || {};
      const nfn = String(nrq.first_name || "").trim();
      const ndd = (s?.data.offer?.row === rowId ? studioSlotDate(s?.data.offer?.slotAt) : null)
        || studioWordDay(offerDayFromText(String(row.reply_text || ""), "es"), Date.parse(String(row.replied_at || row.offered_at || "")))
        || studioDate(nrq);
      const nAt = studioAtEs(row.offered_time).replace(/^a /, "");
      const theSlot = [nAt || "esa hora", deDay(studioDayOf(ndd))].filter(Boolean).join(" ");
      const text = mode === "alt"
        ? `Hola, al final ${nfn || "el cliente"} prefiere algo más cerca o más económico, así que no hace falta que le guardéis ${theSlot}. Si podéis mejorar el precio, decídmelo y se lo paso.`
        : `Hola, al final ${nfn ? "a " + nfn : "al cliente"} no le ${nAt ? "van" : "va"} bien ${theSlot}. Si tenéis otra hora ese día, decídmela y se la paso.`;
      const short = mode === "alt"
        ? "al final prefiere algo más cerca o más económico, así que no hace falta que le guardéis el hueco; si podéis mejorar el precio, decídmelo y se lo paso"
        : "al final no le va bien esa hora; si tenéis otra ese día, decídmela y se la paso";
      await studioNoteSure({ request_id: Number(row.request_id), partner_id: String(row.partner_id || ""), phone: String(row.phone), text, short, time: /^\d{1,2}:\d{2}$/.test(String(row.offered_time || "")) ? String(row.offered_time) : "", until: s?.data.offer?.row === rowId ? s?.data.offer?.slotAt || null : null });
    }
  }
  if (s) { s.step = "done"; s.data.offer = null; await saveSession(s); }
  await logEvent(from || "web", "offer_declined", { row: rowId, mode });
  // v204 (12 Oct): "no" leads somewhere. Al (#83) turned down Centro Aloha with
  // "Keep looking" and then "Prefer to look for another center", got "Got it,
  // I am checking that now" both times, and nothing ever followed, while other
  // studios' times on his request sat queued and unseen. Pedro (#78) had Calma
  // at 13:00, inside his window, queued behind a 16:00 he never answered.
  if (row?.request_id) {
    const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(row.request_id)}&select=*`, { headers: H() });
    const req = ((await rq.json().catch(() => [])) || [])[0] || null;
    if (req && OPEN_STAGES.includes(String(req.stage || ""))) {
      if (await showNextOffer(req, row, mode, L)) return;
      // v204 review: "Closer or cheaper" with other times on the table, none of
      // them closer or cheaper, says so and shows the best of them.
      if (mode === "alt" && await showNextOffer(req, row, "any", L, OFFER_COPY[L].noBetter)) return;
      // v204 review (12 Oct): "I am still asking" only when something really
      // is being asked: a second wave just went out, or a studio has not
      // answered yet. It used to go out before either was checked, and after
      // 20:00, or once the request had been widened, or with every other
      // studio already a no, it promised news that could not come.
      if (await widenRequest(req) || await asksOpen(Number(req.id))) {
        await say(OFFER_COPY[L].noneYet);
        return;
      }
      await nothingLeft(req, from, L, s);
      return;
    }
  }
  await say(COPY[L].offerDeclined);
}
// v204 review: a studio on this request that has not said no: still to answer,
// or a yes, with or without a time.
async function asksOpenOrOffered(requestId: number): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${requestId}&sent_at=not.is.null&outcome=in.(pending,accepted)&limit=1&select=id`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}
// v204 review: a studio asked about this request that has not answered yet,
// or said yes without a time. Either can still come back with one.
async function asksOpen(requestId: number): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${requestId}&sent_at=not.is.null&outcome=in.(pending,accepted)&offered_time=is.null&limit=1&select=id`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}
// v204 review: the customer turned down the last time in play and nothing
// else is coming. They hear it now, with the day buttons, instead of "I am
// still asking"; no_offer_told keeps the settle sweep from saying it again,
// and Jordan hears it like every request nothing came of. Only on WhatsApp in
// their window: from the offer page (or a shut window) the sweep emails them.
async function nothingLeft(req: any, from: string, L: string, s: Session | null) {
  const ph = digitsOf(from || String(req.client_phone || ""));
  if (!ph || !s || !(await waWindowOpen(ph))) return;
  const now = new Date();
  const asked = resolveRequestDate(req.day1, req.message_text, now);
  const sameDay = isSameDayReq(req) || (!!asked && asked.getTime() === madridMidnight(now).getTime());
  const first = String(req.first_name || "").trim().split(" ")[0];
  await logEvent(ph, "no_offer_told", { request_id: String(req.id), why: "declined", sent: true, window_open: true, via: "decline" });
  if (!req.widened_at) await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(req.id)}&widened_at=is.null`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ widened_at: now.toISOString() }) }).catch(() => null);
  s.data.day = null; s.data.dayDate = null; s.data.time = null; s.data.timeBand = null; s.data.timeBandId = null;
  s.data.prefer = null; s.data.chosen = null; s.data.picks = null;
  s.step = "await_day"; await saveSession(s);
  await sendButtons(ph, OFFER_COPY[L].noneLeft(first), dayBtns(L).filter((b) => !(sameDay && b.id === "day_today")));
  await notifyJordanWa(`Request #${req.id} (${first || "+" + ph}): they turned down the last time offered and no other studio is left to answer. Told and offered another day.`, ph);
}

// v199: a small card page for customers and studios, rendered through the
// book.massageclub.io/bot.html shell (pageOut with fmt=json).
function simpleCard(title: string, body: string, extra: string, tone: "ok" | "plain" = "plain"): string {
  const badge = tone === "ok" ? `<div style="margin-top:16px;"><span style="display:inline-block;background:#E6F4EA;color:#1A7F42;font-size:12px;font-weight:700;letter-spacing:2px;padding:7px 16px;border-radius:999px;">✓</span></div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Massage Club</title></head><body style="margin:0;background:${C.page};font-family:${SANS};"><div style="max-width:440px;margin:40px auto;padding:0 16px;"><div style="background:#fff;border:1px solid ${C.line};border-radius:20px;padding:30px 26px;text-align:center;"><img src="${LOGO_URL}" width="40" height="40" style="border-radius:50%;"><p style="margin:8px 0 0;color:${C.ink};font-size:11px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p>${badge}<h1 style="margin:16px 0 0;color:${C.ink};font-size:23px;line-height:1.25;font-family:${SERIF};">${esc(title)}</h1><p style="margin:12px 0 0;color:${C.muted};font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(body)}</p>${extra}</div></div></body></html>`;
}
const pillLink = (href: string, label: string, primary: boolean) =>
  `<a href="${href}" style="display:block;margin:12px 0 0;background:${primary ? "#1FA855" : "#fff"};color:${primary ? "#fff" : C.ink};${primary ? "" : `border:1px solid ${C.dash};`}font-size:16px;font-weight:700;text-decoration:none;padding:15px 20px;border-radius:999px;">${esc(label)}</a>`;

// v199: the offer page. GET shows the offer with Yes and No; a=yes / a=no is
// the customer's tap. The email links to the plain page, never straight to
// a=yes, so a mail scanner opening the link can never book anything.
async function offerPage(url: URL): Promise<Response> {
  const rowId = String(url.searchParams.get("offer") || "").replace(/[^0-9a-fA-F-]/g, "").slice(0, 36);
  const sig = String(url.searchParams.get("sig") || "");
  const a = String(url.searchParams.get("a") || "");
  if (!rowId || sig !== await offerSig(rowId)) return pageOut(url, simpleCard("This link is not valid", "Reply to us on WhatsApp and we will sort it out.", ""), 403);
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${encodeURIComponent(rowId)}&select=id,request_id,partner_id,offered_time,outcome,reply_text,replied_at,offered_at`, { headers: H() });
  const row = ((await dr.json().catch(() => [])) || [])[0] || null;
  const rr = row ? await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${row.request_id}&select=id,first_name,service_name,day1,languages,stage,client_phone,contact_email,partner_id,confirmed_time,message_text`, { headers: H() }) : null;
  const req = rr ? ((await rr.json().catch(() => [])) || [])[0] || null : null;
  if (!row || !req) return pageOut(url, simpleCard("This offer is no longer available", "Reply to us on WhatsApp and we will find you another time.", ""), 404);
  const L = req.languages === "es" ? "es" : "en";
  const es = L === "es";
  const gone = () => pageOut(url, simpleCard(es ? "Esta oferta ya no está disponible" : "This offer is no longer available", es ? "Escríbenos por WhatsApp y te buscamos otra hora." : "Reply to us on WhatsApp and we will find you another time.", ""));
  const pc = await partnerCard(String(row.partner_id || ""));
  const studio = pc.business_name || (es ? "el centro" : "the studio");
  const day = rowDayLabel(row, L) || offerDayFromText(String(row.reply_text || ""), L) || dayLabelFor(req.day1, req.message_text, L) || String(req.day1 || "");
  const when = [day, row.offered_time].filter(Boolean).join(", ");
  const phone = digitsOf(String(req.client_phone || ""));
  const booked = () => pageOut(url, simpleCard(es ? "¡Reservado!" : "You're booked!", `${studio}\n${when}${pc.address ? "\n" + pc.address : ""}\n\n${es ? "Te enviamos la confirmación por email. Pagas directamente en el centro." : "We've emailed you the confirmation. You pay the studio directly."}`, "", "ok"));
  if (req.stage === "confirmed" && String(req.partner_id || "") === String(row.partner_id || "") && String(req.confirmed_time || "") === String(row.offered_time || "")) return booked();
  const open = !!row.offered_time && ["", "pending", "accepted"].includes(String(row.outcome || "")) && !["confirmed", "cancelled", "dismissed", "no_show", "needs_review", "stale", "too_late"].includes(String(req.stage || ""));
  if (!open) return gone();
  const s = phone ? await getSession(phone) : null;
  if (a === "yes") return (await acceptOffer(rowId, phone, L, s, "web")) ? booked() : gone();
  if (a === "no") {
    await declineOffer(rowId, phone, L, s);
    return pageOut(url, simpleCard(es ? "Sin problema" : "No problem", es ? "No lo reservamos. Escríbenos por WhatsApp si quieres otra hora u otro centro." : "We won't book it. Message us on WhatsApp if you'd like another time or studio.", ""));
  }
  const price = (await offerPriceText(Number(req.id), String(row.partner_id || ""), String(req.service_name || ""), "", L)).replace(/\*/g, "");
  const body = `${pc.address ? pc.address + "\n\n" : ""}${when}\n${trSvc(req.service_name || "Massage", L)}${price ? "\n" + price : ""}\n\n${es ? "Todavía no está reservado. Pulsa Sí para confirmarlo." : "It's not booked yet. Tap Yes to confirm it."}`;
  const extra = pillLink(await offerLink(rowId, "yes"), es ? `Sí, reserva ${row.offered_time}` : `Yes, book ${row.offered_time}`, true)
    + pillLink(await offerLink(rowId, "no"), es ? "No, gracias" : "No, thanks", false);
  return pageOut(url, simpleCard(studio, body, extra));
}

// v199: where a studio lands after tapping a time in its email. Their tap is an
// offer; they hear that plainly, in Spanish with a line of English.
function notePage(url: URL): Response {
  const n = url.searchParams.get("note");
  if (n === "studio_pending") {
    // v212: no "ahora mismo" (untrue when the offer is held, queued or cannot
    // reach the client) and no "Se lo decimos al cliente" (only true if Jordan
    // did it).
    return pageOut(url, simpleCard("Recibido, gracias", "Se lo pasamos al cliente. Todavía no está reservado: no lo apuntéis hasta que os llegue nuestra confirmación por escrito, que os enviamos en cuanto el cliente diga que sí.\n\nReceived, thank you. We are passing this time to the client. It is not booked yet: please hold off until our written confirmation arrives.", ""));
  }
  if (n === "studio_none") {
    return pageOut(url, simpleCard("Gracias por decírnoslo", "Le buscamos otra opción al cliente. No tenéis que hacer nada más.\n\nThanks for letting us know. We will find the client another option. Nothing else is needed from you.", ""));
  }
  if (n === "studio_done") {
    return pageOut(url, simpleCard("Ya está confirmada", "Esta reserva ya está confirmada con vosotros. ¡Gracias!\n\nThis booking is already confirmed with you. Thank you.", ""));
  }
  if (n === "studio_taken") {
    // v212: "justo antes" and "tan rápido" were said whatever the timing.
    return pageOut(url, simpleCard("Ya está cubierta", "Este cliente ya ha reservado en otro centro, así que no tenéis que guardarle nada. Gracias por contestar.\n\nThis client has already booked with another studio, so there is nothing to hold. Thanks for replying.", ""));
  }
  return pageOut(url, simpleCard("Massage Club", "", ""));
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
      // v159: "Earliest available (from 12:00)" reached Calma and KamAI as
      // "a las Earliest available (from 12:00)". The studio reads 12:00.
      day1: d.day || null, time1: d.time === COPY.en.earliestToday || d.time === COPY.es.earliestToday ? "12:00" : (d.time || null),
      day2: d.backup ? d.backup : (d.day || null), time2: d.backup ? null : (d.timeBand && d.timeBand !== d.time ? d.timeBand : null),
      // v81: carried so the studio ask can include it and so an answer, once a
      // studio gives one in writing, has somewhere to live. Fernando asked for
      // a man, Centro Aloha said yes in writing, and nothing could remember it.
      therapist_gender: d.therapistGender === "male" || d.therapistGender === "female" ? d.therapistGender : null,
      languages: d.lang === "es" ? "es" : "en",
      message_text: `Quiere: ${chosen && chosen.svc ? chosen.svc : serviceName} | Cuando: ${when}${d.timeBand && d.timeBand !== d.time ? " (flexible: " + d.timeBand + ")" : ""} | Zona: ${area}${chosen ? " | Centro: " + chosen.name : (d.customStudio ? " | Centro pedido: " + d.customStudio : (Array.isArray(d.prefer) && d.prefer.length ? " | Prefiere: " + d.prefer.map((x: any) => x.name).join(", ") : ""))}${d.duration && d.duration !== 60 ? " | Duración: " + d.duration + " min" : ""}${d.dayDate ? " | Fecha: " + d.dayDate : ""}${d.backup ? " | Alternativa: " + d.backup : ""} | Origen: whatsapp-bot${d.rebook ? " (repeat)" : ""}${d.adRef ? " | Ad: " + String(d.adRef).slice(0, 120) : ""}`,
      stage: "new",
    }),
  });
  const rows = await res.json().catch(() => []);
  console.log(`[wa] request created status=${res.status}`);
  return Array.isArray(rows) && rows[0] ? rows[0].id : null;
}

// Create the request and send the confirmation - shared by the normal flow end
// and the shortcuts that skip name/email for known customers.
// v159 (5 Oct, live): "Today" is the day they said it. Abdelatif chose
// "Today" on Saturday 3 Oct, came back on Monday 5 Oct through the unfinished-
// booking reminder, answered the remaining questions, and Calma and KamAI were
// asked for "sábado 3 de octubre", a day already gone. Before anything is
// offered or sent, a Today/Tomorrow whose stored date is not today's or
// tomorrow's is asked again; yesterday's "Tomorrow" simply becomes Today.
async function staleDay(s: Session, from: string, L: string): Promise<boolean> {
  const d = String(s.data.day || "");
  if (!s.data.dayDate || !/^(today|hoy|tomorrow|mañana|manana)$/i.test(d)) return false;
  const today = [longDate("en", 0), longDate("es", 0)], tomorrow = [longDate("en", 1), longDate("es", 1)];
  const isToday = /^(today|hoy)$/i.test(d);
  if (isToday && today.includes(s.data.dayDate)) return false;
  if (!isToday && tomorrow.includes(s.data.dayDate)) return false;
  if (!isToday && today.includes(s.data.dayDate)) {
    s.data.day = L === "es" ? "Hoy" : "Today"; s.data.dayDate = longDate(L, 0); await saveSession(s); return false;
  }
  await logEvent(from, "stale_day_reasked", { day: d, dayDate: s.data.dayDate });
  s.data.day = null; s.data.dayDate = null; s.step = "await_day"; await saveSession(s);
  await askDay(from, L);
  return true;
}

// v206: says what really happened, for agent_core's create_request tool
// (day_reasked, email_asked, readback_asked, dispatchAndTell's answer, or
// chosen_sent). Every older caller ignores the value.
async function finalizeBooking(s: Session, from: string, L: string): Promise<{ outcome: string; requestId: number | null }> {
  if (await staleDay(s, from, L)) return { outcome: "day_reasked", requestId: null };
  // v67 (Jordan, 8 Sept): every booking needs an email. Sharo J asked for a
  // couples massage through the website with no email and no WhatsApp history,
  // five studios were asked, and she could not be told a single thing. WhatsApp
  // only carries free text for 24 hours after someone writes to us, so a phone
  // number on its own is not a way of reaching anyone. v50 took this question
  // out of the flow to shorten it; today cost more than the question does.
  // v81 (Jordan, 12 Sept): the email question moves to the moment they accept a
  // studio's offer, where it buys them the member rate, instead of standing
  // between them and any answer at all. Asking here made it the fifth thing we
  // wanted before the customer had received a single thing, and the funnel says
  // people leave long before they get this far.
  //
  // The 8 September rule still holds: a booking is not confirmed without an
  // email. What changes is only when it is asked. Someone mid-conversation on
  // WhatsApp is reachable for 24 hours, so dispatching is safe; Sharo J was
  // unreachable because she arrived through the website and never wrote to the
  // bot at all, and dispatch-studios already refuses that case outright.
  // v123 (24 Sept): ALWAYS ask. This used to be gated on the customer being
  // unreachable by free text, and anyone who has just finished the chat is
  // reachable by free text, so the condition was always false and the question
  // never fired. Sixteen requests over fourteen days, one email on file, and
  // that one came from the website. Zero email_asked events in the funnel.
  //
  // The gate was written to shorten the flow, on the reasoning that someone
  // mid-conversation on WhatsApp is reachable for 24 hours. True, and then the
  // 24 hours end. Nell, Garry, Al, Javier, Pedro, Manas, Alvaro and Juan were
  // every one of them lost that way: a studio said yes, the window closed, and
  // there was no second way to reach them.
  //
  // Refusing is still fine. Jordan's rule is that a WhatsApp customer who will
  // not give an address still gets their booking, because the thread reaches
  // them; they just have no second channel and he is told so.
  // v152 (Jordan, 4 Oct): in the offer-first flow the email is asked right
  // after the studio is asked, while they wait, not before. The booking still
  // never confirms without the question: accepting an offer asks it again.
  const emailAfter = !!s.data.offerMode;
  if (!emailAfter && !s.data.email && !s.data.emailRefused) {
    s.step = "await_email_req"; await saveSession(s);
    await sendText(from, COPY[L].email);
    await logEvent(from, "email_asked", { reachable: await canFreeform(digitsOf(from)) });
    return { outcome: "email_asked", requestId: null };
  }
  s.step = "done"; await saveSession(s);
  const id = await createRequest(s);
  // v156: the form's backup and name belong to this request only.
  if (s.data.backup || s.data.nameFromFlow) { s.data.backup = null; s.data.nameFromFlow = false; await saveSession(s); }
  const svcName = s.data.chosen && s.data.chosen.svc ? s.data.chosen.svc : (ALL_SERVICES.find((x) => x.id === (s.data.service === "svc_unsure" ? "svc_relax" : s.data.service))?.en || "Massage");
  const preferList = Array.isArray(s.data.prefer) ? s.data.prefer : [];
  const studioLine = preferList.length
    ? (L === "es" ? `${preferList[0].name}${preferList[1] ? ` (y ${preferList[1].name} de reserva)` : ""}` : `${preferList[0].name}${preferList[1] ? ` (with ${preferList[1].name} as backup)` : ""}`)
    : s.data.chosen ? `${s.data.chosen.name}${s.data.chosen.price ? " · " + Number(s.data.chosen.price) + " EUR" : ""}` : (s.data.customStudio ? s.data.customStudio : (s.data.area && s.data.area !== "anywhere" ? (L === "es" ? `cerca de ${s.data.area}` : `near ${s.data.area}`) : (L === "es" ? "en Madrid" : "in Madrid")));
  // v119 (Jordan, 22 Sept): "you must be positive the clients want to book a
  // massage. confirm and then send it to the masage places." A fan-out spends
  // four studios' goodwill, and until now the only thing standing between a
  // stray tap and four studios was the tap itself. Pilar, 82, tapped her way
  // through an English flow she could not read to make it stop, and Calma,
  // Sinergia38, Centro Aloha and Selvarrosa were all asked to hold 18:00 for
  // an appointment she had never wanted. Centro Aloha left the next message.
  // Read it back, wait for a yes, and only then knock on any door. The request
  // is parked at stage awaiting_go, which the dispatch sweep does not pick up.
  // The gate is deliberately NOT on everyone. Jordan, 22 Sept: "you're ruining
  // the flow how come?" He is right that an extra tap on every booking costs
  // more than it saves, because the funnel already loses most people before
  // this point. A booking where the bot understood every answer goes straight
  // out as it always did. A conversation it fumbled twice or more is the one
  // that produced Pilar, and that one has to say yes out loud first.
  const confused = Number(s.data.missTotal || 0) >= 2;
  if (id && !s.data.chosen && confused) {
    s.step = "await_go";
    s.data.pendingReq = id;
    await saveSession(s);
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${id}`, {
      method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ stage: "awaiting_go", stage_note: "waiting for the customer to confirm before any studio is asked" }),
    });
    const svcLabelGo = trSvc(svcName, L) + (s.data.duration && s.data.duration !== 60 ? ` ${s.data.duration} min` : "");
    const whenLabelGo = [s.data.dayDate ? `${String(s.data.day || "").toLowerCase()} ${s.data.dayDate}`.trim() : s.data.day, s.data.time].filter(Boolean).join(", ");
    await sendButtons(from, COPY[L].askGo(String(s.data.name || s.wa_name || "").split(" ")[0], svcLabelGo, whenLabelGo, studioLine), COPY[L].askGoBtns);
    await logEvent(from, "go_asked", { id, misses: Number(s.data.missTotal || 0) });
    return { outcome: "readback_asked", requestId: id };
  }
  // v36: outside studio hours the honest line is "at 09:00", not "right now".
  const h = mcMadridHour();
  const confirmCopy = (!s.data.chosen && (h < 9 || h >= 21)) ? COPY[L].confirmLater : COPY[L].confirm;
  const svcLabel = trSvc(svcName, L) + (s.data.duration && s.data.duration !== 60 ? ` ${s.data.duration} min` : "");
  const whenLabel = [s.data.dayDate ? `${String(s.data.day || "").toLowerCase()} ${s.data.dayDate}`.trim() : s.data.day, s.data.time].filter(Boolean).join(", ");
  // v204 (12 Oct, Jordan: "Go on change 3"): the studios are asked first and
  // the customer is told what really happened. "I'm asking the studios right
  // now" used to go out before dispatch had run, and four customers since
  // 14 Sept were told it about requests no studio ever saw (#93, #94, #95, #108).
  // A customer still finishing the old flow with a studio already chosen is
  // handled by the studio-ask trigger, and fanning out as well would message
  // five studios about a booking that has one.
  let outcome = "chosen_sent";
  if (!s.data.chosen) {
    const said = await dispatchAndTell(s, from, L, id || 0, preferList.map((x: any) => String(x.id)), [String(s.data.name || s.wa_name || "").split(" ")[0], svcLabel, whenLabel, studioLine]);
    await logEvent(from, "request_created", { id, studio: null, dispatch: said });
    outcome = said;
    // Nobody is checking anything, so no "while the studio checks" question.
    if (said !== "asked" && said !== "deferred") return { outcome, requestId: id };
  } else {
    await sendText(from, confirmCopy(String(s.data.name || s.wa_name || "").split(" ")[0], svcLabel, whenLabel, studioLine, id));
    // Now that the choice is made, the studio page is useful instead of a
    // distraction: send it after the confirmation, never before.
    if (s.data.chosen.slug) {
      await sendText(from, `${COPY[L].studioLinks}\n${COPY[L].bookedLink(s.data.chosen.name, `${APP}/book/${s.data.chosen.slug}`)}`);
    }
    await logEvent(from, "request_created", { id, studio: s.data.chosen.name });
  }
  if (emailAfter && id && !s.data.email && !s.data.emailRefused) {
    s.step = "await_email_post"; await saveSession(s);
    await sendText(from, L === "es"
      ? "Mientras el centro contesta: ¿cuál es tu email? Ahí te llega también la confirmación, así no se pierde nada."
      : "While the studio checks: what is your email? The confirmation goes there too, so nothing gets lost.");
    await logEvent(from, "email_asked", { when: "after_dispatch" });
  }
  return { outcome, requestId: id };
}

// Fire and forget: a dispatch failure must never break the customer's
// confirmation, and the sweep will retry anything that did not go out.
// v204: returns dispatch-studios' answer (null if it could not be read), and
// opts.quiet leaves the "we have written to N studios" note to the caller.
async function dispatchRequest(requestId: number, partnerIds: string[] = [], opts: { quiet?: boolean } = {}): Promise<any | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-studios?key=${OPS_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      // v152: an offer-first pick asks the chosen studio and its backups only.
      body: JSON.stringify({ request_id: requestId, ...(partnerIds.length ? { partner_ids: partnerIds } : {}), ...(opts.quiet ? { customer_note: false } : {}) }),
    });
    const txt = await res.text();
    console.log(`[wa] dispatch request=${requestId} status=${res.status} ${txt.slice(0, 200)}`);
    try { return JSON.parse(txt); } catch { return null; }
  } catch (e) { console.log("[wa] dispatch failed", String(e)); return null; }
}
// v204: how many studios were really written to about a request. The rows are
// the truth; dispatch-studios' answer only says why when the count is nought.
async function askedStudios(requestId: number): Promise<number> {
  if (!requestId) return 0;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${requestId}&sent_at=not.is.null&select=id`, { headers: H() });
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) ? rows.length : 0;
  } catch { return 0; }
}
// v204 (12 Oct, Jordan: "Go on change 3"). Ask the studios, read back what
// actually went out, then tell the customer the truth:
//  - studios written to: the usual "Done, ... I'm asking the studios right now";
//  - outside 09:00 to 21:00: the usual "I'll ask them at 09:00" (the 09:00
//    sweep does it, and the settle sweep tells Jordan if it does not);
//  - the day or the window had already gone: dispatch-studios has said so;
//  - no studio open or near enough (Rajesh, #109, Sunday 11:00 near
//    Majadahonda): said plainly, nothing booked, pick another day or time. The
//    request is closed so no later sweep asks studios behind their back;
//  - anything else (outreach paused, a failed send, dispatch unreachable):
//    "not reached the studios yet", the request stays for the dispatch sweep.
// Jordan hears about every request that reached nobody.
async function dispatchAndTell(s: Session, from: string, L: string, id: number, partnerIds: string[], args: [string, string, string, string]): Promise<"asked" | "deferred" | "told" | "nothing" | "not_yet"> {
  const h = mcMadridHour();
  const [name, svcLabel, whenLabel, where] = args;
  if (id && (h < 9 || h >= 21)) {
    await sendText(from, COPY[L].confirmLater(name, svcLabel, whenLabel, where, id));
    await dispatchRequest(id, partnerIds, { quiet: true });
    return "deferred";
  }
  const out = id ? await dispatchRequest(id, partnerIds, { quiet: true }) : null;
  const r0 = (Array.isArray(out?.results) && out.results[0]) || {};
  if (out?.deferred) { await sendText(from, COPY[L].confirmLater(name, svcLabel, whenLabel, where, id)); return "deferred"; }
  if (r0.reason === "stale" || r0.reason === "too_late") return "told";
  // A second request that only repeats a live one rides on it (dispatch-studios v4).
  // v204 review (12 Oct): only while that one is really still being asked
  // about. dispatch-studios used to take a cancelled or confirmed request as
  // the original too (fixed in its v42 for cancelled), and its old asks then
  // counted here: a customer who cancelled at the offer step and asked again
  // for the same slot heard "I'm asking the studios right now" about a request
  // nobody would ever ask about.
  const dup = String(r0.skipped || "").match(/duplicate of #(\d+)/);
  let dupLive = false;
  if (dup) {
    const sq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(dup[1])}&select=stage`, { headers: H() });
    const sib = ((await sq.json().catch(() => [])) || [])[0] || null;
    dupLive = !!sib && OPEN_STAGES.includes(String(sib.stage || "")) && await asksOpenOrOffered(Number(dup[1]));
  }
  if (dup ? dupLive : await askedStudios(id) > 0) {
    await sendText(from, COPY[L].confirm(name, svcLabel, whenLabel, where, id));
    return "asked";
  }
  const first = String(name || "").trim();
  const area = s.data.area && s.data.area !== "anywhere" ? String(s.data.area) : "";
  const nowhere = r0.reason === "no_candidates";
  const why = nowhere ? ((Array.isArray(r0.skippedClosed) && r0.skippedClosed.length) ? REQUEST_COPY[L].closed(area) : REQUEST_COPY[L].none(area)) : "";
  if (nowhere) {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${id}&stage=eq.new`, {
      method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ stage: "dismissed", stage_note: `No studio could be asked (${(r0.skippedClosed || []).length ? "closed: " + r0.skippedClosed.join(", ") : "none near enough"}). Customer told and offered another day (wa-bot v204).`.slice(0, 500), stage_updated_at: new Date().toISOString() }),
    });
    s.data.day = null; s.data.dayDate = null; s.data.time = null; s.data.timeBand = null; s.data.timeBandId = null;
    s.data.prefer = null; s.data.chosen = null; s.data.picks = null;
    s.step = "await_day"; await saveSession(s);
    await sendButtons(from, REQUEST_COPY[L].nothingAsked(first, why), dayBtns(L));
  } else {
    await sendText(from, REQUEST_COPY[L].notYet(first));
  }
  // One alert: the settle sweep's 10 minute check reads this event and stays quiet.
  await logEvent(from, "request_stuck_alerted", { request_id: String(id || ""), why: nowhere ? "nothing_to_ask" : "not_reached", closed: r0.skippedClosed || null, result: out ? JSON.stringify(r0).slice(0, 300) : "no answer from dispatch-studios" });
  // A test customer (Jordan's own numbers, the friend testers) reaches no real
  // studio by design; that is not news for his phone.
  if (!r0.testCustomer) {
    const what = !id ? "the request could not be saved, so nothing will retry it. They were told nobody has been asked yet"
      : nowhere ? `${(r0.skippedClosed || []).length ? "every studio near enough is closed then (" + r0.skippedClosed.join(", ").slice(0, 80) + ")" : "no studio near enough to ask"}. They were told and offered another day; the request is closed`
      : dup ? `dispatch closed it as a duplicate of #${dup[1]}, which is no longer being asked about. They were told nobody has been asked yet, and nothing will retry it: over to you`
      : `${!out ? "dispatch-studios did not answer" : r0.skipped ? "dispatch skipped it (" + String(r0.skipped).slice(0, 80) + ")" : "dispatch sent nothing (outreach paused or every send failed)"}. They were told nobody has been asked yet; the dispatch sweep retries every 20 min`;
    await notifyJordanWa(`Request #${id || "?"} (${first || "+" + digitsOf(from)}, ${svcLabel}, ${whenLabel}, ${where}) reached no studio: ${what}.`, from);
  }
  return nowhere ? "nothing" : "not_yet";
}

// v83: a WhatsApp confirmation has never written a bookings row. It lived only
// in whatsapp_requests.stage, which meant no action_token (so /review could
// never be linked), nothing for the reminder jobs to find, and no honest count
// of completed massages, which is the one number the business is judged on.
//
// booking_ref carries 'wa-<request id>' under a unique index, so confirming
// twice cannot produce two bookings. Everything here is derived from what the
// request already holds; nothing is invented. If there is no real start
// timestamp yet we do not guess a date, we skip and let a later confirmation
// with a real time create it.
// Friend testers count as test contacts too (Jordan, 12 Sept): Cata, Yi and
// Gerome must never receive a Massage Club email, nudge or review ask. Their
// addresses are also on the Resend suppression list, which covers the
// functions that live only in the dashboard.
const TEST_PHONES = ["15622355063", "17867276503", "34612474827", "34635569364", "8615273855997", "34662680781"];
const TEST_EMAIL_RE = /@(example|test|testing)\.com$|placeholder\.local$|jordanjayhays@gmail|jordan@massageclub|support@massageclub|jordan\.hays@student\.ie\.edu|jordan@niahconnect|cata\.waack@gmail|elon_yilong@student\.ie\.edu|longyi_elon@outlook|geromin\.nepomuceno@student\.ie\.edu|ritiktulsyan674@gmail|sarfrazsingh@gmail/i;
const TEST_NAME_RE = /\b(test|prueba|uitest|mctest)\b/i;
async function ensureBooking(requestId: number): Promise<string | null> {
  try {
    const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${requestId}&limit=1&select=id,first_name,last_name,contact_email,client_phone,studio_name,service_name,price,confirmed_start,confirmed_day,confirmed_time,partner_id,languages,area`, { headers: H() });
    const req = ((await rr.json().catch(() => [])) || [])[0];
    if (!req) return null;
    if (!req.confirmed_start) { console.log("[booking] no confirmed_start yet for", requestId); return null; }
    const start = new Date(req.confirmed_start);
    if (isNaN(start.getTime())) return null;
    const mins = 60;
    // Madrid local date and time, because that is what the studio and the
    // customer both mean; the column is TEXT and every existing row is local.
    const fmt = (opt: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", ...opt }).format(start);
    const bookingDate = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });
    const bookingTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(start);
    const name = [req.first_name, req.last_name].filter(Boolean).join(" ").trim() || "WhatsApp customer";
    const phone = digitsOf(req.client_phone || "");
    const isTest = TEST_PHONES.includes(phone) || TEST_EMAIL_RE.test(String(req.contact_email || "")) || TEST_NAME_RE.test(name);
    const body = {
      booking_ref: `wa-${requestId}`,
      client_name: name,
      client_email: req.contact_email || null,
      client_phone: req.client_phone || null,
      spa_name: req.studio_name || "Studio",
      massage_type: req.service_name || null,
      booking_date: bookingDate,
      booking_time: bookingTime,
      duration: mins,
      partner_id: req.partner_id || null,
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + mins * 60000).toISOString(),
      price: req.price ?? null,
      status: "confirmed",
      lang: req.languages === "es" ? "es" : "en",
      is_test: isTest,
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?on_conflict=booking_ref`, {
      method: "POST",
      headers: { ...H(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(body),
    });
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    console.log(`[booking] wa-${requestId} -> booking ${row ? row.id : "?"} status=${res.status}${isTest ? " (test)" : ""}`);
    return row ? String(row.action_token || "") : null;
  } catch (e) { console.log("[booking] ensureBooking failed", requestId, String(e)); return null; }
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

// v154 (4 Oct): put the live offer back in front of the customer, with the
// address, instead of starting the booking again. On 3 Oct TornaSol said yes
// to Stonelove for 10:00; he asked "¿Qué calle?" and two questions later the
// bot rebuilt his request from scratch, cancelled TornaSol's yes and asked two
// other studios. A question about an offer is a question, not a new booking.
async function reshowOffer(s: Session, from: string, L: string, why: string): Promise<boolean> {
  const o = s.data.offer;
  if (!o || !o.row) return false;
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${encodeURIComponent(String(o.row))}&select=partner_id,offered_time,outcome`, { headers: H() });
  const d = ((await dr.json().catch(() => [])) || [])[0];
  // Only an offer still on the table: pending or accepted by the studio, not
  // stood down, expired, declined, failed, or already won.
  if (!d || !d.offered_time || !["", "pending", "accepted"].includes(String(d.outcome || ""))) return false;
  const pc = d.partner_id ? await partnerCard(d.partner_id) : { business_name: o.studio, address: "", phone: "", neighbourhood: "" };
  const es = L === "es";
  const where = [pc.address, pc.neighbourhood && !String(pc.address || "").includes(pc.neighbourhood) ? pc.neighbourhood : ""].filter(Boolean).join(", ");
  // v182: "how much?" and "where?" about an offer get both, every time.
  let price = "";
  if (d.partner_id) {
    const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(o.request || 0)}&select=service_name`, { headers: H() });
    const svcName = String(((await rq.json().catch(() => [])) || [])[0]?.service_name || "");
    price = await offerPriceText(Number(o.request || 0), String(d.partner_id), svcName, "", L);
  }
  let body = es
    ? `Tu oferta sigue en pie: *${pc.business_name || o.studio}* a las *${o.time}*${o.day ? ` (${o.day})` : ""}.${where ? `\nDirección: ${where}` : ""}${price ? `\n${price}` : ""}\n\n¿Te la reservo?`
    : `Your offer is still open: *${pc.business_name || o.studio}* at *${o.time}*${o.day ? ` (${o.day})` : ""}.${where ? `\nAddress: ${where}` : ""}${price ? `\n${price}` : ""}\n\nShall I book it?`;
  // v199: a typed yes is answered with the one thing that confirms it.
  const tapNote = "";
  if (why === "typed_yes") body = body.replace(/\n\n(¿Te la reservo\?|Shall I book it\?)$/, es ? "\n\nPara confirmarla, pulsa el botón de abajo." : "\n\nTo confirm it, tap the button below.");
  // v204: the same three buttons as the offer itself.
  await sendButtons(from, body + tapNote, offerButtons(L, String(o.row), String(o.time || "")));
  await logEvent(from, "offer_reshown", { why, studio: o.studio, time: o.time });
  return true;
}
// v182: Paulo wrote "Adresss?" and Javier "Donde" to an offer, and both got
// nothing useful. A bare "where?" / "¿dónde?" counts too.
// v183: "¿Dónde está?" never matched: \\b after the accented á needs a letter
// class of its own. "Where is the studio?" and "¿Y dónde?" count too.
const ADDRESS_Q_RE = /((?<![a-zñáéíóú])(calle|direcci[oó]n|d[oó]nde (est[aá]|queda|es)|ubicaci[oó]n|metro|addr?ess+|adress+|street|where (is|are) (it|they|that|the studio|this place|the place)|location)(?![a-zñáéíóú])|^\s*¿?\s*(y|ok|vale|and)?\s*,?\s*(d[oó]nde|where)\s*[?!.]*\s*$)/iu;

// v182 (7 Oct): no offer without a price. The studio's own figure for this
// booking wins; without one, the price on its menu for this massage, labelled
// as its listed price and never as anything we negotiated. A 60-minute row
// under 30 EUR is a partial or promo price we cannot stand behind, so skipped.
async function listedPrice(partnerId: string, svcName: string): Promise<{ price: number; duration: number } | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/partner_services?partner_id=eq.${encodeURIComponent(partnerId)}&is_active=eq.true&price=gt.0&select=name,name_en,type,duration,price`, { headers: H() });
    const rows = await r.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) return null;
    const w = stripAcc(String(svcName || "")).toLowerCase();
    const kind = /deep tissue|descontract|profundo/.test(w) ? "deep" : /thai|tailand/.test(w) ? "thai" : /sport|deportiv/.test(w) ? "sport" : /hot stone|piedras/.test(w) ? "stone" : /relax|relajante|swedish|sueco/.test(w) || !w || w === "massage" ? "relax" : "";
    const scored = rows.map((x: any) => {
      const label = stripAcc(`${x.type || ""} ${x.name || ""} ${x.name_en || ""}`).toLowerCase();
      const dur = Number(x.duration) || 60;
      return { price: Number(x.price), duration: dur, miss: kind && !label.includes(kind) ? 1 : 0, gap: Math.abs(dur - 60) };
    }).filter((x: any) => x.price > 0 && !(x.duration >= 50 && x.price < 30));
    scored.sort((a: any, b: any) => a.miss - b.miss || a.gap - b.gap || a.price - b.price);
    return scored[0] ? { price: scored[0].price, duration: scored[0].duration } : null;
  } catch (_e) { return null; }
}
function listedPriceLine(L: string, p: { price: number; duration: number }): string {
  return L === "es"
    ? `Precio: unos ${euro(p.price)} por ${p.duration} minutos, la tarifa publicada del centro. Pagas allí, sin comisión.`
    : `Price: about ${euro(p.price)} for ${p.duration} minutes, the studio's listed price. You pay there, no fee.`;
}
async function offerPriceText(requestId: number, partnerId: string, svcName: string, freeText: string, L: string): Promise<string> {
  try {
    const dsp = requestId ? await dispatchRowFor(requestId, partnerId) : null;
    const quoted = Number((dsp && dsp.quoted_price) || parseQuotedPrice(freeText) || 0);
    if (quoted > 0) return COPY[L].priceLine(quoted, 60, !!(dsp && Number(dsp.discount_pct) > 0));
  } catch (_e) { /* fall through to the listed price */ }
  const lp = await listedPrice(partnerId, svcName);
  return lp ? listedPriceLine(L, lp) : "";
}

// v182: "carísimo", "es un robo", "It's very expensive so I am not going for
// that". On 6 Oct the first got the same list back with Calma at 85 EUR on top,
// and the second got "Sorry, I did not catch that". A price objection gets the
// cheapest real option we have, and a way out, never a repeat.
const PRICE_OBJ_RE = /((?<![a-zñáéíóú])(car[ií]sim[oa]s?|muy car[oa]|es car[oa]|demasiado car[oa]|qu[eé] car[oa]|un robo|expensive|too pricey|overpriced|pricey|too much money|m[aá]s barat[oa]|m[aá]s econ[oó]mic[oa]|cheaper)(?![a-zñáéíóú])|^[\s¡]*car[oa](?![a-zñáéíóú]))/iu;
// v183 (review of v182): a regex hit is not an objection. "No es caro",
// "not too expensive", "que no sea muy caro" are the opposite, and "¿Es caro?"
// / "Is it expensive?" / "how expensive" are questions about the price. Only a
// plain, un-negated objection counts. "más barato" / "cheaper" as a question
// ("¿hay algo más barato?") is a request for the cheapest option and counts.
function isPriceObjection(t: string): boolean {
  const s = String(t || "").trim();
  if (!PRICE_OBJ_RE.test(s)) return false;
  const low = stripAcc(s).toLowerCase();
  if (/\b(no|not|nada|nothing|isn'?t|ni|que no sea|sin ser)\s+(es\s+|is\s+|sea\s+)?(too\s+|muy\s+|tan\s+|so\s+|demasiado\s+)?(expensive|car[oa]|pricey)\b/.test(low)) return false;
  const cheaperAsk = /\b(mas barat[oa]|mas economic[oa]|cheaper)\b/.test(low);
  const strong = /\b(carisim[oa]s?|un robo|overpriced)\b/.test(low);
  const question = s.includes("?") || /^\s*¿/.test(s) || /\b(is it|is that|how expensive|es caro|es cara|seria caro|sera caro)\b/.test(low);
  if (question && !cheaperAsk && !strong) return false;
  return true;
}
async function priceObjection(s: Session, from: string, L: string): Promise<void> {
  const es = L === "es";
  const svcRow = ALL_SERVICES.find((x) => x.id === (!s.data.service || s.data.service === "svc_unsure" ? "svc_relax" : s.data.service));
  const area = s.data.area && s.data.area !== "anywhere" ? s.data.area : "";
  const fetchPicks = async (a: string, n: number): Promise<any[]> => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/offer_studios`, { method: "POST", headers: H(), body: JSON.stringify({ p_area: a || null, p_want: svcRow ? svcRow.en : null, p_limit: n }) });
      const j = await res.json().catch(() => []);
      return await dropClosed(s, from, (Array.isArray(j) ? j : []).map((o: any) => ({ id: o.id, slug: o.slug, name: o.business_name, svc: o.svc, price: Number(o.price), duration: Number(o.duration) || 60, area: o.area, registered: !!o.registered })));
    } catch (_e) { return []; }
  };
  const ok = (p: any) => Number(p.price) > 0 && !(Number(p.duration) >= 50 && Number(p.price) < 30);
  // v183: never reorder s.data.picks; buttons already on screen index into it.
  const shown: any[] = Array.isArray(s.data.picks) ? s.data.picks.filter(ok) : [];
  let pool: any[] = shown.length ? [...shown] : (await fetchPicks(area, 5)).filter(ok);
  pool.sort((a: any, b: any) => Number(a.price) - Number(b.price));
  let c = pool[0];
  // The cheapest on screen is what they just called too dear: look wider for
  // something cheaper before repeating it.
  const firstShown = s.step === "await_studio" && shown.length ? [...shown].sort((a: any, b: any) => Number(a.price) - Number(b.price))[0] : null;
  if (c && firstShown && String(c.id) === String(firstShown.id)) {
    const wider = (await fetchPicks("", 5)).filter(ok).filter((p: any) => Number(p.price) < Number(c.price));
    wider.sort((a: any, b: any) => Number(a.price) - Number(b.price));
    if (wider[0]) c = wider[0];
    else c = null;
  }
  await logEvent(from, "price_objection", { step: s.step, cheapest: c ? c.name : null, price: c ? c.price : null, lowest_already_shown: !c && !!firstShown });
  if (!c && firstShown) {
    await sendButtons(from, es
      ? `Entendido. ${firstShown.name}, a unos ${euro(Number(firstShown.price))}, ya es lo más económico que tengo ahora mismo cerca de ti. Si quieres, pregunto a varios centros y te traigo la mejor oferta, sin compromiso.`
      : `Understood. ${firstShown.name}, at about ${euro(Number(firstShown.price))}, is already the most affordable I have near you right now. If you like, I'll ask several studios and bring back the best offer, no obligation.`,
      [{ id: "studio_any", title: es ? "Mejor precio" : "Best price" }, { id: "rebook_later", title: es ? "No, gracias" : "No, thanks" }]);
    return;
  }
  if (!c) {
    await sendText(from, es
      ? "Entendido. Cada centro pone su precio. Si quieres, pregunto a varios y te traigo la oferta más económica, sin compromiso."
      : "Understood. Each studio sets its own price. If you like, I'll ask several and bring back the most affordable offer, no obligation.");
    await continueFromKnown(s, from, L);
    return;
  }
  const line = es
    ? `Entendido. Cada centro pone su precio. Lo más económico que tengo ahora: *${c.name}* (${c.area || "Madrid"}), ${trSvcLow(c.svc || "Massage", L)} ${c.duration || 60} min, ${c.registered ? "" : "unos "}${euro(Number(c.price))}.`
    : `Understood. Each studio sets its own price. The most affordable I have right now: *${c.name}* (${c.area || "Madrid"}), ${trSvcLow(c.svc || "Massage", L)} ${c.duration || 60} min, ${c.registered ? "" : "about "}${euro(Number(c.price))}.`;
  // With a day, time and area already chosen, they can take it in one tap.
  if (s.data.day && s.data.time && s.data.area) {
    s.data.cheapPick = { id: c.id, name: c.name };
    s.data.cheapBackup = pool.filter((p: any) => String(p.id) !== String(c.id)).slice(0, 2).map((p: any) => ({ id: p.id, name: p.name }));
    s.step = "await_studio"; await saveSession(s);
    const short = (n: string) => n.replace(/\s+(Relax and Beauty|Wellness Studio|Madrid Spa|Masajes?|Spa|Studio)$/i, "").slice(0, 20);
    await sendButtons(from, line + (es ? "\n\n¿Se lo pregunto? Pagas en el centro, sin comisión." : "\n\nShall I ask them? You pay at the studio, no fee from us."), [
      { id: "cheap_pick", title: short(c.name) },
      { id: "rebook_later", title: es ? "No, gracias" : "No, thanks" },
    ]);
    return;
  }
  await sendText(from, line + (es ? " Pregunto primero a los más económicos." : " I'll ask the most affordable ones first."));
  await continueFromKnown(s, from, L);
}

// v39: after reading a sentence, ask only for what is still missing.
// v196 (9 Oct, live): "Finish my booking" on Friday kept Thursday's "Today" and
// asked for a time. A relative day whose stored date has passed is dropped
// (with its time) before the flow asks its next question; yesterday's
// "Tomorrow" simply becomes today.
function dropStaleDay(s: Session, L: string) {
  const d = String(s.data.day || "");
  if (!s.data.dayDate || !/^(today|hoy|tomorrow|mañana|manana)$/i.test(d)) return;
  const today = [longDate("en", 0), longDate("es", 0)], tomorrow = [longDate("en", 1), longDate("es", 1)];
  const isToday = /^(today|hoy)$/i.test(d);
  if (isToday ? today.includes(s.data.dayDate) : tomorrow.includes(s.data.dayDate)) return;
  if (!isToday && today.includes(s.data.dayDate)) { s.data.day = L === "es" ? "Hoy" : "Today"; s.data.dayDate = longDate(L, 0); return; }
  s.data.day = null; s.data.dayDate = null; s.data.time = null; s.data.timeBand = null; s.data.timeBandId = null;
}
async function continueFromKnown(s: Session, from: string, L: string) {
  dropStaleDay(s, L);
  // v154: with a studio's offer waiting for an answer, never rebuild the request.
  if (s.step === "await_offer" && s.data.offer?.row && await reshowOffer(s, from, L, "continue_from_known")) return;
  if (!s.data.service) { s.step = "await_service"; await saveSession(s); await askService(from, L); return; }
  if (!s.data.day) { s.step = "await_day"; await saveSession(s); if (s.data.service === "svc_unsure") await askDayUnsure(from, L); else await askDay(from, L); return; }
  if (!s.data.time) { s.step = "await_time"; await saveSession(s); await askTime(from, L); return; }
  if (!s.data.area) { s.step = "await_area"; await saveSession(s); await askArea(from, L); return; }
  await askNameOrFinalize(s, from, L);
}
// v81: a customer answering a question we did not ask. Jorge typed "Por plaza
// Cuzco", his area, while the bot was asking which day, and await_day_text took
// it as the day because that branch accepts any text at all. Fernando asked
// about the therapist mid-confirmation and got the main menu. Marvin and Abdul
// both walked the entire flow twice. All of it is the same thing: the bot only
// ever listened for the one answer it had just asked for.
//
// Capture anything recognisable EXCEPT the slot we are standing on, and report
// what was taken so the caller can say "got it" rather than repeat itself.
// `skip` is the slot the current question owns, which its own branch handles.
function absorbOffStep(s: Session, text: string, L: string, skip: "service" | "day" | "time" | "area"): string[] {
  const got: string[] = [];
  if (skip !== "service") {
    const svc = UNSURE_RE.test(text) ? "svc_unsure" : detectService(text);
    if (svc && !s.data.service) { s.data.service = svc; got.push("service"); }
  }
  if (skip !== "day") { const d = detectDay(text, L); if (d && !s.data.day) { s.data.day = d; got.push("day"); } }
  if (skip !== "time") { const t = detectTime(text, L); if (t && !s.data.time) { s.data.time = t; s.data.timeBand = /\(/.test(t) ? t : null; got.push("time"); } }
  if (skip !== "area") { const a = detectAreaPlus(text); if (a && !s.data.area) { s.data.area = a; s.data.areaAt = Date.now(); got.push("area"); } }
  const dur = detectDuration(text); if (dur && !s.data.duration) s.data.duration = dur;
  return got;
}

// Read a free-text sentence into the session. Returns true if anything was understood.
function absorbSentence(s: Session, text: string, L: string): boolean {
  let got = false;
  const svc = UNSURE_RE.test(text) ? "svc_unsure" : detectService(text);
  if (svc && !s.data.service) { s.data.service = svc; got = true; }
  const day = detectDay(text, L); if (day && !s.data.day) { s.data.day = day; got = true; }
  const time = detectTime(text, L); if (time && !s.data.time) { s.data.time = time; s.data.timeBand = /\(/.test(time) ? time : null; got = true; }
  const area = detectAreaPlus(text); if (area && !s.data.area) { s.data.area = area; s.data.areaAt = Date.now(); got = true; }
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
    // v206 review: an email agent_core saved in this chat is kept (see askNameOrFinalize).
    s.data.email = (s.data.coreAt && s.data.email) || s.data.known.email || null;
    await finalizeBooking(s, from, L);
    return;
  }
  // v179: Javier said "Estoy en la zona de Lavapiés" and was asked his area
  // again three questions later. An area given in this conversation stands.
  if (s.data.area && s.data.areaAt && Date.now() - Number(s.data.areaAt) < 3 * 3600e3) {
    s.step = "await_area"; await saveSession(s); await logEvent(from, "time_chosen", { time: s.data.time, areaKnown: s.data.area });
    if (!(await offerStudios(s, from, L))) await askNameOrFinalize(s, from, L);
    return;
  }
  s.step = "await_area"; await saveSession(s); await logEvent(from, "time_chosen", { time: s.data.time }); await askArea(from, L);
}

// Reaching the name step: known customers skip name+email and finish directly.
async function askNameOrFinalize(s: Session, from: string, L: string) {
  // v156: the form asked their name and email; neither is asked again.
  if (s.data.nameFromFlow && s.data.name) { await finalizeBooking(s, from, L); return; }
  // v206 review (12 Oct): in a chat agent_core has spoken in (coreAt), the
  // name and email it saved stand. A tap on studio_0 after the core had taken
  // "ana@x.com" from a customer resumed from the email link used to set the
  // email back to null (known has no email), send the request without one and
  // ask for it again; without known, a name they typed was swapped for their
  // WhatsApp profile name. Other chats are untouched.
  if (s.data.coreAt && s.data.name) { await finalizeBooking(s, from, L); return; }
  if (s.data.known?.name) {
    s.data.name = s.data.known.name;
    s.data.email = (s.data.coreAt && s.data.email) || s.data.known.email || null;
    await finalizeBooking(s, from, L);
    return;
  }
  // v126 (Jordan, 25 Sept): "i need you to be very simple when they ask for a
  // massage." The shortest question is the one we never ask. WhatsApp sends the
  // profile name on every inbound, and on 24 September it sent us "Hatem" while
  // the bot asked him his name anyway and filed "Retiro" under it. When the
  // profile name is a real one we use it and the question disappears; when it
  // is "la vida" or an emoji, firstNameFromProfile returns "" and we ask as
  // before. They can still correct it: the summary reads the name back.
  const fromProfile = firstNameFromProfile(s.wa_name);
  if (fromProfile) {
    s.data.name = fromProfile;
    await saveSession(s);
    await logEvent(from, "name_from_profile", { name: fromProfile });
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

// ---- v206 agent_core: what bot.ts lends it ----
// v206 (12 Oct, Jordan approved "change 3"). agent_core.ts runs the
// conversation for free-text messages behind AGENT_CORE, and owns no I/O: it
// gets everything below through coreCtx(). Most of it is the bot's own
// functions, unchanged; the few new ones are written next to the code they
// copy, so a change there is seen here.

// The last messages both ways, oldest first, with their ids (the superseded
// check) and their type (a delivery report is not something we said).
async function coreThread(phone: string, limit: number): Promise<Array<{ id: number; dir: string; body: string; at: string; type: string }>> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${digitsOf(phone)}&order=created_at.desc&limit=${Math.max(1, Math.min(50, limit))}&select=id,direction,body,created_at,msg_type`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) ? rows : []).reverse().map((x: any) => ({ id: Number(x.id) || 0, dir: String(x.direction || ""), body: String(x.body || ""), at: String(x.created_at || ""), type: String(x.msg_type || "") }));
}
// The row this very message was logged as (handleInner logs it before
// anything else runs), so a later message is "newer" even when two webhooks
// race: Hafeez's "Plzz" and "Send me" were logged a second apart.
async function coreInboundId(phone: string, text: string): Promise<number> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${digitsOf(phone)}&direction=eq.in&order=id.desc&limit=5&select=id,body`, { headers: H() });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return 0;
  const clean = (b: string) => String(b || "").replace(/\s*\[via ad\]$/i, "").replace(/^\[voice note[^\]]*\]\s*/i, "").trim();
  const mine = rows.find((x: any) => clean(x.body) === String(text || "").trim());
  return Number((mine || rows[0]).id) || 0;
}
// v206 review (12 Oct): "newer" means newer AND taken by a core turn, which
// marks itself with agent_core_taken as it starts (agent_core_released if it
// then falls back to the old flow). Any newer text used to count, so "Is there
// parking near the studio?" then "yes" at an offer left the parking question
// unanswered ("yes" is reshowOffer's, the old flow's), and a voice note
// (msg_type audio) never counted at all, so a text and a voice note a second
// apart were both answered in full. What is left: a newer core turn that falls
// back only after the older one went quiet. That needs a second failure in the
// same few seconds (the guard twice, or both models down), and is logged.
async function coreNewerInbound(phone: string, id: number): Promise<boolean> {
  if (!id) return false;
  const since = new Date(Date.now() - 10 * 60e3).toISOString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?phone=eq.${digitsOf(phone)}&event=in.(agent_core_taken,agent_core_released)&created_at=gte.${since}&order=created_at.desc&limit=40&select=event,meta`, { headers: H() });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows)) return false;
  const released = new Set(rows.filter((x: any) => x?.event === "agent_core_released").map((x: any) => Number(x?.meta?.inbound_id || 0)));
  return rows.some((x: any) => x?.event === "agent_core_taken" && Number(x?.meta?.inbound_id || 0) > id && !released.has(Number(x.meta.inbound_id)));
}
async function coreLastOutbound(phone: string): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${digitsOf(phone)}&direction=eq.out&msg_type=neq.status_failed&order=created_at.desc&limit=1&select=body`, { headers: H() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? String(rows[0].body || "") : "";
}
// v206 review (12 Oct): when a confirmed booking starts. Requests stay at
// stage confirmed after the massage and no code writes confirmed_start, so
// without this a customer confirmed once was "confirmed" on every later visit:
// set_details, studio_options and create_request locked, and the guard's
// "never say booked" switched off. The day (with its Fecha) is read the way
// dispatch reads it, from the day the request was made; no time means late
// that day. null only when the day cannot be read at all, and then it counts
// for a week from the request (agent_core's confirmedNow).
function coreConfirmedStart(req: any, createdMs: number): number | null {
  if (req.confirmed_start) return Date.parse(String(req.confirmed_start)) || null;
  const day = resolveRequestDate(req.confirmed_day || req.day1, req.message_text, new Date(createdMs || Date.now()));
  if (!day) return null;
  const hm = String(req.confirmed_time || req.time1 || "").match(/\b(\d{1,2})[:.h](\d{2})\b/);
  return hm ? madridInstant(day, Math.min(23, +hm[1])).getTime() + Math.min(59, +hm[2]) * 60e3 : madridInstant(day, 21).getTime();
}
function coreConfirmedStillAhead(req: any, createdMs: number): boolean {
  const start = coreConfirmedStart(req, createdMs);
  return start !== null ? start > Date.now() - 2 * 3600e3 : !!createdMs && Date.now() - createdMs < 7 * 86400e3;
}
// What the core is told about the booking, read fresh every turn: the open
// request and how many studios really have it (askedStudios, the rows are the
// truth), the offer in front of them with address and price, a confirmed
// booking. A request counts as live for three days, the gender gate's window.
async function coreBookingFacts(s: Session, L: string): Promise<CoreBooking> {
  const out: CoreBooking = { live: null, offer: null, confirmed: null, returning: null };
  const num = "+" + digitsOf(s.phone);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent(num)}&stage=neq.dismissed&order=created_at.desc&limit=1&select=id,service_name,studio_name,partner_id,day1,time1,area,stage,confirmed_day,confirmed_time,confirmed_start,created_at,message_text`, { headers: H() });
  const req = ((await r.json().catch(() => [])) || [])[0] || null;
  if (req) {
    const id = Number(req.id), stage = String(req.stage || "");
    const createdMs = Date.parse(String(req.created_at || "")) || 0;
    if ([...OPEN_STAGES, "needs_contact"].includes(stage) && Date.now() - createdMs < 3 * 86400e3) {
      out.live = { id, stage, massage: String(req.service_name || ""), day: String(req.day1 || ""), time: String(req.time1 || ""), area: String(req.area || ""), studios_asked: await askedStudios(id), createdMs };
    } else if (stage === "confirmed" && coreConfirmedStillAhead(req, createdMs)) {
      const pc = req.partner_id ? await partnerCard(String(req.partner_id)) : null;
      out.confirmed = {
        id, studio: String(pc?.business_name || req.studio_name || ""), day: String(req.confirmed_day || req.day1 || ""), time: String(req.confirmed_time || req.time1 || ""),
        address: String(pc?.address || ""), price_text: req.partner_id ? await offerPriceText(id, String(req.partner_id), String(req.service_name || ""), "", L) : "",
        startMs: coreConfirmedStart(req, createdMs), createdMs,
      };
    } else out.returning = { name: String(s.data.known?.name || ""), last: `#${id}, ${req.service_name || "massage"}, ${req.day1 || ""}, ${stage}` };
  }
  const o = s.data.offer;
  if (o && o.row) {
    // The same test reshowOffer makes: only an offer still on the table.
    const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?id=eq.${encodeURIComponent(String(o.row))}&select=partner_id,offered_time,outcome`, { headers: H() });
    const d = ((await dr.json().catch(() => [])) || [])[0];
    if (d && d.offered_time && ["", "pending", "accepted"].includes(String(d.outcome || ""))) {
      const pc = d.partner_id ? await partnerCard(String(d.partner_id)) : null;
      const where = [pc?.address, pc?.neighbourhood && !String(pc?.address || "").includes(pc.neighbourhood) ? pc.neighbourhood : ""].filter(Boolean).join(", ");
      out.offer = {
        row: String(o.row), studio: String(pc?.business_name || o.studio || ""), time: String(o.time || d.offered_time || ""), day: String(o.day || ""), address: where,
        price_text: d.partner_id ? await offerPriceText(Number(o.request || 0), String(d.partner_id), String(out.live?.massage || ""), "", L) : "",
      };
    }
  }
  if (!out.returning && !out.live && !out.confirmed && s.data.known?.name) out.returning = { name: String(s.data.known.name), last: "" };
  return out;
}
// Copied from the email block in handleInner, which now calls this too: the
// address goes onto their open request, only into a blank.
async function attachEmail(from: string, addr: string): Promise<number | null> {
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent("+" + digitsOf(from))}&contact_email=is.null&stage=not.in.(cancelled,dismissed)&order=created_at.desc&limit=1&select=id`, { headers: H() });
  const prow = (await pr.json().catch(() => []))[0] || null;
  if (!prow?.id) return null;
  await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${prow.id}`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
    body: JSON.stringify({ contact_email: addr }),
  }).catch((e) => console.log("[wa] late email not saved to request", String(e)));
  return Number(prow.id) || null;
}
// The unprompted "Girl" branch of the gender gate: a preference lands on a
// request that is live right now (v183), never on last month's booking.
async function genderOnLiveRequest(from: string, g: string): Promise<number | null> {
  const LIVE_GREQ = ["new", "needs_contact", "studio_asked", "studio_replied", "offered", "bidding"];
  const greq = await lastRequestFor(from);
  if (!greq || !LIVE_GREQ.includes(String(greq.stage || "")) || Date.parse(String(greq.created_at || 0)) <= Date.now() - 3 * 86400e3 || String(greq.therapist_gender || "") === g) return null;
  await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${greq.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ therapist_gender: g }) });
  await logEvent(from, "therapist_gender_on_request", { id: greq.id, gender: g, via: "core" });
  return Number(greq.id) || null;
}
// "Cancel" on a request no studio has made an offer on yet. The request is
// closed and the customer told plainly; every studio still holding it hears
// so from dispatch-studios' chase sweep, inside its own hours, which is the
// rule for a customer who cancels (the same as cancelOffered, v204).
async function cancelOpenRequest(s: Session, from: string, L: string, text: string): Promise<boolean> {
  // v206 review: needs_contact too. coreBookingFacts counts a request parked
  // for no email as live, and "please cancel it" was told there was nothing
  // to cancel while it stayed parked and Jordan was never told.
  const CANCELLABLE = [...OPEN_STAGES, "needs_contact"];
  const lr = await lastRequestFor(from);
  if (!lr || !CANCELLABLE.includes(String(lr.stage || ""))) return false;
  const up = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${Number(lr.id)}&stage=in.(${CANCELLABLE.join(",")})`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({ stage: "cancelled", customer_flag: "cancelled", stage_note: "Cancelled by the customer on WhatsApp before any offer (wa-bot v206)", stage_updated_at: new Date().toISOString() }),
  });
  const rows = await up.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return false;
  await sendText(from, OFFER_COPY[L === "es" ? "es" : "en"].cancelled);
  s.step = "done"; s.data.offer = null; await saveSession(s);
  await logEvent(from, "request_cancelled", { request_id: lr.id, via: "core" });
  await notifyJordanWa(`${s.wa_name || "+" + digitsOf(from)} cancelled #${lr.id} before any offer: ${text.slice(0, 120)}. The studios still holding it are told by the chase sweep.`, from);
  return true;
}
// Lifted out of the job-seeker gate in handleInner, which calls it too.
// v204 review: only a plain ask for work ("explicit") closes a request a studio
// has already been asked about.
async function closeAsJobSeeker(s: Session, from: string, L: string, text: string, jobKind: "explicit" | "job") {
  const wasAt = s.step;
  s.step = "human"; s.data.offer = null; s.data.jobSeeker = true; await saveSession(s);
  await sendText(from, COPY[L].jobSeeker);
  const since3 = new Date(Date.now() - 3 * 86400e3).toISOString();
  const jobStages = jobKind === "explicit" ? "new,needs_contact,awaiting_go,studio_asked,studio_replied,offered,bidding" : "new,needs_contact,awaiting_go";
  const jr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent("+" + digitsOf(from))}&stage=in.(${jobStages})&created_at=gte.${since3}`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({ stage: "dismissed", stage_note: "Job seeker, not a customer (wa-bot v204)", stage_updated_at: new Date().toISOString() }),
  }).catch(() => null);
  const jrows = jr ? await jr.json().catch(() => []) : [];
  const closed = (Array.isArray(jrows) ? jrows : []).map((x: any) => x?.id).filter(Boolean);
  await logEvent(from, "job_seeker", { step: wasAt, kind: jobKind, closed, said: text.slice(0, 80) });
  await notifyHuman(s, text);
}
let coreCtxMemo: CoreCtx | null = null;
function coreCtx(): CoreCtx {
  if (coreCtxMemo) return coreCtxMemo;
  coreCtxMemo = {
    now: () => Date.now(),
    fetch: (url: string, init: Record<string, any>) => fetch(url, init),
    aiKey,
    model: CORE_MODEL,
    fallbackModel: AI_MODEL,
    facts: agentFacts,
    thread: coreThread,
    myInboundId: coreInboundId,
    newerInbound: coreNewerInbound,
    // v206 review: the v39 test, so a confirmed booking is only cancelled or
    // moved on the customer's own words (or their tap on the rc_ button).
    ownWords: (t: string, kind: "cancel" | "change") => kind === "cancel" ? (CANCEL_RE.test(t) || DECLINE_RE.test(t)) : (CHANGE_RE.test(t) && !GOODBYE_RE.test(t)),
    bookingFacts: coreBookingFacts,
    openerFacts,
    profileFirstName: firstNameFromProfile,
    saveSession,
    logEvent,
    dropStaleDay,
    dayLabel: (iso: string, L: string) => { const d = flowDay(iso, L); return d ? { day: d.day, dayDate: d.dayDate } : null; },
    earliestLabel: (L: string) => String(COPY[L === "es" ? "es" : "en"].earliestToday),
    isEmail, parseName, detectService, detectAreaPlus,
    hours: HOURS,
    noDashes, dashRanges, stripUnaskedLink, linkAsked,
    studioNames: studioNameList,
    sendText, sendButtons, sendList,
    dayButtons: dayBtns, timeButtons: timeBtns, areaRows: areaListRows,
    sendReservePage,
    studioOptions,
    finalizeBooking,
    askedStudios,
    lastOutbound: coreLastOutbound,
    reshowOffer,
    declineOffer: (rowId: string, from: string, L: string, s: Session, mode: "time" | "alt") => declineOffer(rowId, from, L, s, mode),
    cancelOffered,
    reconfirm: (kind: "change" | "cancel", reqId: string, from: string, L: string, s: Session) => handleCustomerReconfirm(kind, reqId, from, L, s),
    cancelOpenRequest,
    genderOnLiveRequest,
    attachEmail,
    closeAsJobSeeker,
    blockLine: (L: string) => (L === "es" ? BLOCK_LINE_ES : BLOCK_LINE_EN),
    notifyJordan: (text: string, aboutPhone: string) => notifyJordanWa(text, aboutPhone),
    notifyHuman,
  };
  return coreCtxMemo;
}
// ---- v206 agent_core: end ----

// v87: the guarantee behind Jordan's "always respond" rule (12 Sept). handleInner
// has 45 return points and several of them answer nothing at all, which is how
// twelve threads ended with the customer's or the studio's message last, one of
// them a partner complaining about a no-show that sat unanswered for eight days.
//
// Rather than patch every branch, wrap the whole thing: if a real inbound
// message came in and nothing at all went back, say something. Common sense is
// encoded as the exceptions, which is what Jordan asked for: a goodbye or a
// thank-you needs no reply, a muted number gets nothing ever, and a reaction or
// a delivery receipt is not a message. Jordan hears about every one of these,
// because a fallback firing means a branch somewhere answered nothing.
const handler = async (req: Request) => {
  sentThisTurn = false;
  quietThisTurn = false;
  // v139: the founder's reply-as-bot page. Not a Meta webhook, so it is routed
  // before the webhook body is read and never reaches the fallback below.
  const url = new URL(req.url);
  if (req.method === "OPTIONS" && (url.searchParams.has("inbox") || url.searchParams.has("reply") || url.searchParams.has("billing") || url.searchParams.has("invoice") || url.searchParams.has("offer") || url.searchParams.has("note"))) return new Response(null, { status: 204, headers: CORS });
  // v199: the customer's Yes / No page for an emailed offer, and the page a
  // studio lands on after tapping a time in its email.
  if (url.searchParams.has("offer")) {
    try { return await offerPage(url); } catch (e) {
      console.log("[wa] offer page failed", String(e));
      return pageOut(url, simpleCard("Massage Club", "Something went wrong. Please reply to us on WhatsApp and we will sort it out.", ""), 500);
    }
  }
  if (url.searchParams.has("note")) return notePage(url);
  if (url.searchParams.has("billing") || url.searchParams.has("invoice")) {
    try { return url.searchParams.has("billing") ? await billingPage(url) : await invoicePage(url); } catch (e) {
      console.log("[wa] billing page failed", String(e));
      return new Response("Something went wrong loading this page.", { status: 500 });
    }
  }
  if (url.searchParams.has("inbox")) {
    try { return await inboxPage(url); } catch (e) {
      console.log("[wa] inbox page failed", String(e));
      return new Response("Something went wrong loading the inbox.", { status: 500 });
    }
  }
  // v163: a saved voice note, for the reply page's player. The sig is the
  // same per-customer signature as the reply link, so it opens only that
  // customer's own recordings.
  if (url.searchParams.has("media")) {
    const mp = String(url.searchParams.get("media") || "");
    const m = /^([0-9]{6,15})\/[0-9]+\.(ogg|mp3|m4a|amr)$/.exec(mp);
    if (!m || String(url.searchParams.get("sig") || "") !== (await replySig(m[1]))) return new Response("not found", { status: 404 });
    const obj = await fetch(`${SUPABASE_URL}/storage/v1/object/wa-media/${mp}`, { headers: H() });
    if (!obj.ok) return new Response("not found", { status: 404 });
    return new Response(obj.body, { status: 200, headers: { "Content-Type": obj.headers.get("content-type") || "audio/ogg", "Cache-Control": "private, max-age=3600", "Access-Control-Allow-Origin": "*" } });
  }
  if (url.searchParams.has("reply")) {
    try { return await replyPage(req, url); } catch (e) {
      console.log("[wa] reply page failed", String(e));
      return new Response("Something went wrong loading this page.", { status: 500 });
    }
  }
  let raw = "";
  try { raw = await req.text(); } catch { /* empty body */ }
  const res = await handleInner(new Request(req.url, { method: req.method, headers: req.headers, body: raw || null }));
  try {
    const p = raw ? JSON.parse(raw) : null;
    const m = p?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = digitsOf(String(m?.from || ""));
    const said = String(m?.text?.body || m?.button?.text || "");
    const isReaction = m?.type === "reaction";
    if (m && from && !sentThisTurn && !quietThisTurn && !isReaction && !TEST_PHONES.includes(from)) {
      const s = await getSession(from);
      const closed = GOODBYE_RE.test(said) || ACK_ONLY_RE.test(said) || /\b(have a (good|nice|lovely) (day|one|evening|night)|good night|buenas noches|buen d[ií]a|que vaya bien|igualmente)\b/i.test(said);
      if (s.step !== "muted" && !closed) {
        // v100: the session language describes customers. A studio has no
        // session language, so it was reading the English holding line. A
        // partner number gets Spanish.
        const isStudio = !!(await findPartnerByNumber(from));
        const L = (s.data.lang === "es" || isStudio) ? "es" : "en";
        // v163: the holding line once per ten minutes, not once per message.
        // +34 610 393 816 sent eight voice notes and got it six times. Jordan
        // still hears about every one.
        // v212: a studio gets its own holding line (vosotros, no promise).
        const ack = isStudio ? STUDIO_FALLBACK_ACK : COPY[L].fallbackAck;
        const repeat = await sentRecently(from, ack, 10 * 60e3) || (MEDIA_TYPES.includes(String(m?.type)) && await sentRecently(from, MEDIA_LINE[L], 10 * 60e3));
        // v188: a customer standing on a booking question gets that question
        // again, not a promise to come back. 13 of the holding lines went to
        // people at the day question.
        const flowStep = !isStudio && ["await_service", "await_day", "await_day_text", "await_time", "await_hour", "await_time_text", "await_area", "await_name", "await_email", "await_email_req"].includes(s.step);
        if (flowStep) { if (!(await greetedRecently(from, 90_000))) await reAsk(s, from, L); }
        else if (!repeat) await sendText(from, ack);
        await logEvent(from, "fallback_ack", { step: s.step, said: said.slice(0, 120), held: repeat, type: m?.type, reasked: flowStep });
        await notifyJordanWa(`${flowStep ? "Nothing was sent back, so they got their booking question again" : repeat ? "No reply sent (holding line already sent)" : "Nothing was sent back, so they got the holding line"} to +${from} (step ${s.step}). They ${m?.type === "audio" ? "sent a voice note, playable on the reply page" : "said: " + said.slice(0, 140)}`, from).catch(() => {});
      }
    }
  } catch (e) { console.log("[wa] fallback check failed", String(e)); }
  return res;
};

export function start(cfg: { waToken?: string; resendKey?: string; opsKey?: string; aiKey?: string; confirmLaterReminders?: boolean; bookingFlowId?: string; offerChase?: boolean } = {}) {
  if (cfg.bookingFlowId) BOOKING_FLOW_ID = cfg.bookingFlowId;
  if (cfg.confirmLaterReminders) CONFIRM_LATER_REMINDERS = true;
  if (cfg.offerChase === false) OFFER_CHASE = false;
  if (cfg.aiKey) AI_KEY = cfg.aiKey;
  if (cfg.waToken) WA_TOKEN = cfg.waToken;
  if (cfg.resendKey) RESEND_API_KEY = cfg.resendKey;
  if (cfg.opsKey) OPS_KEY = cfg.opsKey;
  Deno.serve(handler);
}
// v54: what a studio hears when it answers a request that is no longer open.
// v212 (16 Oct): one coveredLine for the whole bot. "Ha cancelado" only when
// the customer really did (customer_flag cancelled); a request Jordan closed,
// a muted customer or a test "no sigue adelante". "Ya ha reservado en otro
// centro" only for a request confirmed with ANOTHER studio: callers never use
// it for an open request or for the studio holding the booking. The client and
// the day are named; "esa cita" (it was never booked) and the promise "Os
// escribo con la siguiente" are gone. dayEs is studioDayEs(req).
const coveredLine = (stage: string, name = "", byCustomer = false, dayEs = ""): string => {
  const dd = deDay(dayEs);
  if (stage === "cancelled" && byCustomer) return `Gracias. Al final ${name || "el cliente"} ha cancelado${dd ? " lo " + dd : ""}, así que no hace falta que le guardéis hueco.`;
  if (stage === "cancelled" || stage === "dismissed") return `Gracias. Al final lo de ${name || "este cliente"}${dd ? " " + dd : ""} no sigue adelante, así que no hace falta que le guardéis hueco.`;
  if (stage === "confirmed") return `Gracias. ${name || "El cliente"} ya ha reservado en otro centro${dayEs ? " para " + dayEs : ""}, así que no hace falta que le guardéis hueco. A la próxima.`;
  return `Gracias. Lo de ${name || "este cliente"}${dd ? " " + dd : ""} ya está cerrado, así que no hace falta que hagáis nada.`;
};

// v214: a studio's friendly sign-off ("vale", "gracias", "quedo atenta", an
// emoji), as opposed to a question or anything new.
const STUDIO_THANKS = "¡Gracias a vosotros! Que tengáis buen día.";
const studioAck = (t: string): boolean => {
  const s = String(t || "").trim();
  return !!s && s.length <= 200 && !s.includes("?") && !/\b([01]?\d|2[0-3])[:.h][0-5]\d\b/.test(s) &&
    /(vale|\bok\b|okay|gracias|perfecto|genial|entendido|de acuerdo|no te preocupes|no pasa nada|sin problema|igualmente|quedo|quedamos|atent[ao]s?|saludos?|buen d[ií]a|buenas tardes|👍|🙏|😊|🥰|❤|😘|🤗|🙌)/i.test(s);
};

const handleInner = async (req: Request) => {
  let payload: any = null;
  try { payload = await req.json(); } catch { return new Response("OK", { status: 200 }); }

  try {
    // v46: cron closes bidding windows through here (key-guarded, no Meta payload).
    if (payload?.ops === "settle") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      // v204 review (12 Oct): { ops: "settle", only: "3460000" } is the
      // canary's settle. It runs only the v204 sweeps, and only for the fake
      // 3460000xxxx numbers, because every sweep here reads every session and
      // request in the database: run on wa-bot-canary without it, the code under
      // test would chase, lapse and tell real customers and write to real studios.
      const only = /^3460000\d{0,4}$/.test(String(payload.only || "")) ? String(payload.only) : "";
      if (only) {
        const released = await releaseHeldOffers(only);
        const offers = await chaseOffers(only);
        const watched = await watchRequests(only);
        return new Response(JSON.stringify({ ok: true, only, released, chased: offers.chased, lapsed: offers.lapsed, stuck: watched.stuck, told_no_offer: watched.told }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const settled = await settleBids();
      // v83: the review ask rides on the same sweep rather than its own cron.
      const reviewed = await askForReviews();
      // v124: the day-before reminder rides here too. Returns 0 while it is off.
      const reminded = await remindConfirmLater();
      // v204: same-day offers held back for the customer's own window go out
      // once the 15 minutes are up, and an offer nobody answered is followed up
      // once, then let go honestly before the studio is left holding it.
      const released = await releaseHeldOffers();
      const offers = await chaseOffers();
      // v204 (change 3): a request that reached no studio pages Jordan after 10
      // minutes, and one nothing came back on is told so and offered another day.
      const watched = await watchRequests();
      // v204 review: studio notes that were refused for the hour or the
      // studio's own hours go out once it is open (studioNoteSure).
      const notes = await flushStudioNotes();
      return new Response(JSON.stringify({ ok: true, settled, reviewed, reminded, released, chased: offers.chased, lapsed: offers.lapsed, stuck: watched.stuck, told_no_offer: watched.told, studio_notes: notes }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // v192 (9 Oct, live): William made request #110 on the website, then wrote
    // here "Can you send me the offers here?" and was told "I'll message you
    // here as soon as one says yes". The Nook said yes from its offer email two
    // minutes later. studio-times emailed him (no address) and this chat heard
    // nothing. studio-times now hands every email-tap confirmation to this
    // endpoint: the customer is told in their open chat, with the address, the
    // booking row is written and the other studios are stood down. The email
    // already went from studio-times, so this is WhatsApp only, once.
    if (payload?.ops === "email_confirmed") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const id = Number(payload.request_id || 0);
      const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${id}&select=*`, { headers: H() });
      const req = (await rr.json().catch(() => []))[0];
      const out = (o: Record<string, unknown>) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
      if (!req || req.stage !== "confirmed" || !req.partner_id) return out({ ok: false, reason: "not a confirmed request with a studio" });
      const seen = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?event=eq.email_confirm_relayed&meta->>request_id=eq.${id}&select=id&limit=1`, { headers: H() });
      if ((await seen.json().catch(() => [])).length) return out({ ok: true, already: true });
      await awardRequest(id, req.partner_id);
      await ensureBooking(id);
      const L = req.languages === "es" ? "es" : "en";
      const pc = await partnerCard(req.partner_id);
      const day = String(req.confirmed_day || req.day1 || ""), time = String(req.confirmed_time || req.time1 || "");
      const when = time && day.includes(time) ? day : [day, time].filter(Boolean).join(L === "es" ? " a las " : " at ");
      const text = COPY[L].studioConfirmed(String(req.first_name || "").split(" ")[0], req.studio_name || pc.business_name || (L === "es" ? "el centro" : "the studio"), trSvcLow(req.service_name || "massage", L), when) + (pc.address ? `\n📍 ${pc.address}` : "");
      const phone = digitsOf(String(req.client_phone || ""));
      let sent = false;
      if (phone && await waWindowOpen(phone)) sent = await sendText(phone, text);
      await logEvent(phone || "system", "email_confirm_relayed", { request_id: String(id), sent, studio: req.studio_name });
      return out({ ok: true, sent });
    }
    // v199 (Jordan, 10 Oct: "we need to make sure both parties confirm"). A
    // studio tapped a time in its offer email (studio-times). That is the
    // studio's half: the time becomes an offer the customer has to tap Yes on,
    // on WhatsApp or on the emailed offer page, exactly like a WhatsApp yes.
    // v203 (12 Oct): the yes can also come from a phone call (studio-calls).
    // payload.channel says which ask it answered, 'email' by default or 'call',
    // and is kept on the dispatch row and in the reply label.
    if (payload?.ops === "studio_offer") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const out = (o: Record<string, unknown>) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
      const channel = payload.channel === "call" ? "call" : "email";
      const id = Number(payload.request_id || 0);
      const pid = String(payload.partner_id || "").replace(/[^a-fA-F0-9-]/g, "");
      const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${id}&select=*`, { headers: H() });
      const req = (await rr.json().catch(() => []))[0];
      if (!req || !pid) return out({ ok: false, reason: "no request or studio" });
      if (["confirmed", "cancelled", "dismissed", "no_show", "needs_review"].includes(String(req.stage || ""))) return out({ ok: false, reason: `request is ${req.stage}` });
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(pid)}&select=id,business_name,whatsapp,phone`, { headers: H() });
      const p = (await pr.json().catch(() => []))[0];
      if (!p) return out({ ok: false, reason: "no such studio" });
      const rawTime = String(payload.time || "");
      const tm = rawTime.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/) || String(payload.day || "").match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
      const time = tm ? `${tm[1].padStart(2, "0")}:${tm[2]}` : exactTime(req);
      if (!time) return out({ ok: false, reason: "no exact time to offer" });
      const dayRaw = String(payload.day || "").replace(/,?\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*$/, "").trim();
      const now = new Date().toISOString();
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?on_conflict=request_id,partner_id`, {
        method: "POST", headers: { ...H(), Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ request_id: id, partner_id: pid, phone: digitsOf(String(p.whatsapp || p.phone || "")), outcome: "accepted", accepted_at: now, replied_at: now, channel }),
      });
      const row = (await ins.json().catch(() => []))[0];
      if (!row?.id) return out({ ok: false, reason: "could not record the offer" });
      // v203: an emailed time is one of the options we put to the studio. A time
      // said on the phone can be any hour, so it gets the v122 window check like
      // a WhatsApp yes, and "instead of" when it is not what was asked.
      const sent = await forwardOffer(req, { id: String(p.id), business_name: String(p.business_name || "") }, String(row.id), time, `Sí, a las ${time} (${channel === "call" ? "llamada" : "email"})`, "", { dayHint: dayRaw, ownOption: channel !== "call" });
      await logEvent(digitsOf(String(req.client_phone || "")) || "web", "studio_accepted", { id, studio: p.business_name, time, via: channel, offer: sent });
      if (channel === "call") {
        const studioWa = digitsOf(String(row.phone || p.whatsapp || p.phone || ""));
        if (sent === "withheld_mismatch") {
          // The phone has no thread to answer on, so nobody tells the studio.
          await notifyJordanWa(`${p.business_name} said on the phone they can do ${time} for ${req.first_name || "the customer"}'s request #${id}, outside the ${String(req.time1 || "time")} asked for. Not shown to the customer. Nothing booked.`, digitsOf(String(req.client_phone || "")));
        } else if (!row.quoted_price && studioWa && ["whatsapp", "email", "none", "queued", "held_window", "held"].includes(sent)) {
          // A WhatsApp yes is asked for the 10% Massage Club rate in writing
          // (priceAsk); the call never mentions a discount, so this does. The
          // aviso templates carry it when their 24h window is shut.
          // v212 (16 Oct): only after an offer that went (or will go) to the
          // customer, the same list as the WhatsApp price ask, never after a
          // withheld or muted one. The client, the day and the hour in words,
          // the request's own duration, Jordan in the singular, and "Estoy
          // preguntando a varios centros" only when several really were asked.
          // The template form is a statement, so v1 never reads "?.".
          const first = String(req.first_name || "").trim().split(" ")[0];
          const cdd = (dayRaw ? resolveRequestDate(dayRaw, "") : null) || studioDate(req);
          const cDayEs = studioDayOf(cdd);
          const mins = reqDuration(req);
          const several = await severalAsked(id);
          const rate = several
            ? "Estoy preguntando a varios centros y se queda con la mejor oferta, así que si podéis hacerle un 10% como cliente de Massage Club, decídmelo."
            : "Si podéis hacerle un 10% como cliente de Massage Club, decídmelo.";
          const lo = [deDay(cDayEs), `a las ${time}`].filter(Boolean).join(" ");
          await tellStudio(studioWa, first, time,
            `Hola, gracias por atendernos antes por teléfono. Para lo de ${first || "nuestro cliente"} ${lo}, ¿qué precio final le dejaríais por ${mins} min? ${rate}`,
            several
              ? `me dijisteis por teléfono que tenéis hueco; estoy preguntando a varios centros y se queda con la mejor oferta, así que si podéis hacerle un 10% como cliente de Massage Club, decidme el precio final por ${mins} min`
              : `me dijisteis por teléfono que tenéis hueco; si podéis hacerle un 10% como cliente de Massage Club, decidme el precio final por ${mins} min`,
            { dayEs: cDayEs, v2: `Me dijisteis por teléfono que tenéis hueco: ¿qué precio final le dejaríais por ${mins} min? ${rate}` });
        }
      }
      return out({ ok: true, row: row.id, time, offer: sent });
    }
    // v202 (12 Oct): close a request the bot built from garbage and put the
    // chat back at the day question, sending nothing. Salado's ad line became
    // his area and a request with no day was queued for the 09:00 studio run;
    // the SQL console was waiting on approvals all night. Only a request that
    // no studio has been asked about yet (new, needs_contact, awaiting_go), and only
    // when it belongs to the phone given.
    if (payload?.ops === "reset_chat") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const out = (o: Record<string, unknown>) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
      const phone = digitsOf(String(payload.phone || ""));
      if (!phone) return out({ ok: false, reason: "no phone" });
      let dismissed: number | null = null;
      let id = Number(payload.request_id || 0);
      if (!id && payload.latest) {
        const since = new Date(Date.now() - 36 * 3600e3).toISOString();
        const lr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=ilike.*${phone}&stage=in.(new,needs_contact,awaiting_go)&created_at=gte.${since}&order=id.desc&limit=1&select=id`, { headers: H() });
        id = Number(((await lr.json().catch(() => []))[0] || {}).id || 0);
        if (!id) return out({ ok: false, reason: "no undispatched request in the last 36h" });
      }
      if (id) {
        const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${id}&select=id,stage,client_phone,area,day1,time1`, { headers: H() });
        const req = (await rr.json().catch(() => []))[0];
        if (!req || digitsOf(String(req.client_phone || "")) !== phone) return out({ ok: false, reason: "request does not belong to this phone" });
        if (!["new", "needs_contact", "awaiting_go"].includes(String(req.stage || ""))) return out({ ok: false, reason: `request is ${req.stage}, not touched` });
        const up = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${id}&stage=in.(new,needs_contact,awaiting_go)`, {
          method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
          body: JSON.stringify({ stage: "dismissed", stage_note: String(payload.note || "reset_chat").slice(0, 200), stage_updated_at: new Date().toISOString() }),
        });
        const rows = await up.json().catch(() => []);
        if (!up.ok || !Array.isArray(rows) || !rows.length) return out({ ok: false, reason: "could not dismiss", status: up.status, body: rows });
        dismissed = id;
      }
      const s = await getSession(phone);
      const before = s.step;
      s.step = "await_day";
      s.data = { lang: s.data.lang || "", service: "svc_relax", defaultService: true, recoverySent: s.data.recoverySent || null, adRef: s.data.adRef || null, xlang: s.data.xlang || undefined };
      await saveSession(s);
      await logEvent(phone, "chat_reset", { by: "ops", from_step: before, dismissed });
      return out({ ok: true, dismissed, from_step: before, step: s.step });
    }
    // v66: read a message and return the reading, sending nothing. For checking
    // the interpreter against real sentences without a customer in the loop.
    if (payload?.ops === "interpret") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const reading = await interpret(String(payload.text || ""), Array.isArray(payload.history) ? payload.history : [], String(payload.state || "No booking on file yet."));
      return new Response(JSON.stringify({ ok: true, keyPresent: !!(await aiKey()), reading }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // v94: the watchdog. Every failure this week was found by a person reading
    // the database by hand, which is not a system and does not survive paid
    // traffic. Three checks, run on a cron, each tied to a loss that actually
    // happened:
    //
    //   STRANDED YES  a studio offered or accepted and the customer has said
    //                 nothing since. Deyanira (Sinergia38 "ambos confirmamos",
    //                 7 days), Sharo J (Calma 18:30, 7 days), Viko (KamAI won,
    //                 10 days), Asim (TornaSol 19:00 never answered, 6 days)
    //                 and Andy all sat here with nothing watching them.
    //   WINDOW CLOSING  a request is out to studios, we hold no email, and the
    //                 customer's 24h WhatsApp window is about to shut. When it
    //                 does they become unreachable with a studio holding a
    //                 slot, which is exactly how the first three above died.
    //   LEFT HANGING  the last message in a thread is theirs. Fernando's "MAN"
    //                 and Andy's "Mujer" were both answered with something
    //                 else entirely, and nothing noticed.
    //
    // Reports once per firing and only when something is wrong, so a quiet day
    // costs no email. { ops: "watchdog", key, dry } lists without sending.
    // v132 (Jordan, 28 Sept): the funnel report, counted rather than estimated.
    // This session has no SQL, so the monthly funnel could not be rebuilt at all.
    // One narrow read behind the ops key beats being blind: it takes a date
    // range and returns distinct PEOPLE per step, which is the only honest unit
    // (one person tapping twice is not two people).
    // v137 (Jordan, 29 Sept): "learn from all the data we have so far".
    // Every gap found this week was found the same way: read one conversation,
    // notice that an ordinary sentence was answered with the wrong thing. That
    // does not scale and it is why there were five in four days. This op is the
    // scalable version: it hands back every inbound CUSTOMER message ever
    // recorded, so the whole lexicon in copy.ts can be run over the whole corpus
    // offline and the messages that match nothing can be listed. Read-only, ops
    // key, no writes, no sends. Studios and test numbers are stripped: a studio
    // saying "vale" is not a customer the bot failed to understand.
    // v210: dispatch-studios and the studio offer emails send their studio
    // messages through here too, so Jordan gets every one in the same card,
    // with the English, whichever function wrote it.
    if (payload?.ops === "studio_copy") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const phone = digitsOf(String(payload.phone || ""));
      const text = String(payload.text || "").slice(0, 3000);
      const name = String(payload.studio || "").slice(0, 120);
      if (!text || (!phone && !name)) return new Response(JSON.stringify({ ok: false, error: "phone or studio, and text" }), { status: 400 });
      await copyStudioSend(phone, payload.channel === "Email" ? "Email" : "WhatsApp", text, { studio: name ? { business_name: name } : undefined, subject: payload.subject ? String(payload.subject).slice(0, 200) : undefined });
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }
    if (payload?.ops === "corpus") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const from = String(payload.from || "").slice(0, 10) || "2026-01-01";
      const to = String(payload.to || "").slice(0, 10) || "2099-12-31";
      const lo = `${from}T00:00:00Z`, hi = `${to}T23:59:59Z`;
      const TESTNUM = ["34612474827", "15622355063", "17867276503"];
      const isTestPhone = (ph: string) => {
        const d = digitsOf(ph);
        return TESTNUM.includes(d) || (d.startsWith("86") && d.endsWith("997"));
      };
      const out: Record<string, unknown>[] = [];
      for (let off = 0; off < 60000; off += 1000) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?select=phone,direction,body,msg_type,created_at&direction=eq.in&created_at=gte.${lo}&created_at=lte.${hi}&order=created_at.asc&offset=${off}&limit=1000`, { headers: H() });
        if (!r.ok) break;
        const rows = await r.json().catch(() => []);
        if (!Array.isArray(rows) || !rows.length) break;
        out.push(...rows);
        if (rows.length < 1000) break;
      }
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?select=phone,whatsapp&limit=800`, { headers: H() });
      const prows = await pr.json().catch(() => []);
      const studioNums = new Set((Array.isArray(prows) ? prows : []).flatMap((x: any) => [digitsOf(x.whatsapp), digitsOf(x.phone)]).filter(Boolean));
      let skippedStudio = 0, skippedTest = 0;
      const msgs: Array<{ phone: string; at: string; type: string; body: string }> = [];
      for (const m of out) {
        const ph = digitsOf(String(m.phone || ""));
        if (!ph) continue;
        if (isTestPhone(ph)) { skippedTest++; continue; }
        if (studioNums.has(ph)) { skippedStudio++; continue; }
        const body = String(m.body || "");
        if (!body.trim()) continue;
        msgs.push({ phone: ph, at: String(m.created_at || ""), type: String(m.msg_type || "text"), body });
      }
      return new Response(JSON.stringify({
        ok: true, from, to,
        total: out.length, skippedStudio, skippedTest,
        people: new Set(msgs.map((m) => m.phone)).size,
        messages: msgs,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (payload?.ops === "funnel") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const from = String(payload.from || "").slice(0, 10) || "2026-09-01";
      const to = String(payload.to || "").slice(0, 10) || "2026-12-31";
      const lo = `${from}T00:00:00Z`, hi = `${to}T23:59:59Z`;
      // Test traffic never counts. Jordan's own two numbers, the friend testers,
      // and the +86 number ending 997.
      const TESTNUM = ["34612474827", "15622355063", "17867276503"];
      const isTestPhone = (ph: string) => {
        const d = digitsOf(ph);
        return TESTNUM.includes(d) || (d.startsWith("86") && d.endsWith("997"));
      };
      const pull = async (path: string) => {
        const out: Record<string, unknown>[] = [];
        for (let off = 0; off < 40000; off += 1000) {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}&offset=${off}&limit=1000`, { headers: H() });
          if (!r.ok) break;
          const rows = await r.json().catch(() => []);
          if (!Array.isArray(rows) || !rows.length) break;
          out.push(...rows);
          if (rows.length < 1000) break;
        }
        return out;
      };
      const msgs = await pull(`wa_messages?select=phone,direction,body,created_at&created_at=gte.${lo}&created_at=lte.${hi}&direction=eq.in`);
      const evs = await pull(`funnel_events?select=phone,event,created_at&created_at=gte.${lo}&created_at=lte.${hi}`);
      const people = new Set<string>(), adPeople = new Set<string>();
      for (const m of msgs) {
        const ph = digitsOf(String(m.phone || ""));
        if (!ph || isTestPhone(ph)) continue;
        people.add(ph);
        if (/\[via ad\]/i.test(String(m.body || ""))) adPeople.add(ph);
      }
      const byEvent: Record<string, Set<string>> = {};
      for (const e of evs) {
        const ph = digitsOf(String(e.phone || ""));
        const ev = String(e.event || "");
        if (!ph || !ev || isTestPhone(ph)) continue;
        (byEvent[ev] ||= new Set<string>()).add(ph);
      }
      const anyOf = (...names: string[]) => {
        const u = new Set<string>();
        for (const n of names) for (const ph of byEvent[n] || []) u.add(ph);
        return u;
      };
      const step = (label: string, set: Set<string>) => ({
        label,
        people: set.size,
        ad: [...set].filter((ph) => adPeople.has(ph)).length,
      });
      // "Said hello" must be people who actually started a booking chat, not
      // every phone that sent us anything: studios reply on the same number and
      // would pad the top of the funnel with their own messages. flow_started is
      // logged once when a customer opens a conversation, so that is the unit.
      const steps = [
        step("Said hello", anyOf("flow_started")),
        step("Chose a massage", anyOf("service_chosen")),
        step("Chose a day", anyOf("day_chosen")),
        step("Chose a time", anyOf("time_chosen")),
        step("Gave an area", anyOf("area_given")),
        step("Request created", anyOf("request_created")),
        step("A studio offered them a time", anyOf("studio_offered", "offer_forwarded")),
        step("A studio said yes", anyOf("studio_accepted")),
        step("Booking confirmed", anyOf("confirmed", "go_confirmed")),
        step("Walked in the door", anyOf("arrived", "customer_arrived")),
      ];
      const counts: Record<string, number> = {};
      for (const k of Object.keys(byEvent)) counts[k] = byEvent[k].size;
      // funnel_events only starts on 1 September 2026, the day the instrumentation
      // was added. For any window before that the steps above are all zero and the
      // only honest history is in the tables that predate it, so read those too.
      const reqs = await pull(`whatsapp_requests?select=id,created_at,client_phone,first_name,contact_email,stage,service_name,studio_name&created_at=gte.${lo}&created_at=lte.${hi}`);
      const bks = await pull(`bookings?select=id,created_at,booking_date,status,is_test,client_name,client_email,spa_name&created_at=gte.${lo}&created_at=lte.${hi}`);
      const reqStage: Record<string, number> = {};
      const reqPhones = new Set<string>();
      let reqWithEmail = 0;
      for (const r of reqs) {
        const ph = digitsOf(String(r.client_phone || ""));
        if (ph && isTestPhone(ph)) continue;
        if (ph) reqPhones.add(ph);
        reqStage[String(r.stage || "none")] = (reqStage[String(r.stage || "none")] || 0) + 1;
        if (String(r.contact_email || "").includes("@")) reqWithEmail++;
      }
      const bkStatus: Record<string, number> = {};
      const realBookings: Record<string, unknown>[] = [];
      for (const b of bks) {
        if (b.is_test === true) continue;
        bkStatus[String(b.status || "none")] = (bkStatus[String(b.status || "none")] || 0) + 1;
        realBookings.push({ date: b.booking_date, status: b.status, spa: b.spa_name, who: b.client_name });
      }
      const history = {
        requests: { total: reqs.length, people: reqPhones.size, withEmail: reqWithEmail, byStage: reqStage },
        bookings: { total: realBookings.length, byStatus: bkStatus, rows: realBookings.slice(0, 40) },
      };
      return new Response(JSON.stringify({
        ok: true, from, to,
        rows: { messages: msgs.length, events: evs.length },
        inboundPhones: people.size, adPeople: adPeople.size,
        steps, allEvents: counts, history,
      }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // v184: evaluate the reader on recorded cases without sending anything.
    // POST {"ops":"read_test","key":OPS,"model"?:..., "cases":[{"text","step","last_asked","known","history"}]}
    if (payload?.ops === "read_test") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const cases = Array.isArray(payload.cases) ? payload.cases.slice(0, 40) : [];
      const model = String(payload.model || (await readerConfig()).model);
      const key = await aiKey();
      const out = await Promise.all(cases.map((c: any) => readMessage({
        key, model, text: String(c.text || ""), step: String(c.step || "await_day"), lastAsked: String(c.last_asked || ""),
        known: c.known || {}, history: Array.isArray(c.history) ? c.history : [], madridNow: String(c.madrid_now || madridNowLabel()),
      })));
      return new Response(JSON.stringify({ ok: true, model, results: out }), { headers: { "Content-Type": "application/json" } });
    }

    if (payload?.ops === "watchdog") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const dry = !!payload.dry;
      const now = Date.now();
      const LIVE = ["offered", "studio_asked", "studio_replied", "bidding", "confirmed"];
      const stranded: string[] = [];
      const closing: string[] = [];
      const hanging: string[] = [];
      // One alarm per thing per day. Without this, every run while a condition
      // holds sends another email, which is how "Rescue acted on 1 stuck
      // booking" reached Jordan 27 times in a week and stopped being read.
      // The marker rides funnel_events so there is no new table to migrate.
      const seenR = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?event=eq.watchdog_alert&created_at=gte.${new Date(now - 20 * 3600e3).toISOString()}&select=meta`, { headers: H() });
      const seenRows = await seenR.json().catch(() => []);
      const seen = new Set((Array.isArray(seenRows) ? seenRows : []).map((x: any) => String(x?.meta?.key || "")).filter(Boolean));
      const fresh: Array<{ key: string; phone: string }> = [];
      const once = (key: string, phone: string, into: string[], line: string) => {
        if (seen.has(key)) return;
        seen.add(key);
        fresh.push({ key, phone });
        into.push(line);
      };

      const rq = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?stage=in.(${LIVE.join(",")})&select=id,first_name,client_phone,contact_email,service_name,stage,created_at,confirmed_start,reconfirmed_at,client_confirmed_at,customer_flag&order=id.desc&limit=60`, { headers: H() });
      const reqs = await rq.json().catch(() => []);
      for (const r of (Array.isArray(reqs) ? reqs : [])) {
        const ph = digitsOf(r.client_phone);
        if (!ph || TEST_PHONES.includes(ph) || /^3460000\d{4}$/.test(ph)) continue;
        const who = `#${r.id} ${r.first_name || "+" + ph}`;
        // The first dry run flagged Fernando's #67, which he reconfirmed on
        // 9 September and then attended. A watchdog that reports settled
        // history gets ignored, and this project already has one job that sent
        // the same line 27 times in a week. So: a booking whose time has passed
        // is history, a customer who has confirmed has answered, and anything
        // older than a fortnight is a graveyard entry rather than an alarm.
        const startedMs = r.confirmed_start ? Date.parse(r.confirmed_start) : 0;
        const settled = !!r.reconfirmed_at || !!r.client_confirmed_at || (startedMs > 0 && startedMs < now - 2 * 3600e3);
        const ageDays = (now - Date.parse(r.created_at)) / 86400e3;

        const lr = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${ph}&direction=eq.in&order=created_at.desc&limit=1&select=created_at`, { headers: H() });
        const lastIn = (await lr.json().catch(() => []))[0]?.created_at;
        const quietMs = lastIn ? now - Date.parse(lastIn) : Infinity;

        const dr = await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?request_id=eq.${r.id}&or=(offered_time.not.is.null,outcome.in.(accepted,won))&order=replied_at.desc&limit=1&select=partner_id,offered_time,outcome,replied_at`, { headers: H() });
        const off = (await dr.json().catch(() => []))[0];
        if (off && off.replied_at && !settled && ageDays <= 14) {
          const offAgeH = (now - Date.parse(off.replied_at)) / 3600e3;
          const answered = lastIn && Date.parse(lastIn) > Date.parse(off.replied_at);
          if (offAgeH >= 2 && !answered) {
            const pc = off.partner_id ? await partnerCard(off.partner_id) : { business_name: "" };
            once(`stranded:${r.id}`, ph, stranded, `${who}: ${pc.business_name || "a studio"} ${off.outcome === "won" || off.outcome === "accepted" ? "ACCEPTED" : "offered " + (off.offered_time || "a time")} ${Math.round(offAgeH)}h ago and they have said nothing since.`);
          }
        }

        // The window shuts 24h after their last inbound. Warn with 4h to spare,
        // and only when we have no email to fall back on.
        if (!r.contact_email && quietMs !== Infinity && !settled && ageDays <= 14) {
          const hoursLeft = 24 - quietMs / 3600e3;
          if (hoursLeft <= 4 && hoursLeft > -2) {
            once(`closing:${r.id}`, ph, closing, `${who}: no email on file and the WhatsApp window shuts in ${hoursLeft <= 0 ? "under an hour" : Math.round(hoursLeft) + "h"}. After that nothing reaches them.`);
          }
        }
      }

      // Left hanging: the last thing in the thread is theirs. Studios excluded,
      // they are answered by a different path and their silence is normal.
      const mr = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?created_at=gte.${new Date(now - 36 * 3600e3).toISOString()}&order=created_at.asc&select=phone,direction,body,created_at`, { headers: H() });
      const msgs = await mr.json().catch(() => []);
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/partners?select=phone,whatsapp&limit=400`, { headers: H() });
      const prows = await pr.json().catch(() => []);
      const studioNums = new Set((Array.isArray(prows) ? prows : []).flatMap((x: any) => [digitsOf(x.whatsapp), digitsOf(x.phone)]).filter(Boolean));
      const last: Record<string, any> = {};
      for (const m of (Array.isArray(msgs) ? msgs : [])) last[String(m.phone)] = m;
      for (const [ph, m] of Object.entries(last)) {
        if (m.direction !== "in") continue;
        if (TEST_PHONES.includes(ph) || studioNums.has(ph)) continue;
        const mins = (now - Date.parse(m.created_at)) / 60000;
        if (mins < 10 || mins > 36 * 60) continue;
        once(`hanging:${ph}:${m.created_at}`, ph, hanging, `+${ph}: "${String(m.body || "").slice(0, 70)}" ${mins < 90 ? Math.round(mins) + " min" : Math.round(mins / 60) + "h"} ago, still the last word in the thread.`);
      }

      const found = stranded.length + closing.length + hanging.length;
      if (found && !dry) {
        for (const f of fresh) {
          await fetch(`${SUPABASE_URL}/rest/v1/funnel_events`, {
            method: "POST", headers: { ...H(), Prefer: "return=minimal" },
            body: JSON.stringify({ phone: f.phone, event: "watchdog_alert", meta: { key: f.key } }),
          });
        }
        const lines = [
          stranded.length ? "A STUDIO SAID YES AND NOBODY CLOSED IT\n" + stranded.join("\n") : "",
          closing.length ? "\nABOUT TO BECOME UNREACHABLE\n" + closing.join("\n") : "",
          hanging.length ? "\nLEFT HANGING\n" + hanging.join("\n") : "",
        ].filter(Boolean).join("\n");
        await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_EMAIL, to: SUPPORT,
            subject: stranded.length ? `${stranded.length} studio yes${stranded.length > 1 ? "es" : ""} nobody has closed`
              : closing.length ? `${closing.length} about to become unreachable`
              : `${hanging.length} left hanging`,
            text: lines + "\n\nNothing here is automatic. Each line is someone waiting on a person.",
          }),
        });
      }
      return new Response(JSON.stringify({ ok: true, dry, found, stranded, closing, hanging }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // v90: read the approved template list, and send one template to one
    // number. Both ops key guarded.
    //
    // Written while checking whether Rufaro's unconfirmed 19:00 booking on
    // 15 Sept could be reached at all, her 24h window having been shut since
    // the 6th. It could: booking-guard drives off whatsapp_requests, not
    // bookings, and sends appointment_check_v1 at T-3h to exactly this case.
    // Keep that straight. What is genuinely missing is any way to read the
    // approved template list, or to send one template once, without editing
    // and deploying a function: every customer template in this file is wired
    // to a flow, and dispatch-studios sends only plain text and the studio
    // templates. Ops "templates" is how the five parameters of
    // appointment_check_v1 were read rather than guessed.
    if (payload?.ops === "templates") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const wr = await fetch(`${SUPABASE_URL}/rest/v1/app_secrets?key=eq.WABA_ID&select=value&limit=1`, { headers: H() });
      const wj = await wr.json().catch(() => []);
      const waba = String(wj?.[0]?.value || "");
      if (!waba) return new Response(JSON.stringify({ ok: false, error: "no WABA_ID in app_secrets" }), { status: 200, headers: { "Content-Type": "application/json" } });
      const tr = await fetch(`https://graph.facebook.com/v21.0/${waba}/message_templates?limit=200&fields=name,language,status,category,rejected_reason,quality_score,components`, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
      const tj = await tr.json().catch(() => ({}));
      const only = String(payload.name || "");
      const rows = (Array.isArray(tj?.data) ? tj.data : [])
        .filter((t: any) => !only || String(t.name) === only)
        .map((t: any) => ({
          name: t.name, language: t.language, status: t.status, category: t.category,
          rejected_reason: t.rejected_reason, quality: t.quality_score?.score,
          body: (t.components || []).find((c: any) => c.type === "BODY")?.text || "",
          buttons: ((t.components || []).find((c: any) => c.type === "BUTTONS")?.buttons || []).map((b: any) => b.text),
        }));
      return new Response(JSON.stringify({ ok: tr.ok, count: rows.length, templates: rows }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // v95: submit a template to Meta for approval. solicitud_reserva_v3 took
    // four days, so the approval clock is the scarce thing and it should start
    // the moment wording is agreed, not after the next conversation about it.
    // { ops: "tplnew", key, name, body, buttons: [..], category?, lang?, dry? }
    if (payload?.ops === "tplnew") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const wr = await fetch(`${SUPABASE_URL}/rest/v1/app_secrets?key=eq.WABA_ID&select=value&limit=1`, { headers: H() });
      const waba = String(((await wr.json().catch(() => []))[0] || {}).value || "");
      if (!waba) return new Response(JSON.stringify({ ok: false, error: "no WABA_ID in app_secrets" }), { status: 200, headers: { "Content-Type": "application/json" } });
      const tname = String(payload.name || "");
      const tbody = String(payload.body || "");
      const tbuttons: string[] = Array.isArray(payload.buttons) ? payload.buttons.map((b: any) => String(b)) : [];
      if (!tname || !tbody) return new Response(JSON.stringify({ ok: false, error: "name and body required" }), { status: 200, headers: { "Content-Type": "application/json" } });
      // v96: Meta rejects a template with INVALID_FORMAT when the body carries
      // {{n}} placeholders and no example values. solicitud_socio_v1 and
      // solicitud_reserva_v4 were both auto-rejected for exactly this on
      // 17 Sept, while v3 with a near-identical body sits APPROVED, so the
      // fault was the submission shape and not the wording. Examples are
      // required, one per placeholder, in order.
      const ex: string[] = Array.isArray(payload.examples) ? payload.examples.map((x: any) => String(x)) : [];
      const holes = new Set((tbody.match(/\{\{\s*\d+\s*\}\}/g) || []).map((h) => h.replace(/[^0-9]/g, "")));
      if (holes.size && ex.length !== holes.size) {
        return new Response(JSON.stringify({ ok: false, error: `body has ${holes.size} placeholders, ${ex.length} examples given. Meta rejects the mismatch as INVALID_FORMAT.` }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const bodyComp: any = { type: "BODY", text: tbody };
      if (ex.length) bodyComp.example = { body_text: [ex] };
      const comps: any[] = [bodyComp];
      if (tbuttons.length) comps.push({ type: "BUTTONS", buttons: tbuttons.slice(0, 3).map((t) => ({ type: "QUICK_REPLY", text: t })) });
      const spec = { name: tname, language: String(payload.lang || "es"), category: String(payload.category || "MARKETING"), components: comps };
      if (payload.dry) return new Response(JSON.stringify({ ok: true, dry: true, waba, spec }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
      const rr2 = await fetch(`https://graph.facebook.com/v21.0/${waba}/message_templates`, {
        method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(spec),
      });
      const tout = await rr2.text();
      return new Response(JSON.stringify({ ok: rr2.ok, status: rr2.status, name: tname, out: tout.slice(0, 600) }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // v97: can this project's token touch the ad accounts, or not? Asserting
    // either way is worthless; Meta is the only authority. Read only: it reports
    // what the token actually is, which ad accounts it can see, and the
    // campaign's own status. It changes nothing.
    if (payload?.ops === "adcheck") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const probe = async (label: string, path: string) => {
        try {
          const r = await fetch(`https://graph.facebook.com/v21.0/${path}`, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
          return { label, status: r.status, out: (await r.text()).slice(0, 500) };
        } catch (e) { return { label, status: 0, out: String(e).slice(0, 200) }; }
      };
      const camp = String(payload.campaign || "6992734410277");
      const probes = await Promise.all([
        probe("what this token is", "debug_token?input_token=" + encodeURIComponent(WA_TOKEN)),
        probe("ad accounts it can see", "me/adaccounts?fields=name,account_status"),
        probe("the campaign itself", `${camp}?fields=name,status,effective_status,daily_budget`),
      ]);
      return new Response(JSON.stringify({ ok: true, probes }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // { ops: "tpl", key, to, name, lang, params: [], payloads: [] }
    // dry: true renders what would be sent and sends nothing.
    if (payload?.ops === "tpl") {
      if (String(payload.key || "") !== OPS_KEY) return new Response("forbidden", { status: 403 });
      const to = String(payload.to || "").replace(/[^0-9]/g, "");
      const name = String(payload.name || "");
      const lang = String(payload.lang || "en");
      const params: string[] = Array.isArray(payload.params) ? payload.params.map((x: any) => String(x)) : [];
      const payloads: string[] = Array.isArray(payload.payloads) ? payload.payloads.map((x: any) => String(x)) : [];
      if (!to || !name) return new Response(JSON.stringify({ ok: false, error: "to and name required" }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (payload.dry) return new Response(JSON.stringify({ ok: true, dry: true, to, name, lang, params, payloads }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
      const sent = await sendTemplate(to, name, lang, params, payloads);
      return new Response(JSON.stringify({ ok: !!sent, to, name, lang, params }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // v85: every webhook Meta sends carries the WhatsApp Business Account id in
    // entry[0].id, and we have always thrown it away. It is the id templates are
    // created against, and it is not discoverable from the phone number id or
    // from the token, so without this the only way to create a template is for
    // Jordan to read it out of WhatsApp Manager by hand. Keep it the first time
    // we see it. Written once; after that this is a no-op read.
    const wabaId = String(payload?.entry?.[0]?.id || "");
    if (/^\d{10,20}$/.test(wabaId)) {
      try {
        const have = await fetch(`${SUPABASE_URL}/rest/v1/app_secrets?key=eq.WABA_ID&select=key&limit=1`, { headers: H() });
        const hv = await have.json().catch(() => []);
        if (!Array.isArray(hv) || !hv.length) {
          await fetch(`${SUPABASE_URL}/rest/v1/app_secrets`, {
            method: "POST", headers: { ...H(), Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({ key: "WABA_ID", value: wabaId }),
          });
          console.log("[wa] captured WABA id", wabaId);
        }
      } catch (e) { console.log("[wa] WABA capture failed", String(e)); }
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
        // v174: the 34600000xxx numbers are our own fake test customers; their
        // failures are expected and were buzzing Jordan's phone.
        if (to && to !== digitsOf(JORDAN_MAIN_NUMBER) && !/^3460000\d{4}$/.test(to)) await notifyJordanWa(`message to +${to} was NOT delivered: ${err.title || err.code || "unknown"}${Number(err.code) === 131047 ? " (24h window closed, only a template reaches them now)" : ""}.`, to);
      }
      return new Response("OK", { status: 200 });
    }
    if (!msg) return new Response("OK", { status: 200 });
    const from = String(msg.from || "");
    const profileName = value?.contacts?.[0]?.profile?.name || "";
    if (!from) return new Response("OK", { status: 200 });

    // v119 (22 Sept): Meta redelivers a webhook when our reply is slow, and
    // nothing here used to notice. On 21 Sept Calma's one "Si, tengo hueco" on
    // request #89 was handled twice, so they got two acknowledgements and two
    // price asks, and Selvarrosa and Centro Aloha each got their decline
    // answered twice. Claim the message id first: the insert ignores duplicates
    // and returns nothing when the id is already there, so a redelivery is
    // logged as handled and dropped. A claim that errors is let through, since
    // answering twice is better than not answering at all.
    const wamid = String(msg.id || "");
    if (wamid) {
      try {
        const claim = await fetch(`${SUPABASE_URL}/rest/v1/wa_inbound_seen`, {
          method: "POST",
          headers: { ...H(), Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify({ wamid, phone: from }),
        });
        const rows = await claim.json().catch(() => null);
        if (claim.ok && Array.isArray(rows) && !rows.length) {
          console.log(`[wa] duplicate webhook for ${wamid} from ${from}, already handled`);
          return new Response("OK", { status: 200 });
        }
      } catch (_e) { /* a dedupe we cannot reach must not silence the bot */ }
    }

    let replyId = "", text = "";
    let loc: { latitude?: number; longitude?: number } | null = null;
    let btnText = "";
    // v128: a completed Flow arrives as one message carrying every answer.
    let flowAnswers: Record<string, string> | null = null;
    if (msg.type === "interactive" && msg.interactive?.type === "nfm_reply") {
      try {
        const parsed = JSON.parse(String(msg.interactive?.nfm_reply?.response_json || "{}"));
        if (parsed && typeof parsed === "object") flowAnswers = parsed as Record<string, string>;
      } catch (e) { console.log("[wa] flow reply could not be read", String(e)); }
    }
    if (msg.type === "interactive") replyId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";
    // v151: buttons Jordan adds on the reply page carry fx_ ids. A tap on one
    // is the customer saying those words, so it goes through as typed text.
    if (/^fx_/.test(replyId)) { text = String(msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "").trim(); replyId = ""; }
    else if (msg.type === "button") { replyId = msg.button?.payload || ""; btnText = msg.button?.text || ""; }
    else if (msg.type === "text") text = String(msg.text?.body || "").trim();
    else if (msg.type === "location") loc = { latitude: Number(msg.location?.latitude), longitude: Number(msg.location?.longitude) };
    const reactionEmoji = msg.type === "reaction" ? String(msg.reaction?.emoji || "") : "";
    let voice: { path: string | null; transcript: string } | null = null;
    if (msg.type === "audio" && msg.audio?.id) {
      voice = await handleVoice(String(msg.audio.id), from);
      if (voice.transcript) text = voice.transcript;
    }

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

    await logMsg(from, "in", (voice ? `[voice note${voice.path ? " " + voice.path : ""}]${voice.transcript ? " " + voice.transcript : ""}` : "") || (text || btnText || (msg.type === "reaction" ? `[reaction ${reactionEmoji}]`.trim() : "") || (loc ? `[location ${loc.latitude},${loc.longitude}]` : `[tap: ${replyId}]`)) + (ref ? ` [via ad]` : ""), msg.type, replyId);

    // A reaction (someone tapping a thumbs up on our message) is not an answer.
    if (msg.type === "reaction") return new Response("OK", { status: 200 });

    // v103: a click-to-WhatsApp tap can arrive as an interactive reply with no
    // id on it at all. On 17 Sept a Facebook lead's empty tap landed 400ms
    // after their opening text, the bot treated it as a second conversation,
    // and the first thing that person read from us was the same pitch twice in
    // two slightly different wordings. An event with nothing to act on is not
    // a new conversation. It stays in the log above; it just gets no reply.
    if ((msg.type === "interactive" || msg.type === "button") && !replyId && !text && !btnText && !loc) {
      console.log(`[wa] empty interactive from ${from}, logged and ignored`);
      return new Response("OK", { status: 200 });
    }

    // ---- Studio replies: template button payloads, or free text from a partner number ----
    if (/^arr_(yes|no)_\d+$/.test(replyId)) {
      const partner = await findPartnerByNumber(digitsOf(from));
      await handleArrival(from, replyId, partner);
      return new Response("OK", { status: 200 });
    }
    // v170: "no" was missing here, so a studio's "No puedo" tap fell through
    // to the holding line and the decline was never recorded (Sinergia38 on
    // #90 and #91, 22 Sept, and #107, 5 Oct). handleStudioReply has always
    // handled it.
    if (/^studio_(confirm|other|no)_\d+$/.test(replyId)) {
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
            // v212: an away message gets no answer at all, not even the
            // holding line, so two bots never end up talking to each other.
            quietThisTurn = true;
            console.log(`[studio] auto-reply from ${partner.business_name} ignored (${Math.round(sinceMs / 1000)}s after our message)`);
            const em = text.match(EMAIL_IN_TEXT_RE);
            if (em) {
              await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(partner.id)}&booking_email=is.null`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ booking_email: em[0].toLowerCase() }) }).catch(() => {});
            }
          } else await handleStudioReply(from, "", "", text, partner);
        }
        else if (MEDIA_TYPES.includes(String(msg.type))) {
          // v55: a studio's photo, voice note or PDF used to vanish into the log
          // (Korn Náng and Centro Aloha both sent images on 6 Sept and heard
          // nothing). Ask for text, once per two hours, and show Jordan.
          quietThisTurn = true;
          const openAsk = msg.type === "sticker" ? [] : await fetch(`${SUPABASE_URL}/rest/v1/request_dispatch?phone=eq.${digitsOf(from)}&outcome=in.(pending,accepted)&created_at=gte.${new Date(Date.now() - 48 * 3600e3).toISOString()}&limit=1&select=id`, { headers: H() }).then((r) => r.json()).catch(() => []);
          const asked = Array.isArray(openAsk) && openAsk.length > 0;
          if (asked && !(await sentRecently(from, STUDIO_MEDIA_LINE, 2 * 3600e3))) await sendText(from, STUDIO_MEDIA_LINE);
          await founderCard(`📎 ${partner.business_name} sent a ${msg.type}`, {
            badge: "STUDIO MEDIA", title: `${partner.business_name} sent a ${msg.type} the bot cannot read`,
            paras: [asked ? `Open the chat on WhatsApp to see it. The bot asked them to write the time or price as text.` : `Open the chat on WhatsApp to see it. They have no open ask from us, so nothing was said back.`],
            waNum: from, waLabel: "Open the chat", prefill: "Hola, soy Jordan, de Massage Club. ",
          }).catch(() => {});
        }
        else console.log(`[wa] non-text message from partner ${partner.business_name}, ignored`);
        return new Response("OK", { status: 200 });
      }
    }

    const s = await getSession(from);
    if (profileName && !s.wa_name) s.wa_name = profileName;
    if (ref) s.data.adRef = [ref.headline, ref.source_url].filter(Boolean).join(" ") || "ctwa";

    // Blocked numbers stay blocked: no replies, no alerts, ever.
    // v81: "blocked" is no longer a death sentence (Jordan, 10 Sept: do not
    // block, persuade). Anyone parked there by the old rule is let back into
    // the flow from a clean start. Genuine never-contact numbers now use a
    // separate step, "muted", which is the only one that stays silent, so the
    // recovery cannot accidentally reopen a thread Jordan closed on purpose.
    if (s.step === "muted") return new Response("OK", { status: 200 });
    if (s.step === "blocked") {
      s.step = "start";
      await saveSession(s);
      await logEvent(from, "unblocked", { was: "blocked" });
    }

    // Someone is talking to the bot: alert on a number's first ever message and
    // whenever a known number comes back after 6+ quiet hours. Taps and replies
    // inside an active flow stay silent.
    const QUIET_MS = 6 * 60 * 60 * 1000;
    const isFresh = priorLastAt === null;
    const isResumed = priorLastAt !== null && (Date.now() - priorLastAt) > QUIET_MS;
    // v182: the fake 3460000xxxx numbers used for testing never email Jordan.
    if ((isFresh || isResumed) && !/^3460000\d{4}$/.test(digitsOf(from))) {
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

    // v184: every customer free-text message is read by the new reader, in shadow.
    if (text && !replyId) readerShadow(s, from, text);
    // v197: settle the customer's language before anything is said back.
    if (text && !replyId) await settleForeignLang(s, from, text);

    // v81 (Jordan, 10 and 12 Sept): answer neutrally and carry on. This used to
    // set step="blocked" and never speak to them again. Ten people ended up
    // there, more than have ever completed a booking, and two of them were real
    // customers who had already been through the whole funnel.
    // v108 (Jordan, case 02): a home visit is not something we sell. Say so
    // plainly and keep them moving, rather than answering "Good choice" and
    // routing them into a studio booking they never asked for.
    if (text && (HOME_VISIT_RE.test(text) || HOME_EXTRA_RE.test(text)) && !s.data.toldNoHome) {
      s.data.toldNoHome = new Date().toISOString();
      if (!s.data.area) s.step = "await_area";
      await saveSession(s);
      await sendText(from, COPY[s.data.lang === "es" ? "es" : "en"].noHomeVisit);
      await logEvent(from, "home_visit_declined", { said: String(text).slice(0, 80) });
      await notifyJordanWa(`+${from} asked for a home visit. Told them we book in person and asked for their area.`, from).catch(() => {});
      return new Response("OK", { status: 200 });
    }
    if ((text && EROTIC_RE.test(text)) || (btnText && EROTIC_RE.test(btnText))) {
      const said = String(text || btnText);
      // v106 (19 Sept, 03:15 Madrid): asking once can be someone testing the
      // water, and v81 is right that one refusal plus the question again gives
      // them a chance to book a real massage. Asking a SECOND time, after a
      // plain no, is not a misunderstanding. Tonight someone asked twice about
      // a "final feliz" and both times the bot answered the line and then
      // cheerfully asked which day suited them, which is the flow trying to
      // sell a studio appointment to a person the studio must never receive.
      // Jordan's standing rule is the shutdown line and no further replies, so
      // the second strike ends the conversation instead of re-asking it.
      s.data.eroticHits = Number(s.data.eroticHits || 0) + 1;
      await sendText(from, s.data.lang === "es" ? BLOCK_LINE_ES : BLOCK_LINE_EN);
      await logEvent(from, "offer_declined_neutral", { text: said.slice(0, 120), hit: s.data.eroticHits });
      if (s.data.eroticHits >= 2) {
        s.step = "muted";
        await saveSession(s);
        await notifyJordanWa(`Muted +${from} after a second off-menu request. They asked twice: ${said.slice(0, 100)}`, from).catch(() => {});
        return new Response("OK", { status: 200 });
      }
      await saveSession(s);
      // First time only: keep them exactly where they were and ask the question
      // again, so a booking they were halfway through is not thrown away.
      await reAsk(s, from, s.data.lang === "es" ? "es" : "en");
      return new Response("OK", { status: 200 });
    }
    // A therapist-gender preference is not an off-menu request. Record it and
    // let the flow continue; the studio ask carries it (see askGender below).
    //
    // v93: a bare "MAN" or "Mujer" is the answer to the question this bot asks
    // itself, and it was thrown away every time, because GENDER_RE needs the
    // gender word paired with a second word. Fernando answered "MAN" on
    // 11 September, was shown the main menu, and cancelled fifty seconds later.
    // Andy answered "Mujer" on 15 September, was shown a 17:00 slot that had
    // already passed, and went quiet. Across 55 requests therapist_gender had
    // been written exactly once. The bare form is only accepted when we have
    // just asked, so an ordinary "man" inside a sentence is still not a booking
    // preference. And a preference from someone whose booking is already in
    // play is written onto the request rather than held in a session nobody
    // reads: finalizeBooking, which was the only writer, is long behind them.
    {
      const said = String(text || btnText || "");
      // v182: Vinzma29 answered "Girl" without being asked and got the generic
      // "depends on the studio" line three times. A message that is nothing
      // but a gender word is a preference wherever it arrives, except where we
      // asked for a name. "Boy" and "chico" count too.
      const bareAny = !["await_name", "start"].includes(s.step) ? bareGenderWord(said) : null;
      const g = genderWanted(said) || (s.data.askedGender ? genderBare(said) : null) || bareAny;
      if (g) {
        const askedNow = !!s.data.askedGender;
        const hadAsked = askedNow || !!bareAny;
        s.data.askedGender = null;
        if (s.data.therapistGender !== g) {
          s.data.therapistGender = g;
          await logEvent(from, "therapist_gender", { gender: g });
        }
        await saveSession(s);
        const greq0 = hadAsked ? await lastRequestFor(from) : null;
        // v183 (review): an unprompted "Girl" only lands on a request that is
        // live right now, never on last month's finished booking.
        const LIVE_GREQ = ["new", "needs_contact", "studio_asked", "studio_replied", "offered", "bidding"];
        const greq = greq0 && (askedNow || bareAny === null
          ? !["cancelled", "dismissed"].includes(String(greq0.stage || ""))
          : LIVE_GREQ.includes(String(greq0.stage || "")) && Date.parse(String(greq0.created_at || 0)) > Date.now() - 3 * 86400e3) ? greq0 : null;
        if (greq && String(greq.therapist_gender || "") !== g) {
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${greq.id}`, {
            method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
            body: JSON.stringify({ therapist_gender: g }),
          });
          const gL = s.data.lang === "es" ? "es" : "en";
          await sendText(from, gL === "es"
            ? `Anotado: masajista ${g === "male" ? "chico" : "chica"}. Se lo pregunto al centro y te digo algo en cuanto me contesten. No te reservamos en un sitio que no pueda.`
            : `Noted, a ${g === "male" ? "man" : "woman"} therapist. We are asking the studio now and will not book you anywhere that cannot do it.`);
          await notifyJordanWa(`${s.wa_name || "+" + digitsOf(from)} asked for a ${g} therapist on request #${greq.id}. The studios still need asking.`, from);
          await logEvent(from, "therapist_gender_on_request", { id: greq.id, gender: g });
          return new Response("OK", { status: 200 });
        }
        // v182: no live request yet. Say it was heard, then carry on with the
        // question we were on; finalizeBooking puts it on the request.
        if (bareAny) {
          const gL = s.data.lang === "es" ? "es" : "en";
          await sendText(from, gL === "es"
            ? `Anotado: masajista ${g === "male" ? "chico" : "chica"}. Se lo pedimos a los centros y solo te reservamos donde puedan.`
            : `Noted, a ${g === "male" ? "man" : "woman"} therapist. We ask the studios for that and only book you where they can.`);
          if (s.step === "await_studio" && s.data.offerMode) { if (!(await offerStudios(s, from, gL))) await reAsk(s, from, gL); }
          else await reAsk(s, from, gL);
          return new Response("OK", { status: 200 });
        }
      }
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
        case "await_day_text": await askDayList(from, NL); break;
        case "await_time": await askTime(from, NL); break;
        case "await_hour": await askHour(from, NL, s.data.timeBandId || "time_afternoon"); break;
        case "await_time_text": await sendText(from, COPY[NL].timeAsk); break;
        case "await_area": await askArea(from, NL); break;
        case "await_name": await sendText(from, COPY[NL].name); break;
        case "await_email": case "await_email_req": await sendText(from, COPY[NL].email); break;
        default: await askService(from, NL);
      }
      return new Response("OK", { status: 200 });
    }
    // v86: this used to be one way only. Spanish could be switched on by a
    // single Spanish word and nothing ever switched it back, so an English
    // speaker who typed "hola" once was answered in Spanish for the rest of
    // their life. Jordan wrote "Hi" to the bot on 12 September and got Spanish,
    // because a test session from weeks earlier still had him flagged es.
    //
    // Symmetric now, and deliberately harder to leave a language than to enter
    // it: strongSpanish already weighs a whole message, while looksEnglish
    // matches common words, so English only wins when there is no Spanish
    // signal at all. A brand new person with no language set gets English,
    // which is what the ads are written in.
    // v195 (replay of 76 real chats): "Chamberí" on its own flipped an English
    // conversation to Spanish (the accent counts as Spanish), and three English
    // writers whose WhatsApp names looked Spanish got a Spanish first message
    // and stayed in Spanish because "Relax is possible?" is not on the English
    // word list. A place name alone never changes the language, and a language
    // we only guessed is settled by the reader on the customer's first real
    // sentence of two words or more.
    const placeOnly = !!text && !!detectAreaPlus(text) && text.trim().split(/\s+/).length <= 3;
    if (text && !replyId && s.data.langGuess && text.trim().split(/\s+/).length >= 2 && !AD_OPENER_RE.test(text.trim())) {
      const rd = await readingFor(from, text, 4000);
      const said = rd?.language;
      if (said === "en" || said === "es") { s.data.lang = said; delete s.data.langGuess; await logEvent(from, "lang_settled", { lang: said, by: "reader" }); }
      else if (strongSpanish(text)) { s.data.lang = "es"; delete s.data.langGuess; }
    } else if (text && !placeOnly) {
      if (s.data.lang !== "es" && strongSpanish(text)) s.data.lang = "es";
      else if (s.data.lang === "es" && !strongSpanish(text) && looksEnglish(text) && !AD_OPENER_RE.test(text.trim())) s.data.lang = "en";
    }
    const L: string = s.data.lang === "es" ? "es" : "en";

    // v195 (replay): "No entiendo" or "I don't speak English" after an English
    // first message got the day question again, in Spanish but with no price
    // and no word about who we are. Once per chat, the whole first message goes
    // again in Spanish, with the day buttons.
    if (text && !replyId && !s.data.esOpenerSent && ["await_day", "await_service", "await_day_text"].includes(s.step) && (LOST_ES_RE.test(text) || NO_ENGLISH_RE.test(text))) {
      s.data.lang = "es"; s.data.esOpenerSent = true; delete s.data.langGuess; s.step = "await_day";
      if (!s.data.service) { s.data.service = "svc_relax"; s.data.defaultService = true; }
      await saveSession(s);
      await logEvent(from, "spanish_opener_resent", { said: text.slice(0, 60) });
      // v200 (11 Oct): "Me pides que te escriba en español y tú me escribes en
      // inglés" got the whole opener again with no word that we heard her,
      // and she left. Say sorry first.
      await sendButtons(from, "Perdona, seguimos en español 🙏\n\n" + await firstLine("es", "", "", true, openerName(s)), dayBtns("es"));
      return new Response("OK", { status: 200 });
    }

    // v128: a Flow came back complete. Every answer the six questions would
    // have collected, in one message, each in its own field. Anything the form
    // could not settle ("this week", "somewhere else", "flexible") is asked as
    // ONE question, not six.
    if (flowAnswers) {
      const svc = FLOW_SERVICE[String(flowAnswers.service || "")] || "";
      if (svc) s.data.service = svc;
      const fd = flowDay(String(flowAnswers.day || ""), L);
      if (fd) { s.data.day = fd.day; s.data.dayDate = fd.dayDate; }
      // v157 (Jordan, "make it easier to pick a time"): the form offers real
      // start times as chips, up to three. The first is the time we ask for,
      // the rest ride along as the customer's flexibility. For today, a time
      // already gone is dropped; if none is left the time is asked again.
      const times = flowHours(flowAnswers.time_pref, !!fd && fd.day === (L === "es" ? "Hoy" : "Today"));
      if (times.length) { s.data.time = times[0]; s.data.timeBandId = null; s.data.timeBand = times.length > 1 ? times.join(" / ") : null; }
      else { s.data.time = null; s.data.timeBand = null; s.data.timeBandId = null; }
      // v156: the backup day and times, in Spanish because studios read it.
      const fd2 = flowDay(String(flowAnswers.day2 || ""), L);
      const times2 = flowHours(flowAnswers.time2, false);
      s.data.backup = fd2 ? [fd2.es, times2.length ? (times2.length > 1 ? "a las " + times2.join(" / ") : "a las " + times2[0]) : ""].filter(Boolean).join(", ") : null;
      const areaId = String(flowAnswers.area || "");
      const areaName = FLOW_AREA[areaId] || "";
      if (areaName) s.data.area = areaName;
      const nm = parseName(String(flowAnswers.name || ""));
      if (nm) { s.data.name = nm.slice(0, 80); s.data.nameFromFlow = true; }
      const em = String(flowAnswers.email || "").trim();
      if (em && isEmail(em)) s.data.email = em.toLowerCase();
      else s.data.emailRefused = true;
      await saveSession(s);
      await logEvent(from, "flow_completed", {
        service: s.data.service || null, day: s.data.day || null, time: s.data.time || null,
        backup: s.data.backup || null, area: s.data.area || areaId || null, email: !!s.data.email,
      });
      if (!s.data.day) { s.step = "await_day"; await saveSession(s); await askDay(from, L); return new Response("OK", { status: 200 }); }
      if (!s.data.time) { s.step = "await_time"; await saveSession(s); await askTime(from, L); return new Response("OK", { status: 200 }); }
      // v156 (Jordan): "find location should be able to happen". A form cannot
      // read the phone's location, so "Use my location" is answered by
      // WhatsApp's own share-location button straight after it; the pin lands
      // in await_area, which already turns a pin into the nearest area.
      if (areaId === "locate") {
        s.step = "await_area"; await saveSession(s);
        await sendLocationRequest(from, L === "es"
          ? "Toca el botón de abajo para compartir tu ubicación y busco los centros más cercanos. También puedes escribir tu barrio."
          : "Tap the button below to share your location and I'll find the closest studios. You can also type your neighbourhood.");
        return new Response("OK", { status: 200 });
      }
      if (!s.data.area) { s.step = "await_area"; await saveSession(s); await askArea(from, L); return new Response("OK", { status: 200 }); }
      // Offer first (v152), the same as a typed booking that reaches its area.
      if (!(await offerStudios(s, from, L))) await askNameOrFinalize(s, from, L);
      return new Response("OK", { status: 200 });
    }

    // v125 (25 Sept, live): an email address is an email address wherever it
    // turns up. Hatem typed Hatem@vitasnacafe.com nine seconds after the bot had
    // given up asking, and because he was at the menu by then it was read as a
    // menu selection and thrown away. He booked for the next afternoon with no
    // second channel, which is exactly what Jordan wrote in capitals on 8
    // September. The email steps do their own handling and are left alone.
    if (text && !["await_email", "await_email_req", "muted"].includes(s.step)) {
      const em = text.match(EMAIL_IN_TEXT_RE);
      const addr = em ? em[0].toLowerCase() : "";
      if (addr && !s.data.email) {
        s.data.email = addr;
        s.data.emailRefused = false;
        await saveSession(s);
        // Onto the open request too, not just the session. A session is a
        // conversation; the request is what the studio and the confirmation
        // read from. Only fills a blank, never overwrites one they gave us.
        const prowId = await attachEmail(from, addr);
        await logEvent(from, "email_given", { late: true, step: s.step, request_id: prowId });
        // A message that is nothing but the address gets an answer and the
        // question they were on. One that carries other words is saved quietly
        // and carries on being read as whatever else it was.
        if (isEmail(text)) {
          await sendText(from, COPY[L].emailLate(addr));
          await reAsk(s, from, L);
          return new Response("OK", { status: 200 });
        }
      }
    }

    // v204 (12 Oct, synth.md change 5): a voice note we could not transcribe.
    // SENE (+34 623 415 275) sent two this morning and both failed (the
    // OpenRouter balance is under its audio minimum); the answer opened in
    // Spanish to an English speaker and said we cannot listen to voice notes,
    // which is not true. Now: Jordan is pinged once in 30 minutes with a link
    // that plays it, and the customer gets one line in their own language (the
    // opener's guess from the number and name when we do not know it yet),
    // then the question they were on. A second failure inside ten minutes gets
    // no second line.
    if (voice && !voice.transcript) {
      const VL = s.data.lang === "es" ? "es" : s.data.lang ? "en" : adLeadLang(from, s.wa_name).L;
      const vr = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?phone=eq.${digitsOf(from)}&event=eq.voice_failed&created_at=gte.${new Date(Date.now() - 30 * 60e3).toISOString()}&select=id&limit=1`, { headers: H() });
      const pinged = ((await vr.json().catch(() => [])) || []).length > 0;
      await logEvent(from, "voice_failed", { path: voice.path, step: s.step, lang: VL, pinged_before: pinged });
      if (!pinged) {
        const who = s.wa_name || "+" + digitsOf(from);
        // v204 review: with the number, so a fake 3460000xxxx canary never pages him.
        if (voice.path) await notifyJordanWa(`Voice note from ${who} could not be transcribed; the bot asked them to type it. Listen: ${SUPABASE_URL}/functions/v1/wa-bot?media=${encodeURIComponent(voice.path)}&sig=${await replySig(digitsOf(from))}`, from);
        else await notifyJordanWa(`Voice note from ${who} could not be transcribed or saved; the bot asked them to type it.`, from);
      }
      if (s.step === "start") {
        s.data.lang = VL; s.data.langGuess = VL; await saveSession(s);
        await greet(s, from, "", VOICE_FAIL[VL]);
        await sendReservePage(s, from);
        return new Response("OK", { status: 200 });
      }
      if (await sentRecently(from, VOICE_FAIL[VL], 10 * 60e3)) { quietThisTurn = true; return new Response("OK", { status: 200 }); }
      await sendText(from, VOICE_FAIL[VL]);
      if (s.step !== "await_offer") await reAsk(s, from, VL);
      return new Response("OK", { status: 200 });
    }
    // v55: a sticker, photo or voice note mid-flow is not an answer. On 6 Sept
    // two stickers at 23:09 got the full welcome twice. Say what we can read,
    // ask the current question again, and never repeat that within ten minutes.
    if (MEDIA_TYPES.includes(String(msg.type)) && !text && !replyId && s.step !== "start") {
      if (s.step !== "done" && s.step !== "menu" && s.step !== "human" && !(await sentRecently(from, MEDIA_LINE[L], 10 * 60e3))) {
        await sendText(from, MEDIA_LINE[L]);
        await reAsk(s, from, L);
      }
      return new Response("OK", { status: 200 });
    }

    // v206 (12 Oct): decided once, used twice: the clothing answer below and the
    // agent_core hook after the resume codes. CCF (+34 629 274 143, 6 Oct) asked
    // "who does the massage? / duration and cost? / where are your premises? /
    // can I be naked?" in one message and the clothing gate answered only the
    // last line, then the time buttons again. For a phone the core takes, the
    // whole message goes to the core, which answers all four.
    const coreTake = text && !replyId && !flowAnswers
      ? coreTakes({
        mode: await agentCoreMode(), phone: digitsOf(from), step: s.step, text,
        jobSeeker: !!jobSeekerKind(text),
        offerTimeNamed: s.step === "await_offer" && !!parseOfferedTime(text) && parseOfferedTime(text) !== String(s.data.offer?.time || ""),
        confirmLater: CONFIRM_LATER_RE.test(text), emailOnly: isEmail(text),
        bareOpener: HI_RE.test(text.trim()) || AD_OPENER_RE.test(text.trim()),
        adOpener: AD_OPENER_RE.test(text.trim()),
      })
      : { ok: false, why: "no_text" };
    // Clothing questions get a real answer about professional standards, then
    // we pick the flow back up. Never a human handoff, never stored as data.
    if (text && MODESTY_RE.test(text) && !coreTake.ok) {
      await sendText(from, COPY[L].modesty);
      switch (s.step) {
        case "await_area": await askArea(from, L); break;
        case "await_day_text": await askDayList(from, L); break;
        case "await_time_text": await sendText(from, COPY[L].timeAsk); break;
        case "await_studio_text": await sendText(from, COPY[L].otherStudioAsk); break;
        case "await_name": await sendText(from, COPY[L].name); break;
        case "await_email": case "await_email_req": await sendText(from, COPY[L].email); break;
      }
      await logEvent(from, "modesty_question", {});
      return new Response("OK", { status: 200 });
    }

    // "Not now" on the rebooking nudge: warm goodbye, no sales pitch.
    if (replyId === "rebook_later") {
      s.step = "done"; s.data.cheapPick = null; await saveSession(s);
      await sendText(from, COPY[L].rebookLater);
      return new Response("OK", { status: 200 });
    }

    // v36: answers to a forwarded studio offer win over whatever step they were on.
    {
      // v204: offer_alt_ is "Closer or cheaper", the third button on every offer.
      const om = replyId.match(/^offer_(yes|no|alt)_([0-9a-fA-F-]{8,})$/);
      if (om) {
        if (om[1] === "yes") await acceptOffer(om[2], from, L, s); else await declineOffer(om[2], from, L, s, om[1] === "alt" ? "alt" : "time");
        return new Response("OK", { status: 200 });
      }
      if (s.step === "await_offer" && text && s.data.offer?.row) {
        const bare = text.trim().toLowerCase().replace(/[.!¡¿?]/g, "");
        // v199 (Jordan, 10 Oct): the customer confirms with a tap of the button, so a
        // typed yes brings the buttons back rather than booking it.
        if (/^(yes|yeah|yep|ok|okay|sure|si|sí|vale|perfecto|perfect|great|book it|reserva|reservar|confirm|confirmo|1)$/.test(bare)) { if (!(await reshowOffer(s, from, L, "typed_yes"))) await sendText(from, COPY[L].offerGone); return new Response("OK", { status: 200 }); }
        if (/^(no|nope|another|otra|other|otra hora|another time|2)$/.test(bare)) { await declineOffer(String(s.data.offer.row), from, L, s); return new Response("OK", { status: 200 }); }
        // v204 (12 Oct): "Prefer to look for another center" was Al (#83) on
        // 21 Sept, answered "Got it, I am checking that now" and then nothing.
        // Asking for another centre, a closer one or a cheaper one is the
        // "Closer or cheaper" button in words. It is checked before the price
        // branch below, which would only show the same offer again. A time named
        // in the same message is left to the counter-offer handler.
        // v204 review: and a question about this studio ("Which metro is
        // closer?") goes on to the address and price answers below.
        if ((bare === "3" || altOfferAsked(text, looksLikeQuestion(text) || ADDRESS_Q_RE.test(text))) && !parseOfferedTime(text)) { await declineOffer(String(s.data.offer.row), from, L, s, "alt"); return new Response("OK", { status: 200 }); }
        // v154: "¿Qué calle?" about the offered studio gets its address.
        if (ADDRESS_Q_RE.test(text) && await reshowOffer(s, from, L, "address_question")) return new Response("OK", { status: 200 });
        // v182: "how much?" about the offer gets this studio's price, not the
        // generic 40 to 85 EUR range.
        // v183 (review): a price question or objection never declines the
        // offer from free text. "¿Es caro?" used to stand the studio down. The
        // offer comes back with its price and the buttons; only a tap on
        // "Another time" (or a plain "no") declines it. A different time named in
        // the same message ("me cuesta llegar, ¿a las 7?") is left to the
        // counter-offer handler below.
        const namedTime = parseOfferedTime(text);
        const otherTime = !!namedTime && namedTime !== String(s.data.offer?.time || "");
        if (!otherTime && (PRICEQ_RE.test(text) || PRICE_OBJ_RE.test(text)) && await reshowOffer(s, from, L, PRICE_OBJ_RE.test(text) ? "price_objection" : "price_question")) return new Response("OK", { status: 200 });
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

    // v161 (5 Oct, Jordan: "i want to test it out"): Jordan's own numbers can
    // pull up the two new booking screens inside WhatsApp. "page" sends the
    // booking page as a button that opens in WhatsApp's own browser; "form"
    // sends the native form in draft mode (Meta lets a draft go to a number
    // that has written in). Nobody else sees either until Jordan says so.
    if (text && !replyId && ["34612474827", "15622355063"].includes(digitsOf(from)) && /^(page|pagina|página|form|formulario)$/i.test(text.trim())) {
      if (/^(page|pagina|página)$/i.test(text.trim())) {
        const url = `https://book.massageclub.io/reserve?n=Jordan&p=${digitsOf(from)}&lang=en&nt=1&src=wa`;
        await waSend(from, { type: "interactive", interactive: { type: "cta_url", body: { text: "Book a massage in a few taps. Pick the massage, the day, the time and the area, and we ask the studios for you. You pay at the studio, no fee from us." }, action: { name: "cta_url", parameters: { display_text: "Book now", url } } } }, "[test: booking page button] " + url, "cta_url");
      } else {
        await waSend(from, { type: "interactive", interactive: { type: "flow", body: { text: COPY.en.flowBody }, action: { name: "flow", parameters: {
          flow_message_version: "3", mode: "draft", flow_token: `mc-${digitsOf(from)}-${Date.now()}`, flow_id: "2519994188477304",
          flow_cta: COPY.en.flowCta, flow_action: "navigate", flow_action_payload: { screen: "SERVICE", data: flowDays() } } } } }, "[test: booking form, draft]", "flow");
      }
      await logEvent(from, "jordan_test_screen", { which: text.trim().toLowerCase() });
      return new Response("OK", { status: 200 });
    }

    // Must run before the greeting and the "hola" branch: the prefilled text
    // starts with a greeting, and that would restart them from scratch.
    if (text && !replyId) {
      const rc = text.match(RESUME_RE);
      if (rc && await resumeFromCode(s, from, rc[1])) return new Response("OK", { status: 200 });
      if (!rc && await webHandoff(s, from, text)) return new Response("OK", { status: 200 });
      if (!rc && RESUME_PHRASE_RE.test(text) && await resumeFromPhone(s, from)) return new Response("OK", { status: 200 });
    }

    // v206 (12 Oct, Jordan approved "change 3": let Claude run the conversation,
    // code keeps money and confirmations). In the review of 108 real chats since
    // 14 Sept, 38 of the 90 lost customers left because the bot misread them,
    // ignored a question or answered in the wrong language: Hafeez's "What type
    // massage?" was thrown away over one dash and "Plzz" became his day; Javier
    // (+34 693 301 014) asked who and where four times and got the time buttons
    // four times. Behind AGENT_CORE (off | test | on), a free-text customer
    // message goes to agent_core.ts instead of the step parsers below. Every
    // gate above stays as it was, and taps never reach this point. When the core
    // sends nothing (API down, a reply that fails the house rules twice), the
    // session is put back exactly as it was and the old flow below answers.
    if (coreTake.ok) {
      const fsaid = s.data.founderSaid;
      const fresh = fsaid && Date.now() - Date.parse(String(fsaid.at || "")) < FOUNDER_CTX_MS ? { text: String(fsaid.text || ""), at: String(fsaid.at) } : null;
      const said = text.trim();
      // Thanks, ok, an emoji: if the core chooses to say nothing, nothing is said.
      const ackOnly = ACK_ONLY_RE.test(said) || SOFT_ACK_RE.test(said) || (GOODBYE_RE.test(said) && said.split(/\s+/).length <= 4 && !said.includes("?"));
      const r = await runCoreTurn(coreCtx(), { s, from: digitsOf(from), L: L === "es" ? "es" : "en", text, viaVoice: !!voice, founderSaid: fresh, ackOnly, switchMode: await agentCoreMode() })
        .catch((e) => { console.log("[wa] agent_core failed", String(e)); return { handled: false, quiet: false, sent: 0 }; });
      if (r.handled) { if (r.quiet) quietThisTurn = true; return new Response("OK", { status: 200 }); }
    }

    // v204 (12 Oct, synth.md change 4): Jordan wrote from the reply page in the
    // last 30 minutes and nothing has been sent since, so this reply answers
    // him, not the step (founderContextTurn). Used once. Not at an offer: a
    // typed yes or no there already has its own safe handling (v199).
    if (text && !replyId && s.data.founderSaid) {
      const fc = s.data.founderSaid;
      delete s.data.founderSaid; await saveSession(s);
      const age = Date.now() - Date.parse(String(fc.at || ""));
      const said = String(fc.text || "");
      const th = await recentThread(from);
      const lastOut = [...th].reverse().find((m) => m.dir === "out")?.body || "";
      if (age >= 0 && age < FOUNDER_CTX_MS && said && lastOut.startsWith(said.slice(0, 40)) && s.step !== "await_offer") {
        await founderContextTurn(s, from, L, text, said);
        return new Response("OK", { status: 200 });
      }
    }

    if (text && BACK_RE.test(text)) {
      const moved = await goBack(s, from, L);
      if (moved) return new Response("OK", { status: 200 });
    }

    const freeTextStep = ["await_name", "await_email", "await_email_req", "await_email_post", "await_day_text", "await_area", "await_time_text", "await_studio_text"].includes(s.step);
    // v201 (12 Oct): Salado wrote on 24 Sept, stopped at the area question,
    // and clicked the ad again at 00:51 on 12 Oct. The ad's prefilled line was
    // taken as his area ("cerca de Hi, I'd like to book a massage. I saw yo")
    // and he was offered two studios for a day two weeks gone. The ad's own
    // line is never an answer to anything: it is someone starting again.
    if (text && !replyId && AD_OPENER_RE.test(text.trim()) && s.step !== "start") {
      const live = String((await lastRequestFor(from))?.stage || "");
      if (!["confirmed", "offered", "bidding", "studio_replied", "studio_asked"].includes(live)) {
        await logEvent(from, "ad_restart", { from_step: s.step });
        s.data = { lang: s.data.lang || "", adRef: s.data.adRef || null, recoverySent: s.data.recoverySent || null };
        await greet(s, from, text);
        return new Response("OK", { status: 200 });
      }
    }
    // v201: Salado answered "Casi listo: ¿cómo te llamas?" with "?" and got
    // nothing: the bot's answer was the same question again, which the repeat
    // guard then held back. A bare "?" asks why we need this, so say why.
    if (text && !replyId && freeTextStep && /^\s*[?¿]+\s*$/.test(text)) {
      const es = L === "es";
      const why: Record<string, string> = {
        await_name: es ? "Tu nombre, para que el centro tenga la reserva a tu nombre. Solo el nombre, por ejemplo: Ana." : "Your first name, so the studio has the booking under your name. Just the name, for example: Ana.",
        await_email: es ? "Tu email, para enviarte la confirmación también por correo. Por ejemplo: ana@gmail.com" : "Your email, so the confirmation reaches you by email too. For example: ana@gmail.com",
        await_email_req: es ? "Tu email, para enviarte la confirmación también por correo. Por ejemplo: ana@gmail.com" : "Your email, so the confirmation reaches you by email too. For example: ana@gmail.com",
        await_area: es ? "La zona de Madrid donde quieres el masaje, para buscarte centros cerca. Por ejemplo: Salamanca, Chamberí o Sol." : "The part of Madrid where you'd like the massage, so I can find studios near you. For example: Salamanca, Chamberí or Sol.",
        await_day_text: es ? "El día que quieres el masaje. Por ejemplo: mañana o el sábado." : "The day you'd like the massage. For example: tomorrow or Saturday.",
        await_time_text: es ? "La hora que te viene bien. Por ejemplo: 18:00." : "The time that suits you. For example: 18:00.",
      };
      if (why[s.step]) {
        await sendText(from, why[s.step]);
        await logEvent(from, "bare_question_mark", { at: s.step });
        return new Response("OK", { status: 200 });
      }
    }

    // A question at a free-text step gets answered, then we ask our question
    // again. Never store someone's question as their name, day or area.
    if (text && !replyId) jevShadow(s, from, text);
    // Therapists looking for work reach us through the same ads. Answer them
    // properly once, then hand over to a human instead of looping the menu.
    // v204 (12 Oct): this ran after the question branches, so Manju's (#91)
    // "Me gustaría saber si tienen alguna oportunidad de trabajo" was answered
    // as a question at the day step and her booking carried on; it now runs
    // first, on isJobSeeker (JOB_RE plus the phrases it missed). A request she
    // had already been walked into is closed, and dispatch-studios' chase
    // sweep tells every studio still holding it, inside its own hours.
    // v204 review (12 Oct): only someone plainly asking for work closes a
    // request a studio has already been asked about, and at the offer step
    // only that counts at all (jobSeekerKind): "Does the 10% discount apply?"
    // typed at an offer used to drop it and stand the studios down.
    const jobKind = text ? jobSeekerKind(text) : "";
    if (jobKind && (jobKind === "explicit" || s.step !== "await_offer")) {
      // Once: Manju wrote it five times. After the first answer the next ones
      // go to Jordan only; the bot has nothing more to say about a job.
      if (s.step === "human" && s.data.jobSeeker) {
        quietThisTurn = true;
        await notifyJordanWa(`${s.wa_name || "+" + digitsOf(from)} (looking for work, already answered) wrote: ${text.slice(0, 140)}`, from);
        return new Response("OK", { status: 200 });
      }
      await closeAsJobSeeker(s, from, L, text, jobKind);
      return new Response("OK", { status: 200 });
    }
    // v174 (5 Oct test): "My last massage was terrible, I want my money back"
    // is not a question, so it got "Which day suits you?". A complaint gets an
    // apology, goes straight to Jordan, and the booking is not pushed at them.
    if (text && !replyId && NOTHANKS_RE.test(text.trim()) && DECLINE_STEPS.includes(s.step)) {
      s.step = "done"; await saveSession(s);
      await sendText(from, COPY[L].rebookLater);
      await logEvent(from, "declined_flow", { said: text.slice(0, 60) });
      return new Response("OK", { status: 200 });
    }
    // v195: "I don't need any for now" and "No I can't make it" are a no too.
    // The word list only knows short ones; for anything with a negative in it
    // the reader decides, and only a clear decline closes the flow.
    if (text && !replyId && [...DECLINE_STEPS, "await_studio"].includes(s.step) && !NOTHANKS_RE.test(text.trim())
        && /\b(no|not|don'?t|can'?t|cannot|won'?t|nunca|ya no|no puedo|no quiero|no necesito|no me|later|luego|otro d[ií]a|another time)\b/i.test(text)) {
      const rd = await readingFor(from, text, 4000);
      if (rd && rd.confidence >= 0.7 && rd.intents.includes("decline") && !rd.intents.includes("change_booking") && !(rd.slots && (rd.slots.day || rd.slots.time))) {
        s.step = "done"; s.data.cheapPick = null; await saveSession(s);
        await sendText(from, COPY[L].rebookLater);
        await logEvent(from, "declined_flow", { said: text.slice(0, 60), by: "reader" });
        return new Response("OK", { status: 200 });
      }
    }
    // v183 (review): not at start or menu (greet must run), only a real,
    // un-negated objection, and never over an answer to the question we asked:
    // "Retiro please" or "mañana a las 7" is handled by the step itself.
    const stepAnswer = (s.step === "await_area" && !!detectAreaPlus(text || "")) || (["await_day", "await_day_text"].includes(s.step) && !!detectDay(text || "", L)) || (["await_time", "await_hour", "await_time_text", "await_sameday"].includes(s.step) && !!detectTime(text || "", L)) || (s.step === "await_service" && !!detectService(text || ""));
    if (text && !replyId && !stepAnswer && isPriceObjection(text) && [...DECLINE_STEPS.filter((x) => x !== "start" && x !== "menu"), "await_studio", "await_sameday"].includes(s.step)) {
      await priceObjection(s, from, L);
      return new Response("OK", { status: 200 });
    }
    // v182: Vinzma29 typed "Tetuan", his area, while the bot was waiting for an
    // email, and was told "we will leave it without an email". A neighbourhood
    // at the email question is the area, and the email question still stands.
    // v183 (review): never for a question ("¿Qué centro?", "Is it near Sol?"),
    // and never over an area we already have: "Ana Rivas" is a name, not Rivas.
    // Vinzma29's area was "No", which is no area at all.
    const areaKnown = !!s.data.area && s.data.area !== "anywhere" && !!detectAreaPlus(String(s.data.area));
    if (text && !replyId && ["await_email", "await_email_req", "await_email_post"].includes(s.step) && !areaKnown && !isEmail(text) && !text.includes("@") && !text.includes("?") && !looksLikeQuestion(text) && !MEANING_RE.test(text) && text.trim().split(/\s+/).length <= 4 && detectAreaPlus(text)) {
      const area = detectAreaPlus(text);
      s.data.area = area; s.data.areaAt = Date.now(); await saveSession(s);
      if (s.step === "await_email_post") {
        const lr = await lastRequestFor(from);
        if (lr && ["new", "needs_contact"].includes(String(lr.stage || ""))) {
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${lr.id}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ area }) });
        }
      }
      await logEvent(from, "area_at_email_step", { area, step: s.step });
      await sendText(from, L === "es"
        ? `Anotado, ${area}. ¿Y tu email? Así te llega la confirmación también por correo.`
        : `Got it, ${area}. And your email? That way the confirmation reaches you by email too.`);
      return new Response("OK", { status: 200 });
    }
    if (text && !replyId && COMPLAINT_RE.test(text)) {
      await sendText(from, L === "es" ? "Siento mucho oír eso. Lo revisamos y te respondemos aquí lo antes posible." : "I'm really sorry to hear that. We are looking into it and will reply here as soon as we can.");
      await notifyJordanWa(`COMPLAINT from ${s.wa_name || "+" + digitsOf(from)}: ${text.slice(0, 160)}. Bot apologised and said we will reply; nothing else sent.`, from);
      await logEvent(from, "complaint", { step: s.step, text: text.slice(0, 300) });
      return new Response("OK", { status: 200 });
    }
    if (text && freeTextStep && !isEmail(text) && (looksLikeQuestion(text) || MEANING_RE.test(text))) {
      if (PRICEQ_RE.test(text)) await sendText(from, COPY[L].priceInfo);
      else if (PHOTOQ_RE.test(text)) await sendText(from, COPY[L].photoAnswer);
      else if ((HOWWORKS_RE.test(text) || WHO_RE.test(text))) await sendText(from, COPY[L].howItWorks);
      else if (zoneQ(text)) await sendText(from, await whereAnswer(from, L));
      else {
        // v71: the regexes above cover price, how it works and zone. Everything
        // else went to helpInstead, which is the generic "tell me the massage,
        // the day and the zone" plus the menu. That is what 12 of the 31
        // customers who never reached a booking last saw. Read it properly
        // first; helpInstead is only the answer when the model has none.
        const stepBefore = s.step;
        if (await lastResort(s, from, L, text)) {
          if (s.step !== stepBefore) return new Response("OK", { status: 200 });
        } else {
          await helpInstead(s, from, L, text);
          return new Response("OK", { status: 200 });
        }
      }
      switch (s.step) {
        case "await_area": await askArea(from, L); break;
        case "await_day_text": await askDayList(from, L); break;
        case "await_time_text": await sendText(from, COPY[L].timeAsk); break;
        case "await_studio_text": await sendText(from, COPY[L].otherStudioAsk); break;
        case "await_name": await sendText(from, COPY[L].name); break;
        case "await_email": case "await_email_req": await sendText(from, COPY[L].email); break;
        case "await_email_post": await sendText(from, COPY[L].emailAskPost); break;
      }
      return new Response("OK", { status: 200 });
    }

    // v53: a question typed at a button step gets its answer and then the question
    // again. On 6 Sept a customer asked "Que precio es?" three times at the day
    // question and got the day buttons three times.
    const buttonStep = ["await_service", "await_day", "await_time", "await_hour", "await_area", "await_sameday"].includes(s.step);
    if (text && buttonStep && !replyId && (THERAPISTQ_RE.test(text) || PRICEQ_RE.test(text) || PHOTOQ_RE.test(text) || (HOWWORKS_RE.test(text) || WHO_RE.test(text)) || zoneQ(text) || SERVICEQ_RE.test(text) || (looksLikeQuestion(text) && !detectService(text) && !detectDay(text, L)) || (MEANING_RE.test(text) && text.split(/\s+/).length <= 10))) {
      if (PRICEQ_RE.test(text)) await sendText(from, COPY[L].priceInfo);
      else if (PHOTOQ_RE.test(text)) await sendText(from, COPY[L].photoAnswer);
      else if ((HOWWORKS_RE.test(text) || WHO_RE.test(text))) await sendText(from, COPY[L].howItWorks);
      else if (zoneQ(text)) await sendText(from, await whereAnswer(from, L));
      // v195: "Who give the Massage ?" got a vague line from the agent. The
      // answer we wrote for it also offers a man or a woman.
      else if (THERAPISTQ_RE.test(text)) {
        await sendText(from, COPY[L].therapistAnswer);
        s.data.askedGender = new Date().toISOString(); await saveSession(s);
        await logEvent(from, "therapist_asked", { said: String(text).slice(0, 80), at: s.step });
      }
      // v131 (28 Sept 10:43, live): "what type of massage you offer ?" arrived
      // at the day question. This chain had no case for it, so a question we
      // answer from a constant fell through to the model, which stalled with
      // "I am finding out for you now and I will come straight back here with
      // the answer" and then never came back. He waited, said "gracias" and
      // went quiet. The answer was in COPY all along.
      else if (SERVICEQ_RE.test(text) && !detectService(text)) {
        await sendText(from, COPY[L].servicesAnswer);
        await logEvent(from, "services_asked", { said: String(text).slice(0, 80), at: s.step });
      }
      else {
        const stepBefore = s.step;
        if (await lastResort(s, from, L, text)) {
          if (s.step !== stepBefore) return new Response("OK", { status: 200 });
        } else {
          await helpInstead(s, from, L, text);
          return new Response("OK", { status: 200 });
        }
        // v200 (11 Oct): Bernard got "¿Qué día te viene bien?" five times in
        // four minutes, once after every answer, including straight after
        // "Perfecto, sin prisas" when he had said he would tell us the day
        // later. After an answered question the step's question goes again at
        // most once in 15 minutes, and never when they said they will say later.
        const reAskedLately = s.data.reAskStep === s.step && Date.now() - Number(s.data.reAskAt || 0) < 15 * 60e3;
        if (reAskedLately || LATER_RE.test(text)) {
          await logEvent(from, "reask_skipped", { step: s.step, later: LATER_RE.test(text) });
          return new Response("OK", { status: 200 });
        }
        s.data.reAskStep = s.step; s.data.reAskAt = Date.now(); await saveSession(s);
      }
      await reAsk(s, from, L);
      return new Response("OK", { status: 200 });
    }

    if ((text && !freeTextStep && wantsHuman(text)) || replyId === "svc_human") {
      // v39: no hand-off. Help here, tell Jordan, carry on (Jordan, 5 Sept).
      await helpInstead(s, from, L, text || "asked for a person");
      return new Response("OK", { status: 200 });
    }
    // v194 (replay of 76 real chats, 9 Oct): a first message that is a question
    // was answered and then sent the old "What type of massage would you like?"
    // menu, skipping the first message with prices and areas. At "start" the
    // answer now rides on top of the normal first message instead.
    const openWithAnswer = async (pre: string) => { await greet(s, from, text, pre); await sendReservePage(s, from); };
    if (text && !freeTextStep && zoneQ(text)) {
      // v207: a booked customer asking where gets the studio's address and
      // nothing else, not the opener or a new booking question.
      const booked = await bookedWhereFor(from, L);
      if (booked) { await sendText(from, booked); await logEvent(from, "where_answered", { booked: true, step: s.step }); return new Response("OK", { status: 200 }); }
      // The first message lists the areas; say only what it does not.
      if (s.step === "start") { await openWithAnswer(L === "es" ? "No somos un solo sitio: te reservamos en el centro que mejor te venga, y su nombre y dirección te llegan con la oferta." : "We're not one place: we book you into the studio that suits you best, and you get its name and address with the offer."); return new Response("OK", { status: 200 }); }
      await sendText(from, COPY[L].zoneAnswer);
      await continueFromKnown(s, from, L);
      return new Response("OK", { status: 200 });
    }

    // "How does this work?" gets a real answer anywhere outside free-text steps,
    // then the flow continues where it left off.
    if (text && !freeTextStep && (HOWWORKS_RE.test(text) || WHO_RE.test(text))) {
      if (s.step === "start") { await openWithAnswer(COPY[L].howItWorks); return new Response("OK", { status: 200 }); }
      await sendText(from, COPY[L].howItWorks);
      if (["start", "await_service", "returning_choice", "done"].includes(s.step)) {
        s.step = "await_service"; await saveSession(s);
        await askService(from, L);
      }
      return new Response("OK", { status: 200 });
    }

    // v129 (26 Sept 23:14, live): "Buenas noches, cual es el precio de los
    // masajes" was a first message, so the step was "start" and the button-step
    // branch above never ran. SERVICEQ_RE matched "cual ... masajes" and he was
    // sent the service menu with no price in it. A price question is answered
    // wherever it is asked, and only then do we carry on.
    if (text && !freeTextStep && PRICEQ_RE.test(text)) {
      // The first message already carries the real price range.
      if (s.step === "start") { await logEvent(from, "price_asked", { said: String(text).slice(0, 80), first: true }); await openWithAnswer(""); return new Response("OK", { status: 200 }); }
      await sendText(from, COPY[L].priceInfo);
      await logEvent(from, "price_asked", { said: String(text).slice(0, 80) });
      await continueFromKnown(s, from, L);
      return new Response("OK", { status: 200 });
    }

    // v129 (27 Sept 05:00, live): three tries in two languages for photos and
    // the bot had no answer for any of them.
    if (text && !freeTextStep && PHOTOQ_RE.test(text)) {
      if (s.step === "start") { await logEvent(from, "photos_asked", { said: String(text).slice(0, 80), first: true }); await openWithAnswer(COPY[L].photoAnswer); return new Response("OK", { status: 200 }); }
      await sendText(from, COPY[L].photoAnswer);
      await logEvent(from, "photos_asked", { said: String(text).slice(0, 80) });
      await continueFromKnown(s, from, L);
      return new Response("OK", { status: 200 });
    }

    // v112 (Jordan, 19 Sept): "why would you ask what day???" A question about
    // what we offer is answered with what we offer, then the picker, so the
    // next thing they do is a tap. Guarded on detectService: "which relaxing
    // massage is cheapest" has already named the service and must not be sent
    // back to the menu they have already come through.
    if (text && !freeTextStep && SERVICEQ_RE.test(text) && !detectService(text)) {
      await sendText(from, COPY[L].servicesAnswer);
      s.step = "await_service";
      await saveSession(s);
      await askServiceMore(from, L);
      await logEvent(from, "services_asked", { said: String(text).slice(0, 80) });
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
      // v92: a tap on "Finish my booking" is not a fresh start. The recovery
      // template tells someone their massage is still saved with us, and this
      // branch then wiped the one thing we had just promised was safe.
      // Favioagui tapped at 09:45 on 15 Sept, forty minutes after the
      // template, and was answered with "Hi! We're Massage Club, what type of
      // massage would you like?" His service, day and area were thrown away in
      // the same breath. Eight other people were still holding that button.
      //
      // So a recovered session picks up at the first question we do not have
      // an answer to, keeping everything we already know. Guarded on the step
      // still being one of the flow steps, because someone who has since
      // finished a booking and taps Book from the menu really does want a new
      // one and must not be resumed into stale answers.
      const RESUMABLE = ["await_service", "await_day", "await_day_text", "await_time", "await_hour", "await_time_text", "await_area", "await_studio", "await_studio_text", "await_name", "await_email"];
      if (replyId === "menu_book" && s.data.recoverySent && RESUMABLE.includes(String(s.step))) {
        dropStaleDay(s, L);
        const d = s.data;
        const resumeAt = !d.service ? "service" : !d.day ? "day" : !d.time ? "time" : !d.area ? "area" : "finish";
        await logEvent(from, "flow_resumed", { via: "recovery", at: resumeAt });
        if (resumeAt === "service") { s.step = "await_service"; await saveSession(s); await askService(from, L); }
        else if (resumeAt === "day") { s.step = "await_day"; await saveSession(s); if (d.service === "svc_unsure") await askDayUnsure(from, L); else await askDay(from, L); }
        else if (resumeAt === "time") { s.step = "await_time"; await saveSession(s); await askTime(from, L); }
        else if (resumeAt === "area") { s.step = "await_area"; await saveSession(s); await askArea(from, L); }
        else { await askNameOrFinalize(s, from, L); }
        return new Response("OK", { status: 200 });
      }
      // v101: recoverySent survives the reset. recover-abandoned reads
      // funnel_events now, so this is belt and braces, but the flag saying
      // someone has already had their one template must not be thrown away
      // by the very tap that template invited.
      s.step = "await_service"; s.data = { lang: s.data.lang || "", known: s.data.known || null, adRef: s.data.adRef || null, recoverySent: s.data.recoverySent || null };
      await saveSession(s); await logEvent(from, "flow_started", { via: "menu" }); await askService(from, L);
      return new Response("OK", { status: 200 });
    }
    // v76 (9 Sept): a customer who already has a booking in play is not
    // starting over. Fernando wrote "Hola / Ya he llegado" while standing at
    // Sinergia38's door and the greeting and reset branches below wiped his
    // session, lost his language and sent him the service menu. Read what they
    // wrote against their booking first; the branches below still run when the
    // model has nothing useful.
    if (text && !freeTextStep && !replyId && !HI_RE.test(text.trim())) {
      const liveReq = await lastRequestFor(from);
      const liveStage = String(liveReq?.stage || "");
      // v179: Javier tapped "Ahora no", then clicked the ad again. The ad's
      // opener and "Quiero un masaje" went to the agent as chat. With nothing
      // live, wanting a massage starts a booking.
      if (s.step === "done" && !["confirmed", "offered", "bidding", "studio_replied"].includes(liveStage)
          && (AD_OPENER_RE.test(text) || /^(hola,?\s*)?(quiero|quisiera|i want|i'?d like)( (un|a|to book a))? (masaje|massage)\b/i.test(text))) {
        s.data = { lang: s.data.lang || "", adRef: s.data.adRef || null };
        await greet(s, from, text);
        return new Response("OK", { status: 200 });
      }
      if (["confirmed", "offered", "bidding", "studio_replied"].includes(liveStage) || s.step === "done" || s.step === "human") {
        if (await lastResort(s, from, L, text)) return new Response("OK", { status: 200 });
      }
    }

    if ((HI_RE.test(text) || (text && !freeTextStep && BOOKAGAIN_RE.test(text))) && s.step !== "start" && !["await_name", "await_email", "await_email_req", "await_email_post", "await_day_text", "await_offer", "await_sameday", "await_reconfirm", "await_change"].includes(s.step)) {
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
        await sendReservePage(s, from);
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
        // v72: the language question is gone. It cost a turn and returned only a
        // restatement of who we are; three people tapped it and never wrote
        // again. Carry on bilingually until their own words settle it, and the
        // menus still carry an inline "switch to English" for anyone who wants
        // to choose deliberately.
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
          } else if (text && zoneQ(text)) {
            await sendText(from, await whereAnswer(from, L));
            await askService(from, L);
          } else await askService(from, L);
        }
        break;
      }
      case "await_day": {
        // v206 review (12 Oct): the core saves a clock time with no day only
        // after checking it against studio hours, not against today's clock
        // (it cannot know the day yet). At 18:55, "18:00" then a tap on Today
        // would send the studios a time already gone. The tapped day goes
        // through the core's own check first; a time it rules out is cleared,
        // and the plain day branch below asks the time again.
        if ((replyId === "day_today" || replyId === "day_tomorrow") && s.data.coreAt && s.data.time) {
          const iso = madridCalendar(Date.now(), 2)[replyId === "day_today" ? 0 : 1].iso;
          const chk = validateDetails({ day: iso }, { ...s.data, day: null, dayDate: null }, Date.now(), coreCtx(), L === "es" ? "es" : "en");
          if (chk.errors.length || chk.clear.includes("time")) { for (const k of DAY_CLEARS) delete s.data[k]; await logEvent(from, "core_time_cleared", { tapped: replyId, why: (chk.errors[0] || "earliest").slice(0, 120) }); }
        }
        // v206: agent_core saves everything a customer says in one go ("evening
        // near Salamanca"), then asks the day with these buttons. With the time
        // already known, the tap goes on from it the way a date tapped on the
        // seven-day list always has (pickListedDay), instead of asking it again.
        // Only for sessions the core has spoken in (coreAt), so nothing changes
        // for anyone else.
        if ((replyId === "day_today" || replyId === "day_tomorrow") && s.data.coreAt && s.data.time) {
          const plus = replyId === "day_today" ? 0 : 1;
          s.data.day = plus ? (L === "es" ? "Mañana" : "Tomorrow") : (L === "es" ? "Hoy" : "Today"); s.data.dayDate = longDate(L, plus);
          await saveSession(s); await logEvent(from, "day_chosen", { day: plus ? "tomorrow" : "today", time_known: true });
          await afterTime(s, from, L);
        }
        else if (replyId === "day_today") { s.data.day = L === "es" ? "Hoy" : "Today"; s.data.dayDate = longDate(L, 0); s.step = "await_time"; await saveSession(s); await logEvent(from, "day_chosen", { day: "today" }); await askTime(from, L); }
        else if (replyId === "day_tomorrow") { s.data.day = L === "es" ? "Mañana" : "Tomorrow"; s.data.dayDate = longDate(L, 1); s.step = "await_time"; await saveSession(s); await logEvent(from, "day_chosen", { day: "tomorrow" }); await askTime(from, L); }
        // v204: "Another day" is the seven-day list now, and a date tapped on it
        // (or on one sent earlier) is the day.
        else if (replyId === "day_other") { s.step = "await_day_text"; await saveSession(s); await askDayList(from, L); }
        else if (replyId.startsWith("dayd_")) { if (!(await pickListedDay(s, from, L, replyId))) { s.step = "await_day_text"; await saveSession(s); await askDayList(from, L); } }
        // v53: a typed "hoy", "mañana", "el lunes" or "12 de septiembre" at the day buttons is an answer.
        else if (text && detectDay(text, L)) {
          const d = detectDay(text, L);
          s.data.day = d;
          s.data.dayDate = /^(hoy|today)$/i.test(d) ? longDate(L, 0) : (/^(mañana|tomorrow)$/i.test(d) ? longDate(L, 1) : null);
          // v188: the opener invites "tomorrow 18:00 near Sol". Keep the time
          // and the area too instead of asking for them again.
          const more = absorbOffStep(s, text, L, "day");
          await logEvent(from, "day_chosen", { day: "typed", more });
          if (s.data.time) { await saveSession(s); await afterTime(s, from, L); }
          else { s.step = "await_time"; await saveSession(s); await askTime(from, L); }
        }
        // v56: "deep tissue please" at the day question changes the assumed massage.
        else if (text && detectService(text) && detectService(text) !== s.data.service && !text.includes("?") && !MEANING_RE.test(text)) {
          s.data.service = detectService(text); delete s.data.defaultService; await saveSession(s);
          await logEvent(from, "service_chosen", { service: s.data.service, typed: true });
          const row = ALL_SERVICES.find((x) => x.id === s.data.service);
          await sendText(from, L === "es" ? `Perfecto, ${row ? String(row.tEs).toLowerCase() : "ese masaje"}.` : `Got it, ${row ? String(row.tEn).toLowerCase() : "that one"}.`);
          if (s.data.service === "svc_unsure") await askDayUnsure(from, L); else await askDay(from, L);
        }
        // v182: "Sisi" and "Gracias," on 6 Oct each got "Perdona, no te he
        // entendido". Agreeing or thanking is not a miss: ask the day again,
        // plainly, without saying we did not understand.
        else if (text && SOFT_ACK_RE.test(text)) {
          await logEvent(from, "soft_ack", { at: "await_day", said: text.slice(0, 30) });
          if (s.data.service === "svc_unsure") await askDayUnsure(from, L); else await askDay(from, L);
        }
        else {
          // v191: the reader first. "1. full body, lower back pain 2. any time
          // 3. near Rios Rosas" has nothing a regex knows, and all of it counts.
          const rgot = text ? await readerAssist(s, from, L, text, "day") : [];
          if (rgot.length) {
            await sendText(from, COPY[L].gotItSvc(understood(s, L, rgot)));
            s.data.miss = 0;
            if (s.data.day) await nextStep(s, from, L);
            else { await saveSession(s); if (s.data.service === "svc_unsure") await askDayUnsure(from, L); else await askDay(from, L); }
            break;
          }
          // v81: keep whatever they did tell us before repeating the question.
          const got = text ? absorbOffStep(s, text, L, "day") : [];
          if (got.length) {
            await saveSession(s);
            await logEvent(from, "offstep_absorbed", { at: "await_day", got });
            await sendText(from, COPY[L].gotItSvc([s.data.area, s.data.time].filter(Boolean).join(" · ")));
            s.data.miss = 0;
          } else {
            // v105: on 18 Sept a lead sent four Instagram links and got the same
            // sentence back four times, word for word, because an answer we
            // cannot read just re-asks the question. The counter keys on the
            // step, so moving on clears it and nothing needs resetting
            // elsewhere. From the second consecutive miss we say we did not
            // understand before asking again.
            s.data.miss = (s.data.missAt === s.step ? Number(s.data.miss || 0) : 0) + 1;
            s.data.missAt = s.step;
            // v119: s.data.miss resets whenever the step changes, so it cannot
            // see a conversation that is confused all the way through. Pilar
            // missed six times across three different steps and every one of
            // them looked like a first miss. This one never resets, and it is
            // what decides whether we read the booking back before spending
            // four studios on it.
            s.data.missTotal = Number(s.data.missTotal || 0) + 1;
            await saveSession(s);
            // v108 (Jordan, case 04): name what they sent before asking again.
            // Someone who sends a link is showing us something, not failing to
            // answer, and the first thing they should read is that it arrived.
            if (LINK_ONLY_RE.test(String(text || ""))) {
              await sendText(from, COPY[L].gotLink);
              await logEvent(from, "got_link", { at: "await_day" });
              break;
            }
            // v176: a sentence we cannot place goes to the agent (Qwen, then
            // Claude) before we ever say we did not understand.
            const stepNow = s.step;
            if (text && text.trim().split(/\s+/).length >= 2 && await lastResort(s, from, L, text)) {
              if (s.step !== stepNow) break;
              // v200: see LATER_RE. Answered, so the day question goes again at
              // most once in 15 minutes, and not at all after "I'll tell you".
              if (LATER_RE.test(text) || (s.data.reAskStep === s.step && Date.now() - Number(s.data.reAskAt || 0) < 15 * 60e3)) {
                await logEvent(from, "reask_skipped", { step: s.step, later: LATER_RE.test(text) });
                break;
              }
              s.data.reAskStep = s.step; s.data.reAskAt = Date.now(); await saveSession(s);
            } else if (s.data.miss >= 2) {
              // v183 (8 Oct): Alexandru wrote in Romanian and broken Spanish
              // ("Traslator. Romano", "Noă tindo") and got "Sorry, I did not catch
              // that" in English three times. Say which languages we speak, in
              // both, and make the question something he can tap.
              // v188: from the third miss on, no "did not catch that" at all, in
              // any language: the day buttons below are the whole answer.
              // v195: and no "did not catch that" here either. Say what we can do.
              if (s.data.miss === 2) await sendText(from, "Puedo ayudarte en español o en inglés. Toca un día abajo o escríbeme cuándo te viene bien, por ejemplo \"mañana a las 18:00\".\nI can help in Spanish or English. Tap a day below or write when suits you, like \"tomorrow 18:00\".");
              await logEvent(from, "not_caught", { at: "await_day", miss: s.data.miss, said: String(text || "").slice(0, 80) });
            }
          }
          if (s.data.service === "svc_unsure") await askDayUnsure(from, L); else await askDay(from, L);
        }
        break;
      }
      case "await_day_text": {
        // v204: a date tapped on the seven-day list.
        if (replyId.startsWith("dayd_")) { if (!(await pickListedDay(s, from, L, replyId))) await askDayList(from, L); break; }
        // v204 (12 Oct, synth.md change 4): a day is saved here only when it
        // is one. A typed day is read exactly as at the day buttons.
        if (text && detectDay(text, L)) {
          const d = detectDay(text, L);
          s.data.day = d;
          s.data.dayDate = /^(hoy|today)$/i.test(d) ? longDate(L, 0) : (/^(mañana|tomorrow)$/i.test(d) ? longDate(L, 1) : null);
          const more = absorbOffStep(s, text, L, "day");
          await logEvent(from, "day_chosen", { day: "typed", at: "await_day_text", more });
          if (s.data.time) { await saveSession(s); await afterTime(s, from, L); }
          else { s.step = "await_time"; await saveSession(s); await askTime(from, L); }
          break;
        }
        // v81: this used to take any text at all as the day. Jorge typed "Por
        // plaza Cuzco" here on 10 Sept and his area became his day; he never
        // wrote again. If it does not look like a day but does look like
        // something else we need, keep that instead and ask the day again.
        if (text) {
          const got = absorbOffStep(s, text, L, "day");
          if (got.length) {
            await saveSession(s);
            await logEvent(from, "offstep_absorbed", { at: "await_day_text", got });
            await sendText(from, COPY[L].gotItSvc([s.data.area, s.data.time].filter(Boolean).join(" · ")));
            await askDayList(from, L);
            break;
          }
        }
        // v200 (11 Oct): Hafeez answered "Would you like a menu of massages?"
        // with "Plzz" and "Send me" at this step, "Plzz" became his day and he
        // was asked the time. A please, a yes or a hello is not a day; after a
        // menu offer it is a yes to the menu.
        if (text && NOT_A_DAY_RE.test(text.trim())) {
          const th = await recentThread(from);
          const lastOut = [...th].reverse().find((m) => m.dir === "out")?.body || "";
          if (/\b(menu|men[uú]|list|lista|types?|tipos?)\b/i.test(lastOut) && !/\b(hi|hello|hola|thanks?|gracias)\b/i.test(text)) {
            const list = String(COPY[L].servicesAnswer).split("\n\n").slice(0, -1).join("\n\n");
            await sendText(from, list + "\n\n" + (L === "es" ? "Dime cuál te apetece y qué día." : "Tell me which one you'd like, and which day."));
            await logEvent(from, "services_asked", { said: text.slice(0, 40), at: "await_day_text", via: "menu_yes" });
          } else await askDayList(from, L);
          break;
        }
        // v204: v200 taught this step that "Plzz" and "ok" are not days, and
        // "yes please", "send me the list", "si porfa" and "Mándame la lista"
        // would still have been saved as Hafeez's day: the last line here took
        // any text at all. Now the reader may find a day ("the 20th", "next
        // Friday"); anything else goes to the agent, which answers it, and the
        // day list comes back at most once in 15 minutes (the v200 limit).
        if (text) {
          const rgot = await readerAssist(s, from, L, text, "day");
          if (rgot.includes("day")) {
            await sendText(from, COPY[L].gotItSvc(understood(s, L, rgot)));
            await nextStep(s, from, L);
            break;
          }
          if (rgot.length) { await sendText(from, COPY[L].gotItSvc(understood(s, L, rgot))); await askDayList(from, L); break; }
          const stepNow = s.step;
          if (text.trim().split(/\s+/).length >= 2 && await lastResort(s, from, L, text)) {
            if (s.step !== stepNow) break;
            if (LATER_RE.test(text) || (s.data.reAskStep === s.step && Date.now() - Number(s.data.reAskAt || 0) < 15 * 60e3)) {
              await logEvent(from, "reask_skipped", { step: s.step, later: LATER_RE.test(text) });
              break;
            }
            s.data.reAskStep = s.step; s.data.reAskAt = Date.now(); await saveSession(s);
          } else await logEvent(from, "not_a_day", { said: text.slice(0, 60) });
        }
        await askDayList(from, L);
        break;
      }
      case "await_time": {
        if (HOURS[replyId]) {
          // v81: the band is the answer. This used to push on to await_hour, so
          // one fact cost two screens out of a flow the evidence says should be
          // three or four questions total. The band goes to the studio and the
          // studio proposes the exact hour, which it knows better than the
          // customer guessing: the gaps in its own diary. A studio answering a
          // band with no exact time is already handled as availability rather
          // than a booking (v43), so nothing downstream has to change.
          s.data.timeBandId = replyId;
          s.data.timeBand = L === "es" ? HOURS[replyId].labelEs : HOURS[replyId].label;
          s.data.time = s.data.timeBand;
          await logEvent(from, "time_chosen", { time: s.data.time, band: true });
          await afterTime(s, from, L);
        } else if (replyId === "time_custom") {
          s.step = "await_time_text"; await saveSession(s);
          await sendText(from, COPY[L].timeAsk);
        } else if (text && TIME_RE.test(text)) {
          s.data.time = text.slice(0, 20); s.data.timeBand = null; s.data.timeBandId = null;
          await afterTime(s, from, L);
        } else {
          // v81: keep an area or a day offered at the time question.
          const got = text ? absorbOffStep(s, text, L, "time") : [];
          if (got.length) {
            await saveSession(s);
            await logEvent(from, "offstep_absorbed", { at: "await_time", got });
            await sendText(from, COPY[L].gotItSvc([s.data.day, s.data.area].filter(Boolean).join(" · ")));
          } else {
            // v191: what no regex could place, the reader may.
            const rgot = text ? await readerAssist(s, from, L, text, "time") : [];
            if (rgot.length) {
              await sendText(from, COPY[L].gotItSvc(understood(s, L, rgot)));
              if (rgot.includes("time")) { await afterTime(s, from, L); break; }
            }
          }
          await askTime(from, L);
        }
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
        // v187 (9 Oct, live: omar faress at 02:42 tapped "Afternoon" and then
        // "Tomorrow" on the earlier buttons and got this same warning three
        // times). A tap on an earlier time or day button is an answer.
        else if (HOURS[replyId]) {
          s.data.timeBandId = replyId;
          s.data.timeBand = L === "es" ? HOURS[replyId].labelEs : HOURS[replyId].label;
          s.data.time = s.data.timeBand;
          await logEvent(from, "sameday_choice", { choice: "new_band", band: replyId });
          await afterTime(s, from, L);
        }
        else if (replyId === "day_tomorrow") { s.data.day = L === "es" ? "Mañana" : "Tomorrow"; s.data.dayDate = longDate(L, 1); await logEvent(from, "sameday_choice", { choice: "tomorrow_tap" }); await afterTime(s, from, L); }
        else if (replyId === "day_other") { s.step = "await_day_text"; await saveSession(s); await askDayList(from, L); }
        else if (replyId.startsWith("dayd_") && await pickListedDay(s, from, L, replyId)) { await logEvent(from, "sameday_choice", { choice: "listed_day" }); }
        else if (s.data.sameDayRepeats) { await logEvent(from, "sameday_choice", { choice: "keep_after_repeat" }); await afterTime(s, from, L); }
        else { s.data.sameDayRepeats = 1; await saveSession(s); await sendButtons(from, COPY[L].sameDay, COPY[L].sameDayBtns(String(s.data.time || ""))); }
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
            // v81: the fallback below takes any text as the area, so "tomorrow
            // at 6" typed here became someone's neighbourhood. If it is not a
            // known area but is recognisably a day or a time, keep it as that
            // and ask the area again. Same fault that swallowed Jorge's area.
            if (!hit) {
              // v126: absorbOffStep only reports fields it FILLED, so once the
              // ad had set Hatem's service to relax, his answer "Relaxing
              // massage" filled nothing, reported nothing, and fell through to
              // become his neighbourhood. What a message plainly IS matters
              // more than what we happen to be missing: a service is never an
              // area, and neither is a day or a time.
              const isSvc = !!(UNSURE_RE.test(text) || detectService(text));
              const isWhen = !!(detectDay(text, L) || detectTime(text, L));
              const got = absorbOffStep(s, text, L, "area");
              if (got.length || isSvc || isWhen) {
                await saveSession(s);
                await logEvent(from, "offstep_absorbed", { at: "await_area", got, isSvc, isWhen });
                await sendText(from, COPY[L].gotItSvc([s.data.day, s.data.time].filter(Boolean).join(" · ")));
                await askArea(from, L);
                break;
              }
            }
            // v159: "Estoy fuera de Madrid" became Abdelatif's area and two
            // studios were asked for a customer who is not in Madrid.
            if (!hit && /\b(fuera de madrid|no estoy en madrid|outside( of)? madrid|not in madrid)\b/i.test(stripAcc(text))) {
              await logEvent(from, "outside_madrid", { text: text.slice(0, 80) });
              await sendText(from, L === "es"
                ? "Trabajamos con centros en Madrid y alrededores. ¿En qué zona o pueblo estás? Si hay un centro cerca, te lo busco."
                : "We work with studios in Madrid and nearby. Which area or town are you in? If there is a studio close by, I'll find it.");
              break;
            }
            // v179: a bare yes/ok is not a neighbourhood ("near No", Vinzma29).
            if (!hit && /^(no|nope|nah|yes|yeah|yep|s[ií]|ok|okay|vale|claro)[\s.!]*$/i.test(text.trim())) { await sendText(from, COPY[L].areaAgain); break; }
            // v191: "Vivo cerca se Moncloa" is Moncloa, not a 21-letter area.
            if (!hit) {
              const rgot = await readerAssist(s, from, L, text, "area");
              if (rgot.includes("area")) area = String(s.data.area || "");
            }
            area = area || hit || text.slice(0, 40);
          }
        }
        if (area) {
          s.data.area = area;
          await logEvent(from, "area_given", { area });
          // v35 took the studio question out (4 of 4 saw a list, 1 picked).
          // v152 (Jordan, 4 Oct) brings back an offer, not a list: two studios
          // with prices as buttons, plus "Best price" for the v35 behaviour.
          if (!(await offerStudios(s, from, L))) await askNameOrFinalize(s, from, L);
        } else await sendText(from, COPY[L].areaAgain);
        break;
      }
      case "await_studio": {
        // v183: the price-objection offer is id-based, so it never re-points
        // the studio_N buttons already on screen. A typed yes takes it, a typed
        // no closes politely.
        if (s.data.cheapPick && !replyId && text && (SOFT_ACK_RE.test(text) || /^(yes|s[ií])\b/i.test(text.trim()))) replyId = "cheap_pick";
        if (s.data.cheapPick && !replyId && text && NOTHANKS_RE.test(text.trim())) {
          s.data.cheapPick = null; s.step = "done"; await saveSession(s);
          await sendText(from, COPY[L].rebookLater);
          break;
        }
        if (replyId === "cheap_pick" && s.data.cheapPick) {
          const cp = s.data.cheapPick;
          s.data.chosen = null; s.data.customStudio = null;
          s.data.prefer = [cp, ...(Array.isArray(s.data.cheapBackup) ? s.data.cheapBackup : [])].map((x: any) => ({ id: x.id, name: x.name }));
          s.data.cheapPick = null; s.data.cheapBackup = null;
          await logEvent(from, "studio_chosen", { how: "price_objection", studio: cp.name });
          await askNameOrFinalize(s, from, L);
          break;
        }
        if (replyId === "pick_yes") {
          const top = (s.data.picks || [])[0];
          if (top) { s.data.chosen = top; s.data.customStudio = null; await logEvent(from, "studio_chosen", { how: "toppick", studio: top.name }); await askNameOrFinalize(s, from, L); }
          else await askStudio(from, L, s);
        }
        else if (replyId === "pick_more") { await askStudioList(from, L, s); }
        else if (replyId === "studio_any") { s.data.chosen = null; s.data.customStudio = null; s.data.prefer = null; await logEvent(from, "studio_chosen", { how: "any" }); await askNameOrFinalize(s, from, L); }
        else if (replyId === "studio_other") { s.step = "await_studio_text"; await saveSession(s); await sendText(from, COPY[L].otherStudioAsk); }
        else if (replyId.startsWith("studio_") && s.data.offerMode) {
          // v152: the tapped studio is asked first, the other offered studios
          // are the backup, all in one dispatch. The request stays unassigned
          // until a studio says yes, so the old single-studio path never runs.
          const idx = Number(replyId.split("_")[1]);
          const picks = Array.isArray(s.data.picks) ? s.data.picks : [];
          const p = picks[idx];
          if (p) {
            s.data.chosen = null; s.data.customStudio = null;
            s.data.prefer = [p, ...picks.filter((_x: any, i: number) => i !== idx)].map((x: any) => ({ id: x.id, name: x.name }));
            await logEvent(from, "studio_chosen", { how: "offer_first", studio: p.name });
            await askNameOrFinalize(s, from, L);
          } else if (!(await offerStudios(s, from, L))) await askNameOrFinalize(s, from, L);
        }
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
        } else if (s.data.offerMode) { if (!(await offerStudios(s, from, L))) await askNameOrFinalize(s, from, L); }
        else await askStudio(from, L, s);
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
      // v119: the confirmation gate. Only a conversation the bot fumbled twice
      // or more ever lands here, and nothing has been sent to a single studio
      // when it does. Yes releases the fan-out; anything else keeps the request
      // parked at awaiting_go, which the dispatch sweep does not pick up, so
      // silence here costs a studio nothing.
      case "await_go": {
        const goId = Number(s.data.pendingReq || 0);
        const yes = replyId === "go_yes" || (!!text && /^\s*(?:s[ií]|si|yes|yep|yeah|ok(?:ay)?|vale|venga|adelante|perfecto|claro|dale|go|please do|hazlo|pregunta)\b/i.test(text));
        const change = replyId === "go_change" || (!!text && /\b(?:no|cambiar|cambia|espera|wait|stop|otra|otro|change|cancel|anula)\b/i.test(text));
        if (yes && !change && goId) {
          s.step = "done"; await saveSession(s);
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${goId}`, {
            method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
            body: JSON.stringify({ stage: "new", stage_note: "customer confirmed before dispatch" }),
          });
          const svcGo = s.data.chosen && s.data.chosen.svc ? s.data.chosen.svc : (ALL_SERVICES.find((x) => x.id === (s.data.service === "svc_unsure" ? "svc_relax" : s.data.service))?.en || "Massage");
          const whereGo = s.data.customStudio ? s.data.customStudio : (s.data.area && s.data.area !== "anywhere" ? (L === "es" ? `cerca de ${s.data.area}` : `near ${s.data.area}`) : (L === "es" ? "en Madrid" : "in Madrid"));
          // v204: the same readback as finalizeBooking: ask first, then say
          // what really went out (dispatchAndTell).
          const saidGo = await dispatchAndTell(s, from, L, goId, (Array.isArray(s.data.prefer) ? s.data.prefer : []).map((x: any) => String(x.id)), [
            String(s.data.name || s.wa_name || "").split(" ")[0],
            trSvc(svcGo, L) + (s.data.duration && s.data.duration !== 60 ? ` ${s.data.duration} min` : ""),
            [s.data.dayDate ? `${String(s.data.day || "").toLowerCase()} ${s.data.dayDate}`.trim() : s.data.day, s.data.time].filter(Boolean).join(", "),
            whereGo]);
          await logEvent(from, "go_confirmed", { id: goId, dispatch: saidGo });
          break;
        }
        if (change) {
          // Nothing was sent, so nothing has to be unsent. Close the parked
          // request and put them back at the day question.
          if (goId) {
            await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${goId}`, {
              method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
              body: JSON.stringify({ stage: "dismissed", stage_note: "customer changed their mind at the confirmation, no studio was asked" }),
            });
          }
          s.data.pendingReq = null;
          s.data.miss = 0; s.data.missTotal = 0;
          s.step = "await_day"; await saveSession(s);
          await sendText(from, COPY[L].goChanged);
          await askDay(from, L);
          await logEvent(from, "go_changed", { id: goId });
          break;
        }
        await sendText(from, COPY[L].goWaiting);
        await sendButtons(from, COPY[L].askGo(
          String(s.data.name || s.wa_name || "").split(" ")[0],
          trSvc(s.data.chosen && s.data.chosen.svc ? s.data.chosen.svc : (ALL_SERVICES.find((x) => x.id === (s.data.service === "svc_unsure" ? "svc_relax" : s.data.service))?.en || "Massage"), L),
          [s.data.dayDate ? `${String(s.data.day || "").toLowerCase()} ${s.data.dayDate}`.trim() : s.data.day, s.data.time].filter(Boolean).join(", "),
          s.data.area && s.data.area !== "anywhere" ? (L === "es" ? `cerca de ${s.data.area}` : `near ${s.data.area}`) : (L === "es" ? "en Madrid" : "in Madrid")), COPY[L].askGoBtns);
        break;
      }
      case "await_name": {
        if (!text) { await sendText(from, COPY[L].name); break; }
        // v121: "Me llamo Manju" used to store "Me". parseName strips the
        // sentence people actually answer with and rejects anything that is
        // not a plausible name, so we ask again instead of sending a phrase to
        // a studio.
        // v126: "Retiro" is a neighbourhood. Hatem answered this question with
        // his area, because he was one question behind the whole way through,
        // and a bare plausible word sails through parseName. Anything that is
        // plainly a slot value goes to its own field and we ask again. Once
        // only: somebody really called Salamanca must not be stuck in a loop.
        const asArea = detectArea(text);
        const asSvc = UNSURE_RE.test(text) ? "svc_unsure" : detectService(text);
        const asDay = detectDay(text, L);
        const asTime = detectTime(text, L);
        if ((asArea || asSvc || asDay || asTime) && !s.data.nameOffstep) {
          s.data.nameOffstep = true;
          if (asArea && !s.data.area) s.data.area = asArea;
          if (asSvc && !s.data.service) s.data.service = asSvc;
          if (asDay && !s.data.day) s.data.day = asDay;
          if (asTime && !s.data.time) { s.data.time = asTime; s.data.timeBand = /\(/.test(asTime) ? asTime : null; }
          await saveSession(s);
          await logEvent(from, "offstep_absorbed", { at: "await_name", area: asArea || null, service: asSvc || null, day: asDay || null, time: asTime || null });
          await sendText(from, COPY[L].name);
          break;
        }
        const parsedName = parseName(text);
        if (!parsedName) { await sendText(from, COPY[L].name); break; }
        s.data.name = parsedName.slice(0, 80);
        // v67: the email is asked here, by finalizeBooking, before the request
        // exists. v50 had moved it to after a studio confirmed, to shorten the
        // flow; that left customers we could not answer (Sharo J, 8 Sept).
        s.data.email = s.data.email || null;
        await finalizeBooking(s, from, L);
        break;
      }
      case "await_email_req": {
        // v70: a tap is not an answer to this question. Live test on 8 Sept:
        // a button left over from an earlier message arrived here, matched
        // nothing, and was recorded as a refusal, so the booking went out with
        // no email and nobody typed a word. Only typed text can decline.
        if (replyId && !text) { await sendText(from, COPY[L].email); break; }
        if (text && isEmail(text)) {
          s.data.email = text.trim().toLowerCase();
          // v123: both outcomes are logged so the share of requests that end up
          // with a second channel can actually be read, instead of being found
          // out fourteen days later by counting nulls.
          await logEvent(from, "email_given", {});
          await finalizeBooking(s, from, L);
          break;
        }
        // A mangled address gets one retry. Anything else is a refusal, and a
        // refusal does not lose us the customer: they are in a WhatsApp thread,
        // so we can still reach them. It is logged and Jordan is told, because
        // an exception nobody can see is the same as no rule at all.
        // v125 (25 Sept): this retry used to need an "@" in the message, so only
        // a mangled address got a second chance. Hatem answered with "Hatem",
        // his own name, because he was one question behind the whole way
        // through, and a name is not a no. Anything that is not an address and
        // not one of the refusal words now gets the question once more; the
        // second miss is still a refusal, so it cannot loop.
        if (text && !EMAIL_REFUSE_RE.test(text) && !s.data.emailRetried) {
          s.data.emailRetried = true; await saveSession(s);
          await sendText(from, COPY[L].emailBad);
          await logEvent(from, "email_reasked", { said: text.slice(0, 60) });
          break;
        }
        s.data.emailRefused = true; await saveSession(s);
        await logEvent(from, "email_refused", { said: String(text || "").slice(0, 60) });
        await notifyJordanWa(`${s.wa_name || "+" + digitsOf(from)} would not give an email (${text ? text.slice(0, 60) : "no answer"}). Booking went ahead because they are reachable on WhatsApp, but there is no second channel.`, from);
        await sendText(from, L === "es"
          ? "Sin problema, seguimos sin email. Entonces todo te lo cuento por aquí, así que echa un ojo a este chat."
          : "No problem, we will carry on without one. Everything comes through here then, so keep an eye on this chat.");
        await finalizeBooking(s, from, L);
        break;
      }
      case "await_email": {
        // A skip here is a refusal, and finalizeBooking must not ask a second
        // time for something the customer has already turned down.
        if (text && /^(skip|saltar|no)$/i.test(text)) { s.data.email = null; s.data.emailRefused = true; }
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
        // v77: a customer naming a time here is answering the offer, not making
        // small talk. "7pm?" was Asim on 9 September, twenty minutes before two
        // studios who could do exactly that were left unasked.
        if (text) {
          const wanted = parseOfferedTime(text);
          const offReq = Number(s.data.offer?.request || 0);
          if (wanted && offReq && wanted !== String(s.data.offer?.time || "")) {
            const alt = await dispatchOfferingTime(offReq, wanted, String(s.data.offer?.row || ""));
            const cnum = s.phone.replace(/[^0-9]/g, "");
            if (alt) {
              await sendButtons(from, COPY[L].altOffer(alt.partner.business_name, wanted),
                offerButtons(L, String(alt.id), wanted));
              s.data.offer = { row: alt.id, time: wanted, studio: alt.partner.business_name, request: offReq, day: s.data.offer?.day || null };
              await saveSession(s);
              await logEvent(from, "counter_offer_matched", { request_id: offReq, time: wanted, studio: alt.partner.business_name });
              await notifyJordanWa(`${s.wa_name || "+" + cnum} asked for ${wanted} on #${offReq} and ${alt.partner.business_name} had already offered it. Re-offered automatically.`, s.phone);
            } else {
              await sendText(from, COPY[L].askingTime(wanted));
              await logEvent(from, "counter_offer_unmatched", { request_id: offReq, time: wanted });
              await notifyJordanWa(`${s.wa_name || "+" + cnum} wants ${wanted} on #${offReq} and no studio has offered that time yet. They were told we are asking.`, s.phone);
              await founderCard(`\u23f0 ${s.wa_name || "+" + cnum} asked for ${wanted} · #${offReq}`, {
                badge: "TIME REQUESTED",
                title: `${s.wa_name || "The customer"} named a time nobody has offered`,
                paras: [`They turned down ${s.data.offer?.studio || "the studio"} at ${s.data.offer?.time || "?"} and asked for ${wanted} instead. No studio on this request has offered ${wanted}. Ask the ones still in play.`],
                quote: text, waNum: cnum, prefill: await customerPrefill(s.phone), to: JORDAN,
              });
            }
            break;
          }
          // v124 (25 Sept): "Lo confirmaria un dia antes." Juan wrote exactly
          // that to a studio offer on 15 September. The bot read it as noise,
          // repeated the same offer at him and filed a card, and nobody ever
          // came back to him. It is not a no. It is a yes with a date on it,
          // and the only thing it needed was a reminder in the diary.
          if (CONFIRM_LATER_RE.test(text)) {
            const cnum = s.phone.replace(/[^0-9]/g, "");
            const clReq = Number(s.data.offer?.request || 0);
            let remindAt: Date | null = null;
            if (clReq) {
              const rr = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${clReq}&select=day1,message_text`, { headers: H() });
              const rrow = (await rr.json().catch(() => []))[0] || null;
              remindAt = confirmLaterRemindAt(rrow?.day1, rrow?.message_text);
            }
            const armed = CONFIRM_LATER_REMINDERS && !!remindAt;
            await logEvent(from, "confirm_later", {
              request_id: clReq || null, row: s.data.offer?.row || null,
              studio: s.data.offer?.studio || "", time: s.data.offer?.time || "",
              day: s.data.offer?.day || null, lang: L, armed,
              remind_at: remindAt ? remindAt.toISOString() : null, said: text.slice(0, 200),
            });
            await sendText(from, COPY[L].confirmLaterAck(armed));
            // The studio hears nothing from here. It was told we would come back
            // when the customer answers, which is still true, and studio
            // outreach is paused (Jordan, 23 Sept).
            await founderCard(`🗓 ${s.wa_name || "+" + cnum} will confirm the day before · #${clReq || "?"}`, {
              badge: armed ? "REMINDER SET" : "REMINDER OFF",
              title: `${s.wa_name || "The customer"} is not saying no, they are saying later`,
              paras: [
                `Offer on the table: ${s.data.offer?.studio || "the studio"} at ${s.data.offer?.time || "?"} (request #${clReq || "?"}). Nothing has been promised to the studio and no slot is being held.`,
                armed
                  ? `The bot re-offers it with the Yes / Another time buttons at ${remindAt!.toISOString()}, which is 11:00 Madrid the day before, or the next sensible hour if that has gone. One reminder, then it stops.`
                  : remindAt
                  ? `The day-before reminder is switched OFF, so nothing else goes out. It would have fired at ${remindAt.toISOString()}. Turn it on with confirmLaterReminders in the wa-bot loader.`
                  : `No date can be read off this request, so there is no day to remind them on. Worth a look.`,
              ],
              quote: text, waNum: cnum, prefill: await customerPrefill(s.phone), to: JORDAN,
            });
            break;
          }
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
          // v212 (16 Oct): the studio is asked about a time, never handed the
          // customer's own words (usually English, cut at 160 characters), and
          // nothing new goes to it until the customer names one (CLAUDE.md: a
          // change request freezes the booking until the customer names a
          // time). Without a time the customer is asked once more; a second
          // message without one goes to Jordan, and the studio hears nothing.
          const nt = parseOfferedTime(text);
          if (!nt) {
            if (!c.reasked) {
              await sendText(from, COPY[L].changeAsk(c.studio || "", c.time || ""));
              s.data.change = { ...c, reasked: true }; await saveSession(s);
              await notifyJordanWa(`${s.wa_name || "+" + num} wants to move ${c.studio || "the booking"} (${c.time || "?"}) but named no time: ${text.slice(0, 140)}. Asked them again; nothing sent to the studio.`, s.phone);
            } else {
              if (c.request) await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${c.request}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage_note: `Customer asks to change to: ${text.slice(0, 200)}` }) }).catch(() => {});
              await notifyJordanWa(`${s.wa_name || "+" + num} wants to move ${c.studio || "the booking"} (${c.time || "?"}) and still named no time: ${text.slice(0, 140)}. Nothing sent to the studio. Over to you.`, s.phone);
              s.step = "human"; await saveSession(s);
            }
            break;
          }
          await sendText(from, COPY[L].changeNoted(c.studio || ""));
          if (c.request) await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${c.request}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ stage_note: `Customer asks to change to: ${text.slice(0, 200)}` }) }).catch(() => {});
          if (c.studioNum) {
            const cq = c.request ? await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${c.request}&select=first_name,day1,message_text,created_at,confirmed_day,confirmed_start`, { headers: H() }).then((r) => r.json()).catch(() => []) : [];
            const crq = (Array.isArray(cq) && cq[0]) || {};
            const cfn = String(crq.first_name || "").trim();
            const bd = studioDate(crq);
            const bdEs = studioDayOf(bd);
            // A new day only when the customer named one that is not the booked day.
            const dw = text.match(/\b(today|tomorrow|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[0] || offerDayFromText(text, "es");
            const nd = dw ? resolveRequestDate(dw, "") : null;
            const newWhen = [nd && (!bd || nd.getTime() !== bd.getTime()) ? studioDayOf(nd) : "", `a las ${nt}`].filter(Boolean).join(" ");
            const booked = [deDay(bdEs), studioAtEs(c.time)].filter(Boolean).join(" ");
            await tellStudio(String(c.studioNum), cfn, String(c.time || ""),
              `Hola, ${cfn || "el cliente"} me pide cambiar su masaje${booked ? " " + booked : ""}. ¿Os iría bien ${newWhen}? Si no, decidme qué hora tenéis y se la paso.`,
              `pide cambiar la hora y le iría bien ${newWhen}; decidme si os encaja o qué otra hora tenéis y se la paso`,
              { dayEs: bdEs, v2: `Me pide cambiar la hora. ¿Os iría bien ${newWhen}? Si no, decidme qué hora tenéis y se la paso.` });
          }
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
        } else if (text && await lastResort(s, from, L, text)) {
          // v65: the model read it. Nothing more to do here.
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
