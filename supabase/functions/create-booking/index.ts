// Supabase Edge Function: Create Booking
// Creates booking in Supabase AND Google Calendar
// Builds the studio's notification (the sends are still stubs that only log)
// Deploy: supabase functions deploy create-booking
//
// 16 Oct (the studio-message rewrite). Nothing in src/ calls this function;
// check it is deployed and called before wiring the sends, or delete it.
//  - The studio text is Spanish and reads like Jordan: "Hola, buenas. Brandon
//    ha pedido cita con vosotros: un masaje deportivo de 60 min el lunes 19 de
//    octubre a las 15:00..." instead of "🆕 NEW BOOKING — Massage Club".
//  - Bookings start as pending even for auto_confirm studios, and nothing says
//    "Auto-confirmed": a booking is confirmed only when both parties have
//    tapped (CLAUDE.md, 10 Oct). The studio accepts in its portal.
//  - The Google Calendar event is written in Europe/Madrid wall-clock time. It
//    was built with new Date() in the runtime's UTC, so a 15:00 booking landed
//    at 17:00 in October, and Google's reminder fired two hours late.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars";

interface BookingRequest {
  studio_id: string;
  service_id: string;
  booking_date: string; // YYYY-MM-DD
  time_slot: string; // HH:MM
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  notes?: string;
}

serve(async (req: Request) => {
  const body: BookingRequest = await req.json();

  // Validate required fields
  const required = ["studio_id", "service_id", "booking_date", "time_slot", "customer_name", "customer_phone"];
  for (const field of required) {
    if (!body[field as keyof BookingRequest]) {
      return new Response(JSON.stringify({ error: `Missing field: ${field}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get studio + service details
  const { data: studio } = await supabase
    .from("partners")
    .select("*")
    .eq("id", body.studio_id)
    .single();

  const { data: service } = await supabase
    .from("partner_services")
    .select("*")
    .eq("id", body.service_id)
    .single();

  if (!studio || !service) {
    return new Response(JSON.stringify({ error: "Studio or service not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Calculate datetime: Madrid wall-clock times, handed to Google with their
  // time zone. Date.UTC is used only for the arithmetic, so 15:00 stays 15:00.
  const [hour, min] = body.time_slot.split(":").map(Number);
  const [yy, mo, dd] = body.booking_date.split("-").map(Number);
  const startLocal = `${body.booking_date}T${String(hour).padStart(2, "0")}:${String(min || 0).padStart(2, "0")}:00`;
  const endLocal = new Date(Date.UTC(yy, mo - 1, dd, hour, min || 0) + (service.duration || 60) * 60 * 1000).toISOString().slice(0, 19);

  // Both parties tap (CLAUDE.md, 10 Oct): the customer asked, the studio still
  // has to accept in its portal, so every booking starts pending.
  const status = "pending";
  const confirmedAt = null;

  // Create booking in Supabase
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      studio_id: body.studio_id,
      partner_id: body.studio_id,
      service_id: body.service_id,
      service_name: service.name,
      massage_type: service.type,
      duration: service.duration,
      booking_date: body.booking_date,
      time_slot: body.time_slot,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_email: body.customer_email || null,
      notes: body.notes || null,
      status,
      confirmed_at: confirmedAt,
    })
    .select()
    .single();

  if (bookingError) {
    console.error("Booking insert error:", bookingError);
    return new Response(JSON.stringify({ error: "Failed to create booking" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let googleEventId: string | null = null;

  // If Google Calendar connected, create event
  if (studio.google_calendar_connected && studio.google_refresh_token) {
    const accessToken = await getValidAccessToken(supabase, body.studio_id);

    if (accessToken) {
      const calendarId = studio.google_calendar_id || "primary";
      const eventDescription = [
        `Reserva de Massage Club`,
        `Cliente: ${body.customer_name}`,
        `Teléfono: ${body.customer_phone}`,
        body.customer_email ? `Email: ${body.customer_email}` : null,
        body.notes ? `Nota del cliente: ${body.notes}` : null,
        `Pendiente: aceptadla o rechazadla en book.massageclub.io/studio-portal`,
      ].filter(Boolean).join("\n");

      const googleEvent = await fetch(
        `${GOOGLE_EVENTS_URL}/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: `${svcEs(service.name)}, ${firstName(body.customer_name)} (Massage Club)`,
            description: eventDescription,
            start: { dateTime: startLocal, timeZone: "Europe/Madrid" },
            end: { dateTime: endLocal, timeZone: "Europe/Madrid" },
            reminders: {
              useDefault: false,
              overrides: [
                { method: "email", minutes: 30 },
                { method: "popup", minutes: 15 },
              ],
            },
            colorId: "4", // yellow = pending until the studio accepts
          }),
        }
      );

      if (googleEvent.ok) {
        const eventData = await googleEvent.json();
        googleEventId = eventData.id;

        // Update booking with Google Event ID
        await supabase
          .from("bookings")
          .update({ google_event_id: googleEventId })
          .eq("id", booking.id);
      } else {
        console.error("Google Calendar event creation failed:", await googleEvent.text());
      }
    }
  }

  // Send notification to studio
  await notifyStudio(supabase, studio, booking, service);

  return Response.json({
    success: true,
    booking: {
      id: booking.id,
      status,
      date: body.booking_date,
      time: body.time_slot,
      service: service.name,
      studio: studio.business_name,
      google_event_id: googleEventId,
    },
  });
});

