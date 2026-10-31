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
// v21 (8 Sept, Jordan): a request never reaches a studio unless we can answer
//   the customer. Either an email address or a WhatsApp thread they have
//   written to. Sharo J asked for a couples massage through the website with no
//   email and no WhatsApp history; five studios were asked, two turned their
//   afternoon over to it, and she could not be told anything at all.
// v20 (8 Sept): every note to a studio falls back to aviso_centro_v1 when their
//   24 hour window is shut, stand-downs included. Two studios asked about
//   Fernando were never told the request was covered, because plain text to a
//   studio that had not written back dies silently at Meta.
// v17 (8 Sept): a repeat from the same customer that carries new information is
//   a change, not a duplicate. The old studios are stood down, the old request
//   is closed, and the new one goes out. Fernando restated his service once and
//   his day twice on 7 Sept and all three were binned while he was told the
//   studios were being asked.
// v16 (6 Sept): a studio whose opening hours say it is closed on the day (or at
//   the time) the customer asked for is not asked. Calma Madrid, closed on
//   Sundays with hours on file since 18 Aug, was asked for Sunday slots three
//   times in one weekend and wrote to complain. Unknown hours still get asked.
// v39 (12 Oct): studios that agreed to be phoned (partners.call_ok) and whose
//   hours say they are open right now, and at the hour the call will name,
//   also get a call, right after their WhatsApp ask: one background POST to
//   studio-calls (ops place). The call never replaces the written ask and a
//   failure there never touches this one. studio-calls does nothing until
//   app_secrets VOICE_CALLS is 'test' or 'on'.
// v40 (12 Oct, with wa-bot v204): each request_dispatch row keeps the studio's
//   distance from the customer's area (km, from dispatch_candidates), so the
//   offer can say how far it is and "Closer or cheaper" can rank by it.
//   Needs supabase/migrations/20261012_dispatch_km.sql; without it the km
//   write fails on its own and nothing else changes.
// v41 (12 Oct, with wa-bot v204): the customer's "we have written to N
//   studios" note names the areas the studios are really in, not the area the
//   customer typed (askedWhere). And { request_id, customer_note: false }
//   leaves that note to the caller: wa-bot reads back how many studios were
//   really asked and says so itself, honestly, when the answer is none. The
//   fake 3460000xxxx canary numbers count as test customers (isTestPhone).
// v42 (12 Oct, with wa-bot v204, from the review): three things.
//   - { studio_note: { request_id, phone, text, short, time } } is one note to
//     one studio that has to arrive (wa-bot's lapse, "Another time", an offer
//     replaced by a better one): free text in their window, aviso_centro_v1
//     otherwise, refused outside 09:00-21:00 or the studio's own hours with
//     how "hours" or "skipped", so wa-bot can queue it. The send op is plain
//     text, which Meta drops silently once a studio's 24 hours have passed.
//   - The chase sweep's "it ended" note reaches every open row on a closed
//     request, including one already chased for an hour, and a studio we only
//     reach by email is emailed instead of being stood down without a word.
//   - A cancelled (or stale, too_late) request is no longer the original a
//     new one is a "duplicate" of: a customer who cancelled at the offer step
//     and asked again for the same slot was dismissed and never asked about.
// v48 (16 Oct, Jordan: "i don't want it to look robotic ... i see a weird
//   message not a normal message"). Every message a studio reads from here was
//   rewritten to read like a person: vosotros, Jordan in the first person,
//   Spanish dates ("el lunes 19 de octubre", "hoy", "mañana"), "a las 15:30",
//   no log lines, no signature after the first message, no "sin comisión".
//   - The ask is solicitud_reserva_v7 (short, unsigned, with the 10% Massage
//     Club rate), and a studio's first-ever message is solicitud_intro_v2
//     (who we are, signed). Until Meta approves them, the approved v3 goes,
//     with its blanks filled properly; v3 says "varios centros", so it never
//     goes to a studio that is the only one asked. The long v2 letter, the
//     legacy "Confirmado" template and the S1b invented deadline are retired.
//   - The hour the ask prints is the hour stored in proposed_time, so a tap on
//     "Sí" means the hour the studio read. "3pm" is 15:00.
//   - Every note outside a studio's 24 hours goes as aviso_centro_v2, falling
//     back to aviso_centro_v1 with the day in {{1}} and a real HH:MM in {{2}};
//     with no HH:MM it is not sent and Jordan gets the note to send by hand.
//   - Stand-downs name the client, the day and the hour this studio was asked,
//     never the winner's. Chase B never tells the winner another centre took
//     it. Notes stop outside 09:00-21:00; a stand-down that could not go out
//     leaves the row open so chase B tells the studio later. Email-only
//     studios hear about a change too, and Jordan gets a copy of every email.
// v49 (31 Oct, Jordan: "rest a business after 5 asks with no yes, or after it
//   says no; you bring it back after talking to it. Ask at most the 4 nearest
//   that answer."). Of 210 asks since 1 Sept, 23% got a yes. Calma, TornaSol,
//   Sinergia38 and Selvarrosa said yes to 42% of theirs; KamAI, Samsara,
//   Masajes Chamberí, FISIOBARICA and The Organic Spa took 64 asks between
//   them for 2. KamAI had no yes in 21 and was still asked on 29 Oct, and
//   Masajes Chamberí was asked 13 more times after writing "No me interesa".
//   The only resting rule was v37's (three asks, never a reply), and an
//   auto-reply or a "no" is a reply, so none of them ever rested. A request
//   went to 6.2 studios on average, and once to 17.
//   - A studio rests when its last 5 asks hold no yes, or when it has written
//     us a clear opt-out ("No me interesa", "Baja", "no nos escribáis más")
//     and has not said yes since. A "No podemos", an auto-reply or any other
//     reply is not a yes. An ask does not count yet while it is under two
//     hours old and pending, nor when the studio never answered it because
//     another studio said yes within two hours (the request was gone before
//     it had its chance). v37's rule is part of the same check (restInfo).
//   - Only eligible studios are asked (plan N2): a yes on record, or brought
//     back by Jordan after he has talked to it. Its partner id in app_secrets
//     DISPATCH_UNREST (comma separated) is never rested; "id@2026-11-03"
//     instead gives it a fresh window from that day, so it can rest again.
//   - At most the first 4 eligible, in the usual order (distance and score,
//     or a price hunt's price), and never more than 4 asks on one request:
//     a second wave only fills places the first could not, two at most.
//   - When nobody is eligible, nobody is asked (no_candidates, with who was
//     resting and why), and wa-bot tells the customer so.
//   - A list someone chose (the customer's pick in wa-bot, or Jordan's own)
//     skips only opt-outs and closed hours: wa-bot has already told the
//     customer that studio is being asked. Jordan is emailed the picks that
//     were asked although resting.
//   - Right before the asks go out the request is read again. A stage that is
//     no longer open, or a customer who has written "cancel" or "anular"
//     since the request was made, stops the dispatch and stage_note says why.
//     Fahad (#121, 29 Oct) wrote "cancel" and four studios were asked five
//     minutes later.
//   - A read that fails stops the dispatch and hands the request back to the
//     sweep, rather than guessing who is resting.
//   - dry_run lists skippedResting and skippedNoYes, with the reasons.
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
//  - A studio that opted out (partners.opted_out_at, or in its own words) is
//    never asked; one with 5 asks and no yes rests until Jordan brings it back.
//  - Only studios with a yes on record, or brought back by Jordan, are asked.
//  - At most 4 studios per request, whatever the waves.

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
let OPS_KEY = Deno.env.get("OPS_KEY") || "";
let STUDIO_OUTREACH_PAUSED = false;
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const SUPPORT = ["support@massageclub.io"];
let RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

let WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
let PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || "1270437552818077";
let GRAPH = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;

// How many studios one request goes out to. Raising this raises how many
// businesses we message per customer, so change it deliberately.
//
// v29 (Jordan, 19 Sept): four, then widen. In 45 days we sent 151 asks and won
// 6 bookings, 25 asks per booking, and the recent requests went to eight or
// nine studios each. Calma had been asked 15 times and won nothing, Masajes
// Chamberí 12 times and had stopped replying, and Centro Aloha said out loud
// what the rest were thinking: "No me fío de vosotros". There are about ten
// studios answering us at all, so every fan-out spends nine relationships on
// one customer who has not committed to anything yet. Four go out first and the
// rest only if those four go quiet, which is what WIDEN_AFTER_MS is for.
const DEFAULT_FANOUT = 4;
// v22 (8 Sept): a same-day request used to go to nine studios. Across 83 asks
// only 35% of studios replied at all and the average reply took six and a half
// hours, so five bought roughly 1.7 answers by the next morning, no use to
// someone who wants a massage this afternoon: Sharo J asked at 15:17, five were
// asked, and not one could take her.
// v29: the answer to that is the second wave twenty minutes later, not nine
// messages at once. A same-day request starts at four like everything else and
// widens first, because it is the one most likely to still be unanswered.
const SAMEDAY_FANOUT = 4;
// v29: how long the first four get before the rest are asked. Jordan set this.
const WIDEN_AFTER_MS = 20 * 60 * 1000;
// How many the second wave adds.
// v49 (Jordan, 31 Oct: "Ask at most the 4 nearest that answer"): two, and
// only eligible studios. It was six, so a request that went quiet reached ten
// studios, most of which had never said yes to anyone.
const WIDEN_FANOUT = 2;
// v49: hard ceilings whatever the caller asks for. body.fanout used to go up
// to 10, and one request reached 17 studios across its waves. Four on the
// whole request is the approved rule (plan N2: "ask at most the 4 nearest
// eligible studios"), so a second wave only fills places the first left
// empty.
const MAX_WAVE = 4;
const MAX_ASKS_PER_REQUEST = 4;

const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

const JORDAN_NUMBERS = ["15622355063", "34612474827", "34613977900"];
const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu", "longyi_elon@outlook.com", "geromin.nepomuceno@student.ie.edu", "ritiktulsyan674@gmail.com", "sarfrazsingh@gmail.com", "guest@massageclub.io"];
const TEST_DOMAINS = ["testing.com", "example.com", "test.com", "placeholder.local", "mailinator.com", "example.org"];
// Jordan's own number counts as a test customer too: his bookings must never
// reach a real studio, even though the same number is a safe destination.
const TEST_PHONES = ["15622355063", "17867276503", "34612474827", "34635569364", "34662680781"];

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
  // v41 (12 Oct): the fake 3460000xxxx numbers wa-bot's canary tests run on.
  // They were missing here, so a canary that reached finalizeBooking without
  // "prueba" in the name would have asked real studios. Its test studios are
  // reached through injected request_dispatch rows (ops studio_offer) instead.
  if (/^3460000\d{4}$/.test(d)) return true;
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
// v48: every name reads after "un masaje", so the ones that are not a kind of
// massage carry their own preposition ("un masaje de reflexología", not "un
// masaje reflexología"), and Swedish is Spanish too.
const SVC_ES: Array<[RegExp, string]> = [
  [/deep tissue|descontract/i, "Masaje descontracturante"], [/thai|tailand/i, "Masaje tailandés"],
  [/hot stone|piedras/i, "Masaje de piedras calientes"], [/sport|deportiv/i, "Masaje deportivo"],
  [/balin/i, "Masaje balinés"], [/shiatsu/i, "Masaje shiatsu"], [/reflexolog/i, "Masaje de reflexología"],
  [/lymphatic|linf/i, "Masaje de drenaje linfático"], [/couples|pareja/i, "Masaje en pareja"],
  [/kobido|facial/i, "Masaje facial Kobido"], [/prenatal|embaraz/i, "Masaje prenatal"],
  [/head|scalp|cabeza/i, "Masaje de cabeza"], [/foot|feet|pies/i, "Masaje de pies"],
  [/four hands|cuatro manos/i, "Masaje a cuatro manos"], [/gua sha/i, "Masaje con gua sha"],
  [/swedish|sueco/i, "Masaje sueco"],
  [/relax|relaj|not sure|^massage$|massage treatment|^masaje$/i, "Masaje relajante"],
];
// v25 (16 Sept): solicitud_reserva_v3 reads "tengo un cliente para un masaje
// {{1}}", so the parameter must NOT begin with "masaje" or the studio reads
// "un masaje masaje balinés". Nine studios got exactly that on 15 September,
// and it was their first impression of Massage Club that day.
// v48: a name we cannot map is never pasted in raw ("un masaje swedish"): the
// studio reads "un masaje de 60 min".
const svcParam = (name: unknown, mins: number, gender: string): string => {
  const hit = svcMatch(name);
  const base = hit ? hit.toLowerCase().replace(/^masaje\b\s*/, "") : "";
  return `${base ? base + " " : ""}de ${mins} min${gender}`;
};
function svcMatch(name: unknown): string | null {
  const s = String(name || "").trim();
  for (const [re, v] of SVC_ES) if (re.test(s)) return v;
  return null;
}
// Jordan's own summaries keep the raw name when it is not in the list.
function svcEs(name: unknown): string {
  const s = String(name || "").trim();
  return svcMatch(s) || (s ? `Masaje ${s.toLowerCase()}` : "Masaje relajante");
}
// v48: the service as a studio reads it in a sentence, with its article:
// "un masaje deportivo de 60 min", "una sesión de reflexología de 60 min".
const SVC_FRASE: Array<[RegExp, string]> = [
  [/deep tissue|descontract/i, "un masaje descontracturante"], [/thai|tailand/i, "un masaje tailandés"],
  [/hot stone|piedras/i, "un masaje con piedras calientes"], [/sport|deportiv/i, "un masaje deportivo"],
  [/balin/i, "un masaje balinés"], [/shiatsu/i, "un masaje shiatsu"], [/reflexolog/i, "una sesión de reflexología"],
  [/lymphatic|linf/i, "un drenaje linfático"], [/couples|pareja/i, "un masaje en pareja"],
  [/kobido|facial/i, "un masaje facial Kobido"], [/prenatal|embaraz/i, "un masaje prenatal"],
  [/head|scalp|cabeza/i, "un masaje de cabeza"], [/foot|feet|pies/i, "un masaje de pies"],
  [/four hands|cuatro manos/i, "un masaje a cuatro manos"], [/gua sha/i, "una sesión de gua sha"],
  [/swedish|sueco/i, "un masaje sueco"],
  [/relax|relaj|not sure|^massage$|massage treatment|^masaje$/i, "un masaje relajante"],
];
// The studio's own service (service_by_partner), as Jordan typed it:
// "masaje tailandés con presión firme" -> "un masaje tailandés de 60 min con
// presión firme". The duration is added only when the text has no number.
function ownServicio(own: string, mins: number): string {
  let s = String(own || "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  if (!s) return "";
  if (!/^(un|una)\s/i.test(s)) s = (/^masaje\b/i.test(s) ? "un " : "un masaje ") + s;
  s = s.charAt(0).toLowerCase() + s.slice(1);
  if (/\d/.test(s)) return s;
  const m = s.match(/^((?:un|una)\s+masaje\s+\S+)(\s+(?:con|en|a|para|sin)\s.*)?$/i);
  if (m) return `${m[1]} de ${mins} min${m[2] || ""}`;
  return /\s(con|en|para|sin)\s/i.test(s) ? `${s}, de ${mins} min` : `${s} de ${mins} min`;
}
function servicioFrase(r: Record<string, unknown>, own = ""): string {
  const mins = reqDuration(r);
  if (String(own || "").trim()) return ownServicio(own, mins);
  const s = String(r.service_name || "").trim();
  let base = "un masaje";
  for (const [re, v] of SVC_FRASE) if (re.test(s)) { base = v; break; }
  return `${base} de ${mins} min`;
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

// v49: a setting Jordan can change without a deploy, read the way wa-bot's
// appSecret reads it: an Edge Function secret wins, else public.app_secrets.
// Missing is "". Unreadable is null, so the caller can tell "Jordan has not
// set it" from "we could not see what he set".
async function appSecret(key: string): Promise<string | null> {
  const env = Deno.env.get(key);
  if (env) return env.trim();
  try {
    const rows = await sq(`app_secrets?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
    if (!Array.isArray(rows)) return null;
    return rows[0]?.value ? String(rows[0].value).trim() : "";
  } catch { return null; }
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

// v46 (Jordan, 15 Oct: "dont' send anything to brandon"). Customers held for
// Jordan get no automatic text from here either (second-wave notes, stale and
// too-late notes, customer_text).
const HOLD_CUSTOMERS = new Set(["15102901422"]);
async function sendText(to: string, body: string) {
  if (HOLD_CUSTOMERS.has(String(to || "").replace(/[^0-9]/g, ""))) { console.log("[dispatch] held customer, not sent", to); return false; }
  const res = await fetch(GRAPH, {
    method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: false } }),
  });
  if (res.ok) {
    await logMsg(to, body, "text");
    const studio = await studioNameFor(to);
    if (studio) await studioCopy(to, studio, body);
  } else console.log("[dispatch] text send failed", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

// v47 (Jordan, 16 Oct: "i want to get emails of the messages sent to
// studios, every single one"). Each message a studio gets from here reaches
// Jordan as its own card, built by wa-bot so it looks like every other studio
// copy: the exact Spanish, the English under it, and the button to answer
// that studio as the bot. Replaces the v45 one-email-per-dispatch round-up.
// v48: emails to studios get a copy too (channel "Email", with the subject).
async function studioCopy(wa: string, studio: string, text: string, channel: "WhatsApp" | "Email" = "WhatsApp", subject?: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/wa-bot`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops: "studio_copy", key: OPS_KEY, phone: digits(wa), studio, text, channel, ...(subject ? { subject } : {}) }),
    });
    if (!r.ok) console.log("[dispatch] studio copy failed", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) { console.log("[dispatch] studio copy failed", String(e)); return false; }
}

