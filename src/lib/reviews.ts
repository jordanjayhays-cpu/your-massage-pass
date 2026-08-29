import { supabase } from "@/lib/supabase";

/* ─────────── Review tag vocabulary ───────────
 * Chip keys are stored in reviews.tags. Labels live here so the review form and
 * the public studio page always agree.
 */
export type Lang = "en" | "es";

export const COMPLIMENT_TAGS = [
  "great_pressure",
  "very_clean",
  "relaxing_vibe",
  "friendly_team",
  "good_value",
  "english_spoken",
] as const;

export const ISSUE_TAGS = [
  "pressure_off",
  "cleanliness",
  "waiting_time",
  "communication",
  "not_as_described",
] as const;

const TAG_LABELS: Record<string, { en: string; es: string }> = {
  great_pressure: { en: "Great pressure", es: "Presión perfecta" },
  very_clean: { en: "Very clean", es: "Muy limpio" },
  relaxing_vibe: { en: "Relaxing vibe", es: "Ambiente relajante" },
  friendly_team: { en: "Friendly team", es: "Equipo amable" },
  good_value: { en: "Good value", es: "Buena relación calidad-precio" },
  english_spoken: { en: "English spoken", es: "Hablan inglés" },
  pressure_off: { en: "Pressure was off", es: "La presión no era la adecuada" },
  cleanliness: { en: "Cleanliness", es: "Limpieza" },
  waiting_time: { en: "Waiting time", es: "Tiempo de espera" },
  communication: { en: "Communication", es: "Comunicación" },
  not_as_described: { en: "Not as described", es: "No era lo descrito" },
};

export function reviewTagLabel(key: string, lang: Lang = "en"): string {
  const known = TAG_LABELS[key];
  if (known) return known[lang];
  const words = String(key || "").replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/* ─────────── Public reviews (anonymous read) ─────────── */

export type PublicReview = {
  id: string;
  partner_id: string;
  rating: number;
  tags: string[] | null;
  comment: string | null;
  display_name: string | null;
  would_return: boolean | null;
  created_at: string;
};

const PUBLIC_COLUMNS = "id,partner_id,rating,tags,comment,display_name,would_return,created_at";

/**
 * Published reviews for one studio, newest first.
 * Reads the `public_reviews` view, which exposes public columns only — private
 * notes, emails and pressure feedback are never sent to the browser.
 */
export async function fetchPublicReviews(partnerId: string): Promise<PublicReview[]> {
  if (!partnerId) return [];
  const { data, error } = await supabase
    .from("public_reviews")
    .select(PUBLIC_COLUMNS)
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    // The view may not exist yet in an environment; fail quiet, show empty state.
    console.warn("[reviews] could not load public reviews:", error.message);
    return [];
  }
  return (data ?? []) as PublicReview[];
}

export type ReviewSummary = {
  count: number;
  average: number | null;
  /** histogram[5] … histogram[1] */
  histogram: Record<number, number>;
  topTags: { key: string; count: number }[];
};

export function summariseReviews(reviews: PublicReview[]): ReviewSummary {
  const histogram: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  const tagCounts: Record<string, number> = {};
  for (const r of reviews) {
    const n = Math.round(Number(r.rating));
    if (n >= 1 && n <= 5) {
      histogram[n] += 1;
      total += n;
    }
    for (const t of r.tags ?? []) {
      if (!t) continue;
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }
  const count = reviews.length;
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, c]) => ({ key, count: c }));
  return {
    count,
    average: count ? Math.round((total / count) * 10) / 10 : null,
    histogram,
    topTags,
  };
}

/** "March 2026" / "marzo 2026" */
export function reviewDateLabel(iso: string, lang: Lang = "en"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", { month: "long", year: "numeric" });
}

/** "Jordan H." from a booking name. */
export function suggestDisplayName(fullName?: string | null): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}
