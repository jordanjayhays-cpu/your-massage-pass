import { useEffect, useState } from "react";
import { BadgeCheck, Star } from "lucide-react";

import {
  fetchPublicReviews,
  summariseReviews,
  reviewTagLabel,
  type PublicReview,
} from "@/lib/reviews";
import { toFlowLang, type FlowLang } from "@/lib/flowLang";
import { monthYear } from "@/lib/localeFormat";

const COPY = {
  en: {
    heading: "Verified reviews",
    sub: "Only from clients who booked through Massage Club.",
    empty: "No reviews yet. Reviews come only from verified Massage Club bookings.",
    review: (n: number) => (n === 1 ? "review" : "reviews"),
    pressureRight: "Pressure just right",
    cleanliness: "Cleanliness",
    atmosphere: "Atmosphere",
    fallbackName: "Massage Club client",
    verifiedBooking: "Verified booking",
    showAll: (n: number) => `Show all ${n} reviews`,
  },
  es: {
    heading: "Opiniones verificadas",
    sub: "Solo de clientes que reservaron con Massage Club.",
    empty: "Todavía no hay opiniones. Las opiniones vienen solo de reservas verificadas de Massage Club.",
    review: (n: number) => (n === 1 ? "opinión" : "opiniones"),
    pressureRight: "Presión perfecta",
    cleanliness: "Limpieza",
    atmosphere: "Ambiente",
    fallbackName: "Cliente de Massage Club",
    verifiedBooking: "Reserva verificada",
    showAll: (n: number) => `Ver las ${n} opiniones`,
  },
  fr: {
    heading: "Avis vérifiés",
    sub: "Uniquement des clients ayant réservé via Massage Club.",
    empty: "Pas encore d'avis. Les avis proviennent uniquement de réservations vérifiées Massage Club.",
    review: (n: number) => (n === 1 ? "avis" : "avis"),
    pressureRight: "Pression parfaite",
    cleanliness: "Propreté",
    atmosphere: "Ambiance",
    fallbackName: "Client Massage Club",
    verifiedBooking: "Réservation vérifiée",
    showAll: (n: number) => `Voir les ${n} avis`,
  },
  de: {
    heading: "Verifizierte Bewertungen",
    sub: "Nur von Kunden, die über Massage Club gebucht haben.",
    empty: "Noch keine Bewertungen. Bewertungen stammen nur von verifizierten Massage-Club-Buchungen.",
    review: (n: number) => (n === 1 ? "Bewertung" : "Bewertungen"),
    pressureRight: "Druck genau richtig",
    cleanliness: "Sauberkeit",
    atmosphere: "Atmosphäre",
    fallbackName: "Massage Club Kunde",
    verifiedBooking: "Verifizierte Buchung",
    showAll: (n: number) => `Alle ${n} Bewertungen anzeigen`,
  },
  it: {
    heading: "Recensioni verificate",
    sub: "Solo da clienti che hanno prenotato con Massage Club.",
    empty: "Ancora nessuna recensione. Le recensioni provengono solo da prenotazioni verificate Massage Club.",
    review: (n: number) => (n === 1 ? "recensione" : "recensioni"),
    pressureRight: "Pressione perfetta",
    cleanliness: "Pulizia",
    atmosphere: "Atmosfera",
    fallbackName: "Cliente Massage Club",
    verifiedBooking: "Prenotazione verificata",
    showAll: (n: number) => `Vedi tutte le ${n} recensioni`,
  },
  pt: {
    heading: "Avaliações verificadas",
    sub: "Apenas de clientes que reservaram pela Massage Club.",
    empty: "Ainda não há avaliações. As avaliações vêm apenas de reservas verificadas da Massage Club.",
    review: (n: number) => (n === 1 ? "avaliação" : "avaliações"),
    pressureRight: "Pressão perfeita",
    cleanliness: "Limpeza",
    atmosphere: "Ambiente",
    fallbackName: "Cliente Massage Club",
    verifiedBooking: "Reserva verificada",
    showAll: (n: number) => `Ver todas as ${n} avaliações`,
  },
  zh: {
    heading: "已验证评价",
    sub: "仅来自通过 Massage Club 预约的客户。",
    empty: "还没有评价。评价仅来自经过验证的 Massage Club 预约。",
    review: (n: number) => "条评价",
    pressureRight: "力度刚好",
    cleanliness: "清洁度",
    atmosphere: "氛围",
    fallbackName: "Massage Club 客户",
    verifiedBooking: "已验证预约",
    showAll: (n: number) => `查看全部 ${n} 条评价`,
  },
} as const;

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= n ? "text-[#C4622D]" : "text-[#E2D8CB]"}
          fill={i <= n ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

/**
 * "Verified reviews" block for a studio profile.
 * Reads published reviews only, through the public_reviews view.
 */
export default function StudioReviews({
  partnerId,
  lang = "en",
  className = "",
}: {
  partnerId: string;
  lang?: FlowLang | string;
  className?: string;
}) {
  const flowLang = toFlowLang(lang);
  const t = COPY[flowLang];
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setReviews(null);
    fetchPublicReviews(partnerId).then((r) => { if (alive) setReviews(r); });
    return () => { alive = false; };
  }, [partnerId]);

  if (reviews === null) return null;

  const s = summariseReviews(reviews);
  const shown = showAll ? reviews : reviews.slice(0, 4);

  return (
    <section className={`rounded-3xl border border-[#EFE6DA] bg-white p-5 min-[900px]:p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <BadgeCheck size={18} className="text-[#C4622D]" />
        <h2 className="font-display text-xl min-[900px]:text-2xl font-semibold text-[#2b2b2b]">
          {t.heading}
        </h2>
      </div>
      <p className="text-xs text-[#8a7460] mb-4">{t.sub}</p>

      {s.count === 0 ? (
        <p className="text-sm text-[#5C5349]">{t.empty}</p>
      ) : (
        <>
          {/* Airbnb-style header: big average, then histogram */}
          <div className="flex flex-col min-[560px]:flex-row min-[560px]:items-center gap-4 min-[560px]:gap-6 mb-5">
            <div className="flex-shrink-0">
              <div className="text-5xl font-bold leading-none text-[#2b2b2b]">
                {s.average?.toFixed(1)}
              </div>
              <div className="mt-2"><Stars n={Math.round(s.average ?? 0)} size={15} /></div>
              <div className="text-xs text-[#8a7460] mt-1">
                {s.count} {t.review(s.count)}
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = s.histogram[n] ?? 0;
                const pct = s.count ? Math.round((c / s.count) * 100) : 0;
                return (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-3 text-[11px] text-[#8a7460] tabular-nums">{n}</span>
                    <Star size={11} className="text-[#C4622D] flex-shrink-0" fill="currentColor" strokeWidth={1.5} />
                    <span className="h-2 flex-1 rounded-full bg-[#F1E8DC] overflow-hidden">
                      <span className="block h-full rounded-full bg-[#C4622D]" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-5 text-right text-[11px] text-[#8a7460] tabular-nums">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category averages */}
          {(s.pressureRight != null || s.cleanliness != null || s.ambience != null) && (
            <div className="mb-5 grid gap-3 min-[560px]:grid-cols-3">
              {[
                s.pressureRight != null && {
                  label: t.pressureRight,
                  value: `${Math.round(s.pressureRight * 100)}%`,
                  pct: Math.round(s.pressureRight * 100),
                },
                s.cleanliness != null && {
                  label: t.cleanliness,
                  value: s.cleanliness.toFixed(1),
                  pct: Math.round((s.cleanliness / 5) * 100),
                },
                s.ambience != null && {
                  label: t.atmosphere,
                  value: s.ambience.toFixed(1),
                  pct: Math.round((s.ambience / 5) * 100),
                },
              ].filter(Boolean).map((row) => {
                const r = row as { label: string; value: string; pct: number };
                return (
                  <div key={r.label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-[#8a7460]">{r.label}</span>
                      <span className="text-sm font-semibold text-[#2b2b2b] tabular-nums">{r.value}</span>
                    </div>
                    <span className="mt-1 block h-1.5 w-full rounded-full bg-[#F1E8DC] overflow-hidden">
                      <span className="block h-full rounded-full bg-[#B85C38]" style={{ width: `${r.pct}%` }} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top tags */}
          {s.topTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {s.topTags.map((tg) => (
                <span key={tg.key} className="rounded-full border border-[#EADFD1] bg-[#FAF6F1] px-3 py-1 text-xs font-medium text-[#5C5349]">
                  {reviewTagLabel(tg.key, flowLang)} <span className="text-[#8a7460]">x{tg.count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Cards */}
          <ul className="space-y-3">
            {shown.map((r) => (
              <li key={r.id} className="rounded-2xl border border-[#F0E8DE] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#2b2b2b] truncate">
                      {r.display_name?.trim() || t.fallbackName}
                    </p>
                    <p className="text-[11px] text-[#8a7460]">
                      {monthYear(new Date(r.created_at), flowLang)}
                    </p>
                  </div>
                  <Stars n={Math.round(Number(r.rating))} />
                </div>
                {r.comment?.trim() && (
                  <p className="mt-2 text-sm leading-relaxed text-[#4A443D] whitespace-pre-line">{r.comment.trim()}</p>
                )}
                {((r.tags ?? []).length > 0 || r.custom_tag?.trim()) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(r.tags ?? []).map((tg) => (
                      <span key={tg} className="rounded-full bg-[#F6EFE6] px-2.5 py-0.5 text-[11px] text-[#5C5349]">
                        {reviewTagLabel(tg, flowLang)}
                      </span>
                    ))}
                    {r.custom_tag?.trim() && (
                      <span className="rounded-full bg-[#F6EFE6] px-2.5 py-0.5 text-[11px] text-[#5C5349]">
                        {r.custom_tag.trim()}
                      </span>
                    )}
                  </div>
                )}
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#7A9A6A]">
                  <BadgeCheck size={12} /> {t.verifiedBooking}
                </span>
              </li>
            ))}
          </ul>

          {reviews.length > shown.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-3 text-sm font-semibold text-[#C4622D] underline underline-offset-2"
            >
              {t.showAll(reviews.length)}
            </button>
          )}
        </>
      )}
    </section>
  );
}
