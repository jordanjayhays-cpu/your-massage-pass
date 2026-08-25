import { waDigits } from "@/app/lib/whatsapp";

export type WaBooking = {
  client_name?: string | null;
  client_phone?: string | null;
  spa_name?: string | null;
  massage_type?: string | null;
  booking_date?: string | null;
  booking_time?: string | null;
  lang?: string | null;
  client_lang?: string | null;
};

export type WaPartner = {
  business_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
};

const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "";
const serviceLabel = (b: WaBooking) => String(b.massage_type || "masaje").replace(/_/g, " ");
const dayLabel = (b: WaBooking) => b.booking_date || "";
const timeLabel = (b: WaBooking) => b.booking_time || "";

export function bookingLang(b: WaBooking): "es" | "en" {
  const l = String(b.lang || b.client_lang || "en").slice(0, 2).toLowerCase();
  return l === "es" ? "es" : "en";
}

/** Reminder we send to the client, in the booking's language. */
export function clientReminder(b: WaBooking, p?: WaPartner | null): string {
  const name = firstName(b.client_name) || (bookingLang(b) === "es" ? "" : "");
  const studio = b.spa_name || p?.business_name || "the studio";
  const address = p?.address ? ` ${bookingLang(b) === "es" ? "Dirección" : "Address"}: ${p.address}.` : "";
  if (bookingLang(b) === "es") {
    return `Hola ${name}! Somos Massage Club. Recordatorio de tu ${serviceLabel(b)} en ${studio} el ${dayLabel(b)} a las ${timeLabel(b)}.${address} Nos vemos!`;
  }
  return `Hi ${name}! Massage Club here. Reminder of your ${serviceLabel(b)} at ${studio} on ${dayLabel(b)} at ${timeLabel(b)}.${address} See you there!`;
}

/** Spanish confirmation nudge we send to the studio. */
export function studioReminder(b: WaBooking): string {
  const name = (b.client_name || "un cliente").trim();
  return `Hola! Massage Club por aquí. Recordatorio: mañana tenéis a ${name}, ${serviceLabel(b)}, ${dayLabel(b)} ${timeLabel(b)}. Todo en pie, verdad?`;
}

const btn =
  "inline-flex items-center justify-center h-8 px-3 rounded-full text-[11px] font-semibold text-white whitespace-nowrap";

function waLink(number: string | null | undefined, text: string): string | null {
  const digits = waDigits(number || "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function BookingWaButtons({ booking, partner }: { booking: WaBooking; partner?: WaPartner | null }) {
  const clientHref = waLink(booking.client_phone, clientReminder(booking, partner));
  const studioHref = waLink(partner?.whatsapp || partner?.phone, studioReminder(booking));
  if (!clientHref && !studioHref) return null;
  return (
    <span className="flex gap-1.5 flex-wrap">
      {clientHref && (
        <a href={clientHref} target="_blank" rel="noreferrer" className={btn} style={{ background: "#25D366" }}>
          WhatsApp client
        </a>
      )}
      {studioHref && (
        <a href={studioHref} target="_blank" rel="noreferrer" className={btn} style={{ background: "#C4622D" }}>
          WhatsApp studio
        </a>
      )}
    </span>
  );
}
