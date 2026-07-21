import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, MapPin, Heart, SlidersHorizontal, Compass, UserCircle, Clock, Sparkles } from "lucide-react";
import { MASSAGES, MASSAGE_TYPES, MassageType, MADRID_CENTER, distanceKm } from "../data";
import { useBooking } from "../BookingContext";
import { cn } from "@/lib/utils";
import { loadGoogleMaps } from "../lib/googleMaps";
import { fetchShops, supabase } from "@/lib/supabase";
import type { Shop } from "@/lib/supabase";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";

const STUDIO_ICONS: Record<string, string> = {
  "Casa Cibeles": "🧖‍♀️",
  "El Retiro Wellness": "💆",
  "Salamanca Spa Real": "🔥",
  "Chamberí Manos": "🏃",
  "Malasaña Holístico": "🪷",
  "La Latina Termas": "🌊",
};

function getStudioIcon(studio: string): string {
  for (const [key, icon] of Object.entries(STUDIO_ICONS)) {
    if (studio.includes(key.split(" ")[0])) return icon;
  }
  return "💆";
}

export default function MassageList() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { set } = useBooking();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<MassageType | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [realShops, setRealShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(8);

  const [selectedStudio, setSelectedStudio] = useState<Shop | typeof MASSAGES[0] | null>(null);


  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const requestUserLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    requestUserLocation();
  }, []);

  useEffect(() => {
    fetchShops().then((shops) => {
      setRealShops(shops);
      setShopsLoading(false);
    });
  }, []);

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
    })();
    return () => { cancelled = true; };
  }, []);

  const allShops: Shop[] = [...realShops];

  const origin = userLoc ?? MADRID_CENTER;

  const filtered = allShops
    .filter((m) => {
      if (!m || !m.name || !m.studio) return false;
      const query = q.toLowerCase();
      const matchesQ =
        m.name.toLowerCase().includes(query) ||
        m.studio.toLowerCase().includes(query) ||
        ("district" in m && m.district?.toLowerCase().includes(query));
      const matchesType = typeFilter === "all" || m.type === typeFilter;
      return matchesQ && matchesType;
    })
    .map((m) => ({
      ...m,
      km: typeof (m as any).lat === "number" && typeof (m as any).lng === "number"
        ? distanceKm(origin, m as any)
        : (m as any).km ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));

  const mapShops = [...realShops].filter(
    (m: any) => m && typeof m.lat === "number" && typeof m.lng === "number"
  );

  // Initialize inline map (always rendered as header banner)
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps().then((g) => {
      if (cancelled || !mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: userLoc ?? MADRID_CENTER,
        zoom: userLoc ? 14 : 13,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#f6efe1" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#5b4636" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#f6efe1" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#bcd4d8" }] },
        ],
      });
      mapInstanceRef.current = map;

      const iconSvg = (emoji: string, active: boolean) => {
        const size = active ? 52 : 42;
        return {
          url: `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
              <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${active ? "#E0A458" : "#C4622D"}" stroke="white" stroke-width="3"/>
              <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${active ? 26 : 20}">${emoji}</text>
            </svg>`
          )}`,
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        };
      };

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      mapShops.forEach((m) => {
        const marker = new google.maps.Marker({
          position: { lat: (m as any).lat, lng: (m as any).lng },
          map,
          title: m.studio,
          icon: iconSvg(getStudioIcon(m.studio), false),
        });
        marker.addListener("click", () => {
          markersRef.current.forEach((mr: any) => {
            mr.setIcon(iconSvg(getStudioIcon(mr.getTitle() ?? ""), false));
          });
          marker.setIcon(iconSvg(getStudioIcon(m.studio), true));
          setSelectedStudio(m as any);
          map.panTo({ lat: (m as any).lat, lng: (m as any).lng });
        });
        markersRef.current.push(marker);
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      if (userLoc) {
        userMarkerRef.current = new google.maps.Marker({
          position: userLoc,
          map,
          title: t("app.massageList.youAreHere"),
          zIndex: 9999,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
      }
    });

    return () => { cancelled = true; };
  }, [realShops, userLoc]);



  const handleBook = (m: Shop | typeof MASSAGES[0]) => {
    if ("partner_id" in m && (m as Shop).partner_id) {
      navigate(`/s/${(m as Shop).partner_id}`);
      return;
    }
    set({ massageId: m.id, shop: m });
    navigate(`/massages/${m.id}`);
  };

  const toggleFav = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Top utility bar */}
      <div className="px-5 pt-5 flex items-center justify-between gap-4">
        <button
          onClick={() => navigate("/app/profile")}
          aria-label={t("app.massageList.profile")}
          className="h-10 w-10 rounded-full overflow-hidden bg-card border border-border flex items-center justify-center hover:border-primary/50 transition shadow-soft"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={t("app.massageList.profile")} className="h-full w-full object-cover" />
          ) : (
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        <div className="flex items-center gap-3">
          <LanguageFlagToggle variant="compact" />
          <button
            onClick={() => navigate("/partner/dashboard")}
            className="h-10 px-4 rounded-full bg-card border border-border text-foreground text-xs font-semibold tracking-wide hover:border-primary/50 transition shadow-soft"
          >
            {t("app.massageList.switchToPartner")}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2 bg-card rounded-full shadow-soft border border-border/60 pl-5 pr-2 h-14">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setVisibleCount(8); }}
            placeholder={t("app.massageList.searchPlaceholder")}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <button
            onClick={() => setShowFilters((s) => !s)}
            aria-label={t("app.massageList.filters")}
            className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
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

      {/* Map header banner */}
      <div className="px-5 pt-5">
        <div className="relative rounded-3xl overflow-hidden shadow-soft border border-border/60 h-[230px]">
          <div ref={mapRef} className="absolute inset-0" />
          <button
            onClick={() => { if (!userLoc) requestUserLocation(); }}
            className="absolute top-3 left-3 flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-full pl-3 pr-4 py-1.5 shadow-soft border border-border/60 hover:bg-card transition"
          >
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <Compass className="h-3 w-3 text-primary" />
            </div>
            <span className="text-[10px] font-bold tracking-[0.14em] text-foreground uppercase">
              {userLoc ? t("app.massageList.yourLocation") : t("app.massageList.nearMadrid")}
            </span>
          </button>
        </div>
      </div>

      {/* Selected studio bottom sheet (from map pin tap) */}
      {selectedStudio && (
        <div className="mx-5 mt-3 bg-card border border-border rounded-3xl shadow-elegant p-4">
          <div className="flex gap-3">
            {selectedStudio.image && (
              <img src={selectedStudio.image} alt={selectedStudio.studio} className="h-20 w-20 rounded-2xl object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground leading-tight">{selectedStudio.studio}</p>
                  <p className="text-xs text-primary font-semibold mt-0.5">{selectedStudio.name}</p>
                </div>
                <button onClick={() => setSelectedStudio(null)} className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm">×</button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" /> {selectedStudio.rating}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {selectedStudio.duration}{t("app.massageList.minutesShort")}</span>
                {"district" in selectedStudio && selectedStudio.district && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedStudio.district}</span>
                )}
              </div>
              <button
                onClick={() => handleBook(selectedStudio)}
                className="mt-3 h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wide uppercase shadow-soft hover:opacity-90 transition"
              >
                {t("app.massageList.bookNow")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Studios list */}
      <div className="px-5 pt-6 pb-28">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-2xl text-foreground">{t("app.massageList.studiosNearYou")}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/app/discovery")}
              className="text-[10px] font-bold tracking-[0.12em] uppercase text-foreground/70 hover:text-primary flex items-center gap-1 transition"
            >
              <Sparkles className="h-3 w-3" /> {t("app.massageList.discover")}
            </button>
            <span className="text-[10px] font-bold tracking-[0.12em] text-primary uppercase">{t("app.massageList.foundCount", { count: filtered.length })}</span>
          </div>
        </div>

        <div className="space-y-4">
          {shopsLoading ? (
            <p className="text-center text-muted-foreground py-12 text-sm">{t("app.massageList.loadingStudios")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">{t("app.massageList.noMatches")}</p>
          ) : (
            <>
              {filtered.slice(0, visibleCount).map((m, idx) => {
                const isFav = favorites.has(m.id);
                const isSelected = selectedStudio?.id === m.id || (!selectedStudio && idx === 0);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "w-full bg-card border rounded-3xl p-3 shadow-soft hover:shadow-elegant transition-all cursor-pointer",
                      isSelected ? "border-primary/60 ring-1 ring-primary/30" : "border-border/60"
                    )}
                    onClick={() => handleBook(m)}
                  >
                    <div className="flex gap-3">
                      <div className="relative h-[110px] w-[110px] rounded-2xl overflow-hidden flex-shrink-0 bg-secondary">
                        {m.image && (
                          <img src={m.image} alt={m.name} className="absolute inset-0 h-full w-full object-cover" />
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFav(m.id); }}
                          aria-label={t("app.massageList.favorite")}
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/95 flex items-center justify-center shadow-soft hover:scale-105 transition"
                        >
                          <Heart className={cn("h-3.5 w-3.5", isFav ? "fill-primary text-primary" : "text-foreground")} />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-lg font-semibold text-foreground leading-tight truncate">
                            {m.studio}
                          </h3>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Star className="h-4 w-4 fill-accent text-accent" />
                            <span className="text-sm font-semibold text-foreground">{m.rating}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{"district" in m && m.district ? m.district : t("app.massageList.madrid")}</span>
                        </div>

                        <p className="text-xs text-foreground/80 mt-2 truncate">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-muted-foreground"> · {m.duration} {t("app.massageList.minutes")}</span>
                          {"price" in m && (m as any).price != null && (
                            <span className="font-semibold text-primary"> · €{(m as any).price}</span>
                          )}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">
                            {t("app.massageList.payAtStudio")}
                            </span>
                          <span className="text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                            {t("app.massageList.availableToday")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length > visibleCount && (
                <div className="flex justify-center pt-2">
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
      </div>
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
