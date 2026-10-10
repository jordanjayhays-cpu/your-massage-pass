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
// The repo is public, so this file carries no secrets. The deployed function
// is a short loader that pins one commit of this file and passes the keys in.
const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const APP = "https://book.massageclub.io";
let RESEND_API_KEY = "";
let OPS_KEY = "";
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const TO_EMAILS = ["support@massageclub.io", "jordan@massageclub.io"];
const LOGO_URL = "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/branding/mc-avatar-cream.png";
const C = { page: "#F1EBE2", ink: "#262019", muted: "#8A7F73", clay: "#B85C38", cream: "#FAF6F0", line: "#F0E9E0", dash: "#E4D9CB" };
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const t = (url.searchParams.get("t") || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
  const pick = (url.searchParams.get("pick") || "").slice(0, 8);
  const pid = (url.searchParams.get("p") || "").replace(/[^a-fA-F0-9-]/g, "").slice(0, 36);
  const invalid = () => new Response(null, { status: 302, headers: { Location: `${APP}/booking-result?o=invalid` } });
  if (!t || !pick) return invalid();

  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const H = { apikey: svc, Authorization: `Bearer ${svc}`, "Content-Type": "application/json" };

  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?offer_token=eq.${t}&select=*`, { headers: H })).json().catch(() => []);
  const r = Array.isArray(rows) ? rows[0] : null;
  if (!r) return invalid();

  // Resolve which studio is answering: the p param (multi-studio offers) or the
  // partner already on the request (single-studio offers).
  let studioName = r.studio_name || "El centro";
  let studioPartnerId: string | null = r.partner_id || null;
  if (pid) {
    const ps = await (await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${pid}&select=id,business_name`, { headers: H })).json().catch(() => []);
    if (Array.isArray(ps) && ps[0]) { studioName = ps[0].business_name; studioPartnerId = ps[0].id; }
    else return invalid();
  }

  const options: Array<[string, string]> = [
    [r.day1 || "", r.time1 || ""], [r.day2 || "", r.time2 || ""], [r.day3 || "", r.time3 || ""],
  ];
  // v5: book.massageclub.io/booking-result never knew "studio-ok" or
  // "studio-none" and showed studios "Enlace no válido". The notes on the
  // bot.html shell say what actually happened, in Spanish.
  const nonePage = () => new Response(null, { status: 302, headers: { Location: "https://book.massageclub.io/bot.html?note=studio_none" } });

  if (pick === "none") {
    if (r.stage === "confirmed" && r.confirmed_day) return nonePage(); // already settled elsewhere, nothing to do
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
  if (!Number.isInteger(n) || n < 1 || n > 3) return invalid();
  const [day, time] = options[n - 1];
  if (!day && !time) return invalid();

  // Already confirmed: the same studio tapping again is told it is theirs; a
  // different studio arriving late is told it is covered.
  const NOTE = "https://book.massageclub.io/bot.html?note=";
  const note = (k: string) => new Response(null, { status: 302, headers: { Location: NOTE + k } });
  if (r.stage === "confirmed" && r.confirmed_day) {
    if (!pid || String(r.partner_id || "") === pid) return note("studio_done");
    return note("studio_taken");
  }
  if (!studioPartnerId) return invalid();

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
        body: JSON.stringify({ ops: "studio_offer", key: OPS_KEY, request_id: r.id, partner_id: studioPartnerId, day, time, option: n }),
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
    `${studioName} can do ${when} for ${r.first_name || "the client"} (${r.service_name || "massage"}). NOT booked yet.`,
    relay.ok ? `The customer was sent the offer to tap Yes on. The booking confirms only when they do, and then the studio gets it in writing.` : `⚠️ The offer could NOT be sent to the customer (${String(relay.reason || "no reason")}). Offer it to them yourself.`,
    waC ? `Client WhatsApp: ${waC}` : "",
  ].filter(Boolean).join("\n");
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject: `${relay.ok ? "⏳" : "⚠️"} ${studioName} can do ${when}: waiting for the customer`, text: plain }) }).catch(() => {});
  return note("studio_pending");
}

export function start(opts: { resendKey: string; opsKey: string }) {
  RESEND_API_KEY = opts.resendKey;
  OPS_KEY = opts.opsKey;
  Deno.serve(handleRequest);
}
