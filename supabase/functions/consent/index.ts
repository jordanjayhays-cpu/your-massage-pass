// consent (20 Nov 2026, the consent rule in CLAUDE.md): saves a customer's
// answer to "Can Massage Club send you offers and reminders to book again, by
// email and WhatsApp?" and every opt-out from the one-tap unsubscribe page.
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
// Secrets (Edge Functions, Secrets): MC_SIGN_KEY (the same one wa-bot and
// letters read) signs and seals the unsubscribe links, and MUST be set before
// this goes live (without it every unsubscribe answers 500 and emails Jordan).
// MC_IP_HASH_KEY, if set, keys the IP hash and should never be rotated (so a
// disputed answer can still be matched years later); without it the hash is
// keyed from MC_SIGN_KEY. SUPABASE_SERVICE_ROLE_KEY is the platform's.
// Deployed with verify_jwt = false (supabase/config.toml): the homepage form
// and the unsubscribe page have no login.
//
// API (JSON in, JSON out; CORS for book.massageclub.io and the Vercel site):
//   POST { choice: "yes"|"no", source, wording, lang, email?, phone?, token?,
//          booking_ref?, request_id? }
//     From a browser on one of those two sites only (Origin required).
//     wording must be the approved notice, word for word, in English or
//     Spanish (APPROVED_WORDING); its language is the one saved.
//     The answer is tied to the person on the server, never on the browser's
//     word alone (GDPR art. 7.1; EDPB 05/2020 paras 104-108):
//       token (review_page)        a bookings.action_token: email, phone and
//                                  booking_ref are read from that booking.
//       go_page, studio_request    the whatsapp_requests row (request_id, or
//                                  else one made in the last 6 hours) must
//                                  carry the email or phone sent; only the
//                                  addresses that match are saved.
//       studio_booking, payment    the same against the bookings row
//                                  (booking_ref, or one made in the last 6h).
//       profile                    the signed-in session (Authorization:
//                                  Bearer <access token>): the account's own
//                                  email and id are saved, never the body's.
//       quiz                       saved as given, but status.ts canMarket()
//                                  does not count it until a confirmation
//                                  click exists (double opt-in, not built).
//     At most 30 answers per hour from one IP. -> 200 { ok: true }.
//   POST { action: "withdraw", u, s }
//     u = the opaque token unsubscribeUrl() puts in the link (the address
//     sealed with AES-GCM, letters only), s = the first 32 hex characters of
//     HMAC-SHA256(MC_SIGN_KEY, u). A plain lowercased email or digits-only
//     phone is still accepted as u (signed in that normalised form), for a
//     sender that cannot call unsubscribeUrl, but no link we build carries one:
//     an address in a URL ends up in logs, browser history and the page's
//     analytics. Writes a withdraw row for that address AND for every email
//     or phone seen with it (marketing_optins, whatsapp_requests, bookings),
//     because the page promises "by email or WhatsApp". -> 200 { ok: true }.
//     POST only: a GET would let a mail scanner that opens links unsubscribe
//     people who never clicked.
//   POST { action: "stop", u, lang?, wording? }
//     The /unsubscribe page with no link: the person types the email or
//     phone we write to (GDPR art. 7.3; EDPB 05/2020 para 114: withdrawing
//     must be possible where the yes was given). From the site's pages only
//     (Origin), at most 30 an hour from one IP. A forged one can only stop
//     messages, never start them. Same rows as a withdraw.
//   Errors: 400 bad input, 403 bad origin, signature or no matching request,
//   404 unknown token, 405 wrong method, 429 too many answers, 500
//   { ok: false } when the row could not be written (and Jordan is emailed,
//   except for test contacts).
//
// Other functions build every promotional email with promoParts() below (the
// "Publicidad" label, the one-tap link and support@massageclub.io), and ask
// status.ts canMarket() before sending.
//
// A withdrawal that arrives by email at support@massageclub.io is recorded by
// hand, in the Supabase SQL editor (one line, the sender's own words):
//   insert into public.marketing_optins (email, source, action, wording, wording_lang)
//   values ('<their address, lowercased>', 'unsubscribe', 'withdraw', '<what they wrote>', 'en');
// and the same again with phone instead of email for their phone, if known.

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const FOUNDER_TO = ["jordan@massageclub.io"];
const UNSUB_PAGE = "https://book.massageclub.io/unsubscribe";
let RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
let SIGN_KEY = Deno.env.get("MC_SIGN_KEY") || "";
let IP_KEY = Deno.env.get("MC_IP_HASH_KEY") || "";
const svc = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const H = () => ({ apikey: svc(), Authorization: `Bearer ${svc()}`, "Content-Type": "application/json" });

