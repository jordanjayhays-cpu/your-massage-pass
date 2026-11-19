// consent (20 Nov 2026, the Kelly rule): saves a customer's answer to
// "Can Massage Club send you offers and reminders to book again, by email and
// WhatsApp?" and every opt-out from the one-tap unsubscribe page.
//
// Why: on 19 Nov a customer booked through the homepage form and was never
// asked. The website's only opt-in card saved into a table that did not exist
// and said "Done" anyway, so nothing was ever recorded and nobody knew. Spanish
// law (LSSI art. 21) allows a promotional email or WhatsApp only after an
// express yes, and GDPR art. 7.1 says we must be able to prove that yes: who,
// when, and the exact words they were shown. So every answer is one row in
// public.marketing_optins (supabase/migrations/20261120_marketing_consent.sql),
// and a row that cannot be written is never silent: the page gets a 500 and
// Jordan gets an email.
//
// Like dispatch-studios, the repo copy holds no secrets. The deployed function
// is a short loader that pins one commit of this file and calls start(cfg):
//
//   import { start } from "https://raw.githubusercontent.com/jordanjayhays-cpu/your-massage-pass/<commit>/supabase/functions/consent/index.ts";
//   start({ resendKey: "<Resend key>" });
//
// MC_SIGN_KEY (the same Edge Function secret wa-bot and letters read) signs the
// unsubscribe links; SUPABASE_SERVICE_ROLE_KEY is the platform's. Deployed
// with verify_jwt = false (supabase/config.toml): the homepage form and the
// unsubscribe page have no login.
//
// API (JSON in, JSON out; CORS for book.massageclub.io and the Vercel site):
//   POST { choice: "yes"|"no", source, wording, lang, email?, phone?, token?,
//          booking_ref?, request_id? }
//     token is a bookings.action_token (the review page): the email, phone and
//     booking_ref are then read from that booking here, so the page never
//     needs to know the email. -> 200 { ok: true } once the row is written.
//   POST { action: "withdraw", u, s }
//     u = an email or a phone, s = the first 32 hex characters of
//     HMAC-SHA256(MC_SIGN_KEY, u). Writes a withdraw row. -> 200 { ok: true }.
//     POST only: a GET would let a mail scanner that opens links unsubscribe
//     people who never clicked.
//   Errors: 400 bad input, 403 bad origin or signature, 404 unknown token,
//   405 wrong method, 500 { ok: false } when the row could not be written
//   (and Jordan is emailed, except for test contacts).
//
// Other functions build the link that goes in every promotional email with
// unsubscribeUrl(u) below.

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const FOUNDER_TO = ["jordan@massageclub.io"];
const UNSUB_PAGE = "https://book.massageclub.io/unsubscribe";
let RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
let SIGN_KEY = Deno.env.get("MC_SIGN_KEY") || "";
const svc = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const H = () => ({ apikey: svc(), Authorization: `Bearer ${svc()}`, "Content-Type": "application/json" });

export const ALLOWED_ORIGINS = ["https://book.massageclub.io", "https://your-massage-pass-o5fo.vercel.app"];
// Where an answer can come from (marketing_optins_source_chk). 'unsubscribe'
// is only ever written by the withdraw path below.
export const CHOICE_SOURCES = ["go_page", "studio_booking", "studio_request", "payment", "review_page", "profile", "bot", "quiz"];
export const CHANNEL = "email+whatsapp";
// What the unsubscribe page shows when it does not send its own words.
export const UNSUB_WORDING: Record<string, string> = {
  en: "Unsubscribe: no more offers or reminders from Massage Club, by email or WhatsApp. Messages about your bookings still come.",
  es: "Darse de baja: ya no recibirás ofertas ni recordatorios de Massage Club, ni por email ni por WhatsApp. Los mensajes sobre tus reservas seguirán llegando.",
};

