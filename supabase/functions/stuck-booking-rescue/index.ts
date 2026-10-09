// stuck-booking-rescue — when a booking has been waiting too long, NOBODY sits
// in silence: the customer hears from us, the studio gets re-nudged, and the
// net widens. Runs every 30 min by cron.
// v3: matching moved into match_studios() SQL. v4: support@ everywhere.
// v5 (31 Aug, "timers on every waiting state"):
//   A. Customers WITH email + stuck 1-24h  → alternatives email (as before).
//   B. Customers WITHOUT email + stuck 1-24h → the same three alternatives as
//      a WhatsApp interactive list (only inside their 24h service window),
//      session pre-armed so a tap books through the normal bot flow.
//   C. Studios silent 2h+ on studio_asked → ONE WhatsApp re-nudge with the
//      solicitud_reserva template (marks nudged_at).
//   D. Studios silent 4h+ → widen: offer-email the next 3 bookable studios
//      not yet asked (marks followup_sent_at, appends stage_note).
//   All sends only 09:00-21:00 Madrid. Test contacts never touched.
// v6: match falls back to all-Madrid when the customer's area has nothing
//   bookable (same as notify), and alternatives never re-offer studios that
//   were already asked (stage_note filter).
// v7: E. Mid-flow abandoners — sessions parked in a booking step 2-23h with
//   no request yet get ONE gentle nudge ever (data.flowNudged), in their
//   language, with the website link. Never test numbers, never blocked,
//   never anyone already in the request pipeline (those have timers A-D).
// v8 (5 Sept): a customer who said "No" or "Cancelar" in the last 24h, or
//   whose request carries customer_flag cancelled/change_requested, is left
//   alone by every timer. A session sitting on a live offer, a booking
//   check-in or a change request is never overwritten. On 4 Sept Anderson
//   cancelled and this job sent him alternatives anyway.
// v9 (6 Sept): the "said no" guard understands English goodbyes ("I'm not
//   going to be having any massage", "leaving Madrid", "no longer"), and a
//   customer with ANY request cancelled in the last 24h is left alone on all
//   of them. On 6 Sept Mateo cancelled in plain English on Saturday night and
//   still got an alternatives list on Sunday evening, 44 seconds before his
//   last open row was closed.
// v10 (10 Sept, "a promise outranks a timer"): if the bot told someone "I am
//   finding out for you now" and nobody has come back with the answer, NO
//   timer talks to them. On 9 Sept at 21:11 an Instagram lead asked "Who give
//   the Massage ?", the bot promised an answer, and the next thing they heard
//   from us was this job's generic come-back nudge at 09:00 the next morning,
//   which ignored the question completely. That is the same failure as sending
//   a service menu to someone who asked which metro stop: the machinery talks
//   over the person. Instead the customer hears nothing until there is a real
//   answer, and Jordan gets an email naming them and the hour their 24h
//   WhatsApp window shuts, because after that the answer cannot be sent at all.
// v12 (8 Oct): the fake 3460000xxxx test numbers are test phones; "Rescue
//   acted" is logged to funnel_events instead of emailed; the owed-answer
//   email goes out once per person per 20 hours.
// v13 (9 Oct): the flow nudge no longer carries the website link (links go
//   only to people who ask what the service is; it went to 97 of 139 chats),
//   and the owed-answer check also knows wa-bot v188's reworded promise.
//   GET ?key=<CRON_KEY>[&dry=1][&id=<request id>]

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
// v13: no secrets in this file, because the repo is public. The deployed
// function is a short loader that pins one commit of this file and passes the
// keys to start(), the same way dispatch-studios does.
let CRON_KEY = "";
let RESEND_API_KEY = "";
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const FOUNDER = ["support@massageclub.io"];
const REPLY_TO = "support@massageclub.io";
const LOGO_URL = "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/branding/mc-avatar-cream.png";
const APP = "https://book.massageclub.io";
const WA = "34612474827";
let WA_TOKEN = "";
let PHONE_ID = "1270437552818077";
let GRAPH = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;

const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu"];
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
const digitsOf = (s: string) => String(s || "").replace(/[^0-9]/g, "");
const isTestPhone = (p?: string | null) => {
  const d = digitsOf(p || "");
  if (d === "15622355063" || d === "17867276503" || d === "34612474827") return true;
  if (d.startsWith("86") && d.endsWith("997")) return true;
  if (/^3460000\d{4}$/.test(d)) return true;
  return false;
};

