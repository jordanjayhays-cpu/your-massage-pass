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
  day3?: string | null;
  time3?: string | null;
  first_name?: string | null;
  last_name?: string | null;
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
 * Resolves with the new row id when the database gives it back, so the request
 * can later be attached to an account. Never throws.
 */
export async function logWhatsappRequest(row: WhatsappRequestLog): Promise<string | null> {
  return (await logWhatsappRequestResult(row)).id;
}

/**
 * Same insert, but also reports why it failed so callers can send the error
 * message into funnel analytics. Never throws.
 */
export async function logWhatsappRequestResult(
  row: WhatsappRequestLog,
): Promise<{ id: string | null; error: string | null }> {
  try {
    // Generate the id client-side. whatsapp_requests has an anon INSERT policy but
    // intentionally NO SELECT policy (customer PII), so chaining .select() on the
    // insert makes PostgREST reject it with an RLS violation. Including the id in
    // the payload lets callers know the row id without reading it back.
    const id = crypto.randomUUID();
    const payload = {
      id,
      partner_id: uuidOrNull(row.partner_id ?? null),
      slug: clean(row.slug),
      studio_name: clean(row.studio_name) || "Unknown studio",
      service_name: clean(row.service_name),
      price: clean(row.price),
      day1: clean(row.day1),
      time1: clean(row.time1),
      day2: clean(row.day2),
      time2: clean(row.time2),
      day3: clean(row.day3),
      time3: clean(row.time3),
      first_name: clean(row.first_name),
      last_name: clean(row.last_name),
      contact_email: clean(row.contact_email),
      client_phone: clean(row.client_phone),
      languages: clean(row.languages),
      user_id: uuidOrNull(row.user_id ?? null),
      wa_number: clean(row.wa_number),
      message_text: clean(row.message_text),
    };
    const { error } = await supabase
      .from("whatsapp_requests")
      .insert(payload as any);
    if (error) return { id: null, error: String(error.message || "insert_error").slice(0, 200) };
    return { id, error: null };
  } catch (e) {
    // Logging must never break the handoff.
    return { id: null, error: String((e as Error)?.message || e || "network_error").slice(0, 200) };
  }
}

