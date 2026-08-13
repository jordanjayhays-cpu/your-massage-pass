// Supabase Edge Function: send-booking-reminders
// Runs daily (via pg_cron). Finds bookings for tomorrow (Europe/Madrid) where
// status != 'cancelled' and reminder_sent = false, emails the client via Resend,
// then flips reminder_sent = true. Returns { sent, failed }.
//
// Deploy:  supabase functions deploy send-booking-reminders --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Massage Club <support@massageclub.io>";
const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get "tomorrow" in Europe/Madrid as YYYY-MM-DD
function tomorrowMadrid(): string {
  const now = new Date();
  // Shift "now" into Madrid wall-clock, then add one day.
  const madridNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  madridNow.setDate(madridNow.getDate() + 1);
  const y = madridNow.getFullYear();
  const m = String(madridNow.getMonth() + 1).padStart(2, "0");
  const d = String(madridNow.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function googleCalendarUrl(opts: {
  title: string; date: string; time: string; durationMin: number; location?: string;
}): string {
  const { title, date, time, durationMin, location = "" } = opts;
  const pad = (n: number) => String(n).padStart(2, "0");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "10:00").split(":").map(Number);
  const start = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 10, mm ?? 0);
  const end = new Date(start.getTime() + durationMin * 60000);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    location,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const date = tomorrowMadrid();

    // Fetch bookings for tomorrow that haven't been reminded
    const url = `${SUPABASE_URL}/rest/v1/bookings?booking_date=eq.${date}&reminder_sent=eq.false&status=neq.cancelled&select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    const bookings = (await res.json()) as any[];

    if (!Array.isArray(bookings) || bookings.length === 0) {
      return new Response(JSON.stringify({ sent: 0, date, message: "no bookings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally enrich with studio address
    const partnerIds = [...new Set(bookings.map((b) => b.partner_id).filter(Boolean))];
    let partnersById: Record<string, any> = {};
    if (partnerIds.length) {
      const pRes = await fetch(
        `${SUPABASE_URL}/rest/v1/partners?id=in.(${partnerIds.join(",")})&select=id,business_name,address`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      const partners = await pRes.json();
      if (Array.isArray(partners)) {
        partnersById = Object.fromEntries(partners.map((p: any) => [p.id, p]));
      }
    }

    let sent = 0;
    let failed = 0;

    for (const b of bookings) {
      if (!b.client_email) continue;
      const partner = b.partner_id ? partnersById[b.partner_id] : null;
      const studio = partner?.business_name ?? b.spa_name ?? "your studio";
      const address = partner?.address ?? "";
      const prettyDate = new Date(b.booking_date + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long",
      });
      const calUrl = googleCalendarUrl({
        title: `${b.massage_type} at ${studio}`,
        date: b.booking_date,
        time: b.booking_time,
        durationMin: b.duration ?? 60,
        location: address || studio,
      });

      const html = `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 520px; margin: 0 auto; color:#2a1a14;">
          <div style="background:#F7F4F0; padding:24px; border-radius:16px;">
            <h2 style="font-family: Georgia, serif; color:#C4622D; margin:0 0 8px;">See you tomorrow ✨</h2>
            <p style="margin:0 0 16px; font-size:15px;">Hi ${b.client_name ?? "there"}, just a friendly reminder of your massage tomorrow.</p>
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
              <tr><td style="padding:6px 0; color:#7a6b62;">Studio</td><td style="padding:6px 0; font-weight:600;">${studio}</td></tr>
              <tr><td style="padding:6px 0; color:#7a6b62;">Service</td><td style="padding:6px 0; font-weight:600;">${b.massage_type}</td></tr>
              <tr><td style="padding:6px 0; color:#7a6b62;">When</td><td style="padding:6px 0; font-weight:600;">${prettyDate} at ${b.booking_time}</td></tr>
              ${address ? `<tr><td style="padding:6px 0; color:#7a6b62;">Where</td><td style="padding:6px 0;">${address}</td></tr>` : ""}
              <tr><td style="padding:6px 0; color:#7a6b62;">Duration</td><td style="padding:6px 0;">${b.duration ?? 60} min</td></tr>
            </table>
            <a href="${calUrl}" style="display:inline-block; margin-top:18px; background:#C4622D; color:#fff; padding:12px 22px; border-radius:999px; text-decoration:none; font-weight:600;">📅 Add to calendar</a>
            <p style="margin:20px 0 0; font-size:13px; color:#7a6b62;">Need to reschedule? Reply to this email and we'll help.</p>
            <p style="margin:12px 0 0; font-size:13px; color:#7a6b62;">— Massage Club</p>
          </div>
        </div>
      `;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [b.client_email],
          subject: `Reminder: your massage tomorrow at ${studio}`,
          html,
        }),
      });

      if (emailRes.ok) {
        sent++;
        await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${b.id}`, {
          method: "PATCH",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ reminder_sent: true }),
        });
      } else {
        failed++;
        console.error("Resend error", b.id, await emailRes.text());
      }
    }

    return new Response(JSON.stringify({ sent, failed, date, total: bookings.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-booking-reminders error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
