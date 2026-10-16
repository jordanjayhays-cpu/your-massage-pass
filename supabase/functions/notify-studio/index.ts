// Supabase Edge Function: notify-studio
// Called by the website right after a booking row is written (StudioBookingPage
// and Payment invoke it with {type: "INSERT", table: "bookings", record}), and
// by the bookings INSERT webhook where one is set up.
//
// v2 (16 Oct, Jordan: "i don't want it to look robotic ... i see a weird
// message not a normal message"). The studio's email was English ("New Booking
// Received!", "Member:", "Log in to your studio portal"), carried an em dash,
// came from the old massagepass.app domain and linked a vercel.app portal.
// Now it is Spanish and reads like Jordan wrote it: "Hola, equipo de X:", who
// we are in one line, what the client asked for, "Todavía no está confirmada",
// the book.massageclub.io portal, "Jordan, de Massage Club". Test contacts
// never reach a studio. Everything the client typed is escaped. Jordan gets a
// copy of the email (wa-bot studio_copy, needs OPS_KEY in this function's env).
//
// The Twilio WhatsApp is gone: its To field read "whatsapp:whatsapp:+34 612..."
// and it went from a non-business sender with no approved template, so it
// never arrived. The WhatsApp note now goes through dispatch-studios'
// studio_note (Massage Club's own number, logged, copied to Jordan, the
// studio's hours and the outreach pause respected, the approved template
// outside the 24h window). It stays OFF until NOTIFY_STUDIO_WHATSAPP=on is
// set, because it is a new automatic message to studios and Jordan approves
// those (CLAUDE.md).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const OPS_KEY = Deno.env.get("OPS_KEY") ?? "";
// Only a massageclub.io sender; an old FROM_EMAIL secret (massagepass.app) is ignored.
const ENV_FROM = Deno.env.get("FROM_EMAIL") ?? "";
const FROM_EMAIL = /@massageclub\.io>?\s*$/i.test(ENV_FROM) ? ENV_FROM : "Massage Club <support@massageclub.io>";
const REPLY_TO = "support@massageclub.io";
const PORTAL = "https://book.massageclub.io/studio-portal";
const WA_NOTES = (Deno.env.get("NOTIFY_STUDIO_WHATSAPP") || "").toLowerCase() === "on";

interface BookingRecord {
  id: string;
  partner_id: string;
  client_name: string;
  client_phone?: string;
  client_email?: string | null;
  massage_type: string;
  booking_date: string;
  booking_time: string;
  duration: number;
  notes?: string;
}

// Same lists as notify-whatsapp-request: Jordan's own addresses, the friend
// testers, test domains and names. None of these may ever reach a studio.
const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu", "longyi_elon@outlook.com", "geromin.nepomuceno@student.ie.edu", "ritiktulsyan674@gmail.com", "sarfrazsingh@gmail.com"];
const TEST_DOMAINS = ["testing.com", "example.com", "test.com", "placeholder.local", "mailinator.com", "example.org"];
const isTestContact = (email?: string | null, name?: string | null) => {
  const e = String(email || "").toLowerCase();
  const n = String(name || "").toLowerCase();
  if (TEST_EMAILS.includes(e)) return true;
  if (TEST_DOMAINS.some((d) => e.endsWith("@" + d))) return true;
  if (/\+(mctest|uitest)/.test(e)) return true;
  if (/\btest\b|\bprueba\b/.test(n)) return true;
  return false;
};
const isTestPhone = (p?: string | null) => {
  const d = String(p || "").replace(/[^0-9]/g, "");
  if (d === "15622355063" || d === "17867276503" || d === "34612474827") return true;
  if (d.startsWith("86") && d.endsWith("997")) return true;
  if (/^3460000\d{4}$/.test(d)) return true;
  return false;
};