// v45 (Jordan, 15 Oct: "so i can click on the messages like the customers,
// this needs to be standard"). Every studio ask reaches Jordan as a card: the
// exact message each studio read, its English, and a "Reply to <studio> as the
// bot" button that opens that studio's chat on the founder reply page (the
// same page and signature wa-bot's customer cards use).
const REPLY_BASE = "https://your-massage-pass-o5fo.vercel.app/bot.html";
const FOUNDER_TO = ["jordan@massageclub.io"];
async function replyUrl(phone: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(OPS_KEY + ":bot-reply"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const d = String(phone || "").replace(/[^0-9]/g, "");
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(d)));
  return `${REPLY_BASE}?reply=${d}&sig=${[...mac.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
const escH = (t: string) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function studioMessagesEmail(rows: Array<Record<string, any>>, subject: string, fallbackLines: string[]) {
  try {
    const blocks: string[] = [];
    const plain: string[] = [];
    for (const x of rows) {
      blocks.push(`<tr><td style="padding:18px 30px 0;"><p style="margin:0;color:#262019;font-size:15px;font-weight:700;">#${x.requestId} · ${escH(x.name || "Cliente")} · ${escH(x.service || "")} · ${escH(x.when || "")}${x.area ? " · " + escH(x.area) : ""}</p></td></tr>`);
      plain.push(`#${x.requestId} ${x.name || ""} ${x.service || ""} ${x.when || ""}`);
      for (const m of (x.messages || []) as Array<{ name: string; wa: string; text: string }>) {
        const url = await replyUrl(m.wa);
        const bm = /^([\s\S]*?)\s*\[([^\[\]]*\/[^\[\]]*)\]$/.exec(m.text || "");
        const body = bm ? bm[1] : (m.text || "");
        const btns = bm ? bm[2].split("/").map((b) => `<span style="display:inline-block;margin:6px 4px 0 0;font-size:12px;font-weight:600;color:#B85C38;border:1px solid #E4D9CB;border-radius:999px;padding:3px 9px;">${escH(b.trim())}</span>`).join("") : "";
        blocks.push(`<tr><td style="padding:12px 30px 0;"><p style="margin:0;color:#B85C38;font-size:11px;font-weight:700;letter-spacing:2px;">${escH(m.name).toUpperCase()} · +${escH(m.wa)}</p><div style="margin-top:6px;background:#FAF6F0;border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.55;color:#262019;white-space:pre-wrap;">${escH(body)}<br>${btns}</div><p style="margin:10px 0 0;"><a href="${url}" style="display:inline-block;background:#1FA855;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:999px;">Reply to ${escH(m.name)} as the bot</a></p></td></tr>`);
        plain.push(`\n${m.name} (+${m.wa}):\n${m.text}\nReply to ${m.name} as the bot: ${url}`);
      }
    }
    const inbox = `${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&request=${rows[0]?.requestId ?? ""}`;
    const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1EBE2;padding:30px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;border:1px solid #F0E9E0;overflow:hidden;"><tr><td style="padding:24px 30px 0;text-align:center;"><p style="margin:0;color:#262019;font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p><p style="margin:12px 0 0;"><span style="display:inline-block;background:#FAF6F0;color:#B85C38;font-size:11px;font-weight:700;letter-spacing:2.5px;padding:7px 16px;border-radius:999px;">SENT TO STUDIOS</span></p><h1 style="margin:12px 0 0;color:#262019;font-size:21px;font-family:Georgia,'Times New Roman',serif;">${escH(subject)}</h1><p style="margin:6px 0 0;color:#8A7F73;font-size:12.5px;">Exactly what each studio read. Their replies come to you the same way.</p></td></tr>${blocks.join("")}<tr><td style="padding:20px 30px 24px;text-align:center;"><a href="${inbox}" style="color:#B85C38;font-size:13px;font-weight:700;text-decoration:none;">All studios on this request</a></td></tr></table></td></tr></table>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: FOUNDER_TO, subject, html, text: plain.join("\n") }),
    });
    if (!r.ok) await founderEmail(subject, fallbackLines);
  } catch (_e) { await founderEmail(subject, fallbackLines); }
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

// v34 (Jordan, 20 Sept): "start doing abcdefg testing and let's see what flow
// books more customers", and on the studio side too. This is the first studio
// experiment and it targets the number that actually loses us bookings: a
// studio takes 297 minutes on average to answer, and roughly one ask in five
// gets a reply inside the hour. Everything else we could tune is downstream of
// that wait.
//
// S1a is the ask exactly as it was. S1b adds one line: when the client decides,
// and what saying yes early gets them. Assigned per ask rather than per studio,
// so one centre having a slow week cannot decide the result, and read on a
// single metric: did they reply within 60 minutes.
// v48: S1b is retired. Its deadline was the send time plus two hours, not
// anything the customer said, and "si nos decís que sí antes, es vuestro"
// promised the booking for an early yes, against the best-offer rule and
// BOTH PARTIES TAP. It only ever reached the legacy template anyway. Every
// ask is S1a; the arm column stays for history.
const pickArm = () => "S1a";

// v6: the honest leverage, in the ask itself. Several studios really are asked,
// and the client really does go with the best offer.
// v48: one sentence everywhere, and only when it is true: two or more studios
// asked about this request. A studio the customer picked hears that instead.
// The 10% Massage Club rate is asked on every ask (solicitud_reserva_v7 and
// solicitud_intro_v2 carry it as fixed text).
const SEVERAL_LINE = "Estoy preguntando a varios centros y se queda con la mejor oferta.";
const CHOSEN_LINE = "Os ha elegido a vosotros.";
// One studio from the ranking, nobody chose it: say only what is true.
const ONLY_LINE = "De momento solo os lo pregunto a vosotros.";

// v30 (Jordan, 19 Sept): "just a button for yes or no. Something simple."
// A studio cannot answer yes or no to "por la tarde-noche (18:00-21:00)", so a
// tap on "Sí, tengo hueco" was never a bookable answer and we had to write back
// and ask them to type a time. That second round trip is where most of them go
// quiet. Every ask now carries one concrete hour, so the three template buttons
// mean exactly what they say. We take the start of the band because it is the
// slot most likely to be free and the least presumptuous; "Otra hora" is right
// there for a studio that wants a different one. The customer's own time1 is
// never overwritten, so nothing downstream loses what they actually asked for.
const BANDS: Array<[RegExp, string]> = [
  [/morning|ma[nñ]ana/i, "10:00"],
  [/afternoon|tarde-noche|tarde\s*-\s*noche/i, ""],
  [/evening|night|noche/i, "18:00"],
  [/afternoon|tarde/i, "16:00"],
];
function concreteTime(t: unknown): string {
  const s = String(t || "").trim();
  if (!s) return "";
  // v48: "3pm", "3:00 pm" and "around 4pm" are afternoon hours. "3:00 pm" used
  // to become 03:00 (the bug copy.ts fixed) and "3pm" no hour at all, so the
  // studio read "a las around 4pm".
  const ampm = s.match(/\b(1[0-2]|0?[1-9])(?:[:.]([0-5]\d))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10) % 12;
    if (/^p/i.test(ampm[3])) h += 12;
    return `${String(h).padStart(2, "0")}:${ampm[2] || "00"}`;
  }
  // An exact time the customer typed is already concrete.
  const exact = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (exact) return `${exact[1].padStart(2, "0")}:${exact[2]}`;
  // "Evening (18-21)" and "(13-18)" carry their own start hour; trust it.
  const range = s.match(/\((\d{1,2})\s*-\s*\d{1,2}\)/);
  if (range) return `${range[1].padStart(2, "0")}:00`;
  for (const [re, hh] of BANDS) if (hh && re.test(s)) return hh;
  return "";
}

// v12 (6 Sept): the studio reads the day with its date. "Mañana" tapped at 1am
// meant Sunday to the customer and Monday to every studio (request #55).
// v48 (16 Oct): one way of saying the day everywhere a studio reads it, from
// the calendar date the customer asked for (requestDate): "el lunes 19 de
// octubre", "hoy" or "mañana". The old label put "hoy, lunes 19 de octubre"
// after "lo quiere el" ("lo quiere el hoy, ..."), passed "Any day (flexible)"
// through in English, and translated free text word by word ("el lunes
// relaxation"). A day we cannot read is left out instead.
const ES_FECHA = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const fechaEs = (d: Date) => ES_FECHA.format(d).replace(",", "").toLowerCase();
const daysFromToday = (d: Date) => Math.round((d.getTime() - madridToday().getTime()) / 864e5);
function diaFrase(r: Record<string, unknown>): string {
  const d = requestDate(r);
  if (!d) return "";
  const n = daysFromToday(d);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  return `el ${fechaEs(d)}`;
}
// Emails always carry the full date, whatever day it is.
function diaCompleto(r: Record<string, unknown>): string {
  const d = requestDate(r);
  return d ? `el ${fechaEs(d)}` : "";
}
// "el lunes 19 de octubre" -> "del lunes 19 de octubre", "hoy" -> "de hoy".
const deDia = (d: string) => !d ? "" : d.startsWith("el ") ? `del ${d.slice(3)}` : `de ${d}`;
const capFirst = (t: string) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
// v48: the client's first name as a studio reads it, or "" when there is none.
// wa-bot stores "WhatsApp customer" when it has no name, and that English
// never reaches a studio ("El cliente se llama WhatsApp customer").
const nombreDe = (r: Record<string, unknown>): string => {
  const f = String(r.first_name || "").replace(/\s+/g, " ").trim();
  return !f || /^(whatsapp( customer)?|cliente|client|customer|guest|-)$/i.test(f) ? "" : capFirst(f);
};
// A clock time as the studio reads it ("09:30"), or "" when it is not one.
const clockOf = (t: unknown) => {
  const m = String(t || "").trim().match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
};
// v48: the hour this request was put to the studios: the one stored in
// proposed_time, or the customer's own time made concrete (dispatchOne stores
// exactly that). The ask prints it and wa-bot reads a tap on "Sí" as a yes to
// it, so what the studio read and what its tap means can never disagree.
const horaPedida = (r: Record<string, unknown>) => clockOf(r.proposed_time) || concreteTime(r.time1);
// The end of the customer's band, for "le va bien cualquier hora hasta las
// 18:00". Evening is tested before afternoon, so "tarde-noche" ends at 21:00
// (whenEs tested afternoon first and sent 13:00-18:00 for it).
function finFranja(time1: unknown): string {
  const t = String(time1 || "").toLowerCase();
  const range = t.match(/\(\s*\d{1,2}\s*-\s*(\d{1,2})\s*\)/);
  if (range) return `${range[1].padStart(2, "0")}:00`;
  if (/noche|evening|night/.test(t)) return "21:00";
  if (/tarde|afternoon/.test(t)) return "18:00";
  if (/ma[nñ]ana|morning/.test(t)) return "13:00";
  return "";
}
// The band in words, for a note with no hour at all: "por la tarde".
function franjaEs(time1: unknown): string {
  const t = String(time1 || "").toLowerCase();
  if (/noche|evening|night/.test(t)) return "por la tarde-noche";
  if (/tarde|afternoon/.test(t)) return "por la tarde";
  if (/ma[nñ]ana|morning/.test(t)) return "por la mañana";
  return "";
}
// The day and hour this studio was asked about, after a noun: "del lunes 19 de
// octubre a las 13:00", "de hoy a las 17:00", "del lunes 19 de octubre por la
// tarde". `hour` is the hour this studio read or offered, never the winner's.
function refEs(rq: Record<string, unknown>, hour: string): string {
  return [deDia(diaFrase(rq)), hour ? `a las ${hour}` : franjaEs(rq.time1)].filter(Boolean).join(" ");
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
// v37 (Jordan, 25 Sept): "just be smart when sending out studios."
//
// Andres finished his booking at 19:51 tonight asking for the 18-21 band. Nine
// minutes of that band were left, and a massage needs an hour, so there was no
// slot for anyone to say yes to. Asking four studios to fill it spends goodwill
// on something none of them could have done, and an ask like that is how a
// studio learns to stop reading us. Centro Aloha left over two of these.
//
// Only today can be too late. LEAD_MINUTES is the notice a studio needs plus
// the time it takes the customer to get there.
const LEAD_MINUTES = 45;
const MASSAGE_MINUTES = 60;
function madridNowMinutes(): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour12: false, hour: "2-digit", minute: "2-digit" }).formatToParts(new Date());
  const g = (k: string) => Number(p.find((x) => x.type === k)?.value || 0);
  return (g("hour") % 24) * 60 + g("minute");
}
function tooLateReason(r: Record<string, unknown>): string | null {
  const d = requestDate(r);
  if (!d || d.getTime() !== madridToday().getTime()) return null;
  const t = String(r.time1 || "");
  const range = t.match(/\((\d{1,2})\s*-\s*(\d{1,2})\)/);
  const exact = concreteTime(t);
  // The last minute a massage could still start and finish inside what they asked for.
  const endMin = range ? parseInt(range[2], 10) * 60 : (exact ? parseInt(exact.slice(0, 2), 10) * 60 + parseInt(exact.slice(3), 10) + MASSAGE_MINUTES : 0);
  if (!endMin) return null;
  const lastStart = endMin - MASSAGE_MINUTES;
  const now = madridNowMinutes();
  if (now + LEAD_MINUTES <= lastStart) return null;
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `asked for ${t || "today"}, last possible start ${hhmm(lastStart)}, it is ${hhmm(now)} in Madrid`;
}

// v37: a studio asked three times that has never once written back is not a
// candidate, it is a number we are burning, and every silent template costs a
// little of the WhatsApp quality rating the whole account runs on.
const SILENT_LIMIT = 3;