export const ALLOWED_ORIGINS = ["https://book.massageclub.io", "https://your-massage-pass-o5fo.vercel.app"];
// Where a website answer can come from (marketing_optins_source_chk). 'bot'
// is written by wa-bot itself (the WhatsApp sender is the proof), never
// through here, and 'unsubscribe' only by the withdraw path below.
export const CHOICE_SOURCES = ["go_page", "studio_booking", "studio_request", "payment", "review_page", "profile", "quiz"];
const REQUEST_SOURCES = ["go_page", "studio_request"];
const BOOKING_SOURCES = ["studio_booking", "payment"];
export const CHANNEL = "email+whatsapp";
// The notice every booking path shows (fixed 19 Nov; wa-bot/consent.ts and the
// website's CONSENT_COPY and public/go.html carry the same words). Anything
// else is refused: the row must hold the words the person really saw.
export const APPROVED_WORDING: Record<"en" | "es", string> = {
  en: "Can Massage Club send you offers and reminders to book again, by email and WhatsApp? You can stop any time with one tap, or by writing to support@massageclub.io.",
  es: "¿Puede Massage Club enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp? Puedes darte de baja cuando quieras con un toque o escribiendo a support@massageclub.io.",
};
export function approvedLang(wording: string): "en" | "es" | null {
  const w = wording.trim();
  return w === APPROVED_WORDING.en ? "en" : w === APPROVED_WORDING.es ? "es" : null;
}
// What the unsubscribe page shows when it does not send its own words.
export const UNSUB_WORDING: Record<string, string> = {
  en: "Unsubscribe: no more offers or reminders from Massage Club, by email or WhatsApp. Messages about your bookings still come.",
  es: "Darse de baja: ya no recibirás ofertas ni recordatorios de Massage Club, ni por email ni por WhatsApp. Los mensajes sobre tus reservas seguirán llegando.",
};
const RATE_MAX = 30;                 // answers per IP per hour
const LINK_RECENT_MS = 6 * 3600e3;   // a request or booking made this recently can be matched without its id
const LINK_BY_ID_MS = 7 * 86400e3;   // and one named by id must be this recent
const MAX_LINKED = 10;

// ---------------------------------------------------------------------------
// Test contacts (CLAUDE.md): Jordan's own addresses and numbers, the friend
// testers and the fake domains. Their answers are written like anyone's (so
// Jordan can test the whole path), but a failure never emails him about them,
// and status.ts canMarket() never lets a promotion reach them.
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
// An address in the one form it is signed and stored in: an email lowercased,
// a phone digits only (country code included).
export function normContact(u: unknown): string | null {
  const s = String(u ?? "").trim();
  if (!s) return null;
  return s.includes("@") ? normEmail(s) : normPhone(s);
}
// The same phone typed with or without its country code.
export function samePhone(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  return s.length >= 9 && l.endsWith(s);
}