// The website sends English service names; a studio reads Spanish.
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
const svcEs = (n?: string | null): string => {
  const s = String(n || "").trim();
  for (const [re, es] of SVC_ES_MAP) if (re.test(s)) return es;
  return s || "Masaje";
};
// "un masaje deportivo", "una sesión de reflexología".
const svcConUn = (n?: string | null): string => {
  const v = svcEs(n);
  if (/^masaje$/i.test(v)) return "un masaje";
  if (/^reflexolog/i.test(v)) return "una sesión de reflexología";
  const low = v.charAt(0).toLowerCase() + v.slice(1);
  if (/^(un|una)\s/i.test(low)) return low;
  return SVC_ES_MAP.some(([, es]) => es === v) || /^(masaje|drenaje|shiatsu)\b/i.test(low) ? `un ${low}` : `una sesión de ${low}`;
};
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const capFirst = (t: string) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
const cleanFirst = (n: unknown) => {
  const f = String(n || "").trim().split(/\s+/)[0] || "";
  return /^(whatsapp|cliente|client|customer|guest|-)$/i.test(f) ? "" : capFirst(f);
};
const waNum = (p: unknown) => { const d = String(p || "").replace(/[^0-9]/g, ""); return d.length === 9 && /^[6789]/.test(d) ? "34" + d : d; };

