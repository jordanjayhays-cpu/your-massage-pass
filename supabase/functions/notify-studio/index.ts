// Supabase Edge Function: notify-studio
// Triggered by database webhook on bookings INSERT
// Sends email to studio via Resend + WhatsApp via Twilio (if phone exists)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Massage Club <onboarding@massagepass.app>";

interface BookingRecord {
  id: string;
  partner_id: string;
  client_name: string;
  client_phone?: string;
  massage_type: string;
  booking_date: string;
  booking_time: string;
  duration: number;
  notes?: string;
}

serve(async (req) => {
  const { type, table, record } = await req.json();

  if (type !== "INSERT" || table !== "bookings") {
    return new Response("OK", { status: 200 });
  }

  const booking = record as BookingRecord;
  const partnerId = booking.partner_id;

  if (!partnerId) {
    console.log("No partner_id on booking, skipping studio notification");
    return new Response("OK", { status: 200 });
  }

  // Fetch studio info
  const supabaseUrl = "https://jglftdstrowwckwqmpue.supabase.co";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const partnerRes = await fetch(`${supabaseUrl}/rest/v1/partners?id=eq.${partnerId}&select=business_name,email,phone`, {
    headers: {
      "apikey": supabaseServiceKey,
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
    },
  });
  const partners = await partnerRes.json();
  const studio = partners?.[0];
  if (!studio?.email) {
    console.log("No studio email found, skipping");
    return new Response("OK", { status: 200 });
  }

  const date = new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });
  const datetime = `${date} at ${booking.booking_time}`;
  const portalUrl = "https://your-massage-pass-o5fo.vercel.app/studio-portal";

  // ── 1. Send email via Resend ──
  const emailPayload = {
    from: FROM_EMAIL,
    to: [studio.email],
    subject: `🔔 New Booking — ${date} at ${booking.booking_time}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">New Booking Received!</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Member:</strong></td><td style="padding: 8px 0; font-size: 14px;">${booking.client_name}${booking.client_phone ? ` (${booking.client_phone})` : ""}</td></tr>
          <tr><td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Service:</strong></td><td style="padding: 8px 0; font-size: 14px;">${booking.massage_type}</td></tr>
          <tr><td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Date & Time:</strong></td><td style="padding: 8px 0; font-size: 14px;">${datetime}</td></tr>
          <tr><td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Duration:</strong></td><td style="padding: 8px 0; font-size: 14px;">${booking.duration} min</td></tr>
          ${booking.notes ? `<tr><td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Notes:</strong></td><td style="padding: 8px 0; font-size: 14px; font-style: italic;">${booking.notes}</td></tr>` : ""}
        </table>
        <a href="${portalUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">View in Portal →</a>
        <p style="font-size: 12px; color: #666; margin-top: 24px;">Log in to your studio portal to confirm or cancel this booking.</p>
      </div>
    `,
    text: `New Booking — ${booking.client_name} for ${booking.massage_type} on ${datetime}. ${booking.client_phone ? `Phone: ${booking.client_phone}` : ""} Log in to your portal to confirm: ${portalUrl}`,
  };

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  // ── 2. Send WhatsApp via Twilio (if studio has phone) ──
  if (studio.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM) {
    const whatsappMsg = `New booking: *${booking.client_name}* for *${booking.massage_type}* on ${datetime}.${booking.client_phone ? ` 📞 ${booking.client_phone}` : ""}\n\nGo to your portal to confirm: ${portalUrl}`;

    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To: `whatsapp:${studio.phone.includes("whatsapp:") ? studio.phone : `whatsapp:+34 ${studio.phone.replace(/\s+/g, "")}`}`,
        Body: whatsappMsg,
      }),
    });
  }

  return new Response("OK", { status: 200 });
});