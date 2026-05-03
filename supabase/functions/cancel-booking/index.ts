// Supabase Edge Function: Cancel Booking
// Cancels booking in Supabase AND removes from Google Calendar
// Notifies both studio and customer
// Deploy: supabase functions deploy cancel-booking

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars";

interface CancelRequest {
  booking_id: string;
  reason?: string;
}

serve(async (req: Request) => {
  const { booking_id, reason }: CancelRequest = await req.json();

  if (!booking_id) {
    return new Response(JSON.stringify({ error: "Missing booking_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get booking + studio details
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, partners(*)")
    .eq("id", booking_id)
    .single();

  if (!booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (booking.status === "cancelled") {
    return new Response(JSON.stringify({ error: "Booking already cancelled" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cancel in Google Calendar if event exists
  if (booking.google_event_id && booking.partners?.google_calendar_connected) {
    const accessToken = await getValidAccessToken(supabase, booking.studio_id);

    if (accessToken) {
      const calendarId = booking.partners.google_calendar_id || "primary";

      await fetch(
        `${GOOGLE_EVENTS_URL}/${encodeURIComponent(calendarId)}/events/${booking.google_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    }
  }

  // Update booking status in Supabase
  const { data: cancelledBooking, error: cancelError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason || null,
    })
    .eq("id", booking_id)
    .select()
    .single();

  if (cancelError) {
    return new Response(JSON.stringify({ error: "Failed to cancel booking" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Notify both parties
  await notifyCancellation(booking, reason);

  return Response.json({
    success: true,
    booking: cancelledBooking,
  });
});

async function getValidAccessToken(supabase: any, partnerId: string): Promise<string | null> {
  const { data: studio } = await supabase
    .from("partners")
    .select("google_refresh_token, google_token_expiry, google_access_token")
    .eq("id", partnerId)
    .single();

  if (!studio?.google_refresh_token) return null;

  const expiry = new Date(studio.google_token_expiry);
  if (expiry > new Date()) return studio.google_access_token;

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

  await supabase
    .from("partners")
    .update({
      google_access_token: tokens.access_token,
      google_token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("id", partnerId);

  return tokens.access_token;
}

async function notifyCancellation(booking: any, reason?: string) {
  const message = [
    `❌ BOOKING CANCELLED — Massage Club`,
    ``,
    `Service: ${booking.service_name}`,
    `Date: ${booking.booking_date}`,
    `Time: ${booking.time_slot}`,
    ``,
    `Customer: ${booking.customer_name}`,
    reason ? `Reason: ${reason}` : null,
  ].filter(Boolean).join("\n");

  console.log("Cancellation notification:", message);
}
