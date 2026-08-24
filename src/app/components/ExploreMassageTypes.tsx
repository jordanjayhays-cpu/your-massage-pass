import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import {
  MASSAGE_TYPES_CONTENT,
  findMassageType,
  vitalsFor,
  BEST_FOR_LABELS,
  BEST_FOR_COLORS,
} from "@/lib/massageTypes";
import { PressureDots } from "./MassageTypeInfo";
import { fetchShops, type Shop } from "@/lib/supabase";
import { trackEvent } from "@/lib/siteVisit";

/** Most common first, as requested. */
const ORDER = [
  "swedish",
  "deep-tissue",
  "thai",
  "balinese",
  "hot-stone",
  "shiatsu",
  "head-scalp",
  "foot-legs",
  "sports",
  "lymphatic",
  "couples",
  "four-hands",
  "kobido",
  "gua-sha",
  "prenatal",
];

/**
 * Card grid of every massage type, linking to the standalone /massages/<slug>
 * pages. Studio counts use the same service matching as those pages.
 */
export default function ExploreMassageTypes() {
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    fetchShops().then(setShops).catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const shop of shops) {
      const seen = new Set<string>();
      for (const s of shop.partner_services ?? []) {
        const found = findMassageType((s as any).name_en, (s as any).name, (s as any).type);
        if (found && !seen.has(found.slug)) {
          seen.add(found.slug);
          map[found.slug] = (map[found.slug] ?? 0) + 1;
        }
      }
    }
    return map;
  }, [shops]);

  const types = useMemo(() => {
    const bySlug = new Map(MASSAGE_TYPES_CONTENT.map((t) => [t.slug, t]));
    const ordered = ORDER.map((s) => bySlug.get(s)).filter(Boolean) as typeof MASSAGE_TYPES_CONTENT;
    const rest = MASSAGE_TYPES_CONTENT.filter((t) => !ORDER.includes(t.slug));
    return [...ordered, ...rest];
  }, []);

  return (
    <section>
      <h3 className="font-display text-2xl text-foreground">
        Explore massage types{" "}
        <span className="text-base font-normal text-muted-foreground">/ Descubre los tipos de masaje</span>
      </h3>

      <div className="mt-4 grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4">
        {types.map((type) => {
          const v = vitalsFor(type.slug);
          const count = counts[type.slug] ?? 0;
          return (
            <Link
              key={type.slug}
              to={`/massages/${type.slug}`}
              onClick={() => trackEvent("type_card_tap", { meta: { type: type.slug } })}
              className="flex flex-col rounded-2xl border border-border bg-card p-3.5 shadow-soft motion-safe:transition-all hover:-translate-y-0.5 hover:shadow-elegant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <h4 className="font-display text-base font-bold leading-tight text-foreground">{type.name.en}</h4>
              <p className="text-xs text-muted-foreground">{type.name.es}</p>

              {v && (
                <span className="mt-2 inline-flex items-center">
                  <PressureDots level={v.pressure} size={7} />
                </span>
              )}

              {v && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {v.bestFor.map((k) => {
                    const c = BEST_FOR_COLORS[k];
                    return (
                      <span
                        key={k}
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
                      >
                        {BEST_FOR_LABELS[k].en}
                      </span>
                    );
                  })}
                </div>
              )}

              {type.firstTimer && (
                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[#FBEFE8] px-2 py-0.5 text-[10px] font-semibold text-[#B85C38]">
                  <Sparkles size={11} /> Great first massage
                </span>
              )}

              {count > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {count} {count === 1 ? "studio" : "studios"} <span className="opacity-70">/ {count} {count === 1 ? "estudio" : "estudios"}</span>
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