// v49 (Jordan, 31 Oct): "rest a business after 5 asks with no yes, or after it
// says no; you bring it back after talking to it." v37 rested nobody who
// mattered: KamAI's auto-reply and Masajes Chamberí's "No me interesa" were
// both replies. What a studio does with our asks is the measure now, and the
// v37 rule is one more reason inside the same check. Everything from here to
// blockedReason is pure, so it can be tested without a database.
const REST_AFTER_ASKS = 5;
// An ask this young that is still pending has not had its chance yet.
const REST_YOUNG_MS = 2 * 3600e3;
// A yes is stamped a second or two after the message that carried it.
const SAME_MESSAGE_MS = 60e3;
type AskRow = Record<string, unknown>;
const tsOf = (v: unknown) => Date.parse(String(v || "")) || 0;
// The studio's yes on one ask: it tapped Sí, offered an hour (the one asked or
// another), named a price, or won the booking. A "No podemos", an auto-reply
// or any other reply is not a yes. Outcome "no" with an offered hour is the
// customer turning the studio's offer down, which was still the studio's yes,
// and customer_answer is only ever written on an offer.
// v49 review: an hour read into offered_times alone is a yes too. Centro
// Aloha (#84) wrote "Son 60e la hora a las 18.15h, ya con descuento" and only
// offered_times was filled.
function studioSaidYes(x: AskRow): boolean {
  const has = (v: unknown) => v !== null && v !== undefined && String(v) !== "";
  return has(x.accepted_at) || has(x.offered_time) || (Array.isArray(x.offered_times) && x.offered_times.length > 0)
    || has(x.quoted_price) || has(x.customer_answer) || ["accepted", "won"].includes(String(x.outcome || ""));
}
// An ask that reached the studio. A send_failed row never did; an offer email
// (channel email) has no sent_at but did.
const reachedStudio = (x: AskRow) => !!(x.sent_at || x.replied_at || x.accepted_at || x.offered_time);
const askAt = (x: AskRow) => tsOf(x.sent_at || x.created_at);
// When the yes on an ask was given: the tap or the offered hour, else the
// reply that carried a price or a win.
function yesTimes(x: AskRow): number[] {
  const t = [tsOf(x.accepted_at), tsOf(x.offered_at)].filter(Boolean);
  return t.length ? t : [tsOf(x.replied_at) || askAt(x)];
}
// v49 review: an ask another studio answered first. Selvarrosa was stood down
// 3 minutes after its ask on #89 and 1 minute after on #91 because another
// studio had said yes; Sinergia38 1 and 2 minutes after on #91 and #96. That
// is not a studio ignoring us, and it was the only reason both rested. Each
// ask gets _covered: the first yes from another studio on the same request at
// or after the ask went out. others: any rows on those requests (the yes
// rows are picked out here).
function coverAsks(rows: AskRow[], others: AskRow[]): AskRow[] {
  const yesBy = new Map<string, Array<{ pid: string; at: number }>>();
  for (const o of others) {
    if (!studioSaidYes(o)) continue;
    const k = String(o.request_id);
    if (!yesBy.has(k)) yesBy.set(k, []);
    yesBy.get(k)!.push({ pid: String(o.partner_id), at: Math.min(...yesTimes(o)) });
  }
  return rows.map((x) => {
    const at = askAt(x);
    const t = (yesBy.get(String(x.request_id)) || [])
      .filter((y) => y.pid !== String(x.partner_id) && y.at >= at).map((y) => y.at);
    return t.length ? { ...x, _covered: Math.min(...t) } : x;
  });
}
// How one ask ended, in the reason Jordan reads.
function askEnding(x: AskRow): string {
  if (studioSaidYes(x)) return "yes";
  if (["declined", "no"].includes(String(x.outcome || ""))) return "declined";
  return x.replied_at ? "replied without a yes" : "no reply";
}
// A clear "stop writing to us", in the studio's own words. "Baja" counts only
// as the whole message ("Baja .\n\nGracias" too) or as "dar(nos) de baja" /
// "quiero la baja": a masajista "de baja" is on leave, and "bajamos el precio"
// is an offer. The real ones so far: Masajes Chamberí "No me interesa.
// Gracias" (5 Sept), Masajes Camino "Baja .\n\nGracias" (6 Sept), Oasis Hammam
// "BAJA" (8 Sept), Centro Aloha "No me interesa seguir con vosotros" (21
// Sept), Meissa "no se molesten en escribirnos" (3 Sept).
// v49 review: "No nos mandes más", "No nos envíen más" and "no me contactes
// más" match too.
const OPT_OUT_RE = /\bno (?:me|nos) interesa|\bno estamos interesad|\bda[rd](?:nos|me|le)? de baja\b|\b(?:quiero|queremos|solicito|solicitamos|pido|pedimos) (?:la )?baja\b|^\W*baja\b(?:[\s,.!]*(?:por favor|gracias|please))*\W*$|^\W*stop\W*$|\bno (?:nos |me )?(?:escrib|contact|mand|envi|enví)(?:as|es|áis|ais|éis|eis|an|en)\b(?: \S+)? m[aá]s\b|\bno (?:se molesten|os molest[eé]is) en escribir|\bdej(?:ad|en|a) de (?:escribir|contactar|mandar|enviar)/i;
// The words that matched, with a little around them so Jordan can judge them.
function optOutWords(inbound: unknown[]): string | null {
  for (const b of inbound) {
    const t = String(b || "").replace(/\s+/g, " ").trim();
    const m = t ? OPT_OUT_RE.exec(t) : null;
    if (!m) continue;
    if (t.length <= 80) return t;
    // About 25 characters either side, widened to whole words.
    const a0 = Math.max(0, m.index - 25), z0 = Math.min(t.length, m.index + m[0].length + 25);
    const a = a0 > 0 ? t.lastIndexOf(" ", a0) + 1 : 0;
    const z = z0 < t.length && t.indexOf(" ", z0) >= 0 ? t.indexOf(" ", z0) : t.length;
    return `${a > 0 ? "..." : ""}${t.slice(a, z).trim()}${z < t.length ? "..." : ""}`;
  }
  return null;
}
// Jordan's DISPATCH_UNREST: partner ids, comma separated (spaces and new lines
// are forgiven). A bare id is brought back for good. v49 review: "id@YYYY-MM-DD"
// brings it back from that day, with a fresh window: only asks and messages
// from then count, so a studio that goes quiet again rests again. A bare id
// could never rest again, which is how KamAI reached 21 asks without a yes.
// The day starts at UTC midnight, an hour or two before Madrid's; nothing is
// sent at night anyway. A date that cannot be read counts as a bare id.
function parseUnrest(raw: unknown): Map<string, true | number> {
  const out = new Map<string, true | number>();
  for (const part of String(raw || "").split(/[\s,;]+/)) {
    const [id, day] = part.trim().toLowerCase().split("@");
    if (!id) continue;
    const since = /^\d{4}-\d{2}-\d{2}$/.test(day || "") ? Date.parse(`${day}T00:00:00Z`) : NaN;
    out.set(id, Number.isFinite(since) ? since : true);
  }
  return out;
}
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", day: "numeric", month: "short" });
// eligible: may be asked (plan N2: a yes on record, or brought back by Jordan).
type RestInfo = { resting: boolean; eligible: boolean; why: string; optOut: boolean; yesEver: boolean; unrested: boolean; last: string[] };
type InboundMsg = string | { body?: unknown; created_at?: unknown };
// One studio. rows: every request_dispatch row it has (stamped by coverAsks);
// inbound: what its number has written to us, as text or { body, created_at };
// unrest: its DISPATCH_UNREST entry (true for good, a time for "from then").
function restInfo(rows: AskRow[], inbound: InboundMsg[], unrest: boolean | number = false, now = Date.now()): RestInfo {
  const since = typeof unrest === "number" ? unrest : 0;
  const yesEver = rows.some(studioSaidYes);
  const win = since ? rows.filter((x) => askAt(x) >= since) : rows;
  const asks = win.filter(reachedStudio).sort((a, b) => askAt(b) - askAt(a));
  const counted = asks.filter((x) => {
    if (studioSaidYes(x)) return true;
    if (String(x.outcome || "") === "pending" && now - askAt(x) < REST_YOUNG_MS) return false;
    const cov = Number(x._covered) || 0;
    return !(!x.replied_at && cov && cov - askAt(x) < REST_YOUNG_MS);
  });
  const lastN = counted.slice(0, REST_AFTER_ASKS);
  const base = { optOut: false, yesEver, unrested: unrest !== false, last: lastN.map(askEnding) };
  const awake = { ...base, resting: false, eligible: yesEver || unrest !== false, why: "" };
  if (unrest === true) return awake;
  // An opt-out the studio has since gone back on with a yes is not one: "No
  // nos interesa hacer descuento, pero tenemos hueco a las 17:00" is the
  // likeliest answer to the 10% ask, and it carries its own yes.
  const yesLast = Math.max(0, ...rows.filter(studioSaidYes).map((x) => Math.max(...yesTimes(x))));
  const said = inbound.map((m) => typeof m === "string" ? { body: m, at: 0 } : { body: m?.body, at: tsOf(m?.created_at) })
    .filter((m) => !(since && m.at && m.at < since) && !(m.at && yesLast && yesLast >= m.at - SAME_MESSAGE_MS));
  const words = optOutWords(said.map((m) => m.body));
  if (words) return { ...base, resting: true, eligible: false, optOut: true, why: `wrote "${words}"` };
  if (lastN.length >= REST_AFTER_ASKS && !lastN.some(studioSaidYes)) {
    const n = new Map<string, number>();
    for (const e of base.last) n.set(e, (n.get(e) || 0) + 1);
    const from = askAt(lastN[lastN.length - 1]);
    return { ...base, resting: true, eligible: false, why: `last ${REST_AFTER_ASKS} asks with no yes${from ? ` since ${SHORT_DAY.format(new Date(from))}` : ""} (${[...n].map(([e, k]) => `${k} ${e}`).join(", ")})` };
  }
  const sent = counted.filter((x) => !!x.sent_at).length;
  if (sent >= SILENT_LIMIT && !win.some((x) => !!x.replied_at)) return { ...base, resting: true, eligible: false, why: `${sent} asks and never a reply` };
  return awake;
}
// Who is asked, in the order the candidates came in (distance and score, or a
// price hunt's price), at most cap. Only eligible studios; the others are
// reported as resting (with restInfo's reason) or as having no yes on record.
// named: a list someone chose (the customer's pick in wa-bot, or Jordan's
// own). wa-bot has already told the customer it is asking those studios, so
// only an opt-out is skipped, and askedAnyway names the picks that are resting
// or not eligible, for Jordan. v49 review: when nobody is eligible nobody is
// asked; there is no fallback to the least bad.
function planAsks<C extends { id: string }>(cands: C[], info: Map<string, RestInfo>, o: { cap: number; named?: boolean }): { ask: C[]; resting: C[]; noYes: C[]; askedAnyway: C[] } {
  const inf = (c: C) => info.get(String(c.id));
  const cap = Math.max(0, Math.floor(o.cap));
  if (o.named) {
    const ask = cands.filter((c) => !inf(c)?.optOut).slice(0, cap);
    return { ask, resting: cands.filter((c) => inf(c)?.optOut), noYes: [], askedAnyway: ask.filter((c) => !inf(c)?.eligible) };
  }
  return {
    ask: cands.filter((c) => inf(c)?.eligible).slice(0, cap),
    resting: cands.filter((c) => inf(c)?.resting),
    noYes: cands.filter((c) => !inf(c)?.resting && !inf(c)?.eligible),
    askedAnyway: [],
  };
}
// The stages a request can still be dispatched from. Everything else is over
// (confirmed, cancelled, dismissed, stale, too_late, no_show) or waiting for a
// person (needs_review). needs_contact is open: Jordan dispatches it again once
// it has an email.
const OPEN_STAGES = new Set(["new", "dispatching", "studio_asked", "studio_replied", "bidding", "offered", "needs_contact"]);
// v49 review: whole words only, as wa-bot's CANCEL_RE. Without the closing
// \b, "What is your cancellation policy?", "anulación" and "[tap: cancel_121]"
// all stopped a request until Jordan stepped in.
const CUSTOMER_CANCEL_RE = /\b(cancel|cancela|cancelar|cancelamos|cancelo|anula|anular|anulamos|anulo)\b/i;
// Why a request must not go out after all, or null. customerSaid: what the
// customer has written to us since the request was made.
function blockedReason(stage: unknown, customerSaid: unknown[], ignoreWords = false): { why: string; words: boolean } | null {
  const st = String(stage || "new");
  if (!OPEN_STAGES.has(st)) return { why: `stage is ${st}`, words: false };
  if (ignoreWords) return null;
  for (const b of customerSaid) {
    const t = String(b || "").replace(/\s+/g, " ").trim();
    if (CUSTOMER_CANCEL_RE.test(t)) return { why: `the customer wrote "${t.slice(0, 80)}"`, words: true };
  }
  return null;
}

// restInfo for each candidate, read in one go: its asks, the yeses of the
// other studios on those requests, what its number has written to us, and
// DISPATCH_UNREST. v49 review: null when any of it cannot be read. Guessing
// would be worse either way: nobody resting asks the studios that should rest,
// and nobody eligible ends the request with "no studio near you".
async function restingInfo(cands: Array<{ id: string; wa: string }>): Promise<Map<string, RestInfo> | null> {
  const out = new Map<string, RestInfo>();
  if (!cands.length) return out;
  const ids = [...new Set(cands.map((c) => String(c.id)))];
  const was = [...new Set(cands.map((c) => digits(c.wa)).filter(Boolean))];
  // order: PostgREST stops at 1000 rows whatever the limit, so the newest come first.
  const [rows, msgs, unrestRaw] = await Promise.all([
    sq(`request_dispatch?partner_id=in.(${ids.map(encodeURIComponent).join(",")})&order=created_at.desc&limit=5000&select=request_id,partner_id,outcome,sent_at,created_at,replied_at,accepted_at,offered_at,offered_time,offered_times,quoted_price,customer_answer`),
    was.length ? sq(`wa_messages?phone=in.(${was.join(",")})&direction=eq.in&order=created_at.desc&limit=5000&select=phone,body,created_at`) : Promise.resolve([]),
    appSecret("DISPATCH_UNREST"),
  ]);
  if (!Array.isArray(rows)) { console.log("[dispatch] resting: could not read asks", String(rows).slice(0, 200)); return null; }
  if (!Array.isArray(msgs)) { console.log("[dispatch] resting: could not read studio messages", String(msgs).slice(0, 200)); return null; }
  if (unrestRaw === null) { console.log("[dispatch] resting: could not read DISPATCH_UNREST"); return null; }
  const reqIds = [...new Set((rows as AskRow[]).map((x) => Number(x.request_id)).filter((n) => Number.isFinite(n) && n > 0))];
  const others = reqIds.length
    ? await sq(`request_dispatch?request_id=in.(${reqIds.join(",")})&or=(accepted_at.not.is.null,offered_time.not.is.null,offered_times.not.is.null,quoted_price.not.is.null,customer_answer.not.is.null,outcome.in.(accepted,won))&limit=5000&select=request_id,partner_id,outcome,sent_at,created_at,replied_at,accepted_at,offered_at,offered_time,offered_times,quoted_price,customer_answer`)
    : [];
  if (!Array.isArray(others)) { console.log("[dispatch] resting: could not read the other studios' answers", String(others).slice(0, 200)); return null; }
  const unrest = parseUnrest(unrestRaw);
  const byPid = new Map<string, AskRow[]>();
  for (const x of coverAsks(rows as AskRow[], others as AskRow[])) {
    const k = String(x.partner_id);
    if (!byPid.has(k)) byPid.set(k, []);
    byPid.get(k)!.push(x);
  }
  const byWa = new Map<string, InboundMsg[]>();
  for (const m of msgs as AskRow[]) {
    const k = digits(String(m.phone || ""));
    if (!byWa.has(k)) byWa.set(k, []);
    byWa.get(k)!.push({ body: m.body, created_at: m.created_at });
  }
  for (const c of cands) {
    const id = String(c.id);
    out.set(id, restInfo(byPid.get(id) || [], byWa.get(digits(c.wa)) || [], unrest.get(id.toLowerCase()) ?? false));
  }
  return out;
}

// v49: read the request again right before its asks go out. The sweep and the
// widen pick requests up a while before they reach this point, and a customer
// can cancel in between. A request that cannot be read again is not sent now
// (retry: the claim is released and the sweep tries again in 20 minutes).
async function dispatchBlocked(r: Record<string, unknown>, ignoreWords: boolean): Promise<{ why: string; words: boolean; retry?: boolean; stage?: string; note?: string } | null> {
  const fresh = await sq(`whatsapp_requests?id=eq.${Number(r.id)}&select=stage,stage_note,created_at,client_phone&limit=1`);
  const row = Array.isArray(fresh) && fresh[0] ? fresh[0] : null;
  if (!row) return { why: "the request could not be read again", words: false, retry: true };
  const phone = toWa(String(row.client_phone || r.client_phone || ""));
  const since = String(row.created_at || r.created_at || "");
  const said = phone && since && !ignoreWords
    ? await sq(`wa_messages?phone=eq.${phone}&direction=eq.in&created_at=gt.${encodeURIComponent(since)}&order=created_at.asc&limit=200&select=body`)
    : [];
  const b = blockedReason(row.stage, (Array.isArray(said) ? said : []).map((m: any) => m?.body), ignoreWords);
  return b ? { ...b, stage: String(row.stage || ""), note: String(row.stage_note || "") } : null;
}
// A line added to stage_note (500 characters at most), keeping the new line
// whole: the older text is what gets trimmed.
function appendNote(prev: unknown, add: string): string {
  const p = String(prev || "").trim();
  if (!p) return add.slice(0, 500);
  return `${p.slice(0, Math.max(0, 500 - add.length - 2))}; ${add}`.slice(0, 500);
}

