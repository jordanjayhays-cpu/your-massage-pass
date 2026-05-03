// Supabase Edge Function: Get Available Slots
// Reads Google Calendar free/busy AND manual availability
// Returns open time slots for a studio on a given date
// Deploy: supabase functions deploy get-availability

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";

interface AvailabilityRequest {
  studio_id: string;
  date: string; // YYYY-MM-DD
  service_duration: number; // minutes
}

serve(async (req: Request) => {
  const { studio_id, date, service_duration }: AvailabilityRequest = await req.json();

  if (!studio_id || !date) {
    return new Response(JSON.stringify({ error: "Missing studio_id or date" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get studio details
  const { data: studio, error: studioError } = await supabase
    .from("partners")
    .select("*, partner_availability(*)")
    .eq("id", studio_id)
    .single();

  if (studioError || !studio) {
    return new Response(JSON.stringify({ error: "Studio not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse date
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay(); // 0=Sunday

  // Get manual availability slots for this day
  const dayAvailability = studio.partner_availability
    ?.filter((a: any) => a.day_of_week === dayOfWeek)
    ?.map((a: any) => a.time_slot)
    ?.sort() || [];

  if (!dayAvailability.length) {
    return Response.json({ slots: [], source: "manual", studio_id });
  }

  let busySlots: string[] = [];

  // If Google Calendar connected, get busy times
  if (studio.google_calendar_connected && studio.google_refresh_token) {
    const accessToken = await getValidAccessToken(supabase, studio_id);

    if (accessToken) {
      // Calculate time range for the day
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Query Google Calendar Free/Busy API
      const freeBusyResponse = await fetch(GOOGLE_FREEBUSY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          items: [{ id: studio.google_calendar_id || "primary" }],
        }),
      });

      if (freeBusyResponse.ok) {
        const freeBusyData = await freeBusyResponse.json();
        const calendars = freeBusyData.calendars?.[studio.google_calendar_id || "primary"];

        if (calendars?.busy) {
          // Convert busy intervals to slot times
          for (const busy of calendars.busy) {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);

            // For each manual slot, check if it overlaps with busy time
            for (const slot of dayAvailability) {
              const [slotHour, slotMin] = slot.split(":").map(Number);
              const slotStart = new Date(targetDate);
              slotStart.setHours(slotHour, slotMin, 0, 0);
              const slotEnd = new Date(slotStart.getTime() + service_duration * 60 * 1000);

              // If slot overlaps with busy time, mark as unavailable
              if (slotStart < busyEnd && slotEnd > busyStart) {
                busySlots.push(slot);
              }
            }
          }
        }
      }
    }
  }

  // Filter out busy slots
  const availableSlots = dayAvailability.filter(
    (slot: string) => !busySlots.includes(slot)
  );

  return Response.json({
    slots: availableSlots,
    source: studio.google_calendar_connected ? "google_calendar" : "manual",
    busy_slots: busySlots,
    date,
    service_duration,
    studio_id,
  });
});

// Helper: Get valid access token (refresh if needed)
async function getValidAccessToken(
  supabase: any,
  partnerId: string
): Promise<string | null> {
  const { data: studio } = await supabase
    .from("partners")
    .select("google_refresh_token, google_token_expiry, google_access_token")
    .eq("id", partnerId)
    .single();

  if (!studio?.google_refresh_token) return null;

  const expiry = new Date(studio.google_token_expiry);

  // If token still valid, return stored access token
  if (expiry > new Date()) {
    return studio.google_access_token;
  }

  // Refresh the token
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

  if (!refreshResponse.ok) {
    console.error("Token refresh failed");
    return null;
  }

  const tokens = await refreshResponse.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  // Update stored tokens
  await supabase
    .from("partners")
    .update({
      google_access_token: tokens.access_token,
      google_token_expiry: newExpiry.toISOString(),
    })
    .eq("id", partnerId);

  return tokens.access_token;
}