// ---------------------------------------------------------------------------
// Signatures and the sealed unsubscribe token. HMAC-SHA256 keyed with
// MC_SIGN_KEY itself, first 16 bytes in hex. (wa-bot's other links key their
// HMAC with "<MC_SIGN_KEY>:<kind>", so no link of theirs can be made from one
// of these.) The token is "z" + the AES-GCM sealed address written with the
// letters a-p only: no "@", no digits, so neither the address nor a phone
// number can be read from the URL, and the page's own masking shows nothing.
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
export async function signToken(t: string, key: string = SIGN_KEY): Promise<string> {
  if (!key) throw new Error("MC_SIGN_KEY is not set");
  return await hmacHex(key, t, 16);
}
const PEX = "abcdefghijklmnop";
export const TOKEN_RE = /^z(?:[a-p]{2}){30,600}$/;
function toPex(b: Uint8Array): string { let s = ""; for (const x of b) s += PEX[x >> 4] + PEX[x & 15]; return s; }
function fromPex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = PEX.indexOf(s[2 * i]) * 16 + PEX.indexOf(s[2 * i + 1]);
  return out;
}
async function sealKey(key: string) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("mc-unsubscribe-seal:" + key));
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
export async function sealContact(u: string, key: string = SIGN_KEY): Promise<string> {
  const n = normContact(u);
  if (!n) throw new Error("not an email or phone");
  if (!key) throw new Error("MC_SIGN_KEY is not set");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sealKey(key), new TextEncoder().encode(n)));
  const all = new Uint8Array(iv.length + ct.length);
  all.set(iv, 0); all.set(ct, iv.length);
  return "z" + toPex(all);
}
export async function openContact(t: string, key: string = SIGN_KEY): Promise<string | null> {
  if (!TOKEN_RE.test(t) || !key) return null;
  const all = fromPex(t.slice(1));
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, await sealKey(key), all.slice(12));
    return normContact(new TextDecoder().decode(pt));
  } catch { return null; }
}
// The link every promotional email carries (CLAUDE.md, the consent rule). It
// throws without MC_SIGN_KEY: a promotion without a working unsubscribe link
// must not go out at all. The sealed token travels in the fragment (never
// sent to the server, the host's logs or the analytics tag) and, until the
// /unsubscribe page on the website branch reads the fragment, in the query as
// well, so the link works with either page. Drop the query copy once the page
// reads "#u=...&s=...". Either way only the sealed token is in it, never the
// address.
export async function unsubscribeUrl(u: string, key: string = SIGN_KEY): Promise<string> {
  const n = normContact(u);
  if (!n) throw new Error("unsubscribeUrl: not an email or phone");
  if (!key) throw new Error("unsubscribeUrl: MC_SIGN_KEY is not set");
  const t = await sealContact(n, key);
  const q = `u=${t}&s=${await signToken(t, key)}`;
  return `${UNSUB_PAGE}?${q}#${q}`;
}
// Every promotional email is built through this. LSSI art. 20.1: it says it
// is advertising at the start ("Publicidad"); art. 22.1: it carries a simple,
// free way to stop (the one-tap link and the support address). Throws when
// the link cannot be made. The words need Jordan's yes before the first send.
export const PROMO_FOOTER: Record<"en" | "es", (link: string) => string> = {
  en: (link) => `You get this email because you said yes to offers from Massage Club. Stop them with one tap: ${link} or write to support@massageclub.io.`,
  // "You receive this email because you agreed to receive offers from
  // Massage Club. Unsubscribe with one tap: <link> or write to ..."
  es: (link) => `Recibes este email porque aceptaste recibir ofertas de Massage Club. Date de baja con un toque: ${link} o escribe a support@massageclub.io.`,
};
export async function promoParts(addr: string, lang: string, subject: string, text: string, key: string = SIGN_KEY): Promise<{ subject: string; text: string; unsubscribe: string }> {
  const link = await unsubscribeUrl(addr, key);
  const L = lang === "es" ? "es" : "en";
  return { subject: `Publicidad: ${subject}`, text: `${text}\n\n${PROMO_FOOTER[L](link)}`, unsubscribe: link };
}
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function ipHash(req: Request): Promise<string | null> {
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const key = IP_KEY || (SIGN_KEY ? SIGN_KEY + ":ip" : "");
  if (!ip || !key) return null;
  return await hmacHex(key, ip, 16);
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
  // A browser on another site is refused outright.
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
  // A withdrawal is signed, so it may come from anywhere (a mail client's
  // own unsubscribe, a script Jordan runs). An answer comes only from the
  // site's own pages: a browser always sends Origin on this cross-site POST.
  if (body.action === "withdraw") return await withdraw(body, req, h);
  if (body.action !== undefined && body.action !== "stop") return out({ ok: false, error: "action" }, 400, h);
  if (!origin) return out({ ok: false, error: "origin" }, 403, h);
  if (body.action === "stop") return await typedStop(body, req, h);
  return await choice(body, req, h);
}