// v38 (25 Sept): "Hoy" is a word, not a date. It means the day the customer
// typed it, and this read it as the day the sweep happened to run. Andres wrote
// "Hoy" on Friday evening; a sweep on Saturday morning would have asked two
// Alcala studios to hold Saturday for a booking he made about Friday, and
// Hatem's "Tomorrow" would have become Sunday. Same fault the customer copy had
// until Tuesday. Anchor to created_at, fall back to today only when there is no
// timestamp to anchor to.
function madridDayOf(iso: unknown): Date {
  const t = Date.parse(String(iso || ""));
  if (!t) return madridToday();
  const [y, m, d] = MADRID_YMD.format(new Date(t)).split("-").map((x) => parseInt(x, 10));
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
const ES_WEEKDAY = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
// v31 (Jordan, 19 Sept): "remember the rule, for example Calma is closed on
// Sunday, don't reach out to them." closedReason answers a different question:
// can this studio take the booking the customer wants. This one answers whether
// anyone is there to read us right now. A chase or a stand-down is not urgent
// enough to land on a shut studio, and Calma would have been written to on a
// Sunday morning they are closed. Unknown hours mean we say nothing either way,
// because 160 of our studios have none on file and silence is not a closure.
function closedNowReason(hoursText: unknown): string | null {
  const hours = parseHours(hoursText);
  if (!hours) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (t: string) => parts.find((x) => x.type === t)?.value || "";
  const dow = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(get("weekday").slice(0, 3).toLowerCase());
  if (dow < 0) return null;
  const slot = hours.get(dow);
  if (!slot) return `cerrado los ${ES_WEEKDAY[dow]}`;
  const now = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
  if (now < slot[0] || now >= slot[1]) return `fuera de su horario (${hm(slot[0])}-${hm(slot[1])})`;
  return null;
}

// v33 (Jordan, 19 Sept): "you should have an automatic rule, I mean this is
// common sense." Quite right. The Sunday rule lived in the dispatch path and
// nowhere else, so every new way of writing to a studio had to remember it and
// the chase sweep did not. This is the one gate every outbound studio message
// passes through, so a new feature gets the rule for free instead of having to
// know about it.
//
// The one exception is a reply. If a studio wrote to us in the last two hours
// we answer them whatever their listed hours say, because someone is plainly
// there and leaving a question hanging is worse than writing out of hours. That
// is also how a studio open later than its own opening_hours claims still gets
// a conversation: they only have to write first.
const REPLY_GRACE_MS = 2 * 3600e3;
const shutCache = new Map<string, { why: string | null; at: number }>();
// v36: is this number one of our studios? The pause has to know the difference
// between a studio and a customer, because it stops the first and not the
// second. A number we cannot resolve is treated as a studio, so the pause fails
// closed.
async function studioNameFor(toDigits: string): Promise<string | null> {
  const d = digits(toDigits);
  if (!d) return null;
  const local = d.startsWith("34") && d.length === 11 ? d.slice(2) : d;
  const rows = await sq(`partners?or=(whatsapp.ilike.*${local}*,phone.ilike.*${local}*)&select=business_name&limit=1`);
  return Array.isArray(rows) && rows[0] ? String(rows[0].business_name || "a studio") : null;
}

async function studioShutNow(toDigits: string): Promise<string | null> {
  const d = digits(toDigits);
  if (!d) return null;
  const cached = shutCache.get(d);
  if (cached && Date.now() - cached.at < 60e3) return cached.why;
  const local = d.startsWith("34") && d.length === 11 ? d.slice(2) : d;
  const rows = await sq(`partners?or=(whatsapp.ilike.*${local}*,phone.ilike.*${local}*)&select=business_name,opening_hours&limit=1`);
  const p = Array.isArray(rows) && rows[0] ? rows[0] : null;
  // Not a studio at all (a customer), or no hours on file: this gate says
  // nothing. 160 of our studios have no hours and silence is not a closure.
  let why: string | null = p ? closedNowReason(p.opening_hours) : null;
  if (why) {
    const lastIn = await sq(`wa_messages?phone=eq.${d}&direction=eq.in&order=created_at.desc&limit=1&select=created_at`);
    const t = Array.isArray(lastIn) && lastIn[0]?.created_at ? Date.parse(lastIn[0].created_at) : 0;
    if (t && Date.now() - t < REPLY_GRACE_MS) why = null; // they just wrote; answer them
  }
  shutCache.set(d, { why, at: Date.now() });
  if (why) console.log(`[dispatch] not writing to ${p?.business_name || d}: ${why}`);
  return why;
}

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

// v12: the human ask (solicitud_reserva_v2, 6 Sept). v24: solicitud_reserva_v3,
// Jordan's own wording (12 Sept): lead with the client, not with a pitch.
// v48 (16 Oct): solicitud_reserva_v7 is the ask a studio owner would write
// himself: the day and hour, the service, the client's name, and the 10%
// Massage Club rate, with "several studios" only when that is true. It is not
// signed, because it goes to studios that already know us. A studio's
// first-ever message is solicitud_intro_v2: one sentence on who we are, the
// same ask, and the signature. Until Meta approves them, the approved v3 goes
// with its blanks filled properly. v2 (the two-paragraph letter whose "lo
// cierro con vosotros" promised the booking on the studio's word) and the
// legacy solicitud_reserva ("Confirmado", "confirmamos al cliente") are never
// sent again.

// v44 (Jordan, 15 Oct, on seeing "[solicitud_reserva_v2] Brandon: masaje ... |
// Lunes ... (req #120)" in the studio chat: "never again, why does this look
// like this"). The log is what the founder inbox shows, so it must be the
// message the studio actually read: the approved body with its blanks filled,
// and its buttons in the "[A/B/C]" form the inbox draws as buttons. Bodies are
// copied verbatim from the templates as submitted to Meta (ops "templates" on
// wa-bot). Every template this file sends is here.
const TPL_BODY: Record<string, string> = {
  solicitud_reserva_v7: "Hola, ¿tenéis hueco {{1}} para {{2}}? El cliente se llama {{3}}.\n{{4}} Si podéis hacerle un 10% como cliente de Massage Club, decídmelo.",
  solicitud_intro_v2: "Hola, buenas. Somos Massage Club, un servicio de reservas de masajes en Madrid; el cliente paga directamente en el centro. ¿Tenéis hueco {{1}} para {{2}}? El cliente se llama {{3}}.\n{{4}} Si podéis hacerle un 10% como cliente de Massage Club, decídmelo.\n\nJordan, de Massage Club",
  solicitud_reserva_v3: "Hola, tengo un cliente para un masaje {{1}}. Se llama {{2}} y lo quiere el {{3}}. ¿Tenéis hueco?\nEstoy preguntando a varios centros de la zona.\n\nJordan, de Massage Club",
  aviso_centro_v2: "Hola, soy Jordan, de Massage Club. Os escribo por el masaje de {{1}}. {{2}}\n\nGracias.",
  aviso_centro_v1: "Aviso de Massage Club sobre la cita de {{1}} a las {{2}}: {{3}}. Gracias por vuestra paciencia.",
  solicitud_socio_v3: "Hola, otro cliente para vosotros: un masaje {{1}} para {{2}}, el {{3}}. ¿Tenéis hueco?",
  nota_centro_v1: "Hola, os escribimos de Massage Club sobre una reserva:\n\n{{1}}\n\nPodéis responder aquí mismo. Gracias.",
};
const TPL_BUTTONS: Record<string, string[]> = {
  solicitud_reserva_v7: ["Sí, tenemos hueco", "Otra hora", "No podemos"],
  solicitud_intro_v2: ["Sí, tenemos hueco", "Otra hora", "No podemos"],
  solicitud_reserva_v3: ["Sí, tengo hueco", "Otra hora", "No puedo"],
  solicitud_socio_v3: ["Sí, tengo hueco", "Otra hora", "No puedo"],
};
function renderedTpl(name: string, params: string[]): string {
  const body = (TPL_BODY[name] || `[${name}] ${params.join(" | ")}`).replace(/\{\{(\d+)\}\}/g, (_m, n) => params[Number(n) - 1] ?? "");
  const b = TPL_BUTTONS[name] || [];
  return b.length ? `${body} [${b.join("/")}]` : body;
}
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
// A template Meta does not have, or has not approved yet (both answer 132001,
// "does not exist in the translation"). v48: a bare "template" is no longer
// enough. A parameter mismatch mentions the template as well, and that is a
// real fault to report, not a reason to quietly send an older message.
const TPL_NOT_LIVE = /132001|does not exist|not found|not approved/i;

// v48: the blanks of solicitud_reserva_v7 and solicitud_intro_v2.
// {{1}} the day and hour: "el lunes 19 de octubre a las 13:00", "hoy a las
//   17:00", "el día que mejor os venga, a las 17:00", or the day alone.
// {{2}} the service with its article: "un masaje deportivo de 60 min".
// {{3}} the client's name and what else the studio needs to know: "Brandon y
//   le va bien cualquier hora hasta las 18:00", "Brandon, prefiere masajista
//   chico y le va bien ...".
// {{4}} SEVERAL_LINE, CHOSEN_LINE or ONLY_LINE, whichever is true.
function v7Params(r: Record<string, unknown>, own: string, line: string): string[] {
  const dia = diaFrase(r);
  const h = horaPedida(r);
  const when = dia ? `${dia}${h ? ` a las ${h}` : ""}` : `el día que mejor os venga${h ? `, a las ${h},` : ""}`;
  const end = finFranja(r.time1);
  const extras = [
    r.therapist_gender === "male" ? "prefiere masajista chico" : r.therapist_gender === "female" ? "prefiere masajista chica" : "",
    h && end && end > h ? `le va bien cualquier hora hasta las ${end}` : "",
  ].filter(Boolean);
  const name = nombreDe(r) || "Cliente";
  const who = !extras.length ? name
    : extras.length === 1 ? `${name} y ${extras[0]}`
    : `${name}, ${extras.slice(0, -1).join(", ")} y ${extras[extras.length - 1]}`;
  return [param(when, 90), param(servicioFrase(r, own), 120), param(who, 160), param(line, 120)];
}
// v48: the blanks of the approved solicitud_reserva_v3, filled so it reads
// right: "Hola, tengo un cliente para un masaje {{1}}. Se llama {{2}} y lo
// quiere el {{3}}." {{1}} never repeats "masaje" and never carries a raw
// English name; {{3}} starts with the weekday ("lo quiere el hoy" is gone),
// names the hour stored in proposed_time first, and never prints raw time1.
function v3When(r: Record<string, unknown>): string {
  const d = requestDate(r);
  const today = !!d && daysFromToday(d) === 0;
  const f = d ? fechaEs(d) : "";
  const day = !d ? "día que mejor os venga" : today ? `${f.replace(/ de \S+$/, "")}, hoy mismo` : f;
  const h = horaPedida(r);
  const end = finFranja(r.time1);
  return day + (h ? `${!d || today ? "," : ""} a las ${h}` : "") + (h && end && end > h ? `, aunque le va bien cualquier hora hasta las ${end}` : "");
}
function v3Params(r: Record<string, unknown>, own: string): string[] {
  const gender = r.therapist_gender === "male" ? ", con masajista chico si puede ser"
    : r.therapist_gender === "female" ? ", con masajista chica si puede ser" : "";
  const svc = own
    ? ownServicio(own, reqDuration(r)).replace(/^(un|una)\s+/i, "").replace(/^masaje\s+/i, "") + gender
    : svcParam(r.service_name, reqDuration(r), gender);
  return [param(svc, 120), param(nombreDe(r) || "Cliente", 40), param(v3When(r), 120)];
}

// v43 (Jordan, 15 Oct): the first message to a studio that has never heard of
// us opens with who we are. service_by_partner puts the studio's own closest
// service in the ask when it does not do what the customer named: Chalalai has
// no sports massage, so it is asked for its firm Thai massage and the
// customer's offer names that.
// v48: the intro is solicitud_intro_v2, and it goes on its own to any studio
// that has never had a message from us (dispatchOne), as well as to the
// intro_partner_ids of a manual dispatch. Price hunts get the same ask as
// everyone else; ranking by listed price stays internal. A studio that is the
// only one asked never gets v3, whose fixed "Estoy preguntando a varios
// centros" would be untrue. While v7 waits for Meta, a single studio that
// knows us gets the approved solicitud_socio_v3 ("Hola, otro cliente para
// vosotros: un masaje ... para Brandon, el lunes ... ¿Tenéis hueco?", same
// three buttons), and a single studio we have never written to gets the
// approved nota_centro_v1 carrying who we are and the same ask, with no
// buttons (a typed answer is read like any other). A request is never left
// unasked just because a template is waiting for approval.
async function askOneStudio(r: Record<string, unknown>, c: Candidate, ask: { intro?: boolean; service?: string; several?: boolean; line?: string } = {}): Promise<{ ok: boolean; error?: string; text?: string }> {
  // v36: the pause covers the template ask too, not only free text. See the
  // note in sendStudioNote.
  if (STUDIO_OUTREACH_PAUSED) {
    console.log(`[dispatch] studio outreach is PAUSED, not asking ${c.business_name}`);
    return { ok: false, error: "studio outreach paused by Jordan" };
  }
  const ownService = String(ask.service || "").trim();
  const payloads = [`studio_confirm_${r.id}`, `studio_other_${r.id}`, `studio_no_${r.id}`];
  const several = !!ask.several;
  const p7 = v7Params(r, ownService, ask.line || (several ? SEVERAL_LINE : ONLY_LINE));
  const p3 = v3Params(r, ownService);
  // In order, each tried only while Meta answers that the one before is not live.
  // A first contact prefers v3 (signed) to v7 (unsigned) while intro_v2 waits.
  const tries: Array<[string, string[]]> = [];
  if (ask.intro) tries.push(["solicitud_intro_v2", p7]);
  if (ask.intro && several) tries.push(["solicitud_reserva_v3", p3]);
  tries.push(["solicitud_reserva_v7", p7]);
  if (several && !ask.intro) tries.push(["solicitud_reserva_v3", p3]);
  if (!several && !ask.intro) tries.push(["solicitud_socio_v3", p3]);
  if (!several && ask.intro) {
    const [when, svc, who, line] = p7;
    tries.push(["nota_centro_v1", [param(`Soy Jordan, de Massage Club, un servicio de reservas de masajes en Madrid. ¿Tenéis hueco ${when} para ${svc}? El cliente se llama ${who}. ${line} Si podéis hacerle un 10% como cliente de Massage Club, decídmelo.`, 900)]]);
  }
  let last = "";
  for (const [name, ps] of tries) {
    const rs = await sendTemplate(c.wa, name, ps, name === "nota_centro_v1" ? [] : payloads);
    console.log(`[dispatch] req=${r.id} studio=${c.business_name} to=${c.wa} tpl=${name} status=${rs.status} ${rs.out.slice(0, 160)}`);
    if (rs.ok) {
      const text = renderedTpl(name, ps);
      await logMsg(c.wa, text);
      return { ok: true, text };
    }
    last = `${name} ${rs.status} ${rs.out.slice(0, 200)}`;
    if (!TPL_NOT_LIVE.test(rs.out)) return { ok: false, error: last };
  }
  return { ok: false, error: several ? `no approved ask template: ${last}` : `the only studio asked, so not v3 ("varios centros" would be untrue), and solicitud_reserva_v7 is not live yet: ${last}` };
}

// Everyone who did not win hears back. These are the same businesses we are
// trying to recruit as partners, so silence would cost us more than it saves.
// v6: studios that said yes but did not give the best offer ("accepted") are
// stood down too, with a line that thanks them for the yes.
// v20: one note to one studio. Free text inside their 24 hour window, the
// approved aviso_centro_v1 template outside it. Every message we send a studio
// goes through here, because a note that fails silently leaves a partner
// hanging: The Organic Spa and Masajes Chamberí were asked about Fernando on
// 8 September, never heard that it was covered, and the only trace was a
// delivery-failure alert nobody could act on.
//
// v48 (16 Oct): outside the window a note goes as aviso_centro_v2 ("Hola, soy
// Jordan, de Massage Club. Os escribo por el masaje de {{1}}. {{2}}\n\n
// Gracias."), and until Meta approves it as aviso_centro_v1 filled the one
// way every function fills it: {{1}} the name and day, {{2}} a real HH:MM,
// {{3}} the short with a lowercase start and no final stop. With no HH:MM, or
// a short that is a question, v1 would read "a las Afternoon (13-18)" or
// "?.", so it is not sent: Jordan gets the note to send by hand.
//
// The two closed-window forms of a note. v2 is aviso_centro_v2's {{2}}: whole
// sentences, capitalised, with their own full stop and no "gracias" (the
// template ends with one). v1 is aviso_centro_v1's {{3}}.
type NoteShort = { v2: string; v1: string };
// A caller's one-line short (notify, studio_note) in both forms.
function shortForms(short: string, rq: Record<string, unknown>): NoteShort {
  const s = String(short || "").replace(/\s+/g, " ").trim();
  const bare = s.replace(/[.\s]+$/, "");
  const name = nombreDe(rq);
  // The first letter, after any opening "¿" or "¡": "¿Os sigue encajando?".
  const lead = (t: string, up: boolean) => t.replace(/^([¿¡]*)(\p{L})/u, (_m, p: string, c: string) => p + (up ? c.toUpperCase() : c.toLowerCase()));
  const v1 = name && bare.startsWith(name) ? bare : lead(bare, false);
  // v2 has room for sentences, so "esa hora; si tenéis otra" becomes two.
  const whole = s.replace(/;\s+(\p{L})/gu, (_m, c: string) => `. ${c.toUpperCase()}`);
  return { v2: lead(/[.!?]$/.test(whole) ? whole : `${whole}.`, true), v1 };
}
// The hour a note to this studio is about: the one it offered or was told, the
// confirmed hour only when it is the studio that won, else the hour every
// studio was asked. Never raw time1, and never the winner's hour to a studio
// that did not win.
function noteHour(rq: Record<string, unknown>, row?: Record<string, unknown>): string {
  const winner = !!row && !!rq.partner_id && String(row.partner_id || "") === String(rq.partner_id);
  return clockOf(row?.offered_time) || (winner ? clockOf(rq.confirmed_time) : "") || horaPedida(rq);
}
const RQ_NOTE_COLS = "id,first_name,day1,time1,proposed_time,confirmed_time,partner_id,service_name,message_text,created_at";
async function noteSent(to: string, shown: string): Promise<{ how: string; ok: boolean }> {
  await logMsg(to, shown);
  const studio = await studioNameFor(to);
  if (studio) await studioCopy(to, studio, shown);
  return { how: "template", ok: true };
}
// v48: a note the approved template cannot carry honestly. Jordan gets it,
// with the button to send it from the founder inbox, instead of the studio
// getting "a las -".
async function holdNote(to: string, text: string, why: string): Promise<{ how: string; ok: boolean; why: string }> {
  const studio = await studioNameFor(to);
  const who = studio || `+${to}`;
  await founderEmail(`Studio note not sent to ${who}: send it by hand`, [
    `This note to <b>${escH(who)}</b> (+${escH(to)}) did not go out. Their 24 hour WhatsApp window is shut, aviso_centro_v2 is not approved yet, and aviso_centro_v1 ${escH(why)}.`,
    `The note:<br><i>${escH(text)}</i>`,
    `Reply to ${escH(who)} as the bot: ${await replyUrl(to)}`,
  ]);
  return { how: "held", ok: false, why: `${why}; Jordan was emailed the note` };
}
async function sendStudioNote(to: string, text: string, short: string | NoteShort, rq: Record<string, unknown>, dry = false, row?: Record<string, unknown>): Promise<{ how: string; ok: boolean; why?: string }> {
  if (!to) return { how: "none", ok: false };
  // v36 (Jordan, 23 Sept): "i need you stop any outreach to the studios."
  // One switch in front of every path that can write to a studio, set in the
  // deployed loader. Two days running the bot spent studio goodwill on people
  // who had not asked for a massage, and Centro Aloha left over it. Nothing
  // reaches a studio until Jordan turns this back off.
  if (STUDIO_OUTREACH_PAUSED) {
    console.log(`[dispatch] studio outreach is PAUSED, not writing to ${to}`);
    return { how: "paused", ok: false, why: "studio outreach paused by Jordan" };
  }
  // v33: the automatic rule. Everything that writes to a studio comes through
  // here or through the send op, and both refuse a studio that is shut. The
  // check runs on a dry run too, so a dry run tells the truth about who would
  // actually have been written to.
  const shut = await studioShutNow(to);
  if (shut) return { how: "skipped", ok: false, why: shut };
  const lastIn = await sq(`wa_messages?phone=eq.${to}&direction=eq.in&order=created_at.desc&limit=1&select=created_at`);
  const lastAt = Array.isArray(lastIn) && lastIn[0]?.created_at ? Date.parse(lastIn[0].created_at) : 0;
  // v48: and nothing lands on a studio at night. The won and notify ops run
  // before the request hours check, so a stand-down could reach the 160
  // studios with no hours on file at 23:00. A studio that wrote to us in the
  // last two hours is answered whatever the time (REPLY_GRACE_MS).
  if (!withinSendingHours() && !(lastAt && Date.now() - lastAt < REPLY_GRACE_MS)) {
    return { how: "skipped", ok: false, why: `outside ${OPEN_HOUR}:00-${CLOSE_HOUR}:00 Madrid` };
  }
  if (dry) return { how: "would send", ok: true };
  const openWindow = !!lastAt && (Date.now() - lastAt) < 23.5 * 3600e3;
  if (openWindow && await sendText(to, text)) return { how: "text", ok: true };
  const forms = typeof short === "string" ? shortForms(short || text, rq) : short;
  const name = nombreDe(rq) || "nuestro cliente";
  const hour = noteHour(rq, row);
  const p2 = [param([name, refEs(rq, hour)].filter(Boolean).join(" "), 120), param(forms.v2, 700)];
  const r2 = await sendTemplate(to, "aviso_centro_v2", p2, []);
  if (r2.ok) return await noteSent(to, renderedTpl("aviso_centro_v2", p2));
  if (!TPL_NOT_LIVE.test(r2.out)) {
    console.log("[dispatch] studio note template failed", r2.status, r2.out.slice(0, 200));
    return { how: "template", ok: false, why: `aviso_centro_v2 ${r2.status}` };
  }
  const v1 = forms.v1.replace(/\s+/g, " ").trim();
  if (!hour) return await holdNote(to, text, "needs a clock time and this request has none");
  if (!v1 || /\?$/.test(v1)) return await holdNote(to, text, "cannot carry a question");
  const dd = deDia(diaFrase(rq));
  const p1 = [param(`${name}${dd ? " " + dd : ""}`, 60), hour, param(v1, 300)];
  const r1 = await sendTemplate(to, "aviso_centro_v1", p1, []);
  if (r1.ok) return await noteSent(to, renderedTpl("aviso_centro_v1", p1));
  console.log("[dispatch] studio note template failed", r1.status, r1.out.slice(0, 200));
  return { how: "template", ok: false, why: `aviso_centro_v1 ${r1.status}` };
}

// v48: how an ask ended, in the words a studio reads. One sentence per ending,
// whichever path sends it (the won op, chase B, a change), naming the client,
// the day and the hour this studio was asked, never the winner's. Unsigned:
// it always follows an ask, and the studio knows who we are by now.
type Ending = "covered" | "accepted" | "cancelled" | "superseded";
// "del lunes 19 de octubre a las 13:00", or "de las 13:00" with no day.
function refDe(rq: Record<string, unknown>, hour: string): string {
  const ref = refEs(rq, hour);
  return ref.startsWith("a las ") ? `de las ${ref.slice(6)}` : ref.startsWith("por ") ? "" : ref;
}
function standDownNote(kind: Ending, rq: Record<string, unknown>, row?: Record<string, unknown>): { text: string; short: NoteShort } {
  const name = nombreDe(rq) || "nuestro cliente";
  const hour = clockOf(row?.offered_time) || horaPedida(rq);
  if (kind === "accepted") {
    const dia = diaFrase(rq);
    return {
      text: `Hola, al final ${name} se ha quedado con otra oferta${dia ? ` para ${dia}` : ""}, así que no hace falta que le guardéis ${hour ? `el hueco de las ${hour}` : "hueco"}. Gracias por decirme que sí, a la próxima.`,
      short: { v2: "Al final se ha quedado con otra oferta, así que no hace falta que le guardéis el hueco que me ofrecisteis.", v1: "al final se ha quedado con otra oferta, así que no hace falta que le guardéis el hueco que me ofrecisteis" },
    };
  }
  if (kind === "cancelled") {
    const ref = refDe(rq, hour);
    return {
      text: `Hola, al final ${name} no sigue adelante${ref ? ` con lo ${ref}` : ""}, así que no hace falta que le guardéis hueco. Perdonad las molestias y gracias.`,
      short: { v2: "Al final no sigue adelante, así que no hace falta que le guardéis hueco. Perdonad las molestias.", v1: "al final no sigue adelante, así que no hace falta que le guardéis hueco" },
    };
  }
  if (kind === "superseded") {
    const ref = refDe(rq, hour);
    return {
      text: `Hola, ${name} ha cambiado de plan y ya no necesita ${ref ? `el hueco ${ref}` : "ese hueco"}, así que no hace falta que se lo guardéis. Gracias.`,
      short: { v2: "Ha cambiado de plan y ya no necesita ese hueco, así que no hace falta que se lo guardéis.", v1: "ha cambiado de plan y ya no necesita ese hueco, así que no hace falta que se lo guardéis" },
    };
  }
  const ref = refEs(rq, hour);
  return {
    text: `Hola, lo de ${name}${ref ? ` ${ref}` : ""} ya está cubierto, así que no hace falta que le guardéis hueco. Gracias, a la próxima.`,
    short: { v2: "Ya está cubierto, así que no hace falta que le guardéis hueco.", v1: "ya está cubierto, así que no hace falta que le guardéis hueco" },
  };
}
// The same ending for a studio we only reach by email: the full date, the
// service, who we are, and the house sign-off, so it can be matched to the
// offer email it answers. The subject says the same as the body.
function standDownEmail(kind: Ending, rq: Record<string, unknown>, row: Record<string, unknown> | undefined, studio: string): { subject: string; text: string } {
  const name = nombreDe(rq) || "nuestro cliente";
  const hour = clockOf(row?.offered_time) || horaPedida(rq);
  const dia = diaCompleto(rq);
  const subject = `Ya no hace falta el hueco de ${name}${dia ? ` ${deDia(dia)}` : ""}${hour ? ` a las ${hour}` : ""}`;
  const when = [dia, hour ? `a las ${hour}` : franjaEs(rq.time1)].filter(Boolean).join(" ");
  const ending = kind === "cancelled" ? "Al final no sigue adelante, así que no hace falta que le guardéis hueco. Perdonad las molestias."
    : kind === "superseded" ? "Ha cambiado de plan y ya no necesita ese hueco, así que no hace falta que se lo guardéis. Gracias igualmente."
    : "Ya lo ha cubierto otro centro, así que no hace falta que le guardéis hueco. Gracias igualmente.";
  const text = `${studio ? `Hola, equipo de ${studio}:` : "Hola:"}\n\nSoy Jordan, de Massage Club, un servicio de reservas de masajes en Madrid. Os escribí por ${name}, que buscaba ${servicioFrase(rq)}${when ? ` ${when}` : ""}.\n\n${ending}\n\nUn saludo,\nJordan, de Massage Club`;
  return { subject, text };
}

// v42: a studio we can only reach by email, for the chase sweep's "it ended".
// v48: the email is built with the studio's name in it, and Jordan gets a copy
// like every other studio message (it used to leave no trace at all).
async function emailPartner(partnerId: string, make: (studio: string) => { subject: string; text: string }): Promise<boolean> {
  if (!partnerId || !RESEND_API_KEY) return false;
  const rows = await sq(`partners?id=eq.${encodeURIComponent(partnerId)}&select=business_name,booking_email,email&limit=1`);
  const p = (Array.isArray(rows) && rows[0] ? rows[0] : {}) as Record<string, unknown>;
  const to = String(p.booking_email || p.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false;
  const studio = String(p.business_name || "").trim();
  const { subject, text } = make(studio);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], reply_to: "support@massageclub.io", subject, text }),
  }).catch(() => null);
  const ok = !!res && res.ok;
  if (ok) await studioCopy("", studio || to, text, "Email", subject);
  return ok;
}

