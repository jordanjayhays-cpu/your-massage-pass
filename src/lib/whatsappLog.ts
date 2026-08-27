import { supabase } from "@/lib/supabase";

export type WhatsappRequestLog = {
  partner_id?: string | null;
  slug?: string | null;
  studio_name: string;
  service_name?: string | null;
  price?: number | string | null;
  day1?: string | null;
  time1?: string | null;
  day2?: string | null;
  time2?: string | null;
  first_name?: string | null;
  contact_email?: string | null;
  client_phone?: string | null;
  /** Comma separated list of languages the visitor speaks. */
  languages?: string | null;
  user_id?: string | null;
  wa_number?: string | null;
  message_text?: string | null;
};

const clean = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

// Rows are only useful when they carry a uuid, so anything else is dropped.
const uuidOrNull = (v?: string | null): string | null =>
  v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;

/**
 * Log a WhatsApp handoff to whatsapp_requests.
 * Returns a promise so callers can await the insert before opening the wa.me link.
 * Never throws: the promise always resolves, even on error.
 */
export function logWhatsappRequest(row: WhatsappRequestLog): Promise<void> {
  try {
    const payload = {
      partner_id: uuidOrNull(row.partner_id ?? null),
      slug: clean(row.slug),
      studio_name: clean(row.studio_name) || "Unknown studio",
      service_name: clean(row.service_name),
      price: clean(row.price),
      day1: clean(row.day1),
      time1: clean(row.time1),
      day2: clean(row.day2),
      time2: clean(row.time2),
      first_name: clean(row.first_name),
      contact_email: clean(row.contact_email),
      client_phone: clean(row.client_phone),
      languages: clean(row.languages),
      user_id: uuidOrNull(row.user_id ?? null),
      wa_number: clean(row.wa_number),
      message_text: clean(row.message_text),
    };
    return supabase
      .from("whatsapp_requests")
      .insert(payload as any)
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Logging must never break the handoff.
    return Promise.resolve();
  }
}