type Row = { email: string | null; phone: string | null; user_id: string | null; source: string; booking_ref: string | null; request_id: number | null; channel: string; action: "yes" | "no" | "withdraw"; wording: string; wording_lang: string | null; ip_hash: string | null };

// Rows from the REST API, or null when they could not be read.
async function readRows(path: string): Promise<Array<Record<string, unknown>> | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H() });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? j as Array<Record<string, unknown>> : null;
  } catch { return null; }
}
const since = (ms: number) => new Date(Date.now() - ms).toISOString();
async function tooMany(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const recent = await readRows(`marketing_optins?ip_hash=eq.${ip}&created_at=gte.${since(3600e3)}&select=id&limit=${RATE_MAX + 1}`);
  return !!recent && recent.length >= RATE_MAX;
}
// The signed-in account behind a profile answer: { id, email }, "invalid"
// when the session is not one, or null when Auth could not be asked.
async function authUser(jwt: string): Promise<{ id: string; email: string | null } | "invalid" | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: svc(), Authorization: `Bearer ${jwt}` } });
    if (r.status === 401 || r.status === 403) return "invalid";
    if (!r.ok) return null;
    const j = await r.json().catch(() => null) as Record<string, unknown> | null;
    if (!j || typeof j.id !== "string") return "invalid";
    return { id: j.id, email: normEmail(j.email) };
  } catch { return null; }
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One alert a while about a page whose copy or links have drifted from this
// function (wrong wording, a request id that does not match). Anyone can send
// those, so they are throttled; a failed save is never throttled.
let lastDriftAlert = 0;
// For tests/consent.mjs only: each case starts with the throttle clear.
export const _test = { resetThrottle: () => { lastDriftAlert = 0; } };
async function driftAlert(row: Partial<Row>, why: string) {
  if (Date.now() - lastDriftAlert < 10 * 60e3) return;
  lastDriftAlert = Date.now();
  await alertFounder(row, why, { drift: true });
}

type Link = { email: string | null; phone: string | null; request_id: number | null; booking_ref: string | null };
// Ties a website answer to the request or booking it was given with. Only
// the addresses the row itself carries are kept.
async function linkChoice(source: string, email: string | null, phone: string | null, requestId: number | null, bookingRef: string | null): Promise<{ link?: Link; unread?: string; claimed: boolean }> {
  const isReq = REQUEST_SOURCES.includes(source);
  const table = isReq ? "whatsapp_requests" : "bookings";
  const emailCol = isReq ? "contact_email" : "client_email";
  const sel = isReq ? "id,contact_email,client_phone,created_at" : "id,booking_ref,client_email,client_phone,created_at";
  const match = (rows: Array<Record<string, unknown>>): Link | null => {
    for (const r of rows) {
      const re = normEmail(r[emailCol]);
      const rp = normPhone(r.client_phone);
      const e = email && re === email ? re : null;
      const p = phone && rp && samePhone(phone, rp) ? rp : null;
      if (e || p) {
        return isReq
          ? { email: e, phone: p, request_id: Number(r.id) || requestId, booking_ref: bookingRef }
          : { email: e, phone: p, request_id: requestId, booking_ref: String(r.booking_ref || r.id || bookingRef || "") || null };
      }
    }
    return null;
  };
  const claimed = isReq ? !!requestId : !!bookingRef;
  if (claimed) {
    const key = isReq ? `id=eq.${requestId}` : UUID_RE.test(String(bookingRef)) ? `id=eq.${encodeURIComponent(String(bookingRef))}` : `booking_ref=eq.${encodeURIComponent(String(bookingRef))}`;
    const rows = await readRows(`${table}?${key}&created_at=gte.${since(LINK_BY_ID_MS)}&select=${sel}&limit=1`);
    if (!rows) return { unread: `${table} lookup failed`, claimed };
    const m = match(rows);
    if (m) return { link: m, claimed };
  }
  const ors = [
    ...(email ? [`${emailCol}.eq.${encodeURIComponent(email)}`] : []),
    ...(phone ? [`client_phone.eq.${encodeURIComponent("+" + phone)}`, `client_phone.eq.${phone}`] : []),
  ];
  const rows = await readRows(`${table}?or=(${ors.join(",")})&created_at=gte.${since(LINK_RECENT_MS)}&order=created_at.desc&select=${sel}&limit=10`);
  if (!rows) return { unread: `${table} lookup failed`, claimed };
  const m = match(rows);
  return m ? { link: m, claimed } : { claimed };
}

