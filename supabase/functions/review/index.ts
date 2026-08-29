// Post-massage review endpoint.
//
// GET  /review?token=<bookings.action_token>  -> booking context + any existing review
// POST /review  { token, rating, tags, comment, private_note, display_name, would_return, lang }
//
// The browser never touches the reviews table directly: this function runs with
// the service role and the booking token is the only credential.
//
// NOTE: this file is the source of truth for the deployed function. Deploy with:
//   supabase functions deploy review --project-ref jglftdstrowwckwqmpue --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED_TAGS = new Set([
  "great_pressure", "very_clean", "relaxing_vibe", "friendly_team", "good_value", "english_spoken",
  "pressure_off", "cleanliness", "waiting_time", "communication", "not_as_described",
]);

const clean = (v: unknown, max = 1000): string | null => {
  if (v == null) return null;
  const s = String(v).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return s || null;
};

async function bookingFor(token: string) {
  const { data } = await admin
    .from("bookings")
    .select("id, partner_id, user_id, client_name, client_email, spa_name, massage_type, booking_date, booking_time, status, lang")
    .eq("action_token", token)
    .maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method === "GET") {
      const token = new URL(req.url).searchParams.get("token") || "";
      if (!token) return json({ error: "missing token" }, 400);

      const b = await bookingFor(token);
      if (!b) return json({ error: "not found" }, 404);

      let slug: string | null = null;
      if (b.partner_id) {
        const { data: p } = await admin.from("partners").select("slug").eq("id", b.partner_id).maybeSingle();
        slug = p?.slug ?? null;
      }

      const { data: review } = await admin
        .from("reviews")
        .select("rating, would_return, pressure_feedback, cleanliness, ambience, comment, tags, private_note, display_name")
        .eq("booking_id", b.id)
        .maybeSingle();

      return json({
        studio: b.spa_name,
        slug,
        service: b.massage_type,
        date: b.booking_date,
        time: b.booking_time,
        name: b.client_name,
        lang: b.lang || "en",
        status: b.status,
        cancelled: b.status === "cancelled",
        review: review ?? null,
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const token = clean(body?.token, 200);
      if (!token) return json({ error: "missing token" }, 400);

      const b = await bookingFor(token);
      if (!b) return json({ error: "not found" }, 404);
      if (b.status === "cancelled") return json({ error: "cancelled" }, 409);

      const rating = Math.round(Number(body?.rating));
      if (!(rating >= 1 && rating <= 5)) return json({ error: "invalid rating" }, 400);

      const tags = Array.isArray(body?.tags)
        ? [...new Set(body.tags.map((t: unknown) => String(t)).filter((t: string) => ALLOWED_TAGS.has(t)))]
        : [];

      const score = (v: unknown): number | null => {
        const n = Math.round(Number(v));
        return n >= 1 && n <= 5 ? n : null;
      };
      const pressure = ["too_soft", "perfect", "too_strong"].includes(String(body?.pressure_feedback))
        ? String(body.pressure_feedback)
        : null;

      // The wizard saves after every step, so a half-finished review still keeps
      // the stars. Each upsert carries the full known state of the review.
      const row = {
        booking_id: b.id,
        partner_id: b.partner_id,
        user_id: b.user_id,
        client_email: b.client_email,
        rating,
        pressure_feedback: pressure,
        cleanliness: score(body?.cleanliness),
        ambience: score(body?.ambience),
        would_return: typeof body?.would_return === "boolean" ? body.would_return : null,
        comment: clean(body?.comment),
        private_note: clean(body?.private_note),
        display_name: clean(body?.display_name, 60),
        tags,
        lang: clean(body?.lang, 5) || b.lang || "en",
        published: true,
      };

      const { error } = await admin.from("reviews").upsert(row, { onConflict: "booking_id" });
      if (error) return json({ error: error.message }, 500);

      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
