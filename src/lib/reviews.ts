import { supabase } from "@/lib/supabase";
import { toFlowLang, type FlowLang } from "@/lib/flowLang";
import { monthYear } from "@/lib/localeFormat";

/* ─────────── Review tag vocabulary ───────────
 * Chip keys are stored in reviews.tags. Labels live here so the review form and
 * the public studio page always agree.
 */
export type Lang = FlowLang;

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

const TAG_LABELS: Record<string, Record<FlowLang, string>> = {
  great_pressure: {
    en: "Great pressure", es: "Presión perfecta", fr: "Pression parfaite", de: "Perfekter Druck",
    it: "Pressione perfetta", pt: "Pressão perfeita", zh: "力度很棒",
  },
  very_clean: {
    en: "Very clean", es: "Muy limpio", fr: "Très propre", de: "Sehr sauber",
    it: "Molto pulito", pt: "Muito limpo", zh: "非常干净",
  },
  relaxing_vibe: {
    en: "Relaxing vibe", es: "Ambiente relajante", fr: "Ambiance relaxante", de: "Entspannte Atmosphäre",
    it: "Atmosfera rilassante", pt: "Ambiente relaxante", zh: "氛围很放松",
  },
  friendly_team: {
    en: "Friendly team", es: "Equipo amable", fr: "Équipe sympathique", de: "Freundliches Team",
    it: "Staff gentile", pt: "Equipe simpática", zh: "团队友好",
  },
  good_value: {
    en: "Good value", es: "Buena relación calidad-precio", fr: "Bon rapport qualité-prix", de: "Gutes Preis-Leistungs-Verhältnis",
    it: "Buon rapporto qualità-prezzo", pt: "Boa relação custo-benefício", zh: "性价比高",
  },
  english_spoken: {
    en: "English spoken", es: "Hablan inglés", fr: "On parle anglais", de: "Englisch wird gesprochen",
    it: "Si parla inglese", pt: "Falam inglês", zh: "会讲英语",
  },
  pressure_off: {
    en: "Pressure was off", es: "La presión no era la adecuada", fr: "La pression n'était pas la bonne", de: "Der Druck hat nicht gepasst",
    it: "La pressione non era giusta", pt: "A pressão não estava certa", zh: "力度不太合适",
  },
  cleanliness: {
    en: "Cleanliness", es: "Limpieza", fr: "Propreté", de: "Sauberkeit",
    it: "Pulizia", pt: "Limpeza", zh: "清洁度",
  },
  waiting_time: {
    en: "Waiting time", es: "Tiempo de espera", fr: "Temps d'attente", de: "Wartezeit",
    it: "Tempo di attesa", pt: "Tempo de espera", zh: "等待时间",
  },
  communication: {
    en: "Communication", es: "Comunicación", fr: "Communication", de: "Kommunikation",
    it: "Comunicazione", pt: "Comunicação", zh: "沟通",
  },
  not_as_described: {
    en: "Not as described", es: "No era lo descrito", fr: "Ne correspondait pas à la description", de: "Nicht wie beschrieben",
    it: "Non come descritto", pt: "Não era como descrito", zh: "与描述不符",
  },
};

export function reviewTagLabel(key: string, lang: string = "en"): string {
  const known = TAG_LABELS[key];
  if (known) return known[toFlowLang(lang)];
  const words = String(key || "").replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/* ─────────── Public reviews (anonymous read) ─────────── */

export type PublicReview = {
  id: string;
  partner_id: string;
  rating: number;
  tags: string[] | null;
  custom_tag: string | null;
  comment: string | null;
  display_name: string | null;
  would_return: boolean | null;
  cleanliness: number | null;
  ambience: number | null;
  pressure_feedback: "too_soft" | "perfect" | "too_strong" | null;
  created_at: string;
};

const PUBLIC_COLUMNS =
  "id,partner_id,rating,tags,custom_tag,comment,display_name,would_return,cleanliness,ambience,pressure_feedback,created_at";

/**
 * Published reviews for one studio, newest first.
 * Reads the `public_reviews` view, which exposes public columns only — private
 * notes and emails are never sent to the browser. Category scores come through
 * for the aggregate bars; individual cards never render them.
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
  /** average 1-5, null when nobody answered */
  cleanliness: number | null;
  ambience: number | null;
  /** share of answers that said the pressure was just right, 0-1 */
  pressureRight: number | null;
  pressureAnswers: number;
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function summariseReviews(reviews: PublicReview[]): ReviewSummary {
  const histogram: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  const tagCounts: Record<string, number> = {};
  const clean: number[] = [];
  const amb: number[] = [];
  let pressureAnswers = 0;
  let pressureRightCount = 0;

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
    if (r.cleanliness != null && Number(r.cleanliness) > 0) clean.push(Number(r.cleanliness));
    if (r.ambience != null && Number(r.ambience) > 0) amb.push(Number(r.ambience));
    if (r.pressure_feedback) {
      pressureAnswers += 1;
      if (r.pressure_feedback === "perfect") pressureRightCount += 1;
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
    cleanliness: avg(clean),
    ambience: avg(amb),
    pressureRight: pressureAnswers ? pressureRightCount / pressureAnswers : null,
    pressureAnswers,
  };
}

/** "March 2026" / "marzo 2026" - localized month + year for a review date. */
export function reviewDateLabel(iso: string, lang: string = "en"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return monthYear(d, lang);
}

/** "Jordan H." from a booking name. */
export function suggestDisplayName(fullName?: string | null): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}
