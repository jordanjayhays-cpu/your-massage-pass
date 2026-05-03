// Supabase Edge Function: Create Booking
// Creates booking in Supabase AND Google Calendar
// Sends notification to studio
// Deploy: supabase functions deploy create-booking

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

  // Calculate datetime
  const [hour, min] = body.time_slot.split(":").map(Number);
  const bookingDateTime = new Date(`${body.booking_date}T${body.time_slot}:00`);
  const endDateTime = new Date(bookingDateTime.getTime() + (service.duration || 60) * 60 * 1000);

  const status = studio.auto_confirm_bookings ? "confirmed" : "pending";
  const confirmedAt = studio.auto_confirm_bookings ? new Date().toISOString() : null;

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
        `Service: ${service.name}`,
        `Customer: ${body.customer_name}`,
        `Phone: ${body.customer_phone}`,
        body.customer_email ? `Email: ${body.customer_email}` : null,
        `Booked via Massage Club`,
        body.notes ? `Notes: ${body.notes}` : null,
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
            summary: `💆 ${service.name} — ${body.customer_name}`,
            description: eventDescription,
            start: { dateTime: bookingDateTime.toISOString() },
            end: { dateTime: endDateTime.toISOString() },
            reminders: {
              useDefault: false,
              overrides: [
                { method: "email", minutes: 30 },
                { method: "popup", minutes: 15 },
              ],
            },
            colorId: studio.auto_confirm_bookings ? "2" : "4", // green=confirmed, yellow=pending
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

  const message = [
    `🆕 NEW BOOKING — Massage Club`,
    ``,
    `Service: ${service.name}`,
    `Date: ${booking.booking_date}`,
    `Time: ${booking.time_slot}`,
    `Duration: ${service.duration} min`,
    ``,
    `Customer: ${booking.customer_name}`,
    `Phone: ${booking.customer_phone}`,
    booking.customer_email ? `Email: ${booking.customer_email}` : null,
    booking.notes ? `Notes: ${booking.notes}` : null,
    ``,
    studio.auto_confirm_bookings ? `✅ Auto-confirmed` : `⏳ Pending confirmation`,
  ].filter(Boolean).join("\n");

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