// booking_date is a calendar date (YYYY-MM-DD), read as such. full = always
// "el lunes 19 de octubre" (emails); otherwise "hoy" / "mañana" when it is.
const ES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const ES_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function diaEs(isoDate: string, full: boolean): string {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const diff = Math.round((d.getTime() - Date.parse(today + "T00:00:00Z")) / 86400e3);
  if (!full && diff === 0) return "hoy";
  if (!full && diff === 1) return "mañana";
  return `el ${ES_DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${ES_MESES[d.getUTCMonth()]}`;
}
const timeOf = (t: unknown) => {
  const m = String(t || "").match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
};

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
  if (isTestContact(booking.client_email, booking.client_name) || isTestPhone(booking.client_phone)) {
    console.log(`[notify-studio] test contact, studio not notified (booking ${booking.id})`);
    return new Response("OK", { status: 200 });
  }

  // Fetch studio info
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const H = { "apikey": supabaseServiceKey, "Authorization": `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" };

  const partnerRes = await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${encodeURIComponent(partnerId)}&select=business_name,email,phone,whatsapp`, { headers: H });
  const partners = await partnerRes.json().catch(() => []);
  const studio = Array.isArray(partners) ? partners[0] : null;
  const studioWa = waNum(studio?.whatsapp || studio?.phone || "");
  if (!studio?.email && !(WA_NOTES && studioWa)) {
    console.log("No studio email found, skipping");
    return new Response("OK", { status: 200 });
  }

  const first = cleanFirst(booking.client_name) || "Un cliente";
  const time = timeOf(booking.booking_time) || String(booking.booking_time || "");
  const mins = Number(booking.duration) || 60;
  const diaFull = diaEs(booking.booking_date, true);
  const at = `${diaFull ? diaFull + " " : ""}a las ${time}`;
  const what = `${svcConUn(booking.massage_type)} de ${mins} min ${at}`;
  const phone = String(booking.client_phone || "").trim();
  const notes = String(booking.notes || "").trim();

  // ── 1. Email ──
  let emailed = false;
  if (studio?.email) {
    const subject = `${first} quiere reservar con vosotros ${at}`;
    const hello = `Hola, equipo de ${studio.business_name || "centro"}:`;
    const intro = `Soy Jordan, de Massage Club, un servicio de reservas de masajes en Madrid. ${first} ha pedido cita con vosotros desde vuestra página:`;
    const details = [`${svcEs(booking.massage_type)}, ${mins} min`, capFirst(at), phone ? `Teléfono: ${phone}` : "", notes ? `Nota del cliente: ${notes}` : ""].filter(Boolean);
    const pending = "Todavía no está confirmada. Entrad en vuestro portal para aceptarla o rechazarla:";
    const P = (t: string, extra = "") => `<p style="margin:0 0 14px;color:#262019;font-size:15px;line-height:1.6;${extra}">${t}</p>`;
    const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:500px;margin:0 auto;padding:8px 4px;">
      ${P(esc(hello))}
      ${P(esc(intro))}
      ${P(details.map(esc).join("<br>"), "padding:12px 16px;background:#FAF6F0;border-radius:12px;")}
      ${P(esc(pending))}
      <a href="${PORTAL}" style="display:inline-block;background:#1A9C56;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;margin:0 0 18px;">Abrir el portal</a>
      ${P("Un saludo,<br>Jordan, de Massage Club", "margin:0;")}
    </div>`;
    const text = [
      hello, "",
      `Soy Jordan, de Massage Club, un servicio de reservas de masajes en Madrid. ${first} ha pedido cita con vosotros desde vuestra página: ${what}.${phone ? ` Su teléfono es ${phone}.` : ""}${notes ? ` Nota del cliente: ${notes}` : ""}`, "",
      `Todavía no está confirmada. Podéis aceptarla o rechazarla en vuestro portal: ${PORTAL}`, "",
      "Un saludo,", "Jordan, de Massage Club",
    ].join("\n");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [studio.email], reply_to: REPLY_TO, subject, html, text }),
    }).catch((e) => { console.log("[notify-studio] email failed", String(e)); return null; });
    emailed = !!res?.ok;
    console.log(`[notify-studio] email -> ${studio.email}: ${res ? res.status : "failed"}`);
    // Jordan's copy of what the studio got, same card as every other studio message.
    if (emailed) {
      if (!OPS_KEY) console.log("[notify-studio] no OPS_KEY, Jordan's copy not sent");
      else {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/wa-bot`, {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(25000),
            body: JSON.stringify({ ops: "studio_copy", key: OPS_KEY, studio: studio.business_name || studio.email, phone: studioWa, text, subject, channel: "Email" }),
          });
        } catch (e) { console.log("[notify-studio] studio_copy failed", String(e)); }
      }
    }
  }

  // ── 2. WhatsApp note through dispatch-studios (off until Jordan approves) ──
  if (WA_NOTES && studioWa && time) {
    const prior = await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${studioWa}&direction=eq.out&select=id&limit=1`, { headers: H }).then((r) => r.json()).catch(() => []);
    const intro = !(Array.isArray(prior) && prior.length);
    const diaW = diaEs(booking.booking_date, false);
    const text = [
      "Hola, buenas.",
      intro ? "Somos Massage Club, un servicio de reservas de masajes en Madrid." : "",
      `${first} ha pedido cita con vosotros desde vuestra página en Massage Club: ${svcConUn(booking.massage_type)} de ${mins} min ${diaW ? diaW + " " : ""}a las ${time}.`,
      emailed ? "Os he mandado los detalles por email." : "",
      "Podéis aceptarla o rechazarla en vuestro portal: book.massageclub.io/studio-portal",
    ].filter(Boolean).join(" ") + (intro ? "\n\nJordan, de Massage Club" : "");
    // Outside their 24h window dispatch-studios sends the approved note
    // template; this is the part after the client, day and hour.
    const short = "ha pedido cita con vosotros desde vuestra página en Massage Club; podéis aceptarla o rechazarla en book.massageclub.io/studio-portal";
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-studios`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` }, signal: AbortSignal.timeout(25000),
        // first_name and day ride along for the template's "{{1}}"; dispatch
        // reads the request row for those when there is one, and here there is not.
        body: JSON.stringify({ studio_note: { phone: studioWa, text, short, time, first_name: cleanFirst(booking.client_name), day: diaEs(booking.booking_date, true) } }),
      });
      console.log(`[notify-studio] whatsapp note -> ${studioWa}: ${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}`);
    } catch (e) { console.log("[notify-studio] whatsapp note failed", String(e)); }
  }

  return new Response("OK", { status: 200 });
});