// v17: one note to every studio still in play on a request. Lifted out of the
// notify handler so the amendment path can stand studios down without a second call.
// v48: the note is built per studio, so it names the hour that studio was
// asked. A studio we only reach by email is emailed when the caller says how
// the ask ended (emailKind); every studio asked has to hear about a change.
// A note that went out closes the row (never the winner's), so chase B does
// not send the same studio a second, different "it ended".
async function notifyStudios(requestId: number, make: (rq: Record<string, unknown>, row: Record<string, unknown>) => { text: string; short: string | NoteShort }, onlyIds?: string[], emailKind?: Ending) {
  const reqRows = await sq(`whatsapp_requests?id=eq.${requestId}&select=${RQ_NOTE_COLS}`);
  const rq = (Array.isArray(reqRows) && reqRows[0] ? reqRows[0] : {}) as Record<string, unknown>;
  const only = Array.isArray(onlyIds) && onlyIds.length ? new Set(onlyIds.map(String)) : null;
  const rows = await sq(`request_dispatch?request_id=eq.${requestId}&outcome=in.(pending,accepted,won)&select=id,partner_id,phone,outcome,offered_time,channel`);
  const out: Array<{ phone: string; how: string; ok: boolean }> = [];
  for (const row of (Array.isArray(rows) ? rows : [])) {
    if (only && !only.has(String(row.partner_id))) continue;
    const to = String(row.phone || "");
    let r: { how: string; ok: boolean; why?: string };
    if (!to && emailKind && String(row.channel || "") === "email") {
      r = STUDIO_OUTREACH_PAUSED || !withinSendingHours()
        ? { how: "skipped", ok: false, why: STUDIO_OUTREACH_PAUSED ? "studio outreach paused by Jordan" : "outside sending hours" }
        : { how: "email", ok: await emailPartner(String(row.partner_id || ""), (studio) => standDownEmail(emailKind, rq, row, studio)) };
    } else {
      const t = make(rq, row);
      r = await sendStudioNote(to, t.text, t.short, rq, false, row);
    }
    if ((r.ok || r.how === "held") && row.outcome !== "won") {
      await sq(`request_dispatch?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ outcome: "stood_down" }) });
    }
    out.push({ phone: to, how: r.how, ok: r.ok });
  }
  return out;
}

// v31 (Jordan, 19 Sept): nothing ever chased a studio, and nothing ever told
// one how an ask ended. 66 asks were sitting at pending with no ending at all
// and 19 of those studios had written to us and got nothing back. Private Spa
// answered Al with a price and a time; Calma and Centro Aloha said yes to the
// same request at 09:09 and 09:45 and were never asked for an hour, so Al heard
// nothing all day. Two cases, each once per ask, inside studio hours:
//
//   A. They said yes and never named an hour or a price. We ask, once, naming
//      the client and the hour we put to them. This is the one that turns a
//      "sí, tengo hueco" into something a customer can actually be offered.
//   B. The request is over (someone else got it, or it was cancelled or
//      dismissed) and their row is still open. We tell them so and close it.
//      A studio that hears how it ended keeps answering; one that never hears
//      stops, which is what Masajes Chamberi and Samsara have already done.
async function chaseOpenAsks(dryRun: boolean): Promise<Record<string, unknown>> {
  const waiting: string[] = [];
  const closed: string[] = [];
  // v33: no hours check of its own. sendStudioNote refuses a shut studio and
  // says why, so this only has to report it and leave the row alone for the
  // next run that falls inside that studio's own hours.
  const skipped: string[] = [];
  const since = new Date(Date.now() - 72 * 3600e3).toISOString();
  const ripe = new Date(Date.now() - 45 * 60e3).toISOString();

  // B first: a dead request must never produce a chase for an hour.
  // v42: every open row, not only the ones never chased. A studio that said yes
  // and was then asked for its hour (A, which sets chased_at) was skipped here
  // for good, so a customer who cancelled at the offer step left it holding
  // the slot. The PATCH below closes the row, so nobody is told twice.
  const deadRows = await sq(`request_dispatch?outcome=in.(pending,accepted)&created_at=gte.${since}&order=created_at.desc&limit=40&select=id,request_id,partner_id,phone,channel,offered_time`);
  for (const d of (Array.isArray(deadRows) ? deadRows : [])) {
    const rq = (await sq(`whatsapp_requests?id=eq.${Number(d.request_id)}&select=${RQ_NOTE_COLS},stage,stage_note&limit=1`))[0];
    if (!rq || !["confirmed", "cancelled", "dismissed", "no_show"].includes(String(rq.stage || ""))) continue;
    const covered = ["confirmed", "no_show"].includes(String(rq.stage || ""));
    // v48: the studio that won is never told another centre took it. Its row
    // is open when the booking was confirmed by a path other than the won op.
    if (covered && rq.partner_id && String(d.partner_id || "") === String(rq.partner_id)) {
      if (!dryRun) await sq(`request_dispatch?id=eq.${d.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ outcome: "won" }) });
      continue;
    }
    // A request replaced by a change (v17) is "changed plans", not "not going ahead".
    const kind: Ending = covered ? "covered" : /superseded by #/.test(String(rq.stage_note || "")) ? "superseded" : "cancelled";
    const to = digits(String(d.phone || ""));
    const note = standDownNote(kind, rq, d);
    // v42: a studio with no WhatsApp that answered the offer email is told by
    // email, inside sending hours and never while outreach is paused.
    const byEmail = !to && String(d.channel || "") === "email";
    const sent = byEmail
      ? (STUDIO_OUTREACH_PAUSED || !withinSendingHours() ? { how: "skipped", ok: false, why: STUDIO_OUTREACH_PAUSED ? "studio outreach paused by Jordan" : "outside sending hours" }
        : dryRun ? { how: "would email", ok: true } : { how: "email", ok: await emailPartner(String(d.partner_id || ""), (studio) => standDownEmail(kind, rq, d, studio)) })
      : to ? await sendStudioNote(to, note.text, note.short, rq, dryRun, d) : { how: "none", ok: false, why: "no number" };
    if (sent.how === "skipped" || sent.how === "paused") { skipped.push(`#${d.request_id} ${to} ${sent.why}`); continue; }
    if (!dryRun) await sq(`request_dispatch?id=eq.${d.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ outcome: "stood_down", chased_at: new Date().toISOString() }) });
    closed.push(`#${d.request_id} ${to}`);
  }

  // A: they said yes, we never got an hour out of them.
  const yesRows = await sq(`request_dispatch?outcome=eq.accepted&offered_time=is.null&chased_at=is.null&created_at=gte.${since}&created_at=lte.${ripe}&order=created_at.desc&limit=20&select=id,request_id,partner_id,phone,quoted_price,offered_time`);
  for (const d of (Array.isArray(yesRows) ? yesRows : [])) {
    const rq = (await sq(`whatsapp_requests?id=eq.${Number(d.request_id)}&select=${RQ_NOTE_COLS},stage,client_phone&limit=1`))[0];
    if (!rq || !["new", "dispatching", "studio_asked", "studio_replied", "bidding", "offered"].includes(String(rq.stage || ""))) continue;
    if (isTestCustomer(rq)) continue;
    const to = digits(String(d.phone || ""));
    if (!to || JORDAN_NUMBERS.includes(to)) continue;
    // v48: the hour the ask printed is the hour their yes was to, so only the
    // price is asked; with no hour on the request, the hour as well. The
    // duration is the customer's, not a fixed 60. Not signed, and no promise
    // to tell the client "ahora mismo": wa-bot may hold an offer back.
    const hour = horaPedida(rq);
    const name = nombreDe(rq) || "nuestro cliente";
    const dia = diaFrase(rq);
    const mins = reqDuration(rq);
    const franja = franjaEs(rq.time1);
    const who = `${name}${dia ? " " + dia : ""}`;
    const tenPct = "Si podéis hacerle un 10% como cliente de Massage Club, decídmelo";
    const line = hour
      ? `Hola, me dijisteis que sí para ${who} a las ${hour}, gracias. ¿Qué precio final le dejaríais por ${mins} min? ${tenPct} y se lo paso.`
      : `Hola, me dijisteis que sí para ${who}${franja ? " " + franja : ""}, gracias. ¿A qué hora podéis y qué precio final le dejaríais por ${mins} min? ${tenPct} y se lo paso.`;
    const short: NoteShort = hour
      ? { v2: `Me dijisteis que sí: ¿qué precio final le dejaríais por ${mins} min? ${tenPct}.`, v1: `me dijisteis que sí y me falta el precio final por ${mins} min, con un 10% de Massage Club si podéis` }
      : { v2: `Me dijisteis que sí: ¿a qué hora podéis y qué precio final le dejaríais por ${mins} min? ${tenPct}.`, v1: `me dijisteis que sí y me faltan la hora y el precio final por ${mins} min, con un 10% de Massage Club si podéis` };
    const sent = await sendStudioNote(to, line, short, rq, dryRun, d);
    if (sent.how === "skipped") { skipped.push(`#${d.request_id} ${name} ${to} ${sent.why}`); continue; }
    if (!dryRun) await sq(`request_dispatch?id=eq.${d.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ chased_at: new Date().toISOString() }) });
    waiting.push(`#${d.request_id} ${name} ${to}`);
  }
  return { chased_for_time: waiting, told_it_ended: closed, skipped_closed: skipped };
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
  const rows = await sq(`request_dispatch?request_id=eq.${requestId}&outcome=in.(pending,accepted)&select=id,partner_id,phone,outcome,offered_time,channel`);
  if (!Array.isArray(rows) || !rows.length) return 0;
  // v20: the template fallback matters most here. A studio that was asked by
  // template and never wrote back has no open window, so the plain text this
  // used to send died at Meta and they were left waiting on an answer that
  // never came.
  const reqRows = await sq(`whatsapp_requests?id=eq.${requestId}&select=${RQ_NOTE_COLS}`);
  const rq = (Array.isArray(reqRows) && reqRows[0] ? reqRows[0] : {}) as Record<string, unknown>;
  let n = 0;
  for (const row of rows) {
    if (winnerPartnerId && row.partner_id === winnerPartnerId) continue;
    // v48: "Gracias por responder" went to studios that never replied, with no
    // client, day or hour. Now the ending names all three (standDownNote).
    const note = standDownNote(row.outcome === "accepted" ? "accepted" : "covered", rq, row);
    const res = await sendStudioNote(String(row.phone || ""), note.text, note.short, rq, false, row);
    // v48: a stand-down that could not go out now (night, the studio shut, the
    // pause, a template error, or a studio we only reach by email) leaves the
    // row open, and chase B tells the studio inside its hours. It used to be
    // closed here whatever happened, so the studio was never told.
    const later = !res.ok && (["skipped", "paused", "template"].includes(res.how) || (res.how === "none" && String(row.channel || "") === "email"));
    if (!later) {
      await sq(`request_dispatch?id=eq.${row.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ outcome: "stood_down" }),
      });
    }
    if (res.ok) n++;
    else console.log(`[dispatch] req=${requestId} stand-down did not reach ${row.phone}${later ? ", left open for the chase" : ""}`);
  }
  return n;
}

// v21: can we answer this person at all? An email always works. A phone only
// works if they have written to the bot, because WhatsApp will not carry free
// text to someone who never started a conversation.
async function reachableCustomer(r: Record<string, unknown>): Promise<{ ok: boolean; how: string }> {
  if (String(r.contact_email || "").trim()) return { ok: true, how: "email" };
  const phone = toWa(String(r.client_phone || ""));
  if (phone) {
    const prior = await sq(`wa_messages?phone=eq.${phone}&direction=eq.in&limit=1&select=id`);
    if (Array.isArray(prior) && prior.length) return { ok: true, how: "whatsapp" };
  }
  return { ok: false, how: "none" };
}

// v41 (12 Oct, with wa-bot v204): where the studios we just wrote to are, in
// the customer's language. The note used to say "en {the customer's area}"
// whatever the studios were: Manju (#91, 22 Sept) read "Hemos escrito a 4
// centros en Vivo en Urgel, cerca del metro, a unos 5" (EN: we have written to
// 4 studios in I live in Urgel, near the metro, about 5), and Willy (#107,
// 5 Oct) was told about studios "en Orcasitas" when the nearest one asked was
// in Chamberí. Now: the studios' own areas when there are three or fewer,
// "cerca de ti" when every one is within 4 km, and no place at all otherwise.
function askedWhere(studios: Array<{ area: string | null; km: number | null }>, es: boolean): string {
  const areas: string[] = [];
  for (const c of studios) {
    const a = String(c.area || "").trim();
    if (a && !areas.some((x) => x.toLowerCase() === a.toLowerCase())) areas.push(a);
  }
  if (areas.length && areas.length <= 3 && studios.every((c) => String(c.area || "").trim())) {
    const list = areas.length === 1 ? areas[0] : `${areas.slice(0, -1).join(", ")} ${es ? "y" : "and"} ${areas[areas.length - 1]}`;
    return es ? ` en ${list}` : ` in ${list}`;
  }
  if (studios.length && studios.every((c) => c.km !== null && c.km !== undefined && Number.isFinite(Number(c.km)) && Number(c.km) <= 4)) return es ? " cerca de ti" : " near you";
  return "";
}

async function dispatchOne(r: Record<string, unknown>, opts: { dryRun: boolean; fanout: number; cheapest: boolean; extra?: boolean; partnerIds?: string[]; quiet?: boolean; introIds?: string[]; serviceBy?: Record<string, string>; force?: boolean }) {
  const requestId = Number(r.id);
  const area = String(r.area || "");
  // v38: a request for a day that has already been and gone reaches nobody.
  // With relative words now anchored to when they were typed, an old "Hoy"
  // resolves to a past date instead of quietly becoming today, and a past date
  // is not something to ask a studio about. It is something to ask the customer
  // about.
  const reqD = requestDate(r);
  const stale = !!reqD && reqD.getTime() < madridToday().getTime();
  if (stale && !opts.extra && !opts.partnerIds?.length) {
    const ymd = MADRID_YMD.format(reqD!);
    console.log(`[dispatch] req=${requestId} asked for ${ymd}, which has passed. Asking nobody.`);
    if (!opts.dryRun) {
      await sq(`whatsapp_requests?id=eq.${requestId}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ stage: "stale", stage_note: `No studio asked. The day they asked for (${ymd}) has passed.`.slice(0, 500), stage_updated_at: new Date().toISOString() }),
      });
      const sp = toWa(String(r.client_phone || ""));
      if (sp && !isTestCustomer(r)) {
        const es = String(r.languages || "").toLowerCase().startsWith("es");
        const who = String(r.first_name || "").trim();
        await sendText(sp, es
          ? `${who ? who + ", p" : "P"}erdona la espera. El día que pediste ya ha pasado y no quiero buscarte hueco para un día que no has elegido.\n\n¿Qué día te viene bien ahora? Dímelo y pregunto a los centros de tu zona.\n\nMassage Club`
          : `Sorry for the wait${who ? ", " + who : ""}. The day you asked for has now passed, and I do not want to go looking for a slot on a day you did not choose.\n\nWhat day suits you now? Tell me and I will ask the studios near you.\n\nMassage Club`);
        await logEvent(sp, "dispatch_stale", { request_id: requestId, asked_for: ymd });
      }
    }
    return { requestId, sent: 0, reason: "stale", askedFor: ymd };
  }
  // v37: nothing goes out for a window that has already gone. The customer
  // hears the truth and is asked for a day we can actually sell.
  const late = tooLateReason(r);
  if (late && !opts.extra && !opts.partnerIds?.length) {
    console.log(`[dispatch] req=${requestId} too late, asking nobody: ${late}`);
    if (!opts.dryRun) {
      await sq(`whatsapp_requests?id=eq.${requestId}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ stage: "too_late", stage_note: `No studio asked. ${late}`.slice(0, 500), stage_updated_at: new Date().toISOString() }),
      });
      const cp = toWa(String(r.client_phone || ""));
      if (cp && !isTestCustomer(r)) {
        const es = String(r.languages || "").toLowerCase().startsWith("es");
        const who = String(r.first_name || "").trim();
        await sendText(cp, es
          ? `${who ? who + ", t" : "T"}e soy sincero: para hoy en esa franja ya no da tiempo a que un centro confirme y te dé el masaje entero. Prefiero decírtelo a dejarte esperando por algo que no iba a salir.\n\n¿Te viene bien mañana? Dime el día y la hora y lo pregunto en cuanto abran.\n\nMassage Club`
          : `Being straight with you${who ? ", " + who : ""}: for that window today there is no longer enough time for a studio to confirm and give you the full massage. I would rather say so than leave you waiting on something that was not going to happen.\n\nDoes tomorrow work? Tell me the day and time and I will ask the moment they open.\n\nMassage Club`);
        await logEvent(cp, "dispatch_too_late", { request_id: requestId, why: late });
      }
    }
    return { requestId, sent: 0, reason: "too_late", why: late };
  }
  const want = String(r.service_name || "");
  // Today needs more doors knocked on, because most of them will not open in time.
  const reqDay = requestDate(r);
  const isSameDay = /^(today|hoy)$/i.test(String(r.day1 || "").trim())
    || (!!reqDay && reqDay.getTime() === madridToday().getTime());
  // v49: four at most in a wave, two in a second wave, four on the whole
  // request, whatever the caller asked for. Asks that never reached a studio
  // (send_failed) do not count.
  const priorRows = await sq(`request_dispatch?request_id=eq.${requestId}&select=partner_id,sent_at,replied_at,accepted_at,offered_time`);
  const prior = (Array.isArray(priorRows) ? priorRows : []) as AskRow[];
  const room = Math.max(0, MAX_ASKS_PER_REQUEST - prior.filter(reachedStudio).length);
  const fanout = Math.min(isSameDay ? Math.max(opts.fanout, SAMEDAY_FANOUT) : opts.fanout, opts.extra ? WIDEN_FANOUT : MAX_WAVE, room);
  if (fanout <= 0) {
    console.log(`[dispatch] req=${requestId} already asked ${MAX_ASKS_PER_REQUEST - room} studios, the most one request gets`);
    return { requestId, sent: 0, reason: "max_asks", asked: MAX_ASKS_PER_REQUEST - room, keepClaim: true };
  }
  // v10: never ask the same studio twice for one request. v49: an explicit
  // partner list on a second wave too. v49 review: on a first wave as well,
  // apart from a studio the ask never reached (send_failed), which is tried
  // again. A first wave run twice (dispatched_at cleared, force_dispatch)
  // used to re-ask every studio, and the insert below put each one back to
  // pending.
  const seen = new Set(prior.filter((x) => opts.extra || reachedStudio(x)).map((x) => String(x.partner_id)));

  // v7: a price hunt ranks by listed 60 min relaxing price instead of fit and distance.
  // v10: an explicit partner list wins over both.
  let candidates: Candidate[];
  if (opts.partnerIds && opts.partnerIds.length) {
    const ids = opts.partnerIds.map((x) => encodeURIComponent(x)).join(",");
    // v49: and never a studio that has opted out. dispatch_candidates leaves
    // them out already; a named list did not.
    const rows = await sq(`partners?id=in.(${ids})&opted_out_at=is.null&select=id,business_name,neighbourhood,city,whatsapp,phone`);
    // v49: in the order the list was given (the customer's own pick first),
    // not the order the database returned it in.
    const order = new Map(opts.partnerIds.map((x, i) => [String(x), i]));
    candidates = (Array.isArray(rows) ? rows : []).map((p: any, i: number) => ({
      id: String(p.id), business_name: String(p.business_name || ""), area: p.neighbourhood || p.city || null,
      wa: toWa(String(p.whatsapp || p.phone || "")), km: null, rank: (order.get(String(p.id)) ?? i) + 1, widened: false, score: 0,
    })).filter((c: Candidate) => c.wa.length >= 9 && !seen.has(c.id)).sort((a: Candidate, b: Candidate) => a.rank - b.rank);
    // v40: the studios the customer picked (offer-first) came from the same
    // ranking, so their distance is in it. Read only; nothing else changes.
    if (area && candidates.length) {
      const near = await rpc("dispatch_candidates", { p_area: area, p_want: want || null, p_limit: 12 }) as Candidate[];
      const kmById = new Map(near.map((x) => [String(x.id), x.km]));
      for (const c of candidates) if (kmById.has(c.id)) c.km = kmById.get(c.id) ?? null;
    }
  } else {
    // v29: a second wave has to ask for more rows than it needs. Both candidate
    // functions return the best `p_limit` studios, which on a widen are exactly
    // the ones already asked, so filtering afterwards left nothing and the wave
    // contacted nobody. Ask for the already-asked count on top, then filter,
    // then trim back to the width we actually want.
    // v49: the whole pool every time (the most each function returns), because
    // resting, eligibility and closed hours can empty the top of the list.
    // planAsks trims to the width below.
    candidates = (opts.cheapest
      ? await rpc("cheapest_candidates", { p_limit: 10 })
      : await rpc("dispatch_candidates", { p_area: area || null, p_want: want || null, p_limit: 12 })) as Candidate[];
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
  // v37: rest the studios that have never answered.
  // v49 (Jordan, 31 Oct): rest the ones that never say yes or have told us to
  // stop, ask only eligible ones (a yes on record, or brought back by Jordan),
  // in the usual order, and never more than the width (restInfo, planAsks).
  // A list someone chose keeps its order and skips only opt-outs: wa-bot has
  // already told the customer those studios are being asked, so Jordan hears
  // which of them were resting instead. When nobody is eligible, nobody is
  // asked.
  const skippedResting: Array<{ name: string; why: string }> = [];
  const skippedNoYes: string[] = [];
  const askedResting: Array<{ id: string; name: string; why: string }> = [];
  let restInfoById = new Map<string, RestInfo>();
  if (candidates.length) {
    const info = await restingInfo(candidates);
    if (!info) {
      // Handed back to the sweep (no keepClaim), which tries again in 20 minutes.
      console.log(`[dispatch] req=${requestId} not sent: who is resting could not be read`);
      return { requestId, sent: 0, reason: "recheck_failed", why: "the studios' past asks or messages could not be read", dryRun: opts.dryRun, skippedClosed };
    }
    restInfoById = info;
    const plan = planAsks(candidates, restInfoById, { cap: fanout, named: !!opts.partnerIds?.length });
    for (const c of plan.resting) {
      const why = restInfoById.get(String(c.id))?.why || "resting";
      skippedResting.push({ name: c.business_name, why });
      console.log(`[dispatch] req=${requestId} resting ${c.business_name}: ${why}`);
    }
    for (const c of plan.noYes) skippedNoYes.push(c.business_name);
    for (const c of plan.askedAnyway) {
      const why = restInfoById.get(String(c.id))?.why || "no yes on record";
      askedResting.push({ id: String(c.id), name: c.business_name, why });
      console.log(`[dispatch] req=${requestId} named on the request, asked although ${why}: ${c.business_name}`);
    }
    candidates = plan.ask;
  }
  if (!candidates.length) {
    console.log(`[dispatch] req=${requestId} no reachable studios`);
    return { requestId, sent: 0, candidates: [], skippedClosed, skippedResting, skippedNoYes, reason: "no_candidates" };
  }

  // v49: the request read again right before anything goes out. A stage that
  // is no longer open, or a customer who has written "cancel" since it was
  // made, stops it here; stage_note says why and the claim is kept, so the
  // sweep does not try again every 20 minutes. force_dispatch is Jordan having
  // read the chat, so it skips the words (never the stage).
  const blocked = await dispatchBlocked(r, !!opts.force);
  if (blocked) {
    console.log(`[dispatch] req=${requestId} not sent: ${blocked.why}`);
    if (!opts.dryRun && !blocked.retry) {
      await sq(`whatsapp_requests?id=eq.${requestId}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ stage_note: appendNote(blocked.note, `not dispatched: ${blocked.why} (dispatch-studios v49)`) }),
      });
      // Words on a request that is still open: wa-bot did not read them as a
      // cancel, so a person looks.
      if (blocked.words) {
        await founderEmail(`Request #${requestId} not sent: the customer may have cancelled`, [
          `${escH(String(r.first_name || "The customer"))} (${escH(svcEs(r.service_name))} ${escH([r.day1, r.time1].filter(Boolean).join(" "))}) has written to us since making request #${requestId}, and it reads like a cancel: <i>${escH(blocked.why)}</i>.`,
          `No studio was asked${opts.extra ? " in this second wave" : ""}. The request keeps its stage (${escH(String(blocked.stage || ""))}).`,
          // v49 review: a second wave must not be re-run as a first one. That
          // starts from scratch, and the studios already asked would be asked
          // again and the request's stage and count overwritten.
          opts.extra
            ? `If they still want more studios, send dispatch-studios { request_id: ${requestId}, extra: true, force_dispatch: true }. Do not clear dispatched_at: the studios already asked are still waiting on it.`
            : `If they still want it, clear dispatched_at on #${requestId} and dispatch it again with force_dispatch.`,
          `All of it: ${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&request=${requestId}`,
        ]);
      }
    }
    return { requestId, sent: 0, reason: blocked.retry ? "recheck_failed" : "not_open", why: blocked.why, keepClaim: !blocked.retry, dryRun: opts.dryRun, skippedClosed, skippedResting, skippedNoYes };
  }

  const testCustomer = isTestCustomer(r);
  if (opts.dryRun) {
    return {
      requestId, sent: 0, dryRun: true, testCustomer, sameDay: isSameDay, fanout, skippedClosed, skippedResting, skippedNoYes, askedResting: askedResting.map(({ name, why }) => ({ name, why })),
      requestDate: requestDate(r)?.toISOString().slice(0, 10) || null,
      candidates: candidates.map((c) => ({ name: c.business_name, area: c.area, km: c.km, wa: c.wa, widened: c.widened, score: c.score, saidYesBefore: !!restInfoById.get(String(c.id))?.yesEver, broughtBack: !!restInfoById.get(String(c.id))?.unrested, last5: restInfoById.get(String(c.id))?.last || [] })),
    };
  }

  let sent = 0;
  const sentNames: string[] = [];
  const askedIds: string[] = [];
  const asked: Candidate[] = [];
  const messages: Array<{ name: string; wa: string; text: string }> = [];
  const failed: Array<{ name: string; error: string }> = [];
  // v48: "Estoy preguntando a varios centros" only when it is true: two or
  // more studios asked about this request, counting an earlier wave. A single
  // studio the customer picked (an explicit partner list) hears "Os ha elegido
  // a vosotros"; a single one from the ranking hears only that it is the one
  // being asked.
  const willAsk = candidates.filter((c) => !(testCustomer && !JORDAN_NUMBERS.includes(c.wa)));
  const askedBefore = opts.extra ? prior.filter((x) => !!x.sent_at) : [];
  const askedSet = new Set<string>([...askedBefore.map((x) => String(x.partner_id)), ...willAsk.map((c) => String(c.id))]);
  const several = askedSet.size >= 2;
  // v49: "Os ha elegido a vosotros" only to the studio the customer picked
  // (the first of the list). Resting or closed hours can leave a backup as the
  // only one asked, and nobody chose that one.
  const chosen = !!opts.partnerIds?.length && !opts.extra && willAsk.length === 1 && String(willAsk[0].id) === String(opts.partnerIds[0]);
  const askLine = several ? SEVERAL_LINE : chosen ? CHOSEN_LINE : ONLY_LINE;
  for (const c of candidates) {
    // A test booking must never reach a real studio.
    if (testCustomer && !JORDAN_NUMBERS.includes(c.wa)) {
      console.log(`[dispatch] req=${requestId} test customer, skipping real studio ${c.business_name}`);
      continue;
    }
    const arm = pickArm();
    const ins = await sq(`request_dispatch?on_conflict=request_id,partner_id`, {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ request_id: requestId, partner_id: c.id, phone: c.wa, rank: c.rank, outcome: "pending", arm }),
    });
    const rowId = Array.isArray(ins) && ins[0] ? ins[0].id : null;
    // v40 (12 Oct, with wa-bot v204): how far this studio is from the area the
    // customer gave, so the offer can say "about 9 km from Orcasitas". Willy
    // (#107) asked from Orcasitas on 5 Oct and was offered Calma in Chamberí
    // with no word about the distance. Its own PATCH rather than part of the
    // insert, so a database without the column (20261012_dispatch_km.sql not
    // yet applied) loses this line and nothing else.
    if (rowId && c.km !== null && c.km !== undefined && Number.isFinite(Number(c.km))) {
      await sq(`request_dispatch?id=eq.${rowId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ km: Number(c.km) }) }).catch(() => null);
    }

    // v48: a studio that has never had a message from us gets the intro (who
    // we are, signed) on its own, not only when Jordan lists it.
    const firstEver = await sq(`wa_messages?phone=eq.${c.wa}&direction=eq.out&limit=1&select=id`);
    const intro = !!opts.introIds?.includes(String(c.id)) || (Array.isArray(firstEver) && firstEver.length === 0);
    const res = await askOneStudio(r, c, { intro, service: opts.serviceBy?.[String(c.id)], several, line: askLine });
    if (rowId) {
      await sq(`request_dispatch?id=eq.${rowId}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify(res.ok ? { sent_at: new Date().toISOString() } : { send_error: res.error, outcome: "send_failed" }),
      });
    }
    if (res.ok) messages.push({ name: c.business_name, wa: c.wa, text: String(res.text || "") });
    // Jordan hears once per studio and request. A request that sent nothing is
    // handed back to the sweep, which tries again every 20 minutes for two
    // days; the row keeps the send_error of the last try, so a repeat is not
    // news. Nor is his own pause.
    else if (!STUDIO_OUTREACH_PAUSED && !(Array.isArray(ins) && ins[0]?.send_error)) failed.push({ name: c.business_name, error: String(res.error || "") });
    if (res.ok) { sent++; askedIds.push(String(c.id)); asked.push(c); sentNames.push(c.business_name + (opts.cheapest && c.score != null ? ` (${Number(c.score)} EUR)` : "") + (c.widened ? " (fuera de la zona)" : "")); }
  }

  // v39: a phone call on top of the ask, for the studios that said they may be
  // rung. Run in the background, query included: the WhatsApp dispatch and the
  // customer's notice never wait on it, whatever happens there. The call names
  // one hour ("a las 10:00" for a morning band), so that hour is checked against
  // the studio's listed hours as well as the moment of the call.
  if (!opts.dryRun && askedIds.length) {
    const step = (async () => {
      const cr = await sq(`partners?id=in.(${askedIds.map(encodeURIComponent).join(",")})&call_ok=is.true&select=id,opening_hours`);
      const hour = horaPedida(r);
      const callIds = (Array.isArray(cr) ? cr : [])
        .filter((p: any) => !closedNowReason(p.opening_hours) && !closedReason(p.opening_hours, { ...r, time1: hour }))
        .map((p: any) => String(p.id));
      if (!callIds.length) return;
      const cres = await fetch(`${SUPABASE_URL}/functions/v1/studio-calls`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000),
        // v48: a studio asked in writing for its own service (service_by_partner)
        // is asked about that service on the phone too, not the customer's.
        body: JSON.stringify({ ops: "place", key: OPS_KEY, request_id: requestId, partner_ids: callIds, services: Object.fromEntries(callIds.filter((id) => opts.serviceBy?.[id]).map((id) => [id, opts.serviceBy![id]])) }),
      });
      console.log(`[dispatch] req=${requestId} studio-calls ${cres.status} ${(await cres.text()).slice(0, 200)}`);
    })().catch((e) => console.log(`[dispatch] req=${requestId} studio-calls failed`, String(e)));
    try { (globalThis as any).EdgeRuntime?.waitUntil?.(step); } catch { /* it still runs */ }
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
      // v41: the studios' own areas, not "near" the customer's (askedWhere).
      const whereX = askedWhere(asked, es);
      await sendText(clientPhone, es
        ? `Seguimos en ello: hemos escrito a ${sent} centros más${whereX} para tener más opciones. Te confirmamos en cuanto uno diga que sí.`
        : `Still on it: we have asked ${sent} more studios${whereX} to widen the options. We confirm as soon as one says yes.`);
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
        // v30: remember the hour we actually put to them, so a tap on
        // "Sí, tengo hueco" resolves to the same time the studio read.
        ...(concreteTime(r.time1) && !r.proposed_time ? { proposed_time: concreteTime(r.time1) } : {}),
        stage_note: `${opts.cheapest ? "price hunt, " : ""}dispatched to ${sent}: ${sentNames.join(", ")}`.slice(0, 500),
      }),
    });

    // Tell the customer the true number, in their language. The chat session is
    // the reliable signal: requests.languages is null for our one real Spanish
    // speaker while his session correctly says "es".
    const clientPhone = toWa(String(r.client_phone || ""));
    // v41: customer_note: false means the caller (wa-bot, as the booking is
    // made) tells the customer itself, once it has read back what went out.
    if (clientPhone && !testCustomer && !opts.cheapest && !opts.quiet) {
      const sess = await sq(`wa_sessions?phone=eq.${clientPhone}&select=data`);
      const sessLang = Array.isArray(sess) && sess[0]?.data ? String(sess[0].data.lang || "") : "";
      const es = (sessLang || String(r.languages || "")).toLowerCase().startsWith("es");
      const where = askedWhere(asked, es);
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

  // v49 review: a named studio asked although it is resting or has no yes on
  // record. The summary lines below only go out when a copy fails, so Jordan
  // gets this on its own. Until wa-bot offers studios by the same rule (its
  // dropSilent is still v37's), a customer can pick one.
  const restingAsked = askedResting.filter((x) => askedIds.includes(x.id)).map(({ name, why }) => ({ name, why }));
  if (restingAsked.length && !testCustomer) {
    await founderEmail(`Request #${requestId}: asked ${restingAsked.length === 1 ? "a named studio" : restingAsked.length + " named studios"} the rest rule would skip`, [
      `Request #${requestId} (${escH(String(r.first_name || "a customer"))}, ${escH(svcEs(r.service_name))} ${escH([r.day1, r.time1].filter(Boolean).join(" "))}) named these studios: the customer's pick in wa-bot, which has already told them it is asking, or a list you sent. They were asked although they would not have been otherwise:`,
      ...restingAsked.map((x) => `<b>${escH(x.name)}</b>: ${escH(x.why)}`),
      `wa-bot still offers studios by the v37 rule (three asks, never a reply), so this can happen again until it uses the v49 one. To bring a studio back after talking to it, add its partner id to app_secrets DISPATCH_UNREST.`,
      `All studios on this request: ${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&request=${requestId}`,
    ]);
  }

  return { requestId, sent, studios: sentNames, messages, failed, skippedClosed, skippedResting, askedResting: restingAsked, testCustomer, name: String(r.first_name || ""), service: `${svcEs(r.service_name)} ${reqDuration(r)} min`, when: [r.day1, r.time1].filter(Boolean).join(" "), area };
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  const key = String(url.searchParams.get("key") || body.key || "");
  const auth = req.headers.get("Authorization") || "";
  if (key !== OPS_KEY && !auth.includes(svc())) {
    return new Response("forbidden", { status: 403 });
  }

  // v29: a widen deliberately goes wider than the first wave. The first four
  // are the best match; the second wave is the rest of the panel that is open.
  // v49: not any more. A widen is at most two eligible studios, and nothing
  // is wider than MAX_WAVE (dispatchOne also caps a second wave at
  // WIDEN_FANOUT and the whole request at MAX_ASKS_PER_REQUEST, four).
  const fanout = Math.max(1, Math.min(Number(body.fanout || (body.widen === true ? WIDEN_FANOUT : DEFAULT_FANOUT)), MAX_WAVE));
  const dryRun = body.dry_run === true;
  const force = body.force === true;
  const cheapest = body.cheapest === true;
  const forceDispatch = body.force_dispatch === true;
  // v10 (6 Sept): a deliberate second wave on a request that is already out
  // (Jordan: "look for more places"). extra skips the already-dispatched guard
  // and the duplicate rule, never re-asks a studio that already has a row for
  // this request, and can take an explicit partner_ids list instead of
  // dispatch_candidates. The customer hears "N more studios", not a fresh count.
  // v29: a widen is a second wave, so it rides on exactly the same rules:
  // skips the already-dispatched guard, never re-asks a studio that already has
  // a row for this request, and tells the customer "N more studios".
  const extra = body.extra === true || body.widen === true;
  const partnerIds = Array.isArray(body.partner_ids) ? (body.partner_ids as unknown[]).map(String).filter(Boolean) : [];
  // v41: wa-bot passes customer_note: false and says what happened itself.
  const quiet = body.customer_note === false;
  // v43: opt-in intro template and per-studio service, manual request_id calls only.
  const introIds = body.request_id && Array.isArray(body.intro_partner_ids) ? (body.intro_partner_ids as unknown[]).map(String).filter(Boolean) : [];
  const serviceBy: Record<string, string> = {};
  if (body.request_id && body.service_by_partner && typeof body.service_by_partner === "object") {
    for (const [k, v] of Object.entries(body.service_by_partner as Record<string, unknown>)) if (typeof v === "string" && v.trim()) serviceBy[String(k)] = v.trim().slice(0, 120);
  }

  // v11: a note to every studio still in play on a request (free text while
  // their 24h window is open, the aviso_centro_v1 template otherwise), and a
  // plain text to the customer. Both are ops-only and log like every other send.
  // v48: the short is required. Without one the whole text, signature and all,
  // was squeezed into the template's one-line blank. Write the text in the
  // house style (name, day and hour, no signature) and the short as one plain
  // statement ("el cliente ha cancelado, así que no hace falta que le guardéis
  // hueco"); the closed-window template is built from it.
  if (body.notify && typeof body.notify === "object") {
    const n = body.notify as { request_id?: number; text?: string; short?: string; partner_ids?: string[] };
    if (!n.request_id || !n.text) return new Response(JSON.stringify({ error: "notify.request_id and notify.text required" }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (!String(n.short || "").trim()) return new Response(JSON.stringify({ error: "notify.short required" }), { status: 200, headers: { "Content-Type": "application/json" } });
    const out = await notifyStudios(Number(n.request_id), () => ({ text: String(n.text), short: String(n.short) }), n.partner_ids);
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
    const shut = await studioShutNow(to);
    if (shut) return new Response(JSON.stringify({ ok: false, reason: `studio is shut: ${shut}` }), { status: 200, headers: { "Content-Type": "application/json" } });
    // v36: the pause covers the manual send op as well, so neither a cron, nor
    // the bot, nor I can write to a studio while it is on.
    const isStudio = await studioNameFor(to);
    if (STUDIO_OUTREACH_PAUSED && isStudio) {
      return new Response(JSON.stringify({ ok: false, reason: "studio outreach paused by Jordan" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // v48: plain text to a studio whose 24 hours have passed is accepted by
    // Meta and then dropped, while it was logged as sent and copied to Jordan
    // as if the studio had read it. Refused instead; a note that has to arrive
    // goes through studio_note, which has the template fallback.
    if (isStudio) {
      const lastIn = await sq(`wa_messages?phone=eq.${to}&direction=eq.in&order=created_at.desc&limit=1&select=created_at`);
      const lastAt = Array.isArray(lastIn) && lastIn[0]?.created_at ? Date.parse(lastIn[0].created_at) : 0;
      if (!lastAt || Date.now() - lastAt >= 23.5 * 3600e3) return new Response(JSON.stringify({ ok: false, reason: "window shut, use studio_note" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const ok = await sendText(to, String(c.text));
    return new Response(JSON.stringify({ ok }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  // v42: one note to one studio, with the template fallback (see the header).
  if (body.studio_note && typeof body.studio_note === "object") {
    const n = body.studio_note as { request_id?: number; phone?: string; text?: string; short?: string; time?: string; first_name?: string; day?: string };
    const to = toWa(String(n.phone || ""));
    const json = (o: Record<string, unknown>) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
    if (!to || !n.text) return json({ ok: false, how: "none", why: "studio_note.phone and studio_note.text required" });
    if (!withinSendingHours()) return json({ ok: false, how: "hours", why: `outside ${OPEN_HOUR}:00-${CLOSE_HOUR}:00 Madrid` });
    const reqRows = n.request_id ? await sq(`whatsapp_requests?id=eq.${Number(n.request_id)}&select=${RQ_NOTE_COLS}`) : [];
    const rq0 = (Array.isArray(reqRows) && reqRows[0] ? reqRows[0] : {}) as Record<string, unknown>;
    // v48: a booking made on a studio's own page has no request row
    // (cancel-booking, notify-studio), so the caller passes the client's first
    // name and the day ("el lunes 19 de octubre") itself. Without them the
    // template read "el masaje de nuestro cliente a las 15:30".
    const rq = rq0.id ? rq0 : { ...rq0, first_name: String(n.first_name || ""), day1: String(n.day || "") };
    // v48: the template names the hour this studio was dealing with: the time
    // wa-bot passes, else the hour it offered, else the hour it was asked.
    // n.time used to stand in for confirmed_time, and with neither the
    // studio read the customer's raw time1 ("a las Afternoon (13-18)").
    const own = n.request_id ? await sq(`request_dispatch?request_id=eq.${Number(n.request_id)}&phone=eq.${to}&select=partner_id,offered_time&limit=1`) : [];
    const row = { ...((Array.isArray(own) && own[0] ? own[0] : {}) as Record<string, unknown>), ...(n.time ? { offered_time: String(n.time) } : {}) };
    const r = await sendStudioNote(to, String(n.text), String(n.short || n.text), rq, false, row);
    return json({ ok: r.ok, how: r.how, why: r.why || null });
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
  } else if (body.chase === true) {
    // v31: ops-only. Runs on its own cron inside studio hours.
    const out = await chaseOpenAsks(dryRun);
    return new Response(JSON.stringify({ ok: true, ...out }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
  } else if (body.widen === true) {
    // v29 (Jordan, 19 Sept): the second wave. A request whose first four
    // studios have said nothing for WIDEN_AFTER_MS gets the rest of the panel.
    // v49: only the places the first wave left empty, two at most, eligible
    // studios only (dispatchOne).
    // Three things keep this honest: a request is widened once and never again
    // (widened_at), a request where a studio has already offered a time is left
    // alone because it is in play, and a request whose customer we cannot reach
    // is not widened at all, because the reachability guard below would refuse
    // it anyway and it would only spend more goodwill.
    const cutoff = new Date(Date.now() - WIDEN_AFTER_MS).toISOString();
    const floor = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const cand = await sq(`whatsapp_requests?dispatched_at=lte.${cutoff}&dispatched_at=gte.${floor}&widened_at=is.null&partner_id=is.null&dispatch_count=gt.0&stage=in.(new,dispatching,studio_asked,studio_replied)&order=id.desc&limit=10&select=*`);
    const open: Record<string, unknown>[] = [];
    for (const r of (Array.isArray(cand) ? cand : [])) {
      const live = await sq(`request_dispatch?request_id=eq.${Number(r.id)}&or=(offered_time.not.is.null,outcome.eq.won)&limit=1&select=id`);
      if (Array.isArray(live) && live.length) {
        console.log(`[dispatch] widen skipped #${r.id}: a studio has already offered a time`);
        continue;
      }
      open.push(r);
    }
    requests = open;
    if (!dryRun && requests.length) {
      await Promise.all(requests.map((r) => sq(`whatsapp_requests?id=eq.${Number(r.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ widened_at: new Date().toISOString() }),
      })));
    }
  } else {
    return new Response(JSON.stringify({ error: "pass request_id, sweep, widen or won" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (!Array.isArray(requests) || !requests.length) {
    return new Response(JSON.stringify({ ok: true, handled: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const results = [];
  // v35 (22 Sept): requests this run claimed, so a run that ends up sending
  // nothing can hand the request back to the sweep instead of burying it.
  const claimed = new Set<number>();
  for (const r of requests) {
    // v35: this guard used to be a plain read of dispatched_at, which is only
    // written once every studio has already been messaged. Two invocations of
    // the same request therefore both read null, both passed, and both sent the
    // whole panel: on 21 Sept request #89 reached four studios twice, one
    // second apart, and Centro Aloha left over it. The row insert deduplicates
    // on (request_id, partner_id), so the double never showed up in the data.
    // Claim the request instead. The PATCH only matches while dispatched_at is
    // still null, so exactly one run gets a row back and the loser stands down.
    if (!dryRun && !extra) {
      if (r.dispatched_at) { results.push({ requestId: r.id, skipped: "already dispatched" }); continue; }
      const claim = await sq(`whatsapp_requests?id=eq.${r.id}&dispatched_at=is.null`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ dispatched_at: new Date().toISOString() }),
      });
      if (!Array.isArray(claim) || !claim.length) {
        console.log(`[dispatch] req=${r.id} claimed by another run, standing down`);
        results.push({ requestId: r.id, skipped: "claimed by another run" });
        continue;
      }
      claimed.add(Number(r.id));
    }
    // v4: one customer, one fan-out. The same person often arrives twice within
    // minutes (web form, then the WhatsApp chat it opens: #45 and #46, 3 Sept).
    // A second request rides on the first instead of asking five more studios.
    // v7: force_dispatch is a deliberate second fan-out (a price hunt) and skips this.
    const phoneDigits = String(r.client_phone || "").replace(/[^0-9]/g, "");
    if (!dryRun && !forceDispatch && !extra && phoneDigits.length >= 9) {
      const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      // v42: a cancelled, stale or too_late request is over, so a new one is
      // never its duplicate (see the header).
      const sibs = await sq(`whatsapp_requests?id=neq.${r.id}&client_phone=ilike.*${phoneDigits}&dispatched_at=not.is.null&dispatch_count=gt.0&stage=not.in.(dismissed,cancelled,stale,too_late)&created_at=gte.${since24}&order=id.desc&select=id,stage,stage_note,service_name,day1,time1,area,dispatched_at&limit=1`);
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
        // v48: named, with the day and hour each studio was asked, and no
        // promise of "los datos nuevos": the new request may not go to them.
        // Studios we only reach by email are told too, and every row told is
        // closed, so chase B never follows with "no sigue adelante".
        const notified = await notifyStudios(Number(sib.id), (rq, row) => standDownNote("superseded", rq, row), undefined, "superseded");
        await sq(`whatsapp_requests?id=eq.${sib.id}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ stage: "cancelled", stage_updated_at: new Date().toISOString(), stage_note: `${String(sib.stage_note || "")}; superseded by #${r.id} (${diff.join("; ")}), ${notified.filter((x) => x.ok).length} of ${notified.length} studios stood down`.slice(0, 500) }),
        });
        console.log(`[dispatch] req=${r.id} supersedes #${sib.id}: ${diff.join("; ")}`);
      }
    }
    // v21: studios are a finite resource and their goodwill is the whole
    // business. Asking five of them to hold an afternoon for someone we cannot
    // write back to spends that goodwill for nothing, and the customer is left
    // believing we are working on it.
    if (!dryRun && !forceDispatch) {
      const reach = await reachableCustomer(r);
      if (!reach.ok) {
        await sq(`whatsapp_requests?id=eq.${r.id}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            stage: "needs_contact",
            dispatched_at: new Date().toISOString(),
            dispatch_count: 0,
            stage_updated_at: new Date().toISOString(),
            stage_note: `No way to reach the customer: no email on file and ${String(r.client_phone || "no phone")} has never written to the bot. Not sent to any studio.`.slice(0, 500),
          }),
        });
        await founderEmail(`Cannot reach ${String(r.first_name || "a customer")}, request #${r.id} not sent`, [
          `<b>${String(r.first_name || "A customer")} asked for ${svcEs(r.service_name)} ${[r.day1, r.time1].filter(Boolean).join(" ")}${r.area ? " near " + r.area : ""}, and we have no way to answer them.</b>`,
          `No email address, and ${String(r.client_phone || "their number")} has never written to our WhatsApp, so nothing we send can be delivered.`,
          `No studio was asked. Asking studios to hold a slot for someone we cannot write back to costs their goodwill and gets us nothing.`,
          `If you want to reach them, the phone is the only channel: <b>${String(r.client_phone || "not given")}</b>.`,
          `Request #${r.id} is parked at stage needs_contact. Add an email to the row and dispatch it again, or send it anyway with force_dispatch.`,
        ]);
        console.log(`[dispatch] req=${r.id} customer unreachable, not dispatched`);
        results.push({ requestId: r.id, skipped: "customer unreachable, nothing sent" });
        continue;
      }
    }
    // v49 review: v49 reads five more things between the claim and the first
    // send. An exception in any of them used to leave dispatched_at set, and
    // the sweep never looked at the request again. It is a result now, so the
    // claim below is handed back.
    let outcome: Record<string, unknown>;
    try {
      outcome = await dispatchOne(r, { dryRun, fanout, cheapest, extra, partnerIds, quiet, introIds, serviceBy, force: forceDispatch });
    } catch (e) {
      console.log(`[dispatch] req=${r.id} dispatch failed`, String(e));
      outcome = { requestId: r.id, sent: 0, reason: "error", error: String(e) };
    }
    // v35: the claim marked the request dispatched before a single studio was
    // written to. If nothing actually went out (no candidates, every send
    // failed) that mark would hide the request from the sweep forever, so give
    // it back. A test customer keeps the mark on purpose: dispatchOne has
    // already set it so the sweep stops re-picking a request that sends nothing.
    // v49: nor a request the recheck stopped (keepClaim): it is closed, or
    // Jordan has been told the customer may have cancelled.
    if (claimed.has(Number(r.id)) && !Number(outcome.sent) && !(outcome as { testCustomer?: boolean }).testCustomer && !(outcome as { keepClaim?: boolean }).keepClaim) {
      await sq(`whatsapp_requests?id=eq.${r.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ dispatched_at: null }),
      });
      console.log(`[dispatch] req=${r.id} nothing sent, claim released`);
    }
    results.push(outcome);
  }

  const totalSent = results.reduce((n, x) => n + (Number((x as { sent?: number }).sent) || 0), 0);
  // v48: an ask that did not go out used to be silent: the row said
  // send_failed and nobody looked. Jordan now hears which studios were not
  // asked and why (for example, the only studio for a request while
  // solicitud_reserva_v7 waits for Meta, since v3 would say "varios centros").
  const notAsked = results.filter((x: any) => Array.isArray(x.failed) && x.failed.length) as any[];
  if (notAsked.length) {
    await founderEmail(`Not asked: ${notAsked.reduce((n, x) => n + x.failed.length, 0)} studio${notAsked.reduce((n, x) => n + x.failed.length, 0) === 1 ? "" : "s"} on request${notAsked.length === 1 ? "" : "s"} ${notAsked.map((x) => "#" + x.requestId).join(", ")}`,
      notAsked.map((x) => `Request #${x.requestId} · ${escH(x.name || "customer")} · ${escH(x.service || "")}<br>${x.failed.map((f: { name: string; error: string }) => `<b>${escH(f.name)}</b> was not asked: ${escH(f.error)}`).join("<br>")}<br>All studios on this request: ${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&request=${x.requestId}`));
  }
  if (totalSent > 0) {
    // v5: a founder email a person can read at a glance. v12: it links to the
    // request page in wa-chat, which shows every studio asked and their replies.
    const lines = results.filter((x: any) => x.sent > 0).map((x: any) =>
      `Request #${x.requestId} · ${x.name || "customer"} · ${x.service} · ${x.when || "time to be set"}${x.area ? " · " + x.area : ""}<br>Asked ${x.sent} studios${cheapest ? " (cheapest listed 60 min first)" : ""}${extra ? " (second wave)" : ""}: ${(x.studios || []).join(", ")}.<br>Each studio was asked for a Massage Club rate; the best offer wins after a 10 minute window (same-day requests go to the first yes). The others are stood down automatically. Nothing to do.${(x.skippedClosed || []).length ? "<br>Not asked, closed by their own hours: " + x.skippedClosed.join(", ") + "." : ""}${(x.askedResting || []).length ? "<br>Asked because the request named them, although resting: " + x.askedResting.map((s: { name: string; why: string }) => `${escH(s.name)} (${escH(s.why)})`).join("; ") + ". To bring one back after talking to it, add its partner id to app_secrets DISPATCH_UNREST." : ""}${(x.skippedResting || []).length ? "<br>Not asked, resting: " + x.skippedResting.map((s: { name: string; why: string }) => `${escH(s.name)} (${escH(s.why)})`).join("; ") + "." : ""}<br>All studios and their replies: ${SUPABASE_URL}/functions/v1/wa-chat?key=${OPS_KEY}&request=${x.requestId}`);
    let copied = true;
    for (const x of results.filter((x: any) => x.sent > 0) as any[]) {
      for (const m of (x.messages || []) as Array<{ name: string; wa: string; text: string }>) {
        if (!(await studioCopy(m.wa, m.name, m.text))) copied = false;
      }
    }
    if (!copied) await founderEmail(`Asked ${totalSent} studios${extra ? " (second wave)" : ""}: some copies did not reach you`, lines);
  }

  return new Response(JSON.stringify({ ok: true, handled: results.length, results }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
}

// v18 (8 Sept): this file carries no secrets, because the repo is public. The
// deployed function is an eight-line loader that pins one commit of this file
// and passes the keys in. Deno.env.set is not supported in the edge runtime, so
// they arrive as arguments rather than as a faked environment.
export function start(opts: { opsKey: string; resendKey: string; waToken: string; phoneId?: string; studioOutreachPaused?: boolean }) {
  OPS_KEY = opts.opsKey;
  if (opts.studioOutreachPaused) STUDIO_OUTREACH_PAUSED = true;
  RESEND_API_KEY = opts.resendKey;
  WA_TOKEN = opts.waToken;
  if (opts.phoneId) PHONE_ID = opts.phoneId;
  GRAPH = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;
  Deno.serve(handleRequest);
}