// v8: "No" means no. Anyone who answered a nudge, an offer or a check-in with a
// no or a cancel in the last day is not touched again by a job; a person decides.
// v9: English goodbyes count too.
const SAID_NO_RE = /^(no|nope|nah|no gracias|no thanks|not now|ahora no|cancel|cancela|cancelar|cancelo|cancelled|canceled|anular|anula|stop|basta|para|d[eé]jalo|ya no|no quiero|no hace falta|olv[ií]dalo|forget it|never ?mind)\b/i;
const NO_INSIDE_RE = /\b(cancel(a|ar|o|ad[oa]|led|ed)?|anular|ya no (quiero|puedo|me interesa)|no quiero|no me interesa|dejadme|d[eé]jame en paz|stop|not going to|won'?t be|no longer|not having|not interested|leaving madrid|don'?t need|no need|not (any ?more|anymore)|any massage)\b/i;
async function customerSaidNo(phone: string, H: Record<string, string>): Promise<boolean> {
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${phone}&direction=eq.in&order=created_at.desc&limit=3&select=body,created_at`, { headers: H })).json().catch(() => []);
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  for (const m of (Array.isArray(rows) ? rows : [])) {
    if (Date.parse(m.created_at) < dayAgo) break;
    const t = String(m.body || "").trim().replace(/[.!¡¿?’']/g, (c) => (c === "’" ? "'" : c === "'" ? "'" : ""));
    if (SAID_NO_RE.test(t) || NO_INSIDE_RE.test(t)) return true;
  }
  return false;
}
// v9: a customer who cancelled one request in the last day is left alone on
// every request, whatever stage the others are in.
async function customerCancelledAny(phone: string, H: Record<string, string>): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=ilike.*${phone}&or=(customer_flag.eq.cancelled,stage.eq.cancelled)&stage_updated_at=gt.${since}&select=id&limit=1`, { headers: H })).json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

// v10: the bot's "I am finding out for you now" line, in both languages. These
// are anchors from wa-bot copy.ts willFindOut, matched loosely enough to
// survive small wording edits but not so loosely they catch ordinary copy.
// v13 (9 Oct): wa-bot v188 reworded willFindOut; both wordings count.
const WILL_FIND_OUT_RE = /(I am finding out for you now|rather check than guess|lo consulto ahora mismo y te digo|Prefiero confirmarlo antes que|the answer will come here|y la respuesta te llega por aqu)/i;
// A question the bot could not answer means a person owes this customer a
// reply. Until that reply exists, every automated message to them is noise at
// best and a broken promise at worst. Returns when the promise was made and
// whether anything has been said to them since.
async function owedAnAnswer(phone: string, H: Record<string, string>): Promise<{ promisedAt: string } | null> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${phone}&direction=eq.out&created_at=gt.${since}&order=created_at.desc&limit=30&select=body,created_at`, { headers: H })).json().catch(() => []);
  for (const m of (Array.isArray(rows) ? rows : [])) {
    if (WILL_FIND_OUT_RE.test(String(m.body || ""))) return { promisedAt: m.created_at };
  }
  return null;
}

// Sessions the bot is holding for an answer. A rescue list on top of a live
// offer or a booking check-in would swallow the customer's tap.
const PROTECTED_STEPS = ["await_offer", "await_reconfirm", "await_change", "human", "blocked"];

const madridHour = (): number => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date()));
const madridStamp = (iso: string): string => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const SVC_ES: Array<[RegExp, string]> = [
  [/deep tissue/i, "Masaje descontracturante"], [/thai/i, "Masaje tailandés"],
  [/hot stone/i, "Masaje de piedras calientes"], [/sport/i, "Masaje deportivo"],
  [/balin/i, "Masaje balinés"], [/shiatsu/i, "Shiatsu"], [/reflexolog/i, "Reflexología"],
  [/lymphatic/i, "Drenaje linfático"], [/couples/i, "Masaje en pareja"],
  [/kobido/i, "Masaje facial Kobido"], [/relax|stress/i, "Masaje relajante"],
  [/not sure|^massage$|massage treatment/i, "Masaje"],
];
const svcEs = (n?: string | null): string => {
  const s = String(n || "");
  for (const [re, v] of SVC_ES) if (re.test(s)) return v;
  return s || "Masaje";
};

const C = { page: "#F1EBE2", ink: "#262019", muted: "#8A7F73", clay: "#B85C38", cream: "#FAF6F0", line: "#F0E9E0", dash: "#E4D9CB" };
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Opt = { id: string; business_name: string; slug: string; area: string; google_rating: any; google_reviews: any; venue_type: string; wa: string; svc: string; duration: number; price: number };

function areaFromText(r: any): string {
  const m1 = String(r.studio_name || "").match(/\(([^)]+)\)/);
  if (m1 && m1[1] && !/por asignar/i.test(m1[1])) return m1[1].trim();
  const m2 = String(r.message_text || "").match(/Zona:\s*([^|]+)/i);
  if (m2 && m2[1]) return m2[1].trim();
  return "";
}

async function resolveArea(r: any, H: Record<string, string>): Promise<string> {
  const a = areaFromText(r);
  if (a) return a;
  if (r.partner_id) {
    const own = await (await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${r.partner_id}&select=neighbourhood,city`, { headers: H })).json().catch(() => []);
    if (Array.isArray(own) && own[0]) return String(own[0].neighbourhood || own[0].city || "").trim();
  }
  return "";
}