async function choice(body: Record<string, unknown>, req: Request, h: Record<string, string>): Promise<Response> {
  const action = body.choice;
  if (action !== "yes" && action !== "no") return out({ ok: false, error: "choice" }, 400, h);
  const source = String(body.source || "");
  if (!CHOICE_SOURCES.includes(source)) return out({ ok: false, error: "source" }, 400, h);
  const wording = typeof body.wording === "string" ? body.wording.trim() : "";
  if (!wording || wording.length > 2000) return out({ ok: false, error: "wording" }, 400, h);
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
  // The words must be the approved notice: the row is our proof of what the
  // person saw, so a page whose copy has drifted is refused, and Jordan hears.
  const wl = approvedLang(wording);
  if (!wl) {
    await driftAlert({ action, source, wording, wording_lang: null, request_id: requestId, booking_ref: bookingRef }, "The page sent words that are not the approved notice, so the answer was refused. Check the page's copy against APPROVED_WORDING in the consent function.");
    return out({ ok: false, error: "wording" }, 400, h);
  }
  const lang = wl;
  const ip = await ipHash(req);
  if (await tooMany(ip)) return out({ ok: false, error: "rate" }, 429, h);
  let email: string | null = null, phone: string | null = null, name = "", userId: string | null = null;
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
    if (source === "review_page") return out({ ok: false, error: "token" }, 400, h);
    if (body.email !== undefined && body.email !== null && body.email !== "") {
      email = normEmail(body.email);
      if (!email) return out({ ok: false, error: "email" }, 400, h);
    }
    if (body.phone !== undefined && body.phone !== null && body.phone !== "") {
      phone = normPhone(body.phone);
      if (!phone) return out({ ok: false, error: "phone" }, 400, h);
    }
    if (!email && !phone) return out({ ok: false, error: "contact" }, 400, h);
    if (source === "profile") {
      // The account says who this is: its own email and id, never the body's.
      const jwt = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "")?.[1] || "";
      const user = jwt ? await authUser(jwt) : "invalid";
      if (user === null) {
        await alertFounder({ action, source, wording, wording_lang: lang, email, phone, booking_ref: null, request_id: null, channel: CHANNEL, ip_hash: ip }, "Supabase Auth could not be asked who is signed in, so the profile answer was not saved.");
        return out({ ok: false }, 500, h);
      }
      if (user === "invalid") return out({ ok: false, error: "session" }, 403, h);
      if (!user.email || (email && email !== user.email)) return out({ ok: false, error: "not_linked" }, 403, h);
      email = user.email; phone = null; userId = user.id;
    }
    if (REQUEST_SOURCES.includes(source) || BOOKING_SOURCES.includes(source)) {
      const l = await linkChoice(source, email, phone, requestId, bookingRef);
      if (l.unread) {
        if (!isTestContact({ email, phone })) await alertFounder({ action, source, wording, wording_lang: lang, email, phone, booking_ref: bookingRef, request_id: requestId, channel: CHANNEL, ip_hash: ip }, `${l.unread}, so the answer could not be tied to its ${REQUEST_SOURCES.includes(source) ? "request" : "booking"} and was not saved.`);
        return out({ ok: false }, 500, h);
      }
      if (!l.link) {
        // Nothing we hold ties this address to a request or booking. When the
        // page named one, its links have drifted from this function: say so.
        if (l.claimed && !isTestContact({ email, phone })) await driftAlert({ action, source, wording, wording_lang: lang, email, phone, booking_ref: bookingRef, request_id: requestId }, "The answer named a request or booking that does not carry this email or phone, so it was refused.");
        return out({ ok: false, error: "not_linked" }, 403, h);
      }
      ({ email, phone } = l.link);
      requestId = l.link.request_id;
      bookingRef = l.link.booking_ref;
    }
  }
  if (!email && !phone) return out({ ok: false, error: "contact" }, body.token ? 422 : 400, h);
  const row: Row = { email, phone, user_id: userId, source, booking_ref: bookingRef, request_id: requestId, channel: CHANNEL, action, wording, wording_lang: lang, ip_hash: ip };
  return await save([row], h, isTestContact({ email, phone, name }));
}

