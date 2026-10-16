// Supabase Edge Function: Cancel Booking
// Cancels booking in Supabase AND removes from Google Calendar
// Tells the studio when the customer cancels (email, plus a WhatsApp note
// through dispatch-studios). The customer is NOT messaged from here.
// Deploy: supabase functions deploy cancel-booking
//
// 16 Oct (the studio-message rewrite). The studio notice was a console.log in
// English ("❌ BOOKING CANCELLED — Massage Club"), so a studio was never told a
// customer had cancelled (CLAUDE.md: every studio asked must be told). It now
// goes out in Spanish: "Hola, buenas. Brandon ha cancelado su masaje deportivo
// del lunes 19 de octubre a las 15:00, así que podéis dar el hueco a otra
// persona. Perdonad las molestias." Not when the studio itself cancelled
// (by: "studio"), never for a test contact, and the reason is left out (it
// may be private or in English). Jordan gets a copy of the email (OPS_KEY).
// Nothing in src/ calls this function: check it is deployed before relying on it.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars";

interface CancelRequest {
  booking_id: string;
  reason?: string;
  // Who cancelled. A studio cancelling its own booking is not written to.
  by?: "customer" | "studio";
}

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const REPLY_TO = "support@massageclub.io";

serve(async (req: Request) => {
  const { booking_id, reason, by }: CancelRequest = await req.json();

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

  // Tell the studio, unless the studio is the one who cancelled.
  if (by !== "studio") await notifyCancellation(booking, reason);

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

// Same test lists as notify-whatsapp-request: none of these ever reach a studio.
const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu", "longyi_elon@outlook.com", "geromin.nepomuceno@student.ie.edu", "ritiktulsyan674@gmail.com", "sarfrazsingh@gmail.com"];
const TEST_DOMAINS = ["testing.com", "example.com", "test.com", "placeholder.local", "mailinator.com", "example.org"];
function isTestBooking(b: any): boolean {
  const e = String(b.customer_email || b.client_email || "").toLowerCase();
  const n = String(b.customer_name || b.client_name || "").toLowerCase();
  const d = String(b.customer_phone || b.client_phone || "").replace(/[^0-9]/g, "");
  if (TEST_EMAILS.includes(e) || TEST_DOMAINS.some((x) => e.endsWith("@" + x)) || /\+(mctest|uitest)/.test(e)) return true;
  if (/\btest\b|\bprueba\b/.test(n)) return true;
  if (d === "15622355063" || d === "17867276503" || d === "34612474827" || /^3460000\d{4}$/.test(d) || (d.startsWith("86") && d.endsWith("997"))) return true;
  return false;
}
const SVC_ES_MAP: Array<[RegExp, string]> = [
  [/not sure|no lo sé|^massage$|massage treatment/i, "masaje"],
  [/deep tissue|descontracturante/i, "masaje descontracturante"],
  [/thai|tailand/i, "masaje tailandés"],
  [/hot stone|piedras/i, "masaje de piedras calientes"],
  [/sport|deportivo/i, "masaje deportivo"],
  [/balin/i, "masaje balinés"],
  [/shiatsu/i, "shiatsu"],
  [/reflexolog/i, "sesión de reflexología"],
  [/lymphatic|drenaje|linfatic/i, "drenaje linfático"],
  [/couples|pareja/i, "masaje en pareja"],
  [/kobido/i, "masaje facial Kobido"],
  [/relax|swedish|stress/i, "masaje relajante"],
];
// "su masaje deportivo"; an unknown name keeps its words after "masaje de".
function svcSu(n: unknown): string {
  const s = String(n || "").trim();
  for (const [re, es] of SVC_ES_MAP) if (re.test(s)) return es;
  return /^masaje\b/i.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : "masaje";
}
const ES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const ES_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// "del lunes 19 de octubre", or (relative, for WhatsApp) "de hoy" / "de mañana".
function deDia(isoDate: string, full: boolean): string {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const diff = Math.round((d.getTime() - Date.parse(today + "T00:00:00Z")) / 86400e3);
  if (!full && diff === 0) return "de hoy";
  if (!full && diff === 1) return "de mañana";
  return `del ${ES_DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${ES_MESES[d.getUTCMonth()]}`;
}
const waNum = (p: unknown) => { const d = String(p || "").replace(/[^0-9]/g, ""); return d.length === 9 && /^[6789]/.test(d) ? "34" + d : d; };

async function notifyCancellation(booking: any, _reason?: string) {
  // The reason is never passed on: it may be private, or in English.
  if (isTestBooking(booking)) { console.log(`[cancel] test contact, studio not told (booking ${booking.id})`); return; }
  const studio = booking.partners || {};
  const firstRaw = String(booking.customer_name || booking.client_name || "").trim().split(/\s+/)[0] || "";
  const first = firstRaw ? firstRaw.charAt(0).toUpperCase() + firstRaw.slice(1) : "El cliente";
  const time = String(booking.time_slot || booking.booking_time || "").slice(0, 5);
  const svc = svcSu(booking.service_name || booking.massage_type);
  const whenFull = [deDia(booking.booking_date, true), time ? `a las ${time}` : ""].filter(Boolean).join(" ");
  const whenRel = [deDia(booking.booking_date, false), time ? `a las ${time}` : ""].filter(Boolean).join(" ");
  const line = (w: string) => `${first} ha cancelado su ${svc}${w ? " " + w : ""}, así que podéis dar el hueco a otra persona. Perdonad las molestias.`;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const opsKey = Deno.env.get("OPS_KEY") ?? "";
  const studioWa = waNum(studio.whatsapp || studio.phone || "");

  // Email, always with the full date.
  if (studio.email && resendKey) {
    const subject = `${first} ha cancelado su masaje${whenFull ? " " + whenFull : ""}`;
    const text = [`Hola, equipo de ${studio.business_name || "centro"}:`, "", `Soy Jordan, de Massage Club, un servicio de reservas de masajes en Madrid. ${line(whenFull)}`, "", "Un saludo,", "Jordan, de Massage Club"].join("\n");
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:500px;margin:0 auto;color:#262019;font-size:15px;line-height:1.6;">${text.split("\n\n").map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [studio.email], reply_to: REPLY_TO, subject, text, html }),
    }).catch((e) => { console.log("[cancel] studio email failed", String(e)); return null; });
    console.log(`[cancel] studio email -> ${studio.email}: ${res ? res.status : "failed"}`);
    if (res?.ok && opsKey) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/wa-bot`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(25000),
          body: JSON.stringify({ ops: "studio_copy", key: opsKey, studio: studio.business_name || studio.email, phone: studioWa, text, subject, channel: "Email" }),
        });
      } catch (e) { console.log("[cancel] studio_copy failed", String(e)); }
    }
  }

  // WhatsApp through dispatch-studios: free text inside their 24h window, the
  // approved note template outside it; hours, pause and logging handled there.
  if (studioWa && svcKey) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-studios`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` }, signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ studio_note: { phone: studioWa, text: `Hola, buenas. ${line(whenRel)}`, short: "ha cancelado, así que podéis dar el hueco a otra persona", time, first_name: firstRaw ? first : "", day: deDia(booking.booking_date, true).replace(/^del /, "el ") } }),
      });
      console.log(`[cancel] studio whatsapp note -> ${studioWa}: ${res.status}`);
    } catch (e) { console.log("[cancel] studio whatsapp note failed", String(e)); }
  }
}
