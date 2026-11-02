import { studioImageFallback } from "@/lib/studioImages";
import { servicePrimaryName } from "@/lib/serviceName";
import { formatPrice } from "@/lib/localeFormat";
import { findMassageType } from "@/lib/massageTypes";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Search, Star, MapPin, Heart, SlidersHorizontal, Clock, Sparkles, Loader2, Navigation, Compass } from "lucide-react";
import { MASSAGE_TYPES, MassageType, MADRID_CENTER, distanceKm, type Massage } from "../data";
import { useBooking } from "../BookingContext";
import { cn } from "@/lib/utils";
import StudioMap, { studioKey, type MapBounds } from "../components/StudioMap";
import { loadShops, cachedShops, supabase } from "@/lib/supabase";
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



/** Accent and case insensitive compare, so "Chamberi" matches "Chamberí". */
const norm = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Where the visitor was in the list when they opened a studio, so Back returns there. */
const POS_KEY = "mc_studios_pos";
type ListPos = { scrollY: number; visibleCount: number; q: string; area: string };

/** One language per label. Spanish for Spanish visitors, English otherwise. */
const COPY = {
  en: {
    askUs: "Not sure which studio? Tell us what you want and we'll ask the studios for you.",
    fewHere: "Few studios here yet. Tell us what you want and we'll ask studios nearby.",
    askUsLink: "Ask us here",
    headingMadrid: "Massage studios in Madrid",
    showDistances: "Show distances",
    findingYou: "Finding you…",
    showMore: "Show more",
    directions: "Directions",
    areaChip: (a: string) => `Area: ${a} · Clear`,
    boundsChip: "Showing this area only · Clear",
    found: (n: number) => (n === 1 ? "1 studio found" : `${n} studios found`),
    noneFound: "No studios found",
    discoverTypes: "Discover massage types",
  },
  es: {
    askUs: "¿No sabes qué centro? Dinos qué quieres y preguntamos a los centros por ti.",
    fewHere: "Todavía hay pocos centros aquí. Dinos qué quieres y preguntamos a centros cercanos.",
    askUsLink: "Pídelo aquí",
    headingMadrid: "Centros de masaje en Madrid",
    showDistances: "Ver distancias",
    findingYou: "Buscándote…",
    showMore: "Ver más",
    directions: "Cómo llegar",
    areaChip: (a: string) => `Zona: ${a} · Quitar`,
    boundsChip: "Solo esta zona · Quitar",
    found: (n: number) => (n === 1 ? "1 centro encontrado" : `${n} centros encontrados`),
    noneFound: "No hay centros",
    discoverTypes: "Descubre los tipos de masaje",
  },
} as const;


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

  const [selectedStudio, setSelectedStudio] = useState<Shop | Massage | null>(null);

  // Area preselected from a link elsewhere on the site: /studios?area=Chamberi
  const [searchParams, setSearchParams] = useSearchParams();
  const areaParam = (searchParams.get("area") || "").trim();
  const clearAreaParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("area");
    setSearchParams(next, { replace: true });
  };



  // Runs on every mount, including back-navigation remounts. Paints instantly
  // from the in-memory cache when we have one, then revalidates. The loading
  // flag always resolves, so "0 found" can only show after a completed fetch.
  useEffect(() => {
    let cancelled = false;
    const cached = cachedShops();
    if (cached && cached.length) {
      setRealShops(cached);
      setShopsLoading(false);
    } else {
      setShopsLoading(true);
    }
    loadShops()
      .then((shops) => {
        if (cancelled) return;
        setRealShops(shops);
        const claimed = shops.filter((s) => s.status === "active").map((s) => s.partner_id);
        if (claimed.length) fetchFreeTodayPartnerIds(claimed).then(setFreeTodayIds).catch(() => {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setShopsLoading(false);
      });
    return () => { cancelled = true; };
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
  const c = COPY[lang];
  // The request flow (go.html) for visitors who would rather we ask for them.
  const requestHref = `/reserve?src=studios${lang === "es" ? "&lang=es" : ""}`;

  // ── Scroll memory: Back from a studio page returns to the same card. ──
  // On phones this screen scrolls inside its own container (MobileFrame is one
  // screen tall). From 900px it has no scroller of its own, so the sticky map
  // can follow the list: the app shell's scroller moves instead. The position
  // is the nearest container that really scrolls, or the window's.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const restoredRef = useRef(false);
  const [pendingScroll, setPendingScroll] = useState<number | null>(null);
  const scrollingEl = (): HTMLElement | null => {
    let el: HTMLElement | null = scrollRef.current;
    while (el) {
      const oy = window.getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return el;
      el = el.parentElement;
    }
    return null;
  };

  // Desktop: the map column is sticky and as tall as the visible scroll area
  // (whatever header or tab bar sits around it), measured, not guessed.
  const [scrollerH, setScrollerH] = useState<number | null>(null);
  // Layout effect: the map gets its final height before the first paint, so
  // Google Maps frames the pins for the size it will keep.
  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    let scroller: HTMLElement | null = root.parentElement;
    while (scroller) {
      const oy = window.getComputedStyle(scroller).overflowY;
      if (oy === "auto" || oy === "scroll") break;
      scroller = scroller.parentElement;
    }
    const target = scroller ?? document.documentElement;
    const measure = () => setScrollerH(scroller ? scroller.clientHeight : window.innerHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(target);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const rememberPosition = () => {
    try {
      const el = scrollingEl();
      const pos: ListPos = { scrollY: el ? el.scrollTop : window.scrollY, visibleCount, q, area: areaParam };
      sessionStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      /* private mode: Back simply starts at the top */
    }
  };
  useEffect(() => {
    if (restoredRef.current || shopsLoading || realShops.length === 0) return;
    restoredRef.current = true;
    let saved: ListPos | null = null;
    try {
      const raw = sessionStorage.getItem(POS_KEY);
      sessionStorage.removeItem(POS_KEY);
      saved = raw ? (JSON.parse(raw) as ListPos) : null;
    } catch {
      saved = null;
    }
    if (!saved || (saved.area || "") !== areaParam) return;
    if (saved.q) setQ(saved.q);
    if (saved.visibleCount > 8) setVisibleCount(saved.visibleCount);
    setPendingScroll(Math.max(0, Number(saved.scrollY) || 0));
  }, [shopsLoading, realShops.length, areaParam]);
  useLayoutEffect(() => {
    if (pendingScroll == null) return;
    const y = pendingScroll;
    setPendingScroll(null);
    const el = scrollingEl();
    if (el) el.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    else window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
  }, [pendingScroll]);

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
      const areaHaystack = norm(
        [(m as any).district, (m as any).address, (m as any).location, m.studio].filter(Boolean).join(" "),
      );
      const matchesAreaParam = !areaParam || areaHaystack.includes(norm(areaParam));
      return matchesQ && matchesType && matchesArea && matchesSaved && matchesAreaParam;
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
  const cardHref = (m: Shop | Massage) =>
    "partner_id" in m && (m as Shop).partner_id ? studioPath(m as Shop) : `/massages/${m.id}`;

  const handleBook = (m: Shop | Massage) => {
    rememberPosition();
    if ("partner_id" in m && (m as Shop).partner_id) {
      navigate(studioPath(m as Shop));
      return;
    }
    set({ massageId: m.id, shop: m });
    navigate(`/massages/${m.id}`);
  };




  const headingText = userLoc ? t("app.massageList.studiosNearYou") : c.headingMadrid;
  // Desktop map height: the visible scroll area minus the 16px sticky offset
  // above and 16px of air below.
  const mapStyle = scrollerH
    ? ({ "--mc-map-h": `${Math.max(360, scrollerH - 32)}px` } as React.CSSProperties)
    : undefined;

  return (
    <div
      ref={scrollRef}
      className="flex flex-col h-full overflow-y-auto bg-background min-[900px]:block min-[900px]:h-auto min-[900px]:min-h-full min-[900px]:overflow-visible min-[900px]:w-full min-[900px]:max-w-[1120px] min-[900px]:mx-auto min-[900px]:px-5 min-[900px]:pt-6"
    >
      {/* Top utility bar. From 900px it steps aside when the shared site
          header (a <header> element) is on the page, so the account link and
          language picker are not shown twice. */}
      <div className="px-5 pt-5 flex items-center justify-between gap-4 min-[900px]:px-0 min-[900px]:pt-0 min-[900px]:pb-5 min-[900px]:[body:has(header)_&]:hidden">
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

      {/* Desktop page title: one line of facts and actions, sentence case. */}
      <div className="hidden min-[900px]:block pb-6">
        <h1 className="font-display text-[36px] leading-[42px] text-foreground">{headingText}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[15px] text-muted-foreground">
          <span className="font-semibold text-foreground">
            {shopsLoading ? t("app.massageList.loadingStudios") : c.found(filtered.length)}
          </span>
          {!userLoc && (
            <button
              onClick={handleShowDistances}
              disabled={locatingDistances}
              className="min-h-10 inline-flex items-center gap-1.5 font-medium text-foreground/80 hover:text-primary hover:underline underline-offset-4 transition"
            >
              {locatingDistances ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
              {locatingDistances ? c.findingYou : c.showDistances}
            </button>
          )}
          <button
            onClick={() => navigate("/app/discovery")}
            className="min-h-10 inline-flex items-center gap-1.5 font-medium text-foreground/80 hover:text-primary hover:underline underline-offset-4 transition"
          >
            <Sparkles className="h-4 w-4" /> {c.discoverTypes}
          </button>
        </div>
      </div>

      {/* From 900px: the list on the left, the map sticky on the right
          (Treatwell pattern). Below 900px both wrappers are display:contents,
          so every block keeps the CSS order it has on phones and tablets. */}
      <div className="contents min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,1fr)_400px] min-[900px]:gap-6 min-[900px]:items-start">
        <div className="contents min-[900px]:flex min-[900px]:flex-col min-[900px]:min-w-0 min-[900px]:col-start-1 min-[900px]:row-start-1">
          {/* Concierge shortcut: a full page load of the request flow (go.html). */}
          <div className="px-5 pt-4 md:order-1 min-[900px]:px-0 min-[900px]:pt-0">
            <a
              href={requestHref}
              className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-secondary/50 px-4 py-3 text-sm text-foreground hover:border-primary transition min-[900px]:px-5 min-[900px]:py-4 min-[900px]:text-[15px] min-[900px]:hover:bg-secondary/80"
            >
              <span>{c.askUs}</span>
              <span aria-hidden className="text-primary">→</span>
            </a>
          </div>

          {/* Search */}
          <div className="px-5 pt-5 md:order-2 min-[900px]:px-0 min-[900px]:pt-4">
            <div className="relative">
              <div className="flex items-center gap-2 bg-card rounded-full shadow-soft border border-border/60 pl-5 pr-2 h-14 min-[900px]:focus-within:border-primary/60">
                <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setVisibleCount(8); setSearchOpen(true); }}
                  onFocus={() => { if (q.trim()) setSearchOpen(true); }}
                  onBlur={() => { window.setTimeout(() => setSearchOpen(false), 150); }}
                  onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
                  placeholder={t("app.massageList.searchPlaceholder")}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground min-[900px]:text-base"
                />
                {searching && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />}
                <button
                  onClick={() => setShowFilters((s) => !s)}
                  aria-label={t("app.massageList.filters")}
                  aria-expanded={showFilters}
                  className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>

              {q.trim() !== "" && (
                <p className="pt-2 pl-1 text-xs text-muted-foreground min-[900px]:text-[13px]">{c.found(filtered.length)}</p>
              )}

              {searchOpen && debouncedQ.trim() !== "" && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 bg-white rounded-2xl border border-[#E6DCCF] shadow-lg max-h-[320px] overflow-y-auto">
                  {dropdownResults.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-foreground/80">{c.noneFound}</p>
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
                            <p className="text-xs text-[#8a7460] truncate min-[900px]:text-[13px]">{"district" in m && m.district ? m.district : "Madrid"}</p>
                          </div>
                          {km != null && (
                            <span className="text-xs text-[#8a7460] flex-shrink-0 min-[900px]:text-[13px]">{distanceLabelShort(km)}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {showFilters && (
              <div className="flex gap-2 overflow-x-auto pt-3 pb-1 -mx-5 px-5 min-[900px]:mx-0 min-[900px]:px-0 min-[900px]:flex-wrap min-[900px]:overflow-visible">
                <FilterChip active={typeFilter === "all"} onClick={() => { setTypeFilter("all"); setVisibleCount(8); }}>{t("app.massageList.filterAll")}</FilterChip>
                {MASSAGE_TYPES.map((t) => (
                  <FilterChip key={t.id} active={typeFilter === t.id} onClick={() => { setTypeFilter(t.id); setVisibleCount(8); }}>
                    {t.name}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          {/* Quiz entry point: between search and map on tablets; on phones it
              follows the studio list (CSS order), so cards come first. From
              900px it closes the list column as one compact row. */}
          <div className="order-[5] md:order-3 px-5 pt-4 min-[900px]:order-6 min-[900px]:px-0 min-[900px]:pt-8">
            <button
              type="button"
              onClick={() => navigate("/app/discovery/quiz")}
              aria-label={t("app.discovery.quizCardAria")}
              className="group w-full text-left rounded-3xl border border-border/70 bg-secondary/40 p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-all motion-safe:hover:border-primary/50 motion-safe:hover:bg-secondary/70 motion-safe:active:scale-[0.995] min-[900px]:rounded-2xl min-[900px]:px-6"
            >
              <div className="flex items-start gap-3 min-[900px]:items-center min-[900px]:gap-4">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 min-[900px]:mt-0" />
                <div className="min-w-0 min-[900px]:flex-1 min-[900px]:flex min-[900px]:items-center min-[900px]:justify-between min-[900px]:gap-6">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold text-foreground leading-tight min-[900px]:text-xl">
                      {t("app.massageList.quizCardTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 min-[900px]:text-[15px] min-[900px]:max-w-[34rem]">
                      {t("app.massageList.quizCardSub")}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center justify-center min-h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-soft group-hover:bg-primary/90 transition-colors min-[900px]:mt-0 min-[900px]:flex-shrink-0 min-[900px]:text-[15px]">
                    {t("app.massageList.quizCardCta")}
                  </span>
                </div>
              </div>
            </button>
          </div>

          {/* Studios list: first after the search on phones (order 4). */}
          <div className="order-[4] md:order-5 px-5 pt-6 min-[900px]:px-0 min-[900px]:pt-5">
            <BookAgainChip className="mb-3" />

            {/* Heading on its own row on phones; beside its meta actions from
                768px. From 900px the page title above the columns replaces it. */}
            <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-baseline md:justify-between min-[900px]:hidden">
              <h2 className="font-display text-2xl text-foreground">
                {headingText}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4">
                {!userLoc && (
                  <button
                    onClick={handleShowDistances}
                    disabled={locatingDistances}
                    className="min-h-11 text-xs font-bold tracking-[0.1em] uppercase text-foreground/70 hover:text-primary flex items-center gap-1.5 transition"
                  >
                    {locatingDistances ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Compass className="h-3.5 w-3.5" />}
                    {locatingDistances ? c.findingYou : c.showDistances}
                  </button>
                )}
                <button
                  onClick={() => navigate("/app/discovery")}
                  className="min-h-11 text-xs font-bold tracking-[0.1em] uppercase text-foreground/70 hover:text-primary flex items-center gap-1.5 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {t("app.massageList.discover")}
                </button>
                <span className="text-xs font-bold tracking-[0.1em] text-primary uppercase">{t("app.massageList.foundCount", { count: filtered.length })}</span>
              </div>
            </div>

            {(areaParam || areaBounds) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {areaParam && (
                  <button
                    type="button"
                    onClick={clearAreaParam}
                    className="min-h-9 inline-flex items-center gap-2 rounded-full border border-primary/50 bg-card px-3 text-xs font-semibold text-foreground/80 hover:text-primary transition min-[900px]:text-[13px]"
                  >
                    {c.areaChip(areaParam)}
                  </button>
                )}
                {areaBounds && (
                  <button
                    type="button"
                    onClick={() => setAreaBounds(null)}
                    className="min-h-9 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 text-xs font-semibold text-foreground/80 hover:text-primary transition min-[900px]:text-[13px]"
                  >
                    {c.boundsChip}
                  </button>
                )}
              </div>
            )}

            {/* All / Saved tabs, so the saved list has somewhere to live */}
            <div className="flex items-center gap-2 mb-4" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!savedOnly}
                onClick={() => { setSavedOnly(false); setVisibleCount(8); }}
                className={cn(
                  "h-9 px-4 rounded-full text-xs font-semibold border transition min-[900px]:h-10 min-[900px]:px-5 min-[900px]:text-sm",
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
                  "h-9 px-4 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 min-[900px]:h-10 min-[900px]:px-5 min-[900px]:text-sm",
                  savedOnly ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50",
                )}
              >
                <Heart className={cn("h-3 w-3 min-[900px]:h-3.5 min-[900px]:w-3.5", savedOnly ? "fill-current" : "")} />
                {lang === "es" ? "Guardados" : "Saved"}
                {favourites.length > 0 && <span className="opacity-80">({favourites.length})</span>}
              </button>
            </div>

            {savedOnly && favourites.length === 0 && (
              <div className="rounded-3xl border border-border/70 bg-secondary/40 p-5 mb-4 min-[900px]:rounded-2xl">
                <p className="text-sm font-semibold text-foreground min-[900px]:text-[15px]">
                  {lang === "es" ? "Aún no has guardado estudios" : "No saved studios yet"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 min-[900px]:text-sm">
                  {lang === "es"
                    ? "Toca el corazón en cualquier estudio para guardarlo aquí."
                    : "Tap the heart on any studio to keep it here."}
                </p>
              </div>
            )}

            {/* Two cards per row on tablets; one row per studio beside the map
                from 900px. */}
            <div className="grid gap-4 md:grid-cols-2 min-[900px]:grid-cols-1 min-[900px]:gap-3">
              {shopsLoading ? (
                <p className="md:col-span-2 min-[900px]:col-span-1 text-center text-muted-foreground py-12 text-sm">{t("app.massageList.loadingStudios")}</p>
              ) : filtered.length === 0 ? (
                <div className="md:col-span-2 min-[900px]:col-span-1 text-center py-12">
                  <p className="text-sm text-muted-foreground">{t("app.massageList.noMatches")}</p>
                </div>
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
                          "w-full min-w-0 bg-card border rounded-3xl p-3 shadow-soft hover:shadow-elegant transition-all cursor-pointer min-[900px]:rounded-2xl min-[900px]:p-4",
                          isHovered
                            ? "border-primary ring-2 ring-primary/30"
                            : isSelected ? "border-primary/60 ring-1 ring-primary/30" : "border-border/60 min-[900px]:hover:border-primary/60"
                        )}
                        onMouseEnter={() => setHoverKey(mKey)}
                        onMouseLeave={() => setHoverKey((cur) => (cur === mKey ? null : cur))}
                        onClick={() => handleBook(m)}
                      >

                        <div className="flex gap-3 min-[900px]:gap-4">
                          <Link
                            to={cardHref(m)}
                            onClick={(e) => { e.stopPropagation(); rememberPosition(); }}
                            className="relative h-24 w-24 rounded-2xl overflow-hidden flex-shrink-0 bg-secondary block min-[900px]:h-[90px] min-[900px]:w-[120px] lg:h-[120px] lg:w-[160px] min-[900px]:rounded-xl"
                          >
                            {/* Jordan: "show customers the real studio". Only the studio's
                                own photo stands for the place; without one the tile
                                shows its initial and neighbourhood, never a stock
                                picture that looks like the studio. */}
                            {m.ownImage ? (
                              <img src={m.ownImage} alt={m.studio} className="absolute inset-0 h-full w-full object-cover" onError={studioImageFallback} />
                            ) : (
                              <PlaceTile name={m.studio} hood={"district" in m && m.district ? m.district : null} />
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleFavourite(m as any); }}
                              aria-label={t("app.massageList.favorite")}
                              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/95 flex items-center justify-center shadow-soft hover:scale-105 transition min-[900px]:h-8 min-[900px]:w-8 min-[900px]:top-2 min-[900px]:right-2"
                            >
                              <Heart className={cn("h-3 w-3 min-[900px]:h-4 min-[900px]:w-4", isFav ? "fill-primary text-primary" : "text-foreground")} />
                            </button>
                          </Link>

                          <div className="flex-1 min-w-0 py-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-display text-[17px] font-semibold text-foreground leading-snug min-w-0 min-[900px]:text-lg">
                                <Link
                                  to={cardHref(m)}
                                  onClick={(e) => { e.stopPropagation(); rememberPosition(); }}
                                  className="block line-clamp-2 break-words md:hover:text-primary transition-colors"
                                >
                                  {m.studio}
                                </Link>
                              </h3>

                              {m.rating != null && (
                                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                                  <Star className="h-3.5 w-3.5 fill-accent text-accent min-[900px]:h-4 min-[900px]:w-4" />
                                  <span className="text-xs font-semibold text-foreground whitespace-nowrap min-[900px]:text-sm">
                                    {Number(m.rating).toFixed(1)}
                                    {m.reviews != null && (
                                      <span className="font-normal text-muted-foreground"> ({m.reviews})</span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 min-[900px]:text-sm min-[900px]:gap-1.5">
                              <MapPin className="h-3 w-3 flex-shrink-0 min-[900px]:h-3.5 min-[900px]:w-3.5" />
                              <span className="truncate">{"district" in m && m.district ? m.district : t("app.massageList.madrid")}</span>
                            </div>

                            {(() => {
                              // Compact card: the English massage type plus the price.
                              // The studio's own internal menu name stays on the studio page.
                              const svc = (m as any).partner_services?.[0];
                              if (!svc) return null;
                              const typed = findMassageType(svc.name_en, svc.name);
                              const label = (typed ? typed.name[lang] : "") || servicePrimaryName(svc, "", lang);
                              const price = svc?.price ?? (m as any).price;
                              const minutes = Number(svc?.duration) > 0 ? Number(svc.duration) : null;
                              if (!label) return null;
                              return (
                                <p className="text-xs text-foreground/80 mt-1.5 line-clamp-2 break-words min-[900px]:text-[15px] min-[900px]:mt-2">
                                  <span className="font-medium">{label}</span>
                                  {price != null && (
                                    <span className="font-semibold text-primary">
                                      {minutes ? ` · ${minutes} min · ${formatPrice(Number(price), lang)}` : ` · ${formatPrice(Number(price), lang)}`}
                                    </span>
                                  )}
                                </p>
                              );
                            })()}

                            {userLoc && typeof (m as any).lat === "number" && typeof (m as any).lng === "number" && (() => {
                              const km = haversineKm(userLoc, m as any);
                              const dirUrl = walkingDirectionsUrl(m as any, `${m.studio} Madrid`, userLoc);
                              return (
                                <p className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 min-[900px]:text-[13px]">
                                  <span>{distanceLabel(km, lang)} {areaName ? originSuffix(areaName, lang) : ""}</span>
                                  {dirUrl && (
                                    <a
                                      href={dirUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-primary font-semibold hover:underline"
                                    >
                                      {c.directions}
                                    </a>
                                  )}
                                </p>
                              );
                            })()}

                            <div className="flex flex-wrap items-center gap-1.5 mt-2 min-[900px]:gap-2 min-[900px]:mt-3">
                              <span className="text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-1 rounded-full bg-secondary text-muted-foreground whitespace-nowrap min-[900px]:text-[13px] min-[900px]:font-semibold min-[900px]:normal-case min-[900px]:tracking-normal min-[900px]:px-2.5">
                                {t("app.massageList.payAtStudio")}
                              </span>
                              <StudioStatusBadge
                                className="tracking-[0.06em] px-2 whitespace-nowrap min-[900px]:text-[13px] min-[900px]:font-semibold min-[900px]:normal-case min-[900px]:tracking-normal min-[900px]:px-2.5"
                                variant={studioBadgeVariant((m as any).status, (m as any).partner_id, freeTodayIds, m as any)}
                              />
                              <CompareToggle studio={m as any} size="sm" className="px-2 min-[900px]:h-8 min-[900px]:px-3 min-[900px]:text-[13px]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length > visibleCount && (
                    <div className="md:col-span-2 min-[900px]:col-span-1 flex justify-center pt-2">
                      <button
                        onClick={() => setVisibleCount((n) => n + 8)}
                        className="min-h-11 px-8 rounded-full border border-primary text-primary text-xs font-bold tracking-[0.14em] uppercase hover:bg-primary/5 transition min-[900px]:text-[15px] min-[900px]:font-semibold min-[900px]:normal-case min-[900px]:tracking-normal"
                      >
                        {c.showMore}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>


            {/* Never leave a filtered list looking silent and unresponsive. */}
            {!shopsLoading && !savedOnly && filtered.length < 3 && (areaParam || areaBounds || q.trim()) && (
              <p className="text-sm text-muted-foreground text-center py-4 min-[900px]:text-[15px]">
                {c.fewHere}{" "}
                <a href={requestHref} className="text-primary font-semibold underline underline-offset-2">
                  {c.askUsLink}
                </a>
              </p>
            )}

            {/* The "Email me deals" card (ExitCaptureBlock) sat here. Removed 31 Oct:
                1 sign-up in 318 views, and it promised "a good price" no studio had
                confirmed (discount rule, 5 Sept). */}

          </div>
        </div>

        {/* Map: shared component, also used on /app/discovery. Follows the
            list on phones, sits above it on tablets, and stays in view beside
            it from 900px. No location sheet opens by itself: "Show distances"
            asks on a tap. */}
        <div
          className="order-[6] md:order-4 px-5 pt-5 min-[900px]:px-0 min-[900px]:pt-0 min-[900px]:sticky min-[900px]:top-4 min-[900px]:col-start-2 min-[900px]:row-start-1"
          style={mapStyle}
        >
          <StudioMap
            shops={realShops}
            heightClass="h-[230px] md:h-[360px] min-[900px]:h-[var(--mc-map-h,560px)]"
            roundedClass="rounded-3xl min-[900px]:rounded-2xl"
            desktopSticky
            highlightedKey={hoverKey}
            onHoverStudio={setHoverKey}
            onSearchArea={setAreaBounds}
            onUserLocation={(loc) => {
              setUserLoc(loc);
              setAreaName(savedLocationResult()?.areaName ?? null);
            }}
            onSelect={(shop) => handleBook(shop)}
          />
        </div>
      </div>

      {/* Footer: last on phones too, after the quiz and the map. The
          "Get massage deals" link that sat here was removed: we never promise
          a deal before a studio confirms one in writing. */}
      <div className="order-[7] md:order-6 px-5 pt-8 pb-28 text-center min-[900px]:px-0 min-[900px]:pt-10 min-[900px]:pb-12">
        <button
          onClick={() => navigate("/partner/login")}
          className="min-h-11 text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition min-[900px]:text-sm"
        >
          {t("app.massageList.studioCta")}
        </button>
      </div>


      {/* 86px keeps it above the phone tab bar; the tab bar is hidden from 900px (F8). */}
      <CompareBar className="pb-[86px] desk:pb-3" />
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

/**
 * A studio with no photo of its own: its initial and neighbourhood on a warm,
 * map-like tile. Honest about what we have, instead of a stock picture that
 * reads as the studio's room.
 */
function PlaceTile({ name, hood }: { name: string; hood: string | null }) {
  const initial = (name || "").trim().charAt(0).toUpperCase() || "M";
  return (
    <div
      aria-hidden="true"
      data-testid="place-tile"
      className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#9A4A2C]"
      style={{
        backgroundColor: "#F3E6DA",
        backgroundImage:
          "linear-gradient(rgba(154,74,44,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(154,74,44,.09) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    >
      <span className="font-display text-3xl font-semibold leading-none">{initial}</span>
      {hood && (
        <span className="flex max-w-[88px] items-center gap-0.5 px-1 text-[11px] font-semibold leading-tight text-[#5E4A3D]">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{hood}</span>
        </span>
      )}
    </div>
  );
}