// Helper: Get valid access token
async function getValidAccessToken(supabase: any, partnerId: string): Promise<string | null> {
  const { data: studio } = await supabase
    .from("partners")
    .select("google_refresh_token, google_token_expiry, google_access_token")
    .eq("id", partnerId)
    .single();

  if (!studio?.google_refresh_token) return null;

  const expiry = new Date(studio.google_token_expiry);

  if (expiry > new Date()) {
    return studio.google_access_token;
  }

  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: studio.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshResponse.ok) return null;

  const tokens = await refreshResponse.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  await supabase
    .from("partners")
    .update({
      google_access_token: tokens.access_token,
      google_token_expiry: newExpiry.toISOString(),
    })
    .eq("id", partnerId);

  return tokens.access_token;
}

// Helper: Notify studio of new booking
async function notifyStudio(supabase: any, studio: any, booking: any, service: any) {
  // Get notification preferences
  const { data: notify } = await supabase
    .from("partner_notifications")
    .select("*")
    .eq("partner_id", studio.id)
    .single();

  // What the studio reads. Never "Auto-confirmed": the studio accepts first.
  const message = `Hola, buenas. ${firstName(booking.customer_name) || "Un cliente"} ha pedido cita con vosotros: ${svcConUn(service.name)} de ${service.duration || 60} min ${diaEs(booking.booking_date)} a las ${booking.time_slot}.${booking.customer_phone ? ` Su teléfono es ${booking.customer_phone}.` : ""} ¿Se la confirmáis? Podéis hacerlo en vuestro portal: book.massageclub.io/studio-portal`;

  // Send via WhatsApp if number available
  if (notify?.whatsapp_number) {
    // Use Twilio or WhatsApp Business API
    // await sendWhatsApp(notify.whatsapp_number, message);
    console.log("Would send WhatsApp to:", notify.whatsapp_number);
  }

  // Send via email if available
  if (notify?.email || studio.email) {
    // Use Resend or SendGrid
    // await sendEmail(notify?.email || studio.email, "New Booking", message);
    console.log("Would send email to:", notify?.email || studio.email);
  }

  console.log("Notification sent for booking:", booking.id);
}

// Spanish for what a studio reads (same map as notify-whatsapp-request).
const SVC_ES_MAP: Array<[RegExp, string]> = [
  [/not sure|no lo sé|^massage$|massage treatment/i, "Masaje"],
  [/deep tissue|descontracturante/i, "Masaje descontracturante"],
  [/thai|tailand/i, "Masaje tailandés"],
  [/hot stone|piedras/i, "Masaje de piedras calientes"],
  [/sport|deportivo/i, "Masaje deportivo"],
  [/balin/i, "Masaje balinés"],
  [/shiatsu/i, "Shiatsu"],
  [/reflexolog/i, "Reflexología"],
  [/lymphatic|drenaje|linfatic/i, "Drenaje linfático"],
  [/couples|pareja/i, "Masaje en pareja"],
  [/kobido/i, "Masaje facial Kobido"],
  [/relax|swedish|stress/i, "Masaje relajante"],
];
function svcEs(n?: string | null): string {
  const s = String(n || "").trim();
  for (const [re, es] of SVC_ES_MAP) if (re.test(s)) return es;
  return s || "Masaje";
}
function svcConUn(n?: string | null): string {
  const v = svcEs(n);
  if (/^masaje$/i.test(v)) return "un masaje";
  if (/^reflexolog/i.test(v)) return "una sesión de reflexología";
  const low = v.charAt(0).toLowerCase() + v.slice(1);
  if (/^(un|una)\s/i.test(low)) return low;
  return SVC_ES_MAP.some(([, es]) => es === v) || /^(masaje|drenaje|shiatsu)\b/i.test(low) ? `un ${low}` : `una sesión de ${low}`;
}
function firstName(n?: string | null): string {
  const f = String(n || "").trim().split(/\s+/)[0] || "";
  return f ? f.charAt(0).toUpperCase() + f.slice(1) : "";
}
// "hoy", "mañana" or "el lunes 19 de octubre" for a YYYY-MM-DD calendar date.
const ES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const ES_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function diaEs(isoDate: string): string {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const diff = Math.round((d.getTime() - Date.parse(today + "T00:00:00Z")) / 86400e3);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  return `el ${ES_DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${ES_MESES[d.getUTCMonth()]}`;
}
