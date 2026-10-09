// studio-times: the studio's side of the automated concierge loop.
// The studio's booking-request email contains one-tap links:
//   GET ?t=<offer_token>&pick=<n>   n = 1..3, the time option they accept
//   GET ?t=<offer_token>&pick=none  none of the times work
//   &p=<partner_id>  (v2) identifies WHICH studio tapped when the same request
//                    was offered to several studios; first to accept wins.
// On accept: stamp the request confirmed (and the winning partner), email the
// CUSTOMER their confirmation automatically, alert the founder inbox.
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

// Small self-contained page for the "someone else already took it" case.
const takenPage = () => new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Massage Club</title></head><body style="margin:0;background:${C.page};font-family:${SANS};"><div style="max-width:420px;margin:60px auto;padding:0 16px;"><div style="background:#fff;border:1px solid ${C.line};border-radius:20px;padding:36px 30px;text-align:center;"><img src="${LOGO_URL}" width="40" height="40" style="border-radius:50%;"><h1 style="margin:18px 0 0;color:${C.ink};font-size:24px;font-family:${SERIF};">Esta reserva ya está cubierta</h1><p style="margin:12px 0 0;color:${C.muted};font-size:14.5px;line-height:1.6;">Otro centro ha confirmado justo antes. ¡Gracias por responder tan rápido! Os tendremos en cuenta para el próximo cliente.</p><p style="margin:10px 0 0;color:#B8AC9E;font-size:12.5px;line-height:1.6;">This booking was just covered by another studio. Thank you for the quick reply, we will keep you in mind for the next client.</p></div></div></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });

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
  const okPage = () => new Response(null, { status: 302, headers: { Location: `${APP}/booking-result?o=studio-ok` } });
  const nonePage = () => new Response(null, { status: 302, headers: { Location: `${APP}/booking-result?o=studio-none` } });

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

  // Already confirmed: same studio tapping again just sees the thanks page;
  // a different studio arriving late sees the "already covered" page.
  if (r.stage === "confirmed" && r.confirmed_day) {
    if (!pid || String(r.partner_id || "") === pid) return okPage();
    return takenPage();
  }

  // v4: day1 often already carries the time ("Friday 9 Oct, 14:00").
  const when = time && day.includes(time) ? day : [day, time].filter(Boolean).join(" ");
  // First tap wins: conditional PATCH, and ask for the row back so we know
  // whether OUR tap was the one that flipped it.
  const patchBody: Record<string, unknown> = { stage: "confirmed", studio_reply: `accepted option ${n}`, confirmed_day: day || null, confirmed_time: time || null, stage_updated_at: new Date().toISOString() };
  if (pid) { patchBody.partner_id = studioPartnerId; patchBody.studio_name = studioName; }
  const pRes = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_requests?offer_token=eq.${t}&stage=not.eq.confirmed`, {
    method: "PATCH", headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(patchBody),
  });
  const updated = await pRes.json().catch(() => []);
  if (!Array.isArray(updated) || !updated.length) {
    console.log(`[studio-times] req ${r.id}: late tap by ${studioName}, already confirmed`);
    return pid ? takenPage() : okPage();
  }
  console.log(`[studio-times] req ${r.id} confirmed ${when} by ${studioName}`);

  // v4: the address goes with the confirmation.
  let address = "";
  if (studioPartnerId) {
    const pa = await (await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${studioPartnerId}&select=address`, { headers: H })).json().catch(() => []);
    address = Array.isArray(pa) && pa[0] ? String(pa[0].address || "") : "";
  }

  // Customer confirmation: automatic, bilingual-lite (EN + ES line).
  if (r.contact_email) {
    const html = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};padding:36px 14px;font-family:${SANS};"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:20px;border:1px solid ${C.line};overflow:hidden;">
      <tr><td style="padding:26px 34px 0;text-align:center;">
        <img src="${LOGO_URL}" alt="" width="34" height="34" style="border-radius:50%;display:inline-block;">
        <p style="margin:9px 0 0;color:${C.ink};font-size:12px;font-weight:700;letter-spacing:3px;">MASSAGE&nbsp;CLUB</p>
      </td></tr>
      <tr><td style="padding:26px 34px 0;text-align:center;">
        <span style="display:inline-block;background:#E6F4EA;color:#1A7F42;font-size:11px;font-weight:700;letter-spacing:2.5px;padding:7px 16px;border-radius:999px;">CONFIRMED · CONFIRMADO</span>
        <h1 style="margin:16px 0 0;color:${C.ink};font-size:27px;line-height:1.2;font-family:${SERIF};font-weight:700;">${esc(studioName)}</h1>
        ${address ? `<p style="margin:8px 0 0;color:${C.muted};font-size:14px;line-height:1.5;">📍 ${esc(address)}</p>` : ""}
      </td></tr>
      <tr><td style="padding:24px 34px 0;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};border-radius:16px;"><tr><td style="padding:22px 20px;text-align:center;">
          <p style="margin:0;color:${C.clay};font-size:38px;line-height:1.1;font-family:${SERIF};font-weight:700;">${esc(when)}</p>
          ${r.service_name ? `<p style="margin:8px 0 0;color:${C.ink};font-size:15px;font-weight:600;">${esc(r.service_name)}${r.price ? ` · €${r.price}` : ""}</p>` : ""}
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:20px 34px 0;text-align:center;">
        <p style="margin:0;color:${C.muted};font-size:14px;line-height:1.6;">The studio confirmed your time. You pay them directly, no booking fee.<br>El centro ha confirmado tu hora. Pagas directamente allí, sin comisión.</p>
      </td></tr>
      <tr><td style="padding:24px 34px 26px;">
        <div style="border-top:2px dashed ${C.dash};margin:16px 0;"></div>
        <p style="margin:0;color:#B8AC9E;font-size:12px;text-align:center;">Massage Club · Madrid · <a href="${APP}" style="color:${C.clay};text-decoration:none;">book.massageclub.io</a></p>
      </td></tr>
    </table></td></tr></table>`;
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [r.contact_email], subject: `✅ Confirmed: ${studioName}, ${when}`, html,
        text: `Confirmed: ${r.service_name || "massage"} at ${studioName}, ${when}.${address ? `\n${address}` : ""}\nYou pay the studio directly, no fee.` }),
    }).catch((e) => console.log("[studio-times] customer email failed", String(e)));
  }

  // v4: the bot tells the customer in their WhatsApp chat (only if it is open),
  // writes the booking row and stands the other studios down.
  let waSent = false;
  if (OPS_KEY) {
    try {
      const wr = await fetch(`${SUPABASE_URL}/functions/v1/wa-bot`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ ops: "email_confirmed", key: OPS_KEY, request_id: r.id }),
      });
      const wj = await wr.json().catch(() => ({}));
      waSent = !!wj?.sent;
    } catch (e) { console.log("[studio-times] wa-bot relay failed", String(e)); }
  }

  const waC = r.client_phone ? `https://wa.me/${String(r.client_phone).replace(/[^0-9]/g, "")}` : "";
  const plain = [
    `✅ ${studioName} CONFIRMED ${when} for ${r.first_name || "client"} (${r.service_name || "massage"}).`,
    r.contact_email ? `Customer auto-emailed their confirmation${address ? " with the address" : ""}.` : `⚠️ No customer email on file.`,
    waSent ? `Also told on WhatsApp, with the address.` : r.contact_email ? "" : `Not told on WhatsApp either (chat not open): tell them yourself.`,
    waC ? `Client WhatsApp: ${waC}` : "",
  ].filter(Boolean).join("\n");
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject: `✅ ${studioName} confirmed ${when}`, text: plain }) }).catch(() => {});

  const tgToken = Deno.env.get("TELEGRAM_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN");
  const tgChat = Deno.env.get("TELEGRAM_CHAT_ID") || Deno.env.get("ADMIN_TELEGRAM_CHAT_ID");
  if (tgToken && tgChat) {
    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: tgChat, text: plain }) }).catch(() => {});
  }

  return okPage();
}

export function start(opts: { resendKey: string; opsKey: string }) {
  RESEND_API_KEY = opts.resendKey;
  OPS_KEY = opts.opsKey;
  Deno.serve(handleRequest);
}