// ---------------------------------------------------------------------------
// Test contacts (CLAUDE.md): Jordan's own addresses and numbers, the friend
// testers and the fake domains. Their answers are written like anyone's (so
// Jordan can test the whole path), but a failure never emails him about them.
// ---------------------------------------------------------------------------
const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu"];
const TEST_DOMAINS = ["testing.com", "example.com", "test.com", "placeholder.local"];
const TEST_PHONES = ["15622355063", "17867276503", "34612474827", "34635569364", "34662680781"];
export function isTestContact(o: { email?: string | null; phone?: string | null; name?: string | null }): boolean {
  const e = String(o.email || "").trim().toLowerCase();
  if (e) {
    if (TEST_EMAILS.includes(e)) return true;
    const dom = e.split("@")[1] || "";
    if (TEST_DOMAINS.some((d) => dom === d || dom.endsWith("." + d))) return true;
    if (/\+(mctest|uitest)[^@]*@/.test(e)) return true;
  }
  const p = digits(o.phone);
  if (p) {
    if (TEST_PHONES.includes(p)) return true;
    if (p.startsWith("86") && p.endsWith("997")) return true;   // Yi
    if (/^34600000\d{3}$/.test(p)) return true;                 // the bot's fake canary numbers
  }
  if (/\b(test|prueba)\b/i.test(String(o.name || ""))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
function digits(x: unknown): string { return String(x ?? "").replace(/[^0-9]/g, ""); }
export function normEmail(x: unknown): string | null {
  const e = String(x ?? "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
export function normPhone(x: unknown): string | null {
  const d = digits(x);
  return d.length >= 6 && d.length <= 15 ? d : null;
}
// An unsubscribe "u" is an email or a phone, in the one form it is signed in.
export function normContact(u: unknown): string | null {
  const s = String(u ?? "").trim();
  if (!s) return null;
  return s.includes("@") ? normEmail(s) : normPhone(s);
}

// ---------------------------------------------------------------------------
// Signatures. HMAC-SHA256 keyed with MC_SIGN_KEY itself over the normalised
// address, first 16 bytes in hex. (wa-bot's other links key their HMAC with
// "<MC_SIGN_KEY>:<kind>", so no link of theirs can be made from one of these.)
// ---------------------------------------------------------------------------
async function hmacHex(key: string, value: string, bytes: number): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value)));
  return [...mac.slice(0, bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function signContact(u: string, key: string = SIGN_KEY): Promise<string> {
  const n = normContact(u);
  if (!n) throw new Error("not an email or phone");
  if (!key) throw new Error("MC_SIGN_KEY is not set");
  return await hmacHex(key, n, 16);
}
// The link every promotional email carries (CLAUDE.md, the Kelly rule). It
// throws without MC_SIGN_KEY: a promotion without a working unsubscribe link
// must not go out at all.
export async function unsubscribeUrl(u: string, key: string = SIGN_KEY): Promise<string> {
  const n = normContact(u);
  if (!n) throw new Error("unsubscribeUrl: not an email or phone");
  return `${UNSUB_PAGE}?u=${encodeURIComponent(n)}&s=${await signContact(n, key)}`;
}
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function ipHash(req: Request): Promise<string | null> {
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (!ip || !SIGN_KEY) return null;
  return await hmacHex(SIGN_KEY + ":ip", ip, 16);
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
function cors(origin: string): Record<string, string> {
  return ALLOWED_ORIGINS.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Max-Age": "86400", Vary: "Origin" }
    : { Vary: "Origin" };
}
function out(body: Record<string, unknown>, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
const MAX_BODY = 16 * 1024;

export async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get("origin") || "";
  const h = cors(origin);
  // A browser on another site is refused outright; a request with no Origin
  // (another function, a test) is checked on its content like any other.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return out({ ok: false, error: "origin" }, 403, h);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return out({ ok: false, error: "method" }, 405, h);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return out({ ok: false, error: "too_large" }, 413, h);
    body = JSON.parse(raw);
  } catch { return out({ ok: false, error: "bad_json" }, 400, h); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return out({ ok: false, error: "bad_json" }, 400, h);
  if (body.action === "withdraw") return await withdraw(body, req, h);
  if (body.action !== undefined) return out({ ok: false, error: "action" }, 400, h);
  return await choice(body, req, h);
}

type Row = { email: string | null; phone: string | null; source: string; booking_ref: string | null; request_id: number | null; channel: string; action: "yes" | "no" | "withdraw"; wording: string; wording_lang: string | null; ip_hash: string | null };

async function choice(body: Record<string, unknown>, req: Request, h: Record<string, string>): Promise<Response> {
  const action = body.choice;
  if (action !== "yes" && action !== "no") return out({ ok: false, error: "choice" }, 400, h);
  const source = String(body.source || "");
  if (!CHOICE_SOURCES.includes(source)) return out({ ok: false, error: "source" }, 400, h);
  const wording = typeof body.wording === "string" ? body.wording.trim() : "";
  if (!wording || wording.length > 2000) return out({ ok: false, error: "wording" }, 400, h);
  const lang = typeof body.lang === "string" && /^[a-z]{2}$/i.test(body.lang) ? body.lang.toLowerCase() : null;
  let bookingRef: string | null = null;
  if (body.booking_ref !== undefined && body.booking_ref !== null && body.booking_ref !== "") {
    const b = String(body.booking_ref);
    if (b.length > 64 || !/^[A-Za-z0-9_.:-]+$/.test(b)) return out({ ok: false, error: "booking_ref" }, 400, h);
    bookingRef = b;
  }
  let requestId: number | null = null;
  if (body.request_id !== undefined && body.request_id !== null && body.request_id !== "") {
    const n = Number(body.request_id);
    if (!Number.isSafeInteger(n) || n <= 0) return out({ ok: false, error: "request_id" }, 400, h);
    requestId = n;
  }
  let email: string | null = null, phone: string | null = null, name = "";
  if (body.token !== undefined && body.token !== null && body.token !== "") {
    // The review page: the booking says who this is, not the browser.
    const token = String(body.token);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) return out({ ok: false, error: "token" }, 400, h);
    let rows: unknown = null, why = "";
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?action_token=eq.${encodeURIComponent(token)}&select=booking_ref,client_email,client_phone,client_name&limit=1`, { headers: H() });
      if (r.ok) rows = await r.json().catch(() => null); else why = `bookings lookup: HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`;
    } catch (e) { why = `bookings lookup: ${String(e).slice(0, 200)}`; }
    if (why || !Array.isArray(rows)) {
      await alertFounder({ action, source, wording, wording_lang: lang, email: null, phone: null, booking_ref: bookingRef, request_id: requestId, channel: CHANNEL, ip_hash: null }, why || "bookings lookup: unreadable answer", { token: true });
      return out({ ok: false }, 500, h);
    }
    const b = (rows as Array<Record<string, unknown>>)[0];
    if (!b) return out({ ok: false, error: "unknown_token" }, 404, h);
    email = normEmail(b.client_email);
    phone = normPhone(b.client_phone);
    bookingRef = b.booking_ref ? String(b.booking_ref) : bookingRef;
    name = String(b.client_name || "");
  } else {
    if (body.email !== undefined && body.email !== null && body.email !== "") {
      email = normEmail(body.email);
      if (!email) return out({ ok: false, error: "email" }, 400, h);
    }
    if (body.phone !== undefined && body.phone !== null && body.phone !== "") {
      phone = normPhone(body.phone);
      if (!phone) return out({ ok: false, error: "phone" }, 400, h);
    }
  }
  if (!email && !phone) return out({ ok: false, error: "contact" }, body.token ? 422 : 400, h);
  const row: Row = { email, phone, source, booking_ref: bookingRef, request_id: requestId, channel: CHANNEL, action, wording, wording_lang: lang, ip_hash: await ipHash(req) };
  return await save(row, h, isTestContact({ email, phone, name }));
}

async function withdraw(body: Record<string, unknown>, req: Request, h: Record<string, string>): Promise<Response> {
  const u = normContact(body.u);
  const sig = String(body.s || "").toLowerCase();
  if (!u) return out({ ok: false, error: "u" }, 400, h);
  if (!/^[0-9a-f]{32}$/.test(sig)) return out({ ok: false, error: "signature" }, 403, h);
  const lang = typeof body.lang === "string" && /^[a-z]{2}$/i.test(body.lang) ? body.lang.toLowerCase() : "en";
  const pageWording = typeof body.wording === "string" ? body.wording.trim().slice(0, 2000) : "";
  const isEmail = u.includes("@");
  const row: Row = { email: isEmail ? u : null, phone: isEmail ? null : u, source: "unsubscribe", booking_ref: null, request_id: null, channel: CHANNEL, action: "withdraw", wording: pageWording || UNSUB_WORDING[lang] || UNSUB_WORDING.en, wording_lang: pageWording ? lang : (UNSUB_WORDING[lang] ? lang : "en"), ip_hash: await ipHash(req) };
  const test = isTestContact({ email: row.email, phone: row.phone });
  if (!SIGN_KEY) {
    // A person asked to stop and we cannot even check the link. Loud.
    if (!test) await alertFounder(row, "MC_SIGN_KEY is not set on the consent function, so no unsubscribe link can be checked.");
    return out({ ok: false }, 500, h);
  }
  if (!sameHex(sig, await signContact(u, SIGN_KEY))) return out({ ok: false, error: "signature" }, 403, h);
  return await save(row, h, test);
}

async function save(row: Row, h: Record<string, string>, test: boolean): Promise<Response> {
  let why = "";
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/marketing_optins`, { method: "POST", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify(row) });
    if (!r.ok) why = `HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 300)}`;
  } catch (e) { why = String(e).slice(0, 300); }
  if (!why) return out(test ? { ok: true, test: true } : { ok: true }, 200, h);
  console.log(`[consent] NOT saved (${row.source} ${row.action}${test ? ", test contact" : ""}): ${why}`);
  if (!test) await alertFounder(row, why);
  return out(test ? { ok: false, test: true } : { ok: false }, 500, h);
}

// One short email to Jordan for every answer that could not be written. Until
// it is written, that person counts as not answered, so nothing promotional
// goes to them; the alert is there so a yes, or a withdrawal, is not lost.
export function alertText(row: Partial<Row>, why: string, o: { token?: boolean } = {}): { subject: string; text: string } {
  const what = row.action === "withdraw" ? "An unsubscribe" : `A "${row.action}" to offers`;
  const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const who = [row.email, row.phone ? "+" + row.phone : ""].filter(Boolean).join(", ")
    || (o.token ? "a review page link (the booking could not be read)" : "unknown");
  const lines = [
    `${what} from ${row.source} was NOT saved (${when}, Madrid time).`,
    "",
    `Database answer: ${why}`,
    "",
    `Who: ${who}`,
    ...(row.booking_ref ? [`Booking: ${row.booking_ref}`] : []),
    ...(row.request_id ? [`Request: #${row.request_id}`] : []),
    `Words shown (${row.wording_lang || "?"}): "${String(row.wording || "").slice(0, 400)}"`,
    "",
    row.action === "withdraw"
      ? "What to do: add a withdraw row for this address in marketing_optins by hand, and send them nothing promotional."
      : "What to do: add the row by hand in marketing_optins (Supabase), with the words above. Until then this person counts as not answered and gets no offers.",
    "",
    "The consent function",
  ];
  return { subject: `Consent NOT saved: ${row.action} from ${row.source}`, text: lines.join("\n") };
}
async function alertFounder(row: Partial<Row>, why: string, o: { token?: boolean } = {}): Promise<void> {
  const { subject, text } = alertText(row, why, o);
  try {
    if (!RESEND_API_KEY) { console.log("[consent] ALERT (no Resend key):", subject, text); return; }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: FOUNDER_TO, subject, text }),
    });
    if (!r.ok) console.log("[consent] ALERT email failed", r.status, subject, text);
  } catch (e) { console.log("[consent] ALERT email failed", String(e), subject, text); }
}

export function start(cfg: { resendKey?: string; signKey?: string } = {}) {
  if (cfg.resendKey) RESEND_API_KEY = cfg.resendKey;
  if (cfg.signKey) SIGN_KEY = cfg.signKey;
  Deno.serve(handleRequest);
}