// Every other address seen with this one: the phone that came with an email
// (or the email that came with a phone) in an earlier answer, a request or a
// booking. unread names the lookups that failed.
async function linkedAddresses(u: string): Promise<{ emails: string[]; phones: string[]; unread: string[] }> {
  const isEmail = u.includes("@");
  const emails = new Set<string>(), phones = new Set<string>(), unread: string[] = [];
  const pOr = `or=(client_phone.eq.${encodeURIComponent("+" + u)},client_phone.eq.${u})`;
  const asks: Array<[string, string, string]> = isEmail
    ? [
      ["marketing_optins", `marketing_optins?email=eq.${encodeURIComponent(u)}&phone=not.is.null&select=phone&limit=50`, "phone"],
      ["whatsapp_requests", `whatsapp_requests?contact_email=ilike.${encodeURIComponent(u)}&client_phone=not.is.null&select=client_phone&limit=50`, "client_phone"],
      ["bookings", `bookings?client_email=ilike.${encodeURIComponent(u)}&client_phone=not.is.null&select=client_phone&limit=50`, "client_phone"],
    ]
    : [
      ["marketing_optins", `marketing_optins?phone=eq.${u}&email=not.is.null&select=email&limit=50`, "email"],
      ["whatsapp_requests", `whatsapp_requests?${pOr}&contact_email=not.is.null&select=contact_email&limit=50`, "contact_email"],
      ["bookings", `bookings?${pOr}&client_email=not.is.null&select=client_email&limit=50`, "client_email"],
    ];
  for (const [name, path, col] of asks) {
    const rows = await readRows(path);
    if (!rows) { unread.push(name); continue; }
    for (const r of rows) {
      const v = isEmail ? normPhone(r[col]) : normEmail(r[col]);
      if (v && v !== u) (isEmail ? phones : emails).add(v);
    }
  }
  return { emails: [...emails].slice(0, MAX_LINKED), phones: [...phones].slice(0, MAX_LINKED), unread };
}

