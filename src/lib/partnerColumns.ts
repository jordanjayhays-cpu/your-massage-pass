/**
 * The partners columns the public key and signed-in studios may read.
 *
 * Why (24 Nov 2026, Jordan: "Yes, close it now"): select("*") on partners
 * returned every studio's claim code, hours code and Google calendar tokens
 * to anyone with the public key. Migration 20261124e_partners_column_lock.sql
 * grants SELECT on exactly these columns, so select("*") on partners fails
 * after it. Read partners with this list (or a shorter named list), never "*".
 *
 * Keep it in step with the GRANT SELECT in 20261124e. A new partners column
 * needs its own GRANT before the site can read it. Never add a token, code or
 * secret column (claim_token, hours_token, hours_code, google_*) here.
 */
export const PARTNER_PUBLIC_COLUMN_LIST = [
  "id", "business_name", "email", "phone", "website", "address", "address_line2", "postal_code",
  "city", "country", "description", "latitude", "longitude", "google_place_id", "logo_url", "cover_url",
  "gallery", "amenities", "languages", "payment_methods", "instagram", "timezone", "currency", "service_location",
  "price_from", "cancellation_hours", "cancellation_policy", "deposit_required", "deposit_pct", "google_calendar_connected", "auto_confirm_bookings", "status",
  "created_at", "updated_at", "opening_hours", "capacity", "access_instructions", "whatsapp", "slug", "booking_method",
  "google_rating", "google_reviews", "outreach_status", "outreach_email_at", "staff_count", "preferred_language", "hours_confirmed_at", "neighbourhood",
  "opted_out_at", "venue_type", "match_boost", "mc_discount_pct", "booking_mode", "booking_url", "partner_need", "booking_tools",
] as const;

export const PARTNER_PUBLIC_COLUMNS: string = PARTNER_PUBLIC_COLUMN_LIST.join(", ");
