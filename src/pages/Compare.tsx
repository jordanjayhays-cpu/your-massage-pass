import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Star, MapPin, MessageCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fetchShops, type Shop, type ShopService } from "@/lib/supabase";
import { compareKey, parseCompareParam, readQuizRecommendedType, setCompareEntries } from "@/lib/compare";
import { findMassageType, MASSAGE_TYPES_CONTENT, type MassageTypeContent } from "@/lib/massageTypes";
import { studioPath } from "@/lib/studioHref";
import { studioImageFallback } from "@/lib/studioImages";
import { servicePrimaryName } from "@/lib/serviceName";
import { tagLabel } from "@/lib/tagLabel";
import { haversineKm, distanceLabelShort } from "@/lib/distance";
import { savedLocationResult } from "@/lib/locationConsent";
import { hasWhatsapp } from "@/app/lib/whatsapp";
import { trackEvent } from "@/lib/siteVisit";
import { cn } from "@/lib/utils";

const LANG_LABEL: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  zh: "中文",
};

function servicesOfType(shop: Shop, type: MassageTypeContent | null): ShopService[] {
  if (!type) return [];
  return (shop.partner_services || []).filter(
    (s) => findMassageType(s.name_en, s.name, s.type)?.slug === type.slug
  );
}

function priceRange(shop: Shop): string | null {
  const prices = (shop.partner_services || [])
    .map((s) => Number(s.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `€${min}` : `€${min} - €${max}`;
}

/** Cheapest price for the selected massage type, or null. */
function typePrice(shop: Shop, type: MassageTypeContent | null): number | null {
  const prices = servicesOfType(shop, type)
    .map((s) => Number(s.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
}

/** Studio confirms bookings itself, no WhatsApp round trip. */
function isInstant(shop: Shop): boolean {
  return shop.auto_confirm_bookings === true;
}

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Today's hours from partners.opening_hours. Returns the raw string when the
 * shape is not the {open, close, closed} object we write from the partner app.
 */
function openToday(shop: Shop): { en: string; es: string } | null {
  const oh: any = shop.opening_hours;
  if (!oh) return null;
  if (typeof oh === "string") return { en: oh, es: oh };
  const today = oh[DAY_KEYS[new Date().getDay()]];
  if (today == null) return null;
  if (typeof today === "string") return { en: today, es: today };
  if (today.closed) return { en: "Closed today", es: "Cerrado hoy" };
  if (today.open && today.close) {
    const s = `${today.open} - ${today.close}`;
    return { en: s, es: s };
  }
  return null;
}

/**
 * The studio's most distinctive offering: a massage type only it offers among
 * the compared studios, else its most offered type, else its first tag.
 * Never invents copy, always derived from services or tags.
 */
function knownFor(shop: Shop, all: Shop[], lang: "en" | "es"): string | null {
  const typesOf = (s: Shop) => {
    const counts = new Map<string, { t: MassageTypeContent; n: number }>();
    (s.partner_services || []).forEach((sv) => {
      const t = findMassageType(sv.name_en, sv.name, sv.type);
      if (!t) return;
      const cur = counts.get(t.slug);
      if (cur) cur.n += 1;
      else counts.set(t.slug, { t, n: 1 });
    });
    return counts;
  };
  const mine = typesOf(shop);
  if (mine.size > 0) {
    const othersHave = new Set<string>();
    all.forEach((o) => {
      if (compareKey(o) === compareKey(shop)) return;
      typesOf(o).forEach((_v, slug) => othersHave.add(slug));
    });
    const unique = [...mine.values()].filter((v) => !othersHave.has(v.t.slug));
    const pick = (unique.length ? unique : [...mine.values()]).sort((a, b) => b.n - a.n)[0];
    if (pick) return pick.t.name[lang];
  }
  const tag = (shop.tags || []).filter(Boolean)[0];
  return tag ? tagLabel(String(tag)) : null;
}

type Verdict = { en: string; es: string; className: string };

const VERDICT_STYLE = {
  closest: "bg-[#F6E3D6] text-[#A2501F] border-[#EBCDB8]",
  price: "bg-[#E4EBDE] text-[#4F6B48] border-[#D2DEC9]",
  rated: "bg-[#F7E9CC] text-[#8A6414] border-[#EEDBB1]",
  instant: "bg-[#DEEEDD] text-[#3F6B44] border-[#C7E0C7]",
};

/** Small "which one?" chips per column, computed from the compared data. */
function verdictsFor(
  shop: Shop,
  all: Shop[],
  activeType: MassageTypeContent | null,
  userLoc: { lat: number; lng: number } | null
): Verdict[] {
  const out: Verdict[] = [];

  if (userLoc) {
    const dists = all
      .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
      .map((s) => ({ k: compareKey(s), km: haversineKm(userLoc, s) }));
    if (dists.length > 1) {
      const min = Math.min(...dists.map((d) => d.km));
      const mine = dists.find((d) => d.k === compareKey(shop));
      if (mine && Math.abs(mine.km - min) < 0.001) {
        out.push({ en: "Closest", es: "El más cercano", className: VERDICT_STYLE.closest });
      }
    }
  }

  const prices = all.map((s) => ({ k: compareKey(s), p: typePrice(s, activeType) })).filter((x) => x.p != null);
  if (prices.length > 1) {
    const min = Math.min(...prices.map((x) => x.p as number));
    const mine = prices.find((x) => x.k === compareKey(shop));
    if (mine && mine.p === min) {
      out.push({ en: "Best price", es: "Mejor precio", className: VERDICT_STYLE.price });
    }
  }

  const rated = all
    .map((s) => ({ k: compareKey(s), r: s.rating != null ? Number(s.rating) : null, n: Number(s.reviews ?? 0) }))
    .filter((x) => x.r != null && x.n > 0);
  if (rated.length > 1) {
    const max = Math.max(...rated.map((x) => x.r as number));
    const mine = rated.find((x) => x.k === compareKey(shop));
    if (mine && mine.r === max) {
      out.push({ en: "Best rated", es: "Mejor valorado", className: VERDICT_STYLE.rated });
    }
  }

  if (isInstant(shop)) {
    out.push({ en: "Instant booking", es: "Reserva al instante", className: VERDICT_STYLE.instant });
  }

  return out;
}

/** Full-width label above each fact row, columns aligned underneath. */
function Row({
  label,
  labelEs,
  hero,
  children,
}: {
  label: string;
  labelEs: string;
  hero?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border-t border-[#E6DCCF] py-4", hero && "bg-[#FBEFE8]/70 rounded-2xl border-t-0 mt-3 px-3")}>
      <p
        className={cn(
          "mb-2 font-bold uppercase tracking-[0.12em]",
          hero ? "text-[12px] text-primary" : "text-[10px] text-muted-foreground"
        )}
      >
        {label} <span className="font-normal normal-case tracking-normal text-muted-foreground/80">· {labelEs}</span>
      </p>
      {children}
    </div>
  );
}

export default function Compare() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang: "en" | "es" = i18n.language?.startsWith("es") ? "es" : "en";

  const keys = useMemo(() => parseCompareParam(params.get("s")), [params]);
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [typeSlug, setTypeSlug] = useState<string | null>(null);
  const userLoc = savedLocationResult()?.loc ?? null;

  useEffect(() => {
    let cancelled = false;
    fetchShops().then((list) => {
      if (!cancelled) setShops(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected: Shop[] = useMemo(() => {
    if (!shops) return [];
    return keys
      .map((k) => shops.find((s) => compareKey(s) === k || s.partner_id === k || s.slug === k))
      .filter(Boolean) as Shop[];
  }, [shops, keys]);

  // Keep the sticky bar in sync with a shared link.
  useEffect(() => {
    if (selected.length === 0) return;
    setCompareEntries(selected.map((s) => ({ key: compareKey(s), name: s.studio })));
  }, [selected]);

  useEffect(() => {
    if (keys.length === 0) return;
    trackEvent("compare_view", { meta: { slugs: keys } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(",")]);

  // Only types at least one selected studio actually offers.
  const availableTypes: MassageTypeContent[] = useMemo(() => {
    const found = new Set<string>();
    selected.forEach((shop) =>
      (shop.partner_services || []).forEach((s) => {
        const t = findMassageType(s.name_en, s.name, s.type);
        if (t) found.add(t.slug);
      })
    );
    return MASSAGE_TYPES_CONTENT.filter((t) => found.has(t.slug));
  }, [selected]);

  // Default to the quiz recommendation when there is one, else Relaxing.
  useEffect(() => {
    if (typeSlug || availableTypes.length === 0) return;
    const quiz = readQuizRecommendedType();
    const preferred =
      (quiz && availableTypes.find((t) => t.slug === quiz)) ||
      availableTypes.find((t) => t.slug === "swedish") ||
      availableTypes[0];
    setTypeSlug(preferred.slug);
  }, [availableTypes, typeSlug]);

  const activeType = availableTypes.find((t) => t.slug === typeSlug) ?? null;

  if (!shops) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (selected.length < 2) {
    return (
      <div className="min-h-screen bg-background px-5 py-10">
        <div className="mx-auto max-w-[560px] text-center">
          <h1 className="font-display text-2xl text-foreground">Compare studios</h1>
          <p className="text-sm text-muted-foreground mt-1">Comparar estudios</p>
          <p className="mt-6 text-sm text-foreground/80">
            Pick another studio to compare prices{" "}
            <span className="text-muted-foreground">· Elige otro estudio para comparar precios</span>
          </p>
          <Link
            to="/studios"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Browse studios <span className="ml-1 opacity-80">· Ver estudios</span>
          </Link>
        </div>
      </div>
    );
  }

  const cols = selected.length;
  const gridStyle = { gridTemplateColumns: `repeat(${cols}, minmax(150px, 1fr))` };

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto max-w-[1100px] px-4 md:px-8 pt-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-2xl text-foreground leading-tight">Compare studios</h1>
            <p className="text-xs text-muted-foreground">Comparar estudios</p>
          </div>
        </div>

        {/* Massage type selector */}
        {availableTypes.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2">
              Massage type <span className="font-normal normal-case tracking-normal">· Tipo de masaje</span>
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
              {availableTypes.map((t) => (
                <button
                  key={t.slug}
                  onClick={() => setTypeSlug(t.slug)}
                  className={cn(
                    "flex-shrink-0 h-9 px-4 rounded-full text-xs font-semibold border transition",
                    t.slug === typeSlug
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:border-primary/50"
                  )}
                >
                  {t.name[lang]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Columns: 2 fit on mobile, the third swipes into view */}
        <div className="mt-4 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
          <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
            {selected.map((s) => {
              const verdicts = verdictsFor(s, selected, activeType, userLoc);
              return (
              <div key={compareKey(s)} className="snap-start min-w-0">
                {verdicts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {verdicts.map((v) => (
                      <span
                        key={v.en}
                        title={`${v.en} · ${v.es}`}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight",
                          v.className
                        )}
                      >
                        {lang === "es" ? v.es : v.en}
                      </span>
                    ))}
                  </div>
                )}
                <Link to={studioPath(s)} className="block relative h-28 rounded-2xl overflow-hidden bg-secondary">
                  {s.image && (
                    <img
                      src={s.image}
                      alt={s.studio}
                      onError={studioImageFallback}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </Link>
                <Link
                  to={studioPath(s)}
                  className="block font-display text-base font-semibold text-foreground leading-tight mt-2 break-words md:hover:text-primary transition-colors"
                >
                  {s.studio}
                </Link>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{s.district || "Madrid"}</span>
                </p>
              </div>
              );
            })}

          </div>

          {/* Rating */}
          <Row label="Google rating" labelEs="Valoración de Google">
            <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
              {selected.map((s) => (
                <div key={compareKey(s)} className="snap-start text-sm text-foreground min-w-0">
                  {s.rating != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-4 w-4 fill-accent text-accent" />
                      <span className="font-semibold">{Number(s.rating).toFixed(1)}</span>
                      {s.reviews != null && <span className="text-muted-foreground">({s.reviews})</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not available · No disponible</span>
                  )}
                </div>
              ))}
            </div>
          </Row>

          {/* Distance, only with a known origin */}
          {userLoc && (
            <Row label="Distance and walk" labelEs="Distancia y paseo">
              <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
                {selected.map((s) => (
                  <div key={compareKey(s)} className="snap-start text-sm text-foreground min-w-0">
                    {typeof s.lat === "number" && typeof s.lng === "number" ? (
                      distanceLabelShort(haversineKm(userLoc, s))
                    ) : (
                      <span className="text-muted-foreground text-xs">Not available · No disponible</span>
                    )}
                  </div>
                ))}
              </div>
            </Row>
          )}

          {/* Booking type */}
          <Row label="Booking" labelEs="Reserva">
            <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
              {selected.map((s) => {
                const instant = s.status === "active";
                return (
                  <div key={compareKey(s)} className="snap-start text-sm min-w-0">
                    {instant ? (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <Check className="h-4 w-4 text-[#7D9B76]" />
                        <span className="font-semibold">Instant booking</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        <span>Book via WhatsApp</span>
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {instant ? "Reserva instantánea" : "Reserva por WhatsApp"}
                    </p>
                  </div>
                );
              })}
            </div>
          </Row>

          {/* HERO: price by massage type */}
          <Row
            hero
            label={`Price for ${activeType ? activeType.name.en : "this massage"}`}
            labelEs={activeType ? activeType.name.es : "este masaje"}
          >
            <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
              {selected.map((s) => {
                const matches = servicesOfType(s, activeType);
                const cheapest = matches
                  .filter((m) => Number.isFinite(Number(m.price)))
                  .sort((a, b) => Number(a.price) - Number(b.price))[0];
                const durations = [
                  ...new Set(
                    matches
                      .map((m) => Number(m.duration))
                      .filter((n) => Number.isFinite(n) && n > 0)
                  ),
                ].sort((a, b) => a - b);
                return (
                  <div key={compareKey(s)} className="snap-start min-w-0">
                    {cheapest ? (
                      <>
                        <p className="font-display text-2xl md:text-3xl font-bold text-primary leading-none">
                          €{Number(cheapest.price)}
                        </p>
                        <p className="text-sm text-foreground/80 mt-1">
                          {durations.length > 1
                            ? `${durations.join(" / ")} min`
                            : cheapest.duration
                            ? `${cheapest.duration} min`
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{servicePrimaryName(cheapest, "")}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Not offered <span className="text-muted-foreground/70">· No lo ofrece</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Row>

          {/* Overall price range */}
          <Row label="Overall price range" labelEs="Rango de precios">
            <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
              {selected.map((s) => (
                <div key={compareKey(s)} className="snap-start text-sm text-foreground min-w-0">
                  {priceRange(s) ?? <span className="text-muted-foreground text-xs">Not available · No disponible</span>}
                </div>
              ))}
            </div>
          </Row>

          {/* Languages */}
          <Row label="Languages" labelEs="Idiomas">
            <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
              {selected.map((s) => {
                const langs = (s.languages || []).filter(Boolean);
                return (
                  <div key={compareKey(s)} className="snap-start min-w-0 flex flex-wrap gap-1.5">
                    {langs.length === 0 ? (
                      <span className="text-muted-foreground text-xs">Not listed · Sin datos</span>
                    ) : (
                      langs.map((l) => (
                        <span
                          key={l}
                          className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground"
                        >
                          {LANG_LABEL[String(l).toLowerCase()] || tagLabel(String(l))}
                        </span>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </Row>

          {/* Open today, only when at least one studio has hours */}
          {selected.some((s) => openToday(s)) && (
            <Row label="Open today" labelEs="Abierto hoy">
              <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
                {selected.map((s) => {
                  const hours = openToday(s);
                  return (
                    <div key={compareKey(s)} className="snap-start min-w-0 text-sm text-foreground break-words">
                      {hours ? (
                        <>
                          <span>{hours.en}</span>
                          {hours.es !== hours.en && (
                            <span className="block text-xs text-muted-foreground">{hours.es}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not listed · Sin datos</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Row>
          )}

          {/* Known for, derived from services or tags */}
          {selected.some((s) => knownFor(s, selected, "en")) && (
            <Row label="Known for" labelEs="Especialidad">
              <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
                {selected.map((s) => {
                  const en = knownFor(s, selected, "en");
                  const es = knownFor(s, selected, "es");
                  return (
                    <div key={compareKey(s)} className="snap-start min-w-0 text-sm text-foreground break-words">
                      {en ? (
                        <>
                          <span>{en}</span>
                          {es && es !== en && (
                            <span className="block text-xs text-muted-foreground">{es}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not listed · Sin datos</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Row>
          )}

          {/* Amenities / tags */}
          <Row label="Amenities" labelEs="Servicios">
            <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
              {selected.map((s) => {
                const tags = (s.tags || []).filter(Boolean).slice(0, 6);
                return (
                  <div key={compareKey(s)} className="snap-start min-w-0 flex flex-wrap gap-1.5">
                    {tags.length === 0 ? (
                      <span className="text-muted-foreground text-xs">Not listed · Sin datos</span>
                    ) : (
                      tags.map((tg) => (
                        <span
                          key={tg}
                          className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground/80"
                        >
                          {tagLabel(String(tg))}
                        </span>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </Row>

          {/* Per column CTA */}
          <div className="border-t border-[#E6DCCF] py-4">
            <div style={gridStyle} className="grid gap-3 min-w-[520px] md:min-w-0">
              {selected.map((s) => {
                const instant = s.status === "active";
                const label = instant ? "Book" : hasWhatsapp(s) ? "Ask on WhatsApp" : "View studio";
                const labelEs = instant ? "Reservar" : hasWhatsapp(s) ? "Preguntar por WhatsApp" : "Ver estudio";
                return (
                  <Link
                    key={compareKey(s)}
                    to={studioPath(s)}
                    className={cn(
                      "snap-start min-w-0 inline-flex flex-col items-center justify-center rounded-full px-3 py-2 min-h-11 text-center text-sm font-semibold transition",
                      instant
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-primary text-primary hover:bg-primary/5"
                    )}
                  >
                    <span className="truncate max-w-full">{label}</span>
                    <span className="text-[10px] font-normal opacity-75 truncate max-w-full">{labelEs}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