async function withdraw(body: Record<string, unknown>, req: Request, h: Record<string, string>): Promise<Response> {
  const raw = String(body.u ?? "").trim();
  const sig = String(body.s || "").toLowerCase();
  if (!raw) return out({ ok: false, error: "u" }, 400, h);
  if (!/^[0-9a-f]{32}$/.test(sig)) return out({ ok: false, error: "signature" }, 403, h);
  const sealed = TOKEN_RE.test(raw);
  const plain = sealed ? null : normContact(raw);
  if (!sealed && !plain) return out({ ok: false, error: "u" }, 400, h);
  const lang = typeof body.lang === "string" && /^[a-z]{2}$/i.test(body.lang) ? body.lang.toLowerCase() : "en";
  const pageWording = typeof body.wording === "string" ? body.wording.trim().slice(0, 2000) : "";
  const wording = pageWording || UNSUB_WORDING[lang] || UNSUB_WORDING.en;
  const wordingLang = pageWording ? lang : (UNSUB_WORDING[lang] ? lang : "en");
  const ip = await ipHash(req);
  const rowFor = (a: string): Row => ({ email: a.includes("@") ? a : null, phone: a.includes("@") ? null : a, user_id: null, source: "unsubscribe", booking_ref: null, request_id: null, channel: CHANNEL, action: "withdraw", wording, wording_lang: wordingLang, ip_hash: ip });
  if (!SIGN_KEY) {
    // A person asked to stop and we cannot even check the link. Loud.
    const r: Partial<Row> = plain ? rowFor(plain) : { action: "withdraw", source: "unsubscribe", wording, wording_lang: wordingLang };
    if (!plain || !isTestContact({ email: r.email, phone: r.phone })) await alertFounder(r, "MC_SIGN_KEY is not set on the consent function, so no unsubscribe link can be checked or opened. Set it, then ask the person to tap the link again.");
    return out({ ok: false }, 500, h);
  }
  let u: string | null;
  if (sealed) {
    if (!sameHex(sig, await signToken(raw, SIGN_KEY))) return out({ ok: false, error: "signature" }, 403, h);
    u = await openContact(raw, SIGN_KEY);
    if (!u) return out({ ok: false, error: "signature" }, 403, h);
  } else {
    u = plain as string;
    if (!sameHex(sig, await signContact(u, SIGN_KEY))) {
      // A well-formed address whose link does not check: most likely a sender
      // that signed it un-normalised. The person still asked to stop.
      if (!isTestContact({ email: u.includes("@") ? u : null, phone: u.includes("@") ? null : u })) await driftAlert(rowFor(u), "An unsubscribe link for this address failed its signature check (signed in another form, or with another key). They were told to write to support@massageclub.io; record the withdraw by hand if they meant it.");
      return out({ ok: false, error: "signature" }, 403, h);
    }
  }
  return await withdrawAll(u, rowFor, h);
}

// The page promises "by email or WhatsApp", so every address of theirs we
// know of is withdrawn too, not only the one given.
async function withdrawAll(u: string, rowFor: (a: string) => Row, h: Record<string, string>): Promise<Response> {
  const test = isTestContact({ email: u.includes("@") ? u : null, phone: u.includes("@") ? null : u });
  const linked = await linkedAddresses(u);
  const rows = [rowFor(u), ...linked.emails.map(rowFor), ...linked.phones.map(rowFor)];
  const res = await save(rows, h, test);
  if (res.status === 200 && linked.unread.length && !test) {
    await alertFounder(rows[0], `The unsubscribe was saved for this address, but its other addresses could not be looked up (${linked.unread.join(", ")}). Add a withdraw row by hand for any other email or phone of this person.`, { after: true });
  }
  return res;
}

// /unsubscribe without a link: the address the person typed.
async function typedStop(body: Record<string, unknown>, req: Request, h: Record<string, string>): Promise<Response> {
  const u = normContact(body.u);
  if (!u) return out({ ok: false, error: "u" }, 400, h);
  const ip = await ipHash(req);
  if (await tooMany(ip)) return out({ ok: false, error: "rate" }, 429, h);
  const lang = typeof body.lang === "string" && /^[a-z]{2}$/i.test(body.lang) ? body.lang.toLowerCase() : "en";
  const pageWording = typeof body.wording === "string" ? body.wording.trim().slice(0, 2000) : "";
  const wording = pageWording || UNSUB_WORDING[lang] || UNSUB_WORDING.en;
  const wordingLang = pageWording ? lang : (UNSUB_WORDING[lang] ? lang : "en");
  const rowFor = (a: string): Row => ({ email: a.includes("@") ? a : null, phone: a.includes("@") ? null : a, user_id: null, source: "unsubscribe", booking_ref: null, request_id: null, channel: CHANNEL, action: "withdraw", wording, wording_lang: wordingLang, ip_hash: ip });
  return await withdrawAll(u, rowFor, h);
}