async function rpcMatch(r: any, H: Record<string, string>, area: string | null, limit: number): Promise<Opt[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_studios`, {
    method: "POST", headers: H,
    body: JSON.stringify({ p_area: area, p_want: r.service_name || null, p_exclude: r.partner_id || null, p_limit: limit }),
  });
  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows)) { console.log("[rescue] match_studios error", JSON.stringify(rows).slice(0, 200)); return []; }
  return rows as Opt[];
}

// Area first, all-Madrid fallback — same behaviour as notify-whatsapp-request.
async function matchStudios(r: any, H: Record<string, string>, limit = 3): Promise<{ picks: Opt[]; area: string }> {
  const area = await resolveArea(r, H);
  let picks = await rpcMatch(r, H, area || null, limit);
  if (!picks.length && area) picks = await rpcMatch(r, H, null, limit);
  return { picks, area };
}

// Compact copy of the one-tap studio offer email from notify-whatsapp-request.
function offerEmail(r: any, timeLabels: string[], pfx: string, claimSlug: string) {
  const price = r.price ? `€${r.price}` : "";
  const svcTitle = svcEs(r.service_name);
  const tapUrl = (p: string) => `${SUPABASE_URL}/functions/v1/studio-times?t=${r.offer_token}&pick=${p}${pfx}`;
  const btn = timeLabels.map((w, i) => w ? `<a href="${tapUrl(String(i + 1))}" style="display:block;background:#1A9C56;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 18px;border-radius:999px;margin:0 0 10px;text-align:center;">✅ ${esc(w)}</a>` : "").join("");
  const claimLine = claimSlug ? `<p style="margin:16px 0 0;color:${C.muted};font-size:12px;line-height:1.6;text-align:center;">Somos Massage Club: clientes internacionales que reservan en inglés. Coste 0 y, de momento, sin comisión: el cliente paga en el centro. ¿Más clientes así? <a href="${APP}/claim/${claimSlug}" style="color:${C.clay};font-weight:700;text-decoration:none;">Vuestra página gratis →</a></p>` : "";
  const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;"><tr><td style="padding:26px 34px 0;text-align:center;"><img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;"><p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p></td></tr><tr><td style="padding:26px 34px 0;text-align:center;"><span style="display:inline-block;background:${C.cream};color:${C.clay};font-size:11px;font-weight:700;letter-spacing:2.5px;padding:7px 16px;border-radius:999px;">CLIENTE PARA VOSOTROS</span><h1 style="margin:16px 0 0;color:${C.ink};font-size:26px;line-height:1.2;font-family:${SERIF};font-weight:700;">${esc(svcTitle)}${price ? ` · ${price}` : ""}</h1><p style="margin:10px 0 0;color:${C.muted};font-size:14px;line-height:1.6;">Tenemos un cliente que quiere reservar${r.first_name ? ` (${esc(r.first_name)})` : ""}. Elegid la hora que os venga bien (<b>un solo clic, sin registro</b>) y el cliente recibe la confirmación al momento.</p></td></tr><tr><td style="padding:24px 34px 0;">${btn}<a href="${tapUrl("none")}" style="display:block;background:${C.cream};color:#B91C1C;font-size:13px;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:999px;text-align:center;border:1px solid ${C.line};">Ninguna me va bien</a></td></tr><tr><td style="padding:8px 34px 26px;">${claimLine}<div style="border-top:2px dashed ${C.dash};margin:18px 0 14px;"></div><p style="margin:0;color:#B8AC9E;font-size:12px;text-align:center;">Massage Club · Madrid · <a href="${APP}" style="color:${C.clay};text-decoration:none;">book.massageclub.io</a></p></td></tr></table></td></tr></table>`;
  const text = [`Cliente para vosotros: ${svcTitle}${price ? " " + price : ""}${r.first_name ? ", " + r.first_name : ""}.`, `Elegid hora (1 clic):`, ...timeLabels.map((w, i) => w ? `${w}: ${tapUrl(String(i + 1))}` : "").filter(Boolean), `Ninguna me va bien: ${tapUrl("none")}`].join("\n");
  const subject = `Cliente para vosotros: ${svcTitle.toLowerCase()}, elegid hora (1 clic)`;
  return { html, text, subject };
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const key = req.headers.get("x-cron-key") || url.searchParams.get("key") || "";
  if (!CRON_KEY || key !== CRON_KEY) return new Response("forbidden", { status: 403 });
  const dry = url.searchParams.get("dry") === "1";
  const only = url.searchParams.get("id");

  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const H = { apikey: svcKey, Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json" };

  const hour = madridHour();
  const quietHours = hour < 9 || hour >= 21;
  if (quietHours && !dry && !only) return new Response(JSON.stringify({ ok: true, skipped: "outside 09-21 Madrid" }), { headers: { "Content-Type": "application/json" } });

  const now = Date.now();
  const cutStuck = new Date(now - 60 * 60 * 1000).toISOString();
  const cutMax = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const cut2h = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const cut4h = new Date(now - 4 * 60 * 60 * 1000).toISOString();
  const sel = "id,first_name,contact_email,client_phone,service_name,studio_name,message_text,partner_id,day1,time1,day2,time2,day3,time3,price,languages,offer_token,stage,stage_note,customer_flag,nudged_at,nudge_count,followup_sent_at,alternatives_sent_at,studio_asked_at,created_at";

  // v10: everyone this run declined to talk to because we owe them an answer.
  const owedReport: any[] = [];

  const q = only
    ? `${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${only}&select=${sel}`
    : `${SUPABASE_URL}/rest/v1/whatsapp_requests?stage=in.(new,studio_asked,studio_replied,offered)&created_at=lt.${cutStuck}&created_at=gt.${cutMax}&select=${sel}&order=created_at.asc&limit=15`;
  const rows = await (await fetch(q, { headers: H })).json().catch(() => []);
  const due0 = (Array.isArray(rows) ? rows : []).filter((r: any) => !isTestContact(r.contact_email, r.first_name) && !isTestPhone(r.client_phone) && !["cancelled", "change_requested"].includes(String(r.customer_flag || "")));
  // v8: anyone who said no or cancel in the last day is left alone by every timer.
  // v9: so is anyone with a cancelled request in the last day.
  const due: any[] = [];
  const leftAlone: any[] = [];
  for (const r of due0) {
    const ph = digitsOf(r.client_phone || "");
    if (ph && await customerSaidNo(ph, H)) { leftAlone.push({ id: r.id, name: r.first_name, why: "customer said no or cancel in the last 24h" }); console.log(`[rescue] #${r.id} left alone: customer said no`); continue; }
    if (ph && await customerCancelledAny(ph, H)) { leftAlone.push({ id: r.id, name: r.first_name, why: "customer cancelled another request in the last 24h" }); console.log(`[rescue] #${r.id} left alone: sibling cancelled`); continue; }
    due.push(r);
  }

  const report: any[] = [];

  for (const r of due) {
    const entry: any = { id: r.id, name: r.first_name, stage: r.stage, actions: [] };
    const askedNote = String(r.stage_note || "").toLowerCase();

    // ---------- C. Studio re-nudge at 2h ----------
    if (!dry && r.stage === "studio_asked" && !r.nudged_at && r.studio_asked_at && r.studio_asked_at < cut2h) {
      const names = String(r.stage_note || "").match(/auto-offered to:\s*([^;]+)/i)?.[1]?.split(",").map((s: string) => s.trim()).filter(Boolean) || [];
      if (r.partner_id && !names.length && r.studio_name && !/por asignar/i.test(r.studio_name)) names.push(r.studio_name);
      let nudgedAny = false;
      for (const nm of names.slice(0, 3)) {
        const ps = await (await fetch(`${SUPABASE_URL}/rest/v1/partners?business_name=eq.${encodeURIComponent(nm)}&select=id,business_name,whatsapp,phone,opted_out_at&limit=1`, { headers: H })).json().catch(() => []);
        const p = Array.isArray(ps) && ps[0] ? ps[0] : null;
        if (!p || p.opted_out_at) continue;
        let waNum = digitsOf(p.whatsapp || p.phone || "");
        if (waNum.length === 9 && /^[67]/.test(waNum)) waNum = "34" + waNum;
        if (!waNum || waNum.length < 11) continue;
        const p1 = `${svcEs(r.service_name)}${r.price ? ` · ${r.price} EUR` : ""}`;
        const p2 = `${[r.day1, r.time1].filter(Boolean).join(", ")}${r.time2 ? ` (o ${r.time2})` : ""}` || "Por concretar";
        const p3 = String(r.first_name || "Cliente").split(" ")[0];
        const res = await fetch(GRAPH, {
          method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp", to: waNum, type: "template",
            template: {
              name: "solicitud_reserva", language: { code: "es" },
              components: [
                { type: "body", parameters: [{ type: "text", text: p1 }, { type: "text", text: p2 }, { type: "text", text: p3 }] },
                { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: `studio_confirm_${r.id}` }] },
                { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: `studio_other_${r.id}` }] },
              ],
            },
          }),
        });
        console.log(`[rescue] studio nudge #${r.id} -> ${p.business_name} (${waNum}) status=${res.status}`);
        if (res.ok) nudgedAny = true;
      }
      if (nudgedAny) {
        await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${r.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ nudged_at: new Date().toISOString(), nudge_count: (Number(r.nudge_count) || 0) + 1 }) });
        entry.actions.push("studio re-nudged on WhatsApp");
      }
    }

    // ---------- D. Widen at 4h ----------
    if (!dry && r.stage === "studio_asked" && !r.partner_id && !r.followup_sent_at && r.offer_token && r.studio_asked_at && r.studio_asked_at < cut4h) {
      const m = await matchStudios(r, H, 6);
      const fresh = m.picks.filter((o) => !askedNote.includes(o.business_name.toLowerCase())).slice(0, 3);
      const widened: string[] = [];
      if (fresh.length) {
        const ids = fresh.map((o) => o.id).join(",");
        const eRows = await (await fetch(`${SUPABASE_URL}/rest/v1/partners?id=in.(${ids})&select=id,email,opted_out_at,outreach_status,status,slug`, { headers: H })).json().catch(() => []);
        const byId: Record<string, any> = {};
        for (const p of (Array.isArray(eRows) ? eRows : [])) byId[p.id] = p;
        const when1 = [r.day1, r.time1].filter(Boolean).join(" ");
        const when2 = [r.day2, r.time2].filter(Boolean).join(" ");
        const when3 = [r.day3, r.time3].filter(Boolean).join(" ");
        for (const o of fresh) {
          const p = byId[o.id];
          if (!p || !p.email || p.opted_out_at || p.outreach_status === "bounced") continue;
          const mail = offerEmail(r, [when1, when2, when3], `&p=${o.id}`, p.status !== "active" && p.slug ? p.slug : "");
          const sRes = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM_EMAIL, to: [p.email], reply_to: REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text }) });
          console.log(`[rescue] widen #${r.id} -> ${o.business_name}: status=${sRes.status}`);
          if (sRes.ok) widened.push(o.business_name);
        }
      }
      if (widened.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${r.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ followup_sent_at: new Date().toISOString(), stage_note: `${r.stage_note || ""}; widened to: ${widened.join(", ")}` }) });
        entry.actions.push(`widened to: ${widened.join(", ")}`);
      }
    }

    // ---------- A + B. Customer alternatives after 1h of silence ----------
    if (!r.alternatives_sent_at) {
      const m = await matchStudios(r, H, 6);
      const picks = m.picks.filter((o) => !askedNote.includes(o.business_name.toLowerCase())).slice(0, 3);
      if (dry) { entry.actions.push({ dryPicks: picks.map((o) => o.business_name) }); report.push(entry); continue; }
      if (picks.length) {
        const es = String(r.languages || "").toLowerCase().startsWith("es");
        const name = String(r.first_name || "").split(" ")[0];
        // v10: a promise outranks a timer, on the email path as well as WhatsApp.
        const phOwe = digitsOf(r.client_phone || "");
        const owe = phOwe ? await owedAnAnswer(phOwe, H) : null;
        if (owe) {
          owedReport.push({ who: `#${r.id} ${r.first_name || ""}`.trim(), phone: phOwe, promisedAt: owe.promisedAt, context: `request ${r.stage}` });
          console.log(`[rescue] #${r.id} left alone: still owed an answer promised at ${owe.promisedAt}`);
          if (entry.actions.length) report.push(entry);
          continue;
        }

        if (r.contact_email) {
          // A. Email path (v4 behaviour, kept).
          const nums = ["1️⃣", "2️⃣", "3️⃣"];
          const cards = picks.map((o, i) => `<tr><td style="padding:0 0 10px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:14px;background:${C.cream};"><tr><td style="padding:13px 16px;"><p style="margin:0;color:${C.ink};font-size:15px;font-weight:700;font-family:${SANS};">${nums[i]} ${esc(o.business_name)}</p><p style="margin:3px 0 0;color:${C.muted};font-size:12.5px;">${esc(o.area)}${o.google_rating != null ? ` · ★ ${esc(String(o.google_rating))}${o.google_reviews != null ? ` (${esc(String(o.google_reviews))})` : ""}` : ""}</p><p style="margin:6px 0 0;color:${C.ink};font-size:13.5px;font-weight:600;">${esc(o.svc)} · ${o.duration} min · €${o.price}</p></td></tr></table></td></tr>`).join("");
          const waText = encodeURIComponent("Hi, about my massage request - I'd like option ");
          const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;"><tr><td style="padding:26px 34px 0;text-align:center;"><img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;"><p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p></td></tr><tr><td style="padding:24px 34px 0;text-align:center;"><h1 style="margin:0;color:${C.ink};font-size:25px;line-height:1.25;font-family:${SERIF};font-weight:700;">${name ? esc(name) + ", still" : "Still"} working on your booking</h1><p style="margin:12px 0 0;color:${C.ink};font-size:14.5px;line-height:1.65;">Your studio has not come back to us yet. Rather than leave you waiting, here are three places that can take you, with real prices.</p><p style="margin:8px 0 0;color:${C.muted};font-size:13px;line-height:1.6;">Tu centro todavía no nos ha contestado. Para no hacerte esperar, aquí tienes tres opciones con precios reales.</p></td></tr><tr><td style="padding:20px 34px 0;"><table width="100%" cellpadding="0" cellspacing="0">${cards}</table></td></tr><tr><td style="padding:6px 34px 0;text-align:center;"><a href="https://wa.me/${WA}?text=${waText}" style="display:inline-block;background:#1FA855;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:999px;">Reply 1, 2 or 3 on WhatsApp</a><p style="margin:10px 0 0;color:${C.muted};font-size:12.5px;">Or just reply to this email. · O responde a este email.</p></td></tr><tr><td style="padding:22px 34px 26px;"><div style="border-top:2px dashed ${C.dash};margin-bottom:14px;"></div><p style="margin:0;color:#B8AC9E;font-size:12px;text-align:center;">You pay the studio directly. No booking fee.<br>Pagas en el centro. Sin gastos de reserva.<br><a href="${APP}" style="color:${C.clay};text-decoration:none;">book.massageclub.io</a></p></td></tr></table></td></tr></table>`;
          const lines = picks.map((o, i) => `${i + 1}. ${o.business_name} · ${o.area} · ${o.svc} ${o.duration} min · €${o.price}`);
          const plain = [`${name ? name + ", still" : "Still"} working on your booking.`, `Your studio has not come back to us yet. Here are three places that can take you:`, ...lines, ``, `Reply 1, 2 or 3 here or on WhatsApp: https://wa.me/${WA}`, `You pay the studio directly. No booking fee.`].join("\n");
          const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM_EMAIL, to: [r.contact_email], reply_to: REPLY_TO, subject: "Still working on your massage, three options in the meantime", html, text: plain }) });
          console.log(`[rescue] email alternatives #${r.id} -> ${r.contact_email} status=${res.status}`);
          if (res.ok) {
            await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${r.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ alternatives_sent_at: new Date().toISOString() }) });
            entry.actions.push("customer emailed 3 alternatives");
          }
        } else if (r.client_phone) {
          // B. WhatsApp path for email-skippers — only inside their 24h window.
          const to = digitsOf(r.client_phone);
          const lastIn = await (await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${to}&direction=eq.in&order=created_at.desc&limit=1&select=created_at`, { headers: H })).json().catch(() => []);
          const lastInAt = Array.isArray(lastIn) && lastIn[0] ? Date.parse(lastIn[0].created_at) : 0;
          const inWindow = lastInAt > now - 23 * 60 * 60 * 1000;
          const sess = await (await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?phone=eq.${to}&select=step,data`, { headers: H })).json().catch(() => []);
          const s0 = Array.isArray(sess) && sess[0] ? sess[0] : null;
          // v8: never send a second alternatives list to the same number within a day,
          // whatever request it hung off. Anderson got eight on 4 Sept.
          const recentAlt = await (await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${to}&direction=eq.out&msg_type=eq.list&created_at=gt.${cutMax}&body=ilike.*${encodeURIComponent(es ? "Seguimos con tu reserva" : "Still working on your booking")}*&select=id&limit=1`, { headers: H })).json().catch(() => []);
          const alreadyListed = Array.isArray(recentAlt) && recentAlt.length > 0;
          const protectedStep = !!(s0 && PROTECTED_STEPS.includes(String(s0.step || "")));
          if (inWindow && !protectedStep && !alreadyListed) {
            const body = es
              ? `Seguimos con tu reserva${name ? `, ${name}` : ""}. Tu centro todavía no nos ha contestado, así que aquí tienes tres que sí pueden atenderte, con precios reales. Elige uno y se lo pedimos ahora mismo.`
              : `Still working on your booking${name ? `, ${name}` : ""}. Your studio has not replied yet, so here are three that can take you, with real prices. Pick one and we ask them right away.`;
            const rowsList = picks.map((o, i) => ({ id: `studio_${i}`, title: o.business_name.slice(0, 24), description: `${o.svc} ${o.duration} min · ${Number(o.price)} EUR${o.google_rating != null ? " · " + o.google_rating + "★" : ""}`.slice(0, 72) }));
            rowsList.push({ id: "studio_any", title: es ? "Cualquiera" : "Any of them", description: es ? "elegimos el mejor para ti" : "we pick the best fit" });
            const res = await fetch(GRAPH, {
              method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
              body: JSON.stringify({ messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "list", body: { text: body }, action: { button: es ? "Elegir centro" : "Choose studio", sections: [{ title: "Massage Club", rows: rowsList }] } } }),
            });
            console.log(`[rescue] wa alternatives #${r.id} -> ${to} status=${res.status}`);
            if (res.ok) {
              const data = (s0 && s0.data) || {};
              data.lang = es ? "es" : data.lang || "";
              data.known = { name: [r.first_name].filter(Boolean).join(" ") || null, email: null };
              data.picks = picks.map((o) => ({ id: o.id, slug: o.slug, name: o.business_name, svc: o.svc, price: o.price, duration: o.duration }));
              data.day = r.day1 || null; data.time = r.time1 || null; data.area = m.area || data.area || null;
              await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?on_conflict=phone`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ phone: to, step: "await_studio", data, updated_at: new Date().toISOString() }) });
              await fetch(`${SUPABASE_URL}/rest/v1/wa_messages`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ phone: to, direction: "out", msg_type: "list", body: body + " [" + rowsList.map((x) => x.title).join("/") + "]" }) });
              await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${r.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ alternatives_sent_at: new Date().toISOString() }) });
              entry.actions.push("customer sent 3 alternatives on WhatsApp");
            }
          } else {
            const why = !inWindow ? "outside 24h WhatsApp window, no email, nothing sendable" : protectedStep ? `session is busy (${s0?.step}), not overwritten` : "already sent an alternatives list in the last 24h";
            console.log(`[rescue] #${r.id} skipped: ${why}`);
            // Skips are not actions: no founder email for doing nothing.
            if (!inWindow) entry.actions.push(why);
          }
        }
      }
    }

    if (entry.actions.length) {
      report.push(entry);
    }
  }

  // ---------- E. Mid-flow abandoner nudge (v7) ----------
  // People who started the bot flow but went quiet before a request exists.
  // The request timers (A-D) never see them, so this is their one second touch:
  // a single gentle message per session EVER (data.flowNudged), sent 2-23h
  // after their last activity so it stays inside the WhatsApp 24h window.
  const FLOW_STEPS = ["await_service", "await_day", "await_day_text", "await_time", "await_hour", "await_time_text", "await_area", "await_studio", "await_studio_text", "await_name", "await_email"];
  const flowReport: any[] = [];
  if (!only) {
    const loSess = new Date(now - 23 * 60 * 60 * 1000).toISOString();
    const hiSess = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    const cutReq = new Date(now - 72 * 60 * 60 * 1000).toISOString();
    const sQ = `${SUPABASE_URL}/rest/v1/wa_sessions?step=in.(${FLOW_STEPS.join(",")})&updated_at=lt.${hiSess}&updated_at=gt.${loSess}&select=phone,step,data,updated_at&order=updated_at.asc&limit=25`;
    const sessions = await (await fetch(sQ, { headers: H })).json().catch(() => []);
    let sent = 0;
    for (const sess of (Array.isArray(sessions) ? sessions : [])) {
      if (sent >= 10) break;
      const phone = digitsOf(sess.phone);
      if (!phone || isTestPhone(phone)) continue;
      const d = (sess.data && typeof sess.data === "object") ? sess.data : {};
      if (d.flowNudged) continue;
      if (isTestContact(d.known?.email || d.email || null, d.known?.name || d.name || null)) continue;
      // Already in the request pipeline? Then timers A-D own the follow-up.
      const reqs = await (await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?client_phone=eq.${encodeURIComponent("+" + phone)}&stage=neq.dismissed&created_at=gt.${cutReq}&select=id&limit=1`, { headers: H })).json().catch(() => []);
      if (Array.isArray(reqs) && reqs.length) continue;
      // Their last INBOUND message must be inside the 24h window (free-form send).
      const lastIn = await (await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${phone}&direction=eq.in&order=created_at.desc&limit=1&select=created_at`, { headers: H })).json().catch(() => []);
      const lastInAt = Array.isArray(lastIn) && lastIn[0] ? Date.parse(lastIn[0].created_at) : 0;
      if (!(lastInAt > now - 23 * 60 * 60 * 1000) || lastInAt > now - 2 * 60 * 60 * 1000) continue;
      // v8: "no" or "next week" style goodbyes are not an invitation to nudge.
      if (await customerSaidNo(phone, H)) { console.log(`[rescue] flow nudge skipped for ${phone}: said no`); continue; }
      // v10: and neither is an unanswered question. If the bot said it was
      // finding something out, a cheerful "just checking in" is a broken
      // promise, so say nothing and tell Jordan the window is running.
      const owe = await owedAnAnswer(phone, H);
      if (owe) {
        owedReport.push({ who: String(d.known?.name || d.name || "").trim() || `+${phone}`, phone, promisedAt: owe.promisedAt, windowClosesAt: new Date(lastInAt + 24 * 3600 * 1000).toISOString(), context: `mid-flow at ${sess.step}` });
        console.log(`[rescue] flow nudge skipped for ${phone}: still owed an answer promised at ${owe.promisedAt}`);
        continue;
      }
      if (dry) { flowReport.push({ phone, step: sess.step, dry: true }); continue; }
      const es = String(d.lang || "").toLowerCase().startsWith("es");
      const msg = es
        ? "¡Hola de nuevo! 🙂 Tu reserva de masaje está guardada justo donde la dejaste. Responde cuando quieras y seguimos desde el mismo punto."
        : "Just checking in 🙂 Your massage booking is saved right where you left off. Reply anytime and we continue from the same spot.";
      const res = await fetch(GRAPH, {
        method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { preview_url: false, body: msg } }),
      });
      console.log(`[rescue] flow nudge -> ${phone} (${sess.step}) status=${res.status}`);
      if (res.ok) {
        d.flowNudged = new Date().toISOString();
        await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?phone=eq.${sess.phone}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ data: d }) });
        await fetch(`${SUPABASE_URL}/rest/v1/wa_messages`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ phone, direction: "out", msg_type: "text", body: msg }) });
        flowReport.push({ phone, step: sess.step });
        sent++;
      }
    }
  }

  const acted = report.filter((e) => Array.isArray(e.actions) && e.actions.length && !e.actions[0]?.dryPicks);
  const flowActed = flowReport.filter((e) => !e.dry);
  // v12 (8 Oct, Jordan: "nothing should wait on me"): what the timers did is a
  // log line, not an email. "Rescue acted on 1 stuck booking" went out 16 times
  // in a week and never once asked Jordan to do anything. The daily patrol
  // reads these rows instead.
  if (!dry && (acted.length || flowActed.length)) {
    const lines = [
      ...acted.map((e) => `Request #${e.id} (${e.name || "?"}, ${e.stage}): ${e.actions.join("; ")}`),
      ...flowActed.map((e) => `Flow nudge: +${e.phone} (stalled at ${e.step}), one-time come-back message sent`),
    ];
    await fetch(`${SUPABASE_URL}/rest/v1/funnel_events`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ phone: "system", event: "rescue_acted", meta: { lines } }) }).catch(() => null);
  }

  // v10: silence is the right call for the customer, but whoever we did not
  // talk to is owed an answer by a person. v12: one email per person per day,
  // not one every 30 minutes. "❓ 1 customer is still waiting" went out 46
  // times in seven days, almost all of them about the same few people.
  if (!dry && owedReport.length) {
    const since = new Date(now - 20 * 3600 * 1000).toISOString();
    const seenRows = await (await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?event=eq.rescue_owed_alert&created_at=gt.${since}&select=phone`, { headers: H })).json().catch(() => []);
    const seen = new Set((Array.isArray(seenRows) ? seenRows : []).map((x: any) => String(x.phone || "")));
    const fresh = owedReport.filter((o) => !seen.has(String(o.phone)));
    if (fresh.length) {
      const lines = fresh.map((o) => {
        const closes = o.windowClosesAt ? ` Window shuts ${madridStamp(o.windowClosesAt)} Madrid.` : "";
        return `${o.who} (+${o.phone}) asked something the bot could not answer. We promised a reply at ${madridStamp(o.promisedAt)} Madrid and have not sent one.${closes} Currently ${o.context}. The rescue timers stayed quiet so we do not talk over them.`;
      });
      await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL, to: FOUNDER,
          subject: `❓ ${fresh.length} customer${fresh.length > 1 ? "s are" : " is"} still waiting on an answer we promised`,
          text: [...lines, "", "Answer them and the timers pick up again on their own. You will not get this email again about the same person today."].join("\n"),
        }),
      });
      await fetch(`${SUPABASE_URL}/rest/v1/funnel_events`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(fresh.map((o) => ({ phone: String(o.phone), event: "rescue_owed_alert", meta: { who: o.who, promisedAt: o.promisedAt } }))) }).catch(() => null);
    }
  }

  return new Response(JSON.stringify({ ok: true, checked: due.length, leftAlone, owed: owedReport, report, flow: flowReport }, null, 2), { headers: { "Content-Type": "application/json" } });
}

export function start(opts: { cronKey: string; resendKey: string; waToken: string; phoneId?: string }) {
  CRON_KEY = opts.cronKey;
  RESEND_API_KEY = opts.resendKey;
  WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || opts.waToken;
  PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || opts.phoneId || PHONE_ID;
  GRAPH = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;
  Deno.serve(handleRequest);
}
