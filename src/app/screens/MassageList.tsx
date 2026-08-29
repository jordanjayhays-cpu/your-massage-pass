import { studioImageFallback } from "@/lib/studioImages";
import { servicePrimaryName } from "@/lib/serviceName";
import { findMassageType } from "@/lib/massageTypes";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Star, MapPin, Heart, SlidersHorizontal, Clock, Sparkles, Loader2, Navigation, Compass } from "lucide-react";
import { MASSAGES, MASSAGE_TYPES, MassageType, MADRID_CENTER, distanceKm } from "../data";
import { useBooking } from "../BookingContext";
import { cn } from "@/lib/utils";
import StudioMap, { studioKey, type MapBounds } from "../components/StudioMap";
import { fetchShops, supabase } from "@/lib/supabase";
import type { Shop } from "@/lib/supabase";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import ProfileHeaderButton from "@/app/components/ProfileHeaderButton";
import StudioStatusBadge from "../components/StudioStatusBadge";
import { fetchFreeTodayPartnerIds, studioBadgeVariant } from "@/lib/studioStatus";
import { BookAgainChip } from "../components/BookAgain";
import { studioPath } from "@/lib/studioHref";
import { haversineKm, distanceLabel, distanceLabelShort, walkingDirectionsUrl } from "@/lib/distance";
import { useLocationAsk, savedLocationResult, originSuffix } from "@/lib/locationConsent";
import CompareToggle from "../components/CompareToggle";
import CompareBar from "../components/CompareBar";
import { useFavouriteAction } from "../components/FavouriteSignupSheet";
import { favouriteKey } from "@/lib/favourites";



