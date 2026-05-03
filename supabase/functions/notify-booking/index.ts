// Supabase Edge Function: notify-booking
// Triggered by database webhook on bookings INSERT
// Sends Telegram notification to studio owner (Jordan) so they can forward to studio
// Deploy: supabase functions deploy notify-booking

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ADMIN_TELEGRAM_CHAT_ID = Deno.env.get("ADMIN_TELEGRAM_CHAT_ID")!; // Jordan's chat ID

serve(async (req) => {
  // Supabase sends webhook as POST with JSON body
  const { type, table, record, old_record } = await req.json();

  // Only handle INSERT events on bookings table
  if (type !== "INSERT" || table !== "bookings") {
    return new Response("OK", { status: 200 });
  }

  const b = record;
  const ref = b.booking_ref || `BK-${b.id}`;
  const date = new Date(b.booking_date).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short"
  });

  const message = `🔔 *New Booking*

*${b.client_name}*
${b.massage_type} at ${b.spa_name}
📅 ${date} · ${b.booking_time} · ${b.duration}min
${b.client_phone ? `📞 ${b.client_phone}` : ""}
${b.notes ? `📝 ${b.notes}` : ""}
Ref: \`${ref}\``;

  // Send to Jordan's Telegram
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ADMIN_TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    }),
  });

  return new Response("OK", { status: 200 });
});
