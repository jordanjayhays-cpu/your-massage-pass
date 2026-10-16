// studio-times: the studio's side of the automated concierge loop.
// The studio's booking-request email contains one-tap links:
//   GET ?t=<offer_token>&pick=<n>   n = 1..3, the time option they accept
//   GET ?t=<offer_token>&pick=none  none of the times work
//   &p=<partner_id>  (v2) identifies WHICH studio tapped when the same request
//                    was offered to several studios; first to accept wins.
// On a pick (v5): the time becomes an offer the customer must tap Yes on
// (wa-bot ops studio_offer); nothing is confirmed here any more.
// On none: alert to renegotiate. A tap after someone else already accepted
// shows a polite "already covered" page instead.
//
// v4 (9 Oct): William made request #110 on the website and then asked on
// WhatsApp for the offers "here". The Nook accepted from this email at 12:53,
// he got an email with no address, and the WhatsApp chat that had promised to
// tell him heard nothing. Now:
//   - the confirmation is handed to wa-bot (ops email_confirmed), which tells
//     the customer in their open WhatsApp chat, with the address, writes the
//     booking row and stands the other studios down;
//   - the customer email carries the studio's address;
//   - "Friday 9 Oct, 14:00 14:00" reads "Friday 9 Oct, 14:00";
//   - no em dashes in anything a customer or studio reads.
// v6 (16 Oct, the studio-message rewrite):
//   - a dead link (no request, unknown studio, bad option) emails Jordan with
//     the reason, so a studio that tapped a real request is never stuck there
//     alone;
//   - a studio that already HAS the confirmed booking and taps "No nos viene
//     bien" is no longer thanked and forgotten: Jordan is emailed at once,
//     because that is the studio cancelling a confirmed booking;
//   - ?go=1 with h=HH:MM (inside the option asked) and eur=1..500 is the answer
//     from the scanner-safe check page: the hour the studio picked and its
//     final price go to wa-bot with the offer;
//   - checkPage (loader option, off until wa-bot serves note=studio_check,
//     studio_invalid and studio_none_confirmed): a tap without go=1 only opens
//     the check page, so a mail scanner opening the link acts on nothing.
// The repo is public, so this file carries no secrets. The deployed function
// is a short loader that pins one commit of this file and passes the keys in.
const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const APP = "https://book.massageclub.io";
let RESEND_API_KEY = "";
let OPS_KEY = "";
let CHECK_PAGE = false;
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const TO_EMAILS = ["support@massageclub.io", "jordan@massageclub.io"];
const LOGO_URL = "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/branding/mc-avatar-cream.png";
const C = { page: "#F1EBE2", ink: "#262019", muted: "#8A7F73", clay: "#B85C38", cream: "#FAF6F0", line: "#F0E9E0", dash: "#E4D9CB" };
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to } });