async function save(rows: Row[], h: Record<string, string>, test: boolean): Promise<Response> {
  let why = "";
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/marketing_optins`, { method: "POST", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify(rows.length === 1 ? rows[0] : rows) });
    if (!r.ok) why = `HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 300)}`;
  } catch (e) { why = String(e).slice(0, 300); }
  if (!why) return out(test ? { ok: true, test: true } : { ok: true }, 200, h);
  const row = rows[0];
  console.log(`[consent] NOT saved (${row.source} ${row.action}${test ? ", test contact" : ""}): ${why}`);
  if (!test) await alertFounder(row, why, { others: rows.slice(1).map((x) => x.email || (x.phone ? "+" + x.phone : "")).filter(Boolean) });
  return out(test ? { ok: false, test: true } : { ok: false }, 500, h);
}

// One short email to Jordan for every answer that could not be written. Until
// it is written, that person counts as not answered, so nothing promotional
// goes to them; the alert is there so a yes, or a withdrawal, is not lost.
export function alertText(row: Partial<Row>, why: string, o: { token?: boolean; drift?: boolean; after?: boolean; others?: string[] } = {}): { subject: string; text: string } {
  const what = row.action === "withdraw" ? "An unsubscribe" : `A "${row.action}" to offers`;
  const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const who = [row.email, row.phone ? "+" + row.phone : ""].filter(Boolean).join(", ")
    || (o.token ? "a review page link (the booking could not be read)" : row.action === "withdraw" ? "a sealed unsubscribe link (the address cannot be read without the key)" : "unknown");
  const head = o.after ? `${what} was saved, with one gap (${when}, Madrid time).`
    : o.drift ? `${what} from ${row.source} was refused (${when}, Madrid time).`
    : `${what} from ${row.source} was NOT saved (${when}, Madrid time).`;
  const lines = [
    head,
    "",
    `${o.drift || o.after ? "Why" : "Database answer"}: ${why}`,
    "",
    `Who: ${who}`,
    ...(o.others && o.others.length ? [`Their other addresses: ${o.others.join(", ")}`] : []),
    ...(row.booking_ref ? [`Booking: ${row.booking_ref}`] : []),
    ...(row.request_id ? [`Request: #${row.request_id}`] : []),
    `Words shown (${row.wording_lang || "?"}): "${String(row.wording || "").slice(0, 400)}"`,
    "",
    row.action === "withdraw"
      ? "What to do: add a withdraw row for each of these addresses in marketing_optins by hand (the SQL is in the consent function's header), and send them nothing promotional."
      : o.drift
      ? "What to do: nothing was saved, so this person counts as not answered and gets no offers. Fix the page if its copy or links changed."
      : "What to do: add the row by hand in marketing_optins (Supabase), with the words above. Until then this person counts as not answered and gets no offers.",
    "",
    "The consent function",
  ];
  const subject = o.after ? `Unsubscribe saved, other addresses not checked`
    : o.drift ? `Consent refused: ${row.action} from ${row.source}`
    : `Consent NOT saved: ${row.action} from ${row.source}`;
  return { subject, text: lines.join("\n") };
}
async function alertFounder(row: Partial<Row>, why: string, o: { token?: boolean; drift?: boolean; after?: boolean; others?: string[] } = {}): Promise<void> {
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

export function start(cfg: { resendKey?: string; signKey?: string; ipKey?: string } = {}) {
  if (cfg.resendKey) RESEND_API_KEY = cfg.resendKey;
  if (cfg.signKey) SIGN_KEY = cfg.signKey;
  if (cfg.ipKey) IP_KEY = cfg.ipKey;
  Deno.serve(handleRequest);
}
