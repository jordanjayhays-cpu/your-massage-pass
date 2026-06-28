// Edge function: send-booking-reminder
// Called by the studio dashboard to send a friendly reminder email to a client.
// Body: { booking_id: string }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Massage Club <support@massageclub.io>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://jglftdstrowwckwqmpue.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    const bRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${booking_id}&select=*`,
      { headers },
    );
    const bookings = await bRes.json();
    const booking = bookings?.[0];
    if (!booking?.client_email) {
      return new Response(JSON.stringify({ error: "booking or client email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pRes = await fetch(
      `${SUPABASE_URL}/rest/v1/partners?id=eq.${booking.partner_id}&select=business_name,address,access_instructions,phone`,
      { headers },
    );
    const partners = await pRes.json();
    const studio = partners?.[0] ?? {};

    const prettyDate = new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const accessBlock = studio.access_instructions
      ? `<div style="margin-top:18px;padding:14px 16px;background:#F7F4F0;border-left:3px solid #C4622D;border-radius:8px">
           <p style="margin:0 0 6px;font-weight:700;color:#C4622D">📍 Getting there</p>
           <p style="margin:0;color:#3a3a3a;font-size:14px;white-space:pre-wrap">${escapeHtml(studio.access_instructions)}</p>
         </div>`
      : "";

    const html = `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#C4622D;font-family:Georgia,serif;margin:0 0 4px">Your massage is coming up 🌿</h2>
        <p style="margin:0 0 18px;color:#666">A quick reminder from ${escapeHtml(studio.business_name ?? "your studio")}.</p>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden">
          <tr><td style="padding:10px 14px;color:#777;font-size:13px">Studio</td><td style="padding:10px 14px;font-size:14px;font-weight:600">${escapeHtml(studio.business_name ?? "")}</td></tr>
          <tr><td style="padding:10px 14px;color:#777;font-size:13px">Service</td><td style="padding:10px 14px;font-size:14px">${escapeHtml(booking.massage_type ?? "")}</td></tr>
          <tr><td style="padding:10px 14px;color:#777;font-size:13px">When</td><td style="padding:10px 14px;font-size:14px">${prettyDate} at ${escapeHtml(booking.booking_time ?? "")}</td></tr>
          ${studio.address ? `<tr><td style="padding:10px 14px;color:#777;font-size:13px">Address</td><td style="padding:10px 14px;font-size:14px">${escapeHtml(studio.address)}</td></tr>` : ""}
        </table>
        ${accessBlock}
        <p style="margin:20px 0 0;font-size:13px;color:#777">See you soon — Massage Club</p>
      </div>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [booking.client_email],
        subject: `Reminder: your massage at ${studio.business_name ?? "the studio"} — ${prettyDate}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const txt = await emailRes.text();
      return new Response(JSON.stringify({ error: "Email failed", detail: txt }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