// To Jordan only (support@ and jordan@), never to a studio or a customer.
async function tellJordan(subject: string, text: string) {
  if (!RESEND_API_KEY) { console.log(`[studio-times] for Jordan: ${subject} | ${text.slice(0, 200)}`); return; }
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject, text }) }).catch(() => {});
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const t = (url.searchParams.get("t") || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
  const pick = (url.searchParams.get("pick") || "").slice(0, 8);
  const pid = (url.searchParams.get("p") || "").replace(/[^a-fA-F0-9-]/g, "").slice(0, 36);
  const go = url.searchParams.get("go") === "1";
  // v6: a link that reached us with a token is a studio stuck on our side, so
  // Jordan hears about it with the reason. A bare hit without one is noise.
  const invalid = async (reason: string) => {
    if (t) {
      console.log(`[studio-times] dead link t=${t} pick=${pick} p=${pid}: ${reason}`);
      await tellJordan("⚠️ A studio hit a dead offer link", [`A studio opened an offer link that no longer works: ${reason}.`, `t=${t} pick=${pick || "-"} p=${pid || "-"}`, CHECK_PAGE ? "They were shown a page with our WhatsApp and support@ to reach us." : "They were shown the website's \"Enlace no válido\" page, which gives them no way to reach us."].join("\n"));
    }
    return redirect(CHECK_PAGE ? `${APP}/bot.html?note=studio_invalid` : `${APP}/booking-result?o=invalid`);
  };
  if (!t) return invalid("no token in the link");
  if (!pick) return invalid("no option in the link");
  // v6: with the check page live, a plain tap only opens it; nothing is
  // recorded until the studio presses the button there (go=1).
  if (CHECK_PAGE && !go) return redirect(`${APP}/bot.html?note=studio_check&t=${t}&pick=${encodeURIComponent(pick)}${pid ? `&p=${pid}` : ""}`);

  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const H = { apikey: svc, Authorization: `Bearer ${svc}`, "Content-Type": "application/json" };

  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?offer_token=eq.${t}&select=*`, { headers: H })).json().catch(() => []);
  const r = Array.isArray(rows) ? rows[0] : null;
  if (!r) return invalid("no request has this token");

  // Resolve which studio is answering: the p param (multi-studio offers) or the
  // partner already on the request (single-studio offers).
  let studioName = r.studio_name || "El centro";
  let studioPartnerId: string | null = r.partner_id || null;
  if (pid) {
    const ps = await (await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${pid}&select=id,business_name`, { headers: H })).json().catch(() => []);
    if (Array.isArray(ps) && ps[0]) { studioName = ps[0].business_name; studioPartnerId = ps[0].id; }
    else return invalid(`no studio with id ${pid} (request #${r.id})`);
  }

  const options: Array<[string, string]> = [
    [r.day1 || "", r.time1 || ""], [r.day2 || "", r.time2 || ""], [r.day3 || "", r.time3 || ""],
  ];
  // v5: book.massageclub.io/booking-result never knew "studio-ok" or
  // "studio-none" and showed studios "Enlace no válido". The notes on the
  // bot.html shell say what actually happened, in Spanish.
  const nonePage = () => new Response(null, { status: 302, headers: { Location: "https://book.massageclub.io/bot.html?note=studio_none" } });
  const NOTE = "https://book.massageclub.io/bot.html?note=";
  const note = (k: string) => new Response(null, { status: 302, headers: { Location: NOTE + k } });

  if (pick === "none") {
    if (r.stage === "confirmed") {
      // v6: the studio that HAS this confirmed booking saying it cannot do it
      // is a cancellation by the studio. It used to get a thank-you and be
      // lost. Nothing is changed here; Jordan is told at once.
      if (!pid || pid === String(r.partner_id || "")) {
        const waC = r.client_phone ? `https://wa.me/${String(r.client_phone).replace(/[^0-9]/g, "")}` : "";
        await tellJordan(`⚠️ ${studioName} says it cannot do confirmed #${r.id}`, [
          `${studioName} tapped "No nos viene bien" on request #${r.id}, which is already confirmed with them: ${[r.confirmed_day, r.confirmed_time].filter(Boolean).join(" ") || [r.day1, r.time1].filter(Boolean).join(" ")}, ${r.first_name || "the client"} (${r.service_name || "massage"}).`,
          "Nothing has been changed and nobody has been told. Check with the studio, then tell the client.",
          waC ? `Client WhatsApp: ${waC}` : "",
        ].filter(Boolean).join("\n"));
        console.log(`[studio-times] confirmed req ${r.id}: ${studioName} tapped none`);
        return note(CHECK_PAGE ? "studio_none_confirmed" : "studio_none");
      }
      return nonePage(); // confirmed with another studio, nothing to do
    }
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?offer_token=eq.${t}&stage=not.eq.confirmed`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ stage: "studio_replied", studio_reply: `none_work: ${studioName}`.slice(0, 200), stage_updated_at: new Date().toISOString() }),
    });
    const plain = `⚠️ ${studioName} says NONE of the times work for ${r.first_name || "the client"} (${r.service_name}).\nOffer new times to the client.${r.client_phone ? `\nClient: https://wa.me/${String(r.client_phone).replace(/[^0-9]/g, "")}` : ""}`;
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject: `⚠️ ${studioName}: no times work, renegotiate`, text: plain }) }).catch(() => {});
    console.log(`[studio-times] none_work for req ${r.id} by ${studioName}`);
    return nonePage();
  }

  const n = parseInt(pick, 10);
  if (!Number.isInteger(n) || n < 1 || n > 3) return invalid(`option "${pick}" does not exist (request #${r.id})`);
  const [day, optTime] = options[n - 1];
  if (!day && !optTime) return invalid(`option ${n} is empty on request #${r.id}`);
  // v6: the check page sends the hour the studio picked (h) and, if they gave
  // one, the final price with the 10% (eur). The hour must sit inside what
  // was asked: the exact time, or within the band ("Afternoon (13-18)").
  let time = optTime;
  let price: number | null = null;
  if (go) {
    const hm = (url.searchParams.get("h") || "").match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (hm) {
      const h = `${hm[1].padStart(2, "0")}:${hm[2]}`;
      const exact = String(optTime || "").match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
      const band = String(optTime || "").match(/\b(\d{1,2})(?::00)?\s*-\s*(\d{1,2})(?::00)?\b/) || (/morning|ma[nñ]ana/i.test(optTime) ? [null, "10", "13"] : /afternoon|tarde/i.test(optTime) ? [null, "13", "18"] : /evening|night|noche/i.test(optTime) ? [null, "18", "21"] : null);
      const mins = parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
      const inside = band ? mins >= parseInt(String(band[1]), 10) * 60 && mins < parseInt(String(band[2]), 10) * 60
        : exact ? h === `${exact[1].padStart(2, "0")}:${exact[2]}` : true;
      if (!inside) return invalid(`hour ${h} is outside option ${n} (${optTime}) on request #${r.id}`);
      time = h;
    }
    const eur = Number(url.searchParams.get("eur") || "");
    if (Number.isFinite(eur) && eur >= 1 && eur <= 500) price = Math.round(eur * 100) / 100;
  }

  // Already confirmed: the same studio tapping again is told it is theirs; a
  // different studio arriving late is told it is covered.
  if (r.stage === "confirmed" && r.confirmed_day) {
    if (!pid || String(r.partner_id || "") === pid) return note("studio_done");
    return note("studio_taken");
  }
  if (!studioPartnerId) return invalid(`request #${r.id} has no studio on it and the link carries none`);

  // v5 (Jordan, 10 Oct: "make sure they do not get confirmed only until they
  // confirm it via a tap of the button, we need to make sure both parties
  // confirm"). On 9 Oct The Nook tapped option 1 here and request #110 was
  // marked confirmed, the customer was emailed "CONFIRMED", and William had not
  // said a word. A studio's tap is now only the studio's half: wa-bot (ops
  // studio_offer) records it as an offer and sends the customer Yes / No
  // buttons on WhatsApp, or an email whose button opens the same choice on
  // book.massageclub.io. The booking confirms only on the customer's tap, and
  // then the studio gets the confirmation in writing.
  const when = time && day.includes(time) ? day : [day, time].filter(Boolean).join(" ");
  let relay: Record<string, unknown> = {};
  if (OPS_KEY) {
    try {
      const wr = await fetch(`${SUPABASE_URL}/functions/v1/wa-bot`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ ops: "studio_offer", key: OPS_KEY, request_id: r.id, partner_id: studioPartnerId, day, time, option: n, ...(price ? { price } : {}) }),
      });
      relay = await wr.json().catch(() => ({}));
    } catch (e) { relay = { ok: false, reason: String(e).slice(0, 120) }; }
  }
  console.log(`[studio-times] req ${r.id}: ${studioName} offered option ${n} (${when}), relay ${JSON.stringify(relay).slice(0, 160)}`);
  if (!relay.ok) {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?id=eq.${r.id}&stage=not.in.(confirmed,cancelled,dismissed)`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ stage: "studio_replied", studio_reply: `${studioName}: puede ${when} (email), sin enviar al cliente`.slice(0, 200), stage_updated_at: new Date().toISOString() }),
    });
  }
  const waC = r.client_phone ? `https://wa.me/${String(r.client_phone).replace(/[^0-9]/g, "")}` : "";
  const plain = [
    `${studioName} can do ${when} for ${r.first_name || "the client"} (${r.service_name || "massage"})${price ? `, final price ${price} EUR` : ""}. NOT booked yet.`,
    relay.ok ? `The customer was sent the offer to tap Yes on. The booking confirms only when they do, and then the studio gets it in writing.` : `⚠️ The offer could NOT be sent to the customer (${String(relay.reason || "no reason")}). Offer it to them yourself.`,
    waC ? `Client WhatsApp: ${waC}` : "",
  ].filter(Boolean).join("\n");
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject: `${relay.ok ? "⏳" : "⚠️"} ${studioName} can do ${when}: waiting for the customer`, text: plain }) }).catch(() => {});
  return note("studio_pending");
}

export function start(opts: { resendKey: string; opsKey: string; checkPage?: boolean }) {
  RESEND_API_KEY = opts.resendKey;
  OPS_KEY = opts.opsKey;
  CHECK_PAGE = opts.checkPage === true;
  Deno.serve(handleRequest);
}