export default function MassageList() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { set } = useBooking();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<MassageType | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [realShops, setRealShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isPartner, setIsPartner] = useState(false);
  const { favourites, isFavourite, toggle: toggleFavourite, sheet: favouriteSheet } = useFavouriteAction();
  const [savedOnly, setSavedOnly] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(() => savedLocationResult()?.loc ?? null);
  const [visibleCount, setVisibleCount] = useState(8);
  const [freeTodayIds, setFreeTodayIds] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [locatingDistances, setLocatingDistances] = useState(false);
  // Neighbourhood name when the visitor picked an area instead of sharing location.
  const [areaName, setAreaName] = useState<string | null>(() => savedLocationResult()?.areaName ?? null);
  const askLocation = useLocationAsk();

  const [selectedStudio, setSelectedStudio] = useState<Shop | typeof MASSAGES[0] | null>(null);



  useEffect(() => {
    fetchShops().then((shops) => {
      setRealShops(shops);
      setShopsLoading(false);
      const claimed = shops.filter((s) => s.status === "active").map((s) => s.partner_id);
      if (claimed.length) fetchFreeTodayPartnerIds(claimed).then(setFreeTodayIds).catch(() => {});
    });
  }, []);

  // Debounce the search query so the dropdown/spinner do not thrash on every keystroke.
  useEffect(() => {
    if (!q.trim()) {
      setDebouncedQ("");
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      setDebouncedQ(q);
      setSearching(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [q]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data?.avatar_url) setAvatarUrl(data.avatar_url);
      const { data: partnerRow } = await supabase
        .from("partners")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setIsPartner(!!partnerRow);
    })();
    return () => { cancelled = true; };
  }, []);

  const allShops: Shop[] = [...realShops];
  // Map v2: "Search this area" filter, and list/map hover sync on desktop.
  const [areaBounds, setAreaBounds] = useState<MapBounds | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);


  const origin = userLoc ?? MADRID_CENTER;
  const lang: "en" | "es" = i18n.language?.startsWith("es") ? "es" : "en";

  const filtered = allShops
    .filter((m) => {
      if (!m || !m.name || !m.studio) return false;
      const query = q.toLowerCase();
      const matchesQ =
        m.name.toLowerCase().includes(query) ||
        m.studio.toLowerCase().includes(query) ||
        ("district" in m && m.district?.toLowerCase().includes(query));
      const matchesType = typeFilter === "all" || m.type === typeFilter;
      const matchesArea =
        !areaBounds ||
        (typeof (m as any).lat === "number" &&
          typeof (m as any).lng === "number" &&
          (m as any).lat <= areaBounds.north &&
          (m as any).lat >= areaBounds.south &&
          (m as any).lng <= areaBounds.east &&
          (m as any).lng >= areaBounds.west);
      const matchesSaved = !savedOnly || isFavourite(favouriteKey(m as any));
      return matchesQ && matchesType && matchesArea && matchesSaved;
    })

    .map((m) => ({
      ...m,
      km: typeof (m as any).lat === "number" && typeof (m as any).lng === "number"
        ? distanceKm(origin, m as any)
        : (m as any).km ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));

  const dropdownResults = debouncedQ.trim()
    ? allShops
        .filter((m) => {
          if (!m || !m.name || !m.studio) return false;
          const query = debouncedQ.toLowerCase();
          return (
            m.name.toLowerCase().includes(query) ||
            m.studio.toLowerCase().includes(query) ||
            ("district" in m && m.district?.toLowerCase().includes(query))
          );
        })
        .slice(0, 8)
    : [];

  // Soft-ask first: our sheet, then the browser prompt only on the primary tap.
  const handleShowDistances = () => {
    setLocatingDistances(true);
    askLocation((res) => {
      setLocatingDistances(false);
      if (!res) return;
      setUserLoc(res.loc);
      setAreaName(res.areaName);
    });
  };





  /** Same destination as tapping the card / Book now. */
  const cardHref = (m: Shop | typeof MASSAGES[0]) =>
    "partner_id" in m && (m as Shop).partner_id ? studioPath(m as Shop) : `/massages/${m.id}`;

  const handleBook = (m: Shop | typeof MASSAGES[0]) => {
    if ("partner_id" in m && (m as Shop).partner_id) {
      navigate(studioPath(m as Shop));
      return;
    }
    set({ massageId: m.id, shop: m });
    navigate(`/massages/${m.id}`);
  };




  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Top utility bar */}
      <div className="px-5 pt-5 flex items-center justify-between gap-4">
        <ProfileHeaderButton />

        <div className="flex items-center gap-3">
          <LanguageFlagToggle variant="compact" />
          {isPartner && (
            <button
              onClick={() => navigate("/partner/dashboard")}
              className="h-10 px-4 rounded-full bg-card border border-border text-foreground text-xs font-semibold tracking-wide hover:border-primary/50 transition shadow-soft"
            >
              {t("app.massageList.switchToPartner")}
            </button>
          )}
        </div>
      </div>

      {/* Concierge shortcut */}
      <div className="px-5 pt-4">
        <Link
          to="/book"
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-secondary/50 px-4 py-3 text-sm text-foreground hover:border-primary transition"
        >
          <span>
            {i18n.language?.startsWith("es")
              ? "Sáltate la búsqueda — dinos qué quieres y te lo reservamos."
              : "Skip the browsing — tell us what you want and we'll book it."}
          </span>
          <span aria-hidden className="text-primary">→</span>
        </Link>
      </div>

      {/* Search */}
      <div className="px-5 pt-5">
        <div className="relative">
          <div className="flex items-center gap-2 bg-card rounded-full shadow-soft border border-border/60 pl-5 pr-2 h-14">
            <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setVisibleCount(8); setSearchOpen(true); }}
              onFocus={() => { if (q.trim()) setSearchOpen(true); }}
              onBlur={() => { window.setTimeout(() => setSearchOpen(false), 150); }}
              onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
              placeholder={t("app.massageList.searchPlaceholder")}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {searching && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />}
            <button
              onClick={() => setShowFilters((s) => !s)}
              aria-label={t("app.massageList.filters")}
              className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {q.trim() !== "" && (
            <p className="pt-2 pl-1 text-xs text-muted-foreground">
              {filtered.length === 1
                ? "1 studio found"
                : `${filtered.length} studios found`}
              <span className="text-muted-foreground/70">
                {" "}· {filtered.length === 1 ? "1 estudio encontrado" : `${filtered.length} estudios encontrados`}
              </span>
            </p>
          )}

          {searchOpen && debouncedQ.trim() !== "" && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 bg-white rounded-2xl border border-[#E6DCCF] shadow-lg max-h-[320px] overflow-y-auto">
              {dropdownResults.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-foreground/80">No studios found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No hay estudios</p>
                </div>
              ) : (
                dropdownResults.map((m) => {
                  const km = userLoc && typeof (m as any).lat === "number" && typeof (m as any).lng === "number"
                    ? haversineKm(userLoc, m as any)
                    : null;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setSearchOpen(false); setQ(""); handleBook(m); }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left border-b border-[#E6DCCF] last:border-b-0 hover:bg-[#FAF6F1] transition"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#2b2b2b] truncate">{m.studio}</p>
                        <p className="text-xs text-[#8a7460] truncate">{"district" in m && m.district ? m.district : "Madrid"}</p>
                      </div>
                      {km != null && (
                        <span className="text-xs text-[#8a7460] flex-shrink-0">{distanceLabelShort(km)}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {showFilters && (
          <div className="flex gap-2 overflow-x-auto pt-3 pb-1 -mx-5 px-5">
            <FilterChip active={typeFilter === "all"} onClick={() => { setTypeFilter("all"); setVisibleCount(8); }}>{t("app.massageList.filterAll")}</FilterChip>
            {MASSAGE_TYPES.map((t) => (
              <FilterChip key={t.id} active={typeFilter === t.id} onClick={() => { setTypeFilter(t.id); setVisibleCount(8); }}>
                {t.name}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {/* Quiz entry point — full-width card between search and map */}
      <div className="px-5 md:px-8 pt-4">
        <button
          type="button"
          onClick={() => navigate("/app/discovery/quiz")}
          aria-label={t("app.discovery.quizCardAria")}
          className="group w-full text-left rounded-3xl border border-border/70 bg-secondary/40 p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-all motion-safe:hover:border-primary/50 motion-safe:hover:bg-secondary/70 motion-safe:active:scale-[0.995]"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-foreground leading-tight">
                {t("app.massageList.quizCardTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("app.massageList.quizCardSub")}
              </p>
              <span className="mt-4 inline-flex items-center justify-center min-h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-soft group-hover:bg-primary/90 transition-colors">
                {t("app.massageList.quizCardCta")}
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Map header banner — shared component, also used on /app/discovery */}
      <div className="px-5 pt-5">
        <BookAgainChip className="mb-3" />
        <StudioMap
          shops={realShops}
          heightClass="h-[230px]"
          roundedClass="rounded-3xl"
          autoAskOnMobile
          highlightedKey={hoverKey}
          onHoverStudio={setHoverKey}
          onSearchArea={setAreaBounds}
          onUserLocation={(loc) => {
            setUserLoc(loc);
            setAreaName(savedLocationResult()?.areaName ?? null);
          }}
          onSelect={(shop) => handleBook(shop)}
        />
        {areaBounds && (
          <button
            type="button"
            onClick={() => setAreaBounds(null)}
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground/80 hover:text-primary transition"
          >
            Showing this area only · Clear
            <span className="font-normal text-muted-foreground">/ Solo esta zona · Quitar</span>
          </button>
        )}
      </div>

        {/* Studios list */}
        <div className="px-5 md:px-8 pt-6 pb-28">

        {/* Heading on its own row until the column is wide enough (about 700px)
            to carry the meta actions beside it. */}
        <div className="flex flex-col gap-2 mb-4 min-[1700px]:flex-row min-[1700px]:items-baseline min-[1700px]:justify-between">
          <h2 className="font-display text-2xl text-foreground">{t("app.massageList.studiosNearYou")}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {!userLoc && (
              <button
                onClick={handleShowDistances}
                disabled={locatingDistances}
                className="text-[10px] font-bold tracking-[0.12em] uppercase text-foreground/70 hover:text-primary flex items-center gap-1 transition"
              >
                {locatingDistances ? <Loader2 className="h-3 w-3 animate-spin" /> : <Compass className="h-3 w-3" />}
                {locatingDistances ? "Locating…" : "Show distances / Ver distancias"}
              </button>
            )}
            <button
              onClick={() => navigate("/app/discovery")}
              className="text-[10px] font-bold tracking-[0.12em] uppercase text-foreground/70 hover:text-primary flex items-center gap-1 transition"
            >
              <Sparkles className="h-3 w-3" /> {t("app.massageList.discover")}
            </button>
            <span className="text-[10px] font-bold tracking-[0.12em] text-primary uppercase">{t("app.massageList.foundCount", { count: filtered.length })}</span>
          </div>
        </div>

        {/* All / Saved tabs, so the saved list has somewhere to live */}
        <div className="flex items-center gap-2 mb-4" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!savedOnly}
            onClick={() => { setSavedOnly(false); setVisibleCount(8); }}
            className={cn(
              "h-9 px-4 rounded-full text-xs font-semibold border transition",
              !savedOnly ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50",
            )}
          >
            {lang === "es" ? "Todos" : "All"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={savedOnly}
            onClick={() => { setSavedOnly(true); setVisibleCount(8); }}
            className={cn(
              "h-9 px-4 rounded-full text-xs font-semibold border transition flex items-center gap-1.5",
              savedOnly ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50",
            )}
          >
            <Heart className={cn("h-3 w-3", savedOnly ? "fill-current" : "")} />
            {lang === "es" ? "Guardados" : "Saved"}
            {favourites.length > 0 && <span className="opacity-80">({favourites.length})</span>}
          </button>
        </div>

        {savedOnly && favourites.length === 0 && (
          <div className="rounded-3xl border border-border/70 bg-secondary/40 p-5 mb-4">
            <p className="text-sm font-semibold text-foreground">
              {lang === "es" ? "Aún no has guardado estudios" : "No saved studios yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "es"
                ? "Toca el corazón en cualquier estudio para guardarlo aquí."
                : "Tap the heart on any studio to keep it here."}
            </p>
          </div>
        )}



        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          {shopsLoading ? (
            <p className="md:col-span-2 xl:col-span-1 text-center text-muted-foreground py-12 text-sm">{t("app.massageList.loadingStudios")}</p>
          ) : filtered.length === 0 ? (
            <p className="md:col-span-2 xl:col-span-1 text-center text-muted-foreground py-12 text-sm">{t("app.massageList.noMatches")}</p>
          ) : (

            <>
              {filtered.slice(0, visibleCount).map((m, idx) => {
                const isFav = isFavourite(favouriteKey(m as any));
                const isSelected = selectedStudio?.id === m.id || (!selectedStudio && idx === 0);
                const mKey = studioKey(m);
                const isHovered = hoverKey != null && hoverKey === mKey;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "w-full min-w-0 bg-card border rounded-3xl p-3 shadow-soft hover:shadow-elegant transition-all cursor-pointer",
                      isHovered
                        ? "border-primary ring-2 ring-primary/30"
                        : isSelected ? "border-primary/60 ring-1 ring-primary/30" : "border-border/60"
                    )}
                    onMouseEnter={() => setHoverKey(mKey)}
                    onMouseLeave={() => setHoverKey((cur) => (cur === mKey ? null : cur))}
                    onClick={() => handleBook(m)}
                  >

                    <div className="flex gap-3">
                      <Link
                        to={cardHref(m)}
                        onClick={(e) => { e.stopPropagation(); }}
                        className="relative h-24 w-24 rounded-2xl overflow-hidden flex-shrink-0 bg-secondary block"
                      >
                        {m.image && (
                          <img src={m.image} alt={m.name} className="absolute inset-0 h-full w-full object-cover" onError={studioImageFallback} />
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleFavourite(m as any); }}
                          aria-label={t("app.massageList.favorite")}
                          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/95 flex items-center justify-center shadow-soft hover:scale-105 transition"
                        >
                          <Heart className={cn("h-3 w-3", isFav ? "fill-primary text-primary" : "text-foreground")} />
                        </button>
                      </Link>

                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-[17px] font-semibold text-foreground leading-snug min-w-0">
                            <Link
                              to={cardHref(m)}
                              onClick={(e) => e.stopPropagation()}
                              className="block line-clamp-2 break-words md:hover:text-primary transition-colors"
                            >
                              {m.studio}
                            </Link>
                          </h3>

                          {m.rating != null && (
                            <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                              <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                                {Number(m.rating).toFixed(1)}
                                {m.reviews != null && (
                                  <span className="font-normal text-muted-foreground"> ({m.reviews})</span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{"district" in m && m.district ? m.district : t("app.massageList.madrid")}</span>
                        </div>

                        {(() => {
                          // Compact card: the English massage type plus the price.
                          // The studio's own internal menu name stays on the studio page.
                          const svc = (m as any).partner_services?.[0];
                          if (!svc) return null;
                          const typed = findMassageType(svc.name_en, svc.name);
                          const label = typed?.name.en || servicePrimaryName(svc, "");
                          const price = svc?.price ?? (m as any).price;
                          if (!label) return null;
                          return (
                            <p className="text-xs text-foreground/80 mt-1.5 line-clamp-2 break-words">
                              <span className="font-medium">{label}</span>
                              {price != null && (
                                <span className="font-semibold text-primary"> · €{price}</span>
                              )}
                            </p>
                          );
                        })()}

                        {userLoc && typeof (m as any).lat === "number" && typeof (m as any).lng === "number" && (() => {
                          const km = haversineKm(userLoc, m as any);
                          const dirUrl = walkingDirectionsUrl(m as any, `${m.studio} Madrid`, userLoc);
                          return (
                            <p className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>{distanceLabel(km, lang)} {areaName ? originSuffix(areaName, lang) : ""}</span>
                              {dirUrl && (
                                <a
                                  href={dirUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-primary font-semibold hover:underline"
                                >
                                  Directions
                                </a>
                              )}
                            </p>
                          );
                        })()}

                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-1 rounded-full bg-secondary text-muted-foreground whitespace-nowrap">
                            {t("app.massageList.payAtStudio")}
                          </span>
                          <StudioStatusBadge
                            className="tracking-[0.06em] px-2 whitespace-nowrap"
                            variant={studioBadgeVariant((m as any).status, (m as any).partner_id, freeTodayIds, m as any)}
                          />
                          <CompareToggle studio={m as any} size="sm" className="px-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length > visibleCount && (
                <div className="md:col-span-2 xl:col-span-1 flex justify-center pt-2">
                  <button
                    onClick={() => setVisibleCount((c) => c + 8)}
                    className="h-11 px-8 rounded-full border border-primary text-primary text-xs font-bold tracking-[0.14em] uppercase hover:bg-primary/5 transition"
                  >
                    Ver más / Show more
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <ExitCaptureBlock
          source="studios-exit"
          area={areaName}
          className="mt-8"
        />

        <div className="pt-8 pb-2 text-center space-y-3">
          <p className="text-xs text-muted-foreground">
            <button
              onClick={() => navigate("/notify")}
              className="hover:text-primary underline underline-offset-2 transition"
            >
              {lang === "es" ? "Recibe ofertas de masajes en Madrid" : "Get massage deals in Madrid"}
            </button>
          </p>
          <button
            onClick={() => navigate("/partner/login")}
            className="text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2 transition"
          >
            {t("app.massageList.studioCta")}
          </button>
        </div>
      </div>


      <CompareBar className="pb-[86px]" />
      {favouriteSheet}
    </div>
  );
}






function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"
      )}
    >
      {children}
    </button>
  );
}
