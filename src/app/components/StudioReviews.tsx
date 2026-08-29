import { useEffect, useState } from "react";
import { BadgeCheck, Star } from "lucide-react";

import {
  fetchPublicReviews,
  summariseReviews,
  reviewTagLabel,
  reviewDateLabel,
  type PublicReview,
  type Lang,
} from "@/lib/reviews";

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
  lang?: Lang;
  className?: string;
}) {
  const es = lang === "es";
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
          {es ? "Opiniones verificadas" : "Verified reviews"}
        </h2>
      </div>
      <p className="text-xs text-[#8a7460] mb-4">
        {es
          ? "Solo de clientes que reservaron con Massage Club."
          : "Only from clients who booked through Massage Club."}
      </p>

      {s.count === 0 ? (
        <p className="text-sm text-[#5C5349]">
          {es
            ? "Todavía no hay opiniones. Las opiniones vienen solo de reservas verificadas de Massage Club."
            : "No reviews yet. Reviews come only from verified Massage Club bookings."}
        </p>
      ) : (
        <>
          {/* Summary + histogram */}
          <div className="flex flex-col min-[560px]:flex-row min-[560px]:items-center gap-4 min-[560px]:gap-6 mb-4">
            <div className="flex-shrink-0">
              <div className="text-4xl font-bold leading-none text-[#2b2b2b]">
                {s.average?.toFixed(1)}
              </div>
              <div className="mt-1"><Stars n={Math.round(s.average ?? 0)} size={15} /></div>
              <div className="text-xs text-[#8a7460] mt-1">
                {s.count} {es ? (s.count === 1 ? "opinión" : "opiniones") : (s.count === 1 ? "review" : "reviews")}
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

          {/* Top tags */}
          {s.topTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {s.topTags.map((t) => (
                <span key={t.key} className="rounded-full border border-[#EADFD1] bg-[#FAF6F1] px-3 py-1 text-xs font-medium text-[#5C5349]">
                  {reviewTagLabel(t.key, lang)} <span className="text-[#8a7460]">x{t.count}</span>
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
                      {r.display_name?.trim() || (es ? "Cliente de Massage Club" : "Massage Club client")}
                    </p>
                    <p className="text-[11px] text-[#8a7460]">{reviewDateLabel(r.created_at, lang)}</p>
                  </div>
                  <Stars n={Math.round(Number(r.rating))} />
                </div>
                {r.comment?.trim() && (
                  <p className="mt-2 text-sm leading-relaxed text-[#4A443D] whitespace-pre-line">{r.comment.trim()}</p>
                )}
                {(r.tags ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(r.tags ?? []).map((t) => (
                      <span key={t} className="rounded-full bg-[#F6EFE6] px-2.5 py-0.5 text-[11px] text-[#5C5349]">
                        {reviewTagLabel(t, lang)}
                      </span>
                    ))}
                  </div>
                )}
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#7A9A6A]">
                  <BadgeCheck size={12} /> {es ? "Reserva verificada" : "Verified booking"}
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
              {es ? `Ver las ${reviews.length} opiniones` : `Show all ${reviews.length} reviews`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
